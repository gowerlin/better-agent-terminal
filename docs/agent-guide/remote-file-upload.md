# 遠端附件上傳暫存（PLAN-038）

> CLAUDE.md「遠端附件上傳暫存（PLAN-038 / T0832）」節的完整說明。設計 SoT：T0828 回報區〈調查結論〉2–5、7；使用者裁決 D272；介面契約：T0832 回報區〈介面契約〉（T0833–T0835 依此實作，不得單方更改）。

## 用途

遠端視窗（SSH、Docker 掛載外、WSL 其他 distro）附加 / 拖放的本機檔案，遠端 agent 讀不到（T0437 拒絕並提示）。PLAN-038 讓 client 把檔案內容經既有 WSS invoke 分塊傳到視窗所連的 host，暫存在 host 的 `<dataDir>/uploads/` 下，再把 host 路徑放進 prompt。

| 工單 | 範圍 | 狀態 |
|---|---|---|
| T0832（U1） | host 端暫存模組、4 個 `upload:*` channel、`claude:dispose-session` 清理、契約 | 本文件 |
| T0833（U2） | client 端上傳驅動（三種來源、依視窗 profile 轉送、stop-and-wait、重試、取消、進度） | 本文件「client 端（T0833）」 |
| T0834（U3） | Claude / Codex 面板接線（送出時上傳、chip 進度、取消、失敗退回） | 本文件「面板接線（T0834）」 |
| T0835（U4） | 終端分頁接線、分頁關閉刪暫存 | 待做 |

T0832 完成後使用者看不到任何變化：沒有 caller。失敗一律退回 T0437 的拒絕（D272），不加 Settings 開關。

## 必守規則

- 🔴 `upload:*` 不得加進 `HELPER_CHANNEL_ROLES`（`electron/remote/helper-capability.ts`）：helper / PTY 權杖呼叫不到（RemoteServer 回 `Forbidden: channel-not-allowed`）；handler 另外以 `ctx.helper` 回 `FORBIDDEN`（縱深防禦）。只有 server token 的 client 連線與本機 IPC 呼叫得到；持 server token 的 client 本來就能 `pty:write`，上傳不增加權限。
- 🔴 `upload:finish` 的 `serverPath` 不得被 `toClient` 正規化：列在 `SERVER_PATH_RESULT_CHANNELS`，不在 `PATH_RETURNING_CHANNELS`（它要原樣進給 host 上 agent 的 prompt）。
- 🔴 日誌只記 uploadId、session key 前 8 碼、大小、副檔名、結果、errno；不記檔名、內容、完整 session key。
- 🔴 外部輸入：session key 必須符合 `/^[a-zA-Z0-9._-]+$/`（≤ 128 字、不是 `.` / `..`）；所有路徑 `path.resolve` 後確認在 `<dataDir>/uploads/` 之下。
- 🔴 `electron/upload-staging.ts` 與 `electron/handlers/uploads.ts` 不 import electron（headless-electron-free 守門）；`UploadStaging` 只在第一次使用時呼叫 `getDataDir()`，不在 import 期取 userData（CLAUDE.md Logging 節規則 ②）。
- 暫存目錄**不加進** `workspace:sync-roots`（T0406 sandbox 只管 BAT 自己的 `fs:*`；加進去會讓檔案樹 / 預覽讀得到所有 session 的上傳）。

## 唯一實作

| 位置 | 內容 |
|---|---|
| `electron/upload-staging.ts` | `UploadStaging`（`begin` / `chunk` / `finish` / `abort` / `disposeSession` / `sweep` / `startSweeper`）、`UPLOAD_LIMITS` / `UPLOAD_TTL`、`sanitizeUploadName`、`isValidSessionKey`、錯誤碼 `UploadErrorCode` |
| `electron/handlers/uploads.ts` | `registerUploadHandlers`（4 個 channel，`UPLOAD_CHANNELS`） |
| `electron/handlers/claude.ts` | `ClaudeHandlerDeps.onSessionDisposed`（`claude:dispose-session` 之後呼叫，回傳值不變） |
| `electron/main.ts` | 模組層 `uploadStaging`（`getDataDir: () => app.getPath('userData')`）、`registerUploadHandlers`、`app.whenReady` 內 `uploadStaging.startSweeper()` |
| `electron/remote/headless-entry.ts` | `createHeadlessUploadModule`（每個 server 一個 `UploadStaging`，註冊時掃一次＋每小時，disposer 停計時器）；`createHeadlessHandlerModules({ upload: { onStaging } })` 交出實例 |
| `electron/remote/protocol.ts` / `path-aware-channels.ts` | `PROXIED_CHANNELS`、`PATH_FREE_CHANNELS`、`SERVER_PATH_RESULT_CHANNELS`（`upload:finish`） |

