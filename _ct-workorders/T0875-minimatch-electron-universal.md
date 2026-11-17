---
schema_version: 1
schema_kind: workorder
id: T0875
title: "npm audit：electron-builder 工具鏈的 minimatch@9（moderate ×6）評估修正或列為例外"
type: implementation
status: PENDING
created_at: "2026-11-17T10:27:04+0800"
started_at: ""
updated_at: "2026-11-17T10:27:04+0800"
completed_at: ""
session_ids: []
repo: better-agent-terminal
priority: P3
sizing: M
depends_on: [T0874]
related:
  - "D298（T0873〈建議後續〉3）；D297；T0873〈npm audit 剩餘項目〉；D057／D136（mac 只打 arm64）"
affects_files:
  - _ct-workorders/T0875-minimatch-electron-universal.md
  - package.json（只限 `overrides`）
  - package-lock.json
  - docs/agent-guide/packaging-release-checks.md（只限記錄 audit 例外或 overrides 理由）
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 不升 `electron-builder`（維持 26.18.0，T0873 已過 W6）、不降版。只允許在 `package.json` `overrides` 加**範圍限定**的項目（例 `\"@electron/universal\": { \"minimatch\": \"…\" }`），不得加會影響其他套件的全域 `minimatch` override；既有 `overrides`（`minimatch@3`、`minimatch@5` 等）不動。"
  - "🔴 判準：修正後 `@electron/universal` 用到的 minimatch API 在新版仍然存在且語意相同（讀 `@electron/universal@2.0.3` 原始碼的每個呼叫點，對照新版 minimatch 的 changelog／匯出），而且本機能驗的關卡全過。任何一點無法確認 → 不修，改把這 6 項記為已接受的 audit 例外（寫明：只在 mac universal 打包時執行、本專案 mac 只打 arm64、上游狀態），寫進 docs。"
  - "🔴 不得觸發 workflow；mac 打包只能由塔台之後派 `desktop-build.yml` 驗證，回報區寫明需要驗什麼。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
  - "ℹ️ T0873 的驗證方式可沿用（回報區〈環境與驗證方式〉），但若為 server bundle 臨時放入 linux 平台套件，`build:dir` 前一定要刪掉（T0873 發現會污染 Windows 包）。"
---

# T0875 — electron-builder 工具鏈的 minimatch@9：修正或列為例外

## 元資料
- **工單編號**：T0875｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-17 10:27 (UTC+8)
- **規模**：M｜**依賴**：T0874（同一個 checkout，依序執行）｜**決策**：D298

## 背景
T0873 後 `npm audit` 剩 8 項，其中 6 項（moderate）是同一則 GHSA-g3hv-75wg-m249：`electron-builder@26.18.0` → `app-builder-lib`／`dmg-builder` → `@electron/universal@2.0.3` → `minimatch@9.0.9`（受影響範圍 `>=7 <11.0.1`）。npm 給的 fix 是降到 electron-builder 25（不可行）。`@electron/universal` 只在 mac universal 打包時執行，本專案 mac 只打 arm64（D057／D136）。npm 上 `@electron/universal` 最新為 3.0.6（未確認其 minimatch 版本）。

## 任務
1. 確認依賴路徑與 `@electron/universal@2.0.3` 中所有 minimatch 呼叫點（檔案:行、用法）。
2. 查 minimatch 10／11 的破壞性變更（匯出方式、選項、Node 版本要求），判斷能否以 `overrides` 讓 `@electron/universal` 改用已修版。也評估 `@electron/universal` 3.x 是否可經 `overrides` 替換（API 是否與 app-builder-lib 26.18.0 的呼叫相容）；兩者擇風險低的，或都不做。
3. 若修：加範圍限定的 `overrides`、`npm install`（只更新 lock）、跑關卡；確認 `npm audit` 那 6 項消失、沒有新增項目。
4. 若不修：在 `docs/agent-guide/packaging-release-checks.md` 記錄這 6 項為已接受的例外（理由、上游狀態、何時重新檢查，例如 electron-builder 升級時）。

## 關卡
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit`、`npm run test:legacy`（與 T0873 最終比較）
- `npx vite build`
- `npm run build:dir` ＋ `verify-packaged-native --platform win --arch x64`
- `npm ci` 在最終 lock 上 exit 0，install-scripts 警告與 T0874 後相同

## 驗收條件
- [ ] 呼叫點清單與 API 相容性判斷（附依據）
- [ ] 結論：修（overrides 內容、audit 前後）或列為例外（docs 段落）
- [ ] 關卡不比 T0873 最終差
- [ ] 回報區寫明需要塔台派 `desktop-build.yml` 驗證的項目（若有修）
- [ ] commit 只含本單範圍，不 push

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
