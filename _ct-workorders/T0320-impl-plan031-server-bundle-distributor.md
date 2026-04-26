# T0320 — Impl PLAN-031 server-bundle-distributor 共用模組（baseline + cache + download 三路徑整合）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0320 |
| 類型 | impl（main process 模組整合 + IPC + 純函數 helpers） |
| 所屬 | PLAN-031 — Server Bundle Distribution / Sprint 3 收尾（序列瓶頸） |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-27 02:46 (UTC+8) |
| 派發時間 | 2026-04-27 02:46 (UTC+8) |
| Sizing | L（estimate 60-90 min wall） |
| 依賴 | T0316 ✅（baseline tarball installer 整合） / T0317 ✅（manifest validator + SHA stream） / T0318 ✅（download module） / T0319 ✅（arch detection IPC） |
| 平行 | 無（序列瓶頸） |
| 後續 | Sprint 4 三平台 install-bundle steps（T0321/T0322/T0323 全平行） |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget；YOLO 鏈式派發中） |
| Renew 次數 | 0 |
| 工作目錄 | main repo |
| `affects_files` | `electron/remote/server-bundle-distributor.ts`（新建，主整合模組） / `src/lib/server-bundle-distributor-helpers.ts`（新建，純函數 helpers，沿 T0319/T0318 拆分慣例） / `electron/main.ts`（IPC handler 註冊） / `electron/preload.ts`（API 擴張） / `src/types/electron.d.ts`（type augmentation） / `src/lib/__tests__/server-bundle-distributor.test.ts`（純函數測試） |

## 背景

PLAN-031 Sprint 2-3 已落地 4 個獨立元件：
- T0316：installer 內建 baseline tarball（路徑：`process.resourcesPath/bat-server-baseline/`）
- T0317：manifest schema + SHA stream + timing-safe compare
- T0318：runtime download module（GitHub Release fallback）
- T0319：arch detection IPC（WSL/Docker/SSH 統一接口）

本工單把 4 個元件整合成**單一 distributor API**，供 Sprint 4 三平台 install-bundle steps 消費。

**核心抽象**：caller 只需提供 `(profileId, version)` → distributor 自動 detect arch → 依「cache → baseline → download」三層 lookup → 回傳 verified tarball path。

## 塔台已拍板項（不要再問）

| 編號 | 議題 | 決策 |
|------|------|------|
| D092 | C-narrow + Mac 雙 tarball | baseline lookup 走 `process.resourcesPath` |
| D093 | 雙 Release tag namespace | distributor 不關心 tag，只用 manifest.json 比對 SHA |
| D095 | Fallback URL env | 由 T0318 download module 處理，distributor 透傳 `baseURL` |
| D096 | Docker distributor fallback | v1 不做（distributor 目前只服務 WSL/SSH） |
| spec §3 | Distribution 三層 lookup 順序 | cache → baseline → download |

## 範圍（5 deliverable）

### Deliverable 1：`electron/remote/server-bundle-distributor.ts`（新建）

**Public API**：

```typescript
import type { ServerBundleArch } from '../../src/lib/arch-normalize'

export interface DistributeOptions {
  /** Profile ID for arch detection (passed to T0319 detectRemoteArch) */
  profileId: string
  /** BAT version (default: app.getVersion()) */
  version?: string
  /** Cache dir override (default: app.getPath('userData') + '/bat-server-bundles') */
  cacheDir?: string
  /** Baseline dir override (default: process.resourcesPath + '/bat-server-baseline') */
  baselineDir?: string
  /** Download fallback base URL override (passed to T0318) */
  baseURL?: string
  /** Progress callback (forwards T0318 ProgressEvent during download phase) */
  onProgress?: (event: ProgressEvent) => void
  /** AbortSignal for user cancel (only effective during download) */
  signal?: AbortSignal
  /** Optional GITHUB_TOKEN (passed to T0318) */
  githubToken?: string
}

export type DistributeSource = 'cache' | 'baseline' | 'download'

export type DistributeResult =
  | { ok: true, tarballPath: string, sha256: string, sizeBytes: number, source: DistributeSource, arch: ServerBundleArch }
  | { ok: false, error: string, errorCode: DistributeErrorCode }

export type DistributeErrorCode =
  /** Forwarded from T0319 detectRemoteArch */
  | 'arch-detection-failed'
  /** Local cache dir + baseline dir + manifest 都不可用 */
  | 'no-source-available'
  /** Forwarded from T0318 download module */
  | 'download-failed'
  /** SHA mismatch (baseline 內檔案損毀) */
  | 'baseline-corrupted'
  /** AbortSignal triggered */
  | 'aborted'

/**
 * Distribute server bundle tarball: detect remote arch, then resolve via
 * cache → baseline → download (in priority order). Returns verified tarball path.
 *
 * Resolution order:
 *   1. cacheDir/${expectedFilename} (SHA verify against baseline manifest if available)
 *   2. baselineDir/${expectedFilename} (verify against baselineDir/manifest.json)
 *   3. Download via T0318 (verify against fetched manifest)
 *
 * @example
 *   const result = await distributeServerBundle({
 *     profileId: 'wsl-ubuntu-default',
 *     onProgress: (e) => log.info(`download ${e.percent}%`),
 *   })
 *   if (result.ok && result.source === 'baseline') {
 *     log.info(`using installer baseline (no network)`)
 *   }
 */
export async function distributeServerBundle(options: DistributeOptions): Promise<DistributeResult>
```

