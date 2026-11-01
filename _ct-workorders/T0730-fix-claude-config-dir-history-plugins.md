---
schema_version: 1
schema_kind: workorder
id: T0730
title: "BUG-178：Claude 面板讀 session 歷史 / session 清單 / plugins 時依 `CLAUDE_CONFIG_DIR`（未設才 `<home>/.claude`）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T11:51:27+0800"
started_at: "2026-11-01T12:12:53+08:00"
updated_at: "2026-11-01T12:25:18+08:00"
completed_at: "2026-11-01T12:25:18+08:00"
depends_on: [T0729]
related:
  - "BUG-178（T0727 回報區〈發現的問題〉2）；使用者 2026-11-01 第一百零二 session 選「兩個都現在修」"
  - "既有正確做法：`electron/handlers/claude.ts`、`electron/bat-mcp-launch.ts`、`electron/ct-install-detect.ts`（優先 `CLAUDE_CONFIG_DIR`）；T0711 回報區提到設定面板「預設值」層找手動安裝沒看 `CLAUDE_CONFIG_DIR`"
  - "`e2e/v072-pre6-claude-panel.spec.ts`（T0727 / T0729）"
affects_files:
  - electron/claude-agent-manager.ts
  - "electron/ 下共用的 Claude 設定目錄解析函式（新增或沿用既有的，位置由你決定並在回報說明）"
  - "electron/__tests__/（解析函式與 consumer 的測試）"
  - "T0711 提到的「預設值」層檔案（若確認同一問題）"
  - e2e/v072-pre6-claude-panel.spec.ts
  - CLAUDE.md
  - docs/agent-guide/claude-agent-sdk-cli.md
  - _ct-workorders/BUG-178-claude-history-ignores-claude-config-dir.md
  - _ct-workorders/T0730-fix-claude-config-dir-history-plugins.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 開工先 grep `electron/` 與 `src/` 中組 `.claude` 路徑的地方（`homedir()` 搭 `.claude`、`CLAUDE_CONFIG_DIR`），回報區列出完整清單與逐處處置（已正確 / 本單修 / 不屬 Claude 設定目錄不動）。"
  - "🔴 解析規則：`CLAUDE_CONFIG_DIR`（非空）優先，未設才 `<home>/.claude`；env 來源以實際 spawn CLI 的 env 為準（面板 session 的 spawn env，含 runtime 選擇後的值），不要只看主行程 `process.env` 而與 CLI 不一致。抽成單一函式，consumer 一律經它；與既有三處的規則若有差異，回報說明並統一（不改既有三處的對外行為，除非是同一個錯）。"
  - "🔴 行為不變：沒設 `CLAUDE_CONFIG_DIR` 的使用者讀到的路徑與現在完全相同。T0711 的「預設值」層若確認同一問題，一併修；若判斷不屬同一問題，寫在回報區由塔台決定。"
  - "🔴 驗證：e2e 新增情境：改用 `CLAUDE_CONFIG_DIR` 指到暫存目錄（HOME 仍隔離到另一個暫存目錄）時，④ resume 後歷史仍重建、plugins 從 `CLAUDE_CONFIG_DIR` 讀；T0727 / T0729 的既有情境仍綠。單元測試涵蓋設 / 未設 / 空字串。`npm run test:unit` 全過；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功。只用假 API、不耗 token；隔離規則同 T0727。"
  - "🔴 CLAUDE.md 若新增「唯一實作」規則，依檔頭撰寫規則只寫一兩句＋連結，細節寫 docs。BUG-178 修好後由你改 `FIXED`（附 commit 與驗證摘要）；`_bug-tracker.md` 由塔台重建，不要改。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。測試失敗輸出不得傾印整個 `process.env`。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0730 — BUG-178：Claude 面板依 `CLAUDE_CONFIG_DIR` 讀歷史與 plugins

## 元資料

- **工單編號**：T0730
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T11:51:27+0800
- **預估規模**：S

## 背景

T0727 發現 `loadSessionHistory`、`listSessionsFallback` 與 installed plugins 讀取固定用 `os.homedir()/.claude`，但 CLI 在設了 `CLAUDE_CONFIG_DIR` 時寫到該目錄；設了這個變數的使用者，分頁還原 / resume 時面板看不到舊訊息，plugins 也從錯的位置載入。使用者決定現在修（在 T0729 之後，同一檔案）。

