---
schema_version: 1
schema_kind: workorder
id: T0520
title: "pre.7 已安裝版自動化實機驗收：BUG-123 遠端狀態燈、BUG-124 SSH forwarding 被拒訊息、BUG-125 / 126 commands / skills 描述"
type: implementation
status: TODO
repo: better-agent-terminal
project: BUG-verify-pre7
priority: P1
sizing: M
created_at: "2026-10-14T04:52:55+0800"
started_at: null
updated_at: "2026-10-14T04:52:55+0800"
completed_at: null
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

（Worker 填寫）
