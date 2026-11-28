---
schema_version: 1
schema_kind: workorder
id: T0983
title: "PLAN-066 F4（選項 D）＋BUG-238＋direct 模式 conin：自然結束的分頁在 ✕ / ⏻ / 同 id 重建時收掉 conhost；關分頁不再經 node-pty `kill()` 對已結束的 pid 呼叫 `process.kill`"
type: bugfix
status: DONE
repo: better-agent-terminal
priority: P2
sizing: M
created_at: "2026-11-28T19:04:38+08:00"
started_at: "2026-11-28T19:11:08+08:00"
updated_at: "2026-11-28T19:38:06+08:00"
completed_at: "2026-11-28T19:38:06+08:00"
session_ids:
  - "02c7441e-4ddf-4963-970a-7f6795aedb3f"
target_version: "下一個預覽版（`0.8.1-pre.6`；改 `terminal-server.js` → holder key 改變，發版前要跑 W6，發版前與使用者確認）"
depends_on: [T0982]
related:
  - "T0979（研究：③ F4、② direct conin、〈其他發現〉pid 重用，回報區〈可行修法〉與〈風險與不變式對照〉）；BUG-238；PLAN-066；T0540（程序樹結束順序）；T0539（⏻ 重啟）；T0704（recovery）；T0857（協定 v1 只做相加）；T0861（holder 接回）；T0887 / T0889（共用 conout Worker、`releaseEndedPtyInput`）；T0888（C3、量測 spec）；D521；D522（U-76：D、U-77：A）"
