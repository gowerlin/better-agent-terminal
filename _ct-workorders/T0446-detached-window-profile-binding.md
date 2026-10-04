---
schema_version: 1
schema_kind: workorder
id: T0446
title: "BUG-112：detached workspace 視窗綁回父視窗的 profile——proxied 路由套 T0443 fail-closed、remote 事件轉發含 detached 視窗"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-112
priority: P1
sizing: S
created_at: "2026-10-05T06:28:31+08:00"
started_at: "2026-10-05T06:29:48+08:00"
updated_at: "2026-10-05T06:43:22+08:00"
completed_at: "2026-10-05T06:43:22+08:00"
target_version: next
depends_on:
  - T0443
related:
  - "BUG-112；T0443（`72ac25c`）回報區「遭遇問題」；`planProxiedInvokeRoute`（`electron/remote/remote-connect-plan.ts`）"
  - "D134 追加（塔台 06:28 依授權直接決定）"
affects_files:
  - electron/main.ts
  - electron/remote/remote-connect-plan.ts
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先盤點**：`workspace:detach` / reattach / 關閉的生命週期，`detachedWindows` 結構，所有以 `getWindowIdByWebContents` / `windowMap` 判斷 sender 身分的地方（不只 `bindProxiedHandlersToIpc`：還有 `remote:client-status`、`remote:connect`（T0419 綁定判斷）、`getWindowsForProfile` / 事件轉發、path-aware 轉換取 translator 的地方）。回報區附清單與每處處理。"
  - "🔴 修法：detached 視窗解析出其父視窗（或 profileId），在上述各處與 `windowMap` 視窗同等對待；**無法解析時 fail-closed**（remote 判斷不明 → 不落本機：若父視窗已不存在，以 detach 時記錄的 profileId 判斷）。本機 profile 的 detached 視窗行為不變。判斷抽純函式並單測。"
  - "🔴 T0436 可能仍有 `main.ts` 未提交 hunk：commit 時以 `git diff` 擷取本單 hunk + `git apply --cached` 精準 stage（T0431 / T0442 / T0443 做法），不得夾帶。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push。"
---

# T0446 — detached 視窗 profile 綁定（BUG-112）

## 範圍

1. 盤點（memory_overrides 第 1 條）
2. detached 視窗 → profile 解析 + 各處套用
3. 測試：remote profile detached 視窗 × 已連線 / 未連線 → 遠端 / 拒絕；本機 detached 不變；父視窗關閉後仍 fail-closed；事件轉發包含 detached 視窗

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] 回報區附盤點清單與實機步驟（WSL profile 視窗 detach 一個 workspace → 終端為遠端 shell；停 bat-server → detached 視窗顯示未連線而非本機）
- [ ] BUG-112 改 `FIXED`

