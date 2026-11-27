---
schema_version: 1
schema_kind: workorder
id: T0949
title: "BUG-230：BAT 重開、同一個 PTY 接回後，還原塔台分頁的 `--set-role` 宣告（角色、模式、契約 v2）"
type: bugfix
status: DONE
repo: better-agent-terminal
priority: P2
sizing: M
created_at: "2026-11-27T21:05:49+08:00"
started_at: "2026-11-27T21:07:06+08:00"
updated_at: "2026-11-27T21:19:22+08:00"
completed_at: "2026-11-27T21:19:22+08:00"
session_ids:
  - "7511bf09-f6b2-49d4-91cf-85d65d9ca1cd"
target_version: "下一個預覽版（`0.8.1-pre.N`，發版前與使用者確認），與 T0946 / T0947 同一版"
depends_on: []
related:
  - "BUG-230；D434 / D435（U-39：A）；T0562（`terminal:set-role`，`electron/terminal-role.ts`）；T0903（`--bat-contract`，`towerContract`）；T0537（`withSavedWorkerOwnership`：BAT 重開後以已存分頁判斷 Worker 歸屬）；T0578 / T0861（Recovery「保留」與 holder 自動接回 `reconnectKeptTerminalServer`）；PLAN-065"
affects_files:
  - _ct-workorders/T0949-restore-tower-role-on-reattach.md
  - electron/terminal-role.ts
  - electron/pty-manager.ts
  - electron/main.ts
  - electron/terminal-server/
  - electron/worker-ownership.ts
  - electron/__tests__/
  - src/stores/workspace-store.ts
  - src/types/index.ts
  - src/stores/__tests__/
  - src/lib/
  - docs/agent-guide/tower-tab-title.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0949` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。同時有合併工單 T0948（`ct/T0947` → `main`，含 `CLAUDE.md`）在跑，之後合併時再處理。"
  - "🔴 現象（BUG-230，使用者實機，BAT `0.8.0`、Windows）：塔台分頁開著時關掉 BAT 再開，終端分頁接回（claude 程序存活、對話不中斷），但塔台分頁的 `--set-role` 宣告消失：待辦分頁顯示「沒有已宣告的塔台分頁」、回答送不出去，使用者必須在塔台分頁再執行 `/control-tower`。塔台重送 `--set-role tower --bat-contract 2 --mode on` exit 0 後恢復。塔台推測：`role` / `towerMode` / `towerContract` 只記在主行程 `PtyInstance`、不持久化（CLAUDE.md「塔台分頁標題」節），新主行程接回同一個 PTY 時沒有這些欄位。先查證（接回路徑：Recovery「保留」`releaseCreatesOnReplayList` 與 holder 自動接回 `reconnectKeptTerminalServer`），推測不成立 → 問塔台。"
  - "🔴 範圍：同一個 PTY 程序接回（Terminal Server 存活、PTY 沒換）時，還原該分頁在 BAT 關閉前最後一次的宣告（`role`、`towerMode`、`towerContract`），並照常送 `terminal:role-changed`，讓分頁標題、縮圖 `CT↑` / `BAT↑`、待辦分頁、通知保護與 💬 卡片都恢復，不需要塔台重新宣告。存在哪裡由 Worker 查證後選（例：已存的分頁資料，比照 T0537 `withSavedWorkerOwnership`；或 Terminal Server 端的 PTY metadata），回報區寫理由。"
  - "🔴 不變式：① 宣告只來自 BAT 自己存的資料，不接受請求參數或 PTY 輸出宣告（比照 T0537）；② 只在同一個 PTY 程序接回時還原：⏻ 重啟、新 PTY、Recovery「重新開始」、Terminal Server recovery 重建 shell（T0704）、分頁關閉，一律照舊清除（新的 claude 會自己宣告）；查證「同一個程序」的依據寫進回報區；③ `--set-role` 的參數、stdout（含 `bat-contract:` / `hooks:` 行）、exit code 逐字不變，之後再宣告照舊覆寫；④ 還原的 `towerMode` 會影響 `isYoloTerminal`（用量限制自動繼續等），只因程序本來就是 yolo 而延續，回報區寫明；⑤ hooks 狀態不還原（由 hook 回報重新判定）；⑥ 不寫權杖、不寫日誌內容以外的資料，日誌只記 terminal id 前 8 碼、角色、模式、契約數字；⑦ headless bat-server 沒有 Terminal Server 接回，行為不變。"
  - "🔴 唯一實作：還原的判斷與資料寫在一個共用位置（例 `electron/terminal-role.ts` 新函式），接回路徑只接線；不在 consumer 內聯。"
  - "🔴 測試：接回同一 PTY → 角色 / 模式 / 契約還原且送 `role-changed`；⏻ / 重新開始 / recovery / 新 PTY → 不還原；沒有宣告過的分頁 → 不動；之後再 `--set-role` → 覆寫；既有 `--set-role` 測試（含 T0903 舊呼叫逐字不變）、`workspace-store.towerRole.test.ts` source guard 不改且通過。既有測試若必然衝突 → 問塔台，不自行改。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0；`npm run typecheck:electron` = 0。實機（安裝版關 BAT 再開、接回後待辦分頁看得到塔台）寫〈待實機〉，不碰安裝版 BAT、不開 claude 回合；🔴 不跑 NSIS / W6 升級驗收。"
  - "🔴 文件：`docs/agent-guide/tower-tab-title.md` 補「接回後還原宣告」一節（含不還原的情況）；CLAUDE.md「塔台分頁標題（T0562，D147）」節把「不持久化」改寫成正確描述並寫唯一實作函式名，小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑（例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0949 — 接回同一個 PTY 後還原塔台宣告（BUG-230）

## 背景

`v0.8.0` 實機驗收 A-18：關掉 BAT 再開，終端分頁接回、塔台的 claude 仍在跑，但塔台分頁的 `--set-role` 宣告消失，待辦分頁找不到塔台、回答送不出去，使用者得自己再執行 `/control-tower`（BUG-230）。使用者裁示 U-39：A（併進這一批修，與 BUG-228 / 229 一起發版）。

## 範圍

- 查證宣告在接回時消失的原因與接回路徑。
- 同一個 PTY 程序接回時還原最後一次宣告並送 `role-changed`；其他情況照舊清除。
- 共用實作；`--set-role` 契約逐字不變。

## 不做

- 不改 `--set-role` 契約、不改 CT、不還原 hooks 狀態、不改 headless、不改 Worker 歸屬邏輯（T0537）。

## 驗收

- [x] 回報區有根因查證、存放位置與「同一個程序」判斷依據的理由
- [x] 接回後還原（測試）；⏻ / 重新開始 / recovery / 新 PTY 不還原（測試）
- [x] 既有 `--set-role` / T0903 / source guard 測試不改且通過
- [x] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0；`npm run typecheck:electron` = 0
- [x] 〈待實機〉步驟；docs 更新

---

## 回報區

### 完成狀態

- **狀態**：DONE（Worker 範圍全部完成；實機驗收列在〈待實機〉）
- **完成時間**：2026-11-27T21:19:22+08:00
- **session_id**：7511bf09-f6b2-49d4-91cf-85d65d9ca1cd
- **branch**：`ct/T0949`
- **base_sha**：`451bbba9748e4f9e0fc235f7626138dcc79013e0`
- **validated_sha**：`073dbaa15096377d3f61b2b0ea42644b77de00de`
- **head_sha**：`073dbaa15096377d3f61b2b0ea42644b77de00de`（= validated_sha；驗證後沒有產品 commit）

### 落點檢查

- **結果**：PASS
- C-0：工單 `repo` = `better-agent-terminal`；`basename "$CT_HOME"` = `better-agent-terminal` → PASS（worktree 模式，`CT_HOME` 已設定）
- C-1：工單位於 `$CT_HOME/_ct-workorders/` → PASS
- C-3：`electron/terminal-role.ts` 等都存在 → PASS（參考用）
- C-2：工單沒有 `branch` 欄位；目前分支 `ct/T0949` = `CT_WORKTREE_BRANCH`
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_REMOTE_TOKEN` 已設定

