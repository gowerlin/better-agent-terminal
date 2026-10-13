---
schema_version: 1
schema_kind: workorder
id: T0517
title: "SSH 精靈：目標 sshd 禁止 port forwarding 時給出正確錯誤訊息（BUG-124）"
type: implementation
status: IN_PROGRESS
started_at: "2026-10-14T04:04:54+0800"
updated_at: "2026-10-14T04:04:54+0800"
repo: better-agent-terminal
project: BUG-124
priority: P3
sizing: S
created_at: "2026-10-14T04:03:26+0800"
target_version: "0.6.0-pre.7"
related:
  - BUG-124
  - "T0515（W7(a) 重現情境：`e2e/pre6-wizard-acceptance.spec.ts`、`e2e/real-remote/t0515-wizard-env.mjs`）"
affects_files:
  - electron/remote/
  - src/components/setup-wizard/
  - src/locales/
  - electron/remote/__tests__/
  - src/components/setup-wizard/__tests__/
  - e2e/pre6-wizard-acceptance.spec.ts
  - _ct-workorders/T0517-ssh-wizard-forwarding-denied-error.md
  - _ct-workorders/BUG-124-ssh-wizard-forwarding-denied-misleading-tls-error.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 與 T0518 並行（T0518 改 `electron/handlers/claude.ts`）：本單不改該檔；commit 用 `git commit --only` 或精準 `git add`。"
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）與 WSL bat-server（9877）；e2e 隔離實例；Docker 資源只用 `bat-t0515-*` / `bat-t0517-*` 前綴並收尾刪除；`~/.ssh/config` 若被腳本暫改須雜湊還原。不消耗 Claude token。"
  - "🔴 改 `electron/**` 驗收 `npm run typecheck:electron` = 0；改 `src/**` 驗收 `npm run typecheck` = 0；i18n 三語齊備。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。"
---

# T0517 — SSH 精靈 forwarding 被拒的錯誤訊息（BUG-124）

## 任務

1. 讀 BUG-124 與 T0515 回報區「觀察」節。確認 tunnel ssh 行程在 forwarding 被拒時的實際 stderr（如 `channel N: open failed: administratively prohibited: open failed`）
2. 在精靈驗證階段（fetch-fingerprint / 連線測試，SSH tunnel 路徑）偵測此情況，錯誤改為指出「目標 sshd 不允許 port forwarding（`AllowTcpForwarding`）」並附建議；原始錯誤保留在 detail；三語
3. 不改變既有成功路徑與 rollback 行為

## 驗證

- 單元測試：錯誤分類 / mapper 對 forwarding-denied stderr 的判斷
- 可行時以 T0515 的容器情境（`AllowTcpForwarding no`）在 source build 隔離實例實測新訊息（回報區附截圖或 log）；不可行則說明
- `npx vite build` exit 0、typecheck 雙 0、`npm run test:unit` 全套通過

## 驗收條件

- [x] forwarding 被拒時顯示正確原因（三語）
- [x] BUG-124：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」同步

## Sub-session 執行指示

1. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
2. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
3. commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

### 結論：DONE

forwarding 被拒時，精靈改顯示「SSH 伺服器不允許 port forwarding」（三語）與管理員可執行的建議。ssh 的原文與原始 TLS 錯誤保留在 raw detail。成功路徑與 rollback 行為不變（GUI 實測 rollback 照常）。

### Landing zone

| 檢查 | 結果 | 證據 |
|------|------|------|
| C-0 repo identity | ✅ PASS | frontmatter `repo: better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal` |
| C-1 工單路徑 | ✅ PASS | `REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal` |
| C-3 affects_files | ✅ PASS（informational） | `electron/remote/`、`src/components/setup-wizard/`、`src/locales/`、兩個 `__tests__/`、spec 皆存在 |
| C-2 branch | ℹ️ N/A | 無 `branch` 欄位；實際 `main` |
| `BAT_WORKSPACE_ID` | 證據 | `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b` |

### 根因（步驟 1）

- `ssh -N -L … -o ExitOnForwardFailure=yes` 只在**本機** listen 失敗時退出。sshd `AllowTcpForwarding no` 是逐連線拒絕：tunnel 照常建立，每個轉送連線由 ssh 在 stderr 印出拒絕訊息後關掉本機 socket，TLS 握手只看到 reset
- 實際 stderr（Windows OpenSSH `C:\Windows\System32\OpenSSH\ssh.exe` → T0515 jump 容器，3 次皆同）：`channel 2: open failed: administratively prohibited: open failed`（readiness probe 那次），`channel 3: …`（TLS 握手那次）。握手錯誤與 T0515 相同：`TLS handshake with 127.0.0.1:<local> failed: read ECONNRESET`
- 時序：readiness probe 的拒絕在 `open` 回傳後、握手失敗之前就已出現在 stderr，因此握手失敗時查詢不必等待（實測 `status()` 0–1 ms）

