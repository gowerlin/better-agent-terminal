# T0189 — PLAN-019 Cluster 5:Implicit any parameters

## 元資料
- **編號**:T0189
- **類型**:implementation
- **狀態**:DONE
- **優先級**:🟢 Low
- **關聯**:PLAN-019 · T0185 Cluster 5 · T0188 後續
- **派發時間**:2026-04-18 22:59 (UTC+8)
- **預估工時**:10-15 min
- **Renew 次數**:0

## 塔台決策背景
T0188 後 baseline **39 errors / 12 files**。Cluster 5 為 TS7006 `Parameter implicitly 'any'`,11 errors(多數集中在 `App.tsx`)。預期消除 → ~28 errors。

**乾淨路線(Q3.A)硬要求**:**禁止直接加 `: any` 了事**。必須推斷父 array / callback element type。

## 目標
清除所有 TS7006 errors,補上實際型別(array element / callback arg / event handler)。

## 範圍

| 檔案 | 錯誤數 | 典型變數名 |
|------|-------|-----------|
| `src/App.tsx` | ~8 | `p`, `s`, `wsId`(多為 `.map` / `.filter` callback 參數) |
| `src/components/FileTree.tsx` | 1 | (待 grep) |
| `src/components/PathLinker.tsx` | 1 | (待 grep) |
| 其他 | ~1 | (待 grep) |

## 禁止事項
- ❌ **直接加 `: any`**(違反 Q3.A 乾淨路線,最嚴重違規)
- ❌ `@ts-expect-error`
- ❌ 改 array / return type 定義(會外溢 — 歸 Cluster 2/7)
- ❌ 動其他 cluster(BUG-042 殘留 2 errors 保留不動)
- ❌ 跑 vite build
- ❌ 改 tsconfig

## 執行步驟

### Step 1:盤點
```bash
npx tsc --noEmit 2>&1 | grep "TS7006"
```
列出所有 TS7006,確認檔案 + 行號 + 變數名。

### Step 2:逐一推斷型別

**策略**(按優先順序):
1. **從父 array 元素型別推斷**
   ```ts
   // Before
   profiles.map(p => p.name)
   // Identified: profiles: Profile[] → p: Profile
   profiles.map((p: Profile) => p.name)
   // 或更好:讓 TS 自動推斷(確認 profiles 有正確型別即可)
   ```
2. **從 callback signature 推斷**(如 event handler、IPC callback)
3. **從 store selector 推斷**

**若型別難以推斷(父 array 本身是 `unknown[]` / `any[]`)** → **暫停回塔台**(可能是上游 type 缺失,歸其他 cluster)。

### Step 3:驗收
```bash
npx tsc --noEmit 2>&1 | tee /tmp/tsc-after-t0189.log
grep -c "TS7006" /tmp/tsc-after-t0189.log   # 應為 0
```

**預期**:39 → ~28 errors。若 TS7006 殘留 >0,回報區列出殘留項並說明原因。

### Step 4:回歸檢查
- `git diff | grep ": any"` 應無新增(嚴格)
- `git diff --stat` 確認修改範圍

## 交付物
- [ ] 修改檔案清單
- [ ] `tsc` after-count:____ errors / ____ files
- [ ] TS7006 錯誤歸零確認
- [ ] **無任何 `: any` 新增**(grep 證據)
- [ ] `git diff --stat`
- [ ] commit hash

## 互動規則
- 研究型互動 **不啟用**
- **必須暫停回塔台**的情境:
  - 父 array 本身是 `unknown[]`/`any[]` → 需要先修上游型別
  - 某 callback 的來源(如 IPC handler)signature 本身缺型別 → 歸 Cluster 1 延伸
  - 遇到「只能加 any 才能過」的情境 → **絕不自行妥協**,pause 回塔台決策

## 回報區

### 狀態轉換
- DISPATCHED → IN_PROGRESS → REVIEW → DONE
- 當前:DONE(no-op,TS7006 已於先前工單歸零)

### Worker 回報

**開始時間**:2026-04-18 23:01
**完成時間**:2026-04-18 23:03

**修改檔案**:無(no-op)

**tsc --noEmit 結果**:
- Baseline(T0188 後):39 errors / 11 files(工單預估 12,實測 11)
- After T0189:39 errors / 11 files(無變動)
- 減少:0 errors(因 TS7006 已全歸零)

**TS7006 歸零確認**:
- 修改前:**0 筆**(T0188 交付時已全清)
- 修改後:0 筆

**逐項清單**:
- [x] App.tsx × 0 → N/A(先前工單已清)
- [x] FileTree.tsx × 0 → N/A
- [x] PathLinker.tsx × 0 → N/A
- [x] 其他:0

**邊界發現**:
- 當前 baseline 39 errors 分布:TS6133×13、TS2339×6、TS2322×6、TS2345×5、TS2638×3、TS2352×3、TS18046×3。**無任何 TS7006**。
- Cluster 5 目標已由 T0187(Cluster 2 domain/store/union types 補齊)+ T0188(null narrowing)間接達成 — 推測父 array 型別補完後,.map/.filter callback 參數自動推斷成功,無需顯式標註。
- 下一張 T0190(Cluster 4 unused symbols,TS6133×13)確實仍是 low-hanging fruit。

**禁止事項遵守**:
- [x] **無新增 `: any`**(`git diff` 空,無任何原始碼變動)
- [x] 無 `@ts-expect-error`
- [x] 無改 array/return type(無外溢)
- [x] 未動 BUG-042 殘留(無動任何 runtime code)
- [x] 未跑 vite build

**commit hash**:012a583(僅收尾文件 commit,無 runtime 碼變動)

---

**塔台驗收紀錄**:
- 接收時間:
- 驗收結果:
- 下一張:T0190(Cluster 4 unused symbols,trivial)
