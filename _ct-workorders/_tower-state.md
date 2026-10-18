# Tower State — better-agent-terminal

> 最後更新:2026-10-18 09:47 (UTC+8) — 第七十八 session 進行中：T0612 探針 → BUG-153 CLOSED；BUG-154 / T0613 → `v0.7.0-pre.8` 已發佈｜前：**第七十七 session 收工**：BUG-149 / 150 / 151 / 152 CLOSED；PLAN-048 Worker 問塔台（T0606–T0611）與 BUG-153 縮圖（T0609）→ `v0.7.0-pre.7` 已發佈；CT-T019 轉交受理。
>
> **下次起手**:Fast Path 載入；若使用者已換 pre.7 → 實機看 BUG-153 縮圖（⚠️ / `?` / `✓`）；等 BMad-Guide CT v5.7.0 出版 → 補 README 版本對照表 CT 欄、收 PLAN-048 實機結果；PLAN-047 M1b-2 待排期。
---

## 🛏 本 Session 收工快照 (第七十七 session, 2026-10-18 04:11 - 09:33, 實際工作至 07:28 ~3h17m)

### 主軸：pre.5 / pre.6 驗收自動化（T0601 安裝版探針 + T0602 隔離 e2e）→ BUG-149 / 150 / 151 / 152 CLOSED；PLAN-048「Worker 問塔台」（T0606 契約 → T0607 / T0608 / T0610 合併 / T0611）＋ BUG-153 縮圖（T0609）→ **`v0.7.0-pre.7`**；CT-T019 轉交

#### 時間線（時間取自系統 / git / gh）

1. **04:11** Fast Path；使用者問 pre.5 / pre.6 驗收能否自動化 → [A] 派 **T0601**（安裝版探針）/ **T0602**（隔離實例 e2e 4 spec）→ 04:16 / 04:18 DONE → **BUG-150 / 151 CLOSED**；CT v5.6.0 `--wait-started` 實際派工皆 `started:`
2. **04:21** **T0603** 空白探針，使用者目視「沒跳，停在塔台」→ **BUG-152 CLOSED**
3. **04:26** BUG-149 實機：使用者選暫移 `settings.json` 的 `shell` 鍵 → **T0604**（claude）/ **T0605**（codex）PASS → **BUG-149 CLOSED**；`shell` 鍵已從備份還原（hash 一致）
4. **04:36** 使用者 [C] 排 PLAN-048 → **D155**（澄清：「不落地」只指 BAT 端，工單照常記錄問答）→ **T0606** 契約研究 04:45 DONE（C-1–C-11）→ **D156** 採推薦 → T0607（main store）/ T0608（helper + MCP，隔離）
5. **04:59** BMad-Guide 提 **BUG-153**（縮圖把提問 / blocked 標成 `✓`、計入批次關閉）→ 排在 T0607 後
6. **05:10** T0607 DONE `00bdcaeb` → 派 **T0609**；05:17 T0608 DONE（`ct/T0608`）；05:30 T0609 FIXED `fbf641dc` → main 有產品 commit，T0608 走模式 ② → **T0610** 合併工單 05:39 DONE（無衝突、e2e 改 8 個 tool）→ 斷點 E 使用者 [A] → main ff `4e5f5e7f`
7. **07:04** **T0611**（e2e + 文件收尾 + `--cancel-question` 遇 lost exit 0）→ 07:14 DONE `c271e852`
8. **07:16** **CT-T019** 轉交 BMad-Guide → 07:18 受理（CT v5.6.1 PATCH 規則修正 / v5.7.0 MINOR 接本單）
9. **07:20** 塔台複驗 5226 passed / 301 files、typecheck 0 / 0 → bump `ef31abf5` → run `39078626121` 10 job 全綠 → **07:26 `v0.7.0-pre.7` 已發佈** → 更版重點 + 三文件 `c135ca69` → 告知對方版號（`bc52bb4d`）；刪 `ct/T0608` / `ct-merge/T0608`、push

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **11**（T0601–T0611） | 皆一次啟動成功（`--wait-started` 皆 `started:`，codex `unknown` 屬預期）；T0608 隔離 + T0610 合併（模式 ②） |
| BUG | CLOSED 4（149 / 150 / 151 / 152）；新開 BUG-153 → FIXED | Open 1（BUG-136）/ Fixed 20 / Closed 17 |
| PLAN | PLAN-048 IDEA → IN_PROGRESS | A / B / C 全 DONE，實機待 CT v5.7.0 |
| 決策 | D155 / D156 | 問答通道契約 |
| 跨專案 | CT-T017 / CT-T018 runtime PASS → DONE；CT-T019 轉交受理 | 全程跨 session 訊息 |
| 發版 | 1（`v0.7.0-pre.7`） | exe 298 / zip 412 / AppImage 297 / dmg 309 MiB |
| unit test | 5118 → **5226 passed / 301 files** | 塔台複驗 @ `69fa2b90` |

