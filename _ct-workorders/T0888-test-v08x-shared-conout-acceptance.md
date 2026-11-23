---
schema_version: 1
schema_kind: workorder
id: T0888
title: "測試：`v0.8.x`（共用 conout Worker）自動回歸測試與壓力／記憶體量測，對照 `0.7.5-pre.2`（PLAN-066）"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: L
created_at: "2026-11-23T20:37:03+08:00"
started_at: "2026-11-23T20:38:31+08:00"
updated_at: "2026-11-23T20:38:31+08:00"
completed_at: ""
session_ids: []
depends_on: [T0887]
related:
  - "PLAN-066；D307 / D308 / D309 / D310；T0887（實作與回報區的量測、驗收、〈遭遇問題〉2 node-pty#887）；T0886（`experiments/node-pty-worker/`，修正版程序清理規則）；T0885（`bat-baseline.spec.ts`）；desktop-build B run `45153872079`（`0.0.0-exp.18`，artifact `desktop-win` 保留到 2026-11-30）；release `v0.7.5-pre.2`；T0540 / T0539 / T0572 / T0578 / T0704 / T0741 / T0859 / T0861"
affects_files:
  - _ct-workorders/T0888-test-v08x-shared-conout-acceptance.md
  - e2e/t0888-*.spec.ts
  - experiments/node-pty-worker/acceptance/**
  - experiments/node-pty-worker/results/**
renew_count: 0
isolation: worktree
workdir: worktree ct/T0888（塔台已預先從 `v0.8.x` 建立分支 `ct/T0888`，base `a05a9c79`）
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0888` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `a05a9c79fc44b7190f02084de4401a968a4d3459`，不符就停下問塔台。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 本單是測試與量測：**不改任何產品程式碼**（`electron/`、`src/`、`scripts/`（含 `scripts/__tests__/`）、`build/`、`package*.json`、`vite.config.ts`、既有 e2e spec 與 `e2e/fixtures/`）。發現行為問題 → 記證據（重現步驟、數據、日誌行）寫進回報區〈發現〉，**不修**、繼續跑其餘項目。新檔只放在 `affects_files` 列的位置；需要共用輔助程式時放 `experiments/node-pty-worker/acceptance/`。"
  - "🔴 依賴：worktree 內 `npm ci`（不改 lock、不新增依賴、不改 `allowScripts`）。"
  - "🔴 不碰使用者正在用的 BAT（目前是安裝版 `0.0.0-exp.18`）與其 Terminal Server / `bat-pty-holder`：`C:\\Program Files\\BetterAgentTerminal`、`%LOCALAPPDATA%\\BAT-PtyHolder`、`%ProgramFiles%\\BAT-PtyHolder` 只能列檔；不安裝、不解除安裝任何 BAT；不執行 NSIS 安裝檔。所有 BAT 一律以 `launchIsolated` 等 fixture 的隔離 runtime 執行（holder 情境另把 `LOCALAPPDATA` 指到暫存，比照 `e2e/t0859-pty-holder.spec.ts`）。🔴 不觸發任何 GitHub workflow、不在開發機跑 W6 spec。"
  - "🔴 程序清理（T0886 / T0887 規則，D308 曾誤殺 8 個無關程序）：量測與清理只用 `ct/T0886` 修正後的規則（子程序建立時間必須晚於父程序；只結束本單啟動之後建立、且可追溯到本單啟動的程序；一次一個、不 `taskkill /T` 整棵樹）。不得以程序名稱或父 PID 大範圍結束程序；Terminal Server 只在命令列 / 執行檔路徑符合本單的隔離實例時才可結束。回報區寫明每次手動清理結束了哪些 PID（只記 PID 與映像名稱）。收尾確認沒有本單留下的程序。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。Git：worktree 用 `git add <明確路徑>`（不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。日誌與結果檔不記 PTY 內容、權杖、env。下載的 zip / 解壓目錄放在 repo 外的暫存目錄，不 commit 任何二進位檔。"
---

# T0888 — 測試：`v0.8.x` 共用 conout Worker 的自動回歸測試與壓力／記憶體量測

## 元資料

- **工單編號**：T0888
- **任務名稱**：`v0.8.x`（`0.0.0-exp.18`）自動回歸測試與壓力／記憶體量測，對照 `0.7.5-pre.2`
- **狀態**：IN_PROGRESS
- **類型**：implementation（測試與量測，不改產品程式碼）
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-23 20:37 (UTC+8)

## 背景

T0887 讓 Windows Terminal Server 整個程序共用一個 node-pty conout Worker（10 分頁 164.6 → 38.8 MB），已合進 `v0.8.x`（`a05a9c79`），W6 升級驗收與兩次 desktop-build 都通過（D310）。使用者已在自己的電腦安裝 desktop-build B（`0.0.0-exp.18`）試用。發 `v0.8.0-pre.1` 前，使用者要求先做一輪**自動測試與量測**，補 T0887 沒涵蓋的部分：

- T0887 量的是原始碼建置與本機 `build:dir`，只到 10 個閒置分頁；沒量 CI 實際建出來的安裝產物、沒量 holder（`bat-pty-holder.exe`）路徑、沒做開關分頁反覆、自然結束、多分頁同時大量輸出、長時間執行。
- T0887 只跑了 5 個 e2e；其他與終端 / PTY 有關的 e2e 沒跑。

## 受測對象

| 代號 | 來源 | 取得方式 |
|---|---|---|
| **N**（新） | desktop-build B run `45153872079` 的 `desktop-win` artifact 內的 `*-win.zip`（`0.0.0-exp.18`，`v0.8.x` @ `a05a9c79`） | `gh run download 45153872079 -R gowerlin/better-agent-terminal -n desktop-win -D <暫存>`，解壓 zip |
| **O**（舊） | release `v0.7.5-pre.2` 的 `BetterAgentTerminal-0.7.5-pre.2-win.zip` | `gh release download v0.7.5-pre.2 -R gowerlin/better-agent-terminal -p "BetterAgentTerminal-0.7.5-pre.2-win.zip" -D <暫存>` |
| **H**（holder） | worktree 內 `npm run build:dir` 的 `release\win-unpacked`（與 N 同一份程式碼），`LOCALAPPDATA` 指到暫存，比照 `t0859-pty-holder.spec.ts` 讓 Terminal Server 從 holder 執行 | 本機建置 |

- 🔴 `gh` 一律帶 `-R gowerlin/better-agent-terminal`。記錄兩個 zip 的 SHA-256 與解壓後 `BetterAgentTerminal.exe` 的 FileVersion。
- zip 版沒有 NSIS 標記，Terminal Server 走 fork（不經 holder），這是預期；holder 路徑由 H 涵蓋。
- 每個情境都要在日誌確認 N / H 的 Terminal Server 寫了 `[shared-conout] installed`，O 沒有（若 stderr 被丟棄而看不到，改以「Terminal Server 只有 1 個 conout Worker 執行緒 / 執行緒數」佐證並寫明）。

## 範圍

### A. 建置與單元測試（worktree，base 健全性）

`npm ci` → `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、`npm run test:unit` 全過（與 T0887 回報的 8434 passed 對照）。

### B. 回歸 e2e（N 為主，失敗時以 O 重跑判定是否既有）

以 `BAT_E2E_EXECUTABLE=<N 解壓目錄>\BetterAgentTerminal.exe`（Windows 路徑、反斜線）跑下列 spec；spec 需要原始碼建置的就用 worktree 的 `npx vite build`，並寫明各 spec 實際用哪個對象：

`t0539-restart-exited-terminal`、`t0572-new-pty-initial-size`、`t0578-recovery-no-direct-shell`、`t0704-heartbeat-recovery`、`t0741-hidden-new-tab-pty-size`、`t0742-terminal-drop-path`、`t0532-default-terminal-no-empty-flash`、`detached-terminal-persistence`、`v072-pre6-terminal-links`；H 跑 `t0859-pty-holder`、`t0861-holder-reattach`。

- 另外列出 `e2e/` 中其他會建立終端分頁的 spec，可在合理時間內跑完的一併跑（每個 spec 註明結果）；跑不了的（需真 SSH / Docker / 網路等）列出理由。
- 失敗的 spec：以 O 跑同一個 spec；O 也失敗 → 既有問題；只有 N 失敗 → 〈發現〉。

### C. 壓力與記憶體量測（新 spec `e2e/t0888-shared-conout-stress.spec.ts`，Windows only、opt-in）

- spec 只在 `BAT_T0888_STRESS=1` 且 win32 時執行，否則 skip；對象由 `BAT_E2E_EXECUTABLE` 決定，N / O / H 跑同一份 spec。量測沿用 `experiments/node-pty-worker/bat-memory/` 的方法（N 個閒置 pwsh 分頁全部出提示後等 10 s；Terminal Server 自己的 Private Bytes、執行緒數；框架合計），每個數字 3 次取中位數。結果寫 `experiments/node-pty-worker/results/t0888-*.csv`，回報區附彙總表。
- 每個情境結束前，用每個分頁實際執行一個命令（例如 echo 一個隨機標記並在畫面上找到）確認分頁仍可用。

| 情境 | 內容 | N / H 通過條件（O 只記錄對照） |
|---|---|---|
| **C1 閒置分頁數** | 1 / 5 / 10 / 20 / 30 個分頁 | 10 分頁 Terminal Server < 45 MB；10 → 30 分頁每多一個分頁增加 ≤ 0.5 MB（中位數）；H 量 `bat-pty-holder` 程序 |
| **C2 開關分頁反覆** | ① 保持 10 個分頁，另一個分頁開→關 100 次；② 全部關閉 → 再開 10 個，重複 20 次（每次讓共用 Worker 結束再啟動） | 結束時 Terminal Server 比開始時增加 ≤ 5 MB；沒有殘留 conhost / shell；最後所有分頁可用 |
| **C3 自然結束** | 20 個分頁各自執行 `exit`（不經 BAT 關閉），之後再開 10 個 | 記錄結束前後與再開後的記憶體（對照 T0887〈遭遇問題〉2：O 預期每個留約 14 MB Worker，N 只留幾個 socket）；再開的分頁可用 |
| **C4 多分頁同時大量輸出** | 10 個分頁同時各印 20,000 行帶序號的內容，最後印完成標記 | 每個分頁都收到完成標記；抽查最後 200 行序號連續不缺；記錄完成時間（N 與 O 比較，N 不得慢超過 20%）；過程中 Terminal Server 記憶體峰值 |
| **C5 大量輸出中關閉** | 10 個分頁大量輸出時，關閉其中 5 個 | 不 hang（每個關閉 < 5 s 完成）、Terminal Server 存活、其餘 5 個繼續輸出到完成、沒有殘留程序 |
| **C6 長時間執行** | 10 個分頁，30 分鐘，每個分頁每 5 s 印一行；每分鐘取樣一次 | Terminal Server 第 30 分鐘比第 1 分鐘增加 ≤ 5 MB；分頁全程可用 |
| **C7 Terminal Server 重建** | 10 個分頁時，只結束本隔離實例的 Terminal Server（比照 T0704 spec 的做法） | recovery 後分頁可再用、新的 server 仍是共用 Worker（N / H） |

- C1、C4 對 N、O、H 都跑；C2、C3、C5、C6、C7 對 N 與 H 必跑，O 跑 C2、C3 作對照（時間允許時其餘也跑）。
- 時間預算：整單量測以 3 小時為上限；超過就依 C1 → C4 → C2 → C3 → C5 → C7 → C6 的順序保留已完成的部分，回報 PARTIAL 並列出沒跑的項目。
- 機器上同時有使用者的 BAT 在跑：時間類數字僅供參考，回報寫明；Private Bytes 不受影響。

## 驗收

1. A 全部通過。
2. B 每個 spec 都有結果（通過 / 失敗並附 O 對照 / 無法執行附理由）。
3. C 的 7 個情境都有數據與通過判定；未達條件的寫進〈發現〉（附重現方式與數據），不修。
4. 新 spec 在非 Windows 或沒設 `BAT_T0888_STRESS=1` 時 skip（以 `npx playwright test e2e/t0888-shared-conout-stress.spec.ts --list` 或一般執行確認）；`npm run test:unit` 不受影響。
5. 回報區列：受測對象（SHA-256、FileVersion）、各情境彙總表、`[shared-conout]` 確認方式、〈發現〉、手動清理的 PID、收尾殘留程序檢查結果、對發 `v0.8.0-pre.1` 的建議（可發 / 需先修哪些）。

## 不做

- 修任何產品程式碼（含 node-pty#887 的 `dispose`）、改既有 spec / fixture。
- 在本機安裝 / 解除安裝 BAT、跑 NSIS 安裝檔、跑 W6、觸發任何 workflow、push、合併、發版。
- macOS / Linux 量測（共用 Worker 只在 Windows 啟用）。

## 塔台補充（執行中 #1）

- 2026-11-23 20:38 派工：BAT 回報 `base: 06c3b884…`，那是 `ct/T0888` 與 `main` 的共同祖先，`CT_WORKTREE_BASE` 也會是這個值，**屬預期、不是錯誤**。塔台已確認 worktree `HEAD` = `merge-base HEAD v0.8.x` = `a05a9c79`。開工檢查以 memory_overrides 的 `merge-base HEAD v0.8.x` 為準；回報區的 `base_sha` 寫 `a05a9c79…`。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 實作摘要

### 驗收結果

### 發現

### 相關通過案例

### 遭遇問題

### 子代理與 Workflow 使用

### Renew 歷程

### 方法論狀態回寫

### 建議下一步

### 回報時間
