---
schema_version: 1
schema_kind: workorder
id: T0394
title: "BUG-101 修復：Terminal Server 模式 restart 後舊 PTY 的遲到 exit 不得刪除 / 廣播同 id 的新 PTY"
type: implementation
status: DONE
priority: P1
sizing: S
created_at: "2026-10-05T00:50:08+08:00"
updated_at: "2026-10-05T00:59:19+08:00"
started_at: "2026-10-05T00:51:01+08:00"
completed_at: "2026-10-05T00:59:19+08:00"
target_version: next
depends_on: []
related:
  - "BUG-101（修復對象）"
  - "T0390（direct 模式同類修正 `handleDirectExit`，`f2b68ce`；回報區「偏差 / 風險 / 後續」第 1 點含重現方式）"
affects_files:
  - electron/terminal-server/server.ts
  - electron/pty-manager.ts
  - electron/terminal-server/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。比對 baseline 用 `git show HEAD:<path>` 或 `git worktree add`（junction 共用 `node_modules` 時，移除前先只拆 junction）。"
  - "🔴 T0393 平行執行中（改 `electron/main.ts` / `SettingsPanel.tsx` / `App.tsx` 等）；本單不改 `electron/main.ts`。若修復必須改 `main.ts`，停下回報 PARTIAL。"
  - "🔴 smoke 用獨立 `--runtime=<scratch>`、剝除 `BAT_*` env；結束後只 kill 本次 smoke 產生的 Terminal Server（比對 `dist-electron\\terminal-server.js` 路徑與 PID），**不得**動使用者安裝版 BAT 或其 Terminal Server。"
  - "⚠️ No Regressions：本機一般終端的 create / write / resize / kill / 跨 BAT 重啟的 Terminal Server 接回（T0111 / T0113 registry）行為不得改變。不 push。"
---

# T0394 — Terminal Server restart 遲到 exit

## 背景（BUG-101）

本機終端預設走 Terminal Server。`restart()` = kill + 同 id create，但：

- `electron/terminal-server/server.ts` 舊 PTY 的 `ptyProcess.onExit` 無條件 `this.ptys.delete(req.id)`、`removePtyEntry(req.id, …)`、廣播 `pty:exit` ⇒ 把 server 上**新** PTY 的 entry 刪掉，registry 也被清
- main 端 `PtyManager.handlePtyExit`（`electron/pty-manager.ts:336`）收到該 exit 也刪掉新 instance ⇒ 之後 write 回 `pty-not-found`，renderer 印 `[Process exited]`

T0390 已在 direct 模式以 `handleDirectExit(id, proc, code)`（entry 已屬於較新行程 → 不刪、不廣播）修正同類問題，本單比照處理 Terminal Server 模式。

## 範圍

1. `terminal-server/server.ts`：onExit 時只有 `this.ptys.get(req.id)` 仍是**同一個** ptyProcess 才 delete / `removePtyEntry` / 廣播 `pty:exit`；否則 log「stale exit ignored」
2. `pty-manager.ts` `handlePtyExit`：Terminal Server 模式下若 exit 對應的已是被取代的舊行程（例如以 server 回報的 pid / generation 判斷，或 restart 期間的標記），不刪新 instance、不轉發 `pty:exit` 給 renderer。判斷依據由 Worker 選定並寫理由（server 端修正後 main 端理論上不會再收到舊 exit，main 端防護屬縱深防禦；若 Worker 判定不需要，回報區說明）
3. 測試：server 端 restart 情境（舊 exit 晚到）不刪新 entry、不廣播；main 端同等情境

## 驗收

- unit：上述情境 + 正常 kill 仍會 delete / 廣播 `pty:exit`；負向驗證（拿掉防護後測試紅）
- `npm run test:unit` 全綠（基線 **1051**；T0393 若先 commit 以 HEAD 為準）；`npx vite build` exit 0；`npx tsc --noEmit` ≤ **40**
- **本機 smoke**（沿用 T0390 的 Playwright `_electron` 做法）：Terminal Server 模式本機終端 `restart` 後 `getCwd` 有值、輸入有輸出、無 `pty:exit`；`kill` 仍收到 `pty:exit`
- **runtime 驗收（交使用者，下一版 build）**：本機終端按「重新啟動」後出現新 prompt、可輸入。⚠️ Terminal Server 跨 BAT 重啟存活，驗收前需讓舊 server 行程結束（回報區寫出做法）

## Sub-session 執行指示

1. 讀取本工單 + BUG-101 + T0390 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**；BUG 狀態由塔台更新
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

- **開始**：2026-10-05T00:51:01+08:00（Worker，`CT_MODE=on`、`CT_INTERACTIVE=0`）
- **落點檢查**：WARN —— C-0 無法判定（frontmatter **無 `repo` 欄位**；`basename(REPO_ROOT)` = `better-agent-terminal`）；C-1 PASS（工單在 REPO_ROOT 下）；C-3 PASS（`server.ts` / `pty-manager.ts` / `electron/__tests__/` 存在；`electron/terminal-server/__tests__/` 不存在但祖先存在）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- **基線**：T0393 已先 commit（HEAD `c58fc80`），依工單以 HEAD 為準
- **結果**：DONE。範圍 1-3 全部落地；unit / 負向 / build / tsc / 本機 smoke 皆 PASS。runtime 驗收（下一版 build）交使用者，步驟見下方

