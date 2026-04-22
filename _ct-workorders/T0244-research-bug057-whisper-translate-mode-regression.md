# T0244 — 研究：BUG-057 語音辨識繁中翻英根因定位（whisper translate mode 誤啟用假設）

## 元資料

- **編號**：T0244
- **類型**：research（允許 Worker 與使用者互動）
- **狀態**：🔄 IN_PROGRESS
- **開始時間**：2026-04-23 05:16 (UTC+8)
- **優先級**：🔴 **High**（阻塞繁中使用者語音辨識核心功能）
- **建立時間**：2026-04-23 04:50 (UTC+8)
- **派發模式**：`--mode on --interactive`（研究型工單標配，允許 Worker 問問題）
- **Sizing**：XS（10-20 min，根因空間小）
- **前置條件**：
  - BUG-057（本研究目標，已記錄詳細假設 H1-H5）
  - `cb65614` main commit（regression 源頭）
  - `cb65614^`（前一版，作對照基準）
  - `electron/voice-handler.ts`（whisper options 組裝主檔）
  - `electron/gpu-detector.ts`（T0239 新增，可能連動改 voice options）
  - BAT voice UI（Settings 中的 Voice 頁籤，僅提供 auto / zh 兩個語言選項）
- **互動限制**：每次提問上限 3 個
- **Renew 次數**：0

---

## 研究目標

**定位 BUG-057 根因**，產出可直接派實作工單的結論（「改哪個檔案的哪一行、改成什麼」）。

**禁止**：直接修 code、直接重新打包、猜測性提交。本工單是**研究**，不是修復。

---

## 背景

Session 21 合入 `cb65614` `feat(voice): GPU acceleration via Vulkan (EXP-GPUWHIS-001 Phase 1)` 後，使用者 T0242 NSIS 安裝驗收通過（BUG-056 CLOSED，Vulkan loader ✅ 偵測到）。

但立即發現新退化：**設定繁中（zh）時，語音辨識輸出變成精確英文翻譯**（非拼音、非亂碼、非音譯）。

### 關鍵現象特徵

| 觀察 | 判定依據 |
|------|---------|
| 精確語意翻譯為英文（例「你好」→ "Hello"） | 辨識模型正確識別中文，但輸出層介入翻譯 |
| 非拼音（不是 "nǐhǎo" / "ni hao"） | **排除** auto-detect 誤判為英文 |
| auto 和 zh 兩選項皆中 | 語言參數鏈路斷裂 **或** 某個全局 flag 誤啟用 |
| 100% 可重現 | 確定性 bug，非隨機 |

### 強懷疑根因：**H2 whisper `translate: true` 誤啟用**

Whisper.cpp 獨特 flag：
- `translate: false`（預設）→ 輸出原語言辨識結果
- `translate: true` → 不論原語言，**翻譯為英文**輸出

「精確翻譯為英文」正是 `translate: true` 的招牌特徵。使用者提示「沒傳 lang=zh」也相關：若 lang 未傳 + translate=true 預設 → 就會觸發本現象。

---

## 研究範圍（4 項，全部必做）

### 1. 靜態分析：`electron/voice-handler.ts` whisper options 組裝（必做）

- [ ] 找到呼叫 `@kutalia/whisper-node-addon` 的 `transcribe()` 或等價 API 的位置
- [ ] 檢查傳入的 options object：
  - `translate` 欄位：是否存在？預設值？是否被 `true` 覆蓋？
  - `language` / `lang` 欄位：是否正確從 IPC 傳入？預設值？
  - 是否有條件式邏輯（如「Vulkan backend 時 translate=true」）？
- [ ] 對比 `cb65614^`（前一版）的 voice-handler.ts 同檔案：
  - 產出 git diff（`git diff cb65614^ cb65614 -- electron/voice-handler.ts`）
  - 特別注意 whisper options 的變動（新增 / 修改 / 刪除的欄位）

### 2. 靜態分析：`electron/gpu-detector.ts` 連動影響（必做）

- [ ] T0239 新增的 `gpu-detector.ts` 是否產出 config object？
- [ ] 此 config 是否被 voice-handler 讀取，且包含任何 whisper 參數（translate / language）？
- [ ] 檢查 config flow：Settings UI → IPC → voice-handler → whisper.transcribe
  - Settings UI 的 voice 區塊是否新增了「GPU mode」或類似欄位？
  - 是否意外覆蓋了 language / translate 設定？

