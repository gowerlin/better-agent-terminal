---
schema_version: 1
schema_kind: workorder
id: T0497
title: "BUG-114 修復：bat-terminal.mjs 以 frame id 比對 auth / invoke 回應，修正廣播 frame 被誤判為「分頁已建立」"
type: implementation
status: TODO
repo: better-agent-terminal
project: BUG-114
priority: P1
sizing: S
created_at: "2026-10-13T23:26:19+08:00"
started_at: null
updated_at: "2026-10-13T23:26:19+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0490"
related:
  - "T0490 回報區（根因、第 6 節修法 A、第 7 節實作單規格 —— 本單 SoT）"
  - "BUG-114；`scripts/bat-notify.mjs:454-466` `waitForMessageById`（範本）"
affects_files:
  - "scripts/bat-terminal.mjs"
  - "tests/bat-terminal-response-correlation.test.mjs"
  - "tests/"
  - "_ct-workorders/BUG-114-dispatched-worker-never-runs-ct-exec.md"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權更新 `_ct-workorders/BUG-114-dispatched-worker-never-runs-ct-exec.md`（根因、修復段、狀態 → FIXED）"
  - "🔴 不改伺服器（`electron/remote/remote-server.ts`）、不改回應格式、不改 exit code 語意；新 helper 須相容舊 BAT（真伺服器一直回 `id`）"
  - "🔴 不得對使用者正在使用的 BAT（本機 RemoteServer，`BAT_REMOTE_PORT`）連線測試；一律用 mock TLS server"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（T0490 第 8 節建議文字由 T0493 套用）"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0497 — bat-terminal 回應以 frame id 比對

## 實作（T0490 第 7 節）

1. `waitForMessage(ws, expectedId, timeoutMs)`：parse 失敗或 `frame.id !== expectedId` 的 frame 忽略；auth / invoke 的 id 先存變數再送（比照 `bat-notify.mjs:454-466`）
2. 診斷：`terminal-created` 日誌加 `responseType`（`frame.type`）與 `ignoredFrames` 計數
3. 順手修：`tests/bat-terminal-*.test.mjs` 的 `runBatTerminal` 設 `BAT_HELPER_LOG_DIR`（及 `BAT_USER_DATA`，T0481 後 helper 也看它）到 temp，測試不再寫入使用者真實 `bat-scripts.log`
4. 盤點其他 `scripts/*.mjs` helper 是否有同樣「收下一個任意 frame」的寫法（如有，同法修正並列出；`bat-notify.mjs` 已正確）
5. BUG-114 記錄：根因（T0490）、修復、生效條件（使用者安裝 pre.5 後安裝版 helper 才生效）、T0436 型屬不同根因（ct-exec 中途停住不通知，skill 層另案）→ 狀態 FIXED

## 驗收條件（單元，mock TLS server，沿用 `tests/bat-terminal-workorder-id.test.mjs` 的 `startMockBatRemote` 寫法）

- [ ] auth-result 後持續送 `event` frame、invoke-result 延遲 30 ms ⇒ exit 0，且 helper 結束晚於 invoke-result 送出
- [ ] 同上但 `result: false` ⇒ exit 1（T0456）；`{ ok:false, code }` ⇒ exit 1（T0433）
- [ ] auth-result 與 event 同一 chunk ⇒ 正常
- [ ] 只有 event、沒有 invoke-result ⇒ 3000 ms 後 exit 1 `invoke-timeout`
- [ ] 既有 `tests/bat-terminal-*.test.mjs` 全綠；`npm run verify:helpers` ✅；`npm run test:unit`（標註他人 WIP 影響）
- [ ] 回報區附測試輸出、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0490 回報區 + BUG-114 + `scripts/bat-terminal.mjs` + `scripts/bat-notify.mjs` + `tests/bat-terminal-*.test.mjs`
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
