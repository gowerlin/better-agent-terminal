---
schema_version: 1
schema_kind: workorder
id: T0367
title: "BUG-083 T-A：Codex 錯誤分類（config 不相容 / CLI 過舊）+ 修正 config 警告誤報為錯誤"
type: fix
status: DONE
priority: P1
sizing: S
created_at: "2026-10-04T15:52:52+08:00"
updated_at: "2026-10-04T15:58:48+08:00"
started_at: "2026-10-04T15:54:49+08:00"
completed_at: "2026-10-04T15:58:48+08:00"
target_version: next
depends_on: []
related:
  - "BUG-083"
  - "T0366（research，`aa970dc`；本單規格依據其「調查結論」H1/H2/H3 與「建議下一步」T-A）"
  - "D121（排序：本單為第 1 張；後續 T-B bump / T-D 模型清單 / T-C 選最新 binary）"
affects_files:
  - electron/codex-agent-manager.ts
  - src/components/CodexAgentPanel.tsx
  - src/lib/codex-error-classify.ts
  - src/lib/__tests__/codex-error-classify.test.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - CHANGELOG.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不升級 `@openai/codex-sdk`、不改 `findCodexBinary()` / `findBundledCodex()` / `CODEX_MODELS`**——那是 T-B / T-C / T-D 的範圍（D121 串行，避免同檔衝突）。"
  - "🔴 **不改 `claude:error` IPC channel 的簽章或語意**——該 channel 與 Claude agent 面板共用。分類放在 renderer 端（純函式 + i18n），main 端只負責「不要把 config 警告當 error 送出」。"
  - "不做 `-c service_tier=...` 之類 config override（D121 明文否決）。"
---

# T0367 — BUG-083 T-A：Codex 錯誤分類 + config 警告誤報修正

- **狀態**：DONE
- **任務類型**：fix
- **工作量預估**：S
- **Context Window 風險**：低

## 背景

T0366 研究（請先讀 `_ct-workorders/T0366-research-bug083-codex-version-skew.md` 回報區「調查結論」）確認三個使用者會看到的「Codex 出錯」現象：

| # | 現象 | 原始錯誤字串（T0366 實測） | 現況 |
|---|------|--------------------------|------|
| 1 | **誤報**：CLI 0.160 對不認得的 config 鍵送 `item.completed` + `item.type="error"` | `Codex is ignoring 1 unrecognized configuration setting. ... \`env\` is ignored.` | `codex-agent-manager.ts:1212-1215` 送 `claude:error` → `CodexAgentPanel.tsx:788-799` 追加紅色 `Error:` 並 `setIsStreaming(false)`，但回合其實仍在跑 |
| 2 | **H3**：內嵌 0.124 讀到新版 Codex 寫入的 `config.toml` 值 | `Codex Exec exited with code 1: Error loading config.toml: unknown variant \`default\`, expected \`fast\` or \`flex\` in \`service_tier\`` | 原樣顯示，使用者不知道怎麼辦 |
| 3 | **H1**：舊 CLI + 新模型 | `The 'gpt-5.6-terra' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again.` | 原樣顯示 |

本單是 D121 的第 1 張（止血），**不涉及升級**。

## 範圍

### Part A — main：config 警告不再當成 error

`electron/codex-agent-manager.ts` `itemType === 'error'` 分支（約 :1212）：

- 訊息（`stringifyCodexError` 後）以 `Codex is ignoring` 開頭 → **不送 `claude:error`**，改 `logger.log(...)` 記錄（帶 session tag）
- 若 Codex 面板已有「非錯誤系統訊息」的既有通道可用，可改走該通道顯示為一般 notice；**沒有就只記 log，不要為此新增 IPC channel**
- 其他 `item.type === 'error'` 行為不變

### Part B — renderer：錯誤分類 + 可操作提示

1. 新增純函式 `src/lib/codex-error-classify.ts`：

   ```ts
   export type CodexErrorKind = 'config-incompatible' | 'cli-too-old' | 'unknown'
   export function classifyCodexError(message: string): { kind: CodexErrorKind; detail?: string }
   ```

   - `config-incompatible`：含 `Error loading config.toml`；`detail` 盡量擷取出問題的鍵名（如 `service_tier`），擷取不到可省略
   - `cli-too-old`：含 `requires a newer version of Codex`；`detail` 擷取模型名（如 `gpt-5.6-terra`）
   - 其餘 `unknown`
   - 比對不分大小寫；不依賴完整字串（OpenAI 改字很頻繁，抓關鍵片語即可）

2. `CodexAgentPanel.tsx` `onError`：保留原始錯誤文字，`kind !== 'unknown'` 時**在其後**追加一段 i18n 提示（同一則 system 訊息或緊接一則，由你決定）。提示內容方向：
   - `config-incompatible`：BAT 目前使用的 Codex 版本讀不懂 `~/.codex/config.toml` 中的設定（`{{key}}`），通常是另裝了較新版 Codex 所致；可升級 BAT，或設定環境變數 `BAT_CODEX_BIN` 指向較新的 `codex` 執行檔
   - `cli-too-old`：模型 `{{model}}` 需要較新的 Codex；可改選其他模型、升級 BAT，或以 `BAT_CODEX_BIN` 指定較新的 `codex`
