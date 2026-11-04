---
schema_kind: tower-state
summary_version: 1
updated_at: "2026-11-04T15:00:19+08:00"
session: "2026-11-04 14:56 第一百一十九 session（CT v6.0.0-beta.11）"
next_ids:
  workorder: "T0848"
  decision: "D282"
  bug: "BUG-212"
  plan: "PLAN-066"
todo:
  - "✅ `0.7.4-pre.8` 已發佈並驗收（D280）：PLAN-063 ③ 一鍵接回 PASS（pre.7 → pre.8）、同版重裝中性 toast / 對話框 PASS（T0846 / T0847）、NSIS 完整重裝 PASS（15:00 判讀，備份已刪）；PLAN-063 DONE（D281），holder 模型移到 PLAN-065 IDEA"
  - "T0836 e2e 乾淨 HEAD 重跑：併入 T0844"
  - "T0843（D274，使用者「一起修好再發版」）：上傳失敗提示先講原因、檔名只出現一次；排在 T0841 後（同改 locales）"
  - "BUG-211 FIXED（T0842 `bb8cbe1a`）：待發版與遠端實機驗證（遠端視窗附 3 張 > 8 MiB 圖 → 提示、不送出、連線不斷；2 張照常）；後續候選：CLAUDE.md / multi-remote-profiles docs 補 `ws-limits.ts` / `FRAME_TOO_LARGE` 一行；fork 後自動送出 pending 圖片的路徑沒有面板檢查（只靠 client 守門）"
  - "本批（D271 / D272，做完一起發 `0.7.4-pre.7`＋PLAN-063 真實升級驗收）：DONE T0826 `83f1d5bf`、T0827 `93c6507a`、T0828（研究）、T0829 `841f5e6a`、T0830 `add1b932`、T0831（研究）、T0837（BUG-211 重現 `319c3646`）、T0838 `919a006e`、T0842 `bb8cbe1a`、T0832 `0382882b`（契約 C-1–C-10）、T0833 `8f8c4579`、T0839 `aaf5201b`、T0834 `61cd028c`、T0835 `64dbb3f4`、T0836 `d99eac4c`（e2e 12 項 PASS）、T0840 `790aacf9`（拋棄式發行版實測 PASS、已 unregister）、T0841 `715c30de`、T0843 `ab391de9`、T0844（驗證 PASS）、T0845 `e0e9e6b7`；待做：發版確認；PLAN-043 Phase 3（W5–W8）等驗收 VM 再開單"
  - "待實機驗收：T0827 Linux AppImage 缺字型提示（回報區〈待實機驗收〉4 項）；T0830 真 WSL 的 install-bundle 中止（`pkill tar`）與 keep-alive 關閉後閒置關機（`docs/wsl-deployment.md` Real WSL Pre-Flight Checklist）；T0832 smoke S14 對已部署 server（發版後 `node scripts/smoke-remote-headless.mjs --target wsl:<distro>`）；PLAN-038 實機 6 項（T0836 回報區〈待實機驗收〉：SSH claude 貼圖認成圖片、codex 收路徑、WSL Alt+V、WSL 其他 distro、macOS Finder 提示、真實拖放＋agent 讀檔）；T0840 精靈在真的 BAT 視窗對拋棄式發行版從頭跑一次（清單→套用→完成畫面），之後 W8 / 實機時一併；T0841「改用 Mirrored 並重試」實機（兩次 `wsl --shutdown`，步驟在 T0841 回報區〈待實機驗收〉）"
  - "T0830 後續候選（未開單）：SSH / Docker 精靈主行程長呼叫接 operation id；`src/components/profiles/types.ts` 補 `wslKeepAlive`；CLAUDE.md 是否補 keep-alive 開關 / 精靈中止的必守規則"
  - "MSRC 回報 microsoft/node-pty（使用者自行處理，D255）"
  - "PLAN-058：T0814（W1）`fc22e04a`＋T0815（W0）`0b67db03` DONE，T0819 安裝版 pre.5 假 API e2e PASS，待使用者手動確認（清單在 T0819 回報區）；可選後續：卡片等待時讓輸入框可送出（T0815〈遭遇問題〉1，未開單）"
  - "觀察：語音可用性檢查 macOS 未實機；`unknown(timeout)` 若實機出現可把逾時提到 30 s（T0802 後續建議）"
  - "PLAN-060（IDEA）：macOS Developer ID 簽章（目前 macOS 不顯示系統通知）"
  - "觀察：t0757 偶發失敗再發生才開 BUG（D218）"
  - "版號線：`0.7.4-pre.N`，已發 pre.1 – pre.8（D236 / D241 / D248 / D256 / D262 / D269 / D276 / D280）；pre.N 最多到 9"
