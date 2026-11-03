---
schema_version: 1
schema_kind: workorder
id: T0800
title: "BUG-204：Linux 打包版 `whisper.node` 找不到同目錄的 `libwhisper.so.1`，修正相依函式庫的搜尋路徑，並讓 linux-acceptance 判定 whisper 載入（BUG-203 只查證）"
type: implementation
status: TODO
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-03T11:45:52+0800"
updated_at: "2026-11-03T11:45:52+0800"
session_ids: []
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

（Worker 填寫）
