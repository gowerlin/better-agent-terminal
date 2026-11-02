---
schema_version: 1
schema_kind: bug
id: BUG-193
title: "視窗沒有焦點時留下的淡化 ⚠️，點另一個分頁取回焦點時被當成「看過」清掉"
status: CLOSED
severity: low
reproducibility: always
created_at: "2026-11-02T05:24:41+0800"
updated_at: "2026-11-02T10:50:16+0800"
fixed_at: "2026-11-02T05:38:26+0800"
closed_at: "2026-11-02T10:50:16+0800"
closed_reason: verified
fix_commit: bd59ab0f
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
| **狀態** | 🚫 CLOSED（T0774 `bd59ab0f`；交付版 `v0.7.3-pre.5` 安裝版自動化實測 T0777 PASS，含作業系統真實點擊） |
| 回報者 | T0770 Worker（觀察 2），使用者裁示修正（D216） |

## 現象

- 重現：分頁 X 等待中且是 active → BAT 視窗失焦 → X 的等待結束（留淡化 ⚠️，D203）→ 用滑鼠點另一個分頁 Y 的縮圖 → X 的淡化 ⚠️ 消失，使用者並沒有看到 X。
- 推論機制：點擊先讓視窗取得焦點，`window` `focus` 事件觸發 `App.tsx` 的 `setViewingState(focusedTerminalId, document.hasFocus())`，那一刻 active 仍是 X → 依 D203「有焦點時的 active 分頁 = 看過」清除；之後 click handler 才切到 Y。
- 預期：取回焦點的那次點擊若切到別的分頁，X 的淡化 ⚠️ 保留；只有焦點回來後仍停在 X（或之後切到 X）才清除。只恢復焦點、不點擊（例 Alt+Tab 回來）且 active 是 X → 照 D203 清除。
- 未確認：實體滑鼠點擊時，作業系統的 focus 與 click 事件順序是否與 Playwright（CDP）相同（T0770〈仍需手動〉）。

## 修正（T0774 `bd59ab0f`，2026-11-02T05:38:26+0800）

- 查證（隔離實例、Electron 41.2.1 / Chromium 146）：Playwright（CDP）點擊與作業系統真實點擊（user32 `mouse_event`，點前以 HWND 確認是隔離實例主視窗）順序相同：`window.focus` 先到、約 1.6 ms 後 `pointerdown`，分頁切換在 `click` 之後 —— 與推論相同。
- 修正：視窗由失焦變有焦點時暫緩當下 active 的分頁（`createFocusRegainGate`，`src/stores/terminal-attention-store.ts`）；100 ms 內沒有 `pointerdown` → 照 D203 判斷；有 → 等 `pointerup` 後 50 ms 再判斷（仍停在原分頁才算看過）；上限 10 s。常數集中在 `src/lib/terminal-attention.ts`；`App.tsx` viewing effect 接 focus / blur / pointer 事件；`nextWaitMemory` 未改。日誌 `[workspace-waiting] focus regain: … → looked at|kept`。
- 驗證：單元 12 案＋突變（9 案失敗）；e2e t0770 新增 E，修正前失敗、修正後 A–E 全 PASS；t0735 / t0761 / t0762 綠；typecheck 0 / 0、`test:unit` 6693 passed / 381 files、`vite build`。塔台複跑新單元 12 / 12。
- 已知：Alt+Tab 回來後淡化最多延後 100 ms 清除；macOS / Linux 事件順序未實測。

## 驗收（2026-11-02T10:50:16+0800，第一百零四 session）

- 依據（R-G003）：交付版 `v0.7.3-pre.5` 安裝版（`BAT_E2E_EXECUTABLE`，隔離實例）T0777（`e1e7f2d1` / 回報 `954b0348`）：t0770 A–E PASS（E：Playwright 點另一個分頁取回焦點 → 原分頁淡化保留）；新 `e2e/t0777-real-click-focus-regain.spec.ts` 以 user32 `SetCursorPos` + `mouse_event` 真實點擊（點前 HWND 比對 `rootMatches:true`）→ 淡化保留、log `focus regain: … → kept`；切回 → 清除。不回歸 t0735 / t0761 / t0762 / t0757 綠。
- 未涵蓋：多螢幕、Alt+Tab 後點擊、觸控板；macOS / Linux。
