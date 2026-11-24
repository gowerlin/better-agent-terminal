# 塔台待辦與訊息（PLAN-068）

> 規格來源：T0902 回報區（第一版＋〈第二版（Renew #1，D328）〉：§1 版面、§3、§5、§6′ 判定表與 P-1 / P-2 / P-3、§3.3 欄位、R6 / R8 / R9′）。分頁宣告（`--set-role tower --bat-contract`、`towerContract`）是 W0（T0903），見 [tower-tab-title.md](tower-tab-title.md)「BAT ↔ CT 契約 v2 版本閘門」。
>
> 本檔各節與 CLAUDE.md 的對應：
>
> | 本檔 | 工單 | CLAUDE.md 小節 |
> |---|---|---|
> | 版本判定 | W0 / W4 | 「塔台分頁標題（T0562，D147）」、「右側欄「待辦」分頁（PLAN-068 W4 / T0906）」 |
> | 右側欄「待辦」分頁 | W4 / T0906 | 「右側欄「待辦」分頁（PLAN-068 W4 / T0906）」 |
> | 通知保護 | W1＋W2 / T0904 | 「塔台等使用者回答時保留 Worker 通知（T0788 / BUG-196，D227）」 |
> | 回合訊息卡：資料層 | W3 / T0905 | 「塔台回合訊息卡（PLAN-068 W3 / T0905）」（本節是該小節的完整內容） |
> | 回合訊息卡：UI 與面板塔台 | W6 / T0909 | 「塔台回合訊息卡 UI（PLAN-068 W6 / T0909）」（本節是該小節的完整內容） |
>
> 改這些功能時兩邊一起更新。待你決定 / 待你執行 / 到期提醒的 CT 欄位與回答 UI（W5）、hook 註冊（W9）完成時各自補節。

## 版本判定（R9′ / §6′）

所有 PLAN-068 功能只對「已宣告 BAT ↔ CT 契約 2 的塔台」生效（D328 R9′）；版本不符或非塔台時，行為與 PLAN-068 前逐位元相同。判定有兩層：

### 分頁層：`towerContractStatus`

- 唯一實作 `towerContractStatus(role, towerContract) === 'match'`（`src/lib/tower-contract.ts`，W0 / T0903）。主行程讀 `PtyManager.getTerminalRole` / `getTowerContract`，renderer 讀 `tower-contract-store`（`terminal:role-changed` 的 `towerContract`）。
- Claude Agent 面板塔台沒有 helper 權杖、不能 `--set-role`，改以 `_tower-state.md` 的 `bat_contract` 判定：`stateFileContractStatus`（`src/lib/inbox-model.ts`，W4）；回合訊息卡由呼叫端以 `setPanelTower` 宣告（見「回合訊息卡：資料層」節）。
- **哪些面板算面板塔台**（T0909 Q-1，塔台答覆 A；W5 的面板回答路徑用同一個定義）：工作區的 `_tower-state.md` `bat_contract` = 2、**而且**這個工作區沒有任何已宣告（`--set-role tower`，不論契約）的塔台分頁時，這個工作區所有 Claude Agent 面板分頁（`agentPreset` = `claude-code` / `claude-code-worktree`，`CLAUDE_PANEL_PRESETS`；codex 面板不算）都是面板塔台；有已宣告塔台分頁、狀態檔不是 2、或讀不到 / 還沒讀過狀態檔時一律不是。唯一實作 `workspaceHasPanelTowers` / `panelTowerTerminalIds`（`src/lib/inbox-model.ts`）。

| 分頁 | B0（W1） | `draft` / `reading` / 原子送出 / 回答（W2） | 回合訊息卡（W3） | T0788 對話框保留 |
|---|---|---|---|---|
| 契約 2 的塔台 | ✅ | ✅ | ✅ | ✅ |
| 未宣告 / 契約 1 / 契約 > 2 的塔台 | — 合成 keydown（同今天） | — 直接寫入（同今天） | — 收到即丟 | ✅（不綁版本） |
| 不是塔台 | — | — | — 收到即丟 | ✅ |

🔴 版本不符或非塔台：W1 / W2 的行為與 T0904 前逐位元相同（e2e ① 量到 #23 照舊重現）。🔴 T0788 的對話框保護與所有既有行為不綁版本。

### 工作區層：「待辦」分頁（§6′）

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
- Claude 面板塔台不在已宣告清單，依「沒有已宣告塔台」那幾列以狀態檔判定；W3 / W5 判斷面板塔台時用 `stateFileContractStatus`。

## 右側欄「待辦」分頁（W4 / T0906）

W4 做分頁骨架、版本判定（上一節「工作區層」）與 BAT 既有資料區；待你決定 / 待你執行 / 到期提醒的 CT 欄位與回答在 W5，回合訊息卡在 W6。

### 用途

集中顯示「需要你動手的事」與長期追蹤清單；指揮塔仍是專案資料瀏覽（R8：並存，待辦裡的 BUG / PLAN / 工單只有數量＋連結）。

### 必守規則

