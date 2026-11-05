---
schema_version: 1
schema_kind: workorder
id: T0862
title: "PLAN-065 W6：Windows 真實升級驗收（windows-upgrade-acceptance.yml＋spec、兩個 desktop-build 版本跑情境 1–7）、nsis 驗收腳本加 holder 檢查、docs / CLAUDE.md"
type: implementation
status: DONE
started_at: "2026-11-05T08:12:14+08:00"
updated_at: "2026-11-05T09:32:36+08:00"
completed_at: "2026-11-05T09:32:36+08:00"
session_ids:
  - "ed13b88e-894a-4220-9882-9f1f0072fef4"
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: M
created_at: "2026-11-04T18:28:20+0800"
depends_on: [T0858, T0859, T0860, T0861]
related:
  - "PLAN-065；D286；T0856 回報區〈調查結論〉Q7 與〈建議下一步〉W6；T0820（Windows runner 實測做法）；T0783（`desktop-build.yml`）；T0797（手動驗收 workflow 前例）；T0740 / T0801（`e2e/manual/nsis-reinstall-acceptance.ps1`）"
affects_files:
  - _ct-workorders/T0862-windows-upgrade-acceptance-workflow.md
  - .github/workflows/windows-upgrade-acceptance.yml
  - e2e/
  - e2e/manual/nsis-reinstall-acceptance.ps1
  - docs/agent-guide/pty-holder.md
  - docs/agent-guide/README.md
  - docs/agent-guide/terminal-server-recovery.md
  - CLAUDE.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 這是發第一個有 holder 的版本（`0.7.5-pre.1`）前唯一能驗證該版解除安裝程式與 quit 行為的關卡：情境 1–7 全部 PASS 才算 DONE；任何一項 FAIL → 回報 PARTIAL / FAILED 並寫清楚證據，不得自己改產品程式（另開單由塔台決定）。"
  - "🔴 workflow：只 `workflow_dispatch`、唯讀權杖、不傳任何 secret、不建 tag / GitHub Release / `server-bundle-v*`、不部署 Pages、不放進發版關卡（比照 `docker-acceptance.yml` / `linux-acceptance.yml`）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 push 與觸發 workflow：派工時另行授權（見下方〈塔台授權〉）；未授權前只寫 workflow 與 spec、在本機做能做的檢查，跑 CI 的部分列〈待授權〉。"
  - "🔴 L185：情境 7 以 `<INSTDIR>\\BetterAgentTerminal.exe`＋`ELECTRON_RUN_AS_NODE` 跑計時器模擬內嵌 claude，不開真的 claude / codex、不登入任何服務、不呼叫模型。回報不記權杖或環境變數值（只記名稱）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。不碰本機 BAT 安裝版，不在本機執行任何安裝檔。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0862 — PLAN-065 W6：Windows 真實升級驗收

## 元資料
- **工單編號**：T0862｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 18:28 (UTC+8)
- **規模**：M｜**決策**：D286｜**依賴**：T0858、T0859、T0860、T0861（workflow 骨架可以先寫）

## 背景
第一個有 holder 的版本 N 的解除安裝程式與 quit 行為，要到 N → N+1 升級時才會執行，發佈後就改不了（T0856 Q4 / Q7）。所以發 `0.7.5-pre.1` 前，必須用同一分支打出的兩個 `desktop-build` 版本（`0.0.0-exp.<run>`，兩次自然不同版號）實際跑過升級。

## 任務
1. `.github/workflows/windows-upgrade-acceptance.yml`：輸入兩個 desktop-build run id（A、B），在 Windows runner 跑下面的情境，結果寫進 job summary 與 artifact。
2. spec（Playwright＋`Get-CimInstance`，比照 T0820）涵蓋：
   1. per-user `/S /currentuser` 從 A 升到 B；
   2. per-machine `/allusers`；
   3. 同版重裝；
   4. 從 B 降回 A；
   5. 從 B 降到現行正式版 `0.7.4-pre.9`（沒有 holder）：終端結束並走既有的 recovery / 說明，不卡住；
   6. 真的解除安裝：holder 結束、holder 根目錄刪除、userData 保留；
   7. 分頁裡有安裝目錄下的程序（模擬內嵌 claude）：BAT 先結束它並記錄，安裝程式不需要等 15 s。
   每個情境檢查：shell 與長命令（`ping -t`）的 pid 升級前後相同、conhost 還在、holder 的路徑、重開後有紀錄的情境沒有 Recovery 提示、新版接回後持續收到輸出、toast 文字、holder 目錄的清理。
