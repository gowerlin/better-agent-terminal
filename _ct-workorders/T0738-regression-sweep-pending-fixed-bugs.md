---
schema_version: 1
schema_kind: workorder
id: T0738
title: "待驗收 FIXED BUG 自動化盤點：逐張對照既有自動化證據、在 HEAD 重跑相關 e2e、分類為可結案 / 可補 e2e / 只能手動或特定環境"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: L
created_at: "2026-11-01T17:20:13+0800"
started_at: "2026-11-01T18:05:04+0800"
updated_at: "2026-11-01T18:25:02+0800"
completed_at: "2026-11-01T18:25:02+0800"
depends_on: [T0737, T0741]
related:
  - "`_ct-workorders/_bug-tracker.md`〈✅ 已修復〉；各 BUG 單的修正工單與回報區"
  - "`e2e/`（72 支 spec，含 t0523 / t0524 / t0530 / t0531 / t0532 / t0539 / t0578 / t0580 等）、`e2e/fixtures/electron-isolation.ts`"
  - "全域 R-G003（BUG 狀態判準）；T0736 / T0737（pre.8 / pre.7 自動驗收，本單不重做那些 BUG：177 / 178 / 179）"
affects_files:
  - _ct-workorders/T0738-regression-sweep-pending-fixed-bugs.md
  - "e2e/（只在〈範圍〉第 3 點新增 spec 時；最多 3 支；不改既有 spec 的行為）"
renew_count: 0
session_ids:
  - "43f9452b-1756-4f2d-9f42-c92a57ddb5f6"
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 對象（目前 FIXED、本單要逐張處理）：BUG-105、107、108、111、116、118、127、128、129、130、131、132、133、134、135、137、146、147、156、159、171、175。不含 BUG-177 / 178 / 179（T0737）。以 BUG 單內容與其修正工單回報區為準，單內有多段更正以最後一段為準。"
  - "🔴 每張產出一列：修正 commit / 版本、既有自動化證據（單元測試檔、e2e spec、CI 檢查，附路徑）、本次在 HEAD 重跑的結果（PASS / FAIL / 未跑＋原因）、分類與建議：(A) 證據足以 CLOSED（寫出依據：e2e 在 HEAD 綠＋修正已在交付版、或 CI 打包檢查、或回報區已記錄的使用者 / 外部測試者實測）；(B) 可在本機 Windows 補 e2e（寫出情境與做法）；(C) 只能手動或需特定環境（寫出需要什麼：macOS / Linux 實機、Docker 執行中、WSL 安裝 server bundle、遠端主機、真實模型、OS 拖放等）。證據不足一律歸 B 或 C，不得猜成 A。"
  - "🔴 範圍：① 對照表；② 在 HEAD 以隔離實例重跑對照到的既有 e2e（先 `npx vite build`），記錄每支結果與耗時；③ 對 B 類中最有價值、各自 ≤ 1 個情境的，最多新增 3 支 spec（其餘列為後續候選，由塔台開單）；④ 環境探測只做唯讀查詢：`docker info` 能否連上 engine、`wsl -l -v`、是否以系統管理員執行、內嵌 / 系統 codex 版本 —— 只記結果。⑤ BUG-116 / 118（mac / Linux 打包）可用 `gh run view <run> -R gowerlin/better-agent-terminal --log` 唯讀查 `v0.7.2-pre.8` 發版 run `41277080514` 的 `verify-packaged-native.js` 輸出當證據。"
  - "🔴 不得做（會動到使用者環境或不可逆）：不建立 / 刪除 / 停止任何 Docker 容器或映像、不在使用者的 WSL 安裝或移除 server bundle、不連 SSH 遠端、不改系統時間（BUG-171 只驗『結束隔離實例自己的 Terminal Server 程序 → recovery 依序執行、新 shell 不被套 exit 1』這條，程序以隔離 userData 的 pid 檔辨識，🔴 絕不碰使用者 BAT 的 Terminal Server）、不執行安裝檔。會寫系統剪貼簿的 spec（例如 t0524 貼圖）：先備份剪貼簿文字、跑完還原；無法安全還原就不跑並註明。Docker / WSL / 遠端相關 spec 一律不跑，歸 C 並寫明需要什麼，由塔台與使用者決定。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；不改 BUG 單狀態與 `_bug-tracker.md`（由塔台依本單建議處理）；重跑發現 FAIL → 記在〈發現的問題〉附重現步驟、log 位置，判斷是產品回歸還是測試過時，不在本單修。"
  - "🔴 隔離：一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例，不以預設實例啟動 source build、不碰使用者正在用的 BAT 與 userData；T0737 與 T0741 都完成後才派本單（避免同時 build）。暫存目錄跑完要清掉；清不掉就把路徑寫進回報區。需要 LLM 的 spec 只能打本機假模型（`e2e/fixtures/fake-anthropic-api.ts` 或 spec 自帶的假 API），不得用真實登入；回報對外請求數。"
  - "🔴 驗證：新增 spec（若有）連跑 2 次綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，外部測試者一律用代稱。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0738 — 待驗收 FIXED BUG 自動化盤點

## 元資料

- **工單編號**：T0738
- **類型**：implementation（驗收盤點＋回歸重跑）
- **優先級**：P2
- **建立時間**：2026-11-01T17:20:13+0800
- **預估規模**：L

## 背景

