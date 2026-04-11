# Tower State

## 基本資訊
- 專案：better-agent-terminal
- 建立時間：2026-04-10
- 上次同步:2026-04-11 09:55 (UTC+8) — Phase 1 驗收第一個 bug,派發 T0013 hotfix
- **Session 狀態**:🔥 **Phase 1 驗收中 — BUG-003 hotfix 派發**(T0013 等 sub-session 執行)
- 最大工單編號:T0013
- **🏁 Phase 1 狀態**:⚠️ **驗收受阻** — `voice:downloadModel` IPC handler 未註冊,T0013 修復中

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
| T0013 | Hotfix — `voice:downloadModel` IPC handler 未註冊 | ⚠️ PARTIAL | Hotfix | - | copilot 修完(新增 voice-ipc.ts 單一常數 + 移註冊時機),GUI runtime 驗證待使用者接手 |
| T0011 | 整合測試 + 最終交付報告 | ✅ DONE | QA + Delivery | 全部 | 3 份文件(checklist 51 項 + user guide 32 項 + final report) |
| T0010 | macOS NSMicrophoneUsageDescription + 跨平台權限(原 T0008) | 📋 TODO | Config | T0003 | 隨時可做 |
| T0011 | 整合測試 + 聚合所有延後 runtime 驗證(原 T0009) | 📋 TODO | QA | 全部 | **關鍵 runtime 閘門** |

### Backlog(延後)
- 📋 **技術債**:修復 256 個既有 tsc 錯誤(補齊 `ElectronAPI` interface)
- 📋 **技術債**:`writeChunked` >64KB 的 paste 仍走 `pty.write`,極端情境(>64KB 貼到 TUI)可能仍被截斷 — 來自 T0006 sub-session 發現,實際影響極低
- 📋 **研究(待決策)**:**BAT ↔ AI Agent Orchestration 整合** — 讓 BAT 成為 auto-session 雙向自動化閉環的編排平台,支援任意 AI agent
  - **文件**:`_ct-workorders/reports/bat-agent-orchestration-research.md`(完整技術方案 + 決策矩陣 + 風險評估)
  - **核心提案**:OSC Escape Sequence 下行 + 工單檔案監聽上行,agent-agnostic
  - **關鍵發現**:BAT 已有 `supervisor:send-to-worker` IPC,若是寫 PTY stdin 實作則上行機制 70% 免費
  - **關鍵疑慮**:`supervisor:send-to-worker` 實作未驗證(疑慮 1,Critical),動工前必須 grep 確認
  - **決策點**:8 題決策矩陣(D1-D8)等使用者 review
  - **預計工單**:T0014(BAT 端)+ T0015(塔台端),Phase 1 MVP 1-2 天
  - **產品定位價值**:可能成為 BAT 的殺手級差異化功能(AI-friendly terminal for multi-agent orchestration)
  - **狀態**:📋 研究完成,等使用者 review 後產生工單
- 📋 **Phase 1.5**:Route B PoC — 驗證 whisper.cpp binary 的 `--stream` + GPU 加速
- 📋 **Phase 1.5**:若 Route B PoC 通過,評估遷移成本
- 📋 **Phase 2**:claude-code terminal 語音輸入(xterm.js overlay UI 研究)
- 📋 **研究**:faster-whisper / sherpa-onnx 其他引擎評估

## 決策日誌(精簡)

- **D001**-D012:前置決策(見先前版本)
- **D013** 2026-04-11 00:02 — 技術債 Backlog + 派發 T0004/T0005 半平行
- **D017** 2026-04-11 10:25 — BAT agent orchestration 研究記入 Backlog(待決策)
  - **背景**:使用者要求 auto-session 能整合 BAT 做雙向自動化閉環,且支援所有 AI agent(不限 Claude Code)
  - **成果**:產出完整技術文件 `reports/bat-agent-orchestration-research.md`,包含 13 章節 + 8 題決策矩陣 + 風險評估
  - **核心架構**:OSC 下行(開新 tab + inject cmd)+ File Watch 上行(監聽工單回報區)
  - **Agent-agnostic 關鍵**:上行機制用「監聽工單檔案被填寫」取代「agent 主動 notify」,因為無法假設所有 agent 配合
  - **決策**:暫不產生工單,先記入 Backlog,等使用者 review 完技術文件再決定 D1-D8
  - **相依驗證**:`supervisor:send-to-worker` 的實作必須在 T0014 開工前驗證(疑慮 1,Critical)
- **D016** 2026-04-11 10:18 — T0013 PARTIAL 接受,runtime 驗證延後
  - **背景**:copilot 在 5 分鐘內完成 code 修復,根因比預期更深(不只是命名不一致,是**註冊時機太早** — `registerVoiceHandlers` 在 module init 就被呼叫,但依賴 `session.defaultSession` 這個 app 還沒 ready 的資源)
  - **修復**:新增 `src/types/voice-ipc.ts` 作為 `VOICE_IPC_CHANNELS` 單一常數來源(renderer/main 共用),並把 `registerVoiceHandlers` 從 `registerLocalHandlers()` 移到 `app.whenReady()` 後
  - **驗證**:`npx vite build` ✅ + `npm run dev` 啟動時可見 `[voice] IPC handlers registered` ✅,但 GUI 點擊(Tiny 下載按鈕、進度事件)需使用者接手
  - **決策**:接受 PARTIAL,使用者執行 runtime 驗證後再升 DONE
  - **學習候選**(L012):**IPC handler 註冊的時序敏感性** — 依賴 `session.defaultSession` 等 Electron 資源的 handler 必須掛在 `app.whenReady()` 後,不能在 module init 階段執行。這補足了 L007(build ≠ 型別正確)+ L008(檔案所有權),三者合成「跨工單 IPC 交付的完整陷阱清單」
  - **跨 agent 協作觀察**:copilot 的修復品質**超出預期** — 不只修 symptom,還做架構改善(單一常數來源),呼應了塔台工單「一次修完所有 drift」的要求。dog-food 實驗成功
- **D015** 2026-04-11 09:55 — Phase 1 驗收第一個 bug,派發 T0013 hotfix(跨工單 IPC drift)
  - **背景**:使用者執行 T0011 user-testing-guide 第一項(Settings → 模型管理 → 點下載),Tiny/Base/Small/Medium 4 個模型一律報 `No handler registered for 'voice:downloadModel'`
  - **根因推測**:T0004(main)和 T0009(renderer)分別在不同 sub-session 完成,各自通過 build,但 IPC channel 命名可能不一致,或 handler 根本沒註冊
  - **決策**:選項 A — 直接開 T0013 綜合工單(調研 + 修復 + 驗證),不先開 BUG-003 報修單
  - **理由**:
    - 使用者偏好決策速度快(塔台語氣校準)
    - 跟 T0006/T0008/T0012 相同的 hotfix 模式,一次處理完
    - 範圍集中在 IPC 層,root cause space 很小
    - 要求 sub-session 順便盤點所有 `voice:*` channel 是否有同類 drift,避免修完一個又冒一個
  - **風險**:若根因涉及 T0004 的 handler 實作有問題(不只是命名),範圍可能擴大,但已允許 BLOCKED 回報
  - **相關學習**:L007(vite build 通過 ≠ 型別正確)+ L008(平行工單檔案所有權)— 這次是**跨工單 IPC contract drift**,可能晉升為 L012
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
| **BUG-001** | Claude OAuth 登入 paste 被截斷(應用終端內無法完成授權) | 🔴 High | ✅ 已修復(T0006)/ runtime 未驗 | 2026-04-11 00:25 | `_ct-workorders/BUG-001-claude-oauth-paste-truncated.md` |
| **BUG-002** | 右鍵功能表位置嚴重位移(除終端縮圖區外全部 UI) | 🟡 Medium | ✅ 已修復(T0008+T0012)/ runtime 未驗 | 2026-04-11 00:40 | `_ct-workorders/BUG-002-context-menu-offset.md` |
| **BUG-003** | `voice:downloadModel` IPC handler 未註冊(4 模型下載全失效) | 🔴 High | ⚠️ PARTIAL(T0013 code 修 / runtime 待驗,留給 T0023 E2E) | 2026-04-11 09:53 | T0013 工單內含現象描述 |
| **BUG-004** | AudioContext 崩潰(語音錄音啟動時整個 BAT 閃退) | 🔴 High | ✅ 已修復(T0017-β AudioWorklet 治本)/ runtime 通過 | 2026-04-11 10:15 | 無獨立檔,見 tower state 11:15 checkpoint |
| **BUG-005** | whisper native addon `require` 回傳 undefined(packaged build) | 🔴 High | ✅ 已修復(T0018 Vite external + asar unpack)/ runtime 通過 | 2026-04-11 13:49 | 無獨立檔,見 tower state 13:49 checkpoint |
| **BUG-006** | AudioWorklet 在 packaged Electron build 無法載入 | 🔴 High | ✅ 已修復(T0020 改 static worklet asset)/ runtime 通過 | 2026-04-11 15:15 | 無獨立檔,見 T0020 工單 |
| **BUG-007** | 滑鼠右鍵標記時終端機顯示 OSC 52 調試訊息污染輸出 | 🟢 Low(UX) | 📋 待分派(使用者 dogfood 回報,非阻塞) | 2026-04-11 17:xx | 無獨立檔,見本 checkpoint 內段落 |
| **BUG-008** | 終端捲動有時造成 render 錯位(overlay UI 殘留在錯誤位置) | 🟡 Medium | 📋 待分派(使用者 dogfood 回報,非阻塞) | 2026-04-11 17:xx | 無獨立檔,附圖路徑見摘要 |
| **UX-001** | Scrollbar UX 改善:加粗 60% + 永遠佔位(所有使用處) | 🟡 Medium | 📋 待分派(enhancement 類,非阻塞) | 2026-04-11 17:xx | 無獨立檔,見本 checkpoint 內段落 |
| **BUG-009** | 右鍵功能表「貼上」後 focus 未還給 CLI,需再點一次才能打字 | 🟡 Medium | 📋 待分派(使用者 dogfood 回報,非阻塞) | 2026-04-11 17:xx | 無獨立檔,見本 checkpoint 內段落 |

