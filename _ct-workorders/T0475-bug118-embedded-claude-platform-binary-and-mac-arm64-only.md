---
schema_version: 1
schema_kind: workorder
id: T0475
title: "BUG-118 修復（非 Windows 打包版內嵌 claude 改指平台子套件 binary）+ BUG-117 B3（mac 只打 arm64 dmg）+ verify-packaged-native 擴充（內嵌 claude 存在 / arch、Mach-O cputype 全掃、Linux 產物）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-118
priority: P0
sizing: M
created_at: "2026-10-13T17:03:12+08:00"
started_at: "2026-10-13T17:04:28+08:00"
updated_at: "2026-10-13T17:20:04+08:00"
completed_at: "2026-10-13T17:20:04+08:00"
target_version: v0.6.0-pre.3
depends_on:
  - T0474
related:
  - "D136（使用者裁決：BUG-118 放進 pre.3 採 A1；BUG-117 採 B3 停發 x64 dmg）"
  - "BUG-118 / BUG-117 全文；T0474 回報區 E2 / E4 / E5 與「verify 擴充 (a)(b)(c)」"
  - "T0470 scripts/verify-packaged-native.js；T0472 scripts/verify-native-modules.js（classifyEmbeddedClaude / executableFormat 可重用）"
  - "BUG-052（electron-packaged 版面固定 bin/claude.exe 的由來）"
affects_files:
  - electron/claude-runtime-router.ts
  - electron/__tests__/
  - scripts/verify-packaged-native.js
  - scripts/__tests__/
  - package.json
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - CLAUDE.md
  - docs/
  - README.md
  - _ct-workorders/BUG-117-mac-x64-dmg-ships-arm64-native-binaries.md
  - _ct-workorders/BUG-118-non-windows-package-missing-embedded-claude.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "✅ 本單授權修改 `package.json` 的 `build.mac.target`（arch 只留 `arm64`）；其他 `package.json` 欄位不動；`package-lock.json` 不得變動"
  - "🔴 **Windows 行為不得改變**：win32 的 electron-packaged / node-modules 版面仍解析 `bin/claude.exe`（單元測試證明）；node-modules（dev）版面行為不變"
  - "🔴 不 push、不觸發 workflow、不建 tag；CI 實跑留給 pre.3（塔台觀察）。不執行任何下載回來的 release 產物"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；寫檔維持 LF；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）"
---

# T0475 — BUG-118 修復 + mac 只打 arm64 + 打包產物驗證擴充

## A. BUG-118：內嵌 claude 指向平台子套件 binary（方案 A1）

1. `electron/claude-runtime-router.ts` `resolveEmbeddedClaudePath()`：`electron-packaged` 版面且 `process.platform !== 'win32'` 時，優先回傳 `<resources>/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-<platform>-<arch>[-musl]/claude`（musl 判定沿用專案既有作法；若無，以 claude-code `install.cjs` 的判定邏輯為準並在回報區說明）；不存在才 fallback `bin/claude.exe`。實際打包檔名 / 路徑以 T0474 E2 / E4 為準（`claude-code-darwin-arm64/claude`、`claude-code-linux-x64/claude`）
2. embedded 分支（`resolveClaudeRuntime()` 約 `:236-242`）補 existsSync：兩個候選都不存在時，行為比照 system 偵測失敗（若 `fallbackToEmbedded` 語意不適用，至少 `logger.error` 一次並讓錯誤訊息指出缺哪個檔，不要讓 SDK 丟出難懂的 ENOENT）。決策點與既有 degraded reason / toast 機制對齊，回報區說明
3. 檢查所有使用內嵌路徑的呼叫點（Agent SDK `pathToClaudeCodeExecutable`、terminal claude-cli preset、auth-manager、`getSupportedModels` probe 等）都經由同一解析，不另有寫死 `bin/claude.exe` 的地方
4. 單元測試：darwin-arm64 / linux-x64 / linux-x64-musl / win32-x64 × electron-packaged / node-modules；子套件 binary 缺時 fallback；兩者皆缺時的錯誤路徑

## B. BUG-117：mac 只打 arm64（B3）

