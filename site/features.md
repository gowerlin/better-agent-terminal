---
title: 功能
description: 不用 Control Tower，Better Agent Terminal 本身能做什麼：工作區、Agent 整合、狀態列、檔案與 Git、遠端開發，以及其他日常功能。
---

# 功能

只拿來開終端機和 Agent，BAT 也是順手的工作台。這一頁介紹 BAT 單獨使用時的功能；和 Control Tower 一起用時 BAT 另外提供什麼，見本頁最後一節「[和 Control Tower 一起用時](#control-tower)」。 {.ct-intro}

## 工作區管理 {#workspaces}

每個專案一個工作區，終端機、Agent 對話與設定各自分開，重開 BAT 後照樣還原。 {.ct-lead}

<!-- TODO(W3): 截圖 -->

- 工作區以標籤頁排列，可以拖放排序、分組；暫時用不到的可以封存。
- 每個工作區有自己的終端機、Agent 對話與環境變數。
- 在工作區上按右鍵開「工作區設定」，可以替這個工作區另選預設 Agent 與各 Agent 的啟動參數；沒設定的沿用全域設定。
- 把工作區拉出成獨立視窗，放到另一個螢幕；關掉獨立視窗後，它的分頁回到原本的視窗。
- 關掉 BAT 再打開，工作區與分頁都會還原。背景的 Terminal Server 還在執行時，你可以選擇接回原本還在跑的終端機（見[常見問題](./faq#recovery)）。

## AI Agent 整合 {#agents}

常用的 AI 程式 Agent 都能直接在 BAT 裡開，任何 CLI 工具也能加成自訂 Agent。 {.ct-lead}

<!-- TODO(W3): 截圖 -->

- **Claude Code 面板**：以 Claude Agent SDK 驅動，工具呼叫以結構化事件顯示，權限確認在面板裡回答，也能續接之前的對話。
- **Claude Code CLI**：在終端機分頁裡使用完整的 CLI。
- **Codex CLI**：支援沙箱與 YOLO 模式。
- **Gemini CLI**：支援沙箱模式。
- **GitHub Copilot CLI**。
- **自訂 CLI**：在設定裡把任何 CLI 工具加成 Agent。

BAT 內附 Claude Code CLI。想改用你系統上安裝的 claude，到 **設定 > 進階 > Claude Runtime** 切換；設定只影響之後新開的對話與終端機。

在終端機裡貼上時，BAT 看剪貼簿的內容決定怎麼貼：檔案貼成加了引號的路徑，圖片送給 Claude Code CLI，文字照常貼上。

### 用量限制自動繼續 {#usage-limit}

撞到 5 小時用量限制時，和 Control Tower 一起用、以 yolo 模式執行的分頁，可以在限制解除後自動接著做。這個功能預設關閉，在 **設定 > 進階 > 用量限制自動繼續** 打開。

- **Codex CLI**：限制解除後再等一下（預設 2 分鐘），自動輸入續行文字（預設「繼續」）並按 Enter。文字與等待時間都可以改。
- **Claude Code CLI**：CLI 自己會續行，BAT 不替它輸入。
- 其他分頁只顯示提示，不會自動動作。
- 等待期間你在分頁裡輸入，這次自動繼續就取消；連續自動送出最多 2 次。

## 指令自動完成 {#autocomplete}

在 Agent 面板或 PromptBox（終端機分頁的提示輸入框）輸入指令前綴，就會列出可用的指令讓你挑。 {.ct-lead}

- 前綴跟著 Agent 走：Claude Code 用 `/`，Codex 用 `$`。
- 可以用鍵盤上下選取。
- PromptBox 可以換行、貼圖片，用 ↑ ↓ 叫出之前送過的內容。

## 狀態列 {#status-line}

Claude Code 面板底部的狀態列：模型、Token、快取、費用一眼看清。 {.ct-lead}

<!-- TODO(W3): 截圖 -->

- 13 個項目可以各自開關、拖曳排序。
- 每個項目可以自訂顏色、靠左 / 置中 / 靠右對齊，項目之間可以加分隔符號。
- 整條狀態列也可以用一行範本字串設定。
- 可以定期查詢並顯示 Claude 的 API 用量。
- 設定位置：**設定 > 外觀 > 狀態列**。

## 檔案瀏覽器與 Git 檢視 {#files-git}

不離開 BAT 就能瀏覽檔案、看 Git 狀態。 {.ct-lead}

<!-- TODO(W3): 截圖 -->

- 內建檔案瀏覽器，瀏覽工作區裡的檔案。
- 內建 Git 檢視器。
- 終端機輸出裡的檔案路徑與網址可以直接點開。

## Snippet 與語音輸入 {#snippets-voice}

常打的指令存起來，一鍵插入；不想打字的時候，用說的。 {.ct-lead}

<!-- TODO(W3): 截圖 -->

### Snippet

- 側欄的「程式碼片段」存放常用的指令或提示詞，支援純文字與 Markdown，可以搜尋。
- 雙擊片段時要做什麼可以選：貼上至終端、傳送至 Agent，或複製到剪貼簿。
- 貼上至終端時，可以設定貼完自動按 Enter。

### 語音輸入 {#voice}

- 辨識在你的電腦上進行，使用 Whisper 模型。
- 在 **設定 > 語音** 下載模型：Tiny、Base、Small（推薦）、Medium，越大越準、也越慢。
- 辨識語言可以選繁體中文、英文或自動偵測；Whisper 的中文預設輸出簡體，可以自動轉成繁體。
- 有 GPU 時自動加速，也可以強制只用 CPU。
- 第一次使用時，作業系統會詢問麥克風權限：
  - **macOS**：拒絕之後，到「系統設定 > 隱私與安全性 > 麥克風」重新開啟。
  - **Windows**：系統關閉了麥克風存取時，到「設定 > 隱私 > 麥克風」開啟。
  - **Linux**：依 PulseAudio / PipeWire 的設定，通常不需要額外操作。

## 遠端開發：WSL、SSH、Docker {#remote-dev}

在同一個 BAT 視窗裡，驅動 WSL、Docker 容器或 SSH 主機（Linux、macOS）上的 Agent。 {.ct-lead}

<!-- TODO(W3): 截圖 -->

- 設定精靈一路帶你完成：在遠端安裝 BAT 伺服器套件、啟動服務、核對憑證指紋、驗證連線。
- 伺服器套件不包在安裝檔裡：第一次設定時從 GitHub 下載並快取。連不到 GitHub 時，可以匯入本機檔案（見[常見問題](./faq#server-bundle)）。
- 附加到 Agent 對話裡的檔案路徑，會自動在 Windows、Linux、macOS 的格式之間轉換。
- 可以同時開好幾個遠端環境的視窗，最多 8 個連線。
- 遠端 AI 工具面板偵測遠端有沒有 claude、codex、Node.js，缺的可以一鍵安裝（Node.js 透過 nvm）。

一步步的設定方式見[遠端開發](./remote/)：[WSL](./remote/wsl)、[SSH](./remote/ssh)、[Docker](./remote/docker)（Docker 目前需要自己建置伺服器映像）。

## 遠端存取 {#remote-access}

讓手機或另一台電腦上的 BAT 連進來，遠端操作這台主機上的 BAT。 {.ct-lead}

- 在設定裡產生 QR Code，讓手機掃描連線；另一台電腦上的 BAT 可以用 Remote Profile 連進來。
- 連線一律加密，使用自簽憑證：第一次連線時記下憑證指紋，之後指紋對不上就拒絕連線。
- 預設只接受本機連線。要跨網路連線，建議用 Tailscale：BAT 會自動偵測 Tailscale IP，也可以設定只在 Tailscale 網路上接受連線。
- 產生 QR Code 會啟動伺服器，讓外部連進這台主機；請先確認網路環境安全。

## Supervisor 模式 {#supervisor}

把一個終端機指定為 Supervisor，在同一個地方看著其他終端機。 {.ct-lead}

- 在終端機縮圖上按右鍵，選 **Set as Supervisor**，縮圖會標上 👁。
- Worker 面板列出其他終端機的 Agent 類型、狀態與最近的輸出。
- 可以直接對任何一個終端機送指令。
- 適合一個負責看、幾個負責做的流程，例如 TDD、Code Review、平行分派的任務。

這裡的「Worker」指被看著的終端機，和 Control Tower 的 Worker 分頁是兩回事。 {.ct-note}

## 其他功能 {#more}

- 終端機縮圖列：快速切換分頁。
- 自動檢查更新。
- 介面語言：繁體中文、英文、簡體中文。
- 深色主題。

常用的鍵盤快速鍵：

| 快速鍵 | 功能 |
|---|---|
| `Ctrl+T` | 新增終端機 |
| `Ctrl+W` | 關閉目前的終端機 |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | 切換到下一個 / 上一個終端機 |
| `Ctrl+1` ～ `Ctrl+9` | 切換到指定的終端機 |
| `Ctrl+K` | 清除終端機 |
| `Ctrl+Shift+V` | 貼上到終端機 |
| `Ctrl+N` | 新增工作區 |
| `Ctrl+Shift+N` | 開啟新視窗 |

## 和 Control Tower 一起用時 {#control-tower}

BAT 提供工單看板、派工用的分頁與查詢介面；流程本身由 Control Tower 決定。每一步怎麼運作，見 [BAT × Control Tower](./control-tower)。 {.ct-lead}

- **指揮塔面板**：側欄列出工單，有看板與 Sprint 總覽；工單狀態改變時會跳出通知。
- **一鍵執行**：在工單上按「執行」或「補救收尾」，交給 Agent 處理；指令前綴依預設 Agent 自動選 `/` 或 `$`。
- **塔台與 Worker 分頁**：派出的 Worker 分頁標題是「Claude CLI · Worker · T1024」這種格式，縮圖標出 ⚠️ 在等你、? 在等塔台答覆、✓ 已回報；塔台分頁的標題是「Claude CLI · Tower」。塔台收單後可以回收 Worker 分頁，你也可以按右鍵一次關掉所有已回報的 Worker 分頁。
- **BAT MCP**：BAT 開的 Claude Code CLI 與 Codex CLI 分頁自動掛上唯讀的查詢工具（查身分、列分頁、查狀態、讀輸出、等待、查 worktree 狀態），能查的範圍依分頁的權限而定。不需要時到 **設定 > 進階 > BAT MCP** 關閉。
- **worktree 隔離派工**：需要平行時，Worker 在 repo 外獨立的 git worktree 與分支上執行；合併前查得到每條分支的狀態。
