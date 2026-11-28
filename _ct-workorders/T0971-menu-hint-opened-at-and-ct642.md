---
schema_version: 1
schema_kind: workorder
id: T0971
title: "BUG-237：選單提示行改成與代按 Esc 的判斷一致（含 `opened_at`）；CT 6.4.0-pre.2 配合：`menu_open` 鍵位置不影響解析（B-1）、分次寫入時 ids 不在 awaiting_user 的安全退路寫進文件（B-2）"
type: bugfix
status: DONE
repo: better-agent-terminal
priority: P2
sizing: M
created_at: "2026-11-28T15:22:07+0800"
updated_at: "2026-11-28T15:33:12+0800"
started_at: "2026-11-28T15:23:22+0800"
completed_at: "2026-11-28T15:33:12+0800"
session_ids:
  - "c23fc5bc-4b8b-4ede-9195-689784e31093"
target_version: "下一個預覽版（`0.8.1-pre.5`，發版前與使用者確認）"
depends_on: []
related:
  - "BUG-237（T0969 H-7）；T0968（`menu_open` 讀取、`menuEscDecision`、Q-2 提示行只看 `question`）；CT T0584 判定（CT D932）與 CT T0585（6.4.0-pre.2：R1 `menu_open` 移到 `awaiting_user` 正後方）；D496 / D497 / D499"
affects_files:
  - _ct-workorders/T0971-menu-hint-opened-at-and-ct642.md
  - src/lib/tower-inbox.ts
  - src/lib/inbox-model.ts
  - src/lib/inbox-answer.ts
  - src/lib/__tests__/
  - src/components/inbox/
  - src/components/InboxPanel.tsx
  - src/components/__tests__/
  - src/types/
  - src/locales/
  - electron/notify-hold.ts
  - electron/terminal-blocked-state.ts
  - electron/pty-manager.ts
  - electron/handlers/
  - electron/preload.ts
  - electron/main.ts
  - electron/remote/headless-entry.ts
  - electron/remote/protocol.ts
  - electron/remote/path-aware-channels.ts
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
  - "🔴 分支：只在 `ct/T0971` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 BUG-237（現象見 `_ct-workorders/BUG-237-inbox-menu-hint-ignores-opened-at.md`）：待辦分頁「塔台正以選單詢問此題：在這裡回答會先關掉選單」只看「塔台分頁 `question`＋該題在 `menu_open.ids`」，主行程的 `menuEscDecision` 另比對 `opened_at` 與選單紀錄開始時間；殘留的 `menu_open` 遇到別的選單時提示顯示、實際判 `stale` 不關。要做：提示行只在主行程判斷「這題會代按 Esc」時顯示（同一套條件，唯一實作仍是 `menuEscDecision`，不要在 renderer 另寫一份時間比對）。做法由你選，例：proxied 的唯讀查詢 channel（帶 `terminalId` 與 renderer 已有的 `menu` 資訊，主行程回每個 id 的判斷；🔴 不進 `HELPER_CHANNEL_ROLES`、handler 拒 `ctx.helper`）或其他相加方式。🔴 若需要改 attention 的推送時機或欄位（T0968 Q-2 的 B 案）→ 停下問塔台。舊 host 沒有新 channel → 照 T0968 現行顯示（只看 `question`）。順便評估 T0968 Q-2 的已知限制（只剩選單紀錄時不顯示）能否用同一個查詢一起解決；能就做、寫進回報，不能就維持。"
  - "🔴 B-1（CT 塔台要求，確認＋測試）：CT 6.4.0-pre.2 會把 `menu_open` 從 `updated_at` 後面移到 `awaiting_user` 正後方（`user_actions`、`reminders` 之前）。確認 `parseMenuOpen` / `parseTowerStateInbox`（`src/lib/tower-inbox.ts`、`src/lib/ct-tower-overview.ts`）不受頂層鍵位置影響；新增 fixture：`menu_open` 在 `awaiting_user` 與 `user_actions` 之間 → 解析成功（放在 `src/types/__tests__/fixtures/ct-tower-state-v640/` 旁或新目錄，README 註明是 BAT 自製、對應 CT 6.4.0-pre.2 R1；CT 的正式範例檔之後由塔台另行補入，本單不等）。若現在就解析失敗 → 修，並在回報區寫明。"
  - "🔴 B-2（CT 塔台要求，文件）：`docs/agent-guide/tower-inbox.md` 的選單交接一節補一句：CT 分幾次寫檔時，可能短暫出現 `menu_open.ids` 不在 `awaiting_user` 的狀態，BAT 當作沒有 `menu_open`（`menuOpenInvalid`）、不代按 Esc，這是預期的安全退路；🔴 保留這個行為，不得改成「部分 ids 有效就採用」（加一個測試鎖住：部分 ids 不在 `awaiting_user` → 整個 `menu_open` 無效）。同節補 CT 判定的相容說明：新 BAT 搭 CT 6.3.x 時，被關掉的題可能被塔台重開，每題會多一次代按 Esc（預期行為）。"
  - "🔴 不得改變：`menuEscDecision` 的條件與常數、T0965 Esc 流程、T0964 草稿清除、T0966 計數、Worker 通知保留規則、`tower-inbox:answer` 契約與回傳形狀；非契約 2 / 舊 CT 行為不變。"
  - "🔴 不回歸（R-G003）：T0964 / T0965 / T0966 / T0968 / T0969（H-2 / H-3 / H-5 / H-6 / H-7 / H-8b / H-9 / H-14b 的提示行行為）相關案例逐一核對，回報區列〈相關通過案例〉；既有測試不改斷言（只能新增；若既有斷言記錄的正是 BUG-237 的舊行為，先問塔台）。新增測試：殘留 `menu_open`＋別的選單（`stale`）→ 不顯示提示；同一選單且時間對得上 → 顯示；舊 host 沒有新 channel → T0968 行為。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。不碰使用者正在用的安裝版 BAT。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`（提示行規則更新、B-2）、需要時 `notify-hold.md`；CLAUDE.md 只在需要時補一句（標題不改，T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0971 — 選單提示行與代按 Esc 一致（BUG-237）＋ CT 6.4.0-pre.2 配合（B-1 / B-2）

