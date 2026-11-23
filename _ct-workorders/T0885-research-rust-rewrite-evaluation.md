---
schema_version: 1
schema_kind: workorder
id: T0885
title: "研究：BAT 改用 Rust 改寫的評估（Tauri / 全原生 Rust GUI / 局部改寫）：效能、記憶體、維護性，含最小 Tauri 與 Electron PoC 實測"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: L
created_at: "2026-11-23T15:13:04+0800"
started_at: "2026-11-23T15:15:12+08:00"
updated_at: "2026-11-23T15:59:26+08:00"
completed_at: "2026-11-23T15:59:26+08:00"
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
- **狀態**：DONE
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

- **狀態**：DONE（研究範圍七題都已回答；PoC A / B / C 與現行 BAT 基線都在同一台 Windows 機器、同一時段量完，每個情境 3 次）
- **一句話結論**：不建議整體改寫（Tauri / 全原生）。如果記憶體確實是痛點，只建議把 Terminal Server／PTY holder 改成 Rust：10 個分頁時 BAT 約少 160 MB，介面與 CT 契約都不動。
- **報告頁**（私人 Artifact，需擁有者分享）：https://claude.ai/artifact/LYTj1aGEZKq2bu6SMm6ZqT
- **worktree 證據**：
  - `branch`：`ct/T0885`
  - `base_sha`：`cbec5f7fa18ba5170a9a6d41d5346ffce20457b3`
  - `validated_sha`：`dc2d3ed2285dab26cfd31679f8f9df18ef9126d3`
  - `head_sha`：`dc2d3ed2285dab26cfd31679f8f9df18ef9126d3`
  - 量測在 commit 前用的是同一份檔案；commit 之後沒有其他產品 commit。
  - `git -C "$CT_WORKTREE" status --porcelain` 為空。
- **產品 commit**：`dc2d3ed2 chore(T0885): Rust rewrite evaluation PoC and measurements`，只含 `experiments/rust-eval/` 下 34 個原始檔與 CSV，沒有建置產物；`src/`、`electron/`、`scripts/` 都沒改。
- **session_id**：7d09b103-324d-4e65-84de-7254e30f3c6b

### 互動紀錄

