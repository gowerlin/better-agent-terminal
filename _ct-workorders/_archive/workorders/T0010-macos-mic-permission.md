# 工單 T0010-macos-mic-permission

## 元資料
- **工單編號**：T0010
- **任務名稱**：macOS `NSMicrophoneUsageDescription` Info.plist 配置 + 跨平台麥克風權限行為確認與文件
- **狀態**：DONE
- **類型**：CONFIG(電子打包配置 + 跨平台權限處理)
- **建立時間**：2026-04-11 01:43 (UTC+8)
- **開始時間**：2026-04-11 01:42 (UTC+8)
- **完成時間**：2026-04-11 01:47 (UTC+8)
- **前置工單**:T0003(已實作 `ensureMicrophonePermission()` session handler)

## 工作量預估
- **預估規模**:小(S)— 主要是配置檔修改 + 可選的 main process 小增強
- **Context Window 風險**:低
- **降級策略**:若找不到 electron-builder 設定,stop 並回報,不要自己建配置檔

## Session 建議
- **建議類型**:🆕 新 Session
- **原因**:fresh context 執行配置 + build 驗證

## 檔案所有權

| 路徑 | 所有權 | 說明 |
|------|--------|------|
| `package.json` 或 `electron-builder.yml` / `.json` / `.config.*` | **T0010 獨占** | macOS build.mac.extendInfo 配置 |
| `electron/main.ts` | **T0010 可小幅修改** | 若要加 macOS 權限預檢(可選) |
| `electron/voice-handler.ts` | **T0010 可小幅修改** | 若要強化 `ensureMicrophonePermission` 的 macOS 分支(可選) |
| `src/components/**` | **禁止** | 不碰 renderer |
| `src/lib/voice/*` | **唯讀** | T0003 產出 |
| `src/hooks/useVoiceRecording.ts` | **禁止** | T0005/T0007 共用 |

---

## 任務指令

### 任務定位

解決**最後一塊打包卡點**:若沒有 `NSMicrophoneUsageDescription` Info.plist entry,**macOS 打包後的 app 執行到 `getUserMedia` 時會直接 crash**(或系統拒絕,視 macOS 版本而定)。

這是 T0001 §D 原本就列為必做項目,但當時延後到本工單處理。

**三個目標**:
1. ✅ 加上 Info.plist 的麥克風權限描述字串(**必做**)
2. ✅ 記錄跨平台行為(Windows / Linux 的差異)
3. 🎁 (可選 bonus)macOS 第一次啟動時主動預請求權限

---

### 前置條件

**必讀文件**:
- `CLAUDE.md`(No Regressions、Logging 規範)
- `_ct-workorders/reports/T0001-voice-input-tech-research.md` §D「麥克風權限取得流程」段落
- `_ct-workorders/T0003-voice-ipc-foundation.md` 回報區的「給 T0004 的備註」第 5 點「麥克風權限已安裝」

**必讀專案檔案**:
- `package.json`(找 `build` 或 `electron-builder` 區塊)
- 可能存在的獨立配置:`electron-builder.yml` / `electron-builder.json` / `electron-builder.config.js/cjs/mjs/ts`
- `electron/main.ts`(了解 app 啟動流程)
- `electron/voice-handler.ts` 的 `ensureMicrophonePermission()` 函式(T0003 已實作的 session handler)

---

### 輸入上下文

### 背景知識:macOS 麥克風權限如何運作

**macOS 10.14+ (Mojave) 開始**:
1. App 要存取麥克風**必須**在 Info.plist 有 `NSMicrophoneUsageDescription` 字串
2. 沒有的話:app 執行到 `AVAudioSession` 或 `getUserMedia` 時**直接被系統殺掉**(SIGKILL),沒有任何錯誤可捕捉
3. 有的話:系統在首次存取時彈出權限對話框,顯示 Info.plist 的那段字串給使用者看

**字串建議**:
- 要**解釋用途**,讓使用者知道為什麼 app 要麥克風
- 建議繁中 + 英文雙語
- 範例:「better-agent-terminal 需要存取麥克風以提供語音輸入功能。」/ "better-agent-terminal needs microphone access for voice input feature."

### 背景知識:Electron + macOS 權限 API

