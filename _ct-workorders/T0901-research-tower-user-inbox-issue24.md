---
schema_version: 1
schema_kind: workorder
id: T0901
title: "研究（PLAN-068 / GitHub #24）：塔台給使用者的總結與提問如何不被淹沒 —— 收件匣、回合訊息卡（MultiView / SubView）、分割檢視、閱讀保護的比較，清單維護與保留策略，BAT ↔ CT 契約草案"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P2
sizing: M
created_at: "2026-11-25T03:05:55+08:00"
updated_at: "2026-11-25T03:15:22+08:00"
started_at: "2026-11-25T03:08:15+08:00"
completed_at: "2026-11-25T03:15:22+08:00"
depends_on: []
related:
  - "PLAN-068；GitHub issue #24（`gh issue view 24 -R gowerlin/better-agent-terminal`）、#23（已關閉）；D326"
  - "T0788（塔台等使用者時保留 Worker 通知）、T0607（Worker 問塔台）、T0701（指揮塔總覽，契約 v1）、T0735 / T0762（等待使用者提示）、T0590 / T0600（hooks）、T0641（session 名稱）"
  - "HANDOVER `_ct-workorders/_handover-2026-11-25-tower-user-inbox-issue24.md`（CT 端的討論；CT 答覆到時塔台以〈塔台補充〉轉給本單）"
affects_files:
  - _ct-workorders/T0901-research-tower-user-inbox-issue24.md
renew_count: 0
session_ids:
  - "d95f9b1c-0a7e-4f9e-8ec2-f9b084dfce83"
互動模式: disabled
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 唯讀研究：只寫本工單檔（`git commit --only _ct-workorders/T0901-research-tower-user-inbox-issue24.md`）。不改產品程式、不開 BUG / PLAN、不改 `_ct-workorders/_*`、不在 GitHub issue 留言、不 push。可以寫小型原型或量測腳本放 scratchpad（收尾刪除），不 commit。"
  - "🔴 不碰使用者正在用的 BAT（安裝版 `0.8.0-pre.2`）與其 userData / Terminal Server / `bat-pty-holder`；要實測 Claude Code 行為（例：全螢幕模式往上捲時新輸出會不會把畫面拉回底部、`Stop` hook payload 與 transcript 格式）時，只用隔離環境（空的 `CLAUDE_CONFIG_DIR`、不登入、不開會耗 token 的 turn；需要真實回合的項目寫成「待實機」）。"
  - "🔴 隱私（公開 repo，D176）：回報區不貼權杖、env 值、PTY 內容、對話內容、家目錄（寫 `<使用者資料夾>`）、真名；issue 回報者寫「issue #24 回報者」。設計上：訊息內容要不要存檔、存在哪、保留多久，必須在方案中明確寫出，並比照 T0607（問答內容只在記憶體、不寫檔、經 `redactTerminalSecrets`）與 T0701（總覽唯讀）評估。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0901 — 研究：塔台訊息不被淹沒（GitHub #24）

## 研究目標

回答使用者 2026-11-25 的問題，產出可決策的方案：

1. **現況盤點**：BAT 目前能保存 / 呈現「塔台給使用者的訊息」的機制有哪些、缺口在哪（T0788 notify hold、terminal attention ⚠️ / ? / ✓、Worker 提示音、tower questions store、指揮塔總覽 `todo`、縮圖預覽 8 行、xterm scrollback）。issue #24 的「為什麼現有機制擋不住」是否正確，逐條查證。
2. **方向比較**（至少 PLAN-068 的 A–D，可再提新方向）：
   - **A 收件匣檔**（CT 寫、BAT 唯讀顯示）
   - **B 閱讀保護**（捲動 / 選取時延後送 Worker 通知；與 T0788 佇列的關係）
   - **C 回合訊息卡**（BAT 從 claude hooks / transcript 擷取塔台每回合的最後訊息，做成獨立卡片清單 —— 類 MultiView / SubView；不依賴 CT 改動就能用？codex 塔台怎麼辦？）
   - **D 分割 / 子檢視**（把某則訊息釘到側欄或分割窗格）
   - 每個方向評估：能否解問題 1（淹沒）與問題 2（讀到一半被擠走）、是否需要 CT 改、claude / codex 塔台是否都適用、遠端（WSL / SSH / Docker）與 detached 視窗、隱私（內容存不存檔）、實作量、對既有功能的回歸風險。
3. **清單維護與保留策略**：狀態機（例 未讀 → 已讀 → 已回答 / 已略過 / 過期）、「待決」與「僅告知」分流、保留多少（只留最後 N 筆？未決的永遠保留？已結的保留幾筆或幾天？）、跨 BAT 重開是否保留、誰負責清理（CT 收單時 / BAT 顯示端 / 使用者手動）、檔案大小上限（比照 `memory-protocol.md` 大小預算與 BAT 512 KiB 讀取上限）。
4. **回答路徑**：使用者怎麼回答清單裡的提問（塔台分頁輸入「U-3：選 B」、面板回答欄經 notify 路徑、或沿用 T0607 問答 store 的反向通道），與 T0788 保留、issue #23 草稿保護的互動。
5. **Claude Code 本身的能力**：全螢幕 / 非全螢幕模式往上捲時新輸出是否拉回底部（issue 未驗證項）；是否有現成功能可用（例 transcript、`/resume` 檢視、hooks 事件）可以降低 BAT 實作量。