- [15:24] 第二次派工（worktree 隔離，session `7d09b103…`）開工：工單已是 `IN_PROGRESS`（第一次派工 15:15 開工），保留原 `started_at`，視為續做。落點檢查：C-0 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS；C-1 工單在 `$CT_HOME/_ct-workorders/` 下 → PASS；C-3 `experiments/rust-eval/**` 含萬用字元、另一項是工單本身 → 不適用；C-2 frontmatter 無 `branch` 欄位。`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0885`、`CT_WORKTREE_BASE` = `cbec5f7fa18ba5170a9a6d41d5346ffce20457b3`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`、`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`、`BAT_REMOTE_TOKEN` 已設定。
- [15:24] 📥 開工時已讀到〈塔台補充（執行中 #1）〉（屬開工基線）：改在 worktree 做、沿用 `.bat-rust-poc/` 原始碼並重新量測、搬完刪除 `.bat-rust-poc/`。

### 調查結論

標示：〔實測〕本次在本機跑過、可重現；〔事實〕附官方來源或程式碼位置；〔推論〕作者判斷，尚未驗證。外部資料查核日都是 2026-11-23。

**1. 現況盤點**

規模以 `git ls-files` 統計 .ts / .tsx / .js / .mjs / .cjs / .css 的行數（含空行與註解），base `cbec5f7f`。〔實測〕

| 區塊 | 檔數 | 行數 |
|---|---|---|
| renderer（`src/` 非測試） | 251 | 68,619 |
| 主行程（`electron/` 非測試，不含下兩列） | 103 | 42,634 |
| `electron/remote` + `remote-tools` | 39 | 12,538 |
| `electron/terminal-server` | 6 | 1,234 |
| `scripts/`（非測試） | 33 | 14,241 |
| 單元測試：src / electron / scripts | 201 / 233 / 32 | 41,539 / 62,018 / 9,089 |
| `tests/` legacy | 44 | 9,014 |
| `e2e/` | 128 | 42,450 |

- IPC 面積：`electron/preload.ts` 用到約 313 個 channel，主行程有 146 個 `ipcMain.handle/on`＋133 個 `registerHandler`。〔實測〕
- 有 75 個測試檔提到 source guard。〔實測〕
- `docs/agent-guide/` 共 46 檔。〔實測〕

執行期依賴（`package.json` `dependencies` + optional `@lydell/node-pty`）與 Rust 替代：

| 依賴 | 位置 | Rust 替代與成熟度 | 要自己補的 |
|---|---|---|---|
| xterm.js 5.5 ＋自訂行為 | `src/components/TerminalPanel.tsx:515`（canvas addon）、`src/lib/terminal-*.ts` | Tauri 照用。全原生用 `alacritty_terminal` 0.26.0（2026-04-06）；`wezterm-term` 不在 crates.io（API 回 404）〔事實〕 | 全原生要自己做繪圖、選取、連結、IME、無障礙；以真 xterm 實例測的行為全部重寫 |
| `@lydell/node-pty` 1.1.0 | Terminal Server、`electron/pty-manager.ts` | `portable-pty` 0.9.0，2025-02-11 發佈，3,130 萬次下載（https://crates.io/crates/portable-pty）〔事實〕。PoC B / C 在 Windows ConPTY 實測可用〔實測〕 | 程序樹結束（T0540）、Linux fd 防護（T0806）、ConPTY 游標位置查詢 |
| `@anthropic-ai/claude-agent-sdk` | `electron/claude-agent-manager.ts`（3,088 行）、`electron/handlers/claude.ts` | 沒有官方 Rust SDK。官方只支援 TypeScript 與 Python，其他語言請以 CLI `-p --output-format json` 執行（https://code.claude.com/docs/en/agent-sdk/overview）〔事實〕；社群 crate 都是包 CLI | BAT 依賴 `streamInput`、`command_lifecycle` 回執、`cancelAsyncMessage`（不在型別定義裡），實際上只能保留 Node sidecar |
| `@openai/codex-sdk` | `electron/codex-agent-manager.ts` | codex 本身是 Rust；`codex app-server` 提供 JSON-RPC over stdio，可產生 TS 與 JSON Schema，很多方法標 experimental（https://learn.chatgpt.com/docs/app-server）〔事實〕 | 改成直接講 app-server 協定 |
| `@kutalia/whisper-node-addon` | `electron/whisper-addon-loader.ts`、`voice-handler.ts` | `whisper-rs` 0.16.0（2026-03-12）〔事實〕 | GPU 偵測、可用性檢查（T0802） |
| `ws`、`selfsigned` | `electron/remote/remote-server.ts`、`certificate.ts` | `tokio-tungstenite` 0.30.0、`rustls` 0.23.46〔事實〕 | headless `bat-server` 與主行程共用程式碼，要一起改或保留 Node 版 |
| BAT MCP shim | `scripts/bat-mcp.mjs` | `rmcp` 3.11.0（MCP 官方 Rust SDK，2026-11-17）〔事實〕 | 不急：零依賴 node 腳本 |
| helper 腳本 | `scripts/bat-terminal.mjs`、`bat-notify.mjs`、`bat-hook.mjs` | 可改成 Rust binary，但 CT 以 `"${BAT_HELPER_NODE:-node}" … *.mjs` 呼叫〔事實〕 | 改的話要改 CT 契約；保留的話任何路線都要附 Node |
| mermaid / marked / highlight.js | `src/components/FileTreeMarkdown.tsx`、`src/utils/chat-markdown.ts` | Tauri 照用；全原生沒找到成熟的 mermaid 原生繪製〔推論〕 | 全原生要嵌 WebView 或放棄預覽 |
| `safeStorage`、單一實例、多視窗、NSIS 升級 | `electron/remote/secrets.ts`、`electron/main.ts`、`build/installer.nsh`（407 行） | Tauri 外掛（single-instance、updater，更新必須簽章）、NSIS／MSI bundler（https://v2.tauri.app/distribute/windows-installer/）〔事實〕 | PLAN-063 / 065 的 holder 升級邏輯要重新設計；「版本 N 的解除安裝程式發佈後改不了」的限制不變 |

安裝檔（`v0.7.5-pre.2`，2026-11-17，`gh release view`）〔事實〕：

| 檔案 | 大小 |
|---|---|
| NSIS | 339.9 MiB |
| win.zip | 506.3 MiB |
| dmg（arm64） | 356.1 MiB |
| AppImage | 337.6 MiB |

本機安裝版 `C:\Program Files\BetterAgentTerminal`（0.7.5.0，只列檔）共 1,342.5 MiB〔實測〕：

| 項目 | 大小 |
|---|---|
| `@openai/codex-win32-x64` | 479.4 MiB |
| `@anthropic-ai/claude-code` | 319.9 MiB |
| `BetterAgentTerminal.exe` | 238.5 MiB |
| `resources/pty-holder/bat-pty-holder.exe`（官方 `node.exe` 改名，`docs/agent-guide/pty-holder.md:20`） | 89.6 MiB |
| whisper | 79.1 MiB |
| `app.asar` | 15.3 MiB |

**2. 效能**〔實測〕

- **啟動**：在同一套量法下，Electron 與 Tauri 的啟動沒有差別。
  - PoC A：0.56–0.67 s；PoC B：0.58–0.62 s（啟動到 pwsh 提示）。
  - 時間主要花在 pwsh 自己啟動：PoC C 只持有 PTY 的程序在 0.30 s 就看到提示。
  - BAT 是 1.05–1.11 s，但包含 Playwright 啟動、還原工作區與 50 ms 輪詢，不能直接和 PoC 比。
- **吞吐**（約 50 MB，約 52 萬行）：

  | | 抵達前端 | 期間 CPU |
  |---|---|---|
  | PoC A | 1.47 s | 2.5 s |
  | PoC B | 1.94 s（xterm 解析完 2.23 s） | 7.8 s |
  | BAT | 1.99 s | 4.2 s |

  - Tauri 的 `Channel<String>` 比 Electron IPC 貴：CPU 是 3 倍，記憶體峰值高 280 MB（619 對 340 MB）。改成二進位通道可能改善〔推論〕。
  - 25–34 MB/s 遠高於 claude / codex 的實際輸出速度，使用者等待的瓶頸在模型與網路，換語言不會變〔推論〕。
- **繪圖**：BAT 用 canvas addon。原生 GPU 繪圖的差距沒有量（沒做原生 PoC）〔未確認〕。

**3. 記憶體**〔實測〕：框架＝整棵程序樹扣掉 shell，Private Bytes 中位數，1 / 5 / 10 個閒置 pwsh 分頁。

| | 1 分頁 | 5 分頁 | 10 分頁 | 每多一個分頁 |
|---|---|---|---|---|
| 現行 BAT | 374 MB | 506 MB | 654 MB | +31 MB |
| PoC A（Electron） | 197 MB | 403 MB | 572 MB | +42 MB |
| PoC B（Tauri） | 227 MB | 341 MB | 457 MB | +26 MB |

- **BAT 拆解**（10 個分頁）：

  | 程序 | 1 分頁 | 10 分頁 |
  |---|---|---|
  | 主行程 | 81 MB | 82 MB |
  | Terminal Server | 37 MB | 167 MB |
  | renderer＋GPU＋utility（推算） | 256 MB | 405 MB |
  | shell（pwsh＋conhost） | 35 MB | 353 MB |

  shell 在四條路線都一樣。
- **PoC C**（只持有 N 個 PTY）：

  | 持有者 | 1 PTY | 5 PTY | 10 PTY |
  |---|---|---|---|
  | Rust | 1.2 MB | 2.0 MB | 2.5 MB |
  | node.exe | 37.9 MB | 100.7 MB | 178.3 MB |
  | electron 當 node（BAT Terminal Server 的跑法） | 35.9 MB | 92.7 MB | 161.4 MB |

- **原因**：`@lydell/node-pty` 1.1.0 在 Windows 為每個 PTY 開一個 `worker_threads.Worker`（`node_modules/@lydell/node-pty/windowsConoutConnection.js:72`，`conoutSocketWorker.js`）〔事實〕。每個約 14 MB〔推論，依斜率〕。BAT Terminal Server 的曲線與 Node 探針一致。
- **WebView2 省多少**：
  - WebView2 是 Edge 的 Chromium。每個 app 用自己的使用者資料夾時，會有自己一組 browser、renderer、GPU 程序（https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance）〔事實〕。
  - PoC B 有 6 個 `msedgewebview2` 程序，1 個分頁時比 PoC A 多 30 MB〔實測〕。
  - 10 個分頁時 PoC B 少 115 MB。但 PoC A 扣掉 10 個 Worker（約 140 MB）後約 430 MB，反而比 PoC B 少〔推論〕。所以在 Windows 上 Tauri 省下的記憶體幾乎全來自 Rust 持有 PTY，WebView2 本身沒省。
- **外部數字**：只有 macOS 的比較，都不是 Windows：
  - Better Stack：Tauri 109 MB 對 Electron 128 MB（2026-07-20）。
  - pierophp/ai-mission-manager#135：RSS 353 對 482 MiB（2026-10-02）。
  - 沒找到方法可靠的 Windows / Linux 比較。

**4. 安裝檔與磁碟**

- 維持現狀：NSIS 340 MiB、安裝後 1,342 MiB〔事實〕〔實測〕。
- Tauri：
  - 省掉 Electron 執行期（`electron/dist` 357 MB 未壓縮）〔實測〕。
  - 但要加 Node sidecar：Claude SDK 與 helper 都需要，約 90 MB，同 holder 的 `node.exe`。
  - 內嵌 CLI 的 800 MiB 不變。
  - 估計安裝後約 1.05–1.1 GiB，安裝檔約少 60–80 MiB〔推論，未打包驗證〕。
  - WebView2 用 `downloadBootstrapper` 時不增加大小（https://v2.tauri.app/distribute/windows-installer/）〔事實〕。
- 全原生：同 Tauri，大小差距相近〔推論〕。
- 局部改寫：holder 的 `node.exe`（89.6 MiB）換成 Rust exe（PoC C 為 0.36 MB）〔實測〕；安裝檔約少 30 MiB 壓縮後大小〔推論，未打包驗證〕。
- PoC B 的 exe 是 8.1 MiB，已內嵌前端〔實測〕。

**5. 維護性**

- **沿用**：
  - Tauri 可沿用 renderer 6.9 萬行與 src 的 201 個測試檔，但主行程 5.6 萬行要改寫或包成 sidecar，約 313 個 IPC channel 要改成 Tauri command，electron 端 233 個測試檔重寫。
  - 全原生幾乎全部重寫：產品約 14 萬行、單元測試約 11 萬行。
  - 局部改寫只換 `electron/terminal-server/`（1,234 行）與 `scripts/pty-holder.cjs`（535 行）的執行內容，協定 v1 不變。〔實測：行數〕〔推論：沿用範圍〕
- **跨平台**：
  - Tauri Linux：WebKitGTK 的 CJK 輸入法候選窗位置錯誤（https://github.com/tauri-apps/tauri/issues/11412，2024-10 開、2026-08 仍重現）。wry 目前在 Linux 一律關閉 preedit（https://github.com/tauri-apps/wry/pull/1724，未合併）。
  - Tauri Linux：WebGL 可能無聲地走慢路徑（https://v2.tauri.app/develop/debug/linux-graphics/）。
  - Tauri macOS：WKWebView 只隨系統更新。〔事實〕
  - 全原生：GPUI pre-1.0、常有破壞性變更；egui 的 AccessKit 只有 Windows / macOS 且仍在開發〔事實〕。Warp 的螢幕閱讀器只支援 macOS，WezTerm 沒有解決〔事實〕。xterm.js 的 `screenReaderMode` 支援 NVDA / VoiceOver，全原生會失去它〔事實〕。
- **開發與 CI**：
  - PoC B 冷編譯 238 個 crate 花 1 分 29 秒，前端改一行後 LTO 重連結 57 秒，`target/` 1.2 GB〔實測〕。
  - Tauri 的 macOS .app / .dmg 要在 macOS 上打包；官方 CI 是各平台各自建置（https://v2.tauri.app/distribute/pipelines/github/）〔事實〕。
  - 局部改寫多一個小 crate，PoC C 冷編譯 6.6 秒〔實測〕，可比照 `native/win-stdio-inherit` 只在 Windows 打包前建置。
- **CT 契約**：
  - helper exit code、MCP、OSC 7501、hook 都在 Node 腳本與主行程裡。
  - 局部改寫完全不碰。
  - Tauri / 全原生可以保留腳本，但 app 仍要附 Node。改成 Rust binary 則要改 CT 契約〔推論〕。
- **人力**：
  - 塔台＋AI Worker 現有的工單模式、source guard、e2e fixture 都是 TypeScript。
  - Rust 的編譯期檢查讓錯誤更早出現，但每張工單的修改與 CI 時間都較長。
  - 這個差異沒有實測〔推論〕。

**6. 遷移成本與風險**〔推論〕

| 路線 | 規模 | 能否漸進 | No Regressions 風險 | 要重新驗證 |
|---|---|---|---|---|
| Tauri | XL（30 張以上工單） | 難：換殼是一次切換 | 高 | 幾乎全部 e2e、NSIS 升級（PLAN-063 / 065）、AppImage、遠端、Claude / Codex 面板 |
| 全原生 | XL 以上（實質新產品） | 否 | 很高 | 全部 |
| 局部改寫（Rust holder） | M（4–6 張） | 能：開關後面、舊 Node holder 當退路 | 中，集中在升級相容（R1）與 PTY 行為差異（R2） | T0540 程序樹、T0572 初始尺寸、T0578 Recovery、T0704 server recovery、T0857 協定 v1、T0861 接回、W6 升級驗收 |

**7. 推薦**：見〈建議方向〉。

### 建議方向

| 項目 | 維持現狀 | Tauri | 全原生 Rust | 局部改寫（Rust PTY holder） |
|---|---|---|---|---|
| 效能（啟動 / 吞吐） | 基準 | 啟動相同；吞吐 CPU ×3（PoC） | 未量測 | 不變，提示快約 0.1 s（10 PTY） |
| 記憶體（10 分頁框架 Private） | 654 MB | PoC −20%，但來源是 Rust 持有 PTY；1 分頁 +30 MB | 未量測 | 約 490 MB（−25%）〔推論〕 |
| 安裝檔 | 340 MiB | 約少 60–80 MiB〔推論〕 | 相近 | 約少 30 MiB〔推論〕 |
| 維護性 | 現況 | 主行程與 313 個 IPC 重建；Linux IME 退步；仍要 Node | 全部重寫；失去螢幕閱讀器支援 | 只多一個小 crate；協定與 CT 契約不變 |
| 成本 | 0 | XL | XL 以上 | M |
| 風險 | — | 高 | 很高 | 中（升級相容） |

**推薦**：

- 不做 Tauri 與全原生。
- 維持 Electron。
- 若使用者確認記憶體是痛點（Q1），再開「Rust PTY holder」PLAN。
- 開 PLAN 前，先研究 Node 端能否省下每個 PTY 的 Worker（Q3）。能省就不必引進 Rust。

**判斷理由**：

- BAT 的記憶體大頭是 shell（10 分頁 353 MB）與 Chromium（約 405 MB），換語言動不到。
- Windows 上 WebView2 也是 Chromium。
- Rust 唯一明顯的收益在 PTY 持有（每個 PTY 約 14 MB），這一塊已經是獨立程序，可以單獨替換。

### PoC 量測

**方法**（細節與重現步驟：分支 `ct/T0885` 的 `experiments/rust-eval/README.md`）

- **環境**：
  - Windows 11 開發機；node v26.13.1、npm 12.2.3、cargo / rustc 1.99.1、PowerShell 7。
  - 2026-11-23 15:39–15:52 一次跑完（`measure/run-all.ps1`）。
  - 每個情境 3 次、取中位數。
  - 同時有其他程式在跑，包含使用者的 BAT。
- **PoC A** `electron-min/`：Electron 45.2.1＋`@lydell/node-pty` 1.1.0。
- **PoC B** `tauri-min/`：Tauri 2＋`portable-pty` 0.9，輸出經 `tauri::ipc::Channel<String>`。
- **A / B 共用前端** `frontend/`：xterm 5.5＋canvas addon，與 BAT 相同。
- **PoC C** `rust-pty-probe/`：只持有 N 個 PTY 的程序。Rust 版是 `src/main.rs`；Node 版是 `node-probe.cjs`，分別用 node.exe 與 electron.exe（`ELECTRON_RUN_AS_NODE=1`）執行。
- **BAT 基線** `bat-baseline/bat-baseline.spec.ts`：
  - 用 repo 建置版（`npm ci`＋`npx vite build`），沿用 `e2e/fixtures/electron-isolation.ts` 的 `launchIsolated`。
  - 隔離 runtime / userData，env 去掉 `BAT_*` / `CT_*`。
  - 先啟動一次寫入 N 個分頁並關閉保留 userData，再量第二次啟動（還原 N 個分頁）。
  - 量完刪除 runtime userData。
- **shell**：一律 `pwsh.exe -ExecutionPolicy Bypass -NoLogo`（同 `electron/pty-manager.ts:1436`）。
- **記憶體**：提示出現後等 10 s，以 `Win32_Process` 父子關係走程序樹，加總 `PrivateMemorySize64` / `WorkingSet64`（`measure/tree-usage.ps1`）。名稱為 pwsh / conhost / OpenConsole / node / powershell / cmd 的程序及其子孫算 shell。
- **吞吐**：第 1 分頁提示後 1.5 s 輸入 `node gen.js`（約 50 MB），量到結束標記抵達前端（A / B 另量 xterm 解析完）與期間框架 CPU 秒。

**原始數字**（中位數；每次的原始列在 `results/*.csv`，彙整在 `results/summary.md`）

| App | 分頁 | 啟動→提示 ms | 全部提示 ms | 框架 Private MB | 框架 WS MB | 框架程序數 | shell Private MB | shell WS MB |
|---|---|---|---|---|---|---|---|---|
| BAT | 1 | 1054 | 1054 | 373.6 | 528.1 | 6 | 34.7 | 98.0 |
| BAT | 5 | 1114 | 1154 | 506.3 | 568.7 | 6 | 174.9 | 492.2 |
| BAT | 10 | 1103 | 1310 | 654.2 | 613.7 | 6 | 352.9 | 987.1 |
| PoC A Electron | 1 | 671 | 672 | 197.2 | 330.2 | 4 | 35.1 | 98.2 |
| PoC A Electron | 5 | 559 | 642 | 402.6 | 375.3 | 4 | 175.2 | 491.1 |
| PoC A Electron | 10 | 585 | 779 | 572.4 | 427.5 | 4 | 351.6 | 985.7 |
| PoC B Tauri | 1 | 583 | 584 | 227.0 | 369.1 | 7 | 35.2 | 98.3 |
| PoC B Tauri | 5 | 581 | 616 | 341.0 | 375.8 | 7 | 175.7 | 491.5 |
| PoC B Tauri | 10 | 620 | 691 | 457.1 | 381.3 | 7 | 352.0 | 985.4 |

BAT 主行程 / Terminal Server Private MB：

| 分頁 | 主行程 | Terminal Server |
|---|---|---|
| 1 | 81.1 | 37.4 |
| 5 | 81.5 | 94.2 |
| 10 | 82.0 | 166.9 |

| 吞吐（1 分頁，約 50 MB） | 抵達前端 ms | xterm 解析完 ms | 期間框架 CPU 秒 | 結束後框架 Private MB |
|---|---|---|---|---|
| BAT | 1991 | （量不到） | 4.24 | 633.9 |
| PoC A Electron | 1471 | 1472 | 2.47 | 340.2 |
| PoC B Tauri | 1935 | 2230 | 7.84 | 618.7 |

| PoC C 持有者 | PTY | 全部提示 ms | 持有者 Private MB | 持有者 WS MB | shell Private MB |
|---|---|---|---|---|---|
| Rust | 1 / 5 / 10 | 298 / 316 / 376 | 1.2 / 2.0 / 2.5 | 5.2 / 5.7 / 6.3 | 36.4 / 176.6 / 352.9 |
| node.exe | 1 / 5 / 10 | 319 / 377 / 483 | 37.9 / 100.7 / 178.3 | 66.6 / 105.4 / 151.8 | 36.4 / 177.9 / 353.1 |
| electron-as-node | 1 / 5 / 10 | 304 / 409 / 513 | 35.9 / 92.7 / 161.4 | 49.6 / 81.6 / 124.0 | 35.2 / 175.8 / 352.7 |

其他：

- PoC B release exe 8.1 MiB。
- PoC C Rust exe 0.36 MB。
- Electron 執行期目錄（`electron/dist`）357 MB。

**限制**

- PoC 只有視窗、xterm、PTY、分頁切換，沒有 React 與各面板。PoC 的數字是框架開銷，不能當成改寫後的 BAT。
- BAT 的啟動時間含 Playwright 與 50 ms 輪詢，和 PoC 的量法不同。
- 只量 Windows。node-pty 每個 PTY 一個 Worker 只出現在 Windows ConPTY 路徑，macOS / Linux 的增量未量（Q2）。
- Private Bytes 是已承諾的私有記憶體，WS 會重複計算共用頁面，兩者都列。
- 沒打 Tauri 安裝檔，安裝檔大小是推估。
- PoC C 的持有者自己回應 ConPTY 的游標位置查詢（`ESC[6n` → `ESC[1;1R`）；A / B 與 BAT 由 xterm.js 回應。

**重現**：在分支 `ct/T0885` 的 worktree 依 `experiments/rust-eval/README.md`。依序是：

1. `npm ci` 與 `npx vite build`。
2. `frontend` 執行 `npm ci` 與 `node build.mjs`。
3. `electron-min` 執行 `npm ci`。
4. `tauri-min` 與 `rust-pty-probe` 執行 `cargo build --release`。
5. 執行 `pwsh -NoProfile -File measure/run-all.ps1 -Runs 3`，約 14 分鐘。
6. 執行 `node measure/summarize.mjs`。

### 建議下一步

建議：

- Tauri 與全原生不開工單，PLAN-066 以「不做整體改寫」收斂。
- 局部改寫拆成以下工作；第 1 項的結論決定後面要不要做。

| # | 工作 | 類型 / 規模 | 依賴 | 驗收 |
|---|---|---|---|---|
| 1 | 研究：Node 端能否減少 node-pty 每個 PTY 的 Worker 成本（共用 Worker、上游議題），並量 macOS / Linux 的 Terminal Server 增量（Q2、Q3） | research / S | 無 | 有結論與數字；「能」→ 改走 Node 端，2–4 不做 |
| 2 | 設計：Rust Terminal Server 對照協定 v1（T0857）、PLAN-065 holder、T0861 接回，列出不變式、hello 欄位、升級 / 降級矩陣（Q4） | research / S | 1 的結論是「不能」 | BAT 塔台核准設計 |
| 3 | 實作：Rust Terminal Server（只在 Windows 打包版，開關預設關，Node holder 保留當退路） | 實作 / M（1–2 張） | 2 | 單元測試＋既有 Terminal Server e2e 通過 |
| 4 | 驗收：T0540 / T0572 / T0578 / T0704 / T0861 等 e2e、W6 `windows-upgrade-acceptance.yml`、1 / 5 / 10 分頁記憶體與本次基線比 | 驗收 / M | 3 | 記憶體達預期（10 分頁框架 < 520 MB）、無回歸 |

需要使用者裁決：

- **Q1**：平常同時開幾個分頁？記憶體或速度有沒有實際卡過？答案決定要不要做第 1–4 項。
- **Q5**：是否接受「Tauri / 全原生不做」？保留重新評估的條件：
  - Linux CJK 輸入法修好（tauri#11412 或 wry#1724 發佈）；
  - 而且有官方 Rust Agent SDK。
- **是否要把 `experiments/rust-eval/` 合回主線**：本單不合併。建議不合，留在分支當紀錄。

### Renew 歷程

（無）

### 遭遇問題

1. **舊 PoC 的 shell 路徑跳脫錯誤**：第一次派工的 `electron-poc/main.js` 用 `'C:\Program Files\PowerShell\7\pwsh.exe'`，其中 `\7` 被 JS 解成 BEL 字元。worktree 版改成 `String.raw`。舊的 `smoke.csv` 依塔台補充不沿用，全部重新量測。
2. **探針等不到 shell 提示**：Rust 與 electron-as-node 探針一開始等不到提示。
   - Rust：ConPTY 開頭送出游標位置查詢（`ESC[6n`），shell 等回覆；A / B 與 BAT 由 xterm.js 回覆。探針改成自己回 `ESC[1;1R`。
   - electron-as-node：GUI 子系統的 electron.exe 沒有 stdin，`stdin 'end'` 立刻觸發收尾，留下孤兒 pwsh。改成只靠計時器結束。
   - 冒煙測試留下的 6 個孤兒 pwsh / conhost：父程序都已不在，建立時間對應本 session 的三次 electron-node 冒煙（15:33:08、15:35:48、15:37:26）。已逐一確認後結束；正式量測沒有殘留。
3. **清理**：
   - 已刪除 `<主 checkout 上層>/.bat-rust-poc/`（約 1.6 GB）。刪除前確認沒有程序從該目錄執行。原始碼已搬進 `experiments/rust-eval/`，不含 `node_modules/`、`target/`、`dist/`、`*.csv`。
   - 已刪除我放在 worktree 外的 cargo 日誌與 `%TEMP%\t0885-poc` 暫存（mark 檔、PoC userData）。
   - 隔離 runtime 的 userData 都已由 `closeIsolated` 刪除（`BetterAgentTerminal-runtime-e2e-t0885*` 為 0）。
4. **本機安裝版**：只列檔、讀大小與版本，未啟動、結束或重裝；使用者的 BAT 與其 Terminal Server 未受影響。
5. **相依安裝**：worktree 依 CLAUDE.md 以 `npm ci` 安裝。結尾有 npm 12 的 install-scripts 警告（`electron-winstaller` 等），屬 CLAUDE.md 記載的預期。

### 子代理與 Workflow 使用

| 種類 | 數量 | 用途 | 唯讀（怎麼保證） | tokens | 備註 |
|---|---|---|---|---|---|
| 子代理（Agent 工具，general-purpose） | 1 | 背景查外部資料：WebView2 程序模型、Tauri 2 文件與已知問題、crate 版本、Agent SDK 語言支援、原生終端無障礙 | 是（prompt 明令不得寫入或修改任何檔案，只用網路搜尋 / 讀取） | 184,896（工具回報） | 主 agent 抽查：tauri#11412、WebView2 效能頁、portable-pty 版本與日期已在報告引用；macOS 外部比較標「外部數字」，不作為結論依據 |

### 方法論狀態回寫

不適用（本工單沒有 `methodology`）。

### 回報時間

2026-11-23T15:57:38+08:00
