# Tower State — better-agent-terminal

> 最後更新:2026-10-05 11:34 (UTC+8) — **第五十五 session 收工** — YOLO（session-only）派發並完成 **45 張**（T0417-T0461）；BUG 新開 8（107-114）、FIXED 13（096-100 / 106-113）；PLAN-036 K（遠端 Tower 通知）程式完成 + WSL smoke 13/13；安全 review T0445 九條全修；最終聯合複驗全綠；push `e11a2f6..6286c11`。PLAN-039 拆 T0462-T0466 待下 session。
>
> **下次起手**:Fast Path 載入;**第一件事：PLAN-039 起派 T0462 ∥ T0465**（D135）；另待使用者決定是否重打包本機 build 做本批實機驗收（起手式）。
>
> **前次更新**:2026-10-05 05:26 (UTC+8) — 第五十四 session 收工。

---

## 🛏 本 Session 收工快照 (第五十五 session, 2026-10-05 05:30 - 11:34, ~6h04m wall，含 07:46-11:19 使用者離開)

### 主軸：收工待辦第 3、4 項 → YOLO 自主派發（D134）→ 遠端安全 / 精靈 / 附件路徑 / K 遠端 Tower 通知 → 安全 review BLOCK 與修復 → 最終聯合複驗 → push → PLAN-039 研究與拆單

#### 起手狀態

Fast Path（快照 05:26）。git 0/1（收工快照未 push）；BAT 安裝版 = 本機 build `0.6.0-pre.1`（`app.asar` 05:28，與 `release\win-unpacked` 同雜湊）。使用者 `*config auto-session yolo`（未 `--save`）。

#### 時間線（時間取自系統 / git）

1. **05:33-05:38** 使用者選第 3、4 項 + 批 1-3 範圍、BUG-106 移除、BUG-098 移除 direct → D134 → 第一波 5 張（T0417-T0421）
2. **05:41-06:01** T0417-T0419、T0422-T0425、T0428-T0431、T0435 完成；05:46 斷點 C 合併裁決（T0427-T0430）；**05:55 使用者授權「塔台給最佳建議, 直接決定」**；T0420 → K 採 A'（每 PTY 範圍權杖）→ T0431-T0434；T0421 → BUG-107 / 108 / 109、PLAN-038、T0435-T0441
3. **06:08-06:34** T0431、T0442、T0426、T0443、T0427 完成；開 BUG-110（遠端視窗 fail-open）/ BUG-111（精靈 rollback 刪使用者容器）/ PLAN-039；T0432 權杖 → **T0445 安全 review BLOCK**（1 critical + 2 high）→ T0447-T0451
4. **06:37-07:05** T0433、T0444、T0446、T0447（BLOCK 解除）、T0448、T0449、T0453、T0436（ct-done 補救）、T0441、T0450、T0451 完成；BUG-112（detached fail-open）/ BUG-113（detach 自 `512c118` 失效）；CRLF 根因定位（T0454）
5. **07:07-07:20** T0434 / T0455 / T0456 完成；**WSL dev deploy `t0456` + smoke 13/13**（使用者授權）；T0454 定位 Vite `hashbangRE` 不容 `\r`；T0452 派發未啟動 → 重派；使用者修正「30 秒太快」
6. **07:28-07:46** T0437-T0440、T0452、T0457（重派）、T0458（detached 視窗外部頁取得 `electronAPI`，e2e 證實）完成；D134 第 1-42 列完成 → 最終聯合複驗全綠 → `*sync`
7. **11:19-11:31** 使用者：push（86 commits）、開 PLAN-039 研究、可執行檔確認框 → T0459 / T0460 / T0461 完成；PLAN-039 拆單 D135（下 session）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **45**（T0417-T0461） | 全 DONE；研究 3（T0420 / T0421 / T0459）+ 安全 review 1（T0445）；Worker 未啟動重派 2（T0452 / T0457）、ct-done 補救 1（T0436） |
| 開單未派 | 5（T0462-T0466） | PLAN-039，D135 |
| BUG | 新開 8（107-114）；FIXED 13（096-100、106-113） | Open：061 / 114；Fixed 17 待實機；BUG-105 FIXED 延伸（T0437-T0440） |
| PLAN | 新開 2（PLAN-038 IDEA、PLAN-039 PLANNED） | PLAN-036 K 完成（P3 剩無） |
| 決策 | 2（D134 排程 1-45 列、D135） | |
| Learnings | L142-L145 | |
| unit test | 1867 → **2646**（塔台聯合複驗 @ `2f8237d`）→ Worker 2768（@ `0061e3d`） | 0 failed；CRLF worktree 亦全綠 |
| tsc | 40 → **36** | |
| e2e | 6 → **8 passed** / 8 skipped / 0 failed | +T0453 / T0458 spec |
| WSL | dev deploy 1 次（tag `t0456`）；smoke **13/13** | |
| push | `e11a2f6..6286c11`（86 commits） | 未發版 |
| 塔台直接改動 | `_local-rules.md` 遠端派單路由（agent 模式 + `BAT_HELPER_NODE`）、`_bug-tracker.md` / `_backlog.md` sync、記憶 2 則 | |

