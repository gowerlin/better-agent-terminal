# Changelog

All notable changes to Better Agent Terminal are documented in this file.

## [Unreleased]

### Added
- **PLAN-007 Phase 1–5 — Remote dev support across four environments**
  (`local`, `wsl-linux`, `docker-linux`, `ssh-linux` / `ssh-darwin`). BAT
  terminal now drives AI agents in a remote BAT server installed via a
  unified setup wizard that installs the bundle, registers the service,
  pins the TLS fingerprint, and verifies connectivity end-to-end.
- **SSH deployment** — full SSH wizard with `~/.ssh/config` alias detection,
  key-based authentication (with permission-denied recovery), tunnel mode
  (default, NAT-friendly) and direct mode (advanced), and a multi-arch
  server bundle matrix covering `linux-x64`, `linux-arm64`, and
  `darwin-arm64`. Backed by `SshTunnel` with exponential-backoff
  reconnect (1s → 2s → 4s → 8s → 16s) and `SshPathTranslator` for
  cross-OS chat-context attachments (Windows client → linux/darwin server).
- **Setup wizard rollback contract (C-3, best-effort)** — every wizard step
  registers a rollback handler; on failure or cancellation, the runner
  walks completed steps in reverse and invokes each handler. Profiles are
  **not** persisted unless the wizard reaches `done` cleanly. Coverage:
  `tests/wizard-rollback.test.ts` + `tests/wizard-rollback-cross.test.ts`.
- **ProfileCard UI (C-7)** — ProfilePanel refactored to a list of
  `ProfileCard` components with a per-environment **Details** slot. Each
  card surfaces the bound profile, `targetOS`, pinned TLS fingerprint, and
  a **Re-run wizard** entry point. Consistent UI across local / WSL /
  Docker / SSH cards.
- **Server bundle CI workflow** —
  `.github/workflows/build-server-bundle.yml` now ships server bundle
  artifacts independently of the desktop release pipeline. Three platform
  matrix entries (`linux-x64`, `linux-arm64`, `darwin-arm64`) publish
  `bat-server-<platform>-v<version>.tar.gz` per release.
- **Cross-environment overview docs** —
  `docs/remote-dev-overview.md` (decision tree, comparison table, common
  concepts) plus `docs/plan-007-release-checklist.md` (release engineer
  pre-flight checklist covering all four environments and the rollback
  contract).

### Changed
- **ProfilePanel** rewritten as a list of `ProfileCard` rows with per-env
  details slot, replacing the previous flat key/value layout. Editing flow
  routes through the matching wizard via the **Re-run wizard** button.
- **PathTranslator framework** — new abstraction with five concrete
  translators (`IdentityTranslator` for `local` and undefined-target
  profiles, plus `WslPathTranslator`, `DockerPathTranslator`, and
  `SshPathTranslator` for the remote environments). Pure functions over
  profile metadata, individually unit-tested.
- **RemoteClient middleware** — gained an SSH tunnel chain hook so the SSH
  transport can reuse the same reconnect / fingerprint-pin / health-check
  pipeline as the WSL and Docker transports.

### Fixed
- **BUG-060 — YOLO chained-shell preference loss** — fixed in session 31
  (commit `fad2978`). Worker chained-shell preference no longer drops on
  successive YOLO mode workorders.

### Known issues
- **BUG-061 — `CodexAgentPanel.tsx` baseline TypeScript errors** — pre-existing
  baseline `tsc` errors in `CodexAgentPanel.tsx` are surfaced by the
  `feature/plan-007-remote-dev` branch but **do not affect runtime**. They
  are dev-only and tracked separately; PLAN-007 explicitly excludes their
  cleanup from scope.

## [0.4.1] — 2026-04-26 — PLAN-007 Patch Chain: Remote Dev Hardening

Patch release on top of v0.4.0 closing the seven follow-up BUGs (BUG-062 ~ BUG-068) raised against PLAN-007 remote-dev. All fixes preserve TypeScript baseline (36 errors, all pre-existing in `CodexAgentPanel.tsx` per BUG-061) and ship 250+ green unit tests across SSH lifecycle, path translation, wizard rollback, and remote-client middleware.

