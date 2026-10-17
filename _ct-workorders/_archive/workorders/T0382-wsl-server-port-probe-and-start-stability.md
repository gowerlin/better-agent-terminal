---
schema_version: 1
schema_kind: workorder
id: T0382
title: "BUG-091 修復：WSL bat-server 選用 Windows 端可用埠（避開主機 RemoteServer）+ startService 穩定性判定"
type: implementation
status: DONE
priority: P1
sizing: M
created_at: "2026-10-04T22:18:57+08:00"
updated_at: "2026-10-04T22:42:50+08:00"
started_at: "2026-10-04T22:32:45+08:00"
completed_at: "2026-10-04T22:42:50+08:00"
target_version: next
depends_on: [T0381]
related:
  - "BUG-091（修復對象）"
  - "T0380 回報區 目標 6 P1-b、目標 4（Mirrored / NAT localhost 差異）"
  - "D128"
  - "PLAN-035 Phase 1"
affects_files:
  - src/components/setup-wizard/wsl-flow.ts
  - src/components/setup-wizard/steps/wsl/write-systemd-unit.ts
  - src/components/setup-wizard/steps/wsl/connect-test.ts
  - src/components/setup-wizard/steps/wsl/write-profile.ts
  - electron/wsl-systemd.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/error-mapper.ts
  - src/locales/
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

# T0382 — WSL 伺服器埠探測 + 啟動穩定性判定

## 背景

主機 BAT RemoteServer 預設 `127.0.0.1:9876`（`electron/main.ts` `REMOTE_PORT_DEFAULT`；env `BAT_REMOTE_PORT` > settings > default），WSL 精靈 `DEFAULT_SERVER_PORT = 9876`（`wsl-flow.ts:12`）。Mirrored 共用 localhost ⇒ Linux 端 `EADDRINUSE`、systemd 無限重啟；`startService()`（`electron/wsl-systemd.ts:260`）第一次看到 `active` 就回成功（`Type=simple` fork 即 active）⇒ 精靈顯示 ✓ 但服務沒在跑。

## 決策（D128）

1. **埠選擇**：精靈在寫 unit 之前，於 Windows 端探測可用埠——排除主機 RemoteServer **實際使用**的埠（以 main 端已解析的值為準，不要只排除常數 9876），以 `net.createServer().listen(port, '127.0.0.1')` 試綁確認空著後立即關閉。預設候選從 9877 起往上找（範圍與上限由 Worker 決定並寫回報區）；使用者若在精靈中指定埠則驗證該埠、衝突時回錯誤
2. 選定的埠須**一致地**寫進 systemd unit、connect-test、profile（`write-profile`）；確認三處讀同一個 ctx 值
3. **startService 穩定性**：改為「`active` 持續 N 秒（建議 3s）且 `NRestarts` 未增加」，或確認埠已在 listen（擇一或並用，寫理由）；失敗時讀 `journalctl --user -u bat-server -n <k>`，出現 `EADDRINUSE` 回 `wsl-port-in-use`，其他回既有錯誤碼並附 journal 摘要
4. ErrorMapper 新增 `wsl-port-in-use`（i18n 三語，依專案既有 locale 檔）
5. 既有埠為 9876 的 WSL profile：本單**不做**自動遷移，回報區說明使用者重跑精靈即可修正
6. 不在本單：指紋（T0381）、網路模式（T0383）、keep-alive（T0384）

## 驗收

- unit：埠選擇（主機埠被排除、占用時往後找、使用者指定埠衝突報錯）；startService 穩定性（mock execFile：立即 active 後 NRestarts 增加 → 失敗；持續 active → 成功；journal 含 `EADDRINUSE` → `wsl-port-in-use`）
- `npm run test:unit` 全綠（基線 **822**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **本機 runtime（建議）**：在 `Ubuntu-24.04` 以 transient unit 驗證穩定性判定不會把 crash-loop 判成功；驗完清乾淨（不得留下新 unit / 檔案，也不得刪除使用者既有的 bat-server unit）
- **runtime 驗收（交使用者）**：WSL 精靈第 5 步在服務真的起來時才 ✓；第 7 步連線測試成功（若精靈期間發行版被閒置關閉，屬 BUG-092 / T0384 範圍，回報區註明）

