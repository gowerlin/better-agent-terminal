---
schema_version: 1
schema_kind: workorder
id: T0717
title: "內嵌 claude CLI 與 codex 追最新：@anthropic-ai/claude-code ^2.1.306 → latest（2.1.316）、@openai/codex-sdk / @openai/codex ^0.163.0 → latest（0.166.0），核對 BAT 整合點；Agent SDK 不動（T0718 另做）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T08:12:30+0800"
updated_at: "2026-11-01T08:12:30+0800"
target_version: "0.7.2-pre.5"
depends_on: []
related:
  - "D191（使用者 2026-11-01：內嵌 claude / codex 全部追最新；CLI 追 latest 不追 stable；SDK 0.3 由 T0718 處理）"
  - "T0690（前次 claude CLI 追版 2.1.300 → 2.1.306）、T0697（前次 codex 追版 0.160 → 0.163）：步驟、lock 只動目標套件的移植做法、核對項目與證據格式都照這兩張的回報區做（`_ct-workorders/_archive/workorders/`）"
  - "CLAUDE.md「Claude Agent SDK / CLI」「BAT MCP shim」「blocked 狀態偵測」「Worker 啟動確認」「用量限制自動繼續」「Claude 分頁的 session 名稱」各節"
affects_files:
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
  - src/lib/__tests__/
  - src/types/index.ts
  - src/lib/usage-limit.ts
  - scripts/verify-native-modules.js
  - scripts/verify-packaged-native.js
  - scripts/__tests__/
  - e2e/
  - _ct-workorders/T0717-bump-embedded-claude-cli-codex-latest.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權修改 `package.json` 的 `@anthropic-ai/claude-code` 與 `@openai/codex-sdk` 版本，以及對應 `package-lock.json`（含 `@anthropic-ai/claude-code-*`、`@openai/codex`、`@openai/codex-*` 平台子套件）；其他相依**不得**連帶升版：lock diff 只能涉及這兩個系列與 root `dependencies` 那兩行，npm 產生的 `peer` 等旗標雜訊比照 T0690 / T0697 以移植方式去掉，回報區附 `git diff --stat package-lock.json` 與逐套件比對。"
  - "🔴 `@anthropic-ai/claude-agent-sdk` 不動（升 0.3 是 T0718 的範圍，依賴本單）；`package.json` 的 `version` 欄位不動（塔台發版時另行處理）。"
  - "🔴 開工時再查一次 `npm view @anthropic-ai/claude-code dist-tags` / `time`、`npm view @openai/codex-sdk dist-tags` / `time`、`npm view @openai/codex dist-tags`；取當下 **latest**（D191：claude 追 latest，不追 stable），若高於 2.1.316 / 0.166.0 在回報區說明；codex SDK 與 codex 版本不一致時以 SDK 的 dependency 為準。"
  - "🔴 claude 核對（官方 changelog 2.1.307 起各節、CLI 實際輸出、binary 字串；附證據）：① 模型清單 `BAT_BUILTIN_MODELS` / `supportedEffortLevels` / 計價（價格只能取自官方價目頁並附出處，查不到就不改；新增模型時同步 `MODEL_LIMITS` 與測試，point release 排在 base 之前）、服務端門檻與 `HEALTHY_MIN`；② update guard：`DISABLE_UPDATES` / `DISABLE_AUTOUPDATER` 仍有效；③ BAT 整合點：`--mcp-config=` / `--settings=` 的 hooks（`BAT_CLAUDE_HOOKS` 用到的事件，含 `SessionStart` payload 的 `session_id`）/ `--name` / `disableAllHooks` / `allowManagedHooksOnly` / `autoContinueAtUsageLimit`，以及 `src/lib/usage-limit.ts` 的句型仍出現在新 binary；④ binary 路徑與平台子套件結構不變（`resolveEmbeddedClaudePath` / `embeddedClaudeCandidates`、`verify-packaged-native.js` 的 JS 複本）。"
  - "🔴 codex 核對（官方 release notes / CHANGELOG 0.164 起各版、套件內容、binary 字串；附證據）：① 原生 binary 的套件目錄結構仍符合 `codex-bundled-path.ts` / `codex-agent-manager.ts` 的解析（含 legacy 分支），`verify-native-modules.js` / `verify-packaged-native.js` 的 codex 檢查項同步核對；② SDK API（`codex-agent-manager.ts` 用到的 export 與選項）沒有破壞性變動；③ BAT 整合點：`-c mcp_servers.bat.*`（含 `env_vars`）、`--no-daemon`（`codexNoDaemonDecision`）、`tui/src/daemon_startup.rs` 的 `config_exclusion`、`-c check_for_update_on_startup=false`、OSC 7501 序列格式（`src/lib/codex-terminal-state.ts`）、`src/lib/usage-limit.ts` 的 codex 句型、CT plugin skill 名稱 `$ct:ct-exec` 判斷所依賴的 `config.toml` `[plugins.\"ct@…\"]` 格式（`electron/ct-install-detect.ts`）仍成立。"
  - "🔴 任何核對項目有變動而會影響 BAT 時，先用 BAT 通道問塔台，不要自行改產品行為；純追加（新模型、新選項）照 CLAUDE.md 規則補即可。"
  - "🔴 測試、註解、docs 中寫死 `2.1.306` / `0.163.0` 的地方：區分「代表內嵌實裝版本」（更新）與「歷史實測紀錄 / 任意測試字串 / 版本門檻」（不動，例如 `>= 0.156.0`、`>= 0.163.0`、`>= 2.1.76`、`>= 2.1.280` 門檻），回報區逐一列出處置。CLAUDE.md 對應節與 docs 更新實裝版本與本單編號，歷史敘述保留；CLAUDE.md 不得超過 100k 字元目標（T0595）。"
  - "🔴 驗證：內嵌 `node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` = 新版、內嵌 codex 原生 binary `--version` = 新版；`node scripts/verify-native-modules.js` exit 0；`npm run verify:helpers` exit 0；`npm run test:unit` 全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；e2e `e2e/t0592-codex-tower-worker.spec.ts` 與 `e2e/t0621-codex-osc-state.spec.ts`（需先 `npx vite build`，CLAUDE.md 規定 codex 升版必跑）綠。e2e 只用隔離實例；不得以預設實例（無 `--runtime`）啟動 source build；不碰使用者正在用的 BAT 與其 userData；不開會耗 token 的 claude / codex turn。`TMP` 指到長路徑 scratchpad 時 git worktree 測試會因 `'$GIT_DIR' too big` 失敗（T0716），跑測試時用系統預設 TMP。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），本單原則上不需要 gh。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`，scratchpad 路徑也一樣。yolo：不得問使用者，判讀問題問塔台。"
