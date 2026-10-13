---
schema_version: 1
schema_kind: workorder
id: T0492
title: "移除未使用的 better-sqlite3：dependencies / @types / allowScripts / postinstall rebuild / verify-native-modules / server bundle nativePackages / CI rebuild / 文件"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P2
sizing: M
created_at: "2026-10-13T23:13:05+08:00"
started_at: null
updated_at: "2026-10-13T23:13:05+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0486"
  - "T0487"
  - "T0488"
  - "T0494"
  - "T0495"
related:
  - "T0473（app 無任何 import）、T0477（`git grep -l -F better-sqlite3 -- electron src` = 0 筆）、T0472（verify-native-modules 的 `.node` 檢查）"
  - "CLAUDE.md「本機開發：npm 12 install scripts」「Electron Runtime」「Packaging / Release 前置檢查」「Server bundle baseline」"
affects_files:
  - "package.json"
  - "package-lock.json"
  - "scripts/verify-native-modules.js"
  - "scripts/__tests__/"
  - "scripts/build-server-bundle.mjs"
  - "scripts/verify-server-bundle.js"
  - "electron/remote/"
  - "electron/terminal-server/"
  - ".github/workflows/"
  - "CLAUDE.md"
  - "README.md"
  - "docs/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權改 `package.json`（移除 better-sqlite3 / @types/better-sqlite3、allowScripts 條目、postinstall 相關段、build 設定中相關項）與 `package-lock.json`（只移除 better-sqlite3 與其**專屬**相依，其他套件版本不得變動；回報區附移除清單與證據）"
  - "✅ 本單授權改 `CLAUDE.md` 中與 better-sqlite3 相關的段落（其他段落不動；T0493 再統一套用其他工單建議）"
  - "🔴 先證明**桌面 app 與 headless server bundle 皆未使用**（含動態 require、server bundle runtime、terminal-server）；任一處有用到即停止移除並回報 PARTIAL"
  - "🔴 `@electron/rebuild` CI step：移除後若仍有其他需 Electron ABI 重建的原生模組（node-pty 等）則保留；只在證明無需時才移除並說明"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0492 — 移除未使用的 better-sqlite3：dependencies / @types / allowScripts / postinstall rebuild / verify-native-modules / server bundle nativePackages / CI rebuild / 文件

## 實作

1. 全 repo 證明無使用（`electron/`、`src/`、`scripts/`、server bundle 入口、e2e、測試）；列出所有引用處與處置
2. 移除：dependencies / devDependencies、`allowScripts`、postinstall 的 electron-rebuild（若只為 better-sqlite3；mac `plutil` 段保留）、`REQUIRED_NATIVE_MODULES` 與 T0472 `.node` 檢查（含測試）、`build-server-bundle.mjs` nativePackages、`verify-server-bundle.js`、`build.asarUnpack` / files 規則（若有）
3. 更新 lock（比照 T0483：只保留必要變動）；本機 `npm ci` 後 `node scripts/verify-native-modules.js` exit 0
4. server bundle：本機建置一次（依 repo 既有 script）並跑 `verify-server-bundle`（不可行則說明）
5. 文件：CLAUDE.md 相關段落、README 技術堆疊（若仍提及）、docs

## 驗收條件

- [ ] 無使用證據表；lock 移除清單（只含 better-sqlite3 專屬相依）
- [ ] `npm ci` 乾淨（npm 12 結尾警告只剩預期項目）；verify-native-modules ✅；`npm run verify:helpers` ✅
- [ ] `npm run test:unit`、`npx vite build`、`npx tsc --noEmit -p .`；server bundle 建置 / 驗證結果
- [ ] CI 影響說明（pre.5 CI 由塔台觀察）

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
