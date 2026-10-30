---
schema_version: 1
schema_kind: workorder
id: T0711
title: "指揮塔總覽：CT 同時以 zip 與 plugin 安裝時提示實際生效的是哪一份（T0710 3-4）"
type: implementation
status: DONE
repo: better-agent-terminal
project: ""
priority: P3
sizing: S
created_at: "2026-10-30T13:57:15+0800"
started_at: "2026-10-30T13:58:39+0800"
updated_at: "2026-10-30T14:04:34+0800"
completed_at: "2026-10-30T14:04:34+0800"
depends_on: []
related:
  - "T0710 回報區〈3-4 評估〉（偵測方式、提示位置、建議文字，本單照它做）"
  - "BMad-Guide HANDOVER § 3-4（`D:/ForgejoGit/@Gower_Labs/BMad-Guide/_ct-workorders/_handover-2026-10-30-bat-ct-plugin-install-detection.md`）"
  - "CLAUDE.md「指揮塔總覽（T0701，D184）」節、`docs/agent-guide/ct-plugin-install.md`、`docs/agent-guide/ct-tower-overview.md`"
affects_files:
  - electron/ct-install-detect.ts
  - electron/handlers/ct-config.ts
  - src/types/ct-config-sources.ts
  - src/components/TowerOverview.tsx
  - "src/lib/ct-tower-overview.ts（只在需要純函式整理顯示資料時）"
  - "src/components/ControlTowerPanel.tsx（只在要把新欄位傳給 TowerOverview 時）"
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json"
  - "測試：electron/__tests__/（ct-install-detect、ct-config-sources）、src/components/__tests__/ 或 src/lib/__tests__/（總覽）"
  - docs/agent-guide/ct-plugin-install.md
  - docs/agent-guide/ct-tower-overview.md
  - _ct-workorders/T0711-ct-dual-install-notice.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 偵測唯一實作在 `electron/ct-install-detect.ts`（T0710 建立），新增一個函式回報 Claude 與 Codex 各自的安裝狀況：手動安裝（有無、版號）、`ct@*` plugin（有無、版號、marketplace）。版號來源：手動取 `control-tower/SKILL.md` 的 `<!-- control-tower-version: x.y.z -->` 註解；plugin 取 `installed_plugins.json` 的 `version` 或 cache 目錄的版本段。讀不到版號 = `null`，不是錯誤。不新增依賴、不丟例外、路徑規則沿用 T0710（`CODEX_HOME` / `CLAUDE_CONFIG_DIR` / `CLAUDE_CODE_PLUGIN_CACHE_DIR`）。"
  - "🔴 傳遞：併進既有 `ct:read-config-sources` 回傳，新增**選填**欄位（例 `installs`），不另開 channel。舊 bat-server 沒有這個欄位 → 總覽不顯示提示，不報錯。不得改動既有欄位的名稱、型別或語意（T0701 契約）。遠端照 T0701 在回答主機判斷。"
  - "🔴 顯示：只在同一個 agent（Claude 或 Codex）**同時有**手動與 plugin 安裝時，在總覽 `*config` 區塊「預設」層來源那一行底下顯示一行。版號不同 → 警示樣式；相同或任一讀不到 → 資訊樣式。文字意思：「CT 同時以 zip（v<手動版號>）與 plugin（v<plugin 版號>）安裝；`/ct-exec`、`$ct-exec` 使用的是 zip 那份。要改用 plugin，請移除手動安裝的 ct-* skill 目錄」（Claude / Codex 各自顯示、各自寫明是哪個 agent；讀不到版號就省略版號）。只裝一種時不顯示任何東西。文字走 i18n（三個 locale）。"
  - "🔴 唯讀：不改、不刪任何安裝檔或設定檔；不加按鈕替使用者移除。"
  - "🔴 範圍：不改 `CLAUDE.md`（T0712 同時在改）、不改 `vite.config.ts` / `vitest.setup.ts` / `package.json`；不改 T0710 的派工判斷結果。"
  - "🔴 驗證：單元測試涵蓋：只手動 / 只 plugin / 兩種都裝同版 / 兩種都裝不同版 / 版號讀不到 / 舊 server 沒有欄位；總覽 RTL 測試看提示出現與不出現。`npm run test:unit` 全綠（本機若為 Node 26，`copy-remote-path.test.tsx` 的 2 項失敗屬 T0712 範圍，可用 `NODE_OPTIONS=--no-webstorage` 跑全套並在回報區寫明）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功。"
  - "🔴 文件：細節補在 `docs/agent-guide/ct-plugin-install.md`（3-4 已實作）與 `docs/agent-guide/ct-tower-overview.md`（總覽新顯示）。"
  - "🔴 Git：`git commit --only <檔案>`，只 commit 本單 `affects_files`；不 push、不觸發 workflow、不建 tag。T0712 同時在 repo 內工作。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。工單完成狀態寫 `DONE`。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，範例路徑用 `C:\\Users\\demo`、`/Users/tester`。yolo：不得問使用者，判讀問題問塔台（每輪最多 3 題）。"
