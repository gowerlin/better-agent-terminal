# Tower State — better-agent-terminal

> 最後更新:2026-10-18 02:07 (UTC+8) — **第七十五 session 收工**：BUG-148 CLOSED；PLAN-047 Q3（T0589）/ M1b-1 blocked（T0590 / T0594）；D153 codex e2e（T0592）→ BUG-149 FIXED（T0593）；CLAUDE.md 壓縮（T0595）；`v0.7.0-pre.4` 已發佈。
>
> **下次起手**:Fast Path 載入；使用者已換 `v0.7.0-pre.4` → 實機驗 `blocked`（Claude CLI 分頁 AskUserQuestion）；開 CT-T017（`source` / `blocked` 給 CT）。
---

## 🛏 本 Session 收工快照 (第七十五 session, 2026-10-18 00:27 - 02:07, ~1h40m wall)

### 主軸：`v0.7.0-pre.3` 實機驗收（BUG-148 CLOSED）→ PLAN-047 Q3 / M1b-1 並行（T0589 / T0590 隔離 + T0591 合併）→ D153 codex e2e（T0592）發現 BUG-149 → T0593 / T0594 → **`v0.7.0-pre.4`**；CLAUDE.md 壓縮（T0595）

#### 時間線（時間取自系統 / git / gh）

1. **00:27** Fast Path；本機 BAT `0.7.0-pre.3`、CT v5.3.1（後 v5.3.2）；`--set-role tower --mode on` exit 0；CT 塔台轉告 runtime PASS 回函（上 session 已處理）+ 候選 1（`bat-scripts.log` 位置）→ 記入 CT-T015
2. **00:28** Codex CLI 分頁 `bat_whoami` PASS → **BUG-148 CLOSED**
3. **00:33** 並行派 **T0589**（Q3，主 checkout）/ **T0590**（M1b-1 claude hooks，`--isolation worktree`）→ T0589 00:48 DONE（塔台複驗 5015 passed）
4. **00:45** bmad-guide-74 跨 session 回函：CT v5.3.1 / v5.3.2、文件建議 `BAT_HELPER_LOG_DIR` 須絕對路徑（查證屬實，使用者同意合併後補）
5. **00:50** **D153**：codex 整合測試 A 層自動化 e2e、B 層寫進更版重點請 codex 使用者協助（`_local-rules.md`）
6. **01:00** T0590 DONE → `--worktree-status`：判準 1（T0589 產品 commit）/ 3（範圍外 12 檔，塔台接受）不成立、`conflicts []` → **T0591** 合併工單（模式 ②）01:05 DONE（5051 passed、e2e 3）→ 第 5 步補合 → 使用者 [A] → `main` ff `960a7f14`；worktree remove；兩分支刪除；CLAUDE.md 補一句（`476be77d`）
7. **01:09** 派 **T0592**（codex A 層 e2e：假 codex shim + 內嵌 codex `app-server`，不呼叫模型）→ 01:40 DONE，發現 **BUG-149**（high）；codex 預設不濾 `BAT_REMOTE_TOKEN`
8. **01:42** 使用者 [A]：並行 **T0593**（BUG-149，範圍實為 claude + codex 派工）/ **T0594**（blocked 清除：`PostToolUse` AskUserQuestion；`PermissionDenied` 查證後不接）→ 01:49 / 01:52 DONE
9. **01:4x** 使用者：CLAUDE.md 超過 150k → **T0595**（細節原文搬 `docs/agent-guide/`，161.7k → 32.8k，0 行遺失）→ 02:01 DONE
10. **01:54** 塔台總驗收 5071 passed / 291 files → bump `6a059147` → push → run `39055793254` → **02:02 `v0.7.0-pre.4` 已發佈**（10 job 全綠）→ 更版重點（含「歡迎協助測試」）+ 三文件（`18bd2e03`）
11. 實機：BMad-Guide 的 Codex 塔台 `$control-tower` 分頁標題 `Codex CLI · Tower` PASS；給 BMad-Guide 的回覆因對方 session 已結束改寫回覆檔 `_reply-2026-10-18-bmad-guide-log-dir-handled.md`（待使用者轉交）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **7**（T0589–T0595） | 皆一次完成；最多 2 張並行；T0590 隔離 + T0591 合併工單；`worker_auto_close` 回收 6 次（T0591 分頁已不在） |
| BUG | BUG-148 CLOSED；BUG-149 新開 → FIXED | BUG-149 由 D153 A 層 e2e 抓到 |
| 決策 | D153 | codex 整合測試兩層 |
| 發版 | 1（`v0.7.0-pre.4`） | exe 298 / zip 412 / AppImage 297 / dmg 310 MiB |
| unit test | 4997 → **5071 passed / 291 files** | 塔台複驗 @ `9b908204` |
| 文件 | CLAUDE.md 161.7k → 32.8k 字元 | `docs/agent-guide/` 23 主題檔 + 索引 |

