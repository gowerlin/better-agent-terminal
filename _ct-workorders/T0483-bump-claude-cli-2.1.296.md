---
schema_version: 1
schema_kind: workorder
id: T0483
title: "內嵌 claude CLI 追版：@anthropic-ai/claude-code ^2.1.289 → ^2.1.296（含平台子套件），核對模型清單 / effort / 服務端版本門檻，SDK 維持 0.2 線"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-10-13T22:53:16+08:00"
started_at: "2026-10-13T22:54:14+08:00"
updated_at: "2026-10-13T23:01:55+08:00"
completed_at: "2026-10-13T23:01:55+08:00"
target_version: v0.6.0-pre.5
depends_on: []
related:
  - "CLAUDE.md「Claude Agent SDK / CLI」：內嵌 CLI 落後即功能故障，每次預覽版發布前追版；SDK 刻意留在 0.2 線（D123）"
  - "T0371（前次追版 2.1.113 → 2.1.289 的做法與驗證項目）"
  - "T0473（allowScripts：`@anthropic-ai/claude-code` 已放行）；T0475（mac / Linux 內嵌 claude 指向 `claude-code-<platform>-<arch>[-musl]/claude`）"
affects_files:
  - package.json
  - package-lock.json
  - CLAUDE.md
  - electron/claude-agent-manager.ts
  - electron/claude-resolver.ts
  - src/lib/model-pricing.ts
  - src/lib/__tests__/model-pricing.test.ts
  - scripts/verify-native-modules.js
  - scripts/__tests__/
  - tests/claude-resolver.test.ts
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權修改 `package.json` 的 `@anthropic-ai/claude-code` 版本與對應 `package-lock.json` 變動（含 `@anthropic-ai/claude-code-*` 平台子套件）；其他相依**不得**連帶升版（lock diff 只能涉及 claude-code 系列，回報區附 diff 摘要）"
  - "🔴 `@anthropic-ai/claude-agent-sdk` 不動（D123：留 0.2 線）"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime"
  - "🔴 價格只能取自官方來源並在回報區附出處；查不到就不改計價表"
---

# T0483 — 內嵌 claude CLI 追版 2.1.296

## 背景

- 內嵌 `@anthropic-ai/claude-code` 實裝 `2.1.289`；`npm view @anthropic-ai/claude-code version` = `2.1.296`（2026-10-13 22:50 塔台查詢）
- 服務端以 CLI 版本擋新模型（`claude_code_version_too_old`），內嵌落後即可能功能故障

## 實作

1. 開工時再查一次 `npm view @anthropic-ai/claude-code version`；若已高於 2.1.296，取當下最新並在回報區說明
2. `package.json` 版本改為 `^<新版>`；`npm install`（或等效）更新 lock；確認 lock diff 只含 claude-code 本體與 `@anthropic-ai/claude-code-*` 子套件
3. 本機驗證內嵌 binary：`node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` = 新版；`node scripts/verify-native-modules.js` exit 0
4. 核對新版變化（以 CLI 實際輸出 / 套件內容 / 官方 changelog 為準，回報區附證據）：
   - 模型清單：有無新模型 ID 或改名 → 需要時更新 `BAT_BUILTIN_MODELS`（`electron/claude-agent-manager.ts`）；新模型的計價只在找得到官方價目時才加（`src/lib/model-pricing.ts` + 測試，point release 排在 base 前）
   - `supportedEffortLevels` 是否變動（`EFFORT_LEVELS`，`src/types/index.ts`）
   - 新模型的 CLI 版本門檻是否影響 `HEALTHY_MIN`（`electron/claude-resolver.ts`）—— 只在有證據時調整
   - `DISABLE_UPDATES` / `DISABLE_AUTOUPDATER` 行為是否仍有效（`claudeUpdateGuardEnv`）
   - 與 SDK 0.2.113 的相容性：Agent session（V1 query / V2 session / forkSession / getSupportedModels）以既有單元 / 整合測試覆蓋；如有可在 isolated runtime 執行的 smoke，回報結果
