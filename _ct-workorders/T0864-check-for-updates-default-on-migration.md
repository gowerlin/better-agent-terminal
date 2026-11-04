---
schema_version: 1
schema_kind: workorder
id: T0864
title: "檢查新版預設改開：`checkForUpdates` 預設 true＋一次遷移既有 `false`（一次性標記；主行程啟動檢查與 renderer 同一規則）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-05T07:03:05+0800"
started_at: "2026-11-05T07:36:39+0800"
updated_at: "2026-11-05T07:42:28+0800"
completed_at: "2026-11-05T07:42:28+0800"
session_ids:
  - "3800d91d-a34e-4574-9461-cf545b241e98"
depends_on: [T0863, T0860]
related:
  - "D288；T0863 回報區〈後續建議〉1 / 2；D287；BUG-212；CLAUDE.md「Detached workspace 視窗的持久化」（settings.json 由各 renderer 整份 save()，detached 不另開 Settings）"
affects_files:
  - _ct-workorders/T0864-check-for-updates-default-on-migration.md
  - src/stores/settings-store.ts
  - src/types/index.ts
  - src/lib/
  - electron/update-checker.ts
  - electron/__tests__/
  - src/stores/__tests__/
  - src/lib/__tests__/
  - e2e/site-media.spec.ts
  - e2e/t0776-auto-dialog-focus.spec.ts
  - e2e/t0821-upgrade-interruption.spec.ts
  - e2e/t0823-installer-graceful-quit.spec.ts
  - e2e/t0825-second-instance-startup.spec.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 使用者裁決（D288，不得更改）：`checkForUpdates` 預設改 `true`，而且既有使用者存在 `settings.json` 的 `false` 一次改成開；遷移只做一次（一次性標記），之後使用者自己再關掉就尊重使用者的值、不再改回。"
  - "🔴 同一規則只寫一處：遷移判斷做成純函式（建議 `src/lib/` 新檔，main 與 renderer 共用，不 import electron / DOM），主行程 `parseUpdateSettings`（`electron/update-checker.ts`）與 renderer 載入設定都經它。主行程只讀、不寫 `settings.json`（寫入仍只由 renderer 的 `save()`）；🔴 不得讓 detached / profile 視窗變成新的 settings 寫入者（CLAUDE.md「Detached workspace 視窗的持久化」）；遷移後的寫入沿用既有主視窗 save 路徑，寫明是哪個視窗、何時寫。`electron/main.ts` 不動（T0860 / T0861 正在改；若真的非動不可先問塔台）。"
  - "🔴 Help 手動檢查、`includePrereleaseUpdates`、T0863 的只查一次／只彈一次規則都不變。e2e 不得因本單開始連 GitHub 或跳更新對話框：既有以 `checkForUpdates: false` 關掉更新的 5 個 spec 一併寫入標記（或等效作法，寫明），並確認 spec 內重開 app 的第二次啟動也不檢查。日誌只記結果（例 `[update-check] settings migrated`），不記檔案內容。"
  - "yolo：不得問使用者；問題問塔台。不發版、不 push、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0864 — 檢查新版預設改開＋一次遷移既有 `false`（D288）

## 元資料
- **工單編號**：T0864｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-05 07:03 (UTC+8)
- **規模**：S｜**決策**：D288｜**依賴**：T0863（已 DONE）、T0860（可能改同一批 e2e spec，同一個 checkout 不並行）

## 背景
T0863 把「檢查新版」改成啟動時查一次，但 `src/stores/settings-store.ts` 的 `checkForUpdates` 預設是 `false`（2026-04 `2f0df589`）。renderer 存設定時把整份記憶體副本（含預設值）寫回 `settings.json`，所以只要使用者存過任何設定，檔案裡就是 `false`，啟動檢查實際是關的（Settings 也顯示未勾選）。已發佈的版本本來就找不到新版（BUG-212），這個 `false` 幾乎都不是使用者自己選的。使用者裁決 B：預設改開，並一次遷移既有的 `false`。

