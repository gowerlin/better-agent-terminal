---
schema_version: 1
schema_kind: workorder
id: T0369
title: "BUG-083 T-B：@openai/codex-sdk 0.124 → 0.160 + 內嵌 binary 解析相容新目錄結構"
type: fix
status: DONE
priority: P1
sizing: M
created_at: "2026-10-04T15:59:25+08:00"
updated_at: "2026-10-04T16:05:59+08:00"
started_at: "2026-10-04T16:00:35+08:00"
completed_at: "2026-10-04T16:05:59+08:00"
target_version: next
depends_on:
  - T0367
related:
  - "BUG-083"
  - "T0366（research `aa970dc`；回報區「Q3 升到 0.160 的影響範圍」為本單規格依據，請先讀）"
  - "D121（排序：本單為第 2 張）"
  - "T0367（`c6214c2`，已改 `codex-agent-manager.ts` 的 error 分支——本單在其之上繼續改）"
affects_files:
  - package.json
  - package-lock.json
  - electron/codex-agent-manager.ts
  - electron/codex-bundled-path.ts
  - electron/__tests__/codex-bundled-path.test.ts
  - CHANGELOG.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不能只 bump**：0.160 平台套件改為 `vendor/<triple>/bin/codex(.exe)`，BAT 的 `findBundledCodex()`（`codex-agent-manager.ts:135-152`）寫死 `vendor/<triple>/codex/<exe>`，只 bump 會讓內嵌 binary 找不到。解析邏輯必須同 commit 改好。"
  - "🔴 **只動 codex 套件**：不得連帶升級 `@anthropic-ai/*` 或其他依賴（T0368 正在研究 Claude SDK 升級，且讀取主工作樹 `node_modules/@anthropic-ai/*` 做比對）。用 `npm install @openai/codex-sdk@<ver> --save-exact=false` 這類精準指令，完成後 `git diff package-lock.json` 確認只有 `@openai/*` 相關變動。"
  - "🔴 不改 `findCodexBinary()` 的候選優先序（PATH 優先），也不改 `CODEX_MODELS` / effort 清單——分別是 T-C / T-D 的範圍（D121）。"
  - "🔴 不碰 `~/.codex/`；smoke 一律以 scratchpad 的空 `CODEX_HOME` 執行（**不要複製 auth**）。不 push、不 bump BAT 版號。"
---

# T0369 — BUG-083 T-B：Codex SDK 0.124 → 0.160 + 內嵌 binary 解析相容新目錄

- **狀態**：DONE
- **任務類型**：fix（依賴升級 + 相容層）
- **工作量預估**：M
- **Context Window 風險**：中

## 背景

BUG-083 根因之一是內嵌 Codex 0.124 過舊（T0366 H1/H3）。T0366 已盤點 0.160 的變化（請讀其回報區「Q3」表）：

- `index.d.ts`、事件型別、CLI argv：**無 breaking**（純增量）
- 🔴 **平台套件目錄結構改變**：`vendor/<triple>/bin/codex(.exe)` + `codex-package.json` + `codex-path/`（含 `rg.exe`）+ `codex-resources/`。SDK 自身的 `resolveNativePackage()` 同時支援新舊
- PATH helper：SDK 0.160 只在**未傳 `codexPathOverride`** 時把 `codex-path/` prepend 到子行程 PATH；BAT 一律傳 override ⇒ 需自行 prepend
- 體積：win32-x64 unpackedSize 約 223 → 451 MB（目前 repo `node_modules/@openai/codex-win32-x64` 實測 213 MB）

## 範圍

### Part A — 升級依賴

- `@openai/codex-sdk` → 最新 0.160.x（`npm view @openai/codex-sdk version` 當下值），`package.json` range 改為 `^0.160.x`
- 確認 `@openai/codex` 與本機平台套件 `@openai/codex-win32-x64` 隨之為同版本
- `package-lock.json` 僅 `@openai/*` 相關變動（memory_overrides）

### Part B — 內嵌 binary 解析抽出並相容新舊目錄

