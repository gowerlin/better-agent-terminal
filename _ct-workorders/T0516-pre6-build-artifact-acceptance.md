---
schema_version: 1
schema_kind: workorder
id: T0516
title: "pre.6 建置產物自動化驗收：BUG-115（release.ps1 -Snapshot）、BUG-118 Linux AppImage 內嵌 claude、BUG-117 / 116 產物層檢查"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-verify-pre6
priority: P2
sizing: M
created_at: "2026-10-14T03:42:23+0800"
started_at: "2026-10-14T03:44:14+08:00"
updated_at: "2026-10-14T03:51:26+08:00"
completed_at: "2026-10-14T03:51:26+08:00"
target_version: "0.6.0-pre.6（驗收，不發版）"
related:
  - "T0488（BUG-115 修正）、T0475 / T0470（BUG-118 / 117，`scripts/verify-packaged-native.js`）、T0468（BUG-116）"
  - "D136（mac 只打 arm64 dmg）"
  - "並行：T0514（UI 線）、T0515（精靈線）"
affects_files:
  - _ct-workorders/T0516-pre6-build-artifact-acceptance.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不改產品程式碼、不改 `scripts/**` / `package.json` / workflow**。發現缺陷 → 回報區記證據，該項 FAIL、整單 PARTIAL，不自行修。BUG 檔與 `_bug-tracker.md` 不動。"
  - "🔴 **不發版、不 push、不建 tag、不呼叫 `gh release` / `gh workflow run` 等寫入操作**；`gh` 只做唯讀下載且一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 **BUG-115 建置要隔離**：T0514 / T0515 正在並行（它們用已安裝 exe，不用 repo 的 build 產物），但不要在主 repo 的 `dist*/` / `release/` 產生會留下的變更。建議 `git worktree add <scratchpad>/t0516-wt HEAD` 後在 worktree 內 `npm ci` + `release.ps1 -Snapshot`；結束後移除 worktree。若 worktree 方案不可行，回報區說明後在主 repo 執行，並確認結束後 `git status` 無新增追蹤變更。"
  - "🔴 **不碰使用者正在用的 BAT**；不安裝 / 解除安裝任何 BAT 安裝檔（只解壓或唯讀檢查）。"
  - "🔴 **WSL**：只在 `<scratch>` / WSL `/tmp/bat-t0516-*` 下解壓與執行；不動 `~/.local/bat-server`；不得 `wsl --shutdown` / `--terminate`。執行內嵌 claude 只跑 `--version`（不消耗 token）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF。"
---

# T0516 — pre.6 建置產物自動化驗收

## 背景

使用者要求把「已修復待實機驗收」的 BUG 盡量自動化（2026-10-14 第六十 session）。本單是三條並行線之一：**建置流程與發佈產物**，不需要 GUI。

## 驗收項目

| # | BUG | 驗收重點 |
|---|---|---|
| B1 | BUG-115 | `.vscode/scripts/release.ps1 -Snapshot`（本機 snapshot 打包）可跑完：`fetch:baseline` 取基底版號 `0.6.0-pre.6`（不 404），產出安裝檔；附 log 關鍵行（解析出的 baseline 版號、產物路徑與大小） |
| B2 | BUG-118（Linux） | 從 `v0.6.0-pre.6` release 唯讀下載 Linux AppImage，在 WSL `/tmp/bat-t0516-*` 以 `--appimage-extract` 解開，確認 `resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-linux-x64/claude`（或 fallback `claude-code/bin/claude.exe`）存在、為 ELF x86-64，執行 `--version` = `2.1.296 (Claude Code)` |
| B3 | BUG-118 / 117（mac 產物層） | 下載 pre.6 arm64 dmg，以可用工具（如 7-Zip）唯讀解開，檢查：內嵌 claude 依 `embeddedClaudeCandidates` 規則存在、Mach-O cputype = arm64；確認 release 不含 x64 dmg（D136）。無法在 Windows 解開 dmg 時，改以 `pre-release.yml` 該 run（`38450958394`）的 `verify-packaged-native` job log 為證據，並標「mac 實機啟動需 Gary」 |
| B4 | BUG-116（產物層） | 同上 dmg：`@kutalia/whisper-node-addon/dist/{mac,darwin}-arm64/whisper.node` 存在。實際啟動不崩潰 → NEEDS-HUMAN（Gary） |

