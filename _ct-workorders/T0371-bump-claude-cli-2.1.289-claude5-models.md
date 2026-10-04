---
schema_version: 1
schema_kind: workorder
id: T0371
title: "BUG-084：內嵌 claude-code CLI 2.1.113 → 2.1.289 + Claude 5 模型清單 + getSupportedModels 帶 runtime 路徑"
type: fix
status: FIXED
priority: P1
sizing: S
created_at: "2026-10-04T16:09:22+08:00"
updated_at: "2026-10-04T16:23:42+08:00"
started_at: "2026-10-04T16:16:16+08:00"
completed_at: "2026-10-04T16:23:42+08:00"
target_version: next
depends_on:
  - T0370
related:
  - "BUG-084"
  - "T0368（research `22e8ddc`；回報區第 1/3/4 節與「建議下一步」T-A 為本單規格依據，請先讀）"
  - "D122"
affects_files:
  - package.json
  - package-lock.json
  - electron/claude-agent-manager.ts
  - .github/workflows/release.yml
interaction:
  mode_hint: yolo
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只升 `@anthropic-ai/claude-code`**；`@anthropic-ai/claude-agent-sdk` 留在 `^0.2.111`（lock 0.2.113）。SDK 0.3 有 V2 API 移除的編譯斷點，屬 Phase 2，待使用者決策（D122）。"
  - "🔴 lock 只能有 `@anthropic-ai/claude-code*` 相關變動（不得動 `@openai/*`——BUG-083 已升至 0.160）。npm 重排 `peer` 旗標等 metadata 雜訊：比照 T0369 的處理（從 HEAD lock 只移植目標條目），並在回報區附 `npm install --package-lock-only --ignore-scripts` 重產後的比對結論（只容許 metadata 差異）。"
  - "🔴 **不改 CHANGELOG.md**（避免與並行工單同檔衝突；塔台收尾時補）。不改 `ClaudeAgentPanel.tsx` / 計價表 / `claude-resolver.ts` / `pty-manager.ts`（後續工單範圍）。"
  - "🔴 smoke 若需登入：**先問使用者**是否允許複製 `~/.claude/.credentials.json` 到隔離 `CLAUDE_CONFIG_DIR`（T0368 Q1 先例）；本單以 `--interactive` 派發，可提問 1 次；使用者拒絕時改用空設定目錄只驗 `--version` 與 `supportedModels()`（不呼叫模型）。"
  - "不 push、不 bump BAT 版號、不碰 `AGENTS.md`。"
---

# T0371 — BUG-084：內嵌 claude-code CLI → 2.1.289 + Claude 5 模型清單

- **狀態**：FIXED
- **任務類型**：fix（依賴升級 + 模型清單）
- **工作量預估**：S
- **Context Window 風險**：低

## 背景

BUG-084：內嵌 CLI 2.1.113 選 `claude-opus-5-5` / `claude-fable-5-1` 必回 `400 claude_code_version_too_old`。T0368 實測 **SDK 0.2.113 + CLI 2.1.289** 組合（含 `query()` 與 V2 `unstable_v2_createSession`）全部可用，且 claude-code 2.1.289 的 binary 目錄結構與 2.1.113 **相同**（無需改路徑解析）。

## 範圍

### Part A — 依賴

- `@anthropic-ai/claude-code` → `^2.1.289`（以 `npm view @anthropic-ai/claude-code version` 當下 `latest` 為準；若 `latest` 已高於 2.1.289，用 `latest` 並在回報區記錄）
- 升級後確認 `node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` 可執行並回報新版號。**附帶修復**：T0368 發現 dev 環境 `claude-code/bin/` 與 `claude-code-win32-x64/` 只剩 BUG-059 殘骸 `claude.exe.old.1776856737641`；重裝後須確認正式 `claude.exe` 回來（回報 `ls` 結果）。若 npm `allowScripts` 警告導致 postinstall 未執行而 `bin/claude.exe` 是 stub，**停下回報**

### Part B — 模型清單