1. 把 `findBundledCodex()` 的「給定平台套件根目錄 → binary 路徑」邏輯抽成可測試的純函式，放 `electron/codex-bundled-path.ts`，例如：

   ```ts
   export function resolveBundledCodexLayout(pkgRoot: string, triple: string, exe: string, exists: (p: string) => boolean):
     { binary: string; pathDirs: string[] } | undefined
   ```

   - 先試新結構 `vendor/<triple>/bin/<exe>`，再試舊結構 `vendor/<triple>/codex/<exe>`
   - 新結構時 `pathDirs` 回傳存在的 `vendor/<triple>/codex-path`（實際位置請以 0.160 套件實際目錄為準，**讀 SDK 0.160 `dist/index.js` 的 `resolveNativePackage()` 對照**，不要憑本工單描述推測）
   - `app.asar` → `app.asar.unpacked` 的轉換保留在呼叫端（`findBundledCodex()`）
2. `codex-agent-manager.ts` 的 `findBundledCodex()` 改呼叫此函式；當選到的是**內嵌 binary** 時，把 `pathDirs` prepend 到傳給 SDK 的子行程環境 PATH（用 SDK 0.160 `CodexOptions` 實際提供的 env 機制；請讀 `index.d.ts` 確認欄位名）。選到 PATH / `BAT_CODEX_BIN` 的 binary 時行為不變
3. 若 SDK 0.160 支援 config override（T0366 提到 `CodexOptions.configOverrides` / `config`），帶上 `check_for_update_on_startup=false`（T0366 Q4：成本近零的保險）；不支援就略過並在回報區說明

### Part C — 測試與 CHANGELOG

- `electron/__tests__/codex-bundled-path.test.ts`：以 tmp 目錄（或 fake `exists`）覆蓋：新結構、舊結構、兩者皆無 → `undefined`、新結構有/無 `codex-path`；確認 vitest 設定會收到 `electron/__tests__/`，**若不會被收到**，改放 `src/lib/__tests__/` 並把純函式放 `src/lib/`（同步修正 affects_files 於回報區說明）
- `CHANGELOG.md` `## [Unreleased]`：`### Changed` 一筆（refs: BUG-083, T0369）

## 明確排除（不要做）

- ❌ 不升級 `@openai/*` 以外的依賴
- ❌ 不改 `findCodexBinary()` 優先序、`CODEX_MODELS`、effort 清單、`CodexAgentPanel.tsx`
- ❌ 不改 `package.json` 的 `build.asarUnpack`（`node_modules/@openai/codex-*/**/*` 已涵蓋新目錄；若實測發現不涵蓋，**停下回報**，不要自行改）
- ❌ 不跑 `npm run build` / `build:dir`（會觸發 `fetch:baseline` 下載 ~200 MB，且非本單驗收必要）
- ❌ 不複製 `~/.codex/auth.json`、不碰 `~/.codex/`
- ❌ 不 push、不 bump 版號、不碰 `AGENTS.md`

## 驗收條件

- [ ] AC-1 `node_modules/@openai/codex-sdk`、`@openai/codex`、`@openai/codex-win32-x64` 版本皆為同一 0.160.x；`git diff package-lock.json` 無 `@openai/*` 以外的套件變動（回報區貼 `git diff --stat` 與變動套件清單）
- [ ] AC-2 `npm run test:unit` 全綠，基線 **561** 提升
- [ ] AC-3 `npx vite build` 成功；`npx tsc --noEmit 2>&1 | grep -c "error TS"` 不高於改動前（基線 42，貼前後數字）
- [ ] AC-4 **spawn 路徑 smoke**：以 BAT 實際解析邏輯取得內嵌 binary 路徑（可寫 scratchpad 腳本呼叫 `resolveBundledCodexLayout`），`<binary> --version` 輸出 `codex-cli 0.160.x`；再以 SDK 0.160 `new Codex({ codexPathOverride: <binary>, env: <含 pathDirs 的 env> })` + 空 `CODEX_HOME`（scratchpad）跑一次 `runStreamed()`，預期得到 **CLI 端產生的未登入 / 認證錯誤**（證明 SDK → binary spawn 成功）。貼出輸出
- [ ] AC-5 舊目錄結構相容由單元測試證明（AC-2 內）
- [ ] AC-6 回報區記錄 `du -sh node_modules/@openai/*` 升級前後數字（安裝檔實際大小由下次 CI 發版量測，D121 註記不以 D094 擋單）
- [ ] AC-7 `git diff --stat` 僅動 `affects_files`（若依 Part C 改放 `src/lib/`，於回報區說明）

