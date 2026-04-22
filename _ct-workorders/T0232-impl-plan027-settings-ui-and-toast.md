# T0232 — 實作:Settings UI + Toast 訂閱(PLAN-027 Phase 1 #3)

## 元資料

- **編號**:T0232
- **類型**:implementation(實作工單)
- **狀態**:🔄 IN_PROGRESS
- **建立時間**:2026-04-22 13:08 (UTC+8)
- **派發時間**:2026-04-22 13:08 (UTC+8)
- **開始時間**:2026-04-22 13:13 (UTC+8)
- **派發模式**:`--mode yolo --interactive`(UI 實作,可能需要 i18n / 既有 CSS class 判斷,保留互動)
- **優先級**:🟡 Medium(PLAN-027 Phase 1 收尾 UI)
- **前置條件**:T0230 ✅ DONE(resolver / settings / IPC detectRuntime)、T0231 ✅ DONE(router / IPC runtime-degraded / runtime-warning)
- **關聯**:PLAN-027 #3、T0230、T0231、`src/components/SettingsPanel.tsx` L997(Advanced tab)、`src/types/index.ts` ClaudeRuntimeSettings
- **預估時間**:60 min
- **Renew 次數**:0

## 背景

T0230 + T0231 已交付 **後端所有基礎設施**:resolver、settings schema、IPC detectRuntime、router、IPC toast events、preload bridge。本工單是 Phase 1 最後一哩:**把使用者可見的設定 UI + toast 顯示接起來**。完成後 Phase 1 收工,PLAN-027 剩 T0233 整合測試 + T0234 文件。

## 實作範圍

### 必做(三件事,全在 renderer)

#### 1. Claude Runtime 設定區塊(加到 Advanced tab)

**位置**:`src/components/SettingsPanel.tsx` L997 `activeTab === 'advanced'` 區塊內,加新的 `<div className="settings-section">`。

**UI 結構**(參考既有 section 的佈局模式):

```
┌─ Claude Runtime ────────────────────────────────────┐
│  Choose which Claude CLI binary BAT uses for Agent  │
│  sessions. Changes apply to new sessions only.      │
│                                                     │
│  ( ) Embedded (bundled with BAT)                    │
│      [healthy] v2.1.113                             │
│                                                     │
│  ( ) System (your installed claude CLI)             │
│      Status: [healthy] v2.1.113                     │
│      Path:   /Users/xxx/.local/bin/claude           │
│                                                     │
│      ☐ Use custom path                              │
│      [text input_________________] [Browse...]      │
│                                                     │
│  ☑ Fall back to embedded if system fails            │
└─────────────────────────────────────────────────────┘
```

**元素**:
1. **Radio group**:`embedded` / `system` 互斥
2. **Version badges**:
   - `healthy` → 綠色底標
   - `version-warning` → 黃色底標 + tooltip「This version lacks features added in 2.1.111 (Opus 4.7 / xhigh effort)」
   - `version-too-old` → 紅色底標 + 禁用 system radio(或 radio 可選但標註 incompatible)
   - `spawn-failed` → 紅色底標「Not detected」+ 禁用 system radio
3. **Path 顯示**:偵測到的系統路徑(read-only,灰色)
4. **Custom path**:checkbox + input + Browse button
   - Browse button:呼叫 `window.electronAPI.showOpenDialog(...)` 或既有 file picker pattern,選檔後觸發重新偵測
   - Input 可手動輸入,debounced 觸發 `detectRuntime(customPath)` 刷新 status
5. **Fallback checkbox**:綁 `fallbackToEmbedded` 欄位
6. **Hint text**:下方或旁邊「Changes apply to new sessions only」

**資料流**:
- 讀:Component mount 時呼叫 `window.electronAPI.claude.detectRuntime()` 一次取得 `{ embedded, system }`
- 寫:使用者改 radio / checkbox / custom path input → 透過 `settings-store.ts` 的 `setClaudeRuntime(updates)`(T0230 已加)
- 刷新:custom path 改動(debounced 500ms)或 Browse 選新檔 → 再呼 `detectRuntime(newCustomPath)` 刷新 system status

