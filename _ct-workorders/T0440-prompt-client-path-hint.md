---
schema_version: 1
schema_kind: workorder
id: T0440
title: "遠端視窗 Claude prompt 送出前偵測 client 形式路徑樣式 → 非阻斷提示（不改內容、可關閉）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-105
priority: P3
sizing: S
created_at: "2026-10-05T05:51:45+08:00"
started_at: null
updated_at: "2026-10-05T05:51:45+08:00"
completed_at: null
target_version: next
depends_on:
  - T0439
related:
  - "T0421 研究策略 C / 拆單第 6 列（選做；使用者 05:51 裁決納入）"
  - "D134 追加（T0421 拆單）"
affects_files:
  - src/components/ClaudeAgentPanel.tsx
  - src/lib/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **絕不改寫使用者內容**，只提示。提示為非阻斷（送出照常），附「不再提示」開關（沿用既有設定機制，不新造 store）。只在遠端 profile 視窗啟用。"
  - "🔴 偵測規則抽成純函式（`src/lib/` 下）並單測：`C:\\…`、`\\\\wsl.localhost\\…`、`\\\\wsl$\\…`；避免誤報：程式碼區塊（```…```）內、行內 code、URL 不提示。若可用，顯示 T0437 解析出的 server 形式作為建議（只顯示，不替換）。"
  - "🔴 同工作樹有其他 Worker 平行。共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0440 — prompt 內 client 路徑提示

## 範圍

1. 偵測純函式 + 單測（含誤報案例）
2. Claude 面板送出時於遠端視窗檢查並顯示非阻斷提示；可關閉
3. i18n 三語

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] 回報區附實機步驟

## Sub-session 執行指示
1. 讀本工單 + T0421 回報區（策略 C）+ T0437 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
