---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
ct_version: "6.1.1"
updated_at: "2026-11-25T18:56:20+0800"
session: "2026-11-25 16:05 第一百三十一 session（CT v6.1.1）"
next_ids:
  workorder: "T0922"
  decision: "D346"
  bug: "BUG-223"
  plan: "PLAN-069"
  user: "U-6"
  action: "A-4"
todo:
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

> 🟢 **第一百三十一 session 開工**（2026-11-25 16:05 (UTC+8)，CT v6.1.1，Fast Path；塔台 session `43c82f3f-de60-4c70-b5fb-f190e8698511`；`main` = `origin/main` @ `7deb824c`、`v0.8.x` = `origin/v0.8.x` @ `4ce779ee`、工作區乾淨、無 stash；worktree 剩 `T0885` 與 `.ct-integration`；熱區 T:316 / BUG:86 / PLAN:33 / EXP:1）。frontmatter 升契約 v2（`bat_contract: 2`、`ct_version`）；`todo` 兩項搬家：PLAN-068 實機驗收 → `user_actions` A-1、PLAN-067 → `reminders`。開工核對（R-G003）：T0916／T0918 frontmatter 仍 `FIXED`（BUG-220／222 已於 D338 CLOSED）→ 塔台收尾改 `DONE`；BUG-216–219 仍 `FIXED`（已隨 pre.2／pre.3 交付）→ 結案方式交使用者（U-1）。 16:11 U-1 → A（D340）：BUG-218／219 CLOSED（pre.2 run `45460440287`／pre.3 run `45560094561` `tests / unit-tests` 綠）；BUG-216／217 維持 FIXED → `user_actions` A-2／A-3；`_bug-tracker.md` FIXED 2 / CLOSED 83，parser 測試 65 passed。 16:30 `A-3：完成`（經 BAT 待辦分頁）→ D341 BUG-217 CLOSED（安裝版 `0.8.0-pre.3`；本次日誌沒有 `[ct-overview]` 行，無反證，依回報結案）；tracker FIXED 1 / CLOSED 84。 17:08 外部測試者回報：從 GitHub main「Download ZIP」打包 macOS，結果是舊程式（main `package.json` `0.7.5-pre.2`，但 `CHANGELOG.md`／`release-note.md` 已寫 pre.3）。原因：D307 起產品程式只在 `v0.8.x`，main 只有塔台紀錄與發版文件（main 領先 174 個 commit 幾乎都是 `_ct-workorders/`，`v0.8.x` 領先 54；`merge-tree` 試合併有衝突）。已給使用者回覆稿（用 Release 的 dmg 或 `v0.8.0-pre.3` 的 Source code）；防範方式交使用者（U-2）。 18:42 U-2 → B（D342）：現在把 `v0.8.x` 併回 `main` → 開 T0921（合併工單模式 ②，整合 worktree，只有 `CHANGELOG.md` 衝突；不 push、ff 經斷點 E）。`base_main_sha` `5699a2aa`。18:43 派出 T0921（`--mode on`，非隔離，exit 0、`started: 2026-11-25T10:43:05Z`）。 18:46 T0921 收單 DONE（模式 ②）：merge `f9375c2c`（parent1 `5699a2aa` = base、parent2 `4ce779ee` = `v0.8.x`）；`CHANGELOG.md` 採 `main` 版（兩邊 `[0.8.0-pre.3]` 逐字相同，`main` 多 pre.2／pre.1 段）；樹比對對 `4ce779ee` 只差 `CHANGELOG.md`、`release-note.md`、`_ct-workorders/**`；typecheck 0 / 0、vite build、test:unit 第一次即綠 9001、verify:helpers、網站建置 exit 0（新頁 `site/tower-inbox.md`）；範圍外檔案無。session id 已在、session 快照已寫；`--close-worker T0921 --delay-ms 10000` exit 0。SHA 比對 ①–③ PASS；⑤ main 只多 `_ct-workorders/**` → 整合分支 `--no-ff` 併 main → `8c173c2c`（main 為祖先）。18:47 斷點 E（非 yolo）→ U-3。 18:53 U-3 → A（D343）：整合分支再併一次 `main` 的記帳 commit → `git merge --ff-only ct-merge/T0921` → **`main` = `f967f9db`**（④ PASS，`package.json` `0.8.0-pre.3`）；整合 worktree detach；PLAN-066 DONE。未 push（領先 67）→ U-5；之後的分支用法 → U-4。 18:54 U-4 → A（D344）：產品改動回到 `main`（取代 D307 分流），`v0.8.x` 保留不再使用，下一版從 `main` 發。 18:55 U-5 → A、A-1 / A-2 完成（D345）：去識別 0、金鑰樣式只有既有測試假字串 → push `main` `7deb824c..2cac17e5`（Pages run `45599547166`）；PLAN-068 DONE；BUG-216 CLOSED（熱區未結 BUG 0）；`user_actions` 清空。
>
> 🛏 **第一百三十 session 收工**（2026-11-25 15:25 (UTC+8)）。

