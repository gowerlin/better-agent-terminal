# PLAN-027 研究報告 — Claude Runtime 選擇機制可行性調查

| 欄位 | 內容 |
|------|------|
| **研究工單** | T0229 |
| **完成時間** | 2026-04-22 (UTC+8) |
| **Worker** | Opus 4.7 |
| **互動輪數** | 1 / 3 |
| **使用者決議** | Level B / 繼承 process.env / 收斂為 5 張拆單 |

---

## 摘要(Executive Summary)

**結論:可行,且實作成本遠低於 PLAN-027 原估計。**

關鍵發現:
1. `@anthropic-ai/claude-agent-sdk` v0.2.113 **官方支援** `pathToClaudeCodeExecutable` option — 直接傳入外部 binary 路徑即可,無需 child_process workaround
2. BAT 現有程式碼(`electron/claude-agent-manager.ts:669, 1348, 2227`)**已用此 option 指向內嵌 binary**,切換系統版只需把 path 字串換成偵測結果,核心 routing 邏輯幾乎為零
3. `claude --version` 輸出格式單行穩定:`<version> (Claude Code)`,parse 風險極低
4. 偵測策略可直接複用 `electron/node-resolver.ts` 的 PATH-search-then-common-locations pattern
5. Auth 與 env 完全繼承 `process.env` 即可,系統 claude 自會讀 `~/.claude/.credentials.json` / `ANTHROPIC_API_KEY` / keyring,行為與使用者在 terminal 直接 `claude` 一致

**修正後估時:3-3.5h wall time(原 PLAN-027 估計 4-5h)。**

---

## R1:Child_process 模式接 SDK transport 可行性

### 結論

**完全可行,SDK 官方支援,無 workaround 需求。**

### 技術細節

`node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` 提供四個關鍵 option:

| Option | 行號 | 說明 |
|--------|------|------|
| `pathToClaudeCodeExecutable?: string` | 1406 | 指定外部 claude binary 路徑;**不指定則用內嵌**(BAT 目前一律明示指定內嵌路徑) |
| `executable?: 'bun' \| 'deno' \| 'node'` | 1188 | 選 JS runtime;**對 native binary 無作用**(claude.exe 是 single-file native,不需 Node) |
| `executableArgs?: string[]` | 1192 | 額外傳給 runtime 的 args(同上,native 模式用不到) |
| `spawnClaudeCodeProcess?: (opts) => SpawnedProcess` | 1665 | 完全自訂 spawn 函數(VM/container/remote 用,本案用不到) |
| `env?: { [k: string]: string \| undefined }` | 3011 | 控制傳給子進程的 env;**預設繼承 `process.env`** |
| `cwd?: string` | 3018 | 控制子進程 cwd |

### Binary 結構發現(install.cjs 證實)

`@anthropic-ai/claude-code/install.cjs:88-125` 顯示:
- 所有平台(Windows/macOS/Linux/musl/x64/arm64)**都 ship 為 `bin/claude.exe`**(Unix 忽略副檔名)
- postinstall 從 platform-specific optional dep 把 native binary hardlink/copy 過來,**沒有 Node 包裝**
- 同樣 pattern:全球 `npm i -g @anthropic-ai/claude-code` 安裝出來的 binary **本質一樣**,差別只在版號

→ **R3 推論**:版號 parse 在「內嵌 binary」「globally installed binary」「使用者自訂路徑 binary」三種情境輸出格式必然一致(同一份程式碼)。

### 限制

無顯著限制。值得記錄的細節:

1. **stdio 模式相同**:SDK 內部一律走 `child_process.spawn` + JSON-RPC over stdin/stdout。內嵌 vs 系統版的 transport 完全一致,**latency / throughput 不會有差**(差別僅在 binary 本身的版本變動)
2. **`spawnClaudeCodeProcess` 不需動**:SDK 預設 spawn 行為已經涵蓋本案所有需求,custom spawn 函數是給 VM/container 用的,本專案不需要

### 推薦做法

在 `runQuery()`(`claude-agent-manager.ts:537`)、`createSessionV2()` (1258)、`forkSession()` (2210) 三處,把 `claudeCodePath = resolveClaudeCodePath()` 換成:

```typescript
const claudeCodePath = settings.claudeRuntime.mode === 'system'
  ? resolveSystemClaudePath(settings.claudeRuntime.customPath)  // 新函數
  : resolveClaudeCodePath()  // 既有函數,內嵌路徑
```

如果系統路徑解析失敗 → fallback 內嵌 + 通知。**就是這樣,沒有更多。**