每項標 PASS / FAIL / NEEDS-HUMAN，附證據。

## 驗收條件

- [ ] B1-B4 各有結論與證據
- [ ] 主 repo `git status` 無新增追蹤變更（worktree 已移除）；未發版、未寫入 GitHub

## Sub-session 執行指示

1. 讀本工單、BUG-115 / 116 / 117 / 118 檔
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 執行 → 填回報區（DONE / PARTIAL）
4. commit 本單檔案（精準 `git add`）；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要：DONE（B1 / B2 PASS；B3 / B4 產物層 PASS，mac 實機啟動 NEEDS-HUMAN：Gary）

| # | BUG | 結論 | 一句話 |
|---|---|---|---|
| B1 | BUG-115 | ✅ PASS | 隔離 worktree `release.ps1 -Snapshot` exit 0；兩次 `fetch:baseline` 皆解析為 `v0.6.0-pre.6`（首次下載、第二次 cache hit），無 404；產出 Setup exe / zip / nupkg |
| B2 | BUG-118（Linux） | ✅ PASS | pre.6 AppImage 在 WSL `/tmp/bat-t0516-*` 解開：`claude-code-linux-x64/claude` 存在、ELF x86-64，`--version` = `2.1.296 (Claude Code)` |
| B3 | BUG-118 / 117（mac 產物層） | ✅ PASS（產物層）／🧑 NEEDS-HUMAN（mac 實機啟動，Gary） | arm64 dmg 以 7-Zip 解開：`claude-code-darwin-arm64/claude` Mach-O cputype `0x100000c`（arm64）；主程式 arm64；release 無 x64 dmg（D136） |
| B4 | BUG-116（產物層） | ✅ PASS（產物層）／🧑 NEEDS-HUMAN（實際啟動不崩潰，Gary） | `whisper-node-addon/dist/mac-arm64/whisper.node` 存在，Mach-O arm64（filetype 6 = bundle） |

### Landing Zone Check：PASS

- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 條目 → not applicable
- C-2：工單無 `branch` 欄位；HEAD = `main`
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### B1 — BUG-115：`release.ps1 -Snapshot`（✅ PASS）

- 環境：Windows 11、Node `v24.21.0`、npm `12.2.0`、pwsh 7（`-NoProfile -NonInteractive`）
- 隔離：`git worktree add --detach <scratchpad>/t0516-wt HEAD`（HEAD = `913e1d3`）→ `npm ci`（exit 0；只有預期的 `electron-winstaller` allowScripts 警告）→ `release.ps1 -Snapshot`
- **第 1 次執行 exit 1，原因是環境，不是 BUG-115**：fetch 段已正確（`snapshot version 0.6.0-pre.6.local.261014034450 … → baseline v0.6.0-pre.6`，下載 + 驗證 OK，第二次 cache hit），之後在 NSIS 階段失敗：
  ```
  !include: could not open file: "C:\Users\Gower\AppData\Local\Temp\claude\D--…\scratchpad\t0516-wt\node_modules\app-builder-lib\templates\nsis\include\allowOnlyOneInstallerInstance.nsh"
  Error in script "<stdin>" on line 88 -- aborting creation process
  ```
  該檔確實存在，但完整路徑 **264 字元，超過 MAX_PATH 260**，`makensis.exe` 無法開啟。scratchpad 路徑過長導致，與產品無關。
- **處置（偏離建議路徑，已記錄）**：`git worktree move` 到較短路徑 `C:\Users\Gower\AppData\Local\Temp\t0516-wt`（同磁碟只是 rename，保留 `node_modules`），刪掉自己產生的 `release/` 與 `dist-baseline/`（讓 fetch 重新從網路下載，確保「不 404」的證據完整），然後重跑
- **第 2 次執行（`2026-10-14T03:47:34+0800` → `03:49:25+0800`，`RELEASE_EXIT=0`）關鍵行**：
  ```
  [fetch-baseline] snapshot version 0.6.0-pre.6.local.261014034735 (from BAT_BASELINE_VERSION) → baseline v0.6.0-pre.6
  [fetch-baseline] downloading https://github.com/gowerlin/better-agent-terminal/releases/download/server-bundle-v0.6.0-pre.6/bat-server-linux-x64-v0.6.0-pre.6.tar.gz
  [fetch-baseline] verified + wrote bat-server-linux-x64-v0.6.0-pre.6.tar.gz
  [fetch-baseline] OK — host=win×x64, 1 tarball(s) ready in dist-baseline/
  …（npm run build 的 prebuild 第二次 fetch）
  [fetch-baseline] snapshot version 0.6.0-pre.6.local.261014034735 (from BAT_BASELINE_VERSION) → baseline v0.6.0-pre.6
  [fetch-baseline] cache hit: bat-server-linux-x64-v0.6.0-pre.6.tar.gz (sha matches local sidecar)
  [verify-native-modules] ✅ All 2 required native modules present, … embedded claude: native
  package.json version restored
  Successfully created package '…\release\better-agent-terminal.0.6.0-pre.6.local.261014034735.nupkg'
  ```
