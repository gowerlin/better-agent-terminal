# T0237 — 實作:Vulkan PoC worktree 建立 + 套件替換驗證(EXP-GPUWHIS-001 T-A)

## 元資料

- **編號**:T0237
- **類型**:impl(實作 + 實機驗證,允許 Worker 互動以釐清環境 / 驗證策略)
- **狀態**:📋 TODO
- **派發模式**:`--mode on --interactive`(自動開新 tab + Worker 可問問題)
- **優先級**:🟡 Medium(平行投資,side quest,不阻塞主線)
- **Sizing**:L(3-8h,含 PoC 編譯 + 實機音訊測試)
- **建立時間**:2026-04-23 01:15 (UTC+8)
- **前置條件**:
  - T0236 ✅ DONE(技術選型研究已完成,commit `f6a2720`)
  - D075 ✅(Vulkan-first 決策已拍板)
  - EXP-GPUWHIS-001 🧪 EXPLORING(本 PLAN-004 Phase 1 實驗追蹤)
- **關聯**:
  - EXP-GPUWHIS-001 — T-A 本工單
  - `_ct-workorders/_spec-gpu-whisper-2026-04.md` §5.2(PoC 腳本)、§7 T-A(拆單規格)、§6.4(停損條件)
  - PLAN-004(🔄 IN_PROGRESS)
- **互動限制**:
  - Worker 可在 worktree 建立前 / PoC 執行前 / 停損判定前詢問使用者(每次上限 3 個問題)
  - 禁止:一般實作細節 / 格式問題
- **預估時間**:3-8 小時(worktree setup 30min / 套件替換 1h / 編譯 + rebuild 1-2h / 實機測試 + 報告 1-2h,含可能需要等使用者確認硬體)
- **Renew 次數**:0

---

## Scope(對照 spec §7 T-A)

在 **獨立 worktree** `exp/gpu-vulkan-poc` 驗證 `@kutalia/whisper-node-addon@1.1.0` Vulkan prebuilt 能在 BAT Electron 41 / ABI 145 + Windows + NVIDIA GPU 環境成功載入並跑一段音訊。

> ⚠️ **不合入主線**:本工單產出保留在 worktree,後續 T-B/C/D 成功後由 T-D 統一決定 PR 回主線 / ABANDONED。

---

## 執行步驟(對照 spec §5.2)

### Step 1:建立 worktree

```bash
# 在 BAT 專案根目錄(`/d/ForgejoGit/BMad-Guide/better-agent-terminal/better-agent-terminal`)
git worktree add ../bat-gpu-vulkan-poc -b exp/gpu-vulkan-poc
cd ../bat-gpu-vulkan-poc
```

### Step 2:套件替換

```bash
npm uninstall whisper-node-addon
npm install @kutalia/whisper-node-addon@1.1.0
```

### Step 3:程式碼 patch

- 修改 `electron/voice-handler.ts`:
  - `import { transcribe } from 'whisper-node-addon'` → `import { transcribe } from '@kutalia/whisper-node-addon'`
  - 現行 `use_gpu: process.platform === 'darwin'` → `use_gpu: true`(套件內建 auto-detect,跨平台)
- 若 voice-handler 有其他 API 差異 → Worker 自行對照 Kutalia README,必要時問使用者

### Step 4:rebuild + dev 測試

```bash
npm install
npm rebuild
npm run dev
```

### Step 5:實機音訊測試(**需使用者配合**)

Worker 應**互動式確認**:
- 測試 wav 檔案位置(BAT 現有測試音訊路徑)
- 使用者環境硬體(RTX 系列 GPU 型號、driver 版本)
- 是否需要使用者在 BAT UI 手動操作語音聽寫

---

## 成功判準(**3 項必須全部達成**)

1. **Vulkan 被選用**:whisper 初始化 log 含 `Vulkan backend selected` 或類似訊息
2. **效能 ≥ 3x CPU**:`inferenceTimeMs` 至少是 CPU baseline 的 3 分之 1 或更快(預期可達 10x,3x 為及格線)
3. **零 crash**:完整跑完一段音訊,無 native module load error / driver error / memory violation

---

## 停損條件(觸發即 Renew 或建議 ABANDONED,對照 spec §6.4)

任一觸發即停止並回報:

- ❌ Electron 41 ABI 145 不相容(`.node` load error)
  - **行動**:Renew,補充 Path B 路徑評估(BAT 自 fork Kutalia + rebuild)
- ❌ Vulkan 實測效能 < 3x CPU
  - **行動**:Renew,補充效能數據 + 討論是否值得升級到 v1.8.3
- ❌ GPU 未被選用(fallback 到 CPU 但 Vulkan 理應支援的硬體)
  - **行動**:Renew,補充 driver / runtime log 供塔台判斷
- ❌ Kutalia 套件 API 破壞性變更(與現行 `voice-handler.ts` 無法兼容)
  - **行動**:Renew,補充 API diff 供塔台判斷是否值得深度重寫

---

## 產出要求

1. **commit hash**:在 `exp/gpu-vulkan-poc` 分支,commit 訊息含 `[T0237 PoC Vulkan]` 標記
2. **binary 大小**:
   ```bash
   ls -lh node_modules/@kutalia/whisper-node-addon/platform/
   ```
3. **效能比較表**:CPU baseline vs Vulkan,至少 3 個樣本取平均
4. **初始化 log 片段**:證明 Vulkan 被選用
5. **本工單回報區**:
   - 完成狀態(DONE / PARTIAL / Renew 建議 / ABANDONED 建議)
   - 上述 1-4 產出連結
   - 3 項成功判準達成情況
   - 若停損觸發,附 Renew 建議 + 補充資料
   - 互動紀錄(與使用者 Q&A)
   - 下一步建議:T-B(打包驗證)可啟動 / 需 Renew / 建議 ABANDONED

---

## 回報區(Worker 填寫)

### 完成狀態
<!-- DONE / PARTIAL / Renew / ABANDONED -->

### 產出連結
- Worktree:`../bat-gpu-vulkan-poc` on branch `exp/gpu-vulkan-poc`
- commit hash:
- binary 大小:
- 效能比較表:
- 初始化 log 片段:

### 3 項成功判準達成情況
1. Vulkan 被選用:
2. 效能 ≥ 3x CPU:
3. 零 crash:

### 互動紀錄

### 風險 / 阻塞 / 意外發現

### 下一步建議
- [ ] T-B(electron-builder 打包驗證)可啟動
- [ ] Renew(補充說明)
- [ ] 建議 ABANDONED(理由)

### 回報時間

---

**建立者**:Control Tower(第二十一 session,2026-04-23 01:15)
**派發指令**(塔台自用):
```
派發 T0237 --mode on --interactive
```
