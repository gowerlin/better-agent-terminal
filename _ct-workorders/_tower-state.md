---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
ct_version: "6.2.0"
inbox_features: ["recommended", "dismiss"]
updated_at: "2026-11-27T14:15:21+0800"
session: "2026-11-27 11:10 第一百三十七 session（CT v6.2.0）"
next_ids:
  workorder: "T0941"
  decision: "D407"
  bug: "BUG-228"
  plan: "PLAN-071"
  user: "U-28"
  action: "A-12"
todo:
  - "✅ `v0.8.0-pre.8` 已驗收（A-8，D401）：BUG-226 CLOSED、T0937「其他」通過；熱區未結 BUG 0。PLAN-070 剩：多選勾選送出（`U-n：A、C`）與推薦預設勾選，待與 CT 6.3.0-pre.1 雙方實機驗收（CT 範例狀態檔見 T0938 收單補記）；預覽版號只剩 pre.9"
  - "⏳ CT 判定（CT D913，T0575）：CT 端 PASS 34 / FAIL 1（M-5-1 確認行要在選單前輸出，CT 規格）/ 未觸發 1；BAT 0 項要改。CT 修正單 T0576（6.3.0-pre.2，14:14 派出）＋補跑清單 `checklist-rerun-630.md`（BAT pre.8、1 個塔台 session 約 4 回合、無 Worker）；收單後 CT 傳清單與換版指令 → BAT 開補跑單。PLAN-070 結案等補跑判定"
  - "🔧 T0940 派工中（BUG-227 FIXING，D406）：單鍵介面（意見調查列等）的作答鍵不算草稿；目標 `0.8.0-pre.9`（此版號線最後一號）"
  - "🚀 `v0.8.0-pre.7` 已發佈並驗收（D387 / D389）：T0935 只寫檔名的參考檔案連結、T0934 💬 卡片連結（A-6 完成）；下一版 `0.8.0-pre.8`"
  - "`v0.8.0-pre.5` 已驗收（D378）：T0929 / T0930 / BUG-225 CLOSED"
  - "候選（未開單，T0930 建議）：`useInboxFileRefs` 跟 `_ct-workorders/` 的 `fs:changed` 重查（💬 卡片連結已由 T0934 完成）"
  - "候選（未開單，T0924 建議）：`scripts/verify-packaged-native.js` `readAsarFile` 不檢查 `fs.readSync` 回傳位元組數，截斷的 app.asar 會被讀成 NUL 而不報錯；改成讀不足判失敗（檢查變嚴）"
  - "PLAN-066（DONE）後續候選（未開單）：`pty:create` 只送 env 差異（`pty-manager.ts`＋Terminal Server 協定）可再降 C2①；direct 模式的 conin socket 殘留；F4（自然結束的 conhost 留到 server 結束）。分支：`ct/T0885`（Rust 評估，D307 保留不合併，worktree 保留）、`ct/T0886`（node-pty Worker 研究，未併入 `v0.8.x`，worktree 已移除）"
  - "PLAN-065 剩餘：per-machine 未提權互動升級（UAC）手動驗收（無法自動化）；降級到 `0.7.4-pre.9` 會結束所有終端且沒有說明（已寫在更版重點〈已知事項〉）"
  - "PLAN-052（IN_PROGRESS）：待 Docker Desktop（Windows / macOS）實機走精靈；後續候選（未開單）：fetch-fingerprint Docker 分支比對憑證指紋、`scripts/docker-acceptance.mjs` 純函式單元測試"
  - "PLAN-058：T0819 安裝版 pre.5 假 API e2e PASS，待使用者手動確認（清單在 T0819 回報區）；可選後續：卡片等待時讓輸入框可送出（T0815〈遭遇問題〉1，未開單）"
  - "待實機驗收：T0827 Linux AppImage 缺字型提示（回報區〈待實機驗收〉4 項）；T0830 真 WSL 的 install-bundle 中止與 keep-alive 關閉後閒置關機；PLAN-038 實機 6 項（T0836 回報區〈待實機驗收〉）；T0840 精靈在真的 BAT 視窗對拋棄式發行版從頭跑一次；T0841「改用 Mirrored 並重試」實機"
  - "候選（未開單，D303 暫不安排）：T0830 後續 SSH / Docker 精靈長呼叫接 operation id；PLAN-052 fetch-fingerprint Docker 分支、docker-acceptance 純函式測試；PLAN-058 卡片等待時可送出（2026-11-20 使用者：先記著、不開單。只涉 Claude Agent 面板（SDK），不影響 Claude CLI 分頁；要做時的建議：輸入框預設收合＋「補充說明」按鈕展開、輸入框有焦點時停用卡片快捷鍵（權限卡在 window 監聽 1/2/3、y/n、Enter、方向鍵）、送出走 T0815 排隊路徑；需實機操作確認）"
  - "MSRC 回報 microsoft/node-pty（使用者自行處理，D255）"
  - "觀察：語音可用性檢查 macOS 未實機（`unknown(timeout)` 出現可把逾時提到 30 s，T0802）；t0757 偶發失敗再發生才開 BUG（D218）；PLAN-060（IDEA）macOS Developer ID 簽章"
  - "版號線：D315 起 `0.8.0-pre.N`（D344 起從 `main` 發），`0.8.0-pre.7` 已發佈（2026-11-27 00:11，D387），下一版 `0.8.0-pre.8`（`-pre.N` 最多到 pre.9；需要第十個預覽版時先與使用者確認改版號線）"
