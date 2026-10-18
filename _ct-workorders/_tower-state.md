# Tower State — better-agent-terminal

> 最後更新:2026-10-18 17:39 (UTC+8) — **第八十一 session 收工**：CT-T020 codex 實機驗收結案（T0637，CT v5.8.1 × pre.9）；`/cases` 上線（T0638）；BUG-155 FIXED（T0639）；PLAN-050 Claude session 識別實作完（T0640–T0644，D167）；發佈 `v0.7.1-pre.1`（D168）；CT-T021 委派（對方 D069）。
>
> **下次起手**:使用者安裝 `v0.7.1-pre.1`（重開 BAT）→ 建議用縮圖列「+」→「以塔台開啟 Claude」開塔台 → ① PLAN-050 實機驗收（ListAgents 名稱、`bat_whoami` 的 `agent` / `claudeSessionName` / `claudeSessionId`、`scope: towers`、`/clear` 換 sessionId；BUG-155 實機）；② CT-T021 等 CT v5.9.0 後代跑驗收；③ PLAN-049 W2c / W3 / W4。
---

## 🛏 本 Session 收工快照 (第八十一 session, 2026-10-18 15:28 - 17:39, ~2h11m)

### 主軸：CT-T020 codex 實機驗收（CT v5.8.1 × pre.9，T0637）結案；PLAN-049 `/cases` 上線（T0638）；BUG-155（T0639）；BMad-Guide 需求 → PLAN-050 Claude session 識別（T0640 研究 → D167 → T0641–T0644）；PLAN-051 IDEA；發佈 `v0.7.1-pre.1`（D168）；CT-T021 委派（對方 D069 受理）

#### 時間線（時間取自系統 / git / gh）

1. **15:28** 啟動（CT **v5.8.1**；BAT 安裝版 `0.7.0-pre.9`）；`--set-role tower --mode on` exit 0；啟動 `*sync`（PLAN-049 IN_PROGRESS、CT-T019 frontmatter TODO → DONE，`2becbf32`）
2. **15:33–15:35** 使用者「兩件並行」→ T0637 codex 探針（`--agent codex --wait-started` → `started: 07:34:07Z`、`osc` / `agentStarted: true`）＋ T0638 `/cases`；T0637 發現 `whoami` 缺 `agent` → **BUG-155** → T0639 FIXED（15:49，`149f6f8d`）
3. **15:42 / 15:47** BMad-Guide（`bmad-guide-89`）委託 CT v5.8.1 代跑；另提「session 識別」需求 → PLAN-050
4. **15:45–15:51** T0638 DONE → 使用者預覽 → push `edeff912`（Pages 綠）；BUG-155 修正 push
5. **15:53** CT-T020 ② 由使用者在一般分頁 `codex -a on-request -s read-only` 觸發 → `blocked` / `input` / `osc` → 斷點 D 以分頁標題告知 → 拒絕後清除（L166）；回函 `BMad-Guide/_ct-workorders/_reply-2026-10-18-ct-v581-runtime.md`
6. **15:53–16:19** T0640 研究（`--name` 實測、`--session-id` 不用、hook 帶 sessionId）→ 使用者四題選推薦（D167：R2 (a)+(b)、改 T0600、放寬 D149 `scope: towers`、刪實驗 transcript）
7. **16:19–17:26** T0641 A（16:42）→ T0642 B ＋ T0644 D 並行（T0644 Q-1 經 `--answer` 答 [A]，L167）→ T0643 C（17:24）；塔台逐張複驗
8. **17:1x / 17:25** D168 版號 `0.7.1-pre.1`；使用者要求 PLAN-051（跨塔台傳訊，IDEA）
9. **17:28–17:37** 塔台全量複驗 → bump `1bc9ccca` → run `39115475526` 全綠 → **17:36 `v0.7.1-pre.1`** → 更版重點 + 三文件 `cafee90a`（README 整合點 / 版本對照、`/cases` 12 項）→ CT-T021 委派 → 對方 D069 受理
10. **17:39** 收工（使用者「收工、安裝新版」）

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | **8**（T0637–T0644） | 全部 `started:`（含 codex T0637）；`worker_auto_close` 回收 8 次；最多 2 張並行 |
| 決策 | D167 / D168 | PLAN-050 方案、版號線 |
| BUG / PLAN | BUG-155 FIXED；PLAN-050 IN_PROGRESS（實作完，待實機）、PLAN-051 IDEA | |
| 跨專案 | CT-T020 實機驗收結案；CT-T021 委派（D069） | 全程跨 session 訊息 |
| 發版 | 1（`v0.7.1-pre.1`） | exe 298 / zip 412 / AppImage 297 / dmg 309 MiB |
| unit test | 5298 → **5384 passed / 311 files** | 塔台複驗 @ `b34087d3` |

