---
schema_version: 1
schema_kind: workorder
id: T0501
title: "bat-terminal.mjs MinimalWS 暫存 handler 註冊前抵達的 frame（banned IP 在 connect 即送拒絕，不再顯示成 auth-timeout）"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-13T23:39:40+08:00"
started_at: null
updated_at: "2026-10-13T23:39:40+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0497"
  - "T0499"
related:
  - "T0499 回報區「後續建議」1：`scripts/bat-terminal.mjs:540` `if (opcode === 0x01 && this.#msgHandler)` 丟棄 handler 註冊前的 frame；`remote-server.ts:601-607` banned IP 在 connection 時即送拒絕（常與 101 同 chunk）"
  - "T0499 `scripts/bat-notify.mjs` `MinimalWS` `#pending` 佇列（範本）與 `tests/bat-notify-auth-reject.test.mjs`（同 chunk banned 測試寫法）"
affects_files:
  - "scripts/bat-terminal.mjs"
  - "tests/bat-terminal-response-correlation.test.mjs"
  - "tests/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改伺服器、回應格式、exit code 語意；T0497 的 frame id 比對行為不變"
  - "🔴 不得對使用者正在使用的 BAT 連線測試；一律用 mock TLS server"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況（`bat-terminal.mjs` 工作樹為 CRLF）"
---

# T0501 — bat-terminal 暫存早到 frame

## 實作

1. `scripts/bat-terminal.mjs` `MinimalWS`：比照 T0499 `bat-notify.mjs` 加 `#pending`，handler 註冊時依序補送；正常流程佇列為空
2. 測試（mock TLS，加在 `tests/bat-terminal-response-correlation.test.mjs` 或新檔）：拒絕 frame + close 與 101 同一次 `socket.write` → exit 1、`auth-failed`（附伺服器 error）、無 invoke；既有 7 個測試仍過
3. Red check：新測試對 HEAD 版失敗

## 驗收條件

- [ ] `tests/bat-terminal-*.test.mjs`、`tests/bat-notify-*.test.mjs` 全綠，連跑 3 次穩定；red check
- [ ] `npm run verify:helpers` ✅；`npm run test:unit`（標註他人 WIP 影響）
- [ ] 回報區附測試輸出、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0499 / T0497 回報區 + `scripts/bat-terminal.mjs` + `scripts/bat-notify.mjs`
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
