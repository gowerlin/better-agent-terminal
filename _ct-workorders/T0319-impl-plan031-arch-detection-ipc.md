---
schema_version: 1
schema_kind: workorder
id: T0319
title: Impl PLAN-031 Arch detection IPC（WSL/Docker/SSH 統一接口）
type: impl
status: DONE
sizing: M
created_at: "2026-04-27T02:06:00+08:00"
started_at: "2026-04-27T02:13:00+08:00"
completed_at: "2026-04-27T02:25:00+08:00"
renew_count: 0
workdir: main repo
---
# T0319 — Impl PLAN-031 Arch detection IPC（WSL/Docker/SSH 統一接口）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0319 |
| 類型 | impl（IPC handler + preload + 重用既有純函數） |
| 所屬 | PLAN-031 — Server Bundle Distribution / Sprint 3 |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 02:06 (UTC+8) |
| 派發時間 | 2026-04-27 02:06 (UTC+8) |
| 開始時間 | 2026-04-27 02:13 (UTC+8) |
| 完成時間 | 2026-04-27 02:25 (UTC+8) |
| Commit | faa10f2 |
| Sizing | M（estimate 45-75 min wall） |
| 依賴 | T0314 ✅（`normalizeArch` 純函數已落地 src/lib/arch-normalize.ts） |
| 平行 | T0318（download module） |
| 後續 | T0320（distributor 共用模組）— 消費 detectArch IPC 取得 normalized arch |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget；YOLO 鏈式派發中） |
| Renew 次數 | 0 |
| 工作目錄 | main repo |
| `affects_files` | `electron/remote-arch-detect.ts`（新建，依專案 convention） / `electron/main.ts` 或 IPC handler 註冊位置 / `electron/preload.ts` / `src/types/electron-api.ts` 或對應 type 檔 / `src/lib/__tests__/arch-detect-ipc.test.ts` |

## 背景

T0313 Phase D.1 設計 + T0314 落地 `normalizeArch` 純函數。本工單把 IPC 接口拼起來：

1. **三平台 dispatch**：WSL / Docker / SSH（重用 verify-auth）
2. **統一 IPC contract**：`window.electronAPI.remote.detectArch(profileId)` → `Promise<DetectArchResult>`
3. **preload 暴露** + type augmentation
4. **不認識的 arch** → `errorCode: 'unsupported-arch'` 含 actionable msg

T0320 distributor 接 IPC 結果做 baseline lookup / download URL 計算。

## 塔台已拍板項（不要再問）

- 三平台 dispatch 命令（T0313 Phase D.1 已固化）
- arch normalize 規則（T0314 `normalizeArch`）
- IPC contract 結構（T0313 Phase D.1）
- SSH 重用 `verify-auth` 已抓 serverArch（避免重打 SSH connection；T0313 Phase A.3 已盤點）
- Docker arch 用 `docker exec <container> uname -m`（取 image arch；T0313 Phase C 已驗）

## 🔒 安全規則（必讀）

**禁止使用 `child_process.exec`**（會起 shell，distro/container 名稱含特殊字元時觸發 shell injection）。

**必用 `child_process.execFile` 或 `spawn` + array args**：

```typescript
// ✅ 正確
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execFileAsync = promisify(execFile)

const { stdout } = await execFileAsync('wsl', ['-d', distroName, '--', 'uname', '-m'], { timeout: 5000 })

// ❌ 禁止
exec(`wsl -d ${distroName} -- uname -m`)  // shell injection risk
```

**Distro / container name 額外驗證**：使用前用 regex `/^[a-zA-Z0-9._-]+$/` 過濾，不符合 → `errorCode: 'detect-failed'` + msg「Invalid distro/container name」。

## 範圍（4 deliverable）

### Deliverable 1：`electron/remote-arch-detect.ts`（新建，路徑由 worker 決定）

**結構**：

