---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
ct_version: "6.3.0"
inbox_features: ["recommended", "dismiss", "multi"]
updated_at: "2026-11-28T15:13:12+0800"
session: "2026-11-28 11:59 第一百四十 session 塔台重新開工（CT v6.3.0，BAT 0.8.1-pre.3）"
next_ids:
  workorder: "T0970"
  decision: "D498"
  bug: "BUG-238"
  plan: "PLAN-071"
  user: "U-67"
  action: "A-27"
user_actions:
  - id: "A-26"
    title: "裝 `v0.8.1-pre.4`：塔台閒置時從待辦分頁回答會立即送出，不再卡在「待送」（BUG-235）"
    ref: "T0964"
    kind: "verify"
    created_at: "2026-11-28T14:01:43+08:00"
user_actions:
  - id: "A-26"
    title: "裝 `v0.8.1-pre.4`：塔台閒置時從待辦分頁回答會立即送出，不再卡在「待送」（BUG-235）"
    ref: "T0964"
    kind: "verify"
    created_at: "2026-11-28T14:01:43+08:00"
awaiting_user:
  - id: "U-65"
    workorder: "T0969"
    kind: "decision"
    source: "breakpoint-E"
    summary: "T0969（CT 6.4.0 雙方驗收的 e2e/manual 驅動 3 檔）合併：`ct-merge/T0969` `4867b219` 要 ff 進 `main` 嗎"
    options: ["A 現在 ff 進 main（推薦）", "B 暫不合併"]
    recommended: "A"
    created_at: "2026-11-28T15:05:12+08:00"
  - id: "U-66"
    workorder: ""
    kind: "decision"
    source: "tower-question"
    summary: "BUG-237（low，選單提示行不看 `opened_at`）要怎麼處理"
    options: ["A 開單修，放進下一版 0.8.1-pre.5（推薦）", "B 只記候選，等更多實機回報"]
    recommended: "A"
    created_at: "2026-11-28T15:05:12+08:00"
todo:
  - "CT 6.4.0-pre.1 × BAT `0.8.1-pre.4` 雙方驗收 T0969 DONE、合併進 `main` `59e4fbeb`（未 push）；CT 判定單 CT T0584 進行中，收單後傳判定與修正建議（D496 / D497）"
  - "🟡 BUG-235（medium，FIXED）：隨 `v0.8.1-pre.4` 發佈（D494），A-26 實機確認後 CLOSED（再發生時看 `[notify-hold] draft set … cause=`）"
  - "✅ BUG-236 CLOSED（D496）；🟢 BUG-237（low，OPEN）U-66：A → 等 CT T0584 判定後與 BAT 配合項合成一張工單，進 `0.8.1-pre.5`（D497）"
  - "候選（未開單，T0965 建議）：只剩選單紀錄（`question` 已被清除）時 Worker 通知仍照舊直接寫入，可能打進開著的選單；待 CT `menu_open`（D484）工單一起評估"
  - "✅ T0966（U-58：A）合併進 `main` `64b39176`（D485）：Worker 等你不再算回答；T0965 收單時 `main` 已有 T0966 產品改動 → 依 `--worktree-status` 判斷，多半派合併工單"
  - "✅ `v0.8.1-pre.4` 發佈（D494）：BUG-235 / 236、T0966、T0968；下一版 `0.8.1-pre.5`"
  - "✅ BUG-234 CLOSED（`v0.8.1-pre.3` 實機，A-25，D475）"
  - "🗄 `_decision-log.md` 407 KB 超過 400 KB 預算：開工後封存舊決策（D186 起，照 `_archive/decisions/` 既有做法）"
  - "✅ `v0.8.1-pre.2`（D461）／`v0.8.1-pre.1`（D449）：BUG-228–233 全部 CLOSED（交付版自動化驗收 T0955 / T0959、Linux CI T0961）；T0950 PASS。下一版 `0.8.1-pre.3`（目前只多測試：T0960 改名、T0961 Linux spec）"
  - "✅ `v0.8.0` 正式版（D425）：T0944 塔台分頁自動帶入 `/control-tower`（Git Bash 下的問題已由 BUG-228 修正）"
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
  - "版號線：D425 後 `0.8.1-pre.N`（從 `main` 發），`0.8.1-pre.3` 已發佈（2026-11-28 11:52，D474），下一版 `0.8.1-pre.4`（`-pre.N` 最多到 pre.9；需要第十個預覽版時先與使用者確認改版號線）"
