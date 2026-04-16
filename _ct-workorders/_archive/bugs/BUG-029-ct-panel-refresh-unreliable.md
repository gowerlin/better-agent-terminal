# BUG-029 — CT 面板刷新不可靠：git 操作後狀態不同步，手動刷新無效

## 狀態
**🚫 CLOSED**（T0120 修復，人工驗收通過 2026-04-16）

## 發現時間
2026-04-16 00:35 UTC+8

## 嚴重度
**🟡 Medium**（功能正確但 UX 差，經常發生）

## 現象描述

CT 面板在以下場景後不會自動更新，且手動點刷新按鈕也無效：
- `git mv` 批次歸檔工單到 `_archive/`
- `git pull --no-rebase` 合併遠端（含檔案新增/修改）
- 工單檔案狀態更新（如 OPEN → CLOSED）

**使用者回報**：「經常發生，要提高容錯性」

**截圖**：歸檔 71 張工單 + merge 20 commits 後，面板仍顯示舊資料，刷新無效。

## 預期行為

1. `git mv` / `git pull` 後，file watcher 偵測到變更 → 自動刷新
2. 手動刷新按鈕**必須**強制重讀所有檔案（不依賴 file watcher event）
3. 歸檔後的工單不再出現在熱區列表

## 根因推測

1. **git mv 不觸發 file watcher**：`git mv` 是 rename 操作，chokidar/fs.watch 可能不產生 add/unlink 事件
2. **git merge 批次變更太快**：大量檔案同時變更，file watcher 的 debounce 可能吞掉部分事件
3. **手動刷新只 re-render 不 re-read**：刷新按鈕可能只觸發 React re-render，沒有重新從 disk 讀取檔案列表
4. **快取失效不完整**：IPC 層可能有快取，刷新時沒清除

## 歷史相關 BUG

- BUG-024：CT 面板不監聽索引文件變更（T0095 修復）
- BUG-025：新建工單 Pending，file watch 不感知（T0101 修復）
- BUG-026：_bmad-output/ 未被 file watch 監聯（T0105 修復）

以上都是「特定檔案/目錄未被監聽」，本次是「git 批次操作後整體刷新機制不可靠」。

## 修復方向

1. **調查**：確認刷新按鈕的完整呼叫鏈（UI → IPC → file read → state update）
2. **強制刷新**：刷新按鈕應 invalidate 所有快取 + 重新 Glob 掃描 `_ct-workorders/`
3. **git 操作偵測**：監聽 `.git/` 目錄變更（如 HEAD / index 變更）作為批次刷新觸發
4. **Fallback**：若 file watcher 無事件但使用者按刷新，強制完整重掃

## 影響範圍

- CT 面板所有頁籤（工單、臭蟲、待辦池、決策）
- 所有 git 批次操作場景（archive、merge、rebase、checkout）
