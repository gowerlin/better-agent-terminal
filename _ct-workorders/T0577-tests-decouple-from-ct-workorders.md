---
schema_version: 1
schema_kind: workorder
id: T0577
title: "PLAN-047 T：產品測試不再讀真實 `_ct-workorders/` 檔案（parser-parity 樣本改 fixture）"
type: refactor
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-17T19:04:59+0800"
started_at: "2026-10-17T19:07:58+0800"
updated_at: "2026-10-17T19:13:13+0800"
completed_at: "2026-10-17T19:13:13+0800"
depends_on: []
related:
  - "PLAN-047、T0574 回報區 R5（sparse-checkout 排除 `_ct-workorders/` 後 `parser-parity.test.ts` 5 個測試失敗）"
  - "L133（產品測試讀真實工單檔 → 塔台搬檔 commit 前必跑 test:unit；本單完成後塔台會放寬此規則）"
affects_files:
  - src/types/__tests__/parser-parity.test.ts
  - "src/types/__tests__/fixtures/**（新增）"
  - "其他 grep 出來直接讀取 repo `_ct-workorders/` 真實檔案的測試（若有）"
  - _ct-workorders/T0577-tests-decouple-from-ct-workorders.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 只改測試與 fixture，不改產品程式碼（`src/types/*.ts` parser 本身不動）；不改 `_ct-workorders/` 內任何檔案（本工單除外）；`_local-rules.md` 是塔台私有檔，不要改，L133 的放寬由塔台處理。"
  - "🔴 本單與 T0575 並行執行，T0575 改 `electron/**` 與 `CLAUDE.md`；本單不得碰這些檔案。"
---

# T0577 — 產品測試與 `_ct-workorders/` 解耦

## 背景

`src/types/__tests__/parser-parity.test.ts` 以 `join(process.cwd(), '_ct-workorders')` 讀真實工單檔（T0335 / T0336 / T0337 / BUG-081 / PLAN-033 等樣本，熱區找不到再找 `_archive/`）。後果：

- PLAN-047 的 worktree 方案若排除 `_ct-workorders/`（sparse-checkout），這 5 個測試失敗（T0574 R5 實測）。
- 塔台 `*archive` / 改名 / 刪除工單會牽動產品測試（L133）。

## 任務

1. 把 parser-parity 的樣本複製成 fixture（例如 `src/types/__tests__/fixtures/ct-workorders/`），**逐字複製**現有樣本檔（保持測試語意：frontmatter 路徑與舊 markdown 路徑的 id / status 一致性）；測試改讀 fixture，不再讀 repo 的 `_ct-workorders/`。fixture 只需要測試用到的檔案。
2. grep 全部測試（`src/**`、`electron/**`、`scripts/**`、`e2e/**` 的 `*.test.*` / `*.spec.*`）是否還有其他讀取 repo **真實** `_ct-workorders/` 檔案的地方；有的話一併改 fixture。只把字串當路徑名用、或用記憶體假資料的（例如 `control-tower-panel-toasts.test.tsx`）不需要動，在回報區列出判斷。
3. 更新測試檔頭註解（移除「Tower `*archive` moves files there regularly …」那段依賴說明，改述 fixture 來源與更新方式）。

## 驗收條件

1. `npm run test:unit` 全綠，測試數與修改前相同（列出修改前 / 後數字）。
2. 實證解耦：在 repo 外暫存 clone（`git clone --no-hardlinks`，Windows 加 `-c core.longpaths=true`；腳本 `set -e`，git 寫入前斷言 `git rev-parse --git-common-dir` 不在主 repo，L155）上以 sparse-checkout 排除 `/_ct-workorders/` 後，跑 `npx vitest run src/types/__tests__/parser-parity.test.ts`（以及任務 2 改到的測試）全綠；暫存 clone 用完刪除。若 clone 內 `npm ci` 成本過高，可改為把 fixture 路徑與 `_ct-workorders/` 暫時隔離的等價證明，在回報區說明。
3. `npm run typecheck` = 0。
4. 回報區列出任務 2 的 grep 結果與判斷。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

- 狀態：**DONE**
- `parser-parity.test.ts` 改讀 `src/types/__tests__/fixtures/ct-workorders/` 的 5 個樣本（T0335 / T0336 / T0337 / BUG-081 / PLAN-033），不再讀 repo 的 `_ct-workorders/`。樣本以 `git show HEAD:<原路徑>` 逐字複製，`git hash-object` 與原 blob 完全相同（例 T0335 `599732e3…`、PLAN-033 `45c2b249…`）。fixture 採平面目錄（原熱區 / `_archive/<kind>s/` 雙路徑查找已不需要，一併移除）。
- 測試檔頭註解改述 fixture 來源（T0577）與更新方式（`git show HEAD:<path> > fixtures/ct-workorders/<name>` + 列入 SAMPLES），移除「Tower `*archive` moves files there regularly …」依賴說明；找不到樣本時的錯誤訊息改為指出 fixture 路徑。路徑用 `__dirname`（與 `src/components/__tests__/*` 既有寫法一致），不依賴 cwd。
- 產品程式碼（`src/types/*.ts` parser）、`_ct-workorders/` 其他檔案、`electron/**`、`CLAUDE.md`、`_local-rules.md` 皆未動。

