---
schema_version: 1
schema_kind: bug
id: BUG-092
title: 沒有 `wsl.exe` 連線時 WSL 約 15 秒就關閉發行版，bat-server 跟著停止，WSL profile 連不上
status: CLOSED
fix_commits: [5fa7a03]
fixed_at: "2026-10-04T23:06:29+08:00"
severity: high
reproducibility: always
created_at: "2026-10-04T22:18:57+08:00"
updated_at: "2026-10-04T23:46:46+08:00"
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
| **狀態** | 🚫 CLOSED（2026-10-04 23:46 實機：BAT 持有 `sleep infinity` holder，發行版持續 Running，profile 可連） |
| 回報者 | 塔台 21:58 發現 `Ubuntu-24.04` 為 `Stopped`；T0380 證實 |

## 證據（T0380）

- `systemd-run --user ... sleep 180` 後立即返回 → 約 15 秒後發行版 `Stopped`（sleep 還在跑也一樣）
- 背景持有 `wsl -d Ubuntu-24.04 -- sleep 40` 期間一直 `Running`；holder 結束後約 15-18 秒關閉
- 時間吻合 `.wslconfig [general] instanceIdleTimeout`（預設 15000ms）；WSL 2.6.1 起 systemd 服務 active 也不算活動（WSL#13416，上游未回應）
- journal：22:06 那次開機結束時 systemd 正在 `Stopping bat-server.service`

## 修復方向（D128）

使用者裁決「只需 BAT 執行時可用」⇒ BAT 對每個 WSL profile 持有長駐 `wsl.exe -d <distro> -- sleep infinity`，跟 BAT 同生命週期；**不改**全機 `instanceIdleTimeout`。見 T0384。

## FIXED 證據（2026-10-04 23:08 UTC+8，塔台驗收 T0384）

- 修復 commit：`5fa7a03`：新增 `electron/wsl-keepalive.ts`（`WslKeepAlive`），每個 WSL profile 的 distro 持有一個 `wsl.exe -d <distro> -- sleep infinity`；app ready 時依 profile 同步，profile 新增 / 刪除 / 更新 / 複製後重新同步；精靈寫完 unit 後立即 pin（`wsl:keep-alive`），rollback 時釋放；意外結束 backoff 2s→5s→15s→30s→60s，5 次後放棄；quit（`cleanupAllProcesses` + `will-quit`）全部 kill；非 Windows no-op；distro 過白名單
- 塔台複驗：`npm run test:unit` **905 passed / 63 files**（888 → 905）、`npx vite build` exit 0、`tsc --noEmit` **40**；`main.ts` diff 已檢視
- Worker 本機 runtime（真 `spawn`）：holder 持有 80 秒 `Ubuntu-24.04` 全程 `Running`；`stopAll()` 後 15 秒 `Stopped`，無殘留 `wsl.exe`
- **尚未實機**：安裝版完成 WSL 精靈後閒置 2 分鐘仍可連線
- 殘留風險（Phase 2 候選）：BAT 被強制終止時父 `wsl.exe` 會留下（需 Job Object）；精靈直接關視窗時 pin 留到 BAT 結束；holder 讓 WSL VM 在 BAT 執行期間常開（vmmem 未量測），建議 per-profile 開關或 lazy 模式；使用者手動 `wsl --shutdown` 後會被重新拉起
