---
schema_version: 1
schema_kind: plan
id: PLAN-044
title: yolo 分頁遇到 claude / codex 5 小時用量限制時，BAT 在解鎖時間（+ 可設延遲）自動輸入「繼續」
status: DONE
priority: medium
created_at: "2026-10-16T14:55:14+0800"
updated_at: "2026-10-16T15:05:50+0800"
links:
  related: [T0564, T0565, T0566, D148, PLAN-041, BUG-140, T0551]
---

# PLAN-044 — 用量限制解鎖後自動繼續

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-044 |
| 優先級 | 🟡 Medium |
| 狀態 | ✅ DONE（T0565 `4936f440`、T0566 `2e3305a9`；實機待首次真實撞限制） |
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

## 範圍修訂（D148，2026-10-16 T0564 研究後）

- **claude**：CLI ≥ 2.1.234 內建 `autoContinueAtUsageLimit`（預設開），BAT **不送**「繼續」；只辨識並提示（何時自動繼續 / 週限制不會自動繼續），電腦休眠跨過重置、CLI 停在 `Press enter to continue` 時只補 Enter。內建不可用（API key、舊 CLI、關閉）→ 只提示。使用者同事亦口頭確認此 CLI 行為。
- **codex**：完整自動輸入（重置 + 延遲 → 再確認 → 文字 + Enter）；週限制只提示。
- **Settings**：預設關、文字「繼續」、延遲 2 分。
- **塔台 yolo 辨識**：`--set-role tower --mode <m>`（T0565），CT-T013 同步。
- 實作：T0565（塔台模式宣告）→ T0566（偵測 / 排程 / 送出 / 提示 / Settings）。
- **外部查證**（使用者 2026-10-16 提供，第三方轉述官方文件，非官方原文）：與 T0564 [碼] 一致（2.1.234 起、session 需保持開啟、連續重排上限 2 次、> 24 h 不等、API key / 雲端供應商 / 按量計費不適用）。新增一點：此鍵只從使用者設定、`--settings`、managed settings 讀取；若這些都沒設而專案層 `.claude/settings.json` / `settings.local.json` 有設，功能會被**關閉**。本 repo 與使用者層皆未設（2026-10-16 塔台 grep）。