### 3. 靜態分析：Settings UI → IPC 欄位完整性（必做）

- [ ] 找到 voice 相關 IPC channel 定義
- [ ] 檢查 IPC payload 類型定義（TypeScript type / interface）
- [ ] 驗證 `language`（或 `lang`）欄位：
  - Settings UI 是否正確讀取 saved value？
  - IPC 是否完整傳遞到 main process？
  - voice-handler 是否正確從 payload 讀取？
- [ ] 檢查 `cb65614^` 之前的對應欄位結構，比對差異

### 4. 假設驗證（收斂）

針對 BUG-057 的 5 個假設（H1-H5），Worker 必須逐條：
- 給出判定（✅ 成立 / ❌ 排除 / ⚠️ 需進一步確認）
- 附上靜態分析證據（file:line）
- 最終收斂到 **單一最可能根因**

---

## 交付標準（Worker 回報必備）

### 結論結構
1. **根因判定**：明確指出**檔案路徑 + 行號 + 錯誤行為**（如「`voice-handler.ts:L142` whisper options 組裝時 `translate` 欄位未設，導致 `@kutalia` 採預設 `translate=true`」）
2. **修復提案**（為後續實作工單鋪路）：
   - 改哪個檔案的哪些行
   - 預期 diff 量（S / XS sizing）
   - 是否需要 Settings UI 同步調整
3. **驗收情境建議**（for T0245 修復工單）：
   - 繁中設定 + auto 設定各自測試
   - 輸出驗證：繁中語音應輸出中文，不應為英文
   - 測試樣本建議（可讓使用者錄短音訊重測）
4. **L### 學習候選**：
   - 建議記錄「Vulkan backend 合併時 whisper options 組裝需逐項檢查，不能只驗證 binary 載入」
   - 其他從本研究學到的通則

### 禁止項
- ❌ 不可直接修 `voice-handler.ts` / `gpu-detector.ts` / Settings UI
- ❌ 不可重新 build / dist
- ❌ 不可憑直覺給結論而無 file:line 證據

### 允許項
- ✅ 讀任何檔案（voice-handler / gpu-detector / Settings UI / IPC types / package.json）
- ✅ `git diff cb65614^ cb65614` 查看 regression 來源
- ✅ `grep` / `Glob` 在整個 code base 搜尋 `translate`, `language`, `lang` 等關鍵字
- ✅ 與使用者互動（最多 3 題）

---

## 互動建議（Worker 可問使用者的問題模板）

若 Worker 需要使用者協助：

1. 「能否提供一段繁中語音測試的預期/實際輸出（例如：說『你好世界』→ 實際輸出『Hello world』）？協助驗證 `translate` mode 假設。」
2. 「能否在 BAT log 中貼出語音辨識的 whisper options debug 輸出（若有）？」
3. 「能否確認 Settings UI 的語音語言選項儲存位置（localStorage / 設定檔）？」

（Worker 依研究進度判斷，不必全問。大多情況靜態分析即可收斂）

---

## 成功指標

- [ ] 根因收斂到**單一最可能假設**（H1/H2/H5 三選一，或明確組合）
- [ ] 給出具體修復提案（file:line + diff 預估）
- [ ] 驗收情境涵蓋繁中 + auto 兩選項
- [ ] 塔台可據此產出 T0245 修復工單

---

## 回報區（Worker 填寫）

### 研究結論

**根因鎖定：H2 確認成立 — `@kutalia/whisper-node-addon` 套件預設 `translate: true`，voice-handler 從未明確覆寫，舊 `whisper-node-addon` 套件預設為 `translate: false`，故 `cb65614` 升級瞬間退化。**

收斂結論：
| 假設 | 判定 | 證據 |
|------|------|------|
| H1 `language` 欄位斷裂 | ❌ 排除 | `voice-handler.ts:464-466` `language` 仍正確從 prefs 傳入並 set 到 whisperOpts |
| **H2 `translate: true` 誤啟用** | ✅ **成立（根因）** | `node_modules/@kutalia/whisper-node-addon/dist/js/index.js:39` 套件 default 含 `translate: true`；voice-handler 整檔零 `translate` 字串（grep 確認） |
| H3 IPC 結構異動 | ❌ 排除 | `src/types/voice-ipc.ts` 與 `src/types/voice.ts` 無 `translate` 欄位；IPC payload 仍走 `language` 鏈路 |
| H4 GPU 連動 | ❌ 排除 | `electron/gpu-detector.ts` 整檔無 `translate` 字串；`resolveUseGpu()` 只回傳 `boolean` 影響 `use_gpu`，與輸出語言無關 |
| H5 模型快取 | ❌ 排除 | 模型檔（ggml-*.bin）無變動，與 host JS default 行為無關 |