### Landing Zone Check

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）→ PASS
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`src/types/__tests__/parser-parity.test.ts` 存在 → present（萬用字元 / 敘述項略過）
- C-2：無 `branch` 欄位（工作於 `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 任務 2：grep 結果與判斷

指令：`grep -rln "_ct-workorders" src electron scripts e2e --include='*.test.*' --include='*.spec.*'`，另以 `workorders` / `_archive/(workorders|bugs|plans)` / `'_ct'` 補查間接組路徑。

| 檔案 | 用法 | 判斷 |
|---|---|---|
| `src/types/__tests__/parser-parity.test.ts` | `join(process.cwd(), '_ct-workorders')` 讀真實檔 | **唯一真實讀取者** → 本單改 fixture |
| `src/components/__tests__/control-tower-panel-toasts.test.tsx` | 記憶體 Map 模擬 `${ws}/_ct-workorders` 與 `diffWorkOrders(null, '/a/_ct-workorders', …)` | 只當路徑字串 / 假資料，不動 |
| `scripts/__tests__/asar-runtime-deps.test.mjs:173` | `'_ct-workorders/T0546-installer-slim-stage1.md'` 餵給 electron-builder matcher 斷言「不打包」 | 只當路徑字串，不讀檔（檔案不存在也成立），不動 |
| `src/types/__tests__/backlog.test.ts`、`bug-tracker.test.ts` | `'_archive/plans/PLAN-100-legacy.md'` 等作為 `parsePlanFile` / `parseBugFile` 的 filename 參數，內容為檔內常數 | 記憶體假資料，不動 |
| `src/types/__tests__/control-tower.test.ts` | 只在測試名稱出現 `workorders` | 無關 |

e2e（`e2e/**`）無命中。

### 驗收

1. `npm run test:unit` 全綠：修改前 **266 files / 4645 passed / 3 skipped（4648）**；修改後 **266 files / 4645 passed / 3 skipped（4648）**，相同。（T0575 並行中；兩次執行時 `electron/**` 皆無其變更進入計數差異。）
2. 實證解耦（腳本 `set -e`，於 scratchpad）：`git -c core.longpaths=true clone --no-hardlinks --no-checkout <main> t0577-clone` → 斷言 clone 的 `git rev-parse --git-common-dir` = `<clone>/.git` ≠ 主 repo `.git` 後才做 git 寫入 → `sparse-checkout init --no-cone`、規則 `/*` + `!/_ct-workorders/` → checkout `58ec1046`，確認 `_ct-workorders` 不存在、fixture 5 檔在。未跑 `npm ci`：以 junction 把 clone 的 `node_modules` 指向主 repo `node_modules`（只讀用途）。
   - 新測試 `npx vitest run src/types/__tests__/parser-parity.test.ts` → **5 passed**
   - 對照：同 clone 放入修改前版本（`git show HEAD~1:…` 另存 `parser-parity-old.test.ts`）→ **5 failed**（`Sample T0335-… not found in any of: …`），重現 T0574 R5
   - clone 全套 `npx vitest run` → 266 files / 4642 passed / 6 skipped（4648）；多出的 3 skipped 為 `asar-runtime-deps.test.mjs` 的 `skipIf(!distBuilt)`（clone 沒有 `dist-electron/`），非失敗
   - 清理：先 `cmd /c rmdir` 移除 junction（只移除連結，確認主 repo `node_modules/vitest/package.json` 仍在），再刪除整個 clone，確認已不存在
3. `npm run typecheck` = 0
4. 見上表

### 變更檔案

- `src/types/__tests__/parser-parity.test.ts`
- `src/types/__tests__/fixtures/ct-workorders/T0335-fix-bug074-ssh-input-step-awaiting-input.md`（新增）
- `src/types/__tests__/fixtures/ct-workorders/T0336-fix-bug073-docker-detect-env-mapping-preflight.md`（新增）
- `src/types/__tests__/fixtures/ct-workorders/T0337-fix-bug072-wsl-linger-systemd-mapping.md`（新增）
- `src/types/__tests__/fixtures/ct-workorders/BUG-081-bat-notify-submit-enters-multiline-instead-of-submit.md`（新增）
- `src/types/__tests__/fixtures/ct-workorders/PLAN-033-tower-state-snapshot-archive-architecture.md`（新增）
- 本工單

### Commit

- `58ec1046` test: parser-parity reads fixture copies instead of _ct-workorders (T0577)（`git commit --only`，未含 `src/styles/settings.css` 與 T0575 工單）
- 本工單結案 commit 另提交；未 push

### 偏差 / 備註

- 原樣本工作區檔案有 3 個為 CRLF/LF 混合（`git ls-files --eol` 顯示 `w/mixed`），但 index 為 LF；fixture 取自 HEAD blob（LF），與 `.gitattributes` `eol=lf` 一致，parity 測試結果不變。
- 建議塔台：L133 / `_local-rules.md:205,207` 的「產品測試讀真實工單檔」說明可放寬（本單範圍外，未改）。
