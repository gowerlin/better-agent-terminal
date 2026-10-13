---
schema_version: 1
schema_kind: workorder
id: T0515
title: "pre.6 已安裝版自動化實機驗收（設定精靈線）：SSH 精靈 BUG-120 / 121 / 088 / 093 / 098 / 100、取消與 rollback BUG-099 / 111、Docker BUG-097"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-verify-pre6
priority: P1
sizing: L
created_at: "2026-10-14T03:42:23+0800"
target_version: "0.6.0-pre.6（驗收，不發版）"
related:
  - "T0510 A6（SSH 精靈真流程，`e2e/pre5-ssh-alias.spec.ts`、`e2e/real-remote/t0510-ssh-alias-env.mjs`、`t0510-sshd.Dockerfile`；SSH config 標記區塊 + 備份 / 雜湊還原做法）"
  - "T0511（BUG-120 / 121 修正，回報區含 `e2e/pre5-ssh-alias.spec.ts` 實機驗證方式）"
  - "並行：T0514（UI 線）、T0516（建置產物線）"
affects_files:
  - e2e/pre6-wizard-acceptance.spec.ts
  - e2e/real-remote/
  - e2e/fixtures/
  - _ct-workorders/T0515-pre6-setup-wizard-acceptance.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只寫驗收工具 / opt-in spec，不改產品程式碼**（`electron/**`、`src/**`、`scripts/**`、`package.json` 不動）。發現產品缺陷 → 回報區記證據，該項 FAIL、整單 PARTIAL，**不自行修**。BUG 檔與 `_bug-tracker.md` 不動。"
  - "🔴 **受測 build = 已安裝的 pre.6**：`C:/Program Files/BetterAgentTerminal/BetterAgentTerminal.exe`（FileVersion `0.6.0-pre.6`），Playwright 隔離實例（獨立 `--runtime` / userData）。精靈的 server bundle 來源用 pre.6 安裝檔內建 baseline 或 `server-bundle-v0.6.0-pre.6` release（回報區註明實際來源）。"
  - "🔴 **不碰使用者正在用的 BAT**（port 9876、真實 userData 只讀）；不得連線、停止或改動 WSL 內使用者的 bat-server（port 9877、`~/.local/bat-server`）。不得對 Ubuntu-24.04 發行版跑 WSL 精靈的安裝步驟。"
  - "🔴 **不得消耗 Claude token**。"
  - "🔴 **Docker / WSL**：只建立、操作、刪除名稱前綴 `bat-t0515-` 且帶 label `bat.t0515=1` 的容器 / network / volume；不得 `docker system prune`、不得動其他容器（含 `bat-t0467-*` / `bat-t0510-*` / `bat-t0514-*`）；不得 `wsl --shutdown` / `--terminate`；收尾刪除本單容器 / network（image 可保留並列出）。"
  - "🔴 **`~/.ssh/config`**：沿用 T0510 做法（Windows OpenSSH 不吃隔離 HOME → 加標記區塊，事前備份 + 雜湊，收尾還原並以雜湊證明一致）。真實 `known_hosts` / `authorized_keys` / 金鑰不動（測試金鑰放 scratch）。"
  - "🔴 與 T0514 / T0516 並行：本單只新增上列 affects_files；共用 fixture 若要改，改成**新增**函式，不改既有簽章。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 `npm run test:e2e`（L141）。commit 用精準 `git add` 或 `git commit --only`。"
---

# T0515 — pre.6 已安裝版自動化實機驗收（設定精靈線）

## 背景

使用者要求把「已修復待實機驗收」的 BUG 盡量自動化（2026-10-14 第六十 session）。本單是三條並行線之一：**WSL 以外的設定精靈真流程**。SSH 目標用容器化 sshd（沿用 T0510 / T0511），在已安裝 pre.6 exe 的隔離實例上把精靈從頭跑到底，再驗產物（遠端安裝目錄、systemd unit、監聽埠、pin 的指紋）。

每項請先讀對應 BUG 檔與修正工單回報區的「需實機驗收」段，依那裡寫的情境設計步驟。

## 驗收項目

| # | BUG | 驗收重點（以 BUG 檔為準） |
|---|---|---|
| W1 | BUG-120 | 精靈上傳 bundle 後落在 `<installPath>/bin/bat-server`（無 `staging/` 子目錄） |
| W2 | BUG-121 | 服務以 `--port <serverPort> --bind-interface localhost` 啟動、在該埠 LISTEN；verify 步驟通過 |
| W3 | BUG-088 | systemd unit 不含字面 `~`，服務可啟動 |
| W4 | BUG-093 | 驗證階段經 SSH tunnel 取得指紋：pin 進 profile 的指紋 = 容器內 bat-server 的指紋（不是本機 9876 的） |
| W5 | BUG-098 | 精靈不再提供 direct 模式（或 direct 路徑已移除）；tunnel 模式完整可用 |
| W6 | BUG-100 | `ssh.stopServer` / `ssh.uninstallBundle` 實際生效（服務停止、安裝目錄移除） |
| W7 | BUG-099 | 精靈在某步驟失敗後按取消 → 該失敗步驟也被 rollback |
| W8 | BUG-111 | rollback 不刪 / 不停使用者自己的資源（先建一個 `bat-t0515-user-owned` 容器或目錄當「使用者既有資源」，rollback 後仍在） |
| W9 | BUG-097 | Docker 精靈：遠端埠只綁 localhost（非全介面）、容器內 bind 可達、HEALTHCHECK 有效。若本機 Docker 環境無法讓精靈跑完（Windows `docker.exe` 指向哪個 daemon 請先確認），標 NEEDS-HUMAN 並說明卡點 |
| W10 | （連帶）SSH alias | 無 `User`、含 `ProxyJump` 的 alias 走完精靈（T0505 / T0506 實機 6 項，T0510 A6 未完成的部分） |

每項標 PASS / FAIL / NEEDS-HUMAN，附證據（遠端指令輸出、unit 檔內容、`ss` / `/proc/net/tcp` 監聽、指紋比對、截圖）。

## 驗證

- 新增 opt-in spec `e2e/pre6-wizard-acceptance.spec.ts`（環境變數 gate，例如 `BAT_E2E_PRE6_WIZARD=1`，預設 skip）；可重用 / 擴充 `e2e/real-remote/` 下的環境腳本（新增檔案，不改 T0510 既有腳本行為）
- 回報區附執行指令與結果
- 收尾：本單容器 / network 已刪、`~/.ssh/config` 雜湊與事前一致、隔離 userData 已刪

## 驗收條件

- [ ] W1-W10 各有 PASS / FAIL / NEEDS-HUMAN 與證據
- [ ] 未改產品程式碼；未碰使用者 BAT / WSL bat-server
- [ ] `~/.ssh/config` 還原（雜湊證明）、環境清理完成

## Sub-session 執行指示

1. 讀本工單、T0510 / T0511 回報區、W1-W10 對應 BUG 檔
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 執行 → 填回報區（DONE：全項有結論；PARTIAL：有 FAIL 或做不完）
4. commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

