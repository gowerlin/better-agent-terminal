---
schema_version: 1
schema_kind: workorder
id: T0898
title: "修正 BUG-218（在 `v0.8.x`）：完整 `test:unit` 第一次執行時 headless / RemoteServer e2e 測試檔 `beforeAll` 逾時 —— 查根因並讓整套一次就綠"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-25T01:08:06+08:00"
updated_at: "2026-11-25T01:35:21+08:00"
started_at: "2026-11-25T01:15:28+08:00"
completed_at: "2026-11-25T01:35:21+08:00"
session_ids:
  - "b3b77521-f845-4807-b7a3-d6ab9f3f514e"
target_version: "0.8.0-pre.2"
depends_on: [T0896]
related:
  - "BUG-218；T0891 / T0894 / T0895 回報區；D322（使用者 2026-11-25：「也安排」）；T0686（CI Test gate）；T0508（fake timers 與 socket 測試的注意事項）"
  - "CLAUDE.md「Frontend unit tests」節；`vite.config.ts` `test` 區塊"
affects_files:
  - _ct-workorders/T0898-fix-unit-suite-headless-e2e-hook-timeouts.md
  - electron/remote/__tests__/headless-blocked-state-e2e.test.ts
  - electron/remote/__tests__/headless-close-worker-e2e.test.ts
  - electron/remote/__tests__/headless-helper-narrowing.test.ts
  - electron/remote/__tests__/headless-remote-tower-e2e.test.ts
  - electron/__tests__/local-helper-capability.test.ts
  - electron/__tests__/tower-questions.test.ts
  - electron/remote/__tests__/
  - electron/__tests__/
  - vite.config.ts
  - vitest.setup.ts
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0898（塔台 2026-11-25 01:14 從 `v0.8.x` `7094b993` 建立分支）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0898` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = 本工單〈派工補記〉寫的 `v0.8.x` SHA，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只改測試與測試設定（`affects_files`）；🔴 不改任何產品程式（`electron/**` 非 `__tests__`、`src/**`、`scripts/**`）。根因若在產品程式（例：server 啟動真的變慢、資源沒釋放）→ 停下問塔台，附證據。`vite.config.ts` 只能改 `test` 區塊；改 `vite.config.ts` 後必跑 `npx vite build` 確認產物不變（只動 test 設定）。CLAUDE.md 不改（建議文字寫在回報區）。"
  - "🔴 先查根因再修：① 在全新 `npm ci` 後的 worktree 重現（第一次完整執行）並記錄哪些檔、哪個 hook、耗時；② 量這些檔 `beforeAll` 的實際耗時（單獨跑 vs 全套平行），找出瓶頸（server / PTY 啟動、port、node-pty `AttachConsole failed`、Electron binary 首次下載、CPU 爭用）；③ 修法擇一或組合：針對這些檔的 `hookTimeout`、把它們放進較低平行度的群組（以 repo 實裝的 vitest 版本支援的方式為準，例：檔案層 `describe.sequential`、專案 / pool 分組）、把一次性準備移到 globalSetup、修測試自身的資源清理。🔴 不得用全域大幅拉長 timeout 掩蓋真的掛住；任何 timeout 調整附量測依據。若用 fake timers，遵守 CLAUDE.md T0508 規則（不要 `vi.waitFor` 等 socket / IPC 事件）。"
  - "🔴 驗證：修正後在**全新**狀態（另開一個新 worktree 或清掉 `node_modules` 重新 `npm ci`）連續完整跑 `npm run test:unit` 3 次，每次都要第一次就 exit 0（附 passed / files 數與耗時）；整套耗時不得明顯增加（附修正前後）；`npm run test:legacy` 全綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npx vite build` exit 0。不碰使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）與其 userData / Terminal Server / `bat-pty-holder`。`TMP` 用系統預設（T0716）。程序清理照 D308（只結束本單啟動且可追溯的、一次一個、不 `taskkill /T`）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "🔴 公開 repo（D176）：回報區路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0898 — 修正 BUG-218：完整單元測試第一次執行時 headless e2e 逾時

## 背景

見 `_ct-workorders/BUG-218-unit-suite-headless-e2e-hook-timeouts.md`。2026-11-25 T0891 / T0894 / T0895 三個 worktree 的第一次完整 `npm run test:unit` 都有 4–6 個 RemoteServer / headless e2e 測試檔在 `beforeAll` 10 s 逾時，單獨重跑或第二次完整執行通過。CI 的 Test gate（T0686）一次失敗就擋發版，所以要讓整套一次就綠。

本單等 T0896 合併進 `v0.8.x` 後從新的 `v0.8.x` 開分支，與 T0897 並行；兩張完成後由一張合併工單一起併進 `v0.8.x` 並做 `0.8.0-pre.2` 發版前的最後一次完整驗收（D322）。

## 驗收

- [x] 根因說明（量測證據）
- [x] 全新狀態連續 3 次完整 `test:unit` 第一次就綠；整套耗時沒有明顯增加
- [x] 沒有改產品程式；`test:legacy` 全綠、兩個 typecheck = 0、`vite build` exit 0
- [x] 隔離分支證據


## 派工補記

- 2026-11-25T01:14:52+08:00：T0896 已合併進 `v0.8.x`；`ct/T0898` 從 `v0.8.x` = `7094b993b67313db8f3c6b058a33f483896ec5b4` 建立。`memory_overrides` 第 1 條的 merge-base 檢查值 = `7094b993b67313db8f3c6b058a33f483896ec5b4`。
---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（驗收 4 項全部通過）
- **session_id**：b3b77521-f845-4807-b7a3-d6ab9f3f514e
- **產品 commit**：`98bd9e965cd5b1b15a4f6572eb1a7faf0e6bacde`（`ct/T0898`，只動測試與 `vite.config.ts` 的 `test` 區塊）

### 產出摘要

**根因（量測證據）**：不是 server / PTY 啟動慢，而是 Electron binary 第一次下載。

1. 重現：全新 `npm ci` 後 `node_modules/electron/` 沒有 `path.txt` / `dist/`（Electron 42+ 沒有 postinstall，T0784）。第一次完整 `npx vitest run`：exit 1、48 s，6 檔失敗 —— BUG-218 列的 5 檔 `beforeAll` `Hook timed out in 10000ms`（`local-helper-capability`、`headless-blocked-state-e2e`、`headless-close-worker-e2e`、`headless-helper-narrowing`、`headless-remote-tower-e2e`），另 `helper-connection-hygiene` 一個測試 `Test timed out in 5000ms`。
2. 同一次執行的 log 有 11 行 `Downloading Electron binary...`，出現在 11 個測試檔；失敗的 6 檔**全部**在這 11 檔內（另 5 檔 `remote-connect-plan`、`terminal-query-handlers`、`terminal-blocked-state`、`tower-questions`、`remote-connection-registry` 剛好沒超時；`tower-questions` 在 BUG-218 的其他 worktree 有失敗過）。
3. 機制：`node_modules/electron/index.js` 在 binary 不存在時以 `spawnSync(process.execPath, [install.js])` **同步**下載解壓，阻塞該 worker 的事件迴圈。這些檔載入的產品模組會在執行期 `require('electron')`（未 mock）：`electron/remote/remote-server.ts` `resolveBundleVersion`、`electron/remote/secrets.ts` `tryLoadElectronSafeStorage`（都有 try/catch，產品行為正確；在 bat-server 打包裡沒有 `electron` 套件就直接走 fallback）。
4. 耗時：單獨一次 `node node_modules/electron/install.js` = 2.3 s（zip 已在 electron cache）；**11 個同時**跑（無其他測試負載）每個 22.6–25.5 s，超過 10 s hook 上限。多個同時解壓到同一個 `dist/` 也解釋了 T0891 看到的 os error 80。
5. 對照：binary 已在時（第二次完整執行）這些檔都通過；暫時在 `headless-harness.ts` 量 `startHeadlessHarness`（建立 server → start → 第一個 client 連上）在全套平行下 52 次：最小 19 ms、中位 87 ms、最大 273 ms（量完已移除，未提交）。⇒ 10 s hook 本身足夠，不需要調 timeout。
6. `AttachConsole failed`：來自 `@lydell/node-pty` 的 `conpty_console_list_agent.js`（PTY 結束時列 console 程序），修正後全綠的執行中照樣出現，與失敗無關。

**修法**（memory_overrides 第 3 條的「一次性準備移到 globalSetup」）：

- 新增 `electron/__tests__/helpers/electron-binary-global-setup.ts`，在 `vite.config.ts` `test.globalSetup` 註冊：所有 worker 開始前，條件與 `electron/index.js` 判斷「要下載」**完全一致**（`ELECTRON_OVERRIDE_DIST_PATH` 未設，且 `path.txt` 不存在 / 空 / `dist/<執行檔>` 不存在）時，單一行程跑一次 `install.js`（`spawnSync` 陣列參數、10 分鐘 timeout）；binary 已在（CI 有自己的 install step、或第二次執行）只讀兩個路徑。下載失敗只印警告、照舊跑（行為與修正前相同，不新增失敗）。
- `electron/__tests__/electron-binary-global-setup.test.ts`：判斷函式 6 個案例（含 `ELECTRON_OVERRIDE_DIST_PATH`）。
- 沒有調任何 timeout、沒有改平行度。

**另一個一次就綠的阻礙（不同根因，同單一併修）**：`electron/__tests__/bat-mcp-codex-env.test.ts` 的 `afterEach` `rmSync` 偶發 `EPERM`（第二次完整執行出現；4 個平行執行第一輪 4/4 重現）。探測（scratchpad 腳本）結果：內嵌 codex 0.172.0 的 `app-server` 啟動時另起 `git ls-remote https://github.com/openai/plugins.git HEAD`（curated plugin 同步），測試的假 MCP server 的 cwd = 測試的 `CODEX_HOME`；codex 被 `kill()` 後這個 git 還在跑，暫存目錄單獨執行時仍被佔 0.8–7.7 s，網路慢或負載高時超過 rmSync 的 21 s 重試。修法：該測試的 codex 參數加 `-c features.plugins=false`，探測 3/3 不再起 git、目錄立即可刪；修正後 4 平行 × 2 輪 8/8 通過。測試要驗的 MCP `env_vars` 轉送不受影響（假 MCP server 照樣啟動並記錄 env），也讓單元測試不再連 GitHub。

**驗證**（全部在 `98bd9e96` 上）：

| 項目 | 結果 |
|---|---|
| 全新狀態（`rm -rf node_modules` → `npm ci`，執行前確認 Electron binary 不存在）× 3，每次第一次完整 `npm run test:unit` | #1 exit 0：464 passed / 3 skipped（467 檔），8495 passed / 42 skipped，66.07 s；#2 exit 0：同數字，63.96 s；#3 exit 0：同數字，65.77 s。三次都印 `[T0898] Electron binary ready (2991 / 2766 / 3127 ms)`，0 行 `Downloading Electron binary...` |
| 整套耗時（binary 已在、可比） | 修正前 57.19 s / 57.63 s → 修正後 57.76 s（沒有增加）。全新狀態多約 3 s（globalSetup 依序下載一次）加冷快取；修正前全新狀態的 48 s 是失敗提前結束的數字，不可直接比 |
| `npm run test:legacy` | exit 0：files 33 passed / 33，tests 472 passed、0 failed |
| `npm run typecheck` / `npm run typecheck:electron` | 0 / 0 |
| `npx vite build` | exit 0；另以 base 的 `vite.config.ts`（`git show HEAD:`，暫存檔用完即刪）與新設定各 build 一次，`dist/` + `dist-electron/` 97 檔 sha256 全部相同 |
| 沒有改產品程式 | `git diff 7094b993..98bd9e96 --stat` 只有 4 檔：`vite.config.ts`（只加 `test.globalSetup` 一行與註解）、`electron/__tests__/bat-mcp-codex-env.test.ts`、兩個新測試檔 |

**變更檔案**（worktree `ct/T0898`）：

- `vite.config.ts`（`test.globalSetup`）
- `electron/__tests__/helpers/electron-binary-global-setup.ts`（新）
- `electron/__tests__/electron-binary-global-setup.test.ts`（新）
- `electron/__tests__/bat-mcp-codex-env.test.ts`

**給塔台的建議（未改 CLAUDE.md）**：CLAUDE.md「Frontend unit tests」節可加一句：「`test.globalSetup`（`electron/__tests__/helpers/electron-binary-global-setup.ts`，T0898 / BUG-218）在 worker 開始前補齊 Electron binary：Electron 42+ 的 `index.js` 在第一次 `require('electron')` 時同步下載，多個 worker 同時下載會讓 RemoteServer / headless e2e 的 `beforeAll` 逾時。🔴 測試若起 codex `app-server`，加 `-c features.plugins=false`（否則留下 `git ls-remote` 佔住暫存 `CODEX_HOME`）。」`tests.yml` 的 install.js step 保留即可（globalSetup 在 CI 變成 no-op）。

### 互動紀錄
- [01:15] 開工：落點 C-0 PASS（`repo` = `better-agent-terminal` = `basename "$CT_HOME"`）、C-1 PASS、C-3 PASS（`affects_files` 都存在）；`CT_HOME` / `CT_WORKTREE_BRANCH` = `ct/T0898`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；merge-base(HEAD, `v0.8.x`) = `7094b993b67313db8f3c6b058a33f483896ec5b4` = 派工補記值。
- [01:21] 判斷 `bat-mcp-codex-env` 的 `EPERM` 屬「讓整套一次就綠」的範圍（`electron/__tests__/` 在 `affects_files`，只改測試，且會擋 3 次驗收），自行修正並在回報區分開標示，未問塔台。

### Renew 歷程
無

### 遭遇問題
- 修正前第二次完整執行另有 `bat-mcp-codex-env` `EPERM`（見產出摘要，已修）。
- 驗收期間 `%TEMP%` 出現一個 `t0586-codex-env-*`（01:34:53），當時本單沒有在跑 vitest，應來自並行的其他 worktree（舊版測試），不是本單產生的，依 D308 未動。
- `CT_WORKTREE_BASE`（`06c3b884…`）與 `v0.8.x` 的 merge-base 不同，屬工單預期（BAT 印的是與 main 的共同祖先）；以 merge-base 檢查值為準。
- 沒有使用 `git stash` / `reset` / `restore`；沒有碰安裝版 BAT、其 userData、Terminal Server 或 `bat-pty-holder`；本單啟動的探測程序（codex、git ls-remote）都已自行結束，沒有 `taskkill`。

### 隔離分支證據
- branch：`ct/T0898`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`）；分支起點 = `v0.8.x` `7094b993b67313db8f3c6b058a33f483896ec5b4`
- validated_sha：`98bd9e965cd5b1b15a4f6572eb1a7faf0e6bacde`
- head_sha：`98bd9e965cd5b1b15a4f6572eb1a7faf0e6bacde`
- validated_sha ≠ head_sha 的說明：相同，不適用
- `git -C "$CT_WORKTREE" status --porcelain`：空

### 回報時間
- 2026-11-25T01:35:21+08:00
