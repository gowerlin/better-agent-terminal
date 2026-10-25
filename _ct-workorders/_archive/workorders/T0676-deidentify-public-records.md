---
schema_version: 1
schema_kind: workorder
id: T0676
title: "公開 repo 去識別化：移除 claude-mem 記憶檔、客戶與外部測試者名稱改代稱、家目錄路徑改寫（D176）"
type: chore
status: DONE
repo: better-agent-terminal
project: "公開 repo 去識別化（D176）"
priority: P1
sizing: M
created_at: "2026-10-21T18:10:36+0800"
started_at: "2026-10-21T18:11:50+0800"
updated_at: "2026-10-21T18:19:03+0800"
completed_at: "2026-10-21T18:19:03+0800"
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

**DONE**。兩個記憶檔已 `git rm`；對照表一、二、三的替換全部完成；`T0526` 已 `git mv` 改名並更新引用；`T0674` 隱私檢查行已依步驟 5 整行改寫；測試、型別檢查、建置全過；一次 commit，未 push。

落點檢查：**PASS**。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 repo 內；C-3 `affects_files` 皆存在（informational）；C-2 無 `branch` 欄（`main`）。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 替換統計（類別 → 檔數、處數；只寫代稱）

起始基線（檢查樣式，追蹤檔）：第一組 68 檔 / 437 行；第二組 85 檔 / 151 行；第三組 3 檔。

| 類別 | 代稱 | 處數 | 檔數 |
|---|---|---|---|
| 外部測試者名字（文件） | 外部測試者A | 332 | 34 |
| 外部測試者名字（測試檔註解） | 外部測試者 | 1 | 1 |
| 外部測試者家目錄路徑 | `/Users/tester`、`/users/tester`、`/home/tester` | 43 | 5 |
| 使用者家目錄（文件） | `<使用者資料夾>` | 178 | 87 |
| 使用者家目錄（測試檔） | `C:\Users\demo` 等（保留原本分隔符與跳脫寫法） | 34 | 8 |
| 專案A（說明文字 / 路徑與反引號） | 專案A / `<專案A>` | 17 / 15 | 9 / 7 |
| 專案B（說明文字 / 路徑與反引號 / 測試檔字串） | 專案B / `<專案B>` / `'專案B'` | 89 / 4 / 7 | 11 / 4 / 2 |
| 專案C（說明文字 / 路徑與反引號） | 專案C / `<專案C>` | 13 / 11 | 3 / 6 |
| `T0526` 舊檔名引用 | `T0526-research-bug129-tester-log-triage.md` | 3 | 2 |
| 記憶檔刪除 | — | 2 檔（共 186 行） | 2 |
| `T0674` 隱私檢查行整行改寫（步驟 5） | 「隱私：依 `.private/` 的檢查樣式（真名不寫在公開檔）」 | 1 | 1 |

替換規則（逐處自動判斷，再以 word-diff 全量核對）：
- 中文句子內代稱後面緊接中日韓字時補一個半形空格（例：「專案B 塔台」）；路徑、反引號內不補。
- 名字所有格的英文寫法改為「外部測試者A 的」；測試檔英文註解改為「外部測試者的情境」。
- 外部測試者路徑保留原本大小寫型態（測試裡大寫輸入 → 小寫期望值的對應不變）。

### 驗證結果

| 項目 | 結果 |
|---|---|
| 檢查樣式第一組（追蹤檔） | 剩 17 行，全部是一般中文詞誤判（見「保留項目」），其餘 = 0 |
| 檢查樣式第二組 | **0**（另以不分大小寫補查使用者家目錄 = 0） |
| 檢查樣式第三組 | 只剩本工單自己的驗證指令文字 1 處（見「保留項目」）；兩個記憶檔已刪 |
| `git ls-files \| grep -i 'AGENTS.md'` | **0** |
| 舊 `T0526` 檔名 grep | **0** |
| word-diff 全量核對 | 150 檔、519 組差異、721 處；以「真名 → 代稱」雙向正規化比對，除步驟 5 的整行改寫外，殘差全是核對腳本的對齊假象（word-diff 行重排、原文已有空格、測試路徑只換使用者名稱段）並逐一人工確認；staged numstat 每個替換檔增刪行數相等（無換行格式變動） |
| `npm run test:unit` | **PASS**：322 檔全過；5661 passed、3 skipped（5664） |
| `npm run typecheck` | **0**（exit 0） |
| `npm run typecheck:electron` | **0**（exit 0） |
| `npx vite build` | **成功**（exit 0） |
| `tests/` 不在 `test:unit` 的已改檔 | `npx tsx tests/path-translator.contract.test.ts` 136 passed / 0 failed；`npx tsx tests/plan-007-cross-env-smoke.test.ts` 16 passed / 0 failed；`npx tsx --test tests/wsl-path.test.ts` 21 pass / 0 fail；`npx tsx tests/_windows-probe.ts`（手動 probe，非測試）exit 0 |
| ignored 檢查 | `git status --ignored` 顯示 `.private/`、`Claude outputs/` 為 ignored，未 stage |