## 範圍

1. 盤點並統一 Claude 設定目錄的解析。
2. 修正面板歷史、session 清單、plugins 讀取（及 T0711 預設值層，若同一問題）。
3. 單元測試＋e2e 情境；BUG-178 改 FIXED；docs / CLAUDE.md。

## 不做

- 不改沒設 `CLAUDE_CONFIG_DIR` 時的行為。
- 不碰 BUG-177（T0729）的改動。

## 驗收

- [ ] 路徑盤點清單與逐處處置
- [ ] `CLAUDE_CONFIG_DIR` e2e 情境綠，既有情境仍綠
- [ ] `test:unit` 全過、兩個 typecheck = 0、`vite build` 成功
- [ ] BUG-178 = FIXED

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**。BUG-178 → `FIXED`（等驗收）。產品 commit `6f7b3d53`。

### 落點檢查

- **PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1：工單在 `REPO_ROOT/_ct-workorders/` 底下。C-3：只供參考（C-0 已 PASS），`electron/claude-agent-manager.ts` 等可測路徑都存在。C-2：沒有 `branch` 欄位（在 `main`）。`CT_HOME` 沒設（不是 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只做紀錄）。

### 路徑盤點（`electron/`、`src/` 中組 `.claude` 路徑與讀 `CLAUDE_CONFIG_DIR` 的地方）

| 位置 | 讀什麼 | 處置 |
|---|---|---|
| `electron/claude-agent-manager.ts` `runQuery`（原 833） | `plugins/installed_plugins.json` | **本單修**：改經 `panelClaudeConfigDir(resolvedRuntime)` |
| `electron/claude-agent-manager.ts` `listSessionsFallback`（原 1799 / 1806 / 1807） | `projects/<encoded cwd>`（含 Windows 磁碟代號大小寫兩種候選） | **本單修**：`panelClaudeConfigDir()` |
| `electron/claude-agent-manager.ts` `loadSessionHistory`（原 1877） | `projects/<encoded cwd>/<id>.jsonl` | **本單修**：`panelClaudeConfigDir()` |
| `electron/handlers/claude.ts` `claude:get-statusline-extras`（原 428） | `account-label.txt`、`cache/…` | **已大致正確，改成共用函式**：原本 `process.env.CLAUDE_CONFIG_DIR \|\| …`，與另兩處差在不 trim（全空白值會被當成路徑），env 也改用 `deps.env ?? process.env`（Electron 主行程沒傳 `env`，結果同 `process.env`） |
| `electron/handlers/claude.ts` `claude:scan-skills`（原 324 / 349）、`claude:scan-star-commands`（原 389） | 使用者 `commands/`、`skills/` | **本單修**（同一個錯：claude 從 `<CLAUDE_CONFIG_DIR>/skills`、`commands` 載入使用者 skill，同檔的 `ct@*` plugin 掃描早已看 `CLAUDE_CONFIG_DIR`）。這個檔案不在 `affects_files` 的明列項目裡，但屬於工單「既有三處」之一，依「統一」與盤點規則處理；未設變數時路徑不變 |
| `electron/handlers/ct-config.ts` `ctConfigCandidates` 預設值層（原 51） | Claude 手動安裝的 `skills/control-tower/references/tower-config.md` | **本單修**（T0711 記下的差異，判定為同一個錯）：改為 `claudeConfigDir({ homeDir, env })`，與 `detectCtInstalls` 一致 |
| `electron/handlers/ct-config.ts` global 層（47 / 48） | `control-tower-data/config.yaml`、舊 `control-tower-config.yaml` | **不屬 Claude 設定目錄，不動**：CT 自己的資料路徑，CT `tower-config.md` 寫死 `~/.claude/control-tower-data`，不隨 `CLAUDE_CONFIG_DIR` 移動 |
| `electron/bat-mcp-launch.ts` `defaultClaudeSettingsFiles`（189） | `settings.json` | **已正確**，改呼叫共用函式（行為不變） |
| `electron/ct-install-detect.ts` `claudeConfigDir`（254–257） | CT 手動安裝、`ct@*` plugin | **已正確**，改為委派共用函式（行為不變） |
| `electron/remote-tools/probe-script.ts`（153） | 遠端 `.credentials.json`（shell `${CLAUDE_CONFIG_DIR:-$HOME/.claude}`） | **已正確**（shell 端，`:-` 空值也回預設；不 trim 全空白，影響可忽略），不動 |
| `electron/claude-resolver.ts`（159 / 167 / 174）、`electron/node-resolver.ts`（56） | `<home>/.claude/local`（舊版 claude 本機安裝的 binary / node） | **不屬 Claude 設定目錄，不動**（binary 安裝位置） |
| `electron/worktree-manager.ts`（146 / 174）、`handlers/claude.ts` project scope（323 / 346） | 專案 `<cwd>/.claude` | **不屬，不動** |
| `src/`（`ClaudeAgentPanel.tsx`、`SkillsPanel.tsx`、`types/ct-config-sources.ts`、`types/index.ts`） | 只有註解 / 說明文字，沒有組路徑 | 不動 |
| SDK `listSessions`（主行程內呼叫） | SDK 自己讀 `process.env.CLAUDE_CONFIG_DIR`（`sdk.mjs`：`(CLAUDE_CONFIG_DIR ?? join(homedir(),'.claude')).normalize('NFC')`） | 與 spawn env 相同，不需改 |

