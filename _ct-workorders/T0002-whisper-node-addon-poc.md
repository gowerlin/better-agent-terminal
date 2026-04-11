# 工單 T0002-whisper-node-addon-poc

## 元資料
- **工單編號**：T0002
- **任務名稱**：whisper-node-addon PoC 驗證 — Route A 核心情境 Go/No-Go 決策
- **狀態**：DONE
- **類型**：PROOF-OF-CONCEPT（沙箱程式碼，完成後可丟棄；不得汙染 src/ 或 electron/ production 路徑）
- **建立時間**：2026-04-10 22:54 (UTC+8)
- **開始時間**：2026-04-10 23:03 (UTC+8)
- **完成時間**：2026-04-10 23:17 (UTC+8)
- **目標子專案**：（單一專案，留空）
- **前置工單**：T0001（已完成，報告於 `_ct-workorders/reports/T0001-voice-input-tech-research.md`）

## 工作量預估
- **預估規模**：中（含實際安裝套件、下載模型、執行測試）
- **Context Window 風險**：中（需安裝 native module、執行 child process、讀取測試輸出）
- **降級策略**：若某平台（例：macOS/Linux）無法測試，標記該項為「已讀文件聲明但未實測」並回報 PARTIAL

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需要 fresh context 執行 npm 安裝、Electron 測試、大量 log 輸出

---

## 任務指令

### 任務定位

本工單是**PoC(概念驗證)**,目的是回答一個問題:

> **「`whisper-node-addon` 能不能作為 better-agent-terminal 語音輸入功能的 Route A 主線?」**

產出結果是**Go / No-Go 決策**,不是可上線的程式碼。所有 PoC 程式碼都**限制在 `_poc/T0002-voice-poc/` 目錄**,不得動 `src/`、`electron/`、`package.json`(主專案的)等 production 路徑。

---

### 前置條件

**必讀文件**:
- `_ct-workorders/reports/T0001-voice-input-tech-research.md`(§B 整合路線、§D IPC 架構、§G 開放問題)
- `package.json`(查看目前 Electron 版本、Node 版本需求,**只讀不寫**)

**使用者已決策的前置條件**(來自需求對齊):
- 包體積:**沒限制,好用最重要**(可自由嘗試任何方案)
- CI 優化:使用 GitHub Actions cache(本工單不需實作,只需在報告中確認 cache 可行性)
- **GPU 加速:Phase 1 要支援 Vulkan(Windows/Linux)+ Metal(macOS)自動偵測**
- 語言偵測:預設繁中,使用者可手動切換

---

### 輸入上下文

**專案技術棧**:
- Electron + React + TypeScript + Vite
- Platform: 當前開發環境為 **Windows 11**(執行 PoC 的主要平台)
- Node 版本與 Electron 版本請從 `package.json` 讀取確認

**T0001 §B 已選定**:
- **Route A**: `whisper-node-addon`(N-API binding)— 本工單要驗證的對象
- **Route B (fallback)**: `whisper.cpp` binary + `child_process.spawn`— 若 Route A 失敗,切換到此

**為什麼要做 PoC**:
whisper-node-addon 只有 14 GitHub stars,標記 experimental。雖然功能描述完美符合需求,但**社群太小**,直接投入正式實作有風險(可能到一半發現關鍵 bug 或平台相容性問題)。PoC 先驗證核心情境,才能安心投入後續 T0003+ 實作工單。

---

### PoC 工作範圍

**允許的動作**:
- 在 `_poc/T0002-voice-poc/` 目錄**新建**任何檔案
- 執行 `npm init` / `npm install` 在 PoC 子目錄(**不是**主專案)
- 下載 whisper small 模型檔案(儲存於 `_poc/T0002-voice-poc/models/`)
- 撰寫 Node.js 腳本、最小 Electron 測試 app、Bash 測試指令
- 錄製或使用測試音訊檔案(繁中、英文各 1-2 個)
- 執行測試、收集數據

**禁止的動作**:
- ❌ 修改主專案的 `package.json`、`src/`、`electron/`、`vite.config.ts`
- ❌ 修改任何 production code
- ❌ commit 任何 PoC 檔案到主 branch(使用者會決定 PoC 後要不要保留)
- ❌ 跳過驗證步驟直接寫「理論上可以」(PoC = 實測,不是文件研究)

---

### PoC 核心驗證情境

依序執行以下 **6 個驗證情境**,每個情境都要產出**明確的 Pass / Fail 結果** + 數據佐證。

#### 場景 1:安裝與基本可執行性

**目標**:確認 `whisper-node-addon` 能在 Windows 環境成功安裝並 load。

