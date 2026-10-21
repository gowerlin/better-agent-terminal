---
schema_version: 1
schema_kind: workorder
id: T0686
title: "CI 擋版：pre-release.yml／release.yml 加測試關卡（test:unit + test:legacy），失敗就不 build、不發版；tests.yml 改成可重用，同一份定義"
type: feature
status: DONE
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: S
created_at: "2026-10-21T21:40:10+0800"
started_at: "2026-10-21T21:41:57+08:00"
updated_at: "2026-10-21T21:43:54+08:00"
completed_at: "2026-10-21T21:43:54+08:00"
depends_on:
  - "T0683／T0684／T0685（皆 DONE）；GitHub 第二次試跑 run `39609350106`（`853e5537`，ubuntu-24.04）全過：test:unit 5760 passed / 0 failed / 6 skipped（326 檔）、test:legacy 33 檔 472 / 0，約 4 分鐘"
related:
  - "D177 第 2 點（試跑全過後設成 pre-release／release 的擋版關卡，比照 Typecheck gate）"
  - "既有 Typecheck gate：`.github/workflows/pre-release.yml` 第 61 行 `typecheck` job、第 173 行 `build.needs: [prepare, typecheck]`；`release.yml` 第 29 行、第 141 行；CLAUDE.md「Type check」節最後一條與「Packaging / Release 前置檢查」節；`docs/agent-guide/packaging-release-checks.md` 的 **Typecheck gate**"
  - "現行 `.github/workflows/tests.yml`（T0683／T0685：`workflow_dispatch`、`npm ci --ignore-scripts` + electron `install.js`、unit → legacy、summary）"
affects_files:
  - .github/workflows/tests.yml
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - CLAUDE.md
  - docs/agent-guide/packaging-release-checks.md
  - _ct-workorders/T0686-ci-test-gate-pre-release-release.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 做法：`tests.yml` 同時支援 `workflow_dispatch` 與 `workflow_call`（內容維持一份），`pre-release.yml`、`release.yml` 各加一個呼叫它的 `tests` job（不帶 `needs`，與 typecheck、server-bundle 並行），並把 `build.needs` 改成也包含 `tests`。測試失敗 → `build` skipped → `release`（與 `choco`）skipped，比照 Typecheck gate。不得改動其他 job 的行為、觸發條件、權限或 secrets；`tests` job 只需要讀取權限，不傳任何 secret。"
  - "🔴 不能為了驗證而真的觸發 pre-release 或 release（會發版）。驗證方式：actionlint（可比照 T0685 用 Go 臨時編譯，不安裝到系統）檢查三個 workflow；確認 `workflow_call` 的寫法與 `uses: ./.github/workflows/tests.yml` 的相對路徑、`needs` 名稱都正確；說明 release 的 tag 觸發與 pre-release 的 `workflow_dispatch` 在呼叫可重用 workflow 時的行為。"
  - "🔴 文件：CLAUDE.md「Type check」節的 CI 那條改成同時提到測試關卡（或在「Packaging / Release 前置檢查」加一條 **Test gate**，一兩句，細節放 docs）；`docs/agent-guide/packaging-release-checks.md` 補 **Test gate** 段（job 結構、跑哪些、執行時間約 4 分鐘、失敗時的影響、本機重現方式 `npm run test:unit` / `npm run test:legacy`、Linux 與 Windows 的差異已由 T0684 處理）。遵守 CLAUDE.md 開頭的撰寫規則。"
  - "🔴 Git：`git commit --only <檔案>`；不 push（塔台 push 後會手動觸發一次 `tests.yml` 確認 `workflow_dispatch` 仍可用）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），本單原則上不需要 gh。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。yolo：不得問使用者，判讀問題問塔台；不得寫出權杖值或 secrets。"
---

# T0686 — CI 擋版：測試關卡

## 目標

`test:unit` 與 `test:legacy` 已在 ubuntu 上兩次試跑後全過（第二次 run `39609350106`）。依 D177，把它們設成 pre-release／release 的擋版關卡：測試失敗就不 build、不發版，比照既有的 Typecheck gate。`tests.yml` 改成可重用，pre-release、release 與手動試跑共用同一份定義。

## 要做的事

1. `tests.yml` 加 `workflow_call`（保留 `workflow_dispatch`）。
2. `pre-release.yml`、`release.yml` 各加 `tests` job 呼叫它，`build.needs` 加上 `tests`。
3. CLAUDE.md 與 `docs/agent-guide/packaging-release-checks.md` 補 Test gate。
4. actionlint 驗證、commit（不 push）。

## 驗收

- 三個 workflow actionlint 無錯；`build.needs` 含 `tests`；其他 job 行為不變。
- 文件說明 Test gate 的結構、影響與本機重現方式。
- 只改 `affects_files`；未 push；沒有觸發任何發版 workflow。

---

## 回報區

### 完成狀態

**DONE**。三個 workflow 的 Test gate 已接上、actionlint 通過、文件已補；未 push、未觸發任何 workflow。

落點檢查：**PASS**。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 工單在 repo 內；C-3 前 5 個 `affects_files` 皆存在（資訊用）；C-2 工單無 `branch` 欄位（目前 `main`）。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。工單原 `status: TODO`（非 `PENDING`），直接改為 `IN_PROGRESS`。

### 修改內容

