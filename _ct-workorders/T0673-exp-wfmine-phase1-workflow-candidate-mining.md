---
schema_version: 1
schema_kind: workorder
id: T0673
title: "研究：EXP-WFMINE-001 — 全讀本專案工單，依提案 §5.1 挖掘 Workflow 候選（唯讀，以 Workflow 執行）"
type: research
status: DONE
repo: better-agent-terminal
project: EXP-WFMINE-001
priority: P2
sizing: L
created_at: "2026-10-20T16:40:50+0800"
started_at: "2026-10-20T16:42:30+0800"
updated_at: "2026-10-20T17:25:26+0800"
completed_at: "2026-10-20T17:25:26+0800"
depends_on: []
related:
  - "EXP-WFMINE-001（本單的實驗紀錄）"
  - "BMad-Guide 提案 D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_proposal-2026-10-20-ct-workflow-intelligence.md（§5.1、§5.1.3、§5.1.4、§6.2、§7）"
affects_files:
  - _ct-workorders/T0673-exp-wfmine-phase1-workflow-candidate-mining.md
  - _ct-workorders/_report-wfmine-phase1-20261020.md
  - _ct-workorders/_report-wfmine-phase1-20261020-per-ticket.jsonl
renew_count: 0
workdir: main repo
execution: workflow
workflow_budget: 7.0M
workflow_run_id: wf_738991d2-209
workflow_stats:
  agents: 39
  tokens: 7354020
  dropped: 0
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 唯讀研究：不改產品檔、規則檔（`_learnings.md` / `_local-rules.md` / CT skill）、其他工單、EXP-WFMINE-001、塔台狀態檔。只用 `git commit --only` commit `affects_files` 的 3 個檔案（2026-10-20 16:52 塔台追加第 3 個：逐張判定）。不 push。"
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
3. **逐張判定**（塔台 2026-10-20 16:52 追加，使用者指示，CT D077）：`_ct-workorders/_report-wfmine-phase1-20261020-per-ticket.jsonl`
   - 一行一張，涵蓋 P1 讀過的每一張。欄位：
     - `id`、`path`
     - 命中的 S／X 與各自的證據位置（檔名 + 小節名或行號）、證據摘錄（≤ 200 字）
     - 子項數（`subtasks.count`、`homogeneous`）
   - 目的：讓 CT 的 T0177 事後套用規則 v0 的差異，不必重跑。v0 的差異是：
     - S6：子項互相獨立、可結構化驗收
     - X5：序列重複但單張不扇出
     - X2：改看工單內的 `### 待塔台決策` / `塔台答覆 Q-`
   - 🔴 **本單的規則與範圍不變**：仍用原版 S1–S5／X1–X4，全量 718 檔，上限 5.5M。不要中途切換規則或範圍。
   - P1 的 schema 已定、無法加欄位時，直接把 P1 每張的紀錄（含 `where` 與 `evidence`）輸出成這個檔，至少保留每張的證據摘錄。
   - 如果 P1 剛好看到工單內有 `### 待塔台決策` / `塔台答覆 Q-`，或「單張是否扇出」很明顯，可以在 `notes` 順手記下。這不是新的判定條件。
   - 報告「方法與實際規模」一節要寫實際用量（agent 數、tokens），CT 會拿來當成本基準。

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

### 待塔台決策

