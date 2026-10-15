# Tower State — better-agent-terminal

> 最後更新:2026-10-15 02:10 (UTC+8) — **第六十三 session 收工**：連國盛回報 → BUG-134 / 135 → T0531 / T0532 全 DONE → **`v0.6.0-pre.11`** + **`v0.6.1-pre.1`** 已發佈 → D143（版號線 0.6.1）。
>
> **下次起手**:Fast Path 載入；等使用者 / 連國盛（BUG-134）與 Gary（BUG-127-135、116 / 118）`v0.6.1-pre.1` 驗收回饋；下一版 `0.6.1-pre.2`。

---

## 🛏 本 Session 收工快照 (第六十三 session, 2026-10-15 01:14 - 02:10, ~56m wall)

### 主軸：Fast Path 起手 → 補第六十二 session 快照 → 連國盛回報 BUG-134 → T0531 → **`v0.6.0-pre.11`** → BUG-135 / T0532 → 版號線改 0.6.1（D143）→ **`v0.6.1-pre.1`**

#### 時間線（時間取自系統 / git / gh）

1. **01:14** Fast Path 起手：發現 state 漏記第六十二 session（T0526-T0530、pre.9 / pre.10）
2. **01:16** 使用者轉述連國盛回報（關閉工作區全部終端後主畫面殘留其他終端、像當機）→ 開 **BUG-134** / 01:17 派 **T0531**（`2c714f6`）
3. **01:22** 補第六十二 session 快照、歸檔第六十 session（INDEX 78，`2f16951`）；塔台誤報「pre.9 / pre.10 發布說明為空」（PowerShell `.Length` 量到行數），實際完整，未改 release
4. **01:22** 使用者本機 pre.10 重現 → 情境 (a) 確認（`c733adc`）
5. **01:27** T0531 DONE（`d41280a`）：根因為 CSS —— `.workspace-container.hidden` 用 `visibility: hidden`，子元素 `.workspace-tab-panel.active` 翻回 visible，空工作區透明容器透出隱藏工作區；`removeTerminal` focus 跨工作區為附帶缺陷 → 塔台聯合複驗全綠（`49af84c`）
6. **01:29** 使用者選 A → push + 派 pre.11；01:32 使用者同意修兩件小事 → 開 **BUG-135** / 派 **T0532**（`491e553`）
7. **01:44** T0532 DONE（`8b5251a`）：5 處 focus fallback 限 active 工作區、預設終端建立中顯示不透明 placeholder → 聯合複驗全綠（`7b5fcb6`）
8. **01:47** **`v0.6.0-pre.11` 已發佈**（run `38607028430` @ `49af84c`）；使用者要求改版號 0.6.1-pre.1 →（選「pre.11 跑完接著發」）→ 01:50 package.json bump + push + 派 run
9. **02:05** **`v0.6.1-pre.1` 已發佈**（run `38610008131` @ `e715c2b`，10 job 全綠）；兩版發布說明皆已寫入；02:08 **D143**（`646c77e`）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **2**（T0531 / T0532） | 皆 DONE、一次啟動 |
| 發版 | 2（`v0.6.0-pre.11` / `v0.6.1-pre.1`） | 各 10 job 全綠 + server-bundle 7 assets |
| BUG | 新開 2（134 / 135）→ 皆 FIXED | Open 0 / Fixed 16 / Closed 44 |
| 決策 | D143 | 預覽版版號線改 `0.6.1-pre.N` |
| unit test | 3713 → **3730 passed / 225 files** | |
| e2e（新） | `t0531-empty-workspace-view`、`t0532-default-terminal-no-empty-flash` | |

### 重點觀察

- 塔台在 Worker 進行中依半成品 diff 向使用者轉述根因（`removeTerminal`），與 Worker 最終結論（CSS visibility）不同 → 已更正；**Worker 未回報前不轉述根因**
- PowerShell 對 gh 多行輸出取 `.Length` 得到行數而非字數，造成「發布說明為空」誤判；檢查 release body 用 `gh release view --json body -q .body | wc -c` 或直接讀內容

### 編號起始（下 session）

