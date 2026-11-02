---
schema_version: 1
schema_kind: workorder
id: T0783
title: "新增只 build、不發布的三平台桌面 workflow（`workflow_dispatch` + `ref`），`macos-acceptance.yml` 可改測它的產物；給 Electron 45 試做分支用"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: S
created_at: "2026-11-02T14:46:38+0800"
started_at: "2026-11-02T14:49:59+0800"
updated_at: "2026-11-02T14:56:48+0800"
completed_at: "2026-11-02T14:56:48+0800"
session_ids:
  - "b0edaab8-e983-41a2-a584-4fe977d108cd"
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

- **狀態**：DONE（Worker 範圍全部完成；workflow 實際試跑由塔台 push main 後執行，依工單不屬 Worker 步驟）
- **落點檢查**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 皆存在或祖先存在（`desktop-build.yml` 新增，`.github/workflows/` 存在）；C-2 無 `branch` 欄位（目前 `main`）。未設 `CT_HOME`（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；BAT 變數齊全（`BAT_REMOTE_TOKEN` 已設定）。
- **session_id**：b0edaab8-e983-41a2-a584-4fe977d108cd

### 產出摘要

1. **新增 `.github/workflows/desktop-build.yml`**（name `Desktop build (no release)`）
   - 觸發：只有 `workflow_dispatch`。輸入：`ref`（預設 `main`）、`version`（留空 = `0.0.0-exp.<run number>`；必須 `X.Y.Z-<後綴>`，拒絕發版線的 `X.Y.Z-pre.N` 與純 `X.Y.Z`）、`checks`（預設 true）、`mac_sign`（`auto` / `off`，預設 `auto`）、`mac_notarize`（預設 false）。
   - `permissions: contents: read`（整個 workflow 唯一權限）。所有 checkout 都 `persist-credentials: false`；輸入值一律經 env 進 shell，不直接 `${{ }}` 內插。
   - jobs：`prepare`（checkout `ref` → 驗版號 → 解析成 SHA，其他 job 都 checkout 這個 SHA）、`typecheck` / `tests`（`checks` 為真時；步驟抄自 `pre-release.yml` typecheck job 與 `tests.yml`，因 `tests.yml` checkout 的是 `github.sha` 而非 `ref`，不能直接 `uses:`）、`build`（三平台 matrix，`pre-release.yml` build job 的複本：`npm ci` → `@electron/rebuild` → `verify-native-modules.js` → `build-version.js`（`VERSION=v<version>`）→ `electron-builder --publish never` → `verify-packaged-native.js`（win x64 / mac arm64 / linux x64）→ `report-artifact-sizes.mjs`）。
   - 每個平台另寫 `BUILD-INFO.txt`（run、ref、commit、版號、mac 簽章狀態、`published: no`）與 `SHA256SUMS.txt`，與安裝檔一起上傳 artifact `desktop-win` / `desktop-mac`（另含 `mac-signature.txt`）/ `desktop-linux`，`retention-days: 7`、`if-no-files-found: error`；同內容寫進 job summary。
   - 🔴 沒有任何 tag、GitHub Release、`server-bundle-v*`、Pages、Homebrew / Chocolatey step（grep `softprops|contents: write|gh release create|git tag|git push|pages` 無命中）。
   - 設計決定：`typecheck` / `tests` 與 `build` **並行、不擋 build**（試做分支檢查失敗時仍拿得到安裝檔，run 照樣紅）。這與發版 workflow 的 gate 不同，已寫進文件。