**BUG-007 摘要**(2026-04-11 17:xx 由使用者 dogfood 回報):
- **現象**:在 BAT(本專案自家產品)終端內滑鼠右鍵標記(選取文字)時,終端輸出出現調試訊息
  ```
  sent 87 chars via OSC 52 · check terminal clipboard settings if paste fails
  ```
- **技術背景**:
  - OSC 52 = ANSI Escape Sequence `ESC ] 52`,用於透過終端向作業系統剪貼簿寫入內容(OSC = Operating System Command)
  - 本訊息看起來是產品內部的「偵錯提示」(可能是 dev 或 debug 模式殘留)
  - 字數 87 字元暗示訊息內容**與實際複製的 payload 長度相關**(動態計算 byte count)
- **影響**:
  - ❌ UI/UX 污染 — 不該顯示給使用者的調試資訊
  - ❌ 影響產品專業感
  - ✅ 功能層面:應該不影響剪貼簿功能本身(只是訊息不該顯示)
- **可能的根因候選**(待調研):
  1. 程式碼中有 `console.log` 或等價 print 在 OSC 52 handler 中
  2. debug flag 沒有 gate 住(例如 `if (DEBUG) console.log(...)` 的 DEBUG 一直為 true)
  3. 產品刻意留下的 UX 提示(讓使用者知道如果貼上失敗要檢查 clipboard 設定)— 若是這樣,應該只在失敗時才顯示而非每次都顯示
- **使用者指示**:不立即插隊,塔台先登記為 backlog,適當時機開工單處理
- **建議工單時機**:
  - 可以併入 **Phase 1 32 項手動測試** 的 backlog 清理批次
  - 或者作為獨立快速 hotfix(grep `OSC 52` 或 `sent.*chars.*via` 關鍵字應該很快找到)
- **嚴重度理由**:
  - 🟢 Low:不阻斷功能、不造成當機、不影響資料完整性
  - 但對於**自家 dogfood 產品**的 UX,這類小瑕疵會影響整體品質感,建議在 Phase 1 收官前處理

**BUG-008 摘要**(2026-04-11 17:xx 由使用者 dogfood 回報):
- **現象**:終端捲動(scroll)時,overlay UI 元素未跟著捲動更新位置,造成**視覺錯位 / 殘留框框疊在當前內容上**
- **附圖(本機路徑,不進 repo)**:
  - `D:\Downloads\2026-04-11_162127.png` — 大範圍 render 錯位,塔台對話區塊內容重疊
  - `D:\Downloads\2026-04-11_162806.png` — 終端 T0022 對齊區段中出現白色框框疊在文字上
- **技術背景**(初步分析,待 sub-session 驗證):
  - xterm.js 是 **canvas-based render**,用 virtual scroll 管理顯示內容
  - React 管理的 overlay(例如 selection box / context menu / popover / 提示框)是 **獨立 DOM layer**
  - 兩個 layer 用不同機制追蹤 scroll offset,捲動時容易不同步
- **可能的 layer 脫鉤點**:
  1. 右鍵功能表 Portal(T0008/T0012 修的 BUG-002 延伸問題?)
  2. xterm.js 選取高亮的 render layer
  3. 其他 overlay(語音預覽框 popover?)
- **影響**:
  - ❌ 視覺瑕疵 — 使用者看到殘留 UI 元素影響閱讀
  - ❌ 操作信心受損 — 不確定當前點擊位置是否準確
  - ✅ 功能層面:終端本身 render 正常(底層 canvas 沒壞),只是 overlay 位置錯
- **與 BUG-002 / L011 的可能關聯**:
  - BUG-002 是「右鍵功能表位置嚴重位移」,根因是 `position: fixed` 在 `transform` 祖先內失效(L011)
  - BUG-008 可能是**同一個 layer pattern 的新變體** — overlay layer 的 scroll-tracking 邏輯可能沒涵蓋到終端捲動事件
  - 建議 sub-session 調研時先對比 BUG-002 的修復(`_ct-workorders/BUG-002-context-menu-offset.md` + L011)
- **可能的根因候選**(待調研):
  1. xterm.js 觸發 scroll 時,overlay element 的位置計算沒重新執行
  2. Portal 元素的 `top`/`left` 是在 mount 時計算的靜態值,沒有跟著 scroll 事件 reposition
  3. 多個終端分頁時,某個隱藏終端的 overlay 沒被正確 unmount
- **建議調研方式**(未來工單時參考):
  - DevTools 打開,滾動終端,觀察是否有 overlay DOM 節點位置不變
  - 對比 `mousemove` / `scroll` / `wheel` event listener 的註冊時機
  - 檢查所有 `createPortal` 用法
- **嚴重度理由**:
  - 🟡 Medium:不阻斷功能,但使用者操作體驗受影響,且發生在**核心互動路徑**(終端是主要 UI)
  - 需要調研才能確定根因範圍(可能是單一元件問題,也可能是多元件共通的 Portal pattern 問題)

**UX-001 摘要**(2026-04-11 17:xx 由使用者 dogfood 回報,enhancement):
- **需求**:改善所有使用 scrollbar 之處的 UX
- **具體要求**:
  1. **加粗 60%**:目前 scrollbar 太細,滑鼠不好定位和選取(拖拉 scrollbar handle 很難抓)
  2. **永遠顯示佔位**(用 `disabled` 樣式或 `overflow: scroll` 取代 `overflow: auto`)
     - **原因**:避免有 scroll / 無 scroll 切換時,容器內容寬度變化造成 **render 跳動**
     - 使用者明確指出:「避免有與無 scroll 時畫面寬度變化產生 render 跳動」
- **適用範圍**:**所有地方**(使用者明確說 "all places")— 塔台推論包括:
  - 終端視窗捲動條(xterm.js 內建)
  - 側邊欄工單 / Tab 列表
  - Settings 頁面
  - PromptBox 多行輸入
  - 任何 overflow 容器
- **技術方案候選**(待後續調研):
  1. **方案 A - CSS 全局樣式**:用 `::-webkit-scrollbar { width: 14px }` 等全局 CSS(目前預設寬度約 8-10px,加粗 60% 約 13-16px)
  2. **方案 B - 永遠佔位**:
     - `overflow: scroll` 強制顯示 scrollbar
     - 或 `scrollbar-gutter: stable`(modern CSS,Electron chromium 應支援)
  3. **方案 C - xterm.js 客製**:xterm.js 有自己的 scroll handling,需要額外處理(可能用 `setOption` 或 CSS 覆蓋)
- **與 BUG-008 的關聯**:
  - BUG-008(render 錯位)和 UX-001(佔位避免跳動)可能有**共通根因** — 都是容器寬度動態變化造成的 layout 問題
  - 若修 UX-001 強制永遠佔位,**可能順便減輕 BUG-008** 的觸發機率(但未必根治)
  - 建議 sub-session 調研時一起評估兩者
- **建議工單時機**:
  - 可與 BUG-008 併入同一張 **UI consistency audit + fix** 工單
  - 或作為 Phase 1 手動測試前的 **UX polish pass**
- **嚴重度**:🟡 Medium — 非阻塞但影響日常使用體驗
- **累積訊號**:
  - L011(position:fixed + transform)、BUG-002、BUG-008、UX-001 形成一組**「BAT 的 CSS layer / scroll 管理系統」**相關問題
  - 若累積到 5+ 個相關議題,建議開 ADR 或 architecture audit 工單做系統性審視

**BUG-009 摘要**(2026-04-11 17:xx 由使用者 dogfood 回報):
- **現象**:
  - 在終端內按**滑鼠右鍵** → 選擇「貼上」→ 內容成功貼上
  - 但隨後**無法用鍵盤打字**(按鍵全部沒反應),讓使用者誤以為程式卡頓
  - **必須再點一次左鍵**(點擊 CLI 輸入區域)才能恢復鍵盤輸入
- **對照組**(正常運作):
  - 用鍵盤 `Ctrl+V` 貼上 → focus 保持在終端,可以立即繼續打字
- **根因假設**(信心等級:HIGH):
  - 右鍵功能表彈出時,focus 轉移到**功能表 DOM 元素**(可能是 Portal 或 `<ul>` 之類)
  - 使用者點「貼上」後,功能表關閉,但**沒有呼叫 `terminal.focus()`** 把 focus 還給 xterm.js
  - Ctrl+V 則是直接在終端上觸發,focus 從未離開,所以沒問題
