# Tower State — better-agent-terminal

> 最後更新：2026-04-17 15:15 (UTC+8)（🎯 T0147 DONE — BUG-033 → VERIFY，等 T0145 打包驗收合併覆蓋）

---

## 🛏 本 Session 退出快照（2026-04-17 14:22）

**退出原因**：使用者手動 rebuild + 換版 BAT（塔台當前在 BAT 裡跑，重裝會斷 session）

**恢復指引**（下次 `/control-tower` 啟動時）：
1. Fast Path 載入此快照（快照 <24h）
2. 檢查 `git status` 確認 meta 變更狀態（可能已由使用者自行 commit，或仍 uncommitted）
3. 檢查 `git log -1` 確認最新 commit（應為 `412d52c` 或之後使用者的 meta commit）
4. 若 BAT 已換新版 → 新 session 在 BAT 內（`BAT_SESSION=1`）→ 派 T0145 驗收
5. 若尚未換版 → 提醒使用者 `npm run build:win` + 重裝

**當前狀態凍結**：
- T0144 ✅ DONE (commit 412d52c by Worker，14:18)
- PLAN-012 實作完成，等 T0145 驗收
- BUG-032 🚫 CLOSED（T0143 Task B 驗證通過）
- **9 檔塔台 meta uncommitted**（見下方清單）

**未 commit 清單**（塔台建立/修改，尚未進入 git history）：
```
modified:  _ct-workorders/_backlog.md              (PLAN-012 加入)
modified:  _ct-workorders/_bug-tracker.md          (BUG-032 移至 CLOSED)
modified:  _ct-workorders/_tower-state.md          (本檔，decisions/起手式)
modified:  _ct-workorders/BUG-032-...md            (CLOSED + D036)
modified:  _ct-workorders/PLAN-012-...md           (翻盤描述)
modified:  _ct-workorders/T0142-...md              (MERGED → DONE)
modified:  _ct-workorders/T0143-...md              (Worker 已 commit 為 215e8757，塔台這端可能還有微調)
new:       _ct-workorders/T0144-...md              (塔台建立 + Worker 補回報)
new:       _ct-workorders/T0145-...md              (塔台建立，驗收工單)
```

**建議 commit 訊息**（下次恢復後提供給使用者）：
```
chore(ct): PLAN-012 + BUG-032 meta (D033-D037)

- BUG-032 → CLOSED (T0143 Task B all-green)
- T0142 → DONE (merged into T0143)
- PLAN-012 strategy: native Electron dialog (D035)
- T0143 DONE (research, Worker commit 215e8757)
- T0144 DONE (impl, Worker commit 412d52c)
- New: T0145 acceptance workorder pending
```

---

## 🌅 起手式（Quick Recovery）
> 最後更新：2026-04-17 17:12 UTC+8

### 🎉 PLAN-012 全案結案（2026-04-17 17:12）— 5 BUG 批次 CLOSED
**收官**：使用者 rebuild + 重裝後實測 T0145 情境 1-5 + 8 + 9 全綠，D044 批次結案：
- **PLAN-012** ✅ DONE（Quit Dialog + CheckBox 主動關 server，四路徑一致）
- **BUG-031** 🚫 CLOSED（外部 PTY workspace 分配）
- **BUG-033** 🚫 CLOSED（托盤 Quit bypass Dialog）
- **BUG-034** 🚫 CLOSED（checkbox 勾選後 reconnect 路徑 server 未結束）
- **BUG-035** 🚫 CLOSED（watchdog shutdown race 誤 re-fork）
- **T0145/T0147/T0148/T0149/T0150** 全數 DONE

**PLAN-013** 💡 IDEA（🟢 Low）：Installer 檔案鎖定詢問 kill（依 D033 劃出 PLAN-012 範圍，入 backlog）

**本輪最大收穫**：T0144 實作引爆連環 bug（BUG-033 → BUG-034 → BUG-035），每層靠 log 鐵證定位根因，堅守「塔台不改 code」邊界；研究工單（T0146/T0148）+ 修復工單（T0147/T0149/T0150）節奏穩定。

