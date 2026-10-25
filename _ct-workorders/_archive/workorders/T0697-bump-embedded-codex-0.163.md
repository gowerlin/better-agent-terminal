---
schema_version: 1
schema_kind: workorder
id: T0697
title: "內嵌 codex 追版：@openai/codex-sdk ^0.160.0 → ^0.163.0（含 @openai/codex 與平台子套件），核對原生 binary 路徑解析、Codex 面板、BAT MCP / OSC 7501 / daemon 整合點"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-10-22T01:44:28+0800"
updated_at: "2026-10-22T01:55:19+08:00"
started_at: "2026-10-22T01:45:32+08:00"
completed_at: "2026-10-22T01:55:19+08:00"
commit: 3bdd34eb
target_version: "0.7.1-pre.6"
depends_on: []
related:
  - "D181（`v0.7.1-pre.6` 發版批次）：塔台 2026-10-22 01:4x 查 `npm view @openai/codex-sdk version` = 0.163.0，實裝 `@openai/codex-sdk` / `@openai/codex` 0.160.0；使用者選「加 codex 追版再發」"
  - "T0690（內嵌 claude CLI 追版 2.1.306）：步驟、lock 只動目標套件的做法、驗證項目與證據格式都照它做"
  - "`electron/codex-agent-manager.ts`（`@openai/codex-sdk` 動態 import、原生 binary 路徑 `@openai/codex-<platform>-<arch>/vendor/<triple>/bin/codex[.exe]`（>= 0.160））、`electron/codex-bundled-path.ts`（註解：沿用 SDK 0.160 `resolveNativePackage()` / `prependPathDirs()`）"
  - "CLAUDE.md「BAT MCP shim」節：codex 升版時必跑 `e2e/t0592-codex-tower-worker.spec.ts`；codex 共用 daemon（T0648 / T0651）升版時查 `tui/src/daemon_startup.rs` `config_exclusion`。「blocked 狀態偵測」/「Worker 啟動確認」節：codex OSC 7501 需 `>= 0.163.0`，codex 升版時必跑 `e2e/t0621-codex-osc-state.spec.ts`"
  - "`docs/agent-guide/usage-limit-continue.md`：用量限制句型取自 codex-cli 0.160.0 / 0.162.1 binary（T0564）"
affects_files:
  - package.json
  - package-lock.json
  - CLAUDE.md
  - docs/agent-guide/
  - electron/codex-agent-manager.ts
  - electron/codex-bundled-path.ts
  - electron/__tests__/
  - src/lib/usage-limit.ts
  - src/lib/__tests__/
  - scripts/verify-native-modules.js
  - scripts/verify-packaged-native.js
  - scripts/__tests__/
  - e2e/
  - _ct-workorders/T0697-bump-embedded-codex-0.163.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權修改 `package.json` 的 `@openai/codex-sdk` 版本與對應 `package-lock.json`（含 `@openai/codex` 與 `@openai/codex-*` 平台子套件）；其他相依**不得**連帶升版：lock diff 只能涉及 codex 系列與 root `dependencies` 那一行，npm 產生的 `peer` 等旗標雜訊比照 T0541 / T0690 以移植方式去掉，回報區附 `git diff --stat package-lock.json` 與逐套件比對。"
  - "🔴 `package.json` 的 `version` 欄位不動（塔台發版時另行處理）；`@anthropic-ai/*` 不動。"
  - "🔴 開工時再查一次 `npm view @openai/codex-sdk dist-tags` / `time` 與 `npm view @openai/codex dist-tags`；latest 若已高於 0.163.0，取當下 latest 並在回報區說明；SDK 與 codex 版本不一致時以 SDK 的 dependency 為準。"
  - "🔴 核對新版變化（官方 release notes / CHANGELOG 0.161 起各版、套件內容、binary 字串；附證據）：① 原生 binary 的套件目錄結構仍符合 `codex-bundled-path.ts` / `codex-agent-manager.ts` 的解析（含 legacy 分支），`verify-native-modules.js` / `verify-packaged-native.js` 若有 codex 檢查項同步核對；② SDK API（`codex-agent-manager.ts` 用到的 export 與選項）沒有破壞性變動；③ BAT 整合點：`-c mcp_servers.bat.*`（含 `env_vars`）、`--no-daemon`（`codexNoDaemonDecision`）、`tui/src/daemon_startup.rs` 的 `config_exclusion`、`-c check_for_update_on_startup=false`、OSC 7501 序列格式（`src/lib/codex-terminal-state.ts`）、`src/lib/usage-limit.ts` 的 codex 句型仍出現在新 binary。任何一項有變動而會影響 BAT 時，先用 BAT 通道問塔台，不要自行改產品行為。"
  - "🔴 測試、註解、docs 中寫死 `0.160.0` 的地方：區分「代表內嵌實裝版本」（更新）與「歷史實測紀錄 / 任意測試字串 / 版本門檻」（不動，例如 `>= 0.156.0`、`>= 0.163.0` 門檻與 T0586 / T0592 的實測敘述），回報區逐一列出處置。"
  - "🔴 驗證：內嵌 codex 原生 binary `--version` = 新版；`node scripts/verify-native-modules.js` exit 0；`npm run test:unit` 全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；e2e `e2e/t0592-codex-tower-worker.spec.ts` 與 `e2e/t0621-codex-osc-state.spec.ts`（需先 `npx vite build`，CLAUDE.md 規定 codex 升版必跑）綠。e2e 只用隔離實例；不得以預設實例（無 `--runtime`）啟動 source build；不碰使用者正在用的 BAT 與其 userData；不開會耗 token 的 codex turn。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），本單原則上不需要 gh。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`，scratchpad 路徑也一樣。yolo：不得問使用者，判讀問題問塔台。"