1. `package.json` `build.mac.target[].arch` → `["arm64"]`
2. `pre-release.yml` / `release.yml`：mac verify 步驟改 `--arch arm64`；release job 收集 / 上傳 mac 產物的路徑或 glob 若綁定 x64 檔名（無後綴 `.dmg`）一併調整；檢查 Homebrew dispatch（`release.yml`）payload 是否引用 x64 dmg，若有 → 回報區說明影響與建議（不要改下游 repo）
3. `CLAUDE.md`：「electron-builder 26 migration notes」的「mac 打包採雙 arch dmg（D057）」條改寫為 arm64-only（D136），保留「不要改回 universal」理由；「Packaging / Release 前置檢查」相關句同步
4. README / docs 若有 Intel Mac 下載說明 → 改為「不支援 Intel Mac（自 v0.6.0-pre.3 起，D136）」

## C. `scripts/verify-packaged-native.js` 擴充（T0474 建議 a/b/c）

1. **mac**：對每個 `.app`
   - (a) 以 `Contents/MacOS/<exe>` 的 cputype 為基準 arch
   - (b) 掃 `Contents/Resources/app.asar.unpacked` 下所有 Mach-O（含 fat），cputype 必須等於基準或 fat 內含基準；ELF / PE 不檢查；允許清單只放刻意跨平台 / 跨 arch 的目錄（如 whisper `dist/linux-*`、`dist/win32-*`、`dist/mac-<非基準 arch>/`），並在程式碼註解說明
   - (c) 依 A 的解析規則找出內嵌 claude，必須存在且 cputype 符合基準
   - 既有 whisper 檢查保留
2. **Linux**：新增模式檢查 `release/linux-unpacked`（實際目錄以 electron-builder 行為為準）內的內嵌 claude（`claude-code-linux-x64/claude`）存在且為 ELF x86-64；加進 `pre-release.yml` / `release.yml` linux job（`Package for Linux` 之後、上傳前）
3. Mach-O / ELF 判定可重用 T0472 的 `executableFormat` 等（或抽共用模組，`.js` 間 require 即可）；T0474 的判定常數：Mach-O magic `0xFEEDFACF`、fat `0xCAFEBABE`、cputype x86_64 `0x01000007`、arm64 `0x0100000C`
4. 單元測試以暫存假樹覆蓋：arm64 `.app` 全 arm64 → 0；混入 x86_64 / 缺內嵌 claude → 1；fat 含基準 → 0；Linux 缺 claude → 1；ELF 非 x86-64 → 1

## 驗收條件

- [ ] `npm run test:unit` 全套 0 failed（基線 2920）；`npx vite build` exit 0；electron 型別 scratchpad tsconfig 0 新錯；`npx tsc --noEmit` ≤ 36
- [ ] **以 pre.2 實物回放 C 的檢查**（可選但強烈建議）：下載 `v0.6.0-pre.2` arm64 dmg 與 AppImage 到 scratchpad 本單專用新目錄，以 7-Zip 靜態解開，對解出的 `.app` / AppImage 目錄執行新版 verify → **應 FAIL 且指出缺內嵌 claude**（證明新檢查抓得到 BUG-118）；全程不執行產物內任何程式，完成後刪除下載與解壓檔
- [ ] workflow YAML parse 成功（js-yaml），步驟順序斷言
- [ ] BUG-117 / BUG-118 檔：補「修復（T0475）」段、狀態改 ✅ FIXED、`fix_workorder: T0475`（`_bug-tracker.md` 由塔台 sync）

## Sub-session 執行指示

1. 讀本工單 + D136 + BUG-117 / BUG-118 + T0474 回報區 + `electron/claude-runtime-router.ts` + `scripts/verify-packaged-native.js` + 兩個 workflow 的 mac / linux job
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

**DONE**：A / B / C 三部分與 4 項驗收全部完成。實物回放的結果與工單預期不同（見「偏差 1」）：pre.2 產物裡其實有平台子套件的 binary，所以新版 verify 判定 PASS。改用負向對照證明新檢查能抓到 BUG-118。

