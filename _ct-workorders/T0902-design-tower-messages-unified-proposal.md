---
schema_version: 1
schema_kind: workorder
id: T0902
title: "設計（PLAN-068 / GitHub #24 ＋ #23）：塔台訊息不被淹沒、不被擠走、不混進草稿 —— BAT ＋ CT 一次到位的整合提案（右側欄分頁、強制版本對齊）"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P2
sizing: M
created_at: "2026-11-25T03:19:48+08:00"
started_at: "2026-11-25T03:20:41+08:00"
updated_at: "2026-11-25T03:28:30+08:00"
completed_at: "2026-11-25T03:28:30+08:00"
depends_on: [T0901]
related:
  - "PLAN-068；T0901（研究，回報區全部沿用為輸入）；GitHub #24、#23（`gh issue view 23|24 -R gowerlin/better-agent-terminal`，唯讀）；D327（使用者 2026-11-25 裁示）"
  - "CT 立場草案 BMad-Guide `_reply-2026-11-25-tower-user-inbox-issue24.md`（`1d2692f`、CT D866，DRAFT；唯讀，不得寫入）"
  - "T0788 / T0607 / T0701 / T0735 / T0762 / T0590 / T0600 / T0621（D158）"
affects_files:
  - _ct-workorders/T0902-design-tower-messages-unified-proposal.md
renew_count: 0
session_ids:
  - "d4f61385-641e-4e1d-8d36-2918581210a8"
互動模式: disabled
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 唯讀設計研究：只寫本工單檔（`git commit --only _ct-workorders/T0902-design-tower-messages-unified-proposal.md`）。不改產品程式、不開 BUG / PLAN、不改 `_ct-workorders/_*`、不在 GitHub 留言或重開 issue、不 push、不寫 BMad-Guide repo、不傳訊給 CT 塔台（回覆 CT 由塔台在使用者核定後做）。原型 / 量測腳本只放 scratchpad 並在收尾刪除。"
  - "🔴 實測只用隔離環境：要重現 #23 或驗證 T0901 的「待實機」項目時，只用隔離實例（`e2e/fixtures/electron-isolation.ts` 的 `launchIsolated`、`--runtime=e2e-…`）或空的 `CLAUDE_CONFIG_DIR`；不得以預設實例啟動 source build；不碰使用者正在用的 BAT（安裝版 `0.8.0-pre.2`）與其 userData / Terminal Server / `bat-pty-holder`；不開會耗 token 的 claude / codex turn（需要真實回合的項目寫「待實機」）。worktree 不需要：在主 checkout 唯讀即可，若要 build 用 scratchpad 的 `git worktree add --detach`（收尾 `git worktree remove`），不得改主 checkout 的檔案。程序清理照 D308。"
  - "🔴 隱私（公開 repo，D176）：回報區不貼權杖、env 值、PTY 內容、對話內容、家目錄（寫 `<使用者資料夾>`）、真名；issue 回報者寫「issue #23 / #24 回報者」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0902 — 設計：塔台訊息的一次到位整合提案

## 使用者裁示（2026-11-25，D327）

1. **不拆成「BAT 先做、CT 後做」**：A（待你決定）、B0（送通知不搶捲動）、B（閱讀保護）、#23 草稿保護、C（回合訊息卡）、D（顯示位置）、回答路徑、文件 —— **全部一起考慮**，出**一份一次到位的最佳提案**。
2. **強制版本對齊**：BAT 與 CT 以同一份契約版本一起發佈；不設計「新 BAT 配舊 CT」或「舊 BAT 配新 CT」的半套行為。提案要定義怎麼偵測版本不符（例：契約版本欄位、`summary_version` 或新的 `inbox_contract` 值、helper / BAT MCP 回報的能力旗標），不符時**整個功能停用並清楚提示需要的版本**，而不是部分運作。
3. **顯示放 BAT 既有的右側欄**：右側欄目前有「程式碼片段 / Skills / Agents / »」分頁（使用者截圖），在這裡新增分頁（名稱由你提，例「塔台」），放待決清單與回合訊息卡；不另開分割窗格。
4. **先不回覆 CT**：本單產出經使用者核定後，塔台再把定案提案送給 CT。
5. **issue #23 重新評估**：GitHub 已關閉但本 repo 沒有實作；重新評估問題本身（現在的 BAT 是否仍會發生、成因是否如 issue 所述、與 T0788 / B 閱讀保護的關係），把解法併入本提案。

## 輸入

- **T0901 回報區全部**（`_ct-workorders/T0901-research-tower-user-inbox-issue24.md`）：現況盤點、B0 的新發現（helper submit Enter 走 xterm 使用者輸入路徑 → `scrollOnUserInput` 拉回底部、清選取、`terminal.focus()`）、claude fullscreen Auto-scroll、C 的 `Stop` hook `last_assistant_message`、codex 限制、CT 草案逐點表態與 (a)(b)(c)、保留規則。T0901 用的是 claude 2.1.316 字串，**現在內嵌是 2.1.331（T0891）**，相關結論要以 2.1.331 重新確認。
- **CT 立場草案**（唯讀）：`awaiting_user`、工單 `waiting_user`、CT 只寫待決、只留未決、回答一行 `U-n：…`、`user_inbox: off`、回覆結尾重列 `⏸ 待你決定：…`。
- **issue #23**：塔台 `idle` 時 Worker 通知 `pty:write` 直接寫進 Claude 輸入框、接在使用者草稿後面，再被 submit Enter 一起送出；另有寫入與 Enter 之間 250 ms 的窗口。

## 要產出的提案（回報區）

1. **#23 重新評估**：在現行程式（`v0.8.x` / `main` 的 `electron/handlers/pty.ts`、`electron/notify-hold.ts`、`scripts/bat-notify.mjs`、`TerminalPanel.tsx`）上確認是否仍會發生與成因；BAT 怎麼知道「塔台輸入框有草稿」（claude 輸入框的狀態 BAT 看不到：可行的信號有哪些、可靠度、claude / codex 差異）；250 ms 窗口怎麼處理。能在隔離實例重現就附重現紀錄，不能就寫「待實機」與理由。
2. **整合設計**（一份，不分 Phase）：
   - 使用者看到什麼：右側欄分頁的版面（ASCII 示意）、塔台縮圖 / 工作區列表的標示、終端內的行為（不被拉走、不混草稿）、回答怎麼送。
   - 每個元件的規則：待決清單（A）、回合訊息卡（C）、送通知的保護（B0 / B / 草稿）、回答路徑、文件提示。
   - 清單維護與保留（沿用或修正 T0901 的預設值，寫明理由）。
   - claude-cli 塔台、Claude 面板塔台、codex 塔台各自能用到哪些部分；codex 缺的部分在強制版本對齊下怎麼呈現（例：CT 契約讓 codex 也能有卡片？或明確標示 codex 只有待決清單）。
   - 遠端（WSL / SSH / Docker）與 detached 視窗的行為。
   - 隱私：每種內容存哪、保留多久、日誌記什麼。
3. **BAT ↔ CT 契約 v2 草案**（強制版本對齊）：
   - CT 要寫什麼（以 CT 草案為基準逐點同意 / 修改，含 T0901 提的 1″ 選項代號格式）、BAT 讀什麼、欄位型別與必填。
   - 版本對齊機制：版本欄位、雙方怎麼偵測對方版本、不符時各自的行為與提示文字、BAT 最低版號與 CT 最低版號怎麼寫進 README 版本對照表。
   - 需要放寬或修改的既有規則（例：T0590「hook 不送 payload 內容」、D158 codex 限制、T0788 的觸發條件）逐條列出、說明理由與風險，交塔台與使用者決策。