> 🟢 **第一百三十 session 開工**（2026-11-25 00:28 (UTC+8)，CT v6.0.0，Fast Path（環境快照 2026-11-24，未逾 7 天）；塔台 session `93faa440-07bb-4923-8807-c9d1835ee287`；分頁 `3a9b5550…`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；BAT helper `0.8.0-pre.1`；`main` = `origin/main` @ `94147ecb`、`v0.8.x` = `origin/v0.8.x` @ `bcb4bbe0`、工作區乾淨、無 stash；worktree 只剩 `T0885` 與 `.ct-integration`；熱區 T:286 / BUG:79 / PLAN:31 / EXP:1；`bat_list_questions` pending 0）。
> 00:31 D317：開 T0891（內嵌 claude-code 2.1.331 / agent-sdk 0.3.331 / codex 0.172.0 追版，`ct/T0891` 從 `v0.8.x` `bcb4bbe0`，隔離派工）與 T0892（`v0.8.0-pre.1` 日誌與記憶體唯讀檢查），並行派工。00:32 派出：T0891 `--mode yolo --no-interactive --isolation worktree` exit 0、`started: 2026-11-24T16:32:21Z`（worktree `.bat-worktrees/…/T0891`、branch `ct/T0891`、BAT 印 base `06c3b884` = 與 main 的共同祖先，預期）；T0892 exit 0、`started: 2026-11-24T16:32:23Z`。
> 00:38 T0892 收單 DONE（`b803e1a1`）：日誌與記憶體**沒有 `v0.8.x` 回歸**（無 recovery / heartbeat 判死 / crash dump；holder、`--max-semi-space-size=1` 生效；holder 8 分頁 Private 82–85 MB、14 h 峰值 WS 117 MB）；開 BUG-216（大型剪貼簿圖片 Ctrl+V）、BUG-217（ct-overview YAML 錯誤日誌重複含原文），皆 low、既有程式；session 快照已寫；`--close-worker T0892` exit 0。
> 00:40 D318：使用者裁示 BUG-216 / 217 一起修放進 pre.2 → T0893（BUG-216）、T0894（BUG-217）從 `v0.8.x` `bcb4bbe0` 建 `ct/T0893` / `ct/T0894` 隔離派工，與 T0891 並行；BUG → FIXING。00:41 派出 T0893 / T0894（皆 exit 0、`started:`）。00:42 HANDOVER 給 CT（`_handover-2026-11-25-ct-tower-state-frontmatter-backslash.md`，`375a1f43`，SendMessage → `BMad-Guide · Tower`）。
> [提問] 00:4x T0893 Q-1–Q-3（`--answer` exit 0 ×3，塔台在範圍內直接裁決）：Q-1 A 新增本機 IPC `clipboard:has-image`；Q-2 A 改門檻 2 × 上限（20 MiB）以免改變 10 MiB 邊界結果；Q-3 A `TerminalPanel.tsx` 進範圍。`affects_files` 加 `TerminalPanel.tsx`、`terminal-remote-upload.test.tsx`。
> 00:44 CT 受理 HANDOVER（BMad-Guide T0549 / D851，CT 6.0.1 修正），handover → ACKNOWLEDGED（`2801a1f9`）。
> 00:49 T0894 收單 DONE：`ct/T0894` `2b49e5a5`（4 檔皆在 `affects_files`、worktree 乾淨、test:unit 8454 passed、vite build / typecheck 0 / 0）→ `v0.8.x` fast-forward `bcb4bbe0..2b49e5a5`；BUG-217 FIXED；session 快照已寫；`--close-worker T0894 --worktree keep` exit 0。**待補**：`docs/agent-guide/ct-tower-overview.md` 第 56 行（文字在 T0894 回報區），T0891 合併後由塔台補。觀察：首輪 test:unit 4 個 headless e2e 檔 `beforeAll` 逾時、重跑全綠。
> 00:54 T0893 收單（Worker 寫 FIXED → 塔台改 DONE，L177）：`ct/T0893` `43d290c9`（12 檔皆在 `affects_files`、worktree 乾淨、test:unit 8466 passed、build / typecheck 0 / 0、`merge-tree` 對 `v0.8.x` 無衝突）；BUG-216 FIXED；session 快照已寫；`--close-worker T0893 --worktree keep` exit 0。D319：等 T0891 後派一張合併工單（模式 ②）併 `ct/T0893` + `ct/T0891`、補文件、完整驗收。候選：`upload-client.ts` `clipboard-image` 早退（T0893〈建議後續〉）→ 00:57 使用者「安排」→ D320 開 T0895（`ct/T0895` 從 `ct/T0893` `43d290c9`），合併工單改併 `ct/T0895` + `ct/T0891`。00:58 派出 T0895（exit 0、`started:`）。
> 01:00 T0891 收單 DONE：`ct/T0891` head `ef14afb7`（validated `36a23b7d`，差的只有 `bat-mcp-shim.md` 一句）；claude-code **2.1.331** / agent-sdk **0.3.331** / codex **0.172.0**；純追加 3 項（Fable 5.2 模型＋計價 $8/$40、claude `team's pooled group budget` 句型、codex API spend limit 句型）；19 檔皆在 `affects_files`、worktree 乾淨；test:unit 8459 / legacy 472 / build / typecheck 0 / 0 / verify:helpers / e2e t0621 綠、t0592 有一情境 2/6 間歇失敗（最後連 3 次全綠）；`merge-tree` 對 `v0.8.x` 與 `ct/T0893` 都無衝突；session 快照已寫；`--close-worker T0891 --worktree keep` exit 0。候選（未開單）：t0592 `lacking "shell"` 情境穩定化（tower pwsh `-NoProfile` / 延長等待）；claude `channel's monthly spend limit` / `usage credit limit` 句型（2.1.316 起就有、BAT 不認）；Fable 5.2 服務端最低 CLI 版本未知（`HEALTHY_MIN` 維持 2.1.280）。
> 01:05 T0895 收單 DONE：`ct/T0895` `c6565a96`（5 檔皆在 `affects_files`、worktree 乾淨、test:unit 8473 passed（第二次）、build / typecheck 0 / 0；門檻 65,536,000 bytes、只有 `ClipboardImageTooLargeError` → `TOO_LARGE`）；session 快照已寫；`--close-worker T0895 --worktree keep` exit 0。`merge-tree` 三組都無衝突 → 開合併工單 T0896（模式 ②，整合 worktree，base `v0.8.x` `2b49e5a5`，併 `ct/T0895` + `ct/T0891`＋文件補充＋完整驗收）。觀察：完整 test:unit 首輪 headless / RemoteServer e2e `beforeAll` 逾時已在 T0891 / T0894 / T0895 三張出現（重跑皆過）→ 候選 BUG（CI Test gate 可能偶發擋發版）。
> 01:06 派出 T0896（exit 0、`started:`）。使用者：T0891 候選 1、2「也安排」→ D321 開 T0897（PENDING，等 T0896 ff 後從新 `v0.8.x` 建 `ct/T0897` 再派）。
> 01:08 使用者：headless e2e 逾時候選「也安排」→ D322 開 BUG-218（FIXING）＋ T0898（PENDING）；T0897 / T0898 等 T0896 ff 後並行派工，完成後再一張合併工單＋ pre.2 最後聯合驗證。
> 01:11 D323 開 PLAN-067（每週日誌清查，開工逾期 ≥ 7 天提示；`_local-rules.md` 新規則；下次到期 2026-12-02）。
> 01:14 T0896 收單 DONE（模式 ②）：`ct-merge/T0896` 兩次 `--no-ff` 無衝突（`7bedb686` T0895、`9115aa7b` T0891）＋文件 `7094b993`；完整驗收全綠（test:unit 第 2 次 8490 passed（第 1 次 7 檔逾時 = BUG-218）、legacy 472、build / typecheck 0 / 0、verify-native / helpers、內嵌 claude 2.1.331 / codex 0.172.0、e2e t0621 / t0592 一次過）；範圍外檔案無；SHA 比對 1–4 PASS → yolo 自動 **`v0.8.x` ff `2b49e5a5..7094b993`**；整合 worktree detach；worktree `T0891` / `T0893` / `T0894` / `T0895` 移除（分支保留待使用者同意刪）；session 快照已寫；`--close-worker T0896` exit 0。建 `ct/T0897` / `ct/T0898` @ `7094b993`。01:15 派出 T0897 / T0898（皆 exit 0、`started:`）。
> [提問] 01:1x T0897 Q-1–Q-3（`--answer` exit 0 ×3，塔台範圍內裁決，皆同 Worker 建議）：Q-1 B（`usage limit · contact your admin to increase it` → claude-blocked / non-timed）；Q-2 A（`Usage is paused for your organization` 不加，每日上限可能隔天恢復，列觀察）；Q-3 A（`usage credit limit` 停止句 CLI 不會印，不加）。
> 01:3x CT 通知 HANDOVER 完成（CT 6.0.1 發佈，D856），handover 補紀錄 `ae367650`；以 `check-frontmatter.py` 掃熱區 479 檔：0 個跳脫問題，34 檔只是沒有 frontmatter（舊 spec / 報告）。
> 01:36 T0898 收單 DONE：`ct/T0898` `98bd9e96`（4 檔：`vite.config.ts` `test.globalSetup`、新 globalSetup 與其測試、`bat-mcp-codex-env.test.ts`；worktree 乾淨、`v0.8.x` 未前進）。根因：Electron 42+ 第一次 `require('electron')` 同步下載 binary，11 檔同時下載各 22–25 s；另修 codex 0.172 `app-server` 的 `git ls-remote` 造成 `EPERM`（`-c features.plugins=false`）。全新狀態 3 次第一次 test:unit 全綠（8495）、legacy 472、build 產物 97 檔 sha256 不變。BUG-218 FIXED；session 快照已寫；`--close-worker T0898 --worktree keep` exit 0。待合併工單補 CLAUDE.md「Frontend unit tests」一句（T0898 回報區）。
> 01:38 T0897 收單 DONE：`ct/T0897` `c9f98ba9`（5 檔皆在 `affects_files`、worktree 乾淨）。① 新增 claude 花費 / 額度停止句（channel / individual / org monthly spend & usage limit、`usage limit · contact your admin…`、seat type、allocation disabled、group $0、service disabled、out of extra usage → non-timed；計時句尾 `· out of usage credits`），既有句型不變；② t0592 根因：假 codex 清理 `CODEX_HOME` 最多約 21 s 仍佔前景，預填文字被延後 → 改等塔台 pwsh 自寫的標記，人為延遲 25 s 重現並驗證修正；連續 5 次全綠。session 快照已寫；`--close-worker T0897 --worktree keep` exit 0。觀察（未開單）：t0592 會寫進使用者 PSReadLine 歷程；`Usage is paused for your organization`（每日暫停）未認。→ 開合併工單 T0899（模式 ②，併 `ct/T0898` + `ct/T0897`、補 CLAUDE.md、pre.2 最後聯合驗證）。01:39 派出（exit 0、`started:`）。
> 01:45 T0899 收單 DONE：`cdd534a2`（T0898）、`1c74b6a2`（T0897）、文件 `7063e45e`；完整驗收全綠，**test:unit 第一次即綠**（全新 binary 狀態，8514 passed / 63 s）、legacy 472、build / typecheck 0 / 0、verify-native / helpers、內嵌 claude 2.1.331 / codex 0.172.0、t0592 ×2、t0621 綠；範圍外檔案無；SHA 比對 PASS → **`v0.8.x` ff `7094b993..7063e45e`**（本機，未 push；`origin/v0.8.x` 仍 `bcb4bbe0`）；worktree T0897 / T0898 移除；session 快照已寫；`--close-worker T0899` exit 0。`v0.8.0-pre.1..v0.8.x` 14 commits，**pre.2 內容就緒，待使用者授權 push 與發版**。候選（未開單）：t0592 寫入使用者 PSReadLine 歷程、`Usage is paused for your organization` 未認、t0621 `BAT_E2E_CODEX` 路徑分隔符比對。待使用者同意刪除的分支：`ct/T0891`、`ct/T0893`–`ct/T0898`、`ct-merge/T0896`、`ct-merge/T0899`。
> 01:48 D324：使用者授權「push 並發 pre.2」「刪除」→ 8 個已合併分支 `git branch -d`；去識別 / 金鑰掃描 PASS（金鑰樣式 6 處為既有測試假權杖）；push `main` `94147ecb..70b21395`、`v0.8.x` `bcb4bbe0..7063e45e`；`gh workflow run pre-release.yml --ref v0.8.x -f version=0.8.0-pre.2` → run `45460440287`（`7063e45e`）。
> 02:36 第一次嘗試 **failure**：`tests / unit-tests`（ubuntu-24.04）1 檔失敗——`shared-conout.test.ts`「the real Worker script relays a pipe」逾時 20 s（pre.1 CI 同檔 1.0 s 全過；本批未改）；build / release skipped（沒有發出任何 release）。開 BUG-219（OPEN low；共用 conout 只在 win32 生效，Linux 使用者不受影響）。02:37 `gh run rerun --failed` 確認是否可重現。
> 02:4x D325（使用者「依建議」）→ T0900 派出；attempt 2 `tests / unit-tests` success，Linux / macOS build success，Windows build 進行中。
> 02:59 T0900 收單 DONE：根因 = 測試競態（`await closed` 後才掛 client `'close'` listener，Linux unix socket 上 client 常先 close；WSL 重現約 22%），只改測試（`6b907f6b`，+5 / −1，timeout 不變），WSL 連續 60 次 0 失敗、Windows test:unit 第一次即綠 8513。模式 ① 直接合併：`ct-merge/T0900` `86b3fc67`（parent1 `7063e45e` / parent2 `6b907f6b`）→ **本機 `v0.8.x` ff `7063e45e..86b3fc67`（等 pre.2 release 建好後才 push，該提交隨下一版發佈）**；BUG-219 FIXED；分支 `ct/T0900` / `ct-merge/T0900` 已刪；worktree 中繼資料已移除，空目錄被 Worker 分頁佔用待分頁關閉後刪；session 快照已寫；`--close-worker T0900` exit 0。
> 03:02 **`v0.8.0-pre.2` 發佈**：run `45460440287` attempt 2 全 success（tests、typecheck、server-bundle ×3、三平台 build、release）；prerelease target `7063e45e`、4 個安裝檔；`server-bundle-v0.8.0-pre.2`（7 個附件）。更版重點已 `gh release edit`。CHANGELOG / release-note 加 pre.2 段（main，README 不需改）；`v0.8.x` 本機 `86b3fc67`（T0900）→ `fda8a4b4`（package version 0.8.0-pre.2）。
> 03:05 push `main` `70b21395..85613f0e`、`v0.8.x` `7063e45e..fda8a4b4`（去識別掃描 0）；Pages run `45466482052` build / deploy / link-check success，首頁 `0.8.0-pre.2`；link-check 50 筆皆 github.com `HTTP/2 protocol error`（含快取重複），連結本身有效，前一次 run 0 筆 → 暫時性，未開單（候選：lychee 對 github.com 改 HTTP/1.1 或加重試）。**pre.2 發佈完成，待使用者跑 NSIS 重裝驗收**。
> 03:06 GitHub #24 → D326 開 PLAN-068、T0901（BAT 研究）、HANDOVER 給 CT（討論）。03:08 派出 T0901。
> 03:11 CT 回覆立場草案（BMad-Guide `1d2692f`、CT D866，DRAFT）→ 以〈塔台補充（執行中 #1）〉轉給 T0901；HANDOVER 補回覆紀錄（`f656d375`）。
> 03:16 T0901 收單 DONE（`8c0782f7`，唯讀研究）：Phase 1 只改 BAT（B0 送通知不搶捲動、B 閱讀保護＋ #23 草稿保護、C 回合訊息卡、文件提示），Phase 2 採 CT `awaiting_user`＋面板回答欄（本機 IPC）；CT 三點：(a) 合總覽讀法、(b) claude 可行 / codex 暫不可行、(c) 可行但走本機 IPC；1″ 選項代號格式待 CT 決定。session 快照已寫；`--close-worker T0901` exit 0。使用者補充：顯示放既有右側欄（程式碼片段 / Skills / Agents）新增分頁。使用者裁示（D327）：不分階段、強制版本對齊、一次到位提案；先不回覆 CT；#23 重新評估 → 03:19 開設計單 T0902。03:22 使用者補充右側欄連同 TODO / 長期追蹤清單 → T0902〈塔台補充（執行中 #1）〉。
> 03:29 T0902 收單 DONE（`99b3048d`）：#23 現行仍會發生（另：type-ahead 與 250 ms 雙向窗口）；整合設計 = 右側欄新分頁「待辦」（待你決定 / 待你執行 / 到期提醒 / Worker 等你 / 塔台訊息卡 / 塔台待辦 / 數量連結）、保留佇列擴充（`draft` 無上限、`reading` 60 s、原子送出、B0 改 `terminal.input('\r', false)`）、回答走本機 / proxied IPC；契約 v2（`bat_contract: 2`、`ct_version`、`awaiting_user`、`user_actions`、`reminders`、`next_ids.user/action`，`--set-role` 回 `bat-contract:`）；規則修改 R1–R10、拆單 W1–W8、待實機 T-1–T-7。session 快照已寫；`--close-worker T0902` exit 0。03:44 使用者核定（D328）：「待辦」、W1–W8 同版、R9 全綁版本、R1 主案＋補 hook 註冊設計 → T0902 Renew #1（03:44 重派，exit 0、`started:`）。03:48 使用者補充：CT 也以 hook 修正 Bash 過長，註冊設計一併涵蓋 CT hooks → T0902〈塔台補充（執行中 #2）〉。
> 03:54 T0902 第二版收單 DONE（`0827bd36`）：§6′ 以塔台分頁 `--bat-contract 2` 宣告判定（狀態檔只管檔案類清單；T0788 既有保留不綁版本，屬不回歸）＋ P-1/P-2/P-3 提示＋完整版本組合表；§7 hook 註冊：13 種缺口與代號、推薦 (a) 自動注入＋(c) `bat-hooks` Claude Code plugin（BAT repo marketplace），不採 (b) 寫使用者設定；CT 的 Bash 長度防護目前只在本機使用者層（非 CT 產品），建議 CT 以自己的 plugin 發佈；拆單新增 W0（版本閘門，最先）與 W9（hook 註冊）。session 快照已寫；`--close-worker T0902` exit 0。04:44 使用者定案（D329）：R12 採 `bat-hooks` plugin、R13 維持、其餘定案 → HANDOVER〈BAT 定案立場〉送 CT。04:4x CT 回覆 v2 確認（`cb7f098` / CT D867，DRAFT）；04:47 D330 回覆（時區兩種都接受、版號佔位、同日發佈、C-3 CT 另案）。04:5x CT 核定契約 v2（CT D868）→ D332 開 W0 = T0903（04:54 派出）。05:09 T0903 收單（PARTIAL → DONE，D333），模式 ① 合併 `v0.8.x` `fda8a4b4..d6b9ce86`（本機）；05:12 開 T0904（W1＋W2）/ T0905（W3）/ T0906（W4）平行派工（皆 exit 0、`started:`）。
> [提問] 05:2x T0906 Q-1 / Q-2（`--answer` exit 0 ×2）：Q-1 A（`WorkspaceView.tsx` 最小增量進範圍）；Q-2 B＋條件（依 R9′ 全綁：不符時整個待辦分頁只留選擇器與提示；R6 只在契約相符時生效，不符時總覽照舊顯示 `todo`，避免回歸；無塔台以狀態檔判定）。
> 05:34 T0906（W4）收單 DONE：`ct/T0906` `3d469fbb`（26 檔，head 第一次 test:unit 即綠 8,627、legacy 472、build / typecheck 0 / 0；附帶修正 `fs:watch` 同路徑多監看互相關閉 → `acquireDirWatch`）；模式 ① 合併 `ct-merge/T0906` `eaa8b238` → **`v0.8.x` ff `d6b9ce86..eaa8b238`（本機）**；session 快照已寫；`--close-worker T0906 --worktree remove` exit 0。T0904 / T0905 合併時將不符直接合併判準（`v0.8.x` 已含 W4 產品檔）→ 兩張完成後一張合併工單。
> 05:36 T0905（W3）收單 DONE：`ct/T0905` `1a468665`（24 檔；`stop` 送 `last_assistant_message` ≤ 16 KiB＋`origin` / `set`（其他事件逐字不變）、`electron/tower-cards.ts` host store（只收 v2 塔台、遮罩、30 / 10 / 16 KiB、生命週期、10 s 內 session＋雜湊去重）、`tower-cards:*` proxied（不在 helper 權杖範圍）、面板來源介面、renderer store；最低 claude `2.1.47`）；第 3 次 test:unit 全綠 8,633（前兩次負載型失敗：`shared-conout` kill-under-load watchdog、`terminal-gpu-crash-redraw`，單獨重跑皆過，觀察）。試合併 `v0.8.x`：只有 `docs/agent-guide/tower-inbox.md` add/add 衝突（T0906 也建立）。session 快照已寫；`--close-worker T0905 --worktree keep` exit 0。待 T0904 後合併工單。
> 05:44 T0904（W1＋W2）收單 DONE：`ct/T0904` `45020cf1`（30 檔；head 第一次 test:unit 即綠 8,677；B0 真 xterm 驗證、假 TUI e2e 重現 #23 並驗證修正（未宣告塔台照舊重現、契約 2 草稿單獨送出、250 ms 窗口兩情況、閱讀保留 61 s）；回答來源 `enqueueAnswer` 介面留 W5）。建議後續：遠端視窗看不到「📨 待送」/ 原因 / 立即送出 / 5 分鐘提醒（`terminal:notify-hold-*` 未 proxied，T0788 既有限制）→ 併入 W5。session 快照已寫；`--close-worker T0904 --worktree keep` exit 0。開合併工單 T0907（模式 ②，base `eaa8b238`，預期衝突：tower-inbox.md、notify-hold-store、README、preload、path-aware-channels）。
> 05:57 T0907 收單 DONE：衝突全以兩邊保留解掉、驗收第一次即綠（test:unit 8,776、e2e t0904 ×2）→ **`v0.8.x` ff `eaa8b238..677860a4`（本機，W0–W4 完成）**；worktree T0903–T0906 移除、已合併分支刪除；CLAUDE.md 90,776 字元。05:58 D334 開 T0908（W5）/ T0909（W6）/ T0910（W9）平行（皆 exit 0、`started:`）。
> [提問] 06:0x T0909 Q-1（`--answer` exit 0）：面板塔台 = 狀態檔 `bat_contract == 2` 且工作區沒有已宣告塔台分頁時，該工作區所有 Claude Agent 面板；「💬」有已宣告塔台時只顯示它的卡片、沒有時合併面板卡片並標來源。同一定義以〈塔台補充（執行中 #1）〉轉給 T0908（回答目標與共用純函式）。
> [提問] 06:0x T0910 Q-1 / Q-2（`--answer` exit 0 ×2）：Q-1 A（提示元件放 `src/components/inbox/`，`InboxPanel.tsx` 只加兩行）；Q-2 A（新事件 `terminal:hooks-status`，`preload.ts` 只加 `onHooksStatus`，不進 helper 權杖）；`affects_files` 補兩檔。
> 06:14 T0909（W6）收單 DONE：`ct/T0909` `efd6b3da`（卡片同步接 App、「💬 塔台訊息」區（純文字、展開即已讀、釘選上限、全部已讀 / 清除）、加亮行、codex 說明、G7 提示、縮圖 `💬N`、面板塔台 `PanelTowerSync` ＋ proxied `tower-cards:set-panel-tower`；判定純函式 `workspaceHasPanelTowers` / `panelTowerTerminalIds` / `CLAUDE_PANEL_PRESETS`（含 `claude-code-worktree`）；test:unit 第一次即綠 8,820）。session 快照已寫；`--close-worker T0909 --worktree keep` exit 0。最終函式名以〈塔台補充（執行中 #2）〉轉給 T0908。待 T0908 / T0910 完成後合併工單。
> 06:24 T0908（W5）收單 DONE：`ct/T0908` `ba4fe096`（`src/lib/tower-inbox.ts` 解析三欄位＋`waiting_user`＋時區兩格式＋`source` 短標籤；待辦三區、最近已結、分頁數字、`InboxAwaitingBadge` `⏸N`（含 detached）；`tower-inbox:answer`（本機 / proxied、不在 helper 權杖、格式檢查）→ `enqueueAnswer`；面板塔台回答（輸入框有字時拒絕並提示）；`terminal:notify-hold-*` 遠端 proxied；面板塔台判定逐字複製 T0909 版本；`user_inbox` 讀 CT 設定專案→全域；head test:unit 第一次即綠 8,826）。session 快照已寫；`--close-worker T0908 --worktree keep` exit 0。註：Worker 回報 CLAUDE.md「131,771 字元」疑為 bytes（T0907 實測 90,776 字元），W7 再量。
> 06:29 T0910（W9）收單 DONE：`ct/T0910` `a8eb8236`（43 檔；`claude-hooks-status.ts` 啟動代號、`--set-role --bat-contract` 的 `hooks:` 行（最多等 2 s；helper 等 8 s）、`hooksStatus` 查詢 / MCP、`terminal:hooks-status` 推送、`🪝✕` 與待辦提示、`.claude-plugin/marketplace.json`＋`plugins/bat-hooks`（launcher、不進安裝檔）、`--hook-list` / `plugin-outdated`、session-start 帶 origin / set、(d1) `--plugin-dir` 建議不採用、README 協作章節；head test:unit 第一次即綠 8,842）。session 快照已寫；`--close-worker T0910 --worktree keep` exit 0。開合併工單 T0911（T0909 → T0908 → T0910，base `677860a4`）。06:30 派出。
> 06:39 T0911 收單 DONE：三次 `--no-ff` 衝突全兩邊保留、無行為矛盾；第一次 test:unit 即綠 8,944、legacy 472、e2e t0904；CLAUDE.md 94,967 字元 / 136,162 bytes；範圍外檔案無；SHA 比對 PASS → **`v0.8.x` ff `677860a4..17c84662`（本機，W0–W6＋W9 完成）**；worktree T0908–T0910 移除、已合併分支刪除。06:40 開 W7 = T0912（文件）、W8 = T0913（整合驗收）平行（06:41 派出）。
> 06:51 T0912（W7）收單 DONE：`ct/T0912` `fa658599`（9 檔，只文件：`tower-inbox.md` 現況化與交叉引用收斂、CLAUDE.md PLAN-068 各節精簡（W6 節併入 W3「塔台回合訊息卡」，其餘標題不變）→ 93,427 字元、網站新頁 `site/tower-inbox.md`＋導覽兩行、README 協作章節＋版本對照表「待定」×3、CHANGELOG `[Unreleased]`；vitepress build 成功、195 相對連結 0 壞、test:unit 第一次即綠）。模式 ① 合併 `ct-merge/T0912` `e6f18bf0` → **`v0.8.x` ff `17c84662..e6f18bf0`（本機）**；session 快照已寫；`--close-worker T0912 --worktree remove` exit 0。定版時要填：README 版本對照表三處「待定」。T0902 的「塔台分頁第一次宣告時待辦分頁顯示一次建議」未實作，文件寫成建議（觀察）。
> 07:01 T0913（W8）收單 DONE：`ct/T0913` `a00b1b4a`（只加測試：`e2e/t0913-tower-inbox-integration.spec.ts`、`e2e/fixtures/helper-job-runner.mjs`、`headless-tower-inbox-e2e.test.ts`）；①–⑥ 全過（版本組合表每格、清單→回答→保留佇列、卡片、`--set-role` 兩行與 `🪝✕`、headless 遠端與權杖拒絕、舊 helper 輸出逐字不變）；**沒有產品缺陷**；e2e ×2、test:unit 第一次即綠 8,950、legacy、build、typecheck；〈待實機清單〉M-U1–U8 / M-C1–C7 / M-R1–R2。建議：M-C6（新 CT＋舊 BAT 降級）交 CT 確認；docs「實機交 W8」改指向 e2e（小改，可併入發版準備）。session 快照已寫；`--close-worker T0913 --worktree keep` exit 0。試合併無衝突 → 開合併工單 T0914（模式 ②，base `e6f18bf0`）。
> 07:06 T0914 收單 DONE（無衝突、test:unit 第一次即綠 8,951、e2e t0913）→ **`v0.8.x` ff `e6f18bf0..92652e53`**；塔台填 README 三處「待定」→ `>= 0.8.0-pre.3`（`d637350b`）。**PLAN-068 實作全部完成**。07:12 D335：使用者定版號 `0.8.0-pre.3`、授權 push 並出測試版（desktop-build）。去識別 0；金鑰樣式新增 2 處為 `tower-cards.test.ts` 遮罩測試的假字串；push `main` `85613f0e..c6163e5e`、`v0.8.x` `fda8a4b4..d637350b`。desktop-build run `45508026501` success（checkout `d637350b`，`0.0.0-exp.20`，三平台 artifact 保留到 2026-12-01）→ 通知 CT。**待實機**：使用者 M-U1–U8 / M-R1–R2，CT M-C1–C7。07:3x CT 回覆：M-C6 已確認（CT 6.1.0-pre.1 照 T0902:538 處理）；佔位字串 CT 自己換；M-C1–C7 等使用者決定測試版 BAT＋CT 6.1.0-pre.1 怎麼安裝。 2026-11-25T09:56:22+08:00 使用者裁示：BAT 測試版用 zip 免安裝版（SHA256 與 SHA256SUMS 相符），解壓在 `%LOCALAPPDATA%\BAT-TestBuilds\0.0.0-exp.20-win`，以 `start-bat-test.cmd`（`--runtime=test`，資料在 `%APPDATA%\BetterAgentTerminal-runtime-test`，清掉繼承的 `BAT_*` / `CT_*` / Claude session 變數）啟動，與安裝版 `0.8.0-pre.2` 並存（M-C6 照用安裝版）；測完刪這兩個資料夾。已轉告 CT。 2026-11-25T09:57:15+08:00 CT 驗收安排：測試版＋CT 6.0.2 先跑 M-C7 前半（測試專案在 `%LOCALAPPDATA%\ct610-accept\ct-test-project`）→ 使用者層暫換 CT 6.1.0-pre.1 跑 M-C7 後半、M-C1–C5，安裝版跑 M-C6 → 立即還原 6.0.2。**換版期間（CT 會先通知）本塔台不重新開工、不執行 /control-tower、不派 Worker**，CT 通知還原後解除。 2026-11-25T10:02:23+08:00 安裝版實為 `0.8.0-pre.1`（使用者未裝 pre.2）；M-C6 以 pre.1 當舊 BAT，等效（HANDOVER 註記）。 2026-11-25T10:06:30+08:00 使用者要 M-C1–C7 在隔離測試版自動化；CT 提議 BAT 主導執行、CT 定規格與判定 → BAT 回覆同意：Playwright＋`BAT_E2E_EXECUTABLE` 驅動 zip 測試版、M-C6 用 `v0.8.0-pre.1` zip 另一個 runtime（不碰安裝版）、以 `CLAUDE_CONFIG_DIR` 隔離 CT 版本與 bat-hooks（不切使用者層、不需凍結期），使用者需在該目錄登入一次；等 CT 確認方式與 checklist 定稿後，問使用者再開工單。 10:07 CT 同意（測試目錄 `ct610-accept/claude-config`、CT T0561 做安裝與 checklist、結果檔 `ct610-accept/results/`、每情境一份 `runs/<情境>/`）；使用者同意開單（D336）→ **T0915 已建（PENDING，分支 `ct/T0915` @ `d637350b`），等 CT 通知 T0561 完成＋使用者在測試目錄登入後派工**。 10:15 CT T0561 完成（checklist `54119d74`，S1/S2/S3）→ T0915 加〈塔台補充（派工前）〉（換版指令、權限用工作區啟動參數、M-C5 另開預設權限塔台）。10:29 使用者已在 `claude-config` 登入（只確認檔案存在）→ **派 T0915**（worktree `ct/T0915`，started 10:29:43）。跑完通知 CT 結果檔位置。 2026-11-25T11:08:11+08:00 使用者交辦（待做）：**驗收都完成後**（T0915＋CT 端判定、若有修正也完成）產生網頁版使用說明（Artifact，附機制圖），描述 PLAN-068 新增功能與使用方式；內容以當時 `v0.8.x` 與 `site/tower-inbox.md`、`docs/agent-guide/tower-inbox.md` 為準。
> 12:19 T0915 收單 DONE（10:29–12:17；`4f7484bc`＝`e2e/manual/` 驅動＋fixture opt-in `dropEnv`，vite build／兩個 typecheck 0、t0644／t0562 不回歸）：BAT 端 M-C1–M-C7 多數 PASS；FAIL：M-C1-2 待辦分頁標頭（要 ↻）、M-C2-b 全螢幕塔台閱讀保護只 10 s；M-C5 過程發現排隊權限詢問提早清 blocked；未觸發：M-C7 P-1 toast、M-C3-2（M-C4 補驗 PASS）。`--close-worker T0915 --worktree keep` exit 0；`ct/T0915` ff `v0.8.x` `d637350b..4f7484bc`。已通知 CT 結果檔位置＋總表（等 CT 端判定）。D337：開 BUG-220／221／222，建分支 `ct/T0916`／`T0917`／`T0918`（`4f7484bc`）平行修正；修完合併、出測試版、補驗 M-C1-2／M-C2-b／M-C5-3 後才發 pre.3。 12:22 派 T0916／T0917／T0918（yolo、worktree，exit 0，皆 started）。 D176 掃描：T0915 工單有 7 處本機家目錄路徑（已推送過），已改成 `<使用者資料夾>`；T0918 同樣有 1 處，Worker 執行中不同時寫入，收單時改。 CT 端判定完成（CT D878，`84a34c3`）：M-C1–M-C7 CT 端全部 PASS（M-C3-2 CT 端判「未觸發」，M-C4 補驗 PASS）；BAT 端 3 項 FAIL 屬 BAT、CT 不需改版；補驗只要不改 `--set-role` 輸出與契約欄位，CT 不必重判（T0916–T0918 都不碰這兩者）；CFG/ 與 bat-hooks plugin 保留到補驗與發版後由使用者決定清理；版號若不是 `0.8.0-pre.3` 要先告訴 CT。 [提問] 12:26 T0916 Q-1（BAT 問答通道）：fs:watch 加選用 `{ recreate: true }` 需改 `electron/preload.ts`、`src/types/electron.d.ts` → 塔台答 A（允許，Worker 自行補 affects_files；只有 acquireDirWatch 帶；proxied／headless／舊 bat-server 相容要說明；事件驅動、輪詢 ≥ 2 s）。 12:33 T0916 收單 FIXED（`d81fdc4c`：`fs:watch` `{ recreate: true }` 只給 `acquireDirWatch`，preload／electron.d.ts 依 Q-1；test:unit 第一次即綠 8965、vite build／兩個 typecheck 0；e2e 未加，留實機驗收）→ `--close-worker T0916 --worktree keep` exit 0、`behind 0`＋乾淨 → ff `v0.8.x` `4f7484bc..d81fdc4c`；BUG-220 FIXED。T0917／T0918 因此落後 1 個 commit，收單時改走合併工單（模式 ②）。Worker 後續建議：其他 `fs.watch` 呼叫者刪目錄空轉（既有，另案）、`ct-tower-overview.md:125` 可順手補一句（不開單）。 12:39 T0917 收單 DONE（`91c49360`：alt buffer 往上捲後維持閱讀中直到按鍵 / 點擊 / 切走 / 捲回，60 s 上限不變；test:unit 第一次即綠 8970、e2e t0904 ⑥／⑥b 第 2 次 PASS）→ `--close-worker T0917 --worktree keep` exit 0；`ct/T0917` 落後 `v0.8.x` 1 個（T0916），`merge-tree` 試合併無衝突 → 等 T0918 收單後開一張合併工單（模式 ②）一起併；BUG-221 FIXED。 12:45 T0918 收單 FIXED（`8d36b036`：未結束的權限詢問 ≥ 2 時使用者輸入 / 滑鼠不清 blocked，由該批 `post-tool-batch` 等清除；不改 hook；test:unit 第一次即綠 8965、legacy 472、e2e t0787 2 passed）→ `--close-worker T0918 --worktree keep` exit 0；BUG-222 FIXED；T0918 工單 1 處家目錄路徑去識別化（D176）。開合併工單 T0919（模式 ②，T0917→T0918 依序 `--no-ff` 到 `ct-merge/T0919`，基底 `d81fdc4c`；三組 `merge-tree` 皆無衝突）。 12:46 派 T0919（exit 0、started）。13:02 T0919 收單 DONE（merge1 `d000da58`、merge2 `6d7b4cd3`，無衝突、無範圍外檔案；test:unit 第一次即綠 9001、legacy 472、e2e t0904／t0787／t0913 各 1 次 PASS）→ 收單 SHA 比對：parent 鏈 `d81fdc4c`→`d000da58`(+`91c49360`)→`6d7b4cd3`(+`8d36b036`) 相符、`v0.8.x` 仍 `d81fdc4c` 且為祖先 → `--close-worker T0919` exit 0；整合 worktree detach 到 `6d7b4cd3`；ff `v0.8.x` `d81fdc4c..6d7b4cd3` 並推送；worktree T0915–T0918 乾淨 → `git worktree remove`（分支保留）。desktop-build run `45550729062`（#21 → `0.0.0-exp.21`，ref `v0.8.x`）。開 T0920 補驗工單（等建置完成、塔台下載解壓後派工；分支 `ct/T0920` 從 `6d7b4cd3`）。注意：CFG 的 bat-hooks plugin marketplace 指向已刪的 T0915 worktree（T0920 前置條件 ④ 處理）。 desktop-build `45550729062` success（typecheck／tests／三平台 build）；win artifact 下載到 `BAT-TestBuilds/run-45550729062/`，BUILD-INFO commit `6d7b4cd3`、zip SHA-256 `a378c145…` 與 SHA256SUMS 相符，解壓 `0.0.0-exp.21-win/`（`package.json` `0.0.0-exp.21`）。13:27 派 T0920（yolo、worktree，exit 0、started）。 14:10 T0920 收單 DONE（13:27–14:07，無 repo 變更）：R1／R2／R3 BAT 端全部 PASS；前置 ④ bat-hooks plugin `failed to load` → 已以 `claude plugin disable` 停用（只動 CFG）；使用者層 `~/.claude` 前後雜湊相同；R2 按 ← 觸發 claude 背景 daemon，Worker 已結束本單建立的程序樹。`--close-worker T0920 --worktree keep` exit 0、worktree 已移除。D338：BUG-220／221／222 CLOSED；縮圖 📨 reading 提示三語系改字串 → `v0.8.x` `5e541975`（test:unit 9001 綠）。驗收提示：全螢幕 claude 塔台的「中性鍵」用 End／Home（↑↓ 算草稿、← 開 agents）。待使用者：測試塔台把 R3 `_tower-state.md` 發成私人 artifact（是否刪除）；確認發佈 `0.8.0-pre.3`。 使用者核定（D339）：發佈 pre.3、刪除誤發 artifact（已讀確認為測試狀態檔；delete 需使用者本人確認 → 請使用者自行刪除）。14:22 通知 CT 後觸發 `pre-release.yml --ref v0.8.x -f version=0.8.0-pre.3`（run `45560094561`，`5e541975`）。CT 回覆：誤發 artifact 判為模型選錯工具（CT 記觀察）、CT 端判定維持 D878。 CI run `45560094561` 全綠（typecheck／tests／server-bundle×3／三平台 build／release）→ **`v0.8.0-pre.3` 發佈 14:44:08**（prerelease，`5e541975`，4 個安裝檔同 pre.2）、`server-bundle-v0.8.0-pre.3` 14:44:38；14:45 貼更版重點；通知 CT 上線時間（CT 決定直接發 6.1.0 正式版，D879；BAT 文件本來就寫 6.1.0，不用改）。`v0.8.x` `4ce779ee`：package 版號 0.8.0-pre.3＋CHANGELOG；main：release-note.md／CHANGELOG.md 同步。網頁版使用說明已完成：私人 Artifact https://claude.ai/artifact/8mepgGP16ghS3m9hsu2Wst（BAT 設計系統；版本需求、待辦七區、回答循環圖、通知保護前後對照＋路徑圖＋閱讀時間線、縮圖標示、bat-hooks、已知限制）。誤發的測試 artifact：使用者已自行刪除（15:24 讀取回 not found，確認已不存在）。 15:25 使用者「收工」：本 session 結束。成果：PLAN-068 W0–W9 實作、T0915 自動驗收、BUG-220／221／222 修正與補驗、`0.8.0-pre.3` 發佈（CT 6.1.0 同日）、網頁版使用說明、測試環境與工作分支清理。 14:51 使用者：「清理測試環境」→ 先把 `ct610-accept/results/`＋兩份 checklist 打包成 `%LOCALAPPDATA%/BAT-acceptance-evidence/ct610-accept-results-20261125.zip`（24.4 MB，163 項，BUG-220–222 結案證據）；刪除 `%LOCALAPPDATA%/BAT-TestBuilds`（6.6 GB）、`%LOCALAPPDATA%/ct610-accept`（含測試用 claude-config）、`%APPDATA%/BetterAgentTerminal-runtime-e2e-t0609-…`（11/02 遺留）；`runtime-test` 本來就不存在；刪除前查無相關程序；已通知 CT 證據 zip 位置。已合併的分支 `ct/T0915`–`T0918`、`ct/T0920`、`ct-merge/T0919` 未刪（等使用者授權）。 15:22 使用者：「要刪」→ 逐一確認為 `v0.8.x` 的祖先後以 `git branch -D` 刪除 6 個本機分支（`-d` 以 `main` 比對會擋，`v0.8.x` 尚未併回 main）；遠端本來就沒有這些分支。 15:19 CT 通知：CT 6.1.0 正式版已發佈（`ct-v6.1.0`，2026-11-25 15:13，Latest；公開站新頁 /deep/features/bat-todo；BMad-Guide D881，PLAN-018 結案），本輪 BAT↔CT 協作結束。BAT 更版重點與 release-note.md 加上 CT Release 連結（`0ce65846`），使用說明頁頁尾同步加連結。
>
> 🛏 **第一百二十九 session 收工**（2026-11-24 03:50 (UTC+8)）。