### 重點觀察

- 外部需求（BMad-Guide session 識別）一個 session 內走完：研究單實測 → 使用者四題決策 → A 先行、B / D 並行、C 收尾 → 發版 → 委派 CT
- 並行工單的 overlap 要連「鎖住對方產品檔的 source guard 測試」一起看（L167）
- 塔台給使用者的 CLI 旗標要先查 `--help`（L166）；塔台寫 CT-T021 `created_at` 時一度手打時間，發現後以系統時間改正（R-G001）

### 編號起始（下 session）

- **T0645** / **BUG-156** / **PLAN-052** / **D169** / **L168** / **CT-T022**

---

## 🛏 前 Session 收工快照 (第八十 session, 2026-10-18 12:35 - 15:21, ~2h46m)

### 主軸：CT v5.7.1 / v5.7.2 代跑驗收結案（T0625–T0629，D163）；PLAN-049 網站從 W1 骨架到 6 頁上線——使用者要求以故事呈現 BAT × CT 整合優勢（D161）、加入 `frontend-design` 與 Design 畫布定方向（D162 / D164）、CT 進階能力與案例（D165）、CT 介紹放寬為「概念加細節」（D166）；CT-T020 CT 端完成（CT v5.8.0）；發佈 `v0.7.0-pre.9`

#### 時間線（時間取自系統 / git / gh）

