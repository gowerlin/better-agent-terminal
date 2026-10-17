---
schema_version: 1
schema_kind: workorder
id: T0476
title: "release.yml 下游發佈（Homebrew tap / Chocolatey）改 opt-in 預設關閉 + README 移除上游套件安裝方式 + verify-native-modules DESKTOP_PACKAGE_HOSTS 移除 darwin-x64"
type: implementation
status: DONE
repo: better-agent-terminal
project: D137
priority: P2
sizing: S
created_at: "2026-10-13T19:03:37+08:00"
started_at: "2026-10-13T19:18:52+08:00"
updated_at: "2026-10-13T19:23:04+08:00"
completed_at: "2026-10-13T19:23:04+08:00"
target_version: v0.6.0-pre.4
depends_on:
  - T0475
related:
  - "D137（本單範圍與做法）；D136（mac 只打 arm64）"
  - "T0475 回報區 Homebrew 段（dispatch 指向上游 tonyq-org/homebrew-tap）"
  - "CLAUDE.md「Release」→「prerelease 標記與下游發佈」表；_local-rules.md「Release 流程實況」"
affects_files:
  - .github/workflows/release.yml
  - scripts/verify-native-modules.js
  - scripts/__tests__/verify-native-modules.test.mjs
  - README.md
  - CLAUDE.md
  - docs/plan-007-release-checklist.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag；不設定 / 不讀取 repo variables 或 secrets（`gh variable` / `gh secret` 一律不用）"
  - "🔴 `pre-release.yml` 不改（它沒有 Homebrew / Chocolatey step）；`package.json` / `package-lock.json` 不動"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；寫檔維持 LF；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）"
---

# T0476 — fork 下游發佈 opt-in + 移除 darwin-x64 desktop host

## 背景

- `release.yml` `Update Homebrew tap` step（正式版 tag、不含 `-pre`）寫死 `repository: tonyq-org/homebrew-tap`：本 fork 發正式版時會把 v0.x 版號送進上游 tap（`TAP_GITHUB_TOKEN` 有設即真的寫入）
- `choco` job 的日期 gate（`20260410`）已過期 → 正式版會 `choco push` package id `better-agent-terminal`（chocolatey.org owner 為上游 tonyq），installer 檔名 `BetterAgentTerminal.Setup.<v>.exe` 亦需核對與本 fork 產物是否相符
- README「快速開始」方式一（`brew install tonyq-org/tap/...`）/ 方式二（`choco install better-agent-terminal`）裝到的是上游版本線
- D136 後 mac 只打 arm64，`scripts/verify-native-modules.js:44` `DESKTOP_PACKAGE_HOSTS` 仍含 `darwin-x64`

## A. `release.yml` 下游發佈改 opt-in（D137）

1. `Update Homebrew tap`：`if` 加上 `vars.HOMEBREW_TAP_REPO != ''`（保留 `!contains(github.ref, '-pre')`），`repository: ${{ vars.HOMEBREW_TAP_REPO }}`；不再出現 `tonyq-org`。step 前加一行註解說明 opt-in 與所需 secret `TAP_GITHUB_TOKEN`
2. `choco` job：job-level `if` 加上 `vars.CHOCOLATEY_PUBLISH == 'true'`；移除過期日期 gate step 與後續各 step 的 `steps.gate.outputs.skip` 條件（行為等價簡化）。註解說明 opt-in 與所需 secret `CHOCO_API_KEY`
3. 不改其他 job / step；`server-bundle` release step 順序與條件不變
4. 驗證：以 YAML parser 確認檔案可解析（如 `node -e` + repo 既有 yaml 套件，或 `npx --yes yaml`；擇一可用者），並 `git diff` 確認只動上述範圍

## B. README（D137）

- 移除「方式一：Homebrew」「方式二：Chocolatey」，「方式三：直接下載」改為唯一方式（標題重新編號或去掉編號）；其他段落不動
- 若 README 其他處（英文段、badge 等）也引用上游 tap / choco，一併處理並在回報區列出

