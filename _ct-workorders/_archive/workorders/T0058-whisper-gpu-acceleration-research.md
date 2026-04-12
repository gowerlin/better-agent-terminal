# 工單 T0058-whisper-gpu-acceleration-research

## 元資料
- **工單編號**：T0058
- **任務名稱**：Whisper GPU/MLX 加速可行性調查
- **狀態**：DONE
- **建立時間**：2026-04-12 19:52 (UTC+8)
- **開始時間**：2026-04-12 19:56 (UTC+8)
- **完成時間**：2026-04-12 20:04 (UTC+8)

## ⚠️ 本工單為研究類 — 不做程式碼修改（GP005）

產出為調查報告，塔台根據報告決定後續行動。

## 工作量預估
- **預估規模**：中（需調查 npm 套件 + 原生編譯選項）
- **Context Window 風險**：中

## Session 建議
- **建議類型**：🆕 新 Session

## 任務指令

### 背景

BAT 使用 `whisper-node`（基於 `whisper.cpp`）做本地語音辨識。目前可能為 CPU-only。需調查 GPU 加速的可行性。

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）

### 調查項目

#### 1. 當前 whisper-node 狀態
- 確認 `package.json` 中 whisper 相關套件名稱和版本
- 確認是 prebuilt binary 還是從源碼編譯
- 確認目前的推理速度（從 debug log 或 T0049 報告的 `inferenceTimeMs`）
- 確認 whisper.cpp 的版本

#### 2. GPU 加速選項

**CUDA（Windows/Linux NVIDIA）**：
- whisper.cpp 是否支援 CUDA？如何開啟？
- whisper-node 是否有 CUDA prebuilt binary？
- 若需自行編譯，流程和依賴是什麼？
- 估計加速倍率

**Metal（macOS Apple Silicon）**：
- whisper.cpp 是否支援 Metal？
- whisper-node 是否有 Metal prebuilt binary？
- macOS 上是否預設已開啟 Metal？

**Vulkan（跨平台）**：
- whisper.cpp 是否支援 Vulkan？
- 是否為可行的跨平台 GPU 方案？

#### 3. MLX 評估
- MLX 是 Apple Silicon 專用，只能用 Python（`mlx-whisper`）
- 從 Electron/Node.js 呼叫 Python subprocess 的可行性
- 與 whisper.cpp Metal 比較，是否值得額外引入 Python 依賴

#### 4. 替代方案
- `whisper-node` 以外的 npm Whisper 套件是否有 GPU 支援？
- `@xenova/transformers`（ONNX Runtime + WebGPU）是否為可行替代？
- WebGPU in Electron（renderer process）的成熟度

#### 5. 建議

綜合以上，給出：
- 推薦方案（短期 vs 長期）
- 投資回報估算（開發時間 vs 推理速度提升）
- 風險評估

### 驗收條件
- [ ] 當前 whisper 套件和編譯方式已確認
- [ ] CUDA / Metal / Vulkan 各路徑可行性已分析
- [ ] MLX 方案已評估
- [ ] 替代套件已調查
- [ ] 推薦方案已提出
- [ ] **沒有修改任何程式碼**（GP005）

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

### 驗收條件核對
- [x] 當前 whisper 套件和編譯方式已確認
- [x] CUDA / Metal / Vulkan 各路徑可行性已分析
- [x] MLX 方案已評估
- [x] 替代套件已調查
- [x] 推薦方案已提出
- [x] **沒有修改任何程式碼**（GP005）

### 當前 Whisper 狀態

**套件**：`whisper-node-addon` v1.0.2（早期實驗性套件）
**whisper.cpp 版本**：v1.7.4（從 platform/ 目錄的 `.dylib` 名稱 `libwhisper.1.7.4.dylib` 確認）
**安裝方式**：prebuilt binaries（platform/ 目錄預編譯二進位，npm install 直接使用，不需編譯）
**推理速度**：未有 debug log 可查，但 `use_gpu: false` 硬編碼在 `electron/voice-handler.ts`，確認目前完全 CPU-only
**目前 GPU 設定問題**：voice-handler.ts 第 ~330 行明確傳入 `use_gpu: false`，但套件預設值是 `use_gpu: true`

