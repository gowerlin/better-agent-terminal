// T0743 — test-only `docker.exe` for e2e/t0743-docker-wizard.spec.ts (opt-in, Windows only).
//
// BAT's Docker wizard runs `docker` from the main process PATH (electron/docker-detect.ts,
// electron/docker-lifecycle.ts). On a host whose Docker engine lives inside WSL, the spec builds
// this file into a temp directory and prepends it to the isolated instance's PATH only, so the
// wizard reaches WSL's engine as `wsl.exe -d <distro> --exec docker …`. Nothing on the host is
// configured: no docker context, no TCP listener, no daemon change.
//
// Guard rails (the WSL engine is shared with the user's own containers):
//   - `ps` output keeps only lines naming a container that matches T0743_SHIM_ALLOW, and
//     `inspect <container id…>` (docker-detect.ts listContainers, T0851) keeps only the entries
//     of such containers, so the wizard never sees (or picks) a container the test did not create;
//   - every command that names a container (inspect / start / stop / restart / rm / logs / exec /
//     port / run --name) must name an allowed one, otherwise it is refused (exit 1, stderr
//     "T0743 shim guard: …") and never reaches docker;
//   - T0854 (PLAN-052 (c′)): every named volume (`volume inspect / create / rm`, `run -v <volume>:…`)
//     must be an allowed name, or BAT's own `bat-server-<allowed container>-bundle|-data`;
//     `run` without `--name` is allowed only with `--rm` (BAT's one-shot probe / version jobs);
//     `volume ls --format {{.Name}}` (scripts/docker-acceptance.mjs) only lists test volumes;
//   - subcommands other than the ones BAT uses are refused. `pull`, `image inspect` and
//     `version` touch no container or volume and are forwarded.
//
// Rewrites, logged per call:
//   - `run`: the image in T0743_SHIM_IMAGE_MAP (`from=to`) is replaced (the test's own image
//     instead of the user's `bat-server:latest`), `--label T0743_SHIM_LABEL` is added, and a
//     Windows host path in `-v C:\x:/y` becomes `/mnt/c/x` (what the WSL engine can mount);
//   - T0854: BAT's bundle install job name `bat-bundle-job-<hex>` (`run --name`, and the
//     `rm -f` after an aborted install) becomes `<T0743_SHIM_JOB_PREFIX><hex>`, so the job is a
//     test-named container too (without the variable such a name is refused);
//   - T0854: `inspect` output (without --format) reports a bind mount source `/mnt/<drive>/…` as
//     `/run/desktop/mnt/host/<drive>/…`, the way Docker Desktop on Windows does, so the wizard's
//     "Use existing" mount mapping (T0851) sees what it sees on a real Windows host.
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

// T0854: BAT's bundle install job (electron/docker-bundle-volume.ts installBundleIntoVolume).
var bundleJobName = regexp.MustCompile(`^bat-bundle-job-([0-9a-f]+)$`)

// T0854: BAT's own volumes of a container (batVolumeNames).
var batVolumeName = regexp.MustCompile(`^bat-server-(.+)-(bundle|data)$`)

// A container id as docker ps prints it (12) or in full (64).
var containerID = regexp.MustCompile(`^[0-9a-f]{12,64}$`)

// T0854: a bind mount source on the WSL engine, as `inspect` prints it.
var wslMountSource = regexp.MustCompile(`("Source":\s*")/mnt/([a-z])/`)

