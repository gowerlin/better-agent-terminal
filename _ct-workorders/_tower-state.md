# Tower State — better-agent-terminal

> 最後更新:2026-10-14 01:58 (UTC+8) — **第五十九 session 起手整理**：第五十八 session（10-13 15:40 - 10-14 01:40）補收工快照；第五十五 session 快照與第五十七～五十八 session 詳細時間線歸檔至 `_archive/state-snapshots/2026-Q4.md`（INDEX 73-74）；起手式改寫為 pre.5 後狀態。
>
> **下次起手**:Fast Path 載入;安裝版應為 `v0.6.0-pre.5`；進行 pre.5 實機驗收（見起手式待辦 1）。

---

## 🛏 本 Session 收工快照 (第五十八 session, 2026-10-13 15:40 - 2026-10-14 01:40, ~10h wall)

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

## 🛏 前 Session 收工快照 (第五十六 session, 2026-10-05 11:40 - 12:33, ~53m wall)

### 主軸：PLAN-039 多 remote profile 同時連線——YOLO 自主派發 T0462-T0466 全 DONE → 聯合複驗 → push → 本機重打包待安裝

#### 起手狀態

Fast Path（快照 11:34，6 分鐘前）。git 領先 9（第五十五 session 收工 commits 未 push）；BAT 安裝版 `F81C9FF4…`（05:28，不含第五十五 session 改動）。使用者選「派 T0462 ∥ T0465 + YOLO（session-only）」、Worker 互動「不允許」（`--no-interactive`）。

#### 時間線（時間取自系統 / git）

1. **11:42** 派 T0462 ∥ T0465（D135 第 1 / 4 列；`affects_files` 僅 `electron/remote/__tests__/` 目錄重疊，新檔不同 → 可平行）
2. **11:49-11:50** T0465 DONE（`b677e71`，SSH tunnel 動態埠 bind 失敗換埠重試一次 + 固定埠重複 warn）、T0462 DONE（`470f81a`，`RemoteConnectionRegistry` 模組）→ 派 T0463 前補「塔台補充」（T0462 接線備註、T0465 port claim 必經 `client.disconnect()`）
3. **11:50-12:02** T0463 DONE（`8604daa`，`main.ts` 單一 `remoteClient` 槽位 → registry；`other-profile` 移除；two-servers 整合測試）→ 塔台補跑 vite build
4. **12:03-12:14** T0464 DONE（`48cba04`，quit await ≤ 2 s、`'limit'` reason + 三語對話框、同 target warn、lifecycle 測試；修正首窗保護被降級）→ 塔台補跑 vite build
5. **12:14-12:22** T0466 DONE（`6bd81f6`，e2e 兩個 isolated 實例互為 server，M1-M4 4/4；CLAUDE.md 新節 + docs 實機步驟）→ PLAN-039 → IN_PROGRESS（待實機）
6. **12:22-12:28** 塔台聯合複驗 @ `26db914`：vite ✅、unit 168 files / 2861 ✅、e2e 首輪 1 failed（偶發，未保留名）→ 再跑 3 輪 12 passed / 8 skipped / 0 failed
7. **12:28-12:30** 使用者選「push + 重打包」→ push `6286c11..0d03fc7`；`release.ps1 -Snapshot` 失敗 → **BUG-115**；改不帶 `-Snapshot` 重打包成功（新 `app.asar` `8D76B219…16AA6`），待使用者安裝
8. **12:33** 使用者「收工」

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **5**（T0462-T0466） | 全 DONE；皆一次啟動成功（BUG-114 未復現）；平行 1 組（T0462 ∥ T0465） |
| BUG | 新開 1（BUG-115 low） | Open：061 / 114 / 115；Fixed 17 待實機 |
| PLAN | PLAN-039 PLANNED → **IN_PROGRESS**（程式完成） | 待 WSL + SSH 同開實機驗收後 DONE |
| 決策 | 0（沿用 D135） | 斷點 C × 8 由塔台裁決，記於 YOLO 歷程 |
| Learnings | L146 | |
| unit test | 2646（@ `2f8237d`）→ **2861 passed / 168 files**（塔台聯合複驗 @ `26db914`） | 0 failed |
| tsc | **36**（不變） | ⚠️ 只涵蓋 `src/`（L146）；electron 型別由 Worker 以 scratchpad tsconfig 補檢 0 新錯 |
| e2e | 8 → **12 passed** / 8 skipped / 0 failed | +`e2e/plan039-multi-remote.spec.ts`（4）；首輪偶發 1 failed 未重現 |
| push | `6286c11..0d03fc7` | BUG-115 / 收工 commits 未 push |
| 本機打包 | `release\BetterAgentTerminal Setup 0.6.0-pre.1.exe` @ `0d03fc7` | **未安裝**；新 `app.asar` SHA-256 `8D76B219…16AA6` |
| 塔台直接改動 | T0463 / T0464 / T0466 工單「塔台補充」+ `affects_files` 補列；PLAN-039 狀態；`_backlog.md` / `_bug-tracker.md` 同步；BUG-115 開單 | |

