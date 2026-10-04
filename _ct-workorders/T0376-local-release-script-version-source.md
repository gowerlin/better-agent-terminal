---
schema_version: 1
schema_kind: workorder
id: T0376
title: "本地打包腳本版號來源修正：預設取 package.json、保留 -pre 後綴、不留 dirty、補齊 build 前置檢查"
type: implementation
status: IN_PROGRESS
priority: P2
sizing: S
created_at: "2026-10-04T20:39:03+08:00"
updated_at: "2026-10-04T20:41:35+08:00"
started_at: "2026-10-04T20:41:35+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "D125（本工單決策依據）"
  - "BUG-056（--dir / 本地打包非 production 等價的盲點）"
  - "_local-rules.md § Release 流程實況（package.json 發版後必同步）"
affects_files:
  - .vscode/scripts/release.ps1
  - scripts/build-version.js
  - choco/tools/chocolateyinstall.ps1
  - .vscode/tasks.json
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不要實際跑完整打包**（`release.ps1` 不帶 `-DryRun`、`npm run build*`、`electron-builder`）：會寫 `dist/` / `release/`，且與並行工單 T0377 的 vite build 互擾。驗證一律用 `-DryRun` 與可單測的純函式。"
  - "🔴 **CI 路徑行為不得改變**：`pre-release.yml` / `release.yml` 以 `VERSION` env 呼叫 `build-version.js`，env 優先序第一名必須維持、輸出值必須與現在相同。"
  - "🔴 不改 `.github/workflows/**`、不改 `package.json` 版號、不 push、不打 tag。"
---

# T0376 — 本地打包腳本版號來源修正

## 背景

使用者以 VS Code task「發行: 打包發行版」本地打包，產出版號 `1.26.1004195815`，而 GitHub pre-release 為 `0.5.9-pre.4`。塔台複核根因（2026-10-04）：

| # | 問題 | 位置 |
|---|------|------|
| P1 | 未帶 `-Version` 時，只認 `git describe --tags --exact-match`；HEAD 不在 tag 上（tag 後有塔台紀錄 commit 很常見）即退回時間戳 `1.yy.MMddHHmmss` | `.vscode/scripts/release.ps1:57-66` |
| P2 | 時間戳版號 `1.x` 大於所有真實版號（`0.5.x`）→ 之後裝官方版會被判為降級 | 同上 |
| P3 | 從 tag 取版時 `-replace '-.*$', ''` 砍掉 `-pre.N` → 預覽版被標成正式版號 | `release.ps1:60` |
| P4 | 版號寫回 `package.json`、nuspec 寫回 `choco/better-agent-terminal.nuspec`，打包後留下 dirty（使用者已手動還原） | `release.ps1:70-76, 129-132` |
| P5 | `build-version.js` 同型問題：tag 取版 `.split('-')[0]` 砍後綴；`git describe --tags`（非 exact）fallback 會取最近的 tag 加距離，再砍成錯的正式版號 | `scripts/build-version.js:26-40` |
| P6 | `release.ps1` 跑 `npm run compile`（只有 vite build）+ `npx electron-builder --win`，**繞過** `verify-native-modules` / `verify-helper-bundle` / `verify-renderer-imports` / `fetch:baseline`（`package.json` `build` / `prebuild` script 都有）——BUG-056 類盲點 | `release.ps1:83-92` |
| P7 | choco checksum 搜尋 `*.Setup.*.exe`，實際檔名 `BetterAgentTerminal Setup <ver>.exe`（空白不是點）→ 永遠找不到，`__CHECKSUM64__` 從未被替換；若替換成功又會把 tracked 的 `chocolateyinstall.ps1` 改髒 | `release.ps1:135-142` |

## 目標（D125）

