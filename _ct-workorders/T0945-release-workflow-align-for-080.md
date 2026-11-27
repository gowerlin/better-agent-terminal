---
schema_version: 1
schema_kind: workorder
id: T0945
title: "正式版 workflow `release.yml` 對齊 `pre-release.yml`：沒有 Apple 簽章 secret 時略過簽章步驟、補 Windows cleanup 與 native module 檢查（發 `v0.8.0` 前）"
type: fix
status: DONE
repo: better-agent-terminal
priority: P1
sizing: S
created_at: "2026-11-27T19:26:03+08:00"
updated_at: "2026-11-27T19:30:54+08:00"
started_at: "2026-11-27T19:26:59+08:00"
completed_at: "2026-11-27T19:30:54+08:00"
session_ids:
  - "bbc695e2-ef02-48d6-aa54-1a0778065840"
target_version: "0.8.0"
depends_on: []
related:
  - "D423；使用者 2026-11-27：「0.8.0 正式版」。本 fork 從未跑過 `release.yml`（`gh run list --workflow release.yml` 為空），repo 沒有任何 Actions secret；最後一個正式版 tag 是 `v0.5.8`"
affects_files:
  - _ct-workorders/T0945-release-workflow-align-for-080.md
  - .github/workflows/release.yml
  - scripts/__tests__/
  - docs/agent-guide/release.md
  - docs/agent-guide/packaging-release-checks.md
memory_overrides:
  - "🔴 分支：只在 `ct/T0945` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不得 push tag、不得 `gh workflow run`、不得建 release（發版由塔台做）。"
  - "🔴 問題：`release.yml`（push `v*` tag 觸發）與 `pre-release.yml`（`workflow_dispatch`，`v0.8.0-pre.1`–`pre.9` 都成功）已經分岔。塔台比對 step 名稱看到：① release 的 mac job 有「Import Code Signing Certificate」（`secrets.APPLE_CERTIFICATE_P12` 以 base64 解碼後 `security import`）與「Verify Apple notarization credentials」，`Package for macOS` 帶 `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`；本 repo 沒有這些 secret，空檔案的 `security import` 必定失敗 → mac build 失敗 → `release` job 不跑（tag 已推、沒有 release）。② pre-release 有「Windows cleanup (avoid EPERM locks)」與「Verify required native modules present」（`node scripts/verify-native-modules.js`），release 沒有。"
  - "🔴 規格：讓 `release.yml` 在**沒有** Apple secret 時，mac 打包與 `pre-release.yml` 行為相同（不匯入憑證、不驗證 notarization、`Package for macOS` 不帶空的 `APPLE_*` env），**有** secret 時維持現有簽章 / notarize 行為。做法：step 不能直接在 `if:` 讀 secrets → 用 job 或 step 層 env（例 `HAS_MAC_CERT: ${{ secrets.APPLE_CERTIFICATE_P12 != '' }}`）再以 `if: env.HAS_MAC_CERT == 'true'` 判斷，或等效寫法；`Package for macOS` 拆成有 / 無 secret 兩個互斥 step 或等效。補上 ② 的兩個 step（位置、內容與 `pre-release.yml` 相同）。"
  - "🔴 全文比對：逐段比對兩個 workflow 的 build / verify / release 步驟（不只 step 名稱），列出所有差異並分成「刻意不同」（觸發方式、從 tag 解版號、`prerelease: contains(github.ref, '-pre')`、release 名稱、Homebrew / Chocolatey opt-in、tag 由 push 而來）與「漂移」；漂移一律照 `pre-release.yml` 對齊。差異表寫進回報區。🔴 不改 `pre-release.yml`、`tests.yml`、`desktop-build.yml`；不改 Homebrew / Chocolatey 的 opt-in 條件；不改版號解析（`v0.8.0` → `0.8.0`）；`server-bundle-v<版號>` 發佈 step 保留。"
  - "🔴 驗證：YAML 解析（兩個 workflow 都能解析）；能取得 actionlint 就跑（例 `go run` / 下載官方 binary 到 scratchpad；取不到就寫明）；若加了 source guard 測試（建議：`scripts/__tests__/` 一支測試讀兩個 workflow，斷言 release 的 mac 簽章步驟有 secret 條件、兩邊都有 verify-native-modules / Windows cleanup），worktree `npm ci` 後 `npm run test:unit` 在 head 第一次完整執行全綠（附數字）。無法實跑 workflow：在回報區寫「發 `v0.8.0` 時塔台要看的 step」。"
  - "🔴 文件：`docs/agent-guide/release.md` 補一段「正式版 workflow 與 pre-release 的差異、Apple secret 有無的行為」（T0945）；CLAUDE.md「Release」節不用改，除非必守規則改變。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑，不寫 secret 值。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
---

# T0945 — `release.yml` 對齊，準備發 `v0.8.0`

## 背景

