---
schema_version: 1
schema_kind: workorder
id: T0474
title: "研究：v0.6.0-pre.2 mac x64 dmg 內各原生元件的實際 CPU 架構（BUG-117），並提出修正選項"
type: research
status: DONE
repo: better-agent-terminal
project: BUG-117
priority: P1
sizing: S
created_at: "2026-10-13T16:47:18+08:00"
started_at: "2026-10-13T16:47:40+08:00"
updated_at: "2026-10-13T16:59:11+08:00"
completed_at: "2026-10-13T16:59:11+08:00"
target_version: v0.6.0-pre.3
depends_on: []
related:
  - "BUG-117（推論與疑似影響元件清單）"
  - "T0472 回報區「待查」段"
  - "D057：mac 採雙 arch dmg，不可改回 universal（@electron/universal 的 x64ArchFiles whack-a-mole）"
affects_files:
  - _ct-workorders/BUG-117-mac-x64-dmg-ships-arm64-native-binaries.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **純研究，不改任何 tracked 檔**（除本工單與 BUG-117）；不動 `node_modules/`（T0473 正在同一工作樹跑 `npm ci`）、不跑 vite build / 單元測試"
  - "🔴 下載的 dmg / 解出的檔案一律放 scratchpad（或 `%TEMP%`）下**本單專用的新空目錄**，視為不可信資料：不執行其中任何程式（包括 `claude --version`），只做靜態檢查（magic bytes、Mach-O header cputype、`file` 等）。完成後刪除下載與解壓檔，回報區記錄刪除"
  - "🔴 `gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；不 push；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`"
---

# T0474 — 研究：mac x64 dmg 原生元件架構

## 任務

1. 取得 `v0.6.0-pre.2` 的 `BetterAgentTerminal-0.6.0-pre.2.dmg`（x64，約 930 MB）；為對照也可取 `-arm64.dmg`（若時間 / 空間允許）
2. 在 Windows 上靜態解開 dmg（例：7-Zip；本機若無合適工具，回報可用方案，不得安裝需要管理員權限的軟體以外的東西——若需安裝工具，限 portable / 使用者層級，回報區記錄）
3. 對 x64 `.app` 內下列檔案讀 Mach-O header 判定 cputype（x86_64 / arm64 / fat 含哪些）：
   - `Contents/MacOS/BetterAgentTerminal`（基準）
   - `app.asar.unpacked/node_modules/@anthropic-ai/claude-code/bin/claude.exe` 及是否存在 `claude-code-darwin-*` 子套件
   - `@anthropic-ai/claude-agent-sdk*` 內的原生 binary / 平台子套件
   - `@lydell/node-pty*` 的 prebuild / 平台子套件
   - `better-sqlite3/build/Release/better_sqlite3.node`
   - `@img/sharp-*` / `@img/sharp-libvips-*`
   - `@kutalia/whisper-node-addon/dist/mac-x64/whisper.node`（對照組，預期 x86_64）
   - 其他 `asarUnpack` 內含 `.node` / 可執行檔的套件（掃描列出）
4. 結論：BUG-117 成立與否、受影響元件與對 Intel Mac 使用者的實際後果（哪些功能壞、哪些有 fallback）
5. 修正選項（至少 2 個，含代價）：例如 mac 改為兩個 job（`macos-13` x64 runner 建 x64、`macos-latest` 建 arm64）、或 arm64 host 上以 `npm_config_cpu` / `--cpu=x64` 另行安裝 x64 子套件並在 electron-builder 打包 x64 前替換、或其他；並評估是否應擴充 `scripts/verify-packaged-native.js` 檢查各 `.app` 內這些元件的 cputype。推薦一個
6. 更新 BUG-117：證據摘要、嚴重度建議（只改 BUG 檔本身）

## 驗收條件

- [ ] 每個列出元件的 cputype 證據表（路徑 + 判定 + 檔案大小）
- [ ] 結論 + 修正選項 + 推薦
- [ ] 下載 / 解壓檔已刪除

## Sub-session 執行指示

1. 讀本工單 + BUG-117 + `package.json` 的 `build`（mac / asarUnpack / npmRebuild）+ `pre-release.yml` mac 流程
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 研究 → 填回報區 → `DONE`；commit 本工單 + BUG-117；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

**DONE**：BUG-117 **成立**，而且範圍比原先推論大。另有兩項附帶發現，需要塔台另外開單（見「附帶發現」）。

