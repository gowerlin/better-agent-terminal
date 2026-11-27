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
> | 回合訊息卡：資料層、UI 與面板塔台 | W3 / T0905、W6 / T0909 | 「塔台回合訊息卡（PLAN-068 W3 / T0905）」（T0912 起 W3 與 W6 合為這一節） |
> | 契約 v2 清單與回答 | W5 / T0908 | 「待辦分頁的契約 v2 清單與回答（PLAN-068 W5 / T0908）」 |
> | 參考檔案連結 | T0930 | 「待辦分頁的契約 v2 清單與回答（PLAN-068 W5 / T0908）」 |
> | hook 註冊 | W9 / T0910 | 「BAT hooks 狀態與 `bat-hooks` plugin（PLAN-068 W9 / T0910）」 |
>
> CLAUDE.md 只留用途、🔴 必守規則、唯一實作位置與一行連結（CLAUDE.md 撰寫規則，T0595）；細節以本檔為準。改這些功能時兩邊一起更新。
>
> 使用者說明：網站「待辦分頁與塔台設定」頁（`site/tower-inbox.md`）、README「與 BMad Control Tower 協作」的「待辦分頁（BAT ↔ CT 契約 v2）」與「BAT hooks 與 `bat-hooks` plugin（選用）」節。🔴 README 後者的標題是 `HOOKS_HELP_URL`（`src/lib/hooks-status.ts`）的錨點，不得改名。

## 版本判定（R9′ / §6′）

所有 PLAN-068 功能只對「已宣告 BAT ↔ CT 契約 2 的塔台」生效（D328 R9′）；版本不符或非塔台時，行為與 PLAN-068 前逐位元相同。判定有兩層：

### 分頁層：`towerContractStatus`

- 唯一實作 `towerContractStatus(role, towerContract) === 'match'`（`src/lib/tower-contract.ts`，W0 / T0903）。主行程讀 `PtyManager.getTerminalRole` / `getTowerContract`，renderer 讀 `tower-contract-store`（`terminal:role-changed` 的 `towerContract`）。
- Claude Agent 面板塔台沒有 helper 權杖、不能 `--set-role`，改以 `_tower-state.md` 的 `bat_contract` 判定：`stateFileContractStatus`（`src/lib/inbox-model.ts`，W4）；回合訊息卡由呼叫端以 `setPanelTower` 宣告（見「回合訊息卡：資料層」節）。
- **哪些面板算面板塔台**（T0909 Q-1，塔台答覆 A；「契約 v2 清單與回答」節的回答目標選擇用同一個定義）：工作區的 `_tower-state.md` `bat_contract` = 2、**而且**這個工作區沒有任何已宣告（`--set-role tower`，不論契約）的塔台分頁時，這個工作區所有 Claude Agent 面板分頁（`agentPreset` = `claude-code` / `claude-code-worktree`，`CLAUDE_PANEL_PRESETS`；codex 面板不算）都是面板塔台；有已宣告塔台分頁、狀態檔不是 2、或讀不到 / 還沒讀過狀態檔時一律不是。唯一實作 `workspaceHasPanelTowers` / `panelTowerTerminalIds`（`src/lib/inbox-model.ts`）。

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
- Claude 面板塔台不在已宣告清單，依「沒有已宣告塔台」那幾列以狀態檔判定（`stateFileContractStatus`）；哪些面板算面板塔台見上一節「分頁層」。

## 右側欄「待辦」分頁（W4 / T0906）

本節是分頁本身：骨架、停靠、塔台選擇器、區塊順序與 BAT 既有資料區。版本判定見上一節「工作區層」；⏸ 待你決定 / 🙋 待你執行 / ⏰ 到期提醒的 CT 欄位與回答見「契約 v2 清單與回答」節；💬 塔台訊息見「回合訊息卡：UI 與面板塔台」節。

### 用途

集中顯示「需要你動手的事」與長期追蹤清單；指揮塔仍是專案資料瀏覽（R8：並存，待辦裡的 BUG / PLAN / 工單只有數量＋連結）。

### 必守規則

- 🔴 **全部綁版本**（D328 R9′，T0906 Q-2 塔台答覆）：選中的塔台 §6′ 不相符時，整個分頁只留塔台選擇器與提示（P-1 / P-2 / P-3），BAT 既有資料區（Worker 等你、待驗收 BUG、`todo`、數量列）也不顯示；分頁標題顯示 `!`。
- 🔴 **R6 只在相符時生效**：指揮塔總覽的 `todo` 只在待辦分頁對該工作區啟用時改成「N 則 → 在待辦分頁查看」；不相符時總覽照舊列出 `todo`（舊 CT 使用者不失去完整 `todo`）。
- 🔴 唯讀：不寫任何 CT 檔案、不新增 IPC channel；檔案經指揮塔同一套管線（`fs:readdir` / `fs:readFile` / `fs:stat`，遠端工作區 proxied 到視窗綁定的 host）。日誌不記檔案內容。
- 「此區塊將由後續版本提供」之類的占位文字不得出現；沒有內容的區塊以空狀態（「（無）」）呈現。

### 唯一實作位置

| 內容 | 位置 |
|---|---|
| 判定、區塊、資料整理（純函式） | `src/lib/inbox-model.ts`：`inboxVerdict`、`stateFileContractStatus`（沒有已宣告塔台分頁時以狀態檔判定）、`pickInboxTower`、`inboxGateHint` / `inboxGateCode`、`INBOX_SECTIONS`、`parseFoldedSections`、`pendingVerifyBugs`、`inboxCounts`、`foldTodo`、`workerWaitItems`、`inboxTabBadge`、`inboxApplies` |
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

| 區塊 | 內容 | 細節 |
|---|---|---|
| ⏸ 待你決定 | CT `awaiting_user` | 「契約 v2 清單與回答」節 |
| 🙋 待你執行 | CT `user_actions`（在前）＋`_bug-tracker.md` 的 `FIXED` / `VERIFY`（不含封存；「開啟」→ 指揮塔 Bugs 頁） | 「契約 v2 清單與回答」節 |
| ⏰ 到期提醒 | CT `reminders`（已到或 7 天內） | 「契約 v2 清單與回答」節 |
| 👷 Worker 等你 | 這個工作區的分頁：⚠️ 等使用者（`waitingForUser`，最久的在前）、📨 待送（T0788 `notify-hold-store`，原因見「通知保護」節的〈「📨 待送」與「立即送出」〉）、⏸ 被中斷（T0766）；`?` / `✓` / `↻` 不列。⚠️ / 📨 →「切到分頁」，⏸ →「恢復…」（開被中斷對話框） | — |
| 💬 塔台訊息 | 回合訊息卡 | 「回合訊息卡：UI 與面板塔台」節 |
| 📋 塔台待辦 | CT `todo` 全部；超過 160 字或多行的項目摺疊成第一行，可展開；預設摺疊 | — |
| 📊 數量列 | BUG 未結（`OPEN` / `FIXING`）· PLAN 進行中（`IN_PROGRESS`）· 工單（`workOrderPhase` = open），各自連到指揮塔的 Bugs / Backlog / 工單頁 | — |

- 有內容的區塊可摺疊，摺疊狀態存在 localStorage `bat-inbox-folded-sections`（try/catch，只是個人偏好）；空的區塊只留一行標題。
- 分頁標題的數字 = `inboxActionCount`（Worker 等你＋待驗收 BUG＋待你決定＋待你執行＋到期提醒；💬 未讀不算）；0 不顯示；不符時 `!`。標題只在側欄（左 / 右）顯示，主區分頁列不顯示。
- 👷 Worker 等你的 📨 待送跟著 `notify-hold-store` 的 `useNotifyHoldVersion`（任何分頁的保留清單改變就重畫）。

### 跨分頁開啟

- 待辦 → 指揮塔：`requestControlTowerTab(tab)`（`inbox-store`）發 `bat:open-dock-panel`（App 依停靠位置切過去；detached 視窗走 `workspace-switch-tab`）與 `bat:open-control-tower-tab`；指揮塔面板還沒掛載時，掛載時取走待處理的請求。
- 總覽 → 待辦（R6）：`requestOpenInbox()`。

### 遠端與 detached

- 遠端工作區：`InboxDataSource` 用的 `fs:*` 都是既有 proxied channel，讀視窗綁定的 host；`fs:changed` 照既有路徑回來。沒有新增 channel。
- 之後才建立的 `_ct-workorders/`（T0916 / BUG-220）：`acquireDirWatch` 以 `fs:watch(dir, { recreate: true })` 監看；目錄還不存在時主行程（或 bat-server）改以非遞迴方式監看最近的已存在、path guard 允許的上層目錄（事件驅動、不輪詢），目錄出現後換回原本的遞迴 watcher 並送一次 `fs:changed`，待辦分頁與指揮塔不必按 ↻ 就重讀；目錄被刪除或被換掉（dev+ino 改變）→ 送一次 `fs:changed`、關掉舊 watcher、回到等待。只有 `acquireDirWatch` 帶這個選項，其他 `fs.watch` 呼叫者（檔案樹、Markdown 預覽、`.git`、`_bmad-output`）與目錄本來就存在時的事件次數都不變。遠端：proxied `fs:watch` 照 `first-string` 只換第一個參數、選項原樣送到 bat-server，headless 共用同一個 `registerFsHandlers`；T0916 之前的 bat-server 忽略多出的參數，不存在的目錄照舊回 `false`、不監看（與修正前相同）。唯一實作 `electron/handlers/fs.ts`（`FsWatchOptions`、`armRecreate` / `armPending`）。
- detached 視窗：自己掛一個 `InboxDataSource`（自己的工作區），分頁在 `WorkspaceView` 的分頁列。
- 已宣告塔台、Worker 等你都來自 renderer 既有 store（每個視窗都有）；📨 待送在遠端視窗也看得到（見「契約 v2 清單與回答」節〈「📨 待送」在遠端視窗〉）。

### 已知限制

- ~~`_ct-workorders/` 在開啟後才建立時，不會自動開始監看（同指揮塔）；按 ↻ 重讀。~~ T0916（BUG-220）起自動監看；連到 T0916 之前的 bat-server 時仍是舊行為。
- 目錄監看的計數只在同一個視窗內；另一個視窗（detached）unwatch 同一路徑仍會關掉主行程的 watcher（T0906 之前就有）。
- 已宣告塔台只在記憶體：renderer 重新載入後要等塔台再 `--set-role` 一次（W0 的限制）。
- 待辦與指揮塔各讀一次工單檔（兩個資料來源），工單很多時讀檔次數加倍。

### 驗證清單

