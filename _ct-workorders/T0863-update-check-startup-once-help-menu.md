---
schema_version: 1
schema_kind: workorder
id: T0863
title: "檢查新版：只在啟動時檢查一次（主行程查一次、各視窗共用結果）、不自動安裝、Help「檢查更新…」、設定「包含預覽版（pre / beta / rc）」、開該版本的 Release 頁；修 BUG-212"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-04T18:35:08+0800"
started_at: "2026-11-04T19:15:25+0800"
updated_at: "2026-11-04T19:27:26+0800"
completed_at: "2026-11-04T19:27:26+0800"
session_ids:
  - "5606fc63-a75f-4cf3-a7f9-ec012414b621"
depends_on: [T0857, T0859]
related:
  - "BUG-212；D287；T0821（更新通知的 Windows 升級提示 `showsWindowsUpgradeWarning`）；T0563 / T0567 / T0776（Dialog 規則）"
affects_files:
  - _ct-workorders/T0863-update-check-startup-once-help-menu.md
  - electron/update-checker.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/UpdateNotification.tsx
  - src/components/SettingsPanel.tsx
  - src/stores/settings-store.ts
  - src/types/index.ts
  - src/App.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - src/components/__tests__/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 使用者規格（D287，不得更改）：① 自動檢查只在程式啟動時做一次，不做任何定時檢查；② 只檢查、不下載、不安裝（不引入 electron-updater 或任何自動更新）；③ Help 功能表加「檢查更新…」；④ 有新版時提供打開**該版本**的 GitHub Release 頁（`html_url`，不是 `/releases` 總覽）；⑤ Settings 提供「包含預覽版（pre / beta / rc）」選項。"
  - "🔴 既有 `checkForUpdates: false` 只關掉啟動時的自動檢查；Help 手動檢查不受它影響。「包含預覽版」預設**開**（本 fork 目前只發預覽版，預設關等於永遠不通知；塔台決定，回報區寫明）。"
  - "🔴 版本判斷：只認桌面版 tag `v<semver>`，排除 `server-bundle-v*`、草稿；比對照 semver precedence（核心版號數字比對；預覽識別碼逐段比，數字段以數字比，`pre` / `beta` / `rc` / `alpha` 以字串比；同核心版號時正式版 > 預覽版）。關閉「包含預覽版」時只看非預覽版。查 GitHub 用 `/releases`（分頁取足夠筆數，寫明上限）＋逾時（建議 10 s），沿用 Node `https`，不新增依賴；`gh` / 權杖都不用。"
  - "🔴 只查一次：啟動時由主行程查一次，結果經 IPC 給各視窗（detached / profile 視窗不各自打 GitHub）；更新對話框每次啟動只在一個視窗顯示一次。手動檢查的結果只顯示在發出請求的視窗：有新版 → 既有更新對話框（保留 `showsWindowsUpgradeWarning`）；已是最新 → 小訊息「已是最新版 v…」；失敗 → 小訊息附原因。小訊息若用 Dialog，照 CLAUDE.md 規則（`ModalOverlay`、[X]、`onEscape`、`dialog-escape.test.tsx`）。新字串三語都要有。"
  - "🔴 不改 PLAN-065 的檔案範圍以外的行為；`main.ts` 只動 update 相關區塊與 Help 選單（T0857 已改過 `main.ts`，先 `git log` 確認在它之後）。日誌只記版本與結果，不記 release body。yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0863 — 檢查新版：啟動一次＋Help 手動檢查＋包含預覽版設定（BUG-212）

## 元資料
- **工單編號**：T0863｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 18:35 (UTC+8)
- **規模**：M｜**決策**：D287｜**依賴**：T0857、T0859（同改 `electron/main.ts`，同一個 checkout 不並行；塔台 18:54 調整）

## 背景
使用者要求（D287）：自動檢查新版只在程式開啟時做一次、不做定時檢查、只檢查不自動安裝；Help 功能表加「檢查更新」；有新版時可打開該版本的 GitHub Release 頁；Settings 可選是否包含預覽版（pre / beta / rc）。