reminders:
  - id: "weekly-log-review"
    title: "每週日誌清查（PLAN-067；到期時塔台開工會提示，只提示不派工）"
    ref: "PLAN-067"
    last_at: "2026-11-25"
    due_at: "2026-12-02"
---
# Tower State — better-agent-terminal

> 🛏 **第一百三十九 session 收工**（2026-11-28 00:17 (UTC+8)，CT v6.3.0；塔台 session `50ee1132-deeb-462b-b7a2-66cab13fa056`）。第一百三十六～一百三十九 session 的開工／過程紀錄已搬到 [`_archive/state-snapshots/2026-Q4-d.md`](_archive/state-snapshots/2026-Q4-d.md)。

> 最後更新:2026-11-28 00:17 (UTC+8) — **第一百三十九 session 收工**：`v0.8.0` 實機驗收發現 BUG-228–231 → 修正、發 `v0.8.1-pre.1`；後續 BUG-232 / 233＋T0950 → 發 `v0.8.1-pre.2`；交付版以隔離實例＋假 claude（T0955 / T0959）與 Linux CI（T0961）自動化驗收，BUG-228–233 全部 CLOSED；`main` = `origin/main` @ `975c0ca6`。
>
> **下次起手**:熱區無進行中工單、無未結 BUG、無待你決定 / 待你執行。`_decision-log.md` 407 KB 已超過 400 KB 預算 → 建議開工後先封存 D186 起的舊決策；`_tower-state.md` 約 30 KB。PLAN-067 週清查 2026-12-02 到期。

---

## ▶ 第一百四十 session 開工（2026-11-28 11:04 (UTC+8)）

