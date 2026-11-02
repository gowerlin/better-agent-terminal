---
schema_version: 1
schema_kind: bug
id: BUG-195
title: "單元測試 `worktree-status-after-close.test.ts` 在整套 `test:unit` 的負載下偶發 5 s 逾時"
status: OPEN
severity: low
reproducibility: frequent
created_at: "2026-11-02T14:39:02+0800"
updated_at: "2026-11-02T15:28:49+0800"
impact:
  - tests
links:
  discovered_in: "T0780 回報〈驗證〉（第 1 次）、塔台 0.7.3-pre.6 聯合驗證 @ `7063f11e`（第 2 次）"
  related: [T0589, T0780, T0782, T0686]
---
# BUG-195 — `worktree-status-after-close.test.ts` 在整套測試負載下偶發逾時

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響測試；產品行為無關。CI Test gate（T0686）若遇到會擋發版，重跑即過） |
| 可重現 | 偶發：2026-11-02 兩次（全套平行負載下）；單檔與重跑全套都通過 |
| **狀態** | 📂 OPEN（後續待辦，短期不排；再擋到 CI 時優先處理） |
| 回報者 | 塔台（T0780 Worker 首次記錄；第二次出現依「再發生才開單」開單） |

## 現象

- 測試：`electron/__tests__/worktree-status-after-close.test.ts` › `worktree:terminal-status after the tab closed — real PtyManager + git (T0589)` › `live → exited → git (registered) → removed (branch only) → branch gone NOT_FOUND`
- 錯誤：`Error: Test timed out in 5000ms.`（實際 5093 ms）
- 預期：與單獨跑時一樣在約 3 s 內通過。

## 發生紀錄

| 時間 | 情境 | 結果 |
|---|---|---|
| 2026-11-02 約 14:12 | T0780 Worker 跑 `npm run test:unit`（全套） | 逾時 1 次；單檔重跑 3/3 過、第二次全套 6705 passed |
| 2026-11-02 約 14:37 | 塔台 `0.7.3-pre.6` 聯合驗證 @ `7063f11e`（同時有 T0781 Worker 並行研究） | 逾時 1 次（5093 ms）；單檔重跑 3/3 過（2.97 s）、第二次全套 382 files / 6705 passed |
| 2026-11-02 約 15:10 | T0784 Worker 第 1 次全套（`ct/T0784` @ `1bfa3b36`，同時有對話框探測腳本） | 逾時（6511 ms）；單檔 3/3 過 |
| 2026-11-02 約 15:15 | T0784 Worker 第 2 次全套（無其他工作，但機器上約 25 個其他 session 的 node / claude 程序） | 逾時（5926 ms）；這支 `vi.mock('electron')`、在 Node 執行，與 Electron 升級無關 |

## 推論（未驗證）

- 測試用真的 git 與 `PtyManager`（spawn shell、git worktree 操作），全套平行執行時 CPU / 磁碟競爭讓總時間超過 vitest 預設 5 s。兩次都在機器同時有其他工作時發生。
- 方向（擇一，開單時決定）：替這個測試設較長的 timeout（例 15–20 s）；或把它移到單獨執行的群組；或找出最慢的步驟縮短。🔴 不得為了縮短等待改產品常數（CLAUDE.md「多 remote profile 同時連線」節同理）。

## 處置

- 目前不擋 `0.7.3-pre.6`（兩次重跑都綠）。CI 若被它擋下：重跑該 job，並把本單排進下一批修正。

## 2026-11-02 塔台補記（第一百零五 session）

- 一天內 4 次（2 次在無其他工作時），頻率比開單時高，`reproducibility` 改 `frequent`。CI Test gate（T0686）擋發版的機率不低，建議排進下一批修正（不等再擋到 CI）。