4. **實作拆單建議**：BAT 端工單清單（範圍、依賴、驗收、預估規模）與 CT 端要做的事；哪些可平行。
5. **待實機清單**：無法在隔離環境驗證、需使用者實機確認的項目。

## 驗收

- [ ] #23 重新評估（現況、成因、信號可行性）
- [ ] 一份整合設計（不分 Phase），含右側欄分頁示意
- [ ] 契約 v2 草案與版本對齊機制
- [ ] 需放寬的既有規則清單
- [ ] 拆單建議與待實機清單

## 塔台補充（執行中 #1）

**時間**：2026-11-25T03:22:30+08:00

使用者補充：**右側欄分頁要連同 TODO List 或其他需長期追蹤、需要注意的清單一起設計考量**，不只塔台訊息。

**新指示**（範圍擴大，仍是唯讀設計）：

- 右側欄分頁的資訊架構要能容納多種「長期追蹤」清單，與待決清單、回合訊息卡一起規劃（分區、摺疊、排序、未讀 / 數量標示、篩選，每類清單的來源與更新方式）。候選來源（請盤點哪些已有資料可讀、哪些要 CT 寫、哪些不值得放）：
  - CT `_tower-state.md` frontmatter `todo`（目前總覽只顯示前 5 則，T0701）與 `next_ids`
  - 未結 BUG（`_bug-tracker.md` / `BUG-*.md`）、進行中 PLAN（`_backlog.md` / `PLAN-*.md`）、派工中 / 非終態工單
  - 「待實機驗收」「待使用者執行」類事項（例：NSIS 重裝驗收、各 BUG 的待驗收清單）—— 目前散在工單回報區與 tower-state 文字裡，評估是否需要 CT 以結構化欄位提供
  - 定期事項（例：PLAN-067 每週日誌清查的 `last_review_at` 到期提示）
  - Worker 狀態（等使用者 ⚠️ / 等塔台 ? / 已回報 ✓ / 待送 📨，既有 attention 資料）
