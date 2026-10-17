---
schema_version: 1
schema_kind: workorder
id: T0366
title: "研究：BUG-083 Codex agent 因版本過舊出錯的根因與修復方案"
type: research
status: DONE
priority: P2
sizing: S
created_at: "2026-10-04T13:29:07+08:00"
updated_at: "2026-10-04T15:52:18+08:00"
started_at: "2026-10-04T13:30:25+08:00"
completed_at: "2026-10-04T15:52:18+08:00"
target_version: next
depends_on: []
related:
  - "BUG-083（本研究對象）"
  - "PLAN-027（claude runtime selection 先例：electron/claude-runtime-router.ts）"
  - "BUG-059（embedded CLI auto-update 造成 binary 被搬走的先例）"
affects_files: []
interaction:
  mode_hint: yolo
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究工單，不改產品程式碼、不升級依賴、不 commit `package.json` / `package-lock.json`**。可在 scratchpad 或 `git worktree` 做實驗（含試裝新版 SDK 跑 smoke），結束前清乾淨；主工作樹除本工單檔外不得留下改動。"
  - "🔴 不要 `npm install -g` / `codex update` / 改動使用者全域安裝的 codex，也不要改 `~/.codex/` 下任何檔案（只讀）。"
---

# T0366 — 研究：BUG-083 Codex agent 因版本過舊出錯

## 元資料

- **類型**：research
- **互動模式**：enabled（允許向使用者提問，每次 ≤ 3 題；使用者可能無法再取得測試者資訊，問不到就以實驗結論為準）
- **工作量預估**：S
- **Context Window 風險**：中（SDK 跨 36 個版本的 changelog 可能很長，請挑重點）

## 研究目標

回答四個問題，並給出可直接拆實作工單的建議：

1. **錯在哪**：在本機重現 Codex agent（BAT 的 Codex agent 面板路徑，`electron/codex-agent-manager.ts`）以內嵌 0.124.0 執行時是否出錯？錯誤訊息是什麼？
2. **為什麼**：根因屬於哪一類（可多選，需證據）：
   - H1 內嵌 CLI 過舊 → OpenAI 服務端 / 新模型（如預設模型名）不再相容
   - H2 SDK JS（0.124）與 PATH 上較新 codex CLI 的版本錯配（`findCodexBinary()` 優先 PATH）→ exec JSON 事件 / 參數格式不相容
   - H3 共用的 `~/.codex/config.toml` 被較新 CLI 寫入舊版不認得的鍵 → 舊 binary 啟動失敗
   - H4 其他（例如登入 / auth 格式變更）
3. **升到最新能否解**：`@openai/codex-sdk@0.160.0`（或研究時的最新版）的 breaking changes 對 `codex-agent-manager.ts` 的影響範圍（API、事件型別、選項名）
4. **如何不再落後**：OpenAI 改版頻率高，評估長期策略：
   - S1 單純 bump SDK（並建議追版節奏）
   - S2 啟動時偵測 binary 版本與 SDK 版本，錯配時 toast / fallback（類比 PLAN-027 claude runtime router 的 `fallbackToEmbedded` + degraded reason）
   - S3 Settings 提供 codex runtime 選擇（embedded / system / custom path）
   - 可組合，請給推薦與理由

## 已知資訊（塔台初步事實，請自行複核）

- `package.json:46` `@openai/codex-sdk: ^0.124.0`，實裝 0.124.0；`npm view @openai/codex version` = 0.160.0（2026-10-04）
- `electron/codex-agent-manager.ts:95-167`：binary 解析優先序 `BAT_CODEX_BIN` → PATH（Windows 只接受 `.exe`，跳過 npm `.cmd` shim）→ 內嵌 `@openai/codex-<platform>-<arch>/vendor/<triple>/codex/codex[.exe]`
- `electron/codex-agent-manager.ts:834` `new Codex({ codexPathOverride: codexPath, ... })`
- `package.json:218` `asarUnpack` 含 `node_modules/@openai/codex-*/**/*`
- 原始回報僅一句「BAT 的 codex 版本要更新才不會出錯」，無錯誤訊息、版本、平台（見 BUG-083）
- BAT debug log 實際位置：`%APPDATA%\better-agent-terminal\Logs\debug-<stamp>.log`（非 CLAUDE.md 記載的路徑，見 L128）—— 可搜尋 `[codex` 相關 log