## Sub-session 執行指示

1. 讀取本工單 + 對應 BUG + **T0380 回報區**（研究目標 6 P1-b、目標 4）
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 落點檢查（Landing Zone）

- 結果：**WARN**（僅 C-0 無資料）
- C-0：frontmatter `repo` = `absent` → WARN "repo identity unavailable"；`basename(REPO_ROOT)` = `better-agent-terminal`
- C-1：工單路徑位於 `REPO_ROOT` 下 → PASS
- C-3：前 5 個可測項目（`wsl-flow.ts`、`write-systemd-unit.ts`、`connect-test.ts`、`write-profile.ts`、`electron/wsl-systemd.ts`）全部存在 → PASS
- C-2：工單無 `branch` 欄位，目前 `main` → 不適用
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅留證）
- 派發模式：`CT_MODE=on`、`CT_INTERACTIVE=0`

### 結果摘要

**DONE**。BUG-091 兩個子問題皆修復：

1. **埠選擇（D128-1/2）**：WSL bat-server 埠改由 main 端在 Windows 側探測決定，不再預設 9876。
   - 新 IPC `wsl:pick-server-port`（`electron/main.ts`）→ `wslSystemd.pickServerPort()`。排除主機 RemoteServer 埠時**兩個值都排除**：`readRemotePortSync()`（env `BAT_REMOTE_PORT` > settings > default 的解析值）與 `remoteServer.port`（實際在跑的埠），不只常數 9876。
   - 探測：`net.createServer().listen({ port, host: '127.0.0.1', exclusive: true })`，`listening` 後立刻 `close()`；error / 2s timeout 視為占用，不會殘留 listener。
   - **掃描範圍：`9877`–`9976`（最多 100 個埠）**。理由：從主機預設 9876 的下一號開始、與既有埠號習慣相鄰易辨識；100 個足以跳過零星占用，最壞情況約 100 次本機 bind（毫秒級）。全滿回 `wsl-port-in-use`。
   - 使用者指定埠（`ctx.state.serverPort`）：原樣驗證，不替換。非 1024–65535 整數 → `wsl-port-invalid`；等於主機 RemoteServer 埠或 Windows 端已被占用 → `wsl-port-in-use`。（目前精靈沒有輸入埠號的 UI，此路徑供程式設定 / 日後 UI 使用。）
   - 選定的埠寫入 `ctx.serverPort`，unit（`BAT_PORT` / `BAT_SERVER_PORT`）、fetch-fingerprint、connect-test、write-profile 全部讀同一個 `ctx.serverPort`（有單元測試把三處串起來驗證）。`wsl-flow.ts` 移除預設 9876；`connect-test` / `write-profile` 移除 `?? 9876` fallback（9876 正是主機埠），未解析時直接報錯。
