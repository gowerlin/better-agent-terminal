# T0220 — 研究:BUG-047 驗收失敗根因調查(app.asar → app.asar.unpacked resolve 路徑)

## 元資料
- **編號**:T0220
- **類型**:research(研究型工單,允許 Worker 互動)
- **狀態**:✅ DONE
- **建立時間**:2026-04-19 22:20 (UTC+8)
- **開始時間**:2026-04-19 22:25 (UTC+8)
- **完成時間**:2026-04-19 22:31 (UTC+8)
- **Commit**:c9ec6c1
- **優先級**:🟠 High(BUG-047 升級後,樣本 2 人跨版本 100% 阻擋)
- **前置條件**:BUG-047(FIXING)、T0197/T0198/T0199(修復未生效)
- **關聯**:BUG-047、T0198(`e619b81` asarUnpack 主修)、T0199(`5de178e` @lydell 預防)、PLAN-005(Electron Builder 26 升級)
- **預估時間**:15-30 min(Worker research,含 installer 實體內容抽查)
- **Renew 次數**:0

## 背景

**BUG-047 原判定根因**(T0197 翻案):`package.json` `asarUnpack` 漏列 npm optional platform 子包。T0198(`e619b81`)補上 `node_modules/@anthropic-ai/claude-agent-sdk-*/**/*` pattern,T0199(`5de178e`)同步補 `@lydell/node-pty-*`。

**打包驗證當下**(T0198):build 產物的 `resources/app.asar.unpacked/` 下確實有 `@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe` 實體檔。Commit 後狀態改為 VERIFY 等 Rico pre.2 實機驗收。

