---
schema_version: 1
schema_kind: workorder
id: T0673
title: "研究：EXP-WFMINE-001 — 全讀本專案工單，依提案 §5.1 挖掘 Workflow 候選（唯讀，以 Workflow 執行）"
type: research
status: TODO
repo: better-agent-terminal
project: EXP-WFMINE-001
priority: P2
sizing: L
created_at: "2026-10-20T16:40:50+0800"
depends_on: []
related:
  - "EXP-WFMINE-001（本單的實驗紀錄）"
  - "BMad-Guide 提案 D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_proposal-2026-10-20-ct-workflow-intelligence.md（§5.1、§5.1.3、§5.1.4、§6.2、§7）"
affects_files:
  - _ct-workorders/T0673-exp-wfmine-phase1-workflow-candidate-mining.md
  - _ct-workorders/_report-wfmine-phase1-20261020.md
renew_count: 0
workdir: main repo
execution: workflow
workflow_budget: 5.5M
workflow_run_id:
workflow_stats:
  agents: 0
  tokens: 0
  dropped: 0
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 唯讀研究：不改產品檔、規則檔（`_learnings.md` / `_local-rules.md` / CT skill）、其他工單、EXP-WFMINE-001、塔台狀態檔。只用 `git commit --only` commit `affects_files` 的 2 個檔案。不 push。"
  - "🔴 使用者核准紀錄：使用者 2026-10-20 16:40（UTC+8）在 BAT 塔台 session 中明確選定以「全讀 Workflow」執行本單，並核准規模：約 45 個 agent、預估 4.5–5M tokens、硬上限 5.5M。本工單即使用者指示 Worker 呼叫 Workflow 的依據。"
  - "🔴 先載入 `workflow-authoring` skill 再寫腳本。腳本不得使用 `Date.now()` / `Math.random()`；被略過或讀不到的檔案一律 `log()`，並寫進報告「遺漏清單」（提案 R2：不得靜默截斷）。不使用 Workflow 的 `isolation: 'worktree'`。子 agent 只讀檔，不寫檔、不派工、不呼叫 bat helper。"
  - "🔴 Worker 的 runtime 若不允許呼叫 Workflow（例如不認可同意來源），**不得**改成一般執行硬跑，要以 `T0673 提問` 問塔台。執行中預估總用量會超過 5.5M 時，停止並標 PARTIAL，保留 `workflow_run_id`。"
  - "🔴 yolo Worker：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。不得在任何地方寫出權杖值。"
---

# T0673 — 研究：EXP-WFMINE-001 Workflow 候選挖掘 Phase 1

## 研究目標

BMad-Guide 塔台正在審議「讓 CT 具備 Workflow 智能」提案（CT 主責，BAT 協作並試點）。本單是提案 §6.2 的先行試點：全文閱讀本專案所有工單，依提案 §5.1 的訊號 S1–S5 與排除條件 X1–X4，產出 **Workflow 候選排行**。結果交給 CT 塔台，作為規則設計（提案 §9-4 權重與門檻）的證據。

## 已知資訊

- **先讀提案全文**，重點是 §5.1（5.1.1 訊號、5.1.2 排除、5.1.3 輸出格式、5.1.4 初步觀察）、§5.2 R1–R5、§6.2、§7 P1。
- 語料（塔台 2026-10-20 量測）：`_ct-workorders/T*.md`（179）+ `_archive/workorders/T*.md`（513）+ `_ct-workorders/CT-T*.md` + `_archive/workorders/` 內的 `CT-T*` / `EXP-*`，共約 **718 檔**、9.6 MB、估約 3.1M tokens。中位數 12.5 KB／張，p90 22.7 KB，最大 55 KB。
- frontmatter 只有約 420 張有 `renew_count` / `type`；較舊的工單用 `## 元資料` 表格。狀態、Renew、提問紀錄都要從內文判讀，不能只解析 YAML。
- 提案 §1.3 的事實：SEQ 條目 0、`_playbooks/` 不存在，所以挖掘不能依賴 SEQ，必須直接讀工單。
- 輔助資料（只用於 S3）：`_ct-workorders/_decision-log.md`（210 KB）、`_ct-workorders/_learnings.md`（208 KB）。BUG / PLAN 單只在需要確認「重開／退回」時查閱。

## 調查範圍（Workflow 設計）

以下是塔台核准的規模。階段與 agent 數可以微調，但總 agent 數 ≤ 50、總 tokens ≤ 5.5M；偏離時要寫進報告。

