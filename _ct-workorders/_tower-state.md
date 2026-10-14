# Tower State — better-agent-terminal

> 最後更新:2026-10-14 14:47 (UTC+8) — **第六十一 session 收工**：Gary / 使用者回報 → BUG-127-131 → T0521-T0525 全 DONE → **`v0.6.0-pre.8` 已發佈**（14:20）→ D140 / PLAN-040 / L150。
>
> **下次起手**:Fast Path 載入；等 Gary pre.8 回饋（127-130 + 116 / 118 + BUG-129 日誌與 `echo $BAT_WORKSPACE_ID` 比對）→ 結案 + 與 PLAN-040 一起排下一批。

---

## 🛏 本 Session 收工快照 (第六十一 session, 2026-10-14 13:17 - 14:47, ~1h30m wall)

### 主軸：Gary（mac）與使用者回報 → BUG-127-131 → T0521-T0525 → 聯合複驗 → **`v0.6.0-pre.8`** → PLAN-040

#### 時間線（時間取自系統 / git）

1. **13:17** Fast Path 起手（state 19 KB、BUG Fixed 7 / Closed 44 無漂移）
2. **13:19** Gary 回報兩件 → 開 **BUG-127**（切換工作區時指揮塔 toast 洪水 / 「殘影」）、**BUG-128**（mac Finder 拷貝 Command+V 貼不上）→ 13:21 並行派 **T0521** ∥ **T0522**；使用者裁決「切換工作區不重複跳更新提示」寫入 T0521
3. **13:27** T0521 DONE（`5962450`）；13:31 Gary 第三件 → 開 **BUG-129**（Codex 塔台派工落到別的工作區且開成 Claude）→ 13:32 派 **T0523**；T0522 DONE（`43c9073`）
4. **13:36** 使用者回報 Windows 終端 Ctrl+V 貼圖失效 → 開 **BUG-130** → 13:37 派 **T0524**（與 T0523 可能共用 main / preload，給出 commit 等待規則）
5. **13:48** T0523 DONE（`dcdfffe`）→ 範圍外發現開 **BUG-131**（PTY 重建 / restart 掉 env）→ 13:49 派 **T0525**；13:55 T0525 DONE（`d4ee455`）；13:57 T0524 DONE（`7ac0d0a`）
6. **13:58** 塔台聯合複驗 @ `b00c4f9` 全綠；CLAUDE.md 補 T0523 派工落點 / T0525 `buildPtyEnv`
7. **14:07** 使用者：貼圖「現在又好了」（間歇性，記入 BUG-130）；`--agent default` 選 **A**（**D140**）；push + **14:20 `v0.6.0-pre.8` 已發佈**（run `38520403729` @ `887ff20`）；package.json 同步（`4ff6cb2`）
8. **14:21** 使用者指出工作區層級預設 Agent 沒有 UI（`Workspace.defaultAgent` 只讀不寫）→ D140 更正 → 14:23 開 **PLAN-040**（PLANNED，等 Gary pre.8 回饋後一起排）
9. **14:3x** 使用者發現 Release Page 無發布說明 → 補寫 + 修 Full Changelog 起點 → **L150**；push（`755fe06`）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **5**（T0521-T0525） | 全 DONE、皆一次啟動；最多 2 張並行，`--only` commit 無交叉污染 |
| 發版 | 1（`v0.6.0-pre.8`） | 10 job 全綠 + `server-bundle-v0.6.0-pre.8`（7 assets） |
| BUG | 新開 5（127-131）→ 皆 FIXED | Open 0 / Fixed 12 / Closed 44 |
| 決策 | D140 | `--agent default` 語意不變（A）；工作區層級設定 → PLAN-040 |
| PLAN | PLAN-040 | 工作區層級預設 Agent（PLANNED） |
| Learnings | L150 | 發版後同步寫 release notes |
| unit test | 3534 → **3642 passed / 216 files** | |
| e2e（新） | `t0523-dispatch-workspace`、`t0524-terminal-image-paste` | |

### 重點觀察

- BUG-129 Gary 情境推論為 Codex 沿用舊 thread 的 shell snapshot，`BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` 兩者都指向土銀 ⇒ T0523 只能讓錯誤可見（helper 印落點），根治要以 PID 鏈辨識呼叫者，待 Gary 日誌確認
- BUG-130 Windows 回歸本機（含安裝版 pre.7 exe）無法重現，使用者隨後回報恢復 ⇒ 間歇性；pre.8 起有 `[terminal-paste]` log
- 塔台對使用者說明時曾誤稱「請 Gary 設 SCB 工作區預設 agent」，實際沒有 UI —— 提出設定建議前先確認 UI / store 寫入點存在