**步驟**:
1. 建立 `_poc/T0002-voice-poc/` 目錄
2. `npm init -y` 初始化 PoC package
3. `npm install whisper-node-addon`(或從 T0001 報告中查到的確切套件名)
4. 撰寫最小 Node.js 腳本 `01-basic-load.js`:
   ```js
   const whisper = require('whisper-node-addon');
   console.log('Loaded:', Object.keys(whisper));
   ```
5. 執行腳本,記錄輸出

**Pass 條件**:
- [ ] `npm install` 不報錯(可有 warning)
- [ ] 腳本能 `require` 成功
- [ ] 輸出包含預期的 API 方法名

**Fail 時記錄**:錯誤訊息、平台限制、node-gyp 編譯問題等

---

#### 場景 2:繁中音訊辨識(非 streaming)

**目標**:驗證 small 模型對繁中的辨識品質與速度。

**步驟**:
1. 下載 whisper small 模型:
   - 從官方:`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin`
   - 或 `whisper-node-addon` 可能自帶下載 API,優先用之
2. 準備測試音訊(以下擇一):
   - 從網路下載 Common Voice zh-TW 的公開樣本(`https://commonvoice.mozilla.org/zh-TW`)
   - 自錄一段繁中音訊(5~10 秒,內容:「幫我建立一個新的 agent terminal 並執行 npm run dev」)
   - 使用 `ffmpeg` 合成 TTS 音訊(若環境有 ffmpeg)
3. 撰寫 `02-zhtw-offline.js`:
   - 載入 small 模型
   - 輸入音訊檔案
   - 語言設為 `zh`
   - 輸出辨識文字 + 計時
4. 執行並記錄:
   - 辨識文字結果
   - 辨識耗時(ms)
   - 音訊長度(秒)
   - Real-time factor(RTF = 辨識耗時 / 音訊長度)

**Pass 條件**:
- [ ] 辨識文字可讀(不一定完全正確,允許少量錯字)
- [ ] RTF < 2.0(辨識速度不超過音訊長度 2 倍)
- [ ] 無 crash

---

#### 場景 3:PCM 串流辨識(關鍵場景)

**目標**:驗證 whisper-node-addon 是否真的支援「邊說邊出文字」的串流能力。這是**最關鍵**的場景,因為 T0001 設計的 UX 依賴串流。

**步驟**:
1. 查 whisper-node-addon 是否有 `streaming` / `partial` 相關 API
2. 若有 streaming API:
   - 撰寫 `03-streaming.js`,模擬每 200ms 餵一次 PCM chunk
   - 訂閱 partial result 事件
   - 記錄每次 partial 結果與時間戳
3. 若無 streaming API:
   - 記錄「whisper-node-addon 不支援 streaming」
   - 檢查 whisper.cpp 本身是否有 streaming 模式(透過 binary 可實現)
   - 評估:Route B(binary + child_process)能否透過 stdout 串流?

**Pass 條件**(Route A):
- [ ] Streaming API 存在且可呼叫
- [ ] 至少能收到 2 次以上的 partial 結果
- [ ] Partial 與 final 結果在語意上合理(partial 會逐漸完善)

**Fail 時**:
- **如果 whisper-node-addon 不支援 streaming**:記錄這是 Route A 的**致命缺陷**,PoC 結論應推薦切換 Route B
- **如果 Route B 也無法串流**:這會影響 T0001 設計的 UX,需要塔台重新評估是否接受「等全部說完才出結果」的降級體驗

---

#### 場景 4:Electron Main Process 執行測試

**目標**:驗證 whisper-node-addon 能在 Electron main process 穩定執行(不是純 Node.js)。

**步驟**:
1. 建立最小 Electron 測試 app(不使用主專案的 Electron 設定):
   ```
   _poc/T0002-voice-poc/electron-test/
   ├── package.json
   ├── main.js       // Electron main process,呼叫 whisper-node-addon
   ├── renderer.html // 最簡易 UI:一個按鈕、一個顯示區
   └── preload.js    // 暴露 IPC
   ```
2. Electron 版本對齊主專案(從主專案 `package.json` 讀)
3. 在 main process 載入 whisper-node-addon 並辨識場景 2 的測試音訊
4. 透過 IPC 把結果傳到 renderer 顯示
5. 執行 `npx electron .`

**Pass 條件**:
- [ ] Electron app 啟動成功
- [ ] Main process 成功 load whisper-node-addon(native module 與 Electron ABI 相容)
- [ ] 能完成一次辨識並顯示在 renderer
- [ ] 無 `Cannot find module` 或 native ABI mismatch 錯誤

**常見 Fail**:
- Electron 的 Node ABI 與主專案不符 → 記錄需要 `electron-rebuild` 步驟
- `prebuild-install` 沒有對應平台的 binary → 需要 fallback 到手動編譯
- IPC 通訊失敗 → 記錄原因

---

#### 場景 5:GPU 加速測試(Windows Vulkan)

**目標**:驗證使用者 Q3=B 的要求 — Phase 1 支援 GPU 加速自動偵測。

