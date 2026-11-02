---
schema_version: 1
schema_kind: workorder
id: T0799
title: "BUG-202：AppImage 在 userns 受限且 `chrome-sandbox` 不是 root 4755 時自動加 `--no-sandbox` 啟動（其餘情況不變），並在 linux-acceptance 加測 whisper 載入（BUG-203 查證）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-03T02:21:33+0800"
started_at: "2026-11-03T02:23:08+0800"
updated_at: "2026-11-03T03:07:10+0800"
completed_at: "2026-11-03T03:07:10+0800"
session_ids:
  - "3db74675-f85d-42f5-95e6-a6e864696f46"
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

### 完成狀態

- **狀態**：DONE（BUG-202 → FIXED 寫在 BUG 單）
- **開始 / 完成**：2026-11-03T02:23:08+0800 → 2026-11-03T03:07:10+0800
- **session_id**：3db74675-f85d-42f5-95e6-a6e864696f46
- **分支**：`ct/T0799`（本機，交塔台合併；遠端分支已刪）。`main..ct/T0799` 共 6 個 commit：`d773cb67` 實作、`52b1a91c` 啟動器文字一律 LF、`bdcd5747` docs、`a682ea7b` / `792db8e9` 驗收 spec 的 L2 判讀、`c7cfabda` docs CI 結果。BUG / tracker / 本工單在 `main` 另一個 commit。

### 落點檢查

