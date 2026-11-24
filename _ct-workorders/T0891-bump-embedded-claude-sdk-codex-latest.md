---
schema_version: 1
schema_kind: workorder
id: T0891
title: "內嵌 Claude / Codex 追最新（在 `v0.8.x`）：@anthropic-ai/claude-code 2.1.316 → 2.1.331、@anthropic-ai/claude-agent-sdk 0.3.316 → 0.3.331、@openai/codex-sdk / @openai/codex 0.166.0 → 0.172.0，核對 BAT 整合點"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-25T00:30:23+08:00"
started_at: "2026-11-25T00:32:45+08:00"
updated_at: "2026-11-25T00:59:42+08:00"
completed_at: "2026-11-25T00:59:42+08:00"
target_version: "0.8.0-pre.2"
depends_on: []
related:
  - "D191（內嵌 claude / codex 追 latest，claude CLI 追 latest 不追 stable）；D307（產品改動在 `v0.8.x`）；D317（本單：使用者 2026-11-25 選「一張工單一起追」）"
  - "T0717（前次 claude CLI / codex 追版 2.1.306 → 2.1.316、0.163 → 0.166）、T0718（前次 Agent SDK 升 0.3.316）：步驟、lock 只動目標套件的移植做法、核對項目與證據格式照這兩張的回報區做（`_ct-workorders/T0717-*.md`、`T0718-*.md`）"
  - "CLAUDE.md「Claude Agent SDK / CLI」「Sub-agent / Active Tasks Tracking」「BAT MCP shim」「blocked 狀態偵測」「Worker 啟動確認」「用量限制自動繼續」「Claude 分頁的 session 名稱」「CT plugin 安裝」各節"
affects_files:
  - _ct-workorders/T0891-bump-embedded-claude-sdk-codex-latest.md
  - package.json
  - package-lock.json
  - CLAUDE.md
  - docs/agent-guide/
  - electron/claude-agent-manager.ts
  - electron/claude-resolver.ts
  - electron/codex-agent-manager.ts
  - electron/codex-bundled-path.ts
  - electron/__tests__/
  - src/lib/model-pricing.ts
  - src/lib/usage-limit.ts
  - src/lib/codex-terminal-state.ts
  - src/lib/__tests__/
  - src/types/index.ts
  - src/types/claude-agent.ts
  - scripts/verify-native-modules.js
  - scripts/verify-packaged-native.js
  - scripts/__tests__/
  - e2e/
renew_count: 0
session_ids:
  - "531ff50a-6329-4a18-93a0-d46bed090ed7"
isolation: worktree
workdir: worktree ct/T0891（塔台已預先從 `v0.8.x` 建立分支 `ct/T0891`，`bcb4bbe0`）
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0891` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `bcb4bbe0e2f300832bfa3bbfbfbebcc46f1f23a4`，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期，不是錯誤）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "✅ 本單授權修改 `package.json` 的 `@anthropic-ai/claude-code`、`@anthropic-ai/claude-agent-sdk`、`@openai/codex-sdk` 版本，以及對應 `package-lock.json`（含 `@anthropic-ai/claude-code-*`、`@anthropic-ai/claude-agent-sdk-*`、`@openai/codex`、`@openai/codex-*` 平台子套件）；其他相依**不得**連帶升版：lock diff 只能涉及這三個系列與 root `dependencies` 那三行，npm 產生的 `peer` 等旗標雜訊比照 T0717 / T0718 以移植方式去掉，回報區附 `git diff --stat package-lock.json` 與逐套件比對。Agent SDK 0.3.331 的 peer（`zod ^4.0.0`、`@anthropic-ai/sdk >=0.93.0`、`@modelcontextprotocol/sdk ^1.29.0`）在 `v0.8.x` 的 lock 已滿足（4.6.7 / 1.3.0 / 1.32.2），不需要動；若 npm 仍要求改動，先問塔台。`package.json` 的 `version` 欄位不動。"
  - "🔴 開工時再查一次 `npm view <套件> dist-tags` / `time`（三個系列）；取當下 **latest**（D191：claude 追 latest，不追 stable；塔台 2026-11-25 00:29 查到 claude-code latest 2.1.331 / stable 2.1.325、agent-sdk 0.3.331、codex / codex-sdk 0.172.0），若更高就用更高的並在回報區說明；codex SDK 與 codex 版本不一致時以 SDK 的 dependency 為準。"
  - "🔴 claude CLI 核對（官方 changelog 2.1.317 起各節、CLI 實際輸出、binary 字串；附證據）：① 模型清單 `BAT_BUILTIN_MODELS` / `supportedEffortLevels` / 計價（價格只能取自官方價目頁並附出處，查不到就不改；新增模型時同步 `MODEL_LIMITS` 與測試，point release 排在 base 之前）、服務端門檻與 `HEALTHY_MIN`；② update guard：`DISABLE_UPDATES` / `DISABLE_AUTOUPDATER` 仍有效；③ BAT 整合點：`--mcp-config=` / `--settings=` 的 hooks（`BAT_CLAUDE_HOOKS` 用到的事件，含 `SessionStart` payload 的 `session_id`、`at` 用的 hook 啟動行為）/ `--name` / `--resume=` / `disableAllHooks` / `allowManagedHooksOnly` / `autoContinueAtUsageLimit` / OSC 7501（`app=claude-code`、探詢 `ESC ] 7501 ; ?` 與 `PROGRAM_STATUS_PROBE_REPLY`，CLAUDE.md「blocked 狀態偵測」claude 段），以及 `src/lib/usage-limit.ts` 的句型仍出現在新 binary；④ binary 路徑與平台子套件結構不變（`resolveEmbeddedClaudePath` / `embeddedClaudeCandidates`、`verify-packaged-native.js` 的 JS 複本）；⑤ `CLAUDE_CONFIG_DIR` / `CLAUDE_CODE_PLUGIN_CACHE_DIR` 語意不變（`electron/claude-config-dir.ts`）。"
  - "🔴 Agent SDK 核對（官方 CHANGELOG `https://raw.githubusercontent.com/anthropics/claude-agent-sdk-typescript/main/CHANGELOG.md` 0.3.317 起到目標版的 Breaking 與行為變更，逐項判斷對 BAT 的影響）：`streamInput` 與 `command_lifecycle` 回執、`Query.cancelAsyncMessage`（不在 `sdk.d.ts`，經 `cancelSdkQueuedMessage`）、`msg_lifecycle_v1`、背景子代理（`task_started.is_backgrounded` / `task_updated` / `task_notification` / `async_launched`）、`options.env`（`sdkSpawnEnv`）、`close()` / abort、`system/init` 欄位（`lastQueryInit`）、`modelUsage` / `total_cost_usd` 累計語意（`turnModelUsage`）。CLAUDE.md 規定 SDK 升版必跑 `electron/__tests__/claude-send-during-turn.test.ts`。"
  - "🔴 codex 核對（官方 release notes / CHANGELOG 0.167 起各版、套件內容、binary 字串、上游原始碼；附證據）：① 原生 binary 的套件目錄結構仍符合 `codex-bundled-path.ts` / `codex-agent-manager.ts` 的解析（含 legacy 分支），`verify-native-modules.js` / `verify-packaged-native.js` 的 codex 檢查項同步核對；② SDK API（`codex-agent-manager.ts` 用到的 export 與選項）沒有破壞性變動；③ BAT 整合點：`-c mcp_servers.bat.*`（含 `env_vars`）、`--no-daemon`（`codexNoDaemonDecision`）、`tui/src/daemon_startup.rs` 的 `config_exclusion`、`-c check_for_update_on_startup=false`、OSC 7501 序列格式與 state 值（`src/lib/codex-terminal-state.ts`，T0717 補過 `done` / `error`）、`src/lib/usage-limit.ts` 的 codex 句型、`codex resume`（`codexResumeArgs`）、CT plugin skill 名稱 `$ct:ct-exec` 判斷所依賴的 `config.toml` `[plugins.\"ct@…\"]` 格式（`electron/ct-install-detect.ts`）仍成立。"
  - "🔴 任何核對項目有變動而會影響 BAT 時，先用 BAT 通道問塔台，不要自行改產品行為；純追加（新模型、新選項、新句型）照 CLAUDE.md 規則補即可，但若要改 `affects_files` 以外的檔也先問塔台。"
  - "🔴 測試、註解、docs 中寫死 `2.1.316` / `0.3.316` / `0.166.0` 的地方：區分「代表內嵌實裝版本」（更新）與「歷史實測紀錄 / 任意測試字串 / 版本門檻」（不動，例如 `>= 0.156.0`、`>= 0.163.0`、`>= 2.1.76`、`>= 2.1.280` 門檻），回報區逐一列出處置。CLAUDE.md 對應節與 docs 更新實裝版本與本單編號，歷史敘述保留；CLAUDE.md 不得超過 100k 字元目標（T0595）。"
  - "🔴 依賴：worktree 內 `npm ci`（之後 `npm install` 只為了改這三個系列；不改 `allowScripts`、不新增依賴）。"
  - "🔴 驗證：內嵌 `node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` = 新版、內嵌 codex 原生 binary `--version` = 新版、`node_modules/@anthropic-ai/claude-agent-sdk/package.json` version = 新版；`node scripts/verify-native-modules.js` exit 0；`npm run verify:helpers` exit 0；`npm run test:unit` 全綠（附 passed / files 數；`v0.8.x` 基線 T0888 8433 passed）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；e2e `e2e/t0592-codex-tower-worker.spec.ts` 與 `e2e/t0621-codex-osc-state.spec.ts`（需先 `npx vite build`，CLAUDE.md 規定 codex 升版必跑）綠。e2e 只用隔離實例；不得以預設實例（無 `--runtime`）啟動 source build；不碰使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn。`TMP` 指到長路徑 scratchpad 時 git worktree 測試會因 `'$GIT_DIR' too big` 失敗（T0716），跑測試時用系統預設 TMP。"
  - "🔴 程序清理（D308）：只結束本單啟動且可追溯到本單的程序；一次一個、不 `taskkill /T`、不以程序名稱或父 PID 大範圍結束。回報區寫明手動結束的 PID（只記 PID 與映像名稱）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`（不用 `-A` / `.`）；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），本單原則上不需要 gh。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`，scratchpad 路徑也一樣。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0891 — 內嵌 Claude CLI / Agent SDK / Codex 追最新（`v0.8.x`）

