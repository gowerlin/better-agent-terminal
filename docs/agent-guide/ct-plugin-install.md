# CT plugin 安裝：Codex 派工字串與面板支援（T0710）

> CLAUDE.md「CT plugin 安裝（T0710）」節的完整說明。CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結。來源：BMad-Guide 塔台 HANDOVER `_handover-2026-10-30-bat-ct-plugin-install-detection.md`（§ 2 實測表、§ 3、§ 6 隔離試裝）。

## 用途

CT 5.14.0 起除了 zip 手動安裝，另提供 plugin（`ct@<marketplace>`，官方 marketplace 是 `control-tower`）。使用者可能只裝 zip、只裝 plugin，或兩種都裝。

| | 只裝 zip | 只裝 plugin | 兩種都裝 |
|---|---|---|---|
| Claude `/ct-exec` | ✅ | ✅ | ✅（用手動那份） |
| Codex `$ct-exec` | ✅ | ❌ 不注入 SKILL.md，**也不報錯** | ✅（用手動那份） |
| Codex `$ct:ct-exec` | ❌ | ✅ | ✅（用 plugin 那份） |

T0710 前 BAT 的 Codex 派工一律送 `$ct-exec`，只裝 plugin 時 Worker 拿不到 skill、靜默照沒有 skill 的方式做。T0710 起：

- **3-1** Codex 派工字串依該主機的安裝方式送 `$ct-exec` 或 `$ct:ct-exec`（helper 派工與面板一鍵派工）
- **3-2** ct-config「預設值」層在沒有手動安裝時讀 plugin 的 `tower-config.md`
- **3-3** Claude 面板的 skill 清單與 `*` 補全列出 `ct@*` plugin 的 skill
- Claude 端字串不變（`/ct-exec`）；`bat-terminal.mjs --skill` 白名單與 CT 的派工命令不變

## 必守規則

- 🔴 判斷只在 `electron/ct-install-detect.ts`；helper 派工、面板一鍵派工、ct-config、skill 掃描都呼叫它，不得在 consumer 內聯路徑規則。
- 🔴 Codex skill 名稱判斷順序（handover § 3-1，與 Codex 自己的解析一致，不得更改）：
  1. `<CODEX_HOME>/skills/<skill>/SKILL.md` 或 `<home>/.agents/skills/<skill>/SKILL.md` 存在 → `$<skill>`（手動安裝；兩種都裝時 Codex 也用這份）
  2. 否則 `<CODEX_HOME>/config.toml` 有 `[plugins."ct@<任一 marketplace>"]` 且該表 `enabled = true` → `$ct:<skill>`
  3. 其他（沒有 config.toml、讀不到、太大、解析失敗、沒有 `enabled` 行、`enabled = false`、主機沒有判斷函式、舊 bat-server、判斷丟例外）→ `$<skill>`（T0710 前的行為）
- 🔴 plugin 名稱 `ct` 寫死（CT `version-governance.md` § plugin 安裝／升級），marketplace 不寫死。
- 🔴 `CODEX_HOME` 用新分頁實際拿到的 env：分頁的 `customEnv`（helper 派工的 `customEnv`、面板的全域 + 工作區環境變數）有 `CODEX_HOME` 鍵就用它（空字串 = 未設），否則 host 的 `process.env.CODEX_HOME`，都沒有才 `<home>/.codex`。不得寫死 `~/.codex`。
- 🔴 不新增執行期依賴（TOML / semver 都自己寫最小解析）；新增依賴要塔台決策且牽動 `build.files` 白名單。
- 🔴 判斷函式不丟例外、不讓派工失敗；日誌只記名稱與原因，不記 config.toml 內容。
- 🔴 `$ct:ct-exec` 在 PowerShell 與 bash 雙引號內會被展開（`$ct` 是變數）：派工命令一律經 `quoteArgForShell`（pwsh / posix 單引號、cmd 雙引號，cmd 不展開 `$`）。