---

# T0717 — 內嵌 claude CLI 與 codex 追最新

## 背景

- 使用者 2026-11-01 指示「將內嵌 claude, codex cli/sdk 更新到最新」（D191）。
- 塔台 2026-11-01 08:1x `npm view`：
  - `@anthropic-ai/claude-code` 實裝 `2.1.306`（T0690），latest `2.1.316`（stable `2.1.309`；D191 選 latest）。
  - `@openai/codex-sdk` / `@openai/codex` 實裝 `0.163.0`（T0697），latest `0.166.0`。
- `@anthropic-ai/claude-agent-sdk` 升 0.3 由 T0718 處理（含 D123 Phase 2，下架 `claude-code-v2`）；T0718 依賴本單，避免兩張同時改 `package-lock.json`。
- 本單與 T0718 完成、塔台聯合驗證後再決定是否發 `v0.7.2-pre.5`。

## 實作

照 T0690 與 T0697「實作」1–6 的做法，兩個系列各做一次：

1. 開工時再查 latest（見 `memory_overrides` 第 3 條）。
2. `package.json` 改 `@anthropic-ai/claude-code` 與 `@openai/codex-sdk` 為 `^<新版>`；更新 lock；lock diff 只含這兩個系列。
3. 內嵌 claude / codex binary `--version`、`verify-native-modules`。
4. 核對新版變化（見 `memory_overrides` 第 4、5 條）。
5. 寫死舊版號的測試 / 註解 / docs 逐一處置。
6. CLAUDE.md 與 docs 更新內嵌實裝版本（歷史敘述保留）。

## 驗收

- [ ] 內嵌 `claude.exe --version` 與 codex `--version` = 新版；`verify-native-modules` ✅
- [ ] lock diff 只涉及 claude-code 與 codex 系列（附 diff 摘要與逐套件比對）
- [ ] `npm run test:unit`、`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0；`verify:helpers` ✅
- [ ] e2e t0592 / t0621 綠
- [ ] claude（模型 / effort / 計價 / 門檻 / update guard / BAT 整合點 / 句型 / binary 路徑）與 codex（原生路徑 / SDK API / BAT 整合點 / 句型 / plugin 判斷）核對結果，有改或無改都附證據
- [ ] 回報區列出需實機驗證的項目（mac / Linux 內嵌 binary 由 CI 的 `verify-packaged-native` 確認；Claude / Codex 面板實際對話需真人）

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 版本與 lock

### 核對結果

### 寫死版本的處置

### 驗證證據

### 需實機驗證

### 遭遇問題

### 互動紀錄

### Commit

### 回報時間
