---
schema_version: 1
schema_kind: workorder
id: T0690
title: "內嵌 claude CLI 追版：@anthropic-ai/claude-code ^2.1.300 → ^2.1.306（含平台子套件），核對模型清單 / effort / 門檻 / update guard / BAT 整合點，SDK 維持 0.2 線"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-10-21T22:17:40+0800"
updated_at: "2026-10-21T22:29:49+08:00"
started_at: "2026-10-21T22:19:24+08:00"
completed_at: "2026-10-21T22:29:49+08:00"
commit: 09509698
target_version: "0.7.1-pre.5"
depends_on: []
related:
  - "CLAUDE.md「Claude Agent SDK / CLI」：內嵌 CLI 落後即功能故障，每次預覽版發布前追版；SDK 刻意留在 0.2 線（D123）"
  - "T0541（前次追版 2.1.296 → 2.1.300：步驟、lock 移植做法、驗證項目與證據格式都照它做）；T0483（更早一次）"
  - "D179（`v0.7.1-pre.5` 發版前小批）：塔台 2026-10-21 22:15 聯合驗證時查到 `npm view @anthropic-ai/claude-code version` = 2.1.306（2.1.301–2.1.306 發佈於 2026-10-15～2026-10-21T02:28Z），實裝 2.1.300，依 CLAUDE.md 追版規則併入本批"
affects_files:
  - package.json
  - package-lock.json
  - CLAUDE.md
  - docs/agent-guide/claude-agent-sdk-cli.md
  - electron/claude-agent-manager.ts
  - electron/claude-resolver.ts
  - src/lib/model-pricing.ts
  - src/lib/__tests__/model-pricing.test.ts
  - src/types/index.ts
  - src/lib/usage-limit.ts
  - scripts/verify-native-modules.js
  - scripts/__tests__/
  - _ct-workorders/T0690-bump-claude-cli-2.1.306.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權修改 `package.json` 的 `@anthropic-ai/claude-code` 版本與對應 `package-lock.json`（含 `@anthropic-ai/claude-code-*` 平台子套件）；其他相依**不得**連帶升版：lock diff 只能涉及 claude-code 系列與 root `dependencies` 那一行，npm 產生的 `peer` 等旗標雜訊比照 T0541 以移植方式去掉，回報區附 `git diff --stat package-lock.json` 與逐套件比對。"
  - "🔴 `@anthropic-ai/claude-agent-sdk` 不動（D123：留 0.2 線）；`package.json` 的 `version` 欄位不動（塔台發版時另行處理）。"
  - "🔴 開工時再查一次 `npm view @anthropic-ai/claude-code dist-tags` 與 `time`；latest 若已高於 2.1.306，取當下 latest 並在回報區說明。"
  - "🔴 核對新版變化（官方 changelog 2.1.301 起各節、CLI 實際輸出、binary 字串；附證據）：① 模型清單 / `supportedEffortLevels` / 計價（價格只能取自官方價目頁並附出處，查不到就不改）、服務端門檻與 `HEALTHY_MIN`；② update guard：`DISABLE_UPDATES` / `DISABLE_AUTOUPDATER` 仍有效；③ BAT 整合點：`--mcp-config=` / `--settings=` 的 hooks（`BAT_CLAUDE_HOOKS` 用到的事件）/ `--name` / `disableAllHooks` / `autoContinueAtUsageLimit`，以及 `src/lib/usage-limit.ts` 的句型仍出現在新 binary（T0566：句型取自 CLI 字串）。任何一項有變動而會影響 BAT 時，先用 BAT 通道問塔台，不要自行改產品行為。"
  - "🔴 測試與註解中寫死 `2.1.300` 的地方：區分「代表內嵌實裝版本」（更新）與「任意測試字串 / 歷史門檻」（不動），回報區逐一列出處置。CLAUDE.md「Claude Agent SDK / CLI」節與 `docs/agent-guide/claude-agent-sdk-cli.md` 更新實裝版本與本單編號，歷史敘述保留。"
  - "🔴 驗證：內嵌 `node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` = 新版；`node scripts/verify-native-modules.js` exit 0；`npm run test:unit` 全綠；`npm run test:legacy` 全綠（已是發版關卡）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。不得以預設實例（無 `--runtime`）啟動 source build，需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime；不碰使用者正在用的 BAT。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），本單原則上不需要 gh。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`，scratchpad 路徑也一樣。yolo：不得問使用者，判讀問題問塔台。"
