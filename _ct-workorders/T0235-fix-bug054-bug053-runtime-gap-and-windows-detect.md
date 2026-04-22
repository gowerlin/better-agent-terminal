# T0235 — 修復:BUG-054 runtime 覆蓋缺口 + BUG-053 Windows 偵測簡化(PLAN-027 Phase 1 hotfix)

## 元資料

- **編號**:T0235
- **類型**:fix(合併兩 BUG 修復)
- **狀態**:✅ FIXED
- **建立時間**:2026-04-22 19:25 (UTC+8)
- **派發時間**:2026-04-22 19:25 (UTC+8)
- **開始時間**:2026-04-22 19:34 (UTC+8)
- **完成時間**:2026-04-22 19:45 (UTC+8)
- **Commit**:`058412a`
- **派發模式**:`--mode yolo --interactive`(auth handler 修法可能需判斷,保留互動)
- **優先級**:🟡 Medium(PLAN-027 Phase 1 真正閉環的 blocker)
- **前置條件**:T0230 / T0231 / T0232 / T0233 全 DONE,PLAN-027 Phase 1 程式碼到位
- **關聯**:
  - BUG-054(主修,runtime 切換漏覆蓋 terminal + auth)
  - BUG-053(附修,Windows `.cmd`/`.bat` shim EINVAL)
  - PLAN-027 #2 遺漏的 spawn 點
  - T0229 研究報告 R4(scope 缺口反省)
  - `electron/main.ts` L1881 / L1984 / L2003(主改)
  - `electron/claude-resolver.ts` L93 `WINDOWS_BIN_NAMES`(附修)
- **預估時間**:45 min
- **Renew 次數**:0

## 背景

使用者 runtime 驗收 PLAN-027 Phase 1 時發現:**切 system mode 後開終端 claude-cli preset,實際 spawn 仍為內嵌版**(BUG-054)。

Root cause 確認:T0231 只改了 `claude-agent-manager.ts` 三處 SDK spawn,**沒涵蓋 `electron/main.ts` 的 IPC handlers**(`claude:get-cli-path` + auth handlers)。T0229 R4 研究階段盤點缺口。

同時附帶處理 BUG-053:Windows `.cmd`/`.bat` shim 在 Node 20+ 拋 EINVAL(CVE-2024-27980)。決策:**砍掉 `.cmd`/`.bat` 偵測,只留 `.exe`**,對齊新版 claude v2.x native binary 方向。

## 實作範圍

### 主修(BUG-054,三處)

#### 1. `electron/main.ts:1881` `claude:get-cli-path` handler

**現狀**:硬編回 embedded 路徑(`app.asar.unpacked/node_modules/.../bin/claude.exe` 或 dev 的 `require.resolve(...)`)。

**改動**:改呼叫 `resolveClaudeRuntime(settings)`,共用 T0231 的 router 邏輯:

```typescript
registerHandler('claude:get-cli-path', async () => {
  const { resolveClaudeRuntime } = await import('./claude-runtime-router')
  const { getRuntimeSettingsSnapshot } = await import('./claude-runtime-router')
  const settings = getRuntimeSettingsSnapshot()
  try {
    const resolved = await resolveClaudeRuntime(settings)
    // 注意:此 handler 無 sessionId,fallback 時無法 emit 去重的 degraded event
    // 建議把 degraded / warning 事件以 sessionId='__terminal__' 或其他常駐 key emit,
    // 由 renderer 訂閱後自行判斷是否 toast
    if (resolved.degraded) {
      this.broadcastDegraded('__terminal__', resolved.degraded)
    }
    if (resolved.healthStatus === 'version-warning') {
      this.broadcastWarning('__terminal__', /* version */, /* message */)
    }
    return resolved.path
  } catch (err) {
    // fallbackToEmbedded: false + system 失敗 → SystemClaudeUnavailableError
    // 此 path 無法拋到使用者,直接回空字串或內嵌(政策交 Worker 判斷)
    logger.error('[claude:get-cli-path] runtime resolution failed', err)
    return ''  // 或 embedded path,看既有 behavior
  }
})
```

**Worker 互動點**:
- 若 `fallbackToEmbedded: false` + system 不可用 → handler 拋 `SystemClaudeUnavailableError`,**renderer 沒接收 error 的既有機制**,這時該回空字串?回 embedded?還是改 handler 簽名為 `{ path, error }` union?**可回塔台問**
- 事件去重 key(無 sessionId):建議用 `'__terminal__'` 常駐,或每次都發(沒 session context)?**可回塔台問**

#### 2. `electron/main.ts:1984` `claude:auth-status` handler

**現狀**:`execFile('claude', ['auth', 'status'], ...)` — bare `'claude'` 走子進程 PATH 查第一個能找到的 claude。

