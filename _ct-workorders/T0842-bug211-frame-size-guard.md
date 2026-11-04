---
schema_version: 1
schema_kind: workorder
id: T0842
title: "BUG-211 修正（方向 A）：RemoteClient 送出前 frame 大小守門、不斷線；Claude / Codex 面板遠端送出前檢查圖片合計並保留輸入；失敗提示與 isStreaming 復原"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-04T11:14:45+0800"
started_at: "2026-11-04T11:16:57+0800"
updated_at: "2026-11-04T11:26:49+0800"
completed_at: "2026-11-04T11:26:49+0800"
session_ids:
  - "4c5fdd37-fb82-4730-acd6-ebf3780eced8"
depends_on: []
related:
  - "BUG-211；D273；T0837 回報區（重現、門檻、〈建議方向〉A、〈建議下一步〉1）；`electron/__tests__/bug211-ws-max-payload.test.ts`（`319c3646`）；PLAN-038（方向 B 長期）"
affects_files:
  - _ct-workorders/T0842-bug211-frame-size-guard.md
  - _ct-workorders/BUG-211-remote-images-exceed-ws-max-payload.md
  - electron/remote/ws-limits.ts
  - electron/remote/remote-client.ts
  - electron/remote/remote-server.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/components/CodexAgentPanel.tsx
  - src/lib/remote-image-budget.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - electron/remote/__tests__/
  - src/lib/__tests__/
  - src/components/__tests__/
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 不改 `electron/remote/protocol.ts`、`electron/main.ts`、`electron/preload.ts`（T0832 / T0833 同時在改）；不調大 server `maxPayload`（T0837 方向 C 否決：auth 前就生效）；不做 auth metadata 協商（舊 server 同為 32 MiB，client 用共用常數即可）。上限常數抽到 `electron/remote/ws-limits.ts`，server 與 client 共用。"
  - "🔴 本機視窗（非遠端）的送出行為、圖片上限完全不變；遠端視窗合計 ≤ 門檻時行為不變。T0815 的送出流程（排進同一個 query、`queuedNoteKey`、權限 / 提問卡）不得改變；錯誤處理只在送出失敗時補提示與 `isStreaming` 復原，不改成功路徑。"
  - "🔴 T0834（PLAN-038 面板接線）之後也會改兩個面板：本單只做送出前檢查與失敗復原，邏輯集中在 `src/lib/remote-image-budget.ts`，面板只接線，方便 T0834 合流。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`，不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。T0832 同時在 main 執行。"
---

# T0842 — BUG-211 修正（frame 大小守門）

## 元資料
- **工單編號**：T0842｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 11:14 (UTC+8)
- **規模**：M｜**降級**：先完成 ① client 守門（連線不斷），② 面板檢查與 ③ 失敗復原可回 PARTIAL

## 任務指令

### 前置條件
- `_ct-workorders/T0837-bug211-repro-remote-image-frame.md` 回報區、`BUG-211-*.md`
- `electron/__tests__/bug211-ws-max-payload.test.ts`
- `CLAUDE.md`「Sub-agent / Active Tasks Tracking」節（T0815 送出流程）、「多 remote profile 同時連線」節

