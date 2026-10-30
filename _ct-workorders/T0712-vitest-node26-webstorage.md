---
schema_version: 1
schema_kind: workorder
id: T0712
title: "單元測試相容 Node 26：Node 內建的全域 `localStorage` 蓋掉 jsdom 的，`copy-remote-path.test.tsx` 失敗"
type: implementation
status: DONE
repo: better-agent-terminal
project: ""
priority: P3
sizing: S
created_at: "2026-10-30T13:57:15+0800"
started_at: "2026-10-30T13:58:26+0800"
updated_at: "2026-10-30T14:03:21+0800"
completed_at: "2026-10-30T14:03:21+0800"
depends_on: []
related:
  - "T0710 回報區〈驗證〉與〈遭遇問題〉：本機 Node v26.13.0 跑 `npm run test:unit`，`src/__tests__/copy-remote-path.test.tsx` 2 項失敗（`FileTree.tsx:234` 的 `localStorage.getItem` 讀到 undefined；Node 警告 `--localstorage-file was not provided`）；`NODE_OPTIONS=--no-webstorage` 後全套 343 檔 / 6115 passed"
  - "CI `.github/workflows/tests.yml` 用 `node-version: '24'`"
  - "CLAUDE.md「Frontend unit tests」節"
affects_files:
  - vitest.setup.ts
  - "vite.config.ts（只動 `test` 區塊）"
  - "package.json（只在必須改 test script 時；不得改 dependencies）"
  - "scripts/run-legacy-tests.mjs（只在 `test:legacy` 也受影響時）"
  - "受影響的測試檔（只在修正方式必須動到它們時）"
  - CLAUDE.md
  - _ct-workorders/T0712-vitest-node26-webstorage.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 目標：本機 Node 26 與 CI 的 Node 24 跑 `npm run test:unit` 都全綠，不需要使用者自己設 `NODE_OPTIONS`。先確認根因（Node 26 的全域 `localStorage` 與 jsdom 的 `window.localStorage` 哪個被測試讀到、為何 `getItem` 是 undefined），回報區寫明。"
  - "🔴 🔴 不得讓 Node 24 壞掉：Node 24 可能不認得 `--no-webstorage`，未知旗標會讓 Node 直接結束 → CI Test gate 全紅、擋發版。若用執行旗標，必須依 Node 版本或 `process.allowedNodeEnvironmentFlags` 決定是否加；較建議在 `vitest.setup.ts` 讓測試一律拿到 jsdom 的 storage（或等效作法），與 Node 版本無關。方案自行決定，回報區說明理由。"
  - "🔴 不改產品程式碼（`src/**` 非測試檔、`electron/**`）；不改 Node / npm 版本要求、不加 `engines`；不新增依賴。"
  - "🔴 驗證：本機 Node 26 跑 `npm run test:unit` 全綠（不帶 NODE_OPTIONS）；再用 Node 24 跑一次全綠（本機有 Node 24 就直接跑；沒有就用 `npx -y node@24 …` 或等效方式，做不到就寫明並至少證明設定在 Node 24 不會因未知旗標失敗）。`npm run test:legacy` 在 Node 26 跑一次，結果寫回報區（若失敗且與 webstorage 無關，只記錄不修）。`npm run typecheck` = 0。"
  - "🔴 文件：CLAUDE.md「Frontend unit tests」節加一行（Node 26 webstorage 的處理與位置）；`##` 標題不改名。"
  - "🔴 範圍：不改 `electron/ct-install-detect.ts`、`electron/handlers/ct-config.ts`、`src/types/ct-config-sources.ts`、`src/components/TowerOverview.tsx`、locales、`docs/agent-guide/ct-*.md`（T0711 同時在改）。"
  - "🔴 Git：`git commit --only <檔案>`，只 commit 本單 `affects_files`；不 push、不觸發 workflow、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。工單完成狀態寫 `DONE`。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。yolo：不得問使用者，判讀問題問塔台（每輪最多 3 題）。"
---

# T0712 — 單元測試相容 Node 26

## 背景

開發機 Node 已是 v26.13.0（CI 為 24）。Node 26 內建的全域 `localStorage` 讓 jsdom 測試讀到沒有 `getItem` 的物件，`copy-remote-path.test.tsx` 2 項失敗；加 `NODE_OPTIONS=--no-webstorage` 後全過。本單讓兩個 Node 版本都不需手動設定就全綠。

## 驗收

- [x] 根因寫在回報區
- [x] Node 26 不帶 `NODE_OPTIONS` 跑 `npm run test:unit` 全綠
- [x] Node 24 仍全綠（或至少證明不會因未知旗標失敗）
- [x] `npm run test:legacy`（Node 26）結果記錄在回報區
- [x] 不改產品程式碼、不加依賴
- [x] CLAUDE.md「Frontend unit tests」節補一行
- [x] `npm run typecheck` = 0

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

DONE

### 產出摘要

**根因**（實測，vitest 4.1.5 / jsdom 環境）：

- Node 26 在 `globalThis` 上定義了 `localStorage` / `sessionStorage`：可設定的 getter（`configurable: true`、`enumerable: false`），沒給 `--localstorage-file` 時回 `undefined` 並印 `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.`（`node -e` 實測 `typeof localStorage` = `undefined`）。測試讀到的是 **Node 的全域 `localStorage`，值為 `undefined`**，不是「沒有 `getItem` 的物件」（錯誤訊息是 `Cannot read properties of undefined (reading 'getItem')`）。
- vitest 的 jsdom 環境以 `populateGlobal` 把 jsdom window 的屬性搬到 global；`getWindowKeys` 對「global 已有的 key」只保留列在 vitest 內建 `KEYS` 清單的（`node_modules/vitest/dist/chunks/index.DC7d2Pf8.js` `getWindowKeys`）。`KEYS` 只有 `Storage` / `StorageEvent`，沒有 `localStorage` / `sessionStorage` ⇒ Node 26 上這兩個 key 被跳過，global 保留 Node 的 getter。之後 `global.window = global`，所以 `window.localStorage` 也是 `undefined`。
- Node 24.22.1：`'localStorage' in globalThis` = `false` ⇒ vitest 照常搬 jsdom 的 storage，所以 CI 不會壞。

