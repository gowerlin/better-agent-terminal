---
schema_version: 1
schema_kind: workorder
id: T0487
title: "CI 執行環境：GitHub Actions 改用原生 Node 24 的版本（消除 Node 20 deprecated 警告）+ ubuntu-latest 改為明確版本（10/19 起改 Ubuntu 26）"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-13T23:13:05+08:00"
started_at: "2026-10-13T23:17:31+08:00"
updated_at: "2026-10-13T23:22:52+08:00"
completed_at: "2026-10-13T23:22:52+08:00"
target_version: v0.6.0-pre.5
depends_on: []
related:
  - "pre.3 / pre.4 CI annotations：`actions/checkout@v4`、`actions/setup-node@v4`、`actions/upload-artifact@v4`、`actions/download-artifact@v4` 被強制以 Node 24 執行；`The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026`"
  - "CLAUDE.md「Release」「Packaging / Release 前置檢查」（CI pipeline 順序不可變）"
affects_files:
  - ".github/workflows/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改 `uses:` 版本與 `runs-on:` 標籤，以及版本升級必要的參數調整；job / step 順序、條件、指令不變"
  - "🔴 每個新版本須以 `gh api` / release notes（唯讀）確認存在、原生 Node 24、breaking changes；影響本 repo 用法者逐條說明調整"
  - "🔴 server-bundle 刻意用 `ubuntu-22.04`（glibc 相容）——不改"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0487 — CI 執行環境：GitHub Actions 改用原生 Node 24 的版本（消除 Node 20 deprecated 警告）+ ubuntu-latest 改為明確版本（10/19 起改 Ubuntu 26）

## A. Actions 版本

- 盤點所有 workflow 的 `uses:`（含第三方 release / dispatch actions），列出現行版本、建議版本、是否原生 Node 24、breaking changes
- 升級到原生 Node 24 的 major；upload / download artifact 需成對相容（artifact 名稱、`merge-multiple`、保留期等行為差異要確認）
- 第三方 action 若無 Node 24 版本，列出並維持現狀

## B. Runner 標籤

- 所有 `ubuntu-latest` 改為明確版本，預設 `ubuntu-24.04`（目前實際使用、維持 AppImage glibc 基線）；選其他版本須說明理由
- `macos-latest` / `windows-latest` 是否釘版：評估後回報建議（本單不改，除非有即將遷移的公告證據）

## 驗收條件

- [ ] 所有 workflow YAML 可解析（js-yaml）；若可用，以 actionlint 類工具檢查（不可用則說明）
- [ ] 回報區附 `uses:` 對照表與證據連結；`git diff --stat`
- [ ] 實跑驗證留待 pre.5 CI（塔台觀察）

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。三個 workflow 的 6 種 action 全部升到原生 `node24` 的最新 major；6 處 `ubuntu-latest`（4 個 `runs-on:` + 2 個 build matrix `os:`）改為 `ubuntu-24.04`。job / step 順序、`if:` 條件、`run:` 指令、`with:` 參數皆未變（不需要任何參數調整，理由見下表）。`server-bundle` 的 `ubuntu-22.04` / `ubuntu-22.04-arm` / `macos-14`、`macos-latest`、`windows-latest` 未動。

- 執行時間：started `2026-10-13T23:17:31+08:00`，completed `2026-10-13T23:22:52+08:00`
- 執行模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### Landing Zone Check：PASS

| 檢查 | 結果 |
|---|---|
| C-0 repo identity | PASS：frontmatter `repo: better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`） |
| C-1 work order path | PASS（工單在 `REPO_ROOT/_ct-workorders/` 下） |
| C-3 `affects_files` | 資訊性：`.github/workflows/` 存在 |
| C-2 branch | 不適用（工單無 `branch` 欄位；實際 `main`） |
| `BAT_WORKSPACE_ID`（僅記錄） | `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b` |

### A. `uses:` 對照表

`runs.using` 一律以 `gh api repos/<owner>/<repo>/contents/action.yml?ref=<major tag>` 讀取（唯讀），2026-10-13 查詢。

