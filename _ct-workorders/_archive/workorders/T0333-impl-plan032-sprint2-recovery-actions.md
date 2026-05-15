---
schema_version: 1
schema_kind: workorder
id: T0333
title: "PLAN-032 Sprint 2: Recovery actions schema + SetupWizardShell wiring"
status: DONE
created_at: "2026-04-27T23:11:00+08:00"
started_at: "2026-04-27T23:13:00+08:00"
completed_at: "2026-04-27T23:30:00+08:00"
renew_count: 0
---
# T0333 — PLAN-032 Sprint 2: Recovery actions schema + SetupWizardShell wiring

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0333 |
| 標題 | 收緊 `WizardRecoveryAction` discriminated union（7 kinds）+ Shell 渲染 mapped actions UI + Electron shell open + 補 registry 3 entries 對應 actions |
| 類型 | feat（schema + UI integration） |
| 優先級 | 🔴 High（PLAN-032 Sprint 2 — Sprint 3 BUG 修復需要 actions UI 才能完整 ship） |
| 狀態 | ✅ DONE |
| 開始時間 | 2026-04-27 23:13 (UTC+8) |
| 完成時間 | 2026-04-27 23:30 (UTC+8) |
| 建立時間 | 2026-04-27 23:11 (UTC+8) |
| 派發模式 | `--mode yolo --no-interactive` |
| 關聯 PLAN | PLAN-032（Sprint 2） |
| 關聯 spec | `_ct-workorders/_spec-wizard-error-ux.md` § 5（Recovery Actions） |
| 關聯前序 | T0330 ✅ `e0a23e5`（state）/ T0331 ✅ `85eb8ff`（ErrorMapper）/ T0332 ✅ `8bb972e`（Preflight） |
| 關聯 BUG | BUG-073（Docker daemon → open-link 下載 Docker Desktop）/ BUG-072（WSL linger → fixed-and-retry）/ BUG-074（SSH input → 不在本票範圍） |
| 預估時間 | 60-120 min（M，schema 收緊 + Shell UI render + 既有 retry/skip/cancel 路徑接通 + registry 補 actions） |
| Renew 次數 | 0 |
| affects_files | `src/components/setup-wizard/error-mapper.ts`（收緊 `WizardRecoveryAction` union + registry actions）、`src/components/setup-wizard/SetupWizardShell.tsx`（渲染 mapped actions UI）、`src/components/setup-wizard/wizard-runner.ts`（actions → runner command 對映 helper，可選）、`src/components/setup-wizard/__tests__/error-mapper.test.ts`（更新 actions 型別測試）、`src/components/setup-wizard/__tests__/SetupWizardShell.test.tsx`（新增 actions render tests） |

## 背景

T0330+T0331+T0332 三 framework 工單已落地。Sprint 2 第四支：把 ErrorMapper 的 `WizardRecoveryActionTemplate` 從 placeholder 收緊為正式 discriminated union，並在 SetupWizardShell 渲染 actions UI。

**動機**（PLAN-032 + spec § 5）：
- 現有 wizard failure 只有「重試」CTA，無上下文（重試會撞同樣 error）
- 需要場景化 actions：
  - Docker daemon down → 提供「下載 Docker Desktop」連結 + 「我已啟動，重試」
  - WSL linger 失敗 → 提供「我已執行手動命令，重試」（fixed-and-retry）
  - SSH 認證失敗 → 「修改設定」按鈕（jump-back 到 configure-ssh-host）+ 「重試」

**framework 策略**（spec § 5 hybrid model）：
- 7 內建 kinds：`retry` / `fixed-and-retry` / `open-link` / `edit-config` / `skip` / `cancel` / `custom`
- 前 6 由 Shell 統一處理；`custom` 留給未來特殊場景

## 目標（驗收條件，工單級）

### AC-1：型別收緊

`src/components/setup-wizard/error-mapper.ts`：

把 placeholder `WizardRecoveryActionTemplate` 改為 discriminated union：

```ts
export type WizardRecoveryAction =
  | { kind: 'retry'; label?: string }
  | { kind: 'fixed-and-retry'; label?: string }
  | { kind: 'open-link'; label: string; href: string }
  | { kind: 'edit-config'; label?: string; targetStepId?: string }
  | { kind: 'skip'; label?: string }
  | { kind: 'cancel'; label?: string }
  | { kind: 'custom'; label: string; run: () => Promise<void> | void };
```

**重要**：保留型別名 `WizardRecoveryActionTemplate` 為 alias（`export type WizardRecoveryActionTemplate = WizardRecoveryAction`）以維持向下相容（T0331/T0332 import 的位置不必改）。

`WizardErrorMatch.actions` 與 `WizardMappedError.actions` 改用 `WizardRecoveryAction[]`。

### AC-2：Registry 3 entries 補 actions

