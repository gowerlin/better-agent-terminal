---
schema_version: 1
schema_kind: workorder
id: T0708
title: "BUG-172：指揮塔面板讀檔失敗（含 File too large）時顯示錯誤，不再靜默變空或讓工單消失"
type: implementation
status: PENDING
repo: better-agent-terminal
project: ""
priority: P2
sizing: S
created_at: "2026-10-29T09:46:36+0800"
depends_on: []
related:
  - "BUG-172（現象、根因、各 loader 行號）"
  - "BMad-Guide 塔台 ADVISORY 2026-10-29（CT D408，`memory-protocol.md` § BAT 塔台面板讀取契約：熱檔預算 400 KB，BAT 讀取上限 512 KiB）"
  - "T0701（總覽的讀取路徑已會顯示 `File too large`，`electron/handlers/ct-config.ts:50`）"
  - "`src/components/FileTree.tsx:39` / `PathLinker.tsx:220` 既有的 `File too large (<n>KB)` 顯示寫法"
affects_files:
  - src/components/ControlTowerPanel.tsx
  - "ControlTowerPanel 內畫臭蟲／待辦／決策／工單清單的子元件（若錯誤需在子元件顯示）"
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json（`controlTower.*` 讀取錯誤 key）"
  - "src/components/__tests__/（新測試或既有 ControlTowerPanel 測試補項）"
  - _ct-workorders/T0708-fix-bug172-ct-panel-file-too-large.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍：只改 renderer 的顯示。`fs:readFile`（`electron/handlers/fs.ts`）的 512 KiB 上限與回傳形狀**不改**（共用 handler）；不改 `electron/**`、CLAUDE.md、`src/types/backlog.ts`、`src/types/bug-tracker.ts`（T0709 同時在改）。"
  - "🔴 行為：區分「檔案不存在」與「讀取失敗」。`readFile` 回 `error`（`File too large` 帶 `size`，或其他錯誤）時：臭蟲／待辦／決策頁顯示錯誤訊息（含檔名；`File too large` 另含 KB 數），不是空清單；工單清單中讀取失敗的工單仍列出（狀態 `UNKNOWN`、可辨識為讀取失敗），不得消失。epics、sprint yaml、歸檔工單／BUG／PLAN 也用同樣規則，若改動成本明顯偏高可只做主要四處並在回報區列出未處理的位置與理由。待辦補優先級讀 PLAN 檔失敗時維持現狀（保留原 entry），不另顯示。"
  - "🔴 檔案不存在（`Failed to read file` 且檔案確實不存在、或專案沒有該檔）時維持現在的空清單行為，不要對沒有 `_backlog.md` 的專案顯示錯誤；判斷方式自行決定（例如先 `fs:stat` 或依既有 readdir 結果），回報區寫明。"
  - "🔴 文字一律 i18n（三個 locale），沿用 `controlTower.*` 命名慣例；不寫死中文。"
  - "🔴 驗證：RTL 測試模擬 `readFile` 回 `{ error: 'File too large', size }`：三頁顯示錯誤、工單清單仍有該工單；檔案不存在時三頁仍是空清單、無錯誤。`npm run test:unit` 全綠、`npm run typecheck` = 0、`npx vite build` 成功。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。T0709 同時在 repo 內工作：只 commit 本單 `affects_files`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。工單完成狀態寫 `DONE`（不要寫 FIXED，那是 BUG 單狀態）；BUG-172 單與 `_bug-tracker.md` 由塔台更新，不要改。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。yolo：不得問使用者，判讀問題問塔台（每輪最多 3 題）。"
---

# T0708 — BUG-172：指揮塔面板讀檔失敗時顯示錯誤

## 背景

CT 檔案超過 512 KiB 時，`fs:readFile` 回 `File too large`、沒有內容。總覽（T0701）會顯示錯誤，但臭蟲、待辦、決策三頁變成空清單，超大的工單直接從清單消失，使用者會以為「沒有東西」。詳見 BUG-172。

## 實作

1. `ControlTowerPanel.tsx` 各 loader 區分「不存在」與「讀取失敗」，讀取失敗時保存錯誤狀態。
2. 三頁顯示錯誤訊息；工單清單保留讀取失敗的工單。
3. 三個 locale 補 key。
4. RTL 測試。

## 驗收

- [ ] 臭蟲／待辦／決策頁在 `File too large` 時顯示錯誤（含檔名、KB 數），不是空清單
- [ ] 讀取失敗的工單仍出現在清單中
- [ ] 檔案不存在時行為不變（空清單、無錯誤）
- [ ] 文字走 i18n（三個 locale）
- [ ] `npm run test:unit` 全綠；`npm run typecheck` = 0；`npx vite build` 成功

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策（僅 yolo Worker 有問題時）

### 互動紀錄

### 完成狀態

### 實作摘要

### 驗證證據

### 遭遇問題

### Commit

### 回報時間
