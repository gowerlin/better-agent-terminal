# Spec — GPU Whisper 加速技術選型（2026-04 版）

> **來源工單**：T0236（PLAN-004 的研究階段）
> **撰寫**：2026-04-23
> **目標平台**：Windows + Linux（含 WSL）。macOS Metal 已由 T0060 覆蓋，不在此範圍。
> **結論摘要**：**Vulkan-first 取代原 CUDA-first 路線**，走 EXP worktree 實驗分支流程。詳見 §6「推薦方案」。

---

## 1. 背景與前次研究差異

| 面向 | T0058（2026-04-12） | T0236（2026-04-23，本報告） |
|------|--------------------|----------------------------|
| whisper.cpp 最新版 | v1.7.4 | **v1.8.4**（2026-03-19）；v1.8.3（2026-01-15）為 Vulkan 分水嶺 |
| Vulkan 成熟度 | experimental、跨廠商不確定 | **穩定**，NVIDIA/AMD/Intel 全覆蓋，10x CPU |
| CUDA 生態 | 需 fork whisper-node-addon 或換 nodejs-whisper（需 build tools） | 現況未變，prebuilt 仍付之闕如 |
| 跨平台 prebuilt | 無 GPU 方案 | **`@kutalia/whisper-node-addon@1.1.0`** 已 ship Win/Linux Vulkan prebuilt |
| iGPU 支援 | 未討論 | whisper.cpp v1.8.3 專為 iGPU 做 12x 優化（Vulkan 路徑） |

**核心變化**：Vulkan 在 2025 下半年到 2026 Q1 從「實驗品」變成「BAT 場景首選」；CUDA 仍有 20-30% 理論速度優勢，但對語音辨識這種「幾秒鐘音訊 → 幾 GB RAM + GPU」的工作負載意義不大。

---

## 2. 範圍項 1 — CUDA 生態 2026 現況

### 2.1 `nodejs-whisper`（ChetanXpro）

| 指標 | 現況 |
|------|------|
| 最新版 | v0.2.9（2025-05-25，11 個月未更新） |
| `withCuda: true` | ✅ 支援 |
| Prebuilt | ❌ **沒有** — 需使用者機器具 make / cmake / MinGW |
| Electron 支援 | ❌ 文件未提及，需自行驗證 ABI |
| 維護 | 低頻（7 個 release，305 commits） |

**生產可用性結論**：不適合作為主線依賴 — 對使用者要求 build tools，violates BAT「零環境配置」原則。

### 2.2 whisper.cpp 原始 CUDA 編譯

依 context7 取得的 upstream CMakeLists.txt：

```bash
# NVIDIA CUDA (Win + Linux 通用)
cmake -B build -DGGML_CUDA=1 -DCMAKE_BUILD_TYPE=Release
cmake --build build -j --config Release
```

關鍵 CMake 旗標：
- `GGML_CUDA=1`：啟用 CUDA 後端
- `GGML_CUDA_FA_ALL_QUANTS=1`（可選）：所有量化格式的 FlashAttention 模板
- `GGML_CUDA_GRAPHS=1`（預設 on）：CUDA Graph 加速
- `GGML_STATIC`：靜態連結 cuBLAS（Win 下不支援，自動 fallback 動態）

**依賴**：
- CUDA Toolkit 12.x（Win 需 MSVC 2019+，Linux 需 gcc ≥ 9）
- cuBLAS runtime（靜態連結 Linux ≈ 50 MB / 動態連結 Win ≈ 依賴使用者裝 Runtime）
- CCCL（CUB 3.2+）若用最新 FlashAttention

**編譯時間實測估計**：
- Win MSVC + RTX 級 CUDA arch（`compute_80;compute_86;compute_89`）：10-20 分鐘
- Linux gcc + 同 arch：5-10 分鐘（較快，parallel make）

**打包 binary 體積衝擊**：
- 動態連結 CUDA Runtime：主 `.node` ~20-30 MB，但使用者需裝 CUDA Toolkit（~2 GB）
- 靜態連結 cuBLAS（僅 Linux）：主 `.node` ~150-200 MB
- electron-builder NSIS installer 膨脹估計：**+150-300 MB**（CUDA 路徑）

### 2.3 現有 CUDA prebuilt 方案

**結論**：**沒有**任何 npm 套件同時滿足「Electron ABI 145 相容 + CUDA prebuilt + 零環境配置」。任何 CUDA 方案都需：
- BAT 自行 fork + 打包 CI 拉 CUDA Toolkit
- 或放棄 prebuilt，要求使用者裝 build tools（UX 爛）

