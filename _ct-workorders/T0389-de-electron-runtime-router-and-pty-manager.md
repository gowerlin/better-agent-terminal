---
schema_version: 1
schema_kind: workorder
id: T0389
title: "PLAN-036 P0-B：去 Electron 化 —— claude-runtime-router 設定注入 + embedded resolver 合一（含 bundle `bin/claude`）+ PtyManager DI"
type: implementation
status: TODO
priority: P1
sizing: M
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-04T23:58:00+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: [T0387]
related:
  - "PLAN-036 / D129"
  - "T0386 回報區 §2、§3（改動面與回歸風險）、§4（claude runtime / helper env）、建議工單清單 B"
affects_files:
  - electron/claude-runtime-router.ts
  - electron/claude-agent-manager.ts
  - electron/pty-manager.ts
  - electron/main.ts
  - electron/__tests__/claude-runtime-router.test.ts
  - electron/__tests__/pty-manager-deps.test.ts
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。比對 baseline 用 `git show HEAD:<path>` 或 `git worktree add` 到 scratchpad。"
  - "🔴 **No Regressions**：`PtyManager` 是本機終端 / Terminal Server proxy / heartbeat recovery 的共同依賴（`main.ts:975`、`:1336-1338`、`:1507-1510`）。Electron 端以 `createElectronPtyDeps()` 保持原行為；本機 smoke（開終端、claude-cli preset、Agent 面板）必做。"
  - "🔴 `DISABLE_UPDATES` 只給 embedded、system 絕不注入（CLAUDE.md T0372 規則）；不得改 `DISABLE_AUTOUPDATER` 注入點語意。"
  - "⚠️ 依賴 T0387 commit（同改 `electron/main.ts`）；派發時 T0387 應已完成。不 push。"
---

# T0389 — runtime router / embedded resolver / PtyManager DI

## 範圍（依 T0386 §2-§4）

1. `claude-runtime-router.ts`：設定來源改注入（Electron = `app.getPath('userData')/settings.json` 原行為；headless = `dataDir`），模組本身不 import `electron`
2. **embedded resolver 合一**：目前三份（`claude-runtime-router.ts:82-107`、`claude-agent-manager.ts:107-134`、`main.ts:2259-2266`）一律找 `bin/claude.exe`；合為單一函式，依平台 / 版型解析（Windows `claude.exe`；server bundle POSIX wrapper `node_modules/@anthropic-ai/claude-code/bin/claude`，headless 由 deps 注入 install root）。三處改呼叫同一函式，Electron 端行為不變
3. **PtyManager DI**：建構子改收 deps（`emit` / `dataDir` / `helperDir` 等），移除對 `electron` `app` / `BrowserWindow` 的直接依賴；`BAT_HELPER_DIR` 由 deps 決定（headless 傳空 → 不注入）；Electron 端 `createElectronPtyDeps()` 維持原行為
4. 本單**不**註冊任何新 headless channel（T0390 做）

## 驗收

- unit：router 設定注入（兩種來源）、resolver（Windows / bundle POSIX / 找不到）、PtyManager deps（不注入 helper dir、emit 被呼叫）
- `npm run test:unit` 全綠（回報新數字）；`npx vite build` exit 0；`npx tsc --noEmit` ≤ **40**
- 若 T0388 的 electron-free guard 已在 HEAD：`pty-manager.ts` / `claude-runtime-router.ts` 需能通過（回報結果）
- **本機 smoke**（`npm run dev` 或等價）：一般終端、claude-cli preset 分頁、Claude Agent 面板對話各一次正常

## Sub-session 執行指示

1. 讀取本工單 + PLAN-036 + **T0386 回報區**
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