### 重點觀察 / Learnings

- **L142**：「只在某環境壞」不以環境異常結案——CRLF（autocrlf + 無 `.gitattributes`）+ Vite `/^#!.*\n/`
- **L143**：`bat-terminal` exit 0 ≠ Worker 已啟動；≥ 3 分鐘無 `started_at` 才疑似、重派前確認原 Worker 無活動（BUG-114）
- **L144**：同工作樹平行改熱點檔——`git apply --cached` 精準 stage；聯合複驗用乾淨 worktree
- **L145**：Worker 回報「範圍外 / 殘留風險」藏 high 級問題（6 個 high 中 5 個由此發現）
- 使用者偏好：scope 內斷點 C 由塔台直接裁決、事後回報（記憶 `tower-decide-breakpoint-c`）

### 編號起始（下 session）

- **T0467** / **BUG-115** / **PLAN-040** / **D136** / **L146**

---

## 🛏 前 Session 收工快照 (第五十四 session, 2026-10-05 01:04 - 05:26, ~4h22m wall)

### 主軸：PLAN-036 P0 自動驗收 → P1 / P2 全部完成 → 新開 PLAN-037（遠端 AI 工具套件）並完成程式部分 → `v0.6.0-pre.1`

#### 起手狀態

Fast Path（快照 10-04 11:09，< 7 天）。狀態檔漂移：第五十一～五十三 session 未收工（檔頭停在第五十）。git 0/0、HEAD `2e902de`。安裝版 BAT = 本機 build（`app.asar` 01:03，與 `release\win-unpacked` 雜湊一致，含 T0390-T0394）。

#### 時間線（時間取自 git commit / 系統時間）

