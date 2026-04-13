# 工單 T0084-fix-bug012-cherry-pick-convertEol-fix

## 元資料
- **工單編號**：T0084
- **任務名稱**：BUG-012 修復 — cherry-pick convertEol fix 到主線
- **狀態**：DONE
- **建立時間**：2026-04-13 12:55 (UTC+8)
- **開始時間**：2026-04-13 12:56 (UTC+8)
- **完成時間**：2026-04-13 12:59 (UTC+8)
- **相關單據**：BUG-012, EXP-BUG012-001, T0071

---

## 工作量預估
- **預估規模**：極小（2 行 code change + commit）
- **Context Window 風險**：極低

## Session 建議
- **建議類型**：🆕 新 Session（主線目錄，非 worktree）

---

## 任務指令

### 背景

EXP-BUG012-001 實驗確認 BUG-012 根因：
- **`convertEol: true`** ← 根因，移除
- **`scrollOnOutput: true`** ← 非根因，但移除可對齊 VS Code 行為

Fix 位於 `exp/bug012-scrollOnOutput` 分支的 `src/components/TerminalPanel.tsx`（2 行變更）。

### 執行方式

**方式 A：cherry-pick（推薦）**

```bash
# 在主線目錄執行
git log exp/bug012-scrollOnOutput --oneline -3   # 確認 fix commit hash
git cherry-pick <fix-commit-hash>
```

**方式 B：手動套用**

直接讀 `../better-agent-terminal-bug012/src/components/TerminalPanel.tsx`，找到 2 行變更手動套用到主線：

1. Terminal constructor 中移除或設定 `convertEol: false`
2. Terminal constructor 中移除 `scrollOnOutput: true`

### 驗收
1. `npx vite build` 通過
2. Dev server 啟動，執行 `claude`，alt buffer 捲動無殘影
3. 四種 shell（PowerShell / pwsh / cmd / git bash）換行正常

### T0084 完成後塔台動作
- BUG-012 → 🧪 VERIFY
- 使用者 runtime 驗收通過後 → 🚫 CLOSED（直接關閉，不走 FIXED）
  - 理由：BUG-012 原始狀態為「上游追蹤 #46898」；現已確認根因在 BAT 端（非上游），自行修復後結案
  - 可在上游 issue #46898 留言：「Root cause identified in BAT's xterm.js integration (convertEol: true). Fixed on BAT side. Not an upstream issue.」

---

## Sub-session 執行指示

> **重要**：在**主線目錄**（`D:\ForgejoGit\better-agent-terminal-main\better-agent-terminal`）執行，不是 worktree。

1. 確認當前在主線（`git branch` 應顯示 `main`）
2. 選方式 A（cherry-pick）或方式 B（手動），自行判斷哪個更乾淨
3. `npx vite build` 驗證
4. commit：
```
fix(terminal): BUG-012 — 移除 convertEol 修復 alt buffer 殘影

- 移除 convertEol: true（pty 環境已處理 EOL，重複轉換干擾 alt buffer 渲染）
- 移除 scrollOnOutput: true（對齊 VS Code 預設行為）
- 根因由 EXP-BUG012-001 實驗驗證（5 輪排除法確認）

Fixes BUG-012
```
5. **不要** `git push`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 採用方式
手動套用（worktree 不存在，experiment 分支與 main 無 diff，直接在主線修改）

### 產出摘要
- 修改檔案：`src/components/TerminalPanel.tsx`（-3 行, +1 行）
- 移除 `convertEol: true`（BUG-012 根因）
- 移除 `scrollOnOutput: true`（對齊 VS Code 預設行為）
- Commit: `96cec8a` fix(terminal): BUG-012 — 移除 convertEol 修復 alt buffer 殘影
- `npx vite build` 通過，無 TypeScript 錯誤

### 遭遇問題
無

### 互動紀錄
無
