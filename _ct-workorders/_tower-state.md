# Tower State — better-agent-terminal

> 最後更新:2026-10-16 05:47 (UTC+8) — **第六十六 session 收工**：PLAN-041 重驗 DONE；舊單 / 全 PLAN 盤點；T0550 WSL 實機驗收（PLAN-036 / 037 DONE）；T0551–T0556（BUG-138–141、Worker 分頁標題、遠端 Node via nvm）→ **`v0.6.1-pre.5`**。
>
> **下次起手**:Fast Path 載入；本機 BAT 升 `0.6.1-pre.5` 後實機確認 Worker 分頁標題 / 收單回收時切換焦點不取消（BUG-140）/ WSL 工具面板 Node（nvm）；等 Gary BUG-136；SSH 主機升級與取消還原尚未實測。
---

## 🛏 本 Session 收工快照 (第六十六 session, 2026-10-16 02:12 - 05:47, ~3h35m wall)

### 主軸：PLAN-041 重驗（T0549）→ 待辦單據 / 全 PLAN 盤點 → T0550 WSL 實機驗收（PLAN-036 / 037）→ BUG-138–141 + Worker 分頁標題 + 遠端 Node via nvm（T0551–T0556）→ **`v0.6.1-pre.5`**

#### 時間線（時間取自系統 / git / gh）

1. **02:12** BAT 已升 pre.4 並重啟；Fast Path 起手。02:14 派 **T0549**（PLAN-041 重驗探針）→ 02:15 DONE；收單即 `--close-worker` exit 0、10 s 後關閉 → **PLAN-041 DONE**
2. **02:17-02:22** 使用者截圖的 Pending / Partial 單據：CT-T001 / CT-T011 / CT-T012 / T0510 → DONE；PLAN-014 DROPPED、T0153 ABANDONED；T0292 / T0293 / T0298 / T0302 報告檔搬入 `_archive/workorders/`（L132 改判）
3. **02:27-02:30** 全 PLAN 盤點：PLAN-031 / 033 / 035 DONE、新開 PLAN-043（IDEA，PLAN-035 Phase 2/3）、backlog 依檔案重建；派 **T0550**（WSL 實機驗收）
4. **02:44** T0550 DONE：WSL server 0.5.9-pre.4 → 0.6.1-pre.4（pre.4 線上下載 / 匯入路徑 PASS）、smoke 13/13 → **PLAN-036 / 037 DONE**；開 BUG-138（升級換 port）/ BUG-139（覆蓋殘留）；收單回收被取消 → 使用者確認只切換焦點 → BUG-140
5. **02:51-04:53** 依序派：**T0551**（BUG-140）`92655e00` → **T0552**（BUG-138 / 139）`f599f915` → **T0553**（Worker 分頁標題，使用者需求）`bb9b9ddf` → **T0554**（BUG-141，T0552 殘餘風險）`38fe7421` → **T0555**（遠端 Node 一鍵安裝 via nvm，使用者需求）`e9cae8d8` PARTIAL → **T0556**（login profile 片段）`e16e75b8` → T0555 補正 DONE
6. **05:10** 回歸：build 0、e2e 6 passed / 8 skipped（WSL opt-in）；使用者同意發版 → bump `6ad3c089` + push + run `38808244923` → **05:23 `v0.6.1-pre.5` 已發佈**（10 job 全綠、server-bundle 7 assets），更版重點已寫
7. WSL 上 T0550–T0556 留下的備份依使用者指示全部刪除（03:37 / 04:2x / 05:12）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **8**（T0549-T0556） | 全 DONE / FIXED（T0555 經 T0556 補正）；皆一次啟動 |
| 補正 / 結案舊單 | CT-T001 / 011 / 012、T0510 DONE；T0153 ABANDONED；4 份報告檔歸檔 | |
| PLAN | DONE 041 / 036 / 037 / 031 / 033 / 035；DROPPED 014；新開 043（IDEA） | 進行中 0 |
| BUG | 新開 4（138–141）皆 FIXED | Open 1（BUG-136）/ Fixed 21 / Closed 44 |
| 發版 | 1（`v0.6.1-pre.5`） | exe 298.0 / zip 412.3 / AppImage 297.3 / dmg 309.7 MiB |
| unit test | 4073 → **4372 passed / 253 files** | 每張單塔台聯合複驗；typecheck 0 / 0 |