更新 `DEFAULT_WIZARD_ERROR_REGISTRY`：

```ts
{
  id: 'docker-daemon-unavailable',
  // ... 既有欄位 ...
  actions: [
    { kind: 'open-link', label: '下載 Docker Desktop', href: 'https://www.docker.com/products/docker-desktop/' },
    { kind: 'fixed-and-retry', label: '我已啟動 Docker，重試' },
    { kind: 'cancel', label: '取消' },
  ],
},
{
  id: 'wsl-linger-failure',
  // ... 既有欄位 ...
  actions: [
    { kind: 'fixed-and-retry', label: '我已執行命令，重試' },
    { kind: 'skip', label: '略過此步驟' },
    { kind: 'cancel', label: '取消' },
  ],
},
{
  id: 'ssh-permission-denied',
  // ... 既有欄位 ...
  actions: [
    { kind: 'edit-config', label: '修改 SSH 設定', targetStepId: 'configure-ssh-host' },
    { kind: 'retry', label: '重試' },
    { kind: 'cancel', label: '取消' },
  ],
},
```

Fallback `WizardMappedError`（無命中 registry）保留至少 `[{ kind: 'retry' }, { kind: 'skip' }, { kind: 'cancel' }]` 作為預設行為。

### AC-3：SetupWizardShell 渲染 actions

`src/components/setup-wizard/SetupWizardShell.tsx`：

當 `snapshot.status === 'failed'` 且 `snapshot.mappedError?.actions` 有值時：

1. **取代既有「重試/略過/取消」三按鈕**（若有）為 `mappedError.actions` 渲染
2. 每個 action 渲染為按鈕：
   - 顯示 `action.label`（若無 label，依 kind 用預設文字：retry → 「重試」、skip → 「略過」、cancel → 「取消」、edit-config → 「修改設定」、fixed-and-retry → 「已修復，重試」）
   - 點擊行為依 kind dispatch（見 AC-4）
3. **顯示 mappedError.title + body**（取代原本顯示的 raw error.message）
4. `detailMode === 'append-raw'` → 預設顯示 raw（在 body 下方折疊區）；`hidden-by-default` → 預設隱藏，提供「顯示詳細」展開按鈕

### AC-4：Action handler dispatch

每個 action kind 的處理：

| Kind | 行為 |
|------|------|
| `retry` | 呼叫 `runner.retry(stepId)` 或對應既有 retry 命令 |
| `fixed-and-retry` | 同 retry（語意上 step 已被外部修復，runner 不需特別感知；視覺上按鈕文字差異即足夠表達） |
| `open-link` | `window.electronAPI.shell.openExternal(action.href)`（沿用既有 pattern，見 `AboutPanel.tsx`） |
| `edit-config` | 呼叫 `runner.jumpToStep(action.targetStepId ?? findEditablePredecessor())` |
| `skip` | 呼叫 `runner.skip(stepId)` 或對應既有 skip 命令 |
| `cancel` | 呼叫 `runner.cancel()` 或對應既有 cancel 命令 |
| `custom` | `await action.run()`（注意 try/catch，失敗時 console.warn） |

**注意**：若 runner 既有 retry/skip/cancel API 名稱不同，沿用既有 → 不為了 spec 重新命名；T0334 補 spec 細節。

### AC-5：fixed-and-retry 視覺差異

按 spec § 5：「`fixed-and-retry` keeps the step failed until the user confirms remediation」。

實作：
- 按鈕文字明確（`label` 預設「已修復，重試」）
- 按鈕點擊前 step 維持 failed 狀態（使用者沒按按鈕就一直 failed）
- 按下後行為 = retry（runner 重跑 step）

無需新增 status；現有 failed 狀態 + 按鈕語意已足夠表達。

### AC-6：Unit + Integration tests

#### error-mapper.test.ts 更新（少量）

- 既有 14 case 中 actions 型別測試從 `placeholder` 改為 union（type-check 即可，runtime 行為不變）
- 新增 1 case：registry 3 entries 的 `actions` 各自符合 union

#### SetupWizardShell.test.tsx 新增（5+ case）

1. **fail + actions render**：snapshot.status=failed + mappedError.actions=[3 個] → 渲染 3 個按鈕，文字符合
2. **open-link click**：mock `window.electronAPI.shell.openExternal`，點擊 open-link 按鈕後被呼叫且 href 正確
3. **retry click**：mock runner，點擊 retry 後 runner.retry 被呼叫
4. **edit-config jump-back**：點擊後 runner.jumpToStep 被呼叫，targetStepId 正確
5. **detail toggle**：detailMode='hidden-by-default' → 預設不顯示 raw，點「顯示詳細」後顯示

### AC-7：向下相容