## 背景

- 使用者 2026-11-25 要求檢查內嵌 claude / codex SDK 是否需要更新；塔台 2026-11-25 00:29 `npm view`：

  | 套件 | 實裝（`v0.8.x` lock） | latest | 發佈時間 |
  |---|---|---|---|
  | `@anthropic-ai/claude-code` | 2.1.316（T0717） | **2.1.331**（stable 2.1.325） | 2026-11-23 |
  | `@anthropic-ai/claude-agent-sdk` | 0.3.316（T0718） | **0.3.331** | 2026-11-23 |
  | `@openai/codex-sdk` / `@openai/codex` | 0.166.0（T0717） | **0.172.0** | 2026-11-24 |

- 使用者選「一張工單一起追」（D317）：三個系列都改 `package-lock.json`，合在一張只改一次 lock。
- 產品改動在 `v0.8.x`（D307），本單隨 `0.8.0-pre.2` 發佈；塔台收單後以 fast-forward 合併 `ct/T0891` 進 `v0.8.x`。

## 實作

照 T0717 / T0718「實作」的做法：

1. 開工時再查 latest（`memory_overrides` 第 3 條）；確認 merge-base（第 1 條）；worktree `npm ci`。
2. `package.json` 改三個系列為 `^<新版>`；更新 lock；lock diff 只含這三個系列（第 2 條）。
3. 內嵌 claude / codex binary `--version`、SDK 版本、`verify-native-modules`。
4. 核對新版變化（第 4、5、6 條），有影響 BAT 的變動先問塔台（第 7 條）。
5. 寫死舊版號的測試 / 註解 / docs 逐一處置（第 8 條）。
6. CLAUDE.md「Claude Agent SDK / CLI」節與 docs 更新內嵌實裝版本（歷史敘述保留）；BAT MCP shim 節的「內嵌 `@openai/codex-sdk` / `@openai/codex` 目前 `0.166.0`」同步。
7. 驗證（第 10 條），commit 在 `ct/T0891`。

## 驗收

- [x] 內嵌 `claude.exe --version`、codex `--version`、Agent SDK 版本 = 新版；`verify-native-modules` ✅
- [x] lock diff 只涉及 claude-code、claude-agent-sdk、codex 三個系列（附 diff 摘要與逐套件比對）
- [x] `npm run test:unit`、`npm run test:legacy` 全綠（含 `claude-send-during-turn.test.ts`）；`npx vite build` exit 0；兩個 typecheck = 0；`verify:helpers` ✅
- [x] e2e t0592 / t0621 綠
- [x] claude CLI、Agent SDK、codex 各核對項目的結果，有改或無改都附證據
- [x] 回報區列出需實機驗證的項目（mac / Linux 內嵌 binary 由 CI 的 `verify-packaged-native` 確認；Claude / Codex 面板實際對話需真人）
- [x] 隔離分支證據（branch / base_sha / validated_sha / head_sha）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
**DONE**：內嵌 `@anthropic-ai/claude-code` 2.1.316 → **2.1.331**、`@anthropic-ai/claude-agent-sdk` 0.3.316 → **0.3.331**、`@openai/codex-sdk` / `@openai/codex` 0.166.0 → **0.172.0**（含全部平台子套件）。核對到三項純追加並依 `memory_overrides` 第 7 條直接補上（沒有需要問塔台的行為變更）：Claude Fable 5.2 模型、claude 2.1.326 的 `team's pooled group budget` 句型、codex 0.172.0 的 API spend limit 句型。驗收 7 項全部 PASS；t0592 有一個情境間歇失敗（見〈遭遇問題〉1），最後連續 3 次整份通過。
- **session_id**：531ff50a-6329-4a18-93a0-d46bed090ed7
- **Landing Zone**：PASS
  - C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`，相同 ✅（worktree：`CT_HOME` 已設，`CT_WORKTREE_BRANCH` = `ct/T0891`）
  - C-1：PASS（工單在 `$CT_HOME/_ct-workorders/`）
  - C-3：PASS（前 5 筆非萬用字元 `affects_files` 在 worktree 都存在）
  - C-2：工單沒有 `branch` 欄位；HEAD = `ct/T0891`
  - `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只當證據）
  - merge-base 檢查：`git merge-base HEAD v0.8.x` = `bcb4bbe0e2f300832bfa3bbfbfbebcc46f1f23a4` ✅（`CT_WORKTREE_BASE` = `06c3b884…`，與 main 的共同祖先，屬預期）
