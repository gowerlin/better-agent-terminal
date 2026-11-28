---
schema_version: 1
schema_kind: workorder
id: T0968
title: "讀 CT 6.4.0 的 `menu_open`：待辦分頁的回答只在該題確實在開著的選單裡時才代按 Esc；其他情況保留到選單關閉；選單紀錄開著時 Worker 通知也保留"
type: feature
status: PENDING
repo: better-agent-terminal
priority: P1
sizing: M
created_at: "2026-11-28T13:14:05+0800"
updated_at: "2026-11-28T13:14:05+0800"
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

- [ ] 四個 CT fixture 解析正確（含 `menu-ignored`）
- [ ] Esc 條件與保留條件（測試，含舊 renderer / 舊 CT 等於 T0965）
- [ ] 選單紀錄開著時 Worker 通知保留、關閉後送出（測試）＋殘留風險評估
- [ ] 待辦分頁提示行（三語系）
- [ ] H-1～H-14 對照表；〈相關通過案例〉判定
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 〈待實機〉步驟；docs 更新

---

## 回報區

（Worker 填寫）
