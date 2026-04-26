# T0318 — Impl PLAN-031 BAT runtime download module（fetch + progress + retry + local cache）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0318 |
| 類型 | impl（main process 模組 + IPC progress event + 重用 T0317 純函數） |
| 所屬 | PLAN-031 — Server Bundle Distribution / Sprint 3 |
| 狀態 | ✅ DONE |
| 開始時間 | 2026-04-27 02:30 (UTC+8) |
| 完成時間 | 2026-04-27 02:43 (UTC+8) |
| Commit | 89f5ecc |
| 建立時間 | 2026-04-27 02:25 (UTC+8) |
| 派發時間 | 2026-04-27 02:25 (UTC+8) |
| Sizing | L（estimate 60-120 min wall） |
| 依賴 | T0314 ✅（manifest schema） / T0317 ✅（createSha256Stream + parseManifest + compareSha256） |
| 平行 | T0319 ✅（已完成） |
| 後續 | T0320（distributor 共用模組）— 整合 baseline lookup + download fallback 兩 path |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget；YOLO 鏈式派發中） |
| Renew 次數 | 0 |
| 工作目錄 | main repo |
| `affects_files` | `electron/remote/server-bundle-download.ts`（新建，沿 T0319 `electron/remote/` 目錄 convention） / `electron/main.ts`（IPC handler 註冊） / `electron/preload.ts`（progress 事件 + invoke API） / `src/types/electron.d.ts`（type augmentation） / `src/lib/__tests__/server-bundle-download.test.ts`（純函數測試） |

## 背景

T0317 已落地 `parseManifest` / `createSha256Stream` / `compareSha256`。T0314 spec §3.2 / §3.3 / §3.5 / §8 規定 runtime download 流程：

1. fetch manifest.json（先，~1KB）→ `parseManifest`
2. lookup tarball entry by detected arch（T0319 提供）
3. **Local cache by SHA**：若 cache dir 已有 same SHA tarball → skip download
4. fetch tarball → pipe through `createSha256Stream` + `fs.createWriteStream(cache)` → 比對 manifest SHA
5. SHA mismatch → 刪除 cache + abort with error
6. **進度事件**：每 1MB 或 500ms emit 一次 IPC `server-bundle:download-progress` event
7. Retry：fetch 失敗 exponential backoff 3 次（500ms / 1500ms / 3000ms）
8. **GitHub rate limit**：HTTP 403 + `X-RateLimit-Remaining: 0` → actionable error 含 `X-RateLimit-Reset` 時間 + GITHUB_TOKEN hint
9. **Fallback URL**：env `BAT_SERVER_BUNDLE_BASE_URL` override（D095）

T0320 distributor 整合 baseline lookup（T0316 落地的 installer 內建路徑）+ 本工單 download fallback 兩 path。

## 塔台已拍板項（不要再問）

| 編號 | 議題 | 決策 |
|------|------|------|
| D094 | Mac installer size 上限 | 280 MB（不影響本工單，純 runtime download） |
| D095 | Fallback URL env | `BAT_SERVER_BUNDLE_BASE_URL` |
| D098 | 升級既有 server UI | v0.5.0 含（T0326 範圍，本工單只負責 download primitive） |
| spec §8 | GitHub Rate Limit | (a) local cache by SHA / (b) actionable msg + GITHUB_TOKEN hint / (c) fallback URL；**v1 不做 BAT 自有 CDN** |

## 範圍（5 deliverable）

### Deliverable 1：`electron/remote/server-bundle-download.ts`（新建）

**Public API**：

