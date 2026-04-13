# 工單 EXP-BUG012-001-disable-scrollOnOutput-in-alt-buffer

## 元資料
- **工單編號**：EXP-BUG012-001
- **任務名稱**：實驗 — 停用 scrollOnOutput 觀察 BUG-012 殘影是否消失
- **狀態**：DONE
- **建立時間**：2026-04-13 12:25 (UTC+8)
- **開始時間**：2026-04-13 12:27 (UTC+8)
- **完成時間**：2026-04-13 12:51 (UTC+8)
- **分支**：`exp/bug012-scrollOnOutput`
- **Worktree 路徑**：`../better-agent-terminal-bug012`
- **相關單據**：BUG-012, T0071

---

## 背景

T0071 分析顯示 BUG-012（alt buffer 捲動殘影）的根因很可能是：

- BAT 設定 `scrollOnOutput: true`，VS Code **未設定此選項**
- Alt buffer 模式下 Claude Code TUI 輸出時，BAT 強制捲到底部，干擾 alt buffer 渲染，產生殘影
- VS Code 因為沒有此設定，所以不出現殘影

**本實驗目標**：在 worktree 環境驗證此假設。

---

## Worktree 設定（使用者在 host 執行）

```bash
# 建立 worktree 並切換到新分支
git worktree add ../better-agent-terminal-bug012 -b exp/bug012-scrollOnOutput

# 確認 worktree 已建立
git worktree list
```

---

## 任務指令

### 前置條件
- 在 `../better-agent-terminal-bug012` worktree 中執行
- 讀取 `src/components/TerminalPanel.tsx`

### 修改方案 A（保守）：alt buffer 模式下條件性停用

在 `TerminalPanel.tsx` 找到 alt buffer 狀態追蹤邏輯（`terminal.buffer.onBufferChange`），在切換到 alt buffer 時動態設定：

```typescript
terminal.buffer.onBufferChange((e) => {
  const isAltBuffer = e.activeBuffer.type === 'alternate'
  // 實驗：alt buffer 時停用 scrollOnOutput，避免渲染干擾
  terminal.options.scrollOnOutput = !isAltBuffer
  // ... 現有邏輯
})
```

### 修改方案 B（直接）：完全移除 scrollOnOutput

從 Terminal constructor 直接移除 `scrollOnOutput: true`（讓 xterm.js 使用預設值 `false`），觀察是否影響正常 terminal 使用。

**先試方案 A，若不夠乾淨再試方案 B。**

---

### 驗收步驟

1. `npx vite dev` 啟動 BAT
2. 開啟一個 terminal session
3. 執行 `claude`（或任何進入 alt buffer 的指令）
4. 在 alt buffer 中捲動
5. 觀察是否仍有殘影（ghost text）

**成功條件**：alt buffer 捲動時無殘影，且正常 terminal（非 alt buffer）的捲動行為不受影響

---

### 若實驗成功

1. 在此工單回報區記錄「方案 A / B 有效」
2. 回塔台，塔台開主線修復工單（T0084）將 fix merge 回 `main`

### 若實驗失敗

1. 記錄現象（殘影仍在 / 新問題出現）
2. 可進一步嘗試：
   - 停用 `convertEol: true`
   - 加入 `scrollOnEraseInDisplay: true`（VS Code 有此設定）
   - 調整 scrollback 從 10000 降至 1000（對齊 VS Code）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
SUCCESS — 使用者驗收通過，alt buffer 殘影消失，四種 shell 正常

### 有效方案
最小化修復（隔離驗證後確認）：
1. **`convertEol: true → false`** ← **根因**（T0071 首要嫌疑命中）
2. **移除 `scrollOnOutput: true`** ← 輔助清理（對齊 VS Code 預設）

### 實驗過程
| 順序 | 候選 | 結果 |
|------|------|------|
| A | alt buffer 條件性停用 scrollOnOutput | ❌ 殘影仍在 |
| B | 完全移除 scrollOnOutput | ❌ 殘影仍在 |
| C | B + scrollOnEraseInDisplay: true | ❌ 殘影仍在 |
| D | C + scrollback 10000→1000 | ❌ 殘影仍在 |
| E | D + convertEol: false | ✅ 殘影消失 |
| **隔離** | **僅 convertEol: false + 移除 scrollOnOutput** | **✅ 殘影消失，四種 shell 正常** |

### 觀察結果
- `convertEol: true` 是 BUG-012 alt buffer 殘影的根因
- xterm.js 的 `convertEol` 在 pty 環境下不需要（pty 已處理 EOL 轉換）
- VS Code terminal 不設此選項，BAT 設了導致 alt buffer 渲染干擾
- 停用後 powershell、pwsh、cmd、git bash 四種 shell 換行均正常
- `scrollOnOutput: true` 非殘影根因，但移除可對齊 VS Code 行為

### 建議後續
1. 回塔台開主線修復工單，將 `convertEol: false` + 移除 `scrollOnOutput` cherry-pick 到 `main`
2. BUG-012 可標記 VERIFY → CLOSED

### 產出摘要
- 修改：`src/components/TerminalPanel.tsx`（2 行變更）
- 分支：`exp/bug012-scrollOnOutput`
- Worktree：`../better-agent-terminal-bug012`

### 遭遇問題
無（方案 A~D 失敗屬正常實驗排除過程）

### 互動紀錄
- [12:33] Q: 方案 A 驗證結果？ → A: 失敗 → Action: 進入方案 B
- [12:34] Q: 方案 B 驗證結果？ → A: 失敗 → Action: 疊加 scrollOnEraseInDisplay
- [12:37] Q: 候選 C 驗證結果？ → A: 失敗 → Action: 疊加降低 scrollback
- [12:39] Q: 候選 D 驗證結果？ → A: 失敗 → Action: 疊加 convertEol: false
- [12:42] Q: 候選 E 全疊加結果？ → A: 正常 → Action: 隔離測試，還原非必要變更
- [12:51] Q: 隔離測試（僅 convertEol + scrollOnOutput）？ → A: 都正常 → Action: 確認根因，收尾
