---
schema_version: 1
schema_kind: workorder
id: T0476
title: "release.yml 下游發佈（Homebrew tap / Chocolatey）改 opt-in 預設關閉 + README 移除上游套件安裝方式 + verify-native-modules DESKTOP_PACKAGE_HOSTS 移除 darwin-x64"
type: implementation
status: TODO
repo: better-agent-terminal
project: D137
priority: P2
sizing: S
created_at: "2026-10-13T19:03:37+08:00"
started_at: null
updated_at: "2026-10-13T19:03:37+08:00"
completed_at: null
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

（Worker 填寫）
