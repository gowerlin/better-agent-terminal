---
schema_version: 1
schema_kind: workorder
id: T0497
title: "BUG-114 修復：bat-terminal.mjs 以 frame id 比對 auth / invoke 回應，修正廣播 frame 被誤判為「分頁已建立」"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-114
priority: P1
sizing: S
created_at: "2026-10-13T23:26:19+08:00"
started_at: "2026-10-13T23:27:24+08:00"
updated_at: "2026-10-13T23:33:13+08:00"
completed_at: "2026-10-13T23:33:13+08:00"
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

### 結論

✅ DONE。`scripts/bat-terminal.mjs` 改以 frame id 比對 auth / invoke 回應，廣播 `event` frame 不再被誤判為「分頁已建立」；新增 7 個 mock TLS 單元測試（修正前版本 5/7 失敗、修正後 7/7 通過，連跑 5 次穩定）；既有 `tests/bat-terminal-*.test.mjs` 全綠；BUG-114 → FIXED。

### Landing Zone Check

| 檢查 | 結果 |
|---|---|
| C-0 repo identity | ✅ PASS：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`REPO_ROOT = D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`） |
| C-1 work order path | ✅ PASS |
| C-3 affects_files | ✅ informational：`scripts/bat-terminal.mjs` 存在 |
| C-2 branch | ℹ️ 無 `branch` 欄位；目前 `main` |
| 環境 | `CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄） |
| 起始狀態 | `status: TODO`（非 `PENDING`），視為未開工，直接改 `IN_PROGRESS` |

### 實作

1. **`waitForMessage(ws, expectedId, timeoutMs = 3000, acceptType = null)`**（`scripts/bat-terminal.mjs`）：parse 失敗或 `frame.id !== expectedId` 的 frame 忽略；`authId` / `invokeId` 先存變數再送（比照 `bat-notify.mjs` `waitForMessageById`）。
   - **與規格的差異（相容性）**：auth 等待另傳 `acceptType = 'auth-result'`。原因：`electron/remote/remote-server.ts:606` / `:615` 對 banned IP（`Too many failed attempts`）與 auth timeout 回 `{ type: 'auth-result', id: '0', error }`，純 id 比對會把這兩種拒絕變成 3 s 後的 `auth-timeout`（診斷退步；`bat-notify.mjs` 有同樣盲點，但本單不改它）。廣播一律是 `type: 'event'`，不受影響。invoke 等待只認 id。
2. **診斷**：`terminal-created`（ok / false / refused / error 四種）加 `responseType`（回應 frame 的 `type`）與 `ignoredFrames`；`invoke-timeout` 的 `exit` 日誌也帶 `ignoredFrames`。測試斷言 ok 情境 `responseType: 'invoke-result'`、`ignoredFrames > 0`。
3. **順手修**：`tests/bat-terminal-workorder-id.test.mjs` / `tests/bat-terminal-msys.test.mjs` 的 `runBatTerminal` 設 `BAT_HELPER_LOG_DIR`（`<tmp>/…-userdata-<pid>/Logs`）與 `BAT_USER_DATA`（同目錄），測試不再寫入使用者真實 `bat-scripts.log`。workorder-id 測試的 `env` 參數仍可覆蓋。
4. **盤點其他 helper**：`scripts/*.mjs` 中讀 WebSocket frame 的只有三個：
   - `bat-notify.mjs`：已用 `waitForMessageById`，正確（僅有上述 id `'0'` auth 拒絕的診斷盲點，非 BUG-114 型，未改）
   - `smoke-remote-headless.mjs`（:549）：auth 以 `frame.type === 'auth-result'` 判斷、invoke 以 `pending.get(frame.id)` 比對、`event` 交 listener，正確
   - `bat-terminal.mjs`：本單修正
   - 其餘（`bat-server.mjs` / `_bat-server-helpers.mjs` / build / deploy 類）不當 WS client，不適用
5. **BUG-114**：補根因（T0490）、修復、生效條件（安裝 pre.5 後安裝版 helper 才生效，之前用 L143 + T0490 第 6 節暫行對策）、實機驗收方式、T0436 型屬不同根因（skill 層另案）；`status: FIXED`、`fixed_at`、`links.fix_workorder: T0497`、body 狀態列同步。

### 驗收

| 條件 | 結果 | 證據 |
|---|---|---|
| auth-result 後持續送 event、invoke-result 延遲 30 ms ⇒ exit 0，helper 結束晚於 invoke-result 送出 | ✅ PASS | `ignores broadcasts and waits for the delayed invoke-result → exit 0`（每 2 ms 廣播；斷言 `exitedAt >= invokeResultSentAt`、mock 收到 invoke、日誌 `responseType: 'invoke-result'`、`ignoredFrames > 0`） |
| 同上 `result: false` ⇒ exit 1（T0456）；`{ ok:false, code }` ⇒ exit 1（T0433） | ✅ PASS | `result false under broadcasts …`、`a structured refusal under broadcasts …` |
| auth-result 與 event 同一 chunk ⇒ 正常 | ✅ PASS | `auth-result coalesced with broadcasts in one chunk`（event + auth-result + event 單次 `socket.write`）；另加 coalesced + 持續廣播 + `false` ⇒ exit 1 |
| 只有 event、沒有 invoke-result ⇒ 3000 ms 後 exit 1 `invoke-timeout` | ✅ PASS | 斷言耗時 ≥ 3000 ms、`exit` 日誌 `reason: 'invoke-timeout'`、`ignoredFrames > 0` |
| （追加）伺服器 id `'0'` 的 auth 拒絕仍為 `auth-failed` | ✅ PASS | `still reports the server's id-less auth rejection as auth-failed` |
| 既有 `tests/bat-terminal-*.test.mjs` 全綠 | ✅ PASS | `npx vitest run tests/bat-terminal-response-correlation.test.mjs tests/bat-terminal-workorder-id.test.mjs tests/bat-terminal-msys.test.mjs` → `Test Files 3 passed (3) / Tests 29 passed (29)` |
| 新測試穩定性 | ✅ PASS | 連跑 5 次皆 `Tests 7 passed (7)` |
| Red check（測試能抓到缺陷） | ✅ PASS | 新測試對 HEAD 版 `bat-terminal.mjs` 複本（repo `tmp/t0497-red/`，跑完已刪除）：`Tests 5 failed \| 2 passed (7)`；失敗的 5 個皆為 exit 0 `✓ Terminal created`（含「只有廣播」也誤報成功）；通過的 2 個是相容性守門（coalesced 成功、id `'0'` auth 拒絕），舊版本來就該過 |
| `npm run verify:helpers` | ✅ PASS | `[verify-helper-bundle] OK — all 15 helper .mjs files in extraResources are reachable via filter; server bundle ships 4 helper(s) with a closed import set` |
| `npm run test:unit` | ⚠️ 他人 WIP 影響 | `Test Files 1 failed \| 183 passed (184)`、`Tests 1 failed \| 3146 passed \| 1 skipped (3148)`；唯一失敗 `src/components/setup-wizard/__tests__/wizard-jump-rollback.test.ts > … retry and skip are ignored while the jump-back rollback runs`，屬 T0489 進行中（該檔未追蹤、`wizard-runner.ts` 為他人未提交修改），與本單無關 |
| runtime（真 BAT） | 未做 | 依 memory_overrides 不得對使用者的 BAT 連線測試；實機驗收方式寫在 BUG-114「生效條件」 |

### 異動檔案（`git diff --stat`）

```
 ...BUG-114-dispatched-worker-never-runs-ct-exec.md | 36 +++++++++++++++----
 scripts/bat-terminal.mjs                           | 42 ++++++++++++++++------
 tests/bat-terminal-msys.test.mjs                   |  5 +++
 tests/bat-terminal-workorder-id.test.mjs           | 12 ++++++-
 vite.config.ts                                     |  2 ++
 5 files changed, 80 insertions(+), 17 deletions(-)
```

新增：`tests/bat-terminal-response-correlation.test.mjs`（350 行）。另含本工單檔。換行維持各檔現況（`bat-terminal.mjs` 工作樹 CRLF，其餘 LF）。

### 偏離

- **`vite.config.ts` 不在 `affects_files`**：vitest `include` 是逐檔列舉，不加這一行新測試不會被 `npm run test:unit` 執行。只加 1 行 include + 註解；開工時該檔無他人修改，`--only` 不會帶到別人的 hunk。
- auth 等待多接受 `type: 'auth-result'`（見實作 1），屬相容性保留，不改回應格式或 exit code 語意。
- 過程中一度以 `sed -i` 把 `bat-terminal.mjs` 工作樹換行轉成 LF，已用 node 還原為 CRLF（diff stat 前後一致：32+/10-）。

### 後續建議（交塔台）

1. `bat-notify.mjs` `waitForMessageById` 也不認 id `'0'` 的 auth 拒絕（banned IP / auth timeout 會顯示成 timeout），可另開小單比照本單 `acceptType`；非 BUG-114 型，不影響正確性
2. `tests/bat-notify-submit.test.mjs` 也未設 `BAT_HELPER_LOG_DIR`（本單範圍只限 `bat-terminal-*`），同樣會寫入使用者真實 `bat-scripts.log`，可一併處理
3. T0490 第 8 節 CLAUDE.md 建議文字由 T0493 套用時，可補一句「auth 等待須另接受 `type: 'auth-result'`（伺服器 pre-auth 拒絕帶 `id: '0'`）」

### Commit

`git commit --only` 本單檔案與上述 6 個檔案；SHA 見 `git log --grep T0497`；未 push。
