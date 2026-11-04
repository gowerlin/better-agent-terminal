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
| 3 | 正常結束代替 TerminateProcess：NSIS `customCheckAppRunning` 先請 BAT 正常 quit（flush-save、server shutdown、清 pid 檔），逾時才強制 | M | T0823（D267） |
| 4 | holder 模型（ConPTY 持有者放安裝目錄外、跨版本接回）——PLAN-059 子項 D | L | IDEA：使用者確實需要「升級不中斷長任務」時再評估 |

## 相關

- PLAN-059（主 PLAN，子項 D、Q4）；T0820（研究，本機分支 `ct/T0820` 有暫時的 Windows 升級探測 spec＋workflow，保留到本 PLAN 用完，D266）。
- macOS（dmg 覆蓋 .app）/ Linux（AppImage 換檔）的升級行為未研究。

## 狀態

- 2026-11-04 01:34 開單（D266，PLANNED）：先做子項 1＋2（T0821），3 等 1、2 完成再評估，4 維持 IDEA。
- 2026-11-04 01:53 → IN_PROGRESS：T0821 DONE（`710e4179`）——子項 1：Windows 更新通知加「安裝新版會結束所有終端」（三語，`showsWindowsUpgradeWarning`）、README；子項 2：`electron/upgrade-interruption.ts`（`last-run-version.json`；版本變＋孤兒清理 N ≥ 1 才觸發），沿用 `ServerStatusToast` 顯示一次，claude / codex 分頁以 `cause: 'upgrade'` 列進既有「被中斷的 agent 分頁」（不因 `session-start` 移除，D-1 塔台接受）；單元 42、突變 4 / 4、e2e 模擬升級＋對照 2 passed、t0766 / t0578 不回歸；typecheck 0 / 0、unit 403 檔 / 7087、legacy 472 / 33、vite build。待發版；真實升級驗收要 pre.N → pre.N+1 兩版都含本功能，以 `ct/T0820` 探測 spec 改寫重跑（檢查點見 T0821 回報區）。小後續：縮圖 ⏸ tooltip 依 `cause` 顯示升級文字（未開單）。
- 2026-11-04 02:02（D267）：使用者決定與縮圖 tooltip、子項 3 湊成一批再發 `0.7.4-pre.6` → 開 **T0822**（⏸ tooltip 依 cause，S）、**T0823**（子項 3：NSIS `customCheckAppRunning` 先請 BAT 正常結束、逾時回退強制，worktree＋Windows runner 實測，M），並行。
- 2026-11-04 02:07 T0822 DONE（`05117326`）：縮圖 ⏸ tooltip 依 `cause: 'upgrade'` 顯示「因安裝新版而中斷」（三語）。
- 2026-11-04 14:05 **真實升級驗收（D277，本機 pre.6 執行中 → 安裝 pre.7，per-machine 互動安裝）**：
  - ① PASS：安裝程式先出範本的「BetterAgentTerminal 正在執行。點擊 OK 關閉」提示（使用者按確定）；請求行程 `--installer-quit-request` 06:03:58.69Z 啟動、交給執行中的 BAT 後不跑 whenReady（`second instance: handed off`）；舊行程 06:03:59.06Z `[installer-quit] request received: recorded 2 terminal(s), 2 claude session(s)`，06:03:59.20Z `terminal server stopped (via IPC server:shutdown)`，約 0.5 s 正常結束。
  - ② PASS：重開後 toast「BAT 已升級（v0.7.4-pre.6 → v0.7.4-pre.7）。安裝新版時結束了 2 個終端…2 個 agent 分頁已中斷」。
  - ③ 列出 PASS：「升級結束的 agent 分頁」對話框列 2 個 claude 分頁（better-agent-terminal Tower `50e83f2b`、專案A Tower `cb2b0345`），各有「恢復 / 略過」與「全部恢復 (2)」；一鍵接回待使用者按一次確認。
  - ④ PASS：新行程 `[installer-quit] record found: version=0.7.4-pre.6 source=running-app ptys=2 claude-sessions=2`、`[upgrade-interruption] detected: previous=0.7.4-pre.6 current=0.7.4-pre.7 ended-ptys=2 agent-tabs=2 source=installer`、`[interrupted-agents] upgrade interrupted 2 agent tab(s); listed 2`。
  - ⑤ PASS：升級前啟動的程序都不是 BAT 的（父行程 explorer / ChatGPT / 監控服務）；`BetterAgentTerminal.exe` 6 個全是 14:04:15 之後的新行程；沒有舊的 bash / claude / Terminal Server。
- 2026-11-04 14:14 **同版重裝（pre.7 → pre.7，BAT 執行中）**：使用者回報重開後沒有再出現恢復對話框。日誌：舊行程 06:07:34.57Z `[installer-quit] request received: recorded 1 terminal(s), 1 claude session(s)`、正常結束並停 Terminal Server（T0823 路徑再 PASS 一次）；新行程 06:07:50.42Z `[installer-quit] record found: version=0.7.4-pre.7 … ptys=1 claude-sessions=1`，**沒有** `[upgrade-interruption] detected`（`last-run-version.json` = pre.7 = 目前版本）。符合現行設計（`detectUpgradeInterruption` 要求版本不同），不是回歸；但安裝程式結束紀錄已證明終端是被安裝程式結束的，同版重裝目前不會有任何提示（設計缺口，待使用者裁示）。③ 一鍵接回：14:04 那次對話框沒有按恢復（日誌無 resume），清單只存在記憶體、重開後消失 → ③ 接回**仍未驗證**。
- 2026-11-04 14:24（D278）T0846 DONE（`9e966f98`）：安裝程式結束紀錄 PTY ≥ 1 時版本相同也觸發（取消安裝與同版重裝無法區分，兩者都提示），同版 toast 改中性文字 `app.upgradeReinstalled`；只有孤兒（當機）仍要求版本不同。待發版；發版後同版重裝驗 ③ 一鍵接回。
- 2026-11-04 14:30（D279）T0847 DONE（`511df465`）：被中斷的 agent 分頁標題 / 說明 / ⏸ tooltip 三語改中性（「安裝程式結束的 agent 分頁」等），與 T0846 同批待發 `pre.8`。
- 2026-11-04 14:53 **真實升級 pre.7 → pre.8（BAT 執行中，D280）**：舊行程 06:51:14.35Z `[installer-quit] request received: recorded 2 terminal(s), 2 claude session(s)`，請求行程 `second instance: handed off`；新行程 06:51:30Z `record found … ptys=2 claude-sessions=2`、`[upgrade-interruption] detected: previous=0.7.4-pre.7 current=0.7.4-pre.8 ended-ptys=2 agent-tabs=2 source=installer`、`listed 2`、`notice shown`。**③ 一鍵接回 PASS**：06:51:52Z 兩個 claude 分頁 `resume … → ok mode=session`，塔台分頁接回原 session `16bf8f88`（對話內容延續，`bat_whoami` session id 相同；塔台角色重開後需重新 `--set-role`，屬預期，不持久化）。PLAN-063 子項 1–3 真實驗收全部 PASS。尚未實機：同版重裝的中性 toast（T0846，需再裝一次 pre.8）。
