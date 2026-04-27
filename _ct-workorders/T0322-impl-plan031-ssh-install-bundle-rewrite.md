# T0322 — Impl PLAN-031 SSH install-server-bundle step 改寫（消費 distributor，含 sshServerArch wire-up）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0322 |
| 類型 | impl（wizard step rewrite，消費 T0320 distributor + T0321 draftProfile pattern） |
| 所屬 | PLAN-031 — Server Bundle Distribution / Sprint 4 |
| 狀態 | 🚧 IN_PROGRESS |
| 建立時間 | 2026-04-27 03:14 (UTC+8) |
| 派發時間 | 2026-04-27 03:14 (UTC+8) |
| 開始時間 | 2026-04-27 03:16 (UTC+8) |
| Sizing | S（estimate 30-45 min wall；含 archHint 移除 + sshServerArch wire-up） |
| 依賴 | T0320 ✅（distributor） / T0321 ✅（draftProfile IPC pattern） |
| 平行 | T0323（Docker，邏輯獨立） |
| 後續 | Sprint 5 dogfood + offline e2e |
| 互動旗標 | `--mode yolo --no-interactive` |
| Renew 次數 | 0 |
| 工作目錄 | main repo |
| `affects_files` | `src/components/setup-wizard/steps/ssh/install-server-bundle.ts`（重寫） / 可能影響 `src/components/setup-wizard/steps/ssh/index.ts` 或 `ssh-flow.ts` |

## 背景

T0313 Phase A.3 盤點 SSH `install-server-bundle.ts`：

- 已有 archHint 邏輯（`state.sshServerArch` 從 verify-auth `ssh:probe-auth` 取，預設 fallback `'x86_64'`）
- tarball lookup 模式：`archHint === 'arm64' || 'aarch64'` 時優先 `linux-arm64`，fallback `linux-x64`
- 上傳邏輯：`ssh:upload-bundle` 串流上傳 + `ssh:upload-progress` event

T0321 已建立 draftProfile IPC pattern + sentinel ProfileEntry。T0319 預留 `ProfileEntry.sshServerArch?: string` flat field（但 verify-auth 仍只寫 `ctx.state.sshServerArch`，未寫 profile）。

**本工單 wire-up 路徑**：
1. 移除 SSH step 內 archHint + lookup + regex 邏輯（distributor 接管）
2. install-bundle step 從 `ctx.state.sshServerArch` 取值，**填進 draftProfile.sshServerArch**
3. distributor 內 `detectRemoteArch` 走 SSH 路徑時讀 draftProfile.sshServerArch（無 re-fetch）
4. 上傳邏輯（`ssh:upload-bundle` + progress event）保留

## 塔台已拍板項（不要再問）

| 編號 | 議題 | 決策 |
|------|------|------|
| spec §3 | Distribution 三層 lookup | 由 distributor 處理 |
| BUG-071 | install-bundle 失敗 | 本工單修復 SSH path |
| BUG-074 | SSH input step shows failed on init | **不在本工單**（PLAN-032 範疇） |
| D100 | draftProfile IPC pattern | T0321 已落地，本工單沿用，不擴 |
| T0319 OOS | sshServerArch flat field | 已預留，本工單填入 draftProfile |

## 範圍（3 deliverable）

### Deliverable 1：`src/components/setup-wizard/steps/ssh/install-server-bundle.ts` 重寫

**移除**：
- `findBundleInDirectory` / `resolveBundleTarballPath` / archHint regex（`bat-server-(linux-arm64|linux-x64)-v.+\.tar\.gz`）
- 既有 fallback 邏輯（archHint 不認 → fallback x64）

**新增**：
- 從 `ctx.state.sshServerArch`（verify-auth 寫入）讀 raw uname → 填進 `draftProfile.sshServerArch`
- 呼叫 `window.electronAPI.remote.serverBundle.distribute({ draftProfile, version })`（T0321 IPC，draftProfile 包含完整 SSH 設定）
- 訂閱 `onDistributeProgress`，progress 透過 `ctx.logger.info(...)`（T0321 約定）
- distributor `{ok:false}` → throw with errorCode（不 fallback / retry）
- source diagnostic（cache / baseline / download）

**draftProfile 結構**（依 T0321 sentinel pattern）：