### 編號起始（下 session）

- **T0526** / **BUG-132** / **PLAN-041** / **D141** / **L151**

---

## 🛏 前 Session 收工快照 (第六十 session, 2026-10-14 03:20 - 05:13, ~1h53m wall)

### 主軸：pre.6 實機 → 已修待驗 BUG 自動化驗收三線（T0514-T0516）→ pre.7 批次（T0513 / T0517-T0519）→ **`v0.6.0-pre.7`** → 已安裝版驗收（T0520）→ pre.7 批次全結

#### 時間線（時間取自 git / 系統）

1. **03:28** 使用者 pre.6 回報遠端狀態燈恆紅 → 開 **BUG-123** / 派 **T0513**；03:32 **BUG-122 CLOSED**（使用者 pre.6 確認）
2. **03:38** T0513 DONE（`90b35ee`）
3. **03:43** 開 / 並行派 **T0514**（UI / 遠端路由）、**T0515**（設定精靈）、**T0516**（建置產物）三條 pre.6 已安裝版自動化驗收線
4. **03:51-04:10** T0516 / T0515 / T0514 DONE → 依證據結 **18 張** BUG（含 061 / 086 / 115 / 117 等）；驗收觀察開出 **BUG-124**（forwarding 被拒訊息誤導）/ **BUG-125**（commands 描述 `---`）/ **BUG-126**（skills fallback 恆空）；L149（NSIS MAX_PATH）
5. **04:08-04:17** T0518（`b66b525`）/ T0519（`aa26c76`）/ T0517（`213f587`）DONE；04:19 塔台聯合複驗全綠（unit 3534 / 212 files、typecheck 雙 0、e2e 7 passed）
6. **04:43** **`v0.6.0-pre.7` 已發佈**（run `38461996096` @ `b77f3cc`）；04:47 package.json 同步（`6a871d8`）
7. **04:51** 塔台 context 重啟（Fast Path）；使用者已裝 pre.7 → 04:53 派 **T0520**（pre.7 已安裝版自動化驗收）
8. **05:07** T0520 DONE（`a4fe1f5`，17 PASS / 0 FAIL / 1 NEEDS-HUMAN）→ **BUG-124 / 125 / 126 CLOSED**
9. **05:10-05:12** 使用者真實 WSL 卡片 🟢 + 關窗 15 s 轉 ⚪ 確認 → **BUG-123 CLOSED**；05:12 push（`6a871d8..3aa06d5`）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **8**（T0513-T0520） | 全 DONE；T0514-T0516 / T0520 為驗收單（只寫 opt-in spec，不改產品）；皆一次啟動 |
| 發版 | 1（`v0.6.0-pre.7`） | 10 job 全綠 + `server-bundle-v0.6.0-pre.7` |
| BUG | 新開 4（123-126）→ 皆 CLOSED；本 session 共結 **23 張** | Open 0 / Fixed 7 / Closed 44 |
| 決策 | 0 | |
| Learnings | L149 | |
| unit test | 3474 → **3534 passed / 212 files** | |
| e2e（opt-in） | +`pre6-ui-remote-acceptance` / `pre6-wizard-acceptance` / `pre7-acceptance`、`t0513-profile-status-light` | 環境腳本 `e2e/real-remote/t0514-*` / `t0515-*` / `t0520-*` |

### 重點觀察

- 「已修待實機」BUG 改走**已安裝版 exe + 容器化真環境**的自動化驗收後，一個 session 內結 23 張；剩下 7 張都是 AI 依規則不能碰的（真實 Claude session、Docker Desktop 未啟動、mac）
- 驗收單的「觀察」節是新 BUG 的主要來源（124 / 125 / 126 都來自 T0514 / T0515），延續 L145
- T0520 偏差：wsl-linux profile 需要真實 `wslDistro` 才能開視窗，自動化改用 docker-linux 指向同一台 headless server；真實 WSL 由使用者目視補齊

### 編號起始（下 session）

- **T0521** / **BUG-127** / **PLAN-040** / **D140** / **L150**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-14 14:47 UTC+8（第六十一 session 收工）

