# Tower State — better-agent-terminal

> 最後更新:2026-10-14 03:40 (UTC+8) — **第六十 session 進行中**：**`v0.6.0-pre.7` 已發佈**（04:43，run `38461996096` @ `b77f3cc`，BUG-123-126）；T0514-T0516 自動化驗收結案 18 張。以下為第五十九 session 收工摘要 — pre.5 自動化實機驗收（T0510）→ SSH 精靈修正（T0511，BUG-120 / 121）∥ Profile 對話框版面（T0512，BUG-122）→ **`v0.6.0-pre.6` 已發佈**；BUG-114 / 119 CLOSED。
>
> **下次起手**:Fast Path 載入;確認使用者已安裝 `v0.6.0-pre.6`（FileVersion）→ 看 Profile 對話框（BUG-122）、真實 SSH 主機精靈（BUG-120 / 121）；Gary mac 驗收改用 pre.6 arm64 dmg。

---

## 🛏 本 Session 收工快照 (第五十九 session, 2026-10-14 01:55 - 03:17, ~1h22m wall)

### 主軸：塔台狀態整理 → pre.5 自動化實機驗收（T0510）→ 發現 SSH 精靈自 v0.4.1 起從未能完成 → T0511 ∥ T0512 → 聯合複驗 → `v0.6.0-pre.6`

#### 時間線（時間取自系統 / git）

1. **01:55** Fast Path 起手；安裝版確認為 pre.5（FileVersion、`BAT_USER_DATA`、新 Logs + migration marker）
2. **01:58** 第 2 項：補第五十八 session 快照、歸檔第五十五 session（INDEX 73-74），state 42.5 KB → 18 KB（`afcb116`）
3. **02:00** 開 / 派 **T0510**（安裝版 exe 隔離實例自動化實機驗收；`~/.ssh/config` 使用者裁決：先隔離、失敗再暫改）
4. **02:35** T0510 **PARTIAL**（`8994fff`）：A1-A5 PASS、A6-0 FAIL → 開 **BUG-120**（bundle `staging/`）/ **BUG-121**（port / bind 設定名稱 + verify）→ 派 **T0511**
5. **02:41** 使用者回報 Profile 對話框左欄空白 → 開 **BUG-122** → 派 **T0512**（與 T0511 並行，`--only` commit 隔離 WIP）
6. **02:48** 使用者：BUG-114 結案、遠端 client 不必重新配對 → **BUG-114 / BUG-119 CLOSED**
7. **02:51** **T0512 DONE**（`277b369`，根因：`profile-card*` 從未有 CSS）→ 塔台目視截圖確認
8. **02:55** **T0511 DONE**（`3df6218`）→ 塔台聯合複驗全綠（unit 206 files / 3474 passed、typecheck 雙 0、e2e 6 passed）
9. **02:57** 使用者同意 → push（`3718be9..79b1275`）+ run `38450958394` → **03:15 `v0.6.0-pre.6` 已發佈**；release notes 更正 pre.5 SSH 說法；`package.json` 同步（`3343a51`）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **3**（T0510-T0512） | T0510 PARTIAL（驗收工具，缺陷轉 BUG）、T0511 / T0512 DONE；皆一次啟動，mirror log 皆 `invoke-result` |
| 發版 | 1（`v0.6.0-pre.6`） | 10 job 全綠 |
| BUG | 新開 3（120-122）→ 皆 FIXED；CLOSED 2（114、119） | Open 0 / Fixed 25 / Closed 22 |
| 決策 | 0 | 使用者裁決記於 T0510 |
| Learnings | L148 | |
| unit test | 3455 → **3474 passed / 206 files** | |
| e2e | +`pre5-acceptance` / `pre5-ssh-alias`（opt-in）/ `t0512-profile-panel-layout` | |

### 重點觀察

- **L148**：只靠單元測試驗收的遠端安裝流程，可以多個版本「全綠但從未真的能用」；pre.5 release notes 還宣稱 alias 可走完。容器化的真流程 e2e（T0510）一次抓出兩個 v0.4.1 起的缺陷
- Playwright 可直接驅動安裝版 exe（fuses 未鎖），`executablePath` 在 Windows 要用正斜線
- Windows OpenSSH 不吃隔離 `USERPROFILE` / `HOME`，ssh config 隔離不可行 → 標記區塊 + 備份 / 雜湊還原可行

### 編號起始（下 session）

- **T0513** / **BUG-123** / **PLAN-040** / **D140** / **L149**