**改動**:改用 resolved path:

```typescript
registerHandler('claude:auth-status', async () => {
  const { execFile } = await import('child_process')
  const { resolveClaudeRuntime, getRuntimeSettingsSnapshot } = await import('./claude-runtime-router')
  const settings = getRuntimeSettingsSnapshot()
  let resolvedPath: string
  try {
    const resolved = await resolveClaudeRuntime(settings)
    resolvedPath = resolved.path
  } catch {
    return null  // auth 查不到視為未登入,保持既有 API 語意
  }
  return new Promise<...>((resolve) => {
    execFile(resolvedPath, ['auth', 'status'], { timeout: 10000, windowsHide: true }, ...)
  })
})
```

#### 3. `electron/main.ts:2003` `claude:auth-logout` handler

**改動**:同 #2,把 bare `'claude'` 換成 resolved path。

### 附修(BUG-053,Windows 偵測簡化)

#### 4. `electron/claude-resolver.ts:93` `WINDOWS_BIN_NAMES`

**改動**:
```typescript
// 原
const WINDOWS_BIN_NAMES = ['claude.exe', 'claude.cmd', 'claude.bat'] as const

// 新
const WINDOWS_BIN_NAMES = ['claude.exe'] as const
```

**理由**:
- claude v2.x native `.exe`,anthropic 官方 installer 不 ship shim
- `.cmd`/`.bat` 只出現在 legacy `npm install -g` 或專案 `node_modules/.bin`,前者建議改用官方 installer,後者非使用者 PATH 自然命中
- 移除 Node 20+ CVE-2024-27980 的相容處理需求

**連帶清理**:
- `electron/claude-resolver.ts` 任何因應 `.cmd`/`.bat` 的 comment / 條件分支(若有)一併清
- `tests/claude-resolver.test.ts` 若有測 `.cmd`/`.bat` fallback 行為的 case 改為「僅 `.exe` 能命中」
- `tests/_windows-probe.ts` 的 `.cmd` probe 可保留(當 regression 檢查,但標註「預期 fallback-to-embedded / 直接失敗」)

#### 5. `docs/plan-027-cross-platform-verification.md` Windows 段

**補充說明**:
- 新版 claude v2.x 原生 `.exe`,**請用 anthropic 官方 installer**(自動放 `%USERPROFILE%\.local\bin\claude.exe`)
- legacy `npm install -g` 使用者:
  - 選項 A(推薦):改用官方 installer,`.exe` 會被自動偵測
  - 選項 B:在 Settings 用 **custom path** 指向 npm 全域路徑下的 **`.exe` 本體**(而非 `.cmd` shim),例:`%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe`
- 移除原「`.exe` 優先於 `.cmd`/`.bat`」段落(現在根本不偵測 shim)

### 不改(本工單範圍外)

- ❌ CLAUDE.md / Release note(交 T0234,本單只修 bug,T0234 文件再總結 Phase 1)
- ❌ Settings UI 的「Changes apply to new sessions only」hint(T0233 Worker 建議,延後)
- ❌ Session state 實機驗證(T0233 flag,延後)

### 特別注意(教訓反省)

- **T0229 R4 scope 缺口**:下次研究類工單做 spawn-site 盤點時,**全庫 grep** (`grep -rn spawn.*claude\|execFile.*claude\|claude-code/bin` 等)是基本功,不能只看單一檔案
- **`resolveClaudeCodePath()` 保留**:還是 embedded 模式內部用,別刪
- **`sessionId` context 缺失**:terminal handler 沒 session context,degraded event 需要決策 key(建議 `'__terminal__'` 或 `'__cli__'` 常駐)

## Acceptance Criteria

- [ ] **AC-1**:`electron/main.ts:1881 claude:get-cli-path` 改呼叫 `resolveClaudeRuntime()`,mode=system 時回對應 path,fallback 時回 embedded 並 emit degraded event
- [ ] **AC-2**:`electron/main.ts:1984 claude:auth-status` 改用 resolved path,不再 bare `'claude'`
- [ ] **AC-3**:`electron/main.ts:2003 claude:auth-logout` 改用 resolved path,不再 bare `'claude'`
- [ ] **AC-4**:`electron/claude-resolver.ts WINDOWS_BIN_NAMES` 只剩 `['claude.exe']`,相關 comment / 條件清乾淨
- [ ] **AC-5**:既有 28 unit tests 仍全綠(可能需調整測 `.cmd`/`.bat` 的 case 符合新規格)
- [ ] **AC-6**:`npx tsc --noEmit` exit 0、`npx vite build` 成功
- [ ] **AC-7**:`docs/plan-027-cross-platform-verification.md` Windows 段更新(removed shim / added installer 指引)
- [ ] **AC-8**:BUG-054 / BUG-053 兩個單檔的「修復紀錄」區塊填 FIXED,附本工單 commit hash
- [ ] **AC-9**:`grep -rn "claude\.cmd\|claude\.bat" electron/ src/ --include="*.ts"` 結果只剩 comment / tests / docs(不在 production code 路徑)
- [ ] **AC-10**:auth handler 行為回歸測試(手動跑 Settings UI Auth 區塊或 `execFile` smoke),loggedIn 狀態回傳正確

