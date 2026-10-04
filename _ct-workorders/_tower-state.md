# Tower State — better-agent-terminal

> 最後更新:2026-10-04 16:59 (UTC+8) — **第四十九 session 收工** — 12 張工單全 DONE；BUG-071 / BUG-083 / BUG-084 → FIXED；`v0.5.9-pre.3` 已發布、`v0.5.9-pre.4` CI 收工時仍在跑。
>
> **下次起手**:Fast Path 載入;**第一件事：驗 `v0.5.9-pre.4` CI 結果**（run `37190475739`），再收使用者實機驗收回報。
>
> **前次更新**:2026-09-02 15:52 (UTC+8) — 第四十八 session 收工:BUG-082 CLOSED、`v0.5.9-pre.2` 發布。

---

## 🛏 本 Session 收工快照 (第四十九 session, 2026-10-04 11:08 - 16:59, ~5h50m wall)

### 主軸：T0215 debug 清理 → *archive 回歸修復 → BUG-071 發版閉環 → Codex / Claude 內嵌 CLI 落後雙修 → v0.5.9-pre.4

#### 起手狀態

快照 32 天（> 7 天）→ Full Scan 複核：git 零漂移、熱區與編號一致、BAT workspace ID 換新（`cc0afc4a-…`）。中途使用者 `*config auto-session yolo`（僅本 session）。

#### 時間線（時間取自 git commit）

1. **11:10** 跨塔台清理請求 → T0363（T0215 DEBUG log 三處）→ `36bf6f0`；Worker 回報 AC-3 失敗 → 塔台複驗為**自身上個 session `*archive`（`7243ce2`）移走 parser-parity 測試樣本**造成 → T0364 `ddef6b0` 修測試、L133 + `_local-rules` 歸檔豁免
2. **13:14** BUG-071 複查：placeholder 早已移除，但 runtime 下載預設網址指向**不存在的 `anthropics/`**、gowerlin 0 個 `server-bundle-v*` → D120 → T0365 `a295ec7`
3. **13:26** 首次 push + 發 `v0.5.9-pre.3`：9/9 job、首個 `server-bundle-v0.5.9-pre.3`、runtime URL 下載 sha256 三方一致 → BUG-071 FIXED
4. **13:30** 測試者回報 Codex 需更新 → BUG-083 + T0366 research（H1/H3 證實、H2 誤報）→ D121 串行 T0367 / T0369 / T0370 / T0373 → FIXED
5. **15:58** 使用者問「SDK 是否最新」→ T0368 research → **內嵌 Claude 2.1.113 被服務端擋 Opus 5.5 / Fable 5.1** → BUG-084（high）→ D122 → T0371 / T0372 / T0374 → FIXED；D123 使用者裁決 `claude-code-v2` 下架（Phase 2）
6. **16:55** bump + push + 觸發 `v0.5.9-pre.4`（run `37190475739`）—— **收工時 CI 仍在跑，結果未驗**

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | 12（T0363-T0374） | 全 DONE；2 research + 10 實作；YOLO 串行 |
| BUG | 新開 2（083/084）；FIXED 3（071/083/084） | 三張皆待使用者實機驗收 |
| 決策 | 4（D120-D123） | |
| Learnings | L133、L134、L135 | |
| unit test | 550 → **673**（47 files） | tsc 42 → 40 |
| Release | `v0.5.9-pre.3` ✅ / `v0.5.9-pre.4` ⏳ CI | 首次 server bundle release |
| 依賴 | codex-sdk 0.124 → 0.160；claude-code 2.1.113 → 2.1.289 | claude-agent-sdk 仍 0.2.113（Phase 2） |

### 重點觀察 / Learnings

