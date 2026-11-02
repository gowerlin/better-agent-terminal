---
schema_version: 1
schema_kind: workorder
id: T0795
title: "BUG-201：`dev-deploy-headless.test.mjs` 的 `main()` 測試改用每次執行獨立的輸出 / staging 目錄，兩個 `test:unit` 同時跑時不再互相覆蓋"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-03T00:03:22+0800"
updated_at: "2026-11-03T00:03:22+0800"
session_ids: []
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
