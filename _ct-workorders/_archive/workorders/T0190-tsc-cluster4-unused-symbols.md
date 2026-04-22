# T0190 — PLAN-019 Cluster 4:Unused symbols cleanup

## 元資料
- **編號**:T0190
- **類型**:implementation
- **狀態**:DONE
- **優先級**:🟢 Low
- **關聯**:PLAN-019 · T0185 Cluster 4 · T0189 後續
- **派發時間**:2026-04-18 23:05 (UTC+8)
- **預估工時**:< 10 min(trivial)
- **Renew 次數**:0

## 塔台決策背景
T0189 後 baseline **39 errors / 11 files**。Cluster 4 為 TS6133 `declared but never read`,13 errors(baseline 39 中最多,~33%)。預期 → ~26 errors。

**乾淨路線(Q3.A)**:優先**刪除**未用符號;若為刻意保留(signature 統一、未來使用),用 `_` 前綴或 `// eslint-disable-next-line` 註記(TS6133 視 `_` 前綴為豁免)。

## 目標
清除所有 TS6133 errors(unused import / unused var / unused parameter / dead code)。

## 範圍(T0185 盤點)
- `src/App.tsx` × 1
- `src/components/ClaudeAgentPanel.tsx` × 3
- `src/components/PathLinker.tsx` × 1
- `src/components/TerminalPanel.tsx` × 2
- `src/components/ThumbnailBar.tsx` × 1
- `src/components/WorkspaceView.tsx` × 3
- `src/stores/workspace-store.ts` × 1
- `src/main.tsx` × 1

## 禁止事項
- ❌ 刪除看起來 unused 但**可能是 type-only 匯入**(會破壞型別推斷)— 用 `import type` 改寫而非刪除
- ❌ 刪除 callback signature 上的 unused parameter(會破壞 signature 對齊)→ 改用 `_` 前綴
- ❌ 批次 find & delete 未確認每一項用途
- ❌ `@ts-expect-error`
- ❌ 動其他 cluster / BUG-042 殘留
- ❌ 跑 vite build
- ❌ 改 tsconfig

## 執行步驟

### Step 1:盤點
```bash
npx tsc --noEmit 2>&1 | grep "TS6133"
```

### Step 2:逐一判斷

決策樹:
1. **Unused import** → 刪除(若為 `import type` 且僅型別用 → 確認無漏 usage 後刪)
2. **Unused function / variable** → 刪除(確認無被 JSX / computed / reflection 使用)
3. **Unused function parameter** → `_` 前綴(保留 signature)
4. **Unused destructured property** → 從解構中移除
5. **跨 import 刪除後發生新錯誤** → **暫停回塔台**(可能有隱性使用)

### Step 3:驗收
```bash
npx tsc --noEmit 2>&1 | tee /tmp/tsc-after-t0190.log
grep -c "TS6133" /tmp/tsc-after-t0190.log   # 應為 0
```

**預期**:39 → ~26 errors。

### Step 4:回歸
- `git diff --stat` 確認修改範圍
- 不跑 vite build(type-only 變動)

## 交付物
- [ ] 修改檔案清單(+ 每檔動作類型:刪除 / 改 `_` 前綴 / 改 `import type`)
- [ ] `tsc` after-count:____ errors / ____ files
- [ ] TS6133 歸零確認
- [ ] 無新增錯誤
- [ ] `git diff --stat`
- [ ] commit hash

## 互動規則
- 研究型互動 **不啟用**
- **必須暫停**的情境:
  - 刪除某 import 後出現新錯誤
  - 某 unused 符號疑似為未來預留(grep TODO / git blame 有近期 commit)

## 回報區

### 狀態轉換
- DISPATCHED → IN_PROGRESS → REVIEW → DONE
- 當前:DONE

### Worker 回報

**開始時間**:2026-04-18 23:07 (UTC+8)
**完成時間**:2026-04-18 23:16 (UTC+8)