## 產出（回報區）

- 〈調查結論〉：現況盤點表、各方向比較表、Claude Code 行為查證結果
- 〈建議方向〉：推薦組合（可分階段，例 Phase 1 只改 BAT、Phase 2 需 CT），每階段的使用者體驗描述（ASCII 示意即可）
- 〈清單維護與保留〉：具體規則與預設值
- 〈BAT ↔ CT 契約草案〉：若推薦方案需要 CT 寫檔或改流程，列欄位、檔名、狀態值、版本相容（比照 T0701 契約 v1 的寫法），標明哪些是 BAT 需求、哪些留給 CT 決定
- 〈建議下一步〉：拆成哪些實作單（BAT 端）與要 CT 做的事

## 參考

- issue #24 全文（`gh issue view 24 -R gowerlin/better-agent-terminal`，唯讀）
- CLAUDE.md「塔台等使用者回答時保留 Worker 通知（T0788）」「Worker 問塔台（T0607）」「指揮塔總覽（T0701）」「Worker 分頁回收」中等待使用者提示（T0735 / T0762）、「blocked 狀態偵測」各節與對應 `docs/agent-guide/*.md`

## 塔台補充（執行中 #1）

**時間**：2026-11-25T03:11:44+08:00

CT 塔台已回覆 HANDOVER（立場草案，DRAFT，CT 使用者尚未核定，雙方仍不實作）。正式紀錄在 BMad-Guide repo：`D:\ForgejoGit\@Gower_Labs\BMad-Guide\_ct-workorders\_reply-2026-11-25-tower-user-inbox-issue24.md`（BMad-Guide commit `1d2692f`、CT 決策 D866），可唯讀讀取，不得寫入。要點：

1. 待決寫在 `_tower-state.md` frontmatter 新欄位 `awaiting_user`（每筆：`U-n`、`workorder`、`kind`、`source`、`summary`、`options`、`created_at`；不升 `summary_version`），不另開檔。
2. 只暫停單張：工單 frontmatter `waiting_user: "U-n"`，塔台不派 `depends_on` 到它的工單，不加新狀態。
3. CT 只寫**待決**；**僅告知**的總結不進 CT 檔案，建議 BAT 從 hook / transcript 自行擷取卡片。回答後塔台在同一次寫入移除該筆並記決策日誌。
4. 只保留未決；單筆 ≤ 0.5 KB；超過 20 筆時面板提示。
5. 回答是一行純文字 `U-3：B`；面板回答欄送同一行、經 notify 路徑（受 T0788 保護），不用 JSON。
6. 內容與現有 tower-state / 決策日誌同類，不寫祕密與客戶資料；另提供 `user_inbox: off` 開關。
7. CT 可先做：有未決時，塔台每次回覆結尾重列一行 `⏸ 待你決定：U-3（T0901）…`；CT 支持 B 案（閱讀保護）。

**新指示**：在原研究範圍內一併評估 CT 草案，回報區〈BAT ↔ CT 契約草案〉以它為基準（同意 / 修改 / 反對逐點寫理由），並**明確回答 CT 請 BAT 確認的三點**：

- (a) `awaiting_user` frontmatter 欄位草案是否合 BAT 指揮塔總覽（T0701，`src/lib/ct-tower-overview.ts`）的讀法與 512 KiB 讀取上限；欄位型別 / 必填 / 未知欄位的處理建議。
- (b) 「僅告知」卡片由 BAT 自行擷取是否可行（claude 塔台用 hooks / transcript；**codex 塔台**怎麼辦），隱私與保留（只在記憶體？最後 N 筆？）。
- (c) 面板回答欄送一行 `U-n：…` 經 notify 路徑是否可行（與 T0788 保留、issue #23 草稿保護的互動；誰送、送到哪個分頁、權杖角色）。

不需要回覆塔台確認收到；照 ct-exec 規則在驗證前、commit 前、填回報前讀新段落即可。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（研究單；產出齊全，未改產品程式）
- **session_id**：d95f9b1c-0a7e-4f9e-8ec2-f9b084dfce83
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = 本 repo 根目錄，非 worktree，`CT_HOME` 未設）；C-1 工單在 REPO_ROOT 之下；C-3 `affects_files` 只有本工單（`_ct-workorders/` 排除）→ not applicable；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；BAT helper env 齊全（`BAT_REMOTE_TOKEN` 已設定）。
- **證據分道**：全部是「原始碼 / 文件 / 二進位字串」靜態查證；沒有 build、沒有 runtime 實測（需要真實 claude 回合的項目標「待實機」）。
- **commit**：只有本工單檔（`git commit --only`），不 push。

