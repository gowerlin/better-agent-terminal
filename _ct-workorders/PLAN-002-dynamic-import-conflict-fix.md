# 💡 PLAN-002：Dynamic Import 衝突修正

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-002 |
| **狀態** | 💡 IDEA |
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
