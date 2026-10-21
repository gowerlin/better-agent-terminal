---
schema_version: 1
schema_kind: workorder
id: T0519
title: "claude:scan-skills / scan-star-commands：frontmatter 無 description 時正確 fallback（BUG-126）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-126
priority: P4
sizing: XS
created_at: "2026-10-14T04:09:11+0800"
started_at: "2026-10-14T04:10:11+0800"
updated_at: "2026-10-14T04:12:47+0800"
completed_at: "2026-10-14T04:12:47+0800"
commit: aa26c76
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


### 結果摘要

skills（`claude:scan-skills` 第 2 段）與 `claude:scan-star-commands` 刪除各自的 fallback 迴圈，改為直接呼叫 T0518 的 `parseCommandDescription(content)`。frontmatter 無 `description:` 的 SKILL.md 現在顯示 frontmatter 結束後第一個非空行（去開頭 `#`），與 commands 同規則。

- 行為變化只在「有 frontmatter、無 `description:`、frontmatter 已關閉」：`''` → 結束後第一行
- 不變：有 description（含引號、CRLF）、無 frontmatter（取第一行）、frontmatter 未關閉（`''`）
- `frontmatterDescription` / `parseCommandDescription` 的 JSDoc 更新為涵蓋 skills（BUG-126 / T0519）

### 修改檔案

- `electron/handlers/claude.ts`：兩處 fallback 迴圈改為 `parseCommandDescription(content)`；JSDoc 更新（2 個程式 / 測試檔合計 23 insertions / 41 deletions）
- `electron/__tests__/claude-scan-skills-description.test.ts`：
  - skills 測試改名 `reads skill descriptions (BUG-126 fallback)`；`nodesc` 預期 `''` → `'After frontmatter'`；新增 `nodesc-crlf`（CRLF、無 description → `'CRLF body line'`）、`unclosed`（未關閉 → `''`）
  - star commands 測試改名 `reads star command descriptions (BUG-126 fallback)`；新增 `ct-help`（無 description → `'Help for the tower'`），長度 2 → 3
- `_ct-workorders/BUG-126-*.md`：`status: FIXED`、`fixed_at`、`updated_at`、body 狀態列、新增「根因與修正」
- 本工單

### 驗證

| Gate | 結果 | 證據 |
|---|---|---|
| 修改前紅燈 | 確認 | 只改 handler、未改測試時，`keeps skill descriptions unchanged` 失敗（`nodesc` 實際取得 `'After frontmatter'`），1 failed / 9 passed |
| 相關單元測試 | PASS | `npx vitest run electron/__tests__/claude-scan-skills-description.test.ts electron/__tests__/claude-auth-status.test.ts electron/remote/__tests__/headless-claude.test.ts` → 3 檔 / 32 測試通過（主 repo） |
| `npm run typecheck:electron` | PASS（0） | 隔離 worktree exit 0、0 個 `error TS` |
| `npm run typecheck` | PASS（0） | 隔離 worktree exit 0、0 個 `error TS` |
| `npx vite build` | PASS | 隔離 worktree exit 0 |
| `npm run test:unit` | PASS | 隔離 worktree 210 檔、3511 passed / 1 skipped，exit 0 |

隔離驗證：主 repo 有並行 T0517 的未提交變更，比照 T0518 在 `<使用者資料夾>/AppData/Local/Temp/t0519`（短路徑）以 `git worktree add --detach` 開 HEAD（`fde10db`），只複製本單 2 個程式 / 測試檔，`node_modules` 以 junction 指回主 repo；跑完四個 gate 後先刪 junction，再 `git worktree remove --force`（worktree 內有複製檔與 build 產物），確認主 repo `node_modules` 仍在、`git worktree list` 只剩主 repo。全程未使用 stash / reset / checkout / restore。

未做：runtime smoke（Claude 面板實際 skills 清單）——工單未要求，且不碰使用者正在用的 BAT。

### Landing Zone

- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`electron/handlers/claude.ts`、`electron/__tests__/claude-scan-skills-description.test.ts` 皆存在 → PASS（資訊性）
- C-2：工單無 `branch` 欄位；目前 `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### Commit

- `aa26c76` fix(claude): T0519 skills / star commands fall back to the line after frontmatter (BUG-126)——`git commit --only` 提交本單 4 個檔案（T0517 的 WIP 不納入）。收尾 metadata（`status: DONE`、`completed_at`、`commit`）另以 chore commit 提交。不 push。

### 偏差 / 備註

- 派單時 HEAD 為 `12d2d18`，執行時塔台已推進到 `fde10db`（`chore: close 14 BUGs ...`），與本單檔案無重疊
- 寫 BUG-126「根因與修正」時一度誤寫入 CR 字元，已改回字面 `\r`，檔案為純 LF

### 已知未處理

- 無