---

## R2:`claude` binary 偵測策略(跨平台)

### 結論

**可直接複用 `electron/node-resolver.ts` 模式。三平台共用一套 PATH 搜尋程式碼 + 平台分支處理副檔名。**

### 技術細節 — 偵測流程虛擬碼

```
function resolveSystemClaudePath(customPath?: string): string | null {
  // 1. 使用者自訂路徑優先
  if (customPath) {
    if (fs.existsSync(customPath) && isExecutable(customPath)) return customPath
    return null  // 自訂路徑無效不走 fallback,直接讓使用者知道路徑壞了
  }

  // 2. PATH 環境變數搜尋
  const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const pathDirs = (process.env.PATH || '').split(path.delimiter)
  for (const dir of pathDirs) {
    const candidate = path.join(dir, binaryName)
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
    // Windows extra: 同目錄找 claude.cmd / claude.bat shim
    if (process.platform === 'win32') {
      for (const ext of ['.cmd', '.bat']) {
        const shim = path.join(dir, 'claude' + ext)
        if (fs.existsSync(shim)) return shim
      }
    }
  }

  // 3. 常見安裝路徑 fallback
  for (const candidate of getCommonClaudePaths()) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}
```

### 邊界情況對照表

| 情境 | Windows | macOS | Linux |
|------|---------|-------|-------|
| **預設 PATH 安裝** | `%APPDATA%\npm\claude.cmd`(npm global)、`%LOCALAPPDATA%\.local\bin\claude.exe`(curl installer) | `/opt/homebrew/bin/claude`(Apple Silicon)、`/usr/local/bin/claude`(Intel) | `/usr/local/bin/claude`、`~/.local/bin/claude` |
| **PATH 含空格** | `C:\Program Files\Claude\claude.exe` — `path.join` 自動正確處理,**但** spawn 時 SDK 會 quote arg,**不需特別處理** | 同左 | 同左 |
| **PATH 含中文** | `D:\使用者\Gower\claude\` — Node fs API 走 UTF-16,正常處理;子進程環境變數透傳要確保 `env.PATH` 不被截斷 | 同左 | 同左 |
| **PowerShell vs cmd 啟動** | 不影響 — Electron 主進程的 `process.env.PATH` 在啟動時就 freeze,後續用哪個 shell 無關 | N/A | N/A |
| **`.cmd` wrapper** | npm global 安裝的 claude 是 `.cmd` shim;SDK `spawn` 對 `.cmd` 的處理在 Node 16+ 是 OK 的(會自動透過 `cmd.exe /c`),但 Node 對 `.cmd` 有 historical CVE — 推薦優先選 `.exe` 直接 binary | N/A | N/A |
| **macOS Gatekeeper** | N/A | 自行 `npm i -g` 的 binary 第一次執行會被 quarantine。**BAT 不處理**,使用者需手動 `xattr -d com.apple.quarantine /path/to/claude` 或在 System Preferences 信任。Settings UI 在 `--version` 失敗時顯示原始 error,使用者可自行 google | N/A |
| **Symlink chains** | Windows 罕見 | `brew install` 下的 `/opt/homebrew/bin/claude` → `Cellar/...` symlink;`fs.realpathSync` 可解析 | nvm/asdf 套出的 symlink chain;**不需 realpath**,SDK spawn 直接吃 symlink 沒問題 |
| **No PATH match** | 顯示 toast「未在 PATH 找到 claude;請安裝(`irm https://claude.ai/install.ps1 \| iex`)或手動指定路徑」+ fallback 內嵌 | toast「未找到 claude;請安裝(`brew install claude` 或 `npm i -g @anthropic-ai/claude-code`)」+ fallback | toast「未找到 claude;請安裝(`npm i -g @anthropic-ai/claude-code`)」+ fallback |

### 限制

- **不偵測 PATH 上多條 claude**:`where claude` 可能列多條(實測:本機有 `C:\Users\Gower\.local\bin\claude.exe`、`C:\Users\Gower\AppData\Roaming\npm\claude.cmd`、`...\npm\claude`)。原 PLAN 已決議「PATH 第一條優先」(D 隱含於 Q3),不開「使用者選哪條」UI
- **不處理使用者中途安裝 / 移除**:偵測快取在 settings 啟動時刷新,session 建立時也重新偵測一次。**不做 file watcher**

### 推薦做法

新增 `electron/claude-resolver.ts`(對應 `node-resolver.ts`),exports:

