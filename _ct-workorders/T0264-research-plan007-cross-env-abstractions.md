---
schema_version: 1
schema_kind: workorder
id: T0264
title: research-plan007-cross-env-abstractions
type: research
status: DONE
created_at: "2026-04-25T22:38:00+08:00"
started_at: "2026-04-25T22:37:00+08:00"
completed_at: "2026-04-25T22:42:00+08:00"
renew_count: 0
---
# T0264-research-plan007-cross-env-abstractions

## 元資料
- **工單編號**：T0264
- **任務名稱**：PLAN-007 — 4 環境共通抽象研究（targetOS schema / path translation 框架 / server bundle pipeline / setup wizard shell）
- **狀態**：DONE
- **建立時間**：2026-04-25 22:38 (UTC+8)
- **開始時間**：2026-04-25 22:37 (UTC+8)
- **完成時間**：2026-04-25 22:42 (UTC+8)
- **commit**：92af5c7
- **類型**：research（凍結共通 spec，**不寫 production code、不重構**）
- **互動模式**：enabled（共通抽象設計分支多）
- **Renew 次數**：0
- **預估 wall time**：60-120 min（硬性止損 3 小時）
- **預估 context cost**：中（讀 T0260-T0263 結論 + BAT profile / settings / electron-builder code + 跨工單交叉檢視）
- **關聯**：
  - 母 PLAN：PLAN-007（💡 IDEA）
  - 前序：T0260 scoping ✅ / T0261 spike ✅ / T0262 server-side spec ✅ / T0263 WSL research ✅
  - 並行延後：T0265 Docker / T0266 SSH（必須等本工單凍結共通 spec 才開）
  - 後序：T0267 彙整 → PLAN-007 PLANNED
  - **驅動**：T0263 Worker 在「給塔台的下一步建議」段主動建議插入此工單（line 580-589 附近）
- **affects_files**：
  - `_ct-workorders/T0264-*.md`（自身回報，唯一寫入目標）

---

## 背景與 scope 收斂

T0263 WSL research 揭露 6 個跨 4 deployment 共通元件，若各環境 research 各自設計會互相不一致。本工單**先凍結共通 spec**，T0265 Docker / T0266 SSH 在此基礎上只研究**差異點**。

**本工單只處理「跨 deployment 共通」**——deployment-specific 議題（Docker base image / SSH key 管理 / WSL distro 偵測）**不處理**。

---

## 任務目標

產出 6 個共通元件的 spec 草稿，全部寫在本工單回報區。

### 1. `targetOS` profile schema 凍結

**範圍**：定義所有 deployment 共用的 profile schema 擴充。

**研究**：
- 目前 BAT profile schema 結構（讀 `src/types/profile.ts` 或對應檔）
- `targetOS` enum 5 值定義：`local | wsl-linux | docker-linux | ssh-linux | ssh-darwin`
- 各 targetOS 額外欄位（`wslDistro` / `dockerContainer` / `sshHost` / etc.）合併到一個 union 還是分散
- profile schema 升級策略（既有 profile 預設 `targetOS: 'local'`，向下相容）
- migration：舊 profile 自動補欄位 vs 強制 user 重新設定

**輸出**：
- TypeScript Profile interface 草圖（含 targetOS + per-OS 額外欄位）
- migration 策略
- UI 影響清單（ProfilePanel 哪些欄位顯示/隱藏）

### 2. Path translation 框架

**範圍**：跨 OS path 翻譯的統一介面（不限 WSL）。

**研究**：
- T0263 提出的 `winToWsl` / `wslToWin` 純函數，是否可抽象成 `PathTranslator` interface？
  - `interface PathTranslator { toServer(clientPath: string): string; toClient(serverPath: string): string }`
  - 實作：`WslPathTranslator` / `DockerPathTranslator`（mount 點映射）/ `SshLinuxPathTranslator`（home dir 映射）/ `IdentityTranslator`（local，no-op）
- Translator 註冊與選擇邏輯（依 profile.targetOS 自動 inject）
- RemoteClient middleware 整合方式
- watch event（server → client）翻譯時機

**輸出**：
- `PathTranslator` interface + 4 實作骨架
- middleware 整合 spec（pseudocode）
- T0263 wsl-path 純函數如何套進 framework（不重寫，只 wrap）

### 3. Linux x64 server bundle pipeline

**範圍**：electron-builder 產出 server-only bundle 給 WSL/Docker/SSH 共用。

**研究**：
- 既有 `package.json` build / extraResources / asarUnpack 結構（讀現有 config）
- 兩種產出策略對比：
  - 策略 A：`electron-builder --linux dir` 產出後 strip GUI 部分留 server entry
  - 策略 B：獨立 esbuild 打包 server entry + node runtime 嵌入
  - 策略 C：純 npm tarball（同 BAT 一起發）
- bundle 內容清單：node runtime / server entry / `electron/remote/` / native modules（@lydell/node-pty-linux-x64 / better-sqlite3 / sharp，**排除 whisper**） / handler implementations
- bundle 大小估計（vs BAT desktop 目前 ~290 MB）
- CI 整合：`.github/workflows/pre-release.yml` 加 server bundle artifact

**輸出**：
- 策略對比表 + 推薦
- bundle 內容 manifest
- CI workflow 修改建議（pseudocode）

### 4. `auth-result.serverPlatform` 欄位擴充

**範圍**：server 在 auth 完成後告訴 client 自己跑在哪個平台/環境。

