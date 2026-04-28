---
schema_version: 1
schema_kind: workorder
id: T0348
title: Fix BUG-078 — 搬遷 ct-drift-telemetry 到 electron/ + IPC bridge（方案 A）
type: fix
status: IN_PROGRESS
sizing: S
created_at: "2026-04-28T23:21:00+08:00"
started_at: "2026-04-28T23:30:05+08:00"
updated_at: "2026-04-28T23:30:05+08:00"
project: PLAN-034
depends_on:
  - T0346
followups: []
affects_files:
  - src/utils/ct-drift-telemetry.ts
  - src/utils/__tests__/ct-drift-telemetry.test.ts
  - electron/ct-drift-telemetry.ts
  - electron/__tests__/ct-drift-telemetry.test.ts
  - electron/preload.ts
  - electron/main.ts
  - src/types/index.ts
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
---

# T0348 — Fix BUG-078 — 搬遷 ct-drift-telemetry 到 electron/ + IPC bridge（方案 A）

## 背景

PLAN-034 Sprint 5 / T0346 新增 `src/utils/ct-drift-telemetry.ts` 作為 CT 工單 metadata drift 的 logger，但 import `node:fs/path/os` 落在 vite renderer 編譯範圍內。

CI run 25060731646 觸發 D090 guard fail，三平台 build job 全部炸掉，阻塞 v0.5.0-pre.1 release。

完整 root cause + 修法選項評估見 BUG-078 + 塔台對話紀錄（第四十二 session）。

塔台採方案 A（搬到 electron/ + IPC），理由：
1. ct-frontmatter 已是 renderer-side parser，drift detection 必然發生在 renderer
2. 要從 renderer 寫 log → 必須走 IPC（D090 / BUG-069 鐵律）
3. 方案 B（scripts/）等於 logger 永遠不會被呼叫
4. Sprint 6 dashboard 一定要這條 IPC，與其重做不如一次到位

## 任務目標

### 1. 搬遷 logger 主檔到 electron/

`src/utils/ct-drift-telemetry.ts` → `electron/ct-drift-telemetry.ts`

- 內容不變（保留 `logDrift` / `readRecentDrift` / `defaultDriftLogPath` API）
- 路徑解析照舊用 `homedir() + .bat-cache/ct-drift.log`，但**優先**使用 Electron `app.getPath('userData')`（若可取得）
  - 簽名增加可選 `userDataDir?: string` 參數（已預留，見原檔頭註解）
  - 從 main process 呼叫時傳入 `app.getPath('userData')`；從 IPC handler 呼叫時也傳入
- 移除 `src/utils/ct-drift-telemetry.ts`（避免兩份分歧）

### 2. 搬遷 test 檔到 electron/__tests__/

`src/utils/__tests__/ct-drift-telemetry.test.ts` → `electron/__tests__/ct-drift-telemetry.test.ts`

- 確認 test 跑得起來（vitest config 是否涵蓋 `electron/__tests__/`）
- 若 vitest config 預設不涵蓋，更新 `vite.config.ts` `test.include` 加入 `electron/**/*.test.ts`
- 修正所有 `import` path

### 3. 接 IPC bridge（renderer ↔ main）

**main process** (`electron/main.ts` 或 `electron/ipc-handlers.ts` 等現有 IPC 註冊處)：

- 新增 IPC handler：
  - `ctDrift:log` → 呼叫 `logDrift(warning, { userDataDir: app.getPath('userData') })`
  - `ctDrift:readRecent` → 呼叫 `readRecentDrift(opts)`，回傳 `DriftEntry[]`
- 沿用既有 IPC 註冊 pattern（參考 `wsl.fetchFingerprint` / `claude-runtime` 等現有 handler）

**preload** (`electron/preload.ts`)：

- 暴露 `window.electronAPI.ctDrift = { log, readRecent }`
- 沿用 `contextBridge.exposeInMainWorld` 既有 pattern

**renderer types**：

- 在 `src/types/index.ts`（或 electronAPI 集中定義處）加 `ctDrift` 介面型別
- 確保 TypeScript 編譯通過

### 4. 接線 ParseWarning 觸發點（最小範圍）

