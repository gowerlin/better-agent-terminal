---
schema_version: 1
schema_kind: workorder
id: T0386
title: "研究：headless bat-server 功能 handler 層（PLAN-036）—— Electron 解耦、共用 handler 架構、分階段拆單"
type: research
status: TODO
priority: P1
sizing: M
created_at: "2026-10-04T23:34:17+08:00"
updated_at: "2026-10-04T23:34:17+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "PLAN-036（本研究服務的計劃）"
  - "T0385 回報區 A-2 差異表 / B-2 缺口 / C 交付路徑"
  - "BUG-094"
  - "_spec-remote-dev-support-2026-04.md §2.3（未落地的 handlers/ 設計）"
  - "PLAN-015（雙 render path 共用 helper，同類『雙實作漂移』問題）"
affects_files: []
interaction:
  mode_hint: on
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究工單，不改產品程式碼、不 commit 本工單檔以外任何檔案**。PoC / 實驗腳本放 scratchpad，結束前清乾淨。"
  - "🔴 不得停止、重啟或改寫使用者 WSL 內的 `bat-server.service` / `~/.local/bat-server`（塔台 23:34 剛部署 T0385 JS 供使用者驗收）；不得 `wsl --shutdown` / `--terminate`。本機 headless 實驗用 scratchpad + 非 9876 / 9877 埠。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設。禁用 shell-spawning exec API。"
  - "⚠️ T0387（BUG-093 SSH 精靈 tunnel）平行執行中，會改 `src/components/setup-wizard/` 與 SSH tunnel 相關檔；本研究唯讀，不受影響。"
---

# T0386 — 研究：headless 功能 handler 層

## 元資料

- **類型**：research
- **互動**：允許（每次最多 3 題，選項式）

## 背景

見 PLAN-036。一句話：遠端 profile 的伺服器端（headless bat-server）沒有任何功能 handler，WSL profile 只能開空視窗。要補齊，需讓 pty / claude / git / fs 等 manager 能在**沒有 Electron 的 plain node** 中執行，且最好與 Electron 主程式**共用同一份 handler 實作**。

## 已知資訊（T0385，請自行複核）

- `createHeadlessServer({ handlers })` 支援注入；T0385 新增 `electron/remote/headless-handlers.ts` 內建 handler
- Electron 端多數 proxied handler 以 `registerHandler(channel, fn)` 註冊於 `electron/main.ts`（例：`:3017-3027`），與 RemoteServer 共用 registry
- `ALWAYS_LOCAL_CHANNELS`：`workspace:save` / `workspace:load`；版面由 client 持有
- 輸出事件走 `broadcastHub`（headless 可共用）
- server bundle 已含 `@lydell/node-pty-<target>`、claude-code、agent-sdk、better-sqlite3（見 `scripts/build-server-bundle.mjs` externals）

## 研究目標

1. **channel 清單定案**：以 T0385 A-2 為底，完整列出遠端 profile 會 proxy 的 channel（`electron/preload.ts` / `PROXIED_CHANNELS` / renderer 呼叫點），分為「headless 必須提供」/「應改為 always-local」/「遠端不支援、UI 應隱藏或降級」三類
2. **Electron 耦合分析**：逐一列出 P0-P3 涉及的 manager / handler 使用了哪些 Electron API（`app.getPath`、`BrowserWindow`、`webContents.send`、`dialog`、`shell`、`safeStorage`…），以及各自的抽象方式（注入路徑 / broadcast / no-op）
3. **架構提案**：如何讓 Electron main 與 headless **共用 handler 註冊模組**（例如 `registerXxxHandlers(registry, deps)`），避免兩份實作漂移；與 `_spec-remote-dev-support` §2.3 原設計的異同；對既有 `electron/main.ts` 的改動面與回歸風險
4. **headless 環境語意**：設定來源（`settings:load` 已落 `<dataDir>/settings.json`）、shell 路徑（Linux 預設 shell 偵測）、`isPathAllowed` path sandbox 在遠端的定義、claude runtime（embedded vs 遠端系統 claude；`DISABLE_UPDATES` 等 env，見 CLAUDE.md）、auth 狀態（遠端 claude 登入）
5. **安全**：headless 一旦提供 `pty:create` 即等於遠端 shell —— 確認 token + TLS pinning + bind 介面（`127.0.0.1`）的現有防線足夠；列出需新增的限制（如有）
6. **驗證策略**：本機 headless harness（T0385 用的 esbuild + `BAT_SERVER_ENTRY` + wss 腳本）可否常態化為 test；T0385 C 節的本機部署工具缺口是否應在 Phase 1 一併補（local-tarball override / `fetch:baseline --skip` / dev deploy script）
7. **分階段拆單**：P0（終端：開分頁、輸入、resize、kill、restart、cwd）→ P1 → P2 → P3，每張估 sizing、affects_files、依賴；標出可平行與必須串行者
8. **與其他 PLAN 的關係**：PLAN-035 Phase 2/3 是否應等 PLAN-036 P0；PLAN-015；以及 T0385 觀察到的 `App.tsx` `remote.connect` 不帶 fingerprint 問題應歸哪裡

## 調查範圍

- `electron/main.ts`、`electron/pty-manager.ts`、`electron/claude-agent-manager.ts`、`electron/claude-runtime-router.ts`、`electron/remote/**`、`electron/preload.ts`、`scripts/bat-server.mjs`、`scripts/build-server-bundle.mjs`、`src/` 呼叫點
- `_ct-workorders/_spec-remote-dev-support-2026-04.md`、`_spec-server-bundle-distribution.md`、`docs/remote-dev-overview.md`
- 允許 scratchpad PoC：例如以 plain node 載入去 Electron 化的 PtyManager 雛形，在非 9876 / 9877 埠 headless 上 invoke `pty:create` 驗證可行性（驗完清乾淨）

## 互動規則

- 架構取捨（例如共用模組 vs headless 專用實作、P1 是否用遠端系統 claude）需使用者裁決時，以選項式提問，每次 ≤ 3 題
- 不確定處標「推測」並說明驗證方式

## 回報要求

- 每個研究目標一節，附證據（檔案:行號 / 指令輸出）
- 最後一節「建議工單清單」：表格（暫定標題 / 階段 / sizing / affects_files / 依賴 / 可否平行）
- 完成寫 **`DONE`**

## Sub-session 執行指示

1. 讀取本工單 + PLAN-036 + T0385 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 研究 → 填回報區
4. commit 僅本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
5. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
