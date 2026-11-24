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
updated_at: "2026-11-25T03:53:34+08:00"
completed_at: "2026-11-25T03:53:34+08:00"
depends_on: [T0901]
related:
  - "PLAN-068；T0901（研究，回報區全部沿用為輸入）；GitHub #24、#23（`gh issue view 23|24 -R gowerlin/better-agent-terminal`，唯讀）；D327（使用者 2026-11-25 裁示）"
  - "CT 立場草案 BMad-Guide `_reply-2026-11-25-tower-user-inbox-issue24.md`（`1d2692f`、CT D866，DRAFT；唯讀，不得寫入）"
  - "T0788 / T0607 / T0701 / T0735 / T0762 / T0590 / T0600 / T0621（D158）"
affects_files:
  - _ct-workorders/T0902-design-tower-messages-unified-proposal.md
renew_count: 1
session_ids:
  - "d4f61385-641e-4e1d-8d36-2918581210a8"
  - "88f06443-44d0-4628-88b0-f67539f1fe42"
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

## 塔台補充（Renew #1）

**時間**：2026-11-25T03:44:05+08:00

**補充內容**：使用者 2026-11-25 核定第一版提案（D328），裁示如下：

> - **分頁名稱**：「待辦」（id `inbox`）。
> - **R10**：W1–W8 同一個 BAT 版本一起發，與 CT 6.1.0 預發行同步（先完成的單合進 `v0.8.x` 但不發佈）。
> - **R9 改為「全部綁版本」**：版本關卡不只管待辦分頁，**B0（通知不搶捲動）、#23 草稿保護、B 閱讀保護也要契約 v2 雙方相符才啟用**（第一版 R9 建議的「保護不綁版本」不採用）。
> - **R1 採主案**（`Stop` hook 送 `last_assistant_message`、host 只保留已宣告塔台的、其他丟棄），**並且要設計「BAT＋CT 的使用者怎麼註冊 hook」**：這個功能不是只有我們自己用，其他 BAT＋CT 使用者的 claude 可能沒有 BAT 注入的 hooks。

**新指示**（只改 / 補下列幾節，其餘第一版內容保留；回報區以「第二版」標示更動處，第一版被取代的段落用刪除線或註明「第二版取代」）：

1. **R9 全部綁版本的設計**：
   - 保護（B0 / `draft` / `reading` / 原子送出）以「哪個塔台分頁、哪個契約版本」為單位啟用：BAT 怎麼知道某個塔台分頁的 CT 是契約 v2？建議評估 CT 在 `--set-role tower` 時帶 `--bat-contract 2`（或等效參數）由 BAT 記在該 PTY，對照 `_tower-state.md` `bat_contract`；兩者不一致或缺少時的判定。
   - 不符時保護全部不啟用：塔台分頁 / 待辦分頁 / 縮圖怎麼提示（不得無聲），使用者看到什麼。
   - 舊 CT＋新 BAT、新 CT＋舊 BAT 的完整行為表（取代第一版 §6）。
   - 同步調整契約 v2 §3.1、R2 / R3 / R9、拆單 W1 / W2 / W4（版本閘門要先於保護生效）。
2. **R1 hook 註冊設計（BAT＋CT 使用者）**：
   - 盤點 BAT 現行注入（`buildBatMcpLaunchArgs` 的 `--settings=<dataDir>/bat-mcp/claude-settings.json`，只對 claude-cli 分頁）**涵蓋不到**的情況：使用者自訂參數已有 `--settings`（CT 規則禁止，但仍可能發生）、`disableAllHooks` / `allowManagedHooksOnly`、system runtime 太舊、使用者在一般 shell 分頁手打 `claude` 開塔台、遠端 profile、Claude 面板（SDK）塔台、其他終端（非 BAT）跑的塔台（BAT 讀不到，說明即可）。
   - 每種情況：BAT 怎麼偵測（例：塔台分頁 `blockedDetection: none`、`claudeSessionId: null`、`claudeHooksDisabledBy`）、怎麼提示（待辦分頁 / 塔台縮圖 / 開工時 CT 面板），使用者要做什麼。
   - 評估「讓使用者自己註冊」的方式：(a) 維持 BAT 自動注入＋偵測提示；(b) BAT 提供一鍵寫入使用者 / 專案層 `.claude/settings.json` 的 hook 項目（需同意、可移除、寫哪一層、與使用者既有 hooks 合併、`disableAllHooks` 時不寫）；(c) 以 Claude Code **plugin** 形式發佈 BAT hooks（例 `bat-hooks@<marketplace>`；比照 CT 以 plugin 發佈），使用者 `/plugin install`；(d) 其他。比較安全性（hook 是會執行的程式碼、路徑要指向哪個 BAT 安裝）、多 BAT 版本 / 遠端 / 解除安裝的清理、與 T0590「不得影響 claude」規則的一致性。給推薦方案。
   - CT 端要配合的事（例：開工時檢查並提示、`ct-help` / Portal 說明、README 協作章節）。
   - 同步更新拆單（可能新增一張 hook 註冊單）與待實機清單。
3. 其他第一版內容不必重做；若因上述修改而連帶需要改的地方，一併更新並註明。

## 塔台補充（執行中 #2）

**時間**：2026-11-25T03:48:24+08:00

使用者補充：**CT 最近也用 hook 修正「Bash 指令太長被截斷」的問題（使用者全域規則 R-G005 提到「Bash 指令字元數＋單引號數×3 ≥ 7,500 會被截斷（hook 會擋）」），hook 註冊設計要一併考慮 CT 的 hook**。

**新指示**（併入 Renew #1 第 2 點的 hook 註冊設計）：

