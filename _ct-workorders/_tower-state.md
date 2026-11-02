---
schema_kind: tower-state
summary_version: 1
updated_at: "2026-11-03T00:40:10+08:00"
session: "2026-11-03 00:40 第一百零八 session 收工（CT v6.0.0-beta.10）"
next_ids:
  workorder: "T0797"
  decision: "D242"
  bug: "BUG-202"
  plan: "PLAN-062"
todo:
  - "換版到 `0.7.4-pre.1` 後若跑 NSIS 重裝驗收：讀 `%TEMP%\\bat-nsis-acceptance-<時間>\\report.md`、刪 `userdata-backup`"
  - "BUG-159（FIXED）驗收：需非系統管理員環境 ＋ codex"
  - "待驗收：Linux AppImage（Ubuntu 22.04，Electron 45）"
  - "PLAN-059：A 完成（BUG-196 CLOSED）；B = PLAN-061（IDEA low，D229）；C 待問 CT（Q5）；Q4 未解"
  - "PLAN-060（IDEA）：macOS Developer ID 簽章（目前 macOS 不顯示系統通知）"
  - "觀察：t0757 偶發失敗再發生才開 BUG（D218）"
  - "版號線：`0.7.4-pre.N`，已發 pre.1（D236 / D241）"
---
# Tower State — better-agent-terminal

> 最後更新:2026-11-03 00:40 (UTC+8) — **第一百零八 session 收工**：pre.9 NSIS 驗收；BUG-196 / 197 / 198 驗收結案（T0796 實機、T0792 安裝版 e2e）；BUG-199 / 200 / 201 測試修正（T0793 / T0794 / T0795）→ **`v0.7.4-pre.1`** 發佈並 CLOSED；移除 lean-ctx 殘留（CT ADVISORY）。前次：第一百零七 session 收工（2026-11-02 22:33）。
>
> **下次起手**:熱區無進行中工單、無 OPEN BUG。① 使用者換版到 `0.7.4-pre.1` 時可跑 NSIS 重裝驗收（`e2e\manual\nsis-reinstall-acceptance.ps1 -Version 0.7.4-pre.1`），讀報告並刪 `userdata-backup`；② BUG-159 需非系統管理員環境＋codex；③ Linux AppImage 待回報；④ PLAN-059 C 待問 CT（Q5）。

---

## 🛏 本 Session 收工快照 (第一百零八 session, 2026-11-02 22:38 - 2026-11-03 00:40, ~2h)

### 主軸：pre.9 NSIS 驗收 → BUG-196 / 197 / 198 驗收結案（T0792 / T0796）→ BUG-199 / 200 / 201 修正（T0793 / T0794 / T0795）→ `v0.7.4-pre.1`

#### 時間線（時間取自系統 / git / gh）