**研究**：
- 目前 `auth-result` frame schema（讀 `electron/remote/protocol.ts`）
- 新增欄位設計：
  - `serverPlatform: 'win32' | 'linux' | 'darwin'`（os.platform()）
  - `serverEnv?: 'wsl' | 'docker' | 'ssh' | 'native'`（細分 deployment 類型，server 自我宣告）
  - `serverArch: 'x64' | 'arm64'`
  - `wslDistro?: string`（如果 serverEnv = 'wsl'）
  - `nodeVersion: string`
  - `claudeVersion?: string`（runtime router 偵測結果）
- client 怎麼用這個資訊（path translator 自動選擇 / UI 顯示 / fingerprint pinning 是否 bind serverEnv）
- 向下相容：舊 server 不發此欄位時 client 怎麼處理

**輸出**：
- 擴充後的 `auth-result` frame schema TypeScript 草圖
- client side 處理邏輯（pseudocode）
- 對既有 BAT remote 連線（無遠端 deployment）的影響評估

### 5. Native module 相容性 baseline

**範圍**：跨 deployment 共用的 native module 規約。

**研究**：
- 4 環境 native module 需求對比：
  - WSL2：linux-x64 prebuilt 即可（T0263 已 cover）
  - Docker：依 base image，glibc-based（bookworm-slim）vs musl（alpine）
  - SSH：跨 OS（linux-x64 / linux-arm64 / macOS arm64 / Windows? — 後續決定）
  - 共用原則
- glibc 下限決定：
  - 2.31 (Ubuntu 20.04 / Debian 11) vs 2.35 (Ubuntu 22.04) vs 2.36 (Debian 12)
  - 越低越多人能跑，但越新越能用 prebuilt
- whisper 排除規則正式化（server bundle 不含 voice）
- node 版本內嵌策略：bundle 含 node 24.x runtime（與 BAT Electron 41 同 Node 24 ABI 對齊）

**輸出**：
- 相容性矩陣（4 環境 × 6 native modules）
- glibc 下限 + 文件化方式
- node 內嵌 vs 系統 node 取捨

### 6. Setup wizard 框架（UI shell + 子流程契約）

**範圍**：4 種 deployment 共用的 setup wizard UI 框架。

**研究**：
- T0263 提出的 8 步驟流程（[1]-[8]）哪些是共通、哪些是 deployment-specific
- 共通步驟：偵測環境 → 安裝 server bundle → 抓 fingerprint → 寫 profile → 自動連線 → 完成
- deployment-specific 步驟：WSL distro 選擇 / Docker container 選擇 / SSH host & key 設定
- WizardStep interface 設計（讓每個 deployment 註冊自己的子步驟）
- 進度顯示 / cancel / retry / 錯誤恢復 UX

**輸出**：
- WizardStep interface + 共通步驟列表
- deployment-specific hook points
- 至少一個 user journey（跨 deployment 一致的 UX 預期）

---

## 執行步驟

### Step 1：環境快照
```bash
git status
git log --oneline -5
```

### Step 2：讀 T0260-T0263 結論
- T0260：scoping 拆單建議卡（T0263-T0265 範圍細則）
- T0261：spike 結論（server-side 0 deps，secrets strategy）
- T0262：server-side spec 7 節（特別 §1 headless entry / §7 bind-interface）
- T0263：WSL research 7 節（path translation 純函數、whisper 排除、token 不注入 PTY、bundle pipeline 建議）

### Step 3：讀 BAT 相關 source（不深入動）
- `src/types/profile.ts`（如存在）— profile schema 起點
- `src/components/ProfilePanel.tsx` — UI hint
- `package.json` build / extraResources — bundle pipeline 起點
- `electron/remote/protocol.ts` — auth-result schema 起點
- `.github/workflows/pre-release.yml` — CI 起點

### Step 4：逐節寫 spec 草稿
照 6 節順序寫到回報區。**遇設計分支用互動模式問塔台**。

### Step 5：給塔台的下一步建議
基於共通 spec，建議：
- T0265 Docker research 在共通基礎上應該聚焦哪些差異點
- T0266 SSH research 同上
- T0267 彙整工單應該怎麼整合 4 環境 spec

### Step 6：填寫回報區
所有結論彙整到本工單下方「回報」區段。**禁止寫入其他任何檔案**。

---

## AC（acceptance criteria）

- **AC1**：targetOS profile schema 凍結（含 TypeScript 草圖 + migration 策略 + UI 影響清單）
- **AC2**：Path translation 框架完成（含 PathTranslator interface + 4 實作骨架 + middleware 整合）
- **AC3**：Linux x64 server bundle pipeline spec（含策略對比 + manifest + CI 修改建議）
- **AC4**：auth-result.serverPlatform 擴充 spec（含 schema + client 處理 + 向下相容）
- **AC5**：Native module 相容性 baseline（含相容性矩陣 + glibc 下限 + node 策略）
- **AC6**：Setup wizard 框架（含 WizardStep interface + 共通步驟 + hook points）
- **AC7**：給塔台的下一步建議完成
- **AC8**：working tree byte-identical（除本工單檔回報區）

---

## 嚴格禁止

- ❌ 寫入除本工單回報區以外的任何檔案
- ❌ 修改任何 source code
- ❌ 對 Docker / SSH deployment-specific 議題下結論（base image / SSH key 管理 / 跨 OS server 矩陣 → 留給 T0265/T0266）
- ❌ 對 WSL deployment-specific 議題下新結論（已在 T0263 凍結）
- ❌ 對 server-side 強化下結論（T0262 已凍結）
- ❌ 對 handler 跨環境下結論（EXP-HANDLER-AUDIT 範圍）
- ❌ 跑 `npm install` / `npm run build` / electron-builder
- ❌ 動 `package.json`
- ❌ 直接草擬 T0265/T0266/T0267 的完整工單檔
- ❌ 跨工單決策（→ 回塔台）

