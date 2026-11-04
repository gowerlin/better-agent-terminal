---
schema_version: 1
schema_kind: workorder
id: T0837
title: "BUG-211 重現：遠端 Claude 面板多張大圖是否讓 invoke frame 超過 32 MiB、整條連線被關閉"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-04T09:17:09+0800"
started_at: "2026-11-04T09:21:22+08:00"
updated_at: "2026-11-04T09:26:52+08:00"
completed_at: "2026-11-04T09:26:52+08:00"
session_ids:
  - "49872d68-9bc5-4a10-95ce-e3ecd9cc97c9"
depends_on: []
related:
  - "BUG-211；D272；T0828（研究的推論）；T0436（client 端讀圖）；PLAN-038"
affects_files:
  - _ct-workorders/T0837-bug211-repro-remote-image-frame.md
  - _ct-workorders/BUG-211-remote-images-exceed-ws-max-payload.md
  - electron/__tests__/bug211-ws-max-payload.test.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只重現、不修：不改產品程式碼。可新增一個重現測試檔（上列路徑；若改用 `scripts/smoke-remote-headless.mjs` 類的真 server 腳本，放 scratchpad 不進 repo，或回報後由塔台決定是否收進 repo）。不碰本機 BAT 安裝版與它的 Terminal Server、不連任何真實遠端主機。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。其他 Worker 同時在 main 執行。"
---

# T0837 — BUG-211 重現

## 元資料
- **工單編號**：T0837｜**類型**：research（重現）｜**狀態**：DONE｜**建立**：2026-11-04 09:17 (UTC+8)
- **intervention_type**：context-dependent

## 研究目標

確認 BUG-211 是否成立：遠端視窗 Claude 面板送出多張大圖時，`claude:send-message` 的 invoke frame 是否超過 server `WS_MAX_PAYLOAD_BYTES`（32 MiB，`electron/remote/remote-server.ts:126`），以及後果（ws close 1009？client 重連？其他分頁 / 進行中的 invoke 是否失敗？）。

## 調查範圍

1. 讀碼確認送出路徑與 frame 內容（面板 `MAX_IMAGES` / 單張上限、data URL 進 frame 的位置、client `RemoteClient` 的 `maxPayload`）。
2. 以真 `RemoteServer`（或 headless server）＋ `RemoteClient` 在測試中送一個 > 32 MiB 的 invoke frame，觀察 close code、client 事件、重連行為；另測 ~31 MiB 的對照。
3. 計算實際門檻：幾張多大的圖會超過（含 JSON / base64 開銷）。
4. 其他會送大 frame 的 channel（若讀碼看到）一併列出。

## 預期產出（回報區）
- 〈調查結論〉成立 / 不成立，附測試輸出與 close code
- 若成立：更新 BUG-211 的重現步驟與嚴重度建議；〈建議方向〉修法比較（送出前限制 vs 改走 PLAN-038 上傳通道 T0832–T0834 vs 調大 maxPayload 的風險）
- 若不成立：說明原因，建議塔台關單

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（BUG-211 **成立**，已以真 `RemoteServer` + `RemoteClient` 測試重現）
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（`electron/__tests__/`、`_ct-workorders/` 存在）；C-2 無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；BAT 變數 `BAT_TOWER_TERMINAL_ID` / `BAT_REMOTE_PORT` 存在，`BAT_REMOTE_TOKEN` 已設定。
- **變更檔案**：
  - `electron/__tests__/bug211-ws-max-payload.test.ts`（新增，重現測試，commit `319c3646`）
  - `_ct-workorders/BUG-211-remote-images-exceed-ws-max-payload.md`（重現結果、門檻、步驟、嚴重度建議）
  - 本工單
  - 產品程式碼：未改。
- **驗證**：
  - `npx vitest run electron/__tests__/bug211-ws-max-payload.test.ts --reporter=verbose` → 4 passed（3.25 s；輸出全文 `C:/Users/Gower/AppData/Local/Temp/claude/D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal/49872d68-9bc5-4a10-95ce-e3ecd9cc97c9/scratchpad/t0837-run.txt`）
  - `npm run typecheck:electron` → exit 0（`tsconfig.node.json` include `electron/**/*.ts`，含新測試）
  - 未碰本機 BAT 安裝版 / Terminal Server，未連任何真實遠端主機（全部 loopback、temp 憑證目錄）
