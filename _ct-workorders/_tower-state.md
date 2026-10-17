# Tower State — better-agent-terminal

> 最後更新:2026-10-16 22:39 (UTC+8) — **第六十九 session 收工**：pre.7 實機 BUG-142 / 143 CLOSED；BUG-144 / 145（T0571 / T0572）→ **`v0.6.1-pre.8`**（使用者指示已知問題一起修完再發版）。
>
> **下次起手**:Fast Path 載入；本機 BAT 升 `0.6.1-pre.8` 後在 claude CLI 分頁確認：Shift + 拖曳 → Shift + 右鍵有「複製」（BUG-144）、⏻ 重啟後畫面佔滿寬度（BUG-145）→ CLOSED；用量限制首次真實撞限制時看 `[usage-limit]`；等 Gary BUG-136。
---

## 🛏 本 Session 收工快照 (第六十九 session, 2026-10-16 21:45 - 22:39, ~54m wall)

### 主軸：pre.7 實機（BUG-142 / 143 CLOSED）→ Shift 選單缺「複製」BUG-144（T0571）→ 使用者指示「已知問題一起修完再發版」→ BUG-145（T0572）+ 文件修正 → **`v0.6.1-pre.8`**

#### 時間線（時間取自系統 / git / gh）

1. **21:45** Fast Path；本機 BAT = `0.6.1-pre.7`，CT v5.2.3；`--set-role tower --mode on` exit 0
2. **21:48** pre.7 實機：右鍵直接貼上 PASS、Esc PASS → **BUG-142 / 143 CLOSED**、T0568 / T0569 DONE；Shift + 右鍵選單沒有「複製」（直接拖曳與 Shift 拖曳都試過）→ **BUG-144** / **T0571**（21:49 派）
3. **22:06** T0571 DONE `35eaf125`（xterm 把 1003 移動回報當使用者輸入、清掉 Shift 拖曳選取 → 放回選取；直接拖曳是 claude 自己的選取，copyOnSelect 已複製）；塔台複驗 unit 4626 / 265
4. **22:12** 使用者：「先把已知問題一起修完再發版」→ 塔台直改 `docs/server-bundle-distribution.md` rate-limit 段（T0548 #5）；T0571 e2e 觀察的 PTY 尺寸競態 → **BUG-145** / **T0572**（22:12 派）
5. **22:27** T0572 FIXED `ecc00c60`（PTY 建立前送的 resize 被丟 + 去重；⏻ 重啟必現 → spawn 後重送尺寸）；塔台複驗 unit **4633 / 266**、typecheck 0 / 0
6. **22:28** bump `0769bafc` → run `38916104029` → **22:36 `v0.6.1-pre.8` 已發佈**（10 job 全綠）→ 更版重點 + CHANGELOG / release-note / README（`370c7781`）→ push

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **2**（T0571 / T0572） | 皆一次完成；`worker_auto_close` 回收 2 次 |
| BUG | CLOSED 2（142 / 143）；新開 2（144 / 145）→ FIXED | Open 1（BUG-136）/ Fixed 19 / Closed 50 |
| 發版 | 1（`v0.6.1-pre.8`） | exe 298 / zip 412 / AppImage 297 / dmg 309 MiB |
| unit test | 4614 → **4633 passed / 266 files** | 塔台複驗 @ `5e47ed60` |

### 重點觀察

- 修正宣稱的路徑（T0568「Shift + 右鍵可複製」）沒有測試時，實機才發現；驗收清單要逐條對到測試
- Worker 回報區的「範圍外觀察」（T0571 的 PTY 尺寸競態）是已知問題清單的來源，批次發版前要掃一遍

### 編號起始（下 session）

- **T0573** / **BUG-146** / **PLAN-047** / **D149** / **L155** / **CT-T014**

---

## 🛏 前 Session 收工快照 (第六十八 session, 2026-10-16 17:25 - 18:18, ~52m wall)

### 主軸：pre.6 實機 PASS（PLAN-045 DONE）→ 右鍵選單 BUG-142 / 143（T0568 / T0569）→ **`v0.6.1-pre.7`** → 發佈後同步 repo 文件（新規則）+ T0570 補齊 CHANGELOG / release-note

#### 時間線（時間取自系統 / git / gh）