Electron 提供的相關 API:
- `systemPreferences.getMediaAccessStatus('microphone')` — 查詢當前權限狀態(not-determined / granted / denied / restricted / unknown)
- `systemPreferences.askForMediaAccess('microphone')` — 明確請求權限(macOS 10.14+),回傳 Promise<boolean>
- `session.setPermissionRequestHandler` — Chromium 層的權限處理(T0003 已實作)

**順序**:
1. App 啟動 → 檢查 `getMediaAccessStatus` → 若 `not-determined`,可以**提前**呼叫 `askForMediaAccess` 主動請求(bonus)
2. 首次使用麥克風時(getUserMedia)→ Chromium 層觸發 `setPermissionRequestHandler`(T0003 已處理)+ 系統層彈出對話框(需要 Info.plist)
3. 使用者允許 → 後續使用 no prompt
4. 使用者拒絕 → 後續呼叫會失敗,需要使用者手動到 System Preferences > Security & Privacy 開啟

### 跨平台對照

| 平台 | Info.plist 需要? | 執行時行為 |
|------|----------------|-----------|
| **macOS** 10.14+ | ✅ **必要**,沒有會 crash | 首次 getUserMedia 彈系統對話框 |
| **Windows** 10+ | ❌ 不需要 | Chromium 層處理,或 Windows 10 Privacy Settings |
| **Linux** | ❌ 不需要 | PulseAudio/PipeWire 處理,通常無 prompt |

**Windows 補充**:Windows 10/11 有「麥克風存取權」的隱私設定(Settings > Privacy > Microphone),若使用者**關閉**了全域麥克風存取,Electron 也無法取得。這是使用者層的設定,**app 無法以程式方式開啟**,只能提示使用者自行處理。

---

### 工作範圍

#### §1 — 找到 electron-builder 配置並新增 NSMicrophoneUsageDescription

**步驟**:

1. **定位 electron-builder 配置**:
   - 先看 `package.json` 的 `build` 區塊
   - 若無或不完整,搜尋 `electron-builder.*` 檔案
   - **找不到時:停下回報**,不要自己建一個新配置檔

2. **新增 macOS Info.plist entry**:

   **若使用 `package.json` 的 build 區塊**:
   ```json
   {
     "build": {
       "mac": {
         "extendInfo": {
           "NSMicrophoneUsageDescription": "better-agent-terminal 需要存取麥克風以提供語音輸入功能,將語音辨識後填入輸入框。/ better-agent-terminal needs microphone access for voice input feature, transcribing speech into the input textarea."
         }
       }
     }
   }
   ```

   **若使用獨立 `electron-builder.yml`**:
   ```yaml
   mac:
     extendInfo:
       NSMicrophoneUsageDescription: >-
         better-agent-terminal 需要存取麥克風以提供語音輸入功能,將語音辨識後填入輸入框。
         / better-agent-terminal needs microphone access for voice input feature,
         transcribing speech into the input textarea.
   ```

3. **若既有配置已有 `extendInfo`**(例如 camera、app category 等),**合併**新條目,**不要覆寫整個 extendInfo 物件**

4. **確認 bundle ID**(順便檢查):macOS 應用程式需要 `appId`(bundle identifier),若缺失要提醒但**本工單不補**(屬於另一個議題)

**驗收**:
- [ ] 找到 electron-builder 配置並正確新增 `NSMicrophoneUsageDescription`
- [ ] 現有 `extendInfo` 的其他 key 未被破壞
- [ ] `npx vite build` 通過(配置修改不影響 TS 編譯)
- [ ] 若有獨立 build script 可執行(`npm run build:mac` 或類似),執行 dry-run 或 linter 確認配置語法正確

---

#### §2 — 跨平台行為文件化

**步驟**:

1. 在專案的 **DOCS 目錄** 或 **README 語音區塊** 或 **新增 `docs/voice-input.md`**(依專案既有文件組織決定),新增一段「跨平台麥克風權限」說明:

   ```markdown
   ## 跨平台麥克風權限

   ### macOS
   - 首次使用時會彈出系統權限對話框
   - 拒絕後可至「系統偏好設定 > 安全性與隱私 > 麥克風」重新授權
   - 要求 macOS 10.14 (Mojave) 以上

   ### Windows
   - 首次使用時 Chromium 觸發權限對話框
   - 若系統層全域麥克風存取關閉,請至「設定 > 隱私 > 麥克風」開啟
   - Windows 10/11 原生支援

   ### Linux
   - 依 PulseAudio / PipeWire 設定
   - 首次使用時通常無需額外操作
   - 若無法存取,請確認 `pactl` / `pipewire` 服務運作正常
   ```

