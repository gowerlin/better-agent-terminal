---
schema_version: 1
schema_kind: workorder
id: T0365
title: "BUG-071：desktop release 自動發佈 server-bundle-v* + 修正預設下載網址 owner"
type: fix
status: DONE
priority: P1
sizing: S
created_at: "2026-10-04T13:12:47+08:00"
updated_at: "2026-10-04T13:19:58+08:00"
started_at: "2026-10-04T13:15:13+08:00"
completed_at: "2026-10-04T13:19:58+08:00"
target_version: "0.5.9-pre.3"
depends_on: []
related:
  - "BUG-071（FIXING，本工單為修復載體）"
  - "D120（本工單決策依據）"
  - "PLAN-031（server bundle distribution）"
  - "D092（per-host baseline matrix）/ D093（server-bundle-v* 獨立 tag 命名）/ D095（BAT_SERVER_BUNDLE_BASE_URL override）"
affects_files:
  - src/lib/arch-normalize.ts
  - src/lib/__tests__/server-bundle-download.test.ts
  - scripts/fetch-baseline-tarball.mjs
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - docs/server-bundle-distribution.md
  - CLAUDE.md
  - CHANGELOG.md
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不要 push、不要推任何 tag、不要觸發 workflow、不要建立任何 GitHub release**。本工單只交付 source + workflow 檔案改動；發 `v0.5.9-pre.3` 與確認 release 產出由塔台在你回報後執行。"
  - "🔴 **網址格式不改**：仍是 `<base>/server-bundle-v<版號>/<asset>`。只改 owner（`anthropics` → `gowerlin`）。不要改成掛在 desktop `v<版號>` release 上（D120 已否決該選項）。"
  - "🔴 `gh` 指令若需要（唯讀查詢）一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "不改 `build-server-bundle.yml`（手動 tag 線保留為備援，D120 未廢除它）。"
---

# T0365 — BUG-071：desktop release 自動發佈 `server-bundle-v*` + 修正預設下載網址 owner

- **狀態**：DONE
- **任務類型**：fix（程式 + CI workflow + 文件）
- **工作量預估**：S
- **Context Window 風險**：低~中（8 檔，workflow 兩檔需讀全段 job）

## 背景

BUG-071 原症狀（wizard install-bundle step placeholder throw）已由 PLAN-031 修掉，installer 也內建了 linux-x64 baseline。但塔台 2026-10-04 複查發現 **runtime fallback 下載整條斷線**（詳見 `BUG-071` 檔尾「第四十九 session 複查」、`_decision-log.md` D120）：

1. `src/lib/arch-normalize.ts:28` `DEFAULT_RELEASE_BASE_URL = 'https://github.com/anthropics/better-agent-terminal/releases/download'` —— **該 repo 不存在**（404）。`scripts/fetch-baseline-tarball.mjs:217,319` 同樣寫死；`src/lib/__tests__/server-bundle-download.test.ts` 有斷言引用
2. `gowerlin/better-agent-terminal` 上 **0 個** `server-bundle-v*` release。`pre-release.yml` / `release.yml` 的 `server-bundle-manifest` job 只把 baseline 上傳成 Actions artifact `server-bundle-baseline`（`release.yml:103-111`、`pre-release.yml:138-146`），從未發佈到 Release
3. runtime 下載流程（`electron/remote/server-bundle-download.ts`）會依序抓 `manifest.json` → tarball（含 sha256 驗證），網址為 `${base}/server-bundle-v${version}/...`

## 範圍

### Part A — 預設下載網址 owner

- `src/lib/arch-normalize.ts` `DEFAULT_RELEASE_BASE_URL` → `https://github.com/gowerlin/better-agent-terminal/releases/download`
- `scripts/fetch-baseline-tarball.mjs` 兩處（:217、:319）同步改，並把檔頭註解 :30 的範例網址一起改
- 更新 `src/lib/__tests__/server-bundle-download.test.ts` 的相關斷言
- 完成後 `grep -rn "anthropics/better-agent-terminal" --exclude-dir=node_modules --exclude-dir=_ct-workorders .`（排除建置產物目錄）須為 0