### 🟠 舊起手式（2026-04-17 14:38 存檔，歷史追溯用）

### 🔴 BUG-033 發現（2026-04-17 14:35）— PLAN-012 T0144 regression
**現象**：使用者 rebuild + 重裝新版 BAT 實測 → **從系統托盤 Quit 時完全沒出現 Dialog**，直接退出，Terminal Server 殘留背景（使用者 Q1.A / Q2.D 確認）。
**影響**：T0145 驗收無法進行（Dialog 是所有情境前提），PLAN-012 設計失效，且破壞原版 Quit 行為（regression）。
**行動**：BUG-033 OPEN + T0146 研究工單已派發（允許 Worker 加 trace log 請使用者重測）。

### 🟢 BUG-032 已 CLOSED（2026-04-17 13:58）
T0143 Task B 全綠：`BAT_HELPER_DIR` 正確、helper 可執行、notify exit 0、UUID 路由無 cwd first-match 誤判。Helper packaging + path resolution 修復鏈（T0139/T0140/T0141）驗收通過。

### 🔴 當前焦點：BUG-033 → T0146 研究 → 修復 → T0145 驗收 → PLAN-012 DONE
T0143 研究定調：採 **Electron 原生 `dialog.showMessageBox`**（內建 checkboxLabel）。T0144 實作完成（commit 412d52c）但使用者實測托盤路徑 Dialog 未觸發。

### 🔴 BUG-035 發現（2026-04-17 16:49）— watchdog shutdown race
**現象**：打包版 T0149 實測勾 checkbox 退出，原 server 真的被殺（log `via TCP shutdown`），但 PtyManager heartbeat watchdog 把 TCP close 誤判為 crash，20ms 內 re-fork 出 PID 26412 孤兒 server → 孤兒持 refed TCP socket → main event loop 卡住 → `crashpad-handler` 殘留。
**性質**：pre-existing watchdog（T0108 期間的 crash recovery 邏輯）+ T0149 graceful TCP close 觸發的 race，**不是 T0149 引入**，是 T0149 才讓它顯現化。
**BUG-034 不退回 FIXING**（原始根因 early-return 已修好，log 為證）；開 BUG-035 另案追蹤。
**修復方向**（T0150）：`PtyManager.beginShutdown()` + `attemptRecovery` guard，shutdown 期間跳過 re-fork。根因明確不需研究工單。

### 🟢 BUG-034 已 FIXED（2026-04-17 16:20）— 等 T0145 情境 8 打包驗收
**現象**：打包版 T0147 修好 Dialog 出現（BUG-033 → VERIFY）後，使用者勾選「一併結束 Terminal Server」checkbox 實測 → `terminal-server.js` 子進程 + `crashpad-handler` 殘留；托盤 + File 兩路徑皆中（Q2.A+B）。
**根因**（T0148 確認）：T0144 `stopTerminalServerGracefully()` 只處理 fork 路徑（`_terminalServerProcess` 有值），BAT reconnect 路徑 `_terminalServerProcess=null` → 早退，SIGTERM 從未發出。
**修復**（T0149 commit `cd460d2`）：方案 C — Step A `child.kill('SIGTERM')` → Step B `sendShutdownToServer(port)` TCP shutdown → Step C `waitForPidFileRemoval` 1500ms → Step D Unix `SIGKILL` / Windows `execFile('taskkill', ['/F','/T','/PID', pid])`；各路徑 log `via <method>`，失敗則 `logger.error`。+ `pty-manager.dispose()` 補 destroy tcpSocket（修 crashpad-handler leak 候選）+ 移除 main.ts:1491 誤報 log。
**驗收計畫**：T0145 擴增**情境 8**（4 子情境 8a/8b/8c/8d，涵蓋 fork/reconnect × dev/packaged × 成功路徑 + fallback）→ 使用者 rebuild + 打包驗收。

