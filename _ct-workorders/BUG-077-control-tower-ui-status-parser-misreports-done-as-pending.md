---
schema_version: 1
schema_kind: bug
id: BUG-077
title: 指揮塔 UI 工單狀態 parser 將 DONE 工單顯示為 Pending
status: OPEN
severity: medium
created_at: "2026-04-28T18:15:00+08:00"
---
# BUG-077 — 指揮塔 UI 工單狀態 parser 將 DONE 工單顯示為 Pending

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-077 |
| 標題 | 指揮塔 UI 工單面板：T0313/T0314 metadata 為 ✅ DONE 但 UI 顯示 Pending |
| 狀態 | 🐛 OPEN |
| 嚴重度 | 🟡 Medium |
| 可重現 | 100%（每次開啟指揮塔 UI 都這樣） |
| Workaround | 有：直接開工單檔看 metadata `\| 狀態 \|` 欄為準 |
| 建立時間 | 2026-04-28 18:15 (UTC+8) |
| 觀察 session | 第四十二 session（*sync 後使用者截圖回報） |
| 影響面 | 指揮塔 UI 工單狀態欄不可信任，需開檔案複核；統計數字（91 done / 2 pending / 101 total）也跟實際 metadata 對不上（91+2=93 ≠ 101） |

## 現象

指揮塔 UI（BAT 內建）工單面板顯示：
- T0313 (research-plan031-server-bundle-distribution-design)：⏳ Pending
- T0314 (docs-plan031-distribution-spec-and-arch-normalize)：⏳ Pending
- T0153 (poc-git-gui-feasibility-spike)：⚠️ Partial

實際工單檔案 metadata：
- T0313：`| 狀態 | ✅ DONE |`（完成於 2026-04-27 01:14）
- T0314：`| 狀態 | ✅ DONE |`（完成於 2026-04-27）
- T0153：`- **狀態**:PARTIAL`（一致）

## 預期 vs 實際

| 工單 | 工單檔（SoT） | BAT UI 顯示 | 一致？ |
|------|--------------|------------|-------|
| T0153 | PARTIAL | Partial | ✅ |
| T0313 | ✅ DONE | Pending | ❌ |
| T0314 | ✅ DONE | Pending | ❌ |

**期望**：BAT UI parser 應以工單檔 metadata 為唯一事實來源，DONE → Done bucket、PARTIAL → Partial bucket。
**實際**：T0313/T0314 落入 Pending bucket。

## 統計矛盾

UI 顯示「2 pending / 91 done / 101 total」，但 91+2=93 ≠ 101。
- 缺 8 張：推測為 PARTIAL/FAILED/CANCELLED 等其他狀態（合理）
- 但 T0313/T0314 確實在 Pending bucket 顯示 → 那 2 pending 至少包含這兩張錯歸的

## 不影響的格式（待 worker 驗證）

熱區其他用相同 `| 狀態 | ✅ DONE |` 表格 + emoji 前綴格式的工單（如 T0338/T0340/T0341）使用者未回報異常。
→ 推測 parser bug 不是單純表格 + emoji 引起，可能跟特定 workorder 屬性有關（建立日期？filename pattern？前置 frontmatter？）。

## 可能根因（hypothesis）

1. **快取未失效**：BAT UI 對工單狀態做了 cache，T0313/T0314 在某個時間點是 Pending，DONE 落地後 cache 沒 invalidate
2. **解析路徑差異**：T0313/T0314 是 PLAN-031 Sprint 1 第一批工單，可能跟其他工單有 metadata 結構差異（如 `所屬` / `類型` 欄位順序）
3. **BAT 索引重建未含這兩張**：BAT 可能維護自己的 index file，這兩張未被重建納入

## 重現步驟

1. 開啟 BAT 指揮塔 UI（工單面板）
2. 觀察 T0313 / T0314 狀態欄
3. 開啟工單檔（`_ct-workorders/T0313-*.md` / `T0314-*.md`）查看 metadata
4. 比對：UI 顯示 Pending vs 檔案 DONE → 不一致

## 處置決策

- [ ] 立即派修復工單（修 BAT UI parser）
- [x] **先記錄，影響範圍小（只發現 2 張錯）+ 有 workaround（看檔案）+ 非阻塞功能**；下次開 PLAN 重整 BAT 指揮塔 UI 時帶入

## 後續

- 若 UI 不一致擴散到更多工單 → 升級為 FIXING
- 若伴隨統計數字漂移 → 重新評估嚴重度
- 修復時建議檢查：BAT 工單 index 重建邏輯、status parser regex / table cell 解析

---

## 回報區（修復時填寫）

（尚未派修復工單）
