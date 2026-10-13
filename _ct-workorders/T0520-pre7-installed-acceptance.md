---
schema_version: 1
schema_kind: workorder
id: T0520
title: "pre.7 已安裝版自動化實機驗收：BUG-123 遠端狀態燈、BUG-124 SSH forwarding 被拒訊息、BUG-125 / 126 commands / skills 描述"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-verify-pre7
priority: P1
sizing: M
created_at: "2026-10-14T04:52:55+0800"
started_at: "2026-10-14T04:54:04+0800"
updated_at: "2026-10-14T05:07:27+0800"
completed_at: "2026-10-14T05:07:27+0800"
target_version: "0.6.0-pre.7（驗收，不發版）"
related:
  - "BUG-123 / T0513（`e2e/t0513-profile-status-light.spec.ts`，source build 版；回報區『真實 WSL profile 實機驗收 需真人』）"
  - "BUG-124 / T0517（回報區含 source build W7(a) `BUG-124.message` 做法）"
  - "BUG-125 / T0518、BUG-126 / T0519（`electron/__tests__/claude-scan-skills-description.test.ts` 案例可當 fixture 參考）"
  - "T0514（`e2e/real-remote/t0514-env.mjs`：WSL Docker 內跑安裝檔 baseline headless bat-server；`claude:*` recorder 不耗 token 做法）"
  - "T0515（`e2e/real-remote/t0515-wizard-env.mjs` + `t0515-sshd.Dockerfile`：容器 sshd、`AllowTcpForwarding no` 情境、`~/.ssh/config` 標記區塊 + 雜湊還原）"
affects_files:
  - e2e/pre7-acceptance.spec.ts
  - e2e/real-remote/
  - e2e/fixtures/
  - _ct-workorders/T0520-pre7-installed-acceptance.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只寫驗收工具 / opt-in spec，不改產品程式碼**（`electron/**`、`src/**`、`scripts/**`、`package.json` 不動）。發現產品缺陷 → 回報區記證據，該項 FAIL、整單 PARTIAL，**不自行修**。BUG 檔與 `_bug-tracker.md` 不動。"
  - "🔴 **受測 build = 已安裝的 pre.7**：`C:/Program Files/BetterAgentTerminal/BetterAgentTerminal.exe`（FileVersion `0.6.0-pre.7`，開工時先確認），Playwright 隔離實例（獨立 `--runtime` / userData，`BAT_REMOTE_PORT` 用空閒埠）。headless server / 精靈 bundle 一律用 pre.7 安裝檔內建 baseline（`resources/bat-server-baseline/`，回報區註明檔名與 manifest version）。"
  - "🔴 **不碰使用者正在用的 BAT**（port 9876、真實 userData 只讀）；不得連線、停止或改動 WSL 內使用者的 bat-server（port 9877、`~/.local/bat-server`）。不得對 Ubuntu-24.04 發行版跑 WSL 精靈的安裝步驟。"
  - "🔴 **不得消耗 Claude token**（不啟動 Claude session；需要時沿用 T0514 的 recorder 做法）。使用者真實 `~/.claude` 只讀。"
  - "🔴 **Docker / WSL**：只建立、操作、刪除名稱前綴 `bat-t0520-` 且帶 label `bat.t0520=1` 的容器 / network / volume / image；不得 `docker system prune`、不得動其他容器 / image（含 `bat-t0514-*` / `bat-t0515-*`，可**讀** / 以 build 參照其 Dockerfile，但不重用其容器）；不得 `wsl --shutdown` / `--terminate`；收尾刪除本單容器 / network（image 可保留並列出）。"
  - "🔴 **`~/.ssh/config`**：沿用 T0510 / T0515 做法（標記區塊，事前備份 + SHA-256，收尾還原並以雜湊證明一致）。真實 `known_hosts` / `authorized_keys` / 金鑰不動（測試金鑰放 scratch）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 `npm run test:e2e`（L141）。commit 用精準 `git add` 或 `git commit --only`。工作樹裡 `src/styles/settings.css` 顯示 M（內容無差異），不要動它、不要提交它。"
---

# T0520 — pre.7 已安裝版自動化實機驗收

## 背景

