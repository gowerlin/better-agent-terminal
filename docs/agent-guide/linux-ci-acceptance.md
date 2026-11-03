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
- 「Inspect the AppImage」步驟：`--appimage-extract`（不需要 FUSE）後列出 AppRun 的 `BIN`、AppRun 會不會自己加 `--no-sandbox`、`.desktop` 的 `Exec=`、`chrome-sandbox` 權限、`BIN` 是不是 T0799 的 sandbox 啟動器（是的話主程式是 `BIN.bin`）、主程式需要的最高 `GLIBC_*` 與 `ldd` 找不到的函式庫、整個映像**每一個** ELF 檔需要的最高 `GLIBC_*`（高於該 runner glibc 的標 `(above this system's glibc …)`；沒有 glibc 版本符號的記 `none`、`objdump` 讀不了的記 `n/a (objdump: …)`），以及每個 ELF 檔 `ldd` 的 `not found` 行（缺函式庫或 `` version `GLIBC_2.xx' not found ``）。🔴 這一步只記錄（T0798）：關掉 errexit / pipefail、每個輔助函式都回 0，任何一項取不到都寫 `n/a` 與錯誤原文，不得讓 job 失敗或截斷清單；不得改用整步 `continue-on-error: true`（清單照樣會截斷）。
- 驗收：`xvfb-run -a npx playwright test e2e/linux/`，`BAT_E2E_EXECUTABLE` = AppImage 本身。測試依賴只裝 `npm ci --ignore-scripts`。
- artifact `linux-acceptance-<version 或 build<run id>>-<os>-attempt<N>`（報告 md / json、截圖、BAT debug log、`appimage-inspect.md`、`runner-context.md`），保留 7 天。spec 只從 userData 抄 `Logs/debug-*.log`；上傳前仍刪掉 `server-token.json` / `server-cert.json` / `helper-capabilities.json` / `claude-sessions.json`（userData 裡存金鑰、權杖、session id 的檔），以及內容含權杖樣式的檔案（同 macOS workflow）。
- job summary 依序放 `linux-report.md`、`appimage-inspect.md`、`runner-context.md`。

## 驗收級別與判讀

| 列 | 何時跑 | 內容 |
|---|---|---|
| L1 | 一律 | Playwright `_electron.launch` 啟動 AppImage（🔴 `chromiumSandbox: true`，不加 `--no-sandbox`）；主視窗可見、預設工作區的終端分頁出現、用鍵盤輸入 `echo T0797_$((6*7))_<隨機>`，PTY 輸出出現 `T0797_42_<隨機>`（只有 shell 的輸出含 `_42_`）、截圖、renderer 在自己的 PID namespace（sandbox 有開）、主程序命令列沒有 `--no-sandbox`、debug log 已建立且 0 個 `[CRASH]`、結束對話框回答「結束＋停止 Terminal Server」後正常關閉。T0799：AppImage 啟動器自己加了 `--no-sandbox`（debug log `[sandbox] Chromium sandbox auto-disabled …`，見 [linux-appimage-sandbox.md](linux-appimage-sandbox.md)）時，sandbox 兩項不判、其餘都過 → 列結果 **WARN**，證據寫 `sandbox auto-disabled (BUG-202 fallback)` |
| L2 | 一律（T0799 起；之前只在 L1 啟動失敗時） | 不經 Playwright、不帶任何除錯旗標，照使用者在終端機執行的方式啟動；等 debug log 出現（最多 120 s），之後再 20 s 仍在、送 SIGTERM 之前沒有 `[CRASH]`；記錄 stdout / stderr 有沒有啟動器的 `[sandbox] userns restricted …` 那一行。FAIL → verdict FAIL。T0799 run `41504087753` 的兩個修正：① 24.04 從啟動到 debug log 超過 20 s（L1 開窗 70 s），原本「啟動後 20 s」時 log 還不存在；② SIGTERM 送給整個程序群組，GPU / Utility 子程序被它殺掉而記 `[CRASH] child-process-gone`，這些行時間在 SIGTERM 之後，不算 |
| L1b | L1 啟動失敗時 | L1 重跑並加 `--no-sandbox`，只為了繼續驗其他項目；報告中與 L1 分開列 |
| W1 | 第一個啟動成功的 Playwright 列（通常 L1） | T0800 / BUG-204 起為判定項（T0799 時只記錄）：main 程序照 `electron/whisper-addon-loader.ts` 的方式載入打包內的 `@kutalia/whisper-node-addon`（從 app 解析 `<pkg>/package.json` → `dist/linux-<arch>/whisper.node` → `app.asar` 改 `app.asar.unpacked` → `require`，要匯出 `whisper()`）。載入成功 → **PASS**；失敗時依系統 glibc（`ldd --version`）：≥ 2.38（24.04）或讀不到版本 → **WARN**，verdict 至少 WARN（`verdictReason` 寫 `W1: whisper addon failed to load`）；< 2.38（22.04）→ **INFO**，只記錄（addon 需要 `GLIBC_2.38`，BUG-203），不影響 verdict。判斷唯一實作 `judgeWhisperLoad`（`e2e/linux/linux-os.ts`，單元測試 `scripts/__tests__/linux-acceptance-w1.test.mjs`）。證據：錯誤原文（掛載路徑換成 `<appdir>/`）、`whisper.node` 的 RUNPATH（`readelf -d`，應為 `$ORIGIN`，見 [packaging-release-checks.md](packaging-release-checks.md)「Linux whisper addon：函式庫搜尋路徑」）、失敗時 `ldd` 的 `not found` 行 |
| V1 | 與 W1 同一個 Playwright 列（W1 之後） | T0802 / D247：BAT 自己的語音可用性事先檢查（啟動後約 5 s 以子程序試載 whisper，見 [voice-availability.md](voice-availability.md)）。以 renderer 的 `electronAPI.voice.getAvailability()` 判讀（= 麥克風按鈕依據的狀態），每秒輪詢到離開 `unknown(pending)`（最多 60 s）。glibc ≥ 2.38（24.04）或讀不到版本 → 應為 `available`；< 2.38（22.04）→ 應為 `unavailable(glibc-too-old)`。相符 → **PASS**；其他（含 `unknown(…)`、讀不到）→ **WARN**，verdict 至少 WARN（`verdictReason` 寫 `V1: voice availability …`）。畫面上有麥克風按鈕（`.prompt-box-mic`）時，其 `disabled` 與 `data-voice-unavailable` 須與狀態一致，不一致也是 WARN；終端分頁沒有顯示按鈕時只記錄 `not on screen`。證據另有 debug log 的 `[voice] availability:` 行。判斷唯一實作 `judgeVoiceAvailability`（`e2e/linux/linux-os.ts`，單元測試 `electron/__tests__/linux-acceptance-v1.test.ts`）。選 IPC 而不是只看按鈕的理由：按鈕是否在畫面上取決於分頁類型與版面（例 Claude CLI 分頁不顯示），IPC 每次都讀得到、而且就是按鈕的資料來源；debug log 只在檢查完成後才有那一行，當作佐證 |

整體結論（`linux-report.md` 的 `verdict`，`verdictReason` 寫原因；meta 另有 `sandbox`、`whisper`、`voiceAvailability`）：

- **PASS**：L1 全部通過，且 L2 PASS。
- **WARN**：L1 啟動了但有項目沒過（`[CRASH]`、沒正常關閉、鍵盤輸入只能經 `pty.write` 才到、renderer 沒有 sandbox 或命令列有 `--no-sandbox` 而啟動器沒有回報降級），或 L1 是 WARN（`sandbox auto-disabled (BUG-202 fallback)`：開得起來，但沒有 sandbox，要持續看得見），或 L1 起不來而 L1b 可以（= 要 `--no-sandbox` 才能用），或 W1 是 WARN（glibc ≥ 2.38 的系統上 whisper 載不起來，T0800），或 V1 是 WARN（語音可用性檢查結果不符預期，T0802）。job 綠燈但有 `::warning::` 註記，**不是 PASS**。
- **FAIL**：L1 啟動了但連終端都沒有，或 L1 與 L1b 都起不來，或 L2 FAIL。test 失敗（紅燈）。

判讀重點：

- 起不來時先看 L1 的 `launch failed` 原文：`The SUID sandbox helper binary was found, but is not configured correctly` / `No usable sandbox!` 之類 = Chromium sandbox；`dlopen(): error loading libfuse.so.2` / `fuse: device not found` = FUSE；`error while loading shared libraries` = 缺函式庫（對照 `appimage-inspect.md` 的 `not found`）；`GLIBC_2.xx not found` = glibc 太舊（對照最高 `GLIBC_*`）。
- 24.04 的 AppArmor 限制：`runner-context.md` 的 `apparmor_restrict_unprivileged_userns = 1` 時，非 setuid 的 `chrome-sandbox`（AppImage 是 FUSE 掛載，不會是 setuid）只能用 user namespace，被擋就起不來（BUG-202）。T0799 起 AppImage 的啟動器偵測到這個情況會自己加 `--no-sandbox`，L1 / L2 照常啟動、報告標 `sandbox auto-disabled (BUG-202 fallback)`、verdict WARN。🔴 spec 與 workflow 本身仍不得一開始就加 `--no-sandbox` 或改 sysctl / AppArmor 讓它過：降級必須是產品自己做的、而且看得見。runner 的值是 0 時，runner 上的 PASS 不能代表預設設定的 24.04 桌面（桌面版預設是 1），報告要寫明。2026-11 的 GitHub `ubuntu-24.04` runner 是 1（T0798 實測），與桌面版預設相同。
- 啟動耗時：`window loaded after … ms`（含 FUSE 掛載與 xz squashfs 解壓）、`terminal tab visible`、`marker … ms after launch` 三個時間都在 L1 的證據裡。

## 本機 WSL 實測（2026-11-03，`v0.7.4-pre.1`）

環境：Windows 上的 WSL2 Ubuntu 24.04.5（kernel 6.18 microsoft-standard，沒有 AppArmor userns 限制檔）、glibc 2.39、xvfb。下載的 AppImage SHA-256 與 release digest 相同。這是精簡映像，原本沒有 `libfuse.so.2`，也缺 `libnss3` / `libasound2`（桌面版預設都有），補裝後才啟動。

- L1 **PASS**：視窗 45 s 載入（FUSE + xz 解壓，WSL 的 I/O 較慢）、終端分頁 47 s、鍵盤 echo 標記 50 s；renderer `NSpid` 三層（sandbox 有開）、主程序命令列沒有 `--no-sandbox`、debug log 0 個 `[CRASH]` / `[ERROR]`、關閉 1 s。
- AppImage 靜態檢查：AppRun 的 `BIN` 是 `BetterAgentTerminal`，AppRun **不會**自己加 `--no-sandbox`；`.desktop` 的 `Exec=AppRun --no-sandbox %U`（electron-builder 在沒設 `executableArgs` 時的預設，只有經桌面整合 / AppImageLauncher 從選單啟動才會帶）。`chrome-sandbox` 不是 setuid。主程式最高需要 `GLIBC_2.25`；🔴 `@kutalia/whisper-node-addon/dist/linux-x64/libggml-base.so`、`libggml-vulkan.so` 需要 `GLIBC_2.38`，高於 Ubuntu 22.04 的 2.35。本驗收沒有測語音輸入；22.04 上 whisper 載入是否失敗由 CI 報告與後續工單確認（runner 的 `ldd` 結果見下節）。

## GitHub runner 實測（T0798，2026-11-03，`v0.7.4-pre.1`）

run `41495143950`（分支 `ct/T0798` `f5b94408`，workflow / spec 與 `main` `d977a92a` 相同）：

| OS | verdict | L1 | L2 | L1b | `apparmor_restrict_unprivileged_userns` | 啟動耗時（L1 / L1b） |
|---|---|---|---|---|---|---|
| ubuntu-22.04（glibc 2.35） | **PASS** | PASS：renderer sandbox 有開、鍵盤 echo、正常關閉、debug log 0 個 `[CRASH]` / `[ERROR]` | 沒跑 | 沒跑 | 0 | 視窗 70 s、終端 74 s、標記 76 s |
| ubuntu-24.04（glibc 2.39） | **WARN** | FAIL：`FATAL:…setuid_sandbox_host.cc:172] The SUID sandbox helper binary was found, but is not configured correctly. … chrome-sandbox is owned by root and has mode 4755`（SIGTRAP） | FAIL：同一行 FATAL，不經 Playwright 也一樣 | PASS（`--no-sandbox`）：視窗 92 s、鍵盤 echo、0 個 `[CRASH]` / `[ERROR]` | **1**（= 桌面版預設） | L1b 視窗 92 s、終端 97 s、標記 102 s |

- 🔴 24.04 用預設設定（AppArmor 限制 user namespace）時，AppImage 不加 `--no-sandbox` 開不起來；這是產品相容性結果，本工單只記錄。22.04 的 runner 值是 0，sandbox 走 user namespace 可用。
- 啟動耗時含 FUSE 掛載與 xz squashfs 解壓，runner 之間差很多（22.04 同一版另一次 43 s）。
- ELF GLIBC：整個映像 53 個 ELF 檔，最高 `GLIBC_2.38` 的只有 `@kutalia/whisper-node-addon/dist/linux-x64/libggml-base.so`、`libggml-vulkan.so`。22.04 上 `ldd` 報 `` version `GLIBC_2.38' not found ``（兩個都有），`libggml-vulkan.so` 另有 `` `GLIBCXX_3.4.32' not found ``；其餘 whisper `.so` 最高 `GLIBC_2.34`。啟動時不載入 whisper（debug log 只有 `[voice]` 註冊 handler 的行、沒有錯誤），所以 22.04 的 L1 不受影響；語音輸入在 22.04 實際能不能用沒有驗。whisper 的 `.so` 之間互相依賴的 `libggml*.so => not found` 兩個 OS 都有（`ldd` 不會往同目錄找），不代表執行期一定失敗。
- codex 的 `vendor/x86_64-unknown-linux-musl/` 執行檔（`codex`、`rg`、`bwrap` 等）是 musl 靜態連結，記為 `none`。

