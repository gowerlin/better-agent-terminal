---
schema_version: 1
schema_kind: workorder
id: T0968
title: "讀 CT 6.4.0 的 `menu_open`：待辦分頁的回答只在該題確實在開著的選單裡時才代按 Esc；其他情況保留到選單關閉；選單紀錄開著時 Worker 通知也保留"
type: feature
status: DONE
repo: better-agent-terminal
priority: P1
sizing: M
created_at: "2026-11-28T13:14:05+0800"
started_at: "2026-11-28T13:15:16+0800"
updated_at: "2026-11-28T13:32:53+0800"
completed_at: "2026-11-28T13:32:53+0800"
session_ids:
  - "17abf7e3-8682-479f-aa67-8dc17a6dec31"
target_version: "下一個預覽版（`0.8.1-pre.4`，與 BUG-235 / 236、T0966 一起發，D491）"
depends_on: []
related:
  - "BUG-236 / T0965（`main` `8a1c1318`，選單紀錄＋Esc 流程）；T0966；HANDOVER `_handover-2026-11-28-inbox-menu-handoff.md`（ACKNOWLEDGED）；CT PLAN-022 / T0582（CT 6.4.0-pre.1，CT D927）；BAT D484 / D487 / D491 / D492"
affects_files:
  - _ct-workorders/T0968-inbox-menu-open-reader.md
  - src/lib/tower-inbox.ts
  - src/lib/ct-tower-overview.ts
  - src/lib/inbox-model.ts
  - src/lib/inbox-answer.ts
  - src/lib/__tests__/
  - src/types/
  - src/components/inbox/
  - src/components/InboxPanel.tsx
  - src/components/__tests__/
  - src/locales/
  - electron/notify-hold.ts
  - electron/terminal-blocked-state.ts
  - electron/pty-manager.ts
  - electron/handlers/
  - electron/preload.ts
  - electron/__tests__/
  - docs/agent-guide/tower-inbox.md
  - docs/agent-guide/notify-hold.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0968` 寫檔（base = 派工當下的 `main`，已含 T0964 / T0965 / T0966）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 CT 規範（唯讀參考，不改、不複製進產品，只讀）：基準 `D:/ForgejoGit/@Gower_Labs/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v6.4.0-pre.1/skills/control-tower/`（行號以 CT commit `7fee085` 為準）。`references/memory-protocol.md`：`menu_open` 摘要欄位表 :33；頂層欄位定義（沒有這個鍵代表什麼）:222；`ids` / `opened_at`（含範例）:227–:237；寫入時機、不寫的情況、清除、BAT 怎麼用 :314–:325；每次寫入都不寫、重寫摘要不保留 :98–:100、:104–:105；開選單前的同一次寫入 :379–:380；`inbox_features` 的 `menu` :32、:59、:220；第 7 點（被關掉的選單不重開；新待決只放新題；說「重問 U-n」才重開）:405–:418；第 6 點例子 :399–:404；〈競態〉:435–:441；完整範例 :464 起。CT 自檢 `scripts/check-frontmatter.py` :52–:53、:58–:59、`check_menu_open` :859 起。CT 補定三點：① 同一則回覆又開新選單時「選單已關閉，仍待決」的提醒寫在新選單第一題開頭；② `ids` 只列開進選單的題（同一則回覆改用文字範本的題不列）；③ 下一個選單開之前的那次寫入只寫新選單的 `ids`。"
  - "🔴 解析（renderer，唯一實作放在既有的 tower-state 解析處：`parseTowerStateInbox`（`src/lib/ct-tower-overview.ts`）/ `src/lib/tower-inbox.ts`）：頂層 `menu_open: { ids: [...], opened_at: \"<ISO +08:00>\" }`，`ids` 支援 flow 與區塊清單兩種寫法；只有 `inbox_features` 含 `menu` 時才採用，否則當作不存在（CT 的 `v2-menu-open-ignored` 語意）；格式錯 → 當作不存在並計數、不擋其他清單。測試 fixture：把 CT 的四個範例 `scripts/tests/fixtures/frontmatter/good/tower-state-v640.md`、`-flow.md`、`-block-list.md`、`-menu-ignored.md` 複製進 BAT 的測試 fixture 目錄（`src/types/__tests__/fixtures/` 或同類位置，🔴 產品測試不得讀 `_ct-workorders/` 或 repo 外的檔），檔頭註明來源與 CT commit。"
  - "🔴 Esc 判斷（主行程 `NotifyHoldController`，接 T0965）：renderer 送回答時把該塔台目前生效的 `menu_open`（或「CT 有 `menu` 但沒有 `menu_open`」）以**選用、相加**的參數帶給 `tower-inbox:answer`（形狀由你定，舊 renderer 不帶 = T0965 行為；`checkInboxAnswer` 規則不變；channel 仍不進 `HELPER_CHANNEL_ROLES`）。主行程：有 `menu` 資訊時，① 回答的 U-n 在 `ids` 且 `opened_at` 與選單紀錄開始時間相符（容差寫成常數並說明理由：CT 先寫檔再開選單，hook 晚幾秒到；過舊的 `opened_at` 視為殘留）→ 走 T0965 的 Esc 流程；② 選單紀錄開著但 U-n 不在 `ids`（含 A-n、或 CT 有 `menu` 卻沒寫 `menu_open`）→ 不送 Esc、保留到選單關閉；沒有 `menu` 資訊 → T0965 行為逐字不變。"
  - "🔴 Worker 通知（T0965 後續建議，同單處理）：選單紀錄開著（`question` 已被滑鼠等清掉但選單仍在）時，契約 2 塔台的 Worker 通知（helper `pty:write` / `terminal:keypress`）也保留、不送 Esc，選單紀錄關閉後照 T0788 規則送出（不論 CT 版本）。評估選單紀錄殘留導致通知卡住的情境（紀錄由 done / stop / submit / post-tool-batch / Esc / Ctrl+C / PTY 結束 / recovery 關閉），回報區寫結論；若認為風險高需要逾時或其他取捨 → 問塔台，不要自行加逾時。"
  - "🔴 待辦分頁提示：該題在生效的 `menu_open.ids` 裡、且塔台分頁目前是 `question` 或選單紀錄開著時，在該題旁顯示一行「塔台正以選單詢問此題：在這裡回答會先關掉選單」（三語系）；不在選單裡的題不顯示。不改按鈕與送出路徑。"
  - "🔴 不得改變：`permission` / `elicitation` / codex `input` 照舊保留；非契約 2 或非塔台分頁行為不變；T0964 的 draft 清除、T0965 的 Esc 流程常數與日誌、T0966 的計數規則不變（只多條件）；不改 CT 任何檔案；`--set-role` 輸出與契約最低版號不變。"
  - "🔴 不回歸（R-G003）：T0788 / BUG-196、T0904、T0908、T0926、T0940、T0942、T0964、T0965、T0966 的通過案例逐一核對，回報區列〈相關通過案例〉；既有測試不改斷言（只能新增）。新增測試：四個 CT fixture 的解析；有 / 沒有 `menu`；在 / 不在 `ids`；A-n；`opened_at` 過舊；舊 renderer 不帶參數 = T0965；選單紀錄開著時 Worker 通知保留、關閉後送出；提示行三語系。參考 CT T0582〈給塔台〉第 3 點 H-1～H-14（`D:/ForgejoGit/@Gower_Labs/BMad-Guide/_ct-workorders/T0582-ct-guide-v640-pre1-menu-open.md`，唯讀）挑可單元測試的情境對應，回報區列對照表。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。不碰使用者正在用的安裝版 BAT。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`（新節，含 CT 版本對照：`menu` 需 CT ≥ 6.4.0-pre.1）、`notify-hold.md`；CLAUDE.md 只在「塔台等使用者回答時保留 Worker 通知」或「待辦分頁的契約 v2 清單與回答」節補一句（標題不改，T0595）。README 的 BAT ↔ CT 版本對照由塔台發版時處理，本單不改。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台；需要改 CT 規範或契約 → 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0968 — 讀 CT 6.4.0 的 `menu_open`（BUG-236 後續）

## 背景

T0965 讓 BAT 在塔台開著選單時，替待辦分頁的回答代按 Esc 再送文字，但 BAT 只知道「有選單」，不知道選單裡是哪幾題。CT 塔台已同意（HANDOVER ACKNOWLEDGED、CT 6.4.0-pre.1）在開選單前把選單包含的 U-n 寫成 `menu_open`，並以 `inbox_features: menu` 宣告。使用者裁示（D491）等這張做完與 BUG-235 / 236、T0966 一起發 `0.8.1-pre.4`。

## 範圍

- 解析 `menu_open`（只在 `inbox_features` 含 `menu` 時採用）。
- Esc 只對「在選單裡、時間對得上」的 U-n；其他保留到選單關閉；舊 CT / 舊 renderer 行為 = T0965。
- 選單紀錄開著時 Worker 通知也保留。
- 待辦分頁提示行；測試、文件。

## 不做

- 不改 CT；不改 `checkInboxAnswer` 與既有回傳形狀（參數只相加）；不發版；不改 README。

## 驗收

- [x] 四個 CT fixture 解析正確（含 `menu-ignored`）
- [x] Esc 條件與保留條件（測試，含舊 renderer / 舊 CT 等於 T0965）
- [x] 選單紀錄開著時 Worker 通知保留、關閉後送出（測試）＋殘留風險評估
- [x] 待辦分頁提示行（三語系）
- [x] H-1～H-14 對照表；〈相關通過案例〉判定
- [x] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [x] 〈待實機〉步驟；docs 更新

---

## 回報區

### 待塔台決策

#### Q-1：`electron/preload.ts` 不在 `affects_files`，但 `tower-inbox:answer` 的相加參數要經它才送得出去；可以改嗎？
- **提問時間**：2026-11-28T13:18:20+0800
- **說明**：preload 的 `towerInbox.answer(terminalId, text)` 把參數組成 `{ terminalId, text }` 才 invoke，不改它 renderer 帶不出 `menu` 資訊（工單要求「以選用、相加的參數帶給 `tower-inbox:answer`」）。
- **選項**：A 把 `electron/preload.ts` 加進範圍，只改一行：`answer(terminalId, text, menu?)`，`menu` 有值才放進 invoke 的物件，沒有值時送出的物件跟現在一樣；B 不改 preload，本單只做主行程、解析、測試（renderer 帶不出參數 = 實際行為還是 T0965）；其他
- **建議**：A。理由：工單要的行為一定要經過 preload；改動純相加，舊主行程、舊 bat-server 收到多的鍵會忽略。
- **影響**：選 B 的話，驗收項「Esc 條件」只在主行程測試裡成立，實機看不到。
- **是否阻擋後續步驟**：只擋 preload 這一行；解析、主行程、測試可以先做。

#### Q-2：提示行的「選單紀錄開著」條件，renderer 拿不到；要怎麼做？
- **提問時間**：2026-11-28T13:18:20+0800
- **說明**：renderer 從 terminal attention 看得到塔台分頁是不是 `blockedReason: question`，但「`question` 已被滑鼠或輸入清掉、選單紀錄還開著」只在主行程的 tracker 裡，沒有任何事件送到 renderer。要送的話得改 `electron/terminal-attention.ts`、`src/lib/terminal-attention.ts`、`src/stores/terminal-attention-store.ts`（都不在 `affects_files`），而且選單紀錄關閉時 tracker 現在不會觸發 attention 推送，要加觸發點。
- **選項**：A 提示行只看 `question`（attention 已有的欄位，不加 channel、不動 attention），「只剩選單紀錄」的情況不顯示提示，寫進 docs 的已知限制；B 把 attention 事件相加一個 `questionMenuOpen` 欄位，並在選單紀錄開關時推送（範圍加上述 3 個檔，attention 的推送時機會變多）；其他
- **建議**：A。理由：「只剩選單紀錄」通常是使用者剛點過或按過選單，他看得到選單；B 要動 attention 推送的時機，所有看 attention 的地方（縮圖 ⚠️、工作區列表、淡化）都要再核對，風險比提示行的價值大。實際送出路徑不受影響（主行程照樣看選單紀錄決定要不要按 Esc）。
- **影響**：只影響提示行什麼時候出現，不影響 Esc、保留與送出。
- **是否阻擋後續步驟**：只擋提示行；其他可以先做。

#### Q-3：T0965 的既有測試斷言「只剩選單紀錄時 Worker 通知直接送出」，與本單要的「選單紀錄開著時 Worker 通知保留」相反；可以改這一條斷言嗎？
- **提問時間**：2026-11-28T13:21:30+0800
- **說明**：`electron/__tests__/notify-hold-question-menu.test.ts:228` `a Worker notification with only the menu record (no \`question\`): passes through as before, no Esc` 斷言 `interceptWrite` 回 `{ ok: true }` 且直接寫進 PTY。工單 memory_overrides 要求這種情況保留，同時也寫「既有測試不改斷言（只能新增）」，兩條互相衝突。
- **選項**：A 只改這一條：改成「保留（`{ ok: true, held: true }`）、不送 Esc，選單紀錄關閉後送出」，測試名稱註明 T0968 改變行為；其他斷言一律不動；B 不改，Worker 通知照 T0965 直接送出（本單不做 Worker 通知那一項）；其他
- **建議**：A。理由：這條斷言記錄的正是工單要改掉的舊行為（T0965 回報的後續建議），不改就做不了；其他 T0965 斷言（`question` 時保留、非契約 2 不變等）都不受影響。
- **影響**：選 B 的話驗收項「選單紀錄開著時 Worker 通知保留」不做。
- **是否阻擋後續步驟**：只擋 Worker 通知那一項。

### 完成狀態

- **狀態**：DONE（驗收項全部完成；〈待實機〉留給塔台／使用者）
- **session_id**：17abf7e3-8682-479f-aa67-8dc17a6dec31
- **branch**：`ct/T0968`
- **base_sha**：`dada34d924421fee7c5dc485b50c3a2cb82e3386`
- **validated_sha**：`4dea180c623e0262b09b269690ae269b232a1088`
- **head_sha**：`4dea180c623e0262b09b269690ae269b232a1088`（與 validated_sha 相同）
- **產品 commit**：`a28078ca`（功能＋測試＋文件）、`4dea180c`（新測試的型別修正，`typecheck:electron` 抓到；只改測試裡一個參數的型別，改完才跑驗證）

### 落點檢查

- PASS。C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`。C-1：工單在 `$CT_HOME/_ct-workorders/`。C-3：`affects_files` 抽查的路徑都存在。C-2：工單沒有 `branch` 欄位。
- `CT_HOME` 已設定，`CT_WORKTREE_BRANCH` = `ct/T0968`，`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

### 做了什麼

1. **解析**（`src/lib/tower-inbox.ts`）：`hasInboxMenuFeature`、`parseMenuOpen`（`parseTowerInboxLists` 呼叫）。只在 `inbox_features` 有 `menu` 時讀 `menu_open`，結果放在 `TowerInboxLists.menuFeature` / `menuOpen`，格式錯就放 `menuOpenInvalid`（當作不存在，其他清單不受影響）。規則比照 CT `check_menu_open`：`ids` 1～4 筆、`"U-n"`、不重複、每筆都在 `awaiting_user`；`opened_at` 必須是日期時間（`+08:00` / `+0800` 都接受）。`INBOX_FEATURES` 不變（既有斷言 `toEqual(['recommended','dismiss','multi'])`），`menu` 另外判斷。沒有 `menu` 時 lists 物件不多任何鍵。
2. **送出**：`inboxMenuInfo(lists)` → `{ ids, openedAt }` / `null`（有 `menu`、沒有可用的 `menu_open`）/ `undefined`（沒有 `menu`）。`useInboxModel` → `AwaitingList` / `ActionList` → `sendInboxAnswer(target, text, menu?)` → preload `towerInbox.answer(terminalId, text, menu?)`（Q-1 A：只改這一行，`menu === undefined` 時 invoke 的物件逐字是 `{ terminalId, text }`）。`src/types/electron.d.ts` 同步相加。
3. **主行程**（`electron/notify-hold.ts`）：
   - `registerTowerInboxAnswerHandler` 以 `checkInboxMenuInfo` 檢查 `args.menu`。格式錯 → 忽略（= T0965），記 `[tower-inbox] answer menu ignored … (malformed)`；有值 → 記 `answer menu … menu_open=<ids>|none`（只記 id）。`checkInboxAnswer` 和回傳形狀不變，`HELPER_CHANNEL_ROLES` 沒動。
   - `HeldItem.menu` 存這筆回答帶來的資訊（同一行重送時換成較新的）。`considerMenuEsc` 在 T0965 的檢查後多一道 `menuEscDecision`：回答的 `U-n`（批次行只要有一個）在 `ids` 裡，而且 `opened_at` 落在 [紀錄開始 − 5 分鐘, 紀錄開始 + 5 s] → 走 T0965 的 Esc，常數與日誌都沒變。其他情況（`no-menu-open` / `not-in-menu`（含 `A-n`）/ `stale` / `not-this-menu` / `no-record`）不送 Esc，原因仍是 `question`、保留到選單關閉，每筆回答每個原因記一次 `menu esc skipped`。沒有 `menu` 資訊時一律 `esc`（= T0965）。
   - 容差常數 `NOTIFY_HOLD_MENU_OPENED_BEFORE_MS` = 5 分鐘、`NOTIFY_HOLD_MENU_OPENED_AFTER_MS` = 5 s，理由寫在常數註解與 docs。CT 先取時間、寫檔，模型再寫 AskUserQuestion，hook 才到 BAT，通常幾秒，長題目或非 yolo 的寫檔權限詢問可能到一分鐘以上；之後的容差只需涵蓋秒數截斷，因為比對的兩個時間都來自同一台主機。容差設得太嚴，只是回答要等使用者自己關掉選單；設得太寬，會關掉不是這題的選單，所以寧可嚴。
   - **Worker 通知**：契約 2 塔台在 `holdReason` / `headHold` 拿掉「只限回答」的條件，只剩選單紀錄時 helper 的 `pty:write` / `terminal:keypress` 也保留，原因是 `question`。Worker 通知不會觸發 Esc，因為 `considerMenuEsc` 只處理回答。「立即送出」可以放行。非契約 2 塔台的行為不變，也與 CT 版本無關。
4. **選單紀錄的開始時間**：`TerminalBlockedTracker` 的 `questionMenus` 多存 `openedAt`（tracker 的 `now`，正式環境是 `Date.now`），在建立紀錄時記下，每個 `ask-user-question` hook（新的 AskUserQuestion 呼叫）再記一次；`permission-request` 不更新。`questionMenuOpenedAt()` 經 `PtyManager.getQuestionMenuOpenedAt()` 提供給 controller；`NotifyHoldPtyManager` 介面上是選用方法，沒有這個方法就是 `no-record`。`blocked` 與所有查詢回傳都沒變。
5. **提示行**（Q-2 A）：`inboxMenuHintIds`（`src/lib/inbox-model.ts`）在任一塔台分頁的 attention 是 `blockedReason: question` 時，回傳 `menu_open.ids`。`AwaitingRow` 在摘要下方顯示一行 `inbox.answer.menuOpenHint`，三語系都有，按鈕與送出路徑沒動。只剩選單紀錄時不顯示，已寫進 docs 的已知限制。
6. **fixture**：把 CT commit `7fee085` 的四個範例以 `git show` 逐位元組複製到 `src/types/__tests__/fixtures/ct-tower-state-v640/`，已用 `cmp` 確認與 CT 原檔相同。檔頭不能加註解，否則 `---` 之前多一行就不是 frontmatter，所以來源與 commit 寫在同目錄的 `README.md`。
7. **文件**：`docs/agent-guide/tower-inbox.md` 新增「選單交接：讀 CT 6.4.0 的 `menu_open`（T0968，D492）」一節，含 CT 版本對照（`menu` 需 CT ≥ 6.4.0-pre.1）、原因表、容差理由、已知限制；T0965 節中「Worker 通知只剩選單紀錄時直接送」那句用刪除線劃掉並加註 T0968。`notify-hold.md` 補一段。CLAUDE.md 只在「塔台等使用者回答時保留 Worker 通知」節補一句，標題沒改；字數 99,786，未超過 100k。README 沒改。

### 修改檔案

`electron/notify-hold.ts`、`electron/terminal-blocked-state.ts`、`electron/pty-manager.ts`、`electron/preload.ts`（Q-1）、`src/lib/tower-inbox.ts`、`src/lib/inbox-model.ts`、`src/lib/inbox-answer.ts`、`src/components/inbox/InboxLists.tsx`、`src/components/inbox/useInboxModel.ts`、`src/components/InboxPanel.tsx`、`src/types/electron.d.ts`、`src/locales/{en,zh-TW,zh-CN}.json`、`docs/agent-guide/tower-inbox.md`、`docs/agent-guide/notify-hold.md`、`CLAUDE.md`；測試：`electron/__tests__/notify-hold-question-menu.test.ts`（Q-3 只改一條）、新增 `electron/__tests__/notify-hold-menu-open-t0968.test.ts`、`src/lib/__tests__/tower-inbox-menu-open-t0968.test.ts`、`src/components/__tests__/inbox-menu-open-t0968.test.tsx`、fixture 目錄 `src/types/__tests__/fixtures/ct-tower-state-v640/`（4 個範例＋README）。

### 驗證

| 項目 | 結果 |
|---|---|
| worktree `npm ci` | exit 0（結尾的 install-scripts 警告是預期：`electron-winstaller` 等不在 `allowScripts`） |
| `npm run test:unit`（head `4dea180c` 第一次完整執行） | **PASS**：Test Files 529 passed / 3 skipped（532）；Tests 9567 passed / 42 skipped（9609）；59.7 s。輸出有兩行 `Error: AttachConsole failed`（stderr，exit 0，與本單無關的 Windows 主控台訊息） |
| `npx vite build` | exit 0 |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0（第一次在 `a28078ca` 抓到新測試的 readonly 型別錯誤，已修正於 `4dea180c`；當時跑到一半的 unit 已停掉，全部驗證在 `4dea180c` 重跑） |
| 新測試 | 解析 26 項（四個 CT fixture、格式錯 11 種、host 檢查、提示 ids）；主行程 26 項；元件 10 項 |
| 舊 host／舊 bat-server 收到多的 `menu` 鍵 | 已確認會被忽略：base `dada34d9` 的 `registerTowerInboxAnswerHandler` 只讀 `args.terminalId` / `args.text`（`electron/notify-hold.ts:1191-1199`），proxied 轉送時 `menu` 是一般 JSON 值。新視窗＋舊 host = T0965 行為。preload 的物件形狀以 source guard 測試守住（`notify-hold-menu-open-t0968.test.ts` › preload） |
| 未碰安裝版 BAT | 是（只在 worktree 跑測試與建置） |

### 相關通過案例（R-G003，不回歸）

| 案例 | 判定 |
|---|---|
| T0788 / BUG-196（prompt reason 保留 Worker 通知） | 不變：`holdReason` 仍先看 prompt reason；非契約 2 塔台沒有走到新條件。既有 `notify-hold*.test.ts` 斷言未改，全綠 |
| T0904（draft / reading / atomic） | 不變：選單紀錄的檢查原本就排在 draft 之前，Worker 通知只是多一個保留條件，atomic 的順序沒動 |
| T0908（回答 IPC） | 參數只相加；`checkInboxAnswer`、回傳形狀、`HELPER_CHANNEL_ROLES` 都不變；沒有 `menu` 時送出的物件逐字相同（元件測試 V630 斷言只有兩個參數） |
| T0926（晚到的 hook） | 不變：`noteQuestionMenuOpen` 只多記 `openedAt`，`lateHookOfAnsweredQuestion` 沒動 |
| T0940（不進輸入框的按鍵） | 不變：`isPromptShown` 沒改 |
| T0942（已送出標記） | 不變：`sendInboxAnswer` 的回傳形狀相同 |
| T0964（draft 清除） | 不變 |
| T0965 / BUG-236 | 沒有 `menu` 資訊時逐字是 T0965，Esc 流程的常數與日誌不變。**唯一改掉的斷言**（Q-3 A，D492）：`notify-hold-question-menu.test.ts:228`，原本是「只剩選單紀錄時 Worker 通知直接送（`{ ok: true }`，立即寫進 PTY）」，改成「保留（`{ ok: true, held: true }`）、10 s 內不寫、不送 Esc，紀錄關閉後安靜 1 s 送出」，測試名稱註明 T0968 依塔台裁示。其他 T0965 斷言沒動 |
| T0966（等待原因、計數） | 計數規則不變；附帶的行為變化：契約 2 塔台只剩選單紀錄時，Worker 通知現在會進待送並計數，原因顯示「等你回答對話框」（`question`），這是本單要的行為 |

### H-1～H-14 對照（CT T0582〈給塔台〉3）

| # | BAT 端可單元測試的部分 | 測試 |
|---|---|---|
| H-1 | 有 `menu`、沒有 `menu_open` → `null`（不代按 Esc） | `tower-inbox-menu-open-t0968` › `menu` without menu_open |
| H-2 | 單題 `menu_open` 解析 | fixture `tower-state-v640-flow` |
| H-3 | 待辦分頁答選單裡的題 → Esc → 文字 | `notify-hold-menu-open-t0968` › U-n in menu_open, the same menu (H-3) |
| H-4 | 選單關閉後再答 → 沒有紀錄 → 直接送、不送 Esc | `not-in-menu` 等案例的後半段（closeMenu 後送出、`escs() = 0`） |
| H-5 | 新選單只放新題；答舊題 → `not-in-menu` 保留 | 同上 `a U-n not in the menu` |
| H-6 | 重問：新的 `ask-user-question` 更新紀錄開始時間 → 對得上 | `… began a new menu … (H-6)`、tracker 的 start time 測試 |
| H-7 | 不含 U-n 的選單（沒有 `menu_open`）→ 不代按 Esc、保留 | `no-menu-open` 案例 |
| H-8 | 殘留的 `menu_open` → `stale`、保留 | `stale` 案例 |
| H-9 | 使用者自己按 Esc → 紀錄關閉 | T0965 既有測試 `closed by the user's lone Esc / Ctrl+C` |
| H-10 | CT 端處理（重複回答） | 不適用（BAT 只負責送出） |
| H-11 | `permission` / `elicitation` / `input` 照舊保留、不送 Esc | `notify-hold-menu-open-t0968` › it.each 三種 reason |
| H-12 | 舊 BAT 搭 6.4：BAT 端等於「沒帶 `menu`」 | handler `no menu key`、`no menu information … exactly T0965` |
| H-13 | 新 BAT 搭 CT 6.3.x：不理會 `menu_open` | fixture `menu-ignored`、元件 `CT 6.3.x … two arguments` |
| H-14 | CT 不寫 `menu_open` 的情況 → 同 H-7 | `no-menu-open` 案例 |

### 選單紀錄殘留導致 Worker 通知卡住的評估

- 紀錄的關閉時機：AskUserQuestion 的 PostToolUse（`ask-user-question-done`）、主執行緒的 `post-tool-batch`、`stop`、`user-prompt-submit`、使用者單獨按 Esc / Ctrl+C、BAT 的 Esc、PTY 結束、Terminal Server recovery。
- 使用者在選單作答後，PostToolUse 會關閉紀錄；這個 hook 遺失時（hook 有 1.8 s 時限），同一回合結束的 `stop` 也會關閉；兩者都遺失的話，下一個 `user-prompt-submit` 關閉。所以最壞情況是 Worker 通知保留到塔台這一回合結束。T0788 在 `question` 時本來就會保留，差別只在中間這段時間。
- 保留期間縮圖「📨 待送」會列出這筆，原因顯示「等你回答對話框」，使用者可以按「立即送出」（只剩選單紀錄時放行）。
- **結論：風險低，不加逾時**（照工單指示，沒有自行加逾時）。

### 〈待實機〉（建議塔台或使用者用 CT 6.4.0-pre.1 驗收）

1. 契約 2 的 Claude CLI 塔台開兩題選單（`menu_open.ids` 有兩題）：待辦分頁兩題旁都出現提示行；回答其中一題 → BAT 代按 Esc → 塔台收到 `U-n：…` 文字；日誌有 `[tower-inbox] answer menu … menu_open=U-a,U-b` 和 `[notify-hold] menu esc … (question)`。
2. 同一個選單開著時，回答一筆不在選單裡的 U-n 或一筆 A-n → 不按 Esc，留在待送（「等你回答對話框」）；日誌有 `menu esc skipped … (not-in-menu; …)`；使用者在選單作答後，這筆回答隔 1 s 送出。
3. 需求對齊選單（不含 U-n、沒有 `menu_open`）開著時從待辦分頁回答 → `no-menu-open`，保留到選單關閉。
4. 選單開著，先在分頁內點一下讓 `question` 被清掉，再讓 Worker 送 `bat-notify --submit`：通知進待送、不按 Esc；選單關閉後通知送達。
5. 用 CT 6.3.x 的狀態檔重做 1：行為與 T0965 相同（任何回答都代按 Esc），日誌沒有 `answer menu`。

### 遭遇問題

- `electron/preload.ts` 不在 `affects_files`（Q-1）、提示行拿不到選單紀錄的狀態（Q-2）、既有斷言和工單要求衝突（Q-3）：三題都經 BAT 通道問塔台，塔台都選 A，並已把 preload 補進 `affects_files`。
- 第一次送 `--ask` 時 stdin 用了純文字，helper 回 `ask: INVALID_INPUT`（exit 1，題目沒登記）；照 yolo-mode.md 改成 JSON 後送出成功，沒有重複登記。
- 新測試的 `it.each([...] as const)` 讓參數變成 readonly，`typecheck:electron` 報錯（vitest 只轉譯，所以測試本身是綠的）；已修正。

### 互動紀錄

- [13:18] Q-1: preload 是否可改 → A（塔台）: 允許，只改 `towerInbox.answer` 一行；已補 affects_files；型別宣告在 `src/types/` 一併相加；確認舊 bat-server 會忽略多的鍵 → Action: 改 preload＋`electron.d.ts`，舊 host 的確認寫在〈驗證〉
- [13:18] Q-2: 提示行的選單紀錄條件 → A（塔台）: 只看 attention 的 `question`，只剩選單紀錄時不顯示，寫進已知限制 → Action: `inboxMenuHintIds` 只看 `question`，docs 已寫
- [13:21] Q-3: T0965 斷言 :228 衝突 → A（塔台）: 只改這一條，名稱註明 T0968 依 D492，〈相關通過案例〉列前後差異；只限契約 2 → Action: 已改，前後差異見上表

### 後續建議

- CT 6.4.0-pre.1 發佈時，README 的 BAT ↔ CT 版本對照補上「`menu` 需 BAT 本版、CT ≥ 6.4.0-pre.1」（工單排除，由塔台處理）。
- 若之後也想在「只剩選單紀錄」時顯示提示行，需要在 attention 加欄位並增加推送時機（Q-2 的 B 案），另開工單。

## 塔台收單補記

- 2026-11-28 13:33 (UTC+8) 收單：DONE 確認（`validated_sha` = `head` = `4dea180c`；`--worktree-status` 五條全成立：`main` 自 base 只多 `_ct-workorders/**`、`outOfScopeFiles` 空（含 Q-1 補的 preload）、`conflicts` 空、`dirty` 空）。`--close-worker --delay-ms 10000 --worktree keep` exit 0。
- 模式 ①：`ct-merge/T0968` = `8b3e9ec9`（parent1 `1372e23d`、parent2 `4dea180c`，產品樹 = head）。斷點 E → U-63；發 `0.8.1-pre.4` → U-64（D493）。README 版本對照於發版時處理。
- 2026-11-28 13:35 (UTC+8) U-63：A → 整合分支再合併 `main` 後 ff：`main` = `b2edf438`，產品樹 = `4dea180c`；整合 worktree detach；worktree 移除；分支 `ct/T0968`、`ct-merge/T0968` 保留。U-64：A → `v0.8.1-pre.4` 發佈（D494）。