### Fixed
- **BUG-062** (F-006, T0300): `RemoteClient` `fingerprint-mismatch` handler now early-returns after emitting the failure callback so the WebSocket open path cannot still settle the connection on a pinned-but-mismatched server.
- **BUG-063** (F-007 + EC-009, T0299): SSH child processes (`ssh-tunnel`, `ssh-start-server`, `ssh-auth-probe`) now share `electron/remote/ssh-process-lifecycle.ts::shutdownSshProcess`, providing SIGTERM → SIGKILL escalation with grace + timeout windows so a wedged `ssh` cannot leak past disconnect / reconnect.
- **BUG-064** (F-008, T0301): SSH spawns inject `LANG=C LC_MESSAGES=C LC_ALL=C` via shared `buildBaseSshSpawnEnv()` so stderr matchers see English-only error strings regardless of host locale (auth-probe / tunnel / start-server / bundle-uploader).
- **BUG-065** (EC-004, T0301): `translateInvokeArgs` is now schema-driven through `PATH_ARG_SCHEMA` in `electron/remote/path-aware-channels.ts`, lifting the prior "first string only" limitation. Multi-path channels (e.g. `git:diff-files`, `fs:copy`) now translate every path argument according to the channel’s declared shape.
- **BUG-066** (EC-005, T0300): `WizardRunner.run()` resets `runPromise = null` on failure so a wizard that crashes mid-run (e.g. SSH key auth denied) can be retried without reloading the renderer.
- **BUG-067** (EC-006, T0299): `RemoteClient.disconnect()` is now `async` and awaits `tunnel.stop()` before resolving so the next `connect()` does not race a half-dead SSH forwarder.
- **BUG-068** (EC-007, T0300): `RemoteClient.invoke` freezes the translator reference at the start of the call and reuses it for both args translation and result normalisation, preventing translator swap-races across long-lived `invoke` round-trips.

### Internal
- New shared helper: `electron/remote/ssh-process-lifecycle.ts` (`shutdownSshProcess`).
- New schema table: `PATH_ARG_SCHEMA` in `electron/remote/path-aware-channels.ts` (centralises per-channel path-arg shapes).
- New / extended tests:
  - `tests/ssh-process-lifecycle.test.ts` (new, 6 cases — SIGTERM/SIGKILL/timeout matrix).
  - `tests/path-aware-channels.test.ts` (new + extended, 9 cases — schema-driven multi-path).
  - `tests/remote-client-middleware.test.ts` (extended, 21 cases — fingerprint-mismatch gate + invoke translator freeze).
  - `tests/wizard-runner.test.ts` (extended, 5 cases — failure-retry).
  - `tests/ssh-args.test.ts` (extended, 15 cases — `buildBaseSshSpawnEnv` env injection).
- TypeScript baseline drift: **0** (36 errors pre/post, all in `CodexAgentPanel.tsx` per BUG-061).
- Aggregate suite (v0.4.1 critical + neighbours): **250+ pass / 0 fail**.

### Known
- **BUG-061** — `src/components/CodexAgentPanel.tsx` baseline `tsc` errors persist (dev-only, runtime unaffected). Cleanup tracked separately; out of scope for the v0.4.x line.

## [0.3.1] — 2026-04-23 — Hotfix: Packaged Helper Bundle

Hotfix release addressing BUG-058 (v0.3.0 NSIS installer shipped without two required helper scripts) and adding a build-time guard to prevent future regressions of the same class.

### Fixed
- **BUG-058 packaged NSIS installer missing `_bat-logger.mjs` and `_bat-cert.mjs`** — `package.json` `build.extraResources[0].filter` was a strict whitelist that only included `bat-terminal.mjs` and `bat-notify.mjs`, dropping their ESM relative imports. Switched to glob whitelist `["*.mjs"]` so every top-level `scripts/*.mjs` helper is bundled (commit `a460d8b`).

### Added
- **Build-time fail-fast guard against helper bundle drift** (`scripts/verify-helper-bundle.js`) — statically parses every `scripts/*.mjs` relative `.mjs` import and checks that each target is covered by `package.json` `build.extraResources[].filter`. Missing coverage aborts the build before vite / electron-builder with a pointer to the offending helper and a suggested filter pattern. Wired into `npm run build`, `npm run build:dir`, and `npm run build:release` via `scripts/build-version.js`, plus a standalone `npm run verify:helpers` entry point. Scope is deliberately narrow (top-level `.mjs` + static imports) to keep false positives low (commits `a73a965` + `1009154`).

