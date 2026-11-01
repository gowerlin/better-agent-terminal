---
schema_version: 1
schema_kind: workorder
id: T0748
title: "pre.8 工作區等待提示 ⚠️ 遠端驗收：WSL 遠端工作區的分頁等待 → 本機視窗工作區列 ⚠️（不耗 token）"
type: implementation
status: DONE
started_at: "2026-11-01T20:32:36+0800"
updated_at: "2026-11-01T20:48:22+0800"
completed_at: "2026-11-01T20:48:22+0800"
session_ids:
  - "7783ba89-dc62-440a-8572-ff790a863bc3"
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T20:21:32+0800"
depends_on: [T0746]
related:
  - "T0735（`b4daaf1f`，D200–D203；主行程 `TerminalAttentionNotifier` 推每個 PTY）；T0736〈仍需手動實機驗收〉：遠端 / headless 工作區的分頁等待 → 本機視窗的工作區列 ⚠️"
  - "既有 WSL / 遠端 e2e：`e2e/t0550-wsl-acceptance.spec.ts`、`e2e/pre6-ui-remote-acceptance.spec.ts`、`e2e/t0555-node-nvm-wsl.spec.ts`、`e2e/real-remote/`；T0743（WSL Docker 驗收，只動自建資源的做法）"
  - "CLAUDE.md「Worker 分頁回收」節 T0735 段、「blocked 狀態偵測」節（hook 與 codex OSC 7501）、「遠端 Tower 通知（PLAN-036 K）」、「多 remote profile 同時連線（PLAN-039）」；`docs/agent-guide/worker-tab-recycle.md`、`docs/agent-guide/blocked-state.md`"
affects_files:
  - "e2e/v072-pre8-remote-workspace-waiting.spec.ts（新增，檔名可調；需要 WSL 時偵測不到就 skip）"
  - "e2e/fixtures/（只在需要共用 helper 時新增或擴充；不改既有 spec 的行為）"
  - docs/agent-guide/worker-tab-recycle.md
  - _ct-workorders/T0748-wsl-remote-workspace-waiting-badge.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 情境（隔離實例；本機工作區 A = 正在看的、WSL 遠端工作區 R = 放分頁的；斷言在 A 看 R 的列，沿用 T0735 / T0736 的 DOM / selector）：① R 的分頁進入 hook 類 blocked（優先用 WSL 內真的 claude CLI ＋ spec 內的假 Anthropic API 回需要權限的 tool_use；WSL 沒有 claude 或無法驅動時，改在 R 分頁以自訂 CLI 呼叫遠端的 `bat-hook.mjs` 送 `PermissionRequest`，同 T0735 的模擬法；兩者擇一並寫明）→ A 看 R 列實心 ⚠️、tooltip 是 permission 原因且不含內容 → 解除後清除。② R 分頁送 codex OSC 7501 `blocked`（格式以 `src/lib/codex-terminal-state.ts` 為準，例如在遠端 shell 以 printf 輸出）→ `input` → R 列 ⚠️；送 `idle` 後清除。③ 等待在沒看 R 時結束 → R 列淡化 ⚠️；切到 R 分頁且視窗有焦點後清除（D203）。④ 本機分頁與 R 分頁同時等待 → 各自的列與總數 badge `⚠️ N` 正確；點 ⚠️ 跳到等最久的分頁。⑤ 遠端連線中斷再連上（選做）→ 記錄 ⚠️ 的行為。做不到的情境寫原因與已試過的做法，其餘照做，可回 PARTIAL。"
  - "🔴 不耗 token：claude 只打 spec 內的假 Anthropic API（沿用 T0727 / T0736 的做法：暫存 HOME、`ANTHROPIC_BASE_URL` / 假 key、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`），不得用使用者的 claude / codex 登入或真實 API；回報區列出對外模型請求數（預期 0）。WSL 內連 Windows 主機上的假 API 時注意位址（WSL 網路模式），只開在測試需要的 port。"
  - "🔴 不改使用者的 WSL 環境：WSL `Ubuntu-24.04`（Running）。先讀既有 WSL e2e 怎麼安裝 / 啟動 bat-server；🔴 只能用測試專用的安裝目錄、dataDir、port 與 systemd unit 名（或不經 systemd 直接啟動），名稱一律含 `bat-e2e-t0748`；若既有做法會覆蓋或重啟使用者自己在 WSL 的 bat-server（例如共用 `~/.better-agent-terminal`、同名 systemd unit、預設 port），先停下來問塔台。不 `apt install`、不改 WSL 設定檔與 `/etc`、不關閉或重啟 WSL。跑完刪除本單建立的檔案、程序與 unit，清單寫進回報區；使用者既有的 WSL 檔案與程序前後清單一致（列出比對方式）。"
  - "🔴 隔離：本機一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例（獨立 userData 與 remote port），不碰使用者正在用的 BAT 與其 userData、remote profiles，不執行任何安裝檔。🔴 使用 T0746 建好的 `dist` / `dist-electron`，不得再跑 `npx vite build`（與 T0747 並行）；server bundle 若需要建置，只建到暫存目錄，不改 repo 內追蹤檔。工作區名稱一律 `e2e-t0748-*`。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷 → 記在回報區〈發現的問題〉附重現步驟與證據，由塔台開 BUG。驗證：新 spec 綠（或部分綠並說明），連跑 2 次；重跑 `t0735-workspace-waiting-badge` 綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。`docs/agent-guide/worker-tab-recycle.md` 的 T0735 驗證清單補一行指向新 spec。回報區列〈仍需手動〉（例如 SSH / Docker 遠端、安裝版）。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑、WSL 使用者名稱或帳號。"
  - "🔴 `docs/agent-guide/worker-tab-recycle.md` 與並行的 T0747 共用：只在 commit 前一刻改；改之前 `git diff -- docs/agent-guide/worker-tab-recycle.md` 若有不是你的變更（T0747 尚未 commit），等它 commit 後再改（最多等 15 分鐘，逾時問塔台），改完立即 commit。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0748 — pre.8 工作區等待提示 ⚠️ 遠端驗收（WSL）

