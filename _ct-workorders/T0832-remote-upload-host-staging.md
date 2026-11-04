---
schema_version: 1
schema_kind: workorder
id: T0832
title: "PLAN-038 U1：host 端上傳暫存與 `upload:*` channel（暫存目錄、檔名、權限、配額、TTL、dispose 清理）＋介面契約"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T09:17:09+0800"
started_at: "2026-11-04T11:15:10+08:00"
updated_at: "2026-11-04T11:31:32+08:00"
completed_at: "2026-11-04T11:31:32+08:00"
session_ids:
  - "477aa5a4-9d8e-462d-ac3a-225fdadbaf9f"
depends_on: [T0830]
related:
  - "PLAN-038；D272；T0828 回報區（設計 SoT：〈調查結論〉2–5、7，〈建議下一步〉第 1 列）；T0437；T0406；PLAN-036 / D134（helper 權杖）"
affects_files:
  - _ct-workorders/T0832-remote-upload-host-staging.md
  - electron/upload-staging.ts
  - electron/handlers/uploads.ts
  - electron/handlers/claude.ts
  - electron/remote/protocol.ts
  - electron/remote/path-aware-channels.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-handlers.ts
  - electron/main.ts
  - electron/__tests__/
  - electron/remote/__tests__/
  - scripts/smoke-remote-headless.mjs
  - scripts/__tests__/smoke-remote-headless.test.mjs
  - docs/agent-guide/remote-file-upload.md
  - docs/agent-guide/README.md
  - CLAUDE.md
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 設計以 T0828 回報區為準，使用者裁決（D272）：單檔 50 MiB、單次送出合計 100 MiB、每 session 配額 500 MiB、單次最多 10 檔；清理 = session / 分頁關閉即刪＋ 24 h TTL＋未完成 `.part` 10 分鐘；不加 Settings 開關；上傳失敗一律退回 T0437 的拒絕。偏離設計要問塔台。"
  - "🔴 新 channel 不得加進 `HELPER_CHANNEL_ROLES`（helper / PTY 權杖呼叫不到）；回傳的 `serverPath` 不得被 `toClient` 正規化；日誌只記 uploadId、session 前 8 碼、大小、副檔名、結果，不記檔名與內容。外部輸入（sessionId 等）走 `/^[a-zA-Z0-9._-]+$/` 白名單；所有路徑 resolve 後確認在 `<dataDir>/uploads/` 之下。"
  - "🔴 任何模組不得在 import 期呼叫 `app.getPath('userData')`（CLAUDE.md Logging 節規則 ②）；headless 與本機共用 handler（不 import electron 的模組）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。其他 Worker 同時在 main 執行。"
---

# T0832 — PLAN-038 U1：host 端上傳暫存

## 元資料
- **工單編號**：T0832｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0830（同改 `electron/main.ts`；等它 commit 後派）
- **規模**：M｜**降級**：先完成暫存模組＋handler＋單元測試，smoke S14 / docs 可最後補，做不完回 PARTIAL

## 任務指令

### 前置條件
- `_ct-workorders/T0828-research-remote-file-upload-staging.md` 回報區（全文）
- `CLAUDE.md`「Remote 資安」「遠端 Tower 通知（PLAN-036 K）」「Child Process Spawning」「CLAUDE.md 撰寫規則（T0595）」節

