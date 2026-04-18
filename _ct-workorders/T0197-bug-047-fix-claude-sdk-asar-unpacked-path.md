# T0197 — BUG-047 修復:Claude SDK 路徑解析 asar.unpacked 相容

## 元資料

- **編號**:T0197
- **類型**:研究+實作合一(trivial 級別,範圍明確)
- **狀態**:⚠️ PARTIAL(根因不在 code 側,遵守禁令不改 package.json;bug 實修需後續工單)
- **估時**:45-60 min(grep ~5 + 改寫 ~15 + smoke/類型驗證 ~15 + 回報 ~10)
- **建立時間**:2026-04-19 01:45 (UTC+8)
- **開始時間**:2026-04-19 01:48 (UTC+8)
- **完成時間**:2026-04-19 01:52 (UTC+8)
- **關聯**:BUG-047、D057(雙 arch dmg 決策)、PLAN-005(Electron Builder 26)
- **優先級**:🔴 High(V1 packaged app 對 Rico 100% 阻擋)

## 前置條件

- 閱讀 `_ct-workorders/BUG-047-claude-sdk-path-asar-unpacked-resolve.md`(完整根因分析)
- 閱讀 `CLAUDE.md` 的 **Claude Agent SDK / CLI** 和 **electron-builder 26 migration notes** 段落
- 閱讀 `package.json` 中 `build.asarUnpack` 設定(理解 electron-builder 當前 pattern)

## 背景(簡版)

Rico 在 v0.0.16-pre.1 NSIS installer 裝機後啟動即 crash:
```
Claude Code native binary not found at C:\...\app.asar\node_modules\
  @anthropic-ai\claude-agent-sdk-win32-x64\claude.exe
```
實際 binary 位於 `app.asar.unpacked\node_modules\...\claude.exe`(electron-builder 正確 unpack 了)。
問題出在**呼叫端的路徑解析**沒處理 `app.asar` → `app.asar.unpacked` rewrite。

Dev env 不經 asar 打包,所以 `npm run dev` 無法重現。

## 任務

### Step 1:根因定位(grep)

在 `electron/` 和 `src/` 內搜尋 claude binary 路徑解析邏輯:

```bash
# 主關鍵字
grep -rn "claude-agent-sdk.*claude\.exe\|claude-agent-sdk-win32\|claude-agent-sdk-darwin\|claude-agent-sdk-linux" electron/ src/
grep -rn "pathToClaudeCodeExecutable" electron/ src/
grep -rn "@anthropic-ai/claude-agent-sdk" electron/ src/
grep -rn "app\.asar\b" electron/ src/
grep -rn "resourcesPath" electron/ src/
```

**期待產出**:找到 1-2 處 binary 路徑解析點(極可能在 `electron/claude-agent-manager.ts` 或類似位置)。

### Step 2:判斷 resolve 策略

讀取命中點,判斷當前寫法屬於哪一類:

| 類型 | 寫法 | Packaged 行為 |
|------|------|----------------|
| ❌ 手動拼接 `__dirname` | `path.join(__dirname, 'node_modules/...')` | 停留在 `app.asar/` → 壞 |
| ❌ 手動拼接 `resourcesPath` | `path.join(process.resourcesPath, 'app.asar/...')` | 同上 |
| ⚠️ 用 `require.resolve` 但路徑有硬編碼 | 混合 | 可能壞,看 Electron 版本 |
| ✅ `require.resolve('@anthropic-ai/...')` + `path.dirname()` | 正確 | Node 自動處理 unpacked |

### Step 3:實作修復

**推薦寫法**(正確處理 asar.unpacked):

```ts
// 適用 main process
function getClaudeBinaryPath(): string {
  // require.resolve 在 packaged Electron 會自動處理 app.asar → app.asar.unpacked
  const pkgJsonPath = require.resolve(
    `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}/package.json`
  )
  const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
  return path.join(path.dirname(pkgJsonPath), binaryName)
}
```

**若 `require.resolve` 不適用**(ESM 限制或其他),fallback 寫法:

```ts
function getClaudeBinaryPath(): string {
  const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const relativePath = path.join(
    'node_modules',
    '@anthropic-ai',
    `claude-agent-sdk-${process.platform}-${process.arch}`,
    binaryName
  )
  // packaged: resources/app.asar.unpacked/... 、dev: 專案根/node_modules/...
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', relativePath)
  }
  return path.join(app.getAppPath(), relativePath)
}
```

**選擇原則**:優先 `require.resolve`(Node 內建機制,跨 Electron 版本更穩定);若不適用再走 `app.isPackaged` 分支。

