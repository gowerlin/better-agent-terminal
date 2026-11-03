---
schema_version: 1
schema_kind: workorder
id: T0818
title: "PLAN-061 交付版驗收：WSL Ubuntu 以 `v0.7.4-pre.5` AppImage 確認 hooks 關閉的 claude 分頁以 OSC 7501 回報狀態（含真 claude 權限對話框 `blocked`）"
type: verification
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T00:49:06+0800"
started_at: "2026-11-04T00:50:26+0800"
updated_at: "2026-11-04T01:09:00+0800"
completed_at: "2026-11-04T01:09:00+0800"
session_ids:
  - "3c9d93bf-2b58-4a4d-8f1f-bb83d1801470"
depends_on: []
related:
  - "PLAN-061；T0811（`f274847c`）；T0789（`e2e/t0789-claude-osc7501-probe.spec.ts` 的假 API 腳本）；D229 / D262 / D263；T0803（WSL 跑交付版 AppImage 的前例）；L185"
affects_files:
  - _ct-workorders/T0818-plan061-verify-delivered-appimage-wsl.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只做驗收，不改任何產品程式、測試、文件、workflow；repo 內唯一可改的檔案是本工單（回報區）。驗收用的腳本、下載的 AppImage、假 API、隔離目錄一律放 WSL 暫存目錄，收尾刪除。"
  - "🔴 不碰使用者既有資料：WSL 的 `~/.config/BetterAgentTerminal`、`~/.claude`、`~/.codex`、`~/bat-build`、`~/.local/bin/*` 不讀寫、不刪；BAT 用隔離 userData（`--runtime=<id>` 或 e2e 既有的隔離方式），claude 用隔離的 HOME / `CLAUDE_CONFIG_DIR`。不碰 Windows 端的 BAT 安裝版與它的 Terminal Server。"
  - "🔴 帳號與憑證（L185）：不登入任何 agent，不從 Windows 或其他地方複製憑證；claude 只用假 API key＋`ANTHROPIC_BASE_URL` 指向本機假 API（不連外、模型花費 0；HTTP(S)_PROXY 也指向不可達位址防外連）。**按鍵只在以輸出確認畫面是權限對話框之後才送**；畫面是登入 / onboarding / 信任資料夾以外的未知提示時不送任何按鍵，回報 PARTIAL 並附畫面文字。回報不寫權杖值、不寫家目錄真實路徑（D176，用 `<使用者資料夾>`）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本工單（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0818 — PLAN-061 交付版驗收（WSL Ubuntu，`v0.7.4-pre.5` AppImage）

## 元資料

- **工單編號**：T0818
- **類型**：verification
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-04T00:49:06+0800
- **預估規模**：M

## 背景

PLAN-061（T0811 `f274847c`，已在 `v0.7.4-pre.5`）：非 Windows 主機上 hooks 關閉（`blockedDetection: none`）的 claude 分頁，改用 claude 自己的 OSC 7501（`app=claude-code`）回報狀態。claude 要終端回覆探詢 `ESC ] 7501 ; ?` 才會送，BAT 主行程 `PtyManager.enqueuePtyOutput` → `replyToProgramStatusProbes` 回覆固定字串；之後規則同 codex（`blocked` → `blockedReason: input`，`source: 'osc'`；`working` / `idle` / `clear` 清除；使用者輸入不清除 `input`）。細節見 `CLAUDE.md`「blocked 狀態偵測」節的 claude 段、`docs/agent-guide/blocked-state.md`「claude（OSC 7501）」。

T0811 在 WSL 以 tsx 載入 repo 的 `pty-manager.ts` 驗過：假程式 19 項全過；真 claude 2.1.316（隔離 HOME、`disableAllHooks`、假 API）回覆後 `none` → `osc`、`agentStarted`。**真 claude 的權限對話框 `blocked`（與回答後清除）沒有實測**，交付版也沒驗。塔台決定以交付版 AppImage 在 WSL 補驗（D263）。

## 範圍

