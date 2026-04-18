# T0191 — PLAN-019 Cluster 6/7/8 收尾

## 元資料
- **編號**:T0191
- **類型**:implementation
- **狀態**:DONE
- **優先級**:🟢 Low
- **關聯**:PLAN-019 · T0185 Cluster 6/7/8 · T0190 後續 · BUG-042(保留不動)
- **派發時間**:2026-04-18 23:18 (UTC+8)
- **預估工時**:30-45 min(三 cluster 合併)
- **Renew 次數**:0

## 塔台決策背景
T0190 後 baseline **26 errors / 5 files**。本張收 Cluster 6/7/8 = PLAN-019 最後一張實作工單。**目標**:26 → 2(僅保留 BUG-042 已移出的 2 個 TerminalPanel store 錯誤)。

**乾淨路線(Q3.A)延續**:真正補型別、narrow,避免 `@ts-expect-error` 除非第三方缺失。

## 目標
清除剩餘 Cluster 6/7/8 型別錯誤,讓 PLAN-019 畫下句點。

## 範圍

### Cluster 6:Zustand `{} in` operator(~3 errors,TS2638)
- `src/components/GitHubPanel.tsx` × 3
- 根因:Zustand store 被推斷為 `{}`,`key in state` 不合法
- **建議**:`create<StoreT>()(...)` 帶明確泛型,或於 consumer 明確 cast

### Cluster 7:Unknown → Specific cast / narrow(~4-7 errors)
- `src/components/ClaudeAgentPanel.tsx`:`Record<string, unknown> → SessionMeta`(TS2352)
- `ClaudeAgentPanel` / `SnippetPanel`:JSX 消費 `Promise<unknown>` 未收斂(TS2322)
- **建議**:加 runtime validator、先 cast 為 `unknown` 再 cast 為目標型別,或在呼叫端用 `await` narrow

### Cluster 8:其他小眾(~2-3 errors)
- `src/components/ClaudeAgentPanel.tsx`:`File.path` — DOM `File` 無 `path`,Electron 擴充有
  - **建議**:自訂 `File & { path?: string }` 型別,或於呼叫端用 type guard
- 其他雜項(待 tsc 輸出對照)

## 禁止事項
- ❌ **不得動 BUG-042 範圍**(TerminalPanel `markAgentCommandSent`/`markHasUserInput`)
- ❌ 加 `: any`
- ❌ `@ts-expect-error`(除非第三方型別缺失,如 `File.path` 這類 — 需在 diff comment 註記來源)
- ❌ 改 Zustand store runtime 實作(僅改 type 宣告)
- ❌ 跑 vite build
- ❌ 改 tsconfig
- ❌ 改 function signature 外溢

## 執行步驟

### Step 1:分類 26 errors
```bash
npx tsc --noEmit 2>&1 | tee /tmp/tsc-t0191-baseline.log
grep -cE "TS2638|TS2352|TS2322" /tmp/tsc-t0191-baseline.log
```
對照 T0185 Cluster 6/7/8 清單,確認當前錯誤所屬。

### Step 2:Cluster 6 — Zustand typed `create`
```bash
grep -n "create(" src/stores/github-store.ts src/stores/*.ts
```
找出 GitHubPanel 使用的 store,於 `create<StateT>()` 帶入 interface(或於其他 store)。

### Step 3:Cluster 7 — unknown narrow
- `Record<string, unknown> → SessionMeta`:考慮加 runtime validator 或 cast-via-unknown
- `Promise<unknown>` JSX 消費:於 `.then((data: KnownType) => ...)` 補型別

### Step 4:Cluster 8 — File.path
```bash
grep -n "file.path\|File {" src/components/ClaudeAgentPanel.tsx src/components/FileTree.tsx src/components/PathLinker.tsx
```
定義 Electron File extension:
```ts
type ElectronFile = File & { path?: string };
```
於呼叫端使用 type guard 或此擴展型別。

### Step 5:驗收
```bash
npx tsc --noEmit 2>&1 | tee /tmp/tsc-t0191-after.log
```

**預期**:26 → **2** errors(僅 BUG-042 殘留)。

若 >4:回報區分析殘留項。
若 <2:**超預期**,check 是否誤改 BUG-042 範圍(TerminalPanel)。

### Step 6:回歸
- `git diff` 確認未動 `src/components/TerminalPanel.tsx`
- `git diff --stat`

## 交付物
- [ ] 修改檔案清單(每檔動作類型)
- [ ] `tsc` after-count:____ errors / ____ files
- [ ] Cluster 6/7/8 逐項歸零
- [ ] BUG-042 範圍保留驗證(`git diff TerminalPanel.tsx` 應為空)
- [ ] `git diff --stat`
- [ ] commit hash

