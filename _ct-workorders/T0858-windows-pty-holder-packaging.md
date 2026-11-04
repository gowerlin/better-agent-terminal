---
schema_version: 1
schema_kind: workorder
id: T0858
title: "PLAN-065 W2：Windows 打包 PTY holder（官方 node.exe 改名 bat-pty-holder.exe＋terminal-server.js＋node-pty win32＋manifest）與安裝程式複製到安裝目錄外"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: M
created_at: "2026-11-04T18:28:20+0800"
depends_on: []
related:
  - "PLAN-065；D286（D1 官方 node.exe、D2 依安裝範圍決定位置、D9 只保留在用的加目前版本）；T0856 回報區〈調查結論〉Q1 / Q2 / Q5 與〈建議下一步〉W2；T0823（`build/installer.nsh` `customCheckAppRunning` / `customInstall`）；T0546（安裝檔瘦身、不得用 `build.<platform>.files`）；`scripts/build-server-bundle.mjs`（下載 node 的前例）"
affects_files:
  - _ct-workorders/T0858-windows-pty-holder-packaging.md
  - package.json
  - scripts/
  - build/installer.nsh
  - scripts/verify-packaged-native.js
  - scripts/__tests__/
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - .github/workflows/desktop-build.yml
  - docs/agent-guide/packaging-release-checks.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只打包與複製檔案：不改 `forkTerminalServer`（W3 T0859）、不改 quit / 解除安裝流程（W4 T0860）。本單完成後 BAT 執行期行為完全不變（holder 檔案在，但沒人用）。不改 `CLAUDE.md`（W1 / W6 負責，避免並行衝突）。"
  - "🔴 只有 Windows：macOS / Linux 的安裝檔內容、打包步驟、`afterPack` 行為逐位元不變。平台差異用頂層 `files` / `extraResources` 的 `${os}` 巨集或 win 專屬 extraResources；🔴 不得使用 `build.<platform>.files`（T0546：會把整個 repo 打進 asar）。"
  - "🔴 供應鏈：Node 版本與 `node.exe` 的 SHA-256 **固定寫在 repo**（不在建置時抓 SHASUMS 當信任來源），下載後驗雜湊、不符就建置失敗；只從 nodejs.org 官方位址下載。新增建置腳本若需要 install script 或新的 npm 依賴 → 先問塔台（`allowScripts` 是政策）。"
  - "🔴 holder 位置與命名（T0856 Q1 / Q2）：執行檔不得叫 `BetterAgentTerminal.exe`；holder 根目錄的路徑**不得以安裝目錄路徑字串開頭**（NSIS 以 `StartsWith('$INSTDIR')` 前綴比對，結尾不帶 `\\`，`C:\\Program Files\\BetterAgentTerminal PTY Holder` 也會被比中）。per-user → `%LOCALAPPDATA%` 下、per-machine → `%ProgramFiles%` 下（D2，名稱可微調並寫明）。🔴 安裝程式不得刪除有程序在執行的版本目錄（mapped 的檔案會鎖住，刪一半會讓 holder 之後 fork 失敗）。"
  - "🔴 `build/installer.nsh`：T0823 的 `customCheckAppRunning` 與標記檔邏輯不變；新增的複製 / 清理放在 `customInstall`。child_process 規則照 CLAUDE.md。yolo：不得問使用者；問題問塔台。不發版、不 push、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。不碰本機 BAT 安裝版，不執行任何安裝檔。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0858 — PLAN-065 W2：Windows 打包 PTY holder

## 元資料
- **工單編號**：T0858｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 18:28 (UTC+8)
- **規模**：M｜**決策**：D286｜**依賴**：無（可與 T0857 並行）

## 背景
D286 D1：holder 用官方 `node.exe`（改名 `bat-pty-holder.exe`，OpenJS 簽章，約 90–100 MB），跑今天的 `terminal-server.js`。node-pty 是 N-API，不綁 Node ABI（T0856 E1 實測）。D2：依安裝範圍放在安裝目錄外、由安裝程式複製。D9：holder 根目錄只保留正在執行的版本加目前版本。細節見 T0856 回報區 Q1 / Q2 / Q5 與〈建議下一步〉W2。

## 任務
1. Windows 建置時取得固定版本的 Node（建議與 Electron 內建 Node 同一主版本 24.x 的最新 LTS 修補版，寫明理由），驗 SHA-256，改名 `bat-pty-holder.exe`。
2. 安裝檔內放 `resources\pty-holder\`：`bat-pty-holder.exe`、`terminal-server.js`（與 `dist-electron` 產物同一份）、node-pty win32 執行期需要的 JS 與 `.node`（`conpty.node`、`conpty_console_list.node` 及其 fork 的 agent 腳本）、`holder-manifest.json`（holder key、Node 版本、每個檔案的大小與 SHA-256）。holder key 的規則由你訂（建議 Node 版本＋holder 內容雜湊），寫進 docs。
3. `build/installer.nsh` `customInstall`：依安裝範圍把 `resources\pty-holder\` 複製到 holder 根目錄下的 key 目錄（已存在且 manifest 相符就略過）；清掉沒有程序在執行、也不是目前 key 的版本目錄（判斷方式比照範本的 `FIND_PROCESS` 以路徑前綴查程序）。
4. `scripts/verify-packaged-native.js` 加 `pty-holder` 檢查（檔案齊全、manifest 雜湊一致、exe 不叫 `BetterAgentTerminal.exe`）；需要的話 workflow 的 Windows step 跟著改。
5. 先用 `node.exe` 實際載入打包出來的 `resources\pty-holder\` 跑一次 `terminal-server.js`（scratchpad 或 `release\win-unpacked`，不碰安裝版）：能起 server、建一個 `cmd.exe` PTY、結束；回報列出指令與結果。
6. 測試：取得 Node 的腳本（雜湊不符失敗、版本固定）、manifest 產生、holder 路徑前綴檢查（含「安裝目錄名稱加字尾」的陷阱）、`installer.nsh` 的 source guard（比照 T0823 的寫法）。
7. 文件：`docs/agent-guide/packaging-release-checks.md` 新增「Windows PTY holder 打包」一節（Node 版本與升版步驟、雜湊、安裝檔大小變化）。

### 驗收條件
- [ ] `npm run build:dir`（或等效的 Windows 打包）產出 `resources\pty-holder\` 且 `verify-packaged-native.js` 通過；macOS / Linux 打包設定與產物不變（以設定 diff 與測試說明）
- [ ] 任務 5 的手動載入 PASS
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功；`scripts/__tests__/asar-runtime-deps.test.mjs` 不回歸
- [ ] 回報區列出：安裝檔大小變化、holder 根目錄的實際路徑規則、`customInstall` 的複製與清理流程；安裝程式的實際執行（複製、清理）列〈待 W6 驗收〉
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