---

# T0690 — 內嵌 claude CLI 追版 2.1.306

## 背景

- 內嵌 `@anthropic-ai/claude-code` 實裝 `2.1.300`（T0541）；塔台 2026-10-21 22:15 查 `npm view @anthropic-ai/claude-code version` = `2.1.306`（`time`：2.1.301 = 2026-10-15T14:34Z … 2.1.306 = 2026-10-21T02:28Z）。
- CLAUDE.md 規定每次預覽版發布前追版（服務端以 CLI 版本擋新模型）。本單完成、塔台聯合驗證後即發 `v0.7.1-pre.5`（D179）。

## 實作

照 T0541「實作」1–6 與其回報區的做法，版本號換成本單：

1. 開工時再查 latest（見 `memory_overrides` 第 3 條）。
2. `package.json` 改 `^<新版>`；更新 lock；lock diff 只含 claude-code 系列。
3. 內嵌 binary `--version`、`verify-native-modules`。
4. 核對新版變化（見 `memory_overrides` 第 4 條，含 BAT 整合點與 `usage-limit.ts` 句型）。
5. 寫死 `2.1.300` 的測試 / 註解逐一處置。
6. CLAUDE.md 與 docs 更新實裝版本。

## 驗收

- [x] 內嵌 `claude.exe --version` = 新版；`verify-native-modules` ✅
- [x] lock diff 只涉及 claude-code 系列（附 diff 摘要與逐套件比對）
- [x] `npm run test:unit`、`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [x] 模型 / effort / 計價 / 門檻 / update guard / BAT 整合點 / `usage-limit.ts` 句型的核對結果（有改或無改都附證據）
- [x] 回報區列出需實機驗證的項目（mac / Linux 內嵌 claude 由 pre.5 CI 的 `verify-packaged-native` 確認）

---

## 回報區

### 完成狀態

**DONE**：內嵌 CLI 從 `2.1.300` 升到 `2.1.306`。核對的每一項都沒有變動：模型清單、effort、計價、`HEALTHY_MIN`、update guard、BAT 整合點、`usage-limit.ts` 句型。所以產品程式碼沒改，只改版本、lock、註解與文件。驗收 5 項全數 PASS。

- **Landing Zone**：PASS。
  - C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，相同 ✅（`CT_HOME` 未設，不是 worktree）
  - C-1：PASS（工單位於 `REPO_ROOT/_ct-workorders/`）
  - C-3：PASS（前 5 筆非萬用字元的 `affects_files` 都存在）
  - C-2：工單沒有 `branch` 欄位（HEAD = `main`）
  - `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只當證據記錄）