---

## 互動模式提示

**enabled**。預期可能的提問場景：

1. 「targetOS schema：union type 還是 discriminated union？」— TS 設計風格
2. 「PathTranslator 註冊方式：依 profile injection 還是 service locator？」— 整合方式
3. 「Server bundle 策略 A/B/C 推薦哪個？」— 影響 CI 工作量
4. 「auth-result 加 `serverEnv` 還是只 `serverPlatform`？」— 細分 vs 簡化
5. 「glibc 下限 2.31 vs 2.35？」— 覆蓋率 vs prebuilt 可用性
6. 「Setup wizard 是 BAT 內建 UI 還是獨立 modal？」— UX 取捨
7. 「whisper 排除是 hard exclude 還是 optional 開關？」— 未來想做 server-side voice 的擴展性

每次提問上限 3 題。能自己拍板的逕行決定 + 寫回報。

---

## 失敗 / PARTIAL 處理

任一觸發：
- 時間止損（>3h 仍未完成 6 節）
- 發現 4 環境共通抽象有根本性衝突（如 path translation 在某環境完全做不出來）
- 任 2 節以上需要 spike 才能拍板

→ 工單狀態填 **PARTIAL** 或 **FAILED**。觸發 yolo 斷點 B，塔台 pause。

---

## 回報

### 互動紀錄
無 — 6 節 spec 均能依 T0260-T0263 既有結論 + BAT source 直接拍板，無需互動提問。所有設計分支在「決策」段落明確說明取捨理由。

### Step 1 — 環境快照
```
git status --short:
  ?? _ct-workorders/T0264-research-plan007-cross-env-abstractions.md
git log -5:
  bb6d722 chore(workorder): T0263 metadata DONE + commit hash
  afb34a0 chore(workorder): T0263 PLAN-007 WSL deployment spec done — 7 sections ready
  53bd102 chore(workorder): T0262 metadata DONE + commit hash
  6477cf9 chore(workorder): T0262 PLAN-007 server-side hardening spec done — 7 sections ready
  f9aa64f chore(workorder): T0261 metadata DONE + commit hashes
```
working tree clean，僅本工單檔尚未追蹤。

### Step 2-3 — 讀前序工單 + BAT source 摘要

**前序工單關鍵結論**：
- **T0261**（spike）：server-side 0 deps 可行；secrets via `safeStorage`，Linux 無 keychain 時 fallback plaintext + warn。
- **T0262**（server-side spec 7 節）：headless entry `electron/remote/server-only-entry.ts`、bind-interface 三選項（localhost/tailscale/all）、token 加密、cert TOFU、sandbox flags 在 server 同樣套用。
- **T0263**（WSL spec 7 節）：path translation 純函數 `winToWsl` / `wslToWin`、whisper 在 WSL 排除（無音訊裝置）、token 不注入 PTY env（避免 shell history 洩漏）、bundle 用 Linux x64 prebuilt、setup wizard 8 步驟流程。
- **T0263 line 580-589 建議**：4 環境共通元件需先凍結，否則 T0265/T0266 各自設計會發散 → 即本工單。

**BAT source 起點摘要**：
- `electron/profile-manager.ts:7-18`：`ProfileEntry` 已含 `type: 'local' | 'remote'` + 5 個 remote* 欄位（host/port/token/profileId/fingerprint）。**沒有 targetOS 欄位**。
- `electron/remote/protocol.ts`（69 行）：`RemoteFrameType` 8 種，`RemoteFrame` 結構單純（type/id/channel/args/result/error/token）。auth-result 目前**只回 boolean result 或 error**，無 platform metadata。
- `package.json:142-177`：`linux: { target: 'AppImage' }` 已存在，`asarUnpack` 含 native modules（whisper / @img / @lydell/node-pty / claude-code），`extraResources` 只有 `scripts/*.mjs`。**尚無 server-only target**。
- `PROXIED_CHANNELS`（55 行）涵蓋 PTY / Claude / Workspace / Settings / GitHub / Git / FS / Snippet / Profile / Terminal — **所有可能需要 path translation 的 channel 都在內**。

---

### Spec 草稿

#### 1. targetOS profile schema 凍結

**TypeScript Profile interface 草圖**（discriminated union by `targetOS`）：

```typescript
// electron/profile-manager.ts (擴充 ProfileEntry)
export type TargetOS = 'local' | 'wsl-linux' | 'docker-linux' | 'ssh-linux' | 'ssh-darwin'

// 共通 remote 連線資訊（type='remote' 必填）
interface RemoteConnectionFields {
  remoteHost: string         // hostname / 100.x.x.x / localhost
  remotePort: number
  remoteToken: string        // 加密儲存
  remoteProfileId?: string
  remoteFingerprint: string  // SHA-256 cert pinning (TOFU)
}

// per-targetOS 額外 metadata（discriminated union）
type TargetOSMetadata =
  | { targetOS: 'local' }                                         // 無額外欄位
  | { targetOS: 'wsl-linux'; wslDistro: string }                  // 'Ubuntu-24.04' etc.
  | { targetOS: 'docker-linux'; dockerContainer: string; dockerHost?: string }
  | { targetOS: 'ssh-linux' | 'ssh-darwin'; sshHost: string; sshUser: string; sshPort?: number; sshKeyPath?: string }

export interface ProfileEntry {
  id: string
  name: string
  type: 'local' | 'remote'
  // 既有欄位保留（向下相容）
  remoteHost?: string
  remotePort?: number
  remoteToken?: string
  remoteProfileId?: string
  remoteFingerprint?: string
  // 新增：targetOS（type='remote' 必填，type='local' 一律 'local'）
  targetOS?: TargetOS  // optional 過渡期；舊 profile migration 時補 'local' 或 'wsl-linux'
  // 新增：per-OS metadata（依 targetOS 解讀）
  wslDistro?: string
  dockerContainer?: string
  dockerHost?: string
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  createdAt: number
  updatedAt: number
}
```

