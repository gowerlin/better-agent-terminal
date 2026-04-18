# 工單 T0184-remote-brute-force

## 元資料
- **工單編號**：T0184
- **任務名稱**：Remote brute-force 防護 + 連線穩定性（PLAN-018 第三張，收官）
- **類型**：implementation
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-18 20:00 (UTC+8)
- **開始時間**：2026-04-18 20:52 (UTC+8)
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

### 完成狀態

DONE

### 執行摘要

按 `_report-t0181-plan-018-breakdown.md` §E 規格實作完成 PLAN-018 收官工單：

1. **Per-IP auth 節流**（`remote-server.ts`）：
   - 新增 `authFailures: Map<string, AuthFailureEntry>` + 常數 `AUTH_FAIL_WINDOW_MS=60000` / `AUTH_FAIL_THRESHOLD=5` / `AUTH_BAN_DURATION_MS=600000`
   - 連線時先呼叫 `isIpBanned()` 檢查，若在 ban 窗口直接 close
   - Auth 失敗 → `recordAuthFailure()` 累積計數；5 次 / 60s 觸發 `bannedUntil = now + 10min`
   - Auth 成功 → `authFailures.delete(ip)` 清除該 IP 紀錄
   - 60s 窗口過後自動重置（entry 於下次 failure 時重建）
   - Helper `normalizeIp()` 將 `::ffff:X.X.X.X` 轉為純 IPv4，避免雙 key
2. **WebSocket maxPayload**：`WebSocketServer` 構造參數加 `maxPayload: WS_MAX_PAYLOAD_BYTES (32 MB)`
3. **未 auth 傳非 auth frame**：原「回 error」改為「回 error + `ws.close()`」
4. **Client 指數退避**（`remote-client.ts`）：
   - 新增 `reconnectAttempts` counter + `computeReconnectDelay(attempt, rand?)` helper
   - 取代原固定 3s：`delay = min(30s, 1s * 2^attempt) + random(0, 1s) jitter`
   - Auth 成功（`auth-result` OK 分支）→ `reconnectAttempts = 0`
   - 明確 `disconnect()` → 同樣重置 counter
5. **Connect/disconnect mutex**（`electron/main.ts`）：
   - 新增 session-level `remoteOpMutex: Promise<unknown>`
   - `remote:connect` 與 `remote:disconnect` handler 以 `remoteOpMutex = remoteOpMutex.then(...).catch(() => {})` 序列化
6. **Version sync**：`version.json.lastSyncCommit` 更新為 `5d9f486`，`syncNote` 補 PLAN-018 Phase 2 完成紀錄

### AC 驗收結果

| AC | 結果 | 驗證方式 |
|----|------|---------|
| AC-1 | ✅ | `remote-server.ts` L234 `maxPayload: WS_MAX_PAYLOAD_BYTES` (32 * 1024 * 1024) |
| AC-2 | ✅ | 單元測試 `recordAuthFailure bans IP after threshold within window` |
| AC-3 | ✅ | 單元測試 `isIpBanned clears expired ban and returns false`，驗證 ban 過期自動清除 |
| AC-4 | ✅ | `remote-server.ts` 未 auth 分支新增 `ws.close()` 緊跟在 `invoke-error` sendFrame 之後 |
| AC-5 | ✅ | 單元測試 `computeReconnectDelay doubles per attempt until cap` + `caps at RECONNECT_MAX_MS` |
| AC-6 | ✅ | `main.ts` `remoteOpMutex` Promise chain 序列化 connect/disconnect |
| AC-7 | ✅ | 程式碼檢查：`auth-result` ok 分支 + `disconnect()` 皆設 `reconnectAttempts = 0` |
| AC-8 | ✅ | `npx vite build` 成功（9.51s + 1.89s + 22ms + 21ms），`npx tsc --noEmit` 在本次修改檔案 0 error（`src/` 錯誤為 pre-existing 非本工單範圍） |

**單元測試**（新增 `tests/remote-throttle.test.ts`）：15 個 assertions 全 pass，涵蓋：
- `normalizeIp` IPv4-mapped IPv6 轉換
- `recordAuthFailure` 視窗重置 / 門檻觸發
- `isIpBanned` ban 期間 / 過期清除
- `computeReconnectDelay` 指數遞增 / cap 30s / jitter 範圍 / 負數 clamp

**手動驗證**（延後）：brute-force wscat 實測、跨機 reconnect、profile 快速切換 mutex 實測需佈署後驗證，在單元測試覆蓋下風險低。

### 修改檔案清單

| 檔案 | 改動 |
|------|------|
| `electron/remote/remote-server.ts` | 新增 throttle Map、helper (`normalizeIp` / `isIpBanned` / `recordAuthFailure`)、`maxPayload` 設定、未 auth frame close |
| `electron/remote/remote-client.ts` | 新增 `computeReconnectDelay` helper、`reconnectAttempts` counter、指數退避 + jitter、成功/disconnect 重置 |
| `electron/main.ts` | 新增 `remoteOpMutex` + 包裝 `remote:connect` / `remote:disconnect` handler |
| `tests/remote-throttle.test.ts` | 新增，15 個單元測試涵蓋 throttle 狀態機與 backoff 數學 |
| `version.json` | `lastSyncCommit` → `5d9f486`，syncNote 補 PLAN-018 Phase 2 完成紀錄 |

### 互動紀錄

無

### 遭遇問題

- Fork 與 upstream `3a0af80` 的 auth handler 結構已因 T0182（TLS + fingerprint）重寫，無法直接套 upstream patch。依 T0181 報告 §E 重新實作等效行為，保留了 fork 既有 auth flow（token 比對、label 儲存、auth-result 回覆）。
- Pre-existing `src/` typecheck errors 屬既有技術債，確認未在本次修改檔案引入新 error。

### Commit

`7317ad4 feat(remote): brute-force throttle + stability (PLAN-018 T0184 + version sync)`

### Renew 歷程

無

### 完成時間

2026-04-18 21:00 (UTC+8)
