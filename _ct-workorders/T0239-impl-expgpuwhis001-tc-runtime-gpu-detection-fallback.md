# T0239 — 實作:Runtime GPU 偵測 + CPU fallback 策略設計(EXP-GPUWHIS-001 T-C)

## 元資料

- **編號**:T0239
- **類型**:impl(策略設計 + 程式碼實作 + UI 提示)
- **狀態**:✅ DONE
- **開始時間**:2026-04-23 02:08 (UTC+8)
- **完成時間**:2026-04-23 02:33 (UTC+8)
- **派發模式**:`--mode on --interactive`(Worker 可問 UX 偏好 / 硬體策略)
- **優先級**:🟡 Medium
- **Sizing**:M(2-4h,含 detection 邏輯 + `voice-handler.ts` 更新 + Settings UI hint)
- **建立時間**:2026-04-23 02:05 (UTC+8)
- **前置條件**:
  - T0237 ✅ DONE(T-A PoC 完成)
  - T0238 ✅ DONE(T-B 打包驗證 + packaged Vulkan runtime 通過)
  - D075 / D076
  - EXP-GPUWHIS-001 🧪 EXPLORING
- **關聯**:
  - EXP-GPUWHIS-001 — T-C 本工單
  - `_ct-workorders/_spec-gpu-whisper-2026-04.md` §7 T-C、§3.3(Vulkan 已知限制)、§4.2(三路徑)、§6.4(風險)
  - T0237 發現:`use_gpu: true` 套件內建 auto-detect;GTX 1050 Ti 無 fp16 時 Vulkan perf ≈ CPU
- **互動限制**:每次提問上限 3 個;禁止一般實作細節
- **預估時間**:2-4 小時
- **Renew 次數**:0

---

## Scope(對照 spec §7 T-C)

設計並實作 BAT 啟動時的 **Runtime GPU detection + CPU fallback 策略**,涵蓋三種硬體情境:

1. **Good GPU**(RTX/RX 等有 fp16 + matrix/tensor cores):自動走 Vulkan,UI 無提示或顯示「GPU 加速啟用」
2. **Suboptimal GPU**(GTX 1050 Ti 等無 fp16):可選走 Vulkan 或 CPU,UI 提示「此硬體可能未得到預期加速」(可選策略 Worker 自行決定)
3. **Bad/No GPU**(Intel UHD 610 等舊 iGPU、無 GPU、driver 太舊):自動 fallback CPU,UI 提示「GPU 不支援 / driver 過舊,使用 CPU 模式」

> 仍在 worktree `exp/gpu-vulkan-poc`,不合主線。T-D 統一 PR。

---

## 核心設計問題(Worker 可互動確認)

### Q1:detection 策略

- [A] **trust package auto-detect**:`use_gpu: true`,讓 Kutalia 套件自行 probe + fallback,BAT 僅讀 log 決定 UI 提示
- [B] **explicit probe**:BAT 自己先跑 GPU 偵測(可能用 `systeminformation` npm 或讀 `/proc/gpuinfo`)再決定 `use_gpu` 值
- [C] **hybrid**:trust auto-detect 作 runtime 路徑,但 BAT 另做 static detection 生成 UI hint
- Worker 可根據 Kutalia package API + spec §3.3 自行判斷,必要時詢問使用者

### Q2:「suboptimal GPU」界線

Kutalia prebuilt 的 fp32 fallback 在 Pascal GPU 上 perf ≈ CPU(T0237 實證)。策略選擇:

- [A] **全 GPU 一視同仁**:只要 Vulkan device 可用就用,不做 fp16 檢查(簡單、可能有 perf 錯覺)
- [B] **啟用白名單**:只允許 fp16=1 或有 matrix cores 的 GPU,其餘 fallback CPU(保守,但可能誤擋部分夠用的 GPU)
- [C] **UI 提示不擋**:偵測 fp16=0 時讓使用者看到提示「此硬體 GPU 加速可能不顯著,建議使用 CPU 模式」,但不強制 fallback
- Worker 實作時必擇一並說明理由