`v0.6.0-pre.7`（run `38461996096` @ `b77f3cc`）已發佈，使用者本機已安裝（FileVersion `0.6.0-pre.7`）。pre.7 修了 BUG-123 至 126，四張都是 ✅ FIXED、等實機驗收。修正工單驗的都是 source build（T0513 / T0517 / T0518 / T0519），本單改用**已安裝的 pre.7 exe**再驗一次，做法沿用 T0514 / T0515 已驗證可行的那套。

每項請先讀對應 BUG 檔，以及修正工單回報區的「需實機驗收」段，再依那裡寫的情境設計步驟。

## 驗收項目

| # | BUG | 驗收重點（以 BUG 檔為準） |
|---|---|---|
| V1 | BUG-123 | 配置（Profile）對話框的遠端卡片燈號。用 WSL Docker 內**真的 headless bat-server**（pre.7 baseline，比照 `t0514-env.mjs`，本單另寫 `t0520-*`）當目標，不用 T0513 那種 loopback 到自己 RemoteServer 的做法。headless server 對 `profile:list` 回空 stub，這正是 BUG 的觸發條件。要驗四種狀態：(a) 該 profile 視窗開著 → 🟢 connected；(b) 視窗關掉、`IDLE_GRACE_MS` 15 s 過後，對話框不重開，燈號應轉成 idle，不能是紅燈；(c) 目標埠關閉的 profile → 🔴 並附原因；(d) SSH 卡片沒開過 → ⚪ idle。以截圖 + DOM class / 文字判定。真實 WSL `Ubuntu-24.04` profile 一律不碰，記為 `V1.wsl-real` NEEDS-HUMAN |
| V2 | BUG-124 | SSH 精靈遇到 sshd `AllowTcpForwarding no`：`fetch-fingerprint`（或 `connect-test`）失敗訊息應是「目標 sshd 不允許 port forwarding」類文字（`wizard.ssh.error.forwardingDenied`），附 ssh 原文那一行（`administratively prohibited`），不能再是「伺服器埠上的程式沒有提供 TLS 憑證」。至少驗 zh-TW 與 en 兩種語言，截圖。取消後 rollback 仍正常：stepper 顯示 `rolled-back`、遠端已清空 |
| V3 | BUG-124 回歸 | 同一個 sshd 改回允許 forwarding，精靈要能完整走完（bundle 在 `<installPath>/bin/bat-server`、服務 LISTEN localhost、指紋 = 容器 cert），確認 T0517 的查詢沒有影響成功路徑 |
| V4 | BUG-125 | 隔離實例開一個 fixture 專案（放在 scratch / temp），內含 `.claude/commands/` 下三種檔案：有 frontmatter 且有 `description:`、有 frontmatter 但沒有 `description`、沒有 frontmatter（首行 `# Title`）。`claude:scan-skills` 結果與 Claude 面板 `/` 選單顯示：分別應為 frontmatter 的 description、frontmatter 結束後的第一個非空行（去掉 `#`）、首行去掉 `#`。不能出現 `---` |
| V5 | BUG-126 | 同一個 fixture 的 `.claude/skills/<name>/SKILL.md`：沒有 `description` 的 skill，description 應為 frontmatter 結束後的第一個非空行，不是空字串。另外要涵蓋 CRLF 檔與 frontmatter 未關閉兩種情況。star commands（`claude:scan-star-commands`）的 `ct-help`，若使用者 `~/.claude` 有就只讀它，沒有就用 fixture，description 不能為空 |
| V6 | 連帶 | V4 / V5 也在**遠端視窗**跑一次：fixture 放在 V1 的 headless 容器內，`claude:scan-skills` 經 remote 路由走 server 端 pre.7 bundle 的程式碼。若容器內 bundle 不含 T0518 / T0519 的修正，記 FAIL 並附 bundle 版本 |

每項標 PASS / FAIL / NEEDS-HUMAN，並附證據：截圖、DOM、IPC 回傳、遠端指令輸出、指紋比對。

## 驗證

- 新增 opt-in spec `e2e/pre7-acceptance.spec.ts`：以環境變數 gate（例如 `BAT_E2E_PRE7=1` + `BAT_E2E_EXECUTABLE`），預設 skip。
- 環境腳本新增在 `e2e/real-remote/t0520-*`。T0514 / T0515 既有腳本的行為不改；要共用時改成新增函式，不動既有簽章。
- 回報區附執行指令、結果（passed 數、耗時）與證據目錄。
- 收尾確認三件事：
  - 本單容器 / network 已刪
  - `~/.ssh/config` 雜湊與開工前一致
  - 隔離 userData 已刪，Terminal Server 不殘留