### 重點觀察

- 真 binary 的 e2e（不呼叫模型）一次就抓到「全新安裝缺 `shell` 鍵」這類單元測試看不到的組合缺陷（L159）
- 塔台寫的 `affects_files` 太粗（「A 與 B」這種寫法被解析成只有 A），讓 `outOfScopeFiles` 出現 12 筆雜訊（L160）
- 平行的非隔離工單 commit 進 main 再次讓隔離單無法走模式 ①（L158 重現），模式 ② 合併工單 4 分鐘完成

### 編號起始（下 session）

- **T0596** / **BUG-150** / **PLAN-048** / **D154** / **L161** / **CT-T017**

---

## 🛏 前 Session 收工快照 (第七十四 session, 2026-10-17 23:38 - 2026-10-18 00:22, ~44m wall)

### 主軸：`v0.7.0-pre.2` 實機驗收 → BUG-148（codex MCP）修正、隔離派工 + 合併工單首次實跑 → **`v0.7.0-pre.3`**；CT-T015 / CT-T016 runtime 結案

#### 時間線（時間取自系統 / git / gh）

1. **23:38** Fast Path；本機 BAT `0.7.0-pre.2`（FileVersion）、CT v5.3.0；`--set-role tower --mode on` exit 0；本塔台分頁 `bat_whoami` / `bat_list_terminals` PASS（claude MCP）
2. **23:4x** 使用者以「+」選單開 Codex CLI 分頁 → `bat_whoami` `CONNECT_FAILED`（`BAT_REMOTE_*` not set）→ **23:50** BUG-148 + T0586 → 23:51 派工
3. **23:53** 派 **T0587**（`isolation: worktree`，README 一列）→ 隔離判定、`bat_worktree_status` PASS → 23:55 DONE；塔台模式 ① 已做 merge（`2ac6e97b`）待 ff
4. **00:00** T0586 FIXED（`8c7bd4c4`：codex `env_vars` 轉送 9 個名稱）；塔台複驗 4997 passed / 285 files、typecheck 0 / 0；BUG-148 FIXED。T0586 進 main 使模式 ① 失效 → 使用者選派合併工單
5. **00:04** 派 **T0588**（模式 ②，整合 worktree `.ct-integration`）→ 00:07 DONE（`41fcb911`，npm ci + 完整驗收）；SHA 比對五步、第 5 步補合 main → `64924c54` → 使用者確認 → ff；T0587 worktree remove；三條分支依使用者同意刪除
6. **00:05** BMad-Guide 回覆（使用者轉交）：CT-T015 / CT-T016 **runtime PASS**（對方 T0158）→ 兩張 DONE；觀察 ① 併入 PLAN-047 Q3
7. **00:12** bump `738abbd0` → push → run `39048372727` → **00:20 `v0.7.0-pre.3` 已發佈**（10 job 全綠）→ 更版重點 + 三文件（`15546d32`）
8. 塔台分頁標題 `Claude CLI : Tower` = 使用者早期手動命名，`--set-role` 依設計 `kept`（非 bug）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **3**（T0586–T0588） | 皆一次完成；T0587 首次隔離派工、T0588 首次合併工單（模式 ②）；`worker_auto_close` 回收 3 次（T0587 `--worktree keep`） |
| 跨專案 | CT-T015 / CT-T016 runtime lane PASS → 結案 | CT v5.3.0 全 lane 完成 |
| BUG | 新開 1（BUG-148）→ FIXED | 實機待 pre.3 |
| 發版 | 1（`v0.7.0-pre.3`） | exe 298 / zip 412 / AppImage 297 / dmg 309 MiB |
| unit test | 4992 → **4997 passed / 285 files** | 塔台複驗 @ `baf9e5ab`；T0588 在 merge commit 複驗相同 |

### 重點觀察

- 只驗設定解析不等於能連線：codex 對 stdio MCP 只傳預設白名單 env（T0584 漏驗）→ 外部 CLI 整合要有「實際啟動子程序」的驗證
- 並行的非隔離工單 commit 進 main 會讓已準備好的模式 ① 失效（L158）
- 塔台把短 SHA 自行補成 40 字元寫進工單，Worker 發現並改用實際值（L157）

### 編號起始（下 session）

- **T0589** / **BUG-149** / **PLAN-048** / **D153** / **L159** / **CT-T017**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-18 02:07 UTC+8（第七十五 session 收工）

