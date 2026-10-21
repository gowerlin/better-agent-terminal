---
schema_version: 1
schema_kind: workorder
id: T0686
title: "CI 擋版：pre-release.yml／release.yml 加測試關卡（test:unit + test:legacy），失敗就不 build、不發版；tests.yml 改成可重用，同一份定義"
type: feature
status: TODO
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: S
created_at: "2026-10-21T21:40:10+0800"
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

### 修改內容

### 驗證結果

### Commit

### 遭遇問題

### 回報時間