## 驗收條件

- [ ] V1-V6 各有 PASS / FAIL / NEEDS-HUMAN 與證據
- [ ] 確認受測 exe FileVersion = `0.6.0-pre.7`；baseline tarball 版號 = `0.6.0-pre.7`
- [ ] 未改產品程式碼；未碰使用者 BAT / WSL bat-server / 真實 `~/.claude`（只讀）；未耗 Claude token
- [ ] `~/.ssh/config` 已還原（雜湊證明）、環境清理完成

## Sub-session 執行指示

1. 讀本工單、相關 BUG 檔（123-126）、T0513 / T0517 / T0518 / T0519 回報區、T0514 / T0515 的環境腳本與 spec
2. 填 `started_at`、`status: IN_PROGRESS`（時間用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取，R-G001）
3. 實作 → 執行 → 填回報區（DONE：每項都有結論；PARTIAL：有 FAIL 或沒做完）
4. 用精準 `git add` / `--only` commit 本單產出；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。V1–V6 全部有結論：17 項 PASS、0 FAIL，1 項 NEEDS-HUMAN（`V1.wsl-real`，依工單規定不碰真實 WSL profile）。已安裝的 pre.7 對 BUG-123 / 124 / 125 / 126 的修正都有效，包含遠端容器內 pre.7 server bundle 的 T0518 / T0519 修正。沒有發現產品缺陷。

- 開工 `2026-10-14T04:54:04+0800`（系統時間）；派發 `CT_MODE=yolo`、`CT_INTERACTIVE=0`；執行期間沒有使用者中途指示
- 最終完整執行（env up 之後，兩條 lane 一起跑）：`5 passed (1.3m)`，exit 0，開始於 `2026-10-14T05:04:39+0800`
- 未設 `BAT_E2E_PRE7` 時：`5 skipped`