## 暫存目錄

- 位置：`<dataDir>/uploads/<sessionKey>/<uploadId>/<檔名>`。dataDir：本機 BAT = userData（`%APPDATA%\BetterAgentTerminal[-runtime-N]` 等）；headless = bat-server dataDir（Linux `~/.local/share/bat-server`，`XDG_DATA_HOME` 優先）。
- `uploadId`：host 產生，`crypto.randomBytes(8)` hex（16 字）；每次上傳一個新目錄（`mkdir` 不帶 recursive，目錄已存在就失敗），同名檔不會互相覆蓋。
- 寫入中是 `<檔名>.part`（`open(…, 'wx', 0o600)` 建立，之後 append），`finish` 比對 sha256 後 rename。
- 權限（POSIX）：`uploads/`、session、upload 目錄 0700（`mkdir({ mode })` 後再 `chmod`，已存在的較寬目錄也收緊）；檔案 0600。Windows host 沿用 `%APPDATA%` 的 ACL。

### 檔名清理（`sanitizeUploadName`，各平台同一結果）

1. 只取 basename（`/` 與 `\` 都當分隔）。
2. 去掉控制字元（U+0000–U+001F、U+007F–U+009F）；`< > : " | ? *` 改成 `_`。
3. 去掉開頭空白、結尾的點與空白；結果是空的（含 `.` / `..`）→ `file`。開頭的點保留（`.bashrc`）。
4. Windows 保留裝置名（`CON` / `PRN` / `AUX` / `NUL` / `COM0–9` / `LPT0–9`，不分大小寫、含副檔名）前面加 `_`。
5. 長度：≤ 120 個 code point 且 ≤ 200 UTF-8 位元組（ext4 / APFS 單一名稱上限 255 位元組，含 `.part` 仍有餘裕），保留副檔名（副檔名 > 20 字時視為檔名的一部分）；不切開代理對。

空白會保留（`截圖 2026-11-04.png`），放進 prompt 時的引號 / 跳脫由 T0834 / T0835 處理。

## 上限（D272）

| 上限 | 值 | 誰檢查 | 錯誤碼 |
|---|---|---|---|
| 單檔 | 50 MiB | host `begin` | `TOO_LARGE` |
| 單次送出合計 | 100 MiB | client（T0833） | — |
| 單次送出檔數 | 10 | client（T0833） | — |
| 每個 session key 暫存合計（已完成＋進行中宣告大小） | 500 MiB | host `begin` | `QUOTA` |
| 每個 session key 同時進行中 | 10 | host `begin` | `TOO_MANY` |
| 單一 chunk（原始位元組） | 256 KiB（base64 約 342 KiB） | host `chunk` | `BAD_CHUNK` |
| 磁碟可用空間 | ≥ 檔案大小 + 64 MiB | host `begin`（`fs.statfs`；拿不到就略過並記一行） | `NO_SPACE` |

常數：`UPLOAD_LIMITS`（`electron/upload-staging.ts`），client 端共用同一份。配額超過時不自動刪舊檔（避免刪掉 agent 還要讀的檔）。

## 清理

| 時機 | 動作 |
|---|---|
| `claude:dispose-session(sessionId)`（面板關閉，Claude 與 Codex 都會） | 刪 `<uploads>/<sessionId>/`，中止該 session 進行中的上傳 |
| 終端分頁關閉（T0835） | T0835 在 host 的 PTY 真正結束（`pty:kill` / 結束，不含 ⏻ 重啟）時呼叫 `uploadStaging.disposeSession(ptyId)`（本機：`electron/main.ts` 的 `uploadStaging`；headless：`createHeadlessHandlerModules({ upload: { onStaging } })` 交出的實例） |
| 啟動時＋每小時（`startSweeper`） | 刪最後寫入超過 24 h 的上傳；刪還有 `.part`、超過 10 分鐘、且不屬於進行中上傳的目錄（前一個行程留下的）；刪空的 session 目錄 |
| 進行中上傳 10 分鐘沒有新 chunk | `begin` 與 sweep 時中止並刪除 |

不採「回合結束即刪」：agent 之後的回合可能再讀同一檔（T0828〈調查結論〉3）。連線中斷不續傳：該次上傳由 10 分鐘閒置規則清掉。