塔台核對發現現在的檢查永遠找不到新版（BUG-212）：`releases/latest` 排除預覽版而回 404、`compareVersions` 不認得 `-pre.N`、清單混有 `server-bundle-v*`；主行程與每個視窗各查一次。原因與行號見 `_ct-workorders/BUG-212-update-check-never-finds-prerelease.md`。

## 任務
1. `electron/update-checker.ts`：改查 `/releases`、過濾桌面版 tag、semver 比對（純函式，可單元測試）、依「包含預覽版」選出最新版、逾時；回傳該版本的 `html_url`。不再挑 Windows 下載網址（沒有使用處就移除，有就保留）。
2. 啟動檢查：主行程查一次（`checkForUpdates !== false` 時），結果經 IPC 提供給 renderer；`UpdateNotification` 改讀主行程結果、不自己打 GitHub；每次啟動只彈一次。
3. Help 選單「檢查更新…」（三語或沿用選單現有語言慣例，寫明）：手動查詢 → 結果送到發出請求的視窗（任務 4）。現有頂層「🎉 Update Available!」選單：改成指向該版本 Release 頁，或併入 Help，擇一並寫理由。
4. renderer：有新版 → 既有更新對話框；已是最新 / 失敗 → 小訊息。「在 GitHub 查看」開該版本頁。
5. Settings：既有 `checkForUpdates` 旁加「包含預覽版（pre / beta / rc）」，`src/types/index.ts` / `settings-store.ts` 加欄位（預設開）。
6. 測試：semver 比對（`0.7.4-pre.9` < `0.7.5-pre.1` < `0.7.5-rc.1` < `0.7.5`；`beta` < `pre` < `rc`；正式版 > 同核心預覽版；無效 tag 忽略）、排除 `server-bundle-v*` 與草稿、開 / 關預覽版、404 / 逾時 / 非 200、只查一次（多視窗不重查）、手動檢查三種結果、Dialog Esc 規則。
7. 既有 e2e 以 `checkForUpdates: false` 關掉更新對話框的寫法不得失效（`e2e/t0776-*`、`t0821-*`、`t0823-*`、`t0825-*`、`site-media.spec.ts`）。

### 驗收條件
- [ ] 上述測試通過；`dialog-escape.test.tsx`、`upgrade-interruption.test.tsx` 不回歸
- [ ] 以實際 GitHub API（唯讀、不帶權杖）跑一次比對：目前版本假設為 `0.7.4-pre.8` 時找得到 `v0.7.4-pre.9`、開的是該版本頁；關閉預覽版時回「沒有新版」。回報列出指令與結果
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **狀態**：DONE（驗收條件全數通過）
- **完成時間**：2026-11-04T19:27:26+0800
- **session_id**：5606fc63-a75f-4cf3-a7f9-ec012414b621
- **產品 commit**：`ee53eaf5`（15 檔，只含本單範圍；`git add <明確路徑>`）