1. **01:06-01:10** T0395 dev-deploy LISTEN 檢查改以服務 PID 過濾（`452b346`）
2. **01:13-01:34** 使用者問「實機驗收可否自動化」→ 兩層都做：T0396 協定層 smoke（WSL 8/8，`59af340`）∥ T0397 Playwright e2e（4/4，`e5215c1`）；`.kilo/worktrees` 被 Playwright 誤收 → 塔台修 `playwright.config.ts`（`a7b1f13`）；BUG-095 / 101 CLOSED；開 BUG-102（locale）/ 103（serverEnv）
3. **01:37-01:53** T0398 locale（`f0d20c0`）∥ T0399 e2e fixture（`ac8132a`）∥ T0400 ClaudeAgentManager DI（`09f1e46`）；D130 P1 / P2 排程（檔案鎖串行）；WSL 部署 → BUG-102 CLOSED
4. **01:54-02:51** T0403 回放 + create 結果（`b24d89a`）→ T0401 `claude:*` 上遠端（`53efb8e`）→ T0402 登入引導 + D132 auth-status（`85916f8`）∥ T0404 孤兒 PTY + BUG-103（`e4ad7cc`）；WSL 三次部署，smoke 8 → 9/9；BUG-103 CLOSED
5. **02:28** 使用者提議遠端安裝 AI 工具 → PLAN-037 / D131 / T0407 研究（`79c6f32`，Q1-Q3 使用者裁決）→ D133 拆 7 張
6. **02:52-04:16** T0408 ∥ T0409 → T0410 ∥ T0411 → T0412 ∥ T0413（精靈完成不再自動關閉，使用者接受）→ T0414 **WSL 實裝 5 工具**（使用者同意）→ BUG-104 / T0415（codex `CODEX_NON_INTERACTIVE=1`），WSL 重裝驗證 → CLOSED；smoke 10/10
7. **04:18-05:09** T0405 git / github / worktree 上遠端（`28cdd6f`，smoke 11/11）→ 發現路徑轉換缺口 BUG-105（high）→ T0416 全分類守門（`e2daec1`）→ T0406 fs + `workspace:sync-roots`（`76b2c0d`，smoke **12/12**）；BUG-106（worktree:merge）OPEN
8. **05:10** 使用者指示改 0.6.x 發預覽版 → bump `0.6.0-pre.1`（`c92faf7`）→ push `2e902de..c92faf7`（66 commits）→ run `37234981573` **9/9 success**（05:25）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | 22（T0395-T0416） | 全 DONE；1 research（T0407）；多次平行（同工作樹，檔案不重疊） |
| BUG | 新開 5（102-106）；CLOSED 5（095 / 101 / 102 / 103 / 104） | 105 FIXED（待新 build 實機）；106 OPEN low |
| PLAN | 新開 1（PLAN-037） | PLAN-036 程式部分完成；PLAN-037 程式部分完成 |
| 決策 | 4（D130-D133） | |
| Learnings | L139、L140、L141 | |
| unit test | ✅ **1867 passed / 112 files** | 第五十四 session 1083 → 1867（塔台親跑） |
| WSL 部署 | 7 次（dev-deploy，備份 tag `t0398`…`t0406`） | smoke 8 → 12 項 |
| Release | `v0.6.0-pre.1` ✅ + `server-bundle-v0.6.0-pre.1` ✅ | Setup.exe 718 MB、mac dmg 920-929 MB、AppImage 1.08 GB |
| 塔台直接改動 | 3 | `playwright.config.ts` testIgnore、`docs/remote-dev-overview.md` S8/S9、`remoteTools.installRequestFailed` 三語 |

### 重點觀察 / Learnings

- **L139**：觀測上下文 ≠ 執行上下文（wsl.exe 有 interop PATH，systemd 服務沒有）
- **L140**：靜默 fallback 的白名單必配全分類守門（BUG-105）
- **L141**：同工作樹平行 Worker——只讓一張跑 build、型別擁有者先 commit、塔台聯合複驗
- 使用者在 CI 發佈 server-bundle 前跑本機 `release.ps1` → `fetch:baseline` 404（時序問題，非 bug；CI 完成後重跑即可）

### 編號起始（下 session）

- **T0417** / **BUG-107** / **PLAN-038** / **D134** / **L142**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-05 11:34 UTC+8（第五十五 session 收工）

### 本 session 已清空的項目
45 張工單（T0417-T0461）全 DONE ✅ ｜ BUG-096-100 / 106-113 FIXED ✅ ｜ T0445 安全 review 九條全修 ✅ ｜ K 遠端 Tower 通知 + WSL smoke 13/13 ✅ ｜ push 86 commits ✅

### 待辦（依優先序）

