# PLAN-009 — Sprint 儀表板 UI（讀取 sprint-status.yaml）

## 狀態
**📋 BACKLOG**（技術債清完後再實作）

## 背景

2026-04-13：CT 面板原有 Sprint 頁籤，因空空的無內容而被改造成其他功能。
現在 sprint-status.yaml（T0098）建立後，該頁面有了可顯示的資料。

決策：列入 PLAN，待技術債與執行中計畫（PLAN-008）清完後再實作。

## 目標

將 CT 面板的 Sprint 頁面（或重新設計一個 Dashboard 頁）改造為能讀取
sprint-status.yaml 的即時進度儀表板。

## 預期功能

- 顯示當前里程碑（Phase）進度
- 列出進行中工單（IN_PROGRESS / TODO）
- 顯示 BUG 統計（Open / Fixing / Closed）
- 自動讀取 sprint-status.yaml，無需手動刷新

## 前置條件

- [ ] BUG-025 修復完成（T0101）
- [ ] PLAN-008 Phase 2 架構確認
- [ ] sprint-status.yaml 格式穩定（不再大改）

## 相關工單

- T0098：產生 sprint-status.yaml（已完成）
- T0100：BUG-025 診斷（已完成）
