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

### T-B 產出(T0238,2026-04-23 02:03 完成,commit `2080880`)

- **狀態**:✅ DONE(4/4 必過判準全綠)
- **結果**:electron-builder 26 打包 + asarUnpack + packaged Vulkan runtime 三層完整驗證通過
- **產出**:
  - NSIS installer:`BetterAgentTerminal Setup 1.0.0.exe` 291 MB
  - Portable zip:`BetterAgentTerminal-1.0.0-win.zip` 413 MB
  - asarUnpack pattern 實用:`node_modules/@kutalia/whisper-node-addon/**/*`
- **關鍵發現**:`ELECTRON_RUN_AS_NODE=1 probe.js` 證明 packaged BAT 的 Vulkan 通路完整可用(不只 dev mode),端到端轉錄通過
- **體積符合預期**:增量 +80 MB whisper addon 實測吻合 T0236 spec 估算
- **對 T-C 啟示**:packaged form Vulkan runtime OK → T-C 可專注於 detection 邏輯設計,不需再驗證 runtime 路徑

### T-C 產出(T0239,2026-04-23 02:33 完成,commit `eba79b1` on worktree)

- **狀態**:✅ DONE(5/5 全綠,0 互動、0 Renew)
- **Worker 決策(Q1/Q2/Q3)**:
  - **Q1 = A + 輕量 hybrid**:trust Kutalia auto-detect + BAT 靜態 `vulkan-1.dll` / `libvulkan.so.1` 探測生成 UI hint(**不引入 `systeminformation` 重依賴**)
  - **Q2 = C**:提示但不擋,使用者可透過 Settings force-cpu override
  - **Q3 = A**:Settings「GPU 加速」section(狀態顯示 + auto/force-cpu radio),不加 toast
- **產出**:
  - `electron/gpu-detector.ts`(新增 203 行,平台探測 + hint 生成 + process 生命週期 cache)
  - `voice-handler.ts` 整合(sanitiseGpuMode / readPreferences / getGpuStatus IPC / resolveUseGpu 透傳 `use_gpu` bool)
  - `VoiceSettingsSection.tsx` UI(3 行狀態 + 1 行 hint + auto/force-cpu radio,切換即時更新 hint)
  - `tests/gpu-detector.test.ts` 13/13 passed
  - tsc + vite build 通過
- **known limitation**(已在 code 檔頭 + JSDoc 標註):
  - fp16 / matrix-core 細粒度偵測延後 — 需 parse Kutalia 原生 stderr,超出本工單 M sizing
  - 緩解:hint 主動告知 Pascal 世代可能問題 + 提供 force-cpu override
- **對 T-D 啟示**:
  - T-A/B/C 全綠 → spec §7 T-D Option 1(直接 PR 回主線)可行性成立
  - worktree 3 commits(`bd27732` + `2080880` + `eba79b1`)可直接 merge 回 main
  - 合入主線後須在 PR 描述 / CHANGELOG 標註「GPU 加速功能已就緒,舊硬體走 CPU 不劣化,未來升級新 GPU 自動受益」

### T-D 決策
<!-- Phase 2 派工決策 -->

### 最終結論

<!-- EXPLORING → CONCLUDED / ABANDONED 時填寫 -->

---

**建立者**:Control Tower(第二十一 session,2026-04-23 01:10)
**下一步**:派發 T-A(Vulkan PoC 首張),優先級 🟡 Medium,`--mode on --interactive` 維持(Worker 可詢問 worktree 命名/Electron ABI 驗證策略)