1. **12:35** 啟動（CT v5.7.2）；`--set-role tower --mode on` exit 0；使用者 [A]：v5.7.x 驗收與 T0624 並行
2. **12:37–12:51** T0624（W1）派工；探針 T0625–T0629 建單（`00a4e346`）；T0625（Q-1 後刻意延遲 60 s）、T0626（塔台刻意不答 Q-3 → 第 6 步晚退回）、T0627（全部 `--ask` 失敗 + 立刻取消）依序 PASS
3. **12:48–12:51** T0624 DONE → 依 D160 啟用 Pages + push（`24c4da3a`，run `39098377237`）；使用者要求 README 加網站連結（`ebeb8016`）
4. **12:5x** 使用者預覽 W1：「介紹過於簡單，沒有體現 BAT 與 CT 整合使用的優勢」＋「故事性敘述：常見問題 vs BAT + CT 解法」→ 規格 `_spec-site-v2-bat-ct-story.md`（D161：主標「一個塔台，指揮整隊 AI Agent」、實績數據、預覽後才 push）；使用者拒絕當時的 T0627 回收 + T0628 派工（先處理網站）
5. **13:05** T0630 首派；使用者貼上 `frontend-design` 等建議、自行停掉 T0630 → D162：T0631 以工單授權安裝 `frontend-design`（13:13 DONE）→ T0632 設計語言 + BAT Design System + Design 畫布 3 方向（13:30 DONE）→ 使用者選 A 進場雷達 + C 時間軸（D164）→ T0630 重派
6. **13:16–13:29** 使用者「也處理暫停的項目」→ T0628（④(b) 時序未重現；已答題取消回 `answered`）、T0629（codex awk 略過 fenced code block、O-2 自檢；發現 F-2 codex 時間戳）PASS → 回函 `BMad-Guide/_ct-workorders/_reply-2026-10-18-ct-v571-v572-runtime.md` 交 `bmad-guide-d8` → 對方 D061 結案（D163）
7. **13:1x** 使用者轉交 `_reply-2026-10-18-ct-t020-done.md` → CT-T020 CT 端 DONE（CT v5.8.0，12:48 已裝本機兩端；V72 / V80 提問規則全文相同）；使用者決定 pre.9 等網站告一段落
8. **13:36–13:46** 使用者補充 4 份 CT 文件 → T0633 研究（`_spec-site-v2-ct-features-cases.md`）→ D165（首頁「越用越懂你的專案」、`/control-tower` 三節、`/cases` W2d）
9. **13:59–14:43** T0630 DONE → 預覽 → push（`08046367`）；T0634 `/control-tower`（14:20）→ push（`13f207f3`）；T0635 `/features` / `/faq` / `/contribute`；14:40 使用者「CT 不開源但可稍微詳細介紹」→ D166（概念加細節、新頁 `/control-tower-tour`）
10. **14:40–15:00** T0635 DONE → 只 push 到 `bc210843`（不含進行中的 T0636）；T0636 DONE → push（`6b7af750`）
11. **15:0x–15:19** 使用者決定這頁上線後發版 → 塔台複驗（typecheck 0 / 0、unit 5298 / 303、vite build）→ bump `c0f4dcae` → run `39106509652` 全綠 → **15:16 `v0.7.0-pre.9`** → 更版重點 + 三文件 `45147203` → 通知 `bmad-guide-43`（d8 已不在）
12. **15:21** 收工（使用者選「現在收工，再安裝 pre.9」）

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | **13**（T0624–T0636；T0630 派兩次） | claude 皆 `started:`；codex T0629 `unknown`（pre.8 預期）；`worker_auto_close` 回收 12 次 |
| 決策 | D161–D166 | 網站 v2 × 5、CT v5.7.x 驗收結案 × 1 |
| 網站 | 6 頁上線（首頁、`/control-tower`、`/control-tower-tour`、`/features`、`/faq`、`/contribute`） | push 5 次，每次使用者預覽後授權；Pages 皆綠 |
| 跨專案 | CT v5.7.1 / v5.7.2 驗收結案（對方 D061）；CT-T020 CT 端 DONE；pre.9 版號已通知 | F-2 / O-3 列 CT v5.8.1 候選 |
| 發版 | 1（`v0.7.0-pre.9`） | exe 298 / zip 412 / AppImage 297 / dmg 310 MiB |
| unit test | **5298 passed / 303 files**（3 skipped） | 塔台複驗 @ `6b7af750` |

### 重點觀察

- 網站以「卡關時刻 vs BAT + CT 解法」故事＋三欄對照呈現整合價值；先在 Design 畫布定方向再實作，Worker 自評＋「主張 → 出處」對照避免誇大（T0630 還抓出規格裡兩句與 BAT 實際行為不符的說法）
- Windows 上 TaskStop 只結束外層 shell，`vitepress preview` 殘留並鎖住 esbuild → T0634 `npm ci` 失敗；改用零依賴靜態伺服器服務 `dist` 複本、以埠查 PID 結束（L164）
- codex Worker 自編時間戳，自檢時又改已送出的題目（F-2，L165）
- CT 新版在驗收途中被裝到本機（12:48）：逐張確認 Worker 載入的版本，並以 V72 / V80 比對確認結論不受影響

### 編號起始（下 session）

- **T0637** / **BUG-155** / **PLAN-050** / **D167** / **L166** / **CT-T021**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-18 17:39 UTC+8（第八十一 session 收工）

### 近期完成
- CT-T020 codex 實機驗收結案（T0637：`started:` / `osc` PASS；手動 codex 分頁 `blocked` / `input` PASS）→ 回函 BMad-Guide
- PLAN-049 `/cases` 上線（T0638）；BUG-155 FIXED（T0639，`149f6f8d`）
- PLAN-050：T0640 研究 → D167 → T0641（`--name`）/ T0642（`claudeSessionName` / `claudeSessionId`）/ T0644（以塔台開啟 Claude）/ T0643（`scope: towers`）
- `v0.7.1-pre.1` 發佈（D168；更版重點 + 三文件 `cafee90a`）；CT-T021 委派，BMad-Guide D069 受理（CT 建議 v5.9.0）
- unit 5384 passed / 311 files；typecheck 0 / 0