## 驗收依據

1. 使用者實測 bug report(見 BUG-054 現象段)
2. T0231 `claude-runtime-router.ts`(router 介面)
3. `electron/claude-agent-manager.ts` L258-308 `resolveRuntimeForSession` 實作模式(terminal handler 可借鑑事件廣播做法)
4. `tests/claude-resolver.test.ts` 測試風格
5. T0233 產出 `docs/plan-027-cross-platform-verification.md`

## 產出位置

- 修改:`electron/main.ts`(三個 handler)
- 修改:`electron/claude-resolver.ts`(常數 + 相關分支)
- 修改:`tests/claude-resolver.test.ts`(若有受影響 case)
- 修改:`docs/plan-027-cross-platform-verification.md`(Windows 段)
- 修改:`_ct-workorders/BUG-054-...md` + `_ct-workorders/BUG-053-...md`(修復紀錄區)
- 可能新增 helper:`electron/main.ts` 內可能需要 `broadcastRuntimeDegraded(sessionIdOrToken)` helper 避免重複 IPC 邏輯

## 風險與備註

- **R1 - fallbackToEmbedded: false 的 terminal 流程**:`claude:get-cli-path` handler 無法優雅拋錯到 renderer,需決策回 `''` / embedded / 特殊 error payload。**Worker 首先 grep renderer 怎麼用 `getCliPath()` 的 return value**,再決策。
- **R2 - Auth bare `'claude'` → resolved path 的副作用**:auth 查詢本來走 PATH,使用者可能 mix 裝多個 claude,改後只查選定 runtime 的 auth 狀態(**這是修正,不是 regression**,但需注意行為變化)
- **R3 - Event 去重 key**:無 sessionId 的 terminal handler,degraded event 每次 emit 會 toast 洗版。**建議 Worker 加常駐 key 做去重**(或在 terminal 路徑乾脆不 emit 事件,依賴使用者看終端 UI 本身的錯誤)
- **R4 - BUG-053 測試調整**:若 `claude-resolver.test.ts` 有測「`.cmd` 在 list 中的優先級」,要改成「`.cmd` 不再被偵測」的預期
- **R5 - 互動時機**:以下三個決策點**可回塔台問**:
  - (a) `claude:get-cli-path` 失敗時的 fallback 策略(回空?embedded?error payload?)
  - (b) terminal 路徑的 degraded event 去重 key 策略
  - (c) 若發現 auth handler 還有其他 call site 遺漏(例如 renderer 裡另有 bare `claude` execFile)
- **R6 - 跨平台 playbook 重寫深度**:Windows 段砍 shim 段落、加 installer 指引即可,不用重寫整份

## 回報區

### 完成狀態

FIXED(修復完成,等待使用者驗收)

### 產出摘要

- **Commit hash**:`058412a`
- **修改檔案**:
  - `electron/main.ts`(新增 `broadcastRuntimeEvent` helper + 三個 handler 改寫)
  - `electron/claude-resolver.ts`(`WINDOWS_BIN_NAMES` 縮減 + comment)
  - `tests/_windows-probe.ts`(`.cmd` probe comment 更新)
  - `docs/plan-027-cross-platform-verification.md`(Windows 段重寫)
  - `_ct-workorders/BUG-053-*.md` / `BUG-054-*.md`(FIXED 紀錄)
