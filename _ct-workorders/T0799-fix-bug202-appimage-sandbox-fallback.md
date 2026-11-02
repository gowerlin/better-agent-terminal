---
schema_version: 1
schema_kind: workorder
id: T0799
title: "BUG-202：AppImage 在 userns 受限且 `chrome-sandbox` 不是 root 4755 時自動加 `--no-sandbox` 啟動（其餘情況不變），並在 linux-acceptance 加測 whisper 載入（BUG-203 查證）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-03T02:21:33+0800"
updated_at: "2026-11-03T02:21:33+0800"
session_ids: []
depends_on: []
related:
  - "BUG-202（OPEN → FIXING，high）；BUG-203（OPEN，low，本單只查證）；D244；T0797 / T0798（`linux-acceptance.yml`、`e2e/linux/`、`docs/agent-guide/linux-ci-acceptance.md`）；正式 run `41496512040`"
  - "打包：`package.json` `build.linux`（約第 161 行）、`build.executableName` = `BetterAgentTerminal`、`build.afterPack` = `scripts/version-manifest.cjs`；AppImage 內附 `.desktop` 為 `Exec=AppRun --no-sandbox %U`，`AppRun` 本身不加；`scripts/verify-packaged-native.js`（Linux 檢查）；`.github/workflows/desktop-build.yml`（只 build、artifact `desktop-linux`）"