### 待辦（依優先序）

1. 🔴 **安裝 `v0.7.1-pre.1` 後的新塔台**：確認 FileVersion（L127）；以「以塔台開啟 Claude」開塔台
2. 🔴 **PLAN-050 / BUG-155 實機驗收**（第八十二 session 18:01：T0645 驗 Worker 名稱 / `claudeSessionId` / `/clear` / `agent` / `scope: towers` 全 PASS，BUG-155 CLOSED；**只剩「以塔台開啟 Claude」的 `· Tower` 名稱**，補驗後 PLAN-050 → DONE）：ListAgents 看到 `better-agent-terminal · Tower` 與 `… · Worker · T####`；Worker `bat_whoami` 有 `agent`（claude / codex）、`claudeSessionName`、`claudeSessionId`；`bat_list_terminals scope=towers`；`/clear` 後 sessionId 換新（T0642 只以模擬 hook 驗證）；通過後 PLAN-050 → DONE、BUG-155 → CLOSED
3. 🔴 **CT-T021 實機驗收**（第八十二 session：情境 2 / 3 / 4 PASS，回函 `_reply-2026-10-18-ct-v590-runtime.md`，對方 D071；**只剩情境 1**，與待辦 2 同一次補驗後通知 `BMad-Guide · Tower`／ListAgents 對方塔台）：CT **v5.9.0** 已發版並安裝（17:5x，BMad-Guide 回覆稿 `_reply-2026-10-18-ct-v590-session-identity.md`）→ 與待辦 2 一起代跑回覆稿 § 5 四個情境（BMad-Guide 塔台需先重開載入 v5.9.0）→ 回函 `BMad-Guide/_ct-workorders/_reply-<日期>-ct-v590-runtime.md` 並傳訊；可選建議「重複 Tower 名稱帶短 ID」見 PLAN-050 後續
4. 🟡 **PLAN-049 後續**：W2c `/remote/` → W3 截圖 / 短片 / README 換圖 → W4 OG / sitemap / lychee（README 版本對照每加一列，`/cases` 的「12 項」要同步）
5. 🟢 PLAN-051（跨塔台傳訊，IDEA）待評估；BUG-136 等 Gary 日誌；`RECOVERY_PENDING` 實機未驗；前期驗收（Gary BUG-127-135 / 116 / 118、BUG-130 / 105 / 107 / 108 / 097 / 111、T0550、dmg / AppImage、NSIS 重裝、T0360）

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）／更版重點必寫（L150 → `_local-rules.md`）／發佈後同步 repo 文件
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。**每次發版** run 完成後同一步 `gh release edit --notes-file` 寫更版重點，`gh release view --json body` 確認後，再更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 commit + push，才回報已發佈。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 1 / Fixing 0 / Fixed 19 / Closed 20）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D168）｜ Learnings → [_learnings.md](_learnings.md)（最大 L167）
- PLAN-050 契約總表 → [T0643](T0643-list-towers-scope.md) 回報區｜ 網站 → https://gowerlin.github.io/better-agent-terminal/
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（97 entries）

