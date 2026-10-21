---
schema_version: 1
schema_kind: plan
id: PLAN-054
title: "CT Workflow 智能的 BAT 側事項：B4 MCP 政策文件、B6 CT 面板讀 workflow 欄位（等 CT v5.11.0）"
status: PLANNED
priority: low
created_at: "2026-10-20T17:29:22+0800"
links:
  source: "BMad-Guide 塔台 HANDOVER `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_handover-2026-10-20-bat-workflow-intelligence.md` §3；使用者 2026-10-20 指示「開 PLAN-054 照建議，B1 先不做」"
  related: [EXP-WFMINE-001, T0673, PLAN-041, PLAN-047, CT-T015]
  external: "CT T0176（meta-PLAN）、T0177（P1 規則定案）"
---

# PLAN-054 — CT Workflow 智能的 BAT 側事項

## 動機

使用者 2026-10-20 提案讓 CT 具備 Workflow 智能，分工是 CT 主責、BAT 協作並先行試點。BMad-Guide 塔台已修正後受理（CT D075），並以 HANDOVER 把 BAT 側事項 B1–B8 交給本塔台。PLAN-041、PLAN-047 都已 DONE，所以另開本 PLAN 收這些事項。

B8 試點已由 EXP-WFMINE-001 / T0673 完成（`84e21f2d`）。結論之一（推論）：BAT 的扇出大多發生在工單之間，單張工單內很少用到 Workflow。因此 BAT 側先只做成本低的兩項。

## 範圍（使用者 2026-10-20 決定）

| # | 項目 | 狀態 | 內容 |
|---|---|---|---|
| B4 | MCP 權限政策 | 🔄 T0687 開單（`v0.7.1-pre.5` 發版批次，D179，2026-10-21）；原：併入下一次發版批次（使用者 2026-10-20 決定） | 在 BAT MCP 文件（`docs/agent-guide/bat-mcp-shim.md`）寫一條政策：「日後若新增寫入型 tool，不得開放給 workflow 子 agent」。目前 8 個 tool 全部唯讀，只寫文件，不改程式 |
| B6 | CT 面板欄位 | ⏸ 延後，無排程（2026-10-20 19:15 BMad-Guide 塔台通知：CT T0182 回測 G2 未通過、CT D090，v5.11.0 改為精簡版且**不定義**這些欄位；等知識卡達 🟡、CT 重新定義欄位後以 HANDOVER 或 CT-T### 通知） | CT 面板讀取 `execution`、`workflow`、`workflow_run_id`、`workflow_stats` 並顯示。🔴 **契約方向是 CT 定義、BAT 依約讀取**（與 CT-T011～T021 相反）。欄位定案前**不實作**，等 BMad-Guide 塔台發出介面契約 |

## 不做 / 暫緩

| # | 項目 | 處置 | 原因 |
|---|---|---|---|
| B1 | SDK 面板辨識 Workflow | ❌ 先不做（使用者決定），也不做可行性研究 | 只改善 Agent（SDK）面板，CT Worker 是 PTY 分頁看不到；試點顯示單張工單內很少用 Workflow |
| B2 | 進度樹 | P3，不排程 | journal 格式未公開 |
| B7 | Workflow 啟動器 | P3，不排程 | 選配 |
| B3 | 自動回收防護 | 不改程式 | CT `worker_auto_close: done` 只回收 DONE；CT v5.11.0 會加「有 `workflow_run_id` 且不是 DONE 的工單不得回收」 |
| B5 | worktree 管理權 | 不改程式 | CT 決定 R3：不用 Workflow 內建 worktree |
| B8 | 試點資料 | ✅ 完成 | EXP-WFMINE-001 / T0673 |

## 待決

1. ~~B4 跟哪一版一起發~~ → 使用者 2026-10-20 決定：併入下一次發版批次，跟該批工單一起開單。
2. B6 延後（CT D090：具名 workflow 停在 🔵、不參與派發；v5.11.0 不定義 `execution` / `workflow` / `workflow_run_id` / `workflow_stats`）。回測報告：`D:\ForgejoGit\@Gower_Labs\BMad-Guide\_ct-workorders\T0182-report-workflow-backtest.md`（BAT T0653 召回 88% 但沒重現推翻 T0646 的結論；T0534 召回 61%）。CT 重新定義欄位、發出契約後再評估欄位、顯示位置（CT 面板工單列 / 詳情）與 parser（`src/types/` 工單 frontmatter 解析）。
