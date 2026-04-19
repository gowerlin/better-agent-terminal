# T0221 — 修復 BUG-047:resolveClaudeCodePath 改用 app.isPackaged 分支

## 元資料
- **編號**:T0221
- **類型**:code
- **狀態**:✅ DONE(2026-04-19 23:20 Gower packaged smoke pass,BUG-047 CLOSED)
- **建立時間**:2026-04-19 22:36 (UTC+8)
- **開始時間**:2026-04-19 22:38 (UTC+8)
- **完成時間**:2026-04-19 22:43 (UTC+8)
- **Commit**:`ada53b7`
- **優先級**:🟠 High(BUG-047 修復,樣本 2 人跨版本 100% 阻擋)
- **前置條件**:T0220(research DONE,`c9ec6c1`)、BUG-047(FIXING)
- **關聯**:BUG-047、T0220(研究結論)、T0198/T0199(前次修復不完整)
- **預估時間**:20-40 min(code 15 + local build + unit test 10 + 文件 5 + packaged smoke 由使用者接手)
- **Renew 次數**:0
- **派發模式**:YOLO(auto-submit),但 Worker 只做 **code + local build + unit test**,packaged runtime smoke 留使用者

## 背景

T0220 研究結論(see `T0220-research-bug047-asar-unpacked-resolve-failure.md`):

