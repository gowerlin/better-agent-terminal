# T0345 — BUG-075 e2e regression（Git Bash + codex argv probe + 3-shot shell consistency）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0345 |
| 類型 | test（e2e） |
| 所屬 | BUG-075（防第三次同族再現的 e2e 保險） |
| 狀態 | 📋 PENDING |
| 建立時間 | 2026-04-27 14:08 (UTC+8) |
| Sizing | M（estimate 60-120 min wall；e2e harness 設置 + Windows runner 條件） |
| 依賴 | T0341（MSYS fix）+ T0343（prefix mismatch fix）|
| 後續 | 結束 BUG-075 → CLOSED |
| 互動旗標 | `--mode ask --interactive`（e2e harness 設計可能需澄清，例如 BAT RemoteServer 啟動方式） |
| 工作目錄 | main repo |
| `affects_files` | `tests/e2e/bug075-bat-auto-session.test.ts`（新增）/ playwright config 或既有 e2e harness |
| Release target | v0.4.3（隨 PLAN-032 release，e2e 不阻 v0.4.2.1 hotfix） |

## 背景

T0329 Phase D：「若要防第三次同族再現，應追加 BAT RemoteServer e2e（Git Bash + codex argv probe）」。BUG-060 fix 22h 後同族 BUG-075 再現，明確訊號：症狀 B + 症狀 A + prefix mismatch 三層只靠 unit/integration test 不足以保險。

## 任務範圍

**E2E scenario**：在 Windows runner（CI 上 conditional skip non-Windows）：
1. 啟動 BAT RemoteServer（headless 或最小化）
2. 設定 `defaultAgent: codex-cli` + `shell: git-bash`
3. 透過 `bat-terminal.mjs --prompt "/ct-exec PROBE"` 派發 3 次（連續）
4. **驗證項**：
   - **Argv probe**：codex 收到的 argv 為 literal `$ct-exec PROBE`（已經 prefix normalize）或 `/ct-exec PROBE`（依 T0343 拍板路線），**絕不是** `C:/Program Files/Git/ct-exec PROBE`
   - **Shell consistency**：3 次 spawn 的 PTY shell basename 全部 === `bash.exe`（防症狀 A 第二張起 fallback）
   - **MSYS env**：3 次 customEnv.MSYS_NO_PATHCONV 全部 === '1'
5. 結束 RemoteServer，cleanup

**Probe 機制**：可以用簡化版 codex stub（讀 argv 寫 log file），或攔截 PTY stdin 的 prompt 字串。Worker 可選擇最簡單可行方式。

## 驗收條件

- ✅ E2E test 落地，Windows runner 可跑、non-Windows skip
- ✅ 3 個 assertion（argv literal / shell consistency / MSYS env）皆綠
- ✅ Test 命名清晰標 BUG-075 regression
- ✅ 故意 revert T0341 → test 紅；故意 revert T0343 → test 紅；驗 test 有效
- ✅ Commit message 引用 T0345 / BUG-075 / T0329 H6 / T0343
- ✅ BUG-075 → CLOSED（在 BUG-075 metadata 補修復記錄）

## OOS（不在範圍內）

- 不重做 unit/integration test（T0342/T0344 已涵蓋）
- 不動修法（T0341/T0343 已修）
- 不擴 e2e 到其他 BUG（聚焦 BUG-075）

## 參考資料

- T0329 Phase D 規格
- T0341/T0342/T0343/T0344 工單
- BAT RemoteServer 既有 e2e harness（如有）

---

## 回報區（Worker 填）

### 完成摘要
（Worker 填）

### E2E 設計
（Worker 填：harness 設置、probe 機制、runner 條件）

### 測試清單
（Worker 填）

### 驗證紀錄
（Worker 填：含 revert T0341/T0343 後紅燈驗證）

### 互動紀錄
（Worker 填）

### OOS but justified（如有）
（Worker 填）

---

**狀態**：📋 PENDING
