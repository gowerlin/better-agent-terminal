---
schema_version: 1
schema_kind: workorder
id: T0382
title: "BUG-091 修復：WSL bat-server 選用 Windows 端可用埠（避開主機 RemoteServer）+ startService 穩定性判定"
type: implementation
status: TODO
priority: P1
sizing: M
created_at: "2026-10-04T22:18:57+08:00"
updated_at: "2026-10-04T22:18:57+08:00"
started_at: null
completed_at: null
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
