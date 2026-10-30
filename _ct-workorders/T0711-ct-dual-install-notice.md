---
schema_version: 1
schema_kind: workorder
id: T0711
title: "指揮塔總覽：CT 同時以 zip 與 plugin 安裝時提示實際生效的是哪一份（T0710 3-4）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: ""
priority: P3
sizing: S
created_at: "2026-10-30T13:57:15+0800"
started_at: ""
updated_at: "2026-10-30T13:57:15+0800"
completed_at: ""
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

### 待塔台決策（僅 yolo Worker 有問題時）

（沒有提問就刪除本段）

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