> 🟢 **第一百零八 session 開工**（2026-11-02 22:38 (UTC+8)，CT v6.0.0-beta.10，Fast Path；塔台 session `f34696de-6639-472a-96fd-e52716378f13`；`--set-role tower --mode on` exit 0；安裝版 helper `v0.7.3-pre.9`（已換版）；HEAD `13f0f372`、`main` = `origin/main`（0 / 0）、工作區乾淨；熱區 187 張工單皆 DONE；BUG 熱區 Open 1（BUG-199）/ Fixed 4 / Closed 58，與 `_bug-tracker.md` 一致，免重建；`bat_list_questions` pending 0）。**`v0.7.3-pre.9` NSIS 完整重裝驗收 PASS-WITH-WARN**（`e2e\manual\nsis-reinstall-acceptance.ps1` real 模式，22:36:37–22:37:20；AllUsers / HKLM；唯一 WARN = ⓪ 目前安裝版是 pre.8，② 實為升級而非同版覆蓋，屬預期；① SHA-256 `7adb1790…` ② 覆蓋 ③ 靜默解除 ④ 乾淨重裝全 PASS，三支 helper `--version` = v0.7.3-pre.9、內嵌 claude / codex 存在、userData 130 檔 SHA-256 未變；⑤ LaunchCheck 未帶 → SKIPPED）。報告 `%TEMP%\bat-nsis-acceptance-20261102-223637\report.md`；含權杖的 `userdata-backup`（130 檔）已刪除。使用者「直接推進，另外需要通知 CT 塔台改版配合嗎」→ **D234**（CT 不需配合：pre.9 無介面變更）→ 開 **T0792**（安裝版 pre.9 驗收 BUG-197 / 198）、**T0793**（BUG-199 → FIXING）（`07f14a7f`）。22:42 並行派 **T0792**（Worker `ead67dbb…`，`started: 14:42:33Z`）、**T0793**（Worker `cc8f6356…`，`started: 14:42:36Z`），皆 yolo `--no-interactive`、exit 0。**T0793 DONE**（`f03adbd6` / `1b46a400`，22:59；量測：整檔 58 次真 shell spawn，整套負載下均勻變慢 2–4 倍、無單一慢步驟、無可省工作 → 真 shell `describe` 設 30 s；修改前整套 3 / 3 綠（未重現原事故）、修改後 3 / 3 綠、兩個 `test:unit` 同時跑本檔最慢 5.2 / 5.4 s 通過、CPU 負載綠；typecheck 0；parser 12 / 12；範圍外：兩個 `test:unit` 同時跑時 T0790 / T0791 真 hook 程序順序斷言失敗＋5 檔逾時；共用 helper 評估 A / B / C，建議短期 C）→ **BUG-199 FIXED**（待下一版 CI Test gate）。**T0792 DONE**（`eb527060`，23:00；安裝版 FileVersion / helper `0.7.3-pre.9`；`t0787` 3 輪 2 passed、30 情境＋UI＋codex ⑤ 全過、races 0、lateReports 0；`t0694` 3 次 1 passed、步驟 6 `kept:` 各 1 行；塔台 claude hook 由安裝版注入安裝版 `bat-hook.mjs`；spec 的 helper 用 repo `scripts/`，與安裝版 SHA-256 相同）。兩張 session id 已在 `session_ids`；session 快照已寫；`--close-worker T0792` / `T0793` exit 0。→ **D235**：BUG-197 / 198 **CLOSED**（交付版實測）；開 **BUG-200**（OPEN，low，不立即派工）。熱區 BUG：Open 1 / Fixed 3（159 / 196 / 199）/ Closed 60。使用者「0.7.4-pre.1，BUG-200：要現在就派工修」→ **D236**（版號線 `0.7.4-pre.N`，`_local-rules.md` 同步）→ 開 **T0794**（BUG-200 → FIXING）。23:06 派 **T0794**（yolo `--no-interactive`，exit 0，`started: 15:06:12Z`；Worker `154a3dfe…`）。**T0794 DONE**（`2b3f0b1b` / `216973bb`，23:58；只改 6 個測試檔；A：`holdReport` 由測試控制 hook 回報到達順序，96 執行緒負載下修改前 10 次 7 失敗 → 修改後 10 / 10，突變檢查兩支都失敗；B：5 檔 describe 30 s、`worktree-status-after-close` 40 s＋`maintenance.auto=false`（trace2：每次建立程序均勻變慢）；偏離：`beforeAll` 30 s；整套 3 / 3 綠、兩套並行範圍內全過、typecheck 0 / 0、legacy 472 / 33；範圍外 `dev-deploy-headless` 兩套並行輸出目錄衝突）→ **BUG-200 FIXED**；session id 已在 `session_ids`；session 快照已寫；`--close-worker T0794` exit 0。→ **D237**：接受 `beforeAll` 偏離；開 **BUG-201**（OPEN，low）。熱區 BUG：Open 1（201）/ Fixed 4（159 / 196 / 199 / 200）/ Closed 60。使用者「BUG-201：現在派工修」→ **D238** → 開 **T0795**（BUG-201 → FIXING）。00:04 派 **T0795**（yolo `--no-interactive`，exit 0，`started: 16:04:18Z`；Worker `44e759b7…`）。**T0795 DONE**（`6c2b6b93`，00:11；修改前兩個 vitest 並行 6 輪 4 輪失敗（`ENOENT` / `EBUSY` / `EPERM`）；`main(argv, { stagingRoot })`，預設 `DEFAULT_STAGING_ROOT` 不變、無新 CLI 旗標 / env；測試各用 `mkdtemp`；並行 8 輪 16 / 16 綠、整套 6783 綠、**兩套 `test:unit` 並行兩邊都 exit 0**（同時佐證 BUG-200）、預設目錄 mtime 不被測試改動、CLI dry-run 預設路徑不變、typecheck:electron 0、legacy 472 / 33）→ **BUG-201 FIXED**；session id 已在 `session_ids`；session 快照已寫；`--close-worker T0795` exit 0。熱區 BUG：Open 0 / Fixed 5（159 / 196 / 199 / 200 / 201）/ Closed 60。00:13 收到 CT 塔台 ADVISORY（CT D549：lean-ctx 殘留 `.kiro/steering/lean-ctx.md`）→ **D239** 塔台直接 `git rm`（R-G004；無引用）。使用者「push 先做 BUG-196 實機驗收」→ push `13f0f372..c7af5c87` → **D240** → 開 **T0796**（空工單，AskUserQuestion 版驗收）。00:14 派 **T0796**（`started: 16:14:51Z`）並以 AskUserQuestion 停住 → 使用者選「PASS：待送 1、對話框仍在」；日誌 `held` text / enter（16:15:25Z）→ 作答 `cleared (user input)`（16:15:41Z）→ `sent`（16:15:42Z）→ 塔台收到「T0796 完成」。T0796 DONE（`d163a65d` / `b68e1bf1`，bat-notify exit 0）；session 快照已寫；`--close-worker T0796` exit 0。→ **BUG-196 CLOSED**（D240）。熱區 BUG：Open 0 / Fixed 4（159 / 199 / 200 / 201）/ Closed 61。使用者「a」→ **D241** 發 `0.7.4-pre.1`：聯合驗證 @ `f5d9d4f4` 全綠（verify-native、typecheck 0 / 0、vite build、unit 6783 / 385、legacy 472 / 33）→ 去識別化 9 組 0、金鑰 0 → push `c7af5c87..f5d9d4f4` → `pre-release.yml -f version=0.7.4-pre.1` run `41480278090` 12 job 全綠 → **`v0.7.4-pre.1` 發佈**（16:34:36Z；exe 305 / zip 474 / AppImage 337 / dmg 352 MiB；server-bundle 7 assets）；更版重點已寫入並比對（無 codex 變更不寫〈歡迎協助測試〉）；CI Test gate 綠 → **BUG-199 / 200 / 201 CLOSED**（熱區 Fixed 1（159）/ Closed 64）；CHANGELOG / release-note / package.json → `bd25ffa8` push（README 無需更新：無 CT 介面變更）；Pages `41483187892` 綠、link-check 1451 / 0、首頁 0.7.4-pre.1。

