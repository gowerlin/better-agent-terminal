---
schema_version: 1
schema_kind: workorder
id: T0682
title: "BUG-168 G4：精靈 journey／e2e 測試的共用 mock 補齊現行 IPC（Docker → WSL → SSH），並加防卡死，讓缺 mock 時直接失敗而不是逾時"
type: fix
status: TODO
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: M
created_at: "2026-10-21T20:38:28+0800"
depends_on:
  - "T0679（DONE `6fb40e70`：逾時分析表）"
  - "塔台排程：第 1 波 T0680、T0681、T0683 完成後才派工（D177）"
related:
  - "D177；BUG-168；T0679 回報區「逾時分析」表（每個檔卡住的步驟、缺的 IPC、引入的 commit）"
  - "共同機制：`src/components/setup-wizard/wizard-runner.ts` 可重試步驟失敗後 `await this.waitForRetryOrSkip()`（T0274 刻意設計）；共用 mock `tests/__mocks__/electron-api.ts` 最後更新於 T0383"
affects_files:
  - tests/__mocks__/electron-api.ts
  - tests/wizard-runner.test.ts
  - tests/wizard-rollback-cross.test.ts
  - tests/docker-flow-journeys.test.ts
  - tests/docker-wizard-e2e.test.ts
  - tests/docker-wizard-runner.test.ts
  - tests/wsl-flow-journeys.test.ts
  - tests/wsl-wizard-e2e.test.ts
  - tests/ssh-flow-journeys.test.ts
  - tests/ssh-wizard-e2e.test.ts
  - "tests/__helpers__/**（新檔，若需要共用 harness）"
  - _ct-workorders/T0682-bug168-g4-wizard-mocks-and-hang-guard.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改測試與 mock，不改產品程式。mock 的形狀要和現行 IPC 一致（以 `electron/preload.ts` 與 `src/types/` 的型別為準），不要為了讓測試過而回傳產品不會回傳的值。"
  - "🔴 依序做三段，每段做完先跑該段的檔案：① Docker（`docker.pickServerPort`，T0649）；② WSL（`wsl.resolveHome`、`update.getVersion`、`remote.serverBundle.*`、`wsl.pickServerPort`／`keepAlive`／`snapshotUnit`、`profile.listLocal`；NAT 警告要初始化 i18n；`serverInstallPath` 的斷言依 T0378 改成絕對路徑）；③ SSH（`update.getVersion`、`ssh.openVerifyTunnel`／`verifyTunnelStatus`／`closeVerifyTunnel`，tunnel mock 回傳測試內本機 HTTPS server 的 port）。SSH 段若太大做不完，回報 PARTIAL 並寫清楚剩下什麼。"
  - "🔴 防卡死：步驟失敗後不得無限等待。在共用 harness 讓 onProgress 看到失敗就 `runner.cancel()`（或等效做法），並在跑法上帶 `--test-timeout`；目標是以後缺 mock 會直接失敗並指出缺哪個 IPC。"
  - "🔴 `wizard-rollback-cross` 的 wsl-linux 那項（T0679 標 D）：用正確的 mock 重跑並判定；若結論是產品回歸，停下來問塔台，不要改產品。"
  - "🔴 這些測試不得真的連線遠端、啟動 WSL／Docker／SSH、寫入使用者家目錄。"
  - "🔴 驗證：九個檔各用 `npx tsx --test --test-timeout=60000 <file>` 跑過，記通過／失敗數與耗時；若改到 `tests/` 以外的檔案，必跑 `npm run test:unit`、`npm run typecheck`、`npm run typecheck:electron`、`npx vite build`。"
  - "🔴 不改 `package.json`、`vite.config.ts`、CI（`test:legacy` 由後續工單新增）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，測試資料用 `demo`／`tester`／代稱。Git：`git commit --only <檔案>`；不 push；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。不跑 Playwright e2e。yolo：不得問使用者，判讀問題問塔台；不得寫出權杖值。"
---

# T0682 — BUG-168 G4：精靈測試 mock 補齊與防卡死

## 目標

`tests/` 底下 9 個精靈 journey／e2e 測試會逾時：共用 mock 少了後來工單新增的 IPC，步驟失敗後精靈停在「等使用者選重試／略過／取消」，測試沒有人按，所以卡住（T0679）。本單依 Docker → WSL → SSH 的順序補齊 mock、修正過時的斷言，並加上防卡死，讓之後缺 mock 時直接失敗。

## 要做的事

1. 讀 T0679 回報區「逾時分析」表。
2. 依序做 Docker、WSL、SSH 三段，每段做完跑該段的測試。
3. 加防卡死（共用 harness 失敗即取消、跑法帶 `--test-timeout`）。
4. 重跑並判定 `wizard-rollback-cross` 的 wsl-linux 那一項。
5. 驗證、commit（不 push）。

## 驗收

- 九個檔都在時限內結束；全部通過，或回報 PARTIAL 並列出剩下的項目與原因。
- 故意拿掉一個 IPC 時，測試會直接失敗並指出缺哪個 IPC（回報區附實測）。
- 只改 `affects_files`；未 push。

---

## 回報區

### 完成狀態

### 各段結果（檔案、通過／失敗、耗時）

### 防卡死實測

### wizard-rollback-cross wsl-linux 判定

### Commit

### 遭遇問題

### 回報時間