### 互動紀錄
- [03:08] 開工；yolo，研究範圍內沒有需要塔台裁示的分歧，未提問。
- [03:11] 驗證前節點檢查〈塔台補充〉：沒有新段落。
- [03:15 前] 📥 塔台補充（執行中 #1）於〈跨 session 通知（額外節點）〉讀到 → 唯讀讀取 CT 回覆 `_reply-2026-11-25-tower-user-inbox-issue24.md`（BMad-Guide，DRAFT、CT D866），重讀 `src/lib/ct-tower-overview.ts` 的解析；〈BAT ↔ CT 契約草案〉改以 CT 草案為基準逐點表態，並在該節末明確回答 (a)(b)(c)；〈建議方向〉Phase 2、〈清單維護與保留〉、〈建議下一步〉同步改寫（原 A′「內容寫在工單、`_tower-state.md` 只放索引」撤回，改採 CT 的 `awaiting_user`）。

### 調查結論

#### 1. 現況盤點（issue #24「現有機制擋不住」逐條查證）

| 機制 | 位置 | 能保存塔台給使用者的訊息嗎 | issue 說法 | 查證 |
|---|---|---|---|---|
| T0788 notify hold | `electron/notify-hold.ts` | 不保存訊息；只在塔台 `blocked`（`permission` / `question` / `elicitation` / codex `input`）時延後 Worker 通知 | 「文字提問時回合結束、`idle`，通知立刻送進去」 | ✅ 正確。`tower` reason 也不觸發；`idle` 一律直送 |
| terminal attention ⚠️ / ? / ✓ / ↻ | `src/lib/terminal-attention.ts` `waitingForUser` | 不保存內容；塔台分頁的 ⚠️ 只看 hook reason | （未提） | 塔台用一般文字問完 = `idle`，**沒有任何標示**。`?` 是 Worker 等塔台（T0609 / T0607），方向相反 |
| Worker 提示音 C `towerReply` | — | — | 「只提醒、不保存」 | ⚠️ **本 repo 沒有這個功能**（`git log --all -S towerReply` 無結果）；issue 回報者是「以 `0.7.5-pre.2` 為基礎的本機建置」。BAT 只有 Claude 面板完成時的系統通知（`notifySound` / `notifyOnComplete`）。結論不變：沒有保存內容的機制 |
| T0607 tower questions store | `electron/tower-questions.ts` | 只有 Worker → 塔台；內容只在記憶體 | （未提） | 沒有「塔台 → 使用者」方向；但它的設計（記憶體、`redactTerminalSecrets`、不寫檔、日誌不記內容）是本案隱私的現成範本 |
| 指揮塔總覽 `todo` | `src/lib/ct-tower-overview.ts` | 讀 `_tower-state.md` frontmatter `todo` | 「只顯示前 5 則，不是給待決用」 | ✅ 正確（`TOWER_STATE_TODO_LIMIT = 5`）。總覽是唯讀、`fs.watch`、512 KiB 單檔上限、遠端經 proxied `ct:read-config-sources`，**可直接當 A 方向的讀取管線** |
| 縮圖預覽 | `src/lib/thumbnail-preview.ts` | 最後 8 行、會被下一回合覆蓋 | （未提） | 擋不住問題 1 |
| xterm scrollback | `TerminalPanel.tsx`（`scrollback: 10000`） | 內容還在，但要自己捲回去找 | 「回頭不好找」 | ✅ 正確；fullscreen 模式下 scrollback 在 claude 自己的虛擬捲動裡，xterm 這層沒有 |

**新發現（BAT 自己造成的「讀到一半被拉走」）**：Worker `--submit` 的 Enter 由塔台分頁 xterm 產生（`TerminalPanel.tsx` `dispatchEnter`：`terminal.focus()` → `dispatchSyntheticEnterKeydown`）。xterm 5.5 的 keydown 路徑把它當**使用者輸入**（`Terminal.ts` `triggerDataEvent(result.key, true)`）：
- `scrollOnUserInput`（預設 true，BAT 未改）→ 使用者在 normal buffer 往上捲時，**viewport 被拉回底部**（`CoreService.ts`：`wasUserInput && scrollOnUserInput && ybase !== ydisp` → `onRequestScrollToBottom`）；
- `onUserInput` → `SelectionService` **清掉使用者正在選取的文字**；
- `terminal.focus()` 把焦點搶到塔台分頁的 xterm（`restoreFocus` 只給 T0566）。

也就是說：在 claude **預設（非 fullscreen）**renderer 下，就算 claude 本身不動畫面，BAT 送通知的那一下也會把使用者拉回底部。這是程式碼閱讀的結論，**待實機**確認（隔離實例、normal buffer、往上捲後送一次 `bat-notify --submit`）。

#### 2. Claude Code 本身的能力（內嵌 CLI `2.1.316`，二進位字串靜態查證）