## Sub-session 執行指示

1. 讀取本工單 + T0366 回報區「Q3」「Q4」段
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 記錄基線：`du -sh node_modules/@openai/*`、`npx tsc --noEmit 2>&1 | grep -c "error TS"`
4. Part A → B → C
5. 跑 AC-1 ~ AC-7
6. 填寫回報區、更新 `status` / `completed_at` / `updated_at`
7. commit（`git commit --only` 指定實際改動檔），訊息建議：`feat(codex): bump codex-sdk to 0.160 and resolve new bundled binary layout (T0369)`
8. 依派發 mode 通知塔台（`bat-notify.mjs`；YOLO 依 ct-exec 規則帶 `--submit`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — AC-1 ~ AC-7 全數 PASS（runtime smoke 以 dev tree `node_modules` 執行；安裝檔實測不在本單範圍，見「遭遇問題」）。

### Landing Zone Check

- 結果：**WARN**（僅 C-0 無資料，其餘 PASS）
- C-0：frontmatter `repo` = `absent` → WARN「repo identity unavailable」；observed `basename(REPO_ROOT)` = `better-agent-terminal`，`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`
- C-1：PASS（工單位於 `REPO_ROOT/_ct-workorders/`）
- C-3：PASS（`package.json`、`package-lock.json`、`electron/codex-agent-manager.ts`、`CHANGELOG.md` 皆存在；新檔以祖先 `electron/` 判定 present）
- C-2：工單無 `branch` 欄位，N/A（實際 `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（evidence only）
- Mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

**Part A — 依賴**
- `package.json`：`@openai/codex-sdk` `^0.124.0` → `^0.160.0`（`npm view @openai/codex-sdk version` 當下 = `0.160.0`）
- 安裝後 `@openai/codex-sdk` / `@openai/codex` = `0.160.0`、`@openai/codex-win32-x64` = `0.160.0-win32-x64`
- `package-lock.json`：本機 npm 安裝時除 `@openai/*` 外，還重排了約 50 處 `"peer": true` 旗標（純 metadata，無任何版本變動）。為符合 memory_overrides「lock 僅 `@openai/*` 變動」，以 scratchpad 腳本從 `HEAD` 的 lock 出發，**只移植** root `dependencies["@openai/codex-sdk"]` 與 8 個 `node_modules/@openai/*` 條目（`codex`、`codex-sdk`、6 個平台套件），最終 diff 為 32+/32-，全部是 `@openai/*` 的 `version` / `resolved` / `integrity` / alias。`npm ls @openai/codex-sdk @openai/codex` 確認樹一致。
- `@anthropic-ai/*` 安裝前後版本比對無差異（`claude-agent-sdk 0.2.113`、`claude-code 2.1.113`、`sdk 0.81.0` 及兩個 win32 平台套件），未干擾 T0368。

**Part B — 內嵌 binary 解析**
- 新增 `electron/codex-bundled-path.ts`：
  - `resolveBundledCodexLayout(pkgRoot, triple, exe, exists)` → `{ binary, pathDirs } | undefined`。依 SDK 0.160 `dist/index.js` `resolveNativePackage()` 實際邏輯對照實作：
    - 新結構：`vendor/<triple>/bin/<exe>` **且** `vendor/<triple>/codex-package.json` 皆存在才成立（SDK 同樣要求兩者）；`pathDirs` = 存在的 `vendor/<triple>/codex-path`
    - 舊結構：`vendor/<triple>/codex/<exe>`；`pathDirs` = 存在的 `vendor/<triple>/path`（SDK 對 legacy 用的是 `path/`，工單未提及，以原始碼為準）
  - `prependPathDirs(env, pathDirs, platform)`：回傳新物件；Windows 下 PATH key 不分大小寫，只保留一個（優先 `Path`），去重後前置——與 SDK `prependPathDirs()` / `pathEnvKey()` 行為一致
- `electron/codex-agent-manager.ts`：
  - `findBundledCodex()` 改呼叫 `resolveBundledCodexLayout()`；`app.asar` → `app.asar.unpacked` 轉換保留在呼叫端（因此 `pathDirs` 也落在 unpacked 下）
  - `findCodexBinary()` 回傳型別改為 `BundledCodexLayout`；`BAT_CODEX_BIN` / PATH 分支回 `pathDirs: []`。**候選優先序未變**（override → PATH → embedded）
  - spawn：僅在 `pathDirs` 非空（= 選到內嵌 binary）時，以 `process.env` 完整拷貝 + `prependPathDirs()` 組 `env` 傳給 `new Codex({ env })`。SDK 0.160 `CodexOptions.env` 註明「提供時不再繼承 `process.env`」，故必須從完整拷貝起算。PATH / `BAT_CODEX_BIN` 分支不傳 `env`，行為與改動前相同
  - Part B-3：SDK 0.160 `CodexOptions` 有 `config?: CodexConfigObject`（序列化為 `--config key=value`）與 `configOverrides?: string[]`（raw）。採用 `config: { check_for_update_on_startup: false }`，所有 binary 來源皆帶上（smoke 中 0.160 無 config 警告 / 錯誤；T0366 Q4 指出 0.124 binary 亦含此鍵字串）

**Part C — 測試與 CHANGELOG**
- vitest `include` 已有 `'electron/__tests__/**/*.test.ts'`（T0348 加入），故維持 `electron/__tests__/codex-bundled-path.test.ts`，**未**改放 `src/lib/`
- 測試 12 個：新結構有/無 `codex-path`、舊結構、舊結構 `path/` helper、新舊並存取新、`bin/<exe>` 缺 `codex-package.json` 時退回舊結構、兩者皆無 → `undefined`；`prependPathDirs` posix 去重、不 mutate 輸入、Windows `Path`/`PATH` 合併、PATH 不存在時建立、空 dirs 回傳拷貝
- `CHANGELOG.md` `## [Unreleased]` → `### Changed` 新增一筆 `deps(codex)`（refs: BUG-083, T0369）

