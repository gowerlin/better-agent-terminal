---
schema_version: 1
schema_kind: workorder
id: T0554
title: "BUG-141：WSL / SSH 精靈升級既有 server 後若後段失敗並取消，rollback 恢復升級前的安裝（舊 bundle、原 unit、原 service 狀態），而不是刪光；首次安裝取消行為不變"
type: bugfix
status: FIXED
repo: better-agent-terminal
project: BUG-141
priority: P1
sizing: S
created_at: "2026-10-16T03:32:02+0800"
updated_at: "2026-10-16T04:17:18+0800"
started_at: "2026-10-16T03:50:21+08:00"
completed_at: "2026-10-16T04:17:18+0800"
commit: "38fe7421"
target_version: "0.6.1-pre.5（與 T0551–T0553 同批）"
depends_on: [T0552]
related:
  - "BUG-141；T0552（`electron/server-bundle-install-script.ts` 暫存目錄 + 換名、port 沿用時先停舊 service）；T0489（install rollback gate）"
affects_files:
  - electron/server-bundle-install-script.ts
  - electron/wsl-detect.ts
  - electron/wsl-systemd.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/ssh-bundle-uploader.ts
  - "src/components/setup-wizard/steps/wsl/**、src/components/setup-wizard/steps/ssh/**（install / systemd / enable 步驟的 rollback；列出實際檔案）"
  - "electron/__tests__/**、src/components/setup-wizard/__tests__/**、electron/remote/__tests__/**（新增 / 更新測試）"
  - "e2e/t0550-wsl-acceptance.spec.ts（僅加 env 開關情境，預設行為不變）"
  - "CLAUDE.md / docs/wsl-deployment.md（升級與取消行為描述）"
  - _ct-workorders/T0554-wizard-upgrade-rollback-restores-previous.md
  - _ct-workorders/BUG-141-wizard-rollback-removes-upgraded-install.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 T0553（Worker 分頁標題，`src/stores/workspace-store.ts`、`TerminalThumbnail.tsx` 等）在你之前或同時進行；不要動它的檔案；若 HEAD 上有它的變更，以 HEAD 為準。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 WSL 實機條件同 T0552：`Ubuntu-24.04` server 結束時必須仍在 **9877**、憑證指紋不變、service active、版本為驗證前的版本；動之前先備份（路徑寫進回報區），不要刪 T0550 / T0552 的既有備份。模擬「後段失敗」時用測試注入或隔離實例，不要改壞使用者的 profile。"
  - "🔴 刪除仍只限 T0552 的白名單（`<root>.bat-new`、`<root>.bat-old`、bundle 安裝的 root），路徑防呆不得放寬。"
---

# T0554 — BUG-141：升級後段失敗取消時恢復舊安裝

## 背景

T0552 讓「重跑精靈」成為正式的升級路徑：沿用 port / profile（必要時先停舊 service），安裝改成「解到 `<root>.bat-new` → 舊樹換名 `<root>.bat-old` → 新樹換入 → 刪 `.bat-old`」。T0552 回報的殘餘風險 1：install 成功之後，若後段步驟失敗、使用者取消，`install-server-bundle` 的 rollback（T0489）會 `uninstallBundle` 刪掉整個安裝目錄，這時舊版已經被刪，使用者原本能用的 server 就不見了（BUG-141）。

## 任務

1. 先確認實際行為（測試重現：升級 → install 成功 → 後段步驟失敗 → rollback 執行的動作）。WSL 與 SSH 兩條都確認。
2. 修正（做法由你決定並說明取捨），目標：
   - **升級情境**取消：恢復升級前的 bundle（例如保留 `.bat-old` 直到精靈完成，rollback 換回）、原 unit 內容，並把 T0552 停掉的舊 service 重新啟動，狀態與升級前一致。
   - 精靈**成功完成**時清掉保留的舊樹（不留 `.bat-old`）；中途 BAT 關閉等異常結束時，下次安裝要能安全處理殘留的 `.bat-old`（不得誤刪使用者資料）。
   - **首次安裝**取消：行為不變（照舊移除）。
   - SSH 精靈若同病，同樣處理。
