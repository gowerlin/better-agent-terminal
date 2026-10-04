# Remote Dev Support — Overview

> Cross-environment entry point for BAT remote development support shipped in
> PLAN-007. This document explains the overall model, helps you pick the right
> deployment target, and links out to the per-environment guides.

## What is BAT remote dev support

BAT (Better Agent Terminal) runs on a host machine — your laptop or desktop —
and gives you a single window to drive AI agents across **multiple execution
environments**:

- **local** — agents run inside the same OS as the BAT terminal client.
- **wsl-linux** — agents run inside a WSL2 distro on a Windows host; BAT
  terminal still runs on Windows.
- **docker-linux** — agents run inside a Docker container; BAT terminal runs on
  the container host.
- **ssh-linux / ssh-darwin** — agents run on a remote Linux or macOS server
  reached over SSH; BAT terminal runs on a different host.

The pattern is always the same: **BAT terminal client (host) ↔ BAT server
(target environment)**. The BAT server is the same Node.js bundle in every
case; the wizard installs it, starts it as a long-lived service, and pins a
self-signed TLS fingerprint so the client can trust the server on subsequent
reconnects.

## Comparison table

| Dimension | local | wsl-linux | docker-linux | ssh-linux / ssh-darwin |
|-----------|-------|-----------|--------------|------------------------|
| **Setup time** | ~0 min (built-in) | 5–10 min (wizard) | 5–10 min (wizard, image build) | 5–15 min (wizard, key setup if needed) |
| **Dependencies on target** | none | WSL2 + systemd + Linux distro | Docker daemon + linux/amd64 image | OpenSSH 8.0+, `tar`, `bash`, systemd (linux) or launchd (darwin) |
| **Network requirement** | none | localhost (mirrored) or WSL NAT | localhost (port forward) | outbound TCP/22 to remote; tunnel mode preferred |
| **Best for** | quick edits on the same machine | Windows users who want a Linux toolchain without leaving the host | reproducible per-project envs, dev container reuse | remote shared dev boxes, cross-NAT / cross-OS workflows |
| **NAT-friendly** | n/a | yes (mirrored mode) | yes | yes (tunnel mode) |
| **Survives target reboot** | n/a | yes (linger + systemd user unit) | yes (`--restart unless-stopped`) | yes (linger + systemd user unit / launchd `KeepAlive`) |
| **TLS fingerprint pinning** | n/a | TOFU on first connect | TOFU on first connect | TOFU on first connect |
| **Cross-OS path translation** | n/a | wsl-linux PathTranslator | docker-linux PathTranslator | SshPathTranslator (handles Win client → linux/darwin server) |

## Choosing your deployment

Use this decision tree to pick the right target.

1. **Where do you write code right now?**
   - Same machine as BAT, no isolation needed → **local**.
   - Same machine but you want a real Linux toolchain (apt, systemd, etc.) → continue.
   - Different machine reachable over the network → continue.
2. **Is the target on the same physical host as BAT?**
   - Yes, and you're on Windows → **wsl-linux** (lowest friction).
   - Yes, and you want per-project reproducibility / dev container reuse →
     **docker-linux**.
   - No, the target is a separate machine → continue.
3. **Is the target reachable directly, or is there NAT / firewall in the way?**
   - Direct LAN with open inbound port → **ssh** with **direct** transport mode.
   - NAT / firewall / public Internet → **ssh** with **tunnel** transport mode
     (default, recommended).
4. **What is your team / personal preference?**
   - Power users with `~/.ssh/config` aliases → **ssh** is the most flexible.
   - One-machine developer who never leaves the laptop → **wsl-linux**
     (Windows) or **local** (macOS / Linux).
   - Teams that ship dev containers → **docker-linux**.

If you're undecided, start with **wsl-linux** on Windows or **ssh** on
macOS/Linux. Both can be removed cleanly via the uninstall steps in their
respective guides.

## Common concepts

These concepts apply to every remote deployment path; per-environment guides
build on top of them.

### `targetOS` profile schema

Every BAT profile carries a `targetOS` field that drives downstream behavior
(path translation, command quoting, capability checks):