- **派發模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；BAT / CT 變數名稱在 Git Bash 與 PowerShell 都看得到。
- **環境**：Node v26.13.1、npm 12.2.3；`TMP` = 系統預設 `<使用者資料夾>\AppData\Local\Temp`。

### 產出摘要

#### 版本與 lock
- 開工時查 dist-tags（2026-11-25 00:32）：claude-code `{ stable: 2.1.325, next: 2.1.331, latest: 2.1.331 }` → 依 D191 取 latest **2.1.331**；agent-sdk `latest` / `next` = **0.3.331**；codex-sdk / codex `latest` = **0.172.0**，`npm view @openai/codex-sdk@0.172.0 dependencies` = `{ "@openai/codex": "0.172.0" }`（一致）。與塔台查到的相同，沒有更高版本。
- worktree `npm ci`（exit 0，只有預期的 `electron-winstaller` 未放行警告）→ `npm install "@anthropic-ai/claude-code@^2.1.331" "@anthropic-ai/claude-agent-sdk@^0.3.331" "@openai/codex-sdk@^0.172.0"`（exit 0）。`package.json` 只改這三行，`version` 沒動；`allowScripts` 沒動、沒有新增依賴。
- **lock 不需要移植**：npm 12.2.3 這次沒有產生 `peer` 旗標雜訊。`git diff --stat package-lock.json` = `1 file changed, 104 insertions(+), 104 deletions(-)`。
- **逐套件比對**（scratchpad `lockcmp.mjs`，HEAD 對新 lock）：`REAL 27  META-ONLY 0  OUTSIDE-TARGET 0`
  - `(root) dependencies`：`@anthropic-ai/claude-agent-sdk ^0.3.316 -> ^0.3.331`、`@anthropic-ai/claude-code ^2.1.316 -> ^2.1.331`、`@openai/codex-sdk ^0.166.0 -> ^0.172.0`
  - `@anthropic-ai/claude-agent-sdk` 與 8 個 `-<platform>`（darwin-arm64 / darwin-x64 / linux-arm64 / linux-arm64-musl / linux-x64 / linux-x64-musl / win32-arm64 / win32-x64）：version / resolved / integrity（主套件另有 optionalDependencies 版號）
  - `@anthropic-ai/claude-code` 與 8 個 `-<platform>`：同上
  - `@openai/codex-sdk`（version / resolved / integrity / dependencies）、`@openai/codex`（同上＋optionalDependencies）、6 個 `@openai/codex-<platform>`（`0.166.0-<p>` → `0.172.0-<p>`）
  - 三個系列的 optionalDependencies 鍵集合與升版前相同（子套件沒有新增或移除）；peer（`@anthropic-ai/sdk` 1.3.0、`zod` 4.6.7、`@modelcontextprotocol/sdk` 1.32.2）不變。

#### 內嵌版本與 verify
- `node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` = `2.1.331 (Claude Code)`
- `node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe --version` = `codex-cli 0.172.0`
- `@anthropic-ai/claude-agent-sdk` / `-win32-x64` = `0.3.331`；`@openai/codex-sdk` / `@openai/codex` = `0.172.0`
- `node scripts/verify-native-modules.js` exit 0（`All 2 required native modules present … embedded claude: native, stdio-inheritance addon: …`）。全新 worktree 第一次跑時因 `native/win-stdio-inherit` 還沒建而 exit 1（T0866 的建置步驟），照 CLAUDE.md 跑 `npm run build:native-win`（exit 0，產物在 `.gitignore` 的 `build/`）後通過。

#### 核對結果
證據來源（都是 2026-11-25 取得）：
- ① claude 官方 changelog `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md` 2.1.317 – 2.1.331 共 13 節（changelog 沒有 2.1.320 / 2.1.324 節）
- ② Agent SDK 官方 CHANGELOG `https://raw.githubusercontent.com/anthropics/claude-agent-sdk-typescript/main/CHANGELOG.md` 0.3.317 – 0.3.331（全讀）
- ③ 官方價目頁 `https://platform.claude.com/docs/en/about-claude/pricing.md`、模型總覽 `https://platform.claude.com/docs/en/about-claude/models/overview.md`
- ④ binary 字串比對：升版前備份的 claude 2.1.316（335,469,216 bytes）對 2.1.331（405,798,560 bytes）、codex 0.166.0（371,735,856 bytes）對 0.172.0（416,707,888 bytes），scratchpad `strcount.mjs` 計數＋抽前後文
- ⑤ 實測（不登入、不呼叫模型、不開 codex turn；claude 用空的 `CLAUDE_CONFIG_DIR`、codex 用空的 `CODEX_HOME`，都在 scratchpad）：SDK `initializationResult()` / `supportedModels()`、送一句 prompt（回 `Not logged in · Please run /login`，無模型請求）看 hooks 與 `system/init`、`disableAllHooks`、`claude update`、兩版 `--help`；codex `mcp get bat --json`、`mcp list`、`--help` / `resume --help` / `plugin --help`
- ⑥ codex 官方 release notes：`gh api repos/openai/codex/releases/tags/rust-v0.167.0` … `rust-v0.172.0`；PR #60041 說明
- ⑦ codex 原始碼：`codex-rs/tui/src/daemon_startup.rs`、`codex-rs/tui/src/terminal_program_status.rs`、`codex-rs/config/src/plugin_edit.rs`，`rust-v0.166.0` 對 `rust-v0.172.0`
- ⑧ npm 套件內容：升版前備份的 `node_modules`；6 個 codex 平台包以 `npm pack @openai/codex@<v>-<p> --dry-run --json` 比對檔案清單；`npm pack @anthropic-ai/claude-code@2.1.331`