1. 取得 `v0.7.4-pre.5` Linux AppImage（`gh release download v0.7.4-pre.5 -R gowerlin/better-agent-terminal …`），比對 GitHub asset digest（SHA-256）。在 WSL Ubuntu 24.04 以一般使用者、隔離 userData 執行（WSLg；userns 受限時 BUG-202 會自動 `--no-sandbox`，記下即可）。
2. 本機假 API：可沿用 / 改寫 `e2e/t0789-claude-osc7501-probe.spec.ts` 的假 API 腳本（複製到暫存目錄，不改 repo 檔）。第一則請求回一個 `Bash` tool_use（無害指令，例 `echo t0818`），讓 claude 跳出權限對話框；之後的請求回一般文字結束回合。
3. 在隔離的 BAT 開一個 claude CLI 分頁（使用 AppImage 內嵌的 claude；隔離 HOME / `CLAUDE_CONFIG_DIR` 的 settings 設 `disableAllHooks: true`；假 API 的 env 經工作區或 Settings 的方式帶入，或以你判斷最少侵入的方式，寫明做法）。用隔離實例自己的 helper / 查詢 channel（`bat-terminal.mjs` 的 state 查詢或 BAT MCP shim，連隔離實例的 port 與權杖）讀狀態，依序記錄：
   - a. 啟動後：`blockedDetection` 由 `none` → `osc`、`agentStarted: true`（若查得到）。
   - b. 送一則 prompt（經 PTY 寫入或 UI 輸入；是 claude 的輸入框才送）→ 權限對話框出現 → `state: blocked`、`blockedReason`（預期 `input`）、`source: 'osc'`。附當時的輸出片段證明畫面是權限對話框。
   - c. 回答權限對話框（允許或拒絕擇一，寫明）→ `blocked` 清除，回合結束回到 `idle`。
4. 對照組（擇一，寫明）：同一實例另開一個 hooks 開啟的 claude 分頁，確認 `blockedDetection: hook` 且 7501 不改變它（PLAN-061 規則：hook 分頁忽略 7501）。

## 不做

- 不改產品程式、測試、文件；不修 BUG（驗收失敗就回報，塔台另開修正單）；不驗 Windows（win32 不回覆是設計）、不驗 macOS；不驗 AskUserQuestion（有餘力可加，標「額外」）；不跑真實模型。

## 驗收

- [ ] AppImage 版號與 SHA-256（附指令與輸出）
- [ ] 假 API 沒有外連（附設定方式）、claude 版號（內嵌）
- [ ] a. hooks 關閉的 claude 分頁 `none` → `osc`（附查詢輸出）
- [ ] b. 真 claude 權限對話框 → `blocked` / `blockedReason` / `source: 'osc'`（附查詢輸出＋畫面片段）
- [ ] c. 回答後清除、回到 `idle`（附查詢輸出）
- [ ] 對照組：hook 分頁 `blockedDetection: hook`（附查詢輸出）
- [ ] 環境還原：隔離 userData、隔離 HOME、AppImage、暫存腳本已刪；沒有殘留程序；WSL 使用者既有目錄未變（附前後雜湊或時間戳）
- [ ] 結論：PASS（塔台結 PLAN-061）/ FAIL（附重現步驟）/ PARTIAL（附缺少哪個證據）

---

## 回報區

### 完成狀態

- **狀態**：DONE（驗收結論 **PASS**：塔台可結 PLAN-061）
- **結論一句話**：`v0.7.4-pre.5` AppImage 在 WSL Ubuntu 24.04 上，hooks 關閉的 claude 分頁（內嵌 claude 2.1.316）由 `none` 轉成 `osc`；真 claude 的權限對話框讓查詢回 `blocked` / `blockedReason: input` / `source: osc`，按「Yes」之後清除並回到 `idle`。對照組（hooks 開啟）維持 `blockedDetection: hook`，BAT 照樣回覆探詢，但 7501 沒有改變它的判斷。
- **完成時間**：2026-11-04T01:07:33+0800
- **session_id**：3c9d93bf-2b58-4a4d-8f1f-bb83d1801470

### 落點檢查

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，PASS。
- C-1：工單在 REPO_ROOT 底下，PASS。
- C-3：`affects_files` 只有 `_ct-workorders/` 底下的本工單，not applicable。
- C-2：工單沒有 `branch` 欄位；目前分支 `main`。
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`CT_HOME` 未設（不在 worktree）。