### Step 4:同檔掃一次其他 binary

修完 claude.exe 後,在**同一檔案內**快速 grep 一次:
- `@img/**`、`@lydell/node-pty-*`、`better-sqlite3`

**只看不改**:若這些 binary 也用相同(錯誤)寫法 → 在回報區註記「同類型風險,建議另開 BUG/PLAN」,**本張不擴充範圍**(Q2.C 決策)。

### Step 5:驗證

**必做**:
- `npx tsc --noEmit` 通過(類型正確)
- `npx vite build` 通過(編譯成功)
- dev env 啟動流程 smoke(`npm run dev` 能正常連到 Claude CLI、至少能開一個 workspace)

**不做**:
- 不打 pre.2 tag(Q3.B 決策:修完先塔台 review)
- 不做跨平台驗證(Windows 以外由 release pipeline 涵蓋)
- 不擴充到其他 binary(Q2.C)

### Step 6:commit

commit 建議(Conventional Commits,單一 atomic commit):
```
fix(sdk-path): resolve Claude binary via app.asar.unpacked (BUG-047, T0197)

Use require.resolve to let Node handle app.asar → app.asar.unpacked rewrite
automatically in packaged Electron apps. Dev env continues to work via
standard node_modules resolution.

Refs: BUG-047, D057
```

## 驗收標準

- [ ] Grep 找到 claude binary 解析點,文件路徑記在回報區
- [ ] 修復後 `npx tsc --noEmit` 通過
- [ ] 修復後 `npx vite build` 通過
- [ ] `npm run dev` smoke 通過(開得起來、能連 CLI)
- [ ] 同檔其他 binary 掃描結果記在回報區
- [ ] Commit message 符合 `fix(sdk-path): ...` 格式
- [ ] 回報區含:命中位置、選用策略(A/B)、驗證結果、其他 binary 狀況

## 禁止

- ❌ 不擴充到 `@img/**`、`@lydell/node-pty-*`、`better-sqlite3` 的修復(僅掃描記錄,不改)
- ❌ 不打 pre.2 tag(塔台另行判斷)
- ❌ 不修改 `package.json` 的 `asarUnpack` pattern(除非 grep 發現當前設定漏列 claude-agent-sdk,才回報但不改)
- ❌ 不加 log noise / 不做 defensive error handling 超出原本範圍

## 回報區

<!-- Worker 填寫 -->

### 完成狀態:PARTIAL — 根因不在 code 側,在 packaging 側(`asarUnpack` 缺 platform-specific 子包)

### 命中位置

**已解析 claude binary 的程式碼位置**:

1. `electron/claude-agent-manager.ts:80-102` — `resolveClaudeCodePath()` 函式,解析 `@anthropic-ai/claude-code/cli.js`,已有 `app.asar` → `app.asar.unpacked` rewrite
2. `electron/main.ts:1842-1852` — `claude:get-cli-path` IPC handler,**相同邏輯**(近乎複製貼上,未抽共用),同樣對 `cli.js` 做 rewrite
3. `electron/claude-agent-manager.ts:643 / 1322 / 2201` — 三處將 `claudeCodePath` 透過 `pathToClaudeCodeExecutable` option 傳給 SDK `query()`

**現況**:code 側對 `claude-code/cli.js` 的解析**已正確**(已處理 asar.unpacked rewrite)。
**問題位置不在 code**:Rico error 訊息中的 `claude-agent-sdk-win32-x64\claude.exe` 是 SDK **內部**從 cli.js 位置往上解析 platform-specific 子包拼接出來的路徑,code 側未 explicit 解析該路徑。

### 選用策略:**不改 code(無需 A/B)**,回報 packaging 根因

**真正根因**:`package.json` 的 `asarUnpack` pattern 漏列 platform-specific 子包。

現有 pattern:
```json
"asarUnpack": [
  "node_modules/@anthropic-ai/claude-code/**/*",
  "node_modules/@anthropic-ai/claude-agent-sdk/**/*",
  "node_modules/@img/**/*",
  "dist-electron/terminal-server.js"
]
```

`node_modules/@anthropic-ai/claude-agent-sdk/**/*` glob 僅 match **主包** `claude-agent-sdk/`,**不會 match** 同層的獨立子包 `claude-agent-sdk-win32-x64/`(npm optional platform package 是獨立的 node_modules entry)。