#### Q-1：試跑實測後，全讀預估總用量約 6.5M tokens，超過核准硬上限 5.5M，要放寬上限還是停止？
- 提問時間：2026-10-20T16:50:57+0800
- 試跑證據：第 1 批（T0001..T0016，16 張、287 KB）以 1 個 reader agent 全讀，`subagent_tokens` = 185,031（其中 agent 固定開銷約 31k，內容約 154k），16/16 張以 `last_line` 比對證實讀到檔尾。`runId` = `wf_738991d2-209`（試跑，可快取重用）。
- 原因：語料以中文為主，實測約 1.9 bytes/token；依試跑校正，718 檔內容約 **4.6M tokens**（工單原估 3.1M）。全讀 P1 光內容就約 4.6M，加上 agent 固定開銷、P1b（約 0.25M）、P3 複核重讀（約 0.7M）、P3b、P2 / P4，合計約 **6.0–6.5M**。只減 agent 數（P1 改 23 批）仍約 6.0M；要壓在 5.5M 內就必須放棄全讀或拿掉 P1b / P3 重讀。
- 選項：[A] 放寬硬上限到 7.0M（需使用者核准），照原設計全讀：P1 第 1 批沿用試跑快取，其餘 33 批重切為約 22 批（每批約 450 KB），總 agent 數約 36，預估 6.0–6.5M / [B] 維持 5.5M，仍全讀 718 檔，但拿掉 P1b（決策日誌 / 學習紀錄的 S3 只靠工單本身）、P3 複核不重讀工單只依 P1 紀錄，預估約 5.4M、品質明顯下降 / [C] 維持 5.5M，依工單規則現在停止並標 PARTIAL，保留 `runId` / [D] 其他：________
- Worker 建議：[A]。全讀是本實驗的前提，超支來自 token 密度估錯而不是設計放大；[B] 拿掉的正好是 S3 證據與對抗式複核，會讓排行失去作為規則證據的價值。
- 影響範圍：P1–P4 全部階段、`workflow_budget`、報告「方法與實際規模」一節的偏差說明
- 阻塞：是（全量 Workflow 要等答覆才啟動）

### 完成狀態

**DONE**，有 1 項預算偏差：實際用量 **7.35M tokens**，超出使用者核准的 7.0M 上限約 5%（見下方「遭遇問題」第 1 點）。

- 交付物：
  - 報告 `_ct-workorders/_report-wfmine-phase1-20261020.md`：§0 摘要、§1 方法與規模、§2 候選排行、§3 §5.1.4 表、§4 假候選、§5 規則修正建議、§6 遺漏清單、§7 標示、附錄 A、B。
  - 逐張判定 `_ct-workorders/_report-wfmine-phase1-20261020-per-ticket.jsonl`：718 行。
- Workflow：`runId` `wf_738991d2-209`。共 39 個 agent：全量 run 38 個，另有 1 個試跑。
  - 工具回報 `subagent_tokens`：試跑 185,031、全量 run 7,168,989。
  - 耗時：試跑約 2.4 分、全量 run 約 20.5 分。
  - `dropped` 0：718/718 檔都有紀錄；以 `last_line` 驗證讀完全文，714 張完全相符，4 張落在檔尾 3 行內。
- 各階段 agent 數：P1 25（每批 ≤ 450 KB、≤ 35 檔）、P1b 2、P3b 1、P2 1（family_key 正規化）、P3 8、P4 1。偏差與原因寫在報告 §1.3。
- commit：本單只有研究輸出、沒有產品變更。以 `git commit --only` commit `affects_files` 的 3 個檔案；沒有 push。

### 互動紀錄

- [16:57] Q-1: 全讀預估約 6.0–6.5M tokens，超過硬上限 5.5M，要放寬還是停止？ → A（使用者直接在 Worker 分頁答覆）: 「A，放寬到 7.0M 繼續」 → Action: `workflow_budget` 改為 7.0M；取消 BAT 通道上的題目 `q-4a40a82a-4d9ded824a9bb414`（`status: cancelled worker`）；P1 第 1 批沿用試跑快取，其餘重切後啟動全量 Workflow。
  - 經過：16:51 以 `bat-notify.mjs --ask` 送出（exit 0、`notified: yes`）。塔台分頁當時是 `working`，使用者回報塔台似乎沒看到，中斷了 Worker 的等待並直接答覆。預算核准本來就屬使用者，所以以使用者答覆為準，沒有塔台答覆行。

### 調查結論

- 【統計】33 個操作族中，25 個達到腳本的候選門檻。依腳本分數複核前 8 個，結果 **0 個維持原判、6 個 weakened、2 個 refuted**（fix-typecheck-errors、write-design-spec）。適配分數從腳本平均 50.9 降到複核平均 30.0。
- 【推論】BAT 的工單多半是單一 agent 在 3–40 分鐘內完成的小單。扇出發生在工單之間，也就是塔台依序派工（PLAN-019 的 T0186–T0191、T0262–T0266、probe 系列 T0625–T0629），不在單張工單之內。
  - 跨工單的重複比較適合做成派工範本或 Playbook。
  - 單張工單內的 Workflow 候選少，而且形狀以對抗式驗證為主，不是確定性扇出。正向例子：T0034（19 個套件同形評估）、T0653（子代理推翻前一張工單的結論）、T0559（塔台改判 spec 誤判）。