3. 測試：單元（升級取消恢復、首次安裝取消移除、成功清除、殘留 `.bat-old` 處理、白名單與路徑防呆不放寬、SSH 對應）；真 `sh` + `tar` 實跑（沿用 T0552 `server-bundle-install-script.test.ts` 做法）。
4. WSL 實機（條件見 memory_overrides）：以測試注入或擴充 `e2e/t0550-wsl-acceptance.spec.ts` 開關，讓精靈在 install 之後的步驟失敗並取消 → 驗證 server 仍為升級前版本、9877、active、指紋不變；再跑一次正常升級確認無 `.bat-old` 殘留、smoke 13/13。
5. 更新 `docs/wsl-deployment.md` / `CLAUDE.md` 的升級與取消描述；BUG-141 → FIXED。

## 驗收條件

- [x] 升級後段失敗取消：恢復舊 bundle、原 unit、舊 service active（WSL 實機 + 單元；SSH 至少單元）
- [x] 首次安裝取消行為不變；成功完成不留 `.bat-old`
- [x] `npm run test:unit` 全綠（基線 4211 passed / 247 files，加上新測試；若 T0553 先合入以 HEAD 為準）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [x] WSL 結束狀態：9877、指紋不變、active、smoke 13/13
- [x] BUG-141 → FIXED

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

**FIXED** — commit `38fe7421`（`fix(wizard): T0554 cancelling an upgrade puts the previous server back`，未 push）。WSL 實機取消驗證與正常升級驗證皆 PASS；SSH 只有單元測試（工單允許）。

