---
schema_version: 1
schema_kind: workorder
id: T0811
title: "PLAN-061：非 Windows 主機的 claude OSC 7501 狀態回報（解析器白名單 / 4096 / 子紀錄、主行程回覆探詢、只補 hooks 關閉的分頁）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-03T21:11:52+0800"
started_at: "2026-11-03T21:15:25+0800"
updated_at: "2026-11-03T21:35:02+0800"
completed_at: "2026-11-03T21:35:02+0800"
session_ids:
  - "ed242b61-0673-4ce9-9f3e-81f95b77db04"
depends_on: []
related:
  - "PLAN-061；D229 / D258；T0789 回報區（④ 做法 B、⑤ 結論、〈建議下一步〉工單草案）；T0621 / D158（codex 7501 規則）；T0717（codex `done` / `error`）；CLAUDE.md「blocked 狀態偵測」「Worker 啟動確認」節；`docs/agent-guide/blocked-state.md`"
affects_files:
  - src/lib/codex-terminal-state.ts
  - "src/lib/__tests__/codex-terminal-state*.test.ts（或新測試檔）"
  - electron/pty-manager.ts
  - electron/terminal-blocked-state.ts
  - "electron/__tests__/**（新增 / 修改本單相關測試）"
  - "electron/remote/headless-entry.ts（只在回覆需要接線時）"
  - "e2e/t0789-claude-osc7501-probe.spec.ts（只在改成驗收用途時；或新 spec，放 vitest / playwright 既有位置）"
  - docs/agent-guide/blocked-state.md
  - "docs/agent-guide/worker-launch-confirmation.md（只在 agentStarted 規則有變時）"
  - CLAUDE.md
  - _ct-workorders/T0811-claude-osc7501-status-non-windows.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 範圍以 D229 / T0789〈建議下一步〉草案為準：① 解析器白名單 `app ∈ { codex, claude-code }`、長度上限 128 → 4096（未完成序列的保留長度跟著改）、只讀 `state` / `kind`、不認得的值忽略；帶 `id=` 的紀錄一律不影響分頁狀態，沒有 `id` 的 `state=clear`（不帶 `app`）才是分頁 clear。② 主行程 `PtyManager.enqueuePtyOutput` 看到探詢 `ESC ] 7501 ; ?`（BEL 或 ST）→ 非 Windows 的 PTY 主機以 BAT 自動寫入回覆固定內容 `ESC]7501;?BEL`，每個探詢只回一次；`handleReplayBuffer`（replay）不回；Windows（ConPTY）不寫。③ claude 狀態套用 codex 規則：第一個序列把 `blockedDetection` 設為 `osc`、已是 `hook` 時忽略；`blocked` → `blockedReason: input`，`working` / `idle` / `done` / `error` / `clear` 清除；`agentStarted` 比照 codex 的 osc 分頁。"
  - "🔴 不做：Esc 中斷 / API 錯誤 / 背景子代理這些「hook 不知道的事」補到 hook 分頁（T0789 建議另案）；不注入 claude 參數或 env（不碰 `CLAUDE_CODE_DISABLE_TERMINAL_TITLE`）；不在 xterm / renderer 回覆（T0789 做法 A 不採用）；不改 codex 行為。"
  - "🔴 安全與日誌：`title` / `msg` 不解碼、不存、不記日誌；回覆不算使用者輸入（`isTerminalAutoReply` 已涵蓋 OSC，要有測試守住：不更新 `lastUserInputAt`、不取消 `--close-worker` / 用量限制等待、不清 ⚠️）；PTY 輸出只讀、不改寫（CLAUDE.md blocked 狀態偵測節）。"
  - "🔴 不回歸：hook 分頁行為完全不變；codex 行為不變（`e2e/t0621-codex-osc-state.spec.ts` 必跑；跑不了要說明原因並以單元測試覆蓋 codex 轉換表）；Windows 本機分頁的 PTY 寫入與 T0789 前完全相同（測試守住 win32 不寫）。改 `PtyManager` 時注意 CLAUDE.md 的 PTY env 唯一組裝點、`holdInputForDispatch`、T0788 notify-hold，不得影響。"
  - "🔴 驗證：單元測試（解析：白名單、4096、子紀錄、無 app 的 clear、未知值忽略；回覆：只寫一次、replay 不寫、win32 不寫、自動回應不算輸入）；突變檢查（拿掉回覆 / 拿掉 `id=` 判斷 → 對應測試失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`。實機（Linux）：優先 WSL 上的真 claude（`disableAllHooks` 分頁進權限對話框時 `blocked` / `input` / `osc`，回答後清除；hook 分頁仍是 `hook`）。🔴 L185：claude 若未登入，不得登入、不得對未登入的 TUI 送任何按鍵；改用假程式在真 PTY 送探詢與狀態序列驗證回覆與狀態轉換，並在回報註明「真 claude 未實測」。WSL 使用者的 `~/.config/BetterAgentTerminal`、`~/.claude`、`~/.codex`、原本在跑的 bat-server 不改不停，BAT 一律隔離 userData / dataDir。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。本單與 T0812 / T0813（研究型，只改各自工單檔）並行，不得改它們的檔。公開 repo（D176）：commit / 回報不寫帳號名與家目錄路徑。"
