# 工單 T0011-integration-test-and-delivery

## 元資料
- **工單編號**：T0011
- **任務名稱**：語音輸入功能整合測試 + BUG-001/BUG-002 修復驗證 + 最終交付報告
- **狀態**：DONE
- **類型**：QA + DELIVERY(測試聚合 + 使用者手冊 + 專案交付)
- **建立時間**：2026-04-11 02:15 (UTC+8)
- **開始時間**：2026-04-11 02:12 (UTC+8)
- **完成時間**：2026-04-11 02:22（UTC+8）
- **前置工單**:T0001~T0010、T0012(全部完成)

## 工作量預估
- **預估規模**:中~大(聚合多個工單的延後測試項目 + 產出完整文件)
- **Context Window 風險**:中(需讀多個工單回報、產出結構化文件)
- **降級策略**:若 Context Window 不足,優先完成 §1(聚合 checklist)+ §2(自動化驗證),§3(手動測試指引)與 §4(最終報告)可縮減篇幅

## Session 建議
- **建議類型**:🆕 新 Session
- **原因**:fresh context 讀取所有前置工單回報 + 產出文件

## 特殊性

本工單是**整個語音功能專案的最後一張**。與其他工單不同:
- 幾乎不寫新程式碼(只寫測試腳本和文件)
- 大部分是**聚合、驗證、交付**
- 最終產出是**給使用者執行**的測試指引,不是給 sub-session 執行
- 包含**最終交付報告**,是這個 Phase 1 的收尾

---

## 任務指令

### 任務定位

三個目標:
1. **聚合**所有延後到本工單的 runtime 驗證項目,產出結構化 checklist
2. **驗證**能在 headless 環境做的項目(靜態分析、單元測試、config 檢查)
3. **交付**給使用者一份完整的「如何測試與使用語音輸入功能」文件 + 最終報告

---

### 前置條件

**必讀的前置工單回報**(順序不重要,全部都要讀回報區):
- `_ct-workorders/T0001-voice-input-tech-research.md`
- `_ct-workorders/T0002-whisper-node-addon-poc.md`
- `_ct-workorders/T0003-voice-ipc-foundation.md`
- `_ct-workorders/T0004-whisper-integration.md`
- `_ct-workorders/T0005-promptbox-voice-ui.md`
- `_ct-workorders/T0006-fix-paste-bracketed.md`
- `_ct-workorders/T0007-voice-preview-popover.md`
- `_ct-workorders/T0008-fix-context-menu-offset.md`
- `_ct-workorders/T0009-voice-settings-page.md`
- `_ct-workorders/T0010-macos-mic-permission.md`
- `_ct-workorders/T0012-terminal-panel-context-menu.md`

**必讀的塔台狀態**:
- `_ct-workorders/_tower-state.md`(特別是「延後到 T0011 的 runtime 驗證項目」段落)
- `_ct-workorders/_learnings.md`(了解整個專案的教訓)

**必讀的 Bug 報修**:
- `_ct-workorders/BUG-001-claude-oauth-paste-truncated.md`
- `_ct-workorders/BUG-002-context-menu-offset.md`

**必讀的設計文件**:
- `_ct-workorders/reports/T0001-voice-input-tech-research.md`(完整技術評估報告)
- `_ct-workorders/reports/T0002-whisper-node-addon-poc.md`(PoC 結論)

---

### 輸入上下文

### 專案概況

本專案在 better-agent-terminal 加入 **Electron 離線語音輸入功能**,採用 `whisper.cpp` 引擎(透過 `whisper-node-addon`)+ OpenCC 繁簡轉換。核心體驗:

```
使用者點麥克風按鈕(或 Alt+M)→ 錄音 → 再點停止
→ 浮動 popover 顯示「辨識中...」loading
→ whisper 辨識完成 → popover 顯示繁中結果(可編輯)
→ 使用者按 Enter 或點 ✓ → 文字填入 PromptBox textarea
→ 使用者按送出發訊息
```