使用者決定下一版發 `0.8.0` 正式版。正式版走 `release.yml`（push `v0.8.0` tag 觸發），但本 fork 從未跑過它；它的 macOS 步驟需要 Apple 簽章 secret，repo 沒有設定，照現況推 tag 會讓 macOS 打包失敗、整個發版不產生 release。另有兩個 pre-release 已有、release 沒有的檢查步驟。

## 範圍

- 沒有 Apple secret 時略過簽章 / notarization（與 pre-release 相同），有 secret 時照舊。
- 補 Windows cleanup、verify-native-modules。
- 兩個 workflow 全文比對，漂移照 pre-release 對齊；差異表寫回報區。

## 不做

- 不推 tag、不跑 workflow、不建 release；不改 pre-release / tests / desktop-build；不改 Homebrew / Chocolatey 條件。

## 驗收

- [ ] 沒有 secret 時 mac 步驟與 pre-release 相同；有 secret 時行為不變
- [ ] Windows cleanup、verify-native-modules 已補
- [ ] 差異表（刻意 / 漂移）
- [ ] YAML 解析＋ actionlint（可取得時）；新增測試時 `npm run test:unit` 全綠
- [ ] docs/agent-guide/release.md 補段落

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-27T19:30:54+08:00
- **session_id**：bbc695e2-ef02-48d6-aa54-1a0778065840
- **branch**：`ct/T0945`
- **base_sha**：`33aec436603e70ed04c9caebecf67ef8a1a345a9`
- **validated_sha**：`ceb486cc47281f89356be8b5b96552f3d331c374`
- **head_sha**：`ceb486cc47281f89356be8b5b96552f3d331c374`（= validated_sha）
- **產品 commit**：`ceb486cc` `ci: align release.yml with pre-release.yml, Apple signing only with secret (T0945)`

### 落點檢查

- 結果：PASS
- C-0：工單 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單位於 `$CT_HOME/_ct-workorders/` → PASS
- C-3：`.github/workflows/release.yml`、`docs/agent-guide/*.md`、`scripts/__tests__/` 皆存在 → PASS
- C-2：工單無 `branch` 欄位；目前分支 `ct/T0945`
- `CT_HOME` 已設定（主 checkout）、`CT_WORKTREE_BRANCH` = `ct/T0945`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`BAT_REMOTE_TOKEN` 已設定

### 改了什麼

| 檔案 | 變更 |
|---|---|
| `.github/workflows/release.yml` | build job 加 `env.HAS_APPLE_CERT: ${{ secrets.APPLE_CERTIFICATE_P12 != '' }}`（只有 `true` / `false`）；`Import Code Signing Certificate`、`Verify Apple notarization credentials` 加 `&& env.HAS_APPLE_CERT == 'true'`；原 `Package for macOS` 改名 `Package for macOS (signed, notarized)`（同條件、APPLE_* env 不變），另加與 pre-release 相同的 `Package for macOS`（`env.HAS_APPLE_CERT != 'true'`、不帶 env）；補 `Windows cleanup (avoid EPERM locks)`（`npm ci` 前）與 `Verify required native modules present`（`build:native-win` 後、`build-version.js` 前），內容與 pre-release 逐字相同；step 名稱對齊；移除 `release` job 內未被引用的 `Extract version from tag` |
| `scripts/__tests__/release-workflow-alignment.test.mjs`（新） | source guard，8 個 test：兩個 workflow 都能解析、觸發方式；typecheck / tests / server-bundle / server-bundle-manifest job 完全相同；build job needs / matrix / runner 相同；**去掉只在有 secret 時執行的 step 後 build steps 與 pre-release 逐 step 深度相等**（唯一例外 `Update version and build` 的 `VERSION` 來源，兩者斷言各自的值）；cleanup / verify-native-modules 位置；mac 簽章 step 只在有 secret 時跑、所有讀 `secrets.APPLE_*` 的 step 都在簽章組內、無 secret 的打包 step 沒有 env；release job needs / 下載 / server bundle release 相同；Homebrew / Chocolatey 條件不變 |
| `docs/agent-guide/release.md` | 新增「正式版 workflow 與 pre-release 的差異、Apple secret 有無的行為（T0945）」：差異表、secret 有無的 step 行為表、T0945 前的失敗原因、發 `v0.8.0` 時要看的 step |
| `docs/agent-guide/packaging-release-checks.md` | desktop-build 節描述 `release.yml` 簽章的那一句改成「secret 存在時」並連到 release.md |

未改：`pre-release.yml`、`tests.yml`、`desktop-build.yml`、Homebrew / Chocolatey 條件、版號解析、`Create server bundle release`、CLAUDE.md（必守規則未變）。

### 差異表（release.yml vs pre-release.yml，逐段比對）

