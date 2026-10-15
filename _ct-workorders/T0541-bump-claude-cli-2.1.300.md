---
schema_version: 1
schema_kind: workorder
id: T0541
title: "內嵌 claude CLI 追版：@anthropic-ai/claude-code ^2.1.296 → ^2.1.300（含平台子套件），核對模型清單 / effort / 服務端版本門檻，SDK 維持 0.2 線"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-10-15T17:41:45+0800"
updated_at: "2026-10-15T17:42:32+08:00"
started_at: "2026-10-15T17:42:32+08:00"
target_version: "0.6.1-pre.3"
depends_on: []
related:
  - "CLAUDE.md「Claude Agent SDK / CLI」：內嵌 CLI 落後即功能故障，每次預覽版發布前追版；SDK 刻意留在 0.2 線（D123）"
  - "T0483（前次追版 2.1.289 → 2.1.296 的做法與驗證項目，照同一套流程）"
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
  - _ct-workorders/T0541-bump-claude-cli-2.1.300.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權修改 `package.json` 的 `@anthropic-ai/claude-code` 版本與對應 `package-lock.json` 變動（含 `@anthropic-ai/claude-code-*` 平台子套件）；其他相依**不得**連帶升版（lock diff 只能涉及 claude-code 系列，回報區附 diff 摘要）"
  - "🔴 `@anthropic-ai/claude-agent-sdk` 不動（D123：留 0.2 線）"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime。不碰使用者正在用的 BAT（port 9876）。"
  - "🔴 價格只能取自官方來源並在回報區附出處；查不到就不改計價表"
  - "🔴 `package.json` 的 `version` 欄位不要動（塔台發版時另行處理）。"
---

# T0541 — 內嵌 claude CLI 追版 2.1.300

## 背景

- 內嵌 `@anthropic-ai/claude-code` 實裝 `2.1.296`（T0483）；`npm view @anthropic-ai/claude-code version` = `2.1.300`（2026-10-15 17:41 塔台查詢；npm 發佈時間 2.1.299 = 2026-10-14T00:23Z、2.1.300 = 2026-10-14T14:27Z）
- 使用者指示「先追版內嵌 Claude CLI，然後發 pre.3」：本單完成後塔台即發 `0.6.1-pre.3`

## 實作

照 T0483「實作」1–6 步驟，版本號換成本單：

1. 開工時再查一次 `npm view @anthropic-ai/claude-code version`；若已高於 2.1.300，取當下最新並在回報區說明
2. `package.json` 改為 `^<新版>`；更新 lock；確認 lock diff 只含 claude-code 本體與 `@anthropic-ai/claude-code-*` 子套件
3. 內嵌 binary：`node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` = 新版；`node scripts/verify-native-modules.js` exit 0
4. 核對新版變化（以 CLI 實際輸出 / 套件內容 / 官方 changelog 為準，附證據）：模型清單（`BAT_BUILTIN_MODELS`、`MODEL_LIMITS`、計價表）、`supportedEffortLevels`（`EFFORT_LEVELS`）、服務端門檻與 `HEALTHY_MIN`、`DISABLE_UPDATES` / `DISABLE_AUTOUPDATER` 是否仍有效、SDK 0.2.113 相容性（既有測試）
5. 測試 / 註解中寫死 `2.1.296` 的地方：區分「代表內嵌實裝版本」（更新）與「任意測試字串 / 歷史門檻」（不動），逐一列出處置
6. CLAUDE.md「Claude Agent SDK / CLI」與「本機開發：npm 12 install scripts」中的實裝版本、日期、本單編號；歷史敘述保留

## 驗收條件

- [ ] 內嵌 `claude.exe --version` = 新版；`verify-native-modules` ✅
- [ ] lock diff 只涉及 claude-code 系列（附 `git diff --stat package-lock.json` 與套件清單）
- [ ] `npm run test:unit` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0
- [ ] 模型 / effort / 門檻核對結果（有改或無改都要附證據）
- [ ] 回報區列出需實機驗證項目（mac / Linux 內嵌 claude 由 pre.3 CI 的 `verify-packaged-native` 與實機確認）

## 回報區

### 完成狀態