## 調查範圍

- ✅ `electron/codex-agent-manager.ts`、`electron/agent-runtime/`、`src/components/CodexAgentPanel.tsx`（只讀）
- ✅ `node_modules/@openai/codex-sdk` 0.124.0 與最新版的 API / 事件型別差異（可在 scratchpad `npm pack` 或 worktree 安裝比對）
- ✅ 本機 PATH 上是否有 codex、版本為何；`~/.codex/config.toml` 內容（只讀，**回報時遮蔽任何 token / key**）
- ✅ 以內嵌 binary 直接跑 `codex --version` / 最小 `codex exec` smoke（若需登入且本機未登入，記錄為限制，不要代替使用者登入）
- ❌ 不改 `src/` `electron/` `package*.json`；不發 release；不動全域 codex 安裝

## 互動規則

- 每次提問不超過 3 題；優先問「使用者本機是否有 codex CLI 及版本」「能否向測試者取得錯誤訊息/截圖」這類只有使用者能答的問題
- 能用實驗回答的，不要問

## 回報要求

- 「調查結論」每個 H 標註 **證實 / 排除 / 無法判定**，附證據（指令輸出、log 片段、程式碼行號）
- 「建議方向」給 S1/S2/S3 的推薦組合、改動檔案清單、預估工作量、風險（特別是 BUG-059 類 auto-update 風險：內嵌 codex 是否也會自我更新？是否需注入類似 `DISABLE_AUTOUPDATER` 的 env）
- 「建議下一步」列出可直接拆成實作工單的項目（含建議 `affects_files`）

## Sub-session 執行指示

1. 讀取本工單全部內容 + `BUG-083`
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 依研究目標 1 → 4 調查
4. 填寫回報區、更新 `status` / `completed_at` / `updated_at`
5. commit **僅本工單檔**（`git commit --only _ct-workorders/T0366-research-bug083-codex-version-skew.md`）
6. 依派發 mode 通知塔台（`bat-notify.mjs`；YOLO 模式依 ct-exec 規則帶 `--submit`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — 四個研究問題皆有實驗證據的結論，可直接拆實作工單。