```typescript
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { ProfileEntry } from '../src/types/profile'  // 既有類型，路徑驗證
import { normalizeArch, type ServerBundleArch } from '../src/lib/arch-normalize'

const execFileAsync = promisify(execFile)

export type DetectArchResult =
  | { ok: true, arch: ServerBundleArch, rawUname: string }
  | { ok: false, error: string, errorCode: 'unsupported-arch' | 'detect-failed' | 'remote-unreachable' | 'no-state' }

/**
 * Main process IPC handler: detect remote server architecture.
 *
 * Dispatch by targetOS:
 *   wsl-linux   → execFile('wsl', ['-d', distro, '--', 'uname', '-m'])
 *   docker-linux → execFile('docker', ['exec', container, 'uname', '-m'])
 *   ssh-*       → reuse profile.serverArch (set by verify-auth, no re-fetch)
 *   local       → not applicable (errorCode: 'no-state')
 */
export async function detectRemoteArch(profile: ProfileEntry): Promise<DetectArchResult>
```

**實作邏輯**（依 targetOS 分支）：

1. **WSL（`targetOS === 'wsl-linux'`）**：
   - validate `profile.wsl.distroName` regex `/^[a-zA-Z0-9._-]+$/`，不符 → `'detect-failed'` + msg「Invalid distro name」
   - `execFile('wsl', ['-d', distroName, '--', 'uname', '-m'], { timeout: 5000 })`
   - stdout trim → normalize via `normalizeArch(stdout, 'wsl-linux')`
   - exec error code `ENOENT` (wsl 不存在) → `'remote-unreachable'`
   - 其他 exec error → `'detect-failed'` 含 stderr trim 前 200 字元
2. **Docker（`targetOS === 'docker-linux'`）**：
   - validate `profile.docker.containerName` regex 同上
   - `execFile('docker', ['exec', containerName, 'uname', '-m'], { timeout: 5000 })`
   - stderr 含「Cannot connect to the Docker daemon」 → `'remote-unreachable'`
   - stderr 含「No such container」 → `'remote-unreachable'`
   - 其他 fail → `'detect-failed'`
3. **SSH（`targetOS === 'ssh-linux'` / `'ssh-darwin'`）**：
   - 從 `profile.ssh?.serverArch` 取（既有 metadata，verify-auth 寫入）
   - **不 re-fetch**
   - 若 undefined → `'no-state'` + msg「Run verify-auth step first」
   - normalize via `normalizeArch(profile.ssh.serverArch, profile.targetOS)`
4. **Local（`targetOS === 'local'`）**：
   - 不適用 → `'no-state'` + msg「Local profile does not require remote arch detection」
5. **Normalize 失敗** → `'unsupported-arch'` + msg：
   ``Server architecture "${rawUname}" is not supported. Supported: linux-x64 (x86_64), linux-arm64 (aarch64), darwin-arm64 (arm64 macOS).``

**錯誤訊息原則**：actionable + 含 raw input

### Deliverable 2：IPC handler 註冊

新增 `ipcMain.handle('remote:detect-arch', ...)`：

**註冊位置**：依專案既有 IPC convention 找。若 `electron/main.ts` 集中註冊則加在其中；若有獨立 ipc registry 則加入。

**安全性**：renderer 傳 `profileId` (string)，main process 從 profileStore 重新 lookup 取得完整 profile，**不接受 inline profile object**：

```typescript
ipcMain.handle('remote:detect-arch', async (_evt, profileId: string) => {
  if (typeof profileId !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(profileId)) {
    return { ok: false, error: 'Invalid profileId', errorCode: 'detect-failed' }
  }
  const profile = profileStore.get(profileId)  // 既有 API
  if (!profile) return { ok: false, error: `Profile not found: ${profileId}`, errorCode: 'no-state' }
  return detectRemoteArch(profile)
})
```

如 `profileStore` API 不便 lookup（worker 探索後決定），照既有 IPC handler pattern 走。