##### claude CLI
**① 模型清單 / effort / 計價 / 門檻：新增 Fable 5.2 → 已補（純追加）**
- ① 2.1.321「Added Claude Fable 5.2 (`claude-fable-5-2`), now the default Fable model — 1M context, $8/$40 per Mtok with $0.20/Mtok cache reads」；「Changed saved Fable 5.1 model picks to move to `fable`」。
- ⑤ `supportedModels()`：2.1.331 的 `fable` alias 由 `claude-fable-5-1`（$10/$50）改指 `claude-fable-5-2`（`Fable 5.2 · … · $8/$40 per Mtok`）；其他 4 個 alias 逐字相同，五個 alias 的 `supportedEffortLevels` 都仍是 `["low","medium","high","xhigh","max"]`。④ `claude-fable-5-2` 0→41。
- ③ 價目頁：`Claude Fable 5.2 | $8 / MTok | $10 / MTok | $16 / MTok | $0.20 / MTok¹ | $40 / MTok`（註 1：0.025x）；模型總覽：`claude-fable-5-2` 1M context、128K max output。既有模型價格（Opus 5.5 / Fable 5.1 / Fable 5 / Sonnet 5.5 / Sonnet 5 / Haiku 5.5 兩段 / legacy）與 `model-pricing.ts` 一致，沒改。價目頁另列 `Claude Mythos 5.2`（limited availability），CLI 清單沒有，不加（同 T0717 對 Mythos 5.1 的處置）。
- 修改：`BAT_BUILTIN_MODELS` 在 Opus 5.5 後加 `claude-fable-5-2`（`Fable 5.2 (1M)`，Fable 5.1 保留）；`MODEL_LIMITS` 加 `fable-5-2` 1M / 128K；`MODEL_PRICING['fable-5-2'] = P(8, 40, { cacheReadMultiplier: 0.025 })`（= input 8 / output 40 / cache read 0.20 / 5m write 10 / 1h write 16，與價目頁逐欄相同），`getModelPricing` 的 `fable-5-2` 排在 `fable-5` 之前（point release 先於 base）。測試：`claude-model-limits-and-call-usage.test.ts`、`model-pricing.test.ts`（`price(8, 40, 0.2, 10, 16)` 與 shadow 檢查）、`model-pricing-cost.test.ts`。
- `HEALTHY_MIN`：① 2.1.317 – 2.1.331 沒有服務端版本門檻的條目；④ `claude_code_version_too_old` 4→5、`does not support this model` 2→2。Fable 5.2 的服務端最低 CLI 版本沒有公開資料、也不能在不呼叫模型的情況下實測，維持 `2.1.280`（列入〈遭遇問題〉觀察 2）。

**② update guard：仍有效**
- ④ 決策函式仍先判斷 `DISABLE_UPDATES` 再 `DISABLE_AUTOUPDATER`：`function _y(e,n=!1){if(s.DISABLE_UPDATES)return{type:"env",envVar:"DISABLE_UPDATES"};if(e)return{type:"env",envVar:"DISABLE_AUTOUPDATER"};…`（新增的第二參數只影響其後的分支）。`Updates are disabled by your administrator` 3→3。
- ⑤ 把 2.1.331 的 `claude.exe` 複製到 scratchpad，帶 `DISABLE_UPDATES=1` 與空的 `CLAUDE_CONFIG_DIR` 執行 `claude.exe update`：`Updates are disabled by your administrator. Contact your IT team to get the latest version.`，exit 0；前後 sha256 前 16 碼都是 `db6a1c2506ce797e`。

**③ BAT 整合點：沒有變動**
- ⑤ `--help` 兩版 diff 只有說明文字改寫；`--mcp-config <configs...>`（仍 variadic，BAT 的 `=` 形式仍必要）、`--settings <file-or-json>`、`-n, --name <name>`、`-r, --resume [value]` 都在。
- ⑤ hooks（SDK `extraArgs: { settings }` = BAT 的 `--settings=` 注入，async 的 `SessionStart` / `UserPromptSubmit` / `Stop` command hooks）：兩版都是 `session-start sid=true keys=cwd,hook_event_name,session_id,source,transcript_path`、`user-prompt-submit sid=true keys=cwd,hook_event_name,permission_mode,prompt,prompt_id,session_id,transcript_path`（`session_id` 在，T0642 依賴）；`Stop` 沒有 turn 時不觸發（兩版相同）。
- ⑤ `disableAllHooks: true`（user `settings.json`）→ 2.1.331 `hooks: []`，T0590 / T0600 前提成立。
- ④ `BAT_CLAUDE_HOOKS` 的事件名都還在（只增不減）：`"SessionStart"` 48→64、`"UserPromptSubmit"` 51→63、`"Stop"` 71→81、`"Notification"` 13→16、`"PermissionRequest"` 82→100、`"PreToolUse"` 133→175、`"PostToolUse"` 80→107、`"PostToolBatch"` 39→45、`"ElicitationResult"` 18→20、`elicitation_dialog` 3→3、`elicitation_url_dialog` 5→5、`elicitation_response` 13→10（仍在）；`allowManagedHooksOnly` 52→58、`disableAllHooks` 94→108、`autoContinueAtUsageLimit` 20→18（仍在）、managed 路徑 `C:\Program Files\ClaudeCode` 1→1。
- ① hooks 相關條目（2.1.317 – 2.1.331）都不影響 BAT 的 settings command hooks：例如 2.1.326 `"decision": "block"` 在更多情況生效（BAT hook 不輸出）、2.1.323 `--settings` 檔不是合法 JSON 且有 `sandbox` 鍵時停止啟動（BAT 的設定檔是合法 JSON、只有 `hooks`）、2.1.323 長時間 hook 的心跳、2.1.328 / 2.1.331 Stop / SubagentStop 修正。
- **OSC 7501**：④ 組字函式兩版只有 minifier 改名，內容相同：`[\`state=${e.state}\`,"app=claude-code"]` ＋ `id=` / `kind=`（blocked）/ `progress=`（working / blocked）/ `title=` / `msg=`（base64），`join(":")`；clear 序列 `…7501;state=clear` 與 `state=clear:id=${e}` 相同；探詢處理 `probe: OSC 7501 reply` / `probe: no reply to OSC 7501 ; ?` 兩版都在（2.1.331 另有 attach 模式的 `attach: OSC 7501 reply`）。① 2.1.326 三條 OSC 7501 改善（閒置 compaction 後的狀態、背景工作列為 `id=` 子紀錄、等背景工作時送 `working` 而非 done、folder trust 提示時送等待）都在 BAT 既有規則內：`id=` 子紀錄不影響分頁、`done` / `error` 讀成 `idle`、未知 state 忽略。`PROGRAM_STATUS_PROBE_REPLY` 不需要改。
- **`src/lib/usage-limit.ts` 句型：一句改了 → 已補（純追加）**
  - 計數不變：`ve reached your` 10、`weekly limit` 23、`Fable limit` 8、`Opus limit` 2、`Sonnet limit` 2、`progress saved` 3、`org is out of usage` 6、`seat type doesn` 8、`Usage limit reached` 14、`Usage limit available again` 2、`Continuing shortly` 2、`Continuing automatically` 4、`Automatic continue cancel` 14、`Your usage limit has reset` 2、`Press enter to continue` 4、`Usage limit reset` 6。增加的只是新增引用：`You've hit your` 23→24、`session limit` 7→8、`monthly spend limit` 27→38、`out of usage credits` 11→20、`Automatic continue stopped` 8→10。
  - 變動（① 2.1.326「Improved the message shown when a team's pooled group budget is used up: it now says when the budget resets」）：`team's shared budget` 8→**0**、`You've hit your team` 6→0；新句由 `q(Can, …)` = `` `You've hit your ${"team's pooled group budget"}${" · resets …"}${" · ask your admin to raise it at …"}` `` 組成。修正前 `CLAUDE_BLOCKED_RE` 認不得 → 少了 `non-timed` 提示。修正：`CLAUDE_BLOCKED_RE` 加 `team's pooled group budget`，舊句保留（system runtime 可能是舊 CLI）。測試補 2 句（含重置時間與彎引號）＋ 引用在句中不算。
  - 2.1.326 新增的 `Automatic continue stopped · your login changed or ended · send a prompt to continue` 以 `Automatic continue stopped` 開頭，`CLAUDE_STOPPED_RE` 照認，不需改。小寫 `continuing automatically` 4→0，`CLAUDE_AUTO_RE` 是 `iu`、`CLAUDE_RESUMED_RE` 認 `[Cc]`，不受影響。

