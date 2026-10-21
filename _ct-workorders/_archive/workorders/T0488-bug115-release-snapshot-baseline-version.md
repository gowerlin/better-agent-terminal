---
schema_version: 1
schema_kind: workorder
id: T0488
title: "BUG-115 修復：release.ps1 -Snapshot 的 fetch:baseline 以 snapshot 版號下載 → 404；baseline 版號改取基底版號"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-13T23:13:05+08:00"
started_at: "2026-10-13T23:24:23+08:00"
updated_at: "2026-10-13T23:35:43+08:00"
completed_at: "2026-10-13T23:35:43+08:00"
target_version: v0.6.0-pre.5
depends_on: []
related:
  - "BUG-115 全文（現象、待查方向、暫行對策）"
  - "CLAUDE.md「Server bundle baseline（PLAN-031）」（`prebuild` hook 串接 `fetch:baseline`）；D125（本地打包版號來源規則）"
affects_files:
  - "scripts/fetch-baseline-tarball.mjs"
  - "scripts/build-version.js"
  - ".vscode/scripts/release.ps1"
  - "scripts/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改 `package.json`（T0486 / T0492 會改）；若修法必須改 package.json scripts，回報區寫明需求並優先採不改 package.json 的方案"
  - "🔴 CI 路徑（`VERSION` env）行為不得改變"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0488 — BUG-115 修復：release.ps1 -Snapshot 的 fetch:baseline 以 snapshot 版號下載 → 404；baseline 版號改取基底版號

## 修正

- `fetch-baseline-tarball.mjs` 版號來源：snapshot 後綴（以 `build-version.js` 實際產生格式為準，如 `.local.<stamp>`）→ 取基底版號；或由 `build-version.js` 以 env 明確傳 baseline 版號（擇一並說明）
- 「`-Version X` 與 package.json 不同、X 尚無 server-bundle release」情境：明確錯誤訊息或 fallback 規則（附理由）
- 重複 fetch：確認第二次命中快取且版號一致；是否移除重複呼叫（需改 package.json）只建議

## 驗收條件

- [ ] 單元測試：snapshot 版號 → 基底版號；一般版號不變；CI `VERSION` 路徑不變
- [ ] `pwsh .vscode/scripts/release.ps1 -Snapshot` 至少通過兩次 fetch:baseline（可在 electron-builder 前中止或完整跑完；完整跑完時產物留 `release/`、不安裝並記錄）；並行 Worker 可能同時 build，失敗須判斷歸屬
- [ ] BUG-115 可結案證據；CLAUDE.md 建議文字

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要（DONE）

- **根因**：`fetch-baseline-tarball.mjs` 只讀 `package.json` 版號；`build-version.js` 把 package.json 改成 snapshot 版號（`0.6.0-pre.4.local.<stamp>`）後，`npm run build` 的 `prebuild` 再跑 fetch，以 snapshot 版號組 URL → 該版號不可能有 server-bundle release → 404。
- **修法（兩者並用，不改 package.json）**：
  1. `fetch-baseline-tarball.mjs` 版號解析 `resolveBaselineVersion()`：`--version` → `BAT_BASELINE_VERSION` env → `package.json`，一律去 `v` 前綴並**去除 snapshot 後綴**（取基底版號）。snapshot 後綴格式 SoT 在 `build-version.js`：新增 `stripSnapshotSuffix()`（`formatSnapshotVersion` 的反函式，regex `/[-.]local\.\d{12}$/`），fetch 以 `createRequire` 取用，不另寫一份。**刻意不讀 `VERSION` env**：`npm run build` / `build:dir` 打包的是 package.json 版號，shell 殘留的 `VERSION` 不該改變它們的 baseline。
  2. `release.ps1` 把解析出的版號放進 `BAT_BASELINE_VERSION`（使用者預先設定者優先，finally 還原），讓 `build:release` 的第一次 fetch 與 `prebuild` 的第二次 fetch **解析出同一版號**（修前 `-Version X` 時兩次分別是 package.json 版號與 X）。
