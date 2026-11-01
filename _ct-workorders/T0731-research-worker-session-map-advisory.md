---
schema_version: 1
schema_kind: workorder
id: T0731
title: "研究：BMad-Guide ADVISORY（Worker session 對應與用量彙總）Q-B1–Q-B5 的現況查證、可行性與工作量，並起草回覆稿"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-01T12:06:56+0800"
started_at: "2026-11-01T12:07:47+0800"
updated_at: "2026-11-01T12:12:07+0800"
completed_at: "2026-11-01T12:12:07+0800"
depends_on: []
related:
  - "來源（BMad-Guide repo，唯讀）：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_handover-2026-11-01-bat-worker-session-map-advisory.md`（schema_kind: cross-tower-advisory，2026-11-01T11:38:51+0800 送出）"
  - "CLAUDE.md「Claude 分頁的 session 名稱（PLAN-050 / T0641，D167）」（R3：`bat-hook.mjs session-start` 送 `sessionId`、日誌只記前 8 碼）、「Logging」（helper 日誌 `scripts/_bat-logger.mjs`）、「工作區層級 Agent / 啟動參數」"
  - "使用者 2026-11-01 第一百零二 session 選「先開研究單」"
affects_files:
  - _ct-workorders/T0731-research-worker-session-map-advisory.md
  - _ct-workorders/_reply-2026-11-01-bat-worker-session-map-advisory.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不改：不改產品程式碼、測試、docs、README；不跑 `vite build` / 打包 / e2e（T0729 正在同一 repo build）。可讀程式碼、git log / 工單 / 決策紀錄；可讀本機 `bat-scripts.log` 的**大小、筆數、event 種類與欄位名**，不得把 log 內容、terminal id 以外的識別值、session id 全碼或任何權杖寫進回報或回覆稿。"
  - "🔴 逐題回答（每題分「現況（附 `檔案:行` 或工單 / 決策編號）」「可行性與工作量（S / M / L）」「風險 / 要遵守的既有規則」「建議：採納 / 部分採納 / 不採納」）：Q-B1 `report-hook.session` 記前 8 碼是不是刻意的（找出決策出處與理由，例如 T0642 / D167 的日誌政策），改記完整 UUID 的影響（隱私、公開 repo、log 外流）；Q-B2 `terminal-created` / `close-worker` 補 `claudeSessionId` / `role` / `agent` 或新增 `worker-session` 紀錄：資料在哪個行程、何時可得（session id 由 `SessionStart` hook 晚到）、helper log 與主行程 debug log 誰寫比較合理；Q-B3 `bat-scripts.log` 的實際保存 / 輪替行為（`_bat-logger.mjs`），目前大小，是否該開 BUG（無上限成長）；Q-B4 狀態列成本 / Token 的計算來源與 JSONL `message.usage` 是否同一口徑，依 Worker 分頁彙總的可行性；Q-B5 確認 skill 管理是否確實不需 BAT 整合（對照工作區層級啟動參數與 `--settings` 注入，注意 BAT 自己也用 `--settings=` 注入 hooks，使用者再加 `--settings` 會不會衝突）。"
  - "🔴 起草回覆稿 `_ct-workorders/_reply-2026-11-01-bat-worker-session-map-advisory.md`（frontmatter 比照同目錄既有 `_reply-*.md`；`status: DRAFT`；繁體中文；逐題給 BAT 的立場與依據），標明「採納與否待 BAT 使用者決定」。回覆稿不寫真名、家目錄路徑（`<使用者資料夾>`）、權杖、session id 全碼。不送出、不通知 BMad-Guide（塔台處理）。"
  - "🔴 回報區列：各題建議摘要表、若採納時建議的工單拆分（每張的範圍、affects_files 估計、是否改 helper 契約 / README 協作章節）、需要使用者決定的點。發現的缺陷（例如 log 無上限成長）列〈發現的問題〉由塔台開 BUG。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單與回覆稿兩個檔。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
---

# T0731 — 研究：Worker session 對應 ADVISORY

## 元資料

- **工單編號**：T0731
- **類型**：research
- **優先級**：P3
- **建立時間**：2026-11-01T12:06:56+0800
- **預估規模**：S

## 背景