### 環境與做法

- **WSL 環境**：Ubuntu 24.04.5 LTS、kernel 6.18.33.2-microsoft-standard-WSL2、uid 1000（一般使用者）、WSLg（`DISPLAY=:0`）、node 26.13.0。核心沒有 `apparmor_restrict_unprivileged_userns`。BAT 日誌是 `[sandbox] Chromium sandbox requested (no --no-sandbox) (appimage=yes)`，所以 **BUG-202 的自動 `--no-sandbox` 沒有觸發**。
- **隔離方式**：
  - 暫存根目錄是 `/tmp/t0818-XXXXXX`（下稱 `<ROOT>`）。AppImage 由 `playwright-core@1.59.1` 的 `_electron.launch` 啟動，參數 `chromiumSandbox: true`、`--runtime=t0818-<ts>`。
  - BAT 行程的 env：
    - `HOME=<ROOT>/home`；userData 因此是 `<ROOT>/home/.config/BetterAgentTerminal-runtime-t0818-<ts>`（驅動程式檢查 userData 在 `<ROOT>` 底下才繼續）。
    - `CLAUDE_CONFIG_DIR=<ROOT>/home/.claude`、`BAT_REMOTE_PORT=<空閒 port>`、`HISTFILE=/dev/null`。
    - 繼承的 `BAT_*` / `CT_*` / `ANTHROPIC_*` / `CLAUDE*` 全部丟掉。
  - 分頁的 env 從 BAT 行程繼承，所以假 API 設定直接放在 BAT 行程的 env，工作區與 Settings 都沒有改（這是侵入最少的做法）。
  - claude 設定：`<ROOT>/home/.claude/settings.json` 只放 `permissions.defaultMode: default`，主測試另加 `disableAllHooks: true`。`.claude.json` 預先寫好 onboarding 完成、假 key 已核可、`<ROOT>/w` 已信任（同 T0789 的做法），所以**沒有出現登入、onboarding 或信任畫面**。
- **假 API 與不外連**：
  - `e2e/fixtures/fake-anthropic-api.ts` 複製到 `<ROOT>`，由 node 直接 import（repo 檔案沒有改）。分頁 env 帶 `ANTHROPIC_BASE_URL=http://127.0.0.1:<port>`，以及假 key `sk-t0818-fake-key-not-checked-…`（不是真權杖）。
  - 情境：`t0818-text-*` 回一段文字。`t0818-perm-*` 第一則回 `Bash` tool_use `curl -s --max-time 3 http://127.0.0.1:9/t0818`，第二則回 `perm done`。
    - 用 curl 而不是 `echo`：沿用 T0789 已知會跳出權限對話框的指令，避免 `echo` 被 claude 當成唯讀指令自動放行。它連的是本機關閉的 port，無害。
  - `HTTPS_PROXY` / `HTTP_PROXY`（含小寫）指向會拒絕所有連線並記錄目標的 blocking proxy；`NO_PROXY=127.0.0.1,localhost`；`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`。
  - 結果：假 API 收到 6 則請求（`text-n#0`、`perm-n#0`、`perm-n#1`、`text-h#0`、`perm-h#0`、`perm-h#1`），模型花費 0。proxy 擋下的連線嘗試：`CONNECT redirector.gvt1.com:443`（Chromium）、`downloads.claude.ai:443`、`github.com:443`，各自都被 403 拒絕。**沒有任何請求送到 `api.anthropic.com`，也沒有任何請求離開本機。**