### GPU 加速可行性

| 路徑 | 可行性 | 難度 | 加速預期 |
|------|--------|------|---------|
| **Metal（macOS）** | ✅ **已內建，現成可用** | 🟢 極低（1 行程式碼）| 3–5x CPU 速度 |
| **CUDA（Windows/Linux NVIDIA）** | ⚠️ 需重新編譯 | 🔴 高（需 CUDA SDK + cmake 重建）| 5–10x CPU 速度 |
| **Vulkan（跨平台）** | ⚠️ 需重新編譯 | 🔴 高（同 CUDA）| 2–4x CPU 速度 |
| **MLX（macOS Apple Silicon Python）** | ⚠️ 可行但不值得 | 🟡 中（需 subprocess + Python 依賴）| 3–6x CPU 速度，但 Metal 已夠 |

**平台 prebuilt 分析**：
- `win32-x64`：只有 `ggml-cpu.dll`，**無 CUDA / Vulkan**。即使設 `use_gpu: true` 也無效。
- `darwin-arm64`：有 `libggml-metal.dylib`，**Metal 已編譯進去！**
- `darwin-x64`：有 `libggml-metal.dylib`，**Metal 已編譯進去！**
- `linux-x64`：只有 `libggml-cpu.so`，**無 CUDA / Vulkan**。

### 替代方案評估

**nodejs-whisper（ChetanXpro）**：
- whisper-node-addon README 推薦的「成熟版」替代品
- 支援 `withCuda: true` 選項
- 缺點：不提供 prebuilt binary，需要使用者機器有 make/cmake 工具（Windows 需 MinGW/MSYS2）
- 適合需要 CUDA 的長期方案，但部署複雜度高

**@huggingface/transformers v4.0.1（原 @xenova/transformers）**：
- 使用 ONNX Runtime：
  - `onnxruntime-web`（WebGPU）：在 Electron renderer process 執行，利用瀏覽器 WebGPU API
  - `onnxruntime-node`：在 Electron main process 執行，可用 DirectML（Windows）或 CUDA provider
- 模型格式：需要 ONNX 版 Whisper（HuggingFace 有提供，但需重新下載）
- 模式轉換成本：高（需重寫 voice-handler.ts、下載流程、model catalogue）
- 優勢：真正的跨平台 GPU（WebGPU），代表未來趨勢
- 劣勢：目前成熟度不如 whisper.cpp；model 不互通

**whisper-node（whisper-node 套件）**：
- 說明：Runs local on CPU（官方描述明確標示 CPU-only）
- 直接排除

### 推薦方案

#### 短期（工時 1–2 小時，立即可做）
**macOS Metal 啟用**：只需修改 `electron/voice-handler.ts` 一行

```typescript
// 改前
use_gpu: false,

// 改後（含平台判斷）
use_gpu: process.platform === 'darwin',  // macOS prebuilt 已有 Metal，直接生效
```

風險極低：prebuilt binary 已包含 Metal；Windows/Linux 設為 `use_gpu: true` 也不會有問題（無 GPU 庫時 whisper.cpp 會自動 fallback CPU）。

**預期效益**：macOS 用戶（特別是 Apple Silicon）推理速度提升 3–5x，不需任何套件變更或重新編譯。

#### 中期（工時 3–7 天）
若要在 Windows/Linux 也支援 GPU：
- 評估 fork whisper-node-addon 並為 Windows 加入 CUDA 編譯（需 CI 和 CUDA SDK）
- 或改用 nodejs-whisper，接受「需要使用者本機有 build tools」的限制
- 更好方案：等 whisper-node-addon 官方加入 CUDA prebuilt（套件仍在早期實驗階段，未來可能會更新）

#### 長期（工時 1–2 週）
遷移到 `@huggingface/transformers` + ONNX Runtime WebGPU：
- 真正跨平台 GPU 支援
- 模型格式遷移（ggml → ONNX）
- Electron renderer process 執行（WebGPU via Chromium）
- 適合 BAT v3.0 以上的重構週期

### 遭遇問題
無。whisper-node-addon README 坦承套件為「early experimental phase」，這是選用此套件的固有風險。

### 回報時間
2026-04-12 20:04 (UTC+8)
