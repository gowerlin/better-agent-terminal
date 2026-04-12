# 工單 T0055-version-management-and-about-dialog

## 元資料
- **工單編號**：T0055
- **任務名稱**：版號管理重構 + About Dialog 更新 + version.json 建立
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-12 18:26 (UTC+8)
- **開始時間**：2026-04-12 18:31 (UTC+8)
- **完成時間**：（完成時填入）

## 工作量預估
- **預估規模**：中（版號抽離 + About dialog + version.json）
- **Context Window 風險**：低

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：涉及多個檔案但邏輯簡單

## 任務指令

### 背景

目前 About Dialog 顯示原版資訊（Version 2.1.3, Author: TonyQ）。我們是 fork 版本，需要：
1. 建立自己的版號體系（從 1.0.0 開始）
2. 追蹤上游版號
3. 版號從 hardcode 改為集中管理

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）

### 已知位置（塔台已盤點）

| 位置 | 內容 |
|------|------|
| `package.json:3` | `"version": "2.1.3"` |
| `package.json:5` | `"author": "TonyQ CO., LTD."` |
| `electron/main.ts:412-420` | About dialog（`dialog.showMessageBox`） |
| `electron/update-checker.ts` | 版號比較邏輯（讀 package.json version） |

### Repo 資訊

| 角色 | URL |
|------|-----|
| **上游（原版）** | https://github.com/tony1223/better-agent-terminal |
| **我們的 fork** | https://github.com/gowerlin/better-agent-terminal |

---

### Part 1：建立 `version.json`

在專案根目錄新增 `version.json`：

```json
{
  "upstream": {
    "name": "better-agent-terminal",
    "author": "TonyQ",
    "repo": "https://github.com/tony1223/better-agent-terminal",
    "version": "2.1.3",
    "lastSyncCommit": "<查 git log 找到 fork 基準點的 commit hash>",
    "lastSyncDate": "<對應日期>"
  },
  "fork": {
    "author": "Gower",
    "repo": "https://github.com/gowerlin/better-agent-terminal"
  }
}
```

**找 lastSyncCommit 的方法**：
- `git log --oneline --all` 找到 fork 之前最後一個原版 commit
- 或看 `git log --oneline main | tail -20` 找最早的 commit（fork 起點）

---

### Part 2：更新 `package.json`

```json
{
  "version": "1.0.0",
  "author": "Gower"
}
```

- version 從 `2.1.3` 改為 `1.0.0`（我們的獨立版號）
- author 從 `TonyQ CO., LTD.` 改為 `Gower`
- 其他欄位不動

---

### Part 3：更新 About Dialog

修改 `electron/main.ts` 的 About dialog（約 L412-420），讀取 `version.json` 顯示完整資訊：

**目標顯示格式**：
```
Better Agent Terminal
Version: 1.0.0

Author: Gower
Fork from: TonyQ — https://github.com/tony1223/better-agent-terminal
Upstream version: 2.1.3

A terminal aggregator with multi-workspace support and Claude Agent integration.
```

**實作方式**：
1. 在 main process 啟動時讀取 `version.json`（sync read，跟 settings 一樣）
2. About dialog 的 `message` 和 `detail` 使用讀取的資訊
3. 版號用 `app.getVersion()`（讀 package.json）作為我們的版號
4. upstream version 從 `version.json` 讀取

---

### Part 4：確認 update-checker 相容

`electron/update-checker.ts` 使用版號做更新檢查。確認改為 1.0.0 後：
- 更新檢查的比較邏輯是否正常
- 更新檢查的 repo URL 是否指向我們的 repo（不是原版）
- 若指向原版 → 改為指向我們的 repo 或暫時停用

---

### 預期產出
- 新增 `version.json`
- 修改 `package.json`（version + author）
- 修改 `electron/main.ts`（About dialog）
- 可能修改 `electron/update-checker.ts`
- 1-2 個 atomic commit

### Commit 規範
```
feat(version): establish fork version management with upstream tracking
```

### 驗收條件
- [ ] `package.json` version 為 `1.0.0`
- [ ] `version.json` 存在且包含完整 upstream/fork 資訊
- [ ] About dialog 顯示：Version 1.0.0、Author: Gower、Fork from TonyQ + link
- [ ] update-checker 指向正確的 repo（或已停用）
- [ ] `npx vite build` 通過
- [ ] **開啟 About dialog 目視確認**（GP020）

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
（DONE / FAILED / BLOCKED / PARTIAL）

### 產出摘要
（修改檔案、version.json 內容、lastSyncCommit、commit hash）

### 遭遇問題
（若有）

### 回報時間
（填入當前時間）
