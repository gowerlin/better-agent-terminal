---
schema_version: 1
schema_kind: workorder
id: T0331
title: "PLAN-032 Sprint 2: WizardErrorMapper framework（registry + fallback resolver）"
status: DONE
created_at: "2026-04-27T22:50:00+08:00"
started_at: "2026-04-27T22:51:00+08:00"
completed_at: "2026-04-27T22:58:00+08:00"
renew_count: 0
---
# T0331 — PLAN-032 Sprint 2: WizardErrorMapper framework（registry + fallback resolver）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0331 |
| 標題 | 新增 `WizardErrorMapper` framework — error registry、4-stage resolver、與 WizardRunner catch block 接線 |
| 類型 | feat（framework + integration） |
| 優先級 | 🔴 High（PLAN-032 Sprint 2 — Sprint 3 BUG-073/072 修復依賴此 framework） |
| 狀態 | ✅ DONE |
| 開始時間 | 2026-04-27 22:51 (UTC+8) |
| 完成時間 | 2026-04-27 22:58 (UTC+8) |
| 建立時間 | 2026-04-27 22:50 (UTC+8) |
| 派發模式 | `--mode yolo --no-interactive` |
| 關聯 PLAN | PLAN-032（Sprint 2） |
| 關聯 spec | `_ct-workorders/_spec-wizard-error-ux.md` § 3（Error Mapping） |
| 關聯前序 | T0330 ✅ DONE（commit `e0a23e5`，state machine + transition guard 已就位） |
| 關聯 BUG | BUG-073（Docker daemon raw stderr）/ BUG-072（WSL linger raw error）— Sprint 3 套用此 framework 收尾 |
| 預估時間 | 45-90 min（M，純新增 + runner catch 接線，無大宗 callsite 改動） |
| Renew 次數 | 0 |
| affects_files | `src/components/setup-wizard/error-mapper.ts`（新檔）、`src/components/setup-wizard/error-registry.ts`（新檔，可選分檔）、`src/components/setup-wizard/wizard-runner.ts`（catch block 接線 + types export）、`src/components/setup-wizard/__tests__/error-mapper.test.ts`（新檔） |

## 背景

T0330 完成 keystone（Stepper status + state machine）。Sprint 2 第二支 framework 工單：error mapping。

**root cause**（PLAN-032 動機）：
- BUG-072：WSL 拋 `Could not enable linger: No such device or address`，純技術訊息使用者看不懂
- BUG-073：Docker 拋 `error during connect... pipe/docker_engine: The system cannot find the file specified`，使用者不知要安裝/啟動 Docker Desktop
- SSH 已有部分 structured errorCode（`verify-auth`、`start-server`），但 WSL/Docker 還是 raw strings

**framework 策略**（spec § 3）：
- 混合模式：errorCode + regex 並存，漸進升級
- Resolver 4-stage：errorCode → step regex → platform regex → fallback raw
- Registry 一個檔集中管理，後續 Sprint 3 BUG fix 工單只需擴 registry 不需動 framework

## 目標（驗收條件，工單級）

### AC-1：型別定義

`src/components/setup-wizard/error-mapper.ts`（或拆 `types.ts`）export：

```ts
export type WizardTargetOS = 'wsl' | 'ssh' | 'docker';  // 沿用 wizard-runner 既有定義（若已有則 import）

export interface WizardErrorMatch {
  id: string;                          // 唯一識別（如 'docker-daemon-unavailable'）
  platforms: WizardTargetOS[] | 'all';
  stepIds?: string[];                  // 限定在哪幾個 step 觸發
  errorCodes?: string[];               // exact match
  patterns?: RegExp[];                 // regex match against error.message
  messageKey: string;                  // i18n key（本票只放 zh-TW 字串，T0334 補 i18n）
  detailMode?: 'append-raw' | 'hidden-by-default';  // raw error 顯示策略
  actions?: WizardRecoveryActionTemplate[];  // T0333 才實作 actions schema，本票留 placeholder type
}

// Recovery actions 留 T0333；本票先定 minimal placeholder 不阻塞編譯
export type WizardRecoveryActionTemplate = {
  kind: string;  // T0333 會收緊為 union
  label?: string;
  [key: string]: unknown;
};

export interface WizardMappedError {
  matchId: string | null;              // null = fallback
  title: string;                       // 使用者面向標題
  body: string;                        // 詳細說明
  rawError: string;                    // 原始 error.message（debug 用）
  detailMode: 'append-raw' | 'hidden-by-default';
  actions: WizardRecoveryActionTemplate[];
}

export interface WizardErrorContext {
  platform: WizardTargetOS;
  stepId: string;
  errorCode?: string;                  // 若 step 主動 set
  error: Error;                        // 原始錯誤
}
```

