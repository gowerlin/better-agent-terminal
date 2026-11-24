---
schema_version: 1
schema_kind: workorder
id: T0901
title: "研究（PLAN-068 / GitHub #24）：塔台給使用者的總結與提問如何不被淹沒 —— 收件匣、回合訊息卡（MultiView / SubView）、分割檢視、閱讀保護的比較，清單維護與保留策略，BAT ↔ CT 契約草案"
type: research
status: PENDING
repo: better-agent-terminal
project: PLAN-068
priority: P2
sizing: M
created_at: "2026-11-25T03:05:55+08:00"
updated_at: "2026-11-25T03:05:55+08:00"
depends_on: []
related:
  - "PLAN-068；GitHub issue #24（`gh issue view 24 -R gowerlin/better-agent-terminal`）、#23（已關閉）；D326"
  - "T0788（塔台等使用者時保留 Worker 通知）、T0607（Worker 問塔台）、T0701（指揮塔總覽，契約 v1）、T0735 / T0762（等待使用者提示）、T0590 / T0600（hooks）、T0641（session 名稱）"
  - "HANDOVER `_ct-workorders/_handover-2026-11-25-tower-user-inbox-issue24.md`（CT 端的討論；CT 答覆到時塔台以〈塔台補充〉轉給本單）"
affects_files:
  - _ct-workorders/T0901-research-tower-user-inbox-issue24.md
renew_count: 0
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

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **session_id**：

### 互動紀錄

### 調查結論

### 建議方向

### 清單維護與保留

### BAT ↔ CT 契約草案

### 建議下一步

### Renew 歷程
無

### 遭遇問題

### 回報時間
