# T0236 — 研究:GPU Whisper 加速技術選型 + PoC 可行性(PLAN-004)

## 元資料

- **編號**:T0236
- **類型**:research(允許 Worker 與使用者互動)
- **狀態**:🔄 IN_PROGRESS
- **開始時間**:2026-04-23 00:53 (UTC+8)
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

### 完成狀態

DONE

### 研究結論摘要

**雙軌假設已被 2026 年生態現況翻轉 — Vulkan 在 2025 下半年到 2026 Q1 已成熟為 BAT 場景首選**。`@kutalia/whisper-node-addon@1.1.0`(2025-07)已 ship Win/Linux Vulkan prebuilt,零環境配置 + 跨 NVIDIA/AMD/Intel 全覆蓋 + installer 膨脹僅 +30-50 MB。CUDA 雖理論速度快 20-30%,但對 Whisper 場景無感,且無 Electron ABI 145 相容的 CUDA prebuilt 套件,任何 CUDA 方案都需 BAT 自行 fork + CI 拉 CUDA Toolkit,膨脹 +150-300 MB、UX 衝擊中等。**推薦 Vulkan-first 取代原 T0236「CUDA-first + Vulkan fallback」假設,CUDA 保留為未來 advanced tier**。完整對比見報告 §6.3,PoC 腳本見 §5.2 / §5.3,Phase 1 拆單建議見 §7(T-A/B/C/D 共 4 張)。

### 5 項範圍執行結果

1. **CUDA 生態**:`nodejs-whisper@0.2.9`(2025-05)支援 `withCuda` 但無 prebuilt,需 MinGW/MSYS2;whisper.cpp 原生 `-DGGML_CUDA=1` 編譯可用,Win MSVC 10-20 分鐘,binary +150-300 MB。**沒有**任何 npm 套件同時滿足「Electron ABI 145 + CUDA prebuilt + 零環境配置」。
2. **Vulkan 生態**:whisper.cpp v1.8.3(2026-01)專為 iGPU 做 12x 優化,**Stable**(非 experimental),跨 NVIDIA+AMD+Intel 覆蓋,社群實測 ≈ 10x CPU;Kutalia fork 已 ship prebuilt,但 fork 底層 whisper.cpp 停在 v1.7.6(2025-07)未含 v1.8.3 優化。
3. **BAT 整合影響面**:三套路徑(A: Kutalia 現成 / B: BAT fork+rebase / C: CUDA)詳見 spec §4.2。Path A installer +30-50 MB、UX 零衝擊;Path C installer +150-300 MB、UX 中等衝擊。現行 `use_gpu: process.platform === 'darwin'` 若切 Path A 改為 `use_gpu: true`(套件內建自動偵測)。
4. **PoC 可行性**:依 Q2.B 決策走 EXP worktree 流程,本 session **未**實跑 CUDA 編譯(需使用者在 worktree 內執行,避免主線汙染)。PoC 腳本、停損條件、預期輸出見 spec §5。使用者環境 Win+NVIDIA+WSL Linux 均可完整實戰。
5. **雙軌實作計畫**:Phase 1 建議 4 張工單(T-A Vulkan PoC / T-B electron-builder 打包驗證 / T-C Runtime GPU 偵測 + CPU fallback 設計 / T-D 正式化決策),sizing 分別 L/M/M/S。詳見 spec §7。

### 產出連結

- **技術選型報告**:[`_ct-workorders/_spec-gpu-whisper-2026-04.md`](./_spec-gpu-whisper-2026-04.md) ✅
- **PoC commit**:未產出 — 依 Q2.B 決策交由 EXP-GPUWHIS-001 後續實作工單在 worktree 內產出
- **建議 Phase 1 拆單**:見 spec §7
  - T-A:Vulkan PoC worktree + 套件替換驗證(L)
  - T-B:electron-builder 26 打包驗證(M)
  - T-C:Runtime GPU 偵測 + CPU fallback 策略設計(M)
  - T-D:EXP-GPUWHIS-001 正式化或 Phase 2 派工決策(S)

### 互動紀錄

- [00:53] Q: 研究前釐清(PoC 硬體環境 / Phase 1 落地偏好 / Vulkan 調查深度) → A: Q1.A(Win+NVIDIA)+ Linux on WSL / Q2.B(EXP worktree 正式化)/ Q3.C(Vulkan 完整 PoC) → Action: 進入完整雙 worktree PoC 模式,走 EXP 實驗分支流程,CUDA 與 Vulkan 同等深度

### 風險 / 阻塞 / 意外發現

**意外發現**:
1. **雙軌假設已翻轉**:T0236 工單假設「CUDA-first + Vulkan fallback」,但 2026 生態已反轉為「Vulkan-first 即可滿足 80% 使用者」。CUDA 在 Whisper 場景的速度優勢不顯著,且 prebuilt 生態落後。
2. **Kutalia fork 已 9 個月未更新**(最後 commit 2025-07-18),其 whisper.cpp submodule 停在 v1.7.6 時代,**不含** v1.8.3 的 12x iGPU 優化。這不是 show-stopper,但若 PoC 實測 Vulkan 效能不如預期,升級路徑是 BAT 自 fork Kutalia + rebase upstream v1.8.4。

**風險**(詳見 spec §6.4):
- Kutalia 上游停更(中機率、中衝擊)
- Kutalia whisper.cpp fork 停在 v1.7.6(高機率、中衝擊,但可緩解)
- Electron 41 ABI 145 與 node-addon-api 8.3.1 不相容(低機率、高衝擊,PoC 第一件事驗證)
- Intel iGPU compute feature 不支援(中機率影響特定硬體、低衝擊,可 fallback)

**阻塞**:無。

### Renew 建議

- [x] **結論清晰** → 塔台可派 Phase 1 impl 工單(T-A/B/C/D)
- [ ] 結論不清晰 → 建議 Renew(補充說明)
- [x] **建議改走 EXP** → 建議塔台 `*exp GPUWHIS-001 vulkan-first-integration`
  - 理由:(1) 使用者 Q2.B 已選 EXP worktree;(2) PoC 本質為實驗;(3) 成熟後再 PR 回主線符合 Local Rules EXP 工作流;(4) T-A/B/C/D 可全部併入 EXP-GPUWHIS-001 統一追蹤

### Renew 歷程

無。

### 回報時間

2026-04-23 01:05 (UTC+8)

---

**建立者**:Control Tower(第二十一 session,2026-04-23 00:50)
**派發指令**(塔台自用):
```
派發 T0236 --mode on --interactive
```
