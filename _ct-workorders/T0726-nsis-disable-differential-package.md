---
schema_version: 1
schema_kind: workorder
id: T0726
title: "Windows 安裝檔瘦身：關閉 NSIS 差分打包（`build.nsis.differentialPackage: false`），exe 預估 333 → ≈ 293 MiB；守門斷言＋docs 記錄 D196 新大小上限"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T10:08:54+0800"
started_at: ""
updated_at: "2026-11-01T10:08:54+0800"
completed_at: ""
depends_on: [T0720, T0724]
related:
  - "D196（使用者選 A + C）；T0720 研究（`ca68ec81`）回報區〈壓縮設定的實測〉與選項 A：electron-builder 26.8.1 `NsisTarget.isBuildDifferentialAware`（`nsis.differentialPackage !== false`）→ `configureDifferentialAwareArchiveOptions` 固定 `-md=1m`、非 solid；BAT 不用 electron-updater、release 不上傳 `.blockmap`"
  - "D146 / T0547 / T0548（壓縮設定；`scripts/__tests__/server-bundle-helpers.test.mjs` 以 `compute7zCompressArgs` 斷言 Windows zip `-mx=7`）"
  - "CLAUDE.md「Packaging / Release 前置檢查」（🔴 不得使用 `build.<platform>.files`；Release 驗收必跑 NSIS 完整重裝）、`docs/agent-guide/packaging-release-checks.md`"
affects_files:
  - package.json
  - scripts/__tests__/server-bundle-helpers.test.mjs
  - docs/agent-guide/packaging-release-checks.md
  - _ct-workorders/T0726-nsis-disable-differential-package.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍：① `package.json` `build.nsis` 加 `differentialPackage: false`（只動這一個鍵；不動 `compression`、`files`、其他 target）；lock 不應有變動。② 守門：在 `scripts/__tests__/server-bundle-helpers.test.mjs`（或同層新檔，仍需在 vitest `test.include` 內）斷言 `build.nsis.differentialPackage === false`，並盡量以 app-builder-lib 自己的邏輯（例如 `NsisTarget.isBuildDifferentialAware` 或其使用的判斷）證明不會走 `configureDifferentialAwareArchiveOptions`（`-md=1m`）；做不到時說明原因、退回只斷言設定值。③ docs `packaging-release-checks.md`：壓縮那段補 NSIS 差分打包已關閉的原因（T0720 / D196）、產物大小那段記錄 D196 上限（每平台安裝檔 ≤ 384 MiB、可攜 zip ≤ 512 MiB，CI `Report artifact sizes` 量測、無 CI 門檻）。CLAUDE.md 不需改（若必要只改一句）。"
  - "🔴 先查證再改：electron-builder 26.8.1（`node_modules/app-builder-lib`）確認 `differentialPackage: false` 時內層 7z 的實際參數（solid、字典大小、`-mx`），並確認不影響 NSIS 解除安裝 / 覆蓋安裝、`verify-packaged-native.js`、`report-artifact-sizes.mjs`、`latest.yml` / blockmap 的產生（release 是否仍上傳原本的檔案）。附檔案:行號。"
  - "🔴 本機打包可做（`npm run build:dir` 不會產生 NSIS；量 exe 需要 electron-builder 的 Windows nsis target，以 `package.json` 現有 script 為準），量測 exe 大小與 pre.5（349,209,594 B）比較；打包前確認 `release\\win-unpacked\\resources\\app.asar` 沒被鎖（L136）。🔴 **不得執行產生的安裝檔**（會覆蓋使用者正在用的已安裝 BAT）：NSIS 安裝 / 解除安裝 / 覆蓋安裝與安裝時間的實機驗收留給發版後的使用者驗收，在回報列出步驟。"
  - "🔴 驗收：`npm run test:unit` 全過；`npm run typecheck:electron` = 0（若有動到 ts）；`npx vite build` 成功；本機 nsis 打包成功且 `node scripts/verify-packaged-native.js`（參數照 docs / workflow）通過；回報附 exe bytes 與內層 7z 的 `7z l -slt` 摘要（`Method` / `Solid` / `Blocks`）。"
  - "🔴 不發版、不改 CHANGELOG / CI workflow、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0726 — Windows 安裝檔瘦身：關閉 NSIS 差分打包

## 元資料

- **工單編號**：T0726
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T10:08:54+0800
- **預估規模**：S

## 背景

T0720 查證：pre.5 安裝檔變大來自上游 claude / codex binary，拿不掉；但 electron-builder 預設為 electron-updater 差分更新把 NSIS 內層 7z 壓成 1 MiB 字典、非 solid。BAT 不用 electron-updater，關掉後實測 exe 可從 333 降到約 293 MiB。使用者決定（D196）：做這項，並把 D146 上限放寬為每平台 ≤ 384 MiB、可攜 zip ≤ 512 MiB。

## 驗收

- [ ] 查證結果（實際 7z 參數、對解除安裝 / release 檔案的影響）附出處
- [ ] `package.json` 只多 `differentialPackage: false`
- [ ] 守門測試
- [ ] docs 兩段更新
- [ ] `test:unit` 全過、`vite build` 成功、本機 nsis 打包＋`verify-packaged-native.js` 通過、exe bytes 與 7z 摘要
- [ ] 回報列出使用者實機驗收步驟（安裝 / 解除安裝 / 覆蓋安裝、安裝時間對照）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 改動摘要

### 驗證結果

### 實機驗收步驟（給使用者）

### 遭遇問題

### 回報時間
