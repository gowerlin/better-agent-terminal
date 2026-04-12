# 💡 PLAN-001：Vite v5 → v6 升級

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-001 |
| **狀態** | 💡 IDEA |
| **優先級** | 🟢 Low |
| **提出時間** | 2026-04-12 (UTC+8) |
| **提出人** | 塔台（T0034 依賴審計發現） |
| **預估規模** | 小（Vite 升級通常相容） |
| **類型** | 技術債 |

---

## 動機 / 背景

目前使用 Vite v5。Vite v6 已釋出，繼續使用 v5 會產生 CJS 相容性警告（`[vite:dts] Vite CJS mode is deprecated...`）。

升級到 v6 可消除此警告，且通常向後相容。

## 預期效益

- 消除 CJS 模式棄用警告
- 使用更新的 Vite 特性

## 風險

- Vite v6 的 breaking changes 可能影響 Electron 相容性
- electron-plugin-vite 需確認支援 Vite v6

## 相關單據

- **依賴**：建議在 Milestone 開頭做，配合 GP009 安全掃描

## 塔台決策

- **決定**：待分派
- **建議時機**：下一個 Milestone 開頭