5. 測試與註解中寫死 `2.1.289` 的地方（`electron/remote-tools/__tests__/parse.test.ts`、`scripts/__tests__/*`、`tests/claude-resolver.test.ts`、`scripts/verify-native-modules.js` 等）：區分「代表內嵌實裝版本」（應更新）與「任意測試字串 / 歷史門檻」（不動），回報區逐一列出處置
6. CLAUDE.md「Claude Agent SDK / CLI」節更新實裝版本、日期與本單編號；歷史敘述（T0371 / T0368）保留

## 驗收條件

- [ ] 內嵌 `claude.exe --version` = 新版；`verify-native-modules` ✅
- [ ] lock diff 只涉及 claude-code 系列（回報區附 `git diff --stat package-lock.json` 與套件清單）
- [ ] `npm run test:unit` 全綠（回報 files / passed / skipped）；`npx vite build` exit 0；`npx tsc --noEmit -p .` 不高於基線 36
- [ ] 模型 / effort / 門檻核對結果（有改或無改都要附證據）
- [ ] 回報區列出需實機驗證項目（mac / Linux 內嵌 claude 由 pre.5 CI 的 `verify-packaged-native` 與實機確認）

## Sub-session 執行指示

1. 讀本工單 + CLAUDE.md「Claude Agent SDK / CLI」+ T0371 回報區 + 上列 affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

**DONE**：內嵌 CLI 從 `2.1.289` 升到 `2.1.296`；新增 `claude-haiku-5-5` builtin 與計價；Sonnet 5.5 cache read 依官方價目改為 0.05x。驗收 5 項全數 PASS。

- **Landing Zone**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` ✅；C-1 PASS（工單在 `REPO_ROOT/_ct-workorders/`）；C-3 PASS（前 5 筆非萬用字元 `affects_files` 全部存在）；C-2 無 `branch` 欄位（HEAD = `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅作證據）。
- **派發模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`（無互動，沒有 Q/A）。
- **環境**：npm 12.2.0 / Node v24.21.0。

### 1. 版本與依賴

- 開工時查 `npm view @anthropic-ai/claude-code dist-tags`，結果為 `{ stable: '2.1.287', next: '2.1.296', latest: '2.1.296' }`。`latest` 仍是 2.1.296，沒有高於目標，照用。2.1.296 的發佈時間為 `2026-10-09T16:58:10.924Z`（npm `time`）。
- `package.json`：`@anthropic-ai/claude-code` 從 `^2.1.289` 改為 `^2.1.296`。`@anthropic-ai/claude-agent-sdk` 維持 `^0.2.111`（`npm ls` 實裝 `0.2.113`，D123）。
- 執行 `npm install "@anthropic-ai/claude-code@^2.1.296"`：postinstall 有跑（`allowScripts` 已放行，T0473）。結尾只剩預期中的 `electron-winstaller` 未放行警告。
- **lock 處理**（比照 T0371）：npm 原生產出的 lock 有 `127` 行變動，其中 43 個套件只有 `peer` 旗標雜訊（`@babel/core`、`vite`、`react`、`typescript` 等），`version`/`resolved`/`integrity` 都沒變。因此改用 scratchpad 的 `transplant.mjs`，從 HEAD lock 只移植三樣東西：`node_modules/@anthropic-ai/claude-code`、`node_modules/@anthropic-ai/claude-code-*` 條目，以及 root `packages[""].dependencies` 的那一行。
  - `git diff --stat package-lock.json` 結果：`1 file changed, 36 insertions(+), 36 deletions(-)`
  - 逐套件比對 HEAD 與移植後的 lock（`lockcmp2.mjs`），只有 10 項變動：
    - `(root) dependencies`
    - `@anthropic-ai/claude-code`（version/resolved/integrity/optionalDependencies）
    - 8 個平台子套件，皆只動 version/resolved/integrity：`claude-code-darwin-arm64`、`-darwin-x64`、`-linux-arm64`、`-linux-arm64-musl`、`-linux-x64`、`-linux-x64-musl`、`-win32-arm64`、`-win32-x64`。與升版前同樣是這 8 個。
  - **重產比對**：把 `package.json` 與移植後的 lock 複製到 scratchpad，跑 `npm install --package-lock-only --ignore-scripts`（exit 0）。逐套件比對結果為 `43 META-ONLY`，實質差異 0。

### 2. 內嵌 binary

- `node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` 輸出 `2.1.296 (Claude Code)`。`bin/claude.exe` 與 `claude-code-win32-x64/claude.exe` 都是 260,489,376 bytes、hardlink count 2，沒有 `.old.*` 殘骸。
- `node scripts/verify-native-modules.js` exit 0（`embedded claude: native, better-sqlite3: .node present`）。
- stub 偵測仍有效：`npm pack @anthropic-ai/claude-code@2.1.296` 取得的 `bin/claude.exe` 仍是 500 bytes 的 shell script，文字含 `claude native binary not installed`。`classifyEmbeddedClaude()` 把它判為 `{"status":"stub","size":500}`，實裝 binary 判為 `{"status":"native","format":"pe"}`。

### 3. 新版變化核對

證據來源：
- ① CLI 2.1.296 `supportedModels()` 實測：用 repo 的 SDK 0.2.113 搭配內嵌 binary，`CLAUDE_CONFIG_DIR` 指向 scratchpad 空目錄，沒有呼叫模型。
- ② 官方 changelog `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`，看 2.1.290 – 2.1.296，2026-10-13 下載。
- ③ `https://platform.claude.com/docs/en/about-claude/pricing` 與 `https://platform.claude.com/docs/en/models/overview`，2026-10-13 擷取。
- ④ binary 內的字串。

