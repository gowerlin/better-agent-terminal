# 🐛 BUG-003：`voice:downloadModel` IPC handler 未註冊（4 模型下載全失效）

## 元資料

| 欄位 | 內容 |
|------|------|
| **報修編號** | BUG-003 |
| **狀態** | ✅ FIXED |
| **嚴重度** | 🔴 High |
| **報修時間** | 2026-04-11 09:53 (UTC+8) |
| **報修人** | 使用者 |
| **影響範圍** | 所有需要下載 Whisper 模型的使用者（Phase 1 收尾驗收阻塞） |
| **重現率** | 100% |

---

## 現象描述

- **預期行為**：Settings 頁點擊 Tiny/Base/Small/Medium 任一模型的下載按鈕，開始下載
- **實際行為**：一律回報 `No handler registered for 'voice:downloadModel'`，4 個模型下載全部失效

## 根因分析

**跨工單 IPC contract drift**：

T0004（main process handler）和 T0009（renderer IPC call）分別在不同 sub-session 完成，各自通過 build。但問題是：

1. `registerVoiceHandlers` 在 module init 就被呼叫，但依賴 `session.defaultSession`（app 還沒 ready 的資源）
2. IPC channel 命名不一致（命名 drift）

**修復**（T0013）：
- 新增 `src/types/voice-ipc.ts` 作為 `VOICE_IPC_CHANNELS` 單一常數來源（renderer/main 共用）
- 把 `registerVoiceHandlers` 從 `registerLocalHandlers()` 移到 `app.whenReady()` 後

## 修復記錄

- **修復工單**：T0013
- **runtime 驗收**：✅ 通過（2026-04-12，使用者確認下載模型正確）

## 時間線

| 時間 | 狀態 | 備註 |
|------|------|------|
| 2026-04-11 09:53 | 📋 REPORTED | T0011 user testing 第一項失敗發現 |
| 2026-04-11 10:xx | 🔧 FIXING | T0013 派發（copilot 修復） |
| 2026-04-12 | ✅ FIXED | runtime 驗收通過 |
