---
schema_version: 1
schema_kind: workorder
id: T0717
title: "內嵌 claude CLI 與 codex 追最新：@anthropic-ai/claude-code ^2.1.306 → latest（2.1.316）、@openai/codex-sdk / @openai/codex ^0.163.0 → latest（0.166.0），核對 BAT 整合點；Agent SDK 不動（T0718 另做）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T08:12:30+0800"
started_at: "2026-11-01T08:14:47+0800"
updated_at: "2026-11-01T08:34:54+0800"
completed_at: "2026-11-01T08:34:54+0800"
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

#### Q-1：claude 2.1.312 / 2.1.316 改了兩句限額訊息，`src/lib/usage-limit.ts` 認不得，要不要在本單補上？
- 提問時間：2026-11-01T08:23:45+0800
- 證據（binary 字串，2.1.306 → 2.1.316）：
  - (a) 2.1.312 changelog「Changed usage limit messages to call the 5-hour window the "5-hour limit" instead of the "session limit"」。binary 的名稱表從 `five_hour:"session limit"` 改成 `five_hour:"5-hour limit"`，標題由 `` `You've hit your ${name}` `` 組成，所以撞 5 小時限額時畫面變成 `You've hit your 5-hour limit · resets 3pm (…)`。`CLAUDE_LIMIT_RE` 的名稱只認 `session limit|weekly limit|Opus limit|Sonnet limit|Fable limit|usage limit|limit`，這句不會被辨識成 `claude-limit` → 少了 `cli-unavailable` 提示（CLI 自己的自動繼續沒開時）。
  - (b) reset 時的通知由 `Usage limit reset · continuing automatically` 改成 `Usage limit reset · Continuing automatically`（大寫 C）。`CLAUDE_RESUMED_RE`（T0692）沒有 `i` 旗標，這句不再被辨識成 `claude-cli-resumed` → 舊的提示不會清掉。
  - 兩者都只影響提示（claude 一律不送文字，D148）；`claude-stale`（送 Enter）用的 `Your usage limit has reset` / `Press enter to continue` 沒變。
- 選項：[A] 本單補：`CLAUDE_LIMIT_RE` 加 `5-hour limit`（對應 `session`），`CLAUDE_RESUMED_RE` 的 `continuing automatically` 改成大小寫都認；舊句型保留（system runtime 可能仍是舊 CLI）；補測試與檔頭註解 / `docs/agent-guide/usage-limit-continue.md` / [B] 本單不改，另開 BUG 單處理
- Worker 建議：[A]，因為 CLAUDE.md「用量限制自動繼續」節規定「CLI 改字串時需同步改此檔與測試」，改動是純追加（不刪任何既有句型、不改決策表），兩個檔都在 `affects_files`。
- 影響範圍：`src/lib/usage-limit.ts`、`src/lib/__tests__/usage-limit.test.ts`、`docs/agent-guide/usage-limit-continue.md`
- 阻塞：否（先做其他驗證；收尾前要等答覆）

#### Q-2：codex 0.166 的 OSC 7501 多了 `done` / `error` 狀態，BAT 會把回合已結束的 codex 一直當成 `working`，要不要在本單補上？
- 提問時間：2026-11-01T08:23:45+0800
- 證據（上游原始碼 `codex-rs/tui/src/terminal_program_status.rs` / `chatwidget/turn_runtime.rs` / `chatwidget/status_surfaces.rs` / `app.rs`，tag `rust-v0.163.0` 對 `rust-v0.166.0`；binary 字串 `idleworkingblocked` → `idleworkingblockeddone`）：
  - 0.166 起回合正常結束送 `state=done:app=codex`、失敗送 `state=error:app=codex`，**一直保持到使用者按鍵 / 貼上 / 點滑鼠**（`acknowledge_program_status`）才變回 `idle`；下一回合開始則直接 `working`。
  - `blocked` 多了 `:kind=permission|question|auth`。BAT 的 `parseCodexOscPayload` 只看 `state=`，`kind` 會被忽略，`blocked` → `blockedReason: input` 照舊，這部分不影響。
  - `parseCodexOscPayload` 不認得的 `state=` 一律忽略（`src/lib/codex-terminal-state.ts` 檔頭註明）→ 收到 `done` / `error` 時狀態停在上一個 `working`。yolo Worker 沒有人按鍵，所以回合結束後 `terminal:get-state` / `list` 仍回 `working`、`busy` 不結束（T0694 的 `↻` 回不到 `✓`、`terminal:wait` 等不到 idle，只剩 60 s 無輸出備援）。
  - 影響的是**跑 codex >= 0.166 的分頁**：分頁用系統 codex（T0697），所以使用者的系統 codex 升到 0.166 就會發生，與本單升內嵌版無關；內嵌 0.166 會在 e2e t0621 碰到。
- 選項：[A] 本單補：`parseCodexOscPayload` 把 `done` / `error` 當成 `idle`（契約對外的狀態值不變，`kind=` 繼續忽略）；補測試與 `docs/agent-guide/blocked-state.md` 的轉換表 / [B] 本單不改，另開 BUG 單（涉及 D158 契約 C-1–C-8 的轉換表，由塔台決定）
- Worker 建議：[A]，因為 `done` / `error` 的語意就是「回合結束、沒在跑」，對應到 `idle` 不改任何對外欄位；改動只有 parser 的對照表。若塔台認為轉換表屬契約變更要另行決策，選 [B]。
- 影響範圍：`src/lib/codex-terminal-state.ts`、`src/lib/__tests__/codex-terminal-state.test.ts`、`docs/agent-guide/blocked-state.md`、CLAUDE.md「blocked 狀態偵測」節（一句）。`src/lib/codex-terminal-state.ts` **不在** `affects_files`（`src/lib/__tests__/`、`docs/agent-guide/`、CLAUDE.md 在）。
- 阻塞：否（先做其他驗證；收尾前要等答覆）