- `BAT_BUILTIN_MODELS`（`electron/claude-agent-manager.ts:28-36` 一帶）**前插** `claude-opus-5-5`、`claude-fable-5-1`、`claude-sonnet-5-5`（皆原生 1M context，**不加 `[1m]` 變體**）；說明文字沿用既有格式，context 寫 1M。既有 4.x 項目保留
- `getSupportedModels()`（約 :1702-1718）：`query({ prompt: '', ... })` 補上 `pathToClaudeCodeExecutable`（用與正式 spawn 相同的 runtime router 解析結果），並修正 `cwd` 放錯層的問題（T0368：`cwd` 應在 `options` 內）。否則下拉的 SDK 補充清單會走 SDK 自帶的 2.1.113 binary，仍是舊清單
- `thinking: { type: 'enabled' }`（約 :717）→ `{ type: 'adaptive' }`（T0368 第 4 節：官方建議；0.2.113 型別已支援 `sdk.d.ts:1318`）

### Part C — CI Node 版本

- `.github/workflows/release.yml:134` desktop build job `node-version: '20'` → `'24'`（2.1.289 `engines.node >=22`；`pre-release.yml` 已是 24）。只改此一處，其他 job 若同樣是 20 一併列在回報區但不改

## 明確排除（不要做）

- ❌ 不升 `@anthropic-ai/claude-agent-sdk`（Phase 2）
- ❌ 不改 CHANGELOG、計價表、錯誤分類、`claude-resolver.ts`、`pty-manager.ts`
- ❌ 不動 `@openai/*`、Codex 相關任何檔案（BUG-083 並行中）
- ❌ 不 push、不 bump 版號、不碰 `AGENTS.md`、不寫入 `~/.claude/`

## 驗收條件

- [ ] AC-1 `node_modules/@anthropic-ai/claude-code` 版本 = 目標版；`bin/claude.exe --version` 輸出新版；`claude-code-win32-x64/claude.exe` 存在（非 `.old.*`）。lock 僅 `@anthropic-ai/claude-code*` 變動（附 diff stat 與重產比對結論）
- [ ] AC-2 `npm run test:unit` 全綠（基線以開工時實測為準，回報前後數字；不得減少）
- [ ] AC-3 `npx vite build` 成功；`npx tsc --noEmit 2>&1 | grep -c "error TS"` 不高於開工基線
- [ ] AC-4 以 BAT 實際 runtime 解析出的 embedded 路徑 + SDK 0.2.113 呼叫 `supportedModels()`（空設定目錄即可，不呼叫模型），輸出含 `claude-opus-5-5` / `claude-fable-5-1` / `claude-sonnet-5-5`（貼輸出）
- [ ] AC-5 若使用者允許 credential 隔離複本（見 memory_overrides）：`claude-opus-5-5` smoke 回 `pong`；不允許則標註「未驗，待塔台/使用者」
- [ ] AC-6 `git diff --stat` 僅動 `affects_files`

## Sub-session 執行指示

1. 讀取本工單 + T0368 回報區第 1/2/3/4 節
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 記錄基線：unit test 數、tsc error 數、`ls node_modules/@anthropic-ai/claude-code/bin`
4. Part A → B → C
5. 跑 AC-1 ~ AC-6
6. 填寫回報區、更新 `status` / `completed_at` / `updated_at`
7. commit（`git commit --only` 指定實際改動檔），訊息建議：`fix(claude): bump embedded claude-code to 2.1.289 and add Claude 5 models (T0371)`
8. 依派發 mode 通知塔台（`bat-notify.mjs`；YOLO 依 ct-exec 規則帶 `--submit`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**FIXED** — Part A/B/C 皆完成，AC-1 ~ AC-6 全部 PASS（含 AC-5 實際 smoke）。待塔台 / 使用者於 BAT 實機（dev 或打包版）驗收模型下拉與 Claude 5 對話。

