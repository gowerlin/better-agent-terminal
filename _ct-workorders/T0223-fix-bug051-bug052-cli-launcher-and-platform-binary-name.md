# T0223 — 修復 BUG-051 + BUG-052:claude-cli launcher 去 `node` prefix + 平台 binary 命名統一

## 元資料

- **編號**:T0223
- **類型**:code
- **狀態**:🔄 IN_PROGRESS
- **建立時間**:2026-04-19 23:35 (UTC+8)
- **開始時間**:2026-04-19 23:41 (UTC+8)
- **派發模式**:`--mode yolo --no-interactive` + 斷點 A(packaged smoke 由使用者親驗)
- **優先級**:🟠 High(BUG-051 100% 阻擋 packaged Windows claude-cli preset)
- **前置條件**:BUG-051(OPEN)、BUG-052(OPEN)、T0222(research DONE, commit `4ce1d60`)
- **關聯**:BUG-047(CLOSED)、BUG-051、BUG-052、T0221(修復主體)、T0222(研究結論)
- **預估時間**:15-30 min(code 5 + build 5 + unit test 更新 5 + 文件 5 + packaged smoke 由使用者接手)
- **Renew 次數**:0

## 背景

T0222 研究結論(見 `T0222-research-bug051-cli-consumer-assumptions-and-dev-compat.md`):

1. **BUG-051 唯一命中點**:`src/components/WorkspaceView.tsx:684` 無條件 prefix `'node'`
2. **Windows/POSIX `bin/claude.exe` 皆可直接執行**(install.cjs 證實 native binary,跨平台檔名永遠叫 `.exe`)
3. **附加發現 BUG-052**:`main.ts:1882` + `tests/claude-code-path.test.ts` 誤假設 POSIX 檔名為 `claude`(實際也是 `claude.exe`)

## 修復範圍(合併 BUG-051 + BUG-052)

### 第 1 處(BUG-051 主場)

**`src/components/WorkspaceView.tsx:684`**

```diff
- const cmdParts = ['node', `"${cliPath}"`]
+ const cmdParts = [`"${cliPath}"`]
```

理由:`cliPath` 已為 native binary(`bin/claude.exe`),直接執行即可,跨平台皆成立。

### 第 2 處(BUG-052 主場)

**`electron/claude-agent-manager.ts`** — `resolveClaudeCodePath()` 內

```diff
- const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
+ const binaryName = 'claude.exe'  // install.cjs 證實跨平台檔名永遠是 .exe(Unix 忽略副檔名)
```

### 第 3 處(BUG-052 同 pattern)

**`electron/main.ts:1882`** — `claude:get-cli-path` handler 內

```diff
- const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
+ const binaryName = 'claude.exe'
```

### 第 4 處(BUG-052 測試同步)

**`tests/claude-code-path.test.ts:38,70`**(或任何假設 POSIX 為 `claude` 的斷言)

- 將 POSIX 測試分支的 expected 值從 `claude` 改為 `claude.exe`
- 或若測試用 `process.platform === 'win32' ? 'claude.exe' : 'claude'` pattern,改為直接 `'claude.exe'`

(具體行號以 Worker 讀檔為準,T0222 盤點標示 line 38 + 70)

## Commit 策略

**單一 atomic commit**(與 T0221 風格一致),suggested message:

```
fix(claude-cli): use native binary directly and unify binary name across platforms

- WorkspaceView.tsx: remove 'node' prefix when launching claude-cli preset
  (BUG-051: Node.js v25 throws ERR_UNKNOWN_FILE_EXTENSION on .exe)
- main.ts / claude-agent-manager.ts: unify binaryName to 'claude.exe'
  (BUG-052: install.cjs ships bin/claude.exe on all platforms, not bin/claude)
- claude-code-path.test.ts: update POSIX assertion to claude.exe

Closes BUG-051
Closes BUG-052
```

## 驗收

### Dev smoke(Worker 自驗)

```bash
npm run dev
# 1. BAT 啟動
# 2. 開 workspace → 點「+ Claude CLI」按鈕
# 3. 預期:終端進入 Claude CLI 交互模式(無 ERR_UNKNOWN_FILE_EXTENSION、無 ENOENT)
# 4. 輸入 /exit 或 Ctrl+C 離開,確認 shell 回到 BAT 終端
```

**若 Worker dev 環境啟動 BAT app 有困難**,可降級為:
- unit test 確認 `WorkspaceView.startClaudeCliPty` 組出的命令字串**不**含 `'node '` 前綴
- grep 驗證三處修改位置皆已更新