- 唯讀找出 CT 的 hook：可能在 CT 安裝位置（`~/.claude/skills/control-tower/`、CT plugin 的 `hooks/` 或 `hooks.json`）、使用者 / 專案 `.claude/settings*.json` 的 `hooks` 鍵、或 CT 原始碼 repo（`D:\ForgejoGit\@Gower_Labs\BMad-Guide\`，唯讀、不得寫入）。只記事件名稱、matcher、腳本位置與用途，不記 settings 檔裡其他設定值或任何 env 值。
- 設計要涵蓋「BAT 的 hooks ＋ CT 的 hooks」一起註冊：兩者是否用同一種註冊方式（例：同一個 plugin marketplace、各自 plugin、或 BAT 注入時一併帶入 CT 的 hook）、兩邊的 hook 會不會衝突或重複觸發（同一事件多個 hook 的執行順序與 1.8 s 時限、CT 的 PreToolUse 擋指令 vs BAT 的 PreToolUse 只回報）、`--settings` 注入與使用者自己註冊的 hooks 是否會合併或互相蓋掉、`disableAllHooks` 時兩者都失效怎麼提示。
- 推薦方案要說明 BAT＋CT 使用者實際的安裝 / 升級 / 移除步驟（使用者看得懂的幾步），以及兩邊版本對齊（契約 v2）怎麼包含 hook 的版本。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（設計研究；五項驗收產出齊全，未改產品程式）。第二版（Renew #1）：R9 全部綁版本的設計（§6′、§3.1′），以及 BAT＋CT 的 hook 註冊設計（§7），含塔台補充執行中 #2 的 CT hooks；拆單新增 W0、W9；待實機新增 T-8–T-12
- **session_id**：88f06443-44d0-4628-88b0-f67539f1fe42（第二版）；第一版 d4f61385-641e-4e1d-8d36-2918581210a8
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（主 checkout，`CT_HOME` 未設）；C-1 工單在 REPO_ROOT 之下；C-3 `affects_files` 只有本工單 → not applicable；C-2 無 `branch` 欄位（HEAD = `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；BAT helper env 齊全（`BAT_REMOTE_TOKEN` 已設定）。
- **證據分道**：原始碼 / 文件 / 二進位字串的靜態查證。claude **2.1.331** 二進位以 `npm pack @anthropic-ai/claude-code-win32-x64@2.1.331` 取到 scratchpad（主 checkout 與安裝版 `0.8.0-pre.2` 的內嵌 claude 都還是 2.1.316；2.1.331 只在 `v0.8.x` 的 `package.json`）。沒有 build、沒有啟動任何 BAT 實例、沒有開 claude / codex 回合；需要實機的項目列在〈待實機清單〉。
- **commit**：只有本工單檔（`git commit --only`），不 push。scratchpad 的 claude 二進位與字串腳本收尾刪除。第二版也一樣：只靜態讀原始碼與 CT repo（唯讀），沒有寫 scratchpad 檔，也沒有執行任何實例。

### 互動紀錄
- [03:20] 開工；yolo。設計取捨都在工單範圍內，以「建議＋替代方案」寫進〈需放寬或修改的既有規則〉交塔台與使用者裁示，未向塔台提問。
- [03:22 後] 📥 塔台補充（執行中 #1）於〈跨 session 通知（額外節點）〉讀到 → 右側欄分頁改為「多種長期追蹤清單」的資訊架構：盤點 `todo` / `next_ids`、`_bug-tracker.md`、`_backlog.md`、非終態工單、待驗收、PLAN-067 定期事項、Worker attention 的現有資料；與指揮塔總覽（T0701）的分工；CT 新結構化欄位（`user_actions`、`reminders`）併入契約 v2 與大小預算；版面示意改為多區塊同時存在。
- [03:25] 填回報前節點檢查〈塔台補充〉：沒有新段落。
- [03:45] Renew #1（第二版，新 session）：讀〈塔台補充（Renew #1）〉→ 只改 / 補 R9（全部綁版本）與 R1（hook 註冊），其餘第一版保留；工單改回 `IN_PROGRESS`。唯讀查證 `electron/bat-mcp-launch.ts`（`buildBatMcpLaunchArgs`、`claudeHooksDisabledBy`、Settings 關閉時 hooks 一起不注入）、`electron/terminal-blocked-state.ts`（任何被接受的回報都把分頁設為 `hook`）、`scripts/bat-hook.mjs`、`scripts/bat-terminal.mjs`（未知參數 exit 1）、Claude 面板 session 沒有 `BAT_*` env。
- [03:48] 📥 塔台補充（執行中 #2）於〈跨 session 通知（額外節點）〉讀到 → hook 註冊設計納入 CT 的 hooks。唯讀查到：Bash 長度防護是 BMad-Guide T0552 寫在使用者層的 `PreToolUse`（`Bash`）hook，CT 6.0.2 產品與 CT plugin 都沒有 hooks；只記事件、matcher、位置與用途，沒有讀取其他設定值。新增 §7.0、§7.4–§7.7（各自發佈、互動與重複觸發、安裝 / 升級 / 移除步驟、hook 版本與契約）。

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

**右側欄新分頁「待辦」**（id `inbox`，英文 `Inbox`；第二版：D328 已定名「待辦」。~~名稱交使用者決定，其他候選：「塔台」「需要你」。~~ 建議「待辦」的理由：內容不只塔台訊息，還有 BUG 驗收、定期事項、Worker 等你）。分頁標題的數字 = 需要你動手的件數（待你決定＋待你執行＋到期提醒＋Worker 等你）；回合訊息卡的未讀數另外顯示在該區標題，不算進分頁數字（僅告知不該催人）。

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

#### §6 版本不符時（強制版本對齊）—— **第二版取代**，見下方〈第二版（Renew #1，D328）〉§6′

~~分頁整體只有「契約相符」與「停用＋說明」兩種狀態；沒有部分運作。BAT 獨有的修正（B0、#23 草稿保護、B 閱讀保護）是 BAT 自己輸入路徑的問題，與 CT 契約無關，**不受此閘門影響**（見 R9，交使用者確認）。~~（第二版：D328 裁示 R9 全部綁版本；下表也由 §6′ 的完整行為表取代）

| 情況 | BAT 待辦分頁 | CT 塔台 |
|---|---|---|
| BAT 契約 v2 ＋ CT 契約 v2 | 全部可用 | 正常寫入 |
| BAT 契約 v2 ＋ CT 舊版（`_tower-state.md` 沒有 `bat_contract` 或 < 2） | 只顯示：「待辦分頁需要 BMad Control Tower 6.1.0 以上（BAT ↔ CT 契約 v2）。這個專案的塔台狀態檔是契約 v1，請升級 CT 後重新開啟塔台。」＋ Portal 安裝頁連結 | 不知道 v2，照舊 |
| BAT 契約 v2 ＋ CT 更新的契約（`bat_contract` > 2） | 只顯示：「這個專案的塔台使用 BAT ↔ CT 契約 v<N>，這版 BAT 只支援 v2，請升級 BAT。」 | CT 依自己的規則判斷 BAT 太舊（下一列） |
| BAT 舊版（`--set-role tower` 沒有 `bat-contract:` 行）＋ CT 6.1.0 | 沒有待辦分頁（舊版本來就沒有） | 開工面板一行：「⚠️ BAT 不支援契約 v2（需要 BAT ≥ <版號>），待辦分頁不可用；待決事項仍會在每次回覆結尾重列。」CT 照常寫 v2 欄位（`waiting_user` 是 CT 自己派工判斷的狀態，不能因 BAT 版本停用） |
| `_tower-state.md` 沒有 frontmatter / 讀不到 | 顯示既有總覽的讀取錯誤文字 | — |
| CT 設 `user_inbox: off` | 顯示「這個專案的塔台已關閉待辦寫入（`user_inbox: off`）。」，卡片與 Worker 區照常（它們不來自 CT 檔案）—— 這是使用者自己的設定，不是版本不符 | 不寫 `awaiting_user` / `user_actions` |

### BAT ↔ CT 契約 v2 草案

