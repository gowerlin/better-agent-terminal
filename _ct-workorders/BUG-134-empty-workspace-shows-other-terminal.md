---
schema_version: 1
schema_kind: bug
id: BUG-134
title: "工作區的終端全部關閉後，主畫面殘留顯示另一個工作區（或已關閉）的 Agent 終端畫面，無法操作、看起來像當機"
status: FIXED
severity: medium
reproducibility: always
created_at: "2026-10-15T01:16:21+0800"
updated_at: "2026-10-15T01:26:30+0800"
fixed_at: "2026-10-15T01:26:30+0800"
impact:
  - workspace-switch
  - terminal-rendering
links:
  discovered_in: "使用者轉述連國盛回報（2026-10-15 01:06）"
  fix_workorder: T0531
  related: [BUG-127]
---

# BUG-134 — 空工作區主畫面殘留其他終端畫面

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（看起來像當機，使用者誤判程式掛掉；新增終端可恢復） |
| 可重現 | 必現（使用者 pre.10 本機重現，2026-10-15 01:22） |
| **狀態** | ✅ FIXED（T0531：隱藏工作區的 active 分頁面板改為真正隱藏 + 空工作區空狀態 + removeTerminal focus 不跨工作區） |
| 回報者 | 連國盛（使用者轉述，2026-10-15 01:06），Windows；BAT 版本未知（推測 pre.8 以後） |

## 現象

1. 工作區「專案B」的終端全部關閉（回報者不小心連塔台終端也關掉）
2. 主畫面（「終端」分頁上半部）**仍顯示一個 `Claude CLI` 終端的完整畫面**（Claude Code 對話內容 + 輸入列 `auto mode on`）
3. 回報者認為那是 **better-agent-terminal 工作區**的終端畫面（截圖箭頭指向側欄的 better-agent-terminal）；畫面內容提到 LocalTuning 塔台，也有可能是本工作區剛關掉的終端殘影 —— 兩種都要查
4. 這個畫面**無法操作**（看起來像當機）
5. 下方「終端」縮圖列是空的（只有 `+` 按鈕）
6. 按 `+` 新增終端後，新終端蓋過去，顯示恢復正常

截圖：`<使用者資料夾>\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\3f162c76-5cbd-4d39-b2bf-bc54787fedd6\images\2.png`（視窗標題 `Better Agent Terminal - Default:1`，側欄 active = 專案B；工作區另有 BMAD、better-agent-terminal）

### 使用者本機重現（2026-10-15 01:22，pre.10）

使用者在自己的 BAT（安裝版 pre.10）重現成功，**情境 (a) 確認**：active 工作區 = `<專案B>`，主畫面顯示的是 **better-agent-terminal 工作區的塔台 Claude CLI 分頁**（本塔台 session），下方縮圖列為空。截圖：`<使用者資料夾>\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\3f162c76-5cbd-4d39-b2bf-bc54787fedd6\images\3.png`

## 根因（T0531）

情境 **(a)**：顯示的是**其他工作區**的終端，不是本工作區已關閉終端的殘影（關閉的終端 React 元件卸載、DOM 移除，沒有殘留）。

- 已造訪過的工作區都保持掛載，以 `.workspace-container.hidden { visibility: hidden; pointer-events: none }` 隱藏（`src/styles/layout.css`）。`visibility` 會被子元素覆寫，而 `.workspace-tab-panel.active { visibility: visible; pointer-events: auto }` 正好把每個隱藏工作區的 active 分頁面板翻回可見 ⇒ 隱藏工作區的終端分頁其實一直在畫，只是被 active 工作區（`z-index: 1`）蓋住。
- active 工作區沒有終端時，它的 `.terminals-container` 是透明的（沒有背景、沒有子元素），底下隱藏工作區的 active 分頁就透出來；多個隱藏工作區時，DOM 順序最後（側欄最下面）的那個畫在最上層，與回報者看到 better-agent-terminal 一致。
- **無法操作**：滑鼠事件命中的是上層 active 工作區那個空的 `.terminals-container`（e2e 以 `elementFromPoint` 實測），鍵盤 focus 也不在隱藏工作區的 xterm 上。按 `+` 新增終端後，新終端（有背景）蓋過去，所以「恢復正常」。
- 塔台 / Agent 預設終端沒有特殊分支：`mainTerminal = focusedTerminal || agentTerminal || terminals[0]` 只在本工作區的 `terminals` 內選；畫面是哪一種終端，只取決於透出來的那個隱藏工作區當時的 active 終端。
- 附帶缺陷：`workspaceStore.removeTerminal()` 關掉 focus 終端時 fallback 到**全域**第一個終端，關掉工作區最後一個終端後 focus 會指向其他工作區的終端（snippet 貼上、Skills / Agents 面板的 active session 等讀 `focusedTerminalId` 的功能會指錯對象）。不是畫面殘留的成因，一併修正。

## 預期

工作區沒有任何終端時，主畫面顯示空狀態（或「新增終端」提示），不得顯示其他工作區或已關閉終端的畫面。

## 備註

- 使用者指示：先從程式碼分析，找不出原因再向回報者要 debug log + `bat-scripts.log`
- 修正（T0531）：`.workspace-container.hidden .workspace-tab-panel.active { visibility: hidden; pointer-events: none }`；`WorkspaceView` 終端分頁在 0 個終端時渲染不透明空狀態（`terminals-empty-state`，三語 `terminal.emptyWorkspace` / `terminal.addTerminal`，含「新增終端」按鈕）；`removeTerminal` 的 focus fallback 限同工作區，沒有則 `null`。驗證：`src/stores/__tests__/workspace-store.removeTerminal.test.ts`、e2e `e2e/t0531-empty-workspace-view.spec.ts`
- 相關：BUG-127（切換工作區時的指揮塔 toast / 「殘影」，T0521）—— 「殘影」用詞相同，但 BUG-127 是 toast，本單是主畫面終端
