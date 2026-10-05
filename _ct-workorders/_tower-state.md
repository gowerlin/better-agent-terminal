# Tower State — better-agent-terminal

> 最後更新:2026-10-05 05:26 (UTC+8) — **第五十四 session 收工** — 22 張工單全 DONE；PLAN-036 程式部分完成（P0-P2，WSL smoke 12/12）；PLAN-037 開立並完成程式部分；**`v0.6.0-pre.1` 發布**（run `37234981573` 9/9）。
>
> **下次起手**:Fast Path 載入;**第一件事：使用者安裝 `v0.6.0-pre.1`（CI 安裝檔）做實機驗收**（清單見起手式）。安裝前後以 `app.asar` 雜湊確認版本（L127）。
>
> **前次更新**:2026-10-04 20:58 (UTC+8) — 第五十 session 收工；其後第五十一～五十三 session（21:05 – 01:01）未寫收工快照，本次以 git log 補記於「前 Session」段。

---

## 🛏 本 Session 收工快照 (第五十四 session, 2026-10-05 01:04 - 05:26, ~4h22m wall)

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

## 🛏 前 Session 收工快照 (第五十一～五十三 session 補記, 2026-10-04 21:05 - 2026-10-05 01:01, 未收工)

> 本段於第五十四 session 收工時依 git log（52 commits，`d44b185..2e902de`）補記，非當時塔台撰寫。

- **21:05-21:53** BUG-084 / 085 / 071 CLOSED；BUG-086 / 087（T0378）、BUG-088（T0379）FIXED；D126
- **22:05-23:08** PLAN-035（WSL 全自動化）+ T0380 研究；Phase 1 T0381-T0384：BUG-090 / 091 / 089 / 092 FIXED；D127 / D128
- **23:19-23:47** BUG-094（headless 缺 `profile:load-snapshot`）→ T0385；實機 → BUG-087 / 089-092 / 094 CLOSED；PLAN-036 開立 + T0386 研究
- **00:01-01:01** D129；PLAN-036 P0 T0388-T0391、T0393；BUG-093（T0387）/ 095（T0392）/ 101（T0394）FIXED；開 BUG-096-100；L138（平行 Worker 禁用 stash）；WSL 部署 `ea52b03`
- 戰績：工單 T0378-T0394（17 張）；unit test 709 → 1083

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-05 05:26 UTC+8（第五十四 session 收工）

### 本 session 已清空的項目
22 張工單（T0395-T0416）全 DONE ✅ ｜ PLAN-036 / PLAN-037 程式部分完成 ✅ ｜ BUG-095 / 101-104 CLOSED ✅ ｜ `v0.6.0-pre.1` 發布 ✅ ｜ unit test 1083 → 1867 ✅

### 待辦（依優先序）

1. 🟡 **實機驗收（安裝 CI 的 `v0.6.0-pre.1`）**：WSL 遠端視窗——終端回放 / 不重打 agent 指令（T0403）、Claude 面板與未登入引導（T0401 / T0402）、檔案樹 / 預覽 / 搜尋（T0406）、Git / GitHub / Git Graph（T0405）、`\\wsl.localhost\…` 與 `C:\…` 兩種工作區（BUG-105）、精靈完成畫面 + 設定頁工具面板 + 跨視窗安裝（T0412 / T0413）。WSL 精靈第 4 步會以 `server-bundle-v0.6.0-pre.1` 覆蓋目前 dev-deploy 的 server
2. 🟡 SSH 實機：BUG-088 / BUG-093；BUG-086（無發行版分支）
3. 🟢 PLAN-036 P3（J always-local 改分類、K 遠端 Tower 通知）、自由文字中的路徑轉換、headless git / gh 子行程 `BAT_*` scrub、遠端 PTY 達上限的 UI 提示、BUG-106
4. 🟢 BUG-084 Phase 2（claude-agent-sdk 0.3）｜ PLAN-035 Phase 2 ｜ BUG-096-100
5. 🟢 L130 D094 門檻復議（mac dmg 已 ~920 MB）｜ L128 Logging 節 ｜ `*archive` 到齡候選（先 grep 程式碼引用，L133）

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open 7 / Fixed 4 / Closed 20）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D133）｜ Learnings → [_learnings.md](_learnings.md)（最大 L141）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（67 entries）

