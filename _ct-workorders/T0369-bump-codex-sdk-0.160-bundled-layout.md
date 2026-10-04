---
schema_version: 1
schema_kind: workorder
id: T0369
title: "BUG-083 T-B：@openai/codex-sdk 0.124 → 0.160 + 內嵌 binary 解析相容新目錄結構"
type: fix
status: PENDING
priority: P1
sizing: M
created_at: "2026-10-04T15:59:25+08:00"
updated_at: "2026-10-04T15:59:25+08:00"
started_at: null
completed_at: null
target_version: next
depends_on:
  - T0367
related:
  - "BUG-083"
  - "T0366（research `aa970dc`；回報區「Q3 升到 0.160 的影響範圍」為本單規格依據，請先讀）"
  - "D121（排序：本單為第 2 張）"
  - "T0367（`c6214c2`，已改 `codex-agent-manager.ts` 的 error 分支——本單在其之上繼續改）"
affects_files:
  - package.json
  - package-lock.json
  - electron/codex-agent-manager.ts
  - electron/codex-bundled-path.ts
  - electron/__tests__/codex-bundled-path.test.ts
  - CHANGELOG.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不能只 bump**：0.160 平台套件改為 `vendor/<triple>/bin/codex(.exe)`，BAT 的 `findBundledCodex()`（`codex-agent-manager.ts:135-152`）寫死 `vendor/<triple>/codex/<exe>`，只 bump 會讓內嵌 binary 找不到。解析邏輯必須同 commit 改好。"
  - "🔴 **只動 codex 套件**：不得連帶升級 `@anthropic-ai/*` 或其他依賴（T0368 正在研究 Claude SDK 升級，且讀取主工作樹 `node_modules/@anthropic-ai/*` 做比對）。用 `npm install @openai/codex-sdk@<ver> --save-exact=false` 這類精準指令，完成後 `git diff package-lock.json` 確認只有 `@openai/*` 相關變動。"
  - "🔴 不改 `findCodexBinary()` 的候選優先序（PATH 優先），也不改 `CODEX_MODELS` / effort 清單——分別是 T-C / T-D 的範圍（D121）。"
  - "🔴 不碰 `~/.codex/`；smoke 一律以 scratchpad 的空 `CODEX_HOME` 執行（**不要複製 auth**）。不 push、不 bump BAT 版號。"
---

# T0369 — BUG-083 T-B：Codex SDK 0.124 → 0.160 + 內嵌 binary 解析相容新目錄

- **狀態**：PENDING
- **任務類型**：fix（依賴升級 + 相容層）
- **工作量預估**：M
- **Context Window 風險**：中

## 背景

BUG-083 根因之一是內嵌 Codex 0.124 過舊（T0366 H1/H3）。T0366 已盤點 0.160 的變化（請讀其回報區「Q3」表）：

- `index.d.ts`、事件型別、CLI argv：**無 breaking**（純增量）
- 🔴 **平台套件目錄結構改變**：`vendor/<triple>/bin/codex(.exe)` + `codex-package.json` + `codex-path/`（含 `rg.exe`）+ `codex-resources/`。SDK 自身的 `resolveNativePackage()` 同時支援新舊
- PATH helper：SDK 0.160 只在**未傳 `codexPathOverride`** 時把 `codex-path/` prepend 到子行程 PATH；BAT 一律傳 override ⇒ 需自行 prepend
- 體積：win32-x64 unpackedSize 約 223 → 451 MB（目前 repo `node_modules/@openai/codex-win32-x64` 實測 213 MB）

## 範圍

### Part A — 升級依賴

- `@openai/codex-sdk` → 最新 0.160.x（`npm view @openai/codex-sdk version` 當下值），`package.json` range 改為 `^0.160.x`
- 確認 `@openai/codex` 與本機平台套件 `@openai/codex-win32-x64` 隨之為同版本
- `package-lock.json` 僅 `@openai/*` 相關變動（memory_overrides）

### Part B — 內嵌 binary 解析抽出並相容新舊目錄

1. 把 `findBundledCodex()` 的「給定平台套件根目錄 → binary 路徑」邏輯抽成可測試的純函式，放 `electron/codex-bundled-path.ts`，例如：

   ```ts
   export function resolveBundledCodexLayout(pkgRoot: string, triple: string, exe: string, exists: (p: string) => boolean):
     { binary: string; pathDirs: string[] } | undefined
   ```

   - 先試新結構 `vendor/<triple>/bin/<exe>`，再試舊結構 `vendor/<triple>/codex/<exe>`
   - 新結構時 `pathDirs` 回傳存在的 `vendor/<triple>/codex-path`（實際位置請以 0.160 套件實際目錄為準，**讀 SDK 0.160 `dist/index.js` 的 `resolveNativePackage()` 對照**，不要憑本工單描述推測）
   - `app.asar` → `app.asar.unpacked` 的轉換保留在呼叫端（`findBundledCodex()`）
