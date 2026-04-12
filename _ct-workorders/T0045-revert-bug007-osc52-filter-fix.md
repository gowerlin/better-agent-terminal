# 工單 T0045-revert-bug007-osc52-filter-fix

## 元資料
- **工單編號**：T0045
- **任務名稱**：回滾 BUG-007 OSC 52 filter regex 修改（commit 62e4fca）
- **狀態**：DONE
- **建立時間**：2026-04-12 16:00 (UTC+8)
- **開始時間**：2026-04-12 16:02 (UTC+8)
- **完成時間**：2026-04-12 16:03 (UTC+8)

## 背景

T0044 的 Bug A 修復（commit `62e4fca`）移除了 `filterTerminalOutputNoise` regex 的 `^$` 錨點，試圖讓 filter 能匹配帶 ANSI escape code 的行。

然而驗收後確認：
- OSC 52 訊息（`sent N chars via OSC 52 · check terminal clipboard settings if paste fails`）是 Claude Code CLI 本身的上游行為
- 在其他終端也會出現，**不是 better-agent-terminal 的 bug**
- BUG-007 關閉為「上游行為 / by design」

決策：回滾 `62e4fca`，讓 T0044 分支只保留 Bug B 修復（commit `c78ab22`）。

## 工作量預估
- **預估規模**：極小（單一 git revert）
- **Context Window 風險**：極低

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：極簡操作，乾淨 context 最快

## 任務指令

### 執行步驟

1. 確認目前在 `T0044-terminal-interaction-polish` 分支
2. 確認 commit log 順序：`62e4fca`（Bug A）在 `c78ab22`（Bug B）之前
3. 執行回滾：
   ```bash
   git revert 62e4fca --no-edit
   ```
4. 確認 `filterTerminalOutputNoise` 的 regex 恢復為原始的 `/^sent \d+ chars via OSC 52 .*paste fails$/u`
5. 執行 `npx vite build` 確認通過
6. 填寫回報區

### Commit 規範
```
revert(terminal): revert BUG-007 OSC 52 regex fix

OSC 52 debug messages are upstream Claude Code CLI behavior,
not a better-agent-terminal bug. Closing BUG-007 as by-design.
```

### 驗收條件
- [ ] `git log` 顯示 revert commit 在 `c78ab22` 之後
- [ ] `filterTerminalOutputNoise` regex 恢復帶 `^$` 錨點
- [ ] `npx vite build` 通過

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

### 產出摘要
- Revert commit：`f327d78` — "Revert 'fix(terminal): remove OSC 52 debug message from terminal output'"
- `filterTerminalOutputNoise` regex 恢復為 `/^sent \d+ chars via OSC 52 .*paste fails$/u`（含 `^$` 錨點）
- Bug B fix（`c78ab22` focus restoration）保持不受影響
- `npx vite build` 通過（1.12s）

### 遭遇問題
無

### 互動紀錄
無

### 回報時間
2026-04-12 16:03 (UTC+8)