2. **macOS 簽章 / 公證**
   - 查證：`pre-release.yml` **沒有任何** `APPLE_*` / `CSC_*` 設定，產物是 ad-hoc 簽章、未公證（T0778 實測 `Signature=adhoc`、`spctl` rejected）；簽章只在 `release.yml`（匯入 `APPLE_CERTIFICATE_P12` / `APPLE_CERTIFICATE_PASSWORD` 到 keychain，`APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` 公證）。工單寫「與 pre-release 相同地簽章（讓通知、Gatekeeper 與正式版一致）」兩者在現況下互斥，依其意圖做成：**有憑證 secret 就照 `release.yml` 簽，沒有就照 `pre-release.yml`（ad-hoc）**。
   - 預設 `mac_sign=auto`：`APPLE_CERTIFICATE_P12` 與 `APPLE_CERTIFICATE_PASSWORD` 都存在 → 匯入憑證並簽章（`package.json` `build.mac.identity`）；否則不簽章，`::warning::` 標示，`electron-builder` 指令與 `pre-release.yml` 完全相同。`off` 一律不簽。只判斷 secret 是否存在，不印值。
   - `mac_notarize` 預設關：只在已簽章且三個 `APPLE_*` 都在時公證；否則 `APPLE_*` env 為空字串，electron-builder `getNotarizeOptions` 回 undefined → `skipped macOS notarization`（已讀 `node_modules/app-builder-lib/out/macPackager.js` 確認空字串視為未設）。要公證但缺 secret → warning、不失敗。
   - 原本想用 `-c.mac.notarize=false` 關公證，查 `electron-builder/out/builder.js` 發現 CLI 只對 `mac.identity` 做 `"false"` 字串轉型，`notarize` 會變成 truthy 字串，所以改用「env 為空」的方式，不加此旗標。
   - 現況：`gh secret list -R gowerlin/better-agent-terminal` 回空（本 repo 沒有 repository secret；`release.yml` 在本 fork 也沒有 run 紀錄）⇒ **`auto` 實際產出未簽章（ad-hoc）dmg**，`BUILD-INFO.txt` 會寫 `mac signed: false`。T0781 指出 Electron 42 起未簽章 app 不顯示通知，T0784 在 runner 上看不到通知屬預期。日後設 secret 時憑證身分須與 `build.mac.identity` 相同，否則簽章失敗（文件已寫）。
3. **`.github/workflows/macos-acceptance.yml`**
   - 新增可選輸入 `build_run_id`（預設空）。空 → 原有 `Check the version input` / `Download the dmg…` 兩步照跑（只加 `if: inputs.build_run_id == ''`），其餘步驟與 artifact 名稱（`macos-acceptance-<version>-attempt<N>`）不變。
   - 有值 → 新步驟：驗數字 → `gh run view` 確認 workflow 名稱是 `Desktop build (no release)` → `gh run download -n desktop-mac` → 印 `BUILD-INFO.txt` / `mac-signature.txt` → 必須正好一個 dmg 且 SHA-256 等於 `SHA256SUMS.txt` → 設 `DMG`，後續掛載與 spec 相同。artifact 名稱 `macos-acceptance-build<run id>-attempt<N>`，summary 多「Tested build」段。
   - 權限只加 `actions: read`（讀別的 run 的 artifact 需要；仍是 job 自己的 `GITHUB_TOKEN`，無 secret）。這是舊模式唯一差異。spec（`e2e/macos/*`）未改。
4. **文件**：`packaging-release-checks.md` 新增「# 只 build、不發布的桌面 workflow（T0783，D223）」節（用途、指令、不發布規則、ref / version、步驟與同步提醒、checks 不擋 build 的理由、簽章 / 公證預設與退路、現況無 secret）；`release.md` 補一條（不是發版線、不得用 `-pre.N`）；`macos-ci-acceptance.md` 新增「## 測 desktop-build 產物（T0783）」節，並更新開頭說明與 permissions 規則；CLAUDE.md「Release」節補 1 行（CLAUDE.md 60,220 字元）。去識別化：新增內容只出現公開 repo 名 `gowerlin/better-agent-terminal`，無家目錄路徑、無簽章身分字串、無權杖樣式。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| actionlint | PASS | actionlint v1.7.12（`go install github.com/rhysd/actionlint/cmd/actionlint@latest`，裝在 Worker scratchpad，未寫進 repo）：`desktop-build.yml`、`macos-acceptance.yml` 0 findings；全部 7 個 workflow 0 findings。本機沒有 shellcheck，actionlint 的 shellcheck 整合未執行 |
| YAML 解析 + shell 語法 | PASS | `js-yaml` 解析兩檔；`desktop-build.yml` 23 個 bash `run` 區塊、`macos-acceptance.yml` 9 個，`${{ }}` 換成佔位字後 `bash -n` 全部 0 錯誤。兩檔 `on` 只有 `workflow_dispatch`；permissions 分別為 `{contents: read}`、`{contents: read, actions: read}` |
| 版號檢查邏輯 | PASS | 本機以相同 regex 試：空 → `0.0.0-exp.42` ok、`v0.0.0-exp.2` ok、`0.7.3-pre.5.exp.1` ok、`1.2.3-rc` ok；`0.7.3-pre.5` 拒絕（發版線）、`0.7.3` 拒絕、`0.0.0-exp;rm` 拒絕 |
| SHA256SUMS 解析 | PASS | `awk` 取檔名對應的 digest，文字模式（兩空白）與二進位模式（`*檔名`）都取得到 |
| 發布動作檢查 | PASS | `desktop-build.yml` grep `softprops|contents: write|gh release create|git tag|git push|pages` 無命中 |
| 本機乾跑（act 等） | 未執行 | 工單註明不強求；workflow 需在預設分支才能 dispatch |
| 實際 CI 試跑 | 未執行（依工單） | 本單不 push、不觸發；由塔台收單後執行，見〈給塔台的試跑指令〉 |