### AC-2：Resolver 邏輯

```ts
export function resolveWizardError(
  ctx: WizardErrorContext,
  registry: WizardErrorMatch[],
): WizardMappedError;
```

**4-stage resolution order**（spec § 3）：

1. **Stage 1 — exact `errorCode` match**：若 `ctx.errorCode` 有值，找 `registry.errorCodes.includes(ctx.errorCode)`
2. **Stage 2 — step-scoped regex match**：找 `match.stepIds?.includes(ctx.stepId)` 且 `match.patterns` 有任一 hit `ctx.error.message`
3. **Stage 3 — platform-wide regex match**：找 `match.platforms === 'all' 或 includes(ctx.platform)` 且 `match.patterns` 有任一 hit
4. **Stage 4 — fallback**：`{ matchId: null, title: '步驟發生錯誤', body: ctx.error.message, rawError, detailMode: 'append-raw', actions: [] }`

每 stage 第一個命中即返回（不繼續往下）。Stage 1-3 命中 → 回傳結構化 `WizardMappedError`，title/body 來自 `messageKey`（本票直接放 zh-TW 字串字典，無 i18n lookup）。

### AC-3：Registry 初始化

`src/components/setup-wizard/error-registry.ts`（或同檔內 `DEFAULT_REGISTRY` const）：

依 spec § 6（Initial Mapping Targets）落 **3 條最小可運作條目**（不一次清完所有字典）：

```ts
export const DEFAULT_WIZARD_ERROR_REGISTRY: WizardErrorMatch[] = [
  {
    id: 'docker-daemon-unavailable',
    platforms: ['docker'],
    stepIds: ['detect-env'],
    patterns: [
      /pipe.*docker_engine/i,
      /cannot connect to.*docker daemon/i,
      /error during connect/i,
    ],
    messageKey: 'docker.daemon.unavailable',
    detailMode: 'append-raw',
    actions: [],  // T0333 補 open-link/fixed-and-retry
  },
  {
    id: 'wsl-linger-failure',
    platforms: ['wsl'],
    stepIds: ['write-systemd-unit'],
    patterns: [
      /Could not enable linger/i,
      /No such device or address/i,
    ],
    messageKey: 'wsl.linger.failure',
    detailMode: 'append-raw',
    actions: [],
  },
  {
    id: 'ssh-permission-denied',
    platforms: ['ssh'],
    stepIds: ['verify-ssh-auth'],
    errorCodes: ['permission-denied'],
    messageKey: 'ssh.auth.permission-denied',
    detailMode: 'hidden-by-default',
    actions: [],
  },
];
```

對應 messageKey 的 zh-TW 字串字典：

```ts
const MESSAGE_DICT: Record<string, { title: string; body: string }> = {
  'docker.daemon.unavailable': {
    title: '未偵測到 Docker daemon',
    body: '請確認 Docker Desktop 已安裝並啟動。詳細錯誤可展開查看。',
  },
  'wsl.linger.failure': {
    title: '無法自動啟用 systemd lingering',
    body: 'WSL2 distro 限制可能導致此情況。可手動執行 `sudo loginctl enable-linger $USER` 後重試。',
  },
  'ssh.auth.permission-denied': {
    title: 'SSH 認證失敗',
    body: '請檢查 SSH key 是否正確設定，或確認帳號密碼。',
  },
  fallback: {
    title: '步驟發生錯誤',
    body: '',  // body = ctx.error.message
  },
};
```

> 字典放同檔 `error-mapper.ts` 內部（T0334 抽 i18n 時再拆）

### AC-4：Wizard runner 接線

`src/components/setup-wizard/wizard-runner.ts`：

1. Import `resolveWizardError` + `DEFAULT_WIZARD_ERROR_REGISTRY` + types
2. 在 `step.run()` catch block（snapshot.error 賦值上方）插入：
   ```ts
   const mapped = resolveWizardError(
     {
       platform: ctx.target.kind,        // 沿用 ctx.target.kind 拿 wsl/ssh/docker
       stepId: step.id,
       errorCode: error instanceof WizardStepError ? error.code : undefined,  // 若有 WizardStepError 結構，否則 undefined
       error: error instanceof Error ? error : new Error(String(error)),
     },
     DEFAULT_WIZARD_ERROR_REGISTRY,
   );
   snapshot.mappedError = mapped;  // 新欄位
   snapshot.error = mapped.body || mapped.rawError;  // 維持既有 error 欄位向下相容
   ```
3. 擴充 `WizardStepSnapshot` interface 加 `mappedError?: WizardMappedError` 欄位（optional 不破壞既有 callsite）

