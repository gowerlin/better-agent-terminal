---
schema_version: 1
schema_kind: workorder
id: T0894
title: "修正 BUG-217（在 `v0.8.x`）：指揮塔總覽的 YAML 解析錯誤只記一行原因、同一檔同一錯誤只記一次，不記原文"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-25T00:39:51+08:00"
updated_at: "2026-11-25T00:39:51+08:00"
target_version: "0.8.0-pre.2"
depends_on: []
related:
  - "BUG-217；T0892（調查結論 §1、建議方向 B）；D318（使用者 2026-11-25：BUG-216 / BUG-217 一起修，放進 pre.2）；D307；T0701（指揮塔總覽，契約 v1）"
  - "CLAUDE.md「指揮塔總覽（T0701，D184）」「Logging」各節；`docs/agent-guide/ct-tower-overview.md`"
affects_files:
  - _ct-workorders/T0894-fix-ct-overview-yaml-error-log.md
  - src/components/ControlTowerPanel.tsx
  - src/lib/ct-tower-overview.ts
  - src/components/__tests__/tower-overview.test.tsx
  - src/lib/__tests__/ct-tower-overview.test.ts
renew_count: 0
isolation: worktree
workdir: worktree ct/T0894（塔台已預先從 `v0.8.x` 建立分支 `ct/T0894`，`bcb4bbe0`）
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0894` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `bcb4bbe0e2f300832bfa3bbfbfbebcc46f1f23a4`，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只改 `affects_files` 列的檔案。**不改 CLAUDE.md、`docs/agent-guide/`、`package.json`、`package-lock.json`**（T0891 正在改，避免合併衝突）；`docs/agent-guide/ct-tower-overview.md` 需要補的文字寫在回報區，由塔台合併後補。需要動其他檔 → 先問塔台。"
  - "🔴 不得改變的行為（T0701 / D184）：總覽維持唯讀；frontmatter 摘要契約 v1（`schema_kind: tower-state`、`summary_version`）與「最後更新」那一行的比對不變；解析失敗時畫面的顯示（無法讀取摘要）不變；`fs.watch` 重載與 ↻ 行為不變；遠端工作區行為不變。"
  - "🔴 修正目標（BUG-217）：① 解析錯誤日誌只記一行：錯誤類別 / reason ＋行列（js-yaml `mark.line` / `mark.column` 之類），🔴 不記 js-yaml 的原文摘錄（`mark.snippet` 或 `message` 中的多行片段）、不記檔案內容與完整路徑（工作區以 id 或檔名即可）；② 同一工作區同一檔、同一錯誤（以 reason＋行列或內容雜湊判定）只記一次，直到檔案內容改變或錯誤改變才再記；解析恢復成功時可記一行恢復。去重狀態只在記憶體。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 全綠（附 passed / files 數）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。新增 / 更新測試：雙引號字串含未跳脫反斜線的 frontmatter → 只記一次、單行、不含原文；內容改變後再記；修好後顯示恢復。不需要啟動 BAT 實機；若要啟動只用隔離實例（`--runtime`），不碰使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）。`TMP` 用系統預設（T0716）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "🔴 公開 repo（D176）：回報區與測試 fixture 不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`，範例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0894 — 修正 BUG-217：指揮塔總覽的 YAML 錯誤日誌

## 背景

T0892 在 `v0.8.0-pre.1` 日誌看到（詳見 `_ct-workorders/BUG-217-ct-overview-yaml-error-log-spam.md`）：某工作區的 `_tower-state.md` frontmatter 在雙引號字串裡有未跳脫的反斜線，`ControlTowerPanel.tsx`（約 506 行）每次 `fs.watch` → `reloadAll` 都記 `[ct-overview] _tower-state.md summary ignored: YAML parse error: unknown escape sequence`，而且附 js-yaml 約 8 行原文摘錄：4 小時 347 次、222 KB，並把該工作區的塔台狀態內容寫進 debug log。

既有程式（T0701 起），不是 `v0.8.x` 回歸；修正放在 `v0.8.x`，隨 `0.8.0-pre.2` 發佈。

## 實作

1. 確認 merge-base；worktree `npm ci`。
2. 照 `memory_overrides` 第 4 條：單行原因、去重、不記原文。
3. 測試；`docs/agent-guide/ct-tower-overview.md` 要補的文字寫在回報區。

## 驗收

- [ ] 同一錯誤只記一次、單行、不含原文與檔案內容
- [ ] 內容 / 錯誤改變後才再記；畫面顯示與 T0701 契約不變
- [ ] `test:unit` 全綠、`vite build` exit 0、兩個 typecheck = 0
- [ ] 隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **session_id**：

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0894`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
