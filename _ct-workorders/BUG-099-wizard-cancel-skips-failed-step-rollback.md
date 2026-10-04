---
schema_version: 1
schema_kind: bug
id: BUG-099
title: "設定精靈在失敗畫面按取消時，不會 rollback 正在失敗的步驟（只 rollback 已完成步驟）"
status: OPEN
severity: low
reproducibility: always
created_at: "2026-10-05T00:04:10+08:00"
updated_at: "2026-10-05T00:04:10+08:00"
impact:
  - setup-wizard-ssh
links:
  fix_workorder: null
  related: [T0387, BUG-100, PLAN-032]
---

# BUG-099 — 設定精靈在失敗畫面按取消時，不會 rollback 正在失敗的步驟（只 rollback 已完成步驟）

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（各步驟可自行在失敗時清理；但 `start-server` 等有 `rollback()` 的步驟會漏清） |
| 可重現 | 推定 100%（程式碼證據；既有問題，非 T0387 引入） |
| **狀態** | 📂 OPEN |
| 回報者 | T0387 Worker（回報區「已知限制」）；塔台 2026-10-05 00:04 抽查 |

## 現象（T0387 回報）

- `src/components/setup-wizard/wizard-runner.ts` `cancel()` 以 `retry` 結果解除等待，迴圈頂端只 rollback **已完成**步驟，失敗中的步驟 `rollback()` 不被呼叫
- T0387 以「SSH fetch-fingerprint 失敗時自行關 tunnel」繞過；runner 未改（避免影響 WSL / Docker）

## 修復方向

- runner 取消時對當前失敗步驟呼叫 `rollback()`；需檢視 WSL / Docker / SSH 所有步驟的 rollback 冪等性
