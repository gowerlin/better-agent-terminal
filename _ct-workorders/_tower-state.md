# Tower State — better-agent-terminal

> 最後更新:2026-10-18 21:25 (UTC+8) — **第八十三 session 收工**：PLAN-049 W2c / W3 / W4 完成、BUG-156–163 批次修正、發佈 `v0.7.1-pre.2`、PLAN-051 維持 IDEA（D169）、CT 演進史交 BMad-Guide（T0175）、MCP 實作報告更新（T0661）。
>
> **下次起手**:使用者已換裝 `v0.7.1-pre.2` → 以 FileVersion 確認（L127）→ ① 本批 BUG 實機驗收（BUG-157 / 160 / 162 / 163 / 158 / 161 可在本機；BUG-156 需 Docker Desktop、BUG-159 需一般權限）→ ② PLAN-047 收尾盤點；③ 前期驗收。
---

## 🛏 本 Session 收工快照 (第八十三 session, 2026-10-18 18:10 - 21:25, ~3h15m)

### 主軸：網站 W2c / W3 / W4 → 一路挖出遠端相關 BUG-156–163 → 批次修正 → 發 `v0.7.1-pre.2`；PLAN-051 評估（維持 IDEA）；CT 演進史跨專案交辦

#### 時間線（時間取自系統 / git / gh）

1. **18:10** 啟動（CT v5.9.0；BAT 安裝版 `0.7.1-pre.1`；本分頁即「以塔台開啟 Claude」的 `better-agent-terminal · Tower`，舊分頁已不在 `scope: towers`）；`*sync` 修 T0613 / T0639 FIXED → DONE（`4bac4b8f`）
2. **18:14** T0646 W2c `/remote/` ＋ T0647 PLAN-051 研究並行 → T0647 DONE：建議維持 IDEA、更正 SendMessage / `codex queue` 前提 → 使用者選 IDEA + 開 codex daemon 探針（D169，T0648）
3. **18:31** T0646 DONE（底稿落後清單 + 8 項產品問題）→ 使用者預覽後 push（`e2cd8e49`）→ 1–5 照建議：BUG-156 / 157 / 158、PLAN-052、docs 工單
4. **18:35–19:20** T0649（BUG-156 Docker 挑埠）、T0650（BUG-157 釘選）、T0648 探針 → BUG-159 / T0651（codex `--no-daemon`）、T0652（BUG-158 i18n + 網站同步）、T0653（docs 指南）、T0654（S13 smoke）、T0655（BUG-160 SSH 釘選，T0652 發現）
5. **19:12–20:00** T0656 W3 截圖 / 短片 → 截圖拍出 BUG-163（精靈按鈕無樣式）；使用者截圖發現 ⚠️ 誤顯示 → BUG-162 / T0657（`PostToolBatch`，Q-1 經 `--answer` 答 [A]）；T0658（BUG-163 + 重拍）、T0659 W4（OG / sitemap / lychee / MP4）
6. **20:2x** 使用者：BUG-161 放進本版 → T0660；「BAT × Control Tower」改名「與 Control Tower 協作」（`224c9966`）；CT 演進史交 BMad-Guide 塔台（`_handover-2026-10-18-ct-evolution-doc-update.md`，對方 T0175 / D073 → DONE D074）；D170 網站摘要方案 B
7. **20:49–20:57** 發版前驗證全綠 → bump `9c5fe2b1` → run `39128867451` 全綠 → **20:55 `v0.7.1-pre.2`** → 更版重點 → 三文件 `c678fc02` → Pages / link-check 0 errors → 通知 CT 塔台
8. **20:57–21:20** T0661 MCP 實作報告（BMad-Guide `33f2a07`）、T0662 網站「Control Tower 怎麼長出來的」→ 使用者預覽後 push（`bd061968`，link-check 0 errors）；BMad-Guide dev-main 由對方塔台經使用者確認 push（`099056a..e656893`）
9. **21:25** 收工（使用者「收工, 換版」）

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | **17**（T0646–T0662） | 全部 `started:`；`worker_auto_close` 回收 17 次；最多 3 張並行；結構化提問 1 次（T0657） |
| BUG | BUG-156–163 開立並 FIXED（8 張，待實機） | 全由網站 / 截圖 / 使用者截圖挖出 |
| PLAN / 決策 | PLAN-052 IDEA；PLAN-051 維持 IDEA；D169 / D170 | |
| 發版 | 1（`v0.7.1-pre.2`） | exe 298 / zip 412 / AppImage 297 / dmg 310 MiB |
| 網站 | 3 次上線（`/remote/`、pre.2 同步、演進史一節） | link-check 0 errors |
| unit test | 5384 → **5597 passed / 317 files** | 塔台複驗 @ `2056ce47` |
| 跨專案 | CT 演進史交辦（BMad-Guide T0175 DONE）、版號通知、dev-main push 協調 | 跨 session 訊息 4 則 |