- 2026-11-03 00:40 使用者「收工」。收工前：Session 106 快照歸檔（`2026-Q4-b.md`、INDEX 126）、L182（以時間差製造亂序的測試在負載下失效）、去識別化與金鑰掃描後 push。

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | 5 | T0792（安裝版驗收）/ T0793 / T0794 / T0795（測試修正）/ T0796（實機驗收空工單）皆 DONE、一次啟動、無提問；T0792 / T0793 並行 |
| 決策 | 8 | D234–D241 |
| BUG | 開 2 / 修 3 / 結 6 | 開 BUG-200 / 201；修 199 / 200 / 201；CLOSED 196 / 197 / 198 / 199 / 200 / 201；熱區 Open 0 / Fixed 1（159）/ Closed 64 |
| 發版 | 1 | `v0.7.4-pre.1`（run `41480278090`；Pages `41483187892`，link-check 1451 / 0） |
| 驗收 | 3 | `v0.7.3-pre.9` NSIS 重裝 PASS-WITH-WARN；BUG-196 實機（AskUserQuestion）；BUG-197 / 198 安裝版 e2e |
| 跨塔台 | ADVISORY 1 | CT D549：lean-ctx 殘留 → D239 移除 |

### 重點觀察

- 測試以牆鐘時間差製造亂序（300 ms）在負載下失效；改由測試攔住回報控制順序後，96 執行緒負載 10 / 10 通過 → L182
- 修完 BUG-200 / 201 後，「兩套 `test:unit` 同時跑」第一次整套全綠；同一 checkout 並行 Worker 各自驗證不再互相干擾
- bypass 權限模式的塔台不會出現權限對話框；BUG-196 實機驗收改用 AskUserQuestion，權限情境由安裝版 e2e 涵蓋（D240）
- 後續候選：BUG-159 驗收；`v0.7.4-pre.1` NSIS 重裝驗收（換版時）；Linux AppImage；PLAN-059 C（問 CT Q5）

