---
schema_version: 1
schema_kind: bug
id: BUG-094
title: WSL / SSH 遠端 profile 連得上 headless bat-server，但 `profile:load-snapshot` 無 handler，被錯報成「伺服器未執行或 6 秒未回應」
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-04T23:19:15+08:00"
updated_at: "2026-10-04T23:21:01+08:00"
impact:
  - remote-profile-headless
  - setup-wizard-wsl
links:
  fix_workorder: T0385
  related: [PLAN-035, BUG-092, BUG-091, BUG-090, BUG-093, PLAN-031]
---

# BUG-094 — headless bat-server 缺 `profile:load-snapshot`，遠端 profile 開不起來且錯誤訊息誤導

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（WSL 精靈全程通過後，建出來的 profile **無法開啟**——PLAN-035 Phase 1 的最終目的不可用） |
| 可重現 | 100%（2026-10-04 23:15 實機兩次：15:15:27Z / 15:15:46Z） |
| **狀態** | 🔧 FIXING（T0385） |
| 回報者 | 使用者實機驗收（PLAN-035 Phase 1，安裝版 = 本機 build `0.5.9-pre.4`，`app.asar` SHA-256 前綴 `3FDFEA76…`，與 `release\win-unpacked` 一致，含 T0384） |

## 現象

- 配置面板開啟「WSL Ubuntu-24.04（localhost:9877）」→ 對話框 `Remote profile unreachable` / `The remote server at localhost:9877 is not running or did not respond within 6 seconds.`
- 實際上伺服器**正在執行且可連線**（塔台 23:18 環境檢查）：
  - `Ubuntu-24.04` Running；BAT 持有 `wsl.exe -d Ubuntu-24.04 -- sleep infinity`（T0384 keep-alive 生效）
  - `bat-server.service` active (running)，`127.0.0.1:9877` LISTEN，`wslinfo --networking-mode` = `mirrored`
  - 主機 `Test-NetConnection 127.0.0.1 -Port 9877` = True（`::1` 失敗，伺服器只綁 IPv4，`localhost` 解析後 fallback 成功）
  - bat-server journal：多次 `Client authenticated` → `Client disconnected`

## 證據（BAT debug log `debug-20261004-231443.log`）

```
[RemoteClient] Connected to localhost:9877 (fingerprint=22:3A:E4:C7:4F:4F:7C:D1...)
[ERROR] [profile] remote profile wsl-ubuntu-24-04 snapshot fetch failed: No handler for channel: profile:load-snapshot
```

## 根因（塔台初判，Worker 需確認）

1. `profile:load-snapshot` 只在 Electron 主程式註冊（`electron/main.ts:3024` `registerHandler`），headless bat-server（`electron/remote/headless-entry.ts` / `scripts/bat-server.mjs`）沒有對應 handler → 遠端 profile 取 snapshot 必失敗
2. `electron/main.ts:1236-1238` catch-all 把**任何** invoke 錯誤都映射成 `remote-unreachable`，`showRemoteUnreachableDialog`（`:1248-1256`）一律顯示「未執行或 6 秒未回應」→ 連線成功但協定錯誤被誤報為連不上，誤導排查

## 待釐清

- headless server 的 profile 模型：無 profile store 時應回什麼（`null` snapshot → 空視窗？預設 workspace？）
- `remoteProfileId || 'default'` 對 headless 的語意
- 其他遠端 profile 會用到、但 headless 未註冊的 channel（一併盤點，避免下一個 `No handler`）
- 錯誤分類：連線失敗 / 認證或指紋失敗 / 協定（no handler）失敗應給不同訊息