### 根因查證

- 推測**成立**。`role` / `towerMode` / `towerContract` 只存在主行程的 `PtyInstance`（`electron/pty-manager.ts`）。BAT 重開、Terminal Server 存活時，新主行程用 server 的 `pty:list` 註冊存活的 PTY（`PtyManager.handleReplayList`，T0108）。這時 instance 只有 `{ process: null, type, cwd, usePty }`，沒有任何宣告欄位。
- 兩條接回路徑都會經過這裡：
  - Recovery「保留」：`main.ts` 先 `connectToServer`，再送 `pty:list`；`releaseCreatesOnReplayList` 等清單回來。
  - PTY holder 自動接回：`reconnectKeptTerminalServer` 走同一段程式。
- 接回之後，renderer 怎樣都拿不回宣告：
  - renderer 的 `tower-contract-store`（待辦分頁判定、縮圖 `CT↑` / `BAT↑`）只放在記憶體，只能靠 `terminal:role-changed` 事件填入。
  - 主行程端的通知保護、💬 卡片、待辦回答目標都讀 `PtyInstance.towerContract`。
  - 結果就是塔台重新 `--set-role` 前，待辦分頁看不到塔台，回答也送不出去。

### 存放位置與理由

- **選擇**：主行程自己的檔案 `<userData>/tower-roles.json`，做法比照 T0642 的 `claude-sessions.json`：whenReady 時讀成待決，收到 Terminal Server 的 PTY 清單時決定要不要還原。
- **沒有選已存分頁（T0537 那種 window registry）的原因**：
  - 存檔要由 renderer 寫，而 renderer 只有事件，拿不到 pid。
  - registry 也沒辦法判斷「是不是同一個程序」：例如 Recovery「重新開始」之後，同一個分頁 id 跑的是新 shell，存檔卻還留著舊的塔台資料。
