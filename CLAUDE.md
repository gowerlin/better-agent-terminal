# CLAUDE.md - Project Guidelines

## No Regressions Policy

- **NEVER** break existing features when implementing new ones.
- Before committing, verify ALL existing features still work — not just the new changes.
- Run the build (`npx vite build`) to confirm compilation succeeds.
- When modifying shared code (stores, IPC handlers, types), trace all consumers to ensure nothing breaks.

## Frontend unit tests

- 框架：vitest + jsdom + React Testing Library + jest-dom（T0307b 引入）
- 執行：`npm run test:unit`（一次跑完）/ `npm run test:unit:watch`（watch mode）/ `npm run test:unit:ui`（UI mode）
- 測試檔位置：`src/**/*.test.{ts,tsx}` 或 `src/**/__tests__/**/*.{ts,tsx}`
- 設定：`vite.config.ts` 內的 `test` 區塊；setup 檔 `vitest.setup.ts`（auto-import jest-dom matchers）
- e2e（playwright）獨立：`npm run test:e2e`，不與 unit test 混跑

## Logging

- **Frontend (renderer)**: Use `window.electronAPI.debug.log(...)` instead of `console.log()`. This sends logs to the electron main process logger, which writes to disk.
- **Backend (electron)**: Use `logger.log(...)` / `logger.error(...)` from `./logger`.
- Do NOT use `console.log()` for debugging — use the logger so logs are persisted and visible in the log file.
- **Log file location**: `~/Library/Application Support/better-agent-terminal/debug.log`

## Child Process Spawning

新增涉及 child_process 的程式碼（特別是 IPC handler / wizard step / shell 互動）：

- ✅ 用 `execFile` 或 `spawn` + array args（既有 `electron/docker-detect.ts` / `electron/claude-resolver.ts` 為範本）
- ❌ 禁用 `child_process.exec` 模板字串呼叫（shell injection 風險；`execSync` 僅限 hardcoded 命令無 user input 的場景，如 `electron/codex-agent-manager.ts`）
- 任何外部輸入（distro / container name / profileId / path）使用前必過 regex `/^[a-zA-Z0-9._-]+$/` 白名單
- timeout 必設（建議 5s for 同步 detect / 30s for IO 操作）
- 注意：security hook 提示的 `src/utils/execFileNoThrow.ts` 在本專案**不存在**（hook 是泛用建議），沿用 Node 內建 `child_process.execFile` 即可

## Sub-agent / Active Tasks Tracking

- The Claude Agent SDK does **NOT** reliably emit `task_started` / `task_progress` / `task_notification` system messages.
- We track Agent/Task tools from `tool_use` blocks directly in `session.activeTasks` (in `claude-agent-manager.ts`).
- `stopTask()` falls back to using `toolUseId` as `task_id` when no mapping exists.
- Tool results for Agent/Task must clean up `activeTasks` entries.

## React Rendering

- Use `flushSync` from `react-dom` for Agent/Task tool state changes (`setMessages` in `onToolUse` and `onToolResult`) to prevent rendering delays from React 18 batching during streaming.
- Do NOT use `flushSync` for regular tool calls — only for state changes that affect the active tasks bar visibility.

## Status Line

- Our status line implementation is superior to external alternatives (e.g., ccstatusline). Do not replace it.
- 13 configurable items with custom colors, zone alignment, and template-based config.
- Usage polling: Chrome session key (primary, lenient rate limits) → OAuth fallback (strict rate limits).

## Claude Agent SDK / CLI