**DONE**：內嵌 CLI 從 `2.1.296` 升到 `2.1.300`。新版沒有帶來模型清單、effort、計價、`HEALTHY_MIN`、update guard 任何一項的變動，所以產品程式碼沒有改。驗收 5 項全數 PASS。

- **Landing Zone**：PASS。
  - C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，兩者相同 ✅
  - C-1：PASS（工單位於 `REPO_ROOT/_ct-workorders/`）
  - C-3：PASS（前 5 筆非萬用字元的 `affects_files` 都存在）
  - C-2：工單沒有 `branch` 欄位（HEAD = `main`）
  - `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只當證據記錄）
- **派發模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`，所以沒有 Q/A。
- **環境**：npm 12.2.0、Node v24.22.0。

### 1. 版本與依賴

- 開工時查 `npm view @anthropic-ai/claude-code dist-tags`，結果是 `{ stable: '2.1.292', latest: '2.1.300', next: '2.1.300' }`。latest 仍是 2.1.300，照用。
  - 發佈時間（npm `time`）：2.1.299 = `2026-10-14T00:23:19.588Z`，2.1.300 = `2026-10-14T14:27:26.554Z`。
  - npm 上沒有 2.1.297 / 2.1.298 這兩版。
- `package.json`：
  - `@anthropic-ai/claude-code` 從 `^2.1.296` 改為 `^2.1.300`。
  - `@anthropic-ai/claude-agent-sdk` 維持 `^0.2.111`，`npm ls` 實裝 `0.2.113`（D123）。
  - `version` 欄位沒動。
- 執行 `npm install "@anthropic-ai/claude-code@^2.1.300"`，postinstall 有跑。結尾只剩預期中的 `electron-winstaller` 未放行警告。
- **lock 處理**（比照 T0483）：
  - npm 原生產出的 lock 有 127 行變動，其中 43 個套件只動了 `peer` 等旗標，屬雜訊。
  - 因此改用 scratchpad 的 `transplant.mjs`，以 HEAD 的 lock 為底，只移植以下兩樣：claude-code 本體與 `claude-code-*` 子套件的條目，以及 root `packages[""].dependencies` 那一行。
  - `git diff --stat package-lock.json` 結果為 `1 file changed, 36 insertions(+), 36 deletions(-)`。
- **逐套件比對**（`lockcmp.mjs`，HEAD 對移植後）：共 10 項變動，`META-ONLY 0`。
  - `(root) dependencies`
  - `@anthropic-ai/claude-code`：version / resolved / integrity / optionalDependencies
  - 8 個平台子套件，都只動 version / resolved / integrity：`claude-code-darwin-arm64`、`-darwin-x64`、`-linux-arm64`、`-linux-arm64-musl`、`-linux-x64`、`-linux-x64-musl`、`-win32-arm64`、`-win32-x64`。與升版前是同一組 8 個。
- **重產比對**：把 `package.json` 與移植後的 lock 複製到 scratchpad，跑 `npm install --package-lock-only --ignore-scripts`（exit 0）。比對結果為 `META-ONLY 43`，實質差異 0。

### 2. 內嵌 binary

- `node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` 輸出 `2.1.300 (Claude Code)`。
  - `bin/claude.exe` 與 `claude-code-win32-x64/claude.exe` 都是 270,863,520 bytes，hardlink count 2。
  - 沒有殘留的 `.old.*` 檔。
- `node scripts/verify-native-modules.js` exit 0，輸出 `embedded claude: native`。
- stub 偵測仍有效：
  - `npm pack @anthropic-ai/claude-code@2.1.300` 取得的 `bin/claude.exe` 是 500 bytes，內容含 `claude native binary not installed`。
  - `classifyEmbeddedClaude()` 對它回傳 `{"status":"stub","size":500}`。
  - 對實裝的 binary 則回傳 `{"status":"native","format":"pe"}`。

### 3. 新版變化核對