- **派發模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`。沒有需要問塔台的事項：核對結果全部無變動，不涉及產品行為。
- **環境**：npm 12.2.0、Node v24.22.0。工單 frontmatter 原為 `status: TODO`，開工時直接改成 `IN_PROGRESS`。

### 修改內容

#### 1. 版本與依賴

- 開工時查 `npm view @anthropic-ai/claude-code dist-tags`，結果是 `{ stable: '2.1.304', latest: '2.1.306', next: '2.1.306' }`。latest 仍是 2.1.306，照用。
  - 發佈時間（npm `time`）：2.1.301 = `2026-10-15T14:34:23Z`、2.1.302 = `2026-10-16T16:48:28Z`、2.1.303 = `2026-10-18T21:15:23Z`、2.1.304 = `2026-10-19T19:47:15Z`、2.1.305 = `2026-10-20T19:29:36Z`、2.1.306 = `2026-10-21T02:28:47Z`。
- `package.json`：
  - `@anthropic-ai/claude-code` 從 `^2.1.300` 改為 `^2.1.306`。
  - `@anthropic-ai/claude-agent-sdk` 維持 `^0.2.111`，實裝 `0.2.113`（D123）。
  - `version` 欄位沒動。
- 執行 `npm install "@anthropic-ai/claude-code@^2.1.306"`，postinstall 有跑。結尾只剩預期中的 `electron-winstaller` 未放行警告。
- **lock 處理**（比照 T0541）：
  - npm 原生產出的 lock 有 127 行變動，其中 43 個套件只動了 `peer` 等旗標（META-ONLY 43），屬雜訊。
  - 因此用 scratchpad 的 `transplant.mjs`，以 HEAD 的 lock 為底，只移植兩樣：claude-code 本體與 `claude-code-*` 子套件的條目，以及 root `packages[""].dependencies` 那一行。
  - `git diff --stat package-lock.json` 結果為 `1 file changed, 36 insertions(+), 36 deletions(-)`，與 T0541 相同。
- **逐套件比對**（`lockcmp.mjs`，HEAD 對移植後）：共 10 項變動，`META-ONLY 0`。
  - `(root) dependencies`：`@anthropic-ai/claude-code: ^2.1.300 -> ^2.1.306`
  - `@anthropic-ai/claude-code`：version / resolved / integrity / optionalDependencies（2.1.300 → 2.1.306）
  - 8 個平台子套件，都只動 version / resolved / integrity（2.1.300 → 2.1.306）：`claude-code-darwin-arm64`、`-darwin-x64`、`-linux-arm64`、`-linux-arm64-musl`、`-linux-x64`、`-linux-x64-musl`、`-win32-arm64`、`-win32-x64`。與升版前同一組 8 個。
- **重產比對**：把 `package.json` 與移植後的 lock 複製到 scratchpad，跑 `npm install --package-lock-only --ignore-scripts`（exit 0）。比對結果為 `REAL 0  META-ONLY 43`，實質差異 0。

#### 2. 內嵌 binary

- `node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` 輸出 `2.1.306 (Claude Code)`。
  - `bin/claude.exe` 與 `claude-code-win32-x64/claude.exe` 都是 295,628,960 bytes，hardlink count 2，inode 相同。
  - `bin/` 只有 `claude.exe`，沒有 `.old.*` 殘留。
- `node scripts/verify-native-modules.js` exit 0，輸出 `embedded claude: native`。
- stub 偵測仍有效：
  - `npm pack @anthropic-ai/claude-code@2.1.306` 取得的 `bin/claude.exe` 是 500 bytes，含 `claude native binary not installed`。
  - `classifyEmbeddedClaude()` 對它回傳 `{"status":"stub","size":500,"format":null}`。
  - 對實裝的 binary 則回傳 `{"status":"native","size":295628960,"format":"pe"}`。

#### 3. 新版變化核對

證據來源：
- ① CLI 2.1.306 的 `supportedModels()` 實測：repo 的 SDK 0.2.113 搭配內嵌 binary，`CLAUDE_CONFIG_DIR` 指向 scratchpad 的空目錄，帶 `DISABLE_UPDATES=1`，不呼叫模型。
- ② 官方 changelog `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`，2.1.301 – 2.1.306 六節，2026-10-21 下載。
- ③ 官方價目頁 `https://platform.claude.com/docs/en/about-claude/pricing.md`，2026-10-21 擷取。
- ④ binary 字串比對：用 `npm pack @anthropic-ai/claude-code-win32-x64@2.1.300` 取得舊 binary（270,863,520 bytes），與內嵌 2.1.306 逐字串計數。差異處另抽前後文比對，並把 minifier 改名的識別字遮掉，只看新增或移除的文字。
- ⑤ 兩版 `claude --help` 的 diff。
- ⑥ 兩版 hooks 實測：SDK 搭配 `extraArgs: { settings: <檔案> }`，等同 BAT 的 `--settings=` 注入。用不含帳號的空設定，只會得到 `Not logged in`，不呼叫模型、不耗 token。

**3a. 模型清單：沒有變動**

① 的原始輸出（欄位依序為 `value | resolvedModel | supportedEffortLevels | displayName | description`）：