affects_files:
  - _ct-workorders/T0983-f4-release-exited-pty-on-close.md
  - electron/terminal-server/server.ts
  - electron/terminal-server/shared-conout.ts
  - electron/terminal-server/process-tree.ts
  - electron/pty-manager.ts
  - electron/__tests__/
  - experiments/node-pty-worker/
  - docs/agent-guide/terminal-server-recovery.md
  - docs/agent-guide/pty-process-tree.md
  - docs/agent-guide/pty-holder.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0983` 寫檔（base = 派工當下的 `main`，應已含 T0982 合併的 `experiments/node-pty-worker/t0979/`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 先讀 T0979 回報區〈③ F4〉〈② direct 模式 conin socket 殘留〉〈其他發現〉〈F4 產品選擇〉與 BUG-238，以那裡的量測、修法與不變式對照為規格。"
  - "🔴 使用者裁示（D522）：F4 採**選項 D**——shell 自己結束、分頁還開著（顯示 `[Process exited …]`）時保留 conhost；使用者按 ✕ 關閉、⏻ 重啟、或同 id 重建（BAT 重開恢復該分頁、holder 接回後恢復）時收掉。收掉時仍附著同一主控台的背景程序會一起結束（與 live 分頁 ✕ 結束整個程序樹的規則一致）。🔴 不做 A / B / C：shell 結束時不自動收、不偵測子孫。BUG-238 併入本單（U-77：A）。"
  - "🔴 修法（T0979 推薦案；細節可依實作調整，偏離時回報理由）：① `electron/terminal-server/shared-conout.ts` 新增 `releaseExitedPty(proc, platform)`：win32 且 node-pty 1.1.0 形狀相符（`_agent._ptyNative.kill`、`_agent._pty`、`_agent.inSocket`、`_agent._conoutSocketWorker.dispose`）時依序 ClosePseudoConsole → destroy conin → dispose 該 PTY 的 conout 轉送；形狀不符什麼都不做並記一行（不記 env / 內容）。② `server.ts`：`handlePtyExit` 在 win32 把自然結束的 proc 記進 `exitedPtys`（id → proc）；`killPty` 找不到 live entry 但 `exitedPtys` 有 → 釋放；`createPty` 遇到同 id 的 exited proc → 先釋放再 spawn；server `shutdown` 時一併釋放。③ BUG-238：`endPty`（T0540：先 `killProcessTree` 再 `pty.kill()`）改成程序樹結束後以同一套釋放收掉，🔴 不再呼叫 node-pty 的 `pty.kill()`（它會在 shell 已結束時 5 s 後對舊 pid `process.kill`）；direct 模式（`pty-manager.ts`）同理。🔴 T0540「先結束程序樹、再收 PTY」的順序不得對調。④ `pty-manager.ts`：`kill(id)` 在 `useServer` 且 instance 已因 exit 被刪除時，照樣送 `pty:kill`（舊 server 對不存在的 id 不做事、不回應，相容）；direct 模式在 `handleDirectExit` / `kill` 做同樣的記錄與釋放，並解決 ② conin 殘留（沿用 T0889 `releaseEndedPtyInput` 或新函式）。"
  - "🔴 不得改變：協定（🔴 不新增訊息類型，只是 `pty:kill` 對已結束的 id 多做釋放；新 host＋舊 server、舊 host＋新 server 兩方向都要相容並在回報區說明）；live 分頁 ✕ 的程序樹結束（T0540）；⏻ 重啟的新 PTY 建立、120x30 與尺寸同步（T0572 / T0539）；Terminal Server recovery（T0704）與孤兒清理順序；Recovery create hold（T0578）；holder 接回（T0861）；共用 conout Worker 規則（T0887 / T0889：輸出仍由 Worker 排空、批次轉送、Worker 當掉不自動重建、🔴 不改 `shared-conout-worker.cjs`）；node-pty 釘版 `1.1.0`；非 win32 行為逐字不變（macOS / Linux 不呼叫新函式）。"
  - "🔴 測試：擴充 `electron/__tests__/shared-conout-release.test.ts`（或新檔，Windows 真 node-pty；非 win32 skip）：自然結束後 conhost 仍在 → ✕（`pty:kill`）後不在；附著主控台的背景程序（T0979 `attached` 情境，`Start-Process -NoNewWindow ping`）在 ✕ 後結束、分頁開著時不結束；同 id 重建前先釋放；形狀不符不碰；source guard：`exitedPtys` 路徑與 `endPty` 不呼叫 `.kill()`（node-pty 的）；host `kill(id)` 對已結束的 id 會送 `pty:kill`；direct 模式 conin socket 不再累積。既有測試斷言不改（若必須改，先問塔台）。"
  - "🔴 量測（回報區附數字）：以 T0979 的 `experiments/node-pty-worker/t0979/ts-exit-residue.mjs`、`pty-end-residue.cjs`（必要時改成可帶 `--fix` 或新增情境，留在 `experiments/`）對修正前 / 後各跑一次：20 個自然結束後再 ✕ → conhost 0；direct 模式 100 次 kill 的 `PipeWrap` 不累積。只驅動自己 fork 的 Terminal Server / 自己載入的 node-pty，🔴 不碰使用者正在用的安裝版 BAT、Terminal Server、PTY holder，不用預設 userData；收尾殘留檢查列 PID。🔴 不得在開發機跑 W6 / 真的安裝程式（CLAUDE.md「Windows PTY holder」）。"
  - "🔴 不回歸（R-G003）：T0540 / T0539 / T0572 / T0578 / T0704 / T0857 / T0861 / T0866 / T0887 / T0889 / T0890 / T0947 / T0950 / T0957 相關測試逐一核對，回報區列〈相關通過案例〉；跑 `e2e/t0888-shared-conout-stress.spec.ts` 中原始碼建置即可跑的情境（C3）或說明為何不能跑。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。回報區寫明 holder key 是否改變（預期改變 → 塔台發版前跑 W6 `windows-upgrade-acceptance.yml`）。"
  - "🔴 文件：`docs/agent-guide/terminal-server-recovery.md`「Windows：共用 conout Worker」F4 段改寫（選項 D、釋放時機、背景程序行為）；`pty-process-tree.md`（`endPty` 不再呼叫 `pty.kill()`、BUG-238）；`pty-holder.md`（holder key 變動）；CLAUDE.md「Terminal Server 存活判定與 recovery」節共用 conout 一點與「關閉分頁時的程序樹」節各補一句（標題不改，T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0983 — F4（選項 D）＋BUG-238＋direct 模式 conin 釋放

## 背景

T0979 研究 PLAN-066 後續：Windows Terminal Server 模式下，shell 自己結束的分頁每個留 1 個 conhost（約 1.6 MB）＋約 13 個 handle 到 server 結束，holder 保留時會跨 BAT 重開累積，之後關掉分頁也不會釋放。另發現關分頁時 node-pty `kill()` 會在 shell 已結束 5 s 後對舊 pid 呼叫 `process.kill`（BUG-238）。使用者 2026-11-28 裁示：F4 採選項 D（關閉或重啟分頁時收）、BUG-238 併入本單（U-76：D、U-77：A，D522）。direct 模式的 conin 殘留（T0979 ②）同一套釋放一起做。

## 範圍

- `releaseExitedPty`、Terminal Server 的 `exitedPtys` 與 `pty:kill` / 同 id 重建 / shutdown 釋放、`endPty` 不經 node-pty `kill()`、host 對已結束的 id 送 `pty:kill`、direct 模式同等處理。
- 真 node-pty 測試、修正前後量測、文件。

## 不做

- 不改協定訊息類型、`shared-conout-worker.cjs`、node-pty 版本；不做 F4 的 A / B / C；不做「只送 env 差異」（T0979 ①，延後）；不跑 W6；不發版。

## 驗收

- [ ] 自然結束的分頁在 ✕ / ⏻ / 同 id 重建後 conhost 結束；分頁開著時保留；附著主控台的背景程序在 ✕ 後結束
- [ ] `endPty` 與 direct 模式不再呼叫 node-pty `kill()`（source guard＋測試）；T0540 順序不變
- [ ] 新舊 host / server 組合相容（回報區說明）
- [ ] 修正前後量測（conhost 數、`PipeWrap`）
- [ ] 〈相關通過案例〉判定；既有斷言未改
- [ ] `npm run test:unit` head 第一次全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] holder key 是否改變；docs 更新

---

## 回報區

### 完成狀態

- **狀態**：DONE（驗收 7 項全部完成）
- **session_id**：02c7441e-4ddf-4963-970a-7f6795aedb3f
- 開始 2026-11-28 19:11 / 完成 2026-11-28 19:37（UTC+8）

### 落點檢查

- 結果：PASS。C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`。C-1：工單在 `$CT_HOME/_ct-workorders/` 下。C-3：`affects_files` 前幾項都存在（informational）。C-2：工單沒有 `branch` 欄位。
- `CT_HOME` = 主 checkout，`CT_WORKTREE_BRANCH` = `ct/T0983`；`BAT_WORKSPACE_ID` 有設定（只記錄）；`BAT_REMOTE_TOKEN` 已設定。

