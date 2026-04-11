# Phase 1 最終交付報告 — 語音輸入功能

> **產出日期**：2026-04-11  
> **工單編號**：T0011

---

## 專案概況

| 項目 | 數值 |
|------|------|
| 啟動時間 | 2026-04-10 22:23（需求對齊） |
| 完成時間 | 2026-04-11 02:20 |
| 工單總數 | 12 張（T0001 ~ T0012） |
| Bug 修復 | 2 個（BUG-001、BUG-002） |
| 新增學習紀錄 | 11 條（L001 ~ L011） |
| 新增檔案 | 10 個（語音相關） |
| 修改檔案 | 10 個（語音相關）+ 6 個（Bug 修復） |

---

## 完成的功能

### 語音輸入核心

- ✅ 麥克風按鈕 + Alt+M 快捷鍵（toggle mode）
- ✅ 錄音中視覺回饋（紅色 + pulse 動畫）
- ✅ whisper.cpp 離線辨識（small 模型預設）
- ✅ OpenCC 繁簡轉換（自動 s2t）
- ✅ 預覽框確認流程（可編輯，不自動送出）
- ✅ Enter 確認 / Esc 取消快捷鍵

### 模型管理

- ✅ Settings 頁「🎤 語音輸入」區塊
- ✅ 4 模型支援（tiny/base/small/medium）
- ✅ HuggingFace 下載（含進度、取消）
- ✅ 偏好持久化（模型 / 語言 / 繁簡）
- ✅ 「開啟資料夾」按鈕（bonus）

### 跨平台

- ✅ macOS Info.plist 配置（NSMicrophoneUsageDescription）
- ✅ 跨平台權限說明文件

### Bug 修復

- ✅ BUG-001: Claude OAuth login paste 修復（bracketed paste 支援）
- ✅ BUG-001 §3: 死路徑清理（claude:auth-login handler 移除）
- ✅ BUG-002: 所有 context menu 改用 React Portal（6 個元件全數修復）

---

## Phase 1 的降級與取捨

- ⚠️ **無即時串流**：whisper-node-addon 不支援 PCM streaming，改為 loading → 完整結果
- ⚠️ **無 GPU 加速**：prebuilt binary 是 CPU-only，Phase 1.5 可評估 Route B 補強
- ⚠️ **TerminalThumbnail 外的 context menu 修復延後**：已在 T0008+T0012 補齊

---

## 已知限制 / Backlog

| 類別 | 項目 | 說明 |
|------|------|------|
| 技術債 | 256 個既有 tsc 錯誤 | ElectronAPI interface 落後，需獨立工單處理 |
| 技術債 | writeChunked >64KB | 仍走 pty.write（極罕見情境） |
| Phase 1.5 | Route B PoC | whisper.cpp binary + child_process，補串流 + GPU |
| Phase 2 | claude-code terminal 語音 | xterm.js overlay UI |
| 研究 | 其他引擎評估 | faster-whisper / sherpa-onnx |

---

## 學習記錄亮點（L001~L011）

| 編號 | 要點 |
|------|------|
| L001 | 不依賴訓練知識驗證產品技術底層（VSCode ≠ Whisper 的教訓） |
| L002 | 小社群 npm 套件必須先 PoC（whisper-node-addon 14 stars 的驗證） |
| L005 | 研究工單宣稱 ≠ PoC 實測 |
| L007 | vite build 通過 ≠ 型別正確（tsc --noEmit 才是） |
| L011 | CSS position:fixed 在 transformed 祖先內失效 |

---

## 下一步建議

1. **立即**：使用者依 `T0011-user-testing-guide.md` 執行手動測試（32 項）
2. **短期**：若測試發現 bug，開修正工單（不影響其他工單）
3. **中期**：處理 Backlog 中的技術債（256 tsc 錯誤、writeChunked）
4. **長期**：Phase 1.5 Route B PoC + Phase 2 claude-code terminal 整合