## C. `DESKTOP_PACKAGE_HOSTS` 移除 `darwin-x64`（D137）

- `scripts/verify-native-modules.js`：`DESKTOP_PACKAGE_HOSTS` 改為 `['win32-x64', 'linux-x64', 'darwin-arm64']`；確認 `darwin-x64` host 上 whisper / embedded runtime 缺失時只 warn、不 exit 1（既有非 desktop host 行為）
- 同步 `scripts/__tests__/verify-native-modules.test.mjs`（`:152` 斷言）；如有 darwin-x64 為 desktop host 的測試案例，改為斷言 warn-only
- 註解註明 D136 / D137

## D. 文件

- CLAUDE.md「Release」→「prerelease 標記與下游發佈」表：Homebrew / Chocolatey 兩列改述 opt-in（repo variable 名稱、預設跳過）；行號引用依新檔案更新；「Packaging / Release 前置檢查」中 desktop host 清單改為三個
- `docs/plan-007-release-checklist.md` Homebrew tap 檢查項改述為「僅在設定 `HOMEBREW_TAP_REPO` 時」
- `_ct-workorders/_local-rules.md` 為塔台檔，**不改**；若其內容需同步，在回報區列出建議文字

## 驗收條件

- [ ] `release.yml` 無 `tonyq-org`；Homebrew / choco 皆需 repo variable 才會執行；YAML 可解析
- [ ] README 無 `tonyq-org/tap`、無 `choco install`
- [ ] `node scripts/verify-native-modules.js` exit 0（本機 win32-x64）
- [ ] `npm run test:unit` 全綠（回報 files / passed / skipped 數）
- [ ] `npx vite build` exit 0
- [ ] 回報區附 `git diff --stat` 與 A 段 diff 摘要

## Sub-session 執行指示

1. 讀本工單 + D137 + `.github/workflows/release.yml`（Homebrew step 與 `choco` job）+ `scripts/verify-native-modules.js` + README「快速開始」
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。A / B / C / D 四段全部完成，驗收條件 6 項全綠。

### Landing Zone Check — PASS

- C-0：frontmatter `repo: better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：前 5 筆 `affects_files` 皆存在 → PASS（informational）
- C-2：工單無 `branch` 欄位；HEAD = `main`
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 工單開工時 `status` 為 `TODO`（非 `PENDING`），直接轉 `IN_PROGRESS`

### A. `release.yml` 下游發佈 opt-in

diff 摘要（`git diff .github/workflows/release.yml`，+9 / -21）：

- `Update Homebrew tap`（:298-308）：前加 3 行註解（D137 / T0476 opt-in、`HOMEBREW_TAP_REPO` 為 tap `owner/name`、需 secret `TAP_GITHUB_TOKEN`）；`if` 改為 `${{ !contains(github.ref, '-pre') && vars.HOMEBREW_TAP_REPO != '' }}`；`repository: ${{ vars.HOMEBREW_TAP_REPO }}`（原寫死 `tonyq-org/homebrew-tap`）
- `choco` job（:310-369）：前加 3 行註解（opt-in、需 secret `CHOCO_API_KEY`、package id owner）；job `if` 改為 `${{ !contains(github.ref, '-pre') && vars.CHOCOLATEY_PUBLISH == 'true' }}`；刪除 `Check if Chocolatey publish is enabled`（id `gate`，日期 `20260410`）step，並移除後續 6 個 step 的 `if: steps.gate.outputs.skip != 'true'`（gate 已過期恆為 `skip=false`，行為等價）
- 其他 job / step 未動；`Create server bundle release` 位置與條件不變，仍在 Homebrew 前（其註解「before the Homebrew dispatch so a tap failure cannot skip it」仍成立，未改）
- 檔內 `tonyq` 出現次數：0
- YAML 解析：`node -e` + repo 既有 `js-yaml` 載入成功；jobs = `prepare,server-bundle,server-bundle-manifest,build,release,choco`；`release` steps 末三個依序為 `Create Release | Create server bundle release | Update Homebrew tap`；`choco` steps = `Checkout code | Download Windows artifact | Extract version from tag | Find installer and compute checksum | Prepare Chocolatey package | Pack and push`（皆無 step-level `if`）
- 未設定的 `vars.*` 在 GitHub expression 中為空字串 ⇒ 兩者預設跳過

installer 檔名核對（背景段要求）：`choco/tools/chocolateyinstall.ps1` 的 `url64bit` 為 `https://github.com/gowerlin/better-agent-terminal/releases/download/v<v>/BetterAgentTerminal.Setup.<v>.exe`；`gh release view v0.6.0-pre.3 -R gowerlin/better-agent-terminal` 實際資產為 `BetterAgentTerminal.Setup.0.6.0-pre.3.exe` ⇒ **檔名與 URL 規則與本 fork 產物相符**。不相符的是 `choco/better-agent-terminal.nuspec` 的 `<authors>TonyQ CO., LTD.</authors>` / `<owners>tonyq</owners>`（與 chocolatey.org 上 package owner 一致，屬上游）。本單未改 `choco/`（不在 `affects_files`）；日後若要 opt-in 自發 choco，需另案處理 package id / owners。