### 保留項目與理由

- **第一組檢查樣式 17 行誤判**：命中的是一般中文詞（量詞「台」接「電腦」，意思是「這／一／別＋台＋電腦」），不是指專案C。位置：`_ct-workorders/T0658-fix-wizard-buttons-and-step-text.md:111`、`site/.vitepress/theme/components/CapabilityLevels.vue:31`、`site/faq.md:64`、`site/faq.md:67`、`site/features.md:119`、`site/features.md:121`、`site/remote/docker.md:102`、`site/remote/index.md:48`、`site/remote/wsl.md:8`、`src/locales/zh-TW.json:599`、`:835`、`:873`、`:1041`、`:1045`、`:1053`、`:1141`、`:1142`。建議塔台把該樣式改為排除後接「電腦」的寫法。
- **第三組檢查樣式 1 處**：本工單「驗證」段的檢查指令文字本身，不是記憶檔內容；工單正文屬塔台撰寫，未改。
- 第一組的英文一般單字：本次所有命中都指專案，**無**以一般英文單字理由保留的項目。

### 修改的檔案（數量與主要目錄）

共 153 個路徑（150 修改含本工單、2 刪除、1 改名）：
- `_ct-workorders/`：137（其中 `_archive/**` 57；含塔台私有檔 `_tower-state.md`、`_decision-log.md`、`_learnings.md`、`_bug-tracker.md`、`_cross-references.md` 與 `_report-*`、`_reply-*`，只有對照表替換）
- 測試檔 14：`electron/__tests__/` 4、`electron/remote/__tests__/` 1、`electron/remote-tools/__tests__/` 1、`src/__tests__/` 2、`src/components/__tests__/` 1、`tests/` 4（含手動 probe `_windows-probe.ts`）
- 其他：`CHANGELOG.md`、`src/types/bmad-workflow.ts`（只改註解路徑）、根目錄 `AGENTS.md`（刪除）
- 未改 `.gitignore`。

### Commit

- 單一 commit：`chore(privacy): de-identify public records (T0676, D176)`（基底 `509f3d23`）；本回報與工單 metadata 在同一個 commit 內，SHA 見完成通知（`git log -1 -- _ct-workorders/T0676-deidentify-public-records.md`）。
- 未 push、未改寫歷史；未用 stash / reset / checkout / restore。

### 遭遇問題

判讀決定（yolo，未問塔台，依對照表判斷原則自行決定）：
1. **大小寫與前綴變體的使用者家目錄**：檢查樣式第二組大小寫敏感，但追蹤檔另有小寫使用者名稱與 `/mnt/c/...` 寫法（含 4 個不在 `affects_files` 清單的測試檔：`electron/__tests__/wsl-workspace-folder.test.ts`、`electron/remote/__tests__/resolve-client-paths.test.ts`、`tests/_windows-probe.ts`、`tests/wsl-path.test.ts`）。視為同一家目錄的變體一起替換，測試檔用 `demo`、文件用 `<使用者資料夾>`；WSL 掛載寫成 `/mnt/<使用者資料夾>`，一處 MSYS 路徑誤轉的證據寫成 `D:\<使用者資料夾>`。
2. **專案B 的完整工作區名稱**（含年份與案名後綴的變體）視為同一名稱的變體，整串換成「專案B」／`<專案B>`，避免留下案名描述。
3. **YAML frontmatter 的來源專案欄位值**用說明文字「專案A」（不是 `<專案A>`）。
4. `tests/_windows-probe.ts` 是手動 probe：原本寫死使用者自己的 claude 安裝路徑，換成 `C:\Users\demo` 後在本機執行時那兩個 customPath 探測回 `null`（檔案不存在），要實測需在本機暫時改回自己的路徑。

後續建議（不在本單範圍，未改）：
- WSL 內的 Linux 家目錄 `/home/<帳號>` 仍出現 128 處 / 33 檔（帳號名與公開的 GitHub 帳號同字首，不在對照表）。是否也改代稱由塔台決定。
- 另一個工作區的三字母代號（測試檔的工作區名稱與 11 個追蹤檔）不在對照表；若屬客戶名稱，建議補進 `.private/` 對照表後另開單。

### 回報時間

2026-10-21T18:19:03+0800