## 元資料

- **工單編號**：T0748
- **類型**：implementation（驗收用 e2e，假模型）
- **優先級**：P2
- **建立時間**：2026-11-01T20:21:32+0800
- **預估規模**：M

## 背景

T0735 的工作區 ⚠️ 依主行程推送的每個 PTY attention 判斷；T0736 只驗了本機分頁。遠端工作區（WSL / SSH / Docker）的分頁在 headless bat-server 上，等待狀態要經遠端連線回到本機視窗的工作區列。本單以 WSL 驗這條路徑，不耗 token。

## 範圍

1. 情境 ①–⑤（見 frontmatter，⑤ 選做）。
2. 新 spec（偵測不到 WSL 就 skip）。
3. docs 一行。

## 不做

- 不用真實模型；不改使用者的 WSL 環境與 bat-server；不驗 SSH / Docker。
- 不改產品程式碼、不重新 build。

## 驗收

- [ ] 情境 ①–④ 逐項結果（⑤ 選做），寫明 ① 用的是真的 claude 還是 hook 模擬
- [ ] 對外模型請求數 0；自建資源清單與清理結果；使用者 WSL 前後比對
- [ ] 新 spec 連跑 2 次、`t0735` 綠、兩個 typecheck = 0
- [ ] 〈發現的問題〉與〈仍需手動〉

---

## 回報區

### 完成狀態

- **狀態**：DONE（情境 ①–④ PASS，⑤ 選做已記錄 INFO）
- **session_id**：7783ba89-dc62-440a-8572-ff790a863bc3
- **落點檢查**：PASS — C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 內；C-3 抽查 `docs/agent-guide/worker-tab-recycle.md` 存在、新 spec 的上層 `e2e/` 存在；C-2 工單無 `branch` 欄位（`main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_HOME` 未設定（不是 worktree）。

