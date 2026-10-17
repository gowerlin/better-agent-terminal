---
schema_version: 1
schema_kind: workorder
id: T0518
title: "claude:scan-skills：commands 描述解析 YAML frontmatter（BUG-125）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-125
priority: P3
sizing: XS
created_at: "2026-10-14T04:03:26+0800"
started_at: "2026-10-14T04:05:18+0800"
updated_at: "2026-10-14T04:08:56+0800"
completed_at: "2026-10-14T04:08:56+0800"
target_version: "0.6.0-pre.7"
related:
  - BUG-125
  - "T0514（發現處，U4）"
affects_files:
  - electron/handlers/claude.ts
  - electron/__tests__/
  - electron/handlers/__tests__/
  - _ct-workorders/T0518-scan-skills-command-frontmatter.md
  - _ct-workorders/BUG-125-scan-skills-command-description-frontmatter.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 與 T0517 並行（T0517 改 `electron/remote/**`、`src/components/setup-wizard/**`、`src/locales/**`）：本單不改那些路徑；commit 用 `git commit --only` 或精準 `git add`。"
  - "🔴 不碰使用者正在用的 BAT；不消耗 Claude token。改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push。"
---

# T0518 — scan-skills commands 描述（BUG-125）

## 任務

1. `electron/handlers/claude.ts` commands 分支（約 :297）：有 YAML frontmatter 時取 `description:`（與 skills 分支同規則，可抽共用函式），沒有才退回第一個非空行去 `#`；frontmatter 有但無 description → 取 frontmatter 之後第一個非空行
2. skills 分支行為不變（若抽共用函式，以測試證明 skills 結果不變）
3. 同一檔若還有其他「第一行當描述」處（如 star commands），一併檢查並在回報區說明是否處理

## 驗證

- 單元測試：有 / 無 frontmatter、frontmatter 無 description、引號包住的 description、CRLF 檔案
- `npm run typecheck:electron` = 0、`npx vite build` exit 0、`npm run test:unit` 全套通過

## 驗收條件

- [ ] 帶 frontmatter 的 command 顯示正確描述
- [ ] BUG-125：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」同步

## Sub-session 執行指示

1. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
2. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
3. commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區


### 結果摘要

DONE。`.claude/commands/*.md` 的描述改為先讀 YAML frontmatter 的 `description:`，帶 frontmatter 的 command 不再顯示 `---`。skills 與 star commands 改用同一個 frontmatter 解析函式，結果與修正前相同。

### Landing Zone Check

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3（資訊用）：`electron/handlers/claude.ts`、`electron/__tests__/`、`electron/handlers/__tests__/`（不存在，祖先 `electron/handlers/` 存在）皆 present
- C-2：工單無 `branch` 欄位，不適用（目前 `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 修改檔案

- `electron/handlers/claude.ts`
  - 新增 `frontmatterDescription(lines)`：從開頭的 frontmatter 取 `description:`。內容就是 skills / star commands 兩處原本重複的迴圈，抽出後兩處改呼叫它
  - 新增 `parseCommandDescription(content)`：commands 分支用。順序：frontmatter `description` → frontmatter 結束後第一個非空行 → 沒有 frontmatter 時取第一個非空行；都去掉開頭 `#`。frontmatter 沒有結束行時回 `''`
  - commands 分支（原 :296-298）改呼叫 `parseCommandDescription`
- `electron/__tests__/claude-scan-skills-description.test.ts`（新增，10 個測試）
- `_ct-workorders/BUG-125-scan-skills-command-description-frontmatter.md`：`status: FIXED`、`fixed_at`、body 狀態列、「根因與修正」段

### 任務 3：同檔其他「第一行當描述」處

- `claude:scan-star-commands`（ct-* / gsd-* skill）：原本就先讀 frontmatter，不是第一行當描述。只把它的 frontmatter 迴圈換成共用函式，行為不變
- 同檔沒有其他以第一行當描述的地方

### 行為差異說明

- commands 無 frontmatter 時，舊碼對第一行先去 `#` 再 trim，新碼先 trim 再去 `#`。只有第一行是「縮排 + `#`」（如 `  # Title`）時結果不同：舊 `# Title`、新 `Title`，與 skills fallback 一致。屬於修正，不是回歸

### 已知未處理（建議另開單，P4）

- skills 與 star commands 的 fallback（frontmatter 沒有 `description` 時）用 `line !== lines[0]` 判斷 frontmatter 結束。結束行 `---` 與第一行 `---` 字串相同，所以永遠不會離開 frontmatter，結果是 `''`，不會取 frontmatter 之後的第一行。本單要求 skills 行為不變，所以沒改；測試 `keeps skill descriptions unchanged` 的 `nodesc` 案例把現狀（`''`）固定下來。要修的話可以直接改用 `parseCommandDescription` 的 fallback

### 驗證

| Gate | 結果 | 證據 |
|---|---|---|
| 新單元測試 | PASS | `npx vitest run electron/__tests__/claude-scan-skills-description.test.ts electron/__tests__/claude-auth-status.test.ts electron/remote/__tests__/headless-claude.test.ts` → 3 檔 / 32 測試通過 |
| `npm run typecheck:electron` | PASS（0） | 隔離 worktree 內 exit 0、0 個 `error TS`；之後主 repo 重跑也 exit 0 |
| `npm run typecheck` | PASS（0） | 主 repo 與隔離 worktree 皆 exit 0 |
| `npx vite build` | PASS | 隔離 worktree 內 exit 0 |
| `npm run test:unit` | PASS | 隔離 worktree 內 210 檔、3511 passed / 1 skipped，exit 0（`electron/__tests__/**` 在 `vite.config.ts` 的 include 內） |

隔離驗證的原因：第一次在主 repo 跑 `typecheck:electron` 時是 exit 2，3 個錯誤都在 `electron/remote/ssh-wizard-verify.ts`（並行的 T0517 正在改，`Unterminated regular expression literal`），與本單無關。為了拿到只含本單變更的證據，在 scratchpad 用 `git worktree add --detach` 開了 HEAD（`144486f`），只複製本單 2 個檔，`node_modules` 用 junction 指回主 repo，跑完四個 gate 後先移除 junction 再 `git worktree remove`（主 repo `node_modules` 確認仍在）。過程沒有用 stash / reset / checkout / restore。

測試涵蓋：有 frontmatter、無 frontmatter（`#` 標題 / 純文字）、frontmatter 無 description、雙引號、CRLF（三種）、frontmatter 未結束、空檔、frontmatter 外的 `description:` 不採用；handler 層用 temp 目錄驗 commands（project + global）、skills（雙引號 / CRLF / 標題 / 無 description）、star commands（ct / gsd / 非前綴略過）。

### 驗收條件

- [x] 帶 frontmatter 的 command 顯示正確描述（`reads command descriptions from frontmatter (BUG-125)`）
- [x] BUG-125：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」同步

### Commit

- `b66b525`：用 `git commit --only` 只提交本單 4 個檔（`electron/handlers/claude.ts`、新測試、T0518、BUG-125），不含 T0517 與 `src/styles/settings.css` 的未提交變更。未 push
