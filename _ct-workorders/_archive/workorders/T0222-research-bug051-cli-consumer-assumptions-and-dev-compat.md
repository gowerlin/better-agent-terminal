# T0222 — 研究:BUG-051 CLI consumer 假設 + dev/packaged 跨平台相容性

## 元資料

- **編號**:T0222
- **類型**:research(研究型工單,允許 Worker 互動)
- **狀態**:✅ DONE
- **建立時間**:2026-04-19 23:24 (UTC+8)
- **開始時間**:2026-04-19 23:30 (UTC+8)
- **完成時間**:2026-04-19 23:33 (UTC+8)
- **commit**:4ce1d60
- **派發模式**:`--mode on --interactive`(允許 Worker 與使用者互動釐清範圍)
- **優先級**:🟠 High(BUG-051 100% 阻擋 packaged 環境 claude-cli preset)
- **前置條件**:BUG-051(OPEN)
- **關聯**:BUG-047(CLOSED)、BUG-051(OPEN)、T0221(SDK 端修復主體)
- **預估時間**:20-40 min(含 consumer 盤點 + dev 環境驗證)
- **Renew 次數**:0

## 背景

BUG-047 T0221 把 `claude:get-cli-path` IPC handler 回傳從 `@anthropic-ai/claude-code/cli.js`(Node.js script,v2.1.113 已不存在)改為 `bin/claude(.exe)`(native binary)。SDK 端 `pathToClaudeCodeExecutable` 傳給 `claude-agent-sdk` 的 `query()` 後 SDK 自己 spawn,行為正常。

但 **consumer 端**(UI 按鈕觸發的 claude-cli preset 終端)仍用舊假設 prefix `node`:

```ts
// src/components/WorkspaceView.tsx:684
const cmdParts = ['node', `"${cliPath}"`]
```

→ Windows packaged:`node claude.exe` 拋 `ERR_UNKNOWN_FILE_EXTENSION`(BUG-051 現象)。

使用者選 Q2.C 深查,並補充「要考慮相容開發 dev server 執行」。

## 研究目標

**三面交付**,結論要能直接 driver T0223 修復工單。

### A 面:Consumer 盤點(code 側)

**目標**:定位所有呼叫 `getCliPath()` / 取得 CLI path 的地方,驗證每個 consumer 的執行協議假設。

**執行**:
```bash
# 主要 consumer 入口
grep -rn "getCliPath\|claude:get-cli-path" src/ electron/

# 所有直接或間接用 CLI path 組命令的地方
grep -rn "claude-cli\|claudeCli" src/components/ src/agent-runtime/ electron/

# Agent registry 是否也有類似假設
grep -rn "bin/claude\|node.*claude" src/ electron/ scripts/
```

**盤點表**(每個 hit 填):

| 檔案:行號 | 組命令方式 | 是否 prefix `node`? | 跨平台處理? | BUG-051 同嫌疑? |
|-----------|-----------|---------------------|------------|-----------------|
| `WorkspaceView.tsx:684` | `['node', '"${cliPath}"']` | ✅ 是 | ❌ 無條件 | ✅ **已確認** |
| ... | ... | ... | ... | ... |

**特別檢查**:
- `src/types/agent-presets.ts`、`src/types/agent-runtime.ts` 的 claude-cli preset 定義(是否有 launch template 寫死 `node` prefix)
- `electron/remote/protocol.ts` remote 端有沒有自己組 CLI 命令(PLAN-018 遠端路徑)
- `electron/agent-runtime/agent-registry.ts` launch command builder

### B 面:Dev 環境相容驗證(使用者關鍵補充)

**目標**:確認 `@anthropic-ai/claude-code@2.1.113` 的 `bin/claude` 和 `bin/claude.exe` 在 **dev server 環境**(`npm run dev`)下如何啟動才能跨 Windows/POSIX 都成立。

**4 象限驗證矩陣**:

