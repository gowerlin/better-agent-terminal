---
schema_version: 1
schema_kind: bug
id: BUG-114
title: "bat-terminal.mjs 派工回報 terminal-created result=ok、exit 0，但新分頁的 agent 未執行預載的 /ct-exec（工單維持 PENDING）；或 Worker 中途靜默停住——塔台無「Worker 已啟動」訊號"
status: FIXED
severity: medium
reproducibility: intermittent
created_at: "2026-10-05T11:32:35+08:00"
updated_at: "2026-10-13T23:31:43+08:00"
fixed_at: "2026-10-13T23:31:43+08:00"
impact:
  - auto-session
  - tower-dispatch
links:
  fix_workorder: T0497
  related: [T0490, T0436, T0452, T0457, L143]
---

# BUG-114 — 派工分頁建立成功但 Worker 未啟動

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（YOLO 鏈式派發會無聲卡住；第五十五 session 約 46 次派發中 3 次） |
| 可重現 | 間歇（T0490：派發當下有任一 PTY 輸出廣播搶先抵達即觸發；2026-09-25 起 471 次中 8 次遺失） |
| **狀態** | ✅ FIXED（T0497，安裝 v0.6.0-pre.5 後生效，待實機驗收） |
| 回報者 | 塔台（第五十五 session 觀察） |

## 現象（第五十五 session 證據）

| 工單 | 派發 | `bat-scripts.log` | 實際 |
|---|---|---|---|
| T0452 | 06:37:01 | `terminal-created result=ok terminalId=69012c02…`、exit 0 | 43 分鐘後工單仍 `PENDING` / `started_at: null`、相關檔案 mtime 早於派發 ⇒ `/ct-exec` 從未執行；07:20 重派 17 s 內啟動 |
| T0457 | 07:29:12 | `terminal-created result=ok terminalId=910bc8cf…`、exit 0（與 T0440 成對派發，T0440 正常） | 6 分鐘仍 `PENDING`、無任何檔案活動；07:35 重派 17 s 內啟動 |
| T0436 | 06:00:20 | 正常啟動 | Worker 06:07 寫完回報區（DONE）後停在 commit 前，46 分鐘無活動、無 commit、無通知；以 `/ct-done` 補救 |

- 同 session 正常啟動延遲（派發 → `started_at`）為 17-39 s
- 三次都是 `bat-terminal` 視角成功；塔台無從得知 agent 是否收到 / 執行預載指令

## 待查方向

- 新分頁 agent（Claude CLI）啟動完成前即送出預載 `/ct-exec`（輸入被吞）？yolo `--submit` 時序？
- 多分頁同時建立時的焦點 / 輸入佇列競爭（T0457 為成對派發的第二張；T0452 為單獨派發，不成立）
- Worker 中途停住（T0436）是否為不同根因（agent 等待權限確認 / context 問題）——需看該分頁畫面，塔台無法取得

## 暫行對策（L143）

- 派發後 ≥ 3 分鐘無 `started_at` 才視為疑似未啟動；重派前確認原 Worker 無活動（工單 / 相關檔 mtime / commit），並請使用者關閉舊分頁，避免同單雙 Worker
- 可考慮：Worker 啟動時以 `bat-notify` 送「T#### 開始」心跳，或 BAT 在預載指令送出後回報 agent 是否接收

## 根因（T0490，確定）

- **T0452 / T0457 型不是「agent 沒收到預載指令」，而是分頁根本沒建出來。** `scripts/bat-terminal.mjs` 以「下一個任意 text frame」當 auth / invoke 回應、不比對 frame `id`。本機 PTY 的 helper 用全權 server token 連 RemoteServer，屬一般 client，會收到全部 `PROXIED_EVENTS` 廣播（`{ type: 'event', id: '0' }`，含每個 PTY 的 `pty:output`）。廣播早於 `invoke-result` 抵達時，helper 印 `✓ Terminal created`、`terminal-created result=ok`、exit 0，並帶著未讀資料 `process.exit`（RST），伺服器多半還沒讀到 invoke，終端從未建立
- 輸出越熱鬧（多 Worker 並行、剛建的新分頁在啟動、Tower 分頁重繪）機率越高；T0457 緊接在成對派發的 T0440 新分頁之後
- 同一缺陷也讓 T0456（`false` ⇒ exit 1）與 T0433（`{ ok:false }` ⇒ exit 1）在競態下失效
- 原假設「預載早於 agent ready 被吞」與「多分頁焦點 / 輸入佇列競爭」皆不成立（prompt 是 CLI argv；PTY 寫入以 id 定址），詳見 T0490 回報區

## 修復（T0497，2026-10-13）

- `scripts/bat-terminal.mjs` `waitForMessage(ws, expectedId, timeoutMs, acceptType)`：auth / invoke 的 id 先存變數再送，只接受 `frame.id === expectedId` 的 frame，parse 失敗或 id 不符一律忽略（範本：`scripts/bat-notify.mjs` `waitForMessageById`）。auth 等待另接受 `type: 'auth-result'`（伺服器對 banned IP / auth timeout 回 `id: '0'`，維持 `auth-failed` 診斷；廣播一律是 `event`，不受影響）
- 診斷：`terminal-created` 日誌加 `responseType`（回應 frame 的 `type`）與 `ignoredFrames`（等待期間忽略的 frame 數），`invoke-timeout` 的 exit 日誌也帶 `ignoredFrames`
- 不改伺服器、不改回應格式、不改 exit code 語意；真伺服器一直回 `id`，新 helper 對舊 BAT 相容
- 測試：`tests/bat-terminal-response-correlation.test.mjs`（mock TLS server 持續廣播 + 延遲回應；修正前版本 7 個中 5 個失敗）；`tests/bat-terminal-*.test.mjs` 的 helper 日誌改寫到 temp，不再污染使用者真實 `bat-scripts.log`

## 生效條件

- 塔台派工用的是**安裝版** helper（`BAT_HELPER_DIR` = `C:\Program Files\BetterAgentTerminal\resources\scripts`），**使用者安裝 v0.6.0-pre.5 後才生效**；在那之前沿用 L143 + T0490 第 6 節暫行對策（`bat-terminal` exit 0 後在主程序 mirror `bat-scripts.log` 找對應 `"script":"remote-server","event":"terminal-created"`，找不到即判定遺失）
- 實機驗收（使用者，可選）：裝 pre.5 後連續派發 ≥ 20 張（含成對派發），每個 helper `terminal-created result=ok` 都有對應的 `remote-server terminal-created`，且 helper 記錄的 `responseType` 為 `invoke-result`

## 不在本修復範圍

- **T0436 型（Worker 寫完回報、停在 commit 前且不通知）屬不同根因**：推測為共用檔 commit 範圍矛盾 / 權限提示讓 Worker 停住，而 ct-exec 中途停住時不會通知塔台。屬 skill 層（`~/.claude/skills/ct-exec`）另案，見 T0490 第 5 節、第 6 節 F
