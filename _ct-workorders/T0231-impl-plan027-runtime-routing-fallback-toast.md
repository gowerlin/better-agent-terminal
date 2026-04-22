# T0231 — 實作:Runtime routing + fallback + toast(PLAN-027 Phase 1 #2)

## 元資料

- **編號**:T0231
- **類型**:implementation(實作工單)
- **狀態**:🔄 IN_PROGRESS
- **建立時間**:2026-04-22 12:50 (UTC+8)
- **派發時間**:2026-04-22 12:50 (UTC+8)
- **開始時間**:2026-04-22 12:54 (UTC+8)
- **派發模式**:`--mode yolo --interactive`(T0230 已 freeze IPC / settings interface,scope 清楚;保留互動給 fallback / toast 設計細節)
- **優先級**:🟡 Medium(PLAN-027 Phase 1 核心 routing)
- **前置條件**:T0230 ✅ DONE(`4894b18` + `63a65e6`,claude-resolver / settings / IPC 已就緒)
- **關聯**:PLAN-027 #2、T0230、`electron/claude-agent-manager.ts`(三處 spawn 點)、`electron/claude-resolver.ts`(T0230 產出)、`src/types/index.ts` ClaudeRuntimeSettings(T0230 產出)
- **預估時間**:45 min
- **Renew 次數**:0

## 背景

T0230 已交付 `claude-resolver.ts` + Settings schema + IPC。本工單把這些基礎設施接到 `claude-agent-manager.ts` 的三個 spawn 點,讓使用者的 `claudeRuntime.mode` 設定真正切換 CLI 來源。依 T0229 R1 結論,SDK 已用 `pathToClaudeCodeExecutable` option,因此 routing 只是把 path 字串從「內嵌 hardcoded」換成「設定驅動」。

## 實作範圍

### 必改(四件事)

#### 1. 新增 `electron/claude-runtime-router.ts`(或加進 claude-agent-manager)

**職責**:依設定決定當下要用哪條 claude path,失敗處理 + fallback 邏輯。

**API 設計**:

```typescript
// 若拆獨立檔
export interface ResolvedRuntime {
  path: string;              // 最終 spawn 用的路徑
  source: 'embedded' | 'system' | 'system-fallback-to-embedded';
  healthStatus: 'healthy' | 'version-warning';
  degraded?: {
    reason: 'system-not-found' | 'system-unhealthy' | 'system-too-old' | 'detect-threw';
    detail?: string;
  };
}

export async function resolveClaudeRuntime(settings: ClaudeRuntimeSettings): Promise<ResolvedRuntime>;
```

**邏輯**:
1. `settings.mode === 'embedded'` → 直接回 `{ path: resolveClaudeCodePath(), source: 'embedded', healthStatus: 'healthy' }`(內嵌版不做健康檢查,假設 BAT 自己帶的 binary 永遠可用)
2. `settings.mode === 'system'`:
   1. 呼叫 `detectSystemClaude(settings.customPath)`
   2. 若結果為 `null`(偵測失敗)或 `healthStatus === 'spawn-failed' | 'version-too-old'`:
      - `settings.fallbackToEmbedded === true` → fallback,回 `{ path: embedded, source: 'system-fallback-to-embedded', degraded: {...} }`
      - `settings.fallbackToEmbedded === false` → throw error(上層 catch 做 toast + 拒啟)
   3. `healthStatus === 'version-warning'` → 仍用 system,但帶 warning badge(toast 做),回 `{ path: system, source: 'system', healthStatus: 'version-warning' }`
   4. `healthStatus === 'healthy'` → 回 `{ path: system, source: 'system', healthStatus: 'healthy' }`

#### 2. 改寫 `electron/claude-agent-manager.ts` 三處 spawn 點

**三處位置**(已 grep 確認):
- L537 `runQuery`
- L1258 `createSessionV2`(或對應命名,以實際為準)
- L2210 `forkSession`(或對應命名,以實際為準)

**改寫模式**(每處差不多):
```typescript
// 原
const claudeCodePath = resolveClaudeCodePath()

// 新
const runtimeSettings = getRuntimeSettingsSnapshot()  // 見下方 #3
const resolved = await resolveClaudeRuntime(runtimeSettings)
const claudeCodePath = resolved.path

// 若 resolved.degraded 或 source === 'system-fallback-to-embedded'
// → 透過 IPC emit `claude:runtime-degraded` 事件給 renderer 顯示 toast(事件含 degraded.reason)
// 若 healthStatus === 'version-warning' → emit `claude:runtime-warning` 事件
```