- **Landing Zone**：WARN — C-0 `repo` 欄位 absent（觀察到 `basename(REPO_ROOT)` = `better-agent-terminal`）；C-1 PASS（工單位於 `REPO_ROOT/_ct-workorders/`）；C-3 not applicable（`affects_files: []`）；C-2 無 `branch` 欄位（HEAD = `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a82b98b4b59b`（僅作證據）。
- **派發模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=1`。
- **Commit**：報告 `aa970dc`；最終狀態另一筆 commit（僅本工單檔，未 push）。
- **主工作樹**：除本工單檔外無改動（`AGENTS.md` 為開工前既有的 dirty，未碰）。`~/.codex/` 只讀；實驗一律以 scratchpad 隔離的 `CODEX_HOME` 執行，結束已刪除 auth 複本與下載的套件。

### 互動紀錄

| # | 問題 | 使用者回答 |
|---|------|-----------|
| Q1 | 是否允許把 `~/.codex/auth.json` 複製到 scratchpad 隔離的 `CODEX_HOME` 跑極小 smoke（跑完刪除；風險：少量額度、token refresh 輪替） | 允許隔離複本 smoke |
| Q2 | 能否取得測試者的錯誤訊息、平台、是否另裝新版 Codex | 取不到，以實驗為準 |

auth 驗證：實驗前後 `~/.codex/auth.json` sha256 前 16 碼皆為 `3ca79ddeb98292fe`，mtime 仍為 `2026-09-30 14:27:37`，**未觸發 token refresh**。

### 調查結論

#### 0. 本機環境（研究基準）

| 項目 | 值 |
|------|----|
| repo 內嵌 | `@openai/codex-sdk` / `@openai/codex` / `codex-win32-x64` 皆 `0.124.0`；`codex.exe --version` → `codex-cli 0.124.0` |
| 已安裝 BAT（`C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@openai\`） | `codex-sdk` 0.124.0 + `codex-win32-x64` 0.124.0（`codex-cli 0.124.0`） |
| PATH 上的 codex | `C:\Users\Gower\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe` → `codex-cli 0.160.0`（Codex 官方安裝器）；另有 npm 的 `codex` / `codex.cmd` shim（BAT 會略過） |
| ⇒ 本機 BAT 實際走的路徑 | `findCodexBinary()` 選 PATH 的 0.160.0 → **SDK JS 0.124 驅動 CLI 0.160**（H2 組合） |
| `npm view @openai/codex-sdk version` | `0.160.0`（`time.modified` 2026-10-04T06:01Z） |
| 本機 BAT debug log | `%APPDATA%\better-agent-terminal\Logs\debug-*.log`（09-19 ~ 10-04 共 11 檔）**沒有任何 codex 字樣** → 本機無 Codex 面板使用紀錄，只能用實驗重現 |

實驗方法：scratchpad 寫 `smoke.mjs`，以 **repo 的 SDK 0.124 JS** `new Codex({ codexPathOverride })` + `startThread({ sandboxMode, approvalPolicy, modelReasoningEffort, skipGitRepoCheck, model })` + `runStreamed()`，與 `electron/codex-agent-manager.ts:834-854, 974` 同路徑。prompt：`Reply with exactly the single word: pong`。

#### H1 內嵌 CLI 過舊 → 服務端 / 新模型不相容：**證實（條件式）**

| 案例 | 結果 |
|------|------|
| 0.124 + `gpt-5.5`（BAT 預設，`codex-agent-manager.ts:170`） | ✅ `pong`，5.5s |
| 0.124 + `gpt-5.5` + effort `xhigh` | ✅ `pong` |
| **0.124 + `gpt-5.6-terra`** | ❌ `turn.failed`：`The 'gpt-5.6-terra' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again.` |
| 0.160 + `gpt-5.6-terra` | ✅ `pong` |

- 服務端**明確以 CLI 版本擋新模型**，錯誤字面「Please upgrade to the latest app or CLI」與測試者原話「codex 版本要更新才不會出錯」高度吻合。
- 另一個舊版徵兆：0.124 每次啟動向服務端刷新模型清單都失敗（非致命，stderr）：`failed to refresh available models: ... failed to decode models response: unknown variant \`max\`, expected one of \`none\`, \`minimal\`, \`low\`, \`medium\`, \`high\`, \`xhigh\``。服務端已新增 effort `max`，舊 CLI 解不開。
- 目前 BAT 的模型下拉清單寫死（`codex-agent-manager.ts:172-182`、`getSupportedModels()` :1421-1423），不含 `gpt-5.6-*` / `gpt-6-*`，所以「只用 BAT 下拉」的使用者今天走預設 `gpt-5.5` 仍可用；但 **`gpt-5.5` 一旦也被加上版本門檻（OpenAI 慣例），所有走內嵌 0.124 的使用者會整片壞掉**。這是會到期的定時炸彈。
- 附帶發現（非版本問題，但同屬「Codex 出錯」）：BAT 清單中的 `gpt-5.4`、`o3` 在 **0.124 與 0.160 都**回 `The '<model>' model is not supported when using Codex with a ChatGPT account.`（ChatGPT 登入；API key 帳號未測）。本機 `~/.codex/models_cache.json` 目前清單：`gpt-6-luna, gpt-reserve, gpt-5.6-terra, gpt-5.6-luna, gpt-5.5, codex-auto-review`。⇒ `CODEX_MODELS` 裡多數項目已下架。

#### H2 SDK JS 0.124 與 PATH 上較新 CLI 錯配：**部分證實（不是 argv / 事件格式不相容，而是錯誤事件誤報）**