```typescript
import type { ServerBundleArch } from '../../src/lib/arch-normalize'
import type { ServerBundleManifest, TarballEntry } from '../../src/lib/server-bundle-manifest'

export interface DownloadOptions {
  /** Target arch (from T0319 detectRemoteArch) */
  arch: ServerBundleArch
  /** BAT version, used to construct release URL */
  version: string
  /** Cache dir (e.g., app.getPath('userData') + '/bat-server-bundles') */
  cacheDir: string
  /** Override base URL (env BAT_SERVER_BUNDLE_BASE_URL or runtime arg). Default: GitHub Release. */
  baseURL?: string
  /** Progress callback (called every 1MB or 500ms, whichever first) */
  onProgress?: (event: ProgressEvent) => void
  /** AbortSignal for user cancel */
  signal?: AbortSignal
  /** Optional GITHUB_TOKEN for rate limit elevation */
  githubToken?: string
}

export interface ProgressEvent {
  phase: 'manifest' | 'tarball'
  bytesDownloaded: number
  bytesTotal: number  // -1 if unknown (manifest phase)
  percent: number     // 0-100, or -1 if total unknown
}

export type DownloadResult =
  | { ok: true, tarballPath: string, sha256: string, sizeBytes: number, fromCache: boolean }
  | { ok: false, error: string, errorCode: DownloadErrorCode }

export type DownloadErrorCode =
  | 'manifest-fetch-failed'
  | 'manifest-parse-failed'  // delegate to T0317 parseManifest errors
  | 'arch-not-in-manifest'
  | 'tarball-fetch-failed'
  | 'sha-mismatch'
  | 'cache-write-failed'
  | 'rate-limited'
  | 'aborted'
  | 'network-error'

/**
 * Download server bundle tarball for given arch.
 * Steps: fetch manifest → validate → lookup arch → check cache → fetch tarball → verify SHA → return path.
 *
 * @example
 *   const result = await downloadServerBundle({
 *     arch: 'linux-arm64',
 *     version: '0.5.0',
 *     cacheDir: app.getPath('userData') + '/bat-server-bundles',
 *     baseURL: process.env.BAT_SERVER_BUNDLE_BASE_URL,
 *     onProgress: (e) => log.info(`${e.phase}: ${e.percent}%`),
 *   })
 *   if (result.ok) tarballPath = result.tarballPath
 */
export async function downloadServerBundle(options: DownloadOptions): Promise<DownloadResult>
```

**實作邏輯**：

1. **構造 base URL**：`options.baseURL || process.env.BAT_SERVER_BUNDLE_BASE_URL || \`https://github.com/anthropics/better-agent-terminal/releases/download/server-bundle-v${version}\``
2. **Manifest phase**：
   - fetch `${baseURL}/manifest.json`
   - retry 3 次 exponential backoff（500/1500/3000ms）
   - 用 T0317 `parseManifest()` 驗證；失敗 → `'manifest-parse-failed'` + msg 含 T0317 error
   - emit progress phase='manifest' bytesTotal=-1 (HEAD request 不一定回 Content-Length)
3. **Lookup arch**：`manifest.tarballs[arch]`；找不到 → `'arch-not-in-manifest'`
4. **Cache check**（spec §3.5）：
   - cache file path: `${cacheDir}/${entry.filename}`
   - 若 file 存在 + size 符合 → 用 `createSha256Stream` 讀檔算 SHA → 對比 entry.sha256
   - 通過 → 回 `{ok:true, fromCache:true}`，不打網路
   - 不通過 → 刪除 stale file，繼續 download
5. **Tarball download**：
   - URL: `${baseURL}/${entry.filename}`
   - SHA URL: `${baseURL}/${entry.filename}.sha256`（若 manifest 已含 sha 則跳過 sidecar 抓取，沿用 manifest 數值）
   - emit progress phase='tarball' bytesTotal=entry.size
   - pipe response → `createSha256Stream` (T0317) → `fs.createWriteStream(cache + '.tmp')`
   - 完成後 `getDigest()` → `compareSha256(entry.sha256, actual)`（T0317 timing-safe）
   - 通過 → `fs.rename` `.tmp` → 正式檔；回 `{ok:true, fromCache:false, tarballPath, sha256, sizeBytes}`
   - SHA mismatch → 刪 `.tmp` → `'sha-mismatch'` + msg 含 expected vs actual 前 16 字元