- **技術背景**:
  - xterm.js 需要主動呼叫 `.focus()` 才能接收鍵盤事件
  - React context menu 元件常用 Portal 實作,關閉時需要明確還原 focus
  - 這是業界常見的 menu accessibility 問題,**React 官方有 focus management pattern**(L013 GOLDEN 套用候選)
- **影響**:
  - ❌ 使用者以為程式卡頓(實際上只是 focus 跑掉)
  - ❌ 破壞「滑鼠友善」UX 路徑,逼使用者混用鍵盤
  - ❌ 影響**第一印象** — 新使用者遇到會懷疑產品穩定性
  - ✅ 功能本身無壞(再點一次就恢復,資料不遺失)
- **修復方案候選**(業界標準做法):
  1. **方案 A**(推薦):在 context menu 的 `onItemClick` / `onClose` 中,延遲呼叫 `terminalRef.current.focus()`
     ```ts
     const handlePaste = async () => {
       await pasteAction();
       closeMenu();
       // 讓 menu 完全卸載後再 focus
       setTimeout(() => terminalRef.current?.focus(), 0);
     };
     ```
  2. **方案 B**:使用 React focus trap / return pattern(例如 `@radix-ui/react-dropdown-menu` 內建 focus management)
  3. **方案 C**:在 menu 元件的 `useEffect` cleanup 中還原 focus
- **與既有 BUG 的關聯**:
  - **BUG-001** 是 OAuth paste 截斷(根因:IPC paste handler 分塊錯誤)— 根因不同,但**都是 paste 相關的 UX 路徑**
  - **BUG-002** 是右鍵功能表位置位移(L011 + Portal 修法)— **同一個 context menu 元件**,不同問題
  - **BUG-008** 是終端捲動 overlay 錯位 — 可能共享「overlay layer 管理」系統性問題
- **嚴重度理由**:
  - 🟡 Medium:不阻斷功能,但發生在**高頻互動路徑**(貼上是日常最常用的動作之一)
  - 使用者**直接反饋**「誤以為卡頓」— 這是品質感危險訊號
- **建議工單時機**:
  - 可作為**獨立快速 hotfix**(修復方案很標準,預估 < 15 分鐘)
  - 或與 BUG-007 併入同一張「終端互動 polish」hotfix 工單(都是小改動)

**🚨 右鍵功能表累積訊號**(2026-04-11 17:xx 塔台觀察):
目前已累積**第 4 個**與右鍵功能表 / overlay UI 相關的問題:

| # | ID | 狀態 | 關聯元件 |
|---|----|------|---------|
| 1 | BUG-002 | ✅ 已修復 | 右鍵功能表位置(L011) |
| 2 | BUG-008 | 📋 backlog | 終端捲動 overlay 錯位 |
| 3 | UX-001 | 📋 backlog | Scrollbar layer jitter |
| 4 | **BUG-009** | 📋 backlog | **右鍵功能表 focus 管理** |

**模式識別**:這 4 個問題都指向 **「BAT 的 overlay / menu / focus 管理系統」** 需要一次架構審視。

**塔台建議**:
- 當前繼續當作個別 bug 處理(非阻塞)
- 若第 5 個出現,強烈建議開 **「BAT Overlay/Menu Architecture Audit」** 工單做系統性審視
- 或在 Phase 1 收官前開 **「UX polish pass」** 批次工單,一次處理 BUG-007/008/009 + UX-001

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

---

## 2026-04-11 11:15 Checkpoint — BUG-004 + FEAT-001 對齊完成

### 當前狀況
- ✅ **T0013 部分通過**:使用者回報「下載模型正確了」→ `voice:downloadModel` IPC handler 註冊問題(Copilot 修的 `voice-ipc.ts` 單一常數)runtime 驗證生效
- 🔥 **發現新 bug:BUG-004**:PromptBox 麥克風按鈕按下 → 主視窗全黑 → **整個 BAT 閃退**(main process 崩潰,DevTools 斷線)
- ⚠️ **dogfooding 風險**:環境 `TERM_PROGRAM=better-agent-terminal`,使用者正用 BAT 跑 Claude Code,塔台隨時會被帶走
- 📋 **log 現場證據**:`debug-*.log` 最後一筆為 `02:18:17.396Z [startup] system tray created`,麥克風按下後所有事件空白 → 確認現有 logger **沒 hook renderer console**、**沒 crash handler**

### D016 決策紀錄
**背景**:Phase 1 驗收中斷,BUG-004 阻斷 32 項手動測試。使用者同時提 FEAT-001(log 持久化)作為診斷前提。

**決策**:走 Q1=A 串行路線 — 先做 FEAT-001 補齊 log 基礎設施,再調查 BUG-004(有武裝才實測)。

**FEAT-001 需求對齊結果**(Q4-Q7):
- Q4:現有 logger 只有 main 側簡易紀錄,麥克風事件後全空白 → FEAT-001 需全面擴充
- Q5:全 log level(error/warn/info/log/debug),預設開啟,Settings 可關
- Q6:每次 app 啟動新開檔 `debug-YYYYMMDD-HHmmss.log`,保留最近 10 個
- Q7:整合 Electron `crashReporter` + `app.on('render-process-gone')` + `child-process-gone`
- **補充**:File 選單加「開啟應用程式資料夾 / 日誌資料夾 / 崩潰報告資料夾」3 個項目
- **補充**:Log 放獨立 `Logs/` 目錄(非散落在 userData 根目錄)

**工單路線**:
- T0014(FEAT-001):Console log 持久化 + crash-safe + Settings UI + File 選單(**本次派發**)
- T0015(BUG-004 調研):T0014 完成後派發,**code audit only 禁止實測**
- T0016(BUG-004 修復):T0014 + T0015 完成後派發,有 log 武裝才實測修復

### 🚨 待使用者回應
- [x] **切換到非 BAT 終端**(已完成 11:20)
- [x] 在新終端執行 `/ct-exec T0014`(sub-session 已啟動)
- [ ] 等待 T0014 完成回報
- [ ] T0014 完成後派發 T0015(BUG-004 調研)

### T0014 執行狀態
- **狀態**:✅ **DONE**(2026-04-11 11:47,runtime 由真實崩潰事件驗證)
- **開始時間**:2026-04-11 11:20
- **Sub-session 完成時間**:2026-04-11 11:37(約 17 分鐘)
- **Runtime 驗收時間**:2026-04-11 11:47(使用者重現 BUG-004 時全部功能正常運作)
- **執行終端**:獨立終端(VS Code Git Bash)
- **Code 完成度**:9/9 sections
- **Runtime 驗收結果**(由真實 BUG-004 崩潰驗證):
  - ✅ 新 log 檔案 `debug-20260411-114634.log` 產生
  - ✅ 舊 debug.log 遷移 `debug-legacy-*.log`
  - ✅ Renderer console 轉發(`[RENDERER]` 字首滿滿)
  - ✅ crashReporter 捕捉 `Crashes/reports/6528598d-*.dmp`
  - ✅ `render-process-gone` handler 寫入 `[ERROR] [CRASH]`
  - ✅ Main process 崩潰後存活並完成 log 寫入
  - ✅ `BAT_RUNTIME=1` 隔離到 `better-agent-terminal-runtime-1/` userData
- **未手動驗證(可接受延後)**:File 選單點擊 / Settings Toggle 熱切換 / 輪替 15 檔測試 — 這些不影響 BUG-004 診斷

### D017 決策
**接受 T0014 PARTIAL** — Sub-session 的 CLI 限制無法跑 GUI,符合 D013 的 headless deferral 模式。產生 runtime checklist 交使用者手動執行,並**把 BUG-004 重現整合進 Part 7**(反正現在 logger 武裝完整,正是重現時機)。

### §1 盤點關鍵發現(可能關聯 BUG-004)
- 現有 logger **有 async buffer**(`writeBuffer + setImmediate + fs.appendFile`)→ 解釋為何 BUG-004 閃退時 log 截斷:**buffer 沒 flush 就 abort 了**
- 現有 logger **沒有 crashReporter / render-process-gone / child-process-gone / renderer console hook**
- 170 處 logger 呼叫點,全部無改動(相容性 ✅)
- T0014 補的正好是這三個缺口 → BUG-004 下次能被抓到

### 新 checklist
- `_ct-workorders/reports/T0014-runtime-checklist.md`(7 Part,~30 項,25-35 分鐘)
- Part 1-6:T0014 功能驗證
- Part 7:**BUG-004 重現 + log 收集**(關鍵)

### 🚨 待使用者回應(更新)
- [x] 確認塔台位置安全
- [x] 啟動 dev server(VS Code Task Dev Server Runtime)
- [x] 跑 Part 1-7(直接走 Part 7 重現)
- [x] BAT 閃退 → log + dmp 捕捉成功
- [ ] 在獨立終端執行 `/ct-exec T0015`(BUG-004 調研工單,code audit only)
- [ ] 等 T0015 回報

### L012 新增學習
- **VS Code tasks 可讓 Worker 做部分 runtime verification**(~30% 可自動化 + Part 7 GUI 必須人)
- 未來工單設計應主動評估可自動化比例:>70% 全自動 / 30-70% 混合 / <30% 全人工
- Backlog:建立 CDP 自動化層可提升到 ~90%(1-2h 基礎設施)

---