---

# T0811 — 非 Windows 主機的 claude OSC 7501 狀態回報（PLAN-061）

## 元資料

- **工單編號**：T0811
- **類型**：implementation
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T21:11:52+0800
- **預估規模**：M

## 背景

BAT 的 OSC 7501 解析器（`src/lib/codex-terminal-state.ts`）只收 `app=codex`、上限 128 字元。T0789 查證（Linux PTY、claude `2.1.316`）：claude 要終端回覆 `ESC ] 7501 ; ?` 探詢（2 秒內、在 DA1 回覆之前）才會送狀態，送出的狀態與 BAT hook 幾乎同時，`disableAllHooks` 下照送；Windows 本機的系統 ConPTY 丟掉 OSC 回覆，做不到。D229 定案：範圍是「非 Windows 主機上關掉 hooks 的 claude 分頁」，回覆放主行程（T0789 做法 B）。使用者 2026-11-03 指示開始（D258）。

完整證據、序列實錄、升版檢查清單見 T0789 回報區；本單以其〈建議下一步〉草案為準，上方 memory_overrides 是摘要。

## 範圍

1. 解析器：白名單 `codex` / `claude-code`、上限 4096、`id=` 子紀錄與無 app 的 `state=clear` 規則、只讀 `state` / `kind`（可改名 / 抽出共用模組，但 codex 的 consumer 行為不變）。
2. 主行程回覆：`PtyManager.enqueuePtyOutput` 偵測探詢 → 非 Windows 主機自動寫入固定回覆一次；replay 不回；Windows 不寫。Terminal Server 模式、direct 模式、headless（同一個 `PtyManager`）都要涵蓋；判斷依 PTY 所在主機的平台。
3. tracker：claude 狀態接進 `TerminalBlockedTracker`（規則同 codex），`agentStarted` 比照 osc 分頁。
4. 文件：`docs/agent-guide/blocked-state.md` 加 claude 7501 一節（含 T0789 ⑤-5 升版檢查）、CLAUDE.md「blocked 狀態偵測」節補一兩句（遵守 CLAUDE.md 撰寫規則：只寫用途、必守規則、唯一實作位置、連到 docs）。

## 不做

- hook 分頁的回合信號補強、xterm 回覆、注入 claude 參數、改 codex 行為、發版、push。

## 驗收

- [ ] 實作說明（改了哪些函式、回覆的寫入路徑、平台判斷依據）
- [ ] 單元測試清單與突變檢查結果
- [ ] typecheck 0 / 0、unit、legacy、vite build 結果
- [ ] codex 不回歸證據（`t0621` e2e 或說明＋單元測試）
- [ ] Linux 實機結果（真 claude 或假程式，註明是哪一種）
- [ ] 文件更新清單

---

## 回報區

<!-- Worker 由此往下寫 -->

### 完成狀態

- **狀態**：DONE（範圍 ①–④ 完成，驗收六項都有證據）
- **結論一句話**：非 Windows 主機上，BAT 主行程看到 claude 的探詢 `ESC ] 7501 ; ?` 就寫回固定回覆，hooks 關閉（`none`）的 claude 分頁改由 claude 自己的 OSC 7501 判斷 `blocked` / `input` / `osc` 與 `agentStarted`；hook 分頁、codex、Windows 本機的行為不變。
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，相符；C-1：工單在 `REPO_ROOT/_ct-workorders/` 下；C-3：`affects_files` 可測項目都存在（present）；C-2：工單沒有 `branch` 欄位，略過（實際在 `main`）。`CT_HOME` 未設（不在 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **Commit**：產品 `f274847c`（9 個檔，`git commit --only` 明列路徑）；本工單另一個 commit（回報與最終 metadata）。不 push、不發版。T0812 / T0813 / T0814 / T0815 / PLAN-058 / `_decision-log.md` / `_insights/` 的變更不是本單的，未碰。
- **session_id**：ed242b61-0673-4ce9-9f3e-81f95b77db04

