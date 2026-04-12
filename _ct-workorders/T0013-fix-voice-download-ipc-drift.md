# 工單 T0013-fix-voice-download-ipc-drift

## 元資料
- **工單編號**：T0013
- **任務名稱**：Hotfix — `voice:downloadModel` IPC handler 未註冊(Phase 1 驗收阻斷)
- **狀態**：DONE
- **建立時間**：2026-04-11 09:55 (UTC+8)
- **開始時間**：2026-04-11 10:13 (UTC+8)
- **完成時間**：2026-04-11 10:18 (UTC+8)
- **類型**:🔥 Hotfix(阻斷 Phase 1 驗收)

## 工作量預估
- **預估規模**:小(典型 IPC channel 對齊 bug)
- **Context Window 風險**:低(範圍集中在 main process ipc 註冊 + preload + 1-2 個 renderer 呼叫點)
- **降級策略**:若根因涉及大範圍重構,回報 BLOCKED 等塔台決策

## Session 建議
- **建議類型**:🆕 新 Session
- **原因**:此工單需要 grep + 修改 + `npm run dev` runtime 驗證,乾淨的 context 最有效率

## 任務指令

### 前置條件
需載入的文件清單:
- 本工單(T0013)
- `_ct-workorders/T0004-whisper-integration.md` — whisper 整合工單,確認當初宣稱有哪些 IPC handler
- `_ct-workorders/T0009-voice-settings-page.md` — Settings 頁工單,確認 renderer 端呼叫的 channel 名稱
- (可選)`src/types/index.ts` 或等效的型別定義檔,確認 ElectronAPI 介面
- (可選)`electron/preload.ts` 或等效的 preload script
- (可選)`electron/main.ts` 或主 IPC 註冊所在檔案

### 輸入上下文

**專案**:better-agent-terminal(Electron + React + TypeScript)
**技術棧**:Electron main + preload + React renderer,IPC 走 `ipcMain.handle` + `ipcRenderer.invoke` + preload `contextBridge`
**Phase 1 語音輸入**:whisper-node-addon(file-based)+ OpenCC + Settings 模型管理

**當前狀態**:
- T0001-T0012 共 12 張工單全部 ✅ DONE(程式碼層)
- 使用者今早開始執行 Phase 1 手動驗收(T0011-user-testing-guide.md 32 項)
- **第一個測試就失敗**:打開 Settings 頁 → 模型管理 → 按任一模型「下載」按鈕

**錯誤訊息**(完整字串):
```
Error invoking remote method 'voice:downloadModel': Error: No handler registered for 'voice:downloadModel'
```

**影響範圍**(從使用者截圖):
- Tiny(77.7 MB) / Base(141 MB) / Small(466 MB) / Medium(1.43 GB)**4 個模型全部**無法下載
- 所有下載按鈕點下去都跳相同錯誤
- 預設模型 radio、語言偏好等後續測試項目全部無法繼續(因為沒有模型就無法錄音)

**塔台推測根因**(給 sub-session 參考,不要視為定論):
1. **跨工單 IPC contract drift** — T0004(main)和 T0009(renderer)分別在不同 sub-session 完成,各自通過 build,但 channel 命名可能不一致
2. **可能的不一致位置**:
   - Renderer 呼叫 `window.electronAPI.voice.downloadModel(...)` → 走 channel `voice:downloadModel`
   - Main 註冊的 handler channel 可能是 `voice:download-model` / `voice:model-download` / 其他變體
   - 或 handler 根本沒註冊(T0004 只實作了 transcribe,downloadModel 被漏掉 = mock 沒真實化)
   - 或 handler 檔案沒被 import / 沒掛載到主流程
3. **相關學習紀錄**:
   - **L007** - vite build 通過 ≠ 型別正確
   - **L008** - 平行工單必須明確檔案所有權邊界

### 工作範圍

#### 1. 調研(必做)