### 任務
1. **暫存模組**（`electron/upload-staging.ts`，不 import electron）：位置 `<dataDir>/uploads/<sessionId>/<uploadId>/<檔名>`；檔名清理（basename、控制字元、`.`/`..`、Windows 保留名、120 字元保留副檔名）；POSIX 0700 / 0600；`.part` → finish 時比對 sha256 後 rename；`statfs` 可用空間檢查（檔案大小＋64 MiB）；配額；TTL 掃描（啟動時＋每小時）；dispose 刪 session 目錄。
2. **4 個 channel**（`upload:begin` / `upload:chunk` / `upload:finish` / `upload:abort`）：offset 必須等於已收位元組；本機 host（main.ts）與 headless 都註冊；分類進 `PATH_FREE_CHANNELS`，通過既有 parity / path coverage / binding 守門。
3. **dispose 掛勾**：`claude:dispose-session`（`electron/handlers/claude.ts`）刪該 session 目錄；終端分頁的 session key（PTY id）清理介面留給 T0835 呼叫（在契約中定義）。
4. **介面契約**：在本工單回報區寫〈介面契約〉（channel 參數 / 回傳 / 錯誤碼如 `NO_SPACE`、`QUOTA`、`TOO_LARGE`、`BAD_OFFSET`、`HASH_MISMATCH`、session key 規則），T0833–T0835 依此實作，不得單方更改。
5. 測試：T0828〈調查結論〉7 的單元項目；`scripts/smoke-remote-headless.mjs` 加 S14（真 headless server：上傳、權限、dispose、未認證與 helper 權杖被拒）。
6. 文件：`docs/agent-guide/remote-file-upload.md`（新）＋ README 索引＋ `CLAUDE.md` 一節（3–12 行）；`CHANGELOG.md` 先不寫使用者可見項目（功能在 T0834 / T0835 才可見），可寫在 T0834。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] smoke S14 通過（或寫明無法執行的原因）
- [ ] 回報區有〈介面契約〉；commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：smoke S14 需要改 `scripts/__tests__/smoke-remote-headless.test.mjs`（不在 `affects_files`），可以改嗎？
- **提問時間**：2026-11-04T11:25:45+0800
- **背景**：`scripts/smoke-remote-headless.mjs` 加 S14 後，`CHECKS` 變 14 項；既有的 smoke 單元測試以假 server 斷言「S1–S13 全 PASS、`summarize` = 13/13、`pty:kill` 4 次、狀態表只有 S1–S13」，任何 S14 都會讓它變紅（即使 S14 對舊 server 回 SKIP 也一樣）。該測試檔不在本單 `affects_files`。
- **選項**：
  - A. 允許改該測試檔：假 server 加 `upload:*` / `claude:dispose-session` / 未認證連線與 S14 的 shell 回覆，更新 13 → 14 的斷言，並加 S14 的正反案例（舊 server → SKIP）。
  - B. 不加 S14：smoke 不動，改以已完成的 `electron/remote/__tests__/headless-upload-e2e.test.ts`（in-process 真 headless server：上傳、0700 / 0600、dispose、未認證與 tower / worker 權杖被拒）當驗收，回報區寫明。
  - C. 其他。
- **建議**：A。理由：工單任務 5 明文要求 S14，測試檔是 smoke 腳本自己的守門測試，漏列在 `affects_files` 較像疏漏；只改該檔與 S14 相關的部分。另註：S14 在已部署 server 上無法驗「helper 權杖被拒」（helper 腳本沒有可呼叫任意 channel 的入口），這一項只由 vitest e2e 覆蓋。
- **影響**：只影響驗收項「smoke S14」；其餘（暫存模組、channel、測試、文件）已完成，不受影響。
- **是否阻擋後續步驟**：只阻擋 S14；B 則可直接收尾。
- **通道**：BAT（`q-e42318d1-6c56a105c04e072e`，answered 2026-11-04T11:26:19+08:00，choice 1 = A；答覆原文記在〈互動紀錄〉）

### 完成狀態

**DONE**

