---
schema_version: 1
schema_kind: workorder
id: T0355
title: Fix BUG-080 — Claude customPath 白名單校驗 + fail-closed/fallback 行為
type: fix
status: IN_PROGRESS
sizing: S
created_at: "2026-05-15T12:30:00+08:00"
started_at: "2026-05-15T12:30:23+08:00"
updated_at: "2026-05-15T12:30:23+08:00"
renew_count: 0
workdir: main repo
affects_files:
  - electron/claude-resolver.ts
  - electron/claude-runtime-router.ts
  - electron/__tests__/claude-runtime-router.test.ts
  - src/components/settings/ClaudeRuntimeSection.tsx
  - _ct-workorders/T0355-*.md
  - _ct-workorders/BUG-080-*.md
---
# T0355 — Fix BUG-080 customPath 白名單校驗 + fail-closed/fallback 行為

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0355 |
| 類型 | fix（main process validation + UI 同步校驗 + tests） |
| 所屬 | BUG-080 — `resolveClaudeBaseCommand` shell quoting hardening |
| 狀態 | 🚧 IN_PROGRESS |
| 開始時間 | 2026-05-15T12:30:23+08:00 |
| Sizing | S（main process validation + unit tests）；若補 UI 即時校驗與 i18n 為 M |
| 依賴 | T0354 D 區決策 / `electron/gh-resolver.ts isSafeCustomPath()` 樣板 / PR #18 已合入（`238ac3d`） |
| 後續 | T0356（shell-aware quoting）依賴本工單先行 |
| 互動旗標 | `--mode ask`（白名單規則細節可能需澄清） |
| Renew 次數 | 0 |
| 工作目錄 | main repo |

## 背景

PR #18（`238ac3d`）已合入 `electron/resolve-claude-base-command.ts`，把 BAT remote / `bat-terminal.mjs` auto-session 的 `claude-cli` 派發從硬編碼 `'claude'` 改用 `resolveClaudeRuntime()` 拿到 customPath。但 helper 用雙引號 `"${resolved.path}"` 包路徑，若 customPath 含 shell metachar 仍會在 PTY bash 內被展開（BUG-080）。

T0354 研究結論：**選項 3（白名單校驗）+ 選項 2 窄版（shell-aware quoting）** 組合。本工單做選項 3，立即降低所有 shell family 的 metachar 風險，且不依賴 shell-aware command rendering 即可獨立交付。

## 任務

### 階段 1：實作白名單校驗

#### 1.1 新增 helper `isSafeClaudeCustomPath(path: string): boolean`

位置：`electron/claude-resolver.ts`（與 `detectSystemClaude` 同檔，便於就近使用）。

**規則**（與 T0354 B 區一致）：

- ✅ 必須是 absolute path（POSIX `/...` 或 Windows `<letter>:\...` 或 UNC `\\...`）
- ❌ 拒絕 control chars（包含 CR `\r`、LF `\n`、NUL `\0`、tab 以外的 `\x00-\x1F`、`\x7F`）
- ❌ 拒絕 shell metachar：`$`、backtick `` ` ``、`;`、`|`、`&`、`>`、`<`、`*`、`?`
- ❌ 拒絕 cmd-specific：`%`、`!`
- ❌ 拒絕單引號 `'`（第一版保守處理）
- ✅ 允許字元集：`[A-Za-z0-9 ._\-:()+/\\@]`
- ✅ 長度限制：1-4096 chars

可參考 `electron/gh-resolver.ts isSafeCustomPath()` 的實作風格。

#### 1.2 在 `claude-runtime-router.ts` 整合

在 `resolveClaudeRuntime()` 內，呼叫 `detectSystemClaude(customPath)` 之前先過 `isSafeClaudeCustomPath()`：

- **不安全 customPath**：
  - `fallbackToEmbedded: true` → 降級 embedded，回傳 `ResolvedRuntime { source: 'embedded', healthStatus: 'degraded', degradedReason: 'unsafe-custom-path' }`
  - `fallbackToEmbedded: false` → throw `SystemClaudeUnsafePathError`（新 error class，與既有 `SystemClaudeUnavailableError` 同模式）

#### 1.3 Toast / UI 通知

renderer 端 `ClaudeRuntimeSection.tsx`：

- customPath input field 加同步 validation（用同一個 helper，從 main process expose 給 renderer，或 renderer 端複寫純函式版本）
- validation 失敗時 input 下方顯示錯誤訊息：「路徑含不安全字元（$、` `、;、| 等），請改用純路徑」
- 提交設定時若 main process 回 degraded → toast 提示「customPath 含不安全字元，已降級使用 embedded」

### 階段 2：補測試

#### 2.1 Unit test `electron/__tests__/claude-runtime-router.test.ts`

新增 cases：

| Case | customPath | fallback | 預期 |
|------|-----------|----------|------|
| safe path | `/usr/local/bin/claude` | any | resolve system |
| metachar `$` | `/home/$USER/claude` | true | degraded embedded |
| metachar `$` | `/home/$USER/claude` | false | throw `SystemClaudeUnsafePathError` |
| metachar backtick | `` /tmp/`whoami`/claude `` | true | degraded |
| metachar `;` | `/tmp/x;rm -rf /` | true | degraded |
| metachar `\|` | `/tmp/a\|b/claude` | true | degraded |
| metachar `%` | `C:\Users\%USERNAME%\claude.exe` | true | degraded |
| metachar `!` | `/home/u!evil/claude` | true | degraded |
| control char `\r` | `/tmp/a\rb/claude` | true | degraded |
| relative path | `./claude` | true | degraded |
| empty string | `` | true | resolve embedded（既有行為，不算 unsafe） |
| safe Windows | `C:\Users\u\claude.exe` | any | resolve system |
| safe space | `/Applications/My Tools/claude` | any | resolve system |
| safe UNC | `\\server\share\claude.exe` | any | resolve system |