---

# T0697 — 內嵌 codex 追版 0.163

## 背景

- 內嵌 `@openai/codex-sdk` / `@openai/codex` 實裝 `0.160.0`；塔台 2026-10-22 01:4x 查 `npm view @openai/codex-sdk version` = `0.163.0`。
- 內嵌 codex 供 Codex 面板（SDK 路線）與 e2e（T0592 app-server）使用；codex CLI 分頁用系統 codex，不受影響。
- 本單完成、塔台聯合驗證後即發 `v0.7.1-pre.6`（D181），與 BUG-169（T0691）、T0692、T0694 同批。

## 實作

照 T0690「實作」1–6 的做法，對象換成 codex：

1. 開工時再查 latest（見 `memory_overrides` 第 3 條）。
2. `package.json` 改 `@openai/codex-sdk` 為 `^<新版>`；更新 lock；lock diff 只含 codex 系列。
3. 內嵌原生 binary `--version`、`verify-native-modules`。
4. 核對新版變化（見 `memory_overrides` 第 4 條，含原生路徑解析、SDK API、BAT 整合點與 `usage-limit.ts` 句型）。
5. 寫死 `0.160.0` 的測試 / 註解 / docs 逐一處置。
6. CLAUDE.md 與 docs 更新內嵌實裝版本（歷史實測敘述保留）。

## 驗收

- [x] 內嵌 codex `--version` = 新版；`verify-native-modules` ✅
- [x] lock diff 只涉及 codex 系列（附 diff 摘要與逐套件比對）
- [x] `npm run test:unit`、`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [x] e2e t0592 / t0621 綠
- [x] 原生路徑解析 / SDK API / BAT 整合點 / `usage-limit.ts` 句型的核對結果（有改或無改都附證據）
- [x] 回報區列出需實機驗證的項目（mac / Linux 內嵌 codex 由 pre.6 CI 的 `verify-packaged-native` 確認；Codex 面板實際對話需真人）

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

無。核對項目都沒有會影響 BAT 的變動，沒有向塔台提問。

### 完成狀態

**DONE**：內嵌 `@openai/codex-sdk` / `@openai/codex`（含 6 個平台子套件）從 `0.160.0` 升到 `0.163.0`。原生 binary 路徑、SDK API、BAT 整合點、`usage-limit.ts` 句型都核對過，沒有需要改產品行為的變動。產品程式碼只改了一行註解。驗收 6 項全部 PASS。

- **Landing Zone**：PASS。
  - C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，相同 ✅（`CT_HOME` 未設，不是 worktree）
  - C-1：PASS（工單在 `REPO_ROOT/_ct-workorders/`）
  - C-3：PASS（前 5 筆非萬用字元的 `affects_files` 都存在）
  - C-2：工單沒有 `branch` 欄位（HEAD = `main`）
  - `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只當證據記錄）