### 重點觀察

- 驗收自動化分兩層：安裝版探針（真 BAT、真派工）＋ 隔離實例 e2e，只剩目視類（焦點）需要使用者
- 平行的非隔離工單（T0607 / T0609）又讓隔離單走模式 ②；等平行單完成再派合併工單，避免 Renew（L158 再現）
- 用全域字串替換改編號時，誤改到前一 session 快照（L163）；heredoc 遇反斜線寫出空檔（L129 再現）
- T0605 codex Worker 的 commit 訊息沒有 `(ct)` 結尾（`098622b8`），發版整理時手動略過

### 編號起始（下 session）

- **T0612** / **BUG-154** / **PLAN-049** / **D157** / **L164** / **CT-T020**

---

## 🛏 前 Session 收工快照 (第七十六 session, 2026-10-18 02:10 - 03:55, ~1h45m wall)

### 主軸：`v0.7.0-pre.4` 實機驗 `blocked` → BUG-150（T0596 研究 → T0597）；BMad-Guide 回報派工失敗 → BUG-151（T0598，根因更正為「派工前的鍵盤輸入」）→ **`v0.7.0-pre.5`**；D154 → BUG-152（T0599）/ T0600 啟動確認 → **`v0.7.0-pre.6`**；CT-T017 / CT-T018 轉交

#### 時間線（時間取自系統 / git / gh）

1. **02:10** Fast Path；本機 BAT `0.7.0-pre.4`；`--set-role tower --mode on` exit 0。使用者問 Codex daemon 提示（BUG-085 設計，提權環境；決定不加 `--no-daemon`）
2. **02:19** CT-T017（`source` + `blocked`）→ 跨 session 轉交 `bmad-guide-94`（附 log-dir 回覆檔）→ 對方 D035 受理；後拆單 D036 / 定版 D037（§ 一 → CT v5.4.0 DONE、§ 二 → CT v5.5.0）
3. **02:21** 實機：AskUserQuestion → `blocked` / **`permission`**（預期 `question`）→ **T0596** 研究（02:26 → 02:31 DONE）：claude 對 AskUserQuestion 必觸發 `PermissionRequest`，T0594 清除永不生效 → **BUG-150**
4. **02:3x** BMad-Guide 回報 T0161 派工 `bash: ,: command not found`（helper exit 0）→ **BUG-151**；並提 CT-to-BAT 需求「Worker 問塔台」→ **PLAN-048**（IDEA）
5. **02:44** 並行 **T0598**（BUG-151）/ **T0597**（BUG-150；首派撞 `create-rate-limited` exit 1，確認未建分頁後 20 s 重派）→ 02:51 T0597 FIXED（`ddb9b970`）、03:02 T0598 FIXED（`45943d16`：引號沒錯，是新分頁搶焦點 + 500 ms 內輸入接在指令前）
6. **03:03** 塔台複驗 5089 passed → bump `ffeb8b21` → run `39061324454` → **03:18 `v0.7.0-pre.5` 已發佈** → 更版重點 + 三文件 `38dd75b8`
7. **03:13** D154（使用者選建議）：派工分頁不搶焦點 **BUG-152 / T0599**、啟動確認 **T0600** → 03:27 T0599 FIXED（`95cfa2b0`）、03:40 T0600 DONE（`75a867b1`：`SessionStart` hook、`agentStarted`、`--wait-started` / exit 8）
8. **03:41** 塔台複驗 5118 passed / 293 files → CT-T018 轉交（對方 D039 受理，CT v5.6.0 待 pre.6）→ bump `659c9a79` → run `39063636289` → **03:50 `v0.7.0-pre.6` 已發佈** → 三文件 `87ad460d`

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **5**（T0596–T0600） | 皆一次完成（T0597 首派 rate-limit 重派 1 次）；最多 2 張並行；`worker_auto_close` 回收 5 次 |
| BUG | 新開 3（BUG-150 / 151 / 152）→ 全 FIXED | 實機待 pre.6 |
| PLAN | PLAN-048 IDEA | CT-to-BAT 需求 |
| 決策 | D154 | 焦點 + 啟動確認 |
| 跨專案 | CT-T017（CT v5.4.0 / v5.5.0 / v5.5.1）、CT-T018（CT v5.6.0 待做） | 全程跨 session 訊息 |
| 發版 | 2（`v0.7.0-pre.5` / `pre.6`） | pre.6：exe 298 / zip 412 / AppImage 297 / dmg 309 MiB |
| unit test | 5071 → **5118 passed / 293 files** | 塔台複驗 @ `69a59bc8` |

