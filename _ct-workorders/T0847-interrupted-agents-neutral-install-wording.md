---
schema_version: 1
schema_kind: workorder
id: T0847
title: "被中斷的 agent 分頁：對話框標題 / 說明與縮圖 ⏸ tooltip 的「升級 / 安裝新版」字樣改成同版重裝、取消安裝也成立的中性說法"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-063
priority: P3
sizing: S
created_at: "2026-11-04T14:26:42+0800"
started_at: "2026-11-04T14:27:39+0800"
updated_at: "2026-11-04T14:30:10+0800"
completed_at: "2026-11-04T14:30:10+0800"
session_ids:
  - "c8c629fb-2200-4339-9762-a0f05bae5276"
depends_on:
  - T0846
related:
  - "T0846〈後續建議〉；D279；D278；T0821（對話框 upgrade 文字）；T0822（⏸ tooltip）；PLAN-063"
affects_files:
  - _ct-workorders/T0847-interrupted-agents-neutral-install-wording.md
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/components/__tests__/upgrade-interruption.test.tsx
  - src/components/__tests__/interrupted-agent-badge-tooltip.test.tsx
  - docs/agent-guide/upgrade-interruption.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改文字（locale 值）與對應測試 / docs：不改 locale key 名稱、`cause` 值（仍是 `upgrade`）、`InterruptedAgentsDialog.tsx` / `TerminalThumbnail.tsx` 的邏輯、恢復流程（T0766 / T0767）、toast（T0846 剛改好的 `app.upgradeInterrupted` / `app.upgradeReinstalled` 不動）。Terminal Server recovery 那組字串（`badgeTooltip` 等非 upgrade 的）不動。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0847 — 被中斷的 agent 分頁的安裝字樣改中性

## 元資料
- **工單編號**：T0847｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 14:26 (UTC+8)
- **規模**：S｜**決策**：D279

## 背景
T0846（`9e966f98`）起，有安裝程式結束紀錄時同版重裝、取消安裝也會把 agent 分頁以 `cause: 'upgrade'` 列進「被中斷的 agent 分頁」。下列字串（三語）只在「安裝了新版」時才正確：

| key（`interruptedAgents.*`） | zh-TW 現值（節錄） |
|---|---|
| `upgradeTitle` | 升級結束的 agent 分頁 |
| `upgradeDesc` | 安裝新版時結束了這些分頁的 agent。…按「恢復」會結束新開的 agent，接續升級前的對話… |
| `badgeUpgradeTooltip` | 這個分頁的 agent 因安裝新版而中斷，按此查看 |

## 任務
1. 三個字串（en / zh-TW / zh-CN）改成升級、同版重裝、取消安裝都成立的**單一**說法，不依版本分支。方向（Worker 可微調用詞，三語同義）：
   - 標題：「安裝程式結束的 agent 分頁」
   - 說明：「安裝程式執行時結束了這些分頁的 agent。…按「恢復」會結束新開的 agent，接續被中斷的對話…」（其餘句子意思不變，含 codex resume 選單與「不會自動恢復」）
   - tooltip：「這個分頁的 agent 被安裝程式中斷，按此查看」
2. 既有測試若逐字比對舊字串就跟著改；斷言意圖不得變弱（例：tooltip 仍須與 recovery 的 `badgeTooltip` 不同、不含 `Terminal Server`）。新增一個斷言：三語這三個值不含「新版 / 升級」（en：`new version` / `upgrade`，大小寫不拘）。
3. `docs/agent-guide/upgrade-interruption.md` 引用到這些文字的地方同步。

### 驗收條件
- [ ] 相關 renderer 測試通過；`npm run typecheck` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE
- **完成時間**：2026-11-04 14:30 (UTC+8)
- **session_id**：c8c629fb-2200-4339-9762-a0f05bae5276

### 落點檢查
- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS；C-3：抽查的 6 個檔案都存在 → PASS；C-2：工單無 `branch` 欄位，不適用
- `CT_HOME` 未設（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`BAT_REMOTE_TOKEN` 已設定

### 結果摘要
三個 `interruptedAgents.*` 字串（en / zh-TW / zh-CN）改成升級、同版重裝、取消安裝都成立的單一說法，不依版本分支：

| key | zh-TW | zh-CN | en |
|---|---|---|---|
| `upgradeTitle` | 安裝程式結束的 agent 分頁 | 安装程序结束的 agent 标签页 | Agent tabs ended by the installer |
| `upgradeDesc` | 安裝程式執行時結束了這些分頁的 agent。…按「恢復」會結束新開的 agent，接續被中斷的對話（codex 從 codex 的 resume 選單選 session）；不會自動恢復。 | 安装程序运行时结束了这些标签页的 agent。…接续被中断的对话… | The installer ended these tabs' agents while it ran. … continues the interrupted conversation (codex: pick it from codex's resume menu); nothing resumes on its own. |
| `badgeUpgradeTooltip` | 這個分頁的 agent 被安裝程式中斷，按此查看 | 这个标签页的 agent 被安装程序中断，点击查看 | The agent in this tab was interrupted by the installer — click to review |

`upgradeDesc` 中間句（分頁已重新開啟、可能已開新 agent）原樣保留，只改第一句與「升級前的對話」→「被中斷的對話」。
未動：locale key 名稱、`cause: 'upgrade'`、`InterruptedAgentsDialog.tsx` / `TerminalThumbnail.tsx`、恢復流程、toast（`app.upgradeInterrupted` / `upgradeReinstalled`）、recovery 的 `badgeTooltip` / `title` / `desc`。

### 修改檔案
- `src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`：上表三個值
- `src/components/__tests__/upgrade-interruption.test.tsx`：新增 `it.each(LOCALES)`：三語的 `upgradeTitle` / `upgradeDesc` / `badgeUpgradeTooltip` 非空、不符合 `/new version|upgrade/i`、不含「新版 / 升級 / 升级」
- `docs/agent-guide/upgrade-interruption.md`：「agent 分頁」節的對話框說明同步（「接續被中斷的對話」），並補一點記載 T0847 / D279 的中性文字、測試守門與不變項
- `src/components/__tests__/interrupted-agent-badge-tooltip.test.tsx`：**未改**。它只以 locale 物件比對（不是逐字字串），既有斷言（與 `badgeTooltip` 不同、不含 `Terminal Server`）照舊成立，意圖未變

### 驗證
- 相關測試：`upgrade-interruption.test.tsx`、`interrupted-agent-badge-tooltip.test.tsx`、`interrupted-agents-dialog.test.tsx` → 3 檔 42 tests passed
- `npm run typecheck`（`tsc --noEmit -p .`）exit 0 = 0 錯誤
- `npm run test:unit`：435 files passed / 3 skipped；7743 tests passed / 40 skipped，0 失敗
- `npx vite build`：成功
- 驗證時 HEAD = `d0b580cf`（加上工作目錄的本單修改）；之後只有本單的產品 commit，未再改檔

### Commit
- 產品：`511df465` fix: T0847 neutral installer wording for interrupted agent tabs（只含上列 5 個檔，`git add <明確路徑>`）
- 工單：本檔另一個 commit
- 未 push、未發版

### 互動紀錄
- 無（yolo，未向塔台提問；未讀到塔台補充段落）

### 遭遇問題
- 無

### 後續建議
- 無