### SHA

- `branch`：`ct/T0983`
- `base_sha`：`b754a2c14fa51a66d84134b1a18b71296254c738`
- `validated_sha`：`89327c0aefcefe42dfe5f4eec95a9037f573fa73`
- `head_sha`：`89327c0aefcefe42dfe5f4eec95a9037f573fa73`（= validated_sha）
- commit：`f44a28db` 產品＋測試＋量測腳本、`2dbe7e3f` 文件＋量測結果、`89327c0a` T0888 e2e 結果

### 做了什麼

1. **`releaseExitedPty(proc, platform)`**（`electron/terminal-server/process-tree.ts`）：win32 且 node-pty 1.1.0 形狀相符（`_agent._ptyNative.kill`、`_agent._pty`、`_agent.inSocket`、`_agent._conoutSocketWorker.dispose`）時依序 `_close()` → ClosePseudoConsole → destroy conin → dispose conout 轉送；每步各自 try、一步失敗不跳過其他步（回 `failed:<步驟>`）；同一物件只做一次（WeakSet，原生 kill 不會對同一個 pseudo console 跑兩次）；非 win32 不讀物件；形狀不符什麼都不碰（呼叫端記一行，不記 env / 內容）。🔴 不呼叫 node-pty 的 `kill()`。
2. **Terminal Server**（`server.ts`）：`handlePtyExit` 在 win32 把自然結束（exit 的仍是該 id 目前的 entry）的 proc 記進 `exitedPtys`；`killPty` 找不到 live entry 但有已結束的 → 釋放；`createPty` 同 id → spawn 前先釋放；`shutdown` 全部釋放。`endPty`（Windows）：`killProcessTree` 之後 `releaseExitedPty`，不再呼叫 `pty.kill()`（BUG-238）；T0540 順序不變。
3. **主行程**（`pty-manager.ts`）：Windows host 收到自己 instance 的 `pty:exit` 時記 `serverExitedIds`；`kill(id)` 對這個 id 照樣送一次 `pty:kill`（回傳仍 `false`）；同 id `pty:create`、recovery 清掉。direct 模式：`handleDirectExit` 記 `exitedDirectPtys`，`kill` / 同 id `create` 時釋放；live 分頁 `kill` 在 Windows 改成 `taskkill /F /T` 之後 `releaseDirectPty`（同時解決 T0979 ② conin 殘留）。macOS / Linux 不記、不送、`kill()` 照舊。
4. 測試 `electron/__tests__/exited-pty-release.test.ts`（22 項，見〈驗證〉）；量測腳本擴充；文件。

