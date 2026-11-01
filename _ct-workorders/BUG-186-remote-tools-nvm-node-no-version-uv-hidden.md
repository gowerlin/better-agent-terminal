---
schema_version: 1
schema_kind: bug
id: BUG-186
title: "遠端工具偵測：nvm 安裝的 Node.js 顯示「無回應」（在 PATH 上找到但沒有回報版本），`~/.local/bin` 的 uv 顯示「伺服器：不可見」"
status: FIXING
severity: medium
reproducibility: unknown
created_at: "2026-11-01T22:33:34+0800"
updated_at: "2026-11-01T22:33:34+0800"
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
| 可重現 | 未確認（使用者 WSL 精靈一次；Docker / SSH 未查） |
| **狀態** | 🔧 FIXING（T0753） |
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
