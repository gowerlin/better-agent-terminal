# Remote Dev Support — Overview

> Cross-environment entry point for BAT remote development. This document
> explains the overall model, helps you pick a deployment target, describes the
> concepts all targets share, and links out to the per-environment guides.

## What is BAT remote dev support

BAT (Better Agent Terminal) runs on your machine and drives AI agents in
**several execution environments**:

- **local** — agents run on the same OS as BAT.
- **wsl-linux** — agents run inside a WSL2 distro on the same Windows machine.
- **docker-linux** — agents run inside a local Docker container.
- **ssh-linux / ssh-darwin** — agents run on a Linux or Apple Silicon macOS
  host reached over SSH.

The pattern is always the same: **BAT (client) ↔ BAT server (target
environment)**. The server is the same headless Node.js build everywhere. A
setup wizard installs it (WSL, SSH) or starts it from a locally built image
(Docker), records the server's self-signed TLS fingerprint, and saves a
profile. Opening the profile opens a BAT window whose terminals, Agent panel,
file tree and Git views run on the target.

All wizards start from the sidebar **Profiles** panel → **+ More ▾**:
**Add WSL Profile** and **Add Docker Profile** under **Container**,
**Add SSH Profile** under **Remote**.

## Comparison table

| Dimension | local | wsl-linux | docker-linux | ssh-linux / ssh-darwin |
|-----------|-------|-----------|--------------|------------------------|
| **Needs on the target** | — | WSL2 distro **with systemd** (required) | Docker daemon + `bat-server:latest` image **built from source** | key login (no passwords), port forwarding allowed, systemd user services (Linux) or launchd (macOS) |
| **Server comes from** | — | server bundle (download / cache / import) | the image (`/opt/bat-server`) | server bundle (download / cache / import) |
| **Architectures** | — | linux x64 / arm64 | linux/amd64 image | linux x64 / arm64, darwin arm64 (no Intel Mac) |
| **Network** | — | `127.0.0.1:<9877–9976>` on Windows | `127.0.0.1:<9877–9976>` published from the container's 9876 | SSH tunnel only; server listens on the host's `localhost:9876` |
| **Survives target reboot** | — | yes (systemd user unit + linger; BAT keeps the distro running while it runs) | yes for **Create new** (`--restart unless-stopped`) | Linux: yes (linger); macOS: after that user logs in (LaunchAgent) |
| **Upgrade** | — | run the wizard again; same profile updated | rebuild the image; the wizard creates a new profile | run the wizard again; same profile updated |
| **Local file attachments** | yes | translated to the distro (`\\wsl.localhost\…` ↔ `/…`) | translated inside the mounted folder | **refused** (files must be on the host) |
| **TLS fingerprint pinning** | — | TOFU in the wizard | TOFU in the wizard | TOFU in the wizard |

## Choosing your deployment

1. **Same machine, no isolation needed** → **local**.
2. **Windows and you want a Linux toolchain** → **wsl-linux** (lowest
   friction; needs systemd in the distro).
3. **Code and runtime live on another machine** (office dev box, cloud VM) →
   **ssh**. It works through NAT and firewalls because it only needs outbound
   SSH; there is no "direct" mode.
4. **Per-project, rebuildable environments** and you are comfortable building
   the image from the BAT source → **docker-linux**.

If undecided, start with **wsl-linux** on Windows or **ssh** elsewhere.
There is no one-click remote removal: deleting a profile only removes it from
BAT, and each guide lists the commands that remove the server.

## Common concepts

### Setup wizard

`src/components/setup-wizard/SetupWizardShell.tsx` renders every wizard;
`wizard-runner.ts` runs the steps (`buildWslWizardSteps` / `buildSshWizardSteps`
in `wsl-flow.ts` / `ssh-flow.ts`, and `docker-flow.ts`). Each step shows its
status; a failed step shows the mapped error (`error-mapper.ts`) with
**Retry** / **Skip** / **Cancel**, **Edit settings** where the step can jump
back, or a recovery button such as **I've run the command, retry**.