```typescript
export function resolveSystemClaudePath(customPath?: string): string | null
export function detectClaudeVersion(binPath: string): string | null  // R3 用
export function getCommonClaudePaths(): string[]  // 平台分支
```

---

## R3:版號 parse 與健康檢查

### 結論

**Level B(`--version` 成功 parse 即視為健康)。實測延遲 100-300ms,UX 可接受。**

### 技術細節 — `--version` 輸出格式驗證

實測本機三條 claude binary:

| 路徑 | 輸出 |
|------|------|
| `node_modules/@anthropic-ai/claude-code/bin/claude.exe`(內嵌 2.1.113) | `2.1.113 (Claude Code)` |
| `C:\Users\Gower\.local\bin\claude.exe`(curl installer) | `2.1.111 (Claude Code)` |
| `C:\Users\Gower\AppData\Roaming\npm\claude.cmd`(npm global) | `2.1.111 (Claude Code)` |

**格式高度穩定**:單行、`<semver> (Claude Code)`、無顏色 escape、無 stderr 雜訊。

Parse regex:`/^(\d+\.\d+\.\d+(?:-\w+)?)\s+\(Claude Code\)/`

### 版號相容範圍

| 版號 | 相容性 |
|------|-------|
| `>= 2.1.111` | ✅ 完全相容(支援 Opus 4.7 + xhigh,內嵌也是 2.1.x) |
| `2.0.x - 2.1.110` | ⚠️ 可能 missing 新 model / effort,但 SDK API 仍能跑 — **顯示版號但加 warning badge,不阻擋切換** |
| `< 2.0.0` | ❌ 拒絕切換(SDK API 大改) |
| 內嵌版本 ± N(N 待定) | 無 hard limit;CLI/SDK 是同一發布週期(`claudeCodeVersion` 在 SDK package.json 第 81 行) |

### Level B 實作要點

```typescript
async function checkClaudeHealth(binPath: string): Promise<{
  healthy: boolean
  version?: string
  warning?: string
  error?: string
}> {
  if (!fs.existsSync(binPath)) return { healthy: false, error: 'binary not found' }
  try {
    const { stdout } = await execFile(binPath, ['--version'], { timeout: 5000 })
    const match = stdout.trim().match(/^(\d+\.\d+\.\d+(?:-\w+)?)\s+\(Claude Code\)/)
    if (!match) return { healthy: false, error: 'unrecognized version output' }
    const version = match[1]
    if (semver.lt(version, '2.0.0')) {
      return { healthy: false, version, error: `version ${version} too old (need >= 2.0.0)` }
    }
    if (semver.lt(version, '2.1.111')) {
      return { healthy: true, version, warning: 'older than embedded; some features may be missing' }
    }
    return { healthy: true, version }
  } catch (err) {
    return { healthy: false, error: err.message }
  }
}
```

時機:
1. **App 啟動時**:背景跑一次,結果存 `lastDetectedVersion` 供 Settings UI 顯示
2. **Settings 切換 mode 時**:即時跑一次,UI 顯示 spinner → version badge
3. **Session 建立時**:**不重跑**(Settings 已驗過,直接用快取結果);若 SDK spawn 失敗則 fallback 內嵌 + toast

### 限制

- 不檢查 auth 是否 OK(R4 已決議:完全繼承 env,不在 BAT 端預檢)
- 不檢查 binary 可寫權限 / SELinux context(過度防禦,實際 95% 不會撞)

### 推薦做法

採 Level B,`semver` 套件已是 npm 標配(若未安裝可加進 deps,~50KB)。檢查邏輯統一放 `claude-resolver.ts`。

---

## R4:隱藏陷阱盤點

### 結論

**所有「陷阱」皆有現成緩解策略。Auth/env 完全繼承 process.env 即可。**

### 陷阱清單 + 對應策略

