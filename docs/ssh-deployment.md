# SSH Deployment Guide

> Connect BAT to a remote development server over SSH. This is the third remote
> deployment path (after WSL and Docker) and the recommended approach for
> remote Linux/macOS hosts that you reach over the network rather than locally.
>
> Part of BAT remote dev support. For the cross-environment overview and
> decision tree, see [Remote Dev Overview](./remote-dev-overview.md).

## Prerequisites

Before starting the SSH wizard, make sure you have:

| Requirement | Notes |
|-------------|-------|
| BAT app v0.0.16+ | SSH support landed in PLAN-007 Phase 4. |
| OpenSSH 8.0 or newer (client) | Windows 10+ ships an optional OpenSSH client; macOS / Linux are pre-installed. |
| Remote server: linux-x64, linux-arm64, or darwin-arm64 | The BAT release ships pre-built tarballs for these three architectures. |
| Remote login account | Either password (interactive) or — strongly recommended — an SSH key pair. |
| Outbound TCP/22 (or your custom SSH port) reachable | The wizard fails fast with a `connect-timeout` errorCode if not. |
| Server side `tar`, `mkdir`, `bash`, `systemctl --user` (linux) or `launchctl` (darwin) | These are pre-installed on every supported distro. |

If you reach the server via a jump host, configure the jump in `~/.ssh/config`
on the client — BAT delegates host-resolution to OpenSSH and will follow the
jump transparently (D-SSH-5).

## Installation

1. **Open BAT** → Profiles panel → click **Add SSH Profile**.
2. The wizard runs eight steps in order. Each step has a clear status icon
   (⏳ pending, ✅ done, ❌ failed) and exposes Retry / Skip / Cancel actions
   when something fails.

| Step | What it does |
|------|--------------|
| `configure-ssh-host` | Pick or type the host. Reads `~/.ssh/config` so power-user aliases appear in the dropdown. |
| `verify-ssh-auth` | Runs `ssh user@host echo BAT_AUTH_OK && uname -sm && echo $HOME`. Auto-fills `targetOS` (linux vs darwin) and `serverHome`. |
| `install-server-bundle` | `tar | ssh user@host 'mkdir -p X && cd X && tar xz'` — single round trip, no scp/rsync. Progress bar with bytes / s + ETA. |
| `start-server` | Writes a user-level systemd unit (linux) or LaunchAgent plist (darwin), enables it, and verifies the service is listening on the configured port. |
| `fetch-fingerprint` | HTTPS GET `/fingerprint` over the local end of the SSH tunnel to TOFU-pin the cert. |
| `connect-test` | One round trip through the BAT remote IPC handshake. |
| `write-profile` | Persists the SSH profile (host, user, key path, alias, tunnel mode, server home) so future connects skip the wizard. |
| `done` | Surfaces any warnings + final summary. |

## SSH-config alias setup (recommended)

Power users can pre-configure their server in `~/.ssh/config`:

```ssh-config
Host devbox
    HostName 10.0.0.42
    User alice
    IdentityFile ~/.ssh/id_ed25519
    Port 22
    ServerAliveInterval 30
```

The wizard's `configure-ssh-host` step lists all aliases via `ssh -G`. Pick
`devbox` and the user/port/identity-file are inferred — you only need to
choose the install path and tunnel mode.

## Tunnel mode vs Direct connection

BAT supports two SSH transport modes (D-SSH-3):

- **Tunnel** *(default, recommended)* — BAT opens an `ssh -L 9876:localhost:9876` LocalForward
  and binds the BAT server to `127.0.0.1` on the remote host. Works through
  NAT, requires no firewall changes, and is private-by-default. Pick this
  unless you have a hard reason not to.
- **Direct** *(advanced)* — The remote server listens on a public-facing
  interface. You must:
  - Open the relevant port in the remote firewall (`ufw`, `pf`, etc.).
  - Make sure the bind interface honors your security policy. BAT will warn
    when the server is configured to bind to `0.0.0.0` and you're on an
    untrusted network.

The choice is per-profile and can be flipped later by editing the profile.

## systemd vs launchd

