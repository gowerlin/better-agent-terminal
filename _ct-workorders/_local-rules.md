# Local Rules — better-agent-terminal

> 本文件為本專案塔台附加規則，覆蓋 Core Skills 的預設行為。
> 載入優先級：Layer 3（最高優先）。
> 建立時間：2026-04-12 (UTC+8)（T0062 遷移產出）

---

## 擴充單據類型

本專案除標準工單（T####）外，額外使用以下單據：

| 前綴 | 用途 | 狀態流 |
|------|------|--------|
| `BUG-###-xxx.md` | 獨立 Bug 報修單 | 📋 REPORTED → 🔍 INVESTIGATING → 🔧 FIXING → ✅ FIXED → 🚫 CLOSED/WONTFIX |
| `PLAN-###-xxx.md` | 計劃 / Idea 記錄單 | 💡 IDEA → 📋 PLANNED → 🔄 IN_PROGRESS → ✅ DONE → 🚫 DROPPED |

---

## *sync 擴充掃描範圍

執行 `*sync` 時，除工單（T####）外，額外掃描以下文件：

| 檔案 | 掃描目的 |
|------|---------|
| `BUG-###-*.md` | Bug 單目前狀態（REPORTED / FIXED 等） |
| `PLAN-###-*.md` | 計劃單目前狀態（IDEA / DONE 等） |
| `_bug-tracker.md` | Open Bug 數量摘要 |
| `_backlog.md` | Active Idea / Plan 數量摘要 |
| `_decision-log.md` | 最新決策條目 |

---

## Bug 報修流程

**觸發**：發現新 Bug 需記錄時

**步驟**：
1. 分配下一個 BUG 編號（當前最大 + 1，3 位數）
2. 建立 `_ct-workorders/BUG-###-<title>.md`（複製模板，最少填：標題 + 現象描述）
3. 更新 `_ct-workorders/_bug-tracker.md` Open Bugs 表格
4. 更新 `_tower-state.md` 中 BUG 最大編號
5. 回塔台確認

**最少必填欄位**（其餘可後補）：
- 標題
- 嚴重度
- 現象描述（預期 vs 實際）

---

## PLAN 記錄流程

**觸發**：有新 Idea 或功能需求需記錄時

**步驟**：
1. 分配下一個 PLAN 編號（當前最大 + 1，3 位數）
2. 建立 `_ct-workorders/PLAN-###-<title>.md`（複製模板，最少填：標題 + 動機）
3. 更新 `_ct-workorders/_backlog.md` Active 表格
4. 更新 `_tower-state.md` 中 PLAN 最大編號
5. 回塔台確認

**最少必填欄位**（其餘可後補）：
- 標題
- 動機 / 背景（一句話）

---

## 索引同步原則

**規則**：凡修改任何 BUG / PLAN 單據的狀態，**必須同步更新對應索引**。

| 修改的文件 | 必須同步更新 |
|-----------|------------|
| BUG-###.md 狀態變更 | `_bug-tracker.md` 對應列 |
| PLAN-###.md 狀態變更 | `_backlog.md` 對應列 |
| 任何上述變更 | `_tower-state.md` 基本資訊中的統計數字 |

---

## 編號規則

| 類型 | 格式 | 起始 | 範例 |
|------|------|------|------|
| 工單 | T#### | T0001 | T0063-next-task |
| Bug | BUG-### | BUG-001 | BUG-016-new-bug |
| PLAN | PLAN-### | PLAN-001 | PLAN-001-agent-orchestration |
| 決策 | D### | D001 | D018-new-decision |

塔台在 `_tower-state.md` 的「基本資訊」中維護各類型的最大編號。

---

## 模板位置

建立新單據時使用以下格式：
- BUG 格式：參考 `BUG-001-claude-oauth-paste-truncated.md` 或 T0061 回報區模板
- PLAN 格式：參考 T0061 回報區模板