- **session_id**：477aa5a4-9d8e-462d-ac3a-225fdadbaf9f
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（已存在：`electron/handlers/claude.ts`、`electron/remote/protocol.ts` 等）；C-2 不適用（無 `branch`，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_HOME` 未設（非 worktree）
- **commit**：`0382882b`（product，15 檔，`git add <明確路徑>` + `git commit -- <paths>`）；工單檔另 commit（本次與 `4736afa2` 提問 commit）
- 工作樹另有其他 Worker（T0842：`electron/remote/remote-client.ts` / `remote-server.ts` 等）的改動，本單未碰、未 commit

### 產出摘要

| 檔案 | 內容 |
|---|---|
| `electron/upload-staging.ts`（新） | `UploadStaging`：位置 `<dataDir>/uploads/<sessionKey>/<uploadId>/<檔名>`、`sanitizeUploadName`（basename、控制字元、`<>:"|?*`、結尾點 / 空白、Windows 保留名、≤ 120 字 / 200 bytes 保留副檔名、`.` / `..` → `file`）、session key 白名單、resolve 後必在 uploads 下、POSIX 0700 / 0600（`mkdir` 後 `chmod`、`open wx 0o600`）、`.part` → sha256（邊收邊算）→ rename、`statfs`（size + 64 MiB）、配額 500 MiB / 同時 10 個、重送上一塊冪等、同一 upload 排隊、ENOSPC → `NO_SPACE` 並刪、TTL sweep（24 h / `.part` 10 min / 閒置 10 min）、`disposeSession`。不 import electron，`getDataDir` 第一次使用才讀 |
| `electron/handlers/uploads.ts`（新） | `registerUploadHandlers`：4 個 channel，`ctx.helper` → `FORBIDDEN` |
| `electron/handlers/claude.ts` | `ClaudeHandlerDeps.onSessionDisposed`：`claude:dispose-session` 之後（`finally`）呼叫，回傳值與同步 / 非同步行為不變 |
| `electron/main.ts` | 模組層 `uploadStaging`（lazy userData）、`registerUploadHandlers`、dispose 掛勾、`app.whenReady` 內 `startSweeper()` |
| `electron/remote/headless-entry.ts` | `createHeadlessUploadModule`（註冊時掃一次＋每小時，disposer 停計時器）、claude module `onSessionDisposed`、`createHeadlessHandlerModules({ upload: { onStaging } })` |
| `electron/remote/protocol.ts` / `path-aware-channels.ts` | `PROXIED_CHANNELS` + `PATH_FREE_CHANNELS` 各 4 筆；`upload:finish` 進 `SERVER_PATH_RESULT_CHANNELS` |
| `scripts/smoke-remote-headless.mjs` | S14：2 塊上傳、wrong offset → `BAD_OFFSET`、`serverPath` 形狀、自己的 PTY 以 `stat -c %a` / `sha256sum` 驗 0600 / 0700 / 內容、`claude:dispose-session` 後 session 目錄消失、未認證 socket（`skipAuth`，不送 auth frame）→ `Not authenticated`；舊 server → SKIP（server-too-old）；清理只碰自己的 session key 與 PTY |
| 測試 | `electron/__tests__/upload-staging.test.ts`（新，71 項，POSIX 權限 1 項在 Windows skip）、`electron/remote/__tests__/headless-upload-e2e.test.ts`（新，真 headless server over WSS，6 項）、`path-aware-channels-coverage.test.ts`（補 `upload:finish` 樣本）、`scripts/__tests__/smoke-remote-headless.test.mjs`（Q-1 A：假 server 加 S14、13 → 14、5 個 S14 測試） |
| 文件 | `docs/agent-guide/remote-file-upload.md`（新）、`docs/agent-guide/README.md` 索引、`CLAUDE.md`「遠端附件上傳暫存（PLAN-038 / T0832）」節（5 行）。`CHANGELOG.md` 未寫（使用者看不到變化，依工單留給 T0834） |

**驗證（證據分道）**

| 分道 | 結果 |
|---|---|
| typecheck | `npm run typecheck` = 0、`npm run typecheck:electron` = 0 |
| 單元測試 | `npm run test:unit`：421 檔通過 / 3 skipped、7373 項通過 / 40 skipped，exit 0 |
| build | `npx vite build` exit 0 |
| 真 headless server（in-process） | `headless-upload-e2e.test.ts`：上傳 2+ 塊、Windows 上權限斷言略過（POSIX 才驗）、dispose 刪目錄、未認證 → `Not authenticated`、tower / worker 權杖 4 個 channel 全 `Forbidden: channel-not-allowed`、日誌不含檔名 —— PASS |
| smoke S14（已部署 server） | **未執行**：需要已部署含 T0832 的 bat-server（WSL / SSH）；目前沒有含本單的 server bundle，且 S1 要求 `serverPlatform=linux`、S14 的 shell 探測用 `stat -c` / `sha256sum`（Linux），本機 Windows 無法代跑。S14 邏輯由 smoke 單元測試（假 server，正反案例＋舊 server SKIP）驗證；「已部署 server 上 helper 權杖被拒」依 Q-1 只由 vitest e2e 覆蓋 |
| runtime / 實機 | 無（本單沒有 caller；T0833–T0835 接線後才有使用者可見行為） |

### 介面契約

> T0833（client 驅動）、T0834（面板）、T0835（終端）依此實作；改動需塔台決策，不得單方更改。常數 SoT：`UPLOAD_LIMITS` / `UPLOAD_TTL`（`electron/upload-staging.ts`）。

**C-1 channel（invoke，`PROXIED_CHANNELS`，參數依序）**