| `targetOS` | Set by | Used for |
|-----------|--------|----------|
| `local` | local profiles (auto-fill on load) | no-op translator |
| `wsl-linux` | WSL wizard step 8 | Windows ↔ WSL path conversion |
| `docker-linux` | Docker wizard | Windows / macOS host path → container mount path |
| `ssh-linux` | SSH wizard `verify-ssh-auth` step (auto-detect via `uname -sm`) | Windows client → linux server path swap |
| `ssh-darwin` | SSH wizard `verify-ssh-auth` step | Windows client → darwin server path swap |
| `undefined` | legacy remote profiles (pre-PLAN-007) | falls back to `IdentityTranslator`; UI shows inline migration hint |

Migration: legacy profiles created before PLAN-007 land with `targetOS:
undefined`. They keep working through the `IdentityTranslator` (no path
rewriting), and the ProfilePanel shows an inline hint suggesting the user
re-run the matching wizard to populate `targetOS`. Edits via the wizard
correctly fill the field on save.

### PathTranslator framework

A small set of translators converts host paths into target paths when chat
context attachments cross the boundary:

- `IdentityTranslator` — pass-through, used for `local` and undefined-target
  profiles.
- `WslPathTranslator` — `C:\projects\foo` ↔ `/mnt/c/projects/foo`.
- `DockerPathTranslator` — host bind mount root ↔ container mount path.
- `SshPathTranslator` — Windows client paths → POSIX paths on linux/darwin
  servers (and back when surfacing server paths in the UI).

Translators are pure functions over the profile metadata; tests cover each
case in `tests/path-translator-*.test.ts`.

### TLS fingerprint pinning (TOFU)

Every BAT server (whether installed via WSL, Docker, or SSH wizard) generates
a self-signed certificate at first start. The wizard's `fetch-fingerprint`
step retrieves the SHA-256 fingerprint over the freshly-established (and
unverified-yet) HTTPS connection and persists it on the profile. Every
subsequent connect verifies the live cert against the pinned fingerprint —
mismatch fails the connect and surfaces a clear UI error. See
`electron/remote/certificate.ts` and the **Remote 資安** section in `CLAUDE.md`
for the full security model.

### Setup wizard

All three remote paths share the same wizard scaffold (`SetupWizard.tsx`).
Each step exposes a status icon (⏳ pending, ✅ done, ❌ failed) and standard
Retry / Skip / Cancel actions. Steps are independent — each one is its own
async function (`installServerBundle`, `startServer`, `fetchFingerprint`,
`connectTest`, etc.) — and the wizard runner orchestrates them and dispatches
a per-step **rollback handler** on failure.

### Rollback chain (best-effort)

When a wizard step fails or the user cancels mid-wizard, the runner walks the
already-completed steps in reverse and invokes their rollback handler. The
contract (C-3) is enforced by `src/components/setup-wizard/wizard-runner.ts`
and exercised by the cross-deployment rollback test suite:

- Rollback is **best-effort**, not transactional.
- Each handler logs its outcome (`rolled-back`, `partial`, `skipped`).
- The profile is **not** persisted unless the wizard reaches `done` cleanly.
- Cross-deployment rollback test coverage:
  `tests/wizard-rollback.test.ts`, `tests/wizard-rollback-cross.test.ts`.

The user can also re-run the wizard at any time; the rollback chain ensures
the previous failed install does not leak state into the next attempt.

## Dev deploy of headless server JS (contributors)

The server inside WSL / SSH targets comes from the **baseline tarball**
(GitHub Release `server-bundle-v<version>`), so a local BAT build does **not**
carry local changes to `electron/remote/*` into the target. To test a headless
change without rebuilding the tarball, `npm run deploy:headless:dev` rebuilds
only the server JS and copies it into an existing install root. Native modules
in the install root are left untouched.