- **Landing Zone**：WARN — C-0 `repo` 欄位 absent（觀察到 `basename(REPO_ROOT)` = `better-agent-terminal`）；C-1 PASS（工單位於 `REPO_ROOT/_ct-workorders/`）；C-3 PASS（4 筆 `affects_files` 全部存在）；C-2 無 `branch` 欄位（HEAD = `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅作證據）。
- **派發模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=1`。
- **Commit**：`0d231b3`（`git commit --only`，5 檔），未 push。
- **未碰**：`AGENTS.md`（開工前既有 dirty）、CHANGELOG、`ClaudeAgentPanel.tsx`、計價表、`claude-resolver.ts`、`pty-manager.ts`、`@openai/*`、`claude-agent-sdk`。

### 互動紀錄

| # | 問題 | 使用者回答 |
|---|------|-----------|
| Q1 | AC-5：是否允許把 `~/.claude/.credentials.json` 複製到 scratchpad 隔離的 `CLAUDE_CONFIG_DIR` 跑 1 次 `claude-opus-5-5` smoke（跑完刪除） | 允許隔離複本 smoke |

auth 驗證：smoke 前後 `~/.claude/.credentials.json` sha256 前 16 碼皆為 `8169ed6e7b1ea452`、mtime 皆為 `2026-10-04 15:18:25.430503900 +0800`；隔離複本跑完 hash 相同（未觸發 token refresh），已刪除。

### 產出摘要

**Part A — 依賴**
- `npm view @anthropic-ai/claude-code dist-tags` → `{ stable: '2.1.285', latest: '2.1.289', next: '2.1.289' }`，`latest` = 2.1.289，未高於目標，照用。
- `package.json`：`@anthropic-ai/claude-code` `^2.1.111` → `^2.1.289`；`@anthropic-ai/claude-agent-sdk` 維持 `^0.2.111`（實裝 0.2.113）。
- `npm install "@anthropic-ai/claude-code@^2.1.289"`（npm 11.19.0 / Node v24.21.0）：`changed 2 packages`。出現 `install-scripts ... not yet covered by allowScripts` 警告（含 `@anthropic-ai/claude-code@2.1.289 (postinstall: node install.cjs)`），但 **postinstall 有執行**：`bin/claude.exe` 為 249,522,848 bytes、hardlink count 2（與平台套件同檔），非 stub，`--version` 可跑。
- **dev 殘骸修復**：開工前 `bin/` 與 `claude-code-win32-x64/` 都只有 `claude.exe.old.1776856737641`（245,966,496 bytes）；重裝後：

  ```
  node_modules/@anthropic-ai/claude-code/bin:
  -rwxr-xr-x 2 Gower 197121 249522848 Oct  4 16:16 claude.exe*
  node_modules/@anthropic-ai/claude-code-win32-x64:
  -rwxr-xr-x 2 Gower 197121 249522848 Oct  4 16:16 claude.exe*
  -rw-r--r-- 1 Gower 197121       148 Oct  4 16:16 LICENSE.md
  -rw-r--r-- 1 Gower 197121       272 Oct  4 16:16 package.json
  -rw-r--r-- 1 Gower 197121       150 Oct  4 16:16 README.md
  ```
  `.old.*` 已不存在。
- **lock 處理**（比照 T0369）：npm 原生產出的 lock 有 141 行變動，夾帶約 40 處 `peer` 旗標重排雜訊；改以 scratchpad `transplant.mjs` 從 HEAD lock 只移植 `node_modules/@anthropic-ai/claude-code` 與 `node_modules/@anthropic-ai/claude-code-*` 條目 + root `packages[""].dependencies` 那一行。結果 `package-lock.json | 86 ++++----`（49+/37−），變動全部落在 claude-code 條目內（`version`/`resolved`/`integrity`、`engines.node` `>=18.0.0` → `>=22.0.0`、linux 平台套件新增 `libc: ["glibc"|"musl"]`）。

