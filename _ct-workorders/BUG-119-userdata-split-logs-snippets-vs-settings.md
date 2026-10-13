---
schema_version: 1
schema_kind: bug
id: BUG-119
title: "userData 分裂：snippet-db 在 import 時取 getPath('userData')（早於 app.setName），日誌 / Crashes / snippets.json 落在 better-agent-terminal/，設定落在 BetterAgentTerminal/；runtime 實例共用 snippets、helper 找錯 runtime 目錄"
status: FIXING
severity: medium
reproducibility: always
created_at: "2026-10-13T22:19:21+08:00"
updated_at: "2026-10-13T22:32:56+08:00"
impact:
  - data-location
  - snippets
  - logging
  - multi-runtime
links:
  discovered_in: T0478
  research_workorder: T0479
  fix_workorder: [T0480, T0481, T0482]
  related: [BUG-116, T0478]
---

# BUG-119 — userData 分裂成兩個目錄

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（使用者找不到日誌 / 備份不完整；runtime 實例 snippets 互相干擾；改動牽涉既有資料搬移） |
| 可重現 | 必現（Windows 本機實證；mac / Linux 依 Electron PathService 語意推導） |
| **狀態** | ⏳ FIXING（T0480 / T0481 / T0482，D138） |
| 回報者 | 塔台（T0478 Worker 查證時發現） |

## 證據（T0478 回報區）

- `electron/snippet-db.ts:45`、`:189`：`snippetDb` 單例在 import 時呼叫 `app.getPath('userData')`，早於 `electron/main.ts:158` `app.setName('BetterAgentTerminal')`
- Chromium PathService 第一次 `getPath('userData')` 依當下 app name（`package.json` `name` = `better-agent-terminal`）計算並快取；`setName` 不清快取；任何 `app.setPath(...)`（`main.ts:1402` `setPath('crashDumps')`）才清快取，之後改用 `BetterAgentTerminal`。Electron 41.2.1 probe 實測重現
- `logger.init(app.getPath('userData'))`（`main.ts:1399`）在 `setPath('crashDumps')` 之前 → 日誌在小寫目錄
- 本機：`%APPDATA%\BetterAgentTerminal\` 有 `settings.json` / `windows.json` / `profiles/` / `server-cert.json` / `server-token.json` / `whisper-models/`；`%APPDATA%\better-agent-terminal\` 有 `Logs/`、`Crashes/`、`lockfile`、`snippets.json`
- 衍生：
  1. `BAT_RUNTIME` 實例的 `snippetDb` 路徑在 runtime override（`main.ts:160-171`）之前決定 → 所有 runtime 實例共用預設實例的 snippets（推導）
  2. `scripts/_bat-logger.mjs:10-12`、`scripts/_bat-cert.mjs:20` 假設 `BetterAgentTerminal[-runtime-<N>]`；runtime 實例實際可能是 `better-agent-terminal-runtime-<N>`（推導）→ helper 找錯 cert / log 目錄
- README / CLAUDE.md 已於 T0478 依現況描述兩個目錄（文件面已處理，產品行為未改）

## 修正方向（待塔台 / 使用者裁決）

- 讓 `setName` 早於任何 `getPath('userData')`（例如 `snippetDb` lazy 初始化，或 `setName` 移到所有 import 之前的入口模組），統一到 `BetterAgentTerminal/`
- **必須同時設計搬移**：舊 `better-agent-terminal/snippets.json` → 新位置（不覆蓋既有、只搬一次、留紀錄）；`Logs/` 可不搬；runtime 實例另議
- 同步確認 helper scripts 的目錄假設與實際一致

## 處置

2026-10-13 22:20：使用者裁決「先研究再修」→ 研究單 **T0479**（呼叫時序盤點、runtime 實測、統一方案比較、搬移規則、實作單拆分）。

## T0479 研究結論（2026-10-13 22:32）

- 統一到 `<appData>/BetterAgentTerminal[-runtime-<N>]/`；bootstrap 為 `main.ts` 第一個 import，ready 前同步 migration 後顯式 `setPath('userData')`（D138）
- 🔴 `Local State`（safeStorage 金鑰）必須在 ready 前複製，否則 `server-token.json` 解不開 → 遠端全部重配
- 衍生症狀補記：啟動時日誌設定被忽略（`readLoggingConfigSync` 讀小寫目錄的 `settings.json`）；`message-archives/` 落小寫；`bat-scripts.log` 分成兩份（main mirror 小寫、helper 大寫）
- runtime 實例整個在 `better-agent-terminal-runtime-N`（R2 實證，不分裂）；helper 在 `--runtime=N` 時找錯 cert（PTY 無 `BAT_RUNTIME`）
- 修復拆單：T0480（A 核心）∥ T0481（B helper env）→ T0482（C 文件）