- 驗收 1 ✅ 每個元件的 cputype 證據表（下方 E2）
- 驗收 2 ✅ 結論 + 修正選項 + 推薦（下方「結論與修正選項」）
- 驗收 3 ✅ 下載與解壓檔已刪除（下方 E6）

**Landing check：PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 下的檔案 → 不適用
- C-2：無 `branch` 欄位
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發參數：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

**遵守的限制**：tracked 檔案只改了本工單與 BUG-117；沒有動 `node_modules/`（只用 grep 讀 `app-builder-lib` 原始碼）；沒跑 build 或測試；沒有執行 dmg / AppImage 內的任何程式；`gh` 一律帶 `-R gowerlin/better-agent-terminal`，且只做唯讀操作。

### 證據

**E1 — 取得與解開（全部是靜態操作）**

- `gh release download v0.6.0-pre.2`：
  - `BetterAgentTerminal-0.6.0-pre.2.dmg`（x64）929,787,393 B
  - `-arm64.dmg` 920,380,868 B
  - 為了確認影響範圍，另外下載 `.AppImage` 1,079,157,335 B
  - 三個檔案的大小都和 release asset 相同
- 工具：本機已安裝的 7-Zip 26.04（`C:\Program Files\7-Zip\7z.exe`），沒有另外安裝任何東西。dmg 解出來是 HFS+（`4.hfs`），AppImage 解出來是 SquashFS。
- Mach-O 判定：用自寫的 `macho_scan.py`（以 `python -I` 執行，放在下載目錄之外）只讀檔頭 magic 與 `cputype`，對兩個 `.app` 做全量掃描。
- 結果統計：
  - x64 `.app` 共 84 個 binary：19 個 x86_64、**55 個 arm64**、9 個 ELF、1 個 PE
  - arm64 `.app` 共 84 個 binary：74 個 arm64、9 個 ELF、1 個 PE

**E2 — x64 `.app`（`BetterAgentTerminal-0.6.0-pre.2.dmg`）元件 cputype 表**

下表「app.asar.unpacked」簡寫為 `U/`，指 `Contents/Resources/app.asar.unpacked/node_modules/`。

| 元件 | 路徑 | 判定 | 大小（B） |
|---|---|---|---|
| 主程式（基準） | `Contents/MacOS/BetterAgentTerminal` | ✅ x86_64 | 13,076 |
| Electron Framework | `Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework` | ✅ x86_64 | 196,134,496 |
| Helper ×4、Squirrel、Mantle、ReactiveObjC、libEGL/GLESv2/ffmpeg/swiftshader、crashpad | `Contents/Frameworks/**` | ✅ x86_64（共 19 個 binary） | — |
| 內嵌 claude（BAT 解析出的路徑） | `U/@anthropic-ai/claude-code/bin/claude.exe` | ❌ **不存在**（連 `bin/` 目錄都沒有，見 E4） | — |
| claude-code 平台子套件 | `U/@anthropic-ai/claude-code-darwin-arm64/claude` | ❌ arm64；**沒有 `-darwin-x64`** | 229,616,464 |
| claude-agent-sdk 平台子套件 | `U/@anthropic-ai/claude-agent-sdk-darwin-arm64/claude` | ❌ arm64；沒有 `-darwin-x64` | 204,534,752 |
| node-pty | `U/@lydell/node-pty-darwin-arm64/pty.node` | ❌ arm64；沒有 `-darwin-x64` | 85,160 |
| node-pty helper | `U/@lydell/node-pty-darwin-arm64/spawn-helper` | ❌ arm64 | 50,512 |
| better-sqlite3 | `U/better-sqlite3/build/Release/better_sqlite3.node` | ❌ arm64 | 1,932,400 |
| sharp | `U/@img/sharp-darwin-arm64/lib/sharp-darwin-arm64.node` | ❌ arm64；沒有 `sharp-darwin-x64` | 262,296 |
| libvips | `U/@img/sharp-libvips-darwin-arm64/lib/libvips-cpp.8.17.3.dylib` | ❌ arm64；沒有 `-darwin-x64` | 16,076,984 |
| whisper（原本預期的對照組） | `U/@kutalia/whisper-node-addon/dist/mac-x64/whisper.node` | ❌ **arm64**（與 `mac-arm64/whisper.node` 的 sha256 完全相同：`94efeb05…bebf`） | 658,800 |
| whisper 依賴庫 | `U/@kutalia/whisper-node-addon/dist/mac-x64/libggml*.dylib`、`libwhisper*.dylib` | ❌ arm64（8 個檔都與 mac-arm64 相同，例如 `libggml-cpu.dylib` 兩邊的 sha256 都是 `b281c8d4…4e4f`） | — |
| codex（掃描時新發現的套件） | `U/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex` | ❌ arm64；沒有 `codex-darwin-x64` | 241,555,024 |
| codex 附屬 | 同上目錄的 `codex-code-mode-host`、`codex-path/rg`、`codex-resources/**`（voice、zsh、gst） | ❌ arm64（共 27+2 個） | — |
| 非 mac 平台的 binary | `whisper .../dist/linux-x64/*`（ELF ×9）、`.../win32-x64/whisper.node`（PE） | 跨平台隨套件附帶，不在 mac 上載入 | — |

