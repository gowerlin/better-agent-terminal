---
schema_version: 1
schema_kind: workorder
id: T0676
title: "公開 repo 去識別化：移除 claude-mem 記憶檔、客戶與外部測試者名稱改代稱、家目錄路徑改寫（D176）"
type: chore
status: TODO
repo: better-agent-terminal
project: "公開 repo 去識別化（D176）"
priority: P1
sizing: M
created_at: "2026-10-21T18:10:36+0800"
depends_on: []
related:
  - "D176（使用者四題決定：移除兩個 AGENTS.md、客戶名稱換代稱、測試者名稱換代稱、其他清理；不改寫 git 歷史）"
  - "對照表與檢查樣式（本機私密，不 commit）：`.private/T0676-deid-mapping.md`"
  - "規則：`_ct-workorders/_local-rules.md`「公開 repo 去識別化（D176）」節"
affects_files:
  - "AGENTS.md（刪除）"
  - "_ct-workorders/AGENTS.md（刪除）"
  - "_ct-workorders/**/*.md（依對照表替換，含 `_archive/**` 與塔台私有檔）"
  - "_ct-workorders/T0526-research-bug129-*-log-triage.md（依對照表改名）"
  - CHANGELOG.md
  - src/types/bmad-workflow.ts
  - electron/__tests__/clipboard-file-paths.test.ts
  - electron/__tests__/dispatch-cwd-check.test.ts
  - electron/__tests__/terminal-handlers.test.ts
  - src/__tests__/panel-finder-paste.test.tsx
  - src/__tests__/terminal-paste-shortcuts.test.tsx
  - electron/remote-tools/__tests__/parse.test.ts
  - src/components/__tests__/remote-tools-panel.test.tsx
  - tests/path-translator.contract.test.ts
  - tests/plan-007-cross-env-smoke.test.ts
  - "其他依檢查樣式找到的追蹤檔（只限對照表的替換）"
  - _ct-workorders/T0676-deidentify-public-records.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先讀 `.private/T0676-deid-mapping.md`（本機、`.gitignore` 擋住，不得 commit）。工單回報、commit 訊息、終端摘要**不得**出現對照表裡的真名或原始路徑；回報只寫類別、檔數、代稱與檢查結果。本 repo 公開。"
  - "🔴 只做三件事：刪除兩個 `AGENTS.md`、依對照表替換字串、`T0526` 檔改名。不改任何其他內容，歷史紀錄的意思不變；commit 前用 `git diff --word-diff` 自查，每一處差異都要是對照表裡的替換。"
  - "🔴 本單明文授權修改塔台私有檔（`_tower-state.md`、`_decision-log.md`、`_learnings.md`、`_bug-tracker.md`、`_backlog.md`、`_cross-references.md`、`_local-rules.md`、`_archive/**`），**只限對照表的替換**。"
  - "🔴 測試檔只改範例字串、測試名稱與註解（依對照表「測試檔」欄）。改完必跑：`npm run test:unit` 全過、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功（CLAUDE.md No Regressions）。`tests/` 底下的測試若不在 `test:unit` 範圍，查出它們怎麼跑並跑過，回報寫明。"
  - "🔴 `T0526` 改名用 `git mv`，所有引用一併更新，舊檔名 grep = 0。"
  - "🔴 `.gitignore` 已由塔台更新（擋 `AGENTS.md`、`Claude outputs/`、`/.private/`），不要再改。刪除 `AGENTS.md` 用 `git rm`。"
  - "🔴 Git：不改寫歷史、不 force push、不 push。commit 一次完成；commit 前 `git status` 確認只有本單的檔案（`.private/`、`Claude outputs/` 應為 ignored）。建議訊息：`chore(privacy): de-identify public records (T0676, D176)`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔維持原本的換行格式（LF）。不跑 Playwright e2e。"
  - "🔴 yolo Worker：不得問使用者；判讀問題（例：某個命中是一般英文單字還是指專案）依 ct-exec § Questions For Tower 問塔台，或依對照表的判斷原則自行決定並在回報列出位置與理由。不得在任何地方寫出權杖值。"
---

# T0676 — 公開 repo 去識別化

## 目標

本 repo 與 `_ct-workorders/` 在 GitHub 公開。塔台掃描發現已公開的追蹤檔裡有：claude-mem 自動寫入、混入其他專案內部紀錄的記憶檔；客戶與外部專案的名稱和路徑；外部測試者的名字與家目錄路徑；使用者家目錄路徑。使用者決定（D176）從現在起修正、不改寫歷史：刪除記憶檔，其餘依對照表換成代稱。

**代稱**（可以寫在公開檔）：專案A、專案B、專案C、外部測試者A、`<使用者資料夾>`；測試檔用 `C:\Users\demo`、`/Users/tester`。真名一律只看 `.private/T0676-deid-mapping.md`。

## 要做的事

1. 讀 `.private/T0676-deid-mapping.md`，跑一次 § 五的檢查樣式，記下各類別的命中檔數（只記數字）。
2. `git rm AGENTS.md _ct-workorders/AGENTS.md`。
3. 依對照表替換：
   - 文件、工單、紀錄、`CHANGELOG.md`：用「說明文字」或「路徑」欄的代稱；中文句子要通順（例：「專案B 塔台」）。
   - `src/types/bmad-workflow.ts`：只改那一行註解裡的路徑。
   - 測試檔：用「測試檔」欄的值；只改字串、測試名稱與註解。
4. `T0526-research-bug129-…-log-triage.md` 依對照表改名（`git mv`），更新所有引用。
5. `T0674-site-why-cognitive-load.md` 的「驗證」段有一行隱私檢查清單直接列出名稱：整行改成「隱私：依 `.private/` 的檢查樣式（真名不寫在公開檔）」。
6. 驗證（見下方）。
7. 一次 commit，不 push。

## 驗證

- 對照表 § 五的三組檢查樣式，對追蹤檔全部 = 0；某個命中若是一般英文單字而保留，列出檔名、行號與理由（不引用該字）。
- `git grep -l '<claude-mem-context>'` = 0；`git ls-files | grep -i 'AGENTS.md'` = 0。
- 舊的 `T0526` 檔名在追蹤檔裡 grep = 0。
- `git diff --word-diff --stat` 與抽查：每一處差異都是對照表裡的替換、刪除或改名。
- `npm run test:unit` 全過（記通過數與檔數）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功；`tests/` 的測試依其實際跑法跑過。
- `.private/` 與 `Claude outputs/` 沒有被 stage（`git status --ignored` 顯示為 ignored）。

## 驗收

- 兩個 `AGENTS.md` 已刪除；檢查樣式全部 = 0（或只剩列明理由的一般英文單字）；測試、型別檢查、建置都通過。
- 回報區只有類別、檔數、代稱、檢查結果與 commit SHA，沒有任何真名或原始路徑。
- 只改 `affects_files` 範圍；未 push。

---

## 回報區

> 以下由 Worker 填寫。本 repo 公開：不得寫真名或原始路徑。

### 完成狀態

### 替換統計（類別 → 檔數、處數；只寫代稱）

### 驗證結果

### 保留項目與理由

### 修改的檔案（數量與主要目錄）

### Commit

### 遭遇問題

### 回報時間
