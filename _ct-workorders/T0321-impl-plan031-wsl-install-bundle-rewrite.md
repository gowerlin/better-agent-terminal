# T0321 — Impl PLAN-031 WSL install-server-bundle step 改寫（消費 distributor）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0321 |
| 類型 | impl（wizard step rewrite，消費 T0320 distributor） |
| 所屬 | PLAN-031 — Server Bundle Distribution / Sprint 4 |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-27 03:02 (UTC+8) |
| 派發時間 | 2026-04-27 03:02 (UTC+8) |
| Sizing | S（estimate 30-45 min wall） |
| 依賴 | T0320 ✅（distributor 共用模組） |
| 平行 | T0322（SSH install-bundle）+ T0323（Docker install-bundle）— 邏輯獨立但 YOLO 鏈式序列派 |
| 後續 | Sprint 5 dogfood + offline e2e |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget；YOLO 鏈式派發中） |
| Renew 次數 | 0 |
| 工作目錄 | main repo |
| `affects_files` | `src/components/setup-wizard/steps/wsl/install-server-bundle.ts`（重寫） / 可能影響 `src/components/setup-wizard/steps/wsl/index.ts`（step chain） / 可能新增 `src/components/setup-wizard/i18n/wsl.zh-TW.json` 等（progress 文案） |

## 背景

T0313 Phase A.3 盤點 WSL `install-server-bundle.ts:36` 的 placeholder throw：

```
"Server bundle tarball not found in userData/bat-server-bundles. Release download flow lands in T0282."
```

T0282 reference 寫錯（實際是 path translator）。**真正的 distribution flow 由 PLAN-031 Sprint 2-3 補完**：T0316 baseline / T0317 manifest / T0318 download / T0319 arch detect / T0320 distributor。

本工單把 WSL step 從「找硬編碼 tarball 否則 throw」改寫為「呼叫 distributor 取 verified tarball path 後上傳」。

## 塔台已拍板項（不要再問）

| 編號 | 議題 | 決策 |
|------|------|------|
| spec §3 | Distribution 三層 lookup | 由 distributor 處理，step 不關心 source |
| BUG-071 | install-bundle 失敗的 root cause | 本工單修復 |
| BUG-072 | WSL systemd-linger error handling | **不在本工單**（PLAN-032 範疇） |
| BUG-074 | SSH input step shows failed on init | **不在本工單**（PLAN-032 範疇） |

## 範圍（4 deliverable）

### Deliverable 1：`src/components/setup-wizard/steps/wsl/install-server-bundle.ts` 重寫

**移除**：
- 既有 `findBundleInDirectory` inline function
- `^bat-server-linux-x64-v.+\.tar\.gz$` hardcoded regex
- placeholder throw with T0282 reference

**新增**：
- 呼叫 `window.electronAPI.remote.serverBundle.distribute({ profileId, version })`（T0320 IPC）
- 訂閱 `onDistributeProgress(callback)`，將 progress 透過既有 wizard step status update 機制（如 `ctx.setStatus(...)` 或同 wizard step pattern）回報給 UI
- distributor result 為 `{ok:true, tarballPath, source}` → 後續上傳邏輯（既有 `window.electronAPI.wsl.installBundle(...)`）保留
- distributor result 為 `{ok:false, errorCode, error}` → 把 error 直接 throw / set step error，沒有自己的 fallback / retry 邏輯（distributor 已內建）

**新流程**（重寫後 step body）：

```typescript
// pseudocode 結構，實作以 worker 判斷為準
export async function runWslInstallServerBundle(ctx: WizardContext) {
  const profileId = ctx.profile.id
  const version = ctx.batVersion ?? await window.electronAPI.app.getVersion()  // 既有 IPC 若有；否則 worker 探討

  // 訂閱 progress
  const unsubscribe = window.electronAPI.remote.serverBundle.onDistributeProgress(event => {
    if (event.phase === 'tarball') {
      ctx.setStatus({ message: `Downloading server bundle: ${event.percent}%` })
    }
  })

  try {
    const result = await window.electronAPI.remote.serverBundle.distribute({ profileId, version })

    if (!result.ok) {
      throw new InstallBundleError(result.errorCode, result.error)  // 既有 error pattern 或 worker 判斷
    }

    // source 顯示給 user（diagnostic）
    ctx.setStatus({
      message: result.source === 'cache' ? 'Using cached server bundle' :
               result.source === 'baseline' ? 'Using bundled server bundle (offline)' :
               'Downloaded server bundle'
    })

    // 既有上傳邏輯保留
    await window.electronAPI.wsl.installBundle(ctx.profile.wslDistro, result.tarballPath, INSTALL_PATH)
  } finally {
    unsubscribe()
  }
}
```

**精確結構**由 worker 依照既有 step pattern 決定（本工單只規範 contract）。

### Deliverable 2：Step chain 整合（可能改 `wsl/index.ts`）

T0319 工單 §範圍排除「不在 wizard step chain 加 detect-arch step」。本工單**重新檢視**：

- distributor 內部已自動呼叫 `detectRemoteArch`（透過 profileId）
- 所以 wizard chain **不需要新增獨立 detect-arch step**
- 但若既有 chain 結構需要先有 arch 才能跑後續步驟（如 verify-installed）→ 本工單才需要加