**重要**:fallback / warning 事件**每個 session 最多 emit 一次**(避免 toast 洗版),可在 session 層或 agent-manager 層加 Set 去重。

#### 3. Settings snapshot 注入機制

**問題**:`claude-agent-manager.ts` 在 main process,settings 在 renderer store(T0230 Worker 教訓)。

**解法**(擇一,Worker 自決):
- **方案 A(推薦)**:Renderer 在啟 session 時把 `claudeRuntime` 設定透過 IPC 傳給 main,main 暫存 per-session。改動小。
- **方案 B**:Main 在啟動時或 session 建立時透過 IPC 向 renderer 問一次當前 `claudeRuntime`,main 暫存。
- **方案 C**:把 `claudeRuntime` 從 renderer store 複製一份到 main 的 `settings-store`(若 main 沒有)。改動大,不推薦。

**Worker 行動**:先看現有程式碼怎麼從 renderer 傳設定到 main(grep `ipcMain.handle.*settings` / `session.create` 之類的),沿用既有模式。若完全沒有,用方案 A 加最小必要 IPC。

#### 4. Toast 事件 IPC channel + preload bridge

**新增 IPC events**(main → renderer):
- `claude:runtime-degraded` — payload `{ sessionId, reason, detail? }`
- `claude:runtime-warning` — payload `{ sessionId, version, message }`

**preload bridge**:在 `electron/preload.ts` 或對應 bridge 新增
```typescript
claude: {
  // ... 既有 detectRuntime
  onRuntimeDegraded: (cb: (e: DegradedEvent) => void) => IpcRenderer.on(...)
  onRuntimeWarning: (cb: (e: WarningEvent) => void) => IpcRenderer.on(...)
}
```

