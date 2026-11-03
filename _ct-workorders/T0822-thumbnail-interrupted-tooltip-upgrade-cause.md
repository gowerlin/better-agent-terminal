---
schema_version: 1
schema_kind: workorder
id: T0822
title: "PLAN-063 小後續：縮圖 ⏸（被中斷的 agent 分頁）的 tooltip 依中斷原因顯示——升級造成的寫「因安裝新版而中斷」"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-04T02:02:42+0800"
depends_on: []
related:
  - "PLAN-063；D267；T0821（`710e4179`：`InterruptedAgent.cause?: 'upgrade'`，renderer 鏡像同名；已知限制「縮圖 ⏸ tooltip 仍寫因 Terminal Server 重啟而中斷」）；T0766（⏸ 標示）"
affects_files:
  - _ct-workorders/T0822-thumbnail-interrupted-tooltip-upgrade-cause.md
  - src/components/TerminalThumbnail.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/components/__tests__/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改 ⏸ 的 tooltip / aria 文字：`cause === 'upgrade'` 時用新的 i18n 字串（三語），其他（recovery 造成、沒有 cause）文字與行為完全不變；⏸ 的出現條件、點擊開清單、樣式不變。不改 store、主行程、IPC。"
  - "🔴 本單與 T0823 並行：T0823 改 `electron/main.ts`、NSIS 設定、CLAUDE.md 與 docs（含 `docs/agent-guide/upgrade-interruption.md`，〈已知限制〉的 tooltip 那一句由 T0823 一併移除）；本單不改任何 docs，不得改 `affects_files` 以外的檔。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍的檔案（明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0822 — 縮圖 ⏸ tooltip 依中斷原因顯示（PLAN-063 小後續）

## 元資料

- **工單編號**：T0822
- **類型**：implementation
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-04T02:02:42+0800
- **預估規模**：S

## 背景

T0821 讓升級（NSIS 安裝新版）結束的 claude / codex 分頁以 `cause: 'upgrade'` 列進「被中斷的 agent 分頁」。縮圖上的 ⏸ 標示（`TerminalThumbnail.tsx`，`interrupted-agent-badge`）的 tooltip 仍是 T0766 的「因 Terminal Server 重啟而中斷」，升級造成的項目文字不符（T0821〈已知限制〉）。

## 範圍

1. `TerminalThumbnail.tsx`：`interrupted?.cause === 'upgrade'` 時 tooltip / `aria-label` 改用新 key（例 `interruptedAgents.badgeUpgrade`，三語：「因安裝新版而中斷，按此查看」之類，與既有 key 的語氣一致）；其他情況不變。
2. 單元測試：upgrade 項目顯示新文字、recovery 項目與無 cause 維持原文字；三語 key 都存在。

## 驗收

- [ ] tooltip 依 cause 顯示（附測試）
- [ ] 既有 `interrupted-agents-*`、`upgrade-interruption` 測試照過
- [ ] `npm run typecheck` = 0、`npm run test:unit`、`npx vite build`

---

## 回報區

（由 Worker 填寫）
