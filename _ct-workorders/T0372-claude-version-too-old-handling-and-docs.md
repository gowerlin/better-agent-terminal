---
schema_version: 1
schema_kind: workorder
id: T0372
title: "BUG-084 後續：claude_code_version_too_old 錯誤分類 + HEALTHY_MIN 2.1.280 + embedded DISABLE_UPDATES + 模型下拉去重 + CLAUDE.md 更新"
type: fix
status: PENDING
priority: P1
sizing: S
created_at: "2026-10-04T16:24:08+08:00"
updated_at: "2026-10-04T16:24:08+08:00"
started_at: null
completed_at: null
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

- **狀態**：PENDING
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

### 產出摘要

### 驗收條件逐項

### 遭遇問題

### 回報時間