### 偏離工單建議的地方（理由）

1. **`releaseExitedPty` 放在 `process-tree.ts`，不是 `shared-conout.ts`**：direct 模式（`pty-manager.ts`）也要呼叫它，而既有 `shared-conout.test.ts` 的 source guard（「只有 `server.ts` 安裝；`pty-manager.ts` 沒有」，D308 Q-B）要求 `pty-manager.ts` 完全不出現 `shared-conout`。為了不改既有斷言，放在兩邊本來就 import 的 `process-tree.ts`（在 `affects_files` 內）。`shared-conout.ts` 最後沒有改動。T0889 的 `releaseEndedPtyInput` 保留在 `handlePtyExit`，變成冪等的保險（`endPty` 已先 destroy conin → `skipped:already`）。
2. **形狀不符時退回 node-pty `kill()`**：`endPty` 與 direct 模式在 `releaseExitedPty` 回 `skipped:shape` 時（PTY 物件不是 node-pty 1.1.0 的形狀；釘版下不會發生）呼叫 `pty.kill()` 並記一行，也就是 T0983 前的行為。不這樣做的話，萬一形狀變了，每個 ✕ 都會留下 conhost（新的殘留），風險比 BUG-238 大。自然結束的分頁不退回（那正是 BUG-238 的情境）。source guard 檢查的是「Windows `endPty` 路徑不呼叫 `entry.pty.kill(`」與「釋放已結束 PTY 的路徑不呼叫 `.kill(`」，退回寫在獨立的 `fallbackNodePtyKill`。另一個好處：既有 T0540 測試用的假 PTY 沒有 node-pty 形狀，走退回路徑，原有「taskkill 在 kill 之前」的斷言不必改。
3. 主行程只在 id 是「本行程看過自然結束」時才對已結束的 id 送 `pty:kill`（`serverExitedIds`），不是對所有不認得的 id 都送：避免對正在建立的同 id PTY 誤送 kill，也讓 macOS / Linux 逐字不變。

### 新舊 host / server 組合相容

- 協定不新增訊息類型；只是 `pty:kill` 對已結束的 id 多做釋放。
- **新 host＋舊 server**（升級後接回上一版 holder 的 server）：host 對已結束的 id 送 `pty:kill`，舊 server 的 `killPty` 找不到 entry → 什麼都不做、不回應（T0983 前就是這樣）→ 照舊殘留到那個 server 結束；live 分頁 ✕ 照舊經舊 server 的 `pty.kill()`。
- **舊 host＋新 server**（降級後接回新版 holder 的 server）：舊 host 不送已結束 id 的 `pty:kill` → 只在同 id `pty:create`（⏻、BAT 重開恢復分頁）與 `shutdown` 時釋放；live 分頁 ✕ 由新 server 的 `endPty` 處理（不經 node-pty `kill()`）。
- 兩方向都不會出錯，只差在舊的一端那邊照舊殘留。

### holder key

- **改變**。`dist-electron/terminal-server.js` 修正前 sha256 `330dbadc…0e96`、修正後 `c0a84152…9a5e`；`shared-conout-worker.cjs` 兩者相同（`507080df…b392`，未改）；node-pty、`package.json` 未改。holder 檔案清單含 `terminal-server.js` → key 改變 → **塔台發版前要跑 W6 `windows-upgrade-acceptance.yml`**（本單沒有跑 W6、沒有跑安裝程式）。

### 量測（修正前 / 後）

