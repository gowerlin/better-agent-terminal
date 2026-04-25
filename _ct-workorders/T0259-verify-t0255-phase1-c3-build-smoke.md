# T0259-verify-t0255-phase1-c3-build-smoke

## 元資料
- **工單編號**：T0259
- **任務名稱**：Phase 1 C3 build smoke 驗收 — 確認 T0255 4 個 cherry-pick + version.json 落地不破編譯
- **狀態**：DONE
- **開始時間**：2026-04-25 20:40 (UTC+8)
- **完成時間**：2026-04-25 20:46 (UTC+8)
- **類型**：verification
- **互動模式**：disabled
- **Renew 次數**：0
- **建立時間**：2026-04-25 20:55 (UTC+8)
- **預估 wall time**：~5-10 min（vite build + tsc 檢查）
- **預估 context cost**：低
- **關聯**：
  - 母工單：T0255（DONE）
  - 前序：T0258（DONE，cherry-pick 鏈續做）
- **affects_files**：
  - `_ct-workorders/T0259-*.md`（自身回報，唯一寫入）

---

## 任務目標

驗收 T0258 落地的 5 個 commit（302a065 / 4c1de15 / 8b07399 / f96eb35 / acc4a81）不破編譯。**只跑 build 級驗收，不跑 runtime smoke**（dev server / packaged installer 留給使用者）。

特別關注：
1. **#7 (`8b07399`) 在 `electron/claude-agent-manager.ts` 丟棄 `autoCompactWindow` 兩行** — Worker 已確認 BAT setModel 簽名不含此參數，但需 tsc 確認無 type error
2. **#6 (`4c1de15`) empty commit 邏輯 no-op** — 但 imports 採 ours 路線，需確認 ClaudeAgentPanel.tsx 的 import 表完整
3. **#5 (`302a065`) main.ts 新增 `setWindowOpenHandler` + `will-navigate`** — main process build 確認
4. **#8 (`f96eb35`) fork-session abort flow** — claude-agent-manager.ts 第二處修改

---

## 執行步驟

### Step 1：build smoke

```bash
npm run build 2>&1 | tee /tmp/t0259-build.log | tail -50
```

或對應的 vite build 命令（依 package.json scripts）。

### Step 2：tsc 嚴格檢查（若 build 包含）

如 `npm run build` 已含 tsc，跳過此步。否則：

```bash
npx tsc --noEmit 2>&1 | tee /tmp/t0259-tsc.log | tail -30
```

### Step 3：確認關鍵檔案無語法錯誤

```bash
git log --oneline -6
git show --stat 8b07399 | head -10
```

確認 #7 修改點未引入 unused import 或 unreferenced variable。

### Step 4：彙整回報

填寫本工單下方「回報」區段，包含：
- build exit code
- 任何 warning（特別 unused variable / type error）
- 4 個 commit 對應檔案的 build 級狀態
- 若 build 失敗，列出失敗檔 + 行號 + 錯誤摘要（**不嘗試修復**，回塔台決策）

### Step 5：commit 工單檔

```bash
git add _ct-workorders/T0259-*.md
git commit -m "chore(workorder): T0259 Phase 1 C3 build smoke verified"
```

不 push。

---

## AC（acceptance criteria）

- AC1：`npm run build` exit code 0
- AC2：tsc 無 error（warning 容許但需列出）
- AC3：回報明確指出 4 個 cherry-pick commit 對應檔案 build 級狀態
- AC4：working tree 在工單結束時除工單檔外乾淨

---

## 嚴格禁止

- ❌ 修改任何原始碼（含 lint auto-fix）
- ❌ 跑 dev server / packaged installer
- ❌ 跑 unit / e2e tests（不在驗收範圍）
- ❌ `git push`
- ❌ 修復 build error（若失敗，回塔台決策另派修復工單）

---

## 回報

### 完成狀態
**DONE**（build 級驗收通過；零新增 tsc error）

### 驗收命令採用偏離（須備註）

工單 Step 1 寫 `npm run build`，但該 script 完整鏈是 `verify-native-modules → verify-helper-bundle → vite build → electron-builder`，最後一步會打包 NSIS installer，與工單頭「不跑 packaged installer」精神衝突，且 wall time 估計 5-10 min 不足以跑完 electron-builder。Worker 採折衷：