reminders:
  - id: "weekly-log-review"
    title: "每週日誌清查（PLAN-067；到期時塔台開工會提示，只提示不派工）"
    ref: "PLAN-067"
    last_at: "2026-11-25"
    due_at: "2026-12-02"
---
# Tower State — better-agent-terminal

> 🟢 **第一百三十七 session 開工**（2026-11-27 11:10 (UTC+8)，CT v6.2.0，Fast Path；塔台 session `5d626d99-96ab-4455-997a-012d3f9e423b`；`--set-role tower --bat-contract 2 --mode on` exit 0，`bat-contract: 2`、`hooks: ok (injected, set 2)`；BAT helper `0.8.0-pre.7`；`main` = `origin/main` @ `54c7bebc`；熱區 T 331 全 DONE、BUG 89（CLOSED 88 / WONTFIX 1））。

> 🛏 **第一百三十六 session 收工**（2026-11-27 00:22 (UTC+8)）。

> 🟢 **第一百三十六 session 開工**（2026-11-27 00:19 (UTC+8)，CT v6.2.0，Fast Path；塔台 session `db802f66-e1bd-4039-8c2a-94b5dacb2e69`；`--set-role tower --bat-contract 2 --mode on` exit 0，`bat-contract: 2`、`hooks: ok (injected, set 2)`；BAT helper **`0.8.0-pre.7`**（使用者已更版）；`main` = `origin/main` @ `acc74196`；熱區 T 331 全 DONE、BUG 89（CLOSED 88 / WONTFIX 1））。 第一百三十五 session 的紀錄已搬到 [`_archive/state-snapshots/2026-Q4-c.md`](_archive/state-snapshots/2026-Q4-c.md)。

> 最後更新:2026-11-27 00:22 (UTC+8) — **第一百三十六 session 收工**：`v0.8.0-pre.7` 驗收通過（A-6，T0934 / T0935，D389）；驗測範例 U-20 / A-7 建立後已移除（D388）。
>
> **下次起手**:熱區無進行中工單、無未結 BUG、無待你決定 / 待你執行。候選見 frontmatter `todo`；預覽版號只剩 pre.8 / pre.9；PLAN-067 週清查 2026-12-02 到期。

---

## 🛏 本 Session 收工快照 (第一百三十六 session, 2026-11-27 00:19 - 2026-11-27 00:22)

### 主軸：`v0.8.0-pre.7` 驗收

#### 重點（時間取自系統 / git）

1. 使用者更版到 `0.8.0-pre.7`；要求驗測範例 → 暫時的 U-20 / A-7（應連 / 不應連的參考）＋塔台回覆當 💬 卡片範例（D388；U-20 摘要首次超過 120 字，`check-frontmatter.py` 抓到後縮短）
2. `A-7：完成`、`A-6：完成`、`U-20：A` → pre.7 驗收通過（T0935 只寫檔名、T0934 💬 卡片連結），範例移除（D389）

### 本輪戰績
- 工單 0；決策 D388–D389；發版 0；驗收 1（`v0.8.0-pre.7`）

### 編號起始（下 session）
- **T0936** / **BUG-226** / **PLAN-070** / **D390** / **U-21** / **A-8**

---

## 🛏 前 Session 收工快照 (第一百三十五 session, 2026-11-26 21:18 - 2026-11-27 00:15)