> 🟢 **第一百二十九 session 開工**（2026-11-24 03:37 (UTC+8)，CT v6.0.0，環境快照已逾 7 天 → 只重掃 git / BAT / 計數 / 大小（Full Scan 精簡版）；塔台 session `13362cf3-7ad3-4d52-a5c9-19757ca9fc0b`；分頁 `3a9b5550…`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；**BAT 安裝版 `0.8.0-pre.1`**（exe FileVersion 與 helper 同版）；`bat-pty-holder` 1 個（PID 19424，WS 68.9 MB / Private 43.0 MB）；HEAD `97d02625` = `origin/main`、`v0.8.x` = `origin/v0.8.x` @ `bcb4bbe0`、工作區乾淨；熱區 286 張工單全 DONE；`bat_list_questions` pending 0；NSIS 重裝驗收 PASS（見 frontmatter `todo`））。

> 最後更新:2026-11-24 03:50 (UTC+8) — **第一百二十九 session 收工**：`v0.8.0-pre.1` NSIS 重裝驗收 PASS；BUG-215 CLOSED（使用者裁示）；移除 worktree `T0886`–`T0890`、刪除已併入 `v0.8.x` 的分支 `ct/T0887`–`ct/T0890`；決策日誌收斂 D001～D185（D316，391,191 → 200,835 bytes）；frontmatter `todo` 只留未結事項（已完成項移到 `2026-Q4-c.md`）；`v0.8.x` 等 pre.1 用一段時間再併回 main。
>
> **下次起手**:熱區工單全 DONE、無派工中工單、BUG 無未結。① `v0.8.0-pre.1` 實際使用觀察（多分頁大量輸出、記憶體），沒問題再把 `v0.8.x` 併回 main → PLAN-066 DONE；② 發佈後驗收（linux / macos / docker、WSL）視需要授權；③ PLAN-065 per-machine UAC 手動驗收；④ 候選見 frontmatter `todo`。

