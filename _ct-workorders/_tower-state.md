# Tower State — better-agent-terminal

> 最後更新:2026-10-04 20:58 (UTC+8) — **第五十 session 收工** — T0375-T0377 全 DONE；BUG-083 → CLOSED；BUG-085 新開 → FIXED；本地打包版號修正（T0376）runtime PASS。
>
> **下次起手**:Fast Path 載入;**第一件事：收實機驗收**（BUG-071 / 084 / 085），使用者收工時正安裝本機 build `0.5.9-pre.4`（含 T0377，**≠ CI 的 pre.4**）。
>
> **前次更新**:2026-10-04 16:59 (UTC+8) — 第四十九 session 收工:12 張工單、`v0.5.9-pre.3` / `pre.4` 發布。

---

## 🛏 本 Session 收工快照 (第五十 session, 2026-10-04 20:16 - 20:58, ~42m wall)

### 主軸：pre.4 實機驗收起手 → BUG-085（Codex daemon × 提權 Windows）研究 + 修復 → 本地打包版號修正

#### 起手狀態

Fast Path（快照同日 11:09）。git 0/0。發現**已安裝 BAT 為使用者本機 build `1.26.1004195815`**（`app.asar` 20:09；內嵌 claude-code 2.1.289 / codex-sdk 0.160.0，程式碼等同 pre.4），工作區 `package.json` / nuspec dirty 為該次打包副產物。

#### 時間線（時間取自 git commit；使用者截圖無機器時間者不標時刻）

1. 使用者截圖終端 Codex CLI `start the Windows daemon from a non-elevated terminal` → 塔台環境檢查：`EnableLUA=0`（UAC 停用）、BAT 子 shell 提權、分頁解析到使用者自裝 codex 0.160 → **20:22** BUG-085 + T0375 research（`16c36d5`）
2. 使用者實測 Codex Agent 面板：首行 `0.160.0 (embedded)`、黃色 notice、對話成功 → **20:25** BUG-083 **CLOSED**（`0382101`）
3. 使用者問「本地打包版號為何與 pre-release 不同」→ `release.ps1` `--exact-match` 失敗退回時間戳 `1.yy.MMddHHmmss`，另查出砍 `-pre.N`、留 dirty、繞過 verify-*、choco checksum pattern 永不命中
4. **20:37** T0375 DONE（`e9e27ec`）：只影響互動 TUI 路徑（含 codex-cli 派發）；SDK 不受影響；`-c features.daemon_auto_start=false` 跨 0.133 / 0.160 相容
5. **20:40** D124 / D125；dirty 依使用者裁決 A 還原；T0376 / T0377 平行派發（`dba9bf4`）
6. **20:45** T0376（`efb5717`）/ **20:46** T0377（`71706c2`）DONE → 塔台總驗收 709 tests / vite build / tsc 40 → **20:48** BUG-085 **FIXED**（`4dfcbb7`）
7. 使用者本地打包失敗：`release\win-unpacked\resources\app.asar` 被鎖 → Restart Manager（`RmGetList`）查出 **VS Code Insiders**（PID 25192 / 14028）持有 → **20:51** `.vscode/settings.json` 排除 build 輸出目錄（`d44b185`）
8. 重新打包成功：`BetterAgentTerminal Setup 0.5.9-pre.4.exe`（20:55）；nupkg `checksum64` = Setup SHA-256（`21215084…`）；打包後與中途失敗後 `git status` 皆乾淨 → **T0376 runtime PASS**
9. 20:58 收工；使用者安裝本機 build 更版

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | 3（T0375-T0377） | 全 DONE；1 research + 2 實作（平行） |
| BUG | 新開 1（085 → FIXED）；CLOSED 1（083） | FIXED 待實機：071 / 084 / 085 |
| 決策 | 2（D124 / D125） | |
| Learnings | L136、L137 | |
| unit test | ✅ **709 passed / 50 files** | 第五十 session 673 → 709（塔台親跑） |
| 塔台直接改動 | 1（`.vscode/settings.json`） | 使用者授權 |
| Commits | 11（含本收工），**未 push** | `0e43457..HEAD` |

### 重點觀察 / Learnings

- **L136**：Electron 系 IDE（VS Code）會持有 build 輸出內 `.asar` 的 handle，electron-builder 清 `win-unpacked` 失敗。以 Restart Manager 查持有者，不要猜
- **L137**：注入參數給「版本未知」的第三方 CLI（終端 preset 走 shell PATH）時，優先用 config-override 形式（`-c key=value`，舊版容忍未知鍵），不用新增的 argv flag（舊版 exit 2）
- R-G001 自查：BUG-085「回報者」欄原寫 `20:19` 為塔台推估值（截圖無機器時間），收工時已更正

