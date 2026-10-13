---
schema_version: 1
schema_kind: workorder
id: T0499
title: "bat-notify.mjs：auth 等待接受伺服器 id '0' 的 auth-result 拒絕（banned / timeout 不再顯示成 timeout）+ bat-notify 測試隔離 BAT_HELPER_LOG_DIR / BAT_USER_DATA"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-13T23:33:27+08:00"
started_at: null
updated_at: "2026-10-13T23:33:27+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0497"
related:
  - "T0497 回報區「後續建議」1 / 2；`scripts/bat-terminal.mjs` `waitForMessage(ws, expectedId, timeoutMs, acceptType)`（T0497 的 `acceptType = 'auth-result'` 做法）"
  - "`electron/remote/remote-server.ts:606` / `:615`（banned IP / auth timeout 回 `{ type: 'auth-result', id: '0', error }`）"
affects_files:
  - "scripts/bat-notify.mjs"
  - "tests/bat-notify-*.test.mjs"
  - "tests/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改伺服器、不改回應格式、不改 exit code 語意；`--submit` / `--no-pty-write` 等既有行為不變"
  - "🔴 不得對使用者正在使用的 BAT 連線測試；一律用 mock TLS server"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0499 — bat-notify auth 拒絕診斷 + 測試日誌隔離

## 實作

1. `bat-notify.mjs` `waitForMessageById`：auth 等待比照 T0497 另接受 `type: 'auth-result'`（伺服器 pre-auth 拒絕帶 `id: '0'`），其餘仍只認 id；拒絕時回報 `auth-failed`（附伺服器 error），不再等到 timeout
2. `tests/bat-notify-*.test.mjs`（至少 `bat-notify-submit.test.mjs`）的執行 helper 設 `BAT_HELPER_LOG_DIR` 與 `BAT_USER_DATA` 到 temp，不再寫入使用者真實 `bat-scripts.log`
3. 新測試（mock TLS）：id `'0'` 的 auth 拒絕 → auth-failed；auth 後持續廣播 + 正常回應 → 行為不變

## 驗收條件

- [ ] 新增 / 既有 `tests/bat-notify-*.test.mjs` 全綠；red check（新測試對 HEAD 版失敗）
- [ ] `npm run verify:helpers` ✅；若新增測試檔需加入 `vite.config.ts` test include，說明並只加 include 行
- [ ] 回報區附測試輸出、`git diff --stat`；CLAUDE.md 建議文字（若需）

## Sub-session 執行指示

1. 讀本工單 + D139 + T0497 回報區 + `scripts/bat-notify.mjs` + `tests/bat-notify-*.test.mjs` + `tests/bat-terminal-response-correlation.test.mjs`
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