---

## 🛏 本 Session 收工快照 (第一百二十九 session, 2026-11-24 03:37 - 2026-11-24 03:50)

### 主軸：`v0.8.0-pre.1` 發佈後收尾、紀錄瘦身

#### 重點（時間取自系統 / git）

1. **NSIS 重裝驗收 PASS**（`bat-nsis-acceptance-20261124-033551`，AllUsers，從 `0.0.0-exp.18` 升到 `0.8.0-pre.1`；⓪ WARN 屬預期、①–④ PASS、⑤ 略過；PTY holder `24.22.2-7a21c053bf76` 裝上／移除正確；含權杖備份 03:38 刪除）
2. **BUG-215 CLOSED**（使用者裁示；交付版 `v0.8.0-pre.1`＋T0889 實測 C4 −50.1%）→ BUG 熱區無未結（CLOSED 78 / WONTFIX 1）
3. **清理**：移除 worktree `T0886`–`T0890`（皆乾淨）；刪除分支 `ct/T0887`–`ct/T0890`（皆在 `v0.8.x` 內）；`ct/T0885`、`ct/T0886` 保留
4. **D316 決策日誌收斂**：D001～D185 共 122 筆搬到 `_archive/decisions/_decision-log-D001-D185.md`，🔴 / 危害相關 9 筆留在熱檔；熱檔 391,191 → 200,835 bytes；發現索引表只到 D129（既有問題，列為候選）
5. PLAN-066 Q1 / Q5 查證：已由 D307 裁決，更正狀態檔過時待辦；使用者裁示 `v0.8.x` 等 pre.1 用一段時間再併回 main
6. push 前跑 `.private/` 檢查樣式＋金鑰樣式皆 0 筆