落點檢查：**PASS**。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 內；C-3 affects_files 前 5 項皆存在（資訊性）；C-2 無 `branch` 欄位（HEAD `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 產出摘要

**1. 實際行為確認（任務 1）**

- WSL：`install-server-bundle` rollback（T0489）在 install 成功後呼叫 `wsl.uninstallBundle(root)`；T0552 的腳本在換入新樹後就 `rm -rf .bat-old`，所以取消 = 新舊都沒了。`write-systemd-unit` rollback 呼叫 `removeUnit`（`disable --now` + 刪 unit），舊 unit 也沒了。
- SSH：同病。`install-server-bundle` rollback `ssh:uninstall-bundle`（`rm -rf root`），`start-server` rollback `ssh:stop-server`（disable + 刪 unit / plist）；`start-server` 的 enable 階段 `restart` 已把舊 server 換掉。
- 另一個同源問題：install **失敗**時 rollback 也會 `rm -rf root`（T0426 / T0489 的測試「install fails during the install → its rollback still removes the partial bundle」）。T0552 起失敗的安裝不會碰 root（解到 `.bat-new`、失敗即刪 stage），所以這個 rollback 刪的是**未被動過的舊安裝**。一併修正（見取捨 3）。

**2. 做法與取捨**

1. **保留舊樹到精靈結束**（`electron/server-bundle-install-script.ts`）：安裝腳本加 keep-previous（WSL 第三參數 `keep`、SSH `keep=1`），換入後舊樹留在 `<root>.bat-old`；stdout 印 `BAT_BUNDLE_PREVIOUS=kept|none|unmanaged`。新增 restore 腳本（現 root 先換名到 `.bat-new` 再刪、`.bat-old` 換回；`.bat-old` 不是 bundle 安裝 → `BAT_BUNDLE_RESTORE=missing`、不動；現 root 不是 bundle 安裝 → exit 1、不動）與 discard 腳本。不帶 keep 的呼叫行為與 T0552 相同（預設 off，向後相容）。
2. **完成時清除用新的 runner hook**：`WizardStep.finalize?(ctx)`（`wizard-runner.ts`），全部步驟成功後依步驟順序呼叫，丟錯只記 warning、不影響完成；取消 / 失敗不呼叫。選它而不是塞進 `done` 步驟：保留 / 清除由同一個 step 負責，SSH 的 unit 備份也用同一機制。Shell 在 `run()` resolve 後才顯示「完成」，即 finalize 之後。
3. **rollback 只依「成功的安裝紀錄」行動**：WSL `ctx.state.wslBundleInstall` / SSH `state.sshBundleInstall`（`{ root, previous }`），只在安裝成功時寫入。`kept` → restore；`none` → 照舊刪 root（首次安裝行為不變）；`unmanaged`（疊在非 BAT 目錄）→ 不刪（之前會 `rm -rf` 使用者目錄）；**安裝失敗 → 不刪**（舊行為會刪掉未動過的舊安裝）。兩個斷言舊行為的測試已改（`wizard-cancel-rollback.test.ts`、`wizard-jump-rollback.test.ts`，附 T0554 註解）。
4. **unit / service 狀態**：
   - WSL：`write-systemd-unit` 在 `pickServerPort`（T0552 可能停掉舊 server）**之前**取快照（`wsl-systemd:snapshot-unit`：unit 內容、active、enabled；重試沿用第一次快照）。rollback：有舊 unit → `wsl-systemd:restore-unit` 寫回內容（stdin `tee`，不經 shell）、daemon-reload、還原 enabled；無舊 unit → 照舊 `removeUnit`。
   - SSH：`start-server` 第一次執行時遠端 `cp -p` unit / plist 為 `<file>.bat-prev` 並回報 `previous`（`backupPrevious`，重試不再備份）；rollback `ssh:stop-server` `action: 'restore-previous'`；完成時 `action: 'discard-backup'`。unit 內容不經 renderer 往返（避免 heredoc 注入）。
   - **啟動順序**：舊 server 原本在跑、且舊 bundle 還要換回時，unit rollback 先讓服務停著並設旗標（`wslServiceStartAfterBundleRestore` / `sshServiceStartAfterBundleRestore`），install rollback 換回 bundle 後才啟動（WSL `wsl-systemd:restart-service`；SSH restore 指令尾端只在真的換回時執行的 `systemctl --user restart` / `launchctl load -w`）。不會出現「舊 unit 跑新 bundle」或「在執行中的 server 底下換目錄」。
   - `write-systemd-unit` / `start-server` 的「已碰過遠端」旗標改成跨重試保留（之前每次重試重設為 false，第一次寫了 unit、重試在寫之前失敗時 rollback 會略過）。
5. **異常結束後的殘留**：下次安裝時 root 不存在但 `.bat-old` 是 bundle 安裝（BAT 在兩次 rename 之間被關）→ 先換回再繼續；root 存在 + `.bat-old` 殘留 → `.bat-old` 被當前 root 取代（當前 root 才是「升級前」）；`.bat-old` 存在但不是 bundle 安裝 / 空目錄（symlink 只 unlink）→ 安裝 / 清理中止並提示移走，**不刪**。刪除白名單仍只有 `"$stage"` / `"$old"`（文字測試對 install / restore / discard、WSL / SSH 六種腳本逐一斷言），root 防呆（絕對路徑、至少兩段、非 `$HOME`，TS + shell 雙檢）未放寬；SSH restore / discard 另需通過 T0426 的 `/bat-server` 結尾規則。
6. 不還原 linger（精靈開了就留著）；記在文件。

**3. 修改檔案**

- 主程式：`electron/server-bundle-install-script.ts`、`electron/wsl-detect.ts`（`installBundle` keep / `restoreBundle` / `discardPreviousBundle`）、`electron/wsl-systemd.ts`（`snapshotServiceUnit` / `restoreServiceUnit` / `restartService`）、`electron/main.ts`（`wsl:restore-bundle`、`wsl:discard-previous-bundle`、`wsl-systemd:snapshot-unit` / `restore-unit` / `restart-service`；`wsl:install-bundle` 多 options）、`electron/preload.ts`、`src/types/electron.d.ts`、`electron/remote/ssh-bundle-uploader.ts`（keepPrevious、回傳 previous）、`electron/remote/ssh-setup-handlers.ts`、`electron/remote/ssh-start-server.ts`（備份、`action` / `mode`）
- 精靈：`src/components/setup-wizard/wizard-runner.ts`（`finalize`）、`steps/wsl/install-server-bundle.ts`、`steps/wsl/write-systemd-unit.ts`、`steps/ssh/install-server-bundle.ts`、`steps/ssh/start-server.ts`
- 測試：新增 `electron/__tests__/upgrade-rollback-main.test.ts`（44）、`src/components/setup-wizard/__tests__/wizard-upgrade-rollback.test.ts`（20）；擴充 `electron/__tests__/server-bundle-install-script.test.ts`（真 `sh` + `tar`，現為 53 tests）；更新 mock / 斷言：`server-bundle-import.test.tsx`、`wizard-cancel-rollback.test.ts`、`wizard-jump-rollback.test.ts`、`write-systemd-unit*.test.ts`、`wsl-service-paths.test.ts`
- e2e：`e2e/t0550-wsl-acceptance.spec.ts` 新增 opt-in `T0554 cancel`（`BAT_E2E_T0554_CANCEL_AFTER_INSTALL=1`）；未設此變數時其他測試行為不變
- 文件：`CLAUDE.md`（SSH wizard 安裝段加「精靈升級的取消（T0554）」）、`docs/wsl-deployment.md`（安裝段 + Rollback chain）
- 單據：`BUG-141` → FIXED（未 commit，依 T0553 慣例留給塔台 `(ct)` commit）

**4. 驗證證據**

| 通道 | 結果 |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run typecheck:electron` | 0 errors |
| `npm run test:unit` | **252 files / 4318 passed / 1 skipped**（HEAD 含 T0553） |
| `npx vite build` | 成功 |
| 真 `sh` + `tar`（Git Bash） | `server-bundle-install-script.test.ts` 53 passed：keep / 首次安裝 / unmanaged / restore / restore missing / restore 拒絕非 BAT root / discard / 非 BAT `.bat-old` 不刪（install 與 discard）/ 殘留 `.bat-old` / rename 中斷復原 / `$HOME` 拒絕 / SSH keep + restore 的 after-restore 只在換回時執行 |
| WSL 實機：取消 | `T0554 cancel`（隔離實例，source build，主行程注入 `wsl:fetch-fingerprint` 失敗）全部 PASS：失敗時新 bundle 在跑（MainPID 6070 → 8136）、`.bat-old` 保留、marker 消失；按「取消」後 install tree marker 回來、**inode 72674 → 72674**、unit sha256 `937940b4…` 不變、無 `.bat-new` / `.bat-old`、版本 0.6.1-pre.4、port 9877、指紋 `22:3A:E4:C7…` 不變、service active（MainPID 8249，9877 LISTEN 為該 PID）、隔離實例 profile 未變。精靈 log：`Restored the previous bat-server.service unit` → `Restored the previous BAT server bundle` → `Started the previous bat-server.service again` |
| WSL 實機：正常升級 | `A1-A3`（`BAT_E2E_T0550_UPGRADE_RUNNING=1`）：A2.server / A2.identity-kept / A2.upgrade-running / A2.profile-opens / A3 PASS；`.bat-new` / `.bat-old` 殘留：**none**（finalize 已清）。**A3.clean-install 記為 FAIL**，唯一不成立的是 T0552 的「安裝目錄要變小」（390 → 390 MiB）：本次是 0.6.1-pre.4 → 0.6.1-pre.4 重裝，本來就沒有舊套件可刪；stale 套件 none、data dir 完整。**B4 smoke 13/13 PASS** |
| WSL 結束狀態 | 0.6.1-pre.4、active / enabled、MainPID 8441 在 127.0.0.1:9877 LISTEN、指紋 `22:3A:E4:C7:4F:4F:7C:D1:23:09:11:A1:DB:62:CD:82:A9:31:66:95:48:D0:34:CD:6C:42:9C:B7:0A:D1:79:97`（與開始時相同）、unit 與備份 `diff` 相同、無 `.bat-old` / marker |