| channel | 參數 | 成功回傳 |
|---|---|---|
| `upload:begin` | `(sessionKey: string, name: string, size: number)` | `{ ok: true, uploadId: string, chunkBytes: number }` |
| `upload:chunk` | `(uploadId: string, offset: number, data: string /* base64 */)` | `{ ok: true, received: number }` |
| `upload:finish` | `(uploadId: string, sha256: string /* 64 hex，大小寫皆可 */)` | `{ ok: true, serverPath: string, size: number }` |
| `upload:abort` | `(uploadId: string)` | `{ ok: true, aborted: boolean }`（不存在 / 已結束 → `aborted: false`，冪等） |

- **C-2 失敗**一律以回傳值表示，不丟例外：`{ ok: false, code: UploadErrorCode, message: string }`（`message` 只供日誌 / 除錯，不給使用者看）。例外只有傳輸層：舊 host 沒有 handler → invoke reject `No handler for channel: upload:…`；未認證 → `Not authenticated`；helper 權杖 → `Forbidden: channel-not-allowed`；invoke 逾時。client 收到任一例外或 `ok: false` → 退回 T0437 拒絕＋toast（D272），已建立的上傳送 `upload:abort`（best effort）。
- **C-3 錯誤碼**

| code | 何時 | client 處置 |
|---|---|---|
| `BAD_ARGS` | 參數型別錯、session key 不符白名單、sha256 不是 64 hex | bug；退回拒絕 |
| `TOO_LARGE` | `size` > 50 MiB | 退回拒絕（client 應先擋） |
| `QUOTA` | 該 session key 已完成＋進行中宣告大小 + `size` > 500 MiB | 退回拒絕 |
| `TOO_MANY` | 該 session key 已有 10 個進行中上傳 | 退回拒絕（client 依序上傳不會發生） |
| `NO_SPACE` | `begin`：可用空間 < `size` + 64 MiB；`chunk`：寫入 ENOSPC（該上傳已刪除） | 退回拒絕 |
| `NOT_FOUND` | uploadId 不存在 / 已完成 / 已中止 / 閒置 10 分鐘被清 | 退回拒絕 |
| `BAD_OFFSET` | `offset` ≠ 已收位元組，且不是上一塊的重送 | 不重試；abort＋退回拒絕 |
| `BAD_CHUNK` | 非 base64 / 空 / 原始 > 256 KiB / 超出宣告大小 | bug；abort＋退回拒絕 |
| `SIZE_MISMATCH` | `finish` 時已收 ≠ `size`（上傳保留） | bug；abort＋退回拒絕 |
| `HASH_MISMATCH` | `finish` sha256 不符（上傳已刪除） | 退回拒絕 |
| `FORBIDDEN` | handler 收到 helper 身分（縱深防禦；正常在 RemoteServer 就被擋） | — |
| `IO_ERROR` | 其他檔案系統錯誤、host staging 尚未就緒 | 退回拒絕 |