### 本輪戰績
- 工單 0；決策 D316；BUG 結案 1（BUG-215）；發版 0

### 編號起始（下 session）
- **T0891** / **BUG-216** / **PLAN-067** / **D317**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-11-24 03:50 UTC+8（第一百二十九 session 收工）

### 近期完成
- **`v0.8.0-pre.1`**（第一百二十八、一百二十九 session）：Windows Terminal Server 共用 conout Worker（10 分頁 164.6 → 38.8 MB，T0886–T0890）；NSIS 重裝驗收 PASS；BUG-214 延後（已知限制）、BUG-215 CLOSED
- **PLAN-066 評估**（第一百二十七 session）：不做 Tauri / 全原生改寫（D307），改做 Node 端局部改進
- **D316** 決策日誌收斂 D001～D185

### 待辦（依優先序；完整內容見 frontmatter `todo`）
1. `v0.8.0-pre.1` 實際使用觀察 → 沒問題再把 `v0.8.x` 併回 main，PLAN-066 → DONE
2. 發佈後驗收（linux / macos / docker、WSL smoke）視需要授權
3. PLAN-065 per-machine UAC 互動升級手動驗收
4. PLAN-052 Docker Desktop 實機精靈；PLAN-058 使用者手動確認；其他待實機驗收項
5. 候選（未開單）：PLAN-066 後續、決策日誌索引重建、D303 暫不安排的項目

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式
- 改 `_bug-tracker.md` / `_backlog.md` 不用全檔 `sed`，改完跑 parser 測試（L179）
- 網站驗證用最新 portal-layout `layout-check.mjs`（目前 v1.1.7）；網站改動 push 才會上線
- 產品改動回到 `main`（D344，2026-11-25；取代 D307 的 `v0.8.x` 分流）：新工單從 `main` 開分支、合併回 `main`，從 `main` 發版（`0.8.0-pre.N`）；`v0.8.x` 保留不再使用

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 0 / Fixing 0 / Fixed 0 / Closed 78 / WONTFIX 1）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D316；D001～D185 封存在 `_archive/decisions/`）｜ Learnings → [_learnings.md](_learnings.md)（最大 L185）
- PLAN-066 Rust 評估報告 Artifact → https://claude.ai/artifact/LYTj1aGEZKq2bu6SMm6ZqT（私人）
- 網站 → https://gowerlin.github.io/better-agent-terminal/
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（148 entries；最新 `2026-Q4-c.md`）

