# T0336 — PLAN-032 Sprint 3: BUG-073 Docker detect-env errorCode 結構化 + Preflight 提前攔截

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0336 |
| 標題 | 修復 BUG-073：Docker daemon 未運作時 detect-env 顯示友善訊息 + open-link 下載按鈕；用 T0332 Preflight 提前攔截避免使用者等到 step.run() 才看錯誤 |
| 類型 | fix（BUG 修復 + framework 套用） |
| 優先級 | 🔴 High（BUG-073 是 PLAN-032 release ship gate 之一 — D109） |
| 狀態 | 🔄 IN_PROGRESS |
| 建立時間 | 2026-04-28 03:13 (UTC+8) |
| 開始時間 | 2026-04-28 03:16 (UTC+8) |
| 派發模式 | `--mode yolo --no-interactive` |
| 關聯 PLAN | PLAN-032（Sprint 3 第二票） |
| 關聯 BUG | **BUG-073**（owner，本票負責 OPEN → FIXED → VERIFY） |
| 關聯 spec | `_ct-workorders/_spec-wizard-error-ux.md` § 4（Pre-flight Hook）+ § 6（Initial Mapping Targets — Docker `detect-env` daemon unavailable） |
| 關聯前置閱讀 | `docs/design/wizard-error-ux.md`（T0334 開發者指南）— 「我要新增一個 preflight check」流程 |
| 關聯前序 | T0331 ✅（registry 已有 docker-daemon-unavailable entry）/ T0332 ✅（Preflight framework）/ T0333 ✅（actions 已含 open-link 下載 + fixed-and-retry + cancel）/ T0335 ✅（errorCode 結構化 pattern 範例 `94733d7`） |
| 預估時間 | 30-90 min（M，與 T0335 對稱） |
| Renew 次數 | 0 |
| affects_files | `src/components/setup-wizard/steps/wsl/detect-env.ts`（核心修復；含 Docker 與 WSL 兩個分支，本票只動 Docker 分支）、`src/components/setup-wizard/error-mapper.ts`（registry 補 errorCodes 欄位）、`src/components/setup-wizard/__tests__/detect-env.test.ts` 或併入既有檔（regression tests） |

## 背景

BUG-073 root cause（PLAN-032 § 動機）：
- Docker wizard 第 1 步 `detect-env` 在 daemon 未啟動時拋原生 stderr：`error during connect... pipe/docker_engine: The system cannot find the file specified`
- 使用者看不懂「pipe/docker_engine」，不知道要安裝 / 啟動 Docker Desktop

**Sprint 2 framework 已就緒**：
- ✅ T0331 registry 已有 `docker-daemon-unavailable` entry（`patterns: [/pipe.*docker_engine/i, /cannot connect to.*docker daemon/i, /error during connect/i]`）
- ✅ T0333 actions 已補（`open-link` 下載 Docker Desktop + `fixed-and-retry` + `cancel`）
- ❌ 但 `detect-env.ts` step.run() 拋的 raw error 沒帶 errorCode，只能靠 patterns regex 命中（Stage 2/3）
- ❌ 無 preflight 攔截 — 必須 step.run() 真跑才知 daemon down，UX 慢

**本票工作**：
1. 加結構化 errorCode（讓 ErrorMapper Stage 1 命中，更快更穩）
2. 加 preflight（用 T0332 framework 在 step.run 前主動偵測 daemon 狀態，per-session cache）
3. 補 regression tests
4. 確認 mapped error 渲染正確（含 open-link 按鈕）

## 目標（驗收條件，工單級）

### AC-1：detect-env Docker 分支 errorCode 結構化

`src/components/setup-wizard/steps/wsl/detect-env.ts`（檔名歷史包袱，內含 Docker + WSL 雙分支）：

**現狀**：
```ts
if (ctx.targetOS === 'docker-linux') {
  const status = await window.electronAPI.docker.status()
  if (!status.available) {
    throw new Error(status.error || 'Docker is not available on this machine.')
  }
  ...
}
```

**目標**：
```ts
if (ctx.targetOS === 'docker-linux') {
  const status = await window.electronAPI.docker.status()
  if (!status.available) {
    const err = new Error(status.error || 'Docker is not available on this machine.') as Error & { code?: string }
    err.code = 'docker-daemon-down'
    throw err
  }
  ...
}
```

### AC-2：Registry entry 補 errorCodes

更新 `error-mapper.ts::DEFAULT_WIZARD_ERROR_REGISTRY` 中既有 `docker-daemon-unavailable` entry：

```ts
{
  id: 'docker-daemon-unavailable',
  platforms: ['docker'],
  stepIds: ['detect-env'],
  errorCodes: ['docker-daemon-down'],   // ← 新增
  patterns: [
    /pipe.*docker_engine/i,
    /cannot connect to.*docker daemon/i,
    /error during connect/i,
  ],
  // ... 其他欄位不變（messageKey / detailMode / actions 既有 T0333 補完整）
}
```

