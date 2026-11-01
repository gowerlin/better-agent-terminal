---
schema_version: 1
schema_kind: workorder
id: T0732
title: "BUG-179：`bat-scripts.log` 啟動時輪替（> 10 MB 改名帶時間戳、保留 3 份；本機主行程與 headless bat-server）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T12:25:49+0800"
started_at: "2026-11-01T12:37:05+0800"
updated_at: "2026-11-01T12:43:59+0800"
completed_at: "2026-11-01T12:43:19+0800"
depends_on: [T0730]
related:
  - "BUG-179；D198（規格）；T0731 回報區 Q-B3 與〈發現的問題〉1"
  - "T0192 / T0193（原本明訂先不輪替）；CLAUDE.md「Logging」（單一 userData、import 期不得取 `app.getPath('userData')`）"
  - "既有範本：debug log 保留最近 10 個（`electron/logger.ts` `MAX_LOG_FILES`）"
affects_files:
  - electron/remote/remote-logger.ts
  - electron/main.ts
  - electron/remote/headless-entry.ts
  - "electron/ 下新增的輪替模組（若抽出，位置由你決定）"
  - "electron/__tests__/ 或 electron/remote/__tests__/（輪替測試）"
  - CLAUDE.md
  - docs/agent-guide/logging.md
  - _ct-workorders/BUG-179-bat-scripts-log-unbounded-growth.md
  - _ct-workorders/T0732-fix-bat-scripts-log-rotation.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 規格（D198，不得自行更改）：本機主行程啟動時、headless bat-server 啟動時，各自檢查自己寫的 `bat-scripts.log`（本機在 `<userData>/Logs/`；headless 依 `BAT_HELPER_LOG_DIR` / 既有解析）；大小 > 10 MB（10 × 1024 × 1024 bytes）就改名為 `bat-scripts-<YYYYMMDD-HHMMSS>.log`（時間戳取執行當下的本機時間），之後只保留最近 3 份舊檔（依檔名時間戳排序，刪最舊的）。改名或刪除失敗（Windows `EBUSY` / `EPERM` 等）一律靜默略過、記一行到 debug log、下次啟動再試，不得丟例外或影響啟動。"
  - "🔴 不變：helper 端 `scripts/_bat-logger.mjs` 的寫入規則、檔名、欄位不變（舊 helper 照樣 append 到新的空檔）；`report-hook` 雙寫不調整；日誌寫入失敗不影響業務的既有政策不變。輪替只在啟動時做一次，不在 append 路徑加檢查。"
  - "🔴 CLAUDE.md「Logging」規則：任何模組不得在 import 期呼叫 `app.getPath('userData')`；`app-paths-bootstrap` 的 import 限制不得被破壞（`electron/__tests__/app-paths-bootstrap-order.test.ts`）。輪替呼叫放在 `logger.init` 之後、第一個寫 `bat-scripts.log` 的動作之前；說明你選的位置。"
  - "🔴 驗證：單元測試涵蓋 ≤ 10 MB 不動、> 10 MB 改名、保留 3 份刪最舊、改名失敗不丟例外、檔案不存在、headless 路徑。`npm run test:unit` 全過；`npm run test:legacy` 全過；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功。不得對使用者真實的 `bat-scripts.log` 做輪替測試（用 temp 目錄）；不得以預設實例啟動 source build。"
  - "🔴 CLAUDE.md「Logging」補一行（輪替規則與唯一實作位置），細節寫 `docs/agent-guide/logging.md`，遵守檔頭撰寫規則。BUG-179 修好後由你改 `FIXED`（附 commit 與驗證摘要）；`_bug-tracker.md` 由塔台重建，不要改。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。測試失敗輸出不得傾印整個 `process.env`。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0732 — BUG-179：`bat-scripts.log` 啟動時輪替

## 元資料

- **工單編號**：T0732
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T12:25:49+0800
- **預估規模**：S

## 背景

T0731 查證 `bat-scripts.log` 從不輪替（本機 41.6 MB，10 月單月 35.6 MB）。使用者決定現在修、規格由塔台訂（D198）：啟動時 > 10 MB 輪替、保留 3 份。

## 範圍

1. 主行程與 headless bat-server 啟動時輪替。
2. 單元測試。
3. CLAUDE.md 一行、docs；BUG-179 改 FIXED。

## 不做

