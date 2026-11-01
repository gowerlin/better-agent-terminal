---
schema_version: 1
schema_kind: workorder
id: T0763
title: "遠端 ⚠️ 自動化驗收：SSH（WSL 內臨時 sshd）、Docker、真正的網路中斷、遠端 Worker 分頁與塔台問題 ?"
type: verification
status: DONE
started_at: "2026-11-02T03:27:16+0800"
completed_at: "2026-11-02T03:47:20+0800"
updated_at: "2026-11-02T03:47:20+0800"
session_ids:
  - "6317c53e-087b-417d-b44d-fda632f7d091"
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T02:23:44+0800"
depends_on: [T0762]
related:
  - "T0748（WSL 遠端 ⚠️ 驗收、測試專用 headless server 作法）、T0749（重連對帳）、T0743（WSL Docker 作法與資源規則）；D210（SSH 用 WSL 內臨時 sshd）"
  - "`e2e/` 既有遠端 spec（T0748 / T0749 / T0743）、`docs/agent-guide/remote-tower-notify.md`、`docs/agent-guide/tower-questions.md`"
affects_files:
  - e2e/
  - e2e/fixtures/
  - docs/agent-guide/worker-tab-recycle.md
  - _ct-workorders/T0763-remote-waiting-badge-acceptance.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只驗證、不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷 → 回報區〈發現的問題〉附重現步驟與證據，由塔台開 BUG。不用真實模型（假 API / 假 agent），對外模型請求 0。"
  - "🔴 情境：① SSH：在 WSL `Ubuntu-24.04` 內以一般使用者起臨時 sshd（自己的 config、host key、authorized_keys 都在暫存目錄、隨機高 port、只聽 127.0.0.1），隔離實例建 SSH profile 連上測試專用 bat-server → 遠端分頁進入等待 → 本機 ⚠️、回答後清除。② Docker：WSL Docker 起 `bat-e2e-t0763-` 容器的 bat-server（T0743 作法）→ 同上。③ 真正的網路中斷：server 不重啟，只切斷連線（例：本機與 server 之間放一個測試用 TCP relay，關掉再開），重連後 ⚠️ 依 server 現況對帳（T0749）。④ 遠端 Worker：遠端塔台分頁以 helper 派工 → 遠端 Worker 分頁 → Worker `--ask` 問塔台 → 本機看到 `?`、答覆後清除；Worker 等使用者時 ⚠️。"
  - "🔴 不動使用者環境：不碰使用者的 WSL bat-server（前後比對 MainPID / unit / 版本）、不改 `~/.ssh`、不用 gxdocker 或其他外部主機、不碰使用者容器；只動 `bat-e2e-t0763-` 前綴資源，跑完全清（不得 `docker system prune` / `builder prune`）。臨時 sshd 跑完停掉並刪暫存目錄。"
  - "🔴 驗證：新 spec 綠（或部分綠並說明），連跑 2 次；重跑 `t0735`、T0748 spec 綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。build 在主 checkout（Lane A 尾段，T0762 之後）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0763 — 遠端 ⚠️ 自動化驗收：SSH（WSL 內臨時 sshd）、Docker、真正的網路中斷、遠端 Worker 分頁與塔台問題 ?

## 元資料

- **工單編號**：T0763
- **類型**：verification
- **優先級**：P2
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：M

## 背景

T0748 只驗了 WSL 遠端與 server 重啟；SSH、Docker、真正的網路中斷、遠端 Worker 與 `?` 未涵蓋。D210 排入本批，SSH 用 WSL 內臨時 sshd（使用者選定）。

## 範圍

情境 ①–④（見 memory_overrides），只驗證。

## 不做

- 不改產品程式碼；不用真實模型；不碰使用者環境與外部主機。

## 驗收

- [x] ①–④ 結果表（PASS / FAIL＋證據），新 spec 連跑 2 次
- [x] 使用者環境前後相同、測試資源全清
- [x] typecheck 0 / 0

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE（情境 ①–④ 全部 PASS，最終版連跑 2 次皆綠）
- **session_id**：6317c53e-087b-417d-b44d-fda632f7d091
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1 工單在 REPO_ROOT 內。C-3 `e2e/`、`docs/agent-guide/worker-tab-recycle.md` 都存在。C-2 工單沒有 `branch` 欄位（`main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_HOME` 未設定，不是 worktree。
- **產品 commit**：`2e469a78`（spec、ssh shim、docs 一行）

### 產出摘要

新增 `e2e/t0763-remote-waiting-acceptance.spec.ts`（opt-in：`BAT_E2E_T0763=1`）。測試 server 沿用 T0748 的作法：把 WSL 內已安裝的 bundle 唯讀複製到 `/tmp/bat-e2e-t0763`，再覆蓋本 repo 的 headless JS 與 helper，不經 systemd，每個程序都帶 `T0763_E2E_TAG`。隔離實例使用現有的 `dist-electron`。四個情境共用一個隔離實例，各自開一個遠端 profile 視窗。

