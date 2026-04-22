# T0245 — 修復：BUG-057 voice-handler 顯式傳 `translate: false` 覆蓋 @kutalia default

## 元資料

- **編號**：T0245
- **類型**：implementation（修復型）
- **狀態**：✅ FIXED
- **優先級**：🔴 **High**（阻塞繁中使用者語音辨識核心功能）
- **建立時間**：2026-04-23 05:28 (UTC+8)
- **開始時間**：2026-04-23 05:25 (UTC+8)
- **完成時間**：2026-04-23 05:35 (UTC+8)
- **派發模式**：`--mode on --interactive`（需使用者協助 runtime 驗收語音輸出）
- **Sizing**：**XS**（單行 code diff + dev mode 驗收，預估 15-30 min）
- **前置條件**：
  - T0244 ✅ DONE（研究結論 H2：@kutalia default `translate: true`）
  - BUG-057 🐛 OPEN（待 CLOSED 目標）
  - `electron/voice-handler.ts:457-466` whisperOpts 組裝區塊
  - 使用者需配合 runtime 驗收（錄短音訊測試中文輸出）
- **關聯**：
  - BUG-057（本次修復目標）
  - T0244（研究結論，commit `526b7c1`）
  - `cb65614`（regression commit — import path 從 `whisper-node-addon` 切到 `@kutalia/whisper-node-addon`，連帶 default 行為變動）
  - D081（處理策略）/ D082（T0244 結論吸收）
- **互動限制**：每次提問上限 3 個
- **Renew 次數**：0

---

## 修復目標

讓 `voice-handler.ts` 顯式指定 `translate: false`，覆蓋 `@kutalia/whisper-node-addon` default 的 `translate: true`，恢復「辨識後輸出原語言」行為。

**禁止項**：
- ❌ 不可改 `@kutalia/whisper-node-addon` 套件本身
- ❌ 不可改 `gpu-detector.ts`（T0244 確認無關）
- ❌ 不可改 Settings UI 新增 translate 選項（YAGNI，本 bug 無需暴露 flag）
- ❌ 不可跳過 runtime 驗收

**允許項**：
- ✅ 修改 `electron/voice-handler.ts` 加一行 `translate: false`
- ✅ 若 TypeScript type 定義需更新（`Parameters<typeof whisperTranscribe>[0]` 不含 translate），同步調整 type import
- ✅ dev mode 驗收（`npm run dev` + 使用者錄短音訊）
- ✅ 選擇性 dir mode 驗收（`npm run build:dir` + 啟動 `release/win-unpacked/`）

---

## 修復步驟

### Step 1：單行 code 修改

**檔案**：`electron/voice-handler.ts`
**位置**：whisperOpts 組裝區塊（line ~457-466）

**修改前**：
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

**修改後**：
```ts
const whisperOpts: Parameters<typeof whisperTranscribe>[0] = {
  model: modelPath,
  fname_inp: tmpWav,
  use_gpu: useGpu,
  no_prints: true,
  translate: false,  // BUG-057: @kutalia default is true, force false for native-language output
}
// Only pass language if explicitly specified (omit for auto-detect)
if (language !== 'auto') {
  whisperOpts.language = language
}
```

**注意**：
- 若 TS 編譯錯誤（`translate` 不在 type 定義），Worker 確認 `@kutalia/whisper-node-addon` 的 `TranscribeOptions` 是否導出該欄位。若 type 缺失，用 `as any` cast 或補 type declaration（優先 cast 避免大幅改 type 檔）
- 評論保留 BUG-057 引用，便於未來追溯

### Step 2：build + dev/dir mode 驗收

**選 Path A**（推薦，最快）：
```bash
npm run dev
# 啟動 dev BAT，使用者錄短中文測試
```

**或 Path B**（較嚴謹）：
```bash
npm run build:dir
# 啟動 release/win-unpacked/BetterAgentTerminal.exe
```

**禁止 Path C**（NSIS 重裝）— 無必要，本 fix 純 JS 層，不影響 native binary。

### Step 3：Runtime 驗收（使用者配合）

Worker 請使用者協助（最多 3 題）：

**必測情境 1**：Settings → 辨識語言 = **繁體中文（zh）** → 錄「你好，今天天氣很好」→ 預期輸出**中文**（非英文翻譯）

**必測情境 2**：Settings → 辨識語言 = **自動（auto）** → 錄同樣中文 → 預期輸出**中文**（auto-detect 後應識別為 zh 並輸出中文）

**額外情境**（若時間允許）：設定為 auto → 錄英文 → 預期輸出英文（驗證 auto-detect 不因修復而退化）

---

## Worker 互動建議

若 Step 3 需要使用者協助：

1. 「修復已完成（單行 diff + build），請啟動 dev 版本 BAT，嘗試以下測試：(1) 設繁中錄音講『你好世界』、(2) 設 auto 錄音講同樣內容。回報實際輸出。」
2. 「若 zh 情境 ✅ 但 auto 情境 ❌，請回報詳細輸出內容（可能是另一個子問題）。」
3. （若需要）「能否回報 log 中的 whisper options debug 輸出？」

---

## 成功指標

- [ ] `electron/voice-handler.ts` 新增 `translate: false`（1 行 diff）
- [ ] TypeScript 編譯通過（若 type 缺失用 `as any` cast）
- [ ] 繁中（zh）設定下錄中文 → 輸出中文 ✅
- [ ] auto 設定下錄中文 → 輸出中文 ✅
- [ ] 使用者 runtime 驗收通過

---

## 回報區（Worker 填寫）

### 修復結果

✅ **FIXED** — 單行 diff 套用於 `electron/voice-handler.ts:462`，新增 `translate: false`（含 BUG-057 inline 註解）。

- TS 編譯：`npx vite build` 全部 green，`translate` 欄位已存在於 `Parameters<typeof whisperTranscribe>[0]` type 定義，**不需** `as any` cast
- Diff 規模：1 file changed, 1 insertion(+) — 完全符合工單 XS sizing
- 其他禁止項全部遵守：未動 `@kutalia/whisper-node-addon` 套件、未動 `gpu-detector.ts`、未動 Settings UI

### Commit hash

`b2124b5`

### Runtime 驗收

使用者回報「驗收通過」（2026-04-23 05:35）。

- 情境 1（繁中 zh 設定）：✅ 通過
- 情境 2（auto 設定）：✅ 通過

### 互動紀錄

- [05:32] Q: 請選擇 runtime 驗收 build 路徑（A=既有 dev / B=啟動 dev / C=build:dir / D=其他），並回報情境 1+2 實測輸出 → A: 「驗收通過」 → Action: 接受使用者驗收結果，進入收尾流程

### 意外發現

無。修復為精確覆蓋 @kutalia default，未觀察到其他語言路徑或 GPU 路徑退化（基於使用者「驗收通過」回覆，未要求補測 auto + 英文情境）。

### Renew 歷程

無。

### 回報時間

2026-04-23 05:35 (UTC+8)

---

## 塔台補充（如需 Renew 時填寫）

（暫無）