- 不改 helper 寫入、不減少 `report-hook` 雙寫。
- 不改 debug log 的保留規則。

## 驗收

- [ ] 輪替規則與 D198 一致（含失敗容錯）
- [ ] `test:unit` / `test:legacy` 全過、兩個 typecheck = 0、`vite build` 成功
- [ ] BUG-179 = FIXED

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**FIXED**（BUG-179 → FIXED，等實機驗收）。驗收三項全部達成。

### 降落檢查

- 結果：**PASS**
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = 主 checkout，`CT_HOME` 未設定，非 worktree）
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`electron/remote/remote-logger.ts`、`electron/main.ts`、`electron/remote/headless-entry.ts`、`CLAUDE.md`、`docs/agent-guide/logging.md` 皆存在 → PASS（含萬用說明的兩項不可測，略過）
- C-2：工單無 `branch` 欄位 → 不適用
- `BAT_WORKSPACE_ID`：有設定（僅記錄，不比對；值不寫入公開 repo）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 修改內容

| 檔案 | 變更 |
|---|---|
| `electron/bat-scripts-log-rotation.ts`（新增） | 唯一實作 `rotateBatScriptsLog(logDir, { log, now, fs, maxBytes, keep })`：stat → > 10 MiB 改名 `bat-scripts-<YYYYMMDD-HHMMSS>.log`（本機時間；同秒有同名檔改用 `-2`、`-3`…，不覆寫）→ 列目錄、依檔名時間戳（再依序號）排序，刪掉第 4 份以後的舊檔。只管符合 `bat-scripts-<8 碼>-<6 碼>[-N].log` 的檔。每個失敗記一行 `[bat-scripts-log] … will retry next startup (<code>: <message>)`，外層 try/catch，永不丟例外（log callback 自己丟例外也吞掉）。只 import `fs` / `path`，無 import 期副作用 |
| `electron/main.ts` | `app.whenReady()` callback 開頭、`[startup] app.whenReady fired` 之後呼叫 `rotateBatScriptsLog(logger.getLogsDir(), { log: logger.log })`（logs dir 為空字串時跳過） |
| `electron/remote/headless-entry.ts` | 抽出 `helperLogDir = path.join(opts.dataDir, 'Logs')`（helper endpoint 的 `logDir` 改用它，值不變）；`start()` 取得 dataDir 鎖後、`remoteServer.start` 前呼叫一次（`batScriptsLogRotated` 旗標，stop 後再 start 不重做），日誌寫 `opts.logger ?? defaultLogger` |
| `electron/__tests__/bat-scripts-log-rotation.test.ts`（新增） | 17 項：常數、時間戳格式、剛好 10 MiB 不動、> 10 MiB 改名、改名後 helper append 建新檔、同秒不覆寫、保留 3 份依檔名（mtime 故意相反）且不動無關檔、同秒序號排序、沒有輪替也清理、檔案不存在、目錄不存在、改名 `EBUSY` 不丟例外且下次啟動成功、刪除 `EPERM` 不丟例外且其他照刪、所有 fs 呼叫與 log 都丟例外仍不丟；source guard：main.ts 呼叫在 `whenReady` 內且在 `remoteServer.start(startupPort)` 之前、模組不 import electron / 不呼叫 `getPath(`、append 路徑（`remote-logger.ts`、`_bat-logger.mjs`）沒有輪替 |
| `electron/remote/__tests__/headless-bat-scripts-log-rotation.test.ts`（新增） | 4 項：實際 `createHeadlessServer().start()` 輪替 `<dataDir>/Logs`（含保留 3 份）、小檔不動且正常啟動、沒有 Logs 目錄也正常啟動、source guard（輪替目錄 = helper 的 `logDir`） |
| `CLAUDE.md` | 「Logging」節加一行（規則摘要、唯一實作位置、連 docs），位置在「Helper scripts 的 userData」之後 |
| `docs/agent-guide/logging.md` | 新增「`bat-scripts.log` 啟動時輪替」條目：規則原文（🔴）、失敗處理、不變項、唯一實作、兩個呼叫位置與理由、日誌格式、已知限制、驗證 |
| `_ct-workorders/BUG-179-…md` | `FIXED`（commit `ce648034`），補〈修正〉段與待驗收說明 |

**輪替呼叫位置說明（工單要求）**