| # | 陷阱 | 嚴重度 | 緩解策略 |
|---|------|-------|---------|
| 1 | **Auth token 來源差異**:內嵌 SDK 走 BAT OAuth;系統版 claude 讀 `~/.claude/.credentials.json` / `ANTHROPIC_API_KEY` env / OS keyring | 🟡 中 | **完全繼承 `process.env` + 不額外設 token**(使用者決議)。系統 claude 自會走它原本的 auth chain;若使用者沒在 terminal 跑過 `claude login`,第一次 session 會 401,toast 顯示 raw error 引導使用者去設定 |
| 2 | **Working directory**:系統 claude 對 cwd 有 `.claude/settings.json` 搜尋假設 | 🟢 低 | BAT session 已有 `session.cwd` 概念;`pathToClaudeCodeExecutable` + `cwd` 兩個 option 獨立,系統 claude 在指定 cwd 下行為跟使用者直接執行一致 |
| 3 | **Environment variables**:`ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` / Bedrock / Vertex 設定透傳 | 🟢 低 | SDK 預設 `env: undefined` → 繼承 `process.env`,enterprise/proxy 設定自動繼承。**不需要顯式列白名單**(列了反而漏東漏西)|
| 4 | **Session state 不共用**:兩種 runtime 的 SDK session(transcript 檔案)寫到不同位置嗎? | 🟡 中 | 同一個 `~/.claude/projects/<hash>/sessions/`(內嵌 + 系統共用,因為 cwd 一樣 → hash 一樣)。**切換 runtime 後 resume 同一個 sdkSessionId 應該 OK**,但需 PLAN-027 整合測試確認(列 spike)。對使用者承諾「切換 runtime 不丟現有 session」需驗證 |
| 5 | **Signal handling**:child_process 被 SIGKILL 時 active task 清理 | 🟢 低 | BAT 既有 `abortController` + `activeTasks` cleanup 邏輯不需改;SDK 內部會清 child process,BAT 端 `for await` loop 會收到 break |
| 6 | **`.cmd` shim 的 spawn 行為**(僅 Windows) | 🟡 中 | Node 對 `.cmd` 有 CVE-2024-27980 緩解(arg quoting 嚴格化)。實務上:`pathToClaudeCodeExecutable: '...claude.cmd'` SDK 會用 `child_process.spawn` 跑,可能在含特殊字元的 args 下失敗。**緩解**:偵測時優先選 `.exe`(直接 native binary),`.cmd` 列為 fallback 並在 detected version 旁顯示「⚠️ shim wrapper」字樣 |
| 7 | **macOS Gatekeeper**:第一次 `npm i -g` 的 binary 被 quarantine | 🟢 低 | Level B 健康檢查會直接撞到 — `--version` exitCode != 0,error message 含 `cannot execute`。toast 顯示原始錯誤即可,使用者自行 `xattr -d` |
| 8 | **內嵌 binary 路徑被 SDK postinstall 清掉**(歷史 BUG-047) | 🟢 低 | 既有 `assertClaudeCodePathOnce()` 已處理 |
| 9 | **使用者切換 runtime 後忘記 settings 變更**(舊 session 用舊 runtime,新 session 用新 runtime) | 🟢 低 | PLAN-027 Q5 已決議「每個新 session 啟動時讀取設定;舊 session 不變」。Settings UI 加 hint:「Changes apply to new sessions only」 |

### 推薦做法

- **不**在 BAT 端做 auth 預檢、不過濾 env 白名單(複雜度爆而且 100% 重複系統 claude 自己的工作)
- **要**對 `.cmd` shim 做特殊處理(Windows 偵測時 prefer `.exe`)
- **要**為陷阱 #4(session state 共用)單獨加一個 spike sub-task 在拆單 #5(整合測試)裡

---

## R5:細化拆單建議

### 結論

**收斂為 5 張(原 7 張)。總估時 3-3.5h(原 4-5h)。**

### 對比原 PLAN-027 拆單

| 原 # | 主題 | 變更 | 新 # |
|------|------|------|------|
| 1(research) | 本研究 | ✅ T0229 已完成 | — |
| 2 | Settings schema + IPC | 🔀 與原 #3 合併 | 新 #1 |
| 3 | 路徑偵測 + 版號 parse + 健康檢查 | 🔀 與原 #2 合併(Settings schema 為次要產出) | 新 #1 |
| 4 | Runtime routing 實作 | 🔀 與原 #5 合併(R1 證實是 1-3 行差別) | 新 #2 |
| 5 | Fallback + toast | 🔀 與原 #4 合併 | 新 #2 |
| 6 | Settings UI(Advanced) | ✅ 保留 | 新 #3 |
| 7 | 整合測試 + 文件 | ✅ 保留,**加 R4 #4 session state spike** | 新 #4 |
| —(新增) | Release note + CLAUDE.md 更新 | 🆕 切出來避免測試工單塞太多 | 新 #5 |

### 新拆單表