- **C-4 傳輸**：stop-and-wait —— 一次一個 chunk 在途，等回應再送下一塊；一次送出的多檔依序上傳、不平行。每塊原始位元組 ≤ `chunkBytes`（host 回傳，目前 262144；除最後一塊外建議剛好等於它）。`offset` 從 0 起、等於已確認的 `received`。invoke 逾時可**重送同一塊 1 次**（同 offset、同內容）：若 host 已寫入會回 `{ ok: true, received }` 而不重寫；仍失敗 → abort＋退回拒絕。不續傳：連線中斷 = 該次失敗。`finish` 的 sha256 = 全部原始位元組的 sha256 hex。
- **C-5 session key**：`/^[a-zA-Z0-9._-]+$/`、1–128 字、不是 `.` / `..`。Claude / Codex 面板 = 該面板的 `sessionId`（與 `claude:dispose-session` 相同的值）；終端分頁（T0835）= 該分頁的 PTY id。同一 key 的所有上傳在同一目錄、共用配額。
- **C-6 檔名**：`name` 只傳原檔名（client 可傳完整路徑，host 只取 basename，但 client 不應傳路徑以免多送資訊）；host 依 `sanitizeUploadName` 清理（規則見 `docs/agent-guide/remote-file-upload.md`），`serverPath` 的最後一段是清理後的名字，可能與原檔名不同；空白保留，T0834 / T0835 放進 prompt / 終端時自己加引號。
- **C-7 `serverPath`**：host 的絕對路徑（host 平台的分隔符；headless Linux 為 `/…/bat-server/uploads/<key>/<16 hex>/<name>`），`upload:finish` 在 `SERVER_PATH_RESULT_CHANNELS`，client 原樣使用，**不得** `toClient` / `toServer`。面板顯示仍用原檔名。
- **C-8 清理**：① `claude:dispose-session(sessionId)` → host 刪該 session key 的目錄並中止其進行中上傳（Claude 與 Codex 面板都會；client 不必另外呼叫）；② 終端分頁：**T0835** 在 host 端該 PTY 真正結束（`pty:kill`、程序結束；⏻ 重啟不算）時呼叫 `UploadStaging.disposeSession(ptyId)`（`Promise<{ removed: boolean }>`，不丟例外、無效 key 為 no-op）。實例：本機 = `electron/main.ts` 模組層 `uploadStaging`；headless = `createHeadlessHandlerModules({ upload: { onStaging } })` 交出的實例（或在 `createHeadlessHandlerModules` 內部的 `uploadStaging` 變數）。不新增第 5 個 channel；③ host 啟動時＋每小時：完成後 24 h、未完成 `.part` 10 分鐘（無進行中上傳持有）、進行中閒置 10 分鐘。
- **C-9 client 端上限**（host 不檢查，T0833 負責）：單次送出合計 ≤ 100 MiB、≤ 10 檔；超過 → 不上傳、退回拒絕。單檔 50 MiB client 也應先擋（host 仍會回 `TOO_LARGE`）。
- **C-10 權限與日誌**：只有 client 連線（server token）與本機 IPC 可呼叫；`upload:*` 永不加進 `HELPER_CHANNEL_ROLES`。client 端日誌同樣只記 uploadId、session key 前 8 碼、大小、副檔名、結果，不記檔名與內容。

### 互動紀錄

- [11:15] 開工：讀 T0828 回報區、`_local-rules.md`、CLAUDE.md 對應節；落點檢查 PASS
- [11:25] Q-1：smoke S14 需要改 `scripts/__tests__/smoke-remote-headless.test.mjs`（不在 `affects_files`）→ 經 BAT `--ask --submit` 送出（`q-e42318d1-6c56a105c04e072e`）
- [11:26] Q-1: smoke 測試檔可否改 → A（塔台）：「選 A：允許改 scripts/__tests__/smoke-remote-headless.test.mjs。理由：任務 5 明文要求 S14，該檔是 smoke 腳本的守門測試，affects_files 漏列（塔台疏漏）。條件：1) 只改與 S14 相關的部分（假 server 加 upload:* / claude:dispose-session / 未認證連線、13→14 斷言、S14 正反案例含舊 server → SKIP），既有 S1–S13 斷言語意不變；2) 把該檔補進工單 affects_files，回報區〈互動紀錄〉記錄本裁決；3) 「已部署 server 上驗 helper 權杖被拒」維持只由 headless-upload-e2e.test.ts 覆蓋，回報寫明。T0842 不會碰這個檔。」→ Action：照條件 1–3 執行：只改 S14 相關部分（既有斷言只把 13 → 14、PTY 計數 +1、狀態表加 S14），`affects_files` 已補該檔，helper 權杖項寫明只由 vitest e2e 覆蓋
- 塔台補充段落檢查三個節點（驗證前、product commit 前、填回報前）皆無新段落

### Renew 歷程

（無）

### 遭遇問題

1. smoke S14 未在已部署 server 上執行（理由見〈產出摘要〉驗證表）；建議 T0833 / T0835 或下一次發版後，以 `node scripts/smoke-remote-headless.mjs --target wsl:<distro>` 對升級後的 server 跑一次。
2. host 的上傳日誌走共用 `logger`（本機 debug log、headless stdout），不經 `createHeadlessServer` 注入的 `logger`；e2e 測試以 `vi.spyOn(logger, …)` 驗證。
3. 已知限制（寫在 docs）：同一 session key 兩個並發 `begin` 可能同時通過配額；持 server token 的 client 可 chunk / abort 他人的 uploadId（同等權限）。
4. 檔名結尾的點 / 空白會被去掉、開頭的點保留（`.bashrc`）；T0828 只寫「`.` / `..` 改成 `file`」與「結尾的點 / 空白處理」，此為本單的具體化。

### 回報時間

2026-11-04T11:31:32+0800