### 立即待辦（全部完成 ✅，下一輪新起點）
1. ~~T0144 實作~~ ✅ commit `412d52c`
2. ~~T0146 研究（BUG-033 根因）~~ ✅ commit `4bc8d26`
3. ~~T0147 修復（BUG-033 Tray handler）~~ ✅ commit `ef867a2`
4. ~~T0148 研究（BUG-034 根因）~~ ✅ commit `98be02d`
5. ~~T0149 修復（reconnect + tcpSocket + 誤報 log）~~ ✅ commit `cd460d2`
6. ~~T0150 修復（watchdog guard）~~ ✅ commit `31b4ec2`
7. ~~T0145 驗收（情境 1-5 + 8 + 9 全綠）~~ ✅ 使用者打包實測通過
8. ~~批次 CLOSED + PLAN-012 DONE + PLAN-013 IDEA~~ ✅（D044）

### 下一輪候選（優先級待定）
- **PLAN-004** 📋 PLANNED 🟡：GPU Whisper 加速（Win/Linux）
- **PLAN-009** 📋 PLANNED 🟡：Sprint 儀表板 UI
- **PLAN-013** 💡 IDEA 🟢：Installer 檔案鎖定詢問 kill（本 session 新開）
- **PLAN-001/002/003/005/007** 💡 IDEA 🟢：Vite 升級、Dynamic Import、npm audit、Electron Builder 升級、遠端容器
- **`*evolve`**：本 session 有 learning 候選（T0144 連環 bug 模式 + 工單引用檔案路徑前應驗證存在 + BUG 不退回假 FIXING 的追蹤紀律）
8. BUG-031 runtime 驗證（🟡 Medium，FIXED → CLOSED）— 低優先
9. T0135 PARTIAL（6.2 `--help` 未實作）— 獨立處理
10. Backlog 剩餘 PLAN 待排優先級（PLAN-001~007）

