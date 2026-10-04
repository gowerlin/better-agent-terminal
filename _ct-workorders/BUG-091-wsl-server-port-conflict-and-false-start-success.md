---
schema_version: 1
schema_kind: bug
id: BUG-091
title: WSL bat-server 埠與主機 BAT RemoteServer 衝突（預設都是 9876），且 `startService` 把「啟動後立刻崩潰」誤判為成功
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-04T22:18:57+08:00"
updated_at: "2026-10-04T22:31:33+08:00"
impact:
  - setup-wizard-wsl
links:
  fix_workorder: T0382
  research_workorder: T0380
  plan: PLAN-035
  related: [BUG-090, BUG-087, BUG-089]
---

# BUG-091 — WSL 伺服器埠衝突 + 啟動成功誤判

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（Mirrored 模式下精靈裝好的服務必定起不來，但精靈顯示 ✓） |
| 可重現 | 100%（Mirrored 模式 + 主機 BAT RemoteServer 在預設埠；T0380 journal 實測 `EADDRINUSE 127.0.0.1:9876`） |
| **狀態** | 🔧 FIXING（T0382） |
| 回報者 | T0380 研究 |

## 現象

1. **埠衝突**：主機 BAT RemoteServer 預設自動啟動在 `127.0.0.1:9876`（`electron/main.ts` `REMOTE_PORT_DEFAULT`），WSL 精靈也把 bat-server 設在 `9876`（`src/components/setup-wizard/wsl-flow.ts:12` `DEFAULT_SERVER_PORT`）。Mirrored 模式共用 localhost ⇒ Linux 端綁定失敗 `EADDRINUSE`，systemd 無限重啟
2. **誤判成功**：`electron/wsl-systemd.ts` `startService()` 以 `is-active` 輪詢，第一次看到 `active` 就回成功；但 `Type=simple` 一 fork 就是 `active`，程序約 100ms 後以 status=1 退出 ⇒ 精靈第 5 步顯示 ✓（使用者截圖即如此）

## 修復方向（D128）

精靈在 Windows 端探測可用埠（排除主機 RemoteServer 實際使用的埠），寫進 unit 與 profile；`startService` 改為「持續 active N 秒且 `NRestarts` 沒有增加」或確認埠已在 listen 才算成功；偵測到 `EADDRINUSE` 回 `wsl-port-in-use` 錯誤碼。見 T0382。
