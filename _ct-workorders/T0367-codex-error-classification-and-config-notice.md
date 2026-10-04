---
schema_version: 1
schema_kind: workorder
id: T0367
title: "BUG-083 T-A：Codex 錯誤分類（config 不相容 / CLI 過舊）+ 修正 config 警告誤報為錯誤"
type: fix
status: PENDING
priority: P1
sizing: S
created_at: "2026-10-04T15:52:52+08:00"
updated_at: "2026-10-04T15:52:52+08:00"
started_at: null
completed_at: null
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

- **狀態**：PENDING
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

### 產出摘要

### 驗收條件逐項

### 遭遇問題

### 回報時間