- **派發模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- **環境**：npm 12.2.0、Node v24.22.1。

### 版本與 lock

- 開工時查 dist-tags：
  - `@openai/codex-sdk`：`latest: '0.163.0'`、`alpha: '0.164.0-alpha.9'`
  - `@openai/codex`：`latest: '0.163.0'`，平台 tag（`win32-x64` 等）都是 `0.163.0-<platform>`
  - latest 仍是 0.163.0，照用。0.164 只有 alpha，不採用。
- 發佈時間（npm `time`，`@openai/codex-sdk`）：0.160.1 = `2026-10-05T18:33:57Z`、0.161.0 = `2026-10-07T16:03:43Z`、0.162.0 = `2026-10-08T19:03:04Z`、0.162.1 = `2026-10-09T19:51:57Z`、0.163.0 = `2026-10-15T21:37:13Z`。
- `npm view @openai/codex-sdk@0.163.0 dependencies` = `{ '@openai/codex': '0.163.0' }`，SDK 與 codex 版本一致。
- `package.json`：`@openai/codex-sdk` 從 `^0.160.0` 改為 `^0.163.0`。`version` 欄位與 `@anthropic-ai/*` 都沒動。
- 執行 `npm install "@openai/codex-sdk@^0.163.0"`，結尾只剩預期中的 `electron-winstaller` 未放行警告。
- **lock 處理**（比照 T0690）：
  - npm 原生產出的 lock 是 `56 insertions(+), 63 deletions(-)`：REAL 9，另有 META-ONLY 43（只動 `peer` 等旗標，屬雜訊）。
  - 用 scratchpad 的 `transplant.mjs`，以 HEAD 的 lock 為底，只移植兩樣：`node_modules/@openai/codex*` 的 8 個條目，以及 root `packages[""].dependencies` 的 `@openai/codex-sdk` 那一行。
  - `git diff --stat package-lock.json` = `1 file changed, 32 insertions(+), 32 deletions(-)`。
- **逐套件比對**（`lockcmp.mjs`，HEAD 對移植後）：`REAL 9  META-ONLY 0`
  - `(root) dependencies: @openai/codex-sdk: ^0.160.0 -> ^0.163.0`
  - `@openai/codex-sdk`：version / resolved / integrity / dependencies（0.160.0 → 0.163.0）
  - `@openai/codex`：version / resolved / integrity / optionalDependencies（0.160.0 → 0.163.0）
  - 6 個平台子套件只動 version / resolved / integrity（`0.160.0-<p>` → `0.163.0-<p>`）：`codex-darwin-arm64`、`-darwin-x64`、`-linux-arm64`、`-linux-x64`、`-win32-arm64`、`-win32-x64`。與升版前是同一組 6 個，沒有新增或移除。
- **重產比對**：把 `package.json` 與移植後的 lock 複製到 scratchpad，跑 `npm install --package-lock-only --ignore-scripts`（exit 0），結果 `REAL 0  META-ONLY 43`，實質差異 0。

### 核對結果

證據來源：
- ① npm 套件內容：舊版從升版前的 `node_modules` 備份；平台包用 `npm pack @openai/codex@<v>-<p> --dry-run --json` 比對檔案清單。
- ② 官方 release notes：`gh api repos/openai/codex/releases/tags/rust-v0.160.1 … rust-v0.163.0`，2026-10-22 擷取。
- ③ codex 原始碼：`codex-rs/tui/src/daemon_startup.rs`，取 `rust-v0.160.0` 與 `rust-v0.163.0` 兩個 tag。
- ④ binary 字串比對：舊 `codex.exe` 0.160.0（326,872,368 bytes）對內嵌 0.163.0（341,270,320 bytes），逐字串計數並抽前後文（`strcount.mjs`）。
- ⑤ 實際執行：隔離空的 `CODEX_HOME`，只跑 `--help`、`mcp get` 與 `mcp list`，不開 turn。