grep 整個專案的以下 channel 名稱,列出所有出現位置:
- `voice:downloadModel`(或任何變體:`voice:download-model`、`voice:modelDownload` 等)
- `voice:cancelDownload`(或變體)
- `voice:deleteModel`(或變體)
- `voice:listModels`(或變體)
- `voice:setPreference`(或變體)
- `voice:transcribe`(或變體)— 對照組,確認哪些 channel 有正確註冊
- 其他 `voice:` 開頭的 IPC channel

產出**對照表**:

| Channel(renderer 呼叫) | Channel(main 註冊) | 是否一致 | 註冊檔案路徑 |
|------------------------|---------------------|----------|--------------|
| voice:downloadModel    | ???                 | ❌       | ???          |
| ...                    | ...                 | ...      | ...          |

#### 2. 根因說明(必做)

在修復前,明確寫出:
- 為什麼 `voice:downloadModel` 沒被註冊?(命名不一致 / 漏註冊 / 沒掛載 / 其他)
- 這類問題為什麼在 build 時沒被發現?(型別系統沒覆蓋 IPC channel 字串 / preload 用 any / 其他)
- 是否還有其他同類潛在問題?(grep 對照表的結果)

#### 3. 修復(必做)

**修復原則**:
- **優先修 main 端**(對齊 renderer 的 channel 命名),**不要改 renderer 的命名**
  - 理由:T0009 Settings UI 已 ✅ DONE 且 UI 程式碼較複雜,動 renderer 容易引入回歸
  - 例外:若 renderer 端的命名明顯違反專案慣例(例如所有其他 channel 都用 kebab-case 只有這個用 camelCase),可反過來改 renderer 並在回報中說明
- **修好所有同類 drift**,不是只修 downloadModel。若對照表顯示還有其他 channel 不一致,**一次修完**
- 若發現 handler 根本沒寫,依 T0004 的原本規格補上(參考 T0004 完成報告或既有 whisper-node-addon 封裝)

**禁止**:
- 禁止動 T0005 / T0007 的麥克風錄音相關程式碼
- 禁止動 renderer 端的 Settings UI 元件(除非是 channel 命名修正,且需在回報中說明)
- 禁止新增功能(只修 IPC drift,不順手加任何東西)

#### 4. 驗證(必做,但允許降級)

**基本驗證**(必須通過):
- [ ] `npm run dev` 或等效啟動指令成功啟動 Electron
- [ ] 打開 Settings 頁 → 模型管理
- [ ] 點 Tiny 模型的「下載」按鈕
- [ ] **不再出現** `No handler registered for 'voice:downloadModel'` 錯誤
- [ ] 觀察到至少一次下載進度事件(debug.log 或 UI 進度條)
- [ ] 不需要完整下載 77.7 MB,觀察到進度事件即可,然後點取消或關閉 app

**加值驗證**(時間允許才做):
- [ ] 點下載 → 再點取消 → 驗證 `cancelDownload` handler 也正常工作
- [ ] 切換預設模型 radio → 驗證 `setPreference` 或等效 channel 正常
- [ ] 切換語言偏好 → 驗證正常
- [ ] 檢查 debug.log 有無其他 `No handler registered` 錯誤

**降級條件**:
- 若 runtime 環境受限(headless / 無 GUI)無法執行 `npm run dev`,回報 PARTIAL,只交付程式碼修復 + 對照表 + 根因說明,由使用者執行 runtime 驗證
- 參考 **L009**:GUI/硬體工單在 headless sub-session 無法 runtime 驗證

### 預期產出

1. **IPC channel 對照表**(寫在回報區)
2. **根因說明**(寫在回報區)
3. **修改的檔案清單**(寫在回報區,含每個檔案的變更摘要)
4. **驗證結果**(基本驗證必填,加值驗證選填)
5. **同類 drift 盤點結果**(有無其他 channel 不一致)