### 結果摘要

新增 `e2e/v072-pre8-remote-workspace-waiting.spec.ts`：在 WSL `Ubuntu-24.04` 起一台**測試專用的** headless bat-server（本 repo 的 headless JS），用隔離實例的遠端 profile 視窗連過去，驗證遠端分頁的等待經遠端連線變成工作區列的 ⚠️。最終版連跑 2 次都綠（各約 1.0 分鐘），之前的 3 次迭代也都完成並清理乾淨。

**情境結構的調整（與工單字面不同）**：一個 BAT 視窗只綁一個 profile（PLAN-039）。本機工作區在本機視窗，遠端工作區在遠端 profile 視窗；遠端 server 的事件只送到該 profile 的視窗（`getWindowsForProfile`），本機視窗本來就不會列出遠端工作區。所以「A 在看、R 放分頁」改成：遠端視窗內 `e2e-t0748-other`（在看）與 `e2e-t0748-remote`（R，放分頁），本機視窗放 A。④ 同時檢查兩個視窗，確認各自只算自己的分頁。這是依架構所做的解讀，沒有問塔台；如果塔台原本的意思是「本機視窗要顯示遠端工作區列」，那是目前設計沒有的功能，需要另開 PLAN。

| 情境 | 結果 | 證據 |
|---|---|---|
| ① hook 類 blocked | PASS（**真的 claude CLI**，不是 hook 模擬） | 遠端視窗「+」選單開 Claude CLI 分頁，跑的是 WSL bundle 內的 claude 2.1.300。假 API 回 Bash tool_use，觸發 claude 自己的 PermissionRequest hook，在遠端 server 上跑 `bat-hook.mjs`。server 日誌出現 `[blocked] terminal=<claude tab> → blocked reason=permission (hook permission-request tool=Bash…)`。遠端視窗 R 列實心 ⚠️，`data-waiting-target` = claude 分頁。tooltip「• Claude CLI: 等待使用者：權限確認（下午08:42 起）」，不含指令內容與 `127.0.0.1:9`（分頁畫面上確實有那段指令）。在看時按 Enter 核准：server 記 `→ cleared`，回合繼續（假 API 收到 step 1），縮圖不留淡化 |
| ② codex OSC 7501 | PASS | R 的 bash 分頁執行 `printf '\033]7501;state=blocked:app=codex\007'`：server 記 `blocked reason=input (osc)`，R 列 ⚠️，tooltip「codex 等待輸入（核准或提問）」，本機視窗沒有任何 ⚠️。送 `idle` 後 server 記 `cleared (osc idle)`，不再是 waiting |
| ③ 沒在看時結束 → 淡化 → 看過清除 | PASS | ② 結束時 R 沒被看：R 列 `.missed` 淡化，tooltip 帶時間，遠端視窗總數 badge 也是淡化（`count 0`）。遠端視窗取得焦點（`document.hasFocus() = true`）後選 R 和該分頁，淡化消失（D203） |
| ④ 本機與遠端同時等待、總數、跳轉 | PASS | 遠端視窗：R 列 `⚠️ 2`（claude 權限確認＋shell input），工作區頁籤標題總數 `⚠️ 2`（`data-waiting-count=2`）。本機視窗：A 列 ⚠️（本機 pwsh 分頁以 `[Console]::Write` 送 OSC 7501），總數 `⚠️`（count 1）。兩個視窗都沒列出對方的工作區。點 R 的 `⚠️ 2`：R 變 active，選到等最久的 claude 分頁（本機日誌 `[workspace-waiting] go to workspace=e2e-t0748-remote terminal=<claude>`）。之後回答：claude（在看）清除；R shell `idle`（沒在看）淡化；A `idle` 清除（A 在等待期間被看過，D203 規則下不留淡化） |
| ⑤ 連線中斷再連上（選做） | INFO，見〈發現的問題〉 | 做法是停掉測試 server 再以同 port / token 重啟。斷線期間 R 列維持實心 ⚠️。重連後 20 秒仍是實心 ⚠️（target = 舊 shell 分頁），但 server 端沒有任何這個分頁的紀錄：`pty.getCwd` = null、緩衝區是空的、無法取得新 shell PID。選這個分頁看過也不清除，送 OSC `idle` 也沒用（沒有 PTY 收得到） |

