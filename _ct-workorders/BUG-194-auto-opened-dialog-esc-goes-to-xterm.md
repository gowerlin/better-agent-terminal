---
schema_version: 1
schema_kind: bug
id: BUG-194
title: "自動開啟的對話框（recovery 後「被中斷的分頁」）第一次按 Esc 關不掉，Esc 送進背景分頁的 PTY"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-11-02T05:26:29+0800"
updated_at: "2026-11-02T09:59:20+08:00"
fixed_at: "2026-11-02T05:56:34+0800"
fix_commit: e717c786
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
| **狀態** | ✅ FIXED（T0776 `e717c786`，已發版 `v0.7.3-pre.5`，待驗收） |
| 回報者 | T0773 Worker（F1） |

## 現象

- Terminal Server recovery 後「被中斷的分頁」對話框（`InterruptedAgentsDialog`）自動開啟，但鍵盤焦點仍在原分頁的 xterm（`document.activeElement` = `TEXTAREA.xterm-helper-textarea`，不在對話框內）。
- 按 Esc：xterm 把 Esc 送進 PTY 並取消事件，`modal-stack` 掛在 `document` bubble 階段的監聽器收不到，對話框保持開啟。點一下對話框（焦點移到 `BODY`）後 Esc 才關閉。
- 預期（CLAUDE.md「Dialog 不因點擊外部關閉（T0563）、Esc 統一（T0567）」節）：Esc 一律經 `ModalOverlay` 的 `onEscape` 關閉最上層 Dialog，不送進背景分頁。
- 證據：T0773 log `② focus when the dialog had opened by itself: {"tag":"TEXTAREA","cls":"xterm-helper-textarea","inXterm":true,"inDialog":false}; first Esc closed the dialog: false`；點對話框標題後 `second Esc closed the dialog: true`。
- 重現：`BAT_E2E_REAL_MODEL=1 BAT_E2E_EXECUTABLE=<安裝版> npx playwright test e2e/t0773-real-agents-recovery-resume.spec.ts`；手動：開 claude-cli 分頁並點進終端 → 結束該實例的 Terminal Server → 對話框自動出現後直接按 Esc。
- 未查證：其他「不經點擊、自動開啟」的 Dialog 是否同樣（推論機制相同）。
- 可能修法（T0773 提出，未評估）：對話框開啟時把焦點移進對話框；或 modal-stack 改在 capture 階段攔 Esc（會影響 T0567「對話框內的選單 / 自動完成先處理 Esc」的規則）。

## 修正（T0776 `e717c786`，2026-11-02T05:56:34+0800）

- 盤點：自動開啟的 Dialog 有 `InterruptedAgentsDialog`（recovery）、`SettingsPanel`（`app:open-settings`，detached 開設定）、`AppNotificationDialog`（非同步通知）、`RecoveryPrompt`（無 `onEscape`）；修正前前兩者 e2e 實測第一次 Esc 寫進 PTY（`1b`）且沒關。`UpdateNotification` 沒有掛載，不適用。
- 修正：`ModalOverlay` 掛載時若焦點不在 Dialog 內就聚焦遮罩元素（`tabIndex=-1`），`autoFocus` 子元素不搶；關閉時焦點回到開啟前的元素。唯一實作 `takeDialogFocus` / `restoreDialogFocus`（`src/components/common/modal-stack.ts`）。T0567 Esc 規則、T0563 點遮罩不關、xterm 按鍵處理都沒改。
- 驗證：單元 12 項＋3 種突變；e2e t0776 修正前失敗、修正後 ①（recovery 對話框）② Settings 第一次 Esc 關閉、PTY 沒收到、焦點回 xterm；t0563 / t0567 / t0766 / t0767 不回歸；typecheck 0 / 0、`test:unit` 6705 passed / 382 files、`vite build`。塔台複跑 `dialog-auto-focus` ＋ `dialog-escape` 33 / 33。
- 行為變化：所有 Dialog 關閉後焦點回到開啟前的元素（原本落在 `<body>`）。
- 未涵蓋：`RecoveryPrompt` 只有單元測試。