- 與既有「指揮塔總覽」（T0701）的關係：右側欄分頁是取代、延伸、還是並存？避免兩處各顯示一半。
- 若需要 CT 提供新的結構化欄位（例：待驗收、使用者待辦），一併放進〈契約 v2 草案〉並遵守強制版本對齊；欄位大小與 `_tower-state.md` 大小預算一起評估。
- 版面示意（ASCII）要呈現多種清單同時存在時的樣子。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（設計研究；五項驗收產出齊全，未改產品程式）
- **session_id**：d4f61385-641e-4e1d-8d36-2918581210a8
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（主 checkout，`CT_HOME` 未設）；C-1 工單在 REPO_ROOT 之下；C-3 `affects_files` 只有本工單 → not applicable；C-2 無 `branch` 欄位（HEAD = `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；BAT helper env 齊全（`BAT_REMOTE_TOKEN` 已設定）。
- **證據分道**：原始碼 / 文件 / 二進位字串的靜態查證。claude **2.1.331** 二進位以 `npm pack @anthropic-ai/claude-code-win32-x64@2.1.331` 取到 scratchpad（主 checkout 與安裝版 `0.8.0-pre.2` 的內嵌 claude 都還是 2.1.316；2.1.331 只在 `v0.8.x` 的 `package.json`）。沒有 build、沒有啟動任何 BAT 實例、沒有開 claude / codex 回合；需要實機的項目列在〈待實機清單〉。
- **commit**：只有本工單檔（`git commit --only`），不 push。scratchpad 的 claude 二進位與字串腳本收尾刪除。

### 互動紀錄
- [03:20] 開工；yolo。設計取捨都在工單範圍內，以「建議＋替代方案」寫進〈需放寬或修改的既有規則〉交塔台與使用者裁示，未向塔台提問。
- [03:22 後] 📥 塔台補充（執行中 #1）於〈跨 session 通知（額外節點）〉讀到 → 右側欄分頁改為「多種長期追蹤清單」的資訊架構：盤點 `todo` / `next_ids`、`_bug-tracker.md`、`_backlog.md`、非終態工單、待驗收、PLAN-067 定期事項、Worker attention 的現有資料；與指揮塔總覽（T0701）的分工；CT 新結構化欄位（`user_actions`、`reminders`）併入契約 v2 與大小預算；版面示意改為多區塊同時存在。
- [03:25] 填回報前節點檢查〈塔台補充〉：沒有新段落。

### 調查結論

#### 1. issue #23 重新評估

**結論：現在的 BAT（`main` 與 `v0.8.x`）仍會發生，成因與 issue 所述相同，另有兩點 issue 沒寫到。**

| 項目 | 查證（`main`，`v0.8.x` 這幾個檔與 `main` 相同） |
|---|---|
| 保留條件 | `electron/handlers/pty.ts` `pty:write`：只有 `deps.notifyHold.interceptWrite` 回傳非 null 才保留；`NotifyHoldController.holdReason`（`electron/notify-hold.ts`）只在佇列非空或 `getBlockedState` 的 reason ∈ `NOTIFY_HOLD_REASONS`（`permission` / `question` / `elicitation` / `input`）時保留。塔台 `idle` / `working` → `writeWithResult` 直接寫進 PTY。✅ 與 issue 相同 |
| 寫入形狀 | `scripts/bat-notify.mjs`：`pty:write`（文字、不含 `\r`）→ `sleep(SUBMIT_KEYPRESS_DELAY_MS = 250)` → `terminal:keypress`；Enter 由塔台視窗的 xterm 產生（`TerminalPanel.tsx` `dispatchEnter` → `dispatchSyntheticEnterKeydown`）。✅ 與 issue 相同 |
| issue 沒寫到 ① | 不只 `idle`：塔台 `working` 時使用者先打字（claude 的 type-ahead，二進位有 `isTypedAhead`），通知一樣接在後面、被同一個 Enter 送出。保留條件與塔台忙不忙無關，**只與輸入框有沒有字有關**。 |
| issue 沒寫到 ② | 250 ms 窗口是雙向的：使用者在窗口內打的字會一起送出（issue 已寫）；使用者在窗口內按 Enter 會先把通知文字（加上草稿）送出，接著 helper 的 Enter 再送一次空行或使用者剛開始打的新字。 |
| 與 T0788 的關係 | T0788 解決「Enter 替使用者回答對話框」，判斷依據是 hook / OSC 的 `blocked`；#23 的依據是「輸入框有沒有使用者的字」，`TerminalBlockedTracker` 完全沒有這個資訊。兩者共用同一個佇列與送出程序最自然（issue 的提案也是）。 |
| 與 B（閱讀保護）的關係 | 不同的保護對象：B 保護「畫面位置」（延後有上限），#23 保護「使用者的輸入內容」（不能有上限，見 issue 決策 1 (a)）。同一個佇列、不同 reason、不同送出條件。 |
| GitHub 狀態 | #23 `CLOSED`（2026-11-24，無留言），本 repo 沒有任何實作（`git log --all -S "'draft'" -- electron/notify-hold.ts electron/handlers/pty.ts` 無結果）。建議塔台決定：重開並連結本提案，或在 #24 一併回覆（本單不動 GitHub）。 |

**重現**：沒有在隔離實例重現。理由：要讓 claude 停在可輸入的提示列，需要登入（隔離實例＋空的 `CLAUDE_CONFIG_DIR` 只會停在登入畫面）；登入即碰使用者帳號、送出即耗 token，都在本單禁止範圍內。成因是確定性的程式路徑（PTY 寫入一律接在 line editor 的游標後），程式碼證據已足夠；實機重現列入〈待實機清單〉T-1。

**BAT 怎麼知道「輸入框有草稿」—— 可行信號比較**

| 信號 | 位置 | claude-cli | codex | 可靠度 | 評估 |
|---|---|---|---|---|---|
| **S1 按鍵追蹤**：使用者送進該 PTY 的位元組（`pty:write` 的 `fromUser` 路徑）推估輸入框狀態 | host（`electron/handlers/pty.ts`，本機視窗與 headless client 都經過；遠端照樣成立） | ✅ | ✅ | 中：游標移動後刪字、↑ 叫出歷史、Tab 補完、`/` 選單都可能誤判。**採保守規則**：只要出現「Enter / Ctrl+C 以外的使用者輸入」就視為有草稿，只有 `\r`（不在 bracketed paste 內）與 Ctrl+C 清除 → 誤判只會「多保留」，不會「多送」 | **採用（主信號）** |
| S2 讀畫面：解析 xterm buffer 裡 claude 提示列（`> …`）是否為空 | renderer | 可行但脆弱（框線、提示文字、fullscreen 版面隨 CLI 改版） | 版面不同 | 低～中 | 只當**放行輔助**：S1 判有草稿、但畫面明確是空提示列時，在「📨 待送」顯示「看起來已清空 —— 立即送出」按鈕，不自動放行 |
| S3 claude hooks | — | `UserPromptSubmit` 只在送出時觸發；沒有「輸入框編輯」事件 | — | — | 不可用 |
| S4 OSC 7501 | — | 2.1.331 只有 `idle` / `working` / `blocked` / `clear` 與探詢（`probe: no reply to OSC 7501 ; ?`），沒有草稿狀態 | 同 | — | 不可用 |
| S5 claude channels（MCP 推訊息進 session，不經輸入框） | — | 2.1.331 有 `--channels <servers…>`（隱藏旗標）。限制：伺服器須在核准清單，否則要 `--dangerously-load-development-channels`（啟動時跳確認對話框）；第三方 provider 不支援；可被 org policy（`channelsEnabled`）關閉；「channels feature is not currently available」顯示有服務端開關 | 無 | 可用性不確定 | **本提案不採用**：它是「寫進 session」的通道，與 BAT MCP 全唯讀政策（D155 / D156）衝突，且對未核准的伺服器每次啟動都要確認；列為長期研究（見〈建議方向〉§9） |

**250 ms 窗口的處理**：host 讓 helper 的「文字＋Enter」成為原子操作 —— 每個 helper 通知一律經 `NotifyHoldController` 送出（沒有要保留時也走它的 pass-through，不排隊、不延後），送出文字到 Enter 抵達 PTY 之間（以收到該視窗 `{ auto: true }` 的 `\r` 為準，最多 1 s），同一分頁的使用者輸入由 host **暫存**、Enter 之後原樣補寫（使用者感受到的是 ≤ 250 ms 的打字延遲）。這比「縮短 250 ms」可靠：250 ms 是給 TUI 處理文字的時間（T0788 / bat-notify 的既有常數），不能拿掉。

#### 2. 「讀到一半被拉走」與 claude 2.1.331 重新確認

T0901 的結論以 2.1.331 二進位重新查證，**全部仍成立**：

| 項目 | 2.1.331 |
|---|---|
| `Stop` hook `last_assistant_message` | ✅ 仍有，描述「Text content of the last assistant message before stopping. Avoids the need to read and parse the transcript file.」；2.1.331 另多 `background_tasks`（進行中的背景工作），與本案無關 |
| fullscreen `autoScrollEnabled` | ✅ 仍有，「Auto-scroll the conversation view to bottom (fullscreen mode only)」 |
| `repin` 的閘門 | ✅ `repin=(h=!1,v)=>{if(!h&&!vl("autoScrollEnabled",!0).value)return; … scrollToBottom()}`。非強制的 `typedIntoEmpty`（空輸入框被打字）、`ownSubmitLanded` / `rowLanded`（送出的列出現）在關掉 Auto-scroll 時**不拉回**。強制（`!0`）只有 `rewind`、`agent-view-change`、`dialog`、`dialogLeft` —— Worker 通知都不屬於這些。⇒ fullscreen ＋關 Auto-scroll，claude 端不會因通知拉回畫面 |
| BAT 自己造成的拉回（B0） | 程式碼未變：`dispatchEnter` 以合成 keydown 走 xterm 使用者輸入路徑 → `scrollOnUserInput` 拉回底部、清選取、`terminal.focus()`。xterm 5.5.0 的公開 API `terminal.input(data, wasUserInput)`：`wasUserInput: false` 時「不當成使用者輸入」（不捲動、不清選取、不搶焦點），且 xterm 5.5 的 Enter 鍵本來就只產生 `\r`（5.5 沒有 kitty / win32-input 鍵盤協定）⇒ **B0 可改用 `terminal.input('\r', false)`**，位元組相同、沒有副作用（待以真 xterm 單元測試確認，見拆單 W1） |

#### 3. 右側欄現況與長期追蹤清單的資料盤點（塔台補充 #1）

**右側欄**：`App.tsx` 的 dock 系統，`DockablePanel`（`src/types/index.ts`）= `files` / `git` / `git-graph` / `github` / `snippets` / `skills` / `agents` / `control-tower`；`DEFAULT_DOCKING_CONFIG` 中 `snippets` / `skills` / `agents` / `control-tower` 預設在右側（使用者截圖的「程式碼片段 / Skills / Agents / »」，指揮塔在 » 裡）。新增一個 `DockablePanel` 值、預設 `right` 即可；`loadDockingConfig` 對存檔缺少的鍵補預設值，舊存檔不需遷移。

| 候選清單 | 現有資料 | BAT 現在怎麼讀 | 要 CT 寫新東西？ | 放進新分頁？ |
|---|---|---|---|---|
| CT `todo` | `_tower-state.md` frontmatter（本 repo 目前 7 則，多則 > 200 字） | 總覽只顯示前 5 則（`TOWER_STATE_TODO_LIMIT`） | 否 | ✅ 全部列出（摺疊長文） |
| `next_ids` | 同上 | 總覽 | 否 | ❌ 只是編號，不是要人處理的事；留在總覽 |
| 待你決定（A） | 沒有 | — | **是**：`awaiting_user`（CT 草案） | ✅ 第一區 |
| 待你執行 / 待實機驗收（NSIS 重裝驗收、各工單的「待實機」、需使用者手動的步驟） | 散在 `todo` 文字、工單回報區、`_tower-state.md` 本文 | 無結構 | **是**：新欄位 `user_actions` | ✅ 第二區 |
| 待驗收 BUG（`FIXED` / `VERIFY`） | `_bug-tracker.md` 的 `## ✅ 已修復` / `## 🧪 驗收中` 區段 | 指揮塔 Bugs 頁（`parseBugTracker`） | 否 | ✅ 併入第二區（來源標「BUG」），點擊開指揮塔 Bugs 頁 |
| 未結 BUG（`OPEN` / `FIXING`） | 同上 | 指揮塔 Bugs 頁 | 否 | ⚠️ 只放數量列＋連結，不重複清單 |
| 進行中 PLAN | `_backlog.md`（`parseBacklog`） | 指揮塔 Backlog 頁 | 否 | ⚠️ 只放數量列＋連結 |
| 非終態工單 | `T*.md` frontmatter | 指揮塔工單頁 | 否（`waiting_user` 是 CT 新欄位） | ⚠️ 數量列；`waiting_user` 的工單在第一區該筆旁顯示 |
| 定期事項（PLAN-067 每週日誌清查） | `PLAN-067` frontmatter `last_review_at` / `review_interval_days`，規則在本專案 `_local-rules.md` | 無 | **是**：通用欄位 `reminders`（BAT 不能去讀某個專案特定 PLAN 的私有欄位） | ✅ 只顯示到期 / 逾期 |
| Worker 狀態（⚠️ / ? / ✓ / ↻ / 📨 / ⏸ 被中斷） | renderer 既有 store（`terminal-attention-store`、`notify-hold-store`、`interrupted-agents-store`） | 縮圖、工作區列表 | 否 | ✅ 只列「需要你」的（⚠️ 等使用者、📨 待送、⏸ 被中斷），? / ✓ / ↻ 是塔台的事，不列 |
| 決策日誌、sprint | 指揮塔 | 指揮塔 | 否 | ❌ 瀏覽用，不是待辦 |