3. `e2e/manual/nsis-reinstall-acceptance.ps1` 加 holder 檢查（holder 目錄與 manifest；有開分頁時 pid 不變），沒有 holder 的版本照舊判讀。
4. 文件：新增 `docs/agent-guide/pty-holder.md`（整體架構、holder 位置、協定 v1 摘要、安裝 / 解除安裝 / 升級 / 降級流程、已知限制、驗證清單），`docs/agent-guide/README.md` 索引；`CLAUDE.md` 新增一節（照撰寫規則：用途、必守規則、唯一實作位置、不變式、連到 docs）。

## 塔台補充（開工前，T0863 收單後 2026-11-04 19:29）

- T0863（BUG-212）起 `UpdateNotification` 真的會掛載，主行程啟動時查一次 GitHub。`desktop-build.yml` 打出的 `0.0.0-exp.<run>` 一定比 GitHub 上的 release 舊，**更新對話框會出現**並擋住畫面。驗收 spec 啟動 BAT 前要在該 runtime 的 `settings.json` 寫 `checkForUpdates: false`（既有 e2e 的寫法），或明確處理這個對話框。
- `CLAUDE.md` 一節也補一行「從 PTY holder 啟動」的必守規則（T0859 後續建議 1），連到 `docs/agent-guide/terminal-server-recovery.md`「從 PTY holder 啟動」。

## 塔台補充（開工前，T0860 收單後 2026-11-05 07:36）

- T0864（D288）之後，只寫 `checkForUpdates: false` 不夠：沒有一次性標記時會被當成開。關掉更新對話框要照 T0864 回報區寫明的標記鍵一起寫（既有 5 個 e2e spec 的新寫法）。
- T0860 回報區〈待 W6 驗收〉列入本單情境（已在情境 1–7 內的對應即可，不在的補進）：① N → N+1 真實升級時 N 的 BAT 保留 holder、安裝程式不跳第二次「正在執行」；② N 的解除安裝程式以 `--updated` 執行時不碰 holder；③ `customInstall` 保留執行中的 N holder 目錄；④ 升級後 holder pid 不變、分頁輸出持續；⑤ 真的解除安裝（per-user；per-machine 能做就做）holder 結束、根目錄被刪，根目錄有程序在跑時保留並有 `DetailPrint`；⑥ 降級（N+1 → N）；⑦ 內嵌 claude 實機：被結束後分頁 shell 回到提示列、清單恢復正常。`e2e/t0860-installer-quit-holder.spec.ts` 可當基礎。

## 塔台補充（開工前，T0861 收單後 2026-11-05 08:09）

- T0861（`9e8b26f0`）〈待 W6 驗收〉列入本單情境：① 版本不同的 N → N+1 自動接回與 `app.upgradeReattached` 文字（T0861 e2e 只驗到同版的 `app.upgradeReattachedSameVersion`；A → B 兩個 exp build 版號不同，正好驗這個）；② D5 不相容實機（降級到協定不同的版本 = 情境 5、權杖不符能做就做）：舊 holder 與 PTY 樹被結束、顯示「升級結束了 N 個終端」、agent 分頁進清單；③ D6：holder 存活但 0 個 PTY 且版本較舊 → 換新（重開後 holder pid 改變、版本 = 新版）；④ per-machine（情境 2）若 UAC 強制結束而沒有紀錄 → Recovery 提示照舊出現，寫明實際結果。
- T0861 e2e `e2e/t0861-holder-reattach.spec.ts` 也可當基礎（接回後無 Recovery 提示、同 holder pid / 同 shell pid、只有一個 shell）。
- 範圍追加 `docs/agent-guide/terminal-server-recovery.md`：補「從 PTY holder 啟動」一節要連到的內容，並補一句 Windows 上 D5 會強制結束仍在跑的不可用 server（日誌 `unusable server ended with its PTY trees (taskkill): …`，T0861 後續建議）。

## 塔台授權
（派工時由塔台填寫：可否 push 分支、可否觸發 `desktop-build.yml` 兩次與本 workflow。）

