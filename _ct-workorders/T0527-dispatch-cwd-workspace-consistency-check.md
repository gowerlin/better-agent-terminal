---
schema_version: 1
schema_kind: workorder
id: T0527
title: "塔台派工 cwd 與落點工作區 folderPath 一致性檢查（不一致警告；yolo 且 cwd 明確屬於另一個工作區時拒派）＋ --agent 簡寫 / 未知 agent id 提示（BUG-132）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-132
priority: P1
sizing: S
created_at: "2026-10-14T17:04:00+0800"
started_at: "2026-10-14T17:05:44+0800"
updated_at: "2026-10-14T17:17:51+0800"
completed_at: "2026-10-14T17:17:51+0800"
target_version: "0.6.0-pre.9"
related:
  - BUG-132
  - BUG-129
  - "T0526（判定 #11，回報區「建議方向」[B] 與「建議下一步」第 1、4 點）"
  - "T0523（electron/dispatch-workspace.ts、helper 落點輸出、e2e/t0523-dispatch-workspace.spec.ts）"
  - "T0137 / BUG-031（不以 cwd 當落點主規則）"
  - "T0450（headless tower 權杖：agent 必須是 registry 已知 id）"
  - D141
affects_files:
  - electron/dispatch-workspace.ts
  - electron/terminal-command-handlers.ts
  - electron/main.ts
  - scripts/bat-terminal.mjs
  - src/App.tsx
  - src/stores/workspace-store.ts
  - electron/__tests__/
  - scripts/__tests__/
  - src/stores/__tests__/
  - e2e/
  - CLAUDE.md
  - _ct-workorders/T0527-dispatch-cwd-workspace-consistency-check.md
  - _ct-workorders/BUG-132-agent-cli-stale-bat-env-misroutes-dispatch.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData、真實 `bat-scripts.log`）；helper 測試設 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 到 temp（CLAUDE.md BUG-114 節）。e2e 一律隔離實例。不消耗 Claude token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 不改 T0137 / D140 的既有語意：cwd **不是**落點規則，只做檢核；`--agent default` 查找順序不變；T0523 的「塔台終端優先」不變。"
  - "🔴 遠端 headless 權杖範圍不得放寬（PLAN-036 K / T0450）：agent 簡寫若要在遠端生效，必須先正規化成 registry 已知 id 再過權杖檢查，不得讓未知 id 通過。"
  - "🔴 helper 成功判定只看 exit code；`waitForMessage` 以 frame id 比對的規則不變（BUG-114）。"
---

# T0527 — 派工 cwd / 落點工作區一致性檢查 + `--agent` 簡寫（BUG-132）

## 背景

T0526 以 外部測試者A 的日誌判定 BUG-129 屬於 T0523 §1 的 **#11**：外部測試者A 的 Codex 在 SCB 分頁執行指令時，看到的 `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` 是**專案B 塔台分頁**的值（agent CLI 自己保存的環境），所以 `--notify-id` 與 `--workspace` 都錯，T0523 的「塔台終端優先」也救不回來。yolo 模式下，Worker 的完成訊息還會被**送進**專案B 塔台並觸發它的流程。

根治（以 PID 祖先鏈辨識呼叫者 PTY）成本較高，先做便宜、能直接抓到這個情境的檢核（D141，T0526 建議 [B]）。請先讀 **BUG-132**、**T0526 回報區**（「判定結果」「建議方向」「建議下一步」）、**T0523 回報區第 1-4 節**。

## 任務

1. **cwd 一致性檢查**（本機 `terminal:create-agent-command` 與 `terminal:create-with-command` 由外部 helper 呼叫的路徑）：
   - main 解析出落點工作區之後（T0523 `electron/dispatch-workspace.ts` 的結果），比對派工的 `cwd`（helper `--cwd`，或 helper 送出的 `process.cwd()`）是否位於落點工作區的 `folderPath` 底下
   - 路徑比對：正規化分隔符號與結尾斜線；Windows / macOS 不分大小寫（mac 預設 APFS 不分大小寫，Linux 分）；`folderPath` 為空或解析不到時**跳過檢查**；是否需要 realpath（symlink、Google Drive / iCloud 這類路徑）由 Worker 判斷並說明取捨
   - 同時找出「cwd 位於哪些其他工作區的 `folderPath` 底下」，取最長前綴的那一個作為 `cwdWorkspace`（巢狀工作區時以最深者為準）