**Part B — 模型清單（`electron/claude-agent-manager.ts`）**
- `BAT_BUILTIN_MODELS` 前插 `claude-opus-5-5`（Opus 5.5 (1M)）、`claude-fable-5-1`（Fable 5.1 (1M)）、`claude-sonnet-5-5`（Sonnet 5.5 (1M)），description 格式 `<id> · 1M context`；不加 `[1m]` 變體；既有 4.x 七項保留不動。
- `getSupportedModels(sessionId)`：改用 `this.resolveRuntimeForSession(sessionId)`（與 `query()` 正式 spawn / `forkSession` 同一個 runtime router 入口）解出的 `path` 帶入 `pathToClaudeCodeExecutable`；`cwd: '/'` 移入 `options`。router 拋 `SystemClaudeUnavailableError`（fallback 關閉且 system 不可用）時落入既有 `catch` → 只回 builtins，行為與原本失敗路徑一致。參數 `_sessionId` → `sessionId`（IPC 呼叫端 `main.ts:2239` 本來就傳真實 session id，簽名不變）。
- `thinking: { type: 'enabled' }` → `{ type: 'adaptive' }`（`query()` 主路徑，原 :717）。

**Part C — CI**
- `.github/workflows/release.yml:134`（desktop `build` job）`node-version: '20'` → `'24'`。
- 其他 workflow 的 `node-version` 掃描：`release.yml:46/:81`、`pre-release.yml:81/116/168`、`build-server-bundle.yml:39/74/146` 全部已是 `'24'`，**沒有其他 Node 20 殘留**。

### 驗收條件逐項

| AC | 結果 | 證據 |
|----|------|------|
| AC-1 | ✅ PASS | `node_modules/@anthropic-ai/claude-code/package.json` 與 `claude-code-win32-x64/package.json` = `2.1.289`；`bin/claude.exe --version` → `2.1.289 (Claude Code)`；`claude-code-win32-x64/claude.exe --version` → `2.1.289 (Claude Code)`（非 `.old.*`，見上方 `ls`）。lock：diff stat `86 (49+/37−)`，只動 `@anthropic-ai/claude-code*`。**重產比對**：把 `package.json` + 移植後 lock 複製到 scratchpad 跑 `npm install --package-lock-only --ignore-scripts`，以 `cmp.mjs` 逐 package 比對 → `metadata-only (peer/dev/optional flags) diffs: 43`、`substantive diffs: 0`（只容許 metadata 差異 ✅）。`claude-agent-sdk` 仍為 0.2.113 |
| AC-2 | ✅ PASS | 開工基線 `Test Files 44 passed (44)` / `Tests 593 passed (593)`；完成後 `44 passed (44)` / `593 passed (593)`，數量未減。另跑 `npm run test:claude-code-path` → `4 passed, 0 failed`（含「resolved bin path exists on disk」，開工前此項在 dev 環境會因殘骸而失敗） |
| AC-3 | ✅ PASS | `npx vite build` exit 0；`npx tsc --noEmit 2>&1 \| grep -c "error TS"` 基線 **42** → 完成後 **42**，且去掉行列號後的錯誤集合與基線完全相同（`diff` 無輸出） |
| AC-4 | ✅ PASS | scratchpad `ac4.mjs`：以 `resolveClaudeCodePath()` / `resolveEmbeddedClaudePath()` 的 dev 分支同邏輯（`createRequire` 解 `@anthropic-ai/claude-code/package.json` → `bin/claude.exe`）取路徑，repo 的 SDK 0.2.113 呼叫 `query({ prompt: '', options: { cwd: '/', pathToClaudeCodeExecutable } }).supportedModels()`，`CLAUDE_CONFIG_DIR` = scratchpad 空目錄、`DISABLE_AUTOUPDATER=1`、未呼叫模型。輸出見下 |
| AC-5 | ✅ PASS | 同一 embedded 路徑 + SDK 0.2.113，選項比照正式 spawn（`systemPrompt`/`tools` preset、`settingSources`、`thinking: adaptive`、`effort: high`、`canUseTool`、`pathToClaudeCodeExecutable`），`model: 'claude-opus-5-5'`、`maxTurns: 1`：`init: claude-opus-5-5 claude_code_version: 2.1.289` → `assistant: ["pong"]` → `result: success is_error: false text: "pong"`（`modelUsage` keys：`claude-haiku-4-5-20251001,claude-opus-5-5`，haiku 為 CLI 內部輔助呼叫）。共 1 次模型呼叫 |
| AC-6 | ✅ PASS | `git diff --stat`：`.github/workflows/release.yml` 2、`electron/claude-agent-manager.ts` 18、`package-lock.json` 86、`package.json` 2 + 本工單檔；`AGENTS.md` 為開工前既有 dirty，未 stage、未 commit |