**重要**：本工單**不要**在 renderer 加大量 `logDrift` 呼叫點，避免擴大範圍。

只做最小必要：
- 確認 `ct-frontmatter.ts` 產生 `ParseWarning` 的位置（如 `parseFrontmatter` / drift detection）
- 在**至少一個** caller（`src/types/control-tower.ts` 或同類）加上 `if (window.electronAPI?.ctDrift) window.electronAPI.ctDrift.log(warning).catch(() => {})`
- 確認呼叫 silent fail（IO error 不影響 UI）
- 完整接線屬 PLAN-034 Sprint 6 polish 範圍

### 5. 移除 vite renderer 對 src/utils/ct-drift-telemetry 的引用

- Grep 全 src/ 確認沒有 import 殘留
- 確認 `src/utils/__tests__/` 該檔已搬走

## 收尾驗收（硬條件）

**全部跑過才算 DONE**：

1. `npm run test:unit` — 全綠 0 regression
2. **`npm run build`** — 必須通過（D090 guard 綠燈）— 這是本工單的核心驗收
3. `npm run typecheck`（若有獨立指令）— 全綠
4. Grep 確認 `src/` 下無 `ct-drift-telemetry` 引用（除了可選的 type-only import）
5. （可選）跑 `npm run dev` 開 BAT，肉眼確認 CT 工單面板正常 render（無 IPC 報錯）

## 預期變更摘要

| 檔案 | 動作 |
|------|------|
| `src/utils/ct-drift-telemetry.ts` | DELETE |
| `src/utils/__tests__/ct-drift-telemetry.test.ts` | MOVE → `electron/__tests__/` + import path 修 |
| `electron/ct-drift-telemetry.ts` | NEW（從 src/ 搬來，加 userDataDir 預設邏輯） |
| `electron/__tests__/ct-drift-telemetry.test.ts` | NEW（從 src/ 搬來） |
| `electron/preload.ts` | EDIT（加 ctDrift bridge） |
| `electron/main.ts` 或 IPC handler 模組 | EDIT（加 ctDrift IPC handler） |
| `src/types/index.ts` 或 electronAPI type | EDIT（加 ctDrift 介面） |
| `src/types/control-tower.ts`（或 ParseWarning 第一個 renderer caller） | EDIT（最小接線：silent fail logDrift call） |
| `vite.config.ts`（如需） | EDIT（test.include 加 electron/__tests__/） |

## 估時

S（30-60 min Worker wall）

理由：
- 純搬遷 + IPC 樣板（已有 wsl.fetchFingerprint / claude-runtime 等多個範本）
- 無業務邏輯變更
- 收尾驗收明確（`npm run build` 是 binary 通過）

## 風險與注意事項

1. **vitest config 涵蓋範圍**：electron/ 下的 test 是否被 vitest 自動掃到？若否，要更新 `test.include`
2. **electron/ 下能否 import vitest**？若 electron/ 預設不在 tsconfig.test 範圍內，可能需要新建或調整 tsconfig
3. **IPC handler 註冊位置**：BAT 有專屬 IPC 註冊模式，沿用既有結構（不要新建檔案除非必要）
4. **不擴大範圍**：本工單只搬遷 + 最小接線。完整 ParseWarning → logDrift 接線屬 PLAN-034 Sprint 6
5. **不動 ct-frontmatter**：parser 邏輯本身不變，只動 drift telemetry 的搬遷與 IPC 暴露

## 完成回報必填

1. 修改檔案清單（含每檔 `+/-` 行數）
2. `npm run build` 輸出截圖或最後 30 行 log（確認 D090 guard 綠燈）
3. `npm run test:unit` 通過數（含 ct-drift-telemetry test 是否成功搬遷後仍跑得起來）
4. commit hash + commit message
5. （若有）vitest config 異動說明
6. （若有）對 BUG-078 frontmatter 的更新（FIXING → FIXED）

## 回報區

### 狀態

✅ FIXED — 2026-04-28 23:36 (UTC+8)

### 產出摘要

純搬遷 + IPC bridge，行為不變、API 表面對 logger 加了 `userDataDir?` 參數。