---
# Tower State — better-agent-terminal

> 🟢 **第一百一十九 session 開工**（2026-11-04 14:56 (UTC+8)，CT v6.0.0-beta.11，Fast Path；塔台 session `56c3cb03-27db-482d-847b-8b7c5ee3f73c`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；安裝版 `0.7.4-pre.8`；HEAD `dc25fc4a` = `origin/main`、工作區乾淨；熱區 243 張工單皆終態；BUG 只剩 BUG-211 FIXED；PLAN IN_PROGRESS 5（038 / 043 / 058 / 063 / 064）/ IDEA 4；`bat_list_questions` pending 0；熱檔皆在 400 KB 預算內）。15:00 使用者回報同版重裝 pre.8 → pre.8 OK（截圖為 T0846 中性 toast）、NSIS 重裝驗收已跑 → 讀 `%TEMP%\bat-nsis-acceptance-20261104-145526\report.md`：**PASS**（⓪–④ PASS、⑤ SKIPPED，同版覆蓋）；`userdata-backup` 已刪除；結果記在 PLAN-063〈狀態〉。15:01 使用者選 A＋push → D281：PLAN-063 DONE、開 PLAN-065（IDEA，holder 模型）、刪本機分支 `ct/T0820`（`e46ab405`，遠端已刪）。
>
> 🟢 **第一百一十八 session 開工**（2026-11-04 14:08 (UTC+8)，CT v6.0.0-beta.11，Fast Path；塔台 session `16bf8f88-e1f5-4d6d-b20c-cd7fe1bdd6df`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；安裝版 `0.7.4-pre.7`；HEAD `08f10017`、工作區乾淨；熱區工單皆 DONE、BUG 只剩 BUG-211 FIXED；`bat_list_questions` pending 0）。14:14 使用者回報同版重裝（pre.7 → pre.7，14:07）後沒有恢復對話框 → 日誌判讀：T0823 路徑 PASS、`detectUpgradeInterruption` 因版本相同不觸發（設計如此）、③ 一鍵接回未驗（`a85cd74e`）。14:16 使用者選 A → D278 開 **T0846**；14:01 那次 NSIS 驗收在前置檢查 FAIL（BAT 執行中，什麼都沒做），pre.7 的 NSIS 驗收仍待做。14:17 push `13f74738..bc7f6ccd`（push 前去識別化命中 1 處專案名，在未推送的 `08f10017` 內以 fixup 改成代稱，歷史不含原名）；派 T0846（`--mode yolo --no-interactive`，`started:` 06:17:53Z，分頁 `7147b060…`）。14:19 T0846 提問 Q-1（`installer-quit-request.test.ts:254` 寫死舊規則「同版＋紀錄 → false」、不在 affects_files）→ 塔台範圍內裁決選 A（只改該斷言與標題、補同版＋只有孤兒 → false）→ `--answer --choice 1` exit 0。14:21 Q-2（T0823 的「取消安裝＋同版＋紀錄 → 不提示」案例與同版重裝無法區分）→ 塔台範圍內裁決選 A（照 D278 觸發、改該斷言；同版文字改中性「安裝程式結束了 BAT（v…）與 N 個終端…」，取消安裝也成立）→ `--answer --choice 1` exit 0。14:24 T0846 DONE（`9e966f98`，11 檔 +139 / −31；typecheck 0 / 0、unit 435 檔 / 7740、vite build）；收單核對 commit 範圍、session id `e57c7b18` 一致；`--close-worker T0846 --delay-ms 10000` exit 0。後續候選：`InterruptedAgentsDialog` 的「升級結束的 agent 分頁」標題 / 說明在同版重裝時字面不精確→ 14:26 使用者「併進發 pre.8 的同一批。要開」→ D279 開 **T0847**（三語文字改中性）。14:27 派 T0847（`--mode yolo --no-interactive`，`started:` 06:27:33Z，分頁 `ce523ea2…`）。14:30 T0847 DONE（`511df465`，5 檔 +22 / −10；typecheck 0、unit 435 檔 / 7743、vite build）；收單核對 commit 範圍、session id `c8c629fb` 一致；`--close-worker T0847 --delay-ms 10000` exit 0。14:31 使用者「發 0.7.4-pre.8」→ D280 → pre-release run `41786124213`（target `3902f36c`）success，publishedAt 2026-11-04T06:46:18Z，4 個安裝檔＋`server-bundle-v0.7.4-pre.8`；更版重點已改寫；三文件＋版號更新（`33d2a570`，push `3902f36c..48216f2d`）；Pages run `41787999864` 綠、首頁版號 pre.8、link-check 0 錯誤。14:51 使用者在 BAT 執行中安裝 pre.8（實為 pre.7 → pre.8 升級）→ 重開按恢復，本塔台 session `16bf8f88` 一鍵接回 → 14:53 日誌判讀：PLAN-063 ①②④ 再 PASS、**③ 一鍵接回 PASS**（兩個分頁 `mode=session`）；`--set-role tower --mode on` 重新宣告 exit 0。
>
> 🟢 **第一百一十七 session 開工**（2026-11-04 14:04 (UTC+8)，CT v6.0.0-beta.11，Fast Path；塔台 session `0f32e421-6740-42eb-b68b-abe5fc2ac1df`；`--set-role tower --mode on` exit 0；安裝版 `0.7.4-pre.7`（升級 pre.6 → pre.7 後重開）；HEAD `13f74738`、工作區乾淨）。14:05 判讀 PLAN-063 真實升級（D277）：①②④⑤ PASS、③ 對話框列出 2 個 claude 分頁，一鍵接回待使用者確認；結果記在 PLAN-063〈狀態〉。
>
> 🟢 **第一百一十六 session 開工**（2026-11-04 08:36 (UTC+8)，CT v6.0.0-beta.11，Fast Path；塔台 session `50e83f2b-df2b-4218-972e-8e2f5dc29c81`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；安裝版 `0.7.4-pre.6`；HEAD `74902dd2` = `origin/main`、工作區乾淨；熱區 221 張工單皆 DONE、無未結 BUG；`bat_list_questions` pending 0）。08:45 使用者回報 WSL AppImage 介面中文變方框 → 實測缺字型（`fc-list :lang=zh` = 0）→ D270：開 **T0826**（文件）、**PLAN-064**（IDEA）→ `c13ea17d`；08:47 派 T0826（`--mode yolo --no-interactive`，`started:` 00:47:09Z）→ 08:49 DONE，產品 `83f1d5bf`（4 檔 +41 / −2，只文件；site build 通過），收單核對範圍與 README 內容、session id 一致；`--close-worker T0826 --delay-ms 10000` exit 0。08:52 使用者「處理 PLAN-064 038 043」→ 選項對齊 → D271：開 T0827–T0831，三張 PLAN → IN_PROGRESS；08:56 派 T0827 / T0828 / T0831（並行，皆 `started:`）。09:05–09:19 T0828 / T0831（研究）、T0827 `93c6507a`、T0829 `841f5e6a`（孤兒 wsl.exe 實測不存在）DONE，收單核對範圍與 session id，`--close-worker` 皆排程。09:17 使用者裁決 → D272：開 BUG-211、T0832–T0841；09:21 派 T0830 / T0837 / T0838（皆 `started:`）。09:27 T0837 DONE（BUG-211 成立，`319c3646` 重現測試）；使用者指示三個 Worker 收單後暫停自動派單。09:28 T0830 提問 Q-1（step abort 需改 `wsl-detect.ts` / `wsl-systemd.ts`）→ 塔台範圍內裁決選 A（擴大，不給 signal 時行為不變；在 T0838 `919a006e` 之上改、只 add 自己的變更）→ `--answer --choice 1` exit 0。09:30 T0838 DONE（`919a006e`，後續併入 T0839）。09:49 T0830 DONE（`add1b932`，30 檔 +1828 / −78；typecheck 0 / 0、unit 416 檔、legacy 472 / 33、vite build）；三張皆收單、`--close-worker` 排程 → 自動派單正式暫停。11:14 使用者「恢復派單」→ 派 T0832；BUG-211 開單 → D273 開 T0842（BUG-211 → FIXING，T0834 改依賴 T0842）→ 11:16 派 T0842（皆 `started:`）。11:26 T0832 提問 Q-1（smoke S14 需改 `scripts/__tests__/smoke-remote-headless.test.mjs`，漏列在 affects_files）→ 塔台範圍內裁決選 A → `--answer --choice 1` exit 0。11:27 T0842 DONE（`bb8cbe1a`，14 檔 +703 / −42；typecheck 0 / 0、unit 421 檔、vite build）→ BUG-211 FIXED（待發版與遠端實機驗證）；`--close-worker` 排程。11:32–12:15 依序收 T0832 `0382882b`、T0833 `8f8c4579`、T0839 `aaf5201b`、T0834 `61cd028c`、T0835 `64dbb3f4`（後續併入下一張單），派 T0833 → T0834＋T0839 → T0835 → T0836＋T0840。12:19 T0840 提問 Q-1（legacy 精靈測試寫死 9 步、mock 缺新 IPC，`tests/` 不在 affects_files）→ 塔台範圍內裁決選 A（只改既有 3 檔、不在 tests/ 新增檔，D177）→ `--answer --choice 1` exit 0。12:47 T0840 DONE（`790aacf9`）→ 派 T0841。13:07 T0841 提問 Q-1（是否實機 `wsl --shutdown`）→ 依 D272 轉問使用者 → 使用者選不做、列待實機驗收 → `--answer --choice 1` exit 0。13:09 T0841 DONE（`715c30de`，19 檔；unit 434 檔、legacy 472、e2e V3 4 項 PASS；使用者 `.wslconfig` 未變（mtime 2026-05-26）、無備份殘留）→ 派 T0843。13:13 T0843 提問 Q-1（4 個「T0437 斷言」實際走上傳失敗路徑，塔台開單時 memory_overrides 前提寫錯）→ 塔台選 A（mock 改成不嘗試上傳、斷言逐字不變；新文字的 TRANSPORT 情況至少一個面板＋一個終端測試逐字斷言）→ `--answer --choice 1` exit 0。13:17 T0843 DONE（`ab391de9`，unit 435 檔）→ 開 T0844（整批驗證）。13:23 T0844 DONE（1–7 PASS，HEAD `47f80317`）→ D275 開 T0845。13:27 T0845 DONE（`e0e9e6b7`，unit 435 檔）→ 本批完成。13:29 使用者「push 並發 pre.7」→ 去識別化命中 5 處 → 使用者選修正 commit（`13150f45`）不改寫歷史 → push `74902dd2..13150f45` → pre-release run `41779586475`（D276）。
>
> 🟢 **第一百一十五 session 開工**（2026-11-04 03:37 (UTC+8)，CT v6.0.0-beta.11，Fast Path；塔台 session `96f9499a-1ea6-4a55-9722-6c14f0490c85`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；安裝版 FileVersion `0.7.4-pre.6`；HEAD `7c645e89`、`main` = `origin/main`（fetch 後 0 / 0）、工作區乾淨；熱區 221 張工單皆 DONE；BUG 熱區 Closed 73 / WONTFIX 1、無未結；PLAN IN_PROGRESS 2 / IDEA 6 / DONE 18 / DROPPED 2；`bat_list_questions` pending 0）。**`v0.7.4-pre.6` NSIS 完整重裝驗收 PASS-WITH-WARN**（real 模式 03:35:58–03:36:58；AllUsers / HKLM；唯一 WARN = ⓪ 目前安裝版 pre.5，② 實為升級，屬預期；① SHA-256 `350b79f0…` ② ③ ④ 全 PASS，三支 helper `--version` = v0.7.4-pre.6、內嵌 claude / codex 存在、userData 130 檔 SHA-256 未變；⑤ SKIPPED；驗收時 BAT 已關閉，T0823 的「安裝前請 BAT 正常結束」路徑未經過，真實升級驗收仍待下一版）；報告 `%TEMP%\bat-nsis-acceptance-20261104-033558\report.md`；含權杖的 `userdata-backup` 已刪除。
>
> 最後更新:2026-11-04 13:58 (UTC+8) — **第一百一十六 session**：本批 T0826–T0845 全部 DONE、`v0.7.4-pre.7` 發佈（D276）；使用者選 A 在本機 BAT 執行中直接升級到 pre.7 做 PLAN-063 真實驗收（D277），本 session 會隨升級結束。
>
> **下次起手**:熱區無進行中工單；BUG-211 FIXED（待遠端實機）。① **判讀 PLAN-063 真實升級**（D277 判讀 ①–⑤：問使用者安裝時 BAT 是否自己關、重開 toast、被中斷的 agent 分頁、debug log `[installer-quit]` / `[upgrade-interruption]`、無孤兒程序）；② 使用者跑 NSIS 重裝驗收 `-Version 0.7.4-pre.7` 後讀 `%TEMP%\bat-nsis-acceptance-*\report.md` 並刪 `userdata-backup`；③ 待實機驗收清單（frontmatter todo）；④ PLAN-058 手動確認、MSRC。