### 本 session 決策
- **D032**：BUG-032 拆單方案 [A]（一張統籌 BUG + 一張研究 + N 張修復）；`_local-rules.md` 暫不動 [A]（避免破壞 baseline，等 BUG-032 整體方案敲定一起改）
- **追加**：BUG-031 維持 FIXED 狀態（PTY allocation 邏輯本身已透過使用者實測驗證），副作用檢查併入 BUG-032 範圍
- **D033**（2026-04-17 13:15）：建立 PLAN-012 — Quit Dialog 加「一併結束 Terminal Server」CheckBox，預設**不勾選**（避免誤按關掉背景 server）；Installer 強制 kill 另開 PLAN；時程緊急，排 T0142 驗收後
- **D034**（2026-04-17 13:25）：PLAN-012 拆單策略 Q1.D + Q2.A — 先派研究工單 T0143 摸清 Quit Dialog + Terminal Server 現狀；T0142 驗收 checklist Phase 2-5 內嵌到 T0143「Task B」觀察表，T0142 狀態改 🔀 MERGED；dogfood 驗收（派 T0143 行為本身即為 BUG-032 鏈路驗證）；CT 上游回 PR 編號順延
- **D035**（2026-04-17 13:58）：PLAN-012 UI 路線定調 — 採 **Electron 原生 `dialog.showMessageBox`**（內建 checkboxLabel），放棄 Custom React Modal；main.ts +~50 行 + i18n 6 行，零 React 改動，零 IPC 擴充
- **D036**（2026-04-17 13:58）：**BUG-032 → CLOSED** — T0143 Task B B1/B3/B4/B5 全綠（BAT_HELPER_DIR 正確、helper 可執行、notify exit 0、UUID 路由無 cwd 誤判），BUG-032 原範圍（helper packaging + path resolution）完全驗收通過；**版本更新檔案鎖定**問題屬 PLAN-012 範圍，獨立追蹤不混為一談
- **D037**（2026-04-17 14:00）：PLAN-012 拆單定案 — 採 T0143 Worker 推薦方案 B（2 張）：**T0144 實作**（`before-quit` 原生 Dialog + CheckBox + SIGTERM+timeout fallback + i18n，~60-80 行）+ **T0145 驗收**（6 情境 + 版本更新安裝場景）；T0142 合併完成後狀態改 ✅ DONE
- **D038**（2026-04-17 14:35）：**BUG-033 建立 + T0146 派發** — 使用者實測 rebuild + 重裝後托盤 Quit 無 Dialog 直接退出（Q1.A/Q2.D 確認），Terminal Server 殘留；屬 T0144 regression。策略：開研究工單（非直接修復）— 根因不明（可能 Tray handler bypass `before-quit` / Dialog async race / packaging 未涵蓋 / i18n init 失敗）；研究允許 Worker 加 trace log 請使用者重測（使用者已主動授權）。不直接派修復因為風險：盲修可能再 regression，也無從驗證其他 Quit 路徑（File/Ctrl+Q/視窗X）是否同病
- **D044**（2026-04-17 17:12）：**PLAN-012 全案結案 + 5 BUG 批次 CLOSED + PLAN-013 開立（IDEA）** — 使用者完成 rebuild + 重裝後實測：BUG-031 / BUG-033 / BUG-034 / BUG-035 **全部通過驗收**（T0145 情境 1-5/8/9 全綠）。一次結案：BUG-031 FIXED→CLOSED（T0137 runtime 驗證通過）、BUG-033 VERIFY→CLOSED（T0147 四路徑通過）、BUG-034 FIXED→CLOSED（T0149 方案 C 通過）、BUG-035 OPEN→CLOSED（T0150 watchdog guard 通過）、PLAN-012 PLANNED→DONE（四個實作 commits `412d52c`+`ef867a2`+`cd460d2`+`31b4ec2`）、T0145 READY→DONE、T0149/T0150 FIXED→DONE。**情境 7（installer 強制 kill 檔案鎖定場景）依 D033 劃出範圍**，使用者選項 [B] 另開 PLAN-013 IDEA 🟢 Low 入 backlog，不排入本輪結案。本輪最大收穫：T0144 實作引爆連環 bug（BUG-033 regression + BUG-034 reconnect early-return + BUG-035 watchdog race），每一層都靠 log 鐵證快速定位根因，堅守「塔台不直接改 code」邊界讓所有決策透明可追。
- **D043**（2026-04-17 16:49）：**BUG-035 建立 + T0150 派發（不退回 BUG-034）** — 使用者實測 T0149 打包版勾 checkbox 退出，觀察到 `terminal-server.js` + `crashpad-handler` 仍殘留。Log 鐵證（08:42:48 時間序）：`.814 TCP closed` → `.814 Terminal Server died — attempting recovery` → `.815 re-forking` → `.833 re-forked with pid 26412` → `.839 [quit] terminal server stopped (via TCP shutdown)`。性質明確：**BUG-034 根因已修好**（原 server graceful close，log `via TCP shutdown` 為證），但 PtyManager heartbeat watchdog（pre-existing T0108 期間的 crash recovery 邏輯）把 T0149 觸發的 graceful TCP close 誤判為 crash → 20ms 內 re-fork 孤兒 server PID 26412 → 孤兒持 refed TCP socket 卡住 main event loop → crashpad-handler 殘留。不是 T0149 引入，是 T0149 才讓它顯現化（之前 SIGTERM 根本沒送，watchdog 自然不觸發）。**BUG-034 保持 FIXED**（避免假退回汙染追蹤），開 BUG-035 另案追蹤。修復方向明確（`PtyManager.beginShutdown()` + `attemptRecovery` guard）→ 不需研究工單直接派 T0150。
- **D042**（2026-04-17 16:20）：**T0149 完成採 Worker 方案偏差合理化** — Worker 實作方案 C 時遭遇 2 處工單指示與現實衝突：(1) 工單要求用 `src/utils/execFileNoThrow.ts`，但此 util **不存在於本專案** → Worker 採專案既有 pattern（main.ts:1696、2353 已用動態 import + `execFile` 非 `exec` + Promise wrapper），安全性等價（`execFile` 天生無 shell 解析、`windowsHide: true`、`timeout: 3000`）；(2) `getPidFilePath` 為 pid-manager.ts module-local 未匯出 → Worker 硬編碼 `path.join(userDataPath, 'bat-pty-server.pid')` 並在註解標註「與 pid-manager.ts:4 `PID_FILENAME` 常數保持一致，若未來檔名變更需同步兩處」。兩處偏差塔台**批准合理化**：Worker 判斷正確（安全性等價 + 不新建 util 檔符合保守原則），但塔台寫工單時**未驗證 `execFileNoThrow.ts` 存在**是疏漏，learning 候選（工單引用具體檔案路徑前應先 grep 確認）。BUG-034 FIXING → FIXED（等 T0145 情境 8 打包驗收）
- **D041**（2026-04-17 16:04）：**T0148 結論採方案 C + 派發 T0149** — Worker Static 分析 + log 證據鏈完整確定根因：T0144 `stopTerminalServerGracefully()` 只處理 fork 路徑（`_terminalServerProcess` 有值），reconnect 路徑 `_terminalServerProcess=null` → `if (!child) return` 早退，SIGTERM 從未發出。log L123→L124 只差 1ms 鐵證。使用者在 T0148 互動 [15:54] 選定**方案 C**（TCP shutdown 優先 → PID SIGTERM fallback → Windows taskkill 兜底）+ 同意併修 tcpSocket leak（`pty-manager.dispose` 漏 destroy tcpSocket，疑似 crashpad-handler 殘留根因）+ 修誤報 log。T0149 範圍：3 檔案修改（main.ts 重寫 stop 函式 / pty-manager dispose 補 destroy / main.ts:1424 移除誤報 log）。**關鍵約束**：Windows taskkill 必須用專案 util `src/utils/execFileNoThrow.ts`（shell-safe，security hook 約束）。BUG-034 → FIXING
- **D040**（2026-04-17 15:38）：**BUG-034 建立 + T0148 研究工單派發** — 使用者重測打包版（含 T0147 `ef867a2`）確認 Dialog 會問 ✅ + checkbox 可勾 ✅，但勾選後仍殘留 `terminal-server.js` 子進程 + `crashpad-handler`（暗示 main 也沒完全退）。使用者確認托盤 + File 選單**兩條路徑都中**（Q2.A+B）→ 非路徑特定，是 checkbox → kill-server 邏輯本身失效。與 BUG-033（Dialog 不出現）性質不同，開新 BUG-034 另案追蹤避免 scope 爆炸。派研究工單而非直接修復 — 理由：可能根因多元（SIGTERM 對象 / Windows signal 行為 / child handle 遺失 / timeout race / main exit 未觸發），盲修風險高。Q3.C 授權 Worker 自行判斷 static vs trace log 策略。嚴重度 🟡 Medium（Dialog 主功能 OK，checkbox 為延伸功能，workaround 為工作管理員手動結束）
- **D039**（2026-04-17 14:58）：**T0146 結論採方案 A + 派發 T0147** — Worker 靜態分析 + log 交叉驗證 100% 確定根因（電子證據鏈：main.ts:540-546 Tray handler / main.ts:1334-1339 before-quit 守護條件 / log 完全無 `[quit]` prefix），未使用 trace log。**性質確認**：pre-existing bug，非 T0144 引入（Tray handler 的 `isAppQuitting = true` 在 commit `d09c45e` 就存在），但 T0144 才顯現化（T0144 前沒 Dialog 感知不到）。採方案 A（刪除 1 行）而非 B（改守護條件，跨路徑驗證面積大）或 C（重構 ~80 行 overkill）。雖僅 1 行改動仍派工單而非塔台自主 commit — 理由：屬邏輯變更 + regression 修復 + 需 4 路徑冒煙測試，超出 `auto_commit` 小變動範圍

