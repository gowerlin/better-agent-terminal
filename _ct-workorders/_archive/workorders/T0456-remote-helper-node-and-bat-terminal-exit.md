---
schema_version: 1
schema_kind: workorder
id: T0456
title: "遠端 helper 可用性收尾：headless PTY PATH 尾端附加 <installRoot>/bin + BAT_HELPER_NODE；bat-terminal.mjs 對 server 回 false（未建立）改 exit 1"
type: fix
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T07:07:03+08:00"
started_at: "2026-10-05T07:08:34+08:00"
updated_at: "2026-10-05T07:15:34+08:00"
completed_at: "2026-10-05T07:15:34+08:00"
target_version: next
depends_on:
  - T0434
related:
  - "T0434（`aeac517`）回報區「遭遇問題」2 / 3；WSL smoke S10 `node=missing`"
  - "D134 追加（塔台 07:07 依授權直接決定）"
affects_files:
  - electron/remote/headless-entry.ts
  - scripts/bat-terminal.mjs
  - electron/remote/__tests__/
  - scripts/__tests__/
  - tests/
  - CLAUDE.md
  - docs/remote-dev-overview.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 (1) `buildHeadlessHelperEnv` 有注入 helper env 時：PTY 的 `PATH` **尾端**附加 `<installRoot>/bin`（使用者自己的 node 仍優先；不得 prepend），並注入 `BAT_HELPER_NODE=<installRoot>/bin/node`（存在才注入）。無 helper env 時不動 PATH。`isHeadlessScrubbedEnvKey` 規則不變（`BAT_HELPER_NODE` 為顯式注入）。測試：PATH 尾端、key 集合（同步更新 T0434 S13 的 `REMOTE_TOWER_ENV_KEYS` drift 守門與 CLAUDE.md / docs 的 env 表）。"
  - "🔴 (2) `scripts/bat-terminal.mjs`：invoke 結果為 `false`（未建立）時印錯誤並 **exit 1**（不再印 `✓ Terminal created`）；`true` 照舊 exit 0、`{ ok:false }` 物件路徑（T0433）不變。這會影響本機路徑——先 grep 本機 `terminal:create-*` handler 何時回 false，回報區列出情境；塔台 auto-session 只信任 exit code（不讀 stdout），改為 exit 1 與之一致。"
  - "🔴 T0455 平行改 `remote-server.ts`（本單不碰）；T0454 平行改 `scripts/__tests__/`（不同測試檔即可，共用檔精準 stage）。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；不得以 `git show HEAD:… >` 覆寫取紅燈）；寫檔維持 LF（勿用文字模式 Python 寫出 CRLF，T0434 遭遇問題 5）；不 push；不部署 WSL。"
---

# T0456 — 遠端 helper node 與 bat-terminal exit code

## 驗收條件

- [x] 測試：helper env 注入時 PATH 以 `<installRoot>/bin` 結尾、`BAT_HELPER_NODE` 正確；無 helper env 時 PATH 不變；bat-terminal `false` → exit 1
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0434 / T0433 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — 兩項修正與測試完成；`npm run test:unit` 全綠、`npx tsc --noEmit` = 36（≤ 36）。

**Landing check：PASS** — C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS（工單在 REPO_ROOT 下）；C-3 informational（`electron/remote/headless-entry.ts` / `scripts/bat-terminal.mjs` 皆存在）；C-2 無 `branch` 欄位（HEAD = `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。派發 env：`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 產出摘要

**(1) headless PTY 的 bundle node**（`electron/remote/headless-entry.ts`）
- `buildHeadlessHelperEnv` 有注入 helper env 時，另回傳：
  - `PATH` = 該 PTY 原本會拿到的 PATH（`customEnv` 優先於繼承 env，與 PtyManager 合併順序一致）**尾端附加** `<installRoot>/bin`（`path.dirname(helperDir)/bin`）；已在 PATH 內則不重複；沿用 env 既有的鍵名（Windows `Path`）。不 prepend，使用者自己的 node 仍優先。
  - `BAT_HELPER_NODE=<installRoot>/bin/node`，僅在該檔存在時注入（server bundle 一律帶 `bin/node`，見 `scripts/build-server-bundle.mjs` `nodeBinarySubpath`）。
- 無 helper env（無 endpoint / 無 helperDir / helpers 缺 / id 被拒）時回 `{}`，PATH 不動。
- 新增可選參數 `inheritedEnv`（預設 `process.env`）、`pathDelimiter`（預設 `path.delimiter`）供測試。`isHeadlessScrubbedEnvKey` 不變（`BAT_HELPER_NODE` 為顯式注入，spread 在最後）。

**(2) `scripts/bat-terminal.mjs`**：invoke 結果 `=== false` → 印 `Error: Failed to create terminal: <id> was not created (server answered false — see the BAT app log)`、log `terminal-created result=false` + `exit reason=terminal-not-created`、**exit 1**（不再印 `✓ Terminal created`）。`true` 照舊 exit 0；`{ ok:false }`（T0433）路徑不變；沒有 `result` 欄位（`undefined`）仍視為成功（既有 mock / 舊 server 相容）。

