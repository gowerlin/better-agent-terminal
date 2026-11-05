---
schema_version: 1
schema_kind: workorder
id: T0866
title: "BUG-213 修正：Windows N-API addon 在啟動 Terminal Server（holder 與 fork 兩條路）前把 BAT 主行程繼承來的 stdio handle 暫時設為不可繼承、啟動後還原；建置 / 打包 / 驗證接線；重跑 W6"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: L
created_at: "2026-11-05T09:43:34+0800"
started_at: "2026-11-05T09:45:06+0800"
updated_at: "2026-11-05T10:23:07+0800"
completed_at: "2026-11-05T10:23:07+0800"
session_ids:
  - "b21e8033-bd6c-459c-85b8-ccd94c888815"
depends_on: [T0865]
related:
  - "BUG-213；D291（使用者選 T0865 選項 A）；T0865 回報區〈查證結果〉〈選項與代價〉；T0862（W6 `windows-upgrade-acceptance.yml`）；T0859（`forkTerminalServer` / `holderSpawnSpec`）；CLAUDE.md「Electron Runtime」native modules、「本機開發：npm 12 install scripts」、「Packaging / Release 前置檢查」"
affects_files:
  - _ct-workorders/T0866-win-stdio-inherit-napi-addon.md
  - _ct-workorders/BUG-213-pty-holder-inherits-launcher-handles.md
  - native/
  - electron/main.ts
  - electron/pty-holder.ts
  - electron/
  - electron/__tests__/
  - scripts/verify-native-modules.js
  - scripts/verify-packaged-native.js
  - scripts/
  - scripts/__tests__/
  - package.json
  - package-lock.json
  - vite.config.ts
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - .github/workflows/desktop-build.yml
  - .github/workflows/tests.yml
  - e2e/
  - docs/agent-guide/pty-holder.md
  - docs/agent-guide/terminal-server-recovery.md
  - docs/agent-guide/packaging-release-checks.md
  - docs/agent-guide/README.md
  - CLAUDE.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只在 win32 生效：macOS / Linux 不載入 addon、spawn / fork 參數與日誌逐字不變。Windows 上只在 Terminal Server 的啟動（`forkTerminalServer` 的 holder `spawn` 與沒有 holder 的 `fork`，唯一啟動點）前後切換：同步設為不可繼承 → spawn / fork → 立刻還原原本的旗標（只還原原本是可繼承的那些）。🔴 BAT 其他子程序（git、claude、codex、direct PTY、helper）的繼承行為不變；holder 的 pid 關係、`ipc`、env、cwd、`detached`、`windowsHide`、協定、接回判斷、安裝程式、升級 quit 不變。"
  - "🔴 fail open：addon 不存在、載入失敗、呼叫失敗 → 照現行行為 spawn / fork，記一行 debug log（只記原因代碼，不記 handle 值以外的內容；handle 值也不需要記），絕不讓 Terminal Server 起不來。"
  - "🔴 建置與相依政策（塔台決定，D291）：addon 原始碼放 repo（N-API、只用 kernel32 的 `GetStdHandle` / `GetStartupInfoW` 的 `lpReserved2` CRT handle / `GetHandleInformation` / `SetHandleInformation`），🔴 不提交預先編好的 `.node` 二進位、不新增帶 install script 的相依、不改 `allowScripts`、不加 postinstall；以明確的 npm script 在 Windows 打包前建置（CI 的 Windows job 加 step；node-gyp 若需要就列 devDependency，不經 `npm rebuild`）。不用 koffi / FFI。只支援 win32-x64（現行 Windows 只打 x64）。本機開發沒建 addon 時 fail open。"
  - "🔴 打包：addon 要進安裝檔且能從 asar 外載入（`asarUnpack` 或 extraResources，擇一並說明），`build.files` 白名單與 `verify-native-modules.js` / `verify-packaged-native.js`（win 才檢查）同步；不得用 `build.<platform>.files`（CLAUDE.md 紅線）。"
  - "🔴 W6 與 push：同 D289：可 push `origin main`（每次 push 前掃金鑰樣式、家目錄路徑、`.private/` 去識別化樣式，結果寫回報區；不 force-push）、觸發 `desktop-build.yml` ×2 與 `windows-upgrade-acceptance.yml`，各上限 5 次；不建 tag / Release、不跑 `pre-release.yml` / `release.yml`、不部署 Pages。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。不在本機安裝任何安裝檔、不碰本機 BAT 安裝版與它的 Terminal Server；L185 不開真的 claude / codex。"
  - "🔴 停止條件：MSVC / node-gyp 在 GitHub Windows runner 建不起來、或要改 Electron / Node 版本、或要改 holder 協定 / 安裝程式 → 停下回報 PARTIAL 與選項。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）；權杖與環境變數值不寫。"