Worker 探查既有 `wsl/index.ts` step chain 後決定。預期：**不需新增 step**，distributor 已封裝。

### Deliverable 3：i18n 文案（如有）

若既有 wizard 用 i18n 文案（如 `i18n/wsl.zh-TW.json`），新增以下 key：
- `step.installBundle.distributing` — 正在準備 server bundle
- `step.installBundle.cacheHit` — 使用本機快取
- `step.installBundle.baselineHit` — 使用安裝包內建
- `step.installBundle.downloading` — 下載中（含百分比 placeholder）
- `step.installBundle.uploadingToWsl` — 上傳到 WSL
- `step.installBundle.error.archDetectionFailed` — 偵測 server 架構失敗，請檢查 WSL distro
- `step.installBundle.error.downloadFailed` — 下載失敗，請檢查網路或設定 `BAT_SERVER_BUNDLE_BASE_URL`
- `step.installBundle.error.baselineCorrupted` — 內建 server bundle 損毀，請重新執行 installer

如本專案不用 i18n 檔（直接 hardcode）→ 跳過此 deliverable，文案 inline。

### Deliverable 4：手動測試 / 驗證

**Worker 環境限制**：worktree 在 Windows 跑 → WSL 是真實 backend，但缺 `dist-baseline/` 內建 tarball（T0316 落地但需 fetch script 跑過）。

**驗證方式**（worker 任選一）：
1. **Lint + tsc + 既有 test**：跑 `npm run test:unit` + `npx tsc --noEmit` 對改動檔 0 error
2. **Build sanity**：`npm run build:dir`（如環境支援）→ 確認 wizard 編譯通過
3. **Logic review**：確認 placeholder throw 移除、distributor IPC 呼叫到位、上傳邏輯保留

實際 e2e 跑通留 T0324 / T0325（Sprint 5）。

## 驗收條件

- AC-1：`install-server-bundle.ts` 移除 `findBundleInDirectory` + hardcoded regex + T0282 placeholder throw
- AC-2：呼叫 `window.electronAPI.remote.serverBundle.distribute({ profileId, version })`
- AC-3：訂閱 `onDistributeProgress` 並 unsubscribe（finally / cleanup）
- AC-4：distributor `{ok:false}` 結果轉換為 step error（不自己 retry / fallback）
- AC-5：source diagnostic 顯示給 user（cache / baseline / download 區分）
- AC-6：既有上傳邏輯（`wsl.installBundle`）保留
- AC-7：`npm run test:unit` 全綠（既有 ≥166 tests，本工單可不新增 test）
- AC-8：`npx tsc --noEmit` 對改動檔 0 error
- AC-9：commit 訊息走 `chore(wizard): T0321 - WSL install-bundle step 改寫`

## 範圍排除（不在本工單）

- ❌ 不修 BUG-072（WSL systemd linger error handling，PLAN-032 範疇）
- ❌ 不修 BUG-074（SSH 範疇）
- ❌ 不新增獨立 detect-arch wizard step（distributor 已封裝）
- ❌ 不改 SSH / Docker install-bundle steps（T0322 / T0323 範疇）
- ❌ 不寫 e2e 測試（Sprint 5 範疇）
- ❌ 不擴 verify-auth.ts serverArch 抓取邏輯（T0319 已預留 sshServerArch flat field，等真正寫入時機在 SSH path）

## Worker 守則

1. **重用 distributor**：不自己找 tarball / 不自己 retry / 不自己 SHA verify
2. **child_process 紀律**：本工單 **renderer-side**，無 child_process；CLAUDE.md 原則仍適用
3. **error handling**：distributor 結果 `{ok:false}` 直接傳給既有 step error 顯示機制
4. **progress unsubscribe**：必 cleanup，避免 listener leak
5. **logger**：renderer 端用 `window.electronAPI.debug.log(...)` 不用 `console.log`（CLAUDE.md Logging）
6. **test 紀律**：`npm run test:unit` 全綠，本工單不要求新增 test（純改寫，邏輯由 distributor 模組覆蓋）
7. **TypeScript 紀律**：`npx tsc --noEmit` 對改動檔 0 error
8. **commit 紀律**：單 commit 即可
9. **規範性 scope expansion**：照 T0316/T0317/T0319/T0318/T0320 模式在回報區標「out-of-scope but justified」段落
10. **記憶覆寫**：本工單**沒有** `memory_overrides` 欄位 — 沿用所有現行 GP 規則 + 學習紀錄

## Worker 回報區（Worker 填寫）

### 1. install-server-bundle.ts 重寫摘要

（待填：總行數變化、移除/新增 highlight、distributor 呼叫位置）

### 2. Step chain 整合（如有改動）

（待填：是否動 `wsl/index.ts`、是否新增 step、理由）

### 3. i18n 文案處理

（待填：新增 keys 數量 / 改 hardcode）

### 4. tsc + test 結果

（待填：`npm run test:unit` summary、`tsc --noEmit` 對改動檔的結果）

### 5. PARTIAL / 矛盾項（如有）

（待填）

### 6. Out-of-scope but justified（如有）

（待填）

### 完成註記

（待填）
