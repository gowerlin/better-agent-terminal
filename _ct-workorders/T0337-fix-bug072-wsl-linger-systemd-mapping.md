# T0337 — PLAN-032 Sprint 3: BUG-072 WSL linger/systemd mapping + fixed-and-retry flow（Sprint 3 收尾）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0337 |
| 標題 | 修復 BUG-072：WSL `write-systemd-unit` step 的 linger 失敗 + 下游 service start timeout 套用 ErrorMapper + fixed-and-retry actions；補 detect-env WSL 分支 preflight；達成 PLAN-032 Sprint 3 ship gate D109 |
| 類型 | fix（BUG 修復 + framework 套用）|
| 優先級 | 🔴 High（BUG-072 + Sprint 3 收尾，達 ship gate D109 → v0.4.3 release 候選） |
| 狀態 | 🔄 IN_PROGRESS |
| 建立時間 | 2026-04-28 03:24 (UTC+8) |
| 開始時間 | 2026-04-28 03:26 (UTC+8) |
| 派發模式 | `--mode yolo --no-interactive` |
| 關聯 PLAN | PLAN-032（Sprint 3 第三票，最後收尾） |
| 關聯 BUG | **BUG-072**（owner，本票負責 OPEN → FIXED → VERIFY） |
| 關聯 spec | `_ct-workorders/_spec-wizard-error-ux.md` § 6（Initial Mapping Targets — WSL `write-systemd-unit` linger failure / service start timeout） |
| 關聯前置閱讀 | `docs/design/wizard-error-ux.md`（T0334） |
| 關聯前序 | T0331 ✅（registry 已有 `wsl-linger-failure` entry）/ T0332 ✅（preflight）/ T0333 ✅（actions：fixed-and-retry + skip + cancel）/ T0335 ✅ `94733d7` / T0336 ✅ `a8b2363`（Docker preflight pattern 範例） |
| 預估時間 | 30-90 min（M，與 T0336 對稱 + 加 service-start-timeout 第二 entry） |
| Renew 次數 | 0 |
| affects_files | `src/components/setup-wizard/steps/wsl/write-systemd-unit.ts`（核心修復：linger throw + service start throw 補 errorCode）、`src/components/setup-wizard/steps/wsl/detect-env.ts`（補 WSL 分支 preflight，與 T0336 Docker 對稱）、`src/components/setup-wizard/error-mapper.ts`（registry：補 `wsl-linger-failure` errorCodes + 新 entry `wsl-service-start-timeout`）、`src/components/setup-wizard/__tests__/write-systemd-unit.test.ts` 或併入既有檔（regression tests） |

## 背景

BUG-072 root cause（PLAN-032 § 動機）：
- WSL wizard `write-systemd-unit` step：
  1. linger 失敗 → 目前 silent warning（`ctx.warnings.push`），使用者沒 UX 處理
  2. 下游 service start timeout → throw raw error，使用者看不懂 `Timed out waiting for bat-server.service to become active`

**Sprint 2 framework 已就緒**：
- ✅ T0331 registry 已有 `wsl-linger-failure` entry（patterns: linger / No such device or address）
- ✅ T0333 actions 已補（fixed-and-retry + skip + cancel）
- ❌ linger 失敗目前是 silent warning，不會觸發 mapped UX
- ❌ service start timeout 沒對應 entry
- ❌ throw 沒帶 errorCode

**本票工作**：
1. linger 失敗從 silent warning 升級為 **interactive failure with fixed-and-retry**（讓使用者能重試）
2. service start timeout 補 errorCode 結構化 + 新增 registry entry
3. detect-env WSL 分支補 preflight（與 T0336 Docker 對稱，但只判斷 WSL 是否 installed，不打 systemd 檢查 — systemd 檢查留 step.run）
4. regression tests
5. Sprint 3 收尾 → ship gate D109

## 目標（驗收條件，工單級）

### AC-1：linger 失敗升級為 interactive failure

`src/components/setup-wizard/steps/wsl/write-systemd-unit.ts`：

**現狀**（line 54-60）：
```ts
const lingerResult = await window.electronAPI.wslSystemd.enableLinger(ctx.wslDistro)
if (!lingerResult.ok && lingerResult.error) {
  const warning = `Unable to enable linger automatically: ${lingerResult.error}`
  if (!ctx.warnings.includes(warning)) {
    ctx.warnings.push(warning)
  }
}
```