- 備份（保留未刪）：`/home/gower/.local/bat-server.bak-0.6.1-pre.4-t0554`、`/home/gower/.config/systemd/user/bat-server.service.bak-0.6.1-pre.4-t0554`（建立時與現役 `diff -r` 相同）。開始時 distro 裡沒有 T0550 / T0552 備份（`f6187ed5` 記錄已移除），沒有刪任何既有備份。
- e2e 證據：`%TEMP%\bat-t0554\evidence-cancel\`（results.json、t0554-server-state-before/mid/after.txt、t0554-debug-log.txt、截圖）、`%TEMP%\bat-t0554\evidence-upgrade\`；log `%TEMP%\bat-t0554-cancel.log`、`%TEMP%\bat-t0554-upgrade.log`。
- 使用者 BAT（9876）未操作；e2e 皆隔離實例。

### 互動紀錄

無（`CT_INTERACTIVE=0`，yolo）。

### Renew 歷程

無。

### 遭遇問題

- 本 shell 的 `bash -c` heredoc 遇到含大量單引號的 Python patch 時解析失敗（`unexpected EOF while looking for matching '`），改用 Write 寫 scratchpad 腳本或 Edit 工具；失敗的那兩次檔案均未被修改（`git diff --stat` 確認）。
- `sed` 一次替換多套了一行（`wsl-service-paths.test.ts` 的 `toBe(...)` 多了一個參數），`npm run typecheck` 抓到後修正。