**3a. 模型清單：有變動，已更新**

① 的原始輸出（節錄 `value` / `resolvedModel` / `supportedEffortLevels`）：

```
default | claude-opus-5-5   | ["low","medium","high","xhigh","max"]
opus    | claude-opus-5-5   | ["low","medium","high","xhigh","max"]
fable   | claude-fable-5-1  | ["low","medium","high","xhigh","max"]
sonnet  | claude-sonnet-5-5 | ["low","medium","high","xhigh","max"]
haiku   | claude-haiku-5-5  | ["low","medium","high","xhigh","max"]   ← 2.1.289 時為 claude-haiku-4-5-20251001
haiku description: "Haiku 5.5 · Fastest for quick answers · $0.10/$0.50 per Mtok ($0.50/$2.50 for prompts over 100k)"
```

- ② 2.1.293 原文：`Added Claude Haiku 5.5 (claude-haiku-5-5), now the default Haiku model on the Anthropic API — 1M context, $0.10/$0.50 per Mtok ($0.50/$2.50 for prompts over 100K)`。
- ③ models overview：`claude-haiku-5-5` 的 context 為 1M、max output 128K、Thinking `Adaptive`、default effort `medium`。
- 處置：`BAT_BUILTIN_MODELS` 在 `claude-sonnet-5-5` 之後插入 `{ value: 'claude-haiku-5-5', displayName: 'Haiku 5.5 (1M)', description: 'claude-haiku-5-5 · 1M context' }`。`claude-haiku-4-5-20251001` 保留（legacy，尚未退役）。加入後，SDK 的 `haiku` alias 因 `resolvedModel` 已是 builtin，依 T0372 規則自動去重；不加的話，下拉會出現 alias `haiku`。
- 沒有改名，也沒有其他新 ID；5 系列仍不列 `[1m]` 行。

**3b. 計價：有變動，已更新（只取官方價目頁 ③）**