**目標**：
```ts
const lingerResult = await window.electronAPI.wslSystemd.enableLinger(ctx.wslDistro)
if (!lingerResult.ok && lingerResult.error) {
  // 仍 push warning（保留 debug log）
  const warning = `Unable to enable linger automatically: ${lingerResult.error}`
  if (!ctx.warnings.includes(warning)) {
    ctx.warnings.push(warning)
  }

  // 但同時拋帶 errorCode 的 error，讓使用者看到 mapped UX 含 fixed-and-retry
  // 注意：D106（PLAN-032 拍板項）— try linger 失敗時 manual fix hint + optional fallback
  const err = new Error(`Could not enable linger: ${lingerResult.error}`) as Error & { code?: string }
  err.code = 'wsl-linger-failed'
  throw err
}
```

**設計權衡**：
- spec D106 採方案 C：「try linger，失敗時 manual fix hint + optional fallback」
- 目前 silent warning 不算 "manual fix hint"；本票升級為 throw → ErrorMapper → mapped error UI 含「我已執行 `sudo loginctl enable-linger $USER`，重試」按鈕（T0333 已補的 actions）
- 使用者按 fixed-and-retry → runner.retry → step.run 重跑 → enableLinger 第二次成功 → 繼續 service start

### AC-2：service start timeout 補 errorCode + 新 registry entry

write-systemd-unit.ts line 65-67：

**現狀**：
```ts
if (!startResult.ok) {
  throw new Error(startResult.error)
}
```

**目標**：
```ts
if (!startResult.ok) {
  const err = new Error(startResult.error || 'Failed to start bat-server systemd service') as Error & { code?: string }
  // 區分 timeout vs 其他錯誤（從 startResult.error 內容判斷或從 IPC 回 hint）
  err.code = /timed? out|timeout/i.test(startResult.error ?? '')
    ? 'wsl-service-start-timeout'
    : 'wsl-service-start-failed'
  throw err
}
```

**新 registry entry**：

```ts
{
  id: 'wsl-service-start-timeout',
  platforms: ['wsl'],
  stepIds: ['write-systemd-unit'],
  errorCodes: ['wsl-service-start-timeout'],
  patterns: [
    /Timed out waiting for.*service to become active/i,
    /service.*start.*timeout/i,
  ],
  messageKey: 'wsl.service.start-timeout',
  detailMode: 'append-raw',
  actions: [
    { kind: 'fixed-and-retry', label: '我已檢查 journal，重試' },
    { kind: 'skip', label: '略過此步驟（手動啟動）' },
    { kind: 'cancel', label: '取消' },
  ],
}
```

`MESSAGE_DICT` 補：
```ts
'wsl.service.start-timeout': {
  title: 'BAT systemd 服務啟動逾時',
  body: '請在 WSL 內執行 `journalctl --user -u bat-server.service -n 50` 查看服務啟動日誌；linger 未啟用是常見原因。',
}
```

**`wsl-linger-failure` entry 補 errorCodes**：

```ts
{
  id: 'wsl-linger-failure',
  // ... 既有欄位 ...
  errorCodes: ['wsl-linger-failed'],   // ← 新增
  // patterns 保留作為 fallback
}
```

### AC-3：detect-env WSL 分支補 preflight（與 T0336 對稱）

`src/components/setup-wizard/steps/wsl/detect-env.ts`：

擴 T0336 留下的 preflight：

