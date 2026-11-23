---
schema_version: 1
schema_kind: workorder
id: T0885
title: "研究：BAT 改用 Rust 改寫的評估（Tauri / 全原生 Rust GUI / 局部改寫）：效能、記憶體、維護性，含最小 Tauri 與 Electron PoC 實測"
type: research
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: L
created_at: "2026-11-23T15:13:04+0800"
started_at: "2026-11-23T15:15:12+08:00"
updated_at: "2026-11-23T15:24:56+08:00"
completed_at: ""
session_ids:
  - "d8a7f5d6-964a-4507-b769-4dc2ac065dfc"
  - "7d09b103-324d-4e65-84de-7254e30f3c6b"
depends_on: []
related:
  - "PLAN-066；D304；PLAN-059（Herdr 對照，Rust 實作的終端工具，研究報告 Artifact「Herdr 對照 BAT」）；PLAN-065（Windows PTY holder，T0856 研究）；PLAN-053（Electron 45 升級）"
affects_files:
  - _ct-workorders/T0885-research-rust-rewrite-evaluation.md
  - experiments/rust-eval/**
renew_count: 0
isolation: worktree
workdir: worktree ct/T0885
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 worktree 隔離（使用者 2026-11-23 指示「用 worktree 實驗，勿直接改主線分支」，D305）：所有實驗在 BAT 建立的 worktree（分支 `ct/T0885`）進行，依 ct-exec § Worktree Isolation。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）；主 checkout 的產品檔、其他檔一律不改，不切分支、不 merge / rebase、不 push。"
  - "🔴 研究工單：不改產品程式（`src/`、`electron/`、`scripts/`、設定檔等，worktree 內也不改）。可讀程式、跑唯讀指令；量現行 BAT 基線需要的 `npm ci`、`npx vite build`、既有單元測試與 e2e fixture 都在 worktree 內跑（BAT 不幫 worktree 裝依賴）。"
  - "🔴 PoC 放在 worktree 內的 `experiments/rust-eval/`（`electron-min/`、`tauri-min/`、選做 `rust-pty-probe/`、量測腳本），commit 到分支 `ct/T0885` 以便重現；該目錄放自己的 `.gitignore` 擋 `node_modules/`、`target/`、`dist/` 等建置產物，不得 commit 建置產物或下載的 binary。可為 PoC 下載 npm 套件與 cargo crate（本機已有 cargo / rustc 1.99.1）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。分支是否合回主線由使用者另行決定，本單不合併。"
  - "🔴 不碰本機 BAT 安裝版與使用者正在用的 BAT：`C:\\Program Files\\BetterAgentTerminal` 只能列檔、讀大小與版本資訊；不得啟動、結束、重裝它或它的 Terminal Server。量測現行 BAT 基線時用 repo 建置＋隔離 userData（既有 e2e fixture `launchIsolated` 等），不得用使用者的 userData；查詢執行中程序只用唯讀指令（`Get-Process` / `Get-CimInstance Win32_Process`），回報不記命令列中的權杖或環境變數值。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台（研究型提問上限依 `research_max_questions`）。Git：主 checkout 只 commit 本工單檔；worktree 只 commit `experiments/rust-eval/` 下的檔（`git add <明確路徑>`，不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
  - "公開 repo（D176）：回報區與報告頁不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
  - "外部資料（其他專案的記憶體 / 效能數字、Tauri / WebView2 文件）只引用官方或可查證來源並附連結；實測與推論、外部數字分開標示。"
---

# T0885 — 研究：BAT 改用 Rust 改寫的評估（PLAN-066）

## 元資料

- **工單編號**：T0885
- **任務名稱**：研究：BAT 改用 Rust 改寫（Tauri / 全原生 / 局部改寫）的效能、記憶體、維護性
- **狀態**：IN_PROGRESS
- **類型**：research
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-23 15:13 (UTC+8)

## 研究目標

使用者看到許多開源專案改用 Rust 重寫，想評估 BAT 改用 Rust 的優缺點，重點是**效能、記憶體、維護性**，並據此決定要不要做、做哪一部分。結論要能直接拿來做決定。

使用者裁決的範圍（D304）：

- **三條路線都比**，以「維持現狀（Electron 45＋React＋Node 主行程）」為基準：
  1. **Tauri**：Rust 後端＋保留 React 前端，改用系統 WebView（Windows WebView2、macOS WKWebView、Linux WebKitGTK）。
  2. **全原生 Rust GUI**：整個 app 以 Rust 重寫、含 UI（類 WezTerm / Zed / Alacritty 的 GPU 繪圖）。
  3. **局部改寫**：Electron 不動，只把熱點模組改成 Rust（例：Terminal Server / PTY holder、helper 腳本、其他你找到值得改的）。
- **加做小型 PoC**（見下方〈PoC 規格〉）。
- 產出：工單回報區＋可分享的長文報告頁（私人 Artifact）。

## 已知資訊

- 現行架構與各功能的不變式都在 `CLAUDE.md` 與 `docs/agent-guide/`（索引 `docs/agent-guide/README.md`）。重要的 Node / Electron 綁定點（塔台整理，未逐一驗證）：
  - Claude 面板用 `@anthropic-ai/claude-agent-sdk`（TS，spawn 內嵌 claude CLI）；Codex 用 `@openai/codex-sdk`。
  - 終端：renderer xterm.js 5.5（含多個以真 xterm 實例測試的自訂行為：滾輪回報、`file:///` 連結、滑鼠追蹤、縮圖預覽）；主行程 `@lydell/node-pty`；Terminal Server（`electron/terminal-server/`，Windows 從 PTY holder 執行，PLAN-065）。
  - 語音：`@kutalia/whisper-node-addon`；Windows stdio 繼承 N-API addon（`native/win-stdio-inherit`）。
  - helper 腳本 `scripts/*.mjs`（`bat-terminal.mjs`、`bat-notify.mjs`、`bat-hook.mjs`、`bat-mcp.mjs`）在使用者 PTY 內以 node 執行，是 CT 的介面契約；headless `bat-server`（遠端 WSL / SSH / Docker）用同一套 Node 主行程程式碼打包成 server bundle。
  - Electron 專屬功能：多視窗 / detached 視窗、`safeStorage`、clipboard、NSIS 安裝與升級（PLAN-063 / 065）、AppImage sandbox 啟動器、單一實例鎖。
  - 測試：vitest 約 8414 個單元測試（461 檔）、legacy 測試、Playwright e2e。
- PLAN-059 研究過 Herdr（Rust 實作的終端工具，有 holder 架構），可參考 `_ct-workorders/PLAN-059-herdr-comparison-borrowings.md`。
- 本機有 cargo / rustc 1.99.1、rustup 1.29.3；node / npm 版本以實際查詢為準。

## 調查範圍與要回答的問題

1. **現況盤點**：BAT 各區塊的規模（renderer / main / terminal-server / remote / scripts / 測試，行數與檔數）、執行期依賴清單，並逐項標出「Rust 生態有沒有成熟替代」：xterm.js（Tauri 可沿用；全原生要 `alacritty_terminal` / `wezterm-term` 等＋自己的繪圖）、node-pty（`portable-pty` 等）、Claude Agent SDK / Codex SDK（有無 Rust 版；沒有時的做法：Node sidecar、自己實作 CLI 協定）、whisper（`whisper-rs`）、mermaid / markdown 預覽、WSS remote server、MCP shim、helper 腳本。每項給：替代品、成熟度、要自己補的部分。
2. **效能**：啟動時間、PTY 輸出吞吐、繪圖（xterm.js WebGL vs 原生 GPU）、IPC 開銷。哪些是 BAT 使用者真的感受得到的瓶頸，哪些換語言也不會變（例：瓶頸在 claude CLI / 網路）。
3. **記憶體**：現行 BAT 實測基線（見〈PoC 規格〉的情境），拆成主行程 / renderer / GPU / Terminal Server / 每個分頁增量。各路線的預期值（PoC 實測＋外部資料）。特別確認：Windows 上 Tauri 用的 WebView2 本身也是 Chromium，省下的記憶體實際有多少。
4. **安裝檔與磁碟**：現行三平台安裝檔大小（GitHub release 數字即可）vs 各路線預估。
5. **維護性**：
   - 程式碼與測試能沿用多少（React 前端、vitest 測試、`CLAUDE.md` 列的不變式與 source guard）。
   - 跨平台差異：WebView 版本不一致（尤其 Linux WebKitGTK）、全原生的 IME / 輔助技術 / 字型 / 中文輸入。
   - 開發與 CI：Rust 編譯時間、交叉編譯、簽章、自動更新、NSIS / dmg / AppImage 打包的替代（Tauri bundler）。
   - 與 CT 的介面契約（helper exit code、MCP、OSC、hook）能否原樣保持。
   - 人力：這個專案的開發模式（塔台＋AI Worker）下，TS 與 Rust 的修改成本差異。
6. **遷移成本與風險**：每條路線的規模估計（S / M / L / XL、約略工單數）、能否漸進（strangler：先換哪一塊、每一步都能發版）、對 No Regressions Policy 的風險、要重新驗證的既有功能清單。
7. **推薦**：三條路線＋維持現狀的總表（效能、記憶體、安裝檔、維護性、成本、風險），給推薦與理由；若結論是「不值得改寫」或「只值得局部改寫」，直接寫明。列出需要使用者裁決的事項。

## PoC 規格

- 位置：worktree 內的 `experiments/rust-eval/`，commit 到分支 `ct/T0885`（建置產物以該目錄的 `.gitignore` 擋掉，不合回主線）。平台：本機 Windows；macOS / Linux 以推論＋外部資料補充並標示。
- 做兩個**同規格**的最小原型，公平比較框架本身的開銷：
  - **A. 最小 Electron**：一個視窗、xterm.js、`node-pty`（或 `@lydell/node-pty`）起 shell、可開多個分頁。
  - **B. 最小 Tauri 2**：一個視窗、xterm.js、Rust 端 `portable-pty` 起 shell、可開多個分頁，輸出經 Tauri event / channel 送到前端。
  - （選做）**C. 局部改寫探針**：Rust 小程式持有 N 個 PTY（`portable-pty`），量它與現行 Node Terminal Server 持有同樣 N 個 PTY 的記憶體差異。
- 情境（A、B 與現行 BAT 都跑，各至少 3 次取中位數）：
  1. 啟動到 shell 提示出現的時間。
  2. 1 / 5 / 10 個閒置分頁的記憶體：整棵程序樹的 Private Bytes 與 Working Set 加總（含 WebView2 / Electron 子程序；shell 本身分開列）。
  3. 吞吐：單一分頁輸出約 50 MB 文字（例 `node -e` 或 pwsh 迴圈產生），量完成時間與期間 CPU。
- 量測腳本一起放在 PoC 目錄；回報區附原始數字表與量測方法，PoC 的限制（功能少很多、未最佳化）要寫明，不得把 PoC 數字直接當成「改寫後的 BAT」。

## 研究指引

- 先讀 `CLAUDE.md`、`docs/agent-guide/README.md`，再依需要讀各主題 docs；規模盤點用 `git ls-files` ＋行數統計即可，不必逐檔閱讀。
- 外部資料（Tauri / WebView2 記憶體、WezTerm / Alacritty / Zed / Warp 等）只引用官方或可查證來源，附連結與日期。
- 結論要可決策：每題給判斷與理由；實測、外部數字、推論三者分開標示。
- 可視需要用子代理平行處理（例：盤點與外部資料查找），但量測要在同一台機器、同一時段做完。

## 預期產出

- 回報區：
  - 〈調查結論〉逐題回答（附 `檔案:行` 或來源連結）。
  - 〈建議方向〉：四欄總表（維持現狀 / Tauri / 全原生 / 局部改寫）＋推薦。
  - 〈PoC 量測〉：原始數字表、方法、限制、重現步驟。
  - 〈建議下一步〉：若建議做，拆成 PLAN / 工單（範圍、規模、依賴、驗收方式）；另列需要使用者裁決的問題。
- 長文報告頁：依 `longform-report` skill 做成私人 Artifact（結論摘要在前、比較表、PoC 數字、風險、待裁決事項、參考連結），URL 寫在回報區。報告頁同樣遵守去識別化。

## 塔台補充（執行中 #1）

**時間**：2026-11-23 15:17 (UTC+8)
**補充內容**：
> 使用者指示「請用 worktree 實驗，勿直接改主線分支」（D305）。第一次派工（15:14，非隔離，session `d8a7f5d6…`）在主線 commit 開工紀錄 `0cca0327`，並在 repo 外建了 `<主 checkout 上層>/.bat-rust-poc/`（`electron-poc/`、`tauri-poc/`、`frontend/`、`holder-probe/`、`measure/`，含建置產物約 1.6 GB）。塔台 `--close-worker` 因分頁持續輸出被取消，由使用者手動關閉分頁；塔台確認沒有殘留的 PoC 程序。

**新指示**：
> 本單改為 `isolation: worktree` 重新派工：PoC 與所有實驗放在 worktree `experiments/rust-eval/`、commit 到分支 `ct/T0885`；主 checkout 只寫本工單檔。規則以 frontmatter `memory_overrides` 為準。
> 可沿用 `.bat-rust-poc/` 的**原始碼與量測腳本**：只複製原始檔（不含 `node_modules/`、`target/`、`dist/`、`*.csv` 等產物）到 `experiments/rust-eval/` 後檢查、修正路徑；舊的量測結果（例 `measure/smoke.csv`）一律重新量，不得沿用。搬完後刪除整個 `.bat-rust-poc/`，在回報區註明。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

- [15:24] 第二次派工（worktree 隔離，session `7d09b103…`）開工：工單已是 `IN_PROGRESS`（第一次派工 15:15 開工），保留原 `started_at`，視為續做。落點檢查：C-0 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS；C-1 工單在 `$CT_HOME/_ct-workorders/` 下 → PASS；C-3 `experiments/rust-eval/**` 含萬用字元、另一項是工單本身 → 不適用；C-2 frontmatter 無 `branch` 欄位。`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0885`、`CT_WORKTREE_BASE` = `cbec5f7fa18ba5170a9a6d41d5346ffce20457b3`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`、`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`、`BAT_REMOTE_TOKEN` 已設定。
- [15:24] 📥 開工時已讀到〈塔台補充（執行中 #1）〉（屬開工基線）：改在 worktree 做、沿用 `.bat-rust-poc/` 原始碼並重新量測、搬完刪除 `.bat-rust-poc/`。

### 調查結論

### 建議方向

### PoC 量測

### 建議下一步

### Renew 歷程

### 遭遇問題

### 方法論狀態回寫

### 回報時間