**① 原生 binary 路徑解析：沒有變動**
- 內嵌 `vendor/x86_64-pc-windows-msvc/codex-package.json` 兩版只差 `version`：`layoutVersion: 1`、`entrypoint: "bin/codex.exe"`、`pathDir: "codex-path"`、`resourcesDir: "codex-resources"`。
- win32-x64 安裝後的檔案清單（47 檔）兩版相同。`resolveBundledCodexLayout` 的 >= 0.160 分支（`bin/<exe>` + `codex-package.json` + `codex-path/`）照樣命中，legacy 分支沒用到也不受影響。
- 6 個平台包的 `npm pack --dry-run` 清單：
  - win32-x64 / win32-arm64：相同。
  - linux-x64 / linux-arm64 / darwin-x64 / darwin-arm64：只少了 `vendor/<triple>/codex-resources/zsh/bin/zsh`，對應 ② 0.163.0「no longer bundles a patched `zsh`」（#52160 / #52213）。
  - `bin/codex`、`codex-package.json`、`codex-path/rg` 都還在。BAT 沒有任何地方引用 `codex-resources` / zsh（全 repo grep 0 筆）。
- `scripts/verify-packaged-native.js` 的 `dynamicRuntimePackages` 只檢查 `@openai/codex-${platform}-${arch}` 套件存在，與版本無關，不需要改。`scripts/verify-native-modules.js` 沒有 codex 檢查項。
- `@openai/codex` wrapper：只有 `package.json` 的 version 與 optionalDependencies 版本號改了，`bin/codex.js` 相同。

**② SDK API：沒有破壞性變動**
- `dist/index.d.ts` 的 diff 只是新增：`type CyberAccessProgram = "standard" | "daybreak_blue" | "daybreak_red"`、`TurnOptions.cyberAccessProgram?`，並 export 這個型別。
- `dist/index.js` 的 diff 只有把 `cyberAccessProgram` 轉成 `--cyber-access-program` 的 3 行。`resolveNativePackage()` / `prependPathDirs()` 沒變（所以 `codex-bundled-path.ts` 的鏡像仍然正確）。
- BAT 用到的 `Codex`（`codexPathOverride` / `config` / `env`）、`startThread` / `resumeThread`（`workingDirectory` / `sandboxMode` / `approvalPolicy` / `modelReasoningEffort` / `skipGitRepoCheck` / `model`）、`runStreamed(input, { signal })`，以及事件類型 `thread.started` / `turn.*` / `item.*` / `error`，都沒變。BAT 不使用 `cyberAccessProgram`。

**③ BAT 整合點：沒有變動**
- `-c mcp_servers.bat.*`（含 `env_vars`、`tool_timeout_sec`）：用 BAT 自己的 `codexMcpOverrides()` 組出 `-c`，交給兩版 `codex mcp get bat --json`，輸出逐字相同。`transport.env_vars` 列出 9 個名稱，`tool_timeout_sec: 60.0`，`env: null`。
- `--no-daemon`：兩版 `codex --help` 除了 `CODEX_HOME` 路徑的警告行之外逐字相同，`--no-daemon`（第 131 行）與 `-c, --config <key=value>` 都還在。`codexNoDaemonDecision` 的門檻 `>= 0.156.0` 不受影響。
- `config_exclusion`（③）：`config_exclusion()` 與 `allowed_feature()` 的函式本體在 0.160.0 → 0.163.0 **逐字相同**（diff 為空）。非 `features.<允許清單>` 的 `-c` 仍會讓 codex 不連既有 daemon、也不自動啟動，所以 BAT「靠非 `features.*` 的 `-c` 走 embedded」的不變式仍成立；`mcp_servers.*` 沒有被改成轉送給 daemon。
  - 同檔另外兩處變動不影響 BAT：0.162.1 / 0.163.0（#52648）的 daemon 相容檢查改成只看命令列明確的 feature 覆寫；elevated Windows 在 discovery 前就走 embedded。
  - ④ `command-line configuration overrides (-c, --enable, --disable, or --search)` 1→1。
