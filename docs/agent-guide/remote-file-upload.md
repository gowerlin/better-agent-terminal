# 遠端附件上傳暫存（PLAN-038）

> CLAUDE.md「遠端附件上傳暫存（PLAN-038 / T0832）」節的完整說明。設計 SoT：T0828 回報區〈調查結論〉2–5、7；使用者裁決 D272；介面契約：T0832 回報區〈介面契約〉（T0833–T0835 依此實作，不得單方更改）。

## 用途

遠端視窗（SSH、Docker 掛載外、WSL 其他 distro）附加 / 拖放的本機檔案，遠端 agent 讀不到（T0437 拒絕並提示）。PLAN-038 讓 client 把檔案內容經既有 WSS invoke 分塊傳到視窗所連的 host，暫存在 host 的 `<dataDir>/uploads/` 下，再把 host 路徑放進 prompt。

| 工單 | 範圍 | 狀態 |
|---|---|---|
| T0832（U1） | host 端暫存模組、4 個 `upload:*` channel、`claude:dispose-session` 清理、契約 | 本文件 |
| T0833（U2） | client 端上傳驅動（三種來源、依視窗 profile 轉送、stop-and-wait、重試、取消、進度） | 待做 |
| T0834（U3） | Claude / Codex 面板接線 | 待做 |
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