使用者要求把 pre.6 以前還沒驗收的項目也安排自動驗收。熱區有 22 張 FIXED BUG（不含 T0737 處理的 177 / 178 / 179）在等驗收，其中不少修正工單當時已寫了 e2e，但沒有在新版上重跑；另有部分只能在 macOS / Linux、Docker、WSL、遠端主機或真實模型上驗。本單先把每張的證據與可自動化程度盤清楚，重跑既有 e2e，讓塔台依 R-G003 結案或另開補 e2e 的工單。

本機環境（塔台唯讀探測，供參考，Worker 以自己的探測為準）：🔴 **本機 BAT 是以系統管理員身分執行**（17:49 以 `WindowsPrincipal.IsInRole(Administrator)` = True 確認；17:20 那次以 Git Bash `whoami /groups` 判成非系統管理員是錯的，T0740 也偵測到提權）→ Worker 分頁同樣提權，BUG-159（需一般權限）無法在本機 BAT 分頁內驗，歸 C、寫明需要一般權限的 BAT；`docker --version` = 29.9.2（engine 是否執行未查）、WSL 有 `Ubuntu-24.04`。

## 範圍

1. 22 張 BUG 的對照表與分類（A / B / C）。
2. 重跑對照到的既有 e2e。
3. B 類最多補 3 支 spec。
4. 唯讀環境探測、CI 打包證據。

## 不做

- 不改產品程式碼、不改 BUG 狀態、不動 Docker / WSL / 遠端 / 系統時間 / 安裝檔。
- pre.6 / pre.5 需要真實模型（Task*、背景 Agent 卡片、SDK 0.3 真實對話）與 NSIS 重裝的項目不在本單（塔台另與使用者確認）。

## 驗收

- [ ] 22 張逐張一列（證據、重跑結果、分類與依據）
- [ ] 重跑的 e2e 清單與結果
- [ ] 新增 spec（若有）連跑 2 次綠、兩個 typecheck = 0
- [ ] 環境探測結果
- [ ] 〈A 類結案建議〉〈B 類後續候選〉〈C 類需要的環境〉三份清單

---

## 回報區

### 完成狀態

- **狀態**：DONE（22 張逐張分類完成；既有 e2e 14 支在 HEAD 全綠；新增 3 支 spec 各連跑 2 次全綠；兩個 typecheck = 0）
- **分類結果**：A（證據足以 CLOSED）12 張、B（可在本機 Windows 補 e2e）4 張、C（只能手動或需特定環境）6 張
- **commit**：`384ab82d`（新增 3 支 e2e spec，在 `e2e/` 內、不改既有 spec）；工單本檔另一個 commit
- **驗證時的 HEAD**：產品程式碼 = `e0588e55`（本單沒改 `src/` / `electron/` / `scripts/`）
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 `REPO_ROOT` 下；C-3 `affects_files` 只有工單本身與 `e2e/`（存在）；C-2 無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`BAT_REMOTE_TOKEN` 已設定。`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`。
- **session_id**：43f9452b-1756-4f2d-9f42-c92a57ddb5f6

### 對照表

「首發版」= `git tag --contains <修正 commit>` 的第一個 `v0.x` tag。「重跑」= 本單在 HEAD `e0588e55` 以隔離實例跑的結果（先 `npx vite build`，exit 0）。

