---
schema_version: 1
schema_kind: bug
id: BUG-218
title: "完整 `npm run test:unit` 第一次執行時，4–6 個 RemoteServer / headless e2e 測試檔在 `beforeAll` 10 s 逾時（單獨重跑或第二次完整執行通過）"
status: FIXING
severity: low
reproducibility: "frequent（2026-11-25 三張工單的 worktree 都遇到：T0894 4 檔、T0891 6 檔、T0895 6 檔；都是第一次完整執行）"
created_at: "2026-11-25T01:08:06+08:00"
updated_at: "2026-11-25T01:08:06+08:00"
impact:
  - tests
  - ci
links:
  discovered_in: "T0894 / T0891 / T0895 回報區〈驗證〉〈遭遇問題〉"
  related: [T0891, T0894, T0895, T0898, D322]
---
# BUG-218 — 完整單元測試第一次執行時 headless e2e 檔逾時

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響測試；但 CI Test gate（T0686）失敗會擋 build / 發版） |
| 可重現 | 常見：三個 worktree 的第一次完整 `test:unit` 都出現 |
| **狀態** | 🔧 FIXING（T0898） |
| 回報者 | 塔台（T0891 / T0894 / T0895 Worker 回報彙整） |
| 影響版本 | `v0.8.x` 測試套件（是否 `v0.8.x` 才出現未查） |

## 現象（預期 vs 實際）

- **預期**：`npm run test:unit` 一次就全綠。
- **實際**：第一次完整執行 exit 1，失敗的都是測試檔層級的 `Hook timed out in 10000ms`（`beforeAll`），沒有單一測試斷言失敗；這些檔單獨重跑通過，第二次完整執行也通過。出現過的檔：
  - `electron/remote/__tests__/headless-blocked-state-e2e.test.ts`
  - `electron/remote/__tests__/headless-close-worker-e2e.test.ts`
  - `electron/remote/__tests__/headless-helper-narrowing.test.ts`
  - `electron/remote/__tests__/headless-remote-tower-e2e.test.ts`
  - `electron/__tests__/local-helper-capability.test.ts`
  - `electron/__tests__/tower-questions.test.ts`
- T0894 的 log 另有 node-pty `AttachConsole failed`。T0891 的第一次失敗另一個原因是全新 worktree 第一次 `require('electron')` 時多個測試同時下載解壓 Electron binary 撞檔（os error 80）。

## 推測（未驗證）

- 全套平行執行時負載高，這些檔在 `beforeAll` 啟動真的 RemoteServer / headless server / PTY，10 s 不夠；或全新 worktree 第一次執行的一次性成本（Electron binary 下載、冷快取）。

## 修法方向

- 由 T0898 查根因後決定（例：針對這些檔加長 `hookTimeout`、限制它們的平行度、把一次性準備移到 globalSetup）；🔴 不得放寬到掩蓋真正的掛住或改產品行為。