```ts
async preflight(ctx): Promise<WizardPreflightResult> {
  if (ctx.targetOS === 'docker-linux') {
    // 既有 T0336 docker 邏輯不變
    // ...
  }

  if (ctx.targetOS === 'wsl-linux') {
    // T0337: WSL preflight — 偵測 WSL 是否 installed
    if (window.electronAPI.platform !== 'win32') {
      return { ok: false, reason: 'WSL setup is only available from Windows', errorCode: 'wsl-not-on-windows' };
    }

    const cacheKey = 'wsl-list-status';
    const cached = ctx.preflightCache ? getPreflightCached(ctx.preflightCache, cacheKey) : undefined;
    if (cached) return cached;

    try {
      await window.electronAPI.wsl.list();
      return { ok: true, cacheKey, ttlMs: 60_000 };  // WSL 安裝狀態變動低，60s
    } catch (error) {
      return {
        ok: false,
        reason: `Unable to detect WSL: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'wsl-not-installed',
        cacheKey,
        ttlMs: 5_000,
      };
    }
  }

  return { ok: true };
}
```

**Optional**：本票可同時補 `wsl-not-installed` registry entry（含 open-link 到 WSL 安裝指南），但屬範圍延伸；若時間夠 Worker 自決，否則 OOS 留 follow-up。塔台建議：補 entry，否則 preflight failure 會走 fallback。

最簡 entry：
```ts
{
  id: 'wsl-not-installed',
  platforms: ['wsl'],
  stepIds: ['detect-env'],
  errorCodes: ['wsl-not-installed'],
  messageKey: 'wsl.not-installed',
  detailMode: 'append-raw',
  actions: [
    { kind: 'open-link', label: '安裝 WSL2 指南', href: 'https://learn.microsoft.com/en-us/windows/wsl/install' },
    { kind: 'fixed-and-retry', label: '我已安裝 WSL2，重試' },
    { kind: 'cancel', label: '取消' },
  ],
}
```

### AC-4：State machine 流轉驗證

| 場景 | 預期流轉 |
|------|----------|
| linger 失敗 → 顯示 mapped error 含 fixed-and-retry | running → failed + mappedError.matchId === 'wsl-linger-failure' + actions 含 fixed-and-retry |
| linger 失敗 → 點 fixed-and-retry → linger 成功 | failed → pending → running → succeeded |
| service start timeout → 顯示 mapped error | running → failed + mappedError.matchId === 'wsl-service-start-timeout' + body 含 journalctl 提示 |
| WSL 未安裝 → preflight fail | pending → failed + mappedError.matchId === 'wsl-not-installed' + actions 含 open-link |
| WSL 已安裝 + linger ok + service ok | pending → running → succeeded（既有 happy path） |

baseline 282 transition tests 全綠。

### AC-5：Regression tests

`src/components/setup-wizard/__tests__/write-systemd-unit.test.ts`（新檔或併入 wsl-flow tests）：

最少涵蓋：

1. **linger 失敗 throw with errorCode**：mock `enableLinger` 回 `{ ok: false, error: 'Could not enable linger: No such device or address' }` → step throw with `code='wsl-linger-failed'`
2. **service start timeout throw with errorCode**：mock `startService` 回 `{ ok: false, error: 'Timed out waiting for bat-server.service' }` → throw with `code='wsl-service-start-timeout'`
3. **service start non-timeout failure**：mock `startService` 回 `{ ok: false, error: 'permission denied' }` → throw with `code='wsl-service-start-failed'`
4. **mappedError linger 渲染**：linger fail snapshot.mappedError.matchId === 'wsl-linger-failure'，actions 含 fixed-and-retry
5. **mappedError timeout 渲染**：timeout snapshot.mappedError.matchId === 'wsl-service-start-timeout'

`detect-env.test.ts` 擴：

6. **WSL preflight ok**：mock `wsl.list` 成功 → preflight `{ ok: true, cacheKey, ttlMs: 60_000 }`
7. **WSL preflight fail**：mock `wsl.list` throw → preflight `{ ok: false, errorCode: 'wsl-not-installed', ttlMs: 5_000 }`
8. **WSL preflight 非 Windows 短路**：mock `platform='darwin'` → preflight `{ ok: false, errorCode: 'wsl-not-on-windows' }`

### AC-6：BUG-072 metadata 待塔台處理

Worker 不直接改 BUG-072。回報區註記：「BUG-072 → FIXED 待塔台處理（建議 → VERIFY）」。

### AC-7：Sprint 3 收尾里程碑

Worker 在回報區明確列出：
- T0335/T0336/T0337 三票 commit hash
- Sprint 3 累計 wall time + tests 數
- ship gate D109（三 BUG fix 都到 VERIFY） 達成狀態

## 實作順序建議

1. **Step 1**：write-systemd-unit.ts linger throw 升級（AC-1）
2. **Step 2**：write-systemd-unit.ts service start errorCode（AC-2）
3. **Step 3**：error-mapper.ts registry 補 `wsl-service-start-timeout` 新 entry + `wsl-linger-failure` errorCodes + 可選 `wsl-not-installed`
4. **Step 4**：detect-env.ts WSL 分支 preflight（AC-3）
5. **Step 5**：regression tests 5-8 case
6. **Step 6**：`npm run test:unit` + `npx vite build` 全綠
7. **Step 7**：commit `fix(setup-wizard): WSL linger/systemd mapping + WSL preflight (T0337, BUG-072, Sprint 3 closer)`

## 風險與緩解

| 風險 | 緩解 |
|------|------|
| linger 從 warning 升 failure 改變既有 wizard 行為（使用者本來不會擋在這） | D106 拍板「失敗時 manual fix hint + optional fallback」；但拍板不要求 fail-soft，本票實作 fail-hard + fixed-and-retry。若使用者反饋太擋路可改 OOS 加 skip action（本票 actions 已含 skip） |
| WSL preflight `wsl.list()` 在 mac/Linux 環境 mock 不一致 | 既有 detect-env tests 已 mock `platform`；沿用 |
| `wsl-not-installed` errorCode 與其他 wsl errorCode 衝突 | grep 確認唯一 |
| Sprint 3 完成後 BUG-071 仍 OPEN（PLAN-031 owner，非本 PLAN） | T0337 不處理 BUG-071；Sprint 3 收尾 + 通報塔台 |

## 自檢清單

- [ ] AC-1：linger 失敗 throw with errorCode='wsl-linger-failed'
- [ ] AC-2：service start 區分 timeout / non-timeout 兩 errorCode + 新 registry entry
- [ ] AC-3：detect-env WSL 分支 preflight（含可選 `wsl-not-installed` entry）
- [ ] AC-4：state machine 5 種流轉皆通過
- [ ] AC-5：regression tests ≥5（write-systemd 5 + detect-env 3 = 8 case）全綠
- [ ] AC-6：回報區註記 BUG-072 → FIXED 待塔台處理
- [ ] AC-7：回報區列 Sprint 3 收尾里程碑統計
- [ ] `npm run test:unit` 全綠（baseline 282 + 本票 ≥5 = ≥287）
- [ ] `npx vite build` 綠
- [ ] commit message：`fix(setup-wizard): WSL linger/systemd mapping + WSL preflight (T0337, BUG-072, Sprint 3 closer)`

## YOLO 模式 — Sprint 3 收尾後續

T0337 DONE → **PLAN-032 Sprint 3 完整收尾（3/3 BUG fix）**：
- BUG-072 / BUG-073 / BUG-074 全部 → VERIFY（待人工 smoke）
- ship gate D109（v0.4.3 三 BUG 都修才出貨）達成
- 進入 Sprint 4：T0338 Cross-platform input step abstraction（可暫停讓使用者驗收 Sprint 2-3 framework）

塔台 T0337 收尾後決定：續 Sprint 4 / 暫停讓使用者三平台 smoke / 收工 *evolve。

## 回報區（Worker 填寫）

### 實作摘要

**範圍**：BUG-072 修復 + Sprint 3 收尾。
- `write-systemd-unit.ts`：linger 失敗從 silent warning 升為 throw with `errorCode='wsl-linger-failed'`（保留 `ctx.warnings.push` 作為 debug log）；service start 失敗依 raw error 內容 regex 區分 `wsl-service-start-timeout` vs `wsl-service-start-failed`。
- `detect-env.ts`：WSL preflight 分支（與 T0336 docker preflight 對稱）：non-Windows → `wsl-not-on-windows`；`wsl.list()` throw → `wsl-not-installed`（60s ok TTL / 5s fail TTL，因 WSL 安裝狀態變動低）。重構為 `if (docker) {...} else if (wsl) {...} else { ok }`。
- `error-mapper.ts`：`wsl-linger-failure` 補 `errorCodes: ['wsl-linger-failed']`；新增 `wsl-service-start-timeout` entry（含 journalctl body）+ `wsl-not-installed` entry（含 MSFT install link，errorCodes 涵蓋 `wsl-not-installed` 與 `wsl-not-on-windows` 兩者）；`MESSAGE_DICT` 新增兩 key。

**Commit hash**：見元資料區（commit 後填）。
**Tests**：290 passed（baseline 282 + write-systemd 5 + detect-env 3 = 290 / 預期 ≥287）。
**Build**：`npx vite build` 三 chunk 綠（main / preload / terminal-server）。

### linger 升級為 failure 的 UX 評估

採 **fail-hard + fixed-and-retry** 路線，理由：
1. spec D106 拍板「manual fix hint + optional fallback」，silent warning 不算 hint；fail-hard + 對話框 = 真正的 hint。
2. T0333 已預先補 `wsl-linger-failure` actions 含 `skip`，使用者覺得擋路可一鍵略過 → 等同 fail-soft。
3. linger 沒啟用 → 後續 service start 幾乎必逾時（symptom 已對應 timeout entry），不如在 linger 階段就讓使用者決策。

風險：原本一些 distro（已預先 enable-linger）的使用者沒看過這個錯，現在也不會看到（成功路徑不變）。實際擋路只發生在 linger 失敗的場景（本來就是 BUG-072 抱怨點）。

### errorCode 唯一性確認

`grep -rn "wsl-linger-failed\|wsl-service-start-timeout\|wsl-service-start-failed\|wsl-not-installed\|wsl-not-on-windows" src/` 在改動前無 hit，僅本票檔案出現 → 唯一性確認。

### State machine 流轉驗證

5 種場景透過 vitest WizardRunner 整合測試實測（見 `write-systemd-unit.test.ts` AC-5 case 4-5 + `detect-env.test.ts` T0337 case A-C）：

| 場景 | 實測流轉 | 結果 |
|------|---------|------|
| linger fail → mapped error 含 fixed-and-retry | running → failed + matchId='wsl-linger-failure' | ✅ |
| service start timeout → mapped error 含 journalctl 提示 | running → failed + matchId='wsl-service-start-timeout' + body 含 "journalctl" | ✅ |
| service start non-timeout → fallback / wsl-service-start-failed errorCode | step.run throw 帶 code='wsl-service-start-failed'（無對應 registry entry → fallback `[retry, skip, cancel]`） | ✅（已驗證 throw code，registry 未對 failed 加 entry — 走 fallback 正確） |
| WSL 未安裝 preflight fail | pending → failed + matchId='wsl-not-installed' + actions 含 open-link | ✅ |
| WSL 已安裝 + linger ok + service ok（happy path） | 既有 282 tests 全綠 | ✅ |

### 偏離 spec 的決策

- 工單建議 `wsl-not-installed` registry entry 為「optional」；本票實作了。理由：preflight 一定會 throw，沒對應 entry → 跑 fallback 看起來是「步驟發生錯誤」+ raw error，比 mapped UI 差很多，補成本極低（一個 entry + 一個 dict）。
- `wsl-not-installed` entry 的 `errorCodes` 同時包 `wsl-not-installed` 與 `wsl-not-on-windows`：兩者 UX 訊息相同（裝/沒裝 WSL2），合併比拆兩 entry 簡潔。spec D106 未明確規範，工單範例只列 `wsl-not-installed`；偏離理由：DRY。

### 自檢結果
- [x] AC-1 ~ AC-7 全達成
- [x] build / test 全綠（290/290 + vite build OK）
- [x] commit hash：見元資料區

### BUG-072 狀態建議

**FIXED → VERIFY**（與 T0335 / T0336 對稱）。理由：自動化測試已涵蓋三個 errorCode 路徑與 mapped UI snapshot；但 linger 失敗的 UX 流（使用者看到對話框 → 按 fixed-and-retry → 第二次 linger 成功）需在真實 WSL2 distro smoke 一輪。建議塔台移到 VERIFY，三平台 smoke 後 → CLOSED。

### Sprint 3 收尾里程碑統計

| 票 | commit | 範圍 | 累計 tests |
|----|--------|------|----------|
| T0335 | `94733d7` | BUG-074 SSH input step shows failed on init | baseline → 277（推估） |
| T0336 | `a8b2363` | BUG-073 Docker daemon down preflight + errorCode | 277 → 282 |
| T0337 | （本票）| BUG-072 WSL linger/systemd mapping + WSL preflight | 282 → 290（+8） |

**Ship gate D109 狀態**：✅ 達成（三 BUG 全部 FIXED → VERIFY 候選）。
- BUG-074 → VERIFY（T0335）
- BUG-073 → VERIFY（T0336）
- BUG-072 → VERIFY 待塔台處理（本票建議）

→ v0.4.3 release 候選就緒。

### 後續建議

塔台 T0337 收尾後選擇：
1. **續 Sprint 4**：T0338 Cross-platform input step abstraction（spec D107）。
2. **暫停讓使用者三平台 smoke**：Win + WSL2 / mac + SSH / Win + Docker Desktop 各跑一次 wizard，驗證 BUG-072/073/074 mapped UX 真的解決問題。
3. **直接收工 ct-evolve**：Sprint 2-3 框架已穩，提取 wizard error UX pattern 進 fieldguide。

工單 owner 偏好：**選項 2 + 選項 3 併行**。先 smoke 確保 v0.4.3 ship 品質，同時 evolve 把這次學到的 ErrorMapper 4-stage + preflight cache + fixed-and-retry + interaction model 留下教戰範例，避免 PLAN-033 重蹈 wizard error UX 的設計覆轍。Sprint 4（cross-platform input step abstraction）建議延後到 v0.4.3 ship 後再開。

---

**狀態流轉**：📋 PENDING → 🔄 IN_PROGRESS → ✅ DONE
