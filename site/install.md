# 安裝

## 下載安裝檔

<DownloadLinks />

| 平台 | 檔案 | 說明 |
|------|------|------|
| Windows | `.exe` 安裝檔或 `.zip` 免安裝版 | Windows 10 / 11 |
| macOS | `.dmg` | 只支援 Apple Silicon（arm64），需要 macOS 12（Monterey）以上；自 v0.6.0-pre.3 起不再提供 Intel Mac 版 |
| Linux | `.AppImage` | 下載後加上執行權限即可啟動 |

所有版本都列在 [GitHub Releases](https://github.com/gowerlin/better-agent-terminal/releases)。桌面版的版號以 `v` 開頭；`server-bundle-v*` 是遠端開發用的伺服器套件，不是桌面安裝檔。

::: tip macOS 首次執行
macOS 第一次開啟時可能會被系統阻擋：到 **系統設定 > 隱私與安全性**，往下捲動，點選 **仍要打開**。
:::

Linux 的 AppImage 下載後先加上執行權限：

```bash
chmod +x BetterAgentTerminal-*.AppImage
./BetterAgentTerminal-*.AppImage
```

### Agent CLI

BAT 本身是終端機與 Agent 的整合介面。要使用 Gemini CLI、GitHub Copilot CLI、Codex CLI 等 Agent，請先依各工具的說明安裝並完成登入；也可以在設定中把任何 CLI 工具加成自訂 Agent。

## 從原始碼建置

需要 [Node.js](https://nodejs.org/) 20.19 以上。

```bash
git clone https://github.com/gowerlin/better-agent-terminal.git
cd better-agent-terminal
npm install
```

開發模式：

```bash
npm run dev
```

建置安裝檔：

```bash
npm run build
```

## 資料存放位置

BAT 的設定、工作區、遠端連線資料與日誌都放在同一個資料目錄：

| 平台 | 資料目錄 |
|------|------|
| Windows | `%APPDATA%\BetterAgentTerminal\` |
| macOS | `~/Library/Application Support/BetterAgentTerminal/` |
| Linux | `~/.config/BetterAgentTerminal/` |

裡面包含 `settings.json`（設定）、`windows.json`（視窗與工作區）、`profiles/`、`server-cert.json` / `server-token.json`（遠端存取）、`whisper-models/`（語音輸入模型）、`snippets.json`，以及 `Logs/`（除錯日誌）與 `Crashes/`（當機紀錄）。

::: warning 不要刪除 server-cert.json
`server-cert.json` 是遠端存取用的憑證。刪除後，已配對的遠端裝置都要重新配對。
:::

**另開一個獨立實例**：以 `--runtime=<N>` 參數或環境變數 `BAT_RUNTIME=<N>` 啟動，資料會放在同一層的 `BetterAgentTerminal-runtime-<N>/`，與預設實例完全分開。

## 從舊版升級

從 v0.6.0-pre.3 以前的版本升級時，BAT 第一次啟動會自動把舊資料目錄（小寫的 `better-agent-terminal/`）整理到新的資料目錄，只執行一次：

- **遠端存取權杖**沿用，已配對的遠端裝置不需重新配對（若搬移失敗，權杖會重新產生，遠端裝置需要重新配對）。
- **Snippets** 會合併：以新目錄為主，舊檔中不重複的項目附加在後；合併前會先備份。
- **對話訊息快取**會搬到新目錄。
- **舊日誌不搬**：新日誌寫到新目錄的 `Logs/`，舊日誌留在 `better-agent-terminal/Logs/`。
- 以 `--runtime=<N>` 啟動的實例，整個目錄會改名為 `BetterAgentTerminal-runtime-<N>/`。

舊的 `better-agent-terminal/` 目錄不會被刪除。確定不需要降版回舊版後，可以自行刪除。

::: danger 不要同時執行新舊兩個版本
新舊版的單一實例鎖在不同目錄，無法互相排除，會同時寫入同一份 `settings.json`。
:::

降版回舊版時，預設實例的設定與遠端存取權杖都可以沿用，但在新版新增或修改的 snippets 舊版看不到。`--runtime=<N>` 實例的目錄已改名，降版後要手動把 `BetterAgentTerminal-runtime-<N>/` 改回 `better-agent-terminal-runtime-<N>/`。

## 除錯日誌

除錯日誌**預設開啟**，寫在資料目錄下的 `Logs/debug-<日期-時間>.log`，每次啟動一個檔案，保留最近 10 個。

到 **設定 > 進階 > 除錯日誌** 可以關閉日誌、調整等級，或按「開啟日誌資料夾」直接打開目錄。回報問題時，請附上最新的日誌檔。

## 語音輸入的麥克風權限

- **macOS**：第一次使用語音輸入時會跳出系統權限對話框；如果拒絕了，可以到 **系統設定 > 隱私與安全性 > 麥克風** 重新允許。
- **Windows**：第一次使用時會跳出權限對話框；如果系統層的麥克風存取是關閉的，請到 **設定 > 隱私 > 麥克風** 開啟。
- **Linux**：依 PulseAudio / PipeWire 設定，通常不需額外操作；無法使用時請確認 `pactl` / `pipewire` 服務正常運作。