**步驟**:
1. 查 whisper-node-addon 是否暴露 GPU 選項(如 `use_gpu: true`、`ggml_backend` 選擇等)
2. 若有 GPU 選項:
   - 在 Windows 平台測試 Vulkan backend(當前平台)
   - 對比 CPU-only 與 Vulkan 的辨識速度(RTF)
   - 記錄 GPU 使用情況(可用 Windows Task Manager 或 `nvidia-smi`)
3. 若無 GPU 選項:
   - 記錄「whisper-node-addon 不支援 GPU」
   - 評估 Route B 的 whisper.cpp binary 是否能用 `-ngl`、`--vulkan` 等 flag 啟用 GPU
4. macOS Metal 與 Linux Vulkan:
   - 無法實測(當前平台為 Windows)
   - 查 whisper-node-addon 與 whisper.cpp 文件,**記錄官方聲明的支援狀態**,不猜測

**Pass 條件**:
- [ ] GPU 加速選項存在(Route A 或 Route B 其一即可)
- [ ] Windows Vulkan 實測 RTF 顯著優於 CPU-only(至少 1.5x 提升)
- [ ] macOS Metal 與 Linux Vulkan 有文件聲明支援

**Fail 時**:
- Route A 不支援 GPU → 評估 Route B 能否補上
- 兩個 Route 都不支援 GPU → 記錄為重大發現,塔台需重新評估 Q3 決策

---

#### 場景 6:穩定性壓力測試

**目標**:驗證套件能持續執行不崩潰(使用者可能開麥克風開很久)。

**步驟**:
1. 準備或合成一段長音訊(至少 3 分鐘,繁中+英文混合)
2. 撰寫 `06-stress.js`:
   - 連續辨識同一段長音訊 5 次
   - 記錄每次的耗時、記憶體使用量(`process.memoryUsage()`)
   - 檢查是否有 memory leak(每次記憶體是否持續增加)
3. 若場景 3 串流可用,改做串流版本的壓力測試:
   - 串流 10 分鐘以上的音訊
   - 觀察 partial 是否持續產出,是否有卡頓

**Pass 條件**:
- [ ] 5 次辨識均成功,無 crash
- [ ] 記憶體使用穩定(允許小幅增加,但不得線性增長)
- [ ] 每次辨識時間差異 < 30%(無嚴重效能退化)

---

### 預期產出

**1. 程式碼**(限制在 `_poc/T0002-voice-poc/`):
- `package.json`、`package-lock.json`
- `01-basic-load.js`、`02-zhtw-offline.js`、`03-streaming.js`、`06-stress.js`
- `electron-test/`(場景 4 的最小 Electron app)
- `models/`(下載的 small 模型,若過大可於報告中聲明「已下載但未 commit」)
- `audio-samples/`(測試音訊,附來源聲明)

**2. 報告**:`_ct-workorders/reports/T0002-whisper-node-addon-poc.md`

報告結構:
```
# T0002 whisper-node-addon PoC 驗證報告

## 執行環境
- OS: Windows 11
- Node.js: <version>
- Electron: <version>
- 執行時間: <start> → <end>

## 場景結果總表

| 場景 | 目標 | 結果 | 備註 |
|------|------|------|------|
| 1 | 安裝與基本可執行性 | ✅ Pass / ❌ Fail | ... |
| 2 | 繁中離線辨識 | ✅ / ❌ | RTF = ?, 辨識文字 = ... |
| 3 | PCM 串流辨識 | ✅ / ❌ / ⚠️ 部分 | ... |
| 4 | Electron Main Process | ✅ / ❌ | ... |
| 5 | GPU 加速 (Vulkan) | ✅ / ❌ | CPU RTF vs GPU RTF |
| 6 | 穩定性壓力測試 | ✅ / ❌ | 記憶體 baseline → peak |

## 每個場景的詳細記錄
(每個場景附:執行步驟、原始 log 摘要、數據、Pass/Fail 判定)

## Go / No-Go 決策建議

**建議**:Go / No-Go / Conditional Go

**理由**:
(若 Go,說明為什麼 whisper-node-addon 通過驗證,可進 T0003+ 正式實作)
(若 No-Go,說明為什麼失敗,建議切換 Route B,並列出 Route B 的已知資訊)
(若 Conditional Go,說明通過與不通過的條件,哪些情境需要塔台額外決策)

## 切換 Route B 的成本評估(必填,無論 Go 或 No-Go)
(若未來 whisper-node-addon 出問題需要切,大概需要改什麼?)

## PoC 產物處置建議
- [ ] 保留 `_poc/T0002-voice-poc/` 作為未來參考
- [ ] 刪除(已無價值)
- [ ] 移動到 `examples/voice-poc/` 並寫 README(若想保留為文件)
```