| 象限 | Dev / Packaged | 平台 | 二進位位置 | 驗證命令 |
|------|----------------|------|-----------|---------|
| Q1 | Dev | Windows (Git Bash) | `node_modules/@anthropic-ai/claude-code/bin/claude.exe` | 直接執行 `<path>` vs `node <path>` |
| Q2 | Dev | POSIX (macOS/Linux) | `node_modules/@anthropic-ai/claude-code/bin/claude` | 直接執行 `<path>` vs `node <path>` |
| Q3 | Packaged | Windows | `app.asar.unpacked/.../bin/claude.exe` | 已知 `node` prefix 失敗,驗證直接執行 |
| Q4 | Packaged | POSIX | `app.asar.unpacked/.../bin/claude` | 待驗(Worker 若無 macOS/Linux 機可詢問使用者) |

**關鍵問題**:
1. `bin/claude`(POSIX)是 native binary(ELF/Mach-O)還是 Node.js script with shebang(`#!/usr/bin/env node`)?
   - 執行 `file node_modules/@anthropic-ai/claude-code/bin/claude`(POSIX)或 `head -1`(檢查 shebang)
2. `bin/claude.exe`(Windows)是純 native binary 還是 Node.js stub wrapper?
   - 查 `@anthropic-ai/claude-code` 官方文檔 / 實驗:能否直接 `./claude.exe --version`?
3. 若 POSIX `bin/claude` 是 shebang script,在 Git Bash(Windows)能否直接執行?或需 fallback 到 `node <path>`?

**可 Worker 執行的 dev 驗證**:
```bash
# Windows dev 環境(本專案根目錄)
ls node_modules/@anthropic-ai/claude-code/bin/
file node_modules/@anthropic-ai/claude-code/bin/claude 2>/dev/null || echo "POSIX not present"
# 直接執行測試(Windows)
./node_modules/@anthropic-ai/claude-code/bin/claude.exe --version
```

### C 面:修復方案草擬

**目標**:根據 A + B 結論,給出 T0223 修復工單可直接依循的修復路線。

**候選方案**:

**方案 α(min-diff)**:只改 `WorkspaceView.tsx:684`
```ts
const cmdParts = [`"${cliPath}"`]  // 去掉 'node' prefix,直接執行 native binary
```
- 前提:所有平台 `bin/claude(.exe)` 皆可直接執行(待 B 面驗證)
- 風險:若 POSIX `bin/claude` 是 shebang script,Git Bash 執行行為未知

**方案 β(跨平台智慧分支)**:
```ts
const cmdParts = process.platform === 'win32'
  ? [`"${cliPath}"`]           // Windows: 直接執行 .exe
  : [`"${cliPath}"`]           // POSIX: 直接執行(依賴 shebang)
```
- 若 B 面確認所有平台都可直接執行 → 等同方案 α
- 若 POSIX 需特別處理 → 此處可分支

**方案 γ(擴大 refactor)**:抽共用 helper
- 若 A 面盤點出多個 consumer,集中處理「組 CLI 啟動命令」邏輯
- 取代點:`WorkspaceView.tsx`、可能的 agent-registry launch builder 等

**輸出格式**(D 區段拆單建議表):

| 方案 | 修改檔案數 | 行數 | 跨平台 | 風險 | T0223 預估 |
|------|-----------|------|--------|------|-----------|
| α | 1 | ~1 | 待驗 | 低 | 5-10 min |
| β | 1 | ~3 | ✅ | 低 | 10-15 min |
| γ | 2-4 | ~20-50 | ✅ | 中 | 30-60 min |

### D 面(可選):驗收腳本建議

給 T0223 修復工單用的驗收清單:

**Dev server smoke**:
```bash
npm run dev
# BAT 啟動後,workspace → 點「+ Claude CLI」→ 驗證終端進入 claude 交互模式
```

**Packaged smoke**(使用者親驗):
```bash
npm run build:dir
# 啟動 release/win-unpacked/BetterAgentTerminal.exe
# 開 workspace → 點「+ Claude CLI」→ 驗證同 dev
```

