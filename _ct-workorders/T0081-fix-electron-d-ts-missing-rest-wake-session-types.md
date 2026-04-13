# 工單 T0081-fix-electron-d-ts-missing-rest-wake-session-types

## 元資料
- **工單編號**：T0081
- **任務名稱**：補齊 electron.d.ts — restSession / wakeSession / isResting 型別宣告
- **狀態**：DONE
- **建立時間**：2026-04-13 11:25 (UTC+8)
- **開始時間**：2026-04-13 11:28 (UTC+8)
- **完成時間**：2026-04-13 11:31 (UTC+8)
- **相關單據**：T0080（調查來源）

---

## 工作量預估
- **預估規模**：極小（~5 分鐘）
- **Context Window 風險**：極低

## Session 建議
- **建議類型**：現有 session 即可（或新 session）

---

## 任務指令

### 問題說明

`electron.d.ts` 的 `claude` 區段缺少以下三個方法的型別宣告，功能可執行但 TypeScript 型別不完整：

- `restSession(sessionId: string): Promise<void>`
- `wakeSession(sessionId: string): Promise<void>`
- `isResting(sessionId: string): Promise<boolean>`

### 執行步驟

1. 讀 `src/types/electron.d.ts`，找到 `claude` 區段
2. 找到已有的 claude session 相關方法（例如 `sendMessage`、`stopTask` 等）作為格式參考
3. 在 `claude` 區段補齊三個方法型別宣告
4. `npx vite build` 確認編譯通過（特別是 TypeScript 無新增型別錯誤）

### 驗收條件
1. `electron.d.ts` 的 `claude` 區段包含三個方法宣告
2. `npx vite build` 通過，無 TypeScript 錯誤

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
- 修改檔案：`src/types/electron.d.ts`
- 新增完整 `claude` 區段（51 個方法型別宣告），包含工單指定的 `restSession`、`wakeSession`、`isResting` 三個方法
- 原始 `electron.d.ts` 完全沒有 `claude` 區段，若只加 3 個方法會導致其他已用方法的型別錯誤，因此補齊全部
- `npx vite build` 通過，無 TypeScript 錯誤

### 遭遇問題
無

### 互動紀錄
無