**§3.1 版本欄位與偵測**（第二版：BAT 端改以「每個塔台分頁的宣告」為準，新增 `--bat-contract`，見〈第二版〉§3.1′；本表仍有效，只多一列）

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
| R1（第二版：D328 採主案，補 R1′） | T0590 / T0600：hook 不送 payload 內容 | `bat-hook.mjs stop` 多送 `last_assistant_message`（讀 stdin 上限 64 KiB、送出前截到 16 KiB）；host 只保留已宣告塔台分頁的，其他收到即丟、不記內容 | 卡片唯一不依賴 claude 內部格式的來源（官方描述就是為了「不必解析 transcript」） | 每個 claude 分頁的最後訊息都會經過本機 RemoteServer（權杖保護、不落地）。替代：hook 先問 host「要不要內容」再送第二次（多一次往返，佔 1.8 s 時限），資料更少但較慢 —— 建議採主案（host 過濾） |
| R2（第二版：補 R2′） | T0788：只在 hook / OSC `blocked` 時保留 | 新 reason `draft`（無上限）、`reading`（60 s 上限）；所有 helper 通知經 controller 原子送出；回答也進同一佇列 | #23、#24 問題 2 | 誤判 `draft` 會延後派工 → 「立即送出」＋5 分鐘系統通知。`reading` 的上限與 D228「不設逾時」不同，理由見 §2.4 |
| R3（第二版：補 R3′） | T0788 第 9 點 / T0566：helper Enter 經合成 keydown＋`terminal.focus()` | 改 `terminal.input('\r', false)`（仍 `{ auto: true }`） | B0：不捲動、不清選取、不搶焦點 | 升級 xterm 時要重驗 Enter 位元組（加真 xterm 測試守住）；T0566 用量限制路徑可一起改或維持，實作單決定 |
| R4 | D158：不注入 codex hooks / `-c notify`、不解碼 OSC 7501 `msg` | **維持**；codex 塔台卡片區顯示說明 | 見 §4 | 使用者若要 codex 卡片需另行研究 |
| R5 | BAT MCP 全唯讀（D155 / D156） | **維持**；不採用 claude channels | §1 信號表 S5 | 長期研究項 |
| R6 | T0701 / D184 總覽：顯示 `todo` 前 5 則 | 總覽的 `todo` 區改為「N 則 → 在待辦分頁查看」，完整清單只在待辦分頁 | 避免兩處各顯示一半（塔台補充 #1） | 總覽仍唯讀、其他區塊（狀態、`*config`、sprint、`next_ids`）不變 |
| R7 | 新 channel 歸屬 | `tower-inbox:answer`、`tower-cards:list` / `:changed`、`terminal:reading-state` 都是 renderer IPC / proxied，🔴 不進 `HELPER_CHANNEL_ROLES` | agent 不能冒充使用者作答或讀卡片 | — |
| R8 | 指揮塔與新分頁的關係 | **並存**：待辦 = 需要人的事（行動）；指揮塔 = 專案資料瀏覽（完整清單、設定、決策）。BUG / PLAN / 工單在待辦只有數量＋連結 | 塔台補充 #1 | — |
| ~~R9~~ | ~~強制版本對齊的範圍~~ | ~~閘門只管待辦分頁；B0 / #23 / B 不受 CT 版本影響~~ | ~~它們修的是 BAT 自己的輸入路徑，與契約無關；讓 bug fix 等 CT 升版沒有好處~~ | **第二版取代**（D328：全部綁版本），見 §6′ 與 R9′ |
| R10 | 發佈 | BAT 一個版本一起發 W1–W8（使用者裁示 1：不拆 BAT 先做、CT 後做），與 CT 6.1.0 預發行同步；README 對照表同步 | 使用者裁示 | W1 / W2 若實作完成早於 CT，可在 `v0.8.x` 先合但不發佈，或由使用者裁示先發（不建議改變裁示） |

#### 實作拆單建議 —— 第一版；W1 / W2 / W3 / W4 的依賴與範圍由〈第二版〉的拆單表更新（新增 W0、W9）

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

### 第二版（Renew #1，D328；含塔台補充執行中 #2）

> 使用者核定第一版並裁示：分頁名稱 **「待辦」（id `inbox`）**；R10 W0–W9 同一個 BAT 版本發佈、與 CT 6.1.0 預發行同步；**R9 全部綁版本**；R1 採主案並設計 hook 註冊。下列各節取代或補充第一版的對應段落（第一版被取代處已加刪除線或「第二版取代」）。§1–§5 的其他內容不變。

#### §6′ 契約版本閘門：全部綁版本（取代第一版 §6）

**判定單位：每個塔台分頁。** 保護（B0、`draft`、`reading`、原子送出）與回合訊息卡都作用在「某個塔台分頁的 PTY」上，所以版本也以分頁為單位判定。待辦分頁的檔案類清單（待你決定、待你執行、到期提醒）以專案的 `_tower-state.md` 為單位判定。

**兩個信號**

| 信號 | 誰寫 | BAT 記在哪 | 生命週期 |
|---|---|---|---|
| **分頁宣告** `towerContract` | 該分頁裡執行中的 CT：`bat-terminal.mjs --set-role tower --bat-contract 2 [--mode …]` | host 的 `PtyInstance`（與 `role` / `towerMode` 同處，T0562） | 與 `role` 相同：⏻ 重啟、Terminal Server recovery 保留，PTY 關閉消失。**每次 `--set-role` 都覆寫**，不帶 `--bat-contract` 的 `--set-role` 會把它清成「未宣告」（CT 降版後重新開工時立即生效）。不持久化 |
| **狀態檔** `bat_contract` | CT 寫在 `_tower-state.md` frontmatter | renderer 讀檔（既有指揮塔讀取管線） | 檔案 |

**為什麼保護看分頁宣告、不看狀態檔**：保護在 host（`NotifyHoldController`，本機主行程或 bat-server）同步判斷，需要每個 PTY 一個即時的值；狀態檔屬於工作區資料夾，由 renderer 讀，一個專案可能同時有多個塔台（或塔台開在別的資料夾），而且 CT 寫檔可能落後。若改成「兩者都等於 2 才啟用」，每次 CT 開工到第一次寫檔之間保護會關閉，#23 正好可能在這段時間發生，而且 host 還要讀專案檔（遠端要另開 channel）。**不建議**這種嚴格的 AND。

**CT 6.1.0 開工順序（契約要求）**：① 若 `_tower-state.md` 沒有 `bat_contract: 2` 就先寫入 → ② `--set-role tower --bat-contract 2` → ③ 讀輸出的 `bat-contract:` / `hooks:` 行（§3.1′）。照這個順序，「分頁宣告 2、狀態檔還是 v1」只會在異常時出現（檔案被還原、塔台開在別的資料夾）。

**每個塔台分頁的判定**

| 分頁宣告 | `_tower-state.md` `bat_contract` | 判定 | 保護（B0 / `draft` / `reading` / 原子送出） | 回合訊息卡 | 待辦分頁的檔案類清單 |
|---|---|---|---|---|---|
| 2 | 2 | 相符 | 啟用 | 啟用 | 啟用 |
| 2 | 缺 / 1 | 狀態檔落後 | 啟用（雙方程式都是 v2） | 啟用 | **停用**＋提示 P-3 |
| 2 | > 2 | 不符（資料比 BAT 新） | 停用 | 停用 | 停用＋提示 P-2 |
| 未宣告（舊 CT，或 6.1.0 以前的 `--set-role`） | 任何 | 不符（CT 太舊） | **停用** | 停用 | 停用＋提示 P-1 |
| > 2（未來的 CT） | 任何 | 不符（BAT 太舊） | 停用 | 停用 | 停用＋提示 P-2 |
| 不是已宣告的塔台 | — | 不適用 | 與現在相同（沒有新保護） | — | — |

