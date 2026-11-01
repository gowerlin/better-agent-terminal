---
schema_version: 1
schema_kind: workorder
id: T0760
title: "修正 BUG-191：`CLAUDE_CODE_PLUGIN_CACHE_DIR` 時的 plugins 位置與 CLI 一致（先以 CLI 2.1.316 實測）"
type: implementation
status: DONE
updated_at: "2026-11-02T03:16:03+08:00"
started_at: "2026-11-02T03:05:45+08:00"
completed_at: "2026-11-02T03:16:03+08:00"
session_ids:
  - "0a621316-e06b-417c-9452-753587c89638"
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-02T02:23:44+0800"
depends_on: [T0759]
related:
  - "BUG-191；T0730 回報區〈後續候選〉1；T0710（CT plugin 偵測）；BUG-178（`resolveClaudeConfigDir`）"
  - "`electron/claude-config-dir.ts`、`electron/ct-install-detect.ts`（`findClaudeCtPlugins`、`claudeCtPluginSkillDirs`）、`electron/claude-agent-manager.ts`（面板 plugins 清單）、`docs/agent-guide/claude-agent-sdk-cli.md`「Claude 設定目錄」、`docs/agent-guide/ct-plugin-install.md`"
affects_files:
  - electron/claude-config-dir.ts
  - electron/ct-install-detect.ts
  - electron/claude-agent-manager.ts
  - electron/handlers/ct-config.ts
  - electron/__tests__/
  - docs/agent-guide/claude-agent-sdk-cli.md
  - docs/agent-guide/ct-plugin-install.md
  - CLAUDE.md
  - _ct-workorders/T0760-fix-bug191-plugin-cache-dir.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先實測：內嵌 CLI 2.1.316，在暫存 HOME / `CLAUDE_CONFIG_DIR` 下設與不設 `CLAUDE_CODE_PLUGIN_CACHE_DIR`，以本機 marketplace（暫存目錄裡的假 plugin，不連網）安裝一個 plugin，記錄 `installed_plugins.json`、`known_marketplaces.json`、plugin 內容各落在哪裡。CT 文件的說法只當參考，以實測為準。"
  - "🔴 修正方向：依實測結果，plugins 根目錄的解析集中成一個函式（放在 `electron/claude-config-dir.ts` 旁，`resolveClaudeConfigDir` 規則不變），`findClaudeCtPlugins`、`claudeCtPluginSkillDirs`、面板 plugins 清單、`ct:read-config-sources` 預設層都經它；env 來源與 `resolveClaudeConfigDir` 相同（spawn env）。實測發現 CLI 行為與 CT 文件不同 → 照實寫進回報區，由塔台轉告 CT。不設變數時行為完全不變。"
  - "🔴 驗證：新增 / 修改的單元測試＋突變檢查（拿掉修正，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`（依上方 build 規則的位置）。"
  - "🔴 build（Lane B：T0758 → T0759 → T0760 → T0766 → T0767，與 Lane A 並行）：主 checkout 的 `dist` / `dist-electron` 可能正被 Lane A 的 e2e 使用。`npx vite build` 與 e2e 一律在 `git archive` 匯出目錄做（`%TEMP%/bat-<工單>-build`，`node_modules` 以 junction 共用主 checkout，T0742 作法）；主 checkout 只跑 `npm run typecheck` / `npm run typecheck:electron` / `npm run test:unit`。跑完刪匯出目錄（先刪 junction 本身，確認主 checkout `node_modules/electron` 仍在）。e2e 一律用隔離實例。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0760 — 修正 BUG-191：`CLAUDE_CODE_PLUGIN_CACHE_DIR` 時的 plugins 位置與 CLI 一致（先以 CLI 2.1.316 實測）

## 元資料

- **工單編號**：T0760
- **類型**：implementation
- **優先級**：P3
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：S

## 背景

T0730 發現設了 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時 BAT 找 plugins 的位置可能與 CLI 不同。D210 排入本批。

## 範圍

1. 以 CLI 2.1.316 實測 plugins 檔案位置。
2. 集中 plugins 根目錄解析，所有 consumer 經它。
3. 單元測試、文件。

## 不做

- 不改 `CLAUDE_CONFIG_DIR` 規則；不連網；不動使用者的 `~/.claude`；不發版。

## 驗收