**大小提醒**：本 repo `_tower-state.md` 現在 37,466 bytes，已超過本專案 30 KB 軟警告；新欄位在 frontmatter，CT 的大小預算要把 frontmatter 一起算（見契約 §3.4）。BAT 端讀取上限 512 KiB 沒有壓力。

### 建議方向

> 一份一次到位的設計（不分 Phase）。BAT 與 CT 以「BAT ↔ CT 契約 v2」同版發佈；分頁整體依契約版本啟用或停用。

#### §1 使用者看到什麼

**右側欄新分頁「待辦」**（id `inbox`，英文 `Inbox`；名稱交使用者決定，其他候選：「塔台」「需要你」。建議「待辦」：內容不只塔台訊息，還有 BUG 驗收、定期事項、Worker 等你）。分頁標題的數字 = 需要你動手的件數（待你決定＋待你執行＋到期提醒＋Worker 等你）；回合訊息卡的未讀數另外顯示在該區標題，不算進分頁數字（僅告知不該催人）。

```
┌ 程式碼片段 │ Skills │ Agents │ 待辦 (5) │ » ┐
│ 塔台：Claude CLI · Tower  ▾   [契約 v2 ✓]    │  ← 有多個塔台時可切換；版本不符時這裡是說明（§6）
├──────────────────────────────────────────────┤
│ ⏸ 待你決定 (2)                          ▾   │
│  U-3  T0901  研究結論二選一：收件匣或回合卡片 │
│       ○ A 收件匣  ○ B 回合卡片  [送出]       │  ← 送出 = 對塔台分頁送一行「U-3：B」
│       ⏸ T0901 暫停中 · 12 分鐘前              │
│  U-5  —      要不要升 0.8.1？   [自由回答…]   │
├──────────────────────────────────────────────┤
│ 🙋 待你執行 (2)                          ▾   │
│  A-2  v0.8.0-pre.2 NSIS 重裝驗收  [複製指令]  │
│       [完成] [失敗…]                          │  ← 送「A-2：完成」/「A-2：失敗 <說明>」
│  BUG-218 待驗收（FIXED）→ 開啟               │  ← 來自 _bug-tracker.md，不需 CT 寫
├──────────────────────────────────────────────┤
│ ⏰ 到期提醒 (1)                               │
│  每週日誌清查 · 逾期 2 天（上次 11-18）        │
├──────────────────────────────────────────────┤
│ 👷 Worker 等你 (1)                            │
│  ⚠️ T0905 權限確認 → 切到分頁                 │
│  📨 塔台待送 2（你在輸入 / 你在閱讀）[立即送出]│
├──────────────────────────────────────────────┤
│ 💬 塔台訊息  3 未讀              [全部已讀] ▾ │
│  📌 03:20 T0905 回報總結…                     │
│  ●  03:24 T0906 完成；下一步…  ⏸ 待你決定：U-3│  ← 「⏸ 待你決定：」行加亮（只當提示）
│  ●  03:25 派 T0907…                           │
│     03:10 T0904 …（已讀）                     │
├──────────────────────────────────────────────┤
│ 📋 塔台待辦 (7)                         ▸   │  ← 預設摺疊；CT `todo` 全部
│ 📊 BUG 未結 4 · PLAN 進行中 3 · 工單 2 → 指揮塔│  ← 只是數量＋連結
└──────────────────────────────────────────────┘
```

- **分區順序固定**（由「一定要人處理、會擋流程」到「參考」）；每區可摺疊、記住摺疊狀態（localStorage，只是個人偏好）；空的區塊只留一行標題（「⏸ 待你決定（無）」），不隱藏，避免使用者以為功能壞了。
- **排序**：待你決定 / 待你執行依 `created_at` 舊 → 新（最久的最上面）；塔台訊息新 → 舊；到期提醒依逾期天數。
- **篩選**：上方塔台選擇器（只在同工作區有 > 1 個已宣告塔台時出現）；不做全文搜尋（清單短，不值得）。

**塔台縮圖 / 工作區列表**：塔台分頁縮圖多一個 `⏸2` （待決數）與既有的 `📨N`；工作區列表在既有 ⚠️ 徽章旁顯示 `⏸2`。卡片未讀數（`💬3`）只在縮圖上、不進工作區列表（同上：僅告知不催人）。

**終端內的行為**：
- Worker 通知送進塔台時，**畫面不動、選取不清、焦點不跳**（B0）。
- 塔台輸入框有你打到一半的字 → 通知**不會**混進去，「📨 待送 N（你在輸入）」等你送出或清掉（#23）。
- 你往上捲 / 選取 / 滾輪時 → 通知延後，停手 10 s 送出，最長 60 s（B）。
- 分頁內提示：塔台分頁第一次宣告時，「待辦」分頁頂端顯示一次「建議：`/tui fullscreen` ＋ `/config` 關 Auto-scroll」（文件連結），不自動改 claude 設定。

**回答怎麼送**：待辦分頁按鈕 → 對塔台分頁送一行純文字（`U-3：B`、`A-2：完成`），與手打完全相同；送出前走同一個保留佇列（§2.4）。使用者也可以直接在塔台分頁手打，結果一樣。

#### §2 每個元件的規則

**2.1 待你決定（A，`awaiting_user`，CT 擁有）**：BAT 唯讀，沿用指揮塔的讀取管線（`readCtFile`、`fs.watch`、遠端 proxied）。某筆從檔案消失 = 已結；BAT 記憶體保留最近 10 筆已結（id＋最後 summary，只本次啟動）供「最近已結」摺疊區。工單列表與該筆旁顯示 `⏸`（讀工單 frontmatter `waiting_user`）。

**2.2 待你執行（`user_actions`，CT 擁有；待驗收 BUG 由 BAT 從 tracker 讀）**：CT 寫「要使用者親手做的事」（實機驗收、NSIS 重裝驗收、要使用者在 BAT 外執行的指令）。`command` 欄位只有「複製」按鈕，🔴 BAT 永遠不執行。完成 / 失敗按鈕送 `A-n：完成` / `A-n：失敗 <說明>`。