1. **17:25** Fast Path；本機 BAT = `0.6.1-pre.6`，CT v5.2.2；`--set-role tower --mode on` exit 0（分頁標題已設定）
2. **17:29** 使用者確認 pre.6 實機（Dialog / Esc / 精靈 Esc / 用量限制開關）PASS → **PLAN-045 DONE**；T0551 / T0552 / T0554 FIXED → DONE（`c9cd0f81`）
3. **17:31** 使用者回報 claude CLI 分頁右鍵「已貼上又跳選單」→ 選定「程式自己處理右鍵就不顯示選單」→ **BUG-142** / **T0568**（17:32 派）→ 17:39 FIXED `9988a117`（claude 2.1.300 開 1000/1002/1003/1006，右鍵自己貼上；BAT 追蹤時不開選單、Shift + 右鍵照開）
4. **17:47** T0568 觀察「選單 Esc 關不掉」→ **BUG-143** / **T0569** → 17:53 FIXED `fb66c0bc`（xterm 吃掉 Esc 且送進 PTY；`attachCustomKeyEventHandler` 攔下）；塔台複驗 unit 265 / 4614、typecheck 0 / 0
5. **17:55** 使用者新規則：發版後同步 `README.md` / `release-note.md` / `CHANGELOG.md` → `_local-rules.md`「發佈後同步 repo 文件」+ 記憶；選擇補齊舊版
6. **17:57** bump `c41a0ec7` → run `38884005468` → **18:04 `v0.6.1-pre.7` 已發佈**（10 job 全綠；更版重點已寫）→ 18:06 派 **T0570** → DONE `97b5697e`（32 版、README 7 處）→ push `f09dfcb4`

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **3**（T0568–T0570） | 全一次完成 |
| BUG | 新開 2（142 / 143）→ FIXED | Open 1（BUG-136）/ Fixed 19 / Closed 48 |
| PLAN | DONE 045 | Active 只剩 IDEA 4 |
| 發版 | 1（`v0.6.1-pre.7`） | exe 298.0 / zip 412.3 / AppImage 297.4 / dmg 309.7 MiB |
| 規則 | 發佈後同步 repo 文件（`_local-rules.md`）；L154 | |
| unit test | 4597 → **4614 passed / 265 files** | 塔台複驗 @ `2497014a` |

### 重點觀察

- 終端內 TUI（claude CLI）開滑鼠追蹤後自己處理右鍵；BAT 疊加的 DOM 選單要以 xterm `mouseTrackingMode` 讓路，xterm 的 key handler 會吃掉 Esc（`stopPropagation`）→ 選單類 UI 要在 `attachCustomKeyEventHandler` 處理
- 發版收尾現在是三步：`gh release edit` 更版重點 → repo 三文件 commit → push（L154：commit 來源篩選用 `(ct)$` 而非 `(ct)`）

### 編號起始（下 session）

- **T0571** / **BUG-144** / **PLAN-047** / **D149** / **L155** / **CT-T014**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-17 10:47 UTC+8（第七十 session 進行中）

### 近期完成
- `v0.6.1-pre.9`（10-17 10:45，run `38995709965` @ `14246954`）：BUG-144 重修（T0573 `6e4f3764`：claude 聚焦時重送追蹤 DECSET 清選取、同範圍重選無事件）；更版重點與三文件已同步（`65c841bf`）
- pre.8 實機（第七十 session）：BUG-145 CLOSED、T0572 DONE；T0538 手動批次關閉實機 PASS（記於 PLAN-041）；BUG-144 實機無效 → T0573
- `v0.6.1-pre.8`（10-16 22:36，run `38916104029` @ `0769bafc`）：BUG-144 追蹤滑鼠的分頁 Shift + 拖曳選取後 Shift + 右鍵有「複製」（T0571）、BUG-145 新分頁 / 還原 / ⏻ 重啟的 PTY 尺寸同步（T0572）、rate-limit 文件更正；更版重點與 repo 三文件已同步（`370c7781`）
- `v0.6.1-pre.7` 實機 → BUG-142 / 143 CLOSED、T0568 / T0569 DONE（第六十九 session）
- CT **v5.2.3**；unit 4633 passed / 266 files；`worker_auto_close: done`（10 s）

### 待辦（依優先序）