```bash
# Dry-run (default): build, then list each file with built / installed sha256
npm run deploy:headless:dev -- --target wsl:Ubuntu-24.04

# Write: back up each file to <file>.bak-<tag>, copy, restart bat-server,
# then print is-active, LISTEN sockets and the journal tail
npm run deploy:headless:dev -- --target wsl:Ubuntu-24.04 --yes --expect-string MY_MARKER

# Restore the originals from the backups (also needs --yes)
npm run deploy:headless:dev -- --target wsl:Ubuntu-24.04 --rollback --yes

# Local install root (no service restart)
npm run deploy:headless:dev -- --target dir:/path/to/bat-server --yes
```

| Option | Meaning |
|--------|---------|
| `--target wsl:<distro>` / `dir:<path>` | Where to deploy. WSL install root defaults to `~/.local/bat-server` (`--install-root` overrides). Distro must match `[A-Za-z0-9._-]+`. |
| `--yes` | Actually write. Without it nothing in the install root is touched. |
| `--tag <name>` | Backup suffix (default `dev`). The **first** deploy for a tag records the original (`.bak-<tag>`, or a `.bak-<tag>.absent` marker for files that did not exist); later deploys never overwrite it. |
| `--rollback` | Restore from `.bak-<tag>` (and remove files that only exist because of the deploy). |
| `--no-restart` | WSL only: skip `systemctl --user restart bat-server`. |
| `--expect-string <text>` | Report whether a marker is present in the built and deployed JS (repeatable; exit code 2 if missing). |

- esbuild entry points, externals and options are **parsed from**
  `scripts/build-server-bundle.mjs` (never hand-copied); the tool fails fast if
  that script's shape changes.
- WSL commands run as a generated bash script file via
  `wsl.exe -d <distro> --exec bash <file>`, which avoids `$` escaping problems of
  `wsl.exe -- bash -c '...'` from PowerShell.
- Staging output lands in `dist-server/dev-deploy-headless/` (gitignored).

> ⚠️ **Re-running the WSL setup wizard reinstalls the baseline bundle and
> overwrites a dev deploy.** Run the tool again afterwards if you still need the
> local JS.

## Protocol smoke against a running headless server (contributors)

`npm run smoke:remote:headless` connects to an already running headless
bat-server **as an ordinary remote client** and walks the P0 PTY lifecycle. It
never restarts, stops or redeploys the server, so it is safe to run while
someone is using it.

```bash
# WSL: port / token / certificate fingerprint are read from the distro (read-only)
npm run smoke:remote:headless -- --target wsl:Ubuntu-24.04
npm run smoke:remote:headless -- --target wsl:Ubuntu-24.04 --json

# Any reachable server (SSH tunnel, Docker, ...): pass the connection info
npm run smoke:remote:headless -- --url wss://127.0.0.1:9877 \
  --token-file ./server-token.json --fingerprint 22:3A:E4:...:79:97
```

