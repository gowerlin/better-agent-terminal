---
schema_version: 1
schema_kind: workorder
id: T0685
title: "CI 第二步：新增 test:legacy（tests/ 底下 tsx／node:test，帶逾時）並加進 tests.yml；刪 5 個失效 script；更新 5 處指向已刪測試的註解；wsl-systemd 錯誤訊息改 describeError；ssh-start-server 的 start-failed 補測試；CLAUDE.md 補測試位置規則"
type: feature
status: TODO
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: M
created_at: "2026-10-21T21:11:56+0800"
depends_on:
  - "T0680／T0681／T0682／T0683（皆 DONE；`tests/` 底下的失敗與逾時已處理）"
related:
  - "D177 第 2 點（CI 第二步）；使用者 2026-10-21 追加：Worker 建議的兩個小改進併入本單"
  - "盤點與跑法：T0678 回報區「tests/ 盤點」（哪些是 tsx harness、哪些是 node:test、哪些略過）；T0682 回報區（`--test-timeout=60000`、npx 啟動偶發慢，建議用專案內的 tsx）"
  - "失效 script：T0679 回報區「失效 script」（`test:claude-ctrl-o`、`diagnose:ctrl-o`、`diagnose:ctrl-o:quick`、`diagnose:ctrl-o:verbose`、`test:file-drag`）"
  - "註解：`src/components/profiles/ProfileCard.tsx:58`、`src/components/profiles/types.ts:45`（T0680）；`electron/remote/ssh-start-server.ts:109`、`:395`、`electron/remote/ssh-bundle-uploader.ts:72`（T0681）"
  - "小改進：`electron/wsl-systemd.ts:244-246`（`enableLinger` 解析使用者失敗時用 `error.message`，改成與其他失敗路徑一致的描述函式）；`electron/remote/ssh-start-server.ts:557` 的 `start-failed` 分類（`isStartIssue`）目前沒有測試（T0681 建議）"