## Sub-session 執行指示
1. 讀本工單 + BUG-112 + BUG-110 + T0443 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 盤點 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 實際改動檔 + 本工單 + BUG-112（精準 stage）；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ **DONE** — 從 remote profile 視窗 detach 出的 workspace 視窗現在以**父視窗的 profile** 路由：已連線 → 遠端；未連線 / 重連中 / 槽位屬他 profile / 空槽 → `REMOTE_NOT_CONNECTED` 拒絕，**不再落本機**。父視窗關閉後改用 detach 時記錄的綁定，仍 fail-closed；兩者皆不明 → 一律拒絕。remote 事件（RemoteClient 轉發、T0443 狀態推送）改以解析後的 profile 比對，detached 視窗收得到。本機 profile 的 detached 視窗行為不變（handler `windowId` 仍為 null、路由仍 `local`）。BUG-112 → `FIXED`。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` ✅（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 ✅；C-3：`electron/main.ts`、`electron/remote/remote-connect-plan.ts` 存在（informational）✅；C-2：工單無 `branch` 欄位，實際 `main`
- 依賴 T0443：`git log` 含 `72ac25c fix(remote): T0443 BUG-110 ...` ✅
- 派發 mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

#### 1. 盤點（memory_overrides 第 1 條）

生命週期：`workspace:detach`（`ipcMain.handle`，非 proxied）建 `BrowserWindow`，`detachedWindows.set(workspaceId, win)`，URL 帶 `?detached=<workspaceId>`；`closed` → 刪 entry + 通知父視窗 `workspace:reattached`；`workspace:reattach` → close + 刪 entry；最後一個主視窗關閉（`windowMap.size === 0`）→ 關閉全部 detached 並 `clear()`。detached 視窗不在 `windowMap`、沒有自己的 registry entry。

| # | 位置（`electron/main.ts`） | 原行為（detached 視窗） | 處理 |
|---|---------------------------|------------------------|------|
| 1 | `bindProxiedHandlersToIpc` 路由 | `windowId` null → 無綁定 → **本機**（BUG-112 主因） | `windowId` 為 null 時查 `getDetachedWorkspaceIdByWebContents` → `resolveDetachedBinding` → `detachedSenderRouteIdentity` → 同一個 `planProxiedInvokeRoute`。ALWAYS_LOCAL 短路在前、未改；`invokeHandler(channel, args, windowId)` 的 `windowId` 仍為 null |
| 2 | `remote:connect`（T0419 綁定） | `boundProfileId` null → 走「未綁定」舊路徑：未 pin 連線並**佔走槽位**（profileId null） | `getSenderProfileBinding` → 以父視窗 profile pin / reuse；`unresolved` → 回 `{ error, errorCode: 'binding-unresolved' }`，不碰槽位 |
| 3 | `remote:client-status` | 恆 `connected: false`（但路由照走本機） | 父視窗 profile 的狀態 |
| 4 | `getWindowsForProfile`（RemoteClient 事件轉發 `pty:output` 等、T0443 `remote:client-status-changed`、`remote-tools:install-pending`） | 以 **workspaceId** 比對 registry window id → 永不匹配 → 收不到 | `senderBindingProfileId(resolveDetachedBindingSync(workspaceId)) === profileId`（sync，讀 `getCachedEntries`） |
| 5 | `wslFolderDefaultForSender`（`dialog:select-folder` 預設路徑） | null → 本機 home | 父視窗綁定（僅影響對話框起始目錄） |
| 6 | `app:get-window-profile` | null → renderer init 用 `activeProfileIds[0]` | 父視窗 profileId（init 會以該 remote profile `remote.connect` → reuse 已驗證 client）；`unresolved` → null |
| 7 | `app:new-window`（Cmd+N） | 建**無綁定**視窗（本機） | 繼承父視窗 profile；`unresolved` → 不開窗、回 null |
| 8 | `app:get-window-id` | null | **不變**：只用於跨視窗拖曳 / `workspaceStore.setWindowId`；回父視窗 id 會讓 detached 視窗冒充父視窗搬移 workspace |
| 9 | `app:get-window-index` | 1 | **不變**：只用於顯示名稱 `:<idx>`，非身分判斷 |
| 10 | `remote-tools:take-pending-install` | profileId null → `takePendingInstall` 回 null | **不變（刻意）**：由父視窗領取；renderer 對 detached 已關閉 `takePending`；加註解 |
| 11 | ALWAYS_LOCAL / handler `ctx.windowId`（`workspace:load` / `workspace:save` 等） | null → `workspace:load` 回 null | **不變**（本機行為不變要求；見遭遇問題 1） |
| 12 | path-aware 轉換（PathTranslator） | 在 `RemoteClient.invoke` 內，以 client 的 profile 轉換 | 無 sender 查詢；路由對了即正確 |
| 13 | `getAllWindows` / `createWindowBroadcastEmit`（本機 PTY / Claude 事件） | 含 detached | 不變 |
| 14 | `dialog:*` 的 `BrowserWindow.fromWebContents` | 對 detached 本就正確（只取父視窗做 modal） | 不變 |
| 15 | `syncRemoteWorkspaceRoots` / `collectWorkspaceRoots` | registry 為準，非 sender | 不變 |

`electron/` 與 `src/` 其餘檔案無 `getWindowIdByWebContents` / `windowMap` / `detachedWindows` 引用（`grep` 確認，只在 `main.ts`）。

#### 2. 實作

- `electron/remote/remote-connect-plan.ts`（純函式，無 electron import）：`DetachedWindowRecord`、`SenderProfileBinding`、`UNRESOLVED_DETACHED_PROFILE_ID`、`resolveDetachedProfileBinding(record, parentProfileId)`（父視窗有 profile → 父；否則記錄值；已知 profile 不降級為「無綁定」；皆不明 → `unresolved`）、`senderBindingProfileId`（`unresolved` → null，永不算 connected）、`detachedSenderRouteIdentity(binding, profileType)`（無綁定 → 本機；`local` → 本機；`remote` / profile 查不到 / `unresolved` → remote，交給 T0443 規則拒絕或遠端）。
- `electron/main.ts`：`detachedWindowRecords`；`getDetachedWorkspaceIdByWebContents`、`isLiveRegistryWindow`、`resolveDetachedBindingSync` / `resolveDetachedBinding`（父視窗 entry 讀取失敗 → warn + 視為父視窗不明，退到記錄值）、`getSenderProfileBinding(wc)`（registry 視窗 → 自己的 entry；detached → 上述；其他 sender → 無綁定，維持原行為）。`workspace:detach` 在建窗**前**讀父視窗綁定（巢狀 detach 時沿用其記錄的 parent），await 之後再檢查一次 `detachedWindows.has` 防重入，建窗時 `detachedWindowRecords.set` 並 log `[detached] <ws> detached from window <id> profile=<id|(none)|(unresolved)>`；`closed` 改為只在 map 內仍是同一個視窗時才刪（避免舊視窗的 `closed` 刪到同 workspace 新開的 detached 視窗）。

#### 3. 測試

- `electron/__tests__/detached-window-profile-binding.test.ts`（新，31 例）：
  - `resolveDetachedProfileBinding` 12 例矩陣（父視窗在 / 關閉 / entry 讀不到 × 記錄 P / L / 無綁定 / unresolved / 無記錄）+ `senderBindingProfileId`。
  - `detachedSenderRouteIdentity` 4 例（無綁定、local / remote、profile 查不到 → remote、unresolved → 哨兵 id）。
  - 路由矩陣（綁定 → 身分 → `planProxiedInvokeRoute`）：**remote detached × 已連線 → `remote`**；× 重連中 / 放棄 / 他 profile / 空槽 → `refuse`（reason 各自正確）；**本機 / 無綁定 detached 在所有槽位狀態 → `local`**；**父視窗關閉後**以記錄值仍 `remote` / `refuse`，profile 被刪也不落本機；`unresolved` / 無記錄在所有槽位 → `refuse`；**事件轉發**比對值為父視窗 profile（非 workspaceId）。
  - source guard 4 例：`bindProxiedHandlersToIpc` 在 ALWAYS_LOCAL 短路之後、`planProxiedInvokeRoute` 之前解析 detached，`local` 出口仍傳原 `windowId`；`getWindowsForProfile` 以解析後 profile 比對、不再 `matchIds.has(workspaceId)`；`remote:connect`（含 unresolved 拒絕）/ `remote:client-status` / `app:get-window-profile` / `app:new-window`（unresolved → `return null`）/ `wslFolderDefaultForSender` 皆走 `getSenderProfileBinding`；detach 在 `loadURL` 前 `set` 記錄，`closed` / reattach / `clear()` 皆刪除。
- 既有 T0443 / T0419 / T0430 / T0442 source guard（`remote-connect-plan.test.ts`）、`headless-always-local.test.ts`、`remote-tool-install-queue.test.ts`（take 仍用 `getWindowIdByWebContents(event.sender)`）維持綠。

#### 4. 驗收

| Gate | 結果 | 證據 |
|------|------|------|
| `npm run test:unit` | ✅ PASS | 第 2–4 次：`Test Files 147 passed (147)` / `Tests 2371 passed \| 1 skipped (2372)`（含工作樹平行 Worker 未提交的測試）。**第 1 次** `2 failed \| 145 passed`、9 例失敗，堆疊指向 `electron/remote/__tests__/headless-frame-hardening.test.ts:222`（平行 T0447 的未追蹤新測試，in-process headless server）；本單未碰該檔與 `remote-server.ts`，之後連跑 3 次皆全綠 → 判定為平行改動進行中 / 負載下的 flaky，非本單造成 |
| `npx tsc --noEmit` | ✅ PASS | `39` 個 `error TS`（≤ 39）；`main.ts` / `remote-connect-plan.ts` / 新測試 0 筆 |
| `npx vite build` / `npm run test:e2e` | ⏭ 未跑 | 依 memory_overrides（L141）刻意不跑 |
| runtime smoke | ⏭ 未跑（需實機） | 見下方實機步驟；**注意遭遇問題 1** |

**實機步驟（待人工驗收）**

> ⚠️ 依程式碼，detached 視窗自 `512c118` 起 `workspace:load` 回 null → 畫面為「Workspace not found」，**看不到終端分頁**（遭遇問題 1）。因此「detached 視窗終端為遠端 shell」在該問題修好前無法直接目視；下列步驟以 debug.log 與狀態列驗證路由 / 狀態 / 事件。

A. WSL profile 視窗 detach（已連線）
1. 開 WSL remote profile 視窗，確認已連線（終端為 WSL shell）。
2. 在側欄對某 workspace 選「Detach」。
3. 預期 debug.log：`[detached] <workspaceId> detached from window <parentId> profile=<WSL profileId>`；detached 視窗 init 的 `[remote:connect] reusing verified client for profile <WSL profileId>`（**不是**未 pin 的新連線、不換槽）；`profile.list` 回的是遠端清單。
4. 若遭遇問題 1 已修好：detached 視窗內的終端為 WSL shell（`uname -a` 顯示 Linux）、檔案樹列 WSL 路徑。

B. 停 bat-server → detached 視窗顯示未連線而非本機
1. 承 A，Windows 端 `wsl -d <distro> -- systemctl --user stop bat-server`（或 `wsl --shutdown`）。
2. 預期 debug.log：`[remote-status] profile <id> → reconnecting (reconnecting)`，且推送也送到 detached 視窗（renderer `[T0443] remote status <id>: reconnecting` 出現**兩次**：父視窗 + detached 視窗）。
3. 在 detached 視窗按 Ctrl+R 重新載入：預期 debug.log 有 `[T0443] REMOTE_NOT_CONNECTED profile=<id> reason=reconnecting channel=profile:list`、`channel=settings:load` 等，**沒有**任何 proxied channel 在本機執行；出現一次「此遠端視窗目前未連線…」toast。
4. 恢復 bat-server → `[remote-status] ... → connected`，兩個視窗皆收到。

C. 父視窗關閉後仍 fail-closed
1. 先開第二個任意視窗（避免 `windowMap.size === 0` 連帶關閉 detached），再關閉 WSL 父視窗；detached 視窗保留。
2. 停 bat-server 後在 detached 視窗 Ctrl+R → 仍為 `REMOTE_NOT_CONNECTED`（以 detach 時記錄的 profile 判斷），不落本機。

D. 本機 profile detached 視窗（負向）：本機視窗 detach 一個 workspace，行為與修改前相同（debug.log `profile=<local id>`，無 toast、無 `REMOTE_NOT_CONNECTED`）。

#### 5. 改動檔案

- `electron/remote/remote-connect-plan.ts`（T0446 純函式與型別）
- `electron/main.ts`（import、`detachedWindowRecords`、sender 綁定 helpers、`getWindowsForProfile`、`bindProxiedHandlersToIpc`、`wslFolderDefaultForSender`、`remote:connect`、`remote:client-status`、`app:get-window-profile`、`app:new-window`、take-pending 註解、detach / closed / reattach / clear）
- `electron/__tests__/detached-window-profile-binding.test.ts`（新）
- `_ct-workorders/BUG-112-detached-workspace-window-remote-fail-open.md`（→ `FIXED` + 修復說明 + 已知限制）、本工單

#### 6. Commit

`electron/main.ts` 工作樹含平行 T0436 未提交 hunk（`image-attachments` import、`dialog:select-attachments`、`clipboard:read-image-data-url`，共 3 個 hunk）。以 `git diff` 擷取後過濾掉這 3 個 hunk（保留本單 15 個），`git apply --cached` 精準送進 index，其餘本單檔 `git add`，確認 `git diff --cached` 僅含本單內容後 `git commit`。訊息含 `T0446`；不 push；未使用 stash / reset / checkout / restore。hash 以 `git log --grep T0446` 查詢。

### 遭遇問題

1. **Detached 視窗載不到 workspace（既有、範圍外，建議另開 BUG）**：`workspace:load` / `workspace:save` 是 ALWAYS_LOCAL，handler 以 `ctx.windowId` 讀寫 registry；detached 視窗不在 `windowMap` → `windowId` null → `workspace:load` 回 `null`（`main.ts` `if (!ctx.windowId) return null`），`workspace:save` 回 `false`。renderer `App.tsx` detached 模式找不到該 workspace → 顯示 `app.workspaceNotFound`。`git log -S` 顯示此 guard 來自 `512c118 refactor: single-process multi-window architecture`（2026-03-28），晚於 detach 功能 `070b61a`（2026-02-13）⇒ **detach 功能自多視窗重構起即無法顯示 workspace**（本機 / 遠端皆然；僅程式碼證據，未實機確認）。本單未修：讓 handler 拿到父視窗 `windowId` 會改變本機 detached 行為（違反本單「本機行為不變」），且 detached 視窗的 store 含全部 workspace、每 30 秒 autosave，直接寫父視窗 entry 會與父視窗互相覆蓋。建議另案設計（例如 detached 視窗唯讀載入父視窗 entry、持久化只由父視窗負責）。在那之前，本單修復的效果是「detached 視窗不再以本機身分執行 init 期間的 proxied 呼叫、不再以未 pin 連線佔走槽位、收得到狀態事件」，終端層面的驗收需等該問題修好。
2. **`remote:connect` 原本的槽位風險（本單已修，記錄）**：修前 detached 視窗 init 時若 `activeProfileIds[0]` 為 remote，會以「未綁定」身分呼叫 `remote:connect` → 未 pin 新連線並把槽位 profileId 設為 null，讓父視窗變成未連線。現以父視窗 profile pin / reuse。
3. `unresolved`（無記錄，或父視窗關閉且 detach 時讀不到綁定）在 renderer 的提示沿用 T0443 的 reason：空槽 → `app.remoteNotConnected`，槽位有其他 profile → `app.remoteNotConnectedOtherProfile`（「請重新開啟此配置的視窗」）。實務上幾乎不會發生，未新增 reason / i18n（避免動 renderer 與平行 T0436 共用的 `electron.d.ts`）。
4. 第 1 次 `npm run test:unit` 有 9 例 flaky 失敗（平行 T0447 的 `headless-frame-hardening.test.ts`），之後 3 次全綠，見驗收表。
5. 工作樹有平行 Worker（T0436 / T0447）的未提交改動，本單未觸碰，commit 以 index 精準隔離。

### 回報時間

2026-10-05T06:43:13+08:00（Worker 時間戳取自 `date`）