### 編號起始（下 session）

- **T0378** / **BUG-086** / **PLAN-035** / **D126** / **L138**

---

## 🛏 前 Session 收工快照 (第四十九 session, 2026-10-04 11:08 - 16:59, ~5h50m wall)

### 主軸：T0215 debug 清理 → *archive 回歸修復 → BUG-071 發版閉環 → Codex / Claude 內嵌 CLI 落後雙修 → v0.5.9-pre.4

#### 起手狀態

快照 32 天（> 7 天）→ Full Scan 複核：git 零漂移、熱區與編號一致、BAT workspace ID 換新（`cc0afc4a-…`）。中途使用者 `*config auto-session yolo`（僅本 session）。

#### 時間線（時間取自 git commit）

1. **11:10** 跨塔台清理請求 → T0363（T0215 DEBUG log 三處）→ `36bf6f0`；Worker 回報 AC-3 失敗 → 塔台複驗為**自身上個 session `*archive`（`7243ce2`）移走 parser-parity 測試樣本**造成 → T0364 `ddef6b0` 修測試、L133 + `_local-rules` 歸檔豁免
2. **13:14** BUG-071 複查：placeholder 早已移除，但 runtime 下載預設網址指向**不存在的 `anthropics/`**、gowerlin 0 個 `server-bundle-v*` → D120 → T0365 `a295ec7`
3. **13:26** 首次 push + 發 `v0.5.9-pre.3`：9/9 job、首個 `server-bundle-v0.5.9-pre.3`、runtime URL 下載 sha256 三方一致 → BUG-071 FIXED
4. **13:30** 測試者回報 Codex 需更新 → BUG-083 + T0366 research（H1/H3 證實、H2 誤報）→ D121 串行 T0367 / T0369 / T0370 / T0373 → FIXED
5. **15:58** 使用者問「SDK 是否最新」→ T0368 research → **內嵌 Claude 2.1.113 被服務端擋 Opus 5.5 / Fable 5.1** → BUG-084（high）→ D122 → T0371 / T0372 / T0374 → FIXED；D123 使用者裁決 `claude-code-v2` 下架（Phase 2）
6. **16:55** bump + push + 觸發 `v0.5.9-pre.4`（run `37190475739`）→ 收工後 17:10 驗證 9/9 success、兩個 release 齊全；安裝檔 +22~32%

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | 12（T0363-T0374） | 全 DONE；2 research + 10 實作；YOLO 串行 |
| BUG | 新開 2（083/084）；FIXED 3（071/083/084） | 三張皆待使用者實機驗收 |
| 決策 | 4（D120-D123） | |
| Learnings | L133、L134、L135 | |
| unit test | 550 → **673**（47 files） | tsc 42 → 40 |
| Release | `v0.5.9-pre.3` ✅ / `v0.5.9-pre.4` ✅ | 首次 server bundle release |
| 依賴 | codex-sdk 0.124 → 0.160；claude-code 2.1.113 → 2.1.289 | claude-agent-sdk 仍 0.2.113（Phase 2） |

### 重點觀察 / Learnings

- **L133**：本專案產品測試讀 `_ct-workorders/` 真實檔，塔台 meta 操作（歸檔）可打破 main
- **L134**：內嵌第三方 CLI 落後會被**服務端以版本門檻直接拒絕新模型**（Codex `requires a newer version`、Claude `claude_code_version_too_old`）——落後 = 功能故障，非「少新功能」。每次預覽版發布前檢查 `npm view` 版本
- **L135**：塔台在快速連續作業中**又手打時間戳**（YOLO 歷程曾寫出比系統時間晚的 16:58 / 17:00），違反 R-G001；收工以 git commit 時間校正
- Worker 兩次把工單 status 寫成 `FIXED`（BUG 狀態詞）—— 塔台正規化為 `DONE`；工單執行指示明寫「完成請寫 `DONE`」後未再發生

### 編號起始（下 session）

- **T0375** / **BUG-085** / **PLAN-035** / **D124** / **L136**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-04 20:58 UTC+8（第五十 session 收工）

### 本 session 已清空的項目
T0375-T0377 全 DONE ✅ ｜ BUG-083 → CLOSED ✅ ｜ BUG-085 → FIXED ✅ ｜ 本地打包版號（D125）runtime PASS ✅ ｜ unit test 673 → 709 ✅

### 待辦（依優先序）

