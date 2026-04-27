# T0325 — QA PLAN-031 Offline / 網路 fail / GitHub rate limit e2e + 三平台 install-bundle 自動測試

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0325 |
| 類型 | qa（vitest integration with mocked fetch/fs + playwright spec scaffolding） |
| 所屬 | PLAN-031 — Server Bundle Distribution / Sprint 5 |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-27 10:39 (UTC+8) |
| 派發時間 | 2026-04-27 10:39 (UTC+8) |
| Sizing | M（estimate 45-75 min wall） |
| 依賴 | T0318 ✅（download module）/ T0320 ✅（distributor）/ T0321-T0323 ✅（三平台 install-bundle） |
| 平行 | T0327（docs，後續可派） |
| 後續 | T0324（user dogfood，本工單建立的 mock e2e 不取代 DGX Spark 實機） |
| 互動旗標 | `--mode yolo --no-interactive` |
| Renew 次數 | 0 |
| 工作目錄 | main repo |
| `affects_files` | `electron/remote/__tests__/server-bundle-download.integration.test.ts`（新建） / `electron/remote/__tests__/server-bundle-distributor.integration.test.ts`（新建） / `tests/e2e/server-bundle-distribution.spec.ts`（新建 playwright spec scaffolding，僅 skeleton 不實跑） / 可能擴 `vite.config.ts` test include 範圍 |

## 背景

PLAN-031 Sprint 2-4 已落地全套 distribution stack。各模組純函數測試 ≥168（T0314 ~T0322 累計）。本工單**不取代 T0324 DGX Spark 實機 dogfood**（D097），而是補：

1. **Download module 邊界整合測試**（mock fetch + tmp fs）— offline / rate limit / SHA mismatch / cache hit
2. **Distributor 三層 lookup 整合測試**（mock distributor inputs）— baseline corrupt / cache hit / download fallback
3. **Playwright wizard e2e spec scaffolding**（不實跑，僅建 skeleton + describe/it 結構，T0324 / 真 e2e 由 user / CI 跑）

## 塔台已拍板項

| 編號 | 議題 | 決策 |
|------|------|------|
| D097 | DGX Spark dogfood | user 親自跑（T0324 範疇） |
| spec §3.5 | Local cache by SHA | 本工單測 cache hit / cache stale 兩 path |
| spec §8 | GitHub Rate Limit | 本工單測 403 + X-RateLimit headers |

## 範圍（3 deliverable）

### Deliverable 1：Download module integration tests

`electron/remote/__tests__/server-bundle-download.integration.test.ts`（新建）：

**測試 stack**：vitest + 內建 mock（`vi.spyOn` for global.fetch、`memfs` 或 `os.tmpdir()` 真實 fs）。優先用真 tmp dir + 完整 SHA verify，避免 over-mock。

**最少 case ≥10**：

| group | case |
|-------|------|
| **happy path** | 1. fetch manifest → fetch tarball → SHA verify → cache write |
| **cache hit** | 2. cache file exists with correct SHA → skip download → fromCache:true |
| **cache stale** | 3. cache file exists but SHA mismatch → re-download |
| **SHA mismatch download** | 4. fetched tarball SHA ≠ manifest SHA → 'sha-mismatch' errorCode |
| **manifest fetch failed** | 5. manifest endpoint 500 → retry 3 次 → 'manifest-fetch-failed' |
| **manifest parse failed** | 6. manifest JSON invalid → 'manifest-parse-failed' |
| **arch not in manifest** | 7. manifest 缺 linux-arm64 → 'arch-not-in-manifest' |
| **rate limited** | 8. HTTP 403 + X-RateLimit-Remaining=0 → 'rate-limited' + msg 含 reset time |
| **abort** | 9. AbortSignal triggered mid-download → 'aborted' + tmp file cleaned |
| **GITHUB_TOKEN** | 10. options.githubToken 帶入 → fetch headers 含 Authorization Bearer |

**Mock 策略**：
- `global.fetch` 用 `vi.spyOn(globalThis, 'fetch')` 攔截，回傳合成 Response（含 body stream + headers）
- `cacheDir` 用 `path.join(os.tmpdir(), 'bat-test-cache-${randomUUID}')`，每 test 獨立 + afterEach cleanup
- 待驗證的 manifest / tarball binary 用 vitest fixture 函數產生（小 buffer，計算真實 SHA）

### Deliverable 2：Distributor integration tests

`electron/remote/__tests__/server-bundle-distributor.integration.test.ts`（新建）：

**測試對象**：`distributeServerBundle()` 三層 lookup（cache → baseline → download）。

**最少 case ≥8**：

| group | case |
|-------|------|
| **cache layer** | 1. cache hit → source:'cache' |
| **baseline layer** | 2. cache miss + baseline tarball + manifest SHA match → source:'baseline' + 自動 copy 到 cache |
| **baseline corrupted** | 3. baseline manifest 存在 + tarball SHA mismatch → 'baseline-corrupted'（**不** fallback download） |
| **baseline missing-manifest** | 4. baselineDir 存在 + manifest.json 缺 → 跳到 download |
| **baseline missing-tarball** | 5. baseline manifest 存在但缺對應 arch tarball → 跳到 download |
| **download fallback** | 6. 所有層皆無 → call T0318 → source:'download' |
| **arch detection failed** | 7. profileId 找不到 profile → 'arch-detection-failed' |
| **abort during baseline SHA** | 8. AbortSignal triggered during baseline verify → 'aborted' |

