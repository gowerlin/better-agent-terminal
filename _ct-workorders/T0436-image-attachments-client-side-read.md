---
schema_version: 1
schema_kind: workorder
id: T0436
title: "BUG-108：Claude 面板圖片附件改由 client 端讀取（拖放 FileReader、clipboard:saveImage 回 data URL、對話框選圖本機讀），不再走 proxied image:read-as-data-url"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-108
priority: P1
sizing: M
created_at: "2026-10-05T05:51:45+08:00"
started_at: null
updated_at: "2026-10-05T05:51:45+08:00"
completed_at: null
target_version: next
depends_on:
  - T0435
related:
  - "BUG-108；T0421 研究回報區盤點表 #3 / #4 與拆單第 2 列"
  - "D134 追加（T0421 拆單）"
affects_files:
  - src/components/ClaudeAgentPanel.tsx
  - src/components/CodexAgentPanel.tsx
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/protocol.ts
  - electron/remote/headless-channel-status.ts
  - electron/remote/path-aware-channels.ts
  - src/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **第一步先重現**本機貼圖附件是否失敗（`os.tmpdir()` 不在工作區白名單 → `Path access denied`）：以單元測試或 `path-guard` 直接驗證，回報區附結論。若本機其實沒壞，仍做遠端部分（遠端讀錯檔案系統是確定的）。"
  - "🔴 **安全**：新增或修改的 channel 不可變成任意本機讀檔口。偏好 `clipboard:saveImage`（或新 channel）直接回 `clipboard.readImage().toDataURL()`、拖放在 renderer 以 `FileReader` 讀；對話框選圖由 main 在對話框回傳後直接讀並回 data URL（路徑來自 main 自己的對話框，不接受 renderer 傳入任意路徑）。新 channel 必須列入 ALWAYS_LOCAL 並通過 T0416 / T0422 全分類守門。"
  - "🔴 檔案樹 / `PathLinker` 的圖片**預覽**維持 proxied `image:read-as-data-url`（讀遠端工作區檔案是正確行為），不要改。"
  - "🔴 依賴 T0435（同改 `ClaudeAgentPanel.tsx` / `preload.ts`）。T0431 可能平行改 `main.ts` / `protocol.ts` / `headless-channel-status.ts` / `path-aware-channels.ts`：開工前 `git status` 看這些檔是否 dirty；commit 前 `git diff <file>` 確認只含本單 hunk，混有他人改動不 commit 該檔，等對方 commit 或回報。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0436 — 圖片附件 client 端讀取（BUG-108）

## 範圍

1. 重現（memory_overrides 第 1 條）
2. 三個圖片附件來源改 client 端取得 data URL：拖放、剪貼簿貼上、對話框選圖（Claude 面板；Codex 面板若共用同機制一併）
3. 附件路徑不再呼叫 `image:read-as-data-url`
4. 測試：三來源各自產生 data URL 附件；新 channel 為 ALWAYS_LOCAL；不接受任意路徑

## 驗收條件

- [ ] 回報區附重現結論
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39（T0435 後基線）
- [ ] 回報區附實機步驟（本機與 WSL 遠端視窗：拖放 / 貼上 / 對話框各附一張圖並送出）
- [ ] BUG-108 改 `FIXED`

## Sub-session 執行指示
1. 讀本工單 + BUG-108 + T0421 回報區（盤點表 #3 / #4）+ T0435 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 重現 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + BUG-108；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