- **Commit**：產品 `319c3646`（只含測試檔）；工單＋BUG-211 另一個 commit（見 git log）。未 push。
- **session_id**：49872d68-9bc5-4a10-95ce-e3ecd9cc97c9

### 互動紀錄
- 無（yolo，無提問；執行中沒有塔台補充段落）。

### 調查結論

**成立。** 一個 `claude:send-message` invoke frame 超過 33,554,432 bytes 時，server 的 `ws` 以 **1009** 關閉整條連線。

1. 讀碼（送出路徑）
   - 面板：`ClaudeAgentPanel.tsx:2213` `MAX_IMAGES = 5`（Codex 面板 `CodexAgentPanel.tsx:2313` 同）；單張上限 `MAX_ATTACHMENT_IMAGE_BYTES` = 10 MiB（`src/lib/image-attachment.ts:10`，拖放）／`MAX_IMAGE_SIZE`（`electron/path-guard.ts:135`，貼上 / 對話框）。
   - 送出：`ClaudeAgentPanel.tsx:1594` `sendMessage(sessionId, prompt, imageDataUrls)` → preload `claude:send-message` → `RemoteClient.invoke`（`electron/remote/remote-client.ts:664`）把所有 data URL 放進同一個 `JSON.stringify(frame)` 一次 `ws.send`。
   - server：`WebSocketServer({ maxPayload: WS_MAX_PAYLOAD_BYTES })`（`remote-server.ts:126` / `:617`）；client 的 `new WebSocket(url, { rejectUnauthorized: false })` 沒設 `maxPayload`（`ws` 8.20.0 預設 100 MiB，只限制 client 收的方向）。
2. 測試（`electron/__tests__/bug211-ws-max-payload.test.ts`）輸出摘錄：
   ```
   [T0837] frame bytes: 2×10MiB=27962181 3×10MiB=41943222 5×10MiB=69905304 3×8MiB=33554610 limit=33554432; max raw image bytes in one frame ≈ 25165731 (24.00 MiB)
   [T0837] raw over-limit close code=1009; server log: [RemoteServer] WebSocket error: Max payload size exceeded
   [RemoteClient] Disconnected
   [RemoteClient] Reconnecting in 1764ms (attempt 1)
   [T0837] send-message: rejected Connection closed; in-flight invoke: rejected Connection closed; client close codes=[1009]; server client counts=[1,2,1]
   [RemoteClient] Connected to 127.0.0.1:55302 (...)
   [T0837] after reconnect: server client counts=[1,2,1,2]; server log: ... | [RemoteServer] WebSocket error: Max payload size exceeded | [RemoteServer] Client authenticated: T0837 profile-A
   ```
   - 剛好 32 MiB：handler 收到並回 `invoke-result`；+1 byte：close 1009、handler 未被呼叫、同 server 其他連線仍 OPEN。
   - RemoteClient 2 × 10 MiB（27,962,181 bytes）正常送達。
   - RemoteClient 3 × 10 MiB（41,943,222 bytes）：close 1009；該次 send 與同一 client 另一個進行中的 invoke 都 reject `Connection closed`；`isReconnecting` = true，約 1.8 s 後自動重連，之後小 frame（含 1 KiB 圖片的 send-message）正常；另一個 profile 的 client 全程連線、invoke 正常。
3. 門檻：圖片原始大小合計約 **24 MiB**（25,165,731 bytes）以上即超過。2 張（各 ≤ 10 MiB）一定過；3 張合計 > 24 MiB（例 3 × 8 MiB = 33,554,610 bytes）必定斷線；5 × 10 MiB 約 70 MB。
4. 影響（測試證實的部分 + 讀碼推論，推論已標明）：
   - 證實：同一 profile 共用一個 `RemoteClient`，該 profile 所有分頁 / 視窗進行中的 invoke 一起失敗；其他 profile 不受影響；自動重連。
   - 推論（未實測）：renderer 送出前已 `clearInput()` / `setAttachedImages([])` / `setIsStreaming(true)`（`ClaudeAgentPanel.tsx:1547-1557`），遠端視窗不在本地加使用者訊息；`Connection closed` 不符 `No handler`，`showRemoteUnsupported`（`:1033`）會 rethrow → 無提示、訊息與圖片無聲遺失、面板可能停在「執行中」。斷線期間 server 推送的 event 不會補送。
   - server log 只記 `WebSocket error: Max payload size exceeded`，沒有 `Client disconnected`（error handler 先 `dropClient`，close handler 找不到 client，`remote-server.ts:785-801`）——診斷時看不出是哪個 client。
