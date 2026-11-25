---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
ct_version: "6.1.1"
updated_at: "2026-11-25T23:23:39+0800"
session: "2026-11-25 20:19 第一百三十二 session（CT v6.1.1）"
next_ids:
  workorder: "T0928"
  decision: "D361"
  bug: "BUG-225"
  plan: "PLAN-070"
  user: "U-13"
  action: "A-4"
todo:
  - "候選（未開單，T0924 建議）：`scripts/verify-packaged-native.js` `readAsarFile` 不檢查 `fs.readSync` 回傳位元組數，截斷的 app.asar 會被讀成 NUL 而不報錯；改成讀不足判失敗（檢查變嚴）"
  - "PLAN-069（IN_PROGRESS，D346）：待辦分頁推薦項＋放棄 / 批次放棄；CT 6.2.0-pre.1 規範完成（CT D889）→ BAT 實作 T0922（隔離 worktree）；完成後通知 CT 安排雙方驗收（M-1–M-15），`0.8.0-pre.4` 與 CT 6.2.0 同日發佈；BAT 塔台寫提問時推薦項排第一、說明加「（推薦）」（R1）"
  - "🚀 `v0.8.0-pre.3` 已發佈（D339，2026-11-25 14:44）；`v0.8.x` 已經 T0921 併回 `main` 並 push（D343 / D345）。D331：只有改到安裝路徑的版本才做 NSIS 重裝驗收。發佈後驗收（linux / macos / docker acceptance、WSL smoke）視需要另取授權"
  - "PLAN-066（DONE）後續候選（未開單）：`pty:create` 只送 env 差異（`pty-manager.ts`＋Terminal Server 協定）可再降 C2①；direct 模式的 conin socket 殘留；F4（自然結束的 conhost 留到 server 結束）。分支：`ct/T0885`（Rust 評估，D307 保留不合併，worktree 保留）、`ct/T0886`（node-pty Worker 研究，未併入 `v0.8.x`，worktree 已移除）"
  - "PLAN-065 剩餘：per-machine 未提權互動升級（UAC）手動驗收（無法自動化）；降級到 `0.7.4-pre.9` 會結束所有終端且沒有說明（已寫在更版重點〈已知事項〉）"
  - "PLAN-052（IN_PROGRESS）：待 Docker Desktop（Windows / macOS）實機走精靈；後續候選（未開單）：fetch-fingerprint Docker 分支比對憑證指紋、`scripts/docker-acceptance.mjs` 純函式單元測試"
  - "PLAN-058：T0819 安裝版 pre.5 假 API e2e PASS，待使用者手動確認（清單在 T0819 回報區）；可選後續：卡片等待時讓輸入框可送出（T0815〈遭遇問題〉1，未開單）"
  - "待實機驗收：T0827 Linux AppImage 缺字型提示（回報區〈待實機驗收〉4 項）；T0830 真 WSL 的 install-bundle 中止與 keep-alive 關閉後閒置關機；PLAN-038 實機 6 項（T0836 回報區〈待實機驗收〉）；T0840 精靈在真的 BAT 視窗對拋棄式發行版從頭跑一次；T0841「改用 Mirrored 並重試」實機"
  - "候選（未開單，D303 暫不安排）：T0830 後續 SSH / Docker 精靈長呼叫接 operation id；PLAN-052 fetch-fingerprint Docker 分支、docker-acceptance 純函式測試；PLAN-058 卡片等待時可送出（2026-11-20 使用者：先記著、不開單。只涉 Claude Agent 面板（SDK），不影響 Claude CLI 分頁；要做時的建議：輸入框預設收合＋「補充說明」按鈕展開、輸入框有焦點時停用卡片快捷鍵（權限卡在 window 監聽 1/2/3、y/n、Enter、方向鍵）、送出走 T0815 排隊路徑；需實機操作確認）"
  - "MSRC 回報 microsoft/node-pty（使用者自行處理，D255）"
  - "觀察：語音可用性檢查 macOS 未實機（`unknown(timeout)` 出現可把逾時提到 30 s，T0802）；t0757 偶發失敗再發生才開 BUG（D218）；PLAN-060（IDEA）macOS Developer ID 簽章"
  - "版號線：D315 起 `0.8.0-pre.N`（D344 起從 `main` 發；pre.1–pre.3 從 `v0.8.x` 發），pre.2 已發佈（2026-11-25），`0.8.0-pre.3` 已發佈（2026-11-25 14:44，PLAN-068 待辦分頁＋BUG-220–222，D339；CT 6.1.0 同日發佈），下一版 `0.8.0-pre.4`（`-pre.N` 最多到 pre.9）；`0.7.5` 線最後是 pre.2"
  - "候選（未開單）：`_decision-log.md` 索引表只到 D129（D130–D315 沒有索引列，BAT 決策清單看不到），需重建索引（D316 記錄）"