🔴 **不回歸**：T0788 的保留（`permission` / `question` / `elicitation` / `input`）是既有行為，**不綁版本**，所有分頁照舊。綁版本的只有本提案新增的功能。這不是「部分運作」：它是已發佈的保護，拿掉就是回歸。

**提示（不得無聲）**

| 代號 | 出現位置 | 文字（草案） |
|---|---|---|
| P-1 CT 太舊 | 塔台縮圖徽章 `CT↑`（tooltip 同文字）、待辦分頁該塔台的標頭、塔台分頁第一次宣告時的 toast（每個分頁一次） | 「這個塔台的 Control Tower 沒有宣告 BAT ↔ CT 契約 v2，所以通知保護（不搶捲動、不混進草稿、閱讀時延後）、回合訊息卡與待辦清單都停用。請升級到 BMad Control Tower 6.1.0 以上，再重新開啟塔台。對話框保護（等你回答時不送通知）不受影響。」 |
| P-2 BAT 太舊 | 同上，徽章 `BAT↑` | 「這個塔台使用 BAT ↔ CT 契約 v<N>，這版 BAT 只支援 v2。請升級 Better Agent Terminal。在升級前，通知保護、回合訊息卡與待辦清單都停用。」 |
| P-3 狀態檔落後 | 待辦分頁的檔案類區塊（保護與卡片照常，不出徽章） | 「塔台分頁已宣告契約 v2，但這個工作區的 `_tower-state.md` 還是 v1。CT 6.1.0 開工時會先寫入；如果一直看到這行，請確認這個工作區的資料夾就是塔台所在的專案，或在塔台執行 `*sync`。」 |

待辦分頁標題的數字在選中的塔台不符時改成 `!`。不另外在通知送出當下跳出提示（例如「這則通知可能混進你的草稿」）：那需要在停用的狀態下照樣跑偵測，等於部分運作。

**各版本組合的完整行為（取代第一版 §6 表）**

| 組合 | BAT 畫面 | CT 行為 | 新保護 / 卡片 | T0788 |
|---|---|---|---|---|
| BAT v2 ＋ CT 6.1.0 | 全部可用 | 照開工順序宣告；正常寫入 v2 欄位 | 啟用 | 照舊 |
| BAT v2 ＋ CT ≤ 6.0.x | 待辦分頁停用＋P-1；縮圖 `CT↑` | 不知道 v2，照舊 | 停用（行為與今天相同） | 照舊 |
| BAT v2 ＋ CT 契約 v3（未來） | 停用＋P-2；縮圖 `BAT↑` | `--set-role` 回 `bat-contract: 2 (requested 3: unsupported)` → 開工提示「BAT 太舊」 | 停用 | 照舊 |
| BAT 舊 ＋ CT 6.1.0 | 沒有待辦分頁（舊版本來就沒有） | `--bat-contract` 被舊 helper 拒絕（`Unknown option '--bat-contract'`、exit 1、沒有設定角色）→ **不帶此參數重送 `--set-role`**（保留標題與模式這些 v1 功能）→ 開工面板一行：「⚠️ 這版 BAT 不支援 BAT ↔ CT 契約 v2（需要 BAT ≥ `<版號>`）：待辦分頁、通知保護、回合訊息卡不可用；待決事項仍會列在每次回覆的結尾。」照常寫 v2 欄位 | 不適用 | 照舊 |
| BAT 舊 ＋ CT 舊 | 今天的行為 | 今天的行為 | — | 照舊 |
| CT 6.1.0 在 BAT 以外的終端 | BAT 讀不到這個分頁；只要在 BAT 裡開同一個專案，待辦分頁的檔案類清單照狀態檔判定 | 沒有 `BAT_*` env → 不呼叫 `--set-role`；寫 v2 欄位、回覆結尾照列 | — | — |
| Claude 面板塔台（BAT v2） | 面板 session 沒有 helper 權杖，無法 `--set-role`：面板塔台**以狀態檔 `bat_contract` 判定**；卡片來自面板訊息、回答送進面板；保護不適用（面板收不到 bat-notify） | 沒有 `BAT_*` env → 當成非 BAT 終端 | 卡片依狀態檔 | 不適用 |
| `user_inbox: off`（契約相符） | 待你決定 / 待你執行區塊顯示「已關閉」說明；保護、卡片、Worker 區照常（它們不來自 CT 寫的欄位） | 不寫 `awaiting_user` / `user_actions` | 啟用 | 照舊 |

#### §3.1′ 契約 v2 的 BAT 端欄位（第二版補充）

| 項目 | 形狀 | 說明 |
|---|---|---|
| `--set-role tower --bat-contract <n>` | 整數 ≥ 1 | 新參數（改 T0562 契約、CT-T013，屬「只增加」；見 R11）。沒有 `--set-role` 時使用 → 用法錯誤 exit 1 |
| `--set-role` stdout | `  bat-contract: 2`（接受）／`  bat-contract: 2 (requested <n>: unsupported)`（CT 比 BAT 新）／不帶參數時 `  bat-contract: none` | exit code 不變（0 / 3 / 1）；CT 要解析時允許開頭空白（同 ct-exec 讀 helper 輸出的規則） |
| `--set-role` stdout（claude 塔台） | `  hooks: ok (<來源>, set <n>)`／`  hooks: none (<代號>)`／codex `  hooks: n/a (codex)` | 見 §7.2；只在宣告 `--bat-contract` 時輸出，避免改變舊呼叫的輸出 |
| `terminal:whoami` / `get-state` / `list`（含 `scope: 'towers'`） | `towerContract: number \| null`、`hooksStatus: { state: 'ok' \| 'none' \| 'n/a', reason?: string, origin?: 'injected' \| 'plugin', set?: number } \| null` | 只有 metadata，`towers` scope 可以回；不含權杖與內容 |
| `terminal:role-changed`（main → renderer） | 加 `towerContract` | renderer 依此決定 B0 走哪條路、要不要回報 `reading`、顯示徽章 |

#### R 表的第二版修訂

