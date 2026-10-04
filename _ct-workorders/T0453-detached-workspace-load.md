---
schema_version: 1
schema_kind: workorder
id: T0453
title: "BUG-113：detached workspace 視窗唯讀載入父視窗 entry（workspace:load 經 detachedWindowRecords 解析），持久化只由父視窗負責；先實機 / e2e 確認現況"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-113
priority: P2
sizing: M
created_at: "2026-10-05T06:43:42+08:00"
started_at: "2026-10-05T06:44:43+08:00"
updated_at: "2026-10-05T06:55:19+08:00"
completed_at: "2026-10-05T06:55:19+08:00"
target_version: next
depends_on:
  - T0446
related:
  - "BUG-113；T0446（`acc94f5`）回報區「遭遇問題」1；`detachedWindowRecords`（T0446）"
  - "D134 追加（塔台 06:43 依授權直接決定）"
affects_files:
  - electron/main.ts
  - src/App.tsx
  - src/stores/workspace-store.ts
  - electron/__tests__/
  - src/__tests__/
  - e2e/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **第一步確認現況**：以 Playwright e2e（`e2e/` 既有 fixture，T0397 / T0399 隔離 runtime）或等效方式實際 detach 一個 workspace，確認是否顯示 Workspace not found。可以跑 `npx playwright test <你的新 spec>`（只跑本單 spec，不跑全套 e2e，L141）。若現況其實正常，回報區附證據並以 DONE（無需修）結案。"
  - "🔴 **設計**：detached 視窗的 `workspace:load` 經 T0446 的 detached 記錄解析父視窗，**唯讀**取父視窗 entry；detached 視窗的 `workspace:save` 不寫父視窗 entry（回 true 但 no-op，或只同步該 detached workspace 的狀態到父視窗——擇一並說明，**不得**造成兩視窗互相覆蓋）；父視窗已關閉時的行為明確（例如 detached 視窗關閉或顯示提示）。reattach 流程不得回歸。"
  - "🔴 本機（非 remote）detached 視窗也受益——這是本單主要目的；remote detached 視窗的路由已由 T0446 處理，不得改變。"
  - "🔴 T0436 可能仍有 `main.ts` 未提交 hunk：以 `git diff` + `git apply --cached` 精準 stage。**只跑 `npm run test:unit` + `npx tsc --noEmit` + 本單新 e2e spec；不跑全套 `npx vite build` / `npm run test:e2e`**（L141；e2e spec 若需 build，使用既有 e2e 流程允許的最小 build，回報區說明）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push。"
---

# T0453 — detached workspace 載入（BUG-113）

## 驗收條件

- [x] 回報區附現況確認證據
- [x] e2e：detach → 新視窗顯示該 workspace（終端可用）→ reattach 正常；父視窗 workspace 設定未被 detached 視窗覆寫
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39（tsc 39 ✅；unit：本單範圍全綠，全套 4 檔失敗皆屬平行 WIP，見回報區）
- [x] BUG-113 改 `FIXED`

## Sub-session 執行指示
1. 讀本工單 + BUG-113 + T0446 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 現況 → 設計 → 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單 + BUG-113（精準 stage）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ **DONE** — 現況經 e2e 確認 BUG-113 必現（detached 視窗顯示「找不到工作區」）。修正後 detached 視窗的 `workspace:load` 以 T0446 的 `detachedWindowRecords` 解析父視窗，唯讀回傳父視窗 entry；`workspace:save` 回 `true` 但 no-op，父視窗 entry 只由父視窗寫入。新 e2e 通過（detach → 顯示 workspace、終端可執行指令 → detached 視窗 save 不改父視窗 entry → reattach 正常）。BUG-113 → `FIXED`。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` ✅（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 ✅；C-3：`electron/main.ts`、`src/App.tsx`、`src/stores/workspace-store.ts` 存在（informational）✅；C-2：工單無 `branch` 欄位，實際為 `main`
- 依賴 T0446：`git log` 含 `acc94f5 fix(remote): T0446 BUG-112 ...` ✅
- 派發 mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

#### 1. 現況確認（memory_overrides 第 1 條）

新增 `e2e/detached-workspace.spec.ts`，先對**修改前**的既有 build（`dist-electron/main.js` 2026-10-05 05:26，早於 T0446，含 `512c118` 的 `if (!ctx.windowId) return null`）執行 `npx playwright test e2e/detached-workspace.spec.ts`：

```
[t0453-detached] main window shows both seeded workspaces
[t0453-detached] main window hides Beta after detach
[t0453-detached] detached window state: view=0 empty-state=1 text="找不到工作區 此分離的工作區可能已被移除。"
  1 failed