| # | BUG | 判定 | 主要證據 |
|---|---|---|---|
| ENV | — | ✅ PASS | 受測 exe `C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe` FileVersion `0.6.0-pre.7`，隔離實例 `app.getVersion()` = `0.6.0-pre.7`；baseline `resources\bat-server-baseline\bat-server-linux-x64-v0.6.0-pre.7.tar.gz`，manifest version `0.6.0-pre.7`，sha256 `67af2584d0091d806c69bc7212ee949b4d618aaa39f93abf3b99db82f4f2e36b`（env script 實際重算，與 manifest 相符）；容器內 bundle `package.json` version `0.6.0-pre.7` |
| V1 | BUG-123 | ✅ PASS（`V1.wsl-real` NEEDS-HUMAN） | 目標是 WSL Docker 內**真的** pre.7 headless bat-server（`bat-t0520-srv`），它的 `profile:list` 回 `{"profiles":[],"activeProfileIds":[]}`，也就是 BUG 的觸發條件。(a) profile 視窗開著 → `data-status=connected`，tooltip「已連線：本機持有此 profile 的連線」；(b) 關掉視窗、對話框保持開著不重開 → **15132 ms** 後直接 `connected → idle`，期間沒有出現 `disconnected`，tooltip「未連線：未開視窗（未檢查伺服器）」；(c) 埠已關閉的 WSL 型 profile → `disconnected`，tooltip「連線失敗：無法連線 (connect ECONNREFUSED 127.0.0.1:<port>)」；(d) 沒開過的 SSH 卡片 → `idle`，tooltip「未連線：未開視窗（未檢查伺服器）」。另外加測：指向同一台 headless server、但沒開視窗的 profile → `idle`，tooltip「未連線：未開視窗，伺服器可連線」 |
| V2 | BUG-124 | ✅ PASS（zh-TW、en 兩種語言） | sshd `AllowTcpForwarding no` → `fetch-fingerprint` failed（`start-server` completed）。畫面顯示 zh-TW「SSH 伺服器不允許 port forwarding」/ en「The SSH server does not allow port forwarding」，加上 body（含 `AllowTcpForwarding`）與 ssh 原文 `channel 2: open failed: administratively prohibited: open failed`。舊訊息「TLS 握手失敗 / 伺服器埠上的程式沒有提供 TLS 憑證…」（en 版亦同）**沒有出現**；`ssh:verify-tunnel-status` 回 `{"forwardingDenied":true,…}`。按 Cancel 後 stepper 的 `fetch-fingerprint` / `start-server` / `install-server-bundle` 皆為 `rolled-back`；遠端 `state=inactive`、unit 與 `~/.local/bat-server` 皆 `No such file`、`listen9876=0`；沒有建立 profile、沒有 rollback 警告 |
| V3 | BUG-124 回歸 | ✅ PASS | 拿掉 drop-in 後（`allowtcpforwarding yes`），乾淨目標上的精靈 13.9 s 完成。`~/.local/bat-server` = `README.md bin electron node_modules package.json scripts`，`bin/bat-server` 可執行，bundle `0.6.0-pre.7`；`ExecStart=/home/bat/.local/bat-server/bin/bat-server --port 9876 --bind-interface localhost`；MainPID 自己 `LISTEN 127.0.0.1:9876`（無 0.0.0.0 / `*`）；profile 指紋 = 容器 `server-cert.json` 指紋（`71:5F:1C:49:…:B5:76:D1`）；log 有 `✓ TLS fingerprint matches the remote server-cert.json`。**成功路徑 `ssh:verify-tunnel-status` 呼叫 0 次**，T0517 的查詢只在失敗時觸發。新 profile `useSshTunnel: true`，開視窗後遠端 shell 回 `T0520-bat@bat-t0520-sshd-25` |
| V4 | BUG-125 | ✅ PASS | 本機 fixture 專案的 `claude:scan-skills` 與 Claude 面板 `/t0520` 選單結果一致：有 description → `T0520 command from frontmatter`；frontmatter 無 description → `T0520 command line after frontmatter`；無 frontmatter（`# Title`）→ `T0520 plain command title`；另加 CRLF 無 description → `T0520 CRLF command after frontmatter`。scan 結果（共 74 筆，含使用者 `~/.claude` 的 66 筆 global）與選單中都**沒有** `---` |
| V5 | BUG-126 | ✅ PASS | skills：有 description → `T0520 skill from frontmatter`；無 description → `T0520 skill line after frontmatter`（不是 `''`）；CRLF 無 description → `T0520 CRLF skill after frontmatter`；frontmatter 未關閉 → `''`（T0519 規格：未關閉回空字串，選單顯示空描述）。star commands：使用者 `~/.claude/skills/ct-help` 存在且有 description（只讀），`*help` 與 scan 結果 = frontmatter description（非空）。fallback 情境（ct-help 沒有 description）由 V6 容器 fixture 涵蓋 |
| V6 | 連帶 | ✅ PASS | 從 docker-linux 遠端視窗（mount `C:\bat-t0520-virt\work` ↔ `/work`，Windows 上這個路徑不存在）呼叫：`claude:scan-skills` 的 8 個 fixture 結果都與 V4 / V5 預期相同；`claude:scan-star-commands` 掃容器 `/home/bat/.claude/skills`，`help`（ct-help **無 description**）→ `T0520 remote ct-help line after frontmatter`，`t0520crlf`（CRLF）→ `T0520 remote CRLF star line`；遠端 Claude 面板 `/` 與 `*` 選單顯示相同。對照組：本機視窗以同一路徑掃描，t0520 項目 0 筆，可見結果出自容器內 pre.7 bundle（0.6.0-pre.7）的程式碼 |

### Landing zone

**PASS**。C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1 PASS。C-3（informational）：`e2e/real-remote/`、`e2e/fixtures/` 存在，`e2e/pre7-acceptance.spec.ts` 為新檔，祖先 `e2e/` 存在。C-2：沒有 `branch` 欄位，HEAD 在 `main`。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 做法