③ pricing 表原文：
- `Claude Sonnet 5.5 | $2 / MTok | $2.50 / MTok | $4 / MTok | $0.10 / MTok² | $10 / MTok`。註 2：`Cache hits and refreshes on Claude Opus 5.5 and Claude Sonnet 5.5 are priced at 0.05x the base input price.` T0368 在 2026-10-04 記的是 $0.20 / 0.1x；② 2.1.296 也寫了 `price Sonnet 5.5 cache reads at $0.10 per million tokens (was $0.20)`。
- `Claude Haiku 5.5 (for prompts up to 100,000 tokens) | $0.10 | $0.125 | $0.20 | $0.01 | $0.50`
- `Claude Haiku 5.5 (for prompts over 100,000 tokens) | $0.50 | $0.625 | $1 | $0.05 | $2.50`
- Long context pricing 節：`Claude Haiku 5.5 is priced by prompt length: a request whose prompt is over 100,000 tokens pays higher prices. A request's prompt length counts all of its input tokens, including cache reads and cache writes.`

`src/lib/model-pricing.ts` 的處置：
- `'sonnet-5-5'` 從 `P(2, 10)` 改為 `P(2, 10, { cacheReadMultiplier: 0.05 })`。
- 新增 `'haiku-5-5': P(0.10, 0.50)` 與 `'haiku-5-5-long': P(0.50, 2.50)`。cache write 為 1.25x / 2x、cache read 為 0.1x，數字與 ③ 逐項吻合。
- `getModelPricing(model, opts?: { promptTokens?: number })`：
  - `haiku-5-5` 排在最前面，不會落入 `haiku-4` / `haiku-3` 規則。
  - `promptTokens > 100_000`（`HAIKU_5_5_LONG_PROMPT_THRESHOLD`）時回傳 long 價，沒給時回傳 ≤100K 價。
  - 既有呼叫端只傳一個參數，行為不變。

測試（`src/lib/__tests__/model-pricing.test.ts`）：
- Sonnet 5.5 的 cache read 期望值從 0.2 改為 0.1。
- 新增 Haiku 5.5 的案例：≤100K、恰好 100,000（仍是低價）、100,001（高價）。
- 新增：`promptTokens` 不影響其他模型；Haiku 5.5 與 4.5 互不遮蔽。

**3c. effort：沒有變動**

① 五個 alias 的 `supportedEffortLevels` 都是 `["low","medium","high","xhigh","max"]`，與 `EFFORT_LEVELS`（`src/types/index.ts:181`）的集合相同，所以沒改。② 2.1.290 – 2.1.296 的 effort 條目都是 bug fix，沒有新增或移除等級：
- `/model` ←/→ 會繞過最高或最低等級
- Max 不再被存成新 session 的預設
- fallback 重試時 effort 會改變
- xhigh/max 下 web search 變慢

**3d. `HEALTHY_MIN`：沒有變動**

② 2.1.290 – 2.1.296 沒有任何服務端版本門檻的條目。Haiku 5.5 雖在 2.1.293 加入，但沒有看到 `claude_code_version_too_old` 這類門檻證據（本單也沒有用舊 CLI 呼叫 Haiku 5.5）。依工單「只在有證據時調整」，`HEALTHY_MIN` 維持 `2.1.280`。

**3e. `DISABLE_UPDATES` / `DISABLE_AUTOUPDATER`：仍有效**

- ④ 2.1.296 binary 內的決策函式：`function VAe(){return eA(Fe(process.env.DISABLE_AUTOUPDATER))}function eA(e){if(a.DISABLE_UPDATES)return{type:"env",envVar:"DISABLE_UPDATES"};if(e)return{type:"env",envVar:"DISABLE_AUTOUPDATER"};...if(r.autoUpdates===!1&&(r.installMethod!=="native"||r.autoUpdatesProtectedForNative!==!0))return{type:"config"};return null}`。與 T0368 第 5 節相同，先判斷 `DISABLE_UPDATES`，再判斷 `DISABLE_AUTOUPDATER`。
- 實測：把 2.1.296 的 `claude.exe` 複製到 scratchpad，以 `DISABLE_UPDATES=1` 加空的 `CLAUDE_CONFIG_DIR` 執行 `claude.exe update`，輸出 `Updates are disabled by your administrator. Contact your IT team to get the latest version.`。執行前後 sha256 前 16 碼都是 `76de74f7694a5bdc`，檔案沒被改名。`claudeUpdateGuardEnv` 不需要改。