### 本 session 新增工單
| ID | 標題 | 狀態 |
|----|------|------|
| BUG-032 | Helper scripts 打包與路徑解析設計缺漏 | 🚫 CLOSED |
| T0138 | 研究：BAT Helper Scripts 打包與路徑解析設計 | ✅ DONE |
| PLAN-012 | Quit Dialog 新增「一併結束 Terminal Server」CheckBox | 🔄 IN_PROGRESS |
| T0143 | 研究：Quit Dialog + Terminal Server 現狀（PLAN-012 起手 + T0142 驗收內嵌） | ✅ DONE (commit 215e8757) |
| T0144 | PLAN-012 實作：Quit Dialog + CheckBox（原生 dialog + SIGTERM fallback + i18n） | ⚠️ DONE but regression 顯現化（commit 412d52c） |
| T0145 | PLAN-012 驗收：6 情境 + 版本更新安裝場景 + BUG-033 四路徑打包覆蓋 | 📋 READY（等 build:win） |
| BUG-033 | 托盤 Quit 無 Dialog 直接退出，Terminal Server 殘留背景 | 🔍 VERIFY（dev serve 四路徑通過，等打包驗收） |
| T0146 | 研究：托盤 Quit 為何 bypass Dialog（BUG-033 根因調查） | ✅ DONE（推薦方案 A） |
| T0147 | 修復：刪除 Tray handler 的 `isAppQuitting = true`（方案 A，1 行） | ✅ DONE（commit `ef867a2`） |
| BUG-034 | Quit Dialog checkbox 勾選後 Terminal Server 未結束（托盤 + File 皆中） | 🔧 FIXING |
| T0148 | 研究：checkbox → kill-server 邏輯失效根因（BUG-034 根因調查） | ✅ DONE（commit `98be02d`，推薦方案 C） |
| T0149 | 修復：stopTerminalServerGracefully 支援 reconnect 路徑 + tcpSocket leak + 誤報 log（方案 C） | ✅ FIXED（commit `cd460d2`，log `via TCP shutdown` 證實 early-return 已修；T0145 情境 9.1 發現 watchdog race → BUG-035） |
| BUG-035 | PtyManager watchdog 在 shutdown 期間誤觸發 re-fork，孤兒 server 卡住 main event loop | 🚫 CLOSED（D044） |
| T0150 | 修復：PtyManager.beginShutdown() + attemptRecovery guard 避免 graceful shutdown 被誤判 crash | ✅ DONE（commit `31b4ec2`，T0145 情境 9.1 驗收通過） |
| PLAN-013 | NSIS Installer 偵測檔案鎖定時詢問 kill Terminal Server | 💡 IDEA 🟢 Low（D044 依 D033 剝離，入 backlog） |