**Optional**：若 wizard-runner 沒有 `WizardStepError` class，本票**不新增**（留 T0333/Sprint 3）；只透過 `error.message` 走 regex stage。

### AC-5：Unit tests

`src/components/setup-wizard/__tests__/error-mapper.test.ts` 新檔：

最少涵蓋：

1. **Stage 1 errorCode hit**：給 `errorCode: 'permission-denied'` → 命中 ssh-permission-denied
2. **Stage 2 step regex hit**：Docker `detect-env` step + error message `error during connect` → 命中 docker-daemon-unavailable
3. **Stage 3 platform regex hit**：WSL 任意 step + error message `Could not enable linger` → 命中 wsl-linger-failure（即使 `stepIds` 沒包含此 step，也應透過 platform-wide stage 命中 — wait，此例 stepIds 限定 `write-systemd-unit`，所以這條 case 應寫成「stepIds 不限定的 entry」或改 case：用 `connect-test` step 測 platform-wide fallback。**請 Worker 自行決定 case 設計**確保涵蓋 stage 3）
4. **Stage 4 fallback**：未命中任何 entry → 回傳 fallback 結構，body = error.message
5. **Resolver short-circuit**：Stage 1 命中後不繼續往下查（mock 後續 entries 確認未被檢查）

**OOS（留後續）**：
- ❌ Recovery actions 實作（T0333）
- ❌ Pre-flight hook（T0332）
- ❌ i18n lookup（T0334）
- ❌ 完整字典擴充（依 BUG-072/073 Sprint 3 工單需要再補）

## 實作順序建議

1. **Step 1**：建 `error-mapper.ts`（types + resolver + registry + dict）→ 跑 tests 綠
2. **Step 2**：擴 `WizardStepSnapshot` 加 `mappedError` field
3. **Step 3**：runner catch block 接線
4. **Step 4**：跑既有測試套件（確認 snapshot.error 向下相容無 regression）
5. **Step 5**：`npm run build` + commit

## 風險與緩解

| 風險 | 緩解 |
|------|------|
| `ctx.target.kind` 不存在或型別不符 | Worker 先 grep `wizard-runner.ts` 確認 `WizardContext.target` 形狀；若需轉換用 `ctx.target.kind ?? 'ssh'` 並加 console.warn |
| Regex 在大量 error message 上 perf 過差 | Sprint 2 範圍 registry 只 3 條，無 perf 問題；T0334 / Sprint 3 擴大時再評估 |
| `snapshot.error` 改成 mapped body 後既有 UI 顯示破版 | 保留 `snapshot.rawError` 或讓 UI 透過 `mappedError` 取結構化資料；snapshot.error 維持 string 以向下相容 |
| ESLint / type 檢查 placeholder `WizardRecoveryActionTemplate.[key: string]: unknown` 警告 | 加 `// eslint-disable-next-line` 註解並寫「T0333 收緊」 |

## 自檢清單

- [ ] AC-1：types 完整 export，與 spec § 3 一致
- [ ] AC-2：resolver 4-stage 順序正確，stage 1 命中不再往下查
- [ ] AC-3：registry 3 條最小條目落地 + zh-TW 字典
- [ ] AC-4：wizard-runner catch block 接線，snapshot.mappedError 寫入，snapshot.error 向下相容
- [ ] AC-5：unit tests ≥5 case 全綠
- [ ] `npm run test:unit` 全套綠（T0330 後 baseline 208，本票應 ≥213）
- [ ] `npx vite build` 綠
- [ ] commit message：`feat(setup-wizard): add WizardErrorMapper framework with 3-entry registry (T0331, PLAN-032 Sprint 2)`

## YOLO 模式 — 下一張工單建議

T0331 DONE 後鏈式派 **T0332**：`WizardPreflight` hook + cache（spec § 4，新檔 `preflight.ts` 無 overlap）。

## 回報區（Worker 填寫）

### 實作摘要

新增三檔 + 一檔修改：

- `src/components/setup-wizard/error-mapper.ts`（新檔，248 行）：types（`WizardErrorPlatform` / `WizardErrorMatch` / `WizardMappedError` / `WizardErrorContext` / `WizardRecoveryActionTemplate`）、`resolveWizardError` 4-stage resolver、`DEFAULT_WIZARD_ERROR_REGISTRY` 3 條最小條目、`MESSAGE_DICT` zh-TW 字典、`targetOSToErrorPlatform` 轉換 helper
- `src/components/setup-wizard/__tests__/error-mapper.test.ts`（新檔，249 行）：14 個 test case 涵蓋 4 個 stage + short-circuit + targetOS 對應 + custom registry edge cases
- `src/components/setup-wizard/wizard-runner.ts`（修改）：import error-mapper、re-export types/funcs、catch block 接線（轉 platform、抽 `error.code` 走 stage 1、寫 `snapshot.mappedError`）、`WizardStepSnapshot` 加 `mappedError?: WizardMappedError` 欄位