| 情境 | 結果 | 證據 |
|---|---|---|
| ① SSH（WSL 內臨時 sshd） | PASS | sshd 以一般使用者執行，config、host key、authorized_keys 都在暫存目錄，只聽 127.0.0.1、隨機高 port，另設 `PermitOpen` 只允許轉到測試 server 的 port。建立 ssh-linux profile 後，BAT 自己起 tunnel `ssh -N -L <local>:localhost:<server port> … -- <WSL 使用者>@127.0.0.1`（shim 日誌有記錄），sshd 日誌有 `Accepted publickey … from 127.0.0.1`。遠端 shell 確認跑在測試 server 上（`uname`、PWD、標記）。OSC 7501 `blocked` → server `blocked reason=input (osc)` → 列 ⚠️（target 是該分頁，tooltip 有分頁標題與原因）。視窗有焦點時看過該分頁再送 `idle` → 列與縮圖的 ⚠️ 都清除。最後停掉 sshd（含每條連線的子程序）→ 視窗斷線，證明連線確實走 tunnel |
| ② Docker | PASS | 容器 `bat-e2e-t0763-server`，label `bat.t0763=1`，用本機既有的 `debian:bookworm-slim`（沒有 pull），bundle 唯讀掛載，`--bind-interface all`。PortBindings 只有 `127.0.0.1:<P>`。建立 docker-linux profile。遠端 shell 的 `hostname` 等於容器的 hostname（確實在容器內）。等待與回答的流程同 ①，PASS |
| ③ 真正的網路中斷（server 不重啟） | PASS | 在本機架 TCP relay 轉到測試 server，wsl-linux profile 指向 relay。先讓 X 等待、Y 不等待，兩個分頁各排 `sleep 8; printf OSC …`，然後關閉 relay（斷掉 2 條 socket、關監聽）→ 視窗 5 ms 內斷線。斷線期間 server 記錄 X `cleared`、Y `blocked`，視窗仍顯示 X ⚠️、沒有 Y（事件送不到）。約 8.9 s 後重開 relay，斷線後約 17.9 s 重新連上。`[attention] reconnect reconcile … ids=4 gone=0 applied=4 skipped=0` → Y 列 ⚠️（target Y），X 列變淡化（等待在沒看時結束，D203）。server pid 與兩個 shell pid 前後相同（沒有任何重啟）。看過之後兩列都清除 |
| ④ 遠端 Worker 與 `?` | PASS | 遠端塔台 shell 分頁：`--set-role tower` exit 0。派工 `bat-terminal.mjs --notify-id … --workspace … --agent codex --skill ct-exec --workorder T9763` exit 0（`agent: codex-cli`）。server PATH 上的 `codex` 是假的：`--version` 回 0.166.0，之後轉成互動 bash，沒有模型。本機出現 Worker 分頁「Codex CLI · Worker · T9763」，`BAT_TOWER_TERMINAL_ID` 指向塔台。Worker 執行 `bat-notify --ask`（問題只走 stdin）exit 0、`notified: yes` → 本機 Worker 標籤 `?`（`data-attention=question`）。這時工作區列沒有 ⚠️：塔台問題不算等使用者（D200，只記錄不斷言）。塔台執行 `--answer --choice 1`（答案走 stdin）exit 0 → `?` 清除。Worker 的 `--wait-answer` 拿到 `answered`、choice 1。Worker 送 OSC `blocked` → 標籤 ⚠️（`data-blocked-reason=input`），切到別的工作區時塔台工作區列 ⚠️（target 是 Worker）。看過之後送 `idle` → 清除。`--close-worker` exit 0 → 分頁關閉。問題文字出現在 server 端的檔案只有 Worker 自己寫的 `q.json` 和 bash history，server.log 與 `<dataDir>/Logs` 都沒有；server.log 也沒有 token 或 `batcap.` 權杖 |

**SSH 不寫使用者 `~/.ssh` 的做法**：BAT 的 ssh 參數固定帶 `StrictHostKeyChecking=accept-new`，而 Windows OpenSSH 不管 HOME 怎麼設，都讀寫真正的 `%USERPROFILE%\.ssh`（e2e/pre5-ssh-alias 已記載）。所以新增 `e2e/real-remote/t0763-ssh-shim.go`，只放在隔離實例自己 PATH 的最前面。它呼叫真的 `C:\Windows\System32\OpenSSH\ssh.exe`，並在 BAT 的參數前加上 `-F none -o UserKnownHostsFile=<暫存檔> -o IdentitiesOnly=yes`；用 job object（KILL_ON_JOB_CLOSE）確保 BAT 結束 shim 時，真的 ssh 也一起結束。實測沒有殘留的 `ssh.exe`。client 金鑰用 Windows `ssh-keygen` 產生在暫存目錄。