理由：errorCode 命中比 regex 更穩（Stage 1 vs Stage 2/3）；regex 保留作為 fallback，覆蓋未走 step.run 直接 throw 的場景（例如未來其他 docker step 的 propagation）。

### AC-3：Preflight hook 攔截

`detect-env.ts` 加 `preflight`：

```ts
import type { WizardPreflightResult } from '../../preflight';

export const detectEnvStep: WizardStep = {
  // ... 既有欄位 ...
  async preflight(ctx): Promise<WizardPreflightResult> {
    // 只在 Docker 分支跑（WSL 分支留 T0337）
    if (ctx.targetOS !== 'docker-linux') {
      return { ok: true };
    }

    // Cache hit 短路
    const cached = getPreflightCached(ctx.preflightCache!, 'docker-daemon-status');
    if (cached) return cached;

    const status = await window.electronAPI.docker.status();
    const result: WizardPreflightResult = status.available
      ? { ok: true, cacheKey: 'docker-daemon-status', ttlMs: 30_000 }  // 30s cache
      : {
          ok: false,
          reason: status.error || 'Docker is not available on this machine.',
          errorCode: 'docker-daemon-down',
          cacheKey: 'docker-daemon-status',
          ttlMs: 5_000,  // 短 cache，使用者啟動 daemon 後 5s 內可重試（fixed-and-retry flow）
        };

    return result;
  },
  async run(ctx) {
    // 原 step.run() 邏輯保留作為 fallback
    // 但因 preflight 已攔截 daemon down 場景，run() 對 docker 分支基本是 no-op
    // 仍保留錯誤檢查作為 defensive（preflight 失靈時兜底）
    if (ctx.targetOS === 'docker-linux') {
      const status = await window.electronAPI.docker.status()
      if (!status.available) {
        const err = new Error(status.error || 'Docker is not available on this machine.') as Error & { code?: string }
        err.code = 'docker-daemon-down'
        throw err
      }
      ctx.logger.info(`Docker detected (${status.version ?? 'version unknown'}).`)
      return
    }
    // ... WSL 分支不動 ...
  },
}
```

**設計重點**：
- TTL 30s 對 ok（避免每次 retry 都打 IPC）
- TTL 5s 對 fail（使用者按 fixed-and-retry 後 5s 後 cache 過期重試）
- preflight return `ok: false` 時 errorCode 帶 `'docker-daemon-down'`，runner 自動走 ErrorMapper（T0332 D116）→ 命中 Stage 1 → mapped error 含 open-link 按鈕

### AC-4：State machine 流轉驗證

| 場景 | 預期 status 流轉 |
|------|----------------|
| Wizard 開啟（daemon down） | pending → failed（preflight hard fail，未進 step.run） + mappedError.matchId === 'docker-daemon-unavailable' |
| Wizard 開啟（daemon up） | pending → running → succeeded |
| daemon down → 點 fixed-and-retry → daemon 已啟動 | failed → pending → running → succeeded（cache 5s 後過期，preflight 重跑取得新 ok 結果） |
| daemon down → 點 open-link | failed 維持，shell.openExternal 開瀏覽器 |
| daemon down → 點 cancel | failed → cancelled（runner.cancel） |

baseline 276 transition tests + integration tests 全綠。

### AC-5：Regression tests

`src/components/setup-wizard/__tests__/detect-env.test.ts` 新檔（或併入 wsl-flow.test.ts / docker-flow.test.ts）：

最少涵蓋：

1. **preflight ok**：mock `docker.status` 回 `{ available: true, version: '24.0' }` → preflight result `{ ok: true, cacheKey: 'docker-daemon-status', ttlMs: 30_000 }`
2. **preflight hard fail**：mock daemon down → preflight result `{ ok: false, errorCode: 'docker-daemon-down', cacheKey, ttlMs: 5_000 }`，runner snapshot.mappedError.matchId === 'docker-daemon-unavailable'，actions 含 open-link
3. **preflight cache hit**：第二次呼叫 step preflight（同 wizard run）直接回上次結果，docker.status mock 不被重複呼叫
4. **TTL 5s 過期**：daemon 從 down → up 後重試，preflight 重跑（mock now += 6000）→ ok
5. **WSL 分支不受影響**：targetOS='wsl-linux' → preflight 直接回 `{ ok: true }`，不打 docker.status
6. **errorCode Stage 1 命中**：直接傳 `errorCode: 'docker-daemon-down'` 進 resolveWizardError → matchId === 'docker-daemon-unavailable'（T0331 stage 1 路徑）