## 唯一實作位置

| 項目 | 位置 |
|---|---|
| Codex skill 名稱判斷 | `resolveCodexSkillName` / `createCodexSkillNameResolver`（`electron/ct-install-detect.ts`） |
| config.toml 子集解析 | `findCodexCtPlugin`（同檔） |
| plugin 位置（Claude / Codex） | `findClaudeCtPlugins` / `findCodexCtPlugins` / `ctPluginTowerConfigCandidates` / `claudeCtPluginSkillDirs`（同檔） |
| 版本比較 | `compareCtPluginVersions`（同檔） |
| helper 派工 | `createAgentPromptCommandBuilder` 的 `codexSkillName` dep（`electron/terminal-command-handlers.ts`）；main（`electron/main.ts`）與 headless（`createHeadlessTerminalModule`，`electron/remote/headless-entry.ts`）各自以本機 home + `process.env` 建立 |
| 面板一鍵派工 | channel `terminal:control-tower-prompt`（`registerTerminalCommandHandlers`，本機與 headless 共用）；renderer `resolveControlTowerWorkOrderCommand`（`src/utils/control-tower-launch.ts`），呼叫點 `src/App.tsx`、`src/components/WorkspaceView.tsx` |
| 3-2 ct-config 預設值層 | `readCtConfigSources` / `readDefaults`（`electron/handlers/ct-config.ts`） |
| 3-3 skill 掃描 | `claude:scan-skills` / `claude:scan-star-commands`（`electron/handlers/claude.ts`） |
| IPC 型別 | `src/types/ct-dispatch-prompt.ts`、`src/types/electron.d.ts`（`ctDispatch.resolvePrompt`） |

## 3-1 Codex 派工字串

### helper 派工（`bat-terminal.mjs --skill ct-exec --workorder T####`）

`createAgentPromptCommandBuilder` 在 agent 是 codex（`codex-cli` / `codex-agent` / `codex-agent-worktree`）時：

- skill 模式（`--skill` + `--workorder`）：`$<名稱> <工單>`，名稱來自 `codexSkillName(skill, customEnv)`。
- prompt 模式：`/ct-<skill> …` 或 `/ct:ct-<skill> …` 開頭的 prompt，skill token 換成同一判斷的 `$<名稱>`，其餘照原樣（`normalizeControlTowerPromptForAgent`）。其他 prompt 不動、不判斷。
- claude：`/ct-exec <工單>`，不呼叫判斷。
- `BuiltAgentCommand.codexSkillName` 帶 `{ name, reason, marketplace? }`；`terminal:create-agent-command` 記：

```
[agent-command] codex skill id=<terminal id> name=$ct:ct-exec reason=plugin
```

bat-scripts.log 另有 `codex-skill-name` 事件（`terminalId` / `name` / `reason`）。

`reason` 值：`manual`、`plugin`、`fallback-no-config`、`fallback-read-error`、`fallback-too-large`、`fallback-parse-error`、`fallback-no-plugin`、`fallback-plugin-disabled`、`fallback-no-enabled-line`、`fallback-unsupported`（主機沒有判斷函式）、`fallback-error`（判斷丟例外，另記 warn）、`fallback-invalid-skill`。

### 面板一鍵派工（塔台面板「執行」/「補結」）

renderer 不能讀檔，經 proxied channel `terminal:control-tower-prompt` 由視窗綁定的主機判斷：

