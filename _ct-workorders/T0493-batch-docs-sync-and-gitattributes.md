---
schema_version: 1
schema_kind: workorder
id: T0493
title: "批次收尾：套用 T0484-T0492 回報的 CLAUDE.md / README 建議文字 + 新增 .gitattributes（LF 存庫）+ fsevents 不列 allowScripts 的記錄"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-13T23:13:05+08:00"
started_at: "2026-10-14T01:10:06+08:00"
updated_at: "2026-10-14T01:19:02+08:00"
completed_at: "2026-10-14T01:19:02+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0484"
  - "T0485"
  - "T0486"
  - "T0487"
  - "T0488"
  - "T0489"
  - "T0490"
  - "T0491"
  - "T0492"
  - "T0494"
  - "T0495"
  - "T0496"
  - "T0497"
  - "T0498"
  - "T0499"
  - "T0500"
  - "T0501"
  - "T0502"
  - "T0503"
  - "T0504"
  - "T0505"
  - "T0506"
  - "T0507"
  - "T0508"
  - "T0509"
related:
  - "T0484-T0492 回報區「CLAUDE.md 建議文字」"
  - "T0454 回報區 `.gitattributes` 評估（index 全 LF、renormalize 預期 0 檔；建議 `* text=auto eol=lf`、`*.png binary`、`*.ico binary`）"
  - "D139（fsevents：比照 electron-winstaller 不列入 allowScripts）"
affects_files:
  - "CLAUDE.md"
  - "README.md"
  - "docs/"
  - ".gitattributes"
  - "project-context.md"
  - "scripts/verify-native-modules.js"
  - "scripts/__tests__/verify-native-modules.test.mjs"
  - "src/types/electron.d.ts"
  - "electron/preload.ts"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權改 `CLAUDE.md`"
  - "🔴 `.gitattributes`：新增後執行 `git add --renormalize .` 檢查——預期 0 個內容變更；若有任何檔案被 renormalize，**不 commit `.gitattributes`**，回報清單交塔台"
  - "🔴 不對使用者工作樹做重新 checkout / reset（既有工作樹的 CRLF 不處理，只在回報區說明）"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0493 — 批次收尾：套用 T0484-T0492 回報的 CLAUDE.md / README 建議文字 + 新增 .gitattributes（LF 存庫）+ fsevents 不列 allowScripts 的記錄

## 實作

1. 讀 T0484-T0492 回報區，套用其 CLAUDE.md / README / docs 建議文字（與程式碼現況有出入時以程式碼為準並列出）
2. `.gitattributes`（T0454 建議內容）+ renormalize 檢查（見 memory_overrides）
3. CLAUDE.md「本機開發：npm 12 install scripts」補 fsevents：mac 上 npm 12 會擋 `fsevents` install script，刻意不列入 `allowScripts`（理由比照 electron-winstaller：寫 `false` 會改變 npm 11 / CI 行為；fsevents 為 optional、mac 開發一般不受影響）
4. 全 repo grep 確認本批改動後無過期描述（tsc 基線數字、better-sqlite3、Actions 版本、runner、Haiku 計價等）

5. T0492 範圍外發現：`project-context.md:42`、`:84`（better-sqlite3 / 本地 SQLite 描述）改寫或刪除；`scripts/verify-native-modules.js` `INSTALL_SCRIPTS_DOC` 與 CLAUDE.md 實際標題「本機開發：npm 12 install scripts（T0471 / T0473）」對齊（含其測試斷言）；CLAUDE.md「Server bundle baseline」補 T0492 三項（dist-baseline 清理、bundle 不含 `.bin` + 絕對 symlink 檢查、snapshot 版號 fallback）

6. T0496 範圍外：`src/types/electron.d.ts` / `electron/preload.ts` 的 `docker.startContainer` 回傳型別 `token?: string` 改為 `token?: string | null`（main 端實際可能回 `null`；renderer 用法對 null 安全，`npm run typecheck` 維持 0）
7. Custom CLI Agents 持久化（T0496 修 `fs.promises` 誤用）：CLAUDE.md 若有相關描述則補註；實機驗收清單（pre.5）列入「Settings 新增 custom CLI → 重啟仍在」

## 驗收條件

