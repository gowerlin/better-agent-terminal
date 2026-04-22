# T0236 — 研究:GPU Whisper 加速技術選型 + PoC 可行性(PLAN-004)

## 元資料

- **編號**:T0236
- **類型**:research(允許 Worker 與使用者互動)
- **狀態**:📋 TODO
- **優先級**:🟡 Medium(平行投資,side quest,不阻塞主線)
- **建立時間**:2026-04-23 00:50 (UTC+8)
- **派發模式**:`--mode on --interactive`(自動開新 tab + Worker 可問問題)
- **前置條件**:PLAN-004(技術背景)、T0058 研究報告(2026-04-12 已過時,作對照基準)
- **關聯**:
  - PLAN-004 📋 PLANNED → 🔄 IN_PROGRESS(本工單啟動後)
  - T0058 `_ct-workorders/T0058-whisper-gpu-acceleration-research.md`(前次研究,half-year old)
  - T0060(macOS Metal 啟用,已 DONE,**不**在本次範圍)
- **互動限制**:每次提問上限 3 個(per `research_max_questions: 3`)
- **預估時間**:3-5 小時(研究 + PoC 可行性驗證,含 worktree 編譯實驗)
- **Renew 次數**:0

---

## 研究目標

為 **Windows + Linux** 平台的 BAT Whisper 語音辨識產出雙軌(CUDA 優先 + Vulkan fallback)實作計畫,含 PoC 可行性驗證。

> ⚠️ **macOS 不在範圍**:T0060 已透過 `whisper-node-addon` prebuilt 啟用 Metal GPU,無需重測。

---

## 背景

- BAT 目前 Whisper 整合採用 `whisper-node-addon`
  - macOS:prebuilt 含 Metal 支援 ✅
  - **Windows**:prebuilt 為 **CPU-only**(T0058 binary 分析確認)❌
  - **Linux**:prebuilt 為 **CPU-only**(同上)❌
- 使用者 Q1 選 B:**平行投資研究,不阻塞主線**,可於獨立 worktree 做實驗
- 使用者 Q2 選 D:**雙軌**(CUDA 優先 + Vulkan fallback),要求完整跨廠商覆蓋
- 使用者 Q3 選 A:本工單為**研究**,非直接實作;實作拆單由本工單結論驅動

---

## 研究範圍(5 項)

### 1. 2026 年 CUDA whisper 生態現況

- [ ] **nodejs-whisper**:
  - 版本 / 維護狀態 / issue tracker 健康度
  - `withCuda: true` 的生產可用性(有無已知阻塞 issue)
  - 與 BAT 現行 electron-builder/native-module ABI 的相容性
- [ ] **whisper.cpp CUDA 編譯**:
  - 最新官方建議流程(CUDA Toolkit 版本、cmake 參數)
  - Windows MSVC / Linux gcc 實測編譯時間量級
  - binary distribution 方式(靜態連結 cuBLAS / 動態依賴 CUDA Runtime)

### 2. 2026 年 Vulkan whisper 生態現況

- [ ] **whisper.cpp Vulkan 後端**:
  - 成熟度(是否仍屬 experimental / stable 分支)
  - 跨 NVIDIA / AMD / Intel iGPU 實測報告或社群反饋
  - 效能對比(Vulkan vs CUDA 同硬體下的速度比例)
- [ ] **建置複雜度**:
  - 編譯依賴(Vulkan SDK、Shaderc 等)
  - BAT 打包流程可行性(是否需要在 prebuilt 流程加 Vulkan 支援)

### 3. BAT 整合影響面

- [ ] **whisper-node-addon vs 替代方案**:
  - 替換為 nodejs-whisper:API 變更 / integration 重寫幅度
  - 保留 whisper-node-addon + 雙引擎路徑:可行性
- [ ] **打包 / 安裝流程**:
  - `package.json` 依賴變更
  - `electron-builder` asarUnpack / prebuild 規則
  - `postinstall` hook 影響(參考 BUG-055 SDK install hook 前例)
  - 使用者是否需要額外安裝 CUDA Runtime(UX 衝擊)