```
default | claude-opus-5-5 | ["low","medium","high","xhigh","max"] | Default (recommended) | Use the default model (currently Opus 5.5) · $4/$20 per Mtok
opus | claude-opus-5-5 | ["low","medium","high","xhigh","max"] | Opus | Opus 5.5 · Best for everyday, complex tasks · $4/$20 per Mtok
fable | claude-fable-5-1 | ["low","medium","high","xhigh","max"] | Fable | Fable 5.1 · Most capable for your hardest and longest-running tasks · $10/$50 per Mtok
sonnet | claude-sonnet-5-5 | ["low","medium","high","xhigh","max"] | Sonnet | Sonnet 5.5 · Efficient for routine tasks · $2/$10 per Mtok
haiku | claude-haiku-5-5 | ["low","medium","high","xhigh","max"] | Haiku | Haiku 5.5 · Fastest for quick answers · $0.10/$0.50 per Mtok ($0.50/$2.50 for prompts over 100k)
```

- 與 2.1.300 的輸出逐字相同（見 T0541 3a）。`BAT_BUILTIN_MODELS` 與 `MODEL_LIMITS` 沒改。
- ② 2.1.301 – 2.1.306 沒有新增、改名或移除模型的條目，也沒有 `[1m]` 行。與模型有關的只有以下幾條，都不影響清單：
  - 2.1.301：`fable` / `best` alias 在組織沒有最新 Fable 時改用前一版重試
  - 2.1.301：切換到 context 較小的模型時，先用前一個模型摘要
  - 2.1.302：新增 `CLAUDE_CODE_AUTO_MODE_MODEL`
  - 2.1.305：subagent 改用 fallback model 時，顯示的模型名稱修正

**3b. 計價：沒有變動**

③ Model pricing 表原文：
- `Claude Opus 5.5 | $4 / MTok | $5 / MTok | $8 / MTok | $0.20 / MTok² | $20 / MTok`
- `Claude Fable 5.1 | $10 / MTok | $12.50 / MTok | $20 / MTok | $0.25 / MTok¹ | $50 / MTok`
- `Claude Sonnet 5.5 | $2 / MTok | $2.50 / MTok | $4 / MTok | $0.10 / MTok² | $10 / MTok`
- `Claude Haiku 5.5 (for prompts up to 100,000 tokens) | $0.10 | $0.125 | $0.20 | $0.01 | $0.50`
- `Claude Haiku 5.5 (for prompts over 100,000 tokens) | $0.50 | $0.625 | $1 | $0.05 | $2.50`
- 註 1：Fable 5.1 / Mythos 5.1 的 cache hit 為 `0.025x`。註 2：Opus 5.5 / Sonnet 5.5 的 cache hit 為 `0.05x`。

以上都與 `src/lib/model-pricing.ts:23-28` 一致，① description 裡的價格也一致。legacy 列（Opus 5 / 4.8 / 4.7 / 4.6 / 4.5、Sonnet 5、Fable 5、Opus 4.1 / 4）也與表內 `P()` 一致。因此 `model-pricing.ts` 和它的測試都沒改。

**3c. effort：沒有變動**

- ① 五個 alias 的 `supportedEffortLevels` 都是 `["low","medium","high","xhigh","max"]`，與 `EFFORT_LEVELS`（`src/types/index.ts`）的集合相同。
- ② 與 effort 相關的條目都是修正，沒有新增或移除等級：
  - 2.1.302 / 2.1.305：`/effort` 存到錯誤模型、`modelOverrides` 大小寫不符時沒套用
  - 2.1.304：`CLAUDE_CODE_EFFORT_LEVEL=auto|unset` 時顯示的值是猜的

**3d. `HEALTHY_MIN`：沒有變動**

- ② 2.1.301 – 2.1.306 沒有服務端版本門檻的條目，也沒有新模型。
- ④ `claude_code_version_too_old` 在兩版都出現 4 次。
- `HEALTHY_MIN` 維持 `2.1.280`（`electron/claude-resolver.ts:55`）。

**3e. update guard：仍有效**