- 單元測試：`src/lib/__tests__/inbox-model.test.ts`（§6′ 每一列、狀態檔判定、提示、選擇器、區塊順序與摺疊、BUG / 數量 / `todo` / Worker 等你、標題）；`src/lib/__tests__/ct-tower-overview-bat-contract.test.ts`（`bat_contract` 解析與錯誤隔離）。
- 畫面：`src/components/__tests__/inbox-panel.test.tsx`（每一列的畫面與標題 `!` / 數字、選擇器、區塊、BUG 連到 Bugs、Worker 等你、`todo` 摺疊與記憶；R6 相符 / 不符 / 沒有 `workspaceId` 的總覽；三語系名稱、舊 docking 存檔、共用監看、資料來源讀檔與重讀）。
- 之後才建立的目錄（T0916）：`electron/__tests__/fs-watch-recreate.test.ts`（不存在 → 建立、中間層級、存在時事件次數相同、刪除再建立、unwatch 不留 watcher、↻、path guard、headless 線路）；`src/stores/__tests__/ct-dir-watch.test.ts`。
- 實機：W8 整合驗收（T0913，隔離實例）。

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
| `reading` | renderer 回報（proxied `terminal:reading-state`） | 回報 `false`（renderer 已含停手 10 s；alt buffer 往上捲改等按鍵 / 點擊 / 捲回，見〈閱讀信號〉）＋安靜 1 s | 每個佇列 60 s（`NOTIFY_HOLD_READING_MAX_MS`），到時照送 | 只擋 helper 通知；🔴 不擋回答 |
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

**全螢幕（alt buffer）往上捲（T0917 / BUG-221，D337）**：claude / codex 全螢幕時捲動由程式自己處理，BAT 看不到位置。alt buffer 中往上捲（滾輪向上、PageUp、Shift+PageUp）之後維持「閱讀中」，不受 10 s 限制，直到：

| 結束條件 | 之後 |
|---|---|
| 該分頁的鍵盤輸入（container `keydown`，PageUp / PageDown 與單獨的修飾鍵除外；`isModifierOnlyKey`） | 直接結束（最後一次滾輪 / PageUp 後的 10 s 仍照舊算） |
| 在終端內點擊（container `mousedown`，任何按鍵） | 同上 |
| 分頁不再是 active（`isActive` 變 false） | 同上 |
| 捲回：向下累計 ≥ 向上累計（滾輪向下、PageDown） | 開始 10 s linger |
| alt buffer 切回 normal（或反向切換） | 直接結束 |
| 主行程 `reading` 60 s 上限 | 照送（🔴 60 s 與主行程規則、常數不變） |

- 判斷唯一實作 `TowerReadingTracker` 的 `setAltBuffer` / `noteAltScroll` / `endAltScroll`（`src/lib/tower-reading-state.ts`）；`TerminalPanel.tsx` 只接線，listener 只觀察（passive、不 `preventDefault` / `stopPropagation`），滾輪回報與按鍵照舊由 xterm 送進 PTY（T0698、T0672 不受影響）。🔴 normal buffer 的判斷（`viewportY < baseY`、選取、滾輪＋10 s linger）完全不變：`noteAltScroll` 在 normal buffer 不做事。
- 「捲回」是近似值：滾輪量依 xterm 5.5 的換算（`wheelRows`：像素 ÷ 列高、行數照用、頁數 × rows；Shift / Ctrl 滾輪不算），PageUp / PageDown 各算 `rows` 列；程式實際捲多少（claude 每個滾輪回報捲幾行）BAT 不知道。滑鼠滾輪（每格固定量、上下對稱）時估計與程式一致；觸控板上下的事件大小不同時可能有誤差：捲回了但沒判斷出來 → 由按鍵、點擊、切分頁或 60 s 上限結束（多保留）；還沒捲到底就判斷成捲回（例：往上是很多小事件、往下是少數大事件，程式每個回報捲固定行數）→ 回到停手 10 s 放行（T0917 前的行為）。
- 選「分頁不再 active」而不是「失去焦點」：閱讀時焦點常移到別的視窗或右側欄（複製、查資料），畫面仍在眼前；分頁被切走才代表沒在看。
- 鍵盤用 `keydown` 而不是 `onData`：`onData` 也帶 xterm 的滑鼠 / 滾輪回報、終端自動回應與 focus 回報。代價：被 BAT 快捷鍵吃掉、沒送進 PTY 的按鍵也會結束（只會提早回到既有規則）。
- 日誌：`[tower-reading] terminal=<id> alt scrolled-up=true` / `alt scrolled-up=false cause=key|click|inactive|scrolled-back|buffer-switch|disabled`（renderer，不記內容）。
- 驗證：`src/lib/__tests__/tower-reading-state.test.ts`（alt 區塊）、`src/__tests__/tower-reading-wiring.test.ts`（接線 source guard）、e2e `e2e/t0904-tower-notify-protection.spec.ts` ⑥ / ⑥b（假 TUI 以 Ctrl+] 進 alt screen＋SGR 滑鼠追蹤）。

host：`setReading(id, reporter, reading)`，`reporter` = `conn:<connectionId>` / `win:<windowId>`（`readingReporterOf`，`electron/handlers/pty.ts`），任一 reporter 為 `true` 即閱讀中；PTY 結束清除。

#### 原子送出（250 ms 窗口）

- helper 文字送出（pass-through 或保留後送出）時開窗口（`openAtomic`）；同分頁的使用者輸入由 host 暫存（`holdUserWrite`），直到視窗寫回 `{ auto: true }` / `{ submit: true }` 的 `\r`（`afterSubmitWrite`）或 `NOTIFY_HOLD_ATOMIC_MAX_MS` = 1 s，然後依序補寫。
- 窗口開著時，同分頁的下一則 helper 通知排隊（`queued`）；保留佇列送下一則前等上一則的窗口關閉。
- pass-through 的那則：同一 helper 連線的下一個 keypress 照舊送出（不進佇列）；期間分頁變成 blocked → keypress 依 T0788 保留，窗口 1 s 後補寫使用者輸入。
- 只預填（不帶 `--submit`）時沒有 Enter，使用者輸入 1 s 後補寫。

#### 回答（`enqueueAnswer`）

`enqueueAnswer(targetId, text, { connectionId? })`：單行、1–1,000 字（不含 `\r` / `\n`）；只接受契約 2 塔台（否則 `not-contract-tower`）；受 prompt 與 `draft` 擋、不受 `reading` 擋；排在已保留的通知後面；沒被擋就立即送出（不等安靜 1 s）。Enter 以 keypress（`source: 'answer'`、`userInput: true`）由視窗產生，寫 `{ submit: true }`：算使用者輸入。呼叫端（`^[UA]-\d+：` 前綴檢查、IPC `tower-inbox:answer`、待辦分頁 UI）見「契約 v2 清單與回答」節〈回答路徑〉。

#### 「📨 待送」與「立即送出」

- `terminal:notify-hold-changed` 多 `reason`（只有契約 2 塔台；其他分頁的事件與 T0788 相同，沒有這個欄位）、項目多 `kind: 'answer'`。renderer `notify-hold-store` 以 `useNotifyHoldReason` / `sendNowNotifyHold` 提供給縮圖；「待辦」分頁的 👷 Worker 等你以 `useNotifyHoldVersion` 跟著重畫。
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

- 遠端 profile 視窗：保留與 `draft` / `reading` 在 bat-server 上照樣生效（`terminal:reading-state` 是 proxied channel）；「📨 待送」清單、原因、「立即送出」、5 分鐘提醒也在遠端視窗（見「契約 v2 清單與回答」節〈「📨 待送」在遠端視窗〉），bat-server 比 T0908 舊時看不到。
- fullscreen claude：BAT 看不到 claude 內部捲動，只看滾輪 / PageUp 事件。T0917（BUG-221）起 alt buffer 往上捲後維持閱讀中，到按鍵 / 點擊 / 分頁切走 / 捲回（近似）/ 60 s 上限；「捲回」以滾輪量累計判斷，claude 實際捲多少 BAT 不知道（見〈閱讀信號〉）。
- S1 是推估（見上表）；codex 的 Ctrl+C / Enter / Shift+Enter 行為待實機（T0902 T-5）。
- `reading` 60 s 是從「閱讀開始擋住這個佇列」起算，到時再加安靜 1 s。
- 原子窗口暫存最多 1 s：helper 的 Enter 晚於 1 s 抵達（極慢的遠端連線）時，使用者輸入先補寫，退回今天的行為。

### 驗證

- 單元：`src/lib/__tests__/tower-input-draft.test.ts`、`tower-reading-state.test.ts`、`tower-submit-enter.test.ts`（真 xterm＋TerminalPanel source guard）；`electron/__tests__/notify-hold-contract-tower.test.ts`（版本閘門、draft、reading、原子送出、回答、立即送出、提醒、日誌）、`notify-hold-contract-handlers.test.ts`（共用 handler＋真 PtyManager）；`src/components/__tests__/notify-hold-reason-menu.test.tsx`（原因、立即送出、三語系）。T0788 既有 `notify-hold.test.ts` / `notify-hold-ask-held-full.test.ts` 不改、全綠。
- e2e（隔離實例，假 TUI，不需登入）：`e2e/t0904-tower-notify-protection.spec.ts`（`e2e/fixtures/fake-line-editor.mjs`、`notify-job-runner.mjs`）：① 未宣告塔台 #23 重現、② 契約 2 草稿分開送出、③ 窗口內打字 / Enter、④ 閱讀 60 s 上限＋viewport 不動（B0）、⑤ 停手 10 s 放行、⑥ 全螢幕（alt screen＋滑鼠追蹤）往上捲停 15 s 仍保留、按鍵後送出，⑥b 捲回後 10 s 放行（T0917）。需先 `npx vite build`。
- 待實機（T0902）：T-1 / T-2（真 claude 塔台的 #23 與捲動）、T-3（fullscreen＋Auto-scroll）、T-5（codex 輸入框）、T-7（WSL 塔台的 `draft` / `reading`）、T-8（舊 CT＋新 BAT 保護停用）。

## 回合訊息卡：資料層（W3 / T0905）

- **用途**：已宣告契約 v2 的塔台分頁（判定見「版本判定」節「分頁層」），每回合一張卡片，內容是該回合 claude 的最後一則助理訊息；待辦分頁的「💬 塔台訊息」區讀這些卡片（見下一節）。
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
- `stop` 回報另帶 `origin: 'injected'` 與 `set: BAT_HOOK_SET`（= 2；`electron/bat-mcp-launch.ts` 的 `BAT_HOOK_SET` 寫在 `BAT_CLAUDE_HOOKS` 旁，兩處由 `scripts/__tests__/bat-hook-last-message.test.mjs` 守住相等）。`session-start` 也帶這兩個欄位（第一個 `Stop` 之前就知道 `set`），`bat-hooks` plugin 的回報每個事件都帶（見「hook 註冊」節）；其他注入事件的回報**逐字不變**（host 把沒有 `origin` 的回報當成 `injected`，T0902 §7.4）。
- 🔴 T0590 規則不變：一律 exit 0、stdout 不輸出、總時限 1.8 s、任何失敗靜默；`at`（T0790）規則不變。bat-scripts.log 只多 `messageBytes`（長度），不記訊息。