### 近期完成
- `v0.6.0-pre.8` 已發佈（10-14 14:20，run `38520403729` @ `887ff20`，發布說明已補）：終端貼上統一規則（BUG-128 / 130）、塔台派工落點（BUG-129）、指揮塔切換工作區 toast（BUG-127）、PTY 重建保留 env（BUG-131）
- T0521-T0525 全 DONE；聯合複驗 @ `b00c4f9` 全綠（typecheck 雙 0、unit 3642 / 216 files、e2e 6 passed）
- D140：`--agent default` 語意不變（A）；工作區層級預設 Agent 無 UI → PLAN-040（PLANNED）
- BUG Open 0 / Fixed 12 / Closed 44；`main` = `origin/main`（收工 push）

### 待辦（依優先序）

1. 🟡 **Gary pre.8 回饋**（arm64 dmg）：BUG-127 / 128 / 129 / 130 驗收 + BUG-116 / 118；BUG-129 要日誌（`[T0130] External terminal added`、`[agent-command] resolved agent=`、`bat-scripts.log` invoke env）與「SCB Codex 內 vs 一般分頁 `echo $BAT_WORKSPACE_ID`」比對 → 若證實 Codex shell snapshot，開根治單（PID 鏈辨識呼叫者，T0523 §7-1）
2. 🟡 **PLAN-040** 拆單：與 Gary 回饋一起排下一批（detached 視窗持久化邊界先決定）
3. 🟡 **使用者 Windows**：BUG-130 間歇性，再失效時查 `[terminal-paste]` log；真人 5 分鐘項 BUG-105 / 107 / 108；Docker 精靈 BUG-097 / 111（需 Docker Desktop）
4. 🟢 清理：T0514 / T0515 / T0520 保留的 docker image（`node e2e/real-remote/t0520-env.mjs down --rmi` 等）
5. 🟢 backlog：recovery 重建 T0108 重登記 PTY 的 `shellArgs` 為空（T0525 §5-2）、Windows 檔案總管拷貝 → 路徑（`CF_HDROP`，T0524）、`*archive` 到齡候選（L133）、Codex 面板 Cache History、server-bundle `ubuntu-22.04` 2027-04-17 停用、PLAN-038、BUG-084 / PLAN-035 Phase 2、D094 復議、T0153 / T0360 清理

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）／發版說明（L150）
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。發版 run 完成後同一步 `gh release edit --notes-file` 寫發布說明。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open 0 / Fixing 0 / Fixed 12 / Closed 44）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D140）｜ Learnings → [_learnings.md](_learnings.md)（最大 L150）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（77 entries）

