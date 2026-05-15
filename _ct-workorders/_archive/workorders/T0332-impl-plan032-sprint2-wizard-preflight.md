---
schema_version: 1
schema_kind: workorder
id: T0332
title: "PLAN-032 Sprint 2: WizardPreflight hook + per-session cache"
status: DONE
created_at: "2026-04-27T23:00:00+08:00"
started_at: "2026-04-27T23:02:00+08:00"
completed_at: "2026-04-27T23:09:00+08:00"
renew_count: 0
---
# T0332 — PLAN-032 Sprint 2: WizardPreflight hook + per-session cache

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0332 |
| 標題 | 新增 `WizardPreflight` hook（step.preflight）+ per-wizard-session cache + 與 ErrorMapper 整合 |
| 類型 | feat（framework + integration） |
| 優先級 | 🔴 High（PLAN-032 Sprint 2 — Sprint 3 Docker/WSL/SSH BUG 修復依賴 preflight 提前攔截） |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 23:00 (UTC+8) |
| 開始時間 | 2026-04-27 23:02 (UTC+8) |
| 完成時間 | 2026-04-27 23:09 (UTC+8) |
| 派發模式 | `--mode yolo --no-interactive` |
| 關聯 PLAN | PLAN-032（Sprint 2） |
| 關聯 spec | `_ct-workorders/_spec-wizard-error-ux.md` § 4（Pre-flight Hook） |
| 關聯前序 | T0330 ✅ `e0a23e5` / T0331 ✅ `85eb8ff`（ErrorMapper 已可在 preflight failure 時複用） |
| 關聯 BUG | BUG-073（Docker daemon）/ BUG-072（WSL systemd）/ BUG-074（SSH host） — Sprint 3 用 preflight 提前偵測 |
| 預估時間 | 45-90 min（M，純新增 + runner step.run() 前 hook 接線） |
| Renew 次數 | 0 |
| affects_files | `src/components/setup-wizard/preflight.ts`（新檔，types + cache + runner helper）、`src/components/setup-wizard/wizard-runner.ts`（step.run() 前接 preflight hook + cache 注入）、`src/components/setup-wizard/__tests__/preflight.test.ts`（新檔） |

## 背景

T0330（state machine）+ T0331（ErrorMapper）已落地。Sprint 2 第三支 framework：preflight。

**動機**（PLAN-032 + spec § 4）：
- Docker step 真跑時才偵測 daemon 失敗 → 體驗差。應 step 一進來先檢查 daemon，失敗直接顯示友善訊息（避開 step.run() 內的長執行）
- WSL step 同理，systemd / linger 就緒度檢查
- SSH host alias 提早確認

**framework 策略**（spec § 4）：
- `step.preflight?(ctx) → Promise<WizardPreflightResult>` 在 `step.run()` 前跑
- `cacheKey` 回傳 → cache per-wizard-session（同 wizard run 內結果可重用，wizard 重啟 invalidate）
- `warningOnly: true` → append 到 `ctx.warnings` 後繼續執行 step
- Hard failure → 走 ErrorMapper pipeline（同 step.run() catch block 邏輯），不執行 step.run()

## 目標（驗收條件，工單級）

### AC-1：型別定義

`src/components/setup-wizard/preflight.ts` export：

```ts
export interface WizardPreflightResult {
  ok: boolean;
  reason?: string;          // 失敗時的訊息（會 wrap 進 Error 後丟給 ErrorMapper）
  errorCode?: string;       // 失敗時的 errorCode（讓 ErrorMapper Stage 1 可命中）
  cacheKey?: string;        // 設則 cache（同 wizard session 內 reuse）
  ttlMs?: number;           // optional cache TTL；未設 = 永遠 cache 直到 wizard 結束
  warningOnly?: boolean;    // true = append warning 後繼續，false/undefined = 阻擋 step.run()
}

export interface WizardPreflightCacheEntry {
  result: WizardPreflightResult;
  storedAt: number;         // epoch ms
}

export type WizardPreflightCache = Map<string, WizardPreflightCacheEntry>;

// Helper to create a fresh cache (per wizard-session)
export function createPreflightCache(): WizardPreflightCache;

// Cache lookup with TTL check
export function getPreflightCached(
  cache: WizardPreflightCache,
  key: string,
  now?: number,
): WizardPreflightResult | undefined;

// Cache set
export function setPreflightCached(
  cache: WizardPreflightCache,
  key: string,
  result: WizardPreflightResult,
  now?: number,
): void;
```

### AC-2：WizardStep 擴充

`src/components/setup-wizard/wizard-runner.ts`：