**附帶修復的兩個 bug**:
- BUG-001: Claude OAuth login paste 被截斷 → 修復 xterm.js bracketed paste bypass
- BUG-002: 右鍵功能表位置嚴重位移 → 修復 `position: fixed` + CSS transform 祖先容器的互動(用 React Portal 解)

### 技術決策摘要(供文件撰寫參考)

| 決策點 | 選擇 |
|--------|------|
| 引擎 | whisper.cpp 本地模型(MIT 授權,離線) |
| 整合 | whisper-node-addon N-API binding(T0002 PoC 驗證) |
| 降級 | Phase 1 無串流、無 GPU(Option B) |
| 模型 | 預設 small(466 MB),使用者可選 tiny/base/small/medium |
| 語言 | 預設 zh,可切 en/auto |
| 繁簡 | OpenCC s2t 預設 ON |
| 快捷鍵 | Alt+M(toggle mode) |
| UX | 預覽框確認模式(不自動送出) |
| 下載 | Settings 頁手動下載 |
| 儲存 | `{userData}/whisper-models/` |

---

### 工作範圍

#### §1 — 聚合所有延後的 Runtime 驗證項目

**目標**:產出結構化的測試 checklist,分門別類列出所有需要手動驗證的項目。

**步驟**:

1. 讀取 `_tower-state.md` 的「延後到 T0011 的 runtime 驗證項目」段落
2. 補充讀取每個前置工單回報區的「給 T0011 的備註」
3. **分類整理**成以下六大類:
   - **A. 語音錄音與 RecordingService**(來自 T0005)
   - **B. Whisper 辨識與 OpenCC**(來自 T0004,部分已自動化驗證)
   - **C. 預覽框 Popover 流程**(來自 T0007)
   - **D. Settings 頁模型管理**(來自 T0009)
   - **E. 跨平台與 macOS 權限**(來自 T0010)
   - **F. BUG-001 修復驗證**(來自 T0006)
   - **G. BUG-002 修復驗證**(來自 T0008 + T0012)

4. 每一項目的格式:
   ```markdown
   - [ ] **測試 X.Y**: <簡短描述>
     - **步驟**:1. ... 2. ... 3. ...
     - **預期**:<明確的預期結果>
     - **失敗條件**:<什麼情況算失敗>
     - **相關工單**:T00##
   ```

5. 輸出檔案:`_ct-workorders/reports/T0011-integration-test-checklist.md`

**驗收**:
- [ ] 至少 35 個測試項目(七大類合計)
- [ ] 每項目都有步驟、預期、失敗條件
- [ ] 每項目標註相關工單,方便追溯
- [ ] 按邏輯順序排列(先基礎功能,再進階場景,最後邊緣情況)

---

#### §2 — 自動化驗證(Sub-session 能做的)

**目標**:在 headless 環境執行能做的驗證,減輕使用者手動測試的負擔。

**§2.1 Static Analysis**:

執行以下靜態檢查,回報結果到本工單回報區:

```bash
# 1. Build 全通過
npx vite build

# 2. 確認 BUG-001 修復:
grep -rn "claude:auth-login\|claude\.authLogin" src/ electron/
# 預期:無結果

# 3. 確認 BUG-002 修復:所有 context menu 都用 createPortal
grep -rn "className=\"context-menu\"\|className={`context-menu\|className='context-menu" src/components/
# 逐一檢查每個出現點是否在 createPortal 內

# 4. 確認語音相關檔案存在
ls -la src/components/voice/
ls -la src/hooks/useVoiceRecording.ts
ls -la src/lib/voice/
ls -la electron/voice-handler.ts
ls -la electron/voice-opencc.ts
ls -la src/types/voice.ts

# 5. 確認 package.json 有 NSMicrophoneUsageDescription
grep -A1 "NSMicrophoneUsageDescription" package.json

