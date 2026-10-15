---
schema_version: 1
schema_kind: workorder
id: T0546
title: "安裝檔瘦身第一階段（T0544 S2）：排除重複 / 用不到的 binary 與 node_modules（C1 / C2a / C2b / C3 / C4 白名單 / C5），不改功能"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-10-15T20:33:46+0800"
updated_at: "2026-10-15T20:34:09+0800"
started_at: "2026-10-15T20:34:09+0800"
completed_at: ""
commit: ""
target_version: "0.6.1-pre.4"
depends_on: []
related:
  - "T0544 研究報告（本單依據：「調查結論」§1 / §3 C 表 / §4 S2、「建議下一步」1 / 4）；證據目錄 `C:\\Users\\Gower\\AppData\\Local\\Temp\\t0544\\`（pre.3 解壓產物與 tsv 清單，可直接讀）"
  - "D092（per-host baseline matrix；C3 使實作回到 D092）；D094（不在本單復議）；BUG-052 / BUG-118（內嵌 claude 路徑）"
  - "CLAUDE.md「Packaging / Release 前置檢查」「Server bundle baseline（PLAN-031）」「Claude Runtime Selection」"
affects_files:
  - package.json
  - scripts/build-server-bundle.mjs
  - scripts/verify-server-bundle.js
  - scripts/verify-packaged-native.js
  - scripts/__tests__/
  - electron/__tests__/
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - CLAUDE.md
  - _ct-workorders/T0546-installer-slim-stage1.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍只限 T0544 第一階段（C1 / C2a / C2b / C3 / C4 / C5）。**不做** A（不附 baseline）、B（codex 不內建）、C6（locales）、D1 / D2 / D3（壓縮格式）——這些待使用者決策，另開單。"
  - "🔴 `package.json` 只改 `build`（`files` / `asarUnpack` / per-platform `extraResources` / `files` 排除）與 C4 所需的 `dependencies` ↔ `devDependencies` 搬移（若採①）；**不得**升降任何套件版本，`version` 欄位不動。lock diff 只能是搬移造成的 `dev` 標記變化（回報區附摘要）。"
  - "🔴 workflow 只可改「列出 / 量測產物大小」相關的 step（例：release job 輸出 `scripts/report-artifact-sizes.mjs` 摘要）；不得改觸發條件、版號、發佈步驟、`dist-baseline` 下載（A 不在本單）。"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。`src/styles/settings.css` 的 M 狀態不是你的變更；commit 用 `--only`。"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build / 打包產物；不碰使用者正在用的 BAT（port 9876）與 `C:\\Program Files\\BetterAgentTerminal`。本機打包只用 `--dir`（`npm run build:dir` 或等效），產物留在 `release/`，不安裝。"
---

# T0546 — 安裝檔瘦身第一階段（T0544 S2）

## 背景

`v0.6.1-pre.3`：exe 693.9 / zip 868.8 / AppImage 1030.7 / dmg 871.9 MiB。T0544 實測組成後發現多項**重複或執行期用不到**的內容。本單只做不影響功能的部分；預估結果 exe ≈ 454、zip ≈ 570、AppImage ≈ 554、dmg ≈ 640 MiB（T0544 §4 S2）。

## 範圍（逐項依 T0544 §3 C 表；細節、證據與風險以該報告為準）