### 本 session 新增工單（2026-04-17 02:00-03:05）
| ID | 標題 | 狀態 | Commit |
|----|------|------|--------|
| T0135 | BAT v2.x + CT v4.1.0 全鏈路驗收（統籌） | ✅ DONE | c98a04c, 8ec97ad |
| T0136 | BUG-030 修復 — MSYS 路徑轉換 | ✅ FIXED | f77d2d0 |
| T0137 | BUG-031 修復 — PTY workspace 分配 | ✅ FIXED | f325d1d |
| BUG-030 | bat-terminal.mjs Git Bash MSYS 路徑污染 | 🚫 CLOSED | c23bae2 |
| BUG-031 | 外部 PTY 被分配到錯 workspace（cwd first-match） | ✅ FIXED（待驗） | 7fdd76a |

### 本 session 關鍵發現
1. **BUG-030**：Git Bash MSYS2 把 `/ct-exec` 誤轉成 `C:/Program Files/Git/ct-exec`，T0136 加 regex 還原
2. **BUG-031 真根因**：不是「default workspace」，是 `cwd.startsWith(folderPath)` first-match，當 parent + 子專案 workspace 都打開時 match 到較早建立的
3. **PARTIAL**：`bat-terminal.mjs --help` 未實作（會被當命令執行）
4. **Worker→Tower 通知鏈路** 不受 BUG-031 影響（PTY 預填用 targetId 全域唯一；Toast 廣播到所有 BrowserWindows）— 仍需 T0138 runtime 確認

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open: 0 / Fixed: 1 / Closed: 1）
- Backlog → [_backlog.md](_backlog.md)
- 工單列表 → 熱區 14 + EXP/CP 雜項 — 全部 ✅ DONE 或 ✅ FIXED