1. **版號來源優先序**（`release.ps1` 與 `build-version.js` 一致）：
   1. 明確指定（`-Version` / `VERSION` env）
   2. `package.json` 的 `version`（依 `_local-rules` 發版後必同步，是 repo 的版號 SoT）
   3. 時間戳僅作最後手段，且**格式不得大於真實版號**——建議 `<package.json version>-local.<yyMMddHHmmss>` 或直接要求顯式 `-Snapshot` switch 才產生；請在回報說明選擇
   - 若 HEAD 剛好在 `v*` tag 上且與 `package.json` 不一致：印警告（不要靜默挑一個），以 `package.json` 為準或 abort，二選一並說明理由
   - git tag 取版若保留，**必須保留 `-pre.N` 等 prerelease 後綴**；移除非 exact 的 `git describe --tags` fallback（本 repo 有 `v0.x` / `v2.2.x` / `v4.0.x` 三條 tag 線，L123）
2. **不留 dirty**：版號與 `package.json` 相同時不寫檔；需要覆寫（`-Version` 不同於 package.json）時以 try/finally 在打包後還原 `package.json` 與 nuspec。`chocolateyinstall.ps1` 的 checksum 替換改為寫到暫存複本 / 打包後還原，不得留在 tracked 檔
3. **補齊前置檢查**：`release.ps1` 打包前跑與 `npm run build` 等價的檢查（`verify-native-modules` / `verify-helper-bundle` / `verify-renderer-imports`）及 `fetch:baseline`；最簡做法是改呼叫既有 npm script 而非自行拼 `compile` + `electron-builder`，請評估後選定（注意 `build:release` 也會經 `build-version.js`，版號需經 env 傳遞避免重複計算）
4. **choco checksum**：修正 Setup exe 搜尋 pattern，與 electron-builder 實際檔名一致
5. 更新 `release.ps1` 的 `.PARAMETER Version` 說明文字，反映新優先序

## 驗收

- `build-version.js` 的版號解析抽成可測純函式（例如 `resolveVersion({ env, pkgVersion, tag, now })`），新增 vitest 測試覆蓋：env 優先、package.json 次之、`-pre.N` 保留、tag 與 package.json 不一致、時間戳 fallback 格式（若保留）。測試檔位置須被 `vite.config.ts` `test.include` 涵蓋（先確認 glob）
- `pwsh -File .vscode/scripts/release.ps1 -DryRun -SkipGitCheck`：印出版號 = `0.5.9-pre.4`（目前 package.json 值），**執行後 `git status --porcelain` 為空**
- `pwsh -File .vscode/scripts/release.ps1 -DryRun -SkipGitCheck -Version 9.9.9-test.1`：印出 `9.9.9-test.1`，執行後 `git status --porcelain` 為空
- `VERSION=0.5.9-pre.4 node -e "<呼叫解析函式>"` 輸出與修改前相同（CI 不變的證據）
- `npm run test:unit` 全綠（基線 673）
- `.vscode/tasks.json` 若無需改動則不動

## 範圍外

- 實際完整打包與安裝（交使用者 runtime 驗收）
- `release/` 目錄舊產出清理（使用者自行處理）
- macOS / Linux 本地打包腳本

## Sub-session 執行指示

1. 讀取本工單全部內容
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）
5. commit 僅 `affects_files` 內實際改動的檔 + 新增測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要（2026-10-04T20:44:42+08:00）

**狀態：DONE**。P1–P7 全部處理；CI 路徑輸出值不變；DryRun 不寫任何檔。

