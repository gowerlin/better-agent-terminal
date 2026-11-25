---
schema_version: 1
schema_kind: bug
id: BUG-221
title: "claude 全螢幕塔台往上捲並停住時，閱讀保護只維持 10 秒：停手超過 10 秒後到的 Worker 通知直接送出，畫面被拉回底部"
status: FIXED
severity: medium
reproducibility: "always（T0915 S2，claude 2.1.331 alt screen）"
created_at: "2026-11-25T12:19:45+08:00"
updated_at: "2026-11-25T13:02:50+08:00"
impact:
  - tower-inbox
  - notify-hold
links:
  discovered_in: "T0915（CT checklist M-C2-b）"
  related: [PLAN-068, T0902, T0904, T0915, T0917, D337]
---
# BUG-221 — 全螢幕塔台的閱讀保護只維持 10 秒

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（#23 的「閱讀時被拉回底部」在 claude 塔台上仍會發生） |
| 可重現 | 每次（T0915 S2） |
| **狀態** | ✅ FIXED（T0917 `91c49360`，經 T0919 合併進 `v0.8.x` `6d7b4cd3`；新測試版重驗 M-C2-b 後 CLOSED） |
| 回報者 | T0915（PLAN-068 實機驗收自動化） |
| 影響版本 | `v0.8.x`（PLAN-068 W2 / T0904 起） |

## 現象（預期 vs 實際）

- **預期**（CT checklist M-C2-b）：使用者在塔台往上捲閱讀時，Worker 通知最多等 60 秒，畫面不被拉回底部。
- **實際**：claude 2.1.331 塔台在 alt screen（xterm 沒有 scrollback）；BAT 的閱讀信號只有滾輪事件＋`TOWER_READING_LINGER_MS` = 10 s。停住超過 10 s 後到的 Worker 通知直接送出，claude 收到輸入後畫面回到底部。

## 證據

- 本機驗收目錄 `results/M-C2.md` 步驟 b2–b4、`results/M-C2/05-scrolled-up.png`、`06-after-send.png`（T0915）。
- `docs/agent-guide/tower-inbox.md`「閱讀信號」節已寫明 fullscreen claude 只看滾輪、停手 10 s 放行（待實機項目 T-3）——行為與文件一致，但不符合 CT checklist 的預期與 #23 的目的。

## 處置

- 2026-11-25 12:19 D337：開單並派 T0917。方向（塔台決定）：alt buffer 中往上捲之後維持「閱讀中」，直到使用者有鍵盤輸入、點擊、捲回（若能判斷）或既有 `reading` 60 s 上限，而不是 10 s linger；normal buffer 的判斷不變。
- 2026-11-25 12:39：FIXED（T0917 `91c49360`）。`TowerReadingTracker` 新增 alt buffer「往上捲未捲回」狀態：滾輪向上 / PageUp 開始，按鍵（keydown，PageUp/Down 與單獨修飾鍵除外）、點擊、分頁切走、buffer 切換直接結束，捲回（向下累計 ≥ 向上，近似）改回 10 s linger；上限仍是主行程 `reading` 60 s，normal buffer 不變、只觀察不攔截。`test:unit` 第一次即綠 8970；e2e t0904 新增 ⑥／⑥b，第 2 次 PASS（第 1 次 ⑥b 是測試量測起點錯誤，已修測試）。已知近似：觸控板上下不對稱時捲回判斷可能有誤差（已寫文件）。
