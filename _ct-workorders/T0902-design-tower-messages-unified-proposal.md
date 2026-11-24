---
schema_version: 1
schema_kind: workorder
id: T0902
title: "設計（PLAN-068 / GitHub #24 ＋ #23）：塔台訊息不被淹沒、不被擠走、不混進草稿 —— BAT ＋ CT 一次到位的整合提案（右側欄分頁、強制版本對齊）"
type: research
status: PENDING
repo: better-agent-terminal
project: PLAN-068
priority: P2
sizing: M
created_at: "2026-11-25T03:19:48+08:00"
updated_at: "2026-11-25T03:19:48+08:00"
depends_on: [T0901]
related:
  - "PLAN-068；T0901（研究，回報區全部沿用為輸入）；GitHub #24、#23（`gh issue view 23|24 -R gowerlin/better-agent-terminal`，唯讀）；D327（使用者 2026-11-25 裁示）"
  - "CT 立場草案 BMad-Guide `_reply-2026-11-25-tower-user-inbox-issue24.md`（`1d2692f`、CT D866，DRAFT；唯讀，不得寫入）"
  - "T0788 / T0607 / T0701 / T0735 / T0762 / T0590 / T0600 / T0621（D158）"
affects_files:
  - _ct-workorders/T0902-design-tower-messages-unified-proposal.md
renew_count: 0
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

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **session_id**：

### 互動紀錄

### 調查結論

### 建議方向

### Renew 歷程
無

### 遭遇問題

### 回報時間