**實作邏輯**：

1. **Resolve defaults**：
   - `version ??= app.getVersion()`
   - `cacheDir ??= path.join(app.getPath('userData'), 'bat-server-bundles')`
   - `baselineDir ??= path.join(process.resourcesPath, 'bat-server-baseline')`
   - 確保 `cacheDir` 存在（`mkdir -p`）
2. **Arch detection**：呼叫 T0319 `detectRemoteArch(profile)`（內部 lookup profile from profileId via profileManager）→ 失敗即 `arch-detection-failed` + msg
3. **Compute expected filename**：`bat-server-${arch}-v${version}.tar.gz`
4. **Layer 1: Cache check**（spec §3.5）：
   - 路徑：`${cacheDir}/${expectedFilename}`
   - 若 file 存在 → 讀 `${cacheDir}/manifest.json` 取得 expected SHA（若 manifest 不在 → 跳到 baseline 層）
   - 用 T0317 `createSha256Stream` 算 SHA → `compareSha256` → 通過 → return `source: 'cache'`
5. **Layer 2: Baseline check**：
   - 路徑：`${baselineDir}/${expectedFilename}`
   - 讀 `${baselineDir}/manifest.json`（T0316 安裝時 unpack 進 baseline dir）→ T0317 `parseManifest`
   - manifest 缺/錯 → 跳到 download
   - tarball 不存在於 baselineDir → 跳到 download（C-narrow 矩陣下 cross-arch 場景：Mac BAT × linux-arm64 server，baseline 沒此 arch tarball）
   - tarball 存在 → SHA verify
     - 通過 → 寫一份到 cache（`fs.copyFile` baseline → cache，next time hit cache）→ return `source: 'baseline'`
     - 失敗 → `baseline-corrupted` errorCode + msg「Baseline tarball corrupted, run installer again」**不 fallback download**（baseline 損毀代表 installer 異常，需使用者介入）
6. **Layer 3: Download fallback**：
   - 呼叫 T0318 `downloadServerBundle({ arch, version, cacheDir, baseURL, onProgress, signal, githubToken })`
   - T0318 結果直接 forward（cache 寫入由 T0318 自動處理）
   - errorCode prefix 改為 `'download-failed'`，含 T0318 inner errorCode 在 msg
7. **AbortSignal**：每層 SHA 計算讀檔時都要檢查 `signal.aborted`；download 層由 T0318 自己處理
8. **No-source-available 場景**：理論上不會走到（download 必試），但若 baseline-corrupted 且使用者選擇 fail-closed → 此 errorCode 預留給 T0326 升級 UI 用

**錯誤訊息原則**：actionable + 含 source layer（如「baseline corrupted at /path/to/file, expected SHA abc... actual def...」）

### Deliverable 2：純函數 helpers（`src/lib/server-bundle-distributor-helpers.ts`）

**理由**：對齊 T0319 / T0318 既建立的 pattern——純函數抽到 `src/lib/` 避免 composite tsconfig 衝突 + 易於 vitest。

**抽出函數**：

```typescript
export function expectedTarballFilename(arch: ServerBundleArch, version: string): string
// 範例：('linux-arm64', '0.5.0') → 'bat-server-linux-arm64-v0.5.0.tar.gz'

export function resolveDefaultPaths(opts: { userDataDir: string, resourcesPath: string }): { cacheDir: string, baselineDir: string }
// 純函數版本，接受 caller-provided dirs（避免依賴 electron app）

export function classifyDistributeError(layer: 'cache' | 'baseline' | 'download', innerError: string): { errorCode: DistributeErrorCode, error: string }
// 將底層錯誤轉換為 distributor errorCode

export function shouldFallbackToDownload(baselineState: 'missing-manifest' | 'missing-tarball' | 'corrupted'): boolean
// missing-manifest / missing-tarball → true（下載）
// corrupted → false（fail-closed，需使用者介入）
```

### Deliverable 3：IPC handler 整合

`electron/main.ts`，照 T0319/T0318 模式：

```typescript
ipcMain.handle('server-bundle:distribute', async (evt, opts: { profileId, version?, baseURL?, githubToken? }) => {
  // validate opts
  if (typeof opts?.profileId !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(opts.profileId)) {
    return { ok: false, error: 'Invalid profileId', errorCode: 'arch-detection-failed' }
  }

  const onProgress = (event) => {
    if (!evt.sender.isDestroyed()) {
      evt.sender.send('server-bundle:distribute-progress', event)
    }
  }

  return distributeServerBundle({ ...opts, onProgress })
})
```

**Channel 命名**：`server-bundle:distribute` 與 T0318 `server-bundle:download` 並列；progress event 統一用 `server-bundle:distribute-progress`（與 download 區分，因為 distributor 可能 cache hit 不打網路無 progress）。