### 近期完成摘要（本 session）
- **T0126** DONE：修復 CT 面板工單按鈕命令格式（`/ct-exec` → `claude "/ct-exec"`）
- **T0127** DONE：研究 BAT 內部終端建立機制 → 推薦方案 A
- **T0128** DONE：Agent 自訂參數 Settings UI + 7 處啟動路徑套用
- **T0129** DONE：RemoteServer 自動啟動 + BAT_REMOTE_PORT/TOKEN env vars 注入
- **T0130** DONE：外部建立終端 UI 同步（縮圖 + xterm + 自動聚焦）
- **T0131** DONE：CLI helper bat-terminal.mjs（零依賴 WebSocket invoke）
- **T0132** DONE：研究 Worker→Tower 自動通知 → 推薦方案 A（雙管道）
- **T0133** DONE：Worker→Tower 自動通知實作（雙管道 + 三層 badge 冒泡）
- **T0134** DONE：【統籌】CT 上游整合（COORDINATED → CT-T001 DONE）
- **CT-T001** DONE：CT v4.0.1 → v4.1.0（BAT 路由 + Worker 通知整合）
- **PLAN-011** DONE：CT 上游 PR 完成（v4.1.0 發布）
- `_local-rules.md` 更新：BAT auto-session 路由規則 + Bash 白名單

### 工單統計
- Done: 137 + CT-T001 | Active: 0 | 總計: 138
- 最高編號：T0137 / BUG-031 / PLAN-011 / D031
- FIXED BUG（待 rebuild 驗證）: BUG-031（Medium，T0137 commit f325d1d）
- Closed BUG（本輪）: BUG-030（High → CLOSED, 02:42）

## 🌅 明日起手式（Quick Recovery）<!-- ORIGINAL -->

**目前進度**：單據系統遷移 + 歸檔完成。20 張工單全部 DONE。目錄已清理。

**最後完成工單**：T0085（Commit all + v0.0.9-pre.1 pre-release）
**本輪完成**：T0065-T0085（21 張），涵蓋 BMad UI 整合、workspace 切換修復、VS Code 開啟功能、BUG-012 根因確認與修復

**下一步建議**：
1. 參考 `_backlog.md` 的 PLAN-001~007 決定下一批工作
2. BUG-001 待 runtime 驗收（最後一張 VERIFY bug）

**快速連結**：
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open: 0，Closed: 24）
- Backlog → [_backlog.md](_backlog.md)（Active: 6）
- 工單索引 → [_workorder-index.md](_workorder-index.md)（Active only）
- 決策日誌 → [_decision-log.md](_decision-log.md)（最新：D028）
- 學習紀錄 → [_learnings.md](_learnings.md)
- 歷史 Checkpoint → [_archive/checkpoint-2026-04.md](_archive/checkpoint-2026-04.md)

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（lastSyncCommit: 079810025，上游版號 2.1.3） |
| **Fork 版號** | 1.0.0（獨立版號，從 1.0.0 開始，D026） |
| **目前里程碑** | Phase 1 — Voice Input（實作完成，收官驗收中） |
| **工單最大編號** | T0150 |
| **BUG 最大編號** | BUG-035 |
| **PLAN 最大編號** | PLAN-013 |
| **上游同步版本** | v2.1.42-pre.2（2026-04-16） |
| **決策最大編號** | D044 |
| **塔台版本** | Control Tower v4.0 |

---

## 📊 進度快照

**Phase 1 語音功能**：✅ 實作完成
- 工單 T0001~T0062 執行完畢
- BUG-001~015 全部處理（1 個上游追蹤，1 個關閉，13 個已修復）
- 語音辨識：Whisper CPU + macOS Metal GPU 已啟用
- npm 安全：漏洞從 27 個降至 17 個（減少 48%）

