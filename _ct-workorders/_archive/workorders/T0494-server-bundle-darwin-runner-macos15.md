---
schema_version: 1
schema_kind: workorder
id: T0494
title: "server-bundle darwin-arm64 runner macos-14 → macos-15（macos-14 淘汰 brownout，pre.5 CI 會失敗）+ 確認 darwin server bundle 最低 macOS 不提高 + verify-packaged-native 過時註解"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P1
sizing: S
created_at: "2026-10-13T23:23:17+08:00"
started_at: "2026-10-13T23:24:18+08:00"
updated_at: "2026-10-13T23:27:52+08:00"
completed_at: "2026-10-13T23:27:52+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - T0487
related:
  - "T0487 回報區「範圍外發現」1：runner-images#13518，macos-14 於 2026-11-02 停止支援；brownout UTC 10/16、10/19、10/23、10/26、10/29、10/30 14:00–24:00（台北 22:00–隔日 08:00），期間 job 一律失敗"
  - "T0487 回報區「範圍外發現」3：`scripts/verify-packaged-native.js:46` 註解仍寫 ubuntu-latest"
  - "CLAUDE.md「Server bundle baseline（PLAN-031）」per-host matrix（Mac × arm64 → linux-x64 + darwin-arm64）"
affects_files:
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - .github/workflows/build-server-bundle.yml
  - scripts/verify-packaged-native.js
  - scripts/build-server-bundle.mjs
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改 server-bundle darwin-arm64 的 `runs_on` 與（必要時）deployment target 相關設定；其他 job / step 不動。`ubuntu-22.04` / `ubuntu-22.04-arm` 不動（淘汰在 2027，另案）"
  - "🔴 若查證發現換 macos-15 會讓 darwin-arm64 server bundle 的原生模組最低 macOS 提高（例如 node-pty / Node 24 binary 的 `LC_BUILD_VERSION` minos 變高），不得默默接受：設定 `MACOSX_DEPLOYMENT_TARGET` 等維持原基線，或回報 PARTIAL 交塔台"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；T0492 之後也會改 workflows，本單須先完成"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況（`pre-release.yml` 工作樹為 CRLF）"
---

# T0494 — server-bundle darwin-arm64 改用 macos-15

## 背景

`pre-release.yml:71`、`release.yml:36`、`build-server-bundle.yml:28` 的 server-bundle matrix（darwin-arm64）用 `runs_on: macos-14`。macos-14 已進入淘汰期，brownout 時段 dispatch 的 pre.5 會在這個 job 失敗，`release` job 不會跑。

## 實作

1. 三個 workflow 的 darwin-arm64 server-bundle `runs_on` 改為 `macos-15`（以 runner-images 公告確認 `macos-15` 為 arm64、無近期淘汰排程；若建議其他標籤須附證據）
2. 查證最低 macOS：
   - 以既有 release `server-bundle-v0.6.0-pre.4` 的 darwin-arm64 tarball（唯讀下載到 scratchpad 新空目錄，不執行其中程式）讀出原生 binary（node、node-pty `.node`、其他 `.node`）的 `LC_BUILD_VERSION` / `LC_VERSION_MIN_MACOSX` minos，作為現行基線
   - 判斷 macos-15 runner 上建置是否會改變 minos（Node 官方 binary 是下載的、不受 runner 影響；需要編譯的原生模組受 SDK / `MACOSX_DEPLOYMENT_TARGET` 影響）
   - 必要時在 workflow 或 `build-server-bundle.mjs` 設定 `MACOSX_DEPLOYMENT_TARGET` 維持基線（附理由）
3. `scripts/verify-packaged-native.js:46` 註解改為 `ubuntu-24.04`
4. 驗證：js-yaml 解析三檔；`go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7`（T0487 已驗證可用）0 筆；讀 workflow 的既有單元測試（`scripts/__tests__/verify-packaged-native.test.mjs` 等）通過

## 驗收條件

- [ ] 三檔無 `macos-14`；YAML 可解析；actionlint 0 筆
- [ ] 現行基線 minos 表 + macos-15 影響判斷（附證據）；如有設定 deployment target，說明位置
- [ ] 回報區：CLAUDE.md 建議文字（server bundle runner / 最低 macOS）；`git diff --stat`
- [ ] 實跑驗證留待 pre.5 CI（塔台觀察）

