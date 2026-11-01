// T0763 — test-only `ssh.exe` for e2e/t0763-remote-waiting-acceptance.spec.ts (Windows only).
//
// BAT runs `ssh` from the main process PATH (electron/remote/ssh-tunnel.ts and the other ssh call
// sites). Its argv always carries `-o StrictHostKeyChecking=accept-new`, and Windows OpenSSH reads
// and writes the REAL `%USERPROFILE%\.ssh` whatever USERPROFILE / HOME say (see e2e/pre5-ssh-alias),
// so connecting to the test's temporary sshd would add its host key to the user's known_hosts.
// The spec builds this file into a temp directory and prepends it to the isolated instance's PATH
// only. Each call runs the real ssh with
//
//	-F none -o UserKnownHostsFile=<T0763_SSH_KNOWN_HOSTS> -o IdentitiesOnly=yes <BAT's argv unchanged>
//
// ssh keeps the first value it reads for an option, so these win over anything later; `-F none`
// skips ~/.ssh/config and the system config, IdentitiesOnly keeps the user's agent keys out (only
// the profile's `-i` test key is offered). Nothing under ~/.ssh is read for the host key or written.
//
// The shim and the real ssh share a job object with KILL_ON_JOB_CLOSE: BAT stops a tunnel by
// killing the process it spawned (TerminateProcess on Windows), which would otherwise leave the
// real ssh.exe running with its -L port.
//
// Every call is appended to T0763_SSH_LOG as one JSON line (argv, exit code, times).
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"time"
	"unsafe"
)

type entry struct {
	At    string   `json:"at"`
	Args  []string `json:"args"`
	Pid   int      `json:"pid,omitempty"`
	Exit  int      `json:"exit"`
	End   string   `json:"end,omitempty"`
	Error string   `json:"error,omitempty"`
}

func appendLog(e entry) {
	path := os.Getenv("T0763_SSH_LOG")
	if path == "" {
		return
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer f.Close()
	line, _ := json.Marshal(e)
	f.Write(append(line, '\n'))
}

// JOBOBJECT_EXTENDED_LIMIT_INFORMATION (amd64 layout).
type basicLimit struct {
	PerProcessUserTimeLimit int64
	PerJobUserTimeLimit     int64
	LimitFlags              uint32
	MinimumWorkingSetSize   uintptr
	MaximumWorkingSetSize   uintptr
	ActiveProcessLimit      uint32
	Affinity                uintptr
	PriorityClass           uint32
	SchedulingClass         uint32
}

type ioCounters struct {
	ReadOperationCount, WriteOperationCount, OtherOperationCount uint64
	ReadTransferCount, WriteTransferCount, OtherTransferCount    uint64
}

type extendedLimit struct {
	Basic                 basicLimit
	Io                    ioCounters
	ProcessMemoryLimit    uintptr
	JobMemoryLimit        uintptr
	PeakProcessMemoryUsed uintptr
	PeakJobMemoryUsed     uintptr
}

const (
	jobObjectExtendedLimitInformation = 9
	jobObjectLimitKillOnJobClose      = 0x2000
)

// joinKillOnCloseJob puts this process (and so every child it starts) into a job that is killed
// when its last handle closes — the shim's own, when the shim exits or is terminated.
func joinKillOnCloseJob() error {
	k32 := syscall.NewLazyDLL("kernel32.dll")
	job, _, err := k32.NewProc("CreateJobObjectW").Call(0, 0)
	if job == 0 {
		return fmt.Errorf("CreateJobObjectW: %v", err)
	}
	info := extendedLimit{}
	info.Basic.LimitFlags = jobObjectLimitKillOnJobClose
	ok, _, err := k32.NewProc("SetInformationJobObject").Call(job, jobObjectExtendedLimitInformation, uintptr(unsafe.Pointer(&info)), unsafe.Sizeof(info))
	if ok == 0 {
		return fmt.Errorf("SetInformationJobObject: %v", err)
	}
	self, _, _ := k32.NewProc("GetCurrentProcess").Call()
	ok, _, err = k32.NewProc("AssignProcessToJobObject").Call(job, self)
	if ok == 0 {
		return fmt.Errorf("AssignProcessToJobObject: %v", err)
	}
	return nil
}

func main() {
	args := os.Args[1:]
	e := entry{At: time.Now().Format(time.RFC3339Nano), Args: args}
	real := os.Getenv("T0763_SSH_REAL")
	known := os.Getenv("T0763_SSH_KNOWN_HOSTS")
	if real == "" || known == "" {
		e.Exit, e.Error = 255, "T0763_SSH_REAL / T0763_SSH_KNOWN_HOSTS not set"
		appendLog(e)
		fmt.Fprintln(os.Stderr, "T0763 ssh shim: "+e.Error)
		os.Exit(255)
	}
	if err := joinKillOnCloseJob(); err != nil {
		e.Exit, e.Error = 255, err.Error()
		appendLog(e)
		fmt.Fprintln(os.Stderr, "T0763 ssh shim: "+e.Error)
		os.Exit(255)
	}
	cmd := exec.Command(real, append([]string{"-F", "none", "-o", "UserKnownHostsFile=" + known, "-o", "IdentitiesOnly=yes"}, args...)...)
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	if err := cmd.Start(); err != nil {
		e.Exit, e.Error = 255, err.Error()
		appendLog(e)
		fmt.Fprintln(os.Stderr, "T0763 ssh shim: "+e.Error)
		os.Exit(255)
	}
	e.Pid = cmd.Process.Pid
	appendLog(entry{At: e.At, Args: args, Pid: e.Pid, Exit: -1})
	err := cmd.Wait()
	e.End = time.Now().Format(time.RFC3339Nano)
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			e.Exit = ee.ExitCode()
		} else {
			e.Exit, e.Error = 255, err.Error()
		}
	}
	appendLog(e)
	os.Exit(e.Exit)
}