- **沒有選 Terminal Server 端 metadata 的原因**：
  - 要擴充 server 協定。
  - 升級時保留下來的 PTY holder 跑的是舊版 server 程式，看不懂新的訊息，正好在升級接回時失效。
- **檔案內容**：每個塔台存 `terminalId`、宣告時的 `pid`、`role`、`mode`、`towerContract`、`ptyAgent`、`agent`（agent id）。不存權杖，也不存任何輸出。寫入方式是原子寫入，POSIX 權限 0600。

### 「同一個程序」的判斷依據

- 唯一實作 `decideTowerRoleRestore`（`electron/terminal-role.ts`）。以下四個條件都成立才還原：
  1. PTY 在 Terminal Server 的存活清單上。
  2. 清單回報的 pid 等於存檔的宣告 pid。
  3. 這個 pid 就是 server 的 `pty.pid`，和當初 `pty:created` 回報的是同一個值（`terminal-server/server.ts` 的 create 與 list 都讀 `entry.pid`）。
  4. 本行程還沒有人對這個 PTY 宣告過（新的 `--set-role` 優先）。
- 宣告 pid 只在 `terminal:set-role` 成功時記錄（`PtyManager.noteTowerDeclaration` 記下當時的 `PtyInstance.pid`）。存檔只收「宣告 pid = 目前 pid」的塔台（`getTowerDeclaration`）。
- 各種情況的結果：

  | 情況 | 會不會還原 | 原因 |
  |---|---|---|
  | ⏻ 重啟 | 不會 | `restart` 不記宣告 pid，新程序的 pid 也不同 |
  | T0704 recovery 重建 | 不會 | 重建時 pid 清空；新的 `pty:created` pid 不同；重建後會重寫存檔 |
  | 新 PTY | 不會 | 經 `pty:create` 建立，不經過清單 |
  | 「重新開始」或沒有存活的 server | 不會 | `settle(() => false)` 全部丟棄 |
  | 分頁關閉 | 不會 | `onPtyExit` 會重寫存檔 |