## Sub-session 執行指示

1. 讀本工單 + D139 + T0487 回報區 + 三個 workflow 的 server-bundle job + `scripts/build-server-bundle.mjs`
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。三個 workflow 的 server-bundle darwin-arm64 `runs_on` 由 `macos-14` 改為 `macos-15`；`scripts/verify-packaged-native.js:46` 註解改為 `ubuntu-24.04`。查證後確認：換成 macos-15 **不會**改變 darwin-arm64 server bundle 的最低 macOS，因此**沒有**設定 `MACOSX_DEPLOYMENT_TARGET`（理由見下）。`build-server-bundle.mjs` 未改。

### Landing check

| 檢查 | 結果 | 說明 |
|---|---|---|
| C-0 | PASS | frontmatter `repo: better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`） |
| C-1 | PASS | 工單位於 `REPO_ROOT/_ct-workorders/` |
| C-3 | PASS（參考用） | 5 個 `affects_files` 都存在 |
| C-2 | 不適用 | 工單沒有 `branch` 欄位（目前分支為 `main`） |

`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 1. runner 標籤查證（`macos-15`）

- [runner-images README](https://github.com/actions/runner-images)（以 `gh api` 讀取）：`macOS 15 Arm64` 的標籤為 `macos-15` 或 `macos-15-xlarge`，arm64。表內只有 macOS 14 / 14 Arm64 標示 deprecated（連到 #13518）。
- [#13518](https://github.com/actions/runner-images/issues/13518)（OPEN）：「Workflows using the `macos-14` image label should be updated to `macos-latest`, `macos-15`, or `macos-26`.」退役日 2026-11-02。
- 以 `gh issue list -R actions/runner-images --state open --search "macOS 15 deprecation in:title"` 查詢：**0 筆**。Announcement 標籤下開啟中的 macOS issue 也沒有 macOS 15 淘汰公告。
- 目前映像：`macos-15-arm64` 為 macOS 15.7.9、image `20260907.0337.1`，預設 Xcode 16.4。舊的 `macos-14-arm64` 為 macOS 14.8.9、image `20260831.0302.1`。
- 不選 `macos-latest`：它目前指向 macOS 26，之後也會隨 GitHub 遷移而改變，跟 T0487 釘死 runner 版本的方向不一致。不選 `macos-26`：工單指定 macos-15，而且 15 沒有淘汰排程，沒有理由跳兩個大版本。

### 2. 最低 macOS 查證

**現行基線**：唯讀下載 `server-bundle-v0.6.0-pre.4` 的 `bat-server-darwin-arm64-v0.6.0-pre.4.tar.gz` 到 scratchpad 的新空目錄。sha256 `dd99265f…a3ad2bd` 與 release 上的 `.sha256` 相符。解壓到另一個目錄後，用自寫的 Node 腳本（放在第三個目錄，只讀 Mach-O 檔頭，不執行 bundle 內任何程式）掃描 `staging/` 內所有 Mach-O：

| binary | 來源 | cmd | minos | sdk |
|---|---|---|---|---|
| `bin/node`（24.21.0） | nodejs.org 官方 tarball（`build-server-bundle.mjs` 下載） | `LC_BUILD_VERSION` | **13.5.0** | 15.0.0 |
| `@anthropic-ai/claude-code-darwin-arm64/claude` | npm prebuilt | `LC_BUILD_VERSION` | 13.0.0 | 26.5.0 |
| `@anthropic-ai/claude-agent-sdk-darwin-arm64/claude` | npm prebuilt | `LC_BUILD_VERSION` | 13.0.0 | 14.5.0 |
| `@lydell/node-pty-darwin-arm64/pty.node` | npm prebuilt（套件沒有 install script） | `LC_BUILD_VERSION` | 11.0.0 | 14.5.0 |
| `@lydell/node-pty-darwin-arm64/spawn-helper` | 同上 | `LC_BUILD_VERSION` | 11.0.0 | 14.5.0 |
| `@img/sharp-darwin-arm64/lib/sharp-darwin-arm64.node` | npm prebuilt | `LC_BUILD_VERSION` | 11.0.0 | 15.5.0 |
| `@img/sharp-libvips-darwin-arm64/lib/libvips-cpp.8.17.3.dylib` | npm prebuilt | `LC_BUILD_VERSION` | 11.0.0 | 15.5.0 |
| `better-sqlite3/build/Release/better_sqlite3.node`（12.9.0） | **上游 prebuilt**（見下） | `LC_BUILD_VERSION` | 11.0.0 | 15.5.0 |

全部都是 arm64 thin binary，沒有 `LC_VERSION_MIN_MACOSX`。**bundle 實際的最低 macOS 是 13.5**，由 `bin/node` 決定（Node 24 官方支援的最低版本）。

**macos-15 對各 binary 的影響**：

- `bin/node`：從 nodejs.org 下載，跟 runner 無關。
- node-pty、sharp / libvips、claude-code、claude-agent-sdk：都是 npm 上的 prebuilt 平台套件，由 `npm ci` 原封不動複製，跟 runner 無關。
- better-sqlite3：唯一可能在 runner 上編譯的套件（install script 為 `prebuild-install || node-gyp rebuild --release`）。pre.4 的 `.node` 與 `WiseLibs/better-sqlite3` release `v12.9.0` 的 `better-sqlite3-v12.9.0-node-v137-darwin-arm64.tar.gz` 內的檔案 **sha256 完全相同**（`b3b473ef…04dc81`），可見 CI 走的是 prebuild-install 下載，沒有在 runner 上編譯。另一個佐證：它的 sdk 為 15.5，而 macos-14 預設的 Xcode 15.4 SDK 是 14.5。
- fallback 情況（prebuild 下載失敗而改用 node-gyp 編譯）：addon 的 deployment target 由 Node headers 的 `common.gypi` 指定，`'MACOSX_DEPLOYMENT_TARGET': '13.5'`（本機 node-gyp cache 24.16.0 `include/node/common.gypi:654`），會轉成 `-mmacosx-version-min=13.5` 編譯參數，不受 runner 的 SDK 或環境變數影響。結果最多是 13.5，等於現在的實際下限，不會更高。

**結論**：換成 macos-15 不會提高最低 macOS（維持 13.5）。不需要設定 `MACOSX_DEPLOYMENT_TARGET`；就算設成環境變數，也會被 gyp 的 xcode_settings 蓋掉，沒有效果。

### 3. 變更檔案

```
 .github/workflows/build-server-bundle.yml          |   2 +-
 .github/workflows/pre-release.yml                  |   2 +-
 .github/workflows/release.yml                      |   2 +-
 scripts/verify-packaged-native.js                  |   2 +-
 _ct-workorders/T0494-server-bundle-darwin-runner-macos15.md（本工單）