| BUG | 內容（一句） | 修正工單 / commit / 首發版 | 既有自動化證據 | 本次重跑（HEAD） | 分類 | 依據 / 建議 |
|---|---|---|---|---|---|---|
| BUG-105 | 遠端視窗的 proxied channel（`claude:*` cwd、`github:*`、`git-scaffold:*`、`worktree:create`）沒做路徑轉換 | T0416 `e2daec1a`（v0.6.0-pre.1）；附件路徑 T0437 `394add54`（pre.2） | 單元 `electron/remote/__tests__/path-aware-channels-coverage.test.ts`；e2e `e2e/pre6-ui-remote-acceptance.spec.ts` U4（opt-in `BAT_E2E_PRE6_UI=1`，需 `e2e/real-remote/t0514-env.mjs up` 的 Docker 遠端；T0514 在 pre.6 安裝版 PASS） | 未跑：需 Docker 遠端（本機 Docker engine 未執行），工單規定 Docker / WSL / 遠端 spec 不跑 | **C** | 需 WSL profile 或 Docker / SSH 遠端視窗；`claude:start-session` 的 `pwd` 那步需真實 Claude 登入（T0514 標 NEEDS-HUMAN） |
| BUG-107 | Electron 41 拖放檔案拿不到路徑（`File.path` 移除） | T0435 `c6c4e9e4`（v0.6.0-pre.2） | 單元 `src/__tests__/drag-drop-get-path-for-file.test.tsx`、`electron/__tests__/preload-get-path-for-file.test.ts`；e2e `pre6-ui-remote-acceptance.spec.ts` U7（合成 drop，本機＋遠端視窗，綁 Docker 遠端環境） | 未跑：該 spec 需 Docker 遠端環境 | **B**（本機部分）＋ C（真實 OS 拖放、遠端） | 可補只開本機視窗的合成 drop spec（`setInputFiles` 真檔 → drop 到終端 / Claude 面板 → 斷言路徑）；真實檔案總管拖放 Playwright 做不到，需人工 |
| BUG-108 | 圖片附件走 proxied `image:read-as-data-url`，tmpdir / 工作區外圖片被拒、遠端讀到 server 檔案系統 | T0436 `6c26edcc`（v0.6.0-pre.2） | 單元 `electron/__tests__/image-attachments.test.ts`、`src/__tests__/image-attachment-client-read.test.tsx`；e2e `pre6-ui-remote-acceptance.spec.ts` U8（綁 Docker 遠端環境） | 未跑：該 spec 需 Docker 遠端環境 | **B**（本機部分）＋ C（遠端） | 可補本機 spec：tmpdir 圖片 drop 與 stub `dialog.selectAttachments` 後附件縮圖出現（不送訊息、不需 LLM）；貼上路徑需寫剪貼簿（比照 t0524 備份還原）；遠端部分需 WSL / Docker |
| BUG-111 | 設定精靈 rollback 會刪 / 停使用者自己的資源（Docker 容器、`/opt/bat-server`、殘留 profile） | T0444 `bb24f333`（v0.6.0-pre.2） | 單元 `src/components/setup-wizard/__tests__/wizard-rollback-ownership.test.ts`（32 例，全 mock）；legacy `tests/wizard-rollback-cross.test.ts`；e2e `e2e/pre6-wizard-acceptance.spec.ts` W8（opt-in，SSH 側 T0515 PASS，Docker 側 needs-human） | 未跑：Docker / SSH，工單規定不跑 | **C** | 需執行中的 Docker engine＋使用者事先建立的容器（驗「使用既有容器」取消後容器仍在）；SSH 側已有 T0515 證據 |
| BUG-116 | macOS 啟動即崩潰（whisper addon 找 `darwin-<arch>`，套件放 `mac-<arch>`，且在頂層 import） | T0468 `78e3bc9d`（v0.6.0-pre.3）；T0469 `01e60828`、T0470 `a8c18f34` | 單元 `electron/__tests__/whisper-addon-loader.test.ts`、`voice-handler-whisper-fail-soft.test.ts`；CI `verify-native-modules.js`、`verify-packaged-native.js --platform mac --arch arm64` | CI 證據（唯讀查 run `41277080514`，v0.7.2-pre.8，job `build (macos-latest, mac)` 124761960684）：`✅ arm64: BetterAgentTerminal.app — main arm64, 41 Mach-O under app.asar.unpacked, … whisper …/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist/mac-arm64/whisper.node … helper version 0.7.2-pre.8`、`✅ every mac .app passed (arm64)` | **A** | 核心症狀（啟動崩潰）已有外部實機證據：T0526 判讀外部測試者A mac 上 `/Applications/BetterAgentTerminal.app` 的 debug log（2026-10-14，v0.6.0-pre.5–pre.7，晚於 pre.3 修正；同一次啟動連續使用數小時、2236 行，沒有啟動崩潰）；pre.8 CI 打包檢查確認 mac-arm64 whisper.node 在正確位置。**殘留**：語音轉寫本身沒有實機驗過（另需 mac＋ggml 模型），建議結案時註明或列待辦 |
| BUG-118 | 非 Windows 安裝檔缺內嵌 claude（只找 `bin/claude.exe`） | T0475 `0d39b532`（v0.6.0-pre.3） | 單元 `electron/__tests__/claude-runtime-router.test.ts`、`scripts/__tests__/verify-packaged-native.test.mjs`；CI `verify-packaged-native.js` mac / linux | CI 證據（run `41277080514`）：mac `embedded claude …/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-darwin-arm64/claude`；linux job 124761960755 `✅ linux x64: embedded claude …/claude-code-linux-x64/claude (ELF e_machine 0x3e)`、`✅ every linux package passed (x64)` | **A** | CI 打包檢查（工單列為 A 的依據之一）兩平台皆在；另 T0516 在 WSL 解開 pre.6 AppImage `claude --version` = 2.1.296 PASS |
| BUG-127 | 塔台面板切換工作區時跳出大量「新工單」toast | T0521 `5962450c`（v0.6.0-pre.8） | 單元 `src/components/__tests__/control-tower-panel-toasts.test.tsx`（8 例）；原本無 e2e | **新增** `e2e/t0738-ct-panel-switch-toasts.spec.ts` PASS ×3（首跑＋連跑 2 次，各約 25 s） | **A** | e2e 在 HEAD 綠＋修正已在交付版。spec 把面板停靠在右側欄（回報者的配置），A↔B 切 3 次、每次觀察 5 s 都沒有 toast（MutationObserver 記錄每個曾出現的 `.ct-toast`）；正向對照：B 新增工單 → 出現 `📋 New work order: T7499`；切回 A → 該 toast 消失、A 沒有 toast。未對修正前版本驗紅 |
| BUG-128 | macOS：Finder 複製檔案後 Cmd+V 貼不進終端 | T0522 `43c90731`（v0.6.0-pre.8） | 單元 `electron/__tests__/clipboard-file-paths.test.ts`、`src/__tests__/panel-finder-paste.test.tsx`、`src/__tests__/terminal-paste-shortcuts.test.tsx`；無 e2e | 未跑：mac 專屬，Windows 無法重現 | **C** | 需 mac 實機（Finder 剪貼簿 `NSFilenamesPboardType` / `public.file-url`）；T0522 已寫給外部測試者A 的驗收步驟；根因為讀碼推得，從未在 mac 驗過 |
| BUG-129 | 塔台派工落到錯的工作區 | T0523 `dcdfffef`（v0.6.0-pre.8）；「開成 Claude」部分拆 PLAN-040（T0529）；根因 #11 拆 BUG-132 | 單元 `electron/__tests__/terminal-handlers.test.ts`、`agent-prompt-command.test.ts`、`pty-manager-helper-env.test.ts`、`electron/remote/__tests__/headless-terminal.test.ts`、`src/stores/__tests__/workspace-store.addExternalTerminal.test.ts`、`tests/bat-terminal-response-correlation.test.mjs`；e2e `e2e/t0523-dispatch-workspace.spec.ts` | `t0523` PASS（1 test）；附帶 `t0529-workspace-agent-launch` PASS（1 test，PLAN-040 的工作區預設 agent） | **A** | e2e 在 HEAD 綠＋修正已在交付版。注意 D141 原訂「等外部測試者A 回饋 pre.8 再結」，是否仍要等由塔台決定；外部測試者A 的 mac＋Codex 實際情境本機無法重現 |
| BUG-130 | 終端貼圖退化（Windows）；mac 上 Ctrl+V 被當文字貼上 | T0524 `7ac0d0a5`（v0.6.0-pre.8） | 單元 `src/__tests__/terminal-paste-shortcuts.test.tsx`（54 例，三平台）；e2e `e2e/t0524-terminal-image-paste.spec.ts` | `t0524` PASS（1 test；PTY 收到 `1b76` ×2，`clipboard restored`）。剪貼簿：跑前只有文字格式（UnicodeText 等），另以 PowerShell 備份文字，跑完比對 `same=True`、格式相同 | **C**（Windows 部分已足以結案） | Windows 路徑 e2e 在 HEAD 綠；mac 的 `\x16` 路徑需 mac 實機（T0524 已寫外部測試者A 步驟）。塔台可選擇先結 Windows 部分、mac 留待辦 |
| BUG-131 | 本機 PTY 重建路徑掉 env（heartbeat recovery 不帶 env；`pty:restart` 丟 customEnv） | T0525 `d4ee455b`（v0.6.0-pre.8） | 單元 `electron/__tests__/pty-manager-helper-env.test.ts`（7 例，node-pty mock）；原本無 e2e（⏻ 部分由 t0539 的工作區 env 斷言間接涵蓋） | **新增** `e2e/t0738-recovery-keeps-env.spec.ts` PASS ×3（各約 3 s）；`t0539` PASS（⏻ 後工作區 env 仍在） | **A** | e2e 在 HEAD 綠＋修正已在交付版。spec 以隔離 userData 的 pid 檔找 Terminal Server、比對命令列是本 repo `dist-electron/terminal-server.js` 後 `taskkill /F`（不帶 /T）→ `reason=ipc-exit` recovery → 新 shell 的 `T0738_WS_ENV` / `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`（只記 set / unset）/ `BAT_SESSION` 與重建前完全相同。未對修正前版本驗紅 |
| BUG-132 | agent CLI 沿用別的分頁的 `BAT_*`，派工落錯工作區、完成通知送錯塔台 | T0527 `a371ce5e`（v0.6.0-pre.9） | 單元 `electron/__tests__/dispatch-cwd-check.test.ts`、`terminal-handlers.test.ts`、`tests/bat-terminal-response-correlation.test.mjs`；e2e `t0523-dispatch-workspace.spec.ts`（擴充） | `t0523` PASS（含 cross-cwd ask → 建立並警告、yolo → `DISPATCH_CWD_OTHER_WORKSPACE` exit 1） | **A** | 本單修正範圍是 cwd 一致性守門，e2e 在 HEAD 綠＋已交付。根治（PID 祖先比對）與遠端 headless 本來就不在修正範圍，BUG 單已註明 |
| BUG-133 | detached 視窗「開啟設定」沒反應 | T0530 `5bacb583`（v0.6.0-pre.10） | 單元 `electron/__tests__/detached-open-settings.test.ts`、`src/__tests__/detached-open-settings.test.ts`；e2e `e2e/t0530-detached-open-settings.spec.ts` | `t0530` PASS（1 test） | **A** | e2e 在 HEAD 綠＋已交付。真實 UI 按鈕路徑（只在有 GitHub remote 且偵測不到 `gh` 時出現）未涵蓋，父視窗已關的情況只有單元測試 |
| BUG-134 | 工作區終端全關後，主區還顯示別的工作區的終端 | T0531 `d41280ae`（v0.6.0-pre.11） | 單元 `src/stores/__tests__/workspace-store.removeTerminal.test.ts`；e2e `e2e/t0531-empty-workspace-view.spec.ts`（修正前紅、修正後綠） | `t0531` PASS（1 test） | **A** | e2e 在 HEAD 綠（有修正前紅的紀錄）＋已交付 |
| BUG-135 | detached 視窗關閉收回時，焦點可能落到別的工作區的終端 | T0532 `8b5251a8`（v0.6.1-pre.1） | 單元 `src/stores/__tests__/workspace-store.focusFallback.test.ts`（修正前 6 紅）、`workspace-store.adoptDetached.test.ts`、`workspace-store.removeTerminal.test.ts`；e2e `t0532-default-terminal-no-empty-flash.spec.ts` 涵蓋同 commit 的另一個修正，不是 adopt 焦點路徑 | `t0532` PASS；detached 4 支 `detached-workspace`（1）、`detached-close-edges`（2）、`detached-terminal-persistence`（1）、`detached-flush-on-close`（1）全 PASS，但都不斷言 adopt 後焦點所屬的工作區 | **B** | 讀碼發現、從未重現；adopt 焦點路徑只有單元測試。可補 e2e（見〈B 類後續候選〉） |
| BUG-137 | ⏻ 對已結束程序的分頁沒反應 | T0539 `2ff55bdd`（v0.6.1-pre.3） | 單元 `src/lib/__tests__/pty-restart-or-create.test.ts`、`electron/__tests__/terminal-command-source-terminal-id.test.ts`；e2e `e2e/t0539-restart-exited-terminal.spec.ts`（修正前紅） | `t0539` PASS（1 test，約 9 s） | **A** | e2e 在 HEAD 綠＋已交付（Terminal Server 模式；direct 模式與 mac / Linux 未測，BUG 單已註明） |
| BUG-146 | Recovery 提示未回答時，還原分頁的 `pty:create` 另起 direct shell | T0578 `f833e3b0`（v0.7.0-pre.1）；T0580 `f03e5e27` | 單元 `electron/__tests__/recovery-create-hold.test.ts`（12 例）；e2e `e2e/t0578-recovery-no-direct-shell.spec.ts`、`e2e/t0580-recovery-helper-dispatch.spec.ts` | `t0578` PASS（2 tests：recover 33.3 s、fresh start 31.4 s）；`t0580` PASS（1 test，34.4 s） | **A** | e2e 在 HEAD 綠＋已交付；另有使用者安裝版 0.7.0-pre.1 實機探測（T0581，「保留」路徑，log `[BUG-146] pty:create … held until the Recovery prompt is answered`） |
| BUG-147 | Recovery「重新開始」時舊 server 刪掉新 server 的 pid / port / registry 檔 | T0578 `f833e3b0`（v0.7.0-pre.1） | 單元：`recovery-create-hold.test.ts` 內的 `waitForTerminalServerExit(` source guard；e2e `t0578` 的 fresh start 測試 | `t0578` fresh start PASS（31.4 s） | **A** | e2e 在 HEAD 綠＋已交付。注意：狀態快照寫的「BUG-146 / 147 PASS」實機只跑了「保留」路徑，BUG-147 的依據其實是 e2e，不是 T0581 |
| BUG-156 | Docker 精靈固定用 `127.0.0.1:9876`，與 BAT 自己的 RemoteServer 衝突 | T0649 `99abe9a1`（v0.7.1-pre.2） | 單元 `electron/__tests__/docker-server-port.test.ts`（18 例，含真 socket「已占用就跳過」）、`src/components/setup-wizard/steps/docker/__tests__/start-server.test.ts`、`wizard-rollback-ownership.test.ts`；無 e2e | 未跑：沒有既有 e2e；完整驗收需 Docker | **B**（選 port 部分）＋ C（實際建容器） | 「建立新容器」選 port 不呼叫 docker（T0649），可補不需 Docker 的 e2e；實際 publish / 使用既有容器需執行中的 Docker engine |
| BUG-159 | 沒注入 BAT MCP 的 codex 分頁，在非系統管理員下接到共用 codex daemon，讀到別的分頁的 `BAT_*` | T0651 `5b1be0f5`（v0.7.1-pre.2） | 單元 `electron/__tests__/codex-no-daemon-launch.test.ts`（16 例含 source guard）；無 e2e | 未跑：本機 BAT 以系統管理員執行（`IsInRole(Administrator)` = True），daemon 行為無法驗 | **C** | 需一般權限（UAC 開啟）的 BAT＋BAT MCP 關閉＋PATH 上 codex ≥ 0.156.0（本機 0.166.0）＋真實 codex 登入，才能驗 daemon 有沒有繼承 env；「有注入 `--no-daemon`」本身不需模型、提權下也可驗（列 B 候選） |
| BUG-171 | 「終端重設」toast 後多個分頁 `[Process exited with code 1]`（NTP 跳時誤判 server 死亡、recovery 沒關舊 server） | T0704 `68ab2a42`、T0705 `d7ffa080`（v0.7.1-pre.8） | 單元 `electron/__tests__/pty-manager-heartbeat-recovery.test.ts`（20 例）、`terminal-server-pty-env.test.ts`（7 例）、`src/components/__tests__/server-status-toast.test.tsx`（8 例）；e2e `e2e/t0704-heartbeat-recovery.spec.ts` | `t0704` PASS（1 test，1.6 min）：主行程 `Date.now` +5 s / +20 s 不 recovery、server 暫停只記 `late pong`、殺隔離 server（pid 檔＋命令列比對）→ recovery 依序執行、新 shell 不被套 exit 1、沒有殘留程序 | **A** | e2e 在 HEAD 綠＋已交付。只在主行程內替換 `Date.now`，沒改系統時間；工單指定的「結束隔離實例自己的 Terminal Server」路徑已涵蓋。真實 NTP / 睡眠喚醒仍是塔台狀態列的「使用者日常使用驗收」，可視為加分、不阻擋 |
| BUG-175 | 輸出不送 `\n` 時縮圖預覽卡在 agent 啟動畫面，還有 `>0q>4m` 殘字 | T0714 `afe57761`（v0.7.2-pre.3） | 單元 `src/lib/__tests__/thumbnail-preview.test.ts`（+17，含 WSL `script` 錄的 claude 2.1.287 與 ConPTY 樣本）、`src/components/__tests__/terminal-thumbnail-preview.test.tsx`；原本無 e2e | **新增** `e2e/t0738-thumbnail-cursor-rows.spec.ts` PASS ×3（各約 5.5 s）。另以 `git show afe57761^:src/lib/thumbnail-preview.ts` 對同一段實測 raw 輸出離線比對：修正前 → `…>0q>4mT0738-ROW-ALPHAT0738-ROW-BRAVOT0738-ROW-CHARLIE`（三列黏成一行＋殘字），HEAD → 三列各自一行 | **C**（Windows 部分已足以結案） | Windows（ConPTY）路徑 e2e 在 HEAD 綠，且確認能抓到修正前的症狀；原始回報是 macOS 的 raw PTY（中間沒有 ConPTY），GitHub #22 仍開著，需 mac 實機跑 claude Worker 分頁確認 |