2. **若專案目前沒有任何使用者文件**,**不要**建 `docs/` 目錄;改為把這段說明加到:
   - `README.md` 的 Features 或 Troubleshooting 區段
   - 或 CLAUDE.md 的語音相關段落(若適合)
   - 或工單回報區(最差情況,塔台收到後會決定如何處理)

**驗收**:
- [ ] 跨平台權限說明寫進專案的某個文件位置
- [ ] 文件語言為繁中(符合專案慣例)

---

#### §3 — (可選 bonus)macOS 主動預請求權限

**背景**:Electron 的預設流程是「使用者按麥克風按鈕 → `getUserMedia` → 系統對話框」,這樣比較被動。**主動預請求**可以改善 UX:

1. App 啟動後檢查 macOS 權限狀態
2. 若狀態為 `not-determined`(使用者從未選擇),**主動**呼叫 `askForMediaAccess('microphone')`
3. 系統對話框彈出(與 getUserMedia 觸發的一樣)
4. 使用者此時選擇 → 狀態記錄
5. 後續點麥克風按鈕直接進入錄音,無需再次 prompt

**實作位置建議**:
- `electron/voice-handler.ts` 的 `ensureMicrophonePermission()` 內部
- 或 `electron/main.ts` 的 `app.whenReady()` 之後
- 使用 `process.platform === 'darwin'` 檢查

**範例**(在 `ensureMicrophonePermission` 中):
```typescript
import { systemPreferences } from 'electron';

async function ensureMicrophonePermission() {
  // 既有 session.setPermissionRequestHandler 邏輯(T0003)

  // T0010 新增:macOS 預請求
  if (process.platform === 'darwin') {
    try {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      logger.log(`[voice] macOS microphone status: ${status}`);
      if (status === 'not-determined') {
        // 不要在啟動時立即彈 — 等使用者第一次點麥克風按鈕時再觸發
        // 所以實際上這裡只是記錄狀態,不主動請求
        logger.log('[voice] macOS microphone permission not determined yet');
      }
    } catch (err) {
      logger.error('[voice] macOS permission check failed', err);
    }
  }
}
```

**或者**,在 `voice:startRecording` / `voice:transcribe` 等第一次使用的 handler 入口做檢查。但 T0003 的 handler 都是 `voice:*`,主要的麥克風存取發生在 **renderer 的 `getUserMedia`**,main process 無法直接攔截。

**結論**:bonus 的實際價值有限,因為主要權限請求發生在 renderer 層。**建議只做狀態日誌記錄,不做主動預請求**。讓系統對話框在使用者點麥克風按鈕時自然彈出即可。

**驗收**(若實作 bonus):
- [ ] macOS 平台:log 出當前權限狀態
- [ ] Windows / Linux:跳過,不執行(避免 systemPreferences API 在非 macOS 平台的錯誤)
- [ ] `npx vite build` 通過

---

### 不在本工單範圍

- ❌ 不動 renderer 任何檔案
- ❌ 不動 `src/lib/voice/*` 或 `useVoiceRecording` hook
- ❌ 不補缺少的 bundle ID(另議題)
- ❌ 不做 Windows 10 Privacy Settings 的自動偵測(使用者層設定,app 無法干預)
- ❌ 不實作「主動預彈權限」(因為主要觸發點在 renderer,意義不大)
- ❌ 不碰 PromptBox / MicButton / VoicePreviewPopover / Settings 頁
- ❌ 不新增 npm 依賴

---

### 驗收條件