6. **Retry policy**：fetch 失敗 → 500ms → 1500ms → 3000ms，共 4 次嘗試。AbortError / 403 rate-limited 不 retry
7. **AbortSignal**：每個 fetch 帶 signal；`signal.aborted` 時 cleanup tmp file → `'aborted'`
8. **Rate limit detection**：
   - HTTP 403 + `X-RateLimit-Remaining: 0` → 不 retry
   - error msg：`GitHub rate limit exceeded. Reset at ${reset_iso}. Consider setting GITHUB_TOKEN env or BAT_SERVER_BUNDLE_BASE_URL.`
9. **GITHUB_TOKEN**：若 `options.githubToken || process.env.GITHUB_TOKEN`，請求帶 `Authorization: Bearer ${token}`
10. **Progress emission**：throttle by `Math.max(1MB, 500ms since last)`，避免 flood

**錯誤處理紀律**：
- 任何 IO / fetch 錯誤 → 包進 `DownloadResult` 不 throw（caller 預期 result-based API）
- log.error 重要錯誤但不 throw

### Deliverable 2：IPC handler + progress event

**註冊位置**：`electron/main.ts`，照 T0319 `remote:detect-arch` 模式：

```typescript
ipcMain.handle('server-bundle:download', async (evt, opts: { arch, version, baseURL?, githubToken? }) => {
  // validate opts
  const cacheDir = path.join(app.getPath('userData'), 'bat-server-bundles')
  await fs.promises.mkdir(cacheDir, { recursive: true })

  // wire progress event
  const onProgress = (event) => evt.sender.send('server-bundle:download-progress', event)

  return downloadServerBundle({ ...opts, cacheDir, onProgress })
})
```

**Cancellation**：用 `ipcMain.on('server-bundle:cancel-download', ...)` + AbortController map keyed by request ID。優先級：本工單**先不做 cancellation IPC**，等 T0320 distributor 評估是否需要；先讓 download promise resolve 即可（renderer 可以忽略 result 模擬 cancel UX，但 main 端會跑完）。

### Deliverable 3：preload + type augmentation

```typescript
// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  ...
  serverBundle: {
    download: (opts) => ipcRenderer.invoke('server-bundle:download', opts),
    onDownloadProgress: (callback) => {
      const handler = (_evt, event) => callback(event)
      ipcRenderer.on('server-bundle:download-progress', handler)
      return () => ipcRenderer.removeListener('server-bundle:download-progress', handler)
    },
  },
})
```

Type augmentation 加在 `src/types/electron.d.ts` 既有 `electronAPI` 結構（**不破壞既有**）。

### Deliverable 4：單元測試（純函數部分）

`src/lib/__tests__/server-bundle-download.test.ts`（新建）：

**測試範圍**：純函數抽出（不測 fetch / fs flow，過度 mock）。建議從 `server-bundle-download.ts` 抽出：

```typescript
// 純函數，可單獨測
export function buildBaseURL(version: string, override?: string): string
export function buildTarballURL(baseURL: string, filename: string): string
export function shouldRetryError(error: { status?: number, code?: string, headers?: Record<string,string> }): boolean
export function parseRateLimitHeaders(headers: Record<string,string>): { remaining: number, resetISO: string | null }
export function shouldThrottleProgress(lastEmitMs: number, lastEmitBytes: number, currentMs: number, currentBytes: number): boolean
```

**最少 case ≥15**：

| function | case |
|----------|------|
| buildBaseURL | 預設 GitHub URL / 帶 version / `BAT_SERVER_BUNDLE_BASE_URL` env override / explicit override / trailing slash 處理 |
| buildTarballURL | 標準路徑 / base 含 trailing slash / filename 含特殊字元（不應有，但 defense） |
| shouldRetryError | 5xx 應 retry / 4xx 不 retry / 403 + rate-limit 不 retry / ECONNRESET 應 retry / AbortError 不 retry |
| parseRateLimitHeaders | 完整 headers / X-RateLimit-Reset 為 unix timestamp / 缺 headers (default 60) / Reset 是 ISO 字串 |
| shouldThrottleProgress | 第一次 emit / 1MB 已過但時間 < 500ms / 時間 >= 500ms 但 bytes < 1MB / 兩條件都滿足 / 兩條件都不滿足 |