- **隔離實例**：沿用 `e2e/fixtures/electron-isolation.ts`（未修改），以 `BAT_E2E_EXECUTABLE` 啟動已安裝的 pre.7 exe。每次都是獨立的 `--runtime=e2e-t0520-*`、獨立 userData，RemoteServer 用空閒埠，繼承的 `BAT_*` / `CT_*` 一律剔除。UI lane 共用 1 個實例；V2 zh-TW、V2 en、V3 各用 1 個實例。
- **不耗 token**：UI lane 實例在任何 Claude 面板掛載前，就把 37 個 `claude:*` ipcMain handler 換成 recorder（T0514 做法）。只有 `scan-skills` / `scan-star-commands` / `list-sessions` 與 archive 三個保留真實 handler。recorder 實際收到的是 `auth-status` / `start-session` / `get-session-meta` / `get-statusline-extras`（本機與遠端面板各 1 組），沒有任何呼叫到達 CLI 或 API。選單只輸入文字、不送出。
- **語言**：用 `settings.save` 寫入 `language`，reload 後以「+ 更多 ▾ / + More ▾」按鈕文字確認語言已切換。
- **V2 / V3 觀測**：在隔離實例 main 行程內，把 `ssh:verify-tunnel-status` 包成 pass-through recorder（先執行原 handler，再記錄參數與回傳）。這是測試側攔截，沒有改產品。
- **遠端環境**（`e2e/real-remote/t0520-env.mjs`，WSL `Ubuntu-24.04` 的 Docker 29.1.3）：
  - `bat-t0520-srv`：`t0520-server.Dockerfile` + 安裝檔內建的 pre.7 linux-x64 baseline（無 overlay），並放入 fixture。對 Windows 只發佈 `127.0.0.1:29520`
  - `bat-t0520-sshd`：`t0520-sshd.Dockerfile`，systemd + sshd，帳號 `bat`，只發佈 `127.0.0.1:22520`
  - 兩者都有 label `bat.t0520=1`；沒有建立 network / volume。V2 以 `00-t0520-noforward.conf` drop-in 關閉 forwarding，結束時在 `finally` 移除

### 產出（皆為新檔，未改既有檔）

```
e2e/pre7-acceptance.spec.ts              opt-in spec（BAT_E2E_PRE7=1 + BAT_E2E_EXECUTABLE + connection.json；預設 skip）
e2e/real-remote/t0520-env.mjs            up / status / apply-ssh-config / restore-ssh-config / down [--rmi]
e2e/real-remote/t0520-server.Dockerfile  pre.7 headless bat-server + fixture
e2e/real-remote/t0520-sshd.Dockerfile    SSH 精靈目標
e2e/fixtures/t0520-skill-fixtures.json   commands / skills fixture 與預期值（本機 spec 與容器共用）
```

T0514 / T0515 的腳本與 Dockerfile 都沒有改動，也沒有被 import。`t0520-env.mjs` 只 import `scripts/smoke-remote-headless.mjs` 的 `decodeTokenFile` / `normalizeFingerprint` / `parseFingerprintField`（與 T0514 相同）。

### 執行方式

```powershell
node e2e/real-remote/t0520-env.mjs up        # 約 1–2 分鐘（首次 build）；寫 %TEMP%\bat-t0520\env\connection.json
$env:BAT_E2E_PRE7='1'; $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
npx playwright test e2e/pre7-acceptance.spec.ts     # 約 80 s；wizard lane 的 beforeAll / afterAll 會套用並還原 ~/.ssh/config
node e2e/real-remote/t0520-env.mjs down      # 刪容器與 state（保留 evidence/）；--rmi 會連 image 一起刪
```

