---
schema_version: 1
schema_kind: workorder
id: T0374
title: "BUG-084 後續：計價表抽共用模組 + Claude 5 系列 + cache-read 倍率 + Settings effort 標示"
type: fix
status: DONE
priority: P2
sizing: S
created_at: "2026-10-04T16:46:35+08:00"
updated_at: "2026-10-04T16:51:24+08:00"
started_at: "2026-10-04T16:47:52+08:00"
completed_at: "2026-10-04T16:51:24+08:00"
target_version: next
depends_on:
  - T0372
  - T0373
related:
  - "BUG-084"
  - "T0368（research `22e8ddc`；第 4 節價格表含官方出處，本單價格**只能**取自該表）"
  - "T0372（`79c349e`；回報區 O-4：Settings `max (Opus only)` 標示過時）"
  - "T0373（`3d52a1d`；回報區「遭遇問題 3」：CodexAgentPanel 既有兩處 TS2345）"
affects_files:
  - src/lib/model-pricing.ts
  - src/lib/__tests__/model-pricing.test.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/components/CodexAgentPanel.tsx
  - src/components/SettingsPanel.tsx
  - CLAUDE.md
  - CHANGELOG.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **價格只能取自 T0368 回報區第 4 節表格**（附官方 URL）；不得憑記憶新增或修改任何價格。表內沒有的模型維持現狀。"
  - "🔴 既有 4.x / 3.x 模型的價格與判斷順序**行為不得改變**（抽模組是重構，用單元測試鎖住既有 ID → 價格的對應）。"
  - "🔴 不新增 OpenAI / Codex 模型價格（無官方來源；Codex 面板維持現有行為，只改為引用共用模組）。"
  - "不 push、不 bump 版號、不碰 `AGENTS.md`。"
---

# T0374 — 計價表共用模組 + Claude 5 系列 + cache-read 倍率

- **狀態**：DONE
- **任務類型**：fix（重構 + 資料）
- **工作量預估**：S
- **Context Window 風險**：低

## 背景

- `MODEL_PRICING` 在 `ClaudeAgentPanel.tsx:3608` 起與 `CodexAgentPanel.tsx`（約 :3990）各有一份複本
- `P()` 寫死 `cacheRead: input * 0.1`；T0368 查得 **Opus 5.5 為 0.05x、Fable 5.1 為 0.025x**（舊算法會高估 2x / 4x）
- Claude 5 系列 ID 目前不命中任何規則 → 成本顯示 `—`
- `SettingsPanel.tsx:595` effort 下拉 `max` 顯示「(Opus only)」——T0368：2.1.289 對 Sonnet 5.5 / Fable 5.1 / Opus 5.5 的 `supportedEffortLevels` 皆含 `max`，標示過時

## 範圍

### Part A — `src/lib/model-pricing.ts`（新）

1. 搬出 `P()`、`MODEL_PRICING`、`getModelPricing(model)`；`P(input, output, opts?: { cacheReadMultiplier?: number })`，預設 0.1（既有行為不變）
2. 依 T0368 第 4 節新增：

   | key | 價格 | cache read |
   |-----|------|-----------|
   | `opus-5-5` | P(4, 20) | 0.05x |
   | `fable-5-1` | P(10, 50) | 0.025x |
   | `sonnet-5-5` | P(2, 10) | 0.1x |
   | `opus-5` / `opus-4-8` | P(5, 25) | 0.1x |
   | `sonnet-5` | P(2, 10) | 0.1x |
   | `fable-5` | P(10, 50) | 0.1x |

   cache write（5m / 1h）沿用 `P()` 既有倍率（1.25x / 2x）——**先核對 T0368 表中 5 系列的 cache write 數字與此倍率一致**（例：Opus 5.5 $5 / $8 = 4×1.25 / 4×2 ✓）；不一致時以表為準並為該項加 override
