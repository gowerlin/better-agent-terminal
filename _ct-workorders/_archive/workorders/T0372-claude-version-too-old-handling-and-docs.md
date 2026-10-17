---
schema_version: 1
schema_kind: workorder
id: T0372
title: "BUG-084 後續：claude_code_version_too_old 錯誤分類 + HEALTHY_MIN 2.1.280 + embedded DISABLE_UPDATES + 模型下拉去重 + CLAUDE.md 更新"
type: fix
status: DONE
priority: P1
sizing: S
created_at: "2026-10-04T16:24:08+08:00"
updated_at: "2026-10-04T16:36:12+08:00"
started_at: "2026-10-04T16:25:21+08:00"
completed_at: "2026-10-04T16:36:12+08:00"
target_version: next
depends_on:
  - T0371
related:
  - "BUG-084"
  - "T0368（research `22e8ddc`；第 1/5 節與「CLAUDE.md 需更新」8 點清單）"
  - "T0371（`0d231b3`；回報區「遭遇問題」觀察 1/3）"
  - "T0367（Codex 同型錯誤分類先例：`src/lib/codex-error-classify.ts`）"
  - "D122 / D123"
affects_files:
  - electron/claude-agent-manager.ts
  - electron/claude-resolver.ts
  - electron/pty-manager.ts
  - src/lib/claude-error-classify.ts
  - src/lib/__tests__/claude-error-classify.test.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - CLAUDE.md
  - CHANGELOG.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 `DISABLE_UPDATES=1` **只注入 embedded runtime**；system runtime 不得注入（使用者需能自行 `claude update`）。`DISABLE_AUTOUPDATER=1` 維持兩種 runtime 都注入（BUG-059，不變）。"
  - "🔴 不改計價表 `MODEL_PRICING`（下一張工單）；不升 SDK、不動 `claude-code-v2` preset（Phase 2，D123）；不動任何 Codex 檔案。"
  - "🔴 錯誤分類放 renderer 純函式 + i18n，不改 `claude:error` IPC 簽章（與 Codex 面板共用）。"
  - "不 push、不 bump 版號、不碰 `AGENTS.md`、不寫入 `~/.claude/`；不跑需登入的真實回合（單元測試證明即可）。"
---

# T0372 — BUG-084 後續：版本過舊錯誤分類 + 防更新 + 文件

- **狀態**：DONE
- **任務類型**：fix
- **工作量預估**：S
- **Context Window 風險**：低~中（CLAUDE.md 節段改寫）

## 背景

T0371 已把內嵌 CLI 升到 2.1.289。但：(1) 使用者走 **system runtime** 且系統 claude 過舊時，仍會撞到服務端 `claude_code_version_too_old`，目前只顯示原始 `API Error: 400 {...}`；(2) system 健康檢查門檻 `HEALTHY_MIN = '2.1.111'`（`electron/claude-resolver.ts:52`）過時，Opus 5.5 需要 ≥ 2.1.280；(3) embedded 使用者在 BAT terminal 手動 `claude update` 仍可能重演 BUG-059；(4) T0371 觀察到模型下拉同時出現 builtin `claude-opus-5-5` 與 SDK alias `opus`（同一模型）。

T0368 實測錯誤原文（fixture 用）：

```
API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Claude Code 2.1.113 does not support this model; version 2.1.280 or newer is required. Run 'claude update', or update the Claude desktop app, then try again.","error_code":"claude_code_version_too_old"},"request_id":"req_011CfgrA72sUuecgiqB9xRCj"}
```

（實際 JSON 層級以 T0368 回報區第 1 節為準；分類不得依賴完整 JSON 結構，抓 `claude_code_version_too_old` 與 `version X or newer is required` 片語即可）

## 範圍

### Part A — 錯誤分類（renderer）