### 近期完成
- `v0.7.0-pre.4`（10-18 02:02，run `39055793254` @ `6a059147`）：T0589 關閉後查 worktree 狀態（`source`）、T0590 / T0594 `blocked`（claude hooks）、BUG-149 / T0593、T0592 codex e2e；更版重點含「歡迎協助測試」；三文件 `18bd2e03`
- BUG-148 CLOSED（pre.3 Codex 分頁 `bat_whoami` PASS）；BMad-Guide Codex 塔台分頁標題 `Codex CLI · Tower` PASS
- CLAUDE.md 161.7k → 32.8k（T0595，細節在 `docs/agent-guide/`）；D153（codex 測試兩層）
- unit 5071 passed / 291 files；整合 worktree `.ct-integration` detached 於 `960a7f14`（已裝依賴，保留）

### 待辦（依優先序）

1. 🔴 **`v0.7.0-pre.4` 實機驗收**：Claude CLI 分頁讓 agent 用 AskUserQuestion 問一題 → 塔台 `bat_get_state <id>` 為 `blocked` / `question` → 回答（鍵盤或滑鼠）後清除；BUG-149 只在全新設定重現（可不驗）
2. 🟡 **CT-T017**：轉交 CT — `--worktree-status` 關閉後可查（`source`，`merge-workorder.md` 可簡化）與 `blocked`（斷點 D）；BMad-Guide 回覆檔 `_reply-2026-10-18-bmad-guide-log-dir-handled.md` 待使用者轉交
3. 🟡 **PLAN-047 後續**：M1b-2 codex（OSC 9 + 句型）；blocked 補 `ElicitationResult` 清 elicitation；M2 / M3 視使用情況；pre.4「歡迎協助測試」的 codex 回報
4. 🟡 **用量限制**：首次真實撞限制時看 `[usage-limit]`；**BUG-136**：等 Gary 回傳日誌；`RECOVERY_PENDING`（> 2 s 未答）實機未驗
5. 🟢 前期驗收與小項：Gary BUG-127-135 / 116 / 118；BUG-130 / 105 / 107 / 108 / 097 / 111；T0550 真人 6 項；dmg / AppImage、NSIS 重裝；headless PTY `PATH` 加內嵌 claude；T0360

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）／更版重點必寫（L150 → `_local-rules.md`）／發佈後同步 repo 文件
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。**每次發版** run 完成後同一步 `gh release edit --notes-file` 寫更版重點，`gh release view --json body` 確認後，再更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 commit + push，才回報已發佈。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 1 / Fixing 0 / Fixed 20 / Closed 13）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D153）｜ Learnings → [_learnings.md](_learnings.md)（最大 L160）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（91 entries）

