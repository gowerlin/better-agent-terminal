---
schema_version: 1
schema_kind: bug
id: BUG-186
title: "遠端工具偵測：nvm 安裝的 Node.js 顯示「無回應」（在 PATH 上找到但沒有回報版本），`~/.local/bin` 的 uv 顯示「伺服器：不可見」"
status: FIXED
severity: medium
reproducibility: always
created_at: "2026-11-01T22:33:34+0800"
updated_at: "2026-11-01T22:51:33+0800"
fixed_at: "2026-11-01T22:51:33+0800"
fix_commit: 0f021e67
impact:
  - remote-tools-detection
  - setup-wizard
links:
  discovered_in: "BUG-182 實機驗收時的 WSL 設定精靈完成畫面（2026-11-01，第一百零四 session，使用者截圖）"
  related: [T0753]
---

# BUG-186 — 遠端工具偵測：nvm node 無回應、uv 伺服器不可見

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（工具其實已安裝，偵測結果誤導使用者以為要重裝或伺服器用不到） |
| 可重現 | 必現（T0753 於使用者 WSL 唯讀重現；Docker 以測試容器重現 node 部分） |
| **狀態** | ✅ FIXED（T0753 `0f021e67`，待實機驗收：WSL server 升到含 T0753 探測的版本後重新檢查） |
| 回報者 | 使用者（安裝版 `v0.7.3-pre.1`，WSL `Ubuntu-24.04`，精靈升級 server 到 `0.7.3-pre.1` 時） |

## 現象

精靈完成畫面的工具清單（`RemoteToolsPanel`）：

- **Node.js**：狀態「無回應」（`error`），版本欄顯示 `nvm 0.40.8`，路徑 `<使用者家目錄>/.nvm/versions/node/v26.13.0/bin/node`，說明「在 PATH 上找到，但沒有回報版本。」，另標「伺服器：不可見」。
- **uv**：「已安裝」`0.12.23`，路徑 `<使用者家目錄>/.local/bin/uv`，但標「伺服器：不可見」。
- 同一畫面 ripgrep / Python 3 / curl / bash（`/usr/bin/*`）都是「已安裝」「伺服器：可見」。
- 預期：已安裝且可用的 node / uv 正確顯示版本；「伺服器：可見 / 不可見」反映 BAT server 開出的分頁實際能不能執行到該工具。

## 塔台唯讀觀察（未驗證）

- uv 直接執行 `~/.local/bin/uv --version` 正常回 `uv 0.12.23`。
- `bat-server.service`（systemd user unit）的 `Environment` 只有 `BAT_PORT` / `BAT_SERVER_PORT` / `BAT_DATA_DIR` / `BAT_SERVER_DATA_DIR`，沒有設定 PATH；推測「伺服器：不可見」是以 service 的 PATH 判斷（不含 `~/.local/bin`、nvm）。是否與分頁內 login shell 實際能用的 PATH 不同，待查。
- 相關程式（定位用）：`electron/remote-tools/probe-script.ts`、`electron/remote-tools/parse.ts`、`electron/handlers/remote-tools.ts`、`src/components/remote-tools/RemoteToolsPanel.tsx`；i18n `remoteTools.*`（`error` = 無回應、`hidden` = 伺服器：不可見、`versionError`）。

## 待查

- node 為什麼「沒有回報版本」：探測時的 PATH / 逾時 / 輸出格式 / nvm 環境（`NVM_DIR`、shell 初始化）。
- 「伺服器：可見」的判斷依據是否等於 server 開出的 PTY 實際能找到的工具。
- Docker、SSH 遠端的精靈 / 工具面板是否有同樣問題（使用者要求一併檢查）。

## 查證結論（T0753）

- **node「無回應」是正確偵測**：nvm 預設 `lts/*` = v26.13.0，該版需要 `libatomic.so.1`，distro 沒裝 `libatomic1`，`node --version` exit 127（`error while loading shared libraries: libatomic.so.1`）；使用者自己的登入互動 shell 同樣失敗（v24.22.0 正常）。不是 PATH、`NVM_DIR`、逾時或版本 regex 的問題。
- **「伺服器：不可見」對 server 程序是正確的**：判斷依據是 bat-server 程序自己的 PATH（systemd user unit 未設 PATH，繼承 `systemctl --user show-environment`，沒有 `~/.local/bin`、nvm）。server 開的終端分頁走 `bash -l -i`，找得到 uv。原 tooltip 只寫 Git / GitHub 面板，標記看起來像「伺服器用不到」。
- 三種遠端共用同一套探測：WSL / SSH Linux（systemd user unit）、SSH macOS（launchd 預設 PATH）、Docker（映像 PATH，root；`/root/.local/bin` 連登入 shell 也不在 PATH）。

## 修正（T0753 `0f021e67`，塔台 Q-1 / Q-2 皆採 A）

- 登入檢視探測：找到但 `--version` 沒有輸出的工具，另記 exit code，並（非 `timeout` 砍掉時）再跑一次只取動態載入器回報缺少的共用程式庫檔名（glibc / musl 句型；stderr 其餘內容不輸出）。`parseVersionError` 白名單後放進 `versionError`（只在 `error` 列）；面板顯示「在 PATH 上找到，但無法執行：缺少共用程式庫 libatomic.so.1」，沒有檔名時附 exit code。不從 nvm 路徑推版本。
- server 檢視：git / gh 比照 `resolveGitBinary` / `resolveGhBinary` 另掃 `/usr/bin`、`/usr/local/bin`、（macOS）`/opt/homebrew/bin`、`~/.local/bin`。
- 面板：登入檢視找得到（ok / too-old / error）但 server 程序找不到 → 「伺服器程序：不可見（終端分頁找得到）」；tooltip 寫明影響 Git / GitHub 面板與 Claude 面板的工具 / MCP。其他列文案不變。不改 server / unit / 容器的 PATH。
- 生效條件：探測在 server 端執行，`versionError` 與 git / gh 掃描要 server 升到含 T0753 的版本；新文案在新 client 上對舊 server 也生效。
