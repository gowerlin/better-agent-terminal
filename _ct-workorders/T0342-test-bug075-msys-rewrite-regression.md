# T0342 — BUG-075 症狀 B regression test（unit + integration）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0342 |
| 類型 | test |
| 所屬 | BUG-075（症狀 B regression guard） |
| 狀態 | 📋 PENDING |
| 建立時間 | 2026-04-27 14:08 (UTC+8) |
| Sizing | S（estimate 20-40 min wall） |
| 依賴 | T0341（MSYS_NO_PATHCONV 注入完成） |
| 後續 | T0345（e2e） |
| 互動旗標 | `--mode ask --no-interactive` |
| 工作目錄 | main repo |
| `affects_files` | `tests/bat-terminal-msys.test.{ts,mjs}`（新增）/ 既有 vitest config |
| Release target | v0.4.2.1 hotfix（與 T0341 同 release） |

## 背景

T0329 Phase D 規格：症狀 B 必須有 unit + integration regression test，防 BUG-060/075 同族第三次再現（22h 內已再現一次）。

## 任務範圍

**Unit test**：MSYS argv conversion fixture
- 不設 `MSYS_NO_PATHCONV` 時，`/ct-exec T0001` 在 Git Bash + Node 環境會被轉成 `C:/Program Files/Git/ct-exec T0001`
- 設 `MSYS_NO_PATHCONV=1` 時保持 literal `/ct-exec T0001`
- 平台條件：Windows + MSYS（CI 上 skip non-Windows runners）

**Integration test**：mock `bat-terminal.mjs --prompt "/ct-exec T0001"` 的 invokePayload
- assert `customEnv.MSYS_NO_PATHCONV === '1'`
- assert prompt 在 invokePayload 中保持原樣（`/ct-exec T0001`，length 14）

## 驗收條件

- ✅ 至少 1 unit test + 1 integration test 落地
- ✅ T0341 修改後 test 全綠；故意 revert T0341 後 test 紅（驗 test 有效）
- ✅ Test 在非 Windows runner 上 skip（不破 macOS/Linux CI）
- ✅ Commit message 引用 T0342 / BUG-075

## OOS（不在範圍內）

- e2e（BAT RemoteServer + 真實 codex argv probe）→ T0345 處理

## 參考資料

- T0329 Phase D regression test 設計
- T0341 fix 實作（依賴）

---

## 回報區（Worker 填）

### 完成摘要
（Worker 填）

### 測試清單
（Worker 填，含檔案路徑、test 名稱、覆蓋情境）

### 驗證紀錄
（Worker 填：T0341 在 / revert 兩種狀態下的 test 結果）

### OOS but justified（如有）
（Worker 填）

---

**狀態**：📋 PENDING