1. 🟡 **pre.9 實機 BUG-144**：claude CLI 分頁 ① Shift + 拖曳 → 移動 → Shift + 右鍵 ② 從別的視窗回來 ≥ 5 s 直接 Shift + 拖曳 ③ 同一段文字選兩次 → 都有「複製」且內容正確 → CLOSED、T0573 DONE；失敗看日誌 `[terminal-context-menu] … shown: … keeper=…`
2. 🟡 **用量限制**：首次真實撞限制時看 `[usage-limit]`（Codex 自動輸入未在真 codex 驗證）
3. 🟡 **BUG-136**（Gary macOS 打字延遲）：等 Gary 回傳 `debug-*.log`（`[gpu]` 行）/ `.ips` / CPU
4. 🟡 前期驗收：Gary BUG-127-135 / 116 / 118；使用者 Windows BUG-130、真人項 BUG-105 / 107 / 108、Docker BUG-097 / 111；T0550 真人 6 項；dmg / AppImage 啟動、NSIS 完整重裝
5. 🟢 後續小項：背景分頁未顯示前 PTY 維持 120 欄、Terminal Server recovery 重建以 120x30（T0572 建議：PtyManager 記住最後尺寸）；追蹤模式 Alt + Shift 欄選取；`e2e/t0571` 的 redraw 繞法可移除；zsh `~/.zprofile` nvm；CHANGELOG `[0.4.2]` 段；程式碼簽章；`*archive` 到齡候選；T0360（舊單 FIXED）

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）／更版重點必寫（L150 → `_local-rules.md`）／發佈後同步 repo 文件
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。**每次發版** run 完成後同一步 `gh release edit --notes-file` 寫更版重點，`gh release view --json body` 確認後，再更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 commit + push，才回報已發佈。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open 1 / Fixing 0 / Fixed 19 / Closed 50）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D148）｜ Learnings → [_learnings.md](_learnings.md)（最大 L154）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（85 entries）

