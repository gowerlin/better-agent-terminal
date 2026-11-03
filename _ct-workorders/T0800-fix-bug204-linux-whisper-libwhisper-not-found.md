---
schema_version: 1
schema_kind: workorder
id: T0800
title: "BUG-204：Linux 打包版 `whisper.node` 找不到同目錄的 `libwhisper.so.1`，修正相依函式庫的搜尋路徑，並讓 linux-acceptance 判定 whisper 載入（BUG-203 只查證）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-03T11:45:52+0800"
started_at: "2026-11-03T11:47:40+0800"
updated_at: "2026-11-03T12:08:36+0800"
completed_at: "2026-11-03T12:08:36+0800"
session_ids:
  - "eb810741-88e2-407d-bd15-7f624e29a251"
depends_on: []
related:
  - "BUG-204（OPEN → FIXING，medium）；BUG-203（OPEN，low，本單只查證）；D245；T0799（W1 查證、`afterPack` 啟動器 `scripts/appimage-sandbox-launcher.cjs`）；T0797 / T0798（`linux-acceptance.yml`、`e2e/linux/`、`docs/agent-guide/linux-ci-acceptance.md`）"
  - "載入：`electron/whisper-addon-loader.ts`；套件 `@kutalia/whisper-node-addon` `^1.1.0`（上游 prebuilt，`dist/linux-x64/`：`whisper.node`、`libwhisper.so.1`、`libggml*.so`）；打包：`package.json` `build.files`（約第 175 / 186 行）、`build.afterPack` = `scripts/version-manifest.cjs`；`scripts/verify-packaged-native.js`；`.github/workflows/desktop-build.yml`（只 build，artifact `desktop-linux`）"