- [x] 各工單建議文字的套用對照表（工單 → 段落 → 處置）
- [x] `.gitattributes` renormalize 結果；`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 1. 結果

**DONE**。T0484–T0509 回報區的 CLAUDE.md 建議文字全部對照程式碼現況後套用（D139 讓 T0494–T0509 也把建議交給本單，depends_on 已列入，所以一併處理）；`.gitattributes` 已新增，renormalize 0 檔，可以 commit；fsevents 不列 `allowScripts` 的理由已寫進 CLAUDE.md；T0492 / T0496 範圍外的項目（project-context、`INSTALL_SCRIPTS_DOC`、`startContainer` 型別）都已處理。`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠、`npx vite build` 成功。

### 2. 套用對照表（工單 → 段落 → 處置）

| 工單 | CLAUDE.md 段落 | 處置 |
|---|---|---|
| T0484 | Claude Agent SDK / CLI 第 3 點（`BAT_BUILTIN_MODELS`）末尾 | 套用（`estimateModelLimits` / `MODEL_LIMITS`、測試檔名已核對） |
| T0484 | 同節第 4 點計價段 | 套用：把「面板未傳 `promptTokens`」那句換成 `estimateCallCost` / `estimateModelUsageCost` / `longPrompt` 的說明 |
| T0485 | Logging：新增「啟動期日誌」項；單一 userData 規則 ① import 清單；macOS PATH 修正 | 套用。bootstrap 的 import 已核對：`electron` / `path` / `./early-crash-log` / `./early-path-fix` / `./logger` / `./userdata-migration` |
| T0486 + T0496 | 新節「Type check」（放在 Frontend unit tests 後面） | 套用。依 T0496 把 electron 基線改成 **0**（不寫 T0486 原本的 77），加上 `registerHandler` 泛型與 CI 說明；script 內容已和 `package.json` 核對 |
| T0487 + T0494 | npm 12 install scripts 節，「CI」後面新增「CI actions / runner 版本」 | 套用。action 版本全數核對過（checkout@v7 ×13、setup-node@v7 ×11、upload@v7 ×12、download@v8 ×9、gh-release@v3 ×5、repository-dispatch@v4 ×1）；server-bundle runner 補上 `macos-15` |
| T0488 | Server bundle baseline：「baseline 版號」 | 套用並修正：`stripSnapshotSuffix` 的 SoT 已在 T0492 移到 `src/lib/snapshot-version.ts`，原建議寫「build-version.js 同檔 SoT」已過期；`release.ps1` 加上實際路徑 `.vscode/scripts/release.ps1` |
| T0489 / T0500 / T0502 | — | 原單寫「無需更新」，不套用 |
| T0490 + T0497 + T0499 + T0501 | 遠端 Tower 通知：「helper 回應必須以 frame id 比對」 | 合併成一條後套用（`waitForMessageById` / `waitForMessage`、`acceptType`、`#pending`、helper 測試的 log 隔離），兩支 helper 的程式碼都核對過 |
| T0491 | 新節「Detached workspace 視窗的持久化」（放在 Logging 後面） | 套用。修正：`loadDetachedWorkspace` 在 `electron/main.ts`，不在 window-registry |
| T0491 | PLAN-039：remote 失敗對話框三語 | 套用（兩個函式都在 `electron/remote/remote-profile-error.ts`） |
| T0492 | Server bundle baseline：舊版 baseline 清理、`.bin` / 絕對 symlink、snapshot fallback 版號 | 套用（`pruneStaleBaselines`、`build-server-bundle.mjs:323`、`verify-server-bundle.js:136`、distributor `:254` 都核對過） |
| T0494 | Server bundle baseline：runner 與最低 OS | 套用並修正：原文寫「sharp…npm prebuilt」「better-sqlite3 走 prebuild-install」，但 T0492 已移除 better-sqlite3、T0503 已把 sharp 移出 bundle，改寫成「bundle 已沒有需要在 runner 上編譯的套件」；補上 README 的下限那一行 |
| T0495 + T0496 | Packaging：新增「Typecheck gate」 | 套用，依 T0496 改成同一個 job 跑兩個 typecheck（已核對 `pre-release.yml:61-80` 和 `build.needs`）；`typecheck` job 確實沒有 `needs` |
| T0498 | 計價段之後新增 Cache History 一項 | 套用（`src/lib/cache-history.ts`、`resetQueryUsage`、`lastCall` 都核對過） |
| T0503 | Electron Runtime、allowScripts、universal 注意事項、server bundle | 四處都套用（sharp 是 devDependency、`asarUnpack` 沒有 `@img`、`verify-server-bundle.js:208` 禁止它們，都核對過）；server bundle 那條併進「bundle 內容限制」 |
| T0504 + T0508 | Detached 節：關窗前 flush、quit 對話框與再 detach | 套用，T0504 的「app quitting 時跳過」依 T0508 改成精確條件（`quitFlushStarted`）；驗證檔清單合併 |
| T0505 | Remote 資安：SSH target 與 user | 套用（regex 與 `ssh-args.ts:53` 一致，`id -un` 在 `ssh-start-server.ts:396`） |
| T0506 | — | 無建議文字 |
| T0507 | — | 原單是選配（CLAUDE.md 沒有 wizard 章節），不套用，以免只為一行新增一節 |
| T0508 | Frontend unit tests：fake timers 下不要用 `vi.waitFor` | 套用 |
| T0509 | PLAN-039：profile index 序列化 | 套用。精確寫成「重試 6 次、共 7 次嘗試」（`INDEX_RENAME_RETRY_DELAYS_MS` 有 6 個值） |
| D139（實作 3） | npm 12：新增 fsevents 不列入 | 套用。lock 核對：`node_modules/fsevents` 2.3.2 與 `vite/node_modules/fsevents` 2.3.3，都是 dev + optional + darwin + `hasInstallScript` |

