# Linux AppImage 啟動驗收（T0797，D242）

用途：回答「AppImage 在 Ubuntu 22.04 / 24.04 開得起來嗎」，每一版都能一鍵重驗。`desktop-build` / `pre-release` 的 Linux job 只打包與檢查產物，從沒啟動過 AppImage（T0784〈要看的項目〉Linux 列；T0781 查不到 Electron 45 的 glibc 下限）。

- workflow：`.github/workflows/linux-acceptance.yml`（只有 `workflow_dispatch`，不接進任何發版 / 測試關卡流程）
- spec：`e2e/linux/t0797-linux-appimage-launch.spec.ts`，Linux 輔助（`/proc`、`ldd`、debug log、無 Playwright 的啟動）：`e2e/linux/linux-os.ts`
- 共用 fixture：`e2e/fixtures/electron-isolation.ts`（`isolatedEnv` / `freePort` / `closeIsolated` / `readPid`）；本功能沒有改這個檔，`playwright.config.ts` 也沒改（`e2e/**/*.spec.ts` 本來就收得到）

## 觸發

```bash
gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal -f version=0.7.4-pre.1
gh run list -R gowerlin/better-agent-terminal --workflow linux-acceptance.yml -L 3
gh run download <run id> -R gowerlin/better-agent-terminal -D <資料夾>
```

