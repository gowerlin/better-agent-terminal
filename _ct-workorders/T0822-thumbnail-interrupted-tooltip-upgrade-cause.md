---
schema_version: 1
schema_kind: workorder
id: T0822
title: "PLAN-063 小後續：縮圖 ⏸（被中斷的 agent 分頁）的 tooltip 依中斷原因顯示——升級造成的寫「因安裝新版而中斷」"
type: implementation
status: DONE
started_at: "2026-11-04T02:05:03+0800"
updated_at: "2026-11-04T02:07:06+0800"
completed_at: "2026-11-04T02:07:06+0800"
session_ids:
  - "96fc5a5a-0593-4ccc-9945-0472f87a68dd"
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

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-04T02:07:06+0800
- **session_id**：96fc5a5a-0593-4ccc-9945-0472f87a68dd

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`src/components/TerminalThumbnail.tsx`、三個 locale 檔、`src/components/__tests__/` 皆存在（資訊性）→ PASS
- C-2：工單沒有 `branch` 欄位，不適用（目前 `main`）
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；未設 `CT_HOME`（非 worktree）

### 結果摘要

- `TerminalThumbnail.tsx`：⏸（`.interrupted-agent-badge`）的 `title` 在 `interrupted.cause === 'upgrade'` 時改用新 key `interruptedAgents.badgeUpgradeTooltip`，其他情況（recovery、沒有 cause）照舊 `interruptedAgents.badgeTooltip`。⏸ 的出現條件、`data-interrupted-agent`、點擊開清單、樣式都沒動；store、主行程、IPC、docs 未改。
- 三語新字串：
  - en：`The agent in this tab was ended by installing the new version — click to review`
  - zh-TW：`這個分頁的 agent 因安裝新版而中斷，按此查看`
  - zh-CN：`这个标签页的 agent 因安装新版而中断，点击查看`
- 新測試 `src/components/__tests__/interrupted-agent-badge-tooltip.test.tsx`（6 個）：upgrade 項目顯示新文字；recovery 項目維持原文字；沒有項目不顯示 ⏸；upgrade 項目點擊仍送 `OPEN_INTERRUPTED_AGENTS_EVENT`；zh-TW 下兩種項目各用自己的字串；三語都有新 key、不等於原文字、不含 `Terminal Server`。

### 修改檔案

- `src/components/TerminalThumbnail.tsx`
- `src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`（各加一行 `badgeUpgradeTooltip`，緊接在 `badgeTooltip` 後）
- `src/components/__tests__/interrupted-agent-badge-tooltip.test.tsx`（新增）

### 驗證

| 閘門 | 結果 | 證據 |
|---|---|---|
| tooltip 依 cause 顯示（附測試） | PASS | 新測試 6 / 6 通過 |
| 既有 `interrupted-agents-*`、`upgrade-interruption` 測試 | PASS | `interrupted-agents-codex` / `interrupted-agents-dialog` / `upgrade-interruption` / `terminal-thumbnail-preview` / `worker-tab-title` 與新測試共 6 檔 52 個通過 |
| `npm run typecheck` | PASS（0） | tsc 無輸出 |
| `npm run test:unit` | PASS | 404 passed、2 skipped（406 檔）；7093 passed、38 skipped |
| `npx vite build` | PASS | 建置完成（最後一段 `terminal-server.js` built） |

- 驗證時 HEAD 為 `834d02eb`（並行的 T0823 已先有 commit），本單改動在工作區；之後只 commit 本單檔案，沒有其他改動。

### Commit

- 產品：`05117326`（`feat: T0822 thumbnail ⏸ tooltip follows interruption cause (upgrade)`，以 `git commit --only` 明列 5 個檔案）
- 工單：本次 commit（只含本工單檔）
- 未 push

### 偏離與說明

- 工單範圍寫「tooltip / `aria-label`」：現有 ⏸ 只有 `title`、沒有 `aria-label`。為了「其他情況文字與行為完全不變」，沒有新增 `aria-label`，只改 `title`。若要補 `aria-label`，屬於所有 ⏸ 的行為變更，另開單處理。

### 遭遇問題

- 無。`npm run test:unit` 輸出中有 `error: No such remote 'origin'` 與 jsdom canvas 的 `Not implemented` 訊息，屬既有測試的雜訊，所有測試通過。

### 後續建議

- `docs/agent-guide/upgrade-interruption.md`〈已知限制〉的 tooltip 那一句由 T0823 移除（本單不改 docs）。

### 互動紀錄

- 無（yolo，沒有提問；執行中沒有塔台補充段落）。