### 3. 實作 5–7

- `project-context.md`：刪掉 `:42` 的 better-sqlite3 列；`:84`「本地 SQLite 儲存」改成「本地 JSON 持久化（`settings.json` / `windows.json` / `profiles/` 等，皆在 userData；不使用資料庫）」
- `INSTALL_SCRIPTS_DOC` 和測試斷言改成 `本機開發：npm 12 install scripts（T0471 / T0473）`，和 CLAUDE.md 標題一致
- `docker.startContainer` 的回傳 `token?: string | null`（`src/types/electron.d.ts:432`、`electron/preload.ts:542`；options 的 `token?: string` 沒動）
- **偏差（超出 affects_files 1 檔）**：工單的前提「renderer 用法對 null 安全」不成立。改型別後 `npm run typecheck` 出現 1 個錯誤：`src/components/setup-wizard/steps/docker/start-server.ts(114,5): TS2322 'string | null | undefined' → 'string | undefined'`。restart 分支在 `stateToken` 不存在、main 回 `token: null` 時，`ctx.remoteToken` 會被設成 `null`。我在 `:114` 加上 `?? undefined` 把 null 正規化成 undefined，並加一行註解。行為只在這個 null 情境下改變（null → undefined，下游都是 `typeof === 'string'` 判斷）。setup-wizard 測試 33 files / 445 passed
- 實作 7：CLAUDE.md 沒有 Custom CLI Agents 的描述，不補。**pre.5 實機驗收清單請塔台列入**：「Settings → Custom CLI Agents 新增一個 custom CLI → 重啟 BAT 仍在（`<userData>/custom-clis.json` 出現）」（本單沒有去改塔台的 `_tower-state.md`）

### 4. 全 repo 過期描述 grep（實作 4）

範圍：`CLAUDE.md`、`README*.md`、`project-context.md`、`docs/`。關鍵字：`基線 77`、`better-sqlite3` / `sqlite`、`macos-14`、`ubuntu-latest`、舊 action major（checkout/setup-node/upload ≤v6、download ≤v7、gh-release v1/v2、dispatch ≤v3）、`未傳 promptTokens`、`sharp / @img`、`.bin/`、`haiku`、`typecheck`、`glibc`。
結果：剩下的命中都是刻意保留的歷史敘述（「better-sqlite3 隨套件於 T0492 移除」、「原 `macos-14`」、「不用 `ubuntu-latest`」）；README / docs / project-context 沒有過期描述。

### 5. `.gitattributes` 與 renormalize

內容照 T0454 建議：

```
* text=auto eol=lf
*.png binary
*.ico binary
```