| # | 內容 | 預估省（exe / zip / AppImage / dmg，MiB） |
|---|---|---|
| C1 | Windows 排除 `@anthropic-ai/claude-code-win32-*/claude.exe`，保留 `@anthropic-ai/claude-code/bin/claude.exe`（hardlink 被 electron-builder 複製成兩份；Windows router 只用 `bin/claude.exe`，BUG-052） | 86.0 / 112.0 / — / — |
| C2a | desktop 不打包 `@anthropic-ai/claude-agent-sdk-*` 平台子套件（SDK 自帶 claude；每個 spawn 點都傳 `pathToClaudeCodeExecutable`，不會執行） | 48.1 / 68.6 / 138.6 / 56.6 |
| C2b | server bundle 不收 `claude-agent-sdk-<plat>`；`verify-server-bundle.js` 對所有 target 禁止該路徑 | tarball linux-x64 約 -70 |
| C3 | AppImage 只收 `linux-x64` baseline（`build.linux.extraResources.filter` 拿掉 `linux-arm64`；與 D092 矩陣一致） | — / — / 227.2 / — |
| C4 | asar 只收執行期需要的 node_modules：採 T0544 推薦的 ② `build.files` 白名單（`ws`、`opencc-js`、`ajv`、`ajv-formats` 與其 `dependencies` 閉包、`@lydell/node-pty*`、`@anthropic-ai/claude-code*`、codex / whisper / SDK js 等 unpacked 需要者），或 ① 把 renderer-only 套件移到 `devDependencies`——擇一並在回報區說明理由 | ≈ 28.8 / 36.3 / 38.6 / 37.7 |
| C5 | whisper addon 只收本平台 `dist/<dir>`（規則與 `electron/whisper-addon-loader.ts` / `verify-native-modules.js` 同步；mac 保留 `mac-arm64` 與 `darwin-arm64`） | 5.4 / 11.8 / 2.9 / 11.3 |

## 必要守門（缺一不可）

1. **require 守門測試**（C4）：掃描建置後 `dist-electron/*.js` 的 `require()`（含 `createRequire` / 動態字串可解析者），每個外部套件都必須被 `build.files` 白名單（或 `dependencies` 閉包）涵蓋；未涵蓋即失敗。測試放 `scripts/__tests__/` 或 `electron/__tests__/`，並說明如何偵測動態 `require` 的盲點。
2. **router 守門**（C2a）：單元測試斷言 embedded 模式缺檔時不會 fallback 到 `claude-agent-sdk-*` 的 binary（T0544 引用 `electron/claude-runtime-router.ts:319-329`）。
3. **`verify-packaged-native.js` 補 Windows**：`--platform win` 檢查 `resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code/bin/claude.exe` 存在且為 PE，且 `claude-code-win32-*/claude.exe`、`claude-agent-sdk-*` 不存在；mac / linux 檢查同步加入「`claude-agent-sdk-*` 不存在」、Linux 只有 `linux-x64` baseline、whisper 只有本平台目錄。workflow 的 Windows job 在打包後執行它（比照 mac / linux 位置）。
4. **產物大小量測**：新增 `scripts/report-artifact-sizes.mjs`（只讀），在各平台 build job 打包後輸出產物大小與主要組成摘要到 job log（之後 D094 復議的資料來源）；不設失敗門檻。

## 驗收條件

- [ ] 上表 C1 / C2a / C2b / C3 / C4 / C5 全部落地，或於回報區說明不做的理由
- [ ] 守門 1–4 落地並有測試
- [ ] 本機 Windows `--dir` 打包成功；回報 `release/win-unpacked` 大小 vs pre.3 的 Windows 解壓大小（2036 MiB，T0544），並以 `verify-packaged-native.js --platform win` 驗證通過；以 `--runtime=<高號碼>` 啟動打包產物，Agent session（內嵌 claude）、claude-cli 分頁、mermaid 預覽、程式碼高亮可用（截圖或日誌佐證）
- [ ] `npm run build:server-bundle`（或等效）產出的 linux-x64 tarball 不含 `claude-agent-sdk-*`、`verify-server-bundle.js` 通過，回報 tarball 大小
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠、`npx vite build` 成功（回報區附數字）
- [ ] `CLAUDE.md` 補規則：`claude-agent-sdk-<plat>` 不打包（desktop 與 server bundle）、Windows 只保留 `bin/claude.exe`、`build.files` 白名單 + require 守門（新增執行期依賴時要同步白名單）、Linux 只收 `linux-x64` baseline、whisper 只收本平台
- [ ] 回報區列出：三平台預估大小（依實際改動重算）、mac / Linux 只能在 CI 驗證的項目

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**：C1 / C2a / C2b / C3 / C4 / C5 全部落地，守門 1–4 都有測試；本機 Windows `--dir` 打包、驗證與 `--runtime=9546` 實機 smoke 通過。mac dmg / Linux AppImage 只能在 CI 驗證（見「只能在 CI 驗證」）。