證據來源：
- ① CLI 2.1.300 的 `supportedModels()` 實測。用 repo 的 SDK 0.2.113 搭配內嵌 binary（`pathToClaudeCodeExecutable`），`CLAUDE_CONFIG_DIR` 指向 scratchpad 的空目錄，`options.env` 帶 `DISABLE_UPDATES=1`，不呼叫模型。
- ② 官方 changelog `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`，2.1.299 – 2.1.300 兩節共 284 行，2026-10-15 下載。
- ③ 官方價目頁 `https://platform.claude.com/docs/en/about-claude/pricing.md`，2026-10-15 擷取。
- ④ binary 內的字串。

**3a. 模型清單：沒有變動**

① 的原始輸出（欄位依序為 `value | resolvedModel | supportedEffortLevels | displayName | description`）：

```
default | claude-opus-5-5   | ["low","medium","high","xhigh","max"] | Default (recommended) | Use the default model (currently Opus 5.5) · $4/$20 per Mtok
opus    | claude-opus-5-5   | ["low","medium","high","xhigh","max"] | Opus   | Opus 5.5 · Best for everyday, complex tasks · $4/$20 per Mtok
fable   | claude-fable-5-1  | ["low","medium","high","xhigh","max"] | Fable  | Fable 5.1 · Most capable for your hardest and longest-running tasks · $10/$50 per Mtok
sonnet  | claude-sonnet-5-5 | ["low","medium","high","xhigh","max"] | Sonnet | Sonnet 5.5 · Efficient for routine tasks · $2/$10 per Mtok
haiku   | claude-haiku-5-5  | ["low","medium","high","xhigh","max"] | Haiku  | Haiku 5.5 · Fastest for quick answers · $0.10/$0.50 per Mtok ($0.50/$2.50 for prompts over 100k)
```

- 與 2.1.296 的輸出完全相同（見 T0483 第 3a 節）。
- 4 個 `resolvedModel` 都已列在 `BAT_BUILTIN_MODELS`（`electron/claude-agent-manager.ts:31-34`），所以 `BAT_BUILTIN_MODELS` 與 `MODEL_LIMITS` 都沒改。
- ② 2.1.299 – 2.1.300 沒有新增、改名或移除模型的條目。與模型有關的只有以下幾條，都不影響清單：
  - agent hooks 的 `model` alias 解析修正
  - gateway 模型名稱的 compaction 修正
  - 切到不支援 auto mode 的模型時，會退出 auto mode
  - 未知模型 ID 的啟動警告改短
  - Claude 3 模型讀 PDF 的提示調整

**3b. 計價：沒有變動**

③ Model pricing 表原文：
- `Claude Opus 5.5 | $4 / MTok | $5 / MTok | $8 / MTok | $0.20 / MTok² | $20 / MTok`
- `Claude Fable 5.1 | $10 / MTok | $12.50 / MTok | $20 / MTok | $0.25 / MTok¹ | $50 / MTok`
- `Claude Sonnet 5.5 | $2 / MTok | $2.50 / MTok | $4 / MTok | $0.10 / MTok² | $10 / MTok`
- `Claude Haiku 5.5 (for prompts up to 100,000 tokens) | $0.10 | $0.125 | $0.20 | $0.01 | $0.50`
- `Claude Haiku 5.5 (for prompts over 100,000 tokens) | $0.50 | $0.625 | $1 | $0.05 | $2.50`
- 註 1：Fable 5.1 的 cache hit 為 `0.025x`。註 2：Opus 5.5 / Sonnet 5.5 的 cache hit 為 `0.05x`。

以上都與 `src/lib/model-pricing.ts:23-28` 一致，① description 裡的價格也一致。因此 `model-pricing.ts` 和它的測試都沒改。

**3c. effort：沒有變動**

- ① 五個 alias 的 `supportedEffortLevels` 都是 `["low","medium","high","xhigh","max"]`，與 `EFFORT_LEVELS`（`src/types/index.ts:197`）的集合相同。
- ② 有兩條與 effort 相關，都沒有新增或移除等級：
  - 2.1.299：agent view 新增 `/effort` picker（UI 功能）
  - 2.1.299：`/usage` 新增 max effort 警告

**3d. `HEALTHY_MIN`：沒有變動**

② 2.1.299 – 2.1.300 沒有任何服務端版本門檻的條目（`claude_code_version_too_old`），也沒有新模型。依工單「只在有證據時調整」，`HEALTHY_MIN` 維持 `2.1.280`（`electron/claude-resolver.ts:55`）。