## 背景

T0969 H-7 發現提示行與實際行為不一致（BUG-237，U-66：A 進 pre.5）。CT 判定單 T0584（CT D932）：CT 端 PASS 29 / FAIL 1（CT 條文缺漏，BAT 不用改）；分次寫入造成的中間狀態由 BAT 當作沒有 `menu_open`，是安全退路。CT 開 T0585（6.4.0-pre.2）把 `menu_open` 移到 `awaiting_user` 正後方，請 BAT 做 B-1（鍵位置不影響解析＋fixture）、B-2（文件＋鎖住整個無效的行為）。D497 決定 BUG-237 與 CT 配合項合成一張工單。

## 範圍

- 提示行改由主行程判斷（與 `menuEscDecision` 同一套）。
- B-1 解析與 fixture；B-2 文件與鎖定測試。

## 不做

- 不改 Esc / 保留 / 送出規則；不改 CT；不發版。

## 驗收

- [ ] 殘留 `menu_open`＋別的選單 → 不顯示提示；同一選單 → 顯示（測試）；舊 host → T0968 行為
- [ ] B-1：`menu_open` 在 `awaiting_user` 與 `user_actions` 之間 → 解析成功（fixture＋測試）
- [ ] B-2：文件＋「部分 ids 無效 → 整個無效」測試；CT 6.3.x 相容說明
- [ ] 〈相關通過案例〉判定
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 〈待實機〉步驟

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-28T15:33:12+0800
- **session_id**：c23fc5bc-4b8b-4ede-9195-689784e31093
- **branch**：`ct/T0971`
- **base_sha**：`94ef73bbf4cfa6f3f55c52d71d51f4fe6100c7c0`
- **validated_sha**：`e7804e1d3352820b3856688e5e935ced2d784a50`
- **head_sha**：`e7804e1d3352820b3856688e5e935ced2d784a50`（與 validated_sha 相同）

### 落點檢查

