---
schema_version: 1
schema_kind: workorder
id: T0795
title: "BUG-201：`dev-deploy-headless.test.mjs` 的 `main()` 測試改用每次執行獨立的輸出 / staging 目錄，兩個 `test:unit` 同時跑時不再互相覆蓋"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-03T00:03:22+0800"
started_at: "2026-11-03T00:04:42+0800"
updated_at: "2026-11-03T00:11:05+0800"
completed_at: "2026-11-03T00:11:05+0800"
session_ids:
  - "5f1ddcb4-c9c0-44ae-963a-3c730a193b9f"
depends_on: []
related:
  - "BUG-201（low，OPEN → FIXING）；T0794 回報區〈範圍外的失敗〉；T0391 / T0434（`dev-deploy-headless` 與 helper staging 的來源）；BUG-195 / T0786（同檔 `renderBashScript (WSL target)` 已設 30 s）；D238"
  - "`scripts/dev-deploy-headless.mjs`（第 41 行模組層常數 `STAGING_ROOT = <repo>/dist-server/dev-deploy-headless`；`main()`；`stageHelperScripts`；WSL 路徑第 729 行 `wslpath -a STAGING_ROOT`）；`scripts/__tests__/dev-deploy-headless.test.mjs` 第 320 行起 `describe('main() dry-run never writes')`；`package.json` `deploy:headless:dev`"
affects_files:
  - scripts/dev-deploy-headless.mjs
  - scripts/__tests__/dev-deploy-headless.test.mjs
  - _ct-workorders/BUG-201-dev-deploy-headless-test-shared-output-dir.md
  - _ct-workorders/_bug-tracker.md
  - _ct-workorders/T0795-fix-bug201-dev-deploy-headless-test-output-dir.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先查證再修：① 在兩個 `npm run test:unit` 同時跑（或兩個 `npx vitest run scripts/__tests__/dev-deploy-headless.test.mjs` 同時跑，較快）下重現 T0794 記錄的 `EPERM` / `ENOENT` / `Build failed`，記錄次數與錯誤原文。② 找出所有共用的固定路徑：`STAGING_ROOT`（`dist-server/dev-deploy-headless`）之外，`main()` 呼叫的 build（esbuild / vite / `build-server-bundle` 等）有沒有寫到其他固定輸出目錄（例 `dist-server/` 其他子目錄、`dist-electron`），逐一列出並判斷是否也會衝突。"
  - "🔴 修法方向（可調，偏離時先問塔台）：讓 staging 根目錄可由呼叫端覆寫，測試每次以 `mkdtemp` 建立自己的目錄並在結束時刪除。例：`main(argv, { stagingRoot })` 的第二個選項參數，或只供測試用的 env（名稱以 `BAT_DEV_DEPLOY_` 開頭）；模組層常數改成由 `main()` 解析後往下傳（含 WSL 分支的 `wslpath`、`stageHelperScripts`、dry-run 輸出）。若 build 的輸出目錄也共用，以同樣方式讓測試給獨立目錄；做不到（例：build 工具不支援指定輸出）就停下問塔台，不要改 build 腳本本身的預設。"
  - "🔴 不變的行為（不回歸）：`npm run deploy:headless:dev`（不帶任何新選項 / env）的預設 staging 路徑、輸出內容、dry-run 與 `--yes` / `--rollback` / `--tag` / WSL / dir target 的行為完全不變；不新增 CLI 旗標給一般使用者（若必須加，先問塔台）。不改 `vite.config.ts`、不改其他測試檔、不 skip / retry。既有測試（含 T0786 設的 `renderBashScript (WSL target)` 30 s）照舊通過。"
  - "🔴 驗證：① 修改前的重現結果（上）；② 修改後同樣的並行方式至少 5 次都通過（記錄方式與次數）；③ 整套 `npm run test:unit` 1 次 exit 0、兩個 `test:unit` 同時跑 1 次（本檔必須兩邊都過；其他檔若失敗列表說明，不擴大範圍）；④ 測試跑完 `dist-server/dev-deploy-headless` 不應被測試建立或改動（記錄跑前跑後是否存在 / mtime）；⑤ 手動跑一次 `node scripts/dev-deploy-headless.mjs --target dir:<暫存目錄>`（dry-run）確認預設路徑行為不變；⑥ `npm run typecheck:electron` = 0（`.mjs` 不在範圍時寫明）、`npm run test:legacy` 綠。"
  - "🔴 BUG-201：修好後 `status: FIXED`、加 `fixed_at` / `fix_commit`，表格狀態列同步，處理紀錄加一筆，文末補〈T0795 結果〉；`_bug-tracker.md` 只把 BUG-201 那一列從「⏳ 修復中 (FIXING)」移到「✅ 已修復」（區段標題照 `_local-rules.md` parser 規則），FIXING 區段放回 `_（無）_` 佔位列，更新 frontmatter `breakdown` / `generated_at`、〈統計〉行、〈最後同步〉加一筆。🔴 逐一 Edit，不用全檔 `sed`，改完跑 `src/types/__tests__/bug-tracker.test.ts`（L179）。"
  - "🔴 不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。暫存腳本用 Write 寫檔放系統暫存目錄，收尾刪除。完成狀態寫 `DONE`（BUG 的 FIXED 寫在 BUG 單，L177）。"