- 塔台 session `2d6e85cc-593c-4c77-a90e-cdc0514eabba`；CT v6.3.0；BAT `0.8.1-pre.2`，`--set-role tower --bat-contract 2 --mode on` exit 0（`bat-contract: 2`、`hooks: ok (injected, set 2)`）
- Fast Path；`main` = `origin/main` @ `ce625352`；熱區 T:358 / BUG:97 / PLAN:35 / EXP:1；無進行中工單、無待你決定 / 待你執行
- 大小：`_decision-log.md` 407,309（> 400 KB 預算）、`_learnings.md` 225,837、`_tower-state.md` 約 25 KB
- 11:06 塔台重新開工：新塔台 session `53bde29b-785a-4c1c-b5e8-68748009fcb2`（分頁 `c2f1a2e3…`，原 role `shell`），`--set-role tower --bat-contract 2 --mode on` exit 0（`bat-contract: 2`、`hooks: ok (injected, set 2)`）；`main` @ `8efe9ae3`、工作樹乾淨；PLAN-067 上次清查 2026-11-25（3 天，未到期）
- 11:09 使用者回報 pre.2 自動恢復後鍵盤無法輸入（已退回 pre.1）→ BUG-234 high FIXING、T0963（D471）；11:11 派工 `--mode yolo --no-interactive --isolation worktree --wait-started 30000` exit 0，`started: 2026-11-28T03:11:19Z`，分頁 `edae5fb0…`，worktree `ct/T0963` base `763ca8c2`
- 11:25 T0963 DONE（`45a9427c`）：原因是 T0951 的 `writeLaunchCommand` 在「命令前沒打字」時沒刪空的保留清單，之後所有按鍵被保留；pre.1 也有（退回 pre.1 能用是因為分頁都是接回）。收單 `--close-worker --delay-ms 10000 --worktree keep` exit 0；`--worktree-status` 五條全成立 → 模式 ①：`ct-merge/T0963` `da4f8067`（parent1 `f8429161`、parent2 `45a9427c`，產品樹 = head）；斷點 E → U-55、發版 → U-56（D472）
- 11:28 U-55：A、U-56：A → `main` 只多 `_ct-workorders/**` → 整合分支再合併 `main` 後 ff，`main` = `6fd50e00`；T0963 worktree 移除（分支 `ct/T0963`、`ct-merge/T0963` 保留）；BUG-234 FIXED；發 `0.8.1-pre.3`（D473）
- 11:54 `v0.8.1-pre.3` 發佈（Pre-Release `46103078102` success，`ba010838`，2026-11-28 11:52；資產 4 個同 pre.2）；更版重點已改寫；CHANGELOG / release-note / package 版號 commit＋push；A-25 待你實機（D474）
- 11:59 塔台重新開工：塔台 session `c3c72160-0d57-4614-8800-6e952c8e484d`（分頁 `f32bfa46…`，`better-agent-terminal · Tower`）；BAT 已是 `0.8.1-pre.3`（`bat-terminal.mjs --version`）；`--set-role tower --bat-contract 2 --mode on` exit 0（`bat-contract: 2`、`hooks: ok (injected, set 2)`）；`main` = `origin/main` @ `c8fdac6c`、工作樹乾淨；熱區 T:359 / BUG:98 / PLAN:35；無進行中工單；`_decision-log.md` 412,091 bytes（> 400 KB 預算）
- 12:02 使用者：「鍵盤可輸入了」＋ A-25：完成 → BUG-234 CLOSED（D475）；同時回報待辦分頁按「完成」後卡在「已排入待送」、要等自己送出下一則才送到（送了兩次）、「無法送出」→ BUG-235 medium FIXING、T0964（D476）
- 12:04 T0964 派工 `--mode yolo --no-interactive --isolation worktree --wait-started 30000` exit 0，`started: 2026-11-28T04:03:58Z`，分頁 `6991ade8…`，worktree `ct/T0964` base `4d003c6a`
- 12:13 [提問] T0964 Q-1（draft 觸發來源重現不了：日誌與實驗排除焦點 / 滑鼠 / 滾輪回報、launch 保留、啟動參數，只剩使用者真的按的鍵）→ 塔台答 B（`--answer --choice 2` exit 0）：診斷日誌（只記類別）＋去重＋契約 2 claude 塔台 `user-prompt-submit` 時清掉送出前的 draft（不得清掉送出後新打的字）；本單可回 DONE，BUG-235 收單時判 FIXED 待實機
- 12:17 [提問] T0964 Q-2（B 的接線要動 `electron/main.ts`、`electron/remote/headless-entry.ts`，不在 affects_files）→ 塔台答 A（`--answer --choice 1` exit 0）：各加一行接線、其他不動；兩檔補進工單 affects_files
- 12:23 T0964 DONE（`511b547e`，test:unit 9452 passed）；收單 `--close-worker --delay-ms 10000 --worktree keep` exit 0；`--worktree-status` 五條全成立 → 模式 ①：`ct-merge/T0964` `3837c663`（parent1 `77b7567e`、parent2 `511b547e`）；斷點 E → U-57、「Worker 等你」措辭後續 → U-58（D477）
- 12:25 U-57：放棄、U-58：放棄（原生選單，未附原因）→ 不 ff、不開單，兩項暫停等新方向（D478）
- 12:27 使用者截圖：待辦分頁 12:24 已送 `U-57：A`（`sent`，選單開著時被打進選單）→ 選單結果「放棄」不可靠：D478 作廢、U-57 / U-58 重問；開 BUG-236（medium，OPEN）；修法方向 U-59（「兩邊都能答」）；本次不開原生選單，改文字＋待辦分頁（D479）
- 12:31 U-57：A（終端文字）→ `ct-merge/T0964` 再合併 `main`（只多 `_ct-workorders/**`）後 ff，`main` = `ee5d364f`（產品樹 = `511b547e`，未 push）；整合 worktree detach；T0964 worktree 手動移除（`--close-worker --worktree remove` exit 3）；BUG-235 FIXED（D480）
- 12:32 U-58：A、U-59：A → BUG-236 FIXING；開 T0965（BUG-236：選單開著時 Esc 關選單再送文字）、T0966（「Worker 等你」不算回答），兩張只在 `docs/agent-guide/tower-inbox.md` 重疊（不同段落，接受並行）（D481）
- 12:34 T0965 / T0966 派工 `--mode yolo --no-interactive --isolation worktree --wait-started 30000` 皆 exit 0：T0965 `started: 04:33:55Z` 分頁 `2c447e92…`；T0966 `started: 04:33:58Z` 分頁 `3459f98b…`；base `b389f16c`
- 12:38 [提問] T0966 Q-1（保留原因要知道哪一筆回答仍在佇列，需改 `src/lib/inbox-answer.ts`、`src/stores/inbox-sent-store.ts`）→ 塔台答 A（`--answer --choice 1` exit 0）：只加選用欄位、IPC 與主行程不變；兩檔補進 T0966 affects_files（與 T0965 不重疊）
- 12:42 使用者：「如果 CT 配合修改，可以更好控制，可協調 CT 塔台配合」→ 寫 `_handover-2026-11-28-inbox-menu-handoff.md`（`7cec7ce6`，C-1 選單含哪些 U-n 的 frontmatter 欄位、C-2 中斷後剩下的題、C-3 `inbox_features` 宣告、C-4 開工清殘留），SendMessage 給 `BMad-Guide · Tower`（ListAgents 第 1 步命中）已送達收件匣；T0965 範圍不變（舊 CT 也能用），CT 回覆後另開工單讀欄位（D482）
- 12:43 T0966 DONE（`737a378c`，test:unit 9471 passed）；收單 `--close-worker --delay-ms 10000 --worktree keep` exit 0；五條全成立 → 模式 ①：`ct-merge/T0966` `d76ec16e`（parent1 `6031a363`、parent2 `737a378c`）；T0965 加〈塔台補充（執行中 #1）〉（新原因值可補 `notifyHoldReasonKey`）並 SendMessage 提示重讀；斷點 E → U-60（D483）
- 12:45 CT 塔台（`BMad-Guide · Tower`）回覆：受理，回覆稿 `BMad-Guide/_ct-workorders/_reply-2026-11-28-inbox-menu-handoff.md`（CT `cc5a8dd`、D925）DRAFT 待 CT U-10；C-1–C-4 全採（C-2 定為不重開、C-4 放寬為只在開選單前寫一次），CT 6.4.0（先 pre.1），不升 `bat_contract`；T0965 不必等（D484）
- 12:46 U-60：A → `ct-merge/T0966` 再合併 `main`（只多 `_ct-workorders/**`）後 ff，`main` = `64b39176`（產品樹 = `737a378c`，未 push）；整合 worktree detach；T0966 worktree 手動移除（`--close-worker --worktree remove` exit 3）（D485）
- 12:48 T0965 DONE（`e5a0ad16`，test:unit 9479 passed；原因：滑鼠按下清掉 `question`、選單仍開著）；收單 `--close-worker --delay-ms 10000 --worktree keep` exit 0；`main` 已有 T0966 產品改動 → 判準 1 不成立 → 合併工單 T0967（模式 ①，`merge-tree` 無衝突）（D486）
- 12:49 T0967 派工 `--mode yolo --no-interactive --wait-started 30000`（不隔離，整合 worktree）exit 0，`started: 04:48:51Z`，分頁 `e33c774f…`
- 12:49 CT 塔台：HANDOVER 已核定（CT U-10：A、CT D926，內容同草案）；CT PLAN-022 / T0582（6.4.0-pre.1）已派工，收單後傳規範「檔:行」與範例狀態檔；本機 HANDOVER → ACKNOWLEDGED（D487）
- 12:52 T0967 DONE（模式 ①，merge `84f8c900`，parent1 `ee76629f`、parent2 `e5a0ad16`；test:unit 9500 passed / 526 files、typecheck 0 / 0、build 0）；收單 `--close-worker --delay-ms 10000` exit 0；斷點 E → U-61、發版 → U-62（D488）
- 12:53 U-61：A → `ct-merge/T0965` 再合併 `main`（只多 `_ct-workorders/**`）後 ff，`main` = `8a1c1318`（產品樹 = `84f8c900`，未 push）；整合 worktree detach；T0965 worktree 移除；BUG-236 FIXED（D489）
- 12:53 U-62 收到提問「本版會配合 CT 修改嗎?」→ 不會（`main` 未含 `menu_open` 讀取）；U-62 改問發版時機（A 等 CT 與 BAT 讀取單一起發，推薦 / B 現在先發）（D490）
- 12:55 使用者：「等配合CT修改的版本完成再一起發版」= U-62：A → 等 CT T0582 回傳規範位置後開 BAT `menu_open` 讀取單，完成後再問發 `0.8.1-pre.4`（D491）
- 13:14 CT 塔台：T0582 DONE（CT D927），傳 `menu_open` 規範位置（CT `7fee085`）、4 個範例狀態檔、CT 補定三點 → 開 T0968（D492）
- 13:15 T0968 派工 `--mode yolo --no-interactive --isolation worktree --wait-started 30000` exit 0，`started: 05:15:09Z`，分頁 `2faa9bd8…`，worktree `ct/T0968` base `dada34d9`
- 13:19 [提問] T0968 Q-1（`tower-inbox:answer` 相加參數需改 `electron/preload.ts`）→ 塔台答 A（允許，只改那一行、補進 affects_files）；Q-2（提示行的「只剩選單紀錄」renderer 拿不到）→ 塔台答 A（只看 attention 的 `question`，只剩紀錄時不提示、寫已知限制）；兩題 `--answer --choice 1` exit 0
- 13:21 [提問] T0968 Q-3（T0965 測試 `notify-hold-question-menu.test.ts:228` 斷言「只剩選單紀錄時 Worker 通知直接送出」與本單要求相反）→ 塔台答 A（只改這一條、註明 T0968 依 D492 改變行為，其他斷言不動）（`--answer --choice 1` exit 0）
- 13:33 T0968 DONE（`4dea180c`，test:unit 9567 passed / 529 files、typecheck 0 / 0、build 0；H-1～H-14 對照、Worker 通知殘留風險評估：最壞保留到該回合結束，不加逾時）；收單 `--close-worker --delay-ms 10000 --worktree keep` exit 0；五條全成立 → 模式 ①：`ct-merge/T0968` `8b3e9ec9`（parent1 `1372e23d`、parent2 `4dea180c`）；斷點 E → U-63、發版 → U-64（D493）
- 13:35 U-63：A、U-64：A → T0968 ff，`main` = `b2edf438`；去識別＋金鑰掃描（推送範圍 56 commits）0 命中 → push `main` → `pre-release.yml -f version=0.8.1-pre.4` run `46112814137` success；14:00 `v0.8.1-pre.4` 發佈（資產 4 個＋`server-bundle-v0.8.1-pre.4`），更版重點已改寫；A-26 待你實機（D494）
- 14:05 三文件 commit `f8e06829`＋記帳 `f09fdb0a` push；Pages run `46114762760` build / link-check / deploy 全 success（link-check 1695 / 0 errors），網站首頁版號 `0.8.1-pre.4`；已通知 CT 塔台版號
- 14:06 CT 塔台：CT 使用者核定 PLAN-022 P2 照 6.3.0 做法驗收（CT U-11：A、D929），準備單 CT T0583 派工（`ct620-accept/` 換 6.4.0-pre.1、`ct-swap-640.py`、`checklist-640.md` H-1～H-14 分 S1–S4）；BAT 最低版號 `0.8.1-pre.4` 已記入 CT PLAN-022；收單後傳資料，BAT 照 T0939 格式開驗收單
- 14:19 CT 塔台：CT T0583 DONE（CT D930），傳 `checklist-640.md`（SHA-256 `9c7dd279…`）、分組 S1–S4、`ct-swap-640.py`（`d2d7798d…`）指令、注意事項；塔台核對兩檔雜湊相符、取 pre.4 / pre.3 / 0.8.0-pre.8 win.zip 的 Release digest → 開 T0969（D495）
- 14:20 T0969 派工 `--mode yolo --no-interactive --isolation worktree --wait-started 30000` exit 0，`started: 06:20:46Z`，分頁 `5d8eb104…`，worktree `ct/T0969` base `4f7effa7`
- 15:05 T0969 DONE（BAT 端 20 PASS / 0 FAIL / 2 未觸發（指定）/ 1 不適用；Esc 後輸入框為空、選單開著時無持續輸出、舊 BAT / 舊 CT 降級 PASS；給 CT 的觀察 6 項）；收單 `--close-worker --worktree keep` exit 0；模式 ① `ct-merge/T0969` `4867b219`；BUG-236 CLOSED、BUG-237 開單（low）；A-26 縮為 BUG-235；U-65（ff）、U-66（BUG-237）；通知 CT（D496）
- 15:07 CT 塔台：判定單 CT T0584（唯讀研究，CT D931）開跑：§ 7 逐項判定、cf-all 4 份 exit 1 歸因、6 點觀察分析；觀察 ①（menu_open 與 awaiting_user 分次寫入）會比較 CT 端做法與 BAT 端「ids 不在 awaiting_user 當 stale」，要 BAT 配合會寫成可直接開單的形式；收單後傳判定與 6.4.0 正式版前修正建議
- 15:09 U-65：A → T0969 ff，`main` = `59e4fbeb`（產品樹 = `6d171c6e`，未 push）；整合 worktree detach、worktree 移除；U-66：A → BUG-237 修正等 CT T0584 後合成一張工單（D497）
- 15:12 塔台重新開工（同 session `c3c72160-0d57-4614-8800-6e952c8e484d`，分頁 `f32bfa46…`）：BAT 已是 `0.8.1-pre.4`；`--set-role tower --bat-contract 2 --mode on` exit 0（`bat-contract: 2`、`hooks: ok (injected, set 2)`）；`main` `4666c2c3`（比 `origin/main` 多 T0969 等，未 push）、工作樹乾淨；熱區 T:365 / BUG:101 / PLAN:35，無進行中工單；`_decision-log.md` 438,381 bytes（> 400 KB 預算）
- 15:13 `*sync`：工單 365 張全 DONE；BUG 檔 101 與 `_bug-tracker.md` 101 列逐筆一致（OPEN 1 / FIXED 1 / CLOSED 98 / WONTFIX 1）；PLAN 35 與 `_backlog.md` 一致（IDEA 3 / IN_PROGRESS 7 / DONE 23 / DROPPED 2）；索引不需重建；基本資訊表與編號起始更新；`auto_archive_prompt: off`（不提示歸檔候選）

