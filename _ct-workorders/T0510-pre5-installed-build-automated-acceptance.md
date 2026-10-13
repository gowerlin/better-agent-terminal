---
schema_version: 1
schema_kind: workorder
id: T0510
title: "pre.5 實機驗收自動化：以已安裝的 v0.6.0-pre.5 exe 起隔離實例，驗 Custom CLI 持久化、detached 關窗 flush、BUG-119 搬移、BUG-114 派發、SSH alias（無 User / ProxyJump）；真環境只做唯讀檢查"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P1
sizing: L
created_at: "2026-10-14T01:59:36+0800"
target_version: "0.6.0-pre.5（驗收，不發版）"
depends_on:
  - T0509
  - T0493
related:
  - "T0467（PLAN-039 實機驗收自動化：`e2e/real-remote/plan039-real-remote-env.mjs`、Dockerfile、`e2e/fixtures/electron-isolation.ts` 的 `launchIsolated` / `isolatedEnv`，可沿用）"
  - "T0496 回報區 L176（Custom CLI 持久化，`<userData>/custom-clis.json`）"
  - "T0504 / T0508（detached 關窗 flush；e2e `detached-flush-on-close` / `detached-close-edges` / `detached-terminal-persistence` / `detached-workspace`）"
  - "T0480 回報區「需使用者實機驗收」第 1 點（BUG-119 Windows）"
  - "BUG-114「生效條件」（≥ 20 次派發、成對派發、`responseType: invoke-result`）"
  - "T0505 回報區第 7 節（SSH alias 實機 6 項）、T0506（SshDetails 空 user 顯示）"
affects_files:
  - e2e/
  - _ct-workorders/T0510-pre5-installed-build-automated-acceptance.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只寫驗收工具 / opt-in spec，不改產品程式碼**（`electron/**`、`src/**`、`scripts/**`、`package.json` 不動）。發現產品缺陷 → 回報區記證據（步驟、預期 vs 實際、log 片段、截圖路徑），該項 FAIL、整單 PARTIAL，**不自行修**（由塔台開 BUG）。"
  - "🔴 **不碰使用者正在用的 BAT**：不得關閉 / 重啟 / 對它的 RemoteServer（port 9876）發 helper 連線；不得以預設實例（無 runtime / 無隔離 userData）啟動任何 BAT。真實 `%APPDATA%\\BetterAgentTerminal\\` 與 `%APPDATA%\\better-agent-terminal\\` **只讀**（雜湊 / mtime / 讀 log），不得寫入、搬移、刪除。"
  - "🔴 **不得消耗 Claude token**：不開 Claude Agent session、不送 prompt；BUG-114 派發測試用 raw command 或 shell 分頁，不用 `--skill`。"
  - "🔴 **Docker / WSL**：只建立、操作、刪除名稱前綴 `bat-t0510-` 且帶 label `bat.t0510=1` 的容器 / network / volume；不得 `docker system prune`、不得動其他容器（含 T0467 的 `bat-t0467-*`）；不得 `wsl --shutdown` / `--terminate`；不得動 WSL `~/.local/bat-server`；收尾刪除本單容器 / network（image 可保留並列出）。"
  - "🔴 **`~/.ssh/config`（使用者裁決：先隔離、失敗再暫改）**：見「SSH alias 規則」節。真實 `~/.ssh/known_hosts` / `authorized_keys` / 金鑰一律不動。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔維持 LF；不 push；不跑全套 `npm run test:e2e`（L141），只跑本單 spec 與下列指定的既有 spec。"
---

# T0510 — pre.5 實機驗收自動化（已安裝版）

## 背景

