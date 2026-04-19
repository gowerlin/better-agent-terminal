# BUG-052 — `resolveClaudeCodePath` / `claude:get-cli-path` 平台命名假設錯誤(POSIX 也叫 `claude.exe`)

## 元資料

- **編號**:BUG-052
- **狀態**:🚫 CLOSED(**雙人皆驗 Windows 面**:2026-04-19 Gower packaged smoke pass + 2026-04-20 Rico v0.2.4-pre.1 回報驗證正確;macOS/Linux 樣本等自然;T0223 `42b45b0` 修復生效)
- **嚴重度**:🟡 Medium(code inspection 證據明確,但無實機樣本 — macOS/Linux 使用者尚未驗過)
- **建立時間**:2026-04-19 23:35 (UTC+8)
- **發現來源**:T0222 Worker A 面盤點 + B 面 install.cjs 實證(follow-up 建議)
- **關聯**:
  - BUG-047(CLOSED) — T0221 修復不完整,本 BUG 為 T0221 範圍內未發現的第二層 bug
  - BUG-051(OPEN) — 同族(對 CLI binary 的錯誤假設),合併在 T0223 修
  - T0221 / T0222(DONE)
- **可重現**:code inspection 100%,實機樣本 0(待有 macOS/Linux 使用者驗)
- **workaround**:無(一旦 macOS/Linux 使用者啟動 packaged BAT,Claude SDK 會拋同 BUG-047 的「binary not found」錯誤)

## 現象

T0221 修復時,`resolveClaudeCodePath()`(`claude-agent-manager.ts`)和 `claude:get-cli-path` handler(`main.ts:1882`)用平台條件式命名 binary:

```ts
const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
```

然後拼成 `bin/<binaryName>` 路徑。

**實際情況**(T0222 Worker B 面 install.cjs 實證):

```js
// @anthropic-ai/claude-code/install.cjs:174-178
// Always write to bin/claude.exe — the package.json bin field points here.
// The .exe extension + no-shebang stub makes npm's cmd-shim emit a direct
// exec on Windows; Unix ignores the extension. Same pattern as Bun's npm package.
const dest = path.join(__dirname, 'bin', 'claude.exe')
```

**關鍵**:
- `@anthropic-ai/claude-code` 設計上 binary 檔名**永遠**叫 `bin/claude.exe`(不論 Windows/macOS/Linux)
- POSIX 系統由 `chmodSync(dest, 0o755)` 賦執行權限
- Unix 執行時忽略 `.exe` 副檔名(POSIX exec 不看副檔名)
- 此為仿 Bun 套件的 native binary 跨平台發佈模式

**影響**:
- Windows:路徑拼出 `bin/claude.exe` ✅ 檔案存在 → BUG-047 表象已修
- macOS/Linux:路徑拼出 `bin/claude` ❌ 檔案**不存在**(實際是 `bin/claude.exe`)
- → macOS/Linux packaged 啟動 Claude SDK 會走到 `assertClaudeCodePathOnce()` warn-only log 但 path 無效,SDK 拿到不存在的路徑再拋 `binary not found`(同 BUG-047 症狀重現於非 Windows 平台)

## 範圍(已確認)

3 處需修(T0222 Worker 盤點):

1. **`electron/claude-agent-manager.ts`** — `resolveClaudeCodePath()` 內的 `binaryName` 條件式
2. **`electron/main.ts:1882`** — `claude:get-cli-path` handler 同 pattern
3. **`tests/claude-code-path.test.ts:38,70`** — T0221 新增測試的 POSIX assertion 也寫成 `claude`,需同步改

## 證據

### T0222 Worker 盤點表(摘錄)

| 檔案:行號 | 角色 | 跨平台處理 | BUG-052 命中? |
|-----------|------|-----------|---------------|
| `electron/main.ts:1881-1900` | IPC handler | `platform === 'win32' ? 'claude.exe' : 'claude'` | ✅ |
| `electron/claude-agent-manager.ts` | SDK path resolver | 同 pattern | ✅ |
| `tests/claude-code-path.test.ts:38,70` | T0221 測試 | 斷言 POSIX 檔名為 `claude` | ✅ |

### T0222 B 面實證

```bash
$ ./node_modules/@anthropic-ai/claude-code/bin/claude.exe --version
2.1.113 (Claude Code)
```

→ 實證 `.exe` 檔名跨 Windows/POSIX 通用(install.cjs 行為證實)。

## 處理方向

**合併到 T0223 修**(與 BUG-051 同工單,root cause 同族):
- 修改點 ~2 行 code(main.ts + claude-agent-manager.ts)+ 2 行 test
- `binaryName` 條件式移除,統一為 `'claude.exe'`
- Test assertion 同步改
- Dev smoke:`npm run dev` + Claude SDK panel(Opus/Sonnet)→ 預期正常回應
- Packaged smoke:使用者親驗(斷點 A)
- macOS/Linux smoke:暫不強制(無平台),T0223 結束後若使用者授權,可請 Rico 或其他使用者協助(或交付後等自然樣本)

## 備註

- **BUG-052 vs BUG-047 翻案?不算**:BUG-047 的 Windows 樣本已 CLOSED(T0221 smoke pass),此為 T0221 **預防性發現**的第二層 bug(非 Windows 平台才會觸發)
- **為何 T0221 當時沒發現?**:T0220 研究工單聚焦「Windows packaged 路徑失敗根因」,T0221 只驗 Windows smoke,`binaryName` 條件式看起來「寫了 fallback 所以很周到」,沒人實證 `@anthropic-ai/claude-code` 的實際檔名策略 → GP054「三重證據」適用(code 看到條件式 ≠ 驗證條件式正確)
- **嚴重度為 Medium 而非 High**:無實機樣本,且本專案主要使用者都在 Windows(Rico + Gower)。若將來 macOS/Linux 使用者回報,再升級