## 傳輸

- 沿用 invoke frame，不加 binary frame；stop-and-wait（一次一個 chunk 在途，等回應再送下一塊），多檔依序上傳（T0828〈調查結論〉2）。
- `chunk` 的 offset 必須等於已收位元組；**重送上一塊**（同 offset、同長度、同 sha256）回 `{ ok: true, received }` 而不重寫，讓 invoke 逾時後重試 1 次是冪等的。其他不連續 → `BAD_OFFSET`。
- 同一個 upload 的 chunk / finish / abort 在 host 端排隊執行；sha256 邊收邊算，`finish` 不重讀檔。
- 舊 bat-server 沒有 handler → invoke 失敗 `No handler for channel: upload:begin`，client 退回 T0437 拒絕。

## client 端（T0833）

T0833 完成後使用者仍看不到變化：caller 是 T0834（面板）與 T0835（終端）。

### 必守規則

- 🔴 main 不讀 renderer 自己給的路徑（T0436）。三種來源：`file` = renderer 手上的 `File` / `Blob`，由 renderer `slice()` 成 256 KiB 交給 main；`path` = main 自己從 `dialog:select-attachments` 回給**同一個視窗**的路徑（`UploadClient.noteSelectedPaths`，其他路徑一律 `NOT_SELECTED`、不 stat、不讀）；`clipboard-image` = main 自己讀剪貼簿 PNG（`readClipboardPng`）。
- 🔴 `upload-client:*` 是本機 `ipcMain.handle`，**不在** `PROXIED_CHANNELS`、不在 `HELPER_CHANNEL_ROLES`。main 依呼叫視窗綁定的 profile 轉送到**該 profile 自己的** live `RemoteClient`（路由規則與 `bindProxiedHandlersToIpc` 相同：`resolveUploadRoute`，detached 視窗用父視窗的 profile）；本機視窗 → `NOT_REMOTE`（不上傳，照舊附加路徑），遠端視窗沒有 live 連線 → `NOT_CONNECTED`。🔴 絕不 fallback 本機、不借用別的 profile 的連線。
- 🔴 stop-and-wait：每個 transfer 一次只有一個 call 在途（第二個 → `BUSY`），一次送出的多檔依序上傳（renderer driver）。只有 chunk 的 invoke **逾時**（`Remote invoke timeout:`）重送同一塊 1 次（同 offset、同 base64）；其他錯誤、第二次逾時、host 拒絕 → 該檔失敗並 `upload:abort`（best effort）。`begin` / `finish` 不重試（重送 `begin` 會在 host 多開一個上傳）。
- 🔴 sha256 由 main 對**實際送出且 host 已確認**的位元組邊送邊算（重送不重算）。
- 🔴 日誌 `[upload-client] …` 只記 transfer / upload id、session key 前 8 碼、大小、副檔名、結果；不記檔名、路徑、內容（契約 C-10）。

### 唯一實作

| 位置 | 內容 |
|---|---|
| `electron/upload-client.ts` | `UploadClient`（`prepare` / `begin` / `chunk` / `finish` / `run` / `abort` / `disposeSender` / `expireIdle` / `noteSelectedPaths`）、`classifyInvokeError`、`UPLOAD_CLIENT_TIMEOUTS`；不 import electron（main 經 `UploadClientDeps` 注入路由、invoke、剪貼簿、進度推送） |
| `electron/main.ts` | 模組層 `uploadClient`、`resolveUploadRoute`、`trackUploadSender`（視窗 `destroyed` → `disposeSender`）；`registerLocalHandlers` 的 6 個 `ipcMain.handle('upload-client:…')`；`dialog:select-attachments` 記下回傳的 `files` |
| `electron/preload.ts` / `src/types/electron.d.ts` | `window.electronAPI.upload`（`RemoteUploadApi`） |
| `src/lib/remote-upload.ts` | renderer driver `uploadToRemoteHost(sessionKey, sources, { onProgress, signal })`、型別、`REMOTE_UPLOAD_LIMITS`（`UPLOAD_LIMITS` 的鏡像，parity 測試守住）、`stopsRemainingUploads` |

### IPC（本機）