### B. README

- 刪除「方式一：Homebrew (macOS)」（`brew install tonyq-org/tap/better-agent-terminal`）與「方式二：Chocolatey (Windows)」（`choco install better-agent-terminal`）
- 其餘重新編號：方式一：直接下載 / 方式二：從原始碼建置 / 方式三：快速安裝腳本；內文不動
- README 其他處檢查：無其他 `tonyq-org`、`choco`、`brew` 引用（badge 只有 version / platform / electron / license；`install.sh` 也無 brew / choco）。「致謝」段的 `tony1223/better-agent-terminal` 原始專案連結為署名，保留
- 另注意（未改，非本單範圍）：README badge 仍為 `version-2.1.3`、`electron-28.3.3`，「發行」段範例 tag 為 `v2.1.4`，與本 fork 現況（v0.6.x / Electron 41）不符

### C. `DESKTOP_PACKAGE_HOSTS`

- `scripts/verify-native-modules.js`：`DESKTOP_PACKAGE_HOSTS = ['win32-x64', 'linux-x64', 'darwin-arm64']`，註解註明 D136 / D137（Intel Mac host 只 warn）
- `WHISPER_ADDON_REQUIRED_HOSTS` / `EMBEDDED_RUNTIME_REQUIRED_HOSTS` 皆引用此常數 ⇒ darwin-x64 上 whisper 缺失走 `console.warn`（not a desktop package host, not fatal）、embedded claude / better-sqlite3 問題 `blocking: false` 只 warn
- `scripts/__tests__/verify-native-modules.test.mjs`：`:152` 斷言改為三個 host；新增案例 `darwin-x64 is not a desktop package host (D136 / D137): whisper and runtime only warn`（斷言 `WHISPER_ADDON_REQUIRED_HOSTS` 不含 `darwin-x64`；`verifyEmbeddedRuntime(root, 'darwin', 'x64')` 對 stub claude + 缺 `.node` 回報兩個 problem 且 `blocking: false`）。原檔無以 darwin-x64 為 desktop host 的其他案例
- 其他 consumer：repo 內無其他引用這三個常數之處

### D. 文件