reminders:
  - id: "weekly-log-review"
    title: "每週日誌清查（PLAN-067；到期時塔台開工會提示，只提示不派工）"
    ref: "PLAN-067"
    last_at: "2026-11-25"
    due_at: "2026-12-02"
---
# Tower State — better-agent-terminal

> 🟢 **第一百三十二 session 開工**（2026-11-25 20:19 (UTC+8)，CT v6.1.1，Fast Path；塔台 session `5af58859-9dbd-47ab-8770-3e8ad396b11e`；`main` = `origin/main` @ `7f5c7ebc`（fetch 後 0 / 0）、工作區乾淨、無 stash；worktree 剩 `T0885` 與 `.ct-integration`；`--set-role tower --bat-contract 2 --mode on` exit 0 → `bat-contract: 2`、`hooks: ok (injected, set 2)`；BAT helper `0.8.0-pre.3`；熱區 T:317（非終態 0）/ BUG:86（CLOSED 85 / WONTFIX 1）/ PLAN:33（IN_PROGRESS 7）/ EXP:1，與索引一致；PLAN-067 週清查未到期（2026-12-02））。 20:28 使用者問待辦分頁是否保留推薦項與自由輸入（自由回答在、推薦項不在）→ 裁示推薦項慣例＋契約欄位都要，另加放棄 / 批次放棄（兩區、勾選＋全部、放棄後停下等新方向）→ D346 開 PLAN-069（PLANNED），HANDOVER 給 CT 塔台協商契約。 20:33 CT 回覆草案（CT D885，待 CT 使用者核定）：同意 C-1–C-4，C-5 改維持契約 2 ＋ `inbox_features`；BAT 已答 Q1（舊 BAT 忽略未知鍵）/ Q2（`0.8.0-pre.4`、同意），等 ACCEPTED。 20:36 CT 受理（CT D886、CT T0566）。 20:45 使用者問 `user_inbox: off` 與原生選單 → D347 補充需求 R6（暫停時可改用原生選單的 CT 設定鍵），通知 CT 併入 6.2.0。 20:47 CT R6 草案（CT D887 待核定）：沿用 `interactive-prompts` 擴及暫停，BAT 無異議。 20:49 CT 核定 R6（CT D888），併入 CT T0566（6.2.0-pre.1）；等 T0566 收單後的規範位置與範例狀態檔，再開 BAT T0922。 20:57 CT T0566 收單（CT D889，規範 CT `7ea750f`）→ 開 T0922（PLAN-069 → IN_PROGRESS），隔離派工。 20:59 派出 T0922（`--mode on --isolation worktree`，exit 0、`started: 2026-11-25T12:59:16.685Z`；分頁 `35af16c3…`，worktree `.bat-worktrees/better-agent-terminal/T0922`、分支 `ct/T0922`、base `a2c219ab`）。 21:13 T0922 收單 DONE（D348）：產品 commit `0675d9fd`（17 檔，皆在 `affects_files` 內，`_ct-workorders/**` 未動）；test:unit 9037 passed / 497 files、test:legacy 472 / 33、vite build、typecheck 0 / 0；session id 已在；session 快照略過（本 session 未跑 `*insights sessions`）；`--close-worker T0922 --delay-ms 10000 --worktree keep` exit 0。模式 ① 判準 5 條 PASS（main 只多 `_ct-workorders/**`、validated = head、範圍外 0、`merge-tree` 無衝突、worktree 與主 checkout 乾淨）→ 整合分支 `ct-merge/T0922` `--no-ff` → `9bbd42fa`（parent1 `a4f7fcd6` = base、parent2 `0675d9fd`；產品樹 = head）。斷點 E（非 yolo）→ U-6。 21:14 U-6 → A（D349）：整合分支再併 `main` 記帳 commit（`728c3197`）→ `main` ff 到 `728c3197`（④ PASS）；整合 worktree detach；`--close-worker … --worktree remove` exit 3（分頁已關）→ 手動 `git worktree remove`（乾淨）；分支 `ct/T0922`、`ct-merge/T0922` 保留。驗收用哪個 BAT → U-7。 21:16 U-7 → A（D350）：去識別 9 條樣式 0、金鑰樣式 0 → push `main` `7f5c7ebc..402c9648`；`desktop-build.yml` run `45621864786`（ref `402c9648`、版號 `0.8.0-exp.1`，只打包不發佈）；Pages run `45621849988` 同時觸發（`site/tower-inbox.md` 新段先上線）。 21:17 CT 問 exp.1 是否覆蓋安裝版 → 答：用 zip＋`launchIsolated` 隔離 runtime，不碰安裝版 `0.8.0-pre.3`。 21:20 CT 決定 P2 比照 6.1.0（CT D890）：CT T0567 準備 `ct620-accept/`（claude-config、`ct-swap.py`、checklist M-1–M-15），情境 S1（exp.1×6.2.0-pre.1）/ S2（pre.3×6.2.0-pre.1）/ S3（exp.1×6.1.1）/ S4（M-15：pre.1 zip、`interactive-prompts: off`、Codex）；三個 BAT zip 由 BAT 負責。T0567 收單＋使用者在 claude-config 登入後，CT 通知 → 開 BAT 驗收單 T0923。 21:31 CT T0567 收單（CT D891，checklist SHA-256 `d7546b35…`）→ 寫好 T0923（隔離 worktree、per-dispatch yolo 照 T0915 前例），等 CT 通知使用者已登入測試 config ＋ desktop-build `45621864786` 完成後派工。 21:32 CT 通知使用者已登入（CT D892）→ T0923 補〈塔台補充（派工前）〉（帳號檔不得複製）。 21:36 desktop-build `45621864786` 完成：四個 build 全綠、`tests` job 1 失敗（`verify-packaged-native.test.mjs` asar 往返讀到全 NUL，與 T0922 無關）→ 開 BUG-223（OPEN low）→ U-8。21:36 派出 T0923（`--mode yolo --no-interactive --isolation worktree`，exit 0、`started: 2026-11-25T13:36:44.974Z`；分頁 `5be5d859…`，worktree `.bat-worktrees/better-agent-terminal/T0923`、base `7b23aa55`）。 21:38 U-8 → A（D351）：BUG-223 → FIXING，開 T0924（隔離，與 T0923 無檔案重疊），派工。 21:39 派出 T0924（yolo，`started: 2026-11-25T13:39:26.210Z`，base `beb44842`）。 21:52 T0924 收單（D352）：Worker 填 `FIXED` → 塔台改 `DONE`；`1eb8f5ee` 只改測試檔（等 `@electron/asar` 寫入串流 `finished`，斷言不變），120/120、test:unit 9037、legacy 472、build、typecheck 0 / 0；BUG-223 → FIXED；`--close-worker T0924 … --worktree keep` exit 0；模式 ① `ct-merge/T0924` → `6dcb62ca`（parent1 `16dafed2`、parent2 `1eb8f5ee`）→ 斷點 E U-9。 21:53 U-9 → A（D353）：整合分支再併 `main` 記帳 commit → `68faa1d3`，`main` ff 到 `68faa1d3`（④ PASS）；整合 worktree detach；T0924 worktree 手動移除（乾淨）；分支保留。T0923 驗收仍在跑。 23:02 T0923 收單 DONE（D354）：M-1～M-15 BAT 端 0 FAIL、M-15c 未觸發（無 Codex 環境）；M-10 清單步驟與舊 BAT UI 不符，改經 IPC 送 `U-2：放棄`（待 CT 確認）；新增 `e2e/manual/ct-accept-act.mjs`（`3d7ae5d2`）；使用者層 1,191 檔雜湊不變、程序 0 殘留。發現 → 開 BUG-224（OPEN medium）→ U-10。`--close-worker T0923 … --worktree keep` exit 0。合併：判準 1 不成立（`main` 多了 T0924 的測試檔）→ 依規則派合併工單 T0925（模式 ②）。 23:03 派出 T0925（`--mode on`，非隔離，`started: 2026-11-25T15:03:49.890Z`）；通知 CT 做 CT 端判定（含 M-10 偏離與 4 點觀察）。 23:04 U-10 → A（D355）：BUG-224 → FIXING，開 T0926（隔離、yolo），pre.4 / CT 6.2.0 同日發佈延到 T0926 合併後。 23:05 派出 T0926（`started: 2026-11-25T15:05:36.149Z`，base `4e562519`）；CT T0568 做 CT 端判定（CT D895）。 23:07 T0925 收單 DONE（D356）：merge `16cf8451`（parent1 `230dade2` = base、parent2 `3d7ae5d2` = T0923 validated），無衝突、樹比對只有 `e2e/manual/` 2 檔、test:unit 9038、legacy 472、build、typecheck 0 / 0；`--close-worker T0925` exit 0 → 斷點 E U-11。 23:08 U-11 → A（D357）：整合分支再併 `main` 記帳 → `b21a5a61`，`main` ff 到 `b21a5a61`（④ PASS）；整合 worktree detach；T0923 `--close-worker … --worktree remove` exit 3 → 手動移除（乾淨）；分支保留。進行中：T0926（BUG-224）、CT T0568。 23:15 CT 端判定完成（CT T0568 / D896）：44 判定 PASS 41 / FAIL 1（M-12-3，3 選項選單沒加「放棄」，CT 規範歧義）/ 未觸發 2（M-12-4b、M-15c）；M-10 偏離接受；4 點觀察屬實（1 = checklist 錯，2–4 = CT 規範），BAT 不需修改。CT T0569 出 6.2.0-pre.2（規範 R1–R6、新設定 `pending_reminder`、`checklist-rerun.md`）→ 收單後 BAT 用 `0.8.0-exp.2`（含 BUG-224 修正）跑補跑（約 4 回合；驅動要加「選單選最後一項」「在『其他』輸入文字」）。 23:15 T0926 收單 DONE（D358）：`2781c81e`（4 檔，範圍內），同一 AskUserQuestion 晚到的第二個 hook 在回答後 5 s 內不設回；14 新測試、既有不改、test:unit 9046、legacy 472、build、typecheck 0 / 0；BUG-224 → FIXED；`--close-worker T0926 … --worktree keep` exit 0。合併判準 1 不成立（`main` 多了 T0925 的 `e2e/manual/`）→ 合併工單 T0927（模式 ②，無衝突）。 23:16 派出 T0927（`--mode on`）。 23:22 T0927 收單 DONE（D359）：merge `9843fa9e`（parent1 `5d891249` = base、parent2 `2781c81e` = T0926 validated），樹比對 4 檔、範圍外 0、test:unit 9052 / 498、legacy 472、build、typecheck 0 / 0；`--close-worker T0927` exit 0 → 斷點 E U-12（含 push＋打包 exp.2）。 23:23 U-12 → A（D360）：`main` ff 到 `a65c0958`（④ PASS）；整合 worktree detach；T0926 worktree 手動移除（乾淨）；分支保留；去識別 9 條＋家目錄固定字串 0、金鑰 0 → push `main`，`desktop-build` 打包 `0.8.0-exp.2`。