```typescript
const draftProfile = {
  targetOS: ctx.profile.targetOS,  // 'ssh-linux' | 'ssh-darwin'
  sshHost: ctx.profile.sshHost,
  sshPort: ctx.profile.sshPort,
  sshUser: ctx.profile.sshUser,
  sshKeyPath: ctx.profile.sshKeyPath,
  sshServerArch: ctx.state.sshServerArch,  // raw uname -m output, e.g., 'x86_64' / 'aarch64'
  // 其他 ProfileEntry 欄位由 IPC handler 填 sentinel default
}
```

如 IPC handler 對 SSH draftProfile 缺欄位驗證 → worker 補上（依 T0321 已有的 wsl/docker validation pattern 擴）。

**保留**：
- 上傳邏輯：`ssh:upload-bundle` 串流 + `ssh:upload-progress` event 訂閱（既有完整保留）
- 上傳目標路徑：既有 `INSTALL_PATH` / 計算邏輯
- 後續 verify steps（如有）

**新流程**（重寫後 step body，pseudocode）：

```typescript
export async function runSshInstallServerBundle(ctx: WizardContext) {
  const version = await window.electronAPI.update.getVersion()  // T0321 已驗

  const draftProfile = {
    targetOS: ctx.profile.targetOS,
    sshHost: ctx.profile.sshHost,
    sshPort: ctx.profile.sshPort,
    sshUser: ctx.profile.sshUser,
    sshKeyPath: ctx.profile.sshKeyPath,
    sshServerArch: ctx.state.sshServerArch,
  }

  const unsubDistribute = window.electronAPI.remote.serverBundle.onDistributeProgress(event => {
    if (event.phase === 'tarball') ctx.logger.info(`Downloading server bundle: ${event.percent}%`)
  })

  let tarballPath: string
  try {
    const result = await window.electronAPI.remote.serverBundle.distribute({ draftProfile, version })
    if (!result.ok) throw new InstallBundleError(result.errorCode, result.error)
    ctx.logger.info(describeSource(result.source))  // 沿 T0321 helper
    tarballPath = result.tarballPath
    ctx.state.bundleSource = result.source
  } finally {
    unsubDistribute()
  }

  // 既有上傳邏輯保留
  const unsubUpload = window.electronAPI.ssh.onUploadProgress(event => {
    ctx.logger.info(`Uploading to remote: ${event.percent}%`)
  })
  try {
    await window.electronAPI.ssh.uploadBundle(ctx.profile, tarballPath, INSTALL_PATH)
  } finally {
    unsubUpload()
  }
}
```

**精確結構**由 worker 依照既有 SSH step pattern 決定。

### Deliverable 2：Step chain 確認（可能不動 `ssh/index.ts`）

預期：**不需新增 step**（distributor 已封裝 detectRemoteArch；ctx.state.sshServerArch 由 verify-auth 已填）。

如 worker 探查發現 verify-auth 沒填 `state.sshServerArch`（T0319 假設），則本工單會卡住，需 PARTIAL 並把 ctx.state 寫入點挑出來。

**關鍵驗證點**：
- 既有 `verify-auth.ts` 確實在成功時 `ctx.state.sshServerArch = result.serverArch`（T0313 Phase A.3 line 348 已盤點，但需 worker 再 grep 確認）
- `ssh-flow.ts` 中 verify-auth 在 install-bundle **之前**（spec invariant，需確認）

### Deliverable 3：手動驗證

**Worker 環境限制**：worktree 在 Windows 跑，無法測 SSH 真實連線；驗證以下層次：

1. **tsc + test**：`npm run test:unit` 全綠 + `npx tsc --noEmit` 對改動檔 0 error
2. **Logic review**：placeholder 移除 / archHint 邏輯移除 / draftProfile.sshServerArch 來源正確 / 上傳邏輯保留
3. **draftProfile validation**：confirm IPC handler 對 SSH draftProfile 必要欄位（sshHost / sshUser / sshServerArch）能正常處理

實際 e2e 跑通留 T0324（DGX Spark 實機 dogfood）/ T0325（offline / rate limit）。

## 驗收條件