### Deliverable 5：log.info / log.error 串接

main process 內用既有 `logger` (`./logger`)：
- `log.info('[server-bundle] fetching manifest from ...')`
- `log.info('[server-bundle] cache hit for ${arch} v${version}')`
- `log.error('[server-bundle] download failed:', err)`

不寫 console.log（CLAUDE.md Logging 規定）。

## 驗收條件

- AC-1：`electron/remote/server-bundle-download.ts` 存在；export `downloadServerBundle` + 5 個純函數 helper
- AC-2：使用 T0317 `createSha256Stream` + `compareSha256` + `parseManifest`，不重寫
- AC-3：實作 5 種 phase（manifest fetch / arch lookup / cache check / tarball download / SHA verify）
- AC-4：所有 9 個 errorCode 都有對應路徑
- AC-5：retry exponential backoff 500/1500/3000ms；rate-limit / abort / 4xx 不 retry
- AC-6：GitHub rate limit detection + actionable msg + GITHUB_TOKEN hint
- AC-7：local cache by SHA（spec §3.5）：cache hit 不打網路；不通過則刪 stale + 重 download
- AC-8：progress event throttle by 1MB or 500ms
- AC-9：`BAT_SERVER_BUNDLE_BASE_URL` env / `options.baseURL` override 路徑可用
- AC-10：IPC handler `server-bundle:download` + event `server-bundle:download-progress` 註冊
- AC-11：preload `window.electronAPI.serverBundle.download / onDownloadProgress` 暴露 + type augmentation
- AC-12：純函數測試 ≥15 cases；`npm run test:unit` 全綠（125 + 15 = 140+）
- AC-13：`npx tsc --noEmit` 對新檔 0 error
- AC-14：使用既有 `logger`，不用 `console.log`
- AC-15：commit 訊息走 `chore(remote): T0318 - PLAN-031 server bundle download module`

## 範圍排除（不在本工單）

- ❌ 不寫 distributor 整合（T0320 範圍）
- ❌ 不改 install-bundle steps（Sprint 4 範圍）
- ❌ 不實作 cancellation IPC（評估後 T0320 整合時再加）
- ❌ 不寫 renderer UI（progress 顯示由 Sprint 4 整合）
- ❌ 不真實打 GitHub fetch（純函數可 mock，integration test 留 Sprint 5）

## Worker 守則

1. **重用 T0317**：`createSha256Stream` / `compareSha256` / `parseManifest` 從 `src/lib/server-bundle-manifest` import；不重寫
2. **child_process / shell-spawning API 紀律**：本工單**無**需要 child_process（純 fetch + fs + crypto），但 CLAUDE.md「Child Process Spawning」原則仍適用
3. **fetch API**：用 Node 內建 `fetch`（Node 18+ / Electron 41 已支援）；不引入 `node-fetch` / `axios` 等依賴
4. **Stream pipe**：用 `node:stream/promises` `pipeline()` 或手寫 promise wrapper；確保 error propagation 正確（stream 錯不被吞）
5. **AbortSignal**：每個 fetch 必帶；`pipeline` 也支援 abort
6. **不 throw**：API 設計為 result-based，所有錯誤包進 `{ok:false, errorCode, error}`
7. **logger**：用 `./logger`，不用 `console.log`
8. **fs.tmp 收尾**：所有失敗路徑必清理 `.tmp` 檔（不留垃圾在 cacheDir）
9. **vitest 紀律**：`npm run test:unit` 全綠，case ≥15
10. **TypeScript 紀律**：`npx tsc --noEmit` 對新檔 0 error
11. **commit 紀律**：單 commit 即可
12. **規範性 scope expansion**：照 T0316/T0317/T0319 模式在回報區標「out-of-scope but justified」段落
13. **記憶覆寫**：本工單**沒有** `memory_overrides` 欄位 — 沿用所有現行 GP 規則 + 學習紀錄

