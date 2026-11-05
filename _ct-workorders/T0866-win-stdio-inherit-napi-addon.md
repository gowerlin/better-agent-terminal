---
schema_version: 1
schema_kind: workorder
id: T0866
title: "BUG-213 修正：Windows N-API addon 在啟動 Terminal Server（holder 與 fork 兩條路）前把 BAT 主行程繼承來的 stdio handle 暫時設為不可繼承、啟動後還原；建置 / 打包 / 驗證接線；重跑 W6"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: L
created_at: "2026-11-05T09:43:34+0800"
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
- **工單編號**：T0866｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-05 09:43 (UTC+8)
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
