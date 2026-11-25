---
schema_version: 1
schema_kind: bug
id: BUG-219
title: "CI（ubuntu-24.04）`shared-conout.test.ts`「the real Worker script relays a pipe」逾時 20 s，Test gate 擋下 `0.8.0-pre.2` 發版"
status: CLOSED
severity: low
reproducibility: "observed once（`pre-release.yml` run `45460440287` 第一次嘗試，2026-11-25 02:36 (UTC+8)，`v0.8.x` `7063e45e`）；pre.1 run `45244996161` 同一檔 23 個測試共 1.0 s 通過"
created_at: "2026-11-25T02:37:54+08:00"
updated_at: "2026-11-25T16:11:32+08:00"
closed_at: "2026-11-25T16:11:32+08:00"
closed_reason: "修正 T0900 隨 `v0.8.0-pre.3` 交付；pre.3 CI run `45560094561`（`5e541975`）`tests / unit-tests`（ubuntu-24.04）綠；使用者裁示以 CI 為證據結案（D340）"
impact:
  - tests
  - ci
  - terminal-server
links:
  discovered_in: "pre-release run 45460440287（tests / unit-tests）"
  related: [T0887, T0889, T0890, PLAN-066, D324]
---
# BUG-219 — Linux CI 上 `shared-conout` 真 Worker 測試掛住

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（共用 conout Worker 只在 win32 生效，Linux / macOS 使用者不受影響；但 CI Test gate 失敗會擋發版） |
| 可重現 | 觀察到 1 次；重跑結果見下方 |
| **狀態** | 🚫 CLOSED（修正 T0900 隨 `v0.8.0-pre.3` 交付；pre.3 CI run `45560094561`（`5e541975`）`tests / unit-tests`（ubuntu-24.04）綠；使用者裁示以 CI 為證據結案（D340）。原記錄：T0900 `6b907f6b`，合併進 `v0.8.x` `86b3fc67`；下一次 Linux CI `tests / unit-tests` 綠燈後 CLOSED） |
| 回報者 | 塔台（`0.8.0-pre.2` 發版 CI） |
| 影響版本 | `v0.8.x`（T0887 起的測試）；本批（T0891 / T0893–T0898）沒有改這個檔或 `shared-conout*` |

## 現象（預期 vs 實際）

- **預期**：`electron/__tests__/shared-conout.test.ts` 23 個測試約 1 s 內通過（pre.1 CI 1035 ms）。
- **實際**：`the real Worker script relays a pipe > open → ready, data reaches the <pipe>-worker client, close → closed; an unreachable pipe → closed only for that id` 在 ubuntu-24.04 runner 上 `Test timed out in 20000ms`；其他 464 個測試檔全過。

## 證據

- run `45460440287` job `tests / unit-tests`（2026-11-24T18:32:50Z 開始、18:36:17Z FAIL）。
- 本機（Windows）T0891 / T0893–T0899 多次完整 `test:unit` 都通過這個檔。

## 處置

- 2026-11-25 02:37：`gh run rerun --failed` 確認是否可重現（結果補記於下）。
- 需另開工單查根因（Linux 上真 Worker + pipe 的時序、是否有未關閉的 handle 或等待條件太窄）；🔴 不得只拉長 timeout 掩蓋掛住。
- 2026-11-25 02:4x：重跑（attempt 2）`tests / unit-tests` success，pre.2 照常發佈（D325）。

## 根因（T0900 查證）

- 測試的競態，產品程式沒有問題：該測試在 `await closed` 之後才對 client 掛 `'close'` listener；Worker 的 `close(id)` 先 `client.destroy()` 再 `postMessage({ type: 'closed' })`，Linux（unix socket）上 client 常先跑完 `'close'`，之後才掛的 listener 永遠等不到，20 s 逾時。Windows named pipe 偵測關閉較慢，所以本機一直通過。
- 重現（WSL Ubuntu-24.04、node 24.22）：獨立腳本 95%（閒置）/ 86%（負載）的情況 client 已先 close；vitest 修正前 23 次失敗 5 次（約 22%）。
- 修正（只改測試，T0900 `6b907f6b`）：送 `close` 前先建立 `once('close')` promise；timeout 不變、沒有 skip；WSL 修正後連續 60 次 0 失敗。