- `@anthropic-ai/claude-agent-sdk` `^0.2.111`、`@anthropic-ai/claude-code` `^2.1.111`（2026-04-18 T0165 C1.1 升級，原 `^0.2.104` / `^2.1.97`；npm 實際安裝 `0.2.113` / `2.1.113`）。此版本提供 **Opus 4.7 model 支援**與 **`xhigh` effort level**。
- `BAT_BUILTIN_MODELS`（`electron/claude-agent-manager.ts`）已前插 `claude-opus-4-7` / `claude-opus-4-7[1m]`；`MODEL_PRICING` 以 `opus-4-7: P(5, 25)` 與 Opus 4.6 同級。
- `EFFORT_LEVELS = ['low','medium','high','max','xhigh']` + `EffortLevel` type 集中宣告於 `src/types/index.ts`。新增 effort 成員時只改 const，其他檔案自動套用。
- Settings 的 effort dropdown 現包含完整 5 級，`max` 標示「(Opus only)」（Sonnet/Haiku 不支援）；`xhigh` 需 CLI `>= 2.1.111` 才可用。

### Claude Runtime Selection (PLAN-027, v2.1.49+)

BAT 預設使用**內嵌版** claude CLI（隨 BAT 打包，版本鎖在 `@anthropic-ai/claude-code ^2.1.111`）。若使用者想改用系統上自己安裝的 claude CLI（例如剛 release 的新版），可在 `Settings → Advanced → Claude Runtime` 切換。

**為什麼有兩個選項**
- **內嵌（embedded，預設）**：版本跟 BAT 發行綁定，穩定、可控、不受系統環境影響。適合大多數使用者。
- **系統（system）**：用系統 PATH 上的 claude，或使用者透過 `customPath` 指定的絕對路徑。適合想立即試用新 CLI 功能、不想等 BAT release 重打包的 power user。

**什麼時候該切 system**
- 上游剛 ship 新 model / effort 支援，BAT 尚未 bump SDK 版本
- 想用某個特定版本測試 / debug
- 其他時候建議用內嵌，減少環境變動面

**Fallback 行為**（`fallbackToEmbedded`，預設開啟）

當 system claude 符合下列任一條件時，自動退回 embedded，並觸發 toast 顯示 degraded reason：
- 偵測不到（PATH / customPath 找不到，或 spawn ENOENT）
- 健康檢查失敗（spawn error / version parse 失敗）
- 版本太舊（`< 2.0.0`）

關閉 fallback 時，偵測失敗會讓 Agent spawn 與 terminal claude-cli 啟動都失敗，適合嚴格要求只用 system 的場景。

**設定變更範圍（T0233 Worker 旗標）**

切換**只影響新開的 session 與新開的終端**。進行中的 Agent session 不受影響（transcript 仍在原 runtime 下）；既有 terminal 分頁要關掉重開才會套用新 preset。runtime router 讀設定的唯一入口是 `resolveClaudeRuntime()`（`electron/claude-runtime-router.ts`），由 agent-manager / auth-manager / terminal claude-cli preset 共享。

**跨平台安裝指引**（完整 playbook 見 `docs/plan-027-cross-platform-verification.md`）
- **macOS**：anthropic 官方 installer（`~/.local/bin/claude`）或 Homebrew（`/opt/homebrew/bin/claude`）
- **Linux**：anthropic 官方 installer（`~/.local/bin/claude`）
- **Windows**：anthropic 官方 installer 會放 `%USERPROFILE%\.local\bin\claude.exe`。`npm install -g` 產出的 `.cmd` / `.bat` shim **不被 router 偵測**（BUG-053 決策為 Node 20+ 不再支援 shim 探測，見 `docs/plan-027-cross-platform-verification.md`）

**常見故障**

| 症狀 | 可能原因 | 解法 |
|------|---------|------|
| 切 system 但 Agent 版本沒變 | 在現有 session 觀察 | 開新 session，設定只影響新 session |
| 切 system 後 terminal claude-cli 版本沒變 | 舊 terminal 分頁未重開 | 關掉 terminal 分頁重開 |
| Toast 顯示 `system-not-found` | PATH 上找不到 claude | 確認 installer 跑過，或在 UI 勾選 Use custom path 指定絕對路徑 |
| Toast 顯示 `system-too-old` | 版本 `< 2.0.0` | 升級 claude CLI |
| Toast 顯示 `version-warning` | 版本 `>= 2.0.0` 但 `< 2.1.111` | 功能可用但缺 Opus 4.7 / xhigh effort，建議升級到 `2.1.111+` |