- ④ 2.1.306 binary 內的決策片段為 `if(a.DISABLE_UPDATES)return{type:"env",envVar:"DISABLE_UPDATES"};if(e)return{type:"env",envVar:"DISABLE_AUTOUPDATER"}`，與 2.1.300 相同，仍先判斷 `DISABLE_UPDATES`。
- ④ `DISABLE_UPDATES` 10→10、`DISABLE_AUTOUPDATER` 12→12、`Updates are disabled by your administrator` 3→3。
- 實測：把 2.1.306 的 `claude.exe` 複製到 scratchpad，帶 `DISABLE_UPDATES=1` 與空的 `CLAUDE_CONFIG_DIR` 執行 `claude.exe update`。
  - 輸出：`Updates are disabled by your administrator. Contact your IT team to get the latest version.`，exit 0。
  - 執行前後 sha256 前 16 碼都是 `f6bc9de38f507c36`，沒有 `.old.*` 改名。
- ⑤ 2.1.306 的 `update` 說明多了一句 `package-manager installs update through the package manager`（說明文字修正，2.1.304 changelog 有記），不影響 guard。
- 結論：`claudeUpdateGuardEnv` 不需要改。

**3f. BAT 整合點：沒有變動**

旗標（⑤）：
- `--mcp-config <configs...>` 仍是 variadic，BAT 的 `=` 形式仍必要。
- `--settings <file-or-json>`、`-n, --name <name>` 的說明逐字沒變。
- `--help` 的 diff 只有 `--debug` 範例、`--disable-slash-commands`、`--json-schema`（only works with `--print`）、`-r, --resume`（可用 name）、`--system-prompt-snapshot`、`--tools`、`update` 這些說明文字，對應 2.1.304 changelog 的「`claude --help` text … to match actual behavior」。

hooks：
- ⑥ 用 `--settings=` 注入 async 的 `SessionStart` / `UserPromptSubmit` / `Stop` command hooks，兩版結果相同：`hooks ran: ["session-start","user-prompt-submit"]`。`Stop` 在沒有 turn 時兩版都不觸發，屬預期。
- 2.1.306 的 SDK 串流多出一筆 `hook_response SessionStart`：async SessionStart 回應改為 in-band 送出（④ 見 `holdResponse` / `isSessionEnvStale`）。BAT 的 `bat-hook.mjs` stdout 不輸出任何東西，不受影響。
- ⑥ 在 user `settings.json` 寫 `disableAllHooks: true` 後，`hooks ran: []`，所以 `disableAllHooks` 仍會關掉 `--settings` 注入的 hooks（T0590 / T0600 前提成立）。
- ④ `BAT_CLAUDE_HOOKS` 用到的事件名與 matcher 都還在：
  - 計數不變：`"Notification"` 13、`"PostToolUse"` 77、`"ElicitationResult"` 18、`"PostToolBatch"` 39、`"UserPromptSubmit"` 49、`elicitation_dialog` 3、`elicitation_url_dialog` 5、`elicitation_response` 13。
  - 計數有變：`"PermissionRequest"` 67→68、`"PreToolUse"` 120→126、`"Stop"` 68→69、`"SessionStart"` 47→45。抽出差異前後文後，都只是 minifier 改名或新增引用。SessionStart 的 input 建構 `hook_event_name:"SessionStart",source:` 仍為 1 次，事件清單 `["Notification","SessionStart","SessionEnd","Setup",…]` 仍在。
- ② 與 hooks 相關的條目都不影響 BAT 的 settings command hooks：
  - 2.1.302：prompt / agent hooks 同事件最多 12 個同時跑；BAT 用的是 command hooks
  - 2.1.304：skill hooks 的上限；skill 的 `allowed-tools` 在只允許 plugin hooks 的政策下不再保留
  - 2.1.305 VSCode：SessionStart spinner

其他設定：
- `autoContinueAtUsageLimit` 20→20。
- `allowManagedHooksOnly` 42→46，屬新增引用；`claudeHooksDisabledBy` 讀的鍵名不變。
- managed 設定路徑 `C:\Program Files\ClaudeCode` 1→1。

**3g. `usage-limit.ts` 句型：仍出現在新 binary，沒有變動**

④ 以下句型計數兩版相同：
- `You've hit your` 23
- `progress saved` 3
- `shared budget` 8
- `org is out of usage` 6
- `seat type doesn` 8
- `continuing automatically` 6
- `Usage limit reached` 14
- `Usage limit available again` 2
- `Continuing shortly` 2
- `Automatic continue stopped` 8
- `Automatic continue cancel` 14
- `Your usage limit has reset` 2
- `Press enter to continue` 2
- `ve reached your` 10