2. **startService 穩定性（D128-3）**：選擇「`active` 連續 3s 且 `NRestarts` 未增加」，**不採用** listen 檢查。理由：(a) NAT / Mirrored 行為一致，listen 檢查在 NAT 下從 Windows 端看不準；(b) 不需要發行版內另外有 `ss` 等工具；(c) 下一步 fetch-fingerprint（T0381）本來就會做 TLS 握手，等於已經驗證「真的在 listen」，重複檢查沒有增益。
   - 流程：`daemon-reload` → `enable` → `date +%s`（發行版時鐘，給 journal `--since`）→ **`restart`**（原為 `enable --now`；改 restart 是因為重寫 unit 換了埠時，`enable --now` 不會重啟仍在舊埠跑的 server）→ 以 `systemctl --user show -p ActiveState -p SubState -p NRestarts`（單次 wsl 呼叫）輪詢。
   - NRestarts 基準取 restart 之後的值，之前累積的次數不算。曾 active 後離開 active、`failed`、NRestarts 增加 → 失敗；10s 內從未 active → timeout。
   - 失敗時讀 `journalctl --user -u <svc> --no-pager -o cat -n 50 --since @<epoch>`（只看本次啟動，避免舊的 EADDRINUSE 誤判）。含 `EADDRINUSE` → `errorCode: 'wsl-port-in-use'`（訊息帶埠號）；其他 → 既有 `wsl-service-start-timeout` / `wsl-service-start-failed`，錯誤訊息附 journal 最後 10 行。
   - `startService` 結果現在一律帶 `errorCode`，`write-systemd-unit` 優先用它，舊 regex 只當 fallback（避免 journal 內容含 "timeout" 字樣時被誤分類）。
   - 代價：成功路徑多約 3–4 秒（實測 4083ms）。
3. **ErrorMapper（D128-4）**：新增 `wsl-port-in-use` entry（platform `wsl`、step `write-systemd-unit`、stage-1 code + stage-2 `/EADDRINUSE/`），訊息 key `wizard.wsl.error.portInUse`（zh-TW / zh-CN / en 三語），動作 `[retry, cancel]`（重試會重新挑埠）。
4. **既有 9876 profile（D128-5）**：本單不做自動遷移。已用舊版精靈建立、埠為 9876 的 WSL profile，使用者**重跑 WSL 精靈**即可：新精靈會挑新埠、以 `restart` 套用新 unit，並寫出新 profile（舊 profile 可手動刪除）。

### 修改檔案

| 檔案 | 變更 |
|------|------|
| `electron/wsl-systemd.ts` | `startService` 穩定性判定 + journal 分類；新增 `parseServiceState`、`probePortFree`、`pickServerPort`（含 test hook）、`SERVER_PORT_SCAN_START/END` |
| `electron/main.ts` | 新 IPC `wsl:pick-server-port`；`wsl-systemd:start-service` 只轉送 `dataDir` / `timeoutMs` |
| `electron/preload.ts`、`src/types/electron.d.ts` | `wsl.pickServerPort` 與 `startService` 結果型別（含 `errorCode`） |
| `src/components/setup-wizard/steps/wsl/write-systemd-unit.ts` | `resolveServerPort()` 改走 IPC；`startResult.errorCode` 優先 |
| `src/components/setup-wizard/wsl-flow.ts` | 移除預設 9876（`state: {}`） |
| `src/components/setup-wizard/steps/wsl/connect-test.ts`、`write-profile.ts` | 移除 `?? 9876` fallback |
| `src/components/setup-wizard/error-mapper.ts` | `wsl-port-in-use` entry |
| `src/locales/{zh-TW,zh-CN,en}.json` | `wizard.wsl.error.portInUse` |
| `electron/__tests__/wsl-server-port.test.ts`（新） | 埠選擇 + 真實 socket 探測 |
| `electron/__tests__/wsl-systemd.test.ts` | startService 穩定性 8 案 |
| `src/components/setup-wizard/__tests__/write-systemd-unit.test.ts` | 埠流向 / 錯誤對應 / 三處一致 8 案；mock 補 `pickServerPort` |
| `src/components/setup-wizard/__tests__/wsl-service-paths.test.ts` | mock 補 `pickServerPort` |

### 驗證證據分道

| 分道 | 結果 | 證據 |
|------|------|------|
| unit | **PASS** | `npx vitest run`：60 files / **853 passed**（基線 822，+31） |
| build | **PASS** | `npx vite build` exit 0 |
| tsc | **PASS** | `npx tsc --noEmit` error 數 **40**（= baseline 40；唯一與 setup-wizard 相關的是既有的 `integration.transitions.test.ts` TS6133，本單未動該檔） |
| 本機 runtime（Worker） | **PASS** | 見下 |
| runtime 驗收（交使用者） | 未執行 | 需 NSIS 安裝版跑 WSL 精靈 |