### 互動紀錄

- [21:15] 開工：yolo（`CT_MODE=yolo`、`CT_INTERACTIVE=0`）。範圍與做法都已由 D229 / T0789 草案定案，沒有需要問塔台的問題，未發 `提問`。
- [21:31] 〈commit 前〉與〈填回報前〉兩個節點檢查 `## 塔台補充（`：沒有。〈驗證前〉節點漏做，見〈遭遇問題〉3。
- 方法論：本單沒有 frontmatter `methodology`、沒有 `### 方法論邊界`；本 session 沒有看到方法論注入，也沒有呼叫任何方法論 skill。

### 實作說明

- **解析器**（`src/lib/codex-terminal-state.ts`，未改名，codex consumer 行為不變）：
  - `PROGRAM_STATUS_APPS` = `['codex', 'claude-code']`：其他 `app=` 整個序列丟掉；沒有 `app` 照舊接受（codex 與 claude 的 `state=clear` 都不帶）。
  - `CODEX_OSC_PAYLOAD_MAX` 128 → 4096（未完成序列的保留尾巴用同一個常數，自動跟著改）。
  - `parseCodexOscPayload`：出現 `id` key 就回 null（子紀錄一律不影響分頁）；只讀 `state` 的值，`app` / `id` 只用來決定接不接受；`kind` / `progress` / `title` / `msg` 不解碼、不存。`done` / `error` → `idle`、未知值忽略（沿用 codex 規則）。
  - `scanCodexStates` 多回傳 `probes`（payload 剛好是 `?` 的序列數）；`CodexStateScanner` 新增 `scan(id, chunk)` 回 `{ states, probes }`，`feed` 改成呼叫它（行為不變）。新增常數 `PROGRAM_STATUS_PROBE_REPLY` = `ESC ] 7501 ; ? BEL`。
- **主行程回覆**（`electron/pty-manager.ts`）：
  - `enqueuePtyOutput` 改用 `codexStates.scan`，`probes > 0` → 新函式 `replyToProgramStatusProbes(id, probes)`。
  - 寫入路徑：`PtyManager.write(id, PROGRAM_STATUS_PROBE_REPLY.repeat(probes))`，也就是 BAT 自己的寫入：direct 模式寫 node-pty、Terminal Server 模式送 `pty:write` 給 server、headless bat-server 用同一個 class 在遠端主機寫。不經 `pty:write` handler，所以不呼叫 `noteUserInput`、不經 T0788 notify-hold；`write` 不看 `holdInputForDispatch`（那只在 `writeWithResult`）。
  - 平台判斷：新 dep `PtyManagerDeps.hostPlatform`（預設 `process.platform`）。PtyManager 所在的行程就是 PTY 主機：Terminal Server 由主行程在同一台 fork、headless 在遠端主機自己跑。`win32` → 不寫，記 `[program-status] terminal=<id> probe seen, no reply (win32 ConPTY drops OSC replies)`。
  - 不回的情況：replay（`handleReplayBuffer` 不經 `enqueuePtyOutput`，只以 `lastCodexState` 恢復最後狀態，claude 狀態一樣適用）、child_process 後援（`usePty: false`）、win32 主機。
  - 每個探詢一次：被 chunk 切開的探詢只在完成的那個 chunk 算一次。日誌只記 terminal id。
- **tracker**（`electron/terminal-blocked-state.ts`）：邏輯不用改，claude 的狀態走既有的 `observeCodexState`（第一個序列 `none` → `osc`、已是 `hook` 忽略、`blocked` → `input`、`working` / `idle` / `done` / `error` / `clear` 清除、`agentStarted` 比照 osc 分頁）。BAT 注入 hooks 的 claude 分頁在啟動決策時就記成 `hook`（`recordBlockedDetection`），所以一定忽略 7501。只補檔頭註解。
- **不做**（照工單）：hook 分頁的回合補強、xterm 回覆、注入 claude 參數 / env、改 codex 行為、發版、push。

### 單元測試與突變檢查