| # | 修訂 |
|---|---|
| **R1′** | 採主案（D328）：`bat-hook.mjs stop` 送 `last_assistant_message`（只在 `stop` 事件讀這個欄位；stdin 沿用 `STDIN_MAX_BYTES` 256 KiB，送出前截到 16 KiB）。host 只在「已宣告塔台＋`towerContract == 2`」時保留，其他分頁收到即丟、不記內容、日誌只記長度。新增 `origin`（`injected` / `plugin`，見 §7.3）與 `set`（hook 組版本）欄位。「先問 host 再送」的替代方案不採用 |
| **R2′** | `draft` / `reading` / 原子送出 / 回答進佇列：只對 `towerContract == 2` 的塔台分頁生效（`NotifyHoldController.holdReason` 先檢查 `ptyManager.getTowerContract(id)`）。T0788 的 reason 對所有分頁照舊 |
| **R3′** | B0（`terminal.input('\r', false)`）只用在 `towerContract == 2` 的分頁；其他分頁（含非塔台分頁收到的 bat-notify）維持合成 keydown 路徑，T0566 不變 |
| **R9′** | 全部綁版本（D328）：判定單位與表格見 §6′。既有 T0788 保留不綁 |
| **R11（新）** | 改 T0562 `--set-role` 契約（CT-T013 依它撰寫，不得單方更改）：新增 `--bat-contract`、stdout 新增 `bat-contract:` / `hooks:` 兩行。只增加；舊 CT 不帶參數時輸出逐字不變。需要 CT 端在同一個契約版本中確認 |
| **R12（新）** | hook 新的註冊途徑：BAT 以 Claude Code plugin `bat-hooks` 發佈（§7.3），launcher 執行「該分頁所屬 BAT」的 `bat-hook.mjs`（路徑來自 PTY env `BAT_HELPER_DIR`）。T0590 的規則（exit 0、stdout 不輸出、時限內結束、任何失敗靜默）同樣適用於 launcher。新的信任點：以 env 指定的路徑執行程式碼，見 §7.3 安全性 |
| **R13（新）** | 既有行為：Settings「BAT MCP」關閉時連 hooks 一起不注入（`buildBatMcpLaunchArgs` `turned off in Settings`）。**建議維持**，只把原因顯示出來（§7.2 代號 `settings-off`）；替代方案是把 hooks 拆成獨立開關，等於改 D152 的設定結構，不建議放進本案 |
| **R10′** | 發佈：W0–W9 同一個 BAT 版本，與 CT 6.1.0 預發行同步；先完成的單合進 `v0.8.x`、不發佈（D328） |

#### §7 hook 註冊設計：BAT＋CT 使用者（Renew #1 第 2 點、塔台補充執行中 #2）

**7.0 現在有哪些 hook**（唯讀查證，只記事件 / matcher / 位置 / 用途）

| 擁有者 | 事件（matcher） | 位置 | 用途 | 怎麼註冊 |
|---|---|---|---|---|
| BAT | `PermissionRequest`；`PreToolUse`（`AskUserQuestion`）；`Notification`（`elicitation_dialog\|elicitation_url_dialog`、`elicitation_response`）；`PostToolUse`（`AskUserQuestion`）；`ElicitationResult`；`PostToolBatch`；`UserPromptSubmit`；`Stop`；`SessionStart`（`BAT_CLAUDE_HOOKS`，`electron/bat-mcp-launch.ts`） | `<helperDir>/bat-hook.mjs`，每個 hook 一律 exit 0、stdout 不輸出 | 回報 `blocked` / 回合 / 啟動 / session id 給該分頁的 BAT；本案加 `Stop` 的最後訊息 | BAT 啟動 claude-cli 分頁時注入 `--settings=<dataDir>/bat-mcp/claude-settings.json`（只有 `hooks` 鍵） |
| 使用者層（BMad-Guide T0552 / D855 建立，**不是** CT 產品發佈的內容） | `PreToolUse`（`Bash`） | `<使用者資料夾>/.claude/hooks/bash-length-guard.py`，直譯器以絕對路徑指定 | 指令「字元數＋單引號數 ×3 ≥ 7,500」時 exit 2 擋下並在 stderr 說明（R-G005）；任何錯誤 fail-open | 手寫在 `<使用者資料夾>/.claude/settings.json` `hooks.PreToolUse` |
| 使用者層（其他，與 CT / BAT 無關） | `PreToolUse`（`Read`）、`UserPromptSubmit`（`*`） | `<使用者資料夾>/.claude/hooks/sonar-secrets/…` | 秘密掃描 | 同上 |
| CT 產品 | 無：CT 6.0.2 原始碼（`BMad-Control-Tower-v6.0.2/`：`skills/`、`adapters/`、`docs/`）沒有 `hooks/`、`hooks.json` 或 `.claude-plugin/`；CT plugin（`ct@control-tower`）目前只有 skills。本機 Claude Code 沒有安裝 `ct@…` plugin（CT 以 skill 安裝） | — | — | — |

⇒ 「CT 的 hook」目前只存在本機使用者層，其他 BAT＋CT 使用者都沒有。要讓它成為 CT 的功能，必須由 CT 隨 CT 的 plugin 發佈。

**7.1 BAT 自動注入涵蓋不到的情況**

| # | 情況 | 現在的 BAT | BAT 怎麼偵測 | 使用者要做什麼 |
|---|---|---|---|---|
| G1 | BAT 開的 claude-cli 分頁（「以塔台開啟 Claude」、helper 派工）、BAT MCP 開啟、helper 端點正常 | ✅ 注入 | 啟動決定記錄為 `hook`，第一次回報即確認 | 無 |
| G2 | Settings「BAT MCP」關閉 | ❌ hooks 與 MCP 一起不注入 | 啟動決定原因 `settings-off` | 打開 Settings，或安裝 `bat-hooks` plugin |
| G3 | 自訂參數已有 `--settings`（CT 規則禁止，但仍可能發生） | ❌ 不注入（`userArgsPassClaudeSettings`） | `user-settings-arg` | 從自訂參數拿掉 `--settings`，或安裝 plugin（plugin 的 hooks 與 `--settings` 並存） |
| G4 | managed 或使用者設定檔 `disableAllHooks: true` | 有注入，但記為 `none`（`claudeHooksDisabledBy`） | `claude-hooks-disabled` | 這是使用者自己的設定；要用就拿掉。plugin 一樣被關掉，沒有別的路 |
| G5 | managed 設定 `allowManagedHooksOnly: true` | 同上 | `managed-hooks-only` | 只有管理者能加 managed hooks；否則不可用 |
| G6 | 專案層 `.claude/settings*.json` 的 `disableAllHooks`（啟動時 BAT 看不到） | 有注入、記為 `hook`，但一直沒有回報 | 宣告塔台時沒有任何 hook 回報（`claudeSessionId: null`）→ `no-report` | 檢查專案的 `.claude/settings*.json` |
| G7 | system runtime 的 claude 太舊 | hooks 有，但 `Stop` 沒有 `last_assistant_message` | v2 塔台的 `stop` 回報沒有該欄位 → 卡片區顯示原因 | 升級 system claude，或改用內嵌（最低版號由 W3 以 `npm pack` 逐版查出） |
| G8 | 一般 shell 分頁手打 `claude` 開塔台 | ❌ 沒有注入（raw shell）；PTY 仍有 `BAT_*` env | 這個分頁沒有 claude 啟動決定紀錄 → `not-launched-by-bat` | 改用「以塔台開啟 Claude」，或安裝 plugin |
| G9 | 遠端 profile（WSL / SSH / Docker）：BAT 開的 claude-cli 分頁 | ✅ 注入（headless 共用 `buildBatMcpLaunchArgs`、bundled node、遠端 dataDir、遠端的設定檔檢查） | 同 G1–G5 | 同 G1–G5 |
| G10 | 遠端手打 `claude` | ❌ | `not-launched-by-bat` | 在**遠端主機**的 claude 安裝 plugin（plugin 裝在哪台就只在哪台生效）；遠端沒有系統 node 時 plugin 的指令跑不起來（見 7.3 限制） |
| G11 | Claude 面板（SDK）塔台 | 不需要 hooks：卡片直接取面板訊息，保護不適用 | `hooks: n/a` | 無 |
| G12 | BAT 以外的終端 | BAT 讀不到；plugin 在那裡沒有 `BAT_*` env → 立即結束 | 無（CT 端看到沒有 `BAT_*` env） | 說明即可：待辦分頁的檔案類清單仍可在 BAT 開同一專案時看到；卡片與保護不可用 |
| G13 | helper 端點沒在聽 / `bat-hook.mjs` 不見 / 安裝路徑含 `'` | ❌ | `no-endpoint` / `script-missing` / `unrepresentable-path` | 重開 BAT / 重新安裝 / 改安裝路徑（BAT 自己的問題） |

