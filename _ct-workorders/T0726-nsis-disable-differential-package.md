---
schema_version: 1
schema_kind: workorder
id: T0726
title: "Windows 安裝檔瘦身：關閉 NSIS 差分打包（`build.nsis.differentialPackage: false`），exe 預估 333 → ≈ 293 MiB；守門斷言＋docs 記錄 D196 新大小上限"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T10:08:54+0800"
started_at: "2026-11-01T10:10:08+0800"
updated_at: "2026-11-01T10:17:55+0800"
completed_at: "2026-11-01T10:17:55+0800"
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

**DONE**。產品 commit `cab618a5`。Windows exe 本機實測 307,147,383 bytes（292.9 MiB），pre.5 CI 為 349,209,594 bytes（333.0 MiB），−12.0%。

### 落點檢查

- C-0 PASS：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS：工單在 REPO_ROOT 的 `_ct-workorders/` 下
- C-3 PASS（參考）：`package.json`、`scripts/__tests__/server-bundle-helpers.test.mjs`、`docs/agent-guide/packaging-release-checks.md` 都存在
- C-2 不適用（工單沒有 `branch`）；`CT_HOME` 未設（非 worktree，`workdir: main repo`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 查證結果（electron-builder / app-builder-lib 26.8.1）

| 項目 | 出處 | 結論 |
|---|---|---|
| 是否走差分 | `node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js:65-67` `isBuildDifferentialAware` = `!this.isPortable && this.options.differentialPackage !== false` | 設 `false` 後為 `false` |
| 內層 7z 參數 | `NsisTarget.js:76-86` `buildAppPackage`：差分時傳 `configureDifferentialAwareArchiveOptions(archiveOptions)`，否則原樣 `{ withoutDir, compression: packager.compression, excluded }`；`out/targets/differentialUpdateInfoBuilder.js:33-60`（`dictSize = 1`、`solid = false`、`compression = "normal"`）；`out/targets/archive.js:53-114` `compute7zCompressArgs` | 以 app-builder-lib 自己的函式算出：之前 `a -bd -mx=9 -md=1m -mtc=off -ms=off -mtm=off -mta=off`，之後 `a -bd -mx=9 -mtc=off -mtm=off -mta=off`（solid、`-mx=9` 預設 64 MiB 字典） |
| 格式 | `NsisTarget.js:77` `format = !isBuildDifferentialAware && options.useZip ? "zip" : "7z"` | 沒設 `useZip` → 仍是 7z |
| 安裝 / 覆蓋安裝 | `templates/nsis/include/extractAppPackage.nsh:73,88,92-127`（`File` 放進 `$PLUGINSDIR\app-64.7z` → `Nsis7z::Extract` 整包解壓、檔案被鎖時重試 / `CopyFiles`） | 兩種 7z 走同一條解壓路徑，只差解壓需讀的字典大小；templates 內沒有任何 differential / blockmap 引用（grep 0 筆） |
| 解除安裝 | `NsisTarget.js:286-301`（uninstaller 由 `computeScriptAndSignUninstaller` 另外編譯、不含 app 7z） | 不受影響 |
| `.blockmap` | `NsisTarget.js:304-309`：`createBlockmap` 只在 `isBuildDifferentialAware` 時呼叫 | 不再產生（本機實測 `release/` 沒有 `0.7.2-pre.5.exe.blockmap`） |
| `latest.yml` | `NsisTarget.js:313-320` `emitArtifactBuildCompleted({ updateInfo, isWriteUpdateInfo: !isPortable })` | 照舊產生（本機實測有 `release/latest.yml`，只有 `url` / `sha512` / `path` / `releaseDate`，沒有 blockmap 資訊） |
| release 上傳的檔案 | `.github/workflows/release.yml:256-257`、`.github/workflows/pre-release.yml:269-270` 上傳 `release/*.zip`、`release/*.exe`；release job `files: artifacts/release-win/*` | `.blockmap` / `latest.yml` 本來就不上傳 → release 檔案清單不變 |
| zip target | `ArchiveTarget`（不讀 `nsis.*`） | 不受影響；zip 實測 481,186,093 bytes（458.9 MiB） |
| `verify-packaged-native.js` | 只查 `win-unpacked` 與 asar（grep 無 blockmap / nsis 7z 依賴） | 本機通過 |
| `report-artifact-sizes.mjs` | `scripts/report-artifact-sizes.mjs:27` 只列 `<out>` 頂層的安裝檔 / 封存檔，沒有 `.blockmap` | 不受影響；內層 `.nsis.7z` 打包後由 `nsisUtil.js:86-97` `finishBuild` 刪除，不會被列出 |

