---
schema_version: 1
schema_kind: bug
id: BUG-178
title: "Claude 面板讀 session 歷史 / session 清單 / plugins 時不理 `CLAUDE_CONFIG_DIR`（固定讀 `os.homedir()/.claude`），設了該變數的使用者 resume 後歷史是空的"
status: CLOSED
severity: low
reproducibility: always
created_at: "2026-11-01T11:17:31+0800"
updated_at: "2026-11-01T17:57:14+0800"
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
| **狀態** | 🚫 CLOSED（2026-11-01 塔台依 R-G003 結案）；原 ✅ FIXED：T0730（commit `6f7b3d53`），等驗收 |
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

## 修正（T0730，commit `6f7b3d53`）

- 新增唯一實作 `resolveClaudeConfigDir(env, homeDir, join?)`（`electron/claude-config-dir.ts`）：`CLAUDE_CONFIG_DIR` 去掉前後空白後非空就用它，否則 `<home>/.claude`；沒設或空字串時路徑與修正前相同。
- Claude 面板：`loadSessionHistory`、`listSessionsFallback`、`runQuery` 的 `plugins/installed_plugins.json` 改經 `panelClaudeConfigDir`（`electron/claude-agent-manager.ts`），env 取面板 spawn CLI 的 env（`sdkSpawnEnv`）。
- 同類問題一併修（沒設變數時行為不變）：`claude:scan-skills` / `claude:scan-star-commands` 的使用者 `commands/` / `skills/`、`claude:get-statusline-extras`（原本 `process.env.CLAUDE_CONFIG_DIR ||`，全空白值會被當路徑）、ct-config 預設值層的 Claude 手動安裝（T0711 記下的差異）。`bat-mcp-launch.ts` / `ct-install-detect.ts` 原本就正確，改成呼叫同一函式。ct-config global 層（`control-tower-data`）是 CT 自己的資料路徑，不動。
- 驗證：`electron/__tests__/claude-config-dir.test.ts`（設 / 未設 / 空字串 / 全空白、consumer、source guard）；e2e `e2e/v072-pre6-claude-panel.spec.ts` 第二個 test（`CLAUDE_CONFIG_DIR` 指到與暫存 home 分開的目錄：session 檔寫在該處、清單找得到、plugins 從該處載入且暫存 home 的誘餌不載、重開後 resume 歷史重建）2 passed，負向對照（修正前的 `claude-agent-manager.ts`）在 plugins 與歷史重建兩處都失敗；`test:unit` 352 檔全過、兩個 typecheck = 0、`vite build` 成功。

## 結案（2026-11-01T17:57:14+0800，BAT 第一百零三 session 塔台）

- 依全域 R-G003：修正隨 `v0.7.2-pre.7` 交付；T0737（`cb22545b`）從介面驗：session 檔、`/resume` 清單與接續、plugins 斜線選單、塔台總覽 `*config` 預設值層都讀 `CLAUDE_CONFIG_DIR`，HOME/.claude 誘餌未被讀寫；e2e ⑪ / ⑫ 重跑綠。
- closed_reason: verified