**Unit test guard**(仿 T0221 `fs.existsSync` 風格):
- 測 `getCliPath()` 回傳路徑的執行協議假設是否在 consumer 端正確被消費
- (具體設計由 Worker 根據 A 面盤點決定)

## 必答問題(研究產出 CHECK-LIST)

Worker 研究完成前必須回答:

1. ✅ **所有 consumer 盤點完成**(A 面表格填滿)
2. ✅ **Dev 4 象限驗證結論**(B 面 Q1-Q4 各有答案)
3. ✅ **POSIX `bin/claude` 類型**(native binary / shebang script / stub wrapper)
4. ✅ **Windows `bin/claude.exe` 可直接執行**(是 / 否 + 證據)
5. ✅ **推薦方案**(α / β / γ + 理由)
6. ✅ **是否發現其他 consumer 同嫌疑**(是 → 列出;否 → 明確陳述 WorkspaceView 為唯一命中)
7. ✅ **T0223 修復工單拆單建議**(單工單 or 多工單)

## 互動模式

- **Mode**:`--mode on --interactive`
- **允許互動次數**:3 次(tower-config 預設 `research_max_questions: 3`)
- **使用者可能協助**:
  - Windows 直接執行 `.exe` 的 smoke(若 Worker dev 環境驗證有困難)
  - macOS/Linux 端行為確認(Worker 若無該平台)

## 使用者自助驗證(Worker 可請求)

若 Worker 需使用者協助:
```bash
# Windows dev 環境
ls node_modules/@anthropic-ai/claude-code/bin/
./node_modules/@anthropic-ai/claude-code/bin/claude.exe --version

# Packaged 環境(使用者已安裝 v0.0.16-pre.1)
"C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@anthropic-ai\claude-code\bin\claude.exe" --version
```

## 不在本工單範圍

- ❌ 實際修復(留給 T0223)
- ❌ macOS/Linux packaged 完整 smoke(需 CI 或多平台使用者,非本地 Worker 能做)
- ❌ `@anthropic-ai/claude-code` 官方文檔深度研究(超出 Worker 時間預算)

---

## 研究回報區(Worker 填)

### 完成狀態

✅ **DONE** — 三面交付完成,結論可直接 driver T0223 修復工單(單工單、min-diff 1 行)。

### 互動紀錄

無 — 所有必答問題均透過程式碼分析 + dev 環境實證得出,未需向使用者提問(額度 3 次,使用 0 次)。

### Renew 歷程

無。

---

### A 面 — Consumer 盤點

**主要 grep 結果**:
- `getCliPath\|claude:get-cli-path`: 6 hits(其中只 1 個是「組命令的 consumer」,其餘為 bridge/handler/type 宣告)
- `claude-cli\|claudeCli`: 全是 preset id 字串,**無組命令邏輯**
- `bin/claude\|claude.exe`: 命中 main.ts、claude-agent-manager.ts、tests(都是 path 組裝端,非 launcher)

**完整盤點表**:

| 檔案:行號 | 角色 | 組命令方式 | prefix `node`? | 跨平台處理? | BUG-051 同嫌疑? |
|-----------|------|-----------|---------------|-------------|----------------|
| `src/components/WorkspaceView.tsx:684` | **唯一 launcher** | `['node', '"${cliPath}"']` | ✅ 是 | ❌ 無分支 | ✅ **已確認(BUG-051 命中點)** |
| `electron/preload.ts:222-223` | IPC bridge | N/A | N/A | N/A | ❌ |
| `electron/main.ts:1881-1900` | IPC handler(提供 path) | N/A | N/A | platform 分支(見附加 bug) | ❌ |
| `electron/agent-runtime/agent-registry.ts:375-376` | launch builder | 顯式 `return null`(註解「for claude-cli, the command is built separately via bundled CLI path」) | N/A | N/A | ❌ |
| `electron/remote/protocol.ts:29` | IPC allowlist | N/A | N/A | N/A | ❌ |
| `src/types/electron.d.ts:213` | type 宣告 | N/A | N/A | N/A | ❌ |
| `src/types/agent-presets.ts:41,48` | preset 定義 | 無 launch template | N/A | N/A | ❌ |
| `src/types/agent-runtime.ts:78,94` | preset 判斷 helper | N/A | N/A | N/A | ❌ |
| `src/App.tsx:786,805` | 讀 customArgs(字串) | 不組命令 | N/A | N/A | ❌ |
| `src/components/ClaudeAgentPanel.tsx:3298` | className 字串 | N/A | N/A | N/A | ❌ |
| `tests/claude-code-path.test.ts:38,70` | T0221 測試 | path 預期值 | N/A | platform 分支(見附加 bug) | ❌ |