- renormalize 檢查：為了不動真正的 index（並行規則），把 `.git/index` 複製到 scratchpad，用 `GIT_INDEX_FILE=<copy> git add --renormalize .` 跑完，再比較前後的 `git ls-files -s`。有差異的路徑**只有本單已修改的 7 個檔**（CLAUDE.md、本工單、preload、project-context、兩個 verify-native-modules 檔、electron.d.ts，這些差異是內容修改本身，工作樹都是 LF）→ **renormalize 0 檔**，所以 `.gitattributes` 一起 commit
- 套用後 `git ls-files --eol`：2331 個 `attr/text=auto eol=lf`、15 個 `attr/-text`（14 png + 1 ico）；`_ct-workorders/T0293-review-report.md` 仍被內容判定為 `-text`，不會被轉換
- 套用後 `git status` 只列出本單的檔案，沒有任何檔案被誤判為已修改
- **既有工作樹的 CRLF 不處理**（依 memory_overrides，沒有 checkout / reset）：目前有 1177 個檔案在工作樹是 CRLF（系統 `core.autocrlf=true` 留下的）。`eol=lf` 會蓋過 autocrlf，之後**新 checkout / 新 worktree** 的檔案是 LF；既有檔案要等它下次被 git 重寫（或使用者自行 renormalize 工作樹）才會變成 LF。add CRLF 檔時 git 會轉成 LF 存庫，index 的內容不變
- 影響：T0454 記錄的「CRLF checkout 下 scripts 測試失敗」這類問題，在新 checkout 不會再發生；`git -c core.autocrlf=false archive` 這種繞道（T0503）之後不需要了

### 6. 驗收

| 分道 | 結果 | 證據 |
|---|---|---|
| docs / source 對照 | PASS | 第 2 節，每條都 grep 過程式碼 |
| `npm run typecheck` | PASS（0） | 修 start-server 前 1 個錯誤（見第 3 節），修後 `error TS` 計數 0 |
| `npm run typecheck:electron` | PASS（0） | `error TS` 計數 0 |
| verify-native-modules 測試 | PASS | `scripts/__tests__/verify-native-modules.test.mjs` 20 passed |
| `npm run test:unit` | PASS | `Test Files 204 passed (204)`、`Tests 3455 passed \| 1 skipped (3456)` |
| `npx vite build` | PASS | renderer 4.63 s、electron 1.20 s、preload ✓ |
| renormalize | PASS（0 檔） | 第 5 節 |
| runtime / 實機 | 未做 | 本單改的是文件與型別；沒有啟動 source build |

`git diff --stat`（commit 前，不含工單；另有新檔 `.gitattributes` 3 行）：

```
 CLAUDE.md                                          | 47 +++++++++++++++++++---
 electron/preload.ts                                |  2 +-
 project-context.md                                 |  3 +-
 scripts/__tests__/verify-native-modules.test.mjs   |  2 +-
 scripts/verify-native-modules.js                   |  2 +-
 .../setup-wizard/steps/docker/start-server.ts      |  3 +-
 src/types/electron.d.ts                            |  2 +-
 7 files changed, 48 insertions(+), 13 deletions(-)
```

### 7. Landing check

- **PASS**。C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1：工單在 REPO_ROOT 底下；C-3：`CLAUDE.md` / `README.md` / `docs/` 等都存在；C-2：沒有 `branch` 欄位（目前在 `main`）
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 8. Commit / 互動 / 偏差

- `git add .gitattributes`（新檔必須先追蹤，`--only` 才認得）後，用 `git commit --only` 提交本單 9 個檔（CLAUDE.md、`.gitattributes`、project-context.md、兩個 verify-native-modules 檔、electron.d.ts、preload.ts、start-server.ts、本工單）；沒有 push、沒有觸發 workflow、沒有建 tag；`tmp/` 沒有納入
- 開工時工作樹只有 `tmp/`（未追蹤），沒有其他 Worker 的 WIP
- 工單起始 `status: TODO`（不是 `PENDING`），照規則改成 `IN_PROGRESS`
- 無使用者互動（`CT_INTERACTIVE=0`）
- 偏差：start-server.ts 超出 affects_files（理由見第 3 節）；T0507 選配文字沒有套用
- 換行：全部維持各檔現況（都是 LF，`git ls-files --eol` 核對過）