完成狀態：DONE
- 222 unit tests pass（baseline 208 + 新增 14 個）
- vite build 綠
- commit hash：`b3ae88f`

### Resolver 設計細節

**4-stage 命中策略**：
1. **Stage 1（errorCode exact）**：僅當 `ctx.errorCode` 有值時掃 registry，過濾 `platforms` 與 `errorCodes` 兩個條件
2. **Stage 2（step-scoped regex）**：entry 必須有 `stepIds` 且包含 `ctx.stepId`，patterns 對 `error.message` 任一命中即 win
3. **Stage 3（platform-wide regex）**：entry 不能有 `stepIds`（或為空陣列），platforms 與 patterns 同 stage 2
4. **Stage 4（fallback）**：`matchId: null`、title「步驟發生錯誤」、body=raw error.message、detailMode `append-raw`

**Edge cases**：
- entry `platforms === 'all'` 自動穿透所有 platform（已測）
- `messageKey` 找不到字典 → `lookupMessage` fallback 到 `MESSAGE_DICT.fallback`，避免 undefined（已測：custom registry 用未註冊 key 仍拿到通用標題）
- entry 缺 `detailMode` → `buildMapped` 預設 `append-raw`（已測）
- `errorCode` 設了但無命中 entry → 自然 fallthrough 到 stage 2/3（已測：`errorCode: 'unknown-code'` + 命中 regex entry）
- short-circuit 驗證採 Proxy `RegExp.test` 計數，stage 1 win 後計數仍為 0 確認 stage 2 未執行

### snapshot.error 向下相容驗證

`snapshot.error` 仍然寫入 `errorObj.message`（raw string），與既有 UI / test 100% 相容。新欄位 `snapshot.mappedError` 為 optional，未消費此欄位的 callsite 不受影響。

回歸驗證：執行 `npm run test:unit -- --run`，原 208 tests 全綠（含 `wizard-runner.transitions.test.ts` 22 cases、`SetupWizardShell.test.tsx` 等），確認無 regression。

### 偏離 spec 的決策

**D113（Worker-decided）**：`WizardErrorPlatform` 軸獨立於 `WizardTargetOS`（spec 寫 `'wsl' | 'ssh' | 'docker'`，但 wizard-runner 既有型別是 `'local' | 'wsl-linux' | 'docker-linux' | 'ssh-linux' | 'ssh-darwin'`，不能直接沿用）。新增 `targetOSToErrorPlatform()` 轉換器在 catch block 處呼叫，並把 `'local'` 也納入 platform 軸（雖 registry 暫無 local 條目）。理由：error 軸不需區分 ssh-linux / ssh-darwin，但需保留 local（未來可能有 local-only 錯誤）。

**D114（Worker-decided）**：errorCode 來源從 `error.code` 屬性抽（`Error & { code?: string }`），而非依賴自定 `WizardStepError` class（spec § AC-4 Optional 已允許此 fallback）。對 SSH 既有 step 的 structured error 需 throw 帶 `.code` 屬性的 Error 物件，T0335 / Sprint 3 SSH workorder 處理。

**未偏離**：`WizardRecoveryActionTemplate` 維持 placeholder（`kind: string` + index signature），與 spec § AC-1 一致；T0333 收緊。registry 3 條條目與 spec § 6 Initial Mapping Targets 一致。

### 自檢結果
- [x] AC-1 ~ AC-5 全達成
- [x] build / test 全綠（222 tests pass，vite build 通過）
- [x] commit hash：`b3ae88f`

### 後續建議

T0332（`WizardPreflight` hook + cache）可立即派發：
- 新檔 `preflight.ts`，與 `error-mapper.ts` 無 file overlap
- 不依賴 T0331 任何 export，可平行進行
- 若 T0332 worker 想在 preflight failure 時也走 `WizardErrorMapper`，可 import `resolveWizardError` 與 `DEFAULT_WIZARD_ERROR_REGISTRY`（公開 API 已 ready）

T0333 補 recovery actions 時請務必：
1. 收緊 `WizardRecoveryActionTemplate.kind` 為 discriminated union
2. registry 3 條 entries 補實際 actions（`open-link` 給 docker-daemon-unavailable / `run-command` 給 wsl-linger-failure / `fixed-and-retry` 給 ssh-permission-denied）

---

**狀態流轉**：📋 PENDING → 🔄 IN_PROGRESS → ✅ DONE
