# WSL Deployment Guide

This guide explains how to add a WSL-backed BAT profile from the Windows app, what the wizard does, and how to verify the result before release.

## Prerequisites

- Windows 11 22H2 or newer.
- Windows 11 23H2 or newer is recommended for mirrored networking.
- WSL2 installed and working.
- An Ubuntu or Debian distro installed in WSL.
- `systemd` enabled inside the target distro.
- BAT running on Windows, not inside WSL.
- A BAT Linux server bundle already present in `userData/bat-server-bundles`.

Enable `systemd` in the distro before running the wizard:

```ini
[boot]
systemd=true
```

After updating `/etc/wsl.conf`, restart WSL:

```powershell
wsl --shutdown
```

If you do not yet have a distro, install one first:

```powershell
wsl --install -d Ubuntu
```

If BAT reports a WSL1 distro, convert it before continuing:

```powershell
wsl --set-version <distro> 2
```

## Installation

Open BAT on Windows and go to `Profiles`.

Use the new `Add WSL Profile` entry in the profile panel. The wizard runs nine steps in order:

### 1. Detect Windows + WSL environment

BAT verifies that the renderer is running on Windows and that `wsl.exe` is available.

### 2. Select WSL distro

BAT lists installed WSL distros and chooses the default WSL2 distro automatically when there is only one option.

### 3. Check systemd availability

BAT checks whether `systemctl --user` is available. If `systemd` is missing, the wizard shows a warning and prepares a manual fallback command.

### 4. Install BAT server bundle

BAT finds the Linux bundle tarball under the app data directory and extracts it into:

```text
~/.local/bat-server
```

During this step BAT also performs a best-effort WSL networking check and records one of these modes:

- `mirrored`
- `nat`
- `unknown`

### 5. Write BAT systemd user service

BAT writes a user unit for `bat-server.service`, reloads the user daemon, and starts the service. When possible it also enables linger.

### 6. Fetch TLS fingerprint

BAT calls the local HTTPS fingerprint endpoint exposed by the WSL service and stores the observed TLS fingerprint.

### 7. Verify remote connection

BAT performs a remote auth handshake against the local forwarded endpoint. In NAT mode BAT warns that `localhost` may not be the final address you keep using.

### 8. Create remote profile

BAT creates a local profile entry, then persists the WSL metadata:

- `targetOS: wsl-linux`
- `wslDistro`
- `remoteHost`
- `remotePort`
- `remoteToken`
- `remoteFingerprint`

### 9. Finalize WSL setup

BAT surfaces any warnings collected during the previous steps and marks the wizard complete.

## Mirrored Mode Setup

Mirrored networking gives the cleanest localhost-based developer experience. Add this to `%UserProfile%\.wslconfig`:

```ini
[wsl2]
networkingMode=mirrored
```

Then restart WSL:

```powershell
wsl --shutdown
```

Start the distro again and rerun the wizard if you want BAT to refresh the connection metadata.

## Troubleshooting

### WSL1 detected

BAT supports WSL2 only. Upgrade the distro:

```powershell
wsl --set-version <distro> 2
```

### systemd not enabled

BAT can fall back to a manual `wsl exec` launch, but the connection will end when BAT exits. Enable `systemd` and rerun the wizard for the supported flow.

### NAT mode detected

BAT will continue, but you may need to switch to mirrored mode or replace `localhost` with the active WSL IP if connection checks fail after startup.

### Permission denied under `~/.local`

Check the ownership and permissions of `~/.local` inside the distro, then rerun the install step.

### Fingerprint fetch failed

Confirm that the BAT service started successfully inside WSL and that the local HTTPS endpoint is reachable.

### Profile created but connect-test failed

Delete the profile, verify the service is active, and rerun the wizard. The rollback chain should remove partial install artifacts automatically when the failure occurs during the wizard run.

## Uninstallation

Current rollback support is designed for wizard failures, but the intended manual removal flow is:

1. Delete the BAT WSL profile from `Profiles`.
2. Remove the user service unit from WSL.
3. Stop the service.
4. Delete the install directory.
5. Remove any remaining BAT server data under the user data directory.

Typical WSL cleanup commands:

```bash
systemctl --user disable --now bat-server.service
rm -f ~/.config/systemd/user/bat-server.service
systemctl --user daemon-reload
rm -rf ~/.local/bat-server
rm -rf ~/.local/share/bat-server
```

## Real WSL Pre-Flight Checklist

This checklist is for release verification on a real Windows + WSL machine. It is intentionally manual because CI does not guarantee WSL2, mirrored networking, or `systemd`.

- Confirm `wsl -l -v` shows the target distro as version `2`.
- Confirm `/etc/wsl.conf` contains `[boot]` and `systemd=true`.
- Confirm `%UserProfile%\.wslconfig` uses `networkingMode=mirrored` when mirrored coverage is required.
- Confirm the BAT bundle tarball exists under the Windows app data bundle directory.
- Confirm the wizard completes all nine steps without rollback.
- Confirm `bat-server.service` is active through `systemctl --user status bat-server.service`.
- Confirm BAT stores a profile with `targetOS: wsl-linux` and the correct `wslDistro`.
- Confirm reconnecting from the saved profile succeeds after restarting the BAT window.

## Notes

- The automated tests for this feature use mocked IPC and a mocked HTTPS fingerprint endpoint.
- Real WSL validation remains a human release gate.
- Docker and SSH setup flows are intentionally separate from this WSL guide.