- 剩餘風險：同一個 Terminal Server 下、同一個 id 剛好重複用到同一個 pid 才會誤判，實務上不會發生。

### 不變式對照

- ① 宣告只來自主行程自己寫的存檔，不讀請求參數或 PTY 輸出。
- ② 只有同一個程序會還原（見上表）。本行程內 ⏻ 重啟、recovery 保留宣告的既有行為（T0565 / T0903）**沒有改**：「照舊」是指沿用既有行為，只是這些新程序的宣告不會在下次 BAT 重開時還原。
- ③ `--set-role` 的請求、回應、stdout、exit code 都沒改。`setTerminalRole` 只多呼叫一次 `noteTowerDeclaration?.()`；事件改由 `buildTerminalRoleChange` 產生，形狀和原本相同，既有測試不改且全部通過。之後再宣告照舊覆寫（有測試）。
- ④ 還原後 `towerMode` 會照宣告影響 `isYoloTerminal`（用量限制自動繼續等）。理由是這個程序原本就是以這個模式宣告的塔台，所以延續（有測試；docs 已寫）。
- ⑤ hooks 狀態不還原，由 hook 回報重新判定。契約 2 的塔台在下一個 hook 回報前可能顯示 `🪝✕`。
- ⑥ 不寫權杖。日誌只記 terminal id 前 8 碼、角色、模式、契約數字（有測試斷言日誌不含完整 id）。
- ⑦ headless 不建立存檔，也沒有接回。handler 的 `noteTowerDeclaration` 只在記憶體記 pid，行為不變。

### 變更檔案

| 檔案 | 變更 |
|---|---|
| `electron/terminal-role.ts` | `TowerRolePersistence`（load / settle / persist / roleChanges）、`decideTowerRoleRestore`、`readTowerRoleStore` / `writeTowerRoleStore`、`buildTerminalRoleChange`（與 `setTerminalRole` 共用的事件形狀）；`SetRolePtyManager.noteTowerDeclaration?` |
| `electron/pty-manager.ts` | `PtyInstance.pid` / `towerDeclaredPid` / `towerAgent`；在 `pty:created`、`pty:list` 與 direct spawn 記 pid；`noteTowerDeclaration` / `getTowerDeclaration` / `restoreTowerDeclaration` / `getPid` / `getTowerAgent`；deps 新增 `onTowerRoleChange`；`restart` 沿用 `--agent` 提示；recovery 重建時清 pid 並通知 |
| `electron/main.ts` | 只接線：`loadTowerRoles`、`onSurvivingPtys` 與無 server 時的 `settle`、`onTowerRoleChange` / `onPtyExit` / `onServerRecovery` 時 `persist`、`app.on('browser-window-created')` 讓視窗載入完成後補送目前的塔台事件 |
| `electron/__tests__/tower-role-restore.test.ts` | 新增 16 項 |
| `docs/agent-guide/tower-tab-title.md` | 新增「接回後還原宣告」一節；改正兩處「不持久化」與已知限制的描述 |
| `CLAUDE.md` | 「塔台分頁標題（T0562，D147）」節（標題不改名）：把「不持久化」改成正確描述，並寫上唯一實作函式名 |

- 沒有改 `src/**`、`electron/worker-ownership.ts`、`electron/terminal-server/`。

### 視窗載入後補送事件

- PTY holder 自動接回在 `startTerminalServer()` 執行，那時視窗還沒建立，還原當下送出的 `role-changed` 沒有視窗收得到。
- 補法：每個視窗 `did-finish-load` 時，主行程對該視窗再送一次它目前所有塔台的 `role-changed`。
- 這也讓 View→Reload 後 renderer 能拿回塔台。原本 reload 後要等 CT 再宣告，這是附帶的行為改善。renderer 套用是冪等的，標題規則不變；不符契約的 toast 照舊每個分頁、每個視窗出一次。
- 沒有新增 IPC，也沒有改 preload 或 renderer。

### 驗證

