---
schema_version: 1
schema_kind: workorder
id: T0839
title: "PLAN-043 W2：`detectWslFacts`（版本、發行版、systemd、預設使用者 uid、Running 清單、原則鍵、Windows build）＋ facts → plan 純函式＋ IPC"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T09:17:09+0800"
started_at: ""
updated_at: "2026-11-04T09:17:09+0800"
completed_at: ""
session_ids: []
depends_on: [T0838, T0833]
related:
  - "PLAN-043 Phase 2；D272；T0831 回報區（〈調查結論〉1–2 的偵測項目表 P-1–P-7、〈建議下一步〉W2）"
affects_files:
  - _ct-workorders/T0839-wsl-facts-and-plan.md
  - electron/wsl-detect.ts
  - electron/wsl-facts.ts
  - src/components/setup-wizard/wsl-env-plan.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/__tests__/
  - src/components/setup-wizard/__tests__/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只偵測、只算計畫，不執行任何修正；不接進精靈畫面（W3 才接）。偵測全部唯讀：`execFile` ＋陣列參數＋ timeout（整體 15 s），不經 shell；child_process 測試沿用 `setExecFileImplForTests`。🔴 本機只可跑唯讀查詢，不得 `--shutdown` / `--terminate` / 改設定。"
  - "🔴 計畫依 T0831 P-1–P-7 與使用者裁決（D272）：P-6 `instanceIdleTimeout` 不做；P-5 只在 connect-test 失敗才出現（不放進第一份清單）；Phase 3 的安裝項目不在本單。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0839 — PLAN-043 W2：facts 與 plan

## 元資料
- **工單編號**：T0839｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0838（同改 `wsl-detect.ts`）、T0833（同改 `main.ts` / `preload.ts`）｜**規模**：S–M

## 任務指令
1. 讀 T0831 回報區（全文）。
2. `electron/wsl-facts.ts` `detectWslFacts()`：WSL 版本、發行版清單與 VERSION、選定發行版 systemd / 預設使用者與 uid、Running 清單、`HKLM\SOFTWARE\Policies\WSL` 原則鍵、Windows build、`.wslconfig` 現況（經 W1 parser）。
3. `src/components/setup-wizard/wsl-env-plan.ts`：facts → items 純函式（item 形狀照 T0831〈調查結論〉2「一次同意」：`id`、`labelKey`、`scope`、`effects`、`required`、`defaultChecked`、`disabledReasonKey?`）。環境都正常 → 0 項。
4. IPC（本機）＋ preload ＋型別。
5. 單元測試：各 facts 組合 → 計畫（含 0 項、原則擋、WSL 太舊只提示）。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] 本機唯讀實測一次 `detectWslFacts`（附輸出摘要，不含使用者名稱以外的個資）；commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 互動紀錄

### 遭遇問題

### 回報時間