### host 端：`terminal:report-hook`

- 新欄位都是選填、格式不對就忽略（不回錯）：`origin`（`injected` / `plugin`，`parseHookOrigin`）、`set`（整數 1–1000，`parseHookSet`）、`lastAssistantMessage`（只看 `stop`；字串且 ≤ `REPORT_HOOK_MESSAGE_MAX_CHARS` = 64 Ki 字元）、`messageTruncated`（只有 `true` 算數）。
- **注入＋plugin 去重**（§7.4）：同一個 PTY 收過 `injected` 的回報後，`plugin` 的回報回 `{ ok: true, terminalId, result: 'duplicate' }`、不套用（tracker 不動、不進卡片），每個 PTY 只記一行 `[hooks] terminal=<id> plugin reports dropped …`。紀錄跟著 PTY 結束 / Terminal Server recovery 消失（`TerminalBlockedTracker.acceptHookOrigin` / `getHookSet`；`PtyManager` 同名方法）。`plugin` 由 `bat-hooks` plugin 的 launcher 帶（見「hook 註冊」節）。
- 套用後的 `stop` 交給 `onStop(terminalId, { message?, set? })`；handler 不記錄、不 mirror、不回傳訊息內容。回傳形狀與 T0905 前相同。

### 卡片 store（`TowerCardStore`）

| 規則 | 內容 |
|---|---|
| 誰的訊息會留下 | 只有 `towerContractStatus(role, towerContract) === 'match'`（已宣告塔台＋`--bat-contract 2`）。其他分頁（Worker、一般 claude、沒宣告契約或契約不是 2 的塔台）收到即丟，不存內容；每個分頁只記一行 `dropped: not a contract-2 Tower (length=<n>…)`。判定在收件當下做：塔台之後改宣告，已有的卡片留到 PTY 結束，新的不收 |
| 面板塔台 | 面板沒有 `--set-role`，由視窗經 `tower-cards:set-panel-tower` 呼叫 `setPanelTower(id, true)` 宣告（§6′：面板以 `_tower-state.md` 的 `bat_contract` 判定，renderer 讀檔；定義見「版本判定」節，接線見下一節〈面板塔台的判定與同步〉）；`setPanelTower(id, false)` 清掉該面板的卡片 |
| 遮罩 | 收件即 `redactTerminalSecrets`（含 server token 字面值），日誌只記遮罩次數 |
| 大小 | 遮罩後再截到 `TOWER_CARD_MAX_BYTES` = 16 KiB（UTF-8），`truncated` = hook 截過或 host 截過 |
| 上限 | 每個分頁最近 `TOWER_CARDS_MAX` = 30 張未釘選（超過丟最舊的）；釘選另計，最多 `TOWER_CARDS_PINNED_MAX` = 10 張（第 11 張 → `PIN_LIMIT`）；取消釘選後算回 30 張內（可能擠掉最舊的未釘選卡） |
| 去重 | 同一分頁、同一 session id（hook：`PtyManager.getClaudeSessionId`；面板：`panel:<id>`）＋內容 SHA-256，`TOWER_CARDS_DEDUPE_WINDOW_MS` = 10 s 內只留一張（注入與 plugin 都回報同一個 `Stop` 的情況）。10 s 後同樣內容算新的一回合 |
| 沒有訊息的 `stop` | 契約 v2 塔台的計數 `stopsWithoutMessage` 加一（G7：claude 太舊沒有這個欄位，或回合結束時沒有文字）；「💬」區依此顯示原因 |
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
- `App.tsx` 呼叫一次 `createTowerCardsSync(...).start()`（每個視窗各自一份）；卡片區與縮圖以分頁的契約狀態（`tower-contract-store`）或面板塔台判定決定要不要顯示。

### claude 版本（G7）

- `Stop` hook 的 `last_assistant_message`：最早出現在 **claude `2.1.47`**（`2.1.45` 沒有；`2.1.46` 未發佈到 npm）。T0905 以 `npm pack` 逐版二分查 `@anthropic-ai/claude-code`（`cli.js` 版查 `cli.js`，原生二進位版查 `@anthropic-ai/claude-code-linux-x64` 的執行檔），比對完整識別字（`last_assistant_message` 後面不接 `_`：較早版本已有不相干的遙測欄位 `last_assistant_message_id`，`1.0.64` 起）。`2.1.47` 的 hook 輸入 schema：`Stop` / `SubagentStop` 的 `last_assistant_message: string().optional()`（"Text content of the last assistant message before stopping"），值是最後一則助理訊息的文字區塊以空白串接後 trim，空字串時不帶。
- 比這舊的 system claude：`stop` 照樣回報，只是沒有訊息（`stopsWithoutMessage` 增加，「💬」區顯示「claude 版本太舊」）。內嵌 claude（`^2.1.331`）有這個欄位（`2.1.331` 執行檔也確認有）。

### 已知限制

- 卡片只在 host 記憶體，BAT 重開或 bat-server 重啟後沒有（T0902 §3，不重建 transcript）。
- 實際訊息大小、多段文字 / 工具呼叫回合的內容未實測（T0902 待實機 T-4）；注入＋`bat-hooks` plugin 並存的去重未實機（T-10）。

### 驗證

- 單元：`electron/__tests__/tower-cards.test.ts`（store、handlers、不在 helper 範圍）、`electron/__tests__/tower-cards-report-hook.test.ts`（report-hook 新欄位、origin 去重、onStop）、`electron/__tests__/tower-cards-panel-source.test.ts`（面板來源）、`scripts/__tests__/bat-hook-last-message.test.mjs`（hook 端、`BAT_HOOK_SET` 相等、整支腳本 exit 0 / stdout 空）、`electron/__tests__/terminal-blocked-state.test.ts`「T0905: Stop sends last_assistant_message …」（真腳本經 RemoteServer）、`src/stores/__tests__/tower-cards-store.test.ts`。
- headless：`electron/remote/__tests__/headless-tower-cards-e2e.test.ts`（真 headless＋node-pty：塔台 PTY 內宣告契約 2 並回報、Worker 與未宣告契約的塔台被丟、塔台自己的權杖呼叫 `tower-cards:*` 被拒、視窗 list / mark-read、PTY 結束清空、事件不含文字）。

## 回合訊息卡：UI 與面板塔台（W6 / T0909）

只在「版本判定」節判定相符時運作：待辦分頁整個綁版本（不符時「💬」區不出現），縮圖 `💬N` 只算相符的塔台分頁與面板塔台。資料層見上一節。

### 必守規則

- 🔴 卡片內容一律純文字：只以 React 文字節點顯示，不以 HTML / Markdown 解譯（不得用 `dangerouslySetInnerHTML`）。
- 🔴 未讀數只顯示在「💬」區標題與塔台縮圖 `💬N`，**不算進**待辦分頁標題的數字（`inboxActionCount`；T0902 §1：僅告知不催人）；也不進工作區列表。
- `⏸ 待你決定：` / `🙋 待你執行：` 開頭的行（前面可有空白、`- ` / `* ` / `> ` / `1. `；半形冒號也算）加亮，**只是提示**，不解析成資料（待你決定 / 待你執行的資料只來自 `_tower-state.md` frontmatter，見「契約 v2 清單與回答」節）。
- 🔴 資料層的規則不變：只收契約 2 塔台、遮罩、上限、生命週期、只在記憶體；`tower-cards:*`（含 `tower-cards:set-panel-tower`）都不在 `HELPER_CHANNEL_ROLES`，handler 另拒 `ctx.helper`。日誌不記卡片內容。

### 唯一實作位置

| 內容 | 位置 |
|---|---|
| 顯示用純函式（排序、加亮、預覽、摺疊、合併來源、codex 判斷、G7、縮圖數字） | `src/lib/tower-card-view.ts` |
| 面板塔台定義 | `src/lib/inbox-model.ts`：`CLAUDE_PANEL_PRESETS`、`workspaceHasPanelTowers`、`panelTowerTerminalIds`（回答目標選擇共用） |
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
- 收合預覽的取行規則（BUG-225 / T0931，`towerCardPreview`）：取程式碼區塊外第一個有字的行，略過程式碼圍欄（```` ``` ```` / `~~~`，可帶 info string；收尾圍欄須同字元且不短於開頭）、分隔線（`---` / `***` / `___`）、表格分隔列（`|---|`），標題去掉 `#` 記號（清單 / 引用記號保留）；整則只有程式碼區塊 → 區塊內第一個非空行；全部都是結構行 → 原本的第一個非空行（不回傳空字串）。截斷規則（120 字＋`…`）不變。
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
- 實機：W8 整合驗收（T0913，隔離實例）。

## 契約 v2 清單與回答（W5 / T0908）

只在「工作區層」判定相符時顯示與運作（R9′）；不符時待辦分頁只有選擇器與提示（見「版本判定」節）。

### 解析（T0902 §3.3）

唯一實作 `parseTowerInboxLists`（`src/lib/tower-inbox.ts`，純函式、不 import electron / DOM），檔案層 `parseTowerStateInbox`（`src/lib/ct-tower-overview.ts`，與 `parseTowerState` 同樣要求 `schema_kind: tower-state`＋`summary_version ≥ 1`）。

| 欄位 | 必填 / 規則 | 錯誤時 |
|---|---|---|
| `awaiting_user[].id` | `^U-\d+$` | 該筆略過並計數 |
| `awaiting_user[].summary` | 非空字串 | 略過並計數 |
| `awaiting_user[].options[]` | 每項 `<代號> <說明>`，代號 `^[A-Za-z0-9]{1,3}$`，同筆不重複（不分大小寫：CT 以不分大小寫、唯一命中解析） | 該筆改自由回答（顯示一行說明），不略過 |
| `awaiting_user[].workorder` / `kind` / `source` / `created_at` | 選填，照原字串顯示；`source` 已知全名顯示短標籤（`inbox.source.*`，三語系），未知照原字串 | 欄位忽略 |
| `user_actions[].id` / `title` | `^A-\d+$`；非空、≤ 120 字 | 略過並計數 |
| `user_actions[].command` | 選填，≤ 300 字，「複製」；其中的檔案參照可點，整個指令是一個存在的檔時改成連結＋「開啟」（T0936，見〈參考檔案連結（T0930）〉的〈🙋 的指令欄（T0936）〉） | 超過 / 非字串 → 不顯示指令（該筆保留） |
| `user_actions[].kind` | `verify` / `run` / `manual` 有標籤，其他照原字串 | — |
| `reminders[].id` / `title` / `due_at` | `^[a-z0-9-]{1,40}$`；非空；可解析的日期或日期時間 | 略過並計數 |
| `next_ids.user` / `next_ids.action` | `^U-\d+$` / `^A-\d+$` | 忽略 |
| 工單 frontmatter `waiting_user` | `^U-\d+$`（`parseWorkOrder` 的 `waitingUser`） | 不顯示 ⏸ |
| 重複 id | 第二筆起 | 略過並計數 |
| 其他未知鍵 | — | 忽略 |

