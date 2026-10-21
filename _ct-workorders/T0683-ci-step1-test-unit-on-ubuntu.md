---
schema_version: 1
schema_kind: workorder
id: T0683
title: "CI 第一步：修 pty-manager-helper-env 的環境變數隔離；新增只能手動觸發的 tests.yml，在 ubuntu 跑 npm run test:unit（先試跑，不擋版）"
type: feature
status: DONE
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: S
created_at: "2026-10-21T20:38:28+0800"
started_at: "2026-10-21T20:41:48+0800"
updated_at: "2026-10-21T20:54:07+0800"
completed_at: "2026-10-21T20:54:07+0800"
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

DONE：本單驗收全過（Windows 兩種環境 `test:unit` 全過、typecheck 0／0、actionlint 0、只改 affects_files、未 push）。

🔴 **但 ubuntu 試跑預期不會全過**：在本機 WSL Ubuntu 24.04 + Node 24.22.0 照 `tests.yml` 的步驟模擬，有 **9 檔 21 項**失敗，都是測試寫死 Windows 行為（見「遭遇問題」2），不是本單改的東西。擋版前要先開單修這 21 項（或決定在 Linux 跳過），否則下一張單把它設成擋版會直接擋住發版。

### 修改內容

1. `electron/__tests__/pty-manager-helper-env.test.ts`：`SAVED_KEYS` 加上 `BAT_HELPER_LOG_DIR`、`BAT_SERVER_CERT_PATH`、`DISABLE_UPDATES`，`beforeEach` 保存後**刪除**這 7 個變數（原本只保存不刪），`afterEach` 照舊還原。沒改產品程式。
   - 為什麼多了兩個：PTY env 會繼承 `process.env`，T0679 指出的 `BAT_HELPER_LOG_DIR`（第 174、203 行）之外，同檔還斷言 `BAT_SERVER_CERT_PATH` 為 undefined（第 173、202 行），`recovery (T0112)` 那項斷言 `v1.DISABLE_UPDATES` 為 undefined——在 BAT 的 claude-cli 分頁（embedded runtime 會注入 `DISABLE_UPDATES=1`）裡跑就會失敗。修前以三者都設的環境重現 3 項失敗，修後 0。
2. `.github/workflows/tests.yml`（新檔）：只有 `workflow_dispatch`；job `unit-tests`，`ubuntu-24.04`、Node 24、`npm ci --ignore-scripts`，另加一步 `node node_modules/electron/install.js`；測試步驟的 `env` 把 `BAT_HELPER_LOG_DIR`／`BAT_USER_DATA` 設到 `${{ runner.temp }}`；跑 `npm run test:unit -- --reporter=default --reporter=json --outputFile.json=…`；最後 `if: always()` 的步驟印出通過／失敗／略過數與失敗檔數，並寫進 job summary。未改 pre-release.yml／release.yml。
   - **偏離「先比照 `npm ci --ignore-scripts`」的原因**：只用 `--ignore-scripts` 時有 11 個測試檔載入即失敗（`Electron failed to install correctly`）——這些檔載入的模組沒 mock 就 `require('electron')`，而 electron 的 `index.js` 需要 postinstall 產生的 `path.txt`。最小補法是只跑 electron 自己的 postinstall（`install.js`，WSL 實測 1.8 s），其他套件的 install script 仍不跑。
   - `BAT_HELPER_LOG_DIR`／`BAT_USER_DATA` 放在步驟層級：actionlint 指出 job 層級的 `env` 不能用 `runner` context（第一版寫在 job 層級，被擋下後修正）。
   - 失敗檔數用 `testResults` 算：vitest JSON 的 `numTotalTestSuites` 把 describe 區塊也算進去（第一次模擬是 35，實際失敗檔是 20）。

### 驗證結果