## 2026-04-11 11:55 Checkpoint — BUG-004 根因鎖定 + T0015 派發

### D018 決策紀錄:T0014 後置驗收 + T0015 範圍設計

**背景**:T0014 原訂 PARTIAL(code done, runtime 待測),但使用者跑 checklist Part 7 時直接重現 BUG-004,**真實崩潰反向驗證了 T0014 的 6 項核心功能**。

**決策**:
1. T0014 從 PARTIAL 升為 DONE(runtime 以真實事件驗收,File 選單等 UI 點擊可延後)
2. T0015 定義為 **code audit only**(嚴禁實測、嚴禁改程式碼)
3. T0015 範圍:RecordingService + useVoiceRecording + BrowserWindow webPreferences + Web Audio API grep + package.json deps + 根因假設 ranking + 2-3 個修復方案候選 + dmp 分析(若有工具)
4. T0016(修復工單)暫緩,等 T0015 產出根因後派發

### 🎯 BUG-004 證據鎖定(由 T0014 logger 捕捉)

**時間軸(毫秒精度)**:
```
11:47:52.329  [voice] getPreferences → small/zh/繁中
11:47:56.383  [voice] isModelDownloaded size=small
11:47:56.884  [RENDERER] [voice] RecordingService started (sampleRate=48000)
11:47:56.884  [RENDERER] [voice] useVoiceRecording: recording started
                          ↓ 240ms
11:47:57.124  [ERROR] [CRASH] render-process-gone reason=crashed exitCode=-1073741819
```

**Exit code**:`-1073741819` = `0xC0000005` = **STATUS_ACCESS_VIOLATION**(Windows 記憶體存取違規)

**證據位置**:
- Log:`C:\Users\Gower\AppData\Roaming\better-agent-terminal-runtime-1\Logs\debug-20260411-114634.log`
- Dump:`C:\Users\Gower\AppData\Roaming\better-agent-terminal-runtime-1\Crashes\reports\6528598d-2995-43cf-96e3-393cb74394ca.dmp`
- Legacy:`debug-legacy-20260411-114634.log`

### 5 個假設(主推 H1)

| # | 假設 | 證據 | 信心 |
|---|------|------|------|
| **H1** | Web Audio API native crash(Chromium WASAPI 初始化) | sampleRate=48000 + 240ms 延遲 + access violation 符合 WASAPI pattern | 🔴 **高** |
| H2 | GPU / Video capture 干擾 | 需 GPU log | 🟡 中 |
| H3 | AudioWorklet + COOP/COEP missing | 需看 webPreferences | 🟡 中 |
| H4 | 其他 audio native addon | 需 package.json audit | 🟡 中 |
| H5 | node-pty ↔ audio race | 240ms 時間差太大 | 🟢 低 |

### 負證據(同樣關鍵)

- ❌ 無 `[RENDERER] [ERROR]` → 不是 JS 例外
- ❌ 無 `whisper` log → whisper-node-addon 沒啟動
- ❌ 無 `child-process-gone` → 不是 utility process
- ❌ 無 `uncaughtException` → main process 乾淨
- ❌ 無 `AudioContext` / `MediaRecorder` / `getUserMedia` 顯式 log → 這些 API 的 error 沒被 hook(但崩得太快也可能來不及)

### 附帶觀察(另案)

- `[WARN] getSupportedModels failed` — `@anthropic-ai/claude-agent-sdk` `--omit=optional` 導致 `win32-x64` native binary 遺失,與 BUG-004 無關,加入 Backlog

### Backlog 新增
- 📋 `@anthropic-ai/claude-agent-sdk` 的 `win32-x64` native binary 缺失警告(`getSupportedModels failed`)— 影響未知,實測使用情境再處理
- 📋 T0014 未手動驗證的 UI 項目:File 選單點擊 / Settings Toggle 熱切換 / 15 檔輪替測試 — 不阻斷,等 Phase 1 收尾時補測

### T0015 工單狀態
- **檔案**:`_ct-workorders/T0015-bug004-voice-crash-audit.md`
- **狀態**:✅ **DONE**(2026-04-11 約 12:30)
- **類型**:Investigate(code audit only)
- **紅線遵守**:✅ zero 程式碼修改,`git status` clean
- **§7 dmp**:跳過(無 WinDbg/cdb)— Backlog 需補

### 2026-04-11 12:30 Checkpoint — BUG-004 根因確認(H1 鎖定)

### D019 決策:T0015 分析結果採信

**背景**:T0015 產出高品質調研報告,H1 重新評分為 **高信心**,證據鏈完整。

**關鍵發現**:
1. **崩潰鏈鎖定**在 `src/lib/voice/recording-service.ts:63-117`:
   - `getUserMedia` → `new AudioContext()` → `createMediaStreamSource` → `createScriptProcessor(4096,1,1)` → `source.connect(processor)` → **`processor.connect(audioContext.destination)`** → log → return
   - 之後 240ms 內無 JS 動作,直接 native crash
2. **關鍵線索(塔台進一步洞察)**:
   - **ScriptProcessorNode 是 W3C deprecated API**(建議改 AudioWorklet)
   - **`connect(audioContext.destination)`** = 把 mic 輸入**導到喇叭輸出**,觸發 WASAPI output pipeline
   - 崩潰最可能發生在 Chromium 的 WASAPI output 初始化(而非 input)
3. **sampleRate=48000 來源**:`audioContext.sampleRate`(OS 預設),不是硬編碼
4. **MediaRecorder / AudioWorklet 未使用**,註解裡有「刻意不用」的理由
5. **COOP/COEP 未設**,但因為沒用 AudioWorklet 所以不影響
6. **webPreferences 很標準**,沒激進設定
7. **唯一的 app.commandLine 音訊相關**:`disable-features: ServiceWorker`(跟 audio 無直接關係)

### 塔台補充的修復方案(sub-session 沒提)

**方案 D(塔台)— AudioWorklet 取代 ScriptProcessor**:
- ScriptProcessorNode 是 deprecated,這是最正路的現代化方案
- 需要 `audioContext.audioWorklet.addModule()` + AudioWorkletProcessor 腳本
- 風險中等,但不是降級

**方案 E(塔台)— `createMediaStreamDestination` 繞過 output pipeline**:
- 當前 `processor.connect(audioContext.destination)` 會把 audio 送到「喇叭輸出」,觸發 WASAPI output 初始化
- 改用 `const sink = audioContext.createMediaStreamDestination(); processor.connect(sink)` → 把 audio 送到「虛擬 stream sink」,**繞過實體輸出裝置**
- **若根因是 WASAPI output 初始化失敗**,這個改動可能一行修好 BUG-004
- 風險:低(ScriptProcessorNode 仍需要下游節點消耗 audio 才會觸發 `onaudioprocess` 回呼,MediaStreamDestination 符合)

### T0016 策略(待決策)
- 階段 1:加 checkpoint logging + 方案 E(快速驗證 / 30min-1h)
- 階段 2(條件):若階段 1 沒修好,走方案 D(AudioWorklet / 2-3h)
- 或:先派 T0017 安裝 WinDbg 抓 stack trace 再動手(嚴謹路線)

### 待使用者回應
- [x] 決定 T0016 策略:**C 雙管齊下**
- [x] 派發 T0016(方案 E + checkpoint)
- [x] 派發 T0016-pre(WinDbg + dmp 分析)
- [ ] 使用者開兩個獨立終端,平行執行 `/ct-exec T0016` 和 `/ct-exec T0016-pre`
- [ ] 等待兩張工單回報
- [ ] T0016 完成後使用者手動 runtime 驗證(按麥克風)

### D020 決策:C 方案(雙管齊下)

**理由**:
1. T0016 方案 E 是一行改動,風險極低,不需等 T0016-pre 的 stack trace
2. T0016-pre 提供獨立證據強化決策,即使 T0016 成功也有學習價值
3. 兩張工單**檔案不重疊**(T0016 改 `recording-service.ts`,T0016-pre 寫 `reports/T0016-pre-*.txt`)
4. 平行執行節省約 1 小時等待時間

### T0016 + T0016-pre 狀態(平行執行中)
- **T0016** (`_ct-workorders/T0016-bug004-voice-crash-hotfix.md`):✅ **DONE**(code-level)
  - 開始時間:2026-04-11 12:20:28
  - 完成時間:2026-04-11 約 12:55(約 35 分鐘)
  - Commit:`87d3e4a` — 1 檔修改(+15/-4)
  - 紅線遵守:✅ 完美(`git commit --only` 處理 repo 雜訊)
  - Grep 結果:全 codebase 僅 `recording-service.ts` 一處用 `audioContext.destination`
  - Build:`npx vite build` 通過
  - **待使用者 runtime 驗證**(按麥克風測試)
- **T0016-pre** (`_ct-workorders/T0016-pre-windbg-dmp-analysis.md`):✅ **DONE**
  - 開始時間:2026-04-11 04:20 (UTC)
  - 完成時間:2026-04-11 約 12:55 (UTC+8)(約 35 分鐘,winget 比預期快)
  - cdb 路徑:`C:\Program Files (x86)\Windows Kits\10\Debuggers\x64\cdb.exe` v10.0.22621.2428
  - 分析輸出:`_ct-workorders/reports/T0016-pre-dmp-analysis.txt`
  - **關鍵發現**:FAULTING_MODULE 在 `electron.exe`,stack 中無 audio module symbol
  - **H1 判讀**:**部分反駁**(但受限於缺 Electron symbols,不能完全排除)
  - 新增假設 H9/H10/H11(見 D021)