### 完成狀態

**DONE**：內嵌 `@anthropic-ai/claude-code` 從 `2.1.306` 升到 `2.1.316`，`@openai/codex-sdk` / `@openai/codex`（含 6 個平台子套件）從 `0.163.0` 升到 `0.166.0`。核對時找到兩項會影響 BAT 的變動，經塔台 D192 裁示（Q-1 / Q-2 都選 [A]）在本單補上：claude 的兩句限額訊息（`src/lib/usage-limit.ts`）與 codex OSC 7501 的 `done` / `error` 狀態（`src/lib/codex-terminal-state.ts`）。其他核對項目都沒有變動。驗收 6 項全部 PASS。

- **Landing Zone**：PASS。
  - C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，相同 ✅（`CT_HOME` 未設，不是 worktree）
  - C-1：PASS（工單在 `REPO_ROOT/_ct-workorders/`）
  - C-3：PASS（前 5 筆非萬用字元的 `affects_files` 都存在）
  - C-2：工單沒有 `branch` 欄位（HEAD = `main`）
  - `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只當證據記錄）
- **派發模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；BAT 變數名稱在 Git Bash 與 PowerShell 都看得到。
- **環境**：npm 12.2.1、Node v26.13.0（T0697 時是 v24.22.1）。
- **範圍**：`src/lib/codex-terminal-state.ts` 原本不在 `affects_files`，由塔台 Q-2 答覆（D192）授權列入。

### 版本與 lock

- 開工時查 dist-tags（2026-11-01 08:15）：
  - `@anthropic-ai/claude-code`：`{ stable: '2.1.309', next: '2.1.316', latest: '2.1.316' }` → 依 D191 取 latest `2.1.316`，與工單預期相同。
  - `@openai/codex-sdk`：`latest: '0.166.0'`（`alpha: '0.166.0-alpha.6'`）；`npm view @openai/codex-sdk@0.166.0 dependencies` = `{ '@openai/codex': '0.166.0' }`，SDK 與 codex 版本一致。
  - `@openai/codex`：`latest: '0.166.0'`，平台 tag（`win32-x64` 等）都是 `0.166.0-<platform>`。
- 發佈時間（npm `time`）：
  - claude-code：2.1.307 = `2026-10-21T20:47:18Z`、2.1.308 = `2026-10-22T04:19:48Z`、2.1.309 = `2026-10-22T20:34:13Z`、2.1.310 = `2026-10-23T21:20:46Z`、2.1.311 = `2026-10-26T19:47:57Z`、2.1.312 = `2026-10-27T18:36:10Z`、2.1.314 = `2026-10-30T00:12:56Z`、2.1.315 = `2026-10-30T21:05:24Z`、2.1.316 = `2026-10-31T00:42:05Z`（npm 上沒有 2.1.313）。
  - codex-sdk：0.164.0 = `2026-10-23T04:52:53Z`、0.165.0 = `2026-10-27T20:14:51Z`、0.166.0 = `2026-10-29T19:56:16Z`。
- `package.json`：`@anthropic-ai/claude-code` `^2.1.306` → `^2.1.316`、`@openai/codex-sdk` `^0.163.0` → `^0.166.0`。`@anthropic-ai/claude-agent-sdk` 維持 `^0.2.111`（實裝 `0.2.113`），`version` 欄位沒動。
- 執行 `npm install "@anthropic-ai/claude-code@^2.1.316" "@openai/codex-sdk@^0.166.0"`；結尾只剩預期中的 `electron-winstaller` 未放行警告。
- **lock 處理**（比照 T0690 / T0697）：
  - npm 原生產出的 lock：`92 insertions(+), 99 deletions(-)`，`REAL 19  META-ONLY 43`（43 個只動 `peer` 等旗標，屬雜訊）。
  - 用 scratchpad 的 `lock.mjs transplant`，以 HEAD 的 lock 為底，只移植 `node_modules/@anthropic-ai/claude-code*` 與 `node_modules/@openai/codex*` 的條目（保留 HEAD 的 meta 旗標），以及 root `packages[""].dependencies` 那兩行。
  - `git diff --stat package-lock.json` = `1 file changed, 68 insertions(+), 68 deletions(-)`。
- **逐套件比對**（`lock.mjs cmp`，HEAD 對移植後）：`REAL 19  META-ONLY 0`
  - `(root) dependencies`：`@anthropic-ai/claude-code: ^2.1.306 -> ^2.1.316`、`@openai/codex-sdk: ^0.163.0 -> ^0.166.0`
  - `@anthropic-ai/claude-code`：version / resolved / integrity / optionalDependencies（2.1.306 → 2.1.316）
  - 8 個 claude 平台子套件只動 version / resolved / integrity（2.1.306 → 2.1.316）：`claude-code-darwin-arm64`、`-darwin-x64`、`-linux-arm64`、`-linux-arm64-musl`、`-linux-x64`、`-linux-x64-musl`、`-win32-arm64`、`-win32-x64`
  - `@openai/codex-sdk`：version / resolved / integrity / dependencies（0.163.0 → 0.166.0）
  - `@openai/codex`：version / resolved / integrity / optionalDependencies（0.163.0 → 0.166.0）
  - 6 個 codex 平台子套件只動 version / resolved / integrity（`0.163.0-<p>` → `0.166.0-<p>`）：`codex-darwin-arm64`、`-darwin-x64`、`-linux-arm64`、`-linux-x64`、`-win32-arm64`、`-win32-x64`
  - 兩個系列的子套件與升版前是同一組（8 + 6 個），沒有新增或移除。
- **重產比對**：把 `package.json` 與移植後的 lock 複製到 scratchpad，跑 `npm install --package-lock-only --ignore-scripts`（exit 0），結果 `REAL 0  META-ONLY 43`，實質差異 0。

### 核對結果

證據來源：
- ① claude 官方 changelog `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`，2.1.307 – 2.1.316 八節（2.1.307 / 308 / 309 / 310 / 311 / 312 / 314 / 316），2026-11-01 下載。
- ② 官方價目頁 `https://platform.claude.com/docs/en/about-claude/pricing.md`，2026-11-01 擷取。
- ③ binary 字串比對：升版前備份的 claude 2.1.306（295,628,960 bytes）對內嵌 2.1.316（335,469,216 bytes）、codex 0.163.0（341,270,320 bytes）對內嵌 0.166.0（371,735,856 bytes），逐字串計數並抽前後文（scratchpad `strcount.mjs`）。
- ④ 實測（不登入、不呼叫模型、不開 codex turn）：SDK 0.2.113 搭配兩版 claude 的 `supportedModels()`、`--settings=` hooks、`disableAllHooks`、`claude update`；兩版 codex 的 `--help`、`plugin --help`、`mcp get` / `mcp list`。claude 用空的 `CLAUDE_CONFIG_DIR`、codex 用空的 `CODEX_HOME`，都在 scratchpad。
- ⑤ codex 官方 release notes：`gh api repos/openai/codex/releases/tags/rust-v0.164.0 / 0.165.0 / 0.166.0`，2026-11-01 擷取。
- ⑥ codex 原始碼：`codex-rs/tui/src/terminal_program_status.rs`、`daemon_startup.rs`、`chatwidget/turn_runtime.rs`、`chatwidget/status_surfaces.rs`、`app.rs`、`codex-rs/config/src/plugin_edit.rs`，取 `rust-v0.163.0` 與 `rust-v0.166.0` 兩個 tag。
- ⑦ npm 套件內容：升版前備份的 `node_modules`；6 個 codex 平台包用 `npm pack @openai/codex@<v>-<p> --dry-run --json` 比對檔案清單。