### 驗收條件
- [ ] 完成調研並產出 IPC channel 對照表(renderer vs main)
- [ ] 根因已明確說明(為什麼 `voice:downloadModel` 沒註冊、為什麼 build 沒抓到)
- [ ] 所有 `voice:*` channel drift 已一次修完(不是只修 downloadModel)
- [ ] `npm run dev` 啟動後,Settings → 模型管理 → Tiny 下載按鈕不再報 "No handler registered"
- [ ] 觀察到至少一次下載進度事件(證明 handler 真的被叫到而且有做事)
- [ ] 修復未動到 T0005(麥克風 UI)/ T0007(預覽框)的程式碼,避免回歸
- [ ] 修改的檔案清單完整列出
- [ ] 若 runtime 驗證受環境限制,回報 PARTIAL 並說明哪些驗證項目需要使用者接手

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示,都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 載入前置條件中的文件(T0004、T0009 的完成報告)
4. 執行「工作範圍 §1 調研」:grep 所有 voice:* channel 的使用位置
5. 產出 IPC channel 對照表
6. 執行「工作範圍 §2 根因說明」
7. 執行「工作範圍 §3 修復」:一次修完所有 drift
8. 執行「工作範圍 §4 驗證」:基本驗證必做,加值驗證選做
9. 填寫回報區(對照表 + 根因 + 修改檔案清單 + 驗證結果 + 同類 drift 盤點)
10. 更新「狀態」(DONE / PARTIAL / BLOCKED / FAILED)
11. 更新「完成時間」
12. 回塔台 session 告知「T0013 完成」

### 執行注意事項

- **不要修 T0005 / T0007 的程式碼**(麥克風錄音 + 預覽框 popover,都已 ✅ DONE,避免回歸)
- **不要改 renderer 端命名**(除非明顯違反專案慣例,且需說明理由)
- **修完所有 drift,不是只修 downloadModel**(一次性徹底解決)
- **`flushSync` 相關 React 渲染邏輯不要動**(見 CLAUDE.md)
- **Logging**:renderer 用 `window.electronAPI.debug.log(...)`,main 用 `logger.log(...)`,不要用 `console.log`(見 CLAUDE.md)
- **No Regressions Policy**:提交前跑 `npx vite build` 確認編譯成功(見 CLAUDE.md)

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
PARTIAL

### IPC Channel 對照表

| Channel(renderer 呼叫) | Channel(main 註冊) | 是否一致 | 註冊檔案路徑 | 備註 |
|------------------------|---------------------|----------|--------------|------|
| voice:listModels | voice:listModels | ✅ | `electron\voice-handler.ts` | 由 `VOICE_IPC_CHANNELS.listModels` 共用常數 |
| voice:isModelDownloaded | voice:isModelDownloaded | ✅ | `electron\voice-handler.ts` | 由 `VOICE_IPC_CHANNELS.isModelDownloaded` 共用常數 |
| voice:downloadModel | voice:downloadModel | ✅ | `electron\voice-handler.ts` | 由 `VOICE_IPC_CHANNELS.downloadModel` 共用常數 |
| voice:deleteModel | voice:deleteModel | ✅ | `electron\voice-handler.ts` | 由 `VOICE_IPC_CHANNELS.deleteModel` 共用常數 |
| voice:cancelDownload | voice:cancelDownload | ✅ | `electron\voice-handler.ts` | 由 `VOICE_IPC_CHANNELS.cancelDownload` 共用常數 |
| voice:getPreferences | voice:getPreferences | ✅ | `electron\voice-handler.ts` | 由 `VOICE_IPC_CHANNELS.getPreferences` 共用常數 |
| voice:setPreferences | voice:setPreferences | ✅ | `electron\voice-handler.ts` | 專案實際 channel 為複數 `setPreferences` |
| voice:transcribe | voice:transcribe | ✅ | `electron\voice-handler.ts` | 由 `VOICE_IPC_CHANNELS.transcribe` 共用常數 |
| voice:getModelsDirectory | voice:getModelsDirectory | ✅ | `electron\voice-handler.ts` | 由 `VOICE_IPC_CHANNELS.getModelsDirectory` 共用常數 |
| voice:modelDownloadProgress(事件) | voice:modelDownloadProgress(事件) | ✅ | `electron\voice-handler.ts` | main `webContents.send` 與 preload `ipcRenderer.on` 對齊 |

