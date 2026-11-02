# Linux AppImage 的 sandbox 自動降級（T0799 / BUG-202，D244）

用途：Ubuntu 24.04 預設設定（`kernel.apparmor_restrict_unprivileged_userns = 1`）下直接執行 AppImage，Chromium 不能用 user namespace，退回 setuid `chrome-sandbox`；AppImage 掛載在 `/tmp/.mount_*`，`chrome-sandbox` 不可能是 root 擁有的 4755，Chromium 直接 FATAL（SIGTRAP），視窗都沒出現（BUG-202）。使用者決定（D244）：偵測到這個情況時自動加 `--no-sandbox` 啟動，其餘情況行為完全不變。

## 必守規則

- 🔴 只在下列條件**全部**成立時加 `--no-sandbox`，其他情況（Ubuntu 22.04、裝了 AppArmor profile、`chrome-sandbox` 已是 root 4755、使用者自己已帶 `--no-sandbox`）原樣 `exec`、不重複加：
  1. `ELECTRON_RUN_AS_NODE` 是空的或沒設（Node 模式沒有 Chromium sandbox；`--no-sandbox` 在 Node 模式是錯誤的 Node 選項）；
  2. 參數裡沒有 `--no-sandbox`（AppImage 內附 `.desktop` 的 `Exec=AppRun --no-sandbox %U` 就帶了）；
  3. 同目錄的 `chrome-sandbox` 不是「root 擁有＋setuid＋其他人可執行」（Chromium 自己的檢查，`sandbox/linux/suid/client/setuid_sandbox_host.cc`）；
  4. 這個二進位用不了 unprivileged user namespace（見下節判斷方式）。
- 🔴 只影響 Linux AppImage：`afterPack` 只在 `electronPlatformName === 'linux'` 且 targets 含 AppImage 時安裝啟動器（`isLinuxAppImageBuild`）。Windows / macOS 產物、`.desktop` 的 `Exec` 不改。
- 🔴 啟動器最後一步一律 `exec`：參數原樣轉送（含空白、空字串、`$`、引號、換行）、stdin / stdout / stderr、exit code、signal 都直接是二進位自己的；不得用 `eval`、不得拼接未加引號的參數。
- 🔴 可觀察：自動加的那次 stderr 印一行固定字串，debug log 記一行（見「日誌」）；不記任何 env 值或權杖。
- 唯一實作：啟動器 `scripts/appimage-sandbox-launcher.cjs`（`launcherScript` / `installAppImageLauncher` / `afterPackAppImageLauncher`，由 `scripts/version-manifest.cjs` 的 `afterPack` 呼叫）；debug log 一行 `electron/linux-sandbox-fallback.ts` `takeLinuxSandboxStart`（`electron/main.ts` 在 Skia 決策之後呼叫）；打包後檢查 `scripts/verify-packaged-native.js` 的 `appimage-launcher`。

## 為什麼是啟動器，不是 `app.commandLine.appendSwitch('no-sandbox')`（注入點查證）

- Chromium 在啟動 zygote 時決定 Linux sandbox（`content/app/content_main_runner_impl.cc` 的 browser 啟動流程，在 `BrowserMain` 之前），Electron 的 main JS 在 `BrowserMain` 的 `PostEarlyInitialization` 才執行。
- 實證：BUG-202 的 CI run（`41495143950`、`41496512040`）崩潰時**沒有任何 BAT debug log**。`app-paths-bootstrap.ts` 是 `main.ts` 的第一個 import，它一執行就 `logger.init` 寫 `[startup] Debug logging started.`；連這行都沒有 = main JS 根本沒跑到。從 JS 加開關一定太晚。
- electron-builder 26 的 AppImage `AppRun` 是 app-builder-lib 內建範本（`appImageUtil.js` `generateAppRunScript`），沒有自訂 AppRun 的設定；改 AppImage 本身要解開 squashfs 重包，不好維護。
- 採用：`afterPack` 把 `<appOutDir>/BetterAgentTerminal`（Electron 二進位）改名成 `BetterAgentTerminal.bin`，原位置寫 `/bin/sh` 啟動器。AppRun 的 `BIN="$APPDIR/BetterAgentTerminal"` 不變，執行的就是啟動器；AppImage 打包時把 `appOutDir` 整個複製進 squashfs，所以啟動器跟著進去。