### 重點觀察 / Learnings

- **L146**：`npx tsc --noEmit` gate 只涵蓋 `src/`（`tsconfig.json` include），改 `electron/**` 的單需另檢 electron 型別
- 派發前把前序工單回報區的「接線備註 / 剩餘範圍」轉寫進下一張工單的「塔台補充」，T0463 / T0464 / T0466 皆零返工
- `release.ps1 -Snapshot` 不可用（BUG-115）；本機打包暫以 package.json 版號 + 雜湊驗換新

### 編號起始（下 session）

- **T0467** / **BUG-116** / **PLAN-040** / **D136** / **L147**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-14 01:58 UTC+8（第五十九 session 起手整理）

### 近期完成
- `v0.6.0-pre.5` 已發佈（10-14 01:38，@ `7a6fb9c`），本機已安裝（FileVersion `0.6.0-pre.5`）
- D139 整批 T0483-T0509 全 DONE；BUG Open 0 / Fixed 24（待實機）
- typecheck src / electron 皆 0；unit 3455 / 204 files；e2e 14 passed

### 待辦（依優先序）

0. 🔴 **T0511**（BUG-120 / 121，SSH wizard 安裝 / 啟動；2026-10-14 02:37 派發）→ 完成後併入 pre.6 批次；**T0512**（BUG-122，Profile 對話框版面，與 T0511 並行）
1. 🟡 **pre.5 實機驗收（Windows）**：T0510 PARTIAL（`8994fff`）——A1 Custom CLI / A2 detached / A3 BUG-119 runtime 路徑 / A4 BUG-119 真環境（間接證據）/ A5 BUG-114 22 次 0 遺失 全 PASS；A6 SSH stock install FAIL → BUG-120 / 121。仍需真人：BUG-119 升版後 server-token 不變 + 新 Logs 目錄；BUG-114 派單 Worker 確實啟動；Custom CLI Agents 新增後重啟仍在（T0496）；detached rename → 關窗 → 重啟仍在（T0504）；SSH alias（無 User、含 ProxyJump）精靈 6 項（T0505 / T0506）；其餘 Fixed BUG（拖放 / 附件 / 遠端視窗 fail-closed / Docker / 精靈）
2. 🟡 **mac 實機（Gary）**：BUG-116 / 117 / 118 + Keychain（arm64 dmg）
3. 🟢 backlog：`*archive` 到齡候選（先 grep 程式碼引用，L133）、Codex 面板 Cache History 改用 `cache-history.ts`、server-bundle `ubuntu-22.04` 2027-04-17 停用（2027-03 前決定）、Haiku 5.5 CLI 版本門檻、PLAN-038、BUG-084 Phase 2、PLAN-035 Phase 2、Vite `hashbangRE` 上游回報
4. 🟢 L130 D094 mac 280 MB 門檻復議；舊單 T0153（PARTIAL）/ T0360（`FIXED` 非標準狀態）待清理

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open 0 / Fixing 3 / Fixed 24 / Closed 20）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D139）｜ Learnings → [_learnings.md](_learnings.md)（最大 L147）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（74 entries）