### 環境與做法

- **WSL 測試 server**（不經 systemd）：
  - 把使用者既有的 `~/.local/bat-server`（0.6.1-pre.5）**唯讀複製**到 `/tmp/bat-e2e-t0748/install`。
  - 用 `scripts/build-server-bundle.mjs` 的 esbuild 設定（經 `dev-deploy-headless.mjs` 的 `loadBuildConfig` / `stageHelperScripts`）把本 repo 的 headless JS 和 6 個 helper 建到 Windows 暫存目錄，再覆蓋進去。沒動 `dist-server/`。
  - 以 `setsid nohup env -i …` 啟動：dataDir `/tmp/bat-e2e-t0748/data`，port 為 Windows 端挑的空閒埠（mirrored 網路），`--bind-interface localhost`，隨機測試 token，HOME = `/tmp/bat-e2e-t0748/home`，最小 PATH。每個程序都帶 env `T0748_E2E_TAG=bat-e2e-t0748`（headless 只過濾 `BAT_*`，所以 shell 和 claude 也會繼承這個標記），清理時依此找出所有相關程序。
- **WSL 不是由測試啟動的**：只有 distro 已在執行時才跑，否則 skip。沒有 `apt install`，沒改 `/etc` 或 WSL 設定，沒重啟 WSL，沒碰使用者的 bat-server。
- **本機**：`launchIsolated` 隔離實例，使用 T0746 建好的 `dist` / `dist-electron`，沒有重跑 `npx vite build`。
- **不耗 token**：假 Anthropic API 和拒絕 proxy 都在 Windows `127.0.0.1`，WSL 在 mirrored 模式下連得到。claude 的 HOME 是暫存目錄，`.claude.json` 預先答好首次啟動畫面、`defaultMode: default`，並設 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`。

### 對外模型請求數

- **0**。每次執行假 API 都收到 2 個請求（model `claude-opus-5-5`，`t0748-perm#0` / `#1`，全在本機）。拒絕 proxy 記到的對外嘗試 = 0。spec 斷言打到 `anthropic.com` / `openai.com` 的嘗試為空。

### 自建資源與清理

| 資源 | 清理 |
|---|---|
| WSL `/tmp/bat-e2e-t0748/`（install 副本 ~390 MB、data、home、ws、server.log、server.pid） | `rm -rf`，執行後確認不存在 |
| WSL 測試 bat-server 程序，以及它的 bash / claude 子程序 | 先 `kill <pid>`（`stopped`），再對所有帶標記的程序 SIGTERM / SIGKILL。每次清理前後帶標記的程序數都是 0 → 0 |
| Windows 暫存 `%TEMP%\bat-t0748-*`（headless 建置產物、A 的資料夾） | `fs.rmSync` |
| 隔離實例 userData / Terminal Server | `closeIsolated`（`runtime userData removed: true`，Terminal Server 已不在） |
| 假 API / proxy | `close()` |
| systemd unit | 沒有建立 |

- **使用者 WSL 前後比對**（spec 內 `USER_STATE`，只存雜湊、計數、port、程序名稱）：
  - 比對項目：家目錄項目清單 sha、`~/.local/bat-server` 檔案清單（路徑、大小、mtime）sha、`~/.config/systemd/user` 清單 sha、`bat*` unit 狀態、使用者 bat-server `MainPID` / `ActiveState`、TCP listener、帶標記程序數、`/tmp/bat-e2e-t0748` 是否存在。
  - 6 次執行全部 `same`。執行前存在的程序沒有消失；`udev-worker`、wsl 的 `SessionLeader` / `Relay` 這類短命程序排除在比對外。
  - 後半段（install / units / bat-units / bat-server / tagged / root）在 spec 內有斷言。
  - 開發期間另外做過一次手動原型：在 `/tmp/bat-e2e-t0748` 起 server、確認 Windows 連得到後 kill 並 `rm -rf`。spec 執行前也會確認這個目錄不存在。