### 編號起始（下 session）

- **T0797** / **BUG-202** / **PLAN-062** / **D242** / **EXP-WFMINE-002** / **L183** / **CT-T023**

---

## 🛏 前 Session 收工快照 (第一百零七 session, 2026-11-02 21:40 - 2026-11-02 22:33, ~55m)

### 主軸：pre.8 NSIS 驗收 → BUG-198 修正（T0791）→ `v0.7.3-pre.9`

#### 時間線（時間取自系統 / git / gh）

> 🟢 **第一百零七 session 開工**（2026-11-02 21:40 (UTC+8)，CT v6.0.0-beta.10，Fast Path；塔台 session `2c1fd280-0f34-4dfc-af2a-71b815044fcf`；`--set-role tower --mode on` exit 0；安裝版 BAT / helper `v0.7.3-pre.8`（已換版）；HEAD `d1c3e40a`、`main` = `origin/main`（0 / 0）、工作區乾淨；熱區工單無非終態；BUG 熱區 Open 1（BUG-198）/ Fixed 3 / Closed 58，與 `_bug-tracker.md` 一致，免重建；`%TEMP%` 只有 pre.7 的 `bat-nsis-acceptance-20261102-175507`，**pre.8 未跑 NSIS 重裝驗收**）。
>
> 🟢 **第一百零七 session 塔台重啟**（2026-11-02 21:43 (UTC+8)，CT v6.0.0-beta.10，Fast Path；塔台 session `1ccb4733-ea63-4a7e-8b63-6faa91addd19`；`--set-role tower --mode on` exit 0；安裝版 helper `v0.7.3-pre.8`；HEAD `7c7f7cfe`（`main` ahead 1，未 push）；熱區 186 張工單無非終態；BUG Open 1 / Fixed 3 / Closed 58；`bat_list_questions` pending 0；熱區檔案皆 < 400 KB）。**`v0.7.3-pre.8` NSIS 完整重裝驗收 PASS**（`e2e\manual\nsis-reinstall-acceptance.ps1` real 模式，21:41:34–21:42:14；AllUsers / HKLM；① SHA-256 `b44a333e…` ② 同版覆蓋 ③ 靜默解除 ④ 乾淨重裝全 PASS，三支 helper `--version` = v0.7.3-pre.8、內嵌 claude / codex 存在、userData 130 檔 SHA-256 未變；⑤ LaunchCheck 未帶 → SKIPPED）。報告 `%TEMP%\bat-nsis-acceptance-20261102-214134\report.md`；含權杖的 `userdata-backup`（130 檔）已刪除。使用者「開 BUG-198 的修正單並派工」→ **D232** → 開 **T0791**（P2，S；沿用 T0790 的 `at`，晚到的 `stop` 不結束較晚開始的回合）；BUG-198 → FIXING（tracker 只動該列，Open 0 / Fixing 1）。21:47 派 **T0791**（yolo `--no-interactive`，exit 0，`started: 2026-11-02T13:47:20.353Z`；Worker 分頁 `f9977817…`）。**T0791 DONE**（`20bc7a88`，22:05；`TerminalBlockedTracker` 記目前回合 `user-prompt-submit` 中最晚的 `at`，`stop` 的 `at` 較早 → 不結束回合、記 `[turn] … kept: … reported late`（`endTurnByStop`）；任一方沒有 `at` 照舊；`bat-hook.mjs` 未改；修正前 4 情境重現、真實 hook 程序與 e2e 也重現；突變 7 / 4 失敗；e2e `t0694` 新步驟 6 綠、不回歸 `t0609` / `t0735` / `t0590` / `t0787` 綠；typecheck 0 / 0、unit 6782 / 385、legacy 472 / 33、vite build；殘留：同一回合 prompt 晚於自己的 `stop` → 多留 60 s `↻`（方向安全，記在 docs）；工單 `status: TODO` 應寫 `PENDING`（塔台模板筆誤））→ **BUG-198 FIXED**（tracker 只動該列，Fixed 4）；session id 已在 `session_ids`；session 快照已寫；`--close-worker T0791` exit 0。使用者「發 0.7.3-pre.9 與驗收的有 BUG-159、196、197、198 建議安排順序」→ **D233** → 聯合驗證 @ `5ebcc71f`：verify-native、typecheck 0 / 0、vite build、legacy 472 / 33 綠；unit 1 失敗（`nvm-login-profile.test.ts` 真 bash 5 s 逾時，BUG-195 同類第五支）→ 單檔 3 / 3、整套重跑 6782 / 385 綠 → 開 **BUG-199**（OPEN，low，不擋發版）。去識別化 9 組 0、未推 diff 金鑰 0。驗收順序建議：① BUG-196 使用者實機 ② BUG-197 同場＋自動化 t0787 ③ BUG-198 自動化 t0694 ④ BUG-159 需非系統管理員環境，最後。push `d1c3e40a..61fcd31c` → `pre-release.yml -f version=0.7.3-pre.9` run `41459914265` 12 job 全綠（CI unit 未逾時）→ **`v0.7.3-pre.9` 發佈**（14:29:12Z；exe 305 / zip 473 / AppImage 337 / dmg 352 MiB；server-bundle 7 assets）；更版重點已寫入並比對（含〈待驗收〉四項，無 codex 變更不寫〈歡迎協助測試〉）；CHANGELOG / release-note / package.json → `c1bef62e` push（README 無需更新：無 CT 介面變更）；Pages `41462684452` 綠、link-check 1445 / 0、首頁 0.7.3-pre.9。**`0.7.3-pre.N` 線已用完**，下一版前先問使用者版號線。

