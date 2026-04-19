# BUG-051 — claude-cli preset 終端以 `node <path-to-claude.exe>` 啟動,Node.js v25 拋 `ERR_UNKNOWN_FILE_EXTENSION`

## 元資料

- **編號**:BUG-051
- **狀態**:🚫 CLOSED(2026-04-19 23:56 Gower packaged smoke pass,T0223 `42b45b0` 修復生效)
- **嚴重度**:🟠 High(packaged 環境 claude-cli preset 按鈕完全無法用,100% 阻擋)
- **建立時間**:2026-04-19 23:24 (UTC+8)
- **發現來源**:第十六 session 起手,BUG-047 驗收通過後使用者補報
- **關聯**:
  - BUG-047(CLOSED)— T0221 修復把 `getCliPath()` 回傳從 `cli.js` 改為 `bin/claude(.exe)` native binary,consumer 端未跟著調整
  - T0221(DONE) — SDK 側 resolve path 修復主體
  - `@anthropic-ai/claude-code` v2.1.113 — 只 ship `bin/claude(.exe)` native binary,無 `cli.js`
- **可重現**:使用者回報,packaged 環境開 claude-cli preset 終端 100% 複現
- **workaround**:使用者可改用 Claude SDK Integrated Agent(Opus/Sonnet panel),繞開 claude-cli preset

## 現象

**Packaged 環境**(使用者截圖,v0.0.16-pre.1 Installer):

```
$ node "C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@anthropic-ai\claude-code\bin\claude.exe" --continue --dangerously-skip-permissions --enable-auto-mode

node:internal/modules/esm/get_format:236
  throw new ERR_UNKNOWN_FILE_EXTENSION(ext, filepath);
        ^
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".exe" for
C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@anthropic-ai\claude-code\bin\claude.exe
  code: 'ERR_UNKNOWN_FILE_EXTENSION'

Node.js v25.9.0
```

**預期**:claude-cli preset 終端啟動後,直接進入 Claude CLI 交互模式(同獨立安裝的 `claude` 命令)。

**實際**:Node.js v25 試圖把 `.exe` 當 ESM 載入,立即 crash,終端回到 shell prompt。

## 根因定位(塔台初步診斷,待 Worker 驗證)

**命中位置**:`src/components/WorkspaceView.tsx:684`

```ts
const cmdParts = ['node', `"${cliPath}"`]  // ❌ 無條件 prefix `node`
```

**問題鏈**:
1. T0221 修復把 `getCliPath()` 回傳從 `cli.js`(Node.js script)改為 `bin/claude(.exe)`(native binary)
2. `WorkspaceView.startClaudeCliPty()` 仍假設「CLI 是 JS script」,所有平台無條件 prefix `node`
3. Windows:`node claude.exe` → Node.js v25 因 `.exe` 副檔名拋 `ERR_UNKNOWN_FILE_EXTENSION`
4. POSIX:`node bin/claude` — **尚未驗證**(研究工單需確認 dev/packaged 環境是否同樣壞 or 偶然可用)

## 範圍(待 T0222 研究確認)

- **已確認受影響**:Windows packaged,claude-cli preset 終端啟動按鈕
- **未確認**:
  - macOS/Linux packaged 是否同樣失敗(`bin/claude` POSIX 可能有 shebang,直接 exec 可用,但 prefix `node` 行為未知)
  - Dev server 環境(`npm run dev`)是否複現(Windows Git Bash + POSIX 皆需驗)
  - `claude-cli-worktree` preset 同受影響(共用 `startClaudeCliPty`)
  - 其他 consumer 是否也假設「CLI 是 JS script」(grep `getCliPath`、`cliPath`、`claude:get-cli-path` 所有呼叫點)

## 處理方向

派 **T0222 研究工單**(`--mode on --interactive`),Q2.C 深查所有 consumer 假設,交付:
- 所有 consumer 盤點 + 修復方案(min-diff vs 擴大 refactor)
- Dev server 相容驗收策略(Windows/POSIX × dev/packaged 4 象限)
- 跨平台驗收腳本(shellcheck + Windows PowerShell 皆可執行)

研究結論收斂後派 **T0223 修復工單**(`--mode yolo --no-interactive` + 斷點 A)。

## 備註

- 此 BUG 與 BUG-047 近親但**不算翻案**:BUG-047 原問題(SDK 端 resolve 失敗)已由 T0221 修復,此為修復的 downstream consumer bug
- 使用者特別指出「還是要考慮相容開發 dev server 執行」→ T0222 必須涵蓋 dev 環境驗證(不只 packaged)
