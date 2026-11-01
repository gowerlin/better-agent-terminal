---
schema_version: 1
schema_kind: workorder
id: T0769
title: "修正 BUG-192：背景子代理執行中送出新訊息改為注入同一個 query（不中止子代理），送不進去時排隊並顯示、可取消"
type: implementation
status: DONE
started_at: "2026-11-02T04:05:59+08:00"
updated_at: "2026-11-02T04:27:39+08:00"
completed_at: "2026-11-02T04:27:39+08:00"
session_ids:
  - "4c75c2e9-62b5-4f86-8f4d-dc83e1530f2f"
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

- **狀態**：DONE（三項驗收皆過；BUG-192 狀態由塔台改，本單未動 BUG 單）
- **產品 commit**：`9ab26222`（`fix: a message sent while a background agent runs goes into the same query instead of ending it (T0769, BUG-192)`，16 檔）
- **落點檢查**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 前 5 項皆存在；無 `branch`（C-2 不適用）。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` 已設（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- **與 T0762 重疊檢查**：動工前與 commit 前 `git status` 只有本單的檔；T0762 已 DONE，無他人未提交修改。
- **session_id**：4c75c2e9-62b5-4f86-8f4d-dc83e1530f2f

### 產出摘要

依 T0768〈3〉〈4〉做法 1–5 與 D214 實作，主行程 `electron/claude-agent-manager.ts`：

1. **注入**：`SessionInstance.mainTurnDone`（`runQuery` 開頭 / 注入時 false，`result` 時 true）。`sendMessage`：`isStreaming && mainTurnDone && queryInstance && hasBackgroundTask(session)` → `injectIntoOpenQuery`：廣播 user 訊息、`resetQueryUsage`、`currentPrompt = prompt`、`Query.streamInput(單則 SDKUserMessage)`；不 abort、不另開 query、不清 `pendingPermissions` / `pendingAskUser`、不加「已中斷」前綴。圖片 content blocks 抽成 `buildUserContent`（`runQuery` 第一則訊息與注入共用）。空白訊息（無圖）→ 不送、不中止（BUG-177）。
2. **排隊退路（D214 P-1）**：`streamInput` reject → 帶 `queuedId` 進 `messageQueue`，`claude:queued-messages` 送整份清單；query 結束時 finally 照現行 resume 送出（送出時再廣播清單）。reject 晚於 query 結束 → 直接 `runQuery`（不卡在佇列）。取消 `cancelQueuedMessage`（IPC `claude:cancel-queued-message`，回 `{ cancelled, idle }`）。各清空佇列處改經 `clearMessageQueue`（只在有列出的項目時通知 renderer）。
3. `queryOptions.perTaskStopAffordance: true`。
4. `stopSession`：interrupt 成功且仍有背景子代理 → 不把 `isStreaming` 設 false（由 finally 設）。
5. `runQuery` catch 的「`exited with code` → 不 resume 重試」只在尚未收到 `system/init` 時做（`sawInit`）。

Renderer：`ClaudeAgentPanel.tsx` 訂閱 `onQueuedMessages`（可選呼叫，舊 host / mock 不受影響），以 `placeQueuedMessages`（`src/types/claude-agent.ts`：先比 id、再比內容，每則訊息最多一次，其餘放最後）在該使用者訊息下顯示 `.claude-queued-note`「等背景子代理結束後送出」＋取消；取消成功且 `idle` → 結束「執行中」顯示。三語系 `claude.queuedUntilBackgroundDone` / `claude.cancelQueuedMessage`。IPC 接線：`electron/handlers/claude.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`electron/remote/protocol.ts`（`PROXIED_CHANNELS`）、`electron/remote/path-aware-channels.ts`（`PATH_FREE_CHANNELS`）。

文件：`docs/agent-guide/claude-agent-sdk-cli.md` 新節「Claude 面板：背景子代理執行中送出訊息（T0769 / BUG-192，D214）」（必守規則原文、不變項、排隊、唯一實作、已知限制、驗證），舊節「已知限制」改指向新節；`CLAUDE.md`「Sub-agent / Active Tasks Tracking」加一行。

**驗證**

| 項目 | 位置 | 結果 |
|---|---|---|
| 新單元 `electron/__tests__/claude-send-during-background-agent.test.ts` | 主 checkout | 15 passed（mock SDK `query`，跑真的 `sendMessage` / `runQuery`：注入不 abort / 不另開 query / 背景卡片 running / 權限保留 / user 廣播 / R 列重設 / 圖片 blocks / 空白不送；reject → 排隊 → resume 送出；取消；reject 晚於 query 結束；主回合未 result → 中斷＋重送；無背景子代理的 result 後 → 原路徑；`perTaskStopAffordance`；`stopSession` 後再送 → 注入；init 後 exit 1 不重試、init 前照舊重試） |
| 突變檢查（主行程 7 項） | 主 checkout，暫改後以腳本還原（比對內容相同） | 全部失敗如預期：拿掉注入分支 8 failed；拿掉 `perTaskStopAffordance` 1；`stopSession` 一律 idle 1；init 後仍重試 1；注入不 reset usage 1；不送排隊清單 2；注入不看背景子代理 1 |
| 新單元 `src/__tests__/claude-panel-queued-message.test.tsx` | 主 checkout | 4 passed（提示在該訊息下、別的 session 忽略、取消 IPC 後消失、取消沒找到時保留、zh-TW 字樣、`placeQueuedMessages`）；突變（不渲染已配對的提示）→ 2 failed |
| `npm run typecheck` / `typecheck:electron` | 主 checkout | 0 / 0 |
| `npm run test:unit` | 主 checkout（最終版） | 380 files、6681 passed、10 skipped |
| `npx vite build` | `git archive` HEAD `08ed510e` ＋本單 14 檔匯出到 `%TEMP%\bat-T0769-build`（`node_modules` junction） | exit 0（3 次） |
| e2e `e2e/v072-pre6-claude-panel.spec.ts`（隔離實例、假 API） | 同匯出目錄 | 最終版 2 輪皆 `2 passed`（29.3 s / 29.4 s）。⑦c：followup 152–157 ms 回覆、bar 1 項、卡片 running、無 `Agent terminated unexpectedly`、子代理未重跑；注入回合請求擋住時 Esc → bar 仍 1、卡片 running；放行 → `[completed] bg3 sub-agent finished`。不回歸：①③⑤②⑦⑦b⑥⑨⑩④⑧⑪⑫ 全 PASS；blocking proxy attempts `[]`、使用者 `~/.claude/projects` 無本次項目 |
| 驗紅 | 匯出目錄換回 HEAD 的 `claude-agent-manager.ts`（sha256 與 `git cat-file` 相同）重 build | ⑦c 失敗於 `spec.ts:419`「送出後 bar 仍 1 項」：Expected 1、Received 0（背景子代理被中止）；⑦b 以前全 PASS。之後覆回本單版（sha256 相同）重 build 跑上面的第 2 輪綠 |