- 2026-11-02 22:33 使用者「收工, 換版」。收工前：Session 105 快照歸檔（`2026-Q4-b.md`、INDEX 125）、L181（工單 `status` 用 `PENDING`）、去識別化與金鑰掃描後 push。

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | 1 | T0791 DONE（一次啟動、無提問） |
| 決策 | 2 | D232–D233 |
| BUG | 開 1 / 修 1 | BUG-198 FIXED（待驗收）；BUG-199（low）OPEN；熱區 Open 1 / Fixed 4 / Closed 58 |
| 發版 | 1 | `v0.7.3-pre.9`（run `41459914265`；Pages `41462684452`，link-check 1445 / 0） |
| 驗收 | 1 | `v0.7.3-pre.8` NSIS 完整重裝 PASS |

### 重點觀察

- T0790 的 hook 程序啟動時間 `at` 一次解決同類的兩個亂序（blocked 清除、回合結束）；剩下的反方向（同一回合 prompt 晚於自己的 `stop`）方向安全，只記在 docs
- 真子程序測試的負載逾時又多一支（BUG-199，BUG-195 同類第五支）；逐檔加 timeout 會一直追加，修正單可考慮共用 helper / 標記
- 塔台開單時 frontmatter 寫成 `status: TODO`，Worker 視同未開始照常處理 → L181
- 後續候選：T0792 自動化驗收（BUG-197 / 198）；BUG-199；新版號線

