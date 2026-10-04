---
schema_version: 1
schema_kind: workorder
id: T0387
title: "BUG-093 修復：SSH 精靈的「取得指紋 / 連線測試」改連遠端主機（tunnel 模式經 SSH tunnel，direct 模式直連），不再驗到本機 BAT"
type: implementation
status: TODO
priority: P1
sizing: M
created_at: "2026-10-04T23:34:17+08:00"
updated_at: "2026-10-04T23:34:17+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "BUG-093（修復對象）"
  - "T0381（fetch-fingerprint TLS 握手）/ T0382（主機可用埠探測）"
  - "BUG-088 / T0379（SSH 精靈絕對路徑）"
  - "PLAN-036 / T0386（平行研究，唯讀）"
affects_files:
  - src/components/setup-wizard/ssh-flow.ts
  - src/components/setup-wizard/steps/ssh/
  - src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts
  - src/components/setup-wizard/steps/wsl/connect-test.ts
  - src/components/setup-wizard/wizard-runner.ts
  - src/components/setup-wizard/__tests__/
  - electron/remote/ssh-tunnel.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不得連線、修改或安裝任何真實遠端主機；SSH 相關一律以 mock / 注入的 deps 測試。若本機有可用的 SSH 測試目標也**不要**自行使用，回報區列出建議的實機驗收步驟交使用者。"
  - "🔴 不得碰使用者 WSL 內的 `bat-server.service` / `~/.local/bat-server`（塔台 23:34 部署 T0385 JS 供使用者驗收中）。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設；host / user / port / path 等外部輸入沿用既有白名單驗證（CLAUDE.md Child Process Spawning）。禁用 shell-spawning exec API。"
  - "🔴 Renderer 不得 import Node builtin（D090）。"
  - "⚠️ WSL / Docker 精靈共用 `fetch-fingerprint` / `connect-test` 步驟：修改時 WSL / Docker 行為**不得改變**（以既有測試 + 新測試保證）。不 push。"
---

# T0387 — SSH 精靈驗證改連遠端

## 背景（BUG-093）

SSH 精靈直接共用 WSL 的 `fetchFingerprintStep` / `connectTestStep`，兩步都對 `127.0.0.1` / `localhost:<serverPort>` 操作，精靈期間又沒有建 SSH tunnel：

- `ssh-flow.ts:11` `DEFAULT_SERVER_PORT = 9876`，遠端 bat-server 起在 `ctx.serverPort`
- `connect-test.ts:33` `remote.testConnection('localhost', port, ...)`；fetch-fingerprint 經 `wsl:fetch-fingerprint` 對 `127.0.0.1:<serverPort>` 握手（T0381）
- `SshTunnel`（`electron/remote/ssh-tunnel.ts`）只在 `RemoteClient.doConnect()` 依 profile `useSshTunnel` 建立

⇒ 驗到的是**主機 BAT 自己**（9876 = 主機 RemoteServer），pin 進 profile 的指紋是本機的；之後經 tunnel 連遠端指紋不符被拒。

## 決策（塔台）

1. **tunnel 模式**（`sshTunnelMode: 'tunnel'`，預設）：在驗證步驟前以 `SshTunnel` 建 `-L <localPort>:127.0.0.1:<remotePort>`，fetch-fingerprint / connect-test 對 **tunnel 的 local 端**操作；精靈結束（完成 / 取消 / 失敗 / rollback）一律關閉 tunnel，不留孤兒 `ssh` 行程。local 埠由 `SshTunnel` 或 T0382 的可用埠探測決定，**不得**是 9876 或其他主機已占用埠
2. **direct 模式**：驗證對**遠端 host**（profile 的 remoteHost）的 `<remotePort>` 操作，不是 localhost
3. **指紋交叉核對**（建議做）：另經 ssh 讀遠端 `<dataDir>/server-cert.json`（或 bat-server 等價來源）算出的 fingerprint，與握手取得者比對；不符 → 步驟失敗並明確說明（可能連到了錯的伺服器）。若遠端讀不到該檔，降級為只用握手值 + `ctx.logger.warn`，不讓步驟失敗。Worker 若評估此項成本過高可略，回報區說明
4. 共用步驟的改法由 Worker 決定（參數化 target host/port、或 SSH 專用步驟包一層），但 **WSL / Docker 行為不變**
5. 寫入 profile 的 `remotePort` / `useSshTunnel` 等欄位語意不變（profile 存的是**遠端**埠；tunnel local 埠只在精靈期間使用）

## 驗收

- unit：tunnel 模式下 fetch-fingerprint / connect-test 打到 tunnel local 埠（非 9876、非 `ctx.serverPort` 的本機直連）；direct 模式打到遠端 host；精靈各結束路徑都關 tunnel；tunnel 建立失敗 → 步驟失敗並有可讀訊息；指紋交叉核對（若做）一致 / 不一致 / 讀不到三例；WSL / Docker 共用步驟回歸測試
- `npm run test:unit` 全綠（基線 **920**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **runtime 驗收（交使用者）**：回報區列出實機步驟（需一台可 SSH 的 Linux 主機）

## Sub-session 執行指示

1. 讀取本工單 + BUG-093 + T0381 / T0382 回報區（埠探測與指紋握手實作）
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