### 編號起始
- **T0513** / **BUG-123** / **PLAN-040** / **D140** / **EXP-[TOPIC]-001** / **L148**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.6.0-pre.5**（package.json + lock，2026-10-14 01:40 同步） |
| **最新 release** | `v0.6.0-pre.5`（2026-10-14 01:38，run `38438114047`，target `7a6fb9c`，D139 批次 T0483–T0509）+ `server-bundle-v0.6.0-pre.5`（7 assets）。前一版 `v0.6.0-pre.4`（2026-10-13 23:04，run `38417070634`，target `da787a7`，含 BUG-119 userData 統一 / T0476-T0478；不含 T0483）+ `server-bundle-v0.6.0-pre.4`（7 assets）。前一版 `v0.6.0-pre.3`（2026-10-13 19:15，第五十八 session，run `38387358451`，target `c634327`；mac 只 arm64 dmg，D136）+ `server-bundle-v0.6.0-pre.3`（7 assets）。前一版 `v0.6.0-pre.2`（2026-10-05 13:07，第五十七 session，run `37265491592`，target `9cb7cd4`，含第五十五 / 五十六 session 全部改動）+ `server-bundle-v0.6.0-pre.2`（7 assets）；同時段另有一次派發 run `37265211762` 因 `version` 帶 `v` 前綴在 manifest 比對失敗，未建 tag |
| **前一 tag** | `v0.6.0-pre.4`（2026-10-13 23:04，`da787a7`） |
| **目前主軸** | pre.5 實機驗收（Windows 本機 + Gary mac）→ 依結果 CLOSE Fixed 24 張 |
| **工單最大編號** | T0512（T0510 PARTIAL；T0511 SSH wizard ∥ T0512 Profile 版面） |
| **BUG 最大編號** | **BUG-122**；Open 0 / Fixing 3（120、121 → T0511；122 → T0512）/ Fixed 24（待實機）/ Closed 20 |
| **PLAN 最大編號** | PLAN-039（**DONE** 2026-10-13）；PLAN-038（IDEA）；PLAN-036 / 037 / 035 / 031 IN_PROGRESS |
| **決策最大編號** | D139 |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower v5.0.9 |
| **unit test 基線** | **3455 passed / 204 files** / 1 skipped（塔台聯合複驗 @ `9085cfe`）；e2e 9 spec 14 passed；**typecheck 0 / typecheck:electron 0** |

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
| BAT 安裝版 | ✅ `v0.6.0-pre.5` release | 執行中 FileVersion `0.6.0-pre.5`；`app.asar` mtime 2026-10-14 01:34；PTY 帶 `BAT_USER_DATA`（T0481） |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ 單一目錄 | `%APPDATA%\BetterAgentTerminal\Logs\debug-<stamp>.log`（10-14 01:54 新檔）；`.userdata-migration.json` marker 存在（BUG-119） |
| 平台 | Windows | PowerShell 主，Bash tool 並存；repo 已有 `.gitattributes`（`* text=auto eol=lf`，T0493） |
| UAC | ⚠️ `EnableLUA=0` | BAT 與子 shell 皆提權（BUG-085 背景） |
| gh CLI | ✅ | 已登入 `gowerlin`；**必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `main` = `origin/main` = `3718be9`（10-14 01:55 fetch 後），working tree 乾淨 |
| WSL | dev-deploy + docker | `~/.local/bat-server` tag `t0456`（舊）；WSL 內 `docker.io` 29.1.3（T0467 安裝，保留） |
| ct-exec / ct-done / ct-status / evolve / insights / fieldguide / help | ✅ | |
| 熱區工單 | **T:155 檔 / BUG:44 / PLAN:11** | `archive_days: 2` 下大量到齡候選（先 grep 程式碼引用，L133） |
| 最大編號 | **T0512 / BUG-122 / PLAN-039 / D139 / L147** | 下張：T0513 / BUG-123 / PLAN-040 / D140 / L148 |
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

- 2026-10-13 第五十八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0467-T0509 全 DONE；pre.3 / pre.4 / pre.5；逐筆見 2026-Q4.md「第五十七～五十八 session 時間線」
- 2026-10-05 第五十六 session：session-only yolo（Worker 互動不允許）；D135 PLAN-039 T0462-T0466 全 DONE、皆一次啟動；斷點 C×8 由塔台裁決；逐筆見 2026-Q4.md「YOLO 歷程（第五十六 session）」
- 2026-10-05 第五十五 session：session-only yolo；D134（45 列）全 DONE；斷點 C 由塔台裁決；派工未啟動 2 次 + commit 前停住 1 次（BUG-114）；逐筆見 2026-Q4.md「YOLO 歷程（第五十五 session）」
- 2026-10-04 第四十九 session：session-only yolo；T0365-T0374，含 2 次外部動作閘（bump + push + pre-release 由使用者授權）；逐筆見 2026-Q4.md「YOLO 歷程（第四十九 session）」
- 2026-04-18 第三 session：CT-T003 DELEGATE PARTIAL → DONE；`*evolve` L057-L066；`*archive` 活躍引用豁免測試
- 2026-04-18 T0174 Phase 2-6 session：T0173 研究 DONE；首次斷點 C（事後確認，L064）；使用者中斷「停」驗證
- 2026-04-18 上半場（PLAN-020 開發）：7 張本專案 + 1 跨專案 DELEGATE，全 DONE，無斷點
- 2026-04-18 下半場第二 session：T0174 Phase 0-1 dogfood（無派發）