> 🛏 **第一百三十一 session 收工**（2026-11-25 18:58 (UTC+8)）。

> 🟢 **第一百三十一 session 開工**（2026-11-25 16:05 (UTC+8)，CT v6.1.1，Fast Path；塔台 session `43c82f3f-de60-4c70-b5fb-f190e8698511`；`main` = `origin/main` @ `7deb824c`、`v0.8.x` = `origin/v0.8.x` @ `4ce779ee`、工作區乾淨、無 stash；worktree 剩 `T0885` 與 `.ct-integration`；熱區 T:316 / BUG:86 / PLAN:33 / EXP:1）。frontmatter 升契約 v2（`bat_contract: 2`、`ct_version`）；`todo` 兩項搬家：PLAN-068 實機驗收 → `user_actions` A-1、PLAN-067 → `reminders`。開工核對（R-G003）：T0916／T0918 frontmatter 仍 `FIXED`（BUG-220／222 已於 D338 CLOSED）→ 塔台收尾改 `DONE`；BUG-216–219 仍 `FIXED`（已隨 pre.2／pre.3 交付）→ 結案方式交使用者（U-1）。 16:11 U-1 → A（D340）：BUG-218／219 CLOSED（pre.2 run `45460440287`／pre.3 run `45560094561` `tests / unit-tests` 綠）；BUG-216／217 維持 FIXED → `user_actions` A-2／A-3；`_bug-tracker.md` FIXED 2 / CLOSED 83，parser 測試 65 passed。 16:30 `A-3：完成`（經 BAT 待辦分頁）→ D341 BUG-217 CLOSED（安裝版 `0.8.0-pre.3`；本次日誌沒有 `[ct-overview]` 行，無反證，依回報結案）；tracker FIXED 1 / CLOSED 84。 17:08 外部測試者回報：從 GitHub main「Download ZIP」打包 macOS，結果是舊程式（main `package.json` `0.7.5-pre.2`，但 `CHANGELOG.md`／`release-note.md` 已寫 pre.3）。原因：D307 起產品程式只在 `v0.8.x`，main 只有塔台紀錄與發版文件（main 領先 174 個 commit 幾乎都是 `_ct-workorders/`，`v0.8.x` 領先 54；`merge-tree` 試合併有衝突）。已給使用者回覆稿（用 Release 的 dmg 或 `v0.8.0-pre.3` 的 Source code）；防範方式交使用者（U-2）。 18:42 U-2 → B（D342）：現在把 `v0.8.x` 併回 `main` → 開 T0921（合併工單模式 ②，整合 worktree，只有 `CHANGELOG.md` 衝突；不 push、ff 經斷點 E）。`base_main_sha` `5699a2aa`。18:43 派出 T0921（`--mode on`，非隔離，exit 0、`started: 2026-11-25T10:43:05Z`）。 18:46 T0921 收單 DONE（模式 ②）：merge `f9375c2c`（parent1 `5699a2aa` = base、parent2 `4ce779ee` = `v0.8.x`）；`CHANGELOG.md` 採 `main` 版（兩邊 `[0.8.0-pre.3]` 逐字相同，`main` 多 pre.2／pre.1 段）；樹比對對 `4ce779ee` 只差 `CHANGELOG.md`、`release-note.md`、`_ct-workorders/**`；typecheck 0 / 0、vite build、test:unit 第一次即綠 9001、verify:helpers、網站建置 exit 0（新頁 `site/tower-inbox.md`）；範圍外檔案無。session id 已在、session 快照已寫；`--close-worker T0921 --delay-ms 10000` exit 0。SHA 比對 ①–③ PASS；⑤ main 只多 `_ct-workorders/**` → 整合分支 `--no-ff` 併 main → `8c173c2c`（main 為祖先）。18:47 斷點 E（非 yolo）→ U-3。 18:53 U-3 → A（D343）：整合分支再併一次 `main` 的記帳 commit → `git merge --ff-only ct-merge/T0921` → **`main` = `f967f9db`**（④ PASS，`package.json` `0.8.0-pre.3`）；整合 worktree detach；PLAN-066 DONE。未 push（領先 67）→ U-5；之後的分支用法 → U-4。 18:54 U-4 → A（D344）：產品改動回到 `main`（取代 D307 分流），`v0.8.x` 保留不再使用，下一版從 `main` 發。 18:55 U-5 → A、A-1 / A-2 完成（D345）：去識別 0、金鑰樣式只有既有測試假字串 → push `main` `7deb824c..2cac17e5`（Pages run `45599547166`）；PLAN-068 DONE；BUG-216 CLOSED（熱區未結 BUG 0）；`user_actions` 清空。

