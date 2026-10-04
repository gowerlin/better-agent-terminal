---
schema_version: 1
schema_kind: workorder
id: T0373
title: "BUG-083 T-C：Codex binary 改為「選版本最新者」+ 版本 notice + effort 依模型自動校正"
type: fix
status: DONE
priority: P2
sizing: M
created_at: "2026-10-04T16:36:37+08:00"
updated_at: "2026-10-04T16:46:12+08:00"
started_at: "2026-10-04T16:38:06+08:00"
completed_at: "2026-10-04T16:46:12+08:00"
target_version: next
depends_on:
  - T0370
  - T0372
related:
  - "BUG-083"
  - "T0366（research；「建議方向」S2 為本單規格依據）"
  - "T0369（`ca0d292`：`electron/codex-bundled-path.ts`、`findCodexBinary()` 回傳 `BundledCodexLayout`）"
  - "T0370（`30fcf45`：回報區「遭遇問題 3」兩點後續建議 → 本單 Part C）"
  - "D121（排序：本單為 BUG-083 第 4 張，也是最後一張）"
affects_files:
  - electron/codex-agent-manager.ts
  - electron/codex-runtime-resolver.ts
  - electron/__tests__/codex-runtime-resolver.test.ts
  - src/components/CodexAgentPanel.tsx
  - CHANGELOG.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 `BAT_CODEX_BIN` 仍是**最高優先**（逃生口），不參與版本比較。"
  - "🔴 child_process 一律 `execFile` + array args + timeout 5s（CLAUDE.md「Child Process Spawning」）；不得新增 shell-spawning exec API 的模板字串呼叫。版本偵測失敗的候選直接略過，不得讓整個 Codex 面板失敗。"
  - "🔴 不改 `codex-bundled-path.ts` 的目錄解析（T0369）、不改模型清單來源（T0370）、不動 Claude 端任何檔案。"
  - "不 push、不 bump 版號、不碰 `AGENTS.md`、不寫入 `~/.codex/`；不跑需登入的真實回合。"
---

# T0373 — BUG-083 T-C：Codex binary 選最新 + 版本 notice + effort 自動校正

- **狀態**：DONE
- **任務類型**：fix
- **工作量預估**：M
- **Context Window 風險**：中

## 背景

目前 `findCodexBinary()`（`electron/codex-agent-manager.ts:158` 一帶）優先序是 `BAT_CODEX_BIN` → PATH（`findCodexOnPath()` :116，Windows 只收 `.exe`）→ 內嵌。T0366 H3 的致命情境：使用者另裝了較新 Codex（寫入新 config 值），但 BAT 沒選到它 → 退回內嵌 → 解析 config 失敗。內嵌升到 0.160（T0369）後機率下降，但 OpenAI 改版快，下一輪落差必然再出現。T0366 建議 S2：**在候選中選版本最新者**。

T0366 已知的 Windows 候選位置：

- PATH 上的 `codex.exe`（npm `.cmd`/`.ps1` shim 一律略過，現行規則）
- Codex 官方安裝器：`%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe`（T0366 本機實例，`codex-cli 0.160.0`）
- Codex Desktop App：`%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\codex.exe`（`<hash>` 目錄可能多個）
- 內嵌（`codex-bundled-path.ts`）

## 範圍

### Part A — `electron/codex-runtime-resolver.ts`（新）

1. 純函式（可單測）：
   - `parseCodexVersion(stdout: string): string | undefined` —— 解析 `codex-cli X.Y.Z[-suffix]`
   - `compareCodexVersions(a, b): number` —— semver 比較（含 pre-release 處理，`-alpha` 等低於正式版）
   - `pickNewestCodex(candidates: Array<{ path; source: 'path' | 'installer' | 'desktop-app' | 'embedded'; version?: string; pathDirs: string[] }>)` —— 只考慮有 version 者；取最大；**同版時優先 `embedded`**（與 SDK 同步驗證過），其次 `installer` / `desktop-app` / `path`；全部無 version 時回內嵌（若存在）否則第一個存在的候選
2. I/O 函式：
   - 候選收集：PATH（沿用 `findCodexOnPath()` 規則，可移入本檔）、installer、desktop-app（列舉 `<hash>` 子目錄）、內嵌（呼叫既有 `findBundledCodex()` 結果）；非 Windows 平台只收 PATH + 內嵌（installer / desktop-app 路徑只在 win32 檢查）
   - `execFile(bin, ['--version'], { timeout: 5000 })` 取版本；**結果在 process 生命週期內快取**（以 path + mtime 為 key，或單純整體快取；擇一並說明）