**使用者 2026-11-05 08:10 全部授權（D289）**：
- 塔台已 push `main`（`b203f56b..18325d1c`，push 前去識別化與金鑰檢查 0 筆）。
- ✅ 可 push 到 `origin main`：本單的 workflow、spec、文件與修正（`gh workflow run` 手動觸發需要 workflow 檔在預設分支上）。每次 push 前跑 `_local-rules.md`「公開 repo 去識別化」的金鑰樣式檢查（`sk-ant-`、`ghp_`、`github_pat_`、`AKIA`、`AIza`、`PRIVATE KEY`、真的 `batcap.` 權杖）與家目錄路徑檢查，結果寫進回報區。不得 force-push。
- ✅ 可觸發 `desktop-build.yml`（產出 A、B 兩個版本）與 `windows-upgrade-acceptance.yml`；失敗可修正後重跑，**各上限 5 次**，超過就停下來問塔台。
- 🔴 所有 `gh` 指令帶 `-R gowerlin/better-agent-terminal`（L122）。不建 tag、不建 GitHub Release、不跑 `pre-release.yml` / `release.yml`、不部署 Pages、不動 repo 設定或 secret。
- 🔴 不得在本機安裝任何安裝檔、不碰本機 BAT 安裝版與它的 Terminal Server（情境全在 GitHub runner 上跑）。
- 情境 1–7 全 PASS 才算 DONE；有情境做不到或 FAIL → PARTIAL，寫明哪個情境、run id、證據，不要為了過關改產品行為（產品修正要另開單，先問塔台）。

### 驗收條件
- [x] 情境 1–7 全部 PASS（附 run id 與 summary）
- [x] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [x] CLAUDE.md ≤ 100k 字元（回報實際字元數）
- [x] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：DONE —— 情境 1–7 全部 PASS（另加塔台補充要求的 8 = D6、9 = D5，也 PASS），本機五項門檻全過。
- **驗收 run**：`41947695334`（`windows-upgrade-acceptance.yml`，head `3d8139ea`，conclusion **success**；attempt 1 情境 1–6、8、9 PASS，attempt 2 只重跑情境 7 → PASS，原因見〈遭遇問題〉3）。
- **A / B**：desktop-build run `41940986956`（A = `0.0.0-exp.10`）、`41941001576`（B = `0.0.0-exp.11`），兩者都建自 `main` `18325d1c`（含 T0861），`checks=false`（typecheck / tests 在本機跑）。holder key 兩版相同 `24.22.2-ec44482acf96`。
- **產品 commit**：`5efee3bc`（workflow＋spec＋nsis 腳本＋docs＋CLAUDE.md）、`d450044d`（情境 1 加「有程序在跑的目錄保留」、記兩個 key）、`c72247e5`（spec 改以 spawn＋CDP 啟動 BAT）、`3d8139ea`（情境 7 的分頁回報 SessionStart）。已 push `origin main`（`18325d1c..3d8139ea`，無 force）。
- **沒有改任何產品程式**（`electron/`、`src/`、`build/`、`scripts/` 都沒動）。
- **session_id**：ed13b88e-894a-4220-9882-9f1f0072fef4

### 落點檢查

- **PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。C-1：工單在 REPO_ROOT 下 → PASS。C-3：`affects_files` 可測項目都存在或祖先存在（資訊性）。C-2：沒有 `branch` 欄位。`CT_HOME` 未設定（不是 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- 模式：`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`；`BAT_REMOTE_TOKEN` 已設定。

### 情境結果（run `41947695334`，artifact `windows-upgrade-acceptance-41940986956-41941001576-s<n>-attempt<k>`，7 天）