#### claude

**① 模型清單 / effort / 計價 / 門檻：沒有變動**
- ④ `supportedModels()` 兩版逐字相同（欄位依序 `value | resolvedModel | supportedEffortLevels | displayName | description`）：

  ```
  default | claude-opus-5-5 | ["low","medium","high","xhigh","max"] | Default (recommended) | Use the default model (currently Opus 5.5) · $4/$20 per Mtok
  opus | claude-opus-5-5 | ["low","medium","high","xhigh","max"] | Opus | Opus 5.5 · Best for everyday, complex tasks · $4/$20 per Mtok
  fable | claude-fable-5-1 | ["low","medium","high","xhigh","max"] | Fable | Fable 5.1 · Most capable for your hardest and longest-running tasks · $10/$50 per Mtok
  sonnet | claude-sonnet-5-5 | ["low","medium","high","xhigh","max"] | Sonnet | Sonnet 5.5 · Efficient for routine tasks · $2/$10 per Mtok
  haiku | claude-haiku-5-5 | ["low","medium","high","xhigh","max"] | Haiku | Haiku 5.5 · Fastest for quick answers · $0.10/$0.50 per Mtok ($0.50/$2.50 for prompts over 100k)
  ```

  `BAT_BUILTIN_MODELS`、`MODEL_LIMITS`、`EFFORT_LEVELS` 都沒改。
- ① 2.1.307 – 2.1.316 沒有新增、改名或移除模型的條目。與模型 / effort 有關的都是修正或行為調整，不影響清單：2.1.311 `[1m]` 後綴在無作用的模型上不再顯示（仍接受）、`ultrathink` 在 Opus 5.5 / Sonnet 5.5 / Haiku 5.5 / Fable 5.1 跑 `xhigh`；2.1.314 組織管理員限制 effort 時自動降級重試；2.1.316 新增 `CLAUDE_CODE_SUBAGENT_EFFORT`、Opus 4.8 fast mode 2026-11-30 移除（BAT 不用 fast mode）。
- ② 價目表與 `src/lib/model-pricing.ts` 一致：Opus 5.5 `$4 / $20`（cache hit `$0.20`，註 2 = 0.05x）、Fable 5.1 `$10 / $50`（`$0.25`，註 1 = 0.025x）、Sonnet 5.5 `$2 / $10`（`$0.10`，0.05x）、Haiku 5.5 `$0.10 / $0.50`（> 100k：`$0.50 / $2.50`）、Sonnet 5 `$2 / $10`（註 3：已成為正式價格）；legacy 列也與 `P()` 一致。`model-pricing.ts` 與測試沒改。
- `HEALTHY_MIN`：① 沒有服務端版本門檻的條目；③ `claude_code_version_too_old` 4→4。維持 `2.1.280`。

**② update guard：仍有效**
- ③ 決策函式仍先判斷 `DISABLE_UPDATES`、再 `DISABLE_AUTOUPDATER`：`function gy(e){if(i.DISABLE_UPDATES)return{type:"env",envVar:"DISABLE_UPDATES"};if(e)return{type:"env",envVar:"DISABLE_AUTOUPDATER"};…`（2.1.306 同樣邏輯，只是 minifier 改名）。`DISABLE_UPDATES` 10→10、`DISABLE_AUTOUPDATER` 12→12、`Updates are disabled by your administrator` 3→3。
- ④ 把 2.1.316 的 `claude.exe` 複製到 scratchpad，帶 `DISABLE_UPDATES=1` 與空的 `CLAUDE_CONFIG_DIR` 執行 `claude.exe update`：輸出 `Updates are disabled by your administrator. Contact your IT team to get the latest version.`，exit 0；前後 sha256 前 16 碼都是 `e896a9d8da519353`。`claudeUpdateGuardEnv` 不需要改。