### 重點觀察

- 測試以模擬事件順序驗證 hook，漏掉真實 CLI 多送的事件（T0594 → BUG-150，L161）
- 「派工失敗」的初步推測（引號 / shell）被日誌對照推翻；根因是使用者行為 × 焦點（L162）
- 快速連續兩次派工撞 helper 建立頻率限制（每塔台每秒一次）→ 連續派工間隔 ≥ 20 s

### 編號起始（下 session）

- **T0601** / **BUG-153** / **PLAN-049** / **D155** / **L163** / **CT-T019**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-18 09:33 UTC+8（第七十七 session 收工）

### 近期完成
- `v0.7.0-pre.7`（10-18 07:26，run `39078626121` @ `ef31abf5`）：PLAN-048 Worker 問塔台（T0607 `00bdcaeb` / T0608 經 T0610 合入 `4e5f5e7f` / T0611 `c271e852`）、BUG-153 縮圖 ⚠️ / `?` / `✓`（T0609 `fbf641dc`）；三文件 `c135ca69`；分支 `ct/T0608` / `ct-merge/T0608` 已刪
- CT-T019（Worker 問塔台）已受理：CT v5.6.1（規則修正，不依賴 pre.7）/ v5.7.0（接本單）；BAT 最低版本 `>= 0.7.0-pre.7` 已告知
- 第七十七 session 驗收：T0601 / T0602 → BUG-150 / 151 CLOSED；T0603 目視 → BUG-152 CLOSED；T0604 / T0605 暫移 `shell` 鍵 → BUG-149 CLOSED（`settings.json` 已還原）；CT-T017 / CT-T018 runtime PASS → DONE
- unit 5226 passed / 301 files；typecheck 0 / 0

### 待辦（依優先序）

1. 🟡 **PLAN-048**（IN_PROGRESS）：A / B / C DONE；pre.7 安裝版 helper 路徑 PASS（T0612）；CT v5.7.0 已出版（對方 T0169，README CT 欄已改 `>= v5.7.0`）→ 等對方實機驗收 → DONE
2. 🟡 **BUG-154**（FIXED，T0613 `7bfe225c`）→ **`v0.7.0-pre.8` 已發佈**（2026-10-18 10:20，run `39089400205` @ `b65f9544`；更版重點 + 三文件 `3c59528f`；版號已告知 BMad-Guide）→ 等 BMad-Guide 在 pre.8 上的 CT v5.7.0 實機驗收（claude + codex）結果 → BUG-154 CLOSED、PLAN-048 DONE
3. 🟡 **PLAN-047 後續**：M1b-2 codex 分頁 `blocked` / 啟動信號（未排期）、`ElicitationResult` 清 elicitation
4. 🟡 **用量限制**首次真實撞限制看 `[usage-limit]`；**BUG-136** 等 Gary 日誌；`RECOVERY_PENDING` 實機未驗
5. 🟢 前期驗收與小項：Gary BUG-127-135 / 116 / 118；BUG-130 / 105 / 107 / 108 / 097 / 111；T0550 真人 6 項；dmg / AppImage、NSIS 重裝；T0360

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）／更版重點必寫（L150 → `_local-rules.md`）／發佈後同步 repo 文件
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。**每次發版** run 完成後同一步 `gh release edit --notes-file` 寫更版重點，`gh release view --json body` 確認後，再更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 commit + push，才回報已發佈。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 1 / Fixing 0 / Fixed 20 / Closed 18）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D156）｜ Learnings → [_learnings.md](_learnings.md)（最大 L163）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（93 entries）