### 重點觀察

- PLAN-041 等安靜分支在 T0552 收單時首次真實觸發（`still printing` → `close requested after waiting 0.4 s`），正常
- 新建單據檔是未追蹤檔，`git commit --only <新檔>` 會 pathspec 失敗 → 先 `git add` 再 `--only`（T0549、BUG-141 / T0554 各踩一次）
- T0553 / T0554 Worker 未 commit 工單檔與 BUG 檔，由塔台收單時一併 commit
- 收單只看 exit code 時，回收被取消塔台不會知道；本次靠讀 `[close-worker]` 日誌發現 BUG-140

### 編號起始（下 session）

- **T0557** / **BUG-142** / **PLAN-044** / **D147** / **L152** / **CT-T013**

---

## 🛏 前 Session 收工快照 (第六十五 session, 2026-10-15 19:54 - 10-16 02:11, ~6h17m wall，含 20:35-01:09 使用者離開)

### 主軸：`*rescan` → PLAN-041 實機驗收（T0542 / T0543）→ D145 / T0545 → T0544 安裝檔研究 → D146 / T0546-T0548 → **`v0.6.1-pre.4`**

#### 時間線（時間取自系統 / git / gh）

1. **19:54** Fast Path 起手（Control Tower v5.1.0 生效）；19:57 `*rescan` Full Scan（`8e8eb568`；WSL bat-server 仍 0.5.9-pre.4）
2. **20:00** 使用者「PLAN-041 安排自動驗收」→ 開 T0542（claude 探針）/ T0543（codex 探針）、`worker_auto_close: done`（`696b4900`）；T0542 20:01 DONE → 收單後 9 s 呼叫 `--close-worker` 得 **exit 6 BUSY**（claude 通知後約 6 s 仍輸出），30 / 90 s 後 exit 0，10 s 延遲回收成功、無殘留
3. **20:03** 派 T0543（codex）→ 使用者無 codex 付費帳號「不驗」→ 塔台直接探測 codex 分頁閒置 3 次 exit 0、20:06 回收；T0543 ABANDONED
4. **20:06** 派 **T0544**（安裝檔研究）；20:12 使用者選「BAT：等安靜再關」並放寬等待 → **D145** / 派 **T0545** → 20:25 DONE（`2321c719`）
5. **20:30** T0544 DONE（`0c3c79e9`）：組成實測（baseline 228–455、重複 claude.exe、SDK 內建 claude、asar 用不到的套件…）→ 20:33 塔台直接開第一階段 **T0546** → 21:09 DONE（`dc64388d`）
6. **10-16 01:09** 使用者回覆：做 A（不內建 baseline）+ 匯入本機 tarball、codex 繼續內建 → **D146** / 01:11 派 **T0547** → 01:39 DONE（`73b7aa96`；`compression: maximum` 對 NSIS 無效）；刪除 T0544 暫存（11 GB）
7. **01:40** 派 **T0548**（win normal 壓縮、e2e / release.ps1 不讀安裝目錄 baseline、下載重試分類）→ 01:56 DONE（`c389888b`）
8. **01:59** 使用者同意發版 → bump + push + run `38781893001` → **02:08 `v0.6.1-pre.4` 已發佈**（10 job 全綠），更版重點已寫；D146 定案取代 D094（`5eeb19d9`）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **7**（T0542-T0548） | 6 DONE、T0543 ABANDONED；皆一次啟動 |
| 發版 | 1（`v0.6.1-pre.4`） | exe 298.0 / zip 412.3 / AppImage 297.3 / dmg 309.6 MiB（pre.3：693.9 / 868.8 / 1030.7 / 871.9） |
| 決策 | D145 / D146 | D146 取代 D094（每平台 ≤ 320 MiB、zip ≤ 450） |
| PLAN | PLAN-041 仍 IN_PROGRESS | 待本機升 pre.4 後重驗 |
| unit test | 3939 → **4073 passed / 243 files** | 每張單塔台聯合複驗 |

### 重點觀察