### Embedded claude auto-update 停用（BUG-059）

BAT 對 embedded 與 system 兩種 runtime 的 spawn 都注入 `DISABLE_AUTOUPDATER=1`：

- **Embedded**：必須關，否則 claude CLI 會把 `app.asar.unpacked/.../bin/claude.exe` rename 成 `.old.<ts>`，再 `npm install -g` 到使用者 npm prefix（不在 BAT 路徑），導致 BAT 下次 spawn 找不到 binary（BUG-059 / BUG-055 同根因）
- **System**：native installer 已自我關閉 auto-update（`autoUpdatesProtectedForNative: true`），疊加 env flag 無副作用；npm-global system 安裝同樣受益於此 flag
- 使用者要更新 embedded：等 BAT release 重打包；要更新 system：在 BAT 外手動 `claude update` 或重跑 installer

注入點：`electron/pty-manager.ts` 三處 `envWithUtf8`（terminal 子行程） + `electron/claude-agent-manager.ts` constructor（Agent SDK 子行程繼承 `process.env`）。

**已知未修副作用**：使用者一旦觸發過 BUG-059，`~/.claude/...` config 已被寫入 `installMethod: "global"`。本修復不重置該 config（影響面評估中），但 spawn env 注入會 short-circuit update flow，config 值不會再被讀取觸發新一輪 update。

## Electron Runtime

- 本專案使用 Electron 41.x（Node 24、Chromium M146）；於 PLAN-016 Phase 2 從 Electron 28.3.3 升級（EXP-ELECTRON41-001 CONCLUDED）。
- native modules 依 ABI 145 建置；`package.json` 的 `postinstall` 已自動跑 `npm rebuild better-sqlite3`。若手動安裝後 app 啟動異常（例如 `NODE_MODULE_VERSION mismatch`），先執行 `npm rebuild better-sqlite3`。
- BAT 內執行 `npm run dev` 需確認 `ELECTRON_RUN_AS_NODE` 未被污染（見 BUG-038 / T0161）。若 renderer 無法啟動且 log 出現 `ELECTRON_RUN_AS_NODE=1`，清除該環境變數後重試。
- electron-builder 26.x（2026-04-18 PLAN-005 / EXP-BUILDER26-001 CONCLUDED，原 24.13.3 → 26.8.1，清除 9 個 Group A CVE，見 PLAN-003 Group A）。

## Build Toolchain

- Vite 7.x（2026-04-18 PLAN-003 Group B / T0163 升級，原 vite 5.4.21 → 7.3.2，清除 esbuild SSRF 與 vite path traversal 2 個 moderate CVE）。
- Plugin 組合：
  - `@vitejs/plugin-react` ^5.0.0（實裝 5.2.0）
  - `vite-plugin-electron` ^0.29.1（stable，官方宣告支援 vite 7/8）
  - `vite-plugin-electron-renderer` ^0.14.6（無 peer 限制）
- `vite.config.ts` 目前未用 vite 7 移除的 API（`splitVendorChunkPlugin`、`transformIndexHtml` 舊 hook 格式、`resolve.conditions` custom、Sass）；若日後新增構建設定請留意這些被移除的 API。
- 下次升級目標：vite 8（等 `vite-plugin-electron@1.0.0` GA 脫離 beta，預估 6-12 個月後）。相關研究見 T0162、決策見 D052/D053。

### electron-builder 26 migration notes

- **mac.notarize 格式變更**：v26 將 `mac.notarize` 從物件（`{ teamId }`）改為 boolean，認證資訊統一從環境變數讀取。目前 `package.json` 設為 `notarize: true`。
- **啟用 mac notarization 需設以下環境變數任一組合**（官方推薦組合 1）：
  1. `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`
  2. `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`（本專案 teamId = `8JVDJGLLYR`）
  3. `APPLE_KEYCHAIN` + `APPLE_KEYCHAIN_PROFILE`