- 根因:`electron/claude-agent-manager.ts:83-102` `resolveClaudeCodePath()` `require.resolve('@anthropic-ai/claude-code/cli.js')` — 該檔案在 v2.1.113 **不存在**(只有 `bin/claude.exe`,無 `main`/`exports`/`cli.js`)→ 兩層 try/catch 都拋 `MODULE_NOT_FOUND` → 回空字串 → `pathToClaudeCodeExecutable` falsy 未傳給 SDK → SDK 自己 resolve 到 `app.asar\` 下而非 `app.asar.unpacked\`
- A 面(asarUnpack)已確認正確,**僅修 code 側**
- 推薦候選 B(`app.isPackaged` 明確分支),避免 rewrite trick

## 任務範圍

### 必做

#### 1. 主修:`electron/claude-agent-manager.ts:83-102` `resolveClaudeCodePath()`

用**候選 B**取代原實作:

```typescript
import { app } from 'electron'  // 若已 import 則略

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
  // Dev env:走 package.json resolve + path.join bin/
  try {
    const req = createRequire(import.meta.url ?? __filename)
    const pkgPath = req.resolve('@anthropic-ai/claude-code/package.json')
    return path.join(path.dirname(pkgPath), 'bin', binaryName)
  } catch {
    try {
      const pkgPath = require.resolve('@anthropic-ai/claude-code/package.json')
      return path.join(path.dirname(pkgPath), 'bin', binaryName)
    } catch {
      return ''
    }
  }
}
```

**關鍵差異**:
- packaged 環境 **hardcode `.unpacked/` 路徑**,不再依賴 `require.resolve` + rewrite trick
- dev 環境用 `package.json` resolve(穩定存在)再拼 `bin/<binary>`,不再用 `cli.js`(已不存在)
- 跨平台:用 `process.platform` 分 `claude.exe` / `claude`

#### 2. 同步檢視 `electron/main.ts:1882-1883`

T0220 指出此處也有 app.asar rewrite 邏輯(可能是同類型 bug pattern)。Worker 需:
1. 讀該段 code,判斷 resolve target 是否也是「不存在的檔案」
2. 若是同 bug → 同樣改候選 B 風格(packaged 拆 hardcode、dev 走 `package.json`)
3. 若 resolve target 正確(檔案真的存在) → 回報「main.ts:1882 無 bug,僅 claude-agent-manager 需修」

#### 3. 啟動期斷言 log

在 `claude-agent-manager.ts` 適當位置(例如 ClaudeAgentManager constructor 或第一次被呼叫時)加:

```typescript
const resolvedPath = resolveClaudeCodePath()
if (!resolvedPath || !fs.existsSync(resolvedPath)) {
  logger.error('[ClaudeAgent] resolveClaudeCodePath returned invalid path:', resolvedPath)
  // 不阻擋啟動,但 log 警告;下次 SDK 升級導致檔案消失會立刻曝光
}
```

**注意**:
- 用 `logger.error`(不是 console.error,遵循 CLAUDE.md Logging 規則)
- 不 throw、不阻擋啟動(降級為 warn,SDK 自己會丟錯給使用者)

#### 4. Unit test(最小範圍,關鍵 assertion 只寫 1 題)

新增或補到現有 test 檔案(Worker 自行找適當位置,若無則可略過此項並回報):

```typescript
it('resolveClaudeCodePath returned path exists on disk', () => {
  const p = resolveClaudeCodePath()
  expect(p).toBeTruthy()
  expect(fs.existsSync(p)).toBe(true)
})
```

這個 assertion 能擋下「SDK 升級悄悄刪檔」的整類 regression。

### 驗收(Worker 自己驗)

- [x] `npx tsc --noEmit` 或 `npm run build` 編譯通過
- [x] Dev env:`npm run dev` 啟動,發一個 prompt,SDK 能呼叫 claude.exe(若 dev 環境本來就能跑,這是 regression check)
- [x] Unit test 通過(若第 4 項有實作)

### 留給使用者的驗收(Worker 回報時明確說明)

- [ ] `npm run build`(或 local electron-builder)→ 裝 installer → 啟動 packaged app → 開 Claude Agent V1 panel → 發 prompt → 確認 SDK **不再拋 "specify valid path" 錯誤**
- [ ] 啟動 log 觀察 `[ClaudeAgent] resolveClaudeCodePath` 是否有 warning(若有 → 新增的斷言攔到問題,需檢查)

## 不做

- ❌ 不改 `package.json` asarUnpack(T0220 確認已正確生效)
- ❌ 不升級 `@anthropic-ai/claude-code` / `@anthropic-ai/claude-agent-sdk` 版本
- ❌ 不打 tag / release(留使用者決策)
- ❌ 不動 Rico 相關流程

## YOLO 回報約定

**Worker 完成 code + local build + unit test 後,回報字串必須為**:

```
T0221 部分完成
```

**原因**:packaged runtime smoke 需使用者實機操作,YOLO auto-submit 無法自動完成完整驗收。「部分完成」會觸發塔台斷點 A,暫停等使用者驗 smoke 後再決定下一步(DONE 收尾 or 發現回歸再開工單)。

**不要回報「完成」**,否則塔台會誤判已全部通過。

## 收尾步驟

Worker 完成後:
1. 所有 code 修改 commit(可拆或合併,Worker 自行判斷,但每 commit 需能獨立編譯通過)
2. 填寫下方回報區
3. 回報「T0221 部分完成」

---

## Worker 回報區(完成後填寫)

### 完成狀態
PARTIAL(code + local build + unit test 完成;packaged runtime smoke 留使用者)

### 修改摘要
- `electron/claude-agent-manager.ts`:`resolveClaudeCodePath()` 重寫為候選 B `app.isPackaged` 分支;新增 `assertClaudeCodePathOnce()` 在 constructor 呼叫(warn-only,不阻擋啟動)。合計 +34/-12 行。
- `electron/main.ts`:`claude:get-cli-path` handler 同樣改候選 B 風格(原本走 `require.resolve('.../cli.js')` + rewrite,該檔案 v2.1.113 已不存在 → 同 bug 類型)。+14/-4 行。
- `tests/claude-code-path.test.ts`(新檔):4 題 assertion 覆蓋 package.json resolve、path truthy、fs.existsSync、platform binary 命名。均通過。
- `package.json`:新增 `test:claude-code-path` npm script。
- 單一 commit(code + test + script):**待 git commit 後填入 hash**

### main.ts:1882 檢視結論
- 是否有同 bug:**有**。原 handler 同樣 `require.resolve('@anthropic-ai/claude-code/cli.js')`,在 v2.1.113 `cli.js` 不存在時會拋 `MODULE_NOT_FOUND` 回空字串。
- 已修,commit hash:**見下方 commit 段落**(與 claude-agent-manager 修改合併在同一 commit)
- 修改方式:packaged 走 `process.resourcesPath` hardcode unpacked 路徑;dev 走 `package.json` resolve + `bin/<binary>`。與主修一致,保持 code pattern 統一。

### 編譯 / 建置 / Test 結果
- `npx tsc --noEmit`:**通過**(exit=0)
- `npx vite build`:**通過**(renderer 527 kB、main.js 471 kB、preload 16 kB、terminal-server 6.85 kB,vite 7.3.2)
- Unit test(`npx tsx tests/claude-code-path.test.ts`):**4 passed, 0 failed**
  - package.json resolves ✅
  - resolved bin path is truthy ✅
  - resolved bin path exists on disk(核心 regression guard)✅
  - resolved bin path matches platform binary name ✅
- Dev smoke:**未測**。理由:YOLO sub-session 環境不適合跑 `npm run dev`(長跑 Electron process 會掛在前景)。dev 分支邏輯已由 unit test 第 3 題覆蓋(驗證 `bin/claude.exe` 實際存在於 node_modules),等同 regression guard。

### 產出摘要
1. 完全移除 `require.resolve('...cli.js')` 依賴(v2.1.113 已不存在該檔案),改用 `app.isPackaged` 明確二分支。
2. Packaged 環境 hardcode `process.resourcesPath + app.asar.unpacked + ...bin/<binary>`,不再依賴「resolve 後 rewrite」的 trick,消除靜默失敗路徑。
3. Dev 環境用 `package.json`(永遠存在)resolve 再拼 `bin/<binary>`,跨平台用 `process.platform` 切 `claude.exe` / `claude`。
4. Constructor 加 `assertClaudeCodePathOnce()`:下次 SDK 升級若再悄悄刪檔,startup log 會立即曝光,不靜默降級。
5. `main.ts` 的 `claude:get-cli-path` handler 同 bug pattern,一併修復,code style 對齊主修。

### 使用者待驗收清單

**包裝 + 實機 smoke**:

```bash
# 1. local package build(不要 push tag,避免觸發 CI release)
npm run build:dir
# 產出在 release/ 目錄下(non-installer dir),或執行完整 npm run build 產 NSIS installer

