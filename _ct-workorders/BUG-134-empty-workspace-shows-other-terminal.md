---
schema_version: 1
schema_kind: bug
id: BUG-134
title: "工作區的終端全部關閉後，主畫面殘留顯示另一個工作區（或已關閉）的 Agent 終端畫面，無法操作、看起來像當機"
status: FIXING
severity: medium
reproducibility: unknown
created_at: "2026-10-15T01:16:21+0800"
updated_at: "2026-10-15T01:16:21+0800"
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
| 可重現 | 未確認（回報者偶然觸發：把該工作區的終端含塔台全部關掉） |
| **狀態** | 🔧 FIXING（T0531） |
| 回報者 | 連國盛（使用者轉述，2026-10-15 01:06），Windows；BAT 版本未知（推測 pre.8 以後） |

## 現象

1. 工作區「臺灣土地銀行」的終端全部關閉（回報者不小心連塔台終端也關掉）
2. 主畫面（「終端」分頁上半部）**仍顯示一個 `Claude CLI` 終端的完整畫面**（Claude Code 對話內容 + 輸入列 `auto mode on`）
3. 回報者認為那是 **better-agent-terminal 工作區**的終端畫面（截圖箭頭指向側欄的 better-agent-terminal）；畫面內容提到 LocalTuning 塔台，也有可能是本工作區剛關掉的終端殘影 —— 兩種都要查
4. 這個畫面**無法操作**（看起來像當機）
5. 下方「終端」縮圖列是空的（只有 `+` 按鈕）
6. 按 `+` 新增終端後，新終端蓋過去，顯示恢復正常

截圖：`C:\Users\Gower\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\3f162c76-5cbd-4d39-b2bf-bc54787fedd6\images\2.png`（視窗標題 `Better Agent Terminal - Default:1`，側欄 active = 臺灣土地銀行；工作區另有 BMAD、better-agent-terminal）

## 預期

工作區沒有任何終端時，主畫面顯示空狀態（或「新增終端」提示），不得顯示其他工作區或已關閉終端的畫面。

## 備註

- 使用者指示：先從程式碼分析，找不出原因再向回報者要 debug log + `bat-scripts.log`
- 相關：BUG-127（切換工作區時的指揮塔 toast / 「殘影」，T0521）—— 「殘影」用詞相同，但 BUG-127 是 toast，本單是主畫面終端
