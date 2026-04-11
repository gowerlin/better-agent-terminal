# T0001 語音輸入功能技術評估報告

> **工單**：T0001-voice-input-tech-research
> **產出日期**：2026-04-10 (UTC+8)
> **查詢時間基準**：所有版本號與外部資訊均於 2026-04-10 查詢，可能隨時間變動

---

## 目錄

- [§A. VSCode Speech 技術底層調研](#a-vscode-speech-技術底層調研)
- [§B. whisper.cpp 整合可行性評估](#b-whispercpp-整合可行性評估)
- [§C. 備選方案評估](#c-備選方案評估)
- [§D. Electron IPC 架構設計](#d-electron-ipc-架構設計)
- [§E. UI/UX 設計草稿](#e-uiux-設計草稿)
- [§F. claude-code terminal 整合可行性](#f-claude-code-terminal-整合可行性)
- [§G. 風險清單與前置決策](#g-風險清單與前置決策)
- [總結與推薦路線](#總結與推薦路線)

---

## §A. VSCode Speech 技術底層調研

### Q1: VS Code Speech 擴充實際用的是什麼引擎？

**結論：使用 Azure Speech SDK，非 OpenAI Whisper。**

VS Code Speech (`ms-vscode.vscode-speech`) 的 Marketplace 頁面明確聲明「built with the Azure Speech SDK」。它**不是**基於 OpenAI Whisper 模型。微軟採用自家 Azure 語音技術的離線版本（on-device neural speech models），而非 Whisper 的 transformer 架構。

- 來源：[VS Code Speech Marketplace](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-speech)
- 來源：[VS Code Wiki - VS Code Speech](https://github.com/microsoft/vscode/wiki/VS-Code-Speech)

### Q2: 模型是本地還是雲端？檔案大小？

**本地處理，無需網路連線。**

官方明確聲明：「No internet connection is required, the voice audio data is processed locally on your computer.」

模型檔案大小未公開，但從擴充套件安裝包大小推測（Azure Speech SDK 離線模型通常 50-200 MB），模型內嵌於擴充套件中。

- 來源：[VS Code Speech Marketplace](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-speech)

### Q3: 是否開放給第三方 Extension API 重用？

**否，封閉於 VS Code 生態系。**

目前 VS Code Speech 的語音功能：
- 依賴 GitHub Copilot Chat extension
- 不暴露任何公開 API 供第三方 Extension 呼叫
- 不提供 npm 套件供外部應用整合
- Wiki 文件未提及任何可擴展的 speech API

### Q4: 授權條款？可商用？可嵌入 Electron App？

**不可直接嵌入。**

- 標記為「Free」但授權條款未公開完整文本
- 作為 VS Code 專屬擴充套件，其 Azure Speech SDK 離線模型**不可**獨立提取並嵌入第三方 Electron 應用
- Azure Speech SDK 的商業授權需要獨立的 Azure 訂閱

### Q5: 第三方要重現類似體驗的最佳路線？

**推薦路線：whisper.cpp + 本地模型**

理由：
1. **MIT 授權**，可自由商用嵌入
2. **離線運行**，符合隱私要求
3. **多語言支援**（含中文），符合繁中+英文需求
4. **社群活躍**（48.5k GitHub Stars），生態成熟
5. **多種整合方式**（Node binding、binary、WASM），可依需求選擇

備選：sherpa-onnx（11.5k Stars）使用 next-gen Kaldi + ONNX Runtime，也提供 Node.js 綁定。

---

## §B. whisper.cpp 整合可行性評估

### whisper.cpp 基本資訊

| 項目 | 值 |
|------|-----|
| GitHub | [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) |
| Stars | 48.5k |
| 最新穩定版 | v1.8.1 |
| 授權 | MIT |
| 支援平台 | Windows / macOS / Linux / iOS / Android / WASM |
| 查詢時間 | 2026-04-10 |

### Whisper 模型大小與精確度對照

| 模型 | 參數量 | 磁碟大小 (GGML) | 記憶體使用 | 相對速度 | 英文 WER | 多語 WER |
|------|--------|-----------------|-----------|---------|---------|---------|
| tiny | 39M | 75 MB | ~273 MB | ~10x | ~7.6% | ~12% |
| base | 74M | 142 MB | ~388 MB | ~7x | ~5.0% | ~10% |
| small | 244M | 466 MB | ~852 MB | ~4x | ~3.4% | ~7% |
| medium | 769M | 1.5 GB | ~2.1 GB | ~2x | ~2.9% | ~5% |
| large-v3 | 1,550M | 2.9 GB | ~3.9 GB | 1x | ~2.4% | ~3.5% |
| turbo | 809M | 1.6 GB | ~2.3 GB | ~8x | ~2.5% | ~3.7% |

> WER = Word Error Rate，數字越低越好。
> 來源：[Whisper Model Sizes Explained](https://openwhispr.com/blog/whisper-model-sizes-explained)
> **繁中 WER 通常比英文高 2-5 個百分點**，small 模型的繁中表現約 WER 8-12%。

**預設模型建議**：`small`（466 MB 磁碟，~852 MB RAM，繁中精確度可接受）

### 三條整合路線比較

#### 路線 A：Node Native Binding

| 套件 | Stars | 版本 | 最後更新 | 授權 | 方式 | 串流支援 | Electron |
|------|-------|------|---------|------|------|---------|---------|
| [whisper-node-addon](https://github.com/Kutalia/whisper-node-addon) | 14 | v1.1.0 | 2025-07 | MIT | N-API prebuilt binary | ✅ PCM 串流 | ✅ Zero-config |
| [nodejs-whisper](https://github.com/ChetanXpro/nodejs-whisper) | 202 | v0.2.9 | 2025-05 | MIT | 編譯 whisper.cpp | ❌ 檔案模式 | ❌ 無說明 |
| [whisper-node](https://github.com/ariym/whisper-node) | 299 | v0.3.1 | 2023-11 | MIT | 編譯 whisper.cpp | ❌ 檔案模式 | ❌ 無說明 |

**詳細評估**：

**whisper-node-addon** (⭐ 最推薦)
- 優點：
  - N-API 原生綁定，效能最佳
  - **預編譯 binary**：Windows x64、Linux x64/arm64、macOS x64/arm64 全覆蓋
  - **Zero-config Electron** 整合（官方聲明）
  - **支援 PCM 串流輸入**（非檔案模式），可實現即時辨識
  - GPU 加速：Vulkan (Windows/Linux) / Metal (macOS) 自動偵測
  - VAD (Voice Activity Detection) 內建
- 缺點：
  - Stars 極少 (14)，社群小
  - 「Early experimental phase」，API 可能破壞性變更
  - 原生模組需要 electron-rebuild 處理
- Electron 打包：需在 electron-builder 配置 native module rebuild，預編譯 binary 減輕大部分負擔
- 跨平台：✅ Windows / macOS / Linux 三平台均有 prebuilt
- **推薦等級：⭐ 最推薦**（唯一同時支援串流 + 預編譯 + Electron 的套件）

**nodejs-whisper** (👍 可接受)
- 優點：Stars 較多 (202)，社群有一定基礎
- 缺點：
  - 需要從源碼編譯 whisper.cpp（需要 build-essential / make / cmake）
  - **不支援串流**，只能處理完整音訊檔案
  - CI/CD 需要額外配置 C++ 編譯環境
  - 使用者安裝時需要編譯工具
- Electron 打包：較複雜，需確保各平台編譯工具鏈可用
- 跨平台：需要 MSYS2/MinGW (Windows)、build-essential (Linux)、Xcode CLI (macOS)
- **推薦等級：👍 可接受**（若 whisper-node-addon 太不穩定的備選）

**whisper-node** (⚠️ 不建議)
- 最後更新 2023-11，18 個 open issues，12 個未合併 PR
- 已實質停止維護
- **推薦等級：⚠️ 不建議**（已死專案）

#### 路線 B：編譯 Binary + child_process

**做法**：打包 whisper.cpp CLI binary（`main` 或 `stream`），main process 透過 `child_process.spawn()` 呼叫。

| 評估項目 | 說明 |
|---------|------|
| 跨平台編譯 | 需為 Win/macOS/Linux 各編譯一份 binary（GitHub Actions CI 可自動化） |
| 安裝包體積 | 每個平台 binary 約 5-15 MB（不含模型），三平台合計 15-45 MB |
| 效能 | 與原生相當，但每次呼叫有 process spawn 開銷（約 100-500ms） |
| 串流支援 | whisper.cpp `stream` example 支援 stdin 串流，但需自行實作 IPC 協定 |
| 更新機制 | 替換 binary 檔案即可，不需 npm rebuild |
| Electron 打包 | 需配置 extraResources 打包 binary，較直覺 |
| 調試難度 | 中等，child_process 的 stdout/stderr 需要 parsing |

**推薦等級：👍 可接受**

優點：隔離性好（crash 不影響主程序）、更新簡單、不需 native module rebuild。
缺點：spawn 開銷、跨平台 CI 編譯維護成本、串流 IPC 需自行設計。

#### 路線 C：WASM / Web Worker

**做法**：在 Electron renderer 的 Web Worker 中載入 whisper.cpp WASM 版本。

| 評估項目 | 說明 |
|---------|------|
| 主要實作 | [官方 whisper.wasm](https://ggml.ai/whisper.cpp/)、[whisper.wasm TypeScript wrapper](https://github.com/timur00kh/whisper.wasm)、[@remotion/whisper-web](https://www.remotion.dev/docs/whisper-web/) |
| 模型下載 | 需從 CDN 或本地載入 GGML 模型，首次載入可能數秒到數分鐘 |
| 首次啟動 | WASM 編譯 + 模型載入：small 模型約 5-15 秒 |
| 記憶體使用 | WASM 堆記憶體限制（通常 2-4 GB），small 模型 ~852 MB 可行，medium 可能吃緊 |
| GPU 加速 | ❌ WASM 無法使用 GPU（無 Vulkan/Metal/CUDA） |
| 效能 | 比 native 慢 2-5 倍。辨識 10 秒中文音訊：tiny ~2-3 秒，small ~8-15 秒 |
| 跨平台 | ✅ 完美跨平台（WASM 與 OS 無關） |
| 打包 | 無需 native module，最簡單 |
| 串流 | 官方有 [stream.wasm](https://ggml.ai/whisper.cpp/stream.wasm/) 即時辨識 demo，技術可行 |
| 瀏覽器限制 | 需 WASM SIMD 支援（Electron 28 ✅），SharedArrayBuffer 需要 COOP/COEP headers |

**推薦等級：👍 可接受（備選路線）**

優點：跨平台零配置、打包最簡單、隔離性好（Web Worker）。
缺點：效能損失明顯、無 GPU 加速、記憶體限制、SharedArrayBuffer 配置。

### 整合路線總結

| | 路線 A (Node Binding) | 路線 B (Binary + child_process) | 路線 C (WASM) |
|---|---|---|---|
| **效能** | ⭐⭐⭐ 最佳 | ⭐⭐⭐ 接近原生 | ⭐⭐ 慢 2-5x |
| **串流** | ✅ (whisper-node-addon) | ⚠️ 需自行設計 | ✅ (stream.wasm) |
| **跨平台** | ✅ prebuilt | ⚠️ 需 CI 編譯 | ✅ 完美 |
| **打包複雜度** | ⚠️ 需 rebuild | ⚠️ extraResources | ✅ 最簡單 |
| **GPU 加速** | ✅ Vulkan/Metal | ✅ 原生支援 | ❌ 不支援 |
| **維護風險** | ⚠️ 社群小 | ✅ 自主掌控 | ✅ 官方維護 |
| **推薦** | ⭐ 首選 | 👍 穩健備選 | 👍 輕量備選 |

**建議策略**：先以路線 A (whisper-node-addon) 為主要開發路線。若遇到穩定性問題，降級到路線 B (binary + child_process)。路線 C 作為快速原型驗證用。

---

## §C. 備選方案評估

### 1. faster-whisper (Python + CTranslate2)

| 項目 | 說明 |
|------|------|
| GitHub | [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) |
| 技術 | OpenAI Whisper 的 CTranslate2 最佳化版本，用 Python 包裝 |
| 速度 | 比原版 Whisper 快 4-5 倍，接近 whisper.cpp |
| 整合方式 | child_process 呼叫 Python 腳本 |
| 優點 | 成熟穩定、GPU 支援好 (CUDA)、精確度與原版 Whisper 相同 |
| 缺點 | **需要 Python runtime 作為依賴**（使用者環境可能沒有）、安裝包體積大（Python + CTranslate2 + 模型 > 1 GB）、冷啟動慢（Python import 開銷）|
| 離線契合度 | ✅ 完全離線 |
| **評估結論** | ⚠️ **不建議**。Python 依賴對 Electron 桌面應用是巨大負擔，使用者需另外安裝 Python 環境，維護成本高。whisper.cpp 能達到相近效能且無 Python 依賴 |

### 2. Web Speech API (瀏覽器內建)

| 項目 | 說明 |
|------|------|
| 技術 | 瀏覽器原生 `SpeechRecognition` / `webkitSpeechRecognition` API |
| 整合方式 | 純前端 JavaScript，renderer 直接呼叫 |
| 優點 | **零依賴、零安裝、即時可用**、極低複雜度、支援串流（`interim` results） |
| 缺點 | **需要網路**（Chrome/Electron 的實作需呼叫 Google 伺服器）、隱私問題（音訊上傳 Google）、繁中支援品質不穩定、辨識精確度低於 Whisper、Electron 中支援狀態不確定 |
| 離線契合度 | ❌ **不符合離線優先要求** |
| **評估結論** | ⚠️ **僅適合快速原型**。可作為開發初期的 placeholder 快速驗證 UI 流程，但不符合「離線優先」的核心需求，不可作為正式方案 |

### 3. sherpa-onnx (Next-gen Kaldi + ONNX Runtime)

| 項目 | 說明 |
|------|------|
| GitHub | [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) |
| Stars | 11.5k |
| 技術 | ONNX Runtime 推理，支援多種 ASR 模型（含 Whisper、Zipformer 等） |
| 整合方式 | 提供 Node.js addon 和 WASM 版本 |
| 優點 | **VS Code Speech 也使用 sherpa-onnx 做 KWS**（keyword spotting）、模型極小（Zipformer 14-20 MB）、支援串流、跨平台完整、支援 NPU 加速 |
| 缺點 | Node.js binding 文件較少、社群主力在 C++/Python/Android/iOS、繁中專屬模型可能需要另外訓練或微調 |
| 離線契合度 | ✅ 完全離線 |
| **評估結論** | 👍 **值得關注的備選**。若 whisper.cpp 整合遇到嚴重障礙，sherpa-onnx 是最有潛力的替代方案。其 Zipformer 模型極小 (14-20 MB)，載入速度快，但繁中支援需進一步驗證 |

### 4. OpenAI Whisper API / Azure Speech API (雲端)

| 項目 | 說明 |
|------|------|
| 整合方式 | REST API 呼叫 |
| 優點 | 精確度最高、無本地計算負擔、支援所有語言 |
| 缺點 | **需要網路**、需要 API Key、有使用費用、延遲較高 |
| 離線契合度 | ❌ **完全不符合離線要求** |
| **評估結論** | ⚠️ **僅作為極端 fallback**。若使用者願意配置 API Key 且需要最高精確度，可作為「進階選項」在 Settings 提供，但不應是預設路線 |

### 備選方案總結

| 方案 | 離線 | 精確度 | 複雜度 | 推薦 |
|------|------|--------|--------|------|
| whisper.cpp (§B) | ✅ | ⭐⭐⭐ | 中 | ⭐ 首選 |
| sherpa-onnx | ✅ | ⭐⭐ | 中 | 👍 備選 |
| Web Speech API | ❌ | ⭐⭐ | 極低 | ⚠️ 原型 |
| faster-whisper | ✅ | ⭐⭐⭐ | 高 | ⚠️ 不建議 |
| 雲端 API | ❌ | ⭐⭐⭐⭐ | 低 | ⚠️ fallback |

---

## §D. Electron IPC 架構設計

### 現有架構分析

本專案 IPC 採用標準的 `contextBridge` + `ipcRenderer.invoke` 模式：

```
Renderer (React)
  → window.electronAPI.{module}.{method}()     // 定義於 src/types/electron.d.ts
  → ipcRenderer.invoke('{channel}', ...args)    // 定義於 electron/preload.ts
  → ipcMain.handle('{channel}', handler)        // 定義於 electron/main.ts
```

目前 ElectronAPI 有以下 namespace：`pty`, `workspace`, `settings`, `dialog`, `clipboard`, `app`, `tunnel`, `shell`, `git`, `github`, `agent`, `supervisor`, `claude`, `debug`

**無任何 audio / voice / media device 相關 API**，需從零設計。

### ElectronAPI 擴充設計

```typescript
// === 新增至 src/types/electron.d.ts ===

/** 語音辨識片段 */
interface TranscriptSegment {
  /** 辨識文字 */
  text: string
  /** 片段開始時間（毫秒） */
  startMs: number
  /** 片段結束時間（毫秒） */
  endMs: number
  /** 偵測到的語言 */
  language: string
  /** 信心分數 0-1 */
  confidence: number
}

/** 語音辨識最終結果 */
interface TranscriptionResult {
  /** 完整辨識文字 */
  text: string
  /** 分段結果 */
  segments: TranscriptSegment[]
  /** 偵測到的語言 */
  detectedLanguage: string
  /** 總處理時間（毫秒） */
  processingTimeMs: number
}

/** 模型下載進度 */
interface ModelDownloadProgress {
  /** 模型名稱 */
  modelSize: string
  /** 0-100 */
  percent: number
  /** 已下載位元組 */
  downloadedBytes: number
  /** 總位元組 */
  totalBytes: number
  /** 下載速度 bytes/sec */
  speed: number
}

/** 語音辨識即時事件 */
interface VoiceStreamEvent {
  /** partial = 尚在辨識中, final = 該片段已確定 */
  type: 'partial' | 'final'
  /** 當前辨識文字 */
  text: string
  /** 偵測到的語言 */
  language: string
}

/** 錄音 session 資訊 */
interface RecordingSession {
  sessionId: string
  startedAt: number
}

// === ElectronAPI.voice namespace ===

interface ElectronAPI {
  // ... 現有 namespace ...

  voice: {
    // --- 模型管理 ---

    /** 取得可用模型清單及其狀態 */
    listModels(): Promise<Array<{
      size: string          // 'tiny' | 'base' | 'small' | 'medium'
      diskSize: string      // '75 MB', '466 MB', etc.
      downloaded: boolean
      path: string | null
    }>>

    /** 檢查指定模型是否已下載 */
    isModelDownloaded(modelSize: string): Promise<boolean>

    /** 下載模型（進度透過 onModelDownloadProgress 事件回傳） */
    downloadModel(modelSize: string): Promise<void>

    /** 取消下載 */
    cancelDownload(modelSize: string): Promise<void>

    /** 刪除已下載的模型 */
    deleteModel(modelSize: string): Promise<void>

    // --- 錄音與辨識 ---

    /** 開始錄音 + 辨識（main process 開始接收麥克風音訊） */
    startRecording(options: {
      modelSize: string
      language: string       // 'zh-TW' | 'en' | 'auto'
      enableStreaming: boolean
    }): Promise<RecordingSession>

    /** 停止錄音，取得最終結果 */
    stopRecording(sessionId: string): Promise<TranscriptionResult>

    /** 取消錄音（丟棄結果） */
    cancelRecording(sessionId: string): Promise<void>

    /** 檢查麥克風權限狀態 */
    checkMicPermission(): Promise<'granted' | 'denied' | 'prompt'>

    /** 請求麥克風權限 */
    requestMicPermission(): Promise<boolean>

    // --- 事件監聽 ---

    /** 即時串流辨識結果（partial / final 事件） */
    onStreamResult(callback: (event: VoiceStreamEvent) => void): () => void

    /** 模型下載進度 */
    onModelDownloadProgress(callback: (progress: ModelDownloadProgress) => void): () => void

    /** 錄音音量回報（用於 UI 顯示音量波形） */
    onAudioLevel(callback: (level: number) => void): () => void

    /** 錄音錯誤 */
    onRecordingError(callback: (error: { code: string; message: string }) => void): () => void
  }
}
```

### Main Process 端職責分工

```
┌─────────────────────────────────────────────┐
│                Renderer (React)              │
│  PromptBox.tsx                               │
│  ├─ 麥克風按鈕 UI                             │
│  ├─ 預覽框顯示 (onStreamResult)               │
│  ├─ 音量波形 (onAudioLevel)                   │
│  └─ 使用者操作 → window.electronAPI.voice.*   │
│                                              │
│  SettingsPanel.tsx                            │
│  ├─ 模型管理 UI (listModels / download)       │
│  └─ 語言偏好設定                               │
└─────────────┬───────────────────────────────┘
              │ IPC (contextBridge)
┌─────────────┴───────────────────────────────┐
│                Main Process                  │
│  voice-manager.ts (新建)                     │
│  ├─ 麥克風權限管理                             │
│  │   └─ session.setPermissionRequestHandler  │
│  ├─ 音訊擷取                                  │
│  │   └─ 接收 renderer 的 MediaStream PCM 資料 │
│  │       或 main process 直接使用 node 音訊庫  │
│  ├─ whisper.cpp 整合                          │
│  │   └─ whisper-node-addon 載入模型 + 推理     │
│  ├─ 模型管理                                  │
│  │   └─ 下載 / 刪除 / 路徑管理                 │
│  └─ 串流結果推送                               │
│      └─ webContents.send('voice:stream', ...) │
└─────────────────────────────────────────────┘
```

**職責分配原則**：

| 操作 | 執行位置 | 理由 |
|------|---------|------|
| 麥克風權限請求 | Main process | `session.setPermissionRequestHandler` 只能在 main process 設定 |
| 麥克風音訊擷取 | **Renderer** (MediaDevices API) | 瀏覽器環境原生支援 `getUserMedia`，音訊串流效率高 |
| 音訊 PCM 資料傳輸 | Renderer → Main (IPC) | 透過 SharedArrayBuffer 或 IPC event 傳送 PCM chunks |
| Whisper 推理 | Main process | 原生模組必須在 Node.js 環境執行，避免阻塞 renderer |
| 模型檔案管理 | Main process | 需要 fs 存取權限 |
| 即時結果推送 | Main → Renderer (IPC event) | `webContents.send` 推送 partial/final 結果 |

### 麥克風權限取得流程

```typescript
// electron/main.ts 新增

// 1. 設定權限處理器（允許 microphone）
session.defaultSession.setPermissionRequestHandler(
  (webContents, permission, callback) => {
    if (permission === 'media') {
      // 允許麥克風存取
      callback(true)
      return
    }
    // 其他權限維持預設行為
    callback(true)
  }
)

// 2. macOS 需在 Info.plist 加入麥克風使用說明
// electron-builder 配置：
// extendInfo:
//   NSMicrophoneUsageDescription: "BetterAgentTerminal needs microphone access for voice input."

// 3. Windows / Linux 無需額外權限配置（Electron 預設允許 getUserMedia）
```

**重要：macOS 額外步驟**

目前 `package.json` 的 `extendInfo` 已有 Documents/Desktop/Downloads 權限描述，需新增：

```json
"NSMicrophoneUsageDescription": "BetterAgentTerminal needs microphone access for voice input transcription."
```

### 模型檔案儲存位置

```
{app.getPath('userData')}/
└── whisper-models/
    ├── ggml-tiny.bin       (75 MB)
    ├── ggml-base.bin       (142 MB)
    ├── ggml-small.bin      (466 MB)  ← 預設
    └── ggml-medium.bin     (1.5 GB)
```

路徑範例：
- Windows: `%APPDATA%/better-agent-terminal/whisper-models/`
- macOS: `~/Library/Application Support/better-agent-terminal/whisper-models/`
- Linux: `~/.config/better-agent-terminal/whisper-models/`

### 即時串流機制

```
Renderer                          Main Process
   │                                  │
   │  voice:startRecording            │
   ├─────────────────────────────────►│ 初始化 whisper session
   │                                  │
   │  getUserMedia → AudioWorklet     │
   │  PCM chunks via IPC              │
   ├─────────────────────────────────►│ 餵入 whisper.cpp
   │                                  │
   │  voice:stream (partial)          │
   │◄─────────────────────────────────┤ webContents.send
   │  更新預覽框                       │
   │                                  │
   │  voice:stream (partial)          │
   │◄─────────────────────────────────┤
   │  更新預覽框                       │
   │                                  │
   │  voice:stopRecording             │
   ├─────────────────────────────────►│ 結束 session
   │                                  │
   │  TranscriptionResult             │
   │◄─────────────────────────────────┤ 返回最終結果
   │                                  │
   │  使用者確認 → 填入 textarea       │
```

IPC 頻道命名規則（遵循現有模式）：

| 頻道 | 方向 | 用途 |
|------|------|------|
| `voice:list-models` | invoke | 取得模型清單 |
| `voice:download-model` | invoke | 開始下載 |
| `voice:cancel-download` | invoke | 取消下載 |
| `voice:delete-model` | invoke | 刪除模型 |
| `voice:start-recording` | invoke | 開始錄音+辨識 |
| `voice:stop-recording` | invoke | 停止錄音 |
| `voice:cancel-recording` | invoke | 取消錄音 |
| `voice:check-mic-perm` | invoke | 檢查權限 |
| `voice:request-mic-perm` | invoke | 請求權限 |
| `voice:audio-data` | send (R→M) | PCM 音訊資料 |
| `voice:stream` | send (M→R) | 即時辨識結果 |
| `voice:download-progress` | send (M→R) | 下載進度 |
| `voice:audio-level` | send (M→R) | 音量 |
| `voice:error` | send (M→R) | 錯誤 |

### 錯誤處理策略

| 情境 | 處理方式 |
|------|---------|
| 模型未下載 | `startRecording` 前檢查 `isModelDownloaded`，未下載→ UI 顯示提示並引導至 Settings |
| 麥克風權限被拒 | `checkMicPermission` 返回 `denied` → UI 顯示系統設定引導（macOS: 系統偏好設定 → 隱私） |
| 辨識失敗 | `onRecordingError` 回報錯誤碼（如 `MODEL_LOAD_FAILED`、`AUDIO_DEVICE_ERROR`） |
| 模型下載中斷 | 支援斷點續傳（HTTP Range header），UI 顯示重試按鈕 |
| 記憶體不足 | whisper-node-addon 載入失敗時 catch error，建議使用者選擇較小模型 |
| 多個 session 衝突 | 一次只允許一個 recording session，若已有 active session 則拒絕新的 startRecording |

---

## §E. UI/UX 設計草稿

### 1. PromptBox 麥克風按鈕位置

```
┌─────────────────────────────────────────────────────────────┐
│ PromptBox                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ │  [textarea 輸入區域]                                     │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│                              [🖼️ Paste] [🎤 Mic] [➤ Send]   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- 麥克風按鈕位於 Paste 圖片按鈕和 Send 按鈕之間
- 若模型未下載，按鈕顯示為灰色 disabled 狀態，hover 提示「請先至 Settings 下載語音模型」

### 2. 錄音中的視覺狀態

```
┌─────────────────────────────────────────────────────────────┐
│ PromptBox                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ │  [textarea — 錄音中暫時 readonly]                        │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│                     [🖼️ Paste] [🔴⏺ 錄音中...] [➤ Send]     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

視覺回饋：
- 按鈕變為紅色圓形（REC 風格），帶呼吸動畫（opacity pulse 1s）
- 按鈕文字從 🎤 變為 🔴（或紅色圓點 + 脈動邊框）
- 可選：按鈕右側顯示音量條（3-5 格跳動的音量指示器）
- textarea 邊框變為藍色或紅色，指示錄音中

### 3. 預覽框位置與設計

**位置：PromptBox 正上方，浮動面板**

```
┌─────────────────────────────────────────────────────────────┐
│ 語音辨識預覽                                          [×]    │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│  "你好，我想要建立一個新的 API endpoint..."                   │
│  ▍                                        ← 游標閃爍=辨識中  │
│                                                              │
│  ┌──────────────┐                                            │
│  │ 🌐 zh-TW     │   00:05 已錄音                             │
│  └──────────────┘                                            │
│                                                              │
│                              [✅ 確認填入] [❌ 取消] [🔄 重錄] │
└──────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ PromptBox                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  [textarea]                                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                     [🖼️ Paste] [🔴⏺ 錄音中...] [➤ Send]     │
└──────────────────────────────────────────────────────────────┘
```

### 4. 預覽框顯示資訊

| 資訊 | 顯示方式 | 必要性 |
|------|---------|--------|
| 即時辨識文字 | 主要區域，串流更新 | ✅ 必要 |
| 偵測到的語言 | 左下角標籤 `🌐 zh-TW` | ✅ 必要 |
| 錄音時長 | 右下角 `00:05 已錄音` | ✅ 必要 |
| 信心分數 | ❌ 不顯示（避免資訊過載） | 選擇不顯示 |
| 段落計數 | ❌ 不顯示（語音輸入通常短句） | 選擇不顯示 |

### 5. 確認/取消按鈕

- **確認填入** `[✅]`：將預覽文字填入 textarea（append 或 replace 可配置）
- **取消** `[❌]`：丟棄辨識結果，關閉預覽框
- **重錄** `[🔄]`：清空當前結果，重新開始錄音
- 按鈕排列：預覽框底部右對齊

### 6. Settings 頁語音輸入區塊

```
┌─────────────────────────────────────────────────────────────┐
│ ⚙️ Settings                                                  │
│                                                              │
│  ┌─ 🎤 語音輸入 ──────────────────────────────────────────┐ │
│  │                                                        │ │
│  │  模型選擇                                               │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ ● tiny   (75 MB)   — 速度最快，精確度較低         │  │ │
│  │  │ ○ base   (142 MB)  — 平衡選項                     │  │ │
│  │  │ ○ small  (466 MB)  — 推薦，精確度好 ✅ 已下載      │  │ │
│  │  │ ○ medium (1.5 GB)  — 精確度最高，速度較慢          │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │  模型管理                                               │ │
│  │  small (466 MB)  [✅ 已下載]  [🗑️ 刪除]                │ │
│  │  medium (1.5 GB) [⬇️ 下載]   ████░░░░ 45%             │ │
│  │                                                        │ │
│  │  語言偏好                                               │ │
│  │  ┌──────────────────────┐                              │ │
│  │  │ 繁體中文 (zh-TW)  ▼  │                              │ │
│  │  └──────────────────────┘                              │ │
│  │  ☐ 啟用自動語言偵測                                     │ │
│  │                                                        │ │
│  │  快捷鍵                                                 │ │
│  │  ┌──────────────────────┐                              │ │
│  │  │ Ctrl+Shift+V      ▼  │                              │ │
│  │  └──────────────────────┘                              │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 7. 快捷鍵建議

| 候選 | 按鍵組合 | 衝突檢查 | 推薦 |
|------|---------|---------|------|
| **候選 1** | `Ctrl+Shift+M` | ❌ VS Code 預設為 Toggle Problems Panel。本專案可能無此功能但需確認 | 👍 可接受 |
| **候選 2** | `Ctrl+Shift+H` | ⚠️ VS Code 預設為 Replace in Files。需確認本專案是否有對應功能 | 👍 可接受 |
| **候選 3** ⭐ | `Alt+M` | ✅ **無已知衝突**。Alt+單字母在 Electron 中較少被佔用。M = Microphone 好記 | ⭐ **推薦** |

**衝突檢查方法**：

本專案 TerminalPanel.tsx 中已使用的快捷鍵：
- `Ctrl+Shift+V` / `Ctrl+V`：貼上
- `Ctrl+Shift+C` / `Ctrl+C`：複製
- `Shift+Enter`：換行
- `Alt+V`：xterm 圖片貼上 (`\x1bv`)

`Alt+M` 未被任何現有快捷鍵使用，且：
- Electron 預設無 `Alt+M` 綁定
- React 無 `Alt+M` 綁定
- xterm.js 會將 `Alt+M` 送至 terminal（ESC + m），但我們可在 PromptBox focus 時攔截

**推薦：`Alt+M`** — 無衝突、好記（M = Mic）、單手可操作。

---

## §F. claude-code terminal 整合可行性

### 調查結果

**claude-code terminal 的 UI 架構**：

1. **使用 xterm.js**：`TerminalPanel.tsx` 直接使用 `@xterm/xterm` Terminal 元件（行 2），所有輸入都透過 xterm 的 `onData` 事件處理（行 308），再經由 `window.electronAPI.pty.write()` 寫入 PTY。

2. **無獨立的 PromptBox**：`MainPanel.tsx` 行 197 明確表示：
   ```tsx
   {!isClaudeCode && showPromptBox && (
     <PromptBox terminalId={terminal.id} />
   )}
   ```
   PromptBox 僅對非 claude-code 的 agent terminal 顯示。claude-code terminal 的輸入完全在 xterm.js 內處理。

3. **無攔截鍵盤輸入的既有機制**：xterm.js 的 `onData` 直接轉發到 PTY，沒有中間層可以攔截或修改。

4. **有注入文字的既有機制**：`window.electronAPI.pty.write(terminalId, text)` 可將任意文字注入 PTY（行 308），等同於鍵盤輸入。

### 最小改動路線

若要為 claude-code terminal 加語音輸入：

1. **方案 A（最小改動）**：在 TerminalPanel 的工具列加一個浮動麥克風按鈕，辨識完成後透過 `pty.write(terminalId, recognizedText)` 注入文字到 xterm PTY。
   - 優點：不需修改 xterm.js 內部邏輯
   - 缺點：**無法實現預覽-確認流程**（文字直接送入 PTY，等同直接打字，無法 undo）

2. **方案 B（中等改動）**：為 claude-code terminal 也顯示一個簡化版 PromptBox 或浮動預覽框，辨識完成後使用者確認才注入 PTY。
   - 優點：可以有預覽-確認流程
   - 缺點：需要在 xterm.js 上方疊加 UI，可能有焦點衝突

### 結論：**部分可行**

| 面向 | 可行性 | 說明 |
|------|--------|------|
| 注入辨識文字 | ✅ 可行 | `pty.write` 機制已存在且成熟 |
| 預覽-確認流程 | ⚠️ 需額外 UI | 需在 xterm 上方加浮動預覽面板 |
| 與 Claude Code CLI 互動 | ⚠️ 需驗證 | Claude Code 的輸入處理方式可能影響文字注入效果 |
| 快捷鍵觸發 | ✅ 可行 | 在 TerminalPanel 的 keydown handler 攔截 `Alt+M` |

**建議**：
- **Phase 1（必做）**：先完成 Agent terminal PromptBox 的語音輸入
- **Phase 2（可選）**：評估 claude-code terminal 的方案 B，若使用者回饋有需求再實作

---

## §G. 風險清單與前置決策

### 塔台必須在實作前決定的開放問題

#### 1. 安裝包體積增量上限

**問題**：打包後安裝包增加多少可接受？

| 路線 | 預估增量 |
|------|---------|
| 路線 A (whisper-node-addon) | ~5-10 MB（原生模組 prebuilt binary） |
| 路線 B (binary) | ~5-15 MB（whisper.cpp CLI binary，每平台一份） |
| 路線 C (WASM) | ~3-5 MB（WASM binary） |

**注意**：以上不含模型檔案。模型由使用者按需下載到 userData。

**需決策**：是否接受安裝包增加 10-15 MB？

#### 2. 原生模組編譯步驟對 CI 的影響

**問題**：whisper-node-addon 需要 electron-rebuild，是否接受 CI 增加 1-3 分鐘編譯時間？

- 路線 A 有 prebuilt binary → CI 只需 `npm install`，影響小
- 若 prebuilt 缺少某平台 → 需在 CI 安裝 CMake + C++ 編譯器
- 路線 B/C 不需 native module rebuild

**需決策**：是否接受 CI 可能需要 C++ 編譯環境？

#### 3. GPU 加速支援

**問題**：是否需要 GPU 加速？

- whisper-node-addon 支援 Vulkan (Win/Linux) / Metal (macOS) 自動偵測
- GPU 加速對 small 模型辨識速度提升約 2-5 倍
- Windows GPU 支援可能需額外的 Vulkan runtime

**需決策**：
- 是否啟用 GPU 加速？（預設開啟但允許 fallback 到 CPU）
- Windows 是否要處理 Vulkan runtime 依賴？

#### 4. 模型預載策略

**問題**：預設模型要不要在第一次 App 啟動就開始背景下載？

使用者已確認：「Settings 頁提供下載按鈕，未下載前麥克風按鈕禁用」— 即**不自動下載**。

**但需追加決策**：
- 第一次啟動是否顯示一次性提示「語音輸入功能需要下載模型」？
- 是否在 Settings 顯示推薦模型的提示？

#### 5. whisper-node-addon 穩定性風險

**問題**：whisper-node-addon 自稱「early experimental」，Stars 僅 14，是否需要備選方案的實作準備？

**需決策**：
- 是否先建 PoC 驗證 whisper-node-addon 在三平台的穩定性？
- 若驗證失敗，是否直接切換到路線 B (binary + child_process)？
- 是否設定一個「驗證期限」（例如 T0002 完成前必須確認穩定性）？

#### 6. 音訊資料傳輸架構

**問題**：Renderer 錄製的音訊 PCM 資料如何高效傳輸到 Main process？

選項：
- **A**：IPC event 每隔 100ms 送一個 PCM chunk（簡單但可能有延遲）
- **B**：SharedArrayBuffer + Atomics（零拷貝，但需要 COOP/COEP headers 配置）
- **C**：Main process 直接使用 Node.js 音訊庫錄音（不經 renderer，但需額外依賴）

**需決策**：哪種音訊傳輸方案？建議先用 A（簡單），效能不足時再升級到 B。

#### 7. 繁中辨識品質驗證

**問題**：Whisper small 模型的繁中辨識品質是否足以投入生產？

- Whisper 的繁中 WER 資料稀少，無法從公開 benchmark 確認
- 需要實際測試：錄製 10-20 段常見程式開發語句，測量辨識率

**需決策**：是否在 T0002 安排一個繁中辨識品質測試子任務？

#### 8. 多語自動偵測 vs. 手動切換

**問題**：使用者已確認「支援多語言自動偵測，使用者可手動切換」。但 Whisper 的自動語言偵測在短句（< 5 秒）時準確度下降。

**需決策**：
- 預設是否開啟自動偵測？還是預設繁中、使用者主動切換？
- 自動偵測誤判時是否有快速修正機制？

---

## 總結與推薦路線

### 一句話建議

**使用 whisper-node-addon (N-API binding) 整合 whisper.cpp small 模型，先在 Agent terminal PromptBox 實作語音輸入，確認穩定後再評估 claude-code terminal 支援。**

### 推薦技術棧

| 層級 | 選擇 | 理由 |
|------|------|------|
| 引擎 | whisper.cpp | MIT 授權、離線、48.5k Stars、繁中支援 |
| 整合方式 | 路線 A: whisper-node-addon | 唯一支援串流 + prebuilt + Electron zero-config |
| 備選方案 | 路線 B: binary + child_process | 若路線 A 不穩定時降級 |
| 預設模型 | small (466 MB) | 繁中精確度與速度的最佳平衡 |
| 快捷鍵 | Alt+M | 無衝突、好記 |
| 範圍 | Agent terminal PromptBox 優先 | claude-code terminal 次優先 |

### 塔台下一步

1. **決議 §G 的 8 個開放問題**（特別是 #5 穩定性風險和 #6 音訊傳輸）
2. **建立 T0002**：whisper-node-addon PoC 驗證（三平台穩定性 + 繁中辨識品質測試）
3. **建立 T0003**：正式實作（依 PoC 結果選定最終路線）

---

> **本報告未修改任何專案原始碼。**
> 所有外部資訊查詢時間：2026-04-10 (UTC+8)