BAT installs the BAT server as a *user-level* service so you do **not** need
sudo for the happy path. The two backends are aligned in behavior:

| Concern | linux (systemd) | darwin (launchd) |
|---------|-----------------|------------------|
| Unit location | `~/.config/systemd/user/bat-server.service` | `~/Library/LaunchAgents/com.bat-server.plist` |
| Survives logout | `loginctl enable-linger <user>` (one-time) | `RunAtLoad=true` + `KeepAlive` (always) |
| Restart policy | `Restart=on-failure` | `KeepAlive.SuccessfulExit=false`, `Crashed=true` |
| Activation cmd | `systemctl --user enable --now bat-server` | `launchctl load -w ~/Library/LaunchAgents/com.bat-server.plist` |
| Verify cmd | `systemctl --user status bat-server` | `launchctl list \| grep com.bat-server` |
| Logs | `journalctl --user -u bat-server -f` | `tail -f ~/Library/Logs/com.bat-server.log` (if logging is wired) |

Both modes mirror the Docker `--restart=unless-stopped` semantics so an
unattended remote server self-heals across reboots.

## Troubleshooting

### `permission-denied` (publickey)

The wizard surfaces a modal with three options:

- **[A] Generate** — copy the suggested `ssh-keygen -t ed25519 -C 'bat-setup' -f ~/.ssh/id_ed25519_bat`
  command. **Run it yourself in your terminal.** BAT does not spawn `ssh-keygen`
  in-process (D-SSH-7) to avoid implicit key creation that makes audit harder.
  Then copy the resulting `~/.ssh/id_ed25519_bat.pub` to the remote host's
  `~/.ssh/authorized_keys` (e.g. `ssh-copy-id -i ~/.ssh/id_ed25519_bat user@host`).
- **[B] Use existing key** — point the Identity file picker at an already-trusted key.
- **[C] Cancel** — return to `configure-ssh-host` to re-enter user / host.

### `Host key verification failed`

The remote host key changed (legitimate rotation, OS reinstall, or man-in-the-middle):

```sh
# Inspect the offending line, then remove it:
ssh-keygen -F your.host.example.com
ssh-keygen -R your.host.example.com

# Now run `ssh your.host.example.com` once in your terminal to accept the new
# host key, then retry the BAT wizard.
```

### `loginctl enable-linger` failed

Some hardened distros (selinux, polkit-restricted) need root for this:

```sh
sudo loginctl enable-linger $USER
```

After that runs cleanly, click **Retry** in the BAT wizard.

### `bat-server` is not listening on port 51820

```sh
# linux:
systemctl --user status bat-server
journalctl --user -u bat-server -n 50

# darwin:
launchctl list | grep com.bat-server
tail -n 50 ~/Library/Logs/com.bat-server.log
```

If the unit shows `active (running)` but no socket, check the port is not
already bound by another process (`ss -lntp | grep 51820`).

### Tunnel disconnect

`SshTunnel` (T0284) reconnects with exponential backoff (1s → 2s → 4s → 8s → 16s).
After 5 consecutive failures the BAT UI raises a modal so you can decide
whether to keep retrying or abort. Most transient network blips heal within
the first two retries.

### Probe says `connect-timeout`

The remote host is not reachable on the configured SSH port. Check:

1. `ssh -v user@host` from your terminal — does the TCP handshake even land?
2. Firewall rules on both ends (client outbound + server inbound).
3. If using a jump host, confirm the jump alias works: `ssh -J jump user@host`.

## Rollback chain

If any of the eight wizard steps fails (or the user cancels mid-wizard) the
wizard runner walks the completed steps in reverse and invokes their
rollback handler (best-effort, not transactional). For the SSH flow:

- **install-server-bundle** rollback runs `ssh user@host 'rm -rf <install-path>'`
  to remove the partially-extracted bundle on the remote host.
- **start-server** rollback stops the systemd user unit (linux) or unloads
  the launchd plist (darwin), then removes the unit/plist file.
- **fetch-fingerprint** / **connect-test** failures are read-only; the chain
  still triggers downstream stop+cleanup of the previous `start-server` step.