- **`-Version X` 且 X 尚無 server-bundle release**：採**明確錯誤**而非 fallback。tarball 404 時除原錯誤外再印 `baselineNotFoundHint()`：指出 `server-bundle-vX` 不存在，並提供出路（不帶 `-Version` 用 package.json 版號／`-Snapshot` 用基底版號／設 `BAT_BASELINE_VERSION=<已發佈版號>` 刻意內建該版 baseline）。理由：靜默改用別的版號，會讓安裝檔內建的 server 與 app 版號不一致，而這不是使用者選的；需要時設一個 env 即可明確覆寫。release.ps1 下此錯誤發生在第一次 fetch（verify / vite build 之前）。
- **同檔相關修正（範圍內，版號一致性）**：`ensureManifest()` 原本只要 `dist-baseline/manifest.json` 存在就跳過，不管版號。主工作樹實況：manifest 是 `0.5.9-pre.4`，package.json 是 `0.6.0-pre.4`，修前本機打包會帶上 0.5.9-pre.4 的 manifest（distributor 以 manifest 決定 baseline 檔名與 SHA，`electron/remote/server-bundle-distributor.ts:163-198`）。改為版號不符即重新下載（`manifestMatchesVersion()`）。CI 不跑 fetch:baseline（以 artifact 下載到乾淨的 `dist-baseline/`），不受影響。
- **重複 fetch**：第二次（prebuild）命中快取且版號一致，實測見下。是否移除重複呼叫（`build:release` 開頭的 `npm run fetch:baseline` 或 `prebuild`）屬 package.json 變更，**本單不做**。建議維持現狀：`prebuild` 保護直接 `npm run build`；`build:release` 開頭那次讓 fetch 在 verify / build-version 改寫 package.json 之前就 fail fast；第二次只花 SHA 計算（約 1 s）。
- `fetch-baseline-tarball.mjs` 的 `main()` 改為只在直接執行時跑（`invokedDirectly`，同 `dev-deploy-headless.mjs` 寫法），讓測試可以 import。

### 改動檔案

| 檔案 | 內容 |
|---|---|
| `scripts/fetch-baseline-tarball.mjs` | `resolveBaselineVersion` / `baselineNotFoundHint` / `manifestMatchesVersion`（export）；版號解析、404 提示、manifest 版號比對；`--help` 與檔頭說明；`invokedDirectly` guard |
| `scripts/build-version.js` | 新增 `stripSnapshotSuffix()` 並 export；`resolveVersion` / CI 路徑未動 |
| `.vscode/scripts/release.ps1` | 設定 / 還原 `BAT_BASELINE_VERSION`（使用者值優先）；說明與 DryRun 輸出 |
| `scripts/__tests__/fetch-baseline-version.test.mjs` | 新增 20 個測試 |

換行維持各檔現況（皆 LF）。未改 `package.json` / `CLAUDE.md`。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| 單元測試（新） | ✅ PASS | `npx vitest run scripts/__tests__/fetch-baseline-version.test.mjs electron/__tests__/build-version.test.ts` → 2 files / 32 tests passed。涵蓋：snapshot → 基底版號（`-local.` 與 `.local.` 兩種）、一般版號不變、只去結尾 12 位時間戳、`--version` > `BAT_BASELINE_VERSION` > package.json、不讀 `VERSION`、`release.ps1 -Snapshot` 與直接 `BAT_VERSION_SNAPSHOT=1 npm run build:release` 兩條流程的兩次 fetch 版號一致、**CI 路徑**（`resolveVersion` 在 `VERSION=v0.6.0-pre.5` + `BAT_VERSION_SNAPSHOT=1` 下仍回 `{version:'0.6.0-pre.5', source:'env'}`）、manifest 版號比對、CLI `--dry-run` 實跑（snapshot URL 為 `server-bundle-v0.6.0-pre.4/…`、舊 manifest 會重下） |
| scripts 測試全組 | ✅ PASS | `npx vitest run scripts/__tests__ electron/__tests__/build-version.test.ts` → 10 files / 258 tests |
| 全套 unit | ✅ PASS（第二次） | 第一次 93 failed，**全在 `src/components/setup-wizard/__tests__/*`**，屬 T0489 進行中的 `wizard-runner.ts` 等 WIP（當時正在編輯）；隨即重跑 **182 files / 3123 passed / 1 skipped**。與本單無關 |
| tsc | ✅ N/A | 本單只改 `.js` / `.mjs` / `.ps1`；`tsconfig.json` include `src`、`tsconfig.node.json` include `electron/**/*.ts`，皆不含 `scripts/`，不可能新增 tsc 錯誤 |
| 主工作樹 dry-run | ✅ | `node scripts/fetch-baseline-tarball.mjs --dry-run` → `version=0.6.0-pre.4`，並印出 `manifest.json is not for v0.6.0-pre.4, will re-download`（證實既有舊 manifest 問題）。`gh release view server-bundle-v0.6.0-pre.4 -R gowerlin/better-agent-terminal` 存在（3 arch tarball + sha256 + manifest） |
| **`release.ps1 -Snapshot` 實跑** | ✅ PASS（完整跑完） | 見下 |

