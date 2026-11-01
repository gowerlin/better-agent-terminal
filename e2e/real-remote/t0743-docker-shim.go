// T0743 — test-only `docker.exe` for e2e/t0743-docker-wizard.spec.ts (opt-in, Windows only).
//
// BAT's Docker wizard runs `docker` from the main process PATH (electron/docker-detect.ts,
// electron/docker-lifecycle.ts). On a host whose Docker engine lives inside WSL, the spec builds
// this file into a temp directory and prepends it to the isolated instance's PATH only, so the
// wizard reaches WSL's engine as `wsl.exe -d <distro> --exec docker …`. Nothing on the host is
// configured: no docker context, no TCP listener, no daemon change.
//
// Guard rails (the WSL engine is shared with the user's own containers):
//   - `ps` output keeps only lines naming a container that matches T0743_SHIM_ALLOW, so the
//     wizard never sees (or picks) a container the test did not create;
//   - every command that names a container (inspect / start / stop / restart / rm / logs / exec /
//     port / run --name) must name an allowed one, otherwise it is refused (exit 1, stderr
//     "T0743 shim guard: …") and never reaches docker;
//   - subcommands other than the ones BAT uses are refused.
//
// Rewrites, logged per call:
//   - `run`: the image in T0743_SHIM_IMAGE_MAP (`from=to`) is replaced (the test's own image
//     instead of the user's `bat-server:latest`), `--label T0743_SHIM_LABEL` is added, and a
//     Windows host path in `-v C:\x:/y` becomes `/mnt/c/x` (what the WSL engine can mount).
//
// Every call is appended to T0743_SHIM_LOG as one JSON line (`--token <value>` masked).
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

var winPathVolume = regexp.MustCompile(`^([A-Za-z]):([\\/][^:]*):(/.*)$`)

// Flags (per subcommand) that take a separate value argument.
var valueFlags = map[string]map[string]bool{
	"run":     {"--name": true, "--restart": true, "-p": true, "-v": true, "--label": true, "-e": true, "--network": true, "--hostname": true, "-w": true, "-u": true, "--entrypoint": true},
	"inspect": {"--type": true, "--format": true, "-f": true},
	"exec":    {"-u": true, "-e": true, "-w": true, "--user": true, "--workdir": true},
	"logs":    {"--tail": true, "-n": true, "--since": true, "--until": true},
	"stop":    {"-t": true, "--time": true, "-s": true, "--signal": true},
	"restart": {"-t": true, "--time": true, "-s": true, "--signal": true},
	"start":   {},
	"rm":      {},
	"port":    {},
}

type entry struct {
	At        string   `json:"at"`
	Args      []string `json:"args"`
	Forwarded []string `json:"forwarded,omitempty"`
	Refused   string   `json:"refused,omitempty"`
	Exit      int      `json:"exit"`
	PsHidden  int      `json:"psHidden,omitempty"`
}

func mask(args []string) []string {
	out := make([]string, len(args))
	copy(out, args)
	for i := 0; i+1 < len(out); i++ {
		if out[i] == "--token" {
			out[i+1] = "<token>"
		}
	}
	return out
}

func writeLog(e entry) {
	path := os.Getenv("T0743_SHIM_LOG")
	if path == "" {
		return
	}
	e.Args = mask(e.Args)
	e.Forwarded = mask(e.Forwarded)
	line, _ := json.Marshal(e)
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer f.Close()
	f.Write(append(line, '\n'))
}

// positionals returns the non-flag arguments after the subcommand, skipping flag values.
func positionals(sub string, rest []string) []string {
	flags := valueFlags[sub]
	var out []string
	for i := 0; i < len(rest); i++ {
		a := rest[i]
		if strings.HasPrefix(a, "-") {
			if flags[a] {
				i++
			}
			continue
		}
		out = append(out, a)
	}
	return out
}

func refuse(e entry, msg string) {
	e.Refused = msg
	e.Exit = 1
	writeLog(e)
	fmt.Fprintf(os.Stderr, "T0743 shim guard: %s\n", msg)
	os.Exit(1)
}

