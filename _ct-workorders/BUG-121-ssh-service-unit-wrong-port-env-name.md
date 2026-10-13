---
schema_version: 1
schema_kind: bug
id: BUG-121
title: "SSH systemd unit / launchd plist 以 BAT_REMOTE_PORT / BAT_REMOTE_BIND 傳設定，但 bat-server 只讀 --port / BAT_SERVER_PORT 與 --bind-interface → 監聽 54321，wizard verify（:9876 / pgrep -x bat-server）失敗"
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-14T02:36:13+0800"
updated_at: "2026-10-14T02:36:13+0800"
impact:
  - remote-ssh
  - setup-wizard
links:
  discovered_in: T0510
  fix_workorder: T0511
  related: [BUG-120, T0505, BUG-098]
---

# BUG-121 — SSH service 傳錯 port / bind 設定名稱

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（BUG-120 繞過後仍擋住 SSH wizard 的 start-server 驗證；runtime tunnel 預期 remote 9876） |
| 可重現 | 必現（T0510 A6-0，繞過 BUG-120 後） |
| **狀態** | 🔧 FIXING（T0511） |
| 回報者 | 塔台（T0510 Worker 自動化實機驗收發現） |

## 證據（T0510 回報區「發現的產品缺陷」2）

- `electron/remote/ssh-start-server.ts:190-192`（systemd unit）與 `:228` 起（launchd plist）寫 `BAT_REMOTE_BIND` / `BAT_REMOTE_PORT`
- `scripts/bat-server.mjs:67`：port 只讀 `--port` / `BAT_SERVER_PORT`（預設 `54321`）；bind 只讀 `--bind-interface`
- 實測：`[bat-server] listening on 127.0.0.1:54321`；wizard verify `ss -tnlp | grep ':9876' || pgrep -x bat-server` 失敗（`verify-failed: active`）
- verify fallback `pgrep -x bat-server` 也比對不到（行程名為 node 的 `MainThread`）

## 預期 vs 實際

- 預期：bat-server 依 wizard 設定監聽 `localhost:9876`，verify 通過
- 實際：監聽 `127.0.0.1:54321`，verify 失敗