- 🔴 **全部綁版本**（D328 R9′，T0906 Q-2 塔台答覆）：選中的塔台 §6′ 不相符時，整個分頁只留塔台選擇器與提示（P-1 / P-2 / P-3），BAT 既有資料區（Worker 等你、待驗收 BUG、`todo`、數量列）也不顯示；分頁標題顯示 `!`。
- 🔴 **R6 只在相符時生效**：指揮塔總覽的 `todo` 只在待辦分頁對該工作區啟用時改成「N 則 → 在待辦分頁查看」；不相符時總覽照舊列出 `todo`（舊 CT 使用者不失去完整 `todo`）。
- 🔴 唯讀：不寫任何 CT 檔案、不新增 IPC channel；檔案經指揮塔同一套管線（`fs:readdir` / `fs:readFile` / `fs:stat`，遠端工作區 proxied 到視窗綁定的 host）。日誌不記檔案內容。
- 「此區塊將由後續版本提供」之類的占位文字不得出現；W5 / W6 的區塊以空狀態（「（無）」）呈現。

### 唯一實作位置

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

### 分頁與停靠

- `DockablePanel` 新增 `inbox`，顯示名「待辦」/ `Inbox` / 「待办」（`workspace.inbox`），預設在右側，順序在 `control-tower` 之前（右側欄：程式碼片段 │ Skills │ Agents │ 待辦 │ 塔台）。收合列圖示 📥。
- 舊的 docking 存檔沒有 `inbox` 鍵 → `normalizeDockingConfig` 補預設（右側），不需遷移；存檔裡其他面板的位置照舊。
- 可移到左側欄或主區（右鍵選單，同其他面板）；主區與 detached 視窗由 `WorkspaceView` 畫（`case 'inbox'`）。detached 視窗的分頁清單在 `control-tower` 前多一個 `inbox`。

### 塔台選擇器

- 同一個工作區有 > 1 個已宣告塔台時，標頭是下拉選單；只有一個時顯示它的分頁標題。
- 選擇只在記憶體（`inbox-store` 依工作區 id），選中的分頁不再是塔台時改看第一個。
- 不符的塔台被選中時，分頁標題改成 `!`。

### 區塊（相符時）

固定順序：⏸ 待你決定 → 🙋 待你執行 → ⏰ 到期提醒 → 👷 Worker 等你 → 💬 塔台訊息 → 📋 塔台待辦 → 📊 數量列。

| 區塊 | W4 內容 | 之後 |
|---|---|---|
| ⏸ 待你決定 | 空（「（無）」） | W5：`awaiting_user` |
| 🙋 待你執行 | `_bug-tracker.md` 的 `FIXED` / `VERIFY`（不含封存），「開啟」→ 指揮塔 Bugs 頁 | W5：`user_actions` |
| ⏰ 到期提醒 | 空 | W5：`reminders` |
| 👷 Worker 等你 | 這個工作區的分頁：⚠️ 等使用者（`waitingForUser`，最久的在前）、📨 待送（T0788 `notify-hold-store`，原因見「通知保護」節的〈「📨 待送」與「立即送出」〉）、⏸ 被中斷（T0766）；`?` / `✓` / `↻` 不列。⚠️ / 📨 →「切到分頁」，⏸ →「恢復…」（開被中斷對話框） | — |
| 💬 塔台訊息 | 空 | W6：回合訊息卡（見「回合訊息卡：UI 與面板塔台」節；資料層 W3） |
| 📋 塔台待辦 | CT `todo` 全部；超過 160 字或多行的項目摺疊成第一行，可展開；預設摺疊 | — |
| 📊 數量列 | BUG 未結（`OPEN` / `FIXING`）· PLAN 進行中（`IN_PROGRESS`）· 工單（`workOrderPhase` = open），各自連到指揮塔的 Bugs / Backlog / 工單頁 | — |

- 有內容的區塊可摺疊，摺疊狀態存在 localStorage `bat-inbox-folded-sections`（try/catch，只是個人偏好）；空的區塊只留一行標題。
- 分頁標題的數字 = Worker 等你的項目數＋待驗收 BUG 數（W5 再加 CT 清單）；0 不顯示；不符時 `!`。標題只在側欄（左 / 右）顯示，主區分頁列不顯示。
- 👷 Worker 等你的 📨 待送跟著 `notify-hold-store` 的 `useNotifyHoldVersion`（任何分頁的保留清單改變就重畫）。

### 跨分頁開啟

- 待辦 → 指揮塔：`requestControlTowerTab(tab)`（`inbox-store`）發 `bat:open-dock-panel`（App 依停靠位置切過去；detached 視窗走 `workspace-switch-tab`）與 `bat:open-control-tower-tab`；指揮塔面板還沒掛載時，掛載時取走待處理的請求。
- 總覽 → 待辦（R6）：`requestOpenInbox()`。

### 遠端與 detached

- 遠端工作區：`InboxDataSource` 用的 `fs:*` 都是既有 proxied channel，讀視窗綁定的 host；`fs:changed` 照既有路徑回來。沒有新增 channel。
- detached 視窗：自己掛一個 `InboxDataSource`（自己的工作區），分頁在 `WorkspaceView` 的分頁列。
- 已宣告塔台、Worker 等你都來自 renderer 既有 store（每個視窗都有）；📨 待送在遠端視窗看不到（T0788 既有限制）。

### 已知限制

- `_ct-workorders/` 在開啟後才建立時，不會自動開始監看（同指揮塔）；按 ↻ 重讀。
- 目錄監看的計數只在同一個視窗內；另一個視窗（detached）unwatch 同一路徑仍會關掉主行程的 watcher（T0906 之前就有）。
- 已宣告塔台只在記憶體：renderer 重新載入後要等塔台再 `--set-role` 一次（W0 的限制）。
- 待辦與指揮塔各讀一次工單檔（兩個資料來源），工單很多時讀檔次數加倍。

