---
schema_version: 1
schema_kind: workorder
id: T0366
title: "研究：BUG-083 Codex agent 因版本過舊出錯的根因與修復方案"
type: research
status: PENDING
priority: P2
sizing: S
created_at: "2026-10-04T13:29:07+08:00"
updated_at: "2026-10-04T13:29:07+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "BUG-083（本研究對象）"
  - "PLAN-027（claude runtime selection 先例：electron/claude-runtime-router.ts）"
  - "BUG-059（embedded CLI auto-update 造成 binary 被搬走的先例）"
affects_files: []
interaction:
  mode_hint: yolo
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究工單，不改產品程式碼、不升級依賴、不 commit `package.json` / `package-lock.json`**。可在 scratchpad 或 `git worktree` 做實驗（含試裝新版 SDK 跑 smoke），結束前清乾淨；主工作樹除本工單檔外不得留下改動。"
  - "🔴 不要 `npm install -g` / `codex update` / 改動使用者全域安裝的 codex，也不要改 `~/.codex/` 下任何檔案（只讀）。"
---

# T0366 — 研究：BUG-083 Codex agent 因版本過舊出錯

## 元資料

- **類型**：research
- **互動模式**：enabled（允許向使用者提問，每次 ≤ 3 題；使用者可能無法再取得測試者資訊，問不到就以實驗結論為準）
- **工作量預估**：S
- **Context Window 風險**：中（SDK 跨 36 個版本的 changelog 可能很長，請挑重點）

## 研究目標

回答四個問題，並給出可直接拆實作工單的建議：

1. **錯在哪**：在本機重現 Codex agent（BAT 的 Codex agent 面板路徑，`electron/codex-agent-manager.ts`）以內嵌 0.124.0 執行時是否出錯？錯誤訊息是什麼？
2. **為什麼**：根因屬於哪一類（可多選，需證據）：
   - H1 內嵌 CLI 過舊 → OpenAI 服務端 / 新模型（如預設模型名）不再相容
   - H2 SDK JS（0.124）與 PATH 上較新 codex CLI 的版本錯配（`findCodexBinary()` 優先 PATH）→ exec JSON 事件 / 參數格式不相容
   - H3 共用的 `~/.codex/config.toml` 被較新 CLI 寫入舊版不認得的鍵 → 舊 binary 啟動失敗
   - H4 其他（例如登入 / auth 格式變更）
3. **升到最新能否解**：`@openai/codex-sdk@0.160.0`（或研究時的最新版）的 breaking changes 對 `codex-agent-manager.ts` 的影響範圍（API、事件型別、選項名）
4. **如何不再落後**：OpenAI 改版頻率高，評估長期策略：
   - S1 單純 bump SDK（並建議追版節奏）
   - S2 啟動時偵測 binary 版本與 SDK 版本，錯配時 toast / fallback（類比 PLAN-027 claude runtime router 的 `fallbackToEmbedded` + degraded reason）
   - S3 Settings 提供 codex runtime 選擇（embedded / system / custom path）
   - 可組合，請給推薦與理由

## 已知資訊（塔台初步事實，請自行複核）

- `package.json:46` `@openai/codex-sdk: ^0.124.0`，實裝 0.124.0；`npm view @openai/codex version` = 0.160.0（2026-10-04）
- `electron/codex-agent-manager.ts:95-167`：binary 解析優先序 `BAT_CODEX_BIN` → PATH（Windows 只接受 `.exe`，跳過 npm `.cmd` shim）→ 內嵌 `@openai/codex-<platform>-<arch>/vendor/<triple>/codex/codex[.exe]`
- `electron/codex-agent-manager.ts:834` `new Codex({ codexPathOverride: codexPath, ... })`
- `package.json:218` `asarUnpack` 含 `node_modules/@openai/codex-*/**/*`
- 原始回報僅一句「BAT 的 codex 版本要更新才不會出錯」，無錯誤訊息、版本、平台（見 BUG-083）
- BAT debug log 實際位置：`%APPDATA%\better-agent-terminal\Logs\debug-<stamp>.log`（非 CLAUDE.md 記載的路徑，見 L128）—— 可搜尋 `[codex` 相關 log

## 調查範圍

- ✅ `electron/codex-agent-manager.ts`、`electron/agent-runtime/`、`src/components/CodexAgentPanel.tsx`（只讀）
- ✅ `node_modules/@openai/codex-sdk` 0.124.0 與最新版的 API / 事件型別差異（可在 scratchpad `npm pack` 或 worktree 安裝比對）
- ✅ 本機 PATH 上是否有 codex、版本為何；`~/.codex/config.toml` 內容（只讀，**回報時遮蔽任何 token / key**）
- ✅ 以內嵌 binary 直接跑 `codex --version` / 最小 `codex exec` smoke（若需登入且本機未登入，記錄為限制，不要代替使用者登入）
- ❌ 不改 `src/` `electron/` `package*.json`；不發 release；不動全域 codex 安裝

## 互動規則

- 每次提問不超過 3 題；優先問「使用者本機是否有 codex CLI 及版本」「能否向測試者取得錯誤訊息/截圖」這類只有使用者能答的問題
- 能用實驗回答的，不要問

## 回報要求

- 「調查結論」每個 H 標註 **證實 / 排除 / 無法判定**，附證據（指令輸出、log 片段、程式碼行號）
- 「建議方向」給 S1/S2/S3 的推薦組合、改動檔案清單、預估工作量、風險（特別是 BUG-059 類 auto-update 風險：內嵌 codex 是否也會自我更新？是否需注入類似 `DISABLE_AUTOUPDATER` 的 env）
- 「建議下一步」列出可直接拆成實作工單的項目（含建議 `affects_files`）

## Sub-session 執行指示

1. 讀取本工單全部內容 + `BUG-083`
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 依研究目標 1 → 4 調查
4. 填寫回報區、更新 `status` / `completed_at` / `updated_at`
5. commit **僅本工單檔**（`git commit --only _ct-workorders/T0366-research-bug083-codex-version-skew.md`）
6. 依派發 mode 通知塔台（`bat-notify.mjs`；YOLO 模式依 ct-exec 規則帶 `--submit`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### 遭遇問題

### 回報時間