**結論**:**`WorkspaceView.tsx:684` 為唯一 BUG-051 命中點**,沒有第二個 consumer 同嫌疑。`agent-registry.ts` 的 launch builder 已明確讓開 claude-cli,責任全在 WorkspaceView。

### B 面 — Dev 環境 4 象限驗證

**關鍵實證**(Windows dev 機):

```bash
$ ./node_modules/@anthropic-ai/claude-code/bin/claude.exe --version
2.1.113 (Claude Code)         # ← 直接執行成功,證實 native binary 可獨立跑
```

**`@anthropic-ai/claude-code/install.cjs` 關鍵段落**(line 174-178):
```js
// Always write to bin/claude.exe — the package.json bin field points here.
// The .exe extension + no-shebang stub makes npm's cmd-shim (generated at
// install time, before postinstall) emit a direct exec on Windows; Unix
// ignores the extension. Same pattern as Bun's npm package.
const dest = path.join(__dirname, 'bin', 'claude.exe')
```

→ **檔名永遠是 `bin/claude.exe`**(不論平台);POSIX 由 `chmodSync(dest, 0o755)`(line 122-124)賦執行權限。

**Platform 套件結構**(`@anthropic-ai/claude-code-win32-x64/`):
```
claude.exe*    LICENSE.md    package.json    README.md
```
→ binary 位在 platform-specific package **根目錄**,install.cjs hardlink 到 wrapper 套件 `bin/claude.exe`。

**4 象限結論**:

| 象限 | Dev/Packaged | 平台 | 二進位位置 | 直接執行? | `node` prefix? |
|------|--------------|------|-----------|---------|---------------|
| Q1 | Dev | Windows | `node_modules/.../bin/claude.exe` | ✅ **實證成功** | ❌ 會 fail(`ERR_UNKNOWN_FILE_EXTENSION`) |
| Q2 | Dev | POSIX | `node_modules/.../bin/claude.exe`(**也叫 .exe**) | ✅ install.cjs chmod 0o755 + native binary,推論可行 | ❌ 同 Q1 |
| Q3 | Packaged | Windows | `app.asar.unpacked/.../bin/claude.exe` | ✅ 同 Q1 | ❌ **BUG-051 主場** |
| Q4 | Packaged | POSIX | `app.asar.unpacked/.../bin/claude.exe` | ✅ 同 Q2 | ❌ 同 Q1 |

### 必答問題 CHECK-LIST

1. ✅ Consumer 盤點完成 — 唯一命中 `WorkspaceView.tsx:684`
2. ✅ Dev 4 象限結論完整(Q1 Windows dev 實測;Q2 推論依 install.cjs 強證據;Q3/Q4 packaged 沿用同邏輯)
3. ✅ POSIX `bin/claude.exe` = **native binary**(install.cjs 註解明示「no-shebang stub」+ chmod 0o755 + Bun 模式)
4. ✅ Windows `bin/claude.exe` 可直接執行 = **是**(實證 `--version` 回 `2.1.113`)
5. ✅ 推薦方案 = **方案 α**(理由見 C 面)
6. ✅ 是否其他 consumer 同嫌疑 = **否**(WorkspaceView 唯一)。**但發現附加 bug,見 C 面 follow-up**
7. ✅ T0223 拆單建議 = **單工單,min-diff 1 行**