BMad-Guide 塔台（CT 維護方）2026-11-01 送來 ADVISORY：CT PLAN-004 要在 `ct-insights` 把 Claude Code 用量歸到工單，CT 端不靠 BAT 新功能已可完成（JSONL 首訊息＋分頁標題，`report-hook.session` 前 8 碼交叉驗證）；另提 Q-B1–Q-B5 五點建議，不採納也不影響 CT。使用者決定先開研究單查證並起草回覆，採納與否之後決定。

## 範圍

1. Q-B1–Q-B5 逐題查證現況、可行性、工作量、建議。
2. 起草 `_reply-2026-11-01-bat-worker-session-map-advisory.md`（DRAFT）。

## 不做

- 不改任何產品檔案、不 build、不送出回覆。

## 驗收

- [x] 五題各有現況證據與建議
- [x] 回覆稿 DRAFT 已 commit，無敏感值
- [x] 採納時的工單拆分建議與待決點

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**。五題都有現況證據與建議；回覆稿 `_ct-workorders/_reply-2026-11-01-bat-worker-session-map-advisory.md`（`status: DRAFT`）已起草，未送出、未通知 BMad-Guide。沒有改任何產品檔案、沒有 build。

### 落點檢查

- 結果：**PASS**
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = 本 repo 主 checkout；`CT_HOME` 未設，非 worktree）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 兩項都在 `_ct-workorders/` 下 → not applicable
- C-2：工單無 `branch` 欄；目前 `main`
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 模式：`CT_MODE=yolo`；本單沒有需要問塔台的判讀問題

### 各題建議摘要

| 題目 | 建議 | 規模（若採納） | 主要依據 |
|---|---|---|---|
| Q-B1 `report-hook.session` 改完整 UUID、寫成約定 | **不採納**；改指引 CT 用既有契約 `bat_get_state.claudeSessionId` | S（改兩處寫入 + 測試 + docs，但要推翻 D167 第 2 點） | D167 第 2 點；T0642 C-5 |
| Q-B2 `worker-session` 紀錄 | **暫不採納**；CT 確定需要時可做主行程版本 | M | 主行程有全部欄位，helper 沒有 sessionId |
| Q-B3 `bat-scripts.log` 保存 / 輪替 | **開 BUG**（無上限成長）；回覆 CT 不要依賴保留期 | S–M | T0192 / T0193 明訂先不輪替 |
| Q-B4 用量依 Worker 彙總 | **不採納** | L（要讀 JSONL 或注入 `statusLine`） | 狀態列只屬 SDK 面板 |
| Q-B5 skill 管理不需 BAT 整合 | **同意**，附兩個限制 | 0 | 工作區參數不分角色；`--settings` 會讓 BAT 不注入 hooks |

### Q-B1：`report-hook.session` 前 8 碼

- **現況**
  - 刻意的，決策出處 `_ct-workorders/_decision-log.md:1689` D167 第 2 點（2026-10-18，使用者裁示）：「`SessionStart` hook 回報時多帶驗證過的 `session_id`（UUID），日誌只記前 8 碼」。來源是 T0640 研究建議（`_archive/workorders/T0640-research-claude-session-name-identity.md:186`：「sessionId 不是權杖，但還是建議驗證 UUID 格式、日誌只記前 8 碼」），T0642 契約 C-5 落實（`T0642-claude-session-query-fields.md:42`）。決策沒有寫出更細的理由；依脈絡判斷是資料最小化：sessionId 可用來 `claude --resume` 那段對話，日誌會被附進公開 repo 的問題回報。
  - 寫入點：`scripts/bat-hook.mjs:225`（helper 端，`session: outcome.sessionId.slice(0, 8)`）、`electron/terminal-blocked-state.ts:178` `sessionIdForLog` 與 `:644` 主行程鏡像；debug log `[agent-start]` 同樣只記前 8 碼。文件 `docs/agent-guide/claude-session-name.md:147`：「🔴 任何日誌都不記完整 sessionId」。測試守門：`electron/__tests__/claude-session-query.test.ts:296`、`terminal-blocked-state.test.ts`（真 hook process，「bat-scripts.log 只有前 8 碼」）、e2e `e2e/t0642-claude-session-query.spec.ts`。
  - 完整 UUID 已是正式契約：`terminal:whoami` / `list` / `get-state` 的 `claudeSessionId`（`docs/agent-guide/claude-session-name.md:75-83`；README「與 BMad Control Tower 協作」表格「跨 session 辨識塔台 / Worker」列）。結束紀錄保留 10 分鐘 / 32 筆（`electron/pty-manager.ts:810-838` `recordExit` 帶 `claudeSessionId`）。
  - 本機 `bat-scripts.log` 的 `session` 欄 1541 筆，長度全部是 8。