| 項目 | 查證結果 |
|---|---|
| fullscreen 模式 | `/tui fullscreen` 或 `CLAUDE_CODE_NO_FLICKER=1`：alt-screen、「virtualized scrollback」。Windows over SSH、tmux -CC 等情況會自動關閉 |
| 往上捲時新輸出會不會拉回底部（issue 未驗證項） | fullscreen 才有的設定 `autoScrollEnabled`（`/config` → 「Auto-scroll」，**預設開**，描述「Auto-scroll the conversation view to bottom (fullscreen mode only)」）。往上捲後（not sticky）有「N new messages / Jump to bottom」提示（`jumpToNew`）。但 `repin` 在以下時機把捲動「yank」回底部：`onSubmit`、`onUserRowLanded`（`ownSubmitLanded` / `rowLanded`）、`onPromptEdit`（`typedIntoEmpty`：空輸入框被打字）、dialog 等。**Worker 通知正是「往空輸入框打字＋送出」**，所以 auto-scroll 開著時 fullscreen 也會被拉回底部；`autoScrollEnabled: false` 時非強制的 `repin(false, …)` 直接 return，畫面保持，只顯示「N new messages」。⇒ 問題 2 在 claude 端有現成解（fullscreen＋關 auto-scroll），**待實機**（需真實回合） |
| `/focus`（Focus view） | 「just your prompt, summary, and response」，只在 fullscreen 可用；可讓每回合的總結較好找（減輕問題 1，不解決） |
| session recap | 離開 5 分鐘以上回來時顯示回顧（`awaySummaryEnabled`，標 `@internal`）；不是清單、不可回顧 |
| `Stop` hook payload | 含 `last_assistant_message`（另有 `transcript_path`、`session_id`、`stop_hook_active`）。BAT 已注入 `Stop` hook（`BAT_CLAUDE_HOOKS`，async，`bat-hook.mjs stop`），目前依 T0590 / T0600 規則**不送 payload 內容** |
| transcript | `transcript_path` 的 jsonl 是 claude 內部格式（未公開契約），可做「BAT 重開後重建清單」，但會隨 CLI 改版變動 |

#### 3. 方向比較

| 方向 | 解問題 1（淹沒） | 解問題 2（讀到一半被擠走） | 要 CT 改 | claude / codex 塔台 | 遠端 / detached | 隱私（內容存哪） | 實作量 | 回歸風險 |
|---|---|---|---|---|---|---|---|---|
| **A 收件匣檔**（CT 寫、BAT 唯讀） | ✅（待決事項） | ❌ | 是（寫檔、暫停單張工單、U-n） | 兩者都可 | ✅ 沿用總覽的讀取管線（proxied） | 檔案；在 `_ct-workorders/` 就進公開 repo（D176） | BAT 小（總覽多一個區塊）、CT 中 | 低（唯讀） |
| **B 閱讀保護**（延後送通知） | ❌ | ✅ | 否 | 兩者都可（偵測在 BAT 端） | 遠端 holder 在 bat-server；「閱讀中」信號在本機視窗 → 需送到 host（新 channel） | 不存內容 | 中（延伸 `NotifyHoldController`＋renderer 信號） | 中：延後通知會延後派工，需有上限 |
| **B0 送通知不搶捲動**（新） | ❌ | ✅（normal buffer 部分） | 否 | 兩者 | 本機 renderer 修改，遠端同樣受益 | 不存 | 小（`dispatchEnter` 的 auto 路徑保住 `ydisp` / 選取） | 低；要守住 T0788 第 9 點與 T0566 焦點 |
| **C 回合訊息卡**（Stop hook `last_assistant_message`） | ✅（所有回合，含僅告知） | ✅（卡片不隨終端捲動） | 否（分不出「待決 / 僅告知」） | claude-cli ✅；Claude 面板（SDK）✅（訊息本來就在 BAT）；**codex ❌**（BAT 不得注入 codex hooks / `-c notify`，OSC 7501 的 `msg` 不解碼不存） | hook 在 host 執行 → host 記憶體 → 需 proxied 讀取＋事件（比照 T0749 attention 對帳）；detached 比照 `DetachedWaitingReporter` | 主行程記憶體、`redactTerminalSecrets`、不寫檔（比照 T0607）；BAT 重開即消失 | 中 | 中：改 T0590 hook 規則（`stop` 開始送內容）、stdin 讀取上限 |
| **D 分割 / 子檢視** | — | ✅ | 否 | — | — | — | 終端分割：大（同一 PTY 第二個 xterm 視圖在 alt-screen TUI 下沒有意義）；卡片釘選：小 | 終端分割高 |
| **E BAT 問使用者通道**（新；helper，比照 T0607 反向） | ✅（待決） | ✅ | 是（塔台呼叫 helper） | 兩者 | ✅ helper 通道本機 / 遠端都有 | 記憶體；BAT 重開消失（CT 端仍有狀態） | 中 | 低 |

結論：
- 問題 2 的根本是「有東西動了捲動」：BAT 自己（B0）、claude fullscreen 的 auto-scroll（設定可關）、claude 非 fullscreen 的重繪。B0＋文件提示（fullscreen、關 auto-scroll）成本最低；B 是兜底。
- 問題 1 要分兩類：**僅告知**的總結量大、時效短 → C（BAT 自己做，不靠 CT）；**待決**的提問量小、要可靠 → 只有 CT 知道（A 或 E）。
- D 不做終端分割；以「卡片釘選到側欄」的形式併入 C / A 的呈現。

### 建議方向

**Phase 1（只改 BAT，不需 CT）**

