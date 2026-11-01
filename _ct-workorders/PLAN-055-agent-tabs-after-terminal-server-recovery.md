---
schema_version: 1
schema_kind: plan
id: PLAN-055
title: "Terminal Server recovery 後 agent 分頁不再無聲變成 shell：列出被中斷的 agent 分頁，claude 分頁保留 session id 並提供 `--resume`"
status: DONE
updated_at: "2026-11-02T05:26:29+0800"
completed_at: "2026-11-02T05:26:29+0800"
priority: medium
created_at: "2026-10-25T21:16:40+0800"
links:
  source: "T0703 回報區「建議方向」C（BUG-171）；D186"
  related: [BUG-171, T0703, T0704, T0642, T0112]
---

# PLAN-055 — recovery 後的 agent 分頁

## 動機

Terminal Server 真的死掉時，`handleServerDeath` 只重建 shell、不重跑 agent（T0112 起的設計），分頁上原本的 claude / codex 會無聲消失，只剩 `$` 提示字元。BUG-171 一次結束了 5 個塔台與 1 個 Worker，使用者要自己記得哪些分頁原本在跑什麼、再一個個 `claude --resume`。T0704 修掉誤判後，這種情況只會在 server 真的崩潰時發生，但那時損失一樣看不見。

## 方向（T0703 建議 C，未定案）

- recovery 後 renderer 明確列出哪些 agent 分頁被重建（含工作區、分頁標題、Worker 工單）。
- claude 分頁保留 `claudeSessionId`（`ClaudeSessionPersistence`，T0642；recovery 時目前會清除），提供「重新啟動並 `--resume <id>`」。
- 或把被中斷的 agent 分頁標成「agent 已中斷」，而不是只顯示新 shell。
- headless 有自己的 PTY 生命週期，要另外評估。
- Worker 分頁被中斷時是否通知塔台（會牽涉 BAT ↔ CT 契約，需另議）。

## 研究結果（T0765，2026-11-02T02:30:22+0800）

- **現況**：`handleServerDeath`（`electron/pty-manager.ts`）以同 id 只重建 shell；`blockedTracker.clearAll` 連 `claudeSessionId` 一起清掉，`onServerRecovery` 再把 `claude-sessions.json` 改寫成沒有 session id。`agentPreset`、`customEnv`、`workorder`、`role`、`launchRole`、`--name` 名稱都還在；codex session id BAT 從未取得。renderer 只有 3 s toast，沒有分頁清單。
- **設計**：`clearAll` 前取「被中斷 agent 分頁」快照（含 session id）→ 事件＋pull 查詢 → 對話框（依工作區分組）＋分頁「agent 已中斷」標示；claude 以原組裝點加 `--resume=<id>`（使用者分頁 `startClaudeCliPty`、派工分頁 `createAgentPromptCommandBuilder`，BAT MCP / hooks / `--name` 照舊、不加 `--fork-session`）；codex 送 `codex resume`（picker，cwd 篩選）；Worker 可 resume、不通知塔台。
- **方案**：A 只列出（S）／**B 列出＋一鍵恢復（M，建議，拆 B1 / B2）**／C 全自動＋通知塔台（M–L，需 CT 契約）。
- **待決點** P-1–P-8（自動 resume、Worker 附帶 prompt、通知塔台、codex、跨重開保留、「重新開始」路徑、SessionEnd hook、拆單）與 B1 實作單草案：見 T0765 回報區。

## 塔台決定（2026-11-02T02:32:46+0800，D211）

- 使用者全採 T0765 建議（P-1–P-8：不自動、Worker 不附 prompt、不通知塔台、codex 用 `codex resume` 選單、清單只到 BAT 關閉、「重新開始」路徑不做、不加 SessionEnd hook、拆兩張）。
- 實作：B1 → T0766（快照、列表、分頁標示、claude 一鍵 `--resume`）、B2 → T0767（codex 恢復）；排進本批，與 `0.7.3-pre.4` 一起發。

## 完成（2026-11-02T05:26:29+0800，第一百零四 session）

- 實作：B1 T0766（`cb263cc1`）、B2 T0767（`5d104926`），隨 `v0.7.3-pre.4` 交付。
- 驗收（R-G003）：交付版 `v0.7.3-pre.4` 安裝版自動化實測 T0773（`bb376b41` / 回報 `02679359`，D215）：隔離實例只結束自己的 Terminal Server → toast 中斷數 2、對話框列 claude 與 codex（不列 shell）、⏸ ×2、不自動恢復；真的 claude 以 `--resume=<同一個 id>`（`=` 形式、無 `--fork-session`、BAT 參數仍在）接回對話並答出 42（Haiku 5.5，3 回合 US$0.0197）；真的 codex 0.166.0 接受 `… resume`（命令列 = 第一次 + ` resume`，無 id、無 `--last`），未登入時先顯示登入畫面。t0766 / t0767 ×2 / t0704 安裝版全綠。
- 衍生：recovery 後自動開啟的對話框第一次按 Esc 關不掉（焦點仍在 xterm）→ BUG-194。
- 未涵蓋：已登入 codex 時的 resume 選單畫面本身。