---

## 🛏 前 Session 收工快照 (第五十八 session, 2026-10-13 15:40 - 2026-10-14 01:40, ~10h wall)

> 第五十八 session 未寫收工快照，第五十九 session 起手時補記；詳細逐筆時間線見 `_archive/state-snapshots/2026-Q4.md`（INDEX 74）。第五十七 session（2026-10-05 13:08）僅發佈 `v0.6.0-pre.2`（@ `9cb7cd4`），一併記於該時間線。

### 主軸：mac 崩潰 / 打包修正 → pre.3；userData 統一 → pre.4；D139 已知問題整批（26 張）→ pre.5

- 15:40 Full Scan → BUG-116（mac whisper 載入崩潰）→ T0467（PLAN-039 實機驗收自動化，PLAN-039 **DONE**）∥ T0468
- T0469-T0475：opencc 延遲載入、mac CI 打包產物檢查、npm 12 `allowScripts`、BUG-117 / 118（D136 mac 只打 arm64）→ **`v0.6.0-pre.3`**（19:15）
- T0476-T0482：Homebrew / Chocolatey opt-in（D137）、README、BUG-119 userData 統一（D138）→ **`v0.6.0-pre.4`**（23:04）
- T0483-T0509：CLI 2.1.296 + Haiku 5.5、D139 整批（typecheck 雙 0、BUG-114 / 115 / 061、better-sqlite3 / sharp 移除、detached flush、SSH alias、精靈 i18n 等）→ **`v0.6.0-pre.5`**（10-14 01:38，run `38438114047`，@ `7a6fb9c`）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **43**（T0467-T0509） | 全 DONE |
| 發版 | 3（pre.3 / pre.4 / pre.5） | 各附 `server-bundle-v<版號>` 7 assets |
| BUG | 新開 4（116-119）；FIXED 7（061、114-119） | Open 0；Fixed 24 待實機 |
| PLAN | PLAN-039 → **DONE** | |
| 決策 | D136-D139 | |
| Learnings | L147 | |
| unit test | 2861 → **3455 passed / 204 files** | 塔台聯合複驗 @ `9085cfe` |
| typecheck | src 36 → **0**；electron 77 → **0** | CI `typecheck` job gate（T0495 / T0496） |
| e2e | 9 spec **14 passed** | smoke / bug119 / t0485 / detached ×4 / navigation-guard / plan039 |

### 重點觀察

- 使用者偏好：已知問題整批處理後才發一次版（記憶 `batch-fixes-before-release`）
- Worker 回報的「範圍外 / 殘餘風險」持續產出後續單（T0494 / T0497-T0509 多由此開出，延續 L145）

### 編號起始（下 session）

- **T0510** / **BUG-120** / **PLAN-040** / **D140** / **L148**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-14 03:17 UTC+8（第五十九 session 收工）

### 近期完成
- `v0.6.0-pre.6` 已發佈（10-14 03:15，@ `79b1275`）：SSH 精靈安裝 / 啟動修正（BUG-120 / 121，自 v0.4.1 起從未能完成）、Profile 對話框加寬（BUG-122）
- pre.5 自動化實機驗收 T0510（opt-in e2e：`pre5-acceptance` / `pre5-ssh-alias`）；BUG-114 / 119 CLOSED
- 第六十 session：BUG-122 CLOSED（使用者 pre.6 確認）；BUG-123（headless remote 狀態燈恆紅）→ T0513 DONE `90b35ee`（未發版，待 pre.7）
- BUG Open 0 / Fixed 25（待實機）/ Closed 40（本 session 結 18 張）；typecheck 雙 0；unit 3501 / 209 files

### 待辦（依優先序）