**Landing check：PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：抽查 `electron/claude-runtime-router.ts`、`electron/__tests__/`、`scripts/verify-packaged-native.js`、`scripts/__tests__/`、`package.json`，全部存在 → PASS
- C-2：沒有 `branch` 欄位；目前在 `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 派發參數：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

**遵守的限制**：
- 沒有 push、沒有觸發 workflow、沒有建 tag
- `package-lock.json` 沒有變動；`package.json` 只改了 `build.mac.target[0].arch`
- 沒用 stash / reset / checkout / restore
- `gh` 只做唯讀操作，且都帶 `-R gowerlin/better-agent-terminal`（`release view`、`release download`）
- 沒有執行下載產物裡的任何程式，只讀檔頭；下載與解壓檔都已刪除

### 產出摘要

**A. BUG-118（方案 A1）**
- `electron/claude-runtime-router.ts`：
  - **新 `embeddedClaudeCandidates(layout, platform, resolvePackageJson, {arch, musl})`**：`electron-packaged` 版面且非 win32 時，回傳兩個候選：
    1. `…/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-<platform>-<arch>[-musl]/claude`
    2. `…/claude-code/bin/claude.exe`

    win32 打包版、node-modules、server-bundle 維持原本的單一路徑。
  - **`resolveEmbeddedClaudePath()`**：新增第 4 個參數 `{arch, musl, exists}`，回傳第一個存在的候選；都不存在時回傳第 1 個候選（讓錯誤訊息與 `claude:detectRuntime` 顯示「應該在的那個」）。
  - **musl 判定**：專案原本沒有給本機 runtime 用的判定（`remote-tools` 用的是 shell probe），所以照 claude-code `install.cjs` 的 `detectMusl()`：`process.report.getReport().header.glibcVersionRuntime === undefined` 即視為 musl。只在 linux 上判定，結果快取，例外時當作 glibc。
  - **A2（存在檢查）**：`resolveClaudeRuntime()` 新增 dep `embeddedClaudeExists`（預設 `fs.existsSync`）。
    - embedded 模式下檔案不存在 → 丟新的 `EmbeddedClaudeMissingError`。訊息為 `Embedded claude binary not found (looked for: <所有候選>). Reinstall BetterAgentTerminal, or switch Settings → Advanced → Claude Runtime to system and install claude.`；同一組路徑只寫一次 `logger.error`。
    - system 模式需要 fallback、但 embedded 也不在 → 丟原本的 `SystemClaudeUnavailableError(reason, detail + "; embedded fallback unavailable: <路徑> not found")`；unsafe customPath 則丟 `SystemClaudeUnsafePathError`。
    - 路徑為 `''`（dev 環境找不到套件）時行為不變，呼叫端照舊不帶 `pathToClaudeCodeExecutable`。
- **決策點：為什麼不新增 degraded reason**
  - `DegradedReason` 的 union 也定義在 renderer（`src/hooks/useRuntimeToasts.ts:7`、`src/types/index.ts:344`、`src/types/electron.d.ts:362`），toast 也有 i18n 對應。新增 reason 會改到 `src/` 與三語系，超出本單的 `affects_files`。
  - degraded 的語意是「system → embedded 降級成功」。embedded 不存在時沒有可降級的目標，比較接近既有的「fallback 停用 + system 不可用 → throw，由呼叫端呈現」。
  - 各呼叫端的實際行為：

    | 呼叫端 | 結果 |
    |---|---|
    | Agent SDK spawn（runQuery / V2 / fork / getSupportedModels） | 被既有 catch 接住 → `claude:error` 顯示訊息 |
    | `claude:get-cli-path` | 既有外層 catch 寫 log 後回 `''`（terminal 視為無 CLI）；system fallback 情境仍走 `SystemClaudeUnavailableError` 的 degraded toast，`detail` 附上缺的路徑 |
    | `auth-status` | 回 `null`，符合「runtime 壞掉」的既有契約 |
    | `auth-logout` | 回 `{ success: false, error }` |
    | `resolveClaudeBaseCommand` | 退回 bare `claude`，與既有降級行為一致 |
- **A3（呼叫點盤點）**：
  - `claude-agent-manager.ts` 的 `resolveRuntimeForSession`（`:622` / `:1345` / `:1743` / `:2332`，涵蓋 runQuery、V2、getSupportedModels、forkSession）與 BUG-047 斷言（`:113`）
  - `handlers/claude.ts`：`get-cli-path`、`detectRuntime`、`auth-status`、`auth-logout`
  - `resolve-claude-base-command.ts`
  - `remote/headless-entry.ts`（server-bundle 版面，不受影響）

  以上全部走 router。`claude-resolver.ts` 的 `claude.exe` 是 system 掃描用的檔名，與內嵌路徑無關。結論：**沒有其他地方寫死內嵌 `bin/claude.exe`**。
- **A4（測試）**：`electron/__tests__/claude-runtime-router.test.ts`
  - 既有 8 處注入 stub 補上 `embeddedClaudeExists: () => true`，維持原意
  - 原本的「packaged 三平台都用 bin/claude.exe」改寫為以下矩陣：
    - win32 不論檔案是否存在都用 `bin/claude.exe`
    - darwin-arm64 / linux-x64 / linux-x64-musl / linux-arm64-musl 用平台子套件
    - 子套件缺 → fallback `bin/claude.exe`
    - 兩者皆缺 → 回傳第 1 個候選
    - musl 只在 linux 生效
    - node-modules 在 darwin-arm64 / linux-x64 / linux-x64-musl / win32-x64 都維持 `bin/claude.exe`
    - 與 `verify-packaged-native.js` 的 parity（6 組）
  - 新增 describe「embedded existence check」6 項：
    - 拋錯並列出路徑、log 只寫一次
    - configured packaged 版面列出全部候選
    - `''` 照舊通過
    - system fallback 情境保留原 reason 並在 detail 附路徑
    - unsafe path 情境仍是 UnsafePathError
    - healthy system 不檢查 embedded

**B. BUG-117（方案 B3）**
- **`package.json`**：`build.mac.target[0].arch` 從 `["x64","arm64"]` 改為 `["arm64"]`。dmg 檔名規則（dmg-builder `${productName}-${version}-${arch}.${ext}`，x64 為 default arch 不加後綴）⇒ 只剩 `BetterAgentTerminal-<v>-arm64.dmg`；`.app` 輸出到 `release/mac-arm64/`。
- **workflow（`pre-release.yml` / `release.yml`）**：
  - mac verify 步驟改名為 `Verify packaged native binaries (macOS arm64)`，指令為 `--platform mac --out release --arch arm64`
  - 新增 `Verify packaged embedded claude (Linux x64)`：放在 `Package for Linux` 之後、上傳之前，指令為 `--platform linux --out release --arch x64`
  - 上傳（`release/*.dmg`）與 release job 收集（`artifacts/release-mac/*`）都是 glob，沒有綁 x64 檔名，不需修改
- **Homebrew**：`release.yml` 的 dispatch payload 只有 `{"version": …}`，**沒有引用 x64 dmg**。另外以 WebFetch 唯讀查看 `tonyq-org/homebrew-tap` 的 `Casks/better-agent-terminal.rb`：
  - 它追蹤的是 **upstream `tony1223/better-agent-terminal`**（`version "3.2.15"`，`on_intel` URL 為 `…-x64.lightweight.dmg`），與本 fork 的 release 無關，所以 D136 對它**沒有影響**
  - 附帶觀察（D136 之前就存在）：本 fork 的 `release.yml` 若在正式版 tag 送出 dispatch，會把本 fork 的版號（v0.x）送進 upstream 的 tap。建議塔台確認 `TAP_GITHUB_TOKEN` 是否有設；若有設，評估是否移除該 step。本單沒有改動
- **CLAUDE.md**：
  - 「mac 打包採雙 arch dmg（D057）」改寫為「mac 只打 arm64 dmg（D136）」，列出 BUG-117 原因與「恢復 x64 須走 Intel runner（B1）、不要 B2」；保留「不要改成 universal」的完整理由
  - 「mac 打包產物檢查」改為「打包產物檢查」，說明 mac (a)–(d) 與 Linux 檢查
  - CI pipeline 句改為「mac / linux job」
  - Claude Runtime 節新增「內嵌 binary 的位置」段（BUG-118 規則、musl、`EmbeddedClaudeMissingError` 行為）
- **README / docs**：
  - README 下載表：`.dmg (Universal: Intel + Apple Silicon)` 改為 `.dmg（Apple Silicon / arm64；自 v0.6.0-pre.3 起不支援 Intel Mac，D136）`
  - `docs/plan-007-release-checklist.md`：三處 x64 dmg 敘述
  - `docs/plan-027-cross-platform-verification.md`：macOS 標題

**C. `scripts/verify-packaged-native.js` 擴充**
- **mac**：對每個 `.app` 檢查以下各項：
  - (a) `Contents/MacOS/<exe>` 的 cputype 作為基準。優先取與 bundle 同名的檔，否則取第一個 Mach-O；cputype 必須符合 `--arch`
  - (b) 遞迴掃描 `app.asar.unpacked` 的所有一般檔（不跟隨 symlink），只讀前 4 KiB：
    - thin 與 fat（`0xCAFEBABE` / `0xCAFEBABF`）都支援，兩種 endian 都處理
    - 有 nfat ≤ 16 的保護，避免把 Java class 誤判成 fat
    - cputype 必須等於基準，或 fat 內含基準
    - ELF / PE 不檢查
    - 允許清單（`isCrossArchAllowed`，程式碼註解說明理由）只有 `@kutalia/whisper-node-addon/dist/{mac,darwin}-<非基準 arch>/`
  - (c) 用 `packagedEmbeddedClaudeCandidates`（router 規則的 JS 複本，有 parity 測試）找出內嵌 claude，必須存在且 cputype 符合基準
  - (d) 既有的 whisper 檢查保留
- **Linux**：`--platform linux` 檢查 `<out>/linux-unpacked`（arm64 為 `linux-arm64-unpacked`，依 app-builder-lib `computeAppOutDir`）下的內嵌 claude，必須存在且為 ELF，e_machine 須符合（x64 = `0x3e`，arm64 = `0xb7`）
- **預設值**：mac `--arch` 預設 `arm64`（= `build.mac.target`，有測試斷言兩者一致），linux 預設 `x64`；新增 `--platform mac|linux`
- **判定常數**：Mach-O / ELF 判定**自含於腳本**，沒有 require `verify-native-modules.js`，因為該檔在 require 時會執行 `main()`（只有 `VITEST` 下才跳過），在 CI 會重跑一次 host 檢查並可能 `process.exit`。常數沿用 T0474 的值：`0xFEEDFACF` / `0xCAFEBABE` / x86_64 `0x01000007` / arm64 `0x0100000C`
- **測試**：`scripts/__tests__/verify-packaged-native.test.mjs` 改寫為 33 項
  - 共用規則：whisper parity、out dir、預設值 = `package.json`、候選、header 解析、Java class、允許清單
  - mac：
    - 全 arm64 → 0
    - 混入 x86_64 → 1，並指出該檔
    - 缺內嵌 claude → 1，列出兩個候選
    - claude arch 錯誤 → 1
    - `bin/claude.exe` fallback 正確 → 0
    - fat 內含基準 → 0
    - fat 不含基準 → 1
    - whisper `mac-x64` 為 x86_64 → 0（允許清單）
    - 主程式 arch 錯誤 → 1
    - 沒有主程式 → 1
    - 缺 whisper → 1
    - 只有 `darwin-` whisper → 0
    - 缺 `.app` → 1
    - 缺 out → 1
  - linux：
    - ELF x86-64 → 0
    - 缺 claude → 1
    - ELF aarch64 → 1
    - 非 ELF → 1
    - 缺 `linux-unpacked` → 1
  - workflow：兩份 YAML 以 js-yaml 解析，斷言 verify 步驟位於 `Package for macOS/Linux` 之後、對應 `upload-artifact` 之前，`if` 與 `run` 完全一致，且不再出現 `--arch x64,arm64`
  - `parseArgs`

**改動檔案**（14 個）：
- 程式與設定：`electron/claude-runtime-router.ts`、`electron/__tests__/claude-runtime-router.test.ts`、`scripts/verify-packaged-native.js`、`scripts/__tests__/verify-packaged-native.test.mjs`、`package.json`、`.github/workflows/pre-release.yml`、`.github/workflows/release.yml`
- 文件：`CLAUDE.md`、`README.md`、`docs/plan-007-release-checklist.md`、`docs/plan-027-cross-platform-verification.md`
- 單據：BUG-117、BUG-118、本工單

全部在 `affects_files` 範圍內。

### 驗證結果

| 驗收項 | 方式 | 結果 | 證據 |
|---|---|---|---|
| unit test 全套 | `npm run test:unit` | ✅ PASS | 173 files，**2964 passed / 1 skipped / 0 failed**（基線 2920，本單新增測試）。輸出中的 `AttachConsole failed` 是 Windows node-pty 的既有雜訊，不是失敗 |
| 本單兩個測試檔 | `npx vitest run` | ✅ PASS | router + verify 共 114 項通過（加入 workflow 斷言前）；加入後 verify 檔 33 項通過 |
| vite build | `npx vite build` | ✅ PASS | exit 0 |
| electron 型別 | scratchpad tsconfig（extends root，strict + noUnused），內容為 router 與其測試 | ✅ PASS | **0 error**。另一份 tsconfig 再加入 consumer（`claude-agent-manager.ts` / `handlers/claude.ts` / `resolve-claude-base-command.ts`）：33 個錯全在本單沒改的程式行（SDK 型別、unused 等既有問題），沒有任何一個涉及 router 符號 |
| 根 tsc | `npx tsc --noEmit` | ✅ PASS | **36** 個錯（≤ 36，與基線相同） |
| workflow YAML | js-yaml 解析 + 步驟順序斷言（常駐於測試檔） | ✅ PASS | 兩份 workflow 各 2 項斷言通過 |
| pre.2 實物回放 · mac | `gh release download v0.6.0-pre.2 -R gowerlin/better-agent-terminal` 下載 `-arm64.dmg`（920,380,868 B），以 7-Zip 26.04 靜態解開，`.app` 放到 `release-mac/mac-arm64/` | ✅ 正向 PASS / ✅ 負向 FAIL | **正向** exit 0：主程式 arm64；`app.asar.unpacked` 下 55 個 Mach-O 全為 arm64（與 T0474 E2 的 55 個一致）；內嵌 claude 解析到 `claude-code-darwin-arm64/claude`（arm64）；whisper `mac-arm64`。**負向**（把 `claude-code-darwin-arm64` 改名）exit 1，訊息為 `no embedded claude (BUG-118)`，並列出兩個候選 |
| pre.2 實物回放 · Linux | 下載 `.AppImage`（1,079,157,335 B），以 7-Zip 解開 SquashFS 到 `release-linux/linux-unpacked/` | ✅ 正向 PASS / ✅ 負向 FAIL | **正向** exit 0：`claude-code-linux-x64/claude`，246,107,320 B，ELF e_machine `0x3e`；`claude-code/` 下確實沒有 `bin/`。**負向**（把 `claude-code-linux-x64` 改名）exit 1，並列出兩個候選 |
| 清理 | `rm -rf` | ✅ | 2026-10-13 17:16 刪除 scratchpad 的 `t0475-dl/`（1.9 GB）與 `t0475-x/`（3.7 GB）。dmg 解出的 `Applications` symlink 未被跟隨，一併刪除。保留純文字結果（`unit-` / `vite-` / `tsc-*-t0475.txt`、`t0475-neg-mac.txt`、tsconfig） |
| BUG 單 | 編輯 | ✅ | BUG-117 / BUG-118：status 改為 `FIXED`，表格狀態改為 ✅ FIXED，補上「修復（T0475）」段；`fix_workorder: T0475` 原本就有。`_bug-tracker.md` 留給塔台 sync |
| CI 實跑（pre.3） | — | ⏸ 未執行 | 工單禁止觸發，留給塔台觀察 |
| mac / Linux 實機 runtime | — | ⏸ 未執行 | AI 無法代驗：需在實機以 embedded 模式開 Agent 與 claude-cli 分頁確認 |

### 偏差與說明

1. **回放結果與工單預期不同**：工單寫「應 FAIL 且指出缺內嵌 claude」，前提是新檢查會找 `bin/claude.exe`。但依 C(c)「依 A 的解析規則找出內嵌 claude」，新規則會先找平台子套件，而 pre.2 的 arm64 `.app` 與 AppImage **都有**平台子套件 binary，所以 PASS 才是正確結果。
   - 這也證明 A1 不必改打包內容就能修好 pre.2 型態的產物。
   - BUG-118 的偵測能力改以負向對照證明（移除平台子套件 → FAIL）。
   - pre.2 舊版 runtime 指向的 `bin/claude.exe` 確實不存在（Linux 回放時已目視確認 `claude-code/` 只有 4 個檔）。
2. **x64 dmg 沒有回放**：B3 之後不再產出 x64 dmg，所以沒有下載。BUG-117 型態的偵測由單元測試覆蓋（混入 x86_64 / 主程式 arch 不符）。
3. **musl 的已知限制**：AppImage 內只有 `claude-code-linux-x64`（沒有 `-musl`），在 musl 系統上 runtime 找不到候選，會丟 `EmbeddedClaudeMissingError`。Electron 本身需要 glibc，因此實務上不受影響。
4. **`verify-native-modules.js` 的 `DESKTOP_PACKAGE_HOSTS` 仍含 `darwin-x64`**：這只影響打包前的 host 檢查，不在本單範圍，未改動。

### 建議後續（塔台決定）

- pre.3 CI 實跑時，觀察 mac / linux 兩個新 verify 步驟的輸出（mac 預期約 55 個 Mach-O 全 arm64）
- mac / Linux 實機驗收 embedded Agent 與 claude-cli 分頁
- 確認本 fork `release.yml` 的 Homebrew dispatch 是否應該保留（見 B 段 Homebrew）
- release notes 寫明「自 v0.6.0-pre.3 起不支援 Intel Mac」（D136）

### 回報時間

- 開始：2026-10-13T17:04:28+08:00
- 完成：見 frontmatter `completed_at`
- commit：`0d39b53`（實作 + 回報）；本 closeout commit 只改 frontmatter 狀態