### Part B — desktop workflow 自動發佈 server bundle release

在 `pre-release.yml` 與 `release.yml` **各自**新增發佈步驟，規格：

| 項目 | 要求 |
|------|------|
| 來源 | 下載同一 run 的 `server-bundle-baseline` artifact（沿用既有 artifact，**不要**重建 tarball） |
| tag | `server-bundle-v<版號>`，版號取 `needs.prepare.outputs` 中與 desktop 相同的版號（**不帶** `v` 前綴的那個值；desktop tag 是 `v<版號>`）—— 請讀 `prepare` job 確認 output 名稱 |
| 資產 | 3 arch × (`bat-server-<arch>-v<版號>.tar.gz` + `.sha256`) + `manifest.json`。檔名須與 `server-bundle-download.ts` / `server-bundle-download-helpers.ts` 組出的 URL **完全一致**——請讀這兩檔核對，不要憑推測 |
| prerelease | 恆為 `true`（與 `build-server-bundle.yml:160` 一致；避免成為 repo 的 Latest release） |
| 時機 | **desktop release 發佈成功之後**才發（`needs` 依賴 desktop `release` job，或在同一 job 內接在 desktop release step 之後）。build 失敗時不得留下孤兒 server-bundle release |
| target commit | 與 desktop release 同一 commit |
| 權限 | 確認 job 有 `contents: write` |
| release body | 簡短說明即可，例如「Server bundle for BAT v<版號>. Consumed by the setup wizard runtime download; not for manual install.」 |

action 沿用 repo 既有的 `softprops/action-gh-release@v1`，參數寫法參考 `build-server-bundle.yml:153-168`。

### Part C — 文件

- `CLAUDE.md`：「Server bundle 是獨立 tag 線」節（及「Server bundle baseline（PLAN-031）」節中 `Server bundle release（獨立 tag）` 那條）補上：自 D120 起 `pre-release.yml` / `release.yml` 發佈 desktop release 時**同時自動發佈** `server-bundle-v<版號>`；`build-server-bundle.yml` 手動 tag 線保留為備援。預設下載來源為 gowerlin
- `docs/server-bundle-distribution.md`：對應段落同步（若有提到預設網址或發佈流程）
- `CHANGELOG.md` `## [Unreleased]` → `### Fixed` 補一筆（refs: BUG-071, T0365, D120）

## 明確排除（不要做）

- ❌ 不要 push / 推 tag / `gh workflow run` / `gh release create`（見 memory_overrides）
- ❌ 不要改 `build-server-bundle.yml`
- ❌ 不要改網址格式、manifest schema、tarball 命名、`BAT_SERVER_BUNDLE_BASE_URL` override 邏輯
- ❌ 不要改 D092 per-host baseline matrix（Windows installer 仍只內建 linux-x64）
- ❌ 不要做 PLAN-031 AC-9「升級既有 server UI」
- ❌ 不要碰 `AGENTS.md`（既有 dirty）
- ❌ 不要 bump `package.json` 版號（塔台發版時處理）

## 驗收條件

- [ ] AC-1 `anthropics/better-agent-terminal` 在原始碼 / scripts / 測試 / 文件中 grep 為 **0**（排除 `node_modules`、`_ct-workorders`、建置產物）
- [ ] AC-2 `npm run test:unit` 全綠，基線 **550**（不得減少）
- [ ] AC-3 `npx vite build` 成功
- [ ] AC-4 兩個 workflow YAML 語法有效（以 `node -e` + `js-yaml` 或 repo 既有可用工具 parse 成功；若本機有 `actionlint` 亦可跑）
- [ ] AC-5 在回報區列出：新步驟所在 job 名、`needs` 鏈、tag 運算式、`files:` 清單，並逐一對照 `server-bundle-download*.ts` 組出的 URL 證明資產檔名一致（**附上兩邊的程式碼行號**）
- [ ] AC-6 `git diff --stat` 僅動 `affects_files`

