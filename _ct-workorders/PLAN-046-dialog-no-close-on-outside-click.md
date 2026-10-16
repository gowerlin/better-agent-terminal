---
schema_version: 1
schema_kind: plan
id: PLAN-046
title: Dialog 不因點擊外部而關閉：只能經 [X] / [確認] / [取消]（與 Esc）
status: IN_PROGRESS
priority: medium
created_at: "2026-10-16T14:56:56+0800"
updated_at: "2026-10-16T14:56:56+0800"
links:
  related: [T0563]
---

# PLAN-046 — Dialog 不因點擊外部而關閉

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-046 |
| 優先級 | 🟡 Medium |
| 狀態 | 🔄 IN_PROGRESS（T0563 DONE `132aa4b4`；T0567 Esc 統一進行中） |
| 來源 | 使用者需求（2026-10-16 第六十七 session） |

## 動機

Dialog 在外部點一下就關閉，誤觸會讓輸入到一半的內容消失；setup wizard 的取消還會觸發 rollback。

## 規格（使用者選定）

- 只改 Dialog；右鍵選單、下拉選單、小型 popover 照舊點外部關閉
- 關閉只經 [X] / [確認] / [取消]；Esc 保留（既有的保留，不新增）
- 缺少明確關閉按鈕的 Dialog 補 [X]
- 盡量抽共用做法 + source guard，防止新 Dialog 又加回點遮罩關閉

## 階段

1. T0563（盤點 + 實作 + 測試 + CLAUDE.md 規則）
2. T0567（使用者 2026-10-16 決定：統一補 Esc = [×] / 取消、只作用於最上層；設定精靈開著時 Esc 不作用；RecoveryPrompt 不套用）