- **claude 版號（內嵌）**：分頁裡實際執行的指令是 `'/tmp/.mount_Better…/resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-linux-x64/claude' --mcp-config=… --settings=…/bat-mcp/claude-settings.json '--name=T0818 · b5c7e8' '…'`（從分頁輸出取得），也就是 AppImage 內嵌的 claude。claude 畫面顯示 `Claude Code v2.1.316`。
- **查詢方式**：
  - 隔離 BAT 的工作區種一個 shell 分頁 `t0818-tower`（tower 能力），在裡面背景執行輪詢程式。輪詢程式啟動 AppImage 內附的 `$BAT_HELPER_DIR/bat-mcp.mjs`（BAT MCP shim，用該分頁自己的範圍權杖連隔離實例的 port），每 250 ms 對每個 Worker 呼叫 `bat_get_state` 與 `bat_read_output`（60 行）；狀態或輸出有變化就記一列。
  - `bat_whoami` = `{"terminalId":"t0818-tower","workspaceId":"t0818-ws","role":"shell",…}`。
  - claude 分頁由同一個 shell 分頁以 helper 派工建立：`node "$BAT_HELPER_DIR/bat-terminal.mjs" --notify-id "$BAT_TERMINAL_ID" --cwd <ROOT>/w --agent claude --prompt '[[T0727:t0818-text-x]] say hello'` → exit 0、`agent: claude-cli`。這樣 claude 分頁屬於這個 tower，查得到狀態。
- **按鍵**：只用 renderer 的 `electronAPI.pty.write` 對 claude 分頁送了兩次。
  - 第二則 prompt：送之前以輸出確認畫面是輸入框（`? for shortcuts`）。
  - 回答權限對話框：送之前以輸出確認畫面是 `Do you want to proceed? ❯ 1. Yes …`。送 Enter，也就是選 **1. Yes（允許）**。
  - 沒有出現其他提示；沒有登入任何 agent；沒有複製任何憑證。

### 驗收結果

#### 1. AppImage 版號與 SHA-256：PASS

```
gh api repos/gowerlin/better-agent-terminal/releases/tags/v0.7.4-pre.5 -q '.assets[] | select(.name|test("AppImage")) | "\(.name) \(.size) \(.digest)"'
BetterAgentTerminal-0.7.4-pre.5.AppImage 353752052 sha256:c3d51f4586c6f7ed3bdf73f802c417dba5a0f64b68213101b1dccac44bba289a

gh release download v0.7.4-pre.5 -R gowerlin/better-agent-terminal -p 'BetterAgentTerminal-0.7.4-pre.5.AppImage'
sha256sum（Windows 下載檔）   c3d51f4586c6f7ed3bdf73f802c417dba5a0f64b68213101b1dccac44bba289a
sha256sum（複製到 WSL 後）    c3d51f4586c6f7ed3bdf73f802c417dba5a0f64b68213101b1dccac44bba289a
```

執行中的 app：`app.getVersion()` = `0.7.4-pre.5`，Electron 45.2.1。

#### 2. 假 API 沒有外連、claude 版號：PASS

見〈環境與做法〉。proxy 擋下的 5 次嘗試都被拒絕；claude 是內嵌的 2.1.316。

#### a. hooks 關閉的 claude 分頁 `none` → `osc`：PASS

- 派工時主行程的判斷（debug log）：`[bat-mcp] dispatch agent=claude-cli terminal=b5c7e82f… → injected: --mcp-config=… --settings=… '--name=T0818 · b5c7e8'; hooks=yes (turned off: disableAllHooks in <ROOT>/home/.claude/settings.json); name=yes`。分頁因此記成 `none`。
- 輪詢結果（第 2 輪，分頁 `b5c7e82f9f3fe1f69a6a8839a91f8a54`；欄位依序是 state | blockedReason | source | blockedDetection | agentStarted，空白代表沒有這個欄位或值為 null）：

  ```
  17:04:26.836Z  working |       | output | none | (null)
  17:04:32.168Z  idle    |       | output | none | (null)
  17:04:40.519Z  working |       | output | none | (null)
  17:04:47.607Z  working |       | output | osc  | true
  17:04:58.741Z  idle    |       | output | osc  | true
  ```

- 主行程日誌：

  ```
  17:04:46.342Z [program-status] terminal=b5c7e82f… probe → reply
  17:04:47.438Z [codex-state] terminal=b5c7e82f… → working
  17:04:47.438Z [agent-start] terminal=b5c7e82f… → started (osc working)
  17:04:49.103Z [codex-state] terminal=b5c7e82f… → idle
  ```