2. **處置**：
   | 情況 | 行為 |
   |---|---|
   | cwd 在落點工作區底下，或落點工作區沒有 `folderPath` | 照舊 |
   | cwd 不在落點工作區底下，也不屬於任何其他工作區 | 照舊建立；helper stderr 警告 + main `logger.warn`（可能是跨專案派工，不擋） |
   | cwd 不在落點工作區底下，**且明確屬於另一個工作區** `cwdWorkspace` | **非 yolo**：照舊建立 + 警告（列出落點與 `cwdWorkspace` 的名稱 / id）。**yolo**（`--mode yolo`）：**拒絕建立**，helper exit 1，訊息說明「塔台的 `BAT_*` 可能來自別的分頁（agent CLI 保存的舊環境）」，列出 `cwdWorkspace` 名稱 / id，並提示請使用者確認後改派 |
   - 日誌 tag 用 `[BUG-132]`；`bat-scripts.log` 記錄檢查結果（落點、`cwdWorkspace`、處置）
   - 拒絕的回應格式要讓 helper 能區分原因（不只是 `terminal-not-created`），沿用 T0456 / T0523 既有的錯誤回傳方式
3. **`--agent` 簡寫與未知 id 提示**（T0526 建議下一步第 4 點）：
   - `--agent codex` / `--agent claude` 這類常見簡寫正規化成 registry 已知 id（`codex-cli` / `claude-cli`；以實際 agent registry 為準，不要硬編碼不存在的 id）
   - 仍然不認得的 agent id：helper 印出「不認得的 agent id」與可用 id 清單，exit 1（目前只有 `terminal-not-created`）
   - 遠端 headless：正規化必須在權杖 `agent-not-allowed` 檢查之前做且只映射到已知 id；若成本或風險過高，只做本機並在回報區說明
4. **遠端 headless**：server 端沒有工作區 `folderPath`，落點由 client renderer `addExternalTerminal` 決定（T0523）。評估 renderer 端能否做同樣的檢查；可行且小則一併做，否則在回報區說明並留給後續
5. **文件**：CLAUDE.md「塔台派工落點（T0523 / BUG-129）」那一條補上 BUG-132 的檢查規則與 yolo 拒派行為（精簡，比照該節現有寫法）

## 驗證