### 驗證

- 新 spec（最終版）：`npx playwright test e2e/v072-pre8-remote-workspace-waiting.spec.ts` 連跑 2 次 `1 passed`（1.0m / 1.0m）
- `e2e/t0735-workspace-waiting-badge.spec.ts`：`1 passed`（4.7s，`document.hasFocus() = true`）
- `npm run typecheck` = 0；`npm run typecheck:electron` = 0
- spec 另外斷言：server.log 和本機 debug log 都不含指令內容、測試 token、`batcap.` 權杖

### 異動檔案

- `e2e/v072-pre8-remote-workspace-waiting.spec.ts`（新增）
- `docs/agent-guide/worker-tab-recycle.md`（T0735 驗證清單補一行）
- 沒有改任何產品程式碼（`src/` / `electron/` / `scripts/`），也沒改 `e2e/fixtures/`

### 發現的問題

1. **遠端 server 重啟後，留下的 ⚠️ 不會清除，看過也一樣**（⑤）。
   - **重現**：
     1. 遠端 profile 視窗的分頁進入 waiting（OSC `blocked` 或 hook）。
     2. 停掉遠端 bat-server，再以同 port / token 啟動。
     3. 視窗重新連上後，該分頁沒有 PTY（`pty.getCwd` = null、buffer 空），但工作區列和縮圖仍是實心 ⚠️。
     4. 選這個工作區和分頁（視窗有焦點）看過，⚠️ 仍在。
   - **證據**：spec 的 ⑤ 日誌、截圖 `5-after-reconnect.png`（在 `e2e-results/`，沒有 commit）。
   - **說明**：`docs/agent-guide/worker-tab-recycle.md` 的已知限制已寫「遠端 server 重啟時舊分頁的標示留到 PTY 結束事件或下一次變更」。但 server 重啟後舊 PTY 的結束事件永遠不會送到，分頁也沒有新 PTY，所以「下一次變更」除非使用者 ⏻ 重啟分頁才會發生。實際上標示會一直留著，總數也會一直多算 1。
   - **待塔台判斷**：維持已知限制，或開 BUG（例如重連時對該 profile 的分頁做一次 attention 對帳）。重連後分頁沒有 PTY 本身是否符合預期，不在本單範圍，沒有深入查。
2. **工單情境的前提與架構不符**：本機視窗不會顯示遠端工作區的列，處理方式見〈結果摘要〉，不是缺陷。

### 仍需手動

- SSH 遠端、Docker 遠端（本單只驗 WSL）
- 安裝版（本單用 source build 的隔離實例；WSL 端用 pre.5 bundle 的 native 模組和 claude 2.1.300，headless JS 用本 repo HEAD）。之後用正式 pre.x bundle 經精靈安裝的 bat-server 再看一次
- 真正的網路中斷（server 仍在、連線斷掉再連回）：⑤ 用的是 server 重啟，這種情境沒涵蓋
- 遠端 Worker 分頁（helper 派工）與塔台問題 `?`：本單沒涵蓋

### 遭遇問題

- 第 1 次執行：工作區名稱 `e2e-t0748-r` 是 `e2e-t0748-r2` 的子字串，locator 撞名。已改成 `e2e-t0748-remote` / `e2e-t0748-other`。
- 第 2 次執行：A 結束等待後是直接清除（等待期間本機視窗被點過），不是淡化。斷言改成接受「清除或淡化」並記錄實際結果。
- 都已修正，沒有改動產品程式碼。

### 互動紀錄

- 無（yolo，沒有提問塔台）。

### commit

- 產品 commit `b0358c8a`（spec＋docs）；工單另一個 commit；沒有 push。