**驗收失敗**(2026-04-19 22:20):
- Rico 狀態未知(pre.2 tag 尚未打,原計畫授權後打)
- **Gower 裝 v0.2.2-pre.1**(T0198/T0199 修復後的版本)**仍 100% 複現同路徑錯誤**
  - GitHub Release:https://github.com/gowerlin/better-agent-terminal/releases/tag/v0.2.2-pre.1
  - 安裝路徑:`C:\Program Files\BetterAgentTerminal\`
  - 錯誤路徑:`resources\app.asar\node_modules\@anthropic-ai\claude-agent-sdk-win32-x64\claude.exe`(**app.asar 內,未 rewrite 為 app.asar.unpacked**)

**矛盾點**:package.json `asarUnpack` pattern 看起來正確(line 157 `@anthropic-ai/claude-agent-sdk-*/**/*` 應 cover `claude-agent-sdk-win32-x64`),但 runtime 路徑仍指向 `app.asar\` 而非 `app.asar.unpacked\`。

## 研究目標

**同時調查兩個面向**(使用者選 C):

### A 面:打包產物實體內容(package.json → installer 真實行為)

1. **本機 build 產物抽查**(若 `release/` 目錄有最近 build):
   - 找最新 build 的 `resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe` 是否存在
   - 若存在 → 表示 asarUnpack 生效,問題在 code 側 resolve 邏輯
   - 若不存在 → 表示 asarUnpack pattern 有效 match 但實際未 unpack,為 electron-builder 26 行為異常

2. **比對 asarUnpack pattern 與實際 unpack 結果**:
   - grep `resources/app.asar.unpacked/` 目錄樹 vs `asarUnpack` 宣告的 8 個 pattern
   - 檢查是否有 pattern match 但未 unpack 的項目(electron-builder 26 bug?)

3. **已安裝 Release(C:\Program Files\BetterAgentTerminal\)**(若使用者授權):
   - 直接檢查安裝目錄的 `resources/` 結構
   - 確認 v0.2.2-pre.1 installer 實際解包後 `.unpacked/` 有哪些東西
   - **注意**:若 Worker 無法直接訪問 `C:\Program Files\`,請在工單回報區詢問使用者協助執行

### B 面:Code 側 SDK 路徑 resolve 邏輯

1. **Grep Claude SDK binary 路徑解析程式碼**:
   ```bash
   grep -rn "claude-agent-sdk.*claude.exe\|pathToClaudeCodeExecutable" electron/ src/
   grep -rn "app.asar\|asar.unpacked" electron/ src/
   grep -rn "claude-agent-sdk-win32\|claude-agent-sdk-linux\|claude-agent-sdk-darwin" electron/ src/
   ```

2. **定位實際 resolve 邏輯**:
   - 是否為 `require.resolve()` 呼叫(node 原生 resolution,應自動處理 unpacked)
   - 是否為 `path.join(__dirname, ...)` 手動拼接(packaged app 時指向 `app.asar\`)
   - 是否有呼叫 `@anthropic-ai/claude-agent-sdk` SDK 的內部 API 取 binary 路徑
   - 若走 SDK 內部 resolve,是 SDK 本身的 bug(在 Electron asar 環境下失效)

3. **Electron asar 最佳實務檢查**:
   ```ts
   // 標準做法(main process):
   const binaryPath = path.join(
     process.resourcesPath,
     'app.asar.unpacked',
     'node_modules',
     '@anthropic-ai/claude-agent-sdk-win32-x64',
     'claude.exe'
   )
   // 或 portable 做法(Node 在 packaged app 自動把 require.resolve 指向 .unpacked/):
   const modulePath = require.resolve('@anthropic-ai/claude-agent-sdk-win32-x64/package.json')
   const binaryPath = path.join(path.dirname(modulePath), 'claude.exe')
   ```

4. **🔑 `options.pathToClaudeCodeExecutable` 線索**(2026-04-19 22:20 使用者補充):
   - SDK 錯誤訊息明確提示:`specify a valid path with options.pathToClaudeCodeExecutable`
   - **這是 SDK 官方 override API**,表示 Claude Agent SDK 設計上就預期 Electron/packaged 環境需要呼叫端主動傳路徑
   - **調查重點**:
     ```bash
     grep -rn "pathToClaudeCodeExecutable" electron/ src/
     ```
     - 若完全沒呼叫 → 本專案從未傳 override,依賴 SDK 自動 resolve → asar 環境自然壞
     - 若有傳但值錯誤 → 檢查計算邏輯(是否拼成 `app.asar\` 而非 `.unpacked\`)
   - **若 B 面結論導向此方向,修復路線極明確**:
     ```ts
     // electron/claude-agent-manager.ts 或類似處:
     const pathToClaudeCodeExecutable = app.isPackaged
       ? path.join(
           process.resourcesPath,
           'app.asar.unpacked',
           'node_modules',
           '@anthropic-ai/claude-agent-sdk-win32-x64',  // 或對應平台
           'claude.exe'  // 或對應 binary
         )
       : undefined  // dev env 讓 SDK 自己 resolve
     // 傳給 SDK 初始化:{ pathToClaudeCodeExecutable }
     ```

### C 面:為何 T0198/T0199 修復沒生效

1. 檢查 `e619b81`(T0198)和 `5de178e`(T0199)commit diff
2. 對照當時驗證步驟(T0198 工單「驗收步驟」):是否只驗了 build 產物存在性,沒實機跑 runtime?
3. 若發現驗證有缺口 → 記入 BUG-047 回報,供 *evolve 收斂為學習模式

## 預期產出(回報區格式)

### 結論(一句話)
> BUG-047 未修好根因是 `[A面 / B面 / AB 並存]`,具體是 `[描述]`。

### A 面調查結果
- build 產物 `.unpacked/claude.exe` 存在性:`[有 / 無]`
- 若無 → electron-builder 26 asarUnpack pattern match 失敗明細
- 若有 → 推給 B 面

### B 面調查結果
- Claude SDK binary resolve 邏輯位置:`[檔案:行號]`
- resolve 機制:`[require.resolve / path.join / SDK 內部]`
- 問題點:`[hardcode app.asar 路徑 / SDK 不處理 asar 環境 / 其他]`

### C 面:T0198/T0199 失效原因
- `[驗證缺口 / 修復方向錯 / 部分生效但其他 code path 漏補]`

### 推薦修復路線
選一:
- [ ] **路線 1**:只修 code 側 resolve 邏輯(若 A 面產物正確)
- [ ] **路線 2**:只修 packaging(若 B 面 resolve 邏輯正確但 unpack 失敗)
- [ ] **路線 3**:兩邊都補(A/B 面皆有問題)
- [ ] **路線 4**:升級 `@anthropic-ai/claude-agent-sdk` 版本(若 SDK bug)

### 驗收策略建議
- 如何避免下次又「build 驗過但實機仍壞」的驗證缺口
- 建議新增哪一類 smoke test

## Worker 互動旗標

- `research_interaction: true`(Worker 可向使用者提問)
- `research_max_questions: 3`(每次最多 3 題)

**可互動場景**:
1. 若需讀取 `C:\Program Files\BetterAgentTerminal\` 內容 → 請使用者協助 `ls` 或 `dir`
2. 若需使用者提供 Rico 最新狀態(是否 Rico 也裝了 pre.2 或 v0.2.2-pre.1)
3. 若 A/B 面結論衝突,請使用者協助判斷

## 執行限制

- **禁止**:直接修 code(本工單僅為研究,修復工單待結論後另派)
- **禁止**:直接打 tag / release(維持 release 流程由使用者授權)
- **允許**:讀取 package.json / electron/ / src/ / release/(若有)
- **允許**:`git log --oneline e619b81 5de178e` 確認 commit 內容
- **允許**:建議使用者執行 `dir "C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked"` 等查看命令

## 收尾步驟

完成以下 Worker 回報:
1. 填寫上述「預期產出」全部欄位
2. 明確寫「推薦修復路線 N」(或 Renew 請求)
3. 若路線清晰 → 塔台將派修復工單 T0221
4. 若路線不清晰 → 塔台 Renew T0220 補充調查方向

---

## Worker 回報區(完成後填寫)

### 完成狀態

**DONE**(研究結論可決策,推薦路線明確)

### 結論(一句話)

> BUG-047 未修好根因是 **B 面(code resolve 邏輯)** —— `resolveClaudeCodePath()` 呼叫 `require.resolve('@anthropic-ai/claude-code/cli.js')`,**該檔案在 v2.1.113 根本不存在**,導致函式永遠拋例外回空字串,`pathToClaudeCodeExecutable` 從未傳給 SDK,SDK 落回自己預設 resolve 並在 asar 環境下失敗。T0198/T0199 的 asarUnpack 修復是對的、檔案位置是對的,但程式從未正確指向它們。

### A 面調查結果(打包產物)

**實機 `C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@anthropic-ai\` 內容**:

| 子包 | 內容 | 狀態 |
|------|------|------|
| `claude-code/` | `bin/claude.exe` (245 MB), `cli-wrapper.cjs`, `install.cjs`, `package.json` | ✅ 存在 |
| `claude-code-win32-x64/` | `claude.exe` (245 MB), `LICENSE.md`, `package.json` | ✅ 存在 |
| `claude-agent-sdk/` | `dist-electron/`, `node_modules/` | ✅ 存在 |
| `claude-agent-sdk-win32-x64/` | `claude.exe` (245 MB), `LICENSE.md`, `package.json` | ✅ 存在 |

**結論**:**T0198/T0199 的 asarUnpack pattern 完全正確生效**,所有 platform-specific binary 都正確落在 `.unpacked/`。A 面無問題,推給 B 面。

### B 面調查結果(code resolve 邏輯)⭐ 根因所在

#### 關鍵程式碼位置

- `electron/claude-agent-manager.ts:83-102` — `resolveClaudeCodePath()` 函式
- `electron/claude-agent-manager.ts:643 / 1322 / 2201` — 三處傳 `pathToClaudeCodeExecutable` 給 SDK
- `electron/main.ts:1882-1883` — 另一處 app.asar rewrite 邏輯(相同 bug)

#### 原始邏輯(有 bug)

```typescript
function resolveClaudeCodePath(): string {
  let resolved = ''
  try {
    const req = createRequire(import.meta.url ?? __filename)
    resolved = req.resolve('@anthropic-ai/claude-code/cli.js')  // ❌ 檔案不存在
  } catch {
    try {
      resolved = require.resolve('@anthropic-ai/claude-code/cli.js')  // ❌ 同樣拋錯
    } catch {
      return ''  // ⬅ 最終回空字串
    }
  }
  if (resolved.includes('app.asar') && !resolved.includes('app.asar.unpacked')) {
    resolved = resolved.replace('app.asar', 'app.asar.unpacked')
  }
  return resolved
}
```

#### 實證驗證

```bash
$ node -e "console.log(require.resolve('@anthropic-ai/claude-code/cli.js'))"
THROW: MODULE_NOT_FOUND Cannot find module '@anthropic-ai/claude-code/cli.js'