### 平行執行觀察
- 兩個 sub-session 同時啟動(12:20 前後)
- 檔案隔離矩陣確認無衝突
- **兩張工單都在 35 分鐘內完成**,比預估快
- 塔台無需介入協調

### D021 決策:T0016-pre 發現後的根因重評

**背景**:T0016-pre 用 cdb 分析 dmp,發現 stack trace 指向 V8/cppgc 而非 WASAPI,H1 被部分反駁。

**Symbol 限制**:sub-session 只有 Microsoft 系統符號,沒有 Electron 專用 PDB,所有 electron.exe 內函式顯示為「最近 export + offset」,真實函式名看不到。例如 `Cr_z_adler32+0x7c7cb` 不是 adler32,是 adler32 位址往後 511KB 的某函式。

**新假設**:
- **H9(中高信心)**:V8 GC 路徑在 RecordingService 物件生命週期中碰到 UAF(AudioContext/MediaStreamSource/ScriptProcessorNode 的 native binding 生命週期 bug)
- **H10(中)**:ScriptStreamingTask 與 audio init race
- **H11(中)**:Memory corruption(aaaaaaaa poisoned fill 暗示)
- **H1(降中)**:仍無法排除,需要 Electron symbols 才能定論

**決策**:
1. **先測 T0016**(不等完美判讀,測試成本極低)
2. 若通過 → 確認方案 E 有效但保留疑問,記入 L013
3. 若失敗 → 派 T0017(方向根據新假設)+ 派 T0017-pre(下載 Electron symbols 重跑分析)
4. **備援**:考慮建立一張 Backlog 工單「下載 Electron debug symbols 建立完整分析能力」,對未來任何 Electron crash 都有用

### 待使用者回應
- [x] 執行 T0016 runtime 測試 — 12:52
- [x] 回報 T0016 失敗(仍閃退)
- [x] 決定走 Alpha 策略派 T0017-α
- [x] T0017-α 完成(commit `b8ef9f5`)
- [x] **D023 決策:跳過 T0017-α runtime 測試,直接派 T0017-β**
- [x] 派發 T0017-β
- [x] T0017-β **4 分鐘完成**(13:32-13:36,詳細 blueprint 換來快速執行)
- [x] T0017-β 實質 DONE(標記 PARTIAL 僅因 tsc 既有 baseline 錯誤,非本工單 regression)
- [x] Plan A(`new URL + import.meta.url`)一次通過,未切 Plan B
- [x] Commit `08b4856f7fa682e2c48ffe88e4daf143f3b77ae4`(+115/-36,2 檔)
- [ ] **🎯 關鍵:使用者 runtime 測試 AudioWorklet 版本**
- [ ] 若通過 → BUG-004 修復,Phase 1 可繼續,累積 learnings(L014+)
- [ ] 若失敗 → 根據失敗模式規劃 T0017-γ(可能是 worklet URL loading 問題或其他)

### D023 決策:應用 L013,跳過 T0017-α 測試直接上 AudioWorklet

**背景**:使用者質疑「為什麼沒推薦直接用新技術改寫」,塔台承認判斷失誤(L013「Evidence-first 原則過度套用」)。

**決策**:
1. **不做** T0017-α runtime 測試(診斷資料不是必要)
2. **直接派** T0017-β(AudioWorklet 實作)
3. 承認 T0017-α 的 15 分鐘是沉沒成本
4. T0017-α 的 tick counter 在 T0017-β 裡**重用**為 worklet message counter

**影響**:
- 節省時間:~5-10 分鐘(跳過測試)
- L013 從記錄提升為**實際遵守**
- T0017-β 成為真正的治本工單

### T0017-β 關鍵技術要點
- **ScriptProcessorNode → AudioWorkletNode**(W3C 推薦 + Chromium 積極維護)
- **onaudioprocess → port.onmessage**(避開 V8 cross-thread callback)
- **numberOfOutputs: 0**(不 connect 到 destination,完全繞開 WASAPI output)
- **transferable PCM**(`postMessage(data, [buffer])` 零複製)
- **Plan A**:`new URL(..., import.meta.url)` 讓 Vite 打包 worklet
- **Plan B**:`public/voice-worklet/*.js` 靜態資產(Plan A 失敗時切換)
- **不保留 ScriptProcessor fallback**(L013:避免過度保守)

### 附加 Backlog
- 📋 **下載 Electron debug symbols**(1-2GB)建立完整 native crash 分析能力,可重跑 T0016-pre 的 dmp 拿到真實函式名
- 📋 **L012 擴充**:T0016-pre 證實 Worker **能**做 forensic analysis(winget 可用),但 debug symbols 取得仍是另一層投資

---

## 2026-04-11 13:00 Checkpoint — T0016 測試失敗但診斷成功,H1 完全反駁

### D022 決策:方案 E 失敗原因判讀 + T0017 策略選擇

**T0016 runtime 測試結果**(04:52 UTC,12:52 UTC+8):

```
23.432  [voice:checkpoint] processor→sink connected  ← 方案 E 執行成功
23.432  [voice] RecordingService started             ← start() 完整 return
23.432  [voice] useVoiceRecording: recording started ← hook 更新
        ↓ 236ms(無 JS log)
23.668  [ERROR] [CRASH] render-process-gone reason=crashed exitCode=-1073741819
```

**關鍵發現**:
1. 方案 E 的 `createMediaStreamDestination` 執行成功(checkpoint 7 寫入)
2. `started()` 函式完整 return,所有同步路徑都通過
3. 崩潰在 **async 階段**,236ms 後
4. **236ms ≈ 2.77 個 audio buffer**(4096 samples @ 48000Hz = 85.33ms/buffer)
5. 上次是 240ms,這次 236ms,**時間非常穩定** → 不是 race,是定時觸發

**H1 最終判定**:❌ **完全反駁**
- 方案 E 確實繞過 `audioContext.destination`
- 但仍在相同時間點崩潰
- WASAPI output 初始化**不是**根因

**H12(新,主推)**:🔴 **高信心**
- `ScriptProcessorNode.onaudioprocess` callback cross-thread 路徑的 native binding UAF
- 與 T0016-pre 的 `cppgc::WriteBarrier` + `ScriptStreamingTask` 證據吻合
- 支持證據:崩潰時間穩定、236ms ≈ 2-3 個 buffer、所有同步路徑通過、deprecated API

**備援假設**:
- H9(V8 GC + RecordingService 生命週期)— 仍可能,與 H12 重疊
- H13(新)— ScriptProcessorNode 在特定硬體/driver 是已知 Chromium bug

### T0017 策略候選

**策略 Alpha(塔台推薦 ⭐)— 分階段**:
- T0017-α:在 `onaudioprocess` 加 tick checkpoint(10 分鐘)
- 測試鎖定第幾次 tick 崩
- T0017-β:根據結果走 AudioWorklet / MediaRecorder / 其他
- 優點:低風險、高資訊、成本可控
- 缺點:多一個 iteration 週期

**策略 Bravo — 直衝 AudioWorklet(方案 D)**:
- 跳過診斷,直接實作 AudioWorkletNode 取代 ScriptProcessorNode
- 投入 2-3 小時
- 優點:治本,若 H12 正確一次搞定
- 缺點:若 H12 錯了就白做

**策略 Charlie — MediaRecorder(方案 A)**:
- 徹底繞開 Web Audio
- 需要 webm/opus decoder(whisper 要 WAV)
- 投入 3-4 小時
- 備援選項

### 塔台推薦:策略 Alpha

理由:
1. 10 分鐘投入換取 H12 確認 vs 反駁
2. 若 tick 從未呼叫 → AudioWorklet 不一定有用 → 省掉 2-3h 白工
3. 若 tick 1-2 次後崩 → AudioWorklet 幾乎肯定修復 → 信心最大化
4. Checkpoint 技術已證實有效(T0016 運作完美)

### 重要額外 Backlog
- 📋 **Chromium bug 研究**:搜尋 "ScriptProcessorNode crash" 已知 issue,確認是否現有 bug 可參考
- 📋 **AudioWorklet 移轉長期計畫**:即使 T0017-α 找到其他修復,AudioWorklet 仍是現代化方向

### 新增 Backlog
- 📋 T0013 殘餘 runtime 驗證:除了模型下載外,還有下載進度 / cancel / 重試 / 刪除等情境待使用者實測
- 📋 Phase 1 32 項手動測試:仍在暫停狀態,等 BUG-005 修復後繼續(BUG-004 已解)

---

## 2026-04-11 13:49 Checkpoint — BUG-004 治本成功 + BUG-005 暴露

### 🎉 T0017-β Runtime 驗證結果

**使用者實測回報(13:49 UTC+8)**:「錄音沒閃退了,但有錯誤」

- ✅ **BUG-004 徹底修復**:AudioWorklet migration 完全有效,錄音鏈路穩定
- ✅ **H12 假設(ScriptProcessorNode cross-thread UAF)完全證實**
- ✅ T0017-β 狀態升級 PARTIAL → **DONE**
- ✅ **L013 首次實戰驗證成功**:見 _learnings.md L013「實戰驗證」區段