**④ binary 路徑與平台子套件：沒有變動**
- `@anthropic-ai/claude-code` 的 `package.json` 除版號外相同；套件檔案（`bin/claude.exe`、`cli-wrapper.cjs`、`install.cjs`、`LICENSE.md`、`README.md`、`sdk-tools.d.ts`）相同，`bin/` 只有 `claude.exe`；`bin/claude.exe` 與 `claude-code-win32-x64/claude.exe` 都是 405,798,560 bytes、hardlink count 2。`resolveEmbeddedClaudePath` / `embeddedClaudeCandidates` 與 `verify-packaged-native.js` 的 JS 複本不需要改。
- stub 偵測仍有效：`npm pack @anthropic-ai/claude-code@2.1.331` 的 `bin/claude.exe` 是 500 bytes、含 `claude native binary not installed`；`verify-native-modules.js` 對內嵌 binary 回 `embedded claude: native`。

**⑤ `CLAUDE_CONFIG_DIR` / `CLAUDE_CODE_PLUGIN_CACHE_DIR`：語意不變**
- ④ 設定目錄 `… .CLAUDE_CONFIG_DIR ?? join(home, ".claude")` 與 plugins 根目錄 `let e=s.CLAUDE_CODE_PLUGIN_CACHE_DIR;if(e)return Tp(e);return k(nt(),B())` 兩版邏輯相同（只有改名）；2.1.331 多了把這幾個變數轉給子程序的路徑，不影響 BAT 的 `resolveClaudeConfigDir` / `resolveClaudePluginsDir`。① 2.1.327「Fixed `/statusline` writing to `~/.claude/settings.json` when `CLAUDE_CONFIG_DIR` points to another folder」與 BAT 的語意一致。

##### Agent SDK（0.3.317 – 0.3.331）
- **Breaking（0.3.327）**：`query()` / `startup()` / `prewarm()` 拒絕無法送給 CLI 的選項（循環、BigInt）；hook 選項必須是陣列。BAT 的 `queryOptions`（`electron/claude-agent-manager.ts` `runQuery`）沒有 `hooks` 選項、沒有 `settings` 選項、沒有循環或 BigInt 值；⑤ 用 BAT 同一組選項（`systemPrompt` / `tools` preset、`permissionMode`、`includePartialMessages`、`promptSuggestions`、`settingSources`、`thinking: adaptive`、`effort`、`toolConfig`、`agentProgressSummaries`、`perTaskStopAffordance`、`canUseTool`、`pathToClaudeCodeExecutable`、`env`、`stderr`）啟動 0.3.331：`initializationResult()` 243 ms 回來（`claude_code_version: 2.1.331`），`close()` 正常。`npm run typecheck:electron` = 0（`queryOptions: Options` 有型別檢查，T0724）。
- **`streamInput` / `command_lifecycle` / `msg_lifecycle_v1`**：⑤ 2.1.331 的 `system/init.capabilities` 仍含 `msg_lifecycle_v1`（另多了 `mcp_call_soft_error_result_v1` 等 9 項）；`Query.streamInput` / `stopTask` 存在；④ `msg_lifecycle_v1` 2→2、`command_lifecycle` 34→34。`claude-send-during-turn.test.ts` 綠。
- **`Query.cancelAsyncMessage`**：`sdk.mjs` 的實作兩版逐字相同 `async cancelAsyncMessage(e){return(await this.request({subtype:"cancel_async_message",message_uuid:e})).response.cancelled}`，仍不在 `sdk.d.ts`；0.3.326「Added `message_uuid` to `cancel_async_message` responses」只在回應多一個欄位，方法仍回 `response.cancelled`，`cancelSdkQueuedMessage` 的 `=== true` 判斷不受影響。
- **背景子代理**：0.3.327 被喚醒的背景子代理的 `task_started` 不再帶 `prompt`（BAT 不讀 `prompt`）；0.3.331 `task_notification.output_file` 也會指前景子代理（BAT 不讀 `output_file`）；0.3.328 / 0.3.330 的 interrupt / `stopTask()` 修正與 BAT 的 `perTaskStopAffordance: true`（Esc 只停回合）一致。`claude-background-agent.test.ts` 等測試綠。
- **`options.env`（`sdkSpawnEnv`）**：沒有相關變更。0.3.328 新增 `CLAUDE_CODE_DISABLE_DEFERRED_TOOL_RESUME`（opt-in，BAT 不設）。
- **`close()` / abort**：⑤ `close()` 正常；沒有相關變更條目。
- **`system/init`（`lastQueryInit`）**：`initializationResult` 鍵集合新版只增不減（`account`、`agents`、`commands`、`models` … 都在，另多 `hook_on_failure_supported` 等）。
- **`modelUsage` / `total_cost_usd` 累計語意**：沒有相關變更。0.3.321「queued subagent reports in auto mode share one model call … all but the last end in an empty `result` with `num_turns: 0`」：這種 `result` 的累計值與前一個相同，`turnModelUsage` 會得到 0 差值，Cache History 可能多一列 0 的 R 列（觀察，見〈遭遇問題〉觀察 3）。
- **其他**：0.3.326 `mcpServersDelivery` 與「`mcpServers` 走 argv 將改預設」——BAT 不傳 `mcpServers`，不受影響；0.3.323 長時間 hook 的 `tool_progress` 心跳（`tool_use_id` 以 `hook-` 開頭）——BAT 不處理 `tool_progress`；0.3.325 / 0.3.329 / 0.3.330 新的 `system/informational` 警告——BAT 只記 `[claude:system] subtype=…` 一行；0.3.330 `settings` 為無法解析的 JSON 字串時 `query()` 失敗——BAT 不傳 `settings`。
- **打包 / server bundle**：⑧ `sdk.mjs` 仍只 import Node 內建模組（多 `node:util`、少 `require("util")`），`require("ajv/…")` 仍是 codegen 字串，與 0.3.316 相同；`exports` 7 個入口、`engines` `>=18.14.0` 不變；套件 4,976,758 → 5,186,114 bytes。平台子套件名稱不變，`verify-native-modules.js` / `verify-packaged-native.js` / `verify-server-bundle.js` 不需要改。

##### codex（0.167.0 – 0.172.0）
**① 原生 binary 路徑解析：沒有變動**
- win32-x64 安裝後的檔案清單兩版相同；`vendor/x86_64-pc-windows-msvc/codex-package.json` 只差 `version`。⑧ 6 個平台包的檔案清單 0.166.0 → 0.172.0 全部相同（darwin 43、linux 45、win32 47 檔，新增 / 移除 0）。`resolveBundledCodexLayout`（`electron/codex-bundled-path.ts`）的 >= 0.160 分支照樣命中；`verify-packaged-native.js` 的 `@openai/codex-${platform}-${arch}` 檢查與 `verify-native-modules.js`（沒有 codex 檢查項）都不需要改。
- `@openai/codex` wrapper `bin/codex.js` 只改了訊號轉送（第 261–268 行）；`PLATFORM_PACKAGE_BY_TARGET` 表沒動，`electron/codex-osc-version.ts` 的鏡像仍正確。BAT 不執行這個 wrapper。