### 重點觀察

- 要求「對得上程式碼」的網站寫作工單本身就是很好的稽核：T0646 一張挖出 8 項產品問題，W3 截圖再挖出 BUG-163
- 並行工單即使產品段落不重疊，共用檔（`main.ts`）也會讓 `git commit --only` 混入別人的 hunk（L168）；Playwright `outputDir` 會清空 `e2e-results/`（L169）；claude bypass 下「危險 rm」仍跳對話框 → ⚠️ 誤報（L170）
- 跨專案 repo 的 push：自己的 commit 疊在對方未 push 的 commit 上時，交由對方塔台（經使用者確認）一起推

### 編號起始（下 session）

- **T0663** / **BUG-164** / **PLAN-053** / **D171** / **L171** / **CT-T022**

---

## 🛏 前 Session 收工快照 (第八十二 session, 2026-10-18 17:56 - 18:08, ~12m)

### 主軸：`v0.7.1-pre.1` 安裝版實機驗收——PLAN-050 DONE、BUG-155 CLOSED、CT-T021（CT v5.9.0）四情境全 PASS（T0645）

#### 時間線（時間取自系統 / git）

1. **17:56** 啟動（CT **v5.9.0**；BAT 安裝版 FileVersion `0.7.1-pre.1`）；`--set-role tower --mode on` exit 0；面板出現「以塔台開啟 Claude」提示（本分頁名稱 `better-agent-terminal · d64be7`）；啟動 `bat_whoami` / `scope=towers` 即驗到 `agent`、`claudeSessionName` / `claudeSessionId`、兩個塔台
2. **17:57** 使用者「留在這個分頁，先跑 Worker 探針和 CT-T021」→ T0645 建單（`9dff2569`）→ 17:58:22 派工 `started:` → Worker 名稱 `better-agent-terminal · Worker · T0645`（BAT 與 ListAgents 一致）→ 17:59 DONE（`c0799a77`）
3. **18:00** 使用者在 Worker 分頁 `/clear` → `claudeSessionId` 換新、名稱與 `agentStartedAt` 不變；`--close-worker` exit 0；回函 `BMad-Guide/_ct-workorders/_reply-2026-10-18-ct-v590-runtime.md` + 跨 session 訊息（收件人以 v5.9.0 第 ② 步選出）→ 對方 D071（情境 2–4 PASS）
4. **18:02** 使用者同意 → BUG-155 CLOSED（`efe8efba`）
5. **18:03** 使用者以「以塔台開啟 Claude」開新分頁 → ListAgents `better-agent-terminal · Tower`（`role: shell`，未宣告不在 `scope: towers`）→ 情境 1 PASS → PLAN-050 DONE（`e8ddd1a0`）→ 通知對方（對方於回函補記）
6. **18:0x** 使用者問分頁標題 `Claude CLI · Tower` 與 session 名稱 `better-agent-terminal · Tower` 不同是否正常 → 正常（標題給 BAT 畫面、session 名稱給 ListAgents；T0644 設計）
7. **18:08** 收工

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | **1**（T0645 探針） | `started:`；`worker_auto_close` 回收 1 次 |
| BUG / PLAN | BUG-155 CLOSED；PLAN-050 DONE | |
| 跨專案 | CT-T021 實機驗收全數完成（對方 D071） | 跨 session 訊息 2 則，收件人以 `scope: towers` 選出 |

### 重點觀察

- 新入口開的分頁只命名、不宣告：兩個分頁標題都是 `Claude CLI · Tower`，畫面上不易分辨；使用者若改用新分頁，需在新分頁跑 `/control-tower` 並關掉舊分頁
- CT 可選建議（重複 Tower 名稱帶短 ID）不開單，遇到實際撞名再議

### 編號起始（下 session）

- **T0646** / **BUG-156** / **PLAN-052** / **D169** / **L168** / **CT-T022**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-18 21:25 UTC+8（第八十三 session 收工）

### 近期完成
- `v0.7.1-pre.2` 發佈（20:55，run `39128867451`）：BUG-156–163 修正、網站 `/remote/` / 截圖 / 短片 / OG / link-check
- PLAN-049 W2c / W3 / W4 完成；網站「與 Control Tower 協作」改名、功能導覽加「Control Tower 怎麼長出來的」（D170）
- PLAN-051 評估 → 維持 IDEA（D169）；codex daemon 探針 → BUG-159
- CT 演進史由 BMad-Guide T0175 補到 v5.9.0；MCP 實作報告補到 `v0.7.1-pre.2`（BMad-Guide `33f2a07`，已 push）