| # | 情境 | 結果 | 主要證據 |
|---|---|---|---|
| 1 | per-user A → B（`/S /currentuser`） | ✅ PASS（32 項） | BAT 在安裝程式開始後 2–4 s 結束（< 15 s，沒有第二次「正在執行」/ 強制結束）；holder（`%LOCALAPPDATA%\BAT-PtyHolder\24.22.2-ec44482acf96\bat-pty-holder.exe`）、shell、`ping -t`、conhost 的 pid 安裝前後相同；安裝後安裝目錄下沒有任何程序；紀錄 schema 2 `holderKept` / `holderPid` 相符；A 的日誌 `quit without confirmation (stopTerminalServer=false, PTY holder kept)`；跑著的 key 目錄完整（N 的 `--updated` 解除安裝與 `customInstall` 都沒碰）；根目錄裡放的沒有程序的目錄被刪、有程序在跑的目錄保留（D9）。重開 B：沒有 Recovery 提示（DOM 與 `queryPendingRecovery`）、toast `BAT was upgraded (v0.0.0-exp.10 → v0.0.0-exp.11). 1 terminal kept running during the install and was reconnected.`、日誌 `reconnecting without the Recovery prompt` 與 `reattached: previous=0.0.0-exp.10 current=0.0.0-exp.11`、同 holder / shell pid、holder 下每分頁一個 shell、ping 輸出持續增加、Ctrl+C 後同一個 shell 回應指令 |
| 2 | per-machine A → B（`/S /allusers`）＋ per-machine 真的解除安裝 | ✅ PASS（35 項） | 同 1，holder 在 `%ProgramFiles%\BAT-PtyHolder`、uninstall 鍵在 HKLM。解除安裝時另有程序從根目錄執行：BAT 結束、holder 結束、**根目錄保留**（in-use 分支）、安裝目錄刪除、userData 保留。runner 已提權 → `/allusers` 沒有 UAC inner instance（見〈未驗到〉） |
| 3 | 同版重裝 B → B | ✅ PASS（29 項） | 接回、toast `app.upgradeReattachedSameVersion`、同 pid、輸出持續 |
| 4 | 降級 B → A | ✅ PASS（29 項） | A 的安裝程式送請求、B 保留 holder、B 的 `--updated` 解除安裝不碰；A 接回、toast `app.upgradeReattached`（v0.0.0-exp.11 → v0.0.0-exp.10）、同 pid |
| 5 | 降級 B → `0.7.4-pre.9`（沒有 holder） | ✅ PASS（12 項） | 安裝 exit 0、B 在 15 s 內結束（pre.9 的安裝程式有 T0823 標記處理，送 `--installer-quit-request`，B 保留 holder）；pre.9 啟動、分頁 60 s 內能執行指令、原 shell 與 ping 已結束。實際路徑（日誌）：`installer-quit-record.json unreadable — ignored`（schema 2 在 pre.9 = invalid）→ TCP 連上 holder（沒有 hello，被 v1 holder 關閉）→ `Killed 1 orphan PTY(s) from registry` → `re-forking after the Terminal Server was found dead` → 新 shell。**沒有 Recovery 提示、沒有升級 toast**（`[upgrade-interruption] none`）；B 的 holder 已結束（沒有殘留） |
| 6 | per-user 真的解除安裝 | ✅ PASS（14 項） | BAT 結束、holder 結束、shell / ping 結束、`%LOCALAPPDATA%\BAT-PtyHolder` 刪除、安裝目錄刪除、userData（`settings.json`、`Logs`）保留、pid 檔清掉、uninstall 鍵移除 |
| 7 | A → B，分頁裡有內嵌 agent 替身 | ✅ PASS（39 項，attempt 2） | 替身 = 安裝目錄的 `BetterAgentTerminal.exe`＋`ELECTRON_RUN_AS_NODE` 跑計時器（L185：沒有 claude / codex、沒有登入或模型呼叫）。A 的日誌 `ended 1 agent process(es) under the install directory in 1 tab(s)`；BAT 3 s 內結束（安裝程式不需等 15 s）；紀錄 `endedAgentProcesses: [{ terminalId: <agent 分頁>, processes: 1 }]`、`claudeSessions` 含該分頁；兩個分頁的 shell 存活。重開：toast `… 2 terminals kept running during the install and were reconnected. 1 agent tab was interrupted — click to review`、清單列出該分頁（`agent: claude-cli`、cause upgrade）、替身沒有回來、該分頁 shell 回到提示列並回應 `echo`、略過後清單清空 |
| 8 | D6：A → B，holder 有 0 個 PTY | ✅ PASS（12 項） | 日誌 `has no PTYs and runs v0.0.0-exp.10 (this is v0.0.0-exp.11) — replacing it`、舊 holder 結束、新 holder pid 從根目錄啟動、`[pty-holder] Terminal Server from holder … (per-user)`、沒有 Recovery 提示 |
| 9 | D5：A → B 後權杖檔不符 | ✅ PASS（20 項） | 日誌 `hello unauthenticated — ending it`、`[upgrade-interruption] detected: … incompatible`；`server:shutdown`（權杖錯）沒結束 → Windows 以 taskkill 連同 PTY 樹結束（`unusable server …`）；舊 holder / shell / ping 結束；toast `app.upgradeInterrupted`（1 terminal、兩個版本）；分頁有新 shell 並回應指令 |

