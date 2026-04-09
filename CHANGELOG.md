# Changelog

All notable changes to Better Agent Terminal are documented in this file.

## [Unreleased] — Multi-Agent Runtime & Supervisor Mode

### Added

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

### Changed
- **WorkspaceView** — unified `handleAddAgent()` handler replaces separate per-agent handlers; resolves agent command from registry
- **MainPanel** — capability-based rendering (shows Claude-specific UI only for integrated agents)
- **TerminalThumbnail** — falls back to agent registry for icon/color when preset not found (supports custom CLIs)
- **ThumbnailBar** — props interface expanded with `onSetSupervisor` / `onClearSupervisor` callbacks
- **workspace-store** — added `setSupervisor()`, `clearSupervisor()`, `getSupervisor()`, `getWorkers()` methods
- **pty-manager** — added `getLastOutput()`, `writeToTerminal()`, `isAlive()` methods for cross-terminal communication
- **README.md** — updated with multi-agent architecture docs, supervisor mode docs, custom CLI docs, and updated architecture tree