3. `getModelPricing()` 判斷順序：**`opus-5-5` 必須在 `opus-5` 之前、`fable-5-1` 在 `fable-5` 之前**（`includes` 前綴陷阱）；4.x 判斷順序不變
4. 單元測試：
   - 既有每個 ID 樣本（從現有規則反推至少 10 個，如 `claude-opus-4-7`、`claude-opus-4-6[1m]`、`claude-sonnet-4-6`、`claude-haiku-4-5-20251001`、`claude-3-opus...`）→ 價格與重構前**完全相同**（重構前先寫測試、跑綠，再搬）
   - 新增 5 系列：`claude-opus-5-5`、`claude-opus-5-5[1m]`、`claude-fable-5-1`、`claude-sonnet-5-5`、`claude-opus-5`、`claude-opus-4-8`、`claude-fable-5`、`claude-sonnet-5`
   - cache read 倍率：Opus 5.5 = 0.2、Fable 5.1 = 0.25

### Part B — 兩個面板改用共用模組

- `ClaudeAgentPanel.tsx`、`CodexAgentPanel.tsx` 刪除內嵌複本，改 import；成本計算公式其餘部分不動
- 順手（T0373 建議）：`CodexAgentPanel.tsx` 既有兩處 `getSupportedModels(...).then((models: ModelInfo[]) => ...)` 改為 T0373 的 `result as ModelInfo[] | undefined` 寫法，消除 TS2345（預期 tsc 42 → 40；若數字不同如實回報）

### Part C — Settings effort 標示

- `SettingsPanel.tsx:595` 一帶：移除 `max` 的「(Opus only)」後綴。若周邊有其他寫死「Opus only」的提示文字（含 locale），一併檢查並在回報區列出處理方式

### Part D — 文件

- `CLAUDE.md`「Claude Agent SDK / CLI」節中 T0372 寫入的「`MODEL_PRICING` 尚未收錄 5 系列 / `P()` cache read 倍率問題」改為已處理的描述（指向 `src/lib/model-pricing.ts`）；effort 段「max (Opus only) 已過時」同步改為已修正
- `CHANGELOG.md` `## [Unreleased]` → `### Fixed` 一筆（refs: BUG-084, T0374）

## 明確排除（不要做）

- ❌ 不新增 OpenAI 模型價格；不改成本顯示 UI 版面
- ❌ 不改 `EFFORT_LEVELS` / `CODEX_EFFORT_LEVELS`
- ❌ 不 push、不 bump 版號、不碰 `AGENTS.md`

## 驗收條件

- [ ] AC-1 `npm run test:unit` 全綠，基線 **635** 提升；既有 ID 價格鎖定測試全過
- [ ] AC-2 `npx vite build` 成功；tsc error 數 ≤ 42（預期 40，貼前後數字）
- [ ] AC-3 `grep -n "const MODEL_PRICING" src/components` → 0 筆（只剩 `src/lib/model-pricing.ts`）
- [ ] AC-4 回報區附 5 系列價格與 T0368 表逐列對照
- [ ] AC-5 `git diff --stat` 僅動 `affects_files`

## Sub-session 執行指示

1. 讀取本工單 + T0368 回報區第 4 節
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 記錄 tsc 基線；**先寫既有 ID 價格鎖定測試並跑綠**
4. Part A → B → C → D
5. 跑 AC-1 ~ AC-5
6. 填寫回報區、更新 `status`（**完成請寫 `DONE`**）/ `completed_at` / `updated_at`
7. commit（`git commit --only` 指定實際改動檔），訊息建議：`fix(pricing): shared model-pricing module with Claude 5 models and per-model cache-read rates (T0374)`
8. 依派發 mode 通知塔台（`bat-notify.mjs`；YOLO 依 ct-exec 規則帶 `--submit`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — Part A ~ D 全數完成，AC-1 ~ AC-5 全 PASS。

**Landing Zone Check：WARN（可繼續）**
- C-0：frontmatter 無 `repo` 欄位（`absent`）→ WARN「repo identity unavailable」；觀察到 `basename(REPO_ROOT)` = `better-agent-terminal`，REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`
- C-1：PASS（工單位於 REPO_ROOT 下）
- C-3：PASS（`src/lib/model-pricing.ts` 等 5 筆可測項的最近祖先 `src/lib/` / `src/components/` 皆存在；`CLAUDE.md` 存在）
- C-2：工單無 `branch` 欄位，N/A（實際 `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

