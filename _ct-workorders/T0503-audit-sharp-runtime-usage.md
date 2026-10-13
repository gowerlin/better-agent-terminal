---
schema_version: 1
schema_kind: workorder
id: T0503
title: "盤點 sharp / @img 是否仍在 runtime 使用：未使用則從 server bundle nativePackages、build.asarUnpack、optionalDependencies 移除（devDependency 保留給 generate-icons.js）"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-13T23:55:30+08:00"
started_at: null
updated_at: "2026-10-13T23:55:30+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0492"
related:
  - "T0492 回報區「建議 / 範圍外發現」5：`sharp` 是 devDependency，卻被 server bundle `nativePackages` 複製，`build.asarUnpack` 也列 `node_modules/@img/**/*`"
  - "塔台 23:55 初查：`electron/` / `src/` 無任何 `sharp` import；`scripts/generate-icons.js` 使用 sharp；`optionalDependencies` 含 `@img/sharp-darwin-{arm64,x64}`、`@img/sharp-libvips-darwin-{arm64,x64}`（commit `24a3304`「add @img/sharp-darwin-arm64 native binaries for Apple Silicon image resize support」）"
  - "T0475 / BUG-117：mac `.app` 內 Mach-O 全掃（`verify-packaged-native.js`），`@img` 為其中一部分"
affects_files:
  - "package.json"
  - "package-lock.json"
  - "scripts/build-server-bundle.mjs"
  - "scripts/verify-server-bundle.js"
  - "scripts/verify-packaged-native.js"
  - "scripts/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權改 `package.json`（`optionalDependencies` 的 `@img/*`、`build.asarUnpack` 的 `@img` 規則）與 `package-lock.json`（只能移除 / 改 dev 旗標於 sharp / @img 系列；其他套件版本不得變動，比照 T0483 / T0492 移植法，回報區附清單）"
  - "🔴 先證明 runtime 未使用（桌面 app、headless server bundle、動態 require、`24a3304` 當初的 image resize 呼叫點現況）；任一處仍使用即停止移除並回報 PARTIAL"
  - "🔴 `sharp` devDependency 與 `allowScripts.sharp` 保留（`scripts/generate-icons.js` 使用）"
  - "🔴 不改 workflows（T0496 會改）、不改 `electron/`（T0491 / T0496 範圍）；若移除需要改這些檔，回報區寫明"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）"
  - "🔴 `npm ci` 不得在主工作樹執行（其他 Worker 共用 node_modules）：比照 T0492 在 scratchpad 乾淨副本驗證"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0503 — sharp / @img runtime 盤點

## 實作

1. 證據：`git grep` sharp / `@img` 於 `electron/`、`src/`、server bundle 入口、e2e；`git show 24a3304` 找當初的 image resize 呼叫點，確認現況（已改用 `nativeImage` 或其他？）；`npx vite build` 後 `dist-electron/*.js` 搜尋 sharp
2. 若未使用：
   - `scripts/build-server-bundle.mjs` `nativePackages` 移除 sharp / @img；`verify-server-bundle.js` 相應檢查
   - `package.json` `optionalDependencies` 移除 `@img/sharp-*`（它們仍會作為 sharp 的 optional 相依在開發機安裝，供 generate-icons 使用）；`build.asarUnpack` 移除 `node_modules/@img/**/*`；確認 electron-builder 不再打包 sharp / @img（devDependency 本來就不打包——核對）
   - `verify-packaged-native.js` 若對 @img 有特定預期，同步調整
   - lock 只保留必要變動
3. 驗證：scratchpad 乾淨副本 `npm ci` + `node scripts/verify-native-modules.js`；`npx vite build`；`npm run test:unit`；WSL 建 linux-x64 server bundle + `verify-server-bundle`（比照 T0492）；可行時 `npm run build:dir` 檢查 `win-unpacked` 不含 `@img` / sharp（產物不安裝，結束清除）

## 驗收條件

- [ ] 未使用證據表（或 PARTIAL 與使用處）
- [ ] lock 變動清單；`npm ci` 乾淨；server bundle 建置 / 驗證；打包產物不含 sharp / @img
- [ ] `npm run test:unit`、`npm run typecheck`、`npx vite build`
- [ ] CLAUDE.md 建議文字（allowScripts / asarUnpack / server bundle 相關段）；`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0492 回報區 + 相關檔案
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