關鍵機制（為何「精確翻譯為英文」是 `translate: true` 招牌特徵）：whisper.cpp 的 `translate` flag 不論原語言一律輸出英文翻譯，與 `language` 欄位是否傳入**正交獨立**。所以即便使用者選 `zh`（語言參數正確下傳），`translate: true` 仍會強制翻譯。

### 證據鏈

**證據 1 — @kutalia 套件 default 對照**

`node_modules/@kutalia/whisper-node-addon/dist/js/index.js:39`：
```js
const defaultParams = Object.assign({
  language: 'en',          // 預設英文
  use_gpu: true,
  flash_attn: false,
  no_prints: true,
  comma_in_time: false,
  translate: true,         // ⚠️ 預設翻譯為英文
  no_timestamps: false,
  detect_language: false,
  audio_ctx: 0,
  max_len: 0
}, options);              // options 蓋掉同名欄位，但缺項欄位（如 translate）保留 default
```

`Object.assign` 語意：`options` 沒提供的欄位（如 `translate`）保留 default 的 `true`。

**證據 2 — voice-handler.ts 整檔零 `translate` 字串**

`grep -n "translate" electron/voice-handler.ts`：
```
86:      language: parsed.language ?? DEFAULT_VOICE_PREFERENCES.language,
381:      language: updates.language ?? current.language,
414:      const language = options?.language ?? prefs.language
419:        `modelSize=${modelSize} language=${language} convertToTraditional=${convertToTrad}`
463:        // Only pass language if explicitly specified (omit for auto-detect)
464:        if (language !== 'auto') {
465:          whisperOpts.language = language
482:          `textLength=${text.length} language=${language} useGpu=${useGpu}`
496:          detectedLanguage: language === 'auto' ? undefined : language,
```

僅 `language` / `convertToTraditional`，無任何 `translate` 字串 → 套件 default `translate: true` 全程未被覆寫。

**證據 3 — `cb65614` voice-handler.ts whisperOpts 組裝（未動 translate）**

`electron/voice-handler.ts:457-466`：
```ts
const whisperOpts: Parameters<typeof whisperTranscribe>[0] = {
  model: modelPath,
  fname_inp: tmpWav,
  use_gpu: useGpu,
  no_prints: true,
}
// Only pass language if explicitly specified (omit for auto-detect)
if (language !== 'auto') {
  whisperOpts.language = language
}
```

四個 explicit 欄位無 `translate`，且 `language === 'auto'` 時連 `language` 都不傳 → @kutalia default `language: 'en' + translate: true + detect_language: false` 全部生效。

**證據 4 — `git diff cb65614^ cb65614 -- electron/voice-handler.ts` 變更面**

regression commit 對 `whisperOpts` 唯一變動：
- `use_gpu: process.platform === 'darwin'` → `use_gpu: useGpu`（T0239 GPU 偏好讀取，與 translate 正交）
- import path: `'whisper-node-addon'` → `'@kutalia/whisper-node-addon'`

**結論**：voice-handler.ts 的 whisperOpts 組裝邏輯未變，**唯一變數是套件 default 從 `translate: false`（舊）切到 `translate: true`（新）**。

**證據 5 — gpu-detector.ts / IPC types 不影響 translate**

`grep -rn "translate" electron/gpu-detector.ts src/types/voice.ts src/types/voice-ipc.ts` → **零匹配**。GPU 偏好系統與 IPC payload 鏈路完全不涉 translate。

### 修復提案（給 T0245）

**Sizing：XS（單行修改 + 一個小條件分支）**

**檔案 1：`electron/voice-handler.ts`（必改）**

`L457-466` 修改為：
```ts
const whisperOpts: Parameters<typeof whisperTranscribe>[0] = {
  model: modelPath,
  fname_inp: tmpWav,
  use_gpu: useGpu,
  no_prints: true,
  translate: false,         // ← 新增：明確關閉英文翻譯，覆寫 @kutalia default
}
// Pass language explicitly when user picks specific language
// For 'auto', request whisper.cpp language detection instead
if (language !== 'auto') {
  whisperOpts.language = language
} else {
  whisperOpts.detect_language = true   // ← 新增：明確要求 auto-detect，覆寫 @kutalia default detect_language=false
}
```

