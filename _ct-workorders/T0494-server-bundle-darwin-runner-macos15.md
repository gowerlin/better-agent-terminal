---
schema_version: 1
schema_kind: workorder
id: T0494
title: "server-bundle darwin-arm64 runner macos-14 → macos-15（macos-14 淘汰 brownout，pre.5 CI 會失敗）+ 確認 darwin server bundle 最低 macOS 不提高 + verify-packaged-native 過時註解"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P1
sizing: S
created_at: "2026-10-13T23:23:17+08:00"
started_at: null
updated_at: "2026-10-13T23:23:17+08:00"
completed_at: null
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

（Worker 填寫）