Landing check：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，相符
- C-1：工單在 `REPO_ROOT/_ct-workorders/`，PASS
- C-3：`affects_files` 抽查（`package.json`、`scripts/build-server-bundle.mjs`、`scripts/verify-server-bundle.js`、`scripts/verify-packaged-native.js`、`scripts/__tests__/`）皆存在
- C-2：工單無 `branch` 欄位，HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 產出摘要

**變更檔案**
| 檔案 | 內容 |
|---|---|
| `package.json`（只改 `build`） | `files` 加 4 條排除：node_modules 白名單（C4，同時排除 `@anthropic-ai/claude-agent-sdk*` = C2a）、`@anthropic-ai/` 只留 `claude-code*`、`claude-code-win32-*/claude.exe`（C1）、whisper `dist/!(js|${os}-${arch}|${os}32-${arch}|darwin-${arch})`（C5）；`asarUnpack` 移除兩條 `claude-agent-sdk`；`linux.extraResources` 拿掉 `linux-arm64` 兩行（C3）。版本、dependencies 未動 |
| `scripts/build-server-bundle.mjs` | C2b：三個 target 的 `nativePackages` 移除 `claude-agent-sdk-<plat>`（SDK js 保留，headless entry 的 external）；`externalPackages` 不動（`dev-deploy-headless.test.mjs` 斷言它） |
| `scripts/verify-server-bundle.js` | 全 target 禁止 `claude-agent-sdk-`（取代原各 target 的跨平台清單） |
| `scripts/verify-packaged-native.js` | 守門 3：新增 `--platform win`（`bin/claude.exe` 存在且為對應 arch 的 PE）；三平台共用 `verifyPackagedLayout`：`duplicate-claude`（C1）、`sdk-binary`（C2a）、`baseline`（C3 / D092）、`whisper-platforms`（C5）、`runtime-require`（C4：讀 `app.asar` 索引，掃打包後 `dist-electron` 的 require 與 `dynamicRuntimePackages()`，含 `dependencies` 閉包） |
| `scripts/report-artifact-sizes.mjs`（新） | 守門 4：只讀，列安裝檔大小與 unpacked app 組成（app.asar / unpacked 前 N 大套件 / baseline / 其他 resources / Electron），無門檻 |
| `.github/workflows/pre-release.yml` / `release.yml` | Windows job 在 `Package for Windows` 後跑 `verify-packaged-native.js --platform win --out release --arch x64`；三平台在 verify 後、upload 前跑 `Report artifact sizes`（`continue-on-error: true`）。觸發條件、版號、發佈、`dist-baseline` 下載都沒動 |
| `scripts/__tests__/asar-runtime-deps.test.mjs`（新） | 守門 1（23 項） |
| `scripts/__tests__/report-artifact-sizes.test.mjs`（新） | 守門 4（5 項） |
| `scripts/__tests__/verify-packaged-native.test.mjs` | 守門 3：fixture 改為帶 `app.asar`（自寫 writer，另一項以 `@electron/asar` 實際產生的 asar 驗證讀取器）；新增 Windows 6 項、共用 layout 7 項、workflow 2 項×2；既有 mac 測試依 C5 調整（mac-x64 目錄現在是 `whisper-platforms`，不是 foreign-arch） |
| `electron/__tests__/claude-runtime-router.test.ts` | 守門 2：packaged / server-bundle layout 的候選與解析結果永不為空、永不指向 `claude-agent-sdk`；SDK binary 在磁碟上時 embedded 仍丟 `EmbeddedClaudeMissingError`，system→embedded fallback 仍丟 `SystemClaudeUnavailableError` |
| `CLAUDE.md` | 「Packaging / Release 前置檢查」補打包產物檢查（Windows + 共用檢查）、新增「安裝檔瘦身規則」（白名單 + require 守門 + 動態 require 登記、不得用 `build.<platform>.files`、SDK 不打包、Windows 只留 `bin/claude.exe`、Linux 只收 linux-x64、whisper 只收本平台、大小報告）、CI pipeline 順序；「bundle 內容限制」補 `claude-agent-sdk-<plat>` |

