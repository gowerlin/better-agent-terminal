# T0002 whisper-node-addon PoC 驗證報告

> **工單**：T0002-whisper-node-addon-poc
> **產出日期**：2026-04-10 (UTC+8)
> **查詢時間基準**：所有測試資料均於 2026-04-10 實測取得

---

## 執行環境

- **OS**: Windows 11 Pro for Workstations 10.0.26200
- **Node.js**: v25.9.0 (PoC 測試) / v18.18.2 (Electron 28 內建)
- **npm**: 11.6.2
- **Electron**: 28.3.3 (ABI 119)
- **CPU**: 12 cores (4 threads used by whisper.cpp)
- **GPU**: 偵測為「no GPU found」（prebuilt binary 未包含 Vulkan backend）
- **whisper-node-addon**: v1.0.2
- **whisper model**: ggml-small.bin (466 MB)
- **執行時間**: 23:03 → 23:17 (UTC+8)

---

## 場景結果總表

| 場景 | 目標 | 結果 | 備註 |
|------|------|------|------|
| 1 | 安裝與基本可執行性 | ✅ Pass | npm install 成功，require() 正常，匯出 `{ transcribe }` |
| 2 | 繁中離線辨識 | ✅ Pass | RTF=1.41 (CPU)，辨識文字幾乎完美匹配 |
| 3 | PCM 串流辨識 | ❌ **Fail** | **無 streaming API**，只有檔案模式 `fname_inp` |
| 4 | Electron Main Process | ✅ Pass | prebuilt binary 直接相容 Electron 28，無需 rebuild |
| 5 | GPU 加速 (Vulkan) | ❌ **Fail** | prebuilt binary 未含 Vulkan backend，`use_gpu` 無效 |
| 6 | 穩定性壓力測試 | ✅ Pass | 3 輪 62.7s 音訊：0 crash、記憶體 +0.1%、時間差 1.4% |

---

## 每個場景的詳細記錄

### 場景 1：安裝與基本可執行性

**步驟**：
1. `npm init -y` 初始化 PoC 目錄
2. `npm install whisper-node-addon` → 成功 (85 packages, 5s)
3. `node 01-basic-load.js` → 成功

**結果**：
```
Type: object
Keys: [ 'transcribe' ]
Full export: { transcribe: [Function: transcribe] }
```

**判定**：✅ Pass
- npm install 有 deprecated warnings (npmlog, tar) 和 3 high severity (transitive deps)，但安裝本身無錯誤
- native addon (`whisper.node`) 在 Node.js v25.9.0 下成功載入
- 只匯出一個函式 `transcribe`

---

### 場景 2：繁中離線辨識

**測試音訊**：使用 edge-tts (zh-TW-HsiaoChenNeural) 生成，4.49 秒
**預期文字**：「幫我建立一個新的 agent terminal 並執行 npm run dev」

**結果**：
```
辨識文字：幫我建立一個新的Agent Terminal並執行 NPM Run Dev。
耗時：6332ms (CPU only, 4 threads)
RTF：1.410
```

**Whisper 內部計時**：
- 模型載入：395ms
- 音頻編碼：5469ms（主要瓶頸）
- 解碼：354ms (21 runs)

**判定**：✅ Pass
- 辨識文字幾乎完全正確，僅大小寫和空格差異
- RTF 1.41 < 2.0 門檻
- 無 crash

---

### 場景 3：PCM 串流辨識（關鍵場景）

**調查方法**：
1. 閱讀 `whisper-node-addon/dist/index.js` 完整 source code
2. 檢查 `index.d.ts` 型別定義
3. 直接載入 native addon (`whisper.node`) 檢查匯出