## GitHub runner 實測（T0799，2026-11-03，desktop-build `41502529486` 的 AppImage）

| run | OS | verdict | L1 | L2 | W1（whisper） |
|---|---|---|---|---|---|
| `41504087753`（舊 L2 判讀） | 22.04 / 24.04 | FAIL / FAIL | PASS / WARN（自動降級） | FAIL / FAIL：判讀問題，見 L2 列說明 | 兩邊都 `libwhisper.so.1: cannot open shared object file: No such file or directory` |
| `41504962084` | 22.04 | **PASS** | PASS（sandbox 開、命令列無 `--no-sandbox`） | PASS（debug log 37 s 後出現） | 同上 |
| `41504962084` | 24.04 | **WARN** | WARN：`sandbox auto-disabled (BUG-202 fallback)`，視窗 92 s、鍵盤 echo、0 個 `[CRASH]` | PASS（debug log 44 s 後出現） | 同上 |

- W1：`libwhisper.so.1` 就在 `whisper.node` 同一個目錄（`appimage-inspect.md` 有列），但 `whisper.node` 載入時動態載入器找不到它，兩個 OS 都在 glibc 版本檢查之前就失敗，所以 22.04 的 `GLIBC_2.38`（BUG-203）在這個錯誤之後才會遇到、目前看不到。
- `41505876807`（L2 同時看輸出開頭與 debug log 的降級紀錄）：22.04 **PASS**（L1 / L2 PASS、sandbox 開）；24.04 **WARN**（L1 WARN 自動降級、L2 PASS，stderr 那一行與 debug log 那一行都有）。W1 結果同上。