**設計決策**：
- **flat schema 而非嵌套 union**：避免 migration 寫巢狀解構，`ProfileEntry` 已是 flat structure，加欄位最容易；runtime 用 helper `extractTargetOSMeta(entry): TargetOSMetadata` 做 type narrowing。
- **`targetOS` 欄位 optional**：舊 profile（無此欄位）讀取時自動補 `'local'`（type='local'）或維持 undefined（type='remote' 走「未知 targetOS」降級路徑，等同今日 BAT remote 行為）。

**Migration 策略**：
- **被動 migration**：`profile-manager.ts` load 時若 `entry.targetOS === undefined`：
  - `type='local'` → 自動補 `targetOS='local'`，updatedAt 不變（避免污染同步時序）
  - `type='remote'` → 不補，視為 legacy remote（path translation 走 IdentityTranslator，等同今日行為）
- **主動 migration**：UI 提示「此 profile 未設定 targetOS，請選擇」對話框，僅在使用者編輯該 profile 時觸發。
- **不強制重設**：D062 風格的「向下相容是硬性要求」原則。

**UI 影響清單**（ProfilePanel.tsx）：
- **新增**：targetOS dropdown（5 選項，type='remote' 才顯示）
- **動態欄位**：依 targetOS 顯示對應 metadata 欄位（distro / container / sshHost ...）
- **fingerprint 區塊**：與 targetOS 解耦（所有 remote profile 共用）
- **read-only metadata**：第一次連線後從 `auth-result.serverPlatform` 自動填回，標示「server 自宣告」

---

#### 2. Path translation 框架

**`PathTranslator` interface**：

```typescript
// electron/remote/path-translator.ts
export interface PathTranslator {
  /** Client → Server：使用者輸入的路徑送往 server 前翻譯 */
  toServer(clientPath: string): string
  /** Server → Client：server 回傳的路徑（fs:readdir / git diff / watch event）送回 UI 前翻譯 */
  toClient(serverPath: string): string
  /** 偵測路徑是否屬於本 translator 管轄（用於 mixed-source result 過濾） */
  owns(path: string): boolean
}
```

**4 實作骨架**：

```typescript
// 1. IdentityTranslator — local profile 與 legacy remote
export class IdentityTranslator implements PathTranslator {
  toServer(p: string) { return p }
  toClient(p: string) { return p }
  owns(_p: string) { return true }
}

// 2. WslPathTranslator — wraps T0263 純函數，不重寫
import { winToWsl, wslToWin } from './wsl-path'  // T0263 凍結
export class WslPathTranslator implements PathTranslator {
  constructor(private distro: string) {}
  toServer(p: string) { return winToWsl(p) }       // C:\foo → /mnt/c/foo
  toClient(p: string) { return wslToWin(p) }       // /mnt/c/foo → C:\foo
  owns(p: string) { return /^[A-Z]:[\\/]/.test(p) || p.startsWith('/mnt/') || p.startsWith('//wsl$/') }
}

// 3. DockerPathTranslator — bind mount 點映射
export class DockerPathTranslator implements PathTranslator {
  constructor(private mounts: Array<{ host: string; container: string }>) {}
  toServer(p: string) {
    for (const m of this.mounts) if (p.startsWith(m.host)) return m.container + p.slice(m.host.length)
    return p  // 不在 mount 內就原樣傳（caller 自行處理 ENOENT）
  }
  toClient(p: string) {
    for (const m of this.mounts) if (p.startsWith(m.container)) return m.host + p.slice(m.container.length)
    return p
  }
  owns(p: string) { return this.mounts.some(m => p.startsWith(m.host) || p.startsWith(m.container)) }
}

// 4. SshLinuxPathTranslator — home dir 映射 + 跨 OS path normalize
export class SshLinuxPathTranslator implements PathTranslator {
  constructor(private clientHome: string, private serverHome: string) {}
  toServer(p: string) { return p.startsWith(this.clientHome) ? this.serverHome + p.slice(this.clientHome.length) : p }
  toClient(p: string) { return p.startsWith(this.serverHome) ? this.clientHome + p.slice(this.serverHome.length) : p }
  owns(p: string) { return p.startsWith(this.clientHome) || p.startsWith(this.serverHome) }
}
```

**Translator 註冊與選擇**：

```typescript
// electron/remote/translator-registry.ts
export function createTranslator(profile: ProfileEntry): PathTranslator {
  if (profile.type === 'local') return new IdentityTranslator()
  switch (profile.targetOS) {
    case 'wsl-linux':    return new WslPathTranslator(profile.wslDistro ?? 'default')
    case 'docker-linux': return new DockerPathTranslator(/* mounts from auth-result */ [])
    case 'ssh-linux':
    case 'ssh-darwin':   return new SshLinuxPathTranslator(/* homes from auth-result */ '', '')
    default:             return new IdentityTranslator()  // legacy / unknown
  }
}
```

**RemoteClient middleware 整合**（pseudocode）：