計數有變的四項，逐一抽差異前後文：
- `session limit` 24→26、`weekly limit` 17→23：新增 limit-reset 指令的訊息，如 `Session limit reset`、`Fable reset used · what Fable used is back in your weekly limit`、`Limits reset`、`Weekly limits reset`、`That isn't a reset name …`。其他是 minifier 改名。
- `monthly spend limit` 26→27：只有 minifier 改名，外加 changelog 文字本身。`You've hit your monthly spend limit` 的建構式仍在。
- `out of usage credits` 12→11：少的那一處是內嵌 changelog 文字。`You're out of usage credits${…}` 的建構式仍在。

新字串會不會被誤判：
- 上面這些新訊息，以及 2.1.304 的 `Resuming it will use … of your 5-hour usage limit.`、`Approaching your 5-hour usage limit — Claude will wrap up the current step.`，都不符合 `CLAUDE_LIMIT_RE` / `CLAUDE_BLOCKED_RE` / `CLAUDE_AUTO_RE` / `CLAUDE_RESUMED_RE` / `CLAUDE_STALE_*`。這些 regex 都要求行首是 `You've hit|reached your …`、`continuing automatically`、`Usage limit available again` 等。
- 結論：`src/lib/usage-limit.ts` 與測試都沒改。
- ② 2.1.301 / 2.1.305 的 `CLAUDE_CODE_RETRY_WATCHDOG_*_USAGE_LIMIT_*` 只用於 unattended retry 模式，沒有新的畫面句型。

**3h. 範圍外的附帶確認（沒改檔）**

④ 兩版計數相同，T0524 / T0568 / T0590 的觀察在 2.1.306 仍成立：
- 圖片貼上鍵 `"alt+v":"ctrl+v"` 1→1
- `ContainsImage()) { exit 1 }` 2→2
- `CLAUDE_CODE_DISABLE_MOUSE_CLICKS` 5→5
- `tengu_splendid_horizon` 2→2
- `"PermissionDenied"` 23→23

**3i. SDK 0.2.113 相容性**

- `supportedModels()` probe 與 hooks probe 都正常（V1 `query()` 搭配 `pathToClaudeCodeExecutable` / `options.env` / `extraArgs`）。
- V1 query、V2 session、forkSession、getSupportedModels 由既有測試覆蓋，全部綠燈（見「驗證結果」）。
- ② 2.1.302 起 `claude -p` 與 Agent SDK 預設開啟 fork subagent，且 subagent 自己的 Agent 呼叫改在前景跑。這是 CLI 端的行為變更，不改 SDK 協定；BAT 的 `activeTasks` 由 `tool_use` 追蹤，不受影響。實機留意事項見下方「需實機驗證」。
- **沒做**：實際呼叫模型的 smoke。它需要使用者的 credential，`CT_INTERACTIVE=0` 也無法徵詢（比照 T0541）。

#### 4. 寫死 `2.1.300` 的處置