---

## 檔案清單

### 語音相關（新增）— 10 個

| # | 路徑 | 用途 |
|---|------|------|
| 1 | src/components/voice/MicButton.tsx | 麥克風按鈕元件 |
| 2 | src/components/voice/VoicePreviewPopover.tsx | 辨識預覽框 |
| 3 | src/components/voice/VoiceSettingsSection.tsx | Settings 語音區塊 |
| 4 | src/hooks/useVoiceRecording.ts | 錄音 hook |
| 5 | src/lib/voice/recording-service.ts | 錄音服務（16kHz WAV） |
| 6 | src/lib/voice/wav-encoder.ts | WAV 編碼器 |
| 7 | src/lib/voice/index.ts | voice lib 入口 |
| 8 | src/types/voice.ts | 語音型別定義 |
| 9 | electron/voice-handler.ts | 主程序語音 IPC handler |
| 10 | electron/voice-opencc.ts | OpenCC 繁簡轉換模組 |

### 語音相關（修改）— 10 個

| # | 路徑 | 變更內容 |
|---|------|----------|
| 1 | src/components/PromptBox.tsx | 整合 MicButton + popover |
| 2 | src/components/MainPanel.tsx | 語音元件 layout |
| 3 | src/components/SettingsPanel.tsx | 語音設定區塊 |
| 4 | src/types/electron.d.ts | 語音 IPC API 型別 |
| 5 | src/styles/prompt-box.css | MicButton + popover 樣式 |
| 6 | src/styles/settings.css | 語音設定樣式 |
| 7 | electron/main.ts | 語音 IPC 註冊 |
| 8 | electron/preload.ts | 語音 API bridge |
| 9 | package.json | whisper-node-addon + opencc-js 依賴 |
| 10 | README.md | 語音功能文檔 |

### Bug 修復（修改）— 6 個

| # | 路徑 | 修復 |
|---|------|------|
| 1 | src/components/TerminalPanel.tsx | BUG-001 paste + BUG-002 portal |
| 2 | src/components/FileTree.tsx | BUG-002 context menu portal |
| 3 | src/components/GitHubPanel.tsx | BUG-002 context menu portal |
| 4 | src/components/Sidebar.tsx | BUG-002 context menu portal |
| 5 | src/components/ClaudeAgentPanel.tsx | BUG-001 §3 死路徑清理 |
| 6 | electron/remote/protocol.ts | BUG-001 §3 死路徑清理 |

---

## 工單執行摘要

| 工單 | 名稱 | 狀態 |
|------|------|------|
| T0001 | 語音輸入技術研究 | DONE |
| T0002 | whisper-node-addon PoC | DONE |
| T0003 | RecordingService 錄音模組 | DONE |
| T0004 | whisper 辨識整合 | DONE |
| T0005 | OpenCC 繁簡轉換 | DONE |
| T0006 | MicButton + VoicePreview UI | DONE |
| T0007 | PromptBox 整合 | DONE |
| T0008 | Settings 語音管理 | DONE |
| T0009 | 模型下載管理 | DONE |
| T0010 | macOS 權限 + 跨平台 | DONE |
| T0011 | 整合測試與交付 | IN_PROGRESS |
| T0012 | context menu portal 修復 | DONE |
| BUG-001 | Claude OAuth paste 截斷 | DONE |
| BUG-002 | Context menu 位移 | DONE |

---

## 自動化驗證結果（§2）

| 項目 | 結果 |
|------|------|
| vite build（3 bundles） | ✅ PASS |
| BUG-001 死路徑 grep | ✅ 0 matches |
| BUG-002 createPortal 驗證 | ✅ 6/6 元件已修復 |
| 語音檔案存在性 | ✅ 10/10 |
| NSMicrophoneUsageDescription | ✅ 存在 |
| package.json 依賴 | ✅ whisper-node-addon + opencc-js |
| OpenCC 單元測試 | ✅ 3/3 通過 |
