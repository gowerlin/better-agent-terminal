# 工單 T0001-voice-input-tech-research

## 元資料
- **工單編號**：T0001
- **任務名稱**：語音輸入功能技術評估 — VSCode Speech 調研 × whisper.cpp 整合可行性 × Electron 架構設計
- **狀態**：DONE
- **類型**：RESEARCH / DESIGN（純研究工單，不寫實作程式碼）
- **建立時間**：2026-04-10 22:23 (UTC+8)
- **開始時間**：2026-04-10 22:29 (UTC+8)
- **完成時間**：2026-04-10 22:38 (UTC+8)
- **目標子專案**：（單一專案，留空）

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中（需讀 preload.ts / main.ts / electron.d.ts 幾個關鍵檔案，以及多次 WebFetch）
- **降級策略**：若 Context Window 不足，優先完成 §A/§B/§C 核心技術評估，§D 架構設計可標記 PARTIAL 並產生接續工單

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：本工單需要 fresh context 執行多次 WebFetch、WebSearch 以驗證外部技術資訊，且不應汙染塔台 session

---

## 任務指令

### 前置條件

**必須載入的專案檔案**（了解現狀）：
- `electron/preload.ts`（IPC bridge 暴露方式）
- `electron/electron.d.ts`（ElectronAPI 介面定義）
- `electron/main.ts`（main process 入口）
- `src/components/PromptBox.tsx`（語音輸入最終要整合到這裡）
- `src/components/MainPanel.tsx`（確認 PromptBox 條件渲染邏輯）
- `package.json`（確認目前依賴、Electron 版本、建置工具）

**必須執行的外部資訊蒐集**（使用 WebFetch / WebSearch）：
- VS Code Speech 擴充套件（`ms-vscode.vscode-speech`）的官方文件 / GitHub
- whisper.cpp 最新 release（https://github.com/ggml-org/whisper.cpp）
- whisper.cpp Node.js / Electron 整合方式（node bindings、WASM、child_process 呼叫 binary）
- faster-whisper 作為備選方案比較
- Whisper 模型檔案大小與準確度對照表（tiny / base / small / medium / large）
- Electron 取得麥克風權限的正確做法（`session.setPermissionRequestHandler` 等）

---

### 輸入上下文

**專案背景**：
- 專案名稱：better-agent-terminal
- 技術棧：Electron + React + TypeScript + Vite
- 特性：這是一個**類 Claude Code 的終端 UI**，同時支援多個 agent terminal 和 claude-code terminal，每個 terminal 都有獨立的對話介面
- IPC 架構：renderer 透過 `window.electronAPI.*`（由 `preload.ts` 透過 `contextBridge` 暴露）呼叫 main process；特權操作（檔案系統、剪貼簿、PTY、Git）都走此模式
- 目前 `ElectronAPI` 介面**完全沒有** audio / media device 相關 API，需從零設計

**需求脈絡**：
- 目標是在 PromptBox（對話輸入框）加入**語音輸入**，體驗類似 VSCode Speech
- **核心原則：語音辨識完成後絕對不自動提交**，使用者必須手動送出

**已對齊的需求決策**（使用者已確認，本工單必須以此為設計前提）：

| 維度 | 決策 |
|------|------|
| **引擎方向** | 傾向本地 Whisper（類似 VSCode 做法），但需要本工單驗證可行性並提供備選比較 |
| **隱私/離線** | **優先離線**，不接受雲端 API 作為唯一路線 |
| **語言支援** | **繁中為主 + 英文**，支援多語言自動偵測，使用者可手動切換當前語言 |
| **UI 觸發** | **麥克風按鈕 + 快捷鍵並存**，按鈕以 **toggle 模式**運作（點擊開始、再點一次結束），非 push-to-talk |
| **結果呈現** | **預覽框確認後才進入 textarea**（精確度 > 速度體驗），支援即時串流顯示於預覽框給使用者回饋，但**不自動送出**到 textarea，使用者點確認才填入 |
| **模型大小** | **使用者可在 Settings 選擇**，預設 `small`，需提供 tiny/base/small/medium 四個選項 |
| **模型下載策略** | **Settings 頁提供下載按鈕**，未下載前麥克風按鈕禁用並顯示提示；不內建於安裝包、不自動下載 |
| **套用範圍** | Agent terminal 的 PromptBox 為**必做**；claude-code terminal 為**如可行則做**（需本工單評估） |

**已知限制**：
- Claude Code terminal 有自己的 UI，可能無法直接注入 PromptBox 的語音功能 — 本工單要評估可行性，給出結論
- 使用者尚未決定快捷鍵具體按鍵（本工單需給出建議，含與 VSCode/Electron 既有快捷鍵的衝突檢查）

---

### 盤點任務清單

**§A. VSCode Speech 技術底層調研**

產出回答以下問題（有來源引用）：
1. VS Code Speech 擴充實際用的是什麼引擎？是 Whisper 嗎？版本？
2. 模型是本地還是雲端？檔案大小？
3. 是否開放給第三方 Extension API 重用？還是封閉於 Copilot Chat？
4. 授權條款是什麼？可商用？可嵌入自己的 Electron App？
5. 如果不能直接用，第三方要重現類似體驗的最佳路線是什麼？

