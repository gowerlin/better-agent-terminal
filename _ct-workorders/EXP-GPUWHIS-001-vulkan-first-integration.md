# EXP-GPUWHIS-001 — Vulkan-first Whisper 整合實驗

## 元資料

| 欄位 | 內容 |
|------|------|
| **編號** | EXP-GPUWHIS-001 |
| **TOPIC** | GPUWHIS(GPU Whisper 加速實驗系列) |
| **狀態** | 🧪 EXPLORING |
| **建立時間** | 2026-04-23 01:10 (UTC+8) |
| **驅動決策** | D075(T0236 研究結論,Vulkan-first 翻轉) |
| **關聯 PLAN** | PLAN-004(GPU/MLX Whisper 加速,🔄 IN_PROGRESS) |
| **關聯工單** | T0236(研究,✅ DONE,commit `f6a2720` + `28fa867`) |
| **研究報告** | `_ct-workorders/_spec-gpu-whisper-2026-04.md`(Worker 產出 360 行) |

---

## 實驗假設

**`@kutalia/whisper-node-addon@1.1.0` 的 Vulkan prebuilt 能在 BAT (Electron 41 / ABI 145) 環境成功整合,為 Windows + Linux 使用者提供零環境配置的 GPU 加速 Whisper,效能達 10x CPU,跨 NVIDIA/AMD/Intel iGPU 覆蓋**。

---

## Worktree 建立

> 建議在本實驗 Phase 1 第一張工單(T-A)建立 worktree,非本 EXP 元資料階段。

```bash
# 建議 worktree 命名
git worktree add ../bat-gpu-whisper-vulkan -b exp/gpu-whisper-vulkan

# 結果處理(依實驗結論)
# 成功(CONCLUDED)→ PR 回主線 → 清理 worktree
# 失敗(ABANDONED)→ 丟棄 worktree + 分支,主線零污染
```

---

## Phase 1 拆單計畫(4 張,繼承 T0236 Worker 建議)

| 工單 | 類型 | Sizing | 範圍 |
|------|------|--------|------|
| **T-A** | impl | L | Vulkan PoC worktree 建立 + 套件替換(`whisper-node-addon` → `@kutalia/whisper-node-addon@1.1.0`)+ 首次整合驗證 |
| **T-B** | impl | M | electron-builder 26 打包驗證(Vulkan prebuilt 能否被 asarUnpack 正確打入 installer) |
| **T-C** | impl | M | Runtime GPU 偵測 + CPU fallback 策略設計(`use_gpu` auto-detect 邏輯,失敗時 graceful degrade) |
| **T-D** | decision | S | Phase 2 派工決策:EXP 正式化 PR 回主線 / 繼續 Phase 2 擴張(CUDA advanced tier) / ABANDONED 回退 |

> 詳細拆單規格見 `_spec-gpu-whisper-2026-04.md` §7

---

## 成功標準(CONCLUDED 條件)

**全部達成才標 CONCLUDED**:

- [ ] Vulkan prebuilt 在 BAT Electron 41 / ABI 145 環境載入成功(無 native module 崩潰)
- [ ] 實機跑一段測試音訊(任選現有),GPU 執行路徑確認(非 CPU fallback),輸出結果正確
- [ ] electron-builder 26 打包通過(installer 生成成功,Vulkan binary 正確包入)
- [ ] Runtime GPU 偵測邏輯 work:有 GPU 走 Vulkan、無 GPU 走 CPU、Vulkan 失敗走 CPU fallback
- [ ] installer size 增量符合預期(+30-50 MB 範圍內)
- [ ] 至少 2 個硬體環境實測通過(NVIDIA 必測,AMD/Intel 擇一必測)

---

## 失敗停損(ABANDONED 條件)

任一觸發即考慮 ABANDONED:

- ❌ Electron 41 ABI 145 與 Kutalia prebuilt 不相容,且 BAT 自 fork 修復成本 > 3 天
- ❌ Vulkan 實測效能 < 3x CPU(低於預期 10x,不值得 +30-50 MB installer)
- ❌ electron-builder 打包無解決方案(asarUnpack / 依賴路徑阻塞)
- ❌ 使用者 Phase 1 驗收觀察發現重大 UX 退化(比 CPU-only 更糟)

---

## 已識別風險(從 D075 繼承)

| 風險 | 機率 | 衝擊 | 緩解 |
|------|------|------|------|
| Kutalia fork 上游停更 | 中 | 中 | PoC 後評估是否 BAT 自 fork + rebase v1.8.4 |
| whisper.cpp 停在 v1.7.6(無 v1.8.3 iGPU 12x 優化) | 高 | 中 | 實測若效能不足 → fork + rebase |
| Electron 41 ABI 145 與 node-addon-api 8.3.1 不相容 | 低 | 高 | T-A 第一件事驗證,不相容則立刻 ABANDONED 或找 fork |
| Intel iGPU compute feature 不支援 | 中(影響特定硬體) | 低 | T-C CPU fallback 設計涵蓋 |
| installer 膨脹 > 50 MB | 低 | 低 | T-B 實測,若超出 accept 或調整壓縮 |

---

## 回報區(每張拆單完成後更新)

### T-A 產出(T0237,2026-04-23 01:31 完成,commit `bd27732`)

- **狀態**:✅ DONE(塔台接受 PARTIAL,見 D076)
- **結果摘要**:package 整合完美、硬體 perf 受限
  - Vulkan 被選用 ✅、零 crash ✅、效能 0.99x CPU ❌(base.en,GTX 1050 Ti 無 fp16)
- **產出**:
  - Worktree:`../bat-gpu-vulkan-poc` (branch `exp/gpu-vulkan-poc`)
  - binary 總計:~80 MB / Win x64 平台(ggml-vulkan.dll 29MB + libopenblas.dll 49MB + whisper.node 404KB)
  - 效能比較表、log 片段見 T0237 回報區
- **意外發現**(收入 D076):Kutalia v1.1.0 API 破壞變更(`{ transcription: ... }` unwrap)、v1.8.3 無解 fp16、T-B 需補 asarUnpack、體積 ~320MB 四平台
- **對 T-B/C/D 啟示**:
  - T-B 必須補 `@kutalia/whisper-node-addon` 到 electron-builder asarUnpack config
  - T-C runtime detection 要涵蓋 CPU fallback(use_gpu: true 已為 auto-detect,但需驗證 driver 太舊 / Intel iGPU compute feature 的行為)
  - T-D PR 回主線時 type 定義需補 unwrap 處理

### T-B 產出
<!-- 派發後填寫 -->

### T-C 產出
<!-- 派發後填寫 -->

### T-D 決策
<!-- Phase 2 派工決策 -->

### 最終結論

<!-- EXPLORING → CONCLUDED / ABANDONED 時填寫 -->

---

**建立者**:Control Tower(第二十一 session,2026-04-23 01:10)
**下一步**:派發 T-A(Vulkan PoC 首張),優先級 🟡 Medium,`--mode on --interactive` 維持(Worker 可詢問 worktree 命名/Electron ABI 驗證策略)