**本機 runtime 驗證**（2026-10-04 22:41，`Ubuntu-24.04`，WSL Mirrored，主機 BAT RemoteServer 在 9876）：以 tsx 直接呼叫真實的 `startService()`，對三個**暫時 user unit** 測試（unit 設定比照 bat-server：`Type=simple`、`Restart=on-failure`、`RestartSec=2s`）。說明：工單建議的 `systemd-run --user` transient unit 無法 `enable`（startService 會執行 `enable`），所以改用暫時的 unit 檔，驗完以 `removeUnit()` 移除。

| unit | 行為 | 結果 |
|------|------|------|
| `bat-t0382-crash.service` | `sleep 0.1; exit 1` | `ok:false`、`wsl-service-start-failed`、`did not stay active (ActiveState=activating, SubState=auto-restart)` + journal（1175ms）——**舊實作會判成功** |
| `bat-t0382-eaddrinuse.service` | 用 bundle 的 node 綁 `127.0.0.1:9876` | `ok:false`、**`wsl-port-in-use`**、`could not bind its port 9876 (EADDRINUSE)`、NRestarts +1（2957ms）——實機重現 BUG-091 的 Mirrored 衝突並正確分類 |
| `bat-t0382-ok.service` | `sleep 120` | `ok:true`（4083ms） |

同次 `pickServerPort({ excludePorts: [9876] })` 回 `{ ok: true, port: 9877 }`。

清理確認：`~/.config/systemd/user/` 只剩原本的 `bat-server.service`（mtime 21:58，未動）與其 `default.target.wants` 連結；`systemctl --user list-units --all` 沒有任何 t0382 unit；`bat-server.service` 仍為 `enabled`。未改 `.wslconfig`、未 shutdown / unregister。驗證腳本只在 scratchpad。

### 需要使用者實機驗證（Worker 無法驗證）

- NSIS 安裝版跑 WSL 精靈：第 5 步只在服務真的起來時才 ✓；`write-systemd-unit` 應挑到非 9876 的埠（預期 9877）。
- 第 7 步連線測試成功。若精靈過程中發行版閒置被關閉（約 15s 無 `wsl.exe` 連線），屬 **BUG-092 / T0384** 範圍，不是本單的回歸。
- 使用者機器目前的 `bat-server.service` 仍是舊 unit（9876，crash-loop 中）；重跑精靈會覆寫並 `restart`。

### 偏差與附註

- `startService` 由 `enable --now` 改為 `enable` + `restart`（理由見上，屬穩定性判定的一部分）。
- `connect-test.ts` / `write-profile.ts` 是 WSL / SSH / Docker 共用步驟：SSH 與 Docker flow 的 context 本來就預設 `serverPort`，移除 `?? 9876` 不影響它們。
- 刻意不動（範圍外，建議塔台評估）：
  - `steps/wsl/fetch-fingerprint.ts:57` 仍是 `ctx.serverPort ?? 9876`（T0381 的檔案，不在本單 `affects_files`）。只有使用者在 write-systemd-unit 失敗時選「略過」才會走到；之後 connect-test 會因為沒有 token / 埠而失敗，不會寫出錯誤的 profile。建議之後順手改成跟 connect-test 一樣不 fallback。
  - `tests/__mocks__/electron-api.ts` 的 `wsl` mock 沒有 `pickServerPort`；使用它的 `tests/wsl-*.test.ts` 不在 vitest `include` 內（`npm run test:unit` 不會跑），所以沒改。日後若納入，需要補 mock。
- 未改 BUG-091 檔（依工單指示由塔台更新）。

### 互動紀錄

無（`CT_INTERACTIVE=0`）。

### Commit

`fix(wizard): T0382 BUG-091 pick WSL server port off the host RemoteServer port + start stability check`（本工單檔一併提交，`git commit --only`；未 push）。