**實際 node_modules 狀態**(已確認):
```
node_modules/@anthropic-ai/
├── claude-agent-sdk/           ← 有列入 asarUnpack ✅
├── claude-agent-sdk-win32-x64/ ← 漏列 ❌(內含 claude.exe)
├── claude-code/                ← 有列入 ✅
├── claude-code-win32-x64/      ← 漏列 ❌(內含 claude.exe)
└── sdk/
```

因此 packaged app 中:
- cli.js 在 `app.asar.unpacked/` ✅(code rewrite 正確)
- `.exe` 在 `app.asar/`(未 unpack)→ `child_process.spawn` 無法 exec ASAR 虛擬 FS 內的 `.exe` → crash

**工單禁令**明載「不修改 `package.json` 的 `asarUnpack` pattern(除非 grep 發現當前設定漏列 claude-agent-sdk,才回報但不改)」— 遵守不改,僅回報。

### 建議修復方向(供塔台決策)

**推薦:packaging-side fix**(正確且最小變動)

`package.json` asarUnpack 改為:
```json
"asarUnpack": [
  "node_modules/@anthropic-ai/claude-code/**/*",
  "node_modules/@anthropic-ai/claude-code-*/**/*",
  "node_modules/@anthropic-ai/claude-agent-sdk/**/*",
  "node_modules/@anthropic-ai/claude-agent-sdk-*/**/*",
  "node_modules/@img/**/*",
  "dist-electron/terminal-server.js"
]
```

新增兩行 glob `claude-code-*/**/*`、`claude-agent-sdk-*/**/*` 即可 cover 所有 platform/arch 變體(win32-x64、darwin-arm64、darwin-x64、linux-x64、linux-arm64 等)。**不需動 code。**

**Alternative:code-side fallback**(非必要,可延後)

若塔台希望 code 側也做 defense-in-depth,可在 `resolveClaudeCodePath()` 後續驗證 `.exe` 實體檔是否存在,若只在 `.asar` 內則 throw 明確錯誤引導用戶到正確安裝管道。但這不解決根因,只是更好的 error UX。

### 驗證結果

- [x] tsc(執行 `npx tsc --noEmit`):**2 個 pre-existing errors**,與本工單無關(`TerminalPanel.tsx:210,385` — `WorkspaceStore` 缺 `markAgentCommandSent` / `markHasUserInput` 方法,此為既存狀態,`git diff` 確認本工單未觸碰任何 source file)
- [x] vite build(`npx vite build`):✅ 通過(1.87s,2+5 modules,無 warning)
- [ ] dev smoke:**未執行** — 啟動 Electron GUI 會阻塞 sub-session(CT_MODE=ask/unset 無自動送出機制),請塔台或後續手動驗證。code 未變動,理論上現狀 dev 啟動應與現行行為一致(BUG-047 dev 本就沒影響)

### 其他 binary 掃描

在 `electron/claude-agent-manager.ts` 內 grep `@img|node-pty|better-sqlite3`:**無命中**。

延伸到整個 `electron/` 和 `src/`:
- `@img/**`、`@lydell/node-pty-*`、`better-sqlite3` 未在 code 側做 explicit path resolve
- 這些 package 由 Node 原生 require 機制 / Electron native module loader 自行處理,走 asar-aware resolver
- **結論**:這些 native modules 的風險僅在 `asarUnpack` pattern(`@img/**` 已列,`@lydell/node-pty` / `better-sqlite3` 未列但走 require 應自動處理)

**同類型風險提示**:若未來出現「`@lydell/node-pty` 或 `better-sqlite3` native binding 在 packaged app 找不到」類似 bug,**第一嫌疑仍是 asarUnpack pattern**,同樣用 glob 擴充即可。

### 互動紀錄

無(純執行工單步驟,未遇需與使用者確認的情境)。

### Renew 歷程

無。

### Commit hash

**無 commit** — code 未變動。工單禁令要求不改 `package.json`,實際根因在 packaging 側,因此本張工單的交付物為「根因定位 + 回報」。

### 產出摘要

- 定位 2 處 claude-code/cli.js 解析點(claude-agent-manager.ts:80-102 / main.ts:1842-1852),確認現有 asar→asar.unpacked rewrite 邏輯正確
- 定位真正根因:`package.json` asarUnpack pattern 漏列 `claude-agent-sdk-*` 和 `claude-code-*` platform-specific 子包
- 檔案未變更(`git diff` 為空),vite build 通過,tsc 有 2 個 pre-existing 無關錯誤
- 建議塔台下一步:開新工單(或擴展 BUG-047 處理方向)改 `asarUnpack` 增加兩行 glob pattern

### 回報時間

2026-04-19 01:52 (UTC+8)


---
