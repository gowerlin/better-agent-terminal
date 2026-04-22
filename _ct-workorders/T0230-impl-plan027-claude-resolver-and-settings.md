# T0230 — 實作:系統 claude 偵測 + 健康檢查 + Settings schema(PLAN-027 Phase 1 #1)

## 元資料

- **編號**:T0230
- **類型**:implementation(實作工單)
- **狀態**:🔄 IN_PROGRESS
- **開始時間**:2026-04-22 12:38 (UTC+8)
- **建立時間**:2026-04-22 12:35 (UTC+8)
- **派發時間**:2026-04-22 12:35 (UTC+8)
- **派發模式**:`--mode yolo --interactive`(scope 清楚但保留互動空間給實作細節判斷)
- **優先級**:🟡 Medium(PLAN-027 Phase 1 起手,阻擋 #2/#3)
- **前置條件**:T0229 ✅ DONE(`b622b6e`,研究報告 `_report-plan027-claude-runtime-selection.md`)
- **關聯**:PLAN-027 #1、T0229 研究報告、`electron/node-resolver.ts`(複用模式)、`electron/settings-store.ts`(擴充目標)、`electron/claude-agent-manager.ts`(下游消費者,#2 處理)
- **預估時間**:60 min
- **Renew 次數**:0

## 背景

T0229 研究結論:SDK 已官方支援 `pathToClaudeCodeExecutable` option(BAT 既有程式碼已用),因此核心 routing 僅需換 path 字串,但前提是要能**可靠偵測系統 claude binary + 健康檢查 + 對外暴露**。本工單交付 Phase 1 基礎設施,不動 agent-manager 的 routing(交 T0231/#2)。

## 實作範圍

### 必改(三件事,全在 main process)

#### 1. 新增 `electron/claude-resolver.ts`

**職責**:跨平台偵測系統 `claude` binary + 版號 parse + 健康檢查。

**API 設計**:

```typescript
export interface ClaudeRuntimeInfo {
  path: string;           // 偵測到的絕對路徑
  version: string;        // parse 後的 semver(例 "2.1.113")
  versionRaw: string;     // 原始輸出(例 "2.1.113 (Claude Code)")
  healthStatus: 'healthy' | 'version-too-old' | 'version-warning' | 'spawn-failed';
  source: 'path' | 'common-location' | 'custom';  // 偵測來源
}

export async function detectSystemClaude(customPath?: string): Promise<ClaudeRuntimeInfo | null>;
export async function probeClaudeHealth(binaryPath: string): Promise<{ version: string; versionRaw: string } | null>;
```

**偵測邏輯**(依 T0229 R2):
1. 若傳入 `customPath` → 直接走健康檢查
2. PATH 搜尋:依平台展開 `PATH` 環境變數,找 `claude`(Unix)或 `claude.exe` / `claude.cmd` / `claude.bat`(Windows)
3. 常見路徑 fallback:
   - macOS:`/opt/homebrew/bin/claude`、`/usr/local/bin/claude`
   - Linux:`~/.local/bin/claude`、`/usr/local/bin/claude`
   - Windows:`%LOCALAPPDATA%\...`(視 anthropic installer 實際位置,研究報告有提)
4. Windows 特殊處理:同目錄同時存在 `.exe` 和 `.cmd`/`.bat` 時,**優先選 `.exe`**(避 Node `.cmd` CVE 行為,R4 陷阱)
5. 偵測到路徑後 → `probeClaudeHealth()`

**健康檢查**(依 T0229 R3 Level B):
1. `spawn(binaryPath, ['--version'], { timeout: 5000 })`
2. stdout 用 regex `/^(\d+\.\d+\.\d+(?:-\w+)?)\s+\(Claude Code\)/` parse
3. 版號相容判定:
   - `>= 2.1.111`:`healthy`
   - `>= 2.0.0` 且 `< 2.1.111`:`version-warning`(缺 Opus 4.7 / xhigh,但 SDK 可接)
   - `< 2.0.0`:`version-too-old`(拒絕)
   - spawn 失敗 / parse 失敗 / timeout:`spawn-failed`

**複用 `node-resolver.ts` 模式**:參考該檔案的 PATH 搜尋 + platform fallback 結構,別重造輪子。

#### 2. 擴充 `electron/settings-store.ts`

**新增 interface + 預設值**:

```typescript
export interface ClaudeRuntimeSettings {
  mode: 'embedded' | 'system';        // 預設 'embedded'
  customPath?: string;                // 使用者手動指定(system 模式用),選填
  fallbackToEmbedded: boolean;        // 預設 true(偵測或健康檢查失敗時自動退回內嵌)
}

// 在 Settings interface 加入
claudeRuntime: ClaudeRuntimeSettings;
```

**預設值**:
```typescript
{
  mode: 'embedded',
  fallbackToEmbedded: true,
}
```

**持久化**:依 settings-store 既有 schema / migration 模式處理(找 `version` 欄位或 migration 區塊)。

#### 3. 新增 IPC handler `claude:detectRuntime`

**位置**:`electron/main.ts` 或獨立 IPC 檔(依既有慣例)。

**Handler**:
```typescript
ipcMain.handle('claude:detectRuntime', async (_, customPath?: string) => {
  const embeddedVersion = await probeClaudeHealth(resolveClaudeCodePath());
  const systemInfo = await detectSystemClaude(customPath);

  return {
    embedded: {
      version: embeddedVersion?.version ?? 'unknown',
      path: resolveClaudeCodePath(),
      healthStatus: embeddedVersion ? 'healthy' : 'spawn-failed',
    },
    system: systemInfo,  // null 代表系統未安裝
  };
});
```

**renderer preload bridge**:在 `preload.ts` 或 electronAPI 定義裡加對應 bridge,讓 renderer 用 `window.electronAPI.claude.detectRuntime(customPath?)` 呼叫。

### 不改(本工單範圍外)

- ❌ `claude-agent-manager.ts` 任何 spawn 點(交 T0231 / #2)
- ❌ UI 組件(交 T0232 / #3)
- ❌ Runtime routing 邏輯(交 T0231 / #2)
- ❌ CLAUDE.md 文件(交 T0234 / #5)

## Acceptance Criteria

- [ ] **AC-1**:`electron/claude-resolver.ts` 存在,export `detectSystemClaude` 和 `probeClaudeHealth`,interface 與上文一致
- [ ] **AC-2**:`ClaudeRuntimeInfo` 型別包含所有欄位,`healthStatus` 四種值齊全
- [ ] **AC-3**:版號 parse regex `/^(\d+\.\d+\.\d+(?:-\w+)?)\s+\(Claude Code\)/` 實作正確,三個版本(healthy / warning / too-old)判定符合 T0229 R3 規格
- [ ] **AC-4**:Windows `.cmd` / `.bat` / `.exe` 三種 shim 在同目錄時,`.exe` 優先(避 CVE)
- [ ] **AC-5**:`settings-store.ts` 新增 `claudeRuntime` 欄位,預設值 `{ mode: 'embedded', fallbackToEmbedded: true }`,持久化正常
- [ ] **AC-6**:IPC channel `claude:detectRuntime` 實作完成,preload bridge 加好,renderer 可呼叫取得 `{ embedded, system }` 結果
- [ ] **AC-7**:`npm run lint` + `npx tsc --noEmit` 通過(無新增 TS error / lint error)
- [ ] **AC-8**:**不修改** `claude-agent-manager.ts` 的 spawn 點(這是 #2 的範圍)
- [ ] **AC-9**:單元測試不強制,但若新增 `tests/electron/claude-resolver.test.ts` 覆蓋 version parse 則加分

## 驗收依據

1. `_report-plan027-claude-runtime-selection.md`(T0229 交付)— 特別是 R2/R3/R4 章節
2. `electron/node-resolver.ts` — PATH 搜尋 / 平台分支參考模式
3. `electron/settings-store.ts` 現有 schema migration 模式

## 產出位置

- 新檔:`electron/claude-resolver.ts`
- 修改:`electron/settings-store.ts`、`electron/main.ts`(或對應 IPC 檔)、`electron/preload.ts`(或對應 bridge)
- 選配:`tests/electron/claude-resolver.test.ts`

## 風險與備註

- **R1 - PATH 解析失敗**:某些環境 `process.env.PATH` 可能為空或怪異格式 → 做 null 防護,失敗即回 null(不 throw)
- **R2 - 健康檢查 timeout**:5s 夠長但不誇張。spawn 本身失敗(ENOENT)也要計入 `spawn-failed`
- **R3 - Windows 路徑大小寫**:PATH 搜尋不區分大小寫(Windows 原生行為)
- **R4 - 互動時機**:Worker 若遇到 settings-store 的 migration 寫法不確定、或某個 edge case 該怎麼處理,**可回塔台問**(本單 `--interactive`)。非卡關狀況就自決推進
- **R5 - 單元測試範圍**:若寫測試,只測 `probeClaudeHealth` 的 regex parse 和 version compat 判定;不測 `detectSystemClaude`(涉及檔案系統,整合測試交 T0233)

## 回報區

### 完成狀態

✅ DONE — PLAN-027 Phase 1 #1 基礎設施交付完畢,T0231/#2 可接手 routing。

### 產出摘要

- **Commit hash**:(填於 commit 後)
- **新增檔案**:
  - `electron/claude-resolver.ts`(~210 行,export `detectSystemClaude` / `probeClaudeHealth` / `__test__`)
  - `tests/claude-resolver.test.ts`(17 個 test cases,覆蓋 regex parse、semver compare、版號分類)
- **修改檔案**:
  - `src/types/index.ts` — 新增 `ClaudeRuntimeMode` / `ClaudeRuntimeSettings` / `DEFAULT_CLAUDE_RUNTIME_SETTINGS`,`AppSettings` 加 `claudeRuntime?` 欄位
  - `src/stores/settings-store.ts` — `defaultSettings` 加 `claudeRuntime`,新增 `getClaudeRuntime()` / `setClaudeRuntime(updates)` 方法
  - `electron/main.ts` — 註冊 IPC handler `claude:detectRuntime`(回傳 `{ embedded, system }` 結構)
  - `electron/preload.ts` — `electronAPI.claude.detectRuntime(customPath?)` bridge
  - `electron/remote/protocol.ts` — `PROXIED_CHANNELS` 加入 `claude:detectRuntime`(讓 remote profile 也能跑偵測)
- **AC 勾選**:
  - [x] **AC-1**:`electron/claude-resolver.ts` 存在,export `detectSystemClaude` 和 `probeClaudeHealth`
  - [x] **AC-2**:`ClaudeRuntimeInfo` 含 `path/version/versionRaw/healthStatus/source`,`healthStatus` 四值齊全(`healthy` / `version-warning` / `version-too-old` / `spawn-failed`)
  - [x] **AC-3**:版號 regex `/^(\d+\.\d+\.\d+(?:-[\w.]+)?)\s+\(Claude Code\)/`,boundary 行為驗證(`2.1.111` healthy / `2.0.0` warning / `1.9.99` too-old)— 17 個 unit test 全綠
  - [x] **AC-4**:Windows 偵測時 `WINDOWS_BIN_NAMES = ['claude.exe', 'claude.cmd', 'claude.bat']`,`.exe` 在 list 第一位,同目錄掃描時優先選 `.exe`(避 CVE)
  - [x] **AC-5**:`AppSettings.claudeRuntime` + `defaultSettings` 預設值 `{ mode: 'embedded', fallbackToEmbedded: true }`,持久化沿用既有 `{ ...defaultSettings, ...parsed }` migration(無新欄位也安全)
  - [x] **AC-6**:IPC channel `claude:detectRuntime` 實作完成,preload bridge `window.electronAPI.claude.detectRuntime()` 可用,回傳結構 `{ embedded, system }`
  - [x] **AC-7**:`npx tsc --noEmit` exit 0;專案無 `lint` script(`package.json` 無 eslint dep),lint 部分不適用
  - [x] **AC-8**:**未修改** `claude-agent-manager.ts` 任何 spawn 點(grep 確認:整支檔案無動)
  - [x] **AC-9**:`tests/claude-resolver.test.ts` 加分項已交付,17/17 通過
- **lint / tsc 結果**:
  - lint:N/A(專案無 ESLint 配置)
  - tsc:`npx tsc --noEmit` → exit 0
  - unit test:`npx tsx tests/claude-resolver.test.ts` → 17 passed, 0 failed

### 遭遇問題

1. **工單路徑筆誤**:工單寫「擴充 `electron/settings-store.ts`」,但實際 settings 在 `src/stores/settings-store.ts`(renderer 端,透過 IPC 持久化到 main 的 `settings.json`)。Worker 自決推進,寫到正確位置(`src/types/index.ts` 加 interface、`src/stores/settings-store.ts` 加 setter),不影響 AC-5 行為。建議 PLAN-027 後續工單(T0231/T0232)直接引用 `src/types/index.ts` 的 `ClaudeRuntimeSettings`,別再複製到 electron/。
2. **AC-7 lint 不適用**:本專案 `package.json` 無 `lint` script、無 eslint dep。tsc 已過,認定 AC-7 滿足。

### 互動紀錄

無(YOLO + interactive 模式但無實質決策需要使用者介入)。

### Renew 歷程

無。