> **驗證 lane 說明**：本工單交付 source / build / test / YAML 靜態驗證。release 是否真的產出 `server-bundle-v0.5.9-pre.3`、資產能否下載、wizard 實機能否跑完，屬 CI / runtime lane，由塔台發版後驗收，**不在本工單**。

## Sub-session 執行指示

1. 讀取本工單全部內容 + `BUG-071` 檔尾複查段 + `_decision-log.md` D120
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 讀 `src/lib/arch-normalize.ts`、`src/lib/server-bundle-download-helpers.ts`、`electron/remote/server-bundle-download.ts`（URL 組法）
4. 讀 `pre-release.yml` / `release.yml` 的 `prepare` / `server-bundle-manifest` / `release` job 全段，與 `build-server-bundle.yml` release job
5. 實作 Part A → B → C
6. 跑 AC-1 ~ AC-6
7. 填寫回報區、更新 `status` / `completed_at` / `updated_at`
8. commit（`git commit --only` 精確指定 `affects_files` 中實際改動的檔），訊息建議：`fix(server-bundle): auto-publish server-bundle-v* with desktop release; fix default base URL owner (T0365)`
9. 依 `auto-session: on` 協定通知塔台（`bat-notify.mjs`，**不加 `--submit`**）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（source / build / test / YAML 靜態驗證 lane 全 PASS；CI / runtime lane 依工單說明由塔台發 `v0.5.9-pre.3` 後驗收）

**落點檢查（Landing Zone）：WARN**
- C-0：frontmatter `repo` = **absent** → WARN "repo identity unavailable"；觀測 `basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：PASS（工單位於 REPO_ROOT 下）
- C-3：PASS（前 5 筆非萬用字元 entry 全部存在）
- C-2：工單無 `branch` 欄位，N/A；HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 執行環境：`CT_MODE=on`，BAT vars 在 PowerShell 可見

### 產出摘要

**Part A — 預設網址 owner**（`anthropics` → `gowerlin`，網址格式不變）
- `src/lib/arch-normalize.ts:28` `DEFAULT_RELEASE_BASE_URL`
- `scripts/fetch-baseline-tarball.mjs:30`（檔頭註解）、`:217`、`:319`
- `src/lib/__tests__/server-bundle-download.test.ts:29`、`:58` 斷言

**Part B — desktop workflow 自動發佈 `server-bundle-v<版號>`**
- `.github/workflows/pre-release.yml:268-291`、`.github/workflows/release.yml:258-283`：在既有 `release` job 內、desktop release step **之後**新增 `Create server bundle release` step
- 選「同 job 內接在 desktop release step 後」而非另開 job 的理由：`release.yml` 的 `release` job 在 desktop release 後還有 `Update Homebrew tap`（正式版才跑，依賴 `TAP_GITHUB_TOKEN`，目標是 upstream 的 `tonyq-org/homebrew-tap`）。若另開 `needs: release` 的 job，Homebrew dispatch 一失敗就會連帶跳過 server bundle 發佈。放在 desktop release 與 Homebrew **之間**可避開這個耦合；兩檔採同一寫法維持一致
- 來源沿用 `release` job 既有的 `Download all artifacts`（不帶 name → 每個 artifact 落在 `artifacts/<artifact-name>/`），直接取 `artifacts/server-bundle-baseline/`，**不重建 tarball**
- `fail_on_unmatched_files: true`：任一資產缺失即 fail，不會發出缺 arch 的 release

**Part C — 文件**
- `CLAUDE.md`：「Server bundle baseline（PLAN-031）」節的 `Server bundle release（獨立 tag）` 改寫，並新增「預設下載來源」條目；「Server bundle 是獨立 tag 線」節補 D120 段落（desktop 線自動發佈、GITHUB_TOKEN 建的 tag 不會觸發 `build-server-bundle.yml`、手動線保留為備援）；「prerelease 標記與下游發佈」表格新增 `server-bundle-v<版號>` 一列，並**修正因本次插入而位移的行號**（Homebrew `:258-265`→`:285-292`、Chocolatey `:267-283`→`:294-310`）
- `docs/server-bundle-distribution.md`：Download 層補「發佈來源（D120）」條目（預設網址該文件原本即寫 gowerlin，無需改）
- `CHANGELOG.md` `## [Unreleased]` → `### Fixed` 新增一筆（refs: BUG-071, T0365, D120）