### 實作摘要

- 共用函式放在新檔 `electron/claude-config-dir.ts`：`resolveClaudeConfigDir(env, homeDir = os.homedir(), join = path.join)`。規則沿用既有兩處（`bat-mcp-launch.ts` / `ct-install-detect.ts`）：`CLAUDE_CONFIG_DIR?.trim()` 非空就用（回傳 trim 後的值），否則 `join(homeDir, '.claude')`。不 import electron。
- `panelClaudeConfigDir(runtime = { source: 'embedded' }, homeDir?)`（`electron/claude-agent-manager.ts`）：env = `sdkSpawnEnv(runtime).env ?? process.env`，也就是面板實際 spawn CLI 的 env（SDK 在 `env` 沒給時用 `process.env`）。`runQuery` 傳已解出的 `resolvedRuntime`；歷史與清單路徑沒有 runtime（為了不觸發 runtime 解析的 toast 事件），所以不傳。`sdkSpawnEnv` 兩種 runtime 都不動 `CLAUDE_CONFIG_DIR`，答案相同，單元測試守住這個前提。
- 與 CLI 的已知差異（刻意保留，寫進 docs）：CLI 對空字串 / 全空白照用（相對路徑）並做 NFC 正規化；BAT 回到 `<home>/.claude`、不做 NFC，以符合「沒設變數的使用者路徑完全不變」。
- 文件：`docs/agent-guide/claude-agent-sdk-cli.md` 新增「Claude 設定目錄」節（規則、env 來源表、例外、與 CLI 差異、已知限制、驗證）；`CLAUDE.md`「Claude Agent SDK / CLI」節加一行唯一實作規則＋連結。
- e2e 檔頭原本寫「BAT reads `os.homedir()/.claude`, not CLAUDE_CONFIG_DIR」，已更新。

### 驗收結果