- **可行性與工作量**：改成完整 UUID 技術上是 S（兩處 + 測試斷言 + docs），但等於推翻 D167 的日誌政策，需要使用者決策。
- **風險 / 既有規則**：D167 日誌政策；公開 repo 去識別化（D176，使用者附日誌）；`bat-scripts.log` 定位是診斷日誌（`scripts/_bat-logger.mjs` 檔頭「diagnostic-only」），欄位不是契約。前 8 碼 = 32 位元，CT 實測 1533 筆 0 筆多重命中，當交叉驗證夠用。
- **建議**：**不採納**。回覆 CT 改用 `bat_get_state`：塔台在 Worker 回報後、`--close-worker` 前查一次，把完整 `claudeSessionId` 記進 CT 自己的紀錄。注意 `/clear` 後只留最後一個 id；`null` 不代表沒有 session。

### Q-B2：`worker-session` 紀錄

- **現況**
  - helper（`bat-terminal.mjs`）寫 `terminal-created` 時還沒有 sessionId：`SessionStart` hook 晚到；`--wait-started` 只回 `agentStartedAt`，`terminal:wait` 刻意不回 sessionId（`T0642-claude-session-query-fields.md:150`）。
  - 主行程有全部欄位：`PtyInstance.workorder` / `workspaceId` / `agentPreset` / `customEnv.BAT_TOWER_TERMINAL_ID`（`electron/pty-manager.ts:66-99`、`recordExit` `:810-838`）、角色 `terminal:set-role`（`electron/terminal-role.ts`，不持久化）、sessionId `TerminalBlockedTracker.getSessionId`。可寫入點：sessionId 變更（`onClaudeSessionChange` dep）與 PTY 結束（`onPtyExit`，`electron/main.ts:949`）。
  - `close-worker` 的紀錄在 helper 與 `WorkerCloseScheduler`（`electron/close-worker.ts`），但實際關閉時間在分頁真的關掉之後（等安靜最多 60 s），所以「closedAt」應以 PTY 結束為準，不是 `close-worker` 事件。
- **可行性與工作量**：M。主行程新增一個寫入點（或沿用 `mirrorToBatScripts`）＋契約文件＋測試（含 headless：`electron/remote/headless-entry.ts` 也要接）。一個 Worker 可能有多個 sessionId（`/clear`），紀錄應是「每次換 id 一筆＋結束一筆」，不是一筆含 start/close。`role` 是記憶體狀態、BAT 重開後不還原（既有限制）。
- **風險 / 既有規則**：完整 sessionId 進日誌同 Q-B1（要先改 D167）；寫進 `bat-scripts.log` 會受 Q-B3 無輪替 / 未來輪替影響，作為 CT 歷史來源不可靠；新契約要寫 README 協作章節與 `docs/agent-guide/`（CLAUDE.md 撰寫規則）。
- **建議**：**暫不採納**。Q-B1 的作法 CT 現在就能用。若 CT 之後仍要 BAT 端歷史紀錄，開 M 單：主行程寫、獨立檔案與保存規則、另立契約。

### Q-B3：`bat-scripts.log` 保存 / 輪替