### 待辦（依優先序）

1. 🔴 **`v0.7.1-pre.2` 實機驗收**（使用者已換版；先以 FileVersion 確認）：BUG-157 釘選 → 儲存、BUG-160 SSH 釘選按鈕停用、BUG-162 權限請求後 ⚠️ 消失、BUG-163 精靈按鈕 / 進度條、BUG-158 / 161 中文；BUG-156 需 Docker Desktop、BUG-159 需一般權限 + codex
2. 🟡 PLAN-047 收尾盤點（frontmatter 仍 IN_PROGRESS；M1 / M1b / W1 已完成）；PLAN-052 Docker 可用性（IDEA）
3. 🟢 T0656 列的「需使用者手動拍」素材（Claude 面板對話、真實狀態列、BAT MCP、Codex、語音）；網站 3 頁缺 `description`、404 `og:description`
4. 🟢 BUG-136 等 Gary 日誌；`RECOVERY_PENDING` 實機未驗；WSL bat-server 仍 `0.6.1-pre.5`（升級後可跑 `smoke:remote:headless` 驗 S13）
5. 🟢 前期驗收（Gary BUG-127-135 / 116 / 118、BUG-130 / 105 / 107 / 108 / 097 / 111、T0550、dmg / AppImage、NSIS 重裝、T0360）

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）／更版重點必寫（L150 → `_local-rules.md`）／發佈後同步 repo 文件與網站
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。**每次發版** run 完成後同一步 `gh release edit --notes-file` 寫更版重點，`gh release view --json body` 確認後，再更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 commit + push，確認 Pages 綠燈、首頁版號、`link-check` summary，才回報已發佈。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 1 / Fixing 0 / Fixed 27 / Closed 20）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D170）｜ Learnings → [_learnings.md](_learnings.md)（最大 L170）
- 網站 → https://gowerlin.github.io/better-agent-terminal/｜ 素材 spec → `e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1`，輸出 `e2e-media/`）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（99 entries）

