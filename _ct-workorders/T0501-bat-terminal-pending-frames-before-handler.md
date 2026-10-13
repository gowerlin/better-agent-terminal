---
schema_version: 1
schema_kind: workorder
id: T0501
title: "bat-terminal.mjs MinimalWS 暫存 handler 註冊前抵達的 frame（banned IP 在 connect 即送拒絕，不再顯示成 auth-timeout）"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-13T23:39:40+08:00"
started_at: "2026-10-13T23:40:02+08:00"
updated_at: "2026-10-13T23:43:05+08:00"
completed_at: "2026-10-13T23:43:05+08:00"
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

- [x] `tests/bat-terminal-*.test.mjs`、`tests/bat-notify-*.test.mjs` 全綠，連跑 3 次穩定；red check
- [x] `npm run verify:helpers` ✅；`npm run test:unit`（標註他人 WIP 影響）
- [x] 回報區附測試輸出、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0499 / T0497 回報區 + `scripts/bat-terminal.mjs` + `scripts/bat-notify.mjs`
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果：DONE

`scripts/bat-terminal.mjs` `MinimalWS` 比照 T0499 `bat-notify.mjs` 加 `#pending`：`#drain()` 遇 text frame 而 handler 未註冊時暫存，`onMessage(fn)` 註冊時依序補送（`this.#pending.splice(0)`）。正常流程 auth frame 送出後才有回覆，佇列為空，行為不變；T0497 的 frame id 比對（`waitForMessage` 的 `expectedId` / `acceptType`）未動。伺服器、回應格式、exit code 語意皆未改。

根因確認：`connect()` 的 `data` handler 在 `resolve()` 後**同步**呼叫 `#drain()`，此時 `main()` 的 `await ws.connect()` 尚未恢復（microtask），`waitForMessage` 還沒註冊 `onMessage`，與 101 同 chunk 的 banned-IP `auth-result` 被丟棄 → 3 s 後 `auth-timeout`。隨後的 close frame 讓 `close()` 先 `end()` socket，helper 的 auth frame 寫入失敗只觸發已 settle 的 connect Promise 的 `onFail`（no-op），不影響結果。

### 改動檔案

| 檔案 | 內容 |
|---|---|
| `scripts/bat-terminal.mjs` | `#pending` 欄位 + `onMessage` 補送 + `#drain` 暫存（CRLF 維持：802 行全 CRLF，以 Node 計數驗證） |
| `tests/bat-terminal-response-correlation.test.mjs` | mock server 加 `rejectOnConnect`（101 + 拒絕 frame + close frame 一次 `socket.end()` 寫出）、`closed` 旗標、`state.authFrames`；新增 1 個測試（LF 維持） |

```
 scripts/bat-terminal.mjs                         | 14 +++++--
 tests/bat-terminal-response-correlation.test.mjs | 47 ++++++++++++++++++++++--
 2 files changed, 55 insertions(+), 6 deletions(-)
```

新測試斷言：exit 1、stderr 含 `Authentication failed: Too many failed attempts`、不含 `Auth response timeout`、無 `Terminal created`、耗時 < 3000 ms、伺服器收到 auth frame 數 0、無 invoke、NDJSON exit event `{ code: 1, reason: 'auth-failed', error: 'Too many failed attempts' }`。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| Red check（新測試對 HEAD 版） | ✅ 失敗如預期 | 暫以 `git show HEAD:scripts/bat-terminal.mjs` 覆蓋工作檔（scratchpad 先備份、跑完複製回，sha1 `5dcfc2e4…` 前後一致；未用 stash / restore）：`× banned IP rejected on connect … (T0501) 3071ms`，`expected 'Error: Auth response timeout: Respons…' to contain 'Authentication failed: Too many faile…'`；其餘 7 個 ✓ |
| `tests/bat-terminal-*.test.mjs` + `tests/bat-notify-*.test.mjs`（5 檔）連跑 3 次 | ✅ PASS ×3 | 每次 `Test Files 5 passed (5)` / `Tests 40 passed (40)` |
| `bat-terminal-response-correlation` verbose | ✅ 8/8 | 既有 7 個 + T0501 新測試（63 ms） |
| `npm run verify:helpers` | ✅ | `[verify-helper-bundle] OK — all 15 helper .mjs files in extraResources are reachable via filter; server bundle ships 4 helper(s) with a closed import set` |
| `npm run test:unit` | ✅ | `Test Files 186 passed (186)` / `Tests 3172 passed \| 1 skipped (3173)`。工作樹含他人 WIP（T0485 / T0492 / T0500 等未提交改動與新測試），本次全綠，未觀察到影響 |
| 使用者 BAT 連線 | 未觸碰 | 測試一律 mock TLS server + 測試專用 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` |

### Landing check

PASS — C-0 `repo: better-agent-terminal` == `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 `scripts/bat-terminal.mjs`、`tests/bat-terminal-response-correlation.test.mjs` 存在；C-2 無 `branch` 欄位（HEAD `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### Commit

`git commit --only` 本單 3 檔（工單、`scripts/bat-terminal.mjs`、測試檔）；不 push。hash 見 git log（`fix: T0501 …`）。

### 偏差 / 備註

- 工單起始 `status: TODO`（非 `PENDING`），照開工規則改為 `IN_PROGRESS`。
- 首次以 Node heredoc 批次修改測試檔時因 template literal 跳脫錯誤中止（拋錯於寫檔前，檔案未變），改用 Edit 工具完成，無副作用。

### 建議（供 T0493 套用 CLAUDE.md，本單未改）

CLAUDE.md「遠端 Tower 通知」或 helper 相關段可補一句：`bat-terminal.mjs` / `bat-notify.mjs` 的 `MinimalWS` 會暫存 `onMessage` 註冊前抵達的 text frame（T0499 / T0501），banned IP 在 connect 即送的 `auth-result`（`id: '0'`）會回報為 `auth-failed`，不再顯示成 `auth-timeout`。