1. 🟡 **PLAN-039 起派**（D135）：T0462 ∥ T0465 → T0463（🔴 改 `main.ts`，執行期間不派其他改 main / preload / d.ts 的單）→ T0464 → T0466
2. 🟡 **本批實機驗收**（需重打包本機 build；Fixed 17 張 BUG）：遠端視窗 fail-closed（BUG-110 / 112）、拖放 / 附件 / 複製遠端路徑 / 終端拖放 / prompt 路徑提示（BUG-107 / 108、T0437-T0440）、detach（BUG-113）、可執行檔確認（T0460 / T0461）、SSH 精靈（BUG-098-100）、Docker（BUG-097 / 111，需 Docker daemon）、真 BAT 遠端視窗 Tower 派單（K，WSL `~/.claude/skills` 需裝 ct skill）。**發版綁定**：T0435 ↔ T0437、T0453 ↔ T0458
3. 🟢 BUG-114 研究（派工分頁未執行 `/ct-exec`）；`.gitattributes` 是否套用（T0454 建議）；Vite `hashbangRE` 上游回報
4. 🟢 backlog：jumpToStep 不 rollback（T0309）、detached 視窗終端變更不持久化、snippet「agent 提案 → 一鍵套用」、PLAN-038、BUG-084 Phase 2、PLAN-035 Phase 2
5. 🟢 L130 D094 門檻復議｜L128 Logging 節｜`*archive` 到齡候選（先 grep 程式碼引用，L133）

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open 2 / Fixed 17 / Closed 20）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D135）｜ Learnings → [_learnings.md](_learnings.md)（最大 L145）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（70 entries）