**§B. whisper.cpp 整合可行性評估**

評估以下三種整合路線，給出**詳細比較表**：

| 路線 | 描述 | 評估項目 |
|------|------|---------|
| **路線 A：Node binding**（`nodejs-whisper`、`whisper-node` 等 npm 套件） | renderer 或 main process 直接 `require` 呼叫 | 維護狀態、平台相容性、打包複雜度、效能 |
| **路線 B：編譯 binary + child_process** | main process 打包 `whisper.cpp` 原生 binary，透過 `child_process.spawn` 呼叫 | 跨平台編譯難度、安裝包體積、效能、更新機制 |
| **路線 C：WASM / Web Worker** | renderer 直接在瀏覽器環境跑 whisper WASM | 模型下載、首次啟動時間、記憶體使用、GPU 加速可能性 |

每條路線必須涵蓋：
- 目前主流 npm 套件/實作（列出 2-3 個）、Star 數、最後更新時間
- Electron 打包注意事項（electron-builder / forge / vite 配置）
- Windows / macOS / Linux 三平台支援狀態
- 效能實測參考數據（辨識 10 秒中文音訊需要幾秒？）
- License 條款
- **推薦等級**：⭐ 最推薦 / 👍 可接受 / ⚠️ 不建議，並說明理由

**§C. 備選方案評估**

除了 whisper.cpp，評估至少兩個備選：
- **faster-whisper**（Python + CTranslate2）透過 child_process 呼叫
- **Web Speech API**（瀏覽器內建）作為快速原型路線
- **OpenAI Whisper API / Azure Speech**（雲端，僅作為極端 fallback）

每個備選列出：適用情境、優缺點、與本專案「離線優先」目標的契合度。

**§D. Electron IPC 架構設計**

為語音輸入功能設計完整的 IPC 介面（**僅設計，不實作**）：

1. **`ElectronAPI` 擴充設計**：定義需要新增的 `audio` / `voice` 命名空間介面，例如：
   ```typescript
   // 範例格式，實際設計可調整
   voice: {
     isModelDownloaded(modelSize: string): Promise<boolean>;
     downloadModel(modelSize: string, onProgress: (pct: number) => void): Promise<void>;
     startRecording(): Promise<{ sessionId: string }>;
     stopRecording(sessionId: string): Promise<{ text: string; segments: TranscriptSegment[] }>;
     // ... 等等
   }
   ```
2. **Main process 端職責分工**：哪些操作由 main process 處理？哪些由 renderer 處理？
3. **麥克風權限取得流程**：Electron `session.setPermissionRequestHandler` 的正確實作
4. **模型檔案儲存位置**：使用 `app.getPath('userData')` 的哪個子目錄？
5. **即時串流機制**：辨識過程中如何把 partial 結果從 main process 推回 renderer？（`webContents.send` / IPC event 命名）
6. **錯誤處理策略**：模型未下載、麥克風權限被拒、辨識失敗等情境的處理流程

**§E. UI/UX 設計草稿**

產出以下內容（純文字描述 + ASCII mockup，不寫 React code）：
1. PromptBox 內麥克風按鈕的位置（相對於現有送出按鈕、圖片貼上按鈕等）
2. 錄音中的視覺狀態（按鈕變色？呼吸動畫？顯示音量波形？）
3. 預覽框的位置（PromptBox 上方？浮動 popover？）
4. 預覽框內應顯示哪些資訊（即時文字、信心分數、偵測到的語言、段落計數？）
5. 「確認」與「取消」按鈕的位置
6. Settings 頁新增「語音輸入」區塊的資訊架構：模型選擇、下載狀態、下載按鈕、快捷鍵設定、當前語言偏好
7. **快捷鍵建議**：列出 3 個候選（含與 Electron / React / 現有快捷鍵的衝突檢查），標註推薦項

**§F. claude-code terminal 整合可行性**

調查專案內 claude-code terminal 的 UI 架構：
1. claude-code terminal 的輸入介面如何運作？是 xterm.js 嗎？還是自訂 React 元件？
2. 是否有攔截鍵盤輸入、注入文字的既有機制？
3. 若要為 claude-code terminal 加語音輸入，最小改動路線是什麼？
4. 結論：**可行 / 部分可行 / 不建議**，並說明原因

**§G. 風險清單與前置決策**

條列出要進入實作前，塔台必須先決定的開放問題，例如：
- 「打包後安裝包體積增加多少可接受？」
- 「是否接受額外的原生模組編譯步驟（會拖慢 CI）？」
- 「是否需要支援 GPU 加速？若是 Windows 要額外處理 CUDA/DirectML 嗎？」
- 「預設模型要不要在第一次 App 啟動就開始背景下載？」
- 任何本工單執行過程中新發現的未決議題

---

### 預期產出

**單一交付文件**：`_ct-workorders/reports/T0001-voice-input-tech-research.md`