### 編號起始
- **T0596** / **BUG-150** / **PLAN-048** / **D154** / **EXP-[TOPIC]-001** / **L161** / **CT-T017**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.0-pre.4**（package.json + lock，2026-10-18 `6a059147`） |
| **最新 release** | `v0.7.0-pre.4`（2026-10-18 02:02，run `39055793254`，target `6a059147`：T0589 Q3 關閉後查 worktree 狀態、T0590 / T0594 blocked（claude hooks）、BUG-149 / T0593、T0592 codex e2e；更版重點含「歡迎協助測試」；repo 文件已同步 `18bd2e03`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.7.0-pre.4`（7 assets）。前一版 `v0.7.0-pre.3`（2026-10-18 00:20，run `39048372727`，target `738abbd0`：BUG-148 codex 分頁 BAT MCP；更版重點已寫；repo 文件已同步 `15546d32`；exe 298 / zip 412 / AppImage 297 / dmg 309 MiB）+ `server-bundle-v0.7.0-pre.3`（7 assets）。前一版 `v0.7.0-pre.2`（2026-10-17 23:03，run `39042821892`，target `9cc4bcf3`：PLAN-047 M1 / W1（T0582–T0585）BAT MCP、worktree 隔離派工與狀態；更版重點已寫；repo 文件已同步 `1343be13`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.7.0-pre.2`（7 assets）。前一版 `v0.7.0-pre.1`（2026-10-17 20:54，run `39033898223`，target `7771b546`：PLAN-047 A1 / A2 本機範圍權杖、T0577、T0579、BUG-146 / 147；更版重點已寫；repo 文件已同步 `95107b90`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.7.0-pre.1`（7 assets）。前一版 `v0.6.1-pre.9`（2026-10-17 10:45，run `38995709965`，target `14246954`：BUG-144 重修 T0573；更版重點已寫；repo 文件已同步 `65c841bf`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.6.1-pre.9`（7 assets）。前一版 `v0.6.1-pre.8`（2026-10-16 22:36，run `38916104029`，target `0769bafc`：BUG-144 Shift + 右鍵複製、BUG-145 PTY 初始尺寸；更版重點已寫；repo 文件已同步 `370c7781`；exe 298 / zip 412 / AppImage 297 / dmg 309 MiB）+ `server-bundle-v0.6.1-pre.8`（7 assets）。前一版 `v0.6.1-pre.7`（2026-10-16 18:04，run `38884005468`，target `c41a0ec7`：BUG-142 / 143 右鍵選單）。更早見 `release-note.md` / `CHANGELOG.md` 與 `_archive/state-snapshots/2026-Q4.md` |
| **前一 tag** | `v0.7.0-pre.3`（2026-10-18 00:20，`738abbd0`） |
| **目前主軸** | `v0.7.0-pre.3` 已發佈、待實機驗 codex MCP（BUG-148）；pre.2 其餘項目與 CT v5.3.0 已驗收；之後決定 M1b / Q3 |
| **工單最大編號** | T0588 DONE（第七十四 session：T0586 BUG-148 FIXED、T0587 隔離派工探針、T0588 合併工單模式 ②）；T0585 DONE（第七十三 session：T0581 實機探針、T0582–T0585 PLAN-047 M1 / W1，實作皆 source / test 層，實機隨 0.7.0-pre.2）；T0580 DONE（第七十二 session：T0574 研究、T0575–T0580 實作，皆 source / test 層，實機隨 0.7.0-pre.1）；T0573 DONE（pre.9 實機，第七十一 session）；T0572 DONE（pre.8 實機）；T0571 DONE `35eaf125`、T0572 FIXED `ecc00c60`（第六十九 session，皆待 pre.8 實機）；T0568–T0570 DONE（第六十八 session） |
| **BUG 最大編號** | **BUG-148**（FIXED by T0586 `8c7bd4c4` → 2026-10-18 00:28 `0.7.0-pre.3` 實機 PASS，**CLOSED**；tracker Open 1 / Fixed 19 / Closed 13）；BUG-147（BUG-146 / 147 FIXED by T0578 / T0580，2026-10-17）；BUG-145（CLOSED 2026-10-17）；BUG-144 CLOSED（pre.9 實機，2026-10-17）；熱區 Open 1（BUG-136）/ Fixing 0 / Fixed 17 / Closed 12（10-17 歸檔 40 張） |
| **PLAN 最大編號** | **PLAN-047**（IN_PROGRESS，D149；外部提案「BAT MCP Server 與 Worktree 合併」審議，2026-10-17 第七十二 session）；PLAN-044 / 045 / 046 DONE（2026-10-16）；PLAN-015 / 029 / 038 / 043 IDEA；PLAN-014 DROPPED |
| **決策最大編號** | D152（PLAN-047 第二批：M1 / W1 並行、worktree 依賴由 Worker 安裝、BAT MCP 預設開，2026-10-17）；D151（D151 下一版 `v0.7.0-pre.1`、不發兩位數 pre；D149 PLAN-047 路線 [A]；D150 合併工單三種模式，2026-10-17）；前 D148（PLAN-044 範圍：claude 信任 CLI、Codex 自動輸入、塔台 `--mode`，2026-10-16） |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v5.3.1**（第七十五 session 載入；v5.3.0 自第七十四 session 起使用；runtime PASS：BMad-Guide T0158 + 本專案 T0587 / T0588；`worker_auto_close: done`） |
| **unit test 基線** | **5071 passed / 291 files / 3 skipped**（塔台複驗 @ `9b908204`，2026-10-18 第七十五 session）；前：4997 passed / 285 files（@ `baf9e5ab`，第七十四 session）；前：4992 passed / 284 files（@ `46b904f1`，第七十三 session）；前：4771 passed / 270 files / 3 skipped（@ `079b5e35`，第七十二 session）；前：4645 passed / 266 files / 3 skipped（塔台複驗 @ archive 後，2026-10-17 第七十一 session）；前：4633（@ `5e47ed60`）；4614 passed / 265 files（@ `2497014a`，第六十八 session）；typecheck 0 / typecheck:electron 0 |

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
| BAT 安裝版 | ⚠️ `0.7.0-pre.3`（最新 release 為 `0.7.0-pre.4`，使用者收工時換版） | 2026-10-18 00:27 FileVersion 確認（第七十五 session）；分頁權杖 `batcap.`；Tower `--set-role tower --mode on` exit 0（標題為使用者命名 `Claude CLI : Tower`，kept） |
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