---

## 🛏 本 Session 收工快照 (第一百三十九 session, 2026-11-27 20:46 - 2026-11-28 00:17)

### 主軸：`v0.8.0` 實機驗收的後續修正與交付版自動化驗收

#### 重點（時間取自系統 / git）

1. 開工即重現 BUG-228（Git Bash 把 `/control-tower` 改寫成路徑，T0946 修）；A-16 截圖 → BUG-229（⏻ 後滑鼠回報黏在啟動命令前，T0947）；A-18 → BUG-230（終端接回後塔台宣告消失，T0949）；T0947 建議 → T0950（⏻ 離開殘留 alt screen）、BUG-231（⏻ 期間打的字，T0951）
2. 合併：T0946 / T0957 / T0955 / T0959 / T0960 直接合併（模式 ①）；T0947 / T0949 / T0950 / T0951 / T0956 / T0961 經合併工單 T0948 / T0952 / T0953 / T0954 / T0958 / T0962；每次 ff 前斷點 E 由使用者確認
3. 發 `v0.8.1-pre.1`（D448 / D449）與 `v0.8.1-pre.2`（D460 / D461）：更版重點、CHANGELOG / release-note / README、Pages 綠燈
4. 使用者「用自動化測試」→ T0955（pre.1 zip 隔離實例＋編譯的假 `claude.exe`）A-19–A-23 全 PASS；T0959（pre.2）R0＋B233 WSL＋B232-login PASS，pre.1 對照能分辨；B233 在 Windows ConPTY 重現不了 → T0961 Linux CI（pre.1 FAIL / pre.2 PASS）→ BUG-233 CLOSED
5. 後續建議開單：BUG-232 / T0956（登入導引與遠端工具安裝）、BUG-233 / T0957（⏻ 後游標）、T0960（過時測試名稱）
6. 分支清理：本批與 `ct/T0936`–`T0945`、`ct-merge/*` 全刪（只留 `ct/T0885`、`ct/T0886`）