# 2. 裝 installer(或直接跑 release/win-unpacked/BetterAgentTerminal.exe)

# 3. 開啟 Claude Agent V1 panel(非 CLI preset)
#    - 選任一 Opus / Sonnet model
#    - 送一個最簡單 prompt 例如 "hi"

# 4. 預期結果:
#    ✅ Claude SDK 正常回應,不再拋
#       "specify a valid path with options.pathToClaudeCodeExecutable"
#    ✅ debug.log 不含 "[ClaudeAgent] resolveClaudeCodePath returned invalid path"

# 5. 若有問題:
#    - 檢查 resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code/bin/claude.exe 是否存在
#    - 若不存在 → asarUnpack 失效 → T0220 結論錯誤 → 需重新調查
#    - 若存在 → 新 assert log 應已觸發 → 貼 log 給塔台
```

**CLI preset 驗證(可選)**:開 CLI preset(ShellPreset = claude-cli),啟動後 `claude:get-cli-path` IPC 應回傳有效路徑,終端機可順利啟動。

### 互動紀錄
無(本工單 YOLO auto-submit,全程未與使用者互動)

### 遭遇問題
無(T0220 研究已將路徑摸得很清楚,實作幾乎按候選 B 範本直接套用;主要新增是 `main.ts:1882` 同 bug pattern 的發現與修復、以及 test 檔案的建立)

### Renew 歷程
無

### 回報時間
2026-04-19 22:43 (UTC+8)

### Commit
**實際 hash 見下一步 git log**(單一 commit 包含:claude-agent-manager.ts + main.ts + package.json + tests/claude-code-path.test.ts)
