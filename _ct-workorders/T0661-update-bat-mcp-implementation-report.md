---
schema_version: 1
schema_kind: workorder
id: T0661
title: "更新 BMad-Guide 根目錄《BAT MCP Server 規格提案 — 實作報告.md》：從 `v0.7.0-pre.1` 補到 `v0.7.1-pre.2`（M1 / M1b / W1、Worker 啟動確認、Worker 問塔台、session 識別、本批修正）"
type: docs
status: TODO
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M
created_at: "2026-10-18T20:59:00+0800"
depends_on: []
related:
  - "使用者 2026-10-18 20:2x 指示：發版後更新 `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\BAT MCP Server 規格提案 — 實作報告.md`（現況停在 2026-10-17 / `v0.7.0-pre.1`）"
  - "來源（只讀）：PLAN-047 / PLAN-048 / PLAN-050 / PLAN-051；工單 T0582（唯讀查詢 channel）、T0583 / T0585 / T0589（worktree 隔離派工與狀態）、T0584 / T0586（BAT MCP shim、codex env）、T0590 / T0594 / T0596 / T0597 / T0620 / T0621 / T0657（blocked 偵測與清除）、T0600（Worker 啟動確認）、T0606–T0611（Worker 問塔台）、T0640–T0644（session 識別）、T0647 / T0648 / T0651（PLAN-051 評估、codex daemon）、T0649–T0660（本批修正）、CT-T015–CT-T021；`_decision-log.md` D149–D170；`release-note.md` / `CHANGELOG.md` 各版；README「與 BMad Control Tower 協作」版本對照表；CLAUDE.md 與 `docs/agent-guide/` 對應節"
affects_files:
  - "D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\BAT MCP Server 規格提案 — 實作報告.md（本 repo 以外，BMad-Guide 根目錄 repo）"
  - _ct-workorders/T0661-update-bat-mcp-implementation-report.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **只改那一個外部檔案與本工單**。不改 BMad-Guide repo 的其他檔案，不改本 repo 的產品檔。BMad-Guide repo 的 commit：只 `git -C \"D:/ForgejoGit/@Gower_Labs/BMad-Guide\" commit --only \"BAT MCP Server 規格提案 — 實作報告.md\"`（該 repo 另有不相干的髒檔，不得帶入）；🔴 **不 push 任何 repo**。本 repo 只 commit 本工單檔。"
  - "🔴 保留原文件的結構、語氣與證據等級標記（[實測] / [碼] / [文件] / [推論]）；更新日期與作者行（日期取系統時間）。每個新增的事實都要對得上來源（工單回報區、決策、release note、程式碼位置），不得憑記憶；查不到就不寫或標 [推論]。內部編號（T / D / BUG / PLAN / CT-T）在這份內部報告中可以使用。"
  - "🔴 要更新的重點（依原章節）：§1 摘要（已實作範圍與發佈版本線 `v0.7.0-pre.1` → `v0.7.1-pre.2`、CT 對應版本 v5.2.4 → v5.9.0）；§3 已實作（新增各批：M1、W1、M1b、Worker 啟動確認、Worker 問塔台、session 識別、本批修正，每批列工單 / commit / 驗證 / 發佈版本）；§5 研究結論中已被後續實作推翻或修正的地方（例：codex blocked 偵測最終採 OSC 7501 而非 OSC 9 `-c tui.notifications`；PLAN-051 對 SendMessage / `codex queue` 的前提更正）；§6 待決議題的最終狀態（Q3 / Q4 / Q5 / Q8 / Q12 / Q13 / Q14 等哪些已定案、怎麼定）；§7 後續階段表的狀態（M1 / M1b / W1 / CT-T015 / CT-T016 已完成；M2 / M3 仍未排期；PLAN-051 維持 IDEA）；§8 已知限制（移除已解決的、補上仍有效的，例如未實機驗證項目）；§9 參考。"
  - "🔴 `v0.7.1-pre.2` 的發佈資訊（發佈時間、CI run、server bundle）以 `gh release view v0.7.1-pre.2 -R gowerlin/better-agent-terminal --json publishedAt,url,assets` 與 `gh run list -R gowerlin/better-agent-terminal --workflow pre-release.yml -L 1` 取得；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），只讀。"
  - "🔴 實機驗收狀態照實寫：已安裝版實機驗收過的（例如 T0601 / T0612 / T0645 等）與只有原始碼 / 測試證據的分開。"
---

# T0661 — 更新 BAT MCP 實作報告

## 背景

BMad-Guide 根目錄的《BAT MCP Server 規格提案 — 實作報告.md》是 BAT 塔台給提案者的實作報告，最後更新 2026-10-17，只寫到第一批（範圍權杖 A1 / A2 等，`v0.7.0-pre.1`）。之後 M1（唯讀查詢 + MCP shim）、W1（worktree 隔離派工）、M1b（blocked 偵測，含 codex OSC 7501）、Worker 啟動確認、Worker 問塔台（PLAN-048）、Claude session 識別（PLAN-050）陸續完成並發佈到 `v0.7.1-pre.2`，CT 也從 v5.2.4 走到 v5.9.0。使用者要求發版後更新這份報告。

## 要做的事

1. 讀原報告與上列來源，整理各批的工單、commit、驗證、發佈版本、CT 對應版本。
2. 依 memory_overrides 的重點逐章更新；新增章節可以，但保留原有編號與結構。
3. 自我檢查：每個版本號、commit、run id 都能在來源找到；Markdown 表格欄數正確。

## 驗證

- 報告內引用的本 repo 檔案路徑存在（grep 確認）
- 版本號 / commit / run id 抽查 10 個以上，列在回報區
- Markdown 預覽無破表（可用任何 Markdown 解析器檢查表格欄數）

## 驗收

- 報告更新到 `v0.7.1-pre.2`，各章與來源一致
- 回報區附：更新章節摘要、抽查清單、BMad-Guide repo 的 commit hash、仍標 [推論] 的項目
- 只改 `affects_files`；未 push