# 6. 確認 whisper-node-addon 和 opencc-js 已裝
grep -E "whisper-node-addon|opencc-js" package.json
```

**§2.2 模型下載驗證**:

如果時間允許且環境可用,執行 **tiny 模型下載測試**(獨立腳本,不干擾專案):

1. 執行類似 T0004 §4 的端到端腳本(若還存在)
2. 確認 `{userData}/whisper-models/ggml-tiny.bin` 可成功下載
3. 確認辨識一段測試音訊(PoC 的 jfk-zh.wav)產出正確繁中結果

**注意**:如果 sub-session 是 Claude Code CLI 環境,Electron runtime 仍無法跑;改為 Node.js 直接呼叫 whisper-node-addon 驗證模型下載和辨識,不需要 Electron。

**§2.3 OpenCC 單元驗證**:

撰寫簡短 Node.js 腳本驗證 OpenCC:
```javascript
// 直接測試 opencc-js
const OpenCC = require('opencc-js');
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
console.log(converter('你好世界')); // 預期:你好世界(相同字)
console.log(converter('简体中文转换测试')); // 預期:簡體中文轉換測試
console.log(converter('帮我创建一个 agent terminal')); // 預期:幫我創建一個 agent terminal
```

**驗收**:
- [ ] §2.1 所有 grep 結果符合預期
- [ ] §2.1 所有檔案存在
- [ ] §2.1 package.json 配置正確
- [ ] §2.2(可選)tiny 模型下載成功 + 辨識測試通過
- [ ] §2.3 OpenCC 轉換結果正確

---

#### §3 — 使用者手動測試指引

**目標**:產出一份**給使用者看**的測試手冊,能讓使用者按步驟完成整合測試。

**輸出檔案**:`_ct-workorders/reports/T0011-user-testing-guide.md`

**結構建議**:

```markdown
# 語音輸入功能 — 使用者測試指引

## 開始前準備

### 環境需求
- Windows 10/11(本次主要測試環境)
- macOS 10.14+(選擇性測試)
- Linux(選擇性測試)
- 可用麥克風
- 網路連線(用於首次下載模型)

### 啟動 app
1. cd 到專案目錄
2. 執行 `npm run dev`(或專案實際啟動指令)
3. Electron app 啟動

---

## Part 1:初次設定(必測)

### 1.1 下載語音模型
1. 開啟 Settings 頁(按鈕位置:...)
2. 找到「🎤 語音輸入」區塊
3. 查看 4 個模型列表
4. 點「Small(推薦)」旁的「下載」按鈕
5. 觀察進度條,等待 ~3 分鐘(466 MB,視網速)
6. **預期**:下載完成後「Small」狀態變為「已下載」

### 1.2 確認預設設定
1. 預設模型應為「Small」
2. 預設語言應為「繁中」
3. 「自動轉繁體」開關應為 ON

### 1.3 首次使用麥克風權限
1. 回到 agent terminal
2. 點 PromptBox 的麥克風按鈕
3. **Windows**:Chromium 層權限對話框出現 → 允許
4. **macOS**:系統權限對話框出現(顯示 package.json 設定的字串)→ 允許
5. **Linux**:通常無 prompt
6. **預期**:按鈕變紅色 + pulse 動畫

---

## Part 2:核心語音流程(必測)

### 2.1 基本錄音與辨識
1. 點麥克風按鈕開始錄音
2. 說話 3~5 秒:「你好,這是一個測試」
3. 再點按鈕停止
4. 觀察預覽框 popover 從 MicButton 上方出現
5. 看到「辨識中...」loading
6. 等待 1~3 秒
7. **預期**:popover 顯示辨識結果(繁中)
8. 按 Enter 或點 ✓ 確認
9. **預期**:文字填入 textarea,popover 消失
10. 按送出