### 實作內容

1. **`electron/terminal-server/server.ts`（範圍 1）**：`ptyProcess.onExit` 改走新的 `handlePtyExit(id, proc, exitCode)`，比照 T0390 `handleDirectExit`：
   - `this.ptys.get(id)` 存在且 `entry.pty !== proc`（id 已屬於 restart 建立的新 PTY）→ **不 delete、不 `removePtyEntry`、不廣播 `pty:exit`**，stderr 寫 `[terminal-server] stale exit ignored id=<id> (replaced by a newer PTY)`（server 行程沒有 logger，沿用 `terminal-server.ts` 的 `process.stderr.write` 慣例）
   - 其餘情況與原本相同：entry 仍是自己（shell 自行結束）→ delete + 清 registry + 廣播；entry 已不存在（一般 `pty:kill` 先刪了 entry）→ 照舊廣播 `pty:exit`（renderer 需要它）
   - ⚠️ 工單範圍 1 原文「只有 `this.ptys.get(req.id)` 仍是同一個 ptyProcess 才 delete / 廣播；否則 log」若照字面實作，會讓**一般 kill**（entry 已被 `killPty` 刪掉）也收不到 `pty:exit`，違反同一工單驗收的「正常 kill 仍會 delete / 廣播」。因此判斷條件取 `handleDirectExit` 的形式：只有「entry 存在且屬於別的 PTY」才視為 stale
2. **`electron/pty-manager.ts`（範圍 2，縱深防禦，判定**需要**）**：`PtyInstance.awaitingCreated`
   - Terminal Server 模式 `create()` 送出 `pty:create` 時設 `awaitingCreated: true`；收到 `pty:created`（新的 `handlePtyCreated`，原本只 log）時清掉
   - `handlePtyExit`：該 id 的 instance 仍 `awaitingCreated` → log `stale exit ignored id=<id> (server has not confirmed the new PTY yet)`，不刪 instance、不轉發 `pty:exit`
   - **為何需要（server 修正後仍有的缺口）**：server 端判斷依賴「新 PTY 已佔用 id」。若舊 PTY 的 exit 在 server 處理 `pty:kill` 與 `pty:create` **之間**觸發（兩則訊息分屬不同 event loop tick 時可能發生），此時 entry 不存在 ⇒ server 正確地當成一般 kill 廣播 `pty:exit`；但 main 端的 `restart()` 早已同步註冊新 instance，這則 exit 會刪掉新 instance 並讓 renderer 印 `[Process exited]`
   - **為何用「等待 `pty:created`」而不用 pid / generation**：server 在 `createPty` 內同步回 `pty:created`，而 node-pty 的 `onExit` 一定在之後的 tick，且回覆與廣播走同一條有序通道（fork IPC 或同一條 TCP socket）⇒ 新 PTY 的 exit 必定排在它的 `pty:created` 之後；所以「`pty:created` 之前收到的 exit」必然屬於被取代的舊行程。這個判斷**不需改 `protocol.ts`**（`pty:exit` 不帶 pid），舊版 Terminal Server 也適用
   - 不影響：reconnect replay（`handleReplayList` 註冊的 instance 無此旗標，exit 照常）、idempotent create（main 端 `instances.has(id)` 直接 SKIP，不送 create）、direct 模式（不經 `handlePtyExit`）
3. **測試（範圍 3）**：
   - `electron/__tests__/terminal-server-stale-exit.test.ts`（5 tests）：`handlePtyExit` 決策單元 3 個（被取代 → 不刪不廣播 + log；entry 已刪 → 廣播；自己 → 刪 + 廣播）＋ **真 node-pty** 經 `handleMessage` 2 個（`create → marker → kill + create 連發 → 等到舊 PTY 的 exit 真的進 handler → 新 entry pid 不變、0 個 `pty:exit`、無 `pty:write` not-found、新 shell 可輸入 → kill 後收到 1 個 `pty:exit``；shell 自行 `exit` → 刪 + 廣播）。client 傳輸以 spy 取代（vitest forks pool 下 `process.send` 存在，會打到 vitest 父行程）
   - `electron/__tests__/pty-manager-server-exit.test.ts`（4 tests）：fake fork IPC（EventEmitter + send spy）。restart 後 `pty:created` 前的 exit 被忽略、`getCwd` 有值、之後 write 仍送 server、新 PTY 自己的 exit 照常轉發；一般 kill 照常轉發；自行 exit 照常轉發；reconnect replay 的 instance 照常轉發

### 驗收證據

