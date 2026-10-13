---
schema_version: 1
schema_kind: workorder
id: T0519
title: "claude:scan-skills / scan-star-commands：frontmatter 無 description 時正確 fallback（BUG-126）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-126
priority: P4
sizing: XS
created_at: "2026-10-14T04:09:11+0800"
target_version: "0.6.0-pre.7"
related:
  - BUG-126
  - "T0518（`frontmatterDescription` / `parseCommandDescription`，`b66b525`）"
affects_files:
  - electron/handlers/claude.ts
  - electron/__tests__/claude-scan-skills-description.test.ts
  - _ct-workorders/T0519-skill-description-fallback-fix.md
  - _ct-workorders/BUG-126-skill-description-fallback-never-leaves-frontmatter.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 與 T0517 並行（T0517 改 `electron/remote/**`、`src/components/setup-wizard/**`、`src/locales/**`、`electron/preload.ts`、`src/types/electron.d.ts`，工作區有其未提交變更）：本單只改上列 affects_files；commit 用 `git commit --only`。T0517 的 WIP 可能讓主 repo 的 typecheck 暫時失敗，比照 T0518 以隔離 worktree 取得只含本單變更的 gate 證據（worktree 放短路徑，L149）。"
  - "🔴 不碰使用者正在用的 BAT；不消耗 Claude token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push。"
---

# T0519 — skills description fallback（BUG-126）

## 任務

1. 讀 BUG-126、T0518 回報區「已知未處理」
2. skills 與 star commands 分支在 frontmatter 無 `description` 時，改為取 frontmatter 結束後第一個非空行（去 `#`），規則與 `parseCommandDescription` 一致（建議直接共用）
3. 更新 `claude-scan-skills-description.test.ts` 的 `nodesc` 案例為新預期，並補 star commands 同情境

## 驗證

- `npm run typecheck:electron` = 0、`npx vite build` exit 0、`npm run test:unit` 全套通過（必要時隔離 worktree）

## 驗收條件

- [ ] frontmatter 無 description 的 skill / star command 顯示 frontmatter 後第一行
- [ ] 有 description 的結果不變
- [ ] BUG-126：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」同步

## Sub-session 執行指示

1. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
2. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
3. commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