- [ ] **Build 驗證**:`npx vite build` 三階段全通過(雖然配置修改通常不影響 vite,但驗證安全)
- [ ] **No Regression**:Electron app 啟動成功,既有功能無破壞
- [ ] **§1 Info.plist 配置**:`NSMicrophoneUsageDescription` 正確新增,不覆寫既有 `extendInfo`
- [ ] **§2 文件**:跨平台權限說明寫入專案文件某處
- [ ] **§3 bonus**(可選):macOS 權限狀態日誌(若實作)
- [ ] **檔案所有權**:未觸碰禁止區(renderer/src/*)
- [ ] **日誌合規**:無 `console.log`,新增程式碼用 `logger.log` / `logger.error`
- [ ] **文件語言**:繁中(符合專案慣例)

---

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。

### 執行步驟

1. 讀取本工單全部內容
2. 讀取 `CLAUDE.md`
3. 讀取 `package.json` 的 build 區塊(若有)
4. Glob 搜尋其他 electron-builder 配置檔
5. 讀取 `electron/voice-handler.ts` 的 `ensureMicrophonePermission()` 實作
6. 讀取 `electron/main.ts` 相關啟動邏輯
7. 更新「開始時間」欄位
8. **§1 → §2 → §3(可選)順序**執行
9. `npx vite build` 驗證
10. 填寫回報區,更新狀態與完成時間

### 執行注意事項

- **合併而非覆寫**:若既有 `extendInfo` 有其他 key,必須**合併**新條目
- **找不到 electron-builder 配置**:停下回報,不要自己建新配置檔(可能有其他原因)
- **字串語言**:使用者是華語開發者,字串使用繁中為主 + 英文補充
- **bonus §3 的取捨**:若實作後發現會干擾既有 `ensureMicrophonePermission` 邏輯,**放棄 bonus**,保持最小改動
- **headless 環境**:runtime 驗證(macOS 彈權限對話框)**無法**在 sub-session 執行,延後到 T0011 的「macOS 麥克風測試」情境
- **若當前開發環境為 Windows**:sub-session 應該無法實測 macOS 行為,只能做配置正確性驗證 + 靜態檢查

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**新增檔案**:
無

**修改檔案**:
- `package.json` — `build.mac.extendInfo` 新增 `NSMicrophoneUsageDescription`（合併到既有 3 個 key 旁，未覆寫）
- `README.md` — 「設定」區段新增「語音輸入 — 跨平台麥克風權限」子章節（macOS / Windows / Linux 三平台說明）
- `electron/voice-handler.ts` — import 新增 `systemPreferences`；`ensureMicrophonePermission()` 尾部新增 macOS 權限狀態日誌（`getMediaAccessStatus('microphone')`）

**Info.plist 新增內容**:
```json
"NSMicrophoneUsageDescription": "better-agent-terminal 需要存取麥克風以提供語音輸入功能，將語音辨識後填入輸入框。/ better-agent-terminal needs microphone access for voice input feature, transcribing speech into the input textarea."
```

### 互動紀錄
無

### 遭遇問題
無

### 找到的 electron-builder 配置位置
`package.json` 的 `build` 區塊（第 81-145 行）。無獨立 electron-builder 配置檔。`appId` 已存在：`org.tonyq.better-agent-terminal` ✅

### 跨平台文件寫入位置
`README.md`「設定」區段 > 「語音輸入 — 跨平台麥克風權限」子章節

### §3 bonus 執行狀態
已執行 — 僅做狀態日誌記錄（`systemPreferences.getMediaAccessStatus('microphone')`），不做主動預請求。macOS 平台在 `ensureMicrophonePermission()` 呼叫時 log 當前權限狀態；Windows/Linux 跳過。

### Build 驗證結果
`npx vite build` 三階段全通過：
- renderer: ✓ 2127 modules transformed, built in 8.83s
- main: ✓ 28 modules transformed, built in 1.08s
- preload: ✓ 1 module transformed, built in 17ms

### 給 T0008 / T0011 的備註
1. macOS 打包後的 Info.plist 現已包含 `NSMicrophoneUsageDescription`，首次 getUserMedia 時系統會彈出權限對話框。
2. 在 macOS 上可觀察 debug.log 中的 `[voice] macOS microphone permission status:` 行確認權限狀態（not-determined / granted / denied）。
3. 當前開發環境為 Windows，macOS 行為只能在 macOS 機器上實測（T0011 的測試情境）。
4. `systemPreferences.getMediaAccessStatus` 在 macOS 10.14+ 才有效，更早版本會 catch 並記錄錯誤。

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-11 01:47 (UTC+8)