| 證據道 | 結果 | 內容 |
|---|---|---|
| 新增 unit | PASS | 2 files / 9 tests |
| 負向驗證 | 紅燈正確 | scratchpad 備份後把兩處防護條件改成 `false && ...` → **3 個 restart 案例紅**（server 決策單元、server 真 pty restart、main restart race），一般 kill / 自行 exit / replay 6 個仍綠；以備份覆回、`grep -c "if (false &&"` = 0 確認還原，重跑 9/9 綠 |
| `npm run test:unit` | PASS | **78 files / 1083 tests 全綠**（HEAD `c58fc80` 基線 = 1083 − 本單 9 = 1074 / 76 files，推算值） |
| `npx vite build` | PASS | exit 0；`dist-electron/terminal-server.js` 含 `stale exit ignored` |
| `npx tsc --noEmit` | PASS | **40**（≤ 40），本單觸及檔案 0 錯 |
| 本機 smoke | PASS | Playwright `_electron` 啟動 build 後 app（獨立 `--runtime=t0394-smoke-*`、剝除 `BAT_*` / `ELECTRON_RUN_AS_NODE`），等 `bat-pty-server.pid` / `.port` 出現（log `Terminal Server connected via IPC — proxy mode active`），經 preload `window.electronAPI.pty`（cmd.exe）：`create` true → marker 有輸出 → `restart` true → 等 3 秒 → **`getCwd` = `C:\`、`pty:exit` 0 個** → 新 marker 有輸出 → `kill` true → **收到 1 個 `pty:exit`**、`getCwd` = null。main log 有兩次 `server spawned PTY`（pid 不同），無 main 端 stale log（server 端已擋下；server stderr 為 `ignore`，不可見） |
| runtime 驗收（下一版 build） | 交使用者 | 見下節 |

smoke 收尾：第一次 smoke 卡在 `app.close()`（BAT 結束確認對話框，T0390 同樣情形），改為結果先寫檔、close 最多等 15 秒後結束行程。兩次 smoke 留下的 Terminal Server（PID 33780、3156）**先比對 PID 檔與命令列為本 repo `dist-electron\terminal-server.js`** 後 `taskkill /T /F`，殘留 0；兩個 runtime userData 目錄已刪；未動安裝版 BAT 或其 Terminal Server。

### runtime 驗收步驟（交使用者，下一版 build）

1. 安裝新版後，**先讓舊 Terminal Server 結束**（它跨 BAT 重啟存活，舊程式碼會繼續跑）：關閉 BAT 時在「離開 Better Agent Terminal？」對話框**勾選「結束 Terminal Server」**再按「離開」。或在 BAT 全部關閉後於 PowerShell 確認沒有殘留：`Get-CimInstance Win32_Process | ? CommandLine -like '*terminal-server.js*' | select ProcessId, CommandLine`，有的話 `Stop-Process -Id <pid>`（`%APPDATA%\BetterAgentTerminal\bat-pty-server.pid` 記錄其 PID）
2. 開新版 BAT → 開一個本機一般終端，輸入 `echo before`
3. 按該終端的「重新啟動」→ 應出現新的 prompt，**不應**出現 `[Process exited]`
4. 輸入 `echo after` → 有輸出；`cd` 到別的資料夾後再重新啟動一次，仍正常
5. 關閉該終端分頁 → 正常關閉（kill 路徑仍收到 exit）
6. 回歸：關閉 BAT（**不**勾選結束 Terminal Server）→ 重開 → 原終端內容回放、可輸入（T0108 / T0111 / T0113 接回不變）

### 偏差 / 風險 / 後續

1. **測試檔位置**：`affects_files` 列了 `electron/terminal-server/__tests__/`，但 `vite.config.ts` 的 vitest `include` 只涵蓋 `electron/__tests__/**` 與 `electron/remote/__tests__/**`，放那裡不會被 `npm run test:unit` 執行；改 `vite.config.ts` 超出範圍，故兩個測試檔都放 `electron/__tests__/`（同列於 `affects_files`）
2. **範圍 1 判斷條件**：見「實作內容」第 1 點的 ⚠️，照字面會破壞一般 kill 的 `pty:exit`，已採 `handleDirectExit` 同形條件
3. **已存活的舊版 Terminal Server**：新版 BAT 接回舊 server 時 server 端修正不生效（restart 仍會刪掉 server 上的新 entry，main 端防護救不了，因為 server 自己已經沒有該 PTY）。驗收第 1 步處理；正式發版時是否在 release note 提示「升級後首次關閉請勾選結束 Terminal Server」由塔台決定
4. **已知殘餘（未處理，記錄）**：server 端 `pty:create` spawn 失敗只回 `{ type: 'error', requestType: 'pty:create' }`（不帶 id），main 端該 instance 的 `awaitingCreated` 不會被清；此時也不會有對應的 exit，且該 instance 在本單之前就是無效的（既有行為），不惡化
5. 沒改：`electron/main.ts`（T0393 平行）、`protocol.ts`、`vite.config.ts`；沒用 stash / reset / checkout / restore；沒 push

### 變更檔案

- 修改：`electron/terminal-server/server.ts`、`electron/pty-manager.ts`、本工單
- 新增：`electron/__tests__/terminal-server-stale-exit.test.ts`、`electron/__tests__/pty-manager-server-exit.test.ts`

### Commit

- 單一 commit，`git commit --only` 只含上列檔案；沒 push。hash 見 `git log`（回報區在 commit 前寫入，不自我引用）