### 🔴 BUG-005 暴露 — whisper native addon 動態 require 失敗

**錯誤訊息**:
```
⚠️ 辨識失敗: Error invoking remote method 'voice:transcribe':
Error: Failed to load native addon:
Error: Could not dynamically require "D:\ForgejoGit\better-agent-terminal-main\better-agent-terminal\platform\win32-x64\whisper.node".
Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.
```

**塔台判定**:
- **訊號**:`@rollup/plugin-commonjs` 在 build 階段無法解析動態 require `.node` 檔案
- **根因類型**:Vite + Electron + native `.node` 的經典 bundling 問題(業界已知)
- **業界標準解法**:把 `.node` 標為 `external` + 使用 `createRequire(import.meta.url)` 或絕對路徑 runtime require
- **判定**:適用 L013 直衝治本,不做漸進診斷

### D023 決策:T0018 派發策略

**使用者需求對齊**(B-A-A-D):
- **B**:從未正常過(T0004 當時未做完整 runtime 驗證)
- **A**:最高優先級(Phase 1 驗收就差這一哩路)
- **A**:直衝治本(L013 模式)
- **D**:不記得 T0004 當時整合方式 → sub-session 自行探勘

**工單結構**:T0018 分三 phase
- Phase A(5-15 min):探勘 — 找 require 呼叫點、Vite 設定、`.node` 實際位置,決定修法 Case
- Phase B(15-30 min):治本修復 — 依 Case 1/2/3 其中一種套用業界標準做法
- Phase C(5-15 min):驗證 — build + grep + 寫使用者測試步驟

**預算**:硬性上限 60 分鐘,超過改回報 PARTIAL

**嚴格範圍邊界**:
- ❌ 不做 233 個既有 TypeScript baseline 錯誤(屬 T0017-β 遞交的 backlog 問題,另開工單)
- ❌ 不做 voice 模組重構
- ✅ 順手補 whisper addon 的 try/catch、修路徑拼接 bug 允許

### 當前進度表

| Story | 工單 | 狀態 | 卡點 | 下一步 |
|-------|------|------|------|--------|
| Phase 1 / BUG-004 | T0017-β | ✅ DONE | - | - |
| Phase 1 / BUG-005 | T0018 | ✅ DONE | - | - |
| Phase 1 / 手動測試 | - | 📋 READY | - | **解封!** 可開始 32 項測試 |
| Phase 1 / T0013 殘餘 | - | 📋 READY | - | **解封!** 下載/取消/重試等情境 |
| Phase 1 / TypeScript baseline | - | 📋 LOW | - | 低優先級,build 通過不阻斷 |

---

## 2026-04-11 14:0? Checkpoint — 🎉 Phase 1 Voice Input 功能完整實作成功

### Runtime 驗證結果
使用者實測語音輸入,log 訊息 `"語音 測試 測試 測試 測試 非常好成功了! 哇哈哈哈哈!"` 中的「語音 測試 測試 測試 測試」是第一次成功端到端轉寫結果。BUG-004 + BUG-005 雙解。

### 重大里程碑
- 🎊 **Phase 1 voice input 功能完整實作成功**(錄音 → 轉寫 → 回填 PromptBox)
- 🎊 **L013「業界最佳方案直接採用」連續兩次實戰驗證**
- 🎊 **4 分鐘 hotfix 模式**建立(T0017-β 和 T0018 都是)

### L013 升級為 GOLDEN Rule
- 原本狀態:candidate: global(經過一次 T0017-β 實戰)
- 升級條件:連續兩次不同類型的 hotfix(React/Audio API 底層 + Rollup/Vite build 設定)皆 4 分鐘完成,零次失敗,零次 rollback
- 新狀態:**GOLDEN rule — 所有塔台決策必讀**
- 實戰紀錄寫入 _learnings.md L013「實戰驗證」區段(T0018 紀錄追加)

### D024 決策:Phase 1 Backlog 解封順序
優先級(由高到低):
1. **T0013 殘餘 runtime 驗證** — 下載進度 / cancel / 重試 / 刪除(使用者體感可見)
2. **Phase 1 32 項手動測試** — 需要完整測試 checklist,可能拆成 4-5 張子工單
3. **TypeScript baseline 清理** — 低優先級,build 通過不阻斷

### D025 決策:Context Hygiene 建議
本 session 已累積大量 context(Tower 啟動 → 4 輪對齊 → T0017-β 升級 → T0018 派發 → T0018 驗證),建議:
- **當前 session**:做 memory 保存 + 開 backlog session 的工單,然後關閉
- **新 session**:開始執行解封的 backlog 項目

### 待使用者決定
- 先做 backlog 中哪一項?
- 是否要先 commit/push?(手邊有 T0017-β + T0018 兩個 commit 加上其他未提交變更)
- 是否要跑 *evolve 萃取這次 session 的學習?

---

## 2026-04-11 15:47 Checkpoint — T0020 DONE · BUG-006 解決 · Packaged Build 修通

### 狀態變更
- **T0020** ⚠️ PARTIAL → ✅ **DONE**
- **BUG-006**（AudioWorklet in packaged build）→ **RESOLVED**

### 使用者回報
> 「T0020 後續修復重新打包測試通過 / 應該說,T0020 重新打包的版本我直接測已過」— 2026-04-11 15:47-15:52

### 回報內容判讀(已修正)
- Sub-session 已完成根因定位 + hotfix(`src/lib/voice/recording-service.ts` 改用 static JS worklet + 新增 `public/voice-worklet/recording-worklet-processor.js`)
- 使用者**直接採用 sub-session 產出的 packaged build**(`release/win-unpacked`)執行 runtime 測試,**一次通過**
- 沒有額外的 code 修改,也沒有重跑打包 — 原 sub-session 的產出即是最終版本
- 原 PARTIAL 卡點(GUI/麥克風 runtime 驗證)由使用者實機操作補上

### 🏆 L013 GOLDEN Rule 第三次連續驗證
- T0017-β(React AudioWorklet migration) — 4 分鐘完成,0 rollback
- T0018(whisper addon load) — 4 分鐘完成,0 rollback
- **T0020(Vite packaged worklet load) — Sub-session hotfix 一次到位,使用者直接測過,0 rollback**
- 三次不同類型的底層問題(React lifecycle / Rollup build output / Vite asset pipeline)連續零失敗
- L013「業界最佳方案直接採用」模式的有效性再次強化

### Git 工作區（未提交）
- `M src/lib/voice/recording-service.ts`（+10/-4）
- `?? public/voice-worklet/recording-worklet-processor.js`（新增 static asset）
- 兩個變更皆屬於 T0020 hotfix，邏輯上應合併為單一 commit

### L015 學習鉤子確認
- **候選等級**：candidate: project（sub-session 建議）
- **規則**：Vite + Electron 專案中，`audioWorklet.addModule()` 不應透過 `new URL('./xxx.ts', import.meta.url)` 載入；Vite 可能把 `.ts` 當 asset 輸出為 `data:video/mp2t` URL，packaged runtime 失敗
- **建議做法**：把 worklet 放 `public/` 靜態目錄，用 `window.location.href` 組路徑載入
- **升級考量**：本規則同樣適用於所有「Vite + Electron + Web Worker/Worklet API」的組合,跨專案可用 — 建議 `*evolve` 時評估是否升 global

### D026 決策:T0020 後續行動排序
| 序 | 行動 | 優先 | 建議 |
|----|------|------|------|
| 1 | commit `recording-service.ts` + `public/voice-worklet/` | 🔴 高 | 趁手邊清,避免混進下一張工單的變更 |
| 2 | 跑 `*evolve` 萃取本輪 session 學習 | 🟡 中 | 本輪累積 T0020 + L015,值得保全 |
| 3 | 處理 D024 backlog(T0013 runtime / Phase 1 手動測試) | 🟢 中 | 開新 session 做,context hygiene |
| 4 | BAT ↔ AI Agent Orchestration 研究 review | 📋 低 | 等想做時再拆工單 |

### 🚨 待使用者回應
1. **後續修復內容**:你說的「後續修復」是指微調 sub-session 的 hotfix,還是新增了其他修改?(需要的話我幫你補到工單產出摘要)
2. **是否立即 commit**:建議 `fix(voice): use static worklet asset for packaged build (BUG-006)` commit message,單一 commit 合併兩個檔案,你要我產生 commit 工單嗎?
3. **下一步路線**:D024 backlog 哪一項優先?(T0013 殘餘驗證 / Phase 1 手動測試 / 其他)
4. **Session 衛生**:本輪 context 已跨越上一輪 session(從 14:06 Phase 1 慶祝到現在),建議 commit + *evolve 後開新 session

---

## 2026-04-11 16:40 Checkpoint — T0021 DONE · 發現 .gitignore 塔台陷阱

### 狀態變更
- **T0021** 📋 TODO → ✅ **DONE**(16:31 → 16:37,6 分鐘)
- 新 commits:`7bc856e fix(voice): BUG-006 hotfix` + `f75b1c8 chore(tower): close BUG-006`
- 分支狀態:main ahead of origin/main by 2 commits(未 push)

### 🚨 關鍵發現:`_ct-workorders/` 被 `.gitignore` 排除
Sub-session 在執行 Commit 2 時遭遇:
```
.gitignore line 21: _ct-workorders/
```
初次 `git add _ct-workorders/...` 被忽略,改用 `git add -f` 強制加入後完成 commit。