### 編號起始
- **T0645** / **BUG-156** / **PLAN-052** / **D169** / **EXP-[TOPIC]-001** / **L168** / **CT-T022**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.1-pre.1**（package.json + lock，2026-10-18 `1bc9ccca`；`0.7.1` 線，D168，最多到 pre.9） |
| **最新 release** | `v0.7.1-pre.1`（2026-10-18 17:36，run `39115475526`，target `1bc9ccca`：PLAN-050 T0641–T0644、BUG-155 T0639、`/cases`；更版重點含「歡迎協助測試」；repo 文件 `cafee90a`；exe 298 / zip 412 / AppImage 297 / dmg 309 MiB）+ `server-bundle-v0.7.1-pre.1`（7 assets）。更早見 `release-note.md` / `CHANGELOG.md` |
| **前一 tag** | `v0.7.0-pre.9`（2026-10-18 15:16，`c0f4dcae`） |
| **目前主軸** | `v0.7.1-pre.1` 已發佈（第八十一 session）；待使用者安裝 → PLAN-050 / BUG-155 實機驗收；CT-T021 等 CT v5.9.0；PLAN-049 後續 W2c / W3 / W4 |
| **工單最大編號** | **T0644** DONE（第八十一 session：T0637 codex 探針、T0638 `/cases`、T0639 BUG-155、T0640 研究、T0641–T0644 PLAN-050，全 DONE / FIXED）；更早見 `_archive/state-snapshots/` |
| **BUG 最大編號** | **BUG-155** CLOSED（T0639 `149f6f8d`；2026-10-18 18:01 T0645 實機 PASS 後使用者同意結案）；熱區 Open 1（BUG-136）/ Fixing 0 / Fixed 20 / Closed 19 |
| **PLAN 最大編號** | **PLAN-051**（IDEA：跨塔台傳訊）；PLAN-050 IN_PROGRESS（實作完、隨 `v0.7.1-pre.1`，待實機與 CT-T021）；PLAN-049 IN_PROGRESS（網站，W2c / W3 / W4 待做）；PLAN-047 IN_PROGRESS；PLAN-015 / 029 / 038 / 043 IDEA |
| **決策最大編號** | **D168**（D167 PLAN-050 方案、D168 版號線 `0.7.1-pre.1`，2026-10-18 第八十一 session）；D161–D166 PLAN-049 網站（第八十 session） |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v5.8.1**（第八十一 session 載入）；本機收工後已裝 **v5.9.0**（CT-T021，BMad-Guide T0174，兩端），下個塔台 session 載入 |
| **unit test 基線** | **5384 passed / 311 files / 3 skipped**（塔台複驗 @ `b34087d3`，發 `v0.7.1-pre.1` 前，2026-10-18 第八十一 session；typecheck 0 / 0、vite build 成功） |

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
| BAT 安裝版 | ⚠️ `0.7.0-pre.9`（2026-10-18 15:28 FileVersion）；`v0.7.1-pre.1` 已於 17:36 發佈、使用者收工後安裝（新塔台以 FileVersion / 雜湊確認，L127） | 分頁權杖 `batcap.`；Tower `--set-role tower --mode on` exit 0（標題 `Claude CLI · Tower`） |
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

- 2026-10-18 第八十一 session：auto-session on，per-dispatch `--mode yolo --no-interactive`（T0637 `--agent codex`）；T0637–T0644 全部 `started:`（codex 首次 `started: <時間>`）；T0642 / T0644 並行、T0644 結構化提問 1 次；`worker_auto_close` 回收 8 次；`v0.7.1-pre.1` 發佈
- 2026-10-18 第八十 session：auto-session on，per-dispatch `--mode yolo --no-interactive`（T0629 `--agent codex`）；T0624–T0636 全 DONE、claude 皆一次啟動（`started:`），codex T0629 `unknown`（pre.8 預期）；T0630 首派被使用者停掉後依 D162 重派；`worker_auto_close` 回收 12 次（T0627 / T0630 首派分頁使用者手動關）；`v0.7.0-pre.9` 發佈
- 2026-10-18 第七十九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0614–T0623 皆一次啟動（T0617 / T0618 探針設計 Renew 各 1 次、T0618 以 ct-done 補結）；最多 2 張並行；`worker_auto_close` 回收 12 次；無發版
- 2026-10-18 第七十八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0612（探針，使用者目視）/ T0613 皆一次完成；`worker_auto_close` 回收 2 次；`v0.7.0-pre.8` 發佈
- 2026-10-18 第七十七 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0601–T0611 皆一次啟動；`v0.7.0-pre.7` 發佈
- 2026-10-18 第七十六 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0596–T0600 皆一次完成（T0597 首派 `create-rate-limited` 重派 1 次），最多 2 張並行；`worker_auto_close` 回收 5 次；`v0.7.0-pre.5` / `pre.6` 發佈
- （更早的摘要已移入 `_archive/state-snapshots/`，見 INDEX）
