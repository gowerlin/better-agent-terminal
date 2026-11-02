---
schema_version: 1
schema_kind: workorder
id: T0783
title: "新增只 build、不發布的三平台桌面 workflow（`workflow_dispatch` + `ref`），`macos-acceptance.yml` 可改測它的產物；給 Electron 45 試做分支用"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: S
created_at: "2026-11-02T14:46:38+0800"
depends_on: []
related:
  - "PLAN-053；D223（使用者選「新增只 build 不發布的 workflow」）；T0781〈建議下一步〉EXP 關卡 9；T0784（Electron 45 試做，會用本 workflow 驗三平台）"
  - "`.github/workflows/pre-release.yml`（`build` job 的 matrix、打包、`verify-packaged-native.js` 步驟為範本）、`.github/workflows/macos-acceptance.yml`（T0778，目前只下載 release 的 dmg）、`.github/workflows/tests.yml`；`docs/agent-guide/packaging-release-checks.md`、`docs/agent-guide/macos-ci-acceptance.md`、`docs/agent-guide/release.md`"
affects_files:
  - ".github/workflows/desktop-build.yml（新增，檔名可調）"
  - .github/workflows/macos-acceptance.yml
  - docs/agent-guide/macos-ci-acceptance.md
  - docs/agent-guide/packaging-release-checks.md
  - docs/agent-guide/release.md
  - CLAUDE.md
  - _ct-workorders/T0783-build-only-desktop-workflow.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 新 workflow（例 `desktop-build.yml`）：只 `workflow_dispatch`；輸入至少 `ref`（要 build 的分支 / commit，預設 `main`）與 `version`（寫進產物的版號，例 `0.0.0-exp.<run>` 這類**明顯不是正式版**的值，預設自動產生）。三平台 matrix 與打包步驟照 `pre-release.yml` 的 `build` job（Windows x64、macOS arm64、Linux x64；同樣的 typecheck / tests 前置可選擇沿用 `tests.yml`），每個平台跑 `verify-packaged-native.js`，用 `actions/upload-artifact` 上傳安裝檔（保留天數短，例 7 天）。🔴 **絕不**建立 tag、GitHub Release、`server-bundle-v*`、Pages 部署、Homebrew / Chocolatey；`permissions` 只給需要的（預設 `contents: read`）。"
  - "🔴 macOS 簽章 / 公證：先查 `pre-release.yml` 怎麼用 `APPLE_*` / `CSC_*` secrets。優先做法：與 pre-release 相同地簽章（讓 macOS 通知、Gatekeeper 與正式版一致；T0781：Electron 42 起未簽章的 app 不顯示通知）。公證若耗時或需要額外權限，可加輸入讓呼叫者選要不要公證，預設行為在回報寫清楚。沒有 secrets 時（例 fork）要能退回未簽章、不失敗，並標示產物未簽章。"
  - "🔴 `macos-acceptance.yml`：維持現有 `-f version=` 測 release dmg 的行為**完全不變**；新增可選輸入（例 `build_run_id`），有值時改從該次 `desktop-build` run 的 artifact 取 dmg（`actions/download-artifact` 的 `run-id` + `github-token`，或 `gh run download`）。權限只加讀 artifact 需要的（`actions: read`）。spec 本身不改。"
  - "🔴 驗證：`actionlint`（有就跑；沒有就以 `npx --yes @action-validator/cli` 或 YAML 解析檢查，寫明用了什麼）；用 `act` 或其他方式本機乾跑不強求。本單**不 push、不觸發 workflow**：`workflow_dispatch` 必須在預設分支上才能觸發，塔台收單後 push main，再由塔台以 `gh workflow run desktop-build.yml -R gowerlin/better-agent-terminal -f ref=main` 試跑一次並判讀。回報寫出塔台要用的確切指令（含 macos-acceptance 測 artifact 的指令）。"
  - "🔴 文件：`macos-ci-acceptance.md` 補「測 desktop-build 產物」；`packaging-release-checks.md` / `release.md` 補新 workflow 的用途與「不發布」規則；CLAUDE.md「Packaging / Release 前置檢查」或「Release」節補 1 行（用途、檔名、🔴 不建 tag / release）。公開 repo 去識別化（D176）。"
  - "🔴 不改 `pre-release.yml` / `release.yml` / `tests.yml` 的行為（可抽共用步驟到 composite action 的話先問塔台；預設不抽，直接複製必要步驟）。不發版、不改 CHANGELOG、不 push。yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台。Git：只用 `git commit --only` commit 本單範圍。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0783 — 只 build、不發布的三平台桌面 workflow

## 元資料

- **工單編號**：T0783
- **類型**：implementation（CI）
- **優先級**：P1
- **建立時間**：2026-11-02T14:46:38+0800
- **預估規模**：S

## 背景

T0781 建議 Electron 主升級一次跳到 45，並在隔離分支試做（T0784）。試做分支需要三平台 build 與 macOS 驗收，但現有 `pre-release.yml` 會建 tag、GitHub prerelease 與 server bundle，是對外動作。使用者選擇新增一個只 build 不發布的 workflow（D223）。

## 範圍

1. 新增 `desktop-build.yml`（只 `workflow_dispatch`，輸入 `ref` / `version`，三平台打包＋檢查＋上傳 artifact）。
2. `macos-acceptance.yml` 加可選輸入，能測 `desktop-build` 產物；原行為不變。
3. 文件與 CLAUDE.md。

## 不做

- 不建 tag / release / Pages；不改既有發版 workflow；不 push、不觸發。

## 驗收

- [ ] workflow 檔與 YAML / actionlint 檢查結果
- [ ] 簽章 / 公證的預設行為與沒有 secrets 時的退路
- [ ] `macos-acceptance.yml` 舊輸入行為不變、新輸入的用法
- [ ] 塔台試跑用的確切指令
- [ ] 文件與 CLAUDE.md

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 驗證

### 遭遇問題

### 互動紀錄

### 給塔台的試跑指令

### commit 狀態

### 回報時間