1. 新增 `src/lib/claude-error-classify.ts`：`classifyClaudeError(message) → { kind: 'cli-too-old' | 'unknown'; currentVersion?: string; requiredVersion?: string }`，擷取 `Claude Code <cur> does not support` 與 `version <req> or newer`
2. `ClaudeAgentPanel.tsx`：Claude 的 API 錯誤可能出現在 (a) `claude:error` 事件、(b) assistant 訊息文字 `API Error: 400 ...`、(c) `result` 的 `is_error: true`。**先讀現有程式碼確認錯誤實際落在哪條路徑**，在對應處命中 `cli-too-old` 時於原訊息後附 i18n 提示：「目前 Claude Code {{current}} 太舊，此模型需要 {{required}} 以上。請升級 BAT，或到 Settings → Advanced → Claude Runtime 切換到 system 並升級系統 claude」（三語）
3. 單元測試以上方 fixture 原文 + 大小寫 / 缺版本號變體 + 無關錯誤

### Part B — runtime 版本門檻與防更新

- `claude-resolver.ts` `HEALTHY_MIN` → `'2.1.280'`（Opus 5.5 門檻，T0368）；`claude-agent-manager.ts` 約 :295 的 `version-warning` 文案同步（改為提及 Claude 5 / Opus 5.5，不再寫 Opus 4.7 / xhigh）。若有測試斷言舊門檻，一併更新
- embedded runtime 的子行程額外注入 `DISABLE_UPDATES=1`：
  - Agent SDK 路徑：`claude-agent-manager.ts` constructor 目前 `process.env.DISABLE_AUTOUPDATER = '1'`（:227）是全域設定；**`DISABLE_UPDATES` 不可比照全域設定**（會影響 system runtime）。請找出依 runtime 決定 spawn env 的位置（runtime router 解析結果），只在 embedded 時加入；若 SDK 0.2.113 `query()` 傳 `options.env` 會取代 `process.env`（T0368 第 5 節），須以 `{ ...process.env, DISABLE_UPDATES: '1' }` 組
  - terminal claude-cli preset：`pty-manager.ts` :421 / :474 / :554 三處 `envWithUtf8`；只在該 terminal 實際使用 embedded claude 時加入（判斷方式讀現有 preset / router 程式碼決定，回報區說明）
- 單元測試：若既有 router / resolver 測試可擴充，加一個「embedded 有 `DISABLE_UPDATES`、system 沒有」的 case；不可測則回報區說明並附程式碼片段

### Part C — 模型下拉去重

- `getSupportedModels()`（`claude-agent-manager.ts`）合併 SDK 清單時，若 SDK 項目的 `resolvedModel` 等於某 builtin 的 `value`（或 `${value}[1m]`），略過該 SDK alias 項目；`resolvedModel` 不存在時維持現行比對 `value`
- 若 `getSupportedModels()` 內 `query({ prompt: '' })` 產生的子行程有明確的關閉方式（SDK 0.2.113 `Query` 型別的 `interrupt()` / `return()` 等，讀型別確認），在取得清單後關閉；沒有就略過並說明

### Part D — 文件

- `CLAUDE.md`「Claude Agent SDK / CLI」節、「Claude Runtime Selection」常見故障表、「Embedded claude auto-update 停用（BUG-059）」節：依 **T0368 回報區「CLAUDE.md 需更新」第 1-7 點**改寫（第 8 點屬 Phase 2，不做）。版本寫實裝值：SDK `^0.2.111`（0.2.113）、CLI `^2.1.289`（2.1.289）。日期用系統時間
- `CHANGELOG.md` `## [Unreleased]`：補 T0371（CLI 2.1.289 + Claude 5 模型 + Node 24）與本單各一筆（refs: BUG-084）——T0371 刻意未寫 CHANGELOG，由本單一併補

## 明確排除（不要做）

- ❌ 計價表、SDK 升級、V2 preset、Codex 任何檔案
- ❌ 不改 `claude:error` IPC 簽章
- ❌ 不 push、不 bump 版號、不碰 `AGENTS.md`