`WizardStep` interface 新增 optional field：

```ts
import type { WizardPreflightResult } from './preflight';

export interface WizardStep {
  // ... 既有欄位 ...
  preflight?: (ctx: WizardContext) => Promise<WizardPreflightResult>;
}
```

### AC-3：WizardContext 擴充

`WizardContext` 新增：

```ts
export interface WizardContext {
  // ... 既有欄位 ...
  warnings: string[];       // preflight warningOnly 收集（runner 初始化空陣列；既有 callsite 不破壞）
}
```

> 若既有 ctx 已有 warnings 或類似欄位 → 沿用，不新增。Worker 自決。

### AC-4：Runner preflight hook 接線

在 `step.run()` 呼叫前插入 preflight 流程：

```ts
// pseudo-code（Worker 依實際 runner 結構調整）
if (step.preflight) {
  let preflightResult: WizardPreflightResult | undefined;

  // Cache lookup
  if (step.preflight.cacheKey 概念透過先呼叫 preflight 取 cacheKey?) {
    // 注意：cacheKey 是 result 的欄位不是 step 的，所以 cache 策略是「先 run preflight，回傳後依 cacheKey 決定 cache 與否」
  }

  // 簡化：第一輪不 cache，run preflight；result 回傳含 cacheKey 則寫 cache
  // 但這樣每次 step 進來都會 run 一次 preflight... 反直覺

  // 推薦做法：
  // 1. preflight 內部自行決定要不要 cache hit。Runner 不替 preflight 做 cache lookup。
  // 2. Runner 提供 cache 物件（透過 ctx.preflightCache 或 helper），preflight 自己呼叫 getPreflightCached/setPreflightCached
  // 3. 這樣 cacheKey 設計權交給 step 作者
}
```

**推薦設計**（簡化）：

- Runner 在 `WizardContext` 注入 `preflightCache: WizardPreflightCache`（runner 啟動時用 `createPreflightCache()` 建一個）
- step 的 preflight function 自己呼叫 `getPreflightCached(ctx.preflightCache, key)` 決定要不要重跑
- Runner 只負責：
  1. 若 `step.preflight` 存在 → `await step.preflight(ctx)` 拿 result
  2. `result.ok === false && !result.warningOnly` → 不執行 `step.run()`，視為 step failure，走 ErrorMapper pipeline（複用 T0331 邏輯）
  3. `result.ok === false && result.warningOnly === true` → `ctx.warnings.push(result.reason ?? 'preflight warning')`，繼續執行 step.run()
  4. `result.ok === true` → 直接執行 step.run()

**ErrorMapper 整合**（preflight failure → mapped error）：

```ts
// runner pseudocode
if (preflightResult && !preflightResult.ok && !preflightResult.warningOnly) {
  const error = new Error(preflightResult.reason ?? 'Preflight check failed');
  (error as Error & { code?: string }).code = preflightResult.errorCode;

  const mapped = resolveWizardError(
    {
      platform: targetOSToErrorPlatform(ctx.target.kind),
      stepId: step.id,
      errorCode: preflightResult.errorCode,
      error,
    },
    DEFAULT_WIZARD_ERROR_REGISTRY,
  );
  snapshot.mappedError = mapped;
  snapshot.error = mapped.body || mapped.rawError;
  // status transition: pending → failed（透過 transitionStatus helper）
  // 不執行 step.run()
  continue;  // 或 break，視 runner loop 結構
}
```

### AC-5：Unit tests

`src/components/setup-wizard/__tests__/preflight.test.ts` 新檔：

最少涵蓋：

1. **cache hit**：`setPreflightCached` 後 `getPreflightCached` 同 key 回傳同 result
2. **cache miss**：未存的 key 回傳 undefined
3. **TTL expiry**：`setPreflightCached(cache, key, result, now=1000)`，`getPreflightCached(cache, key, now=2000)` with `result.ttlMs=500` → undefined
4. **永久 cache**：`ttlMs` 未設 → 任何時間 lookup 都拿到 result
5. **createPreflightCache 是新 Map**：兩次呼叫不共用

**Runner integration tests**（同檔或 wizard-runner.test.ts 內）：

6. **preflight ok**：step 有 preflight 回 `{ok: true}` → step.run() 被呼叫
7. **preflight hard fail**：step.preflight 回 `{ok: false, errorCode: 'docker-daemon-down'}` → step.run() **未被呼叫**，snapshot.status = failed，snapshot.mappedError 有值
8. **preflight warningOnly**：`{ok: false, warningOnly: true, reason: 'X'}` → step.run() 仍被呼叫，ctx.warnings 含 'X'
9. **preflight throws Error**：被 catch 視為 hard fail（synthesize `{ok: false, reason: error.message}`）
10. **無 preflight**：既有 step 無 preflight → 行為與 T0331 完全一致（snapshot 流轉 + ErrorMapper 在 step.run() catch 仍生效）

