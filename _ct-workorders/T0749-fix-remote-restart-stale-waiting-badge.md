---
schema_version: 1
schema_kind: workorder
id: T0749
title: "BUG-182 修正：遠端 bat-server 重啟並重連後，舊 PTY 已不存在的分頁要清掉等待 ⚠️ 與淡化"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T20:50:17+0800"
started_at: "2026-11-01T20:51:19+0800"
updated_at: "2026-11-01T21:07:44+0800"
completed_at: "2026-11-01T21:07:44+0800"
session_ids:
  - "907e502b-6d49-4487-bff0-3f1de6f07294"
commits:
  - "01796a9e"
depends_on: []
related:
  - "BUG-182（T0748 回報區〈發現的問題〉1）；T0748（`b0358c8a`，`e2e/v072-pre8-remote-workspace-waiting.spec.ts` ⑤ 目前以 INFO 記錄殘留）；T0735（D200–D203 工作區 ⚠️、淡化）；T0609（Worker 標籤 ⚠️ / `?`）"
  - "CLAUDE.md「Worker 分頁回收」節（T0735 段、T0609 段）、「多 remote profile 同時連線（PLAN-039）」、「Terminal Server 存活判定與 recovery」；`docs/agent-guide/worker-tab-recycle.md`（已知限制：遠端 server 重啟時舊分頁的標示）"
affects_files:
  - "src/stores/terminal-attention-store.ts（推測）"
  - "src/lib/terminal-attention.ts（推測；`waitingForUser` / `nextWaitMemory` 唯一實作）"
  - "electron/terminal-attention.ts / electron/remote/remote-connection-registry.ts / electron/remote/remote-client.ts / electron/main.ts（推測：重連時的對帳或快照）"
  - "e2e/v072-pre8-remote-workspace-waiting.spec.ts（⑤ 由 INFO 改為斷言）"
  - "對應的 unit test（新增或擴充）"
  - docs/agent-guide/worker-tab-recycle.md
  - "CLAUDE.md（「Worker 分頁回收」節只補一句：唯一實作位置）"
  - _ct-workorders/T0749-fix-remote-restart-stale-waiting-badge.md
  - _ct-workorders/BUG-182-remote-server-restart-stale-waiting-badge.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 目標（BUG-182）：遠端 profile 視窗的分頁在等待中（hook 或 OSC），遠端 bat-server 重啟、視窗重連後，該分頁在 server 端已沒有 PTY → 工作區列、頁籤標題總數、收合窄列、縮圖、Worker 標籤的實心 ⚠️ 都要清除；總數不再多算。重連後 server 端仍有 PTY 且仍在等待的分頁 → ⚠️ 保留（不得一律清空）。先查清楚現況再決定做法：重連時 renderer / main 是否重新取得 attention 快照、server 重啟後分頁沒有 PTY 是否符合預期（本單只需記錄，不改 PTY 重建行為）。做法候選：重連時依 server 端現存 PTY 對帳（不存在的 id 清 attention），或以 server 回報的 attention 快照取代該 profile 的舊狀態。🔴 判斷依據只能是 server 端的現況（PTY 是否存在 / attention），不得用主行程或遠端主機時間比對（沿用 T0694 規則）。"
  - "🔴 淡化（D203）：被對帳清除的等待算不算『使用者沒看就結束』要寫明選擇並記理由；建議：PTY 已消失 = 等待被中斷，比照 PTY 結束事件的既有處理（現在 PTY 結束時怎麼做就怎麼做，不新增規則）。"
  - "🔴 不回歸（R-G003 已驗收案例）：T0735 / T0736 / T0747 / T0748 的情境 ①–④ 與本機分頁行為不變；Worker 分頁 `✓` / `↻` / `?` / 批次關閉計數（T0538 / T0609 / T0694）不變；本機 Terminal Server recovery（T0704）不受影響；detached 視窗不涵蓋（D201）。回報區必列〈相關通過案例〉判定。"
  - "🔴 驗證：unit test 涵蓋：重連後 PTY 不存在 → 清除、PTY 存在且仍等待 → 保留、多 profile 互不影響；`e2e/v072-pre8-remote-workspace-waiting.spec.ts` ⑤ 改為斷言（重連後 ⚠️ 清除、總數正確），連跑 2 次綠，並以未修正的程式（例如暫時還原修正）確認 ⑤ 會失敗（突變檢查，結果寫回報區，還原後再 commit）；重跑 `t0735-workspace-waiting-badge`、`v072-pre8-workspace-waiting-real-agents`、`t0609-worker-attention-badge`、`t0694`（↻）相關 spec 綠。`npm run test:unit` 全過、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功。WSL 測試做法沿用 T0748（`/tmp/bat-e2e-t07xx`、不經 systemd、不動使用者的 WSL bat-server，前後比對；WSL 未執行就 skip，不由測試啟動 WSL）。"
  - "🔴 文件：`docs/agent-guide/worker-tab-recycle.md` 已知限制改寫為修正後的行為；CLAUDE.md「Worker 分頁回收」節只補一句（唯一實作位置），細節寫 docs。完成後 BUG-182 改 FIXED（附 commit）。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑、WSL 使用者名稱或帳號。"
  - "🔴 範圍：只修 BUG-182；發現其他缺陷記在回報區〈發現的問題〉，由塔台開單。真正的網路中斷（server 仍在）若同一修正自然涵蓋就順便驗，否則記錄不做。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0749 — BUG-182 修正：遠端 server 重啟後殘留的等待 ⚠️

