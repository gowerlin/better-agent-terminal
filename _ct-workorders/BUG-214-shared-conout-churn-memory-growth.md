---
schema_version: 1
schema_kind: bug
id: BUG-214
title: "Windows Terminal Server（共用 conout Worker，`v0.8.x`）：共用 Worker 存活時反覆開關分頁，Private Bytes 增加 17–23 MB 後才持平"
status: FIXING
severity: low
reproducibility: "always（T0888 C2①：N 300 次 +17.1 MB、H 100 次 +22.5 MB；`v0.7.5-pre.2` 同情境 −10.3 MB）"
created_at: "2026-11-23T22:04:16+08:00"
updated_at: "2026-11-24T00:55:03+08:00"
impact:
  - terminal-server
  - windows
links:
  discovered_in: "T0888 回報區〈發現〉F1（F4 同類）"
  related: [T0887, T0888, T0889, T0890, PLAN-066, D309, D311, D312, D313]
---
# BUG-214 — 共用 conout Worker：反覆開關分頁的記憶體增加

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（有上限、之後持平；10 分頁總量仍遠低於 `0.7.5`：約 56 MB 對 159 MB） |
| 可重現 | ✅ 必定（T0888 C2①） |
| **狀態** | ⏳ FIXING（T0889 部分修正；評估單 T0890，D313） |
| 回報者 | 塔台（T0888 Worker 量測） |
| 影響版本 | 只有 `v0.8.x`（T0887 `a05a9c79` 起）；已發佈版本不受影響 |

## 現象（預期 vs 實際）

- **預期**：保持 10 個分頁開著，另外反覆開一個、關一個，Terminal Server 的 Private Bytes 增加 ≤ 5 MB（T0888 C2① 條件）。
- **實際**：N（`0.0.0-exp.18`）300 次從約 39.7 MB 爬到約 56 MB（+17.1，第 225 次後持平）；H（`build:dir`＋holder）100 次 +22.5 MB。全部分頁關閉、共用 Worker 結束後就降回來（C2②「每次全關再開」20 輪 N +4.0、H −3.7）。O（`v0.7.5-pre.2`，每個 PTY 一個 Worker）同情境 −10.3 MB。

## 證據

- `experiments/node-pty-worker/results/t0888-c2.csv`（`v0.8.x` `fd466fb3`）的 `part1-churn-*` 與 `part1-end`。
- 重現：`$env:BAT_T0888_STRESS='1'; $env:BAT_E2E_EXECUTABLE='<N>\BetterAgentTerminal.exe'; $env:BAT_T0888_LABEL='N'; $env:BAT_T0888_SCENARIOS='C2'; $env:BAT_T0888_C2_CHURN='300'; npx playwright test e2e/t0888-shared-conout-stress.spec.ts`。

## 相關觀察（同一張修正單一起查）

- **T0888 F4（既有，`0.7.5` 也有）**：分頁自然 `exit` 後，每個分頁的 conhost 留到 Terminal Server 結束（N / H / O 都是 20 個 exit 後留 20 個 conhost）。與 T0887〈遭遇問題〉2 的 node-pty#887（自然結束的 PTY 沒有被 dispose）同類。

## 處置方向（T0889 查證）

- 疑點：單一分頁關閉時，共用 Worker 或主執行緒內每個連線的狀態（socket、MessagePort、緩衝、Map 項目、listener）沒有釋放；也可能只是 V8 / Node heap 的高水位。Worker 要先分辨是哪一種再決定修不修。
- 🔴 改 `shared-conout-worker.cjs` 會改變 holder 內容（key 改變）：發版前必須重跑 W6（`windows-upgrade-acceptance.yml`）。

## T0889 結果（2026-11-24 00:55 收單，D313）

- **每連線殘留（已修）**：node-pty 1.1.0 的 conin 寫入 socket 在 `kill()` 與 exit 路徑都不 destroy，Terminal Server 主執行緒的 socket handle 每關一個 PTY 多一個（C2 後 20 → 480–500）；original 也有。修法：BAT 自己結束的 PTY 在 exit 後 destroy conin socket（`0da88470`，已合併 `v0.8.x`）。修改後 socket 數全程 20。
- **其餘是 V8／runtime 高水位，不是每連線累積**：每 10 s 強制 GC 的診斷版 C2① 只 +0.3 MB；新生代提交量 2 → 13.5 MB（使用 0.5 MB）。修改後 C2① N +7.8～+16.4 MB、H +45.1 MB（holder 是官方 Node，強制 GC 仍 +38.1 MB）；C2② 7 次有 3 次 > 5 MB（同一高水位的取樣波動）。不經 app 重現：每次 `pty:create` 帶完整 env 是觸發因素，O 的 Terminal Server 同情境 +27.8 MB。
- **下一步**：使用者裁示開評估單 T0890（Windows Terminal Server 與 holder 以 `--max-semi-space-size` 啟動；不經 app 重現 holder +45.0 → +12.7 MB）。T0890 後仍 > 5 MB 時由使用者裁示是否列為已知限制。