## [0.3.0] — 2026-04-23 — Multi-Agent Runtime, Supervisor Mode & GPU Voice Acceleration

First production release of the `gowerlin/better-agent-terminal` fork. Consolidates all pre-release work from `v0.0.x` and `v0.2.x` into a stable baseline.

### Added

#### GPU Voice Acceleration (PLAN-004 Phase 1, EXP-GPUWHIS-001)
- **Vulkan-first voice transcription acceleration on Windows and Linux** — zero-configuration GPU acceleration across NVIDIA, AMD, and Intel Arc via `@kutalia/whisper-node-addon` Vulkan backend
- **Runtime GPU detection** (`electron/gpu-detector.ts`) — auto-detects Vulkan-capable GPUs and falls back to CPU gracefully when no supported hardware is present
- **Settings UI toggle** for GPU acceleration with detected-hardware readout
- **Cross-vendor zero-config** — no CUDA SDK install required; any Vulkan 1.3+ GPU works out of the box
- **macOS Metal GPU** — already enabled in earlier pre-release via upstream `whisper-node-addon` prebuilt; unchanged in v0.3.0

#### Build Safety Net (T0243 — BUG-056 prevention)
- **Build fail-fast guard** (`scripts/verify-native-modules.js`) — `npm run build`, `npm run build:release`, and `npm run build:dir` now abort before vite build / electron-builder if required native modules (`@kutalia/whisper-node-addon`, `@lydell/node-pty`, `better-sqlite3`) are missing from `node_modules/`. Prevents the BUG-056 class of failure where a squash merge updated `package-lock.json` but stale `node_modules/` shipped a broken installer.
- **CI verify step** — `.github/workflows/pre-release.yml` runs the same guard on all three platform jobs (Windows / macOS / Linux) between `@electron/rebuild` and `build-version.js`.

#### Claude Runtime Selection (PLAN-027)
- **Choose between embedded and system Claude CLI** — BAT now ships with an embedded Claude CLI but also lets you opt in to your system-installed `claude` binary
  - **Where**: `Settings → Advanced → Claude Runtime`
  - **Why**: Use bleeding-edge Claude CLI features (new models, new effort levels) without waiting for a BAT release
  - **Safety net**: Automatic fallback to embedded if the system runtime fails health checks (toast notifies you with the degraded reason)
  - **Custom path**: Point to any absolute path to a `claude` binary instead of PATH lookup
  - **Scope**: Changes apply to new sessions and new terminals only; existing sessions continue on their original runtime