**不回歸清單（T0768〈4〉）**：⑦ / ⑦b（e2e PASS）、權限 allow / deny（e2e ⑥ PASS）、BUG-177（e2e ⑩ 與 `claude-supported-models-probe.test.ts` 在 `test:unit` 內 PASS；注入路徑空白不送有單元）、BUG-178（e2e ⑪⑫ PASS）、T0744 R 列（`cache-history` 單元在 `test:unit` 內 PASS；注入 reset 有單元）、`/resume`（e2e ④⑧ PASS）、圖片附件（`buildUserContent` 共用、單元比對 blocks；e2e 未涵蓋圖片，見遭遇問題 3）、主回合中送出的中斷＋重送（單元對照）、雙 Esc（`abortSession` 未改，只換成 `clearMessageQueue`；`ClaudeAgentPanel` 的 `handleStop` 未改）。

**排隊顯示 e2e 不能造的原因**：「輸入已關」只在 SDK 自己結束 run 時發生（`session_state_changed: idle` 或 run-end ceiling 計時器到期）；背景子代理在跑時 session 不會 idle（T0768 B1 等 25 s 仍開），沒有背景子代理時本單不走注入。以真實 CLI 造不出穩定的 reject，改以單元測試涵蓋（主行程 3 項＋面板 2 項＋突變）。

### 遭遇問題

1. **與 T0768 草案的偏離（已自行決定，依 memory「in-scope 代決後回報」）**：草案的注入條件是 `isStreaming && mainTurnDone && queryInstance`。第 1 輪 e2e 在 ⑦b 失敗：⑦ 的前景 Agent 回合 `result` 之後、query 結束之前送出的訊息被注入，結果**沒有任何模型請求、也沒有 reject**（訊息無錯遺失）。原因：沒有背景子代理時 session 立即 idle，SDK 在 `result` 當下 `endRun` → `transport.endInput()`，之後的寫入沒有丟錯。改為只在 `hasBackgroundTask(session)` 時注入（這正是 T0768 B / C / G 實證輸入仍開的情況），其餘維持原路徑；加單元測試＋突變（M7）守住，文件與 CLAUDE.md 已寫明。修正後 e2e 兩輪全過。
2. **範圍外但必要的接線檔**：新 IPC `claude:cancel-queued-message` 需要 `electron/handlers/claude.ts`（註冊）、`electron/remote/protocol.ts`（`PROXIED_CHANNELS`，否則 renderer 叫不到，BUG-095）、`electron/remote/path-aware-channels.ts`（coverage 測試要求）；三檔各 1–2 行，不在 `affects_files` 內，已一併 commit。
3. 注入回合附圖片沒有 e2e（假 API 的 ⑦c 只送文字）；只有單元比對 content blocks 與共用 builder。
4. 已知限制（寫進 docs）：排隊清單不跨面板重新掛載（重新掛載後提示不見，訊息仍會送出）；注入依賴 SDK 0.3.316「背景子代理執行中輸入仍開」的行為，SDK 改了會退回排隊（不殺子代理）。
5. 其他記錄：P-2 照 D214 不改，因此「注入的回合本身還在跑時再送一則」仍走中斷＋重送，若此時有背景子代理會一起被中止（與 T0768 草案「其餘情況維持現行分支」一致；若要改屬 P-2 / PLAN-058 範圍）。
6. 過程問題（已處理）：Python 插入的文字帶 CRLF，3 個檔出現混合行尾（`git ls-files --eol` 顯示 `w/mixed`），commit 前統一轉 LF（全部 `w/lf`）。匯出目錄第一次以 Git Bash `rm -rf` 移除時 junction 尚在，事後確認主 checkout `node_modules` 完好（`npm ls --depth=0` 無 missing、`node_modules\electron` 在）；最後清理改用 PowerShell 先刪 junction 本身。暫存（`%TEMP%\bat-T0769-*`、`%TEMP%\bat-t072*/t073*`、`%ProgramData%\bat-e2e-t07*`）皆為 0。

### 互動紀錄

- 無使用者 / 塔台問答（yolo；偏離草案的注入條件依 memory 規則自行決定，記在〈遭遇問題〉1）。

### 回報時間

2026-11-02T04:26:44+08:00