## GitHub runner 實測（T0800，2026-11-03，desktop-build `41575226873` 的 AppImage）

BUG-204 修正後（`afterPack` 以 patchelf 把 whisper 共享物件的 RUNPATH 改成 `$ORIGIN`，見 [packaging-release-checks.md](packaging-release-checks.md)「Linux whisper addon：函式庫搜尋路徑」），linux-acceptance run `41575592616`：

| OS | glibc | verdict | L1 | L2 | W1（whisper） |
|---|---|---|---|---|---|
| 22.04 | 2.35 | **PASS** | PASS（sandbox 開、命令列無 `--no-sandbox`） | PASS | **INFO**：`` GLIBC_2.38' not found `` (`libggml-base.so`、`libggml-vulkan.so`），`ldd` 另有 `` GLIBCXX_3.4.32' not found `` (`libggml-vulkan.so`) = BUG-203，只記錄 |
| 24.04 | 2.39 | **WARN**（`L1: sandbox auto-disabled (BUG-202 fallback)`） | WARN（自動降級） | PASS | **PASS**：`whisper addon loaded (whisper() exported)` |

- 兩邊 `whisper.node` 的 RUNPATH 都是 `$ORIGIN`（`readelf -d`）；`libwhisper.so.1` 找不到的錯誤消失。22.04 現在看得到 BUG-203 的 glibc 錯誤。
- L1 / L2 判讀與 T0799 run `41505876807` 一致（22.04 PASS、24.04 WARN 自動降級）。
- runner 上 `libgomp1` / `libvulkan1` 都已存在，所以 24.04 載入成功；最小安裝的系統若沒有這兩個套件，W1 會以 `libgomp.so.1` / `libvulkan.so.1` 的 `not found` 失敗（T0800 在沒裝 `libgomp1` 的 WSL 24.04 實測過 `libgomp.so.1`）。
- W1 只驗載入（`require` + 匯出 `whisper()`），沒有實際轉錄音檔。