- PASS。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1：工單在 REPO_ROOT 下。C-3：PASS（C-0 已通過，僅資訊）。C-2：無 `branch` 欄位。
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_REMOTE_TOKEN`：已設定。非 worktree（無 `CT_HOME`）。

### 注入點查證與選擇理由

- **`app.commandLine.appendSwitch('no-sandbox')` 來不及**：Chromium 在啟動 zygote 時決定 Linux sandbox（browser 啟動流程、`BrowserMain` 之前），Electron main JS 在 `BrowserMain` 的 `PostEarlyInitialization` 才跑。實證：BUG-202 的 run `41495143950` / `41496512040` 崩潰時**沒有任何 BAT debug log**——`app-paths-bootstrap`（main.ts 第一個 import）一執行就寫 `[startup] Debug logging started.`，連這行都沒有＝main JS 沒跑到。
- **electron-builder 26 的 AppRun 不能設定**：`app-builder-lib/out/targets/appimage/appImageUtil.js` `generateAppRunScript` 是內建範本（`BIN="$APPDIR/<executableName>"`）；改 AppImage 本身要解開 squashfs 重包，不好維護。
- **採用**：`afterPack`（`scripts/version-manifest.cjs` 呼叫 `afterPackAppImageLauncher`）在 `electronPlatformName === 'linux'` 且 targets 含 AppImage 時，把 `<appOutDir>/BetterAgentTerminal` 改名 `BetterAgentTerminal.bin`，原位置寫 `/bin/sh` 啟動器（0755）。AppImage 打包時把 appOutDir 整個複製進 squashfs，AppRun 不變、執行的就是啟動器。啟動器最後一律 `exec`（`"$@"` 原樣、stdin/stdout/stderr、exit code、signal 都是二進位自己的）、`set -u`、不用 `eval`、執行檔名先過白名單 regex 才寫進腳本。

### 判斷條件（全部成立才加 `--no-sandbox`）

1. `ELECTRON_RUN_AS_NODE` 空或未設（非空 → 原樣 exec，Node 模式）。
2. 參數沒有 `--no-sandbox`（`.desktop` 的 `Exec=AppRun --no-sandbox %U` 不會被重複加）。
3. 同目錄 `chrome-sandbox` 不是「uid 0＋setuid＋other-x」（照 Chromium `setuid_sandbox_host.cc` 的檢查；`stat -L`）。
4. userns 用不了：`apparmor_restrict_unprivileged_userns = 1` 時用 Node 模式跑二進位本身讀 `/proc/self/attr/apparmor/current`（fallback `/proc/self/attr/current`），`unconfined` 或讀不到 → 沒有 profile → 用不了，其他標籤 → 有 profile → 不加；不是 1 時 `unshare --user --map-root-user true`（Chromium 自己試的同一件事）失敗 → 用不了；沒有 `unshare` 時看 `unprivileged_userns_clone = 0` / `max_user_namespaces = 0`。
- AppArmor 限制下不用 `unshare` 判斷：profile 依執行檔路徑套用，`unshare` 是別的執行檔，套在 BAT 二進位的 profile 對它無效。
- 可觀察：stderr 一行 `[sandbox] userns restricted and chrome-sandbox not setuid root: starting with --no-sandbox (BUG-202)`；啟動器替二進位設 `BAT_APPIMAGE_SANDBOX_FALLBACK=1`（不加時 `unset`），main 啟動時 `takeLinuxSandboxStart`（`electron/linux-sandbox-fallback.ts`）讀完立即從 `process.env` 刪除（PTY 不繼承），Linux 上記一行：降級 `[WARN] [sandbox] Chromium sandbox auto-disabled by the AppImage launcher (BUG-202 fallback): … (appimage=yes)`，其他 `[INFO] [sandbox] …`。不記任何 env 值（`appimage=yes|no` 只看有沒有設）。

### 變更檔案（`ct/T0799`）

- 新增：`scripts/appimage-sandbox-launcher.cjs`、`scripts/__tests__/appimage-sandbox-launcher.test.mjs`、`electron/linux-sandbox-fallback.ts`、`electron/__tests__/linux-sandbox-fallback.test.ts`、`docs/agent-guide/linux-appimage-sandbox.md`
- 修改：`scripts/version-manifest.cjs`（afterPack 呼叫啟動器安裝）、`scripts/verify-packaged-native.js`（Linux 新增 `appimage-launcher`：`BetterAgentTerminal` 是啟動器、`.bin` 是對應 arch 的 ELF）、`scripts/__tests__/verify-packaged-native.test.mjs`（Linux fixture 也裝啟動器＋新案例）、`electron/main.ts`（Skia 決策後記 `[sandbox]` 一行）、`e2e/linux/linux-os.ts`、`e2e/linux/t0797-linux-appimage-launch.spec.ts`、`.github/workflows/linux-acceptance.yml`（Inspect 步驟辨識啟動器、改看 `.bin` 的 GLIBC）、`docs/agent-guide/linux-ci-acceptance.md`、`docs/agent-guide/packaging-release-checks.md`、`docs/agent-guide/README.md`（索引一行）、`CLAUDE.md`（新節「Linux AppImage 的 sandbox 自動降級（T0799 / BUG-202，D244）」4 行；檔案 91,618 bytes）
- `main`：`_ct-workorders/BUG-202-…`、`BUG-203-…`、`_bug-tracker.md`、本工單
- `package.json` 未改（`build.afterPack` 維持 `./scripts/version-manifest.cjs`）。

### 驗收 workflow 調整

- L1：啟動器回報降級（debug log 行或 stderr 行）時 sandbox 兩項不判、其餘都過 → 列結果 `WARN`，證據 `sandbox auto-disabled (BUG-202 fallback)`；沒有降級時另加「主程序命令列 / `app.commandLine` 有 `--no-sandbox` 即非 PASS」。meta 新增 `sandbox`、`whisper`、`verdictReason`。
- L2：改為一律跑；等 debug log 出現（≤ 120 s）後再持有 20 s；`[CRASH]` 只算 SIGTERM 之前的行；輸出另存開頭 2000 字找啟動器那行，並對照 debug log。L2 FAIL → verdict FAIL。
- W1（INFO）：第一個成功啟動的 Playwright 列裡，main 程序照 `whisper-addon-loader.ts` 的方式 `require` 打包內 `whisper.node`，記成功或錯誤原文。
- 調整原因（第一次 run `41504087753` 兩邊 L2 都 FAIL）：24.04 從啟動到 debug log > 20 s（L1 開窗 70 s），原「啟動後 20 s」時 log 還沒建立；22.04 的 `[CRASH] child-process-gone` 時間都在我們對程序群組送 SIGTERM 之後（被它殺掉的 GPU / Utility）。第二次 run 24.04 L2 的「stderr 行」顯示 false 是因為只留輸出尾端 2000 字，第三次改為也看開頭。

### 驗證證據

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | 0（exit 0、無錯誤輸出） |
| `npm run typecheck:electron` | 0 |
| `npm run test:unit`（本機 Windows） | 387 檔 / 6800 passed / 24 skipped，exit 0 |
| `npm run test:legacy`（本機） | 33 / 33 檔、472 tests passed，exit 0 |
| `npx vite build` | exit 0 |
| `src/types/__tests__/bug-tracker.test.ts`（tracker 改完後） | 12 / 12 |
| 啟動器 POSIX 測試（WSL Ubuntu 24.04，vitest 4.1.5 暫存專案） | 23 / 23：受限＋無 profile＋非 setuid → 加；有 profile → 不加；不受限且 `unshare` 成功（22.04 情境）→ 不加；`unshare` 失敗 → 加；無 `unshare` 時 sysctl fallback；已帶 `--no-sandbox` → 不重複；`chrome-sandbox` root setuid（symlink 到 `/usr/bin/passwd`）→ 不加；`ELECTRON_RUN_AS_NODE` → 原樣；外部帶入的標記被清掉；參數逐位元轉送（空白、空字串、`$HOME`、`*`、單 / 雙引號、換行、反斜線、反引號、`%U`）、stdin、exit code 7；含空白的目錄與 symlink；`sh -n` / `bash -n` / `dash -n` |
| shellcheck | 0.10.0（WSL，從 koalaman/shellcheck release 下載）`-s sh`：第一次 SC1007（`NODE_OPTIONS= `）→ 改成 `NODE_OPTIONS=''` 後 0 |
| Windows 本機 | 啟動器 / verify / linux-sandbox-fallback 測試的靜態部分過（POSIX 執行期案例跳過）；`npx playwright test e2e/linux/ --list` 1 個 test；`tsc --strict` 檢查 `e2e/linux/*.ts` 0 |
| desktop-build `41502529486`（`52b1a91c`，`0.0.0-exp.3`，1 / 3 次） | 全綠（prepare / typecheck / tests / 三平台 build）。Linux：`afterPack (T0799): BetterAgentTerminal = AppImage sandbox launcher, Electron binary = BetterAgentTerminal.bin`、`verify-packaged-native` ✅（含 appimage-launcher）。Windows / macOS：只有 T0691 那行、沒有 T0799 那行 ⇒ **Windows 打包產物不受影響**（`npm run build:dir` 走同一個 afterPack，`isLinuxAppImageBuild` 為 false；本機未另跑 build:dir）。tests job（ubuntu-24.04）跑了啟動器 23 個測試 |
| linux-acceptance `41504087753`（`52b1a91c`，1 / 5） | FAIL / FAIL：L1 22.04 PASS、24.04 WARN（自動降級）；L2 兩邊 FAIL＝判讀問題（見上） |
| linux-acceptance `41504962084`（`a682ea7b`，2 / 5） | 22.04 **PASS**；24.04 **WARN** `sandbox auto-disabled (BUG-202 fallback)` |
| linux-acceptance `41505876807`（`792db8e9`，3 / 5，定案） | 22.04 **PASS**：L1 PASS（視窗 59 s）、主程序命令列無 `--no-sandbox`、`app.commandLine` 無、renderer sandbox 開（Tab `NSpid` 三層）、debug log `[INFO] [sandbox] Chromium sandbox requested`；L2 PASS（log 31.5 s 後出現）。24.04 **WARN**：L1 WARN（視窗 85 s、終端、鍵盤 echo、0 個 `[CRASH]`、正常關閉；命令列 `BetterAgentTerminal.bin --no-sandbox …`、renderer 無 sandbox＝預期）；L2 PASS（log 40.6 s 後出現、stderr 有啟動器那一行、debug log 有 auto-disabled 行） |

- 驗證對象：typecheck / unit / legacy / vite build 在 `d773cb67` 的內容上跑（本機）；`52b1a91c` 只改啟動器文字的換行正規化，已重跑啟動器測試，desktop-build 的 tests job 在 `52b1a91c` 跑了完整 `test:unit` + `test:legacy`（綠）。之後的 commit 只動 `e2e/linux/`（不在 vitest / typecheck 範圍，已 `tsc --strict` 與 `--list`）與 docs。

### BUG-203 查證（W1，只記錄）

- 兩個 OS、三次 run 錯誤原文相同：`libwhisper.so.1: cannot open shared object file: No such file or directory`（addon `resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist/linux-x64/whisper.node`）。
- `libwhisper.so.1` 在同一目錄裡（inspect 有列），是相依函式庫不在動態載入器搜尋路徑上，兩個 OS 都在 glibc 版本檢查之前就失敗；22.04 的 `GLIBC_2.38` 目前看不到。已寫進 BUG-203 處理紀錄，狀態不動、未修。

### 相關通過案例判定

- 本工單無〈相關通過案例〉段落。回歸面：Windows / macOS 產物不經啟動器（CI log 佐證）；22.04 行為與 T0799 前相同（sandbox 開、無 `--no-sandbox`）。

### 遭遇問題

- 第一次 linux-acceptance 的 L2 判讀不適用於慢速啟動與自己送的 SIGTERM，已修 spec（另跑 2 次，仍在 5 次上限內）。
- bash heredoc 在部分內容上解析失敗，改用 scratchpad 的 .py 檔或 Edit；非 ASCII 修改一律經 Edit 或明確 UTF-8 讀寫。

### 後續建議（給塔台）

1. **Linux 打包版的語音輸入目前不能用**（22.04 / 24.04 都一樣，`libwhisper.so.1` 找不到）：比 BUG-203 的 glibc 問題範圍大，建議另開 BUG（可能方向：載入 `whisper.node` 前先以絕對路徑依序載入相依 `.so`，或改上游 build 的 RUNPATH `$ORIGIN`）。
2. 「裝了 AppArmor profile → 不降級」只有單元測試（假標籤）；文件的 profile 範例未在真機驗證，可在有 sudo 的實機或專用工單實測（CI 驗收規則不改 AppArmor）。
3. 合併 `ct/T0799` 後，在交付版（pre-release）上再跑一次 `linux-acceptance.yml -f version=<版號>`，作為 BUG-202 CLOSED 的依據。
4. 暫存：WSL `/tmp/ct-T0799` 與 scratchpad 檔案已於收尾刪除。

### 互動紀錄

- 無（yolo，未提問）。
