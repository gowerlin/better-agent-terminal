---
schema_version: 1
schema_kind: workorder
id: T0342
title: BUG-075 症狀 B regression test（unit + integration）
type: test
status: DONE
sizing: S
created_at: "2026-04-27T14:08:00+08:00"
started_at: "2026-04-27T16:27:46+08:00"
completed_at: "2026-04-27T16:32:49+08:00"
workdir: main repo
---
# T0342 — BUG-075 症狀 B regression test（unit + integration）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0342 |
| 類型 | test |
| 所屬 | BUG-075（症狀 B regression guard） |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 14:08 (UTC+8) |
| 開始時間 | 2026-04-27 16:27:46 +08:00 |
| 完成時間 | 2026-04-27 16:32:49 +08:00 |
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
完成狀態：DONE

產出：
- 新增 `tests/bat-terminal-msys.test.mjs`，覆蓋 BUG-075 症狀 B 的 MSYS argv conversion fixture 與 `bat-terminal.mjs --prompt` invokePayload integration path。
- 更新 `vite.config.ts`，將此 regression suite 顯式納入 `npm run test:unit`。

遭遇問題：無

互動紀錄：無

Renew 歷程：無

回報時間：2026-04-27 16:31:57 +08:00

commit：873435a

yaml：不適用（`sprint-status.yaml` 存在但未追蹤 T0342/當前 hotfix 工單）

BAT 通知：`CT_MODE=on`，已透過 `bat-notify.mjs` 預填塔台終端 `T0342 完成`

### 測試清單
- `tests/bat-terminal-msys.test.mjs`
  - `documents the Git Bash argv conversion fixture and MSYS_NO_PATHCONV escape hatch`
    - Windows + Git Bash fixture：未設 `MSYS_NO_PATHCONV` 時 `/ct-exec T0001` 被 MSYS 轉成 Win32 path；設 `MSYS_NO_PATHCONV=1` 時保持 `['/ct-exec', 'T0001']`。
    - 非 Windows runner 整個 suite skip，不破 macOS/Linux CI。
  - `passes literal slash prompts through invokePayload and injects MSYS_NO_PATHCONV for worker PTYs`
    - 使用最小 TLS WebSocket mock 模擬 BAT RemoteServer。
    - 執行 `node scripts/bat-terminal.mjs --prompt "/ct-exec T0001"`。
    - 斷言 `channel === 'terminal:create-agent-command'`。
    - 斷言 `invokePayload.prompt === '/ct-exec T0001'` 且 length 為 14。
    - 斷言 `invokePayload.customEnv.MSYS_NO_PATHCONV === '1'`。

### 驗證紀錄
- T0341 在位：
  - `npx vitest run tests/bat-terminal-msys.test.mjs` → PASS（1 file, 2 tests）
  - `npm run test:unit` → PASS（11 files, 189 tests）
- 故意 revert T0341 注入：
  - 暫時移除 `scripts/bat-terminal.mjs` 的 `customEnv: { MSYS_NO_PATHCONV: '1' }`
  - `npx vitest run tests/bat-terminal-msys.test.mjs` → FAIL（integration test 斷言 `payload.customEnv` 缺少 `MSYS_NO_PATHCONV`）
  - 已立即復原 T0341 注入，重跑 suite PASS（1 file, 2 tests）

### OOS but justified（如有）
無

---

**狀態**：✅ DONE