**arm64 `.app` 對照**：
- 主程式 arm64（53,360 B），Electron Framework arm64（178,016,192 B）
- 上表所有 npm 原生元件都是 arm64，路徑完全相同
- 同一個檔案在 arm64 `.app` 裡稍微大一點，因為 arm64 有 ad-hoc 簽章，x64 則跳過了簽章（CI log：`skipped macOS application code signing`）

**E3 — CI 打包過程（run `37265491592`，job `build (macos-latest, mac)` `111621994717`，commit `9cb7cd4`）**

- 環境：`node: v24.20.0`、`npm: 11.19.0`，runner 為 arm64（cache key `node-cache-macOS-arm64-npm-…`）
- 之後依序：
  - `npx --yes @electron/rebuild` → `✔ Rebuild Complete`（只建 host arm64）
  - `skipped dependencies rebuild reason=npmRebuild is set to false`
  - `packaging platform=darwin arch=x64 … appOutDir=release/mac`
  - `packaging platform=darwin arch=arm64 … appOutDir=release/mac-arm64`
- ⇒ 證實兩個 `.app` 打包的是同一份 arm64 `node_modules`。
- npm 11.19.0 雖然印出 `install-scripts 8 packages have install scripts not yet covered by allowScripts`，但**沒有真的擋下**。證據：同一 run 的 Windows job 有 `signing with signtool.exe path=…\claude-code\bin\claude.exe`；本機安裝的 Windows 版 `bin/claude.exe` 為 249,522,848 B，與 `claude-code-win32-x64/claude.exe` 大小相同，代表 `install.cjs` 有執行。這與 T0473 寫進 CLAUDE.md 的「npm 11 只警告、照跑」一致。

**E4 — 內嵌 claude 在 mac / Linux 打包產物中完全缺席（根因已確認）**

1. **dmg 裡沒有這個檔**：x64 與 arm64 兩個 dmg 的 HFS catalog 中，`@anthropic-ai/claude-code/` 下都只有 `cli-wrapper.cjs`、`install.cjs`、`LICENSE.md`、`package.json`，**沒有 `bin/` 目錄**。
2. **排除「7-Zip 漏列 hardlink」的可能**：拿 HFS 已用空間對照列出檔案的配置量：
   - x64：1,750,982,656 − 3,014,656 = 1,747,968,000，列出 1,747,247,104，差 0.72 MB
   - arm64：差約 0.74 MB
   - 如果有一個 229 MB 的 hardlink 被藏起來，差值不可能這麼小。`[HFS+ Private Data]` 目錄也是空的。
3. **Linux 也一樣**：AppImage（SquashFS）的 `resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code/` 同樣沒有 `bin/`，但 `claude-code-linux-x64/claude`（246,107,320 B）有打包進去。
4. **根因在 electron-builder**：`app-builder-lib@26.8.1` 的 `out/util/appFileCopier.js:127-138` `getNodeModuleExcludedExts()` 在 `platform !== WINDOWS` 時，會把 `.dll` 與 `.exe` 加入 node_modules 的排除副檔名（electron-builder issue #1738）。`out/util/NodeModuleCopyHelper.js:71-82` 只有在 `fileMatched && forceIncluded`（`forceIncluded` 要靠 `build.onNodeModuleFile` hook 回傳 true）時才跳過這個排除，而本 repo 沒設 `onNodeModuleFile` ⇒ 非 Windows 目標一律丟掉 `bin/claude.exe`。
5. **BAT 確實指向這個檔**：`electron/claude-runtime-router.ts:151-154` 在 `electron-packaged` 版面固定組出 `<resources>/app.asar.unpacked/node_modules/@anthropic-ai/claude-code/bin/claude.exe`，而且 `resolveClaudeRuntime()` 的 embedded 分支（`:236-242`）不檢查檔案是否存在。
6. **SDK 沒有退路**：SDK 0.2.113（`sdk.mjs`）在 spawn 遇到 ENOENT 時會報錯 `Claude Code native binary not found at <path>…`，不會改用自己的 `claude-agent-sdk-<plat>` binary（只有沒傳 `pathToClaudeCodeExecutable` 時才會用）。
   - ⇒ **推論**（沒有在 mac / Linux 實機驗證）：pre.2 的 mac（兩種 arch）與 Linux 桌面版，在 `claudeRuntime.mode=embedded`（預設）下 Agent session 與 claude-cli 分頁都會失敗；只有切到 system runtime 才能用。
   - 這個問題**不限於 Intel Mac**，所以不屬於 BUG-117 的範圍，建議另開 BUG（見「附帶發現」）。

