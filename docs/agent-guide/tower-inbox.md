# 右側欄「待辦」分頁（PLAN-068）

> 規格來源：T0902 回報區（§1 版面、§3、§5、§6′ 判定表與 P-1 / P-2 / P-3、§3.3 欄位、R6 / R8）。W4（T0906）做分頁骨架、版本判定與 BAT 既有資料區；待你決定 / 待你執行 / 到期提醒的 CT 欄位與回答在 W5，回合訊息卡在 W6。分頁宣告（`--bat-contract`、`towerContract`）是 W0（T0903），見 [tower-tab-title.md](tower-tab-title.md)「BAT ↔ CT 契約 v2 版本閘門」。

## 用途

集中顯示「需要你動手的事」與長期追蹤清單；指揮塔仍是專案資料瀏覽（R8：並存，待辦裡的 BUG / PLAN / 工單只有數量＋連結）。

## 必守規則

- 🔴 **全部綁版本**（D328 R9′，T0906 Q-2 塔台答覆）：選中的塔台 §6′ 不相符時，整個分頁只留塔台選擇器與提示（P-1 / P-2 / P-3），BAT 既有資料區（Worker 等你、待驗收 BUG、`todo`、數量列）也不顯示；分頁標題顯示 `!`。
- 🔴 **R6 只在相符時生效**：指揮塔總覽的 `todo` 只在待辦分頁對該工作區啟用時改成「N 則 → 在待辦分頁查看」；不相符時總覽照舊列出 `todo`（舊 CT 使用者不失去完整 `todo`）。
- 🔴 唯讀：不寫任何 CT 檔案、不新增 IPC channel；檔案經指揮塔同一套管線（`fs:readdir` / `fs:readFile` / `fs:stat`，遠端工作區 proxied 到視窗綁定的 host）。日誌不記檔案內容。
- 🔴 T0788 的對話框保護與所有既有行為不綁版本、不受本分頁影響。
- 「此區塊將由後續版本提供」之類的占位文字不得出現；W5 / W6 的區塊以空狀態（「（無）」）呈現。

## 唯一實作位置

| 內容 | 位置 |
|---|---|
| 判定、區塊、資料整理（純函式） | `src/lib/inbox-model.ts`：`inboxVerdict`、`stateFileContractStatus`（面板塔台 / 沒有宣告分頁時以狀態檔判定，給 W3 / W5 用）、`pickInboxTower`、`inboxGateHint` / `inboxGateCode`、`INBOX_SECTIONS`、`parseFoldedSections`、`pendingVerifyBugs`、`inboxCounts`、`foldTodo`、`workerWaitItems`、`inboxTabBadge`、`inboxApplies` |
| 狀態檔 `bat_contract` 解析 | `src/lib/ct-tower-overview.ts` `parseTowerState`（`TowerStateSummary.batContract`）、`towerStateBatContract` |
| 讀檔 | `src/components/inbox/InboxDataSource.tsx`（`loadInboxFiles`；App 對作用中工作區、detached 視窗對自己的工作區各掛一個）→ `src/stores/inbox-store.ts` |
| 由 store 組模型 | `src/components/inbox/useInboxModel.ts`（`useInboxModel`、`useInboxVerdict`） |
| 畫面 | `src/components/InboxPanel.tsx`（`InboxPanel`、`InboxTabBadge`）、`src/components/inbox/InboxSection.tsx`、`src/styles/inbox.css` |
| 共用目錄監看 | `src/stores/ct-dir-watch.ts` `acquireDirWatch` |
| 停靠 | `src/types/index.ts`（`DockablePanel` `inbox`、`DEFAULT_DOCKING_CONFIG`、`normalizeDockingConfig`）、`src/App.tsx`、`src/components/WorkspaceView.tsx`（主區 / detached） |
| R6 | `ControlTowerPanel.tsx`（`todoInInbox`）、`TowerOverview.tsx`（`todoInInbox` / `onOpenInbox`） |

## 分頁與停靠

- `DockablePanel` 新增 `inbox`，顯示名「待辦」/ `Inbox` / 「待办」（`workspace.inbox`），預設在右側，順序在 `control-tower` 之前（右側欄：程式碼片段 │ Skills │ Agents │ 待辦 │ 塔台）。收合列圖示 📥。
- 舊的 docking 存檔沒有 `inbox` 鍵 → `normalizeDockingConfig` 補預設（右側），不需遷移；存檔裡其他面板的位置照舊。
- 可移到左側欄或主區（右鍵選單，同其他面板）；主區與 detached 視窗由 `WorkspaceView` 畫（`case 'inbox'`）。detached 視窗的分頁清單在 `control-tower` 前多一個 `inbox`。

## 版本判定（§6′）

判定單位是「這個工作區、選中的塔台」。已宣告塔台 = 這個工作區裡 `tower-contract-store` 有紀錄的分頁（`--set-role tower`，有沒有帶 `--bat-contract` 都算）。

| 分頁宣告 | 狀態檔 `bat_contract` | 結果 | 畫面 |
|---|---|---|---|
| 2 | 2 | 相符 | 全部區塊 |
| 2 | 缺 / 1 | P-3（狀態檔落後） | 只有選擇器＋P-3 |
| 2 | > 2 | P-2（`source: state`） | 只有選擇器＋P-2 |
| 未宣告 / 1 | 任何 | P-1 | 只有選擇器＋P-1（W0 的文字） |
| > 2 | 任何 | P-2（`source: tab`） | 只有選擇器＋P-2（W0 的文字） |
| 沒有已宣告塔台 | 2 | 相符（`source: state`） | 全部區塊，標頭寫「沒有已宣告的塔台分頁（以 _tower-state.md 判定）」 |
| 沒有已宣告塔台 | 缺 / 1 | P-1（`source: state`） | 文字 `inbox.gate.stateV1`（狀態檔版本的 P-1） |
| 沒有已宣告塔台 | > 2 | P-2（`source: state`） | P-2 |
| 沒有已宣告塔台且沒有 `_ct-workorders/` | — | 不適用 | 「這個工作區沒有 Control Tower」，標題沒有 `!` |