| 項目 | 結果 | 證據 |
|---|---|---|
| `pty-manager-helper-env.test.ts`，不設變數 | PASS | 22 passed (22) |
| 同檔，設 `BAT_HELPER_LOG_DIR`／`BAT_USER_DATA`／`BAT_SERVER_CERT_PATH`／`DISABLE_UPDATES`／`BAT_HELPER_DIR`／`BAT_REMOTE_PORT`／`BAT_REMOTE_TOKEN` | PASS | 22 passed (22)；修前同環境 3 failed |
| `npm run test:unit`（Windows），不設兩個變數 | PASS | Test Files 326 passed (326)，Tests 5751 passed \| 3 skipped（HEAD `cf565519`＋本單兩檔） |
| `npm run test:unit`（Windows），兩個變數設到 scratchpad 暫存目錄 | PASS | Test Files 326 passed (326)，Tests 5751 passed \| 3 skipped（HEAD `d32856bf`＋本單兩檔）。前兩次各有 3／1 項 5 s timeout（`ct-worktree-status.test.ts`、`worktree-status-after-close.test.ts` 的真 git 測試），當時 WSL 模擬與 T0680／T0681 的測試同時在跑；這兩檔單獨在設／不設變數下各跑都 24 passed，`ct-worktree.ts` 也不讀這兩個變數，判定為負載造成 |
| `npm run typecheck` | PASS | exit 0 |
| `npm run typecheck:electron` | PASS | exit 0 |
| workflow 語法 | PASS | actionlint v1.7.7（`go install` 到 scratchpad，不進 repo）：`tests.yml` exit 0；`pre-release.yml` 也 exit 0 當對照 |
| ubuntu 模擬（WSL Ubuntu 24.04、Node 24.22.0、npm 11.19.1；從 HEAD clone、覆蓋本單兩檔、清掉 `BAT_*`／`CT_*`、`CI=true`） | PARTIAL（預期中） | `npm ci --ignore-scripts` + electron `install.js` 後：Tests 5637 passed, 21 failed, 6 skipped / 5664；files 9 failed / 322。摘要步驟用 js-yaml 從 `tests.yml` 取出 `run:` 原文執行：有結果檔 → 印出上列那行並寫入 summary；沒有結果檔 → 印 `no vitest results…`、exit 0 |
| 實際 GitHub 上試跑 | 不在本單 | 由塔台 push 後觸發 |

### 給塔台的試跑指令

push 後：

```bash
gh workflow run tests.yml -R gowerlin/better-agent-terminal --ref main
gh run list -R gowerlin/better-agent-terminal --workflow tests.yml -L 1
gh run watch -R gowerlin/better-agent-terminal <run-id>
```

結果看 job `unit-tests` 的 summary（`tests: … passed, … failed …; files: … failed / … total`），或 `Summary (passed / failed)` 步驟的輸出。依 WSL 模擬，預期是 9 檔 21 項失敗（下列）；如果 GitHub 上多出別的失敗，才是新問題。

### Commit

- `a35c4ce3` test(ci): T0683 isolate helper-env test from the shell, add manual tests.yml（只含 `electron/__tests__/pty-manager-helper-env.test.ts`、`.github/workflows/tests.yml`，`git commit --only`）
- 工單本身另一個 commit（本回報）。未 push。

### 遭遇問題

1. 與 T0680／T0681 共用工作目錄：執行期間它們陸續 commit，所以兩次 Windows 全套的檔數從 324 變成 326，屬正常；我的 commit 只含本單兩檔。
2. **ubuntu 上會失敗的 21 項（9 檔）**——都是測試寫死 Windows 行為，在任何 Linux 都會發生，不是 WSL 特有（最後兩項可能例外，見說明）：

   | 檔案 | 失敗數 | 原因（從錯誤訊息判讀） |
   |---|---|---|
   | `electron/__tests__/bat-mcp-launch.test.ts` | 4 | 期望 `'--mcp-config=…'` 有引號；Linux 的暫存路徑沒有 `\`，引號規則不加引號 |
   | `electron/__tests__/blocked-hooks-launch.test.ts` | 4 | 同上（`--mcp-config=` / `--settings=` 的引號） |
   | `electron/__tests__/claude-session-name-launch.test.ts` | 3 | 同上 |
   | `electron/__tests__/gh-resolver.test.ts` | 4 | 期望找到 `gh.exe`、`C:\Missing/gh.exe` 這類 Windows 路徑 |
   | `electron/__tests__/upgrade-rollback-main.test.ts` | 1 | `Expected absolute Windows path` |
   | `electron/__tests__/wsl-install-bundle.test.ts` | 2 | `Expected absolute Windows path: C:\b.…`（T0681 也在動這個檔，修完後要重看） |
   | `scripts/__tests__/e2e-baseline-source.test.mjs` | 1 | 期望 Windows 的 per-machine／per-user 安裝路徑 |
   | `electron/__tests__/tls-fingerprint.test.ts` | 1 | 連線被拒的錯誤分類不同；可能是 WSL 網路特有，GitHub 上要再看 |
   | `electron/remote/__tests__/server-bundle-download-retry.test.ts` | 1 | 127.0.0.1 關閉的埠得到 `ECONNRESET` 而非 `ECONNREFUSED`；同上，可能是 WSL 特有 |

   建議：擋版那張單之前先開一張修這些（用 `path.win32`／明確 `platform` 參數，或 `it.skipIf(process.platform !== 'win32')`，依每項的用意選）；GitHub 試跑結果出來後再確認最後兩項是否也會失敗。

### 互動紀錄

無（yolo，未向塔台提問）。

### Landing check

PASS。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1：工單在 REPO_ROOT 下。C-3：`affects_files` 都存在或有既有上層目錄（informational）。C-2：無 `branch` 欄位。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 回報時間

2026-10-21T20:53:16+0800
