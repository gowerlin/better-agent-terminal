---
schema_version: 1
schema_kind: workorder
id: T0918
title: "修 BUG-222：claude 排隊多個權限詢問時，回答第一個後 `blocked`（`permission`）不得提早清除"
type: bugfix
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T12:19:45+08:00"
updated_at: "2026-11-25T16:06:11+08:00"
completed_at: "2026-11-25T12:44:55+08:00"
started_at: "2026-11-25T12:22:47+08:00"
target_version: "0.8.0-pre.3（與 CT 6.1.0 同日發佈）"
depends_on: [T0915]
related:
  - "BUG-222；D337；BUG-196 / T0788（通知保留）；T0590（blocked 契約）、T0757（滑鼠回答）、T0790 / T0791（晚到的清除回報）；T0915 回報區〈建議開 BUG〉第 3 點"
affects_files:
  - _ct-workorders/T0918-fix-bug222-queued-permission-blocked.md
  - electron/terminal-blocked-state.ts
  - electron/__tests__/
  - electron/bat-mcp-launch.ts
  - scripts/bat-hook.mjs
  - scripts/__tests__/
  - tests/
  - docs/agent-guide/blocked-state.md
  - CLAUDE.md
renew_count: 0
session_ids:
  - "30693ac5-9b78-41de-958f-aa1d5aa0feac"
isolation: worktree
workdir: "worktree ct/T0918（塔台已預先從 `v0.8.x` `4f7484bc` 建立分支 `ct/T0918`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0918` 寫檔；開工確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `4f7484bceb4fac693f0d35fd0285b93bb4d8c146`，不符就停下問塔台。不 merge / rebase / push、不動 `main` 與 `v0.8.x`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 先查證：① 從 T0915 證據（本機 `<使用者資料夾>/AppData/Local/ct610-accept/results/M-C5.md`〈BAT 端備註〉、`results/M-C5/` 的 debug log 11:42:51–11:42:55、截圖；只讀，不改）整理事件時間線：3 個 `PermissionRequest` 到達、使用者回答、哪個事件清除了 `blocked`；② 讀內嵌 claude CLI（`@anthropic-ai/claude-code` 目前版本）與 hook 文件，確認排隊的權限詢問在使用者回答後會送哪些 hook（`PostToolUse`、`PermissionDenied`、`Notification` 等）、payload 有沒有可對應的 id（`tool_use_id` 等）。可用 headless / `-p` 以外不耗 token 的方式查（讀字串、文件）；🔴 不開會耗 token 的 claude 回合。"
  - "🔴 修法由你依證據選，方向：`permission` reason 依「尚未結束的權限詢問數」決定，而不是第一次使用者輸入就清除——例如每個 `PermissionRequest` 計數（有 id 就以 id 記），只在對應的結束事件（工具開始 / 完成 / 拒絕）或回合結束、PTY 結束等既有清除條件才減少，數到 0 才清；若 hook 送不出能對應的結束事件，說明並採最保守的可行做法（寧可多保留，不得替使用者作答）。🔴 hook 腳本規則不變（exit 0、stdout 不輸出、總時限 1.8 s、內容不進日誌）；若要多送 payload 欄位，只送 id 類欄位、改 docs 契約說明，並確認舊 BAT＋新 hook、新 BAT＋舊 hook 的組合不出錯。"
  - "🔴 不回歸（R-G003 第 3 點）：回報區列〈相關通過案例〉：T0590 契約（優先序、`blockedDetection`）、T0757 滑鼠回答（單一詢問用滑鼠回答仍清除）、T0790 / T0791 晚到回報、T0788 通知保留、T0915 M-C5 的 PASS 項；單一權限詢問的行為（回答即清除、⚠️ 消失）必須與修正前相同。"
  - "🔴 驗證：單元測試（3 個並行 `PermissionRequest` → 回答 1 個仍 blocked → 全部結束才清；單一詢問行為不變；亂序 / 晚到事件）；`npx vite build` exit 0；兩個 typecheck = 0；`npm run test:unit` 第一次完整執行即綠（附數字）；`npm run test:legacy` 全綠；e2e `e2e/t0787-notify-into-blocked-tower.spec.ts` 跑 1 次（隔離實例，需先 `npx vite build`）。程序清理照 D308。"
  - "🔴 文件：`docs/agent-guide/blocked-state.md` 事件表 / 清除規則更新；CLAUDE.md「blocked 狀態偵測」節只在有新不變式時加一句。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；commit 訊息 `fix(T0918): …`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；收單前 worktree `status --porcelain` 為空。公開 repo（D176）：repo 內不寫本機驗收目錄的真實路徑。yolo：不得問使用者，判讀問題問塔台。"
---