另發現：`archive.js:149-155` 在輸出檔比來源目錄新時會跳過壓縮（`skipped archiving`），但 `.nsis.7z` 每次打包後都被刪，所以不影響；記錄供日後參考。

### 改動摘要

- `package.json`：`build.nsis` 只多 `"differentialPackage": false`（`compression`、`files`、其他 target 未動；`package-lock.json` 無變動）
- `scripts/__tests__/server-bundle-helpers.test.mjs`：新測試〈NSIS differential package is off …（T0726）〉
  - 斷言 `build.nsis.differentialPackage === false`
  - 以 `NsisTarget.prototype.isBuildDifferentialAware` getter（app-builder-lib 自己的判斷）證明設定值 → `false`、拿掉鍵 → `true`
  - 守住上游形狀：`buildAppPackage` 原始碼仍是「差分才走 `configureDifferentialAwareArchiveOptions`」與「`!isBuildDifferentialAware && options.useZip ? "zip" : "7z"`」，且未設 `useZip`；升 electron-builder 改了這段就會紅
  - 以 `compute7zCompressArgs` 斷言之後含 `-mx=9`、沒有 `-ms=off`、沒有 `-md=`；之前（經 `configureDifferentialAwareArchiveOptions`）含 `-md=1m` / `-ms=off`
  - 備註：`NsisTarget.js` 單獨 import 會遇到循環依賴（`LinuxPackager extends` undefined），測試先 `await import('app-builder-lib')` 再取 `NsisTarget`
- `docs/agent-guide/packaging-release-checks.md`：
  - 壓縮那段後新增〈NSIS 差分打包關閉〉：原因（T0726 / D196）、前後參數與出處、安裝 / 解除安裝 / zip / release 檔案的影響、本機實測、守門測試、🔴 日後改用 electron-updater 要先拿掉這個鍵並重新決策上限
  - 產物大小那段新增〈大小上限〉：D196 每平台安裝檔 ≤ 384 MiB、可攜 zip ≤ 512 MiB，CI `Report artifact sizes` 量測，無 CI 門檻
  - Server bundle 節的「Mac installer size cap 280 MB（D094）」標為歷史並指向現行上限
- CLAUDE.md 未改（工單允許不改；現有「Packaging / Release 前置檢查」節沒有寫大小數值）

### 驗證結果

| 關卡 | 結果 | 證據 |
|---|---|---|
| 守門測試（單檔） | PASS | `npx vitest run scripts/__tests__/server-bundle-helpers.test.mjs`：35 passed |
| `npm run test:unit` | PASS | 347 files passed、6217 passed / 3 skipped（打包後跑，`dist-electron` 存在，`asar-runtime-deps` 那幾項有執行） |
| `npx vite build` | PASS | 經 `npm run build` 執行，4 個 vite build 都 `✓ built` |
| `npm run typecheck:electron` | 未跑 | 沒有改任何 ts（工單「若有動到 ts」才需要） |
| 本機 nsis 打包 | PASS | `npm run build`（`electron-builder` 預設 Windows target = nsis + zip，`package.json` `build.win.target`）exit 0，10:12:28 → 10:14:57；打包前確認 `release\win-unpacked\resources\app.asar` 未被鎖（L136） |
| `verify-packaged-native.js` | PASS | `node scripts/verify-packaged-native.js --platform win --out release --arch x64`（與 workflow 同參數）：`✅ every windows package passed (x64)` |
| `report-artifact-sizes.mjs` | 正常 | exe 292.9 MiB、zip 458.9 MiB；`win-unpacked` 1237.0 MiB |
| exe 大小 | 307,147,383 bytes（292.9 MiB） | pre.5 CI 349,209,594 bytes（333.0 MiB）；與 T0720 預估 ≈ 293 一致；D196 上限 384 / 512 MiB 內 |