- argv 層相容：SDK 0.124 送 `exec --experimental-json ...`（`codex-sdk/dist/index.js:163-212`）；0.160 `exec --help` 只列 `--json`，但 `--experimental-json` 隱藏別名仍接受（`codex exec --experimental-json --skip-git-repo-check --help` exit 0）。
- 事件層相容：SDK 0.124 + CLI 0.160 + `gpt-5.5` → ✅ `pong`；`turn.completed.usage` 多出 `cache_write_input_tokens` / `reasoning_output_tokens`，BAT 忽略，無害。
- **但** 0.160 遇到 config 中不認得的鍵時，會在回合開頭送出 `item.completed` + `item.type="error"`（本機兩則：`Codex is ignoring 1 unrecognized configuration setting. ... \`env\` is ignored.`）。BAT 的處理：
  - `codex-agent-manager.ts:1212-1215`：`itemType === 'error'` → `this.send('claude:error', ...)`
  - `src/components/CodexAgentPanel.tsx:788-799`：`onError` 追加 `Error: ...` 系統訊息並 `setIsStreaming(false)`
  - ⇒ 回合其實仍在正常跑，但面板**每回合先跳紅色 Error、streaming 指示提前熄滅**。這是使用者會稱為「出錯」的現象。
- 錯配的另一方向（新 SDK 驅動舊 PATH CLI）目前不存在，但 S1 升級後若使用者 PATH 上是舊 CLI 就會發生，需由 S2 處理。

#### H3 共用 `~/.codex/config.toml` 被較新 CLI 寫入舊版不認得的值：**證實（致命）**

- 本機 `config.toml` 由較新的 Codex（官方安裝器 / Desktop App）維護，含 `service_tier = "default"`。
- 0.124 直接啟動失敗（未登入 / 有登入皆同，屬 config 解析階段）：
  - CLI：`Error loading config.toml: unknown variant \`default\`, expected \`fast\` or \`flex\` in \`service_tier\``，exit 1
  - 經 SDK（BAT 實際看到的）：`Codex Exec exited with code 1: Error loading config.toml: unknown variant \`default\`, expected \`fast\` or \`flex\` in \`service_tier\``
- 逐鍵排查：移除 `service_tier` 這一行後 0.124 即可正常啟動、回 `pong`；其餘新鍵（`[windows] sandbox="elevated"`、`[hooks.state]`、`[marketplaces]`、`[plugins]`、`[desktop]` 等）0.124 皆可容忍。
- **觸發條件**：使用者另裝了較新的 Codex（會寫入新值），**但 BAT 沒有選到那支新 binary** → 退回內嵌 0.124。Windows 上這很常見：
  - `npm i -g @openai/codex`（BAT 自己的 install hint 就推薦此法，`codex-agent-manager.ts:77`）只產生 `.cmd` / `.ps1` / 無副檔名 shim，`findCodexOnPath()` 全部略過（:119-125）
  - Codex Desktop App 的 CLI 位於 `%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\codex.exe`（本機 config 中 `CODEX_CLI_PATH` 即此），不一定在 PATH
- 這是測試者情境的**最可能根因之一**（與 H1 並列；無測試者錯誤原文，無法二選一）。

#### H4 其他（auth 格式等）：**排除**

- 0.124 使用由較新 client 寫入的 ChatGPT `auth.json`（`auth_mode: chatgpt`）可正常完成回合（H1 案例 B）。未見 auth 相關錯誤。

#### Q3 升到 `@openai/codex-sdk@0.160.0` 的影響範圍

