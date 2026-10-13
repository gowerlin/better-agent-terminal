---
schema_version: 1
schema_kind: workorder
id: T0514
title: "pre.6 已安裝版自動化實機驗收（UI / 遠端路由線）：BUG-105 / 106 / 107 / 108 / 109 / 110 / 112 / 113 / 096"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-verify-pre6
priority: P1
sizing: L
created_at: "2026-10-14T03:42:23+0800"
target_version: "0.6.0-pre.6（驗收，不發版）"
related:
  - "T0510（同型驗收：installed exe + Playwright 隔離實例，`e2e/pre5-acceptance.spec.ts`）"
  - "T0467（`e2e/real-remote/plan039-real-remote-env.mjs`、`Dockerfile`、`e2e/fixtures/electron-isolation.ts` `launchIsolated` / `isolatedEnv`）"
  - "並行：T0515（精靈線）、T0516（建置產物線）"
affects_files:
  - e2e/pre6-ui-remote-acceptance.spec.ts
  - e2e/real-remote/
  - e2e/fixtures/
  - _ct-workorders/T0514-pre6-installed-ui-remote-acceptance.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只寫驗收工具 / opt-in spec，不改產品程式碼**（`electron/**`、`src/**`、`scripts/**`、`package.json` 不動）。發現產品缺陷 → 回報區記證據（步驟、預期 vs 實際、log 片段、截圖路徑），該項 FAIL、整單 PARTIAL，**不自行修**（由塔台開 BUG）。BUG 檔與 `_bug-tracker.md` 不動（塔台負責結案）。"
  - "🔴 **受測 build = 已安裝的 pre.6**：`C:/Program Files/BetterAgentTerminal/BetterAgentTerminal.exe`（FileVersion `0.6.0-pre.6`；`executablePath` 用正斜線），以 Playwright 起**隔離實例**（獨立 `--runtime` / userData）。"
  - "🔴 **不碰使用者正在用的 BAT**：不得關閉 / 重啟 / 對 port 9876 發 helper 連線；真實 `%APPDATA%\\BetterAgentTerminal\\` **只讀**。不得連線、停止或改動 WSL 內使用者的 bat-server（PID 381 / port 9877、`~/.local/bat-server`）。"
  - "🔴 **不得消耗 Claude token**：不開 Claude Agent session、不送 prompt。BUG-108 只驗附件讀檔路徑到送出前為止（附件出現在輸入區 / IPC 讀檔結果），不送訊息。"
  - "🔴 **Docker / WSL**：只建立、操作、刪除名稱前綴 `bat-t0514-` 且帶 label `bat.t0514=1` 的容器 / network / volume；不得 `docker system prune`、不得動其他容器（含 `bat-t0467-*` / `bat-t0510-*` / `bat-t0515-*`）；不得 `wsl --shutdown` / `--terminate`；收尾刪除本單容器 / network（image 可保留並列出）。"
  - "🔴 與 T0515 / T0516 並行：本單只新增上列 affects_files；共用 fixture 若要改，改成**新增**函式，不改既有簽章。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 `npm run test:e2e`（L141），只跑本單 spec。commit 用精準 `git add` 或 `git commit --only`。"
---

# T0514 — pre.6 已安裝版自動化實機驗收（UI / 遠端路由線）

## 背景

使用者要求把「已修復待實機驗收」的 BUG 盡量自動化驗收（2026-10-14 第六十 session）。本單是三條並行線之一：**已安裝 pre.6 exe 的 UI 與遠端路由行為**。做法沿用 T0510：Playwright 驅動已安裝 exe 的隔離實例；需要遠端時用 T0467 的 headless bat-server 容器（`bat-t0514-*`）當 remote profile 目標。

每項請先讀對應 BUG 檔的「現象 / 預期 / 修正」與修正工單回報區的「需實機驗收」段，依那裡寫的情境設計步驟。

## 驗收項目

| # | BUG | 驗收重點（以 BUG 檔為準） |
|---|---|---|
| U1 | BUG-113 | 本機 workspace detach → 新視窗正常載入、不顯示 `Workspace not found` |
| U2 | BUG-112 | 從 remote profile 視窗 detach 出的 workspace 視窗，proxied 呼叫（如 `pty:create` / `fs:*`）走遠端，不落本機 |
| U3 | BUG-110 | remote profile 視窗在連線中斷時，proxied channel 回錯誤（fail-closed），不在本機執行（停掉 / 斷開本單容器即可製造） |
| U4 | BUG-105 | 遠端視窗下 `claude:*` 的 cwd、`github:*`、`git-scaffold:*`、`worktree:create` 的路徑轉換正確（不啟動 Claude session；可驗 IPC 參數 / 遠端實際落點 / log） |
| U5 | BUG-096 | renderer 遠端重連帶 fingerprint；不會以未 pin 連線取代已驗證連線（可從 main log / 連線紀錄驗） |
| U6 | BUG-106 | `worktree:merge` 不再呼叫已移除的方法（在隔離 git repo 上走一次，無 `is not a function`） |
| U7 | BUG-107 | 拖放檔案取得路徑（Electron 41 `webUtils.getPathForFile`）。若 Playwright 無法產生帶真實路徑的 OS 拖放，改驗 preload 暴露的 API 對 `<input type=file>` 選到的 File 回傳正確路徑，並在回報區註明「OS 拖放手勢需真人」 |
| U8 | BUG-108 | Claude 面板圖片附件：本機工作區外的圖片可附加（不被 path guard 擋）；遠端視窗讀的是遠端檔案系統 |
| U9 | BUG-109 | `/snippet` prompt 內的 `snippets.json` 路徑為本機 OS 實際路徑（Windows 為 `%APPDATA%\BetterAgentTerminal\snippets.json` 形式），不是寫死的 macOS 路徑 |

每項結果標 PASS / FAIL / NEEDS-HUMAN（自動化做不到的部分），附證據（截圖 / log 片段 / 斷言輸出）。

## 驗證

- 新增 opt-in spec `e2e/pre6-ui-remote-acceptance.spec.ts`（環境變數 gate，例如 `BAT_E2E_PRE6_UI=1`，預設 skip，不影響一般 e2e）
- 執行該 spec，回報區附執行指令與結果
- 收尾：本單容器 / network 已刪、隔離 userData 已刪、Terminal Server 已結束；真實 userData 雜湊前後一致

## 驗收條件

- [ ] U1-U9 各有 PASS / FAIL / NEEDS-HUMAN 與證據
- [ ] 未改產品程式碼；未碰使用者 BAT / WSL bat-server
- [ ] 環境清理完成

## Sub-session 執行指示

1. 讀本工單、T0510 回報區（harness 經驗）、U1-U9 對應 BUG 檔
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 執行 → 填回報區（DONE：全項有結論；PARTIAL：有 FAIL 或做不完）
4. commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