- 第一個回合結束後的 `bat_get_state`：`{"state":"idle","source":"output","blockedDetection":"osc","pendingQuestions":0,"agentStarted":true,"agentStartedAt":1793725487438,"claudeSessionName":"T0818 · b5c7e8","claudeSessionId":null}`。
  - `claudeSessionId: null` 是預期的：hooks 關閉時沒有 `SessionStart` 回報。

#### b. 真 claude 權限對話框 → `blocked` / `input` / `osc`：PASS

- 送出 `[[T0727:t0818-perm-n]] run the t0818 probe command` 之後，`bat_get_state` 回：

  ```json
  {"terminalId":"b5c7e82f9f3fe1f69a6a8839a91f8a54","state":"blocked","lastOutputAt":1793725504951,"idleMs":5,"blockedReason":"input","blockedSince":1793725504696,"source":"osc","blockedDetection":"osc","pendingQuestions":0,"agentStarted":true,"agentStartedAt":1793725487438,"claudeSessionName":"T0818 · b5c7e8","claudeSessionId":null}
  ```

- 同一時刻的 `bat_read_output` 片段（同一列查詢；工具每段文字各佔一行，這裡把它們接回原本的行）：

  ```
  ❯ [[T0727:t0818-perm-n]] run the t0818 probe command
  ● T0818 permission probe (closed local port)
    ⎿  $ curl -s --max-time 3 http://127.0.0.1:9/t0818
  ────────────────────────────────
  Bash command
  T0818 permission probe (closed local port)
  curl -s --max-time 3 http://127.0.0.1:9/t0818
  This command requires approval
  Do you want to proceed?
   ❯ 1. Yes
     2. Yes, and don’t ask again for: curl *
     3. Yes, and switch to auto mode · auto mode handles these prompts for you
     4. No
   Esc to cancel · Tab to amend
  ─────────────────────────── T0818 · b5c7e8 ─
  ```

- 主行程日誌：

  ```
  17:05:03.583Z [codex-state] terminal=b5c7e82f… → working
  17:05:04.696Z [codex-state] terminal=b5c7e82f… → blocked
  17:05:04.696Z [blocked] terminal=b5c7e82f… → blocked reason=input (osc)
  ```

- 畫面：截圖（WSL 暫存目錄，已隨收尾刪除）中，縮圖列的 Claude CLI 分頁與左側工作區列都出現 ⚠️，也就是 T0735 的等待使用者提示。

#### c. 回答後清除、回到 `idle`：PASS

- 17:05:06.936Z 送出 Enter（選 1. Yes，允許）。之後的狀態變化：

  ```
  17:05:07.237Z  working |  | output | osc | true
  17:05:12.813Z  idle    |  | output | osc | true
  ```

- 主行程日誌：

  ```
  17:05:07.207Z [codex-state] terminal=b5c7e82f… → working
  17:05:07.207Z [blocked] terminal=b5c7e82f… → cleared (osc working)
  17:05:07.567Z [codex-state] terminal=b5c7e82f… → idle
  ```

  清除的依據是 claude 自己送的 OSC `working`，不是使用者輸入（清除原因寫的是 `osc working`）。
- 回答後的 `bat_get_state`：`{"state":"idle","source":"output","blockedDetection":"osc","pendingQuestions":0,"agentStarted":true,…}`。輸出尾端是 `Ran 1 shell command` → `perm done` → `❯` / `? for shortcuts`。假 API 收到 `perm-n#1`，裡面帶 tool_result。

#### 對照組：hooks 開啟的 claude 分頁 `blockedDetection: hook`：PASS

- 做法：同一個隔離實例，第一個分頁結束後，把 `settings.json` 改成沒有 `disableAllHooks`，再以同樣方式派第二個 claude 分頁 `e6d0cf47af9e7242e80be71b5a30c99e`，跑同樣的兩個回合。
- 派工判斷：`… '--name=T0818 · e6d0cf'; hooks=yes; name=yes`（沒有 turned off）。
- 狀態變化（`blockedDetection` 從頭到尾都是 `hook`）：

  ```
  17:05:18.383Z  working |            | output | hook | false
  17:05:19.147Z  working |            | output | hook | true
  17:05:25.003Z  idle    |            | output | hook | true
  17:05:29.073Z  blocked | permission | hook   | hook | true
  17:05:30.854Z  working |            | output | hook | true
  17:05:36.297Z  idle    |            | output | hook | true
  ```