### 驗證清單

- 單元測試：`src/lib/__tests__/inbox-model.test.ts`（§6′ 每一列、狀態檔判定、提示、選擇器、區塊順序與摺疊、BUG / 數量 / `todo` / Worker 等你、標題）；`src/lib/__tests__/ct-tower-overview-bat-contract.test.ts`（`bat_contract` 解析與錯誤隔離）。
- 畫面：`src/components/__tests__/inbox-panel.test.tsx`（每一列的畫面與標題 `!` / 數字、選擇器、區塊、BUG 連到 Bugs、Worker 等你、`todo` 摺疊與記憶；R6 相符 / 不符 / 沒有 `workspaceId` 的總覽；三語系名稱、舊 docking 存檔、共用監看、資料來源讀檔與重讀）。
- 實機：交 W8 整合驗收（隔離實例）。

## 通知保護（W1＋W2 / T0904）

只對「版本判定」節「分頁層」判定為 `match` 的塔台生效；版本閘門表見該節。

### W1：B0 —— 通知的 Enter 不搶畫面

- 契約 2 塔台收到 `terminal:keypress`（`bat-notify --submit`、保留後送出的 Enter、回答的 Enter）→ `terminal.input('\r', false)`（`submitEnterWithoutFocus`，`src/lib/tower-submit-enter.ts`）：xterm 自己的資料路徑、不當成使用者輸入 → 不捲到底、不清選取、不搶焦點；位元組與 Enter 鍵相同（`\r`）。
- 其他分頁與 T0566 用量限制續行：照舊合成 keydown（`dispatchSyntheticEnterKeydown`）＋`terminal.focus()`。
- 判斷唯一實作 `towerSubmitEnterPath(status)`；接線 `TerminalPanel.tsx` `onTerminalKeypress` → `dispatchEnter({ withoutFocus })`。
- helper 的 Enter 仍寫 `{ auto: true }`（T0788 第 9 點）；回答的 Enter（keypress 帶 `userInput: true`）寫 `{ submit: true }`：算使用者輸入、並關閉原子窗口。
- 🔴 升級 xterm 時必跑 `src/lib/__tests__/tower-submit-enter.test.ts`（真 xterm 5.5.0 在 jsdom `open()`：位元組相同、viewport 不動、選取保留、焦點不動；對照 keydown 路徑會捲到底、清選取）。

### W2：保留佇列擴充

`NotifyHoldController`（`electron/notify-hold.ts`，本機與 headless 共用）是契約 2 塔台的唯一寫入閘門：helper 通知一律經它（沒有要保留時也由它寫入＝pass-through）。

| reason | 觸發（host） | 放行 | 上限 | 擋誰 |
|---|---|---|---|---|
| `permission` / `question` / `elicitation` / `input`（T0788） | hook / OSC `blocked` | 離開 blocked ＋安靜 1 s | 不設（D228） | helper 通知、回答；所有分頁 |
| `draft` | S1：最後一次 Enter / Ctrl+C 之後有其他使用者輸入 | 使用者 Enter / Ctrl+C ＋安靜 1 s；或「立即送出」 | 不設；保留滿 5 分鐘發一次系統通知 | helper 通知、回答 |
| `reading` | renderer 回報（proxied `terminal:reading-state`） | 回報 `false`（renderer 已含停手 10 s）＋安靜 1 s | 每個佇列 60 s（`NOTIFY_HOLD_READING_MAX_MS`），到時照送 | 只擋 helper 通知；🔴 不擋回答 |
| `queued` | 前面還有保留項目，或原子窗口開著 | 前一則送完 | — | — |

保留時 helper 照舊拿到 `{ ok: true, held: true }`；`held-full`（8 筆）、不設逾時、PTY 結束 / ⏻ / recovery 丟棄都與 T0788 相同。

#### S1 草稿判斷（`src/lib/tower-input-draft.ts` `trackDraft`）

只看使用者送進該 PTY 的位元組（`pty:write` 的使用者輸入路徑：本機視窗或 headless client；終端自動回應不算），保守規則——誤判只會多保留：

| 輸入 | 效果 |
|---|---|
| `\r`（bracketed paste 外）、Ctrl+C `\x03` | 清除草稿 |
| 可列印字元、Tab、`\n`、bracketed paste（含其中的 `\r`）、Alt＋鍵（含 Alt+Enter）、↑ / ↓、CSI u 鍵、不認得的序列 | 有草稿 |
| 單獨 Esc、←/→/Home/End/Insert/Delete/PageUp/PageDown、focus 回報、滑鼠回報、游標位置回報、Backspace 與其他 C0 | 不變 |

已知誤判：游標移動後刪光、`/` 選單選完、Tab 補完到空字串都還算有草稿 → 「📨 待送」顯示「你在輸入」＋「立即送出」，5 分鐘提醒一次。所有分頁都追蹤（便宜、不改行為），只有契約 2 塔台用來保留。

#### 閱讀信號（`src/lib/tower-reading-state.ts` `TowerReadingTracker`）

renderer 只對契約 2 塔台分頁啟用（`TerminalPanel.tsx`）：normal buffer `viewportY < baseY`、有選取（`onScroll` / `onSelectionChange`）、或滾輪 / PageUp / Shift+PageUp（container capture listener）→ 閱讀中；最後一個信號結束後再維持 `TOWER_READING_LINGER_MS` = 10 s。只在值改變時呼叫 `pty.setReadingState(terminalId, reading)`；停用（契約改變、分頁卸載）時若回報過 `true` 先送一次 `false`。

