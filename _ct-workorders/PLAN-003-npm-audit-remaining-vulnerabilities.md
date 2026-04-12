# 💡 PLAN-003：npm audit 殘餘漏洞（Electron 核心依賴鏈）

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-003 |
| **狀態** | 💡 IDEA |
| **優先級** | 🟡 Medium |
| **提出時間** | 2026-04-12 (UTC+8) |
| **提出人** | 塔台（T0059 npm audit 調查，T0060 部分修復後殘留） |
| **預估規模** | 大（需要 breaking change，electron 28 → 41） |
| **類型** | 安全 / 技術債 |

---

## 動機 / 背景

T0060 已透過 claude-agent-sdk 升級 + npm overrides 將漏洞從 27 個降至 14 個（減少 48%）。

剩餘 14 個漏洞主要在 **Electron 核心依賴鏈**（tar、cmake-js、electron-builder），需要 Electron 28 → 41 的 breaking change 才能完全修復。

## 現況

- 修復後：17 個漏洞（已通過 npm audit fix 自動修正 3 個）
- 主要殘餘：`electron` 28.x 依賴鏈的漏洞（electron 本身為 dev dependency，runtime 風險低）

## 預期效益

- 漏洞歸零
- 更新 Electron 到支援更新 Chromium 版本（Web API 更豐富）

## 風險

- Electron 28 → 41 是主版本跳躍，API 有破壞性變更
- electron-builder 24 → 26 需同步升級
- 需要完整回歸測試

## 相關單據

- **調查報告**：`_ct-workorders/reports/T0059-vulnerability-analysis.md`（若有）
- **相關**：PLAN-005（electron-builder 升級，可合併執行）

## 塔台決策

- **決定**：待分派
- **建議時機**：獨立 Milestone（breaking change 風險需完整評估）