- **現況**
  - 無輪替、無上限、無清理：helper `scripts/_bat-logger.mjs:163` 與主行程 `electron/remote/remote-logger.ts:125` 都是 `appendFileSync`。T0192 明訂「不加 log rotation（先簡單 append，超大時再處理）」（`_archive/workorders/T0192-bat-scripts-diagnostic-logging.md:35`），T0193 對齊（`T0193-remote-server-terminal-ipc-logging.md:37`）。對照 debug log 只留 10 個（`electron/logger.ts:28` `MAX_LOG_FILES`）。
  - 本機實測（只看大小、筆數、event 種類與欄位名）：41.6 MB（43,637,594 bytes）、195,249 筆（1 筆無法解析）、2026-05-28 起。每月：5 月 0.2 / 6 月 0.9 / 7 月 0.7 / 8 月 1.5 / 9 月 1.9 / **10 月 35.6 MB**（其中 `report-hook` 20.7 MB）/ 11-01 半天 0.7 MB。
  - 最大宗：`bat-hook|report-hook` 65,524 筆、`remote-server|report-hook` 48,455 筆（T0590 起每個 hook 事件 helper 端與主行程鏡像各記一筆）。
  - 多個寫入者：每個 helper 程序、主行程、headless bat-server（`BAT_HELPER_LOG_DIR`）。
- **可行性與工作量**：S–M。建議由主行程啟動時輪替（超過門檻改名為帶時間戳的舊檔、保留 N 份），避免多個 helper 程序競爭；Windows 改名遇到其他程序正在 append 可能 `EBUSY` / `EPERM`，要容錯（下次啟動再試）。可選：減少 `report-hook` 雙寫。
- **風險 / 既有規則**：日誌寫入不得影響業務（兩個 logger 的失敗政策）；helper 版本跟 BAT 走（舊 helper 只 append，不影響主行程輪替）。
- **建議**：**開 BUG**（見〈發現的問題〉）；回覆 CT 不要依賴保留期。

### Q-B4：狀態列成本 / Token

- **現況**
  - 狀態列（`STATUSLINE_ITEMS`，`src/types/index.ts:472`）只在 Claude Agent 面板：`src/components/ClaudeAgentPanel.tsx:4127`（`cost` = `sessionMeta.totalCost`）。來源 `electron/claude-agent-manager.ts:1355-1420`：SDK `result.total_cost_usd`（session 累計）、`modelUsage`（依模型累計，input 含 cache 讀寫）。
  - Worker 是 helper 派工的 Claude CLI 終端分頁；BAT 不解析 CLI 分頁的用量（`src/`、`electron/` 沒有任何 `statusLine` 注入或 JSONL 用量解析）。
  - 與 JSONL `message.usage` 不是同一口徑：前者是 CLI 算好的 session 累計值與金額，後者是每個 API 回應的 token、沒有金額。（JSONL 去重、子代理計入方式本單未實測。）
- **可行性與工作量**：L。只能讀 `~/.claude/projects/` 的 JSONL（與 CT 重工，且遠端分頁的 JSONL 在遠端主機），或在 BAT 的 `--settings` 注入 `statusLine`（會蓋掉使用者自己的狀態列，與 Status Line 節「不替換」精神衝突）。
- **建議**：**不採納**。

### Q-B5：skill 管理

- **現況**
  - 工作區層級參數以「工作區 × preset」為單位、工作區有 key 即整串取代全域（`src/lib/agent-launch-settings.ts`；helper 派工讀 `findWorkspaceAgentSettings`，`electron/dispatch-workspace.ts:171`）。helper 沒有逐次指定參數的選項（`bat-terminal.mjs` 選項清單無 extra-args），所以**同一工作區的塔台與 Worker 用同一組參數**。
  - BAT 自己用 `--settings=<資料目錄>/bat-mcp/claude-settings.json` 注入 hooks（`electron/bat-mcp-launch.ts:438-451`）；使用者參數含 `--settings`（`userArgsPassClaudeSettings`，`:128-130`，regex `(^|\s)--settings(\s|=|$)`）時 **BAT 不注入 hooks**、不合併。後果：該分頁沒有 blocked 偵測、`--wait-started` 回 `unknown`、沒有 `SessionStart` 回報（`claudeSessionId` 為 null、`report-hook.session` 不出現）——會直接削弱 CT 的交叉驗證。
  - 專案 `.claude/settings.json` / `.claude/settings.local.json` 的 `skillOverrides` / `enabledPlugins` 不經命令列，不衝突。Codex `-c skills.config` 與 BAT 的 `-c mcp_servers.bat.*` 不衝突。