修正前 = base `b754a2c1` 三個原始檔（`server.ts` / `process-tree.ts` / `pty-manager.ts`）的 `npx vite build`（在 worktree 暫時寫回 base 內容建置、複製產物到 scratchpad 後，以 `git show HEAD:` 寫回、`status` 確認乾淨）；修正後 = T0983。結果檔 `experiments/node-pty-worker/results/t0983-ts-exit-residue.jsonl`、`t0983-pty-end-residue.jsonl`。

Terminal Server（`ts-exit-residue.mjs --count 20 --server <建置>`，Electron 當 node、`--max-semi-space-size=1`）：

| 時點 | 修正前 conhost / handle / Private | 修正後 conhost / handle / Private |
|---|---|---|
| 20 分頁開著 | 20 / 594 / 38.6 MB | 20 / 594 / 38.8 MB |
| 20 個自然結束後 10 s（分頁開著） | 20 / 454 / 38.6 MB | 20 / 454 / 38.6 MB（選項 D 保留） |
| 對這 20 個 id `pty:kill`（✕）後 3 s | **20** / 454 / 38.6 MB | **0** / 230 / 29.4 MB |
| 另開 20 個、BAT 關閉後 1 s | 34 / 781 | **0** / 341 |
| 同上 12 s | 20 / 481 / 36.3 MB | 0 / 257 / 24.4 MB |

- 「20 個自然結束後再 ✕ → conhost 0」達成。BAT 關閉 1 s 後修正前還有 14 個 conhost 在等 node-pty 的 5 s 逾時（BUG-238 那段），修正後 0。
- 腳本另記了 `consoleListAgents`（server 底下的 `conpty_console_list_agent` 子程序數），修正前後都是 0：那個 agent 查詢失敗後立刻結束，等待是 node-pty 程序內的 5 s 計時器，不是子程序，所以這一欄無法當 BUG-238 的證據；證據是上一點的 conhost 釋放時間與測試的 `fork` 攔截（見〈驗證〉）。

direct 模式（`pty-end-residue.cjs`，Electron 當 node＋`--import tsx`；修正後 = `--fix product`，即產品的 `releaseExitedPty`）：

| 情境 | 修正前（`--fix none`） | 修正後（`--fix product`） |
|---|---|---|
| `kill` 100 次後 `PipeWrap` / handle | 102 / 436 | **2** / 336 |
| `exit` 20 個（修正後在 exit 後即釋放 = 模擬 ✕）30 s 後 conhost / `MessagePort` / Private | 20 / 20 / 348.1 MB | **0** / 0 / 48.2 MB |
| `attached`（`Start-Process -NoNewWindow ping -n 40` 後 `exit`） | exit 後 ping 仍在跑 | exit 後 ping 仍在跑；釋放後 3 s ping 結束、conhost 結束 |

- 「direct 模式 100 次 kill 的 `PipeWrap` 不累積」達成（102 → 2）。

T0888 e2e（`e2e/t0888-shared-conout-stress.spec.ts`，`BAT_T0888_SOURCE=1`、隔離 runtime、`BAT_T0888_SCENARIOS=C2,C3,C5,C7`、`RUNS=1`，結果 `experiments/node-pty-worker/results/t0983-c{2,3,5,7}.csv`）：**4 passed**（C1 / C4 / C6 / C8 未選，skipped）。
- C2① +-0.7 MB（≤ 5）、子程序 20；C2② +5.0 MB、全關後殘留子程序 0。
- C3：20 分頁 43 MB → 全部自然結束 38.6 MB → 再開 10 個 40.2 MB；自然結束後子程序 20（C3 不關分頁，選項 D 保留 conhost，與修正前相同）。
- C5：大量輸出中關閉 124 / 185 / 184 / 184 / 200 ms，server 存活，子程序 10。
- C7：recovery 38012 → 44556（fork），10 分頁 38.7 → 38.3 MB，舊 shell 存活 0（spec 自己結束了它的 C7 server pid 38012，`ended pid` 有記）。

### 驗證

| 關卡 | 結果 |
|---|---|
| worktree `npm ci` | exit 0 |
| `npm run test:unit`（head `89327c0a` 第一次完整執行） | **536 files passed / 3 skipped；9689 tests passed / 42 skipped**，exit 0 |
| `npm run test:legacy` | 33 files passed / 0 failed；472 tests passed / 0 failed，exit 0 |
| `npx vite build` | exit 0 |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| T0888 e2e C2 / C3 / C5 / C7（原始碼建置） | 4 passed |