Shared shape: detect / configure → install or verify the server → start it →
`fetch-fingerprint` (TLS handshake, no HTTP endpoint) → `connect-test` (token
+ recorded fingerprint) → `write-profile` → `done`. After `done`, the wizard
shows the remote AI tools check. Per-step tables: [WSL](./wsl-deployment.md#installation),
[SSH](./ssh-deployment.md#installation), [Docker](./docker-deployment.md#setup-wizard).

### Rollback chain (best-effort)

When a step fails without a retry, or you cancel (closing the wizard while it
runs counts), the runner rolls back the failed step and then the completed
steps in reverse order. Each step's rollback only undoes what **this run**
created or changed:

- Rollback is **best-effort**, not transactional; each handler logs its
  outcome.
- The profile is written in `write-profile`, not at the end. Its rollback
  deletes a profile this run created, or restores the fields it overwrote in an
  existing one (WSL / SSH upgrades).
- WSL / SSH upgrades keep the previous bundle (`.bat-old`) and, for SSH, the
  previous unit / plist (`.bat-prev`) until the wizard finishes, so cancelling
  leaves the previous server as it was, running if it was running.
- Docker rollback removes only a container this run created and stops only a
  container this run started.
- Steps that only read (`fetch-fingerprint`, `connect-test`) have nothing to
  undo beyond closing a verify tunnel.

Tests: `tests/wizard-rollback.test.ts`, `tests/wizard-rollback-cross.test.ts`
and `src/components/setup-wizard/__tests__/wizard-*rollback*.test.ts(x)`
(cancel, jump-back, ownership, upgrade).

### Server bundle

WSL and SSH install a server bundle tarball for the target's arch
(`linux-x64`, `linux-arm64`, `darwin-arm64`). The installer does not include
it: the wizard uses the local cache (`bat-server-bundles` in the BAT user data
directory, verified with a `.sha256` sidecar), then a baseline shipped by
older installers, then downloads the GitHub release `server-bundle-v<version>`.
Without GitHub access use **Import local tarball…** on the failed step, or
point `BAT_SERVER_BUNDLE_BASE_URL` at a mirror before starting BAT. Docker does
not use the bundle; the server is in the image. Details:
[Server bundle distribution](./server-bundle-distribution.md).

### TLS fingerprint pinning (TOFU)

Every BAT server generates a self-signed certificate on first start and keeps
it (with its token) in its data directory. The wizard's `fetch-fingerprint`
step reads the SHA-256 fingerprint from a TLS handshake and saves it on the
profile. Every later connection compares the live certificate with the pinned
fingerprint **before the token is sent**; a mismatch closes the connection
(`electron/remote/remote-client.ts`). Security model and certificate
handling: [docs/agent-guide/remote-security.md](./agent-guide/remote-security.md).
Recovery: [Fingerprint mismatch](#fingerprint-mismatch).

### `targetOS` profile field

Every remote profile carries `targetOS`, which drives path translation and
target-specific behavior:

| `targetOS` | Set by | Used for |
|-----------|--------|----------|
| `local` | local profiles (auto-filled on load) | no translation |
| `wsl-linux` | WSL wizard `write-profile` | Windows ↔ WSL paths (`wslDistro`) |
| `docker-linux` | Docker wizard `write-profile` | host folder ↔ `/workspace/<folder>` (`dockerMounts`) |
| `ssh-linux` / `ssh-darwin` | SSH wizard, from `uname -sm` in `verify-ssh-auth` | `serverHome`; local files refused |
| `undefined` | legacy remote profiles | identity translation; the profile card shows a warning banner with a `targetOS` dropdown to set it |

### PathTranslator

`electron/remote/path-translator.ts` maps paths that cross the boundary
(`createTranslator`):

- `IdentityTranslator` — `local` and legacy profiles.
- `WslPathTranslator` — Windows paths in the distro (`\\wsl.localhost\<distro>\…`
  ↔ `/…`, `C:\…` ↔ `/mnt/c/…`).
- `DockerPathTranslator` — paths inside the mounted host folder ↔ the
  container mount path; other paths are unreachable (`outside-docker-mounts`).
- `SshPathTranslator` — maps server paths for the UI; **local files are never
  attached** (`resolveClientPaths` returns `ssh-local-file`, and the window
  shows "Not on the remote host, not attached: …").

Tests: `tests/path-translator.contract.test.ts`, `tests/docker-path.test.ts`,
`electron/remote/__tests__/resolve-client-paths.test.ts`.

### Headless fs sandbox (`workspace:sync-roots`, T0406)

The file tree / file preview / search / image preview of a remote window run
on the server (`fs:*`, `image:read-as-data-url`). Like the local app, the
server only serves paths inside a workspace root — but the headless server has
no window registry, so the client tells it the roots:

- After every successful auth (first connect and every reconnect) and after
  `workspace:save` / `workspace:load` of a window bound to the remote profile,
  Electron main sends `workspace:sync-roots([folderPath, …])` with the
  `folderPath` of every workspace of that profile's windows. The channel is
  path-aware (`array-of-strings`), so `RemoteClient.invoke` converts each root
  once with the profile's PathTranslator (`\\wsl.localhost\Ubuntu-24.04\home\x`
  → `/home/x`). Local-profile windows never send it.
- The server keeps roots **per connection** and allows the union; a closed
  connection's roots are dropped. It accepts only absolute server paths and
  rejects `/` (a filesystem root) and any root with a `..` segment.
- **Fail closed**: until a connection pushes roots (or after an empty push),
  every fs / image call is denied (`fs:readdir` → `[]`, `fs:readFile` →
  `{ error: 'Path access denied' }`).
- A desktop BAT acting as a server answers `workspace:sync-roots` with
  `{ ok: false }`: its sandbox stays the one built from its own window registry.

### Upgrade and removal

- **Upgrade**: after upgrading BAT, run the same wizard again. WSL and SSH
  install the new bundle next to the old one, swap only after it checks out,
  and update the existing profile; Docker needs a rebuilt image and creates a
  new profile.
- **Removal**: deleting a profile only removes it from BAT; the server keeps
  running. Full removal commands, including `.bat-old` / `.bat-new` /
  `.bat-prev` leftovers, data directories and linger:
  [WSL](./wsl-deployment.md#uninstallation),
  [SSH](./ssh-deployment.md#uninstallation),
  [Docker](./docker-deployment.md#uninstallation).

## Dev deploy of headless server JS (contributors)

The server inside WSL / SSH targets comes from the **server bundle tarball**
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
- The node helpers the server bundle ships (`serverBundleHelperScripts` in
  `scripts/build-server-bundle.mjs`: `bat-terminal.mjs`, `bat-notify.mjs` and
  their imports) are deployed too, into `<installRoot>/scripts/` (created when
  missing; listed as `scripts/<name>`, same `.bak-<tag>` / `.absent` /
  `--rollback` rules). Without them a remote PTY gets no helper env — see
  [Remote Tower notification](#remote-tower-notification-plan-036-k). A
  `scripts/` dir created by a deploy stays (empty) after `--rollback`.

> ⚠️ **Re-running the WSL setup wizard reinstalls the release bundle and
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
| S11 | `github:check-cli` (up to 20 s; the server runs `gh auth status`, a network check) answers `installed: true` with a boolean `authenticated` (the WSL test host is not logged in ⇒ `false`); then, through a second smoke PTY, the smoke creates its own temp repo `mktemp -d /tmp/bat-smoke-git.XXXXXX` with one empty commit, checks `git:getRoot` / `git:branch` / `git:log` / `git:status` / `git-scaffold:healthCheck` against it and `worktree:status` of an unknown session (`null`), then removes the repo and kills that PTY (fails with "server predates T0405" against older servers) |
| S12 | the headless fs sandbox: through a third smoke PTY the smoke creates its own temp dir `mktemp -d /tmp/bat-smoke-fs.XXXXXX` holding `smoke.txt`; before any sync `fs:readdir` returns `[]` and `fs:readFile` is denied; `workspace:sync-roots(['/', dir])` accepts only the dir and rejects `/` as a filesystem root; then `fs:readdir` / `fs:readFile` / `fs:stat` read the dir while `fs:readdir('/etc')` and `fs:readFile('/etc/hostname')` stay denied. Cleanup clears this connection's roots, removes the dir and kills that PTY (fails with "server predates T0406" against older servers, after a read-only `fs:stat` probe — nothing is created) |
| S13 | the remote Tower path (PLAN-036 K): in a fourth smoke PTY the `BAT_*` key names (values are never printed) are exactly the remote-tab set of [Remote Tower notification](#remote-tower-notification-plan-036-k), no env value equals the server token (compared as sha256 — the token itself is never typed) and `BAT_REMOTE_TOKEN` has a capability's length; then the real `bat-terminal.mjs` runs **inside that PTY** with its env (bundle node `$BAT_HELPER_DIR/../bin/node`, else `node`): a raw command that names another tower with `--notify-id` must be refused before anything is created (`Forbidden: tower-not-bound`; since T0579 a Tower capability may call `terminal:create-with-command`, see [Capability scope](#remote-tower-notification-plan-036-k), but the new terminal may report only to that Tower; a server before T0579 answers `Forbidden: channel-not-allowed`), and an agent id no server registers must reach `terminal:create-agent-command` with the tower role and create nothing (`Forbidden: agent-not-allowed` since T0450). Neither probe starts a terminal or an agent; one that does is a FAIL and is killed in cleanup. A server without helper env (before T0433, or helpers not deployed) is a **SKIP that does not fail the run** |

| Option | Meaning |
|--------|---------|
| `--target wsl:<distro>` | Reads `BAT_SERVER_PORT` / `BAT_SERVER_DATA_DIR` from the `bat-server` user unit (defaults: port `54321`, `~/.local/share/bat-server`), only the `fingerprint` field of `server-cert.json`, and `server-token.json`. Distro must match `[A-Za-z0-9._-]+`. `--host` (default `127.0.0.1`) / `--port` override. |
| `--url` / `--token-file` / `--fingerprint` | Direct target. The token file may be a plaintext `server-token.json` record or a bare token; the fingerprint is accepted in any case, with or without colons. |
| `--cwd <path>` | Smoke PTY working directory (default: WSL `$HOME`, else `/tmp`). |
| `--timeout-ms <ms>` | Per-step timeout (default `10000`; S10 waits at least 30 s, S11's `github:check-cli` at least 20 s). |
| `--json` | Machine-readable report. Exit code `0` = all PASS (a WARN, or a SKIP with `reason: "server-too-old"`, is reported but tolerated), `1` = a check failed / was skipped for a failed prerequisite or a smoke PTY was left behind, `2` = usage / connection-info error. |

- The smoke only touches its own PTYs (`smoke-<timestamp>-<rand>`, and
  `…-git` for S11, `…-fs` for S12, `…-tower` for S13), kills them on every exit path and finishes with an existence
  probe. Output of other PTYs on the same server (events are broadcast to every
  client) is ignored.
- S11 writes git state only inside the temp repo it created under
  `/tmp/bat-smoke-git.*` and deletes only a path matching that pattern; it never
  runs a git command in the user's repos, and never logs in to gh or reads its token.
- S12 reads files only inside the temp dir it created under `/tmp/bat-smoke-fs.*`
  (and the denied `/etc` probes, which must return nothing) and deletes only a
  path matching that pattern. The roots it syncs belong to its own connection
  only — the user's BAT connection keeps its own — and are cleared afterwards.
  Caveat: the server allows the union of every connection's roots, so S12's
  "denied before sync" step would fail if the user's own workspace roots
  contained the smoke's temp dir (a workspace at `/tmp` or `/`; `/` is rejected).
- It never sends a wrong token on purpose: five failed auths ban the client IP
  for 10 minutes, and the user's own BAT connects from the same loopback address.
- The frame format of `electron/remote/protocol.ts` is re-implemented in the
  script (`remote-client.ts` imports `electron`);
  `scripts/__tests__/smoke-remote-headless.test.mjs` fails if the two drift.

## Several remote profiles at once (PLAN-039)

Each remote profile (WSL, SSH, Docker, …) has its **own** connection, kept in
`RemoteConnectionRegistry` (`electron/remote/remote-connection-registry.ts`,
T0462–T0464). Opening a second remote profile no longer takes the connection
away from the first one: before PLAN-039 there was a single `remoteClient`
slot, and the window of the profile that lost it showed "not connected".

- **Routing**: a window's IPC goes to the server of the profile it is bound to
  (a detached workspace window: its parent window's profile); remote events are
  sent only to that profile's windows. A window whose profile has no live
  connection is refused (`no-client` / `reconnecting`), never served locally.
- **Lifetime**: the connection stays while the profile has a window — a window
  hidden to the tray counts. When its last window closes the connection is
  released **15 s** later (`IDLE_GRACE_MS`), re-checked at expiry, so reopening
  the profile within the grace reuses it without a new handshake. A profile
  that connected but never got a window is released after 60 s
  (`FIRST_WINDOW_GRACE_MS`).
- **Cap: 8 remote profiles at once** (`MAX_CONCURRENT_REMOTE_PROFILES`,
  counting connections still connecting or reconnecting). Opening a 9th shows a
  "Remote profile limit reached" dialog (`openProfileWindows` returns
  `error: 'remote-limit'`); existing connections are not touched. Close every
  window of a profile you no longer need, wait 15 s, then retry. Temporary
  connections (Test connection, the profile list fetch) do not count.
- **Opening a profile that already has a window** focuses that window and shows
  "This profile is already open in another window." instead of opening a second
  connection (`openProfileWindows`, `electron/main.ts`).
- **Same server, two profiles**: allowed, logged as a warning (see the double
  Enter limitation under [Remote Tower notification](#remote-tower-notification-plan-036-k)).
- **SSH tunnels**: each SSH profile runs its own `ssh -L`. A dynamic local port
  that turns out to be taken is retried once on a new port; two profiles with
  the same fixed `tunnelLocalPort` get a warning (only one can bind it; T0465).
- **Quit** waits up to 2 s for every connection (and its ssh process) to close.

**Automated check:** `e2e/plan039-multi-remote.spec.ts` (T0466) launches two
isolated BAT instances from the source build that serve each other: profile P
points at instance A itself, profile Q at instance B. It checks that both
windows are connected to their own server, that `pty:create` from each window
lands on that window's server, that a 9th profile is refused without evicting
anyone, and that closing P's window releases P after the grace while Q keeps
working. Run it alone after `npx vite build`:
`npx playwright test e2e/plan039-multi-remote.spec.ts` (about 25 s).

**Manual acceptance (real WSL + SSH):**

1. Have a WSL profile and an SSH profile that each connect on their own.
2. From the local window's ProfilePanel open both. Both windows connect and
   neither shows the "not connected" notice.
3. In each window open a terminal and run a command; start a Claude Agent
   session in each and send a prompt.
4. In each window run a Tower → Worker round trip (the agent-mode dispatch
   from [Remote Tower notification](#remote-tower-notification-plan-036-k)),
   ending with `bat-notify.mjs --submit`: the toast, badge and Enter land in
   the window that dispatched it, never in the other one.
5. Close the SSH window (its only window). Within the first ~10 s the debug log
   shows `profile <id> has no window left — releasing its connection in 15s`;
   after ~15 s it shows `released the connection of profile <id> (idle: no
   window left)`. The WSL window stays connected throughout and its terminal,
   Agent and `bat-notify --submit` keep working.
6. Repeat with the roles swapped (close the WSL window, keep SSH).

**Automated real-remote acceptance (T0467, opt-in, Windows only):**
`e2e/plan039-real-remote.spec.ts` runs steps 1-6 above unattended against the
source build, with a real WSL server and a real SSH server. It is skipped unless
`BAT_E2E_REAL_REMOTE=1`, so CI and `npm run test:e2e` never run it.

```powershell
node e2e/real-remote/plan039-real-remote-env.mjs up     # ~1 min first time (image build)
npx vite build
$env:BAT_E2E_REAL_REMOTE=1; npx playwright test e2e/plan039-real-remote.spec.ts   # ~40 s
node e2e/real-remote/plan039-real-remote-env.mjs down   # add --rmi to drop the image too
```

- **Prerequisites**: WSL `Ubuntu-24.04` with its bat-server running on
  `localhost:9877` (profile W, only read and connected to: the env script reads
  its token / fingerprint like `smoke:remote:headless`, the spec kills every PTY
  it created there), Docker Engine inside that distro (`docker.io`, user in the
  `docker` group), Git for Windows (`usr\bin\ssh.exe`), and a linux-x64 tarball
  in `dist-baseline/` (`npm run fetch:baseline`).
- **What `up` creates** (all marked `bat-t0467` / label `bat.t0467=1`): image
  `bat-t0467-sshd:local` (`e2e/real-remote/Dockerfile`: the baseline bundle plus
  the current source's headless JS and helpers from `dev-deploy-headless`
  staging), container `bat-t0467-sshd` (hostname `bat-t0467-s`; sshd with key
  login for user `bat` on `127.0.0.1:22467`, its own bat-server on the
  container's localhost — profile S reaches it through the usual `ssh -L`), and
  `%TEMP%\bat-t0467` (temporary key, isolated `HOME`, `connection.json` for the
  spec). No network or volume is created. `down` removes the container (only one
  carrying the label) and the state dir; the image is kept for reruns.
- **Differences from the manual steps**: no Claude Agent session (step 3), and
  step 4's Worker is a PTY the window creates with
  `customEnv.BAT_TOWER_TERMINAL_ID` = the Tower tab (the worker capability a
  dispatched Worker gets) running `bat-notify.mjs --submit` itself, instead of a
  `bat-terminal.mjs` dispatch that would start an agent. The pre-filled text is a
  shell command, so its output in the Tower tab proves the Enter. The S
  instance's `ssh` is Git for Windows' with an isolated `HOME` (prepended to
  `PATH`), because System32 OpenSSH ignores `HOME` and would add the container's
  host key to the user's `~/.ssh/known_hosts`; an installed BAT uses System32 ssh.

## Remote Tower notification (PLAN-036 K)

A Control Tower session running in a remote tab dispatches Workers
(`bat-terminal.mjs`) and Workers report back (`bat-notify.mjs`: toast, tab
badge, pre-filled text, `--submit`) exactly as on a local BAT. The helpers run
**on the server** and talk to the headless bat-server over
`wss://127.0.0.1:<port>`; they never reach the local BAT.

**Per-PTY capabilities, never the server token.** The headless server issues
each PTY its own capability token (in memory only; the registry keeps its
SHA-256 digest) and injects it as `BAT_REMOTE_TOKEN`:

| Key | Value |
|-----|-------|
| `BAT_SESSION` / `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` | as in every BAT PTY (`BAT_WORKSPACE_ID` = the client workspace) |
| `BAT_REMOTE_PORT` | the headless server port |
| `BAT_REMOTE_TOKEN` | **this PTY's capability** (`batcap.` + 43 chars since T0449) |
| `BAT_SERVER_CERT_PATH` | `<dataDir>/server-cert.json` — the helpers pin this fingerprint |
| `BAT_HELPER_DIR` | `<installRoot>/scripts` |
| `BAT_HELPER_LOG_DIR` | `<dataDir>/Logs` (the helpers' `bat-scripts.log`) |
| `BAT_HELPER_NODE` | `<installRoot>/bin/node`, the bundle's own node — only when it exists (T0456) |
| `PATH` | the PTY's usual `PATH` with `<installRoot>/bin` **appended** (a node the user installed still wins; T0456) |
| `BAT_TOWER_TERMINAL_ID`, `CT_MODE`, `CT_INTERACTIVE` | Worker tabs only (set by the dispatching Tower) |

Inherited `BAT_*` variables are always scrubbed. When `<installRoot>/scripts`
lacks the helpers (a bundle before T0433, or a JS-only dev deploy) nothing is
injected or issued: the tab has `BAT_SESSION=1` but no helper env (and its
`PATH` is left alone), and the skills fall back to the manual message.

**Capability scope** (`HELPER_CHANNEL_ROLES`, `electron/remote/helper-capability.ts`;
default deny, the same table as on a local BAT since T0579):

| Role | Channels |
|------|----------|
| **Tower** only (PTY without a notify target) | `terminal:create-agent-command`, `terminal:create-with-command` (raw command), `terminal:close-worker`, `terminal:set-role`, `question:answer` |
| **Worker** only (PTY with `BAT_TOWER_TERMINAL_ID`) | `terminal:notify`, `pty:write`, `terminal:keypress`, `question:ask`, `question:cancel` — all bound to its own Tower |
| Both (read-only queries, hook reports) | `terminal:whoami`, `terminal:list`, `terminal:get-state`, `terminal:read-output`, `terminal:wait`, `worktree:terminal-status`, `terminal:report-hook`, `question:list`, `question:wait` |

Each channel has further per-call checks (new terminal ids only, the Tower
itself as notify target, registry agents only, a `customEnv` whitelist, at most
8 live children and one creation per second, query targets limited by
`authorizeHelperQueryTarget`). The full table with every check and error code
is in [docs/agent-guide/remote-tower-notify.md](./agent-guide/remote-tower-notify.md);
it is not repeated here.

- Everything else (`pty:create`, `fs:*`, `git:*`, `claude:*`, …) →
  `Forbidden: channel-not-allowed`. Helper connections receive no broadcasts
  and do not count as clients for the orphan PTY reclaim.
- The PTY's exit / kill revokes its capability: frames already queued on an
  authenticated socket run no handler and the socket is terminated (T0447);
  a later auth gets `Authentication failed: Capability revoked`. Capability auth
  failures never trigger the server-token IP ban (T0449). `pty:restart` keeps
  the Worker / Tower role (T0448); a server restart invalidates every capability.

**End to end** (`electron/remote/__tests__/headless-remote-tower-e2e.test.ts`
runs this on a real headless server with real node-pty, the helpers executing
inside the PTYs):

1. Tower tab runs
   `"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" --skill ct-exec --workorder T####`
2. The server creates the Worker PTY (with its own Worker capability) and
   broadcasts `terminal:created-externally`; the client opens the tab in the
   Tower's window and workspace (a remote event for an unknown workspace is
   ignored, never redirected to the active one).
3. The Worker finishes and runs `bat-notify.mjs --submit "T#### 完成"`:
   `terminal:notified` (toast + badge), the text is pre-filled into the Tower
   PTY, and `terminal:keypress` makes the client synthesize Enter on its xterm.

**Limits**

- Prefer **agent mode** (`--skill ct-exec --workorder T####`, or `--prompt`).
  The raw-command form `bat-terminal.mjs claude "/ct-exec T####"`
  (`terminal:create-with-command`) is allowed since T0579, but it types the
  command into the remote login shell as is: `claude` comes from the remote
  user's own `PATH` (the bundle's embedded claude is not on it), there is no
  `AGENT_UNAVAILABLE` check, and the work order is not recorded, so
  `--close-worker` cannot find the Worker.
- `--submit` needs a connected BAT client (the Enter is synthesized by its
  renderer). With none, `terminal:keypress` answers `no-client` and `bat-notify`
  exits 1 — yolo mode never claims a submit that did not happen; the
  pre-filled text is still in the Tower PTY.
- `node` is not necessarily on the remote `PATH` (the WSL test host has none).
  Use the bundle's own node, `"${BAT_HELPER_NODE:-node}"` (T0456; on a server
  deployed before T0456, `"$BAT_HELPER_DIR/../bin/node"`). Since T0456
  `<installRoot>/bin` is also appended to the PTY's `PATH`, so a bare `node`
  works too — unless the login shell's profile resets `PATH` (e.g. Debian's
  `/etc/profile`), which is why `BAT_HELPER_NODE` is the reliable form.
- `bat-terminal.mjs` exits 1 whenever the terminal was not created — including
  a plain `false` answer from the server (T0456; it used to print
  `✓ Terminal created` and exit 0). The Tower trusts only the exit code.
- The server bundle ships no Codex: dispatching `codex-cli` where the server
  cannot find codex returns `AGENT_UNAVAILABLE` (`AGENT_CHECK_PENDING` while
  detection runs — retry). The Codex panel does not support remote windows;
  run the Codex CLI in a terminal tab.
- **codex shared daemon** (T0651 / BUG-159): a remote codex CLI tab that gets
  no BAT MCP arguments (BAT MCP off in the remote Settings, helpers missing
  under `<installRoot>/scripts`, or custom args that define `mcp_servers.bat`)
  is started with `--no-daemon` when the server's `codex --version` is
  `>= 0.156.0`, so it does not run on a shared codex daemon that carries
  another tab's `BAT_*`. Custom args with `--no-daemon`, `daemon_auto_start` or
  `--remote`, and helper-dispatched Workers, are left alone. The decision is the
  same function as on a local BAT (`buildBatMcpLaunchArgs`); details in
  [docs/agent-guide/bat-mcp-shim.md](./agent-guide/bat-mcp-shim.md) ("codex
  共用 daemon"). Not tested against a real remote codex daemon.
- The control-tower skills must be installed in the remote `~/.claude/skills`.
- Remote events reach only the windows of the profile whose connection
  received them. Since PLAN-039 every remote profile keeps its own connection,
  so a WSL and an SSH window opened together both get their Tower / Worker
  events (see [Several remote profiles at once](#several-remote-profiles-at-once-plan-039)).
  Two profiles pointing at the **same** server each hold a connection, so a
  Worker's `--submit` reaches both windows' renderers and the Tower PTY can get
  the Enter twice (known limitation; BAT logs a warning when such a pair connects).

**Verify a deployed server:** `npm run smoke:remote:headless` S13 (above).
Remote shell check (key names only):
`env | grep ^BAT_ | cut -d= -f1 | sort`.

## Remote tools: Node.js via nvm (T0555)

The remote tools panel (PLAN-037) installs Node.js with
[nvm](https://github.com/nvm-sh/nvm), in user space, like uv for Python.

- **Install** (Linux and macOS SSH targets, any package manager, no sudo):
  `export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && mkdir -p "$NVM_DIR" &&
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | METHOD=script bash &&
  . "$NVM_DIR/nvm.sh" && nvm install --lts && nvm alias default 'lts/*' && <login profile block, below>`.
  The nvm release is pinned (`NVM_VERSION_TAG`, `src/lib/remote-tools/recipes.ts`);
  `METHOD=script` fetches `nvm.sh` from the same tag with curl (no git, no macOS
  Command Line Tools prompt). nvm checks Node.js against nodejs.org `SHASUMS256.txt`.
  nvm appends its loader to `~/.bashrc` (or `~/.zshrc` / `~/.profile`).
- **Update** (shown only for an nvm-managed node): ensures the login profile block first,
  then newest LTS with `--reinstall-packages-from=current`, `default` moved to `lts/*`;
  already on the newest LTS → prints so and exits 0. The old version stays installed.
  A host set up by T0555 (no block yet) gets the block from one Update.
- **Login profile block** (T0556, `NVM_PROFILE_COMMAND`): appended to the file a bash
  login shell reads — the first of `~/.bash_profile`, `~/.bash_login`, `~/.profile` that
  exists (bash reads only that one); `~/.profile` is created when none does. Same rule on
  macOS; zsh's `~/.zprofile` is not touched (zsh users get nvm from the `~/.zshrc` nvm
  writes). The block, between `# >>> nvm loader for login shells (added by
  BetterAgentTerminal) >>>` and the matching `<<<` line, is:

  ```sh
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ "$(command -v nvm 2>/dev/null)" != nvm ] && [ -s "$NVM_DIR/nvm.sh" ]; then command . "$NVM_DIR/nvm.sh" >/dev/null 2>&1; fi
  ```

  - Appended only when the begin marker is not in the file yet (`grep -F`), so repeated
    installs / updates add nothing; nothing else in the file is changed. Remove the
    block by hand to undo it.
  - POSIX `sh` (also read by `sh -l` / dash). Loads only when `nvm` is not a shell
    function yet: an interactive login shell has loaded it from `~/.bashrc` (Ubuntu's
    `~/.profile` sources `~/.bashrc` first), so it is not loaded twice. An `nvm` program
    on PATH (nvm-windows seen through WSL interop / Git Bash) does not count.
  - `command .`: a syntax error in a dot script ends a non-interactive POSIX shell
    (dash, bash as `sh`); through `command` only the dot fails. Output is discarded, so a
    missing or broken nvm leaves logins unchanged.
  - `sh -lc` reads only `~/.profile`: with a `~/.bash_profile` present the block is in
    `~/.bash_profile`, so `bash -lc` finds node and `sh -lc` does not.
- **A node that nvm does not manage** (apt's 18.x, for example) is shown with its
  version and an "Install LTS with nvm" button next to it; the system node is never removed.
- **Alpine / musl**: no button (nodejs.org has no musl build; nvm would compile from
  source). The row links the nodejs.org download page.
- **Detection**: the login-view probe loads `${NVM_DIR:-$HOME/.nvm}/nvm.sh` in a child
  `/bin/sh` (8 s limit, a broken `nvm.sh` cannot end the probe) and reports `nvm --version`
  plus the node nvm activates; that node is used when it is under `$NVM_DIR/versions/node/`.
  The report carries `nvm: { version }` and `nvmManaged` on the node row. A WSL hit under
  `/mnt/<drive>/` is still `interop-only`. Needs a server with the T0555 probe; older
  servers still report node, without the nvm fields.
- **Non-interactive shells**: BAT terminals (`-l -i`), the detection and, with the login
  profile block (T0556), non-interactive login shells (`bash -lc`, `sh -lc`) see nvm's node.
  Without the block a plain `bash -lc` on Ubuntu does not: the stock `~/.bashrc` returns
  before nvm's loader for non-interactive shells. A non-login, non-interactive shell
  (`bash -c`) still does not load nvm.
- Real-machine check: `e2e/t0555-node-nvm-wsl.spec.ts` (`BAT_E2E_T0555=1`, installs
  into the distro; deploy the server JS first with `npm run deploy:headless:dev -- --target wsl:<distro> --yes`).
  The T0556 Update check in the same file (`BAT_E2E_T0556=1`) needs a distro that already
  has nvm: it presses Update twice and checks that the block is added once and that
  `bash -lc` / `sh -lc` find node. Unit and real-shell tests:
  `src/lib/remote-tools/__tests__/recipes.test.ts`, `nvm-login-profile.test.ts`.

## Troubleshooting (cross-cutting)

For environment-specific troubleshooting see the per-env guides. The issues
below appear regardless of which deployment path you picked.

### Connection lost after sleep / network change

After a connection that had succeeded drops, the client reconnects
automatically with a delay of `min(30 s, 1 s × 2^n)` plus up to 1 s of jitter
(`computeReconnectDelay`, `electron/remote/remote-client.ts`). The profile card
shows "Reconnecting…". There is no dialog: while the window is not connected,
actions in it are refused, never run locally, and the first one shows
"This remote window is not connected, so the action was not run …". For SSH,
5 consecutive tunnel start failures stop the retries and the card shows
"Connection lost — the profile window is open but not connected"; close the
window, wait 15 s, and open the profile again (see
[SSH: Disconnects after a while](./ssh-deployment.md#disconnects-after-a-while)).

### Fingerprint mismatch

If the server's data directory was wiped or the server was set up again with
a new certificate, the pinned fingerprint no longer matches. BAT closes the
connection before sending the token, shows "Remote profile not trusted", and
the card's status reads "fingerprint mismatch".

1. Confirm the change was yours (a reinstall, a new container). If not, stop
   and find out why: a mismatch is what a man-in-the-middle looks like.
2. **Re-pin in place**: card ⚙ → **Edit connection** → the pin button next to
   the fingerprint field. Since BUG-157 (T0650) the pinned value stays when you
   then click Save, and a failed pin shows the reason in the dialog and writes
   nothing. Two things to know:
   - The pin is TOFU: it connects with the profile's **saved** host, port and
     token, without an expected fingerprint, accepts whatever certificate
     answers, and sends the token to it. Use it only when you know the server
     is yours.
   - It uses the saved connection data, not unsaved edits in the dialog. To
     change host or token too, save first, then pin.
3. **Or run the wizard again**: WSL and SSH update the same profile's
   fingerprint **and token** (needed when the token changed as well). Docker
   creates a new profile; delete the old one.

### Legacy remote profiles (no `targetOS`)

Profiles created before PLAN-007 have `targetOS: undefined`. They still
connect, with identity path translation. The profile card shows a warning
banner with a `targetOS` dropdown (`wsl-linux`, `docker-linux`, `ssh-linux`,
`ssh-darwin`); picking a value saves it. A wizard run also writes `targetOS`
and the environment fields (`wslDistro`, `dockerMounts`, `serverHome`).

### Wizard failure mid-flow

A failed step offers its actions (Retry / Skip / Cancel / Edit settings or a
recovery button). **Cancel** — or a step that cannot be retried, such as
`write-profile` — runs the rollback chain (see
[Rollback chain](#rollback-chain-best-effort)): a profile this run created is
deleted, a profile it updated is restored, and the server is left as it was
before the wizard. You can then start the wizard again from the
**+ More ▾** menu.

## Links

- [WSL Deployment Guide](./wsl-deployment.md) — prerequisites (systemd), the
  nine steps, port picking, keepalive, upgrade, rollback, removal, pre-flight
  checklist.
- [SSH Deployment Guide](./ssh-deployment.md) — key-only login,
  `~/.ssh/config` aliases, the eight steps, tunnel-only transport, systemd vs
  launchd, upgrade, rollback, removal, e2e checklist.
- [Docker Deployment Guide](./docker-deployment.md) — building the image, the
  two container modes, port picking, rollback, lifecycle scenarios, pre-flight
  checklist.
- [Server bundle distribution](./server-bundle-distribution.md) — cache,
  download, local tarball import, `BAT_SERVER_BUNDLE_BASE_URL`.
- [PLAN-007 Release Checklist](./plan-007-release-checklist.md) — release
  pre-flight across environments.
- Agent guides: [remote security](./agent-guide/remote-security.md),
  [remote Tower notification](./agent-guide/remote-tower-notify.md),
  [multiple remote profiles](./agent-guide/multi-remote-profiles.md),
  [BAT MCP shim](./agent-guide/bat-mcp-shim.md).