#### 2. Toast UI 組件 + 訂閱(接 T0231 IPC events)

**判斷**:先看既有 toast / notification 組件(grep `toast` / `notification` / `Toast` / `Notification` 在 `src/components/`),若有就沿用;若無則**加最小可用 toast**(文字條 + 幾秒自動消失 + 手動關閉按鈕)。

**訂閱位置**:建議在 app root 或 top-level layout 組件(如 `App.tsx`),避免重複訂閱。

**Hook/Effect**:
```typescript
useEffect(() => {
  const unsubDeg = window.electronAPI.claude.onRuntimeDegraded(({ sessionId, reason, detail }) => {
    showToast({
      variant: 'warning',
      title: 'Claude runtime degraded',
      message: degradedMessage(reason, detail),
    });
  });
  const unsubWarn = window.electronAPI.claude.onRuntimeWarning(({ sessionId, version, message }) => {
    showToast({
      variant: 'info',
      title: `Claude ${version} — version notice`,
      message,
    });
  });
  return () => { unsubDeg(); unsubWarn(); };
}, []);
```

**Degraded reason → message 映射**:
- `system-not-found` → "System claude not found on PATH. Using embedded version."
- `system-unhealthy` → "System claude failed health check. Using embedded version."
- `system-too-old` → "System claude is below minimum version (2.0.0). Using embedded version."
- `detect-threw` → "Runtime detection failed unexpectedly. Using embedded version."

#### 3. i18n 字串(若本專案用 i18n)

**判斷**:看 `SettingsPanel.tsx` L364-367 已用 `t('settings.tab.advanced')`,表示有 i18n。

**行動**:
- 找 translations 檔(grep `'settings.tab.advanced'` 找到 json/ts 翻譯源),加本工單新字串
- 至少加 zh-TW 和 en 兩語言。其他語言照既有語言清單加,若太多可先加 en + zh-TW,其他加 TODO

**新增 key 建議**:
- `settings.claudeRuntime.title`
- `settings.claudeRuntime.description`
- `settings.claudeRuntime.mode.embedded`
- `settings.claudeRuntime.mode.system`
- `settings.claudeRuntime.status.healthy/warning/tooOld/notFound`
- `settings.claudeRuntime.customPath.toggle`
- `settings.claudeRuntime.customPath.browse`
- `settings.claudeRuntime.fallbackToEmbedded`
- `settings.claudeRuntime.hint`
- `toast.runtime.degraded.*`(4 個 reason)
- `toast.runtime.warning.title`

### 不改(本工單範圍外)

- ❌ 後端 resolver / router / IPC(T0230 + T0231 已定稿)
- ❌ 整合測試 / session state spike(交 T0233)
- ❌ CLAUDE.md + Release note(交 T0234)

### 特別注意(教訓)

- **引用來源**:`ClaudeRuntimeSettings` / `ClaudeRuntimeMode` / `ClaudeRuntimeDegradedEvent` / `ClaudeRuntimeWarningEvent` / `ClaudeRuntimeDegradedReason` **全部在 `src/types/index.ts`**。別在組件內重新定義。
- **store setter**:T0230 Worker 已加 `setClaudeRuntime(updates)` 到 `src/stores/settings-store.ts`,直接用。
- **detect 呼叫**:`window.electronAPI.claude.detectRuntime(customPath?)` 回 `{ embedded: {version, path, healthStatus}, system: ClaudeRuntimeInfo | null }`(null 代表 system 沒找到)
- **既有 Settings UI pattern**:參考 `SettingsPanel.tsx` 其他 `<div className="settings-section">` 的 layout / label / input 寫法,保持一致
- **tsc 驗收**:`npx tsc --noEmit` exit 0;`npx vite build` 成功
- **既有 test**:`npx tsx tests/claude-resolver.test.ts` 17/17 仍需通過

## Acceptance Criteria