1. **B0 送通知不搶捲動 / 選取**：helper 的 submit Enter（`auto: true`）送出前記下 `ydisp` 與選取、暫時關 `scrollOnUserInput`，送完還原；焦點行為另議（見〈遭遇問題〉）。
2. **B 閱讀保護＋#23 草稿保護**：`NotifyHoldController` 新增 reason `reading` / `draft`（與 T0788 共用佇列、「📨 待送 N」、exit code 不變）。`reading` 信號：塔台分頁 normal buffer `ydisp < ybase`、有選取、或最近 10 s 有滾輪 / PageUp（fullscreen 時 BAT 看不到 claude 內部捲動位置，只能用滾輪事件推測）；停手 10 s 送出、**最長 60 s**（與 D228「不設逾時」不同：這裡延後的代價只是捲動被拉走，不會作答對話框）。`draft` 照 #23 提案 (a) 不逾時。
3. **C 回合訊息卡**：只對已宣告塔台（`--set-role tower`，或「以塔台開啟 Claude」）的 claude-cli 分頁與 Claude 面板。縮圖「💬 3」未讀數；面板是卡片清單，每張一回合的最後訊息，可展開、釘選、標已讀、複製；釘選的卡可固定在側欄（= D 的子檢視）。
4. **文件提示**：在說明 / 塔台分頁提示「fullscreen（`/tui fullscreen`）＋ `/config` 關 Auto-scroll＋ `/focus`」。BAT **不**替使用者注入 `CLAUDE_CODE_NO_FLICKER` 或改 claude 設定。

```
┌ Tower ──────────────────────────────┐  ┌ 塔台訊息（3 未讀） ─────────┐
│ …（終端照常捲動）                    │  │ 📌 03:20 T0905 回報總結       │
│ > T0906 完成                         │  │ ● 03:24 T0906 完成，下一步…   │
│ ● 已收單，派 T0907…                  │  │ ● 03:25 派 T0907；請決定 …？  │
│                                      │  │   03:10 T0904 …（已讀）       │
└──────────────────────────────────────┘  └───────────────────────────────┘
縮圖：Tower  💬3  📨1（閱讀中，延後送出）
```

**Phase 2（需 CT）：「待你決定」**

5. **A（採 CT 草案，推薦）**：CT 把**待決**寫在 `_tower-state.md` frontmatter `awaiting_user`（每筆含 `summary` / `options`，≤ 0.5 KB），工單 frontmatter `waiting_user: "U-n"`，不派 `depends_on` 它的工單。BAT 沿用總覽管線（唯讀、`fs.watch`、proxied 遠端讀取）顯示「待你決定 N」清單、塔台縮圖與工作區列表的未決數；工單列表的該工單標 `⏸ U-3`。
   - 原本 Worker 提議的 A′（內容寫在工單、`_tower-state.md` 只放索引）撤回：CT 的寫法每筆已有大小上限、只放未決、與既有 frontmatter 同一次寫入，BAT 讀一個檔就能列出完整清單，不必再逐一開工單。
6. **E（備援，只在 CT 設 `user_inbox: off` 又想要面板時才需要）**：helper 通道 `bat-terminal.mjs --ask-user < q.json`（tower 權杖、記憶體、遮罩）。CT 草案未要求，Phase 2 不做。
7. **回答**：第一步在塔台分頁輸入 `U-3：B`；第二步 BAT 面板回答欄（見下節 (c)：本機 IPC、不是 helper channel，進 `NotifyHoldController` 佇列，受 blocked / `draft` / `reading` 保護）。
8. **CT 的「⏸ 待你決定：」重列行**：CT 可先做、與 BAT 版本無關。BAT 的回合卡片（C）會自然包含這一行；BAT 可把以 `⏸ 待你決定：` 開頭的行在卡片上加亮，只當提示、不當資料（同 CT 第 7 點）。

**Phase 3（選用）**：BAT 重開後以 `claudeSessionId`＋ transcript 重建 C 的卡片（不新增 BAT 自己的存檔）；依賴 claude 內部格式，先觀察 Phase 1 使用情況再決定。

### 清單維護與保留

**C 回合訊息卡（BAT 端，Phase 1）**

| 規則 | 預設值 |
|---|---|
| 狀態 | `未讀` → `已讀`（展開過、或按「全部已讀」）；可 `釘選` |
| 保留 | 每個塔台分頁最近 **30** 張；釘選的不算入、最多 **10** 張 |
| 單張大小 | 遮罩後最多 **16 KiB**，超過截斷並標示 |
| 存放 | **只在 host 主行程記憶體**；收件即 `redactTerminalSecrets`；不寫檔、日誌只記 terminal id / 長度 / 數量 |
| 生命週期 | PTY 結束（含 ⏻）/ 分頁關閉 / Terminal Server recovery 清空；**BAT 重開不保留**（Phase 3 再議） |
| 已讀狀態 | renderer 記憶體；多視窗以 host 為準（比照 attention 對帳） |
| 誰清理 | 自動（上限、生命週期）＋使用者手動清除；CT 不參與 |

**A 待決事項 `awaiting_user`（CT 擁有，Phase 2；與 CT 草案一致）**