## 驗收條件

- [ ] AC-1 `npm run test:unit` 全綠，基線 **593** 提升
- [ ] AC-2 `npx vite build` 成功；tsc error 數 ≤ 42（貼前後數字）
- [ ] AC-3 `classifyClaudeError` 對 fixture 原文回 `{ kind: 'cli-too-old', currentVersion: '2.1.113', requiredVersion: '2.1.280' }`
- [ ] AC-4 回報區附程式碼片段證明 `DISABLE_UPDATES` 僅在 embedded 路徑注入（Agent SDK + terminal 兩處）
- [ ] AC-5 `HEALTHY_MIN` = `2.1.280`；`grep -rn "2.1.111" electron src CLAUDE.md` 剩餘命中逐一說明（應只剩歷史敘述）
- [ ] AC-6 三語 locale 新增 key 集合相同
- [ ] AC-7 `git diff --stat` 僅動 `affects_files`

## Sub-session 執行指示

1. 讀取本工單 + T0368 回報區第 1、5 節與「CLAUDE.md 需更新」清單 + T0371 回報區「遭遇問題」
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 記錄 tsc 基線
4. Part A → B → C → D
5. 跑 AC-1 ~ AC-7
6. 填寫回報區、更新 `status`（**完成請寫 `DONE`**）/ `completed_at` / `updated_at`
7. commit（`git commit --only` 指定實際改動檔），訊息建議：`fix(claude): classify version-too-old errors, embedded DISABLE_UPDATES, HEALTHY_MIN 2.1.280 (T0372)`
8. 依派發 mode 通知塔台（`bat-notify.mjs`；YOLO 依 ct-exec 規則帶 `--submit`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ **DONE**（commit `79c349e`）：Part A–D 全部完成，AC-1 ~ AC-6 PASS。AC-7 有兩處超出 `affects_files` 的改動，是依判斷執行的，見「遭遇問題」D-1 / D-2。

**落點檢查（Landing Zone）**：WARN
- C-0：frontmatter **無 `repo` 欄位**（`absent`）→ WARN「repo identity unavailable」；觀察到 `basename(REPO_ROOT)` = `better-agent-terminal`，`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`
- C-1：PASS，工單位於 `REPO_ROOT/_ct-workorders/`
- C-3：PASS，前 5 筆皆 present（`electron/claude-agent-manager.ts`、`electron/claude-resolver.ts`、`electron/pty-manager.ts` 存在；兩個新檔的祖先 `src/lib/` 存在）
- C-2：工單無 `branch` 欄位，不適用；實際分支 `main`
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

**Part A：錯誤分類（renderer）**
- 新增 `src/lib/claude-error-classify.ts`：`classifyClaudeError(message) → { kind: 'cli-too-old' | 'unknown'; currentVersion?; requiredVersion? }`。命中條件有兩種：出現 `claude_code_version_too_old`；或「`version X or newer is required`」與「`Claude Code … does not support this model`」同時出現。不解析 JSON、不分大小寫，版本號抓不到就省略。
- **錯誤實際路徑**（讀程式碼與 SDK 原始碼確認）：
  - (b) assistant 訊息：CLI 以 assistant 文字送出 `API Error: 400 {...}`，經 `processMessage` → `claude:message` 到 renderer `onMessage`。
  - (c) `result`：`subtype:'success'` + `is_error:true`，`result` 為同一段文字。renderer `onResult` 會因 `alreadyShown` 略過，**不需處理**。
  - (a) `claude:error`：SDK 0.2.113 `sdk.mjs` 收到 `is_error` result 後，若行程以錯誤結束，會把錯誤換成 `Error("Claude Code returned an error result: " + lastErrorResultText)`（log 為 `[Query.readMessages] Replacing exit error with result text`）。之後經 `runQuery` catch 送出 `claude:error`，原文完整保留。BAT V1 用字串 prompt，屬 single-turn，所以會走到這條路徑，與 T0368「之後 SDK 迭代器拋例外」一致。
