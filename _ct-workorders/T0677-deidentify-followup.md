---
schema_version: 1
schema_kind: workorder
id: T0677
title: "去識別化第二批：外部測試者的另一個工作區改代稱「專案D」、使用者 Linux 帳號名改寫（D176 追加）"
type: chore
status: DONE
repo: better-agent-terminal
project: "公開 repo 去識別化（D176）"
priority: P1
sizing: S
created_at: "2026-10-21T18:34:56+0800"
started_at: "2026-10-21T18:36:16+08:00"
updated_at: "2026-10-21T18:42:11+08:00"
completed_at: "2026-10-21T18:42:11+08:00"
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

DONE。§ 六的兩類內容已依對照表替換，§ 六三組與 § 五四組檢查樣式對追蹤檔全為 0；測試、型別檢查、建置都通過（`tests/profile-manager-migration.test.ts` 的 2 項失敗是 HEAD 既有，見「遭遇問題」）。

落點檢查：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 前 5 個可測項目皆存在；C-2 無 `branch` 欄位。未設 `CT_HOME`（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 替換統計（類別 → 檔數、處數；只寫代稱）

開工前 § 六檢查樣式命中：第一組 11 檔 / 85 行；第二組 46 檔 / 146 行；第三組 56 檔 / 184 行。共改 66 個追蹤檔（另加本工單）。

| 類別 | 範圍 | 檔數 | 處數 | 替換成 |
|---|---|---|---|---|
| 外部測試者的另一個工作區 | 工單／BUG／決策日誌／狀態快照 | 8 | 74 | 說明文字「專案D」「專案D 資料」；反引號內與路徑 `<專案D>` |
| 外部測試者的另一個工作區 | 測試檔 | 3 | 75 | 名稱 `'專案D'`、別名 `'專案D 資料'`、路徑段 `ProjD`；小寫的 id／路徑變體 `ws-projd`、`/projd`、`/work/projd`、`/tmp/projd`（含小寫變體） |
| 使用者 Linux 帳號名 | 工單／BUG／決策日誌／狀態快照／封存 | 40 | 110 | `/home/<使用者>`、WSL UNC 帳號段 `<使用者>`、`<使用者>@<主機>`、`90-<使用者>-nopasswd`、`sxnas:<使用者>/…`、單獨帳號名 `<使用者>` |
| 使用者 Linux 帳號名 | 測試檔（含 1 個 e2e spec，未執行） | 15 | 98 | `/home/demo`、UNC 帳號段 `demo`、`sshUser: 'demo'`、`whoami`／`loginctl` 範例 `demo` |
| 使用者 Linux 帳號名 | 產品原始碼註解（`electron/wsl-detect.ts`） | 1 | 1 | `/home/demo`（範例值，比照測試檔欄） |

（處數以 HEAD 版本逐檔計數；`_decision-log.md` 兩類都有，檔數各算一次。）

### 驗證結果

| 項目 | 結果 |
|---|---|
| § 六三組檢查樣式 | 0 / 0 / 0 ✅ |
| § 五四組檢查樣式（T0676） | 0 / 0 / 0 / 0 ✅ |
| 小寫變體不分大小寫補查（工作區代號） | 0（唯一命中是 `site/public/media/snippets.png` 二進位內的隨機位元組，非文字）✅ |
| `git diff --word-diff` 全量核對 | 每一處差異都是 § 六的替換（逐對分組檢視）✅ |
| 「不改」清單 | GitHub 帳號、兩種資料夾名寫法、大寫名字、主機名、`sxnas` 的出現次數與 HEAD 完全相同 ✅ |
| `npm run test:unit` | 322 檔通過、5661 passed / 3 skipped ✅ |
| `npm run typecheck` | 0 ✅ |
| `npm run typecheck:electron` | 0 ✅ |
| `npx vite build` | 成功 ✅ |
| `npx tsx tests/path-translator.contract.test.ts` | 136 passed / 0 failed ✅ |
| `npx tsx tests/plan-007-cross-env-smoke.test.ts` | 16 passed / 0 failed ✅ |
| `npx tsx tests/profile-manager-migration.test.ts` | 10 passed / 2 failed（HEAD 版本同樣 10 / 2，既有，見下）⚠️ |
| `tests/bat-terminal-response-correlation.test.mjs` | 在 `test:unit` 範圍內，已含於上方通過數 ✅ |
| `.private/`、`Claude outputs/` | 仍為 ignored，未 stage ✅ |
| 換行 | 索引皆為 LF（部分檔案工作目錄原本就是 CRLF，git 加入時正規化為 LF，與 HEAD 一致）✅ |

### 保留項目與理由

- 「不改」清單：GitHub 帳號、資料夾名、指使用者本人的大寫名字（含一處 Windows 登入名、一處「交給使用者」的敘述）、git 作者名、主機名稱，全部未動。
- 判讀決定（依對照表原則自行決定，未問塔台）：
  1. 測試檔裡工作區代號的小寫寫法（id `ws-…`、路徑 `/…`）視為同一代號／路徑的變體，一併改成 `projd` 系列：`dispatch-cwd-check.test.ts`、`terminal-handlers.test.ts`、`bat-terminal-response-correlation.test.mjs`。理由：§ 六該列寫「工作區名稱與代號」，留著小寫等於沒去識別化；比照 § 一對小寫變體的處理。
  2. 測試檔的別名改成 `'專案D 資料'`（兩種原別名都用這個值），讓別名與名稱 `'專案D'` 仍不相同，保持「別名優先於名稱」的測試語意。
  3. 7 處隱私／sanitize grep 的關鍵字清單（T0656、T0659、T0674、CT-T008 ×2、CT-T010 ×2）中的小寫帳號名改成 `<使用者>`。理由：第三組檢查樣式要求 0，且 D176 規則要求字詞檢查清單不列真名。
  4. `electron/wsl-detect.ts` 註解中的範例家目錄改 `/home/demo`（非文件也非測試檔，取程式碼範例慣用值）。
  5. 一處 `install-runner.test.ts` 的 `…/home/<帳號>__END__` 後綴寫法（`_` 屬字元，第一輪沒替換到），補改為 `/home/demo__END__`。
- 觀察（未改，請塔台判斷）：`BUG-129` 一處 iCloud 路徑中，`<專案D>` 的上層資料夾名稱不在對照表內，依「只做 § 六」保留原樣。

### Commit

- 單一 commit：`chore(privacy): de-identify follow-up (T0677, D176)`（基底 `4963a402`）；本回報與工單 metadata 在同一個 commit 內，SHA 見完成通知（`git log -1 -- _ct-workorders/T0677-deidentify-followup.md`）。
- 未 push、未改寫歷史；未用 stash / reset / checkout / restore。

### 遭遇問題

- `tests/profile-manager-migration.test.ts` 2 項失敗（docker-linux、ssh-linux 的 metadata 斷言）：實際值多了後來新增的 profile 欄位，與本單替換無關。以 HEAD 版本的檔案（`git show HEAD:…` 複製到 scratchpad、只改 import 路徑）執行，結果同樣 10 passed / 2 failed，屬既有問題。建議另開單補上斷言。
- 第一次用 Python 腳本替換時傳入 MSYS 路徑，git 找不到 repo、0 檔變更；改傳 Windows 路徑後正常，無副作用。

### 回報時間

2026-10-21T18:41:36+08:00