- **可行性與工作量**：0（不需新功能）。若日後要「依角色不同參數」或「合併使用者 `--settings` 與 BAT hooks」，各自是 M 的新功能。
- **建議**：**同意不需 BAT 整合**，回覆附上兩個限制（不分角色；不要用 `--settings`）。

### 若採納時的工單拆分建議

| 工單 | 範圍 | affects_files（估） | 改 helper 契約 / README 協作章節 |
|---|---|---|---|
| A（BUG 修正，建議做） | `bat-scripts.log` 大小上限與輪替（主行程啟動時輪替、保留 N 份、Windows 改名容錯）；可選減少 `report-hook` 雙寫 | `electron/remote/remote-logger.ts`、`electron/main.ts`、`electron/remote/headless-entry.ts`、`scripts/_bat-logger.mjs`（若改寫入規則）、`electron/__tests__/`、`docs/agent-guide/logging.md`、CLAUDE.md「Logging」 | 不改 helper 契約；README 不需改（日誌位置不變） |
| B（只在使用者推翻 D167 時） | 日誌記完整 sessionId | `scripts/bat-hook.mjs`、`electron/terminal-blocked-state.ts`、對應測試與 e2e 斷言、`docs/agent-guide/claude-session-name.md`、CLAUDE.md | 改 T0642 C-5 的日誌條款；README 不需改 |
| C（只在 CT 確定需要時） | 主行程 `worker-session` 紀錄（換 sessionId 一筆、PTY 結束一筆），獨立檔案＋保存規則＋契約 | `electron/pty-manager.ts`、`electron/main.ts`、`electron/remote/headless-entry.ts`、新模組 `electron/worker-session-log.ts`、測試、新 docs 篇 | 新契約；README 協作章節加一列 |
| D（可選，小） | 在工作區啟動參數對話框或 docs 註明「自訂參數含 `--settings` 時 BAT hooks 不注入」 | `docs/agent-guide/workspace-agent-launch.md`（docs only），或 `src/components/WorkspaceEnvDialog.tsx` 提示 | 否 |

### 需要使用者決定的點

1. Q-B1：維持 D167「日誌只記前 8 碼」（建議），或改記完整 UUID（→ 工單 B）。
2. Q-B2：暫不做（建議），或開工單 C。
3. Q-B3：BUG 開立後的輪替規格（門檻大小、保留份數、是否減少 `report-hook` 雙寫）。
4. 回覆稿是否照草稿送出（塔台處理；送出前改 `status`、補決策編號）。

### 發現的問題

1. **`bat-scripts.log` 無上限成長**（建議開 BUG，severity 低–中）：兩個寫入者都只 append、從未輪替（T0192 / T0193 明訂延後）。本機 41.6 MB；T0590 hook 上線後 10 月一個月 35.6 MB，照目前用量約每月 30–40 MB。影響：磁碟、使用者附日誌困難、讀檔診斷變慢。
2. **（觀察，非缺陷）使用者參數含 `--settings` 會讓 BAT 靜默不注入 hooks**：這是 T0590 的設計，debug log 有原因，但 UI 沒有提示；CT 若推廣用 `--settings` 切 skill 會踩到。可用工單 D 補說明。

### 互動紀錄

- 無（yolo；沒有向塔台提問）。

### 子代理與 Workflow 使用

（未使用）

### 修改的檔案

- `_ct-workorders/T0731-research-worker-session-map-advisory.md`（本單）
- `_ct-workorders/_reply-2026-11-01-bat-worker-session-map-advisory.md`（新增，DRAFT）

### 驗證

- 來源 / 文件檢查：PASS（各題 `檔案:行` 與工單 / 決策出處如上）
- build / tests：不適用（工單禁止 build；未改產品檔）
- 本機日誌：只以 scratchpad 腳本統計大小、筆數、event 種類、欄位名、`session` 欄長度與每月位元組；未輸出任何 log 內容、session id 或權杖
- 敏感值檢查：回覆稿與回報不含權杖、完整 session id、家目錄路徑或真名（`BAT_WORKSPACE_ID` 依 ct-exec 規則記錄於落點檢查）

### Commit

- 本單與回覆稿以 `git commit --only` 一次 commit（hash 見 git log；無產品 commit）

### 回報時間

2026-11-01T12:10:52+0800