> 最後更新:2026-11-25 18:58 (UTC+8) — **第一百三十一 session 收工**：`v0.8.x` 經 T0921 併回 `main` 並 push（D342–D345），產品改動回到 `main`（D344）；PLAN-066、PLAN-068 DONE；BUG-216–219 CLOSED（熱區未結 BUG 0）；`_tower-state.md` 升契約 v2；第一百二十九、一百三十 session 紀錄搬到 `2026-Q4-c.md`。
>
> **下次起手**:熱區無進行中工單、無未結 BUG、無待你決定 / 待你執行。下一版 `0.8.0-pre.4` 從 `main` 發（D344）。候選見 frontmatter `todo`；PLAN-067 週清查 2026-12-02 到期。

---

## 🛏 本 Session 收工快照 (第一百三十一 session, 2026-11-25 16:05 - 2026-11-25 18:58)

### 主軸：契約 v2 升級、開工核對、`v0.8.x` 併回 `main`

#### 重點（時間取自系統 / git）

1. 開工：`_tower-state.md` 升 BAT ↔ CT 契約 v2（`bat_contract: 2`、`ct_version: "6.1.1"`、`awaiting_user` / `user_actions` / `reminders`）；`--set-role tower --bat-contract 2` → `bat-contract: 2`、`hooks: ok`
2. 開工核對（R-G003）：T0916 / T0918 `FIXED` → `DONE`；BUG-216–219 結案方式 U-1 → D340（218 / 219 CI 結案）；A-3 → D341（BUG-217）；A-2 → D345（BUG-216）
3. 外部測試者從 `main`「Download ZIP」拿到舊程式 → U-2 → D342 開 T0921（合併工單模式 ②，只有 `CHANGELOG.md` 衝突，採 `main` 版）→ U-3 → D343 ff `main` `f967f9db`；PLAN-066 DONE
4. D344：產品改動回到 `main`（取代 D307），`v0.8.x` 保留不再使用
5. D345：去識別 / 金鑰掃描 PASS → push `main` `7deb824c..2cac17e5`；Pages `45599547166` 綠、link-check 1633 / 0；A-1 → PLAN-068 DONE