---

# T0711 — 指揮塔總覽：CT 兩種安裝並存時提示

## 背景

CT 同時以 zip（手動）與 plugin 安裝時，`/ct-exec`、`$ct-exec` 用的是手動那份，可能是舊版，使用者看不出來。T0710 已有偵測兩種安裝的路徑規則，本單把結果顯示在指揮塔總覽。做法照 T0710 回報區〈3-4 評估〉。

## 驗收

- [ ] 偵測集中在 `electron/ct-install-detect.ts`
- [ ] 經 `ct:read-config-sources` 新增的選填欄位傳遞，既有欄位不變；舊 server 不顯示、不報錯
- [ ] 兩種都裝時總覽顯示一行提示（Claude / Codex 各自判斷），版號不同為警示；只裝一種不顯示
- [ ] 文字走 i18n（三個 locale）
- [ ] 不改任何安裝檔或設定檔
- [ ] `npm run test:unit` 全綠；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

**DONE**：驗收 6 項全過。產品 commit `7f669c1a`（未 push）。

### 產出摘要

**落點檢查：PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 底下 → PASS
- C-3：前 5 個可測項目都存在 → PASS
- C-2：工單沒有 `branch` 欄位，略過
- 沒有設 `CT_HOME`，不是 worktree
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- `CT_MODE` = `yolo`，`CT_INTERACTIVE` = `0`

**偵測**：`detectCtInstalls`，在 `electron/ct-install-detect.ts`。
- Claude 與 Codex 各自查完手動與 plugin 兩邊，不會查到一邊就停。
- 手動安裝的判定：skill 目錄裡有 `control-tower/SKILL.md` 或 `ct-exec/SKILL.md`。
  - Claude 的 skill 目錄是 `<CLAUDE_CONFIG_DIR 或 ~/.claude>/skills`。
  - Codex 先看 `<CODEX_HOME>/skills`，再看 `<home>/.agents/skills`，順序同 T0710 3-1。
- 手動版號：讀 `control-tower/SKILL.md` 的 `<!-- control-tower-version -->` 註解；沒有的話改讀 `ct-exec/SKILL.md` 的 `<!-- ct-exec-version -->`。
- plugin 的判定與版號：
  - Claude 沿用 `findClaudeCtPlugins`，取最新一筆。
  - Codex 看 `config.toml` 裡有沒有 `enabled = true` 的 `ct@<mkt>`，版號取同一個 marketplace 的 cache 目錄名。
- 讀不到版號，或讀到的不是版號格式，就填 `null`。停用的 plugin 不算安裝。
- 不丟例外，不新增依賴。

**傳遞**：`ct:read-config-sources` 的回傳多一個選填欄位 `installs`（型別 `CtInstalls` / `CtAgentInstalls`，在 `src/types/ct-config-sources.ts`）。
- 既有的 `homeDir` / `global` / `defaults` 沒有改。
- 遠端由回答的主機判斷。

