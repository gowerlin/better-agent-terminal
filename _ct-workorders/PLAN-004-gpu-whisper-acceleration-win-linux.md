# 💡 PLAN-004：GPU/MLX Whisper 加速（Windows/Linux CUDA、Vulkan）

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-004 |
| **狀態** | 🔄 IN_PROGRESS — Phase 1(Vulkan)✅ DONE,Phase 2(CUDA advanced tier)必要性待重新評估 |
| **歷程** | T0236 研究 ✅ DONE → D075 技術方向決策 → EXP-GPUWHIS-001 📊 CONCLUDED(T0237/T0238/T0239/T0240 全綠 → squash merge `cb65614`)→ BUG-057 `translate` 預設值修復(`b2124b5`)|
| **原狀態** | 📋 PLANNED |
| **優先級** | 🟡 Medium |
| **提出時間** | 2026-04-12 (UTC+8) |
| **提出人** | 塔台（T0058 GPU 加速研究） |
| **預估規模** | 大（需要重新選擇 whisper 套件或自行編譯） |
| **類型** | 功能改善 |

---

## 動機 / 背景

T0058（Whisper GPU 加速研究）和 T0060（Metal GPU macOS）已完成：
- ✅ macOS：Metal GPU 已透過 T0060 啟用（whisper-node-addon prebuilt 含 Metal 支援）
- ❌ Windows：whisper-node-addon prebuilt 是 CPU-only（binary 分析確認）
- ❌ Linux：同樣 CPU-only

Windows/Linux 的 GPU 加速需要：
1. **CUDA（NVIDIA）**：切換到 `nodejs-whisper`（支援 `withCuda: true`）或自行編譯 whisper.cpp + CUDA
2. **Vulkan（跨平台）**：whisper.cpp v1.7.4+ 支援 Vulkan，需自行編譯

## 預期效益

- Windows/Linux 用戶語音辨識速度提升（CUDA 可達 5-10x 加速）
- 降低 CPU 使用率，改善 BAT 整體響應性

## 風險

- 需要用戶安裝 CUDA Runtime（依賴更重）
- 自行編譯複雜，維護成本高
- Vulkan 方案較新，穩定性待驗證

## 相關單據

- **研究報告**：`_ct-workorders/T0058-whisper-gpu-acceleration-research.md`（完整調查）
- **相關決策**：§G Q3（Phase 1 CPU-only，Phase 1.5 補 GPU）

## 塔台決策

- **決定**：Phase 1 完成(Vulkan 零配置跨 vendor 整合);Phase 2(CUDA advanced tier)待重新評估
- **建議時機**:~~Phase 1.5 或以後~~ → Phase 1 已收官
- **Phase 2 必要性評估**(2026-04-23 session 22 決議記錄):
  - Phase 1 Vulkan-first 已涵蓋跨 vendor(NVIDIA / AMD / Intel Arc),對大多數使用者零配置
  - Phase 2 CUDA advanced tier 僅對 fp16 高階 GPU(RTX 30/40 / Ada)有額外效益,本機 GTX 1050 Ti Pascal 無 fp16 支援(T0237 實測 perf 0.99x CPU,D076)
  - **暫緩 Phase 2 排程**,待 EXP-GPUWHIS-002(未來硬體升級後實測)有明確 ROI 證據再啟動
  - 若使用者回報 fp16 GPU 上 Vulkan 效能不足,再優先評估