...(其餘測試項目)
```

**需要涵蓋的測試情境**(至少):

- **Part 1 初次設定**(3 個測試)
- **Part 2 核心語音流程**(6 個測試):基本錄音、Alt+M、連續錄音、取消、錯誤處理、編輯辨識結果
- **Part 3 Settings 頁面**(5 個測試):模型切換、下載、取消下載、刪除、語言切換
- **Part 4 BUG-001 驗證**(3 個測試):shell 貼上、vim/nano 貼上、claude /login 完整流程
- **Part 5 BUG-002 驗證**(4 個測試):FileTree 右鍵、Sidebar 右鍵、TerminalPanel 右鍵、Settings 區塊右鍵
- **Part 6 跨平台**(3 個測試):Windows 150% DPI、Windows 100% DPI、macOS(若有)
- **Part 7 邊界情境**(3~5 個測試):極短錄音、極長錄音、無網路(不影響離線辨識)、模型切換時錄音、拒絕麥克風權限

每個測試有「步驟 / 預期 / 若失敗怎麼辦」。

**驗收**:
- [ ] 至少 7 個 Part
- [ ] 總測試數 ≥ 27
- [ ] 使用者可以**不看程式碼**就能依指引完成測試
- [ ] 每個測試有「若失敗如何回報」的說明

---

#### §4 — 最終交付報告

**目標**:給使用者(和未來的 tower session)一份**完整的 Phase 1 總結**,記錄成果、已知限制、Backlog、下一步建議。

**輸出檔案**:`_ct-workorders/reports/T0011-final-delivery-report.md`

**結構建議**:

```markdown
# Phase 1 最終交付報告 — 語音輸入功能

## 專案概況

- **啟動時間**:2026-04-10 22:23(需求對齊)
- **完成時間**:2026-04-11 XX:XX
- **工單總數**:12 張(T0001 ~ T0012)
- **Bug 修復**:2 個(BUG-001、BUG-002)
- **新增學習紀錄**:11 條(L001 ~ L011)

## 完成的功能

### 語音輸入核心
- ✅ 麥克風按鈕 + Alt+M 快捷鍵(toggle mode)
- ✅ 錄音中視覺回饋(紅色 + pulse 動畫)
- ✅ whisper.cpp 離線辨識(small 模型預設)
- ✅ OpenCC 繁簡轉換(自動 s2t)
- ✅ 預覽框確認流程(可編輯,不自動送出)
- ✅ Enter 確認 / Esc 取消快捷鍵

### 模型管理
- ✅ Settings 頁「🎤 語音輸入」區塊
- ✅ 4 模型支援(tiny/base/small/medium)
- ✅ HuggingFace 下載(含進度、取消)
- ✅ 偏好持久化(模型 / 語言 / 繁簡)
- ✅ 「開啟資料夾」按鈕(bonus)

### 跨平台
- ✅ macOS Info.plist 配置
- ✅ 跨平台權限說明文件

### Bug 修復
- ✅ BUG-001: Claude OAuth login paste 修復(bracketed paste 支援)
- ✅ BUG-001 §3: 死路徑清理(claude:auth-login handler 移除)
- ✅ BUG-002: 所有 context menu 改用 React Portal

## Phase 1 的降級與取捨

- ⚠️ **無即時串流**:whisper-node-addon 不支援 PCM streaming,改為 loading → 完整結果
- ⚠️ **無 GPU 加速**:prebuilt binary 是 CPU-only,Phase 1.5 可評估 Route B 補強
- ⚠️ **TerminalThumbnail 外的 context menu 修復延後**:已在 T0008+T0012 補齊

## 已知限制 / Backlog

- 📋 **技術債**:256 個既有 tsc 錯誤(ElectronAPI interface 落後,獨立工單處理)
- 📋 **技術債**:`writeChunked >64KB` 仍走 pty.write(極罕見情境)
- 📋 **Phase 1.5**:Route B PoC(whisper.cpp binary + child_process,補串流 + GPU)
- 📋 **Phase 2**:claude-code terminal 語音輸入(xterm.js overlay UI)
- 📋 **研究**:其他引擎評估(faster-whisper / sherpa-onnx)

## 學習記錄亮點(L001~L011)