- **CI workflow 注意**：`.github/workflows/pre-release.yml` 目前 mac job 未設 `APPLE_*` secrets，實際無 notarization（與升級前行為一致）。若要啟用，需補環境變數到 `Package for macOS` step。
- **Windows 打包驗收**：NSIS installer 產出約 172 MB、zip 約 230 MB；electron-builder 26 在 Windows 禁止跑 `--mac --dir`（v24 曾允許），但 schema parse 仍可通過。
- **mac 打包採雙 arch dmg**（2026-04-18 D057，v0.0.16-pre.1 起）：`mac.target.arch = ["x64", "arm64"]`，產出 `BetterAgentTerminal-*-x64.dmg` + `-arm64.dmg`。**不要改回 `"universal"`** — `@electron/universal` 合併 ASAR 時對 `asarUnpack` 內所有 bit-identical 檔案都要求 `x64ArchFiles` 規則覆蓋，本專案 `@anthropic-ai/claude-code`、`@anthropic-ai/claude-agent-sdk`、`@img/**`、`@lydell/node-pty-*` 都 ship 全平台 binary，維護 pattern 是 whack-a-mole。完整 root cause 與 5 次 CI run 失敗記錄見 `_ct-workorders/EXP-BUILDER26-001` 的「CI 實戰後續」段落。

## Remote 資安（PLAN-018 T0182）

- **TLS + fingerprint pinning**：Remote server 自 T0182 起以 `wss://` + 自簽憑證運行（`electron/remote/certificate.ts`），client 以 SHA-256 fingerprint (TOFU) 驗證。首次連線會自動寫入 `remoteFingerprint` 到 profile；後續不符即拒絕。
- **憑證儲存位置**：`app.getPath('userData')/server-cert.json`（10 年 expiry；90 天內自動重生）。**不要手動刪除**——會觸發 fingerprint mismatch 讓既有 client 全部失效。
- **Bind-interface 三選項**：
  - `localhost`（預設，`127.0.0.1`）—— 最安全，僅本機連入
  - `tailscale`（`100.x.x.x`）—— fail-closed：找不到 Tailscale 介面時直接報錯，**不會** fallback
  - `all`（`0.0.0.0`）—— 完全裸露，僅在受信 LAN 使用
- **Token 儲存**：`server-token.json` 以 Electron `safeStorage` 加密（Windows DPAPI / macOS Keychain）。Linux 無 keychain 時 fallback 到 plaintext + warn log（fork 現行行為，見 D Q1.A）。
- **QR payload 格式**（tunnel-manager）：`{ url: wss://..., token, fingerprint, mode, addresses }`——client 掃描後必須把 fingerprint 寫入 profile 才能建立 TLS 信任鏈。
- **ProfilePanel UI**：remote profile 有 read-only fingerprint 欄位 + 「Pin expected fingerprint」按鈕（手動刷新）。首次建立 profile 時欄位空白，`Fetch profiles` 成功後自動填入（TOFU）。
- **依賴套件**：`selfsigned@^5.x`（v5 是 async API；`await selfsigned.generate(...)`，v4 同步呼叫會回 Promise 導致 `.cert.replace` undefined）。
- **降級情境**：若 `safeStorage.isEncryptionAvailable() === false`，`[Secrets]` warn log 會顯示一次；工單決策是「fallback 不阻擋啟動」，使用者可觀察 log 判斷是否需要切離 Linux 環境。

## Control Tower 本專案規則

- 塔台啟動時**必須讀取** `_ct-workorders/_local-rules.md` 並遵循其中所有規範
- 該檔案定義了本專案的擴充單據類型（BUG/PLAN）、索引同步原則、歸檔策略等
- 此為 Layer 3 附加規則，優先級高於 skill 預設行為

### 工單與文件撰寫慣例