### 編號起始
- **T0574** / **BUG-146** / **PLAN-047** / **D149** / **EXP-[TOPIC]-001** / **L155** / **CT-T014**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.6.1-pre.9**（package.json + lock，2026-10-17 10:38 `14246954`） |
| **最新 release** | `v0.6.1-pre.9`（2026-10-17 10:45，run `38995709965`，target `14246954`：BUG-144 重修 T0573；更版重點已寫；repo 文件已同步 `65c841bf`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.6.1-pre.9`（7 assets）。前一版 `v0.6.1-pre.8`（2026-10-16 22:36，run `38916104029`，target `0769bafc`：BUG-144 Shift + 右鍵複製、BUG-145 PTY 初始尺寸；更版重點已寫；repo 文件已同步 `370c7781`；exe 298 / zip 412 / AppImage 297 / dmg 309 MiB）+ `server-bundle-v0.6.1-pre.8`（7 assets）。前一版 `v0.6.1-pre.7`（2026-10-16 18:04，run `38884005468`，target `c41a0ec7`：BUG-142 / 143 右鍵選單）。更早見 `release-note.md` / `CHANGELOG.md` 與 `_archive/state-snapshots/2026-Q4.md` |
| **前一 tag** | `v0.6.1-pre.8`（2026-10-16 22:36，`0769bafc`） |
| **目前主軸** | `v0.6.1-pre.8` 已發佈（2026-10-16 22:36）；待本機升 pre.8 實機 BUG-144 / 145；用量限制被動觀察；BUG-136 等 Gary |
| **工單最大編號** | T0573 FIXED `6e4f3764`（第七十 session，待 pre.9 實機）；T0572 DONE（pre.8 實機）；T0571 DONE `35eaf125`、T0572 FIXED `ecc00c60`（第六十九 session，皆待 pre.8 實機）；T0568–T0570 DONE（第六十八 session） |
| **BUG 最大編號** | **BUG-145**（CLOSED 2026-10-17）；Open 1（BUG-136）/ Fixing 0 / Fixed 18 / Closed 51（BUG-144 FIXED by T0573，待 pre.9 實機）；以下為前次記錄：（BUG-144 / 145 FIXED 2026-10-16，待 pre.8 實機；BUG-142 / 143 CLOSED） |
| **PLAN 最大編號** | **PLAN-046**（044 / 045 / 046 DONE，2026-10-16）；PLAN-015 / 029 / 038 / 043 IDEA；PLAN-014 DROPPED |
| **決策最大編號** | D148（PLAN-044 範圍：claude 信任 CLI、Codex 自動輸入、塔台 `--mode`，2026-10-16） |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower v5.2.3（第六十九 session；`worker_auto_close: done`） |
| **unit test 基線** | **4633 passed / 266 files / 3 skipped**（塔台複驗 @ `5e47ed60`，2026-10-16 第六十九 session）；前：4614 passed / 265 files（@ `2497014a`，第六十八 session）；typecheck 0 / typecheck:electron 0 |

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
> 最後掃描:2026-10-15 19:57 (UTC+8) 第六十五 session **Full Scan**（`*rescan`；前次 Full Scan 2026-10-13 15:40）

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`, terminal `66447ea9…`；`WT_SESSION` 無 |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（PowerShell 複核 2026-10-15 19:54）；另有 `BAT_USER_DATA` |
| BAT 安裝版 | ⚠️ `0.6.1-pre.7`（`v0.6.1-pre.8` 已發佈，使用者收工時換版中；下次起手以 FileVersion 確認） | 2026-10-16 21:45 FileVersion 確認；Tower `--set-role tower --mode on` exit 0 |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ 單一目錄 | `%APPDATA%\BetterAgentTerminal\Logs\debug-20261015-195413.log`（本次啟動）；`.userdata-migration.json` marker 存在 |
| 平台 | Windows 11 | PowerShell 主，Bash tool 並存；node `v24.22.0` / npm `12.2.0`；`.gitattributes` `* text=auto eol=lf` |
| UAC | ⚠️ `EnableLUA=0` | BAT 與子 shell 皆提權（BUG-085 背景） |
| gh CLI | ✅ | 已登入 `gowerlin`（keyring）；**必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `main` = `origin/main` @ `2b983a79`（fetch 後）；無其他 worktree / stash；`src/styles/settings.css` 顯示 M 但 `git diff` 無內容（stat-only，未處理） |
| 最新 CI / release | ✅ | Pre-Release run `38871114752` success → `v0.6.1-pre.6` + `server-bundle-v0.6.1-pre.6`（2026-10-16 16:11） |
| WSL | Ubuntu-24.04 | `~/.local/bat-server` = `0.6.1-pre.5`（T0559 2026-10-16 14:17；T0559 / T0560 備份已依使用者指示於 14:27 刪除；port 9877，systemd user service active）；nvm 0.40.8 + Node 24.22.0（T0555 / T0556）；`docker.io` 29.1.3 |
| Control Tower skills | ✅ v5.1.0 | control-tower / ct-exec / ct-done / ct-status / ct-evolve / ct-insights / ct-fieldguide / ct-help 全為 5.1.0 |
| 熱區單據 | **T:187 檔 / BUG:62 / PLAN:14 / EXP:0** | `archive_days: 2` 下大量到齡候選（歸檔前先 grep 程式碼引用，L133） |
| 最大編號 | **T0567 / BUG-141 / PLAN-046 / D148 / L153 / CT-T013** | 下張：T0568 / BUG-142 / PLAN-047 / D149 / L154 / CT-T014（第六十七 session 收工時） |
| 非終態工單 | T0360 FIXED（舊單） | 2026-10-16 17:29：T0551 / T0552 / T0554 FIXED → DONE（BUG 已 CLOSED）；第六十六 session 已補正 T0510 / T0153 / CT-T001 / 011 / 012；報告檔 T0292 / 293 / 298 / 302 已歸檔 |
| unit test | ✅ **3939 passed / 1 skipped / 237 files** | 塔台 rescan 複驗 @ `2b983a79`（31 s） |
| typecheck | ✅ src 0 / electron 0 | 塔台 rescan 複驗 @ `2b983a79` |
| e2e | 未重跑 | 最近：T0535-T0541 各自 e2e（需先 `npx vite build`） |
| state 檔 | ✅ 19.9 KB | < 30 KB 軟警告；季檔 `2026-Q4.md` 86,352 bytes、INDEX 80 entries |
| 設定來源 | project | `_tower-config.yaml`（auto-session **on**，`yolo_max_retries: 1`，`auto_commit: on`） |
| 塔台版本 | v5.1.0（本 session 起生效） | control-tower skill |

> **Drift / 注意事項**:
> 1. ✅ ~~D094 mac installer 280 MB cap 長期超標（L130）~~ → D146 取代（每平台 ≤ 320 MiB、zip ≤ 450；pre.4 全數符合）
> 2. ⚠️ `_ct-workorders/_archive/workorders/T0293-review-report.md` 含 2 個 NUL 位元組（既有；2026-10-16 隨 L132 處置搬入歸檔）
> 3. ✅ ~~**L132**：`T0292/T0293/T0298/T0302-*-report.md` 命名越界~~ → 2026-10-16 使用者決定搬入 `_archive/workorders/`
> 4. ⚠️ **L129**：含反斜線的內容一律走 Write 工具
> 5. ⚠️ **L136**：VS Code Insiders 可能鎖 `release\win-unpacked\resources\app.asar`
> 6. ⚠️ **發版綁定**：T0435 ↔ T0437、T0453 ↔ T0458（皆已同在 pre.2 之後的版本內）