```typescript
// electron/remote/remote-client.ts (擴充)
class RemoteClient {
  private translator: PathTranslator = new IdentityTranslator()

  async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    if (PATH_AWARE_CHANNELS.has(channel)) args = args.map(a => typeof a === 'string' ? this.translator.toServer(a) : a)
    const result = await this.send({ type: 'invoke', channel, args })
    return PATH_RETURNING_CHANNELS.has(channel) ? this.normalizePathsInResult(result) : result
  }

  // server → client event 翻譯（fs:changed / pty:output 含 cwd 等）
  private onEvent(channel: string, payload: unknown) {
    if (channel === 'fs:changed' && typeof payload === 'object') payload = { ...payload, path: this.translator.toClient((payload as any).path) }
    this.emit(channel, payload)
  }
}

// 哪些 channel 接收 path 參數（client → server 翻譯）
const PATH_AWARE_CHANNELS = new Set([
  'fs:readdir', 'fs:readFile', 'fs:stat', 'fs:search', 'fs:watch', 'fs:unwatch',
  'git:diff', 'git:diff-files', 'git:status', 'git:getRoot',
  'pty:create',  // cwd 參數
  'workspace:save', 'workspace:load',
  'image:read-as-data-url',
])

// 哪些 channel 回傳含 path 的結果（server → client 翻譯）
const PATH_RETURNING_CHANNELS = new Set([
  'fs:readdir', 'fs:stat', 'fs:search',
  'git:status', 'git:diff-files', 'git:getRoot',
  'pty:get-cwd',
])
```

**T0263 wsl-path 純函數如何套進 framework**：
- T0263 已凍結 `winToWsl(p, distro?)` / `wslToWin(p)` 為 free functions in `electron/remote/wsl-path.ts`。
- **不重寫**，`WslPathTranslator` 直接 import + delegate；測試套件保留純函數 unit test，再加 translator-level integration test。
- 未來新增 OS（如 ssh-windows）只需加新 translator，wsl-path 不動。

---

#### 3. Linux x64 server bundle pipeline

**策略對比表**：

| 策略 | 描述 | bundle 大小估計 | CI 工作量 | 維護成本 | 風險 |
|------|------|---------------|----------|---------|------|
| A: `electron-builder --linux dir` strip | 跑既有 linux target，post-build 刪 GUI 部分（Electron binary、xterm bundles） | 200-250 MB | 中（加 post-build script） | 中（strip 規則需維護） | 高（誤刪會 silent break） |
| B: 獨立 esbuild | 從 `electron/remote/server-only-entry.ts` 起點 bundle，含 node runtime via pkg/sea | 60-100 MB | 高（新建 build chain） | 低（單一 entry） | 中（native module rebuild 仍需處理） |
| C: npm tarball + 系統 node | 純 JS tarball，要求使用者自備 node 24.x | 5-15 MB（無 node runtime） | 低 | 低 | 中（使用者環境 node 版本不一致 → ABI 衝突） |

**推薦：策略 B（esbuild + node 24 SEA / pkg）**

理由：
- T0263 / T0262 已要求 server 自帶 node runtime（與 BAT Electron 41 同 Node 24 ABI 對齊）
- 大小可接受（vs 策略 A 縮 60%+）
- Setup wizard 內可自動下載解壓，無需使用者裝 node
- 策略 A 的 strip 規則隨 BAT 改版會 drift；策略 C 的 node 版本相容性問題已在 T0263 §5 標記為 risk

**Fallback 策略**：策略 B 若 SEA / pkg 在某 native module 遇阻 → 降級為策略 A。

**Bundle 內容 manifest**：

```
bat-server-linux-x64-v0.X.Y.tar.gz/
├── bin/
│   ├── node                          # 24.x prebuilt linux-x64 (15 MB)
│   └── bat-server                    # esbuild-bundled entry (3-5 MB)
├── node_modules/                     # 必要 native modules（rebuilt linux-x64）
│   ├── @lydell/node-pty/             # ✅ PTY
│   ├── @lydell/node-pty-linux-x64/   # ✅ prebuilt binary
│   ├── better-sqlite3/               # ✅ snippet / archive storage
│   ├── @img/sharp-linux-x64/         # ✅ image resize
│   ├── @anthropic-ai/claude-code/    # ✅ claude CLI（embedded runtime）
│   └── @anthropic-ai/claude-agent-sdk/
├── electron/remote/                  # server entry + handlers
├── handlers/                         # IPC handler implementations（renderer-agnostic）
└── README.md                         # bundle metadata（version / glibc lower bound / arch）

排除清單：
- @kutalia/whisper-node-addon         # ❌ T0263 §1：無音訊裝置
- @img/sharp-darwin-* / sharp-win32-* # ❌ 跨平台 binary
- @lydell/node-pty-darwin-* / -win32-*
- electron / electron-*                # ❌ 不需 GUI runtime
- xterm / @xterm/*                     # ❌ 純 renderer
- 所有 src/** （renderer code）        # ❌ 純 frontend
```

**CI workflow 修改建議**（pseudocode for `.github/workflows/pre-release.yml`）：

```yaml
# 新增 job（與既有 win/mac/linux desktop build 並行）
build-server-linux-x64:
  runs-on: ubuntu-22.04   # glibc 2.35 — 見 §5 baseline 決策
  steps:
    - uses: actions/checkout
    - uses: actions/setup-node@v4 with: { node-version: 24 }
    - run: npm ci
    - run: node scripts/verify-native-modules.js
    - run: npm run build:server-bundle    # 新 script：esbuild + native rebuild + tarball
    - uses: actions/upload-artifact
      with:
        name: bat-server-linux-x64
        path: dist-server/bat-server-linux-x64-*.tar.gz
    - if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')
      uses: softprops/action-gh-release    # 隨 desktop release 一起 attach
```