---

## 🛏 本 Session 收工快照 (第一百一十五 session, 2026-11-04 03:37 - 2026-11-04 03:42, ~5m)

### 主軸：`v0.7.4-pre.6` NSIS 重裝驗收判讀 → 推送記帳 commit → `*archive --state`

#### 時間線（時間取自系統 / git）

1. **03:37** Fast Path；`--set-role tower --mode on` exit 0；安裝版 `0.7.4-pre.6`；熱區工單全 DONE、無未結 BUG；`bat_list_questions` pending 0
2. **03:38** 讀 `%TEMP%\bat-nsis-acceptance-20261104-033558\report.md` → PASS-WITH-WARN（WARN = ⓪ 原安裝版 pre.5，預期）；刪 `userdata-backup`；記帳 `678f87d2`
3. **03:39** 使用者「推記帳 commit、跑 `*archive --state`」→ 去識別化 9 組 0、金鑰 0 → push `7c645e89..678f87d2`
4. **03:42** `*archive --state`：109 / 110 收工快照＋111–114 開工條目 → 新季檔 `2026-Q4-c.md`（Q4-b 已 186 KB）；INDEX 129–134、總數改正為 134；起手式 / 基本資訊更新到目前狀態 → `73f3dde6`
5. **03:42** 收工

### 本輪戰績
- 驗收：`v0.7.4-pre.6` NSIS 完整重裝 PASS-WITH-WARN（T0823 安裝前請 BAT 結束的路徑未經過：驗收時 BAT 已關閉）
- 狀態檔瘦身：81,174 → 20,814 bytes；無新工單 / BUG / 決策