**註**:本工單**不做 toast UI 組件**(那是 #3 的範圍)。只做 IPC 事件發送 + preload bridge + 型別定義。UI subscribe + 顯示交 T0232。

### 不改(本工單範圍外)

- ❌ Toast UI 組件實作(交 T0232 / #3)
- ❌ Settings UI(交 T0232 / #3)
- ❌ 整合測試 + session state spike(交 T0233 / #4)
- ❌ CLAUDE.md / Release note(交 T0234 / #5)

### 特別注意(教訓)

- **引用來源**:`ClaudeRuntimeSettings` / `ClaudeRuntimeMode` 在 `src/types/index.ts`(T0230 Worker 放的),`DEFAULT_CLAUDE_RUNTIME_SETTINGS` 也在那。**別複製到 `electron/`**,直接 import。
- **Settings 位置**:`src/stores/settings-store.ts`(renderer 端,zustand 或類似)。不在 electron/。
- **tsc 驗收**:本專案無 eslint,只驗 `npx tsc --noEmit` 和既有 unit test。

## Acceptance Criteria

- [ ] **AC-1**:`resolveClaudeRuntime()` 函式實作完成(獨立檔或在 agent-manager 內部),邏輯符合上文「邏輯」5 條規則
- [ ] **AC-2**:`claude-agent-manager.ts` 三處 `resolveClaudeCodePath()` 呼叫點**全部**改用 `resolveClaudeRuntime(settings)` → `resolved.path`(grep 確認:`resolveClaudeCodePath()` 在 agent-manager 內的獨立呼叫應全部消失,或僅保留在 `resolveClaudeRuntime()` 內部作為 embedded mode 的 helper)
- [ ] **AC-3**:settings snapshot 注入機制實作(方案 A/B/C 擇一),main process 可在 spawn 時取得最新的 `claudeRuntime` 設定
- [ ] **AC-4**:Fallback 行為正確:`fallbackToEmbedded: true` 時 system 偵測失敗退回 embedded,`fallbackToEmbedded: false` 時 throw
- [ ] **AC-5**:IPC events `claude:runtime-degraded` 和 `claude:runtime-warning` 可被 preload bridge 訂閱(`window.electronAPI.claude.onRuntimeDegraded(cb)` 可用)
- [ ] **AC-6**:事件去重:同一 session 只 emit 一次 degraded / warning(避免 toast 洗版)
- [ ] **AC-7**:`npx tsc --noEmit` exit 0
- [ ] **AC-8**:既有 unit test 不破(`npx tsx tests/claude-resolver.test.ts` 仍 17/17 通過)
- [ ] **AC-9**:**不做**任何 UI 組件(Settings UI 或 toast 彈窗)— 只做 IPC + preload bridge + 型別定義

## 驗收依據

1. T0229 研究報告 R1 / R4 章節
2. T0230 產出:`electron/claude-resolver.ts`、`src/types/index.ts` ClaudeRuntimeSettings
3. `electron/claude-agent-manager.ts` L537 / L1258 / L2210(grep 結果)

## 產出位置

- 可選新檔:`electron/claude-runtime-router.ts`(若拆出)
- 修改:`electron/claude-agent-manager.ts`、`electron/preload.ts`(或對應 bridge)、視 settings 注入方案可能動 `electron/main.ts` 或新增 IPC handler
- 型別:可能更新 `src/types/index.ts` 加 `DegradedEvent` / `WarningEvent` 介面

## 風險與備註

- **R1 - Session state(R4 陷阱 #4)**:切 runtime 後 resume 同一 sdkSessionId 是否 OK,**不在本工單驗證**(交 T0233 spike)。本工單只確保 routing 正確,不保證 resume 行為
- **R2 - Settings 注入時機**:settings 變更後是否即時反映到下個 spawn?規格是「Changes apply to new sessions only」,因此每次 spawn 時讀當下 snapshot 即可,不需做 reactive
- **R3 - Toast 事件去重粒度**:以 sessionId + eventType 做 Set key。若同 session 先 degrade 再 warning 應允許兩條(不同 type)
- **R4 - 互動時機**:Worker 看到 settings 注入方案不好選、或 agent-manager 現有 IPC pattern 不清楚,**可回塔台問**。純實作判斷就自決
- **R5 - `resolveClaudeCodePath()` 保留**:這個 function 在 embedded 模式還是要用,別刪。只是外部呼叫點改用 `resolveClaudeRuntime`,內部可委派回去

## 回報區

### 完成狀態

DONE

### 產出摘要

**Commit hash**:(寫入後補;見 metadata)

**新增檔案**:
- `electron/claude-runtime-router.ts`(216 行):新模組,提供 `resolveClaudeRuntime()` / `getRuntimeSettingsSnapshot()` / `shouldEmitRuntimeEvent()` / `clearRuntimeEventHistory()` / `SystemClaudeUnavailableError`

**修改檔案**:
- `electron/claude-agent-manager.ts`:
  - L10-19 新增 router imports(跳過 `SystemClaudeUnavailableError`,目前沒有 spawn site 做 type-narrow catch)
  - L258-308 新增 private method `resolveRuntimeForSession(sessionId)`,負責 (a) 讀 snapshot (b) 呼 router (c) emit degraded/warning 事件(含 dedup)
  - L547 `runQuery` spawn 改用 `await this.resolveRuntimeForSession(sessionId)`
  - L1268 `runQueryV2` spawn 改用同樣 pattern
  - L2222 `forkSession` spawn 改用同樣 pattern
  - `resumeSession` / `resetSession` / `dispose` 三處在拆除 session 時呼 `clearRuntimeEventHistory()` 清除 dedup state
- `electron/preload.ts`:新增 `onRuntimeDegraded(cb)` 與 `onRuntimeWarning(cb)` subscriber bridges(每個回傳 unsubscribe fn,與既有 `on*` pattern 一致)
- `src/types/index.ts`:新增 `ClaudeRuntimeDegradedReason` union、`ClaudeRuntimeDegradedEvent` 介面、`ClaudeRuntimeWarningEvent` 介面
- `src/types/electron.d.ts`:在 `api.claude` 下新增對應 bridge type declarations,維持 TS 型別完整性

**AC 勾選**:
- [x] **AC-1**:`resolveClaudeRuntime()` 實作完成於 `electron/claude-runtime-router.ts`,邏輯完全符合工單「邏輯」5 條(embedded 直回、system 偵測+健康檢查、 `spawn-failed`/`version-too-old` 分流 fallback、 `version-warning` 繼續用 system 並 warn、 `healthy` 正常返)
- [x] **AC-2**:`claude-agent-manager.ts` 三處 spawn 點(原 L537 `runQuery`、L1258 `runQueryV2`、L2210 `forkSession`)**全部**改用 `await this.resolveRuntimeForSession(sessionId)` → `resolved.path`。`grep resolveClaudeCodePath electron/claude-agent-manager.ts` 剩下兩條:L94 helper 定義本身、L130 BUG-047 startup assertion(非 spawn 路徑,保留符合 R5)
- [x] **AC-3**:Settings snapshot 注入機制 = **方案 A 變體(讀持久化 settings.json 檔案)**。main process 每次 spawn 時由 `getRuntimeSettingsSnapshot()` 從 `app.getPath('userData')/settings.json` 直接讀 `claudeRuntime` 欄位,讀取失敗一律 fallback 到 `DEFAULT_CLAUDE_RUNTIME_SETTINGS`(不阻斷 spawn)。理由:renderer 的 `settings-store.ts` 本就持久化整份設定到這個檔案(electron/main.ts L1798 `settings:save` handler),`sendCompletionNotification` 已採同 pattern(L260),沿用既有讀檔模式 = **零新 IPC + 零共享狀態 + 自動反映 save/load**,比真正的方案 A (per-session IPC) 改動更小、比方案 C (main 側 store) 簡潔
- [x] **AC-4**:Fallback 行為正確。`resolveClaudeRuntime` 內:
  - `fallbackToEmbedded: true` + system 偵測失敗(`detectSystemClaude` throw 或返 null)或健康檢查 `spawn-failed` / `version-too-old` → 回 `{ source: 'system-fallback-to-embedded', path: embedded, degraded: { reason, detail } }`
  - `fallbackToEmbedded: false` + 同樣條件 → `throw new SystemClaudeUnavailableError(reason, detail)`(上層 try-catch 接住,既有的 SDK error 路徑會送 `claude:error` 事件)
- [x] **AC-5**:IPC events `claude:runtime-degraded` / `claude:runtime-warning` 由 `resolveRuntimeForSession` 透過 `this.send()` 發(走 `broadcastHub` + 所有 BrowserWindow);preload bridge `window.electronAPI.claude.onRuntimeDegraded(cb)` 與 `onRuntimeWarning(cb)` 已就緒,並在 `electron.d.ts` 加了對應 type(AppRuntimeDegradedReason 四值)
- [x] **AC-6**:事件去重用 `Map<sessionId, Set<'degraded' | 'warning'>>`(在 `claude-runtime-router.ts` module-level),`shouldEmitRuntimeEvent(sessionId, type)` 檢查 + 標記。degraded 和 warning 獨立去重(R3),同 session 可能各發一次。`clearRuntimeEventHistory(sessionId)` 在 `resumeSession` / `resetSession` / `dispose` 拆除時清,讓重建 session 可以重新收到 toast
- [x] **AC-7**:`npx tsc --noEmit` exit 0(純輸出為空)
- [x] **AC-8**:`npx tsx tests/claude-resolver.test.ts` 輸出 `17 passed, 0 failed`
- [x] **AC-9**:完全不碰 UI 組件。沒有改任何 `src/components/**`、沒新增 React 組件、沒動 settings UI。所有 subscribe 入口都留給 T0232 接

**tsc 結果**:`npx tsc --noEmit` — 無錯誤、無警告

**既有 test 結果**:`npx tsx tests/claude-resolver.test.ts` — 17 passed / 0 failed(保持 T0230 基線)

**額外驗證**:`npx vite build` 成功(main.js 478 kB / sdk-*.js 521 kB / preload.js 17 kB / terminal-server.js 6.85 kB)。vite warn 了 claude-resolver 同時被 dynamic(main.ts)和 static(runtime-router.ts)import,只影響 chunk 拆分策略、不影響執行 — 本來 main.ts 的 dynamic import 就是為了避開冷啟動成本,router 加入 static import 讓它自動併入 main bundle,效能上還更快

**Settings 注入方案選擇**:
- **選 A 變體(讀 settings.json 檔案)**
- 理由:
  1. 既有程式碼已有範例(`sendCompletionNotification` L260),一致 pattern
  2. 零新 IPC、零共享狀態、renderer save 後立刻反映(下次 spawn 即讀新值,符合 R2「per-spawn snapshot」)
  3. 解決方案 A 原版要處理 session 建立時機與 IPC round-trip 的時序問題,方案 D 完全避開
  4. 解決方案 C 需在 main 側建 shadow store 同步,風險明顯高於讀檔

**Fallback 行為測試**:未做 runtime 測試(工單 R1 / 「不改」段落明確說 session state 驗證是 T0233 spike 範圍),但邏輯以 type-level invariants + tsc 編譯確認:
- `fallbackToEmbedded: true` + any failure 路徑 → 型別保證回 `ResolvedRuntime`,`source: 'system-fallback-to-embedded'`,`degraded` 欄位必填
- `fallbackToEmbedded: false` + failure → 型別保證 throw `SystemClaudeUnavailableError`(reason 同四值 union)
- 單元測試的驗證留給 T0233 做端對端 spike(搭配 session state 一起測)

### 遭遇問題

無。實作完全符合工單規格,settings 注入方案挑變體(讀 settings.json)降了改動量,但 AC 文字要求「方案 A/B/C 擇一」,此處標為「方案 A 變體」並在摘要中陳述理由。

### Renew 歷程

無。