**3. 工單回報區**:填寫在本工單 `## 回報區`,與 T0001 相同格式

---

### 驗收條件

- [ ] `_poc/T0002-voice-poc/` 目錄已建立,含 6 個場景對應的程式碼
- [ ] 每個場景都有**實測執行記錄**(非紙上談兵)
- [ ] 報告的「場景結果總表」每一格都填寫,無「未執行」
- [ ] 若有場景 Fail,報告明確說明 Fail 原因與影響
- [ ] Go/No-Go 決策建議有明確結論,不模稜兩可
- [ ] **未修改主專案任何 production 檔案**(`src/`、`electron/`、根 `package.json`、`vite.config.ts` 等)
- [ ] `_poc/` 目錄的 `.gitignore` 設定合理(模型、node_modules 應 ignore)

---

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗、部分完成或需要後續指示,都必須填寫。

### 執行步驟

1. 讀取本工單全部內容
2. 讀取 `_ct-workorders/reports/T0001-voice-input-tech-research.md` 的 §B 整合路線細節(確認套件名稱)
3. 更新「開始時間」欄位
4. 建立 `_poc/T0002-voice-poc/` 目錄與 `.gitignore`
5. 按場景 1 → 2 → 3 → 4 → 5 → 6 順序執行
6. 每個場景執行前,記錄預期結果;執行後,記錄實際結果
7. 若某場景 Fail 且影響後續場景(例:場景 1 安裝失敗),跳過後續場景並回報 FAILED
8. 產出最終報告 `_ct-workorders/reports/T0002-whisper-node-addon-poc.md`
9. 填寫本工單回報區
10. 更新狀態(DONE / FAILED / BLOCKED / PARTIAL)

### 執行注意事項

- **所有操作限制在 `_poc/T0002-voice-poc/`**:任何對主專案路徑的修改意圖都必須停下來回報
- **實測優先**:遇到文件不清楚時,實際跑一下確認,不要猜測
- **記錄原始 log**:log 可能很長,擷取關鍵段落(錯誤、效能數據)寫入報告
- **時間管理**:若場景 6(穩定性)耗時過長,可縮短測試週期(例:3 分鐘音訊 ×3 次而非 ×5),並在報告中說明
- **若 Route A 確認失敗**:不要自己決定切 Route B 並開始實作,回報 Fail 後等塔台決策
- **macOS/Linux 無法實測**:不要假造數據,明確標記「僅 Windows 實測,其他平台依文件聲明」

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**程式碼** (`_poc/T0002-voice-poc/`)：
- `01-basic-load.js` — 場景 1：基本載入測試
- `02-zhtw-offline.js` — 場景 2：繁中離線辨識測試
- `03-streaming.js` — 場景 3：串流 API 調查
- `05-gpu-test.js` — 場景 5：GPU 加速測試
- `06-stress.js` — 場景 6：穩定性壓力測試
- `electron-test/` — 場景 4：Electron 整合測試 app
- `models/ggml-small.bin` — whisper small 模型 (466MB, gitignored)
- `audio-samples/` — TTS 生成的測試音訊 (gitignored)
- `.gitignore` — 排除 node_modules、模型、音訊

**報告**：`_ct-workorders/reports/T0002-whisper-node-addon-poc.md`

**場景結果**：4 Pass / 2 Fail (場景 3 串流、場景 5 GPU)

### 互動紀錄
無（全程自主執行，未遇需使用者決策的情境）

### 遭遇問題
1. T0001 報告聲稱 whisper-node-addon 支援「PCM 串流」，但實測 API 只有檔案模式 (`fname_inp`)，與報告不符
2. T0001 報告聲稱 Vulkan/Metal GPU 自動偵測，但 prebuilt binary 未包含 GPU backend DLL

### 關鍵發現亮點
1. **❌ 無串流 API** — whisper-node-addon 只有 `transcribe(fname_inp)` 檔案模式，無法實現「邊說邊出文字」的 UX
2. **❌ 無 GPU 加速** — prebuilt binary 是 CPU-only 編譯，`use_gpu` 參數無效
3. **✅ 繁中辨識品質極佳** — small 模型辨識「幫我建立一個新的Agent Terminal並執行 NPM Run Dev。」幾乎完美
4. **✅ Electron 零配置相容** — prebuilt binary 直接相容 Electron 28 (ABI 119)，無需 electron-rebuild
5. **⚠️ 繁中輸出為簡體** — `language: 'zh'` 預設輸出簡體中文，需要繁簡轉換或找 zh-TW 選項

### Go/No-Go 建議
**No-Go** — 缺少串流 API（致命缺陷）和 GPU 加速，不適合作為即時語音輸入的 Route A 主線。建議切換 Route B（whisper.cpp binary + child_process），可獲得串流 + GPU 能力。

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-10 23:17 (UTC+8)
