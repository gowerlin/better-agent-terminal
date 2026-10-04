---
schema_version: 1
schema_kind: workorder
id: T0381
title: "BUG-090 修復：精靈「取得 TLS 指紋」改用 TLS 握手取憑證指紋 + 全路徑 timeout（WSL / SSH / Docker 共用）"
type: implementation
status: DONE
priority: P1
sizing: M
created_at: "2026-10-04T22:18:57+08:00"
updated_at: "2026-10-04T22:30:25+08:00"
started_at: "2026-10-04T22:22:36+08:00"
completed_at: "2026-10-04T22:30:25+08:00"
target_version: next
depends_on: []
related:
  - "BUG-090（修復對象）"
  - "T0380 回報區 目標 6 P1-a"
  - "D128"
  - "PLAN-035 Phase 1"
affects_files:
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts
  - src/components/setup-wizard/ssh-flow.ts
  - src/components/setup-wizard/docker-flow.ts
  - electron/__tests__/
  - src/components/setup-wizard/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設；distro / port 等外部輸入先過既有白名單驗證（CLAUDE.md Child Process Spawning）。禁用 shell-spawning exec API。"
  - "🔴 不得改使用者 `%USERPROFILE%/.wslconfig`、不得 `wsl --shutdown` / `--install` / `--unregister`、不得刪除或重建 `Ubuntu-24.04`。本機 runtime 驗證只做唯讀查詢或暫存檔，驗完清乾淨。"
  - "🔴 Renderer 不得 import Node builtin（D090）；renderer 端 log 用 `window.electronAPI.debug.log`，main 端用 `logger`（CLAUDE.md Logging）。"
  - "⚠️ PLAN-035 Phase 1 四張單（T0381→T0382→T0383→T0384）**串行**，都會改 `electron/main.ts`；只改本單範圍，不預先做後面單的內容。不 push。"
---

# T0381 — 「取得 TLS 指紋」改用 TLS 握手

## 背景

`wsl:fetch-fingerprint`（`electron/main.ts` 約 :3527-3547）對 `https://localhost:<port>/fingerprint` 發 GET，但 RemoteServer / bat-server（`electron/remote/remote-server.ts:282`）沒有任何 HTTP request handler，請求永遠沒有回應；IPC 又沒 timeout ⇒ 精靈卡死、取消也解不開、連線殘留。`fetchFingerprintStep` 被 WSL / SSH / Docker 三個 flow 共用。

## 決策（D128）

1. 指紋改用 TLS 握手取得：`tls.connect({ host, port, rejectUnauthorized: false })` → `getPeerCertificate().fingerprint256`，取得後立即 `destroy()`。輸出格式須與 RemoteServer / profile 既有 `remoteFingerprint` 格式一致（T0380 實測 `61:E3:BA:…` 一致；以 `electron/remote/certificate.ts` 的格式為準並寫測試鎖定）
2. **所有路徑都要 timeout**（建議 5s，連線 + 握手合計）；timeout / 錯誤時 socket 一定要 destroy，不留殘留連線；回明確錯誤碼（例如 `fingerprint-timeout` / `fingerprint-unreachable`）給 ErrorMapper（i18n 三語，依專案既有 locale 檔）
3. 精靈取消時 step 不得永久卡住：timeout 即可保證；若 runner 有 abort 機制就接上
4. SSH / Docker：確認它們目前取指紋的實際路徑（SSH 可能經 tunnel 到 local port、Docker 經 port mapping），改用同一個 TLS 握手實作；若走的是別的 IPC，一併修正並寫回報區
5. IPC 名稱可保留 `wsl:fetch-fingerprint`；若改名為共用名稱須同步 preload / `electron.d.ts` 並確保所有呼叫端都已遷移
6. 不在本單：埠衝突（T0382）、網路模式（T0383）、keep-alive（T0384）。本機目前 Mirrored + 主機 RemoteServer 佔 9876，實測時握手會連到**主機 BAT 自己**——那是 T0382 的問題，本單只要保證「取得的是對端憑證指紋、不會卡住」

## 驗收