**2.3 回合訊息卡（C，BAT 擁有）**：
- 來源：claude-cli 已宣告塔台分頁的 `Stop` hook `last_assistant_message`（host 只收已宣告塔台的，其他分頁收到即丟、不記內容）；Claude 面板塔台直接取面板的最後助理訊息。
- 每回合一張；遮罩（`redactTerminalSecrets`）後最多 16 KiB，超過截斷並標示；內容只在 host 主行程記憶體。
- 狀態：未讀 → 已讀（展開或「全部已讀」）；可釘選（📌，置頂、不被上限擠掉）。
- 以 `⏸ 待你決定：` 開頭的行加亮，**只是提示**，不解析成資料（資料只來自 frontmatter）。

**2.4 送通知的保護（B0 / #23 / B）與回答路徑 —— 同一個佇列**

`NotifyHoldController` 擴充為「塔台分頁的唯一寫入閘門」：所有 helper 通知與待辦分頁的回答都經它，依 reason 決定保留或送出。

| reason | 觸發（判斷在 host） | 放行條件 | 上限 | 擋誰 |
|---|---|---|---|---|
| `permission` / `question` / `elicitation` / `input`（T0788，不變） | hook / OSC `blocked` | 離開 blocked ＋安靜 1 s | 不設（D228） | helper 通知、回答 |
| **`draft`**（#23） | S1：最後一次 Enter / Ctrl+C 之後，該分頁有其他使用者輸入 | 使用者 Enter（送出自己的訊息）或 Ctrl+C → 安靜 1 s；或使用者按「立即送出」 | **不設**（issue 決策 1 (a)：混進草稿比延後更難補救）；保留滿 5 分鐘發一次系統通知提醒 | helper 通知、回答（回答被擋時面板提示「塔台輸入框有未送出的文字」） |
| **`reading`**（B） | renderer 回報：normal buffer `viewportY < baseY`、有選取、或最近 10 s 有滾輪 / PageUp / Shift+PageUp（fullscreen 時 BAT 看不到 claude 內部捲動，只能看滾輪事件） | 停手 10 s | **60 s**（延後的代價只是畫面被動到，不會作答對話框；與 D228 不同） | 只擋 helper 通知；🔴 不擋使用者自己的回答 |

- **原子送出（250 ms 窗口）**：見調查結論 §1。
- **B0**：helper 與回答的 Enter 一律以 `terminal.input('\r', false)` 產生（取代合成 keydown＋`terminal.focus()`）：不捲動、不清選取、不搶焦點；仍寫 `{ auto: true }`（helper 通知不算使用者輸入，T0788 第 9 點不變）。待辦分頁的「回答」的 Enter 則**算**使用者輸入（不帶 `auto`，與手打相同）。
- **「📨 待送」選單**：多「立即送出」（issue 決策 2）與保留原因；回答項目顯示「你的回答 U-3」，可取消。
- **回答路徑**：待辦分頁 → 新的 renderer IPC `tower-inbox:answer { terminalId, text }`（遠端視窗為 proxied channel，送到該視窗連線的 bat-server）。🔴 **不加進 `HELPER_CHANNEL_ROLES`**：Worker / 塔台的 PTY 權杖都不能呼叫，避免 agent 冒充使用者作答。文字限單行、≤ 1,000 字、只送 `^[UA]-\d+：` 開頭（防止面板變成任意輸入通道）。目標分頁 = 該 `_tower-state.md` 所屬工作區中已宣告的塔台；剛好一個直接送，零個或多個讓使用者選。

**2.5 文件提示**：說明頁新增「塔台分頁的建議設定」（fullscreen、關 Auto-scroll、`/focus`）與「待辦分頁」說明；BAT 不注入 `CLAUDE_CODE_NO_FLICKER`、不改 claude 設定。

#### §3 清單維護與保留

| 清單 | 誰寫 / 誰清 | 保留 | 跨 BAT 重開 | BAT 端狀態 |
|---|---|---|---|---|
| 待你決定 | CT 寫；回答 / 撤銷時 CT 同一次寫入移除＋決策日誌 | 只留未決，永不自動過期 | ✅（檔案） | 「看過」只存 `U-n` id（localStorage）；最近已結 10 筆（記憶體） |
| 待你執行 | CT 寫；使用者回 `A-n：完成` 後 CT 移除＋決策日誌（失敗則 CT 改寫或開 BUG） | 只留未完成 | ✅ | 同上 |
| 待驗收 BUG | BAT 讀 tracker；CT 照既有 BUG 流程維護 | — | ✅ | 無 |
| 到期提醒 | CT 寫 `reminders`、做完更新 `last_at` | 永久項目（CT 管） | ✅ | 無 |
| 塔台訊息卡 | BAT host 記憶體 | 每個塔台分頁最近 **30** 張；釘選另計、最多 **10** 張；單張 16 KiB | ❌ 不保留（T0901 預設值沿用：不新增 BAT 存檔；從 claude transcript 重建依賴內部格式，暫不做） | 已讀 / 釘選在 host（多視窗一致，比照 T0749 attention 對帳） |
| Worker 等你 | 既有 attention / notify-hold / interrupted 資料 | 既有規則 | 既有規則 | 既有 |
| 塔台待辦 `todo` | CT | CT 既有規則 | ✅ | 摺疊狀態 |

T0901 預設值沿用不改（30 / 10 / 16 KiB / 最近已結 10 筆），理由：沒有新的量測推翻它們；`awaiting_user` 由 50 筆畫面防呆改為「> 50 筆只畫前 50＋另有 N 筆」不變。PTY 結束 / ⏻ / Terminal Server recovery 清空卡片（同 T0607 / T0788 的生命週期）。

#### §4 三種塔台各能用到什麼

| 元件 | claude-cli 塔台 | Claude 面板塔台 | codex 塔台 |
|---|---|---|---|
| 待你決定 / 待你執行 / 到期 / 待辦 / BUG / Worker 等你 | ✅ | ✅ | ✅（與 agent 無關，都來自檔案或 BAT 既有狀態） |
| 回答按鈕 | ✅ | ⚠️ 面板沒有 PTY，回答改送進面板的輸入（T0815 的排隊路徑，`claude:send-message`），草稿保護改看面板輸入框（renderer 直接知道，不需推估） | ✅ |
| B0 / #23 / B 保護 | ✅ | 不適用（helper 通知只寫 PTY；面板塔台本來收不到 bat-notify） | ✅（codex 輸入框同樣是 line editor；Enter / Ctrl+C 規則相同） |
| 回合訊息卡 | ✅（Stop hook） | ✅（面板訊息） | ❌ |

**codex 缺卡片的呈現**（強制版本對齊下不做半套）：卡片區在 codex 塔台時固定顯示一行「codex 塔台沒有回合訊息卡：BAT 不讀取 codex 的對話內容（D158）。待你決定與待你執行不受影響。」不嘗試其他來源。理由：可行的路（BAT 注入 codex `-c notify`、讀 `$CODEX_HOME/sessions/` rollout、解碼 OSC 7501 `msg`）都違反 D158 或依賴內部格式；而且 codex 的 `notify` 只能設一個程式，BAT 注入會覆蓋使用者自己的設定。也**不**請 CT 為 codex 把總結寫進檔案（CT 草案第 3 點的分流理由：僅告知寫進 frontmatter 會讓檔案一直變大）。若使用者要 codex 卡片，需另開研究並裁示放寬 D158（列在 R4）。

