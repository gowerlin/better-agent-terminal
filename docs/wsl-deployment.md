# WSL Deployment Guide

> Part of BAT remote dev support. For the cross-environment overview and
> decision tree, see [Remote Dev Overview](./remote-dev-overview.md).

This guide explains how to add a WSL-backed BAT profile from the Windows app,
what each wizard step does, how upgrade, cancel and removal work, and how to
verify the result before a release.

## Prerequisites

- BAT running on Windows, not inside WSL. The wizard refuses to run on other
  platforms (`wsl-not-on-windows`). There is no Windows version check.
- WSL2 with at least one distro. When WSL2 distros exist only those are
  listed; when there are only WSL1 distros the wizard offers to convert the
  chosen one (see [Environment check and fixes](#environment-check-and-fixes)).
- Any distro whose name matches `^[A-Za-z0-9._-]+$`
  (`electron/wsl-validate.ts`). It does not have to be Ubuntu or Debian.
- **systemd running inside the distro. This is required**: the server runs as a
  systemd user service. The wizard offers to turn it on (see
  [Environment check and fixes](#environment-check-and-fixes)); without it the
  wizard stops at **Check systemd availability** (see
  [systemd not enabled](#systemd-not-enabled)).
- `tar` and `sh` in the distro. The wizard does not check for them up front;
  a missing tool shows up as an extract failure.
- Network access to GitHub for the first setup of each BAT version, or a local
  tarball to import (see [Server bundle source](#server-bundle-source)).

To enable systemd yourself instead, set it in `/etc/wsl.conf` inside the distro:

```ini
[boot]
systemd=true
```

Then restart the distro from PowerShell (T0840 measured on WSL 2.7.14 that
`--terminate` is enough; `wsl --shutdown` also works but stops every distro):

```powershell
wsl --terminate <distro>
```

No distro yet:

```powershell
wsl --install -d Ubuntu-24.04
```

Only a WSL1 distro (the wizard can also do this for you):

```powershell
wsl --set-version <distro> 2
```

## Installation

Open the sidebar **Profiles** panel, click **+ More ▾**, and pick
**Add WSL Profile** under **Container**. The wizard runs eleven steps. Each step
shows its progress; a failed step shows the reason with Retry / Skip / Cancel
(some errors offer a recovery button instead, listed under
[Troubleshooting](#troubleshooting)).

| # | Step id | Label | What it does |
|---|---------|-------|--------------|
| 1 | `detect-env` | Detect target environment | Checks that BAT runs on Windows and that `wsl.exe` can list distros. |
| 2 | `pick-wsl-distro` | Select WSL distro | Lists WSL2 distros (only when there are none, the WSL1 ones). Picks automatically when exactly one exists; otherwise asks you to choose (defaulting to the WSL default distro when it is listed). |
| 3 | `plan-wsl-environment` | Check the WSL environment | Collects the WSL facts (version, distros, systemd, default user, policy; may start a stopped distro, a few seconds) and, only when something needs fixing, shows the checklist once (see [Environment check and fixes](#environment-check-and-fixes)). A healthy environment shows nothing. |
| 4 | `apply-wsl-environment` | Apply WSL environment fixes | Applies what you approved. Nothing to do on a healthy environment. |
| 5 | `wsl-systemd-check` | Check systemd availability | Verifies that systemd is PID 1 in the distro (`/proc/1/comm`). Fails with *systemd is not running* otherwise (T0840; it used to warn and fail at **Save remote profile**). |
| 6 | `install-server-bundle` | Install BAT server bundle | Gets the server bundle for this BAT version and installs it into `~/.local/bat-server`. Also records the WSL networking mode (see below). |
| 7 | `write-systemd-unit` | Set up and start the server service | Picks a port, writes `~/.config/systemd/user/bat-server.service`, reloads the user daemon, starts the service, and enables linger (`loginctl enable-linger`, checked as `Linger=yes`). |
| 8 | `fetch-fingerprint` | Fetch TLS fingerprint | Opens a TLS connection to `127.0.0.1:<port>` and records the certificate's SHA-256 fingerprint from the handshake (up to 5 tries, 1 s apart). There is no HTTP endpoint. |
| 9 | `connect-test` | Verify remote connection | Connects with the token and the recorded fingerprint, as a saved profile would. |
| 10 | `write-profile` | Save remote profile | Creates the profile `WSL <distro>`, or updates the existing one (see [Upgrade](#upgrade)). |
| 11 | `done` | Finalize | Lists the warnings collected along the way, and the environment changes made (see below). |

When the wizard finishes it shows the remote AI tools check (see
[Remote tools](./remote-dev-overview.md#remote-tools-nodejs-via-nvm-t0555)).

### Environment check and fixes

PLAN-043 W3 (T0840): *detect → list → consent once → apply*. The facts come
from `wsl:detect-facts` (`electron/wsl-facts.ts`, read-only); what is needed is
decided only by `buildWslEnvPlan` (`src/components/setup-wizard/wsl-env-plan.ts`);
the fixes are applied by `electron/wsl-env-apply.ts`.

| Item | When it is listed | What BAT does | Scope / side effects | Default |
|------|-------------------|---------------|----------------------|---------|
| Convert to WSL 2 | The chosen distro is WSL1 (only when no WSL2 distro exists) | `wsl --set-version <distro> 2`, then checks `wsl -l -v` | This distro; the distro stops while it converts; can take long and **cannot be stopped midway** (the wizard shows so and waits) | Required, unchecked |
| Turn on systemd | systemd is not PID 1 (WSL2) / not declared (WSL1) | Reads `/etc/wsl.conf` as root, changes only `[boot] systemd=true` (other lines, comments and encoding kept), copies the old file to `/etc/wsl.conf.bat-backup-<YYYYMMDD-HHMMSS>` first, writes the new content over stdin, reads it back, then `wsl --terminate <distro>` and waits for systemd to be PID 1 | This distro; every program in it ends (WSL shells in other BAT tabs too; the keep-alive restarts by itself) | Required, checked |
| Keep the server running after logout (linger) | Listed only when the checklist is shown anyway | Nothing new: step 7 enables it as before | This user | Automatic (no checkbox) |

- A healthy environment (the usual case) gives **no items**: no checklist, and
  steps 3 and 4 finish at once.
- Shown as warnings only, no item: default user is root, WSL older than 2.0.4.
  WSL turned off by policy (`AllowWSL=0`) stops the wizard.
- When the checklist has an item that stops the distro, a line above the
  confirm button lists the distros running now.
- A required item left unchecked stops at step 3 with an explanation
  (**Choose again** / **Cancel**); leaving *Convert to WSL 2* unchecked gives
  the same *WSL2 is required* error as before. An item BAT cannot apply (for
  example an `/etc/wsl.conf` it cannot parse) cannot be checked and says why.
- A failed fix offers **Retry**, **Skip (the connection may fail)** and
  **Cancel**. Each fix checks again first (already fine → nothing is changed)
  and is judged by the real state afterwards, not by exit codes.
- **Nothing is undone** when you cancel later (D272): the done and cancel
  screens list *WSL environment changes* with the backup location. To undo
  systemd, copy the backup back over `/etc/wsl.conf` and run
  `wsl --terminate <distro>`; to undo the conversion, `wsl --set-version <distro> 1`.
- Networking mode is not in this list: it is only suggested when the
  connection test fails (see [Networking mode](#networking-mode)).

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
  (`electron/wsl-keepalive.ts`). It also ends when BAT is force-closed
  (Task Manager, a crash, the installer): Windows ends the holder together with
  BAT's main process, so no `wsl.exe` keeps the distro running afterwards.
- **Turning keepalive off for a profile** (T0830): expand the profile card and
  clear **Keep WSL running (keep-alive)** in the WSL details. It is on by
  default, and profiles saved before this setting existed count as on. The
  change applies at once (the holder stops or starts). With it off, WSL may
  shut the distro down when it is idle and the next connection takes longer
  while the distro and the server start again. When several WSL profiles use
  the same distro, the distro is held while **any** of them has keepalive on.
  A running setup wizard still holds its distro until it finishes or is
  cancelled. The setting is the profile's `wslKeepAlive` field (`false` = off;
  missing = on), read only by `keepAliveProfileDistros`.

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
- **apply-wsl-environment** / **plan-wsl-environment**: only forget what was
  approved. The environment fixes themselves are kept (see
  [Environment check and fixes](#environment-check-and-fixes)).

Cancelling an upgrade leaves the server as it was: same bundle, unit, port,
certificate and token, running if it was running. Linger stays enabled if the
wizard enabled it.

### Stopping a running step

While a step runs (or waits for your choice) the wizard shows **Stop setup**
(T0830). Clicking it, or closing the wizard window, aborts that step:

1. The step's abort signal fires. Steps that start a long child process in
   BAT's main process pass it on (`wizard:abort-operation`):
   - **install-server-bundle**, download: the download is cancelled.
   - **install-server-bundle**, install: only the `tar` the install script is
     running in the distro is stopped (`pkill -x -P <script> tar`, the script
     found by a per-install marker). The script then removes
     `~/.local/bat-server.bat-new` and exits as for a failed extract, so the
     existing install is untouched. `wsl.exe` itself is not killed, so the
     script is never cut off between its two renames; if the extract was
     already over, the install completes and step 3 undoes it.
   - **write-systemd-unit**, service start: the running `wsl.exe` call is
     killed and the start check stops at once (`wsl-service-start-aborted`).
   - **plan-wsl-environment**: the environment probe is killed; an open
     checklist is withdrawn.
   - **apply-wsl-environment**: reads, writes and `wsl --terminate` are
     killed. `wsl --set-version` cannot be: the conversion runs in the WSL
     service, so the step says it stops once the conversion finishes and waits.
   - A pending choice is withdrawn.
2. The button shows **Stopping…** until the step has really ended. Steps whose
   calls cannot be interrupted (for example the 5 s fingerprint fetch) are
   waited for. After 15 s the wizard says the step is still finishing; it keeps
   waiting and never rolls back over a step that is still running, because the
   rollback could race with what the step's process is still writing.
3. The aborted step is rolled back (it may have got halfway), then the
   completed steps in reverse order, as for **Cancel** on a failure screen. The
   wizard then shows *Setup was cancelled*. The aborted step has no Retry / Skip.

If the stop helper cannot run (for example `pgrep` / `pkill` missing in the
distro), the install runs to its end and is then rolled back; the wait is
longer but the result is the same. SSH and Docker wizards use the same runner:
**Stop setup** aborts their prompts and rolls back the same way, but their
main-process calls are not interrupted (they are waited for).

## Editing a WSL profile

The profile card shows the name, a **WSL** badge, `host:port` and the
connection status, with Open, Test connection, Edit connection (⚙), Duplicate,
rename and Delete buttons. Expanding the card shows the remote tools entry and
the WSL details: Distro, Service (`systemd (user)`), Server (`host:port`),
Target and the keepalive switch (see [After setup](#after-setup)).

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
retry button on the error. Only WSL1 distros: approve *Convert to WSL 2* in the
checklist, or convert one yourself with `wsl --set-version <distro> 2`.

### systemd not enabled

The checklist offers *Turn on systemd*. If that fix was skipped or failed,
step 5 stops with *systemd is not running* (T0840; before, it only warned and
the wizard failed at **Save remote profile** because the fallback start has no
token). Enable systemd yourself (see [Prerequisites](#prerequisites)), run
`wsl --terminate <distro>`, and click **Already fixed, retry**.

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
- The wizard completes all eleven steps without rollback, starting with an empty
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
- **Stop setup** during the bundle install and during the service start ends
  within a few seconds and leaves no `~/.local/bat-server.bat-new` (T0830).
- On a healthy distro no checklist appears (T0840). On a disposable distro
  (`wsl --import BAT-T-<n> <dir> <rootfs> --version 1`, never your own distro)
  the checklist offers the WSL 2 conversion and systemd, the fixes apply, the
  backup `/etc/wsl.conf.bat-backup-*` exists, and the done screen lists them;
  remove it afterwards with `wsl --unregister BAT-T-<n>`.
- Turning keepalive off on the profile stops the holder `wsl.exe`; the distro
  shuts down after WSL's idle timeout, and the next connection starts it again.

## Notes

- The automated tests use mocked IPC; real WSL validation remains a human
  release gate.
- Docker and SSH are separate flows: [Docker](./docker-deployment.md),
  [SSH](./ssh-deployment.md).