3. `codex-agent-manager.ts` 的 `findCodexBinary()`：`BAT_CODEX_BIN` 命中 → 直接用；否則改用 resolver 的選擇結果。回傳仍為 `BundledCodexLayout`（`pathDirs` 僅 embedded 非空，維持 T0369 行為）。若 `findCodexBinary()` 目前是同步而 resolver 需非同步，調整呼叫端為 `await`（只限 session 啟動路徑；不得阻塞 UI 主迴圈以外的同步呼叫點——逐一列出呼叫點於回報區）

### Part B — 版本 notice

- session 啟動時，以 T0367 的 system notice 通道（`role: 'system'`，非 error）顯示一行：`Codex CLI <version> (<source>)`；`BAT_CODEX_BIN` 時 source 顯示 `BAT_CODEX_BIN`、版本取得失敗顯示 `unknown`。每 session 一次
- `logger.log` 記錄所有候選與其版本、最終選擇

### Part C — effort 校正（T0370 後續建議）

- `CodexAgentPanel.tsx`：Codex session mount 時預抓 `getSupportedModels()`（目前 lazy，導致 effort 過濾在開選單前不生效）
- 切換模型時，若目前 effort 不在該模型 `efforts` 內，自動改為該模型 `defaultEffort`（無 `defaultEffort` 則改為 `efforts` 中最接近 `medium` 的值，規則寫在回報區）；模型無 efforts 資訊時不動

### Part D — CHANGELOG

`## [Unreleased]` → `### Changed` 一筆（refs: BUG-083, T0373）

## 明確排除（不要做）

- ❌ `config-incompatible` 時自動換候選重試（T0366 S2 提過，本單不做；選最新已大幅降低機率）
- ❌ Settings UI 的 codex runtime 選擇（S3，後排）
- ❌ 不動 Claude 端、計價表、`codex-bundled-path.ts`、`codex-models.ts`
- ❌ 不 push、不 bump 版號、不碰 `AGENTS.md`

## 驗收條件

- [ ] AC-1 `npm run test:unit` 全綠，基線 **610** 提升；resolver 單測涵蓋：版本解析（含 suffix）、比較、同版優先 embedded、部分候選無版本、全部無版本 fallback
- [ ] AC-2 `npx vite build` 成功；tsc error 數 ≤ 42（貼前後數字）
- [ ] AC-3 **本機實測**（不登入）：scratchpad 腳本呼叫 resolver，列出本機所有候選、各自版本與最終選擇（T0366 本機已知：installer 0.160.0、PATH 上有 npm shim、內嵌 0.160.0 → 預期同版選 embedded）。貼輸出
- [ ] AC-4 回報區列出 `findCodexBinary()` 所有呼叫點與改動後是否 await
- [ ] AC-5 `git diff --stat` 僅動 `affects_files`；child_process 用法符合 CLAUDE.md 規則（貼 resolver 中 `execFile` 片段）

## Sub-session 執行指示

1. 讀取本工單 + T0366 回報區「建議方向」S2 + T0370 回報區「遭遇問題 3」
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 記錄 tsc 基線
4. Part A → B → C → D
5. 跑 AC-1 ~ AC-5
6. 填寫回報區、更新 `status`（**完成請寫 `DONE`**）/ `completed_at` / `updated_at`
7. commit（`git commit --only` 指定實際改動檔），訊息建議：`feat(codex): pick newest codex binary, version notice, effort auto-correct (T0373)`
8. 依派發 mode 通知塔台（`bat-notify.mjs`；YOLO 依 ct-exec 規則帶 `--submit`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — Part A–D 全部完成，AC-1 ~ AC-5 全 PASS。