- 產物（`release/`）：

  | 檔案 | bytes | SHA-256 |
  |---|---|---|
  | `BetterAgentTerminal Setup 0.6.0-pre.6.local.261014034735.exe` | 715,685,380（682.5 MB） | `43f0c6b5b923d3f1b502e5a0497f044306a2fa9793159be900fdb2e7b7747565` |
  | `BetterAgentTerminal-0.6.0-pre.6.local.261014034735-win.zip` | 896,631,063（855.1 MB） | `e477c7d35ce9f221f8e9204507f3cd50282d74ac6d3d8944987064b8c6bfe33e` |
  | `better-agent-terminal.0.6.0-pre.6.local.261014034735.nupkg` | 3,381 | — |

- 結束後 worktree 內 `git status --porcelain` 為空（package.json 已還原）；產物沒有安裝，已隨 worktree 刪除

### B2 — BUG-118 Linux AppImage（✅ PASS）

- 唯讀下載：`gh release download v0.6.0-pre.6 -R gowerlin/better-agent-terminal -p 'BetterAgentTerminal-0.6.0-pre.6.AppImage'`，1,066,247,799 bytes（與 release asset 大小相同），sha256 `cc7f54a2aee4ead46e3340410d65e197376bca448e6301b1166bd89b19f52a5f`
- WSL `Ubuntu-24.04`，`/tmp/bat-t0516-6gQqNS`：`./bat.AppImage --appimage-extract` exit 0
- 依 `embeddedClaudeCandidates`（`electron/claude-runtime-router.ts:191-210`；electron-packaged、linux、glibc）：
  - 候選 1 `resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-linux-x64/claude`：**PRESENT**，257,068,216 bytes，`ELF 64-bit LSB executable, x86-64, … interpreter /lib64/ld-linux-x86-64.so.2`
  - 候選 2（fallback）`claude-code/bin/claude.exe`：ABSENT（預期，electron-builder 在非 Windows 目標排除 `.exe`）
  - `--version` → `2.1.296 (Claude Code)`（exit 0）；子套件 `package.json` `"version": "2.1.296"`
- 對照 CI：run `38450958394` 的 job `build (ubuntu-24.04, linux)` 步驟 `Verify packaged embedded claude (Linux x64)` 回報 `✅ linux x64: embedded claude …/claude-code-linux-x64/claude (ELF e_machine 0x3e)`
- Linux 桌面 GUI 實際啟動 Agent session 不在本單範圍（只跑 `--version`，不消耗 token）

### B3 — BUG-118 / 117 mac 產物層（✅ PASS 產物層；🧑 NEEDS-HUMAN 實機）