- [x] 實測表（設 / 不設變數 × 各檔案位置）
- [x] 單元測試＋突變檢查；typecheck 0 / 0、`test:unit`、`vite build`（匯出目錄）
- [x] 文件更新

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE（驗收三項全過）
- **session_id**：0a621316-e06b-417c-9452-753587c89638
- **產品 commit**：`eb5c0589`（`fix: read Claude plugins from CLAUDE_CODE_PLUGIN_CACHE_DIR like the CLI (T0760, BUG-191)`）；未 push、未發版
- **BUG-191**：本單確認可重現（設變數時 BAT 讀錯位置），已修正；BUG 單狀態由塔台更新（不在本單 `affects_files`）

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）→ PASS
- C-1：工單在 REPO_ROOT 底下 → PASS；C-3：抽查的 `affects_files` 皆存在（資訊）；C-2：無 `branch` 欄位（目前 `main`）
- `CT_HOME` 未設（不在 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`；`BAT_REMOTE_TOKEN` 已設定

### 產出摘要

**1. 實測（內嵌 CLI 2.1.316）**

方法：暫存目錄（Worker scratchpad）裡建本機 `directory` marketplace `t0760-local`，內含假 `ct` plugin（`9.9.9`，含 `skills/ct-exec/SKILL.md`、`skills/control-tower/references/tower-config.md`）；每個情境用全新的暫存 HOME / USERPROFILE（`env -u CLAUDE_CONFIG_DIR -u CLAUDE_CODE_PLUGIN_CACHE_DIR`，`DISABLE_AUTOUPDATER=1`），跑 `claude plugin marketplace add <dir>` → `claude plugin install ct@t0760-local --scope user`，兩步都 `✔ Successfully`。不連網、沒碰使用者的 `~/.claude`。

| 情境 | `CLAUDE_CONFIG_DIR` | `CLAUDE_CODE_PLUGIN_CACHE_DIR` | `installed_plugins.json` / `known_marketplaces.json` | plugin 內容 | `settings.json` |
|---|---|---|---|---|---|
| A | 未設 | 未設 | `<home>/.claude/plugins/` | `<home>/.claude/plugins/cache/t0760-local/ct/9.9.9/` | `<home>/.claude/` |
| B | 設 | 未設 | `<config>/plugins/` | `<config>/plugins/cache/…` | `<config>/` |
| C | 未設 | 設 | `<cache dir>/` | `<cache dir>/cache/…` | `<home>/.claude/` |
| D | 設 | 設 | `<cache dir>/` | `<cache dir>/cache/…` | `<config>/` |
| G | 未設 | `''` | `<home>/.claude/plugins/` | 同 A | `<home>/.claude/` |
| H | 未設 | `'   '` | `<home>/.claude/plugins/` | 同 A | `<home>/.claude/` |
| E | 未設 | `~/pc` | `<home>/pc/` | `<home>/pc/cache/…` | `<home>/.claude/` |
| F | 未設 | `relpc`（相對） | `<cwd>/relpc/` | `<cwd>/relpc/cache/…` | `<home>/.claude/` |
| I | 未設（`CLAUDE_CODE_USE_COWORK_PLUGINS=1`） | 未設 | `<home>/.claude/cowork_plugins/` | `<home>/.claude/cowork_plugins/cache/…` | `<home>/.claude/cowork_settings.json` |
| J | 未設（`CLAUDE_CODE_USE_COWORK_PLUGINS=0`） | 未設 | 同 A | 同 A | 同 A |
| K | 未設（`CLAUDE_CODE_USE_COWORK_PLUGINS=1`） | 設 | `<cache dir>/` | `<cache dir>/cache/…` | `<home>/.claude/cowork_settings.json` |

- `installed_plugins.json`（v2）的 `installPath` 是 plugin 內容的絕對路徑（D：`…\D\plugcache\cache\t0760-local\ct\9.9.9`）。`extraKnownMarketplaces` 與 `enabledPlugins` 寫在 `settings.json`（設定目錄）。
- CLI 二進位原始碼對照（2.1.316）：plugins 根目錄函式 = `CLAUDE_CODE_PLUGIN_CACHE_DIR` 有值就用它（經路徑展開），否則 `join(<config>, 'plugins' | 'cowork_plugins')`；`installed_plugins.json` = `join(<plugins 根目錄>, 'installed_plugins.json')`。
- **與 CT 文件的比對**：CT `data-layer-architecture.md` 的說法（設了變數時整個 plugins 目錄含 `installed_plugins.json` 都在那裡）與實測**一致**；BAT 舊行為（只把 `cache/` 根目錄移過去）是錯的。CT 文件若沒寫到的補充供塔台轉告：`settings.json` 不跟著移；值為 `~/…` 會展開到家目錄、相對路徑以 CLI cwd 為準、全空白等同未設；Cowork 模式改用 `cowork_plugins` / `cowork_settings.json`。

**2. 修正**

- `electron/claude-config-dir.ts`：新增唯一實作 `resolveClaudePluginsDir(env, homeDir, cwd?, pathApi?)`：`CLAUDE_CODE_PLUGIN_CACHE_DIR` trim 後非空 → 用它（`~` / `~/…` → 家目錄、相對路徑有 cwd 時 `resolve(cwd, …)`），否則 `join(resolveClaudeConfigDir(...), 'plugins')`。`resolveClaudeConfigDir` 未改。
- `electron/ct-install-detect.ts`：新增 `claudePluginsDir(host, cwd?)`；`findClaudeCtPlugins` 從 `<plugins 目錄>/installed_plugins.json` 讀、`installPath` 缺時用 `<plugins 目錄>/cache/<mkt>/ct/<ver>`；`settings.json`（`enabledPlugins`）仍讀設定目錄。`claudeCtPluginSkillDirs`、`ctPluginTowerConfigCandidates`、`detectCtInstalls` 都經 `findClaudeCtPlugins`，自動跟上。
- `electron/claude-agent-manager.ts`：新增 `panelClaudePluginsDir(runtime, cwd?, homeDir?)`（env 同 `panelClaudeConfigDir` = spawn env）；`runQuery` 的 plugins 清單改讀 `panelClaudePluginsDir(resolvedRuntime, session.cwd)/installed_plugins.json`。
- `electron/handlers/ct-config.ts`：只改註解（預設值層與 `installs` 經 `ctPluginTowerConfigCandidates` / `detectCtInstalls` 已跟上，無程式改動）。
- 不設變數（含空字串 / 全空白）時路徑與修正前完全相同（測試守住）。

**3. 文件**：`docs/agent-guide/claude-agent-sdk-cli.md`「Claude 設定目錄」（規則、consumer、實測表、Cowork 等已知差異；刪掉原「已知限制」那條）、`docs/agent-guide/ct-plugin-install.md` 3-2 與驗證清單、`CLAUDE.md`「Claude Agent SDK / CLI」節的設定目錄那一行。

**變更檔案**：`electron/claude-config-dir.ts`、`electron/ct-install-detect.ts`、`electron/claude-agent-manager.ts`、`electron/handlers/ct-config.ts`、`electron/__tests__/claude-config-dir.test.ts`、`electron/__tests__/ct-install-detect.test.ts`、`electron/__tests__/ct-config-sources.test.ts`、`docs/agent-guide/claude-agent-sdk-cli.md`、`docs/agent-guide/ct-plugin-install.md`、`CLAUDE.md`

### 驗證

| 項目 | 結果 |
|---|---|
| 新 / 改單元測試（`claude-config-dir` / `ct-install-detect` / `ct-config-sources` / `claude-scan-skills-ct-plugin` / `ct-plugin-dispatch-prefix`） | PASS 114 / 114 |
| 以實測產出的真實檔案（情境 A–E）跑 `findClaudeCtPlugins`（暫時測試檔，跑完刪除） | PASS 5 / 5，皆找到 `ct@t0760-local` |
| 突變 1：`findClaudeCtPlugins` 改回舊邏輯（`<config>/plugins/installed_plugins.json` + cache 根目錄看變數） | 7 個測試失敗（ct-install-detect 5、ct-config-sources 1、source guard 1）→ 還原（`cmp` 確認） |
| 突變 2：面板改回 `panelClaudeConfigDir(...)/plugins/installed_plugins.json` | 2 個測試失敗（runQuery 路徑、source guard）→ 還原 |
| `npm run typecheck` | 0（exit 0） |
| `npm run typecheck:electron` | 0（exit 0，`error TS` 0 個） |
| `npm run test:unit`（主 checkout） | PASS：369 files，6588 passed / 10 skipped |
| `npx vite build`（`git archive eb5c0589` 匯出到 `%TEMP%\bat-T0760-build`，`node_modules` junction） | exit 0；跑完先刪 junction、再刪匯出目錄，主 checkout `node_modules/electron` 仍在 |
| e2e | 未跑（工單未要求；面板 plugins 載入只改路徑來源，單元測試＋source guard 守住） |

### 遭遇問題

- Git Bash 的 `/usr/bin/tar` 解不了 `C:\…` 路徑（`Cannot connect to C: resolve failed`），第一次 vite build 因此失敗（找不到 `index.html`）；改用 `%SystemRoot%\System32\tar.exe` 後正常。
- 第一次用 Python heredoc 改測試檔時 heredoc 被截斷、Python 語法錯誤，檔案沒有被寫入（`git diff --stat` 確認），改用 Edit 工具。
- 一次清理暫存目錄的 `rm -rf "$S/$n"` 被安全檢查擋下，改成每個情境用新的子目錄名，沒有刪除。
- 實測暫存檔留在 Worker scratchpad（`…\scratchpad\t0760\`），不在 repo 內。

### 互動紀錄

- 無（yolo，沒有需要問塔台的問題）。

### 後續候選

1. **Cowork 模式**（`CLAUDE_CODE_USE_COWORK_PLUGINS=1`，或 CLI 內部判定的 Cowork 環境）：CLI 改用 `<config>/cowork_plugins/` 與 `<config>/cowork_settings.json`，BAT 仍讀 `plugins` / `settings.json`（設 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時 plugins 部分已一致，`enabledPlugins` 仍會讀錯檔）。影響很小，建議塔台決定是否開單；本單已寫進 docs「已知差異」。
2. 相對路徑的 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 在沒有 cwd 的呼叫端（ct-config 預設值層、`claude:scan-star-commands`）會以 BAT 程序 cwd 解析，與 CLI 不同；設成相對路徑本身就少見，已寫進註解，未另處理。
3. 轉告 CT：實測與 CT `data-layer-architecture.md` 一致；可補「`settings.json` 不跟著移、`~` 展開、相對路徑以 CLI cwd 為準、Cowork 模式另有目錄」。

### 回報時間

- 2026-11-02T03:16:03+08:00