**Landing Zone Check：WARN**
- C-0：工單 frontmatter **無 `repo` 欄位**（`absent`）→ WARN "repo identity unavailable"；觀察到 `basename(REPO_ROOT)` = `better-agent-terminal`
- C-1 PASS（工單位於 `REPO_ROOT/_ct-workorders/` 下）
- C-3：5 筆 testable，4 筆存在、`electron/codex-runtime-resolver.ts` 為本單新建（祖先 `electron/` 存在）→ present，繼續
- C-2：工單無 `branch` 欄位，不適用（實際 `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

**Part A — `electron/codex-runtime-resolver.ts`（新）**
- 純函式：`parseCodexVersion()`（`/codex-cli\s+v?(X.Y.Z[-suffix])/i`，可在多行輸出中找到版本行）、`compareCodexVersions()`（完整 semver：數字比較、pre-release < 正式版、pre-release identifier 依 semver 規則（數字 < 英數、逐段比、較短者小）；無法解析者排在所有合法版本之下）、`pickNewestCodex()`（只看有 version 者取最大；同版依 `embedded > installer > desktop-app > path`，再同則取先出現者；全部無版本 → embedded，否則第一個候選；空陣列 → `undefined`）
- 候選收集 `collectCodexCandidates(embedded, deps)`（依賴可注入，單測不碰真實檔案系統）：順序 embedded → installer（`%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe`）→ Desktop App（`%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\codex.exe`，列舉所有 `<hash>` 子目錄、依名稱排序）→ PATH。以路徑去重（win32 不分大小寫），因此本機「installer 的 bin 目錄本身就在 PATH 上」時保留較具體的 `installer` 標籤。installer / desktop-app 只在 `win32` 檢查；`LOCALAPPDATA` 未設時以 `homedir\AppData\Local` 推得
- PATH 規則：原 `findCodexOnPath()` **移入本檔改寫為 `findCodexOnPathDirs()`**，規則沿用（Windows 只收 `codex.exe` → `.cmd`/`.bat`/`.ps1` 與無副檔名 npm shim 自然排除；`node_modules/.bin` 目錄略過；POSIX 需為可執行檔 `X_OK`）。差異：改為**自行掃 PATH**，不再以 `execSync` 呼叫 `where.exe codex` / `command -v codex || which codex`（原本是 shell 呼叫），且回傳 PATH 上**所有**合格者而非第一個，全部參與版本比較。`codex-agent-manager.ts` 因此移除 `execSync` import
- 版本偵測 `probeCodexVersion()`：`execFile(bin, ['--version'], { timeout: 5000, windowsHide: true })`，任何失敗（spawn 錯誤、同步 throw、逾時、解析失敗、檔案不存在）→ `undefined`，**永不 throw**；`resolveCodexRuntime()` 以 `Promise.all` 平行探測
- **快取策略：選「path + mtime 為 key」**，process 生命週期內有效（快取的是 Promise，並行請求共用同一次探測）。理由：使用者在 BAT 執行期間以 installer / `codex update` 原地升級時 mtime 改變 → 下個 session 會重新探測、選到新版，不必重啟 BAT；未變動的 binary 每 process 只探測一次。候選列舉（純 fs stat/readdir）每次 session 啟動都重做，以涵蓋 Desktop App 更新後新增的 `<hash>` 目錄。本機實測首次 36 ms、快取後 1 ms

**Part A-3 — `findCodexBinary()`（`codex-agent-manager.ts`）**
- `BAT_CODEX_BIN` 命中（且檔案存在）→ 直接用、不參與比較（僅探測版本供 notice 顯示）；否則改用 `resolveCodexRuntime(findBundledCodex())` 的選擇
- 回傳 `CodexBinaryChoice extends BundledCodexLayout`（多帶 `version`、`source`），`pathDirs` 只有 embedded 非空，T0369 行為不變
- 改為 `async`。**呼叫點清單（全 repo `grep findCodexBinary`，含 electron / src / scripts）**：

  | 呼叫點 | 改動前 | 改動後 |
  |-------|-------|-------|
  | `CodexAgentManager.doStartSession()`（原 `startSession()` 本體，`electron/codex-agent-manager.ts`） | 同步呼叫 | `await findCodexBinary(stag)` |

  唯一呼叫點，本來就在 `async` 的 session 啟動路徑內（`resumeSession()` 經 `startSession()` 間接走同一點）。無其他同步呼叫點受影響
- 防回歸：原本未使用 worktree 時，`startSession()` 在 `sessions.set()` 前沒有任何 `await`（等同原子操作）；改 async 後多了版本探測的空窗，同一 session 並行呼叫兩次可能建立兩個 Codex instance。新增 `pendingStarts` Map：`startSession()` 成為薄包裝，同一 sessionId 進行中的啟動直接回傳同一個 Promise；本體移到 `private doStartSession()`。options 型別抽成 `type CodexStartOptions`（內容不變）

**Part B — 版本 notice**
- `doStartSession()` 在 `Codex session started (...)` init 訊息後，以 T0367 相同通道（`addMessage`，`role: 'system'`，不送 `claude:error`）顯示一行 `Codex CLI <version> (<source>)`；`source` ∈ `embedded` / `installer` / `desktop-app` / `path` / `BAT_CODEX_BIN`，版本取不到顯示 `unknown`
- 每 session 一次：`addRuntimeNotice()` 以內容比對去重。`resumeSession()` 載入歷史會以 `replaceHistory()` 蓋掉啟動訊息，因此歷史載入後再補一次（訊息不在 messages 內才補），確保 resume 的 session 也看得到
- `logger.log`：每個候選一行（`Codex candidate: <source> <path> version=<v|unknown>`）＋最終選擇一行；`BAT_CODEX_BIN` 與「找不到候選」各有一行

**Part C — effort 校正（`CodexAgentPanel.tsx`）**
- Codex session mount 時預抓 `getSupportedModels()`（新 effect，依 `[sessionId, isCodexSession]`；以 functional setState 不覆蓋已載入的清單）。原有兩個 lazy 抓取 effect 保留不動
- 模組層純函式 `codexEffortForModel(model, current)`，`autoCorrectCodexEffort(modelValue)` callback 套用於 `handleModelSelect`（Codex 換模型分支，**在 `resetSession` 之前**呼叫，使重建的 thread 用新 effort）與 `handleModelCycle`
- 規則：
  1. 模型 `efforts` 中屬於 `CODEX_EFFORT_LEVELS` 的值為空（無 efforts 資訊）或已包含目前 effort → **不動**
  2. 否則若模型有 `defaultEffort` 且為合法 `CODEX_EFFORT_LEVELS` 值 → 改為 `defaultEffort`
  3. 否則取 `efforts` 中依 `CODEX_EFFORT_LEVELS` 順序（`minimal|low|medium|high|xhigh|max|ultra`）**與 `medium` 索引距離最小**者；距離相同取**較低**者（較省、較快）。例：`[low, high]` → `low`；`[xhigh, max]` → `xhigh`
- 改 effort 時同步 `setEffortLevel`、`workspaceStore.updateTerminalAgentParams`、`electronAPI.claude.setEffort`，並 `debug.log` 一行。`ModelInfo` 型別補 `defaultEffort?`（main 端 `CodexModelInfo` 早已帶此欄位，cache 來源會有值；builtin 清單沒有 → 走規則 3）
- 刻意未做：mount 時對「已保存但不合法的 effort」自動校正——工單只要求「切換模型時」；且 mount 時 session 可能仍在版本探測中尚未建立，`setEffort` 會靜默失敗而與 UI 不一致

**Part D — CHANGELOG**：`## [Unreleased]` → `### Changed` 前插一筆（refs: BUG-083, T0373）