**③ BAT 整合點：沒有變動**
- `--help` 兩版 diff 只有 `auto-mode`、`purge` 兩個子命令的說明文字；`--mcp-config <configs...>`（variadic，BAT 的 `=` 形式仍必要）、`--settings <file-or-json>`、`-n, --name <name>` 逐字相同。
- hooks（④，SDK `extraArgs: { settings }` = BAT 的 `--settings=` 注入，async 的 `SessionStart` / `UserPromptSubmit` / `Stop` command hooks）：兩版都是 `hooks ran: ["session-start sid","user-prompt-submit sid"]`（`sid` = hook stdin 的 JSON 有 `session_id`，T0642 依賴它）；串流都是 `system:hook_started, system:hook_response, system:init, assistant, result:success`（`Not logged in`）。`Stop` 沒有 turn 時不觸發，兩版相同。
- `disableAllHooks`（④）：在 user `settings.json` 寫 `disableAllHooks: true` 後兩版都是 `hooks ran: []`，T0590 / T0600 前提成立。
- ③ `BAT_CLAUDE_HOOKS` 用到的事件名與 matcher 都還在：`"Notification"` 13→13、`"ElicitationResult"` 18→18、`"PostToolBatch"` 39→39、`elicitation_dialog` 3→3、`elicitation_url_dialog` 5→5、`elicitation_response` 13→13；`"PostToolUse"` 77→80、`"UserPromptSubmit"` 49→51、`"PermissionRequest"` 68→82、`"PreToolUse"` 126→133、`"Stop"` 69→71、`"SessionStart"` 45→48 只是新增引用；SessionStart 的 input 建構 `hook_event_name:"SessionStart",source:` 1→1，欄位與 2.1.306 相同（`source / agent_type / model / session_title`）。
- `allowManagedHooksOnly` 46→52、`disableAllHooks` 86→94（新增引用，鍵名不變）；managed 設定路徑 `C:\Program Files\ClaudeCode` 1→1；`autoContinueAtUsageLimit` 20→20。
- ① 與 hooks 有關的條目都不影響 BAT 的 settings command hooks：2.1.309 / 2.1.316 PowerShell hook 的 exit 2 阻擋修正、2.1.310 Windows 缺 Git Bash 時 `PreToolUse` / `PermissionRequest` fail-open 修正、2.1.311 `SubagentStop` 重複觸發修正、2.1.312 prompt / agent hooks 同時上限 24、2.1.314 PreCompact 輸出截斷、Monitor 工具的 shell 指令也套用 Bash hooks。BAT 的 hook 腳本是 `node` 指令、一律 exit 0。
- 範圍外附帶確認（T0524 / T0568 / T0590 的觀察仍成立）：`"alt+v":"ctrl+v"` 1→1、`ContainsImage()) { exit 1 }` 2→2、`CLAUDE_CODE_DISABLE_MOUSE_CLICKS` 5→5、`tengu_splendid_horizon` 2→2、`"PermissionDenied"` 23→23。

**`src/lib/usage-limit.ts` 句型：兩句改了 → 已補（Q-1，D192）**
- 計數不變：`You've hit your` 23、`ve reached your` 10、`weekly limit` 23、`progress saved` 3、`shared budget` 8、`org is out of usage` 6、`seat type doesn` 8、`Usage limit reached` 14、`Usage limit available again` 2、`Continuing shortly` 2、`Automatic continue stopped` 8、`Automatic continue cancel` 14、`Your usage limit has reset` 2、`monthly spend limit` 27、`out of usage credits` 11、`Usage limit reset` 6。
- 變動 1（2.1.312，① 「Changed usage limit messages to call the 5-hour window the "5-hour limit" instead of the "session limit"」）：③ 名稱表 `five_hour:"session limit"` → `five_hour:"5-hour limit"`，標題以 `` `You've hit your ${name}` `` 組成（2.1.316 自己的判斷式 `c(d.five_hour)||c("session limit")` 兩者都認）。`5-hour limit` 2→32、`session limit` 26→7。修正前 `CLAUDE_LIMIT_RE` 認不得 `You've hit your 5-hour limit · resets …` → 少了 `cli-unavailable` 提示。
- 變動 2（2.1.316）：reset 通知 `Usage limit reset · continuing automatically` → `Usage limit reset · Continuing automatically`；`continuing automatically` 6→4 的差異就是這兩處。修正前 `CLAUDE_RESUMED_RE`（沒有 `i` 旗標）認不得 → 舊提示不會清掉。
- 其他計數變動：`Press enter to continue` 2→4，新增的是 `Usage limit has reset · Press enter to continue` 通知（2.1.306 為小寫 `press`，兩版都不是 BAT 句型；`claude-stale` 用的 `Your usage limit has reset` + `Press enter to continue` 兩行沒變）；等待中的 `Continuing automatically {when} · Esc to cancel`（`Esc` 改大寫）由 `CLAUDE_AUTO_RE`（`iu`）照認。
- 修正：`CLAUDE_LIMIT_RE` 名稱加 `5-hour limit`（`claudeLimitKind` 對應 `session`）、`CLAUDE_RESUMED_RE` 改認 `[Cc]ontinuing automatically`；舊句型全部保留（system runtime 可能仍是舊 CLI），決策表不變。測試補 4 項：`5-hour limit → session`（含重置時間）、`5-hour limit` + `progress saved` → `cli-unavailable`、大寫 C 的 resumed → `claude-cli-resumed` / `none`、引用在回覆中不算。

