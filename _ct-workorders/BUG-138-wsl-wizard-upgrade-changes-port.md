---
schema_version: 1
schema_kind: bug
id: BUG-138
title: "以 WSL 精靈升級執行中的 bat-server 會換 port：舊 server 仍佔原 port，`pickServerPort` 改挑下一個，既有 profile 連不上、精靈另建新 profile"
status: OPEN
severity: medium
reproducibility: always
created_at: "2026-10-16T02:45:47+0800"
updated_at: "2026-10-16T02:45:47+0800"
impact:
  - wsl-wizard
  - remote-profile
links:
  discovered_in: "T0550（WSL 實機驗收，0.6.1-pre.4）"
  related: [T0550, PLAN-035, PLAN-043]
---

# BUG-138 — WSL 精靈升級執行中的 server 會換 port

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（升級的唯一 UI 路徑就是重跑精靈；升級後原 profile 失效，需改用精靈新建的 profile。繞行：升級前先 `systemctl --user stop bat-server`） |
| 可重現 | 必現（同 distro 已有精靈安裝且執行中的 bat-server） |
| **狀態** | 📂 OPEN |
| 回報者 | T0550 Worker（塔台確認） |

## 現象

- **重現**：WSL 已有精靈裝的 bat-server 在跑（unit `BAT_SERVER_PORT=P`，例 9877）→ 再跑一次「新增 WSL 連線設定」精靈。
- **實際**：`write-systemd-unit` 步驟的 `wsl:pick-server-port` 在 Windows 端探測 P，舊 server 仍佔用（WSL Mirrored 模式共用 localhost）→ 回 `{"ok":true,"port":9878}`；unit 改寫為新 port 並重啟，原 profile（port P）連不上，精靈另建一個新 profile。
- **預期**：升級沿用同一個 port 與既有 profile（憑證 / token 檔本來就沿用）。

## 證據

- T0550 隔離實例實測 picker：`results.json` 的 `A0.port-while-running` = 9878（舊 server 佔 9877）；證據目錄 `C:\Users\Gower\AppData\Local\Temp\bat-t0550\evidence\`
- 程式碼路徑（T0550 Worker 指出，未修）：`electron/main.ts` `wsl:pick-server-port` → `electron/wsl-systemd.ts` `pickServerPort`，只排除本機 RemoteServer port，不認得「同一 distro 舊 bat-server 自己佔的 port」
- T0550 以先停 service 避開，精靈因此挑回 9877，使用者 profile `wsl-ubuntu-24-04` 不需變更

## 修正方向（待派工時定案）

- 偵測到同 distro 既有 unit 時沿用其 `BAT_SERVER_PORT`（或先停舊 service 再挑 port），並更新既有 profile 而非新建
- SSH 精靈是否有同樣問題需一併確認
