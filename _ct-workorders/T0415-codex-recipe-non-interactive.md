---
schema_version: 1
schema_kind: workorder
id: T0415
title: "BUG-104：codex 安裝食譜加 CODEX_NON_INTERACTIVE=1（避免 installer 互動提示卡住完成標記）"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-104
priority: P2
sizing: S
created_at: "2026-10-05T04:07:57+08:00"
target_version: next
depends_on:
  - T0414
related:
  - "BUG-104；T0414 回報區「遭遇問題」1、4"
affects_files:
  - src/lib/remote-tools/recipes.ts
  - src/lib/remote-tools/__tests__/recipes.test.ts
  - src/lib/remote-tools/__tests__/__snapshots__/recipes.test.ts.snap
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 只改 codex 食譜（含 apk 版）與對應測試 / 快照；其他工具的食譜不得變動（快照 diff 只能出現 codex 行）。"
  - "🔴 不在任何機器上執行安裝（實機重裝驗證由塔台另行處理）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0415 — codex 食譜非互動化（BUG-104）

## 元資料
- **工單編號**：T0415
- **任務名稱**：codex recipe `CODEX_NON_INTERACTIVE=1`
- **狀態**：PENDING
- **建立時間**：2026-10-05 04:07 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

T0414 在 WSL 實機安裝 codex 時，install.sh 結尾從 `/dev/tty` 讀 `Start Codex now? [y/N]`，BAT 安裝分頁因此停住，完成標記、toast、重新偵測都要等使用者回答。install.sh 支援 `CODEX_NON_INTERACTIVE=1` 跳過所有提示（選 No）。

## 範圍

1. `src/lib/remote-tools/recipes.ts`：codex 指令改為 `curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh`（apk 版前置 `apk add curl &&` 不變）
2. 測試：codex 指令含 `CODEX_NON_INTERACTIVE=1 sh` 的明確斷言；更新快照（diff 只能是 codex 行）
3. 確認 `wrapWithSentinel` 對新指令仍正確（現有測試即可）

## 驗收條件

- [ ] `git diff` 快照只有 codex 行變更
- [ ] `npm run test:unit` 全綠（基線 1640）；`npx tsc --noEmit` ≤ 40

## Sub-session 執行指示
1. 讀本工單 + BUG-104 + `src/lib/remote-tools/recipes.ts`
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

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