### AC-6：Mapped actions 完整性確認

確認以下 actions 在 SetupWizardShell 渲染正確（T0333 已實作）：

- `open-link` href = `https://www.docker.com/products/docker-desktop/`，點擊呼叫 `window.electronAPI.shell.openExternal`
- `fixed-and-retry` 點擊後 runner.retry → preflight 重跑（cache 過期則重新打 IPC）
- `cancel` 點擊後 runner.cancel

**不重新測 Shell render**（T0333 已測），但確認新 errorCode 觸發的 mappedError 結構與 T0333 既有 docker entry 一致。

### AC-7：BUG-073 metadata 待塔台處理

Worker 不直接改 BUG-073 檔案。回報區註記：「BUG-073 從 OPEN → FIXED 待塔台處理（建議 → VERIFY）」。

## 實作順序建議

1. **Step 1**：閱讀 `docs/design/wizard-error-ux.md` § 「我要新增一個 preflight check」流程
2. **Step 2**：detect-env.ts Docker 分支 throw 加 errorCode（quickest win）
3. **Step 3**：detect-env.ts 加 preflight hook（用 T0332 cache helpers）
4. **Step 4**：error-mapper.ts registry entry 補 errorCodes
5. **Step 5**：regression test 6 case
6. **Step 6**：跑 `npm run test:unit` + `npx vite build` 全綠
7. **Step 7**：commit `fix(setup-wizard): Docker detect-env preflight + structured errorCode (T0336, BUG-073)`

## 風險與緩解

| 風險 | 緩解 |
|------|------|
| `ctx.preflightCache` 在 detect-env 第一次呼叫時為 undefined（runner 還沒注入） | runner 在 constructor 已 `??=` 初始化（T0332 D117）；preflight 用 `ctx.preflightCache!` 即可 |
| WSL 分支被誤改（detect-env.ts 內 WSL 分支留 T0337） | preflight 用 `if (ctx.targetOS !== 'docker-linux') return { ok: true }` 短路；T0337 補 WSL 分支 preflight |
| docker.status mock 在 unit test 環境不存在 | mock `window.electronAPI.docker.status` 與既有 wsl-flow tests 對齊 |
| TTL 5s 對使用者 UX 太短或太長 | 先設 5s，T0337 後 dogfood 微調；可改 config（OOS） |

## 自檢清單

- [ ] AC-1：Docker 分支 throw 帶 errorCode='docker-daemon-down'
- [ ] AC-2：Registry entry 補 errorCodes（不刪 patterns）
- [ ] AC-3：preflight hook 落地（含 cache + TTL 30s/5s 雙策略）
- [ ] AC-4：state machine 5 種流轉皆通過
- [ ] AC-5：regression tests ≥6 case 全綠
- [ ] AC-6：mappedError 結構與 T0333 既有 docker entry 一致（含 open-link）
- [ ] AC-7：回報區註記 BUG-073 → FIXED 待塔台處理
- [ ] `npm run test:unit` 全綠（baseline 276 + 本票 ≥6 = ≥282）
- [ ] `npx vite build` 綠
- [ ] commit message：`fix(setup-wizard): Docker detect-env preflight + structured errorCode (T0336, BUG-073)`

## YOLO 模式 — 下一張工單建議

T0336 DONE 後鏈式派 **T0337**（Sprint 3 收尾）：BUG-072 WSL linger/systemd mapping + fixed-and-retry。
- detect-env.ts WSL 分支同樣補 errorCode + preflight
- write-systemd-unit step 的 linger throw 補 errorCode='wsl-linger-failed'
- registry 確認 wsl-linger-failure entry 完整（T0331 + T0333 已大部分就緒）
- BUG-072 → FIXED → VERIFY

T0337 DONE → **PLAN-032 Sprint 3 完整收尾（3/3 BUG fix）+ ship gate D109 滿足** → v0.4.3 release 候選

## 回報區（Worker 填寫）

### 實作摘要
（範圍、commit hash、tests 數）

### Preflight 設計細節
（cache 策略、TTL 選擇、與既有 step.run() 兜底邏輯互動）

### errorCode 唯一性確認
（grep `'docker-daemon-down'` 確認唯一）

### State machine 流轉驗證
（5 種場景的實測流轉）

### 偏離 spec 的決策
（如有）

### 自檢結果
- [ ] AC-1 ~ AC-7 全達成
- [ ] build / test 全綠
- [ ] commit hash：`______`

### BUG-073 狀態建議
（FIXED → VERIFY 還是 FIXED → CLOSED；建議與 T0335 一致 → VERIFY 等人工 smoke）

### 後續建議
（給塔台派 T0337 時的提示）

---

**狀態流轉**：📋 PENDING → 🔄 IN_PROGRESS → ✅ DONE