新測試 `electron/__tests__/exited-pty-release.test.ts`（22 項，Windows 上全跑；非 win32 的 5 項真 node-pty 會 skip）：
- `releaseExitedPty`：非 win32 不讀；順序 `close → native-kill → conin → conout`、不呼叫 node-pty `kill()`、第二次 `skipped:already`；conin 已 destroy 不重複、一步失敗不跳過；四個欄位任一缺少 → `skipped:shape` 且什麼都不碰。
- Server（假 PTY）：自然結束保留、`pty:kill` 釋放一次、exit 照常廣播；`shutdown` 釋放；BAT kill / 重啟的 exit 不記；非 win32 不記不放；`endPty` taskkill 後釋放、不呼叫 `kill()`；形狀不符退回 `kill()` 並記一行。
- 主行程：Windows host 對自然結束的 id 送一次 `pty:kill`（回 `false`）；同 id create 取代；非 Windows 不送。direct：live kill 釋放、不呼叫 `kill()`；自然結束 ✕ 釋放；非 Windows `kill()` 照舊。
- Source guard：`releaseExitedPty` 只有 `native.kill(`；server 的 Windows `endPty` 路徑沒有 `entry.pty.kill(` 且 `killProcessTree` 在 `releaseExitedPty` 之前；`releaseExited` 沒有 `.kill(`；`createPty` 的釋放在 `pty.spawn(` 之前；direct `kill` 的 taskkill 在釋放之前、`releaseExitedDirect` 沒有 `.kill(`。
- Windows 真 node-pty：自然結束後 conhost 還在、✕ 後結束；BAT 關閉 live 分頁後 conhost 結束、**沒有 fork `conpty_console_list_agent`**（攔截 `child_process.fork`，BUG-238）；附著的 ping 在分頁開著時存活、✕ 後結束；同 id 重建前先結束舊 conhost；direct 模式 3 次 kill 後 conin socket 回到基準，自然結束 ✕ 後 conhost 結束、conin 回到基準。

### 相關通過案例判定（R-G003 不回歸）

工單沒有客戶驗收案例表；以下以既有測試（全在本次 `test:unit` 全綠內）與 e2e 核對，既有測試斷言一個都沒改：

| 項目 | 對應測試 / 證據 | 判定 |
|---|---|---|
| T0540 程序樹先結束 | `terminal-server-kill-tree.test.ts`（假 PTY 走形狀不符退回，「taskkill 在 kill 之前」照舊）、`pty-manager-heartbeat-recovery.test.ts`；新測試 Windows 真 node-pty 的 taskkill → 釋放順序 | 成立 |
| T0539 ⏻ 重啟 | `pty-restart-or-create.test.ts`；已結束分頁的 ⏻ = 同 id `pty:create` → server 先釋放（新測試真 node-pty） | 成立 |
| T0572 新 PTY 120x30 與尺寸同步 | `terminal-pty-size-sync.test.tsx`；`createPty` 的 spawn 參數未改 | 成立 |
| T0578 Recovery create hold | `recovery-create-hold.test.ts`、`recovery-dispatch-hold.test.ts`；釋放只在 create / kill 內，create 本來就受 hold 管 | 成立 |
| T0704 recovery | `pty-manager-heartbeat-recovery.test.ts`、`pty-manager-interrupted-agents.test.ts`；e2e C7 舊 shell 0 存活 | 成立 |
| T0857 協定 v1 只做相加 | `terminal-server-protocol-v1.test.ts`；沒有新訊息類型 | 成立 |
| T0861 holder 接回 | `holder-reattach.test.ts`；新舊組合見上節 | 成立 |
| T0866 stdio 繼承 | `win-stdio-inherit.test.ts` / `.mjs`；未改 | 成立 |
| T0887 共用 conout Worker | `shared-conout.test.ts`（含「只有 server.ts 安裝」source guard）；`shared-conout-worker.cjs` 未改，dispose 只走既有 1 s 排空 | 成立 |
| T0889 批次轉送、conin 釋放 | `shared-conout.test.ts`、`shared-conout-release.test.ts`（自然結束「保留 1 個 conin」的斷言照樣成立：選項 D 在分頁關閉前保留） | 成立 |
| T0890 V8 旗標 | `pty-holder.test.ts`；未改 | 成立 |
| T0947 / T0950 / T0957 ⏻ 殘留滑鼠追蹤 / alt screen / 游標 | `mouse-tracking-restart.test.ts`、`alt-screen-restart.test.ts`、`cursor-restart.test.ts`、`terminal-context-menu.test.tsx`；renderer 端，未改 | 成立 |
| BUG-101 stale exit | `terminal-server-stale-exit.test.ts`、`pty-manager-server-exit.test.ts`；stale exit 不記進 `exitedPtys` | 成立 |
| 非 win32 逐字不變 | 新測試的 darwin / linux 情境；server / 主行程都以平台判斷不進新路徑 | 成立 |