### 編號起始
- **T0467** / **BUG-115** / **PLAN-040** / **D136** / **EXP-[TOPIC]-001** / **L146**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.6.0-pre.1**（package.json + lock，`c92faf7`） |
| **最新 release** | `v0.6.0-pre.1`（2026-10-05 05:24）+ `server-bundle-v0.6.0-pre.1`；本 session 未發版（push only） |
| **前一 tag** | `v0.5.9-pre.4`（2026-10-04） |
| **目前主軸** | PLAN-039 多 remote profile 同時連線（T0462-T0466）→ 本批實機驗收 → 下一預覽版 |
| **工單最大編號** | T0466（第五十五 session：T0417-T0461 全 DONE；T0462-T0466 PENDING，D135） |
| **BUG 最大編號** | BUG-114（OPEN medium，派工未啟動）；BUG-061 OPEN；096-100 / 105-113 / 086 / 088 / 093 FIXED 待實機 |
| **PLAN 最大編號** | PLAN-039（PLANNED，T0459 研究 DONE）；PLAN-038（IDEA）；PLAN-036 / 037 / 035 / 031 IN_PROGRESS |
| **決策最大編號** | D135 |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower v5.0.9 |
| **unit test 基線** | **2646**（塔台 @ `2f8237d`，163 files）／ Worker 2768（@ `0061e3d`）；e2e 8 passed / 8 skipped / 0 failed；**tsc baseline 36** |

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
> 最後掃描:2026-10-04 11:09 (UTC+8) 起手 Full Scan；2026-10-05 11:34 第五十五 session 收工逐項更新

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b` |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（10-05 PowerShell 複核）；⚠️ 偶發 Worker 未啟動（BUG-114，L143） |
| BAT 安裝版 | ⚠️ 落後 | 本機 build `0.6.0-pre.1`（`app.asar` 2026-10-05 05:28，SHA-256 `F81C9FF4…1F67`）；**不含**本 session 任何改動。實機驗收前需重打包（以雜湊確認，L127） |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ⚠️ 路徑與文件不符 | 實際在 `%APPDATA%\better-agent-terminal\Logs\debug-<stamp>.log`；`bat-scripts.log` 在 `%APPDATA%\BetterAgentTerminal\Logs\`。CLAUDE.md Logging 節待修（L128） |
| 平台 | Windows | PowerShell 主，Bash tool 並存；系統 gitconfig `core.autocrlf=true`、repo 無 `.gitattributes`（L142） |
| UAC | ⚠️ `EnableLUA=0` | BAT 與子 shell 皆提權（BUG-085 背景） |
| gh CLI | ✅ | 已登入 `gowerlin`；**必須帶 `-R gowerlin/better-agent-terminal`**（L122）；本 session 未用 gh |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ⚠️ 本機領先 | `origin/main` = `6286c11`（11:19 push）；其後 T0459-T0461 + 收工 commits 未 push |
| WSL server | dev-deploy | `~/.local/bat-server`：tag `t0456`（JS = HEAD `698a157` 等價 + 4 helper `scripts/`）；smoke 13/13；回復 `npm run deploy:headless:dev -- --target wsl:Ubuntu-24.04 --rollback --yes --tag t0456`；重跑 WSL 精靈會以 release bundle 覆蓋 |
| ct-exec / ct-done / ct-status / evolve / insights / fieldguide / help | ✅ | 全套可用（本 session 用 ct-done 補救 T0436） |
| 熱區工單 | **T:112 檔 / BUG:38 / PLAN:11** | T 含 4 個報告檔（L132）；`archive_days: 2` 下大量到齡候選，下 session 可 `*archive`（先 grep 程式碼引用，L133） |
| 最大編號 | **T0466 / BUG-114 / PLAN-039 / D135 / L145** | 下張：T0467 / BUG-115 / PLAN-040 / D136 / L146 |
| unit test | ✅ **2646 passed / 163 files**（塔台聯合複驗，乾淨 CRLF worktree） | Worker 最新 2768 |
| vite build | ✅ | 主工作區 + worktree 皆 exit 0 |
| e2e | ✅ **8 passed / 8 skipped / 0 failed** | 主工作區全套 |
| tsc --noEmit | ⚠️ 36 既有 error | 40 → 36（BUG-061） |
| 開放 PR | 0 | |
| 設定來源 | project | `_tower-config.yaml`（auto-session **on**；本 session 以 session-only `yolo` 覆寫，收工即失效） |
| 塔台版本 | v5.0.9 | control-tower skill |

> **Drift / 注意事項**:
> 1. ✅ `_tower-state.md` 收工後約 20 KB；第五十一～五十三補記與第四十九 / 五十五 YOLO 詳細歷程已歸檔至 `2026-Q4.md`（INDEX 68-70）
> 2. ⚠️ scratchpad 驗證 worktree 已於收工移除（`git worktree list` 應只剩主工作區與 `.kilo/worktrees/*` 2 個他工具 worktree）
> 3. 🔴 **D094 mac installer 280 MB cap 長期超標**（mac dmg ~920 MB）未復議（L130）
> 4. ⚠️ CLAUDE.md「Logging」節路徑錯誤（L128），待修
> 5. ⚠️ `_ct-workorders/T0293-review-report.md` 含 2 個 NUL 位元組（既有）
> 6. ⚠️ **L132**：`T0292/T0293/T0298/T0302-*-report.md` 命名越界，維持現狀（2026-09-02 裁決）
> 7. ⚠️ **L129**：含反斜線的內容一律走 Write 工具（本 session 收工 learnings / 快照片段皆以 Write 寫入 scratchpad 再組合）
> 8. ⚠️ **L136**：VS Code Insiders 可能鎖 `release\win-unpacked\resources\app.asar`
> 9. ⚠️ 舊 Worker 分頁 `69012c…`（T0452 首派）、`910bc8cf…`（T0457 首派）若仍開著請關閉（BUG-114）
> 10. ⚠️ **發版綁定**：T0435 ↔ T0437（拖放修好後遠端附件需路徑轉換擋板）、T0453 ↔ T0458（detach 修好後需導航守門）

---

## YOLO 歷程

> 本區段依 `references/yolo-mode.md` § 「`_tower-state.md` 新增 `## YOLO 歷程` 區段」規格產生。逐筆紀錄已歸檔至 `_archive/state-snapshots/2026-Q4.md`（INDEX 69 / 70）。

### 當前 Session（第五十六 session，2026-10-05 11:40 起，session-only yolo，Worker 互動：不允許）

- 11:42 派 T0462 ∥ T0465（D135；PLAN-039 第 1 / 4 列）— 兩張 exit 0（terminal `92dff1c9…` / `0eff417f…`）；11:45 確認兩張 IN_PROGRESS（started_at 11:42:43 / 11:43:01）
- 11:49 **T0465 DONE** `b677e71`（+ `4f17932`）：動態埠 bind 失敗（exit 255 且 probe EADDRINUSE 或 stderr）換埠重試一次；固定 `tunnelLocalPort` 與已連線 profile 重複 → warn；新測試 11；unit 全綠（排除 T0462 WIP 紅燈檔）；tsc 36。塔台核對 commit 只含 4 檔 ✅。裁決：「未連線 profile 同埠」不納入 warn（需 main.ts ProfileManager，且不實際撞埠）→ 接受；殘留風險（占用者為 listener 時 ready 誤判）由 fingerprint pin fail-closed 兜底 → 不開 BUG
- 11:50 **T0462 DONE** `470f81a`（+ `0193a5e`）：`remote-connection-registry.ts`（上限 8 / 寬限 15 s / 開窗保護 60 s / per-profile mutex / disconnectAll 2 s）+ `remote-connect-plan.ts` profile 鍵純函式；+45 tests；unit 166 files / 2824 passed（含 T0465 已 commit 內容，視同聯合複驗）；tsc 36。commit 5 檔 ✅
- 派 T0463 前塔台在工單補「塔台補充」：T0462 接線備註 + T0465 `fixedTunnelPortClaims` 必經 `client.disconnect()` 釋放
- 11:50 派 T0463（exit 0；11:53 確認 IN_PROGRESS）
- 12:02 **T0463 DONE** `8604daa`（+ `911c77f`）：main.ts 單一槽位 → `RemoteConnectionRegistry`（§1 #1-#24 逐點）；`remote:connect` 無綁定拒絕、`remote:disconnect` sender-scoped；`other-profile` 自 main / preload / renderer / 三語移除；+ two-servers 整合測試；unit 167 files / 2826；tsc 36；electron 型別以 scratchpad tsconfig 補檢 0 新錯。塔台補跑 `npx vite build` exit 0。斷點 C 裁決：範圍延伸 `remote-connect-plan.ts`（移除 other-profile 必改）→ 接受；關窗採 registry 寬限而非立即 release → 接受。T0464 前補「塔台補充」（剩餘 4 項範圍 + affects_files 加 `remote-connect-plan.ts` / `preload.ts` / `electron.d.ts`）

### 計數器（第五十六 session）

- 連續 FAILED: 0 / 1
- 本 session yolo 派發：2
- 斷點觸發：A×0, B×0, C×0、使用者中斷×0

### 計數器（第五十五 session，已收工）

- 連續 FAILED: 0 / 1
- 本 session yolo 派發：45 張完成（另重派 2、ct-done 補救 1）
- 斷點觸發：A×0, B×0, **C×17**（scope 內，05:55 起依使用者授權由塔台直接裁決）、使用者中斷×0
- 使用者修正：1（Worker 啟動檢查 30 秒 → ≥ 3 分鐘）

### 歷史 Session（摘要）

- 2026-10-05 第五十五 session：session-only yolo；D134（45 列）全 DONE；斷點 C 由塔台裁決；派工未啟動 2 次 + commit 前停住 1 次（BUG-114）；逐筆見 2026-Q4.md「YOLO 歷程（第五十五 session）」
- 2026-10-04 第四十九 session：session-only yolo；T0365-T0374，含 2 次外部動作閘（bump + push + pre-release 由使用者授權）；逐筆見 2026-Q4.md「YOLO 歷程（第四十九 session）」
- 2026-04-18 第三 session：CT-T003 DELEGATE PARTIAL → DONE；`*evolve` L057-L066；`*archive` 活躍引用豁免測試
- 2026-04-18 T0174 Phase 2-6 session：T0173 研究 DONE；首次斷點 C（事後確認，L064）；使用者中斷「停」驗證
- 2026-04-18 上半場（PLAN-020 開發）：7 張本專案 + 1 跨專案 DELEGATE，全 DONE，無斷點
- 2026-04-18 下半場第二 session：T0174 Phase 0-1 dogfood（無派發）