- release `v0.6.0-pre.6` 的 asset 清單（target `79b1275`）：`-arm64.dmg`（900,442,001）、`-win.zip`、`.AppImage`、`Setup .exe`，**沒有 x64 dmg**（符合 D136）
- 唯讀下載 arm64 dmg（大小與 asset 相同）→ 7-Zip 26.04 列出 786 個條目，並解出 4 個目標檔（未掛載、未安裝）
- `.app/Contents/MacOS/BetterAgentTerminal`：Mach-O 64，cputype `0x100000c`（arm64），filetype 2（基準）
- 內嵌 claude（electron-packaged、darwin，候選 1）`Contents/Resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-darwin-arm64/claude`：**存在**，240,664,752 bytes，cputype `0x100000c`（arm64）；`file` = `Mach-O 64-bit arm64 executable`；子套件版號 `2.1.296`
- fallback `claude-code/bin/claude.exe`：dmg 內沒有（`claude-code/` 只有 `cli-wrapper.cjs` / `install.cjs` / `LICENSE.md` / `package.json`），符合預期；router 取候選 1
- dmg 清單中沒有任何 `darwin-x64` 子套件
- 對照 CI：run `38450958394` 的 job `build (macos-latest, mac)` 步驟 `Verify packaged native binaries (macOS arm64)`：`✅ arm64: BetterAgentTerminal.app — main arm64, 52 Mach-O under app.asar.unpacked, embedded claude …/claude-code-darwin-arm64/claude, whisper …/dist/mac-arm64/whisper.node` / `✅ every mac .app passed (arm64)`
- 🧑 **NEEDS-HUMAN（Gary）**：在 Apple Silicon 實機安裝後，以預設 embedded runtime 開 Agent session 或 claude-cli 分頁能正常啟動

### B4 — BUG-116 產物層（✅ PASS 產物層；🧑 NEEDS-HUMAN 實機）

- 同一個 dmg：`@kutalia/whisper-node-addon/dist/mac-arm64/` 包含 `whisper.node`、`libwhisper*.dylib`、`libggml*.dylib`；`dist/mac-x64/` 也在（套件本身附帶，`isCrossArchAllowed` 允許清單內）；沒有 `darwin-arm64/`（loader 以 `mac-<arch>` 優先，`darwin-<arch>` 只是 fallback，`electron/whisper-addon-loader.ts:56`）
- `dist/mac-arm64/whisper.node`：673,104 bytes，Mach-O 64，cputype `0x100000c`（arm64），filetype 6（MH_BUNDLE）
- 🧑 **NEEDS-HUMAN（Gary）**：mac 實機啟動不跳 `A JavaScript error occurred in the main process`，語音輸入可用（或至少停用而不崩潰）

### 變更檔案

- `_ct-workorders/T0516-pre6-build-artifact-acceptance.md`（只有本單）
- 未改產品程式碼、`scripts/**`、`package.json`、workflow、BUG 檔、`_bug-tracker.md`

### 隔離與清理證據

- worktree：`git worktree remove --force C:/Users/Gower/AppData/Local/Temp/t0516-wt` exit 0；`git worktree list` 只剩主 repo
- WSL：`/tmp/bat-t0516-6gQqNS` 已刪（`ls -d /tmp/bat-t0516-*` 找不到）；沒有動 `~/.local/bat-server`，沒有執行 `wsl --shutdown` / `--terminate`
- 下載的 AppImage / dmg 與解出的檔案已從 scratchpad 刪除；只保留 log（`t0516-b1*.log`、`t0516-b2.log`、`t0516-ci-{mac,linux}.log`、`t0516-dmg-list.txt`）
- 主 repo `git status`：沒有 `dist*/` / `release/` 或其他由本單產生的追蹤變更。其餘 dirty 項目（`src/styles/settings.css`、T0514 / T0515 工單、`e2e/real-remote/t0514-*` / `t0515-*`）屬使用者或並行工單，未碰觸
- GitHub 只做唯讀操作（`gh release view` / `gh release download` / `gh run view --log`，一律帶 `-R gowerlin/better-agent-terminal`）；沒有發版、沒有 push、沒有建 tag、沒有 `gh workflow run`；沒有安裝或解除安裝任何 BAT

### 偏離 / 觀察

- **建議路徑偏離**：工單建議 worktree 放在 `<scratchpad>/t0516-wt`。實測 NSIS（32-bit `makensis.exe`）在該路徑超過 MAX_PATH，改放 `%TEMP%\t0516-wt`。這是 Windows 本機打包的環境限制，不是 BUG-115 回歸；T0488 當時可能用了較短的路徑。之後若有工單要在 Windows 隔離打包，建議 worktree 路徑控制在約 ≤ 100 字元以內（`node_modules\app-builder-lib\templates\nsis\include\allowOnlyOneInstallerInstance.nsh` 本身約 90 字元）。是否寫進規則由塔台決定，本單不修改

### Commit

- 只 commit 本單檔案（精準 `git add`），不 push

### 驗收條件

- [x] B1-B4 各有結論與證據
- [x] 主 repo `git status` 無新增追蹤變更（worktree 已移除）；未發版、未寫入 GitHub

