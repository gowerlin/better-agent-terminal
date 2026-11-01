---
schema_version: 1
schema_kind: bug
id: BUG-178
title: "Claude 面板讀 session 歷史 / session 清單 / plugins 時不理 `CLAUDE_CONFIG_DIR`（固定讀 `os.homedir()/.claude`），設了該變數的使用者 resume 後歷史是空的"
status: FIXING
severity: low
reproducibility: always
created_at: "2026-11-01T11:17:31+0800"
updated_at: "2026-11-01T11:51:27+0800"
impact:
  - claude-agent-panel
links:
  discovered_in: "T0727 回報區〈發現的問題〉第 2 點（2026-11-01，讀程式碼＋CLI 實測；未在 BAT 內重現面板空歷史）"
  related: [T0730, T0727, T0711]
---

# BUG-178 — Claude 面板歷史 / plugins 不理 `CLAUDE_CONFIG_DIR`

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響設了 `CLAUDE_CONFIG_DIR` 的使用者） |
| 可重現 | 一定（推論；CLI 端已實測，BAT 面板端未實際重現） |
| **狀態** | 🔧 FIXING：T0730（2026-11-01 開單，使用者決定現在修） |
| 回報者 | T0727 Worker |

## 現象

- 預期：BAT 讀 Claude 的 session 檔與 plugins 清單時，與 CLI 寫入的位置相同（設了 `CLAUDE_CONFIG_DIR` 就用它）。
- 實際：`loadSessionHistory`、`listSessionsFallback` 讀 `os.homedir()/.claude/projects/<encoded cwd>`；`runQuery` 的 installed plugins 讀 `os.homedir()/.claude/plugins/installed_plugins.json`（`electron/claude-agent-manager.ts`）。CLI 2.1.316 在設定 `CLAUDE_CONFIG_DIR` 時把 session 檔寫到 `<CLAUDE_CONFIG_DIR>/projects/…`（T0727 原型實測）。
- 同 repo 的 `electron/bat-mcp-launch.ts`、`electron/ct-install-detect.ts`、`electron/handlers/claude.ts` 都會優先用 `CLAUDE_CONFIG_DIR`，只有這幾處沒有。T0711 回報也提過設定面板「預設值」層的手動安裝偵測沒看 `CLAUDE_CONFIG_DIR`（後續候選）。

## 影響

設了 `CLAUDE_CONFIG_DIR` 的使用者：分頁還原 / resume 時面板歷史是空的（對話本身由 CLI 接上，畫面看不到舊訊息）；plugins 從錯的位置載入。

## 重現

設定 `CLAUDE_CONFIG_DIR=<某目錄>` 啟動 BAT → Claude Agent 分頁對話一輪 → 重開 BAT → 分頁 resume 後看歷史。

## 修正方向（待修正單評估）

- 這幾處改用與 `handlers/claude.ts` 相同的解析（`CLAUDE_CONFIG_DIR` 優先，未設才 `<home>/.claude`），抽成單一函式；env 來源以實際 spawn CLI 的 env 為準。
- 一併檢查 T0711 提到的設定面板「預設值」層。
- 以 `e2e/v072-pre6-claude-panel.spec.ts` 的方式驗證（改用 `CLAUDE_CONFIG_DIR` 隔離時 ④ resume 歷史仍重建）。
