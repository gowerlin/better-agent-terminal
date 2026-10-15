---
schema_version: 1
schema_kind: plan
id: PLAN-042
title: T0534 研究順帶發現的問題：已結束分頁 ⏻ 無效、Windows 關閉分頁的子程序樹、派工日誌欄位、CT 文件落差
status: DONE
priority: low
created_at: "2026-10-15T16:13:05+0800"
updated_at: "2026-10-15T17:30:31+0800"
target_batch: "0.6.1-pre.3"
workorders: [T0539, T0540, CT-T012]
links:
  related: [T0534, BUG-137, PLAN-041]
---

# PLAN-042 — T0534 衍生修正

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-042 |
| 優先級 | 🟢 Low（T0540 為 P2：PLAN-041 自動回收會讓關閉路徑被頻繁使用） |
| 狀態 | ✅ DONE（2026-10-15 16:13 開立；T0540 `a058fbd4` 17:20、T0539 `2ff55bdd` 17:30（BUG-137 FIXED）、CT-T012 於 CT v5.1.0（BMad-Guide `cb2aa09`）；BAT 部分隨 0.6.1-pre.3 發佈） |
| 來源 | T0534 回報區 §8 |

## 項目

| # | 問題 | 歸屬 | 工單 |
|---|---|---|---|
| 1 | 程序已結束的分頁按 ⏻ 沒有反應（`PtyManager.restart` 回 `false`，UI 未檢查） | BAT | BUG-137 → **T0539** |
| 2 | Windows Terminal Server 模式 `killPty` 沒有 `taskkill /T`，shell 底下的 agent CLI 可能殘留（未實測） | BAT | **T0540** |
| 3 | helper 派工日誌 `sourceTerminalId` 永遠為空（`bat-terminal` 不送 `BAT_TERMINAL_ID`） | BAT | **T0539**（併入） |
| 4 | CT `result=true` 與 BAT `result: 'ok'` 不一致；`yolo-mode.md` 與 `ct-exec` 對 notify 失敗時工單狀態的描述不同 | CT | **CT-T012** |
| 5 | `~/.codex/AGENTS.md`（來自 CT 安裝指南）派工範例少 `--cwd` / `--no-interactive`，誤列 `BAT_TOWER_TERMINAL_ID` | CT | **CT-T012** |

## 排程

- 與 PLAN-041 同批（`0.6.1-pre.3`）。BAT 工單依序派發，不並行（同一工作樹的 vite build / 隔離實例會互相干擾）：T0535 → T0536 → T0537 → T0538 → T0540 → T0539。
- T0540 原為 T0535 驗收的一項（Windows 子程序是否結束），改由 T0540 專責；T0535 只要求不退化。
- CT-T012 與 CT-T011 由 BMad-Guide 塔台執行，同一個 CT 版本發佈。