- `ClaudeAgentPanel.tsx`：在 (b) 的 assistant 訊息與 (a) 的 `onError` 兩處附上 `\n\n💡 <hint>`。`onError` 會先查「最後一則 user 訊息之後」是否已有同一句提示，有就不再附加，所以同一回合 (b)、(a) 都到時只顯示一次。版本號齊全時用 `claude.claudeErrorHintCliTooOld`（`{{current}}` / `{{required}}`），否則用 `claude.claudeErrorHintCliTooOldGeneric`。
- 三語 locale 各新增 2 個 key（`claude.claudeErrorHintCliTooOld` / `claude.claudeErrorHintCliTooOldGeneric`）；zh-TW 文案照工單原句。
- `src/lib/__tests__/claude-error-classify.test.ts` 共 14 條測試：
  - T0368 原文 fixture、SDK 包裝後的 thrown 形式、Fable 門檻
  - 全大寫、只有 error code、缺目前版本、沒有 JSON 的純片語
  - 無關錯誤：529 overloaded、prompt too long、exited with code、Session not found，以及只有「version X or newer is required」卻沒有 Claude Code 脈絡的字串
  - 非字串輸入

**Part B：門檻與防更新**
- `electron/claude-resolver.ts`：
  - `HEALTHY_MIN` 由 `'2.1.111'` 改為 `'2.1.280'`，檔頭註解與 `ClaudeHealthStatus` 註解同步。
  - 新增 `claudeUpdateGuardEnv(source: ResolvedRuntimeSource)`：`source === 'system'` 回 `{}`；`embedded` 與 `system-fallback-to-embedded` 回 `{ DISABLE_UPDATES: '1' }`。對 router 只用 `import type`，執行期沒有循環相依。
- `electron/claude-agent-manager.ts`：
  - `version-warning` 文案改為 `requires >= 2.1.280 for Claude 5 models such as Opus 5.5 ... newer models may be rejected by the server`。
  - 新增 `sdkSpawnEnv(resolvedRuntime)`，套用到**全部 4 個 SDK spawn 點**：`runQuery`、V2 `createSession` / `resumeSession` options、`getSupportedModels`、`forkSession`。
  - constructor 的全域 `process.env.DISABLE_AUTOUPDATER = '1'` 不變。
- `electron/pty-manager.ts`：新增 `claudeCliUpdateGuardEnv(agentPreset)`。條件是 `agentPreset` 為 `claude-cli` / `claude-cli-worktree`，且持久化設定 `claudeRuntime.mode === 'embedded'`。符合時，3 處 `envWithUtf8` 會在 `DISABLE_AUTOUPDATER` 之後 spread 進 `DISABLE_UPDATES: '1'`。
  - **為什麼用 mode 判斷**：renderer `WorkspaceView.startClaudeCliPty()` 先呼叫 `claude:get-cli-path`（讀同一份 `getRuntimeSettingsSnapshot()` 再 `resolveClaudeRuntime()`），之後才以 `agentPreset: 'claude-cli' | 'claude-cli-worktree'` 呼叫 `pty.create`。`create()` 是同步函式，system 模式的 fallback 卻要非同步偵測，因此只能依 mode 判斷。取捨見「遭遇問題」O-2。
- 測試：
  - `electron/__tests__/claude-runtime-router.test.ts`（vitest）新增 3 條：embedded 有、system healthy 沒有、system fallback 有。做法是實際呼叫 `resolveClaudeRuntime()`，再把結果的 `source` 交給 `claudeUpdateGuardEnv`。
  - `tests/claude-resolver.test.ts`（tsx 腳本）原本斷言舊門檻，依工單「一併更新」改為：2.1.289 healthy、2.1.280 邊界 healthy、2.1.279 warning、2.1.113 warning。

