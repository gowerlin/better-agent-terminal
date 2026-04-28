---
schema_version: 1
schema_kind: workorder
id: T0270
title: impl-plan007-remoteclient-middleware-auth-metadata
type: impl
status: DONE
created_at: "2026-04-26T01:12:00+08:00"
renew_count: 0
---
# T0270-impl-plan007-remoteclient-middleware-auth-metadata

## 元資料
- **工單編號**：T0270
- **任務名稱**：PLAN-007 Phase 1 第三張 — `RemoteClient` translator middleware（invoke + onEvent）+ `auth-result.serverPlatform` metadata schema + server emit
- **狀態**：DONE
- **建立時間**：2026-04-26 01:12 (UTC+8)
- **類型**：impl（production code，含整合測試）
- **互動模式**：disabled（fire-and-forget；scope 已被 spec doc §2.2 / §2.4 / T0264 §2 凍結）
- **Renew 次數**：0
- **預估 wall time**：8-16h（L sizing；參考 T0269 實際 14 min，spec-frozen + codebase-fit 條件下可能 30-60 min）
- **預估 context cost**：中-高（讀 RemoteClient / RemoteServer / protocol.ts + 寫 middleware + metadata + 整合測試）
- **關聯**：
  - 母 PLAN：PLAN-007（📋 PLANNED）
  - Spec 依據：
    - `_ct-workorders/_spec-remote-dev-support-2026-04.md` §2.2（PathTranslator 框架）
    - 同 spec §2.4（`auth-result.serverPlatform` metadata 凍結結構）
    - `_ct-workorders/T0264-research-plan007-cross-env-abstractions.md` §2 lines 419-454（RemoteClient middleware pseudocode + PATH_AWARE/RETURNING channel set 定義）
  - 前序：
    - T0268（✅ DONE，targetOS schema，commit `81f58d3`）
    - T0269（✅ DONE，PathTranslator interface + Identity + factory + contract test，commit `dec6184`）
  - 後續：
    - T0273 WslPathTranslator、T0277 DockerPathTranslator、T0282 SshPathTranslator 接 factory switch
    - Phase 2 Setup wizard `connect-test` step 收 metadata
  - **D089 worktree 策略**：本工單在 `../bat-plan-007` worktree 內執行，**禁止寫主線**
- **affects_files**（**worktree** `../bat-plan-007` 內，**不是主線**）：
  - 改 `electron/remote/client.ts`（或 `remote-client.ts`，看 codebase 命名）— 加 translator middleware（invoke + onEvent）
  - 改 `electron/remote/server.ts`（或對應 server 檔）— auth handshake 階段 emit `AuthResultMetadata`
  - 改 `electron/remote/protocol.ts`（或 protocol/types 檔）— `AuthResultMetadata` interface + `auth-result.result` 型別擴成 `true | AuthResultMetadata`
  - 新增 `electron/remote/path-aware-channels.ts`（或併入 `path-translator.ts`）— `PATH_AWARE_CHANNELS` / `PATH_RETURNING_CHANNELS` 兩 Set + `normalizePathsInResult` helper
  - 新增/擴 `tests/remote-client-middleware.test.ts`（mock translator，驗 invoke 翻譯 + onEvent 翻譯 + path-returning result normalize）
  - 新增/擴 `tests/auth-result-metadata.test.ts`（schema 編譯型別 + server emit + client 收 metadata 後選 translator）
  - 主線（**禁止寫入**）：僅本工單檔回報區可在主線更新

---

## D089 worktree 工作守則

**本工單為 PLAN-007 Phase B 第三張，沿用 T0268/T0269 worktree 模式**：

1. **cd 到 worktree**：`cd /d/ForgejoGit/BMad-Guide/better-agent-terminal/bat-plan-007`
2. **base commit**：`dec6184`（T0269 DONE）on `feature/plan-007-remote-dev`
3. **commit 全部到 `feature/plan-007-remote-dev` 分支**
4. **絕對禁止**：
   - 切回主線改檔
   - push 到 origin
   - 在主線目錄下做 source code 修改
5. **本工單檔元資料更新**：Worker 完成後更新 worktree 內本工單檔狀態 → DONE 記 commit hash；**主線本工單檔由塔台同步**

---

## 任務目標

### 1. `PATH_AWARE_CHANNELS` / `PATH_RETURNING_CHANNELS` 兩 Set（spec §2.2 / T0264 §2 凍結）

新增 `electron/remote/path-aware-channels.ts`（或併入 `path-translator.ts`）：