host：`setReading(id, reporter, reading)`，`reporter` = `conn:<connectionId>` / `win:<windowId>`（`readingReporterOf`，`electron/handlers/pty.ts`），任一 reporter 為 `true` 即閱讀中；PTY 結束清除。

#### 原子送出（250 ms 窗口）

- helper 文字送出（pass-through 或保留後送出）時開窗口（`openAtomic`）；同分頁的使用者輸入由 host 暫存（`holdUserWrite`），直到視窗寫回 `{ auto: true }` / `{ submit: true }` 的 `\r`（`afterSubmitWrite`）或 `NOTIFY_HOLD_ATOMIC_MAX_MS` = 1 s，然後依序補寫。
- 窗口開著時，同分頁的下一則 helper 通知排隊（`queued`）；保留佇列送下一則前等上一則的窗口關閉。
- pass-through 的那則：同一 helper 連線的下一個 keypress 照舊送出（不進佇列）；期間分頁變成 blocked → keypress 依 T0788 保留，窗口 1 s 後補寫使用者輸入。
- 只預填（不帶 `--submit`）時沒有 Enter，使用者輸入 1 s 後補寫。

#### 回答（W5 的介面）

`enqueueAnswer(targetId, text, { connectionId? })`：單行、1–1,000 字（不含 `\r` / `\n`）；只接受契約 2 塔台（否則 `not-contract-tower`）；受 prompt 與 `draft` 擋、不受 `reading` 擋；排在已保留的通知後面；沒被擋就立即送出（不等安靜 1 s）。Enter 以 keypress（`source: 'answer'`、`userInput: true`）由視窗產生，寫 `{ submit: true }`：算使用者輸入。`^[UA]-\d+：` 前綴、IPC `tower-inbox:answer` 與 UI 在 W5。

#### 「📨 待送」與「立即送出」

- `terminal:notify-hold-changed` 多 `reason`（只有契約 2 塔台；其他分頁的事件與 T0788 相同，沒有這個欄位）、項目多 `kind: 'answer'`。renderer `notify-hold-store` 以 `useNotifyHoldReason` / `sendNowNotifyHold` 提供給縮圖；「待辦」分頁的 👷 Worker 等你以 `useNotifyHoldVersion` 跟著重畫（W4）。
- 縮圖選單顯示原因（你在輸入 / 你在閱讀 / 等你回答對話框 / 排隊）；原因是 `draft` / `reading` 時有「立即送出」（本機 IPC `terminal:notify-hold-send-now`，`sendNow`）：該分頁所有項目（依序）不再受 `draft` / `reading` 擋；🔴 prompt 仍擋（Enter 會作答，BUG-196）。有草稿時立即送出的文字會接在草稿後面一起送出（使用者自己的選擇，tooltip 說明）。
- 5 分鐘提醒：主行程送 `terminal:notify-hold-reminder`（本機視窗），持有該分頁的視窗（`TerminalPanel`）以系統通知（Web `Notification`）顯示一次。

### 日誌

```
[notify-hold] passed terminal=<塔台> source=<Worker> part=text len=<n> (atomic)
[notify-hold] held terminal=<塔台> source=<Worker|answer> … reason=draft|reading|… part=text|enter len=<n> queued=<N>
[notify-hold] atomic closed terminal=<塔台> cause=enter|timeout|replaced kept=<筆數> bytes=<n>
[notify-hold] reading terminal=<塔台> reading=true|false
[notify-hold] reading limit terminal=<塔台> after=60000ms count=<N>
[notify-hold] reminder terminal=<塔台> reason=draft count=<N>
[notify-hold] send-now terminal=<塔台> count=<N> [(still held: <prompt reason>)]
[notify-hold] answer terminal=<塔台> source=answer len=<n> (sending)
[tower-reading] terminal=<塔台> reading=true|false            ← renderer
[terminal-submit] remote Enter input terminal=<塔台> trace=<id> path=xterm-input …   ← renderer（B0）
```

🔴 不記文字、草稿、回答內容；暫存的使用者輸入只記筆數與長度。

### 已知限制

- 遠端 profile 視窗：保留與 `draft` / `reading` 在 bat-server 上照樣生效（`terminal:reading-state` 是 proxied channel），但「📨 待送」清單、「立即送出」、5 分鐘提醒只在本機視窗（T0788 的既有限制：`terminal:notify-hold-*` 沒有加進 `PROXIED_CHANNELS` / `PROXIED_EVENTS`）。遠端使用者的草稿保留在送出 / Ctrl+C 後自然放行，但看不到原因。要支援需另開工單。
- fullscreen claude：BAT 看不到 claude 內部捲動，只看滾輪 / PageUp 事件（停手 10 s 放行）。
- S1 是推估（見上表）；codex 的 Ctrl+C / Enter / Shift+Enter 行為待實機（T0902 T-5）。
- `reading` 60 s 是從「閱讀開始擋住這個佇列」起算，到時再加安靜 1 s。
- 原子窗口暫存最多 1 s：helper 的 Enter 晚於 1 s 抵達（極慢的遠端連線）時，使用者輸入先補寫，退回今天的行為。

### 驗證