`package.json` 對應新增 script：
```json
"build:server-bundle": "node scripts/build-server-bundle.mjs"
```

**未在本工單範圍**：
- arm64 server bundle（→ T0266 SSH research，因 SSH 才需要跨 arch）
- darwin server bundle（同上）
- bundle 簽章 / notarization（非必要，使用者自行驗 fingerprint）

---

#### 4. `auth-result.serverPlatform` 欄位擴充

**擴充後 schema**：

```typescript
// electron/remote/protocol.ts (擴充)
export interface AuthResultMetadata {
  serverPlatform: 'win32' | 'linux' | 'darwin'  // os.platform()
  serverArch: 'x64' | 'arm64'                    // os.arch()
  serverEnv?: 'native' | 'wsl' | 'docker' | 'ssh'  // server 自我宣告 deployment 類型
  // per-env 額外資訊（client 用於建構 PathTranslator）
  wslDistro?: string                              // serverEnv='wsl' 時填
  dockerMounts?: Array<{ host: string; container: string }>  // serverEnv='docker'
  serverHome?: string                             // serverEnv='ssh' 時 client 比對 sshUser home
  // runtime metadata
  nodeVersion: string                             // process.version
  claudeVersion?: string                          // runtime router 偵測結果（D027）
  bundleVersion: string                           // bat-server bundle version (與 BAT 對齊)
  glibcVersion?: string                           // linux only — 用於 client compatibility 警告
}

export interface RemoteFrame {
  type: RemoteFrameType
  id: string
  channel?: string
  args?: unknown[]
  result?: unknown            // auth-result 時：true | AuthResultMetadata
  error?: string
  token?: string
}
```

**改動點**：`auth-result` 的 `result` 欄位從 `boolean` 擴成 `true | AuthResultMetadata`（向下相容：true 仍視為「成功但無 metadata」，走 fallback）。

**Client side 處理邏輯**（pseudocode in `remote-client.ts`）：

```typescript
private onAuthResult(frame: RemoteFrame): void {
  if (frame.error) { /* reject */ return }

  let metadata: AuthResultMetadata | null = null
  if (typeof frame.result === 'object' && frame.result && 'serverPlatform' in frame.result) {
    metadata = frame.result as AuthResultMetadata
  }

  // 1. 用 metadata 建構 translator
  this.translator = metadata
    ? createTranslator({ ...this.profile, /* override per-env meta from server */ ...this.deriveProfileOverrides(metadata) })
    : new IdentityTranslator()  // legacy server fallback

  // 2. UI 顯示（statusline / ProfilePanel read-only fields）
  if (metadata) this.emit('server-metadata', metadata)

  // 3. 版本相容性警告（不阻斷連線）
  if (metadata?.bundleVersion && metadata.bundleVersion !== APP_VERSION) {
    logger.warn(`[Remote] Server bundle ${metadata.bundleVersion} != client ${APP_VERSION} — proceed with caution`)
  }

  // 4. fingerprint pinning 不變（已在 TLS 層處理，與 metadata 解耦）
  this.resolveAuth(true)
}
```

**Fingerprint 是否 bind serverEnv**：**不 bind**。Fingerprint 是 cert pinning（TOFU），cert 屬於 server instance，server instance 跑在哪個 env 是 deployment artifact，不應改變信任鏈。若 server 從 wsl 換到 docker（同一台機器），fingerprint 仍應有效（除非 cert 重生）。

**向下相容**：
- 舊 server（無 metadata 擴充）：發 `result: true` → client 走 IdentityTranslator + 不顯示 metadata UI（等同今日行為）。
- 舊 client（不認 metadata）：因為是 `result` 欄位內容擴充而非新 frame type，舊 client 解 `result === true` 仍 truthy → 認為成功，後續 path 操作可能失敗（這是預期 — 舊 client 連新 server 必須走 metadata path）。

**對既有 BAT remote 連線（無遠端 deployment，純 BAT-to-BAT）的影響**：
- 兩端皆升級：metadata 仍會發送，但 `serverEnv='native'` + serverPlatform 與 client 同（一般情境）→ translator = Identity → 行為不變。
- 兩端版本不一致：fallback 機制保證不 break。

---

#### 5. Native module 相容性 baseline

**相容性矩陣（4 環境 × 6 native modules）**：

| native module | local (BAT desktop) | wsl-linux | docker-linux | ssh-linux | 備註 |
|---------------|---------------------|-----------|--------------|-----------|------|
| `@lydell/node-pty` | ✅ 跨平台 prebuilt | ✅ linux-x64 prebuilt | ✅ linux-x64 prebuilt（base 須含 glibc） | ✅ linux-x64 / linux-arm64 prebuilt | server bundle 必要 |
| `better-sqlite3` | ✅ | ✅ | ✅ | ✅ | server bundle 必要（snippet/archive） |
| `@img/sharp-*` | ✅（per-arch） | ✅ sharp-linux-x64 | ✅ sharp-linux-x64 / -arm64 | ✅ | server bundle 必要（image:read-as-data-url） |
| `@kutalia/whisper-node-addon` | ✅ | ❌ **排除** | ❌ **排除** | ❌ **排除** | T0263 §1 凍結：server-side 無音訊 |
| `@anthropic-ai/claude-code` | ✅（embedded runtime） | ✅ | ✅ | ✅ | embedded 路徑跨環境一致（D027 / runtime router） |
| `@anthropic-ai/claude-agent-sdk` | ✅ | ✅ | ✅ | ✅ | 純 JS，無 native binding |