**變動檔案**（全在 `affects_files` 內）
- `package.json`、`package-lock.json`、`electron/codex-agent-manager.ts`、`electron/codex-bundled-path.ts`（新）、`electron/__tests__/codex-bundled-path.test.ts`（新）、`CHANGELOG.md`、本工單

### 驗收條件逐項

- [x] **AC-1 PASS** — `node_modules/@openai/codex-sdk` `0.160.0`、`@openai/codex` `0.160.0`、`@openai/codex-win32-x64` `0.160.0-win32-x64`。`git diff --stat package.json package-lock.json`：
  ```
  package-lock.json | 64 ++++++++++++++++++++++++++++----------------------------
  package.json      |  2 +-
  ```
  lock 變動套件：`node_modules/@openai/codex`、`codex-sdk`、`codex-darwin-arm64`、`codex-darwin-x64`、`codex-linux-arm64`、`codex-linux-x64`、`codex-win32-arm64`、`codex-win32-x64` + root `@openai/codex-sdk` range。過濾 `resolved|integrity|"version"|@openai` 後無剩餘 `+/-` 行。
- [x] **AC-2 PASS** — `npm run test:unit`：`Test Files 43 passed (43)`、`Tests 573 passed (573)`（基線 561 → 573，+12）
- [x] **AC-3 PASS** — `npx vite build` exit 0；`npx tsc --noEmit 2>&1 | grep -c "error TS"`：改動前 **42** → 改動後 **42**（剩餘皆為既有 `CodexAgentPanel.tsx` 等錯誤；新檔與 `codex-agent-manager.ts` 無新增。`.at()` 因 tsconfig `lib: ES2020` 改用 index 存取以免新增 error）
- [x] **AC-4 PASS** — scratchpad 腳本 `t0369-smoke.mts`（Node 24 type-stripping 直接 import `electron/codex-bundled-path.ts`），空 `CODEX_HOME`（scratchpad `codex-home/`，未複製 auth，未碰 `~/.codex/`，並移除 `OPENAI_API_KEY` / `CODEX_API_KEY`）：
  ```
  layout = { "binary": "...\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe",
             "pathDirs": [ "...\vendor\x86_64-pc-windows-msvc\codex-path" ] }
  --version => codex-cli 0.160.0
  PATH keys = [ 'PATH' ] head = ...\vendor\x86_64-pc-windows-msvc\codex-path
  event: {"type":"thread.started","thread_id":"01a105f0-b2a5-7db0-ae20-21614d5e6916"}
  event: {"type":"turn.started"}
  event: {"type":"error","message":"Reconnecting... 2/5 (unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: wss://api.openai.com/v1/responses, ...)"}
  ... (WebSocket 重試 → item.completed type=error "Falling back from WebSockets to HTTPS transport..." → HTTPS 重試 5 次)
  event: {"type":"turn.failed","error":{"message":"unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: https://api.openai.com/v1/responses, ..."}}
  runStreamed threw: Codex Exec exited with code 1: WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir ...
  ```
  `new Codex({ codexPathOverride, env, config: { check_for_update_on_startup: false } })` → SDK spawn 0.160 binary 成功，CLI 回 401 未認證（預期結果）。`--config check_for_update_on_startup=false` 未觸發 config 錯誤或 `Codex is ignoring` 警告。