| channel | 參數 | 回傳 | 用於 |
|---|---|---|---|
| `upload-client:prepare` | `(sessionKey, sources: RemoteUploadSourceDescriptor[])` | `{ ok, batchId, items: [{ ok, transferId, kind, name, size } \| failure] }` 或 failure | 全部來源；不連網 |
| `upload-client:begin` | `(transferId)` | `{ ok, chunkBytes }` | `file` |
| `upload-client:chunk` | `(transferId, offset, data: Uint8Array)` | `{ ok, received }` | `file` |
| `upload-client:finish` | `(transferId)` | `{ ok, serverPath, size }` | `file` |
| `upload-client:run` | `(transferId)` | `{ ok, serverPath, size }` | `path` / `clipboard-image`（main 讀檔並跑完 begin → chunks → finish） |
| `upload-client:abort` | `(transferId \| batchId)` | `{ ok: true, aborted: n }`（冪等） | 取消 |
| `upload-client:progress`（main → renderer 事件） | `{ batchId, transferId, received, size }` | — | host 每確認一塊推一次 |

失敗一律 `{ ok: false, code, message }`，不丟例外（`message` 只供日誌）。transfer 綁呼叫的視窗：別的視窗的 id → `NOT_FOUND`。

### renderer driver（給 T0834 / T0835）

```ts
import { uploadToRemoteHost } from '../lib/remote-upload'

const outcome = await uploadToRemoteHost(sessionId /* 面板 sessionId 或終端 PTY id */, [
  { kind: 'file', file },              // 拖放的 File
  { kind: 'path', path },              // dialog:select-attachments 回傳的 files[i]
  { kind: 'clipboard-image' },         // 終端 Ctrl+V 的圖片
], { onProgress, signal })
// outcome.items[i]: { ok: true, name, serverPath, size } | { ok: false, code, message, name? }
```

- 不丟例外；IPC 失敗 → `TRANSPORT`。結果順序與 `sources` 相同；`name` 是原檔名（面板顯示用），`serverPath` 原樣放進 prompt（契約 C-7，自己加引號）。
- 一檔失敗不影響下一檔；`stopsRemainingUploads(code)` 為真（`NOT_REMOTE` / `NOT_CONNECTED` / `SERVER_TOO_OLD` / `TRANSPORT` / `CANCELLED` / `FORBIDDEN`）時其餘的檔不再嘗試、回同一個 code。
- `signal` abort → 送 `upload-client:abort(batchId)`，在途的那一塊回來後結束，未完成的項目 `CANCELLED`、`outcome.cancelled = true`。
- 任何 `ok: false` → 該附件退回 T0437 拒絕＋toast（D272）。`NOT_REMOTE` 表示本機視窗，照舊直接附加路徑。

### 上限（client 端，D272 / 契約 C-9）

| 上限 | 檢查 | 結果 |
|---|---|---|
| 一次送出 > 10 檔 | `prepare` | 整批 `TOO_MANY_FILES`，不上傳 |
| 一次送出合計 > 100 MiB（只算可上傳的項目） | `prepare` | 整批 `SEND_TOO_LARGE`，不上傳 |
| 單檔 > 50 MiB | `prepare` | 該項 `TOO_LARGE`，其他照傳 |
| 一個視窗同時持有 > 20 個 transfer | `prepare` | 整批 `TOO_MANY` |
| transfer 10 分鐘沒有 call（renderer 中途消失） | 下一次 `prepare` | 取消並 `upload:abort` |

### client 端錯誤碼（host 的碼見上方「上限」與 T0832 契約 C-3，原樣轉回）

| code | 何時 |
|---|---|
| `NOT_REMOTE` | 本機視窗 |
| `NOT_CONNECTED` | 遠端視窗沒有自己 profile 的 live 連線（prepare 時或途中斷線） |
| `SERVER_TOO_OLD` | host 回 `No handler for channel: upload:…`（T0832 前的 bat-server） |
| `TRANSPORT` | 其他 invoke 失敗 / 逾時（chunk 已重送 1 次）、host 回傳形狀不對 |
| `CANCELLED` | 取消 |
| `BUSY` | 同一 transfer 已有 call 在途 |
| `NOT_SELECTED` | `path` 不是 main 從附件對話框回給這個視窗的 |
| `SOURCE_ERROR` | 檔案不存在 / 不是一般檔 / 上傳中變短、剪貼簿沒有圖片 |
| `SEND_TOO_LARGE` / `TOO_MANY_FILES` | 見上表 |

### 已知限制

