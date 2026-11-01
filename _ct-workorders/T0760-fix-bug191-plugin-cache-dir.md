---
schema_version: 1
schema_kind: workorder
id: T0760
title: "修正 BUG-191：`CLAUDE_CODE_PLUGIN_CACHE_DIR` 時的 plugins 位置與 CLI 一致（先以 CLI 2.1.316 實測）"
type: implementation
status: PENDING
updated_at: "2026-11-02T02:23:44+0800"
session_ids: []
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-02T02:23:44+0800"
depends_on: [T0759]
related:
  - "BUG-191；T0730 回報區〈後續候選〉1；T0710（CT plugin 偵測）；BUG-178（`resolveClaudeConfigDir`）"
  - "`electron/claude-config-dir.ts`、`electron/ct-install-detect.ts`（`findClaudeCtPlugins`、`claudeCtPluginSkillDirs`）、`electron/claude-agent-manager.ts`（面板 plugins 清單）、`docs/agent-guide/claude-agent-sdk-cli.md`「Claude 設定目錄」、`docs/agent-guide/ct-plugin-install.md`"
affects_files:
  - electron/claude-config-dir.ts
  - electron/ct-install-detect.ts
  - electron/claude-agent-manager.ts
  - electron/handlers/ct-config.ts
  - electron/__tests__/
  - docs/agent-guide/claude-agent-sdk-cli.md
  - docs/agent-guide/ct-plugin-install.md
  - CLAUDE.md
  - _ct-workorders/T0760-fix-bug191-plugin-cache-dir.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先實測：內嵌 CLI 2.1.316，在暫存 HOME / `CLAUDE_CONFIG_DIR` 下設與不設 `CLAUDE_CODE_PLUGIN_CACHE_DIR`，以本機 marketplace（暫存目錄裡的假 plugin，不連網）安裝一個 plugin，記錄 `installed_plugins.json`、`known_marketplaces.json`、plugin 內容各落在哪裡。CT 文件的說法只當參考，以實測為準。"
  - "🔴 修正方向：依實測結果，plugins 根目錄的解析集中成一個函式（放在 `electron/claude-config-dir.ts` 旁，`resolveClaudeConfigDir` 規則不變），`findClaudeCtPlugins`、`claudeCtPluginSkillDirs`、面板 plugins 清單、`ct:read-config-sources` 預設層都經它；env 來源與 `resolveClaudeConfigDir` 相同（spawn env）。實測發現 CLI 行為與 CT 文件不同 → 照實寫進回報區，由塔台轉告 CT。不設變數時行為完全不變。"
  - "🔴 驗證：新增 / 修改的單元測試＋突變檢查（拿掉修正，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`（依上方 build 規則的位置）。"
  - "🔴 build（Lane B：T0758 → T0759 → T0760 → T0766 → T0767，與 Lane A 並行）：主 checkout 的 `dist` / `dist-electron` 可能正被 Lane A 的 e2e 使用。`npx vite build` 與 e2e 一律在 `git archive` 匯出目錄做（`%TEMP%/bat-<工單>-build`，`node_modules` 以 junction 共用主 checkout，T0742 作法）；主 checkout 只跑 `npm run typecheck` / `npm run typecheck:electron` / `npm run test:unit`。跑完刪匯出目錄（先刪 junction 本身，確認主 checkout `node_modules/electron` 仍在）。e2e 一律用隔離實例。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0760 — 修正 BUG-191：`CLAUDE_CODE_PLUGIN_CACHE_DIR` 時的 plugins 位置與 CLI 一致（先以 CLI 2.1.316 實測）

## 元資料

- **工單編號**：T0760
- **類型**：implementation
- **優先級**：P3
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：S

## 背景

T0730 發現設了 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時 BAT 找 plugins 的位置可能與 CLI 不同。D210 排入本批。

## 範圍

1. 以 CLI 2.1.316 實測 plugins 檔案位置。
2. 集中 plugins 根目錄解析，所有 consumer 經它。
3. 單元測試、文件。

## 不做

- 不改 `CLAUDE_CONFIG_DIR` 規則；不連網；不動使用者的 `~/.claude`；不發版。

## 驗收

- [ ] 實測表（設 / 不設變數 × 各檔案位置）
- [ ] 單元測試＋突變檢查；typecheck 0 / 0、`test:unit`、`vite build`（匯出目錄）
- [ ] 文件更新

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