- 單元測試：路徑比對（大小寫、分隔符號、結尾斜線、巢狀工作區取最深、`folderPath` 空）；三種處置各至少一條；yolo 拒派；非 yolo 只警告；`--agent codex` 正規化；未知 agent id 的錯誤與 exit code
- helper 測試：拒派時 exit 1 且 stderr 有可辨識訊息；成功路徑輸出與 T0523 一致（不回歸）
- 遠端 headless：既有 `electron/remote/__tests__/headless-remote-tower-e2e.test.ts`、權杖範圍測試全綠
- 擴充 `e2e/t0523-dispatch-workspace.spec.ts`（或新 spec，隔離實例）：兩個工作區各有 `folderPath`，在 A 的終端以 B 的 cwd 派工 → 非 yolo 落在 A + 警告；yolo → 拒派
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` exit 0、`npm run test:unit` 全套無回歸

## 驗收條件

- [x] cwd 與落點工作區不一致時有警告（helper + main log + `bat-scripts.log`）
- [x] yolo 且 cwd 明確屬於另一個工作區 → 拒派 exit 1，訊息可行動
- [x] 跨專案派工（cwd 不屬於任何工作區）不被擋
- [x] `--agent codex` 可用；未知 agent id 有清楚錯誤
- [x] 遠端權杖範圍不變
- [x] CLAUDE.md 同步；BUG-132：`status: FIXED`、`fixed_at`、body 狀態列同步

## Sub-session 執行指示

1. 讀本工單、BUG-132、T0526 回報區、T0523 回報區第 1-4 節
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單檔案（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

**DONE**。本機 helper 派工（`terminal:create-agent-command` / `terminal:create-with-command`，無呼叫視窗）在 T0523 解析出落點後，比對派工 cwd 與落點工作區 `folderPath`：

| 情況 | 行為（已實作） |
|---|---|
| cwd 在落點工作區底下 / 落點無 `folderPath` / 落點解析不到（active 或未知 id）/ cwd 非絕對路徑 | 照舊（`dispatch-cwd-check` 記 `inside` 或 `skipped` + `reason`） |
| cwd 不在任何工作區底下 | 照舊建立；helper stderr 警告「cross-project dispatch?」+ main `logger.warn [BUG-132]`，yolo 也不擋 |
| cwd 在**另一個**工作區底下（巢狀取最深） | 非 yolo：建立在落點 + 警告（列出 `cwdWorkspace` 名稱 / id）。`--mode yolo`：**拒派**，回 `{ ok:false, code:'DISPATCH_CWD_OTHER_WORKSPACE', error, cwd, landingWorkspace, cwdWorkspace }`，helper exit 1，訊息說明 `BAT_*` 可能來自別的分頁（agent CLI 保存的環境），列出兩個工作區並提示改派方式 |

`--agent` 簡寫：`normalizeAgentAlias` 只映射到 registry 已知 id（原 id → 小寫 → `<id>-cli`；`codex` → `codex-cli`、`claude` → `claude-cli`、`gemini` / `copilot` 同理，皆以 `agentRegistry.getDefinition` 為準，沒有硬編碼對照表）。仍不認得 → `{ ok:false, code:'AGENT_UNKNOWN', agentId, knownAgents, error }`，helper 印「Unknown agent id … Known agent ids: …」並 exit 1（原本只有 `terminal-not-created`）。遠端 headless 權杖的 `isKnownAgent` 改為「正規化後的 id 是否在 registry」，在 `agent-not-allowed` 檢查之前正規化、只映射到已知 id，未知 id 照舊拒絕。

設計重點：
- **cwd 只做檢核，不是落點規則**：落點仍由 T0523（塔台終端優先 → `--workspace` → active）決定，T0137 / D140 語意不變；`--agent default` 查找順序不變
- **yolo 判定**：helper `--mode yolo` 注入的 `customEnv.CT_MODE === 'yolo'`
- **路徑比對**（`normalizeDispatchPath`）：`\` → `/`、去重複 / 結尾分隔符、解析 `.` / `..`；win32 與 darwin 轉小寫（Linux 分大小寫）；win32 另接受 Git Bash `/d/repo` 與 UNC。前綴比對以 `parent + '/'` 為界（`/a/bank2` 不算在 `/a/bank` 底下）
- **realpath 取捨**：原路徑與 realpath **兩者都比**，任一組合命中即算在底下。理由：`process.cwd()` 在 POSIX 回傳實體路徑（symlink 已解開），而使用者選的 `folderPath` 可能經過 symlink（macOS `/tmp` → `/private/tmp`、雲端硬碟資料夾，外部測試者A 的 SCB 在 iCloud `~/Library/Mobile Documents/...`），只比原字串會把「其實在裡面」誤判成「不在」。realpath 走 `fs.promises.realpath`（非同步，不擋 main），每個路徑 300 ms 逾時即只比原路徑（`DISPATCH_REALPATH_TIMEOUT_MS`，`electron/main.ts`），避免雲端 / 網路磁碟卡住派工（helper 等 invoke 3 s）。誤判方向：realpath 失敗時最壞是把「在裡面」看成 `outside` → 只警告、不拒派；拒派需要 cwd **明確命中另一個工作區**的 `folderPath`
- **只有 helper 派工會檢核**：本機視窗自己建的終端（`ctx.windowId` 有值）不經 resolver，也不檢核；renderer 的 `createWithCommand` 回傳型別（boolean）不變

### 修改檔案

- `electron/dispatch-workspace.ts`：`DispatchWorkspaceRequest.cwd`、`DispatchWorkspaceResolution.cwdCheck`、`DispatchCwdCheck` 型別；`normalizeDispatchPath` / `isDispatchPathInside` / `checkDispatchCwd`（可注入 `platform`、`realpath`）；`findWorkspace` 改由 `listWorkspaces` 取（含 `folderPath`），行為不變
- `electron/terminal-command-handlers.ts`：`DispatchCwdReport` / `DispatchRefusal` / `DISPATCH_CWD_OTHER_WORKSPACE` / `AGENT_UNKNOWN`；`normalizeAgentAlias`（export）；`applyCwdCheck`（`[BUG-132]` warn、`dispatch-cwd-check` / `ipc-result` mirror、yolo 拒派）；`unknownAgent`；`TerminalCreatedReport.workspace.cwdCheck`（僅 `outside` / `other-workspace` 時出現，T0523 既有輸出不變）；deps 新增可選 `isKnownAgent` / `listAgentIds`（預設 `agentRegistry`）
- `electron/main.ts`：`resolveDispatchWorkspace` 附上 `checkDispatchCwd`；`realpathWithin`（300 ms 逾時）
- `electron/remote/headless-entry.ts`：權杖 `isKnownAgent` 先 `normalizeAgentAlias`（affects_files 未列，見偏差）
- `scripts/bat-terminal.mjs`：成功時印 cwd 警告（stderr）；`DISPATCH_CWD_OTHER_WORKSPACE` 拒派時多印 `cwd workspace:` / `landing workspace:`；`terminal-created` refused 事件記 `knownAgents` / `cwdWorkspace` / `landingWorkspace`；遠端 `agent-not-allowed` 加 `Hint:`；`--help` 註明簡寫
- `electron/__tests__/dispatch-cwd-check.test.ts`（新）、`electron/__tests__/terminal-handlers.test.ts`、`tests/bat-terminal-response-correlation.test.mjs`、`e2e/t0523-dispatch-workspace.spec.ts`
- `CLAUDE.md`「塔台派工落點（T0523 / BUG-129）」條補 BUG-132 規則與 `--agent` 簡寫
- `_ct-workorders/BUG-132-…md`：`status: FIXED`、`fixed_at`、body 狀態列

### 驗證

| 項目 | 結果 |
|---|---|
| 單元：`electron/__tests__/dispatch-cwd-check.test.ts`（16）| ✅ PASS：大小寫（win32 / darwin 不分、linux 分）、分隔符號、結尾斜線、`.`/`..`、Git Bash `/d/…`、UNC、相對路徑 → null；`inside` / `outside` / `other-workspace`（巢狀取最深、跨視窗工作區）/ `skipped`（無 folderPath、landing 未知 / active、無 cwd、非絕對路徑）；realpath（symlink 命中、realpath 失敗退回原路徑）；`normalizeAgentAlias`（`codex` / `claude` / `Codex` / `gemini` → `-cli`，已知 id 不變，`codx` / `constructor` / `../codex` 不映射）；headless 權杖接線：`codex` 允許、`codx` / `constructor` 仍 `agent-not-allowed` |
| 單元：`electron/__tests__/terminal-handlers.test.ts` BUG-132 區（10 條）| ✅ PASS：inside 不警告；非 yolo 他工作區 → 建立 + `[BUG-132] … → created with a warning`；yolo 他工作區 → 拒派、未建立、未 emit、未呼叫 agent builder、`ipc-result` reason；outside + yolo → 建立 + 警告；無 folderPath → skipped；raw command 模式 yolo 拒派 / 非 yolo 警告；本機視窗不檢核；headless 無 resolver 不檢核；`--agent codex` → builder 收到 `codex-cli`、report `requested: 'codex'`；未知 agent → `AGENT_UNKNOWN` + `knownAgents`（不含 `none`）|
| helper：`tests/bat-terminal-response-correlation.test.mjs` 新增 6 條（mock server，`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 在 temp）| ✅ PASS：拒派 exit 1 + stderr 可辨識（code、兩個工作區）+ `bat-scripts.log` refused 事件；非 yolo 警告 exit 0；outside 警告；**無 cwdCheck 時 T0523 輸出不變且無 cwd 警告**；`AGENT_UNKNOWN` exit 1 列出已知 id；遠端 `agent-not-allowed` 提示。既有 10 條照舊綠 |
| 遠端 headless：`headless-remote-tower-e2e` / `helper-capability` / `headless-helper-narrowing` / `headless-helper-capability` | ✅ 130/130 PASS（權杖範圍不變） |
| e2e `e2e/t0523-dispatch-workspace.spec.ts`（隔離實例，`npx vite build` 後；`npx playwright test e2e/t0523-dispatch-workspace.spec.ts`）| ✅ 1 passed。原 T0523 斷言全保留，新增：在 B 的塔台終端以 A 的 cwd 派工 → `--mode ask` 落在 B + stderr 警告點名 A；`--mode yolo` → exit 1 `DISPATCH_CWD_OTHER_WORKSPACE`、未建立；未知 `--agent` → `AGENT_UNKNOWN`；debug log 有兩行 `[BUG-132]`；隔離實例的 `bat-scripts.log` 有 `inside/proceed`、`other-workspace/warn`、`other-workspace/refuse` |
| `npm run typecheck` | ✅ exit 0（0 error） |
| `npm run typecheck:electron` | ✅ exit 0（0 error）。註：第一次執行時輸出出現一段 Node stack trace，立即重跑兩次皆 exit 0、0 error，未能重現 |
| `npx vite build` | ✅ exit 0 |
| `npm run test:unit` 全套 | ✅ 217 files / 3674 passed / 1 skipped（skipped 為既有）|