- CT v5.1.0 收單即回收在 pre.3 上 6 次全部 exit 6（claude 回報後仍輸出收尾）→ D145 修在 BAT；pre.4 起應 exit 0
- 塔台建 T0544 時曾手打 `created_at`，發現後改取系統時間（R-G001）；之後新單一律以 `__TS__` 佔位再代入 `date`
- T0547 對「Windows fetch 錯誤無 `cause.code`」的判斷有誤（實為 9 號埠被 fetch 封鎖），T0548 已更正並寫入 CLAUDE.md；Worker 根因結論仍需下一張單複核

### 編號起始（下 session）

- **T0549** / **BUG-138** / **PLAN-043** / **D147** / **L151** / **CT-T013**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-16 05:47 UTC+8（第六十六 session 收工）

### 近期完成
- `v0.6.1-pre.5`（10-16 05:23，run `38808244923` @ `6ad3c089`）：BUG-138–141（WSL / SSH 精靈升級沿用 port / profile、乾淨覆蓋、取消還原；Worker 回收不被焦點切換取消）、Worker 分頁標題（T0553）、遠端 Node.js via nvm（T0555 / T0556）
- PLAN-041 / 036 / 037 / 031 / 033 / 035 DONE、PLAN-014 DROPPED；進行中 PLAN 0（IDEA：015 / 029 / 038 / 043）
- WSL `Ubuntu-24.04` server = 0.6.1-pre.4（9877），nvm + Node 24.22.0，`~/.profile` 有 BAT nvm 片段；所有驗收備份已刪
- `v0.6.1-pre.4`（10-16 02:08）：安裝檔瘦身（D146）、`--close-worker` 等安靜（D145）
- unit 4372 passed / 253 files；`worker_auto_close: done`（10 s）

### 待辦（依優先序）

1. 🟡 **pre.5 實機**（本機 BAT 升級後）：Worker 分頁標題 `Claude CLI · Worker · T####` / 回報 ✓；收單回收期間切換焦點仍關閉（BUG-140）；WSL 工具面板 Node（nvm chip、更新）；T0550 需真人 6 項（見 T0550 回報區）；SSH 主機升級 / 取消還原（只有單元測試）；WSL server 升 pre.5（重跑精靈 = 驗 BUG-138 / 139 / 141）
2. 🟡 **BUG-136**（Gary macOS 打字延遲）：等 Gary 回傳 `debug-*.log`（`[gpu]` 行）/ `.ips` / CPU
3. 🟡 前期驗收：Gary BUG-127-135 / 116 / 118；使用者 Windows BUG-130、真人項 BUG-105 / 107 / 108、Docker BUG-097 / 111；BUG-138–141 待 pre.5 驗收後 CLOSED；dmg / AppImage 啟動、NSIS 完整重裝
4. 🟢 後續小項：T0550 spec 的 `A3.clean-install`「目錄變小」只適用跨版升級（T0554 #5）；zsh `~/.zprofile` 的 nvm 載入（T0556 範圍外）；`docs/server-bundle-distribution.md` rate-limit 敘述（T0548 #5）
5. 🟢 程式碼簽章等使用者帳號；`*archive` 到齡候選

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）／更版重點必寫（L150 → `_local-rules.md`）
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。**每次發版** run 完成後同一步 `gh release edit --notes-file` 寫更版重點，`gh release view --json body` 確認後才回報已發佈。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open 1 / Fixing 0 / Fixed 21 / Closed 44）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D146）｜ Learnings → [_learnings.md](_learnings.md)（最大 L151）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（82 entries）