| Step | 命令 | 結果 |
|------|------|------|
| Step 1 | `npm run compile`（= `vite build`） | exit 0，✅ 通過（all 4 entries: client / electron main / preload / terminal-server）|
| Step 2 | `npx tsc --noEmit` | exit 2，37 errors（**詳下方分析，全為 baseline pre-existing**）|

若塔台堅持要 `npm run build` 完整 exit 0，請另派工單跑 packaged build 驗收（含時間預估上修）。

### Build 結果（vite）

- vite v7.3.2，4 個 entry 全部 build 通過
- Warnings：
  - `chunks larger than 500kB`（index-WfgHwGaG.js / mermaid.core）— pre-existing 既知，非本工單引入
  - `claude-resolver.ts` / `claude-runtime-router.ts` 動態+靜態 import 並存導致 chunk 不切分 — pre-existing，PLAN-027 既有結構
- 產出：`dist/` (前端) + `dist-electron/main.js / sdk-*.js / preload.js / terminal-server.js`

### tsc 結果

- exit 2，37 errors，集中於 3 檔：
  - `src/components/CodexAgentPanel.tsx`：~30 errors（electronAPI 缺多個方法、unknown 型別、SetStateAction 不相容、handleModelCycle unused）
  - `src/components/ProfilePanel.tsx`：1 error（`parseConnectionUrl` 未定義）
  - `src/types/agent-profiles.ts`：1 error（AgentParamValue undefined union 不相容）
- **Baseline 對比**：checkout `302a065^`（cherry-pick 鏈最早點之前的 HEAD）後跑同一條 tsc，結果同樣 37 errors。**零新增**。
- 結論：tsc errors 與 T0258 cherry-pick 鏈 100% 無關，屬於專案既有 type debt。AC2「tsc 無 error」字面未通過，但「cherry-pick 鏈不破編譯」已驗證。

### 4 個 cherry-pick commit 對應檔案 build 級狀態（AC3）

| # | Commit | 主要檔案 | vite build | tsc 新 error | 備註 |
|---|--------|---------|-----------|--------------|------|
| #5 | `302a065` | `electron/main.ts` (+13 行) | ✅ | 0 | `setWindowOpenHandler` + `will-navigate` 通過 |
| #6 | `4c1de15` | （empty commit）| ✅ | 0 | 已 confirm `git show` 無檔案變更，純 no-op，符合工單預期 |
| #7 | `8b07399` | `electron/claude-agent-manager.ts` (+9 行) | ✅ | 0 | autoCompactWindow 兩行已棄，setModel 簽名相容 |
| #8 | `f96eb35` | `electron/claude-agent-manager.ts` (+17 行) | ✅ | 0 | fork-session abort flow build 通過 |
| 收尾 | `acc4a81` | `version.json` (+3/-3) | ✅ | 0 | lastSyncCommit bump |

### 產出摘要

- 修改檔：`_ct-workorders/T0259-*.md`（自身回報，唯一寫入）
- log 檔：`/tmp/t0259-tsc.log`、`/tmp/t0259-tsc-baseline.log`（暫存，不入 repo）
- 未動原始碼、未 push、未跑 dev server / installer

### 互動紀錄

無

### 遭遇問題

1. **AC1 vs 工單頭精神衝突**：採折衷見上方「驗收命令採用偏離」段。
2. **Pre-existing 工作樹遺留**：session 啟動時 `_ct-workorders/T0258-*.md` 已有未提交修改（T0258 的元資料 IN_PROGRESS → DONE + 完成時間補填），屬於 T0258 收尾階段未 commit 的尾段，**非 T0259 引入**。Worker 嚴守工單範圍未動該檔。AC4「除工單檔外乾淨」字面未通過，但歸因明確，建議塔台補一張「T0258 元資料 commit 補登」短工單，或併到下一張塔台 commit 處理。

### Renew 歷程

無

### Commit hash

`3f090c9`（`chore(workorder): T0259 Phase 1 C3 build smoke verified`，amend 後 hash）

### 回報時間

2026-04-25 20:46 (UTC+8)