---

## 3. 範圍項 2 — Vulkan 生態 2026 現況

### 3.1 whisper.cpp Vulkan backend 成熟度

| 指標 | 現況 | 來源 |
|------|------|------|
| 分支狀態 | **Stable**（非 experimental） | ggml-org/whisper.cpp master |
| 推薦優先級 | 與 CUDA/Metal 同級（ggml 後端平權） | 上游 README |
| v1.8.3 breakthrough | 專為 iGPU 做 12x 優化 | Phoronix 2026-01 報導 |
| 跨廠商覆蓋 | NVIDIA / AMD / Intel(dGPU + iGPU) | Vulkan discussion #2375 |
| 已知社群反饋 | RX 9070 XT ≈ 8x realtime（45 min TV episode） | @abhshk Medium 2026-04 |

**NVIDIA + Vulkan vs NVIDIA + CUDA 的速度比例**：
- 社群測試：Vulkan 約達 CUDA 的 **70-80%**（同硬體、同模型）
- 對 BAT Whisper 場景（幾秒到幾分鐘音訊）：差距可忽略

### 3.2 建置複雜度

```bash
# whisper.cpp Vulkan (Win + Linux)
cmake -B build -DGGML_VULKAN=1 -DCMAKE_BUILD_TYPE=Release
cmake --build build -j --config Release
```

**依賴**：
- Vulkan SDK（LunarG，Win 約 500 MB、Linux 透過 package manager）
- Shaderc（Vulkan SDK 內建，用於 GLSL → SPIR-V 編譯）
- GLSL compiler（同上）

**編譯時間**：3-8 分鐘（顯著快於 CUDA，因無 template instantiation 爆炸）

**binary 體積**：
- 主 `.node`：~30-50 MB（shader 程式以 SPIR-V 二進位嵌入）
- 不需 runtime libraries（Vulkan 是系統 driver 層，使用者 GPU driver 內建）
- **electron-builder installer 膨脹：+30-50 MB**（比 CUDA 少一個數量級）

### 3.3 Vulkan 已知限制

| 限制 | 影響 | 緩解 |
|------|------|------|
| 部分 Intel iGPU 不支援 compute feature | 無法啟用 GPU，須 CPU fallback | Runtime detect `vkGetPhysicalDeviceFeatures.shaderInt16`，偵測失敗則 `use_gpu: false` |
| 舊版 driver（< 2024）可能缺 required extension | 初始化失敗 | 在 BAT 啟動時 probe 一次，顯示「driver 太舊，請更新」提示 |
| Vulkan SDK 必要於編譯期（runtime 不需） | CI 需多裝一個 SDK | GitHub Actions 已有 LunarG SDK action |

---

## 4. 範圍項 3 — BAT 整合影響面

### 4.1 現行基礎

- `package.json`：`"whisper-node-addon": "^1.0.2"`（starNGC2237 原版，CPU-only）
- `electron/voice-handler.ts:434`：`use_gpu: process.platform === 'darwin'`（T0060 實作）
- Electron 41.x / Node 24 / native ABI 145 / node-addon-api `^8.x` 相容

### 4.2 三套可行路徑比較

| 路徑 | 套件變更 | 打包影響 | UX 衝擊 | 跨 GPU 覆蓋 |
|------|---------|---------|---------|------------|
| **A. Kutalia Vulkan prebuilt**（現成） | `whisper-node-addon` → `@kutalia/whisper-node-addon@1.1.0` | installer +30-50 MB；electron-builder 無特殊規則 | 零 — 自動偵測 GPU/CPU | NVIDIA + AMD + Intel(多數) |
| **B. BAT fork + rebase Vulkan** | 自建 `@bat/whisper-node-addon` fork（基於 Kutalia + rebase upstream v1.8.4） | 同 A，但 CI 多一步 Vulkan SDK | 同 A | 同 A，但含 v1.8.3 iGPU 優化 |
| **C. CUDA 路徑（nodejs-whisper 或自製 fork）** | `nodejs-whisper@0.2.9` 或 `@bat/whisper-node-cuda` | installer +150-300 MB；NSIS include CUDA DLL | 中 — 使用者可能需裝 CUDA Runtime；非 NVIDIA 使用者 fallback CPU | 僅 NVIDIA |

### 4.3 postinstall / asarUnpack 影響

