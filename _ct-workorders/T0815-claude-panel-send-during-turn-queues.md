---
schema_version: 1
schema_kind: workorder
id: T0815
title: "PLAN-058 W0（方案 D）：Claude 面板主回合中送出改為排進同一個 query——不中斷、待送可取消、Esc 一併取消、提問卡等待時排隊並提示"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-03T21:31:40+0800"
started_at: ""
updated_at: "2026-11-03T21:31:40+0800"
completed_at: ""
session_ids: []
depends_on: [T0814, T0811]
related:
  - "PLAN-058；D259（改變 D214 P-2）；T0813 回報區〈2〉原型量測、〈3〉inbox 與待送 UI、〈4〉影響表、〈6〉W0 草案、〈8〉P-1 / P-3 / P-4；T0769 / BUG-192（背景子代理執行中注入、排隊提示）；T0759 / BUG-190；T0744（Cache History R 列）；T0762（權限卡 / 提問卡等待提示）；CLAUDE.md「Sub-agent / Active Tasks Tracking」「React Rendering」節"
affects_files:
  - electron/claude-agent-manager.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/types/claude-agent.ts
  - "electron/__tests__/claude-send-during-background-agent.test.ts（改寫 / 擴充）或新檔 `electron/__tests__/claude-send-during-turn.test.ts`"
  - src/__tests__/claude-panel-queued-message.test.tsx
  - e2e/v072-pre6-claude-panel.spec.ts
  - e2e/v072-real-model-claude-panel.spec.ts
  - "src/locales/**（三個 locale 的新字串）"
  - docs/agent-guide/claude-agent-sdk-cli.md
  - CLAUDE.md
  - _ct-workorders/T0815-claude-panel-send-during-turn-queues.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 行為（D259，使用者裁示）：① 主回合中送出 → 以 `streamInput` 排進目前的 query（每則帶 `uuid`），等 `command_lifecycle queued` 回執（上限 2 s）；reject 或無回執 → 走現行排隊（query 結束後 resume 送出）。🔴 不 abort、不另開 query、不清權限 / 提問卡、不加「已中斷」前綴、不送空白訊息（BUG-177）、同一則不得送兩次（以 uuid 去重，無回執才重送）。② 面板顯示「待送」＋取消（沿用 T0769 的 `claude:queued-messages` / `claude:cancel-queued-message` 與 `.claude-queued-note`）；取消改 `Query.cancelAsyncMessage(uuid)`（不在 `sdk.d.ts`，只經單一 helper 呼叫＋SDK 升版守門測試），失敗（已 started）→ 移出清單並提示。③ Esc（`stopSession`）：`interrupt()` 停目前回合，並一併取消所有待送訊息（與現行一致）。④ AskUserQuestion 卡（與權限卡）等待時送出 → 排隊到回答之後（CLI 行為），面板提示「請先回答上方問題」，不自動中斷提問。⑤ 停止 / 雙 Esc 不變。"
  - "🔴 其他必守（T0813〈6〉W0）：以 uuid 追蹤 `queued` / `started` / `completed` / `cancelled`；`resetQueryUsage` 移到某 uuid `started`（或沒有 uuid 的 `system/init`）時呼叫，不在送出時呼叫；有未完成的 uuid 時第一個 `result` 不結束「執行中」（主行程與 renderer 的 `isStreaming`），停止按鈕、T0762 等待卡、縮圖狀態要跟著正確；T0769 的背景子代理注入併入同一條路徑（不再限 `hasBackgroundTask`），T0759 規則不變；`exited with code` 的不 resume 重試只在尚未收到 `system/init` 時（T0769）不變；`flushSync` 規則照 CLAUDE.md React Rendering 節。"
  - "🔴 不回歸：e2e ⑦ / ⑦b / ⑦c、權限 allow / deny、BUG-177（`e2e/v072-pre7-claude-panel-ui.spec.ts`）、BUG-178、T0744 單元、`/resume`、圖片附件、雙 Esc 停止、T0814 的 dispose-session；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`。"
  - "🔴 驗收含真實模型：Haiku 5.5（`claude-haiku-5-5`）在 `e2e/v072-real-model-claude-panel.spec.ts` 加情境（回合中送出被排隊並回覆、Esc 後待送被取消且下一則正常、R 列與 `total_cost_usd` 相符），總共不超過 20 個 query 輪次；使用本機已登入的 claude，不登入 / 登出、不改 `~/.claude`；費用記入回報。假 API e2e 用 `e2e/fixtures/fake-anthropic-api.ts`（主回合以 gate 擋住時送第 2 則 → 待送提示 → 放行後兩則都有回覆、沒有「已中斷」前綴；權限卡等待時送出 → 允許後折入；取消待送；Esc 取消待送）。單元＋突變檢查。"
  - "🔴 文件：`docs/agent-guide/claude-agent-sdk-cli.md` 新節（行為、uuid 追蹤、回執判斷、cancelAsyncMessage 守門）；CLAUDE.md「Sub-agent / Active Tasks Tracking」節把 T0769「主回合中送出（中斷＋重送）不變」改成新行為（遵守 CLAUDE.md 撰寫規則）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）。"
---

# T0815 — Claude 面板主回合中送出改為排隊（PLAN-058 W0，方案 D）

## 元資料

- **工單編號**：T0815
- **類型**：implementation
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T21:31:40+0800
- **預估規模**：M
- **前置**：T0814（W1）、T0811（同一 checkout 改 `CLAUDE.md`）完成後才派

## 背景

現行 Claude 面板在主回合進行中送出 = 中斷＋重送（D214 P-2）：abort 目前回合、清權限 / 提問卡、加「已中斷」前綴後重送。T0813 實測（SDK 0.3.316 / CLI 2.1.316）：現行「每則訊息一個字串 prompt query」在主回合中呼叫 `Query.streamInput()`，CLI 一樣排隊並在第 1 個 `result` 後跑第 2 回合（6/6），以 `command_lifecycle` 回執（帶 `uuid`）可確認送達，`result` 之後的窗口會 reject 或成功回執、沒有無聲遺失；不需常駐程序。使用者 2026-11-03 裁示（D259）：改成排隊、Esc 一併取消待送、提問卡等待時排隊並提示；常駐程序（方案 B）延後。

## 範圍

見 memory_overrides。原型量測與設計細節以 T0813 回報區為準。

## 不做

- 常駐程序 / inbox（方案 B）、`setEffort` 改即時、Settings 開關（D259：不加）、發版、push。

## 驗收

- [ ] 實作說明（送出分支、uuid 追蹤、回執判斷、isStreaming 規則、取消 helper）
- [ ] 單元＋突變檢查
- [ ] 假 API e2e 情境結果
- [ ] 真實模型（Haiku 5.5）結果、輪次與費用
- [ ] 不回歸清單結果；typecheck 0 / 0、unit、legacy、vite build
- [ ] 文件更新

---

## 回報區

<!-- Worker 由此往下寫 -->