```

⇒ BUG-113 確認必現（isolated runtime 以 OS 語系 zh-TW 啟動，故為中文版 `app.workspaceNotFound`）。

#### 2. 設計

| 項目 | 決定 | 理由 |
|------|------|------|
| 攔截位置 | `bindProxiedHandlersToIpc`：`windowId` 為 null、channel ∈ `{workspace:load, workspace:save}`、sender 為 detached 視窗 → `invokeDetachedWorkspacePersistence`；放在 ALWAYS_LOCAL 短路**之前**（兩個 channel 本來就是 ALWAYS_LOCAL，語意不變） | registry handler（`registerHandler('workspace:load'/'workspace:save')`）完全不動 ⇒ remote client／其他無 window 的 sender 行為不變；T0443／T0422 的 ALWAYS_LOCAL 短路 source guard 維持原形 |
| `workspace:load` | `detachedWindowRecords.get(workspaceId).parentWindowId` → `invokeHandler('workspace:load', [], parentWindowId)`，唯讀 | 父視窗 entry 為唯一真相；巢狀 detach 時 T0446 已將 parent 指向原始 registry 視窗 |
| `workspace:save` | **回 `true`，no-op**（不採「同步該 workspace 切片回父視窗」） | detached 視窗 store 含全部 workspace，且每 30 秒 autosave；同步切片的話，父視窗下次 autosave 會用記憶體中的舊切片蓋回去，除非讓父視窗 reload，但 reload 會重設終端狀態（`scrollbackBuffer: []`、`pid: undefined`），每 30 秒觸發一次風險過高 ⇒ 兩視窗互相覆蓋。no-op 是唯一不會互蓋的選項 |
| 父視窗已關閉 | 「Close only」：entry 仍在 → detached 視窗照常（唯讀）載入；「Remove from profile」：entry 已刪 → `null` + `[detached] ... has no registry entry` warn → renderer 既有「找不到工作區」畫面；無記錄 → `null` + warn；最後一個主視窗關閉時所有 detached 視窗本就會一併關閉（未改） | 行為明確且沿用既有 UI，不新增 i18n |
| remote detached 視窗 | `workspace:*` 為 ALWAYS_LOCAL（讀本機 registry 中的複本），T0446 的 proxied 路由與事件分發**未改** | 符合 memory_overrides 第 3 條 |
| reattach | 未改（`workspace:reattach` / `closed` → `workspace:reattached`） | e2e 驗證無回歸 |

#### 3. 實作

- `electron/main.ts`：`DETACHED_WORKSPACE_CHANNELS`、`invokeDetachedWorkspacePersistence(channel, workspaceId)`；`bindProxiedHandlersToIpc` 在 ALWAYS_LOCAL 短路前加 6 行分流。renderer（`src/App.tsx`、`src/stores/workspace-store.ts`）**不需修改**：detached 模式本就呼叫 `workspaceStore.load()`，現在拿得到父視窗資料；其 `save()` / autosave / `onFlushSave` / `listenForReload` 的 save 全部落在 main 端的 no-op。
- `electron/__tests__/detached-workspace-persistence.test.ts`（新，4 例 source guard）：兩個 channel 仍為 ALWAYS_LOCAL；分流只針對 detached sender、位於 `windowId` 取得之後與 ALWAYS_LOCAL 短路（維持 `{ return invokeHandler(channel, args, windowId)` 原形）之前，T0446 路由解析仍在其後；save 在任何 `invokeHandler` 前 `return true`，不呼叫 `workspace:save` handler／`saveEntry`；load 以 `parentWindowId` 讀取，無 parent 時回 `null`；registry handler 的 `!ctx.windowId` guard 不變。
- `electron/__tests__/detached-window-profile-binding.test.ts`（T0446 測試，改 1 行）：其 source guard 以 `fn.indexOf('getDetachedWorkspaceIdByWebContents(event.sender)')` 取**第一個**出現位置，本單的分流行出現得更早，會讓該 guard 誤錨到本單的程式碼；改錨定 T0446 自己的路由解析 `await resolveDetachedBinding(detachedWorkspaceId)`，語意更精確（斷言內容不變：位於 ALWAYS_LOCAL 之後、`planProxiedInvokeRoute(` 之前）。
- `e2e/detached-workspace.spec.ts`（新）：isolated runtime（T0399 fixture）→ seed 主視窗 entry（Alpha、Beta + Beta 一個終端 `e2e-t0453-term-beta`）→ reload → detach Beta → 斷言 detached URL、主視窗側欄隱藏 Beta、detached 視窗 `.workspace-container.active` 可見且無「找不到工作區」（en / zh-CN / zh-TW regex）、截圖 → detached 視窗 `workspace.load()` 回傳父視窗的 `[Alpha, Beta]` → 對終端寫入 `echo T0453_MARK""ER_OK`，等到輸出 `T0453_MARKER_OK`（只有 shell 真的執行才會合併字串，可和輸入回顯區分）→ detached 視窗送出**清空 payload** 的 `workspace.save()` 回 `true`，主視窗 entry 的 workspaces 與 Beta 終端不變 → `workspace.reattach` → detached 視窗 close 事件、Beta 回到主視窗側欄、entry 仍為 `[Alpha, Beta]`。

#### 4. 驗收

| Gate | 結果 | 證據 |
|------|------|------|
| 現況確認 | ✅ 必現 | 見第 1 節（修改前 build，e2e 1 failed，body「找不到工作區」） |
| e2e（本單 spec） | ✅ PASS | 修改後 build：`npx playwright test e2e/detached-workspace.spec.ts` → `1 passed`；log：`detached window state: view=1 empty-state=0 text="終端 檔案 Git ... Beta terminal ... $ _"`、`detached window terminal ran a command`、`detached workspace:save is a no-op on the parent entry`、`reattach closed the detached window and Beta is back in the main window`、teardown `Terminal Server pid ... alive after teardown: false`、`runtime userData removed: true` |
| build（e2e 前置） | ✅ | e2e fixture 只認 `dist-electron/`（`npx vite build` 產出），且無更小的 build 路徑（main / preload / terminal-server 都由同一份 vite config 的 `vite-plugin-electron` 產生）⇒ 依 memory_overrides「e2e 所需的最小 build」執行 `npx vite build` **一次**（成功；產物 `dist-electron/main-CKQDpAOx.js` 含 `invokeDetachedWorkspacePersistence`）。build 會一併包含工作樹中平行 T0436 的未提交改動，對本 spec 無影響。未跑 `npm run test:e2e` 全套 |
| `npx tsc --noEmit` | ✅ PASS | `39` 個 `error TS`（≤ 39）；`main.ts`、新測試、e2e spec 皆 0 筆 |
| `npm run test:unit` | ⚠️ 本單範圍全綠；全套受平行 WIP 影響 | 本單相關 4 檔（`detached-workspace-persistence` / `detached-window-profile-binding` / `remote-connect-plan` / `headless-always-local`）：`Test Files 4 passed`、`Tests 91 passed`。全套最後一次：`Test Files 4 failed \| 146 passed (150)`，失敗檔全部對應平行 Worker 正在修改中的檔案：`scripts/__tests__/smoke-remote-headless.test.mjs` 與 `remote-tools-install-check.test.mjs`（`scripts/smoke-remote-headless.mjs` WIP，`SyntaxError: Invalid or unexpected token`）、`electron/remote/__tests__/helper-capability.test.ts`（`helper-capability.ts` WIP，`agent-registry-unknown`）、`tests/bat-notify-submit.test.mjs`（`scripts/bat-notify.mjs` WIP）。排除這 4 檔後：`145 passed`、1 失敗為 `headless-helper-env.test.ts`（in-process headless server，依賴 WIP 中的 `helper-capability`／`remote-server`；前一次全套執行時通過）。以上檔案都不引用 `main.ts` 或本單測試，本單也沒有修改它們。依 L138 不得用 stash 隔離 |
| runtime smoke（實機 GUI） | ⏭ 以 e2e 代替 | e2e 執行的是真實的 Electron 主程序與 renderer；仍建議人工補驗：本機視窗側欄 → Detach → 新視窗可操作終端 → 關閉 detached 視窗後 workspace 回到主視窗 |

#### 5. 改動檔案

- `electron/main.ts`（只有本單的 1 個 hunk；T0436 的 3 個 hunk 未 stage）
- `electron/__tests__/detached-workspace-persistence.test.ts`（新）
- `electron/__tests__/detached-window-profile-binding.test.ts`（錨點 1 行 + 註解）
- `e2e/detached-workspace.spec.ts`（新）
- `_ct-workorders/BUG-113-detached-workspace-not-found.md`（→ `FIXED` + 修復段）、本工單

#### 6. Commit

`electron/main.ts` 工作樹含平行 T0436 未提交的 hunk（`image-attachments` import、`dialog:select-attachments`、`clipboard:read-image-data-url`）。以 `git diff` 只擷取本單 hunk，`git apply --cached` 精準送進 index，其餘本單檔案逐一 `git add`，確認 `git diff --cached` 只含本單內容後 commit。commit message 含 `T0453`；不 push；未使用 stash／reset／checkout／restore。hash 以 `git log --grep T0453` 查詢。

### 遭遇問題

1. **detached 視窗內的終端變更不會持久化（設計取捨，已記錄於 BUG-113）**：save 為 no-op ⇒ 在 detached 視窗新增／關閉的終端不會寫進父視窗 entry；reattach 後父視窗顯示的是 detach 當時的終端清單（被關閉的終端在父視窗啟用該 workspace 時會以同 id 重建 PTY）。若要支援，建議另開工單，設計「detached → 父視窗 renderer 的切片合併事件」（父視窗 store 合併後由父視窗自己 save），不要讓 main 寫 entry。
2. **e2e 斷言語系**：isolated runtime 依 OS 語系啟動（此機為 zh-TW），所以英文 `getByText('Workspace not found')` 對不到。spec 改以 `.empty-state h2` + en／zh-CN／zh-TW regex 判定。
3. **T0446 source guard 調整**：見產出摘要第 3 節，改的是錨點（`indexOf` 取第一個出現位置的副作用），斷言語意不變。
4. 工作樹中有平行 Worker（T0434／T0436／T0449／T0450 等）的未提交改動，unit 全套因此有 4 檔失敗（見驗收表），本單沒有碰；commit 以 index 精準隔離。

### 回報時間

2026-10-05T06:54:02+08:00（Worker 時間戳取自 `date`）