- [ ] **AC-1**:`SettingsPanel.tsx` Advanced tab 新增「Claude Runtime」section,含 radio group(embedded / system)、version badges、custom path toggle + input + Browse button、fallback checkbox、hint text
- [ ] **AC-2**:Component mount 時呼叫 `detectRuntime()` 取 `{ embedded, system }`,badges 顯示對應狀態
- [ ] **AC-3**:使用者切換 radio / checkbox / custom path → 透過 `setClaudeRuntime()` 寫入 store 並持久化
- [ ] **AC-4**:Custom path input 改動 500ms debounce 後觸發 `detectRuntime(newPath)` 刷新 status
- [ ] **AC-5**:Browse button 可開檔案選擇對話框,選檔後更新 custom path + 觸發 detect
- [ ] **AC-6**:`version-too-old` / `spawn-failed` 狀態下 system radio 禁用(或選擇時顯示 incompatible warning)
- [ ] **AC-7**:app root 訂閱 `onRuntimeDegraded` / `onRuntimeWarning`,IPC 事件觸發時顯示 toast(4 種 degraded reason + warning 都有對應文案)
- [ ] **AC-8**:i18n 字串加到翻譯檔(至少 en + zh-TW),無 hardcoded 英文字串
- [ ] **AC-9**:`npx tsc --noEmit` exit 0、`npx vite build` 成功、既有 17 unit tests 全綠

## 驗收依據

1. T0229 研究報告 R1 Settings UI 段落
2. T0230 產出:`src/types/index.ts` + `src/stores/settings-store.ts` + IPC detectRuntime
3. T0231 產出:IPC runtime-degraded / runtime-warning + preload bridge
4. `src/components/SettingsPanel.tsx` L997 Advanced tab 佈局參考
5. 既有 i18n 翻譯檔結構

## 產出位置

- 主改:`src/components/SettingsPanel.tsx`(加 Claude Runtime section)
- 可能新檔:`src/components/ClaudeRuntimeSection.tsx`(若想切元件,scope 夠大)
- 可能新檔:`src/components/RuntimeToastListener.tsx` 或 hook `src/hooks/useRuntimeToasts.ts`
- 可能新檔:`src/components/Toast.tsx`(若專案無既有 toast)
- 修改:i18n 翻譯檔(位置依既有)、可能 `src/App.tsx` 加訂閱
- 修改:`src/styles/settings.css`(若需新 CSS class)

## 風險與備註

- **R1 - Toast 組件**:若專案完全沒有 toast/notification,先做最小可用版(fixed 定位 + 幾秒自動消失),別引大型 UI lib
- **R2 - Browse file dialog**:`window.electronAPI.showOpenDialog` 可能不存在,需加 IPC handler(`dialog:showOpen`)。Worker 先 grep 現有 `showOpenDialog` 使用點,沒的話補 IPC
- **R3 - i18n 語言清單**:若既有翻譯檔有多語言(zh-CN / ja 等),優先加 en + zh-TW,其他語言可先 fallback 到 en(加 comment 標 TODO)
- **R4 - Debounce**:用 `setTimeout` + cleanup 的 useEffect 或小型 hook。不用引 lodash 之類的
- **R5 - 互動時機**:看到 i18n key 該怎麼命名、toast 是否沿用既有組件有疑問、或 Browse 要不要加到獨立 IPC → **回塔台問**
- **R6 - Settings UI accessibility**:radio group 要有 `aria-labelledby` / `role="radiogroup"`,參考既有 pattern(L363 的 tablist 有 aria 屬性)

## 回報區

### 完成狀態

DONE — PLAN-027 Phase 1 UI 層全部到位。Advanced tab 新增 Claude Runtime 區塊,app root 訂閱 runtime 事件並透過 CtToast 呈現,i18n 三語覆蓋完成。

### 產出摘要

- **Commit hash**:(pending,見收尾 commit)
- **新增檔案**:
  - `src/components/ClaudeRuntimeSection.tsx`(切出獨立元件,封裝 detectRuntime + radio + custom path + fallback)
  - `src/hooks/useRuntimeToasts.ts`(訂閱 onRuntimeDegraded / onRuntimeWarning,查 i18n 後丟給 addToast)