**`release.ps1 -Snapshot` 執行方式**：同工作樹有並行 Worker，且 `package.json` 當時帶他人 WIP（release.ps1 / build-version.js 會暫改並還原 package.json，期間他人寫入會被覆蓋），因此改在**隔離的 detached worktree**（HEAD `69a796a` + 本單 4 檔，`node_modules` 以 junction 指向主工作樹）執行 `pwsh .vscode/scripts/release.ps1 -Snapshot -SkipGitCheck`（`-SkipGitCheck` 只因 worktree 帶本單未 commit 的檔案；release.ps1 遇 dirty 會 `Read-Host`）。

- **第 1 次**（worktree 在 scratchpad，2026-10-13T23:28:39+08:00 → 23:31:38，exit 1）：
  - fetch #1：`snapshot version 0.6.0-pre.4.local.261013232840 (from BAT_BASELINE_VERSION) → baseline v0.6.0-pre.4` → 下載 `bat-server-linux-x64-v0.6.0-pre.4.tar.gz` + sha256（SHA 驗證通過）+ manifest ✅
  - `Version updated: 0.6.0-pre.4 -> 0.6.0-pre.4.local.261013232840`
  - fetch #2（prebuild）：同樣解析為 `v0.6.0-pre.4` → `cache hit` + `manifest.json already present for v0.6.0-pre.4` ✅
  - vite build ✅、zip ✅、`win-unpacked/resources/bat-server-baseline/` = `bat-server-linux-x64-v0.6.0-pre.4.tar.gz` + sha256 + manifest（`version: 0.6.0-pre.4`）✅
  - NSIS 失敗：`File: "…\t0488-wt\release\BetterAgentTerminal Setup 0.6.0-pre.4.local.261013232840.__uninstaller.exe" -> no files found`。該路徑長 **261 字元**（> MAX_PATH 260，makensis 3.0.4.1），為 scratchpad 路徑過長的環境問題，與本單無關
- **第 2 次**（`git worktree move` 到 `<使用者資料夾>\AppData\Local\Temp\t0488`，2026-10-13T23:32:11+08:00 → 23:33:31，**exit 0**）：
  - fetch #1 / #2 皆 `→ baseline v0.6.0-pre.4`、`cache hit`、manifest 版號相符 ✅
  - 產出：`BetterAgentTerminal Setup 0.6.0-pre.4.local.261013233212.exe`（455.7 MB，sha256 `3d78400fb5bb8090668adc6fca541e09519ec57938caec5d1fcafdda83ddc87c`）、`.blockmap`、`-win.zip`（540.7 MB）、choco `better-agent-terminal.0.6.0-pre.4.local.261013233212.nupkg`、`checksums.sha256`
  - `package.json version restored`；worktree `git status` 只剩本單 4 檔，package.json 版號 `0.6.0-pre.4`