| 規則 | 值 | 誰 |
|---|---|---|
| 狀態 | 檔案裡只有「未決」；回答 / 撤銷時 CT 在同一次寫入移除該筆並記決策日誌 | CT |
| 保留 | 未決**永不自動過期**；已結的不留在 frontmatter（歷史在決策日誌與 YOLO 歷程） | CT |
| 大小 | 每筆 `summary` ≤ 120 字、`options` ≤ 6、約 0.5 KB；> 20 筆時 CT 面板提示 | CT |
| BAT 顯示 | 全部列出；> 50 筆時只畫前 50＋「另有 N 筆」（防呆，正常不會到） | BAT |
| BAT 本地狀態 | `未看過` → `看過`（展開過）；只存 `U-n` id，renderer 記憶體（可選 localStorage）；某筆從檔案消失即視為已結，從清單移除；「最近已結」由 BAT 記憶體保留最後 **10** 筆（只在本次啟動、不寫檔） | BAT |
| 「僅告知」 | **不進** `awaiting_user`（交給 C） | 雙方同意 |
| 檔案大小 | `_tower-state.md` 整個檔仍受 BAT 512 KiB 讀取上限；20 筆 × 0.5 KB ≈ 10 KB，遠低於上限，也低於本專案 hot path 30 KB 軟警告 | — |

### BAT ↔ CT 契約草案

> 基準：CT 立場草案 `_reply-2026-11-25-tower-user-inbox-issue24.md`（BMad-Guide `1d2692f`、CT D866，DRAFT）。以下逐點表態（同意 / 修改 / 反對＋理由）；標 **[BAT 需求]** 的是 BAT 顯示需要的條件，**[CT 決定]** 的由 CT 定。雙方使用者核定前都不實作。

**Phase 1 不需要契約**：B0 / B / C 全在 BAT 內。唯一影響 CT 的是 Worker 通知可能延後（`reading` 最長 60 s；`draft` 等使用者送出或取消草稿），helper exit code 與 stdout 不變（同 T0788 第 3 點）。CT 已表態支持 B 案。

**CT 草案逐點表態**

| # | CT 草案 | BAT 表態 | 理由 / 修改 |
|---|---|---|---|
| 1 | 待決寫 `_tower-state.md` frontmatter `awaiting_user`，不另開檔 | ✅ 同意 | 總覽已讀這份 frontmatter（契約 v1、`js-yaml` CORE_SCHEMA、未知欄位忽略），只要加一個欄位的解析；遠端 / detached 走既有路徑。欄位處理見 (a) |
| 1′ | `next_ids` 加 `user: "U-4"` | ✅ 同意 | 現行總覽把 `next_ids` 每個鍵原樣列出，舊 BAT 會自動多顯示一列 `user U-4`，不需改 |
| 1″ | `options: ["A 收件匣", "B 回合卡片"]`、回答 `U-3：B` | ⚠️ 修改 | BAT 的回答欄要知道「B」是哪個選項的代號。建議：**[CT 決定]** 二擇一 —— ① 選項字串固定 `<代號> <說明>`（代號 = 第一個空白前的字，`^[A-Za-z0-9]{1,3}$`），BAT 送 `U-3：B`；② CT 解析時接受代號或完整選項文字，BAT 送完整選項文字。BAT 傾向 ①（送出的行短、與手打一致） |
| 2 | 只暫停單張：工單 `waiting_user: "U-n"`，不派 `depends_on` 它的工單，不加新狀態 | ✅ 同意 | BAT 不判斷暫停；工單列表可選擇性顯示 `⏸ U-n`（讀工單 frontmatter，BAT 既有的工單解析多一個欄位）。未知 / 缺值 = 不顯示 |
| 3 | CT 只寫待決；僅告知由 BAT 自己擷取卡片 | ✅ 同意 | 與本研究的分流結論相同（C 方向）；可行性見 (b) |
| 3′ | 回答 / 撤銷時 CT 同一次寫入移除該筆＋決策日誌；BAT 不清、不改 CT 檔 | ✅ 同意 | 符合 T0701 唯讀原則。BAT 以「該筆從檔案消失」判定已結 |
| 4 | 只留未決；單筆 ≤ 0.5 KB；> 20 筆 CT 提示 | ✅ 同意 | 見〈清單維護與保留〉；BAT 另以 50 筆為畫面防呆 |
| 4′ | 已結的「最近 N 筆」由 BAT 自己記 | ✅ 同意 | BAT 記憶體保留最後 10 筆已結（只有 id＋最後看到的 summary），不寫檔 |
| 5 | 回答一行純文字 `U-3：B`；面板送同一行、經 notify 路徑、不用 JSON | ✅ 同意（路徑修改） | 一行純文字同意。但面板回答**不是** helper 的 notify（沒有權杖角色問題），而是本機 IPC 進同一個保留佇列；細節見 (c) |
| 6 | 內容與 tower-state / 決策日誌同類；不寫祕密 / 客戶資料；`user_inbox: off` | ✅ 同意 | BAT 不新增暴露面：只讀、不寫檔、日誌只記 id / 筆數 / 長度，不記 `summary` / `options`。`off` 時 BAT 看到的是「沒有欄位」= 不顯示清單，不需另外辨識 |
| 7 | 有未決時每次回覆結尾重列 `⏸ 待你決定：U-3（T0901）…` | ✅ 同意 | 與 BAT 版本無關、可先上。BAT 只在卡片上加亮該行，不解析成資料 |