### 本輪戰績
- 工單 1（T0921）；決策 D340–D345；BUG 結案 4（BUG-216–219）；PLAN 結案 2（PLAN-066、PLAN-068）；發版 0

### 編號起始（下 session）
- **T0922** / **BUG-223** / **PLAN-069** / **D346** / **U-6** / **A-4**

---

## 🛏 前 Session 收工快照 (第一百三十 session, 2026-11-25 00:28 - 2026-11-25 15:25)

- PLAN-068（GitHub #24）W0–W9 實作、T0915 自動驗收、BUG-220–222 修正與 T0920 補驗；`v0.8.0-pre.2`（D324）、`v0.8.0-pre.3`（D339，CT 6.1.0 同日）發佈；BUG-218 / 219（測試穩定度）修正；PLAN-067 開單。完整逐條紀錄已搬到 [`_archive/state-snapshots/2026-Q4-c.md`](_archive/state-snapshots/2026-Q4-c.md)。

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-11-25 18:58 UTC+8（第一百三十一 session 收工）

### 近期完成
- **`v0.8.x` 併回 `main`**（第一百三十一 session，T0921，D342–D345）：`main` 是 `0.8.0-pre.3`，產品改動回到 `main`（D344）
- **PLAN-068 DONE**：待辦分頁 / 回合訊息卡 / 通知保護（`v0.8.0-pre.3`，CT 6.1.0）；**PLAN-066 DONE**（共用 conout Worker）
- BUG-216–222 全部 CLOSED，熱區未結 BUG 0