**這個規則與 L014(塔台 state 檔案構成原子 commit 群組)直接衝突**:
- L014 前提:塔台檔案應該正常 commit
- 實際狀況:塔台目錄被整個排除
- 結果:每次 `chore(tower)` commit 都需要 `git add -f` workaround

### 影響範圍
1. ❌ **L014 失效**:未來所有 chore(tower) commit 都踩同樣陷阱
2. ❌ **跨機器同步失效**:若拉 repo 到另一台機器,拿不到工單和 tower state
3. ❌ **Sub-session 盲點**:工單模板沒提醒 `-f`,sub-session 容易迷失
4. ❌ **未來 T0022 commit 會再遭遇**(因為 `_ct-workorders/T0022-....md` 需要 commit)

### 需使用者決策
**塔台目錄的 git 管理策略**:
- 選項 A:**移除 `.gitignore` 規則**(讓 `_ct-workorders/` 正常進 repo)— 支援跨機器同步、L014 自然運作
- 選項 B:**保留規則**(本機獨立管理,不跨機器同步)— 維持現狀,但每次 commit 要記得 `-f`
- 選項 C:**細化規則**(只排除部分,例如 `reports/` 保留 `T*.md` 和 `_*.md`)

### 學習鉤子候選
- **新 L016 候選**:「啟用塔台前必須檢查 .gitignore 是否排除 `_ct-workorders/`」— 跨專案可用(candidate: global)
- 或者 **TG009**:「塔台目錄被 gitignore 吃掉時 L014 陷阱」

### 未 commit 的變更(T0021 之後)
```
modified:  _ct-workorders/T0021-commit-bug006-hotfix-and-tower-state.md   (sub-session 填了回報區)
```

### T0022 已就緒
- 工單檔案:`_ct-workorders/T0022-playwright-e2e-infra-bootstrap.md`
- 前置:T0021 ✅ 已 DONE
- **阻塞**:在使用者決定 `.gitignore` 策略前,T0022 暫不派發剪貼簿(避免 sub-session 再踩同樣陷阱)


---

## 2026-04-11 17:11 Checkpoint — T0022-prep 完成 · 塔台目錄改為細化治理

### 狀態變更
- **T0022-prep** 🔄 IN_PROGRESS → ✅ **DONE**（17:01 → 17:11）
- `.gitignore` 已由整體排除 `_ct-workorders/` 改為細化規則：
  - `_ct-workorders/reports/*`（保留 `reports/.README.md`）
  - `_ct-workorders/.private/`
  - `_ct-workorders/*.draft.md`
- 新增 `scripts/hooks/pre-commit`（tower 敏感關鍵字 WARN，不 block）
- 新增 `_ct-workorders/.private.README.md` 與 `_ct-workorders/reports/.README.md`

### 稽核結果（Goal 1）
- 報告：`_ct-workorders/reports/tower-dir-audit-2026-04-11.md`
- 結論：**HAS_FINDINGS（全為 FALSE_POSITIVE）**
- 判讀：未發現需要立即隔離的 `REAL_CONCERN`，可安全進行 gitignore 細化

### 驗證摘錄
- `git check-ignore _ct-workorders/_tower-state.md` → 無輸出（✅ 不再被忽略）
- `git check-ignore _ct-workorders/reports/tower-dir-audit-2026-04-11.md` → 有輸出（✅ 仍被忽略）
- `git check-ignore _ct-workorders/.private/test.md` → 有輸出（✅ 仍被忽略）
- `git check-ignore _ct-workorders/test.draft.md` → 有輸出（✅ 仍被忽略）

### 工程備註
- 已安裝本地 hook：`.git/hooks/pre-commit`
- `password=test123` 測試檔 commit 驗證 WARN 可觸發，且不阻擋 commit（驗證後已 reset 並刪除測試檔）
- `sprint-status.yaml`：不適用（專案不存在）

---

## 2026-04-11 17:23 Checkpoint — T0022-prep 塔台端收尾 + 連續 dogfood bug 登記

### T0022-prep 狀態確認
- **狀態**:✅ DONE(17:01 → 17:11,**10 分鐘**乾淨完成)
- **終極指標通過**:`git check-ignore _ct-workorders/_tower-state.md` 回傳 `<no output>`,證明細化規則生效,未來 `chore(tower)` commit 不再需要 `git add -f`
- **Commit 1 已產生**:`2ff0606 chore(infra): refine tower directory gitignore + pre-commit hook`
- **Commit 2 尚未產生**:Sub-session 主動留給塔台(因為塔台 session 還會繼續動 `_tower-state.md`)
  - 聰明的決定 — 避免 race condition 導致需要第二次 commit
  - 塔台需要在結束前自行產生 Commit 2

### 🏆 L013 GOLDEN 第 5 次連續實戰驗證
| # | 工單 | 耗時 | Rollback | 技術領域 |
|---|------|------|----------|---------|
| 1 | T0017-β | 4 分鐘 | 0 | Web Audio API / React lifecycle |
| 2 | T0018 | 4 分鐘 | 0 | Rollup / CommonJS externals |
| 3 | T0020 | 一次到位 | 0 | Vite asset pipeline / Electron resource |
| 4 | T0021 | 6 分鐘 | 0 | Git atomic commits |
| 5 | **T0022-prep** | **10 分鐘** | **0** | **.gitignore / pre-commit hook / audit flow** |

**L013 已是連續 5 次** — 從「GOLDEN rule」進一步變成**此專案的基礎工程文化**。

### 稽核結果摘要(供未來審計)
- **總命中**:29 筆
- **分類**:密碼/Token 3、本機路徑 17、IP/主機 3、Email 3、SSH Key 3
- **全部為 FALSE_POSITIVE**(規格文字、版本字串、公開 noreply 信箱等)
- **無 REAL_CONCERN**
- **稽核報告位置**:`_ct-workorders/reports/tower-dir-audit-2026-04-11.md`(本機,reports/ 已被細化規則排除)

### Sub-session 的學習鉤子候選(待塔台升級為正式 L 條目)
1. **候選 L017**:`.gitignore` 若直接忽略整個目錄,單純 `!子檔案` 反向規則無法生效;需改用「忽略目錄內容 `dir/*` + 例外檔案」模式
   - **觸發**:Sub-session 首版用 `_ct-workorders/reports/` + `!_ct-workorders/reports/.README.md`,Git 仍視為 ignored
   - **修法**:改為 `_ct-workorders/reports/*` + `!_ct-workorders/reports/.README.md`
   - **升級建議**:candidate: global(跨專案通用的 .gitignore 陷阱)
2. **候選 TG 條目**:`git check-ignore` 對「未被忽略」情境是**無輸出**(非錯誤),回報格式應明確標示 `<no output>` 以免誤判為錯誤
   - **升級建議**:candidate: global(git CLI 使用陷阱)

塔台決定:兩個候選都值得記錄,本次 checkpoint 直接升為 L017 + L018,下次 chore(tower) commit 時併入。但為了節省 context,留給下次新 session 的 `*evolve` 處理,當前 checkpoint 只做登記。

### 本輪 session dogfood Bug 清單
本 session 短時間內透過使用者 dogfood 累積的新 backlog(皆為 🟡 Medium 或以下,不阻塞):

| ID | 類別 | 摘要 | 緊迫性 |
|----|------|------|--------|
| BUG-007 | Terminal Output | OSC 52 調試訊息污染 | 🟢 Low |
| BUG-008 | Overlay/Scroll | 終端捲動 overlay 錯位(有附圖) | 🟡 Medium |
| UX-001 | Scroll | Scrollbar 加粗 + 永遠佔位 | 🟡 Medium |
| BUG-009 | Context Menu | 右鍵貼上後 focus 未還給 CLI | 🟡 Medium |

**右鍵功能表 / overlay 相關問題累積至第 4 個**(BUG-002 已修 + BUG-008 + UX-001 + BUG-009),若再累積 1-2 個,建議開系統性 audit。

### 當前 git 狀態
- Commits(最新):
  ```
  aedba6c chore(tower): record L016 + close T0021 handover + dispatch T0022-prep
  2ff0606 chore(infra): refine tower directory gitignore + pre-commit hook
  f75b1c8 chore(tower): close BUG-006 / mark T0020 DONE / elevate L015 to global
  7bc856e fix(voice): use static worklet asset for packaged build (BUG-006)
  6a9b5b5 fix: remove manual tag push, let release action create tag via API
  ```
- 未 commit:`M _ct-workorders/_tower-state.md`(本次 checkpoint + bug 登記)
- 分支狀態:main 領先 origin/main **4 commits**(未 push)

### 🚦 塔台建議下一步(D027)

**情境分析**:
- 本 session 已累積大量 context(Tower 啟動 → T0020 收尾 → T0021 派發 → T0022-prep 派發 → 4 筆 dogfood bug 登記)
- 大工單 T0022(Playwright E2E,120 分鐘上限)即將派發
- Context hygiene 原則:大工單應該用乾淨塔台 session 派發

