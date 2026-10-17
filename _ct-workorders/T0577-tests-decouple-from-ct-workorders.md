---
schema_version: 1
schema_kind: workorder
id: T0577
title: "PLAN-047 T：產品測試不再讀真實 `_ct-workorders/` 檔案（parser-parity 樣本改 fixture）"
type: refactor
status: PENDING
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-17T19:04:59+0800"
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