**明確回答 CT 請 BAT 確認的三點**

**(a) `awaiting_user` 是否合總覽讀法與 512 KiB 上限 —— 合。**
- 讀法：`parseTowerState`（`src/lib/ct-tower-overview.ts`）以 `js-yaml` `CORE_SCHEMA` 讀 frontmatter，要求 `schema_kind: tower-state`、`summary_version` 整數 ≥ 1，其他鍵忽略。新增 `awaiting_user` 不影響舊 BAT（直接忽略），**不升** `summary_version` 同意。CORE_SCHEMA 不轉時間型別，`created_at` 有無引號都會是字串；CT 的 `+0800`（無冒號）BAT 照原字串顯示即可。
- 上限：512 KiB 是整個 `_tower-state.md` 的讀取上限（超過顯示 `File too large`、不是空清單）；20 筆 × 0.5 KB ≈ 10 KB，沒有壓力。
- **[BAT 需求] 型別 / 必填建議**：

  | 欄位 | 型別 | 必填 | BAT 處理 |
  |---|---|---|---|
  | `awaiting_user` | 陣列 | 否 | 缺、`[]`、`null` = 沒有未決；不是陣列 → 整欄忽略並在總覽標「`awaiting_user` 格式不符」 |
  | `id` | 字串 `^U-\d+$` | ✅ | 缺或不符 → 該筆略過、計入「N 筆格式不符」；重複 id → 保留第一筆並標示 |
  | `summary` | 字串，非空 | ✅ | 缺 → 該筆略過；超過 120 字 → 照顯示（不截斷內容語意，只在 UI 折行） |
  | `workorder` | 字串（完整工單 ID，`""` = 無） | 否 | 有值時可點，開該工單 |
  | `kind` | 字串 | 否（預設 `decision`） | 未知值照原字串顯示，不略過 |
  | `source` | 字串 | 否 | 未知值照原字串顯示 |
  | `options` | 字串陣列 | 否 | 非陣列 → 視為空；元素非字串（數字等純量）→ 轉字串；空 → 回答欄改自由文字 |
  | `created_at` | 字串（ISO 8601 含時區） | 否 | 用來排序（舊 → 新）與顯示「N 分鐘前」；解析不了 → 照原字串顯示、排在檔案順序 |
  | 其他未知鍵 | — | — | 忽略（同契約 v1） |

  單筆錯誤不影響其他筆與總覽其他區塊（同 T0701 的錯誤隔離）。

**(b) 「僅告知」卡片由 BAT 自行擷取 —— claude 可行；codex 目前不可行。**
- **claude-cli 塔台**：可行。內嵌 CLI 2.1.316 的 `Stop` hook input 有 `last_assistant_message`；BAT 已對 claude-cli 分頁注入 `Stop` hook（`BAT_CLAUDE_HOOKS`、async、不影響 claude）。改法：`bat-hook.mjs stop` 多送最後訊息（上限 64 KiB 讀取、送出前截到 16 KiB），主行程只收**已宣告塔台**分頁的內容（其他分頁丟棄、不保存）。這要改 T0590 / T0600「hook 不送 payload 內容」的規則，需塔台決策；hook 其他規則（exit 0、stdout 不輸出、總時限 1.8 s）不變。限制：使用者關掉 hooks（`blockedDetection: none`）就沒有卡片。
- **Claude 面板（SDK）塔台**：可行，訊息本來就在 BAT 主行程，直接共用卡片 UI。
- **codex 塔台**：**Phase 1 不做**。BAT 現行規則（T0621 / D158）不得注入 codex hooks、`-c notify`、`-c tui.*`；OSC 7501 的 `msg` / `title` 依規則不解碼、不存。剩下的路是唯讀讀 codex 的 rollout 檔（`$CODEX_HOME/sessions/`，內部格式、BAT 不知道 session 對應），脆弱且要另行研究。codex 塔台的替代：CT 的 `⏸ 待你決定：` 重列行＋ `awaiting_user` 清單（兩者都與塔台 agent 無關）。若要 codex 卡片，需另開研究或由塔台裁示放寬 D158。
- **隱私與保留**：只在 host 主行程記憶體、收件即 `redactTerminalSecrets`、不寫檔、日誌只記 terminal id / 長度 / 張數；每個塔台分頁最近 30 張（釘選另計、最多 10）、單張 16 KiB；PTY 結束 / ⏻ / Terminal Server recovery 清空；BAT 重開不保留（Phase 3 再評估從 claude transcript 重建，不新增 BAT 存檔）。遠端：hook 在遠端 host 執行，內容只在 bat-server 記憶體，本機視窗以 proxied channel 讀取。

