---
schema_version: 1
schema_kind: workorder
id: T0416
title: "BUG-105：proxied channel 路徑轉換全面盤點——claude:* / github:* / git-scaffold:* / worktree:* 等補 path-aware schema，加守門測試要求每個 proxied channel 都有明確路徑分類"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-105
priority: P1
sizing: M
created_at: "2026-10-05T04:37:14+08:00"
target_version: next
depends_on:
  - T0405
related:
  - "BUG-105；T0405 回報區「遭遇問題」2；BUG-065 / T0301（path-aware schema 由來）"
  - "T0393（WSL 工作區資料夾預設 / `/mnt/c` 提示）；T0397 E4"
  - "T0406（排在本單之後：也要改 `path-aware-channels.ts` 加 `workspace:sync-roots`）"
affects_files:
  - electron/remote/path-aware-channels.ts
  - electron/remote/path-translator.ts
  - electron/remote/remote-client.ts
  - electron/remote/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認現況再改**：第一步要以程式碼證據回答「WSL / SSH 遠端視窗的工作區資料夾實際存的是 client 形式（`\\\\wsl.localhost\\…` / `C:\\…`）還是 server 形式（`/home/…`）」，以及各面板送出 cwd 的來源。若結論是遠端視窗一律存 server 形式、實際不會壞，回報區寫明證據並把本單降為「只加守門測試 + 補 schema 以防未來」，仍可 DONE。"
  - "🔴 **回傳值轉換要逐一判斷**：例如 `claude:get-cli-path` 回的是要打進**遠端終端**的 server 路徑，**不可**轉成 client 形式；`worktree:create` 回的 worktree 路徑是否要轉，依呼叫端用途決定。每個決定寫進回報區表格。"
  - "🔴 本機（非遠端）視窗行為不得改變：translator 只在遠端連線時套用（沿用既有機制）。"
  - "🔴 不得部署到 WSL（轉換在 client / main 端，不需重新部署 server）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0416 — proxied channel 路徑轉換盤點（BUG-105）

## 元資料
- **工單編號**：T0416
- **任務名稱**：path-aware 覆蓋補齊 + 守門
- **狀態**：PENDING
- **建立時間**：2026-10-05 04:37 (UTC+8)
- **intervention_type**：context-dependent（需要時可問使用者一次：例如實機上工作區資料夾長什麼樣）

## 背景

`electron/remote/path-aware-channels.ts` 的 `PATH_AWARE_CHANNELS` / schema（BUG-065 / T0301）只涵蓋 `fs:*`、`git:*`（7 個）、`pty:create` / `pty:restart`、`image:read-as-data-url`；`PATH_RETURNING_CHANNELS` 有 `fs:readdir` / `fs:search` / `git:getRoot` / `pty:get-cwd`。PLAN-036 之後上線 headless 的 `claude:*`（T0401，例如 `claude:start-session` 的 cwd）、`github:*` / `git-scaffold:*` / `worktree:*`（T0405）都沒有登錄 ⇒ 遠端視窗的 client 形式路徑會原樣送到 Linux server。WSL 實機 smoke 11/11 都直接用 server 路徑，所以測不到這個問題。

## 範圍

1. **現況確認**（見 memory_overrides 第 1 條）：WSL / SSH 遠端視窗的 workspace folder 形式、各面板（Claude、Git、GitHub、Git Graph、worktree）送出路徑的來源
2. **盤點表**：`PROXIED_CHANNELS` 每個 channel → 參數中的路徑位置（第幾個參數 / 物件欄位）、回傳值是否含路徑、決定（轉 / 不轉 / 理由）
3. **補 schema**：必要時新增 schema 型別（例如「第 N 個字串」、「物件的指定欄位」），沿用 `PathTranslator`；`PATH_RETURNING_CHANNELS` 依盤點表補（含 `claude:get-cli-path` 不轉的明確標註）
4. **守門測試**：每個 `PROXIED_CHANNELS` channel 必須出現在「path-aware（含 schema）」或「明確無路徑（附理由）」其中一張表，新增 channel 未分類即 CI 紅；`workspace:sync-roots` 等 T0406 會新增的 channel 由 T0406 自行分類
5. **轉換測試**：以 WSL translator（`\\wsl.localhost\Ubuntu-24.04\home\x` ↔ `/home/x`，以及 `C:\Users\x` ↔ `/mnt/c/Users/x`）對新登錄的每個 channel 斷言轉換結果；本機視窗不轉

## 驗收條件

- [ ] 回報區附現況結論（含程式碼證據）與盤點表
- [ ] 守門測試與轉換測試綠
- [ ] `npm run test:unit` 全綠（基線 1675）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed
- [ ] 回報區附使用者實機步驟（WSL 遠端視窗：用 `\\wsl.localhost\…` 與 `C:\…` 兩種工作區各開 Claude 面板與 Git Graph）

## Sub-session 執行指示
1. 讀本工單 + BUG-105 + `electron/remote/path-aware-channels.ts` / `path-translator.ts` / `remote-client.ts`（轉換套用點）+ `electron/remote/protocol.ts` + T0393 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 現況確認 → 盤點 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 現況結論

### 盤點表

### 產出摘要

### 使用者實機步驟

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 回報時間