```typescript
/** Client → Server：args 內的字串路徑要先 toServer() */
export const PATH_AWARE_CHANNELS = new Set<string>([
  'fs:readdir', 'fs:readFile', 'fs:stat', 'fs:search', 'fs:watch', 'fs:unwatch',
  'git:diff', 'git:diff-files', 'git:status', 'git:getRoot',
  'pty:create',                                  // cwd 參數
  'workspace:save', 'workspace:load',
  'image:read-as-data-url',
])

/** Server → Client：result 含路徑欄位要 toClient() */
export const PATH_RETURNING_CHANNELS = new Set<string>([
  'fs:readdir', 'fs:stat', 'fs:search',
  'git:status', 'git:diff-files', 'git:getRoot',
  'pty:get-cwd',
])
```

> Channel 名稱以**現有 codebase 實際使用的字串為準**。Worker 啟動時先 grep `electron/handlers/` + `electron/remote/` 比對校正；spec 列表是 T0264 推測，若實際命名不同（如 `fs:readDir` camelCase），以 codebase 為準。
> 校正後若有差異，記在「遇到的問題 / 決策」並更新 channel set。

### 2. `normalizePathsInResult` helper

server 回傳的 result 可能是物件、陣列、巢狀結構（如 `fs:readdir` 回 `Array<{ name, path, isDir }>`、`fs:stat` 回 `{ path, size, mtime }`）。需有 helper 走訪結果中的 path 欄位翻譯。

**保守策略**：
- 認 known shape：對 `fs:readdir`/`fs:stat`/`git:status`/`git:getRoot`/`pty:get-cwd` 等個別 channel 寫 narrow 翻譯 function（避免誤翻 non-path 字串）
- 不認的 channel 不翻

```typescript
function normalizePathsInResult(channel: string, result: unknown, translator: PathTranslator): unknown {
  switch (channel) {
    case 'fs:readdir':
      // result: Array<{ name: string; path: string; isDir: boolean }>
      ...
    case 'fs:stat':
      // result: { path: string; ... } | null
      ...
    case 'git:status':
      // result: { staged: Array<{ path }>, unstaged: ... }
      ...
    case 'pty:get-cwd':
      // result: string | null
      ...
    default:
      return result   // 未認的 channel 不翻（fail-safe）
  }
}
```

> 實際 result shape 以 codebase 為準。Worker 讀對應 handler 的 return type 後寫對。

### 3. `RemoteClient` translator middleware

讀 `electron/remote/client.ts`（或對應檔），在 `invoke()` 與 `onEvent()` 兩處加 middleware：

```typescript
class RemoteClient {
  private translator: PathTranslator = new IdentityTranslator()

  // 連線成功 + auth 後呼叫，依 metadata 切 translator
  setTranslator(t: PathTranslator) {
    this.translator = t
  }

  async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    // C → S 翻譯
    if (PATH_AWARE_CHANNELS.has(channel)) {
      args = args.map(a => typeof a === 'string' ? this.translator.toServer(a) : a)
    }
    const result = await this.send({ type: 'invoke', channel, args })
    // S → C 翻譯
    return PATH_RETURNING_CHANNELS.has(channel)
      ? normalizePathsInResult(channel, result, this.translator)
      : result
  }

  // server emit event 時翻譯（fs:changed payload.path）
  private onEvent(channel: string, payload: unknown) {
    if (channel === 'fs:changed' && payload && typeof payload === 'object') {
      const p = payload as { path?: string }
      if (typeof p.path === 'string') {
        payload = { ...p, path: this.translator.toClient(p.path) }
      }
    }
    this.emit(channel, payload)
  }
}
```

> `setTranslator` 由 auth-result handler 呼叫（看 metadata 決定要 IdentityTranslator 或哪個 per-OS）。
> Phase 1 階段 `createTranslator` 對 wsl/docker/ssh throw（T0269 已實作），所以 `setTranslator` 收到非 local profile 仍會 fallback Identity（catch throw → 繼續用 default Identity，並 log warn）。

### 4. `AuthResultMetadata` schema（spec §2.4 凍結）

修改 `electron/remote/protocol.ts`（或對應 protocol/types 檔）：

```typescript
export interface AuthResultMetadata {
  serverPlatform: 'win32' | 'linux' | 'darwin'  // os.platform()
  serverArch: 'x64' | 'arm64'                    // os.arch()
  serverEnv?: 'native' | 'wsl' | 'docker' | 'ssh'
  // per-env extras
  wslDistro?: string
  dockerMounts?: Array<{ host: string; container: string }>
  serverHome?: string
  // runtime
  nodeVersion: string
  claudeVersion?: string
  bundleVersion: string
  glibcVersion?: string
}

// 既有
// type AuthResult = { success: boolean; result: boolean }
// 改為
export type AuthResult = { success: boolean; result: true | AuthResultMetadata }
```

**向下相容**：
- 既有 server 回 `result: true`（boolean）→ client 收到後走 `IdentityTranslator` fallback（不切 translator）
- 新 server 回 `result: AuthResultMetadata`（object）→ client 解析後依 metadata 選 translator（Phase 1 仍是 Identity，Phase 2+ 才會切 Wsl/Docker/Ssh）