$ node -e "console.log(require.resolve('@anthropic-ai/claude-code'))"
THROW: MODULE_NOT_FOUND Cannot find module '@anthropic-ai/claude-code'

$ cat node_modules/@anthropic-ai/claude-code/package.json | grep -E "main|exports|bin"
  "bin": { "claude": "bin/claude.exe" }    ⬅ 只有 bin,沒有 main/exports/cli.js
```

**`@anthropic-ai/claude-code` v2.1.113 package 結構**:
- `bin/claude.exe`(postinstall 從 platform-specific 複製而來,245 MB)
- `cli-wrapper.cjs`(postinstall 失敗時的 fallback wrapper)
- `install.cjs`(postinstall 本體)
- `package.json`(**無 `main`、無 `exports`、無 `cli.js`**)

#### 失效鏈

1. `resolveClaudeCodePath()` → 兩個 try/catch 都拋 `MODULE_NOT_FOUND`
2. 回傳空字串 `''`
3. Line 643/1322/2201:`...(claudeCodePath ? { pathToClaudeCodeExecutable: claudeCodePath } : {})` — 空字串 falsy,**SDK 完全沒收到 override**
4. SDK 內部落回預設 resolve 邏輯,在 packaged Electron 環境下:
   - SDK 拼出 `<resources>/app.asar/node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe`
   - 該路徑在 asar 檔案內,`child_process.spawn` 無法執行
5. SDK 拋錯:`specify a valid path with options.pathToClaudeCodeExecutable`

#### 為何 Dev 環境沒壞

Dev 下 `resolveClaudeCodePath()` 也回空字串(同樣 bug),但 SDK 預設 resolve 在 `node_modules/` 原生 resolution 下能找到實體 `claude.exe`,不經 asar,所以能跑。**bug 早就存在,只是 packaged 環境才顯現**。

### C 面:T0198/T0199 失效原因

**結論**:**驗證缺口 + 修復方向不完整**

| 項目 | T0198 狀態 | 問題 |
|------|-----------|------|
| 修復方向 | 打包層(asarUnpack) | ✅ 對,但只修了「一半」 |
| 驗證步驟 | 檢查 `.unpacked/claude.exe` 存在 | ✅ 檔案存在 |
| 缺漏驗證 | 未做 packaged build 實機 smoke test | ❌ 從未驗證「程式能跑起來」 |
| Code 層 bug | `resolveClaudeCodePath` 拋錯回空字串 | ❌ 從未被 T0198/T0199 觸及 |

**Code 層這顆 bug 可能從一開始就存在**(git log 顯示 `resolveClaudeCodePath` 寫法與 `cli.js` 目標的矛盾點,推測可能針對某個早期 SDK 版本寫的 — 該版本可能真的有 `cli.js`,後來 SDK 重構為 bin wrapper 但 code 沒跟著改)。需要進一步 git blame 確認。

### 推薦修復路線

- [x] **路線 1:只修 code 側 resolve 邏輯**(A 面產物已確認正確)

#### 建議實作(兩個候選)

**候選 A:修正 resolve target 為 `package.json`,再 join `bin/claude.exe`**

```typescript
function resolveClaudeCodePath(): string {
  let pkgPath = ''
  try {
    const req = createRequire(import.meta.url ?? __filename)
    pkgPath = req.resolve('@anthropic-ai/claude-code/package.json')
  } catch {
    try {
      pkgPath = require.resolve('@anthropic-ai/claude-code/package.json')
    } catch {
      return ''
    }
  }
  const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
  let resolved = path.join(path.dirname(pkgPath), 'bin', binaryName)
  if (resolved.includes('app.asar') && !resolved.includes('app.asar.unpacked')) {
    resolved = resolved.replace('app.asar', 'app.asar.unpacked')
  }
  return resolved
}
```

**候選 B:用 `app.isPackaged` 明確分支**(更穩健)

```typescript
import { app } from 'electron'