未跑全套 e2e（L141）。未觸碰使用者的 BAT（port 9876、真實 userData、真實 `bat-scripts.log`）；e2e 用隔離 runtime，跑完已移除。沒有消耗 Claude token（e2e 用 echo agent）。

### 遠端 headless 評估

**renderer 端 cwd 檢查：不做，留給後續**。理由：
1. **時序上無法拒派**：遠端 PTY 在 server 建立完、helper 已收到回覆（exit code 已決定）之後，client renderer 才收到 `terminal:created-externally`。renderer 端只能事後寫 log，擋不了 yolo，也無法把警告送回 helper，而 BUG-132 要擋的正是「yolo 把完成訊息送進別的塔台」
2. **server 端沒有 `folderPath`**：要在遠端做到與本機同等的檢查（含 yolo 拒派），server 必須知道 client 工作區的 `folderPath`（例如 client 連線時同步 `{ workspaceId, folderPath }` 清單，或 helper 送出時由 server 向 client 查詢）。這是 protocol 層變更，超出 S 規模
3. **權杖範圍**：`--agent` 簡寫在遠端已生效（權杖檢查前正規化，只映射到已知 id），T0450 的未知 id 拒絕不變

建議：若遠端也出現 #11，與根治方案 [A]（PID 祖先鏈辨識呼叫者 PTY，遠端 server 也有 PTY pid）一起處理，不單獨做 renderer log。

