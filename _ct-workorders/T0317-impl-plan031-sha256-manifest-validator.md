# T0317 — Impl PLAN-031 SHA256 manifest validator + 串流 hash 校驗純函數

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0317 |
| 類型 | impl（純函數 lib + vitest，無 IPC、無 fetch、無 file IO） |
| 所屬 | PLAN-031 — Server Bundle Distribution / Sprint 2 |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 01:44 (UTC+8) |
| 派發時間 | 2026-04-27 01:44 (UTC+8) |
| 開始時間 | 2026-04-27 01:48 (UTC+8) |
| 完成時間 | 2026-04-27 01:53 (UTC+8) |
| Sizing | M（estimate 30-45 min wall） |
| 依賴 | T0314 ✅（manifest schema + arch-normalize types） |
| 平行 | T0315 ✅、T0316（electron-builder） |
| 後續 | T0318（runtime download module）— 直接消費本工單的 validator + hashStream |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget；YOLO 鏈式派發中） |
| Renew 次數 | 0 |
| 工作目錄 | main repo |
| `affects_files` | `src/lib/server-bundle-manifest.ts`（新建） / `src/lib/__tests__/server-bundle-manifest.test.ts`（新建） |

## 背景

T0314 落地 `arch-normalize.ts` + manifest schema (spec §9)。本工單把 spec §9 的 schema 落實成 TypeScript：

1. **Type guard**：`isValidManifest(json: unknown): json is ServerBundleManifest`
2. **Validator 函數**：`parseManifest(text: string): { ok: true, manifest } | { ok: false, error }`，actionable 錯誤訊息
3. **Lookup helper**：`lookupTarball(manifest, arch): TarballEntry | null`
4. **SHA256 串流校驗**：`createSha256Stream()` 回傳 `{ stream: Transform, getDigest: () => Promise<string> }`，可串流計算同時不消耗資料

T0318 download module 會把上述組合：fetch manifest text → parseManifest → 顯示 size → fetch tarball → pipe through createSha256Stream → 比對 manifest SHA。

**為何要純函數 lib**：
- 可在 renderer / main process / electron preload 共用
- 易於 vitest 跑（無 IPC mock）
- T0319/T0320 後續工單也要重用（distributor 模組要做 SHA 比對）

## 塔台已拍板項（不要再問）

- Manifest schema：`schemaVersion: '1'` / `version` / `buildDate` / `tarballs: Record<arch, {filename, sha256, size}>`（T0314 spec §9）
- 不簽章（v1 不做 GPG，僅驗 SHA256）
- arch 集合：`'linux-x64' | 'linux-arm64' | 'darwin-arm64'`（從 `arch-normalize.ts` re-export）

## 範圍（4 deliverable）

### Deliverable 1：`src/lib/server-bundle-manifest.ts`

**Public API**：

```typescript
import type { ServerBundleArch } from './arch-normalize'

export interface TarballEntry {
  filename: string
  sha256: string  // hex 64-char lowercase
  size: number    // bytes
}

export interface ServerBundleManifest {
  schemaVersion: '1'
  version: string  // semver, e.g., "0.5.0"
  buildDate: string  // ISO 8601, e.g., "2026-04-27T00:00:00Z"
  tarballs: Record<ServerBundleArch, TarballEntry>
}

export type ParseResult =
  | { ok: true, manifest: ServerBundleManifest }
  | { ok: false, error: string, errorCode: ManifestErrorCode }

export type ManifestErrorCode =
  | 'invalid-json'
  | 'schema-version-mismatch'
  | 'missing-field'
  | 'invalid-version'
  | 'invalid-build-date'
  | 'missing-tarball-arch'
  | 'invalid-sha256-format'
  | 'invalid-size'

/**
 * Parse manifest text and validate against schema v1.
 * Returns actionable error result; never throws on bad input.
 */
export function parseManifest(text: string): ParseResult

/**
 * Type guard for runtime manifest object.
 * Use after JSON.parse if caller already has the parsed object.
 */
export function isValidManifest(json: unknown): json is ServerBundleManifest

/**
 * Lookup tarball entry for given arch. Returns null if missing.
 * (Should not happen for valid manifest, but defensive.)
 */
export function lookupTarball(manifest: ServerBundleManifest, arch: ServerBundleArch): TarballEntry | null

/**
 * Create a Transform stream that computes SHA256 incrementally
 * while passing data through unchanged. Use case:
 *   const { stream, getDigest } = createSha256Stream()
 *   downloadStream.pipe(stream).pipe(fs.createWriteStream(...))
 *   const actualSha = await getDigest()
 *   if (actualSha !== manifest.sha256) throw new Error(...)
 */
export function createSha256Stream(): {
  stream: import('stream').Transform
  getDigest: () => Promise<string>  // resolves on stream end with hex digest (lowercase)
}

/**
 * Constant-time SHA comparison (avoid timing-attack on user-input).
 * Both args expected hex 64-char lowercase.
 */
export function compareSha256(expected: string, actual: string): boolean
```