| Check | What it proves |
|-------|----------------|
| S1 | TLS + SHA-256 fingerprint pin + token auth; a wrong fingerprint is rejected before the token is sent |
| S2 | `settings:get-shell-path('auto')` returns an absolute Linux shell |
| S3 | `pty:create` emits output; a `pty:write` marker round-trips |
| S4 | `pty:resize` 120x40 is what `stty size` reports |
| S5 | a second `pty:create` with the same id keeps the same shell (`$$`) |
| S6 | the PTY survives a WS disconnect; writes work after reconnect + auth |
| S7 | `pty:kill` emits `pty:exit`; a later write returns `pty-not-found` and the connection stays usable |
| S8 | an unsupported channel (`claude:set-codex-sandbox-mode`; the server bundle ships no Codex) returns `No handler for channel: …`, not a timeout |
| S9 | `claude:get-cli-path` / `claude:detectRuntime` / `claude:auth-status` answer without a login (fails with "server predates T0401" against older servers) |
| S10 | `remote-tools:detect` (the PLAN-037 AI toolchain probe; up to 30 s, the login-view probe loads the user's rc files) returns a schema v1 report with `env.osFamily = linux` and `git` = `ok` (fails with "server predates T0411" against older servers) |

| Option | Meaning |
|--------|---------|
| `--target wsl:<distro>` | Reads `BAT_SERVER_PORT` / `BAT_SERVER_DATA_DIR` from the `bat-server` user unit (defaults: port `54321`, `~/.local/share/bat-server`), only the `fingerprint` field of `server-cert.json`, and `server-token.json`. Distro must match `[A-Za-z0-9._-]+`. `--host` (default `127.0.0.1`) / `--port` override. |
| `--url` / `--token-file` / `--fingerprint` | Direct target. The token file may be a plaintext `server-token.json` record or a bare token; the fingerprint is accepted in any case, with or without colons. |
| `--cwd <path>` | Smoke PTY working directory (default: WSL `$HOME`, else `/tmp`). |
| `--timeout-ms <ms>` | Per-step timeout (default `10000`; S10 waits at least 30 s). |
| `--json` | Machine-readable report. Exit code `0` = all PASS, `1` = a check failed or a smoke PTY was left behind, `2` = usage / connection-info error. |

- The smoke only touches its own PTY (`smoke-<timestamp>-<rand>`), kills it on
  every exit path and finishes with an existence probe. Output of other PTYs on
  the same server (events are broadcast to every client) is ignored.
- It never sends a wrong token on purpose: five failed auths ban the client IP
  for 10 minutes, and the user's own BAT connects from the same loopback address.
- The frame format of `electron/remote/protocol.ts` is re-implemented in the
  script (`remote-client.ts` imports `electron`);
  `scripts/__tests__/smoke-remote-headless.test.mjs` fails if the two drift.

## Troubleshooting (cross-cutting)

For environment-specific troubleshooting see the per-env guides. The issues
below appear regardless of which deployment path you picked.

### Connection lost after sleep / network change

The BAT remote client uses an exponential-backoff reconnect loop. After the
network recovers, the next BAT IPC call triggers a fresh handshake. If
reconnect fails for more than ~30 seconds, the UI surfaces a modal with
"Retry now" and "Open profile" actions. Most transient cases heal on the
first retry.

### Fingerprint mismatch

If the BAT server reinstalls (or its userData directory is wiped), the
self-signed cert is regenerated and the pinned fingerprint will not match.
The connect fails fast with a security warning. Resolve by:

1. Confirming the server reinstall was intentional (not a man-in-the-middle).
2. Editing the profile in BAT → click the **Pin expected fingerprint**
   button to re-pin the live fingerprint (TOFU again).

### Profile schema migration (legacy remote profiles)

Profiles created before PLAN-007 land in `targetOS: undefined`. They
continue to work through `IdentityTranslator`, but path translation is a
no-op. The ProfilePanel shows an inline hint per profile suggesting you
re-run the matching wizard. After re-run, the wizard's `write-profile` step
fills in `targetOS` and any environment-specific metadata
(`wslDistro`, container info, `serverHome`, etc.).

### Wizard failure mid-flow

Wizard failures trigger the rollback chain (see above). After rollback
completes, you can:

- Click **Retry** on the failed step.
- Click **Cancel** to close the wizard; the rollback chain has already cleaned
  up the partial install.
- Re-open **Add profile** to restart from step 1.

The profile is never half-written: either you reach `done` or no profile is
saved.

## Links

- [WSL Deployment Guide](./wsl-deployment.md) — full WSL setup, mirrored mode,
  systemd integration, real WSL pre-flight checklist.
- [Docker Deployment Guide](./docker-deployment.md) — image build, verify,
  lifecycle scenarios (restart self-heal, host reboot, OOM recovery), pre-flight
  checklist.
- [SSH Deployment Guide](./ssh-deployment.md) — SSH wizard 8 steps, tunnel vs
  direct mode, systemd vs launchd, key-based auth recovery, real SSH e2e
  checklist.
- [PLAN-007 Release Checklist](./plan-007-release-checklist.md) — release
  engineer pre-flight checklist covering all four environments.
- Wizard rollback chain (best-effort) — implementation in
  `src/components/setup-wizard/wizard-runner.ts`; cross-deployment test
  suite at `tests/wizard-rollback.test.ts` and
  `tests/wizard-rollback-cross.test.ts`.