### 重跑結果

全部在 HEAD `e0588e55`、隔離實例（`e2e/fixtures/electron-isolation.ts`：`--runtime=e2e-<name>-<ts>`、不繼承 `BAT_*`、RemoteServer 用空閒 port），先 `npx vite build`（exit 0）。耗時為 `npx playwright test` 的牆鐘秒數。

| spec | 對應 BUG | 結果 | 耗時 |
|---|---|---|---|
| `e2e/t0523-dispatch-workspace.spec.ts` | 129、132 | PASS（1） | 3 s |
| `e2e/t0529-workspace-agent-launch.spec.ts` | 129（PLAN-040 部分，附帶） | PASS（1） | 5 s |
| `e2e/t0530-detached-open-settings.spec.ts` | 133 | PASS（1） | 3 s |
| `e2e/t0531-empty-workspace-view.spec.ts` | 134 | PASS（1） | 2 s |
| `e2e/t0532-default-terminal-no-empty-flash.spec.ts` | 135（同 commit 的另一修正） | PASS（1） | 2 s |
| `e2e/detached-workspace.spec.ts` | 135（回歸） | PASS（1） | 3 s |
| `e2e/detached-close-edges.spec.ts` | 135（回歸） | PASS（2） | 5 s |
| `e2e/detached-terminal-persistence.spec.ts` | 135（回歸） | PASS（1） | 4 s |
| `e2e/detached-flush-on-close.spec.ts` | 135（回歸） | PASS（1） | 3 s |
| `e2e/t0524-terminal-image-paste.spec.ts` | 130 | PASS（1）；剪貼簿還原比對一致 | 8 s |
| `e2e/t0539-restart-exited-terminal.spec.ts` | 137、131（⏻） | PASS（1） | 11 s |
| `e2e/t0578-recovery-no-direct-shell.spec.ts` | 146、147 | PASS（2） | 66 s |
| `e2e/t0580-recovery-helper-dispatch.spec.ts` | 146 | PASS（1） | 35 s |
| `e2e/t0704-heartbeat-recovery.spec.ts` | 171 | PASS（1） | 96 s |
| **新增** `e2e/t0738-recovery-keeps-env.spec.ts` | 131 | PASS ×3（首跑＋連跑 2 次） | 3 / 3 / 4 s |
| **新增** `e2e/t0738-thumbnail-cursor-rows.spec.ts` | 175 | PASS ×3（第 1 版情境設計錯誤，失敗 2 次後改寫，見〈發現的問題〉3） | 6 / 6 / 6 s |
| **新增** `e2e/t0738-ct-panel-switch-toasts.spec.ts` | 127 | PASS ×3 | 26 / 26 / 26 s |

