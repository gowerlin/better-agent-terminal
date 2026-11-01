---
schema_version: 1
schema_kind: bug
id: BUG-188
title: "用滑鼠回答（拒絕權限、取消 AskUserQuestion、codex 等待輸入）後 ⚠️ 不清除，與鍵盤回答結果不一致"
status: FIXING
severity: medium
reproducibility: always
created_at: "2026-11-02T02:23:44+0800"
updated_at: "2026-11-02T02:23:44+0800"
impact:
  - terminal-attention
  - blocked-state
links:
  discovered_in: "使用者指示（2026-11-02，第一百零四 session）：工作區 ⚠️ 手動驗收項「滑鼠回答後清除」；`docs/agent-guide/blocked-state.md`〈清除漏洞〉"
  related: [T0757, T0590, T0594, T0597, T0620, T0657, T0735, D209]
---
# BUG-188 — 用滑鼠回答（拒絕權限、取消 AskUserQuestion、codex 等待輸入）後 ⚠️ 不清除，與鍵盤回答結果不一致

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（回答了仍顯示等待使用者，縮圖 / 工作區 ⚠️ 誤導，等到回合結束才消失） |
| 可重現 | 依路徑而定（見現象） |
| **狀態** | 🔧 FIXING（T0757） |
| 回報者 | 使用者（D209：鍵盤或滑鼠回答，結果都是有回答，⚠️ 都要清除） |

## 現象

- 鍵盤輸入算使用者輸入，會清除 hook 記的 `blocked`（`permission` / `question` / `elicitation`）。滑鼠回報屬 `isTerminalAutoReply`，不算輸入。
- 已由 hook 清除（但部分只靠二進位靜態閱讀，未實機觸發）：AskUserQuestion 以滑鼠回答（`PostToolUse(AskUserQuestion)`，T0597）、權限以滑鼠允許（`post-tool-batch`，T0657）、elicitation 以滑鼠回答（`elicitation-done`，T0620）。
- 仍未涵蓋（`blocked` 維持到該回合 `Stop` 或鍵盤輸入）：權限對話框以滑鼠**拒絕**而結束回合（`cancelAndAbort`，`Stop` 是否執行未查證）、AskUserQuestion 以滑鼠**取消 / 拒絕**（tool 未執行，沒有 `PostToolUse`）。
- codex：`blockedReason: input` 由 codex 自己送 OSC 7501 清除，🔴 使用者輸入不清除；滑鼠回答時 codex 是否送 `working` / `idle` 未實測。
- 預期（D209）：不論鍵盤或滑鼠回答，回答後 ⚠️（縮圖、工作區列）都清除；看著分頁時回答不留淡化（D203）。