**修改檔案**(8 files, +5 / −39):
- `src/App.tsx` — 刪除 `clearInitializedWorkspaces` 未用 import
- `src/components/ClaudeAgentPanel.tsx` — `_` 前綴 `claudeUsage` / `usageAccount`(state 為 re-render 驅動,setter 仍使用);刪除未呼叫的 `handleModelCycle` useCallback
- `src/components/PathLinker.tsx` — 刪除未用 `canPreview` 函式與其唯一依賴的 `TEXT_EXTS` 常數(連鎖清理,避免產生新 TS6133)
- `src/components/TerminalPanel.tsx` — `_` 前綴 `altBufferActive`(state 為 re-render 驅動,實際讀取透過 `altBufferRef`);`_` 前綴 WebLinksAddon callback 的 `event` 參數(signature 要求)
- `src/components/ThumbnailBar.tsx` — 從 props 解構移除未用的 `showAddButton`(interface 和 caller 保留)
- `src/components/WorkspaceView.tsx` — 刪除 `regularTerminals` / `isAgentFocused` / `pinnedTerminal` 未用本地變數
- `src/stores/workspace-store.ts` — 刪除 `addTerminal()` 內未用的 `existingTerminals` filter
- `src/main.tsx` — 刪除 `import React`(`jsx: react-jsx` 模式下不需要)

**tsc --noEmit 結果**:
- Baseline:39 errors / 11 files
- After T0190:26 errors / 5 files
- 減少:13 errors / 6 files

**TS6133 歸零確認**:
- 修改前:13 筆
- 修改後:0 筆 ✅

**逐項處理**:
- [x] App.tsx × 1 — 刪除 import
- [x] ClaudeAgentPanel.tsx × 3 — 2 × `_` 前綴 state + 1 × 刪除 useCallback
- [x] PathLinker.tsx × 1 — 刪除 function + 連鎖清理 TEXT_EXTS
- [x] TerminalPanel.tsx × 2 — `_` 前綴 state + `_` 前綴 param
- [x] ThumbnailBar.tsx × 1 — 從解構移除
- [x] WorkspaceView.tsx × 3 — 刪除 3 個本地變數
- [x] workspace-store.ts × 1 — 刪除本地變數
- [x] main.tsx × 1 — 刪除 import

**邊界發現**:
1. **`claudeUsage` / `usageAccount` / `altBufferActive` 是 re-render 驅動 state**:value 從未讀取,但 setter 仍被 subscribe callback 呼叫以觸發 re-render。若完全刪除會牽動 subscribe 邏輯(超出 TS6133 scope),採 `_` 前綴保留 setter 與 subscribe 結構。
2. **`PathLinker.canPreview` 刪除後 `TEXT_EXTS` 變 orphan**:`TEXT_EXTS` 僅被 `canPreview` 使用,刪除後會產生新 TS6133。為不引入新錯誤,一併清理 TEXT_EXTS(9 行常數),屬必要連鎖清理不算擴範圍。
3. **`ThumbnailBar.showAddButton` 僅保留在 interface + caller(`WorkspaceView.tsx:1249` 傳 `true`),實際 UI 邏輯已消失**:屬歷史殘留,但完整清理(移除 interface + caller)超出本工單範圍,僅從解構移除,留給未來重構。
4. **`src/main.tsx:1 `import React``**:當前 `tsconfig.json` 設定 `"jsx": "react-jsx"`(new JSX transform),該 import 無效。刪除後不影響運行。

**禁止事項遵守**:
- [x] 無誤刪 type-only import(未動任何 type import)
- [x] 無改 callback signature(`event` 參數改 `_event` 保留 signature)
- [x] 無 `@ts-expect-error`
- [x] 未動 BUG-042 / 其他 cluster
- [x] 未跑 vite build

**commit hash**:`0ab85d3`

---

**塔台驗收紀錄**:
- 接收時間:
- 驗收結果:
- 下一張:T0191(Cluster 6-8,收尾)
