# Tower State

## 基本資訊
- 專案：better-agent-terminal
- 建立時間：2026-04-10
- 上次同步：2026-04-11 02:28 (UTC+8) — *sync 執行,修正 T0005/T0008 元資料不一致
- **Session 狀態**:🌙 **已收工**(2026-04-11 02:30,明天繼續)
- 最大工單編號:T0012
- **🏁 Phase 1 狀態**:✅ **程式碼完成**(等待使用者執行手動測試)

---

## 🌅 明日起手式(Tomorrow's Starting Point)

> 給明天新塔台 session 啟動後的 Step 0 讀的快速恢復區

### 🎯 當前狀態一句話
Phase 1 語音輸入功能 12 張工單全部程式碼完成,等使用者執行手動測試(`_ct-workorders/reports/T0011-user-testing-guide.md` 的 32 項)。

### 📍 使用者的下一步(最重要)
1. 跑 `npm run dev` 啟動 Electron app
2. 打開 `_ct-workorders/reports/T0011-user-testing-guide.md`
3. 依 Part 1 → Part 7 順序執行 32 項手動測試
4. 發現 bug 回塔台開修正工單
5. 全部通過 → 告訴塔台「Phase 1 驗收通過」

### 🚦 明天開工時可能的情境分歧
- **情境 A**:使用者說「Phase 1 驗收通過」
  → 塔台記錄 D015 最終驗收,建議下一步方向(Phase 1.5 / 技術債 / Phase 2)
- **情境 B**:使用者說「Part X 測試 Y 失敗」
  → 塔台讀取對應的 user-testing-guide 項目,分類 bug,派發修正工單
- **情境 C**:使用者想直接跳到 Backlog 項目(例:256 tsc 錯誤清償 / Phase 1.5 Route B PoC)
  → 塔台先詢問 Phase 1 手動測試是否已完成,若未完成建議先驗收再進下一個里程碑

### 📂 重要文件位置(明天快速存取用)
- **使用者測試指引**:`_ct-workorders/reports/T0011-user-testing-guide.md`(32 項 / 7 Parts)
- **整合測試 checklist**:`_ct-workorders/reports/T0011-integration-test-checklist.md`(51 項 / 7 類別)
- **最終交付報告**:`_ct-workorders/reports/T0011-final-delivery-report.md`(Phase 1 總結)
- **T0001 技術評估**:`_ct-workorders/reports/T0001-voice-input-tech-research.md`(876 行)
- **T0002 PoC 報告**:`_ct-workorders/reports/T0002-whisper-node-addon-poc.md`
- **BUG-001 原始報修**:`_ct-workorders/BUG-001-claude-oauth-paste-truncated.md`
- **BUG-002 原始報修**:`_ct-workorders/BUG-002-context-menu-offset.md`

### ⚠️ 絕對不要忘記的事
1. **T0005 的 runtime 驗證延後了** — 雖然 T0011 有涵蓋,但若明天 Phase 1 驗收通過,記得 T0005 狀態可從 PARTIAL 升為 DONE
2. **BUG-001 / BUG-002 runtime 未驗證** — 兩個 bug 的修復目前只有 code-level 驗證,使用者實測才是真正的閘門
3. **`writeChunked >64KB` 極端情境**已記錄在 Backlog,不要再「發現」一次
4. **L001~L011 學習紀錄**未執行 /ct-evolve 晉升到 Global,明天適合時機可執行

### 🗣 塔台語氣校準
使用者偏好:
- **決策速度快**:常用「塔台你決定」,不喜歡被反覆問同一問題
- **務實路線**:選過 Option B 降級,偏好「先求有再求好」
- **接受延後**:T0005 PARTIAL、T0011 手動測試延後都接受
- **重視細節**:會主動回報 bug(BUG-001 自己做完根因分析)
- **不愛管多 session**:選過純序列路線(選項 1)
- **使用繁體中文**:所有回應都用繁中

### 📊 明天開工檢查清單(Step 0 之後執行)
- [ ] 讀取本段「明日起手式」
- [ ] 讀取 Sprint 進度表(最下方)確認 12 張工單狀態
- [ ] 讀取「待處理事項」的 T0011 runtime 驗證聚合清單
- [ ] 問使用者:「Phase 1 手動測試進度如何?有遇到問題嗎?」
- [ ] 依使用者回答進入情境 A / B / C

---

## 進度快照

### 當前任務
- **階段**：Phase 1 實作階段,T0005 已 PARTIAL(程式碼層交付完成),T0004 派發中
- **技術棧**:whisper-node-addon(file-based)+ OpenCC(繁簡轉換)+ RecordingService(16kHz WAV)
- **進行中工單**:T0004(PENDING — whisper 整合)
- **後續路線**:T0004 → T0006(預覽框)→ T0007+T0008 平行 → T0009(整合測試含所有 runtime 驗證)

