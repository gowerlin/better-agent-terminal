---
schema_version: 1
schema_kind: bug
id: BUG-220
title: "待辦分頁不會自動讀到新建立的 `_ct-workorders/`：新專案第一次開契約 2 塔台後，仍顯示「找不到 _ct-workorders/_tower-state.md」，要手動按 ↻"
status: CLOSED
severity: medium
reproducibility: "always（T0915 S1、S2 都重現）"
created_at: "2026-11-25T12:19:45+08:00"
updated_at: "2026-11-25T14:10:21+08:00"
impact:
  - tower-inbox
  - ux
links:
  discovered_in: "T0915（CT checklist M-C1-2）"
  related: [PLAN-068, T0915, T0916, D337]
---
# BUG-220 — 待辦分頁不會自動讀到新建的 `_ct-workorders/`

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（第一次使用的專案一定遇到；按 ↻ 可繞過） |
| 可重現 | 每次（T0915 S1、S2） |
| **狀態** | 🚫 CLOSED（測試版 `0.0.0-exp.21`（`v0.8.x` `6d7b4cd3`）以真 claude 塔台實測 PASS，T0920 R1；D338） |
| 回報者 | T0915（PLAN-068 實機驗收自動化） |
| 影響版本 | `v0.8.x`（PLAN-068 W4 待辦分頁起） |

## 現象（預期 vs 實際）

- **預期**：專案原本沒有 `_ct-workorders/`，開塔台（`/control-tower`，CT 6.1.0）建立目錄並寫入 `_tower-state.md`（`bat_contract: 2`）後，待辦分頁自動變成「契約 v2 ✓」。
- **實際**：寫入 1 分鐘以上仍是 P-3「找不到 _ct-workorders/_tower-state.md」、標題 `!`；按 ↻ 才正確。

## 重現

1. 沒有 `_ct-workorders/` 的專案 → 加成工作區。
2. 開 claude 分頁，執行 `/control-tower`（契約 2 的 CT），等它寫完 `_tower-state.md`。
3. 不按 ↻，看右側欄「待辦」分頁。

## 證據

- 本機驗收目錄 `results/M-C1.md`、`results/M-C1/04-inbox.png`、`05-inbox-after-refresh.png`（T0915）。

## 推定原因（T0915 讀碼，未驗證）

- `fs:watch`（`electron/handlers/fs.ts`）對不存在的目錄 `fsSync.watch` 丟例外 → 回 `false`；`acquireDirWatch`（`src/stores/ct-dir-watch.ts`）不重試，之後目錄建立也沒有人監看。

## 處置

- 2026-11-25 12:19 D337：開單並派 T0916 修正。
- 2026-11-25 12:33：FIXED（T0916 `d81fdc4c`）。根因確認：`fs:watch` 對不存在的目錄回 `false`、`acquireDirWatch` 不重試；另實測 Windows 刪除被遞迴監看的目錄時 watcher 無限噴 `rename`、不送 `fs:changed`。修法：`fs:watch` 選用 `{ recreate: true }`（只有 `acquireDirWatch` 帶）：不存在時監看最近的上層目錄（事件驅動）、出現後換成遞迴 watcher；刪除 / 換掉時送一次 `fs:changed` 後回到等待。舊 bat-server 忽略參數＝修正前行為。`test:unit` 第一次即綠 8965。`ct/T0916` ff `v0.8.x` `4f7484bc..d81fdc4c`。
- 2026-11-25 14:10：CLOSED（D338）。驗證依據：測試版 `0.0.0-exp.21`（desktop-build `45550729062`，`v0.8.x` `6d7b4cd3`）隔離實例＋真 claude 2.1.331 塔台，T0920 R1 PASS：`_tower-state.md` 寫入 1 s 內「契約 v2 ✓」，刪除後由塔台重建也 1 s 內自動恢復。
