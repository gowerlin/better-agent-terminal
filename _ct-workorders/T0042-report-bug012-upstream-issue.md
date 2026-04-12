# 工單 T0042-report-bug012-upstream-issue

## 元資料
- **工單編號**：T0042
- **任務名稱**：Submit BUG-012 upstream issue to anthropics/claude-code
- **狀態**：PENDING
- **建立時間**：2026-04-12 14:20 (UTC+8)
- **開始時間**：（sub-session 開始時填入）
- **完成時間**：（完成時填入）
- **前置依賴**：T0041（root cause analysis complete）

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：低
- **降級策略**：無需降級

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：Single task, clean context

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/T0041-bug012-v2-alt-buffer-scroll-ghosting.md` — Root cause analysis and evidence
- `package.json` — Verify exact xterm.js and addon versions

### 輸入上下文

**Task**: Submit a GitHub issue to `anthropics/claude-code` repository reporting a TUI rendering bug discovered during BUG-012 investigation.

**Root cause summary** (from T0041):
- Claude Code's TUI uses cursor positioning to skip columns at row edges without clearing them first
- This leaves stale characters ("ghosts") from previous frames visible
- Buffer dump confirms ghost text exists in xterm.js buffer — not a renderer artifact
- Terminal emulator is behaving correctly; the issue is in the TUI's rendering logic
- SIGWINCH (resize) triggers full repaint which clears ghosts, confirming the TUI can render correctly

### Issue content (English, ready to submit)

**Title**: `TUI rendering leaves stale characters at row edges during partial screen updates`

**Body** (use as template — verify versions from package.json before submitting):

```markdown
## Description

When Claude Code's TUI redraws the screen (e.g., during scrolling or navigation), it uses cursor positioning to skip columns at the beginning/end of rows without clearing them first. This leaves "ghost" characters from the previous frame visible at row edges.

## Reproduction

1. Open Claude Code in any xterm.js-based terminal (tested: custom Electron app with xterm.js + @xterm/addon-canvas)
2. Wait for the TUI to render (e.g., memory context display, menu screens)
3. Scroll or navigate to trigger a partial screen redraw
4. Observe stale characters at the left and right edges of rows

## Evidence

Buffer dump via `terminal.buffer.active.getLine(n).translateToString()` confirms the ghost text is in the xterm.js buffer itself — not a renderer artifact:

```
bufferType: "alternate", cols: 138, rows: 28
Line 1: "Ge- 既有專案（有 project-context.md）"   ← "Ge" is stale from previous frame
Line 6: "Ap我需要了解你的需求"                     ← "Ap" is stale from previous frame
```

The TUI positions the cursor to column ~2-3 and starts writing, leaving columns 0-1 with content from the prior render pass.

## Expected behavior

TUI should clear full rows before writing partial content, using either:
- `ESC[2K` (erase entire line) before each row update
- Write spaces to pad unused columns
- `ESC[2J` (erase display) before full redraws

## Workaround

Triggering a terminal resize (SIGWINCH) forces Claude Code to do a complete screen repaint, which clears all ghost characters. The `CLAUDE_CODE_NO_FLICKER=1` environment variable did not resolve this issue.

## Environment

- OS: Windows 11 Pro
- Terminal: xterm.js <VERSION_FROM_PACKAGE_JSON> (Electron app)
- Claude Code: <VERIFY_ACTUAL_VERSION>
- Renderer: @xterm/addon-canvas (also tested with default DOM renderer — same result)
```

### 預期產出
- GitHub issue created at `anthropics/claude-code`
- Issue URL recorded in workorder report

### 驗收條件
- [ ] Issue submitted successfully to `anthropics/claude-code`
- [ ] Versions verified from `package.json` (xterm.js) and `claude --version` (Claude Code)
- [ ] Issue URL recorded in report
- [ ] Issue content is in English, professional tone, with evidence

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 讀取 `package.json` 取得 xterm.js 精確版號
4. 執行 `claude --version` 取得 Claude Code 精確版號
5. 將 issue body 中的 `<VERSION_FROM_PACKAGE_JSON>` 和 `<VERIFY_ACTUAL_VERSION>` 替換為實際版號
6. 使用 `gh issue create --repo anthropics/claude-code --title "..." --body "..."` 提交
7. 記錄 issue URL
8. 填寫回報區

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
（DONE / FAILED / BLOCKED / PARTIAL）

### 產出摘要
（Issue URL、實際提交的版號資訊）

### 互動紀錄
（記錄執行過程中與使用者的重要互動）

### 遭遇問題
（若有問題或需要指揮塔介入的事項，在此描述）

### sprint-status.yaml 已更新
不適用

### 回報時間
（填入當前時間）