- **AC 勾選**:
  - [x] AC-1:`claude:get-cli-path` → `resolveClaudeRuntime()`,degraded/warning event 用 `'__terminal__'` 去重 key、fallback 策略見下方 R5(a) 決策
  - [x] AC-2:`claude:auth-status` 改用 resolved path,失敗回 `null`
  - [x] AC-3:`claude:auth-logout` 改用 resolved path,失敗回 `{ success: false, error }`
  - [x] AC-4:`WINDOWS_BIN_NAMES = ['claude.exe']`,檔頭 comment + constant comment 同步更新
  - [x] AC-5:unit tests 綠 — resolver 17/17、router 11/11、其他 59 項(backlog / node-resolver / path-guard / remote-throttle)全綠;`claude-code-path.test.ts` 4 項中 3 綠 1 失敗為 **pre-existing 環境問題**(`node_modules/@anthropic-ai/claude-code/bin/claude.exe` 本地被改名為 `.old.1776856737641`,與本工單無關,已 `git stash` 驗證)
  - [x] AC-6:`npx tsc --noEmit` exit 0、`npx vite build` 三 target(main / preload / terminal-server)全綠
  - [x] AC-7:`docs/plan-027-cross-platform-verification.md` Windows 段重寫(新增「Windows 推薦安裝」段落 + 修正對照表)
  - [x] AC-8:BUG-054 / BUG-053 單檔填 FIXED,commit `058412a`
  - [x] AC-9:`grep -rn "claude\.cmd\|claude\.bat" electron/ src/ --include="*.ts"` 無 hit;`grep -rE "execFile\(\s*['\"]claude['\"]|spawn\(\s*['\"]claude['\"]" electron/ src/ -r --include="*.ts"` 只剩 main.ts 內的新 comment,production code 乾淨
  - [x] AC-10:auth handler 邏輯 review 完成(runtime resolution 失敗時 auth-status 回 `null`、auth-logout 回 `{ success: false, error }`,保留既有 API 語意);實機手動驗證需要使用者在 Settings UI 按 Auth 按鈕走一次,Worker 無法自動化
- **tsc / vite / test 結果**:tsc 綠、vite 綠、unit tests 除 pre-existing 環境 fail 外全綠
- **互動記錄**:Worker 在 yolo + interactive 模式下執行,三個決策點(R5 a/b/c)自行判斷未回塔台,理由見下。

### R5 三決策點自行判斷紀錄

| 決策點 | 選擇 | 理由 |
|--------|------|------|
| (a) `claude:get-cli-path` 失敗 fallback 策略 | **回 `''` + emit degraded event** | 保留既有 behaviour(renderer 目前已容忍空字串);同時讓使用者看到 toast 知道原因。若改成自動回 embedded 會與 `fallbackToEmbedded=false` 的使用者意圖矛盾 |
| (b) terminal 路徑 degraded event 去重 key | **固定字串 `'__terminal__'`** | 對齊工單 R3 建議;和 `ClaudeAgentManager` 的 per-session 去重共用同一張 `emittedEvents` Map,不會衝突(session UUID 與 `'__terminal__'` 空間互斥)|
| (c) 其他遺漏 call site | **已 grep 清理** | `grep -rE "execFile\(\s*['\"]claude['\"]|spawn\(\s*['\"]claude['\"]"` 只剩 comment,runtime-router 內部 health probe 已用 resolved path,無其他遺漏 |

### BUG-054 修復驗證

- **程式碼層驗證**:
  - `claude:get-cli-path` handler 已改呼叫 `resolveClaudeRuntime(getRuntimeSettingsSnapshot())`,grep 確認 `electron/main.ts` 相關區塊不再硬編 embedded path(僅 `resolveClaudeRuntime` fallback 分支內走 embedded helper,by design)
  - `claude:auth-status` / `claude:auth-logout` 已改用 resolved path
- **手動驗證(需使用者實機)**:
  - 切 Settings → Claude Runtime → system → 開終端 claude-cli preset → 版本應為 system path
  - customPath 指不存在路徑 → 應 emit degraded event + 終端顯示 embedded
  - Worker 在此階段無法自動化(需 UI interaction + 跨 session reload),交使用者驗收

### BUG-053 修復驗證

- `WINDOWS_BIN_NAMES` 現值:`['claude.exe'] as const`
- `grep -rn "claude\.cmd\|claude\.bat" electron/ src/ --include="*.ts"` 結果:**無命中**
- `grep -rn "claude\.cmd\|claude\.bat" tests/ --include="*.ts"` 結果:只剩 `tests/_windows-probe.ts:54`(regression probe 刻意保留,comment 已更新標註預期 `spawn-failed` → router fallback)
- 既有 `.cmd` 測試 case 處理:`claude-resolver.test.ts` 無測 `.cmd` / `.bat` 優先級,**無需調整**。`_windows-probe.ts` 是手動探針,已補註 expected behaviour

### 遭遇問題

1. **`tests/claude-code-path.test.ts` 3/4 通過,1 項失敗**:測試預期 `node_modules/@anthropic-ai/claude-code/bin/claude.exe` 存在,但本地環境該檔被改名為 `claude.exe.old.1776856737641`(疑為前次 install hook 殘留)。`git stash` 驗證失敗在修改前後都一致,**非本工單引入**。屬於 BUG-047 guard 測試反映的 SDK install 層問題,超出 T0235 scope,記錄此處供後續 BUG 立單。
2. **Vite build warnings**:`claude-runtime-router.ts` 被 main.ts 動態 import + 被 claude-agent-manager 靜態 import,Vite 警告 dynamic import 不會移到獨立 chunk。對 Electron main bundle 無實際影響(單一 bundle 目標),**預期行為**。

### Renew 歷程

無。