### 編號起始（下 session）
- **T0826** / **BUG-211** / **PLAN-064** / **D270** / **L186** / **CT-T023**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-11-04 03:41 UTC+8（第一百一十五 session，`*archive --state`）

### 近期完成
- **`v0.7.4-pre.6` 發佈**（第一百一十四 session，run `41701904056`，target `4b726a86`）：PLAN-063 子項 1–3（T0821 / T0822 / T0823）、BUG-210（T0825）；NSIS 重裝驗收 PASS-WITH-WARN（第一百一十五 session）
- **`v0.7.4-pre.5`**（第一百一十三 session）：PLAN-058 W0 / W1（T0815 / T0814）、Terminal Server fork（T0816，BUG-209）
- **`v0.7.4-pre.4`**（第一百一十二 session）：Linux PTY / child_process 子程序 fd 繼承（T0806 / T0807，BUG-205 – 207）
- **`v0.7.4-pre.3`**（第一百一十一 session）：語音可用性事先檢查（T0802）、驗收腳本 `-Version` 必填（T0801）

### 待辦（依優先序；完整內容見 frontmatter `todo`）
1. PLAN-058：待使用者手動確認（清單在 T0819 回報區）
2. PLAN-063：真實升級驗收待下一版（`ct/T0820` 探測 spec 改寫重跑，D266）；子項 4 holder IDEA
3. MSRC 回報 microsoft/node-pty（使用者自行處理，D255）
4. 觀察：語音可用性 macOS 未實機（T0802）、t0757 偶發失敗（D218）；PLAN-060 IDEA

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式
- 改 `_bug-tracker.md` / `_backlog.md` 不用全檔 `sed`，改完跑 parser 測試（L179）

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 0 / Fixing 0 / Fixed 0 / Closed 73 / WONTFIX 1）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D269）｜ Learnings → [_learnings.md](_learnings.md)（最大 L185）
- 研究報告 Artifact「Herdr 對照 BAT」→ https://claude.ai/artifact/Ybj66gYLkMHZE8xUyyDiEy（私人）
- 網站 → https://gowerlin.github.io/better-agent-terminal/｜ 素材 spec → `e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1`，輸出 `e2e-media/`）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（134 entries；最新 `2026-Q4-c.md`）