- **T0541** / **BUG-138** / **PLAN-043** / **D145** / **L151** / **CT-T013**（2026-10-15 16:13：PLAN-041 納入方案 D（T0538）並開工；T0535 16:32 DONE（`f26b7641`，契約未改，unit 3840 綠、e2e 綠；待實測：真實 claude CLI 閒置時是否有週期輸出導致 BUSY），16:33 派 T0536，16:5x DONE（`26f6996e`，headless 重用同一 scheduler；worker 權杖被拒訊息為 `role-not-allowed`，接受）；T0537 16:54 DONE（`e965f993`，主行程查詢時 fallback window registry 已存歸屬；殘餘：Terminal Server 未存活時尚未開啟的工作區回 NOT_FOUND）；T0538 17:04 DONE（`8fd7bdf7`，Worker 標籤 / 已回報 / 塔台右鍵批次關閉，頁內確認）→ PLAN-041 BAT 端四張全完成，剩 CT-T011；T0540 17:20 DONE（`a058fbd4`，Windows server 模式 detached 孫程序殘留 → taskkill /T 後再 pty.kill；quit Step A 改 IPC `server:shutdown`）；CT v5.1.0 已裝（CT-T011 / CT-T012 source DONE，runtime 驗收 BMad-Guide T0136 等 pre.3）；T0539 17:30 DONE（`2ff55bdd`，BUG-137 FIXED；sourceTerminalId 改記 BAT_TOWER_TERMINAL_ID）→ PLAN-042 DONE；PLAN-041 BAT 端完成，待 0.6.1-pre.3 實機驗收（真實 claude / codex Worker 閒置是否 BUSY）；BUG-136 等 Gary pre.2 測試；PLAN-042 開立（BUG-137 / T0539 / T0540 / CT-T012）；派發順序 T0535 → T0536 → T0537 → T0538 → T0540 → T0539，同一工作樹不並行；CT-T011 / CT-T012 交 BMad-Guide 塔台；15:44 開 PLAN-041（D144）；BUG-136 於 2026-10-15 13:13 開立；T0533 於 13:17 派發、13:25 DONE，隨 v0.6.1-pre.2 發佈（Release 2026-10-15 13:39）；T0534 研究「收單後自動關閉 Worker 終端」於 15:15 派發、15:26 收單 DONE，推薦方案 B'；使用者改為開關與延遲放 CT `*config`、不做 local_rule → D144 / PLAN-041）

---

## 🛏 前 Session 收工快照 (第六十二 session, 2026-10-14 16:55 - 18:38, ~1h43m wall)

> 本段於 2026-10-15 01:21 第六十三 session 補寫（第六十二 session 未寫收工快照）；時間取自 git commit / gh run。

### 主軸：Gary pre.8 日誌 → BUG-132（cwd 檢查）→ **`v0.6.0-pre.9`** → PLAN-040 擴大實作 + BUG-133 → **`v0.6.0-pre.10`**

#### 時間線（時間取自 git / gh）

1. **16:55** 開 **T0526**（BUG-129 Gary 日誌分診，研究）→ 17:02 DONE（`050b12b`）：判定 T0523 §1 **#11**（agent CLI 沿用別的分頁的 `BAT_*`）；開成 Claude 是另一個原因（Settings 未設預設 Agent）
2. **17:05** **D141** → 開 **BUG-132** / 派 **T0527**（派工 cwd 與落點工作區一致性檢查、`--agent` 簡寫）→ 17:18 DONE（`a371ce5`），BUG-132 FIXED；PID 鏈根治入 backlog
3. **17:23** 開 **T0528**（研究：Codex CLI 在 BAT 終端貼圖）→ 17:34 DONE：可用（Ctrl+V → Alt+V），不改產品
4. **17:36** **`v0.6.0-pre.9` 已發佈**（run `38541740029` @ `7b0322a`）；17:37 package.json 同步（`c1d44f3`）
5. **17:51** **D142**：PLAN-040 擴大為工作區層級 Agent ＋ 啟動參數 → 派 **T0529** → 18:08 DONE（`c89be6c`），PLAN-040 DONE
6. **18:09** T0529 範圍外發現 → 開 **BUG-133** / 派 **T0530**（detached 視窗開設定）→ 18:17 DONE（`5bacb58`），BUG-133 FIXED；CLAUDE.md 補 detached 不渲染 SettingsPanel 規則（`e524867`）
7. **18:36** **`v0.6.0-pre.10` 已發佈**（run `38548961092` @ `e524867`）；18:38 package.json 同步（`65cda7a`）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **5**（T0526-T0530） | 全 DONE；T0526 / T0528 為研究單 |
| 發版 | 2（`v0.6.0-pre.9` / `pre.10`） | 兩次 run 皆 success，各附 `server-bundle-v<版號>`；發布說明已寫 |
| BUG | 新開 2（132 / 133）→ 皆 FIXED | Open 0 / Fixed 14 / Closed 44 |
| 決策 | D141 / D142 | |
| PLAN | PLAN-040 DONE | |
| unit test | ✅ **3730 passed / 225 files** | 塔台聯合複驗 @ `a27904f7` |