- **L133**：本專案產品測試讀 `_ct-workorders/` 真實檔，塔台 meta 操作（歸檔）可打破 main
- **L134**：內嵌第三方 CLI 落後會被**服務端以版本門檻直接拒絕新模型**（Codex `requires a newer version`、Claude `claude_code_version_too_old`）——落後 = 功能故障，非「少新功能」。每次預覽版發布前檢查 `npm view` 版本
- **L135**：塔台在快速連續作業中**又手打時間戳**（YOLO 歷程曾寫出比系統時間晚的 16:58 / 17:00），違反 R-G001；收工以 git commit 時間校正
- Worker 兩次把工單 status 寫成 `FIXED`（BUG 狀態詞）—— 塔台正規化為 `DONE`；工單執行指示明寫「完成請寫 `DONE`」後未再發生

### 編號起始（下 session）

- **T0375** / **BUG-085** / **PLAN-035** / **D124** / **L136**

---

## 🛏 前 Session 收工快照 (第四十八 session, 2026-09-02 12:51 - 15:38, ~2h45m wall)

### 主軸：BUG-082 runtime 驗收閉環 → 跨塔台回函 → 社群 PR 處置 → v0.5.9-pre.2

#### 起手狀態

Fast Path 有效（快照 2026-09-01 22:05，距今 ~15h）。熱區 T:13 / BUG:8 / PLAN:6 / EXP:0 / CT-T:1。

#### 時間線

1. **12:51 起手** — 執行起手式第 1 步（確認安裝版換版）。**發現交接的判準是錯的**（見下 L127），改以 diff 驗證：`resources/scripts/bat-terminal.mjs` 與修復後 source **byte-identical** ⇒ 換版已生效，阻塞解除
2. **12:53 建 CP-T0362 + 派發** — 刻意用 `CP-` 前綴工單作為 BUG-082 runtime 驗收載體，載荷為 CLAUDE.md Release 節校正（L123/L124）
3. **12:55-12:58 CP-T0362 DONE**（Worker ~3.5 min）— commit `89921e2`；三層鏈路（helper / main / Worker）全綠
4. **13:01 BUG-082 → CLOSED** — commit `46b712a`，附三層證據 + 換版判別法；同時補 Worker 漏掉的 `build-server-bundle.yml` 第三個 trigger
5. **13:05 跨塔台回函** — `_reply-2026-09-02-bat-workspace-default-opinion.md`（245 行），commit `9dc986e`，ACKNOWLEDGED
6. **15:09 PR #19 triage** — 外部貢獻者 RicoChen727，擱置 3 個月。塔台複核 gemini bot 兩則 HIGH review **皆成立** → **D119：取骨架自行實作**，建 T0362 派發
7. **15:11-15:20 T0362 DONE**（Worker ~9 min）— commit `a8ee6a1`；塔台複驗 550 tests + vite build 皆綠
8. **15:24 push + PR 回覆 + 關閉** — 9 commits push；PR #19 留言（issuecomment-5506015464）後 CLOSED
9. **15:25 版號 bump + 觸發 workflow** — 先 bump `0.5.9-pre.2` 再觸發（避開上輪「release 完才補版號」漂移）
10. **15:38 release `v0.5.9-pre.2` 發布** — 全 9 job 綠，5 artifact

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| BUG 結案 | 1（BUG-082 → CLOSED） | runtime 三層驗證 |
| 派發工單 | 2（CP-T0362 / T0362） | 全綠，各 1 round，共 ~13 min Worker wall |
| 新增測試 | +39 cases | 511 → **550** |
| 跨塔台回函 | 1 | 245 行，含 1 項我方主動回饋 |
| 社群 PR 處置 | 1（#19 CLOSED） | 取骨架重實作 + 出處保留 |
| 新增決策 | 1（D119） | |
| Push commits | 10 | `96a6a96..70dfec4` |
| Release | 1 | `v0.5.9-pre.2` |
| 就地結案 | BUG 4 + PLAN 1 | BUG-072/073/074（field evidence）+ BUG-078（CI 證據）+ PLAN-032 → DONE |
| *archive | 7 張 | T0335/336/337/348/358/359 + BUG-081；熱區 T:14→8, BUG:8→7 |

### 重點觀察 / Learnings 候選

