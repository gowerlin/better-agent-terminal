---
schema_version: 1
schema_kind: workorder
id: T0888
title: "測試：`v0.8.x`（共用 conout Worker）自動回歸測試與壓力／記憶體量測，對照 `0.7.5-pre.2`（PLAN-066）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: L
created_at: "2026-11-23T20:37:03+08:00"
started_at: "2026-11-23T20:38:31+08:00"
updated_at: "2026-11-23T22:00:25+08:00"
completed_at: "2026-11-23T22:00:25+08:00"
session_ids:
  - "9afa8699-43b8-458a-a74a-94c1c2125f66"
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
- **狀態**：DONE
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

- **狀態**：DONE（A / B / C 全部有結果；C 有 2 項未達條件、B 有既有失敗，依工單寫進〈發現〉，未修）
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`；C-1 工單在 `$CT_HOME/_ct-workorders/` 下；C-3 `affects_files` 皆為新建路徑（祖先 `e2e/`、`experiments/node-pty-worker/` 存在）；C-2 無 `branch` 欄位。`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0888`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。開工 `git merge-base HEAD v0.8.x` = `a05a9c79fc44b7190f02084de4401a968a4d3459`，符合。
- **branch**：`ct/T0888`
- **base_sha**：`a05a9c79fc44b7190f02084de4401a968a4d3459`（依〈塔台補充（執行中 #1）〉；`CT_WORKTREE_BASE` 環境變數為 `06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`，屬預期）
- **validated_sha**：`a05a9c79fc44b7190f02084de4401a968a4d3459`（量測與 e2e 執行時的 HEAD；新 spec / 輔助程式 / 結果當時尚未提交）
- **head_sha**：`fd466fb3b30cc1f1ce64ceda805f2d3460b50093`
- validated ≠ head 說明：`fd466fb3` 只新增本單的 spec、`experiments/node-pty-worker/acceptance/**`、`results/t0888-*.csv`，沒有任何產品程式碼；受測的 N / O / H 都是建置好的產物（N、H 的程式碼即 `a05a9c79`）。提交的 spec 就是跑 O / N 時的版本（H 的 C2 是在加入 `BAT_T0888_C2_CHURN` 與每 25 次取樣之前跑的，見〈遭遇問題〉3）。
- **session_id**：9afa8699-43b8-458a-a74a-94c1c2125f66

### 互動紀錄

- [20:38] 開工；yolo、`CT_INTERACTIVE=0`，全程未向使用者或塔台提問。
- [21:58] 📥 塔台補充（執行中 #1）於〈填回報前〉讀到 → 回報區 `base_sha` 寫 `a05a9c79…`；開工時已用 `merge-base HEAD v0.8.x` 檢查，與補充一致，不需重做任何步驟。（〈驗證前〉〈產品 commit 前〉兩個節點漏跑檢查，見〈遭遇問題〉4）

### 實作摘要

新增（全部在 `affects_files` 內，未改任何產品程式碼、既有 spec 或 fixture）：

- `e2e/t0888-shared-conout-stress.spec.ts`：C1–C7，opt-in（`BAT_T0888_STRESS=1` + win32 + `BAT_E2E_EXECUTABLE`），對象標籤 `BAT_T0888_LABEL`；`BAT_T0888_HOLDER=1` 比照 `t0859` 把建置的 `resources\pty-holder` 複製到暫存的 `Local\BAT-PtyHolder\<key>`、以 `LOCALAPPDATA=<暫存>\Local` 啟動（marker 不存在才建立、結束時刪除）。分頁以 renderer 的 `electronAPI.pty` 建立（與分頁相同的 IPC，預設 shell = pwsh）。可用性檢查：每個分頁執行 `"MARK_<隨機>_" + (n + 1)`，必須在輸出看到計算後的結果（不是回顯）。功能面（完成標記、可用性、server 存活）用斷言；記憶體門檻只記 `verdict` 行，不斷言（O 也用同一份 spec 跑）。另有 `BAT_T0888_SCENARIOS`、`BAT_T0888_RUNS`、`BAT_T0888_C6_MINUTES`、`BAT_T0888_C2_CHURN`（預設 100）。
- `experiments/node-pty-worker/acceptance/proc-sample.ps1`：唯讀取樣（Terminal Server 自己的 Private Bytes / WS / 執行緒數、執行檔路徑、子孫程序名稱），程序樹沿用 `bat-memory/tree-usage.ps1`（ct/T0886 修正版的建立時間規則）；`-Watch` 模式每 250 ms 取峰值。
- `experiments/node-pty-worker/acceptance/summarize.mjs`：CSV → 每個（對象, 步驟）的中位數表。
- `experiments/node-pty-worker/results/t0888-c1.csv` … `t0888-c7.csv`：全部原始數據（只有數字與程序名稱，沒有 PTY 內容、env、權杖、路徑）。

量測方法：每筆記憶體 = 1 秒間隔取 3 次的中位數（C1、C4 另外整個情境跑 3 次以上，再取中位數）；每次加分頁後等所有分頁出現 pwsh 提示，再靜置 10 s 取樣。

### 驗收結果

**受測對象**

| 代號 | 來源 | SHA-256 | `BetterAgentTerminal.exe` FileVersion | Terminal Server |
|---|---|---|---|---|
| N | desktop-build run `45153872079` artifact `desktop-win` 的 `BetterAgentTerminal-0.0.0-exp.18-win.zip`（BUILD-INFO：ref `v0.8.x`、commit `a05a9c79`） | `559ae0c6d6e65c978127b86a561fb359279c42cc3c3c34c8d4ac524750d05053`（與 artifact 內 `SHA256SUMS.txt` 一致） | `0.0.0-exp.18` | fork（zip 沒有 NSIS 標記，預期） |
| O | release `v0.7.5-pre.2` 的 `BetterAgentTerminal-0.7.5-pre.2-win.zip` | `1de36a81f515bce69c3f877d745f6e6bd7453c93dc283bed0702784c951ea214`（與 release asset digest 一致） | `0.7.5-pre.2` | fork |
| H | worktree `npm run build:dir` 的 `release\win-unpacked`（`a05a9c79`） | 本機建置 | — | holder `24.22.2-f2630bed1fc5`（per-user，暫存目錄內；C7 的檢查確認執行檔在暫存目錄下） |

zip 都解壓在 repo 外的 `%TEMP%\t0888\`，沒有執行 NSIS 安裝檔（artifact 內附的 `Setup` exe 只下載、未執行）。

**`[shared-conout]` 確認方式**：Windows 上 Terminal Server 的 stdio 是 `ignore`（`planTerminalServerFork`），stderr 的 `[shared-conout] installed` 看不到，改用兩個佐證：
1. 記憶體：N / H 的 10 個分頁約 35–42 MB、30 個分頁約 38–46 MB，O 每多一個分頁多約 13 MB（10 分頁 159 MB）。
2. 執行緒數斜率：1 → 30 個分頁，N 16 → 44（約 1 條／分頁）、H 11 → 39（約 1 條／分頁），O 16 → 73（約 2 條／分頁）；O 每個 PTY 多出的那條就是各自的 conout Worker。C7 recovery 後的新 server 也一樣（N 10 分頁 43.3 MB／25 條，O 162.6 MB／34 條）。

**A. 建置與單元測試**：PASS

| 項目 | 結果 |
|---|---|
| `npm ci` | exit 0（`electron-winstaller` install script 被 `allowScripts` 擋，CLAUDE.md 註明屬預期） |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npx vite build` | 成功 |
| `npm run test:unit` | 第 1 次：1 failed / 8373 passed；8 個檔是 RemoteServer 類測試的 hook timeout（10 s）。這 8 個檔單獨重跑 176 passed；第 2 次全量 **462 files passed、8433 passed、42 skipped、0 failed**。T0887 回報 8434 passed，差 1 是 skipped 數的差異（環境條件），沒有失敗。第 1 次判定為負載下的逾時 flake。 |

**B. 回歸 e2e**

工單指定（N = `%TEMP%\t0888\N\BetterAgentTerminal.exe`；H = `release\win-unpacked`）：

| spec | 對象 | 結果 |
|---|---|---|
| `t0539-restart-exited-terminal` | N | ✅ |
| `t0572-new-pty-initial-size` | N | ✅ |
| `t0578-recovery-no-direct-shell`（2 測試） | N | ✅ ✅ |
| `t0704-heartbeat-recovery` | N | ✅ |
| `t0741-hidden-new-tab-pty-size` | N | ✅ |
| `t0742-terminal-drop-path` | N | ✅ |
| `t0532-default-terminal-no-empty-flash` | N | ✅ |
| `detached-terminal-persistence` | N | ✅ |
| `v072-pre6-terminal-links` | N | ✅ |
| `t0859-pty-holder` | H | ❌ 第 1 次啟動（holder 路徑）全部通過；第 2 次啟動（改壞 per-user holder）預期退回 fork，實際用了本機已安裝的 per-machine holder → 環境前提不成立，見〈發現〉F6 |
| `t0861-holder-reattach` | H | ✅ |
| `t0860-installer-quit-holder`（額外） | H | ✅ |

其他會建立終端分頁的 spec（N，81 個檔案，見〈遭遇問題〉的排除清單）：**72 passed / 7 failed / 71 skipped**（23.8 分鐘）。

| 失敗 spec | 原因 | 對照 | 判定 |
|---|---|---|---|
| `t0584-bat-mcp-shim`、`t0590-blocked-state`、`t0592-codex-tower-worker`（2 測試）、`t0600-launch-confirmation` | spec 斷言寫死 `<REPO_ROOT>\scripts\bat-mcp.mjs` / `bat-hook.mjs`；打包版是 `resources\scripts\…`（其餘斷言都過） | worktree 原始碼建置（`a05a9c79`）重跑 5 個測試 **全部通過** | spec 只適用原始碼建置，不是產品問題 |
| `detached-workspace` | `detached.url()` 為空字串（line 73） | O 也失敗（同訊息）；原始碼建置也失敗 | 既有問題 |
| `navigation-guard` | 同上（line 182） | O 也失敗；原始碼建置通過 | 既有、時序不穩定 |

skipped 的 71 個測試，都是 spec 自己依條件 skip：環境旗標未設（`BAT_E2E_REAL_MODEL`、`ENABLED` 類 opt-in 驗收）、需要真 WSL / SSH / Docker / 設定檔，或工具不在（`CSC`、codex 版本）等。

**C. 壓力與記憶體**（TS = Terminal Server 自己的 Private Bytes，MB；中位數）

C1 閒置分頁數（各 3 次）：

| 分頁 | N | O | H |
|---|---|---|---|
| 1 | 38.5 | 38.0 | 40.5 |
| 5 | 38.2 | 92.8 | 41.3 |
| 10 | **35.4** | 159.1 | **42.4** |
| 20 | 37.4 | 290.4 | 45.3 |
| 30 | 38.4 | 417.2 | 45.8 |
| 10 → 30 每分頁 | **+0.15** | +12.9 | **+0.17** |

→ N ✅、H ✅（< 45 MB；≤ 0.5 MB／分頁）。30 個分頁都可用。H 量的就是 `bat-pty-holder.exe` 程序。

C2 開關反覆：

| | N | H | O |
|---|---|---|---|
| ① 開始（10 分頁） | 39.7 | 40.9 | 165.4 |
| ① 結束 | 56.8（**300 次**） | 63.4（100 次） | 155.1（100 次） |
| ① 增加 | **+17.1 ❌** | **+22.5 ❌** | −10.3 |
| ① 殘留子程序 | 0（20 = 10 shell + 10 conhost） | 0 | 0 |
| ② 第 0 輪 → 第 19 輪 | 47.4 → 51.4（**+4.0 ✅**） | 60.7 → 57.0（**−3.7 ✅**） | 171.8 → 178.7（+6.9） |
| ② 每次全關後殘留 | 0 | 0 | 0 |

N ① 每 25 次一筆（單次取樣、未靜置）：39.7 → 42.9 / 37.9 / 41.4 / 44.0（100）/ 47.5 / 49.0 / 49.5 / 54.5（200）/ 56.0 / 56.7 / 55.9（275）→ 結束 56.8；第 225 次後停在約 56 MB。①② 結束後分頁都可用。

C3 自然結束（20 分頁各自 `exit` → 再開 10 個）：

| | N | H | O |
|---|---|---|---|
| 20 分頁 | 40.6 | 42.7 | 302.4 |
| 全部 exit 後 | 35.3 | 43.7 | 259.4 |
| 再開 10 分頁 | 37.1 | 44.6 | 390.1 |
| exit 後殘留 | 20 個 conhost | 20 個 conhost | 20 個 conhost |

→ 符合 T0887 預期：O 自然結束的分頁每個仍佔約 13 MB（Worker 不釋放），N / H 不增加。再開的分頁都可用。三者都留下 conhost（既有，見 F4）。

C4 同時大量輸出（10 分頁 × 20,000 行；N、O 各 6 次，兩輪先後順序對調；H 3 次）：

| | N | O | H |
|---|---|---|---|
| 完成時間中位數 | **5814.5 ms** | 4674 ms | 5488 ms |
| N 相對 O | **+24.4% ❌**（門檻 20%） | — | （+17.4%） |
| 峰值 | 256–268 | 347–354 | 318–320 |
| 完成後（10 分頁） | 167.3（閒置 39.9） | 293.6（閒置 164.5） | 230.4（閒置 40.1） |
| 完成標記 / 最後 200 行連續 | 全部 ✅ / 缺漏 0 | 全部 ✅ / 0 | 全部 ✅ / 0 |

各次：N 5980 / 7011 / 5787（第 1 輪）、5842 / 5768 / 5778（第 2 輪）；O 4664 / 5190 / 5417、4619 / 4666 / 4682。同時有使用者的 BAT 在跑，時間僅供參考；不過兩輪順序對調後，N 仍一致較慢。

C5 大量輸出中關閉 5 個（200,000 行）：

| | N | H | O |
|---|---|---|---|
| 每個關閉（到 shell 結束） | 125–187 ms ✅ | 179–180 ms ✅ | 124–186 ms |
| server 存活／同一 pid | ✅ | ✅ | ✅ |
| 其餘 5 個完成 | ✅ | ✅ | ✅ |
| 子程序（剩 5 分頁）／全關後 | 10 / 0 ✅ | 10 / 0 ✅ | 10 / 0 |
| 全關後 TS | 61.9 | 166.0 | 143.8（開始 165.5） |

C6 長時間（30 分鐘，每分鐘取樣）：N 35.6 → 38.6（**+3.0 ✅**），H 40.9 → 45.4（**+4.5 ✅**；第 10 分鐘後持平在 44.6–45.4）；結束後 Ctrl+C，10 個分頁都可用；每分鐘每個分頁輸出都在增加。

C7 Terminal Server 重建（只結束本實例的 server，`taskkill /F /PID`，無 `/T`）：

| | N | H | O |
|---|---|---|---|
| server | 42920 → 13220（fork） | 46164 → 33016（holder → holder） | 13092 → 10304（fork） |
| 10 分頁 前 → 後 | 39.4 → 43.3 ✅ 共用 Worker | 39.5 → 40.1 ✅ 共用 Worker | 163.4 → 162.6 |
| 舊 shell 存活 | 0/10 | 0/10 | 0/10 |
| 分頁可用 | ✅ | ✅ | ✅ |

**驗收 4**：沒設 `BAT_T0888_STRESS` 時 `npx playwright test e2e/t0888-shared-conout-stress.spec.ts` 為 7 skipped，`--list` 列出 7 個；vitest 的 `test.include` 不含 `e2e/`，`npm run test:unit` 不受影響（第 2 次全量 0 failed）。

**手動結束的程序**（只有 C7，各一個，無 `/T`，執行檔先核對為受測建置或本單暫存目錄）：`46164 bat-pty-holder.exe`（H）、`42920 BetterAgentTerminal.exe`（N）、`13092 BetterAgentTerminal.exe`（O）。fixture 的「quit 後 Terminal Server 仍活著就 `taskkill /T`」本單從未觸發。既有 spec 自己結束自己的 server（`t0704` 6952、`t0766` 36208、`t0767` 16076 / 46844、`t0776` 34820，都無 `/T`），以及 fixture 在 `app.close()` 超過 20 s 時結束 Playwright 自己啟動的 Electron（`t0576`、`t0578`、`t0580`、`t0611`、`t0642`、`t0821`，都是會保留 server 的情境），都屬於 spec 與 fixture 原有的行為。

**收尾殘留檢查**（21:57，唯讀）：執行檔在 `%TEMP%\t0888\`、`release\`、`%TEMP%\bat-t0*` 底下的程序 0 個；`bat-pty-holder.exe` 只有使用者自己的 27336（20:33 建立，早於本單）；20:38 之後建立的 pwsh / conhost / OpenConsole / cmd / node / BetterAgentTerminal / codex / claude，沒有一個是父程序已不在的孤兒。本單的 runtime userData（`BetterAgentTerminal-runtime-e2e-t0888*`）與 `%TEMP%\bat-t0888-*` 都已移除；H 的 marker（`resources\installer-quit-request.supported`）已移除。`git -C "$CT_WORKTREE" status --porcelain` 為空。

### 發現

**F1（未達 C2① 條件，新行為）：共用 Worker 存活時反覆開關分頁，Terminal Server Private Bytes 增加 17–23 MB，之後持平。**
- 數據：N 300 次 +17.1 MB（從約 38 MB 爬到約 56 MB，第 225 次後持平）；H 100 次 +22.5 MB；O 100 次 −10.3 MB。最後一個分頁關閉、共用 Worker 結束後就會降回來（N ② 開始時 0 分頁 34.1 MB；②「每次全關再開」N +4.0、H −3.7，都在條件內）。
- 判讀：是有上限的高水位，不像無限洩漏，但只出現在共用 Worker 版。疑點是共用 Worker 或主執行緒內每個連線的狀態，在單一分頁關閉時沒有釋放（可能與 node-pty#887 的 `dispose` 同源），未查證。
- 重現：`$env:BAT_T0888_STRESS='1'; $env:BAT_E2E_EXECUTABLE='<N>\BetterAgentTerminal.exe'; $env:BAT_T0888_LABEL='N'; $env:BAT_T0888_SCENARIOS='C2'; $env:BAT_T0888_C2_CHURN='300'; npx playwright test e2e/t0888-shared-conout-stress.spec.ts`；看 `results/t0888-c2.csv` 的 `part1-churn-*` 與 `part1-end`。

**F2（未達 C4 條件，新行為）：10 個分頁同時大量輸出，N 比 O 慢 24.4%（門檻 20%）。**
- 數據：中位數 N 5814.5 ms、O 4674 ms（各 6 次，兩輪順序對調，結論一致）；H 5488 ms。輸出完整（完成標記與最後 200 行序號全部正確），峰值 N 比 O 低約 90 MB。
- 判讀：10 個 conout 都由同一個 Worker 執行緒讀取，吞吐量低於每個 PTY 各自一個 Worker，這是共用設計的取捨；同機有使用者的 BAT 在跑，時間僅供參考。
- 重現：`BAT_T0888_SCENARIOS='C4'`，對 N、O 各跑一次（不要和其他測試同時跑）。

**F3（觀察，非條件、O 也有）：大量輸出後 Terminal Server 的 Private Bytes 不會降回閒置水準。** C4 後（10 分頁）N 167 MB、O 294 MB、H 230 MB；C5 全部關閉後 N 62 MB、H 166 MB、O 144 MB。O 同樣存在（O 在 C4 後比閒置多約 129 MB，N 多約 127 MB），不是新問題；N 的峰值與剩餘量都不高於 O。H 在 C5 剩較多（166 MB），只量了 1 次。

**F4（既有）：分頁自然 `exit` 後，每個分頁的 conhost 會一直留到 Terminal Server 結束。** N / H / O 都是 20 個分頁 exit 後留下 20 個 conhost；再開分頁不會清掉；server 結束（quit）時會一起結束，收尾檢查沒有殘留。與 T0887〈遭遇問題〉2 的 node-pty#887 同類（自然結束的 PTY 沒有被 dispose）。共用 Worker 版已經解決了每個約 13 MB 的 Worker 殘留（O 在 C3 的 259 MB → N 35 MB），但 conhost 仍在。

**F5（既有，e2e）**：`detached-workspace`（N、O、原始碼建置都失敗）與 `navigation-guard`（N、O 失敗，原始碼建置通過）都在 `detached.url()` 拿到空字串；`t0584`、`t0590`、`t0592`、`t0600` 寫死原始碼的 `scripts\` 路徑，只能用原始碼建置跑（重跑通過）。

**F6（環境）：`t0859` 第 2 次啟動的前提（本機沒有同 key 的 per-machine holder）在這台機器上不成立。** 使用者安裝的 `0.0.0-exp.18`（與 H 同一份程式碼）在 `%ProgramFiles%\BAT-PtyHolder\24.22.2-f2630bed1fc5\` 放了 per-machine holder；per-user holder 被 spec 改壞後，產品依設計改用 per-machine holder，而不是退回 fork（`t0859` line 165 預期 fork）。這是 spec 的環境前提問題，不是產品問題；但也表示機器上有安裝版時，`t0859` 不能用來驗證「退回 fork」。

### 相關通過案例

不適用（工單沒有〈相關通過案例〉；本單只新增測試，沒有改程式或資料）。

### 遭遇問題

1. **`t0859` 從 `%ProgramFiles%\BAT-PtyHolder` 啟動了一個新程序**（工單規定該目錄只能列檔）：見 F6。隔離測試實例（runtime `e2e-t0859-fallback-*`）的 Terminal Server 從使用者已安裝的 per-machine holder 執行檔啟動了**新的**程序 PID 6768，沒有改動該目錄的任何檔案。它在測試實例 quit 時正常結束（`alive after teardown: false`），使用者自己的 server（PID 27336）沒有受影響（收尾時仍在、建立時間 20:33）。事前沒有預料到 spec 會走到 per-machine 路徑；之後沒有再跑 `t0859`。
2. **第 1 次 `npm run test:unit` 有 8 個 RemoteServer 類測試檔 hook timeout**：單獨重跑與第 2 次全量都通過，判定為負載下的逾時 flake。
3. **spec 在執行期間調整過一次**：H 的 C2 跑完後，為了判斷增長會不會停在某個水位，加入 `BAT_T0888_C2_CHURN` 與 ① 每 25 次取樣（預設仍是 100 次）；O、N 的 C2 用的是新版。H 的 C2 是 100 次、沒有中間取樣。另外刪掉了一筆試跑的 C3 結果（標籤 `smoke-H`），CSV 裡沒有這筆。
4. **〈塔台補充〉檢查漏跑兩個節點**：〈驗證前〉與〈產品 commit 前〉沒有跑標題 grep，到〈填回報前〉才讀到〈執行中 #1〉。內容只影響 `base_sha` 的寫法，開工檢查本來就用 `merge-base HEAD v0.8.x`，不需要重做。
5. **B 刻意沒跑的 spec**：`t0777-real-click-focus-regain`（會移動實體游標並以 OS 點擊，會干擾使用者正在用的桌面）；`plan036-p0`、`v072-pre8-remote-workspace-waiting`（使用真 WSL distro，可能碰到使用者 WSL 內的 bat-server）；`t0888` 本身另外跑；`t0859` / `t0860` / `t0861` 用 H 跑。其他需要真 SSH / Docker / 真模型 / opt-in 旗標的 spec 都由 spec 自己 skip（列在 71 skipped 內）。
6. 同機有使用者的 BAT（安裝版 `0.0.0-exp.18`）在跑，時間類數字（C4、C5 的 ms）僅供參考；Private Bytes 不受影響。另外 H 的 C6 與 H 的 C1–C5／C7 部分時間重疊，N 的 C6 也與 N／O 的其他情境部分時間重疊；C4 的 N／O 比較是在沒有其他測試同時執行時跑的。

### 子代理與 Workflow 使用

未使用。

### Renew 歷程

無。

### 方法論狀態回寫

不適用（工單沒有 `methodology`）。

### 建議下一步

**對發 `v0.8.0-pre.1` 的建議：需塔台裁示；Worker 建議「可發預覽版，但把 F1、F2 列為已知限制」。**
- 依工單條件，C2①（F1）與 C4 時間（F2）未通過，其餘（C1、C2②、C3、C5、C6、C7、全部 B 回歸）都通過，或確認是既有問題。
- F1 的最壞觀察值是 +17～23 MB 後持平；O 光是 10 個閒置分頁就比 N 多約 120 MB，所以實際記憶體仍遠低於舊版。F2 只在多分頁同時大量輸出時出現（慢約 1.1 s／10 × 20,000 行），輸出完整、沒有遺漏。
- 建議另開工單：① F1 調查單一分頁關閉時共用 Worker 與主執行緒的釋放（可與 node-pty#887 的 `dispose` 一起看，也涵蓋 F4 的 conhost）；② F2 評估是否改成少量 Worker（例如每 N 個 PTY 一個）以換回吞吐量；③ F5 修 `detached-workspace` / `navigation-guard` 的 detached 視窗網址等待，以及 4 個 spec 支援打包版的 `resources\scripts` 路徑；④ `t0859` 在偵測到同 key 的 per-machine holder 時改為 skip 第 2 段（F6）。

### 回報時間

2026-11-23T22:00:25+08:00