**Part A — `src/lib/model-pricing.ts`（新，58 行）**
- 匯出 `ModelPricing` interface、`P(input, output, opts?: { cacheReadMultiplier?: number })`（預設 0.1，cache write 1.25x / 2x 不變）、`MODEL_PRICING`、`getModelPricing(model): ModelPricing | null`
- 執行順序依工單：**先**把兩個面板的內嵌邏輯逐字搬入模組 + 寫 legacy 鎖定測試 → 跑綠（29/29）→ **再**加 5 系列（38/38）
- 5 系列判斷排在 4.x 之前，順序 `opus-5-5` → `opus-5` → `opus-4-8` → `fable-5-1` → `fable-5` → `sonnet-5-5` → `sonnet-5`；4.x / 3.x 判斷式與順序完全未動。已確認既有 4.x / 3.x ID 不含任何 5 系列子字串（如 `opus-4-5` 不含 `opus-5`），前插不改變既有命中

**`src/lib/__tests__/model-pricing.test.ts`（新，38 tests）**
- `P()` 預設倍率與 `cacheReadMultiplier` 2 筆
- legacy 鎖定 21 個 ID（opus 4-7 / 4-7[1m] / 4-6 / 4-6[1m] / 4-5-dated / 4-1-dated / 4-20250514 / 4-0 / 4 / 3-opus；sonnet 4-6 / 4-6[1m] / 4-5-dated / 4-20250514 / 4-0 / 3-7 / 3-5；haiku 4-5-20251001 / 4-5 / 3-5 / 3）全部 5 個欄位逐一比對 + 6 個未知 ID → `null`（`default` / `opus` / `sonnet` / `gpt-5-codex` / `o3` / 空字串）
- 5 系列 8 個 ID（含 `claude-opus-5-5[1m]`）全 5 欄位比對 + point release 不被 base model 遮蔽 1 筆

**Part B — 面板改用共用模組**
- `ClaudeAgentPanel.tsx`：刪除內嵌 `P` / `MODEL_PRICING` / `getModelPricing`（-26 行），加 `import { getModelPricing } from '../lib/model-pricing'`；成本計算其餘公式未動
- `CodexAgentPanel.tsx`：同上（-27 行），`ReturnType<typeof P>` 改為 `ModelPricing`（型別等價）；`import { getModelPricing, type ModelPricing }`
- `CodexAgentPanel.tsx` 兩處 `getSupportedModels(sessionId).then((models: ModelInfo[]) => ...)` 改為 T0373 寫法 `.then(result => { const models = result as ModelInfo[] | undefined ... })`，消除 2 個 TS2345

**Part C — Settings effort 標示**
- `SettingsPanel.tsx:595`：`{level}{level === 'max' ? ' (Opus only)' : ''}` → `{level}`
- 周邊檢查：`src/locales/{en,zh-TW,zh-CN}.json` 的 `settings.defaultEffort` / `defaultEffortHint` 皆無 Opus 限定字樣，無需改。`src/` 全域 grep `Opus only` 只此一處
- ⚠️ 範圍外未改：`src/types/index.ts:122` 註解「`max` maps to Opus-only extended thinking budget」同樣過時，但該檔不在 `affects_files`（且工單排除改 `EFFORT_LEVELS`），留給塔台決定（見遭遇問題 1）

**Part D — 文件**
- `CLAUDE.md`「Claude Agent SDK / CLI」節：`MODEL_PRICING` 尚未收錄 / `P()` 倍率問題段改為描述 `src/lib/model-pricing.ts` 現況與「point release 排在 base model 之前」規則；effort 段改為「不再標示 (Opus only)（T0374 移除）」
- `CHANGELOG.md` `## [Unreleased]` → `### Fixed` 新增一筆 `fix(pricing): ...`（refs: BUG-084, T0374）