### 文件

- `docs/agent-guide/terminal-server-recovery.md`「Windows：共用 conout Worker」：必守規則加自然結束（選項 D）與不經 `kill()`；唯一實作位置表加一列；生命週期改寫；新小節〈自然結束的分頁：關閉或重啟時收掉〉（釋放時機、步驟、server / 主行程 / direct、新舊組合）；新小節〈量測（T0983）〉；驗證清單加新測試。
- `docs/agent-guide/pty-process-tree.md`：direct 模式與 `endPty` 不再呼叫 `pty.kill()`（BUG-238）、自然結束的分頁、驗證。
- `docs/agent-guide/pty-holder.md`〈已知限制〉：holder key 變動與接回舊 holder 的行為。
- `CLAUDE.md`：「Terminal Server 存活判定與 recovery」共用 conout 一點、「關閉分頁時的程序樹」第一點各補一句（標題不改）。CLAUDE.md 由 100,053 字變 100,266 字（本來就略超過 100k 目標；補充已精簡到最短）。

### 手動結束的程序 / 收尾殘留檢查（2026-11-28 19:36，唯讀）

- 我沒有用 taskkill 結束任何不是本單建立的程序。量測腳本只結束自己 spawn 的 pwsh / ping（`shellsStillAliveAtEnd: []`），Terminal Server 一律 `server:shutdown`（`tsExited: true` 兩次）；e2e spec 自己結束了它的 C7 server（pid 38012，spec 規則內）。
- 19:11 之後建立的 pwsh / conhost / cmd / node / electron / PING / powershell / BetterAgentTerminal / bat-pty-holder：只有 chrome 起的 cmd 32276＋conhost 35668、Git Bash 的 conhost 38436、本 session 工具呼叫的 cmd 44824 / pwsh 42436 / conhost 27904，父程序都在；沒有父程序已不在的程序；執行檔在 worktree 內的 0 個。
- 沒有連使用者的 BAT、Terminal Server 或 PTY holder，沒有用預設 userData，沒有跑 W6 或安裝程式。
- `git -C "$CT_WORKTREE" status --porcelain`：空。

### 遭遇問題

1. 第一次建「修正前」server 只寫回了 `server.ts` / `process-tree.ts`，main bundle 因 `pty-manager.ts` import 新函式而建置失敗；改成三檔一起寫回 base 再建，並以字串比對確認修正前產物沒有新程式、修正後重建與先前產物逐位元組相同。
2. `consoleListAgents` 欄位量不到 BUG-238（見〈量測〉說明），改以 conhost 釋放時間與測試的 `fork` 攔截為證據。
3. `check-frontmatter.py` 第一次以 `~` 路徑呼叫時原生 Python 找不到檔（R-G005：要 `cygpath -m`），改後 PASS。

### 互動紀錄

無（yolo，沒有向塔台提問；工單沒有〈塔台補充〉）。

### 建議下一步

1. 塔台合併 `ct/T0983`（base 與 `main` 的關係以 `--worktree-status` 為準）；BUG-238 改 FIXED。
2. 發版前跑 W6 `windows-upgrade-acceptance.yml`（holder key 改變）。
3. 已知殘留（非本單）：由 BAT 關閉的分頁每個仍多約 1 個 handle（T0979 ② / ③ 表，來源在 node-pty 原生層）；direct 模式量到 handle 436 → 336，Terminal Server 關閉 20 個後 199 → 257，仍未歸零。
