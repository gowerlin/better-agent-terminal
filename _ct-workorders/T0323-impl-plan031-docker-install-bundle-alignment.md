# T0323 — Impl PLAN-031 Docker install-server-bundle 一致性對齊（image-baked source 標記）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0323 |
| 類型 | impl（極小修改：source 標記 + 註解，無 distributor 整合） |
| 所屬 | PLAN-031 — Server Bundle Distribution / Sprint 4 收尾 |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 10:30 (UTC+8) |
| 派發時間 | 2026-04-27 10:30 (UTC+8) |
| 開始時間 | 2026-04-27 10:33 (UTC+8) |
| 完成時間 | 2026-04-27 10:37 (UTC+8) |
| commit | fe6a4ff |
| Sizing | **XS**（estimate 5-15 min wall；下調自原 M 估算，理由：D096 已決定 v1 不做 distributor fallback，且現況已 spec-compliant） |
| 依賴 | T0321 ✅（建立 bundleSource 慣例） / T0322 ✅（建立 SSH parallel pattern） |
| 平行 | 無（Sprint 4 收尾） |
| 後續 | Sprint 5（T0324 dogfood / T0325 offline e2e / T0326 升級 UI / T0327 docs） |
| 互動旗標 | `--mode yolo --no-interactive` |
| Renew 次數 | 0 |
| 工作目錄 | main repo |
| `affects_files` | `src/components/setup-wizard/steps/docker/install-server-bundle.ts`（小修改） |

## 背景

T0313 Phase A.3 盤點顯示 Docker `install-server-bundle.ts` **無** BUG-071 placeholder throw — Docker 走 image-based distribution（image build 時 baked-in `/opt/bat-server`），與 WSL/SSH 的 tarball + upload 模型完全不同。

D096 拍板：**v1 不做 Docker distributor fallback**（保留 image-based 模式單純，避免複雜化）。

本工單**只做最小一致性對齊**：讓 Docker step 也標 `ctx.state.bundleSource`，方便後續診斷與 logging 統一。

## 塔台已拍板項

| 編號 | 議題 | 決策 |
|------|------|------|
| D096 | Docker distributor fallback | **v1 不做**（本工單不違反） |
| spec §5 | Docker image-based distribution | 保留現況，由 image build pipeline 負責（T0278 範疇，外部於本 PLAN） |

## 範圍（2 deliverable，極小）

### Deliverable 1：`docker/install-server-bundle.ts` 標記 bundleSource

**修改點**：`mode === 'new'` 與 `mode === 'existing'` 兩個分支結尾，新增一行：

```typescript
ctx.state.bundleSource = 'image-baked'
```

**新 source 值**：`'image-baked'`（與 T0321/T0322 的 `'cache' | 'baseline' | 'download'` 並列第四種）。

如 type 定義在 ctx state 上有 union 限制（如 `bundleSource?: 'cache' | 'baseline' | 'download'`），worker 擴 union 加 `'image-baked'`。

### Deliverable 2：加註解引用 PLAN-031 D096

在 `installDockerServerBundleStep.run` 上方加一段 JSDoc 或 inline comment：

```typescript
/**
 * Docker install-bundle step：image-based distribution（PLAN-031 D096）
 *
 * Docker server bundle 由 image build pipeline 內建（image 路徑 `/opt/bat-server`），
 * 不走 PLAN-031 distributor（cache → baseline → download）。
 *
 * v1 不做 distributor fallback；image build 時若失敗即 image 不可用，
 * 使用者透過 docker pull / docker build 重新取得。
 *
 * 對齊 WSL/SSH source 標記：本 step 標 `ctx.state.bundleSource = 'image-baked'`
 * 方便後續 e2e 與診斷一致。
 */
```

## 範圍排除（不在本工單）