---

# T0795 — BUG-201：dev-deploy-headless 測試共用輸出目錄

## 元資料

- **工單編號**：T0795
- **類型**：implementation（測試隔離）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-03T00:03:22+0800
- **預估規模**：S

## 背景

`scripts/dev-deploy-headless.mjs` 的 staging 根目錄是模組層常數 `<repo>/dist-server/dev-deploy-headless`。`dev-deploy-headless.test.mjs` 的 `main()` 測試會寫進這個固定目錄，兩個 `test:unit` 同時跑（例：同一 checkout 並行的兩個 Worker 各自驗證）時互相覆蓋，出現 `EPERM` / `ENOENT` / `Build failed`（T0794 記錄）。CI 只跑一套，所以沒撞到。使用者決定現在修（D238）。

## 範圍

1. 重現並列出所有共用的固定路徑。
2. 讓 staging（必要時含 build 輸出）可由呼叫端覆寫，測試用自己的暫存目錄。
3. 驗證：並行 ≥ 5 次、整套、兩套並行、預設路徑行為不變。
4. BUG-201 → FIXED、tracker 同步。

## 不做

- 不改 `npm run deploy:headless:dev` 的預設行為、不加一般使用者的 CLI 旗標（必要時先問塔台）、不改 build 腳本預設、不改 `vite.config.ts`。

## 驗收

