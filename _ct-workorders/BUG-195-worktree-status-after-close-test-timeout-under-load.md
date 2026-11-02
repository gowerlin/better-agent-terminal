---
schema_version: 1
schema_kind: bug
id: BUG-195
title: "真 git / 真子程序的單元測試在整套 `test:unit` 負載下逾時 5 s（`worktree-status-after-close.test.ts` 等 4 檔）"
status: CLOSED
severity: low
reproducibility: frequent
created_at: "2026-11-02T14:39:02+0800"
updated_at: "2026-11-02T17:16:58+0800"
fixed_at: "2026-11-02T17:16:58+0800"
closed_at: "2026-11-02T17:37:52+0800"
closed_reason: verified
fix_commit:
  - 8de128de
  - 121df3e2
impact:
  - tests
links:
  discovered_in: "T0780 回報〈驗證〉（第 1 次）、塔台 0.7.3-pre.6 聯合驗證 @ `7063f11e`（第 2 次）"
  related: [T0589, T0780, T0782, T0686]
---
# BUG-195 — 真 git / 真子程序的單元測試在整套測試負載下逾時（原：`worktree-status-after-close.test.ts`）

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響測試；產品行為無關。CI Test gate（T0686）若遇到會擋發版，重跑即過） |
| 可重現 | 偶發：2026-11-02 兩次（全套平行負載下）；單檔與重跑全套都通過 |
| **狀態** | 🚫 CLOSED（T0786 `8de128de` / `121df3e2`；`v0.7.3-pre.7` 聯合驗證 unit 一次綠、CI Test gate 綠 run `41419978047`） |
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

## T0786 結果（2026-11-02）

範圍：T0786 Q-1 塔台答覆採 A，從 1 檔擴及同根因的 4 個測試檔（都只改測試檔；不改產品程式碼與常數、不改全域 `testTimeout`、不 skip / retry）。

| 檔案 | 改動 |
|---|---|
| `electron/__tests__/worktree-status-after-close.test.ts` | `snapshot` 4 個 git 程序 → 2 個（`status --porcelain=v2 --branch` 帶 HEAD 與目前分支）；真 git 的 `describe` `{ timeout: 30_000 }` |
| `electron/__tests__/ct-worktree-status.test.ts` | 同樣的 `snapshot` 縮減；`status (real git)`、`statusFromGit (real git)` 兩個 `describe` 30 s |
| `electron/__tests__/ct-worktree.test.ts` | `prepare (real git)`、`cleanup (real git)` 兩個 `describe` 30 s（每個測試的 git 呼叫都是斷言需要的，沒有可減的） |
| `scripts/__tests__/dev-deploy-headless.test.mjs` | `renderBashScript (WSL target)` `describe` 30 s（real bash 的 round-trip；與每支腳本自己的 `execFileSync` timeout 相同） |

**根因**：這些測試在一個 `it` 裡依序跑幾十個真的 git / bash 子程序（`worktree-status-after-close` 長測試約 60 個：測試自己的約 24 個，加上 handler 查詢的約 36 個，查詢本來就要跑 git）。單獨跑時每個約 30–60 ms，長測試約 2.5–3 s；整套 `test:unit`（24 核、vitest 平行）下每個 git 呼叫**均勻**變慢約 2–3 倍，沒有哪一步特別慢（逐步計時：makeRepo、prepare、snapshot、各次查詢都同比例變慢），總和就超過預設 5 s。不是產品查詢在負載下異常變慢：單次查詢最長約 2.5 s，遠低於產品的 10 s 查詢上限。

**量測**（`worktree-status-after-close` 長測試；整套都在同一 checkout 有 T0785 並行的情況下跑，可能有額外負載）：

| 情境 | 結果 |
|---|---|
| 單檔 3 次（修改前） | 2.45–3.0 s，全過 |
| 整套 3 次（修改前） | **3/3 逾時**（約 6.7–8.7 s）；第 3 次 `ct-worktree-status` 也逾時 1 個 |
| 整套 3 次（只改本檔、暫時 60 s timeout 量真實耗時） | 本檔 6.8 / 14.4 / 7.4 s；3 次都 exit 1：`ct-worktree-status`（最長 7.5 s）、`ct-worktree`（5.3 s）、`dev-deploy-headless`（10.8 s）逾時 → Q-1 |
| 整套 3 次（4 檔都改完） | **3/3 exit 0**（383 files / 6723 passed）；本檔 4.3 / 6.1 / 5.6 s |
| 負載 1：`test:unit` ＋ 同時連跑 2 次 `npx vite build` | exit 0；本檔 7.2 s |
| 負載 2：兩個 `test:unit` 同時跑 | 兩個都 exit 0；本檔 10.6 / 10.4 s，`ct-worktree-status` 7.1 s、`dev-deploy-headless` 6.6 s、`ct-worktree` 6.0 s |

30 s 約是量到的最大值（14.4 s）的 2 倍。