| # | 處理 |
|---|------|
| P1/P2 | 版號優先序改為 `VERSION` env → `package.json` → 顯式快照；時間戳 `1.yy.*` 移除 |
| P3/P5 | git tag 不再作為版號來源（移除 `--exact-match` 與非 exact 的 `git describe --tags` fallback）；只用 `git tag --points-at HEAD --list v*` 做一致性警告，後綴保留比對 |
| P4 | 版號 = package.json 時不寫檔；`build-version.js` 本地模式（非 `CI`）打包後還原原始 bytes；`release.ps1` finally 再以 bytes 比對還原（防 Ctrl+C / 例外） |
| P6 | `release.ps1` 改呼叫 `npm run build:release`（= `fetch:baseline` + `build-version.js` 內 verify 三件 + `npm run build`），版號經 `VERSION` env 傳入，不重複計算 |
| P7 | Setup exe 搜尋改 `*Setup*.exe` 並限定 `"* Setup $Version.exe"` / `"*.Setup.$Version.exe"`（避開 release/ 舊產出）；nuspec 版號與 checksum 改在 `%TEMP%\bat-choco-<guid>` 暫存複本內替換後 `choco pack <staged nuspec> --output-directory release/`，tracked `choco/**` 不動，finally 刪暫存 |

### 設計選擇（工單要求說明者）

1. **時間戳 fallback → 顯式 `-Snapshot`（`BAT_VERSION_SNAPSHOT=1`）才產生**，格式 `<pkg>-local.<yyMMddHHmmss>`；pkg 已有 prerelease 時以 `.` 延伸（`0.5.9-pre.4.local.261004204416`），因 semver 只允許單一 prerelease 段。排序低於下一個正式版 / 下一個 `-pre.N`，不會造成降級判定。package.json 無 version 且無 env 時 **throw**，不靜默退回時間戳。
2. **HEAD 上 v* tag 與 package.json 不一致 → 警告 + 以 package.json 為準**（不 abort）。理由：D125 定 package.json 為 SoT；本 repo 三條 tag 線，HEAD 被他線 tag 指到時 abort 會擋掉正當打包；不一致的處置（同步 package.json）在警告文字中給出指令。HEAD 有多個 v* tag 時任一相符即不警告。
3. **前置檢查改走既有 npm script**（`build:release`），不自行拼。代價：`fetch:baseline` 與 verify 三件會各跑兩次（`build:release` 一次 + `npm run build` 的 `prebuild`/內建 verify 一次）；`fetch:baseline` 有 SHA cache 會 skip，verify 為靜態掃描，成本可忽略，換得與 `npm run build` 完全一致。
4. **單一解析來源**：`release.ps1` 不再自行算版號，改呼叫 `node scripts/build-version.js --resolve-only`（印 `{version, source, warnings}` JSON、不跑 guard、不寫檔、不 build），確保兩邊一致。解析出的版號再設回 `VERSION` env 給 `build:release`，快照時間戳不會被重算。
5. `build-version.js` 加 `require.main === module` guard，verify 三件的 `require` 移入 `main()`（直接執行時順序與原本相同：verify → 解析 → 寫版號 → build）；匯出 `resolveVersion` / `formatSnapshotVersion` 供測試。

### 變更檔案

- `scripts/build-version.js` — 純函式 `resolveVersion({ env, pkgVersion, tags, now })` / `formatSnapshotVersion()`、`--resolve-only`、`execFileSync` + 5s timeout 讀 HEAD tag、版號相同不寫檔、本地還原
- `.vscode/scripts/release.ps1` — 新增 `-Snapshot`；`.PARAMETER Version` 說明改寫；改走 `build:release`；DryRun 對 `-ChocoPackOnly` 也生效（原本 `-ChocoPackOnly -DryRun` 會真的跑 choco）；choco 暫存複本；`choco` 不存在時 warn skip；finally 還原 package.json 與 env
- `electron/__tests__/build-version.test.ts`（新增，15 tests）
- 未改：`choco/tools/chocolateyinstall.ps1`（URL 的 `BetterAgentTerminal.Setup.<ver>.exe` 對應 GitHub 上傳後空白轉點的資產名，正確；checksum 改在暫存複本替換，無需改 tracked 檔）、`.vscode/tasks.json`（無需改動）

### 驗收證據