- `-c check_for_update_on_startup=false`：0.163.0 接受（`mcp list` exit 0）；同鍵給字串值 `"x"` 則 `failed to load bootstrap configuration` exit 1，表示這個鍵仍是有型別檢查的有效設定。
- OSC 7501（`src/lib/codex-terminal-state.ts`）：④ 0.163.0 binary 內有 `]7501;state=…:app=codex` + `ESC \`，以及 `]7501;state=clear`，狀態字串 `idle` / `working` / `blocked` 相鄰。舊版 0 次、新版 2 次，與 `CODEX_OSC_MIN_VERSION = '0.163.0'`、parser 的格式一致。e2e t0621 對內嵌 binary 實測通過（見「驗證證據」）。
- `env_vars` 49→50、`daemon_auto_start` 7→11、`no-daemon` 10→12、`check_for_update_on_startup` 16→18、`shell_environment_policy` 24→23、`tool_timeout_sec` 20→19：只是計數變化，行為以上面的 `mcp get`、`--help` 實測與 e2e t0592 為準（worker 的 codex `command/exec` 子程序在預設 sandbox 下仍看得到全部 `BAT_*`，`tokenIsCapability: true`）。

**④ `usage-limit.ts` 的 codex 句型：仍在新 binary，沒有變動**
- 計數兩版相同：`ve hit your usage limit` 7、`Try again at` 1、`try again later` 1、`Your workspace is out of credits` 4、`You hit your spend cap` 2、`Usage limit reached. You` 1、`ve reached your usage limit` 1、`re out of credits.` 1。
- 抽前後文看，唯一的差異是購買額度的 URL 從 `https://chatgpt.com/codex/settings/usage` 改成 `https://chatgpt.com/settings/usage`。句子本身（`You've hit your usage limit. Visit … to purchase more credits.`）沒變，`CODEX_LIMIT_RE` / `CODEX_BLOCKED_RE` / `CODEX_TRY_AT_RE` 都不比對 URL，所以 `src/lib/usage-limit.ts` 與測試都沒改。

**⑤ release notes（0.160.1 – 0.163.0）裡其他與 BAT 相關的條目，都不需要改 BAT**
- 0.160.1 / 0.162.0（#50129）：remote stdio MCP server 保留 Windows env。BAT 的 shim 是 local stdio，不受影響。
- 0.161.0（#49855）：elevated Windows terminal 可用 embedded server。BAT elevated 時的 `-c features.daemon_auto_start=false` 照加，無害（docs 已記載）。
- 0.161.0 / 0.163.0：Daybreak / Cyber access program（SDK 新增可選欄位，0.163 對合格帳號預設開啟）。BAT 不設定。
- 0.162.0（#50555）：WSL 的 DrvFS `CODEX_HOME` 不自動啟動 daemon。對 BAT 只會讓 embedded 的情況變多。
- 0.163.0（#52725）：`Report terminal program status with OSC 7501`，就是 BAT 已依賴的那個序列（T0619 / T0621）。

### 寫死版本的處置