### 本輪戰績
- 工單 17（T0946–T0962）；BUG 6（228–233，全 CLOSED）；決策 D427–D470；發版 2（`v0.8.1-pre.1`、`pre.2`）；結構化提問 2（T0951 Q-1、T0956 Q-1，皆塔台答）

### 編號起始（下 session）
- **T0963** / **BUG-234** / **PLAN-071** / **D471** / **U-55** / **A-25**

---

## 🛏 前 Session 收工快照 (第一百三十六 session, 2026-11-27 00:19 - 2026-11-27 00:22)

- `v0.8.0-pre.7` 驗收通過（A-6，D389）；第一百三十七 / 一百三十八 session 沒有收工快照（`v0.8.0-pre.8` / `pre.9` / `v0.8.0` 正式版、T0936–T0945，D390–D428）。完整紀錄見 [`_archive/state-snapshots/2026-Q4-d.md`](_archive/state-snapshots/2026-Q4-d.md) 與決策日誌。

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-11-28 00:17 UTC+8（第一百三十九 session 收工）

### 近期完成
- **`v0.8.1-pre.2`**（D461）：BUG-232 / 233 修正；交付版自動化驗收 T0959 / T0961，BUG-228–233 全部 CLOSED（D451 / D463 / D468）
- **`v0.8.1-pre.1`**（D449）：BUG-228 / 229 / 230 / 231、T0950
- **`v0.8.0` 正式版**（D425）
- 交付版驗收工具：`e2e/manual/t0955-v081-acceptance.ts` / `t0959-v081-pre2-acceptance.ts`（隔離實例＋假 claude）、`e2e/linux/t0961-restart-hidden-cursor.spec.ts`