function resolveClaudeCodePath(): string {
  const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '@anthropic-ai',
      'claude-code',
      'bin',
      binaryName,
    )
  }
  const req = createRequire(import.meta.url ?? __filename)
  const pkgPath = req.resolve('@anthropic-ai/claude-code/package.json')
  return path.join(path.dirname(pkgPath), 'bin', binaryName)
}
```

**推薦候選 B**:邏輯更清晰、不依賴 rewrite trick、packaged 路徑 hardcode 後較穩。

#### 同步修復

`electron/main.ts:1882-1883` 也有相同 rewrite 邏輯(可能處理其他檔案),需一併檢視是否有相同 resolve target 問題。

### 驗收策略建議

#### 避免重蹈覆轍的 Smoke Test 建議

T0198 工單「驗收步驟」只檢查打包產物存在性,**這是已確認的驗證缺口**。建議新增:

1. **Packaged build 實機 smoke test**(最重要):
   ```bash
   # CI / 本地 release 流程後必跑
   "release/win-unpacked/BetterAgentTerminal.exe" --smoke-test
   # 或手動:啟動後開一個空對話,確認 Claude SDK 不拋 "specify valid path" 錯誤
   ```
   這一步能一擊攔截「檔案位置對但程式指錯位置」的整類 bug。

2. **單元測試 `resolveClaudeCodePath()`**:
   ```typescript
   describe('resolveClaudeCodePath', () => {
     it('returns non-empty in dev env', () => {
       expect(resolveClaudeCodePath()).toMatch(/claude\.exe$/)
     })
     it('returned path exists on disk', () => {
       const p = resolveClaudeCodePath()
       expect(fs.existsSync(p)).toBe(true)   // 這個 assertion 就能擋掉 v2.1.113 升級導致的 cli.js 消失
     })
   })
   ```

3. **SDK 升級 regression check**:每次升級 `@anthropic-ai/claude-code` / `@anthropic-ai/claude-agent-sdk`,列印 `resolveClaudeCodePath()` 回傳值到啟動 log,人眼 review 是否還指向實體檔。

#### *evolve 學習模式建議

此 bug 有三個可學習 pattern:

1. **「檔案存在驗證」 ≠ 「功能驗證」**:T0198 驗收只驗檔案在對的位置,沒驗程式能讀到。日後「打包相關 fix」標配「實機 smoke test」。
2. **`require.resolve` 依賴的目標檔案需在測試中斷言存在**:外部 package 版本升級可能悄悄刪掉檔案,只有「跑過」才會發現。
3. **dev-only 通過不代表修好**:packaged 環境有 asar / electron-builder / `app.isPackaged` 等 dev 看不到的行為,packaged build 驗收不可略。

### 互動紀錄

`[22:26] Q: 自動查安裝目錄(Worker 先走 source repo) → A: 使用者糾正「要找安裝目錄 C:\Program Files\BetterAgentTerminal,不是開發 source repo」 → Action: 轉向 A 面,pwsh 列 `app.asar.unpacked/` 實體內容,確認 T0198/T0199 打包層生效,問題在 code 層`

### 遭遇問題

無(調查順利,根因明確)

### Renew 歷程

無

### 產出摘要

**本工單為研究型,不改 code**,產出為回報區內完整結論。

具體輸出:
- A 面:實機 `C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\` 抽查結果(4 個子包全部存在,claude.exe 245 MB × 2)
- B 面:`resolveClaudeCodePath()` 失效鏈完整拆解 + `require.resolve('cli.js')` MODULE_NOT_FOUND 實證
- C 面:T0198/T0199 驗證缺口分析
- 修復候選 A/B 程式碼範例(建議候選 B)
- 驗收策略(smoke test + 單元測試 + SDK 升級 regression check)
- *evolve 學習模式三條建議

**塔台下一步建議**:派修復工單 T0221,實作候選 B(使用 `app.isPackaged` 分支)+ `electron/main.ts:1882-1883` 同步檢視。

### 回報時間

2026-04-19 22:31 (UTC+8)
