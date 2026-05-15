---
schema_version: 1
schema_kind: workorder
id: T0353
title: Verify BUG-079 Fix — gh-resolver 落地後的靜態審核（讀取 only）
type: verify
status: PENDING
sizing: S
created_at: "2026-05-15T11:20:00+08:00"
started_at: "2026-05-15T11:24:04+08:00"
updated_at: "2026-05-15T11:24:04+08:00"
renew_count: 0
affects_files:
  - _ct-workorders/T0353-verify-bug079-gh-resolver-fix-static-audit.md
  - _ct-workorders/BUG-079-bat-github-feature-cannot-find-gh-cli.md
---
# T0353 — Verify BUG-079 Fix（gh-resolver 靜態審核）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0353 |
| 類型 | verify（讀取 only：grep + diff 審視 + 邏輯驗證，不改 production code） |
| 所屬 | BUG-079 — BAT GitHub 功能找不到 gh CLI |
| 狀態 | 🔄 IN_PROGRESS |
| 建立時間 | 2026-05-15 11:20 (UTC+8) |
| 開始時間 | 2026-05-15 11:24 (UTC+8) |
| Sizing | S（estimate 15-30 min wall；純靜態審核） |
| 依賴 | T0352 commit `519c567` / `electron/gh-resolver.ts` / `electron/main.ts` / `electron/claude-resolver.ts`（對照樣本） |
| 後續 | PASS → BUG-079 → CLOSED；FAIL → BUG 退回 FIXING，補修工單 |
| 互動旗標 | `--mode on --no-interactive` |
| Renew 次數 | 0 |
| 工作目錄 | main repo（純讀取） |

## 背景

T0352 (commit `519c567`) 完成 A+D+C 滿版修復，384 unit tests 全綠。但 unit tests 主要驗證 gh-resolver 自身邏輯與 i18n 完整性，**未涵蓋**「所有 7 個 IPC handler 是否真的都改用 resolver」、「是否有遺漏的 raw gh 呼叫」、「customPath cache invalidation 邏輯是否正確」等整合性驗證。

本工單做靜態審核補位。

## 驗收項目

### 1. 全 repo 無殘留 raw `gh` 呼叫（最關鍵）

`grep -rn "execFileSync('gh'\|execSync('gh\|execFile.*'gh'\|spawn.*'gh'" electron/ src/`

**期望**：
- 所有 production code 內的 gh 呼叫**全部**用 resolved 變數（如 `resolvedGh`、`ghBinary`）
- 排除合法殘留：`agent-runtime/agent-registry.ts:236` 的 `defaultCommand: 'gh'`（GitHub Copilot CLI agent，不同路徑）
- 測試檔（`*.test.ts`）可保留 `'gh'` 字面（mock 用）

**FAIL 條件**：任一 `github:*` handler 仍寫死 `'gh'` → 報告 file:line

### 2. Handler 對齊驗證

對照 T0351 列出的 7 個 handler，確認每個 handler 都：

| handler | line（舊）| 改動驗證 |
|---------|----------|----------|
| `github:check-cli` | 2590 | 用 resolver；回 `{ installed, authenticated, path?, attemptedPaths?, error? }`；錯誤不被吞掉 |
| `github:pr-list` | 2620 | `execFileSync(resolvedGh, ...)` |
| `github:issue-list` | 2631 | 同上 |
| `github:pr-view` | 2642 | 同上 |
| `github:issue-view` | 2653 | 同上 |
| `github:pr-comment` | 2664 | 同上 |
| `github:issue-comment` | 2675 | 同上 |

**FAIL 條件**：任一 handler 漏改 / schema 不一致 → 報告 file:line

### 3. resolver 邏輯靜態審視

讀 `electron/gh-resolver.ts` 對照 T0352 規格：