### 編號起始
- **T0526** / **BUG-132** / **PLAN-041** / **D141** / **EXP-[TOPIC]-001** / **L151**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.6.0-pre.8**（package.json + lock，2026-10-14 14:23 同步） |
| **最新 release** | `v0.6.0-pre.8`（2026-10-14 14:20，run `38520403729`，target `887ff20`，T0521-T0525：BUG-127-131；10 job 全綠）+ `server-bundle-v0.6.0-pre.8`（7 assets）。前一版 `v0.6.0-pre.7`（2026-10-14 04:43，run `38461996096`，target `b77f3cc`，T0513 / T0517-T0519：遠端狀態燈、SSH forwarding 被拒訊息、commands / skills 描述；10 job 全綠）+ `server-bundle-v0.6.0-pre.7`（7 assets）。前一版 `v0.6.0-pre.6`（2026-10-14 03:16，run `38450958394`，target `79b1275`，T0510-T0512：SSH 精靈安裝 / 啟動修正、Profile 對話框加寬）+ `server-bundle-v0.6.0-pre.6`（7 assets）。前一版 `v0.6.0-pre.5`（2026-10-14 01:38，run `38438114047`，target `7a6fb9c`，D139 批次 T0483–T0509）+ `server-bundle-v0.6.0-pre.5`（7 assets）。前一版 `v0.6.0-pre.4`（2026-10-13 23:04，run `38417070634`，target `da787a7`，含 BUG-119 userData 統一 / T0476-T0478；不含 T0483）+ `server-bundle-v0.6.0-pre.4`（7 assets）。前一版 `v0.6.0-pre.3`（2026-10-13 19:15，第五十八 session，run `38387358451`，target `c634327`；mac 只 arm64 dmg，D136）+ `server-bundle-v0.6.0-pre.3`（7 assets）。前一版 `v0.6.0-pre.2`（2026-10-05 13:07，第五十七 session，run `37265491592`，target `9cb7cd4`，含第五十五 / 五十六 session 全部改動）+ `server-bundle-v0.6.0-pre.2`（7 assets）；同時段另有一次派發 run `37265211762` 因 `version` 帶 `v` 前綴在 manifest 比對失敗，未建 tag |
| **前一 tag** | `v0.6.0-pre.7`（2026-10-14 04:43，`b77f3cc`） |
| **目前主軸** | pre.8 已發佈（BUG-127-131 FIXED）；等 Gary pre.8 回饋 → 結案 + PLAN-040 下一批 |
| **工單最大編號** | T0525（T0521-T0525 全 DONE；T0513-T0520 全 DONE；T0514-T0516 / T0520 為驗收單；T0520 pre.7 已安裝版驗收 17 PASS / 0 FAIL `a4fe1f5`） |
| **BUG 最大編號** | **BUG-131**（127-129 FIXED、130 / 131 FIXED）；Open 0 / Fixing 0 / Fixed 12（123-126 CLOSED：T0520 + 使用者 WSL 目視；097 / 105 / 107 / 108 / 111 待真人；116 / 118 待 Gary）/ Closed 44 |
| **PLAN 最大編號** | **PLAN-040**（PLANNED，工作區層級預設 Agent，下一批）；PLAN-039（**DONE** 2026-10-13）；PLAN-038（IDEA）；PLAN-036 / 037 / 035 / 031 IN_PROGRESS |
| **決策最大編號** | D140 |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower v5.0.9 |
| **unit test 基線** | **3642 passed / 216 files**（塔台聯合複驗 2026-10-14 13:58 @ `b00c4f9`；e2e smoke / t0512 / t0513 / t0523 / t0524 6 passed）；前次 3534 passed / 212 files / 1 skipped（塔台聯合複驗 2026-10-14 04:19 @ `5599ab1`；e2e smoke / navigation-guard / bug119 / t0512 / t0513 7 passed）；typecheck 0 / typecheck:electron 0 |

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
> 最後掃描:2026-10-14 14:47 (UTC+8) 第六十一 session 收工（Fast Path 局部更新；前次 Full Scan 2026-10-13 15:40）

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`, terminal `66447ea9…` |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（PowerShell 複核）；BUG-114 已於 pre.5 修正，待實機確認 |
| BAT 安裝版 | ✅ `v0.6.0-pre.7` | FileVersion 確認（2026-10-14 13:17）；pre.8 已發佈，使用者尚未確認換裝 |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ 單一目錄 | `%APPDATA%\BetterAgentTerminal\Logs\debug-<stamp>.log`（10-14 01:54 新檔）；`.userdata-migration.json` marker 存在（BUG-119） |
| 平台 | Windows | PowerShell 主，Bash tool 並存；repo 已有 `.gitattributes`（`* text=auto eol=lf`，T0493） |
| UAC | ⚠️ `EnableLUA=0` | BAT 與子 shell 皆提權（BUG-085 背景） |
| gh CLI | ✅ | 已登入 `gowerlin`；**必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | 收工 push 後 `main` = `origin/main`（2026-10-14 14:47）；`src/styles/settings.css` 顯示 M 但內容無差異（未處理） |
| WSL | dev-deploy + docker | `~/.local/bat-server` tag `t0456`（舊）；WSL 內 `docker.io` 29.1.3（T0467 安裝，保留） |
| ct-exec / ct-done / ct-status / evolve / insights / fieldguide / help | ✅ | |
| 熱區工單 | **T:171 檔 / BUG:56 / PLAN:12** | `archive_days: 2` 下大量到齡候選（先 grep 程式碼引用，L133） |
| 最大編號 | **T0525 / BUG-131 / PLAN-040 / D140 / L150** | 下張：T0526 / BUG-132 / PLAN-041 / D141 / L151 |
| unit test | ✅ **3642 passed / 216 files** | 塔台聯合複驗 @ `b00c4f9` |
| typecheck | ✅ src 0 / electron 0 | CI gate |
| e2e | ✅ smoke / t0512 / t0513 / t0523 / t0524 6 passed | 需先 `npx vite build` |
| 開放 PR | 0 | |
| 設定來源 | project | `_tower-config.yaml`（auto-session **on**） |
| 塔台版本 | v5.0.9 | control-tower skill |

> **Drift / 注意事項**:
> 1. 🔴 **D094 mac installer 280 MB cap 長期超標**未復議（L130）
> 2. ⚠️ `_ct-workorders/T0293-review-report.md` 含 2 個 NUL 位元組（既有）
> 3. ⚠️ **L132**：`T0292/T0293/T0298/T0302-*-report.md` 命名越界，維持現狀
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
