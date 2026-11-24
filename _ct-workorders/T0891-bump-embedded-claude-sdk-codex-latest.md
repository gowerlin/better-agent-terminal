---
schema_version: 1
schema_kind: workorder
id: T0891
title: "內嵌 Claude / Codex 追最新（在 `v0.8.x`）：@anthropic-ai/claude-code 2.1.316 → 2.1.331、@anthropic-ai/claude-agent-sdk 0.3.316 → 0.3.331、@openai/codex-sdk / @openai/codex 0.166.0 → 0.172.0，核對 BAT 整合點"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-25T00:30:23+08:00"
updated_at: "2026-11-25T00:30:23+08:00"
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

- [ ] 內嵌 `claude.exe --version`、codex `--version`、Agent SDK 版本 = 新版；`verify-native-modules` ✅
- [ ] lock diff 只涉及 claude-code、claude-agent-sdk、codex 三個系列（附 diff 摘要與逐套件比對）
- [ ] `npm run test:unit`、`npm run test:legacy` 全綠（含 `claude-send-during-turn.test.ts`）；`npx vite build` exit 0；兩個 typecheck = 0；`verify:helpers` ✅
- [ ] e2e t0592 / t0621 綠
- [ ] claude CLI、Agent SDK、codex 各核對項目的結果，有改或無改都附證據
- [ ] 回報區列出需實機驗證的項目（mac / Linux 內嵌 binary 由 CI 的 `verify-packaged-native` 確認；Claude / Codex 面板實際對話需真人）
- [ ] 隔離分支證據（branch / base_sha / validated_sha / head_sha）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
（DONE / FAILED / BLOCKED / PARTIAL）
- **session_id**：

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0891`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