- 【統計】§5.1.4 的 11 張：確認 3、部分 7、推翻 1。提案推測「扇出」的 5 張，扇出全部不成立。這和 BMad-Guide 塔台在 T0176 § 2 的核對一致（報告附錄 A）。
- 規則修正建議 19 條（報告 §5），重點：
  - S1 不計報告表格列數、腳本或單一指令的輸出、寫同一檔的修改。
  - S2 改用複核確認的同形成員數。
  - S3 權重提高。
  - X4 補上「約 15 分鐘內單一 agent 可完成」等判定。
  - 新增「共用狀態或串行依賴」排除條件。
  - X1、X2 的判定釐清。
  - family_key 改用形狀三元組。
  - 候選門檻從「或」改成「且」。
- 【推論】最清楚的 Workflow 用例就是本單自己：大量語料分批全讀、結構化分類、確定性分群、對抗式複核、彙整。可以列為 Phase 2 回測的第一個具名 workflow。

### 建議下一步

1. 複核未複核候選中的單張高 S1 工單：T0034（WFC009）、T0292／T0293（WFC011）、T0252（WFC014）。這 17 個候選都只有腳本分數。
2. Phase 2 回測候選：「語料挖掘」（本單腳本）、「多文件對程式碼核對」（T0653 的形狀）。
3. T0177 的規則 v0 可以直接套用 `_report-wfmine-phase1-20261020-per-ticket.jsonl`，不必重跑。用本報告複核過的 35 張工單做標註校準。
4. CT 成本基準（報告 §1.2）：
   - 中文為主的工單語料約 1.9 bytes/token。
   - 每個 Explore 型 reader agent 的固定開銷約 31k tokens。
   - 全讀 718 檔（10 MB）實際約 7.35M tokens。
   - Workflow 沒有執行中可讀的 token 計量，預算只能靠控制規模，事後才能確認。

### Renew 歷程

無

### 遭遇問題

1. **超出預算上限**：使用者核准 7.0M，實際 7.35M，超出約 5%。
   - 【統計】主因 1，token 密度估錯：原估 3.1M，試跑校正後約 4.6M，因此提出 Q-1、獲准放寬到 7.0M。
   - 【統計】主因 2，試跑結果沒有被重用：全量 run 以 `resumeFromRunId` 接續試跑，但 transcript 顯示第 1 批 reader 跑了兩次（184,878 與 185,027），多花約 185k。【推論】原因沒有查證；可能是 25 批同時啟動，第一個發出的 agent 呼叫不是第 1 批，最長未變更前綴因此為空。
   - Workflow 執行中無法取得 token 用量（`budget.spent()` 只算輸出），所以超支在 run 結束後才能確認，執行中無法依「預估超過上限就停止」的規則中止。
2. **Q-1 的 BAT 通道**：塔台當時正在忙，使用者回報塔台沒看到通知，改由使用者在 Worker 分頁直接答覆（見互動紀錄）。BAT 上的題目已取消（`cancelled worker`）。這題由使用者答覆，所以沒有加 `通道` 標記，也沒有再送一般 `提問`。
3. **塔台中途改了工單**：
   - 16:52 追加輸出 3（逐張 JSONL）。這段內容在 Worker 16:57 的 commit `72715226` 時一起被 commit。
   - 之後又在「輸出」節補了「方法與實際規模要寫實際用量」一行，會在本次收尾 commit 中一起提交。
   - 兩項都已照做。追加段落中寫的「上限 5.5M」已被使用者 16:57 的 7.0M 答覆取代。
4. **P4 草稿的一處推論錯誤已更正**：4.3 節原本推測「腳本關鍵字清單比較寬」。實際原因是腳本比對「標題＋路徑」，Worker 依腳本原始碼更正。
5. **reader agent 用 Explore 型加 opus**：為了省下專案 CLAUDE.md 的注入（約 58 KB／agent），而且這個型別沒有寫檔工具，符合「子 agent 只讀檔」。工單沒有指定 agent 型別，這是 Worker 的判斷。

### 回報時間

2026-10-20T17:25:26+0800