- [ ] 解析順序 `customPath → PATH → common locations → where/which`
- [ ] customPath 過 regex 白名單（不允許 shell 注入字元）
- [ ] 用 `execFile` + array args，**無** `child_process.exec` 模板字串
- [ ] `where`/`which` 呼叫有 timeout（建議 ≤3s）
- [ ] 路徑驗證 `existsSync` + `accessSync(path, X_OK)`
- [ ] 回傳 `attemptedPaths` 完整（供 UX 顯示）
- [ ] Windows common locations 至少包含：`C:\Program Files\GitHub CLI\`、`%LOCALAPPDATA%\Programs\GitHub CLI\`
- [ ] macOS/Linux 至少：`/usr/local/bin/gh`、`/opt/homebrew/bin/gh`、`~/.local/bin/gh`
- [ ] D090 合規：resolver 是 `electron/` 下 main-only 檔案，**未**被 renderer 任何檔案 import

`grep -rn "from.*gh-resolver\|require.*gh-resolver" src/`
**期望**：0 hit（renderer 不該 import）

### 4. customPath cache invalidation

讀 settings-store 與 main.ts，確認：

- [ ] 使用者改 `githubCliPath` setting 後，resolver cache 被 invalidate
- [ ] 下次 IPC 呼叫會用新 customPath（不是舊 cache）
- [ ] invalidate 機制：IPC event / store subscribe / 直接呼叫 invalidator

**FAIL 條件**：cache 永久 sticky 直到 BAT 重啟 → 報告位置

### 5. UI / Locale 完整性

- [ ] `GitHubPanel.tsx` 在 check-cli 失敗時顯示：錯誤標題 + `attemptedPaths` 清單 + 安裝連結 + Restart BAT + 指定路徑按鈕
- [ ] `SettingsPanel.tsx` 有 Custom gh path checkbox + path input + Test 按鈕
- [ ] Test 按鈕點擊行為：呼叫 `github:check-cli` 帶 customPath，顯示結果
- [ ] `en.json` / `zh-TW.json` / `zh-CN.json` 對應 key 齊全（grep 對照三檔）
- [ ] 無 i18n key fallback 到 key name（Worker 已跑 `i18n-completeness.test.ts` PASS）

### 6. preload bridge 對齊

- [ ] `electron/preload.ts` 的 `github:check-cli` 回傳 type 與 main.ts 一致
- [ ] `src/types/electron.d.ts` 對應 type 已擴展（含 `path?`、`attemptedPaths?`、`error?`）

## 不在本工單範圍

- 不跑 runtime smoke（4 種 PATH 情境）— 那是使用者驗收範圍
- 不改任何 production code
- 不重跑 unit tests（信任 T0352 的 PASS 紀錄）
- 不審查 `agent-runtime/agent-registry.ts:236` Copilot CLI default（不同路徑）

## 預期產出（回報區）

1. **靜態審核總結**：PASS / FAIL，每項 1 行
2. **殘留 raw `gh` 清單**（若有）：file:line
3. **handler 對齊矩陣**：7 個 handler × `is_using_resolver` + `schema_compliant`
4. **resolver 規格檢查表**：8 個 check 項目 × PASS/FAIL
5. **cache invalidation 驗證**：機制描述 + PASS/FAIL
6. **UI/Locale 檢查**：3 語 key 對齊狀況 + 4 個 UI 元件存在性
7. **建議**：
   - PASS → 建議塔台 mark BUG-079 → CLOSED
   - FAIL → 列出修補項目，建議塔台派補修工單

## 回報區

### 完成狀態

DONE — 靜態審核已完成；審核結論為 **FAIL**，建議 BUG-079 退回 FIXING，補修 i18n key 對齊問題。

### 靜態審核總結

| 項目 | 結果 | 摘要 |
|------|------|------|
| 1. 全 repo raw `gh` 呼叫 | PASS | `electron/` + `src/` production raw `gh` 呼叫搜尋 0 hit；合法殘留僅 `electron/agent-runtime/agent-registry.ts:236 defaultCommand: 'gh'`，屬 GitHub Copilot CLI agent。 |
| 2. Handler 對齊 | PASS | 7 個 `github:*` handler 都透過 `resolveConfiguredGh()` / `resolveGhForRequest()` 後使用 `execFileSync(resolved.path, ...)`。 |
| 3. resolver 規格 | PASS | resolver 順序、customPath 白名單、`execFileSync` array args、3s timeout、executable 驗證、attemptedPaths、common locations、main-only import 均符合。 |
| 4. customPath cache invalidation | PASS | `settings:save` 偵測 `githubCliPath` 變更後清掉 `cachedGhResolveResult`，下一次 IPC 會重新 resolve。 |
| 5. UI / Locale 完整性 | FAIL | UI 元件存在；但 `zh-CN.json` 少 6 個 `github.*` keys，且 `GitHubPanel.tsx` 有實際引用，會造成 zh-CN fallback 風險。 |
| 6. preload bridge 對齊 | PASS | `preload.ts` 與 `src/types/electron.d.ts` 的 `github.checkCli` type 均含 `path?`、`source?`、`attemptedPaths?`、`error?`。 |

### 殘留 raw `gh` 清單

- production code raw `gh` IPC/handler 呼叫：無。
- 合法排除：`electron/agent-runtime/agent-registry.ts:236` 的 `defaultCommand: 'gh'`，不是 GitHub PR / Issue panel 路徑。
- resolver fallback 內部命令：`electron/gh-resolver.ts:109` 使用 `execFileSync(command, ['gh'], ...)` 呼叫 `where.exe` / `which`，屬 resolver 規格允許路徑。

### handler 對齊矩陣

| handler | is_using_resolver | schema_compliant | evidence |
|---------|-------------------|------------------|----------|
| `github:check-cli` | PASS | PASS | `electron/main.ts:2618-2662`：呼叫 `resolveGhForRequest(customPath)`；回傳 `{ installed, authenticated, path?, source?, attemptedPaths?, error? }`。 |
| `github:pr-list` | PASS | PASS | `electron/main.ts:2677-2686`：`resolveConfiguredGh()` + `execFileSync(resolved.path, ['pr', 'list', ...])`。 |
| `github:issue-list` | PASS | PASS | `electron/main.ts:2689-2698`：`resolveConfiguredGh()` + `execFileSync(resolved.path, ['issue', 'list', ...])`。 |
| `github:pr-view` | PASS | PASS | `electron/main.ts:2701-2710`：`resolveConfiguredGh()` + `execFileSync(resolved.path, ['pr', 'view', ...])`。 |
| `github:issue-view` | PASS | PASS | `electron/main.ts:2713-2722`：`resolveConfiguredGh()` + `execFileSync(resolved.path, ['issue', 'view', ...])`。 |
| `github:pr-comment` | PASS | PASS | `electron/main.ts:2725-2734`：`resolveConfiguredGh()` + `execFileSync(resolved.path, ['pr', 'comment', ...])`。 |
| `github:issue-comment` | PASS | PASS | `electron/main.ts:2737-2746`：`resolveConfiguredGh()` + `execFileSync(resolved.path, ['issue', 'comment', ...])`。 |

### resolver 規格檢查表

| check | 結果 | evidence |
|-------|------|----------|
| 解析順序 `customPath -> PATH -> common locations -> where/which` | PASS | `electron/gh-resolver.ts:129-150`。 |
| customPath regex 白名單 | PASS | `electron/gh-resolver.ts:41-43`，要求 absolute path 且拒絕 shell metacharacters。 |
| 用 `execFile` / array args，無 shell 模板字串 | PASS | `electron/gh-resolver.ts:109-113` 使用 `execFileSync(command, ['gh'], ...)`。 |
| `where` / `which` timeout <= 3s | PASS | `RESOLVE_TIMEOUT_MS = 3000` at `electron/gh-resolver.ts:19`；呼叫點 `:111`。 |
| `existsSync` + `accessSync(path, X_OK)` | PASS | `electron/gh-resolver.ts:46-55`。 |
| 回傳 `attemptedPaths` 完整 | PASS | `pushAttempt()` 去重；PATH、common、where/custom 均寫入 attemptedPaths。 |
| Windows common locations | PASS | `electron/gh-resolver.ts:74-82` 含 Program Files、LOCALAPPDATA Programs、Program Files (x86)。 |
| macOS / Linux common locations | PASS | `electron/gh-resolver.ts:84-95` 含 `/usr/local/bin/gh`、`/opt/homebrew/bin/gh`、`~/.local/bin/gh`。 |
| D090 main-only import | PASS | `src/` 無 `gh-resolver` import；只有 `electron/main.ts` 與 `electron/__tests__/gh-resolver.test.ts` import。 |

### cache invalidation 驗證

PASS。`SettingsPanel.tsx` 透過 `settingsStore.setGithubCliPath()` 更新 setting；`settings-store.ts:372-375` 會 `save()`；`electron/main.ts:2001-2010` 的 `settings:save` handler parse persisted settings，當 `githubCliPath` 與 `cachedGhCustomPath` 不同時清掉 `cachedGhResolveResult` 並重置 `cachedGhCustomPath`。後續 `github:*` IPC 走 `resolveConfiguredGh()`，會用新 customPath 重新 resolve。

### UI / Locale 檢查

UI 元件存在性：

- PASS：`GitHubPanel.tsx:270-289` 顯示錯誤標題、錯誤文字、`attemptedPaths`、Install GitHub CLI、Restart BAT、Set custom path。
- PASS：`SettingsPanel.tsx:1030-1070` 有 Custom gh path checkbox、path input、Test button、測試結果 hint。
- PASS：`SettingsPanel.tsx:304-321` Test button 呼叫 `window.electronAPI.github.checkCli(settings.githubCliPath?.trim() || undefined)` 並顯示結果。
- PASS：`en.json` / `zh-TW.json` / `zh-CN.json` 的 `settings.githubCli.*` keys 對齊。

Locale key 對齊：

- FAIL：`zh-CN.json` 缺少 `github.addComment`、`github.commentError`、`github.commentPosted`、`github.copyGitHubLink`、`github.openInGitHub`、`github.submitComment`。
- Evidence：`GitHubPanel.tsx:237`、`:240`、`:325`、`:329`、`:486`、`:499` 實際引用上述 keys；`en.json` 與 `zh-TW.json` 有這 6 個 keys，`zh-CN.json` 無。

### preload bridge 對齊

PASS。`electron/preload.ts:383` 與 `src/types/electron.d.ts:188` 的 `github.checkCli(customPath?: string)` 回傳型別一致，均含 `path?`、`source?`、`attemptedPaths?`、`error?`。

### 遭遇問題

- 未找到 `LEAN-CTX.md`：依 AGENTS 的 `@LEAN-CTX.md` 嘗試於鄰近路徑搜尋，未命中；本工單仍可依 workorder 與 `ct-exec` skill 執行。
- repo 進入工單前已有既存 dirty/untracked 檔：`BUG-079-bat-github-feature-cannot-find-gh-cli.md`、`T0352-fix-bug079-gh-resolver-and-custom-path-and-error-ux.md`、`AGENTS.md`、`T0353...md`。本次只修改 `T0353` 工單檔。

### 互動紀錄

無。

### Renew 歷程

無。

### 建議

FAIL -> 建議塔台將 BUG-079 退回 FIXING，派補修工單補齊 `src/locales/zh-CN.json` 的 6 個 `github.*` keys，並重跑 i18n completeness / 相關 lint。

### 產出摘要

- 修改：`_ct-workorders/T0353-verify-bug079-gh-resolver-fix-static-audit.md`
- production code：未修改
- 驗證方式：靜態 grep、diff/line review、JSON key 對照
- commit：待收尾 commit 後回填
- 回報時間：2026-05-15 11:25 (UTC+8)

---

**派發指令**：在新 sub-session 輸入 `/ct-exec T0353`