### 編號起始（下 session）

- **T0792** / **BUG-200** / **PLAN-062** / **D234** / **EXP-WFMINE-002** / **L182** / **CT-T023**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-11-03 00:40 UTC+8（第一百零八 session 收工）

### 近期完成
- **`v0.7.4-pre.1` 發佈**（第一百零八 session，run `41480278090`，target `f5d9d4f4`）：BUG-199 / 200 / 201 測試修正；Pages `41483187892` 綠；版號線改 `0.7.4-pre.N`（D236）
- **BUG-196 / 197 / 198 CLOSED**（第一百零八 session）：T0796 實機（AskUserQuestion）、T0792 安裝版 pre.9 e2e
- **`v0.7.3-pre.9` NSIS 完整重裝驗收 PASS-WITH-WARN**（第一百零八 session 22:37）
- **`v0.7.3-pre.9` 發佈**（第一百零七 session）：BUG-198（T0791）

### 待辦（依優先序）
1. 🟡 **`v0.7.4-pre.1` NSIS 重裝驗收**（使用者換版時）：讀報告、刪 `userdata-backup`
2. 🟡 **BUG-159 驗收**：需非系統管理員環境 ＋ codex
3. 🟢 Linux AppImage（Ubuntu 22.04）待回報；t0757 偶發失敗再發生才開 BUG（D218）
4. 🟢 PLAN-059 C（問 CT Q5）；PLAN-060 / 061 IDEA

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式
- 改 `_bug-tracker.md` / `_backlog.md` 不用全檔 `sed`，改完跑 parser 測試（L179）

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 0 / Fixing 0 / Fixed 1 / Closed 64，2026-11-03 00:36）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D241）｜ Learnings → [_learnings.md](_learnings.md)（最大 L182）
- 研究報告 Artifact「Herdr 對照 BAT」→ https://claude.ai/artifact/Ybj66gYLkMHZE8xUyyDiEy（私人）
- 網站 → https://gowerlin.github.io/better-agent-terminal/｜ 素材 spec → `e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1`，輸出 `e2e-media/`）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（126 entries）

