---
schema_version: 1
schema_kind: workorder
id: T0495
title: "CI 加入 npm run typecheck 硬 gate（src/ 基線 0）"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-13T23:24:58+08:00"
started_at: "2026-10-13T23:28:40+08:00"
updated_at: "2026-10-13T23:31:41+08:00"
completed_at: "2026-10-13T23:31:41+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0486"
  - "T0494"
related:
  - "T0486 回報區「CI gate 建議」1（`typecheck` 立即可設硬 gate；放 Linux job 或獨立輕量 job）"
  - "CLAUDE.md「Packaging / Release 前置檢查」CI pipeline 順序"
affects_files:
  - ".github/workflows/pre-release.yml"
  - ".github/workflows/release.yml"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只新增 typecheck gate；既有 job / step 順序、條件、指令不變。typecheck 失敗必須讓發版失敗（release job 不得在 typecheck 失敗時執行）"
  - "🔴 `typecheck:electron` 本單**不**加入 gate（基線 77，由 T0496 清零後加入）"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；T0492 / T0496 之後也會改 workflows，本單須先完成"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況（`pre-release.yml` 工作樹為 CRLF）"
---

# T0495 — CI typecheck gate

## 實作

- 在 `pre-release.yml` / `release.yml` 加入 `npm run typecheck`，擇一並說明理由：
  - (a) 獨立輕量 job（`ubuntu-24.04`，`npm ci --ignore-scripts` + `npm run typecheck`），列為 `build`（或 `release`）的 `needs`
  - (b) 放在 Linux build job 的 `npm ci` 之後、`verify-native-modules.js` 之前
- 評估 `--ignore-scripts` 對 typecheck 是否足夠（型別只需套件的 `.d.ts`）；若用 (a)，確認不會拖慢關鍵路徑（並行於 server-bundle）
- 驗證：js-yaml 解析；`go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7` 0 筆；讀 workflow 的既有單元測試（`scripts/__tests__/verify-packaged-native.test.mjs` 等）通過；本機 `npm run typecheck` = 0

## 驗收條件

- [x] 兩個 workflow 都有 typecheck gate，失敗會阻擋 release（說明依賴鏈）
- [x] YAML / actionlint / 既有測試通過；`git diff --stat`
- [x] CLAUDE.md 建議文字（CI pipeline 順序段）；實跑留待 pre.5 CI

## Sub-session 執行指示

1. 讀本工單 + D139 + T0486 回報區 + 兩個 workflow
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。`pre-release.yml` / `release.yml` 各新增獨立 `typecheck` job（方案 a），並列入 `build.needs`。typecheck 失敗 → `build` skipped → `release`（與 `release.yml` 的 `choco`）skipped，不會發版。`typecheck:electron` 未加入（基線 77，留給 T0496）。

### Landing Zone

| 檢查 | 結果 | 說明 |
|---|---|---|
| C-0 repo | PASS | frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`） |
| C-1 path | PASS | 工單位於 REPO_ROOT 下 |
| C-3 affects_files | PASS（informational） | 兩個 workflow 皆存在 |
| C-2 branch | 不適用 | 工單無 `branch` 欄位；HEAD `main` |

`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只作紀錄）。開工時 status 為 `TODO`（skill 預期 `PENDING`），視同未開始。

### 選 (a) 獨立 job 的理由

- **不拖慢關鍵路徑**：`typecheck` 沒有 `needs`，從 t=0 起與 `prepare` → `server-bundle`（3 arch matrix）→ `server-bundle-manifest` 並行。`build` 本來就要等 manifest，而 typecheck 實測約 35 s（`npm ci --ignore-scripts` 24 s + `tsc` 10 s，本機），遠短於 server-bundle 鏈，不會延後 build 開始時間
- **fail-fast 省 runner 時間**：(b) 要等 server-bundle 鏈跑完、Linux build 跑完 `npm ci` + `@electron/rebuild` 才檢查，且 Windows / mac build 仍會照跑；(a) 失敗時三平台 build（最貴的部分）直接 skipped
- **型別結果與平台無關**：只跑一次即可，放在 ubuntu 最便宜
- 代價：server-bundle 仍會跑完（它不依賴 typecheck），但 `release` 被 skip 後不會發佈任何 release（含 `server-bundle-v<版號>`）

### 依賴鏈（typecheck 失敗如何阻擋發版）

```
typecheck ──┐
prepare → server-bundle → server-bundle-manifest ──┤
                                                    └→ build (needs: prepare, server-bundle-manifest, typecheck)
                                                         └→ release (needs: prepare, build)
                                                              └→ choco (release.yml，needs: build, release)
```

- `build` / `release` 沒有 job 層 `if:`，GitHub Actions 預設 `success()`：任一 needs 失敗或 skipped，下游即 skipped
- `release.yml` 的 `choco` 有 `if:`，但條件內沒有狀態函式（`always()` / `failure()` 等），仍隱含 `success()`，同樣 skipped
- 沒有把 `typecheck` 另加到 `release.needs`：經 `build` 遞移已足夠，維持既有行不變（工單「既有 job / step 不變」）

### `--ignore-scripts` 是否足夠：實測足夠

在 scratchpad 建 detached worktree @ `69a796a`（HEAD，乾淨、無他人 WIP），以本機 Node 24.21.0 / npm 12.2.0：