```

`git diff -U0` 的產品變更只有 4 行：三處 `runs_on: macos-14` → `macos-15`（`pre-release.yml:71`、`release.yml:36`、`build-server-bundle.yml:28`），以及 `verify-packaged-native.js:46` 的 `ubuntu-latest` → `ubuntu-24.04`。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| 三檔無 `macos-14` | **PASS** | `grep -rn macos-14 .github/workflows/` 0 筆 |
| YAML 可解析（js-yaml） | **PASS** | `build-server-bundle.yml OK jobs=build,manifest,release darwin=macos-15`、`pre-release.yml OK jobs=prepare,server-bundle,server-bundle-manifest,build,release darwin=macos-15`、`release.yml OK jobs=prepare,server-bundle,server-bundle-manifest,build,release,choco darwin=macos-15` |
| actionlint | **PASS** | `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7 -oneline .github/workflows/*.yml`：0 筆、exit 0。反向對照：scratchpad 內的錯誤 workflow 回報 2 筆、exit 1，確認 actionlint 真的有在檢查。註：`runs-on: ${{ matrix.runs_on }}` 是 expression，actionlint 不會檢查 matrix 值的 label，不過 `macos-15` 在它的已知標籤清單內。本機沒有 shellcheck，`run:` 腳本的 shellcheck 檢查沒有執行（與 T0487 相同） |
| 單元測試 | **PASS** | `npx vitest run scripts/__tests__/verify-packaged-native.test.mjs scripts/__tests__/server-bundle-helpers.test.mjs scripts/__tests__/dev-deploy-headless.test.mjs electron/__tests__/claude-runtime-router.test.ts`：4 files、169 passed |
| 換行 | **PASS** | `pre-release.yml` CRLF 304/304 行；`build-server-bundle.yml`（168 行）、`release.yml`（369 行）維持 LF；`verify-packaged-native.js` 只改註解內的文字 |
| `npx vite build` / tsc | 不適用 | 只改 workflow 與一行 JS 註解；工作樹內另有其他 Worker 未提交的 WIP，跑 build 也驗證不到本單 |
| 實跑 CI | 留待 pre.5（塔台觀察） | 依工單：不 push、不觸發 workflow。觀察重點：`server-bundle (darwin-arm64)` 在 macos-15 上 `npm ci` 成功、`verify-server-bundle.js` 通過，產物 tarball 內 `better_sqlite3.node` 仍為上游 prebuilt（可以用本單的 minos 掃描方式複查） |

### CLAUDE.md 建議文字（交 T0493 套用）

加在「Server bundle baseline（PLAN-031）」per-host matrix 之後：

```markdown
- **server bundle runner 與最低 OS**（T0494）：server-bundle matrix 為 `linux-x64` → `ubuntu-22.04`、`linux-arm64` → `ubuntu-22.04-arm`（glibc 2.35 基線，runner 2027-04-17 退役，runner-images#14254）、`darwin-arm64` → `macos-15`（原 `macos-14`，2026-11-02 退役，runner-images#13518）。darwin-arm64 bundle 最低 **macOS 13.5**，由 nodejs.org 的 Node 24 `bin/node` 決定（`LC_BUILD_VERSION` minos 13.5）；node-pty / sharp / claude-code / claude-agent-sdk 為 npm prebuilt（minos 11.0 / 13.0），better-sqlite3 走 `prebuild-install` 下載上游 prebuilt（minos 11.0）。換 macOS runner **不影響**最低 macOS；fallback 到 node-gyp 編譯時，Node headers `common.gypi` 固定 `-mmacosx-version-min=13.5`，`MACOSX_DEPLOYMENT_TARGET` 環境變數不生效。
```

### 範圍外發現（交塔台決定，本單未改）

1. **darwin tarball 內有一個指向 runner 絕對路徑的 symlink**：`staging/node_modules/sharp/node_modules/.bin/semver` → `/Users/runner/work/better-agent-terminal/better-agent-terminal/node_modules/sharp/node_modules/semver/bin/semver.js`。解壓到其他機器後這個 link 會失效。它只在 `.bin/` 底下，runtime 不會用到，影響應該很小；但它表示 `copyRecursive` 會照原樣複製絕對 symlink。可以考慮在 `build-server-bundle.mjs` 排除 `node_modules/**/.bin/`，或改寫成相對 symlink。linux tarball 很可能有同樣情況（未查）。
2. **bundle README 的 darwin runtime 行**：`build-server-bundle.mjs:91` `readmeRuntimeLine: '- glibc lower bound: n/a (darwin)'`，可以改為 `- macOS lower bound: 13.5 (arm64)`，把下限寫明。本單範圍只授權在必要時改 deployment target，所以沒有改。
3. T0492 如果移除 better-sqlite3，bundle 內唯一可能在 runner 上編譯的套件就不存在了，上面的 fallback 分析也不再適用。

### Commit

`git commit --only` 本單 5 個檔案（3 個 workflow、`scripts/verify-packaged-native.js`、本工單）。沒有 push。工作樹中其他 Worker 的 WIP（T0485 / T0488 / T0489 等）沒有 stage。commit hash 以 `git log --grep T0494` 查。

### 偏差 / 互動

- 沒有使用者互動（`CT_INTERACTIVE=0`）。
- 工單 frontmatter 原狀態為 `TODO`（不是 `PENDING`），照常改為 `IN_PROGRESS` → `DONE`（與 T0487 相同）。
- 解壓 tarball 時，上述 symlink 在 Windows 上建立失敗（tar exit 2）。其他檔案都有解出，不影響 minos 掃描。