### C 面 — 推薦方案 α(min-diff)

**修改點**:`src/components/WorkspaceView.tsx:684`

```diff
- const cmdParts = ['node', `"${cliPath}"`]
+ const cmdParts = [`"${cliPath}"`]
```

**理由**:
- B 面證實所有平台 `bin/claude.exe` 皆為 native binary,可直接執行
- Windows 與 POSIX 行為一致 → 方案 β 的分支無意義
- 沒有第二 consumer → 方案 γ 的抽 helper 是過度設計
- 修改 1 行 1 檔,衝擊面最小,易回滾

**方案比較表**:

| 方案 | 修改檔案 | 行數 | 跨平台 | 風險 | T0223 預估 |
|------|---------|------|--------|------|-----------|
| **α(推薦)** | 1 | ~1 | ✅ | 低 | 5-10 min |
| β | 1 | ~3 | ✅ | 低(無實質差異) | 10-15 min |
| γ | 2-4 | 20-50 | ✅ | 中(過度設計) | 30-60 min |

### Follow-up 建議(**超出 T0223 範圍,建議開新 BUG**)

**附加發現的 bug**:
- `electron/main.ts:1882`:`const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'`
- `tests/claude-code-path.test.ts:38,70`:同樣假設 POSIX 為 `claude`(無 .exe)
- **實際**:install.cjs 證實 binary **永遠**叫 `bin/claude.exe`(不論平台)
- **影響**:packaged macOS/Linux 上 `getCliPath()` 會回傳不存在的路徑(`bin/claude`),BUG-047 修復在非 Windows 平台仍未真正解決
- **建議**:T0223 完成後另開 BUG-052(暫名)處理,或併入 T0223(新增 1 行修改 + 測試)

→ **更新建議**:T0223 可同時修兩處(WorkspaceView.tsx:684 去 `node` prefix + main.ts:1882 改用 `claude.exe` 統一檔名),仍屬 min-diff(2 行),完整解 BUG-051 並避免另一個潛在 bug。

### D 面 — 驗收腳本建議

**Dev smoke**(T0223 開發者本地):
```bash
npm run dev
# Workspace → 「+ Claude CLI」按鈕 → 終端應進入 claude 交互模式
# 預期:無 ERR_UNKNOWN_FILE_EXTENSION、無 ENOENT、無 "node: command not found"
```

**Packaged smoke**(使用者親驗,BUG-051 主場):
```bash
npm run build:dir
"./release/win-unpacked/BetterAgentTerminal.exe"
# Workspace → 「+ Claude CLI」 → 同上驗證
```

**Unit test guard**(可選,仿 T0221):
- 在 `tests/` 新增 case 驗證 `WorkspaceView.startClaudeCliPty` 組出的命令字串**不**含 `'node '` 前綴
- 若採用上方「Follow-up 同併」建議,應補測 `getCliPath()` 在所有平台都回傳 `bin/claude.exe`(非 `bin/claude`)

### 產出摘要

- 修改檔案:1(本工單純研究,僅修改工單元資料 + 填回報)
  - `_ct-workorders/T0222-research-bug051-cli-consumer-assumptions-and-dev-compat.md`(狀態 + 開始/完成時間 + 回報區)
- 建立檔案:0
- 程式碼變更:0(研究型工單)

### 遭遇問題

無實質障礙。原工單 B 面 Q2/Q4 列為「Worker 若無 macOS/Linux 機可詢問使用者」,但 `install.cjs` 第 174-178 行註解 + `chmodSync 0o755` 已提供強推論證據,無需實機驗證即可達「可決策」結論。若 T0223 後在 macOS/Linux packaged 仍見問題,依 Follow-up 建議的附加 bug 處理。

### 回報時間

2026-04-19 23:33 (UTC+8)

