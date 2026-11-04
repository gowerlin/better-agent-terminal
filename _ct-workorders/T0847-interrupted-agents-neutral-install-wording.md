---
schema_version: 1
schema_kind: workorder
id: T0847
title: "被中斷的 agent 分頁：對話框標題 / 說明與縮圖 ⏸ tooltip 的「升級 / 安裝新版」字樣改成同版重裝、取消安裝也成立的中性說法"
type: implementation
status: TODO
repo: better-agent-terminal
project: PLAN-063
priority: P3
sizing: S
created_at: "2026-11-04T14:26:42+0800"
started_at: ""
updated_at: "2026-11-04T14:26:42+0800"
completed_at: ""
session_ids: []
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
- **工單編號**：T0847｜**類型**：implementation｜**狀態**：TODO｜**建立**：2026-11-04 14:26 (UTC+8)
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