- 主行程日誌：

  ```
  17:05:19.096Z [agent-start] terminal=e6d0cf47… → started (hook session-start) session=fc502974
  17:05:19.167Z [program-status] terminal=e6d0cf47… probe → reply
  17:05:29.016Z [blocked] terminal=e6d0cf47… → blocked reason=permission (hook permission-request tool=Bash)
  17:05:30.774Z [blocked] terminal=e6d0cf47… → cleared (user input)
  ```

- 判讀：
  - BAT 對 hook 分頁也回覆了探詢（日誌有 `probe → reply`），這和 T0811 記錄的副作用一致。
  - 這個分頁沒有任何 `[codex-state]` 行，對話框的 reason 是 hook 的 `permission`、`source: hook`，`claudeSessionId` 有值。所以 7501 沒有改變 hook 分頁的判斷，符合 PLAN-061 的規則。
  - 限制：hook 分頁的原始 PTY 輸出沒有另外擷取，所以「claude 在這個分頁確實送了 7501 狀態」只能由「BAT 回覆了探詢」間接推得，沒有逐筆證據（T0789 / T0811 已實測 claude 收到回覆後會送狀態）。

#### 環境還原：PASS

- 已刪除：
  - WSL 的 `<ROOT>`：AppImage、`playwright-core`、驅動與輪詢腳本、假 API、隔離的 HOME / userData、截圖、紀錄。
  - 本單建立的 `/tmp/t0818-*.sh` 輔助腳本。
  - Windows scratchpad 的 AppImage 與腳本。
  - 第 1 輪的 `<ROOT>` 在兩輪之間就不見了：WSL VM 重開時清空了 `/tmp`（見〈遭遇問題〉2）。
- 程序：AppImage 版 BAT 的 `app.close()` 在 20 s 內沒有返回，和 T0803 遇到的情況相同：Terminal Server 與 AppImage runtime 留著。
  - 收尾時以 SIGKILL 結束 Terminal Server（`BetterAgentTerminal.bin …/terminal-server.js`）與 AppImage runtime，兩輪都要這樣做。
  - 留下的 FUSE 掛載以 `fusermount -uz` 卸載；空的掛載點目錄 `/tmp/.mount_BetterCjfuzj` 以 `rmdir` 刪除。
  - 收尾後：沒有任何 BAT、claude 或 terminal-server 程序；`/proc/mounts` 沒有 `.mount_Better`；沒有 `/tmp/t0818-*`；沒有任何程序帶本單的 `BAT_TERMINAL_ID`。
- WSL 使用者既有目錄的前後快照（`find . -printf '%P|%s|%T@|%y\n' | sort | sha256sum` 取前 16 碼＋項目數，只看名稱、大小與時間，不讀內容）：

  | 項目 | 開始前（00:58） | 結束後（01:07） |
  |---|---|---|
  | `~/.config/BetterAgentTerminal` | `8e5e8b4e57f7e127`，3 項 | `8e5e8b4e57f7e127`，3 項 |
  | `~/.claude` | `07e55568f7aef3b6`，9 項 | `07e55568f7aef3b6`，9 項 |
  | `~/.codex` | `f0d00c2db7fb2d0a`，8105 項 | `f0d00c2db7fb2d0a`，8105 項 |
  | `~/bat-build` | `5bc47cbf8d0639f8`，53196 項 | `5bc47cbf8d0639f8`，53196 項 |
  | `~/.local/bin` | `b2d33f4a12d1cefd`，5 項 | `b2d33f4a12d1cefd`，5 項 |
  | `~/.claude.json` | 558 bytes，mtime 1791143425 | 相同 |
  | `~/.bash_history` | 55027 bytes，mtime 1793714975 | 相同 |
  | `~/.config/BetterAgentTerminal-runtime-*` | 0 | 0 |

- Windows 端的 BAT 安裝版與它的 Terminal Server 都沒有碰。WSL 的 npm 快取（`~/.npm`）有 `playwright-core` 的下載，沒有清（不在工單列的目錄內）。

#### 結論：**PASS**（塔台可結 PLAN-061）