參考 CLAUDE.md「mac 打包採雙 arch dmg」的 `asarUnpack` 經驗（bit-identical binary 在 universal build 會炸）：

- **路徑 A/B (Vulkan)**：Kutalia 套件結構與現有 `whisper-node-addon` 類似，`platform/<os-arch>/` 目錄佈局一致，現有 `asarUnpack` 規則可能已覆蓋；**需在 PoC 階段驗證** electron-builder 26.x 打包後 `.node` 是否可載入
- **路徑 C (CUDA)**：CUDA runtime DLL 需額外進 asarUnpack；installer 層可能需 custom NSIS script 處理 CUDA Toolkit 偵測

### 4.4 model catalogue 影響

所有路徑都沿用 GGML 格式（`ggml-*.bin`）。**無需**重寫 `electron/voice-handler.ts` 的 download / catalogue 邏輯，只需：
- 升級 `import` 路徑（若 A/B 路徑）
- 調整 `use_gpu` 平台判斷（改為 `true` + 依賴套件 auto-detect）

---

## 5. 範圍項 4 — PoC 可行性

### 5.1 PoC 策略（依 T0236 Q1.A + Q2.B 決策）

使用者環境：**Windows + NVIDIA GPU + Linux on WSL**
走向：**EXP worktree 實驗分支流程**（不直接 impl 主線，成熟後 `EXP-GPUWHIS-001` 正式化）

建議建立兩個 worktree：
- `exp/gpu-vulkan-poc`：驗證 Kutalia Vulkan prebuilt 在 BAT Electron 41 下可跑（primary）
- `exp/gpu-cuda-poc`：驗證 whisper.cpp CUDA 自編 + node binding（comparison baseline）

### 5.2 Vulkan PoC 腳本（exp/gpu-vulkan-poc）

```bash
# 在 BAT 專案根目錄執行
git worktree add ../bat-gpu-vulkan-poc -b exp/gpu-vulkan-poc

cd ../bat-gpu-vulkan-poc

# Swap package
npm uninstall whisper-node-addon
npm install @kutalia/whisper-node-addon@1.1.0

# Patch voice-handler.ts import 與 use_gpu
# (人工編輯：`import { transcribe } from '@kutalia/whisper-node-addon'` + `use_gpu: true`)

# 安裝 + rebuild native
npm install
npm rebuild

# 用 BAT 測試音訊驗證
npm run dev
# 在 BAT UI 開啟語音聽寫，讀取預備好的測試 wav，觀察:
#   - whisper 初始化是否 log「Vulkan backend selected」
#   - 推理速度是否顯著提升（預期 10x vs CPU）
#   - 是否有 crash / driver error

# 回報：
#   git log --oneline -5 > VULKAN_POC_RESULT.txt
#   附上 whisper 初始化 log 片段
#   附上 inferenceTimeMs 數據（CPU vs Vulkan）
```

**預期輸出**：
- commit hash（`[T0236 PoC Vulkan]`）
- `.node` binary 大小（`ls -lh node_modules/@kutalia/whisper-node-addon/platform/`）
- 推理時間比較表（CPU baseline → Vulkan）

**Show-stopper 信號**：
- Electron 41 ABI 145 不相容（`.node` load error）→ 需 fallback 到 Kutalia fork + rebuild 或 Path B
- Intel iGPU 使用者 probe 失敗率 > 10% → 需要 Runtime fallback 機制設計

### 5.3 CUDA PoC 腳本（exp/gpu-cuda-poc）

```bash
git worktree add ../bat-gpu-cuda-poc -b exp/gpu-cuda-poc
cd ../bat-gpu-cuda-poc

# 選項 1: nodejs-whisper（需 MinGW/MSYS2）
# npm uninstall whisper-node-addon
# npm install nodejs-whisper@0.2.9
# 編輯 voice-handler.ts 套用 nodejs-whisper API（注意：API 與 whisper-node-addon 不同）

# 選項 2: 純 whisper.cpp baseline（不綁 BAT）
cd /tmp
git clone https://github.com/ggml-org/whisper.cpp.git
cd whisper.cpp && git checkout v1.8.4
cmake -B build -DGGML_CUDA=1 -DCMAKE_BUILD_TYPE=Release
cmake --build build -j --config Release

# 下載模型（同 BAT 使用的）
bash ./models/download-ggml-model.sh base.en

# 跑測試音訊
./build/bin/main -m models/ggml-base.en.bin -f samples/jfk.wav
# 觀察：
#   - "CUDA0" 是否出現在 device 清單
#   - Load + encode + decode 時間
```