- 新增 / 修改：
  - `src/lib/__tests__/codex-terminal-state.test.ts`：新增 `claude-code OSC 7501 (T0811)` 區（claude 各狀態含 `kind=permission|question|auth`、不帶 kind、`progress`、`done` / `error`、無 app 的 `state=clear`；白名單；`id=` 子紀錄（含 `state=clear:id=` 與 T0789 背景子代理序列）；未知 key / 值、`msg` 內容不解碼；4096 上限（130 字元、2,732 字元 msg、剛好 4096、超過 1 字元丟掉、切開）；探詢計數（BEL / ST、多個、非探詢、每個切點只算一次））。既有斷言補 `probes: 0`。
  - `electron/__tests__/claude-osc-status.test.ts`（新）：linux 主機回覆一次且輸出原樣送 renderer、切開的探詢回一次、win32 不寫＋日誌、child_process 不寫、Terminal Server 路徑送 `pty:write` 且 replay 不回、`holdInputForDispatch` 不保留、回覆不算使用者輸入（`lastUserInputAt` null、hook `permission` 不被清、`isTerminalAutoReply` 為 true）、`none` → `osc` 的完整轉換（長 `msg` 的 `blocked`、使用者輸入不清 `input`、三種結束都清除、回合）、日誌不含 `msg` / 秘密字串、子紀錄不影響、hook 分頁忽略但仍回覆。
  - `electron/__tests__/codex-osc-state.test.ts`：source guard 由 `codexStates.feed(id, data)` 改成 `codexStates.scan(id, data)`。
- **突變檢查**（改壞 → 跑三個測試檔 → 從 scratchpad 備份還原，未用 git 指令還原；還原後 90 / 90 通過）：

  | 突變 | 失敗的測試 |
  |---|---|
  | 拿掉回覆（`enqueuePtyOutput` 不呼叫 `replyToProgramStatusProbes`） | 6 個（回覆、切開、win32 日誌、Terminal Server、派工保留、hook 分頁仍回覆） |
  | 拿掉 win32 判斷 | 1 個（win32 不寫） |
  | 拿掉 `id=` 判斷 | 2 個（解析器子紀錄、PtyManager 子紀錄不影響） |
  | 上限改回 128 | 2 個（4096 上限、`none` 分頁長 `msg` 的 blocked） |
  | 白名單拿掉 `claude-code` | 17 個 |

### 驗證結果

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0。
- `npm run test:unit`：exit 0，398 檔通過 / 2 skipped；6975 tests 通過 / 37 skipped。
- `npm run test:legacy`：exit 0，33 檔 472 tests 全過。
- `npx vite build`：exit 0。
- **codex 不回歸**：`npx playwright test e2e/t0621-codex-osc-state.spec.ts --output <scratchpad>`：1 passed（24.1 s）。codex `0.166.0`（官方安裝位置），派工 `started`、核准提示 `blocked` / `input` / `osc`、`y` 後清除、未信任 repo exit 8 `unconfirmed`。單元測試的 codex 轉換表（`codex-osc-state.test.ts`、`codex-terminal-state.test.ts` 原有案例）也全過。`--output` 指到 scratchpad，沒有清空共用的 `e2e-results/`。
- **Linux 實機**（WSL Ubuntu 24.04、核心 6.18、node 26.13.0；暫存目錄 `~/ct-T0811`，裝 `@lydell/node-pty@1.1.0`（linux-x64）、`tsx`；以 tsx 直接載入 repo 的 `electron/pty-manager.ts` 原始碼，node-pty 換成 linux 版，真 `/bin/bash` PTY）：
  1. **假程式**（`fake-claude.cjs`：照 T0789 ①／② 送探詢、等回覆、再送狀態序列）：19 項全過。
     - `none` 分頁：回覆後 `none` → `osc`、`agentStarted`；帶約 2k 字元 `msg` 的 `blocked:kind=permission` → `blocked` / `input` / `source: osc`；`noteUserInput` ＋ `y` 後假程式送 `working` → 清除；背景子代理 `id=` 的 `working` / `clear` 沒有讓回合結束，`done` 才結束；假程式收到**剛好 1 個**回覆、沒有其他多餘位元組；renderer 收到的輸出仍含探詢原文；`lastUserInputAt` 沒變。
     - hook 分頁：`hook` 不變、沒有 `blocked`、沒有 `agentStarted`，但仍回覆 1 次。
     - `hostPlatform: 'win32'`：假程式 2 s 內沒收到回覆、分頁維持 `none`、有 win32 日誌行。
     - 日誌不含 `msg` / `title` / 秘密字串。
  2. **真 claude**：`@anthropic-ai/claude-code-linux-x64@2.1.316`（與 BAT 內嵌同版），隔離 HOME / `CLAUDE_CONFIG_DIR`（設定 `disableAllHooks: true`）、假 API key、`ANTHROPIC_BASE_URL` 與 HTTP(S)_PROXY 都指向 `127.0.0.1:9`（不會連外、模型花費 0）。PtyManager 在 bash 裡 `exec claude`，模擬 renderer 在看到 DA1 查詢 30 ms 後回 `ESC [ ? 1 ; 2 c`。**沒有對 claude TUI 送任何按鍵**（只有終端自動回應：BAT 的 7501 回覆與模擬的 DA1 回覆），也沒有登入（L185）。
     - linux 主機：claude 送探詢 → BAT 回覆 → claude 送 `state=idle:app=claude-code` → 分頁 `none` → `osc`、`agentStarted: true`、`lastUserInputAt` 仍是 null。日誌 `[program-status] terminal=c probe → reply`、`[codex-state] terminal=c → idle`、`[agent-start] terminal=c → started (osc idle)`。
     - 同一個 claude、`hostPlatform: 'win32'`：只有探詢、0 個狀態、分頁維持 `none`（等於拿掉回覆的對照組）。
     - **真 claude 的權限對話框 / AskUserQuestion（`blocked` → 回答後清除）未實測**：要送 prompt 與按鍵、也要模型（假 API），本單沒做；這段由假程式驗證。
  - 清理：WSL `~/ct-T0811` 已刪除，沒有殘留程序。WSL 的 npm 下載快取（`~/.npm`）沒有清。WSL 使用者的 `~/.config/BetterAgentTerminal`、`~/.claude`、`~/.codex`、`~/.local/bin/claude`、bat-server 都沒有讀寫或停止。repo 只被 WSL 讀取（tsx 的快取在 WSL `/tmp`）。