- 時間（`parseCtTime`）：`+08:00`、`+0800`、`Z`、沒有時區（本地）、只有日期（本地午夜）都接受；解析不了照原字串顯示（`formatCtTime`）。
- 排序：待你決定 / 待你執行依 `created_at` 舊 → 新（解析不了的排最後，維持檔案順序）；提醒依 `due_at`。
- `> 50` 筆只畫前 50＋「另有 N 筆」（`INBOX_LIST_RENDER_MAX`）。
- `user_inbox`：專案 `_ct-workorders/_tower-config.yaml`，其次全域層（既有 proxied `ct:read-config-sources`，每次掛載與 ↻ 讀一次）；`off` / `false` / `no` → 待你決定 / 待你執行顯示「已關閉」說明、不列 CT 項目；待驗收 BUG、Worker 等你、塔台訊息照常（`effectiveUserInbox`）。

### 畫面

| 區塊 | 內容 | 動作 |
|---|---|---|
| ⏸ 待你決定 | id、工單、`source` 短標籤、`kind`、`summary`、時間；工單 `waiting_user` 對應時「⏸ T#### 暫停中」（只看未結工單） | 選項 radio＋「送出」→ `U-n：<代號>`（代號照 CT 原樣）；選項最後一項「其他（自由回答）」（T0937）→ 清單下方一行輸入框 → `U-n：<文字>`；沒有選項時的自由回答欄（Enter 或「送出」）→ `U-n：<文字>`（換行改空白） |
| 🙋 待你執行 | CT `user_actions`（在前）＋待驗收 BUG（`_bug-tracker.md`） | 「複製指令」（`navigator.clipboard.writeText`，🔴 BAT 永遠不執行）、「完成」→ `A-n：完成`、「失敗…」＋說明 → `A-n：失敗 <說明>` |
| ⏰ 到期提醒 | `due_at` 已到或 7 天內（`dueReminders`）；逾期 N 天 / 今天到期 / N 天後到期＋上次 `last_at` | — |
| 最近已結 | 從檔案消失的 `U-n` / `A-n`（`nextRecentlyClosed`，記憶體、每資料夾 10 筆、只本次啟動）；摺疊 | — |

- 這三區的筆數算進分頁標題數字（`inboxActionCount`，見「右側欄「待辦」分頁」節〈區塊〉）。
- 每筆下方顯示送出結果：已送出 / 已排入待送佇列（📨）/ 面板有草稿 / 面板未開啟 / 沒有可送的塔台 / 沒送出（原因代碼）。
- 版面（T0929，只改 DOM 結構與 CSS）：每筆由上而下是標頭列（勾選框、id、工單、標籤）→ 摘要（`summary` / `title`）自成一行、全寬（`[data-inbox-summary]`，不在 `.inbox-entry-head` 內）→ 每個選項一行（`.inbox-option-list` 內每個 `label` 一行，「推薦」標記在該選項尾端；自由回答則是全寬輸入框）→ 按鈕列（`.inbox-entry-buttons`：送出、放棄…；🙋 為完成、失敗…、略過…）自成一行，窄到放不下才換行 → 放棄 / 略過的說明欄在按鈕列下方展開。`.inbox-options` / `.inbox-free` 保留為外層回答區塊（e2e t0913 以 `.inbox-options .inbox-btn.primary` 找送出）。結構測試：`src/components/__tests__/inbox-layout-t0929.test.tsx`。

### 「其他（自由回答）」（T0937）

- 用途：`options` 非空時原本只能單選，選項都不合適時使用者只能借「放棄…」備註欄填字（CT 會把那段文字當新方向）。現在每題選項清單最後多一項「其他（自由回答）」，送出的仍是 CT 6.1.0 起就接受的 `U-n：<自由文字>`（D393，PLAN-070 子項 1）。
- 🔴 只在 `options` 可用時出現：`options: []` / 沒有 `options` 的題目維持原本的自由回答欄，`optionsInvalid` 也一樣（不重複加「其他」）；與 `inbox_features` 有沒有 `dismiss` 無關。
- 🔴 「其他」在 `role="radiogroup"`（`[data-inbox-option-list]`）內的最後一個 `<label>`，`data-inbox-option-other="<id>"`、🔴 不帶 `data-inbox-option`（它不是 CT 的代號）。永遠不是預設選取、不標推薦；有 `recommended` 時預設仍選推薦項（T0922）。
- 選了 → 清單下方、按鈕列之前出現一行輸入框（`.inbox-free-input`、`maxLength` 900、`[data-inbox-other-input]`）；Enter 或「送出」送出（IME 組字中的 Enter 不送），trim 後是空白不可送。改選其他選項時輸入框收起，文字留在元件狀態；送出成功後整筆回到預設。
- 🔴 送出路徑不變：同一個 `submit` → `awaitingAnswerText` → `sendInboxAnswer` → `tower-inbox:answer`；不新增 IPC、不改 `checkInboxAnswer` / `enqueueAnswer`（單編號行本來就接受任意文字）。
- 文字的第一個詞是「放棄」/「略過」（CT 的規則，判斷沿用 `isDismissAnswer`：後面接行尾、空白或 `，,。；;`；「放棄了…」不算）→ 輸入框下方一行提示「以「放棄」或「略過」開頭的回答，塔台會當成放棄。」（`[data-inbox-other-hint]`），🔴 只提示、不擋送出（CT 規格的已知取捨）。
- 不做多選（PLAN-070 子項 4，等 CT 核定契約後另開單）。
- 測試：`src/components/__tests__/inbox-other-t0937.test.tsx`；t0929 版面測試的選項清單斷言改成只比對帶 `data-inbox-option` 的子元素仍是 A / B / C，另斷言最後一個子元素是「其他」（塔台 T0937 Q-1 核可）。

### 回答路徑

| 目標 | 怎麼送 | 保護 |
|---|---|---|
| 已宣告契約 2 的塔台分頁 | renderer `sendInboxAnswer`（`src/lib/inbox-answer.ts`）→ IPC `tower-inbox:answer { terminalId, text }`（本機 `ipcMain`；遠端視窗 proxied 到 bat-server）→ `registerTowerInboxAnswerHandler`（`electron/notify-hold.ts`）→ `NotifyHoldController.enqueueAnswer` | prompt（T0788 reason）與 `draft` 擋、`reading` 不擋；Enter 算使用者輸入（W2） |
| 面板塔台（Claude Agent 面板） | 視窗事件 `PANEL_TOWER_ANSWER_EVENT`（`bat:panel-tower-answer`）→ 掛載中的 `ClaudeAgentPanel`（`sessionId` = 分頁 id）把這一行放進輸入框、走面板自己的 `handleSend`（回合進行中 → T0815 排隊） | 面板輸入框有字或附件、上傳中 → 回 `draft`，什麼都不動 |

- 目標選擇（`inboxAnswerTargets`，`src/lib/inbox-model.ts`；T0908 塔台補充 #1 / #2）：工作區有已宣告塔台分頁 → 只考慮其中宣告契約 2 的（不送面板）；沒有 → 面板塔台（`workspaceHasPanelTowers` / `panelTowerTerminalIds`，定義見「版本判定」節「分頁層」）。剛好一個 → 直接送；多個 → 該筆下方出現選擇列；零個 → 「沒有可送的塔台」。
- host 檢查（`checkInboxAnswer`）：字串、非空、單行（無 `\r` / `\n`）、≤ 1,000 字、`^[UA]-\d+[：:]` 開頭且後面有字；不符 → `invalid`。renderer 先檢查一次。
- 🔴 `tower-inbox:answer` 不在 `HELPER_CHANNEL_ROLES`，handler 另拒 `ctx.helper`（`FORBIDDEN`）：塔台與 Worker 的 PTY 權杖都不能冒充使用者作答。
- 回傳 `TowerInboxAnswerResult`（`src/types/notify-hold.ts`）：`{ ok: true, held, holdId }` / `{ ok: false, reason: 'invalid' | 'pty-not-found' | 'not-contract-tower' | 'held-full' | 'FORBIDDEN' | 'INVALID_ARGS' | 'unavailable' }`；舊 bat-server 沒有 handler → renderer 顯示 `unsupported`。

### 「📨 待送」在遠端視窗（T0904 建議後續 1）

T0908 起（遠端 bat-server 也要是這一版以上）：`terminal:notify-hold-list` / `-cancel` / `-send-now` 改由共用的 `registerNotifyHoldHandlers`（`electron/notify-hold.ts`）在 Electron main 與 headless 都註冊，加進 `PROXIED_CHANNELS`；事件 `terminal:notify-hold-changed` / `-reminder` 加進 `PROXIED_EVENTS`（headless 的 controller 以 `host.emit` 送出；main 改送所有視窗＋broadcastHub）。回應形狀與 T0788 相同（陣列 / 數字）；helper 權杖呼叫回 `[]` / `0`。renderer `notify-hold-store` 不必改：遠端視窗的呼叫自動路由到它的 bat-server。

### `⏸N`

- 塔台縮圖（契約 2 塔台）與工作區列表每列：`useInboxAwaitingCount(workspaceId, folder)`（`src/components/inbox/useInboxModel.ts`）= 該工作區判定相符時的 `awaiting_user` 筆數，否則不顯示；點擊開啟待辦分頁（`InboxAwaitingBadge`）。
- 資料：作用中工作區用完整的 `InboxDataSource`；其他有契約 2 塔台分頁的工作區由 `InboxStateSources` 只讀 `_tower-state.md`（`setInboxStateOnly`，同一套 `fs:*` 與共用監看）。
- detached 視窗：`DetachedWaitingReporter` 的回報多 `awaiting`（`detachedWaitingReport(entry, awaiting)`；`sanitizeDetachedWaitingReport` 只收 1 … 9999 的整數）；主視窗的 `DetachedWorkspaceWaitingRows` 在 ⚠️ 旁顯示 `⏸N`，只有 `⏸N` 的 detached 工作區也有一列（點擊不切換，見已知限制）。`awaiting` 不算進 ⚠️ 總數。

### 日誌

```
[tower-inbox] answer terminal=<id> id=U-3 len=<n> → held|sending|<reason>      ← host
[tower-inbox] answer rejected terminal=<id> check=<代碼> len=<n>
[tower-inbox] answer refused: helper capability terminal=<id>
[tower-inbox] answer terminal|panel=<id> id=U-3 len=<n> → sent|held|draft|not-mounted|failed (<reason>)   ← renderer
[notify-hold] terminal:notify-hold-list refused: helper capability terminal=<id>
[detached-waiting] workspace=<id> waiting=<n> missed=<n> awaiting=<n> → …
```

🔴 不記 `summary` / `options` / `title` / `command` / 回答文字。

