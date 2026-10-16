---
schema_version: 1
schema_kind: plan
id: PLAN-045
title: 塔台分頁標題：`/control-tower` 啟動後 BAT 分頁改為 `<Agent 顯示名> · Tower`（D147）
status: IN_PROGRESS
priority: medium
created_at: "2026-10-16T14:56:56+0800"
updated_at: "2026-10-16T14:56:56+0800"
links:
  related: [D147, T0562, CT-T013, T0553]
---

# PLAN-045 — 塔台分頁標題

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-045 |
| 優先級 | 🟡 Medium |
| 狀態 | 🔄 IN_PROGRESS（T0562 / T0565 DONE；CT v5.2.0 DONE（CT-T013）；待 0.6.1-pre.6 實機） |
| 來源 | 使用者需求（2026-10-16 第六十七 session），決策 D147 |

## 動機

塔台分頁與 Worker 分頁（T0553 `Claude CLI · Worker · T####`）一樣一眼可辨。

## 規格（D147）

- 格式 `<Agent 顯示名> · Tower`；使用者改過名就保留；本機 + 遠端；塔台結束後維持
- BAT：helper `bat-terminal.mjs --set-role tower`（T0562，介面契約在工單內）
- CT：Tower 啟動時呼叫一次，任何非 0 視為不支援（CT-T013，BMad-Guide 塔台派發）

## 階段

1. T0562（BAT，實作中）
2. CT-T013（CT 下一版）
3. 發版（`0.6.1-pre.6`）後實機確認

## 進度（2026-10-16）

- T0562 `4faa93ab`、T0565 `4936f440`（`--mode`，D148）DONE
- CT-T013 → BMad-Guide T0139：CT v5.2.0 發佈並安裝（Claude / Codex），舊 BAT 降級已驗
- 待：`0.6.1-pre.6` 發版後，新 Tower session 實機確認標題與 mode