內層 7z 的 `7z l -slt` 摘要（`node_modules/7zip-bin/win/x64/7za.exe` 21.07，直接開 exe，7z 自動找到內嵌的 7z）：

| | 本次 exe（0.7.2-pre.5，差分關閉） | 對照：本機舊 exe（0.6.0-pre.1，差分打包） |
|---|---|---|
| `Method` | `LZMA2:26 LZMA:20 BCJ2` | `LZMA2:20 LZMA:20 BCJ2` |
| `Solid` | `+` | `-` |
| `Blocks` | `2` | `271` |
| 內容 | 171 files, 32 folders，1,297,113,443 → 306,210,034 bytes | — |

（`LZMA2:26` = 64 MiB 字典、`LZMA2:20` = 1 MiB。手邊沒有 pre.5 CI exe，對照用的是 `release/` 裡留下的舊版本機 exe，內容不同、只看格式。）

commit：產品 `cab618a5`（`git commit --only` 三個產品檔）。驗證時 HEAD 為 `886f36ef` 加上工作樹的這三檔改動；跑完驗證後只再改了 docs 的實測文字（不影響測試與打包）。未 push、未發版、未改 CHANGELOG / CI workflow。

### 實機驗收步驟（給使用者）

🔴 本 Worker 沒有執行產生的安裝檔（會覆蓋使用中的 BAT）。發版後請在可覆蓋的機器上：

1. **覆蓋安裝**：已安裝舊版（pre.5）時直接執行新 exe，選原安裝目錄 → 完成後啟動 BAT，確認版號、終端 / Claude / Codex 分頁正常；`resources\app.asar.unpacked\node_modules\@anthropic-ai\claude-code\bin\claude.exe` 與 `@openai\codex-win32-x64` 存在。
2. **安裝時間對照**：記錄「按下安裝 → 完成」秒數，與 pre.5 覆蓋安裝比較（solid + 64 MiB 字典解壓可能略慢或略快，預期差距不大；明顯變慢請回報）。BAT 執行中覆蓋安裝時，確認仍出現「應用程式無法關閉」重試提示（`extractAppPackage.nsh` 的重試流程不變）。
3. **解除安裝**：控制台 / 設定 → 解除安裝 BetterAgentTerminal → 確認安裝目錄被清除、開始功能表捷徑移除；使用者資料 `%APPDATA%\BetterAgentTerminal` 依原行為保留。
4. **乾淨重裝**（CLAUDE.md「Release 驗收必跑 NSIS 完整重裝」）：解除安裝後重新安裝新 exe → 啟動正常。
5. **大小對照**：CI `Report artifact sizes` 的 exe 應約 293 MiB（≤ 384）、zip ≤ 512 MiB；GitHub Release 的 Windows 資產仍只有 `.exe` 與 `-win.zip`。

### 遭遇問題

- 填 docs 實測數字時，一個 Git Bash 指令把雙引號內的反引號當成命令替換執行（執行了無參數的 `7z l -slt`，只印用法錯誤）；檔案未被改動，改用 Edit 完成。無其他影響。
- `NsisTarget.js` 不能單獨 import（循環依賴），測試以先載入套件 index 的方式解決（見改動摘要）。

### 互動紀錄

- 無（yolo，未向塔台提問）

### 回報時間

2026-11-01T10:17:55+0800
