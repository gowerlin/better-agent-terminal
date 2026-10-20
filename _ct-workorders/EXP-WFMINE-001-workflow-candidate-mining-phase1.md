# EXP-WFMINE-001 — Workflow 候選挖掘 Phase 1 試點（BAT 工單全讀）

## 元資料

| 欄位 | 內容 |
|------|------|
| **編號** | EXP-WFMINE-001 |
| **TOPIC** | WFMINE（Workflow 候選挖掘系列） |
| **狀態** | 🧪 RUNNING |
| **建立時間** | 2026-10-20 16:40 (UTC+8) |
| **驅動** | BMad-Guide 提案 `D:\ForgejoGit\@Gower_Labs\BMad-Guide\_ct-workorders\_proposal-2026-10-20-ct-workflow-intelligence.md` §6.2「先行試點」（提案狀態 PROPOSED，CT 主責、BAT 協作試點） |
| **規則所有權** | **CT**（BMad-Guide 塔台）。本 EXP 只產證據，不定規則；定案後由 CT 以 CT-T### 回歸 CT repo |
| **執行單** | T0673（helper `--workorder` 只接受 `T####` / `XX-T####`，EXP 編號不能直接派工） |
| **執行方式** | 全讀 Workflow（使用者 2026-10-20 選定；約 45 個 agent、預估 4.5–5M tokens、硬上限 5.5M） |
| **Worktree** | 不建（唯讀分析，不改產品程式碼） |

---

## 實驗假設

依提案 §5.1 的偵測訊號 S1–S5 與排除條件 X1–X4 全文閱讀本專案工單，**至少能找出 3 個附證據的 Workflow 候選**（提案 §7 P1 驗收條件）。§5.1.4 依檔名推測的 11 張例子，讀過內容後可以逐張確認或推翻。

## 語料（2026-10-20 塔台量測）

- `_ct-workorders/T*.md`（179）+ `_archive/workorders/T*.md`（513）+ CT-T + `_archive` 內的 EXP，共 **718 檔**，約 9.6 MB，估約 **3.1M tokens**
- 輔助資料（S3 推翻／退回證據）：`_decision-log.md`、`_learnings.md`

## 成功條件

1. 候選排行有 ≥ 3 個候選，每個都依提案 §5.1.3 格式列出證據工單
2. §5.1.4 的 11 張（T0627、T0629、T0559、T0561、T0602、T0034、T0102、T0121，以及反例 T0075、T0083、T0094）逐張判定「確認／推翻」，並附理由
3. 報告附遺漏清單（沒讀到或被略過的檔案），不得靜默截斷（提案 R2）
4. 實際 token 用量 ≤ 5.5M

提案 §7 的「人工抽驗 ≥ 70% 認同」由使用者或 BMad-Guide 塔台判定，不算在本 EXP 的成功條件內。

## 範圍外

- 不改 `_learnings.md`、`_local-rules.md`、CT skill（含 `analysis-rules.md`），也不改 `src/` / `electron/` / `scripts/`
- 不建 `.claude/workflows/` 具名 workflow
- 不寫入 BMad-Guide repo

## 結論

（T0673 完成後由塔台填寫）
