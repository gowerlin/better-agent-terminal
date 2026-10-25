---
schema_version: 1
schema_kind: workorder
id: T0688
title: "SSH 啟動 bat-server：start-failed 的錯誤訊息仍以 `enable-failed:` 開頭（改成與 errorCode 一致）；`sshUser` 含 `@` 的拒絕補測試"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-168
priority: P3
sizing: XS
created_at: "2026-10-21T22:00:10+0800"
started_at: "2026-10-21T22:03:59+08:00"
updated_at: "2026-10-21T22:06:33+08:00"
completed_at: "2026-10-21T22:06:33+08:00"
depends_on: []
related:
  - "D179（v0.7.1-pre.5 發版前的小批：T0687／T0688／T0689）"
  - "T0685 回報區「遭遇問題」第 2 點：`start-failed` 時錯誤字串仍以 `enable-failed:` 開頭（`summariseFailure('enable-failed', …)`，`errorCode` 正確），新測試沒有鎖前綴"
  - "`electron/remote/ssh-start-server.ts` `buildSshConnectArgs` 註解：「The `@` check has no test of its own」（T0681 去重時留下）"
  - "BUG-168 修正過程發現的小項，不重開 BUG-168"
affects_files:
  - electron/remote/ssh-start-server.ts
  - electron/__tests__/ssh-start-server.test.ts
  - _ct-workorders/T0688-ssh-start-failed-prefix-and-at-user-test.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 錯誤字首：stage 2（enable + restart / launchctl load）失敗時，先判斷 `isStartIssue`，再以對應的 label 呼叫 `summariseFailure`，讓 `error`（與 `logger.warn` 那行）的字首和 `errorCode` 一致（`start-failed:` / `enable-failed:`）。分類規則（regex）不改。改之前先 grep 有沒有消費者依賴 `enable-failed:` 這個字串前綴（精靈步驟 `src/components/setup-wizard/steps/ssh/start-server.ts`、`error-mapper.ts`、i18n、e2e、`site/`、`docs/`）；有的話一併改並列進回報，沒有就只改這一處。"
  - "🔴 測試：T0685 的 `stage 2 classification: start-failed vs enable-failed` 各案例加上 `error` 字首斷言；`sshUser` 含 `@` 補測試：`startServer` 與 teardown 路徑（`runTeardown` 經對外匯出的函式）在任何 ssh exec 之前被拒、spawn 沒被呼叫、訊息維持歷史格式 `Invalid sshUser: …`。測的是現有行為：若發現被拒時例外直接拋出 `startServer`（呼叫端拿到 exception 而不是 `{ ok: false }`），先問塔台再決定改不改行為。同時更新 `buildSshConnectArgs` 上方那段「no test of its own」的註解。"
  - "🔴 同批 T0689 會跑 `npm run build:dir`（先清 `dist-electron` 再 vite build）。本單**不要**跑 `npx vite build`、`npm run build*`，也不要跑整個 `npm run test:unit`（部分測試讀 `dist-electron`，會被 T0689 的建置干擾）；只跑相關測試檔（`npx vitest run electron/__tests__/ssh-start-server.test.ts`，以及有改到或依賴這些字串的測試檔）與 `npm run typecheck:electron`（= 0；若動到 `src/` 另跑 `npm run typecheck` = 0）。整包 `test:unit` 與 vite build 由塔台在這批收齊後一起跑。"
  - "🔴 Git：`git commit --only <檔案>`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：測試資料用 `demo` / `tester` 這類假值，不得用真名或家目錄路徑。yolo：不得問使用者，判讀問題問塔台。"
---

# T0688 — SSH 啟動失敗的錯誤字首、`@` 測試

## 目標

兩個 BUG-168 修正過程發現的小項，併入 `v0.7.1-pre.5` 發版批次（D179）：

1. SSH 精靈啟動 bat-server 時，stage 2 被判為 `start-failed`，錯誤訊息卻以 `enable-failed:` 開頭。改成字首與 `errorCode` 一致，並以測試鎖住。
2. `buildSshConnectArgs` 拒絕 `sshUser` 含 `@`，但沒有測試。補上。

## 要做的事

1. `electron/remote/ssh-start-server.ts`：stage 2 失敗的 label 依 `isStartIssue` 決定；先查有沒有消費者依賴舊字首。
2. `electron/__tests__/ssh-start-server.test.ts`：字首斷言；`@` 的 `startServer` 與 teardown 測試；更新註解。
3. 相關測試檔 + `npm run typecheck:electron`；不跑 build、不跑整包 `test:unit`（見 `memory_overrides` 第 3 條）。

## 驗收

- `start-failed` 的 `error` 以 `start-failed:` 開頭，`enable-failed` 的以 `enable-failed:` 開頭，測試鎖住。
- `sshUser` 含 `@` 在 ssh exec 之前被拒，`startServer` 與 teardown 各有測試。
- 相關測試全過；`npm run typecheck:electron` = 0；只改 `affects_files`（有依賴舊字首的消費者時另列）；未 push。

---

## 回報區

### 完成狀態

DONE。兩個驗收項都做到；只改 `affects_files` 的兩個產品檔，沒有其他消費者依賴舊字首。

Landing check：**PASS**。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 `REPO_ROOT` 底下；C-3 兩個產品檔都存在；C-2 沒有 `branch` 欄位（目前在 `main`）。`CT_HOME` 沒設定（不是 worktree 派工）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄，不比對）。