**使用者環境前後比對**（afterAll 內斷言；每次執行都是全部 `same`）：
- WSL：家目錄清單、`~/.local/bat-server`、systemd units、`bat*` unit 狀態、使用者 bat-server（MainPID 前後都是同一個、active）、TCP listeners、帶標記的程序數 0、`/tmp/bat-e2e-t0763` 不存在
- Docker：非 `bat-e2e-t0763-` 的容器（id／狀態／啟動時間／重啟次數；使用者的 1 個容器維持 healthy、未被碰）、容器數、映像清單
- Windows `~/.ssh`：12 個項目的名稱、大小、mtime、內容雜湊
- 另外斷言四個測試用 port 都沒有殘留監聽

**對外模型請求**：0。沒有啟動任何 agent；codex 是假的，claude 沒有啟動。

**驗證**
- 新 spec 最終版連跑 2 次：`3 passed (41.8s)`、`3 passed (41.5s)`
- 回歸：`e2e/t0735-workspace-waiting-badge.spec.ts` `1 passed`；T0748 的 `e2e/v072-pre8-remote-workspace-waiting.spec.ts` `1 passed`（WSL 前後 `same`）
- `npm run typecheck` = 0；`npm run typecheck:electron` = 0（收尾時重跑）
- 收尾時另外確認：WSL `/tmp/bat-e2e-t0763*` 不存在、`bat-e2e-t0763-*` 容器 0 個、Windows `ssh.exe` 程序 0 個、`%TEMP%\bat-t0763-*` 0 個

**異動檔案**（commit `2e469a78`）
- `e2e/t0763-remote-waiting-acceptance.spec.ts`（新增）
- `e2e/real-remote/t0763-ssh-shim.go`（新增，測試專用）
- `docs/agent-guide/worker-tab-recycle.md`（T0735 驗證清單補一行）
- 沒有改產品程式碼（`src/`、`electron/`、`scripts/`），也沒改 `e2e/fixtures/`

### 發現的問題

- **產品缺陷：無**。①–④ 都符合預期，不需要開 BUG。
- （資訊）塔台問題 `?` 不會讓工作區列出現 ⚠️，因為 `waitingForUser` 只看 hook／osc reason，這是 D200 的設計。如果使用者希望工作區列也顯示 `?`，屬於新需求。
- （資訊）relay 重開後約 9 s 才重新連上（斷線後共約 17.9 s），是 RemoteClient 重連退避的時間，不是缺陷。

### 遭遇問題

1. **WSL 沒有安裝 sshd**。改用 `apt-get download openssh-server`（不需要 root），再 `dpkg-deb -x` 解到 `/tmp/bat-e2e-t0763/sshd` 執行，系統沒有安裝任何東西，跑完連同目錄刪除。代價是這一步需要 WSL 連得到 Ubuntu archive。這是在「WSL 內臨時 sshd、不裝東西」的限制下的做法，沒有問塔台。
2. **開發迭代中曾經殘留一個 sshd 監聽程序（已清除，已修正）**。第 2 次迭代改成「依標記找 sshd」，但 sshd 的 setproctitle 會覆寫 `/proc/<pid>/environ`，所以找不到 sshd。結果測試 sshd（127.0.0.1:56692）在清理後仍在執行，afterAll 的 listeners 比對抓到差異。
   - 當場處置：確認是 `/tmp/bat-e2e-t0763/sshd/root/usr/sbin/sshd (deleted)` 之後 kill 掉；listeners 回到基準，`pgrep -x sshd` = 0。
   - 修正：改用 `/proc/<pid>/exe` 落在 ROOT 底下來辨識 sshd；`cleanupWsl` 也加上同樣的後備清理；afterAll 加上「測試 port 沒有殘留監聽」的斷言。之後 3 次執行都乾淨。
   - 這段期間沒有碰到使用者的程序或設定。
3. 第 1 次迭代：只停 sshd 監聽程序，tunnel 不會斷（連線在 fork 出的子程序上），已改成連子程序一起停。另外 `docker ps` 的 label 格式寫錯，只影響清理的判斷訊息，沒有誤刪任何東西。
4. 第 3 次迭代：遠端視窗中，非作用中工作區的分頁在第一次顯示前不會建立 PTY（server 只建了作用中工作區的 shell）。spec 改成先依序切到每個工作區、等提示字元出現，再開始測。這是既有行為，不是缺陷。
5. **build**：沿用主 checkout 現有的 `dist-electron`／`dist`（2026-11-02 03:22，T0762 之後），沒有重跑 `npx vite build`。測試 server 的 headless JS 是從工作樹以 esbuild 建出來的，當時工作樹有 T0766 未 commit 的 `electron/` 修改（`pty-manager.ts`、`terminal-command-handlers.ts`、`main.ts` 等），所以有編進去。T0766 commit 後如果要嚴格對照，可以重跑本 spec。
6. 開發中跑 `npm run typecheck` 時，曾出現 1 個 TS6305 錯誤，位於 T0766 未 commit 的 `src/lib/__tests__/claude-resume-args.test.ts`，與本單無關。收尾重跑時已經是 0。

### 互動紀錄

- 無（yolo，沒有向塔台提問）

### 回報時間

- 2026-11-02T03:46:28+0800
