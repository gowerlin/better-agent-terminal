---
schema_version: 1
schema_kind: workorder
id: T0758
title: "修正 BUG-189：npm 安裝的 codex（`codex.cmd`）也能探測版本；修正 t0584 依賴 npx PATH 的斷言"
type: implementation
status: IN_PROGRESS
started_at: "2026-11-02T02:25:19+08:00"
updated_at: "2026-11-02T02:25:19+08:00"
session_ids: []
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T02:23:44+0800"
depends_on: []
related:
  - "BUG-189；BUG-159 / T0651（`--no-daemon`）；T0621（派工 codex OSC 版本判定）；T0742 回報區〈發現的問題〉2 / 3"
  - "`electron/codex-osc-version.ts`（`resolveDispatchCodexBinary`、`createCodexOscVersionCheck`、`createCodexNoDaemonSupportCheck`）、`docs/agent-guide/bat-mcp-shim.md`（第 64 行附近已知限制）、`docs/agent-guide/worker-launch-confirmation.md`"
affects_files:
  - electron/codex-osc-version.ts
  - electron/__tests__/
  - e2e/t0584-bat-mcp-shim.spec.ts
  - e2e/t0742-codex-no-daemon.spec.ts
  - docs/agent-guide/bat-mcp-shim.md
  - docs/agent-guide/worker-launch-confirmation.md
  - CLAUDE.md
  - _ct-workorders/T0758-fix-bug189-npm-codex-version-probe.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先查證：npm 全域安裝的 `@openai/codex`（0.166.0）在 Windows 的 shim（`codex.cmd` / `codex.ps1` / 無副檔名 sh）指向什麼（JS 入口、`vendor/` 下的原生 `codex.exe` 或平台子套件），以實際讀 shim 與套件目錄為準（可在 `%TEMP%` 以 `npm i --prefix` 安裝一份測試用，不動使用者全域安裝）。"
  - "🔴 修正方向：從 shim 解析出實際的 codex 原生執行檔或 node 入口後，以 `execFile`（不經 shell、陣列參數、5 s timeout）跑 `--version`；🔴 不得改用 shell 執行 `.cmd`（CLAUDE.md「Child Process Spawning」）；解析不出時維持 `version-unknown`（行為與現在相同）。快取沿用路徑 + mtime。手動分頁的 `--no-daemon` 與派工的 OSC 判定都走同一個解析（不得各寫一份）。macOS / Linux 行為不變。"
  - "🔴 t0584 第 275 行：改成不依賴 PATH 的斷言（例：明確注入 codex 支援檢查結果，或依當下探測結果計算預期值），說明改法。`t0742-codex-no-daemon` 增加 npm shim 情境（PATH 最前面放測試用 shim 目錄）。"
  - "🔴 驗證：新增 / 修改的單元測試＋突變檢查（拿掉修正，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`（依上方 build 規則的位置）。"
  - "🔴 build（Lane B：T0758 → T0759 → T0760 → T0766 → T0767，與 Lane A 並行）：主 checkout 的 `dist` / `dist-electron` 可能正被 Lane A 的 e2e 使用。`npx vite build` 與 e2e 一律在 `git archive` 匯出目錄做（`%TEMP%/bat-<工單>-build`，`node_modules` 以 junction 共用主 checkout，T0742 作法）；主 checkout 只跑 `npm run typecheck` / `npm run typecheck:electron` / `npm run test:unit`。跑完刪匯出目錄（先刪 junction 本身，確認主 checkout `node_modules/electron` 仍在）。e2e 一律用隔離實例。"
  - "🔴 文件：`bat-mcp-shim.md` 已知限制改為新行為；CLAUDE.md「BAT MCP shim」節的 codex daemon 一句如需調整只改必要字。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0758 — 修正 BUG-189：npm 安裝的 codex（`codex.cmd`）也能探測版本；修正 t0584 依賴 npx PATH 的斷言

## 元資料

- **工單編號**：T0758
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：S

## 背景

以 npm 安裝 codex 的 Windows 使用者，BAT 讀不到 codex 版本：BUG-159 的 `--no-daemon` 不注入、派工的 codex Worker 沒有 OSC 狀態。D210 排入本批。

## 範圍

1. 查證 npm shim 結構。
2. 解析 shim → 安全地探測版本；手動分頁與派工共用。
3. t0584 斷言、t0742 情境、文件。

## 不做

- 不改 codex 啟動參數本身、不改 daemon 判斷門檻（`>= 0.156.0`）、不發版。

## 驗收

- [ ] 查證有證據（shim 內容、指向的檔案）
- [ ] 單元測試＋突變檢查；typecheck 0 / 0、`test:unit`、`vite build`（匯出目錄）
- [ ] t0742 npm shim 情境綠、t0584 綠（兩種 PATH）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
