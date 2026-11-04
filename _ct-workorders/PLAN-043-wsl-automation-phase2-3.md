---
schema_version: 1
schema_kind: plan
id: PLAN-043
title: WSL 環境自動化 Phase 2 / 3（由 PLAN-035 移出）：已安裝環境自動修正、從零安裝與重開機接續
status: IN_PROGRESS
priority: low
created_at: "2026-10-16T02:27:40+0800"
updated_at: "2026-11-04T08:52:59+0800"
links:
  related: [PLAN-035, T0380, D127, D128]
---

# PLAN-043 — WSL 環境自動化 Phase 2 / 3

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-043 |
| 優先級 | 🟢 Low |
| 狀態 | 🔄 IN_PROGRESS |
| 來源 | PLAN-035 結案（2026-10-16，使用者決定 Phase 0–1 結案、Phase 2 / 3 轉新 IDEA） |

## 動機

PLAN-035 Phase 1 已修好已安裝環境最常見的問題（網路模式誤判、keep-alive、指紋、埠探測）。剩下「環境不符時自動修正」與「從零安裝 WSL」兩段自 2026-10-04 後未開單，移到這裡保留，需要時再排。

## 範圍（沿用 PLAN-035 與 T0380 研究 / D128 修訂，開工前重新核對）

1. **Phase 2**：已安裝環境的偵測 → 清單 → 一次同意 → 自動修正（PLAN-035「範圍」環節 4–8）
2. **Phase 3**：從零安裝（環節 1–3）+ 重開機接續（精靈進度持久化 + 開機後恢復入口）
3. **PLAN-035 Phase 1 回報的候選**：keep-alive per-profile 開關或 lazy 模式（T0384）；BAT 被強制終止時的孤兒 `wsl.exe`（Job Object，T0384）；runner 層 step abort（T0381）；`docs/wsl-deployment.md`、`docs/plan-007-release-checklist.md` 措辭對齊「NAT 不需強制改」（T0383）

## 參考

- `PLAN-035-wsl-environment-full-automation.md`（使用者裁決 D127、T0380 研究後修訂 D128、交付階段）

## 2026-11-02 狀態核對（第一百零五 session，塔台 grep 核對，未深查）

- **維持 IDEA**：Phase 2（已安裝環境自動修正）、Phase 3（從零安裝＋重開機接續）都沒做：程式沒有 `wsl --install` 路徑、沒有重開機接續。目前沒有使用者回報需要從零安裝。
- 候選「孤兒 `wsl.exe`（Job Object）」：沒做（`electron/` 無 Job Object）。
- 候選「keep-alive per-profile / lazy」「runner step abort」：grep 未見相關改動，未深查。
- 候選「文件措辭對齊『NAT 不需強制改』」：大致完成。`docs/wsl-deployment.md` 已改為「NAT 一般可用，連線測試失敗才處理」（T0653，`9dd30ef0`）。**剩 `docs/plan-007-release-checklist.md` 第 63 行**仍寫「確認 `.wslconfig` 用 `networkingMode=mirrored`（或測 fallback 時記錄 NAT）」：使用者 2026-11-02 決定先記著，下次有 WSL 相關工單時一併改，不單獨開單。

## 2026-11-04 → IN_PROGRESS（第一百一十六 session，D271）

- 使用者選四項全做：T0829（孤兒 `wsl.exe`＋`plan-007-release-checklist.md` NAT 措辭）→ T0830（keep-alive 每個 profile 可關閉、精靈每一步可中止）依序；Phase 2 / 3 先開研究單 T0831（核對 T0380 與現況、設計、拆單），研究完再開實作單。

## 2026-11-04 研究結果與拆單（D272）

- T0829 DONE（`841f5e6a`）：孤兒 `wsl.exe` **實測不存在**（libuv 的 Job Object 已涵蓋未 detached 的子行程），只加回歸防護（不得 `detached`）與文件；範圍 3 的 Job Object 候選結案。
- T0831 研究完成（方案 B：先 Phase 2、再疊 Phase 3）。使用者裁決：**Phase 2 進 `0.7.4-pre.7`**、Phase 3 後做；Phase 2 可在本機用拋棄式發行版實測，`wsl --shutdown` 先問；取消不還原環境修正（列出已變更與備份）；P-6 `instanceIdleTimeout` 不做；Phase 3 要寫 RunOnce、提供 BAT 專用發行版選項（預設選既有）、「立即重開機」按鈕（再確認＋30 秒）、新使用者密碼在精靈輸入。
- Phase 2 實作單：T0838 W1（INI 編輯器）→ T0839 W2（facts / plan）→ T0840 W3（一次同意＋P-1–P-4）→ T0841 W4（Mirrored 重試）。
- Phase 3（W5 提權安裝 `wsl --install --no-distribution`、W6 重開機接續＋RunOnce、W7 發行版安裝＋建立使用者、W8 乾淨 VM 實機驗收）：**尚未開單**，等有驗收 VM（本機未啟用 Hyper-V）再開；設計 SoT = T0831 回報區。