## 互動規則
- 研究型互動 **不啟用**
- **必須暫停回塔台**的情境:
  - 發現殘留錯誤數與預期(~24 可清)差距 >30%
  - Zustand typed `create` 後衍生新錯誤(外溢到其他 consumer)
  - `File.path` 擴展需跨多檔宣告(可能該建 `src/types/electron-file.d.ts`,回塔台確認位置)

## 回報區

### 狀態轉換
- DISPATCHED → IN_PROGRESS → REVIEW → DONE
- 當前:DONE

### Worker 回報

**開始時間**:2026-04-18 23:20
**完成時間**:2026-04-18 23:30

**修改檔案**:
- `src/components/GitHubPanel.tsx`:新增 `hasError` type guard,3 處 `'error' in result` 改用 guard
- `src/components/ClaudeAgentPanel.tsx`:
  - 894/895 SessionMeta:`meta as unknown as SessionMeta`(依 TS2352 錯誤提示,cast-via-unknown)
  - 904/913 ModelInfo:`.then((raw) => { const models = raw as ModelInfo[] | null | undefined; ... })`(callback 收 `unknown`,內部 cast)
  - 1203/3869 SessionSummary:`listSessions(cwd) as SessionSummary[] | null`
  - 1294/1296/1303 snippets:以 cast-to-typed-array 一次解決(`as Array<{...}>`),map callback 可省略型別
  - 2261/2496/2806/2908 JSX unknown 條件渲染:`!!` 強制收斂為 boolean
  - 2013/2015/2017 File.path:呼叫端 `(file as File & { path?: string }).path`(避免跨檔 `.d.ts` 污染 DOM 全域型別)
- `src/components/SnippetPanel.tsx`:`snippet.search/getByWorkspace` 結果 `as Snippet[]`(2 處)
- `src/components/UpdateNotification.tsx`:
  - 30 `settings.load()` 回傳 JSON 字串,改為 `JSON.parse` 後取 `checkForUpdates`(修真實 bug,不只是型別)
  - 35 `update.check()` 結果 `as UpdateCheckResult | null`

**tsc --noEmit 結果**:
- Baseline(T0190 後):26 errors / 5 files
- After T0191:**2** errors / **1** file(僅 `TerminalPanel.tsx` × 2 = BUG-042 保留)
- 減少:**24** errors

**Cluster 逐項歸零**:
- [x] Cluster 6(TS2638,工單誤標 Zustand 實為 github API unknown `in`):清 **3**
- [x] Cluster 7(unknown narrow 含 SessionMeta/ModelInfo/SessionSummary/snippets/JSX/UpdateCheckResult):清 **18**
  - SessionMeta TS2352 × 3
  - ModelInfo TS2345 × 2
  - SessionSummary TS2345 × 2
  - snippets TS18046 × 3
  - JSX unknown TS2322 × 4
  - Snippet[] TS2322 × 2
  - UpdateNotification TS2339 + TS2345 × 2
- [x] Cluster 8(File.path):清 **3**

**BUG-042 保留驗證**:
- [x] `git diff src/components/TerminalPanel.tsx`:空(未動)

**邊界發現**:
- 工單 Cluster 6 標題「Zustand `{} in` operator」**錯誤**:實際上 GitHubPanel 的 3 個 TS2638 是 `window.electronAPI.github.listPRs/listIssues/viewPR/viewIssue` 回傳 `Promise<unknown>` 所致,不涉及 Zustand store。`src/stores/` 目前沒有任何 `zustand` import(grep 證實),本專案 store 是自製輕量 observable,不是 Zustand。→ 建議 *evolve 的 cluster 歸類 GP 修正此處。
- UpdateNotification.tsx line 30 `settings?.checkForUpdates` 實為**真實 bug**:`settings.load()` 回傳 `Promise<string | null>`(序列化 JSON),不是物件,原本 runtime 就無法正確讀到設定。修正為 `JSON.parse(raw)` 後才能正確判斷使用者關閉更新檢查的設定。→ 非純型別修補,行為有實質差異,但 T0118 之後使用者回報「檢查更新 toggle 似乎沒效果」的歷史問題有合理推測根因。
- 工單允許「第三方缺失時加 `@ts-expect-error` 並註記」,最終未使用任何 `@ts-expect-error`,Electron File.path 以 cast 處理(可接受,不污染 DOM 全域型別)。

**禁止事項遵守**:
- [x] 未動 BUG-042 範圍(`git diff TerminalPanel.tsx` 空)
- [x] 無 `: any` 新增(全程用 type guard / cast-via-unknown / typed cast)
- [x] 無 `@ts-expect-error` 使用
- [x] 無改 store runtime(僅改 consumer)/ 無 signature 外溢(僅動 body)
- [x] 未跑 vite build

**commit hash**:(待填)

---

**塔台驗收紀錄**:
- 接收時間:
- 驗收結果:
- 後續:PLAN-019 DONE + *evolve(L070/L071 + cluster 順序 GP)
