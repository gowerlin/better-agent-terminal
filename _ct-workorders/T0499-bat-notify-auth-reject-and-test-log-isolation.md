---
schema_version: 1
schema_kind: workorder
id: T0499
title: "bat-notify.mjs：auth 等待接受伺服器 id '0' 的 auth-result 拒絕（banned / timeout 不再顯示成 timeout）+ bat-notify 測試隔離 BAT_HELPER_LOG_DIR / BAT_USER_DATA"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-13T23:33:27+08:00"
started_at: "2026-10-13T23:34:40+08:00"
updated_at: "2026-10-13T23:39:12+08:00"
completed_at: "2026-10-13T23:39:12+08:00"
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

### 結論

✅ DONE。`scripts/bat-notify.mjs` 的 auth 等待比照 T0497 另接受 `type: 'auth-result'`，伺服器 id `'0'` 的拒絕（banned IP / auth timeout）改回報 `auth-failed`（附伺服器 error），不再 3 s 後顯示 `Response timeout`；另修 `MinimalWS` 丟棄「handler 註冊前抵達的 frame」的缺口（banned IP 的真實路徑需要它，見偏離 1）。`tests/bat-notify-*.test.mjs` 改寫 temp 日誌；新增 7 個 mock TLS 測試。不改伺服器、回應格式、exit code 語意，`--submit` / `--no-pty-write` 行為不變。

### Landing Zone Check

| 檢查 | 結果 |
|---|---|
| C-0 repo identity | ✅ PASS：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`REPO_ROOT = D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`） |
| C-1 work order path | ✅ PASS |
| C-3 affects_files | ✅ informational：`scripts/bat-notify.mjs`、`tests/` 存在 |
| C-2 branch | ℹ️ 無 `branch` 欄位；目前 `main` |
| 環境 | `CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄） |
| 起始狀態 | `status: TODO`，視為未開工，直接改 `IN_PROGRESS` |

### 實作

1. **`waitForMessageById(ws, expectedId, timeoutMs = 3000, acceptType = null)`**：非預期 id 的 frame 仍忽略，但 `acceptType` 有值時同型別 frame 不論 id 都接受；只有 auth 等待傳 `'auth-result'`，三個 invoke 等待（`terminal:notify` / `pty:write` / `terminal:keypress`）照舊只認 id。廣播一律 `type: 'event'`，不受影響。拒絕時沿用既有分支：stderr `Error: Authentication failed: <error>`、`exit` 日誌 `{ code: 1, reason: 'auth-failed', error }`。
2. **`MinimalWS` 暫存 handler 註冊前的 text frame**（`#pending`，`onMessage(fn)` 註冊時依序補送）：`remote-server.ts:601-607` 對 banned IP 是在 `connection` 時**主動**送拒絕並關閉，不等 client 的 auth frame；這個 frame 常與 101 回應同一 chunk 抵達，`connect()` resolve 後同步 `#drain()` 時 `#msgHandler` 仍是 `null`，修正前直接丟棄。正常流程中 handler 註冊前不會有 frame（伺服器 auth 後才廣播），佇列為空。
3. **測試日誌隔離**：`tests/bat-notify-submit.test.mjs` 的 `startMockBatRemote` 回傳 `logDir`（`<certDir>/Logs`）/ `userData`（`<certDir>`），`runBatNotify(remote, message)` 設 `BAT_HELPER_LOG_DIR` 與 `BAT_USER_DATA`。`tests/bat-notify-*.test.mjs` 只有 `submit` 與本單新檔兩個，皆已隔離。
4. **新測試** `tests/bat-notify-auth-reject.test.mjs`（mock TLS，322 行）+ `vite.config.ts` 只加 1 行 include（+ 註解；vitest include 為逐檔列舉，不加則 `npm run test:unit` 不會跑）：
   - id `'0'` 回覆 auth（`Too many failed attempts` / `Auth timeout`）→ exit 1、`auth-failed`、無 invoke、stderr 不含 `Response timeout`
   - banned IP：拒絕 frame + close frame 與 101 **同一次** `socket.write` → exit 1、`auth-failed`
   - 回覆帶自己 id 的 `auth-result` + error（既有行為守門）→ `auth-failed`
   - auth 後每 2 ms 廣播 + invoke-result 延遲 30 ms，`--submit` / 預設 / `--no-pty-write` 三種 → exit 0、invoke channel 序列不變、stderr 空

