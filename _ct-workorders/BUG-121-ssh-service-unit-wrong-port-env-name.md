---
schema_version: 1
schema_kind: bug
id: BUG-121
title: "SSH systemd unit / launchd plist 以 BAT_REMOTE_PORT / BAT_REMOTE_BIND 傳設定，但 bat-server 只讀 --port / BAT_SERVER_PORT 與 --bind-interface → 監聽 54321，wizard verify（:9876 / pgrep -x bat-server）失敗"
status: FIXED
severity: high
reproducibility: always
created_at: "2026-10-14T02:36:13+0800"
updated_at: "2026-10-14T02:52:53+0800"
fixed_at: "2026-10-14T02:52:53+0800"
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
| **狀態** | ✅ FIXED（T0511） |
| 回報者 | 塔台（T0510 Worker 自動化實機驗收發現） |

## 證據（T0510 回報區「發現的產品缺陷」2）

- `electron/remote/ssh-start-server.ts:190-192`（systemd unit）與 `:228` 起（launchd plist）寫 `BAT_REMOTE_BIND` / `BAT_REMOTE_PORT`
- `scripts/bat-server.mjs:67`：port 只讀 `--port` / `BAT_SERVER_PORT`（預設 `54321`）；bind 只讀 `--bind-interface`
- 實測：`[bat-server] listening on 127.0.0.1:54321`；wizard verify `ss -tnlp | grep ':9876' || pgrep -x bat-server` 失敗（`verify-failed: active`）
- verify fallback `pgrep -x bat-server` 也比對不到（行程名為 node 的 `MainThread`）

## 預期 vs 實際

- 預期：bat-server 依 wizard 設定監聽 `localhost:9876`，verify 通過
- 實際：監聽 `127.0.0.1:54321`，verify 失敗

## 修正摘要（T0511）

- `electron/remote/ssh-start-server.ts`
  - systemd `ExecStart=<installPath>/bin/bat-server --port <serverPort> --bind-interface localhost`；launchd `ProgramArguments` 同四個參數；移除 `BAT_REMOTE_PORT` / `BAT_REMOTE_BIND`（bat-server 從不讀）。`--port` / `--bind-interface` 自 T0272（第一版 bat-server.mjs）即存在，已部署的舊 bundle 不需更新即可吃到；bind 沒有 env 對應，只能用參數
  - `serverPort` 先驗整數 1–65535（不合法在任何 ssh 之前 throw）
  - enable：systemd `enable` + `restart`（原 `enable --now` 對已在跑的服務不重啟，重跑 wizard 會留舊行程 / 舊參數；與 WSL `wsl-systemd.ts` 一致）；launchd 先 `unload`（忽略錯誤）再 `load -w`
  - verify：`sh -c` 迴圈最多 20 秒；systemd 要求 `is-active` = active 且 MainPID 擁有 `/proc/net/tcp{,6}` 上該埠的 LISTEN socket；launchd 要求 `launchctl list` 的 PID 以 `lsof -a -p <pid> -iTCP:<port> -sTCP:LISTEN` 監聽。移除 `pgrep -x bat-server`（行程是 node / `MainThread`，永遠比對不到）與不看擁有者的 `ss | grep`
- 起源：T0286（`70417d4`，2026-04-26）即寫 `BAT_REMOTE_PORT`、verify 用 `pgrep -x`；首個發佈版 `v0.4.1`
- 驗證：單元 `electron/remote/__tests__/ssh-bundle-layout-and-port.test.ts`（HEAD 上 red）；e2e A6-0：`ExecStart=… --port 9876 --bind-interface localhost`、`LISTEN … 127.0.0.1:9876 … users:(("MainThread",pid=178,fd=21))`、journal `[bat-server] listening on 127.0.0.1:9876`
