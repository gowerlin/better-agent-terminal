---
schema_version: 1
schema_kind: bug
id: BUG-193
title: "視窗沒有焦點時留下的淡化 ⚠️，點另一個分頁取回焦點時被當成「看過」清掉"
status: OPEN
severity: low
reproducibility: always
created_at: "2026-11-02T05:24:41+0800"
updated_at: "2026-11-02T05:24:41+0800"
impact:
  - terminal-attention
links:
  discovered_in: "T0770 回報〈發現的問題〉觀察 2（`v0.7.3-pre.4` 安裝版，Playwright 滑鼠點擊重現）"
  related: [T0770, T0735, T0774, D203, D216]
---
# BUG-193 — 視窗沒有焦點時留下的淡化 ⚠️，點另一個分頁取回焦點時被當成「看過」清掉

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（淡化 ⚠️ 提早消失，使用者可能錯過那個分頁的等待結束） |
| 可重現 | Playwright 滑鼠點擊必現；實體滑鼠未實測 |
| **狀態** | 📂 OPEN（D216：開單修正，T0774） |
| 回報者 | T0770 Worker（觀察 2），使用者裁示修正（D216） |

## 現象

- 重現：分頁 X 等待中且是 active → BAT 視窗失焦 → X 的等待結束（留淡化 ⚠️，D203）→ 用滑鼠點另一個分頁 Y 的縮圖 → X 的淡化 ⚠️ 消失，使用者並沒有看到 X。
- 推論機制：點擊先讓視窗取得焦點，`window` `focus` 事件觸發 `App.tsx` 的 `setViewingState(focusedTerminalId, document.hasFocus())`，那一刻 active 仍是 X → 依 D203「有焦點時的 active 分頁 = 看過」清除；之後 click handler 才切到 Y。
- 預期：取回焦點的那次點擊若切到別的分頁，X 的淡化 ⚠️ 保留；只有焦點回來後仍停在 X（或之後切到 X）才清除。只恢復焦點、不點擊（例 Alt+Tab 回來）且 active 是 X → 照 D203 清除。
- 未確認：實體滑鼠點擊時，作業系統的 focus 與 click 事件順序是否與 Playwright（CDP）相同（T0770〈仍需手動〉）。
