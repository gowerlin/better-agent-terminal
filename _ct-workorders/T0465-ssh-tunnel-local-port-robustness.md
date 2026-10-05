---
schema_version: 1
schema_kind: workorder
id: T0465
title: "PLAN-039 工單 4：SSH tunnel 本機埠健壯性——pickFreePort 後 EADDRINUSE 換埠重試一次；固定 tunnelLocalPort 被多個 profile 重複使用時 warn"
type: fix
status: PENDING
repo: better-agent-terminal
project: PLAN-039
priority: P3
sizing: S
created_at: "2026-10-05T11:29:43+08:00"
started_at: null
updated_at: "2026-10-05T11:29:43+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "T0459 研究回報區拆單第 4 列（多 client 後多條 SSH tunnel 同時存在，本機埠競爭機率上升）"
  - "D135"
affects_files:
  - electron/remote/ssh-tunnel.ts
  - electron/remote/remote-client.ts
  - electron/remote/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 `pickFreePort` 與 ssh `-L` 綁定之間有競態：ssh 啟動因本機埠被占用失敗（stderr 含 `Address already in use` / bind 失敗，以結構化判斷為主、字串為輔並在回報區說明）時，換一個新埠重試**一次**；仍失敗照既有錯誤路徑。profile 若設固定 `tunnelLocalPort` 且與另一個 profile 相同，連線時 warn（不阻擋）。child_process 規則同 CLAUDE.md。"
  - "🔴 不碰 `main.ts`（可與 T0462 平行）。**只跑 `npm run test:unit` + `npx tsc --noEmit`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔維持 LF；不 push；不對實際 SSH 主機執行。"
---

# T0465 — SSH tunnel 本機埠健壯性（PLAN-039 工單 4）

## 驗收條件

- [ ] 測試：模擬第一次 bind 失敗 → 換埠成功；兩次失敗 → 既有錯誤；固定埠重複 → warn
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0459 回報區 + `electron/remote/ssh-tunnel.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先寫測試（紅）→ 實作（綠）；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