**④ binary 路徑與平台子套件：沒有變動**
- `@anthropic-ai/claude-code` 套件檔案清單兩版相同，`package.json` 只差 version 與 optionalDependencies 的版本號；`bin/claude.exe` 與 `claude-code-win32-x64/claude.exe` 都是 335,469,216 bytes、hardlink count 2，`bin/` 只有 `claude.exe`。`resolveEmbeddedClaudePath` / `embeddedClaudeCandidates` 與 `verify-packaged-native.js` 的 JS 複本不需要改。
- stub 偵測仍有效：`npm pack @anthropic-ai/claude-code@2.1.316` 的 `bin/claude.exe` 是 500 bytes、含 `claude native binary not installed`；`classifyEmbeddedClaude()` 對它回 `{"status":"stub","size":500,"format":null}`，對內嵌 binary 回 `{"status":"native","size":335469216,"format":"pe"}`。

#### codex

**① 原生 binary 路徑解析：沒有變動**
- 內嵌 `vendor/x86_64-pc-windows-msvc/codex-package.json` 兩版只差 `version`（`layoutVersion: 1`、`entrypoint: "bin/codex.exe"`、`pathDir: "codex-path"`、`resourcesDir: "codex-resources"`）。
- win32-x64 安裝後的檔案清單兩版相同（`bin/` 為 `codex.exe` + `codex-code-mode-host.exe`）；⑦ 6 個平台包的檔案清單 0.163.0 → 0.166.0 全部相同（linux 45、darwin 43、win32 47 檔）。release notes 0.166.0「Ship `codex-exec-server` in CLI and app-server packages」(#57590 / #57837) 在 npm 平台包裡沒有出現新檔。
- `resolveBundledCodexLayout` 的 >= 0.160 分支照樣命中，legacy 分支沒用到。`verify-packaged-native.js` 的 `dynamicRuntimePackages` 只檢查 `@openai/codex-${platform}-${arch}` 存在，`verify-native-modules.js` 沒有 codex 檢查項，都不需要改。
- `@openai/codex` wrapper 的 `bin/codex.js` 改了（非 Windows 改用 `process.execve` 取代 Node、Windows 照舊 spawn）；BAT 不執行這個 wrapper（`electron/codex-agent-manager.ts:116` 只在註解提到），不受影響。

**② SDK API：沒有任何變動**
- `@openai/codex-sdk` 0.163.0 → 0.166.0 的 `dist/index.d.ts` 與 `dist/index.js` diff 皆為空；`package.json` 只差 version 與 `@openai/codex` 依賴版本。`codex-bundled-path.ts` 的 SDK 鏡像仍正確（只補註解）。

**③ BAT 整合點**
- `-c mcp_servers.bat.*`（含 `env_vars`、`tool_timeout_sec`）：用 BAT 自己的 `codexMcpOverrides()` 組出 `-c`，兩版 `codex mcp get bat --json` 輸出逐字相同（`transport.env_vars` 9 個名稱、`env: null`、`tool_timeout_sec: 60.0`）。
- `-c check_for_update_on_startup=false`：兩版 `mcp list` 都接受；給字串 `"x"` 兩版都 `invalid type: string "x", expected a boolean` exit 1，仍是有型別檢查的有效設定。
- `--no-daemon`：`--help` 兩版 diff 只多一個 `migrate-nfs-db` 子命令，`--no-daemon` 與 `-c, --config` 都在。`codexNoDaemonDecision` 的 `>= 0.156.0` 門檻不受影響。
- `config_exclusion`（⑥ `daemon_startup.rs`）：允許清單 `allowed_feature()` 被移除，改成「任何 `features.<不含點的名稱>` = bool」都不排除 daemon；非 `features.*` 的 `-c` 仍回 `command-line configuration overrides (-c, --enable, --disable, or --search)`，讓 codex 走 embedded。BAT 依賴的不變式（`mcp_servers.bat.*`、`check_for_update_on_startup` 讓 codex 不連 daemon）仍成立。其他變動（daemon feature 覆寫比對改成忽略已移除的 feature、`restart_features` 有值時不 fallback embedded）不影響 BAT。e2e t0592 的 worker 仍在預設 sandbox 看得到全部 `BAT_*`（見「驗證證據」）。
- **OSC 7501（`src/lib/codex-terminal-state.ts`）：有變動 → 已補（Q-2，D192）**
  - ⑥ `terminal_program_status.rs`：`ProgramStatus` 由 `Idle / Working / Blocked` 擴成 `Idle / Working / Blocked(kind) / Done / Error`；序列格式 `ESC ] 7501 ; state=<s>:app=codex[:kind=permission|question|auth] ESC \`。③ binary 字串 `idleworkingblocked` → `idleworkingblockeddone`，`permissionquestionauth` 與 `:kind=` 為新字串。
  - ⑥ `turn_runtime.rs`：回合正常結束 → `program_status_after_turn = Done`（replay 時 `Idle`），失敗 → `Error`；`status_surfaces.rs` 的 `acknowledge_program_status` 把 `Done` / `Error` 改回 `Idle`，`app.rs:889` 只在 key（非 release）/ 非空 paste / 非 move 的滑鼠事件時呼叫。上游測試 `chatwidget/tests/program_status.rs` 的序列：`Idle, Working, Blocked(Permission), Working, Done, Done, Idle, Idle, Error, Idle`。
  - 影響：BAT 的 parser 忽略未知 `state=`，所以 yolo Worker（沒人按鍵）回合結束後一直停在 `working`。使用者的系統 codex 已是 `0.166.0`（`%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe` 與 PATH 上的都是），分頁用系統 codex，所以這個問題在本單之前就已發生。
  - 修正：`parseCodexOscPayload` 把 `done` / `error` 讀成 `idle`（`CODEX_IDLE_ALIASES`），`kind=` 照舊忽略；`CodexTerminalState` 型別、對外的 `state` / `blockedReason` 值、`TerminalBlockedTracker` 都沒改（契約 C-1–C-8 不動）。測試補 6 項 payload（`done` / `error` → `idle`、三種 `kind` → `blocked`、`app=other` 的 `done` → null）與一段 0.166 完整回合的掃描。
  - 另一項上游變動（不需改 BAT）：0.166 在偵測到 VTE `< 0.54`（`TerminalBackend::Vte`）時不送 OSC 7501；BAT 的 xterm.js 分頁不屬於這種情況。
- `src/lib/usage-limit.ts` 的 codex 句型：計數兩版相同（`ve hit your usage limit` 7、`Try again at` 1、`Your workspace is out of credits` 4、`You hit your spend cap` 2、`Usage limit reached. You` 1、`ve reached your usage limit` 1、`re out of credits.` 1），抽前後文看句子本身沒變；`try again later` 1→2 多的是 `Policy-restricted capacity is unavailable. Please try again later.`（容量錯誤，不是限額句型，`CODEX_LIMIT_RE` 不比對）。`usage-limit.ts` 的 codex 部分沒改。
- CT plugin（`electron/ct-install-detect.ts`）：⑥ `codex-rs/config/src/plugin_edit.rs` 在 `rust-v0.163.0` 與 `rust-v0.166.0` 逐字相同（寫 `[plugins."<id>"]` 表與 `enabled` 鍵）；`codex plugin --help` 兩版相同。`[plugins."ct@…"]` + `enabled = true` 的判斷仍成立。

**④ release notes（0.164.0 – 0.166.0）其他與 BAT 相關的條目，都不需要改 BAT**
- 0.164.0 #56022：`-c` 出現在多層子命令時都保留（BAT 只在最外層帶 `-c`）。
- 0.164.0 #53751 / #55442、0.166.0 #57253：daemon feature 覆寫比對與啟動等待；BAT 的 codex 分頁走 embedded（見上方 `config_exclusion`）。
- 0.164.0 #54069 / #54027：Windows 遠端 MCP 與啟動變數保留；BAT shim 是 local stdio。
- 0.166.0 #57210 / #57211：local stdio MCP 的 protocol discovery（opt-in）與「跨 chat 共用合格的 local stdio MCP 連線」；這是同一個 codex 程序內的共用，BAT 每個分頁是各自的 codex 程序（embedded），不會共用到別的分頁的 `BAT_*`。實機留意事項見「需實機驗證」。

### 寫死版本的處置

| 位置 | 性質 | 處置 |
|---|---|---|
| `CLAUDE.md`「Claude Agent SDK / CLI」版本行（`^2.1.306`，T0690） | 內嵌實裝版本 | 改為 `^2.1.316`（T0717） |
| `CLAUDE.md`「BAT MCP shim」節（內嵌 codex 目前 `0.163.0`，T0697） | 內嵌實裝版本 | 改為 `0.166.0`（T0717） |
| `CLAUDE.md`「blocked 狀態偵測」節 codex 清除條件 | 行為說明 | 補「0.166+ 的 `done` / `error` 解析為 `idle`，T0717」一句；CLAUDE.md 72,399 字元（< 100k） |
| `docs/agent-guide/claude-agent-sdk-cli.md:5 / :7 / :11 / :15 / :67` | 實裝版本、模型清單、effort、版本鎖、`DISABLE_UPDATES` 實測 | :5 改為 `^2.1.316`（實裝 `2.1.316`）並補 T0717 追版紀錄（T0690 / T0541 / T0483 / T0371 歷史保留）；:7 / :11 / :67 在原歷史後補 2.1.316（T0717）；:15 版本鎖改為 `^2.1.316` |
| `docs/agent-guide/npm12-install-scripts.md:6 / :19` | 內嵌實裝版本（`--version` 期望值） | :6 補「T0717 起為 `2.1.316`」（歷史保留）；:19 改為「T0717 起 `2.1.316 (Claude Code)`」 |
| `docs/agent-guide/claude-session-name.md:57`（「內嵌固定 2.1.306 線」） | 現況敘述 | 改為「內嵌固定 2.1.316 線，T0717」 |
| `docs/agent-guide/bat-mcp-shim.md:41`（T0592 e2e「T0697 以內嵌 0.163.0 重跑通過」） | 歷史實測 + 目前內嵌版 | 歷史保留，補「T0717 以內嵌 0.166.0 重跑通過」 |
| `docs/agent-guide/blocked-state.md` 轉換表 | 行為說明 | 補 `done` / `error` 一列與 0.166 行為說明（Q-2） |
| `docs/agent-guide/usage-limit-continue.md`「句型來源」 | 行為說明 | 補 T0717 兩句變動（Q-1）與 codex 0.166 句型不變；其餘 2.1.306 / T0692 歷史敘述保留 |
| `scripts/verify-native-modules.js:61`、`scripts/__tests__/verify-native-modules.test.mjs:28`（stub 形狀註解） | 內嵌實裝版本的 stub 形狀 | 補 `2.1.316`（已用 2.1.316 tarball 實測，同為 500 bytes） |
| `electron/codex-bundled-path.ts:6`（SDK 鏡像「unchanged in 0.163, T0697」） | SDK 鏡像來源 | 補「and 0.166, T0717」（② diff 為空） |
| `src/lib/usage-limit.ts:9`、`src/lib/__tests__/usage-limit.test.ts:4 / :115 / :139`、`docs/agent-guide/usage-limit-continue.md:7`（2.1.300 / 2.1.306 讀句型的來源） | 歷史 | 不動；新句型另行補註 |
| `electron/terminal-blocked-state.ts:76`、`docs/agent-guide/blocked-state.md:32`、`docs/agent-guide/worker-tab-recycle.md:26`（2.1.306 binary 的事件表觀察） | 某一版 CLI 的觀察紀錄 | 不動；`"Stop"` / `"SessionStart"` 等事件仍在（見 ③） |
| `src/lib/__tests__/thumbnail-preview.test.ts`、`src/components/__tests__/terminal-thumbnail-preview.test.tsx`、`docs/agent-guide/thumbnail-preview.md:12`（`Claude Codev2.1.306`） | BUG-175 截圖的測試字串 | 不動 |
| `CODEX_OSC_MIN_VERSION = '0.163.0'`、`codexVersionWritesOsc`、`e2e/t0621-…`、`scripts/bat-terminal.mjs` / `bat-mcp.mjs`、`electron/codex-osc-version.ts` / `main.ts` / `terminal-command-handlers.ts` / `terminal-blocked-state.ts:58`、`README.md`、`site/*`、`docs/agent-guide/{worker-launch-confirmation,bat-mcp-shim,blocked-state}.md` 的 `>= 0.163.0` | 版本門檻 | 不動 |
| `electron/__tests__/codex-no-daemon-launch.test.ts`、`electron/__tests__/codex-osc-state.test.ts:495-506`、`src/lib/__tests__/codex-terminal-state.test.ts:152-161` 的 `0.163.0` | 任意測試字串 / 門檻案例 | 不動 |
| `docs/agent-guide/bat-mcp-shim.md:33 / :34 / :50`、`docs/agent-guide/terminal-context-menu.md:20`、`src/lib/mouse-tracking-reset.ts:4`、`docs/agent-guide/tower-questions.md:208` | 0.163.0 的實測 / 原始碼紀錄 | 不動 |
| `2.1.280` / `2.1.251` / `2.1.289` / `2.1.76` / `0.156.0` 等門檻與最低版本 | 門檻值 | 不動 |

### 驗證證據

| AC | 結果 | 證據 |
|---|---|---|
| 內嵌 `--version`、`verify-native-modules` | ✅ PASS | `node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` = `2.1.316 (Claude Code)`；`node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe --version` = `codex-cli 0.166.0`；`node scripts/verify-native-modules.js` exit 0（`All 2 required native modules present … embedded claude: native`） |
| lock diff 只涉及兩個系列 | ✅ PASS | `68 insertions(+), 68 deletions(-)`；`REAL 19  META-ONLY 0`（root 兩行 + 9 個 claude 條目 + 8 個 codex 條目）；重產比對 `REAL 0` |
| unit / legacy / build / typecheck / verify:helpers | ✅ PASS | 見下方清單 |
| e2e t0592 / t0621 | ✅ PASS | 見下方清單 |
| claude / codex 核對 | ✅ PASS | 「核對結果」；兩項變動依 D192 已補 |
| 列出需實機驗證的項目 | ✅ | 見「需實機驗證」 |

明細。驗證時 HEAD 為 `2bee97ad` 加上本單的工作區變更；之後只在 commit `101adaaf` 前補了 `docs/agent-guide/bat-mcp-shim.md` 一句文件，程式內容與驗證時相同。本單不在 worktree，沒有 `validated_sha` / `head_sha` 要求。
- `npx vite build` exit 0。
- `npm run typecheck` exit 0；`npm run typecheck:electron` exit 0。
- `npm run test:unit` exit 0：`Test Files 344 passed (344)`，`Tests 6182 passed | 3 skipped (6185)`。
- `npm run test:legacy` exit 0：`legacy tests: files 33 passed, 0 failed / 33 total; tests 472 passed, 0 failed`。
- `npm run verify:helpers` exit 0（6 個 runtime helper，與 server bundle 同一組）。
- `TMP` = 系統預設 `<使用者資料夾>\AppData\Local\Temp`（不是 scratchpad）。
- e2e `e2e/t0592-codex-tower-worker.spec.ts`：`2 passed (18.1s)`，用內嵌 0.166.0（userAgent `t0592/0.166.0`）。
  - worker / tower argv 含 `mcp_servers.bat.*`（含 `env_vars`）；worker 另有 `check_for_update_on_startup=false`。
  - worker 的 codex 預設 sandbox 下，`BAT_*` 8 項都在、`tokenIsCapability: true`、`net: connected`；`mcpServerStatus/list` 列出 `bat` server。
  - 隔離 runtime 的 Terminal Server 已結束（`alive after teardown: false`），userData 已刪除。
- e2e `e2e/t0621-codex-osc-state.spec.ts`：`1 passed (22.9s)`，`BAT_E2E_CODEX` 指到內嵌 0.166.0（反斜線路徑，T0697 遭遇問題 1 的做法）。
  - `--wait-started (trusted)` 回 `started`（1357 ms）；`bat_get_state` 依序 `blocked (input)` / `source: osc` → `working`；`--wait-started (untrusted)` exit 8（`started: unconfirmed`）；`[codex-version] … version=0.166.0 (probed)`；spec 對 `[codex-state] terminal=<worker> → idle` 的斷言通過。
  - 模型請求只打到 spec 自己的本機假模型（`fake model requests: ["POST /v1/responses" ×2]`），不耗 token。
  - 隔離 runtime，teardown 後 Terminal Server 已結束、userData 已刪除。
  - 沒有另外分辨這次的 `→ idle` 是來自 codex 的 `idle` 還是 `done`（spec 不印 PTY 原始序列）；`done` → `idle` 的對照由單元測試以 0.166 的實際位元組格式驗證。
- e2e 都用 `e2e/fixtures/electron-isolation.ts` 的隔離實例（`--runtime=e2e-…`、獨立 userData 與 remote port），沒有以預設實例啟動 source build，沒碰使用者正在用的 BAT 與它的 userData；沒開任何會耗 token 的 claude / codex turn。

### 需實機驗證

- **mac / Linux 內嵌 binary**：由 pre.5 CI 的 `verify-packaged-native` 加上實機，確認 `claude-code-<platform>-<arch>[-musl]/claude` = 2.1.316、`@openai/codex-<platform>-<arch>/vendor/<triple>/bin/codex --version` = `codex-cli 0.166.0`。
- **Windows 安裝版**：NSIS 完整重裝後，內嵌 claude `--version` = `2.1.316 (Claude Code)`；`resources/app.asar.unpacked/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe --version` = `codex-cli 0.166.0`。
- **Claude Agent 面板**：開新 session 能正常對話（需 credential，本單沒有呼叫模型）；模型下拉應與 2.1.306 時相同。
- **終端 claude-cli 分頁**：BAT MCP（`--mcp-config=`）有載入、⚠️ blocked 與 `agentStarted` 正常、`--name` 顯示在 ListAgents。
- **Codex 面板（SDK 路線）實際對話**：需真人與 ChatGPT 登入；SDK 沒變，重點看 0.166 的 app-server 是否有新的事件或錯誤類型。
- **codex Worker 回合結束（Q-2 修正）**：使用者的系統 codex 已是 0.166.0。派一個 codex Worker，回合結束後不要按鍵，確認 `bat_get_state` 回 `idle`、分頁標籤由 `↻` 回到 `✓`（修正前會停在 `working`）。
- **claude 限額提示（Q-1 修正）**：真實撞到 5 小時限額時，留意 `[usage-limit]` 日誌是否辨識 `You've hit your 5-hour limit`（句型取自 binary，沒有實測樣本）。
- **codex 0.166 #57211（跨 chat 共用 local stdio MCP 連線）**：BAT 每個分頁是各自的 codex 程序，理論上不受影響；實機若在同一個 codex 程序內開多個 chat（例如 Codex 面板），留意 BAT MCP 回的 `bat_whoami` 是否仍是自己的分頁。

### 遭遇問題

1. **核對發現兩項會影響 BAT 的變動**，依 `memory_overrides` 先問塔台，D192 兩題都裁示 [A] 在本單補上（Q-1 claude 限額句型、Q-2 codex OSC `done` / `error`）。Q-2 的 `src/lib/codex-terminal-state.ts` 原本不在 `affects_files`，由塔台答覆授權列入。
2. npm 12.2.1 的 `npm view … time --json` 與 `npm pack --dry-run --json` 回傳格式和舊版不同（前者包成陣列、後者以套件名為 key），我的解析腳本第一次讀不到資料；改寫解析方式後重跑，結果如上。與產品無關。

**觀察（非本單範圍）**：
1. 2.1.316 新增的 `Usage limit has reset · Press enter to continue` 單行通知（2.1.306 為小寫 `press`）不在 BAT 的句型內：`claude-stale` 認的是分成兩行的 `Your usage limit has reset` + `Press enter to continue`。若之後要讓這句也觸發 `claude-stale`（BAT 會送 Enter），需另開單評估，本單沒改。
2. 價目頁仍列 `Claude Mythos 5.1` / `Claude Mythos 5`（limited availability），CLI 2.1.316 的模型清單仍然沒有，與 T0541 / T0690 相同。
3. e2e t0621 預設優先挑安裝版 codex（T0697 觀察）；本機安裝版與內嵌都是 0.166.0，這次以 `BAT_E2E_CODEX` 指定內嵌版。

### 互動紀錄

- [08:24] Q-1: claude 2.1.312 / 2.1.316 改了兩句限額訊息（`5-hour limit`、`Continuing automatically` 大寫 C），要不要在本單補 `src/lib/usage-limit.ts`？ → A（塔台，08:24:47，BAT 通道 `q-9e1dbaa2-2d58ab3825f57f2a`）: 「A 本單補——CLAUDE.md 規定 CLI 改字串時同步改 usage-limit.ts 與測試，純追加、舊句型保留（塔台代決，D192）」 → Action: 依 [A] 修改 `usage-limit.ts`、測試、`usage-limit-continue.md`。
- [08:24] Q-2: codex 0.166 OSC 7501 的 `done` / `error` 讓 BAT 把回合已結束的 codex 一直當成 `working`，要不要在本單補？ → A（塔台，08:24:47，BAT 通道 `q-9e1dbaa2-bc4e3371d677b79b`）: 「A 本單補——done / error 對應 idle，對外狀態值與 D158 契約欄位不變，只是 parser 對照表追加；授權 src/lib/codex-terminal-state.ts 列入本單範圍，回報區註明（塔台代決，D192）」 → Action: 依 [A] 修改 `codex-terminal-state.ts`、測試、`blocked-state.md`、CLAUDE.md 一句。
- 兩題以 BAT 通道送出：Q-1 `--ask --no-pty-write`、Q-2 `--ask --submit`，都 exit 0、`notified: yes`；`bat_wait_question` 第一輪同時等兩題，都回 `answered`。

### Commit

- 提問前工單 commit：`91ad6718`（`chore: T0717 questions for tower (ct)`，只含本工單）。
- 產品 commit：`101adaaf`（`build: bump embedded claude CLI to 2.1.316 and codex to 0.166.0 (T0717)`）。以 `git commit --only` 提交 16 個檔：`package.json`、`package-lock.json`、`CLAUDE.md`、`docs/agent-guide/{bat-mcp-shim,blocked-state,claude-agent-sdk-cli,claude-session-name,npm12-install-scripts,usage-limit-continue}.md`、`electron/codex-bundled-path.ts`、`scripts/verify-native-modules.js`、`scripts/__tests__/verify-native-modules.test.mjs`、`src/lib/usage-limit.ts`、`src/lib/__tests__/usage-limit.test.ts`、`src/lib/codex-terminal-state.ts`、`src/lib/__tests__/codex-terminal-state.test.ts`。
- 工單 commit：另一筆，只含本工單。
- 沒有 push、沒有觸發 workflow、沒有建 tag，也沒有用 `git stash` / `reset` / `checkout --` / `restore`。維持 LF（diff 中 `\r` 0 筆）。

### 回報時間

2026-11-01T08:32:57+0800