### Sprint 進度

| 編號 | 任務 | 狀態 | 類型 | 前置 | 備註 |
|------|------|------|------|------|------|
| T0001 | 技術評估 | ✅ DONE | Research | - | 876 行報告 |
| T0002 | whisper-node-addon PoC | ✅ DONE (No-Go) | PoC | T0001 | 降級 Option B |
| T0003 | IPC 基礎設施 | ✅ DONE | Foundation | T0002 | 型別 + preload + mock handlers + RecordingService |
| T0004 | whisper 整合 + OpenCC + 模型下載 | ✅ DONE | Impl(main) | T0003 | 真實化 3 個 mock handlers,tiny 下載+繁中辨識 ✅ |
| T0005 | PromptBox UI + Alt+M + RecordingService 驗證 | ⚠️ PARTIAL | Impl(renderer) | T0003 | 程式碼 ✅,runtime 測試延後到 T0011 |
| T0006 | BUG-001 修復:TerminalPanel paste + §3 技術債清理 | ✅ DONE | Hotfix | - | 5 個檔案修改,grep 清零,runtime 延後 T0011 |
| T0007 | 預覽框 popover 元件 | ✅ DONE | Impl(renderer) | T0005 | 方案 A 定位,capture phase 鍵盤,錯誤雙重回饋 |
| T0008 | BUG-002 調研 + 修復:右鍵功能表位移 | ✅ DONE(3/4) | Investigate+Fix | - | 根因 CSS position:fixed + transform,Portal 修法 |
| T0009 | Settings 頁:模型管理 + 語言偏好 | ✅ DONE | Impl(renderer) | T0004 | SettingsPanel.tsx 整合,shell.openPath bonus |
| T0010 | macOS NSMicrophoneUsageDescription + 跨平台權限 | ✅ DONE | Config | T0003 | package.json extendInfo + README 文件 + §3 bonus 日誌 |
| T0012 | BUG-002 收尾:TerminalPanel context menu Portal 修復 | ✅ DONE | Hotfix | T0008 | 2 分鐘完成,BUG-002 100% 修復 |
| T0011 | 整合測試 + 最終交付報告 | ✅ DONE | QA + Delivery | 全部 | 3 份文件(checklist 51 項 + user guide 32 項 + final report) |
| T0010 | macOS NSMicrophoneUsageDescription + 跨平台權限(原 T0008) | 📋 TODO | Config | T0003 | 隨時可做 |
| T0011 | 整合測試 + 聚合所有延後 runtime 驗證(原 T0009) | 📋 TODO | QA | 全部 | **關鍵 runtime 閘門** |

### Backlog(延後)
- 📋 **技術債**:修復 256 個既有 tsc 錯誤(補齊 `ElectronAPI` interface)
- 📋 **技術債**:`writeChunked` >64KB 的 paste 仍走 `pty.write`,極端情境(>64KB 貼到 TUI)可能仍被截斷 — 來自 T0006 sub-session 發現,實際影響極低
- 📋 **Phase 1.5**:Route B PoC — 驗證 whisper.cpp binary 的 `--stream` + GPU 加速
- 📋 **Phase 1.5**:若 Route B PoC 通過,評估遷移成本
- 📋 **Phase 2**:claude-code terminal 語音輸入(xterm.js overlay UI 研究)
- 📋 **研究**:faster-whisper / sherpa-onnx 其他引擎評估

## 決策日誌(精簡)

- **D001**-D012:前置決策(見先前版本)
- **D013** 2026-04-11 00:02 — 技術債 Backlog + 派發 T0004/T0005 半平行
- **D014** 2026-04-11 00:38 — T0005 PARTIAL 接受,runtime 驗證延後到 T0009
  - **背景**:T0005 sub-session 在 CLI 環境無法執行 GUI 麥克風測試
  - **決策**:塔台你決定 → 路線 2(直接派 T0004,T0009 聚合 runtime 測試)
  - **理由**:
    - T0005 程式碼層全通過(build + 審查 + 檔案所有權)
    - T0004 獨立於 RecordingService,不被 T0005 runtime 狀態阻塞
    - T0009 一次測完整個鏈路比多次切換有效率
    - T0003 WAV 編碼器已單元測試通過,RecordingService 下層風險低
  - **風險**:若 RecordingService 最終發現 bug,需要修正工單,但影響範圍可控

## 學習紀錄