**修正**（`vitest.setup.ts`）：jsdom 環境（vitest 提供 `globalThis.jsdom`）下，把 `globalThis.localStorage` / `sessionStorage` 以 `Object.defineProperty`（`value` = jsdom window 的 storage，`configurable` / `writable`）重新定義；node 環境的測試檔沒有 `jsdom` 全域，不動。

**方案理由**：

- 與 Node 版本無關、不需要執行旗標。Node 24 上 vitest 本來就把同一個 jsdom storage 物件放在 global，改成直接值是等效的（全套 343 檔在 Node 24 仍全過）。
- 無條件定義：若先讀 `globalThis.localStorage` 比較，Node 26 的 getter 會印 ExperimentalWarning；Node 26 全套 log 中 `localstorage-file` 出現 0 次。
- 不採用 `--no-webstorage`：實測 Node 24.22.1 `process.allowedNodeEnvironmentFlags.has('--no-webstorage')` = `false`，`NODE_OPTIONS=--no-webstorage node -e …` → `node.exe: --no-webstorage is not allowed in NODE_OPTIONS`，**exit 9** —— 放進 test script 或 CI env 會讓 Test gate 全紅。
- 沒有測試檔直接讀寫 storage（Grep `__tests__/**`、`*.test.*` 無 `localStorage` / `sessionStorage`），受影響的是 render 產品元件（如 `FileTree.tsx:234`）的測試；不需要改測試檔、`vite.config.ts`、`package.json`、`scripts/run-legacy-tests.mjs`（`test:legacy` 不受影響，見驗證）。

**變更檔案**：

- `vitest.setup.ts`：+15 行（上述重定義與註解）
- `CLAUDE.md`「Frontend unit tests」節：+1 行（Node 25+ webstorage 的處理、位置，與不得改用 `--no-webstorage` 的原因）；`##` 標題未改

**驗證**：

| 項目 | 環境 | 結果 |
|---|---|---|
| `src/__tests__/copy-remote-path.test.tsx`（修正前） | Node v26.13.0 | 7 項 2 failed（`TypeError: Cannot read properties of undefined (reading 'getItem')`，`FileTree.tsx:234:32`）—— 重現 |
| 同上（修正後） | Node v26.13.0 | 7 passed |
| `npm run test:unit`（`NODE_OPTIONS` 未設） | Node v26.13.0 | **PASS**：Test Files 343 passed (343)、Tests 6115 passed / 3 skipped；log 無 `localstorage-file` 警告 |
| `vitest run`（以 nvm 已安裝的 v24.22.1 執行，PATH 前置 v24 讓子程序也用 24） | Node v24.22.1 | **PASS**：343 passed (343)、6115 passed / 3 skipped |
| `npm run test:legacy` | Node v26.13.0 | **PASS**：files 33 passed, 0 failed / 33；tests 472 passed, 0 failed（not run 11，皆為腳本 `EXCLUDED` 既有項目） |
| `npm run typecheck` | 主 checkout | exit 2，唯一錯誤 `src/lib/__tests__/ct-tower-overview.test.ts(3,3): TS6133 'dualInstallNotices'` —— 該檔是 T0711 同時在改、**尚未 commit** 的變更（HEAD 版本不含 `dualInstallNotices`），非本單 |
| `npm run typecheck`（HEAD `8aa47499` + 本單 `vitest.setup.ts`，暫時 `git worktree add --detach` 於 scratchpad、`node_modules` junction，跑完已 `git worktree remove`） | — | **= 0**（`vitest.setup.ts` 在 `tsconfig.json` 的 `include` 內，所以本單變更有被型別檢查涵蓋） |
| `npm run typecheck:electron` | 主 checkout | = 0 |

說明：兩次全套 `test:unit` 與 `test:legacy` 跑在主 checkout，當時工作樹含 T0711 未 commit 的變更（`electron/ct-install-detect.ts` 等），結果仍全綠。log 中的 `@lydell/node-pty\conpty_console_list_agent.js` `AttachConsole failed` 堆疊是既有的子程序輸出，與本單無關、不影響結果。

**commit**：`2bbc11db183bd54e453d95521cba3f0aabd9230e`（`test: point jsdom tests at jsdom's localStorage / sessionStorage on Node 25+ (T0712)`，`git commit --only vitest.setup.ts CLAUDE.md`）。未 push、未觸發 workflow、未建 tag。

**落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 PASS（`vitest.setup.ts`、`CLAUDE.md` 存在）；`CT_HOME` 未設（非 worktree 派工）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

**範圍**：未改產品程式碼（`src/**` 非測試檔、`electron/**`）、未加依賴、未改 Node / npm 版本要求；未碰 T0711 的檔案。

### 互動紀錄

無（沒有向塔台提問）。

### Renew 歷程

無。

### 遭遇問題

- `npm run typecheck` 在主 checkout 因 T0711 未 commit 的 `src/lib/__tests__/ct-tower-overview.test.ts` 未使用 import 而 exit 2；本單以 HEAD + 本單變更的暫時 worktree 取得 = 0 的證據。T0711 commit 前請其 Worker／塔台確認該檔 typecheck。

### 回報時間

2026-10-30T14:03:21+0800
