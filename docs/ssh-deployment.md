# SSH Deployment Guide

> Connect BAT to a Linux or macOS development server over SSH. BAT installs
> the server over SSH and always connects through an SSH tunnel, so the host
> needs no extra open port.
>
> Part of BAT remote dev support. For the cross-environment overview and
> decision tree, see [Remote Dev Overview](./remote-dev-overview.md).

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| `ssh` on the BAT machine | Found with `where ssh` / `which ssh` (`no-ssh` otherwise). Windows' built-in OpenSSH client is fine. There is no version check; `StrictHostKeyChecking=accept-new` needs OpenSSH 7.6 or newer. |
| **Key-based login** | Every ssh call uses `BatchMode=yes` (`buildBaseSshArgs`, `electron/remote/ssh-args.ts`), so **password login is not possible**. Use a key or ssh-agent; load passphrase-protected keys into the agent first. Check with `ssh you@dev-server` that no password prompt appears. |
| Host OS / CPU | Linux x64 (`x86_64` / `amd64`), Linux arm64 (`aarch64` / `arm64`) or Apple Silicon macOS (`normalizeArch`, `src/lib/arch-normalize.ts`). Intel Macs are not supported: the install step fails with `[arch-detection-failed]`. |
| Port forwarding allowed | The connection runs through `ssh -L`; `AllowTcpForwarding` must not be off. |
| Host tools | Commands run under `sh`. Linux: `systemctl --user`, `loginctl`, `tar`, `awk`, `grep`, `cut`, `/proc`. macOS: `launchctl`, `tar`, `awk`, `lsof`. |
| GitHub access from the BAT machine | For the first setup of each BAT version, or a local tarball to import (see [Server bundle source](#server-bundle-source)). |

### `~/.ssh/config` (recommended)

The wizard asks only for the host. Anything else (key file, user, non-default
port, jump host) comes from your `~/.ssh/config`, which BAT passes through to
OpenSSH:

```ssh-config
Host dev-server
    HostName 192.0.2.10
    User you
    IdentityFile ~/.ssh/id_ed25519
    ProxyJump jump-host
    ServerAliveInterval 30
```

The alias list in the wizard comes from the `Host` lines of `~/.ssh/config`
itself (`listSshHosts`, `electron/remote/ssh-config-parser.ts`): `Include`d
files are not read, and patterns (`*`, `?`, `!`) and `Match` blocks are not
listed. A typed host still gets every setting ssh matches for it in the
config, but there is no separate jump host or key field in BAT.

## Installation

Open the sidebar **Profiles** panel, click **+ More ▾**, and pick
**Add SSH Profile** under **Remote**. The wizard runs eight steps:

| # | Step id | Label | What it does |
|---|---------|-------|--------------|
| 1 | `configure-ssh-host` | Configure SSH host | Pick an alias from `~/.ssh/config`, or **Enter host manually…** (`host`, `user@host`, `host:port`, `user@host:port`; IPv6 is rejected). This is the only input in the wizard. The install path is always `~/.local/bat-server`. |
| 2 | `verify-ssh-auth` | Verify SSH authentication | Runs `echo BAT_AUTH_OK; uname -sm; echo HOME=$HOME` (15 s). Sets `targetOS` (`ssh-linux` / `ssh-darwin`), the server arch and `$HOME`. A new host key is accepted automatically (`accept-new`). |
| 3 | `install-server-bundle` | Install BAT server bundle (SSH) | Resolves the bundle for the host's arch and pipes it through one ssh command into `tar xz` (no scp / rsync). Only the overall wizard progress is shown, no transfer speed. |
| 4 | `start-server` | Start bat-server (SSH) | Writes the user service and starts it (see [systemd vs launchd](#systemd-vs-launchd)); the server listens on `localhost:9876` on the host only. Waits up to 20 s for the listener. |
| 5 | `fetch-fingerprint` | Fetch TLS fingerprint | Opens a verify tunnel and records the certificate fingerprint from the TLS handshake. |
| 6 | `connect-test` | Verify remote connection | Connects through the tunnel with the token and the recorded fingerprint. |
| 7 | `write-profile` | Save remote profile | Creates the profile `SSH <host>`, or updates the existing one (see [Upgrade](#upgrade)). |
| 8 | `done` | Finalize | Lists the warnings. |

When the wizard finishes it shows the remote AI tools check (see
[Remote tools](./remote-dev-overview.md#remote-tools-nodejs-via-nvm-t0555)).

### Server bundle source

Same as WSL: local cache (`bat-server-bundles` in the BAT user data
directory, verified against its `.sha256` sidecar) → a baseline in older
installers → download of `server-bundle-v<version>` from GitHub. On a failed
download use **Import local tarball…** (`bat-server-linux-x64-v<version>.tar.gz`,
`linux-arm64` or `darwin-arm64`, plus its `.sha256`), or set
`BAT_SERVER_BUNDLE_BASE_URL` before starting BAT. See
[Server bundle distribution](./server-bundle-distribution.md).

## Tunnel only

BAT has one transport. Each connection runs
`ssh -N -L <local>:localhost:9876 …` with `ServerAliveInterval=30`,
`ServerAliveCountMax=3` and `ExitOnForwardFailure=yes`
(`electron/remote/ssh-tunnel.ts`). The local port is picked by the OS; if ssh
cannot bind it, BAT retries once on a new port. The server binds `localhost`
on the host (`--bind-interface localhost`), so nothing is exposed on the host's
network. A legacy profile with a "direct" mode is treated as tunnel
(`normalizeSshTunnelMode`).

The profile schema has a `tunnelLocalPort` field for a fixed local port (two
profiles with the same value get a warning), but the wizard never sets it and
no dialog edits it.

## systemd vs launchd

Both are user-level services, so the happy path needs no sudo:

| Concern | Linux (systemd) | macOS (launchd) |
|---------|-----------------|-----------------|
| Unit | `~/.config/systemd/user/bat-server.service` | `~/Library/LaunchAgents/com.bat-server.plist` |
| Command | `<installRoot>/bin/bat-server --port 9876 --bind-interface localhost` | same |
| Activation | `loginctl enable-linger <user>`, `systemctl --user daemon-reload`, `enable bat-server`, `restart bat-server` (every run) | `launchctl unload …; launchctl load -w …` |
| Restart policy | `Restart=on-failure`, `RestartSec=5s` | `KeepAlive` = `Crashed=true`, `SuccessfulExit=false` |
| After host reboot | starts without a login (linger) | `RunAtLoad=true`: starts when that user logs in |
| Status | `systemctl --user status bat-server` | `launchctl list \| grep com.bat-server` |
| Logs | `journalctl --user -u bat-server -n 50` | none: the plist sets no `StandardOutPath` / `StandardErrorPath` |
| Server data | `~/.local/share/bat-server` | `~/Library/Application Support/bat-server` |

## After setup

- Opening the profile opens a BAT window whose terminals, Agent panel, file
  tree and Git views run on the host.
- Files on the BAT machine cannot be attached in an SSH window (Agent
  attachments and terminal drag-drop): `resolveClientPaths`
  (`electron/remote/path-translator.ts`) refuses them as `ssh-local-file`, and
  the window shows "Not on the remote host, not attached: …". Put the files on
  the host.

## Upgrade

After upgrading BAT, run **Add SSH Profile** again for the same host:

- The new bundle is extracted to `~/.local/bat-server.bat-new` and must contain
  `bin/bat-server`; the old tree moves to `~/.local/bat-server.bat-old` and
  stays until the wizard finishes (`electron/server-bundle-install-script.ts`).
- Before overwriting the unit / plist, the wizard copies it once per run to
  `bat-server.service.bat-prev` / `com.bat-server.plist.bat-prev` and records
  whether the service was active and enabled.
- When every step succeeds, `.bat-old` and `.bat-prev` are deleted.
- A profile with the same SSH host, user, SSH port and server port (loopback
  `remoteHost`) is updated instead of creating a second one; its name is kept.
- A directory at the install path that is not a BAT install is extracted over
  and never deleted.

## Rollback chain

When a step fails without a retry, or you cancel, the runner
(`src/components/setup-wizard/wizard-runner.ts`) rolls back the completed steps
in reverse order (best effort):

- **write-profile**: deletes a profile created by this run, or restores the
  fields it overwrote. The profile is written in step 7, not at the end.
- **fetch-fingerprint** / **connect-test**: close the verify tunnel.
- **start-server**: with a previous unit / plist, moves the `.bat-prev` copy
  back with its old enabled state and starts it if it was active; otherwise
  Linux runs `systemctl --user disable --now`, removes the unit,
  `daemon-reload` and `reset-failed`, and macOS unloads and deletes the plist.
  Linger is left as it is.
- **install-server-bundle**: on an upgrade, moves `.bat-old` back (and restarts
  the previous service when start-server asks for it); on a first install,
  removes `~/.local/bat-server`; a non-BAT directory is left alone.
- **configure-ssh-host** / **verify-ssh-auth**: read-only.

Cancelling an upgrade leaves the server as it was before the wizard.

## Editing an SSH profile

The profile card shows the name, an **SSH (Linux)** / **SSH (macOS)** badge
and the connection status, with Open, Test connection, Edit connection (⚙),
Duplicate, rename and Delete buttons. The expanded details show Host
(`user@host:port`, or a note that user / port come from `~/.ssh/config`),
Service (`systemd (user)` / `launchd`), Connection, Key (when set) and Target.

- There is no "re-run wizard" button and no transport switch: to repair or
  upgrade, run **Add SSH Profile** again.
- **Edit connection** edits host, port, token, fingerprint and target profile,
  not SSH settings. To re-pin the fingerprint use the pin button there (see
  [Fingerprint mismatch](./remote-dev-overview.md#fingerprint-mismatch)).
- Known gaps: the details row "Connection" shows `localhost:9876` instead of
  the tunnel's real local port, and **Test connection** on an SSH card opens no
  tunnel (it probes `localhost:9876` on the BAT machine). Open the profile to
  test it for real.

## Uninstallation

Deleting the profile in BAT removes only the local profile; the server keeps
running on the host. To remove everything, run on the host:

Linux:

```sh
systemctl --user disable --now bat-server.service
rm -f ~/.config/systemd/user/bat-server.service ~/.config/systemd/user/bat-server.service.bat-prev
systemctl --user daemon-reload
rm -rf ~/.local/bat-server ~/.local/bat-server.bat-old ~/.local/bat-server.bat-new
rm -rf ~/.local/share/bat-server
# The wizard enables linger on every run; disable it if nothing else needs it:
sudo loginctl disable-linger "$USER"
```

macOS:

```sh
launchctl unload -w ~/Library/LaunchAgents/com.bat-server.plist
rm -f ~/Library/LaunchAgents/com.bat-server.plist ~/Library/LaunchAgents/com.bat-server.plist.bat-prev
rm -rf ~/.local/bat-server ~/.local/bat-server.bat-old ~/.local/bat-server.bat-new
rm -rf ~/Library/Application\ Support/bat-server
```

The cached bundles on the BAT machine stay in `bat-server-bundles` under the
BAT user data directory (shared with WSL setups).

## Troubleshooting

### SSH authentication failed

The dialog offers **Edit SSH settings** (back to step 1), **Retry** and
**Cancel**. BAT does not generate keys, has no key file picker and cannot log
in with a password, whatever the dialog text suggests. Check with
`ssh -v you@dev-server`; to set up a key:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_bat
ssh-copy-id -i ~/.ssh/id_ed25519_bat.pub you@dev-server
```

Add `IdentityFile ~/.ssh/id_ed25519_bat` to the host's entry in
`~/.ssh/config`, then **Edit SSH settings** and pick that alias.

### Host key verification failed

With `accept-new` this happens only when a known host key changed
(reinstall, rotation, or a man-in-the-middle). After confirming the change:

```sh
ssh-keygen -R dev-server
ssh you@dev-server     # accept the new key once
```

Then retry. This error has no dedicated dialog; it shows as "Step failed" with
the hint text.

### The SSH server does not allow port forwarding

Ask the host admin to allow `AllowTcpForwarding` in `sshd_config`, then click
**Already fixed, retry**.

### Start bat-server failed

On Linux the usual cause is linger. Run `sudo loginctl enable-linger $USER`
on the host and retry. Otherwise:

```sh
# Linux
systemctl --user status bat-server
journalctl --user -u bat-server -n 50
ss -lntp | grep 9876

# macOS
launchctl list | grep com.bat-server
lsof -nP -iTCP:9876 -sTCP:LISTEN
```

If another program holds 9876 on the host, the server cannot start (the SSH
wizard does not pick another port).

### `connect-timeout`

The host is not reachable on the SSH port (or the 15 s probe ran out):

1. `ssh -v you@dev-server` from a terminal.
2. Firewalls on both ends.
3. A jump host only works through `~/.ssh/config`; test with
   `ssh -J jump-host you@dev-server`.

### Disconnects after a while

The client reconnects automatically with a delay of
`min(30 s, 1 s × 2^n)` plus up to 1 s of jitter (`computeReconnectDelay`,
`electron/remote/remote-client.ts`); the card shows "Reconnecting…".
After **5 consecutive tunnel start failures** BAT stops retrying and the card
shows "Connection lost — the profile window is open but not connected". There
is no dialog; the first action refused in that window shows a one-time notice.
Once the network is back, close the window, wait 15 s for the connection to be
released, and open the profile again.

## Real SSH e2e checklist (release pre-flight)

The automated suites (`tests/ssh-flow.test.ts`, `tests/ssh-wizard-e2e.test.ts`,
`tests/ssh-flow-journeys.test.ts`, plus the `ssh-*` tests under `tests/`,
`electron/remote/__tests__/` and `src/components/setup-wizard/__tests__/`) run
against mocked IPC. Before a release, check real targets:

- [ ] **linux-x64**: configure → auth → upload → systemd → connect; reconnect
      after restarting BAT.
- [ ] **linux-arm64**: same; the arm64 tarball is used.
- [ ] **darwin-arm64**: same; the plist has `RunAtLoad=true` and
      `KeepAlive.Crashed=true`.
- [ ] **Jump host** through a `~/.ssh/config` alias with `ProxyJump`.
- [ ] **Permission denied**: no key → dialog → set up a key → **Edit SSH
      settings** → done.
- [ ] **Upgrade**: run the wizard again; the same profile is updated, and
      `.bat-old` / `.bat-prev` are gone afterwards; cancel midway once and
      confirm the previous server still runs.
- [ ] **Tunnel loss**: kill the ssh process mid-session; BAT reconnects.
- [ ] **Uninstall**: run the commands above;
      `systemctl --user list-unit-files | grep bat-server` (Linux) /
      `launchctl list | grep com.bat-server` (macOS) return nothing.