- [x] **AC-5 PASS** — 舊結構（`vendor/<triple>/codex/<exe>`、`path/` helper、`bin/` 缺 `codex-package.json` 時的退回）由 AC-2 內 `codex-bundled-path.test.ts` 覆蓋
- [x] **AC-6 PASS（記錄）** — `du -sh node_modules/@openai/*`：

  | 套件 | 升級前（0.124） | 升級後（0.160） |
  |------|----------------|----------------|
  | `@openai/codex` | 20K | 20K |
  | `@openai/codex-sdk` | 80K | 92K |
  | `@openai/codex-win32-x64` | 213M | 430M |

  安裝檔實際大小由下次 CI 發版量測（D121，不以 D094 擋單）
- [x] **AC-7 PASS** — 本單變動僅 `affects_files` 6 檔 + 本工單；`AGENTS.md`、`T0368-*.md` 為開工前既有髒檔，未觸碰、未納入 commit

### 遭遇問題

1. **lock 噪音**（已處理）：`npm install` 會重排與 `@openai/*` 無關的 `"peer": true` 旗標（本機 npm 版本與產生原 lock 的版本不同所致）。處理方式見產出摘要 Part A；`node_modules` 實際內容與新 lock 一致。
2. **SDK legacy helper 目錄是 `path/`**：工單只描述新結構的 `codex-path/`；讀 SDK 原始碼發現 legacy 分支使用 `vendor/<triple>/path`，已照 SDK 實作。
3. **後續建議（範圍外，未修改）**：0.160 在連線重試時會發出**頂層** `{"type":"error","message":"Reconnecting... n/5 (...)"}` 事件，以及 `item.type="error"` 的 `Falling back from WebSockets to HTTPS transport...`。BAT 目前的 `case 'error'`（`codex-agent-manager.ts` 約 :1289）與 `item.type === 'error'` 非 `Codex is ignoring` 分支都會送 `claude:error`。真實環境短暫網路抖動時，可能出現與 BUG-083 H2 同型的「回合仍在跑卻顯示紅色 Error」誤報。建議塔台評估另開工單，把 `Reconnecting...` / `Falling back from WebSockets` 歸類為 notice（類比 T0367）。本次 smoke 為未認證情境，最終仍以 `turn.failed` 正確收尾。
4. **未驗證**：打包產物（`asarUnpack` 對新目錄的實際涵蓋、安裝檔大小、exec 是否依賴 `codex-resources/`）——依工單排除項不跑 `npm run build`。`asarUnpack` 的 `node_modules/@openai/codex-*/**/*` 字面上已涵蓋 `vendor/<triple>/{bin,codex-path,codex-resources}/` 與 `codex-package.json`，未發現需停下回報的情形。
5. smoke 中 0.160 印出 `WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir`，僅因 smoke 的 `CODEX_HOME` 位於 `%TEMP%` 底下；BAT 實際使用 `~/.codex`，不受影響。

### Commit

單一 commit（訊息含 T0369，`git commit --only` 指定 7 檔）；不 push。

### 回報時間

2026-10-04T16:04:27+08:00
