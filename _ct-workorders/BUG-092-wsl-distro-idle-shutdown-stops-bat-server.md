---
schema_version: 1
schema_kind: bug
id: BUG-092
title: 沒有 `wsl.exe` 連線時 WSL 約 15 秒就關閉發行版，bat-server 跟著停止，WSL profile 連不上
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-04T22:18:57+08:00"
updated_at: "2026-10-04T22:57:09+08:00"
impact:
  - remote-wsl-profile
  - setup-wizard-wsl
links:
  fix_workorder: T0384
  research_workorder: T0380
  plan: PLAN-035
  related: [BUG-087, BUG-091]
---

# BUG-092 — WSL 發行版閒置關閉，bat-server 停止

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（精靈完成後的 WSL profile 基本上連不上；BAT 的 TCP 連線不算 WSL 活動） |
| 可重現 | 100%（T0380 實測，經使用者同意） |
| **狀態** | 🔧 FIXING（T0384） |
| 回報者 | 塔台 21:58 發現 `Ubuntu-24.04` 為 `Stopped`；T0380 證實 |

## 證據（T0380）

- `systemd-run --user ... sleep 180` 後立即返回 → 約 15 秒後發行版 `Stopped`（sleep 還在跑也一樣）
- 背景持有 `wsl -d Ubuntu-24.04 -- sleep 40` 期間一直 `Running`；holder 結束後約 15-18 秒關閉
- 時間吻合 `.wslconfig [general] instanceIdleTimeout`（預設 15000ms）；WSL 2.6.1 起 systemd 服務 active 也不算活動（WSL#13416，上游未回應）
- journal：22:06 那次開機結束時 systemd 正在 `Stopping bat-server.service`

## 修復方向（D128）

使用者裁決「只需 BAT 執行時可用」⇒ BAT 對每個 WSL profile 持有長駐 `wsl.exe -d <distro> -- sleep infinity`，跟 BAT 同生命週期；**不改**全機 `instanceIdleTimeout`。見 T0384。