---

## YOLO 歷程

> 本區段依 `references/yolo-mode.md` § 「`_tower-state.md` 新增 `## YOLO 歷程` 區段」規格產生。逐筆紀錄已歸檔至 `_archive/state-snapshots/2026-Q4.md`（INDEX 69 / 70 / 72）。

### 計數器（第五十六 session，已收工）

- 連續 FAILED: 0 / 1
- 本 session yolo 派發：5（T0462-T0466 全 DONE，皆一次啟動成功）
- 斷點觸發：A×0, B×0, C×8（scope 內，塔台直接裁決）、使用者中斷×0

### 計數器（第五十五 session，已收工）

- 連續 FAILED: 0 / 1
- 本 session yolo 派發：45 張完成（另重派 2、ct-done 補救 1）
- 斷點觸發：A×0, B×0, **C×17**（scope 內，05:55 起依使用者授權由塔台直接裁決）、使用者中斷×0
- 使用者修正：1（Worker 啟動檢查 30 秒 → ≥ 3 分鐘）

### 歷史 Session（摘要）

- 2026-10-16 第六十九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0571 / T0572 皆一次完成；`worker_auto_close` 回收 2 次；pre.8 發佈
- 2026-10-16 第六十八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0568–T0570 皆一次完成；pre.7 發佈
- 2026-10-16 第六十七 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0557-T0567 全 DONE，皆一次啟動（最多 2 張並行，依目錄切分）；`worker_auto_close` 回收 10 次；pre.6 發佈
- 2026-10-16 第六十六 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0549-T0556 全 DONE / FIXED，皆一次啟動；`worker_auto_close` 回收 7 次（1 次被焦點切換取消 → BUG-140，重請求後關閉；PARTIAL 不回收 1 次）；pre.5 發佈
- 2026-10-15 第六十五 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0542-T0548（6 DONE、T0543 ABANDONED），皆一次啟動；首次啟用 `worker_auto_close: done`（pre.3 上收單即回收皆 exit 6 → D145）；pre.4 發佈
- 2026-10-15 第六十三 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0531 / T0532 全 DONE，皆一次啟動；pre.11 / 0.6.1-pre.1 發佈
- 2026-10-14 第六十二 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0526-T0530 全 DONE；pre.9 / pre.10 發佈（第六十三 session 補記）
- 2026-10-14 第六十一 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0521-T0525 全 DONE，皆一次啟動（最多 2 張並行）；pre.8 發佈
- 2026-10-14 第六十 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0513-T0520 全 DONE，皆一次啟動；pre.7 發佈
- 2026-10-14 第五十九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0510-T0512（T0510 PARTIAL、T0511 / T0512 DONE），皆一次啟動；pre.6 發佈
- 2026-10-13 第五十八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0467-T0509 全 DONE；pre.3 / pre.4 / pre.5；逐筆見 2026-Q4.md「第五十七～五十八 session 時間線」
- 2026-10-05 第五十六 session：session-only yolo（Worker 互動不允許）；D135 PLAN-039 T0462-T0466 全 DONE、皆一次啟動；斷點 C×8 由塔台裁決；逐筆見 2026-Q4.md「YOLO 歷程（第五十六 session）」
- 2026-10-05 第五十五 session：session-only yolo；D134（45 列）全 DONE；斷點 C 由塔台裁決；派工未啟動 2 次 + commit 前停住 1 次（BUG-114）；逐筆見 2026-Q4.md「YOLO 歷程（第五十五 session）」
- 2026-10-04 第四十九 session：session-only yolo；T0365-T0374，含 2 次外部動作閘（bump + push + pre-release 由使用者授權）；逐筆見 2026-Q4.md「YOLO 歷程（第四十九 session）」
- 2026-04-18 第三 session：CT-T003 DELEGATE PARTIAL → DONE；`*evolve` L057-L066；`*archive` 活躍引用豁免測試
- 2026-04-18 T0174 Phase 2-6 session：T0173 研究 DONE；首次斷點 C（事後確認，L064）；使用者中斷「停」驗證
- 2026-04-18 上半場（PLAN-020 開發）：7 張本專案 + 1 跨專案 DELEGATE，全 DONE，無斷點
- 2026-04-18 下半場第二 session：T0174 Phase 0-1 dogfood（無派發）