**3f. SDK 0.2.113 相容性**

- `supportedModels()` probe 正常回傳，見 3a。設定為 V1 `query()`，`pathToClaudeCodeExecutable` 指向內嵌 2.1.296，`options.env` 帶 `DISABLE_UPDATES`。
- V1 query、V2 session、forkSession、getSupportedModels 由既有單元 / 整合測試覆蓋，全部綠燈（見第 6 節）。② 2.1.292 有一條 SDK 相關修正：以前 `claude -p` 與 Agent SDK run 會在最終結果 5 秒後停掉背景命令，現在改為等它跑完。這是行為改善。
- **沒做**：實際的模型呼叫 smoke。它需要使用者的 credential，而 `CT_INTERACTIVE=0` 無法徵詢；比照 T0371，須另行授權。

### 4. 寫死 `2.1.289` 的處置

| 位置 | 性質 | 處置 |
|---|---|---|
| `scripts/verify-native-modules.js:63`（stub 形狀註解） | 內嵌實裝版本的 stub 形狀 | 更新為 `2.1.289 and 2.1.296`（已用 2.1.296 tarball 實測，同為 500 bytes） |
| `scripts/__tests__/verify-native-modules.test.mjs:28`（同上） | 同上 | 更新為 `2.1.289 / 2.1.296` |
| `tests/claude-resolver.test.ts:100` `2.1.289 → healthy` | 歷史樣本（T0372 時的內嵌版） | 保留，另加 `2.1.296 → healthy` |
| `scripts/__tests__/smoke-remote-headless.test.mjs:507/866` | 任意「healthy 版本」fixture | 不動 |
| `electron/remote-tools/__tests__/parse.test.ts:245/279/304/371/432` | 解析器的任意測試字串 | 不動 |
| `electron/claude-resolver.ts:307`（`CLI >= 2.1.289 honors DISABLE_UPDATES`） | 歷史最低版本 | 不動 |
| `electron/claude-agent-manager.ts:1753`（`CLI >= 2.1.289 also reports resolvedModel`） | 歷史最低版本 | 不動 |
| `src/lib/__tests__/claude-error-classify.test.ts`、locales、`HEALTHY_MIN` 相關的 `2.1.280` / `2.1.251` | 服務端門檻 | 不動 |
| CLAUDE.md | 見第 5 節 | 更新實裝版本，保留歷史敘述 |

### 5. CLAUDE.md

- 「Claude Agent SDK / CLI」節：
  - 實裝版本改為 `^2.1.296` / `2.1.296`，補上 2026-10-13 T0483 追版紀錄與 2.1.293 的 Haiku 5.5。
  - `BAT_BUILTIN_MODELS` 加入 `claude-haiku-5-5`。
  - 計價段補上 Haiku 5.5 分段計價、Sonnet 5.5 0.05x，以及面板沒傳 `promptTokens` 的限制。
  - effort 段補上「2.1.296 的 Haiku 5.5 同樣是 5 級」。
  - T0371 / T0368 的歷史敘述保留。
- Runtime Selection：改為「版本鎖在 `^2.1.296`」。
- `DISABLE_UPDATES` 段：補上 2.1.296 實測仍會拒絕。
- npm 12 段有兩處寫 `--version` = `2.1.289`：保留 T0473 當時的事實，加註 T0483 之後為 `2.1.296`。

### 6. 驗收條件