- 單元：`src/lib/__tests__/tower-input-draft.test.ts`、`tower-reading-state.test.ts`、`tower-submit-enter.test.ts`（真 xterm＋TerminalPanel source guard）；`electron/__tests__/notify-hold-contract-tower.test.ts`（版本閘門、draft、reading、原子送出、回答、立即送出、提醒、日誌）、`notify-hold-contract-handlers.test.ts`（共用 handler＋真 PtyManager）；`src/components/__tests__/notify-hold-reason-menu.test.tsx`（原因、立即送出、三語系）。T0788 既有 `notify-hold.test.ts` / `notify-hold-ask-held-full.test.ts` 不改、全綠。
- e2e（隔離實例，假 TUI，不需登入）：`e2e/t0904-tower-notify-protection.spec.ts`（`e2e/fixtures/fake-line-editor.mjs`、`notify-job-runner.mjs`）：① 未宣告塔台 #23 重現、② 契約 2 草稿分開送出、③ 窗口內打字 / Enter、④ 閱讀 60 s 上限＋viewport 不動（B0）、⑤ 停手 10 s 放行。需先 `npx vite build`。
- 待實機（T0902）：T-1 / T-2（真 claude 塔台的 #23 與捲動）、T-3（fullscreen＋Auto-scroll）、T-5（codex 輸入框）、T-7（WSL 塔台的 `draft` / `reading`）、T-8（舊 CT＋新 BAT 保護停用）。

## 回合訊息卡：資料層（W3 / T0905）

- **用途**：已宣告契約 v2 的塔台分頁（判定見「版本判定」節「分頁層」），每回合一張卡片，內容是該回合 claude 的最後一則助理訊息；「右側欄「待辦」分頁」節的「💬 塔台訊息」區（W6）讀這些卡片。
- **唯一實作**：host `electron/tower-cards.ts`（`TowerCardStore`、`registerTowerCardHandlers`，不 import electron，本機 `electron/main.ts` 與 headless `createHeadlessTerminalQueryModule` 共用）；型別與上限 `src/types/tower-cards.ts`；renderer `src/stores/tower-cards-store.ts`（只資料）。

### 來源

| 塔台 | 怎麼來 | 程式 |
|---|---|---|
| claude-cli 塔台 | `Stop` hook 的 `last_assistant_message` | `scripts/bat-hook.mjs stop` → `terminal:report-hook` → `ReportHookDeps.onStop` → `TowerCardStore.offerHookStop` |
| Claude Agent 面板塔台 | 面板 query 的 `result`（`subtype: 'success'` 的 `result` 文字） | `ClaudeAgentManager.setTurnResultListener` → `offerPanelMessage` |
| codex 塔台 | 沒有（D158，T0902 §4） | — |

### hook 端（`scripts/bat-hook.mjs`）

- 只有 `stop` 事件讀 `last_assistant_message`；非字串或空白 → 不送。stdin 沿用 `STDIN_MAX_BYTES`（256 KiB），超過整個輸入讀不到，照舊只回報 `stop`（不帶訊息）。
- 送出前截到 `LAST_MESSAGE_MAX_BYTES` = 16 KiB（UTF-8 位元組，切在字元邊界，`truncateUtf8`），截過就帶 `messageTruncated: true`。
- `stop` 回報另帶 `origin: 'injected'` 與 `set: BAT_HOOK_SET`（= 2；`electron/bat-mcp-launch.ts` 的 `BAT_HOOK_SET` 寫在 `BAT_CLAUDE_HOOKS` 旁，兩處由 `scripts/__tests__/bat-hook-last-message.test.mjs` 守住相等）。其他事件的回報**逐字不變**（host 把沒有 `origin` 的回報當成 `injected`，T0902 §7.4）。
- 🔴 T0590 規則不變：一律 exit 0、stdout 不輸出、總時限 1.8 s、任何失敗靜默；`at`（T0790）規則不變。bat-scripts.log 只多 `messageBytes`（長度），不記訊息。

### host 端：`terminal:report-hook`

- 新欄位都是選填、格式不對就忽略（不回錯）：`origin`（`injected` / `plugin`，`parseHookOrigin`）、`set`（整數 1–1000，`parseHookSet`）、`lastAssistantMessage`（只看 `stop`；字串且 ≤ `REPORT_HOOK_MESSAGE_MAX_CHARS` = 64 Ki 字元）、`messageTruncated`（只有 `true` 算數）。
- **注入＋plugin 去重**（§7.4）：同一個 PTY 收過 `injected` 的回報後，`plugin` 的回報回 `{ ok: true, terminalId, result: 'duplicate' }`、不套用（tracker 不動、不進卡片），每個 PTY 只記一行 `[hooks] terminal=<id> plugin reports dropped …`。紀錄跟著 PTY 結束 / Terminal Server recovery 消失（`TerminalBlockedTracker.acceptHookOrigin` / `getHookSet`；`PtyManager` 同名方法）。`plugin` 由 W9 的 launcher 帶。
- 套用後的 `stop` 交給 `onStop(terminalId, { message?, set? })`；handler 不記錄、不 mirror、不回傳訊息內容。回傳形狀與 T0905 前相同。

### 卡片 store（`TowerCardStore`）