**3e. `DISABLE_UPDATES` / `DISABLE_AUTOUPDATER`：仍有效**

- ④ 2.1.300 binary 內的決策片段為 `if(a.DISABLE_UPDATES)return{type:"env",envVar:"DISABLE_UPDATES"};if(e)return{type:"env",envVar:"DISABLE_AUTOUPDATER"}`。順序與 T0483 相同：先判斷 `DISABLE_UPDATES`，再判斷 `DISABLE_AUTOUPDATER`。
- 實測：把 2.1.300 的 `claude.exe` 複製到 scratchpad，帶 `DISABLE_UPDATES=1` 與空的 `CLAUDE_CONFIG_DIR` 執行 `claude.exe update`。
  - 輸出：`Updates are disabled by your administrator. Contact your IT team to get the latest version.`
  - 執行前後 sha256 前 16 碼都是 `56810a111c01dcd2`，檔案沒有被改名。
- 結論：`claudeUpdateGuardEnv` 不需要改。

**3f. SDK 0.2.113 相容性**

- `supportedModels()` probe 正常回傳（見 3a），這條路徑是 V1 `query()` 搭配 `pathToClaudeCodeExecutable` 與 `options.env`。
- V1 query、V2 session、forkSession、getSupportedModels 由既有的單元 / 整合測試覆蓋，全部綠燈（見第 6 節）。
- ② 2.1.299 / 2.1.300 的 SDK / headless 條目都是行為改善，沒有 breaking 條目：
  - resume 時保留 compaction 內容
  - MCP 重連時，tool call 不再重複執行
  - SDK `verbatimPrompts` 在 resume 重跑時，不再被當成 slash command
  - ScheduleWakeup 修正
  - 切換模型後退出 auto mode
- **沒做**：實際呼叫模型的 smoke。它需要使用者的 credential，而 `CT_INTERACTIVE=0` 無法徵詢（比照 T0483）。

**3g. 範圍外的附帶確認（沒改檔）**

`src/lib/terminal-paste.ts:14` 與 `e2e/t0524-terminal-image-paste.spec.ts:78` 的註解描述的是 CLI 2.1.296 的行為。我在 2.1.300 binary 裡確認這兩項仍成立：

- `Ie=F==="windows"||F==="wsl",Oe=Ie?"alt+v":"ctrl+v"` 仍在。
- `if (-not [System.Windows.Forms.Clipboard]::ContainsImage()) { exit 1 }` 仍在（出現 2 次）。

因此 T0524 的圖片貼上鍵不受影響。這兩個檔不在 `affects_files`，所以沒動。

### 4. 寫死 `2.1.296` 的處置

| 位置 | 性質 | 處置 |
|---|---|---|
| `scripts/verify-native-modules.js:61`（stub 形狀註解） | 內嵌實裝版本的 stub 形狀 | 更新為 `2.1.289, 2.1.296 and 2.1.300`；已用 2.1.300 tarball 實測，同樣是 500 bytes |
| `scripts/__tests__/verify-native-modules.test.mjs:28` | 同上 | 更新為 `2.1.289 / 2.1.296 / 2.1.300` |
| `tests/claude-resolver.test.ts:105-108`（`2.1.296 → healthy`） | 歷史樣本，T0483 時的內嵌版本 | 保留，另外新增 `2.1.300 → healthy`（T0541） |
| `src/lib/terminal-paste.ts:14`、`e2e/t0524-terminal-image-paste.spec.ts:78` | 某一版 CLI 行為的觀察紀錄 | 不在範圍內，沒動；在 2.1.300 仍成立（見 3g） |
| `tests/claude-resolver.test.ts` 的 `2.1.289`；`electron/claude-resolver.ts`、`claude-agent-manager.ts` 的 `CLI >= 2.1.289 …` | 歷史最低版本 | 不動 |
| `2.1.280` / `2.1.251` 等服務端門檻 | 門檻值 | 不動 |

### 5. CLAUDE.md