文件結構必須與本工單 §A 到 §G 對應，每節內容完整並附來源引用。內容長度預估 1500~3000 行 markdown。

> 💡 目錄 `_ct-workorders/reports/` 若不存在，請 sub-session 自行建立。

**附加要求**：
- 所有外部資訊（GitHub repo、文件頁面）必須附 URL 連結
- 版本號資訊必須標註查詢時間（因本專案知識可能過時）
- 比較表必須有明確的「推薦」/「不推薦」結論，不要只列事實

---

### 驗收條件

- [ ] §A VSCode Speech 調研完成，能回答工單列出的 5 個問題，每題有來源引用
- [ ] §B whisper.cpp 三條整合路線均有比較表，每條路線有明確推薦等級
- [ ] §B 提及的 npm 套件列出 Star 數、最後 commit 日期，避免推薦已死專案
- [ ] §C 至少有 2 個備選方案的完整評估
- [ ] §D ElectronAPI 介面設計使用 TypeScript 型別定義撰寫（可貼入 electron.d.ts）
- [ ] §D 的 IPC 設計涵蓋麥克風權限、模型下載、即時串流、錯誤處理四大場景
- [ ] §E UI 設計草稿含 ASCII mockup 或文字描述可讓後續實作者直接開工
- [ ] §E 提供至少 3 個快捷鍵候選並標註衝突檢查結果
- [ ] §F claude-code terminal 可行性評估有明確結論（可行 / 部分可行 / 不建議）
- [ ] §G 列出至少 5 個本工單完成後、實作開始前塔台需決策的開放問題
- [ ] 文件末尾有「總結與推薦路線」段落，給出一句話建議：塔台下一步該做什麼
- [ ] **未修改任何專案原始碼**（本工單純研究 + 設計，禁止 code change）

---

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間（台北時區 UTC+8，可用 `pwsh -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"`）。
> 完成後請填寫下方「回報區」。無論成功、失敗、部分完成或需要後續指示，都必須填寫。

### 執行步驟

1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 載入前置條件中的**專案檔案**（純 Read，不修改）
4. 使用 WebFetch / WebSearch 執行外部資訊蒐集
5. 依 §A → §B → §C → §D → §E → §F → §G 順序執行
6. 產出最終報告文件 `_ct-workorders/reports/T0001-voice-input-tech-research.md`
7. 自我檢查驗收條件清單
8. 填寫本工單回報區
9. 更新「狀態」（DONE / FAILED / BLOCKED / PARTIAL）
10. 更新「完成時間」

### 執行注意事項

- **不要寫任何實作程式碼**：本工單是純研究和設計工單，只產出 `.md` 報告，絕對不要動 `.ts` / `.tsx` 檔案
- **不要安裝任何 npm 套件**：只蒐集資訊，不實際 `npm install`
- **版本敏感資訊必須查證**：whisper.cpp、electron、vscode-speech 等版本資訊不要依賴訓練知識，必須 WebFetch 驗證
- **遇到無法確定的技術問題**：記錄到回報區「遭遇問題」，不要自己猜；塔台會派發後續調研工單
- **若發現已對齊需求有技術上的矛盾**（例如 toggle 模式 + 即時串流有衝突）：停下來記錄到回報區，等塔台決策

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
- **產出檔案**：`_ct-workorders/reports/T0001-voice-input-tech-research.md`（完整研究報告，§A~§G 七大區塊）
- **推薦路線**：whisper-node-addon (N-API binding) + whisper.cpp small 模型，先在 Agent terminal PromptBox 實作
- **推薦快捷鍵**：`Alt+M`（無衝突、好記）
- **claude-code terminal**：部分可行（可注入文字，但預覽確認流程需額外 UI）

### 互動紀錄
無（執行過程中無需向使用者確認的決策點）

### 遭遇問題
1. npm 官網 (npmjs.com) 的 WebFetch 返回 403，改用 GitHub repo 取得套件資訊
2. VS Code Speech 的技術底層（Azure Speech SDK）文件非常封閉，無法取得引擎實作細節
3. `electron/electron.d.ts` 不存在，實際型別定義位於 `src/types/electron.d.ts`（工單描述的前置條件路徑不準確）

### 關鍵發現亮點
1. **VS Code Speech 使用 Azure Speech SDK，非 Whisper** — 不可嵌入第三方 Electron App，必須自建
2. **whisper-node-addon 是唯一同時支援串流 + prebuilt binary + Electron zero-config 的套件**，但 Stars 僅 14，標記為 experimental
3. **Whisper small 模型是繁中場景的最佳平衡** — 466 MB 磁碟、~852 MB RAM、多語 WER ~7%
4. **macOS 打包缺少 NSMicrophoneUsageDescription** — package.json extendInfo 需新增麥克風權限描述
5. **claude-code terminal 可透過 pty.write 注入文字，但無法實現預覽確認流程** — 建議 Phase 2 處理

### sprint-status.yaml 已更新
不適用（本專案無 BMad sprint-status）

### 回報時間
2026-04-10 22:38 (UTC+8)
