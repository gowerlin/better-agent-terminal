# T0199 — 預防性 asarUnpack 修補:`@lydell/node-pty-*` platform-specific 子包

## 元資料

- **編號**:T0199
- **類型**:預防性實作(trivial,設定一行 + 驗證)
- **狀態**:✅ DONE
- **估時**:15-25 min(改設定 ~1 + build 驗 `.unpacked/` ~10 + 回報 ~5)
- **實際耗時**:~4 min
- **建立時間**:2026-04-19 02:05 (UTC+8)
- **開始時間**:2026-04-19 02:14 (UTC+8)
- **完成時間**:2026-04-19 02:18 (UTC+8)
- **關聯**:T0198(同類型發現)、BUG-047(觸發本張的背景)、D057
- **優先級**:🟢 Medium(無 user report,預防性修復。既然 packaging 本 session 已動,順手修補降低未來驚喜)

## 前置條件

- T0198 已完成並 commit(`e619b81`,asarUnpack 已補 `@anthropic-ai` 兩組 platform 子包)
- 閱讀 T0198 回報區「其他 binary 排查結果」段(Worker 已排查 `@lydell/node-pty-*` 和 `better-sqlite3`,結論:`@lydell` 有漏列風險,`better-sqlite3` 無)

## 背景

T0198 排查發現 `node_modules/@lydell/node-pty-win32-x64/` 內含 `conpty.node` 等 PTY 原生 binary,目前 `asarUnpack` **未列**。

**為何不是緊急 BUG**:
- `.node` 模組以 `require()` 載入,Electron 的 native module loader 對 asar 內 `.node` 檔有內建處理機制(不同於 `.exe` 走 `child_process.spawn` file system 呼叫)
- 目前無使用者回報 PTY/terminal 開不起來
- 但**這是推論不是驗證**,一旦某版 Electron 行為變動就可能壞

**為何此時修**:
- 本 session packaging 配置已動(T0198),順手補齊成本極低
- 避免未來某個 Electron 升級踩雷(D057 雙 arch dmg 已經踩過 packaging 坑)
- 和 `@anthropic-ai` 的兩組 glob 保持對稱,降低「為什麼 `@anthropic-ai/claude-code-*` 要列但 `@lydell/node-pty-*` 不列」的認知負擔

## 任務

### Step 1:確認實際子包名稱

```bash
ls node_modules/@lydell/
# 期望看到 node-pty 主包 + 各 platform 子包,例如:
#   node-pty/
#   node-pty-win32-x64/
#   node-pty-darwin-arm64/
#   node-pty-linux-x64/
# 等等(視 optional deps 安裝狀態)
```

### Step 2:修改 `package.json` 的 `asarUnpack`

T0198 後現況:
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

改為(新增兩行,與 `@anthropic-ai` 對稱):
```json
"asarUnpack": [
  "node_modules/@anthropic-ai/claude-code/**/*",
  "node_modules/@anthropic-ai/claude-code-*/**/*",
  "node_modules/@anthropic-ai/claude-agent-sdk/**/*",
  "node_modules/@anthropic-ai/claude-agent-sdk-*/**/*",
  "node_modules/@lydell/node-pty/**/*",
  "node_modules/@lydell/node-pty-*/**/*",
  "node_modules/@img/**/*",
  "dist-electron/terminal-server.js"
]
```

**為什麼主包 `node-pty` 也列入**:與 `@anthropic-ai/claude-agent-sdk` 對稱。主包內有 JS wrapper + `index.d.ts`,雖然不含 `.node`,但列入不傷(全部原始檔進 `.unpacked/` 只是多佔 ~幾百 KB),保持 pattern 一致性。若主包內不含需執行的 native,可只列 `-*/**/*` 一行 — **由 Worker 判斷**。

**判斷準則**:
- 看 `node_modules/@lydell/node-pty/` 是否含 `.node` 或 `.exe` 等需 unpack 的檔(通常 npm optional platform 主包只有 JS wrapper,不含 binary)
- 若主包純 JS → 只加 `node-pty-*/**/*` 一行即可(更精簡)
- 若主包也含 binary → 加兩行對稱

### Step 3:Build 驗證 `.unpacked/` 實際內容

```bash
rm -rf release/ dist-electron/ dist/
npx electron-builder --win --dir

# 驗證 @lydell 子包解壓
ls release/win-unpacked/resources/app.asar.unpacked/node_modules/@lydell/
# 期望看到 node-pty-win32-x64/(至少,看 optional deps)

# 驗證 .node 實體存在
ls release/win-unpacked/resources/app.asar.unpacked/node_modules/@lydell/node-pty-win32-x64/*.node
# 期望:conpty.node、conpty_console_list.node(或 build/Release/*.node)
```