**C4 選 ②（白名單），理由**
1. ① 會把 `@anthropic-ai/claude-agent-sdk` 也搬走，但它的 `dependencies`（`@modelcontextprotocol/sdk` → `ajv`）是 `ajv` / `ajv-formats` 進入 prod 閉包的唯一路徑，而打包後 `sdk-*.js` 執行期 `require("ajv/dist/runtime/*")`；保留 SDK 則連帶留下 MCP sdk / express / hono / zod 等約 15–20 MiB。② 只留真正需要的 6.4 MiB 閉包。
2. ② 不動 `dependencies` 與 lock（lock diff = 0），沒有 npm 12 重寫 lock 的風險。
3. **實作差異（重要）**：electron-builder 對 node_modules 只採用 `files` 的**排除** pattern（`app-builder-lib` `getNodeModuleFileMatcher`），所以 T0544 寫的正向白名單 `node_modules/{ws,…}` 不會生效；改寫為一條否定 extglob `!node_modules/!(<保留名單>){,/**}`。測試直接呼叫 electron-builder 的 matcher 驗證。
4. 白名單比 T0544 多兩個：`semver`、`node-addon-api`（whisper → node-abi 的 dependencies，electron-builder 會攤平到頂層；第一次 `--dir` 由 `runtime-require` 檢出）。

**動態 require 盲點怎麼偵測**：打包後的掃描只認字串字面（`require("x")` / `require.resolve("x")` / `<createRequire>.resolve("x/package.json")`）。非字面寫法（template literal、變數、`createRequire`、`process.dlopen`）改從 `electron/` **原始碼**掃：出現這些寫法的檔案必須登記在 `asar-runtime-deps.test.mjs` 的 `DYNAMIC_REQUIRE_SITES`，其套件必須列在 `verify-packaged-native.js` 的 `dynamicRuntimePackages()`（目前 3 個：claude-runtime-router → `@anthropic-ai/claude-code`、codex-agent-manager → `@openai/codex-<plat>-<arch>`、whisper-addon-loader → `@kutalia/whisper-node-addon`）。新增一處未登記 → 測試失敗。白名單漏項的 mutation 測試：拿掉 `ajv` → 3 項失敗並列出 `ajv`（已還原）。

**驗證證據**
| 項目 | 結果 |
|---|---|
| `npm run typecheck` | 0 error |
| `npm run typecheck:electron` | 0 error |
| `npx vite build` | 成功 |
| `npm run test:unit` | 239 files、3995 passed / 1 skipped（skipped 為既有；本單新增測試全數執行） |
| 本機 `npm run build:dir`（Windows，先清掉累積 379 個舊 chunk 的 `dist-electron`） | 成功 |
| `verify-packaged-native.js --platform win --out release --arch x64` | ✅ `PE machine 0x8664`、baseline `[linux-x64]`、8 個 runtime 套件 / 含依賴 15 個 |
| `win-unpacked` 解壓大小 | **1354.1 MiB**（pre.3 Windows 解壓 2036 MiB，-682 MiB）；`app.asar` 159.2 → **13.5 MiB** |
| `--runtime=9546` 啟動 `release/win-unpacked/BetterAgentTerminal.exe`（隔離 env，`BAT_*` 全清、RemoteServer 用隨機埠，未碰 9876） | Agent session（SDK，`model: haiku`）回 `T0546-OK`，日誌 `claudeCodePath=…\app.asar.unpacked\node_modules\@anthropic-ai\claude-code\bin\claude.exe (source=embedded)`；claude-cli 分頁執行同一 `claude.exe` 並顯示信任資料夾提示；Files 分頁 README.md：mermaid 產出 SVG、highlight.js 關鍵字 `const, export, function, return`；日誌無 `Cannot find module` / `MODULE_NOT_FOUND` / `EmbeddedClaudeMissingError`。截圖（scratchpad，未入庫）：`C:\Users\Gower\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\306b9a3f-6b65-466a-9f5a-426b94c9f184\scratchpad\t0546-claude-cli.png`、`…\scratchpad\t0546-markdown-preview.png`。結束後 Terminal Server 已停、runtime userData 已刪 |
| server bundle linux-x64（`node scripts/build-server-bundle.mjs --target=linux-x64`） | **158.6 MiB**（pre.3 baseline 229.0 MiB，-70.4）；tar 清單 `claude-agent-sdk-` 0 筆；`verify-server-bundle.js` ✅；pre.3 舊 tarball 改被新規則擋下。Windows host 沒有 linux 平台套件，以 lock 的 `resolved` URL 下載 `claude-code-linux-x64@2.1.300`、`node-pty-linux-x64@1.1.0`（integrity 皆符合 lock）暫放 `node_modules`，建完已刪除 |