- pre.5 驗收（BUG-225 CLOSED）、T0934 💬 卡片連結（`v0.8.0-pre.6`）、T0935 只寫檔名的連結（`v0.8.0-pre.7`），D378–D387。完整紀錄已搬到 [`_archive/state-snapshots/2026-Q4-c.md`](_archive/state-snapshots/2026-Q4-c.md)〈第一百三十五 session〉。

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-11-27 00:22 UTC+8（第一百三十六 session 收工）

### 近期完成
- **`v0.8.0-pre.7` 驗收通過**（第一百三十六 session，D389）：只寫檔名的參考檔案連結（T0935）、💬 卡片連結（T0934）
- **`v0.8.0-pre.5` 驗收通過**（D378）：待辦版面、參考檔案連結、BUG-225 CLOSED；熱區未結 BUG 0

### 待辦（依優先序；完整內容見 frontmatter `todo`）
1. PLAN-065 per-machine UAC 互動升級手動驗收；PLAN-052 Docker Desktop 實機精靈；PLAN-058 手動確認；其他待實機項
2. 候選（未開單）：`readAsarFile` 讀不足判失敗、PLAN-066 後續、`useInboxFileRefs` 跟 `fs:changed` 重查
3. 預覽版號只剩 `0.8.0-pre.8` / `pre.9`（再往後先與使用者確認改版號線）
4. PLAN-067 週清查 2026-12-02 到期（`reminders`）

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式
- 改 `_bug-tracker.md` / `_backlog.md` 不用全檔 `sed`，改完跑 parser 測試（L179）
- 網站驗證用最新 portal-layout `layout-check.mjs`（目前 v1.1.7）；網站改動 push 才會上線
- 產品改動回到 `main`（D344，2026-11-25；取代 D307 的 `v0.8.x` 分流）：新工單從 `main` 開分支、合併回 `main`，從 `main` 發版（`0.8.0-pre.N`）；`v0.8.x` 保留不再使用
- 時間戳一律取系統時間（R-G001；第一百三十一 session 曾手打一次 `updated_at`，已更正）

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 0 / Fixing 0 / Fixed 0 / Closed 88 / WONTFIX 1）｜ Backlog → [_backlog.md](_backlog.md)（IN_PROGRESS 7 / DONE 22）
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D389；D001～D185 封存在 `_archive/decisions/`）｜ Learnings → [_learnings.md](_learnings.md)（最大 L185）
- PLAN-068 網頁版使用說明 → https://claude.ai/artifact/8mepgGP16ghS3m9hsu2Wst（私人）
- 網站 → https://gowerlin.github.io/better-agent-terminal/
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（155 entries；最新 `2026-Q4-c.md`）

### 編號起始
- **T0936** / **BUG-226** / **PLAN-070** / **D390** / **U-21** / **A-8** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L186** / **CT-T023**

---


## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | `main` `package.json` **0.8.0-pre.7**；下一版 **`0.8.0-pre.8`**（從 `main` 發，D344） |
| **最新 release** | `v0.8.0-pre.7`（2026-11-27 00:11 (UTC+8)，Pre-Release `45852929765`，`96915fe9`，D387）；前一 tag `v0.8.0-pre.6`；更早見 `release-note.md` / `CHANGELOG.md` |
| **目前主軸** | 無派工中工單；下一版 `0.8.0-pre.4` 從 `main` 發 |
| **工單最大編號** | **T0921** DONE；熱區 317 張全 DONE |
| **BUG 最大編號** | **BUG-222** CLOSED；熱區 Open 0 / Fixing 0 / Fixed 0 / Closed 85 / WONTFIX 1 |
| **PLAN 最大編號** | **PLAN-068** DONE；IN_PROGRESS 7（038 / 043 / 052 / 058 / 064 / 065 / 067）；IDEA 3 |
| **決策最大編號** | **D345**（push `main`、PLAN-068 / BUG-216 結案，第一百三十一 session） |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v6.2.0**（第一百三十三 session 起；BAT ↔ CT 契約 v2 ＋ `inbox_features`） |
| **unit test 基線** | `main`：**9001 passed / 495 files**（T0921 @ `f9375c2c`）；typecheck 0 / 0 |
| **舊值** | 瘦身前的長版本見 [`_archive/state-snapshots/2026-Q4-b.md`](_archive/state-snapshots/2026-Q4-b.md)〈基本資訊舊值〉 |

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
> 最後掃描:2026-11-24 03:37 (UTC+8) 第一百二十九 session **Full Scan 精簡版**（git / BAT / 計數 / 大小；CI 與 node_modules 沿用前次）；前次 Full Scan 2026-11-16 19:14 第一百二十五 session

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`, terminal `3a9b5550…`；無 `BAT_TOWER_TERMINAL_ID` |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（PowerShell 只列名稱確認）；另有 `BAT_USER_DATA` |
| BAT 安裝版 | ✅ `0.8.0-pre.1` | exe FileVersion 與 `bat-terminal.mjs --version` 皆 `0.8.0-pre.1`（2026-11-24 NSIS 重裝驗收時安裝）；`--set-role tower --mode on` exit 0 |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ | `%APPDATA%\BetterAgentTerminal\Logs\debug-20261124-033706.log`（最新） |
| 平台 | Windows 11 | PowerShell 主，Bash tool 並存；node `v26.13.1` / npm `12.2.2` |
| node_modules | ⚠️ 不完整 | 主 checkout 只剩 26 個套件（2026-11-06 變動）；vite / vitest / react 不在 → 本機測試 / build 前需 `npm ci` |
| gh CLI | ✅ | **必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `main` = `origin/main` @ `97d02625`、`v0.8.x` = `origin/v0.8.x` @ `bcb4bbe0`（fetch 後皆 0 / 0）；worktree：`.bat-worktrees/…/T0885`–`T0890`（保留）、`../.ct-integration/better-agent-terminal`（detached `83597e8e`）；無 stash |
| 最新 CI / release | ✅ | Pre-Release `45244996161` success → `v0.8.0-pre.1`（2026-11-24 03:24 (UTC+8)） |
| GitHub open issues | 0 | |
| Control Tower skills | ✅ v6.0.0 | 正式版（前次 session 為 v6.0.0-rc.1） |
| 熱區單據 | **T:286 / BUG:79 / PLAN:31 / EXP:1** | BUG：FIXED 0 / CLOSED 78 / WONTFIX 1（BUG-215 於 03:41 CLOSED）（與 `_bug-tracker.md` 一致）；PLAN：IN_PROGRESS 7（含 PLAN-066） |
| 非終態工單 | 無 | |
| 最大編號 | **T0890 / BUG-215 / PLAN-066 / D315** | 下張：T0891 / BUG-216 / PLAN-067 / D316 |
| unit test / typecheck | 未重跑 | 最近：8355 passed / 456 files、typecheck 0 / 0（T0869 @ `6269139c`） |
| 檔案大小 | ⚠️ | `_tower-state.md` 約 46 KB（> 30 KB 軟警告）；`_decision-log.md` 391,191（400 KB 預算的 95.5%）；`_learnings.md` 224,244；`_bug-tracker.md` 32,824；`_backlog.md` 11,321 |
| 設定來源 | project | `_tower-config.yaml`（auto-session **on**，`yolo_max_retries: 1`，`auto_commit: on`，`worker_auto_close: done`，`worker_close_delay: 10`） |

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

- 2026-11-03 第一百一十 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0800 `started:`、DONE、無提問；授權 push `ct/T0800` 在 GitHub 驗證；`worker_auto_close` 回收 1 次；`v0.7.4-pre.2` 發佈
- 2026-11-03 第一百零九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0797–T0799 共 3 張全部 `started:`、DONE、無提問；T0798 / T0799 授權 push `ct/*` 分支在 GitHub 迭代；`worker_auto_close` 回收 3 次；無發版
- 2026-11-02 第一百零八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0792–T0796 共 5 張全部 `started:`、DONE、無提問；T0792 / T0793 並行；`worker_auto_close` 回收 5 次；`v0.7.4-pre.1` 發佈
- 2026-11-02 第一百零六 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0787–T0790 共 4 張全部 `started:`、DONE；T0788 / T0789 並行；結構化提問 1 次（T0790 Q-1 `--answer`）；T0788 Renew #1（CT 回覆）；`worker_auto_close` 回收 4 次；`v0.7.3-pre.8` 發佈
- 2026-11-02 第一百零四 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0750–T0778 共 29 張全部 `started:`、DONE；T0770–T0773 四張並行；`worker_auto_close` 回收；`v0.7.3-pre.2`–`pre.5` 發佈
- 2026-11-01 第一百零一 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0720–T0726 全部 `started:`、無提問，T0720 / T0721 / T0722 並行；`worker_auto_close` 回收 7 次；`v0.7.2-pre.6` 發佈
- 2026-11-01 第一百 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0717–T0719 全部 `started:`、依序執行；結構化提問 2 次（T0717 Q-1 / Q-2，`--answer` exit 0 ×2，D192）；`worker_auto_close` 回收 3 次；`v0.7.2-pre.5` 發佈（首發 CI 打包失敗 → BUG-176 / T0719 → 重發）
- 2026-11-01 第九十九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0715 / T0716 `started:`、無提問；`worker_auto_close` 回收 2 次；`v0.7.2-pre.4` 發佈
- 2026-10-30 第九十八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0714 `started:`、無提問；`worker_auto_close` 回收 1 次；`v0.7.2-pre.3` 發佈
- 2026-10-30 第九十七 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0710–T0713 全部 `started:`、無提問，T0711 / T0712 並行；`worker_auto_close` 回收 4 次；`v0.7.2-pre.1` / `pre.2` 發佈
- 2026-10-26 第九十五 session：auto-session on；無派工；`*sync` / `*archive` 138 張；無發版
- 2026-10-25 第九十四 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0703–T0707 全部 `started:`、無提問，T0704 / T0705 並行；`worker_auto_close` 回收 5 次（T0704 / T0705 先改 FIXED → DONE，L177）；`v0.7.1-pre.8` 發佈
- 2026-10-23 第九十一 session：無派工；跨 session 回覆 BMad-Guide 塔台 2 件；無發版
- 2026-10-23 第九十 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0699 `started:`、無提問；`worker_auto_close` 回收 1 次；無發版
- 2026-10-22 第八十九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0695–T0698 全部 `started:`（T0695 / T0696 各重派 1 次，CT-T022 驗收）；結構化提問：T0695 / T0696 走備援（`worker_question_timeout: 0`）、T0698 Q-1 `--answer`；`--close-worker` 重派前 2 次（exit 0 / 3）、收單 4 次；`v0.7.1-pre.6` 發佈
- 2026-10-20 第八十七 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0673 `started:`（Worker 內跑 Workflow，39 agents）；結構化提問 1 次（Q-1，塔台漏接、使用者在 Worker 分頁直接答）；`worker_auto_close` 回收 1 次；無發版
- 2026-10-19 第八十六 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0670–T0672 全部 `started:`，T0670 / T0671 並行；結構化提問 1 次（T0672 Q-1 `--answer`，D174）；`worker_auto_close` 回收 3 次；`v0.7.1-pre.4` 發佈
- 2026-10-19 第八十五 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0666–T0669 全部 `started:`，無並行、無提問；`worker_auto_close` 回收 4 次；`v0.7.1-pre.3` 發佈
- 2026-10-18 第八十四 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0663–T0665 全部 `started:`，T0663 / T0664 並行；無提問；`worker_auto_close` 回收 3 次；無發版
- 2026-10-18 第八十三 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0646–T0662 共 17 張全部 `started:`，最多 3 張並行；結構化提問 1 次（T0657 Q-1 `--answer`）；`worker_auto_close` 回收 17 次；`v0.7.1-pre.2` 發佈
- 2026-10-18 第八十一 session：auto-session on，per-dispatch `--mode yolo --no-interactive`（T0637 `--agent codex`）；T0637–T0644 全部 `started:`（codex 首次 `started: <時間>`）；T0642 / T0644 並行、T0644 結構化提問 1 次；`worker_auto_close` 回收 8 次；`v0.7.1-pre.1` 發佈
- 2026-10-18 第八十 session：auto-session on，per-dispatch `--mode yolo --no-interactive`（T0629 `--agent codex`）；T0624–T0636 全 DONE、claude 皆一次啟動（`started:`），codex T0629 `unknown`（pre.8 預期）；T0630 首派被使用者停掉後依 D162 重派；`worker_auto_close` 回收 12 次（T0627 / T0630 首派分頁使用者手動關）；`v0.7.0-pre.9` 發佈
- 2026-10-18 第七十九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0614–T0623 皆一次啟動（T0617 / T0618 探針設計 Renew 各 1 次、T0618 以 ct-done 補結）；最多 2 張並行；`worker_auto_close` 回收 12 次；無發版
- 2026-10-18 第七十八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0612（探針，使用者目視）/ T0613 皆一次完成；`worker_auto_close` 回收 2 次；`v0.7.0-pre.8` 發佈
- 2026-10-18 第七十七 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0601–T0611 皆一次啟動；`v0.7.0-pre.7` 發佈
- 2026-10-18 第七十六 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0596–T0600 皆一次完成（T0597 首派 `create-rate-limited` 重派 1 次），最多 2 張並行；`worker_auto_close` 回收 5 次；`v0.7.0-pre.5` / `pre.6` 發佈
- （更早的摘要已移入 `_archive/state-snapshots/`，見 INDEX）