### 已知限制

- `⏸N` 對「沒有已宣告塔台、只靠狀態檔」的非作用中工作區不顯示（不為了徽章讀每個工作區的檔案）；切到該工作區後才有。
- 只有 `⏸N` 的 detached 工作區列，點擊不會帶出 detached 視窗（沒有可切的分頁）；到該視窗的待辦分頁回答。
- 面板塔台的回答只在面板掛載的視窗送得出（`not-mounted` 時請先開該分頁）；面板草稿保護是「拒絕並提示」，不是排隊。
- 「最近已結」只在記憶體，且只記兩次讀檔都成功時消失的項目。
- 送出的是一行純文字，CT 端解析與移除（含決策日誌）由 CT 6.1.0 負責；BAT 不確認 CT 是否收到。

### 驗證

- 單元：`src/lib/__tests__/tower-inbox.test.ts`（時間兩種時區、選項規則、型別表逐項錯誤隔離、提醒視窗、回答格式與 host 檢查、`waiting_user`、`parseTowerStateInbox`、`effectiveUserInbox`、T0909 面板塔台函式、目標選擇、最近已結、標題數字）；`electron/__tests__/tower-inbox-answer.test.ts`（權杖拒絕、參數 / 格式、契約 2 限定、prompt / draft 擋、reading 不擋、日誌不含文字、`notify-hold-*` 共用 handler、proxied 且不在 `HELPER_CHANNEL_ROLES`）；`src/components/__tests__/inbox-w5.test.tsx`（三區畫面與送出、複製不送出、兩個塔台選擇、面板塔台與草稿、`user_inbox: off`、不符時不顯示、`⏸N`、detached `awaiting`、三語系、面板 source guard）。
- 待實機：真 claude / codex 塔台收到回答後 CT 6.1.0 的解析與移除（W8）；遠端（WSL）塔台的回答與「📨 待送」（T0902 T-7）。

## 推薦項與放棄（PLAN-069）

T0922（D346；CT 6.2.0-pre.1，CT D886 / D888 / D889）。規格唯一權威：CT `references/memory-protocol.md` § 契約 v2 欄位（`inbox_features`、`awaiting_user[].recommended`、〈放棄／略過〉、〈回答格式與解析〉）。本節只寫 BAT 端。整個分頁仍只在「工作區層」判定相符時運作（R9′，見「版本判定」節）；`bat_contract` / `towerContractStatus` / `--set-role` 都不變。

### 必守規則

- 🔴 `inbox_features` 沒有 `dismiss` 時，畫面與 PLAN-069 前完全相同：沒有勾選框、「放棄…」/「略過…」、工具列（`src/components/__tests__/inbox-plan069.test.tsx` 四種情況斷言）。
- 🔴 推薦只看 `recommended` 欄位本身（不看 `inbox_features`）；照 CT 的順序顯示，不重排；選項說明裡 CT 保留的「（推薦）」照原文顯示。
- 🔴 送出端只送明確編號：「全部放棄」/「全部略過」在**按下送出當下**展開成畫面上目前列出的編號；不送萬用字元或範圍。
- 🔴 送出沿用既有回答路徑（`tower-inbox:answer` → `enqueueAnswer`，受 prompt / `draft` 保護；面板塔台走面板路徑），沒有新 channel；`tower-inbox:answer` 仍不在 `HELPER_CHANNEL_ROLES`、handler 照舊拒 `ctx.helper`。
- 🔴 日誌只記 id、id 數量、長度、結果；不記 `summary` / `options` / 回答 / 原因文字。

### 唯一實作位置

| 項目 | 位置 |
|---|---|
| `inbox_features` 解析 | `parseInboxFeatures`（`src/lib/tower-inbox.ts`），結果在 `TowerInboxLists.features`；`useInboxModel` 的 `features` |
| 推薦比對 | `matchRecommended`（同檔），結果在 `AwaitingItem.recommended`（CT 寫的代號原樣） |
| 放棄 / 略過字串 | `dismissAnswerText(ids, 'awaiting' \| 'action', note?)`（同檔） |
| 回答檢查（renderer 與 host 共用） | `checkInboxAnswer`、`INBOX_BATCH_PREFIX`、`isDismissAnswer`（同檔） |
| 日誌片段 | `inboxAnswerLogIds`（同檔）；renderer `src/lib/inbox-answer.ts`、host `registerTowerInboxAnswerHandler`（`electron/notify-hold.ts`） |
| 畫面 | `src/components/inbox/InboxLists.tsx`（`DismissControl` / `DismissCheck` / `DismissToolbar`、`AwaitingRow` 的推薦標記）；`InboxPanel.tsx` 依 `features.includes('dismiss')` 傳 `dismiss` |

### `inbox_features` 讀法

- `_tower-state.md` 頂層，字串陣列（CT 6.2.0 起每次寫 `["recommended", "dismiss"]`）。不是陣列或不存在 = 空陣列（= CT 6.1.x）。
- 只留 BAT 認得的值（`INBOX_FEATURES` = `recommended`、`dismiss`），前後空白去掉、去重；不認得的值（例 `future-value`）與非字串忽略，不報錯。
- `dismiss` → 顯示放棄 / 略過控制項。`recommended` 只是說明 CT 會寫 `recommended`，BAT 不依它決定顯示。

### 推薦比對

- `awaiting_user[].recommended`：字串，與同一筆 `options` 的代號**不分大小寫**比對，命中時記下該選項的代號原樣（例 `recommended: "c1"` 對 `C1`）。
- 沒有這個鍵、不是字串、空字串、對不到、`options` 是空陣列或格式不對（自由回答欄）→ 沒有推薦。🔴 不報錯、不略過該筆、不計入「略過 N 筆」。
- 畫面：推薦選項旁「推薦」標記（`inbox.recommended`，三語系）；使用者還沒選任何選項時預設選取它（「送出」可直接按，送 `U-n：<推薦代號>`）；點了別的選項就以使用者的選擇為準。

### 控制項出現條件

| 條件 | 待你決定 | 待你執行（CT `user_actions`） |
|---|---|---|
| `inbox_features` 沒有 `dismiss` | 與 T0908 相同 | 與 T0908 相同 |
| 有 `dismiss`，每筆 | 勾選框＋「放棄…」 | 勾選框＋「略過…」 |
| 有 `dismiss`，該區有項目 | 工具列「放棄勾選（N）」「全部放棄」 | 工具列「略過勾選（N）」「全部略過」 |

- 待驗收 BUG（🙋 區下半）不是 CT 項目，沒有略過。
- 「放棄…」/「略過…」展開頁內一欄選填的「原因」（T0937 前是「原因或新方向」；要給新方向改用「其他（自由回答）」）＋送出 / 取消（不用 `window.confirm`、不開 Dialog）；Enter 也會送出。
- 工具列按下後展開頁內確認：列出這次要送的編號（以 `、` 分隔）＋一欄共用的選填文字＋送出 / 取消。「放棄勾選」在沒有勾選時停用。

### 送出格式

| 動作 | 送出的一行 |
|---|---|
| 單筆放棄 | `U-n：放棄`、`U-n：放棄 <文字>` |
| 單筆略過 | `A-n：略過`、`A-n：略過 <文字>` |
| 批次（每區一行） | `U-1、U-3、U-4：放棄 <文字>`、`A-2、A-3：略過` |

- 全形冒號、編號以 `、` 分隔；文字的換行與 tab 改空白、前後空白去掉（`oneLine`）。批次只勾一筆時送單筆格式。
- 兩區都要送時各自按自己的工具列，各送一行（各一次 `tower-inbox:answer`）。批次送出成功後清掉該區的勾選。
- 處理完的項目由 CT 從清單移除；「最近已結」照舊以清單消失判定（BAT 不判斷 CT 是否接受）。

### 「全部」展開規則

- 確認列顯示的編號與送出的編號都在**當下**計算：檔案在確認列開著時變動（有項目消失或新增）→ 確認列跟著更新，送出的是按下送出那一刻畫面上列出的編號。
- 「列出的」= 畫面上畫出的項目（上限 `INBOX_LIST_RENDER_MAX` = 50；CT 每區 ≤ 20 筆，實際上就是全部）。
- 勾選後消失的項目不會送出（勾選只對目前列出的編號有效）。

### 回答檢查放寬（`checkInboxAnswer`）

- 單編號：`^[UA]-\d+[：:]` 開頭且後面有字 → `ok`，與 T0908 相同（既有測試不改；`U-3：放棄` 本來就接受）。
- 多編號（`INBOX_BATCH_PREFIX`）：兩個以上 `[UA]-\d+`，以 `、`、`,`、`，` 分隔（前後空白忽略）再接冒號；冒號後第一個詞是「放棄」或「略過」才 `ok`。第一個詞的定義照 CT：去掉前導空白後以這兩字開頭，後面是行尾、半形 / 全形空白，或 `，` `,` `。` `；` `;`（`isDismissAnswer`；「放棄吧」不算）。
- 其他多編號行（選項代號、自由文字、`完成` / `失敗`）→ `bad-batch`；萬用字元與範圍（`U-*`、`U-1～U-5`、`U-1-5`）→ `bad-prefix`。單行、≤ 1,000 字照舊。
- host 的拒絕形式不變：不符 → `{ ok: false, reason: 'invalid' }`＋`answer rejected … check=<代碼> len=<n>`。

### 相容

| CT＼BAT | 舊 BAT（T0908） | 新 BAT（T0922） |
|---|---|---|
| CT 6.1.x（沒有 `inbox_features` / `recommended`） | 照舊 | 與舊 BAT 相同：沒有推薦標記、沒有放棄控制項 |
| CT 6.2.0 | 忽略兩個新鍵（未知鍵）；選項文字裡的「（推薦）」仍看得到；沒有放棄控制項，使用者可在塔台自己打 `U-n：放棄` | 推薦標記＋預設選取；有放棄 / 略過 / 批次 |

- 舊 BAT 的 host 檢查不接受批次行，但舊 BAT 的畫面也不會送；新 BAT 的畫面連到舊 bat-server（遠端視窗）送批次行會被拒（`invalid`）——升級 bat-server 即可。
- 版本不符（P-1 / P-2 / P-3）時整個分頁不顯示清單，與 PLAN-069 無關。

### R6：塔台暫停改用原生選單

CT 6.2.0 起暫停時（`interactive-prompts: on`）先寫 `awaiting_user` 再開原生選單（`AskUserQuestion`），選項總數 ≤ 3 時最後多一項「放棄」。BAT 不用改：

- 選單開著時塔台分頁是 `question` blocked，待辦分頁送出的回答（含放棄 / 批次）由通知保護（`enqueueAnswer`）保留到選單關閉後才送（「📨 待送」）。
- 使用者已在選單或終端回答同一筆時，送到的那一行由 CT 回「編號已結」（不重複套用）；BAT 不比對、不攔截。