- 開發期間另外分 lane 跑過 1 次：UI lane `2 passed (19.7s)`、wizard lane `3 passed (59.4s)`，兩次都一次通過（log 在 `evidence\dev-runs\`）
- **證據目錄** `%TEMP%\bat-t0520\evidence\`：
  - `results.json`：每項判定與證據
  - `final-run.log`、`env-up.log`、`env-down.log`
  - V1：`v1-dialog-window-open.png`、`v1-unreachable-tooltip.png`、`v1-dialog-after-idle-release.png`
  - V2：`v2-{zh-TW,en}-failed.png`、`v2-{zh-TW,en}-after-cancel.png`、`v2-*-failure-detail.txt`、`v2-*-wizard-log.txt`
  - V3：`v3-wizard-complete.png`、`v3-profile-connected.png`、`v3-install-evidence.txt`、`v3-wizard-log.txt`
  - V4 / V5 / V6：`v4-v5-local-slash-menu.png`、`v5-local-star-menu.png`、`v6-remote-{slash,star}-menu.png`、`v4-v5-local-scan-skills.json`、`v6-remote-scan-{skills,star-commands}.json`
  - 各隔離實例的 main log：`instance-*.log`

### 環境清理與隔離

- **Docker**：`down` 之後，label `bat.t0520=1` 的 containers / networks / volumes 皆為 `none`，WSL `docker ps -a` 為空。保留 image 供重跑：`bat-t0520-srv:local`（`9dbf102fd355`，2.35GB）、`bat-t0520-sshd:local`（`1e87066b3129`，184MB），用 `down --rmi` 可刪。沒有動其他 container / image（含 `bat-t0514-*` / `bat-t0515-*`），沒有 prune，也沒有 `wsl --shutdown` / `--terminate`。
- **`~/.ssh/config`**：開工前 sha256 `00aab1cda8667c85db60b35f406a785bd9a909b87df7cf49aa78450ca03c58a2`。套用標記區塊後為 `f6a56ffc…`，每次 afterAll 都還原（`backup copied back … match=true`）。收尾再跑 `sha256sum` = `00aab1cd…c58a2`，與開工前相同。真實的 `known_hosts` / 金鑰沒有被讀寫，測試金鑰放在 `%TEMP%\bat-t0520\env`，已隨 `down` 刪除。
- **隔離實例**：每次執行的 Terminal Server 都是 `alive after teardown: false`，`runtime userData removed: true`；`%APPDATA%` 下沒有殘留 `runtime-e2e-t0520*`。fixture 暫存目錄已刪。
- **使用者環境**：使用者的 BAT（9876）從未連線；WSL bat-server（9877、`~/.local/bat-server`）從未讀取或連線；沒有對 Ubuntu-24.04 跑 WSL 精靈。真實 `~/.claude` 只讀（`ct-help/SKILL.md` 與 global skills 的掃描）。沒有消耗 Claude token。
- **產品程式碼**：未改。`electron/**`、`src/**`、`scripts/**`、`package.json`、`e2e/fixtures/electron-isolation.ts` 都沒有變動。BUG 檔與 `_bug-tracker.md` 也沒有動。`src/styles/settings.css` 的既有 M 狀態沒有碰，也不在本單 commit 中。

### 偏差 / 說明

1. **V1 的 (a)(b) 用 docker-linux profile，不用 wsl-linux**：wsl-linux profile 開視窗時，path translator 需要 `wslDistro`（`electron/remote/path-translator.ts`）；一旦填了 distro，WSL keep-alive 就會對該 distro spawn `wsl.exe`。填真實的 `Ubuntu-24.04` 違反本單規則，填假名則有未知副作用。BUG-123 的觸發條件是 headless `profile:list` 的空 stub，與 targetOS 無關，因此改用 docker-linux 指向同一台 headless server。(c) 的 WSL 型卡片沒有填 `wslDistro`、也不開視窗（T0513 做法），keep-alive 會跳過它。真實 WSL profile 列為 `V1.wsl-real` NEEDS-HUMAN。
2. **V1 (b) 的 idle tooltip 是「未檢查伺服器」**：釋放連線後不會重新探測，這是 T0513 回報區已記錄的已知限制，不屬於 FAIL。燈號是 ⚪ idle，不是 🔴。
3. **V5 frontmatter 未關閉的預期值是 `''`**：依 BUG-126 / T0519 的規格（「frontmatter 未關閉回 `''`」），選單中該列顯示空描述，屬預期行為。
4. **V5 star commands 本機部分**：使用者 `~/.claude` 已有 ct-help，依工單規定只讀它（它有 description）。「ct-help 沒有 description」的 fallback 由 V6 容器 fixture 驗證。

### 仍需真人

1. `V1.wsl-real`：在 pre.7 開啟使用者自己的 WSL Ubuntu-24.04 profile 視窗，再打開配置對話框，該卡片應為 🟢；關掉視窗 15 秒後應轉為 ⚪，不能是 🔴。

### 驗收條件對照

- [x] V1-V6 各有 PASS / FAIL / NEEDS-HUMAN 與證據（17 PASS、1 NEEDS-HUMAN、0 FAIL）
- [x] 受測 exe FileVersion = `0.6.0-pre.7`；baseline tarball 版號 = `0.6.0-pre.7`（manifest 與容器內 `package.json` 一致）
- [x] 未改產品程式碼；未碰使用者 BAT / WSL bat-server / 真實 `~/.claude`（只讀）；未耗 Claude token
- [x] `~/.ssh/config` 已還原（雜湊證明）、環境清理完成（image 保留並列出）

### Commit

以 `git add` 加入 5 個新檔，再用 `git commit --only` 提交這 5 個檔與本工單，不含 `src/styles/settings.css`；未 push。hash 見 `git log`（commit message 含 `T0520`）。