**Mock 策略**：
- 真實 tmp `cacheDir` + `baselineDir`，避免 mock fs
- T0319 `detectRemoteArch` 用 `vi.spyOn` 攔截（避免實打 child_process）
- T0318 `downloadServerBundle` 用 `vi.spyOn` 攔截（避免實打 fetch）

### Deliverable 3：Playwright wizard e2e spec scaffolding

`tests/e2e/server-bundle-distribution.spec.ts`（新建，**不實跑**，僅 skeleton）：

**目的**：建立 e2e 測試結構，T0324 user dogfood 與 future CI 可消費。

**結構**：

```typescript
import { test, expect } from '@playwright/test'

test.describe('PLAN-031 Server Bundle Distribution', () => {
  test.describe('WSL wizard', () => {
    test.skip('should use baseline tarball when offline (linux-x64)', async ({ page }) => {
      // 預期：開 setup wizard → pick distro → systemd check → install-bundle 階段顯示「Using bundled server bundle (offline)」
    })

    test.skip('should download tarball when baseline missing (linux-arm64 cross-arch)', async ({ page }) => {
      // Mac BAT × DGX Spark 場景
    })
  })

  test.describe('SSH wizard', () => {
    test.skip('should detect arch via verify-auth and reuse for distribution', async ({ page }) => {
      // 驗 sshServerArch wire-up T0322
    })

    test.skip('should fail-closed when baseline corrupted', async ({ page }) => {
      // 'baseline-corrupted' errorCode 不 fallback download
    })
  })

  test.describe('Docker wizard', () => {
    test.skip('should use image-baked source (no distributor)', async ({ page }) => {
      // T0323 D096 紀律
    })
  })

  test.describe('Rate limit handling', () => {
    test.skip('should show actionable msg when GitHub rate limited', async ({ page }) => {
      // 顯示 reset time + GITHUB_TOKEN hint
    })
  })
})
```

每 test 用 `test.skip()` 預留（playwright 認識 skip 會在報表標 skipped 但不 fail）。實際實作交給 T0324 / 未來 CI 工單。

### 範圍排除（不在本工單）

- ❌ 不實跑 playwright（worktree 環境 + 無 BAT installer + 無 DGX Spark）
- ❌ 不取代 T0324 DGX Spark dogfood
- ❌ 不改 production code（純測試）
- ❌ 不寫 visual regression（PLAN-030 範疇）
- ❌ 不 mock 整個 electron app（過度工程，integration 用 mock fetch + 真 fs 即可）

## 驗收條件

- AC-1：`server-bundle-download.integration.test.ts` 存在，≥10 cases，全綠
- AC-2：`server-bundle-distributor.integration.test.ts` 存在，≥8 cases，全綠
- AC-3：`tests/e2e/server-bundle-distribution.spec.ts` 存在，含 5 個 describe 區塊 + ≥7 個 `test.skip()` skeleton
- AC-4：`npm run test:unit` 全綠（既有 168 + 新增 ≥18 = 186+）
- AC-5：`npx tsc --noEmit` 對新檔 0 error
- AC-6：tmp dir cleanup（afterEach hook）— 不留 test 垃圾
- AC-7：commit 訊息走 `chore(qa): T0325 - PLAN-031 distribution integration tests + e2e scaffolding`

## Worker 守則

1. **Mock 紀律**：fetch 用 `vi.spyOn(globalThis, 'fetch')`；fs 用真實 tmp dir + cleanup；不要 over-mock
2. **真實 SHA**：fixture buffer 用 `crypto.createHash('sha256').update(buffer).digest('hex')` 算真 SHA，避免 hardcoded 假 hash
3. **vitest test placement**：integration test 路徑 `electron/remote/__tests__/`，與既有 src 模式對齊；如 vitest config 不認此路徑，擴 `vite.config.ts` test include
4. **Abort cleanup**：abort case 必驗 tmp file 已清掉（`fs.access` 預期 ENOENT）
5. **Skip 不 fail**：playwright `test.skip()` 必須讓 spec parse 不報錯（檢查 `npx playwright test --list` 通過）
6. **logger**：用 `./logger`（測試中可 silent 但不 console.log）
7. **child_process 紀律**：本工單無 child_process（T0319 用 mock）；CLAUDE.md 原則仍適用
8. **commit 紀律**：單 commit 即可
9. **規範性 scope expansion**：照既有模式回報區標「out-of-scope but justified」
10. **記憶覆寫**：本工單**沒有** `memory_overrides` 欄位

## Worker 回報區（Worker 填寫）

### 1. download integration tests 摘要

（待填：case 數、mock 策略、SHA fixture 產生方式）

### 2. distributor integration tests 摘要

（待填：case 數、三層 lookup 覆蓋）

### 3. playwright e2e spec scaffolding

（待填：describe/test 數量、skip 是否正常 parse）

### 4. tsc + test 結果

（待填：`npm run test:unit` 總數 / `playwright test --list` 結果 / `tsc --noEmit` 對新檔）

### 5. PARTIAL / 矛盾項（如有）

（待填）

### 6. Out-of-scope but justified（如有）

（待填）

### 完成註記

（待填）