- **L127**（🔴 高價值）：**以「字串存在與否」判斷版本，在錯誤訊息被擴寫時會反向誤判**。交接寫「grep `expected T followed by digits` 應查無」，但修復後訊息仍含該字串（只是後接新內容）。正確做法是 **diff / 雜湊比對**。本次差點誤判為「安裝沒生效」而停工
- **L128**：BAT 的 debug log 實際在 `%APPDATA%\`**`better-agent-terminal`**`\Logs\debug-<stamp>.log`，但 `BAT_USER_DATA` 指向大小寫不同的 `BetterAgentTerminal\`（**兩目錄並存**），且 CLAUDE.md「Logging」節記的是 macOS 路徑、檔名 `debug.log` 也早已改為輪替式。照文件找必然落空 —— **CLAUDE.md Logging 節待修**
- **L129**（Worker 回報）：**寫入含大量反斜線的檔案一律用 Write 工具**，bash heredoc 會把連續反斜線摺疊掉一層（兩個變一個）造成語法錯誤（T0362 首發即中）
- **L130**（🔴 新，本次發現）：**D094「Mac installer size cap 280 MB」已連續三個 release 超標 2.6×**（v0.5.8 / pre.1 / pre.2 的 mac dmg 皆 ~724 MB）**且從未觸發過復議**。門檻與現實脫節 —— 該復議的是門檻本身，不是每次 release
- **L131**：外部 PR 帶未處理 bot review 時的處置模式 —— 取骨架自實作 + `Co-authored-by` 保留出處 + PR 留言說明採用範圍，見 D119

### 編號起始（下 session）

- **T0363** / **BUG-083** / **PLAN-035** / **D120**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-04 16:59 UTC+8（第四十九 session 收工）

### 本 session 已清空的項目
T0363-T0374 全 DONE ✅ ｜ BUG-071 / 083 / 084 → FIXED ✅ ｜ `v0.5.9-pre.3` + 首個 `server-bundle-v*` ✅ ｜ unit test 550 → 673 ✅

### 待辦（依優先序）

1. 🔴 **驗 `v0.5.9-pre.4` CI**：`gh run view 37190475739 -R gowerlin/better-agent-terminal`；確認 9/9 job、`v0.5.9-pre.4`（5 檔）+ `server-bundle-v0.5.9-pre.4`（7 資產）、**記錄安裝檔大小 vs pre.3**（codex 套件 213→430 MB）。失敗則查因，不自動重跑
2. 🟡 **收實機驗收**（使用者收工時正在更新 BAT）：BUG-071 WSL wizard 第 4 步 ｜ BUG-083 Codex 分頁首行 `Codex CLI 0.160.0 (embedded)`、無紅色 `Codex is ignoring` / `Reconnecting` ｜ BUG-084 Claude 面板選 Opus 5.5 對話、下拉無 alias 重複 → 通過即 CLOSED
3. 🟡 **BUG-084 Phase 2**：`claude-agent-sdk` 0.2.113 → 0.3.x + `claude-code-v2` preset **下架**（D123，含既有設定遷移至 `claude-code`）+ TodoWrite → Task tools；順手改 `src/types/index.ts:122` 過時註解（max = Opus only）
4. 🟢 **L130 D094 門檻復議**：mac installer 280 MB cap 長期超標，pre.4 codex 翻倍後更需復議
5. 🟢 **L128 CLAUDE.md Logging 節待修** ｜ **BUG-061** tsc baseline（42 → 40）｜ ADVISORY B-1 復議
6. 🟢 **`*archive`**：上 session 10 張 + 本 session 工單已到齡候選（**先 grep 程式碼引用，L133**）

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`** —— 三個 remote，預設會解析到 upstream tony1223。

### ⚠️ 版本驗證鐵則（L127）
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。錯誤訊息被擴寫時字串仍在。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（9 熱區：Open 1 / Fixed 3 / Closed 5）｜ Backlog → [_backlog.md](_backlog.md)（6 熱區：Done 1）
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D123）｜ Learnings → [_learnings.md](_learnings.md)
- 跨塔台回函 → [_reply-2026-09-02-bat-workspace-default-opinion.md](_reply-2026-09-02-bat-workspace-default-opinion.md)
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（64 entries）