### 待辦（依優先序；完整內容見 frontmatter `todo`）
1. `_decision-log.md` 超過 400 KB 預算 → 封存舊決策
2. PLAN-065 per-machine UAC 互動升級手動驗收；PLAN-052 Docker Desktop 實機精靈；PLAN-058 手動確認；其他待實機項
3. 候選（未開單）：`readAsarFile` 讀不足判失敗、PLAN-066 後續、`useInboxFileRefs` 跟 `fs:changed` 重查
4. `v0.8.1-pre.3` 已發佈（BUG-234，D474），A-25 實機確認後 BUG-234 CLOSED；PLAN-067 週清查 2026-12-02 到期

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式
- 改 `_bug-tracker.md` / `_backlog.md` 不用全檔 `sed`，改完跑 parser 測試（L179）
- 網站驗證用最新 portal-layout `layout-check.mjs`（目前 v1.1.7）；網站改動 push 才會上線
- 產品改動回到 `main`（D344）：新工單從 `main` 開分支、合併回 `main`，從 `main` 發版
- 時間戳一律取系統時間（R-G001）；frontmatter 檢查與 commit 串接時以 `PASS` 判斷再 commit（L186）

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 1 / Fixing 0 / Fixed 1 / Closed 98 / WONTFIX 1）｜ Backlog → [_backlog.md](_backlog.md)（IN_PROGRESS 7 / DONE 23）
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D497；D001～D185 封存在 `_archive/decisions/`；438 KB 超過 400 KB 預算）｜ Learnings → [_learnings.md](_learnings.md)（最大 L187）
- PLAN-068 網頁版使用說明 → https://claude.ai/artifact/8mepgGP16ghS3m9hsu2Wst（私人）
- 網站 → https://gowerlin.github.io/better-agent-terminal/
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（159 entries；最新 `2026-Q4-d.md`）

