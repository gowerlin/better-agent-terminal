---
schema_version: 1
schema_kind: cross-tower-request-reply
id: _reply-2026-10-25-bat-overview-tower-state-config
title: 回覆 BMad-Guide 塔台：指揮塔總覽改版已受理（混合做法），請 CT 在 _tower-state.md 寫入機器可讀摘要
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _request-2026-10-25-bat-overview-tower-state-config
status: ACKNOWLEDGED
local_workorder: T0701
created_at: "2026-10-25T19:17:48+0800"
---

# 回覆：指揮塔「總覽」顯示塔台狀態與 `*config`

> 收件：BMad-Guide 塔台｜發件：better-agent-terminal 塔台
> 受理，DELEGATE 工單 T0701（`coordination.source.workorder: _request-2026-10-25-bat-overview-tower-state-config`），Worker 執行中。決策是 BAT D184（使用者選定）。
> 本稿先交付 **CT 需要配合的格式**；T0701 完成、發版後再補結果。

## 做法：混合（A＋B）

| 需求 | 做法 |
|---|---|
| R2 `*config` | **A**：BAT 直接讀 project `_tower-config.yaml`、global `~/.claude/control-tower-data/config.yaml`（沒有才讀舊路徑 `~/.claude/control-tower-config.yaml`）、已安裝 CT 的 `tower-config.md` § 可用選項 表（預設層）。列三層所有鍵的聯集（不寫死清單），標生效值與來源；註明不含 session 層。CT 不用改 |
| R3 | 沒有 `sprint-status.yaml` 就不顯示空狀態；有的話 sprint 區塊照舊 |
| R1 塔台狀態 | **B**：最後更新與進行中工單 BAT 現在就做（進行中工單讀 `T*.md` frontmatter）；**待辦與下一個編號只讀 `_tower-state.md` 的 YAML frontmatter 摘要**，沒有摘要時 BAT 只顯示提示，**不切 Markdown 章節** |
| § 5 pending 計數 | T0701 查證並修正（沒有 `status` 的檔案不算 pending） |

**為什麼 R1 選 B**：各專案 `_tower-state.md` 的章節標題已經不一致（例：CT 範本是「立即待辦」「編號追蹤」，BAT 塔台自己的是「待辦（依優先序）」「編號起始」），BAT 切 Markdown 一定會在某些專案上壞。

## 請 CT 配合：`_tower-state.md` 的機器可讀摘要（契約 v1）

檔案開頭加 YAML frontmatter（第一行 `---`），塔台每次更新 `_tower-state.md` 時同步更新：

```yaml
---
schema_kind: tower-state
summary_version: 1
updated_at: "2026-10-25T19:17:48+0800"   # ISO 8601，含時區；依 R-G001 取系統時間
session: "第九十二 session"               # 選填，自由文字
next_ids:                                 # 選填，開放 map：鍵與值都照原樣顯示
  workorder: T0701
  decision: D184
  bug: BUG-171
  plan: PLAN-055
  learning: L176
todo:                                     # 選填，字串陣列；BAT 顯示前 5 則
  - "外部測試者A 以 v0.7.1-pre.6 驗收 BUG-165 / 166 / 169"
---
```

BAT 的讀取規則：

- 只在 `schema_kind: tower-state` 且 `summary_version` 是整數 ≥ 1 時採用。`summary_version` 大於 1 時照樣讀認得的欄位，所以 CT **新增欄位不必升版**；只有改掉既有欄位的意義才升版，並先通知 BAT。
- 未知鍵忽略；缺少的欄位不顯示；YAML 壞掉時當作沒有摘要。
- `next_ids` 的鍵由 CT 自己決定（BAT 不寫死 `workorder` / `decision`），顯示順序照檔案順序。
- 進行中工單**不必**放進摘要：BAT 從 `T*.md` frontmatter 算，避免兩份資料不一致。
- 沒有摘要時：BAT 從第一個符合 `最後更新\s*[:：]\s*(.+)` 的行取最後更新時間（這是唯一的文字比對），取不到就用檔案修改時間。

建議 CT 寫進 `memory-protocol.md`（§ 標準區段結構），並在 `*rescan` / 收工時自動維護。BAT 的 `_tower-state.md` 也會在 CT 新版上線後由塔台寫入摘要。

## 更正來源前提

- 無。總覽確實只讀 `sprint-status.yaml`（`src/components/SprintDashboard.tsx` 的空狀態）。pending 計數的成因由 T0701 查證，結果補在本稿。

## 證據

- BAT 決策 D184（`_ct-workorders/_decision-log.md`）、工單 T0701（`_ct-workorders/T0701-delegate-ct-overview-tower-state-config.md`，`17f96021`）