AC-4 輸出（`supportedModels()` 原始回傳，每筆的 `value` 為 CLI alias，正式 model ID 在 `resolvedModel` 欄位）：

```
SDK version: 0.2.113
pathToClaudeCodeExecutable: D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\better-agent-terminal\node_modules\@anthropic-ai\claude-code\bin\claude.exe
  default    | Default (recommended) | Use the default model (currently Opus 5.5) · $4/$20 per Mtok
  opus       | Opus | Opus 5.5 · Best for everyday, complex tasks · $4/$20 per Mtok
  fable      | Fable | Fable 5.1 · Most capable for your hardest and longest-running tasks · $10/$50 per Mtok
  sonnet     | Sonnet | Sonnet 5.5 · Efficient for routine tasks · $2/$10 per Mtok
  haiku      | Haiku | Haiku 4.5 · Fastest for quick answers · $1/$5 per Mtok
[{"value":"default","resolvedModel":"claude-opus-5-5",...},{"value":"opus","resolvedModel":"claude-opus-5-5",...},
 {"value":"fable","resolvedModel":"claude-fable-5-1",...},{"value":"sonnet","resolvedModel":"claude-sonnet-5-5",...},
 {"value":"haiku","resolvedModel":"claude-haiku-4-5-20251001"}]
claude-opus-5-5: FOUND
claude-fable-5-1: FOUND
claude-sonnet-5-5: FOUND
```

（每筆另有 `supportsEffort` / `supportedEffortLevels` / `supportsAdaptiveThinking` / `supportsAutoMode` 欄位；opus/default 另有 `supportsFastMode`。）

### 遭遇問題

- 無阻塞。
- **觀察（非本單範圍，供後續工單）**：
  1. `getSupportedModels()` 的 SDK 補充清單現在會回 `default` / `opus` / `fable` / `sonnet` / `haiku` 這些 **alias**（value 不是完整 ID），既有過濾只比對 `value` 與 `${value}[1m]`，所以下拉會同時出現 builtin 的 `claude-opus-5-5` 與 SDK 的 `opus`（指向同一模型）。這是既有行為（2.1.113 時也回 alias），若要去重可改比對 `resolvedModel`——建議併入 T-B/T-C 或另開小單。
  2. `getSupportedModels()` 每次呼叫 `query({ prompt: '' })` 產生的 CLI 子行程沒有被明確關閉（既有行為，本單未動）。
  3. `resolveRuntimeForSession()` 的 system `version-warning` toast 文案仍寫 `requires >= 2.1.111 for Opus 4.7 / xhigh effort`（`claude-agent-manager.ts` :290 一帶）——屬 T-C（`HEALTHY_MIN` → 2.1.280）範圍。
  4. 未以 `getContextUsage()` 量測無 `[1m]` 後綴 5 系列 ID 的實際 context 上限（T0368 殘留項）；本單 description 依官方文件寫 1M。
  5. npm `allowScripts` 警告持續出現；本次 postinstall 仍有跑。T-E 建議的「CI 驗 `bin/claude.exe --version`」仍值得做。
- 未驗：BAT 實機 UI（下拉顯示、system runtime 下的 `getSupportedModels`）、macOS / Linux、打包後安裝檔。
- CLAUDE.md「Claude Agent SDK / CLI」節的版本描述（`^2.1.111` / 實裝 2.1.113、Opus 4.7）已過時，依 T0368 清單由塔台收尾時更新（本單不改）。

### 回報時間

2026-10-04T16:22:42+08:00
