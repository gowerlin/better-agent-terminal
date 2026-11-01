---
schema_version: 1
schema_kind: workorder
id: T0763
title: "遠端 ⚠️ 自動化驗收：SSH（WSL 內臨時 sshd）、Docker、真正的網路中斷、遠端 Worker 分頁與塔台問題 ?"
type: verification
status: PENDING
updated_at: "2026-11-02T02:23:44+0800"
session_ids: []
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

- [ ] ①–④ 結果表（PASS / FAIL＋證據），新 spec 連跑 2 次
- [ ] 使用者環境前後相同、測試資源全清
- [ ] typecheck 0 / 0

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