| 規則 | 內容 |
|---|---|
| 誰的訊息會留下 | 只有 `towerContractStatus(role, towerContract) === 'match'`（已宣告塔台＋`--bat-contract 2`）。其他分頁（Worker、一般 claude、沒宣告契約或契約不是 2 的塔台）收到即丟，不存內容；每個分頁只記一行 `dropped: not a contract-2 Tower (length=<n>…)`。判定在收件當下做：塔台之後改宣告，已有的卡片留到 PTY 結束，新的不收 |
| 面板塔台 | 面板沒有 `--set-role`，由呼叫端 `setPanelTower(id, true)` 宣告（§6′：面板以 `_tower-state.md` 的 `bat_contract` 判定，renderer 讀檔）。W6 起由視窗經 `tower-cards:set-panel-tower` 呼叫（定義見「版本判定」節，接線見「回合訊息卡：UI 與面板塔台」節）；`setPanelTower(id, false)` 清掉該面板的卡片 |
| 遮罩 | 收件即 `redactTerminalSecrets`（含 server token 字面值），日誌只記遮罩次數 |
| 大小 | 遮罩後再截到 `TOWER_CARD_MAX_BYTES` = 16 KiB（UTF-8），`truncated` = hook 截過或 host 截過 |
| 上限 | 每個分頁最近 `TOWER_CARDS_MAX` = 30 張未釘選（超過丟最舊的）；釘選另計，最多 `TOWER_CARDS_PINNED_MAX` = 10 張（第 11 張 → `PIN_LIMIT`）；取消釘選後算回 30 張內（可能擠掉最舊的未釘選卡） |
| 去重 | 同一分頁、同一 session id（hook：`PtyManager.getClaudeSessionId`；面板：`panel:<id>`）＋內容 SHA-256，`TOWER_CARDS_DEDUPE_WINDOW_MS` = 10 s 內只留一張（注入與 plugin 都回報同一個 `Stop` 的情況）。10 s 後同樣內容算新的一回合 |
| 沒有訊息的 `stop` | 契約 v2 塔台的計數 `stopsWithoutMessage` 加一（G7：claude 太舊沒有這個欄位，或回合結束時沒有文字）；W6 依此顯示原因 |
| 狀態 | 未讀 / 已讀 / 釘選存在 host，多視窗一致 |
| 生命週期 | PTY 結束（exit / kill，所以 ⏻ 重啟也算）清空；Terminal Server recovery 清空所有 PTY 分頁（面板不受影響）；面板 session dispose（`claude:dispose-session`）清空該面板。不寫檔、不跨 BAT 重開 |
| 日誌 | `[tower-cards] terminal=<id> card added source=<hook\|panel> bytes=<n>[ truncated][ masked=<n>] cards=<n>[ evicted=<n>]`、`duplicate dropped`、`read=<n>`、`pinned` / `unpinned`、`cleared=<n>`、`cleared <n> card(s) (<原因>)`、`… refused: helper capability`。🔴 永遠不記訊息內容 |

### channel 與事件（proxied）

| channel | 參數 | 回傳 |
|---|---|---|
| `tower-cards:list` | `{ terminalIds? }`（省略 = host 上所有有卡片的分頁與已宣告的面板塔台） | `{ ok: true, entries: TowerCardsEntry[] }` |
| `tower-cards:mark-read` | `{ terminalId, cardIds? }`（省略 = 全部） | `{ ok: true, changed }` |
| `tower-cards:pin` | `{ terminalId, cardId, pinned }` | `{ ok: true, changed }` / `NOT_FOUND` / `PIN_LIMIT` |
| `tower-cards:clear` | `{ terminalId, cardIds?, includePinned? }`（沒有 `cardIds` = 所有未釘選；`includePinned` = 全部） | `{ ok: true, changed }` |
| 事件 `tower-cards:changed` | `{ terminalId, revision, unread, total }` | 🔴 只有數字，不含卡片文字 |

- `TowerCardsEntry`：`{ terminalId, alive, revision, cards（舊 → 新）, unread, stopsWithoutMessage }`；卡片 `{ id, terminalId, source, text, truncated, createdAt, read, pinned }`。`revision` 是整個 host 共用的遞增數字；沒有卡片的分頁回目前的值（不會比視窗看過的舊），視窗據此丟掉副本。
- 🔴 四個 channel 都**不在** `HELPER_CHANNEL_ROLES`，handler 另外拒絕 `ctx.helper`（`FORBIDDEN`）：Worker 與塔台自己的 PTY 權杖都不能讀或改卡片（R7）。舊 bat-server 沒有 handler → 視窗的呼叫 reject。
- 本機視窗走 `ipcMain`（`PROXIED_CHANNELS`），遠端視窗經 RemoteClient 送到該 profile 的 bat-server；事件經 `PROXIED_EVENTS` 到該 profile 的視窗。`path-aware-channels.ts` 歸為不轉換路徑（卡片文字照塔台寫的原樣）。

### renderer（`src/stores/tower-cards-store.ts`）

- `createTowerCardsSync({ api, terminalIds, onPtyExit?, onClientStatusChanged?, log? }).start()`：開始時抓一次視窗的分頁；`tower-cards:changed` 的 `revision` 比副本新 → 重抓該分頁；`pty:exit` 丟副本；遠端「未連線 → 已連線」時以 `tower-cards:list` 對帳（強制取代，比照 T0749），抓失敗保留原狀。
- 讀取：`useTowerCards(id)`、`getTowerCards(id)`、`towerCardsUnread(id)`。已讀 / 釘選 / 清除直接呼叫 `window.electronAPI.towerCards`，結果由 host 的事件帶回，store 不自己改卡片。
- W6（T0909）起 `App.tsx` 呼叫一次 `createTowerCardsSync(...).start()`（每個視窗各自一份）；卡片區與縮圖仍以分頁的契約狀態（`tower-contract-store`）或面板塔台判定決定要不要顯示。