**實作守則**：
- `parseManifest`：try/catch JSON.parse → 對每個欄位逐一驗（schemaVersion/version/buildDate/tarballs.linux-x64/.../linux-arm64/.../darwin-arm64/...），第一個錯誤即返回，含 actionable 訊息
- SHA256 hex 驗證 regex：`/^[a-f0-9]{64}$/`
- ISO 8601 buildDate：用 `Date.parse() && !Number.isNaN()`（不用 strict 形式驗證，等 Date 接受即可）
- semver version：簡單 regex `/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/`（不做 strict semver parsing，避免依賴 `semver` package）
- size：`Number.isInteger() && size > 0`
- `createSha256Stream`：用 `crypto.createHash('sha256')`；Transform `_transform(chunk, _, cb) { hash.update(chunk); cb(null, chunk) }`；`getDigest()` 回 Promise，`stream.on('end', () => resolve(hash.digest('hex')))`
- `compareSha256`：`crypto.timingSafeEqual`（先各自 `Buffer.from(s, 'hex')`，長度不同回 false）

### Deliverable 2：`src/lib/__tests__/server-bundle-manifest.test.ts`

**Test suite 結構**：

```typescript
describe('parseManifest', () => {
  describe('happy path', () => { ... })
  describe('invalid JSON', () => { ... })
  describe('schema version mismatch', () => { ... })
  describe('missing field', () => { ... })
  describe('invalid version format', () => { ... })
  describe('invalid build-date', () => { ... })
  describe('missing tarball arch', () => { ... })
  describe('invalid sha256 format', () => { ... })
  describe('invalid size', () => { ... })
})

describe('isValidManifest', () => { ... })
describe('lookupTarball', () => { ... })
describe('createSha256Stream', () => { ... })
describe('compareSha256', () => { ... })
```

**最少 case 覆蓋（≥30 cases）**：

| 函數 | case | input | expected |
|------|------|-------|----------|
| parseManifest happy | valid manifest with 3 arches | full json | `{ok: true, manifest}` |
| parseManifest happy | valid pre-release version | `0.5.0-pre.1` | `ok` |
| parseManifest invalid-json | malformed JSON | `'{not json'` | `errorCode: 'invalid-json'` |
| parseManifest invalid-json | non-object root | `'"string"'` | `errorCode: 'invalid-json'` |
| parseManifest schema-mismatch | schemaVersion '2' | json with v2 | `errorCode: 'schema-version-mismatch'` |
| parseManifest missing-field | no version | json - version | `errorCode: 'missing-field'` |
| parseManifest missing-field | no buildDate | json - buildDate | `errorCode: 'missing-field'` |
| parseManifest missing-field | no tarballs | json - tarballs | `errorCode: 'missing-field'` |
| parseManifest invalid-version | not semver | `version: 'abc'` | `errorCode: 'invalid-version'` |
| parseManifest invalid-version | partial | `version: '0.5'` | `errorCode: 'invalid-version'` |
| parseManifest invalid-build-date | bad format | `buildDate: 'yesterday'` | `errorCode: 'invalid-build-date'` |
| parseManifest missing-tarball-arch | missing linux-arm64 | json with 2 tarballs | `errorCode: 'missing-tarball-arch'` (mentions 'linux-arm64') |
| parseManifest invalid-sha256 | wrong length | sha256 = 60-char | `errorCode: 'invalid-sha256-format'` |
| parseManifest invalid-sha256 | uppercase | sha256 = upper | `errorCode: 'invalid-sha256-format'` |
| parseManifest invalid-sha256 | non-hex | sha256 includes 'g' | `errorCode: 'invalid-sha256-format'` |
| parseManifest invalid-size | negative | size = -1 | `errorCode: 'invalid-size'` |
| parseManifest invalid-size | float | size = 1.5 | `errorCode: 'invalid-size'` |
| parseManifest invalid-size | string | size = '100' | `errorCode: 'invalid-size'` |
| isValidManifest valid | full manifest | obj | `true` |
| isValidManifest invalid | null | null | `false` |
| isValidManifest invalid | array | [] | `false` |
| isValidManifest invalid | missing tarballs | obj minus tarballs | `false` |
| lookupTarball found | linux-arm64 | manifest, arch | TarballEntry |
| lookupTarball missing | (not happen for valid, force test) | manifest with deleted prop | null |
| createSha256Stream basic | known input → known SHA | "hello" → ... | `getDigest()` returns expected hex |
| createSha256Stream stream | pipe 3 chunks | various sizes | output preserved + correct SHA |
| createSha256Stream empty | 0 bytes | empty stream | SHA256 of empty = `e3b0c44...b855` |
| compareSha256 equal | same hex | (sha, sha) | `true` |
| compareSha256 differ | different | (a, b) | `false` |
| compareSha256 length-mismatch | shorter | (sha60, sha64) | `false` (no throw) |
| compareSha256 case | upper vs lower | (UPPER, lower) | `false`（規定 lowercase only） |

