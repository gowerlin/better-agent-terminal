# 工單 T0184-remote-brute-force

## 元資料
- **工單編號**：T0184
- **任務名稱**：Remote brute-force 防護 + 連線穩定性（PLAN-018 第三張，收官）
- **類型**：implementation
- **狀態**：TODO
- **建立時間**：2026-04-18 20:00 (UTC+8)
- **預估工時**：1-1.5h
- **優先級**：🔴 High（P0 資安）
- **Renew 次數**：0

## 前置條件

- **PLAN-018 PLANNED**：Remote 資安加固
- **T0181 DONE**（`4822dbd`）：拆分研究報告 `_report-t0181-plan-018-breakdown.md` **§E 為本工單權威規格**
- **T0164 DONE**：Upstream sync 研究
- **Upstream commit**：`3a0af80`（auth throttle 部分）
- **T0182 DONE 必須先完成**（依賴 TLS/safeStorage 基礎設施）

## 權威規格

**閱讀順序**：
1. `_report-t0181-plan-018-breakdown.md` **§E**（完整規格：修改檔案清單含精確行號、改動方向、AC 對照表）
2. `_report-t0181-plan-018-breakdown.md` **§I.1** R5（in-memory Map 重啟清除風險）

## 修改範圍（摘要，完整見報告 §E）

- **新增**：auth 失敗限流邏輯（in-memory Map 記錄 IP → 失敗次數 + cooldown 到期時間）
- **修改**：`remote-server.ts` auth handler 加前置檢查
- **連線穩定性**：heartbeat / reconnect 邏輯微調（若報告 §E 有涵蓋）
- **PLAN-018 收官**：同步更新 `version.json.lastSyncCommit` → `5d9f486`

## 驗收條件

見 `_report-t0181-plan-018-breakdown.md` §E 的 AC 對照表。

**commit 訊息**：`feat(remote): brute-force throttle + stability (PLAN-018 T0184 + version sync)`

**額外驗收**：本工單 DONE 後 **PLAN-018 IN_PROGRESS → DONE**，塔台負責更新 PLAN 狀態。

## 互動規則

**禁止 Worker 互動**（規格已完整）。

## 依賴

- **必須先完成**：T0182（依賴 auth 基礎設施）
- **可與 T0183 並行**（但建議 T0182 → T0183 → T0184 序列，避免整合問題）

## 備註

- in-memory Map 重啟清除是已知限制（R5），可接受；若要持久化需另開工單
- cooldown 實作用 `Map<string, { attempts, cooldownUntil }>`，到期自動清除以避免記憶體洩漏
- PLAN-018 收官工單，commit 中同步 version.json 讓 upstream sync 追蹤對齊

---

## 回報區

> 以下由 sub-session 填寫

（待填：執行摘要、AC 驗收結果、修改檔案清單、Commit、Renew 歷程、DONE 時間）
