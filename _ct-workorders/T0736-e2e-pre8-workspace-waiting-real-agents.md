---
schema_version: 1
schema_kind: workorder
id: T0736
title: "pre.8 自動化驗收：真的 claude CLI / codex 觸發工作區等待提示 ⚠️（本機假模型，不耗 token）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T17:14:00+0800"
started_at: ""
updated_at: "2026-11-01T17:14:00+0800"
completed_at: ""
depends_on: []
related:
  - "T0735（`b4daaf1f`，D200–D203）：`e2e/t0735-workspace-waiting-badge.spec.ts` 只以自訂 CLI 呼叫 `bat-hook.mjs` 模擬 hook，沒有真的 claude / codex 觸發"
  - "T0727（`e2e/fixtures/fake-anthropic-api.ts`、`e2e/v072-pre6-claude-panel.spec.ts`：假 Anthropic API、暫存 HOME、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、拒絕 proxy、工作區放 `%ProgramData%`）"
  - "T0621 / T0728（`e2e/t0621-codex-osc-state.spec.ts`：內嵌 codex + 本機假 OpenAI Responses API、temp `CODEX_HOME`、approval prompt → OSC `blocked` / `input`）"
  - "CLAUDE.md「Worker 分頁回收」節 T0735 段、「blocked 狀態偵測」節；`docs/agent-guide/worker-tab-recycle.md`、`docs/agent-guide/blocked-state.md`"
affects_files:
  - "e2e/v072-pre8-workspace-waiting-real-agents.spec.ts（新增，檔名可調；可拆成 claude / codex 兩檔）"
  - "e2e/fixtures/（只在需要共用假模型 helper 時新增或擴充；不改既有 spec 的行為）"
  - docs/agent-guide/worker-tab-recycle.md
  - _ct-workorders/T0736-e2e-pre8-workspace-waiting-real-agents.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 情境（隔離實例裡至少兩個工作區：A = 正在看的、B = 放 agent 分頁的；斷言都在 A 看 B 的列，與 T0735 e2e 相同的 DOM / selector）：① 手動開的 Claude CLI 分頁（內嵌 claude CLI、預設權限模式）＋假 Anthropic API 回一個需要權限的 tool_use（例 Bash）→ 真的 `PermissionRequest` hook → B 列出現實心 ⚠️、滑過 tooltip 是 permission 原因且不含指令內容；在 B 分頁核准 → ⚠️ 消失（或依 D203 在沒看時變淡化，視當下焦點，兩者擇一斷言並寫明）。② 「以塔台開啟 Claude」的分頁（`launchRole: 'tower'`）＋假 API 回 `AskUserQuestion` tool_use → `question` → B 列 ⚠️；回答後清除。③ 手動開的 Codex CLI 分頁（不經 helper 派工）＋本機假 Responses API 回需要核准的 `exec_command` → OSC `blocked` → `input` → B 列 ⚠️；核准後清除。④ helper 派工的 claude Worker（落點 B）blocked → B 列 ⚠️，同時 Worker 分頁標籤仍是 ⚠️、批次關閉計數不含它（T0609 規則不變）。⑤ 多個分頁同時等待 → `⚠️ N`；點 ⚠️ 跳到等最久的那個分頁並切回終端頁籤。⑥ 側欄停在「塔台」頁籤 / 收合時，總數 badge 反映 ①–④ 的狀態。"
  - "🔴 不耗 token：claude 只打 spec 內的假 Anthropic API（沿用 T0727 的隔離做法：暫存 HOME、`ANTHROPIC_BASE_URL` / 假 key、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、拒絕並記錄的 proxy），codex 只打本機假 Responses API（temp `CODEX_HOME`，沿用 t0621）；不得用使用者的 claude / codex 登入或真實 API；回報區列出對外請求數（預期 0）。claude CLI 首次啟動的信任 / API key 確認畫面以預先寫好暫存 HOME 的設定處理，不得改產品程式碼來繞過。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷 → 記在回報區〈發現的問題〉附重現步驟與證據，由塔台開 BUG，不在本單修。某情境做不到（例如 claude CLI TUI 在 e2e 中無法驅動）就寫明原因與已試過的做法，其餘情境照做，不硬湊；可依此回 PARTIAL。"
  - "🔴 隔離：一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例（`--runtime=e2e-…`、獨立 userData 與 remote port），不得以預設實例啟動 source build，不碰使用者正在用的 BAT 與其 userData，不執行任何安裝檔。先 `npx vite build`。工作區名稱一律 `e2e-t0736-*`。暫存目錄跑完要清掉；清不掉（安全檢查擋下等）就把路徑寫進回報區。"
  - "🔴 驗證：新 spec 綠（或部分綠並說明），連跑 2 次；重跑 `t0735-workspace-waiting-badge`、`t0609-worker-attention-badge`、`t0590-blocked-state`、`t0621-codex-osc-state` 綠（〈相關通過案例判定〉列出）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 若在 tsconfig 範圍外則註明）。`docs/agent-guide/worker-tab-recycle.md` 的 T0735 驗證清單補一行指向新 spec。回報區另列「仍需手動實機驗收」的項目（例如真實模型、遠端 / headless 工作區、安裝版、視覺感受），供塔台轉給使用者。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0736 — pre.8 自動化驗收：真的 claude CLI / codex 觸發工作區等待提示

## 元資料

- **工單編號**：T0736
- **類型**：implementation（驗收用 e2e）
- **優先級**：P2
- **建立時間**：2026-11-01T17:14:00+0800
- **預估規模**：M

## 背景

使用者要求安排 `v0.7.2-pre.8`（工作區等待提示，T0735 / D200–D203）的自動驗收。HEAD 的 `src` / `electron` / `scripts` / `e2e` 與 pre.8 發版 commit `cf71bf6f` 相同，以 source build 驗即等同驗 pre.8。T0735 的 e2e 以自訂 CLI 直接呼叫 `bat-hook.mjs` 模擬 hook；本單補「真的 claude CLI hook」與「真的 codex OSC 7501」觸發的路徑，以及手動分頁、塔台分頁、helper 派工 Worker 三種分頁來源，結果作為 pre.8 實機驗收的自動化部分。

## 範圍

1. 情境 ①–⑥（見 frontmatter `memory_overrides` 第 1 條）的 e2e，假模型不耗 token。
2. 重跑相關既有 spec。
3. docs 驗證清單一行。

## 不做

- 不改產品程式碼、不修發現的缺陷。
- 不涵蓋 detached 視窗（D201 延後）、Claude Agent 面板（SDK，無 PTY attention）、遠端 / headless 工作區（列為手動）。

## 驗收

- [ ] 情境 ①–⑥ 逐項 PASS / 未涵蓋與原因
- [ ] 對外請求數 0
- [ ] 〈相關通過案例判定〉（t0735 / t0609 / t0590 / t0621 綠）
- [ ] 兩個 typecheck = 0
- [ ] 〈仍需手動實機驗收〉清單

---

## 回報區

### 完成狀態

### 相關通過案例判定

### 發現的問題

### 仍需手動實機驗收

### 互動紀錄

### 回報時間