- **L001** - 不依賴訓練知識驗證產品技術底層(VSCode ≠ Whisper 的教訓)
- **L002** - 小社群 npm 套件必須先 PoC(whisper-node-addon 14 stars 的驗證)
- **L005** - 研究工單宣稱 ≠ PoC 實測
- **L007** - vite build 通過 ≠ 型別正確(tsc --noEmit 才是)
- **L011** - CSS position:fixed 在 transformed 祖先內失效

## 下一步建議

1. **立即**:使用者依 `T0011-user-testing-guide.md` 執行手動測試
2. **短期**:若測試發現 bug,開修正工單(不影響其他工單)
3. **中期**:處理 Backlog 中的技術債(256 tsc 錯誤、writeChunked)
4. **長期**:Phase 1.5 Route B PoC + Phase 2 claude-code terminal 整合

## 檔案清單

### 語音相關(新增)
- src/components/voice/MicButton.tsx
- src/components/voice/VoicePreviewPopover.tsx
- src/components/voice/VoiceSettingsSection.tsx
- src/hooks/useVoiceRecording.ts
- src/lib/voice/recording-service.ts
- src/lib/voice/wav-encoder.ts
- src/lib/voice/index.ts
- src/types/voice.ts
- electron/voice-handler.ts
- electron/voice-opencc.ts

### 語音相關(修改)
- src/components/PromptBox.tsx
- src/components/MainPanel.tsx
- src/components/SettingsPanel.tsx
- src/types/electron.d.ts
- src/styles/prompt-box.css
- src/styles/settings.css
- electron/main.ts
- electron/preload.ts
- package.json
- README.md