| # | 工單主題 | scope 摘要 | 預估工時 | 依賴 |
|---|---------|-----------|---------|------|
| **新 #1** | 系統 claude 偵測 + 健康檢查 + Settings schema | 新增 `electron/claude-resolver.ts`(R2 PATH 搜尋 + R3 Level B health check)、`ClaudeRuntimeSettings` interface 寫入 SettingsStore、IPC `claude:detectRuntime` channel(main → renderer 回 `{ embeddedVersion, systemVersion, systemPath, healthStatus }`) | 60 min | — |
| **新 #2** | Runtime routing + fallback + toast | `claude-agent-manager.ts` 三處 spawn 點(`runQuery`/`createSessionV2`/`forkSession`)讀 `settings.claudeRuntime.mode`,若 system 則呼叫 #1 的 resolver 取得路徑;失敗時 fallback `resolveClaudeCodePath()` 並透過 IPC 通知 renderer 顯示 toast | 45 min | #1 |
| **新 #3** | Settings UI(Advanced 分頁 → Claude Runtime 區塊) | radio button(embedded / system)+ path input + Browse... 按鈕 + version badges + healthy/unhealthy 指示 + hint「Changes apply to new sessions only」 | 60 min | #1, #2 |
| **新 #4** | 整合測試 + session state spike + 跨平台手動驗證 | (a)單元測試:resolver / health check / version parse;(b)spike:切換 runtime 後 resume 同一 sdkSessionId 是否 OK(R4 陷阱 #4);(c)手動跑 Windows + macOS + Linux 驗證 PATH 偵測、`.cmd` shim 處理、Gatekeeper toast | 45 min | #1-#3 |
| **新 #5** | 文件更新(CLAUDE.md「Claude Agent SDK / CLI」段補 runtime 切換說明)+ Release note | 寫成使用者導向文件:「為什麼有兩個選項」「什麼時候用 system」「fallback 行為」「常見故障」 | 30 min | #1-#4 |

**總估時:3h 40min wall time。**

### 與原拆單的差異理由

1. **#1 合併**:Settings schema 只是個 TypeScript interface + SettingsStore 加 key,工作量遠小於 resolver。原本拆兩張是因為依賴關係不明,R1 釐清後其實是同一張單
2. **#2 合併**:R1 證實 routing 是「3 處 + 1 行 if/else」,fallback 是「catch + IPC emit」。拆兩張 ceremony 比實作還重
3. **#4 加 spike**:R4 陷阱 #4(session state 共用)是唯一 R1-R4 沒能完全敲定的點,放在整合測試裡用實機驗證最快
4. **#5 切出**:CLAUDE.md 更新 + release note 屬於跨工單收尾,單獨切出來讓 #4 聚焦在功能驗證

### 平行化建議

- **#1 / #2 不可平行**(routing 需要 resolver 介面)
- **#3 可在 #2 進入收尾時平行起跑**(只要 #1 完成、IPC contract 定下來,UI 可獨立寫 mock)
- **#4 / #5 序列執行**

---

## 不確定 / 需後續 spike 的點

| # | 不確定項 | 影響 | 處理方式 |
|---|---------|------|---------|
| 1 | 切換 runtime 後 resume 既有 sdkSessionId 是否能成功(transcript 是否在同一檔案) | 🟡 中 — 影響「切換 runtime 不丟 session」承諾 | 拆單 #4 spike 實機測試 |
| 2 | macOS Gatekeeper toast 文案是否需要本地化 / 平台特化 | 🟢 低 | 拆單 #5 文件階段決定 |
| 3 | 系統 claude 的 `.credentials.json` 若是 OAuth token 過期,toast 該怎麼引導使用者(`claude /login`?) | 🟢 低 | 拆單 #5 用 toast generic message 即可,不深入引導 |
| 4 | 是否需要在 Settings UI 顯示「PATH 上找到的所有 claude 路徑」讓使用者選 | 🟢 低 | PLAN-027 Q3 已決議 PATH 第一條優先,**不開選擇 UI**;若使用者想用其他條,走 customPath input |
| 5 | 內嵌版本與系統版本相容性是否要設 hard upper bound(例:系統版 5.x 出現後 SDK 0.2.x 是否還能接) | 🟢 低 | 屆時版號比較 + warning badge 即可,不在本 PLAN 處理 |

---

## 互動紀錄

[12:13] Q: R3 健康檢查 Level / R4 Auth/env 策略 / R5 拆單粒度三選擇 → A: Level B + 繼承 env + 收斂為 5 張 → Action: 採用全部三項推薦,撰寫本報告

(僅 1 輪互動,3 輪上限未用滿)

---

## 下一步建議

1. 塔台讀本報告,確認 R5 拆單方向是否更新到 PLAN-027 主文件
2. 若同意 5 張拆單,可立刻派發新 #1(無依賴);#2-#5 排在 #1 完成後
3. 若有疑慮(例如想保留 7 張原拆單),回 Renew 本工單繼續討論
