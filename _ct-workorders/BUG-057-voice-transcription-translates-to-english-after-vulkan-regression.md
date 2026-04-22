# BUG-057 — 語音辨識改版後繁中被翻譯為英文（regression from `cb65614`）

## 元資料

- **編號**：BUG-057
- **類型**：bug
- **狀態**：🐛 OPEN
- **嚴重度**：🔴 **High**（繁中使用者核心功能完全不可用，輸出與輸入語意一致但語言錯誤）
- **建立時間**：2026-04-23 04:45 (UTC+8)
- **回報者**：使用者
- **可重現**：100%（每次繁中輸入皆被翻譯為英文）
- **可 workaround**：**無**（BAT voice UI 僅提供 auto / zh 兩選項，兩者皆中招）
- **回歸性質**：🔙 **Regression**，由 commit `cb65614` `feat(voice): GPU acceleration via Vulkan (EXP-GPUWHIS-001 Phase 1)` 引入
- **與 BUG-056 關係**：同源（皆為 `cb65614` regression），但性質不同（BUG-056 是 packaging 缺 native module；BUG-057 是 runtime 行為退化）
- **關聯單據**：
  - `cb65614`（regression commit）
  - EXP-GPUWHIS-001（📊 CONCLUDED，Phase 1）
  - T0239 T-C（runtime GPU detection，**高度懷疑改到 voice-handler 參數組裝**）
  - T0240 T-D（squash merge）
  - PLAN-004 Phase 1
  - BUG-056（同源但已 CLOSED，不直接關聯）
- **環境**：
  - 平台：Windows（T0242 修復後的 NSIS 安裝版）
  - 安裝路徑：`C:\Program Files\BetterAgentTerminal\`
  - Whisper backend：Vulkan（T0239 auto-detect 偵測到，使用者 T0242 截圖顯示「Vulkan loader: ✅ 偵測到」）

---

## 現象描述

### 預期行為
- **設定**：辨識語言 = 繁體中文（zh）+ 自動將辨識結果轉為繁體中文
- 使用者講繁體中文（例如「你好，今天天氣很好」）
- **預期輸出**：`你好，今天天氣很好`

### 實際行為
- 相同設定
- 使用者講相同繁體中文
- **實際輸出**：**精確翻譯為英文**（例如 `Hello, the weather is nice today`）
- 非拼音（`nǐhǎo`）、非音譯（`ni hao`）、非亂碼 → **是精確語意翻譯**

### 現象特徵
| 觀察 | 意義 |
|------|------|
| 精確語意翻譯為英文 | 辨識成功（模型有正確識別中文音訊） |
| 輸出是英文而非中文 | 翻譯階段介入 |
| 非拼音/音譯 | 排除 auto-detect 誤判為英文 |
| 100% 可重現 | 非隨機，是確定性 bug |
| 僅 auto 和 zh 兩選項皆中招 | 語言選項傳遞鏈斷裂 或 某個全局 flag 誤啟用 |

---

## 強假設：**H2 Whisper `translate: true` 誤啟用**

Whisper.cpp 有個獨特參數 `translate`：
- `translate: false`（預設）：辨識後輸出原語言
- `translate: true`：辨識後**翻譯為英文**輸出（whisper 內建 en-to-en 和 xx-to-en 翻譯能力）

使用者描述「精確翻譯為英文」**就是 `translate: true` 的招牌特徵**。若是 auto-detect 失敗，輸出應該是拼音或英文近似發音，而非精確語意。

---

## 塔台假設清單（待研究工單驗證）

| # | 假設 | 支持證據 | 優先調查 |
|---|------|---------|---------|
| **H2** | **Whisper `translate: true` 在 Vulkan backend 被誤啟用** | 精確翻譯為英文 = translate mode 招牌特徵 | ⭐ **最優先** |
| H1 | `language` 參數鏈路斷裂，whisper 走 auto-detect 後某處誤 `translate=true` | 使用者猜測「沒傳 lang=zh」；T0239 改到 GPU detection 可能連帶改到 voice options | ⭐ 次優先 |
| H5 | Settings UI → voice-handler IPC 漏傳欄位 | T0239 加了 GPU preference，可能連帶改了 IPC 結構 | 一併檢查 |
| H3 | ggml-vulkan vs ggml-cpu 語言 token 初始化差異 | 較冷門，但不能完全排除 | 若 H1/H2/H5 皆排除 |
| H4 | `@kutalia/whisper-node-addon` Vulkan 版本預設 options 改變 | 需比對 session 21 前後 package-lock.json 和 addon 文件 | 補充調查 |

---

## 影響範圍

- **所有繁中使用者**：語音辨識完全無法使用（輸出語言錯誤）
- **Session 21 後的安裝使用者**：含 T0242 NSIS 重裝後的使用者
- **不影響**：BAT 啟動（BUG-056 已修復）、終端操作、非語音功能
- **macOS**：未知（使用者未測，但 Metal backend 路徑**與 Vulkan 不同**，理論上不受影響 — 但需驗證）
- **Linux**：未知（PLAN-004 Phase 1 目標平台，需驗證）

---

## 建議處理

### Phase 1：派 T0244 研究工單（遵循 L103 ROI 原則）
- 靜態分析 `electron/voice-handler.ts` 的 whisper options 組裝
- Grep `translate`, `language`, `lang` 在整個 voice + gpu 相關 code
- 對比 `cb65614^` vs `cb65614` 的 voice-handler / gpu-detector diff
- 收斂到 **H1 / H2 / H5 其中一個（或組合）**
- 預估：10-20 min（根因空間小）

### Phase 2：派 T0245 修復工單
- 根據 T0244 結論最小 diff 修復
- Runtime 驗收：繁中 + auto 兩選項各測一次，確認輸出中文
- 預估：20-40 min（含 runtime 驗收）

### Phase 3：T0243（預防對策）排到最後
- 原 T0243（build fail-fast + CI `npm ci`）優先級降為 BUG-057 CLOSED 後派發

---

## 歷程

- **2026-04-23 04:34**：BUG-056 🚫 CLOSED，使用者在 Vulkan ✅ 截圖驗收後發現新問題
- **2026-04-23 04:45**：BUG-057 OPEN，使用者提供「精確翻譯為英文（非拼音）」關鍵特徵 → 塔台判定 H2 高度懷疑
- **(待)**：派 T0244 研究 → 根因確認 → 派 T0245 修復 → runtime 驗收 → CLOSED

---

## 回報區（Worker / 塔台補充）

（暫無）
