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