**Part C：模型下拉去重**
- 已確認 CLI 2.1.289 的 `supportedModels()` 會回 `resolvedModel`（binary schema 內為 `resolvedModel: ... "Canonical wire model id this row's value resolves to"`）。0.2.113 的 `ModelInfo` 型別沒有這個欄位，因此在本地用交集型別補上。
- 過濾規則：
  - `value` 已被 builtin（含 `[1m]`）涵蓋 → 略過（原行為）。
  - `value !== 'default'` 且 `resolvedModel` 已被 builtin（含 `[1m]`）涵蓋 → 略過。
  - 結果：`opus` / `fable` / `sonnet` / `haiku` 這類 alias 不再與 builtin 重複出現。
  - **`default` 刻意保留**：它跟隨帳號預設，不指向固定模型，濾掉的話下拉會少一個有意義的選項。這是工單規則之外的判斷，見 O-3。
- 子行程關閉：0.2.113 的 `Query` 型別有 `close(): void`（說明為 terminate the underlying process）。已在 `finally` 以 try/catch 呼叫 `instance?.close()`。

**Part D：文件**
- `CLAUDE.md`：
  - 「Claude Agent SDK / CLI」節依 T0368 第 1–5 點改寫：
    - 版本行改為 SDK `^0.2.111`（0.2.113）、CLI `^2.1.289`（2.1.289）
    - 新增服務端版本門檻與錯誤分類的說明
    - `BAT_BUILTIN_MODELS`：5 系列不加 `[1m]`，SDK alias 去重
    - `MODEL_PRICING` 尚未收錄 5 系列，並記錄 `P()` 的 cache read 倍率問題
    - effort `max` 的「(Opus only)」標示已過時
  - 「Claude Runtime Selection」：內嵌版本改為 `^2.1.289`；故障表 `version-warning` 門檻改為 2.1.280，並新增 `claude_code_version_too_old` 一列（第 6 點）。
  - 「BUG-059」節：新增 `DISABLE_UPDATES` 的注入範圍、注入點與已知缺口（第 7 點）。
  - 第 8 點（Phase 2 V2 / SDK 0.3）未做。日期 2026-10-04 取自 `date`。
- `CHANGELOG.md`：在 `## [Unreleased]` → `### Fixed` 頂端補兩筆，T0372 與 T0371，皆標 refs BUG-084。

### 驗收條件逐項

| AC | 結果 | 證據 |
|----|------|------|
| AC-1 | ✅ PASS | `npm run test:unit`：`Test Files 45 passed (45)`、`Tests 610 passed (610)`。基線 593 → 610，+17（分類器 14、router 3）。另 `npx tsx tests/claude-resolver.test.ts` → `18 passed, 0 failed`；`npx tsx tests/claude-runtime-router.test.ts` → `11 passed, 0 failed` |
| AC-2 | ✅ PASS | `npx vite build` exit 0，4 個 bundle 皆 `built in`。`npx tsc --noEmit 2>&1 \| grep -c "error TS"`：開工 **42** → 完成 **42**，去掉行列號後錯誤集合與基線相同（`diff` 無輸出）。build 出現的 `claude-resolver.ts` / `claude-runtime-router.ts`「dynamically imported ... but also statically imported」兩則 warning 改動前就有（router 原本就被 agent-manager 靜態 import，resolver 原本就被 router 靜態 import），本單只讓 importer 清單多了 `pty-manager.ts` |
| AC-3 | ✅ PASS | 測試 `#1 version-too-old API error yields both versions`：`classifyClaudeError(<T0368 原文>)` 為 `toEqual({ kind: 'cli-too-old', currentVersion: '2.1.113', requiredVersion: '2.1.280' })` |
| AC-4 | ✅ PASS | 程式碼片段見下 |
| AC-5 | ✅ PASS | `HEALTHY_MIN = '2.1.280'`；`grep -rn "2.1.111" electron src CLAUDE.md` 的剩餘命中逐一說明於下 |
| AC-6 | ✅ PASS | `claude` 區塊的 `claudeErrorHint*` key 集合在 en / zh-TW / zh-CN 皆為 `claudeErrorHintCliTooOld,claudeErrorHintCliTooOldGeneric`（node 比對結果 `SAME`），三檔 `JSON.parse` 皆通過 |
| AC-7 | ⚠️ PARTIAL | 改動中屬於 `affects_files` 的：`electron/claude-agent-manager.ts`、`electron/claude-resolver.ts`、`electron/pty-manager.ts`、`src/lib/claude-error-classify.ts`（新）、`src/lib/__tests__/claude-error-classify.test.ts`（新）、`src/components/ClaudeAgentPanel.tsx`、`src/locales/{en,zh-TW,zh-CN}.json`、`CLAUDE.md`、`CHANGELOG.md`、本工單。**範圍外 3 檔**：`electron/__tests__/claude-runtime-router.test.ts`、`tests/claude-resolver.test.ts`（D-1），以及 `electron/main.ts` 1 行（D-2）。`AGENTS.md` 開工前已是 dirty，未碰也未 commit |