| 位置 | 性質 | 處置 |
|---|---|---|
| `electron/codex-bundled-path.ts:5` | SDK 鏡像來源的版本 | 補「unchanged in 0.163, T0697」。`resolveNativePackage()` / `prependPathDirs()` 經 ② diff 確認沒變 |
| `electron/codex-bundled-path.ts:17`、`electron/codex-agent-manager.ts:120`、`electron/__tests__/codex-bundled-path.test.ts:17 / :25` | 版面門檻 `>= 0.160` | 不動 |
| `electron/agent-runtime/agent-registry.ts:266`、`electron/windows-elevation.ts:4` | 「0.160+」的歷史行為門檻 | 不動 |
| `electron/codex-runtime-resolver.ts:57`、`electron/__tests__/codex-runtime-resolver.test.ts`、`electron/remote-tools/__tests__/parse.test.ts:308 / :320 / :373`、`electron/__tests__/codex-osc-state.test.ts:497 / :507`、`src/lib/__tests__/codex-terminal-state.test.ts:136` | 任意測試字串 / 範例 | 不動 |
| `src/lib/codex-terminal-state.ts:20`（`CODEX_OSC_MIN_VERSION = '0.163.0'`）、`docs/agent-guide/bat-mcp-shim.md:63`（`>= 0.156.0` 等） | 版本門檻 | 不動 |
| `src/lib/usage-limit.ts:15`、`src/lib/__tests__/usage-limit.test.ts:4`、`docs/agent-guide/usage-limit-continue.md:9` | T0564 讀句型時的來源版本（歷史） | 不動；0.163.0 句型相同（見 ④） |
| `src/lib/__tests__/codex-error-classify.test.ts:8 / :86` | T0369 / T0370 的 CLI 0.160 實測字串（歷史） | 不動 |
| `docs/agent-guide/bat-mcp-shim.md:33 / :34 / :40` | T0584 / T0586 的實測紀錄 | 不動 |
| `docs/agent-guide/bat-mcp-shim.md:41`（T0592 e2e「內嵌 codex 0.160.0 `app-server`」；「內嵌 0.160.0 預設保留名稱含 `KEY` / `SECRET` / `TOKEN`」） | 歷史實測，但也描述目前內嵌版本的行為 | 歷史敘述保留，各補一句：「T0697 以內嵌 0.163.0 重跑通過」、「0.160.0 / 0.163.0（T0697 e2e）」 |
| `CLAUDE.md`「BAT MCP shim」節（codex 升版必跑 t0592 那句） | 原本沒有內嵌 codex 版本行 | 在該句補「內嵌 `@openai/codex-sdk` / `@openai/codex` 目前 `0.163.0`，T0697」，一句話，不新增小節 |

### 驗證證據

| AC | 結果 | 證據 |
|---|---|---|
| 內嵌 `--version`、`verify-native-modules` | ✅ PASS | `node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe --version` = `codex-cli 0.163.0`；`node scripts/verify-native-modules.js` exit 0（`All 2 required native modules present … embedded claude: native`） |
| lock diff 只涉及 codex 系列 | ✅ PASS | `32 insertions(+), 32 deletions(-)`；`REAL 9  META-ONLY 0`（root 一行 + 8 個 codex 條目）；重產比對 `REAL 0` |
| unit / legacy / build / typecheck | ✅ PASS | 見下方清單 |
| e2e t0592 / t0621 | ✅ PASS | 見下方清單 |
| 路徑 / SDK / 整合點 / 句型核對 | ✅ PASS | 「核對結果」①–⑤ |
| 列出需實機驗證的項目 | ✅ | 見「需實機驗證」 |

第三、四項明細。驗證時 HEAD 為 `2d170a0b` 加上本單的工作區變更；之後只在 commit `3bdd34eb` 前補了 `bat-mcp-shim.md` 兩句文件，程式內容與驗證時相同。
- `npm run test:unit` exit 0：`Test Files 329 passed (329)`，`Tests 5857 passed | 3 skipped (5860)`。
- `npm run test:legacy` exit 0：`legacy tests: files 33 passed, 0 failed / 33 total; tests 472 passed, 0 failed`。
- `npx vite build` exit 0。
- `npm run typecheck` exit 0；`npm run typecheck:electron` exit 0。
- e2e `e2e/t0592-codex-tower-worker.spec.ts`：`2 passed (16.7s)`，用內嵌 0.163.0 的 `app-server`。
  - worker / tower argv 含 `mcp_servers.bat.*`（含 `env_vars`）與 `check_for_update_on_startup=false`。
  - worker 的 codex 預設 sandbox 下，`BAT_*` 8 項都在、`tokenIsCapability: true`、`net: connected`。
  - 隔離 runtime 的 Terminal Server 已結束，userData 已刪除。