### AC-6：Snapshot 向下相容

- `snapshot.warnings`（若新增於 snapshot）為 optional
- `ctx.warnings` 為 array，初始 `[]`，既有 step 不 push 任何東西即無變化
- 既有測試（T0330 後 baseline 222）必須全綠

**OOS（留後續）**：
- ❌ 實際 Docker daemon / WSL systemd / SSH host 的 preflight 實作（Sprint 3 BUG fix 工單）
- ❌ Recovery actions 處理（T0333）
- ❌ Cache 跨 wizard run 持久化（per-session 即可）

## 實作順序建議

1. **Step 1**：`preflight.ts` 新檔（types + cache helpers）→ 跑 cache unit tests 綠
2. **Step 2**：`WizardContext` 加 `warnings: []` + `preflightCache: WizardPreflightCache`，runner 初始化
3. **Step 3**：`WizardStep.preflight?` field 擴充
4. **Step 4**：runner step.run() 前接 preflight hook（含 ErrorMapper 整合）
5. **Step 5**：runner integration tests（10 case）
6. **Step 6**：`npm run test:unit` 全綠 + `npm run build` 綠
7. **Step 7**：commit

## 風險與緩解

| 風險 | 緩解 |
|------|------|
| `WizardContext` 加新欄位破壞既有 callsite | 用 optional + 預設值；ctx 在 runner 內部建構，外部 callsite 通常不直接 new ctx |
| preflight cache 在 wizard 中途被改寫導致狀態不一致 | cache Map 由 runner 持有，step 只透過 helper 函式存取；不暴露 mutation API |
| preflight throw 未 catch 導致 unhandled rejection | runner 用 try/catch 包 preflight 呼叫，synthesize hard fail result |
| ErrorMapper resolver 對 preflight error 的 stepId 不認 → 命中 fallback | 預期行為；Sprint 3 工單會在 registry 補對應 entry（如 `docker-daemon-down` errorCode → docker-daemon-unavailable entry） |

## 自檢清單

- [ ] AC-1：preflight.ts types + cache helpers + factory
- [ ] AC-2：WizardStep.preflight? field
- [ ] AC-3：WizardContext.warnings (+ optional preflightCache injection)
- [ ] AC-4：runner hook 接線 + ErrorMapper 整合（hard fail / warningOnly / ok 三路徑）
- [ ] AC-5：unit tests ≥10 case 全綠
- [ ] AC-6：既有測試 222 baseline 全綠（無 regression）
- [ ] `npm run test:unit` 全綠（baseline 222 + 新增 ≥10，預期 ≥232）
- [ ] `npx vite build` 綠
- [ ] commit message：`feat(setup-wizard): add WizardPreflight hook with per-session cache (T0332, PLAN-032 Sprint 2)`

## YOLO 模式 — 下一張工單建議

T0332 DONE 後鏈式派 **T0333**：Recovery actions schema + `SetupWizardShell` wiring（spec § 5）。
T0333 依賴 T0330（已 DONE），影響 `error-mapper.ts` 的 `WizardRecoveryActionTemplate` 收緊為 union + Shell 渲染 actions UI。

## 回報區（Worker 填寫）

### 實作摘要

新檔 2、修改 1：

- `src/components/setup-wizard/preflight.ts`（新檔，68 行）— `WizardPreflightResult` / `WizardPreflightCacheEntry` / `WizardPreflightCache` types + `createPreflightCache()` / `getPreflightCached()` / `setPreflightCached()` helpers
- `src/components/setup-wizard/wizard-runner.ts`（修改）— 加 preflight import + re-export、`WizardContext.preflightCache?` 欄位、`WizardStep.preflight?(ctx)` 欄位、constructor 注入 `createPreflightCache()` 預設、`runInternal` 的 `try` block 開頭插入 preflight 流程（ok / hard-fail throw / warningOnly push warning 三路徑）
- `src/components/setup-wizard/__tests__/preflight.test.ts`（新檔，236 行）— 14 個測試 case

commit：`8bb972e`
tests：236 全綠（baseline 222 + 新增 14）
build：`npx vite build` 綠

### Cache 設計細節