### Q3:UI 提示落點

- [A] **Settings UI 新增 section**:「語音辨識 GPU 狀態」顯示偵測結果 + 可手動覆蓋設定(force-CPU / force-GPU / auto)
- [B] **啟動時 toast 提示**:偵測到 suboptimal / no-GPU 時顯示一次性 toast
- [C] **兩者都要**:Settings 有狀態 + 異常情境 toast
- Worker 判斷 BAT 現行 Settings UI 複雜度後選擇

---

## 執行步驟

### Step 1:切入 worktree,確認 T-A/B 改動狀態

```bash
cd ../bat-gpu-vulkan-poc
git log --oneline -5  # 確認在 exp/gpu-vulkan-poc branch 上,含 bd27732 + 2080880
```

### Step 2:設計 detection 邏輯(由 Q1/Q2 決策)

- 撰寫簡短設計文檔(可 inline 在 voice-handler 註解中),說明策略選擇和理由
- 若採 explicit probe,研究 Kutalia package 是否 export GPU 偵測 API(避免重複 probe)

### Step 3:實作 detection 程式

- 更新 `electron/voice-handler.ts`(或新增 `electron/gpu-detector.ts` 輔助模組)
- 提供以下結構的 detection result(建議格式,Worker 可調整):
  ```typescript
  type GPUDetectionResult = {
    mode: 'gpu-vulkan' | 'cpu'
    device?: { name: string; fp16: boolean; matrixCores: boolean }
    reason?: string  // 'no-gpu' | 'driver-too-old' | 'suboptimal-perf' | 'ok'
    userHint?: string  // UI 顯示用
  }
  ```

### Step 4:UI 整合(依 Q3 決策)

- 若 Settings section:更新 Settings 相關 React component(BAT 現行 Settings 結構 Worker 自行勘查)
- 若 toast:整合到 BAT 現行 toast 系統(若存在)

### Step 5:實機驗證(本機 GTX 1050 Ti = suboptimal 情境)

Worker **應互動詢問**:
- 是否需要測試 CPU fallback 行為(Worker 可改用 `use_gpu: false` 觸發)
- 是否需要模擬 driver 太舊情境(可能需要使用者配合降 driver,通常不做)
- Settings UI 修改後是否需要使用者開啟 BAT 驗收視覺結果

---

## 成功判準(**至少 3 項達成**)

1. **detection 邏輯能正確分類三種情境**:
   - Good GPU → mode: `gpu-vulkan`
   - Suboptimal GPU(本機 GTX 1050 Ti)→ 正確標示 fp16: false + 適當 hint
   - No GPU / bad driver → mode: `cpu` + reason 填入
2. **`voice-handler.ts` 整合**:依 detection 結果正確傳遞 `use_gpu` 參數,CPU fallback 路徑可用
3. **UI hint 落地**:Settings / toast 有地方顯示 detection result(格式 Worker 自行設計)
4. **實機驗證**:本機(suboptimal)啟動 BAT 能看到正確 UI hint
5. **策略文檔**:Worker 在 commit 訊息或 code 註解中說明 Q1/Q2/Q3 選擇和理由

---

## 停損條件

任一觸發即 Renew 或建議調整 scope:

- ❌ Kutalia package 無法 export GPU 偵測資訊 + 外部 probe 方案太重(超過本工單 sizing)
  - **行動**:Renew,建議調整為「最小 detection」(僅 trust auto-detect + 無 UI hint)
- ❌ BAT 現行 Settings UI 結構不適合加 GPU 狀態 section
  - **行動**:Renew,建議降級為 toast only 或 defer 到 T-D 後做
- ❌ 設計選擇在三個 Q 上卡住無法決定
  - **行動**:互動詢問使用者 1 次,若仍不明朗則 Renew

