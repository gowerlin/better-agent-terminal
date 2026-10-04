---
schema_version: 1
schema_kind: bug
id: BUG-109
title: "/snippet 情境 prompt 寫死 macOS 路徑 ~/Library/Application Support/better-agent-terminal/snippets.json；Windows / Linux / 遠端視窗皆錯（snippet 已改 ALWAYS_LOCAL，遠端 agent 讀不到本機 DB）"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-10-05T05:51:45+08:00"
updated_at: "2026-10-05T07:01:31+08:00"
impact:
  - snippets
  - claude-panel
links:
  fix_workorder: T0441
  related: [T0421, T0422]
---

# BUG-109 — /snippet prompt 寫死 macOS 路徑

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low |
| 可重現 | always（程式碼證據） |
| **狀態** | ✅ FIXED |
| 回報者 | T0421 Worker（「遭遇問題」1） |

## 現象

- `ClaudeAgentPanel.tsx`（約 :1431）`/snippet` 情境 prompt 寫死 `~/Library/Application Support/better-agent-terminal/snippets.json`，叫 agent 用 Read / Write 工具改 JSON
- Windows / Linux 路徑不同；且 snippet 實際存於 better-sqlite3（是否仍有 `snippets.json` 待確認）
- T0422 讓 `snippet:*` 變 ALWAYS_LOCAL 後，遠端視窗的 agent 跑在遠端，更不可能讀寫本機 snippet

## 修復方向（待 T0441 確認）

prompt 改為注入 snippet 清單 / 經 IPC 操作，不叫 agent 直接改檔；或遠端視窗停用該流程並提示。

## 修復（T0441，2026-10-05T07:01:31+08:00）

- **現況確認**：snippet 不在 better-sqlite3，而是 `electron/snippet-db.ts` 的記憶體 store，持久化到 `app.getPath('userData')/snippets.json`；**只在建構時 `load()` 一次、無 watch / reload**。⇒ 即使在 macOS 本機、路徑正確，agent 直接改 JSON 也看不到（直到重啟），且會被 BAT 下次 `save()` 覆蓋。修法 (a)「改帶正確路徑」因此本機也不成立。
- **修法**：採 (b) 的唯讀變體——新增 `src/lib/snippet-context.ts` `buildSnippetContextPrompt()`，prompt 直接注入由本機 `snippet:*` IPC（T0422 ALWAYS_LOCAL）取得的 snippet 清單**含內容**（單筆 2000 字、總 20000 字上限，超出僅列標題），**不含任何路徑**，明示 agent 不得尋找 / 讀寫 snippet 檔案或 DB；建立 / 修改 / 刪除由 agent 給出精確變更、使用者在 BAT Snippets 面板套用。
- **遠端視窗**：清單在本機 renderer 取得後以文字送給遠端 agent，行為與本機視窗一致，不需停用。
- `ClaudeAgentPanel.tsx` 與 `CodexAgentPanel.tsx`（同段重複碼，該分支因 `isCodexSession = true` 實為 dead code）皆改呼叫 helper。
- 測試：`src/lib/__tests__/snippet-context.test.ts`、`src/__tests__/snippet-prompt-no-path.test.tsx`（本機 / 遠端視窗、兩個 panel 原始碼不含 `~/Library` / `snippets.json`）。