| 面向 | 變化 | 對 BAT 影響 |
|------|------|------------|
| `index.d.ts` | 純增量：`ThreadOptions.threadSource?`、`CodexOptions.configOverrides?: string[]`、usage 加 `cache_write_input_tokens` / `reasoning_output_tokens`、`ModelReasoningEffort` 加 `"max" \| "ultra" \| "persistent"`、MCP item 加 `_meta?` | 無 breaking。可選：effort 清單（`CODEX_EFFORT_LEVELS` :67、`CodexEffortLevel`）擴充；usage 映射 `cacheCreationTokens` |
| 事件 / item 型別 | 無增刪（`thread.started` / `turn.*` / `item.*` / `error` 同） | 無 breaking |
| CLI argv | 仍用 `exec --experimental-json`；新增 `--thread-source`、raw `--config` | 無 breaking |
| **平台套件目錄結構** | 0.160 改為 `vendor/<triple>/bin/codex(.exe)` + `codex-package.json` + `codex-path/rg.exe` + `codex-resources/`；SDK 自身同時支援新舊（`resolveNativePackage()`） | 🔴 **BREAKING**：BAT 的 `findBundledCodex()`（`codex-agent-manager.ts:135-152`）寫死 `vendor/<triple>/codex/<exe>` → 升級後**內嵌 binary 找不到**，PATH 上沒有 `.exe` 的使用者直接得到 `Codex CLI not found`。必須同步改解析邏輯 |
| PATH helper | 0.160 SDK 會把 `codex-path/`（rg.exe）prepend 到子行程 PATH，**但只在未傳 `codexPathOverride` 時**；BAT 一律傳 override | 升級後 BAT 需自行 prepend `codex-path/` 才能與 SDK 預設行為一致（0.124 時代 SDK 也沒做，屬既有落差） |
| 體積（`dist.unpackedSize`） | win32-x64 223→451 MB；darwin-arm64 184→333 MB；darwin-x64 206→357 MB；linux-x64 209→447 MB | 🟠 安裝檔會明顯變大；**Mac installer 280 MB 上限（D094）有超標風險**。新增的大件：`bin/codex-code-mode-host.exe`（75 MB）、`codex-resources/voice/**`（GStreamer DLL） |
| asar | `asarUnpack` 的 `node_modules/@openai/codex-*/**/*`（`package.json:218`）已涵蓋新目錄 | 無需改，但需實測打包產物 |
| `@openai/codex` wrapper | 已安裝 BAT 的 unpacked 目錄沒有 `@openai/codex`（pattern 不匹配）—— 這正是 BAT 必須自行解析 binary、不能讓 SDK `findCodexPath()` 自己找（會解到 `app.asar` 內路徑）的原因 | 維持自行解析 |

#### Q4 auto-update（BUG-059 類）風險

- 0.124：無 `update` 子指令；binary 字串中有 `check_for_update_on_startup`。
- 0.160：新增 `codex update`（顯式指令）與 `check_for_update_on_startup` 設定（TUI 啟動時的更新提示）。
- BAT Codex 面板只經 SDK 跑 `codex exec`；本研究多次執行後內嵌 `codex.exe` 仍為 `codex-cli 0.124.0`、mtime `2026-04-25 11:29:42` 未變，**未觀察到 exec 路徑自我更新**。terminal 的 `codex-cli` preset 直接跑使用者 PATH 上的 `codex`（`electron/agent-runtime/agent-registry.ts:157-163`），不碰內嵌 binary。
- 結論：風險低，**不需要** BUG-059 等級的 env 注入；保守起見可在 `new Codex({ config: { check_for_update_on_startup: false } })` 一併帶上（成本近零）。

### 建議方向

**推薦組合：S1 + S2（必做）＋ S3 精簡版（選做）**

1. **S1 bump SDK 到 0.160（必做，但不能「單純 bump」）**
   - 必須同時改 `findBundledCodex()` 支援新舊兩種目錄（先 `bin/` + `codex-package.json`，再 legacy `codex/`），並 prepend `codex-path/` 到 spawn env PATH。
   - 打包前實測三平台安裝檔大小；Mac 若超 280 MB 需塔台復議 D094（或評估以 electron-builder `files` 排除 `codex-resources/voice/**`——需先確認 exec 不依賴 voice）。
   - 追版節奏：OpenAI 以「服務端擋舊 CLI 用新模型」的方式強迫升級，建議**每次 BAT 預覽版發布前檢查一次 `npm view @openai/codex-sdk version`**，落後超過一個月或出現新預設模型即 bump。
2. **S2 版本偵測 + 智慧選 binary + 錯誤分類（必做，這才是「不再落後」的主力）**
   - 選 binary 由「PATH 優先」改為「**選版本較新者**」：以 `execFile(bin, ['--version'], { timeout: 5000 })` 解析 `codex-cli X.Y.Z`，比較 PATH `.exe` / Desktop App（`%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe`）/ 內嵌，取最新；結果快取於 process 生命週期。
   - 錯誤分類（類比 PLAN-027 的 degraded reason）：
     - stderr / error 含 `Error loading config.toml` → `config-incompatible`：若有其他候選 binary 自動退回重試，否則顯示可操作訊息（指出是哪個鍵、建議升級 BAT 或安裝新版 codex）
     - `turn.failed` 含 `requires a newer version of Codex` → `cli-too-old`：顯示「目前使用 codex X（內嵌/系統），此模型需新版」
     - `item.type === 'error'` 且訊息以 `Codex is ignoring` 開頭 → 降級為 system notice，**不送 `claude:error`、不中斷 streaming**（修 H2 誤報）
   - 一次性 toast 告知目前 runtime 與版本，比照 claude runtime 的 `version-warning`。