### 編號起始
- **T0797** / **BUG-202** / **PLAN-062** / **D242** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L183** / **CT-T023**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.4-pre.1**（package.json + lock；D236 `0.7.4-pre.N` 線） |
| **最新 release** | `v0.7.4-pre.1`（2026-11-02T16:34:36Z，run `41480278090`，target `f5d9d4f4`：BUG-199 / 200 / 201 測試修正）；前一 tag `v0.7.3-pre.9`（2026-11-02T14:29:12Z，run `41459914265`，target `61fcd31c`：BUG-198 晚到的 `stop`）；前一 tag `v0.7.3-pre.8`（12:19:33Z）；更早見 `release-note.md` / `CHANGELOG.md` |
| **目前主軸** | 熱區無進行中工單、無 OPEN BUG；BUG-159 待驗收；`v0.7.4-pre.1` 已發佈 |
| **工單最大編號** | **T0796** DONE（BUG-196 實機驗收，第一百零八 session）；T0792–T0795 皆 DONE |
| **BUG 最大編號** | **BUG-201** CLOSED；熱區 Open 0 / Fixing 0 / Fixed 1（BUG-159）/ Closed 64（2026-11-03 00:36） |
| **PLAN 最大編號** | **PLAN-061** IDEA（非 Windows 的 claude 7501，D229）；PLAN-060 IDEA（macOS 簽章）；PLAN-059 PLANNED；PLAN-029 / 053 / 054 / 055 / 057 DONE |
| **決策最大編號** | **D241**（發 `0.7.4-pre.1`，第一百零八 session） |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v6.0.0-beta.10**（第一百零三 session 起） |
| **unit test 基線** | **6783 passed / 385 files**；typecheck 0 / 0、vite build、legacy 472 / 33（塔台聯合驗證 @ `f5d9d4f4`，`0.7.4-pre.1`，2026-11-03 第一百零八 session）；兩套 `test:unit` 並行也全綠（T0795） |
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
> 最後掃描:2026-11-01 01:24 (UTC+8) 第九十九 session **Full Scan**（啟動時快照已 9 天，依 Startup Protocol 第 7 點；前次 Full Scan 2026-10-23 06:50）

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`, terminal `508fced6…`；無 `BAT_TOWER_TERMINAL_ID` |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（PowerShell 確認）；另有 `BAT_USER_DATA` |
| BAT 安裝版 | ✅ `0.7.2-pre.3` | exe FileVersion `0.7.2-pre.3`；安裝版 `bat-terminal.mjs --version` → `v0.7.2-pre.3` exit 0；Tower `--set-role tower --mode on` exit 0；`bat_whoami` session 名稱 `better-agent-terminal · Tower` |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ | `%APPDATA%\BetterAgentTerminal\Logs\debug-20261031-133734.log`（最新） |
| 平台 | Windows 11 | PowerShell 主，Bash tool 並存；node `v26.13.0` / npm `12.2.1` |
| gh CLI | ✅ | **必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `main` = `origin/main` @ `21ca9eba`（fetch 後 0 / 0）；工作區乾淨；另有 worktree `../.ct-integration/better-agent-terminal`（detached `4e5f5e7f`）；無 stash |
| 最新 CI / release | ✅ | Pre-Release 2026-10-30 09:02Z success → `v0.7.2-pre.3`；Pages 09:15Z success |
| GitHub open issues | 2 | #20（file link，BUG-174 FIXED，等回報者）；**#22**（2026-10-30 09:54Z 新開，Worker 縮圖停在啟動畫面，回報者用 `0.7.1-pre.9` macOS = BUG-175，`v0.7.2-pre.3` 已修，尚未留言） |
| Control Tower skills | ✅ v5.14.4 | control-tower 5.14.4（第九十九 session 啟動時） |
| 熱區單據 | **T:110 / BUG:39 / PLAN:21 / EXP:1** | BUG：FIXED 28 / CLOSED 11（與 `_bug-tracker.md` 一致）；PLAN：DONE 10 / DROPPED 2 / IDEA 8 / PLANNED 1 |
| 非終態工單 | 無 | |
| 最大編號 | **T0714 / BUG-175 / PLAN-056 / D189 / L177 / CT-T022** | 下張：T0715 / BUG-176 / PLAN-057 / D190 / L178 / CT-T023 |
| unit test / typecheck | 未重跑 | 最近：6130 passed / 343 files、typecheck 0 / 0（@ `ae4602ed`，第九十七 session） |
| state 檔 | ⚠️ 33.1 KB | 超 30 KB 軟警告；`_decision-log.md` 234,033 bytes（< 400 KB 預算）；季檔 `2026-Q4.md` 190,427 bytes（接近 200 KB 切割點）、INDEX 115 列 |
| 設定來源 | project | `_tower-config.yaml`（auto-session **on**，`yolo_max_retries: 1`，`auto_commit: on`，`worker_auto_close: done`，`worker_close_delay: 10`） |
| 塔台版本 | v5.14.4 | control-tower skill（第九十九 session） |

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