| Action | 原版本（runtime） | 新版本（runtime） | 處數 | Breaking changes 與本 repo 用法的影響 | 證據 |
|---|---|---|---|---|---|
| `actions/checkout` | `@v4`（node20） | `@v7`（node24，最新 v7.0.1） | 11 | v5：改 node24、runner ≥ 2.327.1（GitHub-hosted 符合）。v6：`persist-credentials` 改存到 `$RUNNER_TEMP` 獨立檔並由 git config include，git 指令仍有認證；本 repo checkout 後只有 `pre-release.yml` 的 `git fetch --tags` / `git tag -l`（公開 repo、唯讀），不受影響。v7：ESM；`pull_request_target` / `workflow_run` 預設拒絕 checkout fork PR，本 repo 觸發條件只有 `workflow_dispatch` / tag push / branch push，不受影響。用到的 `fetch-tags` / `fetch-depth` 在 v7 仍存在 | [v5.0.0](https://github.com/actions/checkout/releases/tag/v5.0.0) / [v6.0.0](https://github.com/actions/checkout/releases/tag/v6.0.0) / [v7.0.0](https://github.com/actions/checkout/releases/tag/v7.0.0) |
| `actions/setup-node` | `@v4`（node20） | `@v7`（node24，最新 v7.1.0） | 9 | v5：`package.json` 有 `packageManager` 時自動啟用快取（`package-manager-cache` 預設 true）；v6：自動快取限 npm。本 repo `package.json` **沒有** `packageManager` / `devEngines`，自動快取不會觸發，原本沒寫 `cache:` 的 3 個 server-bundle-manifest / release job 維持不快取，寫 `cache: npm` 的維持快取。v7：ESM、移除 dummy `NODE_AUTH_TOKEN` 匯出（本 repo 不發佈 npm、沒用 `registry-url`）。`node-version: '24'` 不變 | [v5.0.0](https://github.com/actions/setup-node/releases/tag/v5.0.0) / [v6.0.0](https://github.com/actions/setup-node/releases/tag/v6.0.0) / [v7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0) / [v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) |
| `actions/upload-artifact` | `@v4`（node20） | `@v7`（node24，最新 v7.0.2） | 12 | v5 仍是 node20（「preliminary support」），v6 才是 node24。v7：ESM；新增 `archive`（預設 `true`，照舊壓 zip 上傳，本 repo 未設）。用到的 `name` / `path` / `if-no-files-found` 在 v7 仍存在；`retention-days` 本 repo 沒設，保留期照 repo 預設不變 | [v5.0.0](https://github.com/actions/upload-artifact/releases/tag/v5.0.0) / [v6.0.0](https://github.com/actions/upload-artifact/releases/tag/v6.0.0) / [v7.0.0](https://github.com/actions/upload-artifact/releases/tag/v7.0.0) |
| `actions/download-artifact` | `@v4`（node20） | `@v8`（node24，最新 v8.0.2） | 9 | v5：只有「以 `artifact-ids` 下載單一 artifact」的路徑變了，本 repo 全用 `name:` 或「不帶 name 全下」，不受影響。v6 仍是 node20，v7 才是 node24。v8：ESM；不是 zip 的檔案不解壓（搭配 upload `archive: false`，本 repo 未用，全部仍是 zip）；**digest 不符預設改為 error**（原為 warning，見殘餘風險）。用到的 `name` / `path` / `pattern` / `merge-multiple` 在 v8 仍存在 | [v5.0.0](https://github.com/actions/download-artifact/releases/tag/v5.0.0) / [v7.0.0](https://github.com/actions/download-artifact/releases/tag/v7.0.0) / [v8.0.0](https://github.com/actions/download-artifact/releases/tag/v8.0.0) / [v8.0.2](https://github.com/actions/download-artifact/releases/tag/v8.0.2) |
| `softprops/action-gh-release` | `@v1`（**node16**） | `@v3`（node24，最新 v3.0.3） | 5 | v1 是 node16（actionlint 對 HEAD 回報 5 筆「runner too old」）。v2.0.0 只改 node20。v2.3.3 新增 `overwrite_files`（預設 `true`，與 v1 同名覆蓋行為一致）。v2.5.0 起正式 release 改「先 draft、asset 傳完再發佈」，prerelease 則維持直接發佈（README：讓 `release.prereleased` 事件照常觸發）。README 只對 immutable-release repo 要求 prerelease 加 `draft: true`；本 repo `gh api repos/gowerlin/better-agent-terminal/immutable-releases` = `{"enabled":false}`，不需要。v3.0.0 只改 node24。用到的 `tag_name` / `name` / `body` / `prerelease` / `target_commitish` / `files` / `generate_release_notes` 在 v3 仍存在，`fail_on_unmatched_files` 預設仍為 false | [v2.0.0](https://github.com/softprops/action-gh-release/releases/tag/v2.0.0) / [v2.5.0](https://github.com/softprops/action-gh-release/releases/tag/v2.5.0) / [v3.0.0](https://github.com/softprops/action-gh-release/releases/tag/v3.0.0) / [v3.0.3](https://github.com/softprops/action-gh-release/releases/tag/v3.0.3) |
| `peter-evans/repository-dispatch` | `@v3`（node20） | `@v4`（node24，最新 v4.0.1） | 1 | v4 只改 node24、runner ≥ 2.327.1。`token` / `repository` / `event-type` / `client-payload` 在 v4 仍存在。此 step 為 D137 opt-in（未設 `vars.HOMEBREW_TAP_REPO` 時不跑） | [v4.0.0](https://github.com/peter-evans/repository-dispatch/releases/tag/v4.0.0) |

- **第三方 action 沒有 Node 24 版本的**：無。6 種 action 都有原生 node24 major。
- **upload / download 成對**：upload `@v7` 與 download `@v8` 是同一天（2026-02-26）一起發佈的對應版本；全部 artifact 名稱、`pattern: server-bundle-*` + `merge-multiple: true`、不帶 name 的全下載（`path: artifacts` / `staging`，每個 artifact 落在 `<path>/<name>/`）行為都沒變。三個 workflow 一起改，沒有新舊混用。
- 本 repo 是 GitHub-hosted runner，「runner ≥ 2.327.1」的需求自動滿足。

### B. Runner 標籤

| 檔案 | 位置 | 原值 | 新值 |
|---|---|---|---|
| `pre-release.yml` | `prepare` `runs-on`（:16） | `ubuntu-latest` | `ubuntu-24.04` |
| `pre-release.yml` | `build` matrix `os`（:157，linux） | `ubuntu-latest` | `ubuntu-24.04` |
| `pre-release.yml` | `release` `runs-on`（:252） | `ubuntu-latest` | `ubuntu-24.04` |
| `release.yml` | `prepare` `runs-on`（:10） | `ubuntu-latest` | `ubuntu-24.04` |
| `release.yml` | `build` matrix `os`（:122，linux） | `ubuntu-latest` | `ubuntu-24.04` |
| `release.yml` | `release` `runs-on`（:241） | `ubuntu-latest` | `ubuntu-24.04` |

- 選 `ubuntu-24.04`：`ubuntu-latest` 目前就指向它（[runner-images#10636](https://github.com/actions/runner-images/issues/10636)），AppImage 的 glibc 基線不變；[runner-images#14748](https://github.com/actions/runner-images/issues/14748) 公告 `ubuntu-latest` 自 2026-10-19 起分批改為 Ubuntu 26.04，2026-11-19 完成。
- build job 的條件都用 `matrix.platform`，沒有任何 `matrix.os == 'ubuntu-latest'` 判斷（已 grep 確認），改 matrix `os` 不影響 step 條件。
- **`macos-latest` / `windows-latest`：建議本單不釘版**。兩者今年的遷移都已完成：`macos-latest` → `macos-26`（[#14167](https://github.com/actions/runner-images/issues/14167)，2026-06-15 至 07-15）；`windows-latest` → Windows Server 2025 + VS 2026（[#14017](https://github.com/actions/runner-images/issues/14017)，2026-06-08 至 06-15）。2026-10-13 查 runner-images 的 open Announcement，沒有這兩個標籤的待遷移公告。日後如果想要重現性，可分別釘成 `macos-26`（arm64，符合 D136 只打 arm64）與 `windows-2025`。要留意的是 open 公告 [#14856](https://github.com/actions/runner-images/issues/14856)：macOS 26 + Xcode 27 的預設 OpenSSL 會從 3 改成 4，屬映像內容變動，不是標籤遷移。

### 🔴 範圍外發現（交塔台決定，本單未改）

1. 🔴 **`macos-14` 已在淘汰期，pre.5 的 CI 可能直接失敗**：三個 workflow 的 `server-bundle` matrix（darwin-arm64，`runs_on: macos-14`）都用它。[runner-images#13518](https://github.com/actions/runner-images/issues/13518)：2026-11-02 起完全停止支援，之前還有 brownout（期間 job 一律失敗），時段為 UTC 10/16、10/19、10/23、10/26、10/29、10/30 的 14:00–24:00（= 台北時間當天 22:00 至隔天 08:00）。pre.5 預計近期發版，如果在這些時段 dispatch，`server-bundle (darwin-arm64)` 會失敗，`release` job 也就不會跑。**建議**：另開一張單，把 server-bundle darwin-arm64 改到 `macos-15`，並確認 darwin-arm64 server bundle 內原生模組的最低 macOS（deployment target）沒有提高；在那之前，pre.5 避開上述時段 dispatch。本單沒改，原因是工單範圍只授權 `ubuntu-latest`，而換 macOS 版本牽涉 server bundle 相容性判斷，需要塔台決定。
2. **`ubuntu-22.04` / `ubuntu-22.04-arm` 淘汰排程**（server-bundle 的 glibc 基線）：[runner-images#14254](https://github.com/actions/runner-images/issues/14254)，2026-09-17 起進入淘汰期，2027-04-17 完全停止支援，2027-03 / 04 有 brownout。不急，但需要在 2027-03 前決定新的 glibc 基線（24.04 = glibc 2.39，會提高遠端主機的最低需求）。
3. **過時註解**：`scripts/verify-packaged-native.js:46`「The CI linux job builds one AppImage on ubuntu-latest (x64).」應改為 `ubuntu-24.04`。不在本單 `affects_files`，建議由 T0492 或 T0493 順手修。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| YAML 可解析（js-yaml） | **PASS** | `node -e` 以 repo 內的 `js-yaml` 載入三檔：`build-server-bundle.yml OK jobs=build,manifest,release uses=11`、`pre-release.yml OK jobs=prepare,server-bundle,server-bundle-manifest,build,release uses=17`、`release.yml OK jobs=prepare,server-bundle,server-bundle-manifest,build,release,choco uses=19` |
| actionlint | **PASS**（shellcheck 部分未跑） | 本機沒有 actionlint，以 `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7 -oneline .github/workflows/*.yml`（go1.27.1）執行：**修改後 0 筆、exit 0**。對照組：HEAD 版本（`git show HEAD:` 匯出到 scratchpad）有 5 筆 `the runner of "softprops/action-gh-release@v1" action is too old to run on GitHub Actions`，修改後消失。本機沒有 `shellcheck`，`run:` 腳本的 shellcheck 檢查沒有執行 |
| 讀 workflow 的單元測試 | **PASS** | `npx vitest run scripts/__tests__/verify-packaged-native.test.mjs`：33 passed（其中 `describe.each(['pre-release.yml','release.yml'])` 會解析 build job，並斷言 verify step 位於 package 之後、`actions/upload-artifact` 之前） |
| 變更範圍 | **PASS** | `git diff -U0` 的變更行只有 `uses:` 版本與 ubuntu 標籤（−53 / +53，逐類計數：checkout 11、upload 12、download 9、setup-node 9、gh-release 5、repository-dispatch 1、`runs-on` 4、matrix `os` 2） |
| 換行 | **PASS** | 維持各檔原狀：`pre-release.yml` 工作樹為 CRLF（304/304 行），`build-server-bundle.yml` / `release.yml` 為 LF；index 三檔皆為 `i/lf`。（Git Bash `sed -i` 一度把 `pre-release.yml` 轉成 LF，已用 perl 還原並驗證） |
| tsc | 不適用 | 本單沒有改 TS / JS 檔 |
| `npx vite build` | 未跑（不適用） | 只改 `.github/workflows/*.yml`，不在 vite build 輸入內；工作樹另有其他 Worker 未提交的 WIP，跑 build 也驗不到本單 |
| 實跑 CI | 留待 pre.5（塔台觀察） | 依工單：不 push、不觸發 workflow |

`git diff --stat`：

```
 .github/workflows/build-server-bundle.yml | 22 ++++++++--------
 .github/workflows/pre-release.yml         | 40 ++++++++++++++--------------
 .github/workflows/release.yml             | 44 +++++++++++++++----------------
 3 files changed, 53 insertions(+), 53 deletions(-)
```

### 殘餘風險（pre.5 CI 觀察重點）

- `download-artifact@v8` 的 digest 不符從 warning 改為 error：理論上更安全，但如果 artifact 服務端偶發 hash 不一致，以前只是警告，現在會讓 job 失敗。真的發生時可對該 step 設 `digest-mismatch: warn`（需塔台決定）。
- `action-gh-release@v3` 的正式版改為「先 draft、asset 傳完再發佈」：`release.yml` 正式版 tag 的 GitHub Release 會短暫以 draft 存在。後續的 server-bundle release、Homebrew dispatch 都在同一個 job 內依序執行，不依賴 release 事件，預期不受影響。
- 第一次在 `ubuntu-24.04` 明確標籤上跑：映像與目前 `ubuntu-latest` 相同，預期沒有差異。

### CLAUDE.md 建議文字（交 T0493 套用）

在「本機開發：npm 12 install scripts」節的 **CI** 條目後補一條：

> - **CI actions / runner 版本**（T0487）：workflow 用的 action 全部是原生 Node 24 的 major：`actions/checkout@v7`、`actions/setup-node@v7`、`actions/upload-artifact@v7`、`actions/download-artifact@v8`（upload / download 須成對升級）、`softprops/action-gh-release@v3`、`peter-evans/repository-dispatch@v4`。Linux job 釘 `ubuntu-24.04`（不用 `ubuntu-latest`：它自 2026-10-19 起分批改為 Ubuntu 26.04，runner-images#14748），AppImage glibc 基線 = 24.04；server-bundle 刻意用 `ubuntu-22.04` / `ubuntu-22.04-arm`（glibc 相容，2027-04-17 停止支援，runner-images#14254）。`macos-latest`（現為 macos-26）/ `windows-latest`（現為 Windows Server 2025 + VS 2026）未釘版。升級 action 前以 `gh api repos/<owner>/<repo>/contents/action.yml?ref=<tag>` 確認 `runs.using`；`download-artifact@v8` 的 digest 不符預設會讓 job 失敗。

（如果塔台採納範圍外發現 1，`macos-14` 的描述要跟著改。）

### Commit

`git commit --only` 本單檔案：`.github/workflows/build-server-bundle.yml`、`.github/workflows/pre-release.yml`、`.github/workflows/release.yml`、`_ct-workorders/T0487-ci-actions-node24-and-runner-pin.md`。沒有 push。工作樹中其他 Worker 的檔案（`T0484` / `T0485` 工單等）沒有 stage。commit hash 以 `git log --grep T0487` 查（訊息標題 `ci: T0487 ...`）。

### 偏差 / 互動

- 無使用者互動（`CT_INTERACTIVE=0`）。
- 偏差：無。工單 frontmatter 原狀態為 `TODO`（不是 `PENDING`），照常改為 `IN_PROGRESS` → `DONE`。