**本機 `terminal:create-*` 回 `false` 的情境**（`electron/terminal-command-handlers.ts` + `electron/pty-manager.ts`，本機 Electron 與 headless 共用）：
| channel | 情境 | 位置 |
|---|---|---|
| `create-with-command` | 無 PtyManager（`no-pty-manager`） | `terminal-command-handlers.ts:181-189` |
| `create-with-command` | `shell` 被拒（`invalid-shell`；只有 `validateShell` 開啟時，即 headless） | `:191-200` |
| `create-with-command` | `PtyManager.create` node-pty 與 child_process fallback 皆 spawn 失敗 | `pty-manager.ts:867-873` |
| `create-agent-command` | prompt 與 skill+workorder 皆未給 / 同時給 | `terminal-command-handlers.ts:267-276` |
| `create-agent-command` | `buildAgentPromptCommand` 回 null（該 agent 組不出啟動命令、prompt payload 不合法） | `:290`（builder `:443-452`） |
| `create-agent-command` | 轉呼 `create-with-command` 的上列 false | `:358-361` |

PtyManager 對既有 id 一律回 `true`（idempotent），`PtyLimitError` 是 throw（→ `invokeResp.error`，原本就 exit 1）。以上情境過去都會印 `✓ Terminal created` 並 exit 0，塔台誤判已派出；改 exit 1 與塔台只信 exit code 一致。

**測試**
- `electron/remote/__tests__/headless-helper-env.test.ts`：新增 `bundle node (T0456)` 5 案（PATH 以 `<installRoot>/bin` 結尾且不在開頭、`BAT_HELPER_NODE` 存在才注入、customEnv PATH 優先、Windows `Path` 鍵名與不重複、無 helper env ⇒ `{}`）；既有「exactly the helper keys」更新為含 `BAT_HELPER_NODE` / `PATH`；wire 測試加「PTY 實際 PATH 含 `<repo>/bin`」（repo 無 `bin/node`，故 wire 的 `BAT_*` 集合不變）。
- `tests/bat-terminal-workorder-id.test.mjs`：mock 加 `invokeReply` 參數；新增 3 案（`false` → exit 1 且無 `Terminal created`、`true` → exit 0、`{ ok:false, code:'AGENT_UNAVAILABLE' }` → exit 1）。
- S13 drift 守門（`scripts/smoke-remote-headless.mjs` / `scripts/__tests__/smoke-remote-headless.test.mjs`）：`REMOTE_TOWER_ENV_KEYS` 加 `BAT_HELPER_NODE`；drift 測試只比 `BAT_*` 鍵並斷言非 `BAT_*` 僅 `PATH`（顯式傳 `inheritedEnv`，避開跑測機 `Path` 鍵名）；`checkHelperEnvAnswer` 只缺 `BAT_HELPER_NODE` 時附「server predates T0456 … redeploy」提示（仍判 FAIL）；`checkHelperProbeAnswers` 註解更新（`false` 現為 exit 1，原 `Failed to create terminal` 分支已涵蓋）。
- 文件：`CLAUDE.md`「遠端 Tower 通知」env 清單 / node 寫法 / 新增 bat-terminal exit 1 情境；`docs/remote-dev-overview.md` env 表加 `BAT_HELPER_NODE` / `PATH`、範例改 `"${BAT_HELPER_NODE:-node}"`、Limits 加 exit code 說明。

**驗證**
- `npx vitest run` 三個目標檔：124 passed。
- `npm run test:unit`：158 files passed，2521 passed / 1 skipped（stderr 有 node-pty `conpty_console_list_agent` `AttachConsole failed` 雜訊，既有、不影響結果）。
- `npx tsc --noEmit`：36 個 error（門檻 ≤ 36），本單觸及檔案 0 個。
- 未跑 `npx vite build` / `npm run test:e2e`（依工單 L141）；未部署 WSL、未 push。

**Commit**：本單改動檔 + 本工單以精準路徑 commit（hash 見 `git log --grep T0456`）。

### 遭遇問題

1. **S13 對 T0456 前部署的 server 會 FAIL**（非 SKIP）：`REMOTE_TOWER_ENV_KEYS` 已含 `BAT_HELPER_NODE`，舊 server 回報 `missing BAT_HELPER_NODE (server predates T0456, or <installRoot>/bin/node is missing — redeploy)`。需在 WSL 重新 `npm run deploy:headless:dev` 後再跑 S13（塔台 8464f7d 已記「WSL deploy authorized after T0456」）。S13 自身的 bat-terminal probe 仍用 `"$BAT_HELPER_DIR/../bin/node"`，對新舊 server 都可用，未改。
2. **PATH 附加可能被 login shell 覆寫**：headless PTY 以 `-l -i` 啟動，Debian 系 `/etc/profile` 會整個重設 `PATH`，屆時尾端的 `<installRoot>/bin` 消失；`BAT_HELPER_NODE` 不受影響，因此文件與 CLAUDE.md 都以 `"${BAT_HELPER_NODE:-node}"` 為建議寫法。control-tower skill / `_local-rules.md` 內遠端派單範例若仍寫 `"$BAT_HELPER_DIR/../bin/node"`，可另案改用 `BAT_HELPER_NODE`（本單範圍外，未改）。
3. 經 Bash heredoc 跑 Python 寫測試時，反斜線跳脫被多吃一層（Windows 路徑字面值少一個反斜線、`user` 後的跳脫單引號變裸引號導致 esbuild parse error），已改用 Edit 修正；檔案維持 LF（`bat-terminal.mjs` 工作區為 autocrlf 的 CRLF，index 為 LF，diff 僅新增 10 行）。

### 回報時間

"2026-10-05T07:15:34+08:00"（started_at "2026-10-05T07:08:34+08:00"）