- T0331/T0332 既有 callsite import `WizardRecoveryActionTemplate` 的位置仍可編譯（透過 alias）
- 既有 248 tests 全綠（baseline 236 + 本票新增 ≥6 = 242）
- `npx tsc --noEmit` 對動到的檔案 0 錯（既有 pre-existing TS 錯誤不在範圍）

**OOS（留後續）**：
- ❌ Sprint 3 SSH/WSL/Docker BUG 修復（T0335-T0337）
- ❌ T0338 Cross-platform input step abstraction
- ❌ i18n 字串（T0334）
- ❌ Visual regression / a11y audit（T0334）

## 實作順序建議

1. **Step 1**：`error-mapper.ts` 收緊 union + 補 registry actions → 跑 error-mapper.test.ts 綠
2. **Step 2**：`SetupWizardShell.tsx` 渲染 actions UI（取代既有 3 按鈕區）
3. **Step 3**：Action handler dispatch（每 kind 接 runner / shell）
4. **Step 4**：detailMode 折疊邏輯
5. **Step 5**：SetupWizardShell.test.tsx 新增 5+ case
6. **Step 6**：`npm run test:unit` 全綠 + `npm run build` 綠
7. **Step 7**：commit

## 風險與緩解

| 風險 | 緩解 |
|------|------|
| `WizardRecoveryActionTemplate` alias 沒處理好導致 T0331/T0332 callsite 編譯失敗 | 第一步先建 alias，跑 type-check；若失敗立即回滾收緊範圍 |
| Shell 既有 retry/skip/cancel UI 移除導致無 mappedError 時無按鈕可按 | fallback `WizardMappedError` 一律帶 `[retry, skip, cancel]`，確保任何 failed 狀態都有 actions |
| `runner.jumpToStep` 在 awaiting-input step 上行為未測 | T0330 transition rules 已含 `awaiting-input → pending`，jump-back 安全；本票補 1 個 integration case |
| `custom.run()` throw 未 catch 導致 UI hang | 必加 try/catch + console.warn，失敗不阻擋按鈕 disable/enable 流轉 |

## 自檢清單

- [ ] AC-1：union 收緊 + alias export 維持向下相容
- [ ] AC-2：registry 3 entries 各自帶完整 actions（含 fallback）
- [ ] AC-3：Shell 渲染 actions 替換既有按鈕區，title/body/detail 顯示正確
- [ ] AC-4：7 kinds dispatch 全接通（含 Electron shell.openExternal）
- [ ] AC-5：fixed-and-retry 視覺差異（label + 點擊前維持 failed）
- [ ] AC-6：tests ≥6 case 全綠（error-mapper 微調 + Shell 新增）
- [ ] AC-7：既有 baseline 236 全綠 + alias 向下相容
- [ ] `npm run test:unit` 全綠（預期 ≥242）
- [ ] `npx vite build` 綠
- [ ] commit message：`feat(setup-wizard): tighten WizardRecoveryAction union and wire SetupWizardShell actions UI (T0333, PLAN-032 Sprint 2)`

## YOLO 模式 — 下一張工單建議

T0333 DONE 後鏈式派 **T0334**（Sprint 2 收尾）：設計規範文件更新（`docs/design/bat-stepper-design-language.md` 加 `awaiting-input`）+ visual snapshot tests + i18n hook 文件（不補翻譯，留 framework hook）。Sizing S，預估 30-60 min。

T0334 DONE → Sprint 2 完整收尾，PLAN-032 進入 Sprint 3（T0335-T0337 BUG 修復）。

## 回報區（Worker 填寫）

### 實作摘要
- `error-mapper.ts`：`WizardRecoveryActionTemplate` 收緊為 7-kind discriminated union（`WizardRecoveryAction`），舊型別名以 alias 方式保留以維持 T0331/T0332 callsite 相容。`buildFallback` 改為回傳 baseline `[retry, skip, cancel]`，確保任何 failed 狀態都有按鈕；`DEFAULT_WIZARD_ERROR_REGISTRY` 3 entries 各自帶完整 actions（含 `ssh-permission-denied` 補上 regex pattern fallback 讓 errorCode 未注入時仍可命中）。
- `SetupWizardShell.tsx`：新增 `resolveMappedErrorForSnapshot` helper、`defaultActionLabel` 與 `dispatchAction`，把舊版硬寫死的 retry/skip/cancel 替換成 `mappedError.actions` 渲染（含 `data-action-kind` 供測試錨定）。Detail panel 多了 `bat-wizard-mapped-error` 區塊，依 `detailMode` 切換 append-raw / hidden-by-default（後者帶 `Show details` toggle）。保留 legacy「edit-config 預設補上」邏輯：當 registry 沒附 edit-config 但前面有 `editableFromFailure` step 時，仍會在 cancel 前自動插入。
- 新增 i18n keys：`wizard.action.fixedAndRetry` + `wizard.action.showDetails`（en / zh-TW / zh-CN 三檔）。
- Tests：error-mapper.test.ts 微調 fallback 期待值（從 `[]` 改為 `['retry','skip','cancel']`）+ 新增 1 describe 3 case 驗證 registry actions 結構；SetupWizardShell.test.tsx 新增 1 describe 5 case（docker fail render / open-link click / retry click / edit-config jump / hidden-by-default toggle）。
- 結果：`npm run test:unit` 244 passed (16 files)；`npx vite build` 4 chunks 全綠；`npx tsc --noEmit` 對 `error-mapper.ts` / `SetupWizardShell.tsx` 0 錯。

