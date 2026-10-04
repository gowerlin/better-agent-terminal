---
schema_version: 1
schema_kind: workorder
id: T0373
title: "BUG-083 T-C：Codex binary 改為「選版本最新者」+ 版本 notice + effort 依模型自動校正"
type: fix
status: PENDING
priority: P2
sizing: M
created_at: "2026-10-04T16:36:37+08:00"
updated_at: "2026-10-04T16:36:37+08:00"
started_at: null
completed_at: null
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

- **狀態**：PENDING
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

### 產出摘要

### 驗收條件逐項

### 遭遇問題

### 回報時間