塔台工單（`_ct-workorders/T*.md`）與 spec 文件中提及 child_process 安全規則時：

- ❌ 禁止在「禁用範例」段落寫具體 `exec(\`command ${var}\`)` 字串（security hook 會在 Write 時誤觸並 abort 寫入；T0319 草稿首發即被攔截兩次）
- ✅ 改用敘述：「禁用 `child_process.exec` 模板字串呼叫」或「禁用 shell-spawning exec API」
- 程式碼範例只放正確寫法（`execFile` / `spawn`），不放 ❌ 反例
- 同樣慣例適用於提及任何受 hook 攔截的 API（後續發現再補進此清單）

## Packaging / Release 前置檢查

- **Squash merge 後打包前必做**：在 main repo 根目錄跑 `npm install`（CI 跑 `npm ci`）確保 `node_modules/` 與 `package-lock.json` 一致。Squash merge 只更新 lock file，不同步實際 `node_modules/`，遺漏此步會導致 native module 缺失（見 BUG-056 / T0242 / T0243）。
- **Build fail-fast**：`npm run build` / `npm run build:release` / `npm run build:dir` 會先執行 `scripts/verify-native-modules.js`，檢查 `@kutalia/whisper-node-addon`、`@lydell/node-pty`、`better-sqlite3` 等關鍵 native modules 是否存在於 `node_modules/`。缺失即 abort，不會進 vite build 或 electron-builder。新增關鍵 native module（特別是 `build.asarUnpack` 內的）時請同步更新 `REQUIRED_NATIVE_MODULES` 清單。
- **Helper bundle fail-fast**：同一條 pipeline 也會跑 `scripts/verify-helper-bundle.js`，靜態掃描 `scripts/*.mjs` 的 relative `.mjs` import，比對 `package.json` `build.extraResources[].filter` 是否涵蓋所有 import target。若有 helper 被 filter 漏掉即 abort，錯誤訊息會指出漏了哪個檔 + 建議加什麼 pattern（見 BUG-058 / T0247 / T0248）。新增 `scripts/_bat-*.mjs` helper 或修改 `extraResources.filter` 時，先跑 `npm run verify:helpers` 確認配對。範圍刻意縮小到 top-level `.mjs` + static import；子目錄 / 動態 `import()` 不在掃描內。
- **CI pipeline**：`.github/workflows/pre-release.yml` 三平台 build job 依序為 `npm ci` → `@electron/rebuild` → `verify-native-modules.js` → `verify-helper-bundle.js`（在 `build-version.js` 開頭自動 require） → `build-version.js` → `electron-builder`。新增 CI job 時請沿用相同順序。
- **Release 驗收必跑 NSIS 完整重裝**：`--dir` mode 和 `zip` smoke 不是 production 等價；release 前必須完整「uninstall → 跑 installer → 啟動 UI → 踩 voice input / terminal / sqlite 路徑」驗收（BUG-056 盲點記錄）。

### Server bundle baseline（PLAN-031）

- **`npm run fetch:baseline` 在 build 前**：electron-builder build 前必跑（`prebuild` hook 已自動串接），從 GitHub Release 抓對應 host arch 的 baseline tarball 到 `dist-baseline/`，由 installer 內建 (`extraResources`)
- **per-host matrix（C-narrow，D092）**：
  - Win × x64 → `linux-x64`
  - Mac × arm64 → `linux-x64` + `darwin-arm64`（雙 tarball）
  - Linux × x64 → `linux-x64`
  - Linux × arm64 → `linux-arm64`
- **fail-fast**：`scripts/verify-helper-bundle.js` 已擴 server bundle 檢查（T0316 落地），dist-baseline 缺 tarball 即 abort with actionable msg
- **Server bundle release（獨立 tag）**：`server-bundle-vX.Y.Z` tag push 觸發 `.github/workflows/build-server-bundle.yml`（與 desktop release `pre-release.yml` 完全解耦，spec §6 C-1 + D093）
- **Mac installer size cap**：280 MB（D094）；超出觸發塔台復議
- **私有 fork**：設 `BAT_SERVER_BUNDLE_BASE_URL` env override GitHub Release 預設（D095）
- **詳細**：見 `docs/server-bundle-distribution.md`