affects_files:
  - package.json
  - package-lock.json
  - scripts/run-legacy-tests.mjs
  - .github/workflows/tests.yml
  - src/components/profiles/ProfileCard.tsx
  - src/components/profiles/types.ts
  - electron/remote/ssh-start-server.ts
  - electron/remote/ssh-bundle-uploader.ts
  - electron/wsl-systemd.ts
  - electron/__tests__/wsl-systemd.test.ts
  - electron/__tests__/ssh-start-server.test.ts
  - CLAUDE.md
  - _ct-workorders/T0685-ci-step2-test-legacy-and-cleanup.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 `test:legacy`：用 `scripts/run-legacy-tests.mjs` 執行 `tests/` 底下不在 vitest `test.include` 的測試。node:test 檔（`import … from 'node:test'`）一次用 `tsx --test --test-timeout=60000` 跑；自寫 harness 檔逐一用 `tsx <file>` 跑並看結束代碼。自動找檔（新加的檔也會被跑到），排除清單寫在腳本裡並註明原因：手動 probe（`_` 開頭）、互動式（`console-test.js`）、函式庫（`console-controller.js`）、Playwright（`tests/e2e/**`）、`__mocks__`／`__helpers__`／`testworkspace`。結束時印出每檔結果與總計，有任何失敗就以非 0 結束。用專案內的 `tsx`，不用 `npx`。"
  - "🔴 `tsx` 目前不是 devDependency（現有 script 用 `npx tsx`）。可以把 `tsx` 加成 devDependency（固定版本，`npm install -D`），讓 CI 的 `npm ci` 有確定的版本；它本身沒有 install script（依賴的 esbuild 已在 `allowScripts`）。不得新增其他相依。現有 `test:node-resolver`、`test:claude-code-path` 可改用專案內的 `tsx`（行為不變）。"
  - "🔴 `tests.yml`：在 unit tests 之後加一步 `npm run test:legacy`，並讓兩步的結果都會被印出（unit tests 失敗時 legacy 仍要跑，結果一起寫進 job summary）。觸發方式維持只有 `workflow_dispatch`；**不要**改 pre-release.yml／release.yml（擋版是另一張單）。用 actionlint 檢查（若可用）。"
  - "🔴 `package.json`：刪掉 5 個失效 script（見 related）；加 `test:legacy`。不改其他 script 的行為。"
  - "🔴 註解：只改 5 處註解的文字，指向現在守住同一個契約的 vitest 檔與測試名稱；`StatusDot` 拆分等程式結構不動。"
  - "🔴 `wsl-systemd.ts`：只把 `enableLinger` 解析使用者失敗那一段改成與同檔其他失敗路徑相同的錯誤描述方式（讓 stderr 出現在訊息裡），並在 `electron/__tests__/wsl-systemd.test.ts` 補一項斷言 stderr 會出現在錯誤裡。不改其他行為。"
  - "🔴 `ssh-start-server.ts` 的 `start-failed`：只補測試（`electron/__tests__/ssh-start-server.test.ts`），涵蓋會被分類成 `start-failed` 與不會的情境；產品程式不改。若發現分類本身有錯，停下來問塔台。"
  - "🔴 `CLAUDE.md`「Frontend unit tests」節：依現行 `vite.config.ts` 更正測試檔位置那一行（含 `electron/**` 等實際收進的路徑），補 `npm run test:legacy` 的用途，並加一句「新測試一律放 vitest 收得到的位置，不要再放進 `tests/`」（D177）。遵守該檔開頭的撰寫規則（每節精簡，細節不寫進本檔）。"
  - "🔴 驗證：`npm run test:unit` 全過（記通過數）、`npm run test:legacy` 在本機全過（記每檔結果）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、`npm ci` 能從 lock 重建（改了 lock 時）。"
  - "🔴 同時可能有 T0684（Linux 上寫死 Windows 行為的測試改跨平台）的 Worker 在跑，它只動 `electron/__tests__/` 與 `scripts/__tests__/` 裡的特定測試檔：只動本單 `affects_files`；commit 用 `git commit --only <檔案>`，不要 `git add -A`。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。Git：不 push；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。不跑 Playwright e2e。yolo：不得問使用者，判讀問題問塔台；不得寫出權杖值或 secrets。"
---

# T0685 — CI 第二步：test:legacy 與收尾清理

## 目標

BUG-168 的測試修正已完成（T0680～T0683），`tests/` 底下的舊測試現在在 Windows 上都能跑過。本單把它們接上：新增 `npm run test:legacy`（帶逾時，缺 mock 不再卡住）並加進手動的 `tests.yml`；順便清掉失效的 script、更新指向已刪測試的註解，並做使用者同意併入的兩個小改進。把測試設成發版關卡是下一張單。

## 要做的事

1. `scripts/run-legacy-tests.mjs` + `package.json` 的 `test:legacy`（必要時加 `tsx` devDependency）。
2. `tests.yml` 加 legacy 步驟，兩步結果都寫進 job summary。
3. 刪 5 個失效 script。
4. 更新 5 處註解。
5. `wsl-systemd.ts` 錯誤描述 + 一項 vitest；`ssh-start-server` 的 `start-failed` 補測試。
6. `CLAUDE.md`「Frontend unit tests」節更新。
7. 驗證、commit（不 push）。

## 驗收

- `npm run test:legacy` 在本機全過，輸出每檔結果與總計；故意讓一個檔失敗時以非 0 結束（回報附實測）。
- `tests.yml` 兩步都會跑、結果都在 summary；actionlint 通過；未改 pre-release／release。
- 5 個失效 script 已刪；5 處註解指向現行的 vitest 測試。
- `test:unit` 全過；typecheck 0／0；build 成功。
- 只改 `affects_files`；未 push。

---

## 回報區

### 完成狀態

### 修改內容

### 驗證結果

### 給塔台的試跑指令

### Commit

### 遭遇問題

### 回報時間