| 項目 | 結果 | 證據 |
|------|------|------|
| vitest 解析函式 | ✅ PASS | `npx vitest run electron/__tests__/build-version.test.ts` → 15 passed（env 優先、`v` 前綴、空 env、pkg 次之含 `-pre.N`、tag 相符/不符/多 tag/非版號 tag、無版號 throw、快照格式與零填、env 勝過快照） |
| 測試檔被 include 涵蓋 | ✅ | 放 `electron/__tests__/`（既有 glob `electron/__tests__/**/*.test.ts`），未動 `vite.config.ts` |
| `release.ps1 -DryRun -SkipGitCheck` | ✅ PASS | 印 `版本號: 0.5.9-pre.4（來源: package.json）`，exit 0 |
| `release.ps1 -DryRun -SkipGitCheck -Version 9.9.9-test.1` | ✅ PASS | 印 `版本號: 9.9.9-test.1（來源: env）`，exit 0 |
| 額外：`-Snapshot` / `-ChocoPackOnly -DryRun` | ✅ | `0.5.9-pre.4.local.261004204416`；ChocoPackOnly DryRun 不執行 choco |
| 執行後 `git status --porcelain` | ✅ PASS（以前後比對） | 4 次 DryRun 前後 porcelain 字串完全相同（`True`）。⚠️ 絕對值非空：並行 T0377 的 dirty 檔（`electron/main.ts` 等）與本單尚未 commit 的改動存在，故以「執行前 = 執行後」作為不留 dirty 的證據；`VERSION` env 未外洩 |
| CI 不變 | ✅ PASS | 修改前（`git show HEAD:scripts/build-version.js` 抽 `getVersion`）：`0.5.9-pre.4`→`0.5.9-pre.4`、`v0.5.9-pre.4`→`0.5.9-pre.4`、`v1.2.3`→`1.2.3`；修改後 `resolveVersion` 與 `--resolve-only` 三組輸出完全相同。CI 仍會寫 package.json（不還原，供下一步 `npx electron-builder --win` 讀取）；唯一差異是 log 文字 `Using version from VERSION env:` → `Using version from env:`，以及版號相同時略過寫檔（內容結果相同） |
| `npm run test:unit` | ✅ PASS | 49 files / **698 passed**（基線 673 + 本單 15 + 並行 T0377 新增測試） |
| `npx vite build` | ⏭️ 未跑 | 依 memory_overrides 不跑 build（避免與 T0377 互擾）；本單改動不在 vite bundle 範圍（scripts/、.vscode/、測試） |
| 實際完整打包 / choco pack / 非 DryRun 的還原路徑 | ⏭️ 範圍外 | 交使用者 runtime 驗收 |

### Landing Zone

- 結果：**WARN**（C-0 不可用）
- C-0：frontmatter `repo` = absent；`basename(REPO_ROOT)` = `better-agent-terminal` → WARN "repo identity unavailable"
- C-1：PASS（工單在 REPO_ROOT 下）
- C-3：PASS（4 個 affects_files 皆存在）
- C-2：無 `branch` 欄位，HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 工單原 `status: TODO`（非 PENDING），視為未開工直接轉 IN_PROGRESS

### 給使用者的 runtime 驗收建議

1. VS Code task「發行: 打包發行版」→ 產出應為 `BetterAgentTerminal Setup 0.5.9-pre.4.exe`，結束後 `git status` 不應出現 `package.json` / `choco/**`
2. 「發行: 打包發行版 (指定版本)」輸入不同版號 → 產出該版號，結束後 `package.json` 已還原
3. 若裝了 choco：`release/` 應出現 `better-agent-terminal.<ver>.nupkg`，且其 `chocolateyinstall.ps1` 的 `checksum64` 已非 `__CHECKSUM64__`

### 後續建議（不在本單範圍）

- `.vscode/tasks.json` 可加「發行: 打包快照版 (-Snapshot)」task（本單依「無需改動則不動」未加）
- `[5/5] checksum` 仍對 `release/` 內所有檔案（含舊產出）計算，可考慮限定當前版號

### Commit

見下方 commit 紀錄。