## Release

> 以下依 `.github/workflows/*.yml` 實際內容核對（2026-09-02，CP-T0362）。行號皆指該 workflow 檔本身；
> 與 `_ct-workorders/_local-rules.md`「Release 流程實況」同源。

| 線 | workflow | 觸發 | tag 從哪來 |
|----|----------|------|-----------|
| 正式版 | `release.yml` | `on: push: tags: ['v*']`（:3-6） | 本機 `git tag vX.Y.Z && git push origin vX.Y.Z`；CI 由 `GITHUB_REF` 反解版號（:15-23） |
| 預覽版 | `pre-release.yml` | **`workflow_dispatch` only**（:3-9）—— push tag **不會**觸發它 | 不 push tag；tag 由 release step 的 `tag_name` 建立（:252-257） |

預覽版發布指令：

```bash
gh workflow run pre-release.yml -R gowerlin/better-agent-terminal -f version=X.Y.Z-pre.N
```

- 🔴 **`gh` 一律帶 `-R gowerlin/better-agent-terminal`**：本 repo 有 3 個 remote（`origin`=gowerlin / `upstream`=tony1223 / `scandnavik`），`gh` 預設解析到 **upstream**。不帶 `-R` 時唯讀操作報 404，寫入操作（`gh release create` / `gh pr create`）則是打到別人的 repo。
- 🔴 **`-f version=` 不可留空**：留空會走自動遞增 —— `git tag -l 'v*' --sort=-v:refname | head -n1` → patch +1 → 找未使用的 `-pre.N`（`pre-release.yml:34-55`）。本 repo 有 **257 個 `v*` tag**，橫跨 `v0.x`（本 fork 主線）/ `v2.2.x` / `v4.0.x` 三條版本線，`-v:refname` 排序第一名是 **`v4.0.3-pre.1`**，留空即產出 `4.0.4-pre.1`，與主線完全脫節。判版方式：取**本 fork 主線（`v0.x`）**最新 tag 遞增，不要信排序第一名。

### prerelease 標記與下游發佈

| 行為 | `release.yml`（正式版線） | `pre-release.yml`（預覽版線） |
|------|--------------------------|------------------------------|
| GitHub Release `prerelease` | `contains(github.ref, '-pre')` —— tag 含 `-pre` 才標 Pre-release（:254） | **恆為 `true`**（:264） |
| Homebrew tap（`tonyq-org/homebrew-tap`） | tag **不含** `-pre` 時才 `repository-dispatch`（:258-265） | **完全沒有此 step** |
| Chocolatey push | tag **不含** `-pre` 時才跑，另有日期 gate（:267-283） | 無 |

⇒ 走 `release.yml` 打 `v0.5.9-pre.1` 這種 tag 一樣會被標成 Pre-release 且不動 Homebrew；但預覽版的建議路徑仍是 `pre-release.yml`（免 push tag、版號可控）。

### Server bundle 是獨立 tag 線

`build-server-bundle.yml` 由 `workflow_dispatch` 或 `server-bundle-v*` tag 觸發（:3-9）；其 release job 另有 `if: startsWith(github.ref, 'refs/tags/server-bundle-v')` 閘門（:133），產出恆 `prerelease: true`（:160）。此即上方「Server bundle baseline（PLAN-031）」節所指的獨立線。

注意「解耦」的精確意思：`release.yml` / `pre-release.yml` 內各自另有 `server-bundle` job（`release.yml:25-70`）在 desktop 發布時就地重建 bundle 並打進安裝檔。解耦指的是 **baseline tarball 的獨立發佈線**，不是 desktop 流程完全不碰 server bundle。