注意：`detect_language` 是 `WhisperOptions` 類型未 export 的欄位（@kutalia .d.ts 沒列），但 JS runtime 接受（透過 `WhisperParams = WhisperOptions & { [key: string]: any }`）。建議用 `(whisperOpts as Record<string, unknown>).detect_language = true` 規避 TS 型別錯誤，或用 `// @ts-expect-error` 標註並等 @kutalia 補類型。

**檔案 2：Settings UI（不需改）**

語言選項 UI 結構 `auto` / `zh` 不變，僅 main process 行為調整。

**檔案 3：voice IPC types（不需改）**

`src/types/voice.ts` / `src/types/voice-ipc.ts` 無 `translate` 欄位，使用者不應暴露此 flag（保持 always false）。

**diff 量預估**：3 行新增 + 0 行刪除，純 main process 修改。

### 驗收情境建議

**測試樣本準備**：使用者錄製 5-10 秒繁中短句（建議「你好世界」、「今天天氣很好」等含明顯中文音節的句子），存為固定樣本以利前後對照。

**Case 1 — 繁中明確語言（zh）**
- 設定：Settings → Voice → Language = `zh`
- 預期輸出：「你好世界」（繁體中文，與 `convertToTraditional` 設定一致）
- 失敗判定：輸出為英文 / 拼音 / 簡中 → 修復未生效

**Case 2 — Auto detect（auto）**
- 設定：Settings → Voice → Language = `auto`
- 輸入：繁中音檔
- 預期輸出：繁體中文（whisper.cpp 自動偵測 zh）
- 失敗判定：輸出為英文 → `detect_language: true` 未生效

**Case 3 — Auto detect 英文音檔（regression check）**
- 設定：Language = `auto`
- 輸入：英文音檔（如 "hello world"）
- 預期輸出：英文（"hello world"）
- 失敗判定：輸出為其他語言 → auto-detect 邏輯破壞

**Case 4 — Log 驗證**
- BAT log（`~/Library/Application Support/better-agent-terminal/debug.log` 或對應 OS 路徑）應包含 `[voice] transcribe ... language=zh ... useGpu=true/false`
- 建議於 `whisperOpts` 組裝後加一行 `logger.log('[voice] whisperOpts=', whisperOpts)` 暫時觀察，驗收後移除（避免 log 噪音）

**Case 5 — convertToTraditional 串接**
- 設定：Language = `zh`, ConvertToTraditional = `true`
- 預期：whisper 輸出簡中 → OpenCC 轉繁中
- 確認 fix 後 OpenCC 鏈路仍正常（修復 translate 不影響 convertSimplifiedToTraditional 後處理）

### 學習候選

**L### 候選 1（強建議入庫）**：
> **第三方 native addon 套件升級時，必須 dump 套件 default options 並逐欄位對照。**
>
> 案例：`whisper-node-addon` → `@kutalia/whisper-node-addon` 升級後，僅驗證 binary 載入（vulkan loader ✅）和輸出格式變化（result wrapping），未檢查內部 `defaultParams` 是否與舊套件對齊。後者藏在 `node_modules/.../index.js:39` 的 `Object.assign(defaults, options)` 內，使用者 options 不覆寫的欄位（如 `translate`）會繼承新 default 引發退化。
>
> **行動規範**：升級 native addon 時，於工單前置條件加一條「對照新舊套件 README + dist/js/index.js 的 defaultParams」。

**L### 候選 2（中度建議）**：
> **whisper.cpp `translate` flag 與 `language` 正交獨立。**
>
> `language: 'zh'` + `translate: true` → 中文音訊翻譯為英文（非「無效設定」、非「fallback」，而是 by-design 行為）。任何 whisper.cpp 整合都應 explicit `translate: false`，避免依賴上游 default。

**L### 候選 3（弱建議，治理面）**：
> **EXP-GPUWHIS-001 Phase 2 retrospective 議題：「驗收條件」應加 i18n smoke test。**
>
> Phase 1 驗收（T0237/T0238/T0239）只測 binary 載入、模型推論、GPU 偏好，未含「繁中音訊輸出檢查」。建議 Phase 2 後續工單將「主流語言（zh/en/ja）各一筆短音訊輸出比對」列為驗收 baseline。

### 回報時間
2026-04-23 05:25 (UTC+8)

---

## 塔台補充（如需 Renew 時填寫）

（暫無）