## user namespace 判斷

| 條件 | 判斷 |
|---|---|
| `/proc/sys/kernel/apparmor_restrict_unprivileged_userns` = `1` | 用 Node 模式跑一次二進位本身（`ELECTRON_RUN_AS_NODE=1 NODE_OPTIONS='' timeout 5 BetterAgentTerminal.bin -e …`），讀 `/proc/self/attr/apparmor/current`（沒有時 `/proc/self/attr/current`）。值是 `unconfined` 或讀不到 → 沒有 profile → **用不了**；其他值（例 `bat-appimage (unconfined)`）→ 有 profile 套在這個二進位上 → 當作可用、不加 |
| 不是 `1`（22.04、其他發行版）且有 `unshare` | `unshare --user --map-root-user true`：與 Chromium 自己試的一樣（新的 user namespace＋寫 uid map）。成功 → 可用；失敗（例：容器的 seccomp 擋 `unshare`）→ 用不了 |
| 不是 `1` 且沒有 `unshare` | `/proc/sys/kernel/unprivileged_userns_clone` = `0` 或 `/proc/sys/user/max_user_namespaces` = `0` → 用不了；否則可用 |

- AppArmor 限制下為什麼不直接用 `unshare` 試：profile 是依執行檔路徑套用的，`unshare` 是另一個執行檔，套到 BAT 二進位的 profile 對它無效，結果會和 Chromium 實際的情況不同。所以那種情況改看二進位自己跑起來的 AppArmor 標籤。
- probe 的成本：只在 `apparmor_restrict_unprivileged_userns = 1` 而且前三個條件都成立時才跑，一次 Node 模式啟動（約數百 ms，CI 實測見下）。22.04 等不受限的系統只多一次 `unshare`。

## 日誌

- stderr（只有自動加的那次，固定字串、不含任何值）：

  ```
  [sandbox] userns restricted and chrome-sandbox not setuid root: starting with --no-sandbox (BUG-202)
  ```

- 自動加時，啟動器替二進位設 `BAT_APPIMAGE_SANDBOX_FALLBACK=1`（不加時一律 `unset`，從外面帶進來的也清掉）。main 啟動時 `takeLinuxSandboxStart` 讀完立刻從 `process.env` 刪掉（PTY 與其他子程序不會繼承），並在 Linux 上記一行 debug log：

  | 狀態 | 等級 | 行 |
  |---|---|---|
  | 啟動器加了 | WARN | `[sandbox] Chromium sandbox auto-disabled by the AppImage launcher (BUG-202 fallback): unprivileged user namespaces unusable and chrome-sandbox not setuid root; started with --no-sandbox (appimage=yes)` |
  | 命令列自己帶 `--no-sandbox` | INFO | `[sandbox] started with --no-sandbox from the command line (not added by the AppImage launcher) (appimage=…)` |
  | 沒有 `--no-sandbox` | INFO | `[sandbox] Chromium sandbox requested (no --no-sandbox) (appimage=…)` |
  | 有標記但沒有開關（不應發生） | INFO | `[sandbox] AppImage launcher marker present but no --no-sandbox switch; …` |

  `appimage=yes|no` 只看 `APPIMAGE` 有沒有設，不記路徑。Windows / macOS 不記（只刪標記）。

## 安全取捨

- 自動降級時 renderer、GPU、utility 程序都沒有 Chromium sandbox：renderer 若被外部內容（終端輸出、agent 回應等它顯示的東西）利用，不再有 Chromium sandbox 這一層隔離。BAT 自己在 Electron 層的 `webPreferences` 設定不受影響。
- 降級前的實際情況是「直接執行就崩潰」，使用者多半會自己加 `--no-sandbox` 或改用 `.desktop`（本來就帶 `--no-sandbox`）；自動降級沒有讓預設情況變得更不安全，只是讓它開得起來，並把降級寫進 stderr 與 debug log。
- 想保留 sandbox 的使用者可以用下一節的方式；裝好之後啟動器不再加 `--no-sandbox`。

## 想保留 sandbox：AppArmor profile（需自行評估）

