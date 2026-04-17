# 🔄 PLAN-005：electron-builder 24 → 26 升級

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-005 |
| **狀態** | 🔄 IN_PROGRESS（EXP-BUILDER26-001 實作中，2026-04-18 派發） |
| **優先級** | 🟢 Low |
| **提出時間** | 2026-04-12 (UTC+8) |
| **啟動時間** | 2026-04-18 04:25 (UTC+8)（D054 決策後） |
| **提出人** | 塔台（T0034 依賴審計） |
| **預估規模** | 中（可能有 config 格式變更） |
| **類型** | 技術債 / 安全 |
| **實作工單** | [EXP-BUILDER26-001](EXP-BUILDER26-001-electron-builder-24-to-26-upgrade.md)（EXP worktree 模式） |
| **關聯 PLAN** | PLAN-003（Group A — 9 個 electron-builder 鏈漏洞由本 PLAN 統一處理） |
| **關聯決策** | D054（採 EXP worktree 模式 + Windows 完整驗收 + 跨平台 YAML dry-run） |

---

## 動機 / 背景

目前使用 electron-builder 24.x，最新穩定版為 26.x。electron-builder 是打包工具（dev dependency），安全漏洞不直接影響 runtime，但升級可獲得：
- 更好的 macOS notarization 支援
- Apple Silicon 原生 universal binary 改善
- Windows MSIX 打包更新
- **清除 PLAN-003 Group A 的 9 個 CVE**（2026-04-18 T0162 盤點確認）

## 風險

- `electron-builder.yml` 設定格式可能有 breaking change
- 需要完整 build 驗收（macOS + Windows）
- Electron 41 + electron-builder 26 組合首次打包，未知性高 → **用 EXP worktree 隔離（D054）**

## 相關單據

- **相關**：PLAN-003（Electron 升級，可合併規劃）

## 塔台決策

- **決定**：採 EXP worktree 模式實作（D054，2026-04-18 04:25）
- **實作時機**：2026-04-18 現動（接續 T0163 vite 升級，工具鏈記憶熱）
- **驗收範圍**：Windows 完整打包 + macOS/Linux YAML dry-run（本機無 macOS，notarization/universal binary 暫不驗收）
- **成功路徑**：EXP merge 回主線 → PLAN-005 DONE → PLAN-003 Group A 關閉 → PLAN-003 整體 DONE
- **失敗路徑**：EXP worktree 丟棄，PLAN-005 退回 IDEA，主線零污染