🔴 `gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。workflow 要在預設分支上才能 dispatch。

`version` 必須是 `X.Y.Z` 或 `X.Y.Z-pre.N`，對應 tag `v<version>` 與資產 `BetterAgentTerminal-<version>.AppImage`（2026-11-03 以 `gh release view v0.7.4-pre.1 --json assets` 確認的實際檔名，沒有 arch 後綴）。

測 desktop-build 產物（試做分支沒有 release 時）：

```bash
gh workflow run desktop-build.yml -R gowerlin/better-agent-terminal -f ref=<分支或 SHA>
gh run list -R gowerlin/better-agent-terminal --workflow desktop-build.yml -L 3          # 取 run id，等它 completed
gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal -f build_run_id=<desktop-build run id>
```

`build_run_id` 有值時 `version` 不使用：確認該 run 的 workflow 是 `Desktop build (no release)` → `gh run download -n desktop-linux` → 印 `BUILD-INFO.txt` → artifact 內必須正好一個 AppImage，SHA-256 等於同一 artifact 的 `SHA256SUMS.txt`，不符即停。desktop-build 的 artifact 只保留 7 天。

## workflow 規則（必守）

- 只有 `workflow_dispatch`；`permissions: contents: read`、`actions: read`（讀 desktop-build run 的 artifact）；🔴 不使用任何 secret（下載用 job 自己的唯讀 `GITHUB_TOKEN`）。不放進 `pre-release.yml` / `release.yml` / `tests.yml`，不加任何發布動作。
- matrix `os: [ubuntu-22.04, ubuntu-24.04]`、`fail-fast: false`（一個 OS 失敗不取消另一個）；`timeout-minutes: 30`。
- release 模式：下載後比對 release 資產的 `digest`（`sha256:…`），不符即停。
- 「Runner context」步驟在**安裝套件之前**記錄：OS、kernel、glibc、`apparmor_restrict_unprivileged_userns` / `unprivileged_userns_clone` / `max_user_namespaces`、`/dev/fuse`、`libfuse.so.2` 有沒有、`fusermount`。這是「全新系統的使用者一開始的狀態」。
- 🔴 FUSE 用一般使用者的方式：照 Ubuntu 的 AppImage 說明裝 `libfuse2`（22.04）/ `libfuse2t64`（24.04），另裝 `fuse3`（`fusermount`，桌面版預設就有）。**不用** `--appimage-extract-and-run`：那會跳過使用者會撞到的 FUSE 掛載。
- 也裝 `xvfb`、`binutils`（`objdump`）、`fonts-noto-cjk`、`fonts-noto-color-emoji`：兩個字型是 Ubuntu 桌面版預設；runner 沒有時 zh-TW 介面與 emoji 圖示在截圖裡是方塊（T0797 本機 WSL 實測）。
- 「Inspect the AppImage」步驟：`--appimage-extract`（不需要 FUSE）後列出 AppRun 的 `BIN`、AppRun 會不會自己加 `--no-sandbox`、`.desktop` 的 `Exec=`、`chrome-sandbox` 權限、主程式需要的最高 `GLIBC_*` 與 `ldd` 找不到的函式庫、整個映像各 ELF 檔需要的最高 `GLIBC_*`（前 10 名）。
- 驗收：`xvfb-run -a npx playwright test e2e/linux/`，`BAT_E2E_EXECUTABLE` = AppImage 本身。測試依賴只裝 `npm ci --ignore-scripts`。
- artifact `linux-acceptance-<version 或 build<run id>>-<os>-attempt<N>`（報告 md / json、截圖、BAT debug log、`appimage-inspect.md`、`runner-context.md`），保留 7 天。spec 只從 userData 抄 `Logs/debug-*.log`；上傳前仍刪掉 `server-token.json` / `server-cert.json` / `helper-capabilities.json` / `claude-sessions.json`（userData 裡存金鑰、權杖、session id 的檔），以及內容含權杖樣式的檔案（同 macOS workflow）。
- job summary 依序放 `linux-report.md`、`appimage-inspect.md`、`runner-context.md`。

## 驗收級別與判讀

| 列 | 何時跑 | 內容 |
|---|---|---|
| L1 | 一律 | Playwright `_electron.launch` 啟動 AppImage（🔴 `chromiumSandbox: true`，不加 `--no-sandbox`）；主視窗可見、預設工作區的終端分頁出現、用鍵盤輸入 `echo T0797_$((6*7))_<隨機>`，PTY 輸出出現 `T0797_42_<隨機>`（只有 shell 的輸出含 `_42_`）、截圖、renderer 在自己的 PID namespace（sandbox 有開）、debug log 已建立且 0 個 `[CRASH]`、結束對話框回答「結束＋停止 Terminal Server」後正常關閉 |
| L2 | L1 啟動失敗時 | 不經 Playwright、不帶任何除錯旗標，照使用者在終端機執行的方式啟動；20 s 後仍在、debug log 已建立且沒有 `[CRASH]`。用來分辨「app 起不來」與「Playwright 驅動不了」 |
| L1b | L1 啟動失敗時 | L1 重跑並加 `--no-sandbox`，只為了繼續驗其他項目；報告中與 L1 分開列 |

整體結論（`linux-report.md` 的 `verdict`）：

- **PASS**：L1 全部通過。
- **WARN**：L1 啟動了但有項目沒過（`[CRASH]`、沒正常關閉、鍵盤輸入只能經 `pty.write` 才到、renderer 沒有 sandbox），或 L1 起不來而 L1b 可以（= 要 `--no-sandbox` 才能用）。job 綠燈但有 `::warning::` 註記，**不是 PASS**。
- **FAIL**：L1 啟動了但連終端都沒有，或 L1 與 L1b 都起不來。test 失敗（紅燈）。

判讀重點：

- 起不來時先看 L1 的 `launch failed` 原文：`The SUID sandbox helper binary was found, but is not configured correctly` / `No usable sandbox!` 之類 = Chromium sandbox；`dlopen(): error loading libfuse.so.2` / `fuse: device not found` = FUSE；`error while loading shared libraries` = 缺函式庫（對照 `appimage-inspect.md` 的 `not found`）；`GLIBC_2.xx not found` = glibc 太舊（對照最高 `GLIBC_*`）。
- 24.04 的 AppArmor 限制：`runner-context.md` 的 `apparmor_restrict_unprivileged_userns = 1` 時，非 setuid 的 `chrome-sandbox`（AppImage 是 FUSE 掛載，不會是 setuid）只能用 user namespace，被擋就起不來。🔴 這個情況本身就是要回報的結果，不得改成一開始就加 `--no-sandbox` 或改 sysctl 讓它過。runner 的值是 0 時，runner 上的 PASS 不能代表預設設定的 24.04 桌面（桌面版預設是 1），報告要寫明。
- 啟動耗時：`window loaded after … ms`（含 FUSE 掛載與 xz squashfs 解壓）、`terminal tab visible`、`marker … ms after launch` 三個時間都在 L1 的證據裡。

## 本機 WSL 實測（2026-11-03，`v0.7.4-pre.1`）

環境：Windows 上的 WSL2 Ubuntu 24.04.5（kernel 6.18 microsoft-standard，沒有 AppArmor userns 限制檔）、glibc 2.39、xvfb。下載的 AppImage SHA-256 與 release digest 相同。這是精簡映像，原本沒有 `libfuse.so.2`，也缺 `libnss3` / `libasound2`（桌面版預設都有），補裝後才啟動。

- L1 **PASS**：視窗 45 s 載入（FUSE + xz 解壓，WSL 的 I/O 較慢）、終端分頁 47 s、鍵盤 echo 標記 50 s；renderer `NSpid` 三層（sandbox 有開）、主程序命令列沒有 `--no-sandbox`、debug log 0 個 `[CRASH]` / `[ERROR]`、關閉 1 s。
- AppImage 靜態檢查：AppRun 的 `BIN` 是 `BetterAgentTerminal`，AppRun **不會**自己加 `--no-sandbox`；`.desktop` 的 `Exec=AppRun --no-sandbox %U`（electron-builder 在沒設 `executableArgs` 時的預設，只有經桌面整合 / AppImageLauncher 從選單啟動才會帶）。`chrome-sandbox` 不是 setuid。主程式最高需要 `GLIBC_2.25`；🔴 `@kutalia/whisper-node-addon/dist/linux-x64/libggml-base.so`、`libggml-vulkan.so` 需要 `GLIBC_2.38`，高於 Ubuntu 22.04 的 2.35。本驗收沒有測語音輸入；22.04 上 whisper 載入是否失敗由 CI 報告與後續工單確認。

## 已知限制與陷阱

- 🔴 **Playwright 在 Linux 預設替 Electron 加 `--no-sandbox`**（`playwright-core` `server/electron/electron.js`：`chromiumSandbox` 預設 false 時 `unshift('--no-sandbox')`）。T0797 本機第一次實跑就因此「通過」了沒開 sandbox 的啟動。spec 對 L1 傳 `chromiumSandbox: true`；改 spec 時不得拿掉。
- `Seccomp: 2` 不能當 sandbox 證據：WSL 上主程序本身就是 2，`--no-sandbox` 的子程序也是 2。只用 `NSpid` 有沒有兩個以上的值判斷。
- Chromium 會改寫自己的 process title，`/proc/<pid>/cmdline` 可能是一整串以空白連接的字串，判斷旗標要先 `join(' ')` 再比對。
- `electron-isolation.ts` 的 `TERMINAL_SERVER_SCRIPT` 照 Windows 版面組路徑，AppImage 的 Terminal Server 在 `/tmp/.mount_*/resources/app.asar/…`，fixture 的殘留比對不會命中；spec 另外檢查 pid 檔，命令列含 `terminal-server.js` 才砍。
- runner 是伺服器映像＋xvfb：沒有真的桌面工作階段、D-Bus session、keyring（`safeStorage` 走 Linux fallback）、GPU（軟體繪圖）。這些與真人桌面的差異不影響「能不能開窗、開終端」，但影響通知、系統匣、硬體加速，本驗收不涵蓋。
- runner 映像預裝 Chrome，本來就有很多桌面函式庫；runner 上 `appimage-inspect.md` 的 `not found` 清單是空的，也不代表最小安裝的系統沒問題（WSL 精簡映像就缺 `libnss3` / `libasound2`）。
- BAT 收到 SIGTERM 會跳結束確認對話框（T0144），所以 L2 的結束方式常是 `SIGKILL`，只記錄、不判讀。
- spec 在 `process.platform !== 'linux'` 或沒有 `BAT_E2E_EXECUTABLE` 時跳過（Windows / macOS 本機 `npm run test:e2e` 不受影響）。

## 驗證清單（改 spec / workflow 時）

1. 本機：`npx tsc --noEmit --skipLibCheck --strict --target ES2022 --module esnext --moduleResolution bundler --types node --esModuleInterop e2e/linux/*.ts` = 0；`npx playwright test e2e/linux/ --list` 列得出 1 個 test（非 Linux 執行時跳過）；actionlint（本機沒有時從 rhysd/actionlint 的 GitHub release 下載單一執行檔）。
2. 有 WSL Ubuntu 時可照 workflow 步驟手動跑：下載 AppImage、比對 digest、`chmod +x`、裝 `libfuse2t64 fuse3 xvfb binutils`（精簡映像另需 `libnss3 libasound2t64`）、在只含 `e2e/fixtures/electron-isolation.ts` 與 `e2e/linux/*.ts` 的暫存專案裝 `@playwright/test`，`xvfb-run -a npx playwright test e2e/linux/`。WSL 閒置會重開並清空 `/tmp`，暫存檔放家目錄底下、跑完刪掉。
3. push 後 dispatch，讀 job summary 或下載 artifact。