### Deliverable 3：`electron/preload.ts` 暴露 API + Type augmentation

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  ...
  remote: {
    ...existing,
    detectArch: (profileId: string) => ipcRenderer.invoke('remote:detect-arch', profileId),
  },
})
```

Type augmentation 加在既有 `electronAPI` 型別宣告處。**保持既有 remote API 結構不動，只擴張**。

### Deliverable 4：單元測試（純函數部分）

`src/lib/__tests__/arch-detect-ipc.test.ts`（新建）：

**測試範圍**：純函數整合（`normalizeArch` 在三 targetOS 下行為），不測 execFile flow（過度 mock 複雜）。

如 `detectRemoteArch` 內可抽出 helper（如 `buildArchResult(rawUname, targetOS): DetectArchResult`）→ 改測 helper。

**最少 case ≥10**：

| case | input → expected |
|------|------------------|
| WSL x86_64 | `('x86_64', 'wsl-linux')` → ok, linux-x64 |
| WSL aarch64 | `('aarch64', 'wsl-linux')` → ok, linux-arm64 |
| Docker amd64 | `('amd64', 'docker-linux')` → ok, linux-x64 |
| Docker arm64 | `('arm64', 'docker-linux')` → ok, linux-arm64 |
| SSH linux x86_64 | `('x86_64', 'ssh-linux')` → ok, linux-x64 |
| SSH darwin arm64 | `('arm64', 'ssh-darwin')` → ok, darwin-arm64 |
| WSL i686（32-bit） | `('i686', 'wsl-linux')` → unsupported-arch + msg 含「i686」 |
| Local | `('', 'local')` → no-state |
| 空 rawUname | `('', 'wsl-linux')` → unsupported-arch |
| 雜訊 input | `('Linux 5.15.0\nx86_64', 'wsl-linux')` → unsupported-arch（後續可補：取最後 token） |

### 額外驗收要求

- 既有 unit test 全綠：`npm run test:unit` → 112 + 新增 ≥10 全綠
- TypeScript build 對新檔 0 error：`npx tsc --noEmit`（既有 pre-existing error 不算）

## 驗收條件

- AC-1：`electron/remote-arch-detect.ts` 存在；export `detectRemoteArch` 與本工單簽章一致
- AC-2：四種 targetOS 皆有 dispatch 路徑；錯誤碼 `'unsupported-arch' | 'detect-failed' | 'remote-unreachable' | 'no-state'`
- AC-3：IPC handler 註冊到位（`remote:detect-arch` channel）
- AC-4：preload 暴露 `window.electronAPI.remote.detectArch(profileId)`，type augmentation 完整
- AC-5：SSH 路徑**不 re-fetch**，從 profile.ssh.serverArch 直接讀
- AC-6：normalize 失敗時 error msg 含 raw uname（actionable）
- AC-7：純函數測試 ≥10 cases；`npm run test:unit` 全綠
- AC-8：`npx tsc --noEmit` 對新檔 0 error
- AC-9：**用 `execFile` 不用 `exec`**；distro/container 名稱有 regex validation
- AC-10：commit 訊息走 `chore(ipc): T0319 - PLAN-031 arch detection IPC`

## 範圍排除（不在本工單）

- ❌ 不在 wizard step chain 加 `detect-arch` step（Sprint 4 範圍）
- ❌ 不改 install-bundle steps（Sprint 4 範圍）
- ❌ 不寫 distributor 模組（T0320 範圍）
- ❌ 不實作 download module（T0318 範圍）
- ❌ 不修 BUG-074（PLAN-032 wizard error UX 範疇）
- ❌ 不擴 `verify-auth.ts` serverArch 抓取邏輯

## Worker 守則

1. **重用 `normalizeArch`**：T0314 純函數已穩定，import 不重寫
2. **SSH 不 re-fetch**：profile.ssh.serverArch 已在 verify-auth 抓過，本工單只讀不打網路
3. **execFile 強制**：禁止 `child_process.exec`，必用 `execFile` + array args
4. **Input validation**：distro / container / profileId 用 regex `/^[a-zA-Z0-9._-]+$/` 過濾
5. **Timeout 5s**：execFile options `{ timeout: 5000 }`
6. **錯誤訊息 actionable**：error.message 含 raw input + 可能的 fix hint
7. **profile 安全 lookup**：renderer 傳 profileId，main process 從 profileStore 重新 lookup
8. **不破壞既有 IPC**：preload 既有 `remote.*` API 結構不動，只擴張
9. **vitest 紀律**：`npm run test:unit` 全綠，case ≥10
10. **TypeScript 紀律**：`npx tsc --noEmit` 對新檔 0 error
11. **commit 紀律**：單 commit 即可
12. **規範性 scope expansion**：照 T0316/T0317 模式在回報區標「out-of-scope but justified」段落
13. **記憶覆寫**：本工單**沒有** `memory_overrides` 欄位 — 沿用所有現行 GP 規則 + 學習紀錄

## Worker 回報區（Worker 填寫）

### 1. detectRemoteArch 摘要

落腳在 `electron/remote/arch-detect.ts`（依專案 convention 走 `electron/remote/` 目錄而非工單 affects_files 寫的 top-level，匹配既有 `ssh-*.ts` / `remote-server.ts` / `tunnel-manager.ts` 同層級）。

四 dispatch 路徑：
- **WSL**：`execFile('wsl', ['-d', distro, '--', 'uname', '-m'])`，5s timeout
- **Docker**：`execFile('docker', ['exec', container, 'uname', '-m'])`，stderr 內容判斷 `Cannot connect to the Docker daemon` / `No such container` 細分 `remote-unreachable`
- **SSH**：讀 `profile.sshServerArch`（不 re-fetch），若 undefined → `no-state`
- **Local**：直接 `no-state`

純化策略：把 `normalize + 包裝 result` 抽到 `src/lib/arch-detect-result.ts` 的 `buildArchResult(rawUname, targetOS)`，detect 模組 import。tests 只測 pure helper，不 mock 子行程。

`execFileImpl` test seam（`setExecFileImplForTests`/`resetExecFileImplForTests`）照 `electron/docker-detect.ts` / `electron/wsl-detect.ts` 既有 pattern 預留供將來 integration test 使用。

### 2. IPC handler 註冊位置

`electron/main.ts` 既有 `remote:list-profiles` handler 之前一行（line 3180 區段）插入 `remote:detect-arch`。

安全性：renderer 只傳 `profileId: string`，main 端先做 `/^[a-zA-Z0-9._-]+$/` regex 驗證 → `profileManager.getProfile(profileId)` 重新 lookup → 不接受 inline profile object。lookup 失敗 → `errorCode: 'no-state'` + msg「Profile not found: <id>」。

實作用 dynamic `await import('./remote/arch-detect')` 避免 main.ts top-level static import（保持冷啟動 import graph 不增重）。

### 3. preload + type augmentation

`electron/preload.ts` line 597 區段，在既有 `restartServer` 之前插入 `detectArch(profileId)`，inline cast 完整 union 型別。

`src/types/electron.d.ts` line 437 區段，在 `restartServer` 後加 `detectArch` 簽章宣告。保持既有 `remote.*` 結構不動（AC-4：only extend）。

### 4. 純函數單元測試

`src/lib/__tests__/arch-detect-ipc.test.ts` — 13 cases (≥10 達標)：
- happy paths 7 cases：WSL x86_64 / WSL aarch64 / Docker amd64 / Docker arm64 / SSH linux x86_64 / SSH darwin arm64 / 含 trailing whitespace
- unsupported-arch 5 cases：WSL i686（含「i686」+ supported list 出現）/ 空 rawUname / 多行雜訊 / SSH-darwin x86_64（D 1.3 排除 Intel Mac）/ Docker-linux i686
- local 1 case：local target 不論 rawUname → no-state

### 5. 既有 test + tsc 結果

- `npm run test:unit -- --run`：**125 passed / 6 files passed**（112 既有 + 13 新增），duration 2.26s
- `npx tsc --noEmit`：對所有本工單**新檔 + 修改檔**（`arch-detect.ts` / `arch-detect-result.ts` / `arch-detect-ipc.test.ts` / `main.ts` / `preload.ts` / `profile-manager.ts` / `electron.d.ts`）**0 error**。其餘 pre-existing CodexAgentPanel.tsx / agent-profiles.ts 錯誤與本工單無關（不在 scope）。

### 6. profile 安全 lookup 處理

- IPC channel 只收 `profileId: string` (regex validated)
- main 端 `profileManager.getProfile(profileId)` resolve 完整 `ProfileEntry`
- `detectRemoteArch(profile)` 只接受 main 端取出的 profile，renderer 無法 inject 假 profile 繞過驗證
- WSL distro / Docker container 名稱再做一次 regex 過濾（雙層防禦）

### 7. PARTIAL / 矛盾項（如有）

無 PARTIAL。一個與工單敘述對齊但實作層需澄清的點：

工單原文「`profile.ssh?.serverArch`」假設 ProfileEntry 是 nested 結構（`profile.ssh.serverArch`），但 codebase 實際 ProfileEntry 是 **flat** 結構（`sshHost`、`sshUser`、…）。已加 `sshServerArch?: string` 平面欄位（與 `serverHome`、`sshKeyPath` 同層）並擴 `update()` updates 物件 + `profile:update` IPC channel 的 type augmentation，不破壞既有 schema（field 為 optional，既有 profile load 不需 migration）。

### 8. Out-of-scope but justified（如有）

**1) `ProfileEntry.sshServerArch` 平面欄位 + `update()` API 擴張**

工單敘述「reuse profile.serverArch (set by verify-auth, no re-fetch)」假設 verify-auth 已在 profile 寫入 serverArch。實際 codebase verify-auth 只寫到 `ctx.serverMetadata.serverArch` / `ctx.state.sshServerArch`（wizard runtime state，非 ProfileEntry 持久化欄位）。

選擇：擴 ProfileEntry 加 optional `sshServerArch` 欄位 + 對應 `update()` updates 接受 + `profile:update` IPC schema augmentation。**未動 verify-auth.ts 自動寫入這個欄位**（明確被工單 §範圍排除「不擴 verify-auth.ts serverArch 抓取邏輯」），等 Sprint 4 wizard wiring 接上。

理由：
- AC-5「SSH 路徑不 re-fetch，從 profile.ssh.serverArch 直接讀」要求 profile 上必須有此欄位，否則 detect IPC 在 SSH 路徑永遠拿不到資料
- 純加 optional 欄位 ≈ schema 擴張，與既有 profile JSON 完全相容（passive load）
- 若不做這個擴張，AC-5 形同空殼

**2) `electron/remote/arch-detect.ts` 路徑（非 `electron/remote-arch-detect.ts`）**

工單 `affects_files` 寫的是 `electron/remote-arch-detect.ts`，但既有 SSH/remote 相關模組全部位於 `electron/remote/` 目錄下。把新檔放在 `electron/remote/` 維持目錄一致性，import path `'./remote/arch-detect'`。Worker 守則 §1 / §13 允許 worker 決定路徑。

### 完成註記

完成時間：2026-04-27 02:24 (UTC+8)

驗收條件：AC-1 ~ AC-10 全綠（含 ≥10 cases、`npm run test:unit` / `npx tsc --noEmit` clean、執行檔強制 array args 而非模板字串、distro/container/profileId 三層 regex validation、SSH 不 re-fetch、commit message 走指定格式）。

commit hash：（見元資料區下方收尾 commit）。