**殘餘風險 / 後續建議**

1. **SSH 未實機驗證**（工單允許「SSH 至少單元」）：restore / backup 指令以單元測試與真 `sh`（install / restore / discard 腳本）驗證；`systemctl --user` / `launchctl` 的實際行為（尤其 macOS `launchctl unload` / `load -w` 與 enabled 狀態）未在真機跑過。可用 `e2e/pre5-ssh-alias.spec.ts` 的環境另開工單補。
2. 同一次精靈中，install IPC 回報失敗但遠端腳本其實已換入（例如 300 s 逾時剛好在換名之後）再重試：第二次安裝會把「上一嘗試的新樹」當成要保留的舊版，真正的舊版被清掉。窗口極小，未處理。
3. 舊 server 的狀態只分 active / 非 active；原本 crash-loop（`activating`）的 server 會被當成 active 而重新啟動。
4. linger 不還原；精靈中途若 `enableLinger` 開了 linger，取消後仍開著（已寫進文件）。
5. A3.clean-install 的「目錄變小」條件只適用於從含舊套件的版本升級；同版本重裝必然 FAIL。若塔台要把 T0550 spec 當常規回歸，建議把該條件改成 `<=` 或只在版本不同時檢查（本工單未改 T0552 的斷言）。
6. 工作樹的 `src/styles/settings.css`（M）不是本工單的變更，未動、未 commit。

### 回報時間

2026-10-16T04:16:13+0800

---

## 塔台收單（第六十六 session，2026-10-16T04:19:02+0800）

- ✅ **T0554 已確認 FIXED**：`38fe7421`（26 檔）。Worker 未 commit 本工單與 BUG-141，由塔台一併 commit。塔台複驗 @ `38fe7421`：`npm run test:unit` 4318 passed / 252 files、`npm run typecheck` = 0、`npm run typecheck:electron` = 0；WSL：0.6.1-pre.4、active、enabled、`BAT_SERVER_PORT=9877`；安裝腳本 `rm -rf` 只作用於 `$stage` / `$old`。
- 取捨 1–6 採納；「安裝失敗時 rollback 不再刪 root」與「疊在非 BAT 目錄不刪」為範圍內的同源修正，採納。
- A3.clean-install 在同版重裝時必然 FAIL（目錄不會變小）：屬 T0550 spec 斷言的適用條件問題，非產品缺陷；列為後續（改成只在版本不同時檢查）。
- 殘餘風險 1（SSH 未實機）列入 pre.5 實機項目；2–4 接受並記錄。
- WSL 新備份（T0554 建立）：`~/.local/bat-server.bak-0.6.1-pre.4-t0554`（390M）、`~/.config/systemd/user/bat-server.service.bak-0.6.1-pre.4-t0554`，已依使用者指示於 2026-10-16 04:24 刪除。
- Worker 分頁已回收（到期 `close requested`）。下一張 T0555 已派。