func main() {
	args := os.Args[1:]
	e := entry{At: time.Now().Format(time.RFC3339Nano), Args: args}
	distro := os.Getenv("T0743_SHIM_DISTRO")
	allowExpr := os.Getenv("T0743_SHIM_ALLOW")
	if distro == "" || allowExpr == "" {
		refuse(e, "T0743_SHIM_DISTRO / T0743_SHIM_ALLOW not set")
	}
	allow, err := regexp.Compile(allowExpr)
	if err != nil {
		refuse(e, "bad T0743_SHIM_ALLOW: "+err.Error())
	}
	if len(args) == 0 {
		refuse(e, "no subcommand")
	}
	sub := args[0]
	rest := args[1:]
	forwarded := append([]string{}, args...)
	filterPs := false

	switch sub {
	case "--version", "version", "info":
	case "ps":
		filterPs = true
	case "inspect", "start", "stop", "restart", "rm", "logs", "port":
		names := positionals(sub, rest)
		if len(names) == 0 {
			refuse(e, sub+" without a container name")
		}
		for _, n := range names {
			if !allow.MatchString(n) {
				refuse(e, fmt.Sprintf("%s refused for container %q (not created by this test)", sub, n))
			}
		}
	case "exec":
		names := positionals(sub, rest)
		if len(names) == 0 || !allow.MatchString(names[0]) {
			target := ""
			if len(names) > 0 {
				target = names[0]
			}
			refuse(e, fmt.Sprintf("exec refused for container %q (not created by this test)", target))
		}
	case "run":
		flags := valueFlags["run"]
		name := ""
		out := []string{"run"}
		imageDone := false
		mapFrom, mapTo := "", ""
		if m := os.Getenv("T0743_SHIM_IMAGE_MAP"); strings.Contains(m, "=") {
			parts := strings.SplitN(m, "=", 2)
			mapFrom, mapTo = parts[0], parts[1]
		}
		label := os.Getenv("T0743_SHIM_LABEL")
		for i := 0; i < len(rest); i++ {
			a := rest[i]
			if !imageDone && strings.HasPrefix(a, "-") {
				if flags[a] && i+1 < len(rest) {
					v := rest[i+1]
					if a == "--name" {
						name = v
					}
					if a == "-v" {
						if m := winPathVolume.FindStringSubmatch(v); m != nil {
							v = "/mnt/" + strings.ToLower(m[1]) + strings.ReplaceAll(m[2], `\`, "/") + ":" + m[3]
						}
					}
					out = append(out, a, v)
					i++
					continue
				}
				out = append(out, a)
				continue
			}
			if !imageDone {
				imageDone = true
				if label != "" {
					out = append(out, "--label", label)
				}
				if mapFrom != "" && a == mapFrom {
					a = mapTo
				}
			}
			out = append(out, a)
		}
		if name == "" || !allow.MatchString(name) {
			refuse(e, fmt.Sprintf("run refused for container name %q (not an allowed test name)", name))
		}
		forwarded = out
	default:
		refuse(e, "subcommand "+sub+" is not used by BAT and not allowed")
	}

	e.Forwarded = forwarded
	cmd := exec.Command("wsl.exe", append([]string{"-d", distro, "--exec", "docker"}, forwarded...)...)
	cmd.Stdin = os.Stdin
	cmd.Stderr = os.Stderr
	var stdout bytes.Buffer
	if filterPs {
		cmd.Stdout = &stdout
	} else {
		cmd.Stdout = os.Stdout
	}
	runErr := cmd.Run()
	code := 0
	if runErr != nil {
		if ee, ok := runErr.(*exec.ExitError); ok {
			code = ee.ExitCode()
		} else {
			code = 1
			fmt.Fprintf(os.Stderr, "T0743 shim: %v\n", runErr)
		}
	}
	if filterPs {
		hidden := 0
		var kept []string
		for _, line := range strings.Split(stdout.String(), "\n") {
			if strings.TrimSpace(line) == "" {
				continue
			}
			keep := false
			var row struct{ Names string }
			if json.Unmarshal([]byte(line), &row) == nil && row.Names != "" {
				for _, n := range strings.Split(row.Names, ",") {
					if allow.MatchString(strings.TrimSpace(n)) {
						keep = true
					}
				}
			}
			if keep {
				kept = append(kept, line)
			} else {
				hidden++
			}
		}
		if len(kept) > 0 {
			os.Stdout.WriteString(strings.Join(kept, "\n") + "\n")
		}
		e.PsHidden = hidden
	}
	e.Exit = code
	writeLog(e)
	os.Exit(code)
}
