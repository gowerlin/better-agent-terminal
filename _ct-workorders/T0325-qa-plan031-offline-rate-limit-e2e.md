# T0325 — QA PLAN-031 Offline / 網路 fail / GitHub rate limit e2e + 三平台 install-bundle 自動測試

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0325 |
| 類型 | qa（vitest integration with mocked fetch/fs + playwright spec scaffolding） |
| 所屬 | PLAN-031 — Server Bundle Distribution / Sprint 5 |
| 狀態 | 🔧 IN_PROGRESS |
| 開始時間 | 2026-04-27 10:49 (UTC+8) |
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

新建 `electron/remote/__tests__/server-bundle-download.integration.test.ts`，**11 cases** 全綠：

| # | case | errorCode |
|---|------|-----------|
| 1 | happy path（fetch manifest → tarball → SHA verify → cache write） | — |
| 2 | cache hit（pre-populated valid cache → fromCache:true，僅 1 fetch） | — |
| 3 | cache stale（同 size 但 SHA 不符 → 自動清掉重抓） | — |
| 4 | SHA mismatch on download（serve 錯誤 buffer → tmp 清掉） | sha-mismatch |
| 5 | manifest fetch failed（500 → retry 3 次 = 4 attempts） | manifest-fetch-failed |
| 6 | manifest parse failed（壞 JSON） | manifest-parse-failed |
| 7 | partial archs in manifest（請求 linux-arm64 從只有 x64+darwin 的 manifest） | manifest-parse-failed（見備註） |
| 8 | rate limited（HTTP 403 + X-RateLimit-Remaining=0，含 reset hint + GITHUB_TOKEN 提示） | rate-limited |
| 9 | abort（pre-aborted signal → 不留 tmp） | aborted |
| 10 | options.githubToken → Authorization: Bearer header（manifest + tarball 都帶） | — |
| 11 | process.env.GITHUB_TOKEN fallback | — |

**Mock 策略**：
- `vi.spyOn(globalThis, 'fetch')` 攔截 + 合成 `Response` (body / headers / status)
- 真實 tmp dir：`os.tmpdir() + bat-test-cache-${randomUUID()}`，每 test 獨立 + afterEach `fs.rm`
- SHA fixture：`createHash('sha256').update(buf).digest('hex')` 算真值，避免 hardcoded
- Tarball buffer 用 `Buffer.from('fake-tarball::...::pad::xxx...')` 約 2KB，能跑 ReadableStream pipeline + sha 驗證

**備註（case 7）**：原 spec 期望 `arch-not-in-manifest` errorCode，但 `parseManifest` 驗證器強制要求 schema v1 的 manifest 必須含全 3 arch（linux-x64 / linux-arm64 / darwin-arm64），缺任一即 parse-failed。所以「partial manifest + 請求缺失 arch」實際在 parser 層即被擋下，回到 `manifest-parse-failed`。runtime 的 arch-not-in-manifest 分支（`server-bundle-download.ts:366`）仍存在作為防禦，但僅在未來 schema 放寬後才會觸發。Test 註解已說明此設計。

### 2. distributor integration tests 摘要

新建 `electron/remote/__tests__/server-bundle-distributor.integration.test.ts`，**8 cases** 全綠：

| # | case | source / errorCode |
|---|------|-------------------|
| 1 | cache hit（cache 既有合法 tarball + baseline 提供 SHA truth） | source:cache，無 download call |
| 2 | baseline hit（cache miss + valid baseline → 自動 copy 到 cache） | source:baseline，cache 檔已寫入 |
| 3 | baseline corrupted（同 size 但 SHA 不符 → fail-closed，**不** fallback download） | baseline-corrupted |
| 4 | baseline missing-manifest（baselineDir 空） | source:download |
| 5 | baseline missing-tarball（manifest 在但缺 linux-x64 檔案） | source:download |
| 6 | full download fallback（cache + baseline 皆空），驗 download 拿到正確 arch/version/cacheDir args | source:download |
| 7 | arch detection failed（profile 缺 sshServerArch → 'no-state' → 映射成 arch-detection-failed） | arch-detection-failed |
| 8 | abort（pre-aborted signal → 在 baseline check 階段就退出） | aborted |