### 編號起始（下 session）

- **T0531** / **BUG-134** / **PLAN-041** / **D143** / **L151**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-15 02:10 UTC+8（第六十三 session 收工）

### 近期完成
- `v0.6.1-pre.1`（10-15 02:05，`e715c2b1`）/ `v0.6.0-pre.11`（10-15 01:47，`49af84ca`）已發佈：BUG-134 / 135（T0531 / T0532），版號線改 0.6.1（D143）
- `v0.6.0-pre.10` 已發佈（10-14 18:36，run `38548961092` @ `e524867`）：工作區設定（預設 Agent + 啟動參數，PLAN-040 / D142）、detached 開設定（BUG-133）
- `v0.6.0-pre.9` 已發佈（10-14 17:36，run `38541740029` @ `7b0322a`）：派工 cwd 檢查、`--agent` 簡寫（BUG-132 / D141）
- T0526-T0530 全 DONE；unit 3713 passed / 223 files；使用者本機安裝版 = pre.10（尚未換裝 0.6.1-pre.1）
- BUG Open 0 / Fixing 0 / Fixed 16（含 BUG-134 / 135） / Closed 44

### 待辦（依優先序）

1. 🟡 **`v0.6.1-pre.1` 已發佈**（2026-10-15 02:05，run `38610008131` @ `e715c2b1`，BUG-135 + 空狀態不閃）、**`v0.6.0-pre.11`**（01:47，run `38607028430` @ `49af84ca`，BUG-134）→ 待使用者 / 連國盛 / Gary 驗收 BUG-127-135；版號線改 `0.6.1-pre.N`（D143），下一版 `0.6.1-pre.2`
2. 🟡 **Gary 回饋**（建議直接裝 `v0.6.1-pre.1` arm64 dmg）：BUG-127-135 + BUG-116 / 118 驗收
3. 🟡 **使用者 Windows**：BUG-130 間歇性（再失效查 `[terminal-paste]`）；真人項 BUG-105 / 107 / 108；Docker 精靈 BUG-097 / 111（需 Docker Desktop）
4. 🟢 清理：T0514 / T0515 / T0520 保留的 docker image
5. 🟢 backlog：PID 鏈辨識呼叫者（D141）、遠端派工 cwd 檢查、recovery `shellArgs` 為空（T0525 §5-2）、Windows `CF_HDROP` 路徑貼上、`*archive` 到齡候選（L133）、Codex 面板 Cache History、server-bundle `ubuntu-22.04` 2027-04-17 停用、PLAN-038、BUG-084 / PLAN-035 Phase 2、D094 復議

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）／發版說明（L150）
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。發版 run 完成後同一步 `gh release edit --notes-file` 寫發布說明。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open 0 / Fixing 0 / Fixed 16 / Closed 44）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D143）｜ Learnings → [_learnings.md](_learnings.md)（最大 L150）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（79 entries）