### Unit test guard(仿 T0221 `fs.existsSync` 風格)

**現有測試**(T0221 遺產):`tests/claude-code-path.test.ts`
- 修改 POSIX assertion 為 `claude.exe`(BUG-052 同步)

**新增測試**(可選,視 Worker 時間):
- 驗證 `WorkspaceView.startClaudeCliPty` 或其 helper 組出的命令字串不含 `'node '` prefix
- Unit test 可用 mock `window.electronAPI.pty.write` 攔截命令字串

### Packaged smoke(使用者親驗 — 斷點 A)

```bash
npm run build:dir
# 啟動 release/win-unpacked/BetterAgentTerminal.exe

# 驗證:
# 1. ✅ Claude SDK Integrated Agent(Opus/Sonnet panel)→ 送「hi」→ 正常回應(延續 BUG-047)
# 2. ✅ 「+ Claude CLI」按鈕 → 終端進入 Claude CLI 交互模式(BUG-051)
# 3. ✅ debug.log 不含 "ERR_UNKNOWN_FILE_EXTENSION" / "Unknown file extension"
# 4. ✅ debug.log 不含 "[ClaudeAgent] resolveClaudeCodePath returned invalid path"
```

## 派發約定(YOLO + 斷點 A)

- **Mode**:`--mode yolo --no-interactive`
- **Worker 完成 code + dev smoke(或 unit test 降級)後必回「部分完成」觸發斷點 A**
  - 理由:Packaged smoke 需使用者實機操作,code-only 工單不能判 DONE
  - 對齊 T0221 YOLO 回報策略(D067)
- **使用者實機驗證後**塔台收尾:T0223 PARTIAL → DONE、BUG-051 FIXING → CLOSED、BUG-052 FIXING → CLOSED

## 不在本工單範圍

- ❌ macOS/Linux packaged smoke(無平台使用者,等自然樣本)
- ❌ 重構 `getCliPath` 為跨平台 helper(YAGNI,目前 consumer 單一)
- ❌ agent-registry launch builder 改動(T0222 確認該處對 claude-cli 顯式讓開,不在範圍)

## 互動紀錄

無(YOLO + `--no-interactive` 模式,完全按工單指令執行)。

## 產出摘要

### 修改的檔案(4 個 code/test)

| 檔案 | 行號 | 變更 |
|------|-----|------|
| `src/components/WorkspaceView.tsx` | 684 | 移除 `'node'` prefix,`cmdParts` 直接以 cliPath 開頭(BUG-051) |
| `electron/claude-agent-manager.ts` | 87 | `binaryName` 統一為 `'claude.exe'`,拿掉 `process.platform` 分支(BUG-052) |
| `electron/main.ts` | 1882 | 同上(BUG-052 同 pattern) |
| `tests/claude-code-path.test.ts` | 38,70 | POSIX assertion 改為 `'claude.exe'`;測試命名亦更新(BUG-052) |

### 驗證結果

- ✅ `npx tsx tests/claude-code-path.test.ts` — **4 passed, 0 failed**
- ✅ `npx vite build` — 全部 4 個 bundle 成功(main / renderer / preload / terminal-server)
- ✅ Grep 驗證 3 處 code 修改行內容:
  - `WorkspaceView.tsx:684` → `const cmdParts = [\`"${cliPath}"\`]`(無 `'node'`)
  - `claude-agent-manager.ts:87` → `const binaryName = 'claude.exe'`(無三元)
  - `main.ts:1882` → 同上
- ⏸️ Dev smoke(`npm run dev` + 「+ Claude CLI」按鈕互動測試)未跑,按工單降級條款以 unit test + grep 替代

### Commit

- Hash:見「回報時間」段(反序寫入後填入)
- 訊息:`fix(claude-cli): use native binary directly and unify binary name across platforms`
- 範圍:僅本工單 4 個 code/test 檔 + 工單本身 meta + 新建 BUG-051/BUG-052 工單檔(_bug-tracker / _tower-state / 前工單殘留交給塔台收尾)

## 遭遇問題

無。T0222 研究結論提供精確 line-level 指令,四處修改一次到位。

## 回報時間

2026-04-19 23:45 (UTC+8)

**狀態說明**:依 T0223 派發約定「Worker 完成 code + dev smoke(或 unit test 降級)後必回『部分完成』觸發斷點 A」,回報 PARTIAL。Packaged smoke(`npm run build:dir` + 實機 BAT app 啟動 + 「+ Claude CLI」按鈕驗證)由使用者親驗後塔台收尾 DONE、BUG-051 CLOSED、BUG-052 CLOSED。