### 驗收

| 條件 | 結果 | 證據 |
|---|---|---|
| 新增 / 既有 `tests/bat-notify-*.test.mjs` 全綠 | ✅ PASS | `npx vitest run tests/bat-notify-auth-reject.test.mjs tests/bat-notify-submit.test.mjs` → `Test Files 2 passed (2) / Tests 10 passed (10)` |
| 連同 `tests/bat-terminal-*.test.mjs` 穩定性 | ✅ PASS | 5 檔連跑 3 次皆 `Test Files 5 passed (5) / Tests 39 passed (39)` |
| Red check：新測試對 HEAD 版失敗 | ✅ PASS | HEAD 版 `bat-notify.mjs` 複本（repo `tmp/t0499-red-head/`，跑完已刪）：`Tests 3 failed \| 4 passed (7)`；失敗 3 個皆 `Error: Response timeout`（約 3.07–3.1 s），即 id `'0'` ×2 + 同 chunk banned；通過的 4 個是行為不變守門（帶 id 的拒絕、三種廣播情境），舊版本來就該過 |
| Red check：只加 `acceptType`、不加 `#pending` | ✅ 證實佇列必要 | 複本 `tmp/t0499-red-typeonly/`（已刪）連跑 3 次皆 `1 failed \| 6 passed`，失敗者恆為「banned IP rejected on connect, in the same chunk as the 101」（`Response timeout`） |
| `npm run verify:helpers` | ✅ PASS | `[verify-helper-bundle] OK — all 15 helper .mjs files in extraResources are reachable via filter; server bundle ships 4 helper(s) with a closed import set` |
| 測試不寫入使用者真實 `bat-scripts.log` | ✅ PASS | `%APPDATA%/BetterAgentTerminal/Logs/bat-scripts.log` 內 `tower-123` 筆數跑測試前後皆 `3570`（既有筆數為修正前歷次測試所留） |
| `npm run test:unit`（回歸） | ✅ PASS | `Test Files 185 passed (185)`、`Tests 3154 passed \| 1 skipped (3155)` |
| runtime（真 BAT） | 未做 | 依 memory_overrides 不得對使用者的 BAT 連線測試；本機安裝版 helper 要等裝上含本單的版本才生效 |

### 異動檔案（`git diff --stat`）

```
 scripts/bat-notify.mjs                |  22 ++-
 tests/bat-notify-auth-reject.test.mjs | 322 ++++++++++++++++++++++++++++++++++
 tests/bat-notify-submit.test.mjs      |  17 +-
 vite.config.ts                        |   2 +
 4 files changed, 351 insertions(+), 12 deletions(-)
```

另含本工單檔。換行維持各檔現況（工作樹皆 LF）。

### 偏離

1. **`MinimalWS` 加 `#pending` 佇列**：工單只寫「`waitForMessageById` 接受 `auth-result`」。但 banned IP 的拒絕在 client 註冊 handler 前就到，只改等待函式時該情境仍逾時（red check 第 2 列實測）。改動仍在 `scripts/bat-notify.mjs` 內、正常流程佇列為空，屬達成本單目標（「不再等到 timeout」）的必要部分。
2. **`vite.config.ts` 不在 `affects_files`**：只加 1 行 include + 註解（驗收條件已預先允許）；開工時該檔無他人修改。

### 後續建議（交塔台）

1. **`scripts/bat-terminal.mjs` 有同一個 handler 前丟 frame 的缺口**（`:540` `if (opcode === 0x01 && this.#msgHandler)`）：T0497 的 `acceptType` 只涵蓋「回覆 auth frame 的 id `'0'` 拒絕」，T0497 的 mock 也是收到 auth 才回拒絕；真實 banned IP 在 connect 即送拒絕，`bat-terminal` 仍會顯示成 `auth-timeout`。可另開小單比照本單 `#pending`（診斷問題，不影響正確性）。
2. CLAUDE.md 建議文字（由 T0493 套用，可與 T0497 建議 3 合併）：「helper 的 auth 等待須另接受 `type: 'auth-result'`（伺服器 pre-auth 拒絕帶 `id: '0'`，banned IP 在連線時即送，可能與 101 同一 chunk），MinimalWS 不可丟棄 handler 註冊前抵達的 frame；helper 測試須設 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 到 temp。」

### Commit

`git commit --only` 本單檔案與上述 4 個檔案；SHA 見 `git log --grep T0499`；未 push。