### 根因說明
1. `registerVoiceHandlers(getAllWindows)` 原本掛在 `registerLocalHandlers()`，於 module 初始化階段執行；但 `registerVoiceHandlers` 內第一步會呼叫 `ensureMicrophonePermission()`，依賴 `session.defaultSession`。這使 voice handler 註冊對啟動時序敏感，一旦該步驟在不安全時機失敗，後續 `voice:*` handlers 會漏註冊，renderer 呼叫 `voice:downloadModel` 就會得到 `No handler registered`。
2. `voice:*` channel 字串原本分散於 `electron/preload.ts` 與 `electron/voice-handler.ts` 的多個 literal。TypeScript 無法跨檔案驗證這些字串是否完全一致，也無法檢查 IPC 註冊時序，因此 `vite build` 不會攔截此類 drift/時序問題。
3. 本次修正：將 voice handler 註冊移到 `app.whenReady()` 後執行，並新增 `src/types/voice-ipc.ts` 作為單一 channel source，preload/main 全部改為共用常數。

### 產出摘要
- `electron\main.ts`
  - 將 `registerVoiceHandlers(getAllWindows)` 從 `registerLocalHandlers()` 移到 `app.whenReady()`，避免在 app 未 ready 時觸發 voice 註冊流程。
- `src\types\voice-ipc.ts` (新增)
  - 新增 `VOICE_IPC_CHANNELS`，集中定義全部 `voice:*` invoke/event channel。
- `electron\preload.ts`
  - `window.electronAPI.voice.*` 的 invoke/on 全數改用 `VOICE_IPC_CHANNELS` 常數，消除 renderer/main 字串漂移風險。
- `electron\voice-handler.ts`
  - `ipcMain.handle(...)` 與 `webContents.send(...)` 全數改用 `VOICE_IPC_CHANNELS` 常數，與 preload 對齊。
- 未修改 T0005/T0007(麥克風 UI / 預覽框 popover)相關程式碼。

### 同類 Drift 盤點結果
- 盤點結果：`voice:listModels / isModelDownloaded / downloadModel / deleteModel / cancelDownload / getPreferences / setPreferences / transcribe / getModelsDirectory / modelDownloadProgress` 現在全部一致。
- 未發現 `voice:download-model`、`voice:modelDownload`、`voice:setPreference` 等變體被使用。
- 同類 drift 已一次性修復：`voice:*` channel 改為單一常數來源，後續不再靠雙邊手寫字串。

### 驗證結果

**基本驗證**(必填):
- [x] `npm run dev` 啟動成功
- [ ] Settings → 模型管理 → Tiny 下載 → 不再報 "No handler registered"
- [ ] 觀察到下載進度事件

**加值驗證**(選填):
- [ ] cancelDownload 正常
- [ ] setPreference 正常
- [ ] 語言偏好切換正常

補充:
- [x] `npx vite build` 編譯通過
- `npm run dev` 日誌可見 `[voice] IPC handlers registered`，證明 voice handlers 已掛載；但本 session 無法進行 GUI 點擊驗證，Tiny 下載流程需塔台端實機覆驗。

### 互動紀錄
無額外交互；依工單規格直接執行。

### 遭遇問題
目前 session 無法完成 GUI 手動點擊流程，故無法在此環境直接完成 Tiny 下載按鈕與進度條的端到端驗證；請塔台端接手執行該兩項實機驗證。

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-11 10:18 (UTC+8)
