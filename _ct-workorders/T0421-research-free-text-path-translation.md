---
schema_version: 1
schema_kind: workorder
id: T0421
title: "研究：遠端視窗自由文字中的 client 路徑（拖放檔案、prompt 內路徑、貼上、comment body 等）—— 盤點出現點、轉換策略、拆單"
type: research
status: PENDING
repo: better-agent-terminal
project: BUG-105
priority: P2
sizing: M
created_at: "2026-10-05T05:35:22+08:00"
started_at: null
updated_at: "2026-10-05T05:35:22+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "BUG-105 / T0416 回報區「遺留：自由文字中的路徑（另案）」"
  - "T0416 盤點表（`PATH_ARG_SCHEMA` / `PATH_FREE_CHANNELS`；`github:*-comment` body 刻意不轉）"
  - "D134（本 session 排程表第 5 列）"
affects_files:
  - _ct-workorders/T0421-research-free-text-path-translation.md
interaction:
  mode_hint: yolo
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究單不改產品程式碼**。只寫本工單回報區。"
  - "🔴 不部署、不改 WSL。可在本機以 vitest 片段或 node REPL 驗證 `PathTranslator` 行為，但不得留下產品檔案改動。"
  - "🔴 同工作樹有其他 Worker 平行在改 `electron/` / `src/`：本單只讀。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0421 — 研究：自由文字中的 client 路徑

## 背景

T0416 讓 108 個 proxied channel 的**結構化**路徑參數全部依 schema 轉換（WSL：`\\wsl.localhost\<distro>\…` ↔ `/…`、`C:\…` ↔ `/mnt/c/…`；SSH：home 對應）。但遠端視窗中仍有路徑以**自由文字**形式流向遠端，translator 不會碰：

- 推測場景：拖放檔案到終端 / Claude 面板（插入的是本機 `C:\…` 路徑）、Claude 面板附件 / 圖片路徑、使用者在 prompt 裡貼路徑、`pty:write` 的輸入、`github:*-comment` body、snippet 內容、檔案樹「複製路徑」、「在終端開啟」等

## 研究目標

1. **盤點**：遠端視窗中所有「本機路徑以文字形式產生並送往遠端」的出現點（附 `檔案:行`）；區分 (a) BAT 自己產生的路徑文字（拖放、複製路徑、附件）與 (b) 使用者手打的文字
2. **每個出現點的正確行為**：轉成 server 形式 / 不轉 / 不可轉（例如 `C:\` 下但不在 `/mnt/c` 掛載的路徑、SSH 非 home 路徑）時的 UX（提示、拒絕、上傳？）
3. **策略比較**：在產生點轉（renderer 已知是遠端視窗 + 有 translator）vs 在 channel 層掃描文字（風險：誤轉一般文字）vs 混合；明確建議**不**對使用者手打文字做自動改寫，除非有充分理由
4. **與檔案傳輸的邊界**：拖放本機檔案到遠端 Claude 面板時，是否需要把檔案內容傳到遠端（例如圖片附件走 data URL 已無路徑問題？）——只盤點與建議，不設計傳輸協定
5. **拆單建議**（D 區段表格）

## 互動規則

- 允許向使用者提問（`CT_INTERACTIVE=1` 時），最多 3 題，選項式（例如：拖放本機但遠端不可達的檔案時要提示還是上傳）
- 不互動時：給推薦 + 理由

## 回報要求

回報區須含：
- 盤點表（出現點 / 來源 / 目前行為 / 建議行為 / 理由）
- 策略比較與推薦
- `### 拆單建議摘要` 段落，第一個表格欄位必須為 `| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |`（標題欄先用「工單 1」等占位，塔台會補 T####）

## Sub-session 執行指示
1. 讀本工單 + BUG-105 + T0416 回報區 + `electron/remote/path-aware-channels.ts` / `path-translator.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 調查 → 填回報區；完成寫 **`DONE`**
4. `git commit --only` 本工單；不 push
5. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 拆單建議摘要

### 遭遇問題

### 回報時間