若 `.node` 檔仍在 asar 內(未 unpack)→ glob pattern 可能需要調整,回報並停手。

### Step 4:tsc + vite build(保險)

```bash
npx tsc --noEmit   # 允許 TerminalPanel.tsx 兩個 pre-existing errors(BUG-042)
npx vite build
```

### Step 5:Commit

```
chore(packaging): unpack @lydell/node-pty platform subpackages (T0199)

Preventive fix following T0198 pattern. @lydell/node-pty-win32-x64 etc.
are independent node_modules entries containing native .node bindings.
While Electron's native module loader generally handles asar-internal
.node files, explicit unpack aligns behavior with @anthropic-ai pattern
and avoids future surprises across Electron version upgrades.

No user reports to date; this is defense-in-depth.

Refs: T0198, BUG-047
```

Commit 類型用 `chore:` 而非 `fix:`,因為沒有已知的 user-facing bug。

## 驗收標準

- [ ] `package.json` asarUnpack 新增 `@lydell/node-pty` 相關 glob(一行或兩行,由實際子包結構決定)
- [ ] `electron-builder --win --dir` 通過
- [ ] `release/win-unpacked/resources/app.asar.unpacked/node_modules/@lydell/node-pty-win32-x64/` 存在
- [ ] 至少一個 `.node` 檔在 `.unpacked/`(非在 asar 內)
- [ ] tsc 除 BUG-042 兩個 pre-existing 外全綠
- [ ] vite build 全綠
- [ ] 回報區含:實際子包結構、`.unpacked/` 驗證、選一行 or 兩行 glob 的理由

## 禁止

- ❌ 不動 `better-sqlite3` 配置(T0198 排查確認無需)
- ❌ 不動 `@img/**` 配置(已 cover)
- ❌ 不打 pre.2 tag(等塔台決策,本張完成後才由塔台/使用者一起處理)
- ❌ 不改任何 code 檔
- ❌ 不做 runtime PTY 功能測試(範圍過大,非本張責任)

## 回報區

### 實際 `@lydell/` 子包結構

```
$ ls node_modules/@lydell/
node-pty/
node-pty-win32-x64/

$ ls node_modules/@lydell/node-pty/
conpty_console_list_agent.js  index.js          node-pty.d.ts  shared/      utils.js
eventEmitter2.js              interfaces.js     package.json   terminal.js  windowsConoutConnection.js
LICENSE                       requireBinary.js  README.md      types.js     windowsPtyAgent.js
                                                                            windowsTerminal.js
                                                                            worker/

$ ls node_modules/@lydell/node-pty-win32-x64/
conpty.node*  conpty.pdb  conpty_console_list.node*  conpty_console_list.pdb  package.json  README.md
```

僅 win32-x64 platform 子包安裝(因目前在 Windows 主機,optionalDependencies 只裝對應 platform)。

### 選用策略(一行 or 兩行 glob)

**採兩行 glob**(與 `@anthropic-ai` 對稱):
```json
"node_modules/@lydell/node-pty/**/*",
"node_modules/@lydell/node-pty-*/**/*",
```

理由:
1. 主包 `@lydell/node-pty/` 雖純 JS(無 `.node`),但含 `requireBinary.js`、`worker/`、`shared/` 等 runtime 依賴,`requireBinary.js` 動態 require platform 子包的 `.node`,放 `.unpacked/` 才不會被 asar lazy-load 卡住
2. 與 `@anthropic-ai/claude-agent-sdk` + `claude-agent-sdk-*` 兩行 pattern 對稱,降低未來維護成本
3. 多佔幾百 KB 換明確語意值得

### `.unpacked/` 驗證

```
$ ls release/win-unpacked/resources/app.asar.unpacked/node_modules/@lydell/
node-pty/
node-pty-win32-x64/

$ ls release/win-unpacked/resources/app.asar.unpacked/node_modules/@lydell/node-pty-win32-x64/
conpty.node*
conpty_console_list.node*
package.json
```

✅ 兩個 `.node` 檔(`conpty.node`、`conpty_console_list.node`)實體存在於 `.unpacked/`,非在 asar 內。

### Commit hash

`5de178e` — chore(packaging): unpack @lydell/node-pty platform subpackages (T0199)

附註:本 commit 連帶 stage 了 T0198 工單檔的 5 行小幅修改(session 開始前已 staged 狀態,非本工單範圍變更),不影響 T0199 內容。

### 驗證結果

- [x] `package.json` 改動(asarUnpack 新增兩行,line 158-159)
- [x] `electron-builder --win --dir` 通過
- [x] `.node` 在 `.unpacked/`(`conpty.node`、`conpty_console_list.node`)
- [x] tsc(僅 BUG-042 兩個 pre-existing errors,符合預期)
- [x] vite build 全綠

---