**近期完成**：
- T0060：Metal GPU 加速（macOS）+ npm 安全修復
- T0061：文件結構設計
- T0062：_tower-state.md 瘦身 + 文件系統遷移

**塔台語氣校準**：
- 使用繁體中文
- 偏好決策速度快（選項式回答）
- 務實路線（先求有再求好，接受分階段交付）
- 重視細節，會主動回報 bug

---

## 📝 管理筆記

**2026-04-13 16:20 T0094 批次結案**：
- 所有 FIXED 狀態 BUG 人工驗收通過，批次更新為 CLOSED
- 共 20 筆：BUG-003~006, 008~011, 013~022, 023, 024
- BUG-023（右鍵選單智慧定位，T0092）驗收通過
- BUG-024（CT 面板不監聽索引文件，T0095）驗收通過
- T0091（BUG Detail 工作流 UI）驗收通過
- T0092（右鍵選單智慧定位實作）驗收通過
- Bug Tracker 統計：Open 0 / Fixed 0 / Closed 24

**2026-04-13 13:43 T0086 結案**：
- BUG-002 CLOSED（人工驗收通過）
- BUG-012 CLOSED（人工驗收通過，v0.0.9-pre.1 確認修復）
- Worktree 檢查：無 bug012 worktree 存在（已自行清理或未建立）
- Bug Tracker 統計：Open 0 / Verify 1 / Fixed 18 / Closed 3

**2026-04-13 13:14 Session 結束筆記**：
- 本輪 21 張工單（T0065~T0085），生產力高
- **BUG-012 重大突破**：EXP-BUG012-001 實驗確認根因為 `convertEol: true`，5 輪排除法，2 行修復
- 新功能：VS Code 開啟工作區（T0078~T0082）、BMad Workflow/Epics 頁籤（T0072~T0073）
- 新規範：`_local-rules.md` 加入 EXP-/跨專案工單前綴規範
- v0.0.9-pre.1 pre-release 已推出，BUG-012 待 runtime 驗收後 CLOSED
- worktree `../better-agent-terminal-bug012` 待清理

**2026-04-12 21:43 Session 結束筆記**：
- 本輪 20 張工單，生產力極高
- 新單據系統（BUG/PLAN/Decision 獨立檔 + 歸檔原則）是本專案實驗，成功後推回 BMad-Control-Tower
- `_local-rules.md` 教塔台認識新單據，下輪 session 驗證是否有效
- 4 commits 待使用者 push

---

## 🗂️ 歸檔索引

歷史 Checkpoint（2026-04-11 至 2026-04-12）：
→ [_archive/checkpoint-2026-04.md](_archive/checkpoint-2026-04.md)（2016 行，完整保留）

---

## 🔍 環境快照
> 最後掃描：2026-04-15 20:59 (UTC+8)

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| BMad-Method | ✅ | _bmad/ 已偵測到 |
| ECC 學習 | ✅ Level 1 | ~/.claude/homunculus/ |
| bmad-guide skill | ✅ | 可用 |
| mem0 REST | ✅ | memsync healthy, queue:2 |
| 終端環境 | better-agent-terminal | TERM_PROGRAM 偵測 |
| ct-exec | ✅ | |
| ct-done | ✅ | |
| ct-status | ✅ | |
| ct-evolve | ✅ | |
| ct-insights | ✅ | |
| ct-fieldguide | ✅ | |
| ct-help | ✅ | |
| _archive/ | ✅ | ~80 張歸檔 |
| _playbooks/ | ✅ | 🆕 本次建立 |
| _decision-log | ✅ | D031 (18+ 條) |
| 跨專案參照 | 📋 | 無關聯 |
| Global 學習 | ✅ | 2 learnings, 4 fieldguide |
| BUG/PLAN 追蹤 | ✅ | BUG:15熱+13冷 PLAN:9 |
| 實驗追蹤 | ✅ | EXP:1 |
| 設定來源 | project | _tower-config.yaml (v4 已補齊) |
| 能力等級 | Level 2 | ECC + mem0 |