- `path` 來源只認 `dialog:select-attachments` 的 `files`（非圖片）；面板的圖片仍走 data URL（T0436），拖放的非圖片檔由面板保留 `File` 物件走 `file` 來源（T0834）。
- 剪貼簿圖片在 `prepare` 時讀取並暫存在 main 記憶體（≤ 50 MiB），`run` 結束即釋放；只 prepare 不 run 的由 10 分鐘閒置規則或 `abort(batchId)` 釋放（driver 結束時一定送）。
- 不續傳：連線中斷 = 該次失敗（host 由 10 分鐘閒置規則清掉部分檔）。

## 面板接線（T0834）

Claude / Codex 面板的檔案附件在**送出時**上傳（不是附加時：附加後又移除的檔不會上傳，也不用追蹤清理）。

### 必守規則

- 🔴 只在 `remote:resolve-client-paths` 的答覆不可達且有 `reason`（`invalid-path` 除外）時上傳；可達的（本機視窗、WSL 同 distro、`/mnt/c`、Docker 掛載內）照舊送 `@<host 路徑>`，不呼叫任何 `upload` API。沒有答覆 / 答覆對不上 / `invalid-path` 照舊拒絕（fail-closed）。
- 🔴 上傳失敗、超過上限（D272）、舊 bat-server（`SERVER_TOO_OLD`）、斷線 → 該附件退回 T0437 拒絕＋toast（T0437 的句子後面接原因），其餘照送；沒有其他可送的內容時只移除被拒的 chip、不送出（同 T0437）。不加 Settings 開關（D272）。
- 🔴 上傳完成後才進入既有送出路徑（T0815 排進同一個 query、`queuedNoteKey`、權限卡 / 提問卡、T0842 的失敗復原都不變）；上傳期間主回合可能開始或結束，所以**有上傳時**改讀 `isStreamingRef` / `isInterruptedRef`，沒有上傳時仍用送出當下的 state（行為與 T0834 前相同）。
- 🔴 圖片不走上傳：照舊 data URL ＋ T0842 的遠端圖片預算 `checkRemoteImageBudget`（在上傳之前檢查）；非圖片附件走上傳，不計入圖片預算。
- 上傳期間：送出鍵停用（Enter 也不送，`uploadAbortRef` 守門）、輸入框 `readOnly`、不能加附件（拖放 / 貼上 / 對話框都被忽略）、「+」隱藏、圖片的 × 停用；檔案 chip 顯示「上傳中 N%」，chip 的 × 變成「取消上傳」。
- 取消：chip 的 × 或在輸入框按 Esc（上傳期間 Esc 不清除草稿）→ 整批取消（`AbortController` → driver 送 `upload-client:abort(batchId)`），不送出、輸入與附件保留，toast「已取消上傳」。面板卸載時也取消。
- 來源：拖放 / macOS Finder 貼上的檔保留 `File`（`AttachedFile.file`）走 `file` 來源（renderer 分塊）；對話框選的檔沒有 `File`，走 `path` 來源（main 已記白名單）。session key = 面板的 `sessionId`（契約 C-5）。
- 顯示：上傳的檔在本機訊息的附件註記用原檔名；其他檔照舊取 host 路徑最後一段。

### 唯一實作

| 位置 | 內容 |
|---|---|
| `src/lib/client-paths.ts` | `resolveAttachmentsForSend`（解析 → 分類 `classifyResolvedPaths` → 一次 `uploadToRemoteHost` → `serverPaths` / `displayNames` / `rejected` / `uploadFailed` / `cancelled`，不丟例外）、`isUploadableReason`、`uploadFailureReason`（code → `claude.uploadError.*`）、`attachmentRefusalText`（toast 文字） |
| `src/components/ClaudeAgentPanel.tsx` / `CodexAgentPanel.tsx` | `handleSend` 的附件段（`uploadProgress`、`uploadAbortRef`、`cancelUpload`）、`addFileByPath(path, file?)`、chip 進度 / 取消、送出鍵 `disabled`、輸入框 `readOnly` |
| `src/locales/{en,zh-TW,zh-CN}.json` | `claude.attachmentUploadFailed` / `attachmentUploadCancelled` / `attachmentUploading` / `cancelAttachmentUpload` / `sendDisabledWhileUploading` / `uploadError.*` |

### 原因對照（toast）

| code | 文字（en） |
|---|---|
| `TOO_LARGE` | over the 50 MiB per-file limit |
| `SEND_TOO_LARGE` | over the 100 MiB per-message limit |
| `TOO_MANY_FILES` | more than 10 files in one message |
| `QUOTA` / `TOO_MANY` | the upload space for this session on the remote host is full |
| `NO_SPACE` | the remote host is out of disk space |
| `SERVER_TOO_OLD` | the BAT server on the remote host is too old to accept uploads; update it |
| `NOT_CONNECTED` / `TRANSPORT` | the connection to the remote host failed |
| `SOURCE_ERROR` / `NOT_SELECTED` | the file could not be read |
| 其他 | error `<code>` |