- [ ] 修改前重現（次數、錯誤原文）與共用路徑清單
- [ ] 修法與理由
- [ ] 並行 ≥ 5 次通過、整套 1 次、兩套並行 1 次
- [ ] 預設路徑行為不變（dry-run 手動確認）、測試不再動 `dist-server/dev-deploy-headless`
- [ ] `typecheck:electron` = 0、`test:legacy` 綠
- [ ] BUG-201 FIXED、tracker 只動該列、parser 測試綠

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：DONE（BUG-201 → FIXED，寫在 BUG 單）
- **完成時間**：2026-11-03T00:11:05+0800
- **session_id**：5f1ddcb4-c9c0-44ae-963a-3c730a193b9f
- **產品 commit**：`6c2b6b93`（`fix(dev-deploy-headless): main() takes a stagingRoot option; tests build into their own mkdtemp dir (T0795 / BUG-201)`）

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 REPO_ROOT 下 → PASS
- C-3：`scripts/dev-deploy-headless.mjs` / `scripts/__tests__/dev-deploy-headless.test.mjs` 存在（資訊）
- C-2：工單沒有 `branch` 欄位，目前 `main`
- `CT_HOME` 未設定（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`

### 1. 修改前重現與共用路徑

**重現方式**：暫存腳本同時起兩個 `npx vitest run scripts/__tests__/dev-deploy-headless.test.mjs`，等兩邊結束算一輪，共 6 輪。

| 輪 | a | b |
|---|---|---|
| 1 | 1（2 failed） | 0 |
| 2 | 0 | 1（1 failed） |
| 3 | 0 | 0 |
| 4 | 1（1 failed） | 1（2 failed） |
| 5 | 0 | 0 |
| 6 | 1（1 failed） | 1（1 failed） |

→ 6 輪中 4 輪有失敗，12 個 run 中 6 個失敗；失敗的都是 `main() dry-run never writes` 的 `deploy dry-run builds into staging …` / `T0434: --yes deploys JS + helpers …`。錯誤原文（路徑前綴為 repo 根目錄）：

- `ENOENT: no such file or directory, copyfile '…\scripts\bat-terminal.mjs' -> '…\dist-server\dev-deploy-headless\scripts\bat-terminal.mjs'`
- `EBUSY: resource busy or locked, copyfile '…\scripts\bat-terminal.mjs' -> '…\dist-server\dev-deploy-headless\scripts\bat-terminal.mjs'`
- `ENOENT: no such file or directory, open '…\dist-server\dev-deploy-headless\lockfile.js'`
- `staged file missing …\dist-server\dev-deploy-headless\headless-entry.js`
- `EPERM, Permission denied: '…\dist-server\dev-deploy-headless'`
- `ENOENT … copyfile '…\dist-server\dev-deploy-headless\scripts\bat-terminal.mjs' -> '<使用者資料夾>\AppData\Local\Temp\t0391-root-…\scripts\bat-terminal.mjs'`

本次 6 輪沒有出現 `Build failed`（T0794 記錄過；同一原因：另一邊在 build 途中 `rmSync` 了 outdir）。

**`main()` 寫入的固定路徑（逐一）**：

| 路徑 | 寫入者 | 會衝突？ |
|---|---|---|
| `dist-server/dev-deploy-headless/`（`STAGING_ROOT`） | `buildHeadlessJs`（先 `rmSync` 再 esbuild `outdir`） | 是（上表） |
| `dist-server/dev-deploy-headless/scripts/`（`STAGING_HELPERS`） | `stageHelperScripts`（先 `rmSync` 再複製） | 是（上表） |
| `dist-server/dev-deploy-headless/{inspect,deploy,rollback}.sh` | WSL 分支 | 只在 WSL target；測試不走 |
| install root | 測試各自 `mkdtemp`（`t0391-root-*`） | 否 |

esbuild 只寫 `outdir`（沒有 `metafile` / `write` 到其他位置）；`main()` 不呼叫 `build-server-bundle.mjs`（只讀它的原始碼解析設定），不寫 `dist-server/staging`、`dist-electron` 或其他目錄。所以 build 輸出就是 staging，不需要另外隔離。

### 2. 修法與理由

- `scripts/dev-deploy-headless.mjs`：模組層 `STAGING_ROOT` / `STAGING_HELPERS` 改為 export 的 `DEFAULT_STAGING_ROOT`（值不變：`<repo>/dist-server/dev-deploy-headless`）；`main(argv, { stagingRoot = DEFAULT_STAGING_ROOT } = {})` 在函式內解析 `STAGING_ROOT` / `STAGING_HELPERS`，build、helper staging、`deployDir` 來源、WSL 的 `inspect.sh` / `wslpath -a` / `${mode}.sh`、dry-run 日誌都用解析後的值。
- 選擇第二個選項參數而非 env：只有程式呼叫能用，不會被一般使用者的環境變數意外觸發；不加 CLI 旗標（檔尾 `main()` 不帶選項，CLI 行為不變）。
- `scripts/__tests__/dev-deploy-headless.test.mjs`：`main()` 那組測試每支 `beforeEach` 以 `mkdtemp(t0795-staging-)` 建 staging、`afterEach` 刪除，經 `run(argv) = main(argv, { stagingRoot: staging })` 呼叫；另加三個斷言：dry-run 後 build 與 helpers 在給定的 staging、rollback dry-run 不在 staging 產生任何東西、`DEFAULT_STAGING_ROOT` 仍是 `<repo>/dist-server/dev-deploy-headless`（新測試 1 支，36 → 37）。其他 describe（含 T0786 的 `renderBashScript (WSL target)` 30 s）不動。

### 3. 驗證

| 項目 | 方式 | 結果 |
|---|---|---|
| ① 修改前重現 | 上節 | 6 輪 4 輪失敗 |
| ② 修改後並行 | 同一暫存腳本，兩個 `npx vitest run scripts/__tests__/dev-deploy-headless.test.mjs` 同時跑 **8 輪** | 16 / 16 exit 0（每個 `Tests 37 passed (37)`）；結束後 `%TEMP%` 沒有殘留 `t0795-staging-*` |
| ③ 整套 1 次 | `npm run test:unit` | exit 0，`Test Files 385 passed (385)`、`Tests 6783 passed \| 10 skipped (6793)` |
| ③ 兩套並行 1 次 | 兩個 `npm run test:unit` 同時跑 | 兩邊皆 exit 0，各 `385 passed` / `6783 passed \| 10 skipped`；其他檔也沒有失敗 |
| ④ 測試不動預設目錄 | `stat` `dist-server/dev-deploy-headless`（含 4 個 `.js`、`scripts/`） | ②③ 前後 mtime 都是 `2026-11-03 00:05:33.33…`（修改前最後一輪重現留下的），完全不變 |
| ⑤ 預設路徑行為不變 | `node scripts/dev-deploy-headless.mjs --target dir:<暫存目錄>`（dry-run，空的 `electron/remote`） | exit 0；日誌 `built into dist-server\dev-deploy-headless (helpers staged into dist-server\dev-deploy-headless\scripts)`，`dist-server/dev-deploy-headless` mtime 更新為 00:09:39（預期，CLI 用預設路徑）；10 列 plan 皆 `action=create backup=absent-marker`；install root 沒有任何新檔（只剩建立的 `electron/remote`） |
| ⑥ `npm run typecheck:electron` | — | exit 0（= 0）。`tsconfig.node.json` `include` 只有 `electron/**/*.ts` + `vite.config.ts`，本單改的 `.mjs` 不在範圍 |
| ⑥ `npm run test:legacy` | — | exit 0，`files 33 passed, 0 failed / 33 total; tests 472 passed, 0 failed` |
| BUG tracker parser | `npx vitest run src/types/__tests__/bug-tracker.test.ts` | 12 passed。該測試用內嵌 fixture，所以另以暫存腳本用產品 parser 解析真實檔：`parseBugTracker` 65 筆（FIXED 5 / CLOSED 60，BUG-201 = FIXED）、`parseBugTrackerStats` `source: frontmatter`、`warnings: []`、`parseBugFile(BUG-201)` = FIXED |

- `validated_sha`：②–⑥ 跑在產品變更未 commit 的工作樹上，內容與 `6c2b6b93` 相同（commit 後沒有再改產品檔）。

### 4. BUG-201 與 tracker

- BUG-201：`status: FIXED`、`fixed_at`、`fix_commit: 6c2b6b93…`，表格狀態列、處理紀錄一筆、文末〈T0795 結果〉。
- `_bug-tracker.md`（逐一 Edit）：BUG-201 列從「⏳ 修復中 (FIXING)」移到「✅ 已修復」（備註 `T0795 \`6c2b6b93\`；待 CI Test gate 驗收`），FIXING 區段放回 `_（無）_`；frontmatter `breakdown` FIXING 1→0 / FIXED 4→5、`generated_at`；〈統計〉行；〈最後同步〉加一筆。其他列不動。

### 不回歸

- `npm run deploy:headless:dev` / CLI：預設 staging 路徑、輸出、dry-run / `--yes` / `--rollback` / `--tag` / WSL / dir 行為不變（CLI 不傳選項；WSL 分支只是把同一個值改由區域變數提供）。沒有新增 CLI 旗標或 env。
- 未改 `vite.config.ts`、build 腳本、其他測試檔；沒有 skip / retry。

### 相關通過案例判定

- 工單沒有〈相關通過案例〉節；本單只改開發用部署腳本與其測試，不屬客戶交付功能。

### 遭遇問題

- 無。

### 互動紀錄

- 無（yolo，沒有提問）。

### Commit

- 產品：`6c2b6b93`（只含 `scripts/dev-deploy-headless.mjs`、`scripts/__tests__/dev-deploy-headless.test.mjs`）
- 工單 / BUG / tracker：本次收尾 commit（`git commit --only` 三個檔）
- 未 push、未發版、未改 CHANGELOG。暫存腳本與 log（scratchpad）收尾刪除。