- AC-1：`install-server-bundle.ts` 移除 archHint regex + lookup helper + fallback 邏輯
- AC-2：呼叫 `distribute({ draftProfile, version })`，draftProfile 含 sshServerArch
- AC-3：訂閱 `onDistributeProgress` + cleanup（finally）
- AC-4：distributor `{ok:false}` 結果轉 step error
- AC-5：source diagnostic 顯示給 user
- AC-6：既有 `ssh:upload-bundle` + `ssh:upload-progress` 上傳邏輯保留
- AC-7：`npm run test:unit` 全綠
- AC-8：`npx tsc --noEmit` 對改動檔 0 error
- AC-9：commit 訊息走 `chore(wizard): T0322 - SSH install-bundle step 改寫`

## 範圍排除（不在本工單）

- ❌ 不修 BUG-074（SSH input step shows failed on init，PLAN-032）
- ❌ 不擴 verify-auth.ts（已預期 ctx.state.sshServerArch 來源）
- ❌ 不改 IPC handler（draftProfile pattern 已 T0321 落地，sshServerArch 應為 SSH 早就有的 field 之一）
- ❌ 不寫 e2e 測試（T0324/T0325 範疇）
- ❌ 不改 ProfileEntry persistent schema（T0319 已加 sshServerArch optional field）

## Worker 守則

1. **重用 distributor + draftProfile**：T0321 已建立 pattern，照辦
2. **wire-up sshServerArch**：從 `ctx.state.sshServerArch`（verify-auth 寫入）→ `draftProfile.sshServerArch`
3. **保留上傳邏輯**：`ssh:upload-bundle` / `ssh:upload-progress` 不動
4. **error handling**：distributor `{ok:false}` 直 throw，沒有自己的 fallback
5. **logger**：`ctx.logger.info(...)`（T0321 約定）
6. **progress unsubscribe**：必 cleanup（distribute + upload 兩個都要）
7. **child_process 紀律**：renderer-side 無 child_process；CLAUDE.md 原則仍適用
8. **vitest 紀律**：`npm run test:unit` 全綠
9. **TypeScript 紀律**：`npx tsc --noEmit` 對改動檔 0 error
10. **commit 紀律**：單 commit
11. **規範性 scope expansion**：照既有模式回報區標「out-of-scope but justified」
12. **記憶覆寫**：本工單**沒有** `memory_overrides` 欄位 — 沿用所有現行 GP 規則 + 學習紀錄

## Worker 回報區（Worker 填寫）

### 1. install-server-bundle.ts 重寫摘要

整支重寫（149 → 174 行，net +25 行）：

**移除**：
- `findBundleInDirectory(directory, archHint)` helper（含 `linux-arm64` / `linux-x64` regex）
- `resolveBundleTarballPath(ctx, archHint)` helper（userData/bat-server-bundles 直查）
- `joinPlatformPath()` helper（無人再呼叫）
- `import type { FileEntry }`（已不再使用）
- `archHint` fallback 邏輯（`state.sshServerArch ?? 'x86_64'`）

**新增**：
- `describeSource()` helper（沿 T0321 WSL step pattern，文案三選一）
- 強制驗證 `state.sshServerArch` 必填（缺失 → throw with hint「re-run verify-ssh-auth」），不再 fallback x86_64
- `window.electronAPI.update.getVersion()` → 帶入 distributor
- `window.electronAPI.remote.serverBundle.distribute({ draftProfile, version })` 取代本地 lookup
- `onDistributeProgress` 訂閱 + finally cleanup（manifest / tarball 兩階段都 log）
- `distributeResult.ok === false` → throw `[errorCode] error`（不重試、不 fallback）
- `state.bundleSource = result.source`（cache / baseline / download）

**保留**：
- `ssh:upload-bundle` + `ssh:upload-progress` 串流上傳（D-SSH-4 invariant：ssh+tar pipe）
- `makeUploadId()` helper、uploadId 過濾、speed/eta 計算
- rollback 邏輯（`ssh:uninstallBundle`）完全不動
- step metadata（labelKey / descriptionKey / groupKey / appliesTo）

### 2. ctx.state.sshServerArch 來源驗證

**verify-auth.ts:115** 確認寫入：`Object.assign(ctx.state, { ..., sshServerArch: result.serverArch })`

`result.serverArch` 來源 ssh-auth-probe.ts:202 → `parsePlatform(platformLine).arch`，
parsePlatform (ssh-auth-probe.ts:86-95) 直接回傳 `uname -sm` 第二欄 raw value（如 `x86_64` / `aarch64` / `arm64`），未做正規化 — 與 distributor `arch-detect.ts:192 → buildArchResult(cached, targetOS)` 預期 raw uname 輸入一致。