（t0530 / t0531 / t0532 第一次跑時只記了 exit code 0，為取得測試數另重跑一次，也都 PASS（1）。）

未跑（工單規定或環境不足）：`pre6-ui-remote-acceptance`（BUG-105 / 107 / 108，Docker 遠端）、`pre6-wizard-acceptance`（BUG-111，Docker / SSH）。BUG-116 / 118 / 128 / 156 / 159 沒有對應 e2e。

其他驗證：
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0（新增 spec 前後各跑一次）。
- 新增 3 支 spec 另以 `npx tsc --noEmit --strict --module esnext --moduleResolution bundler --target es2022 --skipLibCheck --types node <3 檔>` = 0（e2e 不在兩個 typecheck 的範圍內，補這一道）。
- 對外請求：本單的 e2e 都不需要 LLM，沒有用假 API，也沒有任何模型請求。唯一的對外請求是以 `gh run view … -R gowerlin/better-agent-terminal` 唯讀查 CI（4 次：run 摘要 1 次、3 個 build job 的 log）。

環境探測（唯讀）：

| 項目 | 結果 |
|---|---|
| 系統管理員 | `WindowsPrincipal.IsInRole(Administrator)` = **True**（與塔台 17:49 的判讀一致） |
| Docker | `docker info` → `failed to connect to the docker API at npipe:////./pipe/docker_engine … The system cannot find the file specified`，**engine 未執行**（CLI 版本依塔台探測為 29.9.2） |
| WSL | `wsl -l -v`：`Ubuntu-24.04` `Running`，版本 2 |
| codex | 系統：`C:\Users\Gower\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe` → `codex-cli 0.166.0`；內嵌 `node_modules/@openai/codex/package.json` `"version": "0.166.0"` |
| node | v26.13.0 |