## 元資料

- **工單編號**：T0749
- **類型**：implementation（bug fix）
- **優先級**：P2
- **建立時間**：2026-11-01T20:50:17+0800
- **預估規模**：S

## 背景

T0748 驗收 WSL 遠端工作區 ⚠️ 時發現：遠端 bat-server 重啟、視窗重連後，等待中的分頁在 server 端已沒有 PTY，但 ⚠️ 一直留著，看過、送 idle 都清不掉，總數多算 1，只有 ⏻ 重啟分頁才消失。docs 的已知限制假設「下一次變更」會來，實際上不會。使用者指示現在修。

## 範圍

1. 查清重連時 attention 的來源與現況，選定對帳做法並實作。
2. unit test、e2e ⑤ 改為斷言（含突變檢查）。
3. docs / CLAUDE.md 一句；BUG-182 → FIXED。

## 不做

- 不改 server 重啟後 PTY 是否重建的行為（只記錄現況）。
- 不做本機視窗顯示遠端工作區（另案）、不涵蓋 detached 視窗。

## 驗收

- [ ] 重連後 PTY 不存在 → ⚠️ 與總數清除；仍存在且等待 → 保留
- [ ] 淡化處理的選擇與理由
- [ ] unit / e2e（⑤ 連跑 2 次＋突變檢查）/ 相關 spec / typecheck 0 / 0 / build
- [ ] 〈相關通過案例〉判定、使用者 WSL 前後比對與清理
- [ ] BUG-182 → FIXED

---

## 回報區

### 完成狀態

- **狀態**：DONE（BUG-182 → FIXED，待人工驗收）
- **完成時間**：2026-11-01T21:07:44+0800
- **product commit**：`01796a9e`（fix: reconcile remote tab attention after reconnect）
- **session_id**：907e502b-6d49-4487-bff0-3f1de6f07294

### 落點檢查

- PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（一致）；C-1：工單在 REPO_ROOT 下；C-3：`affects_files` 抽查皆存在（資訊性）；C-2：工單無 `branch` 欄位，目前 `main`。
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE` = `yolo`；`CT_HOME` 未設（非 worktree）；`BAT_REMOTE_TOKEN` 已設定。

### 現況調查（修正前）

- 重連時 attention 的來源：renderer `terminal-attention-store.ts` 只靠 `terminal:attention-changed` 推送與 `pty:exit` 更新，**重連時沒有重新取得任何快照**。server 端 `TerminalAttentionNotifier` 只在狀態變化時推送（`sent` 快取），斷線期間的推送沒有 client 收（`host.emit` 只送給已連線的 client）。
- server 重啟後：新 server 沒有舊分頁的 PTY（`isAlive` = false），也不會送舊 PTY 的結束事件 → 舊 ⚠️ 永遠留著。**分頁沒有 PTY 是現況**，本單未改：BAT 不在遠端 server 重啟後自動重建 shell，使用者 ⏻ 重啟分頁（T0748 實測同）。
- 本機視窗不會收到 `remote:client-status-changed`（`pushRemoteClientStatus` 只送 `getWindowsForProfile`），所以修正不影響本機與 T0704 的本機 Terminal Server recovery。

### 做法

- **server**（`electron/terminal-attention.ts`）：新增唯讀 proxied channel `terminal:attention-snapshot(ids)`（`registerAttentionSnapshotHandler`，Electron main 與 headless 都在建立 `TerminalAttentionNotifier` 的地方註冊）。每個 id 回 `{ id, alive, attention }`：`alive` = `PtyManager.isAlive`；attention 用 `TerminalAttentionNotifier.current`（與推送同一個 `computeTerminalAttention`，只含狀態欄位，D155；不改 `sent`，下一次變化照常推送）。ids 只收非空字串、去重、上限 1000、長度 ≤ 256。日誌 `[attention] snapshot ids=n gone=n nonEmpty=n`（只有數量）。channel 加進 `PROXIED_CHANNELS` 與 `PATH_FREE_CHANNELS`（headless parity / path coverage 測試涵蓋）。
- **renderer**（`src/stores/terminal-attention-store.ts`）：`createReconnectAttentionReconciler`（`App.tsx` 接線，訂閱 `remote.onClientStatusChanged`）在「未連線 → 已連線」時以視窗分頁 + 持有 attention 的分頁 id 問一次；`reconcileTerminalAttention` 套用：`alive: false` → 與 `clearTerminalAttention`（PTY 結束）同一段處理；`alive: true` → 以 server 狀態取代（空 = 清除）。送出請求後才收到推送 / exit 的分頁略過（推送較新，以 renderer 收到的順序判斷，不比對時間，沿用 T0694）。第一個看到的狀態不對帳；請求失敗（舊 bat-server 沒有 handler、又斷線）→ 保留原狀，日誌 `→ not reconciled (…)`。
- 選這個做法而非「只查 PTY 是否存在」：同一個快照也補上斷線期間漏掉的變化（server 仍在、狀態已變的情況），而且判斷依據完全是 server 現況。

### 淡化（D203）的選擇

- **選擇**：PTY 已消失 = 等待被中斷，**比照 PTY 結束事件的既有處理**（`reconcileTerminalAttention` 呼叫與 `clearTerminalAttention` 相同的 `applyExit`），不新增規則：使用者沒在看該分頁 → 留淡化 ⚠️（不計入總數），在看 → 不留。
- **理由**：使用者確實錯過了一個等待（server 重啟前分頁在等使用者回應），與 PTY 自然結束時一樣值得留下「曾等待」的提示；沿用同一段程式碼也避免兩套規則分歧。unit test「the same outcome as clearTerminalAttention」驗證兩條路徑結果相同。

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npx vite build` | 成功 |
| `npm run test:unit` | 359 檔、6359 passed / 3 skipped（修正後與 spec 改完後各跑一次，皆全過） |
| 新增 unit：`src/stores/__tests__/terminal-attention-store.reconcile.test.ts` | PASS：PTY 不在 → 清除（未看淡化 / 在看不留）、與 PTY 結束結果相同、PTY 在且仍等待 → 保留、斷線期間停止 / 開始等待、推送優先於快照、↻ 回合狀態清除、異常 entry、reconciler 觸發條件（首個狀態不問、持續連線不重問、失敗保留、無分頁不問）、**兩個 profile 的視窗互不影響** |
| 擴充 unit：`electron/__tests__/terminal-attention.test.ts` | PASS：真 PtyManager（fake node-pty）上 snapshot 回 alive + 與推送相同的 attention、PTY 結束 / 不存在 → alive false、snapshot 不推送也不影響下一次推送、tower 問題（不含內容，D155）、ids 檢核、main / headless 接線 source guard |
| e2e ⑤ `e2e/v072-pre8-remote-workspace-waiting.spec.ts`（WSL Ubuntu-24.04） | 改為斷言：重連前 R 列 ⚠️ `waiting`、總數 1 → 重連後 R 列 `missed`（淡化、無數字）、總數 `missed` / count 0、日誌 `gone≥1` → 看過（視窗有焦點）後清除。實跑：run1 / run2 綠（徽章斷言在日誌斷言之後的版本）、run3 / run4 綠（最終版：徽章斷言在前）；①–④ 每次皆 PASS。renderer 日誌：`[attention] reconnect reconcile profile=e2e-t0748-wsl ids=3 gone=3 applied=0 skipped=0`；server：`[attention] snapshot ids=3 gone=3 nonEmpty=0` |
| 突變檢查 | 暫時讓 `App.tsx` 不呼叫 `reconciler.onStatus`（重建 dist）→ ⑤ 失敗兩次：第一次（舊順序）失敗於 reconcile 日誌未出現；把徽章斷言移到前面後第二次失敗於 `expect(rBadge).toHaveAttribute('data-waiting', 'missed')` Received `"waiting"`（30 s，即 BUG-182 現象）。之後以 Edit 還原修正（非 git 還原）、重建，run3 / run4 綠，再 commit |
| 相關 spec | `t0735-workspace-waiting-badge`、`v072-pre8-workspace-waiting-real-agents`、`t0609-worker-attention-badge`、`t0694-worker-resumed-badge`、`t0538-worker-tab-batch-close`：5 passed（`--workers=1`） |
| 使用者 WSL 前後比對 | 每次 run（含突變兩次）皆 `home / install / units / bat-units / bat-server / listeners / tagged / root` = same，消失的既有程序 = []，`/tmp/bat-e2e-t0748` 已移除；未經 systemd、未動使用者的 bat-server |