#### §5 遠端（WSL / SSH / Docker）與 detached 視窗

- **檔案類清單**（待決 / 待執行 / 到期 / todo / BUG / PLAN）：沿用指揮塔的讀取（遠端工作區經 proxied 讀遠端檔案、`fs.watch`），不新增 channel。
- **卡片**：hook 在遠端 host 執行 → 內容只在 bat-server 記憶體；本機視窗以新的 proxied channel `tower-cards:list` ＋事件 `tower-cards:changed` 讀取，重連後對帳（同 T0749 `registerAttentionSnapshotHandler` 的作法）。不進 `HELPER_CHANNEL_ROLES`。
- **保護**：`draft` 在 host 的 `pty:write` 判斷 → 遠端 headless 同樣成立（headless 的 `isUserInput` = client 連線）；`reading` 是 renderer 信號 → 新 channel `terminal:reading-state { terminalId, reading }`（proxied，送到該分頁所在 host；只是一個布林，不帶內容）。
- **回答**：proxied `tower-inbox:answer` 送到 bat-server，由該 host 的 `NotifyHoldController` 送出。
- **detached 視窗**：dock 是每個視窗自己的；detached 視窗的待辦分頁只看自己的工作區，資料來源相同（檔案監看、host 記憶體的卡片）。主視窗工作區列表的 `⏸N` 經既有 `DetachedWaitingReporter` 路徑多帶一個數字。

#### §6 版本不符時（強制版本對齊）

分頁整體只有「契約相符」與「停用＋說明」兩種狀態；沒有部分運作。BAT 獨有的修正（B0、#23 草稿保護、B 閱讀保護）是 BAT 自己輸入路徑的問題，與 CT 契約無關，**不受此閘門影響**（見 R9，交使用者確認）。

| 情況 | BAT 待辦分頁 | CT 塔台 |
|---|---|---|
| BAT 契約 v2 ＋ CT 契約 v2 | 全部可用 | 正常寫入 |
| BAT 契約 v2 ＋ CT 舊版（`_tower-state.md` 沒有 `bat_contract` 或 < 2） | 只顯示：「待辦分頁需要 BMad Control Tower 6.1.0 以上（BAT ↔ CT 契約 v2）。這個專案的塔台狀態檔是契約 v1，請升級 CT 後重新開啟塔台。」＋ Portal 安裝頁連結 | 不知道 v2，照舊 |
| BAT 契約 v2 ＋ CT 更新的契約（`bat_contract` > 2） | 只顯示：「這個專案的塔台使用 BAT ↔ CT 契約 v<N>，這版 BAT 只支援 v2，請升級 BAT。」 | CT 依自己的規則判斷 BAT 太舊（下一列） |
| BAT 舊版（`--set-role tower` 沒有 `bat-contract:` 行）＋ CT 6.1.0 | 沒有待辦分頁（舊版本來就沒有） | 開工面板一行：「⚠️ BAT 不支援契約 v2（需要 BAT ≥ <版號>），待辦分頁不可用；待決事項仍會在每次回覆結尾重列。」CT 照常寫 v2 欄位（`waiting_user` 是 CT 自己派工判斷的狀態，不能因 BAT 版本停用） |
| `_tower-state.md` 沒有 frontmatter / 讀不到 | 顯示既有總覽的讀取錯誤文字 | — |
| CT 設 `user_inbox: off` | 顯示「這個專案的塔台已關閉待辦寫入（`user_inbox: off`）。」，卡片與 Worker 區照常（它們不來自 CT 檔案）—— 這是使用者自己的設定，不是版本不符 | 不寫 `awaiting_user` / `user_actions` |

### BAT ↔ CT 契約 v2 草案

**§3.1 版本欄位與偵測**

| 方向 | 機制 | 型別 / 必填 |
|---|---|---|
| CT → BAT | `_tower-state.md` frontmatter 新增 **`bat_contract: 2`** | 整數，契約 v2 必填；缺 = v1 |
| CT → BAT（只給訊息用） | `ct_version: "6.1.0"` | 字串，選填；BAT 只顯示、不比較 |
| BAT → CT | `bat-terminal.mjs --set-role tower …` 成功時 stdout 多一行 **`  bat-contract: 2`**（兩個空白縮排，同 helper 其他欄位）；BAT MCP `bat_whoami` / `terminal:whoami` 多 `contracts: { batContract: 2 }`、`batVersion` | 舊 BAT 沒有該行 / 欄位 = v1 |
| BAT 支援範圍 | 只支援 `bat_contract == 2`；之後的版本以整數遞增，BAT 宣告它支援的最大值 | — |

不升 `summary_version`（同意 CT 草案）：`summary_version` 是「總覽摘要」的格式，舊 BAT 對 ≥ 1 的版本照讀已知欄位；升它不會讓舊 BAT 停用任何東西，反而讓「版本不符」與「摘要格式」兩件事混在一起。`bat_contract` 是專門的對齊欄位。

**§3.2 CT 草案逐點表態（以 CT 草案為基準）**

| # | CT 草案 | 本提案 | 理由 / 修改 |
|---|---|---|---|
| 1 | `awaiting_user` 在 `_tower-state.md` frontmatter | ✅ 同意 | 見 §3.3 型別表 |
| 1′ | `next_ids.user: "U-4"` | ✅ 同意；另加 `next_ids.action: "A-3"` | `user_actions` 的編號 |
| 1″ | `options` 字串、回答 `U-3：B` | ⚠️ 修改：採 T0901 的 ①，**選項字串固定 `<代號> <說明>`**，代號 `^[A-Za-z0-9]{1,3}$`、同一筆內不重複；BAT 送 `U-3：<代號>` | 送出的行短、與手打一致；CT 只需一種解析。代號不符格式的選項 → BAT 該筆改顯示自由回答欄（不猜） |
| 2 | 工單 `waiting_user: "U-n"`、不派依賴它的工單 | ✅ 同意 | BAT 只顯示 ⏸ |
| 3 | CT 只寫待決；僅告知由 BAT 擷取卡片 | ✅ 同意 | §2.3 |
| 3′ | 回答時 CT 同一次寫入移除＋決策日誌 | ✅ 同意 | BAT 以消失判定已結 |
| 4 | 只留未決、≤ 0.5 KB、> 20 筆提示 | ✅ 同意 | 另見 §3.4 總預算 |
| 5 | 回答一行純文字、經 notify 路徑 | ✅ 同意一行純文字；路徑修改為 BAT 本機 / proxied IPC（不是 helper notify），進同一個保留佇列 | §2.4 |
| 6 | 隱私、`user_inbox: off` | ✅ 同意；`off` 也停用 `user_actions` | §6 |
| 7 | 回覆結尾重列 `⏸ 待你決定：…` | ✅ 同意，並擴充為「`⏸ 待你決定：U-3（T0901）…；🙋 待你執行：A-2（v0.8.0-pre.2 NSIS）`」 | 在任何終端都有效，與 BAT 版本無關；BAT 只加亮 |
| 新 | `user_actions` | 新增（塔台補充 #1） | 「待實機 / 待使用者執行」目前散在文字裡，BAT 讀不到 |
| 新 | `reminders` | 新增（塔台補充 #1） | 定期事項的通用欄位，取代 BAT 去讀 PLAN-067 私有欄位 |
| 新 | `bat_contract` / `ct_version` | 新增 | 強制版本對齊（使用者裁示 2） |

