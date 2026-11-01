---
schema_version: 1
schema_kind: bug
id: BUG-179
title: "`bat-scripts.log` 無上限成長：helper 與主行程都只 append、從不輪替（本機 41.6 MB，10 月單月 35.6 MB）"
status: FIXING
severity: low
reproducibility: always
created_at: "2026-11-01T12:12:33+0800"
updated_at: "2026-11-01T12:25:49+0800"
impact:
  - logging
  - helper-scripts
links:
  discovered_in: "T0731 回報區〈發現的問題〉1（2026-11-01，BMad-Guide ADVISORY Q-B3 查證）"
  related: [T0732, D198, T0731, T0192, T0193, T0590]
---

# BUG-179 — `bat-scripts.log` 無上限成長

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（磁碟用量、附日誌困難、讀檔診斷變慢；不影響功能） |
| 可重現 | 一定 |
| **狀態** | 🔧 FIXING：T0732（D198 規格：啟動時 > 10 MB 輪替、保留 3 份；排在 T0730 之後） |
| 回報者 | T0731 Worker |

## 現象

- 預期：診斷日誌有大小上限或輪替，比照 debug log 只留最近 10 個（`electron/logger.ts` `MAX_LOG_FILES`）。
- 實際：helper `scripts/_bat-logger.mjs` 與主行程 `electron/remote/remote-logger.ts` 都是 `appendFileSync`，從未輪替（T0192 / T0193 明訂「先簡單 append，超大時再處理」）。
- 本機實測（只看大小、筆數、event 種類）：41.6 MB、195,249 筆，2026-05-28 起；每月 5 月 0.2 / 6 月 0.9 / 7 月 0.7 / 8 月 1.5 / 9 月 1.9 / **10 月 35.6 MB**（其中 `report-hook` 20.7 MB）。T0590 起每個 hook 事件 helper 端與主行程鏡像各記一筆（`bat-hook|report-hook` 65,524 筆、`remote-server|report-hook` 48,455 筆）。
- 寫入者有多個：每個 helper 程序、主行程、headless bat-server（`BAT_HELPER_LOG_DIR`）。

## 修正方向（T0731 建議，待修正單評估）

- 由主行程啟動時輪替（超過門檻改名為帶時間戳的舊檔、保留 N 份），避免多個 helper 程序競爭；Windows 改名遇到其他程序正在 append 可能 `EBUSY` / `EPERM`，要容錯（下次啟動再試）。headless bat-server 同樣處理。
- 可選：減少 `report-hook` 雙寫。
- 日誌寫入失敗不得影響業務（兩個 logger 的既有失敗政策）。
- 對外說明：`bat-scripts.log` 是診斷日誌、欄位不是契約，CT 不應依賴保留期（BMad-Guide ADVISORY Q-B3 回覆）。