---

# T0866 — BUG-213 修正：Windows stdio 繼承 N-API addon

## 元資料
- **工單編號**：T0866｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-05 09:43 (UTC+8)
- **規模**：L｜**決策**：D291｜**依賴**：T0865（查證）

## 背景
T0865 查證：Electron 45.2.1 主行程啟動時沒有像 Node 一樣呼叫 libuv `uv_disable_stdio_inheritance()`，libuv 在 Windows 以 `CreateProcessW(bInheritHandles = TRUE)` 起子程序，所以 BAT 從呼叫端繼承來的 pipe（Playwright 是 4 個）全部傳給 Terminal Server（holder `spawn` 與舊的 `fork` 都一樣）。BAT 結束後若保留 Terminal Server（升級、Recovery「保留」），帶 pipe 的呼叫端等不到 `close`。JS 層沒有可靠作法。使用者選 T0865 選項 A：加小型 N-API addon 修好再發 `0.7.5-pre.1`（D291）。

## 任務
1. addon：`native/` 下一個 win32 才建置 / 載入的 N-API 模組，提供「把繼承來的標準 handle 與 `lpReserved2` 列出的 CRT handle 設為不可繼承並回傳原狀」與「依回傳的原狀還原」兩個函式（命名自訂）。JS 包裝放 `electron/`（唯一實作，純函式部分可測），載入失敗回 null。
2. 接線：`forkTerminalServer`（`electron/main.ts`）在 holder `spawn` 與 `fork` 前後呼叫（同步、中間沒有 await），還原放 `finally`。
3. 建置 / 打包 / 驗證：npm script（例如 `build:native-win`）、三個會打 Windows 的 workflow 的 Windows job 在打包前跑它、`asarUnpack` 或 extraResources、白名單、`verify-native-modules.js`（win 才要求）、`verify-packaged-native.js` 加一項（win：addon 存在且能載入，可用 `ELECTRON_RUN_AS_NODE` 載入檢查）。`scripts/__tests__/asar-runtime-deps.test.mjs` 若受影響一併更新。
4. 測試：
   - 單元：win32 才接線、非 win32 不載入、fail open、還原在例外時也會執行、只還原原本可繼承的 handle（mock addon）。source guard：Terminal Server 的啟動點經這個包裝。
   - Windows 實測（開發機可用 repo 內 `node_modules/electron/dist/electron.exe`，比照 T0865 的 scratchpad 腳本，不跑安裝檔、不碰本機安裝版）：修正前 / 後，呼叫端以 pipe 啟動時拿到 `close` 的對照表。
   - W6 spec：加一項「以 pipe 啟動 BAT（不用 T0862 的 `stdio: 'ignore'` 繞法）、升級後呼叫端在 BAT 結束後拿到 `close`」，其餘情境維持 spawn＋CDP。
5. 重跑 W6：`desktop-build.yml` 打 A、B（建自含修正的 `main`），`windows-upgrade-acceptance.yml` 情境 1–9＋新檢查全 PASS。
6. 文件：`docs/agent-guide/pty-holder.md`（規則、addon、已知限制更新）、`terminal-server-recovery.md`「從 PTY holder 啟動」一句、`packaging-release-checks.md`（新的原生模組建置與檢查）、CLAUDE.md「Windows PTY holder」節與「Electron Runtime」native modules 段各補一兩行（≤ 100k 字元）。BUG-213 補修正 commit、狀態 `FIXED`。

## 驗收條件
- [ ] 修正前 / 後對照（呼叫端以 pipe 啟動時 `close` 的時間）
- [ ] W6 情境 1–9＋pipe 啟動檢查全 PASS（附 run id）
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功；desktop-build 的 Windows `verify-packaged-native` 綠
- [ ] CLAUDE.md ≤ 100k 字元（回報實際字元數）
- [ ] commit 只含本單範圍；BUG-213 → `FIXED`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **狀態**：DONE（驗收條件全部達成；BUG-213 → `FIXED`）
- **session_id**：b21e8033-bd6c-459c-85b8-ccd94c888815
- **開始 / 完成**：2026-11-05 09:45 / 10:23 (UTC+8)