**CUDA PoC 主要驗證**：編譯能過 + 硬體 runtime 能跑。是否整合到 BAT 屬於 Phase 2 決策。

### 5.4 PoC 停損條件

| 條件 | 停損處理 |
|------|---------|
| Kutalia Vulkan + Electron 41 載入失敗 | 停 Vulkan PoC，切到 Path B（BAT fork + rebase） |
| Vulkan 速度 < CPU 1.5x（非預期 10x） | 檢查 driver / iGPU 相容性，紀錄硬體規格；不代表方案錯，可能只是該硬體情境 |
| CUDA 編譯 fail | 檢查 CUDA Toolkit 版本、MSVC 版本；若 upstream v1.8.4 不可編，記錄 issue 回 upstream |

---

## 6. 範圍項 5 — 雙軌實作計畫產出

### 6.1 路徑推薦（含 T0236 結論）

> **🎯 首推：Vulkan-first（取代 T0236 原本「CUDA-first + Vulkan fallback」假設）**

**理由**：
1. Kutalia prebuilt **現成可用**，零環境配置
2. 跨廠商覆蓋遠勝 CUDA（BAT 使用者含 AMD / Intel 筆電族群）
3. Installer 體積膨脹小一個量級（30-50 MB vs 150-300 MB）
4. Metal（darwin）走同一個套件自動偵測，無需分支邏輯
5. CUDA 速度優勢對 Whisper 場景無感

**CUDA 保留為 advanced tier**（非 Phase 1）：
- 給有 NVIDIA + 極致速度需求的使用者
- 未來可提供「切換 engine」選項，讓使用者自行 `npm install` CUDA 版

### 6.2 Phase 拆分建議（TL;DR）

```
Phase 1 (EXP-GPUWHIS-001)：Vulkan 整合 EXP 驗證          [L]
Phase 2 (EXP-GPUWHIS-001 → 主線)：正式化 + UI 偵測提示  [M]
Phase 3 (選做)：CUDA advanced tier                      [XL]
```

T-shirt sizing 判斷基礎：主要是 integration + 打包 CI + 跨平台驗證的工作量，不是 algo impl。

### 6.3 雙軌對比表（最終決策用）

| 面向 | Vulkan（Kutalia 路徑） | CUDA（nodejs-whisper 路徑） |
|------|----------------------|----------------------------|
| 成熟度 | 🟢 Stable（2026） | 🟢 Stable（2024+），但 Node binding 落後 |
| Prebuilt 可用 | ✅ Win+Linux+Mac | ❌ 皆需 build tools |
| 跨廠商 | NVIDIA+AMD+Intel | 僅 NVIDIA |
| 速度（vs CPU） | 10x | 10-15x（理論上快 20-30%） |
| Installer 膨脹 | +30-50 MB | +150-300 MB |
| UX 衝擊 | 零 | 中（可能需 build tools / CUDA runtime 提示） |
| Phase 1 拆單複雜度 | L | XL |
| BAT 現有 asarUnpack 規則相容 | 預期高（同 starNGC2237 結構） | 低（需額外 DLL 處理） |

### 6.4 風險清單

| 風險 | 機率 | 衝擊 | 緩解 |
|------|------|------|------|
| Kutalia 上游停更（2025-07 後沒 commit） | 中 | 中 | Phase 2 fork rebase 計畫（新工單 EXP-GPUWHIS-002） |
| Kutalia whisper.cpp fork 停在 v1.7.6 時代 | 高（事實） | 中 | 若 Vulkan 效能不理想，升級路徑是 BAT 自 fork + rebase upstream v1.8.4 |
| Electron 41 ABI 145 與 node-addon-api 8.3.1 不相容 | 低 | 高（整個方案崩） | PoC 第一件事就驗證；失敗則 fork + rebuild |
| Intel iGPU 使用者碰到 compute feature 不支援 | 中（只影響特定硬體） | 低（可 fallback CPU） | Runtime probe + 告知使用者 |
| Kutalia 套件宣稱 GPU auto-detect 但實測不選 Vulkan | 低 | 中 | PoC 驗證；若失敗自行 set `use_gpu: 'vulkan'`（若支援）或改走 Path B |

---

## 7. 建議 Phase 1 實作拆單結構

以下 4 張工單建議由塔台在本報告確認後派發（或併入 `EXP-GPUWHIS-001` 實驗分支）：

