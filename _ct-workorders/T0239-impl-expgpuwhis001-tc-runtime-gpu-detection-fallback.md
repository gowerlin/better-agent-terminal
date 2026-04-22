# T0239 — 實作:Runtime GPU 偵測 + CPU fallback 策略設計(EXP-GPUWHIS-001 T-C)

## 元資料

- **編號**:T0239
- **類型**:impl(策略設計 + 程式碼實作 + UI 提示)
- **狀態**:📋 TODO
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
<!-- DONE / PARTIAL / Renew -->

### 產出連結
- Worktree:`../bat-gpu-vulkan-poc` on branch `exp/gpu-vulkan-poc`
- commit hash:
- Q1/Q2/Q3 決策:
- detection 程式碼:
- voice-handler.ts diff:
- UI hint 落點:
- 實機驗證 log:

### 成功判準達成情況
1. detection 三情境分類:
2. voice-handler 整合:
3. UI hint 落地:
4. 實機驗證:
5. 策略文檔:

### 互動紀錄

### 風險 / 阻塞 / 意外發現

### 下一步建議
- [ ] T-D(EXP-GPUWHIS-001 正式化 / Phase 2 決策)可啟動
- [ ] Renew
- [ ] 建議 scope 調整

### 回報時間

---

**建立者**:Control Tower(第二十一 session,2026-04-23 02:05)
**派發指令**(塔台自用):
```
派發 T0239 --mode on --interactive
```