`v0.7.4-pre.5` 交付版在 Linux（WSL Ubuntu 24.04）上：

- hooks 關閉的 claude 分頁先記成 `none`；BAT 回覆探詢後，claude 送出的 OSC 7501 讓它變成 `osc` / `agentStarted: true`。
- 真 claude 的權限對話框 → `blocked` / `blockedReason: input` / `source: osc`。
- 允許後，claude 送 `working` 清除 `blocked`，回合結束回到 `idle`。
- hook 分頁維持 `hook`，7501 不影響它。

### 遭遇問題

1. **第 1 輪沒有回答對話框（驅動程式的判斷問題，不是產品問題）**：`bat_read_output` 把畫面上的文字切成一個字一行，我的比對式 `/Do you want to proceed/` 對不上。驅動程式依規則「畫面沒確認就不送按鍵」，所以沒有回答對話框；工具也只在狀態改變時才讀輸出，抓不到對話框畫好之後的畫面。第 1 輪仍然取得 a、b 的狀態（`none` → `osc`、`blocked` / `input` / `osc`、對照組 `hook` / `permission`），但沒有 c。改成比對時把空白合併、輸出有變化也記錄之後，第 2 輪全部完成；本報告的數據都來自第 2 輪。第 1 輪的 claude 程序以 `pty.kill` 結束，沒有回答對話框。
2. **兩輪之間 WSL VM 重開過**：第 1 輪結束後，`/tmp/t0818-LmXRJJ`（第 1 輪的 `<ROOT>`）與當時殘留的程序都不見了，第 2 輪的 pid 也從小數字開始。看起來是 WSL 閒置關機後重開時清空了 `/tmp`。第 1 輪收尾時曾手動 SIGKILL Terminal Server 與 AppImage runtime。結果上沒有殘留，但第 1 輪的 userData 沒能留到最後再比對。
3. **AppImage 版 `app.close()` 不返回**：兩輪都是 20 s 逾時，Terminal Server 留著，需要 SIGKILL。SIGKILL 之後 FUSE 掛載也留著，要 `fusermount -uz`。T0803 的〈遭遇問題〉4 也記過這件事；本單沒有查證是不是產品行為。
4. **流程**：§ Tower Addenda Check 的〈驗證前〉節點漏做（第 1 輪開始前沒有檢查）；〈填回報前〉檢查過，工單沒有 `## 塔台補充（` 段落，結果不受影響。
5. **公開 repo 去識別化**：分頁輸出含 WSL 帳號、主機名稱與家目錄，報告一律寫成 `<使用者資料夾>` 或略去（D176）；權杖值沒有寫入任何地方。

### 互動紀錄

- [00:50] 開工：yolo（`CT_MODE=yolo`、`CT_INTERACTIVE=0`），沒有需要問塔台的問題，沒有發 `提問`。落點檢查 PASS。
- [00:58] WSL 前置快照；下載 AppImage，SHA-256 比對一致。
- [00:58–01:02] 第 1 輪：a、b 的狀態與對照組都取得；對話框畫面的比對失敗，沒有送回答（〈遭遇問題〉1）。
- [01:03–01:06] 第 2 輪：a、b、c 與對照組全部完成。
- [01:06–01:07] 結束程序、卸載 FUSE、刪除暫存、事後快照（使用者目錄未變）。
- 方法論：本單沒有 frontmatter `methodology`、沒有 `### 方法論邊界`；本 session 沒有看到方法論注入，也沒有呼叫任何方法論 skill。

### Commit

- 本單沒有產品變更，只 commit 本工單（`git commit --only`）。不 push、不發版。

### 後續（交塔台）

1. ℹ️ PLAN-061 可依本報告結案。
2. ℹ️ AppImage 版 `app.close()` 不返回、SIGKILL 後 FUSE 掛載殘留（〈遭遇問題〉3，T0803 已記一次）：可考慮另開查證單，或併入既有的 Linux 驗收工作。
3. ℹ️ 若要逐筆證明 hook 分頁的 7501 被忽略，可以在 hook 分頁額外擷取原始 PTY 輸出（本單以「BAT 回覆探詢＋判斷不變」間接證明）。
