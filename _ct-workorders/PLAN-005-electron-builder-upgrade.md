# 💡 PLAN-005：electron-builder 24 → 26 升級

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-005 |
| **狀態** | 💡 IDEA |
| **優先級** | 🟢 Low |
| **提出時間** | 2026-04-12 (UTC+8) |
| **提出人** | 塔台（T0034 依賴審計） |
| **預估規模** | 中（可能有 config 格式變更） |
| **類型** | 技術債 |

---

## 動機 / 背景

目前使用 electron-builder 24.x，最新穩定版為 26.x。electron-builder 是打包工具（dev dependency），安全漏洞不直接影響 runtime，但升級可獲得：
- 更好的 macOS notarization 支援
- Apple Silicon 原生 universal binary 改善
- Windows MSIX 打包更新

## 風險

- `electron-builder.yml` 設定格式可能有 breaking change
- 需要完整 build 驗收（macOS + Windows）

## 相關單據

- **相關**：PLAN-003（Electron 升級，可合併規劃）

## 塔台決策

- **決定**：待分派
- **建議時機**：搭配 Electron 版本升級（PLAN-003）一起做