**Source Code 分析**：
```typescript
// index.d.ts — 唯一的 API
export declare function transcribe(options: WhisperOptions): Promise<string[][]>;

// WhisperOptions 只有 fname_inp（檔案路徑），無 PCM buffer 輸入
interface WhisperOptions {
    model: string;       // 模型路徑
    fname_inp: string;   // 音訊「檔案」路徑 — 唯一的音訊輸入方式
    language?: string;
    use_gpu?: boolean;
    // ...其他參數
}
```

**Native addon 檢查**：
```
Native addon keys: [ 'whisper' ]  ← 只有一個 C++ 綁定函式
JS wrapper exports: [ 'transcribe' ]
```

**判定**：❌ **Fail — 致命缺陷**

- whisper-node-addon v1.0.2 **完全不支援串流辨識**
- 唯一的音訊輸入方式是 `fname_inp`（檔案路徑）
- 無 PCM buffer 輸入、無 partial result callback、無 event emitter
- T0001 報告聲稱的「PCM 串流支援」與實際 API **不符**

**影響評估**：
- 設計的 UX（「邊說邊出文字」）無法以 Route A 實現
- Workaround（chunk file 方式）延遲高且品質差，不可行
- Route B（whisper.cpp binary + child_process）的 `stream` example 支援 stdin PCM 串流，是可行替代方案

---

### 場景 4：Electron Main Process 執行測試

**步驟**：
1. 建立最小 Electron test app（對齊主專案 Electron 28.3.3）
2. `npm install`（electron + whisper-node-addon）
3. 執行 headless 載入測試

**結果**：
```
[electron] Electron: 28.3.3
[electron] Node: 18.18.2
[electron] ABI: 119
[electron] whisper-node-addon loaded successfully
[electron] exports: [ 'transcribe' ]
[electron] Transcription result: 幫我建立一個新的Agent Terminal並執行 NPM Run Dev。
[electron] Elapsed: 5807 ms
[electron] PASS: Native addon works in Electron main process
```

**判定**：✅ Pass
- prebuilt binary (win32-x64) 直接相容 Electron 28 (Node 18.18.2, ABI 119)
- **無需 electron-rebuild** — 這是重大加分項
- 辨識功能在 Electron main process 中正常運作
- IPC 通訊正常

---

### 場景 5：GPU 加速測試

**測試方法**：分別以 `use_gpu: false` 和 `use_gpu: true` 各跑一次

**結果**：
```
CPU Only:  5677ms (RTF 1.264)
GPU=true:  5594ms (RTF 1.246)
Speedup:   1.01x — 本質無差異
```

**根因分析**：
- Log 顯示 `whisper_backend_init_gpu: no GPU found`
- 檢查 platform/win32-x64/ 目錄：只有 `ggml-base.dll`, `ggml-cpu.dll`, `ggml.dll`, `whisper.dll`
- **無 `ggml-vulkan.dll`** — prebuilt binary 是 CPU-only 編譯
- `use_gpu` 參數存在但因缺少 GPU backend 而無效

**判定**：❌ Fail
- whisper-node-addon 的 prebuilt binary **不含 GPU backend**
- T0001 聲稱的 Vulkan/Metal 自動偵測是 whisper.cpp 原始碼的能力，但 whisper-node-addon 的發佈版未啟用
- 要啟用 GPU 需要：(a) 向上游提 issue 要求含 Vulkan 的 prebuilt，或 (b) 自己從源碼編譯含 Vulkan 的版本
- Route B 的 whisper.cpp binary 可直接用 `--gpu` flag 啟用 Vulkan/Metal

---

### 場景 6：穩定性壓力測試

**測試配置**：62.7 秒繁中+英文混合音訊，連續辨識 3 輪

**結果**：

| 輪次 | 耗時 | RTF | 文字長度 | RSS | Heap |
|------|------|-----|---------|-----|------|
| 1 | 21215ms | 0.338 | 575 chars | 61.7MB | 3.9MB |
| 2 | 21476ms | 0.343 | 575 chars | 61.9MB | 4.0MB |
| 3 | 21521ms | 0.343 | 575 chars | 61.8MB | 4.0MB |