### 文件更新

- `docs/agent-guide/blocked-state.md`：新增「claude（OSC 7501，PLAN-061 / T0811）」一節（探詢與回覆、寫入路徑、replay / Windows / 不算使用者輸入的規則、hook 分頁的副作用、解析規則、轉換、已知限制、T0789 ⑤-5 的升版檢查、驗證清單）；codex 節的偵測點改成 `CodexStateScanner.scan`、上限 4096。
- `docs/agent-guide/worker-launch-confirmation.md`：`agentStarted: true` 補一句 hooks 關閉的 claude 分頁（規則與 helper 都沒改，`--wait-started` 對這類分頁仍多半回 `unknown`）。
- `CLAUDE.md`「blocked 狀態偵測」節：加一條（用途、必守規則、唯一實作位置、連到 docs）。檔案 99,383 bytes。

### 遭遇問題

1. 沒有阻擋。`@lydell/node-pty` / `tsx` / claude linux 套件在 WSL 暫存目錄安裝時，npm 擋了 esbuild 的 postinstall（npm 12 預設），不影響執行。
2. 測試裡 `useServer` 是 getter，Terminal Server 路徑的測試改以 `Object.defineProperty` 模擬已連線（只在測試內）。
3. 流程：§ Tower Addenda Check 的〈驗證前〉節點漏做（在跑 typecheck / unit 之前沒有檢查）；〈commit 前〉與〈填回報前〉兩個節點都檢查過，工單從頭到尾沒有 `## 塔台補充（` 段落，結果沒有影響。

### 已知限制與後續

- Windows 本機（系統 ConPTY）仍做不到，Windows 的 hooks 關閉 claude 分頁仍是 `none`（D229 已知）。macOS 未實測。
- 非 Windows 主機上 BAT hook 分頁的 claude 也會收到回覆，claude 之後不再用 OSC 0 標題做忙碌動畫（T0789 ③）；BAT 不讀 OSC 0，判斷不受影響。
- hooks 被專案設定 / MDM 關掉、啟動決策讀不到的分頁仍記 `hook`，7501 被忽略（既有限制）。
- 使用者設 `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` 時 claude 不探詢。
- 建議（給塔台）：若要以真 claude 驗 `blocked` 這段，可用 T0789 spec 的假 API 腳本在 WSL 跑一次、改由 BAT 的 PtyManager 回覆；Esc 中斷 / API 錯誤 / 背景子代理補到 hook 分頁維持 T0789 建議的另案。

### 回報時間

- 2026-11-03T21:33:07+0800