**glibc 下限決定**：

| 候選 | 覆蓋 distro | server bundle 可用性 | 推薦度 |
|------|------------|---------------------|--------|
| 2.31 (Ubuntu 20.04 LTS / Debian 11) | 廣（含舊企業 LTS） | better-sqlite3 prebuilt 仍需 manylinux2_28 → 部分 module compile from source | 低 |
| **2.35 (Ubuntu 22.04 LTS)** | 主流（22.04 / 24.04 / Debian 12 / WSL2 預設 Ubuntu） | ✅ 大多 prebuilt 可用 | **★ 推薦** |
| 2.36 (Debian 12) | 較新 | ✅ | 中 |

**決策：glibc 下限 2.35（Ubuntu 22.04）**

理由：
- Ubuntu 22.04 是 WSL2 預設 distro 之一，且有 LTS 至 2027（Standard Support）
- prebuilt native module（@lydell/node-pty / better-sqlite3 / sharp）都覆蓋此版本
- 老 distro（Ubuntu 20.04 / RHEL 8）使用者可走「升級 distro」或「源碼編譯」路徑（Setup wizard 偵測 + 提示）
- CI build runner 用 `ubuntu-22.04`，產出 binary 對齊。

**文件化方式**：
- `bat-server-linux-x64-*.tar.gz` README 第一行寫明 `Requires: glibc >= 2.35 (Ubuntu 22.04+ / Debian 12+)`
- Setup wizard 第 1 步「偵測環境」執行 `ldd --version` 解析 glibc，低於 2.35 顯示警告 + 升級建議。

**whisper 排除規則正式化**：
- **hard exclude**（決策）：server bundle build script 在 esbuild externals + `extraResources` filter 雙層排除 whisper-node-addon。
- 不做 optional 開關 — 理由：server-side voice 是另一個 PLAN（PLAN-007 之外），引入即需 audio 設備轉發（pulseaudio over network），cost 過高，留待未來獨立 spike。

**Node 內嵌 vs 系統 node 取捨**：

| 選項 | 優點 | 缺點 |
|------|------|------|
| **內嵌 node 24.x**（推薦） | ABI 對齊 BAT Electron 41（Node 24）；使用者不需裝 node；版本鎖定 | bundle 大 ~15 MB |
| 系統 node | bundle 小 5-15 MB | 使用者環境 node 版本不一致 → native module ABI mismatch；setup wizard 還要驗版本 |

**決策：內嵌 node 24.x**（與 BAT 內嵌 claude CLI 同樣設計哲學 — D027 風格的「stable, controlled, offline-friendly」）。

---

#### 6. Setup wizard 框架

**`WizardStep` interface + 共通步驟**：

```typescript
// src/components/setup-wizard/types.ts
export interface WizardContext {
  profile: Partial<ProfileEntry>           // wizard 累積寫入
  targetOS: TargetOS
  emit(event: string, payload?: unknown): void  // 進度回報
  cancel(): never                                // throw cancel sentinel
}

export interface WizardStep {
  id: string                                     // 唯一識別
  title: string                                  // UI 顯示
  appliesTo: TargetOS[] | 'all'                  // 哪些 deployment 跑此步驟
  run(ctx: WizardContext): Promise<void>         // 主邏輯（可 async）
  rollback?(ctx: WizardContext): Promise<void>   // 失敗時回滾
  retryable?: boolean                            // 預設 true
}
```

**共通步驟（appliesTo: 'all' 或多 OS）**：

| ID | Title | appliesTo | 主要動作 |
|----|-------|-----------|---------|
| `detect-env` | 偵測環境 | all | 確認 client OS、網路、必要工具（依 targetOS：wsl.exe / docker / ssh） |
| `install-server-bundle` | 安裝 server bundle | wsl-linux, docker-linux, ssh-linux, ssh-darwin | 下載 tarball / push 到目標 / 解壓 |
| `start-server` | 啟動 server | wsl-linux, docker-linux, ssh-linux, ssh-darwin | 跑 `bat-server` headless（依 deployment 透過 wsl.exe / docker exec / ssh 執行） |
| `fetch-fingerprint` | 抓 cert fingerprint | wsl-linux, docker-linux, ssh-linux, ssh-darwin | TOFU 寫入 profile |
| `write-profile` | 寫入 profile | all | profile-manager.ts create() with targetOS metadata |
| `connect-test` | 自動連線測試 | all | RemoteClient 連線 + auth + 收 metadata |
| `done` | 完成 | all | 顯示 server metadata 摘要、進入主介面 |

**deployment-specific hook points**（appliesTo 限縮）：

```typescript
// WSL
const wslSteps: WizardStep[] = [
  { id: 'pick-wsl-distro', appliesTo: ['wsl-linux'], title: 'Choose WSL distro', run: pickDistro },
  { id: 'wsl-systemd-check', appliesTo: ['wsl-linux'], title: 'Verify systemd', run: verifySystemd },
]

// Docker
const dockerSteps: WizardStep[] = [
  { id: 'pick-container', appliesTo: ['docker-linux'], title: 'Choose / create container', run: pickContainer },
  { id: 'configure-mounts', appliesTo: ['docker-linux'], title: 'Configure bind mounts', run: configureMounts },
]

// SSH
const sshSteps: WizardStep[] = [
  { id: 'configure-ssh-host', appliesTo: ['ssh-linux', 'ssh-darwin'], title: 'SSH host & user', run: configureSshHost },
  { id: 'verify-ssh-auth', appliesTo: ['ssh-linux', 'ssh-darwin'], title: 'Verify SSH auth (key/agent)', run: verifySshAuth },
]
```

