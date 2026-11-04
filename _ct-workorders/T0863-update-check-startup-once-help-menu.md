---
schema_version: 1
schema_kind: workorder
id: T0863
title: "檢查新版：只在啟動時檢查一次（主行程查一次、各視窗共用結果）、不自動安裝、Help「檢查更新…」、設定「包含預覽版（pre / beta / rc）」、開該版本的 Release 頁；修 BUG-212"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-04T18:35:08+0800"
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
- **工單編號**：T0863｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 18:35 (UTC+8)
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