- 「Claude Agent SDK / CLI」節：
  - :120 實裝版本改為 `^2.1.300` / `2.1.300`，並補上 2026-10-15 T0541 的追版紀錄（模型清單、effort、計價都沒變）。T0483 / T0371 的歷史敘述保留。
  - :122 「不列 `[1m]` 行」補上 2.1.300。
  - :126 effort 段補上「2.1.300 五個 alias 都不變，T0541」。
- Runtime Selection（:130）：改為「版本鎖在 `^2.1.300`」。
- `DISABLE_UPDATES` 段（:182）：補上 2.1.300 實測仍會拒絕（T0541）。
- npm 12 段：
  - :198 保留 T0492 複驗當時的 `2.1.296`，加註「T0541 起為 `2.1.300`」。
  - :211 手動補跑表的驗證版本改為「T0541 起 `2.1.300 (Claude Code)`」。

### 6. 驗收條件

| AC | 結果 | 證據 |
|---|---|---|
| 內嵌 `--version` = 新版；`verify-native-modules` | ✅ PASS | `2.1.300 (Claude Code)`；`verify-native-modules.js` exit 0 |
| lock diff 只涉及 claude-code 系列 | ✅ PASS | `36 insertions(+), 36 deletions(-)`；10 個變動條目都屬 claude-code 系列，外加 root dependencies 一行；重產比對實質差異 0 |
| `test:unit` / `vite build` / typecheck | ✅ PASS | 見下方清單 |
| 模型 / effort / 門檻核對 | ✅ PASS | 全部沒有變動，證據見第 3 節 |
| 列出需實機驗證的項目 | ✅ | 見第 8 節 |

第三項的明細：
- `npm run test:unit` exit 0：`Test Files 237 passed (237)`，`Tests 3939 passed | 1 skipped (3940)`。
- `npx vite build` exit 0。
- `npm run typecheck` exit 0（0 個錯誤）。
- `npm run typecheck:electron` exit 0（0 個錯誤）。
- 另跑 `npx tsx tests/claude-resolver.test.ts`：`20 passed, 0 failed`（含新增的 1 項）。
- 另跑 `npm run test:claude-code-path`：`4 passed, 0 failed`。

### 7. 變更檔案

有改的：
- `package.json`、`package-lock.json`
- `scripts/verify-native-modules.js`、`scripts/__tests__/verify-native-modules.test.mjs`（只改註解）
- `tests/claude-resolver.test.ts`（新增 `2.1.300 → healthy`）
- `CLAUDE.md`
- 本工單

沒動的：
- `@anthropic-ai/claude-agent-sdk`
- `electron/claude-agent-manager.ts`
- `electron/claude-resolver.ts`
- `src/lib/model-pricing.ts` 與它的測試
- `src/types/index.ts`
- `src/styles/settings.css`（工作區原本就是 M 狀態，不屬於本單，沒有 commit）

本單沒有啟動任何 BAT 實例。

### 8. 需實機驗證

- **mac / Linux 內嵌 claude**：由 pre.3 CI 的 `verify-packaged-native` 加上實機，確認 `claude-code-<platform>-<arch>[-musl]/claude` 為 2.1.300。
- **Windows**：NSIS 完整重裝後，內嵌 claude `--version` 應為 `2.1.300 (Claude Code)`。
- **BAT 實機**：Agent 面板開新 session 能正常對話（需要 credential，本單沒有實際呼叫模型）；模型下拉應與 2.1.296 時相同，沒有多出 alias。
- **終端 claude-cli 分頁**：Windows 上用 Alt+V 貼圖片照常運作（T0524；3g 已做靜態確認）。

### 9. 觀察（非本單範圍）

1. 官方價目頁出現了 `Claude Mythos 5.1`（註 1 把它與 Fable 5.1 並列為 0.025x cache read），但 CLI 2.1.300 的模型清單沒有它。BAT 目前不需處理，記下來供日後追版參考。
2. 價目頁的 Fast mode 節列出 Opus 5.5 為 `$8 / $40`。BAT 計價表本來就沒有 fast mode 分項，這是既有狀況，本單沒動。

### Commit

commit message 含 `T0541`，以 `git commit --only` 只提交上列檔案，沒有 push。hash 請塔台以 `git log` 取得。

### 回報時間

2026-10-15T17:47:22+08:00