affects_files:
  - package.json
  - scripts/**
  - electron/whisper-addon-loader.ts
  - electron/__tests__/**
  - .github/workflows/linux-acceptance.yml
  - .github/workflows/desktop-build.yml
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - e2e/linux/**
  - docs/agent-guide/linux-ci-acceptance.md
  - docs/agent-guide/packaging-release-checks.md
  - docs/agent-guide/README.md
  - CLAUDE.md
  - _ct-workorders/BUG-204-linux-whisper-addon-libwhisper-not-found.md
  - _ct-workorders/BUG-203-ubuntu-2204-whisper-glibc-238.md
  - _ct-workorders/_bug-tracker.md
  - _ct-workorders/T0800-fix-bug204-linux-whisper-libwhisper-not-found.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先查證再動手（D245）：① 以 `readelf -d` 列出 `whisper.node` 與同目錄每個 `.so` 的 `NEEDED` / `RUNPATH` / `RPATH`；② 確認 dev 環境（WSL 或 runner 上的 `node_modules`，照 `electron/whisper-addon-loader.ts` 的方式 `require`）是否同樣失敗，以分辨是上游套件本身就缺 RUNPATH，還是 BAT 打包（asar unpack、檔案過濾、symlink 被展開等）造成；③ 確認 `libwhisper.so.1` 等檔在打包內是實檔還是 symlink、名稱是否與 `NEEDED` 一致。查證結果寫進回報區。"
  - "🔴 修法選擇（D245，依查證結果擇一，理由寫進回報與 docs）：塔台偏好在打包時讓相依函式庫從同目錄解析（例 `afterPack` 以 `patchelf --set-rpath '$ORIGIN'` 改 whisper 相關 ELF，或其他不需要 env 的做法）；若選 patchelf，Linux 打包主機（本機與 CI 三個會打 Linux 的 workflow）缺 patchelf 時必須明確失敗或明確安裝，不得默默略過，並在 `verify-packaged-native.js` 的 Linux 檢查加一項驗 RUNPATH。執行期預載（在 loader 內先載相依 `.so`）只有在確認可靠（Node `process.dlopen` 載非 addon 的 `.so` 失敗時會 dlclose，需實測）時才可用。🔴 不得用 `LD_LIBRARY_PATH`（含 T0799 的 AppImage 啟動器）：會傳給 PTY 內的 shell 與所有子程序。只動 Linux；Windows / macOS 的 whisper 載入與打包行為不變。"
  - "🔴 驗收 workflow（`e2e/linux/` + `linux-acceptance.yml`）：W1（whisper 載入）改為判定項：24.04 必須載入成功，失敗 → verdict 至少 WARN 並寫錯誤原文；22.04 照實記錄（預期會看到 BUG-203 的 `GLIBC_2.38`，只記錄，不影響 22.04 的 L1 判讀）。若 24.04 載入失敗的原因不是本單範圍（例 runner 缺系統的 `libvulkan.so.1`），記錄原文並以 ct-exec § Questions For Tower 問塔台，不自行擴大範圍。另查 BAT 在 whisper 載入失敗時是否優雅降級（UI 提示或靜默、會不會影響其他功能），只記錄。"
  - "🔴 在 GitHub 上驗證（D245 授權，比照 D244）：可 push 分支 `ct/T0800`（不 push `main`），`gh workflow run desktop-build.yml -R gowerlin/better-agent-terminal --ref ct/T0800 -f ref=ct/T0800`（參數以 workflow 實際 inputs 為準）取得 AppImage，再 `gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal --ref ct/T0800 -f build_run_id=<desktop-build run id>`；desktop-build 最多 3 次、linux-acceptance 最多 5 次。兩者都不發布。完成後刪遠端分支，本機分支交塔台。`gh` 一律帶 `-R`（L122）。"
  - "🔴 回歸與驗證：`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 綠、`npm run test:legacy` 綠、`npx vite build`；改到的 TS / JS 邏輯要有單元測試；`afterPack` 的改動須確認不影響 Windows / macOS 產物（desktop-build 三平台都綠）與 T0799 的 sandbox 啟動器（linux-acceptance：22.04 L1 PASS 且 sandbox 開、24.04 `sandbox auto-disabled (BUG-202 fallback)`，與 T0799 結果一致）。若新增執行期依賴或改 `build.files`，依 CLAUDE.md「Packaging / Release 前置檢查」同步白名單與檢查。"
  - "🔴 文件：`docs/agent-guide/linux-ci-acceptance.md`（W1 判讀）與 `docs/agent-guide/packaging-release-checks.md`（Linux whisper 函式庫搜尋路徑的做法、唯一實作位置、新增 Linux 打包主機的前置需求）；CLAUDE.md 只在「Packaging / Release 前置檢查」或「Linux AppImage 的 sandbox 自動降級」附近加 1–3 行（必守規則 + 唯一實作 + docs 連結），依 CLAUDE.md 撰寫規則（T0595）。"
  - "🔴 BUG-204：修好後 `status: FIXED`、加 `fixed_at` / `fix_commit`、表格狀態列與處理紀錄、文末〈T0800 結果〉；`_bug-tracker.md` 只把 BUG-204 從「⏳ 修復中 (FIXING)」移到「✅ 已修復」，FIXING 放回 `_（無）_`，更新 frontmatter `breakdown` / `generated_at`、〈統計〉、〈最後同步〉；逐一 Edit、不用全檔 `sed`，改完跑 `src/types/__tests__/bug-tracker.test.ts`（L179）。BUG-203：只在處理紀錄補 22.04 實測結果（run id、錯誤原文），狀態不動。"
  - "🔴 不發版、不改 CHANGELOG / release-note、不 push `main`。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。暫存檔放系統暫存目錄，收尾刪除。完成狀態寫 `DONE`（BUG 的 FIXED 寫在 BUG 單，L177）。"
---

# T0800 — BUG-204：Linux 打包版 whisper 相依函式庫找不到

## 元資料

- **工單編號**：T0800
- **類型**：implementation（打包 / 原生模組載入）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P1
- **建立時間**：2026-11-03T11:45:52+0800
- **預估規模**：M

## 背景

T0799 在 linux-acceptance 加的 W1（main 程序照 `electron/whisper-addon-loader.ts` 載入打包內的 `dist/linux-x64/whisper.node`）在 22.04 與 24.04 都失敗：`libwhisper.so.1: cannot open shared object file: No such file or directory`。`libwhisper.so.1` 就在同一目錄，但 `whisper.node` / `libggml*.so` 沒有指向同目錄的 RUNPATH（`$ORIGIN`），動態載入器不搜尋該目錄（BUG-204）。這個錯誤也遮住了 22.04 的 `GLIBC_2.38` 問題（BUG-203）。塔台決定先修 BUG-204（D245），修好後 `0.7.4-pre.2` 可一併以 linux-acceptance 結 BUG-202。

## 範圍

1. 查證缺 RUNPATH 的來源（上游套件 vs BAT 打包）與打包內檔案型態。
2. 依查證結果修正 Linux 打包版 whisper 相依函式庫的搜尋路徑（不用 `LD_LIBRARY_PATH`），必要時補打包主機前置與 `verify-packaged-native.js` 檢查。
3. linux-acceptance W1 改為判定項（24.04 必須載入成功；22.04 照實記錄）；記錄載入失敗時 BAT 的降級行為。
4. 用 `ct/T0800` 分支跑 desktop-build → linux-acceptance 驗證。
5. docs / CLAUDE.md、BUG-204 → FIXED、BUG-203 補查證紀錄。

## 不做

- 不修 BUG-203（glibc 2.38）、不改 Windows / macOS 的 whisper、不改語音功能本身、不發版、不 push `main`。

## 驗收

- [ ] 查證：`readelf -d` 結果、dev 環境是否同樣失敗、打包內檔案型態
- [ ] 修法與選擇理由；不使用 `LD_LIBRARY_PATH`；Linux 打包主機缺工具時明確失敗或安裝
- [ ] desktop-build 三平台綠；linux-acceptance：24.04 whisper 載入成功、22.04 結果照實記錄；L1 / L2 與 T0799 結果一致
- [ ] whisper 載入失敗時的降級行為紀錄
- [ ] typecheck 0 / 0、unit / legacy 綠、vite build
- [ ] docs、CLAUDE.md、BUG-204 FIXED、tracker、parser 測試；BUG-203 補紀錄

---

## 回報區

### 完成狀態

- **狀態**：DONE（BUG-204 → FIXED 寫在 BUG 單）
- **開始 / 完成**：2026-11-03T11:47:40+0800 → 2026-11-03T12:08:36+0800
- **session_id**：eb810741-88e2-407d-bd15-7f624e29a251
- **分支**：`ct/T0800`（本機，交塔台合併；遠端分支已刪）。`main..ct/T0800` 共 2 個 commit：`fb4c0f8c` 實作＋測試＋workflow、`3d02147b` docs / CLAUDE.md。BUG / tracker / 本工單在 `main` 另一個 commit。
- **validated_sha**：`fb4c0f8c`（本機 typecheck / unit / legacy / vite build、desktop-build、linux-acceptance 都在此 commit）；`3d02147b` 只改 docs 與 CLAUDE.md（各 1 行以上的 Markdown，不在任何測試或建置範圍），不需重驗。
- 工作方式：為了不切換主 checkout 的分支，在系統暫存目錄 `git worktree add -b ct/T0800`（`node_modules` 以 junction 指向主 checkout）；收尾時先刪 junction、再 `git worktree remove`，主 checkout 的 `node_modules` 未動。

### 落點檢查

- PASS。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1：工單在 REPO_ROOT 下。C-3：PASS（C-0 已通過，僅資訊）。C-2：無 `branch` 欄位。
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_REMOTE_TOKEN`：已設定。非 BAT worktree 派工（無 `CT_HOME`）。

### 查證（D245 ①②③）

1. **`readelf -d`**（`node_modules/@kutalia/whisper-node-addon/dist/linux-x64/`，v1.1.0，WSL Ubuntu 24.04）：

   | 檔案 | NEEDED（bundled） | SONAME | RUNPATH |
   |---|---|---|---|
   | `whisper.node` | `libwhisper.so.1` | `addon.node.node` | `/home/runner/work/whisper-node-addon/whisper-node-addon/deps/whisper.cpp/build/Release` |
   | `libwhisper.so` / `.so.1` / `.so.1.7.6` | `libggml.so`、`libggml-base.so` | `libwhisper.so.1` | 同上路徑 + 結尾 `:`（空項目 = 目前工作目錄） |
   | `libggml.so` | `libggml-cpu.so`、`libggml-vulkan.so`、`libggml-base.so` | `libggml.so` | 同上 + `:` |
   | `libggml-cpu.so` | `libggml-base.so`；系統 `libgomp.so.1` | `libggml-cpu.so` | 同上 + `:` |
   | `libggml-vulkan.so` | `libggml-base.so`；系統 `libvulkan.so.1` | `libggml-vulkan.so` | 同上 `:…/VULKAN_SDK/lib:` |
   | `libggml-base.so` | （只有系統庫） | `libggml-base.so` | 無 |

   沒有任何 DT_RPATH。RUNPATH 指向上游 CI 的建置目錄，沒有 `$ORIGIN`。
2. **dev 環境同樣失敗**：WSL 24.04 的 node v26.13.0 直接 `require` `node_modules` 的 `whisper.node` → `libwhisper.so.1: cannot open shared object file: No such file or directory`；`ldd` 報 `libwhisper.so.1 => not found`。⇒ **上游套件本身的問題**，不是 BAT 打包（asar unpack / 過濾 / symlink）造成。
3. **檔案型態**：`libwhisper.so`、`.so.1`、`.so.1.7.6` 是三個內容相同的實檔（md5 皆 `0a4f8afa…`；npm tarball 不保留 symlink），名稱與 `NEEDED` 一致。打包時 electron-builder 原樣複製（CI 的 patch 讀回檢查也證實 `NEEDED` 的 bundled 檔都在同目錄）。

### 修法與選擇理由

- **採用**：打包時改 RUNPATH。`afterPack`（`scripts/version-manifest.cjs` → `afterPackWhisperRunpath`，唯一實作 `scripts/linux-whisper-runpath.cjs`）在 `electronPlatformName === 'linux'`（任何 target）時，對打包內 `app.asar.unpacked/…/whisper-node-addon/dist/linux-*` 的每個共享物件（`whisper.node`、`lib*.so*`，ELF 實檔；`vulkan-shaders-gen` 不改）執行 `patchelf --set-rpath '$ORIGIN' <file>`（`execFileSync` 陣列參數、不經 shell、60 s timeout），再以同檔純 JS 的 `readElfDynamic`（讀 program header / dynamic section）讀回：RUNPATH 必須正好 `$ORIGIN`、沒有 DT_RPATH、bundled `NEEDED`（`libwhisper*` / `libggml*`）在同目錄，否則 throw。hard link 先複製成獨立檔，`node_modules` 不受影響（WSL 實測原檔 RUNPATH 不變）。
- **打包主機缺 patchelf → 明確失敗**：`ensurePatchelf` 在動任何檔之前跑 `patchelf --version`，失敗即 throw（訊息含 `sudo apt-get install -y patchelf`）。三個會打 Linux 的 workflow（`pre-release.yml` / `release.yml` / `desktop-build.yml`）在 `Package for Linux` 前加 `Install patchelf (Linux, BUG-204)`（apt 安裝 + `patchelf --version`）；GitHub `ubuntu-24.04` runner 其實已預裝 0.18.0（log：`patchelf is already the newest version (0.18.0-1.1build1)`），step 保留以免映像改變。找不到 `dist/linux-*` 也 throw。
- **`verify-packaged-native.js`**：Linux 新增 `whisper-runpath`（`verifyWhisperRunpath`，同一組檢查），報告與 hint 各一行。
- **不採用**：`LD_LIBRARY_PATH`（D245 禁止，會傳給 PTY 與子程序）；loader 執行期預載相依 `.so`（`process.dlopen` 載非 addon 失敗會 `dlclose`，要 `RTLD_NODELETE` 與自排相依順序，較脆弱，未實測故不採用）；改上游套件 / patch-package（`npm ci` 內容不變較單純）。
- Windows / macOS：`afterPackWhisperRunpath` 直接回 `null`、不呼叫 patchelf（單元測試＋CI log：win / mac 只有 T0691 那行）。

### W1 驗收調整（`e2e/linux/` + `linux-acceptance.yml`）

- W1 改判定項，判斷唯一實作 `judgeWhisperLoad`（`e2e/linux/linux-os.ts`）：載入成功 → PASS；失敗且系統 glibc ≥ 2.38 或讀不到 → WARN，verdict 至少 WARN（`verdictReason` 加 `W1: whisper addon failed to load (T0800 / BUG-204)`）；glibc < 2.38 → INFO（只記錄，BUG-203）。以 glibc 版本而不是 OS 名稱判斷：24.04 = 2.39、22.04 = 2.35。
- 證據多兩項：`readelf -d whisper.node` 的 RUNPATH、失敗時 `ldd` 的 `not found` 行。workflow 只改註解（不另裝 `libgomp1` / `libvulkan1`，讓驗收反映實際系統）。

### 降級行為（只記錄，未改）

- whisper 只在第一次語音辨識時載入（`electron/whisper-addon-loader.ts`，BUG-116 fail-soft），啟動與其他功能不受影響。失敗時 debug log 一次 `[voice] whisper addon unavailable, voice input disabled: …`，每次辨識 `[voice] transcribe rejected: whisper addon unavailable`（`electron/voice-handler.ts`）；renderer 在錄音停止後顯示 `辨識失敗: Voice recognition module (whisper) is unavailable: failed to load …`（`src/hooks/useVoiceRecording.ts`）。麥克風按鈕不會事先隱藏 / 停用。

### 變更檔案（`ct/T0800`）

- 新增：`scripts/linux-whisper-runpath.cjs`、`scripts/__tests__/linux-whisper-runpath.test.mjs`、`scripts/__tests__/linux-acceptance-w1.test.mjs`、`scripts/__tests__/_elf-fixture.mjs`（手寫 ELF 的測試 helper，非測試檔）
- 修改：`scripts/version-manifest.cjs`（afterPack 呼叫；第二參數 `deps` 只供測試）、`scripts/verify-packaged-native.js`、`scripts/__tests__/verify-packaged-native.test.mjs`（Linux fixture 加 whisper 檔＋新案例）、`scripts/__tests__/appimage-sandbox-launcher.test.mjs`（完整 afterPack 的 Linux 案例改用假 patchelf）、`.github/workflows/{pre-release,release,desktop-build}.yml`（patchelf step）、`.github/workflows/linux-acceptance.yml`（註解）、`e2e/linux/linux-os.ts`、`e2e/linux/t0797-linux-appimage-launch.spec.ts`、`docs/agent-guide/packaging-release-checks.md`（新節「Linux whisper addon：函式庫搜尋路徑」＋ Linux 產物檢查＋ CI 順序）、`docs/agent-guide/linux-ci-acceptance.md`（W1 判讀、WARN 條件、T0800 實測節）、`docs/agent-guide/README.md`（兩列索引）、`CLAUDE.md`（「Packaging / Release 前置檢查」加 1 行；檔案 92,314 bytes）
- `package.json` 未改（`build.afterPack` 維持 `./scripts/version-manifest.cjs`、`build.files` 不變，沒有新增執行期依賴）。`electron/whisper-addon-loader.ts` 未改。
- `main`：`_ct-workorders/BUG-204-…`、`BUG-203-…`、`_bug-tracker.md`、本工單

### 驗證證據

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npm run test:unit`（本機 Windows，`fb4c0f8c`） | 389 檔 / 6826 passed / 24 skipped，exit 0 |
| `npm run test:legacy`（本機） | 33 / 33 檔、472 passed，exit 0 |
| `npx vite build` | 成功 |
| 新增測試 | `linux-whisper-runpath.test.mjs`（ELF 讀取 64/32 位元、LE/BE、截斷、上游實檔；檔案過濾；問題判定；假 patchelf：參數 / 不經 shell / 缺 patchelf / 讀回失敗 / 無目錄 / hard link；win / mac no-op；hook 接線；三個 workflow 的 step 順序）、`linux-acceptance-w1.test.mjs`（5）、verify 測試 Linux 新案例；scripts 全部 19 檔 488 passed |
| e2e linux | `tsc --strict` 檢查 `e2e/linux/*.ts` = 0；`npx playwright test e2e/linux/ --list` 1 個 test |
| WSL 實測（Ubuntu 24.04，patchelf 0.18.0 release 檔放 `/tmp`，未改系統） | 未 patch：`libwhisper.so.1` not found；`patchWhisperRunpath` 後 8 檔 RUNPATH `$ORIGIN`、`whisperRunpathProblems` = []、`ldd` 的 bundled 庫都解析到同目錄；載入時改報 `libgomp.so.1` 找不到（該 WSL 沒裝 `libgomp1`），只為測試以 `apt-get download` 解出的 `libgomp1` 補上後 `require` 成功（`OK function`）；未 patch＋補 libgomp 仍失敗。PATH 沒有 patchelf 時 throw `patchelf not found on PATH…` |
| bug-tracker parser（`src/types/__tests__/bug-tracker.test.ts`） | 12 / 12 |
| desktop-build `41575226873`（`fb4c0f8c`，`0.0.0-exp.4`，1 / 3 次） | 全綠（prepare / typecheck / tests / 三平台 build）。Linux：`afterPack (T0800): whisper RUNPATH = $ORIGIN for 8 file(s) in resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist/linux-x64 (patchelf 0.18.0)`、T0799 啟動器那行照舊、`verify-packaged-native` ✅ every linux package passed。Windows / macOS：只有 T0691 那行、verify ✅ ⇒ 產物不受影響 |
| linux-acceptance `41575592616`（1 / 5） | 兩個 job success。**24.04**（glibc 2.39）：verdict **WARN**，`verdictReason` = `L1: sandbox auto-disabled (BUG-202 fallback)`（只有這一項）；L1 WARN、L2 PASS；**W1 PASS**：`whisper addon loaded (whisper() exported)`、RUNPATH `[$ORIGIN]`。**22.04**（glibc 2.35）：verdict **PASS**；L1 PASS（命令列 / `app.commandLine` 無 `--no-sandbox`、sandbox not auto-disabled）、L2 PASS；W1 INFO（見 BUG-203 查證）。L1 / L2 與 T0799 結果一致 |

### BUG-203 查證（只記錄，狀態不動）

- 22.04 W1 錯誤原文：`` /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.38' not found (required by <appdir>/resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist/linux-x64/libggml-base.so) ``；`ldd` 另有 `libggml-vulkan.so` 的 `GLIBC_2.38` 與 `` libstdc++.so.6: version `GLIBCXX_3.4.32' not found ``。已寫進 BUG-203 處理紀錄。

### 相關通過案例判定

- 本工單無〈相關通過案例〉段落。回歸面：Windows / macOS 產物不經新程式（CI log 佐證）；T0799 啟動器與 L1 / L2 判讀不變。

### 遭遇問題

- python heredoc 寫 `'\\n'` 時被轉成真的換行（spec 兩處），以 Edit 修正並經 `tsc --strict` 確認。
- `tsc` 把在 closure 內賦值的 `let whisper` 收窄成 `null`，以型別斷言的區域變數 `w1` 處理。
- `scripts/__tests__/appimage-sandbox-launcher.test.mjs` 的完整 afterPack Linux 案例因新的 patchelf 步驟失敗（fixture 沒有 whisper 目錄）；改為建 fixture 並透過 afterPack 的 `deps` 傳假 patchelf。

### 後續建議（給塔台）

1. 合併 `ct/T0800` 後，交付版（pre-release）上跑 `linux-acceptance.yml -f version=<版號>`：24.04 W1 PASS 可作 BUG-204 CLOSED 依據，同一次 run 也可結 BUG-202（工單背景所述）。
2. BUG-203（22.04 glibc 2.38 / GLIBCXX_3.4.32）已實測成立，嚴重度可依 22.04 支援政策重評（修法需上游以較舊的 glibc 重建，或 BAT 自建 whisper）。
3. 執行期系統相依 `libgomp1` / `libvulkan1` 不在 AppImage 內：最小安裝的系統語音輸入會失敗（錯誤仍經 fail-soft 顯示）。是否在文件 / 安裝說明列出或打包進 AppImage，可另議。
4. 降級時麥克風按鈕不會事先停用，使用者錄完音才看到錯誤；可考慮啟動後背景試載或在設定頁顯示可用性（不在本單範圍）。
5. 暫存：WSL `/tmp/ct-T0800`、系統暫存的 worktree / 報告 / log 已刪；scratchpad 的小腳本隨 session 清除。

### 互動紀錄

- 無（yolo，未提問）。
