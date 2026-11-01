---
schema_version: 1
schema_kind: workorder
id: T0769
title: "修正 BUG-192：背景子代理執行中送出新訊息改為注入同一個 query（不中止子代理），送不進去時排隊並顯示、可取消"
type: implementation
status: PENDING
updated_at: "2026-11-02T03:22:26+0800"
session_ids: []
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T03:22:26+0800"
depends_on: [T0767]
related:
  - "BUG-192；D214（P-1–P-4）；T0768 回報區（查證 ①–④、方案 C、〈實作單草案〉為本單規格來源）；T0759 / BUG-190（背景子代理規則）；T0744（Cache History）；BUG-177（空 prompt）"
  - "`electron/claude-agent-manager.ts`（`sendMessage`、`runQuery`、`stopSession`、`resetQueryUsage`、`messageQueue`）、`src/components/ClaudeAgentPanel.tsx`、`node_modules/@anthropic-ai/claude-agent-sdk`（`Query.streamInput`、`perTaskStopAffordance`）、`e2e/v072-pre6-claude-panel.spec.ts`、`e2e/fixtures/fake-anthropic-api.ts`"
affects_files:
  - electron/claude-agent-manager.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/types/claude-agent.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - src/**/__tests__/
  - e2e/v072-pre6-claude-panel.spec.ts
  - e2e/fixtures/fake-anthropic-api.ts
  - docs/agent-guide/claude-agent-sdk-cli.md
  - CLAUDE.md
  - _ct-workorders/T0769-fix-bug192-inject-message-during-background-agent.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 規格來源：T0768 回報區〈3. 建議〉與〈4. 實作單草案〉做法 1–5、必守規則、驗收清單，照做。D214：P-1 注入失敗退回排隊時，在該訊息下顯示「等背景子代理結束後送出」＋取消按鈕（取消 = 從 `messageQueue` 移除，三語系）；P-2 主回合本身還在跑時送出 → 維持現行「中斷＋重送」（不改）；P-3 雙 Esc / 停止按鈕維持結束整個 query 含背景子代理（不改）；P-4 常駐串流輸入不做（PLAN-058）。"
  - "🔴 必守：背景子代理執行中不得 `abort()` 或另開 query（同一 session 不得同時兩個 CLI 程序）；注入路徑不清 `pendingPermissions` / `pendingAskUser`、不加「使用者先前的訊息（已中斷）」前綴；不送空白訊息（BUG-177）；T0759 規則不變（背景項目只由 `task_notification` 或 query 結束清除）；注入回合要有獨立的 Cache History R 列（注入時 `resetQueryUsage`，`turnModelUsage` 不改）；宣告 `perTaskStopAffordance: true` 後 Esc 只停回合；`exited with code` 的「不 resume 重試」只在尚未收到 `system/init` 時做。"
  - "🔴 驗收：T0768〈4〉的單元清單＋突變檢查（拿掉注入分支 → 失敗）；假 API e2e ⑦c（主回合結束後送出 → 立即回覆、task bar 仍 1 項、卡片沒有 `Agent terminated unexpectedly`；放行後 completed；注入回合中 Esc → 背景子代理仍 running）＋排隊顯示與取消（造「輸入已關」情境，或照實寫不能造的原因並以單元測試涵蓋）；驗紅（換回修正前 build → ⑦c 失敗）。不回歸清單照 T0768〈4〉（⑦ / ⑦b、權限 allow / deny、BUG-177、BUG-178、T0744 R 列、`/resume`、圖片附件、主回合中送出的中斷＋重送、雙 Esc）。"
  - "🔴 與 T0762 重疊：`src/components/ClaudeAgentPanel.tsx`、`e2e/v072-pre6-claude-panel.spec.ts`、locales 也可能在 T0762（Claude 面板 ⚠️）範圍內。動工前與 commit 前各 `git diff <檔>`：有別人的未提交修改就等對方 commit 後再改。"
  - "🔴 驗證：新增 / 修改的單元測試＋突變檢查（拿掉修正，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`（依上方 build 規則的位置）。"
  - "🔴 build（Lane B：T0758 → T0759 → T0760，與 Lane A 並行）：主 checkout 的 `dist` / `dist-electron` 可能正被 Lane A 的 e2e 使用。`npx vite build` 與 e2e 一律在 `git archive` 匯出目錄做（`%TEMP%/bat-<工單>-build`，`node_modules` 以 junction 共用主 checkout，T0742 作法）；主 checkout 只跑 `npm run typecheck` / `npm run typecheck:electron` / `npm run test:unit`。跑完刪匯出目錄（先刪 junction 本身，確認主 checkout `node_modules/electron` 仍在）。e2e 一律用隔離實例。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0769 — 修正 BUG-192：背景子代理執行中送出新訊息改為注入同一個 query（不中止子代理），送不進去時排隊並顯示、可取消

## 元資料

- **工單編號**：T0769
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-02T03:22:26+0800
- **預估規模**：M

## 背景

BUG-192：Claude 面板的背景子代理執行中送出新訊息，會中止整個 query、子代理一起被結束。T0768 研究：主回合 `result` 之後 query 仍開著，可用 `Query.streamInput()` 注入同一個 query，子代理不受影響；送不進去時排隊、等 query 結束後以 resume 送出（模型看得到子代理結果）。使用者全採建議（D214）。

## 範圍

1. 注入路徑＋排隊退路（顯示、可取消）。
2. `perTaskStopAffordance`、`stopSession` 的 `isStreaming` 修正、retry 防護、`resetQueryUsage` 時機。
3. 單元、假 API e2e、文件。

## 不做

- 不改主回合進行中送出的行為；不改雙 Esc / 停止；不做常駐串流輸入（PLAN-058）；不用真實模型；不發版。

## 驗收

- [ ] 單元＋突變；e2e ⑦c＋驗紅；不回歸清單
- [ ] typecheck 0 / 0、`test:unit`、`vite build`（匯出目錄）
- [ ] 文件更新

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