**建議順序**:
1. **Step 1**:塔台產生 chore(tower) commit 工單(類似 T0021 第二個 commit),把當前 `_tower-state.md` 變更 commit 進去
2. **Step 2**:使用者執行該 commit 工單(快速,< 5 分鐘)
3. **Step 3**:**結束本塔台 session**
4. **Step 4**:開**新的乾淨塔台 session**
5. **Step 5**:新 session 中派發 T0022(Playwright infra)
6. **Step 6**:T0022 完成後對齊 T0023(Phase 1 閘門 4 項驗證)

### 🚨 待使用者回應
1. 是否同意上述 commit → 結束 session → 新 session 派 T0022 的順序?
2. 是否要先跑 `*evolve` 升級 L017/L018?(可在本 session 做,也可留給新 session)
3. 是否要把本 session 的 commits **push 到 origin**?(ahead by 4 commits,手邊是否有未解決問題阻礙 push?)

---

## 2026-04-11 17:43 Checkpoint — 新塔台 session · *sync 偵測孤兒 · T0023 v1→v2 saga · GA006 升級 Global

### Session 啟動
- 2026-04-11 17:41 塔台 session 重啟（繼前一輪 17:29 `ccce0f7` 之後）
- Dogfood 環境：`TERM_PROGRAM=better-agent-terminal`（使用者正在 dogfood 自己的產品 — 本 session 也是 dogfood session）
- 工單目錄：26 張 `.md`
- Global 資料：已載入 `~/.claude/control-tower-data/learnings/patterns.md` + `fieldguide/` 種子
- Auto-session: `on`（工單派發後自動剪貼簿派發）

### 使用者執行 `*sync`（17:42）

**工單統計**（26 張）：
- ✅ DONE: 20
- 🟡 PARTIAL: 4 （T0005, T0013, T0014, T0017-beta — 回報區漂移，不在本次收尾範圍）
- 📋 TODO: 1 （T0022-playwright-e2e-infra-bootstrap — Phase 2 規劃）
- ⚠️ AMBIGUOUS: 1 （T0022-prep-closure-and-push，見下方孤兒發現）

**🚨 孤兒發現**：`?? _ct-workorders/T0022-prep-closure-and-push.md`
- 工單頭部 `狀態: DONE` + 回報區 `完成狀態: DONE`（commit hash + push 結果都填了）
- 但檔案**從未進入 git 歷史**
- **時序重建**：
  - 17:27 前輪塔台寫出工單檔案到磁碟
  - 17:28 塔台自己執行 commit（`ccce0f7`）
  - 17:29 commit 只 stage `_tower-state.md`（212 insertions），**忘記 `git add` 工單檔案本身**
  - 17:29 push 成功（`6a9b5b5..ccce0f7 main -> main`）
  - 17:29 塔台在工單回報區填入 commit hash + push 結果（§218-220）
  - 檔案遺留在 working tree 中作為 `??`
- **根因**：前輪塔台 session **自行執行原本要派發 sub-session 的工作**（違反「塔台不直接做 chore」原則，GA001 的變體）+ 遺漏 `git add` 工單檔案本身（GA006 新發現）
- **推送狀態核實**：`HEAD == origin/main == ccce0f7`（實際已 push，工單檔案中第 36 行的「ahead by 4 commits」是寫工單當時的快照，已過期）

**PARTIAL 漂移分析**（留給下次塔台處理）：
| 工單 | 證據推測實際已完成 | 需要 |
|------|---------------------|------|
| T0005-promptbox-voice-ui | Phase 1 voice 觀察 9484 「完全實作並運行驗證」 | 補記為 DONE |
| T0013-fix-voice-download-ipc-drift | 觀察 9417 根因鎖定，後續未知 | 追蹤後續工單 |
| T0014-crash-safe-logging | BUG-004 經 T0017-β + T0015 解決 | 確認是否仍需獨立完成 |
| T0017-beta-audioworklet-migration | 觀察 9470 程式完成、L013 驗證 | 僅回報區沒補齊 |

### D027 決策：[A] 產生 T0023 歸檔孤兒工單
使用者選項 [A] — 派發 T0023-archive-orphan-workorder-t0022-prep-closure 歸檔孤兒工單。

### T0023 v1 執行（17:53）→ BLOCKED

Sub-session 在 Step 1.3 偵測到工作樹有**兩個**未追蹤檔案（T0022 + T0023 自己），違反工單前置條件「僅 T0022 為唯一變更」，依指示 STOP。

- ✅ **Sub-session 判斷完全正確** — 嚴格遵守「驗證失敗即 STOP」規則，未嘗試繞過
- ❌ **塔台工單設計錯誤** — 忽略「T0023 檔案本身是本 session 新產出的未追蹤檔案」這個事實，形成雞生蛋蛋生雞的悖論
- 🆕 **反模式名稱**：Self-containing workorder without accounting for self
- **Sub-session 提出的學習鉤子候選**（已採納）：
  > 工單流程層級衝突：`ct-exec` 要求「開工即更新工單狀態/開始時間」，但本工單 Step 1 又要求「僅允許 T0022 為唯一變更」。建議在前置條件明確排除「當前執行工單檔案」，或將狀態寫入延後到 Step 1 後。

### T0023 v2 修訂（17:56 塔台 → 18:08 sub-session 完成）

**塔台修訂策略**：改為「單一 atomic commit **納入兩張**孤兒工單」
- Step 1.3 預期改為「恰好兩個 `??`」精準比對（T0022 + T0023）
- Step 2 兩個獨立 `git add`（精準逐一）
- Commit message 說明 T0022 + T0023 + v1 BLOCK 故事 + L014 依據
- Step 4/6 驗證改為「恰好 2 個檔案」
- v1 BLOCK 歷史保留在工單的「v1 BLOCK 歷史」子段供未來學習

**T0023 v2 執行結果**（18:05 → 18:08，3 分鐘零 rollback）：
- ✅ Commit: `dc76077 chore(tower): archive orphan sync workorders (T0022-prep-closure + T0023)`
- ✅ Push: `ccce0f7..dc76077  main -> main`
- ⚠️ Pre-commit hook 觸發 WARN：`T0022-prep-closure-and-push.md:235` 的 `password=test123` 歷史描述字串觸發假陽性
  - Hook 設計為 warn-not-block → commit 正常通過
  - Sub-session 正確地在回報區記錄並升級為學習鉤子候選 → L017

### D028 決策：學習鉤子處理（A3）
- **候選 1**（self-containing workorder）→ **Global GA006**（跨專案通用反模式）✅ 已寫入 `~/.claude/control-tower-data/learnings/patterns.md`
- **候選 2**（pre-commit false positive 策略）→ **Project L017 + candidate: global 標記** ✅ 已寫入 `_ct-workorders/_learnings.md`

**分流依據**：
- GA006 是塔台 meta 層設計反模式，完全與具體專案無關 → 直接 Global
- L017 的策略通用但數據點引用本專案特有字串 → Project 先寫，等其他專案驗證再升級

### D029 決策：本 session 正式收尾（B1）

**由 T0024-session-closure 工單完成**：

| 檔案 | 動作 | Git 狀態 |
|------|------|---------|
| `_ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md` | ct-exec 填寫回報區 | `M`（本 session 已存在） |
| `_ct-workorders/_tower-state.md` | 本 checkpoint 追加 | `M`（本次修改） |
| `_ct-workorders/_learnings.md` | L017 追加 | `M`（本次修改） |
| `_ct-workorders/T0024-session-closure.md` | 塔台建立 | `??`（新檔） |
| `~/.claude/control-tower-data/learnings/patterns.md` | GA006 追加 | 不影響 repo（Layer 2，獨立 git 無關） |

**Sub-session T0024 任務**：
1. 驗證工作樹恰好 3 `M` + 1 `??`（精準比對）
2. 四檔原子 commit：`chore(tower): session closure checkpoint (T0023 + L017 + GA006 + state)`
3. Push `dc76077..<new-sha> main -> main`
4. Working tree clean
5. 不動 Global patterns.md（獨立管理）

### 本 session 產出 summary
- **派發工單**：1 張（T0023 v1 BLOCK → v2 成功）+ 1 張 closure（T0024）
- **新 git commit**：2 個（`dc76077` + 本 closure commit）
- **新學習**：Global GA006（1 條） + Project L017（1 條，含 candidate: global）
- ***sync 發現 4 張 PARTIAL 漂移** → 留給下次塔台 session 處理
- **Dogfood 成果**：本 session 全程在 better-agent-terminal 裡執行，驗證 `*sync` 命令、auto-session 剪貼簿降級、工單 v1→v2 修訂循環可行

### 🏆 L013 GOLDEN Rule 第 N 次連續驗證
L013 再次證明：**已知最佳方案時跳過分步驗證**的原則，在 T0023 v2 修訂時被應用 —— 塔台直接從 v1 的失敗訊號反推正解（原子打包），不做「先試小範圍修正」的中間步驟。

### 待下次塔台處理（NEXT SESSION TODO）
1. **T0022-playwright-e2e-infra-bootstrap**（Phase 2 infra 工單）派發
2. **4 張 PARTIAL 漂移**（T0005, T0013, T0014, T0017-beta）回報區補填
3. **GA006 第 2 次驗證**（等其他專案出現同類情境時確認升 🟢）
4. **L017 升級 Global 決策**（累積 2-3 次 hook false positive 實戰後）
5. **Dogfood bug 清單回顧**（BUG-007/008/009、UX-001 等從前次 session 登記的 backlog）