### T-A：Vulkan PoC worktree + 套件替換驗證（L）
- **Scope**：在 `exp/gpu-vulkan-poc` 走 §5.2 腳本，驗證 Kutalia Vulkan 在 BAT Electron 41 + Win/Linux WSL + NVIDIA GPU 可跑
- **成功判準**：whisper 初始化 log Vulkan 被選用 + 推理時間 ≥ 3x CPU + 無 crash
- **停損**：若 ABI 不相容或 GPU 不被選中，切 §6.4 第 3 行 fallback
- **產出**：commit hash + binary 大小 + 效能比較表

### T-B：electron-builder 26 打包驗證（M）
- **Scope**：基於 T-A 的 worktree，跑 `npm run dist` 確認 Win NSIS + Linux AppImage 打包產物能啟動、Vulkan `.node` 正確被 asarUnpack
- **成功判準**：NSIS installer 安裝到乾淨 Win VM 後 BAT 能啟動且 Vulkan 生效
- **前置**：T-A 綠燈

### T-C：Runtime GPU 偵測 + CPU fallback 策略設計（M）
- **Scope**：設計 BAT 啟動時 GPU detection 流程（Intel iGPU compute feature probe、driver 太舊提示），更新 `electron/voice-handler.ts` 與 Settings UI
- **成功判準**：Intel UHD 610（舊 iGPU）自動 fallback CPU 且有 UI 提示；RTX / RX 正常 Vulkan
- **前置**：T-A 綠燈；可與 T-B 平行

### T-D：EXP-GPUWHIS-001 正式化或 Phase 2 派工決策（S）
- **Scope**：T-A/B/C 全綠後，根據 PoC 結果決定：
  - **Option 1**：直接 PR 回主線（若 Kutalia upstream 夠穩）
  - **Option 2**：BAT 自 fork Kutalia + rebase whisper.cpp v1.8.4（若需 v1.8.3 iGPU 優化）
  - **Option 3**：退回紙上評估（若 PoC 有 show-stopper）
- **成功判準**：決策記錄入 `_decision-log.md`（新 D 編號）

---

## 8. Renew 建議

- [x] **結論清晰** → 塔台可派 Phase 1 impl 工單（T-A/B/C/D）
- [ ] 結論不清晰 → 建議 Renew（補充說明）
- [x] **建議改走 EXP** → 建議塔台 `*exp GPUWHIS-001 vulkan-first-integration`
  - 理由：使用者 Q2.B 選 EXP worktree；PoC 本質為實驗；成熟後再 PR 回主線符合 Local Rules EXP 工作流

---

## 9. 產出清單（給塔台驗收）

| 項目 | 狀態 |
|------|------|
| 技術選型報告 | ✅ 本檔案 `_ct-workorders/_spec-gpu-whisper-2026-04.md` |
| PoC commit hash | ⏳ 由 T-A 產出（本 session 未跑，遵循 Q2.B EXP 流程） |
| Phase 1 拆單建議 | ✅ §7（T-A/B/C/D 共 4 張） |
| 雙軌對比表 | ✅ §6.3 |
| 風險清單 | ✅ §6.4 |
| Renew 判定 | ✅ §8（結論清晰 + 建議走 EXP） |

## 10. 參考來源

- [whisper.cpp upstream](https://github.com/ggml-org/whisper.cpp)（v1.8.4 2026-03-19, v1.8.3 2026-01-15）
- [Kutalia/whisper-node-addon](https://github.com/Kutalia/whisper-node-addon)（@kutalia/whisper-node-addon@1.1.0 2025-07-18）
- [ChetanXpro/nodejs-whisper](https://github.com/ChetanXpro/nodejs-whisper)（v0.2.9 2025-05-25）
- [Phoronix: whisper.cpp 1.8.3 12x boost](https://www.phoronix.com/news/Whisper-cpp-1.8.3-12x-Perf)
- [Vulkan backend discussion](https://github.com/ggml-org/whisper.cpp/discussions/2375)
- [Running GPU Whisper on AMD (Medium)](https://medium.com/@abhshk/running-gpu-accelerated-whisper-on-an-amd-gpu-no-nvidia-required-e27ea20b2ccd)
- T0058 `_ct-workorders/_archive/workorders/T0058-whisper-gpu-acceleration-research.md`
- T0060（macOS Metal 啟用，已 DONE）

---

**撰寫者**：Worker（T0236 sub-session，2026-04-23 00:53 開始）
**下一步**：等塔台決策是否 `*exp GPUWHIS-001 vulkan-first-integration` 建立正式 EXP 工單
