---
schema_version: 1
schema_kind: plan
id: PLAN-063
title: "Windows NSIS 升級會結束所有終端：升級前提示、升級後說明（holder 模型維持 IDEA）"
status: IN_PROGRESS
priority: medium
created_at: "2026-11-04T01:34:49+0800"
links:
  source: "T0820 回報區（PLAN-059 Q4）；D266"
  related: [PLAN-059, T0820, T0766, T0767, T0504, T0704, T0578]
---

# PLAN-063 — Windows NSIS 升級中斷終端的緩解

## 動機

T0820（PLAN-059 Q4）以 GitHub Actions Windows runner 實測（run `41683870546`，pre.4 → pre.5，`/S` per-user）：NSIS 安裝程式以 `Stop-Process`（TerminateProcess）結束安裝目錄下的所有程序——BAT 主行程與 Terminal Server（同一個 exe）；分頁的 shell 因 ConPTY 由 server 持有，也在 5 s 內結束。主視窗已關、保留 Terminal Server 時一樣全部結束；升級後重開**不會**出現 Recovery 提示（走孤兒清理，`electron/main.ts` 約 376–395 行），使用者看不到任何說明。推論（未實測）：claude / codex 分頁中斷且不會列進「被中斷的 agent 分頁」（T0766 / T0767 只在 recovery 觸發）；主行程沒有 flush-save（T0504）；per-machine 互動升級可能沒有「正在執行」提示。BAT 沒有自動更新（使用者自己下載、雙擊安裝）。

## 子項

| # | 項目 | 規模 | 狀態 |
|---|---|---|---|
| 1 | 升級前提示：Windows 上的更新通知（與 README / 安裝說明）告知「安裝新版會結束所有終端分頁與 agent，請先完成工作」 | S | ✅ T0821 `710e4179`（待發版） |
| 2 | 升級後說明：啟動時偵測「版本與上次執行不同＋走了孤兒清理」→ 提示上次升級結束了 N 個終端；claude / codex 分頁盡量沿用 T0766 / T0767 的「被中斷的 agent 分頁」對話框與一鍵 resume | M | ✅ T0821 `710e4179`（待發版；真實升級驗收待兩版都含本功能） |
| 3 | 正常結束代替 TerminateProcess：NSIS `customCheckAppRunning` 先請 BAT 正常 quit（flush-save、server shutdown、清 pid 檔），逾時才強制 | M | 等 1、2 完成再評估 |
| 4 | holder 模型（ConPTY 持有者放安裝目錄外、跨版本接回）——PLAN-059 子項 D | L | IDEA：使用者確實需要「升級不中斷長任務」時再評估 |

## 相關

- PLAN-059（主 PLAN，子項 D、Q4）；T0820（研究，本機分支 `ct/T0820` 有暫時的 Windows 升級探測 spec＋workflow，保留到本 PLAN 用完，D266）。
- macOS（dmg 覆蓋 .app）/ Linux（AppImage 換檔）的升級行為未研究。

## 狀態

- 2026-11-04 01:34 開單（D266，PLANNED）：先做子項 1＋2（T0821），3 等 1、2 完成再評估，4 維持 IDEA。
- 2026-11-04 01:53 → IN_PROGRESS：T0821 DONE（`710e4179`）——子項 1：Windows 更新通知加「安裝新版會結束所有終端」（三語，`showsWindowsUpgradeWarning`）、README；子項 2：`electron/upgrade-interruption.ts`（`last-run-version.json`；版本變＋孤兒清理 N ≥ 1 才觸發），沿用 `ServerStatusToast` 顯示一次，claude / codex 分頁以 `cause: 'upgrade'` 列進既有「被中斷的 agent 分頁」（不因 `session-start` 移除，D-1 塔台接受）；單元 42、突變 4 / 4、e2e 模擬升級＋對照 2 passed、t0766 / t0578 不回歸；typecheck 0 / 0、unit 403 檔 / 7087、legacy 472 / 33、vite build。待發版；真實升級驗收要 pre.N → pre.N+1 兩版都含本功能，以 `ct/T0820` 探測 spec 改寫重跑（檢查點見 T0821 回報區）。小後續：縮圖 ⏸ tooltip 依 `cause` 顯示升級文字（未開單）。