- **產物位置**：未安裝。產物原在 worktree 的 `release/`，已移到 scratchpad `…\a13626c2-da75-4282-8eed-a055d05e2c59\scratchpad\t0488-release\`（含 `builder-debug.yml`）。主工作樹 `release/` 未動
- **清理**：先刪 junction（避免 `worktree remove --force` 經 junction 動到主工作樹 `node_modules`），再 `git worktree remove --force`；`git worktree list` 只剩主工作樹，主工作樹 `node_modules` 完好（569 項，`electron/dist` 在）
- log：scratchpad `t0488-release-snapshot.log`（第 1 次）、`t0488-release-snapshot-2.log`（第 2 次）

### BUG-115 可結案證據

- 現象（`-Snapshot` → prebuild 以 snapshot 版號下載 → 404）已消除：snapshot 打包完整跑完 exit 0，兩次 fetch 皆解析為基底版號 `0.6.0-pre.4`，第二次命中快取
- 待查方向三項皆已處理：① snapshot 後綴 → 基底版號（fetch 去後綴 + release.ps1 以 env 傳同一版號）；② 重複 fetch：保留、命中快取、版號一致（移除與否屬 package.json，只建議，見上）；③ `-Version X` 無 release：明確錯誤 + `BAT_BASELINE_VERSION` 覆寫
- 建議塔台將 BUG-115 標 FIXED / CLOSED（`fix_workorder: T0488`）

### CLAUDE.md 建議文字（交 T0493 套用）

於「Server bundle baseline（PLAN-031）」節，`npm run fetch:baseline` 那一條之後加：

> - **baseline 版號**（`scripts/fetch-baseline-tarball.mjs`，BUG-115 / T0488）：`--version` → `BAT_BASELINE_VERSION` env → `package.json`；本機 snapshot 版號（`<base>-local.<yyMMddHHmmss>` / `<base>.local.<…>`，`build-version.js` `formatSnapshotVersion`）一律去後綴取基底版號（`stripSnapshotSuffix`，同檔 SoT），因 snapshot 沒有自己的 server-bundle release。**不讀 `VERSION` env**（`build` / `build:dir` 打包 package.json 版號）。`release.ps1` 把解析出的版號放進 `BAT_BASELINE_VERSION`（使用者預先設定者優先），`build:release` 開頭與 `prebuild` 的兩次 fetch 因此同一版號，第二次命中快取。`-Version X` 而 `server-bundle-vX` 尚未發佈時 fetch 404 即中止並提示，不自動改用其他版號；要刻意內建已發佈版號的 baseline，先設 `$env:BAT_BASELINE_VERSION`。`dist-baseline/manifest.json` 版號與 baseline 版號不符時重新下載（T0488 前只要存在就沿用）。

### 範圍外發現（交塔台）

1. **`dist-baseline/` 會累積舊版 tarball，且全部被打進本機安裝檔**：Windows `extraResources.filter` 是 `bat-server-linux-x64-v*.tar.gz`，主工作樹目前有 `v0.5.9-pre.4` 與 `v0.6.0-pre.1` 兩份（各約 240 MB），下次本機打包會再加 `v0.6.0-pre.4`，三份都進安裝檔（distributor 只用 manifest 指的那份）。CI 用乾淨目錄，不受影響。建議另案：fetch 前清掉 `dist-baseline/` 內非目前版號的 `bat-server-*` / `.sha256`，或由 `verify-helper-bundle.js` 對多版本發出 warn。本單未做（刪檔屬範圍擴張）
2. **runtime 下載 fallback 也用 snapshot 版號**：`server-bundle-distributor.ts` 的 `version = app.getVersion()`，baseline / cache 都缺時會下載 `server-bundle-v<snapshot>`，必定 404。只影響 snapshot 安裝且 baseline 損毀 / 缺失的情境；baseline 正常時由 manifest 驅動，不受影響。是否處理由塔台決定

### 互動 / 偏差

- 無使用者互動（`CT_INTERACTIVE=0`）
- 偏差：`release.ps1 -Snapshot` 改在隔離 worktree 執行（理由見上），未在主工作樹執行
- 工單 `status` 原為 `TODO`（非 `PENDING`），照常轉 `IN_PROGRESS`

### Landing check

- PASS。C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1：工單在 REPO_ROOT 下；C-3：`scripts/fetch-baseline-tarball.mjs` 等皆存在；C-2：無 `branch` 欄位（目前 `main`）
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### Commit

- `git commit --only` 本單 5 檔（工單 + 4 個改動檔），未 push