### 修改內容

- `electron/remote/ssh-start-server.ts`
  - stage 2 失敗時先算 `isStartIssue`，得到 `errorCode`，再用 `summariseFailure(errorCode, enableExec)` 組字串。`error` 和 `logger.warn` 那一行的字首都跟 `errorCode` 一樣（`start-failed:` / `enable-failed:`）。分類 regex 沒有改。
  - `buildSshConnectArgs` 上方的註解：拿掉「no test of its own」，改成寫出測試名稱，並說明 teardown 在 `validateTeardownConnect` 就先擋掉 `@`。
- `electron/__tests__/ssh-start-server.test.ts`
  - T0685 `stage 2 classification` 的 11 個案例都加上斷言：`error` 開頭是 `start-failed: ` 或 `enable-failed: `，而且 `logger.warn` 收到的是 `[ssh-start-server] ${error}`。既有的 `an enable failure stops before verifying` 也加了 `^enable-failed: ` 斷言。
  - 新增 `an sshUser containing @ is rejected before any ssh exec (T0688)`：`__internals.buildSshConnectArgs` 與 `startServerOnRemote` 都以 `Invalid sshUser: demo@evil.example` 拒絕（訊息格式不變），spawn 0 次。
  - 新增 `teardown rejects an sshUser containing @ before any ssh exec (T0688)`：`stopServerOnRemote` 與 `uninstallBundleOnRemote` 都回 `{ ok: false }`，spawn 0 次。
  - 新增的測試資料用 `demo`、`devbox.example`、`evil.example`（D176）。
- 消費者檢查（grep `enable-failed:` / `start-failed:`，範圍包含 `src/`、`electron/`、`tests/`、`e2e/`、`site/`、`docs/`）：精靈 `src/components/setup-wizard/steps/ssh/start-server.ts` 與 `error-mapper.ts` 都靠 `errorCode` 分流，i18n 和 e2e 也只用 `errorCode`。唯一出現這段字串的地方是 `src/components/setup-wizard/__tests__/wizard-cancel-rollback.test.ts:230` 的 mock 回傳值（`errorCode: 'enable-failed', error: 'enable-failed: nope'`），本身就一致，不受影響。所以只改了這一處。

### 驗證結果

| 項目 | 結果 | 證據 |
|---|---|---|
| `npx vitest run electron/__tests__/ssh-start-server.test.ts` | PASS | 58 passed（原本 56，新增 2） |
| 相關測試檔：`ssh-start-server`、`ssh-teardown`、`ssh-alias-target`、`upgrade-rollback-main`、`ssh-bundle-layout-and-port`、`wizard-cancel-rollback`、`step-error-i18n` | PASS | 7 files / 266 tests passed |
| 反向檢查：source 暫時改回 `summariseFailure('enable-failed', …)` | 如預期失敗 | 5 個 start-failed 案例失敗（例如 `"enable-failed: bat-server.service: Main process exited…"`）。改回後 58 passed |
| `npm run typecheck:electron` | PASS（0） | tsc 沒有輸出錯誤 |
| `npm run typecheck` | 沒有跑 | 沒有改到 `src/` |
| vite build、整包 `test:unit` | 依 `memory_overrides` 第 3 條不跑 | 由塔台在這批收齊後一起跑 |

### Commit

- 產品：`79412e61c4b2850c79f3915af96a64f002f2067c`，`fix(ssh): start-failed error prefix follows errorCode; test @ in sshUser (T0688)`，用 `git commit --only` 提交兩個產品檔
- 工單：在這次回報之後另外提交，用 `git commit --only`
- 沒有 push。

### 遭遇問題

1. **`@` 被拒時 `startServerOnRemote` 會直接拋出例外**：這是現有行為，和 `serverHome`、`sshHost` 開頭是 `-` 的情況一樣，既有測試都用 `rejects.toThrow`。renderer 拿到的不是例外：`ssh:start-server` handler（`electron/remote/ssh-setup-handlers.ts`）會接住它，改回 `{ ok: false, method: 'failed', errorCode: 'unknown', error: 'Invalid sshUser: …' }`，所以呼叫端 `startServer` 仍然拿到 `{ ok: false }`。工單寫的「例外直接拋出 `startServer`」條件不成立，所以沒有問塔台，也沒有改行為。新測試鎖的是現有行為。
2. **teardown 路徑不會走到 `buildSshConnectArgs` 的 `@` 檢查**：`runTeardown` 先跑 `validateTeardownConnect`，`TEARDOWN_USER_RE`（`[A-Za-z0-9._-]`）就先拒絕 `@`。訊息是 `<label>: Invalid sshUser for teardown: "demo@evil.example"`，不是工單預期的歷史格式 `Invalid sshUser: …`。工單要求「測的是現有行為」，所以 teardown 測試鎖的是這個實際訊息，沒有改程式。`buildSshConnectArgs` 本身的歷史格式另外用 `__internals` 直接測。如果塔台想讓 teardown 也用歷史格式，要另開工單。
3. 第一次用 Python 腳本改測試檔時，跳脫字元出錯，斷言失敗後腳本直接中止，檔案沒有被寫入。之後改用 Edit 工具。

### 互動紀錄

無（yolo，沒有向塔台提問）。

### 回報時間

2026-10-21T22:06:05+08:00