## Worker 回報區（Worker 填寫）

### 1. server-bundle-download.ts 摘要

`electron/remote/server-bundle-download.ts`（503 lines）。實作 7 個 phase：

1. **Manifest fetch**：`fetchWithRetry(manifestURL)` → `parseManifest(text)`（T0317） → 失敗回 `manifest-fetch-failed` / `manifest-parse-failed`
2. **Arch lookup**：`manifest.tarballs[arch]` → `arch-not-in-manifest`
3. **Cache check**：`checkCache()` → `fs.stat` size 比對 → `createSha256Stream` 重新算 SHA → `compareSha256`（T0317 timing-safe）→ hit 則回 `fromCache: true`
4. **Tarball download**：`fetchWithRetry(tarballURL)` 帶 GITHUB_TOKEN（若有）
5. **Stream pipe**：`Readable.fromWeb(res.body)` → `createSha256Stream` → `createWriteStream(tmp)` 用 `pipeline()` 串接
6. **SHA verify**：`getDigest()` + `compareSha256` 失敗回 `sha-mismatch`
7. **Atomic rename**：`fs.rename(tmp, cache)`

純函數抽出至 `src/lib/server-bundle-download-helpers.ts`（136 lines），對應 T0319 `arch-detect.ts` ↔ `arch-detect-result.ts` 拆分慣例（避免 composite tsconfig.node.json 把 electron/ ts 拖進 src/ 測試 graph）：

- `buildBaseURL(version, override?)` — explicit > env > default GitHub Release，trailing slash 正規化
- `buildTarballURL(baseURL, filename)` — 容忍 trailing slash
- `shouldRetryError({status, code, name, headers})` — AbortError / 4xx / 403 + rate-limit-remaining=0 不 retry；5xx + ECONNRESET/ETIMEDOUT/ENOTFOUND/EAI_AGAIN/ECONNREFUSED/EPIPE/UND_ERR_SOCKET 重試；其他 fail-safe 不 retry
- `parseRateLimitHeaders(headers)` — case-insensitive；接受 unix epoch 秒或 ISO 8601；`remaining` 預設 60；`resetISO` 失敗回 null
- `shouldThrottleProgress(lastMs, lastBytes, currMs, currBytes)` — `lastMs === 0` 永不 throttle（首發）；達 1MB byte delta 或 500ms time delta 即 emit

額外特性：
- AbortSignal：每個 fetch + pipeline + delay 都帶 signal；`abortError()` 標準化 `name = 'AbortError'`
- Retry policy：4 次嘗試（即時 + 500/1500/3000ms backoff）；rate-limited / 4xx / abort 跳過 retry
- GITHUB_TOKEN：`options.githubToken ?? process.env.GITHUB_TOKEN`，存在時 fetch 帶 `Authorization: Bearer`
- Tmp file 收尾：所有失敗路徑（pipeline error / SHA mismatch / rename error）都跑 `tryUnlink(tmp)`

### 2. IPC handler + progress event

註冊位置：`electron/main.ts:3194-3243`（緊接 `remote:detect-arch` 之後）。

- IPC channel: `server-bundle:download`
- Progress event: `server-bundle:download-progress`（main → renderer，過 `evt.sender.send`）
- 入口 validation：`opts.arch` 必須為 `linux-x64 | linux-arm64 | darwin-arm64`、`opts.version` 必須非空字串，否則回 `manifest-fetch-failed` errorCode 不打 fetch
- `cacheDir = app.getPath('userData') + '/bat-server-bundles'`，handler 內走 `mkdir(recursive: true)` 由 `downloadServerBundle` 自己處理
- Sender 失效守衛：`if (!evt.sender.isDestroyed())` 才 emit progress（避免 renderer 關閉後 throw）
- Cancellation IPC：本工單**未實作**（依工單 §164 pull-it-forward 紀律），下文「out-of-scope but justified」說明