| 關卡 | 結果 |
|---|---|
| worktree `npm ci` | exit 0 |
| `npm run test:unit`（head `073dbaa1`，第一次完整執行） | exit 0：Test Files 515 passed / 3 skipped（518）；Tests 9325 passed / 46 skipped（9371）；72.41 s |
| `npx vite build` | exit 0 |
| `npm run typecheck` | 0 錯誤（exit 0） |
| `npm run typecheck:electron` | 0 錯誤（exit 0） |

- 新測試 `tower-role-restore.test.ts` 共 16 項：
  - 同一 pid：還原角色、模式、契約，`isYoloTerminal` 成立，送出 `role-changed`，`roleChanges` 補送，日誌只有前 8 碼。
  - 不還原：pid 不同、沒有存活的 server／「重新開始」、⏻ 重啟、recovery 重建、PTY 結束、本行程已宣告、從未宣告。
  - 之後 `--set-role` 會覆寫還原的宣告。
  - renderer 冪等重建後仍保持還原狀態。
  - 存檔讀寫，以及不合法項目的略過。
  - `main.ts` 接線的 source guard。
- 既有的 `terminal-role*.test.ts`、`bat-terminal-set-role.test.ts`（含 T0903 舊呼叫逐字不變）、`workspace-store.towerRole.test.ts` source guard 都沒有修改，且全部通過。

### 待實機（不碰安裝版 BAT、不開 claude 回合；本工單沒跑）

1. 用修正後版本的安裝版開一個塔台分頁，執行 `/control-tower`。完成後確認 `<userData>/tower-roles.json` 有該分頁一筆，`pid` 是數字。
2. 關掉 BAT，保留終端（Terminal Server 不結束），再開 BAT，在 Recovery 提示選「保留」。
3. 預期：待辦分頁直接看得到該塔台（不再顯示「沒有已宣告的塔台分頁」），縮圖沒有 `CT↑`，從待辦分頁回答送得出去。debug log 有 `[tower-role] restored: terminal=<前 8 碼> role=tower mode=… contract=2`。
4. 反例：在步驟 2 選「重新開始」→ 塔台不還原（log 為 `not restored … no surviving Terminal Server`）。⏻ 重啟塔台分頁後再關 BAT、選「保留」→ 不還原。
5. 注意：從 `v0.8.0` 升級上來的第一次接回沒有存檔，CT 仍要再宣告一次。之後的接回才會還原。
- 不需要 NSIS / W6 升級驗收：本單沒有改安裝程式、holder 或 quit 路徑。

### 已知限制與後續

- 只從修正後的版本開始存檔（見待實機第 5 點）。
- 還原後 hooks 狀態要等下一個 hook 回報才更新（不變式 ⑤）。
- 工單 frontmatter 寫「⏻ 重啟、recovery … 一律照舊清除」，但既有行為是同一個行程內 ⏻ 重啟、recovery 會**保留**宣告（T0565 / T0903 的測試與文件）。這裡依「照舊」沒有改既有行為，只確保這些情況不會在 BAT 重開時還原。若塔台其實要在同一個行程內也清除，需另開工單（會改到 T0565 / T0903 的既有測試）。

### 相關通過案例判定

- 不適用：本工單沒有〈相關通過案例〉段落。

### 遭遇問題

- 第一次跑新測試時，recovery 案例失敗：`onServerRecovery` 在重建之前就先寫檔，存檔還留著舊 pid。已在重建迴圈裡加上 `notifyTowerRoleChange` 解決，並在 commit 前修正；不影響 `validated_sha`。

### 互動紀錄

- [21:07] 開工（yolo，`CT_INTERACTIVE=0`）；沒有向塔台提問。

### Commit

- 產品：`073dbaa1` `fix(T0949): restore a Tower's --set-role declaration when BAT reattaches the same PTY (BUG-230)`，在 `ct/T0949`。
- 工單：主 checkout `git commit --only`（本次收單）。
- 沒有 push，沒有觸發 workflow，worktree `status --porcelain` 為空。
