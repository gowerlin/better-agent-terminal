---
schema_version: 1
schema_kind: bug
id: BUG-201
title: "`dev-deploy-headless.test.mjs` 的 `main()` 測試共用 `dist-server/dev-deploy-headless` 輸出目錄：兩個 `test:unit` 同時跑時互相覆蓋（`EPERM` / `ENOENT` / `Build failed`）"
status: FIXING
severity: low
reproducibility: rare
created_at: "2026-11-03T00:01:46+0800"
updated_at: "2026-11-03T00:03:22+0800"
impact:
  - test-infra
links:
  discovered_in: "T0794 回報區〈範圍外的失敗〉"
  related: [BUG-200, BUG-195, T0794, T0786, T0391, T0434]
---
# BUG-201 — dev-deploy-headless 測試共用輸出目錄

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響測試；產品行為無關。同一 checkout 有兩個 Worker 各自跑 `test:unit` 時會撞到） |
| 可重現 | 只在兩個 `npm run test:unit` 同時跑：T0794 兩套並行 2 次中 1 次；修改前（`pre-b2`）與量測中（`trc-b`）也出現過；單一 `test:unit`（CI）3 次都沒有 |
| **狀態** | 🔧 FIXING（T0795） |
| 回報者 | 塔台（T0794 Worker 首次記錄） |

## 現象

- 預期：兩個 `test:unit` 同時跑（例：同一 checkout 並行的兩個 Worker 各自驗證）都 exit 0。
- 實際：`scripts/__tests__/dev-deploy-headless.test.mjs` › `main() dry-run never writes` 的 `deploy dry-run builds into staging …` 或 `T0434: --yes deploys JS + helpers …` 失敗，錯誤 `EPERM, Permission denied` / `ENOENT` / `Build failed`，路徑在 `dist-server/dev-deploy-headless`。

## 判斷

- 兩套 vitest 同時 build 到同一個固定輸出目錄、互相覆蓋。不是逾時，與負載高低無關（BUG-195 / 199 / 200 是逾時，這張不是）。
- 本專案常在同一 checkout 並行派兩個 Worker（例：T0792 / T0793），兩邊都跑 `test:unit` 時就會撞到。

## 修正方向

- 讓測試每次執行用獨立的輸出 / staging 目錄（例：`mkdtemp` 後以參數或 env 傳給 `main()`）；若腳本本身沒有可覆寫輸出目錄的入口，加入只供測試用的選項前先確認不改變 `npm run` 的預設行為。

## 處理紀錄

- 2026-11-03 00:01 開單（OPEN，low）。T0794 收單時登記（D237）。
- 2026-11-03 00:03 → FIXING：使用者決定現在修（D238），開 T0795（P2，S）：staging 根目錄可由呼叫端覆寫，測試用自己的暫存目錄；預設行為不變。