### 4. PoC 可行性(建議在 worktree 做)

- [ ] **CUDA 路徑 PoC**(必做):
  - 在獨立 worktree(建議 `git worktree add ../bat-gpu-whisper-cuda -b exp/gpu-cuda-poc`)
  - 至少編譯 whisper.cpp + CUDA 成功
  - 跑一段音訊(任選 BAT 現有測試音訊)並驗證輸出
  - 回報 commit hash + binary 大小
- [ ] **Vulkan 路徑 PoC**(可選,先紙上評估):
  - 若第 2 項調查顯示成熟度不足 → 僅紙上評估
  - 若成熟度足夠 → 同 CUDA 流程(另一 worktree)

### 5. 雙軌實作計畫產出

- [ ] CUDA 實作計畫:
  - T-shirt sizing(S / M / L / XL)
  - Phase 拆分建議(例:Phase 1 CUDA impl / Phase 2 Vulkan)
  - 依賴清單(CUDA Toolkit 版本、build tools)
  - 風險(upstream stability、binary size 膨脹、UX)
- [ ] Vulkan 實作計畫:同上
- [ ] 建議 Phase 1 impl 拆單結構(可直接作為後續 T 工單前置)

---

## 產出要求

1. **技術選型報告**(markdown,建議放 `_ct-workorders/_spec-gpu-whisper-2026-04.md`)
   - 含上述 5 項研究結論
   - 雙軌對比表(CUDA vs Vulkan:成熟度 / 複雜度 / UX / 覆蓋率)
   - 推薦 Phase 1 路徑(CUDA-first 已拍板,研究報告須補:是否仍建議 / 若現況改變則建議新路徑)
2. **PoC commit hash**(若 CUDA PoC 成功)
   - 在 worktree 分支,commit 訊息含 `[T0236 PoC]` 標記
   - 本工單 worker 不需合入主線,worktree 保留供後續 impl 工單接手或 EXP-GPU-001 正式化
3. **建議 Phase 1 實作拆單結構**
   - 至少 3-5 張建議 T 工單的 title + scope
   - 放在回報區供塔台決策派發
4. **Renew 判定**:
   - 若技術選型結論**仍不清晰**(例如 CUDA stability 有重大 regression)→ **Renew 而非派 impl 工單**
   - 若判定需要改走 EXP(worktree 正式化)→ 回報建議塔台用 `*exp` 建 EXP-GPUWHIS-001

---

## 互動規則

- Worker 每次可與使用者互動提問(上限 3 個問題 / 次)
- 提問內容限制:必要的決策節點(例如 CUDA Toolkit 版本選擇、worktree 命名、是否需要真實硬體測試)
- 禁止:一般實作決策、細節格式問題
- 互動時機:研究前(釐清假設)、PoC 前(確認 worktree 建立)、報告撰寫前(確認結構)

---

## 回報區(Worker 填寫)

### 研究結論摘要

<!-- Worker 完成後填寫:一段話總結雙軌選型建議 -->

### 5 項範圍執行結果

1. CUDA 生態:
2. Vulkan 生態:
3. BAT 整合影響面:
4. PoC 可行性:
5. 雙軌實作計畫:

### 產出連結

- 技術選型報告:`_ct-workorders/_spec-gpu-whisper-2026-04.md`(建議路徑)
- PoC commit:`<hash>` on worktree branch `exp/gpu-cuda-poc`
- 建議 Phase 1 拆單:

### 風險 / 阻塞 / 意外發現

### Renew 建議

- [ ] 結論清晰 → 塔台可派 impl 工單
- [ ] 結論不清晰 → 建議 Renew(補充說明)
- [ ] 建議改走 EXP → 建議塔台 `*exp GPUWHIS <描述>`

---

**建立者**:Control Tower(第二十一 session,2026-04-23 00:50)
**派發指令**(塔台自用):
```
派發 T0236 --mode on --interactive
```