| 項目 | 結果 | 證據 |
|---|---|---|
| 路徑盤點與逐處處置 | PASS | 上表 |
| e2e `CLAUDE_CONFIG_DIR` 情境 | PASS | `npx playwright test e2e/v072-pre6-claude-panel.spec.ts`：**2 passed**（21.6 s，最終程式碼上再跑一次 21.3 s 仍 2 passed）。⑪ session 檔 `<CLAUDE_CONFIG_DIR>/projects/C--ProgramData-bat-e2e-t0730-…-ws/<uuid>.jsonl`、暫存 home `.claude/projects` 無檔；`listSessions` 找得到；BAT 日誌 `[Claude] Loaded 1 plugins: t0730-cfg/0.0.1`（暫存 home 的誘餌 `t0730-home` 沒載）。⑫ 重開後 resume，使用者提問與回答都重建，restore 期間 0 個模型請求。proxy 對外嘗試 `[]` |
| 既有 T0727 / T0729 情境 | PASS | 同一次執行的第一個 test（①–⑩）綠：④ 重開後清單重建、⑩ 查模型清單 0 請求 |
| 負向對照 | 有抓到 | 暫時換回 HEAD 的 `claude-agent-manager.ts` 建置後：⑪ 失敗（日誌 `Loaded 1 plugins: t0730-home/0.0.1`，讀到暫存 home 的誘餌）；另用去掉 plugin 斷言的暫存 spec 副本跑，⑫ 在重開後等不到歷史文字而失敗。之後檔案還原（`cmp` 一致）、暫存 spec 已刪、重新 `vite build` |
| 單元測試涵蓋設 / 未設 / 空字串 | PASS | `electron/__tests__/claude-config-dir.test.ts` 15 tests：函式（未設 / `''` / 全空白 / 設定值含前後空白 / win32 與 posix join）、既有 consumer 規則一致、兩種 runtime 的 spawn env、`loadSessionHistory` / `listSessionsFallback` 讀 `CLAUDE_CONFIG_DIR`（未設時的對照）、scan-skills / star commands / statusline extras、ct-config 預設值層與 global 層、source guard（`electron/` + `src/` 不得手寫 `<home>/.claude`，例外：本函式、`claude-resolver.ts` / `node-resolver.ts` 的 `local`、ct-config global 層兩行） |
| `npm run test:unit` | PASS | 352 檔全過（6277 passed / 3 skipped） |
| `npm run typecheck` | PASS | 0 |
| `npm run typecheck:electron` | PASS | 0 |
| `npx vite build` | PASS | 成功 |
| BUG-178 | FIXED | 已改 `status: FIXED` 並補〈修正〉節；`_bug-tracker.md` 未動（由塔台重建） |

只用假 API（`e2e/fixtures/fake-anthropic-api.ts`），不耗 token；隔離同 T0727（暫存 USERPROFILE / HOME、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、擋對外 proxy、工作區放 `%ProgramData%`）。內嵌 claude CLI 2.1.316。測試輸出沒有傾印 `process.env`。

### 改動檔案

- 新增：`electron/claude-config-dir.ts`、`electron/__tests__/claude-config-dir.test.ts`
- 修改：`electron/claude-agent-manager.ts`、`electron/handlers/claude.ts`、`electron/handlers/ct-config.ts`、`electron/bat-mcp-launch.ts`、`electron/ct-install-detect.ts`、`e2e/v072-pre6-claude-panel.spec.ts`、`CLAUDE.md`、`docs/agent-guide/claude-agent-sdk-cli.md`
- 工單類：`_ct-workorders/BUG-178-claude-history-ignores-claude-config-dir.md`、本工單

### Commit

- 產品：`6f7b3d53` fix(claude): read history, session list and plugins from CLAUDE_CONFIG_DIR (T0730, BUG-178)
- 工單 / BUG-178：本次收尾 commit（`git commit --only`）
- 沒有 push、沒有發版、沒有改 CHANGELOG。BUG-177（T0729）的改動沒有碰。

### 偏離與說明

- `electron/handlers/claude.ts` 不在 `affects_files` 的明列項目，但工單把它列為「既有三處」之一，要求統一規則；scan-skills / star commands 的使用者目錄是同一個錯，一併修。若塔台認為這兩處應另開單，可只回退那兩行（statusline extras 那行屬統一範圍）。

### 發現的問題 / 後續候選（交塔台決定）

1. `CLAUDE_CODE_PLUGIN_CACHE_DIR`：CT `data-layer-architecture.md` 記載設了它時整個 plugins 目錄（含 `installed_plugins.json`）都在那裡（T0357 / T0374 實測），但 BAT 的 `findClaudeCtPlugins` 與面板 plugins 清單都在 `<config>/plugins/installed_plugins.json` 找，只有 cache 根目錄跟著該變數。本單沿用 T0710 規則沒改；要對齊需另開單並實測 CLI 2.1.316 的行為。
2. 與 CLI 的空白值 / NFC 差異：見〈實作摘要〉，屬刻意保留，已寫進 docs。

### 互動紀錄

- 無（yolo；沒有需要問塔台的判讀問題）。

### 回報時間

2026-11-01T12:25:18+08:00