- 真正的網路中斷（server 仍在）：同一個快照自然涵蓋（`alive: true` → 取 server 現況，unit 驗證斷線期間停止 / 開始等待）；e2e 未做：無法在不停 server 的情況下切斷 WebSocket 而不改產品程式。

### 相關通過案例判定

| 案例 | 判定 | 依據 |
|---|---|---|
| T0735 ①–④（本機工作區列 ⚠️、頁籤總數、收合窄列、淡化、點擊跳轉） | 不變 | 本機視窗收不到遠端狀態事件，不觸發對帳；`setTerminalAttention` / `clearTerminalAttention` 只抽出內部函式並加順序計數，行為不變（`terminal-attention-store.missed.test.ts` 全過）；e2e `t0735` 綠 |
| T0736 真 agent 觸發 | 不變 | e2e `v072-pre8-workspace-waiting-real-agents` 綠 |
| T0747 真實模型 | 不變（未重跑，耗 token） | 只走本機視窗路徑，程式未變；判定依程式碼 |
| T0748 ①–④（WSL 遠端） | 不變 | 同 spec 每次 run ①–④ PASS |
| T0609 Worker 標籤 ⚠️ / `?` / `✓` | 不變 | e2e `t0609` 綠、unit 全過 |
| T0694 `↻` | 不變 | e2e `t0694` 綠；對帳只在 PTY 消失時清回合狀態（等同 PTY 結束） |
| T0538 批次關閉計數 | 不變 | e2e `t0538` 綠 |
| T0704 本機 Terminal Server recovery | 不受影響 | 本機 main 只多註冊一個唯讀 handler；本機視窗不會呼叫它 |
| detached 視窗（D201） | 不涵蓋 | 未特別處理；detached 遠端視窗若收到狀態事件，只對帳自己的分頁，無害 |

### 異動檔案

- `electron/terminal-attention.ts`（snapshot handler、`current`、ids 檢核）、`electron/main.ts`、`electron/remote/headless-entry.ts`（註冊）、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`（channel 分類）、`electron/preload.ts`、`src/types/electron.d.ts`（`pty.attentionSnapshot`）
- `src/lib/terminal-attention.ts`（`TerminalAttentionSnapshotEntry`）、`src/stores/terminal-attention-store.ts`（對帳）、`src/App.tsx`（接線）
- 測試：`src/stores/__tests__/terminal-attention-store.reconcile.test.ts`（新）、`electron/__tests__/terminal-attention.test.ts`、`e2e/v072-pre8-remote-workspace-waiting.spec.ts`（⑤ 斷言）
- 文件：`docs/agent-guide/worker-tab-recycle.md`（已知限制改寫、新增 T0749 條）、`CLAUDE.md`「Worker 分頁回收」節補一句（唯一實作位置）
- `_ct-workorders/BUG-182-…md`（FIXED，附 commit）、本工單
- `affects_files` 推測的 `remote-connection-registry.ts` / `remote-client.ts` 未改（renderer 側即可完成）；另外改了 `protocol.ts` / `path-aware-channels.ts` / `preload.ts` / `electron.d.ts` / `src/lib/terminal-attention.ts`（新 channel 的必要登記）

### 遭遇問題

- 改寫 e2e ⑤ 時用 shell heredoc 寫入，`\\d` 被收成 `\d`（template literal 中變成 `d`），第一次 run 在取 shell PID 時失敗；改用 Edit 修正並逐行檢查新段落的反斜線後重跑。非產品問題。

### 發現的問題

- 無新缺陷。備註：server 重啟後分頁沒有 PTY、需使用者 ⏻ 重啟（現況，未改；是否要自動重建屬另案評估）。

### 未做 / 範圍外

- 不發版、不改 CHANGELOG、不 push。`_bug-tracker.md` 由塔台 `*sync` 重建。

### 互動紀錄

- 無（未向塔台提問）。