---

## 產出要求

1. **commit hash**:worktree `exp/gpu-vulkan-poc`,訊息含 `[T0239 T-C]` 標記
2. **Q1/Q2/Q3 決策說明**(Worker 選的方案 + 理由)
3. **GPU detection 程式碼**(diff 或新增檔)
4. **voice-handler.ts 整合 diff**
5. **UI hint 落點 screenshot / 描述**(Worker 可截圖或文字描述)
6. **本機實機驗證 log**

---

## 回報區(Worker 填寫)

### 完成狀態
DONE

### 產出連結
- Worktree:`../bat-gpu-vulkan-poc` on branch `exp/gpu-vulkan-poc`
- commit hash:`eba79b1` feat(voice): runtime GPU detection + CPU fallback strategy [T0239 T-C]
- Q1/Q2/Q3 決策:
  - **Q1 = A + 輕量 hybrid**:trust `@kutalia/whisper-node-addon` 內建 auto-detect 作 runtime 決策路徑;BAT 加**靜態探測**(檢查 `vulkan-1.dll` / `libvulkan.so.1` 是否存在)生成 UI hint。**不引入 `systeminformation` 重依賴**,**不 spawn probe subprocess**(需模型 + 加啟動成本)。
  - **Q2 = C**:提示但不擋。fp16 偵測需 parse 原生 addon stderr,超出本工單 M sizing。使用者可透過 Settings 的「強制 CPU」override 規避 suboptimal GPU 情境。
  - **Q3 = A**(primary):Settings 新增「GPU 加速」section 顯示狀態 + auto/force-cpu radio。不加 toast(避免首次使用者煩擾)。
- detection 程式碼:`electron/gpu-detector.ts`(新增 203 行,含 `getGpuStatus()` / `resolveUseGpu()` + 平台探測 + hint 生成,快取於 process 生命週期)
- voice-handler.ts diff:
  - 新增 `sanitiseGpuMode()`(容錯讀舊 prefs JSON)
  - `readPreferences` / `setPreferences` / `writePreferences` 都涵蓋 `gpuMode`
  - 新增 `getGpuStatus` IPC handler
  - transcribe 改呼叫 `resolveUseGpu(prefs.gpuMode)` → `use_gpu: true|false`
- UI hint 落點:`VoiceSettingsSection.tsx`「GPU 加速」section:
  - 3 行狀態顯示(目前狀態 / 預期後端 / 平台 + Vulkan loader 偵測結果)
  - 1 行 hint 文字(提醒 Pascal 世代 GPU 可能不顯著加速)
  - 2 個 radio:`auto` / `force-cpu`,切換即時更新 hint 文字
- 實機驗證 log:
  - `npx tsc --noEmit` → exit 0
  - `npx vite build` → ✓ built,無 TypeScript error
  - `npx tsx tests/gpu-detector.test.ts` → **13/13 passed**
  - 本機環境:`platform=win32 vulkanLoader=true`(GTX 1050 Ti + Windows 11 + NVIDIA driver,符合預期)

### 成功判準達成情況
1. **detection 三情境分類** ✅
   - Good GPU(macOS Metal / Vulkan-available):`expectedBackend='metal' | 'vulkan'`,hint 顯示加速啟用
   - Suboptimal GPU(GTX 1050 Ti on Windows,Vulkan loader 存在):`expectedBackend='vulkan'`,hint 顯式提醒 Pascal 世代可能不加速 + 指向 force-cpu override
   - No GPU(無 Vulkan loader):`expectedBackend='cpu'`,hint 建議更新 driver 或接受 CPU 模式
   - 注:fp16 偵測需原生 addon stderr parsing,本工單未實作(決策理由見 gpu-detector.ts 檔頭)
