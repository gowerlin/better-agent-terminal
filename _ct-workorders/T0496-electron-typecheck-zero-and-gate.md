---
schema_version: 1
schema_kind: workorder
id: T0496
title: "electron 端 typecheck 清零（typecheck:electron 基線 77 → 0）+ 加入 CI 硬 gate"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P2
sizing: M
created_at: "2026-10-13T23:24:58+08:00"
started_at: "2026-10-14T00:02:20+08:00"
updated_at: "2026-10-14T00:15:49+08:00"
completed_at: "2026-10-14T00:15:49+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0484"
  - "T0485"
  - "T0491"
  - "T0492"
  - "T0495"
related:
  - "T0486 回報區 B 節（`typecheck:electron` 定義、77 筆基線清單、為何不把 target 寫進 tsconfig.node.json）與「CI gate 建議」2(a)"
  - "L146"
affects_files:
  - "electron/"
  - "vite.config.ts"
  - ".github/workflows/pre-release.yml"
  - ".github/workflows/release.yml"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 修型別不改行為：不用 `any` / `@ts-ignore` 掩蓋；必要的 `@ts-expect-error` 附理由並列出；涉及 IPC / handler 簽章時 trace 所有 consumer（No Regressions）"
  - "🔴 不把 `target` 寫進 `tsconfig.node.json`（T0486：會經 root references 影響 vite / esbuild 的 class field 語意）"
  - "🔴 開工時重新量測基線（T0484 / T0485 / T0491 / T0492 已改動 electron 檔，數字可能不是 77）；回報區附開工與完工清單"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0496 — electron typecheck 清零 + gate

## 實作

1. 重新量測 `npm run typecheck:electron`，逐檔修正到 0（最大宗：`electron/main.ts`、`electron/claude-agent-manager.ts`）
2. 測試檔的型別錯誤以正確型別 / fixture 修正
3. 在 T0495 的 `typecheck` job 加第三步 `npm run typecheck:electron`（依賴鏈不用改；先以 `npm ci --ignore-scripts` 驗證 `tsconfig.node.json` 的 include 不需要 postinstall 產物），失敗阻擋 release
   - 順手：`release.yml:161,165` step 名稱「Rebuild @lydell/node-pty for Electron」改為與 pre-release.yml 一致的「Rebuild native modules for Electron」（實際為全量 `@electron/rebuild`，T0492 範圍外發現 3）
   - 順手：T0487 後所有 action 皆原生 node24，評估移除 `pre-release.yml` 頂層 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`（`release.yml` 本來就沒有）；移除前確認 actionlint / 版本表無仍為 node20 的 action
4. 驗證：`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠；`npx vite build` exit 0；e2e `smoke` / `detached-workspace` / `plan039-multi-remote` 回歸（isolated runtime）；actionlint 0 筆

## 驗收條件

- [ ] 兩個 typecheck = 0（附輸出）；開工 / 完工錯誤清單
- [ ] 每個非顯然修正的行為不變說明（特別是 IPC handler 參數、remote-server、ssh-start-server）
- [ ] unit / vite / e2e 回歸；workflow gate 與 actionlint
- [ ] CLAUDE.md 建議文字（Type check 節：electron 基線改為 0、gate 說明）

## Sub-session 執行指示