## 任務
1. 新增遷移純函式（建議 `src/lib/` 新檔，名稱自訂）：輸入讀到的設定物件，回傳生效值與「是否需要寫回」。規則：沒有標記 → `checkForUpdates` 視為 `true`（不論檔案寫什麼）、需寫回 `checkForUpdates: true`＋標記；有標記 → 照檔案值（沒有鍵 = `true`）。標記鍵名自訂（例 `checkForUpdatesMigrated: true`），寫明。
2. `src/stores/settings-store.ts`：預設 `checkForUpdates: true`；載入設定時經任務 1，需要寫回時經既有 save 路徑存一次（只由主視窗；寫明 detached / profile 視窗如何避開）。`src/types/index.ts` 加標記欄位與註解。
3. `electron/update-checker.ts` `parseUpdateSettings`：經任務 1，沒有標記時 `checkForUpdates` 視為開（升級後第一次啟動就檢查）；主行程不寫檔。
4. e2e：`site-media.spec.ts`、`t0776-*`、`t0821-*`、`t0823-*`、`t0825-*` 以 `checkForUpdates: false` 關更新的地方一併寫入標記（或等效作法），確保第一次與重開後的啟動都不檢查。若 T0860 已改過這些檔，在它之後改、不覆蓋它的內容。
5. 測試：純函式各情況（無鍵、`false` 無標記、`true` 無標記、`false` 有標記、`true` 有標記、檔案讀不到 / 非物件）；`parseUpdateSettings` 對應；settings-store 載入後的值與寫回次數（只寫一次、有標記後不再寫）；手動檢查不受影響。

### 驗收條件
- [x] 上述測試通過；T0863 的測試（`update-checker`、`UpdateNotification`、`dialog-escape.test.tsx`）不回歸
- [x] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [x] 回報區寫明：標記鍵名、遷移寫回發生在哪個視窗與時機、e2e 的處理方式、`electron/main.ts` 沒有變動
- [x] commit 只含本單範圍

---

## 回報區

### 完成狀態
- **狀態**：DONE
- **完成時間**：2026-11-05T07:42:28+0800
- **session_id**：3800d91d-a34e-4574-9461-cf545b241e98
- **產品 commit**：`7a07cfca` feat(update): checkForUpdates on by default, migrate a saved false once (T0864, D288)

### 落點檢查
- 結果：**PASS**
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（C-3 僅參考）
- C-1：工單在 REPO_ROOT 的 `_ct-workorders/` 下 → PASS
- C-3：`src/stores/settings-store.ts` 等皆存在 → PASS
- C-2：工單無 `branch` 欄位，目前 `main`
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`CT_HOME` 未設（非 worktree）

### 實作摘要
1. **純函式** `resolveCheckForUpdates(settings: unknown)`（新檔 `src/lib/check-for-updates-migration.ts`，不 import electron / DOM）→ `{ checkForUpdates, needsWrite }`：
   - 非物件（讀不到、格式錯、`null`、陣列）→ `{ true, false }`
   - 沒有標記（`checkForUpdatesMigrated !== true`）→ `{ true, true }`（不論檔案寫 `false` / `true` / 沒有鍵）
   - 有標記 → `{ checkForUpdates !== false, false }`（沒有鍵 / 非 boolean = 開）
2. **標記鍵名**：`checkForUpdatesMigrated: true`（常數 `CHECK_FOR_UPDATES_MIGRATED_KEY`；只有 `true` 算有標記）。`src/types/index.ts` `AppSettings` 加欄位與註解。
3. **renderer** `src/stores/settings-store.ts`：預設 `checkForUpdates: true`＋`checkForUpdatesMigrated: true`（新安裝第一次存檔就帶標記，之後使用者關掉會被尊重）。`load()` 經純函式算生效值、記憶體一律帶標記；`needsWrite` 時呼叫 `writeCheckForUpdatesMigration()` → 既有 `save()` 寫一次。
4. **主行程** `electron/update-checker.ts` `parseUpdateSettings`：`checkForUpdates` 改經 `resolveCheckForUpdates`；沒有標記 → 開（升級後第一次啟動就檢查）。主行程仍只讀、不寫 `settings.json`。**`electron/main.ts` 沒有變動**（`git diff` 無輸出）。
5. 日誌（renderer → `debug.log`，只記結果、不記檔案內容）：`[update-check] settings migrated: checkForUpdates on (written once)`、`… not written (detached window)`、`… not written (remote window)`、`… write failed: <錯誤訊息>`。

### 遷移寫回：哪個視窗、何時
- **時機**：視窗啟動時 `App.tsx` initProfile 呼叫 `settingsStore.load()`（既有呼叫點，App.tsx 未改）；讀到的檔案沒有標記時，在 `load()` 內 await 一次 `save()`（寫入的是記憶體整份設定，含 `checkForUpdates: true`＋標記）。檔案有標記後任何視窗的 `load()` 都不再寫。
- **哪個視窗寫**：只有「本機、非 detached」的視窗。
  - detached workspace 視窗：`workspace.getDetachedId()` 有值 → 不寫（只在記憶體套用），不成為新的 settings 寫入者。
  - 連到 remote profile 的視窗：`remote.clientStatus().connected` 為真 → 設定是遠端主機的檔，不寫。未連線時 `settings:load` 本來就被拒（T0443），延後到連上後才 load，那時同樣判定為 remote 不寫。
  - 本機的其他 profile 視窗：原本就是 settings 寫入者（可開 Settings 存檔），沒有增加寫入者；若多個本機視窗同時在遷移前載入，每個視窗**最多寫一次**、內容相同（都由同一份檔案＋預設值組成），一般單視窗只有一次。