**§3.3 欄位（`_tower-state.md` frontmatter，契約 v2）**

```yaml
bat_contract: 2
ct_version: "6.1.0"
next_ids:
  user: "U-6"
  action: "A-3"
awaiting_user:
  - id: "U-3"
    workorder: "T0901"
    kind: "decision"
    source: "breakpoint-A"
    summary: "T0901 研究結論二選一"
    options: ["A 收件匣", "B 回合卡片"]
    created_at: "2026-11-25T03:10:23+08:00"
user_actions:
  - id: "A-2"
    title: "v0.8.0-pre.2 NSIS 重裝驗收"
    ref: "D324"
    kind: "verify"
    command: "pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\\manual\\nsis-reinstall-acceptance.ps1 -Version 0.8.0-pre.2"
    created_at: "2026-11-25T03:02:00+08:00"
reminders:
  - id: "weekly-log-review"
    title: "每週日誌清查"
    ref: "PLAN-067"
    last_at: "2026-11-18"
    due_at: "2026-12-02"
```

（上例 `command` 有反斜線：CT 6.0.1 字串規則要求單引號或改正斜線；此處只示意欄位，寫入時照 CT 規則。）

| 欄位 | 型別 | 必填 | BAT 處理 |
|---|---|---|---|
| `bat_contract` | 整數 | v2 必填 | 缺 / 非整數 → 視為 v1，分頁停用＋說明；> 2 → 停用＋「請升級 BAT」 |
| `awaiting_user[]` | 陣列 | 否 | 同 T0901 (a) 型別表（`id` `^U-\d+$` 必填、`summary` 必填、未知值照顯示、單筆錯誤只略過該筆並計數） |
| `awaiting_user[].options[]` | 字串陣列 | 否 | 每項 `<代號> <說明>`；有任一項不符 → 該筆改自由回答 |
| `user_actions[]` | 陣列 | 否 | `id` `^A-\d+$` 必填、`title` 必填（≤ 120 字）；`ref` / `kind`（`verify` / `run` / `manual`，未知照顯示）/ `command`（≤ 300 字，只複製）/ `created_at` 選填 |
| `reminders[]` | 陣列 | 否 | `id`（`^[a-z0-9-]{1,40}$`）、`title`、`due_at`（ISO 日期或日期時間）必填；`last_at` / `ref` 選填。BAT 只顯示 `due_at` 已到或 7 天內到期的；`due_at` 解析不了 → 該筆略過並計數 |
| `todo` | 字串陣列（既有） | 否 | 全部列出 |
| 工單 frontmatter `waiting_user` | 字串 `^U-\d+$` | 否 | 顯示 ⏸；不符格式不顯示 |
| 其他未知鍵 | — | — | 忽略 |

回答格式（CT 解析，BAT 只送）：`U-n：<代號或自由文字>`、`A-n：完成`、`A-n：失敗 <說明>`；全形冒號 `：`（CT 宜同時接受半形 `:`，手打時常見）。

**§3.4 大小預算**：`awaiting_user` ≤ 20 筆 × 0.5 KB、`user_actions` ≤ 20 筆 × 0.6 KB、`reminders` ≤ 10 筆 × 0.3 KB → 最壞約 25 KB，正常 < 5 KB。建議 CT 的 `_tower-state.md` 大小預算明確把 frontmatter 算進去，並在超過時優先整理 `todo` 長文（本 repo 目前 37 KB）。BAT 512 KiB 上限不受影響。

**§3.5 README 版本對照表**：「與 BMad Control Tower 協作」章節的對照表新增一列：

| 功能 | BAT 最低版號 | CT 最低版號 |
|---|---|---|
| 待辦分頁（BAT ↔ CT 契約 v2：待你決定、待你執行、到期提醒、回合訊息卡） | `<實作發佈的版號>`（預估 `0.8.x` 線，塔台定版號） | `6.1.0` |

並寫一句「兩邊都要到上述版本；任一邊太舊，待辦分頁顯示需要的版本並停用」。

#### 需放寬或修改的既有規則（交塔台與使用者決策）

| # | 既有規則 | 修改 | 理由 | 風險 / 緩解 |
|---|---|---|---|---|
| R1 | T0590 / T0600：hook 不送 payload 內容 | `bat-hook.mjs stop` 多送 `last_assistant_message`（讀 stdin 上限 64 KiB、送出前截到 16 KiB）；host 只保留已宣告塔台分頁的，其他收到即丟、不記內容 | 卡片唯一不依賴 claude 內部格式的來源（官方描述就是為了「不必解析 transcript」） | 每個 claude 分頁的最後訊息都會經過本機 RemoteServer（權杖保護、不落地）。替代：hook 先問 host「要不要內容」再送第二次（多一次往返，佔 1.8 s 時限），資料更少但較慢 —— 建議採主案（host 過濾） |
| R2 | T0788：只在 hook / OSC `blocked` 時保留 | 新 reason `draft`（無上限）、`reading`（60 s 上限）；所有 helper 通知經 controller 原子送出；回答也進同一佇列 | #23、#24 問題 2 | 誤判 `draft` 會延後派工 → 「立即送出」＋5 分鐘系統通知。`reading` 的上限與 D228「不設逾時」不同，理由見 §2.4 |
| R3 | T0788 第 9 點 / T0566：helper Enter 經合成 keydown＋`terminal.focus()` | 改 `terminal.input('\r', false)`（仍 `{ auto: true }`） | B0：不捲動、不清選取、不搶焦點 | 升級 xterm 時要重驗 Enter 位元組（加真 xterm 測試守住）；T0566 用量限制路徑可一起改或維持，實作單決定 |
| R4 | D158：不注入 codex hooks / `-c notify`、不解碼 OSC 7501 `msg` | **維持**；codex 塔台卡片區顯示說明 | 見 §4 | 使用者若要 codex 卡片需另行研究 |
| R5 | BAT MCP 全唯讀（D155 / D156） | **維持**；不採用 claude channels | §1 信號表 S5 | 長期研究項 |
| R6 | T0701 / D184 總覽：顯示 `todo` 前 5 則 | 總覽的 `todo` 區改為「N 則 → 在待辦分頁查看」，完整清單只在待辦分頁 | 避免兩處各顯示一半（塔台補充 #1） | 總覽仍唯讀、其他區塊（狀態、`*config`、sprint、`next_ids`）不變 |
| R7 | 新 channel 歸屬 | `tower-inbox:answer`、`tower-cards:list` / `:changed`、`terminal:reading-state` 都是 renderer IPC / proxied，🔴 不進 `HELPER_CHANNEL_ROLES` | agent 不能冒充使用者作答或讀卡片 | — |
| R8 | 指揮塔與新分頁的關係 | **並存**：待辦 = 需要人的事（行動）；指揮塔 = 專案資料瀏覽（完整清單、設定、決策）。BUG / PLAN / 工單在待辦只有數量＋連結 | 塔台補充 #1 | — |
| R9 | 強制版本對齊的範圍 | 閘門只管待辦分頁；B0 / #23 / B 不受 CT 版本影響 | 它們修的是 BAT 自己的輸入路徑，與契約無關；讓 bug fix 等 CT 升版沒有好處 | 若使用者要求連保護也綁版本，改為同一個開關（不建議） |
| R10 | 發佈 | BAT 一個版本一起發 W1–W8（使用者裁示 1：不拆 BAT 先做、CT 後做），與 CT 6.1.0 預發行同步；README 對照表同步 | 使用者裁示 | W1 / W2 若實作完成早於 CT，可在 `v0.8.x` 先合但不發佈，或由使用者裁示先發（不建議改變裁示） |

