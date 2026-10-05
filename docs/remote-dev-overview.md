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
- The node helpers the server bundle ships (`serverBundleHelperScripts` in
  `scripts/build-server-bundle.mjs`: `bat-terminal.mjs`, `bat-notify.mjs` and
  their imports) are deployed too, into `<installRoot>/scripts/` (created when
  missing; listed as `scripts/<name>`, same `.bak-<tag>` / `.absent` /
  `--rollback` rules). Without them a remote PTY gets no helper env — see
  [Remote Tower notification](#remote-tower-notification-plan-036-k). A
  `scripts/` dir created by a deploy stays (empty) after `--rollback`.

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
| S11 | `github:check-cli` (up to 20 s; the server runs `gh auth status`, a network check) answers `installed: true` with a boolean `authenticated` (the WSL test host is not logged in ⇒ `false`); then, through a second smoke PTY, the smoke creates its own temp repo `mktemp -d /tmp/bat-smoke-git.XXXXXX` with one empty commit, checks `git:getRoot` / `git:branch` / `git:log` / `git:status` / `git-scaffold:healthCheck` against it and `worktree:status` of an unknown session (`null`), then removes the repo and kills that PTY (fails with "server predates T0405" against older servers) |
| S12 | the headless fs sandbox: through a third smoke PTY the smoke creates its own temp dir `mktemp -d /tmp/bat-smoke-fs.XXXXXX` holding `smoke.txt`; before any sync `fs:readdir` returns `[]` and `fs:readFile` is denied; `workspace:sync-roots(['/', dir])` accepts only the dir and rejects `/` as a filesystem root; then `fs:readdir` / `fs:readFile` / `fs:stat` read the dir while `fs:readdir('/etc')` and `fs:readFile('/etc/hostname')` stay denied. Cleanup clears this connection's roots, removes the dir and kills that PTY (fails with "server predates T0406" against older servers, after a read-only `fs:stat` probe — nothing is created) |
| S13 | the remote Tower path (PLAN-036 K): in a fourth smoke PTY the `BAT_*` key names (values are never printed) are exactly the remote-tab set of [Remote Tower notification](#remote-tower-notification-plan-036-k), no env value equals the server token (compared as sha256 — the token itself is never typed) and `BAT_REMOTE_TOKEN` has a capability's length; then the real `bat-terminal.mjs` runs **inside that PTY** with its env (bundle node `$BAT_HELPER_DIR/../bin/node`, else `node`): a raw command must be refused with `Forbidden: channel-not-allowed`, and an agent id no server registers must reach `terminal:create-agent-command` with the tower role and create nothing (`Forbidden: agent-not-allowed` since T0450). No agent is ever started. A server without helper env (before T0433, or helpers not deployed) is a **SKIP that does not fail the run** |

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

**Capability scope** (`electron/remote/helper-capability.ts`, default deny):

- **Tower** (PTY without a notify target): only `terminal:create-agent-command`,
  for a **new** terminal id whose notify target is the Tower itself, a registry
  agent (unknown id → `agent-not-allowed`), the host's default shell and only the
  `customEnv` keys bat-terminal sends; at most 8 live children and one creation
  per second (T0450).
- **Worker** (PTY with `BAT_TOWER_TERMINAL_ID`): only `terminal:notify`,
  `pty:write` (printable text only — submitting is `terminal:keypress`) and
  `terminal:keypress`, all targeting its own Tower.
- Everything else (`pty:create`, `terminal:create-with-command`, `fs:*`,
  `git:*`, `claude:*`, …) → `Forbidden: channel-not-allowed`. Helper
  connections receive no broadcasts and do not count as clients for the orphan
  PTY reclaim.
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

- Dispatch in **agent mode** (`--skill ct-exec --workorder T####`, or
  `--prompt`). The raw-command form used locally,
  `bat-terminal.mjs claude "/ct-exec T####"`, is
  `terminal:create-with-command` and is always `Forbidden: channel-not-allowed`
  for a capability.
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
  detection runs — retry).
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