### 編號起始
- **T0846** / **BUG-212** / **PLAN-065** / **D278** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L186** / **CT-T023**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.4-pre.6**（package.json + lock；D236 `0.7.4-pre.N` 線） |
| **最新 release** | `v0.7.4-pre.6`（2026-11-03T19:31:58Z，run `41701904056`，target `4b726a86`：PLAN-063 升級結束終端的提示與說明、安裝前請 BAT 正常結束，BUG-210）；前一 tag `v0.7.4-pre.5`；更早見 `release-note.md` / `CHANGELOG.md` |
| **目前主軸** | 熱區無進行中工單、無未結 BUG；PLAN-058 / 063 IN_PROGRESS（等使用者確認 / 等下一版做真實升級驗收） |
| **工單最大編號** | **T0825** DONE（BUG-210 第二個實例不跑 whenReady，第一百一十四 session） |
| **BUG 最大編號** | **BUG-210** CLOSED；熱區 Open 0 / Fixing 0 / Fixed 0 / Closed 73 / WONTFIX 1（203） |
| **PLAN 最大編號** | **PLAN-063** IN_PROGRESS；PLAN-058 IN_PROGRESS；IDEA 6（含 PLAN-060 macOS 簽章） |
| **決策最大編號** | **D269**（發佈 `0.7.4-pre.6`，第一百一十四 session） |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v6.0.0-beta.11**（第一百零九 session 起） |
| **unit test 基線** | **7124 passed / 406 files**（T0825 Worker 回報 @ `bfde0beb`）；typecheck 0 / 0、vite build、legacy 472 / 33；pre-release `41701904056` tests job 綠 |
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