**三平台預估（壓縮後 MiB，依實際改動重算）**
| | exe | zip | AppImage | dmg |
|---|---:|---:|---:|---:|
| pre.3 實測 | 693.9 | 868.8 | 1030.7 | 871.9 |
| 本單（≈ T0544 S2） | ≈ 454 | ≈ 570 | ≈ 554 | ≈ 640 |

與 T0544 S2 的差異：asar 實際 13.5 MiB（T0544 估執行期閉包 6.4 + dist / dist-electron / assets 6.2 ≈ 12.6），另多排除 SDK js 套件（約 3.7 MiB 解壓）與 `@anthropic-ai/claude-code-*` 以外的 `@anthropic-ai/*`，差距在 ±2 MiB 內，維持 S2 估值。本機只打 `--dir`，沒有實際的 NSIS 壓縮大小；CI 的 `Report artifact sizes` 會給出四個產物的實測值。

**只能在 CI 驗證**
- mac（dmg）與 Linux（AppImage）的實際組成與大小：`verify-packaged-native.js` 的共用檢查第一次在這兩個平台跑（`runtime-require` 依賴 electron-builder 在 mac / Linux 的攤平方式與 `@openai/codex-darwin-arm64` / `-linux-x64` 套件存在；`baseline` 依 D092 預期 mac = linux-x64 + darwin-arm64、Linux = linux-x64）
- darwin-arm64 server bundle 去掉 SDK binary 後的大小（T0544 推估約 -57.8）
- 四個產物的壓縮後實測大小（`Report artifact sizes` step）
- NSIS 完整重裝、語音輸入（whisper / opencc）、remote wizard 的實機路徑本單未跑（release 驗收時做）

### 互動紀錄

無。`CT_INTERACTIVE=0`。

### Renew 歷程
無

### 遭遇問題

1. **平台層 `build.<platform>.files` 會把整個 repo 打進 asar**（第一次 `--dir`：app.asar 508 MiB，含 `src/`、`.claude/`、`dist-baseline/`）。electron-builder 把頂層 `files` 正規化成 `[{ filter }]`，平台層的字串 pattern 變成另一個只有排除的 matcher 並被補 `**/*`。改成全部寫在頂層、用 `${os}` / `${arch}` 巨集（`${platform}` 是建置主機，不能用），並加了測試與 CLAUDE.md 規則防止重犯。
2. **正向白名單對 node_modules 無效**（見上「實作差異」）。
3. **whisper 的 `darwin-${arch}` 在各平台都會保留**：glob 無法依平台條件化；addon 1.1.0 沒有 `darwin-*` 目錄，日後若出現會被 CI 的 `whisper-platforms` 擋下。
4. 本機 `release/` 內仍有舊的 `0.6.0-pre.1` 安裝檔（使用者先前的本機打包，未動）；`win-unpacked` 已被本單的 `--dir` 覆寫。`dist-electron` 原有 379 個累積的舊 chunk（vite 不清 outDir、會全部打進 asar），本單打包前清空重建。這只影響本機打包；CI 是乾淨 checkout。另開議題建議：`build:dir` / `build` 前清 `dist-electron`。
5. Bash 工具的 heredoc 對長腳本解析失敗兩次，改用檔案執行；未影響產出。

### 回報時間

2026-10-15T21:07:52+0800