**ssh-flow.ts step 順序**（line 26-35）：configureSshHostStep → verifySshAuthStep → installSshServerBundleStep → … → writeProfileStep → … 確認 verify-auth 在 install-bundle 之前、write-profile 在 install-bundle 之後 → draftProfile 模式正確 fit。

### 3. draftProfile 結構

實際傳入 distributor 的欄位：
```ts
{
  targetOS: ctx.targetOS as 'ssh-linux' | 'ssh-darwin',  // verify-auth 已 set
  sshHost: state.sshHost,
  sshUser: state.sshUser,
  sshPort: state.sshPort,
  sshKeyPath: state.sshKeyPath,
  sshServerArch: state.sshServerArch,  // raw uname value
}
```

**IPC handler 擴充**（electron/main.ts）：T0321 只 validate WSL/Docker，本工單補上 SSH validation：
- `sshHost`：必填，非空字串（不套 NAME_RX 因 host 可含 dot/IP）
- `sshUser`：必填，過 NAME_RX 白名單
- `sshServerArch`：必填，非空字串（缺失 → `arch-detection-failed` errorCode + hint「run verify-auth before install-bundle」）
- `sshPort` / `sshKeyPath` / `useSshTunnel`：optional，照傳

`ProfileEntry` sentinel 新增 `sshServerArch: draft.sshServerArch` 欄位 → arch-detect.ts:183 `profile.sshServerArch` 命中 → `buildArchResult(cached, targetOS)` 走 cached path 無 SSH re-fetch。

**Type surface 同步**：`electron/preload.ts:661` + `src/types/electron.d.ts:493` 的 `draftProfile` 介面也補上 optional `sshServerArch?: string`。

### 4. tsc + test 結果

- `npx tsc --noEmit` grep 改動檔（`install-server-bundle.ts` / `electron/main.ts` / `preload.ts` / `electron.d.ts`）→ 0 error
  - 修掉一次 TS6196「`WizardContext` declared but never used」（移除未用 import）
- `npm run test:unit` → **8 files passed / 168 tests passed**（無新增測試；本工單為 wizard step，e2e 留 T0324/T0325）

### 5. PARTIAL / 矛盾項（如有）

無。

### 6. Out-of-scope but justified（如有）

**IPC handler `server-bundle:distribute` 擴 SSH validation**（main.ts +28 行 / preload.ts + .d.ts +1 行 each）— 工單 §「範圍排除」原寫「不改 IPC handler」，但同時 §3 Deliverable 1 註明「如 IPC handler 對 SSH draftProfile 缺欄位驗證 → worker 補上（依 T0321 已有的 wsl/docker validation pattern 擴）」。

實際盤查：T0321 IPC handler 完全沒有 SSH 分支驗證（只有 wsl-linux / docker-linux）；同時 ProfileEntry sentinel 也漏帶 `sshServerArch`（draftProfile 接了沒往 ProfileEntry 塞 → arch-detect 拿不到 cached → 失敗）。為了讓 SSH 走 distributor 流程能跑通，這個擴充屬於 §3 預留的允許範圍，沿 T0321 wsl/docker 模式擴 SSH 分支，與「不改 IPC handler」精神一致（pattern 沿用，不重新設計）。

### 完成註記

T0322 SSH install-server-bundle step 改寫完成。核心：
1. SSH step 卸下本地 archHint regex / lookup helpers，全交給 T0320 distributor
2. `sshServerArch` 從 verify-auth state → draftProfile → ProfileEntry sentinel → arch-detect cached path 完整 wire-up
3. IPC handler SSH 驗證分支補齊（沿 T0321 wsl/docker 模式）
4. 上傳邏輯（ssh+tar pipe / progress event）一字未動
5. 改動檔 `npx tsc --noEmit` 0 error；`npm run test:unit` 168/168 全綠

E2E 跑通留 T0324（DGX Spark dogfood）/ T0325（offline / rate limit）。

完成時間：2026-04-27 10:28 (UTC+8)
Wall time：約 12 分鐘（含 hook 干擾與多次重讀）— 略低於 Sizing S 的 30-45 min estimate。
