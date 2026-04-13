# 工單 T0071-bug012-bat-vs-vscode-xterm-diff

## 元資料
- **工單編號**：T0071
- **任務名稱**：BUG-012 重新調查 — BAT vs VS Code xterm.js 整合差異分析
- **狀態**：DONE
- **建立時間**：2026-04-13 00:25 (UTC+8)
- **開始時間**：2026-04-13 00:28 (UTC+8)
- **完成時間**：2026-04-13 00:42 (UTC+8)
- **相關單據**：BUG-012, T0041, T0042, T0043

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中
- **降級策略**：優先完成 xterm 配置比對，VS Code 原始碼分析可簡化

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需讀取 BAT xterm 整合 + VS Code 終端原始碼參考

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/BUG-012-alt-buffer-scroll-ghost-text.md`（問題描述）
- `_ct-workorders/_archive/workorders/T0041-bug012-v2-alt-buffer-scroll-ghosting.md`（先前調查）
- `_ct-workorders/_archive/workorders/T0043-xterm-v6-full-upgrade-test.md`（版本交叉驗證）
- `CLAUDE.md`

### 輸入上下文

**新發現**：使用者在 VS Code 終端機下執行相同的 Claude Code CLI，**沒有出現 BUG-012 的捲動殘影問題**。BAT 和 VS Code 都使用 xterm.js，但只有 BAT 有殘影。

這推翻了先前「Claude Code CLI TUI buffer 處理問題」的假設（anthropics/claude-code#46898）。根因更可能在 BAT 的 xterm.js 整合方式。

先前調查結果摘要：
- T0041：確認殘影現象與 alt buffer scroll 有關
- T0043：xterm v5 和 v6 都有殘影 → 不是 xterm 版本問題
- 綜合新證據：不是 xterm 版本問題 + 不是 CLI 問題 → **BAT 整合層問題**

### 分析目標

#### A. BAT xterm.js 配置與整合
1. BAT 使用的 xterm.js 版本
2. xterm Terminal 的建構參數（scrollback, altClickMovesCursor, allowProposedApi 等）
3. Alt buffer 相關設定
4. Renderer 類型（DOM / canvas / webgl）
5. 已安裝的 xterm addons 清單
6. resize handler 實作方式
7. BAT overlay 層是否會干擾 xterm 渲染（DOM 層疊關係）

#### B. VS Code xterm.js 配置對比（參考）
1. VS Code 的 xterm.js 版本（從 node_modules 或 package.json 查詢）
2. VS Code 終端的已知 xterm 配置（可 WebSearch "VS Code xterm configuration"）
3. VS Code 是否有針對 alt buffer scroll 的特殊處理或 workaround
4. VS Code 的 renderer 選擇邏輯

#### C. 差異分析與建議
1. 列出 BAT vs VS Code 的配置差異表
2. 標記最可能導致殘影的差異項
3. 建議修正方案（優先級排序）
4. 是否需要更新/關閉上游 issue #46898

### 預期產出
- 分析報告（寫入回報區）
- BAT vs VS Code xterm 配置比對表
- 建議修正方案

### 驗收條件
- [ ] 記錄 BAT xterm.js 完整配置
- [ ] 找到 BAT vs VS Code 的關鍵配置差異
- [ ] 標記最可能的根因
- [ ] 提出修正方案建議

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

#### A. BAT xterm.js 完整配置

**xterm.js 版本**：`@xterm/xterm ^5.5.0`（main branch；T0043 測試分支已升至 v6.0.0，殘影依舊）

**Terminal 建構參數**（`TerminalPanel.tsx:223-255`）：
| 參數 | 值 | 說明 |
|------|-----|------|
| `fontSize` | settings | 使用者可配 |
| `fontFamily` | settings | 使用者可配 |
| `cursorBlink` | `true` | |
| `scrollback` | `10000` | Normal buffer 回捲行數 |
| `convertEol` | `true` | ⚠️ **關鍵差異 #1** |
| `allowProposedApi` | `true` | |
| `allowTransparency` | `true` | ⚠️ **關鍵差異 #2** |
| `scrollOnOutput` | `true` | ⚠️ **關鍵差異 #3** |

**已載入 Addons**：
1. `FitAddon` — 自適應容器尺寸
2. `Unicode11Addon` — Unicode 11 字元寬度
3. `WebLinksAddon` — URL 點擊開啟
4. `CanvasAddon` — Canvas 2D 渲染器（⚠️ **差異 #4**）

**Renderer**：Canvas（經由 `@xterm/addon-canvas`）

**Resize 處理**：`ResizeObserver` + 200ms debounce → `fitAddon.fit()` → `pty.resize()`

**Alt buffer 追蹤**：`terminal.buffer.onBufferChange()` → 更新 `altBufferActive` state

**Scroll 處理**：僅 `Ctrl+Wheel` 縮放；無 alt buffer 專屬 scroll 處理

**DOM 覆蓋層**：Context menu（Portal 到 body）、IME 位置修正（MutationObserver）

**PTY 環境變數**（`pty-manager.ts:174-196`）：
- `TERM=xterm-256color`
- `COLORTERM=truecolor`
- `TERM_PROGRAM=better-agent-terminal`（⚠️ **差異 #5**）
- `CLAUDE_CODE_NO_FLICKER=1`

#### B. VS Code xterm.js 配置（參考）

**xterm.js 版本**：與 VS Code 綁定（隨 VS Code 版本更新，通常為最新穩定版）

**Terminal 建構參數**（`xtermTerminal.ts`）：
| 參數 | 值 | 說明 |
|------|-----|------|
| `scrollback` | 使用者可配（預設 1000） | |
| `convertEol` | **未設定（default=false）** | ⚠️ **差異 #1** |
| `allowTransparency` | **僅 enableImages 時啟用** | ⚠️ **差異 #2** |
| `scrollOnOutput` | **未設定** | ⚠️ **差異 #3** |
| `scrollOnEraseInDisplay` | `true` | BAT 未設定 |
| `allowProposedApi` | `true` | |
| `altClickMovesCursor` | 依使用者設定 | |
| `fastScrollSensitivity` | 使用者可配 | |
| `scrollSensitivity` | 使用者可配 | |
| `smoothScrollDuration` | 動態（偵測實體滑鼠） | |
| `windowOptions` | 啟用（尺寸查詢） | |
| `vtExtensions` | kittyKeyboard, win32InputMode | |

**Renderer**：WebGL（VS Code 預設使用 GPU 加速渲染器）— **差異 #4**

**PTY 環境變數**：
- `TERM_PROGRAM=vscode`（⚠️ **差異 #5**）
- 其餘 VS Code 特定變數

#### C. 差異分析與建議

##### 配置差異比對表

| # | 設定項 | BAT | VS Code | 可能影響 | 根因可能性 |
|---|--------|-----|---------|----------|------------|
| 1 | `convertEol` | `true` | `false`（預設） | 🔴 **高** — xterm.js 官方文檔明確警告：使用真實 PTY 時不應啟用 | ★★★★☆ |
| 2 | `allowTransparency` | `true` | `false`（預設） | 🟡 **中** — 影響 renderer 清除行為，可能使殘留字元「透過」 | ★★★☆☆ |
| 3 | `scrollOnOutput` | `true` | 未設定 | 🟡 **中** — alt buffer 下可能觸發不必要的 viewport 操作 | ★★☆☆☆ |
| 4 | Renderer | Canvas (addon) | WebGL (GPU) | 🟡 **中** — 不同渲染路徑對 cell 清除/重繪的行為可能不同 | ★★☆☆☆ |
| 5 | `TERM_PROGRAM` | `better-agent-terminal` | `vscode` | 🟡 **中** — Claude Code 的 Ink TUI 可能依此調整渲染策略 | ★★☆☆☆ |
| 6 | `scrollOnEraseInDisplay` | 未設定（false） | `true` | 🟢 **低** — 主要影響 ED2 清屏行為 | ★☆☆☆☆ |
| 7 | `smoothScrollDuration` | 未設定（0） | 動態 | 🟢 **低** — 影響捲動動畫，不影響 buffer 內容 | ★☆☆☆☆ |

##### 最可能的根因

**主因候選 #1：`convertEol: true`（高度懷疑）**

xterm.js 官方文檔明確指出：
> "Normally the settings of the underlying PTY (termios) deal with the translation of `\n` to `\r\n` and **this setting should not be used**. If you deal with data from a non-PTY related source, this setting might be useful."

BAT 使用 node-pty（conpty backend），PTY 層已經處理 `\n` → `\r\n` 轉換。再疊加 `convertEol: true` 形成雙重轉換：
- PTY 輸出 `\r\n` → xterm.js 的 `convertEol` 再對其中的 `\n` 做一次檢查
- 正常情況 `\r\n` 不會被重複轉換（`\n` 前有 `\r` 則跳過）
- 但若 Claude Code TUI 的 custom Ink renderer 在某些 escape sequence 間隙插入 bare `\n`，`convertEol` 會加入額外的 `\r`（carriage return），干擾游標定位
- Claude Code 的 Ink renderer 使用 `EL`（Erase in Line）清除行尾，若游標位置被 `convertEol` 偏移，EL 可能清錯位置

**主因候選 #2：`allowTransparency: true` + Canvas renderer**

- `allowTransparency: true` 啟用 RGBA alpha 通道
- Canvas renderer 在重繪 cell 時，透明背景可能不會完全覆蓋前一幀的像素
- VS Code 使用 WebGL renderer + `allowTransparency: false`（opaque），每個 cell 重繪時完全覆蓋前一幀內容
- 即使 buffer 中有殘留字元，opaque renderer 會在 TUI 下一次「碰到」該 cell 時完整覆蓋

**輔助因素：`scrollOnOutput: true`**

- Alt buffer 理論上沒有 scrollback（scrollback=0）
- 但 `scrollOnOutput: true` 可能在 TUI 輸出時觸發 viewport scrollTop 重設
- 若 viewport 在 mouse wheel 事件後有微小偏移（race condition），`scrollOnOutput` 的 scrollTop 重設可能造成「閃動」，使殘影可見

##### 建議修正方案（優先級排序）

| 優先級 | 修改項 | 預期效果 | 風險 |
|--------|--------|----------|------|
| **P0** | 移除 `convertEol: true` | 消除雙重 EOL 轉換，對齊 VS Code 行為 | 低風險 — PTY 已處理 EOL |
| **P1** | 改 `allowTransparency: false` | 強制 opaque 背景，改善 cell 重繪覆蓋 | 中風險 — 若有功能依賴透明背景需確認 |
| **P2** | Alt buffer 時停用 `scrollOnOutput` | 避免 alt buffer 下不必要的 viewport 操作 | 低風險 — alt buffer 本不需此功能 |
| **P3** | 加入 `scrollOnEraseInDisplay: true` | 對齊 VS Code 的 ED2 處理方式 | 低風險 — 不影響現有功能 |
| **P4** | 評估 WebGL renderer 替代 Canvas | 對齊 VS Code 渲染路徑 | 需另開工單評估 |

##### 上游 Issue #46898 更新建議

原先假設「根因在 Claude Code TUI 的 cursor positioning」仍然部分成立（TUI 確實做 partial update），但 **terminal emulator 的配置差異是觸發條件**。建議：
- 不關閉 #46898（TUI 的 partial update 仍是底層原因）
- 在 issue 中追加 BAT vs VS Code 的差異發現
- 說明 `convertEol` 和 `allowTransparency` 可能加劇問題

### 互動紀錄
無（全程為自動化分析，未需使用者介入）

### 遭遇問題
1. VS Code 原始碼搜尋不易——xterm.js 配置分散在多個檔案中，透過 WebFetch raw GitHub 取得主要配置
2. xterm.js `alternateScroll` (DECSET 1007) **尚未實作**（issue #5194），排除此差異
3. Claude Code TUI 使用自訂 Ink fork，無法直接確認 `TERM_PROGRAM` 相關的條件邏輯

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-13 00:42 (UTC+8)