**② SDK API：沒有任何變動**
- `@openai/codex-sdk` 0.166.0 → 0.172.0 的 `dist/index.d.ts`、`dist/index.js` diff 皆為空；`package.json` 除版號外相同。`codex-agent-manager.ts` 用到的 `Codex` / `startThread` / `resumeThread` / 選項不受影響；`codex-bundled-path.ts` 的 SDK 鏡像只補註解。

**③ BAT 整合點：沒有變動**
- `-c mcp_servers.bat.*`（含 `env_vars`、`tool_timeout_sec`）：用 BAT 自己的 `codexMcpOverrides()` 組出 `-c`，兩版 `codex mcp get bat --json` 輸出逐字相同（`transport.env_vars` 9 個名稱、`env: null`、`tool_timeout_sec: 60.0`）。
- `-c check_for_update_on_startup=false`：兩版 `mcp list` 都接受；給字串 `"x"` 兩版都 `invalid type: string "x", expected a boolean … in \`check_for_update_on_startup\`` exit 1（仍是有型別檢查的有效設定）。
- `--no-daemon`：`--help` 兩版 diff 只有 `agents` 子命令的說明一行；`--no-daemon` 與 `-c, --config` 都在（`resume --help` 也有）。`codexNoDaemonDecision` 的 `>= 0.156.0` 門檻不受影響。
- `config_exclusion`（⑦ `daemon_startup.rs`）：`config_exclusion` 函式兩版相同——只有 `suppress_unstable_features_warning`、`tui.fullscreen_transcript`、`features.<名稱>` = bool 不排除 daemon，其他 `-c`（BAT 的 `mcp_servers.bat.*`、`check_for_update_on_startup`）仍回 `command-line configuration overrides …`，codex 走 embedded。diff 只有：`--agents-overview` 分支移除、新增 `GATEWAY_SIGN_IN_EXCLUSION` 常數、`configRequirements/read` 的 method-not-found 判斷改寫。⑥ 0.168.0 #58940 退役 `daemon_auto_start` 旗標後 #59447 又恢復（同版），BAT worker argv 的 `features.daemon_auto_start=false` 照舊被接受（t0592 通過）。
- OSC 7501（`src/lib/codex-terminal-state.ts`）：⑦ `terminal_program_status.rs` 在 `rust-v0.166.0` 與 `rust-v0.172.0` 逐字相同；④ `idleworkingblockeddone` 1→1、`permissionquestionauth` 1→1、`:kind=` 1→1、`app=codex` 1→1、`state=clear` 1→1。⑥ 0.169.0 #60418「Let terminal status become done while background terminals run」→ 送的仍是 `done`，BAT 讀成 `idle`。不需要改。
- **`src/lib/usage-limit.ts` 的 codex 句型：新增一句 → 已補（純追加）**：既有句型計數與前後文都不變（`ve hit your usage limit` 7、`Try again at` 1、`try again later` 2、`Your workspace is out of credits` 4、`You hit your spend cap` 2、`Usage limit reached. You` 1、`ve reached your usage limit` 1、`re out of credits.` 1）。0.172.0 #62329「Report API spend limit errors by scope」新增 `Your API {key|project|organization} has reached its spend limit.`（④ `spend limit` 0→2，前後文 `keyprojectorganization\tYour API … has reached its spend limit.`）。修正：`CODEX_BLOCKED_RE` 加這句（三種 scope），歸 `codex-blocked` → `non-timed` 提示；測試補 3 句（含 `■ ` 前綴）＋ 引用在句中不算。
- `codex resume`（`codexResumeArgs`）：⑤ `codex resume --help` 兩版行數相同、`--no-daemon` / `-c` 都在。
- CT plugin（`electron/ct-install-detect.ts`）：⑦ `plugin_edit.rs` 在兩個 tag 逐字相同（寫 `[plugins."<id>"]` 表與 `enabled` 鍵）；`codex plugin --help` 兩版相同。

**④ release notes 其他與 BAT 相關的條目（都不需要改 BAT）**
- 0.169.0 #60041「`codex exec` keeps project configuration and MCP servers disabled in untrusted directories, even with `--sandbox workspace-write`」：Codex 面板走 SDK（= `codex exec`，`workspace-write` 預設），不受信任的專案資料夾裡，專案層 `.codex/config.toml` 與專案 MCP 不再載入（使用者層設定照舊）。BAT 面板沒有注入 BAT MCP、不依賴專案設定，程式不需改；屬上游行為變化，列入需實機驗證與觀察。
- 0.171.0 #61706「Refactor exec to use the shared app-server client」：SDK `dist` 沒變；面板實際對話需真人驗證（見下）。
- 0.172.0 #62366「Optional stdio MCP servers with cached tool lists now start on their first tool call by default」：t0592 的 worker 仍在 `mcpServerStatus/list` 看到 `bat` 與 8 個 tool。
- 0.167.0 #57978 per-chat leases、0.171.0 #61444 shared MCP 的 process-local launch directories：BAT 每個 codex 分頁是各自的 embedded 程序（`config_exclusion`）；t0592 worker 在 codex 預設 sandbox 下 `BAT_*` 8 項都在、`tokenIsCapability: true`。
- 0.168.0 `tui.notification_method = "osc777"`：opt-in，BAT 不設。

