---
schema_version: 1
schema_kind: bug
id: BUG-162
title: "claude Worker 的 Bash 權限請求被放行後（未經鍵盤），分頁仍維持 `blocked` / `permission`（縮圖 ⚠️）直到該回合 `Stop`"
status: CLOSED
closed_at: "2026-10-18T22:24:09+0800"
closed_by: "使用者（T0664 安裝版 0.7.1-pre.2 自動化驗收）"
fixed_at: "2026-10-18T19:52:06+0800"
fixed_by: T0657
fix_commit: "ff14fa5d"
severity: medium
reproducibility: observed（2026-10-18 19:22:52，T0656 Worker，`v0.7.1-pre.1` 安裝版）
created_at: "2026-10-18T19:30:08+0800"
impact:
  - blocked-state
  - worker-attention-badge
  - ct-breakpoint-d
links:
  discovered_in: "使用者 2026-10-18 19:2x 截圖：T0656 Worker 縮圖顯示 ⚠️，但 Worker 仍在執行、沒有等使用者輸入"
  related: [T0590, T0594, T0597, T0609, T0620, T0656, T0657]
---

# BUG-162 — 權限請求放行後 ⚠️ 不消失

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（誤報「Worker 在等你」：使用者被誤導、CT 斷點 D 可能誤告知；批次關閉也會把它排除） |
| 可重現 | T0657 查明：claude 內建「危險 rm」安全檢查在 bypass 下仍顯示權限對話框（先執行 `PermissionRequest` hook），無人回答時 120 s 逾時自動拒絕，回合繼續 |
| **狀態** | 🚫 CLOSED（T0657 `ff14fa5d` 修正；2026-10-18 T0664 安裝版 `0.7.1-pre.2` 自動化驗收 PASS，使用者同意結案） |

## 現象

- debug log `debug-20261018-175554.log`：`[2026-10-18T11:22:52.774Z] [blocked] terminal=9e13a140… → blocked reason=permission (hook permission-request tool=Bash)`。
- 之後 Worker 持續執行（輸出不斷、模型思考中），使用者沒有在該分頁輸入；`bat_get_state` 仍回 `blocked` / `permission` / `source: hook`，縮圖 ⚠️。
- 預期：權限請求結束（允許 / 拒絕 / 自動放行）後清除 `blocked`。

## 已知背景（`docs/agent-guide/blocked-state.md`「已知限制」）

- 清除只有：`UserPromptSubmit` / `Stop`（任何 reason）、`PostToolUse(AskUserQuestion)`（只清 `question`）、`elicitation-done`（只清 `elicitation`）、使用者鍵盤輸入、PTY 結束、recovery。
- 「權限對話框以滑鼠允許或拒絕」未涵蓋，`blocked` 維持到該回合 `Stop`；文件列的候選是 `PostToolBatch`（或全工具 `PostToolUse`），成本是每批 / 每次工具呼叫都啟動 node，需塔台決定。
- 未知：CT yolo Worker 以 `--dangerously-skip-permissions` 啟動（使用者 Agent 自訂參數），一般工具不應有權限提示；這次 Bash 為何仍執行 `PermissionRequest` hook、之後由誰放行（自動模式分類器？受保護路徑？其他 hook？），待 T0657 查明。

## 實機驗收（T0664，2026-10-18）

- 已安裝 `0.7.1-pre.2`（FileVersion 與隔離實例 `app.getVersion()` 相符），Playwright 隔離實例。
- V0 安裝版設定檔含 `PostToolBatch`（async、無 matcher），內嵌 claude 2.1.300；V1 合成 hook：批次結束清除、subagent 不被主執行緒批次誤清；V2 真實 claude（haiku 1 回合）危險 rm 安全檢查 120 s 自動拒絕，`post-tool-batch` 清除早於 `Stop`，無使用者輸入
- 使用者 2026-10-18 22:24 同意 CLOSED。