### 日誌

renderer 經 `debug.log` 記一行 `[attachments] upload: files=<n> ok=<n> failed=<n>[ cancelled][ codes=<code,…>]`，只有數量與錯誤碼，不記檔名 / 路徑（main 端 `[upload-client]` 日誌見上節）。

### 已知限制

- 送出失敗（T0842 復原）後再送一次會重新上傳（新的 `serverPath`）；host 端舊的暫存由 TTL 清除。
- 同一個面板一次只有一個上傳；上傳在送出鍵按下後、`resolve-client-paths` 回來之前不鎖定（與 T0437 前相同的短暫空窗）。

## 日誌

`[upload] begin|finish|abort|expire|dispose|sweep|chunk|remove …`，例：

```
[upload] begin id=0f3a9c1e5b7d2468 session=0f8e6a1c size=183402 ext=.png result=ok
[upload] finish id=0f3a9c1e5b7d2468 session=0f8e6a1c size=183402 ext=.png result=ok
[upload] begin session=0f8e6a1c size=73400320 ext=.zip result=TOO_LARGE
[upload] dispose session=0f8e6a1c result=ok
```

本機寫進 BAT 的 debug log；headless 經 `logger`（bat-server stdout / journal）。

## 已知限制

- 兩個並發的 `begin` 同一個 session key 可能同時通過配額檢查（client 是逐檔依序上傳，實際不會發生）。
- 持 server token 的 client 可以 chunk / abort 別人的 uploadId（同等權限，不另外綁連線）。
- 本機 BAT 的上傳目錄在 userData 下，與 headless 一樣不跨 runtime（`-runtime-N`）共用。
- 磁碟空間檢查只在 `begin`；寫入途中滿了以 `ENOSPC` → `NO_SPACE` 並刪除部分檔。

## 驗證

| 項目 | 位置 |
|---|---|
| 單元：檔名表、session key 白名單、路徑穿越、offset、重送、並發、BAD_CHUNK、SIZE / HASH_MISMATCH、配額、TOO_MANY、statfs、ENOSPC、TTL、dispose、0700 / 0600（POSIX）、日誌不含檔名、handler 拒絕 helper、channel 分類、dispose-session 掛勾 | `electron/__tests__/upload-staging.test.ts` |
| 真 headless server（in-process、WSS）：上傳、權限、dispose、未認證與 tower / worker 權杖被拒 | `electron/remote/__tests__/headless-upload-e2e.test.ts` |
| channel 守門 | `headless-parity.test.ts`、`path-aware-channels-coverage.test.ts`、`proxied-channels-binding.test.ts`、`headless-electron-free.test.ts` |
| 已部署 server 的協定層 smoke | `scripts/smoke-remote-headless.mjs` S14（見 T0832 回報區） |
| client 端（T0833）：main driver 對真 `UploadStaging`（假 invoke）：stop-and-wait / `BUSY`、chunk 逾時重送 1 次（host 已寫入仍冪等）、第二次逾時 / 非逾時錯誤不重試、取消、舊 server、路由（本機 / 斷線 / 途中斷線）、上限、dialog 路徑白名單、剪貼簿、閒置、日誌不含檔名、main / preload 接線 source guard | `electron/__tests__/upload-client.test.ts` |
| client 端（T0833）：renderer driver（依序、批次 / 單項失敗、致命碼停止、取消、進度、預設 API） | `src/lib/__tests__/remote-upload.test.ts` |
| 面板（T0834）：分類（可達 / 上傳 / 拒絕、`invalid-path`、fail-closed）、`file` / `path` 來源與順序、進度對應、失敗 / 取消 / 例外、日誌只有數量、原因對照與 toast 文字 | `src/lib/__tests__/client-paths-upload.test.ts` |
| 面板（T0834）RTL：兩面板 × {全部上傳、單檔超過上限、舊 server 退回、上傳失敗且無其他內容、進度＋送出停用＋取消保留草稿、WSL 可達不上傳}、本機視窗不變（不呼叫 upload、附件註記同 T0834 前） | `src/__tests__/remote-upload-panels.test.tsx`；T0437 的 `attachment-remote-paths.test.tsx` 照舊通過 |