| 檔案 | 動作 | 行數 |
|------|------|------|
| `electron/ct-drift-telemetry.ts` | NEW（從 src/ 搬來，加 `userDataDir` 預設邏輯） | +137 |
| `electron/__tests__/ct-drift-telemetry.test.ts` | NEW（從 src/ 搬來 + 2 個 userDataDir 測試） | +124 |
| `electron/main.ts` | EDIT（加 `ctDrift:log` / `ctDrift:readRecent` IPC handler + import） | +18 |
| `electron/preload.ts` | EDIT（暴露 `window.electronAPI.ctDrift.{log,readRecent}`） | +16 |
| `src/types/electron.d.ts` | EDIT（補 `ctDrift` 介面型別） | +17 |
| `src/components/ControlTowerPanel.tsx` | EDIT（loadWorkOrders 內最小接線：silent fail logDrift） | +9 / -1 |
| `vite.config.ts` | EDIT（`test.include` 加 `electron/__tests__/**/*.test.ts`） | +2 |
| `src/utils/ct-drift-telemetry.ts` | DELETE | -134 |
| `src/utils/__tests__/ct-drift-telemetry.test.ts` | DELETE | -109 |
| `_ct-workorders/BUG-078-...md` | EDIT（FIXING → FIXED + fixed_at + fixed_by） | +3 / -1 |

### 驗收

| 項目 | 結果 |
|------|------|
| `npm run test:unit` | ✅ 32 files / **377 tests** passed（前 375 + 本工單 +2 新增 userDataDir 測試） |
| `npx vite build` | ✅ built（renderer + electron main + preload + terminal-server 全綠） |
| `node scripts/verify-renderer-imports.js`（D090 guard） | ✅ scanned 149 files, no banned Node imports |
| `npx tsc --noEmit` 對本工單觸及檔案 | ✅ 無新增錯誤（`ct-drift` / `ctDrift` / `ControlTowerPanel` / `preload.ts` / `electron.d.ts` / `electron/main.ts` 全綠；既有 CodexAgentPanel.tsx 等 pre-existing 錯誤與本工單無關） |
| `grep -r ct-drift-telemetry src/` | ✅ 零殘留 |
| 單跑 `electron/__tests__/ct-drift-telemetry.test.ts` | ✅ 7 tests pass（含 `defaultDriftLogPath(userDataDir)` 與 `logDrift(... { userDataDir })` 兩個新測試） |

### 設計重點

1. `electron/ct-drift-telemetry.ts` 新增 `userDataDir?` 參數：
   - `defaultDriftLogPath(userDataDir?)` — 有 `userDataDir` → `<userDataDir>/ct-drift.log`；無 → `~/.bat-cache/ct-drift.log`（向下相容）
   - `LogDriftOptions.userDataDir` / `ReadRecentOptions.userDataDir` — main process 呼叫時預設帶 `app.getPath('userData')`
2. IPC handler 沿用 `wsl:fetch-fingerprint` pattern：純 thin wrapper，由 main 統一注入 `userDataDir`，renderer 端 silent fire-and-forget
3. preload bridge `window.electronAPI.ctDrift = { log, readRecent }`，回傳純值物件（safe for IPC structured clone）
4. `ControlTowerPanel.tsx` 最小接線：在 `loadWorkOrders` 的 `parseWorkOrder` 後檢查 `wo.parseWarnings`，存在時 fire-and-forget 一次 `ctDrift.log`，`.catch(() => {})` 確保 IO 失敗不影響 UI
5. vitest 涵蓋範圍擴增：在 `vite.config.ts` `test.include` 加 `electron/__tests__/**/*.test.ts`（與 T0325 既有 `electron/remote/__tests__/` 並列）

### 不在本工單範圍

- 完整 ParseWarning fan-out（backlog/bug-tracker/decision-log 等其他 caller）→ Sprint 6 polish
- drift dashboard UI / aggregation → Sprint 6
- `ct-frontmatter.ts` 內部邏輯不動

### 互動紀錄

無（fire-and-forget，純執行）。

### Renew 歷程

無。

### 遭遇問題

無。`npm run dev` 肉眼驗收標為可選且耗時，跳過；改以 `vite build` + D090 guard 雙保險。

### Commit

待 Step 8 commit 後填入 hash。

---
