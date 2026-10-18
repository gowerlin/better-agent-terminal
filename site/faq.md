---
title: 常見問題
description: 使用 Better Agent Terminal 時常遇到的狀況與處理方式：除錯日誌、Claude CLI 版本太舊、右鍵選單、macOS 版本、遠端伺服器套件、重開時的恢復提示。
---

# 常見問題

使用 BAT 時常遇到的狀況，以及怎麼處理。找不到你的問題，歡迎[回報](./contribute)。 {.ct-intro}

## 安裝與平台 {#platform}

### 為什麼 macOS 只有 Apple Silicon 版？ {#macos-apple-silicon}

BAT 內附 Claude Code、Codex、終端機元件與語音辨識，這些都是跟 CPU 架構綁在一起的程式。目前打包 macOS 版的建置環境只有 Apple Silicon 機器，打出來的 Intel 版裡，這些元件其實還是 Apple Silicon 版本，在 Intel Mac 上無法執行。

因此從 v0.6.0-pre.3 起只提供 Apple Silicon（arm64）版，需要 macOS 12（Monterey）以上。

## 使用中 {#using}

### 除錯日誌在哪裡？ {#logs}

除錯日誌預設開啟。每次啟動 BAT 寫一個檔案 `debug-<日期>-<時間>.log`，保留最近 10 個，放在資料目錄的 `Logs` 資料夾：

- **Windows**：`%APPDATA%\BetterAgentTerminal\Logs\`
- **macOS**：`~/Library/Application Support/BetterAgentTerminal/Logs/`
- **Linux**：`~/.config/BetterAgentTerminal/Logs/`

最快的方法是到 **設定 > 進階 > 除錯日誌**，按「開啟日誌資料夾」。同一個地方也可以關閉日誌或調整等級。回報問題時請附上最新的日誌檔，上傳前先看過一遍，遮掉你不想公開的內容。

### 程式開了滑鼠追蹤，右鍵選單叫不出來？ {#context-menu}

Claude Code CLI 這類全螢幕程式會開啟滑鼠追蹤，這時右鍵交給程式自己處理，BAT 的「複製 / 貼上」選單不會出現。

按住 **Shift** 再按右鍵，就能叫出 BAT 的選單。要複製文字：先按住 Shift 拖曳選取（macOS 改按 Option 拖曳），再用 Shift + 右鍵選「複製」。

### 重開 BAT 時，問我要「恢復 session」還是「重新開始」？ {#recovery}

BAT 的終端機跑在背景的 Terminal Server 裡。離開 BAT 時沒有勾選「結束 Terminal Server」（預設不勾），裡面的終端機會繼續執行；下次打開 BAT，就會看到「偵測到上次的終端 session」。

- **恢復 session**：接回原本還在執行的終端機，程序與輸出都還在。
- **重新開始**：結束舊的 Terminal Server 與裡面所有程序，分頁改開新的 shell。

在你回答之前，BAT 不會替這些分頁另外開 shell，所以不會出現重複的終端機。

## Claude Code {#claude}

### Claude 面板說 Claude Code 版本太舊？ {#cli-too-old}

新模型需要夠新的 Claude Code CLI。版本太舊時，API 會拒絕請求（錯誤代碼 `claude_code_version_too_old`），Claude 面板在錯誤訊息下方附上處理建議。擇一處理：

- **升級 BAT**：新版 BAT 內附較新的 Claude Code。
- **改用系統上的 claude**：到 **設定 > 進階 > Claude Runtime** 切換到 System，再升級你系統上的 claude。

暫時不想升級，也可以先改選其他模型。

## 遠端開發 {#remote}

### 設定遠端時下載不到伺服器套件？ {#server-bundle}

安裝檔不內建遠端用的伺服器套件。第一次設定 WSL、SSH 或 Docker 時，BAT 會從 GitHub 上對應版本的 `server-bundle-v<版號>` release 下載，下載過的會快取起來。

這台電腦連不到 GitHub 時：

1. 在能上網的電腦打開 [GitHub Releases](https://github.com/gowerlin/better-agent-terminal/releases)，找到 `server-bundle-v<版號>`，下載 `bat-server-<target>-v<版號>.tar.gz` 和同名的 `.sha256` 檔。需要哪個 target 與版號，設定精靈的錯誤畫面會列出。
2. 把兩個檔案複製到這台電腦，在設定精靈選「匯入本機 tarball…」，選取它們。

如果有內部鏡像站，也可以把環境變數 `BAT_SERVER_BUNDLE_BASE_URL` 設成鏡像網址，再重新啟動 BAT。

## Control Tower {#control-tower}

### Control Tower 去哪取得？ {#get-control-tower}

Control Tower 目前未公開提供。BAT 的派工、回報、提問與查詢介面是公開的，你可以用它們接上自己的流程，見 [BAT 提供的整合點](./control-tower#integration)。

不用 Control Tower，BAT 本身也能用，見[功能](./features)。