- **write-profile** rollback removes the partially-created profile entry.
  The SSH profile is **not** persisted unless the wizard reaches `done`
  cleanly.
- Cancellation during `permission-denied` recovery (e.g. the user picks
  Cancel in the key-setup modal) cleanly returns to step 1 with no remote
  side-effects, since auth verification is read-only.

Re-opening **Add SSH Profile** after a rollback is safe; the chain ensures
the previous failed install does not leak state into the next attempt.
Contract source of truth: `src/components/setup-wizard/wizard-runner.ts`
plus `tests/wizard-rollback.test.ts` /
`tests/wizard-rollback-cross.test.ts`.

## Editing an SSH profile from the ProfilePanel

After the wizard completes, the SSH profile appears in the ProfilePanel as a
**ProfileCard**. The card shows:

- Profile name and `targetOS: ssh-linux` or `ssh-darwin` badge.
- `user@host:port` summary + identity-file path (or `~/.ssh/config` alias if
  one was selected) + transport mode (tunnel / direct).
- Pinned TLS fingerprint (read-only) with a **Pin expected fingerprint**
  button to refresh manually if the server cert is rotated.
- A **Re-run wizard** button that reopens the SSH wizard pre-filled with the
  current profile — useful after a server reinstall or when switching
  transport mode.
- A **Delete** button that removes the local profile entry only. The remote
  service is **not** stopped automatically — see Uninstallation below.

Per-environment metadata (`serverHome`, tunnel mode, jump host config) is
exposed under the ProfileCard's **Details** slot so the ProfilePanel UI
stays consistent across local / WSL / Docker / SSH cards.

## Uninstallation

To fully remove a BAT SSH deployment:

1. **In BAT:** Profiles → select the SSH profile → **Delete**. This drops
   the local profile metadata only; the remote server keeps running.
2. **On the remote host:** stop and remove the service.

   linux:

   ```sh
   systemctl --user stop bat-server
   systemctl --user disable bat-server
   rm ~/.config/systemd/user/bat-server.service
   systemctl --user daemon-reload
   ```

   darwin:

   ```sh
   launchctl unload -w ~/Library/LaunchAgents/com.bat-server.plist
   rm ~/Library/LaunchAgents/com.bat-server.plist
   ```

3. **Remove the bundle:** `rm -rf ~/.local/bat-server`.
4. *(Optional)* If you used `loginctl enable-linger`, you can disable it now:
   `sudo loginctl disable-linger $USER`.

## Real SSH e2e checklist (release pre-flight)

The automated test suite (`tests/ssh-wizard-e2e.test.ts`,
`tests/ssh-flow-journeys.test.ts`) runs against mocked IPC and a self-signed
HTTPS mock server. Before each release, BAT maintainers should run a
human-driven checklist against real targets:

- [ ] **linux-x64** target — happy path: configure → probe → upload → systemd start → connect.
- [ ] **linux-arm64** target — same as above; verify the arm64 tarball is picked.
- [ ] **darwin-arm64** target — same as above; verify launchd plist is loaded
      with `RunAtLoad=true` and `KeepAlive.Crashed=true`.
- [ ] **Cross-OS** — Windows client → linux server; check `SshPathTranslator`
      swaps `C:\Users\…` ↔ `/home/…` on chat-context attachments.
- [ ] **Permission-denied recovery** — start with no key, hit the modal, point
      at an existing key, retry — wizard reaches `done`.
- [ ] **Tunnel disconnect** — kill the SSH tunnel mid-session; confirm the
      reconnect modal surfaces after 5 failed retries.
- [ ] **Uninstall** — run the four-step uninstall above; verify nothing
      lingers (`systemctl --user list-unit-files | grep bat-server` returns
      nothing on linux; `launchctl list | grep com.bat-server` returns
      nothing on darwin).

This checklist is intentionally narrow — anything we automate later moves
out of here and into the test suite. SSH wizard mock-based coverage:
`tests/ssh-flow.test.ts` (5 cases), `tests/ssh-wizard-e2e.test.ts` (5 cases),
`tests/ssh-flow-journeys.test.ts` (3 cases) — 13 total.