CI 打包證據（BUG-116 / 118）：`gh run view 41277080514 -R gowerlin/better-agent-terminal`，`displayTitle` Pre-Release、`headSha` `cf71bf6f…`、`conclusion` success；`build (macos-latest, mac)` 124761960684、`build (ubuntu-24.04, linux)` 124761960755、`build (windows-latest, win)` 124761960699 皆 success。原文摘錄見對照表 BUG-116 / 118 兩列。

### 發現的問題

1. **公開 repo 去識別化（D176）違規，既有**：`_ct-workorders/BUG-134-empty-workspace-shows-other-terminal.md` 第 28 行「回報者」欄位寫的是真名，不是代稱。本單不改 BUG 單（工單規定），建議塔台依 `.private/` 對照表改成代稱，並在下次 push 前的檢查樣式掃描一併確認。
2. **重跑沒有發現任何 FAIL**：14 支既有 e2e 在 HEAD 全綠，沒有產品回歸，也沒有過時的測試。
3. **新增 spec 首版情境設計錯誤（已修，不是產品問題）**：`t0738-thumbnail-cursor-rows` 第 1 版在畫面上方畫三列，ConPTY 把清畫面後的整個畫面以 `\r\n` 重畫（下方 24 列空白），預覽最後 8 行全空 → 失敗 2 次（其中一次是抓 raw 輸出的除錯跑）。這是預覽的正確行為。改成「先畫點、800 ms 後原地覆寫底部三列」，ConPTY 才會送出 `CSI 24;3H` 等游標移動且不帶換行（spec 內先斷言 raw 輸出確實如此）。順帶觀察：ConPTY 會把 `\x1b[>0q\x1b[>4m` 原樣轉送給 BAT。
4. **BUG-127 / BUG-131 的新 spec 沒有對修正前版本驗紅**：要驗紅得另開 checkout 建置修正前的版本，超出本單成本。BUG-175 以 `git show` 取修正前的純函式離線比對，確認新 spec 的斷言會抓到修正前的症狀。
5. **證據強度註記**：`_archive/state-snapshots/2026-Q4.md` 記的「BUG-146 / 147 PASS」，T0581 實機只跑了「保留」路徑；BUG-147（重新開始）的依據是 t0578 fresh start e2e，不是實機。
6. **CI 不跑 e2e**：`tests.yml` 只跑 `test:unit` / `test:legacy`，所有 e2e 只在 Worker 本機跑。本單 A 類的 e2e 依據都是「本單在 HEAD 本機重跑」，不是 CI。
7. **暫存**：本單的暫存（`%TEMP%\t0738-*`、各 spec 的 `bat-t0738-*`、隔離 userData `BetterAgentTerminal-runtime-e2e-*`）都已刪除，確認 0 個殘留。`%TEMP%\bat-t0718-dvKCbj\` 不是本單建立的（T0718 的殘留），沒有動。`e2e-results/` 是 `.gitignore` 內的 Playwright 輸出目錄，保留。

### A 類結案建議

依 R-G003「修正已進入客戶交付版，或已在測試環境實測過 → `CLOSED`，註明驗證依據」。以下 12 張的修正都已在交付的預覽版內，驗證依據：

| BUG | 驗證依據（建議寫進 `closed_reason`） |
|---|---|
| BUG-116 | 修正 v0.6.0-pre.3；外部測試者A mac 實機 pre.5–pre.7 正常啟動並使用數小時（T0526 判讀）；v0.7.2-pre.8 CI mac 打包檢查 whisper.node 在 `dist/mac-arm64/`。殘留：語音轉寫未實機驗 |
| BUG-118 | 修正 v0.6.0-pre.3；v0.7.2-pre.8 CI（run 41277080514）mac / linux 打包檢查內嵌 claude 皆在；T0516 WSL 解 AppImage `claude --version` PASS |
| BUG-127 | 修正 v0.6.0-pre.8；T0738 新增 `t0738-ct-panel-switch-toasts` 在 HEAD `e0588e55` PASS ×3 |
| BUG-129 | 修正 v0.6.0-pre.8；`t0523`、`t0529` 在 HEAD PASS（D141 原訂等外部回饋，由塔台決定是否仍等） |
| BUG-131 | 修正 v0.6.0-pre.8；T0738 新增 `t0738-recovery-keeps-env` PASS ×3、`t0539` PASS |
| BUG-132 | 修正 v0.6.0-pre.9（cwd 守門範圍）；`t0523` 在 HEAD PASS |
| BUG-133 | 修正 v0.6.0-pre.10；`t0530` 在 HEAD PASS |
| BUG-134 | 修正 v0.6.0-pre.11；`t0531` 在 HEAD PASS（有修正前紅的紀錄） |
| BUG-137 | 修正 v0.6.1-pre.3；`t0539` 在 HEAD PASS |
| BUG-146 | 修正 v0.7.0-pre.1；`t0578`（2）、`t0580` 在 HEAD PASS；T0581 安裝版實機「保留」路徑 |
| BUG-147 | 修正 v0.7.0-pre.1；`t0578` fresh start 在 HEAD PASS |
| BUG-171 | 修正 v0.7.1-pre.8；`t0704` 在 HEAD PASS（時鐘跳動 / server 暫停 / 隔離 server 死亡三段） |

另有兩張「Windows 部分已足以結案、mac 部分需實機」，歸 C：BUG-130、BUG-175。塔台可選擇拆成「Windows 結案＋mac 待辦」。

### B 類後續候選

本單已補的 3 支（BUG-127 / 131 / 175）不再列。以下由塔台開單；每項 ≤ 1 個情境、本機 Windows、不需 LLM / Docker / 剪貼簿（另有註明者除外）：

| 優先 | BUG | 情境與做法 |
|---|---|---|
| 1 | BUG-135 | 隔離實例兩個工作區 A / B，各有終端；把 B detach → 在主視窗切到 A 並聚焦 A 的分頁 → 關閉 B 的 detached 視窗（收回）→ 斷言主視窗的 active 工作區仍是 A、focused terminal 屬於 A（讀 `workspace.load()` 與 `.workspace-container.active .terminal-wrapper.active`）。可沿用 `detached-close-edges.spec.ts` 的 detach / close 寫法 |
| 2 | BUG-156 | 不建容器：隔離實例的 RemoteServer 綁在 `remotePort`，另佔一個 port；呼叫精靈「建立新容器」選 port 的 IPC（T0649 的 `docker.pickServerPort` 一類，開單時先確認名稱）→ 斷言回傳值既不是 RemoteServer port，也不是被佔的 port。不呼叫 docker |
| 3 | BUG-108 | 本機視窗：tmpdir 內一張 PNG，以 `setInputFiles` 真檔合成 drop 到 Claude 面板輸入區、另以 stub `dialog.selectAttachments` 選 tmpdir 外的圖 → 斷言附件縮圖出現、沒有 `denied`（不送訊息）。若要涵蓋貼上路徑需寫剪貼簿，比照 t0524 備份還原 |
| 4 | BUG-107 | 本機視窗：`setInputFiles` 真檔合成 drop 到終端分頁 → 斷言 PTY 收到含真實路徑的字串（`webUtils.getPathForFile`）。真實檔案總管拖放仍需人工 |
| 5 | BUG-159（子項） | 只驗注入：關 BAT MCP、開手動 codex 分頁（PATH 上 codex 0.166.0）→ 斷言 debug log `→ injected: --no-daemon`（或命令列含 `--no-daemon`）。不需登入、提權下可跑；daemon 行為本身仍是 C |

### C 類需要的環境

| BUG | 需要什麼 |
|---|---|
| BUG-105 | WSL profile 視窗或 Docker / SSH 遠端視窗（`\\wsl.localhost\…` 與 `C:\…` 工作區）；Git Graph / worktree 步驟不需模型，`claude:start-session` 後 `pwd` 那步需真實 Claude 登入。可用 `pre6-ui-remote-acceptance.spec.ts` U4（需 Docker engine 執行中＋`t0514-env.mjs up`），何時啟動 Docker 由使用者決定 |
| BUG-111 | 執行中的 Docker engine＋使用者事先建立的容器（驗「使用既有容器」取消後容器 / `/opt/bat-server` 仍在）；`pre6-wizard-acceptance.spec.ts` W8 的 Docker 側 |
| BUG-128 | macOS 實機（Finder 複製檔案 → 終端 Cmd+V）；T0522 已有給外部測試者A 的步驟 |
| BUG-130（mac 部分） | macOS 實機（剪貼簿有圖時 Ctrl+V → claude CLI 收到 `\x16`）；T0524 已有步驟 |
| BUG-159 | 一般權限（UAC 開啟）的 BAT＋BAT MCP 關閉＋PATH 上 codex ≥ 0.156.0＋真實 codex 登入；兩個分頁各跑 codex，讓 codex 執行 `node -e` 印 `BAT_TERMINAL_ID`，確認各自是自己的值。本機 BAT 是提權執行，無法驗 |
| BUG-175（mac 部分） | macOS 實機開 claude Worker 分頁，看縮圖跟著重畫、沒有 `>0q>4m`；GitHub #22 回報者 / 外部測試者A |
| 殘留（A / B 類附註） | BUG-116 語音轉寫：mac 實機＋whisper ggml 模型；BUG-107 真實 OS 拖放：人工；BUG-107 / 108 遠端部分：WSL 或 Docker 遠端 |

### 子代理與 Workflow 使用

| 種類 | 數量 | 用途 | 唯讀（怎麼保證） | tokens | 備註 |
|---|---|---|---|---|---|
| 子代理（Agent 工具） | 3 | 平行讀 22 張 BUG 單與修正工單回報區（各 7 / 8 / 7 張），整理修正 commit、首發版、測試檔路徑、實機紀錄 | 是（Explore＋prompt 明令禁止寫入與改狀態指令，只允許唯讀 git） | 331,834（工具回報：91,764＋127,496＋112,574） | 主 agent 抽查：10 個修正 commit 的首發版以 `git tag --contains` 重查一致；BUG-116 的 T0526 mac 日誌證據、BUG-131 BUG 單、t0524 剪貼簿還原、t0704 殺 server 方式、BUG-134 回報者欄位都親自讀過 |

### 互動紀錄

- 無使用者介入；yolo 模式，沒有向塔台提問（判讀問題都能從工單、BUG 單與程式碼決定）。

### 回報時間

- 開工：2026-11-01T18:05:04+0800
- 完成：2026-11-01T18:25:02+0800
