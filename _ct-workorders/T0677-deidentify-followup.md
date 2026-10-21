---
schema_version: 1
schema_kind: workorder
id: T0677
title: "去識別化第二批：外部測試者的另一個工作區改代稱「專案D」、使用者 Linux 帳號名改寫（D176 追加）"
type: chore
status: TODO
repo: better-agent-terminal
project: "公開 repo 去識別化（D176）"
priority: P1
sizing: S
created_at: "2026-10-21T18:34:56+0800"
depends_on:
  - "T0676（DONE `b8ea0f8b`）"
related:
  - "D176；使用者 2026-10-21 追加決定（T0676 回報的兩項後續建議）"
  - "對照表與檢查樣式（本機私密，不 commit）：`.private/T0676-deid-mapping.md` § 六（沿用 § 一～§ 五的寫法原則）"
  - "規則：`_ct-workorders/_local-rules.md`「公開 repo 去識別化（D176）」節"
affects_files:
  - "_ct-workorders/**/*.md（依對照表 § 六替換，含 `_archive/**` 與塔台私有檔）"
  - electron/__tests__/dispatch-cwd-check.test.ts
  - electron/__tests__/terminal-handlers.test.ts
  - tests/bat-terminal-response-correlation.test.mjs
  - "其他依 § 六檢查樣式找到的追蹤檔（只限對照表的替換；含測試檔）"
  - _ct-workorders/T0677-deidentify-followup.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先讀 `.private/T0676-deid-mapping.md` § 六（本機、`.gitignore` 擋住，不得 commit）。工單回報、commit 訊息、終端摘要**不得**出現對照表裡的原文；回報只寫類別、檔數、代稱與檢查結果。本 repo 公開。"
  - "🔴 只做 § 六的替換，不改任何其他內容；commit 前用 `git diff --word-diff` 自查，每一處差異都要是對照表的替換。§ 六「不改」清單裡的東西（GitHub 帳號、資料夾名、指使用者本人的大寫名字、git 作者名、主機名稱）一律不動。"
  - "🔴 本單明文授權修改塔台私有檔（`_tower-state.md`、`_decision-log.md`、`_learnings.md`、`_bug-tracker.md`、`_backlog.md`、`_cross-references.md`、`_local-rules.md`、`_archive/**`），**只限 § 六的替換**。"
  - "🔴 測試檔只改範例字串、測試名稱與註解（依 § 六「測試檔」欄），保持測試語意。改完必跑：`npm run test:unit` 全過、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功；`tests/` 底下不在 `test:unit` 範圍的已改檔，用 T0676 回報的跑法跑過。"
  - "🔴 Git：不改寫歷史、不 force push、不 push。一次 commit；commit 前 `git status` 確認只有本單的檔案（`.private/`、`Claude outputs/` 應為 ignored）。建議訊息：`chore(privacy): de-identify follow-up (T0677, D176)`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持原本的換行格式（LF）。不跑 Playwright e2e。"
  - "🔴 寫含反斜線的內容時用 Write／Edit 工具，不要用 shell heredoc 或 echo（L129：反斜線會被吃掉）。"
  - "🔴 yolo Worker：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台，或依對照表原則自行決定並在回報列出位置與理由（不引用原文）。不得在任何地方寫出權杖值。"
---

# T0677 — 去識別化第二批

## 目標

T0676 回報了兩項不在原對照表的內容，使用者決定一併處理：外部測試者的另一個工作區（改代稱「專案D」），以及使用者自己的 Linux 帳號名（`/home/…`、WSL UNC 路徑、ssh 使用者、sudoers 檔名、單獨出現的帳號名）。對照表與檢查樣式在 `.private/T0676-deid-mapping.md` § 六。

## 要做的事

1. 讀對照表 § 六，跑 § 六的檢查樣式，記下各類別的命中檔數（只記數字）。
2. 依 § 六替換：文件、工單、紀錄用「文件」欄的代稱；測試檔用「測試檔」欄的值，只改字串、測試名稱與註解。
3. 驗證（見下方），一次 commit，不 push。

## 驗證

- § 六的三組檢查樣式對追蹤檔全部 = 0；§ 五的四組（T0676 的檢查）仍為 0。
- `git diff --word-diff` 全量核對：每一處差異都是 § 六的替換；「不改」清單的項目沒有被動到。
- `npm run test:unit` 全過（記通過數與檔數）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功；`tests/` 底下已改的檔案依其跑法跑過。
- `.private/`、`Claude outputs/` 仍為 ignored，未 stage。

## 驗收

- 檢查樣式全部 = 0；測試、型別檢查、建置都通過。
- 回報區只有類別、檔數、代稱、檢查結果與 commit SHA，沒有原文。
- 只改 `affects_files` 範圍；未 push。

---

## 回報區

> 以下由 Worker 填寫。本 repo 公開：不得寫原文。

### 完成狀態

### 替換統計（類別 → 檔數、處數；只寫代稱）

### 驗證結果

### 保留項目與理由

### Commit

### 遭遇問題

### 回報時間