**Wizard runner**（pseudocode）：
```typescript
async function runWizard(targetOS: TargetOS): Promise<ProfileEntry> {
  const steps = [...commonSteps, ...wslSteps, ...dockerSteps, ...sshSteps].filter(s => s.appliesTo === 'all' || s.appliesTo.includes(targetOS))
  const ctx: WizardContext = { profile: { type: 'remote', targetOS }, targetOS, /* emit / cancel */ }
  const completed: WizardStep[] = []
  for (const step of steps) {
    try { await step.run(ctx); completed.push(step) }
    catch (err) {
      if (isCancel(err)) { for (const s of completed.reverse()) await s.rollback?.(ctx); throw err }
      if (step.retryable !== false && await promptRetry(step, err)) { /* retry loop */ }
      else throw err
    }
  }
  return profileManager.create(ctx.profile.name!, ctx.profile)
}
```

**進度顯示 / cancel / retry / 錯誤恢復 UX**：
- **進度條**：N steps / current step name + 子步驟 emit 的進度事件（download %, exec stdout 行）
- **cancel**：每 step 內 `await ctx.cancel()` checkpoint；rollback chain 反向跑 completed steps 的 rollback。
- **retry**：retryable step 失敗顯示「Retry / Skip / Abort」 modal，Skip 風險自負（標 profile 為 incomplete）
- **錯誤恢復**：profile 寫入是 last step；前面步驟全失敗 = 沒寫入 = 無垃圾 profile

**至少一個 user journey（跨 deployment 一致 UX）**：

```
使用者 click「+ New Remote Profile」
  ↓
Modal step 0：選 deployment 類型（WSL / Docker / SSH-Linux / SSH-Darwin）
  ↓
[detect-env]            進度條 0/N、log: ✓ wsl.exe found
[pick-wsl-distro]       使用者選 Ubuntu-24.04（僅 WSL 顯示）
[install-server-bundle] 進度條 download 87%, extract...
[start-server]          log: ✓ bat-server pid 1234, listening 100.x.x.x:48080
[fetch-fingerprint]     log: ✓ pinned SHA-256 5A:3B:...
[write-profile]         log: ✓ profile "wsl-ubuntu-24" saved
[connect-test]          log: ✓ auth ok, server metadata: linux x64 wsl Ubuntu-24.04 node v24.0.1
[done]                  「✓ Setup complete. Click to switch profile.」
```

---

### 給塔台的下一步建議

**T0265 Docker research 應聚焦的差異點清單**（共通 spec 已凍結，這些是 Docker-only）：
1. **Base image 選擇**：`debian:bookworm-slim` (glibc 2.36) vs `ubuntu:22.04` (glibc 2.35) vs alpine（musl，本工單已排除）
2. **Bind mount strategy**：使用者 host 路徑 → container 路徑映射；wizard step `configure-mounts` 的 UI 細節
3. **Container 生命週期**：BAT 啟動時 docker exec vs container 預先 docker run；docker daemon 偵測（unix socket / named pipe）
4. **Docker host 偵測**：`DOCKER_HOST` env / `~/.docker/config.json` / Docker Desktop named pipe（Windows）
5. **Multi-arch image**：是否提供 linux-x64 + linux-arm64 兩個 server bundle image（影響 §3 bundle pipeline）
6. **Docker Compose 整合**：是否提供 docker-compose.yml 範本

**T0266 SSH research 應聚焦的差異點清單**：
1. **SSH auth 方式**：key-based（推薦）/ agent forwarding / password；BAT 是否內建 ssh-agent
2. **跨 arch / 跨 OS server matrix**：linux-x64 / linux-arm64 / darwin-x64 / darwin-arm64 — 對應 §3 bundle pipeline 擴充
3. **darwin server 的 native modules**：sharp-darwin-x64/arm64 / better-sqlite3 darwin / @lydell/node-pty-darwin — 跨 OS server bundle 比 linux-only 複雜很多
4. **Persistent connection**：SSH tunnel（local port forward） vs 直連 + cert pinning；fingerprint TOFU 在 SSH 場景的語意
5. **跨 home dir 路徑映射**：client `/Users/alice` ↔ server `/home/alice` 在 SshLinuxPathTranslator 之外是否需要 SshDarwinPathTranslator
6. **SSH 連線斷線恢復**：BAT 既有 reconnect 邏輯是否需擴充

**T0267 彙整工單整合策略**：
- T0267 應產出 PLAN-007 完整路線圖：Phase 1 共通（本工單 spec 落地） → Phase 2 WSL（T0263 落地） → Phase 3 Docker（T0265 落地） → Phase 4 SSH（T0266 落地）
- 每 Phase 拆 implementation 工單（feat / refactor 類），由本工單的 6 節 spec 當各 Phase 共用 dependency
- 建議 T0267 重新評估 EXP-HANDLER-AUDIT 範圍，確認 PROXIED_CHANNELS 內所有 handler 在 Linux server 都能跑（特別是 git scaffold 的 simple-git 跨 OS path 處理）
- **共通 spec 中需 spike 才能拍板**（none — 6 節都已可拍板）；唯一可能需 spike 的延伸議題：
  - **Server-side native module rebuild on first install**：bundle 是預編譯 prebuilt，但若使用者 distro glibc < 2.35 是否提供 build-from-source fallback 路徑？建議 T0267 階段視市場需求決定。

### 收尾 commit
- commit message：`chore(workorder): T0264 PLAN-007 cross-env abstractions spec done — 6 sections frozen`