### 編號起始
- **T0557** / **BUG-142** / **PLAN-044** / **D147** / **EXP-[TOPIC]-001** / **L152** / **CT-T013**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.6.1-pre.5**（package.json + lock，2026-10-16 05:13 `6ad3c089`） |
| **最新 release** | `v0.6.1-pre.5`（2026-10-16 05:23，run `38808244923`，target `6ad3c089`：BUG-138–141、Worker 分頁標題 T0553、遠端 Node.js via nvm T0555 / T0556；更版重點已寫）+ `server-bundle-v0.6.1-pre.5`（7 assets）。前一版 `v0.6.1-pre.4`（2026-10-16 02:08，run `38781893001`，target `e3e86496`：T0545 等安靜再回收、T0546-T0548 安裝檔瘦身）+ `server-bundle-v0.6.1-pre.4`（7 assets）。前一版 `v0.6.1-pre.3`（2026-10-15 18:06，run `38715587426`，target `95d1f8e5`：PLAN-041 Worker 分頁回收 + 分頁標示 / 批次關閉、BUG-137、T0540 程序樹、claude 2.1.300）+ `server-bundle-v0.6.1-pre.3`（7 assets）。前一版 `v0.6.1-pre.2`（2026-10-15 13:39，run `38686989923`，target `9dde59f3`，T0533 GPU 日誌）。再前 `v0.6.1-pre.1`（2026-10-15 02:05，`e715c2b1`，BUG-135）、`v0.6.0-pre.11`（01:47，`49af84ca`，BUG-134）。更早見 `_archive/state-snapshots/2026-Q4.md` |
| **前一 tag** | `v0.6.1-pre.4`（2026-10-16 02:08，`e3e86496`） |
| **目前主軸** | `v0.6.1-pre.5` 已發佈；待本機升 pre.5 實機確認；BUG-136 等 Gary；進行中 PLAN 0 |
| **工單最大編號** | T0556（DONE `e16e75b8`）；T0549–T0556 全 DONE / FIXED（T0555 經 T0556 補正）；跨專案 CT-T012 |
| **BUG 最大編號** | **BUG-141**（FIXED，T0554）；Open 1（BUG-136）/ Fixing 0 / Fixed 21（含 BUG-138–141，待 pre.5 驗收）/ Closed 44 |
| **PLAN 最大編號** | **PLAN-043**（IDEA）；PLAN-036 / 037 DONE（T0550，2026-10-16）；PLAN-015 / 029 / 038 / 043 IDEA；PLAN-041 / 035 / 033 / 031 DONE（2026-10-16）；PLAN-014 DROPPED |
| **決策最大編號** | D146 |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower v5.1.0（第六十五 session 起生效；`worker_auto_close: done`） |
| **unit test 基線** | **4372 passed / 253 files / 3 skipped**（塔台複驗 T0556 @ `fec2a112`）；typecheck 0 / typecheck:electron 0；pre.5 回歸 e2e 6 passed / 8 skipped（WSL opt-in） |

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
| BAT 安裝版 | ✅ `0.6.1-pre.5` | 2026-10-16 13:47 第六十七 session 起手確認（FileVersion） |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ 單一目錄 | `%APPDATA%\BetterAgentTerminal\Logs\debug-20261015-195413.log`（本次啟動）；`.userdata-migration.json` marker 存在 |
| 平台 | Windows 11 | PowerShell 主，Bash tool 並存；node `v24.22.0` / npm `12.2.0`；`.gitattributes` `* text=auto eol=lf` |
| UAC | ⚠️ `EnableLUA=0` | BAT 與子 shell 皆提權（BUG-085 背景） |
| gh CLI | ✅ | 已登入 `gowerlin`（keyring）；**必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `main` = `origin/main` @ `2b983a79`（fetch 後）；無其他 worktree / stash；`src/styles/settings.css` 顯示 M 但 `git diff` 無內容（stat-only，未處理） |
| 最新 CI / release | ✅ | Pre-Release run `38715587426` success → `v0.6.1-pre.3` + `server-bundle-v0.6.1-pre.3`；開放 PR 0 |
| WSL | Ubuntu-24.04 | `~/.local/bat-server` = `0.6.1-pre.4`（T0550 / T0552 / T0554，port 9877，systemd user service active）；nvm 0.40.8 + Node 24.22.0（T0555 / T0556）；`docker.io` 29.1.3 |
| Control Tower skills | ✅ v5.1.0 | control-tower / ct-exec / ct-done / ct-status / ct-evolve / ct-insights / ct-fieldguide / ct-help 全為 5.1.0 |
| 熱區單據 | **T:187 檔 / BUG:62 / PLAN:14 / EXP:0** | `archive_days: 2` 下大量到齡候選（歸檔前先 grep 程式碼引用，L133） |
| 最大編號 | **T0556 / BUG-141 / PLAN-043 / D146 / L151 / CT-T012** | 下張：T0557 / BUG-142 / PLAN-044 / D147 / L152 / CT-T013（第六十六 session 收工時） |
| 非終態工單 | T0360 FIXED（舊單） | 第六十六 session 已補正 T0510 / T0153 / CT-T001 / 011 / 012；報告檔 T0292 / 293 / 298 / 302 已歸檔 |
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