# T0918 — 修 BUG-222：排隊的權限詢問期間維持 `blocked`

見 [BUG-222](BUG-222-queued-permission-prompts-clear-blocked-early.md)。

## 驗收

- [ ] 事件時間線與 claude hook 行為查證（附來源）
- [ ] 多個權限詢問排隊時，全部回答完才清除 `permission`；單一詢問行為不變
- [ ] 單元、e2e t0787、vite build、兩個 typecheck、`test:unit` 第一次即綠、`test:legacy`
- [ ] 〈相關通過案例〉逐案判定
- [ ] 文件同步

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：FIXED（實作與驗證關卡全部通過；待實機排隊權限詢問驗收後由塔台結案）
- **branch**：`ct/T0918`
- **base_sha**：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（BAT 注入的 `CT_WORKTREE_BASE`；分支實際起點 = 塔台預建的 `4f7484bceb4fac693f0d35fd0285b93bb4d8c146`，開工時 `merge-base HEAD v0.8.x` = 該值，符合 memory_overrides）
- **validated_sha**：`8d36b0363c38d99de37eb35790cd9f4a49f0916b`
- **head_sha**：`8d36b0363c38d99de37eb35790cd9f4a49f0916b`（兩者相同：產品 commit 後才跑 vite build / test:unit / test:legacy / e2e；兩個 typecheck 在 commit 前同一份工作樹上跑，commit 內容與之相同）
- **產品 commit**：`8d36b036` `fix(T0918): keep \`blocked\` while queued permission prompts are open (BUG-222)`（4 檔，+499 / −34）
- **session_id**：30693ac5-9b78-41de-958f-aa1d5aa0feac

### 落點檢查