**顯示**：
- 純函式 `dualInstallNotices`（在 `src/lib/ct-tower-overview.ts`）。它會防禦舊 server 沒有這個欄位、或欄位格式不對的情況，這時不顯示提示。
- 畫面 `DualInstallRow`（在 `src/components/TowerOverview.tsx`），放在層狀態列「預設」那一行底下。
- 版號不同時顯示 ⚠️ 警示：外框用 `.ct-overview-hint`，文字用 `.ct-validation-warn`。其他情況顯示 ℹ️ 資訊。
- 讀不到的版號不放進文字裡。
- 提示文字走 i18n（`dualInstall` / `dualInstallVersion`，三個 locale）。
- `ControlTowerPanel.tsx` 不用改，因為 `configSources` 原本就整份傳給總覽。

**唯讀**：不寫入、不刪除任何檔案，也沒有加按鈕。

**本機唯讀實測**：用 `npx tsx` 以真實 home 呼叫 `detectCtInstalls`，結果是 `claude: manual 5.14.0 / plugin null`、`codex: manual 5.14.0 / plugin null`，和這台機器只裝了 zip 的實況相符。照規則，這種情況總覽不會顯示提示。

**改動檔案**（14 個，都在 `affects_files` 內）：
- `electron/ct-install-detect.ts`
- `electron/handlers/ct-config.ts`
- `src/types/ct-config-sources.ts`
- `src/components/TowerOverview.tsx`
- `src/lib/ct-tower-overview.ts`
- `src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`
- 測試：`electron/__tests__/ct-install-detect.test.ts`、`electron/__tests__/ct-config-sources.test.ts`、`src/lib/__tests__/ct-tower-overview.test.ts`、`src/components/__tests__/tower-overview.test.tsx`
- 文件：`docs/agent-guide/ct-plugin-install.md`（新增〈3-4 兩種都裝時提示（T0711）〉）、`docs/agent-guide/ct-tower-overview.md`（新增〈兩種安裝並存的提示（T0711）〉）

**驗證**：
- 新增的測試涵蓋這些情況：
  - 都沒裝、只裝手動、只裝 plugin
  - 兩種都裝，同版與不同版
  - 版號讀不到
  - plugin 已停用
  - `CODEX_HOME` / `CLAUDE_CONFIG_DIR` 有設時
  - 舊 server 沒有這個欄位、欄位格式不對
  - RTL：提示出現與不出現、警示 / 資訊兩種樣式、位置在「預設」那一行底下
- 相關 4 個測試檔：135 項 PASS。
- `npm run test:unit`：343 個檔案、6130 項 PASS，3 項 skipped，exit 0。
  - 本機是 Node v26.13.0，沒有加 `NODE_OPTIONS`。
  - 跑測試的當下，工作樹裡有 T0712 還沒 commit 的 `vitest.setup.ts`（14:03:15 已 commit 為 `2bbc11db`），所以 T0712 提到的 `copy-remote-path.test.tsx` 那 2 項也通過。
  - stderr 的 `AttachConsole failed` 是 node-pty 測試原本就有的輸出，與本單無關。
- `npm run typecheck` = 0。
- `npm run typecheck:electron` = 0。
- `npx vite build` 成功（exit 0）。

**Commit**：
- 產品：`7f669c1a`，用 `git commit --only` 只收上面 14 個檔。
- 工單：在本回報之後另外 commit。
- 都沒有 push，沒有觸發 workflow，也沒有建 tag。

### 互動紀錄

沒有。yolo 模式，沒有向塔台提問。

### Renew 歷程

沒有。

### 遭遇問題

- 警示樣式沿用既有的 class，沒有新增 CSS：`src/styles/control-tower.css` 不在 `affects_files` 內。如果要獨立的警示外框，需要另外開單。
- Claude 的手動安裝位置用 `CLAUDE_CONFIG_DIR`（沒設時 `~/.claude`），和 T0710 的 plugin 偵測一致。但 ct-config 預設值層 `ctConfigCandidates` 現行的寫法是固定讀 `<home>/.claude/skills`。本單沒有改它（不在範圍內），只在這裡記下兩者的差異。
- 已知限制（也寫進了 docs）：
  - 手動安裝只看 `control-tower` / `ct-exec` 兩個 skill。
  - Claude plugin 只看 `user` / `managed` scope。

### 回報時間

2026-10-30T14:04:34+0800