2. `codex-agent-manager.ts` 的 `findBundledCodex()` 改呼叫此函式；當選到的是**內嵌 binary** 時，把 `pathDirs` prepend 到傳給 SDK 的子行程環境 PATH（用 SDK 0.160 `CodexOptions` 實際提供的 env 機制；請讀 `index.d.ts` 確認欄位名）。選到 PATH / `BAT_CODEX_BIN` 的 binary 時行為不變
3. 若 SDK 0.160 支援 config override（T0366 提到 `CodexOptions.configOverrides` / `config`），帶上 `check_for_update_on_startup=false`（T0366 Q4：成本近零的保險）；不支援就略過並在回報區說明

### Part C — 測試與 CHANGELOG

- `electron/__tests__/codex-bundled-path.test.ts`：以 tmp 目錄（或 fake `exists`）覆蓋：新結構、舊結構、兩者皆無 → `undefined`、新結構有/無 `codex-path`；確認 vitest 設定會收到 `electron/__tests__/`，**若不會被收到**，改放 `src/lib/__tests__/` 並把純函式放 `src/lib/`（同步修正 affects_files 於回報區說明）
- `CHANGELOG.md` `## [Unreleased]`：`### Changed` 一筆（refs: BUG-083, T0369）

## 明確排除（不要做）

- ❌ 不升級 `@openai/*` 以外的依賴
- ❌ 不改 `findCodexBinary()` 優先序、`CODEX_MODELS`、effort 清單、`CodexAgentPanel.tsx`
- ❌ 不改 `package.json` 的 `build.asarUnpack`（`node_modules/@openai/codex-*/**/*` 已涵蓋新目錄；若實測發現不涵蓋，**停下回報**，不要自行改）
- ❌ 不跑 `npm run build` / `build:dir`（會觸發 `fetch:baseline` 下載 ~200 MB，且非本單驗收必要）
- ❌ 不複製 `~/.codex/auth.json`、不碰 `~/.codex/`
- ❌ 不 push、不 bump 版號、不碰 `AGENTS.md`

## 驗收條件

- [ ] AC-1 `node_modules/@openai/codex-sdk`、`@openai/codex`、`@openai/codex-win32-x64` 版本皆為同一 0.160.x；`git diff package-lock.json` 無 `@openai/*` 以外的套件變動（回報區貼 `git diff --stat` 與變動套件清單）
- [ ] AC-2 `npm run test:unit` 全綠，基線 **561** 提升
- [ ] AC-3 `npx vite build` 成功；`npx tsc --noEmit 2>&1 | grep -c "error TS"` 不高於改動前（基線 42，貼前後數字）
- [ ] AC-4 **spawn 路徑 smoke**：以 BAT 實際解析邏輯取得內嵌 binary 路徑（可寫 scratchpad 腳本呼叫 `resolveBundledCodexLayout`），`<binary> --version` 輸出 `codex-cli 0.160.x`；再以 SDK 0.160 `new Codex({ codexPathOverride: <binary>, env: <含 pathDirs 的 env> })` + 空 `CODEX_HOME`（scratchpad）跑一次 `runStreamed()`，預期得到 **CLI 端產生的未登入 / 認證錯誤**（證明 SDK → binary spawn 成功）。貼出輸出
- [ ] AC-5 舊目錄結構相容由單元測試證明（AC-2 內）
- [ ] AC-6 回報區記錄 `du -sh node_modules/@openai/*` 升級前後數字（安裝檔實際大小由下次 CI 發版量測，D121 註記不以 D094 擋單）
- [ ] AC-7 `git diff --stat` 僅動 `affects_files`（若依 Part C 改放 `src/lib/`，於回報區說明）

## Sub-session 執行指示

1. 讀取本工單 + T0366 回報區「Q3」「Q4」段
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 記錄基線：`du -sh node_modules/@openai/*`、`npx tsc --noEmit 2>&1 | grep -c "error TS"`
4. Part A → B → C
5. 跑 AC-1 ~ AC-7
6. 填寫回報區、更新 `status` / `completed_at` / `updated_at`
7. commit（`git commit --only` 指定實際改動檔），訊息建議：`feat(codex): bump codex-sdk to 0.160 and resolve new bundled binary layout (T0369)`
8. 依派發 mode 通知塔台（`bat-notify.mjs`；YOLO 依 ct-exec 規則帶 `--submit`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 驗收條件逐項

### 遭遇問題

### 回報時間