#### 2.2 Helper unit test

獨立測 `isSafeClaudeCustomPath()` 純函式行為，至少 20 個 cases 涵蓋每個拒絕字元 + 每類 absolute path 形式。

### 階段 3：驗證

- `npm run test:unit -- claude-runtime-router` 全綠
- `npx vite build` 無錯（確認 type 一致）
- 手動觸發：在 settings.json 寫入含 `$` 的 customPath，重啟 BAT，確認：
  - `fallbackToEmbedded: true` 看到 degraded toast + embedded 啟動
  - `fallbackToEmbedded: false` 看到 error UI（不崩潰）

## 約束

- ✅ 修改 `electron/claude-resolver.ts`、`electron/claude-runtime-router.ts`、`electron/__tests__/claude-runtime-router.test.ts`、`src/components/settings/ClaudeRuntimeSection.tsx`
- ✅ 可新增 `SystemClaudeUnsafePathError` class
- ❌ 不改 `electron/resolve-claude-base-command.ts`（其 quoting 問題由 T0356 處理）
- ❌ 不改 `WorkspaceView.startClaudeCliPty()`（T0356 處理）
- ❌ 禁用 `child_process.exec` 模板字串呼叫（CLAUDE.md 規定）
- ✅ 遵循「No Regressions Policy」：跑 `npx vite build` + `npm run test:unit` 驗證

## 交付物

回報區包含：

1. **變更摘要**：每個檔案的 diff 重點（每檔 ≤5 行說明）
2. **測試結果**：`npm run test:unit -- claude-runtime-router` 輸出 N passed
3. **build 結果**：`npx vite build` 輸出（PASS / 警告）
4. **手動驗證紀錄**：兩個 fallback 模式各跑一次的觀察
5. **commit hash**：建議 squash 成單一 commit `fix(claude-runtime): validate customPath against shell metachar (BUG-080)`
6. **BUG-080 狀態更新**：FIXING → 驗收後可進 VERIFY

## 驗收

塔台收到回報後：

1. 確認 unit test 全綠 + build 通過
2. 派驗收方式三選一（[1] 直接 CLOSED / [2] 進 VERIFY 等 runtime smoke / [3] 派 AI 驗收工單）
3. BUG-080 待 T0356 完成後一併 CLOSED（或本工單獨立 partial CLOSED 視驗收結果）

---

（以下為 Worker 回報區）

## Worker 回報

### 完成狀態

FIXED — 修復已完成，等待驗收。

### 變更摘要

- `electron/claude-resolver.ts`：新增 `isSafeClaudeCustomPath()`，限制 absolute path、長度、control chars、shell/cmd metachar 與允許字元集。
- `electron/claude-runtime-router.ts`：在 `detectSystemClaude()` 前 fail-closed；unsafe customPath + fallback enabled 時降級 embedded，fallback disabled 時丟 `SystemClaudeUnsafePathError`。
- `electron/__tests__/claude-runtime-router.test.ts`：新增 router 與 helper tests，覆蓋 POSIX/Windows/UNC safe path、metachar/control char/relative path 與 fallback true/false。
- `src/components/ClaudeRuntimeSection.tsx`：customPath input 同步顯示 unsafe path validation，並阻止 unsafe path 寫回設定。
- `src/hooks/useRuntimeToasts.ts`、`src/types/*`、`electron/preload.ts`、`src/locales/*.json`：補齊 `unsafe-custom-path` degraded reason 型別與三語 toast/UI 文案。
- `_ct-workorders/BUG-080-*.md`：狀態同步為 FIXING，關聯 T0354/T0355/T0356。

### 測試結果

- `npm run test:unit -- claude-runtime-router`：PASS，1 test file / 48 tests passed。
- `npm run test:unit`：PASS，35 test files / 435 tests passed。

### Build 結果

- `npx vite build`：PASS。
- Build warning：既有 chunk size / dynamic import chunking warnings；本工單新增一則 `claude-resolver.ts` dynamic+static import chunking warning，屬 Vite chunking 提示，不影響 build。

### 手動驗證紀錄

- `fallbackToEmbedded: true`：以 unit test 模擬 `/home/$USER/claude` 等 unsafe customPath，確認不呼叫 detector、回傳 embedded fallback，`degraded.reason = unsafe-custom-path`。
- `fallbackToEmbedded: false`：以 unit test 模擬 unsafe customPath，確認不呼叫 detector、丟出 `SystemClaudeUnsafePathError`。
- GUI 重啟 smoke 未在本 Worker session 執行；建議塔台驗收時用 Settings 寫入含 `$` 的 customPath 做一次 runtime smoke。

### 遭遇問題

- 工單點名的 `electron/__tests__/claude-runtime-router.test.ts` 原本不存在，已新增。
- Repo 內未找到 `LEAN-CTX.md`；本次依使用者提供的 AGENTS 指令、`CLAUDE.md` 與工單內容執行。
- BAT session 缺 `CT_MODE` 與 `BAT_TOWER_TERMINAL_ID`，收尾通知會走剪貼簿 fallback。

### 互動紀錄

無。

### Renew 歷程

無。

### Commit

待 commit。

### 回報時間

2026-05-15T12:35:54+08:00