| 步驟 | 結果 |
|---|---|
| `npm ci --ignore-scripts` | exit 0，24 s |
| install scripts 確實沒跑 | `node_modules/electron/dist` 不存在、`node_modules/better-sqlite3/build` 不存在 |
| `npm run typecheck` | **exit 0**，10 s |
| 負向：加 `src/t0495-neg.ts`（`const x: number = 'not-a-number'`） | `error TS2322`，**exit 2**；刪檔後 exit 0 |

原因：`tsconfig.json` 只 include `src` / `src/types/*.d.ts` / `vitest.setup.ts`，型別來自套件內靜態的 `.d.ts`（如 `electron/electron.d.ts`、`@types/better-sqlite3`），不依賴 postinstall 產物；且 `skipLibCheck: true`。worktree 結束後已 `git worktree remove --force` + `prune`（列表中另一個 `t0488-wt` 屬 T0488，未動）。

CI 端 npm 為 Node 24 隨附的 11.19.0；`--ignore-scripts` 在 npm 11 / 12 行為相同（連根專案 `postinstall` 也略過，正好避開 electron-rebuild）。

### 改動檔案

```
 .github/workflows/pre-release.yml | 23 ++++++++++++++++++++++-
 .github/workflows/release.yml     | 23 ++++++++++++++++++++++-
 2 files changed, 44 insertions(+), 2 deletions(-)
```

- 兩檔相同改動：`prepare` 與 `server-bundle` 之間插入 `typecheck` job（checkout@v7 → setup-node@v7 node 24 + npm cache → `npm ci --ignore-scripts` → `npm run typecheck`，`runs-on: ubuntu-24.04`）；`build.needs` 加 `typecheck`
- 換行維持現況：`pre-release.yml` CRLF、`release.yml` LF（以腳本依檔案原 EOL 插入，`file` 確認未變）
- 既有 job / step 的順序、條件、指令皆未動

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| js-yaml 解析 | **PASS** | 兩檔皆可解析；jobs 順序 `prepare,typecheck,server-bundle,server-bundle-manifest,build,release[,choco]`；`build.needs = [prepare, server-bundle-manifest, typecheck]`；`release.needs = [prepare, build]`、`release.if` 未設定 |
| actionlint v1.7.7 | **PASS（0 筆）** | `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7` 兩檔 exit 0；不帶參數掃全部 workflows 也 exit 0 |
| 讀 workflow 的既有測試 | **PASS** | `npx vitest run scripts/__tests__/verify-packaged-native.test.mjs electron/__tests__/build-version.test.ts`：2 files / 48 passed |
| 本機 `npm run typecheck` | **PASS（0）** | 乾淨 worktree @ HEAD exit 0；主工作樹（含並行 WIP）exit 0 |
| CI 實跑 | **未執行** | 依工單不 push、不觸發 workflow；留待 pre.5 CI |

### CLAUDE.md 建議文字（由 T0493 套用）

「Packaging / Release 前置檢查」節的 **CI pipeline** 條目改為：

```markdown
- **CI pipeline**：`.github/workflows/pre-release.yml` 三平台 build job 依序為 `npm ci` → `@electron/rebuild` → `verify-native-modules.js` → `verify-helper-bundle.js`（在 `build-version.js` 開頭自動 require） → `build-version.js` → `electron-builder` →（mac / linux job）`verify-packaged-native.js` → 上傳 artifact。新增 CI job 時請沿用相同順序。
- **Typecheck gate**（T0495）：`pre-release.yml` / `release.yml` 有獨立 `typecheck` job（`ubuntu-24.04`，`npm ci --ignore-scripts` + `npm run typecheck`，無 `needs`，與 server-bundle 並行），列在 `build.needs`。typecheck 失敗 → `build` skipped → `release`（及 `choco`）skipped，不發版。`--ignore-scripts` 足夠：`tsc -p .` 只讀套件內的 `.d.ts`（T0495 實測無 electron `dist/` / better-sqlite3 `.node` 時 exit 0）。`typecheck:electron` 尚未加入（基線 77，T0496 清零後加入同一 job）。改 `tsconfig.json` 的 `include` 或新增依賴 postinstall 產物的型別時，先以 `npm ci --ignore-scripts && npm run typecheck` 確認。
```

（若 T0493 一併採用 T0486 建議的「型別檢查」新節，可在該節加一句「CI 以 `typecheck` job 強制，見 Packaging / Release 前置檢查」。）

### 偏差 / 備註

- 未改 CLAUDE.md（依 D139）
- `release.yml` 頂層沒有 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env（`pre-release.yml` 有）；T0487 已把 actions 升到原生 node24 版，影響不大。範圍外，只記錄
- `server-bundle-manifest` 仍是 `ubuntu-22.04`（tower-state 已列 2027-04-17 停用議題），範圍外未動

### 給 T0496 的接點

- 把 `typecheck:electron` 加入同一個 `typecheck` job 的第三步（`- name: Typecheck (electron/)` / `run: npm run typecheck:electron`）即可，依賴鏈不用改；`tsconfig.node.json` 的 include 是否需要 postinstall 產物，加入前比照本單以 `npm ci --ignore-scripts` 驗證

### Commit

- `git commit --only` 兩個 workflow + 本工單；不 push。hash 見 `git log`（本回報寫於 commit 前）