affects_files:
  - package.json
  - scripts/**
  - electron/**
  - .github/workflows/linux-acceptance.yml
  - e2e/linux/**
  - docs/agent-guide/linux-ci-acceptance.md
  - docs/agent-guide/packaging-release-checks.md
  - docs/agent-guide/linux-appimage-sandbox.md
  - docs/agent-guide/README.md
  - CLAUDE.md
  - _ct-workorders/BUG-202-ubuntu-2404-appimage-sandbox-abort.md
  - _ct-workorders/BUG-203-ubuntu-2204-whisper-glibc-238.md
  - _ct-workorders/_bug-tracker.md
  - _ct-workorders/T0799-fix-bug202-appimage-sandbox-fallback.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 使用者決定（D244）：偵測後自動加 `--no-sandbox`。條件（兩者同時成立才加）：① 無法使用 unprivileged user namespace 的 sandbox（例 `/proc/sys/kernel/apparmor_restrict_unprivileged_userns` = 1 且沒有允許本程式的 AppArmor profile；以實際可靠的判斷方式為準，必要時實際試建 userns），② `chrome-sandbox` 不是 root 擁有且 mode 4755（AppImage 掛載下永遠不是）。不成立時（22.04、裝了 profile、chrome-sandbox 已是 root 4755、使用者自己已帶 `--no-sandbox`）行為完全不變、不重複加。只影響 Linux AppImage；Windows / macOS / deb 等其他產物與 `.desktop` 的 `Exec` 不改。"
  - "🔴 先查證實作位置再動手：Chromium 的 setuid sandbox 檢查在 browser 程序啟動很早的階段（zygote），很可能早於 Electron main 的 JS（`app.commandLine.appendSwitch('no-sandbox')` 可能來不及）。先實測確認；做不到就用啟動前的包裝層（例：electron-builder 可設定的 AppImage AppRun / 以 `afterPack` 把 `BetterAgentTerminal` 換成 shell 包裝再 exec 真正的二進位，擇可行且可維護者）。包裝層必須：`exec` 原二進位、原樣轉送所有參數與 stdin/stdout/stderr / exit code / signal、路徑含空白安全、`set -u` 等不因缺 env 失敗；不得用 shell 拼接未加引號的參數。選擇與理由寫進回報與 docs。"
  - "🔴 可觀察：自動加的那次在 stderr 印一行固定字串（例 `[sandbox] userns restricted and chrome-sandbox not setuid root: starting with --no-sandbox (BUG-202)`），且 BAT debug log 也記一行（main 啟動後以 `process.argv` / `app.commandLine.hasSwitch('no-sandbox')` 與偵測結果判斷，經 `logger`）；不得記錄任何 env 值或權杖。文件（新 `docs/agent-guide/linux-appimage-sandbox.md`，README 索引一行；CLAUDE.md 只加一節 3–6 行：用途、必守、唯一實作位置、連結）寫明：何時會關 sandbox、安全取捨、想保留 sandbox 的使用者可安裝 AppArmor profile（附範例 profile 與 `sudo` 指令，標明需自行評估）。"
  - "🔴 驗收 workflow 調整（`e2e/linux/` + `linux-acceptance.yml`）：L1 判讀新增「自動降級」情況——24.04（userns 受限）L1 應能啟動、視窗 / 終端 / echo 都過，報告明確寫 `sandbox auto-disabled (BUG-202 fallback)`，verdict 為 WARN 並附此原因（降低的安全性要持續看得見，但不再是崩潰）；22.04 必須仍 PASS 且 renderer sandbox 開（`NSpid` 判讀不變），命令列不得出現 `--no-sandbox`。L2 同樣要能存活 20 s。另加 BUG-203 查證項（只記錄，不影響 verdict 之外的判讀，可列為 `INFO`）：在 app 內（例 Playwright `electronApp.evaluate` 於 main 程序載入打包內的 `@kutalia/whisper-node-addon`，照 `electron/whisper-addon-loader.ts` 的實際載入方式）載入 whisper，記錄成功或錯誤原文；不修 BUG-203。"
  - "🔴 在 GitHub 上驗證（D244 授權）：可 push 分支 `ct/T0799`（不 push `main`），`gh workflow run desktop-build.yml -R gowerlin/better-agent-terminal --ref ct/T0799 -f ref=ct/T0799`（參數以 workflow 實際 inputs 為準）取得 AppImage，再 `gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal --ref ct/T0799 -f build_run_id=<desktop-build run id>`；desktop-build 最多 3 次、linux-acceptance 最多 5 次。兩者都不發布。完成後刪遠端分支，本機分支交塔台。`gh` 一律帶 `-R`（L122）。"
  - "🔴 回歸與驗證：`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 綠、`npm run test:legacy` 綠、`npx vite build`；新增偵測邏輯若在 TS / JS 內要有單元測試（條件組合：受限 + 非 setuid → 加；不受限 / setuid root / 已帶旗標 → 不加）；包裝層若是 shell，用 `bash -n` 與 shellcheck（取得到時）檢查，並在 WSL 或 runner 上實測參數轉送（含空白與特殊字元）。`verify-packaged-native.js` 的 Linux 檢查若需要辨識包裝層要同步改並說明。Windows 本機 `npm run build:dir` 產物不受影響（說明或實測）。"
  - "🔴 BUG-202：修好後 `status: FIXED`、加 `fixed_at` / `fix_commit`、表格狀態列與處理紀錄、文末〈T0799 結果〉；`_bug-tracker.md` 只把 BUG-202 從「⏳ 修復中 (FIXING)」移到「✅ 已修復」，FIXING 放回 `_（無）_`，更新 frontmatter `breakdown` / `generated_at`、〈統計〉、〈最後同步〉；逐一 Edit、不用全檔 `sed`，改完跑 `src/types/__tests__/bug-tracker.test.ts`（L179）。BUG-203：只在處理紀錄補查證結果（run id、兩個 OS 載入成功或錯誤原文），狀態不動。"
  - "🔴 不發版、不改 CHANGELOG / release-note、不 push `main`。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。暫存檔放系統暫存目錄，收尾刪除。完成狀態寫 `DONE`（BUG 的 FIXED 寫在 BUG 單，L177）。"
---

# T0799 — BUG-202：AppImage sandbox 自動降級

## 元資料

- **工單編號**：T0799
- **類型**：implementation（打包 / 啟動）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P1
- **建立時間**：2026-11-03T02:21:33+0800
- **預估規模**：M

## 背景

T0797 / T0798 的 Linux 驗收（run `41496512040`）：Ubuntu 24.04 預設設定（`apparmor_restrict_unprivileged_userns = 1`）下直接執行 AppImage，Chromium 退回 setuid `chrome-sandbox`，因它不是 root 4755 而 FATAL（BUG-202）；加 `--no-sandbox` 正常。AppImage 內附 `.desktop` 本來就帶 `--no-sandbox`。使用者決定偵測後自動加（D244），並把 BUG-203（22.04 whisper 需 glibc 2.38）的實測併入本單（只查證）。

## 範圍

1. 查證可行的注入點，實作「只在條件成立時」自動加 `--no-sandbox`，含 stderr / debug log 一行。
2. 驗收 workflow 支援自動降級判讀＋ whisper 載入查證。
3. 用 `ct/T0799` 分支跑 desktop-build → linux-acceptance 驗證。
4. docs / CLAUDE.md、BUG-202 → FIXED、BUG-203 補查證紀錄。

## 不做

- 不改 Windows / macOS、不改 `.desktop` 的 `Exec`、不修 BUG-203、不發版、不 push `main`。

## 驗收

- [ ] 注入點查證與選擇理由
- [ ] 條件成立才加、其餘不變（單元測試 / 實測）、stderr 與 debug log 一行
- [ ] desktop-build + linux-acceptance：22.04 PASS 且 sandbox 開、命令列無 `--no-sandbox`；24.04 可啟動、報告標 `sandbox auto-disabled (BUG-202 fallback)`
- [ ] whisper 載入查證結果（兩個 OS）
- [ ] typecheck 0 / 0、unit / legacy 綠、vite build
- [ ] docs、CLAUDE.md 一節、BUG-202 FIXED、tracker、parser 測試

---

## 回報區