// Flags (per subcommand) that take a separate value argument.
var valueFlags = map[string]map[string]bool{
	"run": {"--name": true, "--restart": true, "-p": true, "-v": true, "--label": true, "-e": true, "--network": true, "--hostname": true, "-w": true, "-u": true, "--user": true, "--entrypoint": true,
		"--health-cmd": true, "--health-interval": true, "--health-timeout": true, "--health-start-period": true, "--health-retries": true},
	"inspect": {"--type": true, "--format": true, "-f": true},
	"volume":  {"--label": true, "--format": true, "-f": true},
	"image":   {"--format": true, "-f": true},
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
	filterInspect := false
	mapInspect := false
	filterVolumes := false
	jobPrefix := os.Getenv("T0743_SHIM_JOB_PREFIX")
	// renameJob maps BAT's bundle job name to the test's job prefix (T0854).
	renameJob := func(n string) string {
		if m := bundleJobName.FindStringSubmatch(n); m != nil && jobPrefix != "" {
			return jobPrefix + m[1]
		}
		return n
	}
	volumeAllowed := func(v string) bool {
		if allow.MatchString(v) {
			return true
		}
		m := batVolumeName.FindStringSubmatch(v)
		return m != nil && allow.MatchString(m[1])
	}

	switch sub {
	case "--version", "version", "info":
	case "pull":
		// Pulls an image; names no container or volume.
	case "image":
		if len(rest) == 0 || rest[0] != "inspect" {
			refuse(e, "image subcommand other than inspect is not used by BAT and not allowed")
		}
	case "volume":
		if len(rest) > 0 && rest[0] == "ls" {
			// Only scripts/docker-acceptance.mjs lists volumes (leftover check); the output is
			// filtered below to test volumes, one name per line (`--format {{.Name}}` required).
			if !strings.Contains(strings.Join(rest, " "), "--format {{.Name}}") {
				refuse(e, "volume ls is only allowed with --format {{.Name}}")
			}
			filterVolumes = true
			break
		}
		if len(rest) == 0 || (rest[0] != "inspect" && rest[0] != "create" && rest[0] != "rm") {
			refuse(e, "volume subcommand other than inspect / create / rm / ls is not used by BAT and not allowed")
		}
		names := positionals("volume", rest[1:])
		if len(names) == 0 {
			refuse(e, "volume "+rest[0]+" without a volume name")
		}
		for _, n := range names {
			if !volumeAllowed(n) {
				refuse(e, fmt.Sprintf("volume %s refused for volume %q (not a test volume)", rest[0], n))
			}
		}
	case "ps":
		filterPs = true
	case "inspect", "start", "stop", "restart", "rm", "logs", "port":
		names := positionals(sub, rest)
		if len(names) == 0 {
			refuse(e, sub+" without a container name")
		}
		if sub == "rm" {
			out := []string{"rm"}
			for _, a := range rest {
				out = append(out, renameJob(a))
			}
			forwarded = out
			names = positionals(sub, out[1:])
		}
		for _, n := range names {
			if sub == "inspect" && containerID.MatchString(n) && !allow.MatchString(n) {
				// T0851: listContainers inspects every container id `ps` returned; the output is
				// filtered below to the allowed containers. Only the plain (JSON) form can be filtered.
				for _, a := range rest {
					if a == "--format" || a == "-f" || strings.HasPrefix(a, "--format=") {
						refuse(e, "inspect of a container id with --format cannot be filtered")
					}
				}
				filterInspect = true
				continue
			}
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
		removeAfter := false
		for i := 0; i < len(rest); i++ {
			a := rest[i]
			if !imageDone && strings.HasPrefix(a, "-") {
				if flags[a] && i+1 < len(rest) {
					v := rest[i+1]
					if a == "--name" {
						v = renameJob(v)
						name = v
					}
					if a == "-v" {
						if m := winPathVolume.FindStringSubmatch(v); m != nil {
							v = "/mnt/" + strings.ToLower(m[1]) + strings.ReplaceAll(m[2], `\`, "/") + ":" + m[3]
						} else if src := strings.SplitN(v, ":", 2)[0]; !strings.HasPrefix(src, "/") && !volumeAllowed(src) {
							refuse(e, fmt.Sprintf("run refused for volume %q (not a test volume)", src))
						}
					}
					out = append(out, a, v)
					i++
					continue
				}
				if a == "--rm" {
					removeAfter = true
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
		// T0854: BAT's one-shot jobs (`run --rm`, probe / version) have no name and are removed
		// when they exit; everything else must be a test-named container.
		if name == "" && !removeAfter {
			refuse(e, "run refused: no --name and no --rm")
		}
		if name != "" && !allow.MatchString(name) {
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
	if sub == "inspect" {
		mapInspect = true
		for _, a := range rest {
			if a == "--format" || a == "-f" || strings.HasPrefix(a, "--format=") {
				mapInspect = false
			}
		}
	}
	if filterPs || filterInspect || filterVolumes || mapInspect {
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
	if filterVolumes {
		hidden := 0
		var kept []string
		for _, line := range strings.Split(stdout.String(), "\n") {
			n := strings.TrimSpace(line)
			if n == "" {
				continue
			}
			if volumeAllowed(n) {
				kept = append(kept, n)
			} else {
				hidden++
			}
		}
		if len(kept) > 0 {
			os.Stdout.WriteString(strings.Join(kept, "\n") + "\n")
		}
		e.PsHidden = hidden
	}
	if mapInspect {
		// T0851 / T0854: id lookups keep only the entries of allowed containers. Bind mount sources
		// are reported the way Docker Desktop on Windows does (`/run/desktop/mnt/host/<drive>/…`)
		// instead of the `/mnt/<drive>/…` this shim gave the WSL engine, so the wizard maps them back
		// to host paths (configure-mounts, T0851).
		out := stdout.Bytes()
		if filterInspect {
			var rows []map[string]any
			hidden := 0
			var kept []map[string]any
			if json.Unmarshal(out, &rows) == nil {
				for _, row := range rows {
					n, _ := row["Name"].(string)
					if allow.MatchString(strings.TrimPrefix(n, "/")) {
						kept = append(kept, row)
					} else {
						hidden++
					}
				}
			}
			if kept == nil {
				kept = []map[string]any{}
			}
			out, _ = json.Marshal(kept)
			out = append(out, '\n')
			e.PsHidden = hidden
		}
		os.Stdout.Write(wslMountSource.ReplaceAll(out, []byte("${1}/run/desktop/mnt/host/${2}/")))
	}
	e.Exit = code
	writeLog(e)
	os.Exit(code)
}