- **生命週期**：per-WizardRunner instance。constructor 用 `??=` 注入 `createPreflightCache()`，使用者也可在 ctx 預先掛自己的 cache（測試與跨 runner 重用場景）
- **TTL 邏輯**：result 帶 `ttlMs`（>= 0）才會過期；未設或為負數視為 session 內永久有效。`getPreflightCached(now)` 比對 `now - storedAt >= ttlMs` 判斷過期，過期會 evict（`cache.delete(key)`）並回 undefined
- **與 wizard restart 互動**：runner 每次 new 都拿到全新 Map（除非 caller 顯式傳入），對應 spec § 4 的 "wizard 重啟 invalidate" 語意。沒做跨 wizard run 的持久化（OOS）
- **cacheKey 儲存策略**：runner 在收到 `result.cacheKey` 後自動 `setPreflightCached`，省得每個 step 重複 boilerplate；step 仍可在 preflight 內部手動呼叫 `getPreflightCached` 決定是否重跑

### Runner hook 三路徑驗證

| 路徑 | 行為 | 測試 case |
|------|------|-----------|
| `ok: true` | step.run() 正常執行，snapshot → Succeeded | `preflight ok -> step.run() executes` |
| `ok: false` + 無 `warningOnly` | throw 進既有 catch，走 ErrorMapper + retry/skip/rollback；step.run() 不被呼叫 | `preflight hard fail -> step.run() NOT called, snapshot.failed + mappedError set` |
| `ok: false` + `warningOnly: true` | `ctx.warnings.push(reason)`、emitProgress、step.run() 仍跑，snapshot → Succeeded | `preflight warningOnly -> step.run() executes + ctx.warnings populated` |
| preflight throw | catch 後合成 `{ok:false, reason: error.message}`，走 hard-fail 路徑 | `preflight throws -> synthesized hard fail with error.message` |
| 無 preflight | T0331 baseline 行為一致 | `no preflight -> behavior unchanged from T0331 baseline` |
| retry | 重跑 preflight + run；preflight 第二次回 ok 即繼續 | `preflight hard fail allows retry which re-invokes preflight + run` |

### 偏離 spec 的決策

1. **runner 自動 cache result**：spec § 4 範例伪码 "Runner 不替 preflight 做 cache lookup" 是針對 _hit_ 邏輯（避免 runner 替 step 做 cacheKey 預先解析）。我保留此設計（hit 由 step 自行透過 `getPreflightCached` 處理），但對 _store_ 採取主動策略——只要 result 帶 `cacheKey` runner 就 `setPreflightCached`，省 step 重複 boilerplate。step 想自定 store 行為，可選擇在 result 不附 `cacheKey` 並在 preflight 內部自己呼叫 setter。
2. **hard fail 透過 throw 重用既有 catch**：原工單 pseudocode 顯示「runner 自己組 mappedError、設 snapshot、continue 迴圈」。實作上改 throw 拋進既有 `catch (error)` 分支，重用 `resolveWizardError` + retry/skip + rollback 等所有現成邏輯，避免兩條平行 error pipeline 漂移（DRY）。對外行為與 spec 等價（snapshot.status = Failed、mappedError set、retry/skip 流程不變）。
3. **`WizardContext.preflightCache` 為 optional**：避免破壞既有 callsite（外部測試 + ctx 工廠不用改）。runner constructor `??=` 注入預設 cache 後，runtime 內部 invariant 為 always-defined（test 內 `ctx.preflightCache as WizardPreflightCache` 即依此假設）。

### 自檢結果
- [x] AC-1 ~ AC-6 全達成
- [x] build / test 全綠（236 unit tests，baseline 222 + 新增 14）
- [x] commit hash：`8bb972e`

### 後續建議

T0333（Recovery actions schema + `SetupWizardShell` wiring）可接著派：

1. `error-mapper.ts` 把 `WizardRecoveryActionTemplate` 從 `{ kind: string; ... }` 收緊為 discriminated union（`open-link` / `fixed-and-retry` / `run-command` / `external-doc`）
2. `SetupWizardShell.tsx` 在 failure 狀態渲染 mapped actions，並提供按鈕觸發 retry / open-link / runtime command
3. T0332 已預留 preflight failure → ErrorMapper 同一條 pipeline，T0333 的 actions schema 對 step.run() 與 preflight 兩種來源的失敗一視同仁，無需特殊分支

Sprint 3 BUG-072/073/074 修復工單可以開始用 preflight 註冊 docker-daemon-down / wsl-systemd-not-enabled / ssh-host-unknown 對應的 errorCode（registry 加 entry 即生效，無需動 runner）

---

**狀態流轉**：📋 PENDING → 🔄 IN_PROGRESS → ✅ DONE