| 位置 | 性質 | 處置 |
|---|---|---|
| `scripts/verify-native-modules.js:61`（stub 形狀註解） | 內嵌實裝版本的 stub 形狀 | 更新為 `2.1.289, 2.1.296, 2.1.300 and 2.1.306`；已用 2.1.306 tarball 實測，同樣是 500 bytes |
| `scripts/__tests__/verify-native-modules.test.mjs:28` | 同上 | 更新為 `2.1.289 / 2.1.296 / 2.1.300 / 2.1.306` |
| `CLAUDE.md:185`（「Claude Agent SDK / CLI」版本行） | 內嵌實裝版本 | 改為 `^2.1.306`（T0690） |
| `docs/agent-guide/claude-agent-sdk-cli.md:5 / :7 / :11 / :15 / :67` | 實裝版本、模型清單、effort、Runtime 版本鎖、`DISABLE_UPDATES` 實測 | :5 改為 `^2.1.306`（實裝 `2.1.306`），補 2026-10-21 T0690 追版紀錄，T0541 / T0483 / T0371 歷史敘述保留；:7 / :11 / :67 在原歷史列後補 2.1.306（T0690）；:15 版本鎖改為 `^2.1.306` |
| `docs/agent-guide/npm12-install-scripts.md:6 / :19` | 內嵌實裝版本（驗證 `--version` 的期望值） | :6 補「T0690 起為 `2.1.306`」（T0492 / T0541 歷史保留）；:19 改為「T0690 起 `2.1.306 (Claude Code)`」。**不在 `affects_files`**，依 `memory_overrides` 第 5 條「代表內嵌實裝版本 → 更新」處理，見「遭遇問題」 |
| `docs/agent-guide/claude-session-name.md:57`（「內嵌固定 2.1.300 線」） | 現況敘述（為什麼內嵌不檢查版本） | 改為「內嵌固定 2.1.306 線，T0690」。同樣**不在 `affects_files`**；同檔 :5 / :161 的 T0640 實測紀錄保留 |
| `tests/claude-resolver.test.ts:110-112`（`2.1.300 → healthy`） | 歷史樣本（T0541 時的內嵌版本） | 保留。不新增 `2.1.306` 案例：此檔不在 `affects_files`，D177 也不再往 `tests/` 加測試，而 `classifyVersion` 對 `>= 2.1.280` 一律 healthy，已有覆蓋 |
| `src/lib/usage-limit.ts:9`、`src/lib/__tests__/usage-limit.test.ts:4`、`docs/agent-guide/usage-limit-continue.md:9` | T0564 讀句型時的來源版本（歷史） | 不動；2.1.306 仍相同（見 3g） |
| `electron/bat-mcp-launch.ts:22 / :176`、`electron/terminal-blocked-state.ts:127`、`src/lib/terminal-context-menu.ts:5 / :112`、`e2e/t0571-…:47`、`docs/agent-guide/{bat-mcp-shim,blocked-state,terminal-context-menu,worker-launch-confirmation}.md` | 某一版 CLI 行為的觀察紀錄 | 不動；相關字串與旗標在 2.1.306 仍成立（見 3f / 3h） |
| `electron/__tests__/claude-version-check.test.ts`、`electron/remote/__tests__/headless-claude.test.ts:181`、`electron/__tests__/terminal-blocked-state.test.ts:541 / :1329`、`e2e/site-media.spec.ts:423` | 任意測試字串 | 不動 |
| `release-note.md:512 / :611` | 歷史版本說明 | 不動 |
| `2.1.280` / `2.1.251` / `2.1.289` 等門檻與最低版本 | 門檻值 | 不動 |

#### 5. 變更檔案

有改的：
- `package.json`、`package-lock.json`
- `CLAUDE.md`
- `docs/agent-guide/claude-agent-sdk-cli.md`
- `docs/agent-guide/npm12-install-scripts.md`、`docs/agent-guide/claude-session-name.md`（範圍偏差，見「遭遇問題」）
- `scripts/verify-native-modules.js`、`scripts/__tests__/verify-native-modules.test.mjs`（只改註解）
- 本工單

沒動的：
- `@anthropic-ai/claude-agent-sdk`
- `electron/claude-agent-manager.ts`、`electron/claude-resolver.ts`
- `src/lib/model-pricing.ts` 與它的測試
- `src/types/index.ts`、`src/lib/usage-limit.ts`

本單沒有啟動任何 BAT 實例（source build 或安裝版都沒有），沒碰使用者正在用的 BAT。

### 驗證結果

| AC | 結果 | 證據 |
|---|---|---|
| 內嵌 `--version` = 新版；`verify-native-modules` | ✅ PASS | `2.1.306 (Claude Code)`；`node scripts/verify-native-modules.js` exit 0（`embedded claude: native`） |
| lock diff 只涉及 claude-code 系列 | ✅ PASS | `36 insertions(+), 36 deletions(-)`；10 個變動條目都屬 claude-code 系列，外加 root dependencies 一行；重產比對實質差異 0 |
| `test:unit` / `test:legacy` / `vite build` / typecheck | ✅ PASS | 見下方清單 |
| 模型 / effort / 計價 / 門檻 / update guard / BAT 整合點 / 句型核對 | ✅ PASS | 全部沒有變動，證據見 3a–3g |
| 列出需實機驗證的項目 | ✅ | 見下方「需實機驗證」 |