### 編號起始
- **T0417** / **BUG-107** / **PLAN-038** / **D134** / **EXP-[TOPIC]-001** / **L142**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.6.0-pre.1**（package.json + lock，`c92faf7`） |
| **最新 release** | `v0.6.0-pre.1`（2026-10-05 05:24，run `37234981573` 9/9 success；5 檔）+ `server-bundle-v0.6.0-pre.1`（7 資產）；前一版 `v0.5.9-pre.4` |
| **前一 tag** | `v0.5.9-pre.4`（2026-10-04） |
| **目前主軸** | `v0.6.0-pre.1` 實機驗收（遠端 WSL 全功能）→ PLAN-036 P3 / 後續小單 → BUG-084 Phase 2 |
| **工單最大編號** | T0416（第五十四 session：T0395-T0416 全 DONE；T0405 / T0406 為 D130 保留編號，同 session 完成） |
| **BUG 最大編號** | BUG-106（OPEN low）；105 FIXED（待 0.6.0-pre.1 實機）；102 / 103 / 104 / 095 / 101 CLOSED；086 / 088 / 093 FIXED 待對應實機；061 / 096-100 OPEN |
| **PLAN 最大編號** | PLAN-037（IN_PROGRESS：程式部分完成，待 UI 實機；D131 / D133）；PLAN-036（IN_PROGRESS：P0-P2 完成，P3 未開）；PLAN-035（IN_PROGRESS：Phase 2 未開） |
| **決策最大編號** | D133 |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower v5.0.9 |
| **unit test 基線** | **1867**（112 files，HEAD `c92faf7`）；e2e 6 passed / 8 skipped / 0 failed；tsc baseline 40 |

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
> 最後掃描:2026-10-04 11:09 (UTC+8) 起手 Full Scan；2026-10-05 05:26 第五十四 session 收工逐項更新
> 複核結果：git 零漂移（`origin/main` = `7243ce2`，0/0）；熱區計數與最大編號與 09-02 收工一致；無新 release / 開放 PR / 開放 issue；BAT workspace ID 已換新（下列已更新）。

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（10-04 更新；舊值 `2eda2f34-…` 已失效） |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（10-04 PowerShell 複核） |
| BAT 安裝版 | ⚠️ 待更版 | 本機 build（`app.asar` 2026-10-05 01:03，`release\win-unpacked` 同雜湊，含 T0390-T0394）。下次：安裝 CI 的 `v0.6.0-pre.1`，以雜湊確認（L127） |
| BAT_HELPER_DIR | ✅ | `C:/Program Files/BetterAgentTerminal/resources/scripts` |
| BAT debug log | ⚠️ 路徑與文件不符 | 實際在 `%APPDATA%\better-agent-terminal\Logs\debug-<stamp>.log`（與 `BAT_USER_DATA` 指向的 `BetterAgentTerminal\` 為**兩個並存目錄**，大小寫不同）。CLAUDE.md Logging 節待修（L128） |
| 平台 | Windows | PowerShell 主，Bash tool 並存 |
| UAC | ⚠️ `EnableLUA=0` | 本機 UAC 停用 ⇒ BAT 與所有子 shell 皆提權。Codex 0.160 daemon 會拒絕（BUG-085）；T0377 後 BAT 自動對 codex-cli 注入 `-c features.daemon_auto_start=false` |
| gh CLI | ✅ | 已登入 `gowerlin`。⚠️ **必須帶 `-R gowerlin/better-agent-terminal`**（L122），本 session 三次 gh 操作皆遵守 |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `origin/main` = `c92faf7`（05:10 push，0/0）；收工快照 commit 另行 push 與否依使用者 |
| ct-exec / ct-done / ct-status / evolve / insights / fieldguide / help | ✅ | 全套可用 |
| 熱區工單 | **T:62 檔 / BUG:31 / PLAN:9** | T:62 含 4 個報告檔（L132）；BUG：Open 7 / Fixed 4 / Closed 20 |
| 最大編號 | **T0416 / BUG-106 / PLAN-037 / D133 / L141** | 下張：T0417 / BUG-107 / PLAN-038 / D134 / L142 |
| unit test | ✅ **673 passed / 47 files** | 第四十九 session 550 → 673（塔台親跑） |
| vite build | ✅ | 第五十四 session 塔台親跑通過；e2e 0 failed |
| tsc --noEmit | ⚠️ 40 既有 error | baseline 不變（BUG-061） |
| 開放 PR | **0** | PR #19 已於本 session 處置關閉（D119） |
| 設定來源 | project | `_tower-config.yaml`（auto-session **on**, yolo_max_retries 1, auto_commit on, archive_days 2） |
| 塔台版本 | v5.0.9 | control-tower skill |

> **Drift / 注意事項**:
> 1. ✅ `_tower-state.md` 收工後約 24 KB（< 30 KB 軟警告）；第四十九 / 五十 session 已歸檔至 `2026-Q4.md`
> 2. ⚠️ 工作區長期存在 `AGENTS.md` dirty（claude-mem 自動產生，非程式碼）。本 session 全程以 `git commit --only` 精確指定路徑，10 個 commit 皆未觸碰
> 3. ✅ CLAUDE.md「Release」節已於本 session 校正（CP-T0362），並補上 `build-server-bundle.yml` 第三個 trigger
> 4. 🔴 **D094 mac installer 280 MB cap 已連三個 release 超標 2.6 倍**（v0.5.8 / pre.1 / pre.2 之 mac dmg 皆 ~724 MB）**且從未觸發復議** —— 門檻與現實脫節，見 L130
> 5. ⚠️ CLAUDE.md「Logging」節路徑錯誤（L128），待修
> 6. ⚠️ `_ct-workorders/T0293-review-report.md` 含 2 個 NUL 位元組（既有，非本 session 產生）；全庫其餘檔案控制字元掃描為零
> 7. ⚠️ **L132**：`T0292/T0293/T0298/T0302-*-report.md` 4 檔命名越界（報告卻掛工單前綴），落在 `*archive` F-24 排除規則的縫隙裡 —— 永不歸檔也永不判定。2026-09-02 使用者裁決 **A：維持現狀**，日後新報告一律用 `_report-` 前綴
> 8. ⚠️ **L129 實證**：本 session 收工時以 bash heredoc 寫 python，反斜線被摺疊一層，導致 regex backreference 變成 SOH 控制字元寫進 4 個 BUG 檔（已修）。**含反斜線的內容一律走 Write 工具**
> 9. ⚠️ **L136**：VS Code Insiders（Electron）曾鎖住 `release\win-unpacked\resources\app.asar` 導致打包失敗；已於 `.vscode/settings.json` 排除 build 輸出目錄（`d44b185`），下次打包若再發生代表是擴充套件持有，以 Restart Manager 查
> 10. ⚠️ **WSL server 為 dev-deploy 狀態**：`~/.local/bat-server/electron/remote/*.js` = HEAD `76b2c0d` 等價（備份 `*.bak-t0398`…`*.bak-t0406`）；WSL 另裝 claude 2.1.285 / uv / codex（`~/.local/bin`）、rg / gh（apt）（T0414，使用者同意）。重跑 WSL 精靈會以 release bundle 覆蓋

---

## YOLO 歷程

> 本區段依 `references/yolo-mode.md` § 「`_tower-state.md` 新增 `## YOLO 歷程` 區段」規格產生。
> **Footnote**：本 session [斷點 C] 標記僅取狹義（Worker 跨 PLAN 建議）；使用者手動「停」暫不歸 A/B/C，列為 `[使用者中斷]` 自訂事件（待 L064 上游修正）。

### 當前 Session（2026-10-05 05:33 啟動，第五十五 session）

- [啟動] 2026-10-05 05:33 — 使用者 `*config auto-session yolo`（**僅本 session**，未 `--save`），`yolo_max_retries: 1`；Worker 互動：允許（研究單 `--interactive`、實作單 `--no-interactive`）；排程依據 **D134 排程表**（T0417-T0426）
- [派發] 2026-10-05 05:38 — 第一波（5 個 Worker 分頁 exit 0） T0417 ∥ T0418 ∥ T0419 ∥ T0420（research）∥ T0421（research）；overlap check：僅 `electron/__tests__/` 目錄層重疊（WARN，接受）
- [完成] 2026-10-05 05:41 — T0417 DONE（`7609229`）塔台複核 PASS：9 檔、1867 tests、tsc 40；BUG-106 → FIXED
- [調整] 2026-10-05 05:41 — T0422 加依賴 T0419（同改 `electron/main.ts`，`git commit --only` 會整檔提交）；T0422 / T0423 補「共用檔 hunk 隔離」條款
- [派發] 2026-10-05 05:41 — T0423（`--no-interactive`）；T0422 待 T0419
- [完成] 2026-10-05 05:44 — T0418 DONE（`b17b0ba`）塔台複核 PASS：7 檔、Worker 1889 tests / tsc 40；BUG-097 → FIXED；runtime lane 未驗證（本機 Docker daemon 未啟動）。範圍偏差接受：`scripts/verify-docker-image.mjs`（耦合契約）、`ENV BAT_PORT`→`BAT_SERVER_PORT`、wizard `waitForHealthy` 5s→45s
- [斷點 C] 2026-10-05 05:44 — T0418 建議另開：docs `/health` 過時說明、既有 container 仍為全介面 publish 的偵測 / 重建引導；T0418 無下游，不阻擋其他派發
- [完成] 2026-10-05 05:44 — T0419 DONE（`038c98e`）塔台複核 PASS：8 檔、`main.ts` 30 行皆本單 hunk、Worker 1889 tests / tsc 40；BUG-096 → FIXED。範圍偏差接受：新增純模組 `electron/remote/remote-connect-plan.ts`、`normalizeFingerprint` export。記錄：`remote:connect` 連線失敗分支不 `disconnect()` 舊 client（既有，未修，候選）
- [派發] 2026-10-05 05:44 — T0422 ∥ T0424（`--no-interactive`）；overlap：T0422 / T0423 同碰 `headless-entry.ts`（hunk 隔離條款已在兩單）
- [完成] 2026-10-05 05:45 — T0423 DONE（`22bc3d0`）塔台複核 PASS：4 檔、未動 `main.ts`、Worker 1893 tests / tsc 40；16 個 git / gh 呼叫點 headless scrub，Electron 不傳 env（測試鎖住）
- [斷點 C] 2026-10-05 05:45 — T0423 建議另開：`worktree:*`（`worktree-manager.ts` env provider）、`git-scaffold:*`（simple-git `.env()` 會觸發 unsafe env 檢查，需同濾 `EDITOR` / `PAGER` / `GIT_*ASKPASS` 等）。與 T0418 / T0419 的候選合併請使用者裁決
- [恢復] 2026-10-05 05:46 — 使用者斷點 C 合併裁決：4 項全納入 → T0427-T0430（D134 第 11-14 列）
- [研究完成] 2026-10-05 05:48 — T0420 DONE（`7bb4692`）：K 採方案 A'（每 PTY 範圍權杖，使用者 Worker 期間裁決），拆 4 張 → 塔台開 T0431-T0434
- [完成] 2026-10-05 05:48 — T0422 DONE（`d800dea`）塔台複核 PASS：4 檔、12 channel → ALWAYS_LOCAL（HEADLESS_UNSUPPORTED 18 → 6）、Worker 1899 tests / tsc 40；未改 `main.ts` / `headless-entry.ts`
- [派發] 2026-10-05 05:48 — T0428 ∥ T0429 ∥ T0430（`--no-interactive`）；overlap 無（T0424 進行中：pty / Terminal / WorkspaceView）
- [研究完成] 2026-10-05 05:50 — T0421 DONE（`ffb06f8`）；使用者 05:51 裁決拆單 1-6 全納入 + 開 BUG-109 / PLAN-038 → BUG-107 / 108 / 109、T0435-T0441（`d8416f1`）；T0420 拆單 → T0431-T0434（`bec52bf`）
- [完成] 2026-10-05 05:53 — T0428 DONE（`376eaee` + `7d6ca6d`，純文件）
- [完成] 2026-10-05 05:53 — T0424 DONE（`ef7beb8`）塔台複核 PASS：Worker 1915 tests / tsc 40；範圍偏差接受（`src/types/index.ts`、`TerminalPanel.tsx`、新 hook `usePtyLimitNotice.ts`、T0404 wire 測試同步）
- [完成] 2026-10-05 05:53 — T0430 DONE（`a878b83`）塔台複核 PASS：失敗只拆 candidate、保留槽位；Worker 1922 tests / tsc 40
- [斷點 C] 2026-10-05 05:53 — T0430 建議另開：`loadProfileSnapshotDetailed` 失敗 candidate 未 disconnect（SSH tunnel 殘留）、pin 變更時 fail-closed 拆既有 client。待使用者裁決（不阻擋派發）
- [派發] 2026-10-05 05:54 — T0425 ∥ T0435（`--no-interactive`）
- [完成] 2026-10-05 05:54 — T0429 DONE（`b968b9f`）塔台複核 PASS：simple-git 18 個 unsafe key 一併過濾（出處 `@simple-git/argv-parser` 1.1.1），未開 unsafe 旗標；Worker 1933 tests / tsc 40；範圍偏差接受（`handlers/git.ts` 1 行）
- [派發] 2026-10-05 05:54 — T0431（`--no-interactive`）；overlap 無（T0425：ssh 精靈；T0435：preload / 面板）
- [授權] 2026-10-05 05:55 — 使用者：「塔台給最佳建議, 直接決定」→ scope 內斷點 C 由塔台裁決、事後回報
- [斷點 C 裁決] 2026-10-05 05:56 — T0430 兩項合併為 T0442（依賴 T0431）；聯合複驗改在 scratchpad 乾淨 worktree 對 HEAD 跑（不受平行 Worker dirty 檔影響）
- [完成] 2026-10-05 05:59 — T0435 DONE（`c6c4e9e`）塔台複核 PASS：9 檔、Worker 1961 tests、**tsc 40 → 39**（新基線）；BUG-107 → FIXED；偏差接受（測試檔放 `electron/__tests__/` 避 TS6305）
- [聯合複驗] 2026-10-05 06:00 — HEAD `49175ef` 乾淨 worktree：vite build exit 0、tsc 39、unit 1804 passed（3 個 `scripts/__tests__/*.mjs` worktree 載入 SyntaxError = 既有環境異常，主工作區重跑 136/136 PASS）；e2e 待平行度降低後補
- [派發] 2026-10-05 06:00 — T0436（`--no-interactive`）；與 T0431 可能同碰 `main.ts` / 分類表（hunk 隔離條款已在工單）
- [完成] 2026-10-05 06:01 — T0425 DONE（`a73caf9`）塔台複核 PASS：16 檔、Worker 1961 tests / tsc 39；BUG-098 → FIXED（移除 direct）。附帶修正既有缺陷：ssh profile `useSshTunnel` 為 `undefined` 時原本不開 tunnel、直連本機 RemoteServer → 一律 tunnel（`resolveSshTunnelUse`）。偏差接受（`remote-client.ts` / `SshDetails.tsx`）
- [派發] 2026-10-05 06:01 — T0426（`--no-interactive`）；與 T0431 / T0436 可能同碰 `main.ts` / `preload.ts`（hunk 隔離條款已在工單）
- [完成] 2026-10-05 06:08 — T0431 DONE（`9fa2cc3`）塔台複核 PASS：14 檔、HEADLESS_UNSUPPORTED 6 → 2、本機指令輸出 3×11 矩陣逐字比對、Worker 2004 tests / tsc 39；`main.ts` 以 `git apply --cached` 只 stage 本單 6 hunk（T0436 hunk 未夾帶）。規格內行為變更接受：Electron 端 `created-externally` / `notified` / `keypress` 也經 broadcastHub 送遠端 client
- [斷點 C 裁決] 2026-10-05 06:08 — T0431 遭遇問題 4（headless 指定 codex → shell command not found）併入 T0433（回結構化錯誤 + i18n）
- [派發] 2026-10-05 06:08 — T0432 ∥ T0442（`--no-interactive`）
- [完成] 2026-10-05 06:12 — T0442 DONE（`ccffedb`）塔台複核 PASS：Worker 2087 tests / tsc 39；`main.ts` 以 `git apply --cached` 精準 stage
- [斷點 C 裁決] 2026-10-05 06:12 — 塔台複核 `main.ts:2145`：遠端視窗未連線時 invoke 落本機（fail-open），單一槽位使兩個 remote profile 同時開窗時先開者靜默變本機 → BUG-110（high）/ T0443；多 profile 同時連線屬架構，交使用者
- [完成] 2026-10-05 06:13 — T0426 DONE（`4caab48`）塔台複核 PASS：Worker 2077 tests / tsc 39（錯誤清單 diff 相同）；BUG-099 / 100 → FIXED；以暫存 index 精準 commit
- [斷點 C 裁決] 2026-10-05 06:13 — T0426 遭遇問題 3：精靈 Docker rollback 可能刪 / 停使用者容器 → BUG-111（high）/ T0444（依賴 T0427）；白名單較嚴（遭遇問題 2）維持
- [派發] 2026-10-05 06:14 — T0427 ∥ T0443（`--no-interactive`）
- [決策] 2026-10-05 06:14 — 使用者：多 remote profile 同時連線開 PLAN-039（PLANNED），排在 D134 本批之後
- [完成] 2026-10-05 06:21 — T0427 DONE（`89c538c`）塔台複核 PASS（source / unit / tsc 39）；runtime 未驗證（Docker daemon 未啟動）；Worker 全套 1 failed = `headless-always-local.test.ts` 原始碼順序斷言，落在 T0443 未提交的 `main.ts` → T0443 完成時必查
- [派發] 2026-10-05 06:21 — T0444（`--no-interactive`）
- [完成] 2026-10-05 06:22 — T0432 DONE（`aec20c0`）塔台複核 PASS：權杖只存 digest、`timingSafeEqual`、4 channel 白名單 + target 綁定、48 + 31 + 6 新測試、tsc 39；全套 1 failed 同 T0427（T0443 未提交 `main.ts`）
- [斷點 C 裁決] 2026-10-05 06:22 — 開 T0445 安全 review（只出 findings）與 T0433 平行
- [派發] 2026-10-05 06:22 — T0433 ∥ T0445（`--no-interactive`）
- [完成] 2026-10-05 06:28 — T0443 DONE（`72ac25c`）塔台複核 PASS：fail-closed `REMOTE_NOT_CONNECTED`、狀態事件、init 路徑處理；`headless-always-local.test.ts` 轉綠；Worker 2230 tests / tsc 39；BUG-110 → FIXED。偏差接受（`remote-client.ts` listener、`src/lib/remote-not-connected.ts`）
- [斷點 C 裁決] 2026-10-05 06:28 — detached workspace 視窗同類 fail-open → BUG-112（high）/ T0446
- [派發] 2026-10-05 06:29 — T0446（`--no-interactive`）
- [完成] 2026-10-05 06:32 — T0445 DONE（`2161b7e`）安全 review **BLOCK**：#1 critical（撤銷後同連線落入 client 無限制 invoke，PoC）、#2 high（`constructor` channel → unhandled rejection 打掉 headless server）、#3 high（既有：未認證 `null` frame 同上，現可利用）、#4-#9 medium / low
- [斷點 C 裁決] 2026-10-05 06:32 — 拆 T0447-T0451（D134 第 31-35 列）；T0434 加依賴 T0447 / T0448；#6/#7 取收緊方向
- [派發] 2026-10-05 06:34 — T0447 🔴（`--no-interactive`）
- [完成] 2026-10-05 06:36 — T0444 DONE（`bb24f33`）塔台複核 PASS：所有權旗標 + 32 案矩陣、setup-wizard 280 passed、tsc 39；BUG-111 → FIXED；`tests/` 兩檔斷言更新接受。全套 1 failed = `headless-pty.test.ts` BAT_* env 斷言，落在 T0433 未提交改動 → **T0433 完成時必查**
- [斷點 C 裁決] 2026-10-05 06:36 — T0444 遭遇問題 3 前兩項 → T0452；jumpToStep 不 rollback（T0309 既有 TODO）記 backlog
- [派發] 2026-10-05 06:36 — T0452（`--no-interactive`）
- [完成] 2026-10-05 06:37 — T0433 DONE（`ec4ca56`）塔台複核 PASS：Worker 2301 tests / **0 failed**（`headless-pty.test.ts` 依規格更新）、tsc 39、`verify:helpers` OK；真 bat-terminal / bat-notify 子行程 env 無 server token；codex `AGENT_UNAVAILABLE`
- [斷點 C 裁決] 2026-10-05 06:38 — 不做 renderer toast（唯一呼叫者為 Tower PTY 內 bat-terminal，錯誤印在分頁已足）；dev-deploy 不部署 helper → 併入 T0434
- [派發] 2026-10-05 06:38 — T0448（`--no-interactive`）
- [完成] 2026-10-05 06:41 — T0448 DONE 塔台複核 PASS：headless restart 保留 `customEnv`（Electron 不變，測試鎖）、worker 角色 / towerId 不變、舊權杖撤銷；反向驗證移除修正即紅；Worker 2371 tests / tsc 39。T0434 尚待 T0447
- [完成] 2026-10-05 06:41 — T0447 DONE（`2ed593f`）塔台複核 PASS：#1 預設拒絕閘門 + terminate、#2 typeof + hasOwnProperty + 全段 try、#3 frame shape 驗證 + handler try + bat-server 程序級 handler（uncaughtException → stop + exit 1）；紅 24 failed → 綠；額外修陣列 channel 字串化命中白名單；Worker 2371 tests / tsc 39。**T0445 BLOCK 解除（#1-#4 已修）**
- [派發] 2026-10-05 06:41 — T0434 ∥ T0449（`--no-interactive`）
- [完成] 2026-10-05 06:43 — T0446 DONE（`acc94f5`）塔台複核 PASS：detached 記錄 + `resolveDetachedProfileBinding`、無法解析 fail-closed、tsc 39；BUG-112 → FIXED。Worker 第 1 次全套 9 例失敗於 T0447 `headless-frame-hardening.test.ts`（之後 3 次綠）→ 塔台聯合複驗觀察是否 flaky
- [斷點 C 裁決] 2026-10-05 06:43 — detached workspace 自 `512c118` 起 Workspace not found → BUG-113（medium）/ T0453
- [派發] 2026-10-05 06:44 — T0453（`--no-interactive`）；聯合複驗（HEAD `e52f738`，乾淨 worktree）背景執行中，含 frame-hardening 3 次重跑
- [聯合複驗] 2026-10-05 06:45 — HEAD `e52f738`：vite build exit 0、tsc 39、frame-hardening 單跑 3 次 20/20（**非 flaky**）；unit 2213 passed / 4 檔失敗皆 `scripts/__tests__/*.mjs`——**根因定位**：系統 gitconfig `core.autocrlf=true` + repo 無 `.gitattributes` → 新 checkout 為 CRLF（主工作區恰為 LF）；`server-bundle-helpers` regex 不容 `\r\n`，主工作區重跑 11/11 PASS。⇒ 新 clone 的 Windows 開發者會遇到
- [斷點 C 裁決] 2026-10-05 06:46 — T0454（依賴 T0434，同改 `scripts/__tests__/`）；`.gitattributes` 只評估不套用
- [完成] 2026-10-05 06:47 — T0449 DONE（`c186c81`）塔台複核 PASS：權杖失敗獨立計數永不 ban、revoked digest（TTL 10 min / 1024）、helper 成功不清 server token 計數；紅 4 failed → 綠；Worker 2382 tests / tsc 39。觀察：取紅燈證據時以 `git show HEAD:… >` 暫時覆寫自有檔再還原（未觸他人檔，L141 / L138 灰區，收工記 learning）
- [派發] 2026-10-05 06:47 — T0450（`--no-interactive`）
- [異常] 2026-10-05 06:54 — 使用者詢問 T0436 終端是否誤關。塔台查證：工單 06:07 後無更新、回報區已寫 DONE 但 Commit / 回報時間「待填」、frontmatter 仍 IN_PROGRESS、4 新檔 untracked、無 commit ⇒ Worker 停在 commit 前（誤關或卡住，無法分辨）。偏離 1（local-only `ipcMain.handle` 取代 ALWAYS_LOCAL，防遠端 client 讀本機剪貼簿 / 彈對話框）接受
- [派發] 2026-10-05 06:54 — `/ct-done T0436` 補救（工單加「塔台補充」：共用檔 `git apply --cached` 精準 stage）
- [完成] 2026-10-05 06:55 — T0453 DONE（`a94f1f4`）塔台複核 PASS：e2e 修正前 build 1 failed（「找不到工作區」）→ 修正後 1 passed（detach / 終端執行 / save no-op / reattach）、tsc 39、本單 4 檔 91 tests；全套 4 檔紅屬 T0434 / T0450 WIP；為 e2e 執行一次 `npx vite build`（工單允許）。BUG-113 → FIXED
- [斷點 C 裁決] 2026-10-05 06:55 — detached 視窗內終端變更不持久化（save no-op 取捨）→ backlog，不開單
- [完成] 2026-10-05 06:57 — T0436 DONE（ct-done 補救，`6c26edc`）塔台複核 PASS：12 檔、`main.ts` +17 僅本單 3 hunk、無他單 hunk 夾帶；BUG-108 → FIXED（本機任何工作區外圖片附件皆被 path guard 擋，已修）
- [派發] 2026-10-05 06:57 — T0441（`--no-interactive`）
- [完成] 2026-10-05 06:58 — T0450 DONE（`7effa79`）塔台複核 PASS：Worker 全套 2427 passed / **0 failed** / tsc 39；`pty:write` 拒 C0 + DEL + C1（超出裁決，接受）、bat-notify 預填壓平控制字元（本機亦適用，接受）、tower 子 PTY ≤ 8 / 1 秒 / client 保留 8 / capacity 不明 fail-closed、agent 限 registry
- [派發] 2026-10-05 06:58 — T0451（`--no-interactive`）
- [完成] 2026-10-05 07:03 — T0441 DONE（`5d8fd8f`）塔台複核 PASS：snippet 實為記憶體 store + `snippets.json` 僅啟動時 load ⇒ 舊流程全平台無效；改注入清單（無路徑）；**tsc 39 → 36**；BUG-109 → FIXED。全套紅屬 T0451 WIP（`remote-server.ts` `LOG_UNSAFE_CHARS` regex 含行分隔字元 → Unterminated regular expression，25 suite）與 T0434 WIP → **T0451 完成時必查**
- [斷點 C 裁決] 2026-10-05 07:03 — 「agent 提案 → 一鍵套用 snippet」→ backlog
- [派發] 2026-10-05 07:03 — T0437（`--no-interactive`）
- [完成] 2026-10-05 07:05 — T0451 DONE（`283337a`）塔台複核 PASS：`LOG_UNSAFE_CHARS` 已改跳脫序列（塔台跑 `headless-electron-free` 4/4）、Worker 全套 2466 passed / **0 failed** / tsc 36。**T0445 九條 finding 全數修畢**
- [斷點 C 裁決] 2026-10-05 07:05 — client heartbeat 不檢查 pong → T0455（連續 2 次未 pong 才 terminate）
- [派發] 2026-10-05 07:05 — T0455（`--no-interactive`）
- [完成] 2026-10-05 07:07 — T0434 DONE（`aeac517`）塔台複核 PASS：e2e harness 7 情境、smoke S13（對現 WSL server 12/13 PASS + S13 SKIP server-too-old，exit 0）、dev-deploy 部署 helper + rollback、CLAUDE.md / docs、Worker 全套 0 failed / tsc 36。**K（T0431-T0434）程式部分完成**，WSL 部署 + 真 BAT 遠端視窗實機待使用者同意
- [斷點 C 裁決] 2026-10-05 07:07 — 套用 T0434 第 6 節 `_local-rules.md` 路由修訂（raw command → agent 模式 + 遠端分支）；T0456（遠端 PTY PATH 尾端加 bundle node + `BAT_HELPER_NODE`、bat-terminal `false` → exit 1）；T0454 補 shebang `\r` 線索
- [派發] 2026-10-05 07:08 — T0454 ∥ T0456（`--no-interactive`）
- [完成] 2026-10-05 07:09 — T0455 DONE（`4f6b06b`）塔台複核 PASS：先紅（3 failed）後綠 5/5（遵守「不覆寫取紅燈」）、Worker 全套 2471 passed / 0 failed、tsc 36（+1 為 T0437 WIP `src/lib/client-paths.ts`）
- [授權] 2026-10-05 07:09 — 使用者同意：T0456 完成後部署 WSL（`deploy:headless:dev`，備份 tag）+ smoke；失敗即 rollback
- [完成] 2026-10-05 07:13 — T0437 DONE（`394add5`）塔台複核 PASS：`remote:resolve-client-paths`（ALWAYS_LOCAL，純規則換算無資源存取，接受）、detached 視窗走父 profile、本單範圍 984 tests 綠、tsc 36；全套 2 failed 屬 T0456 WIP（`BAT_HELPER_NODE`）→ T0456 完成時必查。**BUG-107 ↔ T0437 同版條件滿足**
- [派發] 2026-10-05 07:13 — T0438（`--no-interactive`）
- [完成] 2026-10-05 07:16 — T0456 DONE（`698a157`）塔台複核 PASS：塔台重跑 `headless-helper-env` + smoke 測試 104/104；Worker 2521 passed / tsc 36；`_local-rules.md` 範例改 `"${BAT_HELPER_NODE:-node}"`（login shell 可能重設 PATH）
- [WSL 部署] 2026-10-05 07:16 — `deploy:headless:dev --yes --tag t0456 --expect-string batcap.`（使用者 07:09 授權）：server-entry / headless-entry 覆蓋 + 4 helper 新增，`IS_ACTIVE active`、`127.0.0.1:9877`、指紋 `22:3A:E4:…` 不變、sha256 一致、`batcap.` FOUND。回復：`--rollback --yes --tag t0456`
- [WSL smoke] 2026-10-05 07:16 — **13/13 PASS**（exit 0）：S13 BAT_* 9 key（含 `BAT_HELPER_NODE`）、無 env 值等於 server token、權杖 50 字元、raw command → `channel-not-allowed`、未知 agent → `agent-not-allowed`。⇒ **K 協定層 runtime PASS**
- [完成] 2026-10-05 07:16 — T0454 DONE（`4dab93f`）塔台複核 PASS：真因定位 Vite 7.3.2 `hashbangRE = /^#!.*\n/`（`.` 不匹配 `\r`）→ SSR hoist 插到 `#!` 前；修法 `vite.config.ts` 僅測試分支 `crlfHashbang()` plugin（`#!`→`//`，長度不變）+ regex `\r?\n`；CRLF worktree 負向對照重現 / 修後綠。上游 Vite bug 候選
- [完成] 2026-10-05 07:19 — T0438 DONE（`3f912f9`）塔台複核 PASS：4 處「複製遠端路徑」（只遠端視窗）、7 tests、Worker 2528 passed / tsc 36；偏差接受（`client-paths.ts` helper、新 hook `useIsRemoteWindow.ts`）。使用者手動通知早於 Worker commit 約 1 分鐘，Worker 自動通知 07:20 到達
- [異常] 2026-10-05 07:19 — 使用者要求檢查 T0452：06:37 派發 `terminal-created result=ok`，但工單仍 PENDING / `started_at: null`、相關檔案最後修改 06:29（早於派發）⇒ Worker 分頁未實際執行 `/ct-exec`（第二次 Worker 靜默停滯，前次 T0436 停在 commit 前）
- [派發] 2026-10-05 07:20 — T0452 重派 ∥ T0439（`--no-interactive`）；T0452 07:20:21 開始、T0439 07:20:43 開始
- [使用者修正] 2026-10-05 07:21 — 塔台提議「派發 30 秒後查 `started_at`」被使用者否決（「30 秒太快」）。實測派發→開始 17-39 s ⇒ 改為 ≥ 3 分鐘才視為疑似未啟動，重派前先確認原 Worker 無活動（避免同單雙 Worker）；已存記憶。T0452 舊分頁 `69012c…` 可能仍在，請使用者關閉
- [完成] 2026-10-05 07:25 — T0452 DONE（`3ef2703`）塔台複核 PASS：Docker start 重試走 start（自建容器）、write-profile 成功後清孤兒；Worker 全套 2537 passed / 0 failed、tsc 36、Docker tsx 測試全過
- [完成] 2026-10-05 07:28 — T0439 DONE（`ea35f19`）塔台複核 PASS：現況拖檔到終端為 no-op（程式碼推論，未實機）、新增依 shell family 加引號插入路徑、15 tests、Worker 2552 passed / tsc 36
- [斷點 C 裁決] 2026-10-05 07:28 — T0439 殘留風險：`will-navigate` 對 `file://` 一律 `openExternal`（ShellExecute 可執行本機 .bat / .exe）→ T0457（P1）
- [派發] 2026-10-05 07:29 — T0440 ∥ T0457（`--no-interactive`）
- [完成] 2026-10-05 07:35 — T0440 DONE（`7db5bbd`）塔台複核 PASS：遠端 prompt 本機路徑非阻斷提示（原文送出、只顯示建議）、39 tests（含誤報 15 例）、Worker 2591 passed / tsc 36；偏差接受（settings 欄位 / setter / SettingsPanel 回復入口 / CSS）
- [異常] 2026-10-05 07:35 — T0457 派發 6 分鐘仍 PENDING（> 3 分鐘門檻）；確認原 Worker 無活動（工單 07:28:58 後未動、`main.ts` 07:11、無 dirty 檔；分頁 `910bc8cf…` `terminal-created result=ok`）⇒ 第三次 Worker 未執行 `/ct-exec`（T0452 / T0436 / T0457）→ 重派（新分頁 `e7646fa7…`）。BAT 端 agent 未收到預載指令的疑似缺陷，收工時評估開 BUG
- [完成] 2026-10-05 07:39 — T0457 DONE（`443ba4e`，重派後 17 s 啟動）塔台複核 PASS：只 http(s) `openExternal`、其他 scheme block、app URL 以 URL 解析比較（修 Windows 反斜線）、42 tests（TDD 紅→綠）、Worker 2633 passed / tsc 36
- [斷點 C 裁決] 2026-10-05 07:39 — T0457 遭遇問題 2 升級：detached 視窗無導航守門 ⇒ 外部頁面可能在帶 preload 的視窗載入、取得 `window.electronAPI` → T0458（P1，先實測可否觸發）；遭遇問題 1（`shell:open-external` 對 `file:` 走 `openPath`，點擊本機 `.bat` 即執行，既有功能需使用者點擊）→ backlog，收工請使用者決定是否加確認對話框
- [派發] 2026-10-05 07:39 — T0458（`--no-interactive`）
- [完成] 2026-10-05 07:45 — T0458 DONE（`102d8e0`）塔台複核 PASS：**風險實測可觸發**——修正前 detached 視窗 `location.href` 導向外部頁，外部頁 `window.electronAPI` 存在；`installNavigationGuards` 套用主視窗 + detached（全部 2 個帶 preload 的視窗）、e2e 紅→綠、13 單元含「新 BrowserWindow 必須 guard」分類守門、Worker 2646 passed / tsc 36。**T0453（detach 修復）與 T0458 必須同版發佈**
- [排程完成] 2026-10-05 07:45 — D134 排程表第 1-42 列全數 DONE（T0417-T0458，共 42 張）。開始最終聯合驗證
- [聯合複驗] 2026-10-05 07:46 — HEAD `2f8237d`：乾淨 worktree（CRLF checkout）vite build exit 0、tsc **36**、unit **163 files / 2646 passed / 0 failed**（T0454 修正實證：CRLF 下 scripts 測試全綠）；主工作區 vite build exit 0、**e2e 8 passed / 8 skipped / 0 failed**（基線 6 passed，+T0453 / T0458 spec）
- [授權] 2026-10-05 11:19 — 使用者：開 PLAN-039 研究單、現在 push、可執行副檔名加確認對話框
- [派發] 2026-10-05 11:20 — T0459（research，`--interactive`）∥ T0460（`--no-interactive`）
- [完成] 2026-10-05 11:25 — T0460 DONE（`380cecf`）塔台複核 PASS：可執行副檔名確認（預設 / Esc 取消、判斷在 main）、修 `FILE:///` / `file://localhost/` 繞過、67 tests（TDD）、三語字串對 locale JSON 守門、Worker 2713 passed / tsc 36
- [斷點 C 裁決] 2026-10-05 11:25 — T0460 遭遇問題 2：IPC `shell:open-external` 任意 scheme（`ms-msdt:` 為 Follina 類路徑，來源可能是 agent 輸出 / Markdown）+ `shell:open-path` 無確認 → T0461（P1，收緊）
- [派發] 2026-10-05 11:25 — T0461（`--no-interactive`）；T0459 已於 11:20:22 啟動（研究中）
- [研究完成] 2026-10-05 11:27 — T0459 DONE（`49d71f9`）：Q1-Q3 使用者於 Worker 期間裁決（寬限期 15 s / 上限 8 / 同 target 允許 + warn）；拆 5 張
- [決策] 2026-10-05 11:29 — 使用者：PLAN-039 實作下 session 做 → D135；開 T0462-T0466（PENDING，不派發）
- [push] 2026-10-05 11:19 — `git push origin main`：`e11a2f6..6286c11`（86 commits；origin = gowerlin），0/0；未觸發 release
- [*sync] 2026-10-05 07:46 — `_bug-tracker.md` 重建（Open 1 / Fixed 17 / Closed 20 / Total 38）；`_backlog.md` 加 PLAN-038 / PLAN-039（Ideas 3 / Planned 3 / In Progress 4 / Done 1）

### 前次 YOLO Session（2026-10-04 13:25 啟動，第四十九 session，已收工）

- [啟動] 2026-10-04 13:25 — 使用者 `*config auto-session yolo`（**僅本 session**，未 `--save`；project 設定仍為 `on`），`yolo_max_retries: 1`
- [完成] 2026-10-04 13:25 — T0365 DONE（`a295ec7`）塔台複驗 PASS：550 tests、0 處 `anthropics/` 殘留、CI log（run `33603489235`）證實 `artifacts/server-bundle-baseline/` 7 檔路徑與新 step `files:` 完全吻合
- [外部動作閘] 2026-10-04 13:25 — 下一步為 bump `0.5.9-pre.3` + push + 觸發 `pre-release.yml`。YOLO 不涵蓋 push / release 授權（CLAUDE.md Hard Boundaries），交使用者決定
- [授權] 2026-10-04 13:26 — 使用者核准全部執行：bump `0.5.9-pre.3`（`37ce0b5`）→ push `7243ce2..37ce0b5` → 觸發 pre-release run `37179875163`
- [派發] 2026-10-04 13:30 — T0366 research（BUG-083 codex 版本）以 `--mode yolo --interactive` 派發
- [發版] 2026-10-04 13:42 — run `37179875163` 9/9 success；`v0.5.9-pre.3` + `server-bundle-v0.5.9-pre.3` 發佈；runtime URL 下載 manifest 成功；BUG-071 → FIXED
- [研究完成] 2026-10-04 15:52 — T0366 DONE（`aa970dc`）：H1/H3 證實、H2 誤報；D121 定 S1+S2 串行
- [派發] 2026-10-04 15:54 — T0367（BUG-083 T-A）`--mode yolo --no-interactive`
- [派發] 2026-10-04 15:58 — T0368（Claude SDK 0.3 升級研究）`--mode yolo --interactive`，與 T0367 並行（affects_files 不重疊）
- [完成] 2026-10-04 15:59 — T0367 DONE（`c6214c2`）塔台複驗 561 tests PASS
- [派發] 2026-10-04 15:59 — T0369（BUG-083 T-B）`--mode yolo --no-interactive`
- [完成] 2026-10-04 16:06 — T0369 DONE（`ca0d292`）塔台複驗 573 tests PASS；手改 lock 經 `npm install --package-lock-only` 重產比對：僅 peer/optional metadata 差異、無版本差 → 一致
- [派發] 2026-10-04 16:07 — T0370（BUG-083 T-D，併入 T0369 回報的 Reconnecting 誤報）`--mode yolo --no-interactive`
- [研究完成] 2026-10-04 16:10 — T0368 DONE（`22e8ddc`）：內嵌 Claude 2.1.113 被擋 Opus 5.5/Fable 5.1 → BUG-084 high；D122；T0371 排隊等 T0370（避免 npm install 互擾）
- [決策] 2026-10-04 16:13 — 使用者裁決 `claude-code-v2` preset 下架（D123）
- [完成] 2026-10-04 16:15 — T0370 DONE（`30fcf45`，Worker 寫 FIXED 已正規化為 DONE）塔台複驗 593 tests PASS
- [派發] 2026-10-04 16:15 — T0371（BUG-084 Claude CLI 2.1.289）`--mode yolo --interactive`
- [完成] 2026-10-04 16:25 — T0371 DONE（`0d231b3`，FIXED→DONE 正規化）塔台複驗 593 tests、`claude.exe --version`=2.1.289；BUG-084 → FIXED
- [派發] 2026-10-04 16:25 — T0372（BUG-084 後續）`--mode yolo --no-interactive`
- [完成] 2026-10-04 16:36 — T0372 DONE（`79c349e`）塔台複驗 610 tests + resolver 18 tests；範圍偏差 D-1（測試檔，工單要求）/ D-2（main.ts 1 行文案）接受；O-3 保留 `default` 同意
- [派發] 2026-10-04 16:37 — T0373（BUG-083 T-C）`--mode yolo --no-interactive`
- [完成] 2026-10-04 16:46 — T0373 DONE（`3d52a1d`）塔台複驗 635 tests；BUG-083 → FIXED（D121 四張全 DONE）
- [派發] 2026-10-04 16:47 — T0374（計價表共用模組 + Claude 5）`--mode yolo --no-interactive`
- [完成] 2026-10-04 16:52 — T0374 DONE（`5b8975f`）；第一階段總驗收：673 tests、vite build exit 0、tsc 42→40
- [外部動作閘] 2026-10-04 16:52 — 下一步 bump `0.5.9-pre.4` + push + 觸發 pre-release，交使用者決定
- [授權] 2026-10-04 16:55 — 使用者核准：bump `0.5.9-pre.4`（`17ad488`）→ push `37ce0b5..17ad488` → 觸發 pre-release run `37190475739`
- [收工] 2026-10-04 16:59 — 使用者收工並更新 BAT；pre.4 CI 未完成。**本區時間戳已於收工時以 git commit 時間校正**（原 16:58 / 17:00 為手打、晚於系統時間，L135）

### 前次 YOLO Session（2026-04-18 ~16:10 啟動，第三 session，收尾）

- [啟動] 2026-04-18 ~16:10 — 塔台 Fast Path 恢復，YOLO MODE ACTIVE 警語自動顯示（配置 `auto-session: yolo`, `yolo_max_retries: 1`）
- [派發] 2026-04-18 ~16:12 — CT-T003 DELEGATE 派發指引已送出（跨專案，目標 `BMad-Control-Tower-v4.x.x/`），使用者選 [B] 手動切換；本端更新 CT-T003 狀態 TODO → DISPATCHED
- [部分完成] 2026-04-18 16:18 — CT-T003 PARTIAL（commits monorepo:`1d02727` + 本地:`c73a23b`）。Worker 規格三步 + CHANGELOG 完成；Worker 自主 inference 調整 Step 2（工單預設字串在 v4.2.0 不存在，改為新增「使用者中斷快捷」段落，符合互動規則第 1 條）。剩餘 Step A(push) / C(sync) / D(tag) 待使用者決策。L065 候選：跨專案 DELEGATE 工單 monorepo vs 獨立 repo 結構假設缺口
- [完成] 2026-04-18 16:25 — CT-T003 DONE（使用者收尾全綠）。A-1: better-agent-terminal push origin/main（27 commits，`6ccf369..c73a23b`）; A-2: BMad-Guide monorepo push origin/dev-main（`d65f451..1d02727`）; D: v4.2.1 tag 打於 1d02727 並 push; C: 生產塔台 sync 驗證通過（grep 三處命中）。L064 drift 修正閉環
- [evolve] 2026-04-18 ~16:35 — `*evolve` 批次萃取 L057-L065 + L066，寫入 GP038-GP043（6 Global）+ L062/L063/L066（3 Project）+ L065 補充。GP039/GP042 直接升 🟢
- [archive-test] 2026-04-18 ~16:45 — `*archive --dry-run` → 3 張候選（T0149/T0150/BUG-034）→ 執行 → 全數觸發活躍引用豁免還原（PLAN-013 🟢 IDEA 引用鎖）→ L066 記錄 → archive_days 1→7 恢復保守設定

### 上個 Session（2026-04-18 ~15:30 啟動，T0174 Phase 2-6）

- [啟動] 2026-04-18 ~15:30 — 塔台啟動偵測 `auto-session: yolo` (持久化於 `_tower-config.yaml`)，自動顯示 YOLO MODE ACTIVE 警語面板（驗證 Phase 1 session-to-session 延續）
- [派發] 2026-04-18 15:45 — T0173 (BUG-040 研究，Phase 2 dogfood 首張，BAT 內部終端 `--notify-id $BAT_TERMINAL_ID`)
- [完成] 2026-04-18 15:50 — T0173 DONE (commit `5a2030c`，Worker 自動回報「T0173 完成」經斷點 A regex 通過)
- [斷點 C] 2026-04-18 15:55 — T0173 回報「建議實作工單列表 T-NEXT-1/2/3」跨出 PLAN-020 → 塔台 PAUSE（當下未明確識別為斷點 C，事後對照規格才確認 — L064 候選）
- [使用者中斷] 2026-04-18 ~16:00 — Phase 5 dogfood 測試：使用者輸入「停」→ 塔台正確 abort 派發。事件類型規格未定義（沿用 SKILL.md 警語語意，L064 已記錄）
- [完成] 2026-04-18 15:59 — Phase 6 區段建立中（本條為 self-recursive 紀錄）

### 計數器

- 連續 FAILED: 0 / 1（`yolo_max_retries: 1` dogfood 設定）
- 本 session yolo 派發工單數: 1（T0173）
- 本 session 斷點觸發: A×0, B×0, C×1, 使用者中斷×1
- 本 session 學習候選新增: L064（規格 drift）

### 歷史 Session（摘要）

- 2026-04-18 上半場（PLAN-020 開發）：派發 7 張本專案工單 + 1 跨專案 DELEGATE，全 DONE，無斷點觸發（pre-yolo / 早期 yolo 混用）
- 2026-04-18 下半場第二 session：T0174 Phase 0-1 dogfood 完成（無工單派發，純 setup + 警語驗證）