### Action dispatch 設計細節
| Kind | Runner / Shell API |
|------|--------------------|
| `retry` / `fixed-and-retry` | `runnerRef.current.retryCurrentStep()` — 視覺差異（label）即足夠表達 spec § 5 fixed-and-retry 語意，runner 不需區分 |
| `skip` | `runnerRef.current.skipCurrentStep()` |
| `cancel` | `runnerRef.current.cancel()` |
| `open-link` | `window.electronAPI.shell.openExternal(action.href)`，外圍 try/catch + `console.warn`（preload 在測試環境可能未注入） |
| `edit-config` | 先以 `action.targetStepId` 找 index；找不到再 fallback 到 `findEditableTarget(failedIndex)`（既有編輯 predecessor 邏輯）；都找不到則 silently 跳過 |
| `custom` | `await action.run()` 包 try/catch，失敗 `console.warn` 不擋 UI |

`snap.retryable === false` 時 disable retry/fixed-and-retry/skip 按鈕（不 disable cancel / edit-config / open-link / custom）。

### detailMode 折疊 UX 決策
- `append-raw`（預設）：raw error 直接在 mapped body 下方以 `<pre>` 顯示，不需任何點擊
- `hidden-by-default`：先顯示 `Show details` 連結，點擊後 `<pre>` 出現；切換顯示步驟（`display.id` / `display.status` 變更）會 reset 回隱藏狀態，避免上一輪展開狀態洩漏到新失敗
- 視覺層級：mapped title 用 `text-rose-200 font-semibold`，body 用 `text-rose-100`，raw 用 `text-rose-200 + 邊框 + 暗背景` 區分

### 偏離 spec 的決策
- spec § 5 `ssh-permission-denied` 嚴格採用 `errorCodes` 命中。T0333 額外補了 `patterns: [/permission denied/i]` 作為 fallback，理由：Shell 從 snapshot 取得錯誤時只有 `error.message`，無 errorCode 通道；若不補 pattern 則 ssh entry 永遠落入 fallback。後續若加上 errorCode 結構化通道（snapshot 帶 errorCode），可考慮把 pattern 拿掉。
- 「fixed-and-retry 維持 failed 狀態」由 spec § 5 描述。T0333 不另外 introduce 新 status，靠 runner 自然行為（按下 retry 才重跑）達成；視覺上按鈕 label 自表（「我已啟動 Docker，重試」/「我已執行命令，重試」/「Already fixed, retry」）。

### 自檢結果
- [x] AC-1：union 收緊 + alias export 維持向下相容（T0331/T0332 既有 import 不需改動）
- [x] AC-2：registry 3 entries 各帶完整 actions；fallback 帶 baseline 3 actions
- [x] AC-3：Shell 渲染 actions 取代既有按鈕區，title/body/detail 顯示正確
- [x] AC-4：7 kinds dispatch 全接通（含 Electron `shell.openExternal` 與 `runner.jumpToStep`）
- [x] AC-5：fixed-and-retry 視覺差異（label + 點擊前維持 failed）
- [x] AC-6：tests +9 (error-mapper +3 / SetupWizardShell +5 / 1 條既有 fallback 期待值更新)；總 244 passed
- [x] AC-7：既有 baseline 全綠 + alias 向下相容
- [x] `npm run test:unit` 244 passed (預期 ≥242 ✓)
- [x] `npx vite build` 綠（4 chunks）
- [x] commit hash：`a24ba4a`

### 後續建議
- T0334（Sprint 2 收尾）可進行：DESIGN.md 加 `awaiting-input` 視覺規範、補 visual snapshot tests、i18n hook 文件（已先補 `fixedAndRetry` / `showDetails` 兩 keys，T0334 可繼續整理）
- Sprint 3 BUG-072 / BUG-073 / BUG-074 在 registry extension 上現在很容易接：只需新增 `WizardErrorMatch` 即可，actions 已經是強型別
- 未來若把 `errorCode` 通道補進 snapshot（讓 step 主動標記 structured code），可移除 ssh-permission-denied 的 regex fallback

---

**狀態流轉**：📋 PENDING → 🔄 IN_PROGRESS → ✅ DONE