3. i18n key 三語（`en` / `zh-TW` / `zh-CN`）同步新增，命名沿用該檔既有 Codex 相關 key 的前綴慣例

### Part C — 測試與 CHANGELOG

- `src/lib/__tests__/codex-error-classify.test.ts`：**以上表三個原始字串原文**為 fixture，各至少一個 case；外加大小寫變體、無關錯誤字串 → `unknown`、空字串
- `CHANGELOG.md` `## [Unreleased]` → `### Fixed` 一筆（refs: BUG-083, T0367）

## 明確排除（不要做）

- ❌ 不升 SDK / 不改 binary 解析 / 不改模型清單（見 memory_overrides）
- ❌ 不改 `claude:error` channel 簽章；不新增 IPC channel
- ❌ 不碰 `~/.codex/`、不跑真實 codex 回合（本單用單元測試證明即可）
- ❌ 不碰 `AGENTS.md`（既有 dirty）
- ❌ 不 push、不 bump 版號

## 驗收條件

- [ ] AC-1 `npm run test:unit` 全綠，基線 **550** 提升（新增 cases 全過）
- [ ] AC-2 `npx vite build` 成功
- [ ] AC-3 單元測試涵蓋背景表三個原始字串原文，分別得到 `unknown`（#1 不經 renderer，但仍應被分類為 `unknown` 或不觸發提示）、`config-incompatible`（detail=`service_tier`）、`cli-too-old`（detail=`gpt-5.6-terra`）
- [ ] AC-4 `codex-agent-manager.ts` 的 `Codex is ignoring` 分支不再呼叫 `this.send('claude:error', ...)`（回報區貼 diff 片段）
- [ ] AC-5 三個 locale 檔新增的 key 集合完全相同（回報區列出 key 名）
- [ ] AC-6 `git diff --stat` 僅動 `affects_files`（`CodexAgentPanel.tsx` 既有 tsc baseline error 屬 BUG-061，不要求修，但**不得新增** tsc error：改動前後 `npx tsc --noEmit 2>&1 | grep -c "error TS"` 比對，貼數字）

## Sub-session 執行指示

1. 讀取本工單 + T0366 回報區「調查結論」
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 先跑 `npx tsc --noEmit 2>&1 | grep -c "error TS"` 記下基線
4. 實作 Part A → B → C
5. 跑 AC-1 ~ AC-6
6. 填寫回報區、更新 `status` / `completed_at` / `updated_at`
7. commit（`git commit --only` 指定實際改動的 affects_files），訊息建議：`fix(codex): classify config/version errors; stop treating config warnings as errors (T0367)`
8. 依派發 mode 通知塔台（`bat-notify.mjs`；YOLO 依 ct-exec 規則帶 `--submit`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ DONE — AC-1 ~ AC-6 全數 PASS（source / unit / tsc / build lane）。runtime smoke 未跑（工單明文排除跑真實 codex 回合），面板實際呈現待 BUG-083 驗收時真人確認。

**Landing Zone Check**：WARN
- C-0：frontmatter `repo` = absent → WARN「repo identity unavailable」；observed `basename(REPO_ROOT)` = `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：PASS（工單位於 `REPO_ROOT/_ct-workorders/`）
- C-3：PASS（`electron/codex-agent-manager.ts`、`src/components/CodexAgentPanel.tsx` 存在；新檔 `src/lib/...` 祖先 `src/lib/` 存在）
- C-2：工單無 `branch` 欄位，N/A（HEAD = `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（evidence only）
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

**Part A — main**（`electron/codex-agent-manager.ts` `item.completed` / `itemType === 'error'` 分支）
- 訊息 `trim()` 後以 `Codex is ignoring` 開頭（不分大小寫）→ `logger.log(\`${stag} Codex config warning (not an error): ...\`)`，**不送 `claude:error`**
- 既有非錯誤通道可用：`addMessage()`（`role: 'system'` → `claude:message`，與 `sys-init` / worktree 提示同通道），renderer `onMessage` 對一般 system 訊息只 append、不動 `isStreaming` ⇒ 以 `⚠️ <原文>` 顯示為 notice。**每 session 只顯示一次**（以內容比對 `session.state.messages` 去重，因 0.160 每回合開頭都會送一次）
- 其他 `item.type === 'error'` 行為不變；未新增 IPC channel