### 任務
1. **client 守門**：`RemoteClient.invoke`（與其他會 `ws.send` 的路徑）在送出前算 `Buffer.byteLength(frame)`；超過 `WS_MAX_PAYLOAD_BYTES` → 本地 reject 明確錯誤（例如 `FRAME_TOO_LARGE`，含大小與上限），不送出、連線不斷。
2. **server 日誌**：`Max payload size exceeded` 的 log 補 client label（T0837 發現看不出是哪個 client）；其餘 server 行為不變。
3. **面板（遠端視窗）**：送出前以 `remote-image-budget.ts` 檢查圖片合計（留安全邊際，例如原始合計 ≤ 20 MiB；值與理由寫進註解與回報）；超過 → 提示（i18n），**保留輸入與附圖**、不送出。
4. **失敗復原**：遠端送出遇到 `FRAME_TOO_LARGE` 或 `Connection closed` 等錯誤時，給使用者提示、`isStreaming` 復原、輸入不遺失（能恢復就恢復，做不到的寫進回報）。
5. **測試**：改寫 `bug211-ws-max-payload.test.ts`：3 × 10 MiB 期望本地 reject、連線不斷、其他 invoke 不受影響；保留「剛好上限 / +1 byte 的 raw ws」斷言作為 server 行為記錄。面板 RTL：遠端超過門檻 → 提示且保留；本機視窗不受影響。
6. **文件**：`CHANGELOG.md` `[Unreleased]` Fixed（BUG-211）；回報區寫 BUG-211 應改的狀態（FIXED）與修正 commit。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（① client 守門、② server 日誌、③ 面板檢查、④ 失敗復原、⑤ 測試、⑥ 文件全部完成）
- **BUG-211 應改狀態**：**FIXED**（已改，修正 commit `bb8cbe1a`；待部署驗證：遠端視窗實機附 3 張大圖送出 → 提示且連線不斷）。`_bug-tracker.md` 索引不在本單 `affects_files`，請塔台同步。
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（`electron/remote/`、`src/lib/` 等存在）；C-2 無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_TOWER_TERMINAL_ID` / `BAT_REMOTE_PORT` 存在，`BAT_REMOTE_TOKEN` 已設定。
- **Commit**：產品 `bb8cbe1a`（14 檔，只含本單範圍，`git add <明確路徑>`）；工單＋BUG-211 另一個 commit。未 push。
- **session_id**：4c5fdd37-fb82-4730-acd6-ebf3780eced8

### 產出摘要

**變更檔案（`bb8cbe1a`）**
- `electron/remote/ws-limits.ts`（新）：`WS_MAX_PAYLOAD_BYTES` = 32 MiB（server / client 共用）、`FRAME_TOO_LARGE`、`frameTooLargeMessage`、`encodeFrameWithinLimit`（`Buffer.byteLength` 計 UTF-8 bytes；不 import electron，headless 可用）。
- `electron/remote/remote-client.ts`：`invoke` 送出前檢查，超過 → `logger.warn` 一行＋本機 reject（`Error`，message `FRAME_TOO_LARGE: <channel> frame is <n> bytes; the remote connection accepts at most 33554432 bytes`，另帶 `code` / `bytes` / `limit`），不送出、不建 pending、連線不斷。auth frame 同樣經檢查（實務上不會超過，超過時以 `errorCode: 'network'` 結束連線嘗試）。client 只有這兩處 `ws.send`（source guard 守住）。
- `electron/remote/remote-server.ts`：改用共用常數（`maxPayload` 值不變）；`ws.on('error')` 日誌補 `(client: <label>)` / `(helper: <role> <terminalId>)` / `(unauthenticated)`（新 `describeConnection`，不記權杖與 IP）。其餘行為不變。
- `src/lib/remote-image-budget.ts`（新，純函式）：`REMOTE_IMAGE_BUDGET_BYTES` = **20 MiB**（圖片解碼後合計）。理由（亦寫在註解）：20 MiB 經 base64 = 26.67 MiB，32 MiB frame 還留約 5.3 MiB 給 prompt、`@path` 前綴、路徑轉換與 JSON 跳脫（CJK 3 bytes、控制字元最多 6 bytes）；T0837 實測硬上限約 24 MiB（短 prompt）；兩張 10 MiB（面板單張上限）剛好可送，三張大圖不行。另含 `checkRemoteImageBudget`（本機視窗一律 null）、`classifyRemoteSendFailure` / `remoteSendFailureMessage`（剝除 IPC 包裝、解析大小）、`restoredInputText` / `restoredAttachments`（不丟失使用者之後輸入的文字與附件）。
- `src/components/ClaudeAgentPanel.tsx` / `CodexAgentPanel.tsx`（只接線）：
  - 送出前（任何清除之前）遠端視窗檢查圖片合計，超過 → warning toast（10 s）並 return：輸入、附圖、附件都保留，不送出。
  - 送出失敗：本機視窗 → 行為不變（Claude 照舊 `showRemoteUnsupported`，Codex 照舊 rethrow）；遠端「No handler」→ 照舊 `showRemoteUnsupported`（Claude）；其他遠端失敗 → 系統訊息說明原因、輸入與附件放回、`queuedTurnMsgIdsRef` / `currentTurnMsgIdRef` 還原、這次送出若開始了「執行中」則還原 `isStreaming` / `isInterrupted` 為送出前的值、`debug.log` 一行。成功路徑與 T0815 流程（排進同一個 query、`queuedNoteKey`、權限 / 提問卡）未改。
  - Codex 面板新增 `useIsRemoteWindow()`（Claude 面板已有）。
- `src/locales/{en,zh-TW,zh-CN}.json`：`claude.remoteImagesTooLarge` / `remoteSendTooLarge` / `remoteSendTooLargeNoSize` / `remoteSendFailed`。
- `CHANGELOG.md` `[Unreleased]` 新增 `### Fixed`（BUG-211）。
- 測試：`electron/__tests__/bug211-ws-max-payload.test.ts`（改寫）、`electron/remote/__tests__/ws-limits.test.ts`（新）、`src/lib/__tests__/remote-image-budget.test.ts`（新）、`src/__tests__/remote-image-budget-panel.test.tsx`（新）。