- **PASS**。C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`。C-1：工單在 `$CT_HOME/_ct-workorders/` 之下。C-3：`affects_files` 抽查的路徑都存在（informational）。C-2：工單沒有 `branch` 欄位。
- `CT_HOME` = 主 checkout；`CT_WORKTREE_BRANCH` = `ct/T0971`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 結果摘要

1. **BUG-237（提示行）**：提示行改由主行程判斷，條件跟代按 Esc 同一套。
   - 主行程：新增唯讀的 `NotifyHoldController.menuEscPreview(id, menu)`（`electron/notify-hold.ts`）。條件取 `considerMenuEsc` 的判斷、去掉等待（草稿、輸入 / 輸出安靜）：契約 2 塔台、分頁是 `question`（`via: 'question'`）或只剩選單紀錄（`via: 'menu'`）、而且 `menuEscDecision` 對該 `U-n` 回 `esc`。不改任何狀態、不寫日誌。
   - channel：新增唯讀、proxied 的 `tower-inbox:menu-hint { terminalId, menu }`（`registerTowerInboxMenuHintHandler`，Electron main 與 headless 都註冊；加進 `PROXIED_CHANNELS` 與 path-aware 分類）。🔴 不進 `HELPER_CHANNEL_ROLES`，handler 另拒 `ctx.helper`（`FORBIDDEN`）。`menu` 不是格式正確的物件 → `INVALID_ARGS`；沒有 controller → `unavailable`。preload `towerInbox.menuHint`、型別 `TowerInboxMenuHintResult`（相加）。
   - renderer：`useInboxMenuHint`（`src/components/inbox/useInboxMenuHint.ts`）在 `menu_open`、塔台分頁、attention、「📨 待送」任一變動時問 host；合併結果唯一實作 `inboxMenuHintIdsFromHost`（`src/lib/inbox-model.ts`）。host 回答前不顯示（殘留的 `menu_open` 不會閃一下）。舊 host（`No handler for channel`）或舊 preload → T0968 的 `inboxMenuHintIds`（只看 `question`）。待辦分頁標題的數字（`InboxTabBadge`）不問 host（`useInboxModel(..., { menuHint: false })`）。🔴 renderer 不比對 `opened_at`。
   - **T0968 Q-2 的已知限制：已一併解決。** 只剩選單紀錄（使用者點過或按過選單）時，只要主行程會代按 Esc 就顯示提示行。選單紀錄可能在 attention 沒變動的情況下關閉（例：使用者在塔台分頁按 Esc），所以只靠選單紀錄顯示的期間，renderer 每 `INBOX_MENU_HINT_REFRESH_MS` = 2 s 再問一次，提示行不再顯示就停。沒有改 attention 的推送時機或欄位（T0968 Q-2 的 B 案未採用，不用問塔台）。
2. **B-1**：`parseMenuOpen` / `parseTowerStateInbox` 先把 frontmatter 以 YAML 解析成物件才讀，頂層鍵的順序不影響結果，**現在就能正確解析，程式不用改**。新增 BAT 自製 fixture `src/types/__tests__/fixtures/ct-tower-state-v642/tower-state-v642-menu-after-awaiting.md`（`menu_open` 在 `awaiting_user` 與 `user_actions` 之間，後面還有 `reminders`）與 README（註明是 BAT 自製、對應 CT 6.4.0-pre.2 R1、不是 CT 範例）。測試另把 `menu_open` 放在 4 種位置，結果都相同。
3. **B-2**：`docs/agent-guide/tower-inbox.md` 的選單交接一節補了兩點：① CT 分次寫檔時可能短暫出現 `menu_open.ids` 不在 `awaiting_user` 的狀態，BAT 當作沒有 `menu_open`（`menuOpenInvalid` → `no-menu-open`），不代按 Esc，這是預期的安全退路，🔴 不得改成「部分 ids 有效就採用」；② 新 BAT 搭 CT 6.3.x 時，被關掉的題可能被塔台重開，每題會多一次代按 Esc，這是預期行為。新增測試鎖住：部分 ids 無效（3 種）→ 整個 `menu_open` 無效。
4. **文件**：`tower-inbox.md`（提示行規則改寫、查詢 / 何時再問 / 舊 host、B-1 / B-2、測試清單）、`notify-hold.md`（一行）、`CLAUDE.md`（「塔台等使用者回答時保留 Worker 通知」節多一句，標題不改；全檔 99,920 字元，≤ 100k）。

### 修改檔案

- `electron/notify-hold.ts`（`menuEscPreview`、`registerTowerInboxMenuHintHandler`、`TOWER_INBOX_MENU_HINT_CHANNEL`）
- `electron/preload.ts`、`src/types/electron.d.ts`、`src/types/notify-hold.ts`
- `electron/main.ts`、`electron/remote/headless-entry.ts`（註冊）、`electron/remote/protocol.ts`（`PROXIED_CHANNELS`）、`electron/remote/path-aware-channels.ts`（分類）
- `src/lib/inbox-model.ts`（`InboxMenuHintAnswer`、`inboxMenuHintIdsFromHost`）
- `src/components/inbox/useInboxMenuHint.ts`（新）、`src/components/inbox/useInboxModel.ts`、`src/components/InboxPanel.tsx`
- 測試（新）：`electron/__tests__/notify-hold-menu-hint-t0971.test.ts`（27）、`src/lib/__tests__/tower-inbox-menu-open-t0971.test.ts`（14）、`src/components/__tests__/inbox-menu-hint-t0971.test.tsx`（10）
- fixture（新）：`src/types/__tests__/fixtures/ct-tower-state-v642/`（README＋1 檔）
- 文件：`docs/agent-guide/tower-inbox.md`、`docs/agent-guide/notify-hold.md`、`CLAUDE.md`

### 驗證

| 項目 | 結果 |
|---|---|
| `npm ci`（worktree） | exit 0（結尾的 install-scripts 警告是預期，見 CLAUDE.md） |
| `npm run test:unit`（head `e7804e1d`，第一次完整執行） | **全綠**：Test Files 532 passed / 3 skipped（535）；Tests 9613 passed / 47 skipped（9660）；68.6 s |
| `npx vite build` | exit 0 |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| 既有測試斷言 | 沒有改（只新增測試檔） |

新增測試涵蓋的驗收項目：
- 殘留 `menu_open`＋別的選單（host 判 `stale`）→ 不顯示：host（`menuEscPreview` 回 `stale` / `not-this-menu`）與元件測試都有
- 同一選單、時間對得上 → 顯示：host 與元件都有
- 舊 host（`No handler for channel`）、舊 preload → T0968 行為：元件測試
- `menuEscPreview` 跟實際的 Esc 逐案一致（5 種情境：`enqueueAnswer` 之後有沒有送 Esc）
- channel 是 proxied、不是 helper channel、兩個 host 都註冊、preload 是相加的：host 測試

### 相關通過案例判定（R-G003）

`considerMenuEsc`、`menuEscDecision` 與常數、保留 / 送出 / Esc 流程、`tower-inbox:answer` 的呼叫與回傳形狀都沒改，Worker 通知的保留規則也沒改。改的只有提示行要不要顯示。

| 案例 | 原結果 | 改後判定 |
|---|---|---|
| T0969 H-2-1 單題 `menu_open` → 提示行 | PASS | 成立：`question`＋同一選單 → host 判 `esc` → 顯示（H-2-3 實際有代按 Esc，可見時間對得上） |
| H-2-3 / H-3-2 / H-5-3 Esc 與送出 | PASS | 成立（Esc 路徑未改） |
| H-3-1 兩題都有提示行 | PASS | 成立：`ids` 兩題都在 `menu_open`，host 兩題都回 `esc` |
| H-5-1 新選單只有 `U-6` 有提示行 | PASS | 成立：`U-5` 不在新的 `menu_open.ids`，不會問到 |
| H-6-1 重問 → `U-8` 有提示行 | PASS | 成立：新的選單紀錄，`opened_at` 對得上 → `esc` |
| H-9-1 使用者 Esc → 沒有提示行 | PASS | 成立：選單紀錄關閉，`question` 清掉引起 attention 變動 → 重問 → `via: null` |
| H-14b-1 只有 `U-11` 有提示行 | PASS | 成立 |
| H-11-1 Worker 通知保留、不送 Esc | PASS | 成立（保留路徑未改） |
| H-8b-1 人為殘留、不是 `question` → 沒有提示行 | PASS | 成立：殘留的 `opened_at` 早 1 小時 → 就算有選單紀錄也是 `stale` → 不顯示 |
| H-7-1 / H-8b-2 不送 Esc、選單關後才送 | PASS | 成立（Esc 判斷未改） |
| H-7 備註 1（BUG-237 本身） | 提示行顯示（錯） | **改成不顯示**（本單目的） |
| T0964 草稿清除、T0965 Esc 流程、T0966 計數 | PASS | 成立：沒改到這些程式；`notify-hold*.test.ts` 與 `inbox-*` 既有測試全部通過、斷言沒改 |
| T0968 元件測試「沒有 `question`（只剩紀錄）時不顯示」 | PASS | 成立：測試的 mock 沒有 `menuHint`（= 舊 preload），走 T0968 規則；新 host 在只剩紀錄時會顯示，這是本單解除的 Q-2 限制，不是回歸 |

### 待實機

用 BAT 安裝版（`0.8.1-pre.5` 發版後）＋ CT 6.4.0-pre.x 的契約 2 塔台：
1. 重現 T0969 H-7：讓 `_tower-state.md` 留著舊的 `menu_open`（`ids` 含 U-n、`opened_at` 早 1 小時），塔台開一個不含那題的選單 → 待辦分頁該題**沒有**提示行；從待辦分頁回答 → 保留、不送 Esc（`menu esc skipped … (stale…)`）。
2. 正常流程：塔台以選單問 U-n → 提示行出現 → 在塔台分頁按一次方向鍵（`question` 清掉、選單還開著）→ 提示行**仍在**（Q-2 已解除）→ 在塔台分頁按 Esc 關掉選單 → 約 2 s 內提示行消失。
3. 遠端視窗（bat-server 也是新版）同 1、2；遠端 bat-server 是舊版時，提示行照 T0968（只看 `question`），debug log 沒有錯誤。

### 偏離 / 遭遇問題

- **超出 `affects_files` 的檔案**：`electron/main.ts`、`electron/remote/headless-entry.ts`、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`。工單建議的做法是「proxied 的唯讀查詢 channel」，這些是讓 channel 在兩個 host 註冊並列為 proxied 一定要改的接線處（與 T0908 `tower-inbox:answer` 改的位置相同），每處只多一到兩行，所以判定屬範圍內、沒有問塔台。請塔台收單時確認。
- 一開始在 commit 前就跑了 `npm run test:unit`，發現後中途停掉，commit 之後在 head 重跑（上表的數字是 head 上第一次完整執行）。
- 其他沒有。