## 已知限制與陷阱

- **產品已知限制（BUG-203 WONTFIX，D246）**：上游 `@kutalia/whisper-node-addon` 的 `libggml-base.so` / `libggml-vulkan.so` 需要 `GLIBC_2.38`（`libggml-vulkan.so` 另需 `GLIBCXX_3.4.32`），glibc < 2.38（Ubuntu 22.04 為 2.35）不支援語音輸入；寫在 README「語音輸入 › Linux」。W1 在 22.04 判 INFO 即反映此限制，不是待修項目。要支援 22.04 時重開 BUG-203（修法：上游以較舊的 glibc 重建，或 BAT 自建 whisper）。
- 🔴 **Playwright 在 Linux 預設替 Electron 加 `--no-sandbox`**（`playwright-core` `server/electron/electron.js`：`chromiumSandbox` 預設 false 時 `unshift('--no-sandbox')`）。T0797 本機第一次實跑就因此「通過」了沒開 sandbox 的啟動。spec 對 L1 傳 `chromiumSandbox: true`；改 spec 時不得拿掉。
- 🔴 **Playwright 1.59 的 `electron.launch` 失敗會讓測試直接停掉**：app 在印出 `Debugger listening` 前就結束時，`playwright-core` 的 `waitForLine` 有好幾個 promise 一起以 `Process failed to launch!` reject；被 await 的那個進得到 spec 的 catch，但 `waitForXserverError` / `chromeMatchPromise` 沒人處理，Playwright worker 把 unhandled rejection 當成致命錯誤，讓測試失敗並停掉（`workerMain.js` `unhandledError`）。結果 L2、L1b、verdict 都沒跑，`linux-report.md` 只有 meta、沒有任何列（T0798 run `41492924250` 的 24.04）。spec 一律經 `launchElectron`（同檔）啟動：launch 期間（失敗後再 1 s）只吞掉這個錯誤訊息，其他 rejection 交回 worker 原本的 listener。改 spec 或升 Playwright 時不得改回直接呼叫 `electron.launch`。
- `Seccomp: 2` 不能當 sandbox 證據：WSL 上主程序本身就是 2，`--no-sandbox` 的子程序也是 2。只用 `NSpid` 有沒有兩個以上的值判斷。
- Chromium 會改寫自己的 process title，`/proc/<pid>/cmdline` 可能是一整串以空白連接的字串，判斷旗標要先 `join(' ')` 再比對。
- `electron-isolation.ts` 的 `TERMINAL_SERVER_SCRIPT` 照 Windows 版面組路徑，AppImage 的 Terminal Server 在 `/tmp/.mount_*/resources/app.asar/…`，fixture 的殘留比對不會命中；spec 另外檢查 pid 檔，命令列含 `terminal-server.js` 才砍。
- runner 是伺服器映像＋xvfb：沒有真的桌面工作階段、D-Bus session、keyring（`safeStorage` 走 Linux fallback）、GPU（軟體繪圖）。這些與真人桌面的差異不影響「能不能開窗、開終端」，但影響通知、系統匣、硬體加速，本驗收不涵蓋。
- runner 映像預裝 Chrome，本來就有很多桌面函式庫；runner 上 `appimage-inspect.md` 的 `not found` 清單是空的，也不代表最小安裝的系統沒問題（WSL 精簡映像就缺 `libnss3` / `libasound2`）。
- 🔴 `run:` 預設 shell 是 `bash -e {0}`（errexit 一開始就開著，腳本裡的 `set -uo pipefail` 不會關掉它）。T0797 的 Inspect 步驟在 errexit + pipefail 下，遇到第一個沒有 glibc 版本符號的 ELF 檔時 `v=$(max_glibc …)` 回非 0，管線裡的 while 子 shell 直接結束，清單只印出幾筆就 `exit code 1`，後面的 Playwright 沒跑（run `41491827025`，22.04 列 5 筆、24.04 列 2 筆，筆數不同是因為 `find` 的順序隨檔案系統而變）。本機 WSL 用一般 `bash` 跑沒有 `-e`，所以沒遇到。本機照 workflow 步驟手動跑時用 `bash -e <步驟腳本>`。
- BAT 收到 SIGTERM 會跳結束確認對話框（T0144），所以 L2 的結束方式常是 `SIGKILL`，只記錄、不判讀。
- spec 在 `process.platform !== 'linux'` 或沒有 `BAT_E2E_EXECUTABLE` 時跳過（Windows / macOS 本機 `npm run test:e2e` 不受影響）。

