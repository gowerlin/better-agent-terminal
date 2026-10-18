# WSL Deployment Guide

> Part of BAT remote dev support. For the cross-environment overview and
> decision tree, see [Remote Dev Overview](./remote-dev-overview.md).

This guide explains how to add a WSL-backed BAT profile from the Windows app,
what each wizard step does, how upgrade, cancel and removal work, and how to
verify the result before a release.

## Prerequisites

- BAT running on Windows, not inside WSL. The wizard refuses to run on other
  platforms (`wsl-not-on-windows`). There is no Windows version check.
- WSL2 with at least one WSL2 distro. WSL1 distros are filtered out of the
  distro list.
- Any distro whose name matches `^[A-Za-z0-9._-]+$`
  (`electron/wsl-validate.ts`). It does not have to be Ubuntu or Debian.
- **systemd enabled inside the distro. This is required**: the server runs as a
  systemd user service, and without it the wizard cannot read the server
  token, so it fails at **Save remote profile** and rolls back (see
  [systemd not enabled](#systemd-not-enabled)).
- `tar` and `sh` in the distro. The wizard does not check for them up front;
  a missing tool shows up as an extract failure.
- Network access to GitHub for the first setup of each BAT version, or a local
  tarball to import (see [Server bundle source](#server-bundle-source)).

Enable systemd in `/etc/wsl.conf` inside the distro:

```ini
[boot]
systemd=true
```

Then restart WSL from PowerShell:

```powershell
wsl --shutdown
```

No distro yet:

```powershell
wsl --install -d Ubuntu-24.04
```

Only a WSL1 distro:

```powershell
wsl --set-version <distro> 2
```

## Installation

Open the sidebar **Profiles** panel, click **+ More ▾**, and pick
**Add WSL Profile** under **Container**. The wizard runs nine steps. Each step
shows its progress; a failed step shows the reason with Retry / Skip / Cancel
(some errors offer a recovery button instead, listed under
[Troubleshooting](#troubleshooting)).

| # | Step id | Label | What it does |
|---|---------|-------|--------------|
| 1 | `detect-env` | Detect target environment | Checks that BAT runs on Windows and that `wsl.exe` can list distros. |
| 2 | `pick-wsl-distro` | Select WSL distro | Keeps WSL2 distros only. Picks automatically when exactly one exists; otherwise asks you to choose (defaulting to the WSL default distro when it is WSL2). This is the only choice in the wizard. |
| 3 | `wsl-systemd-check` | Check systemd availability | `systemctl --user is-system-running`, or `systemd=true` in `/etc/wsl.conf`. Without systemd it only records a warning; the wizard then fails at step 8. |
| 4 | `install-server-bundle` | Install BAT server bundle | Gets the server bundle for this BAT version and installs it into `~/.local/bat-server`. Also records the WSL networking mode (see below). |
| 5 | `write-systemd-unit` | Set up and start the server service | Picks a port, writes `~/.config/systemd/user/bat-server.service`, reloads the user daemon, starts the service, and enables linger (`loginctl enable-linger`, checked as `Linger=yes`). |
| 6 | `fetch-fingerprint` | Fetch TLS fingerprint | Opens a TLS connection to `127.0.0.1:<port>` and records the certificate's SHA-256 fingerprint from the handshake (up to 5 tries, 1 s apart). There is no HTTP endpoint. |
| 7 | `connect-test` | Verify remote connection | Connects with the token and the recorded fingerprint, as a saved profile would. |
| 8 | `write-profile` | Save remote profile | Creates the profile `WSL <distro>`, or updates the existing one (see [Upgrade](#upgrade)). |
| 9 | `done` | Finalize | Lists the warnings collected along the way. |

When the wizard finishes it shows the remote AI tools check (see
[Remote tools](./remote-dev-overview.md#remote-tools-nodejs-via-nvm-t0555)).

### Server bundle source

The installer does not include the server bundle. Step 4 resolves it in this
order (`electron/remote/server-bundle-distributor.ts`):

1. the local cache `%APPDATA%\BetterAgentTerminal\bat-server-bundles`, verified
   against its own `.sha256` sidecar (works offline);
2. a baseline shipped in the installer (only installers built before this
   change, or private forks that still ship one);
3. a download from the GitHub release `server-bundle-v<version>`.

If the download fails, the step shows **Could not download the BAT server
bundle** with an **Import local tarball…** button: pick
`bat-server-linux-x64-v<version>.tar.gz` (or `linux-arm64`) and its `.sha256`
file, copied from a machine that can reach GitHub. BAT checks the name, target,
version and SHA-256, puts the file in the cache and retries the step. For an
internal mirror, set `BAT_SERVER_BUNDLE_BASE_URL` before starting BAT. Details:
[Server bundle distribution](./server-bundle-distribution.md).

### Port

The port is picked on the Windows side from **9877–9976** on `127.0.0.1`,
skipping ports in use and the port of BAT's own remote server (its configured
port and the port it is listening on; `pickServerPort`,
`electron/wsl-systemd.ts`). On an upgrade the existing unit's
`BAT_SERVER_PORT` is kept: if the old server still holds it, the wizard stops
the service and checks again for up to 5 s. Only a port held by another program
makes the wizard pick a new one.

### Networking mode

Step 4 reads the actual mode with `wslinfo --networking-mode` and the declared
mode from `[wsl2] networkingMode` in `%UserProfile%\.wslconfig` (read only;
`detectNetworkMode`, `electron/wsl-detect.ts`). The modes are `mirrored`,
`nat`, `virtioproxy`, `none` and `unknown` (WSL older than 2.0.4 has no
`wslinfo`). `mirrored` and `unknown` produce no warning. `nat` produces a note
that nothing needs to change, or a Mirrored warning when `.wslconfig` asks for
mirrored but it is not in effect (pending `wsl --shutdown`, or a Windows build
before 22621). Other modes get an "unverified" warning.

Mirrored networking is optional. To use it, add this to
`%UserProfile%\.wslconfig`, run `wsl --shutdown`, and run the wizard again:

```ini
[wsl2]
networkingMode=mirrored
```

### Server data

The certificate and token live in `~/.local/share/bat-server` inside the
distro. Installing or upgrading the bundle never touches this directory, so the
fingerprint and token survive an upgrade.

## After setup

- Opening the profile opens a BAT window whose terminals, Agent panel, file
  tree and Git views run inside the distro.
- The folder dialog for a new workspace starts at the distro's `$HOME` as a
  UNC path (`\\wsl.localhost\<distro>\home\<user>`, falling back to
  `\\wsl$\…`; `electron/wsl-workspace-folder.ts`).
- **Keepalive**: WSL shuts a distro down about 15 s after its last `wsl.exe`
  connection closes, and since WSL 2.6.1 a running systemd user service does not
  count as activity. While BAT runs it keeps one hidden
  `wsl.exe -d <distro> -- sleep infinity` per distro that has a WSL profile
  (and for the distro of a running wizard), restarting it with backoff if it
  exits. Deleting the profile stops it. `.wslconfig` is never changed
  (`electron/wsl-keepalive.ts`).

## Upgrade

After upgrading BAT, run **Add WSL Profile** again for the same distro:

- The new bundle is extracted to `~/.local/bat-server.bat-new` and must contain
  an executable `bin/bat-server` before it is swapped in. The previous tree is
  kept at `~/.local/bat-server.bat-old` until the wizard finishes, then deleted
  (`electron/server-bundle-install-script.ts`). A failed download or extract
  leaves the old install untouched.
- Only a directory that is a BAT bundle install (or empty) is replaced.
  Anything else at that path is extracted over and nothing is deleted.
- If BAT was closed in the middle of a swap, the next run first moves a
  `.bat-old` without an install next to it back into place, and replaces a
  `.bat-old` next to an install. A `.bat-old` that is not a BAT install is never
  deleted; the wizard stops and asks you to move it away.
- The port, certificate and token are kept. A profile for the same distro and
  port (host `localhost` / `127.0.0.1`) is updated instead of creating a second
  one, and its name is kept. Only `targetOS`, `wslDistro`, `remoteHost`,
  `remotePort`, `remoteToken` and `remoteFingerprint` are written.

## Rollback chain

When a step fails without a retry, or you cancel, the wizard runner
(`src/components/setup-wizard/wizard-runner.ts`) rolls back the completed steps
in reverse order (best effort):

- **write-profile**: deletes a profile created by this run, or writes the
  previous values back into the profile it updated. The profile is written in
  this step, not at the end, so cancelling later still removes or restores it.
- **write-systemd-unit**: on an upgrade, writes the previous unit back
  (content and enabled state as read before the step, including before the port
  check stopped the old server) and starts it again if it was running; on a
  first setup, stops and disables the service, removes the unit file and
  reloads the user daemon. It also releases the wizard's keepalive pin.
- **install-server-bundle**: on an upgrade, moves `~/.local/bat-server.bat-old`
  back; on a first install, removes `~/.local/bat-server`; if the directory was
  not a BAT install, deletes nothing.
- **fetch-fingerprint** / **connect-test**: read-only, nothing to undo.

Cancelling an upgrade leaves the server as it was: same bundle, unit, port,
certificate and token, running if it was running. Linger stays enabled if the
wizard enabled it.

## Editing a WSL profile

The profile card shows the name, a **WSL** badge, `host:port` and the
connection status, with Open, Test connection, Edit connection (⚙), Duplicate,
rename and Delete buttons. Expanding the card shows the remote tools entry and
the WSL details: Distro, Service (`systemd (user)`), Server (`host:port`) and
Target.

There is no "re-run wizard" button: to repair or upgrade, run
**Add WSL Profile** again. To re-pin the fingerprint, use the pin button in the
**Edit connection** dialog (see
[Fingerprint mismatch](./remote-dev-overview.md#fingerprint-mismatch)).

## Uninstallation

Deleting the profile in BAT removes only the local profile (and its
keepalive). The service in the distro keeps running and starts again with the
distro. To remove everything, run inside the distro:

```bash
systemctl --user disable --now bat-server.service
rm -f ~/.config/systemd/user/bat-server.service
systemctl --user daemon-reload
rm -rf ~/.local/bat-server ~/.local/bat-server.bat-old ~/.local/bat-server.bat-new
rm -rf ~/.local/share/bat-server
# Only if nothing else needs linger (the wizard enabled it):
sudo loginctl disable-linger "$USER"
```

On Windows, the cached bundles stay in
`%APPDATA%\BetterAgentTerminal\bat-server-bundles` (shared with SSH setups);
delete the files you no longer need.

## Troubleshooting

### WSL2 not found / no distro

The wizard shows that WSL2 or a distro is missing. Install it, then click the
retry button on the error. Only WSL1 distros: convert one with
`wsl --set-version <distro> 2`.

### systemd not enabled

Step 3 only warns that systemd is off and mentions a manual `wsl exec` start
command, but that fallback cannot finish: without the service there is no
token, so step 8 fails ("Remote token missing …") and the wizard rolls back
(`steps/wsl/write-profile.ts`). The manual command is never offered. Enable systemd (see
[Prerequisites](#prerequisites)), run `wsl --shutdown`, and run the wizard
again.

### Could not enable systemd lingering automatically

Some distros need root. Run `sudo loginctl enable-linger $USER` in the distro
and click **I've run the command, retry**. Skipping the step leaves the
service stopped, so the fingerprint step then fails.

### Service did not start / port in use

```bash
systemctl --user status bat-server.service
journalctl --user -u bat-server -n 50
```

Fix the cause and retry. A port held by another program makes the retry pick
another port. "No free port between 9877 and 9976 on Windows (127.0.0.1) for
the WSL server." means the whole range is taken.

### NAT warning

NAT works for the usual setup; act only if the connection test fails. If
`.wslconfig` asks for mirrored but it is not in effect, run `wsl --shutdown`
and run the wizard again.

### Permission denied under `~/.local`

Check ownership and permissions of `~/.local` in the distro, then retry the
install step.

### Fingerprint fetch failed

Confirm that `bat-server.service` is active and listening on the picked port.

### Server bundle download failed

Use **Import local tarball…** or `BAT_SERVER_BUNDLE_BASE_URL` (see
[Server bundle source](#server-bundle-source)).

## Real WSL Pre-Flight Checklist

Manual release check on a real Windows + WSL machine (CI does not provide WSL2
or systemd):

- `wsl -l -v` shows the target distro as version `2`.
- systemd is enabled in the distro.
- The wizard completes all nine steps without rollback, starting with an empty
  bundle cache (download path) and once with **Import local tarball…**.
- `systemctl --user status bat-server.service` is active; its
  `BAT_SERVER_PORT` is in 9877–9976 and differs from BAT's own remote server
  port.
- The profile has `targetOS: wsl-linux` and the right `wslDistro`.
- Reconnecting from the saved profile works after restarting BAT, and the
  distro stays up while BAT runs (keepalive).
- Running the wizard again on the same distro updates the same profile, keeps
  the port, and deletes `~/.local/bat-server.bat-old` at the end; cancelling it
  midway leaves the previous server running.

## Notes

- The automated tests use mocked IPC; real WSL validation remains a human
  release gate.
- Docker and SSH are separate flows: [Docker](./docker-deployment.md),
  [SSH](./ssh-deployment.md).
