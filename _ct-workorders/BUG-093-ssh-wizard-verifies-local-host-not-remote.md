---
schema_version: 1
schema_kind: bug
id: BUG-093
title: SSH 精靈驗證階段沒有建 SSH tunnel，「取得 TLS 指紋」與「連線測試」連到本機 `localhost:9876`（主機 BAT 自己），pin 進 profile 的指紋是錯的
status: FIXED
severity: high
reproducibility: always
created_at: "2026-10-04T22:31:33+08:00"
updated_at: "2026-10-05T00:04:10+08:00"
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
| **狀態** | ✅ FIXED（T0387 `a3717a5`；待實機：需可 SSH 的 Linux 主機，步驟見 T0387 回報區） |
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

## 修復紀錄（T0387，`a3717a5`，塔台 2026-10-05 00:04 複驗）

- tunnel 模式：精靈期間開 `ssh -N -L <空閒 local>:localhost:<遠端埠>`，指紋握手與連線測試打 tunnel local 端（不會是主機 RemoteServer 埠）；各結束路徑與 app quit 都關 tunnel
- direct 模式：驗證打 `<sshHost>:<serverPort>`（但 direct 整條路徑另有 BUG-098）
- 指紋交叉核對：經 ssh 以 `sed` 只取遠端 `server-cert.json` 的 `fingerprint` 欄位（私鑰不傳回，塔台抽查 `electron/remote/ssh-wizard-verify.ts:269`）；不符 → `fingerprint-mismatch` 並清空 `ctx.fingerprint`
- 順帶修正：SSH 精靈原本從未取得 token（connect-test / write-profile 必失敗），改為同一次 ssh 讀明文 `server-token.json`
- 塔台複驗：965 tests / vite build exit 0 / tsc 40
- 衍生：BUG-098（direct 模式）、BUG-099（runner 取消不 rollback 失敗步驟）、BUG-100（`ssh.stopServer` / `uninstallBundle` 未實作）；新錯誤碼未加 ErrorMapper / i18n（走 fallback）；`tests/ssh-flow-journeys.test.ts` / `tests/ssh-wizard-e2e.test.ts`（不在 vitest include）HEAD 基線即失敗