#### 寫死版本的處置
| 位置 | 性質 | 處置 |
|---|---|---|
| `CLAUDE.md`「Claude Agent SDK / CLI」版本行（`^0.3.316`、`^2.1.316`） | 內嵌實裝版本 | 改為 `^0.3.331` / `^2.1.331`（補 T0891）；CLAUDE.md 86,703 字元（< 100k） |
| `CLAUDE.md`「BAT MCP shim」節（內嵌 codex 目前 `0.166.0`，T0717） | 內嵌實裝版本 | 改為 `0.172.0`，T0891 |
| `docs/agent-guide/claude-agent-sdk-cli.md:5 / :7 / :15 / :236` | 實裝版本、模型清單、`MODEL_LIMITS`、effort、版本鎖 | :5 改為 `^0.3.331` / `^2.1.331` 並補 T0891 追版紀錄（歷史保留）；:7 補 `claude-fable-5-2` 與 2.1.331；:15 補「2.1.331 同（含 `fable` → Fable 5.2），T0891」；:236 版本鎖 `^2.1.331` |
| `docs/agent-guide/npm12-install-scripts.md:6 / :21` | 內嵌實裝版本（`--version` 期望值） | :6 補「T0891 起為 `2.1.331`」；:21 改為「T0891 起 `2.1.331 (Claude Code)`」 |
| `docs/agent-guide/claude-session-name.md:57`（內嵌固定 2.1.316 線） | 現況敘述 | 改為「內嵌固定 2.1.331 線，T0891」 |
| `docs/agent-guide/bat-mcp-shim.md:41`（T0592 e2e 重跑紀錄） | 歷史實測＋目前內嵌版 | 歷史保留，補「T0891 以內嵌 0.172.0 重跑通過」 |
| `docs/agent-guide/usage-limit-continue.md:9`「句型來源」 | 行為說明 | 補 T0891 兩句與計數不變的結果 |
| `docs/agent-guide/blocked-state.md:61`（codex OSC 段） | 行為說明 | 補 0.172.0 原始碼相同、#60418、claude 2.1.331 組字函式相同 |
| `scripts/verify-native-modules.js:66`、`scripts/__tests__/verify-native-modules.test.mjs:32`（stub 形狀註解） | 內嵌實裝版本的 stub 形狀 | 補 `2.1.331`（已用 2.1.331 tarball 實測，同為 500 bytes） |
| `electron/codex-bundled-path.ts:6`（SDK 鏡像來源） | SDK 鏡像 | 補「0.172, T0891」（SDK dist diff 為空） |
| `electron/codex-osc-version.ts:74`（`PLATFORM_PACKAGE_BY_TARGET` 取自 0.166.0 `bin/codex.js`） | 鏡像來源紀錄 | 不動（表在 0.172.0 沒變；檔案不在 `affects_files`） |
| `electron/claude-agent-manager.ts:416 / :432 / :515 / :1959`、`electron/claude-config-dir.ts:22 / :47`、`electron/terminal-blocked-state.ts:36`、`src/lib/cache-history.ts`、`claude-resume-args.ts`、`claude-task-list.ts`、`codex-resume-args.ts`、`codex-terminal-state.ts:11 / :16`、`usage-limit.ts:16 / :139` 的 `2.1.316` / `0.3.316` / `0.166.0` | 某一版的實測 / 原始碼紀錄 | 不動（本單核對結果：這些行為在新版不變） |
| `docs/agent-guide/claude-agent-sdk-cli.md` 其餘（:12 / :20 / :52 / :57 / :67 / :68 / :82 / :84 / :96 / :103 / :107 / :117 / :155 / :168 / :225 / :232 / :288）、`blocked-state.md:31 / :58 / :73 / :101 / :113`、`ct-plugin-install.md`、`macos-ci-acceptance.md`、`remote-file-upload.md`、`terminal-server-recovery.md`、`worker-tab-recycle.md`、`bat-mcp-shim.md:64 / :68`、`packaging-release-checks.md`、`CLAUDE.md:288` | 歷史實測紀錄 | 不動 |
| `electron/__tests__/*`、`src/lib/__tests__/*`、`e2e/*` 的 `2.1.316` / `0.166.0`（stub 的 `--version` 輸出、版本探測案例、說明註解）、`e2e/v072-pre6-codex-resumed.spec.ts` 的 `MIN_CODEX = '0.166.0'`、`e2e/t0772-pre4-env-acceptance.spec.ts` 的 `CODEX_VERSION` | 任意測試字串 / 門檻 / 歷史實測 | 不動 |
| `CHANGELOG.md`、`release-note.md`、`README.md:181` | 已發佈版本的紀錄 / 門檻 | 不動（發版時由塔台寫） |
| `2.1.280` / `2.1.251` / `2.1.76` / `0.156.0` / `0.163.0` 等門檻 | 門檻值 | 不動 |

#### 驗證證據
| AC | 結果 | 證據 |
|---|---|---|
| 內嵌 `--version`、SDK 版本、`verify-native-modules` | ✅ PASS | `2.1.331 (Claude Code)`、`codex-cli 0.172.0`、SDK `0.3.331`；`node scripts/verify-native-modules.js` exit 0 |
| lock diff 只涉及三個系列 | ✅ PASS | `104 insertions(+), 104 deletions(-)`；`REAL 27  META-ONLY 0  OUTSIDE-TARGET 0` |
| unit / legacy / build / typecheck / verify:helpers | ✅ PASS | 見下方 |
| e2e t0592 / t0621 | ✅ PASS | 見下方（t0592 一個情境間歇失敗，〈遭遇問題〉1） |
| claude / Agent SDK / codex 核對 | ✅ PASS | 〈核對結果〉；三項純追加已補 |
| 需實機驗證項目 | ✅ | 〈需實機驗證〉 |
| 隔離分支證據 | ✅ | 〈隔離分支證據〉 |

明細（驗證時 HEAD = `36a23b7d`）：
- `npx vite build` exit 0。
- `npm run typecheck` exit 0；`npm run typecheck:electron` exit 0。
- `npm run verify:helpers` exit 0（6 個 runtime helper，與 server bundle 同一組）。
- `npm run test:unit` exit 0：`Test Files 463 passed | 3 skipped (466)`，`Tests 8459 passed | 41 skipped (8500)`（基線 T0888 8433 passed；本單新增測試）。第一次跑 exit 1（6 檔 / 1 test），原因是全新 worktree 第一次 `require('electron')` 時多個測試同時下載解壓 Electron binary 撞檔（`failed to create '…\node_modules\electron\dist\locales\es.pak': 檔案存在。 (os error 80)`），其餘是同一原因造成的 hook 逾時；binary 下載完成後那 6 檔單獨重跑 `6 passed / 109 passed`，整套重跑如上。
- `npm run test:legacy` exit 0：`files 33 passed, 0 failed / 33 total; tests 472 passed, 0 failed`。
- `claude-send-during-turn.test.ts`（CLAUDE.md 規定 SDK 升版必跑）包含在 unit 中，另在改碼後單獨跑過（與 usage-limit / model-pricing / model-limits 共 5 檔 207 passed）。
- e2e `e2e/t0592-codex-tower-worker.spec.ts`（內嵌 0.172.0，userAgent `t0592/0.172.0`）：共 6 次執行——第 1 次整份 `1 passed / 1 failed`、`lacking "shell"` 情境單獨 2 次（1 過 1 不過）、之後整份連續 3 次 `2 passed`。worker / tower argv 含 `mcp_servers.bat.*`（含 `env_vars`）；worker 另有 `features.daemon_auto_start=false`；worker 的 `mcpServerStatus/list` 列出 `bat` 與 8 個 tool；codex 預設 sandbox 下 `BAT_*` 8 項都在、`tokenIsCapability: true`。每次 teardown `Terminal Server … alive after teardown: false`、`runtime userData removed: true`。
- e2e `e2e/t0621-codex-osc-state.spec.ts`：`BAT_E2E_CODEX` 指到內嵌 0.172.0 → `1 passed (24.2s)`；`--wait-started (trusted)` 1381 ms 回 `started`；`bat_get_state` `blocked (input)` / `source: osc` → 核准後 `working`；`--wait-started (untrusted)` exit 8（`started: unconfirmed`）；`[codex-version] … version=0.172.0 (probed)`；模型請求只打到 spec 的本機假模型（`POST /v1/responses` ×2）。（第一次我把 `BAT_E2E_CODEX` 組錯，spec 改挑使用者安裝版 codex——也是 0.172.0——同樣 `1 passed`；以內嵌版重跑的結果為準。）
- e2e 都用 `e2e/fixtures/electron-isolation.ts` 的隔離實例（`--runtime=e2e-…`、獨立 userData 與 remote port），沒有以預設實例啟動 source build，沒碰使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）與它的 userData / Terminal Server / `bat-pty-holder`；沒跑 `t0859-pty-holder.spec.ts`；沒開任何會耗 token 的 claude / codex turn。
- 程序清理（D308）：沒有手動結束任何程序（e2e 由 fixture 自行 teardown，背景指令都自然結束）。