### 修正（步驟 2）

| 檔案 | 變更 |
|------|------|
| `electron/remote/ssh-tunnel.ts` | `SshTunnelWarningKind` 新增 `forwarding-denied`；`classifyStderr` 以 `/open failed: administratively prohibited/i` 判斷（排在既有分類前；`connect failed: Connection refused` 仍為 `connection-refused`） |
| `electron/remote/ssh-wizard-verify.ts` | `WizardTunnelRegistry` 依 session 記住第一次拒絕（取 ssh 原文那一行）；新增 `status(sessionId, waitMs = 1000)` → `{ forwardingDenied, detail }`，尚未看到時每 50 ms 檢查，tunnel 已死 / 未知 session 立即回 false；`describeWarning` 補 `forwarding-denied`（start 失敗路徑） |
| `electron/remote/ssh-setup-handlers.ts` | 新 IPC `ssh:verify-tunnel-status`（非字串 sessionId / 例外 → `{ forwardingDenied: false }`，不拋給 renderer） |
| `electron/preload.ts`、`src/types/electron.d.ts` | `ssh.verifyTunnelStatus(sessionId)` |
| `src/components/setup-wizard/steps/ssh/verify-remote.ts` | `explainForwardingDenied()`：`fetch-fingerprint`（握手階段，不含指紋比對）與 `connect-test` 經 tunnel 失敗時，在**關 tunnel 之前**查詢；被拒 → `ssh-forwarding-denied`，訊息 = 目標 + `AllowTcpForwarding` + ssh 原文 + `Original error: <原錯誤>`。查詢拋錯、preload 無此 API、未被拒、tunnel 未開 → 原錯誤原封不動。成功路徑不查詢 |
| `src/components/setup-wizard/error-mapper.ts` | 新 entry `ssh-forwarding-denied`：`platforms: ['ssh']`、`stepIds: ['fetch-fingerprint','connect-test']`、stage-1 errorCode、`append-raw`、actions `fixed-and-retry` + `cancel` |
| `src/locales/{en,zh-TW,zh-CN}.json` | `wizard.ssh.error.forwardingDenied.{title,body}`（body 建議 `AllowTcpForwarding local` 或 `yes`，提醒 `Match` 區塊，reload sshd 後重試） |
| `e2e/pre6-wizard-acceptance.spec.ts` | W7(a) 新增 `BUG-124.message` 檢查（失敗畫面須含 forwardingDenied 標題（任一語言）、`AllowTcpForwarding`、`administratively prohibited`）；新 opt-in `BAT_E2E_SOURCE_BUILD=1`（無 `BAT_E2E_EXECUTABLE` 時改跑 source build，beforeAll 不再讀安裝目錄）。⚠️ pre.6 安裝版跑此 spec 的 W7(a) 會 FAIL `BUG-124.message`（BUG-124 本來就存在於 pre.6），已寫在 spec 檔頭 |

### 驗證