第三項的明細（測試時 HEAD 為 `fc17392b` 加上本單的工作區變更，與之後的 commit `09509698` 內容相同）：
- `npm run test:unit` exit 0：`Test Files 326 passed (326)`，`Tests 5779 passed | 3 skipped (5782)`。
- `npm run test:legacy` exit 0：`legacy tests: files 33 passed, 0 failed / 33 total; tests 472 passed, 0 failed`，含 `tests/claude-resolver.test.ts` 20 passed、`tests/claude-code-path.test.ts` 4 passed。
- `npx vite build` exit 0。
- `npm run typecheck` exit 0。
- `npm run typecheck:electron` exit 0。

**需實機驗證**：
- **mac / Linux 內嵌 claude**：由 pre.5 CI 的 `verify-packaged-native` 加上實機，確認 `claude-code-<platform>-<arch>[-musl]/claude` 為 2.1.306。
- **Windows**：NSIS 完整重裝後，內嵌 claude `--version` 應為 `2.1.306 (Claude Code)`。
- **BAT 實機 Agent 面板**：開新 session 能正常對話（需要 credential，本單沒有實際呼叫模型）。模型下拉應與 2.1.300 時相同。另外留意 2.1.302 起 SDK 預設開啟 fork subagent、subagent 的 Agent 呼叫改在前景跑，看 active tasks bar 是否正常。
- **終端 claude-cli 分頁**：
  - BAT MCP（`--mcp-config=`）有載入。
  - hooks 狀態正常：⚠️ blocked、`agentStarted`。
  - `--name` 有顯示在 ListAgents。
  - Windows 上用 Alt+V 貼圖片正常（3f / 3h 已做靜態加 SDK 層確認）。

### Commit

- 產品 commit：`09509698`（`build: bump embedded claude CLI to 2.1.306 (T0690)`）。以 `git commit --only` 提交 8 個檔：`package.json`、`package-lock.json`、`CLAUDE.md`、3 份 `docs/agent-guide/*.md`、`scripts/verify-native-modules.js`、`scripts/__tests__/verify-native-modules.test.mjs`。
- 工單 commit：另一筆，只含本工單。
- 沒有 push、沒有觸發 workflow、沒有建 tag，也沒有用 `git stash` / `reset` / `checkout --` / `restore`。

### 遭遇問題

1. **範圍偏差（小）**：`docs/agent-guide/npm12-install-scripts.md`（:6 / :19）與 `docs/agent-guide/claude-session-name.md`（:57）不在 `affects_files`。這三處寫的是目前內嵌的版本，若不更新，文件會寫錯期望的 `--version`。我依 `memory_overrides` 第 5 條「代表內嵌實裝版本（更新）」處理，每處只改版本號與單號，歷史敘述保留。塔台若認為不應改，可在合併前退回這三行。
2. 我自己寫的 lock 移植腳本第一版有 bug：root dependencies 那一行被 HEAD 蓋回。比對時發現（REAL 9、缺 root 行），修正後重跑，結果為 REAL 10、META-ONLY 0。寫進 repo 的是修正後的版本。

**觀察（非本單範圍）**：
1. 2.1.306 的 auto-continue 字串另有一種 `Usage limit reset · continuing automatically`。`CLAUDE_AUTO_RE` 只認行首是 `Usage limit reached[ again] · ` 或直接以 `continuing automatically` 開頭，所以這句不會被辨識成 `claude-cli-auto`。不過這個字串在 2.1.300 已存在（`continuing automatically` 計數 6→6），不是本次升版造成。實際影響要看它出現的時機：它是 reset 後的提示，不是撞到限制時的句子。若要處理，另開單評估。
2. 價目頁仍列 `Claude Mythos 5.1`（limited availability），CLI 2.1.306 的模型清單仍然沒有它，與 T0541 觀察相同。

### 互動紀錄

無（`CT_MODE=yolo`、`CT_INTERACTIVE=0`，沒有向塔台提問）。

### 回報時間

2026-10-21T22:29:49+08:00