1. 🟡 **收實機驗收**（使用者安裝本機 build `0.5.9-pre.4`，產出 20:55，含 `71706c2`；先以 `app.asar` 時間 / 雜湊比對 `release\win-unpacked` 確認裝到這版，L127）：BUG-085 Codex CLI 分頁進 TUI + 首次黃色 toast ｜ BUG-084 Claude 面板 Opus 5.5 對話、下拉無 alias 重複 ｜ BUG-071 WSL wizard 第 4 步 → 通過即 CLOSED
2. 🟡 **push**（`0e43457..HEAD` 11 commits，未授權）→ 下一預覽版 `v0.5.9-pre.5`（T0376 / T0377 進 CI；發版前依 L134 查 `npm view` 版本）
3. 🟡 **BUG-084 Phase 2**：`claude-agent-sdk` 0.3.x + `claude-code-v2` 下架（D123）+ `src/types/index.ts:122` 過時註解
4. 🟢 L130 D094 門檻復議 ｜ L128 CLAUDE.md Logging 節 ｜ BUG-061 tsc baseline 40 ｜ `release/` 舊產出（`0.3.1` / `1.26.*`）由使用者清理
5. 🟢 `*archive`：到齡候選（**先 grep 程式碼引用，L133**）

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`** —— 三個 remote，預設會解析到 upstream tony1223。

### ⚠️ 版本驗證鐵則（L127）
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。錯誤訊息被擴寫時字串仍在。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（10 熱區：Open 1 / Fixed 3 / Closed 6）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D125）｜ Learnings → [_learnings.md](_learnings.md)（最大 L137）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（65 entries）

### 編號起始
- **T0388** / **BUG-095** / **PLAN-037** / **D129** / **EXP-[TOPIC]-001** / **L138**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.5.9-pre.4**（package.json + lock；T0376 後本地打包預設即取此值） |
| **最新 release** | `v0.5.9-pre.4`（2026-10-04 17:10 驗證：9/9 success，5 檔 + `server-bundle-v0.5.9-pre.4` 7 資產）；前一版 `v0.5.9-pre.3` + `server-bundle-v0.5.9-pre.3`（首個 server bundle release，D120） |
| **前一 tag** | `v0.5.9-pre.3`（2026-10-04） |
| **目前主軸** | 實機驗收（BUG-071 / 084 / 085）→ push + `v0.5.9-pre.5` → Phase 2 Claude SDK 0.3 |
| **工單最大編號** | T0387；T0386（PLAN-036 研究）/ T0387（BUG-093）23:34 平行派發；T0385 DONE（`c4e82ba`）；T0380-T0384 全 DONE（PLAN-035 Phase 0-1）；BUG-093 由「T0385 後串行」改為 T0385 完成後與 T0386 平行（使用者裁決） |
| **BUG 最大編號** | BUG-094；093 FIXING（T0387）；087/089/090/091/092/094 CLOSED（23:46 實機）；086（無發行版分支）/ 088（SSH）FIXED 待對應實機 |
| **PLAN 最大編號** | PLAN-036（headless 功能 handler 層，PLANNED，研究 T0386）；PLAN-035 IN_PROGRESS（Phase 1 完成，Phase 2/3 與 PLAN-036 的先後待 T0386 建議） |
| **決策最大編號** | D128 |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower v5.0.9 |
| **unit test 基線** | **920**（65 files）；tsc baseline 40 |

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
> 最後掃描:2026-10-04 11:09 (UTC+8) 起手 Full Scan；2026-10-04 20:58 第五十 session 收工逐項更新
> 複核結果：git 零漂移（`origin/main` = `7243ce2`，0/0）；熱區計數與最大編號與 09-02 收工一致；無新 release / 開放 PR / 開放 issue；BAT workspace ID 已換新（下列已更新）。

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（10-04 更新；舊值 `2eda2f34-…` 已失效） |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（10-04 PowerShell 複核） |
| BAT 安裝版 | ⚠️ 收工時使用者更版中 | 起手時為本機 build `1.26.1004195815`（`app.asar` 20:09）。收工時使用者安裝本機 build `0.5.9-pre.4`（`release\` 20:55 產出，含 T0377，**非 CI 的 pre.4**）——下次起手以 `app.asar` 時間 / 雜湊確認（L127） |
| BAT_HELPER_DIR | ✅ | `C:/Program Files/BetterAgentTerminal/resources/scripts` |
| BAT debug log | ⚠️ 路徑與文件不符 | 實際在 `%APPDATA%\better-agent-terminal\Logs\debug-<stamp>.log`（與 `BAT_USER_DATA` 指向的 `BetterAgentTerminal\` 為**兩個並存目錄**，大小寫不同）。CLAUDE.md Logging 節待修（L128） |
| 平台 | Windows | PowerShell 主，Bash tool 並存 |
| UAC | ⚠️ `EnableLUA=0` | 本機 UAC 停用 ⇒ BAT 與所有子 shell 皆提權。Codex 0.160 daemon 會拒絕（BUG-085）；T0377 後 BAT 自動對 codex-cli 注入 `-c features.daemon_auto_start=false` |
| gh CLI | ✅ | 已登入 `gowerlin`。⚠️ **必須帶 `-R gowerlin/better-agent-terminal`**（L122），本 session 三次 gh 操作皆遵守 |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ⚠️ | `origin/main` = `0e43457`；本地領先 11 commits（第五十 session，未 push） |
| ct-exec / ct-done / ct-status / evolve / insights / fieldguide / help | ✅ | 全套可用 |
| 熱區工單 | **T:23 / CP-T:1 / BUG:10 / PLAN:6 / EXP:0 / CT-T:1** | T:23 中 4 張為報告檔（L132），實際工單 19；BUG：Open 1 / Fixed 3 / Closed 6 |
| 最大編號 | **T0377 / BUG-085 / PLAN-034(archived) / D125** | 下張：T0378 / BUG-086 / PLAN-035 / D126 / L138 |
| unit test | ✅ **673 passed / 47 files** | 第四十九 session 550 → 673（塔台親跑） |
| vite build | ✅ | 第五十 session 塔台親跑通過 |
| tsc --noEmit | ⚠️ 40 既有 error | baseline 不變（BUG-061） |
| 開放 PR | **0** | PR #19 已於本 session 處置關閉（D119） |
| 設定來源 | project | `_tower-config.yaml`（auto-session **on**, yolo_max_retries 1, auto_commit on, archive_days 2） |
| 塔台版本 | v5.0.9 | control-tower skill |

> **Drift / 注意事項**:
> 1. ✅ `_tower-state.md` 19.5 KB（正常，< 30 KB 軟警告）；起手式無歷史內嵌
> 2. ⚠️ 工作區長期存在 `AGENTS.md` dirty（claude-mem 自動產生，非程式碼）。本 session 全程以 `git commit --only` 精確指定路徑，10 個 commit 皆未觸碰
> 3. ✅ CLAUDE.md「Release」節已於本 session 校正（CP-T0362），並補上 `build-server-bundle.yml` 第三個 trigger
> 4. 🔴 **D094 mac installer 280 MB cap 已連三個 release 超標 2.6 倍**（v0.5.8 / pre.1 / pre.2 之 mac dmg 皆 ~724 MB）**且從未觸發復議** —— 門檻與現實脫節，見 L130
> 5. ⚠️ CLAUDE.md「Logging」節路徑錯誤（L128），待修
> 6. ⚠️ `_ct-workorders/T0293-review-report.md` 含 2 個 NUL 位元組（既有，非本 session 產生）；全庫其餘檔案控制字元掃描為零
> 7. ⚠️ **L132**：`T0292/T0293/T0298/T0302-*-report.md` 4 檔命名越界（報告卻掛工單前綴），落在 `*archive` F-24 排除規則的縫隙裡 —— 永不歸檔也永不判定。2026-09-02 使用者裁決 **A：維持現狀**，日後新報告一律用 `_report-` 前綴
> 8. ⚠️ **L129 實證**：本 session 收工時以 bash heredoc 寫 python，反斜線被摺疊一層，導致 regex backreference 變成 SOH 控制字元寫進 4 個 BUG 檔（已修）。**含反斜線的內容一律走 Write 工具**
> 9. ⚠️ **L136**：VS Code Insiders（Electron）曾鎖住 `release\win-unpacked\resources\app.asar` 導致打包失敗；已於 `.vscode/settings.json` 排除 build 輸出目錄（`d44b185`），下次打包若再發生代表是擴充套件持有，以 Restart Manager 查

---

## YOLO 歷程

> 本區段依 `references/yolo-mode.md` § 「`_tower-state.md` 新增 `## YOLO 歷程` 區段」規格產生。
> **Footnote**：本 session [斷點 C] 標記僅取狹義（Worker 跨 PLAN 建議）；使用者手動「停」暫不歸 A/B/C，列為 `[使用者中斷]` 自訂事件（待 L064 上游修正）。

### 當前 Session（2026-10-04 13:25 啟動，第四十九 session，已收工）

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
