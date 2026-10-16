---
schema_version: 1
schema_kind: plan
id: PLAN-045
title: 塔台分頁標題：`/control-tower` 啟動後 BAT 分頁改為 `<Agent 顯示名> · Tower`（D147）
status: DONE
priority: medium
created_at: "2026-10-16T14:56:56+0800"
updated_at: "2026-10-16T17:29:35+0800"
links:
  related: [D147, T0562, CT-T013, T0553]
---

# PLAN-045 — 塔台分頁標題

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-045 |
| 優先級 | 🟡 Medium |
| 狀態 | ✅ DONE（T0562 / T0565、CT v5.2.0（CT-T013）；0.6.1-pre.6 實機 PASS，2026-10-16） |
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
- ✅ 2026-10-16 17:29 實機 PASS（第六十八 session）：本機 BAT `0.6.1-pre.6`，Tower 啟動 `--set-role tower --mode on --agent claude` exit 0（`✓ Tower role set` / `mode: on`），標題 `Claude CLI · Tower`；同批使用者確認 Dialog 點遮罩不關 / Esc / 精靈 Esc 不作用、Settings → Advanced 用量限制開關 PASS → **PLAN-045 DONE**
- 仍待：首次真實撞用量限制時看 `[usage-limit]`（Codex 自動輸入未在真 codex 驗證；不阻擋本 PLAN）