### 落點檢查
- **結果**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3：`affects_files` 的路徑都在或有既存上層（`native/` 由本單建立，上層為 repo 根目錄以外的既存項目皆在）；C-2：工單沒有 `branch` 欄位（目前 `main`）。
- `CT_HOME` 未設定（不在 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE` = `yolo`；`CT_INTERACTIVE` 未設定；`BAT_REMOTE_TOKEN` 已設定。

### 修正前 / 後對照（任務 4 Windows 實測）
開發機、repo 內 Electron `45.2.1`（`node_modules/electron/dist/electron.exe`），腳本在 scratchpad（沒有進 repo）；沒有跑安裝檔、沒有碰本機 BAT 安裝版與它的 Terminal Server。呼叫端（Node）以 Playwright 的 stdio `['ignore','pipe','pipe','pipe','pipe']` 啟動 Electron，主行程以 holder 的同一組選項（`detached`、`['ignore','ignore','ignore','ipc']`、`windowsHide`、`cwd`）`spawn`（或 `fork`）一個 20 s 的 node 子程序，1.5 s 後 `app.exit(0)`，呼叫端等 `close` 上限 8 s：

| 啟動方式 | addon | 呼叫端 `exit` | 呼叫端 `close` |
|---|---|---|---|
| holder 路徑 `spawn` | 無（修正前） | 1611 ms | ❌ 8 s 內沒有 |
| holder 路徑 `spawn` | 有：`disable` 5 個、`restore` 5 個 | 1605 ms | ✅ 1605 ms |
| 沒有 holder 的 `fork` | 無（修正前） | 1603 ms | ❌ 8 s 內沒有 |
| 沒有 holder 的 `fork` | 有：5 / 5 | 1599 ms | ✅ 1599 ms |
| （對照）`spawn`、呼叫端 `stdio: 'ignore'` | 無 | 1606 ms | ✅ 1606 ms |

W6 實機（run `41954101041` 情境 1，A 以 pipe 啟動）：installer 結束 BAT 後，呼叫端在 `exit` 後 **5 ms** 拿到 `close`，holder 仍在跑；A 的日誌 `[stdio-inherit] Terminal Server started without 5 inherited handle(s); 5 restored`。

### 作法與設計決定
- **addon**：`native/win-stdio-inherit/`（`binding.gyp`、`src/win_stdio_inherit.c`，N-API `NAPI_VERSION=8`）。`disable()`：`GetStdHandle` ×3 與 `GetStartupInfoW` 的 `lpReserved2` CRT handle（與 libuv `uv_disable_stdio_inheritance` 同一組），可繼承的設成不可繼承，回傳改了哪些（BigInt 陣列，同一 handle 只列一次）；`restore(handles)` 只把這些設回可繼承。只用 `GetStdHandle` / `GetStartupInfoW` / `GetHandleInformation` / `SetHandleInformation`（單元測試以原始碼檢查）。不關閉、不複製、不換 handle。
- **JS 包裝（唯一實作）**：`electron/win-stdio-inherit.ts` `createWinStdioInheritGuard`（純函式、不 import electron）。非 win32 → `run(start)` 就是 `start()`（不找、不載入、不記日誌）。win32 → 第一次啟動才找 addon（打包版 `<resources>\native\`、開發模式 `native/win-stdio-inherit/build/Release/`，`process.dlopen`），`disable` → 啟動 → `finally` `restore`；fail open 原因代碼 `not-found` / `load-failed` / `bad-exports` / `disable-failed` / `bad-result` / `restore-failed`，日誌只記數量與代碼，不記 handle 值。
- **接線**：`electron/main.ts` 模組層 `terminalServerStdioGuard`；`forkTerminalServer` 的 `return terminalServerStdioGuard.run(() => spawn(spec.command, spec.args, spec.options))` 與 `return terminalServerStdioGuard.run(() => runWithoutCrashpadClient(() => fork(serverScript, [], terminalServerForkOptions(plan.stdio, env))))`；參數本身、holder 判斷、env、cwd、`ipc`、`detached`、`windowsHide` 不變。
- **打包方式（擇一）**：afterPack 複製到 `resources\native\`（屬 extraResources 類：asar 外）。不用 `build.win.extraResources` / `asarUnpack` 的理由：只在 win32 執行、沒建置或 arch 不是 x64 直接讓打包失敗、macOS / Linux 產物完全不變、不碰 `build.files` 白名單（addon 不在 `node_modules`、不進 app.asar），也不會碰到 `build.<platform>.files` 紅線。
- **建置**：`npm run build:native-win`（`scripts/build-native-win.mjs`；win32-x64 跑 `node-gyp rebuild --arch=x64 --release` 後載入並呼叫一次；win32 其他 arch exit 1；macOS / Linux exit 0）。`node-gyp` 以 devDependency 釘 `13.1.0`（repo 內原有的 11.5.0 是 `@electron/rebuild` 的傳遞相依，不認 Visual Studio 2026，本機建不起來；13.1.0 認 2019 / 2022 / 2026、`engines` `^24.15.0 || >=26`，CI 的 Node 24 可用）。沒有 install script、`allowScripts` 不變、沒有 postinstall、不提交 `.node`（`native/win-stdio-inherit/.gitignore` 擋 `build/`）。`npm run build` / `build:dir` 在 `verify-native-modules.js` 前呼叫它（非 Windows 是 no-op）。
- **lockfile**：加 `node-gyp` 13.1.0 後 npm 重新提升了一批 dev 相依（`tar` / `minipass` / `chownr` 等移到頂層、`@electron/rebuild` 底下改放 node-gyp 11.5.0 與其舊相依）；逐筆比對 `package-lock.json` 前後，**全部是 `dev: true`，沒有任何 production 套件新增、移除或改版**。

### 變更檔案
- 新增：`native/win-stdio-inherit/binding.gyp`、`native/win-stdio-inherit/src/win_stdio_inherit.c`、`native/win-stdio-inherit/.gitignore`、`electron/win-stdio-inherit.ts`、`electron/__tests__/win-stdio-inherit.test.ts`、`scripts/win-stdio-inherit.cjs`（build / afterPack / verify 共用的名稱與路徑）、`scripts/build-native-win.mjs`、`scripts/__tests__/win-stdio-inherit.test.mjs`。
- 修改：`electron/main.ts`（接線）、`scripts/version-manifest.cjs`（afterPack 呼叫 `afterPackWinStdioInherit`）、`scripts/verify-native-modules.js`（`verifyWinStdioInheritAddon`，win32 才要求）、`scripts/verify-packaged-native.js`（`win-stdio-inherit`：存在、PE x64、CLI 在 Windows host 以 `ELECTRON_RUN_AS_NODE` 載入並呼叫；mac / linux 產物不得有；`--skip-load-check` 只給測試）、`package.json`（`build:native-win`、`build` / `build:dir` 鏈、devDependency `node-gyp`）、`package-lock.json`、`.github/workflows/pre-release.yml` / `release.yml` / `desktop-build.yml`（Windows job 在 `@electron/rebuild` 後加 `Build Windows stdio-inheritance addon (BUG-213)`）、`e2e/t0862-windows-upgrade-acceptance.spec.ts`（情境 1 的 A 以 pipe 啟動並檢查 `close`）。
- 既有測試配合修改（意義不變）：`electron/__tests__/pty-holder.test.ts` / `installer-quit-holder.test.ts`（source guard 改比對包了 guard 的寫法）、`scripts/__tests__/asar-runtime-deps.test.mjs`（`DYNAMIC_REQUIRE_SITES` 登記 `win-stdio-inherit.ts`，套件清單為空）、`appimage-sandbox-launcher.test.mjs`（stub 新的 afterPack 步驟）、`verify-native-modules.test.mjs`（複製共用模組、win32 的假 addon、新測試）、`verify-packaged-native.test.mjs`（假產物帶 addon、win CLI 加 `--skip-load-check`、新測試）。
- 文件：`docs/agent-guide/pty-holder.md`（元件表、必守規則、新節「stdio 繼承」、已知限制、驗證清單、W6 情境 1）、`terminal-server-recovery.md`「從 PTY holder 啟動」一句、`packaging-release-checks.md`（新節「Windows stdio 繼承 addon」、CI 順序、動態載入清單）、`docs/agent-guide/README.md`、`CLAUDE.md`「Windows PTY holder」節一行、「Electron Runtime」native modules 段一句。
- `_ct-workorders/BUG-213-pty-holder-inherits-launcher-handles.md`：狀態 `FIXED`、補〈修正（T0866）〉。

### 驗證
| 關卡 | 結果 |
|---|---|
| `npm run typecheck` | 0（exit 0） |
| `npm run typecheck:electron` | 0（exit 0） |
| `npm run test:unit`（本機 Windows） | 全過：454 files passed / 3 skipped；8324 passed / 41 skipped（第一次跑 1 failed：`asar-runtime-deps` 要求登記新的 `process.dlopen` 位置，登記後全過） |
| `npm run test:legacy` | 全過：33 files、472 tests |
| `npx vite build` | 成功（bundle 含 guard） |
| `node scripts/build-native-win.mjs`（本機） | ✅ 建置＋載入＋`disable` / `restore` |
| `node scripts/verify-native-modules.js`（本機） | ✅（含 stdio-inheritance addon） |
| desktop-build A `41952687778` / B `41952701482`（`c19aaa72`） | 三平台 build job 全綠；Windows：`Build Windows stdio-inheritance addon (BUG-213)` 65 s、`afterPack (T0866)` 複製 110,592 bytes、`verify-packaged-native` ✅ `stdio-inheritance addon loads`；macOS / Linux 該步驟 skipped |
| W6 `windows-upgrade-acceptance.yml` `41954101041`（A / B 如上，spec `ccbad4c9`） | **情境 1–9 全 PASS**（34 / 35 / 29 / 29 / 12 / 14 / 39 / 12 / 20 項檢查，0 失敗）；情境 1 的兩項新檢查 PASS（見上方對照） |
| CLAUDE.md | 84,305 字元（≤ 100k） |

⚠️ desktop-build 兩個 run 的 `tests` job 失敗（所以 run 的 conclusion 是 failure；W6 只需要 `desktop-win` artifact，照常可用）：`electron/__tests__/terminal-server-protocol-v1.test.ts` 的 E 組兩項（`3 late ticks with the server process (pid file) alive …` 收到的 ping 2 < 12、`a pong ends the late run …`），兩個 run 相同。這是 T0857 加的真 socket＋fake timer 測試（`advance` 後只 `flush(20)`），在 Linux runner 上 socket 資料來不及到；本單沒有改 PtyManager / terminal-server，本機 Windows 這兩項通過。T0862 的 desktop-build 用 `checks=false`，所以之前沒在 CI 跑到。依範圍守護沒有修，列在〈後續建議〉。

### Commit
- 產品：`c19aaa72`（fix）、`6f986206`、`ccbad4c9`（docs），都已 push `origin main`（沒有 force）。
- 工單：本工單＋BUG-213（commit 訊息含 `T0866`）。
- push 前掃描（兩次，對象 `origin/main..HEAD` 的新增行）：`.private/` 對照表第五、六節的去識別化檢查樣式、家目錄路徑樣式、金鑰樣式（`_local-rules.md`「公開 repo 去識別化」）→ 皆 0 筆。
- workflow 觸發次數：`desktop-build.yml` 2 次、`windows-upgrade-acceptance.yml` 1 次（上限各 5）；沒有建 tag / Release、沒有跑 `pre-release.yml` / `release.yml`、沒有部署 Pages。

### 遭遇問題
- 本機只有 Visual Studio 2026，repo 原有的 node-gyp 11.5.0 不認 → 改用 devDependency `node-gyp` 13.1.0（見上）。
- Bash heredoc 內含單引號 / 反引號的 Python 補丁兩次被 shell 截斷 → 改把補丁寫成 scratchpad 檔再執行；一次 heredoc 的 `\\n` 跳脫讓 BUG-213 一行斷掉，已以 Edit 修正。
- desktop-build `tests` job 的既有計時測試失敗（見〈驗證〉的 ⚠️）。

### 互動紀錄
- [09:45] 開工（yolo；沒有向使用者提問，也沒有需要問塔台的問題）。
- [09:52] 本機建置 addon 成功；scratchpad 實測修正前 / 後對照完成。
- [10:02] 本機關卡全過，commit `c19aaa72` 並 push，觸發 desktop-build ×2。
- [10:13] desktop-build 完成（build 全綠、`tests` job 既有測試失敗），觸發 W6。
- [10:22] W6 情境 1–9 全 PASS。

### 後續建議
1. 修 `electron/__tests__/terminal-server-protocol-v1.test.ts` E 組在 Linux runner 上的計時競爭（例如 `advance` 每拍後等真實 I/O，或以 `vi.waitUntil` 等 `fake.received` 數量），否則 `pre-release.yml` / `release.yml` 的 test gate 會擋發版（`0.7.5-pre.1` 前需要處理）。
2. 可選：向 Electron 上游回報主行程啟動時沒呼叫 `uv_disable_stdio_inheritance()`（T0865 選項 E）；上游修了之後本 addon 就變成 no-op（`disable` 回傳空陣列）。