塔台補充對照：T0860〈待 W6〉① = 情境 1（不跳第二次「正在執行」以「BAT 在 15 s 內結束、安裝目錄沒有程序」為證；`/S` 下對話框本身看不到）；② = 1、4（holder 目錄與 pid 不變）；③ = 1（同 key 時 `customInstall` 視為最新而不動；不同 key 目錄有程序在跑時保留，以放進去的 in-use 目錄驗證）；④ = 1–4、7；⑤ = 6（per-user 刪除）、2（per-machine，根目錄有程序在跑 → 保留）；⑥ = 4、5；⑦ = 7。T0861〈待 W6〉① = 1、4（`app.upgradeReattached` 版本不同文字）；② = 5（降級到協定不同的版本）、9（權杖不符）；③ = 8；④ = 2（runner 已提權，見下）。T0863 / T0864：每次啟動前在 `settings.json` 寫 `checkForUpdates: false`＋`checkForUpdatesMigrated: true`，九個情境都沒有出現更新對話框。

### 未驗到（如實記錄）

- **per-machine 需要 UAC 的互動升級**（T0861 ④：UAC 強制結束、沒有紀錄 → Recovery 提示）：GitHub runner 是已提權的，`/allusers` 沒有 inner instance，走的是與 per-user 相同的正常結束路徑。這條路只能在未提權的實機互動安裝驗。
- 安裝程式的 `DetailPrint` 與「正在執行」對話框：`/S` 下看不到，以程序與目錄狀態代替。
- 真的內嵌 claude 被結束（L185 不開）：以安裝目錄下的同一個 exe 當替身，路徑判斷與真的 claude 相同（T0860 的判斷只看路徑）。

### 其他產出

- **`e2e/manual/nsis-reinstall-acceptance.ps1`**：有 holder 的版本（安裝目錄有 `resources\pty-holder\holder-manifest.json`）在 ②④（與 `-DryRun` 的 ②p）檢查 `<根目錄>\<key>\holder-manifest.json` 與安裝目錄那份位元組相同、`bat-pty-holder.exe` 存在、其他沒有程序在跑的 key 目錄（WARN）；⓪ 記錄執行中的 holder 與它的子程序，有的話 ② 檢查這些 PID 覆蓋安裝後不變、③ 檢查 holder 結束與根目錄刪除（有程序在跑 → WARN），userData 比對不含 Terminal Server 自己的 pid / port / token / registry 檔；沒有 holder 的版本只記一行、照舊判讀。parse 0 錯、沒帶 `-Version` 照舊 exit 2、`scripts/__tests__/nsis-reinstall-acceptance-version.test.mjs` 17 項 PASS。**沒有**在本機以 `-DryRun` 跑（會讀本機安裝版；工單禁止碰）。
- **文件**：新增 `docs/agent-guide/pty-holder.md`（架構與元件表、holder 位置、協定 v1 摘要、安裝 / 升級 / 同版 / 降級 / 解除安裝 / 不相容 / 換新的流程表、已知限制、驗證清單與 W6 情境表與指令）；`docs/agent-guide/README.md` 索引一列；`terminal-server-recovery.md`「從 PTY holder 啟動」加連到總覽與 Windows D5 強制結束（`unusable server ended with its PTY trees (taskkill): …`）兩點；`CLAUDE.md` 新增「Windows PTY holder（PLAN-065 / T0862，D286）」一節（5 點：用途、從 PTY holder 啟動的必守規則、holder 不變式、唯一實作位置、W6 驗收時機，連到 docs）。
- **CLAUDE.md 字元數**：83,545（≤ 100k）。

### 驗證（本機）