### 日誌

```
[tower-inbox] answer terminal=<id> id=U-1 ids=3 len=<n> → held|sending|<reason>     ← host，批次多 ids=<數量>
[tower-inbox] answer rejected terminal=<id> check=bad-batch len=<n>
[tower-inbox] answer terminal|panel=<id> id=A-2 ids=2 len=<n> → sent|held|…          ← renderer
```

單編號行的日誌與 T0908 逐字相同（`id=U-3`）。

### 已知限制

- 送出後的接受與否只看清單有沒有消失；CT 回「編號已結」或「不支援」只出現在塔台分頁。
- 多個塔台時（目標選擇列）批次送出後勾選不自動清除、確認列不自動收起；選了目標並送出後，項目消失即可。
- 新 BAT 連舊 bat-server 時批次行被拒（見〈相容〉）；單筆放棄 / 略過照常。
- 面板塔台：放棄的那一行一樣放進面板送出；面板輸入框有字時照舊回 `draft`。

### 驗證

- 單元：`src/lib/__tests__/tower-inbox-plan069.test.ts`（CT 範例狀態檔複本 `src/lib/__tests__/fixtures/ct-tower-state-v620.md`：`future-value` 忽略、flow / block `options`、大小寫不同的推薦代號、自由回答；`parseInboxFeatures`、`matchRecommended`、`dismissAnswerText`、`isDismissAnswer`、批次檢查、日誌片段）；`src/lib/__tests__/tower-inbox.test.ts`（T0908 既有檢查不改）。
- host：`electron/__tests__/tower-inbox-answer.test.ts`〈PLAN-069〉（批次行送達、其他多編號 / 萬用字元 / 範圍 / 多行 / 超長拒絕、權杖拒絕、日誌 `ids=` 且不含文字）。
- 元件：`src/components/__tests__/inbox-plan069.test.tsx`（推薦標記＋預設選取＋可改選、沒有 `dismiss` 的四種情況沒有控制項、單筆放棄 / 略過有無文字、勾選批次與確認、「全部」送出當下展開、兩區各一行、日誌不含內容、三語系）。
- 待實機（真實塔台回合）：見 T0922 回報區〈待實機〉（CT T0566〈給塔台〉M-1–M-15 中需要真實回合的項目）。

## 參考檔案連結（T0930）

- **用途**：「⏸ 待你決定」「🙋 待你執行」「⏰ 到期提醒」的項目中提到的檔案可以點：切到主畫面上方的「檔案」頁籤、在檔案樹展開並選取該檔。CT 契約 v2 沒有檔案欄位，所以從 `workorder` / `ref` 標籤與 `summary` / `title` 文字辨識。T0934 起「💬 塔台訊息」卡片也適用（見〈塔台訊息卡片（T0934）〉）；T0936 起「🙋 待你執行」的 `command` 也適用（見〈🙋 的指令欄（T0936）〉）。
- **唯一實作**：辨識與路徑解析 `src/lib/inbox-file-refs.ts`（純函式：`parseCtId`、`splitFileRefs`、`resolveRefPath`、`refLookups`、`matchIdFile`）；存在檢查 `useInboxFileRefs`（`src/components/inbox/useInboxFileRefs.ts`）；顯示 `InboxRefText` / `InboxRefTag`（`src/components/inbox/InboxRefText.tsx`），由 `InboxLists.tsx` 的三個清單使用；工作區根目錄由 `InboxPanel` 以 `folder` 傳入（沒有 → 全部純文字、不檢查）。

### 必守規則

- 🔴 開啟一律經既有的 `openFileInFilesTab`（`src/state/openFileInFilesTab.ts`：`workspace-switch-tab` → `files`＋`file-tree-reveal`，BUG-048 / T0213）；不另寫事件、不新增 IPC channel、不 `shell.openExternal`、不開外部編輯器。
- 🔴 只連結存在、而且在工作區根目錄之下的檔；其他一律純文字、不報錯。
- 🔴 顯示只用 React 文字節點與元素（`<button>`），不以 HTML 解譯；畫面上的文字與原文逐字相同（反引號照舊顯示，只有裡面的路徑變成連結）。不改回答格式、送出路徑、`inbox_features` 判斷與 T0929 的版面；既有 `data-inbox-*` 屬性不變。
- 🔴 不輪詢；不記日誌（沒有任何內容或路徑進日誌）。

### 辨識規則

| 片段 | 條件 | 對應的檔 |
|---|---|---|
| 工單 | `T` ＋ 4 位以上數字，可帶 2–4 個大寫字母的前綴（`LB-T0184`） | `_ct-workorders/` 中檔名 `<ID>-….md`（或 `<ID>.md`）的檔，找不到再看 `_ct-workorders/_archive/workorders/` |
| BUG | `BUG-` ＋ 3 位以上數字 | 同上，封存在 `_archive/bugs/` |
| PLAN | `PLAN-` ＋ 3 位以上數字 | 同上，封存在 `_archive/plans/` |
| EXP | `EXP-<大寫英數>-` ＋ 3 位以上數字 | 同上，封存在 `_archive/workorders/`（本專案的實際位置） |
| 決策 | `D` ＋ 3 位以上數字 | `_ct-workorders/_decision-log.md`（只開檔、不定位到該條；`_archive/decisions/` 不處理） |
| 路徑 | 含 `/` 或 `\`、最後一段有副檔名（`.gitignore` 這種只有開頭一個點的不算）；反引號內整段，或句中一段 ASCII 路徑字元 | 相對路徑依序試「工作區根目錄」與「`_ct-workorders/`」；工作區內的絕對路徑也可以 |
| 檔名（T0935） | 不含 `/` `\`、有副檔名：最後一個 `.` 之後 1–8 個英數字、至少一個英文字母（`0.8.0`、`v1.2`、`v0.8.0-pre.7` 這類版號不算）；句中以英數字或 `_` 開頭、只含 ASCII 英數字與 `_` `.` `-`（`_reply-2026-11-26-topic.md`、`_tower-state.md`、`README.md`），反引號內整段可含中文（不以 `.` `-` `~` 開頭） | 同路徑：依序試「工作區根目錄」與「`_ct-workorders/`」，**存在才連結**——`github.com`、`example.org` 這類網域名稱只有在根目錄或 `_ct-workorders/` 真的有同名檔時才會連 |

- 標籤（`workorder` / `ref`）只認上表的編號（整個值就是一個編號）；本地規則編號等其他值維持純文字。
- 文字中：反引號內整段是一個編號或路徑才成連結（反引號留在文字裡）；其他位置找編號與路徑，前後必須不是英數、`_`、`.`、`-`、`/`、`\`、`:`、`@`、`~`（所以中文與中文標點旁邊可以、`XT0275` / `T0275x` / 路徑中的編號不會）。路徑後面句子自己的 `.` / `-` 不算在路徑內。`:行[:欄]` 後綴在解析時去掉、顯示照舊。
- 檔名（T0935）：前後界線同上（中文、中文標點、半形 / 全形括號、引號、反引號旁邊都可以），句尾的 `.` / `-` 不算在檔名內；後面接 `:` `@` `~` 的不算（`README.md:12` 不連結，這點與路徑不同）。以編號開頭的檔名（`T0275-sample.md`）照 T0930 當作編號（連到該編號的檔）。解析成與路徑相同的 `kind: 'path'` 參照，存在檢查、顯示、開檔全部沿用。
- 一律不連結：URL（任何 `scheme:`，含 `file://`）與 URL 內的任何片段、UNC（`\\host\…`、`//host/…`）、`~` 開頭、含 `..` 的路徑、工作區外的絕對路徑、`C:foo` 這種磁碟相對路徑。Windows 磁碟路徑比對根目錄時不分大小寫，POSIX 分大小寫。
- 含空白的路徑與檔名不辨識；中文檔名只在反引號內辨識（句中只認 ASCII 路徑字元）。

### 存在檢查

- 用既有的唯讀 `fs:stat`（路徑）與 `fs:readdir`（編號：列出資料夾找檔名），與 `InboxDataSource` 同一套；遠端工作區走 proxied channel、讀視窗綁定的 host。
- 每個清單只檢查自己顯示的項目（`INBOX_LIST_RENDER_MAX` 之內），去重後最多 `INBOX_FILE_REF_MAX` = 40 個；一次檢查中每個資料夾只列一次；`stat` / `readdir` 失敗 = 找不到。
- 時機：清單掛載時、工作區根目錄改變或顯示的參照集合改變時；不輪詢。`_ct-workorders/` 的變更讓清單重讀，但參照集合沒變就不重新檢查（見〈已知限制〉）。
- 連結的 `title` 與 `data-inbox-file-ref` 是相對工作區根目錄的路徑；送給 `openFileInFilesTab` 的是 `<根目錄>/<相對路徑>`（根目錄保留原本寫法，同指揮塔「📄 檢視檔案」）。

### 外觀

- 文字中的連結：`.inbox-file-link`，與指揮塔總覽的檔案連結 `.ct-overview-link` 相同（accent 色、滑過底線、`overflow-wrap: anywhere`）。
- 標籤：沿用 `.inbox-item-source` 外框，加 `.inbox-file-tag`（accent 色、滑過底線）。
- 兩者都是 `<button type="button">`：Tab 可聚焦、Enter / 空白鍵開啟（`:focus-visible` 外框）。

### 塔台訊息卡片（T0934）

- **範圍**：「💬 塔台訊息」卡片中**按鈕以外**的文字：收合時的加亮行（`towerCardHighlights`）、展開後的內文（`towerCardLines`：摺疊時是 `towerCardFold` 的 head，按「顯示全部」後是全文）。辨識、存在檢查、顯示、開檔都沿用上面的同一套（`splitFileRefs`、`useInboxFileRefs`、`InboxRefText`、`openFileInFilesTab`），規則（只連工作區內存在的檔、URL / `..` / UNC / `~` 一律不連、文字逐字不變）完全相同。
- 🔴 **收合時的一行摘要（`.tower-card-preview`）沒有連結**：它在卡片的展開 / 收合按鈕 `.tower-card-toggle`（`<button>`）裡面，`<button>` 內不可再放 `<button>`，所以維持純文字；摘要取行（`towerCardPreview`，T0931）不變。
- 🔴 點連結不切換卡片展開狀態、不改已讀 / 釘選（`RefLink` 的 `stopPropagation`，連結也不在 toggle 按鈕內）；卡片仍只用 React 文字節點與元素組成。
- 存在檢查只查目前顯示的部分：收合的卡只查加亮行、展開的卡查顯示中的行（摺疊時不查被摺掉的部分），所有卡片合計去重後最多 `INBOX_FILE_REF_MAX` = 40 個（依卡片排列順序：釘選、較新的先）。展開 / 收合、「顯示全部」改變參照集合時才重新檢查。
- 工作區根目錄由 `InboxPanel` 以 `folder={workspaceFolderPath}` 傳給 `TowerCardsSection`（與三個清單相同）；沒有 → 全部純文字、不檢查。連結在卡片行內保留 `pre-wrap`（`.tower-card-line .inbox-file-link`）。
- 驗證：`src/components/__tests__/inbox-tower-card-file-refs-t0934.test.tsx`（收合卡的加亮行可連結、toggle 按鈕內沒有任何互動元素、展開卡內文的存在 / 不存在 / 工作區外 / URL、點擊送出兩個事件且卡片展開 / 已讀 / 釘選不變、摺疊卡只查 head、沒有根目錄時不檢查）。