- **修改檔案**:
  - `src/components/SettingsPanel.tsx`(在 L998 Advanced tab 最上方 render `<ClaudeRuntimeSection>`)
  - `src/App.tsx`(載入 CtToast + useCtToast + useRuntimeToasts,在 layout 尾端加 `<CtToast>`)
  - `src/types/electron.d.ts`(補 `claude.detectRuntime` 型別,原先 preload.ts 有但 d.ts 漏)
  - `src/locales/en.json`、`zh-TW.json`、`zh-CN.json`(加 `settings.claudeRuntime.*` 與 `toast.runtime.*`)
  - `src/styles/settings.css`(加 `.claude-runtime-badge.healthy/warning/error` 三個 badge)
- **AC 勾選**:
  - [x] **AC-1**:Advanced tab 新增 Claude Runtime section,含 radio group(embedded / system)、version badges(healthy / warning / tooOld / notFound 四色 CSS 已加)、custom path toggle + input + Browse、fallback checkbox、hint 文字
  - [x] **AC-2**:`ClaudeRuntimeSection` mount 時呼 `window.electronAPI.claude.detectRuntime()` 取 `{ embedded, system }`,radio 旁 badge 顯示狀態與版本號
  - [x] **AC-3**:radio / checkbox / custom path / fallback 改動均透過 `settingsStore.setClaudeRuntime(...)` 寫回 store(由 settings-store 自動 notify + save)
  - [x] **AC-4**:custom path input 500ms debounce(`useEffect` + `setTimeout` + cleanup),debounce 結束才 `onRuntimeChange({customPath})`,後續 `runtime.customPath` 變動觸發 `runDetect` 重偵測
  - [x] **AC-5**:Browse 按鈕呼 `window.electronAPI.dialog.selectFiles()`(既有 IPC),選檔後同步更新 input + `customPath`
  - [x] **AC-6**:`version-too-old` / `spawn-failed` 狀態下 system radio `disabled={true}`(label opacity 0.65, cursor not-allowed 視覺提示)
  - [x] **AC-7**:`App.tsx` 掛 `useRuntimeToasts(addToast)` + `<CtToast>`,4 個 degraded reason(systemNotFound/systemUnhealthy/systemTooOld/detectThrew)與 warning 皆有 i18n key,version 以 `{{version}}` interpolation 代入
  - [x] **AC-8**:i18n 三語言覆蓋完整(en / zh-TW / zh-CN),元件全程以 `t(...)` 取字串,無 hardcoded 英文
  - [x] **AC-9**:`npx tsc --noEmit` exit 0;`npx vite build` 成功(9.29s,3 個 sub-build 全綠);既有 `tests/claude-resolver.test.ts` 17/17 passed
- **tsc 結果**:✅ exit 0,無錯誤
- **vite build 結果**:✅ built in 9.29s(client)+ 2.08s(main)+ 24ms(preload)+ 26ms(terminal-server),size warning 為既有無關 chunk
- **既有 test 結果**:✅ `tests/claude-resolver.test.ts` 17 passed / 0 failed
- **i18n 語言覆蓋**:en、zh-TW、zh-CN 三語言全部新增完整 key(`settings.claudeRuntime.*` 10 個 key + `toast.runtime.*` 6 個 key)
- **互動記錄**:無(工單指令明確,無需追問)

### 遭遇問題

1. `src/types/electron.d.ts` 漏了 `claude.detectRuntime` 宣告(preload.ts 有實作但 d.ts 未補),第一次 tsc 報 TS2339。補上 d.ts 後即綠,屬前置工單未涵蓋的小缺口,已就地修正。
2. `src/hooks/` 目錄既有只放 hooks(`useMenuPosition` / `useVoice*`),新增 `useRuntimeToasts.ts` 與既有 pattern 一致,無爭議。
3. CtToast 的 `type` union 為 `'success' | 'info' | 'warning'`,**無 `error`**;degraded 事件統一用 `warning` 等級(7s duration),warning 事件用 `info`(6s duration),符合既有語意(真正阻塞錯誤不在這裡發)。

### Renew 歷程

無。