| 門檻 | 結果 |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run typecheck:electron` | exit 0 |
| `npx vite build` | 成功 |
| `npm run test:unit` | 452 檔 PASS / 3 skipped，8285 項 PASS / 40 skipped |
| `npm run test:legacy` | 33 檔、472 項 PASS |
| spec | `tsc --noEmit --strict`（單檔）exit 0；本機 `playwright test` → 1 skipped（只在 runner 執行） |

- 門檻跑在 `5efee3bc` 的內容上（跑的時候尚未 commit，內容相同）；之後的 `d450044d` / `c72247e5` / `3d8139ea` 只改 `e2e/t0862-*.spec.ts`（不在 vitest / legacy 範圍）與 `docs/agent-guide/pty-holder.md` 一句，spec 每次都重跑單檔 tsc。

### push 前檢查

- 每次 push 前對 `origin/main..HEAD` 的 diff 掃金鑰樣式（`sk-ant-`、`ghp_`、`github_pat_`、`AKIA`、`AIza`、`PRIVATE KEY`、`batcap.` 權杖）與家目錄路徑、`.private/` 的去識別化樣式：**0 筆**真實命中（唯一的命中是 workflow 刪檔步驟裡的檢查 regex 本身，以及本工單授權段落的文字）。共 4 次 push，都不是 force。
- 第一次 push 同時帶上塔台在本機的 `61380291`、`eb22ac69`（`(ct)` 記帳 commit，已在 main 上）。

### workflow 使用次數（上限各 5）

- `desktop-build.yml`：2 次（A `41940986956`、B `41941001576`）。
- `windows-upgrade-acceptance.yml`：3 次 dispatch ＋ 1 次 `--failed` 重跑 = 4 次：`41942234283`（情境 6 PASS，其他 8 個卡住，見〈遭遇問題〉1）、`41946714979`（8/9 PASS，情境 7 的一項預期寫錯，見 2）、`41947695334` attempt 1（8/9，情境 7 安裝程式崩潰，見 3）＋ attempt 2（情境 7 PASS）。

### 遭遇問題

1. **Playwright `ElectronApplication.close()` 在升級後永遠不回來**（run `41942234283`）：Playwright 等被啟動程序的 `close` 事件，要所有 stdio pipe handle 都關閉；BAT 主行程從 Playwright 繼承了可繼承的 pipe handle，它啟動的 holder 又繼承下去，而 holder 在升級後保留 → 測試卡到 30 分鐘逾時。產品行為（BAT 2.4–4 s 內結束）是對的。修正：spec 改以 `spawn`（`stdio: 'ignore'`）啟動 BAT、經 CDP（`--remote-debugging-port`）操作視窗，版本從 `electronAPI.update.getVersion()` 取。使用者從檔案總管 / 開始功能表啟動沒有這些 pipe；記為觀察：holder 會繼承 BAT 主行程可繼承的 handle（見〈後續建議〉2）。
2. **情境 7 的清單預期寫錯**（run `41946714979`）：替身分頁是一般終端（沒有 `agentPreset`、沒有 claude session），`buildInterruptedAgentSnapshot` 依設計（T0766 `wasRunningAgent`）不列。claude-cli 分頁會啟動真的 claude（L185），所以改成讓分頁經安裝版的 `bat-hook.mjs` 回報 `SessionStart`（自己產生的 UUID，等於 helper 派工的 claude Worker 在 BAT 眼中的樣子）；之後清單如預期列出（`agent: claude-cli`）。
3. **情境 7 attempt 1：安裝程式 A 一啟動就崩潰**（exit `3221225477` = `0xC0000005`，1.3 s，還沒有任何 BAT 程序）：同一個安裝檔在同一 run 的其他 8 個 job 與前兩次 run 都正常 → 判定 runner 偶發，以 `gh run rerun --failed` 只重跑情境 7，PASS。

### 互動紀錄

- [08:12] 開工；讀到三段塔台補充（T0863 / T0860 / T0861 收單後），全部納入情境與文件範圍。之後三個節點（驗證前、產品 commit 前、填回報前）都沒有新段落。
- 沒有提問塔台（yolo）。

### 子代理與 Workflow 使用

- 沒有使用子代理，也沒有使用 Workflow 工具（「workflow」指的是 GitHub Actions，依〈塔台授權〉觸發）。

### 後續建議（塔台判斷）

1. **情境 5（降級到 pre.9）沒有任何說明**：終端被結束後只有分頁換成新 shell，沒有 Recovery 提示也沒有 toast（pre.9 把 schema 2 紀錄當 invalid、走 T0704 recovery）。pre.9 已發佈、改不了；若要說明只能從新版的更新通知 / 版本說明提醒「降級到 0.7.4-pre.9 會結束所有終端」。建議寫進第一個有 holder 的版本的更版重點〈已知事項〉。
2. **holder 繼承 BAT 主行程可繼承的 handle**（遭遇問題 1 的根因）：對使用者無影響（沒有 pipe），但 BAT 從其他程式（終端、啟動器、IDE）帶 pipe 啟動時，保留的 holder 會讓那個呼叫端等不到 `close`。是否在 holder `spawn` 時避免（例如 Windows 上不讓 holder 繼承 stdio 以外的 handle）由塔台決定是否開單；本單未改產品。
3. **per-machine 未提權的互動升級**（UAC inner instance）只能實機驗，建議列入發版前的手動驗收清單（`docs/agent-guide/pty-holder.md` 已寫在已知限制）。
4. 發 `0.7.5-pre.1` 前若改了 holder 相關程式，用同樣兩個步驟重跑 W6（指令在 `pty-holder.md`）；desktop-build artifact 只留 7 天。