### 🙋 的指令欄（T0936）

- **背景**（BUG-226）：塔台會把要使用者審閱的檔（例 `_ct-workorders/_reply-<日期>-<主題>.md`）寫在 `user_actions[].command`；修正前指令欄只有原文與「複製指令」，複製檔名沒有用處。
- **行為 A**（指令中含參照）：`command` 仍以 `<code class="inbox-command-text">` 顯示，內容經 `InboxRefText`，存在的路徑 / 檔名 / 編號成連結，文字逐字不變；「複製指令」保留，複製的仍是原始 `command` 全文；`title` 照舊是「BAT 不會執行這個指令…」（`inbox.action.commandNote`）。
- **行為 B**（整個 `command` 就是一個檔）：純函式 `soleFileRef`（`src/lib/inbox-file-refs.ts`）判斷——`command` trim 後，可去掉外層一對 `` ` `` / `"` / `'`（內容不含同一種引號、不跨行）；引號內整段可以是一個編號、路徑或檔名，也可以是含空白的路徑（`"docs/a b.md"`）；否則 `splitFileRefs` 必須只得到一個參照、其餘只有空白。結果存在（`useInboxFileRefs` 已解析到目標）→ 指令文字整段是連結（`data-inbox-command-file`），按鈕改成「開啟」（`data-inbox-open`，`inbox.action.open`），兩者都經 `openFileInFilesTab` 開解析後的檔；不顯示「複製指令」；`title` 改成 `inbox.action.openNote`。存在檢查尚未完成或找不到 → 照行為 A。
- 不是單一參照的例子：`pwsh -File e2e/manual/x.ps1`（還有其他文字）、`npm run build`（沒有參照）、兩個路徑、空字串、URL。
- 存在檢查：`ActionList` 收集 `commandFileRefs(item.command)`（`useInboxFileRefs.ts`：整個指令的參照在前，再加指令中的參照），與標籤、`title` 共用同一個 `INBOX_FILE_REF_MAX` = 40（未改）。
- 🔴 不變：BAT 永遠不執行 `command`（不送進終端、不 shell open）；開檔只走 `openFileInFilesTab`，工作區外 / URL / `..` 一律不連（`resolveRefPath` 同 T0930）；「完成」「失敗…」「略過…」、回答格式、勾選批次、`checkInboxAnswer` 與其他清單不變。
- 驗證：`src/lib/__tests__/inbox-file-refs.test.ts`〈soleFileRef (T0936)〉、`src/components/__tests__/inbox-command-file-t0936.test.tsx`（存在的檔：連結＋「開啟」、點擊送出兩個事件、沒有「複製指令」；不存在：純文字＋複製；真的指令：路徑可點、複製原文全文；含空白的引號路徑與工單編號）。

### 遠端與 detached

- 遠端工作區：存在檢查走 proxied `fs:*`；`file-tree-reveal` 的路徑是 host 上的路徑，檔案樹本身也讀同一個 host，所以行為與本機相同（未實機，見〈已知限制〉）。
- detached 視窗：自己的 `InboxPanel` 傳自己的工作區根目錄；`workspace-switch-tab` / `file-tree-reveal` 是該視窗內的事件，切的是 detached 視窗自己的「檔案」頁籤（未實機）。

### 已知限制

- 檢查結果在參照集合不變時沿用：之後才建立 / 刪除的檔，要等清單內容改變、切換工作區或重開分頁才會更新連結狀態（不輪詢的取捨）。
- `D###` 只開 `_decision-log.md`，不捲到該條；封存在 `_archive/decisions/` 的決策不連結。
- 同一編號在熱區與封存區都有檔時開熱區的；同一資料夾有多個 `<ID>-….md` 時開檔名排序第一個。
- 遠端工作區與 detached 視窗的實際點擊未實機。
- 檔名（T0935）只試工作區根目錄與 `_ct-workorders/`，放在其他子資料夾的檔只寫檔名時不連結（要寫路徑）。像 `e.g`、`Node.js`、`fs.stat` 這類帶點的字也會被當成候選去 `stat`（找不到即純文字）；它們與真的參照共用 `INBOX_FILE_REF_MAX` = 40 的上限（依出現順序），候選很多的長文中後面的參照可能不檢查。

### 驗證

- 單元：`src/lib/__tests__/inbox-file-refs.test.ts`（反引號路徑、裸路徑、四種編號＋前綴工單、工作區外 / `..` / URL / UNC / `~`、反斜線與正斜線、中文標點相鄰、`:行` 後綴、`matchIdFile`、`refLookups`；T0935 檔名：括號 / 反引號 / 句中、版號不算、網域只是候選、不完整的 `.md` / `file.`、界線、副檔名長度、以編號開頭的檔名）。T0935 依塔台 Q-1 只改了 T0930 一行斷言（`sample.md` 移到檔名測試，改為候選），其餘不變。
- 元件（T0935）：`src/components/__tests__/inbox-bare-filename-refs-t0935.test.tsx`（三個清單與展開的 💬 卡片：根目錄 / `_ct-workorders/` 存在的檔名成連結、根目錄優先、點擊開解析後路徑、不存在 / 版號 / 網域為純文字且文字不變）。
- 元件：`src/components/__tests__/inbox-file-refs-t0930.test.tsx`（存在的標籤 / 路徑 / 編號是按鈕、點擊送出兩個事件與解析後路徑、不存在 / 工作區外 / URL 是純文字且文字不變、只對工作區內路徑 `stat`、沒有根目錄時不檢查）；既有 inbox 元件測試不改斷言。

## hook 註冊（W9 / T0910）

> 規格：T0902〈第二版〉§3.1′（`hooks:` 行、`hooksStatus`）、§7（7.0–7.7）、R12 / R13；`hooks:` 行文法另見 PLAN-068〈契約細節補充〉（已告知 CT，CT 6.1.0 依此解析）。

- **用途**：讓塔台與 CT 知道「這個 claude 有沒有在回報 BAT 的 hooks、沒有的話為什麼」。BAT 開的 claude-cli 分頁照舊自動注入（`--settings=`，T0590）；注入不到的情況（手打 `claude`、自訂 `--settings`、Settings › BAT MCP 關閉、遠端手打）由使用者自選安裝 Claude Code plugin `bat-hooks`（BAT repo 的 marketplace）補上。
- **唯一實作**：判定 `computeHooksStatus` 與每分頁紀錄 `ClaudeHooksRecords` / `claudeHooksRecords`（`electron/claude-hooks-status.ts`，不 import electron）；形狀、代號、`hooks:` 行 `hooksStatusLine`、renderer 提示 `src/lib/hooks-status.ts`；啟動決定 → 代號 `hooksLaunchReasonOf` / `hooksLaunchRecordOf`（`electron/bat-mcp-launch.ts`，`createBatMcpLaunchArgs` 寫入）；查詢 `PtyManager.getHooksStatus` / `waitForHookReport` / `noteTowerAgentHint`、推送 `refreshHooksStatus`；`--set-role` 等待 `setTerminalRole`（`electron/terminal-role.ts`）；helper 輸出 `hooksLine`（`scripts/bat-terminal.mjs`）；plugin `.claude-plugin/marketplace.json`、`plugins/bat-hooks/`。

### 啟動決定與原因代號（§7.1 / §7.2）

每次 BAT 決定一個有 terminal id 的 claude / codex 分頁怎麼啟動（`agent:bat-mcp-launch-args`、helper 派工），`createBatMcpLaunchArgs` 依 terminal id 記一筆（`claudeHooksRecords`，比照 `claudeSessionNameRecords`；512 筆上限、同 id 重啟覆寫、其他 agent 清掉）。🔴 只記錄，命令列與 T0905 前逐字相同。

| 代號 | 何時（啟動時決定，claude） | 對應 T0902 §7.1 |
|---|---|---|
| （無，注入成功） | hooks 注入且 claude 自己的設定沒關 | G1 / G9 |
| `settings-off` | Settings › BAT MCP 關閉（R13：hooks 跟著不注入，只顯示原因） | G2 |
| `user-settings-arg` | 自訂參數已有 `--settings` | G3 |
| `claude-hooks-disabled` | managed / 使用者 `settings.json` 的 `disableAllHooks: true`（照樣注入） | G4 |
| `managed-hooks-only` | managed 的 `allowManagedHooksOnly: true`（照樣注入） | G5 |
| `no-endpoint` | RemoteServer 沒在聽（分頁沒有 helper 端點） | G13 |
| `script-missing` | `bat-hook.mjs` 不在 helper 目錄，或 hook 設定檔寫不進去 | G13 |
| `unrepresentable-path` | 路徑含 `'` 等，hook 指令寫不成 bash / PowerShell 都能跑的字串 | G13 |

詢問時才決定的兩個：`no-report`（有紀錄且注入了，但這個 PTY 還沒有任何 hook 回報；G6，例如專案 `.claude/settings*.json` 關掉 hooks。claude-cli preset 的分頁沒有紀錄時也算這個：BAT 重開、Terminal Server 保留的 PTY）、`not-launched-by-bat`（沒有紀錄、不是 claude-cli preset，而且是塔台或 `--agent` 說是 claude；G8 / G10）。

### `hooksStatus`（§3.1′）

`{ state: 'ok', origin: 'injected' | 'plugin', set, reason?: 'plugin-outdated' } | { state: 'none', reason } | { state: 'n/a', reason: 'codex' } | null`，判定順序（`computeHooksStatus`）：

1. 這個 PTY 有任何 hook 回報被套用（`TerminalBlockedTracker.getHookOriginInfo`）→ `ok`。有 `injected` 就是 `injected`（`set` = 回報帶的，沒帶 = 這版 BAT 的 `BAT_HOOK_SET`）；只有 `plugin` → `plugin`、`set` = plugin 帶的 `--hook-list`（沒帶 = 1），比 `BAT_HOOK_SET` 小 → `reason: 'plugin-outdated'`。🔴 並存時以 injected 為準、不出 `plugin-outdated`。
2. 啟動紀錄是 codex、preset `codex-cli`、或 `--set-role --agent` 是 codex → `n/a (codex)`。
3. 有啟動紀錄 → 它的代號，沒有代號 → `no-report`。
4. 沒有紀錄：preset 是 claude-cli → `no-report`；塔台或 hint 是 claude → `not-launched-by-bat`；其他 → `null`。