**E5 — 其他元件在桌面 runtime 的實際用途**（決定 Intel Mac 的實際影響）

- `better-sqlite3`：`electron/`、`src/` 沒有任何 runtime import。`electron/snippet-db.ts` 用的是 JSON。better-sqlite3 只給 server bundle 用（`scripts/verify-server-bundle.js:214`）⇒ 桌面版**沒有影響**。
- `sharp`：只有 `scripts/generate-icons.js`（開發用）使用 ⇒ 桌面版**沒有影響**（只是佔空間）。
- `@lydell/node-pty`：`electron/pty-manager.ts:13-26` 在 import 失敗時退回 `child_process` ⇒ 功能可用，但會**降級**（沒有真正的 PTY，終端能力受限）。
- codex：`electron/codex-agent-manager.ts:134-150` 會找 `@openai/codex-${platform}-${arch}`，也就是 `codex-darwin-x64`；找不到時往下找系統 codex ⇒ 內嵌 codex 不可用，只有系統另裝 codex 才能用。

**E6 — 清理**

2026-10-13 16:57 刪除 scratchpad 的 `t0474-dl/`（約 6.0 GB：3 個下載檔 + 2 個 dmg 解壓目錄 + 7z 清單），以及 3 份 CI job log。只保留掃描腳本與兩份 `*-scan.tsv`（純文字結果，在 scratchpad，不在 repo）。

### 結論與修正選項

**結論：BUG-117 成立，嚴重度建議 🔴 high。**

Intel Mac 使用 x64 dmg（pre.2）的實際後果：

| 功能 | Intel Mac 實際狀況 | 有沒有退路 |
|---|---|---|
| App 啟動、UI、Electron | ✅ 正常（x86_64） | — |
| 內嵌 claude（Agent / claude-cli 分頁） | ❌ `bin/claude.exe` 不存在（E4，所有 mac/Linux 都一樣）。就算補上檔案，x64 包裡也只有 darwin-arm64 binary，Intel 無法執行（Rosetta 不能反向執行 arm64） | 只能切 system runtime，並在系統另裝 claude |
| 內嵌 codex | ❌ 只有 codex-darwin-arm64，`findBundledCodex` 找不到 | 只能用系統另裝的 codex |
| 終端 PTY | ⚠️ `pty.node` 是 arm64，無法載入 → 退回 child_process | 有（降級） |
| 語音輸入（whisper） | ❌ `dist/mac-x64/` 的內容其實是 arm64（上游 `@kutalia/whisper-node-addon@1.1.0` 打包缺陷，與 `mac-arm64` 位元相同） | 沒有 |
| better-sqlite3 / sharp | arm64，但桌面 runtime 不用 | 不受影響 |

**修正選項（只針對 x64 dmg 的架構問題）**