| Lane | 結果 | 證據 |
|------|------|------|
| 單元：main | ✅ PASS | `electron/remote/__tests__/ssh-wizard-forwarding-denied.test.ts` 8 項：真 `SshTunnel`（注入 spawn / net）把拒絕行（含 CRLF 多行 chunk）分類為 `forwarding-denied`、既有分類不變；registry `status()`：start 期間 / 之後（等待內）抵達、其他 warning 不算、等待上限、死 tunnel / 未知 session 不等、close 後清除 |
| 單元：renderer | ✅ PASS | `src/components/setup-wizard/__tests__/ssh-forwarding-denied.test.ts` 13 項：fetch-fingerprint / connect-test 改碼且含 ssh 原文與原錯誤、查詢在關 tunnel 前、tunnel 仍會關；未被拒 / 查詢失敗 / 舊 preload / tunnel 未開 / 指紋不符 / 成功路徑 → 不查詢或原錯誤；mapper 三語 stage-1、`rawError` 保留、一般握手失敗仍對應原 entry |
| `npm run test:unit` | ✅ PASS | `Test Files 212 passed (212)`、`Tests 3534 passed \| 1 skipped (3535)`（型別修正後重跑仍相同） |
| `npm run typecheck` | ✅ 0 | exit 0 |
| `npm run typecheck:electron` | ✅ 0 | exit 0 |
| `npx vite build` | ✅ PASS | exit 0 |
| 真實 OpenSSH lane（無 GUI） | ✅ PASS | scratch 腳本（不 commit）用 esbuild 打包**真實的** `WizardTunnelRegistry` / `SshTunnel` / `fetchTlsFingerprint`，只把 ssh 換成 Windows OpenSSH 加 `-F <T0515 probe config>`（不動 `~/.ssh/config`）；jump 容器 `127.0.0.1:9876` 起 `openssl s_server`。**允許 forwarding**（對照組）：握手成功，指紋 `56:0B:56:6C:…:57:E8` = 容器憑證，`status` = `{"forwardingDenied":false}`。**`AllowTcpForwarding no`** ×3：`fingerprint-handshake-failed`（`read ECONNRESET`），`status` = `{"forwardingDenied":true,"detail":"channel 2: open failed: administratively prohibited: open failed"}` |
| GUI：source build 隔離實例 | ✅ PASS | `BAT_E2E_PRE6_WIZARD=1 BAT_E2E_SOURCE_BUILD=1 npx playwright test e2e/pre6-wizard-acceptance.spec.ts -g "W6/W7 failure after start-server"` → `1 passed (24.9s)`。`W7.after-start-server` PASS、`BUG-124.message` PASS、`W6.rollback` PASS（取消後 `install-server-bundle` / `start-server` / `fetch-fingerprint` 皆 `rolled-back`，遠端 unit / bundle 已刪、9876 無 listener、未建 profile、無 rollback 警告）。畫面（zh-TW）：標題「SSH 伺服器不允許 port forwarding」，下方紅框是原文：`bat-t0515-direct does not allow SSH port forwarding (sshd AllowTcpForwarding), so the tunnel to remote port 9876 cannot reach the BAT server. ssh: channel 2: open failed: administratively prohibited: open failed. Original error: TLS handshake with 127.0.0.1:63236 failed: read ECONNRESET`。截圖：`%TEMP%\bat-t0517\evidence\w7a-failed.png`、`w7a-after-cancel.png`；判定在 `%TEMP%\bat-t0517\evidence\results.json` |
| en / zh-CN 畫面 | ⚠️ 未逐一截圖 | 隔離實例跟隨 OS 語言（zh-TW）；en / zh-CN 字串由單元測試確認（mapper 解析結果 = 各語系 title / body） |

### 環境與隔離

- 未碰使用者 BAT（9876）與 WSL bat-server（9877）：隔離實例 `remotePort=62172`、userData `BetterAgentTerminal-runtime-e2e-t0515-w7a-*`，結束後已刪；Terminal Server `alive after teardown: false`
- `~/.ssh/config`：spec 暫改後還原，`match=true`；收尾 `sha256` = `00aab1cda8667c85db60b35f406a785bd9a909b87df7cf49aa78450ca03c58a2`（與開工前相同）
- Docker：只用 `bat-t0515-*`（T0515 env script）；我在 jump 容器加的 `00-t0517-noforward.conf`、`/tmp/t0517*`、`openssl s_server` 在跑 GUI 前已移除 / 停止（`allowtcpforwarding yes`、`listen9876=0`）；`down` 後 label `bat.t0515=1` 的容器 / network / volume 皆 none；保留 image `bat-t0515-sshd:local`、`bat-t0515-docker-server:local`（T0515 慣例，`down --rmi` 可刪）
- 未消耗 Claude token；未跑全套 e2e

### 偏離與注意

- `electron/preload.ts`、`src/types/electron.d.ts` 不在 `affects_files`：新增 IPC 一定要改這兩處（各 +2～3 行）
- 新增 spec 開關 `BAT_E2E_SOURCE_BUILD=1`（工單要求在 source build 實測，原 spec 規定要有 `BAT_E2E_EXECUTABLE`，否則整檔 skip）
- 失敗畫面的 actions 除了 entry 給的 `fixed-and-retry` / `cancel` 外，還有「編輯設定」，由既有 Shell 加入，非本單變更
- 收尾時一次 Bash 指令誤用未加引號的 heredoc，反引號被當成指令替換執行（`ssh` 因參數錯誤立即退出、其他為 command not found，卡在 `read`）。已停止該指令並確認沒有寫入任何檔案、沒有建立連線，之後改用 Edit 工具

### Commit

- 見下方 commit（`git commit --only`，只含本單檔案；未含並行中的 `src/styles/settings.css`、`electron/handlers/claude.ts`；未 push）