### 編號起始
- **T0533** / **BUG-136** / **PLAN-041** / **D144** / **EXP-[TOPIC]-001** / **L151**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.6.1-pre.1**（package.json + lock，2026-10-15 01:50 `e715c2b1`；D143 版號線改 0.6.1） |
| **最新 release** | `v0.6.1-pre.1`（2026-10-15 02:05，run `38610008131`，target `e715c2b1`，T0532：BUG-135、空狀態不閃；10 job 全綠）+ `server-bundle-v0.6.1-pre.1`（7 assets）。前一版 `v0.6.0-pre.11`（2026-10-15 01:47，run `38607028430`，target `49af84ca`，T0531：BUG-134）+ `server-bundle-v0.6.0-pre.11`（7 assets）。再前 `v0.6.0-pre.10`（2026-10-14 18:36，run `38548961092`，target `e524867`，T0529 / T0530：工作區設定、BUG-133）+ `server-bundle-v0.6.0-pre.10`。前一版 `v0.6.0-pre.9`（2026-10-14 17:36，run `38541740029`，target `7b0322a`，T0527：BUG-132）+ `server-bundle-v0.6.0-pre.9`。再前 `v0.6.0-pre.8`（2026-10-14 14:20，run `38520403729`，target `887ff20`，BUG-127-131）。更早版本見 `_archive/state-snapshots/2026-Q4.md` |
| **前一 tag** | `v0.6.0-pre.11`（2026-10-15 01:47，`49af84ca`） |
| **目前主軸** | `v0.6.1-pre.1` 已發佈（BUG-134 / 135）；等使用者 / 連國盛 / Gary 驗收 |
| **工單最大編號** | T0532（DONE `8b5251a8`，BUG-135）；T0521-T0532 全 DONE |
| **BUG 最大編號** | **BUG-135**（FIXED，T0532）；Open 0 / Fixing 0 / Fixed 16（127-135 待 Gary / 使用者驗收；097 / 105 / 107 / 108 / 111 待真人；116 / 118 待 Gary）/ Closed 44 |
| **PLAN 最大編號** | **PLAN-040**（**DONE** 2026-10-14，T0529）；PLAN-039 DONE；PLAN-038（IDEA）；PLAN-036 / 037 / 035 / 031 IN_PROGRESS |
| **決策最大編號** | D143 |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower v5.0.9 |
| **unit test 基線** | **3730 passed / 225 files / 1 skipped**（塔台聯合複驗 2026-10-15 @ `a27904f7`）；typecheck 0 / typecheck:electron 0 |

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
> 最後掃描:2026-10-15 01:21 (UTC+8) 第六十三 session（Fast Path 局部更新；前次 Full Scan 2026-10-13 15:40）

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`, terminal `66447ea9…` |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（PowerShell 複核 2026-10-15 01:15）；T0531 派工 exit 0 |
| BAT 安裝版 | ✅ `v0.6.0-pre.10` | FileVersion 確認（2026-10-15 01:15） |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ 單一目錄 | `%APPDATA%\BetterAgentTerminal\Logs\debug-<stamp>.log`（10-14 01:54 新檔）；`.userdata-migration.json` marker 存在（BUG-119） |
| 平台 | Windows | PowerShell 主，Bash tool 並存；repo 已有 `.gitattributes`（`* text=auto eol=lf`，T0493） |
| UAC | ⚠️ `EnableLUA=0` | BAT 與子 shell 皆提權（BUG-085 背景） |
| gh CLI | ✅ | 已登入 `gowerlin`；**必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `main` = `origin/main`（2026-10-15 02:10 收工 push）；`src/styles/settings.css` 顯示 M 但內容無差異（未處理） |
| WSL | dev-deploy + docker | `~/.local/bat-server` tag `t0456`（舊）；WSL 內 `docker.io` 29.1.3（T0467 安裝，保留） |
| ct-exec / ct-done / ct-status / evolve / insights / fieldguide / help | ✅ | |
| 熱區工單 | **T:177 檔 / BUG:59 / PLAN:12** | `archive_days: 2` 下大量到齡候選（先 grep 程式碼引用，L133） |
| 最大編號 | **T0532 / BUG-135 / PLAN-040 / D143 / L150** | 下張：T0533 / BUG-136 / PLAN-041 / D144 / L151 |
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