- ❌ 不整合 distributor（D096 v1 不做）
- ❌ 不改 IPC（distributor 不涉及）
- ❌ 不改 image build pipeline（T0278 範疇）
- ❌ 不寫測試（純註解 + 一行賦值）
- ❌ 不擴 i18n（無新文案）

## 驗收條件

- AC-1：兩個分支（mode='new' / mode='existing'）皆設 `ctx.state.bundleSource = 'image-baked'`
- AC-2：bundleSource type union 含 `'image-baked'`（如有 type 定義在 wizard state）
- AC-3：JSDoc / inline comment 引用 PLAN-031 D096，說明 image-based 不走 distributor 的決策
- AC-4：`npm run test:unit` 全綠（既有 168 tests 不破）
- AC-5：`npx tsc --noEmit` 對改動檔 0 error
- AC-6：commit 訊息走 `chore(wizard): T0323 - Docker install-bundle 一致性對齊（PLAN-031 收尾）`

## Worker 守則

1. **極小修改**：只動兩個分支末尾加賦值 + JSDoc，不重構任何邏輯
2. **不要過度工程**：不加 distributor / 不加 IPC / 不加 i18n / 不加測試
3. **child_process 紀律**：renderer-side，無 child_process
4. **vitest 紀律**：`npm run test:unit` 全綠
5. **TypeScript 紀律**：`npx tsc --noEmit` 對改動檔 0 error；如 bundleSource union 缺 `'image-baked'`，worker 擴 union 但僅限該 type 的最小修改
6. **commit 紀律**：單 commit
7. **規範性 scope expansion**：照既有模式回報區標「out-of-scope but justified」（本工單預期無）
8. **記憶覆寫**：本工單**沒有** `memory_overrides` 欄位

## Worker 回報區（Worker 填寫）

### 1. install-server-bundle.ts 修改摘要

- 新增 JSDoc 區塊（11 行）放在 `installDockerServerBundleStep` export 上方，引用 PLAN-031 D096，說明 Docker 走 image-based distribution、v1 不做 distributor fallback、對齊 WSL/SSH 的 source 標記慣例
- `mode === 'new'` 分支末尾（return 前）加 `ctx.state.bundleSource = 'image-baked'`
- `mode === 'existing'` 分支末尾（warning push 之後）加 `ctx.state.bundleSource = 'image-baked'`
- **Union 未擴**：本檔案無 local `InstallDockerBundleState` interface（不像 ssh/wsl），且 `ctx.state` 在 `wizard-runner.ts` 中為 `Record<string, unknown>`，直接賦字串 literal 即合法。AC-2 對 Docker 而言屬「N/A — 無 type union 需擴」
- 行數變化：+14（11 行 JSDoc + 2 行 bundleSource 賦值 + 1 行空白）

### 2. tsc + test 結果

- `npx tsc --noEmit`：**改動檔 0 error**（`docker/install-server-bundle.ts` 不在錯誤清單）。其他檔案（`CodexAgentPanel.tsx` 等）有既有 pre-existing errors，與本工單無關 → AC-5 ✅
- `npm run test:unit`：8 files / **168 tests passed**（與工單預期 168 tests 完全相符，無破壞）→ AC-4 ✅

### 3. PARTIAL / 矛盾項（如有）

無。

### 4. Out-of-scope but justified（如有）

無。AC-1 / AC-3 / AC-4 / AC-5 / AC-6 全部達成；AC-2 因 Docker 檔無 local state union 而 N/A（已於 §1 註明）。

### 完成註記

- commit：`fe6a4ff`（main branch）
- bundleSource 慣例擴充為四種：`'cache' | 'baseline' | 'download' | 'image-baked'`（後三者為各 platform install-bundle step 各自宣告，無 central type 收斂；目前無 cross-platform 消費者，YAGNI）
- Sprint 4 收尾完成（T0321 / T0322 / T0323 三張同 wave，皆為 install-bundle step 對齊）；後續 Sprint 5（T0324-T0327）為 dogfood / e2e / UI / docs