`v0.6.0-pre.5`（@ `7a6fb9c`）已發佈並安裝在本機（`C:\Program Files\BetterAgentTerminal\`，FileVersion `0.6.0-pre.5`）。D139 批次各單的「需實機驗收」項目原定人工做，使用者要求**盡量自動化**。

使用者裁決（2026-10-14 第五十九 session）：

| 項目 | 裁決 |
|---|---|
| 受測 build | **已安裝的 pre.5 exe**（`C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`），以 Playwright `_electron.launch({ executablePath })` 起**隔離實例**。repo 未設定 electron fuses，應可行；若打包版無法被 Playwright 驅動，退回以 `v0.6.0-pre.5` tag 的 source build（`git worktree add` 到 scratch 目錄 + `npx vite build`），回報區註明 |
| SSH config | **先隔離，失敗再暫改**（見下節） |
| 派發模式 | yolo + no-interactive |

## 驗收項目

| # | 項目 | 來源 | 自動化判定 |
|---|---|---|---|
| A1 | Custom CLI 持久化 | T0496 | 隔離實例 Settings → Custom CLI Agents 新增一筆（UI 操作，不直接寫檔）→ 關閉 → 以同 userData 重啟 → 清單仍在；`<隔離 userData>/custom-clis.json` 存在且內容對應 |
| A2 | detached 關窗 flush | T0504 / T0508 | 以**安裝版 exe** 跑既有 `e2e/detached-flush-on-close.spec.ts`、`e2e/detached-close-edges.spec.ts`、`e2e/detached-terminal-persistence.spec.ts`、`e2e/detached-workspace.spec.ts` 全綠。若 fixture 不支援指定 executable，在 `e2e/fixtures/` 加 opt-in env（例 `BAT_E2E_EXECUTABLE`），**未設時行為不變** |
| A3 | BUG-119 搬移（隔離模擬） | T0480 | 以安裝版 exe 跑 `e2e/bug119-userdata-unification.spec.ts`（同 A2 的 executable 切換）；另在隔離環境預置「舊小寫目錄」佈局（Local State / snippets.json / message-archives）後首次啟動，檢查 marker、Local State 複製、snippets 合併、舊目錄保留；Settings 調日誌等級 → 重啟後仍有效 |
| A4 | BUG-119 真環境（唯讀） | T0480 第 1 點 | 真實 `%APPDATA%\BetterAgentTerminal\server-token.json` 與舊目錄同名檔（若存在）SHA-256 比對、mtime 早於 pre.5 首次啟動；`Logs\` 內首次升版日誌有 `[userdata-migration]` 行（貼原文）；舊 `%APPDATA%\better-agent-terminal\` 除 `message-archives/*.jsonl` 外未變（列目錄 + mtime）。**只讀** |
| A5 | BUG-114 派發 | BUG-114 生效條件 | 對**隔離實例**的 RemoteServer（它自己的 port / token，從隔離 userData 讀），用**安裝版** helper `C:\Program Files\BetterAgentTerminal\resources\scripts\bat-terminal.mjs` 派發 ≥ 20 次 raw command 分頁（含 ≥ 5 組兩支同時派發；期間讓另一分頁持續大量輸出以製造 `pty:output` 廣播）。判定：每次 helper exit 0、helper 記錄 `responseType: invoke-result`、隔離實例日誌有對應 `remote-server terminal-created`、分頁實際出現；0 遺失。helper 日誌 env 指向 temp（`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA`），不寫入使用者真實 `bat-scripts.log` |
| A6 | SSH alias 精靈 | T0505 第 7 節 1-3、5、6；T0506 | 在 WSL 內 Docker 起 `bat-t0510-target`（sshd + 金鑰登入；可沿用 T0467 Dockerfile 模式）與 `bat-t0510-jump`（跳板），target 只能經 jump 到達（或以其他方式證明真的走了 ProxyJump，例 target 只接受來自 jump 的連線）。ssh config alias：(1) `HostName` + `User` + `IdentityFile`，無 `Port` 與自訂 `Port` 各一；(2) 經 `ProxyJump`；(3) **無 `User`** 且本機登入名 ≠ 遠端帳號 → `verify-ssh-auth` 以 `permission-denied` 失敗，且可跳回 configure 改手動 `user@host:port` 後成功。每個 alias：隔離實例中以 wizard 完整跑完 → profile 建立 → SshDetails 空 user / 無 port 顯示正確（T0506，截圖）→ 關閉重開後連線成功。(5) 只驗 **Windows 內建 OpenSSH**（`C:\Windows\System32\OpenSSH\ssh.exe`），mac / Linux 標 N/A。(6) 既有手動 `user@host:port` profile 連線不受影響（可用 T0467 的 `plan039-real-remote` 環境回歸，或本單容器手動 profile）。T0505 第 4 項（`loginctl enable-linger`）容器無 systemd 時標 N/A 並說明 |

## SSH alias 規則（使用者裁決：先隔離、失敗再暫改）

1. **先試隔離**：隔離實例啟動時把 `USERPROFILE` / `HOME` 指向本單 temp 目錄，在其 `.ssh\config` 放 alias。確認兩件事：BAT 的 `listSshHosts` 列得出 alias，且 **Windows 內建 `ssh.exe` 實際讀的是該 config**（例：`ssh -G <alias>` 在同 env 下輸出的 hostname / port / proxyjump 符合）。兩者都成立才算隔離成功。
2. **隔離不成立才暫改真實 `~/.ssh/config`**：
   - 先把原檔複製到本單 temp 目錄並記錄 SHA-256（原檔不存在則記錄「不存在」）
   - 只在檔尾附加一段，前後以 `# >>> bat-t0510 temporary (remove) >>>` / `# <<< bat-t0510 temporary <<<` 標記；alias 名稱前綴 `bat-t0510-`
   - alias 區塊內一律指定 `IdentityFile`、`UserKnownHostsFile`（皆指向本單 temp 目錄）與 `StrictHostKeyChecking accept-new`，**不寫入真實 known_hosts**
   - 收尾（含失敗 / 中斷路徑，用 try/finally）還原原檔，驗證 SHA-256 與備份相同（原本不存在則刪除）；回報區附還原前後雜湊
   - 回報區寫出手動還原指令，以防工具中斷
3. 不論哪條路徑，BAT 隔離實例的 SSH profile 只指向本單容器。

## 產出

- `e2e/` 下 opt-in spec 與環境腳本（例 `e2e/pre5-acceptance.spec.ts`、`e2e/real-remote/t0510-ssh-alias-env.mjs`）：**預設 skip**，僅在 env（例 `BAT_E2E_PRE5_ACCEPTANCE=1` + 必要連線參數）齊全時執行；一般 `npm run test:e2e` / CI 不受影響
- 環境腳本 `up` / `down`，一行可重跑
- 回報區：每項 PASS / FAIL / N/A + 證據（log 原文行、截圖路徑、雜湊、耗時）

## 驗收條件

- [ ] A1-A6 全部有判定與證據；全 PASS（N/A 有理由）寫 `DONE`，否則 `PARTIAL`
- [ ] 新 spec env 未設時 0 failed（skip）；fixture 改動未設 env 時行為不變（跑一次 `e2e/smoke.spec.ts` 回歸）
- [ ] 收尾：`docker ps -a --filter label=bat.t0510=1` 為空；若曾暫改 `~/.ssh/config`，還原後雜湊與備份一致
- [ ] 未改 `electron/**` / `src/**` / `scripts/**`；未碰使用者 BAT 實例與真實 userData（只讀）
- [ ] 回報區列出**仍需真人**的項目：真實 OS 拖放 / 圖片附件（BUG-107 / 108）、視覺 / UX，以及任何本單判定為無法自動化者

## Sub-session 執行指示

1. 讀本工單、T0467 回報區與 `e2e/real-remote/`、`e2e/fixtures/electron-isolation.ts`、上表各來源段落
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先做可行性探測：Playwright 能否啟動安裝版 exe（隔離 userData / `--runtime=<N>` 不撞使用者實例的 single-instance lock 與 port 9876）、WSL docker 可用、SSH 隔離是否成立。阻塞 → 回報區說明，`BLOCKED`，不違反 memory_overrides 硬改
4. 實作 → 實跑 → 填回報區
5. commit 本單改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫
