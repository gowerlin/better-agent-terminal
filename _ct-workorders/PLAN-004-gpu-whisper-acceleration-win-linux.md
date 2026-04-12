# 💡 PLAN-004：GPU/MLX Whisper 加速（Windows/Linux CUDA、Vulkan）

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-004 |
| **狀態** | 📋 PLANNED |
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

- **決定**：待分派
- **建議時機**：Phase 1.5 或以後（Phase 1 收官後）