**改動檔案**：`electron/codex-runtime-resolver.ts`（新）、`electron/__tests__/codex-runtime-resolver.test.ts`（新）、`electron/codex-agent-manager.ts`、`src/components/CodexAgentPanel.tsx`、`CHANGELOG.md`、本工單。全在 `affects_files` 內

### 驗收條件逐項

- [x] **AC-1 PASS** — `npm run test:unit`：`Test Files 46 passed (46)`、`Tests 635 passed (635)`（工單基線 610 → 635；本單新增 `codex-runtime-resolver.test.ts` 25 項）。涵蓋：版本解析（plain / `\r\n` / `-alpha.3` / `v` 前綴 / 多行輸出 / 不相關輸出）、比較（數字非字典序、pre-release < 正式版 > 前一版、semver identifier 排序、無法解析者）、同版優先 embedded 與 installer > desktop-app > path、完全同分取先者、部分候選無版本、全部無版本 → embedded / → 第一個、空陣列；PATH 掃描（Windows shim 排除、引號、`node_modules\.bin`、PATH key 大小寫、POSIX）、候選收集（去重保留 installer 標籤、多 `<hash>` 排序、空 hash 目錄、`LOCALAPPDATA` 推導、非 Windows 只收 PATH + embedded）、`probeCodexVersion` 對不存在檔案與非執行檔回 `undefined`
- [x] **AC-2 PASS** — `npx vite build` exit 0。`npx tsc --noEmit | grep -c "error TS"`：改動前 **42** → 改動後 **42**；去除行號後錯誤訊息集合 `diff` 完全相同（中途一度 43，見「遭遇問題 2」，已修）
- [x] **AC-3 PASS** — scratchpad `t0373-ac3.mts`（Node 24 type-stripping 直接 import `electron/codex-bundled-path.ts` 解析內嵌 layout，再呼叫 `resolveCodexRuntime()`；未登入、未跑回合）：

  ```
  candidate  embedded    0.160.0  D:\...\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe  pathDirs=D:\...\vendor\x86_64-pc-windows-msvc\codex-path
  candidate  installer   0.160.0  C:\Users\Gower\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe
  candidate  desktop-app 0.142.5  C:\Users\Gower\AppData\Local\OpenAI\Codex\bin\ea1c60319a1dcb19\codex.exe
  selected   embedded 0.160.0 D:\...\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe
  first resolve 36 ms
  cached resolve 1 ms
  ```

  與預期一致：installer 0.160.0 與內嵌 0.160.0 同版 → 選 embedded。PATH 上（`where.exe codex`）的三筆：`...\Programs\OpenAI\Codex\bin\codex.exe`（= installer，去重後保留 `installer` 標籤）、`C:\Users\Gower\AppData\Roaming\npm\codex` 與 `codex.cmd`（npm shim，排除）。Desktop App 4 個 `<hash>` 目錄中只有 `ea1c60319a1dcb19` 含 `codex.exe`（0.142.5，較舊，未選）