**異動檔案**：`src/lib/model-pricing.ts`（新）、`src/lib/__tests__/model-pricing.test.ts`（新）、`src/components/ClaudeAgentPanel.tsx`、`src/components/CodexAgentPanel.tsx`、`src/components/SettingsPanel.tsx`、`CLAUDE.md`、`CHANGELOG.md`、本工單

### 驗收條件逐項

- [x] **AC-1 PASS** — `npm run test:unit`：47 files / **673 passed**（基線 635 → 673，+38 = 本單新增測試數）；legacy 鎖定 21 ID 全過
- [x] **AC-2 PASS** — `npx vite build` exit 0（renderer `✓ built in 4.54s`、electron 各 entry 皆 built）。`npx tsc --noEmit | grep -c "error TS"`：改動前 **42** → 改動後 **40**；去除行號後 diff 只少了 `CodexAgentPanel.tsx` 兩筆 `TS2345: Argument of type '(models: ModelInfo[]) => void' ...`（及其附帶說明行），無新增錯誤
- [x] **AC-3 PASS** — `grep -rn "const MODEL_PRICING" src/components` → **0 筆**；全 `src` 僅剩 `src/lib/model-pricing.ts:20`
- [x] **AC-4 PASS** — 5 系列與 T0368 第 4 節逐列對照（來源 ③ `https://platform.claude.com/docs/en/about-claude/pricing`，2026-10-04 擷取）：

  | key | T0368 Input / Output | 本單 | T0368 5m / 1h write | 本單（1.25x / 2x） | T0368 cache read | 本單 | 一致 |
  |-----|---------------------|------|---------------------|-------------------|------------------|------|------|
  | `opus-5-5` | $4 / $20 | P(4, 20) | $5 / $8 | 5 / 8 | $0.20（0.05x） | 4 × 0.05 = 0.2 | ✅ |
  | `fable-5-1` | $10 / $50 | P(10, 50) | $12.50 / $20 | 12.5 / 20 | $0.25（0.025x） | 10 × 0.025 = 0.25 | ✅ |
  | `sonnet-5-5` | $2 / $10 | P(2, 10) | $2.50 / $4 | 2.5 / 4 | $0.20（0.1x） | 0.2 | ✅ |
  | `opus-5` / `opus-4-8` | $5 / $25 | P(5, 25) | $6.25 / $10 | 6.25 / 10 | $0.50 | 0.5 | ✅ |
  | `sonnet-5` | $2 / $10 | P(2, 10) | $2.50 / $4 | 2.5 / 4 | $0.20 | 0.2 | ✅ |
  | `fable-5` | $10 / $50 | P(10, 50) | $12.50 / $20 | 12.5 / 20 | $1（0.1x） | 1 | ✅ |
  | `haiku-4-5`（既有，對照） | $1 / $5 | P(1, 5)（未改） | $1.25 / $2 | 1.25 / 2 | $0.10 | 0.1 | ✅ |

  cache write 全部與 `P()` 既有 1.25x / 2x 倍率一致，**無需 override**。每一列皆有對應單元測試鎖定全部 5 欄位。
- [x] **AC-5 PASS** — `git diff --stat` / `git status`：除本單 `affects_files` 7 檔 + 本工單外，唯一其他異動為 `AGENTS.md`——為**開工前即存在**的使用者未提交變更（gitStatus 快照 `M AGENTS.md`），本單未觸碰，commit 以 `--only` 排除

### 遭遇問題

1. **範圍外過時註解（未改，交塔台）**：`src/types/index.ts:122` 註解 `// \`max\` maps to Opus-only extended thinking budget; \`xhigh\` is the newest tier.` 與 T0368 結論不符。該檔不在 `affects_files`，依範圍守則不動；建議下次碰 `src/types/index.ts` 時順手改。
2. 無其他阻礙。未 push、未 bump 版號、未碰 `AGENTS.md`；未新增 OpenAI / Codex 模型價格。

### 回報時間

- started_at：2026-10-04T16:47:52+08:00
- 回報完成：見 frontmatter `completed_at`
- commit：與本回報同一個 commit（`git log --grep T0374`）
