---
schema_version: 1
schema_kind: plan
id: PLAN-043
title: WSL 環境自動化 Phase 2 / 3（由 PLAN-035 移出）：已安裝環境自動修正、從零安裝與重開機接續
status: IDEA
priority: low
created_at: "2026-10-16T02:27:40+0800"
updated_at: "2026-10-16T02:27:40+0800"
links:
  related: [PLAN-035, T0380, D127, D128]
---

# PLAN-043 — WSL 環境自動化 Phase 2 / 3

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-043 |
| 優先級 | 🟢 Low |
| 狀態 | 💡 IDEA |
| 來源 | PLAN-035 結案（2026-10-16，使用者決定 Phase 0–1 結案、Phase 2 / 3 轉新 IDEA） |

## 動機

PLAN-035 Phase 1 已修好已安裝環境最常見的問題（網路模式誤判、keep-alive、指紋、埠探測）。剩下「環境不符時自動修正」與「從零安裝 WSL」兩段自 2026-10-04 後未開單，移到這裡保留，需要時再排。

## 範圍（沿用 PLAN-035 與 T0380 研究 / D128 修訂，開工前重新核對）

1. **Phase 2**：已安裝環境的偵測 → 清單 → 一次同意 → 自動修正（PLAN-035「範圍」環節 4–8）
2. **Phase 3**：從零安裝（環節 1–3）+ 重開機接續（精靈進度持久化 + 開機後恢復入口）
3. **PLAN-035 Phase 1 回報的候選**：keep-alive per-profile 開關或 lazy 模式（T0384）；BAT 被強制終止時的孤兒 `wsl.exe`（Job Object，T0384）；runner 層 step abort（T0381）；`docs/wsl-deployment.md`、`docs/plan-007-release-checklist.md` 措辭對齊「NAT 不需強制改」（T0383）

## 參考

- `PLAN-035-wsl-environment-full-automation.md`（使用者裁決 D127、T0380 研究後修訂 D128、交付階段）