- `CLAUDE.md`「Packaging / Release 前置檢查」→ Build fail-fast：desktop host 改為 `win32-x64` / `linux-x64` / `darwin-arm64`，註明 `darwin-x64` 只 warn（D136 / D137）
- `CLAUDE.md`「prerelease 標記與下游發佈」表：Homebrew / Chocolatey 兩列改述 opt-in（repo variable 名稱、所需 secret、預設跳過）；表內行號依現檔重核：`release.yml` prerelease `:267`、Homebrew `:298-308`、choco `:310-369`、server-bundle `:277-296`；`pre-release.yml` prerelease `:277`、server-bundle `:285-304`（`pre-release.yml` 未改，原 `:264` / `:272-291` 已是過期行號，一併更正）；表下結語補「正式版未設 variable 時同樣不動」
- `docs/plan-007-release-checklist.md`：Homebrew tap 檢查項改為「僅在設定 `HOMEBREW_TAP_REPO` 時」並提 Chocolatey 同樣 opt-in（`CHOCOLATEY_PUBLISH == 'true'`）；Tag + push 段的「skips the Homebrew tap update」補上 Chocolatey
- `_ct-workorders/_local-rules.md` 未改。建議塔台在「Release 流程實況」節補一段（建議文字）：

  > ### 下游發佈（D137 / T0476）
  >
  > `release.yml` 的 Homebrew tap dispatch 與 Chocolatey push 皆為 **opt-in、預設跳過**：分別需 repo variable `HOMEBREW_TAP_REPO`（tap `owner/name`，+ secret `TAP_GITHUB_TOKEN`）與 `CHOCOLATEY_PUBLISH == 'true'`（+ secret `CHOCO_API_KEY`），且 tag 不含 `-pre`。本 fork 目前未設定，正式版不會動上游 `tonyq-org/homebrew-tap` 或 chocolatey.org 上的 `better-agent-terminal`。`pre-release.yml` 無此兩 step。

### 驗收

| 項目 | 結果 | 證據 |
|---|---|---|
| `release.yml` 無 `tonyq-org`；Homebrew / choco 需 repo variable；YAML 可解析 | PASS | `grep -c tonyq` = 0；js-yaml 解析輸出見 A 段 |
| README 無 `tonyq-org/tap`、無 `choco install` | PASS | `grep -n -i "tonyq-org/tap\|choco install" README.md` 無結果 |
| `node scripts/verify-native-modules.js`（win32-x64） | PASS | exit 0：`✅ All 3 required native modules present, whisper binary: node_modules\@kutalia\whisper-node-addon\dist\win32-x64\whisper.node, embedded claude: native, better-sqlite3: .node present` |
| `npm run test:unit` | PASS | Test Files 173 passed (173)；Tests 2965 passed / 1 skipped (2966)。輸出中的 `Error: AttachConsole failed`（node-pty `conpty_console_list_agent`）為既有 Windows 雜訊，不影響結果 |
| `npx vite build` | PASS | exit 0 |
| `git diff --stat` + A 段 diff 摘要 | PASS | 見下 |

`git diff --stat`（填回報區前）：

```
 .github/workflows/release.yml                      | 30 +++++++---------------
 CLAUDE.md                                          | 12 ++++-----
 README.md                                          | 18 +++----------
 ...se-downstream-optin-and-drop-darwin-x64-host.md |  6 ++---
 docs/plan-007-release-checklist.md                 |  9 ++++---
 scripts/__tests__/verify-native-modules.test.mjs   | 12 ++++++++-
 scripts/verify-native-modules.js                   |  5 ++--
 7 files changed, 41 insertions(+), 51 deletions(-)
```

（工單檔本身之後另加回報區內容，不計入上表。）

### 約束遵循

- 未 push、未觸發 workflow、未建 tag；未用 `gh variable` / `gh secret`；`gh` 只用一次唯讀 `gh release view ... -R gowerlin/better-agent-terminal`
- `pre-release.yml`、`package.json`、`package-lock.json` 未改
- 未用 `git stash` / `reset` / `checkout --` / `restore`；換行維持各檔現況（index 皆 LF；README 與 checklist 的 worktree 為 autocrlf 產生的 CRLF，照原樣保留）

### Commit

單一 commit，message 含 `T0476`；只 commit 本單檔案與上列改動，未 push。hash 見 `git log --grep T0476`。

### 後續建議

1. 若日後本 fork 要自發 choco：需處理 `choco/better-agent-terminal.nuspec` 的 package id / authors / owners（目前為上游），另開單
2. README badge / 「發行」段版本範例過期（見 B 段），可另開小單
3. `_local-rules.md` 補 D137 段（建議文字見 D 段）