### 建議後續

- CT 發佈 6.4.0-pre.2 的正式範例檔後，照 `ct-tower-state-v640/` 的方式另開目錄複製進來（BAT 自製的 `ct-tower-state-v642/` 可留可刪，README 已註明）。

### 互動紀錄

- 無（yolo，沒有提問；過程中沒有塔台補充段落）。

### Commit

- 產品：`e7804e1d`（`ct/T0971`，worktree）
- 工單：主 checkout `--only` 本檔

## 塔台收單補記

- 2026-11-28 15:34 (UTC+8) 收單：DONE 確認（`validated_sha` = `head` = `e7804e1d`）。Worker 列的 4 個接線檔（`electron/main.ts`、`remote/headless-entry.ts`、`remote/protocol.ts`、`remote/path-aware-channels.ts`）塔台確認屬範圍內，已補進 frontmatter `affects_files`；`--worktree-status` 五條全成立 → 模式 ①：`ct-merge/T0971` = `4e07b9d2`（parent1 `8deb2b25`、parent2 `e7804e1d`）。`--close-worker --delay-ms 10000 --worktree keep` exit 0。斷點 E → U-67（D501）。- 2026-11-28 15:35 (UTC+8) U-67：A → 整合分支再合併 `main` 後 ff：`main` = `6a7b90e8`，產品樹 = `e7804e1d`；整合 worktree detach；`git worktree remove` 解除註冊但目錄刪除失敗（`Invalid argument`，殘留 `node_modules/` 等，待程序釋放後手動刪）；分支 `ct/T0971`、`ct-merge/T0971` 保留（D502）。