**Mock 策略**：
- `vi.mock('electron')`：stub `app.getVersion / getPath`（test 全部覆寫 cacheDir/baselineDir/version，但 import 仍需解析）
- `vi.mock('../arch-detect')`：stub `detectRemoteArch`，預設回 `{ ok: true, arch: 'linux-x64' }`
- `vi.mock('../server-bundle-download')`：stub `downloadServerBundle`，預設回成功（per test 覆寫）
- `process.resourcesPath = os.tmpdir()`（distributor 即使覆寫 cacheDir/baselineDir，仍 unconditionally call `resolveDefaultPaths(process.resourcesPath)`，beforeEach 設定 + afterEach 還原）
- 真實 tmp `cacheDir` + `baselineDir`，避免 mock fs

### 3. playwright e2e spec scaffolding

新建 **`e2e/server-bundle-distribution.spec.ts`**（注意路徑：原 spec 寫 `tests/e2e/...`，但本專案 playwright `testDir = 'e2e'`，見 `playwright.config.ts`，故置於 `e2e/`，已在檔頭 comment 註明）。

結構：**5 + 1 = 6 個 describe blocks**（原 spec 要求 5；多加一個 Abort & cancel 涵蓋 cleanup 路徑），**8 個 `test.skip()` 佔位**（原 spec 要求 ≥7）：

| describe | test.skip count | 涵蓋 |
|----------|-----------------|------|
| WSL wizard | 2 | offline baseline (linux-x64) / cross-arch download (linux-arm64) |
| SSH wizard | 2 | sshServerArch wire-up (T0322) / baseline-corrupted fail-closed |
| Docker wizard | 1 | image-baked source（T0323 D096） |
| Rate limit handling | 1 | GitHub 403 actionable msg + GITHUB_TOKEN hint |
| Abort & cancel | 2 | tmp cleanup / cache hit on retry |

`npx playwright test --list` 通過：parse 0 error，回報 8 tests skipped。實作交給 T0324 dogfood / 未來 CI 工單。

### 4. tsc + test 結果

| 檢查 | 結果 |
|------|------|
| `npm run test:unit` | **187 passed (10 files)** — 168 baseline + 11 download + 8 distributor |
| `npx playwright test --list e2e/server-bundle-distribution.spec.ts` | 8 tests parsed clean |
| `npx tsc --noEmit` 對新檔 | **0 error**（grep 確認 `electron/remote/__tests__/` 與 `e2e/server-bundle-distribution.spec.ts` 0 行 hit；surfaced 的 errors 全部位於 `src/components/CodexAgentPanel.tsx` 與 `src/types/agent-profiles.ts`，屬 baseline pre-existing） |
| Tmp dir cleanup | afterEach `fs.rm({ recursive, force })` 保證；afterAll 也可選 |

### 5. PARTIAL / 矛盾項（如有）

無 PARTIAL。一個 case 設計矛盾已在 §1 case 7 備註：原 spec 預期 `arch-not-in-manifest` 但 manifest validator 嚴格要求 3 arch full set，partial manifest 在 parse 階段即被擋。Test 改測 `manifest-parse-failed`，並註解保留 runtime 防禦分支（schema 未來放寬時才能觸發）。

### 6. Out-of-scope but justified（如有）

1. **Playwright spec 路徑偏移**：原 spec 要求 `tests/e2e/server-bundle-distribution.spec.ts`，實際置於 `e2e/server-bundle-distribution.spec.ts`。理由：本專案 `playwright.config.ts` 的 `testDir` 是 `e2e/`，`tests/` 目錄不存在；若放 `tests/` playwright 不會發現該檔。已在檔頭 comment 註明。
2. **新增第 6 個 describe（Abort & cancel）**：原 spec 列 5 個，多加一個涵蓋 abort/cancel UX。仍滿足 AC-3「≥7 test.skip + 5 describe」（實際 8 / 6）。
3. **Vite config 擴 test include**：原 spec 預設 `electron/remote/__tests__/` 已在 vitest 範圍內，實則需擴 `vite.config.ts` `test.include` 才能掃到。已加入 `'electron/remote/__tests__/**/*.test.ts'`，註解 T0325。

### 完成註記

PLAN-031 Sprint 5 整合測試 + e2e 骨架完成。168 → 187 tests，三平台 install-bundle 行為（cache / baseline / download / fail-closed / rate-limit / abort）全在純函數層 + 單元層 + 整合層覆蓋。實機 dogfood（T0324）與 visual e2e（T0324 / 未來 CI）由現成的 8 個 `test.skip()` 骨架延伸即可。