Server 端（`electron/remote/server.ts` 或對應檔）改 `auth-result` handshake：
```typescript
import * as os from 'node:os'
import { readFileSync } from 'node:fs'   // 讀 package.json bundleVersion

// auth 成功 emit：
const metadata: AuthResultMetadata = {
  serverPlatform: os.platform() as 'win32' | 'linux' | 'darwin',
  serverArch: os.arch() as 'x64' | 'arm64',
  serverEnv: 'native',          // Phase 1 server 還在 Electron host，先 hardcode 'native'
  nodeVersion: process.versions.node,
  bundleVersion: getBundleVersion(),  // 讀 package.json version
}
return { success: true, result: metadata }
```

> `serverEnv: 'native'` 是 Phase 1 的 placeholder。T0271/T0272 server bundle 上線後改為 detect（`process.env.BAT_SERVER_ENV` 或 launcher 注入）。

### 5. Client 端 metadata 處理

連線成功收到 `AuthResult` 後：

```typescript
// in client.ts, 處理 auth-result 的程式碼附近
if (typeof authResult.result === 'object') {
  // 新 server，有 metadata
  const metadata = authResult.result
  // Phase 1：log + 存到 RemoteClient 屬性即可
  this.serverMetadata = metadata
  // 嘗試切 translator（Phase 1 createTranslator 對非 local throw，所以這裡 try/catch fallback Identity）
  try {
    const profile = await getActiveProfile()
    this.setTranslator(createTranslator(profile))
  } catch (err) {
    console.warn('[RemoteClient] translator not available, using Identity:', err)
    // 維持預設 IdentityTranslator
  }
} else {
  // 舊 server (boolean true)，IdentityTranslator fallback（什麼都不做）
}
```

### 6. 整合測試

#### 6a. `tests/remote-client-middleware.test.ts`

mock RemoteClient（不真連線），驗：
- `invoke('fs:readdir', '/foo')` → translator.toServer 被呼叫 1 次
- `invoke('fs:readdir', '/foo')` 收 result `[{ path: '/srv/foo' }]` → 回傳值已 toClient
- `invoke('non-path-channel', 'foo')` → translator 不被呼叫
- `onEvent('fs:changed', { path: '/srv/foo/bar' })` → emit 出去的 path 已 toClient
- `onEvent('non-path-event', { path: '/foo' })` → emit 出去 path 不變

至少 8 個 case。

#### 6b. `tests/auth-result-metadata.test.ts`

- AuthResult 型別：`result: true` 與 `result: AuthResultMetadata` 都編譯通過
- 模擬 server emit metadata，client 解析後 `serverMetadata` 屬性正確 populate
- 模擬舊 server emit `result: true`，client 不報錯，translator 維持 Identity
- 模擬 metadata `serverPlatform: 'linux'` + profile.targetOS undefined → fallback Identity（不 throw）

至少 4 個 case。

---

## 守則 / 邊界

1. **不寫 Wsl/Docker/Ssh translator**：本工單只完成 middleware 框架 + metadata schema，per-OS translator 是 T0273/T0277/T0282。
2. **既有 BAT remote 連線必須透明**：legacy server 回 `result: true` 時，client 不能 break。
3. **不接 setup wizard**：`connect-test` step 是 Phase 2 wizard 工作。本工單只負責 metadata 從 server 流到 client。
4. **不動 profile schema**：T0268 已凍結，本工單只 import `ProfileEntry`。
5. **不接 server bundle**：`serverEnv: 'native'` hardcode；T0271/T0272 上線後再改。
6. **Channel 名稱以 codebase 為準**：spec 列的 channel 名是建議，Worker 必須 grep 校正實際命名，差異記在回報區。
7. **不寫 source code 以外的東西**（除 T0270 自己這份工單檔）。

---

## 驗收標準（AC）