0. ✅ **`v0.6.0-pre.6` 已發佈**（2026-10-14 03:16，run `38450958394` @ `79b1275`，10 job 全綠；mac 52 Mach-O arm64 + 內嵌 claude ✅、linux ELF x86-64 ✅、bundle 頂層 `staging/` ✅；4 assets + `server-bundle-v0.6.0-pre.6` 7 assets；release notes 更正 pre.5 SSH 說法）。內容：T0511（BUG-120 / 121）+ T0512（BUG-122）+ T0510 驗收工具
1. 🟡 **pre.6 實機**：安裝 pre.6 後看 Profile 對話框版面（BUG-122）；有真實 SSH 主機時跑一次精靈（BUG-120 / 121）。**pre.5 實機驗收（Windows）**：T0510 PARTIAL（`8994fff`）——A1 Custom CLI / A2 detached / A3 BUG-119 runtime 路徑 / A4 BUG-119 真環境（間接證據）/ A5 BUG-114 22 次 0 遺失 全 PASS（BUG-114 / BUG-119 已 CLOSED，使用者確認遠端 client 不必重新配對）；A6 SSH stock install FAIL → BUG-120 / 121。仍需真人：BUG-119 升版後 server-token 不變 + 新 Logs 目錄；BUG-114 派單 Worker 確實啟動；Custom CLI Agents 新增後重啟仍在（T0496）；detached rename → 關窗 → 重啟仍在（T0504）；SSH alias（無 User、含 ProxyJump）精靈 6 項（T0505 / T0506）；其餘 Fixed BUG（拖放 / 附件 / 遠端視窗 fail-closed / Docker / 精靈）
2. 🟡 **mac 實機（Gary）**：BUG-116 / 117 / 118 + BUG-119 殘餘風險（升版後 server-token 不變 = Keychain，arm64 dmg）
3. 🟢 backlog：`*archive` 到齡候選（先 grep 程式碼引用，L133）、Codex 面板 Cache History 改用 `cache-history.ts`、server-bundle `ubuntu-22.04` 2027-04-17 停用（2027-03 前決定）、Haiku 5.5 CLI 版本門檻、PLAN-038、BUG-084 Phase 2、PLAN-035 Phase 2、Vite `hashbangRE` 上游回報
4. 🟢 L130 D094 mac 280 MB 門檻復議；舊單 T0153（PARTIAL）/ T0360（`FIXED` 非標準狀態）待清理

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open 0 / Fixing 0 / Fixed 11 / Closed 40）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D139）｜ Learnings → [_learnings.md](_learnings.md)（最大 L148）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（75 entries）