5. 其他會送大 frame 的 channel（client → server，受 32 MiB 限制）：讀 `PROXIED_CHANNELS`（`protocol.ts:36`）後，帶使用者內容的有 `claude:send-message`（圖片，唯一現實會超過的）、`pty:write`（貼上文字）、`snippet:create` / `update`、`github:pr-comment` / `issue-comment`、`workspace:save` / `settings:save`；後幾者正常使用遠小於 32 MiB，未測。server → client 方向受 client 預設 100 MiB 限制（`fs:readFile`、`pty:get-buffer`、`claude:load-archived` / `fetch-subagent-messages` 等可能較大），本單未測。

### 建議方向

| 方向 | 做法 | 優點 | 缺點 / 風險 |
|---|---|---|---|
| A. 送出前限制（建議先做） | ① `RemoteClient.invoke` 在 `ws.send` 前算 `Buffer.byteLength(frame)`，超過 server 上限即本地 reject（明確錯誤碼，例如 `FRAME_TOO_LARGE`），不送出 → 連線不斷，所有 channel 都受保護；② 面板遠端視窗送出前檢查圖片合計（留安全邊際，例如 ≤ 20 MiB），超過時提示並**保留輸入與附圖**；③ `showRemoteUnsupported` 之外補上一般錯誤的提示與 `isStreaming` 復原 | 小、立即止血；不改協定；新舊 bat-server 都適用（上限是 server 常數，client 寫同值或由 auth metadata 帶） | 遠端一次只能送 ~20 MiB 圖片；上限值兩邊要同步（建議 auth metadata 帶 `maxPayload`，舊 server 沒帶時用 32 MiB） |
| B. 圖片改走 PLAN-038 上傳通道（T0832–T0834） | 分段上傳到 server 暫存，`send-message` 只帶參考 | 根本解，大小不受單 frame 限制，也可以放寬總量 | 依賴 PLAN-038 進度與協定；舊 bat-server 不支援時仍需 A 當 fallback |
| C. 調大 `maxPayload` | 例如 100 MiB | 一行改動 | 不建議單獨採用：`maxPayload` 在 auth 前就生效，未認證的 peer 與 helper 權杖連線也能送大 frame，server 要整段緩衝＋`JSON.parse`（單執行緒，headless 下會卡住所有 PTY I/O）；5 × 10 MiB 仍有 70 MB 要過；已部署的舊 bat-server 不會變，需要 A 的 client 端保護才不斷線 |

建議：**A 先做**（client 端通用 frame 大小守門＋面板提示與保留輸入），**B 作為長期方案**併入 PLAN-038；**不採 C**。另可順手把 server 端 `Max payload size exceeded` log 補上 client label。

### 建議下一步
1. 塔台開 BUG-211 修正單（方向 A）：`electron/remote/remote-client.ts`（frame 大小守門）、`ClaudeAgentPanel.tsx` / `CodexAgentPanel.tsx`（遠端送出前檢查、保留輸入、錯誤提示、`isStreaming` 復原）、i18n；修好後改寫 `electron/__tests__/bug211-ws-max-payload.test.ts` 的 3 × 10 MiB 斷言（期望本地 reject、連線不斷）。
2. PLAN-038 上傳通道設計時把「圖片附件」列入用例（方向 B）。
3. BUG-211 維持 OPEN、severity medium；`_bug-tracker.md` 的「可重現」欄需由塔台同步（本單 `affects_files` 不含索引）。

### Renew 歷程
- 無。

### 遭遇問題
- 測試的 `console.info` 在預設 reporter 下通過時不顯示，改用 `--reporter=verbose` 取得證據。
- 我自己寫的門檻斷言下限一開始太緊（JSON 開銷約 100 bytes），第一次跑失敗後放寬為 `24 MiB - 256`；與產品行為無關。

### 回報時間
- 2026-11-04T09:26:04+08:00