- unit：指紋格式；timeout 觸發 + socket 被 destroy；連線拒絕 / 握手錯誤回對應錯誤碼；成功路徑（測試內以 `tls.createServer` + 自簽憑證起本地 server，或 mock `tls.connect`）
- `npm run test:unit` 全綠（基線 **794**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **本機 runtime**：對 `127.0.0.1:<BAT_REMOTE_PORT>`（主機 RemoteServer）呼叫新實作，指紋應等於 BAT 主機 RemoteServer 的指紋，且 5s 內返回；`netstat` 確認不留 ESTABLISHED 連線
- **runtime 驗收（交使用者）**：WSL 精靈第 6 步不再卡住（成功或在 timeout 後明確失敗）

## Sub-session 執行指示

1. 讀取本工單 + 對應 BUG + **T0380 回報區**（研究目標 6 P1-a，及結論摘要第 1 點）
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

- 開工：`2026-10-04T22:22:36+08:00`（系統時間）；原始 `status: TODO` 視為未開始，直接轉 `IN_PROGRESS`
- 派發：`CT_MODE=on`、`CT_INTERACTIVE=0`；無使用者中途指示

### 落點檢查（Landing Zone）— 整體 **WARN**

| 檢查 | 結果 | 說明 |
|------|------|------|
| C-0 repo identity | ⚠️ WARN | 工單 frontmatter **無 `repo` 欄位**（`absent`）；`basename(REPO_ROOT)` = `better-agent-terminal`。依規則退回 C-3 + C-1 判定 |
| C-1 工單路徑 | ✅ PASS | `REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`，工單位於其下 `_ct-workorders/` |
| C-3 affects_files | ✅ PASS | 前 5 筆可測項目（`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`steps/wsl/fetch-fingerprint.ts`、`ssh-flow.ts`）全部存在 |
| C-2 branch | ℹ️ N/A | 工單無 `branch` 欄位；實際 `main` |
| `BAT_WORKSPACE_ID` | 證據 | `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b` |

### 實作結果

1. **TLS 握手取指紋（D128-1）**：新增 `electron/tls-fingerprint.ts` `fetchTlsFingerprint(port, { host?, timeoutMs? })`
   - `tls.connect({ host: '127.0.0.1', port, rejectUnauthorized: false })` → `secureConnect` 時取 `getPeerCertificate().fingerprint256`（轉大寫並以 `^[0-9A-F]{2}(:[0-9A-F]{2}){31}$` 驗證）→ 立即 `destroy()`
   - 格式由測試以 `electron/remote/certificate.ts` 的 `generateSelfSignedCert()`（內部 `computeFingerprint()`）產生的真實憑證鎖定：`fetchTlsFingerprint` 結果**完全等於** `bundle.fingerprint`
   - host 預設 `127.0.0.1`（T0380 建議；與 RemoteServer 預設 `localhost` bind = `127.0.0.1` 一致，避開 Windows `localhost` 先解析 `::1` 的不確定性）
2. **全路徑 timeout + socket 必 destroy（D128-2）**：連線 + 握手合計 5s（`DEFAULT_FINGERPRINT_TIMEOUT_MS`）。單一 `finish()` 收斂所有結束路徑（成功 / timeout / `error` / `close` / 同步 throw），一律 `clearTimeout` + `socket.destroy()`；`error` listener 常駐，settle 後晚到的錯誤不會變成 unhandled。錯誤碼：
   - `fingerprint-timeout`（握手未在時限內完成，例如對端接受 TCP 但不講 TLS）
   - `fingerprint-unreachable`（`ECONNREFUSED` / `EHOSTUNREACH` / `ENETUNREACH` / `ENOTFOUND` / `EAI_AGAIN` / `EADDRNOTAVAIL`）
   - `fingerprint-handshake-failed`（其他 socket / TLS 錯誤、握手前關閉、對端無憑證）
   - `fingerprint-invalid-port`（非 1–65535 整數；不發起連線——外部輸入白名單）
3. **IPC**：名稱保留 `wsl:fetch-fingerprint`（D128-5），回傳改為結構化 `{ ok: true; fingerprint } | { ok: false; errorCode; error }`（`ipcMain.handle` reject 時 Error 的 `code` 會在 IPC 邊界遺失，故改用回傳值）。失敗時 main 端 `logger.warn('[wizard] fetch-fingerprint <code>: ...')`。`electron/main.ts` 移除已無用的 `import * as https`。`preload.ts` / `electron.d.ts`（新增 `WslFetchFingerprintResult`）同步。唯一呼叫端是 renderer step 的 `defaultImpl`，已遷移
4. **Renderer step**（`steps/wsl/fetch-fingerprint.ts`）：`defaultImpl` 解包結果，失敗時 throw 帶 `code` 的 Error → wizard-runner 以 `code` 走 ErrorMapper stage 1。重試策略改為**只對 `fingerprint-unreachable` 重試**（服務可能還在啟動），`timeout` / `handshake-failed` / `invalid-port` 立即失敗；最後一次失敗後不再空等 1s。最壞耗時：timeout 情境約 5s、unreachable 情境約 4s（原本是無限）。`setFetchFingerprintImplForTests` 簽章不變（`tests/` 下既有 journey 測試仍相容）
5. **取消不會永久卡住（D128-3）**：runner 目前**沒有** step 層級 abort 機制（`WizardContext` 無 signal；`cancel()` 只在 step 之間檢查 `cancelRequested`），因此依決策以 timeout 保證：step 最多約 5s 結束，之後 runner 即處理取消。未新增 abort 機制（超出本單範圍）
6. **ErrorMapper + i18n 三語**：`error-mapper.ts` registry 新增 4 筆（`platforms: 'all'`、`stepIds: ['fetch-fingerprint']`、stage 1 `errorCodes`），messageKey `wizard.shared.error.fingerprint{Timeout,Unreachable,HandshakeFailed,InvalidPort}`；`en` / `zh-TW` / `zh-CN` 皆補 `title` / `body`。timeout 文案提示「埠可能被其他程式（例如本機 BAT 自己的遠端伺服器）占用」，以銜接 T0382

### SSH / Docker 實際取指紋路徑（D128-4）

- 三個 flow 都用同一個 `fetchFingerprintStep` → 同一個 IPC `wsl:fetch-fingerprint`，沒有其他 IPC ⇒ 本單修正同時套用到三者（`ssh-flow.ts` / `docker-flow.ts` 不需改動；測試鎖定三個 flow 共用同一 step）
- **Docker**：`docker-lifecycle.ts:75` 以 `-p <port>:9876` 把容器埠映射到主機 ⇒ 對 `127.0.0.1:<serverPort>` 握手即取得容器內 bat-server 憑證，路徑正確
- 🔴 **SSH（新發現，未修，交塔台）**：精靈期間**沒有建立 SSH tunnel**。`createSshWizardContext` 設 `serverPort = 9876`；`ssh/start-server.ts` 把遠端 bat-server 起在 `ctx.serverPort`（9876）；但 `fetch-fingerprint` 與 `connect-test`（`remote.testConnection('localhost', port, ...)`，`RemoteClient` 無 tunnel 設定）都直接連**本機** `localhost:9876`。`SshTunnel`（`electron/remote/ssh-tunnel.ts`）只在 `RemoteClient.doConnect()` 依 profile 的 `useSshTunnel` 建立，精靈驗證階段用不到 ⇒ SSH 精靈的指紋步驟會連到**主機 BAT 自己的 RemoteServer**（本機無人監聽時則回 `fingerprint-unreachable`），pin 進 profile 的會是錯的指紋。本單只保證「不卡住 + 取得的是對端憑證」，SSH 的「對端是誰」需另案：驗證步驟前先開 `ssh -L <localPort>:127.0.0.1:<remotePort>`（或直接經 ssh 讀遠端 `server-cert.json` 的 fingerprint），並與 T0382 的埠選擇一起考慮。建議塔台開新 BUG

### 驗收結果

| 閘門 | 結果 | 證據 |
|------|------|------|
| unit：指紋格式 / 成功路徑 | ✅ PASS | `electron/__tests__/tls-fingerprint.test.ts`：`tls.createServer` + `generateSelfSignedCert()` 真憑證，結果 `toEqual({ ok: true, fingerprint: bundle.fingerprint })` 且符合 32 組大寫 hex 格式；mock 路徑驗 `rejectUnauthorized:false`、小寫轉大寫 |
| unit：timeout + socket destroy | ✅ PASS | 真 socket：靜默 TCP server，300ms timeout 回 `fingerprint-timeout`，server 端連線數歸 0；mock：fake timers 5s 觸發 timeout，`destroy` 恰 1 次，晚到 `error` 不拋 |
| unit：連線拒絕 / 握手錯誤 | ✅ PASS | 已關閉的埠 → `fingerprint-unreachable`；回 HTTP 400 的 non-TLS server → `fingerprint-handshake-failed` 且連線歸 0；errno 分類表；同步 throw；對端無憑證；5 種非法 port 不連線 |
| unit：renderer step + ErrorMapper | ✅ PASS | `src/components/setup-wizard/__tests__/fetch-fingerprint.test.ts`（13）：三 flow 共用、成功、service down 略過、3 種碼不重試、unreachable 重試 5 次後帶碼失敗、重試中恢復、三語 key 存在、4 碼 × wsl/ssh/docker stage 1 命中 |
| `npm run test:unit` | ✅ PASS | **59 files / 822 tests 全綠**（基線 794 → +28：electron 15、renderer 13） |
| `npx vite build` | ✅ PASS | exit 0 |
| `npx tsc --noEmit` | ✅ PASS | **40** errors（= baseline 40）；本單觸及檔案 0 筆 |
| 本機 runtime：主機 RemoteServer | ✅ PASS | `npx tsx` 以新實作探測 `127.0.0.1:9876`（`BAT_REMOTE_PORT`）：**8ms** 回 `61:E3:BA:4E:55:F3:12:F0:C0:01:9C:81:D2:A6:ED:C6:B5:81:75:B0:7B:86:F3:22:56:8E:85:BC:5D:1B:D6:6F`，與 `%APPDATA%\BetterAgentTerminal\server-cert.json` 的 `fingerprint` 完全一致（只讀 fingerprint 欄位） |
| 本機 runtime：無殘留連線 | ✅ PASS | probe 程序（PID 39624）存活期間 `netstat -ano`：probe 連線 `127.0.0.1:56320 → 9876` 已是 `TIME_WAIT`（PID 0），沒有屬於 probe 的 ESTABLISHED。另見 `127.0.0.1:61786 ↔ 9876 ESTABLISHED`（PID 16928）為 BUG-090 記載的**舊版殘留連線**，非本實作產生，重啟 BAT 後會消失 |
| runtime 驗收（交使用者） | ⏳ 待使用者 | WSL 精靈第 6 步：需以含本修正的版本實測。在目前 Mirrored + 主機占 9876 的環境下，預期會**取到主機 BAT 自己的指紋而成功**（埠衝突屬 T0382），或在 5s 內明確失敗，不再卡住 |

暫存檔：runtime probe 腳本放在 scratchpad，驗完已刪除；未改 `.wslconfig`，未執行任何 `wsl --shutdown` / `--install` / `--unregister`。

### 改動檔案

- `electron/tls-fingerprint.ts`（新）
- `electron/main.ts`
- `electron/preload.ts`
- `src/types/electron.d.ts`
- `src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts`
- `src/components/setup-wizard/error-mapper.ts`
- `src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`
- `electron/__tests__/tls-fingerprint.test.ts`（新）
- `src/components/setup-wizard/__tests__/fetch-fingerprint.test.ts`（新）

### 偏差 / 範圍說明

- `affects_files` 以外新增/修改：`electron/tls-fingerprint.ts`（為了能做單元測試而抽出的模組；`main.ts` 無法直接測）、`error-mapper.ts` 與三個 locale 檔（決策 2 明訂「錯誤碼給 ErrorMapper、i18n 三語」所必需）
- `ssh-flow.ts` / `docker-flow.ts` 列在 `affects_files` 但**未改動**：它們共用同一 step，修正自動生效
- IPC 回傳型別由 `Promise<string>` 改為結構化結果（名稱不變），唯一呼叫端已遷移
- 未實作 runner 層 abort（目前不存在該機制；以 timeout 滿足決策 3）

### 後續建議（給塔台）

1. 🔴 **新 BUG（建議 High）**：SSH 精靈驗證階段不建 tunnel，`fetch-fingerprint` / `connect-test` 連到本機 `localhost:<serverPort>`，會 pin 到主機 BAT 自己的指紋（見上節）
2. （選用）runner 層 step abort：讓取消能立即中斷進行中的 step，而不必等 timeout
3. T0382 解決埠衝突後，WSL 精靈第 6 步才會取到 WSL 端 bat-server 的指紋；建議 runtime 驗收與 T0382 合併執行

### Commit

`git commit --only` 僅含上列檔案 + 本工單；未 push。hash 見 git log（`fix(wizard): T0381 ...`）。