#### 需實機驗證
- **mac / Linux 內嵌 binary**：由 pre.2 CI 的 `verify-packaged-native` 加上實機，確認 `claude-code-<platform>-<arch>[-musl]/claude` = 2.1.331、`@openai/codex-<platform>-<arch>/vendor/<triple>/bin/codex --version` = `codex-cli 0.172.0`。
- **Windows 安裝版**：NSIS 完整重裝後，內嵌 claude `--version` = `2.1.331 (Claude Code)`；`resources/app.asar.unpacked/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe --version` = `codex-cli 0.172.0`。
- **Claude Agent 面板**：開新 session 能正常對話（需 credential，本單沒有呼叫模型）；模型下拉多了 `Fable 5.2 (1M)`，選它後 Cache History 的計價為 $8 / $40；SDK alias `fable` 現在解析成 Fable 5.2（會被當成 builtin 而略過）。
- **終端 claude-cli 分頁**：BAT MCP（`--mcp-config=`）載入、⚠️ blocked 與 `agentStarted` 正常、`--name` 顯示在 ListAgents；非 Windows 主機上 hooks 關閉的分頁 OSC 7501 狀態正常。
- **Codex 面板（SDK 路線）實際對話**：需真人與 ChatGPT 登入；SDK 沒變，重點看 0.171.0 起 `codex exec` 改用共用 app-server client 後事件是否照常，以及 0.169.0 起不受信任的專案資料夾裡專案層設定 / 專案 MCP 不再載入（面板會不會顯示 codex 的警告）。
- **限額提示**：真實撞到 team pooled group budget 或 codex API spend limit 時，留意 `[usage-limit]` 日誌是否辨識（句型取自 binary，沒有實測樣本）。

### 互動紀錄
- [00:32] 開工：landing PASS、merge-base = `bcb4bbe0` ✅；`npm view` latest 與塔台相同（2.1.331 / 0.3.331 / 0.172.0）。
- [00:45] 核對發現三項純追加（Fable 5.2、`team's pooled group budget`、codex API spend limit），依 `memory_overrides` 第 7 條直接補；沒有影響 BAT 行為的變動，沒有向塔台提問。
- 塔台補充檢查三個節點（驗證前、產品 commit 前、填回報前）都沒有新段落。

### Renew 歷程
無

### 遭遇問題
1. **e2e t0592 `codex Worker dispatch with settings.json lacking "shell"` 情境間歇失敗**（6 次中 2 次）：失敗都在同一斷言——Worker 的 `bat-notify --submit` 已 exit 0、無 `Forbidden`（BAT 接受了寫入），但 tower 分頁的 pwsh buffer 20 秒內沒有出現 `T0592 完成`；失敗時 tower buffer 停在 pwsh 輸入列，混有使用者 PowerShell profile 印出的內容。同一 spec 的另一個情境 4/4 通過，最後連續 3 次整份全綠。沒有拿舊版 codex 對照，所以不能確定是否 0.172.0 前就會發生；判斷是 tower 端 pwsh 回顯的時序問題（斷言前的 MCP / env / notify 步驟都通過），列給塔台評估是否另開單把 spec 改得更穩（例如以 `-NoProfile` 開 tower shell 或延長等待）。
2. **全新 worktree 的環境前置**：`verify-native-modules` 需要先 `npm run build:native-win`；第一次 `test:unit` 會因多個測試同時下載 Electron binary 撞檔而失敗。都不是產品問題，記錄給之後的 worktree 工單參考。

**觀察（非本單範圍）**：
1. claude 的 `You've hit your channel's monthly spend limit` / `usage credit limit` 等句型 2.1.316 就有、BAT 一直不認（不是本次新增），本單沒動。
2. Fable 5.2 的服務端最低 CLI 版本沒有公開資料；system runtime 若是 < 2.1.321 的 claude，選 Fable 5.2 可能遇到 `claude_code_version_too_old`（BAT 已有 `classifyClaudeError` 提示）。`HEALTHY_MIN` 維持 `2.1.280`，若要提高需另行決策。
3. SDK 0.3.321 起 auto mode 的佇列子代理報告共用一次模型呼叫，多出的 `result` 為空、`num_turns: 0`；Cache History 可能多出差值為 0 的 R 列，需真實模型才看得到。
4. 價目頁列出 `Claude Mythos 5.2`（limited availability），CLI 清單沒有，不加。

### 子代理與 Workflow 使用
未使用（本單沒有啟動子代理，也沒有呼叫 Workflow）。

### Commit
- 工單開工 commit（`$CT_HOME`）：`c8f59d9c`（`chore: T0891 start (ct)`，只含本工單）。
- 產品 commit（`ct/T0891`）：`36a23b7d`（`build: bump embedded claude CLI to 2.1.331, Agent SDK to 0.3.331, codex to 0.172.0 (T0891)`），18 個檔：`package.json`、`package-lock.json`、`CLAUDE.md`、`docs/agent-guide/{blocked-state,claude-agent-sdk-cli,claude-session-name,npm12-install-scripts,usage-limit-continue}.md`、`electron/claude-agent-manager.ts`、`electron/codex-bundled-path.ts`、`electron/__tests__/claude-model-limits-and-call-usage.test.ts`、`scripts/verify-native-modules.js`、`scripts/__tests__/verify-native-modules.test.mjs`、`src/lib/model-pricing.ts`、`src/lib/usage-limit.ts`、`src/lib/__tests__/{model-pricing,model-pricing-cost,usage-limit}.test.ts`。
- 文件 commit（`ct/T0891`）：`ef14afb7`（`docs(T0891): T0592 e2e rerun with embedded codex 0.172.0`，只有 `docs/agent-guide/bat-mcp-shim.md` 一句）。
- 工單收尾 commit：另一筆，只含本工單。
- 沒有 push、沒有觸發 workflow、沒有建 tag；沒有用 `git stash` / `reset` / `checkout --` / `restore`；`git add` 都用明確路徑。維持 LF（diff 中 `\r` 0 筆）。`git -C "$CT_WORKTREE" status --porcelain` 為空。

### 隔離分支證據
- branch：`ct/T0891`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`；與 `v0.8.x` 的 merge-base 為 `bcb4bbe0e2f300832bfa3bbfbfbebcc46f1f23a4`）
- validated_sha：`36a23b7d6cd0fb136eb945875d95f8876fee6460`
- head_sha：`ef14afb74357d3c2033da2cebe64a6852b6fe105`
- validated_sha ≠ head_sha 的說明：`ef14afb7` 只在 `docs/agent-guide/bat-mcp-shim.md` 補一句 e2e 重跑結果（e2e 跑完才能寫），沒有程式、測試或 build 設定變動，不需要重跑驗證。

### 回報時間
2026-11-25T00:59:42+0800
