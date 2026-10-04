---
schema_version: 1
schema_kind: bug
id: BUG-093
title: SSH 精靈驗證階段沒有建 SSH tunnel，「取得 TLS 指紋」與「連線測試」連到本機 `localhost:9876`（主機 BAT 自己），pin 進 profile 的指紋是錯的
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-04T22:31:33+08:00"
updated_at: "2026-10-04T23:34:17+08:00"
impact:
  - setup-wizard-ssh
links:
  fix_workorder: T0387
  related: [BUG-090, BUG-091, BUG-088, T0381]
---

# BUG-093 — SSH 精靈驗證到的是本機，不是遠端主機

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（SSH profile 會被 pin 上主機 BAT 自己的指紋；之後經 tunnel 連遠端時指紋不符被拒，或更糟——在本機無服務時驗證失敗） |
| 可重現 | 推定 100%（程式碼閱讀；塔台 2026-10-04 22:31 複核） |
| **狀態** | 🔧 FIXING（T0387） |
| 回報者 | T0381 Worker（回報區「SSH / Docker 實際取指紋路徑」） |

## 現象（程式碼證據）

- `src/components/setup-wizard/ssh-flow.ts:11` `DEFAULT_SERVER_PORT = 9876`，`:44` / `:49` 設 `ctx.serverPort`
- `ssh/start-server.ts` 把**遠端** bat-server 起在 `ctx.serverPort`
- SSH flow 直接共用 WSL 的 `fetchFingerprintStep`（`:7` / `:31`）與 `connectTestStep`（`:6` / `:32`）：
  - fetch-fingerprint 經 `wsl:fetch-fingerprint` 對 `127.0.0.1:<serverPort>` 握手（T0381 後）
  - connect-test（`steps/wsl/connect-test.ts:33`）呼叫 `remote.testConnection('localhost', port, ...)`
- 精靈期間沒有建立 SSH tunnel：`SshTunnel`（`electron/remote/ssh-tunnel.ts`）只在 `RemoteClient.doConnect()` 依 profile 的 `useSshTunnel` 建立
- ⇒ 兩步都連到**本機** `localhost:9876` = 主機 BAT 自己的 RemoteServer（BUG-091 同一個埠），取到並 pin 的是本機指紋

## 修復方向（待定）

- 驗證步驟前開 `ssh -L <localPort>:127.0.0.1:<remotePort>`（沿用 `SshTunnel`），fetch-fingerprint / connect-test 對 tunnel 的 local 端操作；或改經 ssh 讀遠端 `server-cert.json` 的 fingerprint，再以 tunnel 做連線測試
- local 端埠的選擇與 T0382 的「Windows 端可用埠探測」共用
- 與 BUG-088 的實機驗收一起做
