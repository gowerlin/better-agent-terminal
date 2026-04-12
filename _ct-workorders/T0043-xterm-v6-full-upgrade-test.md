# 工單 T0043-xterm-v6-full-upgrade-test

## 元資料
- **工單編號**：T0043
- **任務名稱**：全套件升級 + xterm.js v6 測試 BUG-012 殘影問題
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-12 14:25 (UTC+8)
- **開始時間**：2026-04-12 14:25 (UTC+8)
- **完成時間**：（完成時填入）
- **關聯**：T0041（BUG-012 根因分析），T0042（upstream issue，依賴本工單結果）

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中（可能遇到 breaking changes 需要逐一修復）
- **降級策略**：若全套件升級問題太多，可退回「僅升級 xterm 相關套件」

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：獨立分支作業，需要乾淨 context 處理可能的 breaking changes

## 任務指令

### 前置條件
需載入的文件清單：
- `package.json` — 當前所有套件版號
- `src/components/TerminalPanel.tsx` — xterm.js 使用方式，確認 API 相容性
- `_ct-workorders/T0041-bug012-v2-alt-buffer-scroll-ghosting.md` — 回報區（根因和測試方法）

### 輸入上下文

**專案**：better-agent-terminal（Electron + React + xterm.js 終端模擬器）

**目的**：
1. 全套件版本升級（npm update / audit fix）
2. 重點驗證 xterm.js v6 是否修復 BUG-012（alt buffer 捲動殘影）
3. 結果用於補充 upstream issue（T0042）

**BUG-012 根因回顧**（T0041 確認）：
- Claude Code TUI 使用 cursor positioning 跳過行首 column 開始寫入，未先清除整行
- 殘留上一幀字元存在於 xterm.js buffer 中
- 這是 TUI 行為問題，但 xterm.js v6 可能改變了 buffer 處理或渲染邏輯

**當前 xterm 相關版本**：
- `@xterm/xterm`: ^5.5.0
- `@xterm/addon-canvas`: ^0.7.0
- `@xterm/addon-fit`: ^0.10.0
- `@xterm/addon-unicode11`: ^0.8.0
- `@xterm/addon-web-links`: ^0.11.0

**分支策略**：
- 從 main 開 `T0043-xterm-v6-test` 分支
- 不管結果如何，分支保留不刪除（方便後續參考）
- 若升級成功且 BUG-012 修復 → merge 回 main
- 若升級成功但 BUG-012 未修復 → 仍可考慮 merge（套件更新本身有價值）

### 預期產出
- `T0043-xterm-v6-test` 分支，包含全套件升級
- BUG-012 測試結果報告（在回報區）
- Build 驗證結果
- 若有 breaking changes，記錄修復過程

### 驗收條件
- [ ] 分支 `T0043-xterm-v6-test` 已建立
- [ ] 全套件升級完成（`npm update` + `npm audit fix`）
- [ ] xterm.js 相關套件升級到 v6 系列（若可用）
- [ ] `npx vite build` 通過
- [ ] BUG-012 測試結果明確記錄：殘影是否仍在？
- [ ] 測試方法記錄（如何重現 + 如何驗證）
- [ ] Breaking changes 修復記錄（若有）

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. `git checkout -b T0043-xterm-v6-test` 從 main 建立分支
4. 讀取 `package.json` 記錄升級前版本快照
5. 執行全套件升級：
   - `npm update` — 更新所有可用更新
   - `npm audit fix` — 修復安全漏洞
   - 手動確認 xterm.js 相關套件是否升到 v6（若 npm update 沒拉到 v6，手動 `npm install @xterm/xterm@latest @xterm/addon-canvas@latest @xterm/addon-fit@latest @xterm/addon-unicode11@latest @xterm/addon-web-links@latest`）
6. `npx vite build` — 檢查是否有 breaking changes
7. 若有 breaking changes：
   - 逐一修復 TypeScript 錯誤
   - 記錄每個 breaking change 和修復方式
   - 若修復工作量過大，回報 PARTIAL 並記錄已知問題
8. Build 通過後，記錄升級後版本快照
9. **BUG-012 測試**：
   - 啟動應用（`npm run dev` 或打包後執行）
   - 請使用者開一個 alt buffer 應用（如 claude TUI）
   - 在 alt buffer 中滾動滑鼠滾輪
   - 觀察是否出現殘影
   - 測試 Redraw 按鈕是否仍然有效
   - 記錄測試結果和螢幕截圖描述
10. Git commit（升級變更）
11. `git push -u origin T0043-xterm-v6-test`（保留遠端分支）
12. 填寫回報區，**務必包含**：
    - 升級前/後版本對比表
    - BUG-012 測試結果（修復 / 未修復 / 部分改善）
    - Breaking changes 清單和修復方式
    - 是否建議 merge 回 main

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
（DONE / FAILED / BLOCKED / PARTIAL）

### 產出摘要
（升級前/後版本對比、BUG-012 測試結果、breaking changes）

### 互動紀錄
（記錄執行過程中與使用者的重要互動）

### 遭遇問題
（若有問題或需要指揮塔介入的事項，在此描述）

### sprint-status.yaml 已更新
不適用

### 回報時間
（填入當前時間）