- 狀態檔不存在 / 讀不到時另顯示一行說明（`inbox.stateMissing` / `inbox.stateError`）。
- 讀檔完成前顯示「讀取中」，不判定、標題不出 `!`（避免開窗時閃一下 P-3）。
- Claude 面板塔台（沒有 helper 權杖、不能 `--set-role`）不在已宣告清單，依「沒有已宣告塔台」那幾列以狀態檔判定；W3 / W5 判斷面板塔台時用 `stateFileContractStatus`。

## 塔台選擇器

- 同一個工作區有 > 1 個已宣告塔台時，標頭是下拉選單；只有一個時顯示它的分頁標題。
- 選擇只在記憶體（`inbox-store` 依工作區 id），選中的分頁不再是塔台時改看第一個。
- 不符的塔台被選中時，分頁標題改成 `!`。

## 區塊（相符時）

固定順序：⏸ 待你決定 → 🙋 待你執行 → ⏰ 到期提醒 → 👷 Worker 等你 → 💬 塔台訊息 → 📋 塔台待辦 → 📊 數量列。

| 區塊 | W4 內容 | 之後 |
|---|---|---|
| ⏸ 待你決定 | 空（「（無）」） | W5：`awaiting_user` |
| 🙋 待你執行 | `_bug-tracker.md` 的 `FIXED` / `VERIFY`（不含封存），「開啟」→ 指揮塔 Bugs 頁 | W5：`user_actions` |
| ⏰ 到期提醒 | 空 | W5：`reminders` |
| 👷 Worker 等你 | 這個工作區的分頁：⚠️ 等使用者（`waitingForUser`，最久的在前）、📨 待送（T0788 `notify-hold-store`）、⏸ 被中斷（T0766）；`?` / `✓` / `↻` 不列。⚠️ / 📨 →「切到分頁」，⏸ →「恢復…」（開被中斷對話框） | — |
| 💬 塔台訊息 | 空 | W6：回合訊息卡 |
| 📋 塔台待辦 | CT `todo` 全部；超過 160 字或多行的項目摺疊成第一行，可展開；預設摺疊 | — |
| 📊 數量列 | BUG 未結（`OPEN` / `FIXING`）· PLAN 進行中（`IN_PROGRESS`）· 工單（`workOrderPhase` = open），各自連到指揮塔的 Bugs / Backlog / 工單頁 | — |

- 有內容的區塊可摺疊，摺疊狀態存在 localStorage `bat-inbox-folded-sections`（try/catch，只是個人偏好）；空的區塊只留一行標題。
- 分頁標題的數字 = Worker 等你的項目數＋待驗收 BUG 數（W5 再加 CT 清單）；0 不顯示；不符時 `!`。標題只在側欄（左 / 右）顯示，主區分頁列不顯示。

## 跨分頁開啟

- 待辦 → 指揮塔：`requestControlTowerTab(tab)`（`inbox-store`）發 `bat:open-dock-panel`（App 依停靠位置切過去；detached 視窗走 `workspace-switch-tab`）與 `bat:open-control-tower-tab`；指揮塔面板還沒掛載時，掛載時取走待處理的請求。
- 總覽 → 待辦（R6）：`requestOpenInbox()`。

## 遠端與 detached

- 遠端工作區：`InboxDataSource` 用的 `fs:*` 都是既有 proxied channel，讀視窗綁定的 host；`fs:changed` 照既有路徑回來。沒有新增 channel。
- detached 視窗：自己掛一個 `InboxDataSource`（自己的工作區），分頁在 `WorkspaceView` 的分頁列。
- 已宣告塔台、Worker 等你都來自 renderer 既有 store（每個視窗都有）；📨 待送在遠端視窗看不到（T0788 既有限制）。

## 已知限制

- `_ct-workorders/` 在開啟後才建立時，不會自動開始監看（同指揮塔）；按 ↻ 重讀。
- 目錄監看的計數只在同一個視窗內；另一個視窗（detached）unwatch 同一路徑仍會關掉主行程的 watcher（T0906 之前就有）。
- 已宣告塔台只在記憶體：renderer 重新載入後要等塔台再 `--set-role` 一次（W0 的限制）。
- 待辦與指揮塔各讀一次工單檔（兩個資料來源），工單很多時讀檔次數加倍。

## 驗證清單

- 單元測試：`src/lib/__tests__/inbox-model.test.ts`（§6′ 每一列、狀態檔判定、提示、選擇器、區塊順序與摺疊、BUG / 數量 / `todo` / Worker 等你、標題）；`src/lib/__tests__/ct-tower-overview-bat-contract.test.ts`（`bat_contract` 解析與錯誤隔離）。
- 畫面：`src/components/__tests__/inbox-panel.test.tsx`（每一列的畫面與標題 `!` / 數字、選擇器、區塊、BUG 連到 Bugs、Worker 等你、`todo` 摺疊與記憶；R6 相符 / 不符 / 沒有 `workspaceId` 的總覽；三語系名稱、舊 docking 存檔、共用監看、資料來源讀檔與重讀）。
- 實機：交 W8 整合驗收（隔離實例）。
