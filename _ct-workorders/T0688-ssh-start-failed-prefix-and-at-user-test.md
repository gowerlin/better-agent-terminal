---
schema_version: 1
schema_kind: workorder
id: T0688
title: "SSH 啟動 bat-server：start-failed 的錯誤訊息仍以 `enable-failed:` 開頭（改成與 errorCode 一致）；`sshUser` 含 `@` 的拒絕補測試"
type: fix
status: TODO
repo: better-agent-terminal
project: BUG-168
priority: P3
sizing: XS
created_at: "2026-10-21T22:00:10+0800"
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

### 修改內容

### 驗證結果

### Commit

### 遭遇問題

### 互動紀錄

### 回報時間