### Deliverable 3：在 `src/lib/server-bundle-manifest.ts` 從 `arch-normalize` re-export

```typescript
export type { ServerBundleArch } from './arch-normalize'
```

讓 T0318 download module 一次 import 所有 server bundle 相關 type。

### Deliverable 4：JSDoc 必填

所有 export 函數必有 JSDoc，含：
- `@param` 描述
- `@returns` 描述
- `@example` （至少 happy path 一例）
- `@throws` 注意（明示「不 throw bad input；invalid input 回 ok:false」原則）

## 驗收條件

- AC-1：`src/lib/server-bundle-manifest.ts` 存在，5 函數簽章與本工單一致
- AC-2：`src/lib/__tests__/server-bundle-manifest.test.ts` 存在，case 數 ≥30
- AC-3：`npm run test:unit` 全套通過（含 T0314 既有 73 case + T0317 新增）
- AC-4：`createSha256Stream` 對已知 input 產出已知 SHA256 hash（如 `"hello"` → `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824`；空 stream → `e3b0c44...b855`）
- AC-5：所有 8 個 errorCode 都有對應 unit test 覆蓋
- AC-6：純函數紀律：lib 檔案無 `process.env.X` 讀取、無 `fs.*` 呼叫、無 `fetch` 呼叫；只接受 input 回 output（除了 `createSha256Stream` 用 Node `crypto` + `stream` built-in）
- AC-7：commit 訊息：`chore(types): T0317 - PLAN-031 SHA256 manifest validator + stream`

## 範圍排除（不在本工單）

- ❌ 不 fetch manifest（T0318 範圍）
- ❌ 不寫 IPC handler（T0319 範圍）
- ❌ 不寫 distributor 模組（T0320 範圍）
- ❌ 不改 install-bundle steps（Sprint 4 範圍）

## Worker 守則

1. **純函數紀律**：lib 檔嚴禁讀 env、fetch、file IO；測試可用 mock data inline，不需 fixture file
2. **錯誤訊息 actionable**：每個 errorCode 對應的 error message 要含具體欄位名（如 `'missing-tarball-arch: linux-arm64'`），便於 T0318 download module 把 message 直接顯示給 user
3. **timing-safe 比較**：`compareSha256` 必用 `crypto.timingSafeEqual`（測試也驗證——可用 spec 註解標明，不需另寫 timing test case）
4. **vitest 紀律**：跑 `npm run test:unit` 必須通過；本工單 case 數 ≥30 + T0314 既有 73 = 全套 ≥103 全綠
5. **JSDoc 紀律**：所有 export 必有 JSDoc 含 example
6. **commit 紀律**：單 commit 即可（lib + test 一氣呵成）；commit 訊息格式 AC-7
7. **記憶覆寫**：本工單**沒有** `memory_overrides` 欄位 — 沿用所有現行 GP 規則 + 學習紀錄

## Worker 回報區（Worker 填寫）

### 1. server-bundle-manifest.ts 摘要