### 編號起始
- **T0663** / **BUG-164** / **PLAN-053** / **D171** / **EXP-[TOPIC]-001** / **L171** / **CT-T022**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.1-pre.2**（package.json + lock，2026-10-18 `9c5fe2b1`；`0.7.1` 線，D168，最多到 pre.9） |
| **最新 release** | `v0.7.1-pre.2`（2026-10-18 20:55，run `39128867451`，target `9c5fe2b1`：BUG-156–163、網站 W2c / W3 / W4；更版重點含「歡迎協助測試」（codex `--no-daemon`）；repo 文件 `c678fc02`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.7.1-pre.2`（7 assets）。更早見 `release-note.md` / `CHANGELOG.md` |
| **前一 tag** | `v0.7.1-pre.1`（2026-10-18 17:36，`1bc9ccca`） |
| **目前主軸** | `v0.7.1-pre.2` 已發佈（第八十三 session）；下一步實機驗收 BUG-156–163 |
| **工單最大編號** | **T0662** DONE（第八十三 session：T0646–T0662）；更早見 `_archive/state-snapshots/` |
| **BUG 最大編號** | **BUG-163**（BUG-156–163 第八十三 session 開立並 FIXED，待實機）；熱區 Open 1（BUG-136）/ Fixing 0 / Fixed 27 / Closed 20 |
| **PLAN 最大編號** | **PLAN-052**（IDEA：Docker 遠端可用性）；PLAN-051 IDEA（D169）；PLAN-049 IN_PROGRESS（W2c / W3 / W4 完成，剩手動素材等零星）；PLAN-047 IN_PROGRESS（待收尾盤點）；PLAN-015 / 029 / 038 / 043 IDEA |
| **決策最大編號** | **D170**（D169 PLAN-051 維持 IDEA + codex daemon 探針、D170 CT 演進史網站摘要，2026-10-18 第八十三 session） |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v5.9.0**（第八十二 session 載入；CT-T021，BMad-Guide T0174，兩端；實機驗收結案 D071） |
| **unit test 基線** | **5597 passed / 317 files / 3 skipped**（塔台複驗 @ `2056ce47`，發 `v0.7.1-pre.2` 前，2026-10-18 第八十三 session；typecheck 0 / 0、vite build 成功；e2e t0590 / t0567 / t0584 passed） |

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
| BAT 安裝版 | ⚠️ `0.7.1-pre.1`（2026-10-18 18:10 FileVersion）；`v0.7.1-pre.2` 已於 20:55 發佈、使用者收工後換版（新塔台以 FileVersion / 雜湊確認，L127） | 分頁權杖 `batcap.`；Tower `--set-role tower --mode on` exit 0（標題 `Claude CLI · Tower`；session 名稱 `better-agent-terminal · Tower`） |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ 單一目錄 | `%APPDATA%\BetterAgentTerminal\Logs\debug-20261015-195413.log`（本次啟動）；`.userdata-migration.json` marker 存在 |
| 平台 | Windows 11 | PowerShell 主，Bash tool 並存；node `v24.22.0` / npm `12.2.0`；`.gitattributes` `* text=auto eol=lf` |
| UAC | ⚠️ `EnableLUA=0` | BAT 與子 shell 皆提權（BUG-085 背景） |
| gh CLI | ✅ | 已登入 `gowerlin`（keyring）；**必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `main` = `origin/main` @ `2b983a79`（fetch 後）；無其他 worktree / stash；`src/styles/settings.css` 顯示 M 但 `git diff` 無內容（stat-only，未處理） |
| 最新 CI / release | ✅ | Pre-Release run `38871114752` success → `v0.6.1-pre.6` + `server-bundle-v0.6.1-pre.6`（2026-10-16 16:11） |
| WSL | Ubuntu-24.04 | `~/.local/bat-server` = `0.6.1-pre.5`（T0559 2026-10-16 14:17；T0559 / T0560 備份已依使用者指示於 14:27 刪除；port 9877，systemd user service active）；nvm 0.40.8 + Node 24.22.0（T0555 / T0556）；`docker.io` 29.1.3 |
| Control Tower skills | ✅ v5.1.0 | control-tower / ct-exec / ct-done / ct-status / ct-evolve / ct-insights / ct-fieldguide / ct-help 全為 5.1.0 |
| 熱區單據 | **T:80 檔 / BUG:30 / PLAN:17 / EXP:0** | 2026-10-17 第七十一 session `*archive` 搬出 176 張（T 135 / BUG 40 / PLAN-039）；43 張因被未結案單據引用保留 |
| 最大編號 | **T0567 / BUG-141 / PLAN-046 / D148 / L153 / CT-T013** | 下張：T0568 / BUG-142 / PLAN-047 / D149 / L154 / CT-T014（第六十七 session 收工時） |
| 非終態工單 | T0360 FIXED（舊單） | 2026-10-16 17:29：T0551 / T0552 / T0554 FIXED → DONE（BUG 已 CLOSED）；第六十六 session 已補正 T0510 / T0153 / CT-T001 / 011 / 012；報告檔 T0292 / 293 / 298 / 302 已歸檔 |
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

- 2026-10-18 第八十三 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0646–T0662 共 17 張全部 `started:`，最多 3 張並行；結構化提問 1 次（T0657 Q-1 `--answer`）；`worker_auto_close` 回收 17 次；`v0.7.1-pre.2` 發佈
- 2026-10-18 第八十一 session：auto-session on，per-dispatch `--mode yolo --no-interactive`（T0637 `--agent codex`）；T0637–T0644 全部 `started:`（codex 首次 `started: <時間>`）；T0642 / T0644 並行、T0644 結構化提問 1 次；`worker_auto_close` 回收 8 次；`v0.7.1-pre.1` 發佈
- 2026-10-18 第八十 session：auto-session on，per-dispatch `--mode yolo --no-interactive`（T0629 `--agent codex`）；T0624–T0636 全 DONE、claude 皆一次啟動（`started:`），codex T0629 `unknown`（pre.8 預期）；T0630 首派被使用者停掉後依 D162 重派；`worker_auto_close` 回收 12 次（T0627 / T0630 首派分頁使用者手動關）；`v0.7.0-pre.9` 發佈
- 2026-10-18 第七十九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0614–T0623 皆一次啟動（T0617 / T0618 探針設計 Renew 各 1 次、T0618 以 ct-done 補結）；最多 2 張並行；`worker_auto_close` 回收 12 次；無發版
- 2026-10-18 第七十八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0612（探針，使用者目視）/ T0613 皆一次完成；`worker_auto_close` 回收 2 次；`v0.7.0-pre.8` 發佈
- 2026-10-18 第七十七 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0601–T0611 皆一次啟動；`v0.7.0-pre.7` 發佈
- 2026-10-18 第七十六 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0596–T0600 皆一次完成（T0597 首派 `create-rate-limited` 重派 1 次），最多 2 張並行；`worker_auto_close` 回收 5 次；`v0.7.0-pre.5` / `pre.6` 發佈
- （更早的摘要已移入 `_archive/state-snapshots/`，見 INDEX）
