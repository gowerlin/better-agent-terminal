# 工單 T0128-agent-custom-args-settings

## 元資料
- **工單編號**：T0128
- **任務名稱**：Agent 預設自訂參數（Settings UI + ct-exec/ct-done 自動套用）
- **狀態**：DONE
- **建立時間**：2026-04-16 22:22 (UTC+8)
- **開始時間**：2026-04-16 22:25 (UTC+8)
- **完成時間**：2026-04-16 22:35 (UTC+8)

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中（跨多個檔案但邏輯清晰）
- **降級策略**：若 Context Window 不足，先完成 settings store + 終端啟動套用，UI 交後續工單

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：獨立功能，涉及 settings + terminal + UI

## 任務指令

### 前置條件
需載入的文件清單：
- `src/types/agent-presets.ts`（Agent 預設定義）
- `src/stores/settings-store.ts`（設定儲存）
- `src/components/SettingsPanel.tsx`（設定 UI）
- `src/App.tsx`（onExecWorkOrder / onDoneWorkOrder，行 720-753 附近）
- `src/components/WorkspaceView.tsx`（handleExecWorkOrder / handleDoneWorkOrder，行 580-613 附近）
- `src/components/MainPanel.tsx`（終端建立邏輯，搜尋 agent preset 相關）

### 輸入上下文

**專案**：better-agent-terminal（Electron + React + xterm.js）

**目前狀態**：
- `agent-presets.ts` 定義了 9 種 agent preset（claude-code, claude-code-v2, claude-cli, gemini-cli, codex-cli, copilot-cli 等）
- 每個 preset 有 hardcoded 的 `command` 欄位（如 `claude --continue`、`gemini`、`codex`、`gh copilot`）
- **沒有**任何機制讓使用者自訂額外參數（如 `--dangerously-skip-permissions`）
- T0126 剛修復了 ct-exec/ct-done 按鈕，command 格式改為 `claude "/ct-exec T####"`

**需求**：
使用者希望能在 Settings 中為每個 agent preset 設定自訂參數，例如：
- `claude-code` → `--dangerously-skip-permissions`
- `claude-cli` → `--dangerously-skip-permissions`
- `copilot-cli` → `--yolo`
- `codex-cli` → `--full-auto`

這些參數需要在以下場景自動套用：
1. **一般終端建立**：使用者選擇 agent preset 開新終端時，command 自動加上自訂參數
2. **ct-exec/ct-done 按鈕**：T0126 修改的 `claude "/ct-exec T####"` 也要自動套用當前 workspace 的 agent preset 參數

### 預期產出

#### 1. Settings Store 擴充
在 `settings-store.ts` 中新增 `agentCustomArgs` 設定：
```typescript
// key = agent preset id, value = 自訂參數字串
agentCustomArgs: Record<string, string>
// 例：{ 'claude-code': '--dangerously-skip-permissions', 'copilot-cli': '--yolo' }
```

#### 2. Settings UI
在 `SettingsPanel.tsx` 中新增 Agent 參數設定區塊：
- 列出所有可見的 agent preset
- 每個 agent 旁邊一個文字輸入框，可填入自訂參數
- 空值 = 不加額外參數（使用 preset 預設 command）
- placeholder 提示範例：`e.g. --dangerously-skip-permissions`

#### 3. 終端建立套用
修改終端建立邏輯，在組合 agent command 時自動附加 `agentCustomArgs[presetId]`：
- 一般終端：`claude --continue` + ` --dangerously-skip-permissions` → `claude --continue --dangerously-skip-permissions`
- ct-exec：`claude "/ct-exec T0128"` + ` --dangerously-skip-permissions` → `claude "/ct-exec T0128" --dangerously-skip-permissions`
- ct-done：同上

#### 4. 修改的檔案清單（預估）
- `src/stores/settings-store.ts` — 新增 `agentCustomArgs` 欄位和 getter/setter
- `src/components/SettingsPanel.tsx` — 新增 UI 區塊
- `src/types/index.ts` — 如需更新設定型別
- `src/App.tsx` — onExecWorkOrder / onDoneWorkOrder 套用參數
- `src/components/WorkspaceView.tsx` — handleExecWorkOrder / handleDoneWorkOrder 套用參數
- `src/components/MainPanel.tsx`（或終端建立入口）— 一般終端建立套用參數

### 驗收條件
- [ ] settings-store 新增 `agentCustomArgs` 設定項，持久化到 localStorage/settings
- [ ] Settings UI 可為每個 agent preset 設定自訂參數
- [ ] 新建終端（選擇 agent preset）時自動套用自訂參數
- [ ] ct-exec 按鈕的 command 自動套用當前 workspace agent 的自訂參數
- [ ] ct-done 按鈕的 command 同上
- [ ] 空值時不影響原有行為（向下相容）
- [ ] `npx vite build` 編譯通過

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 讀取 `agent-presets.ts` 了解 preset 結構
4. 修改 `settings-store.ts`，新增 `agentCustomArgs` 設定項
5. 修改 `SettingsPanel.tsx`，新增 Agent 自訂參數 UI
6. 找到終端建立邏輯（MainPanel 或其他入口），在組合 command 時套用 `agentCustomArgs`
7. 修改 `App.tsx` 和 `WorkspaceView.tsx` 的 onExecWorkOrder/onDoneWorkOrder，套用參數
8. 執行 `npx vite build` 確認編譯通過
9. git commit
10. 填寫回報區

### 注意事項
- 自訂參數放在 command 最後（`claude "/ct-exec T####" --flag`），確保 slash command 作為初始訊息正確傳入
- 注意引號和空格的處理（command 中可能已有引號）
- settings 要持久化，重啟 BAT 後不遺失
- 空值或未設定時不改變現有行為

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
修改檔案：
- `src/types/index.ts` — AppSettings 新增 `agentCustomArgs?: Record<string, string>`
- `src/stores/settings-store.ts` — 新增 `setAgentCustomArg()`、`getAgentCustomArgs()` 方法，預設 `agentCustomArgs: {}`
- `src/components/SettingsPanel.tsx` — 新增 Agent 自訂參數 UI 區塊（每個 preset 一個文字輸入框）
- `src/components/WorkspaceView.tsx` — 7 處啟動路徑全部套用自訂參數：
  - `startClaudeCliPty`（Claude CLI 啟動）
  - 既有終端恢復（`buildLaunchCommand` + fallback preset.command）
  - 預設終端建立（同上）
  - `handleAddAgentTerminal`（工具列新增 agent）
  - 終端重啟（restart）
  - `handleExecWorkOrder`（ct-exec 按鈕）
  - `handleDoneWorkOrder`（ct-done 按鈕）
- `src/App.tsx` — App 層級的 ct-exec/ct-done 同步套用
- `src/locales/en.json`、`zh-TW.json`、`zh-CN.json` — 新增 i18n 翻譯

commit: 375d739

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-16 22:35 (UTC+8)