### 編號起始
- **T0891** / **BUG-216** / **PLAN-067** / **D317** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L186** / **CT-T023**

---


## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | main `package.json` **0.7.5-pre.2**；`v0.8.x` **0.8.0-pre.1**；下一版 **`0.8.0-pre.2`**（D315 `0.8.0-pre.N` 線，從 `v0.8.x` 發） |
| **最新 release** | `v0.8.0-pre.1`（2026-11-24 03:24 (UTC+8)，Pre-Release `45244996161`，從 `v0.8.x`）；前一 tag `v0.7.5-pre.2`；更早見 `release-note.md` / `CHANGELOG.md` |
| **目前主軸** | `v0.8.0-pre.1` 實際使用觀察，之後 `v0.8.x` 併回 main；無派工中工單 |
| **工單最大編號** | **T0890** DONE；熱區 286 張全 DONE |
| **BUG 最大編號** | **BUG-215** CLOSED；熱區 Open 0 / Fixing 0 / Fixed 0 / Closed 78 / WONTFIX 1 |
| **PLAN 最大編號** | **PLAN-066** IN_PROGRESS；IN_PROGRESS 7（038 / 043 / 052 / 058 / 064 / 065 / 066）；IDEA 3 |
| **決策最大編號** | **D316**（決策日誌收斂 D001～D185，第一百二十九 session） |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v6.0.0**（第一百二十五 session 起） |
| **unit test 基線** | main：**8414 passed / 461 files**（T0884 @ `cf0b0809`）；`v0.8.x`：8433 passed（T0888）；typecheck 0 / 0 |
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