**Part B — renderer**
- 新增 `src/lib/codex-error-classify.ts`：`classifyCodexError(message)` → `{ kind: 'config-incompatible' | 'cli-too-old' | 'unknown', detail? }`
  - `config-incompatible`：`/error loading config\.toml/i`；`detail` 先抓 `` in `<key>` ``，再抓 `` unknown|missing|invalid|duplicate field|key `<key>` ``，都沒有則省略
  - `cli-too-old`：`/requires a newer version of codex/i`；`detail` 抓引號包住（`'` `"` `` ` `` 與彎引號）或裸字的模型名
  - 空字串 / 非字串 → `unknown`
- `CodexAgentPanel.tsx` `onError`：保留 `Error: <原文>`，`kind !== 'unknown'` 時同一則 system 訊息後接 `\n\n💡 <i18n 提示>`；有 `detail` 用帶參數 key，無則用 `*Generic` key

**Part C**
- `src/lib/__tests__/codex-error-classify.test.ts`：11 cases（T0366 三個原文 fixture、大小寫變體、`unknown field` 寫法、裸字 / 雙引號模型名、detail 擷取不到、無關錯誤〔含 T0366 附帶發現的 `not supported when using Codex with a ChatGPT account`〕、空字串）
- `CHANGELOG.md` `## [Unreleased]` → `### Fixed` 新增一筆（refs: BUG-083, T0367）

**改動檔案**：`electron/codex-agent-manager.ts`、`src/components/CodexAgentPanel.tsx`、`src/lib/codex-error-classify.ts`（新）、`src/lib/__tests__/codex-error-classify.test.ts`（新）、`src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`、`CHANGELOG.md`、本工單

### 驗收條件逐項

| AC | 結果 | 證據 |
|----|------|------|
| AC-1 | ✅ PASS | `npm run test:unit` → `Test Files 42 passed (42)`、`Tests 561 passed (561)`；基線 550 → 561（+11 = 新檔 11 cases） |
| AC-2 | ✅ PASS | `npx vite build` exit 0（renderer `✓ built in 4.59s`，electron main/preload 皆 built） |
| AC-3 | ✅ PASS | #1 `Codex is ignoring 1 unrecognized ...` → `{ kind: 'unknown' }`；#2 `Codex Exec exited with code 1: Error loading config.toml: ... in \`service_tier\`` → `{ kind: 'config-incompatible', detail: 'service_tier' }`；#3 `The 'gpt-5.6-terra' model requires a newer version of Codex. ...` → `{ kind: 'cli-too-old', detail: 'gpt-5.6-terra' }` |
| AC-4 | ✅ PASS | diff 片段見下 |
| AC-5 | ✅ PASS | 三語 `claude.*` 新增 key 集合相同：`codexErrorHintConfigIncompatible`、`codexErrorHintConfigIncompatibleGeneric`、`codexErrorHintCliTooOld`、`codexErrorHintCliTooOldGeneric`（插在既有 `claude.codexModelChangeWarning` 之後；`i18n-completeness.test.ts` 同在 AC-1 全綠內） |
| AC-6 | ✅ PASS | `git diff --stat` 僅 affects_files + 本工單（`AGENTS.md` 為既有 dirty，未動、不入 commit）；`npx tsc --noEmit 2>&1 \| grep -c "error TS"`：改動前 **42** → 改動後 **42**；去除行列號後兩份 error 清單逐行相同（無新增） |

AC-4 diff 片段：

```diff
             } else if (itemType === 'error') {
               const errMsg = stringifyCodexError(item?.message ?? item?.error)
-              this.send('claude:error', sessionId, errMsg)
+              if (/^codex is ignoring/i.test(errMsg.trim())) {
+                // BUG-083: newer Codex CLIs report unrecognized config keys as item.type="error"
+                // while the turn keeps running. Treat as a notice, not claude:error (which ends streaming).
+                logger.log(`${stag} Codex config warning (not an error): ${errMsg}`)
+                const notice = `⚠️ ${errMsg}`
+                // Shown once per session; the warning repeats at the start of every turn.
+                if (!session.state.messages.some(m => (m as ClaudeMessage).content === notice)) {
+                  this.addMessage(sessionId, { id: `sys-codex-notice-${itemId}-${Date.now()}`, sessionId, role: 'system', content: notice, timestamp: Date.now() })
+                }
+              } else {
+                this.send('claude:error', sessionId, errMsg)
+              }
             }
```

**Commit**：`c6214c2` `fix(codex): classify config/version errors; stop treating config warnings as errors (T0367)`（未 push）

### 遭遇問題

- 無阻塞。
- 設計取捨（供塔台參考）：notice 去重以「內容相同」判斷，`MSG_BUFFER_CAP` 截斷後可能再顯示一次，屬可接受。
- 未涵蓋（範圍外，屬 T-C）：`config-incompatible` 時自動改用其他候選 binary 重試；`cli-too-old` 提示中顯示目前 codex 版本 / 來源（需 T-C 的 `--version` 偵測）。
- `turn.failed` 與頂層 `error` 事件仍照舊送 `claude:error`（分類在 renderer 端套用，兩條路徑都會得到提示）。

### 回報時間

2026-10-04T15:58:04+08:00