| # | 方案 | 做法 | 代價 / 風險 |
|---|---|---|---|
| B1 | **mac 拆成兩個 job，各用原生 runner** | x64 用 Intel runner 跑 `electron-builder --mac --x64`，arm64 用 `macos-latest` 跑 `--mac --arm64`。`npm ci` 與 `@electron/rebuild` 自然裝 / 建對應 arch 的子套件。workflow 要拆 matrix，artifact 名稱也要分開（`release-mac-x64` / `release-mac-arm64`），`release` job 的收集路徑跟著改 | mac CI 分鐘數約加倍；**要先查 GitHub 官方 runner 清單，確認還有哪個 Intel label 可用**（本單沒查到，不代為斷定）。仍是兩個 dmg，不違反 D057。whisper 仍然無解（上游問題） |
| B2 | **同一台 arm64 host 分兩次打包，中間替換子套件** | 先 `electron-builder --mac --arm64`；再 `npm install --no-save --os=darwin --cpu=x64` 安裝 claude-code / claude-agent-sdk / node-pty / codex / sharp 的 `-darwin-x64` 子套件（版本要跟 lock 對齊），移除 arm64 子套件，接著 `@electron/rebuild --arch x64`，最後 `--mac --x64` | 步驟多又脆弱：子套件清單得手動維護、lock 裡沒有的版本要另外對齊，每次相依變動都可能漏掉（跟 D057 拒絕 universal 的 whack-a-mole 同一類風險）。如果兩種 arch 共存不清掉，每個 dmg 會多出約 680 MB |
| B3 | **停止發 x64 dmg（宣告不支援 Intel Mac）** | `mac.target.arch` 只留 `arm64`，`verify-packaged-native.js --arch arm64`，release notes 寫明 | 失去 Intel Mac 使用者；不過 pre.2 的 x64 dmg 實際上內嵌 claude / codex / 語音都不能用，現況就已經接近不支援。改動最小，也最誠實 |
| B4 | universal | — | D057 已否決，不重提 |

**推薦：B1。** 前提是確認仍有可用的 Intel runner label；如果沒有，或塔台不想加倍 mac CI 成本，就改走 B3，**不建議 B2**。
- 理由：B1 是唯一讓 `npm ci` 與 install script 在正確 arch 上自然運作的做法，不需要維護子套件清單。
- B1 / B3 都要另外處理 whisper：可以向上游回報，或在 `darwin-x64` 上偵測到 arch 不符時，明確顯示「語音輸入不支援」，而不是載入失敗。

**`scripts/verify-packaged-native.js` 應該擴充（建議一律做，不論選哪個方案）**：
- T0470 版只檢查 whisper 檔案**存在**，所以 pre.2 的 x64 `.app`（whisper 是 arm64）照樣綠燈通過。這是 false green。
- 建議：
  - (a) 讀每個 `.app` 的 `Contents/MacOS/<exe>` cputype 作為基準
  - (b) 掃描 `app.asar.unpacked` 下所有 Mach-O，cputype 必須等於該 arch，或 fat binary 內含該 arch；允許清單只放刻意跨 arch 的目錄（例如 whisper `dist/mac-<另一個 arch>/`）。ELF / PE 不檢查
  - (c) BAT 解析出的內嵌 claude 路徑必須存在，而且 cputype 正確
- 照 pre.2 的現況，(b) 和 (c) 都會讓 CI fail，所以這項擴充要和修正**同一個工單落地**；也可以先以 warn 模式上線。
- 本單的 `macho_scan.py` 邏輯（magic `0xFEEDFACF` / `0xCAFEBABE` + cputype `0x01000007` / `0x0100000C`）可以直接移植。

**附帶發現（建議塔台另外開單，本單沒有改這些記錄）**

1. **🔴 新 BUG**：「非 Windows 打包版缺 `claude-code/bin/claude.exe`，內嵌 claude 無法使用」（E4）。
   - 影響 mac 兩種 arch 與 Linux AppImage，嚴重度建議 high。這可能是 pre.3 前最需要優先處理的項目。
   - 修正選項：
     - **A1（推薦）**：`resolveEmbeddedClaudePath` 在 `electron-packaged` 且非 win32 時，改指向 `@anthropic-ai/claude-code-<platform>-<arch>[-musl]/claude`（這個檔有打包進去）；保留 `bin/claude.exe` 作為 fallback，並加上 existsSync 檢查與單元測試
     - **A2**：設 `build.onNodeModuleFile` hook，強制保留 `bin/claude.exe`。但 electron-builder 複製時會把 hardlink 變成實體檔，每個包多約 230 MB
     - **A3**：afterPack 時建立 symlink
   - A1 改動小、不增加體積，再加上 B1 就能同時修好 Intel Mac。
   - T0472 的 `verify-native-modules.js` 只檢查打包前 host 上的 `node_modules`，所以抓不到這個問題，需要靠上面擴充的 (c) 守住。
2. **上游缺陷**：`@kutalia/whisper-node-addon@1.1.0` 的 `dist/mac-x64/` 實際內容是 arm64。BUG-116 / T0470 當初假設「套件同時附 mac-x64 / mac-arm64」，前提不成立。建議記在 BUG-117 或另開 EXP，評估向上游回報或自行建 x64 版。

### 回報時間

- 開始：2026-10-13T16:47:40+08:00
- 完成：見 frontmatter `completed_at`