### claude 版本（G7）

- `Stop` hook 的 `last_assistant_message`：最早出現在 **claude `2.1.47`**（`2.1.45` 沒有；`2.1.46` 未發佈到 npm）。T0905 以 `npm pack` 逐版二分查 `@anthropic-ai/claude-code`（`cli.js` 版查 `cli.js`，原生二進位版查 `@anthropic-ai/claude-code-linux-x64` 的執行檔），比對完整識別字（`last_assistant_message` 後面不接 `_`：較早版本已有不相干的遙測欄位 `last_assistant_message_id`，`1.0.64` 起）。`2.1.47` 的 hook 輸入 schema：`Stop` / `SubagentStop` 的 `last_assistant_message: string().optional()`（"Text content of the last assistant message before stopping"），值是最後一則助理訊息的文字區塊以空白串接後 trim，空字串時不帶。
- 比這舊的 system claude：`stop` 照樣回報，只是沒有訊息（`stopsWithoutMessage` 增加，W6 顯示「升級 claude」）。內嵌 claude（`^2.1.331`）有這個欄位（`2.1.331` 執行檔也確認有）。

### 已知限制

- 卡片只在 host 記憶體，BAT 重開或 bat-server 重啟後沒有（T0902 §3，不重建 transcript）。
- 面板塔台：W3 只提供介面與測試；呼叫端在 W6（`PanelTowerSync`）。
- 實際訊息大小、多段文字 / 工具呼叫回合的內容未實測（T0902 待實機 T-4）；注入＋plugin 並存的去重未實機（T-10，plugin 由 W9 提供）。

### 驗證

- 單元：`electron/__tests__/tower-cards.test.ts`（store、handlers、不在 helper 範圍）、`electron/__tests__/tower-cards-report-hook.test.ts`（report-hook 新欄位、origin 去重、onStop）、`electron/__tests__/tower-cards-panel-source.test.ts`（面板來源）、`scripts/__tests__/bat-hook-last-message.test.mjs`（hook 端、`BAT_HOOK_SET` 相等、整支腳本 exit 0 / stdout 空）、`electron/__tests__/terminal-blocked-state.test.ts`「T0905: Stop sends last_assistant_message …」（真腳本經 RemoteServer）、`src/stores/__tests__/tower-cards-store.test.ts`。
- headless：`electron/remote/__tests__/headless-tower-cards-e2e.test.ts`（真 headless＋node-pty：塔台 PTY 內宣告契約 2 並回報、Worker 與未宣告契約的塔台被丟、塔台自己的權杖呼叫 `tower-cards:*` 被拒、視窗 list / mark-read、PTY 結束清空、事件不含文字）。

## 回合訊息卡：UI 與面板塔台（W6 / T0909）

只在「版本判定」節判定相符時運作：待辦分頁整個綁版本（不符時「💬」區不出現），縮圖 `💬N` 只算相符的塔台分頁與面板塔台。資料層見上一節（W3）。

### 必守規則

- 🔴 卡片內容一律純文字：只以 React 文字節點顯示，不以 HTML / Markdown 解譯（不得用 `dangerouslySetInnerHTML`）。
- 🔴 未讀數只顯示在「💬」區標題與塔台縮圖 `💬N`，**不算進**待辦分頁標題的數字（`inboxActionCount` 不變；T0902 §1：僅告知不催人）；也不進工作區列表。
- `⏸ 待你決定：` / `🙋 待你執行：` 開頭的行（前面可有空白、`- ` / `* ` / `> ` / `1. `；半形冒號也算）加亮，**只是提示**，不解析成資料（待你決定 / 待你執行的資料只來自 W5 的 frontmatter）。
- 🔴 W3 的規則不變：只收契約 2 塔台、遮罩、上限、生命週期、只在記憶體；`tower-cards:*`（含 W6 新增的 `tower-cards:set-panel-tower`）都不在 `HELPER_CHANNEL_ROLES`，handler 另拒 `ctx.helper`。日誌不記卡片內容。

### 唯一實作位置

| 內容 | 位置 |
|---|---|
| 顯示用純函式（排序、加亮、預覽、摺疊、合併來源、codex 判斷、G7、縮圖數字） | `src/lib/tower-card-view.ts` |
| 面板塔台定義 | `src/lib/inbox-model.ts`：`CLAUDE_PANEL_PRESETS`、`workspaceHasPanelTowers`、`panelTowerTerminalIds`（W5 共用） |
| 面板塔台同步 | `src/stores/panel-tower-store.ts`（`createPanelTowerSync`、`isPanelTowerHere`）、`src/components/inbox/PanelTowerSync.tsx`（`decidePanelTowers`；App 的主視窗與 detached 視窗各掛一個） |
| 「💬」區 | `src/components/inbox/TowerCardsSection.tsx`（`InboxPanel` 依選中的塔台給來源）；`InboxSection` 多 `countLabel` / `actions` / `note` |
| 縮圖 `💬N` | `src/components/TerminalThumbnail.tsx`（點擊 → `requestOpenInbox`） |
| 卡片同步接線 | `src/App.tsx`：`createTowerCardsSync(...).start()`（每個視窗一次） |
| channel | `electron/tower-cards.ts` `registerTowerCardHandlers` 的 `tower-cards:set-panel-tower`；`PROXIED_CHANNELS`（`electron/remote/protocol.ts`）、`path-aware-channels.ts`、preload `towerCards.setPanelTower` |
| agent（codex 判斷用） | `tower-contract-store` 的 entry 多 `agent`（`terminal:role-changed` 的 `agent`，否則 `ptyAgent`） |