**測試改寫重點（`bug211-ws-max-payload.test.ts`）**
- 3 × 10 MiB：期望本機 reject `FRAME_TOO_LARGE`（實測 frame 41,943,230 bytes）、client close codes `[]`、`isConnected` true、`isReconnecting` false、server client 計數 `[1, 2]`（沒人離開）、server 無 `Max payload size exceeded`；同 client 進行中的 invoke 仍 resolve `slow-done`；之後 ping 與 2 × 10 MiB 正常；另一 profile 不受影響。
- 保留 raw ws「剛好 32 MiB 可達 / +1 byte → 1009」斷言作為 server 行為紀錄，另斷言日誌含 `(client: T0837 raw)`。
- 新增：共用常數 = 32 MiB；20 MiB 預算內的圖片＋約 1.6 MB CJK prompt 仍小於 32 MiB；2 × 10 MiB 過預算檢查、3 × 10 MiB 不過。
- `fakeImageDataUrl` 改為帶正確 base64 padding（長度不變，T0837 的數字完全相同：2×10MiB=27962181、3×10MiB=41943222…），使解碼大小精確。

**面板 RTL（`remote-image-budget-panel.test.tsx`，Claude / Codex 各一組）**：遠端 3 × 8 MiB → toast「24.0 MiB … at most 20.0 MiB」、未呼叫 `sendMessage`、輸入與 3 張縮圖保留、無停止鈕；遠端 2 × 10 MiB → 照常送出；遠端 `FRAME_TOO_LARGE` 失敗 → 系統訊息「40.0 MiB … 32.0 MiB」、輸入與縮圖放回、無停止鈕；遠端 `Connection closed` → 原因顯示、輸入放回、無停止鈕；本機視窗（Claude / Codex）3 × 8 MiB → 照常送出、無 toast。

**驗證**（`validated_sha` 時的工作樹 = `bb8cbe1a` 的內容；同時存在 T0832 未提交的其他檔案變更，驗證時一併在工作樹中）
- `npm run typecheck` → 0 錯誤；`npm run typecheck:electron` → 0 錯誤
- `npm run test:unit` → exit 0，Test Files 421 passed | 3 skipped（424），Tests 7368 passed | 40 skipped（7408）
- `npx vitest run electron/__tests__/bug211-ws-max-payload.test.ts --reporter=verbose` → 5 passed
- `npx vite build` → exit 0
- 未連任何真實遠端主機（全部 loopback、temp 憑證目錄）；實機驗證留給部署驗收。

**相關通過案例**：工單無〈相關通過案例〉段落，不適用。

**後續建議**
1. `_bug-tracker.md` 同步 BUG-211 → FIXED（索引不在本單範圍）。
2. 部署驗證：遠端視窗（WSL / SSH）附 3 張 > 8 MiB 圖片送出 → 應出現提示、不送出、連線不斷；2 張照常。
3. CLAUDE.md「多 remote profile 同時連線」或 `docs/agent-guide/multi-remote-profiles.md` 可補一行 `ws-limits.ts` / `FRAME_TOO_LARGE` 規則（不在本單 `affects_files`，未改）。
4. T0834（PLAN-038 面板接線）合流時：圖片改走上傳通道後，`checkRemoteImageBudget` 可依 server 是否支援上傳決定是否套用。

### 互動紀錄
- 無（yolo，無提問；三個檢查點都沒有塔台補充段落）。

### Renew 歷程
- 無。

### 遭遇問題
- 一次以 Bash heredoc 送出較長的 Python 修改腳本時腳本被截斷（未寫入任何檔案），改用 Write 寫腳本檔後執行；與產品無關。
- 第一次跑改寫後的測試有 2 個失敗，都是測試本身的假設：① 假圖片沒有 base64 padding，解碼大小被進位，2 × 10 MiB 被算成 20 MiB + 4 → 改為帶正確 padding（長度不變）；② server client 計數斷言寫成「不含 1」，但第一個 client 連上時計數本來就是 1 → 改為 `toEqual([1, 2])`。
- 已知限制（寫進 BUG-211）：fork 後自動送出 pending 圖片的路徑（`onHistory`）沒有面板檢查，只靠 client 守門（不斷線但無提示）；送出時若已有回合在跑（T0815 排隊）且失敗是連線中斷，`isStreaming` 維持原值（回合仍在遠端跑，斷線期間的 event 不會補送，屬既有行為）；`Connection closed` 有可能發生在 server 已收到之後，因此提示文字寫「可能沒有送到，請確認對話後再送出」。

### 回報時間
- 2026-11-04T11:25:45+0800