- **L001** - 不依賴訓練知識驗證產品技術底層(候選 global)
- **L002** - 小社群 npm 套件必須先 PoC 再承諾(候選 global)
- **L003** - 工單前置條件檔案路徑必須可驗證(project)
- **L004** - 研究工單對 WebFetch 權限要有備援(project)
- **L005** - 研究工單的「功能宣稱」必須在 PoC 中實測(候選 global)
- **L006** - Whisper 多語模型的繁簡中問題(候選 global)
- **L007** - vite build 通過 ≠ 型別正確(候選 global)
- **L008** - 平行工單必須明確檔案所有權邊界(project)
- **L009** - GUI/硬體工單在 headless sub-session 無法 runtime 驗證(候選 global,T0005 案例)

## 待處理事項

### 🐛 Bug Tracker

| ID | 標題 | 嚴重度 | 狀態 | 報修時間 | 檔案 |
|----|------|--------|------|---------|------|
| **BUG-001** | Claude OAuth 登入 paste 被截斷(應用終端內無法完成授權) | 🔴 High | 📨 已提交(等塔台分類) | 2026-04-11 00:25 | `_ct-workorders/BUG-001-claude-oauth-paste-truncated.md` |
| **BUG-002** | 右鍵功能表位置嚴重位移(除終端縮圖區外全部 UI) | 🟡 Medium | 📋 細節已收集(等 T0008 調研工單) | 2026-04-11 00:40 | `_ct-workorders/BUG-002-context-menu-offset.md` |

**BUG-001 摘要**:
- **影響**:阻斷新使用者首次完成 Claude Code 設定(100% 重現)
- **場景**:在 better-agent-terminal 跑 `claude /login` → 貼授權碼到 Ink TUI 時被截斷
- **與語音功能的關係**:完全無關,但同屬 Phase 1 必修項目
- **待塔台處理**:
  - [ ] 等 T0004 完成後,塔台讀取完整報修單並分類
  - [ ] 評估根本原因方向(PTY data 處理?Ink TUI 相容性?paste bracket mode?)
  - [ ] 決定是否插入 hotfix 工單,或納入 Phase 1 收尾前的固定排程
  - [ ] 可能需要派發一張調研工單先釐清根本原因,再開修復工單

**BUG-002 摘要**:
- **症狀**:除了終端縮圖區(已修復正常),其餘有右鍵功能表的 UI 位置都**嚴重位移**
- **線索**:終端縮圖區**曾修過**並正常運作 → 修復方式可作為其他位置的參考範本
- **推測方向**(待調研確認):
  - Context menu 定位計算未考慮 scroll offset?
  - CSS transform(zoom / scale / translate)影響 `getBoundingClientRect`?
  - 父容器使用 `position: fixed` 或 `overflow: hidden` 裁切?
  - Window DPI scaling(Windows 125%/150% 縮放)?
  - Portal 或 teleport 元件的 container 錯誤?
- **使用者未提供**(待補充):
  - [ ] 具體有哪些 UI 區塊會出現(檔案列表 / Git 面板 / 工作區樹 / Tab bar / Terminal 區?)
  - [ ] 位移方向與距離(偏左上 / 偏右下 / 完全錯誤?)
  - [ ] 是否需要特定觸發條件(特定視窗大小、特定 DPI、特定動作後)
  - [ ] 終端縮圖區是如何修的(commit hash / 修復方式) — 這是最關鍵的線索
- **與語音功能的關係**:無關
- **待塔台處理**:
  - [ ] 塔台需要派發**調研工單**,先找出終端縮圖區當初的修復方式(git log / commit 記錄)
  - [ ] 依調研結果決定修復範圍(一次修全部 vs 一個區塊一張工單)
  - [ ] 嚴重度評估:雖然是 Medium,但「有右鍵功能表的地方都有問題」範圍廣,實際體驗可能更差

### 【延後到 T0009 的 runtime 驗證項目】

**來自 T0005(UI/麥克風)**:
- [ ] 正常錄音 3~5 秒 → 文字 append
- [ ] 連續兩次錄音(state reset)
- [ ] 錄音中 Alt+M 停止
- [ ] 模型未下載時按按鈕(disabled + tooltip)
- [ ] 拒絕麥克風權限(明確錯誤訊息)
- [ ] 極短錄音 <0.5s
- [ ] 切 terminal 後回來(isActive prop 行為)
- [ ] PromptBox 既有功能 runtime 回歸(slash command / image paste / command history / 送出按鈕)

**來自 T0004**(部分已在 sub-session 內完成):
- [x] 真實 whisper 辨識繁中樣本(jfk-zh.wav 7 秒 ✅)
- [x] 英文/中英混合辨識(mixed-62s.wav ~24 秒 ✅)
- [x] OpenCC 繁簡轉換(已通過 code-level + 樣本測試)
- [x] 模型下載進度事件(tiny 77.7 MB 3 次事件 ✅)
- [x] 下載中止(AbortController 實作)
- [ ] T0011 需重測:Electron GUI runtime 情境(真實麥克風 → IPC → whisper)