### 「💬」區顯示哪些卡片

| 選中的塔台 | 來源 |
|---|---|
| 已宣告的塔台分頁（相符） | 只有它的卡片 |
| 已宣告的 codex 塔台（`agent` / `ptyAgent` / 分頁 preset 以 `codex` 開頭） | 沒有卡片，固定一行說明（T0902 §4，三語系 `inbox.cards.codexNote`） |
| 沒有已宣告塔台（以狀態檔判定相符） | 這個工作區所有面板塔台的卡片合併，每張標出來源分頁標題 |

- 排序：釘選的在最上面，各自新 → 舊。
- 卡片收合時：● 未讀、📌、時間（`HH:MM`，host 時鐘）、第一行預覽（120 字），下方列出加亮行；展開 = 已讀（`tower-cards:mark-read` 該張），顯示全文，超過 24 行或 2,400 字先顯示開頭＋「顯示全部」。host 截斷過（`truncated`）的卡片顯示「（內容過長，已截斷）」。
- 📌 釘選 / 取消釘選；第 11 張時 host 回 `PIN_LIMIT`，區內顯示「最多只能釘選 10 張」。
- 區標題：有未讀時「N 未讀」，否則「N 張」；按鈕「全部已讀」（每個來源 `mark-read` 全部）、「清除」（每個來源 `clear`，只清未釘選）。沒有卡片時區塊只留「（無）」一行。
- G7：選中的塔台送過沒有訊息的 `stop`（`stopsWithoutMessage > 0`）而且沒有任何卡片 → 「claude 版本太舊（需要 2.1.47 以上）」一行（`inbox.cards.claudeTooOld`，三語系）；有卡片後消失。

### 面板塔台的判定與同步

- 定義見「版本判定」節（T0909 Q-1 A）。`PanelTowerSync` 對視窗自己的工作區（主視窗：未分離的工作區；detached 視窗：它自己的；歸屬沿用 `ownsTerminalForCloseRequest`）逐一判定，輸入是 `inbox-store` 的狀態檔（`InboxDataSource` 讀過的）與 `tower-contract-store` 的已宣告塔台；工作區、狀態檔、塔台宣告任一改變就重新判定。
- `createPanelTowerSync`：每個面板第一次出現時送一次（true 或 false，讓重新載入的視窗把 host 留著的舊判定改正），之後只送改變；遠端視窗「未連線 → 已連線」時全部重送（重啟的 bat-server 已忘記）；送失敗（舊 host 沒有這個 channel、斷線）每個 id 只記一行，下次改變或重連再送。
- host 收到 false 會清掉該面板的卡片（W3 `setPanelTower`）；面板 session dispose 照 W3 清空。
- 日誌：`[tower-cards] panel Tower id=<id> → <true|false>`、`… not sent (<錯誤>)`。只有 id 與布林。

### 遠端與 detached

- 每個視窗（主視窗、detached、遠端 profile 視窗）各自 `createTowerCardsSync().start()`，讀自己綁定的 host；`tower-cards:set-panel-tower` 是 proxied channel，遠端視窗送到該 profile 的 bat-server（面板塔台在遠端 host 上的面板也收卡片）。
- 縮圖 `💬N` 在顯示該分頁的視窗；點擊打開待辦分頁（`requestOpenInbox`）。

### 已知限制

- 面板塔台要讀過該工作區的 `_tower-state.md` 才判得出：只有作用中（或 detached 視窗自己的）工作區會讀；從沒開過的工作區，它的面板在切到該工作區之前不收卡片（T0909 Q-1 A 的限制，塔台已確認）。切走後狀態檔不再監看，判定沿用最後一次讀到的內容。
- 塔台改宣告後（例如不帶 `--bat-contract` 重新 `--set-role`），host 留著的舊卡片直到 PTY 結束才清；UI 依目前判定不顯示（待辦分頁停用、縮圖不出 `💬N`）。
- 卡片的實際內容與大小（多段文字、工具呼叫回合）未實機（T0902 待實機 T-4）；codex 塔台與 claude 太舊的畫面在真實塔台上未實機。

### 驗證

- 單元：`src/lib/__tests__/tower-card-view.test.ts`（加亮、預覽、摺疊、排序、合併、G7、codex、縮圖數字、面板塔台定義每一列）、`src/stores/__tests__/panel-tower-store.test.ts`（第一次送出、只送改變、忘記、重連重送、失敗只記一次、`decidePanelTowers`）、`electron/__tests__/tower-cards.test.ts`「T0909: set-panel-tower …」（helper 拒絕、開 / 關、關閉清卡、參數錯誤）。
- 畫面：`src/components/__tests__/inbox-tower-cards.test.tsx`（排序與未讀、展開 = 已讀、釘選上限、全部已讀 / 清除、純文字（HTML 不解譯）、加亮、摺疊與截斷標記、codex 說明（preset 與 `--agent`）、G7、版本不符時沒有區塊、面板塔台合併與來源標籤、待辦標題數字不含未讀、縮圖 `💬N` 只給相符塔台與面板塔台）。
- 實機：交 W8 整合驗收（隔離實例）。