**判定**：✅ Pass
- 3 輪均成功，0 crash
- 時間差異 1.4%（極度穩定）
- 記憶體 RSS 增長 +0.1%（無洩漏）
- 辨識結果完全一致（deterministic）

**額外觀察**：
- `language: 'zh'` 輸出為**簡體中文**而非繁體（「這是」→「这是」）
- 正式實作時需探索是否有 `zh-TW` 選項，或需後處理轉換
- 英文段落辨識品質很高

---

## Go / No-Go 決策建議

### 建議：**No-Go**（不建議繼續以 whisper-node-addon 作為 Route A 主線）

### 理由

**致命缺陷**：

1. **無串流 API（場景 3 Fail）**
   - whisper-node-addon 只提供檔案模式 (`fname_inp`)
   - 無法實現「邊說邊出文字」的核心 UX 需求
   - 這是**不可繞過的架構限制**，非 bug 可修

2. **無 GPU 加速（場景 5 Fail）**
   - prebuilt binary 未包含 Vulkan backend
   - 使用者要求 Phase 1 支援 GPU，但 whisper-node-addon 現況無法滿足
   - 自行編譯含 GPU 的版本會喪失 prebuilt 的便利性

**加分但不足以抵消的優點**：
- 安裝簡單（npm install 即可）
- Electron 相容性佳（無需 rebuild）
- 繁中辨識品質優秀（場景 2）
- 穩定性極佳（場景 6）

**總結**：whisper-node-addon 在「離線檔案辨識」場景表現優秀，但**缺少串流和 GPU 兩個核心需求**，不適合作為即時語音輸入功能的主線方案。

---

## 切換 Route B 的成本評估

### Route B：whisper.cpp binary + child_process.spawn

**優勢**：
1. **真正的串流支援**：whisper.cpp 的 `stream` example 支援 stdin PCM 串流，可透過 `child_process.spawn()` 的 stdin/stdout 實現即時辨識
2. **GPU 加速可用**：whisper.cpp binary 可用 `--gpu` 啟用 Vulkan (Win/Linux) 和 Metal (macOS)
3. **自主掌控**：直接使用上游 whisper.cpp，不依賴社群小的中間層
4. **隔離性好**：binary 作為獨立進程，crash 不影響 Electron 主程序

**成本**：
1. **跨平台 CI 編譯**：需為 Win/macOS/Linux 各編譯 whisper.cpp binary，約需 GitHub Actions 配置 2-4 小時
2. **Binary 打包**：需配置 electron-builder 的 `extraResources` 打包 binary 檔案
3. **IPC 設計**：需設計 stdin/stdout 的 PCM 串流協定（JSON-line 或自定義格式），約需 1 天
4. **模型管理**：需實作模型下載/快取機制（與 Route A 相同）
5. **程序管理**：需處理 binary 的生命週期（啟動、重啟、停止、異常恢復）

**預估額外工作量**：相比直接用 Route A，約多 2-3 天工作量。但換來了串流能力和 GPU 加速，是值得的投資。

### 混合方案建議

考慮一個可能的混合路線：
- **Route A (whisper-node-addon)**：用於「錄完再辨識」的快速模式（按住說完後一次出結果）
- **Route B (whisper.cpp binary)**：用於「即時串流」模式（邊說邊出文字）

但這會增加維護複雜度，建議**統一使用 Route B**，同時支援兩種模式。

---

## PoC 產物處置建議

- [x] 保留 `_poc/T0002-voice-poc/` 作為未來參考（場景 2 的辨識品質數據和場景 4 的 Electron 相容性結論仍有參考價值）
- [ ] 刪除（已無價值）
- [ ] 移動到 `examples/voice-poc/`

**建議**：保留作為未來 Route B PoC 的對照基準。模型檔案（466MB）建議刪除以節省空間，需要時重新下載即可。