- e2e `e2e/t0621-codex-osc-state.spec.ts` 跑了兩次，都是 `1 passed (23.7s)`：
  - (a) 預設挑選：spec 先找到安裝版 `<使用者資料夾>\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe`（0.163.0）。
  - (b) `BAT_E2E_CODEX=<repo>\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe`，即內嵌 0.163.0。結果：`--wait-started (trusted)` 回 `started` 1402 ms；`bat_get_state` 依序 `blocked (input)` / `source: osc` → `working`；`--wait-started (untrusted)` exit 8；`[codex-version] … version=0.163.0 (probed)`。
  - 模型請求只打到 spec 自己的本機假模型（`fake model requests: ["POST /v1/responses" ×2]`），不耗 token。
  - 兩次都是隔離 runtime，teardown 後 Terminal Server 已結束、userData 已刪除。
- e2e 都用 `e2e/fixtures/electron-isolation.ts` 的隔離實例（`--runtime=e2e-…`、獨立 userData 與 remote port），沒有以預設實例啟動 source build，也沒碰使用者正在用的 BAT 與它的 userData。

### 需實機驗證

- **mac / Linux 內嵌 codex**：由 pre.6 CI 的 `verify-packaged-native`（`runtime-require` / `@openai/codex-<platform>-<arch>`）加上實機，確認 `vendor/<triple>/bin/codex --version` = `0.163.0`。這兩個平台的套件少了 `codex-resources/zsh/bin/zsh`，屬預期（上游不再隨附），BAT 沒有引用。
- **Windows 安裝版**：NSIS 完整重裝後，`resources/app.asar.unpacked/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe --version` 應為 `codex-cli 0.163.0`。
- **Codex 面板（SDK 路線）實際對話**：需要真人與 ChatGPT 登入，本單沒有開任何 turn。要確認新 session 能對話、`runStreamed` 事件正常顯示、resume thread 正常。0.163 對合格帳號預設開啟 Daybreak，BAT 沒有設定 `cyberAccessProgram`，留意面板是否出現新的事件或錯誤類型。
- **Codex CLI 分頁 / Worker**：分頁用系統 codex，不受本單影響。若使用者的系統 codex 也升到 0.163，codex Tower / Worker 流程照 D153「歡迎協助測試」請使用者回報。

### 遭遇問題

1. 第一次用內嵌 binary 跑 t0621 時，我傳的 `BAT_E2E_CODEX` 用了正斜線路徑（`pwd -W` 的輸出）。spec 比對分頁 shell 解析出的路徑字串時，因為斜線不同而失敗（`…/bin\codex.exe` vs `…/bin/codex.exe`）。這是我給的參數格式問題，與 codex 版本無關；改用 `cygpath -w` 產生的反斜線路徑後重跑通過。spec 沒改。
2. 範圍：`docs/agent-guide/bat-mcp-shim.md` 屬於 `affects_files` 的 `docs/agent-guide/`，`CLAUDE.md` 也在範圍內，沒有範圍偏差。

**觀察（非本單範圍）**：
- t0621 預設優先挑安裝版 codex，再挑 PATH，最後才是內嵌。內嵌已達 0.163 之後，這個 e2e 只要沒設 `BAT_E2E_CODEX`，就測不到內嵌 binary。日後若要固定涵蓋內嵌版，可以考慮讓 spec 在內嵌 >= 0.163 時另外跑一次，或在文件註明。本單沒改。

### 互動紀錄

無（`CT_MODE=yolo`、`CT_INTERACTIVE=0`，沒有向塔台提問）。

### Commit

- 產品 commit：`3bdd34eb`（`build: bump embedded codex to 0.163.0 (T0697)`）。以 `git commit --only` 提交 5 個檔：`package.json`、`package-lock.json`、`CLAUDE.md`、`docs/agent-guide/bat-mcp-shim.md`、`electron/codex-bundled-path.ts`。
- 工單 commit：另一筆，只含本工單。
- 沒有 push、沒有觸發 workflow、沒有建 tag，也沒有用 `git stash` / `reset` / `checkout --` / `restore`。維持 LF（diff 中 `\r` 0 筆）。

### 回報時間

2026-10-22T01:55:19+08:00