### Bug 修復(修改)
- src/components/TerminalPanel.tsx(BUG-001 + BUG-002)
- src/components/FileTree.tsx(BUG-002)
- src/components/GitHubPanel.tsx(BUG-002)
- src/components/Sidebar.tsx(BUG-002)
- src/components/ClaudeAgentPanel.tsx(BUG-001 §3 清理)
- electron/remote/protocol.ts(BUG-001 §3 清理)
```

**驗收**:
- [ ] 涵蓋上述所有段落
- [ ] 數字準確(從實際檔案讀取,不用估算)
- [ ] 檔案清單完整
- [ ] Backlog 列出所有延後項目
- [ ] 使用者可以用這份報告理解整個 Phase 1 的成果

---

### 不在本工單範圍

- ❌ 不修任何新 bug(若發現,記錄到報告的「下一步建議」段落,開新工單)
- ❌ 不重構任何現有程式碼
- ❌ 不變更 Backlog 的項目狀態
- ❌ 不新增 npm 依賴
- ❌ 不修 256 個既有 tsc 錯誤(Backlog)

---

### 驗收條件

- [ ] **§1 checklist 產出**:`_ct-workorders/reports/T0011-integration-test-checklist.md` 存在且結構完整
- [ ] **§1 檢驗項目**:≥ 35 個
- [ ] **§2.1 靜態分析**:全通過,結果寫入回報區
- [ ] **§2.2 模型下載**(可選):通過 或 明確標註無法執行
- [ ] **§2.3 OpenCC 單元**:3 個字串測試通過
- [ ] **§3 使用者指引**:`_ct-workorders/reports/T0011-user-testing-guide.md` 存在
- [ ] **§3 測試數量**:≥ 27 個,分 7 個 Part
- [ ] **§4 最終報告**:`_ct-workorders/reports/T0011-final-delivery-report.md` 存在
- [ ] **§4 數字準確**:檔案清單、工單數、學習紀錄數都從實際檔案計算
- [ ] **Build 驗證**:`npx vite build` 通過
- [ ] **No Regression**:未動任何語音功能或 bug 修復程式碼

---

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。

### 執行步驟

1. 讀取本工單全部內容
2. 依序讀取所有前置工單回報區 + 塔台狀態 + bug 檔案 + learnings
3. 更新「開始時間」
4. **§1 → §2 → §3 → §4** 順序執行
5. 每個 § 產出對應文件
6. `npx vite build` 最終驗證
7. 填寫本工單回報區

### 執行注意事項

- **本工單是交付工單**,產出品質影響使用者對整個 Phase 1 的印象
- **不要發明數據**,所有數字從實際檔案讀取或前置工單回報取得
- **使用者指引要能獨立閱讀**,不要假設讀者看過所有工單
- **headless 環境**:§2.2 模型下載測試可能無法執行(需要 Electron 或直接 Node + native addon),**不要硬做**,明確標註無法執行
- **專業語氣**:最終報告是給使用者的正式文件,語氣要清楚、專業、不浮誇
- **遇到發現新 bug**:記錄到「下一步建議」,不要嘗試在本工單內修

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**新增文件**:
- `_ct-workorders/reports/T0011-integration-test-checklist.md` — §1 整合測試 checklist
- `_ct-workorders/reports/T0011-user-testing-guide.md` — §3 使用者測試指引
- `_ct-workorders/reports/T0011-final-delivery-report.md` — §4 最終交付報告

**測試項目總數**:
- §1 Integration Test Checklist：51 項（7 類別 A~G）
- §3 User Testing Guide：32 項（7 Parts）

### 互動紀錄
無（全程無需使用者互動決策）

### 遭遇問題
無

### §2.1 靜態分析結果

**Build 驗證**：✅ PASS — `npx vite build` 3 bundles 全數通過（renderer 2127 modules 8.89s, main 28 modules 1.11s, preload 1 module 22ms）

**Grep 結果**:
- `claude:auth-login`：✅ 0 matches（src/ + electron/）
- `claude.authLogin`：✅ 0 matches（src/ + electron/）
- `className="context-menu"` + createPortal：✅ 6/6 元件已使用 createPortal（WorkspaceView, TerminalPanel, TerminalThumbnail, FileTree, Sidebar, GitHubPanel）

**檔案存在性**：✅ 10/10 語音相關新增檔案全部存在

**package.json 配置**：✅ NSMicrophoneUsageDescription（L124）、whisper-node-addon ^1.0.2（L46）、opencc-js ^1.0.5（L40）

### §2.2 模型下載驗證

跳過 — headless CLI 環境無 Electron runtime，無法執行模型下載 UI 流程。已列入 §3 使用者測試指引（測試 1.1）由使用者手動驗證。

### §2.3 OpenCC 單元測試

✅ 3/3 通過：
- `你好世界` → `你好世界`（已是繁體，無變化）
- `简体中文转换测试` → `簡體中文轉換測試`
- `帮我创建一个 agent terminal` → `幫我創建一個 agent terminal`

### §3 使用者指引的 Part 數與測試數
- 7 Parts：初次設定(3) / 核心語音(6) / Settings(5) / BUG-001(3) / BUG-002(4) / 跨平台(3) / 邊界情境(8)
- 合計 32 項（≥27 ✅）

### §4 最終報告的檔案清單長度
- 新增檔案：10 個
- 修改檔案（語音）：10 個
- 修改檔案（Bug 修復）：6 個
- 合計 26 個檔案

### 專案整體健康度評估

Phase 1 語音輸入功能完整交付。核心架構穩健：renderer 錄音 → IPC → main 辨識 → OpenCC 轉換 → 預覽確認的流水線清晰分離。已知技術債（256 tsc 錯誤）為既有問題，不影響語音功能。兩個 Bug 修復（paste bracketed mode + context menu portal）提升了整體 UX 品質。建議下一步先由使用者完成 32 項手動測試，確認無 runtime 問題後再進入 Phase 1.5（Route B PoC）。

### 發現的新問題 / Backlog 新增項目
無新增。既有 Backlog 項目維持不變（詳見 §4 報告）。

### sprint-status.yaml 已更新
不適用（專案無此檔案）

### 回報時間
2026-04-11 02:22（UTC+8）