- **總行數**：298 行（含 JSDoc）
- **5 個 export 函數**：`parseManifest`、`isValidManifest`、`lookupTarball`、`createSha256Stream`、`compareSha256` + `ServerBundleArch` re-export（Deliverable 3）
- **8 個 errorCode** 全部覆蓋；`fail()` helper 統一錯誤訊息格式（`"<code>: <human message with field name>"`）便於 T0318 download module 直接顯示給 user
- **SHA256 hex regex**：`/^[a-f0-9]{64}$/`（lowercase only，符合 spec §123）
- **semver regex**：`/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/`（不依賴 `semver` package，符合 spec §122）
- **ISO 8601 buildDate**：`Date.parse() && !Number.isNaN()`（spec §121 寬鬆策略）
- **size 驗證**：`Number.isInteger() && size > 0`（拒絕 0 / 負數 / 浮點 / 字串）
- **`createSha256Stream` 設計**：Transform `_transform` 中 `hash.update(chunk)` 後 `cb(null, chunk)` 原樣 passthrough；`getDigest()` 用 promise queue + cached `resolved`/`rejected` 狀態，呼叫順序不限（end 前後皆可，多次呼叫一致）
- **`compareSha256` timing-safe**：`crypto.timingSafeEqual` + length / format pre-check 防止 timing oracle；非字串 / 長度不符 / format 違規一律回 `false` 不 throw
- **純函數紀律**：lib 檔案 0 處 `process.env`、0 處 `fs.*`、0 處 `fetch`，僅 `node:crypto` + `node:stream` 內建 import（AC-6 ✅）
- **import 改用 `node:` 前綴**：`vite-plugin-electron-renderer` 會把 bare `'stream'` / `'crypto'` shim 成 ESM wrapper（renderer 端用），但 `node:` 前綴在 vitest 跑時也會被該 plugin 攔截；**修法**：`vite.config.ts` 在 `VITEST=true` 時 skip `electron()` 與 `renderer()` plugin（兩者 runtime-only，與 vitest 無關），讓 vitest 拿到原生 Node built-in。註解標 `// see T0317`，影響範圍僅 `npm run test:unit`，build / dev 不受影響

### 2. test 結果

- **case 數**：T0317 新增 **39 cases**（≥30 ✅，AC-2）
  - parseManifest: 21 cases（happy 2 + invalid-json 3 + schema-mismatch 2 + missing-field 4 + invalid-version 2 + invalid-build-date 1 + missing-tarball-arch 2 + invalid-sha256 3 + invalid-size 4）
  - isValidManifest: 5
  - lookupTarball: 2
  - createSha256Stream: 4（hello / empty / multi-chunk / 重複 getDigest）
  - compareSha256: 5
- **8 個 errorCode 覆蓋**（AC-5 ✅）：invalid-json ✅ / schema-version-mismatch ✅ / missing-field ✅ / invalid-version ✅ / invalid-build-date ✅ / missing-tarball-arch ✅（含 arch 名稱在 error message 驗證）/ invalid-sha256-format ✅ / invalid-size ✅
- **AC-4 已知 SHA**：`"hello"` → `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824` ✅；空 stream → `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` ✅
- **`npm run test:unit` 結果**：5 files / **112 passed**（73 既有 + 39 新增）/ duration 3.73s（AC-3 ✅）

### 3. PARTIAL / 矛盾項（如有）

- 無 PARTIAL。
- **vite.config.ts 副作用**：為了讓 vitest 跑通，修改 `vite.config.ts` 在 `VITEST=true` 時關掉 `electron()` 與 `renderer()` plugin。此修改不在原工單範圍但屬必要（純函數 lib 用 Node built-in 是 spec §124 明確指定的實作方式）。已加註解說明，影響面限 vitest，dev / build 不變。
- **既有 tsc 噪音**：`npx tsc --noEmit` 在 `CodexAgentPanel.tsx` 等檔案有大量 pre-existing TS error（與 T0317 無關，未新增也未消除）。新增的 `server-bundle-manifest.ts` 與 test 檔 0 TS error。

### 完成註記

- commit：`a669591`（chore(types): T0317 - PLAN-031 SHA256 manifest validator + stream）
- wall time：~5 min（01:48 → 01:53 UTC+8）
- Full DONE — 所有 AC（1–7）通過。