- 查詢：`terminal:whoami`、`terminal:list` 每列（含 `scope: 'towers'`）、`terminal:get-state` 都多 `hooksStatus`（結束的分頁 `null`）；BAT MCP 的 `bat_whoami` / `bat_get_state` / `bat_list_terminals` 原樣帶出，摘要加 `hooks=…`（全唯讀）。🔴 只有代號與數字，不含路徑、設定檔名、內容或權杖。
- `--agent` hint：每次 `--set-role` 都覆寫（`noteTowerAgentHint`，沒帶就清除），只用來判斷 codex / claude。

### `--set-role` 的 `hooks:` 行（§7.2）

- 🔴 只在 `--set-role tower --bat-contract <n>`、而且 BAT 回了合法 `hooksStatus` 時輸出，位置在 `bat-contract:` 行之後；不帶 `--bat-contract` 的舊呼叫請求 / 輸出 / exit code 逐字不變（`setTerminalRole` 照舊同步回答、不帶 `hooksStatus`）。
- 文法（🔴 不得更改）：`  hooks: ok (<injected|plugin>, set <n>)`、`  hooks: ok (plugin, set <n>, plugin-outdated)`、`  hooks: none (<代號>)`、`  hooks: n/a (codex)`。
- 等待：宣告契約時若狀態是 `none`（還沒有任何回報、不是 codex），主行程最多等 `HOOKS_STATUS_WAIT_MS` = 2 s（`waitForHookReport`：第一個回報被套用、PTY 結束或逾時就結束），再回答。helper 對帶 `--bat-contract` 的呼叫等回答 8 s（其他照舊 3 s）。日誌 `[set-role] id=<id> hooks=<狀態>[ (waited <ms> ms[, no report])]`。
- `session-start` 回報也帶 `origin: injected` / `set`（`reportOrigin`，`scripts/bat-hook.mjs`），所以第一個 `Stop` 之前就有 `set`；其他注入事件的回報不變（見「回合訊息卡：資料層」節〈hook 端〉）。

### 推送：`terminal:hooks-status`（main → 視窗，proxied）

- `PtyManager.refreshHooksStatus`：只對「已宣告塔台＋有 `towerContract`」的分頁，在狀態改變時送 `{ id, hooksStatus }`（`--set-role`、回報被套用、⏻ 重啟 / PTY 結束、Terminal Server recovery）。遠端視窗經 `PROXIED_EVENTS` 收到；`path-aware-channels.ts` 歸為不轉換。renderer 以 `pty.onHooksStatus`（`electron/preload.ts`）訂閱。
- 🔴 這個事件與相關 channel 都不在 `HELPER_CHANNEL_ROLES`（只是 main → 視窗的事件）。
- renderer：`src/stores/hooks-status-store.ts`（第一次被讀時自己訂閱一次；`pty:exit` 清掉；不改 `App.tsx`）。

### 提示（只對契約 v2 塔台，R9′）

- 縮圖徽章 `🪝✕`（`TerminalThumbnail.tsx`）：分頁的 `towerContractStatus` 是 `match` 且 `hooksStatus.state === 'none'`；tooltip = 前綴「這個塔台沒有 BAT hooks：回合訊息卡與對話框保護不可用。」＋代號的說明（三語系 `hooksStatus.*`；`no-endpoint` / `script-missing` / `unrepresentable-path` 共用「BAT 的 helper 異常…」）。`ok`、`n/a`、`plugin-outdated`、契約不符的塔台都不出徽章。
- 待辦分頁：相符時在標頭下方一行（`src/components/inbox/InboxHooksHint.tsx`），內容同 tooltip＋「怎麼修」連結（`HOOKS_HELP_URL` → README「BAT hooks 與 `bat-hooks` plugin（選用）」節；🔴 該標題不得改名）；`plugin-outdated` 顯示更新提示（不加「沒有 hooks」前綴）。
- CT 開工面板的文字由 CT 自己做（§7.7 C-2）。

### `bat-hooks` plugin（§7.3，R12）

| 檔案 | 內容 |
|---|---|
| `.claude-plugin/marketplace.json` | marketplace `better-agent-terminal`，一個 plugin：`bat-hooks`（`./plugins/bat-hooks`，`1.0.0`） |
| `plugins/bat-hooks/.claude-plugin/plugin.json` | 名稱、版本、說明；hooks 由預設位置 `hooks/hooks.json` 載入，沒有指令 / MCP / agent |
| `plugins/bat-hooks/hooks/hooks.json` | 與 `BAT_CLAUDE_HOOKS` 同樣的事件、matcher、`async`、`timeout: 5`；每個指令 `node "${CLAUDE_PLUGIN_ROOT}/scripts/bat-hooks-launcher.mjs" <event>`（同一字串給 bash 與 PowerShell） |
| `plugins/bat-hooks/scripts/bat-hooks-launcher.mjs` | launcher（零依賴） |

launcher 規則（🔴）：

- 只在 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / `BAT_TERMINAL_ID` 都有、`BAT_HELPER_DIR` 是絕對路徑（無 NUL）、`<BAT_HELPER_DIR>/bat-hook.mjs` 是存在的檔案、事件在白名單時才執行；否則立即 exit 0、無輸出。不接受其他路徑、參數或檔名。
- 執行**該分頁所屬 BAT** 的 `bat-hook.mjs <event> --hook-list <PLUGIN_HOOK_LIST>`：預設在同一個 node 程序內載入（省一次啟動），`BAT_HELPER_NODE` 是存在的絕對路徑且不是目前的 node 時改用它（stdin 轉給它、stdout / stderr 丟掉）。
- T0590 規則同樣適用：一律 exit 0、stdout / stderr 不輸出、`LAUNCHER_DEADLINE_MS` = 2.5 s 內結束（`bat-hook.mjs` 自己 1.8 s）、任何失敗靜默。
- `bat-hook.mjs` 看到 `--hook-list <n>` → 每個事件都帶 `origin: 'plugin'`、`set: n`（缺 origin 會被當成 injected，之後的 plugin 回報會被丟掉，所以 plugin 一律帶；T0905 §7.4）。
- **信任模型**：路徑來自 claude 程序的環境變數（BAT 設在 PTY）；能改這個 env 的人本來就能控制這個程序要跑什麼（與 PATH 同等）。plugin 本身不含權杖，由使用者以 claude 自己的 `/plugin install` 流程同意安裝；BAT 不替使用者安裝、不改 claude 設定、BAT 的解除安裝程式不動 claude 設定。
- 🔴 plugin 不進安裝檔：`build.files` / `extraResources` / `asarUnpack` 不動（`scripts/__tests__/bat-hooks-plugin.test.mjs` 守住），`verify-*` 不受影響。
- 改 `BAT_CLAUDE_HOOKS` 時：`BAT_HOOK_SET`、`plugins/bat-hooks/hooks/hooks.json`、launcher 的 `PLUGIN_HOOK_LIST` 與 plugin / marketplace 版本一起升（同一測試比對）。

### (d1) BAT 注入 `--plugin-dir` 的評估（只評估、未實作）

- 內嵌 claude `2.1.331` 有 `--plugin-dir <path>`（「Load a plugin from a directory or .zip for this session only」，可重複；另有 `--plugin-dir-no-mcp`）。執行檔字串顯示同名 plugin 也從 marketplace 安裝時，claude 會區分「`--plugin-dir` copy」與已安裝的那份（「This --plugin-dir copy did not load …」、`synced-plugin-shadowed` 等），實際以哪份為準、兩份 hooks 會不會都跑，沒有真實 session 無法確認。
- 結論：**不建議採用**。它只補 G3（自訂 `--settings`），而 G3 已有 `user-settings-arg` 提示＋`bat-hooks` plugin；要注入就得把 plugin 打進安裝檔（違反本單「plugin 不進安裝檔」），而且注入的 plugin 回報會標成 `plugin`、與使用者自己裝的同名 plugin 衝突，`hooks:` 行的判讀也會變複雜。若日後要做，先以真實 session 驗證同名衝突（併入待實機 T-10）。

### 已知限制

- plugin 需要 `node` 在 PATH 上（hooks.json 的指令無法同時在 bash 與 PowerShell 用 `${BAT_HELPER_NODE:-node}`）；裝了 plugin 的主機沒有系統 node 時（遠端主機常見；在 BAT 以外的終端也一樣），指令跑不起來，claude 會把它當成 hook 錯誤（非阻擋），這是 launcher 管不到的唯一情況（T0902 §7.1 G10、待實機 T-12）；README 安裝步驟已寫明需要 `node`。
- `${CLAUDE_PLUGIN_ROOT}` 在 Windows 經 Git Bash 與經 PowerShell 的展開未實機（T-9）。
- 注入＋plugin 並存的實際去重、`--settings` 與使用者 / plugin hooks 的合併未實機（T-10）；專案層 `disableAllHooks` → `no-report` 未實機（T-11）。
- BAT 重開後（記憶體清空）claude-cli 分頁在下一個 hook 回報前顯示 `no-report`；renderer 重新載入後要等下一次狀態改變才有徽章（與 `tower-contract-store` 相同）。
- 比 W9 舊的 BAT 搭配 plugin：舊 `bat-hook.mjs` 不認得 `--hook-list`，回報當成 injected，功能照舊、只是不會區分來源。

### 驗證

- 單元：`electron/__tests__/claude-hooks-status.test.ts`（判定表、`hooks:` 行、紀錄、啟動代號、PtyManager 狀態 / 等待 / 推送、`setTerminalRole` 2 s 等待與舊呼叫不變）、`electron/__tests__/bat-terminal-set-role.test.ts`「hooks line (T0910)」（真 helper：每種狀態的行、舊呼叫沒有這行、3.5 s 回答仍等得到）、`scripts/__tests__/bat-hooks-plugin.test.mjs`（manifest、hooks.json ↔ `BAT_CLAUDE_HOOKS`、launcher 規則、不進安裝檔、`reportOrigin`）、`electron/__tests__/terminal-blocked-state.test.ts`「T0910: the bat-hooks plugin launcher …」（真 launcher → 真 `bat-hook.mjs` → RemoteServer）、`scripts/__tests__/bat-mcp.test.mjs`「T0910: hooksStatus」、`src/components/__tests__/hooks-status-hint.test.tsx`、`src/components/__tests__/inbox-panel.test.tsx`「T0910 …」。
- headless：`electron/remote/__tests__/headless-set-role-e2e.test.ts`（真 headless：`--bat-contract` 呼叫多 `hooks: none (not-launched-by-bat)`）、`headless-terminal-query-e2e.test.ts`（`scope: towers` 每列帶 `hooksStatus`）。
- 待實機：T0902 T-9（Windows Git Bash / PowerShell）、T-10（並存去重）、T-11（專案 `disableAllHooks`）、T-12（WSL 手打 claude＋plugin、沒有系統 node）。