**(c) 面板回答欄送一行 `U-n：…` —— 可行，但走本機 IPC，不是 helper notify。**
- **誰送**：使用者在 BAT 視窗的面板按送出 → renderer 呼叫新的本機 IPC（例 `tower-inbox:answer { terminalId, text }`；遠端視窗時為 proxied channel 送到 bat-server）。這是**使用者輸入**，不經 helper、不用權杖，🔴 不加進 `HELPER_CHANNEL_ROLES`（Worker / 塔台的 PTY 權杖都不能呼叫，避免 agent 冒充使用者作答）。
- **送到哪個分頁**：`_tower-state.md` 所在工作區中已宣告塔台（`--set-role tower` 或「以塔台開啟 Claude」）的分頁；剛好一個 → 直接送；零個或多個 → 讓使用者選，不猜。
- **與 T0788 的互動**：host 收到後交給 `NotifyHoldController`（新 source `user-answer`）——塔台在 `permission` / `question` / `elicitation` / `input` blocked 時保留（否則 Enter 會替使用者回答對話框，BUG-196 同一風險），解除後安靜 1 s 送出；沒有 blocked 時立即送出。與 helper 通知同一佇列、依序送，不插隊。
- **與 #23 草稿保護的互動**：塔台輸入框有草稿（`draft`）時不送（否則回答會接在草稿後面，正是 #23）；面板顯示「塔台輸入框有未送出的文字，請先送出或清除」並保留在佇列，草稿清掉後送出。`reading` 不擋使用者自己的回答（是使用者本人按的）。
- **送出形狀**：文字單行（含換行就拒絕，Phase 1 不支援多行）＋ 250 ms ＋ Enter，與 bat-notify 相同；Enter 算使用者輸入（不帶 `{ auto: true }`），與手打一致。塔台忙碌（`working`）時 claude 會把它排進佇列，與手打相同。
- 「📨 待送 N」清單多一種來源「你的回答 U-3」，可取消。

### 建議下一步

BAT 端實作單（皆需使用者裁示後開）：
1. **B0**：helper submit Enter 不搶捲動 / 選取（`TerminalPanel.tsx` `dispatchEnter`），含真 xterm 單元測試與隔離實例實測；同單查證焦點行為（見〈遭遇問題〉）。小。Phase 1。
2. **#23 草稿保護＋ B 閱讀保護**：`NotifyHoldController` 新 reason `draft` / `reading`、renderer → host 的信號 channel（遠端路徑）、「📨 待送 N」顯示原因。中。Phase 1。#23 已被關閉（`COMPLETED`、無留言）但本 repo 沒有實作，建議塔台確認是否重開或併入本案。
3. **C 回合訊息卡**：`bat-hook.mjs stop` 送 `last_assistant_message`（需塔台決策改 T0590 規則）、host 記憶體 store、proxied 讀取＋事件、縮圖 💬、卡片面板＋釘選側欄、`⏸ 待你決定：` 行加亮；Claude 面板塔台共用 UI。中。Phase 1（不需 CT）。
4. **文件**：說明頁加「塔台分頁建議設定」（fullscreen、關 Auto-scroll、`/focus`）。小。
5. **A 待你決定清單（CT 6.1.0 定案後）**：總覽解析 `awaiting_user`（(a) 的型別表）、清單 UI、縮圖 / 工作區列表未決數、工單 `⏸ U-n`。小～中。
6. **面板回答欄（5 之後）**：本機 / proxied IPC、`NotifyHoldController` `user-answer`、目標塔台選擇。依賴 2（`draft`）。中。
7. **待實機**（併入 1 / 3 的驗收）：(a) normal buffer 下 `bat-notify --submit` 是否把捲動拉回底部；(b) fullscreen＋ auto-scroll 開 / 關時通知是否拉回；(c) `Stop` hook 的 `last_assistant_message` 實際大小與多段文字回合時的內容。

要 CT 做的事（回覆 CT）：
- 本節 (a)(b)(c) 的確認：`awaiting_user` 合讀法（附型別表）、僅告知卡片 claude 可行 / codex 暫不可行、回答欄可行但走本機 IPC；
- 決定 1″ 的選項代號格式（① 或 ②）；
- `⏸ 待你決定：` 重列行可先上（不等 BAT）；
- 雙方使用者核定後：CT 開 6.1.0 預發行單，BAT 開第 5、6 項；第 1–4 項不依賴 CT，可先由使用者裁示。

### Renew 歷程
無

### 遭遇問題
- 無阻斷問題。
- 未在 scratchpad 寫原型或量測腳本；所有結論來自原始碼、文件與內嵌 claude 二進位的字串查證，runtime 項目列在〈建議下一步〉第 5 點。
- 附帶觀察（未查證，範圍外）：`dispatchEnter` 對 helper 通知呼叫 `terminal.focus()`（只有 T0566 會還原焦點）。若塔台分頁不是使用者正在打字的分頁，焦點可能被搶到塔台分頁的 xterm；建議在 B0 工單一併實測，必要時另開 BUG。
- issue #24 提到的「Worker 提示音 C `towerReply`」不在本 repo，是回報者本機建置的功能。

### 回報時間
2026-11-25T03:15:22+08:00
