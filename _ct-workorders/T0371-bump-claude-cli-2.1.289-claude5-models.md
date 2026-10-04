---
schema_version: 1
schema_kind: workorder
id: T0371
title: "BUG-084：內嵌 claude-code CLI 2.1.113 → 2.1.289 + Claude 5 模型清單 + getSupportedModels 帶 runtime 路徑"
type: fix
status: PENDING
priority: P1
sizing: S
created_at: "2026-10-04T16:09:22+08:00"
updated_at: "2026-10-04T16:09:22+08:00"
started_at: null
completed_at: null
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

- **狀態**：PENDING
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

### 產出摘要

### 驗收條件逐項

### 遭遇問題

### 回報時間