### 偏差 / 備註

- **affects_files 外的檔案**：`electron/remote/headless-entry.ts`（遠端權杖 `isKnownAgent` 必須先正規化，任務 3 明確要求）、`tests/bat-terminal-response-correlation.test.mjs`（helper 測試的 mock RemoteServer 在這裡，`runBatTerminal` 改為可帶參數，預設不變；另開新檔需複製約 200 行 mock server）、`electron/__tests__/dispatch-cwd-check.test.ts`（新檔，位於 affects_files 的 `electron/__tests__/` 底下）
- **未修改** `src/App.tsx` / `src/stores/workspace-store.ts`（遠端 renderer 檢查不做，見上節）
- **合法的跨工作區 yolo 派工會被擋**：例如塔台刻意在 A 派一個 cwd 在 B 的 Worker 且用 yolo。錯誤訊息已提示「不帶 `--mode yolo` 即可建立（帶警告）」；沒有新增略過旗標（工單未要求）。若日後有正當需求，可考慮 `--allow-cwd-mismatch` 之類旗標，交塔台決定
- `--agent` 簡寫的對照是「registry 驅動」：`<x>` 不認得時才試小寫與 `<x>-cli`，所以自訂 CLI（例如 id 為 `foo`）不會被改寫；若日後 registry 同時有 `foo` 與 `foo-cli`，`--agent foo` 仍指 `foo`
- 給塔台的建議（不在本單範圍）：control-tower skill `references/auto-session.md` 補「派工前核對 `$BAT_WORKSPACE_ID` 對應的 `folderPath` 是否涵蓋 cwd」（T0526 建議第 5 點），現在 BAT 端已有對應警告 / 拒派，skill 文件可改為「看到 `DISPATCH_CWD_OTHER_WORKSPACE` 時怎麼處理」

### Landing Zone Check

- **PASS**
- C-0 PASS：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS：工單位於 REPO_ROOT 之下
- C-3（informational）：前 5 個可測條目 `electron/dispatch-workspace.ts`、`electron/terminal-command-handlers.ts`、`electron/main.ts`、`scripts/bat-terminal.mjs`、`src/App.tsx` 皆存在
- C-2：無 `branch` 欄位（目前在 `main`）
- `BAT_WORKSPACE_ID`（evidence only）= `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 互動紀錄

- 依 `CT_INTERACTIVE=0` 執行，沒有向使用者提問；範圍內的取捨（realpath、遠端 renderer 不做、不加略過旗標）依最佳建議自行決定並記錄於上

### Commit

- 單一 commit，message 以 `fix(dispatch): T0527 …` 開頭；`git commit --only` 列出本單相關檔案，未含 `src/styles/settings.css`（非本單變更）；不 push
- 塔台可用 `git log --oneline -1 --grep T0527` 取得 hash