**Commit**：見下方「Commit」段

### 驗收條件逐項

- [x] **AC-1** PASS — `grep -rn "anthropics/better-agent-terminal" . --exclude-dir={node_modules,_ct-workorders,dist,dist-electron,release,dist-server,dist-baseline,.git}` → **0 筆**（CHANGELOG 用語也刻意避開完整字串）
- [x] **AC-2** PASS — `npm run test:unit`：`Test Files 41 passed (41)` / `Tests 550 passed (550)`（= 基線 550）
- [x] **AC-3** PASS — `npx vite build` exit 0
- [x] **AC-4** PASS — `js-yaml` 兩檔 parse 成功（pre-release jobs = `prepare,server-bundle,server-bundle-manifest,build,release`；release jobs 另含 `choco`）。另以 `go run github.com/rhysd/actionlint/cmd/actionlint@latest`（v1.7.12，`-shellcheck=`）掃描：**無語法 / 運算式錯誤**，僅 4 則 `the runner of "softprops/action-gh-release@v1" action is too old`——其中 2 則是既有 desktop release step（`pre-release.yml:253`、`release.yml:246`），屬既有狀況；工單明訂沿用 `@v1`，未升版（見遭遇問題）
- [x] **AC-5** PASS — 對照如下
- [x] **AC-6** PASS — `git diff --stat`（扣除既有 dirty 的 `AGENTS.md` 與本工單檔）僅 8 個 `affects_files`：`.github/workflows/pre-release.yml`、`.github/workflows/release.yml`、`CHANGELOG.md`、`CLAUDE.md`、`docs/server-bundle-distribution.md`、`scripts/fetch-baseline-tarball.mjs`、`src/lib/__tests__/server-bundle-download.test.ts`、`src/lib/arch-normalize.ts`

#### AC-5 對照

| 項目 | 內容 |
|------|------|
| 所在 job | `release`（兩檔同名；step 名 `Create server bundle release`） |
| `needs` 鏈 | `prepare` → `server-bundle`（3 arch matrix）→ `server-bundle-manifest`（上傳 `server-bundle-baseline`）→ `build` → `release`（`needs: [prepare, build]`）；step 順序：`Create Pre-Release` / `Create Release` → **`Create server bundle release`**（→ release.yml 再接 `Update Homebrew tap`）。前面任一 job 失敗則 `release` job 不執行；desktop release step 失敗則後續 step 預設跳過 ⇒ 無孤兒 release |
| tag 運算式 | `tag_name: server-bundle-v${{ needs.prepare.outputs.version }}`（`pre-release.yml:275`、`release.yml:267`）；`target_commitish: ${{ github.sha }}`（與 desktop release 同 commit）；`prerelease: true`；權限沿用 job 既有 `contents: write`（`pre-release.yml:240-241`、`release.yml:229-230`） |
| `files:` | `artifacts/server-bundle-baseline/` 下：`bat-server-{linux-x64,linux-arm64,darwin-arm64}-v<ver>.tar.gz` + 各自 `.sha256`（共 6）+ `manifest.json`（以完整版號寫死，不用 `v*` 萬用字元） |