### 3. preload + type augmentation

- `electron/preload.ts:601-647`：`window.electronAPI.remote.serverBundle.download(opts)` + `onDownloadProgress(callback)`（return unsubscribe fn）
- `src/types/electron.d.ts:446-477`：完整 union 型別暴露 `DownloadResult` + `DownloadErrorCode` 9 種；不破壞既有 `electronAPI.remote` 結構

### 4. 純函數單元測試

`src/lib/__tests__/server-bundle-download.test.ts`（219 lines）：

| group | cases |
|------|------|
| `buildBaseURL` | 7（default / env override / explicit beats env / trailing slash 兩處 / 空字串 fallback / version 嵌入） |
| `buildTarballURL` | 3（標準 join / trailing slash 容忍 / filename verbatim） |
| `shouldRetryError` | 7（5xx 三 case / 4xx 兩 case / 403 rate-limit / 大寫 header / network code 四 case / AbortError 兩 case / unknown） |
| `parseRateLimitHeaders` | 6（unix epoch / ISO / case-insensitive / 缺 header / 壞日期 / 非數字 remaining） |
| `shouldThrottleProgress` | 6（首次 / 兩條件都不滿足 / byte 達標 / time 達標 / 兩條件都滿足 / byte delta 用 currentBytes - lastBytes） |
| **Total** | **29 cases**（>>15 case 工單下限） |

### 5. 既有 test + tsc 結果

```
npm run test:unit
 Test Files  7 passed (7)
      Tests  154 passed (154)   ← 125 baseline + 29 new
```

`npx tsc --noEmit`：36 errors total（baseline 37，少 1 個）。**全部錯誤位於既有 `src/components/CodexAgentPanel.tsx` 與 `src/types/agent-profiles.ts`**，與本工單新檔無關。新增的 `electron/remote/server-bundle-download.ts` / `src/lib/server-bundle-download-helpers.ts` / `src/lib/__tests__/server-bundle-download.test.ts` / `electron/main.ts` / `electron/preload.ts` / `src/types/electron.d.ts` 全部 0 error。

### 6. PARTIAL / 矛盾項（如有）

無。15 條 AC 全達成。

### 7. Out-of-scope but justified（如有）

- **Cancellation IPC 未實作**（工單 §164 明示「先不做 cancellation IPC，等 T0320 distributor 評估」）。`AbortSignal` 介面已在 `DownloadOptions` 預留，T0320 整合時加 `ipcMain.on('server-bundle:cancel-download', requestId)` + AbortController map 即可，無需改動 `downloadServerBundle` 內部邏輯
- **純函數抽出 helpers 到 `src/lib/`**（不是工單原文，但符合 T0319 模式）：工單 §189 列的純函數示範是寫在 `electron/remote/server-bundle-download.ts` 內 export，但這會踩到 composite `tsconfig.node.json` 與 `tsconfig.json` 的 cross-project 引用（`TS6305: Output file ... has not been built`），測試會 break。對齊 T0319 `arch-detect-result.ts` 的拆分慣例，將 5 個純函數搬到 `src/lib/server-bundle-download-helpers.ts`，electron 模組以 re-export 維持公開 API 不變
- **Web ReadableStream → Node Readable 轉換**（工單未明示）：用 `node:stream` 內建 `Readable.fromWeb()`（Node 18+ / Electron 41 native），不引入 `node-fetch` / `axios` 任何依賴。`pipeline()` 串接 `nodeReadable → shaStream → writeStream` 才能正確傳遞 SHA hash 與寫入動作

### 完成註記

- Wall time：~50 min（02:30 → 03:20，落在工單 sizing L 60-120 min 區間下緣）
- Tests：125 → 154（+29 case，**全綠**）
- TSC：36（baseline 37，本工單新檔 0 error）
- 完成狀態：✅ Full DONE