### 待辦（依優先序；完整內容見 frontmatter `todo`）
1. 下一版 `0.8.0-pre.4` 從 `main` 發；發佈後驗收（linux / macos / docker、WSL smoke）視需要授權
2. PLAN-065 per-machine UAC 互動升級手動驗收；PLAN-052 Docker Desktop 實機精靈；PLAN-058 手動確認；其他待實機項
3. 候選（未開單）：PLAN-066 後續、決策日誌索引重建、D303 暫不安排的項目
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
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 0 / Fixing 0 / Fixed 0 / Closed 85 / WONTFIX 1）｜ Backlog → [_backlog.md](_backlog.md)（IN_PROGRESS 7 / DONE 21）
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D345；D001～D185 封存在 `_archive/decisions/`）｜ Learnings → [_learnings.md](_learnings.md)（最大 L185）
- PLAN-068 網頁版使用說明 → https://claude.ai/artifact/8mepgGP16ghS3m9hsu2Wst（私人）
- 網站 → https://gowerlin.github.io/better-agent-terminal/
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（150 entries；最新 `2026-Q4-c.md`）

### 編號起始
- **T0928** / **BUG-225** / **PLAN-070** / **D361** / **U-13** / **A-4** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L186** / **CT-T023**

---


## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | `main` `package.json` **0.8.0-pre.3**（`v0.8.x` 已併回，D343）；下一版 **`0.8.0-pre.4`**（從 `main` 發，D344） |
| **最新 release** | `v0.8.0-pre.3`（2026-11-25 14:44 (UTC+8)，Pre-Release `45560094561`，`5e541975`）；前一 tag `v0.8.0-pre.2`；更早見 `release-note.md` / `CHANGELOG.md` |
| **目前主軸** | 無派工中工單；下一版 `0.8.0-pre.4` 從 `main` 發 |
| **工單最大編號** | **T0921** DONE；熱區 317 張全 DONE |
| **BUG 最大編號** | **BUG-222** CLOSED；熱區 Open 0 / Fixing 0 / Fixed 0 / Closed 85 / WONTFIX 1 |
| **PLAN 最大編號** | **PLAN-068** DONE；IN_PROGRESS 7（038 / 043 / 052 / 058 / 064 / 065 / 067）；IDEA 3 |
| **決策最大編號** | **D345**（push `main`、PLAN-068 / BUG-216 結案，第一百三十一 session） |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v6.1.1**（第一百三十一 session 起；BAT ↔ CT 契約 v2） |
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