1. 讀本工單 + D139 + T0486 回報區 + 相關 electron 檔
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。`npm run typecheck:electron` 77 → **0**，`npm run typecheck` 維持 0。`pre-release.yml` / `release.yml` 的 `typecheck` job 加第三步 `npm run typecheck:electron`（失敗 → build / release skipped）。順手兩項：`release.yml` rebuild step 改名、`pre-release.yml` 移除 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`。

型別修正逐項說明見下表。**兩處修型別時無法避免的行為變更**（皆為型別錯誤揭露的既有 bug，非掩蓋）：

1. **Custom CLI Agents 持久化從來沒成功過**（`electron/main.ts`）：`fs` 是 `import * as fs from 'fs/promises'`，程式卻呼叫 `fs.promises.readFile / writeFile`；`require('fs/promises').promises` 執行期為 `undefined`（Node 實測），bundle 產物同樣是 `ue.promises.readFile`。結果：啟動載入 `custom-clis.json` 永遠走 catch、`agent:save-custom-clis` 永遠 `return false` + `console.error`（Settings 的 Add / Remove 都沒寫入磁碟）。改為 `fs.readFile / fs.writeFile` 後才真正讀寫。
2. **remote server 自簽憑證實際只有 365 天**（`electron/remote/certificate.ts`）：selfsigned v5（實裝 5.5.0）已無 `days` 選項，`index.js` 未給 `notAfterDate` 時固定 `notBefore + 365 天`；但 `persistCertificate` 存的 `expiresAt` 是 10 年，續期判斷（90 天內重生）看的是 `expiresAt`，所以 X.509 過期後 9 年都不會重生。改用 `notAfterDate`（= `notBeforeDate + days`）。影響面：所有 client（`remote-client.ts`、`tls-fingerprint.ts`、`bat-notify.mjs` / `bat-terminal.mjs`）皆 `rejectUnauthorized: false` + SHA-256 指紋釘選，不檢查 notAfter，故舊 365 天憑證過期也不會斷線；本修正只影響**新產生**的憑證，既有 `server-cert.json` 不動、指紋不變。新增 `certificate-validity.test.ts`，對 HEAD 版 `certificate.ts` 紅燈（`expected 31536000000 to be greater than or equal to 315359999000`）、修正後綠燈。

其餘修正皆為純型別（執行期不變）。`any` / `@ts-ignore` / `@ts-expect-error`：**0 處新增**；`worktree-manager.ts` 既有的 2 處 `as any` 隨 wrapper 簡化**移除**。

### Landing Zone Check

- **PASS**。C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1：工單在 `REPO_ROOT/_ct-workorders/` 下。C-2：無 `branch` 欄位（`main`）。C-3：affects_files 皆存在（informational）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（evidence only）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- 開工 status 為 `TODO`（skill 預期 `PENDING`），視同未開始

### 開工清單（77，HEAD `03b0180` + 他人 WIP，2026-10-14 00:02）

與 T0486 基線同數；行號因 T0484 / T0485 / T0491 位移。

| 檔案 | 數 | 錯誤 |
|---|---|---|
| `electron/__tests__/git-scaffold-env.test.ts` | 1 | 101 TS2352 |
| `electron/__tests__/open-external-guard.test.ts` | 2 | 219 / 228 TS2339（`.mock`） |
| `electron/__tests__/pty-manager-server-exit.test.ts` | 1 | 49 TS2322 |
| `electron/__tests__/pty-replay-buffer.test.ts` | 1 | 89 TS2322 |
| `electron/__tests__/remote-tools-handlers.test.ts` | 1 | 86 TS2322 |
| `electron/claude-agent-manager.ts` | 21 | 693 / 1435 TS7023；726 / 793 / 1458 / 1511 TS2322 + 747 / 790 / 1474 / 1508 TS2345（PermissionResult）；1553 / 1555 TS2345（SDKSessionOptions）；1577 TS2322（content blocks）；2196 / 2211 TS2339 ×4（parent_tool_use_id）；2358 TS2339 ×2（timestamp）；2361 / 2387 TS2339（content） |
| `electron/docker-lifecycle.ts` | 1 | 187 TS2322 |
| `electron/handlers/claude.ts` | 1 | 184 TS2345 |
| `electron/image-utils.ts` | 2 | 41 / 49 TS2322 |
| `electron/main.ts` | 19 | 159 TS2345（ShortcutDetails）；969 / 3057 TS18048（`app.dock`）；1440 / 3335 / 3346 TS2339（`fs.promises`）；2074 / 2116 / 2184-2189 / 2192 / 2208 / 2209 / 2211 / 2212 TS2345 ×13（`registerHandler`） |
| `electron/remote/__tests__/helper-capability.test.ts` | 3 | 222 / 239 / 240 TS2345 |
| `electron/remote/__tests__/remote-connection-registry.test.ts` | 2 | 207 TS2345、221 TS2554 |
| `electron/remote/__tests__/server-bundle-distributor.integration.test.ts` | 2 | 140 TS2345、155 TS2790 |
| `electron/remote/arch-detect.ts` | 2 | 61 / 62 TS2339 |
| `electron/remote/certificate.ts` | 1 | 77 TS2345 |
| `electron/remote/remote-server.ts` | 4 | 1077 TS18046 ×3、1078 TS18046 |
| `electron/remote/server-bundle-distributor.ts` | 1 | 342 TS2345 |
| `electron/remote/server-entry.ts` | 1 | 9 TS2459 |
| `electron/remote/ssh-start-server.ts` | 4 | 381 / 397 / 423 / 577 TS2345 |
| `electron/terminal-command-handlers.ts` | 1 | 266 TS2345 |
| `electron/worktree-manager.ts` | 5 | 14 TS2322、66 / 78 / 160 TS2339、324 TS2322 |
| `vite.config.ts` | 1 | 30 TS2769 |

### 完工清單

**0**。`npm run typecheck:electron` exit 0、無任何 `error TS`；`npm run typecheck` exit 0（2026-10-14 00:14，HEAD `33123bf` + 本單改動）：

```
npm notice run better-agent-terminal@0.6.0-pre.4 typecheck:electron
npm notice run tsc --noEmit -p tsconfig.node.json --composite false --target ES2022
electron exit=0
npm notice run better-agent-terminal@0.6.0-pre.4 typecheck
npm notice run tsc --noEmit -p .
src exit=0
```

### 修正明細與行為不變說明

| 檔案 | 改動 | 行為 |
|---|---|---|
| `electron/remote/handler-registry.ts` | `registerHandler` 改泛型 `registerHandler<A extends unknown[]>(channel, handler: (ctx, ...args: A) => …)`，存入 Map 時 `handler as Handler`；JSDoc 註明 IPC / remote frame 參數不在執行期驗證 | 不變：只改簽章，Map 內容與 `invokeHandler` 不動。消掉 main.ts 13 筆（`workspace:save` / `settings:save` / `snippet:*` / `profile:*` 等宣告具體參數型別的 handler）。consumer trace：`registerPtyHandlers` / `registerClaudeHandlers` / `registerGitHandlers` / `registerFsHandlers` / `registerRemoteToolsHandlers` / `registerTerminalHandlers` 以 `HandlerRegistrar`（`SharedHandler`）接收，泛型實例化為 `any[]`，仍可指派；`headless-entry.ts` 同；renderer / preload 不受影響 |
| `electron/main.ts` | ① `writeShortcutLink(…, 'update', { target: shortcut.target, appUserModelId })` ② `app.dock?.setIcon` / `app.dock?.setBadge` ③ `fs.promises.readFile/writeFile` → `fs.readFile/writeFile`（3 處） | ① 不變：`update` 只改傳入欄位，`target` 是剛 `readShortcutLink` 讀到的同一值 ② 不變：兩處都在 `process.platform === 'darwin'` 內，mac 上 `app.dock` 必定存在 ③ **行為變更（修 bug）**，見結果摘要 1。consumer：`SettingsPanel.tsx` 的 Add / Remove 呼叫 `saveCustomClis()` 且不看回傳值，preload / `electron.d.ts` 簽章不變 |
| `electron/claude-agent-manager.ts` | ① `PendingRequest.resolve` 改 `(value: PermissionResult) => void`；4 個 `(result: unknown)` wrapper 改 `PermissionResult`；`resolvePermission` 以 `result as PermissionResult` 交給 SDK（附註解：renderer 的 allow / deny 原樣傳遞）② `runQuery` / `runQueryV2` 補 `: Promise<void>`（兩者互相呼叫造成 TS7023）③ `v2Options: SDKSessionOptions`；`executable` 以 `as SDKSessionOptions['executable']` 標註（SDK 型別只列 `'node' \| 'bun'`，但 `sdk.mjs` 把值當指令 spawn，BAT 傳絕對 node / Electron 路徑，與 v1 相同）④ V2 多內容訊息 `content` 以 `SDKUserMessage['message']['content']` 標註（`media_type` 來自 data URL，未收窄，與 v1 相同）⑤ 歷史 transcript `obj` 型別補 `parent_tool_use_id?` ⑥ `fetchSubagentMessages` 的 `messages` 標成 `SubagentEntry[]`（SDK `SessionMessage` 型別沒有 `timestamp`、`message` 為 `unknown`） | 全部不變：①的 `resolveAskUser` 原本就傳 `{ behavior: 'allow', updatedInput }`；IPC `claude:resolve-permission` 簽章不變 ② 回傳值原本就無人使用 ③④ 傳給 SDK 的物件內容逐欄位相同 ⑤⑥ 只是讀取既有欄位 |
| `electron/handlers/claude.ts` | `claude:start-session` 的 `options.permissionMode` → `PermissionMode \| 'bypassPlan'`、`effort` → `EffortLevel` | 不變：只收窄宣告型別（同檔 `set-permission-mode` / `set-effort` 原本就以 `as` 轉成同型別）；codex 分支的 `CodexStartOptions` 收 `string`，收窄後仍相容 |
| `electron/terminal-command-handlers.ts` | `terminal:create-agent-command` 改 `(_ctx, rawOpts) => { const opts = rawOpts as TerminalAgentCommandOptions` | 不變：同檔上一行 `terminal:create-with-command` 的既有寫法 |
| `electron/remote/remote-server.ts` | 去尾端 `null` 的迴圈改用 `let list: unknown[] = args`，迴圈後 `args = list` | 不變：沒有尾端 null 時 `args` 仍是同一個陣列參考，有時同樣 `slice` |
| `electron/remote/server-bundle-distributor.ts` | `if (baselineLookup.state !== 'ok' && !shouldFallbackToDownload(…))` | 不變：`state === 'ok'`（但缺 entry / tarballPath）時原本 `shouldFallbackToDownload('ok')` 回 `true` → 不進 if → 走下載；新寫法同樣不進 if |
| `electron/remote/server-entry.ts` | `RemoteHandlerContext` 改由 `export type { HandlerContext as RemoteHandlerContext } from './handler-registry'` 匯出（`headless-entry.ts` 只是本地別名、沒 export） | 不變：純型別匯出，名稱不變 |
| `electron/remote/ssh-start-server.ts` | `SpawnFn` 的 `options` 改必填、`stdio?: StdioOptions`（原 `unknown`） | 不變：唯一呼叫點 `runSsh` 一直傳 options；`child_process.spawn` 的 `(command, args, options: SpawnOptions)` overload 才能指派；測試 mock 宣告 options 可選 / `unknown` 仍相容 |
| `electron/remote/arch-detect.ts` | execFile callback 參數標 `stdout: string \| Buffer, stderr: string \| Buffer` | 不變：保留既有的 Buffer 防禦分支（原本 TS 推成 `never`） |
| `electron/remote/certificate.ts` | `options: SelfsignedOptions`（以 `Parameters<typeof selfsigned.generate>[1]` 取得，套件未 export 該型別）；`days` → `notBeforeDate` + `notAfterDate` | **行為變更（修 bug）**，見結果摘要 2 |
| `electron/worktree-manager.ts` | `execFileAsync` 改成只收 `(file, args, options: ExecFileOptionsWithStringEncoding)` 的單一 wrapper（移除 2 處 `as any` 與用不到的「無 args」分支）；`runGit` options 同型別 | 不變：唯一呼叫者 `runGit` 一律傳 args 陣列、不傳 `encoding`，`{ ...options, windowsHide: true }` 與原分支相同 |
| `electron/docker-lifecycle.ts` | `startContainer` 回傳型別 `token?: string \| null` | 不變：`parsePersistedToken` 本來就可能回 `null`。renderer（`start-server.ts`）只用 `startResult.token &&` 與 `?? stateToken`，`null` 與 `undefined` 行為相同；preload / `electron.d.ts` 未改 |
| `electron/image-utils.ts` | `let buf: Buffer = …` | 不變：只補註記（TS 5.9 + `@types/node` 的 `Buffer<ArrayBufferLike>` 推論） |
| `vite.config.ts` | `/// <reference types="vitest" />` → `/// <reference types="vitest/config" />` | 不變：triple-slash 只影響型別；vitest 4 的 `UserConfig.test` 擴充在 `vitest/config` |
| 測試 7 檔 | `parseEnv(env)`（參數本來就是 `Record<string, unknown>`，拿掉錯誤 cast）；`vi.mocked(deps.logError)`；`emit` 改 `Mock<PtyManagerDeps['emit']>` / `vi.fn<PtyManagerDeps['emit']>()`（同 `pty-manager-deps.test.ts`）；`handler: SharedHandler`、ctx 傳 `{ windowId: null }`；`create` helper 的 `c: HelperInvokeContext`（fail-closed 測試本來就傳不完整 ctx）；`ReturnType<typeof deferred<void>>`；`detectRemoteArch` mock 補 `rawUname: 'x86_64'`；`delete (process as { resourcesPath?: string }).resourcesPath` | 測試斷言未改 |
| `electron/remote/__tests__/certificate-validity.test.ts`（新增） | 預設 10 年、指定 30 天兩案 | — |

### Workflows

- `pre-release.yml` / `release.yml` `typecheck` job：`Typecheck (src/)` 之後加 `- name: Typecheck (electron/)` / `run: npm run typecheck:electron`；job 註解改為 src / electron 皆 0。依賴鏈未改（`build.needs` 已含 `typecheck`）
- `--ignore-scripts` 足夠：於 scratchpad detached worktree（HEAD `02ae042` + 本單檔案）跑 `npm ci --ignore-scripts`（無 `node_modules/electron/dist`）→ `typecheck:electron` exit 0 / 0 錯、`typecheck` exit 0。負向測試：在該 worktree 的 `electron/image-utils.ts` 尾端加一行型別錯誤 → `typecheck:electron` exit **2**（`error TS2322`）；還原後 exit 0。worktree 已 `git worktree remove --force` + `prune`，`git worktree list` 只剩主工作樹
- 順手 1：`release.yml` 兩個 `Rebuild @lydell/node-pty for Electron (Windows)` / `(macOS/Linux)` step（`if` 互補、指令同為 `npx --yes @electron/rebuild`）合併為單一 `Rebuild native modules for Electron`，與 `pre-release.yml` 一致；執行內容不變
- 順手 2：移除 `pre-release.yml` 頂層 `env: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`。以 `gh api repos/<action>/contents/action.yml?ref=<tag>` 確認兩檔用到的 action 全為 node24：`actions/checkout@v7`、`actions/setup-node@v7`、`actions/upload-artifact@v7`、`actions/download-artifact@v8`、`softprops/action-gh-release@v3`、`peter-evans/repository-dispatch@v4`（後者只在 release.yml）。`release.yml` 原本就沒有此 env
- actionlint：`go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7 -oneline .github/workflows/*.yml` → **0 筆、exit 0**；js-yaml 兩檔可解析。本機無 shellcheck，`run:` 腳本的 shellcheck 未跑（同 T0487）
- 換行維持：`pre-release.yml` CRLF、`release.yml` LF（改後皆未混用）；electron 檔各自維持原換行（`certificate.ts` / `server-entry.ts` CRLF，其餘 LF）

### 驗收

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm run typecheck` = 0 | **PASS** | exit 0（主工作樹，HEAD `33123bf` + 本單） |
| `npm run typecheck:electron` = 0 | **PASS** | 77 → 0，exit 0；`npm ci --ignore-scripts` 環境亦 0 |
| `npm run test:unit` 全綠 | **PASS** | `Test Files 193 passed (193)`、`Tests 3270 passed \| 1 skipped (3271)`，exit 0（含當時 T0502 WIP；不含新增的 certificate 測試，該檔另跑 2 passed） |
| `npx vite build` exit 0 | **PASS** | renderer 4.64 s、electron 1.25 s、preload 皆 ✓ built；產物 custom-clis 段為 `await ue.readFile(` |
| e2e 回歸（isolated runtime） | **PASS** | `npx playwright test e2e/smoke.spec.ts e2e/detached-workspace.spec.ts e2e/plan039-multi-remote.spec.ts e2e/detached-terminal-persistence.spec.ts` → **7 passed**（26.5 s），各 spec `runtime userData removed: true`、Terminal Server teardown 後不存活；未以預設實例啟動 |
| workflow gate + actionlint | **PASS** | 見 Workflows 節 |
| 本單新測試紅綠 | **PASS** | `certificate-validity.test.ts`：HEAD 版 2 failed、修正後 2 passed |

未做：Custom CLI 載入 / 儲存的實機點測（e2e 未涵蓋 Settings → Custom CLI Agents）；建議 pre.5 實機驗收時順手在 Settings 新增一個 custom CLI、重啟後確認仍在（`<userData>/custom-clis.json` 出現）。

### CLAUDE.md 建議文字（由 T0493 套用）

若 T0493 已採用 T0486 的「Type check」新節，將第二條改為：

```markdown
- `npm run typecheck:electron`（= `tsc --noEmit -p tsconfig.node.json --composite false --target ES2022`）：涵蓋 `electron/**` + `vite.config.ts`，基線 **0**（T0496 清零，原 77）。旗標只用於型別檢查：`--target ES2022` 消除未設 target 造成的 TS2802、`--composite false` 消除 composite file-list 的 TS6307；**不要**把 `target` 寫進 `tsconfig.node.json`（vite / esbuild 會經 root `references` 讀它，`useDefineForClassFields` 預設值隨 target 變動，可能改變 electron 產物語意）。改 `electron/**` 的工單驗收寫「`npm run typecheck:electron` = 0」。
- `registerHandler`（`electron/remote/handler-registry.ts`）是泛型：handler 可宣告具體參數型別，但 IPC / remote frame 參數**不在執行期驗證**，需要防禦的 handler 自己收窄。
- CI：`pre-release.yml` / `release.yml` 的 `typecheck` job 依序跑 `npm run typecheck`、`npm run typecheck:electron`（`npm ci --ignore-scripts` 即可，T0496 實測），任一失敗 → build / release skipped。
```

「Packaging / Release 前置檢查」的 **Typecheck gate** 條目（T0495 建議文字）把「`typecheck:electron` 尚未加入（基線 77，T0496 清零後加入同一 job）」改為「同一 job 第三步跑 `npm run typecheck:electron`（T0496）」。

### 範圍外發現（未改）

- `src/types/electron.d.ts` / `electron/preload.ts` 的 `docker.startContainer` 回傳型別寫 `token?: string`，main 端實際可能回 `null`（本單只放寬 main 端）。renderer 用法對 `null` 安全，不急
- 其他 `fs/promises` 命名空間誤用：已由 tsc 全面確認 electron 端再無 `fs.promises` 於 `fs/promises` 命名空間上的呼叫（0 錯即證）
- `release.yml` 的 `peter-evans/repository-dispatch@v4` 為 node24，已一併確認

### Commit

- `git commit --only` 本單 27 檔（25 個既有 electron / vite / workflow 檔 + 1 個新測試 + 本工單）；不 push。hash 見 `git log`（本回報寫於 commit 前）