驗證於 product commit `5090001e` 的內容上執行（commit 前後內容相同；非 worktree，不填 SHA 欄位）。

### 遭遇問題

- 工單「與 pre-release 相同地簽章」的前提不成立：`pre-release.yml` 本身不簽章（ad-hoc）。依工單意圖做成「有憑證 secret 照 `release.yml` 簽、沒有就與 pre-release 相同」，屬工單允許範圍內的選擇，未提問。
- 本 repo 目前沒有任何 repository secret（`gh secret list` 空），所以 Electron 45 試做分支的 dmg 會是未簽章；若 T0784 需要驗 macOS 通知，需使用者另行設定 `APPLE_CERTIFICATE_P12` / `APPLE_CERTIFICATE_PASSWORD`（身分與 `build.mac.identity` 一致），或接受 runner 上不驗通知 → 建議塔台在 T0784 規劃時決定。
- 要等第一次試跑才能確認：① `tests` / `typecheck` 失敗時 `build` 不受影響（設計如此）；② desktop-build run 尚未結束時 artifact 能否被 `gh run download` 取到（文件已要求等 run 結束再跑 acceptance）；③ `0.0.0-exp.N` 版號經 `build-version.js` 與 Windows NSIS 版本欄位的實際表現。
- `typecheck` / `tests` 步驟是 `pre-release.yml` / `tests.yml` 的複本（工單預設不抽 composite action）；日後改發版 workflow 的這些步驟要同步看本檔，文件已註明。
- 寫回報時一次 bash heredoc 被 shell 解析失敗（exit 2，檔案未變動），改用 Edit 寫入。

### 互動紀錄

- 無（yolo；未向塔台提問、未詢問使用者）。

### 給塔台的試跑指令

push main 之後（workflow 檔需在預設分支上）：

```bash
# 1. 在 main 上試跑 desktop-build（版號自動 0.0.0-exp.<run number>，checks 預設開，mac 依 secret 自動 → 現況為未簽章）
gh workflow run desktop-build.yml -R gowerlin/better-agent-terminal -f ref=main
gh run list -R gowerlin/better-agent-terminal --workflow desktop-build.yml -L 3
gh run watch <run id> -R gowerlin/better-agent-terminal

# 判讀：三個 build job 綠；artifact desktop-win / desktop-mac / desktop-linux 存在且 BUILD-INFO.txt 有 published: no、mac signed: false；
# Releases / tags 沒有新增（gh release list -R gowerlin/better-agent-terminal -L 3 前後對照）
gh run download <run id> -R gowerlin/better-agent-terminal -n desktop-mac -D <資料夾>

# 2. 上一步 run 結束後，以 macos-acceptance 測該 run 的 dmg
gh workflow run macos-acceptance.yml -R gowerlin/better-agent-terminal -f build_run_id=<desktop-build run id>
gh run list -R gowerlin/better-agent-terminal --workflow macos-acceptance.yml -L 3

# 3. 舊行為回歸（可選）：不帶 build_run_id，結果應與 T0778 run 41380866131 相同
gh workflow run macos-acceptance.yml -R gowerlin/better-agent-terminal -f version=0.7.3-pre.5

# T0784 試做分支（分支 push 到 origin 之後）
gh workflow run desktop-build.yml -R gowerlin/better-agent-terminal -f ref=<試做分支> -f version=0.0.0-exp.e45.1
```

### commit 狀態

- product commit：`5090001e` `ci: build-only desktop workflow, macos-acceptance can test its dmg (T0783)`（`git commit --only` 6 檔：`desktop-build.yml`（新增）、`macos-acceptance.yml`、`CLAUDE.md`、三份 docs）。
- 工單 commit：本回報寫完後另以 `git commit --only _ct-workorders/T0783-build-only-desktop-workflow.md` 提交。
- 未 push、未觸發任何 workflow、未建 tag / release。

### 回報時間

2026-11-02T14:55:10+0800