**AC-4 片段：Agent SDK**（`electron/claude-resolver.ts` + `electron/claude-agent-manager.ts`）

```ts
// claude-resolver.ts
export function claudeUpdateGuardEnv(source: ResolvedRuntimeSource): Record<string, string> {
  return source === 'system' ? {} : { DISABLE_UPDATES: '1' }
}

// claude-agent-manager.ts（system → 不傳 options.env，維持 SDK 預設 {...process.env}）
function sdkSpawnEnv(runtime: ResolvedRuntime): { env?: Record<string, string | undefined> } {
  const guard = claudeUpdateGuardEnv(runtime.source)
  return Object.keys(guard).length > 0 ? { env: { ...process.env, ...guard } } : {}
}
// runQuery / V2 v2Options / getSupportedModels / forkSession 皆為：
  ...(claudeCodePath ? { pathToClaudeCodeExecutable: claudeCodePath } : {}),
  ...sdkSpawnEnv(resolvedRuntime),
```

`sdkSpawnEnv` 在 `ELECTRON_RUN_AS_NODE` 設好之後才求值：runQuery 與 V2 都是先設環境變數、後組 options。快照時機因此與 SDK 預設 `env: U={...process.env}` 相同。

**AC-4 片段：Terminal**（`electron/pty-manager.ts`）

```ts
function claudeCliUpdateGuardEnv(agentPreset?: string): Record<string, string> {
  if (agentPreset !== 'claude-cli' && agentPreset !== 'claude-cli-worktree') return {}
  return claudeUpdateGuardEnv(getRuntimeSettingsSnapshot().mode === 'embedded' ? 'embedded' : 'system')
}
// create(): const updateGuardEnv = claudeCliUpdateGuardEnv(agentPreset)
// 三處 envWithUtf8（Terminal Server / node-pty / child_process）：
        DISABLE_AUTOUPDATER: '1',
        // T0372: embedded claude-cli preset only (DISABLE_UPDATES=1)
        ...updateGuardEnv,
```

**AC-5：`2.1.111` 剩餘命中**

| 命中 | 性質 |
|------|------|
| `electron/claude-resolver.ts:54` `Was 2.1.111 (Opus 4.7 / xhigh, T0165).` | 歷史註解，在新門檻旁註明舊值 |
| `src/types/index.ts:121` `(>= 2.1.111 adds xhigh)` | 歷史事實（xhigh 的引入版本），仍正確 |
| `CLAUDE.md:55` `原 ^2.1.111 / 實裝 2.1.113，T0165 C1.1` | 歷史敘述 |
| `CLAUDE.md:60` `xhigh 需 CLI >= 2.1.111` | 事實陳述（xhigh 最低版本），仍正確 |
| `CLAUDE.md:101` `T0372 前為 2.1.111` | 歷史敘述 |