### 編號起始
- **T0375** / **BUG-085** / **PLAN-035** / **D124** / **EXP-[TOPIC]-001** / **L136**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.5.9-pre.4**（package.json + lock 已同步，commit `17ad488`；release CI 進行中） |
| **最新 release** | `v0.5.9-pre.4`（2026-10-04 觸發，**CI 收工時未完成**，run `37190475739`）；前一版 `v0.5.9-pre.3` + `server-bundle-v0.5.9-pre.3`（首個 server bundle release，D120） |
| **前一 tag** | `v0.5.9-pre.3`（2026-10-04） |
| **目前主軸** | 內嵌 CLI 追版（BUG-083 / BUG-084）收尾 → Phase 2 Claude SDK 0.3 |
| **工單最大編號** | T0374（DONE，commit `5b8975f`） |
| **BUG 最大編號** | BUG-084（FIXED，待實機） |
| **PLAN 最大編號** | PLAN-034（已 archive；熱區最大 PLAN-033） |
| **決策最大編號** | D123 |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower v5.0.9 |
| **unit test 基線** | **673**（47 files）；tsc baseline 40 |

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
> 最後掃描:2026-10-04 11:09 (UTC+8) 起手 Full Scan；2026-10-04 16:59 收工逐項更新
> 複核結果：git 零漂移（`origin/main` = `7243ce2`，0/0）；熱區計數與最大編號與 09-02 收工一致；無新 release / 開放 PR / 開放 issue；BAT workspace ID 已換新（下列已更新）。

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（10-04 更新；舊值 `2eda2f34-…` 已失效） |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（10-04 PowerShell 複核） |
| BAT 安裝版 | ⚠️ 收工時使用者更新中 | 收工前安裝版為 `v0.5.9-pre.2`（`app.asar` 2026-09-02）；使用者收工時更新 BAT（目標 pre.4，CI 當時未完成）——下次起手以雜湊 / `app.asar` 時間確認實際裝到哪版（L127） |
| BAT_HELPER_DIR | ✅ | `C:/Program Files/BetterAgentTerminal/resources/scripts` |
| BAT debug log | ⚠️ 路徑與文件不符 | 實際在 `%APPDATA%\better-agent-terminal\Logs\debug-<stamp>.log`（與 `BAT_USER_DATA` 指向的 `BetterAgentTerminal\` 為**兩個並存目錄**，大小寫不同）。CLAUDE.md Logging 節待修（L128） |
| 平台 | Windows | PowerShell 主，Bash tool 並存 |
| gh CLI | ✅ | 已登入 `gowerlin`。⚠️ **必須帶 `-R gowerlin/better-agent-terminal`**（L122），本 session 三次 gh 操作皆遵守 |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ⚠️ | `origin/main` = `17ad488`（pre.4 bump）；本地另有塔台紀錄 commit 未 push（`79f7314` 起） |
| ct-exec / ct-done / ct-status / evolve / insights / fieldguide / help | ✅ | 全套可用 |
| 熱區工單 | **T:8 / CP-T:1 / BUG:7 / PLAN:6 / EXP:0 / CT-T:1** | `*archive` 後；BUG 為 Open 2 + Closed 5（無 FIXED/VERIFY 掛帳）。⚠️ T:8 中有 **4 張是報告檔非工單**（見 L132），實際工單數 4 |
| 最大編號 | **T0374 / BUG-084 / PLAN-034(archived) / D123** | 下張：T0375 / BUG-085 / PLAN-035 / D124 |
| unit test | ✅ **673 passed / 47 files** | 第四十九 session 550 → 673（塔台親跑） |
| vite build | ✅ | 本 session 親跑複驗通過 |
| tsc --noEmit | ⚠️ 40 既有 error | T0374 消掉 2 個 TS2345；其餘為既有 baseline（BUG-061） |
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
