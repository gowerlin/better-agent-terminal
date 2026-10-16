---
schema_version: 1
schema_kind: plan
id: PLAN-044
title: yolo 分頁遇到 claude / codex 5 小時用量限制時，BAT 在解鎖時間（+ 可設延遲）自動輸入「繼續」
status: PLANNED
priority: medium
created_at: "2026-10-16T14:55:14+0800"
updated_at: "2026-10-16T14:55:14+0800"
links:
  related: [T0564, PLAN-041, BUG-140, T0551]
---

# PLAN-044 — 用量限制解鎖後自動繼續

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-044 |
| 優先級 | 🟡 Medium |
| 狀態 | 📋 PLANNED |
| 來源 | 使用者需求（2026-10-16 第六十七 session） |

## 動機

塔台 auto-session yolo 時，Tower 或 Worker 分頁的 claude / codex 會撞到 5 小時用量限制，整條自動流程停住，要人回來手動輸入「繼續」。希望 BAT 認出限制與解鎖時間，時間到自動送出。

## 使用者選定的規格（2026-10-16）

- **範圍**：只套用在 yolo 分頁（`CT_MODE=yolo` 的 Worker，以及以 yolo 運作的塔台分頁）；一般手動使用的 agent 分頁不自動輸入
- **輸入內容**：可在 Settings 設定，預設「繼續」，送出後按 Enter
- **延遲**：解鎖時間後再等一段可設定的時間（例：2 分鐘），避免時差 / 時鐘誤差
- **取消條件**：等待期間使用者在該分頁打字（沿用 T0551 / BUG-140：終端自動回應不算輸入）；解鎖時畫面已不是限制訊息；**週（7 天）限制不自動繼續**（只提示）
- 訊息樣本：從 CLI 安裝包與既有日誌找，不為了觸發限制而消耗額度

## 階段

1. **T0564 研究**：兩個 CLI 的限制訊息原文 / 重置時間格式 / 結構化來源、偵測與送出設計、風險
2. 實作單（依 T0564 結論開）
