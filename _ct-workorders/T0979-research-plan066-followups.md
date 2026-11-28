---
schema_version: 1
schema_kind: workorder
id: T0979
title: "研究：PLAN-066 三項後續（`pty:create` 只送 env 差異、direct 模式 conin socket 殘留、F4 自然結束的 conhost 殘留）——量測現況、評估修法與風險，提出可派的實作工單"
type: research
status: PENDING
repo: better-agent-terminal
priority: P3
sizing: M
created_at: "2026-11-28T18:01:29+08:00"
updated_at: "2026-11-28T18:01:29+08:00"
session_ids: []
target_version: "—（研究，不改產品）"
depends_on: []
related:
  - "PLAN-066（DONE，D343 後續候選）；T0887（共用 conout Worker）；T0888（量測 F1–F6，`e2e/t0888-shared-conout-stress.spec.ts`、`experiments/node-pty-worker/acceptance/`）；T0889（BUG-214：conin 釋放 `releaseEndedPtyInput`，〈F4 的處置〉、〈遭遇問題〉3 / 4）；T0890（V8 新生代上限）；node-pty#887；D516（U-72：C）"
affects_files:
  - _ct-workorders/T0979-research-plan066-followups.md
  - experiments/node-pty-worker/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 研究型工單：**不改產品程式**（`electron/`、`src/`、`scripts/`、`build/`、`package.json` 都不動）。量測腳本或小型重現只放 `experiments/node-pty-worker/`（可 commit 在 `ct/T0979`）；結論寫在本工單回報區。分支：只在 `ct/T0979` 寫檔（base = 派工當下的 `main`），不 merge / rebase / push、不動 `main`；主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 三項（使用者裁示開單處理，U-72：C，D516；本單先研究，實作工單由塔台依結論開）：① **`pty:create` 只送 env 差異**：T0888 F1 / T0889 C2① —— 共用 Worker 存活時反覆開關分頁，Terminal Server Private Bytes 高水位 +8～+45 MB（強制 GC 診斷版 +0.3 MB，證明不是每連線累積）；候選修法是 `pty-manager.ts` 與 Terminal Server 協定只送與 server env 不同的部分。② **direct 模式 conin socket 殘留**：T0889〈遭遇問題〉3 —— `pty-manager.ts` direct 模式也有 node-pty 不 destroy conin socket 的殘留，T0889 只修了 Terminal Server（`releaseEndedPtyInput`）。③ **F4**：分頁自然 `exit` 後每個分頁的 conhost（與轉送、conin）留到 Terminal Server 結束（node-pty#887）；T0889〈遭遇問題〉4：要處理需先決定「shell 結束時是否結束仍附著主控台的程序」。"
  - "🔴 每項要回答（回報區各一節＋總表）：現況量測（以原始碼建置或既有 spec / 腳本，附數字與環境；量不到寫明原因）、使用者看得到的影響（例：多少分頁 / 多少小時後多佔多少 MB；holder 保留 24 h 的情境）、可行修法（至少一案，附要改的檔案 / 函式）、風險與不變式衝突（逐條對照 CLAUDE.md：T0540 程序樹結束順序先 `killProcessTree` 再 `pty.kill()`、⏻ 重啟 T0539、Terminal Server recovery T0704、Recovery create hold T0578、協定 v1 只做相加 T0857、holder 接回 T0861、共用 conout Worker 規則 T0887 / T0889、node-pty 釘版 `1.1.0`）、是否改到 holder key / `shared-conout-worker.cjs` / 協定（→ 發版前要跑 W6 `windows-upgrade-acceptance.yml`）、規模（XS/S/M/L）、建議（做 / 延後 / 不做）與理由。③ 另列需要使用者裁示的產品選擇（例：shell 結束時要不要結束仍附著主控台的背景程序），以選項＋推薦呈現，由塔台轉給使用者。"
  - "🔴 量測不得影響使用者環境：🔴 不碰使用者正在用的安裝版 BAT、不連它的 Terminal Server / PTY holder、不用預設 userData（用隔離 `BAT_USER_DATA` / runtime）；手動起的程序收尾前全部結束並在回報區列 PID 與殘留檢查。🔴 不得在開發機跑 W6 / 真的安裝程式（CLAUDE.md「Windows PTY holder」）。"
  - "🔴 驗證：研究單不要求 `test:unit` 全綠；若 commit 了 `experiments/` 下的腳本，確認 `npm run test:unit` 不會收到它們（`vite.config.ts` `test.include`）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台；產品選擇寫成建議＋選項留給塔台。工單狀態寫 `DONE`（L177）。"
---

# T0979 — 研究：PLAN-066 三項後續

## 背景

PLAN-066 做完共用 conout Worker（T0887–T0890，`v0.8.0` 起），留下三個沒開單的後續：`pty:create` 只送 env 差異、direct 模式 conin socket 殘留、F4 自然結束的 conhost 殘留。使用者 2026-11-28 裁示開單處理（U-72：C，D516）。三項都碰 Terminal Server 協定或程序結束規則，部分會改 holder 而要跑 W6，所以先研究、量測，再由塔台依結論開實作工單。

## 範圍

- 三項各自：現況量測、影響、修法、風險（對照不變式）、W6 需求、規模、建議。
- F4 需要使用者裁示的產品選擇整理成選項。

## 不做

- 不改產品程式；不發版；不跑 W6 / 真的安裝程式；不碰使用者的安裝版 BAT。

## 驗收

- [ ] 三項各一節＋總表（建議 / 規模 / 是否要 W6）
- [ ] 量測數字附環境與重現方式（或寫明量不到的原因）
- [ ] 不變式逐條對照
- [ ] F4 產品選擇的選項＋推薦
- [ ] 收尾殘留檢查（PID）

---

## 回報區

（Worker 填寫）