- [x] **AC-4 PASS** — 呼叫點見「產出摘要 Part A-3」表格：唯一呼叫點 `doStartSession()`，已 `await`
- [x] **AC-5 PASS** — `git diff --stat`（新檔以 `git add -N` 納入）：`CHANGELOG.md`、`electron/__tests__/codex-runtime-resolver.test.ts`、`electron/codex-agent-manager.ts`、`electron/codex-runtime-resolver.ts`、`src/components/CodexAgentPanel.tsx`、本工單；另 `AGENTS.md` 為開工前既有髒檔（claude-mem 自動產生），未觸碰、不納入 commit。child_process：resolver 只 import `execFile`，array args、timeout 5s，無 shell；manager 移除 `execSync`：

  ```ts
  function runVersion(bin: string): Promise<string | undefined> {
    return new Promise(resolve => {
      try {
        execFile(bin, ['--version'], { timeout: VERSION_TIMEOUT_MS, windowsHide: true, encoding: 'utf8' }, (err, stdout, stderr) => {
          if (err) {
            resolve(undefined)
            return
          }
          resolve(parseCodexVersion(`${stdout}\n${stderr}`))
        })
      } catch {
        // spawn can throw synchronously (e.g. EFTYPE on Windows for a non-executable file).
        resolve(undefined)
      }
    })
  }
  ```

  `bin` 是 resolver 自行從固定位置 / PATH 找到的檔案路徑或 `BAT_CODEX_BIN`，以 `execFile` 直接執行、不經 shell；CLAUDE.md 的 `/^[a-zA-Z0-9._-]+$/` 白名單針對 distro / container name 等識別字，不適用於含 `\` `:` 空白的絕對路徑

**證據分道**：source/docs ✅、build + unit tests ✅、本機 resolver 實測 ✅；**未做** Electron runtime smoke（未開 BAT 實際建立 Codex session 看 notice 與 effort 自動切換）——工單未要求，且需登入的回合被排除；建議塔台驗收時開一個 Codex 分頁確認首行 notice 為 `Codex CLI 0.160.0 (embedded)`

### 遭遇問題

1. **單測抓到的真 bug（已修）**：Windows 上對非執行檔呼叫 `execFile` 會**同步 throw** `spawn EFTYPE`，不會走 callback。原寫法會讓 `probeCodexVersion()` reject、進而讓整個 Codex 面板啟動失敗（違反工單「版本偵測失敗不得讓面板失敗」）。已在 `runVersion()` 包 `try/catch`，並以單測固定
2. **tsc 一度 42 → 43（已修）**：mount 預抓 effect 起初照抄既有寫法 `.then((models: ModelInfo[]) => ...)`，該寫法在既有兩處就已是 TS2345（`getSupportedModels` 宣告回傳 `Promise<unknown>`）。新寫法改為 `.then(result => { const models = result as ModelInfo[] | undefined ... })`，恢復 42；既有兩處未動（範圍外）
3. **後續建議（範圍外，未修改）**：
   - 本機 Desktop App 的 Codex 0.142.5 遠舊於 installer / 內嵌 0.160.0，本單會正確略過。若 Desktop App 比內嵌新，BAT 會用 Desktop App 內的 binary；Desktop App 更新時 `<hash>` 目錄會換，候選列舉每次 session 啟動重做已涵蓋
   - 既有兩處 `getSupportedModels(...).then((models: ModelInfo[]) => ...)` 的 TS2345 可順手用同樣寫法消掉（tsc 42 → 40）
   - T0366 S2 的 `config-incompatible` 自動換候選重試（本單明確排除）仍可作為未來工單；`resolveCodexRuntime()` 已回傳完整 `candidates`，重試只需依序取下一個有版本的候選

### Commit

`git commit --only` 指定實際改動檔，單一 commit（hash 見塔台 `git log`；訊息含 T0373）；不 push。

### 回報時間

2026-10-04T16:46:01+08:00