| 階段 | 執行者 | 內容 |
|---|---|---|
| **P0 manifest** | Worker 自己（scratchpad 腳本，不用 LLM） | 列出語料所有檔案的 id、路徑、bytes。依編號排序切批，每批 ≤ 約 100k tokens（約 300 KB），同系列編號盡量同批。manifest 以 `args` 傳入 Workflow |
| **P1 Read**（約 33 個 agent） | `pipeline` / `parallel` | 每批**全文**讀完，每張工單依 schema 回傳一筆紀錄（見下）。讀不到、太大而略讀的檔案要在回傳中列出 |
| **P1b 輔助**（2 個 agent） | 同上 | 讀 `_decision-log.md`、`_learnings.md`，列出被推翻、退回、Renew 或判定誤報的工單編號與引文（S3） |
| **P2 Cluster** | 腳本內 JS，確定性 | 依 `family_key` 與 S2 重複次數分群。候選族門檻建議：同形 ≥ 3 張（S2），或單張 S1 有 ≥ 5 個同質子任務。分數依提案 §5.1.1 權重建議值計算（S1 / S2 高、S3–S5 中），命中任一 X 就排除（但保留紀錄） |
| **P3 Verify**（約 8 個 agent） | 每個候選族 1 個 | 對抗式複核：全文重讀該族的證據工單，嘗試推翻「適合 Workflow」的判斷。重點檢查 X4（機械性批次，單一 agent 或腳本即可完成）與 X2（執行中問過塔台）。確認形狀（pipeline / judge-panel / adversarial-verify / loop-until-dry），估算子任務數 × 每個子任務的 tokens，給 0–100 適配分數 |
| **P3b §5.1.4**（1 個 agent） | 單獨 | 讀 T0627、T0629、T0559、T0561、T0602、T0034、T0102、T0121，以及反例 T0075、T0083、T0094。逐張判定「確認／推翻」提案的檔名推測並附理由。T0034 另有 `reports/T0034-dependency-audit.md`，一併看 |
| **P4 Synthesize**（1 個 agent） | 單獨 | 依 §5.1.3 格式產出排行與報告草稿 |

**P1 每張工單的紀錄 schema（建議，可增欄位）**

`{ id, path, title, status, type, family_key（操作形狀的正規化描述，例 "e2e-acceptance-of-installed-build"）, subtasks: { kind, count, homogeneous }, signals: { S1..S5: { hit, evidence（≤ 200 字原文引文）, where（節名） } }, exclusions: { X1..X4: { hit, evidence } }, notes }`

## 輸出

1. **報告檔** `_ct-workorders/_report-wfmine-phase1-20261020.md`，章節如下：
   1. 方法與實際規模：各階段 agent 數、tokens、耗時、`runId`、`scriptPath`、與核准規模的偏差
   2. **候選排行**：WFC001 起，依提案 §5.1.3 格式（形狀、證據工單、子任務來源、排除檢查、預估規模、適配分數、狀態 🔵 候選）。每個候選另附 1–3 段原文引文，標明出處工單與節名
   3. **§5.1.4 確認／推翻表**：11 張逐張判定與理由
   4. **被排除的高頻假候選**：例如名稱含 batch 卻是機械操作的工單，列出命中哪個 X
   5. **規則修正建議**：S1–S5 權重、X1–X4 的增刪或釐清、`family_key` 判定的困難點。標為「建議」，作為提案 §9-4 的證據
   6. **遺漏清單**：沒讀、略讀、解析失敗的檔案（沒有就寫「無」）
   7. 事實與推論分開標示：【原文】= 工單內容、【統計】= 腳本計算、【推論】
2. **本工單回報區**：摘要、回填 frontmatter 的 `workflow_run_id` / `workflow_stats`（agents、tokens、dropped）。

## 研究指引

- 只看工單「實際做了什麼」，不看檔名或標題推測。標題含 audit / batch / probe 不代表形狀。
- X2 以工單「互動紀錄」或「提問」段落的實際提問為準。只寫了「可以問塔台」的規則文字不算命中。
- 同一系列（例如 probe-ct572、e2e-pre5）要看子任務是否同形、能否結構化驗收。只是編號相鄰不算 S2。
- 時間戳一律取系統時間（`date` / `Get-Date`），不手打。

## 互動規則

- yolo、`--no-interactive`：不問使用者；判讀問題問塔台（每輪 ≤ 3 題）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 調查結論

### 建議下一步

### Renew 歷程

### 遭遇問題

### 回報時間