- 寫入失敗不影響 `load()`（記錄 `write failed`），下次啟動仍沒有標記、主行程照樣視為開，會再試一次。

### e2e 的處理方式
- `site-media.spec.ts`、`t0776-auto-dialog-focus.spec.ts`、`t0821-upgrade-interruption.spec.ts`、`t0823-installer-graceful-quit.spec.ts`、`t0825-second-instance-startup.spec.ts`：寫入 `checkForUpdates: false` 的地方一併寫 `checkForUpdatesMigrated: true`。
- 這 5 個 spec 都是「seed 設定 → `win.reload()`」，t0821 / t0823 另以同一 runtimeId 重開：reload 後 renderer 讀到有標記的 `false` → 不寫回、維持關；重開時主行程 `parseUpdateSettings` 讀到有標記的 `false` → `startup: off`。若沒有加標記，reload 時 renderer 會把它遷移成 `true` 寫回，重開就會檢查 → 已避免。
- 本單沒有改 T0860 對 `t0823` 的內容（T0860 的 commit `44982662` 已在本單之前，只改那一行）。e2e 本身沒有執行（工單驗收未要求；不連 GitHub）。

### 驗證
| 閘門 | 結果 |
|---|---|
| 目標測試（`check-for-updates-migration.test.ts`、`settings-store.checkForUpdates.test.ts`、`update-checker.test.ts`、`update-notification.test.tsx`） | PASS，4 檔 65 項 |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npm run test:unit` | PASS，450 檔通過 / 3 skipped；8241 passed / 40 skipped |
| `npm run test:legacy` | PASS，33 檔 / 472 項，0 failed |
| `npx vite build` | 成功（exit 0） |

- 新增測試涵蓋：純函式各情況（無鍵、`false` 無標記、`true` 無標記、標記非 `true`、`false` 有標記、`true` 有標記、讀不到 / 非物件）；`parseUpdateSettings` 對應（含 `includePrereleaseUpdates` 不受遷移影響）；settings-store 載入後的值與寫回次數（遷移只寫一次、再載入與新 store 都不再寫、使用者遷移後關掉 → 下次載入維持關、detached / remote 不寫、格式錯不寫、寫入失敗不影響 load）；source guard：Help 手動檢查只讀 `includePrereleaseUpdates`、`main.ts` 不含標記。
- T0863 測試不回歸：既有 `parseUpdateSettings` 案例「`{"checkForUpdates":false}` → 關」依 D288 改為帶標記的 `false` → 關，並新增「沒有標記的 `false` → 開」；其餘（`StartupUpdateCheck` 只查一次 / 只彈一次、手動檢查、`includePrereleaseUpdates`）未改且通過。`dialog-escape.test.tsx` 在 `test:unit` 內通過。

### 異動檔案
- 新增：`src/lib/check-for-updates-migration.ts`、`src/lib/__tests__/check-for-updates-migration.test.ts`、`src/stores/__tests__/settings-store.checkForUpdates.test.ts`
- 修改：`src/stores/settings-store.ts`、`src/types/index.ts`、`electron/update-checker.ts`、`electron/__tests__/update-checker.test.ts`、5 個 e2e spec（各一行）
- 未動：`electron/main.ts`、`src/App.tsx`

### 遭遇問題
- 無阻塞。

### 殘留風險 / 後續建議
1. 其他 e2e spec 若經 renderer store 存設定（例如 UI 改設定）後以同一 runtimeId 重開，重開時會檢查新版（之前 renderer 預設 `false`，存檔即關）。盤點 renderer 啟動時不會自動存設定（store 的 setter 只由 Settings / 少數 UI 呼叫），且 isolated instance 第一次啟動沒有 `settings.json` 時主行程本來就會檢查（T0863 起），所以新增的暴露面只有「經 UI 存過設定再重開」這種流程；若要讓所有 e2e 都不連 GitHub，建議另開單在 `e2e/fixtures/electron-isolation.ts` 的 `launchIsolated` 統一預寫 `settings.json`（不在本單範圍）。
2. Settings 面板的 `checkForUpdates` 勾選框沿用 `!== false`，遷移後顯示勾選；遠端視窗的 Settings 改的是遠端主機的檔（既有行為，主行程讀本機檔），本單未改。

### 互動紀錄
- 無（yolo，未向塔台提問）。