> ⚠️ 以下需要 `sudo`，會放寬這個路徑上程式的 user namespace 限制，請自行評估。範例 profile 只在文件層級提供，**未在 CI 或實機實測**（CI 驗收的規則是不改 AppArmor / sysctl）。

AppImage 每次掛載的目錄名稱不同（`/tmp/.mount_<前綴><隨機>`），profile 只能用萬用字元比對；這表示任何人放在 `/tmp/.mount_*/BetterAgentTerminal.bin` 的程式都會拿到 `userns` 權限（與 22.04 的預設相同，但比 24.04 預設寬）。

```
# /etc/apparmor.d/bat-appimage
abi <abi/4.0>,
include <tunables/global>

profile bat-appimage /tmp/.mount_*/BetterAgentTerminal.bin flags=(unconfined) {
  userns,

  include if exists <local/bat-appimage>
}
```

```bash
sudo tee /etc/apparmor.d/bat-appimage >/dev/null <<'EOF'
（上面的內容）
EOF
sudo apparmor_parser -r /etc/apparmor.d/bat-appimage
# 移除
sudo apparmor_parser -R /etc/apparmor.d/bat-appimage && sudo rm /etc/apparmor.d/bat-appimage
```

- 設了 `TMPDIR` 時 AppImage runtime 可能掛載到別的目錄，路徑要跟著改。
- 另一種做法：把 AppImage 解開到固定位置（`--appimage-extract`），profile 寫那個固定路徑；或把解開後的 `chrome-sandbox` 改成 `root:root` 4755（`sudo chown root:root chrome-sandbox && sudo chmod 4755 chrome-sandbox`，Chromium 改用 setuid sandbox）。兩者啟動器都會判斷為「不需要降級」。
- 不建議為此把 `kernel.apparmor_restrict_unprivileged_userns` 改成 0：那會放寬整台機器。

## 已知限制

- `process.execPath` 變成 `…/BetterAgentTerminal.bin`（Terminal Server fork、`ELECTRON_RUN_AS_NODE` helper、`node-resolver` fallback 都直接用它，不經啟動器）。`app.relaunch()` 會直接執行 `.bin`，但沿用的 `process.argv` 已含 `--no-sandbox`，所以 24.04 上重啟一樣開得起來。
- `ELECTRON_RUN_AS_NODE` 的判斷是「非空」（與 Electron 自己讀這個變數的方式一致）；設成空字串時走一般判斷。
- AppArmor profile 的判斷只看「二進位有沒有被套 profile」，不檢查 profile 有沒有 `userns,`。套了 profile 但沒給 `userns` 的系統仍會崩潰（同 T0799 前），這種設定只可能是使用者自己寫的。
- 只有 `/bin/sh`、`readlink -f`、`dirname`、`stat -L -c`、`cat` 是必要的（Ubuntu / Debian / Fedora 的基本系統都有）；`timeout`、`unshare` 沒有時有退路。

## 驗證清單（改啟動器或判斷條件時）

1. `npx vitest run scripts/__tests__/appimage-sandbox-launcher.test.mjs`：靜態檢查在 Windows 也會跑；執行期案例（條件組合、參數轉送、exit code、stdin、空白目錄、symlink、`sh -n` / `bash -n` / `dash -n`、有 `shellcheck` 時 `shellcheck -s sh`）只在 POSIX 系統跑（Windows 跳過；CI `tests.yml` 是 ubuntu-24.04）。本機可在 WSL 的暫存專案裝 `vitest` 跑同一個檔。
2. `npx vitest run electron/__tests__/linux-sandbox-fallback.test.ts scripts/__tests__/verify-packaged-native.test.mjs`。
3. `desktop-build.yml`（`-f ref=<分支>`）→ `linux-acceptance.yml -f build_run_id=<run id>`：22.04 必須 PASS、renderer sandbox 開、主程序命令列沒有 `--no-sandbox`；24.04 能啟動、L1 / L2 標 `sandbox auto-disabled (BUG-202 fallback)`、verdict WARN（見 [linux-ci-acceptance.md](linux-ci-acceptance.md)）。

## CI 實測（T0799）

（見本檔下方由 T0799 填入的結果。）
