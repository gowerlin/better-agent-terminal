# 🚫 PLAN-001：Vite v5 → v6 升級（DROPPED — 被 PLAN-003 Group B 吸收）

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-001 |
| **狀態** | 🚫 DROPPED |
| **優先級** | 🟢 Low |
| **提出時間** | 2026-04-12 (UTC+8) |
| **DROPPED 時間** | 2026-04-18 (UTC+8) |
| **DROPPED 理由** | 被 PLAN-003 Group B 吸收（D052） |
| **提出人** | 塔台（T0034 依賴審計發現） |
| **預估規模** | 小（Vite 升級通常相容） |
| **類型** | 技術債 |

---

## 🚫 DROPPED 說明（2026-04-18）

T0162 研究（D052）重新盤點後，PLAN-003 Group B 決定將 **vite 5→8 直接跨 3 major 升級**（而非原本 PLAN-001 的 5→6）。理由：

1. `vite 5.4.21` 為 vite 5 線最終版本，**已無 patch** 提供 — vite 自身漏洞（dev server path traversal + SSRF）只能透過 major bump 修復
2. 若先做 vite 5→6（PLAN-001 原範圍），再做 vite 6→8（為消除漏洞），等於做兩次 plugin stack 升級（vite-plugin-electron + vite-plugin-electron-renderer + @vitejs/plugin-react 都要連動升兩次），成本翻倍
3. PLAN-003 Group B 實作工單將一次性完成 vite 5→8（或走 electron-vite 替代方案），**自然覆蓋 PLAN-001 原目標**

### 原 PLAN-001 追蹤項目的承接

| 項目 | 承接位置 |
|------|---------|
| 消除 CJS 模式棄用警告 | PLAN-003 Group B 實作（vite 6+ 移除 CJS API） |
| 使用更新 Vite 特性 | PLAN-003 Group B 實作 |
| Vite v6 breaking changes 評估 | T0162 Renew #1 的 OQ3（vite 6/7/8 migration 摘要） |
| electron-plugin-vite 相容性 | T0162 Renew #1 的 OQ1（npm registry peer 查證） |

本 PLAN 保留作為歷史紀錄，不需要實作。

---

## 歷史原始內容（DROPPED 前）

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
