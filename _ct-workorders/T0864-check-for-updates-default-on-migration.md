---
schema_version: 1
schema_kind: workorder
id: T0864
title: "檢查新版預設改開：`checkForUpdates` 預設 true＋一次遷移既有 `false`（一次性標記；主行程啟動檢查與 renderer 同一規則）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-05T07:03:05+0800"
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
- **工單編號**：T0864｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-05 07:03 (UTC+8)
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
- [ ] 上述測試通過；T0863 的測試（`update-checker`、`UpdateNotification`、`dialog-escape.test.tsx`）不回歸
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [ ] 回報區寫明：標記鍵名、遷移寫回發生在哪個視窗與時機、e2e 的處理方式、`electron/main.ts` 沒有變動
- [ ] commit 只含本單範圍

---

## 回報區

（Worker 填寫）