3. **S3 Settings 的 codex runtime 選擇（選做，後排）**
   - `BAT_CODEX_BIN` env 已是隱藏的 custom path 入口；S2 的「選最新」已涵蓋大多數情境。若要做，建議只做 `auto（預設，選最新）/ embedded / custom path` 三選一，沿用 `claude-runtime-router.ts` 的結構，工作量 M。
4. **模型清單（獨立小修，建議與 S1 同批）**：`CODEX_MODELS` 移除已下架項（實測 `gpt-5.4`、`o3` 不支援 ChatGPT 帳號），並改為優先讀 `~/.codex/models_cache.json`（只讀；新版 CLI 自動維護）、寫死清單僅作 fallback。

**不推薦**：以 `-c service_tier=...` 之類 CLI override 硬蓋 H3 的單一鍵——只解已知鍵，下一個新值又會壞。

**風險**
- 安裝檔體積（Mac 280 MB 上限）—— 最大不確定性，需實測。
- 新目錄結構若 OpenAI 再改，S2 的「找不到內嵌時給明確錯誤」可兜底。
- S2 「選最新」可能選到使用者刻意保留的舊版 PATH CLI 之外的版本；以 `BAT_CODEX_BIN` 覆寫保留逃生口。

### 建議下一步

| 建議工單 | 內容 | 建議 `affects_files` | 估計 |
|---------|------|---------------------|------|
| T-A（P1，先做，小） | **錯誤分類與誤報修正**：config 警告降級為 notice；`config.toml` 解析失敗 / `requires a newer version` 給可操作訊息 | `electron/codex-agent-manager.ts`、`src/components/CodexAgentPanel.tsx`、`src/locales/*`（若訊息走 i18n） | S |
| T-B（P1） | **S1 bump + 內嵌解析相容新目錄**：`@openai/codex-sdk` → 0.160.x；`findBundledCodex()` 支援 `bin/` + legacy；prepend `codex-path/`；`check_for_update_on_startup=false`；三平台打包大小實測（Mac vs D094） | `package.json`、`package-lock.json`、`electron/codex-agent-manager.ts` | M |
| T-C（P2） | **S2 選最新 binary + 版本 toast**：`--version` 偵測（execFile + 5s timeout）、候選含 Desktop App 路徑、degraded reason | `electron/codex-agent-manager.ts`（或新檔 `electron/codex-runtime-resolver.ts`）、`src/components/CodexAgentPanel.tsx` | M |
| T-D（P2） | **模型清單更新**：清掉下架模型、讀 `models_cache.json`、effort 加 `max` | `electron/codex-agent-manager.ts`、`src/types/index.ts`（`CodexEffortLevel`） | S |
| T-E（P3，選做） | S3 Settings codex runtime 選擇 | `electron/codex-agent-manager.ts`、Settings 相關元件、`src/types/index.ts` | M |

BUG-083 嚴重度建議：維持 🟡 medium，但**可重現**改為「可（條件式）」——H3 在「另裝新版 Codex 但 BAT 用內嵌」時 100% 重現；H1 在選新模型時 100% 重現。

### 遭遇問題

- 無測試者原始錯誤訊息（Q2 確認取不到），故無法斷定測試者是 H1 還是 H3；兩者皆已在本機以實驗 100% 重現，修復方案同時涵蓋。
- `~/.codex/` 在研究期間有寫入（`logs_2.sqlite*`、`models_cache.json`、`tmp/arg0/*`），時間點（含 15:16 / 15:20 本研究未執行任何實驗的時段）與使用者自己常駐的 `codex.exe`（PID 1976）相符；本研究所有 codex 執行皆設 `CODEX_HOME` 指向 scratchpad。`config.toml` / `auth.json` 的 mtime 與 hash 均未變。
- 未測：API key 登入模式、macOS / Linux 實機、打包後安裝檔實際大小（僅有 npm `unpackedSize`）。
- 每次實驗呼叫消耗約 13k–17k input tokens（ChatGPT 帳號額度），共約 10 次。

### 回報時間

2026-10-04T15:52:11+08:00
