---
schema_version: 1
schema_kind: bug
id: BUG-194
title: "自動開啟的對話框（recovery 後「被中斷的分頁」）第一次按 Esc 關不掉，Esc 送進背景分頁的 PTY"
status: FIXING
severity: low
reproducibility: always
created_at: "2026-11-02T05:26:29+0800"
updated_at: "2026-11-02T05:28:58+0800"
impact:
  - dialog
  - terminal
links:
  discovered_in: "T0773 回報〈發現的問題〉F1（`v0.7.3-pre.4` 安裝版，隔離實例）"
  related: [T0773, T0766, T0567, PLAN-055]
---
# BUG-194 — 自動開啟的對話框第一次按 Esc 關不掉，Esc 送進背景分頁的 PTY

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（recovery 後 agent 分頁已只剩 shell，影響小；但違反「Esc 統一」規則，其他自動開啟的 Dialog 可能同樣） |
| 可重現 | 必現（T0773 兩次執行） |
| **狀態** | 🔧 FIXING（T0776，D217） |
| 回報者 | T0773 Worker（F1） |

## 現象

- Terminal Server recovery 後「被中斷的分頁」對話框（`InterruptedAgentsDialog`）自動開啟，但鍵盤焦點仍在原分頁的 xterm（`document.activeElement` = `TEXTAREA.xterm-helper-textarea`，不在對話框內）。
- 按 Esc：xterm 把 Esc 送進 PTY 並取消事件，`modal-stack` 掛在 `document` bubble 階段的監聽器收不到，對話框保持開啟。點一下對話框（焦點移到 `BODY`）後 Esc 才關閉。
- 預期（CLAUDE.md「Dialog 不因點擊外部關閉（T0563）、Esc 統一（T0567）」節）：Esc 一律經 `ModalOverlay` 的 `onEscape` 關閉最上層 Dialog，不送進背景分頁。
- 證據：T0773 log `② focus when the dialog had opened by itself: {"tag":"TEXTAREA","cls":"xterm-helper-textarea","inXterm":true,"inDialog":false}; first Esc closed the dialog: false`；點對話框標題後 `second Esc closed the dialog: true`。
- 重現：`BAT_E2E_REAL_MODEL=1 BAT_E2E_EXECUTABLE=<安裝版> npx playwright test e2e/t0773-real-agents-recovery-resume.spec.ts`；手動：開 claude-cli 分頁並點進終端 → 結束該實例的 Terminal Server → 對話框自動出現後直接按 Esc。
- 未查證：其他「不經點擊、自動開啟」的 Dialog 是否同樣（推論機制相同）。
- 可能修法（T0773 提出，未評估）：對話框開啟時把焦點移進對話框；或 modal-stack 改在 capture 階段攔 Esc（會影響 T0567「對話框內的選單 / 自動完成先處理 Esc」的規則）。