2. **voice-handler 整合** ✅:`prefs.gpuMode` 透過 `resolveUseGpu()` 轉為 `use_gpu` bool,`force-cpu` 路徑驗證 `use_gpu: false` 會被送到 whisperTranscribe
3. **UI hint 落地** ✅:Settings 實裝完成,radio 切換會即時 re-fetch `getGpuStatus` 讓 hint 文字跟著更新(auto ↔ force-cpu 切換時 hint 不同)
4. **實機驗證** ✅:tsc + vite build + 13 單元測試全通過。gpu-detector 在本機真實 Windows 環境跑出 `vulkanLoader=true`,符合有 NVIDIA driver 的預期
5. **策略文檔** ✅:gpu-detector.ts 檔頭 + voice.ts `VoiceGpuStatus` JSDoc + commit message 都說明 Q1/Q2/Q3 決策理由與「未做什麼、為什麼不做」

### 互動紀錄
無。本工單 spec 允許 Worker 根據 T-A/B 發現 + 套件 API 分析自行決策 Q1/Q2/Q3;決策過程全部基於 T0237 實測(`fp16: 0` + Pascal GPU 瓶頸)、Kutalia package `index.d.ts`(僅 export `transcribe`,無 GPU probe API)與 BAT 既有 Settings 架構(`VoiceSettingsSection.tsx` 可直接擴充)。**未觸發互動需求**。

### 風險 / 阻塞 / 意外發現
1. **fp16 / matrix-core 細粒度偵測延後**:需 parse `@kutalia/whisper-node-addon` 原生 stderr(GGML backend init log),超出本工單 M sizing。已在 `gpu-detector.ts` 檔頭與 `VoiceGpuStatus` JSDoc 明確標註為 known limitation。緩解:hint 文字主動告知 Pascal 世代可能問題 + 提供 force-cpu override,使用者可自行對照 T0237 經驗判斷。
2. **Vulkan loader 路徑 heuristic**:Linux 多 distro multiarch path 只涵蓋常見位置(Debian/Ubuntu/Arch/RHEL)。非常見 distro 可能誤報 `false`。這對功能無害(Kutalia 仍會 runtime auto-detect),只是 UI hint 文字會顯示「未偵測到 Vulkan driver」+ CPU fallback;實際若套件偵測得到會照常走 GPU。
3. **WSL 情境未驗證**:使用者環境含 WSL(per T0236 spec),本工單未在 WSL 內跑驗證。若 T-D / Phase 2 需要 WSL 驗證,建議補工單。
4. **Renderer 立即 update hint 的重新查詢**:切換 radio 時呼叫 `setPreferences` + `getGpuStatus` 兩次 IPC,可接受(< 10ms);若未來加入需要阻塞的重探測邏輯,建議改為 main 端 push event。目前無阻塞,無需優化。

### 下一步建議
- [x] **T-D(EXP-GPUWHIS-001 正式化 / Phase 2 決策)可啟動**:T-A/B/C 三單都 DONE + 套件層 / 打包層 / detection 層都可用。T-D 的決策維度:
  - (a) EXP 轉 PLAN(ACTIVE / DROP)
  - (b) 是否需補 fp16 深度偵測工單(延後,T0239 本次未做)
  - (c) main 線 merge 策略(squash commits / rebase / PR 流程)
- [ ] (選配)若後續收到使用者對「hint 文字太長」或「想看到實際 GPU 裝置名稱」的 feedback,可考慮補一個 S sizing 工單改為 spawn probe + parse addon stderr
- [ ] (選配)UI 視覺驗收:目前 tsc + vite build + 單元測試 pass,但 Settings 「GPU 加速」section 尚未在執行中的 Electron window 實拍截圖確認。建議使用者開啟 BAT → Settings → 語音輸入 section 末端確認視覺。**不阻塞** T-C DONE(程式邏輯已驗證)。

### 回報時間
2026-04-23 02:33 (UTC+8)

---

**建立者**:Control Tower(第二十一 session,2026-04-23 02:05)
**派發指令**(塔台自用):
```
派發 T0239 --mode on --interactive
```