- 參數 `{ agent, skill, workorder, customEnv? }`（`agent` = 工作區生效 agent 的 preset，renderer 送 `codex-cli`；`skill` = `ct-exec` / `ct-done`；`workorder` 必須符合 `WORKORDER_ID_PATTERN`）。
- 回傳 `{ ok: true, prompt, quotedPrompt, shellFamily, skillName? }` 或 `{ ok: false, error }`。`quotedPrompt` 是依 `terminal:create-with-command` 不帶 `shell` 時會啟動的 shell（`resolveDispatchShell`，與 BUG-151 / T0598 同一套）加好引號的字串。
- renderer 命令：`codex <quotedPrompt> <自訂參數>`。
- Claude：renderer 不呼叫 channel，命令與 T0710 前完全相同（`claude "/ct-exec T####"`）。
- 遠端工作區：在 bat-server 判斷（bat-server 的 home 與 env）；T0710 前的 bat-server 沒有 handler → `No handler for channel` → renderer 回到 T0710 前的命令 `codex "$ct-<action> T####"`。
- 日誌：主機 `[agent-command] panel codex skill name=… reason=… shell family=… from=…`；renderer `[ct-launch] …`（`debug.log`）。

> 行為變化：T0710 前面板的 Codex 命令是 `codex "$ct-exec T####"`，在 pwsh 與 bash 雙引號內 `$ct` 被當成變數，codex 實際收到 `-exec T####`。T0710 起走主機加引號，pwsh / bash 都是字面值。舊 bat-server 的 fallback 保留舊命令（不知道遠端 shell，cmd 不能用單引號）。

### config.toml 子集

只辨識：

- 表頭 `[plugins."ct@<mkt>"]`（也接受單引號 key 與空白、行尾 `#` 註解）
- 該表內的 `enabled = true|false`

規則：

- 其他表頭結束目前的表；`[[…]]` 不是 ct 表。
- `"""` / `'''` 多行字串內的內容跳過（不會被當成表頭）。
- 同一個 `ct@<mkt>` 表出現兩次、或 `enabled` 不是 `true` / `false` → `parse-error`。
- 多個 `ct@<mkt>` 表任一 `enabled = true` → plugin。
- 點號 key（`plugins."ct@m".enabled = true`）、inline table（`"ct@m" = { enabled = true }`）不認得 → 視為沒有 plugin（`$<skill>`）。codex 自己寫的是表頭形式。
- 檔案上限 `MAX_CT_DETECT_FILE_BYTES` = 1 MiB，超過不讀。

## 3-2 ct-config 預設值層

`ct:read-config-sources` 的 `defaults` 層：

1. 手動安裝（照舊，實際生效的是它）：`~/.claude/skills/control-tower/references/tower-config.md` → `~/.codex/skills/…`（T0710 加：`CODEX_HOME` 設在別處時再加 `<CODEX_HOME>/skills/…`）
2. 都沒有才找 plugin（`ctPluginTowerConfigCandidates`，只取有這個檔的版本）：
   - Claude：`<CLAUDE_CONFIG_DIR 或 ~/.claude>/plugins/installed_plugins.json` 中 `ct@*` 的 `installPath`；沒有 `installPath` 時 `<CLAUDE_CODE_PLUGIN_CACHE_DIR 或 <config>/plugins>/cache/<mkt>/ct/<version>`。只取 `user` / `managed` scope（ct-config 沒有 cwd，`project` / `local` scope 不算）；使用者 `settings.json` 的 `enabledPlugins["ct@…"] === false` 跳過。
   - Codex：`<CODEX_HOME>/plugins/cache/*/ct/*/skills/control-tower/references/tower-config.md`
   - 順序：Claude plugin → Codex plugin，各自新版在前。
3. 都沒有 → `missing`，`tried` 照舊只列手動安裝的位置。

來源辨識：總覽顯示的路徑含 `plugins/cache/<marketplace>/ct/<version>`，看得出是 plugin（沒有另加 UI 文字）。

遠端：照 T0701，在回答主機（bat-server）用它的 home 與 `process.env` 判斷。

### 版本比較（`compareCtPluginVersions`）

