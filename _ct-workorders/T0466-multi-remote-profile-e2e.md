---
schema_version: 1
schema_kind: workorder
id: T0466
title: "PLAN-039 工單 5：e2e 兩個 isolated BAT 實例互為 server（P→A 自身、Q→B）：雙視窗 connected、pty:create 落在正確 server、關 P 寬限期後斷線且 Q 不受影響、第 9 個 profile 被拒；附 WSL + SSH 同開實機驗收步驟"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-039
priority: P2
sizing: M
created_at: "2026-10-05T11:29:43+08:00"
started_at: null
updated_at: "2026-10-05T11:29:43+08:00"
completed_at: null
target_version: next
depends_on:
  - T0464
related:
  - "T0459 研究回報區「測試策略」e2e 段與拆單第 5 列（兩實例優於兩 profile 同指一台 loopback server——後者走同 target 路徑，證明不了路由）"
  - "T0397 / T0399 e2e isolated runtime fixture"
  - "D135"
affects_files:
  - e2e/
  - docs/remote-dev-overview.md
  - CLAUDE.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只跑本單新 e2e spec**（`npx playwright test <spec>`），需 build 時只做 e2e 所需最小 `npx vite build` 並說明；不跑全套 `npm run test:e2e`（L141）。若兩實例互為 server 在 e2e fixture 下不可行，回報區說明並改用最接近的可行方案（例如一實例 + 兩個 in-process headless server），不得改用「兩 profile 指同一 loopback server」冒充。"
  - "🔴 回報區附實機步驟：WSL + SSH profile 同時開窗，兩邊終端 / Agent / `bat-notify --submit` 皆正常；關其中一個視窗 15 s 後該 profile 斷線、另一個不受影響。CLAUDE.md「遠端 Tower 通知」節的「全域只有一個 remoteClient」限制改寫。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔維持 LF；不 push；不部署 WSL。"
---

# T0466 — 多 profile e2e（PLAN-039 工單 5）

## 驗收條件

- [ ] e2e spec 綠（雙視窗 connected、路由正確、寬限期斷線、上限拒絕）
- [ ] 回報區附實機步驟；CLAUDE.md / docs 更新
- [ ] PLAN-039 檔補完成註記

## Sub-session 執行指示
1. 讀本工單 + T0459 / T0462 / T0463 / T0464 回報區 + `e2e/` 既有 fixture
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單 + PLAN-039；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