- **Windows note**: `npm install -g` produces `.cmd` / `.bat` shims that are intentionally not detected (Node 20+ spawn restrictions). Install via the Anthropic official installer so `claude.exe` lands in `%USERPROFILE%\.local\bin\`.
- **Cross-platform install + troubleshooting playbook**: `docs/plan-027-cross-platform-verification.md`

#### Multi-Agent Runtime (Phase 0 + Phase 1)
- **Universal agent registry** — Provider-based architecture supporting Claude Code, Gemini CLI, GitHub Copilot CLI, Codex CLI, and any user-defined custom CLI
- **Agent runtime module** (`electron/agent-runtime/`) with `AgentDefinition`, `AgentProvider`, and `AgentCapabilities` types
- **9 built-in agent definitions** with correct launch commands, sandbox/yolo flag handling, and capability declarations
- **Custom CLI management UI** in Settings panel — add/remove custom CLI agents with name, command, icon, color, and sandbox/yolo configuration
- **Custom CLI persistence** — saved to `{userData}/custom-clis.json`, loaded on app start
- **Dynamic "+" menu** — ThumbnailBar populates agent options from the registry instead of hardcoded list
- **Agent IPC API** — 8 `agent:*` IPC handlers for querying definitions, building launch commands, and managing custom CLIs
- **Frontend agent types** (`src/types/agent-runtime.ts`) with helper functions for capability checking

#### Supervisor Mode
- **Terminal roles** — `TerminalInstance.role` field supports `'worker'` (default) and `'supervisor'`
- **Right-click context menu** on terminal thumbnails to set/remove supervisor
- **Supervisor badge** (👁) displayed on thumbnail and main panel header
- **Golden border** visual indicator on supervisor thumbnail
- **Worker Panel** component — shows all non-supervisor terminals with:
  - Worker name, agent icon, alive/dead status indicator
  - Last few lines of worker output (auto-refreshes every 3 seconds)
  - Quick-send input field to type commands into any worker's PTY
- **PTY output ring buffer** — stores last 50 lines per terminal for supervisor queries
- **Cross-terminal IPC** — `supervisor:list-workers`, `supervisor:send-to-worker`, `supervisor:get-worker-output`
- **One supervisor per workspace** — setting a new supervisor auto-demotes the previous one

#### Launch Improvements
- **`launch.bat`** — one-click compile + launch script for Windows
- **`launch-hidden.vbs`** — VBS wrapper that runs launch.bat with a hidden console window
- **Start Menu shortcut** — launches via `wscript.exe` for a clean desktop experience

### Fixed

#### Performance Optimizations
- **Terminal flickering** — removed double nested `requestAnimationFrame` and `clearTextureAtlas()` call that forced GPU texture rebuild on every visibility toggle
- **Redundant rendering** — removed `terminal.refresh(0, rows-1)` in ResizeObserver callback that duplicated xterm's built-in re-render after `fitAddon.fit()`
- **Triple resize cascade** — removed unnecessary IntersectionObserver that fired extra `doResize()` on visibility change (already handled by `isActive` effect)
- **MutationObserver layout thrashing** — debounced IME textarea position fix with `requestAnimationFrame` instead of running synchronously on every xterm style mutation
- **PTY data flooding** — added 16ms output batching via `enqueuePtyOutput()` / `flushPtyOutputs()` to coalesce rapid PTY data chunks before IPC broadcast
- **Preview cache thrashing** — batched `stripAnsi()` processing (7+ regex patterns) via RAF so all pending data is processed once per frame instead of per-chunk
- **Activity notification storm** — changed `updateTerminalActivity` from array recreation + 500ms throttle to in-place mutation + 2s throttle

#### Bug Fixes
- **defaultAgent persistence** — fixed `settings-store.ts` `load()` method that was stripping `defaultAgent` on every app start via `delete parsed.defaultAgent`
- **BUG-056 packaged NSIS installer missing `@kutalia/whisper-node-addon`** — squash-merging the EXP-GPUWHIS-001 experiment into main updated `package.json` / `package-lock.json` but did not sync the root repo's `node_modules/`, so the NSIS installer shipped without the native module and crashed at startup with `Cannot find module '@kutalia/whisper-node-addon'`. Fixed by reinstating `npm install` + native rebuild in the release flow; combined with the new build fail-fast guard above, this class of regression is blocked going forward.
- **BUG-057 voice transcription forcibly translated to English** — a default-value change inside `@kutalia/whisper-node-addon` (`translate` flipped from `false` to `true` without changelog notice) caused Traditional Chinese (and all other source-language) voice input to be translated to English output. Voice handler now passes `translate: false` explicitly (`electron/voice-handler.ts`) to preserve source-language transcription regardless of the addon's default.

### Changed
- **WorkspaceView** — unified `handleAddAgent()` handler replaces separate per-agent handlers; resolves agent command from registry
- **MainPanel** — capability-based rendering (shows Claude-specific UI only for integrated agents)
- **TerminalThumbnail** — falls back to agent registry for icon/color when preset not found (supports custom CLIs)
- **ThumbnailBar** — props interface expanded with `onSetSupervisor` / `onClearSupervisor` callbacks
- **workspace-store** — added `setSupervisor()`, `clearSupervisor()`, `getSupervisor()`, `getWorkers()` methods
- **pty-manager** — added `getLastOutput()`, `writeToTerminal()`, `isAlive()` methods for cross-terminal communication
- **README.md** — updated with multi-agent architecture docs, supervisor mode docs, custom CLI docs, and updated architecture tree