- [ ] **AC1**：`PATH_AWARE_CHANNELS` / `PATH_RETURNING_CHANNELS` 兩 Set 落地，channel 名稱已對齊 codebase 實際命名
- [ ] **AC2**：`normalizePathsInResult` helper 對至少 4 個已知 channel（fs:readdir / fs:stat / git:status / pty:get-cwd 或 codebase 對應）能正確翻 path 欄位
- [ ] **AC3**：`RemoteClient.invoke()` 對 PATH_AWARE channel 翻譯 args 字串，對 PATH_RETURNING channel 翻譯 result
- [ ] **AC4**：`RemoteClient.onEvent()` 對 `fs:changed` payload.path 翻譯
- [ ] **AC5**：`AuthResultMetadata` interface 落地，`AuthResult.result` 改為 `true | AuthResultMetadata`，TypeScript 編譯通過
- [ ] **AC6**：Server 端 auth-result handshake emit metadata（Phase 1：`serverEnv: 'native'`，從 `os.platform()`/`os.arch()`/`process.versions.node`/package.json 取值）
- [ ] **AC7**：Client 端收 metadata 後存進 `serverMetadata` 屬性，並嘗試 `createTranslator`；非 local profile throw 時 fallback Identity（不 break）
- [ ] **AC8**：舊 server 回 `result: true`（boolean）時 client 不報錯，translator 維持 Identity
- [ ] **AC9**：整合測試至少 12 個 case 全綠（middleware 8 + metadata 4）
- [ ] **AC10**：`npm run build` 編譯通過；既有 BAT remote 連線（手動或既有 e2e）行為不變
- [ ] **AC11**：Worker 在 worktree commit `feature/plan-007-remote-dev` 分支，**不**動主線（除本工單檔回報區）

---

## 完成步驟（建議）

1. cd 到 worktree（`../bat-plan-007`）
2. 確認 base commit `dec6184`（`git log -1 --oneline`）
3. 讀 spec doc §2.2 / §2.4 + T0264 §2 lines 419-454
4. **校正 channel 名稱**：grep `electron/handlers/` + `electron/remote/` 找實際 IPC channel 命名
5. 寫 `path-aware-channels.ts`（或併入 `path-translator.ts`）+ `normalizePathsInResult` helper
6. 改 `electron/remote/client.ts` 加 middleware（invoke + onEvent + setTranslator）
7. 改 `electron/remote/protocol.ts` 加 `AuthResultMetadata` + 改 `AuthResult.result`
8. 改 `electron/remote/server.ts` auth handshake emit metadata
9. 改 client 收 metadata 後 setTranslator（try/catch fallback Identity）
10. 寫整合測試（middleware + metadata，至少 12 個 case）
11. 跑測試 + `npm run build`
12. commit 到 `feature/plan-007-remote-dev`（建議 message：`feat(remote): T0270 RemoteClient translator middleware + auth-result metadata schema`）
13. 更新本工單檔（worktree 內）狀態 → DONE，回報 commit hash + 測試數 + channel 校正結果
14. 結束 session

---

## 回報區（Worker 填寫）

**狀態變更**：TODO → IN_PROGRESS（2026-04-26 01:14:50 +08:00）→ DONE（2026-04-26 01:24:03 +08:00）

**worktree commit**：`26eb10d` on `feature/plan-007-remote-dev`

**修改檔**：
- `electron/main.ts`
- `electron/remote/path-aware-channels.ts`
- `electron/remote/protocol.ts`
- `electron/remote/remote-client.ts`
- `electron/remote/remote-server.ts`
- `tests/auth-result-metadata.test.ts`
- `tests/remote-client-middleware.test.ts`

**測試結果**：
- middleware test：13 passed
- metadata test：6 passed
- build：✅ `npm run build`

**Channel 校正結果**：
- `electron/remote/remote-client.ts` / `electron/remote/remote-server.ts` 才是實際檔名；工單內的 `client.ts` / `server.ts` 為舊推測名稱
- `fs:changed` 在現行 codebase 是直接 broadcast 單一字串路徑，不是 `{ path }` payload；middleware 以字串為主，另保留 object-path defensive fallback
- `workspace:save` / `workspace:load` 的 payload 是序列化 workspace JSON，不是單一路徑字串；未納入 `PATH_AWARE_CHANNELS`，避免誤翻整包 JSON
- `git:status` / `git:diff-files` 現行回傳 `{ status, file }` 且 `file` 為 repo-relative path，不是絕對路徑；未納入 `PATH_RETURNING_CHANNELS`
- 依 codebase 實際 channel 額外納入 `fs:reset-watch`、`git:branch`、`git:log`、`git:get-github-url`、`pty:restart`

**主動超出範圍項**（如有）：
- 無

**遇到的問題 / 決策**：
- `auth-result` metadata translator 選擇需要 profile context，但 `RemoteClient` 本身原本不知道 profile；改為在 `main.ts` 建立 client 時注入 profile，讓 client 在收到 metadata 後可直接 `createTranslator(profile)` 並 fallback `IdentityTranslator`
- `server emit + client fallback` 依 spec 落地，但 `createTranslator()` 對 `wsl-linux` / `docker-linux` / `ssh-*` 仍維持 T0269 的 pending throw；本工單 catch 後只記 warn，不中斷 legacy/phase-1 流程
- `fs:stat` 現行回傳 `{ mtimeMs, size } | null`，不含 path；`normalizePathsInResult()` 採 narrow channel/result-shape 策略，只翻真實含絕對路徑的 channel

**Renew 觸發**（如有）：
- 無

---
