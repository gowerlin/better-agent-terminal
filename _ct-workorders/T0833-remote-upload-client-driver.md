---
schema_version: 1
schema_kind: workorder
id: T0833
title: "PLAN-038 U2：client 端上傳驅動（拖放 File 分塊 / 對話框 / 剪貼簿三來源、依視窗 profile 轉送、stop-and-wait、重試、取消、進度、舊 server 偵測）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T09:17:09+0800"
started_at: "2026-11-04T11:33:18+08:00"
updated_at: "2026-11-04T11:45:10+08:00"
completed_at: "2026-11-04T11:45:10+08:00"
session_ids:
  - "52f235cb-e447-4ddb-8eba-98206d1e0425"
depends_on: [T0832]
related:
  - "PLAN-038；D272；T0828 回報區（〈調查結論〉2、4，〈建議下一步〉第 2 列）；T0832〈介面契約〉；T0436（client 端讀檔原則）"
affects_files:
  - _ct-workorders/T0833-remote-upload-client-driver.md
  - electron/upload-client.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/lib/remote-upload.ts
  - electron/__tests__/
  - src/lib/__tests__/
  - docs/agent-guide/remote-file-upload.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 依 T0832〈介面契約〉實作，不得單方更改；契約不足時問塔台。"
  - "🔴 不新增「main 讀任意 renderer 給的路徑」的入口（T0436 原則）：拖放由 renderer 以 `File.slice()` 分塊交給 main；對話框路徑由 main 自己選；剪貼簿圖片由 main 讀。client IPC 是本機 `ipcMain.handle`（不在 `PROXIED_CHANNELS`），依視窗綁定的 profile 轉送到對應 `RemoteClient`；無 live 連線即失敗，不 fallback 本機。"
  - "🔴 256 KiB 分塊、一次一塊在途（stop-and-wait）、單塊 invoke 逾時重試 1 次；上限 50 / 100 / 500 MiB（D272）；舊 bat-server 沒有 `upload:*` → 回明確結果讓 UI 退回 T0437 拒絕。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0833 — PLAN-038 U2：client 端上傳驅動

## 元資料
- **工單編號**：T0833｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0832（契約、同改 `main.ts`）｜**規模**：M

## 任務指令

### 前置條件
- `_ct-workorders/T0828-research-remote-file-upload-staging.md` 回報區；`_ct-workorders/T0832-remote-upload-host-staging.md`〈介面契約〉
- `CLAUDE.md`「多 remote profile 同時連線（PLAN-039）」節

### 任務
1. main：`electron/upload-client.ts` 上傳驅動（三來源、分塊、stop-and-wait、重試、取消、sha256、進度事件 main → renderer）；本機 IPC 與 preload / 型別。
2. renderer：`src/lib/remote-upload.ts` 包裝（給 T0834 / T0835 用的 API：上傳一組附件 → 每檔 `serverPath` 或失敗原因；進度回呼；取消）。
3. 單元測試：stop-and-wait、重試 1 次、取消、舊 server 無 handler、上限、profile 路由（無 live 連線失敗）。
4. docs：`remote-file-upload.md` 補 client 端一節。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

**DONE**

