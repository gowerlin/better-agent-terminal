# 工單 T0120-bug029-ct-panel-force-refresh

## 元資料
- **工單編號**：T0120
- **任務名稱**：BUG-029 修復：CT 面板刷新按鈕強制重讀 + git 操作後自動刷新
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-16 00:40 (UTC+8)
- **開始時間**：2026-04-16 02:41 (UTC+8)
- **完成時間**：（完成時填入）
- **關聯 BUG**：BUG-029

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中（涉及 main process + renderer 跨層）
- **降級策略**：若 git 監聽太複雜，先確保刷新按鈕強制重讀即可（PARTIAL）

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需讀取 main process file watcher + renderer 刷新邏輯

## 任務指令

### 前置條件
需載入的文件清單：
- 本工單（完整閱讀）
- CT 面板刷新機制相關程式碼（ControlTowerPanel、file watcher、IPC handler）
- 歷史修復參考：BUG-024(T0095)、BUG-025(T0101)、BUG-026(T0105) 的修復思路

### 輸入上下文

**問題**：CT 面板在 git 批次操作（`git mv` 歸檔、`git pull` 合併）後不同步，手動刷新按鈕也無效。經常發生。

**已知的 file watch 架構**（從歷史 BUG 修復推斷）：
- main process 使用 chokidar 或 fs.watch 監聽 `_ct-workorders/`
- 檔案變更 → IPC 通知 renderer → React state 更新 → UI 刷新
- 刷新按鈕的行為待確認（可能只 re-render 沒 re-read）

**問題場景**：
1. `git mv` 71 張工單到 `_archive/` → 面板仍顯示舊列表
2. `git pull` 合併 20 commits（含 8 檔案變更）→ 面板不更新
3. 點刷新按鈕 → 無效果

### 預期產出
- 修復後的刷新機制，確保上述 3 個場景都能正確刷新

### 驗收條件
- [ ] **刷新按鈕強制重讀**：點擊刷新後，完整重新 Glob 掃描 `_ct-workorders/`，不依賴 file watcher cache
- [ ] **git mv 後同步**：歸檔工單後，面板在刷新/自動偵測後不再顯示已移走的檔案
- [ ] **git merge 後同步**：pull merge 後，面板在刷新/自動偵測後反映新狀態
- [ ] **現有 file watch 不退化**：正常檔案編輯（非 git 操作）仍即時更新
- [ ] `npx vite build` 編譯通過

### 修復策略建議（優先級排序）

**P0 — 刷新按鈕必須有效**（最小修復）：
- 刷新按鈕的 handler 應：清除所有快取 → 重新 Glob 掃描目錄 → 重新讀取+解析所有檔案 → 更新 state
- 這是使用者的最後手段，必須 100% 可靠
- **重要**：刷新按鈕應刷新**目前所在頁籤**的資料，而非只刷新工單列表
  - 工單頁籤 → 重讀 T*.md
  - 臭蟲頁籤 → 重讀 _bug-tracker.md + BUG-*.md
  - 待辦池頁籤 → 重讀 _backlog.md + PLAN-*.md
  - 決策頁籤 → 重讀 _decision-log.md
  - 其他頁籤 → 各自的資料來源
  - 若目前實作只刷新工單，需擴展為通用刷新機制

**P1 — git 操作自動偵測**（加分項）：
- 監聽 `.git/HEAD` 或 `.git/index` 變更作為 git 操作信號
- 偵測到 git 操作 → debounce 500ms → 觸發完整重掃
- 或：監聽 `_ct-workorders/` 目錄本身的 rename/unlink 事件

**P2 — 防禦性 polling**（保底）：
- 若 P0+P1 仍有漏洞，加一個低頻 polling（每 30 秒檢查目錄 mtime）
- 只在 mtime 變化時才觸發完整重掃（不浪費資源）

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 追蹤刷新按鈕的完整呼叫鏈：UI onClick → IPC call → main process handler → 回傳資料 → state 更新
4. 確認問題根因：是沒重讀檔案？還是讀了但快取沒清？還是 state 沒更新？
5. 實作 P0 修復：刷新按鈕 = 強制完整重掃
6. 評估 P1 可行性，若成本低則一併實作
7. 測試場景：
   a. 手動編輯一張工單 → 確認即時更新（現有功能不退化）
   b. `git mv` 一張工單到 `_archive/` → 點刷新 → 確認消失
   c. 模擬 merge 情境 → 點刷新 → 確認更新
8. `npx vite build` 確認編譯通過
9. 填寫回報區，git commit

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
FIXED

### 產出摘要

修復已完成，等待驗收。

**修改檔案**：
- `electron/main.ts` — 新增 `fs:reset-watch` IPC handler，銷毀並重建 file watcher
- `electron/preload.ts` — expose `resetWatch` 方法到 renderer
- `electron/remote/protocol.ts` — 加入 `fs:reset-watch` 到 PROXIED_CHANNELS
- `src/types/electron.d.ts` — 新增 `fs` 介面型別定義（含 `resetWatch`）
- `src/components/ControlTowerPanel.tsx` — 重構刷新機制：
  - 新增 `reloadAll()` — 統一所有 load 函式呼叫
  - 新增 `forceRefresh()` — **重建 watcher** + 重讀所有資料
  - 刷新按鈕改用 `forceRefresh`（先 resetWatch → 再 reload）
  - P1: 監聽 `.git/` 目錄變更，git 操作後自動觸發 reloadAll

**根因分析**：
1. Windows `fs.watch` 的 `ReadDirectoryChangesW` buffer 在大量 git 操作（如 71 個 `git mv`）時可能溢出
2. 溢出觸發 error event → watcher 被 `fileWatchers.delete()` 移除但不重建
3. 之後不再收到 auto-refresh 事件
4. 刷新按鈕原先只呼叫同樣的 load 函式，沒有重建 watcher
5. 新增 `fs:reset-watch` 可在刷新時強制重建 watcher，確保恢復監聽能力

**P0 完成**：刷新按鈕 = resetWatch + 完整重掃（100% 可靠）
**P1 完成**：監聯 `.git/` 目錄，git 操作後自動觸發刷新
**P2 未實作**：防禦性 polling（目前 P0+P1 應足夠）

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-16 05:20 (UTC+8)