- 點分數字逐段比（`5.10.0` > `5.9.0`，缺的段當 0）；開頭的 `v` 忽略。
- pre-release 低於同號正式版（`5.14.0-pre.1` < `5.14.0`）；pre-release 逐段比，數字段比數值（`pre.10` > `pre.2`）、數字段低於文字段、較短的低於較長的。
- `+build` 忽略。
- 不是版本的字串排在所有版本之後，彼此依字串比。

## 3-3 skill 面板與 `*` 補全

`claude:scan-skills`、`claude:scan-star-commands` 在手動目錄（`<cwd>|~/{.claude,.copilot,.agents}/skills`）之後掃 Claude `ct@*` plugin 的 `<installPath>/skills`（`claudeCtPluginSkillDirs`，新版在前）：

- 只加 `ct@*`，不擴及其他 plugin（`ct-guide@…` 也不加）。
- 同名只列一次，以先掃到的手動那份為準（Claude 實際行為相同）。
- `scan-skills` 的 `project` / `local` scope plugin 只在 `projectPath` = 面板 cwd 時加；scope 一律標 `global`（UI 沒有顯示 scope，沒加來源標示）。
- `*` 補全照舊只收 `ct-*` / `gsd-*` 目錄名。
- 只看 Claude 的 plugin（面板對象是 Claude），不看 Codex 的 plugin cache。

## 已知限制

- Codex plugin 是否啟用只看 `config.toml` 表頭形式；點號 key / inline table 寫法 → `$<skill>`（③，保守）。
- Codex 3-2 不看 `config.toml` 的 `enabled`（停用的 plugin 的 `tower-config.md` 仍可能被當預設值顯示；手動安裝存在時不影響）。
- Claude plugin 的啟用只看使用者 `settings.json` 的 `enabledPlugins`，不看專案 / managed 設定。
- 判斷是派工當下讀檔（不快取）；每次派工最多幾次 `stat` 與一次 ≤ 1 MiB 的讀檔。
- 手動安裝缺某個 skill 但 plugin 有（例如只手動裝了 `ct-exec`）時，該 skill 走 plugin（`$ct:ct-done`），與 Codex 自己的解析一致。
- 3-4（兩種都裝時提示）未實作，評估見 T0710 回報區。

## 驗證清單

- 單元測試：
  - `electron/__tests__/ct-install-detect.test.ts`：§ 6-2 三情境、`enabled = false`、無 config、壞 toml、無 `enabled` 行、大小上限、`~/.agents/skills`、`CODEX_HOME` / customEnv 優先、版本比較、Claude / Codex plugin 位置
  - `electron/__tests__/ct-plugin-dispatch-prefix.test.ts`：helper 派工、raw prompt、無判斷函式 / 丟例外 fallback、customEnv 經 handler、面板 channel 三種 shell 引號；有真 shell 時以 pwsh / cmd / bash 實跑確認收到字面值 `$ct:ct-exec T0710`
  - `electron/__tests__/ct-config-sources.test.ts`：只 plugin、多版本取最新、手動優先、Codex plugin 用 `CODEX_HOME`
  - `electron/__tests__/claude-scan-skills-ct-plugin.test.ts`：只 plugin、同名去重、其他 plugin 不列
  - `src/utils/__tests__/control-tower-launch.test.ts`：Claude 不變、Codex 用主機引號、舊 bat-server fallback
  - `src/utils/__tests__/shell-quote.test.ts`：`$ct:ct-exec T0710` 三種 family
  - `electron/remote/__tests__/headless-parity.test.ts` / `path-aware-channels-coverage.test.ts`：新 channel 的分類
- 隔離試裝（handover § 6-1 / 6-2）：暫存 `CODEX_HOME` 跑 `codex plugin marketplace add` / `plugin add` / `plugin remove`，以 `codex debug prompt-input` 的 skill 清單（不呼叫模型）對照判斷函式結果；前後比對真實 `~/.codex/config.toml`、`~/.claude/plugins/*.json` 的 SHA-256。不做 § 6-3（要複製 auth.json、會呼叫模型）。