- 結論：PASS
- C-0：`repo` = `better-agent-terminal`；`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 下 → PASS
- C-3：`electron/terminal-blocked-state.ts` 等皆存在 → PASS（資訊性）
- C-2：工單無 `branch` 欄位；`CT_WORKTREE_BRANCH` = `ct/T0918` = 目前分支
- `CT_HOME` 已設定；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`BAT_REMOTE_TOKEN` 已設定

### 事件時間線（T0915 證據，只讀）

來源：T0915 驗收目錄的 `results/S2-logs/debug-20261125-105541.log` 與 `bat-scripts.log`（時間為 UTC；本機 = +8）、`results/M-C5.md`〈BAT 端備註〉。塔台分頁 `1737a5aa…`，claude 2.1.331，manual mode。

| 時間（UTC） | 事件 | BAT 結果 |
|---|---|---|
| 03:42:46.277 | `permission-request`（Bash，派單用的單一詢問） | `→ blocked reason=permission` |
| 03:42:48.781 | 使用者（驅動腳本）回答 | `→ cleared (user input)`（單一詢問，正確） |
| 03:42:49.026 | `post-tool-batch` | `unchanged` |
| 03:42:51.940 | `permission-request`（Bash，System32） | `→ blocked reason=permission` |
| 03:42:52.676 | `permission-request`（Read） | `unchanged` |
| 03:42:53.458 | `permission-request`（Read） | `unchanged` |
| 03:42:55.369 | 使用者回答第 1 個（腳本誤核准 System32） | **`→ cleared (user input)`** ← BUG-222 |
| 03:42:55 → 03:53:21 | 畫面「2 of 3」「3 of 3」，驅動腳本停住約 10 分鐘 | **沒有任何 hook 回報**（bat-scripts.log 該分頁空白） |
| 03:53:21.470 | 該批 `post-tool-batch`（剩下兩個回答後、工具執行完） | `unchanged`（已不在 blocked） |

結論：3 個 `PermissionRequest` 都在使用者回答前到達（排入佇列時就執行 hook）；清除 `blocked` 的是第一次使用者輸入；之後到批次結束之間沒有任何事件可用。

### claude hook 行為查證（內嵌 `@anthropic-ai/claude-code` 2.1.331，`claude-code-win32-x64/claude.exe` 靜態閱讀；未開任何模型回合）

1. `PermissionRequest` hook 輸入（`executePermissionRequestHooks`）：共同欄位＋`hook_event_name` / `tool_name` / `tool_input` / `permission_suggestions`（MCP 另有 `mcp_server` 等）——**沒有 `tool_use_id`**，回答無法對應到哪一個請求。（`PostToolUse` / `PostToolUseFailure` / `PermissionDenied` 才帶 `tool_use_id`，但前兩者只在工具真的執行後、後者只在 auto-mode classifier 拒絕時，T0594 / T0657 已查證。）
2. 使用者拒絕：`onReject` → `cancelAndAbort(feedback)`；`x8o({feedback, contentBlocks, isSubagent}) = !feedback && !contentBlocks?.length && !isSubagent` 為真時 `abortController.abort()` → 主執行緒沒附回饋的拒絕中斷整個回合、排隊的請求一起消失，不送 `PostToolBatch`、不送 `Stop`（與 T0757 ② 相同）；附回饋或 subagent 不中斷。
3. 確認對話框預設按鍵（keybindings `Confirmation`）：`enter: confirm:yes`、`escape: confirm:no`、`up/down/tab/space` 只移動；選單元件的數字鍵 `/^[0-9]$/` 直接選該項。
4. 互動模式下 `personOnly` 的詢問不在對話框路徑再跑一次 hook（`if(!x&&y.personOnly!==!0) runHooks…`、`if(e.askIsPersonOnly)return null`），一般情況一個對話框一次 `PermissionRequest`（T0915 log 亦同：單一詢問各 1 筆 injected 回報）。
5. 能對應「結束」的事件只有 `PostToolBatch`（`tool_calls` 全部結束後一次，T0657）。

### 修法（依證據選擇）

hook 送不出逐一對應的結束事件 → 採最保守做法，**不改 hook、不加 payload**（`scripts/bat-hook.mjs`、`electron/bat-mcp-launch.ts` 未修改，舊 BAT＋新 hook / 新 BAT＋舊 hook 的組合因此不受影響）：

- `TerminalBlockedTracker` 把每個 `permission-request` 記下（每個 agent 一串 `at`，`getOpenPermissionPrompts`）。
- 未結束 ≥ `QUEUED_PERMISSION_PROMPTS_MIN` = 2 時，使用者輸入與滑鼠按下**不清除**（`keptForQueuedPrompts`，日誌 `[blocked] terminal=<id> kept: user input|mouse press while <n> permission prompts are open (…)`，同數量只記一次）；仍算使用者輸入（`lastUserInputAt` / `onUserInput` 不變）。
- `post-tool-batch` 只結束該 agent 中 `at` 不晚於它的請求（`resolveBatch`；無 `at` → 全部），晚於它的屬於下一批而保留；全部 agent 清空才清除；全部都晚於它 → 照 T0790 記 `reported late`。
- `stop` / `user-prompt-submit` / PTY 結束 / recovery / 換 reason：全部清除（不變）。
- 只剩 / 只有 1 個：使用者輸入 / 滑鼠照舊清除（單一詢問行為與日誌逐行不變）。
- 每個 agent 最多記 `PERMISSION_PROMPTS_PER_AGENT_MAX` = 64 個；超過 32 個 agent 的 `any` 退回照舊、但仍計數。

### 變更檔案

- `electron/terminal-blocked-state.ts`：`permissionAgents` → `permissionPrompts`（每個請求的 `at` ＋ `open` 計數）、`resolveBatch`、`addPermissionPrompt`、`getOpenPermissionPrompts`、`keptForQueuedPrompts`、`clearForUserInput` / `clearForMousePress` 加判斷；檔頭說明。
- `electron/__tests__/queued-permission-prompts.test.ts`（新）：tracker 13 案＋真 PtyManager / `pty:write` / NotifyHoldController 3 案。
- `docs/agent-guide/blocked-state.md`：事件表 `PostToolBatch` 列、清除規則、新節「排隊的權限詢問（T0918 / BUG-222）」（起因、claude 查證、規則、不變、已知限制）、驗證段。
- `CLAUDE.md`「blocked 狀態偵測」節：一條新不變式。

### 驗證

| 關卡 | 結果 |
|---|---|
| 新單元測試 `queued-permission-prompts.test.ts`（3 個並行請求 → 回答 1 個仍 blocked → 批次結束才清；單一詢問不變；亂序 / 晚到 / 無 `at` / 多 agent / 上限；pty:write；通知保留） | 16 / 16 PASS |
| 既有 blocked 相關（terminal-blocked-state / blocked-mouse-press / agent-turn-attention / codex-osc-state / blocked-hooks-launch / headless-blocked-state-e2e / notify-hold / terminal-attention） | 全部 PASS，**未修改任何既有測試**（開發中一度新增一行日誌使 T0657 的 `agent=` 斷言失敗，已移除該日誌、維持 T0918 前的日誌形狀） |
| `npm run typecheck` | exit 0（0 錯誤） |
| `npm run typecheck:electron` | exit 0（0 錯誤） |
| `npx vite build` | exit 0 |
| `npm run test:unit`（第一次完整執行） | exit 0：Test Files 492 passed / 3 skipped（495）；Tests 8965 passed / 42 skipped（9007）；70.4 s |
| `npm run test:legacy` | exit 0：files 33 passed / 0 failed；tests 472 passed / 0 failed |
| e2e `e2e/t0787-notify-into-blocked-tower.spec.ts`（隔離實例，build 後跑 1 次） | exit 0：2 passed（6.8 m）；`hook-order races: 0; late hook reports kept: 0`；兩個 Terminal Server `alive after teardown: false`、runtime userData 已刪 |
| 程序清理（D308） | e2e 前後以命令列含本 worktree 路徑的程序快照：前 0、後 0；**未結束任何程序**（不需要） |

### 相關通過案例判定

| 案例 | 判定 | 依據 |
|---|---|---|
| T0590 契約（優先序 `exited` > `blocked` > `working`/`idle`、`blockedDetection`、`terminal:report-hook` 形狀） | 不變 | 只改 tracker 內部記錄與兩個清除入口；查詢 / channel 未動；terminal-blocked-state.test.ts 全綠 |
| T0757 滑鼠回答（單一詢問以滑鼠回答仍清除） | 不變 | blocked-mouse-press.test.ts 全綠；新測試「one prompt」案逐行比對日誌 |
| T0790 / T0791 晚到回報 | 不變 | T0790 段（含「同一 agent 第二個請求以較晚時間為準」「依 agent 比較」）未改即通過；`reported late` 日誌文字相同；回合規則未動 |
| T0788 通知保留 | 不變＋涵蓋 BUG-222 | notify-hold.test.ts 全綠；e2e t0787 2 passed；新測試：回答第一個後 Worker submit 仍 `held`，批次結束後才送出 |
| T0915 M-C5 PASS 項（M-C5-1 卡片、M-C5-2 `hooks: ok`、M-C5-3 單一對話框保留通知、M-C5-4 CT guard） | 不變 | hook 腳本、hook 表、`BAT_HOOK_SET`、tower-cards、`--set-role` 都沒改；M-C5-3 是單一詢問路徑，行為不變 |
| 單一權限詢問（回答即清除、⚠️ 消失） | 不變 | `open` = 1 時走原本的 `clear(id, 'user input' / 'mouse press')`，日誌與 `onChange` 次數相同（新測試斷言） |

### 遭遇問題 / 偏差

- 驗收第 2 項寫「全部回答完才清除」：實作是**該批的 `post-tool-batch` 到達**（全部回答完且工具都執行完）才清除，或剩 1 個時照舊以輸入清除。理由：沒有「每回答一個」的 hook，按鍵計數需要把 `pty:write` 內容傳進 tracker（`electron/handlers/pty.ts` / `PtyManager.noteUserInput`，不在 affects_files），且受使用者自訂 keybindings 影響、多按鍵（方向鍵＋Enter）會多扣，方向錯誤就是 BUG-222 本身；依工單「寧可多保留」選保守做法。
- 已知限制（已寫進 docs）：① 回答完後若該批有長時間的 Bash，⚠️ 與通知保留維持到工具執行完；② 以 Esc / 沒附回饋的 No 拒絕其中一個 → 回合中斷、無 hook → 維持到使用者送出下一個 prompt 或 PTY 結束；③ 兩個 agent 各有一個請求時也算 2 個。
- `CT_WORKTREE_BASE`（`06c3b884`）與塔台預建分支起點（`4f7484bc`）不同：`06c3b884` 是 `4f7484bc` 的祖先，推定是 BAT 記錄主 checkout 的 HEAD；依 memory_overrides 以 `merge-base HEAD v0.8.x` = `4f7484bc` 判定 PASS。
- worktree 開工時沒有 `node_modules`：依 CLAUDE.md 以 `npm ci` 安裝（exit 0）。

### 後續建議（給塔台）

- 實機驗收：重跑 T0915 M-C5 第 1 次的情境（manual mode 塔台、同回合 Bash＋2 Read）→ 回答第一個後 debug log 應有 `kept: user input while 3 permission prompts are open`、縮圖 ⚠️ 留著、`2 of 3` 期間到達的 Worker 通知 `[notify-hold] held`。
- 若要回答完立即清除（不等工具執行完）：另開工單評估「按鍵分類」（把 `pty:write` 內容傳到 tracker；`enter` / 數字鍵算回答一個、`escape` 算中斷），需涵蓋自訂 keybindings 與多按鍵回答。
- BUG-222 狀態請塔台更新（本工單不在 affects_files，未動）。

### 互動紀錄

- [12:22] 開工：yolo、`CT_INTERACTIVE=0`；未向塔台提問（修法依工單授權自行選擇）。

## 塔台收尾補記（2026-11-25T16:06:11+08:00）

- Worker 依 BUG 單慣例寫 `FIXED`；工單本身以 `DONE` 結案（L177）。修正已由 T0919 合併進 `v0.8.x`、T0920 實機補驗 PASS，BUG-222 於 D338 CLOSED，隨 `v0.8.0-pre.3` 發佈。