**版號一致性**（為何 `needs.prepare.outputs.version` = runtime 用的 version）：
- `prepare` output `version` 為不帶 `v` 的值：`pre-release.yml:56`（`VERSION=${VERSION}`）/ `release.yml:20-21`（`VERSION="${TAG#v}"`）
- runtime version：`electron/remote/server-bundle-distributor.ts:249` `options.version ?? app.getVersion()`；`app.getVersion()` 來自 package.json，由 `scripts/build-version.js:20-21` 以 `VERSION` env 去掉前綴 `v` 寫入（`pre-release.yml:199` 傳 `v${version}`、`release.yml:160` 傳 `tag`）⇒ 與 `prepare.outputs.version` 相同
- tarball 檔名的版號：`server-bundle` job 先 `npm version ... "${{ needs.prepare.outputs.version }}"`（`pre-release.yml:89`、`release.yml:54`），`scripts/build-server-bundle.mjs:125` 組 `bat-server-${target}-v${version}.tar.gz`；manifest 產生器強制所有 tarball 版號 = `--version`（`scripts/generate-server-bundle-manifest.mjs:21` `TARBALL_RE`、`:102-107`）

**URL 對照**：

| runtime 組出的 URL | 程式碼 | release 上的資產 |
|---|---|---|
| base = `https://github.com/gowerlin/better-agent-terminal/releases/download/server-bundle-v${version}` | `src/lib/arch-normalize.ts:27-28` + `src/lib/server-bundle-download-helpers.ts:28`（`buildBaseURL`，`:29` 去尾斜線） | tag `server-bundle-v<ver>` |
| `${base}/manifest.json` | `electron/remote/server-bundle-download.ts:329-330` | `manifest.json` |
| `${base}/${entry.filename}`，`entry = manifest.tarballs[arch]` | `electron/remote/server-bundle-download.ts:365`、`:402`（`buildTarballURL`，helpers `:35-38`） | `entry.filename` 由 `scripts/generate-server-bundle-manifest.mjs:130`（`filename: entry`，即 baseline 目錄中的實際檔名）寫入 ⇒ 必為 `bat-server-<arch>-v<ver>.tar.gz`，與上傳資產同名；亦與 `src/lib/arch-normalize.ts:77` `tarballNameForArch` 一致 |
| `.sha256` | runtime 不另抓 sidecar，SHA 取自 manifest（`server-bundle-download.ts:472`） | 依工單規格仍上傳 3 份 `.sha256`（與 `build-server-bundle.yml:153-168` 一致） |

### 遭遇問題

- 無阻斷。
- ⚠️ **既有狀況（未處理，不在範圍）**：actionlint 指出 `softprops/action-gh-release@v1` 的 runner（node16）過舊。`pre-release.yml` 有 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`（:12）所以實際可跑；`release.yml` 沒有此 env，但既有 desktop release step 也同樣用 `@v1`，新 step 與它同命運。是否升 `@v2` 留給塔台決定。
- ℹ️ **跟進建議（塔台）**：`_ct-workorders/_local-rules.md:468` 表格寫 `build-server-bundle.yml` 「與 desktop release 解耦」，D120 後已不完全正確；該檔不在本工單 `affects_files`，未改。
- ℹ️ **發版時留意**：由 `GITHUB_TOKEN` 建立的 `server-bundle-v*` tag 依 GitHub 規則不會觸發 `build-server-bundle.yml`，不會重複發佈；若某次 server bundle step 失敗，可「Re-run failed jobs」重跑 `release` job（softprops 對既有 release 會更新），或改走手動 tag 備援線——同版號不要兩線都發。
- ℹ️ 使用者介入：無（fire-and-forget）。

### Commit

- `a295ec7` fix(server-bundle): auto-publish server-bundle-v* with desktop release; fix default base URL owner (T0365)
- 以 `git commit --only` 指定 8 個 affects_files；`AGENTS.md`（既有 dirty）與本工單檔未納入（工單檔留待塔台 close commit）
- **未 push、未推 tag、未觸發 workflow、未建立 release**（遵守 memory_overrides）

### 回報時間

2026-10-04T13:18:46+08:00