- 本機：`logger.init` 已在 `electron/app-paths-bootstrap.ts`（main.ts 第一個 import）執行，所以 `whenReady` 開頭 `logger.getLogsDir()` 一定已知；而主行程寫 `bat-scripts.log` 的只有 RemoteServer handler 的 `mirrorToBatScripts`（server 在同一個 callback 稍後 `await remoteServer.start(startupPort)` 才啟動）與 PTY 內的 helper（還沒有視窗、還沒有 PTY）。不放進 `app-paths-bootstrap`：那裡的 import 白名單不得擴充（`app-paths-bootstrap-order.test.ts`，本單仍通過）。唯一例外是 Terminal Server 存活時，舊 PTY 內的 helper 可能在輪替時正在 append → Windows `EBUSY` / `EPERM` 依規格略過、下次再試。
- headless：`HeadlessServer.start()` 取得 dataDir 鎖之後（避免第二個 bat-server 實例在鎖失敗前就動到正在使用中的日誌），`remoteServer.start` 之前（還沒有 client，就沒有 PTY 與 helper）。headless 主程序本身不寫 `bat-scripts.log`（它沒有呼叫 `logger.init`，`mirrorToBatScripts` 會停用），寫入者是它 PTY 內的 helper（`BAT_HELPER_LOG_DIR = <dataDir>/Logs`），所以輪替該目錄。

### 驗證

| 關卡 | 結果 | 證據 |
|---|---|---|
| 新測試 + 相關既有測試（rotation ×2、`app-paths-bootstrap-order`、`headless-server`） | PASS | 4 檔 43 passed |
| `npm run test:unit` | PASS | 354 files passed；6298 passed / 3 skipped；exit 0 |
| `npm run test:legacy` | PASS | files 33 passed, 0 failed；tests 472 passed, 0 failed；exit 0 |
| `npm run typecheck` | PASS | exit 0（0 errors） |
| `npm run typecheck:electron` | PASS | exit 0（0 errors） |
| `npx vite build` | PASS | exit 0；`[bat-scripts-log]` 已打進 `dist-electron/main-*.js` |
| 實機（真實 `bat-scripts.log`） | 未做（依工單禁止） | 待驗收：重開 BAT 後應出現 `bat-scripts-<stamp>.log`，debug log 有 `[bat-scripts-log] rotated` 行 |

- 所有測試都在 temp 目錄；未以預設實例啟動 source build；測試輸出不傾印 `process.env`。
- 驗證時的 HEAD 為 `62be01e2` + 工作樹改動，產品 commit `ce648034` 內容即為該批改動（之間沒有再改產品檔）。

### 相關通過案例判定

工單沒有〈相關通過案例〉節，不適用。對既有行為：helper 寫入、`report-hook` 雙寫、debug log 保留規則、`remote-logger.ts` 都未改動；headless helper endpoint 的 `logDir` 值不變（只改成共用常數）。

### Commit

- 產品：`ce648034` fix(logging): rotate bat-scripts.log at startup (T0732, BUG-179)
- 工單 + BUG-179：本次工單 commit（`git commit --only`）
- 未 push、未發版、未改 CHANGELOG、未改 `_bug-tracker.md`（由塔台重建）。工作樹中 `_ct-workorders/_decision-log.md`、`_ct-workorders/T0734-…md` 為塔台的改動，未動。

### 遭遇問題

- 無阻斷。Phase 1 的 `IN_PROGRESS` 標記在實作開始後才寫入（`started_at` 用開工時實際取得的系統時間 12:37:05），流程順序偏差，已記錄。

### 後續建議（給塔台）

- 實機驗收 BUG-179（見上表最後一列）後可改 `CLOSED`。
- 選項（D198 不做）：減少 `report-hook` helper / 主行程雙寫，可再降低成長速度。

### 互動紀錄

- [12:43] 無提問（yolo，未使用塔台提問通道）

### 回報時間

2026-11-01T12:43:19+0800

### 塔台收尾補記

- 2026-11-01T12:43:59+0800：工單狀態由 `FIXED` 改為 `DONE`（FIXED 是 BUG 單的狀態；工單範圍與驗收三項皆完成，L177）。BUG-179 維持 `FIXED`，待下一個預覽版實機驗收（重開 BAT 後出現 `bat-scripts-<stamp>.log`、debug log 有 `[bat-scripts-log] rotated`）。