### 編號起始
- **T0614** / **BUG-155** / **PLAN-049** / **D157** / **EXP-[TOPIC]-001** / **L164** / **CT-T020**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.0-pre.8**（package.json + lock，2026-10-18 `b65f9544`） |
| **最新 release** | `v0.7.0-pre.8`（2026-10-18 10:20，run `39089400205`，target `b65f9544`：BUG-154 T0613；更版重點含「歡迎協助測試」；repo 文件已同步 `3c59528f`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.7.0-pre.8`（7 assets）。前一版 `v0.7.0-pre.7`（2026-10-18 07:26，run `39078626121`，target `ef31abf5`：PLAN-048 Worker 問塔台（T0606–T0611）、BUG-153 縮圖 ⚠️ / `?` / `✓`（T0609）；更版重點含「歡迎協助測試」；repo 文件已同步；exe 298 / zip 412 / AppImage 297 / dmg 309 MiB）+ `server-bundle-v0.7.0-pre.7`（7 assets）。前一版 `v0.7.0-pre.6`（2026-10-18 03:50，run `39063636289`，target `659c9a79`：T0600 Worker 啟動確認、BUG-152 不搶焦點；更版重點含「歡迎協助測試」；repo 文件已同步 `87ad460d`；exe 298 / zip 412 / AppImage 297 / dmg 309 MiB）+ `server-bundle-v0.7.0-pre.6`（7 assets）。前一版 `v0.7.0-pre.5`（2026-10-18 03:18，run `39061324454`，target `ffeb8b21`：BUG-150 / BUG-151；repo 文件已同步 `38dd75b8`）+ `server-bundle-v0.7.0-pre.5`。前一版 `v0.7.0-pre.4`（2026-10-18 02:02，run `39055793254`，target `6a059147`：T0589 Q3 關閉後查 worktree 狀態、T0590 / T0594 blocked（claude hooks）、BUG-149 / T0593、T0592 codex e2e；更版重點含「歡迎協助測試」；repo 文件已同步 `18bd2e03`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.7.0-pre.4`（7 assets）。前一版 `v0.7.0-pre.3`（2026-10-18 00:20，run `39048372727`，target `738abbd0`：BUG-148 codex 分頁 BAT MCP；更版重點已寫；repo 文件已同步 `15546d32`；exe 298 / zip 412 / AppImage 297 / dmg 309 MiB）+ `server-bundle-v0.7.0-pre.3`（7 assets）。前一版 `v0.7.0-pre.2`（2026-10-17 23:03，run `39042821892`，target `9cc4bcf3`：PLAN-047 M1 / W1（T0582–T0585）BAT MCP、worktree 隔離派工與狀態；更版重點已寫；repo 文件已同步 `1343be13`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.7.0-pre.2`（7 assets）。前一版 `v0.7.0-pre.1`（2026-10-17 20:54，run `39033898223`，target `7771b546`：PLAN-047 A1 / A2 本機範圍權杖、T0577、T0579、BUG-146 / 147；更版重點已寫；repo 文件已同步 `95107b90`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.7.0-pre.1`（7 assets）。前一版 `v0.6.1-pre.9`（2026-10-17 10:45，run `38995709965`，target `14246954`：BUG-144 重修 T0573；更版重點已寫；repo 文件已同步 `65c841bf`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.6.1-pre.9`（7 assets）。前一版 `v0.6.1-pre.8`（2026-10-16 22:36，run `38916104029`，target `0769bafc`：BUG-144 Shift + 右鍵複製、BUG-145 PTY 初始尺寸；更版重點已寫；repo 文件已同步 `370c7781`；exe 298 / zip 412 / AppImage 297 / dmg 309 MiB）+ `server-bundle-v0.6.1-pre.8`（7 assets）。前一版 `v0.6.1-pre.7`（2026-10-16 18:04，run `38884005468`，target `c41a0ec7`：BUG-142 / 143 右鍵選單）。更早見 `release-note.md` / `CHANGELOG.md` 與 `_archive/state-snapshots/2026-Q4.md` |
| **前一 tag** | `v0.7.0-pre.7`（2026-10-18 07:26，`ef31abf5`） |
| **目前主軸** | `v0.7.0-pre.7` 已發佈（PLAN-048 Worker 問塔台、BUG-153 縮圖）；實機待 BUG-153 目視與 CT v5.7.0（CT-T019）；PLAN-047 M1b-2 待排期 |
| **工單最大編號** | T0613 FIXED（第七十八 session：BUG-154，`7bfe225c`）；T0612 DONE（第七十八 session：BUG-153 安裝版縮圖探針，`8cb51da4`）；T0611 DONE（第七十七 session：T0601–T0605 驗收探針 / e2e、T0606 契約研究、T0607 / T0608 / T0611 PLAN-048、T0609 BUG-153、T0610 合併工單模式 ②）；T0600 DONE（第七十六 session：T0596 研究、T0597 BUG-150、T0598 BUG-151、T0599 BUG-152、T0600 啟動確認）；T0588 DONE（第七十四 session：T0586 BUG-148 FIXED、T0587 隔離派工探針、T0588 合併工單模式 ②）；T0585 DONE（第七十三 session：T0581 實機探針、T0582–T0585 PLAN-047 M1 / W1，實作皆 source / test 層，實機隨 0.7.0-pre.2）；T0580 DONE（第七十二 session：T0574 研究、T0575–T0580 實作，皆 source / test 層，實機隨 0.7.0-pre.1）；T0573 DONE（pre.9 實機，第七十一 session）；T0572 DONE（pre.8 實機）；T0571 DONE `35eaf125`、T0572 FIXED `ecc00c60`（第六十九 session，皆待 pre.8 實機）；T0568–T0570 DONE（第六十八 session） |
| **BUG 最大編號** | **BUG-154**（OPEN，第七十八 session T0612 安裝版探針發現：結構化提問答覆後縮圖殘留 `✓`）；BUG-153 CLOSED（2026-10-18 09:47，pre.7 T0612 目視）；BUG-153（FIXED by T0609 `fbf641dc`；BUG-149 / 150 / 151 / 152 第七十七 session CLOSED；tracker Open 1 / Fixing 0 / Fixed 20 / Closed 17）；BUG-152（BUG-150 / 151 / 152 皆 FIXED，第七十六 session）；**BUG-148**（FIXED by T0586 `8c7bd4c4` → 2026-10-18 00:28 `0.7.0-pre.3` 實機 PASS，**CLOSED**；tracker Open 1 / Fixed 19 / Closed 13）；BUG-147（BUG-146 / 147 FIXED by T0578 / T0580，2026-10-17）；BUG-145（CLOSED 2026-10-17）；BUG-144 CLOSED（pre.9 實機，2026-10-17）；熱區 Open 1（BUG-136）/ Fixing 0 / Fixed 17 / Closed 12（10-17 歸檔 40 張） |
| **PLAN 最大編號** | **PLAN-048**（IN_PROGRESS：Worker 問塔台，D155 / D156；A / B / C DONE、隨 pre.7 發佈，實機待 CT v5.7.0）；**PLAN-047**（IN_PROGRESS，D149；外部提案「BAT MCP Server 與 Worktree 合併」審議，2026-10-17 第七十二 session）；PLAN-044 / 045 / 046 DONE（2026-10-16）；PLAN-015 / 029 / 038 / 043 IDEA；PLAN-014 DROPPED |
| **決策最大編號** | D156（D155 PLAN-048 排期與 BAT 端不落地、D156 契約採推薦，2026-10-18）；D154（派工分頁不搶焦點、Worker 啟動確認，2026-10-18）；D152（PLAN-047 第二批：M1 / W1 並行、worktree 依賴由 Worker 安裝、BAT MCP 預設開，2026-10-17）；D151（D151 下一版 `v0.7.0-pre.1`、不發兩位數 pre；D149 PLAN-047 路線 [A]；D150 合併工單三種模式，2026-10-17）；前 D148（PLAN-044 範圍：claude 信任 CLI、Codex 自動輸入、塔台 `--mode`，2026-10-16） |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v5.6.0**（第七十七 session 使用，派工帶 `--wait-started 30000`）；前 v5.3.1（第七十五 session 載入；v5.3.0 自第七十四 session 起使用；runtime PASS：BMad-Guide T0158 + 本專案 T0587 / T0588；`worker_auto_close: done`） |
| **unit test 基線** | **5226 passed / 301 files**（塔台複驗 @ `69fa2b90`，2026-10-18 第七十七 session）；前：5118 passed / 293 files / 3 skipped（@ `69a59bc8`，第七十六 session）；前：**5071 passed / 291 files / 3 skipped**（塔台複驗 @ `9b908204`，2026-10-18 第七十五 session）；前：4997 passed / 285 files（@ `baf9e5ab`，第七十四 session）；前：4992 passed / 284 files（@ `46b904f1`，第七十三 session）；前：4771 passed / 270 files / 3 skipped（@ `079b5e35`，第七十二 session）；前：4645 passed / 266 files / 3 skipped（塔台複驗 @ archive 後，2026-10-17 第七十一 session）；前：4633（@ `5e47ed60`）；4614 passed / 265 files（@ `2497014a`，第六十八 session）；typecheck 0 / typecheck:electron 0 |

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
| BAT 安裝版 | ⚠️ `0.7.0-pre.4`（最新 release 為 `0.7.0-pre.6`，使用者收工時換版） | 2026-10-18 02:10 FileVersion 確認（第七十六 session）；分頁權杖 `batcap.`；Tower `--set-role tower --mode on` exit 0（標題為使用者命名 `Claude CLI : Tower`，kept） |
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

- 2026-10-18 第七十六 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0596–T0600 皆一次完成（T0597 首派 `create-rate-limited` 重派 1 次），最多 2 張並行；`worker_auto_close` 回收 5 次；`v0.7.0-pre.5` / `pre.6` 發佈
- 2026-10-18 第七十五 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0589–T0595 皆一次完成（T0590 隔離 + T0591 合併工單，最多 2 張並行）；`worker_auto_close` 回收 6 次；`v0.7.0-pre.4` 發佈
- 2026-10-18 第七十四 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0586–T0588 皆一次完成（T0587 首次 `--isolation worktree`、T0588 首次合併工單）；`worker_auto_close` 回收 3 次；`v0.7.0-pre.3` 發佈
- 2026-10-17 第七十三 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0581–T0585 皆一次完成（最多 2 張並行）；`worker_auto_close` 回收 5 次；`v0.7.0-pre.2` 發佈
- 2026-10-17 第七十二 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0574–T0580 皆一次完成（最多 2 張並行）；`worker_auto_close` 回收 7 次；`v0.7.0-pre.1` 發佈
- 2026-10-17 第七十一 session：auto-session on，無派發（實機驗收 + `*sync` + `*archive`）
- 2026-10-17 第七十 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0573 一次完成；`worker_auto_close` 回收 1 次；pre.9 發佈
- 2026-10-16 第六十九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0571 / T0572 皆一次完成；`worker_auto_close` 回收 2 次；pre.8 發佈
- 2026-10-16 第六十八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0568–T0570 皆一次完成；pre.7 發佈
- 2026-10-16 第六十七 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0557-T0567 全 DONE，皆一次啟動（最多 2 張並行，依目錄切分）；`worker_auto_close` 回收 10 次；pre.6 發佈
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