## 驗證清單（改 spec / workflow 時）

1. 本機：`npx tsc --noEmit --skipLibCheck --strict --target ES2022 --module esnext --moduleResolution bundler --types node --esModuleInterop e2e/linux/*.ts` = 0；`npx playwright test e2e/linux/ --list` 列得出 1 個 test（非 Linux 執行時跳過）；actionlint（本機沒有時從 rhysd/actionlint 的 GitHub release 下載單一執行檔）。
2. 有 WSL Ubuntu 時可照 workflow 步驟手動跑（步驟腳本以 `bash -e` 執行，與 runner 相同）：下載 AppImage、比對 digest、`chmod +x`、裝 `libfuse2t64 fuse3 xvfb binutils`（精簡映像另需 `libnss3 libasound2t64`）、在只含 `e2e/fixtures/electron-isolation.ts` 與 `e2e/linux/*.ts` 的暫存專案裝 `@playwright/test`，`xvfb-run -a npx playwright test e2e/linux/`。WSL 閒置會重開並清空 `/tmp`，暫存檔放家目錄底下、跑完刪掉。
3. push 後 dispatch，讀 job summary 或下載 artifact。修 workflow 時可先 push 到驗證分支，以 `gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal --ref <分支> -f version=<版號>` 跑分支上的版本（workflow 檔要已在預設分支上，才 dispatch 得到；T0798 以 `ct/T0798` 驗證）。