### 編號起始
- **T0521** / **BUG-127** / **PLAN-040** / **D140** / **EXP-[TOPIC]-001** / **L149**（T0520 pre.7 自動化驗收已派）

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.6.0-pre.7**（package.json + lock，2026-10-14 04:47 同步） |
| **最新 release** | `v0.6.0-pre.7`（2026-10-14 04:43，run `38461996096`，target `b77f3cc`，T0513 / T0517-T0519：遠端狀態燈、SSH forwarding 被拒訊息、commands / skills 描述；10 job 全綠）+ `server-bundle-v0.6.0-pre.7`（7 assets）。前一版 `v0.6.0-pre.6`（2026-10-14 03:16，run `38450958394`，target `79b1275`，T0510-T0512：SSH 精靈安裝 / 啟動修正、Profile 對話框加寬）+ `server-bundle-v0.6.0-pre.6`（7 assets）。前一版 `v0.6.0-pre.5`（2026-10-14 01:38，run `38438114047`，target `7a6fb9c`，D139 批次 T0483–T0509）+ `server-bundle-v0.6.0-pre.5`（7 assets）。前一版 `v0.6.0-pre.4`（2026-10-13 23:04，run `38417070634`，target `da787a7`，含 BUG-119 userData 統一 / T0476-T0478；不含 T0483）+ `server-bundle-v0.6.0-pre.4`（7 assets）。前一版 `v0.6.0-pre.3`（2026-10-13 19:15，第五十八 session，run `38387358451`，target `c634327`；mac 只 arm64 dmg，D136）+ `server-bundle-v0.6.0-pre.3`（7 assets）。前一版 `v0.6.0-pre.2`（2026-10-05 13:07，第五十七 session，run `37265491592`，target `9cb7cd4`，含第五十五 / 五十六 session 全部改動）+ `server-bundle-v0.6.0-pre.2`（7 assets）；同時段另有一次派發 run `37265211762` 因 `version` 帶 `v` 前綴在 manifest 比對失敗，未建 tag |
| **前一 tag** | `v0.6.0-pre.6`（2026-10-14 03:16，`79b1275`） |
| **目前主軸** | pre.7 實機（BUG-123 WSL 燈號）+ 真人 5 分鐘項（105 / 107 / 108）+ Docker 精靈（097 / 111）+ Gary mac（116 / 118） |
| **工單最大編號** | T0519（T0513-T0519 全 DONE；T0514-T0516 為驗收單；T0513 / T0517-T0519 待 pre.7） |
| **BUG 最大編號** | **BUG-126**；Open 0 / Fixing 0 / Fixed 11（123-126 待 pre.7；097 / 105 / 107 / 108 / 111 待真人；116 / 118 待 Gary）/ Closed 40 |
| **PLAN 最大編號** | PLAN-039（**DONE** 2026-10-13）；PLAN-038（IDEA）；PLAN-036 / 037 / 035 / 031 IN_PROGRESS |
| **決策最大編號** | D139 |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower v5.0.9 |
| **unit test 基線** | **3534 passed / 212 files** / 1 skipped（塔台聯合複驗 2026-10-14 04:19 @ `5599ab1`；e2e smoke / navigation-guard / bug119 / t0512 / t0513 7 passed）；typecheck 0 / typecheck:electron 0 |

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
> 最後掃描:2026-10-14 01:58 (UTC+8) 第五十九 session 起手（Fast Path 局部更新；前次 Full Scan 2026-10-13 15:40）

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`, terminal `66447ea9…` |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（PowerShell 複核）；BUG-114 已於 pre.5 修正，待實機確認 |
| BAT 安裝版 | ✅ `v0.6.0-pre.5`（收工時）| pre.6 已發佈，使用者收工後更版；下 session 以 FileVersion 確認 |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ 單一目錄 | `%APPDATA%\BetterAgentTerminal\Logs\debug-<stamp>.log`（10-14 01:54 新檔）；`.userdata-migration.json` marker 存在（BUG-119） |
| 平台 | Windows | PowerShell 主，Bash tool 並存；repo 已有 `.gitattributes`（`* text=auto eol=lf`，T0493） |
| UAC | ⚠️ `EnableLUA=0` | BAT 與子 shell 皆提權（BUG-085 背景） |
| gh CLI | ✅ | 已登入 `gowerlin`；**必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | 收工 push 後 `main` = `origin/main`（2026-10-14 03:17） |
| WSL | dev-deploy + docker | `~/.local/bat-server` tag `t0456`（舊）；WSL 內 `docker.io` 29.1.3（T0467 安裝，保留） |
| ct-exec / ct-done / ct-status / evolve / insights / fieldguide / help | ✅ | |
| 熱區工單 | **T:155 檔 / BUG:44 / PLAN:11** | `archive_days: 2` 下大量到齡候選（先 grep 程式碼引用，L133） |
| 最大編號 | **T0512 / BUG-122 / PLAN-039 / D139 / L148** | 下張：T0513 / BUG-123 / PLAN-040 / D140 / L149 |
| unit test | ✅ **3455 passed / 204 files** | 塔台聯合複驗 @ `9085cfe` |
| typecheck | ✅ src 0 / electron 0 | CI gate |
| e2e | ✅ 9 spec 14 passed | 需先 `npx vite build` |
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

- 2026-10-14 第五十九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0510-T0512（T0510 PARTIAL、T0511 / T0512 DONE），皆一次啟動；pre.6 發佈
- 2026-10-13 第五十八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0467-T0509 全 DONE；pre.3 / pre.4 / pre.5；逐筆見 2026-Q4.md「第五十七～五十八 session 時間線」
- 2026-10-05 第五十六 session：session-only yolo（Worker 互動不允許）；D135 PLAN-039 T0462-T0466 全 DONE、皆一次啟動；斷點 C×8 由塔台裁決；逐筆見 2026-Q4.md「YOLO 歷程（第五十六 session）」
- 2026-10-05 第五十五 session：session-only yolo；D134（45 列）全 DONE；斷點 C 由塔台裁決；派工未啟動 2 次 + commit 前停住 1 次（BUG-114）；逐筆見 2026-Q4.md「YOLO 歷程（第五十五 session）」
- 2026-10-04 第四十九 session：session-only yolo；T0365-T0374，含 2 次外部動作閘（bump + push + pre-release 由使用者授權）；逐筆見 2026-Q4.md「YOLO 歷程（第四十九 session）」
- 2026-04-18 第三 session：CT-T003 DELEGATE PARTIAL → DONE；`*evolve` L057-L066；`*archive` 活躍引用豁免測試
- 2026-04-18 T0174 Phase 2-6 session：T0173 研究 DONE；首次斷點 C（事後確認，L064）；使用者中斷「停」驗證
- 2026-04-18 上半場（PLAN-020 開發）：7 張本專案 + 1 跨專案 DELEGATE，全 DONE，無斷點
- 2026-04-18 下半場第二 session：T0174 Phase 0-1 dogfood（無派發）