#### 實作拆單建議

| 單 | 範圍 | 依賴 | 驗收重點 | 規模 |
|---|---|---|---|---|
| **W1** B0 | `TerminalPanel.tsx` `dispatchEnter` 的 helper / 回答 Enter 改 `terminal.input('\r', false)`；T0566 路徑一併評估 | — | 真 xterm 測試：往上捲 `viewportY` 不變、選取保留、焦點不變、`onData` 位元組 = keydown 路徑；T0788 / T0566 既有測試全綠 | S |
| **W2** 保留佇列擴充 | `NotifyHoldController`：`draft`（host S1 追蹤，`pty.ts` `fromUser`）、`reading`（新 channel）、原子送出與 250 ms 窗口的使用者輸入暫存、「立即送出」、5 分鐘提醒、回答項目；headless 共用 | — | 單元測試（各 reason 的保留 / 放行 / 上限、窗口內打字不混入）；e2e 隔離實例以假 TUI（node 行編輯器腳本）重現 #23 並驗證修正 | M |
| **W3** 卡片資料 | `bat-hook.mjs stop` 送最後訊息（R1）、host 卡片 store（記憶體、遮罩、上限、生命週期）、proxied `tower-cards:*`、重連對帳；Claude 面板塔台來源 | R1 決策 | hook 規則（exit 0、stdout 空、1.8 s）不回歸；非塔台分頁不保存；日誌不含內容 | M |
| **W4** 待辦分頁骨架＋版本閘門 | `DockablePanel` `inbox`、分頁 UI 與區塊、`bat_contract` 解析、停用說明、`--set-role` 的 `bat-contract:` 行、`whoami` `contracts`；BAT 既有資料區（todo 全部、待驗收 BUG、BUG / PLAN / 工單數量、Worker 等你） | — | 舊存檔 docking 不壞；三種版本組合的畫面；總覽 `todo` 改連結（R6） | M |
| **W5** 契約 v2 清單＋回答 | `awaiting_user` / `user_actions` / `reminders` / `waiting_user` 解析與 UI、縮圖 / 工作區列表 `⏸N`、`tower-inbox:answer`（本機 / proxied）、Claude 面板塔台的回答路徑 | W2、W4 | 型別表逐項錯誤隔離；回答受 blocked / draft 保護、不受 reading 擋；權杖不可呼叫 | M |
| **W6** 卡片 UI | 卡片區、未讀 / 釘選、`⏸ 待你決定：` 加亮、codex 說明行、縮圖 `💬N` | W3、W4 | — | S–M |
| **W7** 文件 | CLAUDE.md 新節＋ `docs/agent-guide/tower-inbox.md`、說明頁「塔台分頁建議設定」、README 協作章節與版本對照表 | W1–W6 | — | S |
| **W8** 整合驗收 | 隔離實例 e2e（假 TUI 塔台＋ Worker `bat-notify --submit`；遠端 headless 路徑）＋〈待實機清單〉交使用者 | W1–W7 | — | S |

可平行：W1、W2、W3、W4 互不依賴；W5 等 W2 ＋ W4；W6 等 W3 ＋ W4；W7 / W8 最後。

**CT 端要做的事**（塔台在使用者核定後轉給 CT）：
1. `memory-protocol.md`：`bat_contract`、`ct_version`、`awaiting_user`、`user_actions`、`reminders`、`next_ids.user` / `action`；§ BAT 塔台面板讀取契約改為契約 v2；大小預算含 frontmatter。
2. `yolo-mode.md` / 斷點：升級給使用者時寫 `awaiting_user`＋工單 `waiting_user`；回答 / 撤銷移除＋決策日誌；選項代號格式 ①。
3. `work-order-system.md`：`depends_on` 指向有 `waiting_user` 的工單不派；收單時「待實機 / 待使用者執行」寫 `user_actions`。
4. 回答解析：`U-n：…`、`A-n：完成 / 失敗 …`（全形與半形冒號）。
5. Output Style：回覆結尾重列 `⏸ 待你決定 …；🙋 待你執行 …`。
6. `tower-config.md`：`user_inbox`（`on` 預設 / `off`，`off` 同時停 `user_actions`）。
7. 塔台開工：讀 `--set-role tower` 的 `bat-contract:` 行，不符時顯示 §6 的提示文字。
8. 定期事項：PLAN-067 類規則改寫成 `reminders`（本專案 `_local-rules.md`〈每週日誌清查〉由 BAT 塔台在 CT 6.1.0 後改寫）。
9. 版號：CT 6.1.0（MINOR、預發行流程），README / Portal 的版本對照表與 BAT 同步。

#### 待實機清單

| # | 項目 | 為什麼隔離環境做不到 | 怎麼驗 |
|---|---|---|---|
| T-1 | #23 現況重現（claude-cli 塔台打半句、Worker `--submit`） | 需登入的 claude 提示列 | 安裝版塔台分頁照 issue 步驟；預期現況會混入 |
| T-2 | normal buffer 往上捲時 `--submit` 把畫面拉回底部（B0 前） | 同上（需真實塔台輸出） | 往上捲 → 送一次通知；W1 後重驗應不動 |
| T-3 | fullscreen ＋ Auto-scroll 開 / 關時通知是否拉回 | 需真實回合 | `/tui fullscreen`、`/config` 切 Auto-scroll |
| T-4 | `Stop` hook `last_assistant_message` 的實際大小、多段文字 / 工具呼叫回合的內容 | 需真實回合 | W3 開 debug 只記長度 |
| T-5 | codex 輸入框的 Ctrl+C / Enter / Shift+Enter 行為是否符合 S1 規則 | 需登入的 codex | codex 塔台打半句、Ctrl+C、送通知 |
| T-6 | claude channels 在使用者帳號是否可用（長期研究用） | 需登入、可能需組織設定 | 不在本案實作範圍，只記錄可用性 |
| T-7 | 遠端（WSL）塔台的 `draft` / `reading` / 回答 | 需遠端環境 | W8 之後由使用者在 WSL profile 驗 |

### Renew 歷程
無

### 遭遇問題
- 無阻斷問題。
- 主 checkout 與安裝版的內嵌 claude 仍是 2.1.316（2.1.331 只在 `v0.8.x`）：為了照工單以 2.1.331 重新確認，以 `npm pack` 取公開套件到 scratchpad 做唯讀字串查證，收尾刪除。
- #23 沒有在隔離實例重現（理由見〈調查結論〉§1），列為待實機 T-1；W2 的 e2e 建議用假 TUI（行編輯器腳本）在隔離實例重現與驗證，不需登入 claude。
- 決策點都以「建議＋替代」寫在 R1–R10，未向塔台提問；其中 R9（版本閘門不套用在 B0 / #23 / B）與 R10（發佈節奏）直接關係到使用者裁示 1、2 的解讀，請塔台優先確認。

### 回報時間
2026-11-25T03:28:30+08:00