### 落點檢查
- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = `<使用者資料夾外的 repo 根目錄>/better-agent-terminal`）
- C-1：工單在 REPO_ROOT 下 → PASS；C-3：`electron/update-checker.ts` 等皆存在 → PASS；C-2：工單無 `branch` 欄位（目前 `main`）
- `CT_HOME` 未設定（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`；`BAT_REMOTE_TOKEN` 已設定
- `main.ts` 先 `git log` 確認：最後一個 commit 是 `517541b5`（T0859），本單在它之後

### 結果摘要
1. **`electron/update-checker.ts`（重寫、不 import electron）**
   - 查 `/repos/gowerlin/better-agent-terminal/releases?per_page=100&page=N`，最多 `RELEASES_MAX_PAGES` = 3 頁（300 筆；目前 179 筆 → 2 頁），整個檢查 `UPDATE_CHECK_TIMEOUT_MS` = 10 s（`AbortController`，Node `https`，不帶權杖、不用 `gh`、不新增依賴）。
   - 只認 `v<semver>` tag（`server-bundle-v*` 與其他 tag、草稿不算）；semver precedence（核心數字比、預覽識別碼逐段比：數字段以數字比、字串段 ASCII 比、數字 < 字串、同核心時正式版 > 預覽版、build metadata 忽略）。
   - 「預覽版」= 版號有預覽識別碼**或** GitHub 標 `prerelease`；關閉「包含預覽版」時兩者都跳過。
   - 回傳該版本的 `html_url`（`releasePageUrl`：不是本 repo releases 頁就以 tag 重組 `…/releases/tag/<tag>`）。移除 Windows 下載網址（`downloadUrl`，沒有使用處）。
   - 失敗一律 `status: 'error'` + 短原因（`GitHub HTTP 404` / `timed out after 10 s` / 網路錯誤訊息 / 非 JSON / 非清單），不 reject。
   - `StartupUpdateCheck`：`run` 只查一次（第二次呼叫回第一次的結果）、`skip`（`checkForUpdates: false`）、`claim`：第一個在 `checkForUpdates` 仍開著時要結果的視窗拿到新版，其他與之後一律 `null`；在 `run` 之前要的視窗會等。
   - `parseUpdateSettings`：只有明確 `false` 才關（缺少 / 壞檔 → 兩項都開）。
2. **`electron/main.ts`**（只動 update 區塊與 Help 選單）：啟動 2 s 後主行程查一次（不定時）；`update:check` IPC 移除，改 `update:claim-startup-result`；Help 加「Check for Updates…」（手動、不看 `checkForUpdates`，進行中再點沿用同一次；結果以 `update:manual-result` 只送給發出請求的視窗：選單 click 的視窗 → focused → 第一個視窗）；找到新版時更新 `updateCheckResult` 並重建選單。日誌 `[update-check] startup|manual: update|latest|failed current=… latest=… includePrerelease=… [reason=…]`，不記 release body。
3. **頂層「🎉 Update Available!」選單：保留在頂層、改開該版本頁**（`release.htmlUrl`）。理由：更新對話框關掉後，這是唯一不用打開選單就看得到的「有新版」提示；Help 的「Check for Updates…」是動作，兩者分工。
4. **renderer**：`UpdateNotification` 不再打 GitHub、不讀 settings；主視窗（App.tsx 主分支）`claimStartup` 預設 true，detached 視窗 `claimStartup={false}`（只收 Help 結果）。Help 結果：新版 → 既有更新對話框（保留 `showsWindowsUpgradeWarning`）；已是最新 → 小 Dialog「已是最新版 v…」；失敗 → 小 Dialog 附原因。兩個 Dialog 都經 `ModalOverlay`、有 [X]（`aria-label` = `common.close`）、OK、`onEscape`。「在 GitHub 查看」開該版本頁（`releasePageToOpen` 再驗一次網址前綴）。
   - ⚠️ **發現：`UpdateNotification` 原本從未被掛載**（`git log -S` 查不到任何掛載），所以 T0863 前根本不會出現更新對話框，只有選單項目。本單在 App.tsx 兩個分支掛上（工單任務 2 / 4 需要）。
5. **Settings**：`checkForUpdates` 下方加「包含預覽版（pre / beta / rc）」（`includePrereleaseUpdates`，`src/types/index.ts` / `settings-store.ts` 預設 **true**，塔台 D287 決定：本 fork 只發預覽版，預設關等於永遠不通知）。`checkForUpdatesHint` 三語改寫：不再寫「定期」，改「啟動時檢查一次、不會下載或安裝、Help › Check for Updates… 隨時可查」。
6. **選單語言**：沿用選單現有慣例（全部英文：`GitHub Repository` / `Report Issue` …），新項目 `Check for Updates…` 英文；renderer 新字串 en / zh-TW / zh-CN 三語都有。
7. **e2e 的 `checkForUpdates: false`**：`claim` 每次都重讀 settings.json，存成 `false` 後 reload 的視窗拿到 `null`（測試「checkForUpdates off now (e2e saves it, then reloads)」）；五個 spec 的寫法不需改。

### 變更檔案
- `electron/update-checker.ts`、`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`
- `src/components/UpdateNotification.tsx`、`src/App.tsx`、`src/components/SettingsPanel.tsx`、`src/stores/settings-store.ts`、`src/types/index.ts`
- `src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`
- 新測試 `electron/__tests__/update-checker.test.ts`（32 tests）、`src/components/__tests__/update-notification.test.tsx`（16 tests）
- `src/components/__tests__/upgrade-interruption.test.tsx`：mock 由 `update.check` 改成 `claimStartupResult` / `onManualResult`，「在 GitHub 查看」的預期網址由 `/releases` 改成該版本頁（規格 ④ 的行為變更）；Windows 警告的斷言不變

### 驗證
| 關卡 | 結果 |
|---|---|
| `npm run typecheck` | ✅ 0 |
| `npm run typecheck:electron` | ✅ 0 |
| `npm run test:unit` | ✅ 447 files passed / 3 skipped；8186 tests passed / 40 skipped（含 `dialog-escape.test.tsx`、`upgrade-interruption.test.tsx`） |
| `npm run test:legacy` | ✅ files 33 passed / 0 failed；tests 472 passed / 0 failed |
| `npx vite build` | ✅ exit 0 |
| 實際 GitHub API（唯讀、不帶權杖） | ✅ 見下 |

測試涵蓋：semver（`0.7.4-pre.9` < `0.7.5-pre.1` < `0.7.5-rc.1` < `0.7.5`；`alpha` < `beta` < `pre` < `rc`；`pre.9` < `pre.10`；正式版 > 同核心預覽版；無效版號 / tag 忽略）、排除 `server-bundle-v*` 與草稿、開 / 關預覽版、404 / 403 / 500 / 逾時 / 網路錯誤 / 非 JSON、分頁上限、只查一次（多視窗不重查、只一個視窗拿到）、手動檢查三種結果、Dialog [X] / OK / Esc、三語字串、App / Settings 接線與 source guard（無 `releases/latest`、無 `update:check`、無 electron-updater、renderer 不打 GitHub）。

實際 API 指令（scratchpad 腳本 import `electron/update-checker.ts`，以 `node_modules/.bin/tsx` 執行；另以 `curl` 唯讀取 3 頁 release 清單確認：179 筆、全是 prerelease、只有 v0.x 線）：
```
current=0.7.4-pre.8 includePrerelease=true  -> update latest=v0.7.4-pre.9 page=https://github.com/gowerlin/better-agent-terminal/releases/tag/v0.7.4-pre.9 (2602 ms)
current=0.7.4-pre.8 includePrerelease=false -> latest latest=none page=- (129 ms)
current=0.7.4-pre.9 includePrerelease=true  -> latest latest=v0.7.4-pre.9 (110 ms)
```
未做：實機啟動 BAT 點 Help 選單（runtime smoke）——本單驗收條件沒有要求，屬待驗收項目。

### 遭遇問題
- `npx tsx -e "…"` 跑實際 API 時卡住 120 s 沒有輸出（改用腳本檔＋本機 `tsx` 後 2.6 s 完成，原因未查，與產品程式無關）。

### 後續建議（給塔台）
1. 🔴 **`settings-store.ts` 的 `checkForUpdates` 預設是 `false`**（`2f0df589`，2026-04 使用者改的預設），而主行程把「沒有這個鍵」當成開。renderer 存設定時會把整份記憶體副本（含預設值）寫回 `settings.json`，所以**只要使用者存過任何設定，啟動檢查就是關的**；Settings 也顯示未勾選。D287 ①「啟動時檢查一次」對大多數既有使用者實際上不會發生（Help 手動檢查不受影響）。本單照工單「不改既有 `checkForUpdates` 行為」沒有動；要不要把預設改成 `true`（以及既有使用者寫進檔案的 `false` 分不出是否本人選的）需塔台 / 使用者裁示。
2. e2e 殘留風險：`UpdateNotification` 現在有掛載，若 GitHub 上有比 repo `package.json` 版號更新的 release，沒有設 `checkForUpdates: false` 的 e2e spec 第一次載入會出現更新對話框（目前版號 `0.7.4-pre.9` = 最新，不會發生）。
3. CLAUDE.md / docs 沒有「檢查更新」一節（本單不在範圍）；若要補，唯一實作位置是 `electron/update-checker.ts`（`checkForUpdates` / `StartupUpdateCheck`）與 `src/components/UpdateNotification.tsx`。

### 互動紀錄
- 無（yolo，未向塔台提問；上列後續建議 1 判定不阻擋本單範圍，改列給塔台）

### Commit
- 產品：`ee53eaf5`；工單：本次回報 commit（只含本工單檔）
- 不 push、未用 `git stash` / `reset` / `checkout --` / `restore`