- **session_id**：52f235cb-e447-4ddb-8eba-98206d1e0425
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（`electron/main.ts`、`electron/preload.ts` 等已存在）；C-2 不適用（無 `branch`，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_HOME` 未設（非 worktree）
- **commit**：`8f8c4579`（product，8 檔，`git commit -- <paths>`）；工單檔另 commit
- 依 T0832〈介面契約〉實作，契約未改

### 產出摘要

| 檔案 | 內容 |
|---|---|
| `electron/upload-client.ts`（新） | `UploadClient`：`prepare`（驗證 session key、來源、D272 單次 ≤ 10 檔 / ≤ 100 MiB、單檔 50 MiB，不連網）、`begin` / `chunk` / `finish`（`file` 來源，renderer 分塊）、`run`（`path` / `clipboard-image`，main 讀檔）、`abort`（transfer 或 batch，冪等）、`disposeSender`、`expireIdle`（10 分鐘）、`noteSelectedPaths`（dialog 路徑白名單）；stop-and-wait（在途時 `BUSY`）、chunk invoke **逾時**重送 1 次（同 offset / base64）、其餘失敗 `upload:abort`；sha256 對 host 已確認的位元組邊送邊算；`classifyInvokeError`（`No handler for channel: upload:` → `SERVER_TOO_OLD`、無連線 → `NOT_CONNECTED`）；日誌不含檔名 / 路徑；不 import electron |
| `electron/main.ts` | `resolveUploadRoute`（與 `bindProxiedHandlersToIpc` 同規則：視窗 / detached 父視窗的 profile → `planProfileProxiedInvokeRoute` → 該 profile 自己的 `liveRemoteClient`；本機 → `local`、其餘 → `refuse`）、模組層 `uploadClient`、`trackUploadSender`（`destroyed` → `disposeSender`）、6 個 `ipcMain.handle('upload-client:…')`、`dialog:select-attachments` 記下回傳的 `files`（回傳值不變）。`bindProxiedHandlersToIpc` 未改（有 source guard，路由邏輯以獨立函式重寫） |
| `electron/preload.ts` / `src/types/electron.d.ts` | `window.electronAPI.upload`（`RemoteUploadApi`，含 `onProgress` 訂閱 `upload-client:progress`） |
| `src/lib/remote-upload.ts`（新） | 給 T0834 / T0835 的 `uploadToRemoteHost(sessionKey, sources, { onProgress, signal })`：每檔 `{ ok, name, serverPath, size }` 或 `{ ok: false, code, message, name }`；依序上傳、不丟例外、`stopsRemainingUploads` 的致命碼停止其餘、取消、整批進度；型別與 `REMOTE_UPLOAD_LIMITS`（`UPLOAD_LIMITS` 鏡像，parity 測試） |
| 測試 | `electron/__tests__/upload-client.test.ts`（新，34 項：對真 `UploadStaging` 的端到端、stop-and-wait、重送冪等、第二次逾時、非逾時不重試、host 拒絕透傳、取消（signal / `abort(batchId)` / prepared）、舊 server、路由（本機 / 斷線 / 途中斷線）、上限、dialog 白名單、剪貼簿、閒置、日誌、main / preload 接線 source guard）、`src/lib/__tests__/remote-upload.test.ts`（新，16 項） |
| 文件 | `docs/agent-guide/remote-file-upload.md`「client 端（T0833）」一節（規則、唯一實作、IPC 表、driver 用法、上限、錯誤碼、已知限制）＋驗證表兩列 |

**驗證（證據分道）**

| 分道 | 結果 |
|---|---|
| typecheck | `npm run typecheck` = 0、`npm run typecheck:electron` = 0 |
| 單元測試 | `npm run test:unit`：423 檔通過 / 3 skipped、7423 項通過 / 40 skipped，exit 0 |
| build | `npx vite build` exit 0 |
| runtime / 實機 | 無（本單沒有 caller；T0834 / T0835 接線後才有使用者可見行為） |

### 互動紀錄

- [11:33] 開工：讀 T0832〈介面契約〉、T0828 回報區、`_local-rules.md`、CLAUDE.md 對應節；落點檢查 PASS
- 未向塔台提問（契約足以實作；設計選擇記在〈遭遇問題〉）

### Renew 歷程

（無）

### 遭遇問題

1. **設計具體化（契約範圍內，未改契約）**：client IPC 拆成 `prepare`（整批檢查 D272 上限，不連網）＋ `begin` / `chunk` / `finish`（renderer 分塊）或 `run`（main 讀檔）；`path` 來源只接受 main 從 `dialog:select-attachments` 回給同一視窗的 `files`（T0436 原則的實作方式）；client 自訂碼 `NOT_REMOTE` / `NOT_CONNECTED` / `SERVER_TOO_OLD` / `TRANSPORT` / `CANCELLED` / `BUSY` / `NOT_SELECTED` / `SOURCE_ERROR` / `SEND_TOO_LARGE` / `TOO_MANY_FILES`（docs 有表）；另加「一個視窗同時 ≤ 20 個 transfer」與 10 分鐘閒置取消，防止 renderer 中途消失時剪貼簿 buffer 留在 main。
2. `begin` / `finish` 不重試（契約只允許 chunk 重送；重送 `begin` 會在 host 多開一個上傳）。
3. 路由邏輯以獨立函式 `resolveUploadRoute` 重寫一份，未抽共用：`bindProxiedHandlersToIpc` 有多個 source guard（T0437 / T0446 / ALWAYS_LOCAL），改動風險高於重複約 25 行。日後改路由規則時兩處要一起改（docs 已註明「規則與 `bindProxiedHandlersToIpc` 相同」）。
4. 後續（不在本單範圍）：`CLAUDE.md`「遠端附件上傳暫存（PLAN-038 / T0832）」節仍寫「client … 是 T0833–T0835」，未補 client 端唯一實作一行（`CLAUDE.md` 不在 `affects_files`），建議 T0834 或塔台補；`docs/agent-guide/README.md` 索引已指向同一份 docs，無需改。
5. 拖放的非圖片檔：面板目前只留路徑（`getPathForFile`），T0834 需保留 `File` 物件以走 `file` 來源。

### 回報時間

2026-11-04T11:44:35+0800