**7.2 偵測與提示**

- host 為每個 claude 分頁記錄 hooks 的啟動決定與原因代號（目前只記 `blockedDetection`，原因只在日誌；改為與 `claudeSessionNameRecords` 同樣的 per-terminal 紀錄）。沒有紀錄 = 不是 BAT 開的 claude（G8 / G10）。
- `--set-role tower --bat-contract 2` 時：claude 塔台若還沒有任何 hook 回報，最多等 2 s（`SessionStart` 是 async，可能晚於 CT 的開工指令），然後輸出 `hooks:` 行；codex → `n/a (codex)`。同一份資訊放進 `hooksStatus`（§3.1′）。
- 缺 hooks 時**失去**：T0788 對話框保留、回合訊息卡、`agentStarted` / session id。**仍有**：`draft` / B0 / `reading`（不需要 hooks）、檔案類清單。
- 提示位置：CT 開工面板一行；待辦分頁該塔台標頭一行＋「怎麼修」說明頁連結；塔台縮圖徽章 `🪝✕`（tooltip 同文字）。

| 代號 | 提示文字（草案，前綴「這個塔台沒有 BAT hooks：回合訊息卡與對話框保護不可用。」） |
|---|---|
| `settings-off` | 「原因：Settings › BAT MCP 已關閉。打開它並重開塔台，或安裝 `bat-hooks` plugin。」 |
| `user-settings-arg` | 「原因：這個 agent 的自訂參數已有 `--settings`。拿掉它，或安裝 `bat-hooks` plugin。」 |
| `claude-hooks-disabled` | 「原因：claude 設定檔 `<檔名>` 設了 `disableAllHooks`。這是你的設定；要使用請拿掉。」 |
| `managed-hooks-only` | 「原因：組織的 managed 設定只允許 managed hooks。請洽管理者。」 |
| `no-report` | 「原因：claude 啟動後沒有任何 hook 回報，可能是專案的 `.claude/settings*.json` 關了 hooks。」 |
| `not-launched-by-bat` | 「原因：這個 claude 不是 BAT 開的（在 shell 手打）。改用「以塔台開啟 Claude」，或安裝 `bat-hooks` plugin。」 |
| `plugin-outdated` | 「`bat-hooks` plugin 的事件清單比這版 BAT 舊，請執行 `claude plugin update bat-hooks@better-agent-terminal`。」（狀態是 ok，但缺少的事件不會回報） |
| `no-endpoint` / `script-missing` / `unrepresentable-path` | 「BAT 的 helper 異常，請重開 BAT；仍然如此請重新安裝。」 |

**7.3 讓使用者自己註冊：方案比較**

