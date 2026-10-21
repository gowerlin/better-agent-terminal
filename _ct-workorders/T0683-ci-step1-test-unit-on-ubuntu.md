---
schema_version: 1
schema_kind: workorder
id: T0683
title: "CI 第一步：修 pty-manager-helper-env 的環境變數隔離；新增只能手動觸發的 tests.yml，在 ubuntu 跑 npm run test:unit（先試跑，不擋版）"
type: feature
status: TODO
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: S
created_at: "2026-10-21T20:38:28+0800"
depends_on: []
related:
  - "D177 第 2 點（CI 分兩步：本單是第一步的前半；塔台 push 並試跑全過後，另開單把 test:unit 設成 pre-release／release 的擋版關卡）"
  - "T0679 發現：四個 workflow 都沒有 `test:unit`；`electron/__tests__/pty-manager-helper-env.test.ts` 第 174、203 行斷言 `env.BAT_HELPER_LOG_DIR` 為 undefined 卻沒先清掉 `process.env.BAT_HELPER_LOG_DIR`"
  - "既有 workflow 寫法：`.github/workflows/pre-release.yml`（typecheck job：ubuntu-24.04、Node 24、`npm ci --ignore-scripts`）；CLAUDE.md「Type check」「Packaging / Release 前置檢查」節"
affects_files:
  - electron/__tests__/pty-manager-helper-env.test.ts
  - .github/workflows/tests.yml
  - _ct-workorders/T0683-ci-step1-test-unit-on-ubuntu.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 `pty-manager-helper-env.test.ts`：讓會受 shell 環境影響的斷言不依賴執行者的環境（測試前保存並清掉相關的 `process.env` 變數，測試後還原），不要改產品程式。修完後在本機用「設了與沒設 `BAT_HELPER_LOG_DIR`、`BAT_USER_DATA`」兩種環境各跑一次這個檔，都要全過。"
  - "🔴 `tests.yml`：只用 `workflow_dispatch` 觸發（不加 push／pull_request），runner `ubuntu-24.04`、Node 24，安裝方式先比照 typecheck job 的 `npm ci --ignore-scripts`；若 vitest 在那樣的安裝下跑不起來，改用必要的最小安裝並在回報說明原因。依 CLAUDE.md 規則，把 `BAT_HELPER_LOG_DIR`、`BAT_USER_DATA` 設到 runner 的暫存目錄。job 名稱清楚（例如 `unit-tests`），結束時印出通過／失敗數。不要改 pre-release.yml／release.yml（擋版是下一張單）。"
  - "🔴 本機能做的驗證：`npm run test:unit` 全過（在設與不設上述兩個變數的 shell 各跑一次）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0；workflow 語法用可取得的工具檢查（例如 `actionlint` 若可用，否則仔細比對既有 workflow 的寫法）。實際在 GitHub 上跑由塔台 push 後觸發，不在本單。"
  - "🔴 `gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）；本單不需要呼叫 gh。"
  - "🔴 同時有 T0680、T0681 的 Worker 在跑：只動 `affects_files`；commit 用 `git commit --only <檔案>`，不要 `git add -A`。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。Git：不 push；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。不跑 Playwright e2e。yolo：不得問使用者，判讀問題問塔台；不得寫出權杖值或 secrets。"
---

# T0683 — CI 第一步：test:unit 在 ubuntu 試跑

## 目標

CI 目前只跑 typecheck，`npm run test:unit`（vitest，約 5,600 項）不在任何 workflow。依 D177 分兩步納入：本單先修一個會受執行環境影響的測試，並新增只能手動觸發的 `tests.yml`，讓塔台 push 後在 ubuntu 試跑一次。確認全過後，下一張單再把它設成發版前的擋版關卡。

## 要做的事

1. 修 `electron/__tests__/pty-manager-helper-env.test.ts` 的環境變數隔離（兩種環境都要全過）。
2. 新增 `.github/workflows/tests.yml`（只有 `workflow_dispatch`）。
3. 本機驗證、commit（不 push）。

## 驗收

- `pty-manager-helper-env.test.ts` 在設與不設 `BAT_HELPER_LOG_DIR`／`BAT_USER_DATA` 時都全過；`npm run test:unit` 兩種環境都全過。
- `tests.yml` 只有 `workflow_dispatch`，未改其他 workflow。
- typecheck 0／0；只改 `affects_files`；未 push。

---

## 回報區

### 完成狀態

### 修改內容

### 驗證結果

### 給塔台的試跑指令

### Commit

### 遭遇問題

### 回報時間