以下已修正，不再命中：
- `electron/claude-agent-manager.ts` 的 version-warning
- `electron/main.ts:2153` 的 terminal version-warning（D-2）
- 三語 `settings` Claude Runtime `hint`：原文「System 模式可能缺少 2.1.111 之後新增的功能（Opus 4.7 / xhigh effort）」改為「System 模式的 claude 若低於 2.1.280，無法使用 Opus 5.5 等較新模型。」

### 遭遇問題

**範圍偏差（已執行，請塔台確認）**
- **D-1**：`electron/__tests__/claude-runtime-router.test.ts` 與 `tests/claude-resolver.test.ts` 不在 `affects_files`。但工單 Part B 明文要求「若有測試斷言舊門檻，一併更新」與「若既有 router / resolver 測試可擴充，加一個 case」，所以照做。
- **D-2**：`electron/main.ts:2153` 是 `claude:get-cli-path` 給 terminal 用的 `version-warning`，文案與 `claude-agent-manager.ts` 那段相同，但工單只點名後者。門檻改為 2.1.280 後，若留著舊文案，2.1.200 之類的版本會看到「requires >= 2.1.111」，與實際判斷矛盾。因此同步改這 1 行字串，邏輯未動。

**觀察 / 取捨**
- **O-1**（renderer）：產生 hint 的函式在 IPC effect 內取用 `t`，而該 effect 的 deps 只有 `[sessionId]`，寫法與 `CodexAgentPanel` 既有程式相同。執行中切換語系時，提示會維持舊語系，直到 panel 重新掛載。
- **O-2**（terminal 注入缺口，已寫入 CLAUDE.md）：
  1. system 模式但 fallback 到 embedded 的 claude-cli 分頁不會注入：`pty.create` 是同步呼叫，拿不到非同步 fallback 的結果。這種情境仍有 `DISABLE_AUTOUPDATER` 擋住背景更新。
  2. 由 remote `terminal:create-agent-command` 建立（`terminal:create-with-command` 不帶 `agentPreset`）或由 `pty:restart` 重建（既有行為，只帶 id/cwd/type/shell）的分頁不會注入。
  3. PTY env 作用於整個 shell：在 embedded claude-cli 分頁內，對 PATH 上的 system claude 執行 `claude update` 也會被拒。

  若要精準到「只限 embedded 那支 binary」，有兩條路：改 `WorkspaceView.tsx`，讓 renderer 依 `getCliPath` 回傳的 source 自行帶 customEnv；或讓 router 快取最後一次 terminal 解析結果。兩者都超出本單範圍。
- **O-3**（Part C）：按工單規則的字面，`default` 也會被濾掉，因為它的 `resolvedModel` 是帳號預設模型，通常就是某個 builtin。我保留了 `default`，理由是它代表「跟隨預設」，而不是固定模型。若塔台希望一併濾掉，拿掉 `m.value !== 'default'` 條件即可。
- **O-4**：Settings effort 下拉中 `max` 的「(Opus only)」標示（`src/components/SettingsPanel.tsx:595`）已過時。本單只在 CLAUDE.md 註記，UI 不在範圍內，未改。
- **O-5**：依工單規定，沒有跑需要登入的真實回合，錯誤分類只以單元測試證明。BAT 實機 UI 未驗：提示是否正確顯示、下拉是否去重、`close()` 後子行程是否確實結束。
- 建議後續工單：
  - 計價表：`MODEL_PRICING` 補 5 系列，`P()` 加 cache-read 倍率（已記錄於 CLAUDE.md）
  - Settings effort 標示修正
  - 若需補 O-2 缺口，另開小單

### 回報時間

2026-10-04T16:35:02+08:00