| AC | 結果 | 證據 |
|---|---|---|
| 內嵌 `--version` = 新版；`verify-native-modules` | ✅ PASS | 輸出 `2.1.296 (Claude Code)`；`verify-native-modules.js` exit 0 |
| lock diff 只涉及 claude-code 系列 | ✅ PASS | `36 insertions(+), 36 deletions(-)`；10 個變動條目全屬 claude-code 系列，加上 root dependencies 一行；重產比對實質差異 0 |
| `npm run test:unit` / `vite build` / `tsc` | ✅ PASS | unit test 開工基線 `176 passed (176)` / `3009 passed \| 1 skipped (3010)`，完成後 `176 passed (176)` / `3015 passed \| 1 skipped (3016)`（+6 為新增的計價測試）。`npx vite build` exit 0。`npx tsc --noEmit -p .` 基線 36、完成後 36，去掉行列號後錯誤集合完全相同。另跑 `npx tsx tests/claude-resolver.test.ts`：`19 passed, 0 failed`；`npm run test:claude-code-path`：`4 passed, 0 failed` |
| 模型 / effort / 門檻核對 | ✅ PASS | 見第 3 節。模型：加 Haiku 5.5；計價：Sonnet 5.5 cache read、Haiku 5.5；effort：沒變；`HEALTHY_MIN`：沒變；update guard：仍有效 |
| 列出需實機驗證的項目 | ✅ | 見第 8 節 |

### 7. 變更檔案

- `package.json`、`package-lock.json`
- `electron/claude-agent-manager.ts`（`BAT_BUILTIN_MODELS` 多 1 行）
- `src/lib/model-pricing.ts`、`src/lib/__tests__/model-pricing.test.ts`
- `scripts/verify-native-modules.js`、`scripts/__tests__/verify-native-modules.test.mjs`（只改註解）
- `tests/claude-resolver.test.ts`
- `CLAUDE.md`
- 本工單

沒動的：`@anthropic-ai/claude-agent-sdk`、`src/types/index.ts`（`EFFORT_LEVELS`）、`electron/claude-resolver.ts`（`HEALTHY_MIN` / `claudeUpdateGuardEnv`）、Claude / Codex 面板。沒有啟動任何 BAT 實例（本單不需要 `--runtime`）。

### 8. 需實機驗證

- BAT 實機（dev 或打包版）：
  - 模型下拉出現 `Haiku 5.5 (1M)`，且不再出現 alias `haiku`。
  - 選 Haiku 5.5 能正常對話。需要 credential，本單沒做模型呼叫。
- Cache History：
  - Sonnet 5.5 的 cache read 成本變成原本的一半。
  - Haiku 5.5 有顯示成本（≤100K 價）。
- mac / Linux 內嵌 claude：由 pre.5 CI 的 `verify-packaged-native` 與實機確認 `claude-code-<platform>-<arch>/claude` 為 2.1.296。
- Windows NSIS 完整重裝後，內嵌 claude `--version` 為 2.1.296。

### 9. 觀察 / 建議後續（非本單範圍）

1. **Haiku 5.5 長 prompt 的成本會被低估**：Claude / Codex 面板呼叫 `getModelPricing(model)` 時沒傳 `promptTokens`，所以 Haiku 5.5 一律以 ≤100K 價計算，超過 100K 的請求會低估 5 倍。
   - 面板的 per-model 統計（`ClaudeAgentPanel.tsx:3715` 一帶）是跨呼叫累加的，拿不到單次 prompt 長度。
   - per-turn 列（:3732）可以用該列的 `totalInput` 判斷。
   - API 已備好，建議另開小單接線。
2. `setModel()`（`claude-agent-manager.ts:1697-1699`）的顯示用推估對 5 系列都不準（含 Haiku 5.5 的實際值 1M / 128K）：
   - 非 `[1m]` 一律設 `contextWindow = 200000`。
   - 名稱含 `haiku` 一律設 `maxOutputTokens = 8192`。
   
   下一次 query 回應的 `modelUsage` 會覆蓋這兩個值。這是既有行為，本單沒動。
3. Haiku 5.5 的 CLI 版本門檻未知（它在 2.1.293 加入）。如果服務端對它設了門檻，system runtime 版本在 2.1.280 – 2.1.292 的使用者會被擋，但 `HEALTHY_MIN` 不會提示。等有 `claude_code_version_too_old` 的證據再調。

### Commit

見下方 metadata 與塔台通知；commit hash 由 closeout 後的 `git log` 取得（本單 commit message 含 `T0483`，未 push）。

### 回報時間

2026-10-13T23:00:50+08:00
