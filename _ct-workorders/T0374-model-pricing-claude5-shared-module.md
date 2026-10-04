---
schema_version: 1
schema_kind: workorder
id: T0374
title: "BUG-084 後續：計價表抽共用模組 + Claude 5 系列 + cache-read 倍率 + Settings effort 標示"
type: fix
status: PENDING
priority: P2
sizing: S
created_at: "2026-10-04T16:46:35+08:00"
updated_at: "2026-10-04T16:46:35+08:00"
started_at: null
completed_at: null
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

- **狀態**：PENDING
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

### 產出摘要

### 驗收條件逐項

### 遭遇問題

### 回報時間
