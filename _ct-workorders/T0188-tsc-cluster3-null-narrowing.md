# T0188 — PLAN-019 Cluster 3:Null/Undefined narrowing

## 元資料
- **編號**:T0188
- **類型**:implementation
- **狀態**:IN_PROGRESS
- **優先級**:🟢 Low
- **關聯**:PLAN-019 · T0185 Cluster 3 · T0187 後續 · BUG-042(殘留 2 errors 已移出)
- **派發時間**:2026-04-18 22:44 (UTC+8)
- **預估工時**:10-15 min
- **Renew 次數**:0

## 塔台決策背景
T0187 後 baseline **46 errors / 13 files**(扣除 BUG-042 已移出的 2 errors,Cluster 3 範圍的 errors 仍留在計數中)。
Cluster 3 為 null/undefined narrowing,預期消 ~10 errors → ~36。乾淨路線(Q3.A):guard / `??` / narrow,**不用 `!` non-null assertion**(會遮蔽 bug)。

## 目標
清除 Cluster 3 所列 null/undefined 相關錯誤(TS2322 / TS2345 的 `string | undefined`/`string | null` 傳給 `string` 的案例)。

## 範圍

| 位置 | 錯誤類型 | 建議處理 |
|------|---------|---------|
| `src/components/WorkspaceView.tsx` × 5 | `string \| undefined` 傳給期望 `string` | 加 guard 或 `?? ''`(視語意決定哪個) |
| `src/components/PromptBox.tsx` × 1 | `string \| null` 傳給 `string` | narrow 至 `string` 或改 signature |
| `src/stores/sprint-status.ts` × 1 | `string \| null` 賦給 `string \| undefined` | 統一用 `undefined`(`?? undefined`) |
| 其他同類 TS2322/TS2345 | 若 Cluster 3 實際錯誤 > 7 個 | 比對 T0185 盤點,同類一併修 |

## 禁止事項
- ❌ 用 `!` non-null assertion(遮蔽 bug,違反 Q3.A 乾淨路線)
- ❌ 改 function signature 若會影響呼叫端型別(會外溢到其他 component)
- ❌ `@ts-expect-error`
- ❌ 動其他 cluster(特別 BUG-042 殘留 2 errors 保留不動)
- ❌ 改 runtime 邏輯 — 僅 narrow / guard / fallback 轉換
- ❌ 跑 vite build
- ❌ 改 tsconfig

## 執行步驟

### Step 1:盤點 Cluster 3 錯誤
```bash
npx tsc --noEmit 2>&1 | grep -E "(WorkspaceView|PromptBox|sprint-status)"
```
對照 T0185 盤點,確認當前錯誤是否仍存在,或已被 T0186/T0187 連動清除/遮蔽。

### Step 2:逐一修正

**選擇原則**(`string | undefined` → `string`):
- 如果 `undefined` 代表「沒值/空字串語意等價」 → `?? ''`
- 如果 `undefined` 代表「此分支不應執行」 → `if (!x) return` guard
- 如果能 narrow 得更上游(早點 return / 早點轉型) → 優先

**選擇原則**(`string | null` → `string | undefined`):
- `?? undefined` 一律處理

### Step 3:驗收
```bash
npx tsc --noEmit 2>&1 | tee /tmp/tsc-after-t0188.log
```
**預期**:46 → ~36 errors。若減少 <7 或 >13,回報區分析。

### Step 4:回歸
- `git diff` 確認只動了上述 3 檔(或同類延伸)
- 不跑 vite build

## 交付物
- [ ] 修改檔案清單
- [ ] `tsc` after-count:____ errors / ____ files
- [ ] Cluster 3 逐項歸零檢查
- [ ] 無新增錯誤、無使用 `!` assertion
- [ ] `git diff --stat`
- [ ] commit hash

## 互動規則
- 研究型互動 **不啟用**
- **必須暫停回塔台**的情境:
  - 某處的 `undefined`/`null` 改法會影響 function signature 外溢
  - 發現 Cluster 3 範圍內某錯誤實際屬其他 cluster(分類有誤)
  - 遇到超過 T0185 盤點數量 2 倍以上的同類錯誤(可能是 cluster 邊界誤判)

## 回報區

### 狀態轉換
- DISPATCHED → IN_PROGRESS → REVIEW → DONE
- 當前:DISPATCHED

### Worker 回報

**開始時間**:2026-04-18 22:48 (UTC+8)
**完成時間**:2026-04-18 22:57 (UTC+8)

**修改檔案**:
- `src/components/WorkspaceView.tsx`(+10/-5,共 5 處 `preset.command` closure narrow)
- `src/components/PromptBox.tsx`(+1/-1,`getCwd` callback 參數型別對齊為 `string | null`)
- `src/types/sprint-status.ts`(+1/-1,`status` 從 `string | null` 改為 `?? undefined`)

**tsc --noEmit 結果**:
- Baseline(T0187 後):46 errors / 13 files
- After T0188:39 errors / 12 files
- 減少:7 errors

**Cluster 3 逐項歸零**:
- [x] WorkspaceView.tsx × 5 → 清 5(line 457/466/507/515/771 的 `preset.command` 在 `setTimeout` closure 內 narrow 遺失,改用 `const cmd = preset.command` 抓下來保留 narrow)
- [x] PromptBox.tsx × 1 → 清 1(line 106 `getCwd` callback 宣告 `cwd: string` 實際回 `string | null`,改對齊 signature;後續 `if (!cwd) return` guard 已存在)
- [x] sprint-status.ts × 1 → 清 1(**實際位置在 `status` 不在 `lastUpdated`**,T0185 盤點有誤。interface `status?: string` 但 `extractString` 回 `string | null`,加 `?? undefined` 統一成 `string | undefined`;lastUpdated interface 本就是 `string | null`,維持原樣)
- [x] 其他同類 → 清 0(無額外 Cluster 3 錯誤)

**邊界發現**:
- **T0185 盤點誤標**:工單寫「`src/stores/sprint-status.ts` × 1」,實際檔案在 `src/types/sprint-status.ts`,且錯誤真正發生在 `status` 變數(line 155)不是 `lastUpdated`(line 173)。初次修改誤把 `lastUpdated` 加上 `?? undefined`,反而製造新錯誤(interface 要求 `string | null`),立即還原並改修 `status`。
- **WorkspaceView closure narrowing**:TS 在 `setTimeout` callback 中對 optional property (`preset?.command`) narrow 會丟失(closure 中視為 `string | undefined`),標準修法是在 guard 內 `const cmd = preset.command` 抓下來再傳給 callback。5 處完全同 pattern,修法一致。
- **PromptBox signature 對齊**:`window.electronAPI.pty.getCwd` 回 `Promise<string | null>`,原寫 `.then((cwd: string) =>` 違反型別(但 runtime 有 `if (!cwd) return` guard 實際安全)。改成 `(cwd: string | null) =>` 最小 diff 修正。不改 `getCwd` signature 避免外溢。

**禁止事項遵守**:
- [x] 無 `!` non-null assertion(grep 無新增)
- [x] 無改 function signature 外溢(僅改 callback 內部變數,不動 electronAPI / extractString / preset type)
- [x] 無 `@ts-expect-error`
- [x] 未動 BUG-042 殘留 2 errors(TerminalPanel.tsx line 210/385 仍在)
- [x] 未跑 vite build

**commit hash**:(見下方 commit)

---

**塔台驗收紀錄**:
- 接收時間:
- 驗收結果:
- 下一張:T0189(Cluster 5 implicit any)