| 檔案 | 變更 |
|---|---|
| `.github/workflows/tests.yml` | `on:` 加 `workflow_call:`（保留 `workflow_dispatch:`），開頭註解改為說明 T0686 的可重用用法；job 與步驟一字未改。 |
| `.github/workflows/pre-release.yml` | `typecheck` 之後加 `tests` job：`permissions: contents: read`、`uses: ./.github/workflows/tests.yml`，無 `needs`、無 `with` / `secrets`；`build.needs` `[prepare, typecheck]` → `[prepare, typecheck, tests]`。 |
| `.github/workflows/release.yml` | 同上（`tests` job 在第 53–56 行，`build.needs` 在第 149 行）。 |
| `CLAUDE.md` | 「Type check」節 CI 那條之後加一條測試關卡；「Packaging / Release 前置檢查」加 **Test gate** 一條（含 🔴「測試步驟只改 `tests.yml`」），並把 docs 指引列入 **Test gate**。 |
| `docs/agent-guide/packaging-release-checks.md` | **CI pipeline** 的 `build.needs` 說明補 T0686；新增 **Test gate** 段：job 結構、跑哪些步驟、約 4 分鐘（run `39609350106` 數據）、失敗影響、權限、觸發與 ref 行為、本機重現（`npm run test:unit` / `npm run test:legacy`，T0684 已處理 Linux / Windows 差異）、維護規則與 actionlint 用法。 |

其他 job（`prepare`、`typecheck`、`server-bundle`、`server-bundle-manifest`、`release`、`choco`）的內容、觸發條件、權限、secrets 都沒動；`release` / `choco` 沒有 `if: always()`，所以 `build` skipped 時一起 skipped。

### 驗證結果

| 項目 | 結果 |
|---|---|
| actionlint（三檔） | ✅ PASS：`go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7 -verbose tests.yml pre-release.yml release.yml` → 0 parse errors、0 errors、exit 0（Go 1.27.3 臨時編譯，未安裝到系統，同 T0685）。整個 `.github/workflows/` 也是 exit 0。本機無 shellcheck / pyflakes，這兩條規則被停用（`run:` 內容本單未改）。 |
| actionlint 確實檢查 `uses` 與 `needs`（反向測試） | ✅ 在 scratchpad 的複本（`git init` 的臨時目錄，未動 repo）刪掉 `workflow_call:`、把 release 的 `needs` 改成 `testz` → exit 1，報出 pre-release.yml:88 / release.yml:56 `"workflow_call" event trigger is not found` [workflow-call] 與 release.yml:148 `job "build" needs job "testz" which does not exist` [job-needs]。證明正式檔的 0 錯誤包含了相對路徑 `./.github/workflows/tests.yml`、`workflow_call` 與 `needs` 名稱的檢查。 |
| 行尾 | ✅ commit 內 5 檔的 blob 都是 0 個 CR（Python 計數）。`pre-release.yml` 在工作目錄原本就是 CRLF（index 為 LF，`.gitattributes` `eol=lf`），commit 時已正規化，工作目錄未另行改寫。 |
| 不觸發發版 | ✅ 沒有執行任何 `gh` 指令、沒有 push、沒有觸發 workflow。 |
| build / unit tests | N/A：本單只改 workflow 與文件，未改 `src/` / `electron/`；未跑 `npx vite build` / typecheck / unit tests。 |

**觸發行為說明**（文件也有寫）：

- 本地 `uses: ./.github/workflows/tests.yml` 取用呼叫端同一個 commit 的檔案：release（push `v*` tag）測的是該 tag 的 commit；pre-release（`workflow_dispatch`）測的是觸發時選的 ref。
- 被呼叫端的 `github` context（`event_name` = `push` / `workflow_dispatch`、`ref`）沿用呼叫端；`tests.yml` 不讀這些值，`actions/checkout` 取的就是上述 commit，所以行為與手動試跑相同。
- 權杖：呼叫端 job 的 `permissions: contents: read` 是被呼叫 workflow 的上限；未傳 `secrets`（沒有 `secrets: inherit`），`tests.yml` 也不需要任何 secret。
- `tests.yml` 的 `workflow_dispatch` 保留，塔台 push 後可手動觸發確認；Actions 頁面上呼叫端顯示為 `tests / unit-tests`。
- 失敗時：`tests` 失敗 → `build` skipped → `release`（release.yml 另含 `choco`）skipped；`server-bundle` / `server-bundle-manifest` 照跑但不發佈。

### Commit

- `bb926fdc`（`bb926fdcd8fb2d89021789f801ff69ba5c28d8e8`）ci: T0686 BUG-168 Test gate …（5 檔：3 個 workflow + `CLAUDE.md` + `docs/agent-guide/packaging-release-checks.md`），`git commit --only`。
- 工單本身另以 `git commit --only` 提交（見本回報之後的 commit）。
- 未 push。

### 遭遇問題

- 無阻礙。
- 待塔台確認（非阻擋）：push 後手動觸發一次 `tests.yml`（`gh workflow run tests.yml -R gowerlin/better-agent-terminal`）確認 `workflow_dispatch` 仍可用；下一次 pre-release 時確認 Actions 圖上 `tests / unit-tests` 與 `build` 的相依關係如預期。
- 已知限制：pre-release 自動遞增版號的 `prepare` 與 `tests` 並行，測試失敗不影響版號解析，但也不會留下 tag（tag 由 `release` job 建立）。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### 回報時間

2026-10-21T21:43:25+0800