| # | 位置 | 差異 | 分類 | 處置 |
|---|---|---|---|---|
| 1 | `on` | push `v*` tag vs `workflow_dispatch` | 刻意（觸發方式） | 不動 |
| 2 | `prepare` | release 從 `GITHUB_REF` 解 TAG / VERSION、無 checkout；pre-release checkout＋fetch tags＋輸入或自動遞增 | 刻意（從 tag 解版號） | 不動 |
| 3 | `tests` | 只有註解文字（release 多「/ choco」） | 刻意（註解） | 不動 |
| 4 | `typecheck` / `server-bundle` / `server-bundle-manifest` | 無差異 | — | 測試守住 |
| 5 | `build` 空行 | `runs-on` 前多一空行 | 排版 | 已對齊 |
| 6 | `build` | 缺 `Windows cleanup (avoid EPERM locks)` | **漂移** | 已補（同位置同內容） |
| 7 | `build` | 缺 `Verify required native modules present` | **漂移** | 已補（同位置同內容） |
| 8 | `build` `Update version and build` | `VERSION: needs.prepare.outputs.tag` vs `v${{ needs.prepare.outputs.version }}`，值相同（`v0.8.0`） | 刻意（tag 由 push 而來） | 不動，測試斷言兩邊各自的值 |
| 9 | `build` mac | release 有 `Import Code Signing Certificate`、`Verify Apple notarization credentials`、`Package for macOS` 帶 APPLE_* env；且無條件執行 | **漂移**（無條件執行＝本 fork 必失敗） | 依規格改為有 secret 才執行；無 secret 時與 pre-release 同 step |
| 10 | `build` upload | `Upload Windows/macOS/Linux artifact` vs `…artifacts`（artifact 名稱相同） | 漂移（僅 step 名稱） | 已對齊 |
| 11 | `release` | `Display structure of downloaded files` vs `Display downloaded files` | 漂移（僅 step 名稱） | 已對齊 |
| 12 | `release` | release 多 `Extract version from tag`（`steps.version` 在該 job 無人引用） | 漂移（死步驟） | 已移除（`choco` job 自己那份保留） |
| 13 | `release` 建 release step | `Create Release`（無 `tag_name` / `target_commitish` / `name`，`prerelease: contains(github.ref, '-pre')`）vs `Create Pre-Release`（建 tag、名稱 `(Pre-Release)`、恆 `true`） | 刻意（release 名稱、prerelease、tag 由 push 而來） | 不動 |
| 14 | `release` `Create server bundle release` | 只有註解（release 多 Homebrew 一句） | 刻意（註解） | 不動，`with` 測試斷言相同 |
| 15 | `release` `Update Homebrew tap`、`choco` job | 只有 release 有 | 刻意（opt-in） | 不動，測試斷言條件 |

### 驗證

- YAML 解析：js-yaml 解析兩個 workflow 成功（release：prepare, typecheck, tests, server-bundle, server-bundle-manifest, build, release, choco；pre-release：同但無 choco）
- actionlint v1.7.7（`go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.7` 到 scratchpad）：`release.yml` + `pre-release.yml` → exit 0、無輸出
- 新測試單獨：8 / 8 passed
- worktree `npm ci`（exit 0）後於 head `ceb486cc` 第一次完整執行 `npm run test:unit`：exit 0，**Test Files 513 passed | 3 skipped (516)、Tests 9268 passed | 47 skipped (9315)**，67.96 s
- 無法實跑 workflow（工單禁止）。**發 `v0.8.0` 時塔台要看的 step**：
  - `build (macos-latest, mac)`：`Import Code Signing Certificate`、`Verify Apple notarization credentials`、`Package for macOS (signed, notarized)` 為 skipped；`Package for macOS` 執行成功；`Verify packaged native binaries (macOS arm64)` 成功
  - `build (windows-latest, win)`：`Windows cleanup (avoid EPERM locks)`、`Verify required native modules present` 有執行且成功
  - `build (ubuntu-24.04, linux)`：`Verify required native modules present` 成功
  - `release`：`Create Release` 成功且 GitHub Release 不是 prerelease、名稱 = `v0.8.0`；`Create server bundle release` 成功（`server-bundle-v0.8.0`）；`Update Homebrew tap` skipped
  - `choco` job skipped
  - mac 產物同 pre-release：ad-hoc 簽章、未公證（Apple Silicon only）

### 遭遇問題 / 偏差

- 🔴 偏差：檢查 actionlint 結果的同一條 Bash 指令末尾誤附了 `git stash list >/dev/null`，違反工單「禁止 `git stash`（含 list）」。該指令唯讀、輸出丟棄、未改動任何 stash 或檔案；之後未再使用。
- 「有 secret」判斷依規格只看 `APPLE_CERTIFICATE_P12`（`desktop-build.yml` 另要求 `APPLE_CERTIFICATE_PASSWORD`）。如此有 P12 時行為與 T0945 前逐字相同；只設 P12 未設密碼的半套設定仍會像以前一樣嘗試匯入。
- 本機 `npm ci` 結尾的 install-scripts 警告屬預期（CLAUDE.md「npm 12 install scripts」）。

### 後續建議

- docs/agent-guide/release.md 舊段落引用的行號（例 `:267`、`:277`、`:298-308`）早已與現行 workflow 不符（T0945 前就漂移），未在本單範圍內改；可另開小單把行號改成 step 名稱引用。

### 互動紀錄

- 無（yolo，無提問）