**來自 T0006(BUG-001 修復)**:
- [ ] 貼 shell 指令到 bash/pwsh(bracketed paste 不啟用時正常)
- [ ] 貼到 vim/nano(bracketed paste 啟用時帶 markers)
- [ ] **claude /login 完整授權流程**(最關鍵,確認 BUG-001 真的修好)
- [ ] 回歸測試:ClaudeAgentPanel 打 `/login` 變成對話內容而非被攔截
- [ ] 回歸測試:`/logout` 和 `/whoami` 仍然正常(因為沒碰)

**來自 T0009(Settings 頁)**:
- [ ] 開啟 Settings 頁 → 顯示「🎤 語音輸入」section
- [ ] 模型列表正確載入 4 個模型,顯示對應下載狀態
- [ ] 點 tiny 下載 → 進度條正確更新 → 完成後狀態變已下載
- [ ] 點 tiny 刪除 → confirm → 刪除 → 狀態更新為未下載
- [ ] 點取消下載 → 中斷 + 進度條消失 + `.downloading` 暫存檔清理
- [ ] 切換預設模型 → 偏好儲存,重開 Settings 顯示為當前預設
- [ ] 未下載的模型 radio disabled + tooltip
- [ ] 切換語言偏好(zh → en → auto → zh)→ 偏好儲存
- [ ] 切換繁簡開關 → 偏好儲存
- [ ] 「開啟資料夾」按鈕(若有實作)→ 系統檔案總管開啟 whisper-models 目錄
- [ ] 同時下載 small 和 medium(並行)→ 兩個進度條都正確更新

**來自 T0010(macOS 權限)**:
- [ ] 打包為 `.dmg` / `.app` 後能正常啟動(有 NSMicrophoneUsageDescription)
- [ ] macOS 10.14+ 首次使用 getUserMedia 彈系統權限對話框
- [ ] 權限對話框顯示的字串是 package.json 裡設定的那段
- [ ] 使用者允許後,後續使用無 prompt
- [ ] 使用者拒絕後,麥克風按鈕顯示明確錯誤 + 提示去 System Preferences
- [ ] debug.log 有 `[voice] macOS microphone permission status:` 日誌行

**來自 T0007(預覽框 popover)**:
- [ ] 錄音 → 停止 → popover 自動顯示 loading
- [ ] 辨識完成 → popover 顯示結果文字
- [ ] 預覽框內編輯文字後按 ✓ 確認 → 編輯後的文字填入 textarea
- [ ] 預覽框內按 ✗ 取消 → 文字丟棄,popover 消失
- [ ] Enter 確認快捷鍵(capture phase 優先於 PromptBox 送出)
- [ ] Esc 取消快捷鍵(capture phase 優先於 PromptBox 清空)
- [ ] Shift+Enter 在預覽框 textarea 換行(不觸發確認)
- [ ] 錯誤狀態 popover 正確顯示(例:模擬 whisper 失敗)
- [ ] popover 位置正確(CSS 相對定位,應該穩定)
- [ ] 連續兩次錄音 → 預覽框狀態正確 reset

**預期新增(T0006/T0007/T0008 預計)**:
- 等工單完成後補齊

### 【塔台待辦】等 T0004 完成後
- [ ] 派發 T0006(預覽框 popover)
- [ ] 派發 T0007(Settings)+ T0008(權限)
- [ ] 下次 `/ct-evolve` 時將 L001/L002/L005/L006/L007/L009 候選晉升為 Global

### 【使用者待回應】
- 無 — T0004 派發中,等執行

## 需求對齊紀錄(最終版)

| # | 項目 | 決策 |
|---|------|------|
| Q1 | 引擎 | whisper.cpp + small 模型 |
| Q2 | 語言 | 繁中為主 + 英文,多語自動偵測 + 手動切換 |
| Q3 | UI 觸發 | 麥克風按鈕 + Alt+M 並存 |
| Q4 | 結果呈現 | 預覽框(Phase 1 降級:錄完→loading→完整結果) |
| Q5 | 範圍 | Phase 1 Agent terminal / Phase 2 claude-code |
| Q6 | 按鈕模式 | toggle |
| Q7 | 模型大小 | 可選,預設 small |
| Q8 | 下載策略 | Settings 手動下載 |

## §G 8 題決策

| # | 決策 |
|---|------|
| Q1 包體積 | 沒限制,好用最重要 |
| Q2 CI 編譯 | GitHub Actions cache 優化 |
| Q3 GPU(Phase 1 降級) | Phase 1 CPU-only,Phase 1.5 補 |
| Q4 模型預載 | Settings 手動下載 |
| Q5 PoC | ✅ 已做(T0002) |
| Q6 音訊傳輸 | PCM 直傳 IPC |
| Q7 品質驗證 | small 預設,不滿意再切 |
| Q8 語言偵測 | 預設繁中,可手動切 |
