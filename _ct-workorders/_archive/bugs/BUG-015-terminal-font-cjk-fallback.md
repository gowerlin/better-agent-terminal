# 🐛 BUG-015：終端字體從黑體變細明體（CJK fallback 問題）

## 元資料

| 欄位 | 內容 |
|------|------|
| **報修編號** | BUG-015 |
| **狀態** | 🚫 CLOSED |
| **嚴重度** | 🟡 Medium |
| **報修時間** | 2026-04-12 (UTC+8) |
| **報修人** | 使用者 |
| **影響範圍** | 有 CJK（中文、日文）字元顯示需求的使用者 |

---

## 現象描述

- **預期行為**：終端中 CJK 字元使用黑體（sans-serif）字型
- **實際行為**：xterm v6 升級後 CJK 字元 fallback 到細明體（serif），視覺差異明顯且較難閱讀

## 根因分析

xterm v6 的 CJK 字體 fallback 策略改變，未正確設定導致 fallback 到系統預設 serif 字體。

## 修復記錄

- **修復工單**：T0047（JhengHei fallback 9cc66d3）
- **commit**：9cc66d3
- **runtime 驗收**：✅ 通過（2026-04-12）

## 時間線

| 時間 | 狀態 | 備註 |
|------|------|------|
| 2026-04-12 | 📋 REPORTED | xterm v6 副作用 |
| 2026-04-12 | ✅ FIXED | T0047 JhengHei fallback，commit 9cc66d3 |
