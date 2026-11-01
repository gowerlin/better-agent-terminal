---
schema_version: 1
schema_kind: bug
id: BUG-185
title: "e2e `t0512-profile-panel-layout` 第 2 項（WSL 精靈完成區塊）失敗：`WIZARD_STUBS` 缺 T0554 新增的 `wsl-systemd:snapshot-unit`"
status: OPEN
severity: low
reproducibility: always
created_at: "2026-11-01T22:24:08+0800"
updated_at: "2026-11-01T22:24:08+0800"
impact:
  - e2e-test
links:
  discovered_in: "T0750 回報區〈發現的問題〉1（2026-11-01）"
  related: [T0750, T0554, T0512]
---

# BUG-185 — t0512 精靈完成區塊 e2e 缺 stub

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只有測試失敗；產品行為不受影響） |
| 可重現 | 一定（T0750 Worker 實跑） |
| **狀態** | 📂 OPEN |
| 回報者 | T0750 Worker |

## 現象

- `e2e/t0512-profile-panel-layout.spec.ts` 第 2 項（setup wizard completion block）在精靈第 5 步「設定並啟動伺服器服務」失敗，alert「無法讀取目前的 BAT 服務」。
- 預期：stub 齊全時精靈走到完成區塊、版面斷言通過。
- 原因（T0750 Worker 判讀，塔台唯讀確認）：spec 的 `WIZARD_STUBS` 沒有 T0554 新增的 `wsl-systemd:snapshot-unit`（spec 內 `grep snapshot-unit` 0 筆；`electron/main.ts`、`electron/preload.ts` 有此 channel）。失敗點在 `write-profile` 之前，與 T0750 的改動無關。
- 第 1 項（profiles dialog layout）照常通過。

## 修正方向

- spec 補 `wsl-systemd:snapshot-unit` stub（回傳值依 handler 契約），重跑第 2 項綠；順帶檢查 `WIZARD_STUBS` 與精靈目前呼叫的 channel 是否還有其他落差。
