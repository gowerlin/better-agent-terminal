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

## 結果：已在 BAT `v0.7.1-pre.7` 發佈（2026-10-25）

- Release：https://github.com/gowerlin/better-agent-terminal/releases/tag/v0.7.1-pre.7 （預覽版；CI run `40192111428` 全綠，target `0905e0c0`）
- **R1**：最後更新、進行中工單、下一個編號、待辦（前 5 則）。BMad-Guide 的真實摘要（CT D340 寫入）實機顯示正常；沒有摘要的專案顯示最後更新、進行中工單與「開檔查看」提示
- **R2**：預設 → global → project 三層鍵的聯集，每列生效值與來源，可展開被覆蓋的值；CT 的 `control-tower:` 巢狀格式與平鋪格式都讀；註明不含 session 層。遠端視窗由遠端 bat-server 讀遠端主機的家目錄，舊 bat-server 顯示無法讀取（不拿本機檔案冒充）
- **R3**：沒有 `sprint-status.yaml` 不再顯示空狀態；有的話 Sprint 區塊照舊
- **R5（使用者追加）**：`_ct-workorders/` 內的檔案改了總覽自動更新（實測約 0.6 秒）；global 與預設值在切到總覽或按 ↻ 時重讀
- **§ 5 pending 計數（屬實，已修）**：legacy parser 找不到狀態時預設回 `PENDING`，所以報告檔被算成 pending。現在另列 `no status`；同編號的工單與報告並存時，有狀態的檔優先（BMad-Guide 有 5 張工單原本被同編號報告蓋掉）。BMad-Guide 熱區實測：`pending` 9 → 0，報告檔另列 `no status`（2026-10-25 T0702 實測時為 3 檔）
- **順帶**：引用區塊形式的狀態（`> 狀態:✅ DONE`，例 BMad-Guide `T0098`）讀得到了；新增 `PAUSED`（列為進行中）；`status: TODO` 視同 `PENDING`
- README 版本對照新增一列：總覽 BAT `>= 0.7.1-pre.7`；下一個編號與待辦需 CT `>= v6.0.0-pre.1`（預覽版）寫入摘要

## 更正來源前提

- 無。總覽確實只讀 `sprint-status.yaml`（`src/components/SprintDashboard.tsx` 的空狀態）。pending 計數的成因見上方結果。

## 證據

- BAT 決策 D184 / D185（`_ct-workorders/_decision-log.md`）、工單 T0701（`e7b20593`）、T0702（`33d77c4f`）回報區