| | (a) 維持自動注入＋偵測提示 | (b) BAT 一鍵寫入使用者 / 專案 `.claude/settings.json` | (c) Claude Code plugin `bat-hooks` | (d1) BAT 改注入 `--plugin-dir` | (d2) BAT 注入時一併帶入 CT 的 hooks |
|---|---|---|---|---|---|
| 補到的缺口 | G1、G9 | G2、G3、G8（只限寫入的那台） | G2、G3、G8、G10（裝在哪台補哪台） | G3（與使用者 `--settings` 並存） | 只在 BAT 開的分頁有 CT hooks |
| 安全性 | 只執行 BAT 自己的檔案；不改使用者設定 | BAT 改使用者的 claude 設定檔（違反 §2.5「BAT 不改 claude 設定」）；hook 寫死安裝目錄的絕對路徑 | 使用者以 claude 自己的 `/plugin install` 同意與信任流程安裝；plugin 只有一個小 launcher（可審閱），不含權杖；launcher 以 env `BAT_HELPER_DIR` 指定的路徑執行程式碼（與 PATH 同等的信任：能改 env 的人本來就能控制這個行程），並檢查絕對路徑、檔名固定為 `bat-hook.mjs`、`BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / `BAT_TERMINAL_ID` 都存在 | 同 (a) | BAT 要知道 CT 的檔案位置與版本 |
| 多 BAT 版本 / 遠端 | 自動正確 | 寫死某一個安裝；遠端每台要寫 | 每次都執行**該分頁所屬 BAT** 的 `bat-hook.mjs`（遠端分頁執行遠端 bat-server 的那份），程式版本永遠與 BAT 一致；只有 plugin 的事件清單可能落後 → `plugin-outdated` | 自動正確 | BAT 版本與 CT 版本綁在一起 |
| 解除安裝 | 無殘留 | BAT 解除安裝後 hook 指向不存在的檔：每個 claude session（含 BAT 以外）每個事件都出錯 → **違反 T0590「不得影響 claude」** | `claude plugin uninstall`；BAT 先解除安裝時沒有 `BAT_*` env → launcher 立即結束，不會出錯 | 無殘留 | — |
| 與 T0590 一致 | ✅ | ❌（懸空路徑） | ✅（launcher 照同樣規則） | ✅ | ⚠️ CT hooks 會擋指令（exit 2），不符合「BAT hooks 不改變 claude 行為」 |
| 成本 | 已有；加原因紀錄與提示 | 中（合併 JSON、還原、遠端） | 中：BAT repo 新增 marketplace（`.claude-plugin/marketplace.json`）與 plugin（`hooks/hooks.json`＋launcher） | 小，但 `--plugin-dir` 在內嵌 2.1.331 的行為與「同名 plugin 也從 marketplace 安裝時」的衝突要查證 | — |
| 結論 | **採用（主要途徑）** | **不採用** | **採用（給 G2 / G3 / G8 / G10 的使用者）** | W9 查證後再決定，只當 G3 的備援 | **不採用**：CT 的 hooks 由 CT 自己發佈（下一點） |

**推薦：(a)＋(c)，BAT 與 CT 各自發佈自己的 hooks。**

- **BAT hooks**：BAT 開的分頁照舊自動注入；需要的人再裝 `bat-hooks@better-agent-terminal`（marketplace 在 BAT 的公開 repo）。
- **CT hooks**：CT 把 Bash 長度防護（以及日後其他 hook）放進 CT 自己的 plugin `ct@control-tower` 的 `hooks/hooks.json`，用 `${CLAUDE_PLUGIN_ROOT}` 指向 plugin 內的腳本，不寫死使用者路徑。理由：
  - 這個防護在任何終端都有用，不只在 BAT 裡。
  - 它屬於 CT 的行為：它會擋指令，而 BAT 的 hooks 依規則不能改變 claude 的行為。
  - 版本跟著 CT 走。
  - 以 zip 安裝 CT 的使用者沒有 plugin hooks，由 CT 決定要不要提供手動註冊說明（CT 端事項）。
- **不用同一個 plugin**：一起發佈會讓兩邊版本綁死，而且 CT 有不在 BAT 裡的使用者。**同一個 marketplace 也不必要**：BAT 的 marketplace 在 BAT repo，CT 的在 CT repo，兩者各自獨立。

**7.4 BAT 與 CT 的 hooks 會不會互相影響**（依 Claude Code 文件的 hook 規則；2.1.331 的實際行為列為待實機 T-10）

| 問題 | 結論 |
|---|---|
| `--settings` 注入會不會蓋掉使用者自己的 hooks | 不會：hooks 依來源（managed、使用者、專案、本機、`--settings`、plugin）合併後一起執行。`--settings` 只是多一個設定層。反過來，使用者的 hooks 也不會讓 BAT 的 hooks 失效 |
| 同一事件有多個 hook | 符合 matcher 的 hooks 平行執行，各自套用自己的 `timeout`。BAT 的 1.8 s 是腳本自己的上限，與 CT guard 的 timeout 10 s 互不影響；完全相同的指令字串只執行一次 |
| `PreToolUse`：CT 擋指令 vs BAT 只回報 | matcher 不同（CT `Bash`、BAT `AskUserQuestion`），同一次工具呼叫只會觸發其中一個。即使未來同一個 matcher：任一 hook 擋下（exit 2 / deny）就擋下該工具，BAT 的 hook 永遠 exit 0、不輸出，不會放行或擋下任何東西。被 CT 擋下的 Bash 不會出現權限對話框，BAT 也就不會進入 `blocked`，不需要另外處理 |
| BAT 注入＋`bat-hooks` plugin 同時存在 | 兩者指令不同，會各跑一次 → 每個事件回報兩次。處理：launcher 在回報加 `origin: 'plugin'`（注入的預設為 `injected`）；host 對同一個 PTY 一旦收過 `injected` 的回報，就丟棄 `plugin` 的回報（只記一次日誌）。在那之前，狀態類事件重複套用沒有副作用（idempotent）；卡片以 session id＋內容雜湊去重 |
| `disableAllHooks` / `allowManagedHooksOnly` | BAT 與 CT（plugin）的 hooks **一起失效**。BAT 以 G4 / G5 / G6 的代號提示 BAT 的部分；CT 的 Bash 長度防護失效由 CT 開工檢查提示（CT 端事項 C-3），兩邊文字都寫明「這是你自己的設定」 |
| 目前手寫在使用者層的 `bash-length-guard.py` | CT 改由 plugin 發佈後，使用者層那一項要移除。若不移除，兩份指令字串不同，會各跑一次，兩者都擋，只是訊息重複。移除步驟寫進 CT 的升級說明 |

**7.5 使用者的安裝 / 升級 / 移除步驟（BAT＋CT 使用者）**

安裝：
1. 安裝 BAT（≥ 契約 v2 版本）。
2. 安裝 CT 6.1.0：`claude plugin marketplace add <CT marketplace>` → `claude plugin install ct@control-tower`（CT 的 hooks 隨 plugin 一起來）。
3. 用「以塔台開啟 Claude」開塔台 → BAT hooks 自動帶入，不用再做任何事。
4. **只有**在 shell 手打 `claude`、自訂參數用了 `--settings`、或關掉 BAT MCP 時：`claude plugin marketplace add gowerlin/better-agent-terminal` → `claude plugin install bat-hooks@better-agent-terminal`。遠端主機要在**遠端**的 claude 執行這兩行。
5. 開工時 CT 會顯示 `hooks:` 狀態；不是 `ok` 就照提示處理。

升級：
- 升級 BAT：不用動 hooks（注入檔每次重寫；plugin 執行的是新版 BAT 的腳本）。新版 BAT 新增 hook 事件時，若 plugin 太舊，會出現 `plugin-outdated` 提示 → `claude plugin update bat-hooks@better-agent-terminal`。
- 升級 CT：`claude plugin update ct@control-tower`。從手寫 hook 改用 plugin 的使用者，照 CT 說明移除 `settings.json` 裡舊的那一項。

移除：
- `claude plugin uninstall bat-hooks@better-agent-terminal`、`claude plugin uninstall ct@control-tower`。
- 只解除安裝 BAT 時，plugin 會變成什麼都不做，不會報錯；建議一併解除安裝 plugin。BAT 的解除安裝程式不動 claude 的設定。

**7.6 版本對齊怎麼包含 hooks**

- **BAT hook 組版本** `BAT_HOOK_SET`（整數，寫在 `bat-hook.mjs`／`BAT_CLAUDE_HOOKS` 旁）：契約 v2 要求 `set ≥ 2`（含 `Stop` 的最後訊息）。程式碼一定是該分頁 BAT 自己的那份，所以實際只需比對 plugin 的事件清單版本：plugin 的 launcher 帶 `--hook-list <n>`，BAT 比對後在 `hooks:` 行回報 `plugin-outdated`。
- **CT hooks 不進 BAT ↔ CT 契約**：BAT 不讀、不依賴 CT 的 hooks。它們的版本就是 CT plugin 的版本，由 CT 自己的開工檢查處理。
- **README 版本對照表**（§3.5）新增一列：「`bat-hooks` plugin（選用；手打 claude、自訂 `--settings`、關掉 BAT MCP 時才需要）—— BAT 最低版號同待辦分頁；plugin `1.0.0`」。

**7.7 CT 端要配合的事（補進第一版「CT 端要做的事」）**

- C-1 開工順序（§6′）：寫 `bat_contract` → `--set-role tower --bat-contract 2` → 舊 BAT 拒絕時不帶參數重送並提示。
- C-2 解析 `bat-contract:` / `hooks:` 兩行；`hooks: none` 時依代號顯示一行（文字沿用 §7.2，CT 可改寫但意思不變）。
- C-3 CT 自己的 hooks：把 Bash 長度防護放進 `ct@control-tower` 的 `hooks/hooks.json`（`${CLAUDE_PLUGIN_ROOT}`、fail-open、不依賴使用者的 python 路徑，直譯器的選擇由 CT 決定）；開工檢查 `disableAllHooks`，提示防護失效；寫明 zip 安裝的使用者怎麼手動註冊；升級說明含「移除使用者層舊項目」。
- C-4 `ct-help` / Portal「與 BAT 協作」頁：兩種 hooks 的用途、什麼時候需要 `bat-hooks` plugin、7.5 的步驟。
- C-5 README 協作章節與版本對照表同步（§3.5＋7.6）。
- C-6 CT 不替使用者安裝 plugin、不改 claude 設定。

#### 第二版拆單（取代第一版拆單表的依賴欄；W1–W8 範圍不變處不重寫）

| 單 | 範圍（第二版變更） | 依賴 | 驗收重點（新增） | 規模 |
|---|---|---|---|---|
| **W0（新，最先）** 契約版本閘門 | `bat-terminal.mjs` `--bat-contract`；`terminal:set-role` 參數與 `PtyInstance.towerContract`（生命週期同 `role`）；stdout `bat-contract:` 行；`whoami` / `get-state` / `list` 的 `towerContract`；`terminal:role-changed` 帶 `towerContract`；renderer store；縮圖徽章 `CT↑` / `BAT↑` 與 P-1 / P-2 toast | — | 舊呼叫（不帶參數）輸出逐字不變；覆寫 / 清除規則；⏻ 與 recovery 保留；舊 helper 拒絕未知參數的行為不變 | S–M |
| W1 B0 | 只對 `towerContract == 2` 的分頁改用 `terminal.input('\r', false)` | **W0** | v1 / 未宣告分頁仍走合成 keydown（測試守住） | S |
| W2 保留佇列 | `draft` / `reading` / 原子送出 / 回答只對 v2 塔台；T0788 reason 對所有分頁不變 | **W0** | v1 塔台在有草稿時行為與今天相同；T0788 既有測試全綠 | M |
| W3 卡片資料 | R1′：`stop` 送最後訊息；`origin` / `set` 欄位；host 只保留 v2 塔台；`plugin` / `injected` 去重；查出 `last_assistant_message` 的最低 claude 版號 | **W0** | 非 v2 塔台不保存；重複回報只產生一張卡 | M |
| W4 待辦分頁骨架 | §6′ 判定表（分頁宣告 × 狀態檔）、P-1 / P-2 / P-3、分頁標題 `!` | **W0** | 判定表每一列都有畫面測試 | M |
| W5 / W6 / W7 / W8 | 範圍同第一版；W7 文件加 §7.5 步驟與 `bat-hooks` 說明；W8 加入版本組合與 hooks 缺口的驗收 | 同第一版＋W9 | — | 同第一版 |
| **W9（新）** hook 註冊 | host 記錄 hooks 啟動決定與原因代號；`--set-role` 的 `hooks:` 行（等待 2 s）與 `hooksStatus`；提示（CT 面板文字由 CT 做）與徽章 `🪝✕`；BAT repo 的 marketplace＋`bat-hooks` plugin（`hooks.json`＋launcher，T0590 規則）；`--hook-list` / `plugin-outdated`；評估 (d1) `--plugin-dir`；`verify-*` 打包檢查不受影響（plugin 不進安裝檔） | W0、W3 | launcher：沒有 `BAT_*` env 時立即 exit 0 且無輸出；路徑檢查；Windows 上 Git Bash 與 PowerShell 都能執行；與注入並存時只算一次 | M |

可平行：W0 先做；W0 完成後 W1、W2、W3、W4 平行；W9 等 W0＋W3；W5 等 W2＋W4；W6 等 W3＋W4；W7、W8 最後。

#### 第二版新增的待實機項目

| # | 項目 | 為什麼隔離環境做不到 | 怎麼驗 |
|---|---|---|---|
| T-8 | 舊 CT（6.0.x）＋新 BAT：保護全部停用、徽章與 P-1 文字；CT 升級後重新開工即啟用 | 需要使用者的 CT 安裝與真實塔台 | 安裝版塔台照兩種 CT 版本各開一次 |
| T-9 | `bat-hooks` plugin 在 Windows 的 claude 上：hook 經 Git Bash 與經 PowerShell 時，`${CLAUDE_PLUGIN_ROOT}` 的展開與 `node` 的解析 | 需登入的 claude 與 plugin 安裝 | 兩種 shell 環境各裝一次 plugin，手打 `claude` 開塔台，看 `hooks:` 行 |
| T-10 | 注入＋plugin 並存時的去重；`--settings` 與使用者 / plugin hooks 合併；CT guard 與 BAT hook 同時存在時互不影響（2.1.331） | 需真實回合 | 三種 hook 都在時跑一個含 Bash 長指令與權限對話框的回合 |
| T-11 | 專案層 `disableAllHooks` → `no-report` 提示 | 需登入的 claude | 在測試專案設定後開塔台 |
| T-12 | 遠端（WSL）手打 claude＋plugin，及遠端沒有系統 node 的情況 | 需遠端環境 | WSL profile 驗 |

### Renew 歷程
- Renew #1（03:45–03:53）：使用者核定第一版（D328）。R9 改為全部綁版本：判定單位是塔台分頁的 `--bat-contract` 宣告，狀態檔只決定檔案類清單；不符時以 P-1 / P-2 / P-3 提示，並列出各版本組合的完整行為；既有 T0788 保留不綁版本。R1 採主案，並完成 hook 註冊設計：盤點 13 種涵蓋缺口與偵測代號，推薦 (a) 自動注入＋(c) `bat-hooks` plugin，不採用 (b) 寫入使用者設定。依塔台補充（執行中 #2），CT 的 hooks 由 CT 以自己的 plugin 發佈，不與 BAT 的 hooks 綁在一起。拆單新增 W0 與 W9。

### 遭遇問題
- 無阻斷問題。
- 主 checkout 與安裝版的內嵌 claude 仍是 2.1.316（2.1.331 只在 `v0.8.x`）：為了照工單以 2.1.331 重新確認，以 `npm pack` 取公開套件到 scratchpad 做唯讀字串查證，收尾刪除。
- #23 沒有在隔離實例重現（理由見〈調查結論〉§1），列為待實機 T-1；W2 的 e2e 建議用假 TUI（行編輯器腳本）在隔離實例重現與驗證，不需登入 claude。
- 決策點都以「建議＋替代」寫在 R1–R10，未向塔台提問；其中 R9（版本閘門不套用在 B0 / #23 / B）與 R10（發佈節奏）直接關係到使用者裁示 1、2 的解讀，請塔台優先確認。（第二版：D328 已裁示，見 R9′ / R10′）
- 第二版沒有阻斷問題。待塔台與使用者裁示：R11（改 `--set-role` 契約，需要 CT 同版確認）、R12（`bat-hooks` plugin：一條新的發佈途徑，也多一個信任點）、R13（Settings「BAT MCP」關閉時 hooks 也關閉，建議維持）、§7.3 (d1) `--plugin-dir`（W9 查證後再決定）、§7.7 C-3（CT 以自己的 plugin 發佈 Bash 長度防護，由 CT 決定）。
- §7.4 的 hook 合併 / 平行 / 去重規則依 Claude Code 文件撰寫，2.1.331 的實際行為沒有實測（不能開回合），列為 T-10。
- Renew #1 開工時，`updated_at` 一度寫入手打的值，隨即改成系統時間（R-G001）。commit 中的是系統時間。

### 回報時間
2026-11-25T03:28:30+08:00（第一版）；2026-11-25T03:53:34+08:00（第二版，Renew #1）