### 編號起始
- **T0970** / **BUG-238** / **PLAN-071** / **D498** / **U-67** / **A-27** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L188** / **CT-T023**

---


## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | `main` `package.json` **0.8.1-pre.4**；下一版 **`0.8.1-pre.5`**（從 `main` 發，D344） |
| **最新 release** | `v0.8.1-pre.4`（2026-11-28 14:00 (UTC+8)，Pre-Release `46112814137`，`b2edf438`，D494；BUG-235 / 236、T0966、T0968）；前一 tag `v0.8.1-pre.3`；最新正式版 `v0.8.0`（D425） |
| **目前主軸** | 無派工中工單；等 CT T0584 判定（BUG-237 與 BAT 配合項合成一張工單，進 `0.8.1-pre.5`）；A-26 待實機 |
| **工單最大編號** | **T0969** DONE；熱區 365 張全部終態 |
| **BUG 最大編號** | **BUG-237** OPEN；熱區 Open 1 / Fixing 0 / Fixed 1 / Closed 98 / WONTFIX 1 |
| **PLAN 最大編號** | **PLAN-068** DONE；IN_PROGRESS 7（038 / 043 / 052 / 058 / 064 / 065 / 067）；IDEA 3 |
| **決策最大編號** | **D497**（U-65 / U-66，第一百四十 session） |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v6.3.0**（第一百三十七 session 起；BAT ↔ CT 契約 v2 ＋ `inbox_features` 含 `multi`） |
| **unit test 基線** | `main`：**9567 passed / 529 files**（T0968 `4dea180c`）；typecheck 0 / 0 |
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
