# 💡 PLAN-002：Dynamic Import 衝突修正

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-002 |
| **狀態** | 🚫 DROPPED 2026-04-26 — 觸發點已錯過 + 痛點未活化:(1) 原計劃「搭配 Vite 升級一起做」,Vite 7.x 已於 2026-04-18 升完(PLAN-003/T0163)未一併處理;(2) 4 個衝突 panel 自然演進到 3 個（FileTree 兩處皆 lazy 已一致）;(3) 純預防性,無 user-facing 痛點;(4) 目前 hybrid 策略合理（常用 sidebar panel 立即可用,MainZone/FileTree lazy 省 bundle）。如未來新增 panel 撞到實際 bundling/runtime 問題再開新 PLAN |
| **優先級** | 🟢 Low |
| **提出時間** | 2026-04-12 (UTC+8) |
| **提出人** | 塔台（T0034 依賴審計發現） |
| **預估規模** | 小 |
| **類型** | 技術債 |

---

## 動機 / 背景

`SnippetPanel`、`SkillsPanel`、`AgentsPanel`、`FileTree` 在 `App.tsx` 中使用靜態 import，但在 `WorkspaceView` 中又有動態 import（`React.lazy`），導致 import 策略不一致，可能引起 bundling 問題或運行時不可預期行為。

## 預期效益

- 統一 import 策略，提升可預測性
- 可能改善 initial bundle size（若改為全動態 import）

## 相關單據

- **相關**：PLAN-001（Vite 升級後一起做更安全）

## 塔台決策

- **決定**：待分派
- **建議時機**：可搭配 Vite v6 升級一起做