### Deliverable 4：preload + type augmentation

```typescript
// preload.ts，擴張既有 remote.serverBundle
contextBridge.exposeInMainWorld('electronAPI', {
  ...
  remote: {
    ...existing,
    serverBundle: {
      ...existing,  // download / onDownloadProgress (T0318)
      distribute: (opts) => ipcRenderer.invoke('server-bundle:distribute', opts),
      onDistributeProgress: (callback) => {
        const handler = (_evt, event) => callback(event)
        ipcRenderer.on('server-bundle:distribute-progress', handler)
        return () => ipcRenderer.removeListener('server-bundle:distribute-progress', handler)
      },
    },
  },
})
```

Type augmentation 加在 `src/types/electron.d.ts` 既有 `serverBundle` 結構。

### Deliverable 5：純函數單元測試

`src/lib/__tests__/server-bundle-distributor.test.ts`：

**測試範圍**：純函數 helpers（不測 T0319/T0318/fs 整合，過度 mock）。

**最少 case ≥12**：

| function | case |
|----------|------|
| `expectedTarballFilename` | 3 arch × 2 version 格式（含 pre-release）|
| `resolveDefaultPaths` | Win/Mac/Linux 三 host 預期路徑 |
| `classifyDistributeError` | cache/baseline/download 三層 × 不同 inner error |
| `shouldFallbackToDownload` | missing-manifest / missing-tarball → true / corrupted → false |

額外驗收：`npm run test:unit` 全綠（154 + 12 = 166+）+ `npx tsc --noEmit` 對新檔 0 error。

## 驗收條件

- AC-1：`electron/remote/server-bundle-distributor.ts` 存在；export `distributeServerBundle` 與簽章一致
- AC-2：實作三層 lookup（cache → baseline → download），每層 SHA verify
- AC-3：使用 T0317 `createSha256Stream` + `compareSha256` + `parseManifest`，不重寫
- AC-4：使用 T0318 `downloadServerBundle`，不重寫 fetch / retry
- AC-5：使用 T0319 `detectRemoteArch`（透過 IPC 或直接 import）
- AC-6：5 種 errorCode 都有對應路徑（arch-detection-failed / no-source-available / download-failed / baseline-corrupted / aborted）
- AC-7：baseline 通過時 SHA verify + auto copy 到 cache（next time cache hit）
- AC-8：baseline-corrupted 不 fallback download（fail-closed，spec 紀律）
- AC-9：純函數 helpers 抽到 `src/lib/server-bundle-distributor-helpers.ts`（沿 T0319/T0318 慣例）
- AC-10：IPC `server-bundle:distribute` + event `server-bundle:distribute-progress` 註冊
- AC-11：preload `window.electronAPI.remote.serverBundle.distribute / onDistributeProgress` 暴露 + type augmentation
- AC-12：純函數測試 ≥12 cases；`npm run test:unit` 全綠
- AC-13：`npx tsc --noEmit` 對新檔 0 error
- AC-14：使用 `./logger`，不用 `console.log`
- AC-15：commit 訊息走 `chore(remote): T0320 - PLAN-031 server bundle distributor`

## 範圍排除（不在本工單）

- ❌ 不改 install-bundle steps（Sprint 4 範圍）
- ❌ 不寫 renderer UI（progress 顯示由 Sprint 4 整合）
- ❌ 不實作 cancellation IPC（如 T0318，預留 AbortSignal 介面）
- ❌ 不實作「升級既有 server」流程（T0326 範圍）
- ❌ 不擴 verify-auth.ts serverArch 抓取邏輯
- ❌ 不真實打 fs / network integration test（純函數可 mock，integration 留 Sprint 5）

## Worker 守則

1. **重用上游 4 元件**：T0316/T0317/T0318/T0319，不重寫
2. **child_process 紀律**：本工單**無**需要 child_process（純 fs + crypto + IPC + import T0319），CLAUDE.md「Child Process Spawning」原則仍適用
3. **fs 紀律**：用 `node:fs/promises`；所有檔案操作必檢查 abort
4. **不 throw**：API 設計為 result-based
5. **logger**：用 `./logger`
6. **vitest 紀律**：`npm run test:unit` 全綠，case ≥12
7. **TypeScript 紀律**：`npx tsc --noEmit` 對新檔 0 error
8. **commit 紀律**：單 commit 即可
9. **規範性 scope expansion**：照 T0316/T0317/T0319/T0318 模式在回報區標「out-of-scope but justified」段落
10. **記憶覆寫**：本工單**沒有** `memory_overrides` 欄位 — 沿用所有現行 GP 規則 + 學習紀錄

## Worker 回報區（Worker 填寫）

### 1. server-bundle-distributor.ts 摘要

（待填）

### 2. 純函數 helpers 摘要

（待填）

### 3. IPC handler + progress event

（待填）

### 4. preload + type augmentation

（待填）

### 5. 純函數單元測試

（待填）

### 6. 既有 test + tsc 結果

（待填）

### 7. PARTIAL / 矛盾項（如有）

（待填）

### 8. Out-of-scope but justified（如有）

（待填）

### 完成註記

（待填）
