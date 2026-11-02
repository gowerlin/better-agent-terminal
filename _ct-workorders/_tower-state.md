---
schema_kind: tower-state
summary_version: 1
updated_at: "2026-11-02T14:25:28+08:00"
session: "2026-11-02 13:01 第一百零五 session 開工（CT v6.0.0-beta.10）"
next_ids:
  workorder: "T0783"
  decision: "D223"
  bug: "BUG-195"
  plan: "PLAN-060"
todo:
  - "熱區無進行中工單。T0779 DONE（Electron 41.10.7，`a09887fb`；macOS / Linux 待下次預覽版 CI 三平台 build 與 `macos-acceptance.yml`）；T0780 DONE（PLAN-029 DONE）"
  - "進行中（並行）：T0781 研究 PLAN-053 主升級目標版本；T0782 接受 npm 12 lock `peer` 旗標（D222）"
  - "T0782 完成＋聯合驗證綠 → push → 發 `0.7.3-pre.6`（D222；T0781 不阻擋）"
  - "觀察：`electron/__tests__/worktree-status-after-close.test.ts` 在 `test:unit` 全套負載下一次 5 s 逾時（T0780，單檔與第二次全套通過）；再發生才開單評估 timeout"
  - "PLAN-059（Herdr 對照研究，主 PLAN，D219）待拆子 PLAN 與開單；建議先開研究單實測 Q1（Worker 通知打進停在權限對話框的塔台）"
  - "唯一待驗收：BUG-159（一般權限 ＋ codex，需使用者本機）；熱區無進行中工單、無 OPEN BUG"
  - "選擇性：mac 相關修正可用 `macos-acceptance.yml`（`workflow_dispatch -f version=`）回歸（D218）"
  - "觀察：t0757 一次偶發失敗（③ 清除原因 `user-prompt-submit`，疑 `permission-request` hook 晚到，T0775 已加診斷；T0777 重跑未重現）；**再發生才開 BUG**（D218）"
  - "版號線：0.7.3 線已到 pre.5（D204；最多到 pre.9）"
---
# Tower State — better-agent-terminal

> 🟢 **第一百零五 session 開工**（2026-11-02 13:01 (UTC+8)，CT v6.0.0-beta.10，Fast Path；塔台 session `c85c39b0-308c-4087-8f2f-2e18466a0cbd`；`--set-role tower --mode on` exit 0；安裝版 helper `v0.7.3-pre.5`；HEAD `e0c6d63d`、`main` = `origin/main`、工作區乾淨；熱區 174 張工單全為 DONE；BUG 熱區 Fixed 1（BUG-159）/ Closed 57，與 `_bug-tracker.md` 一致，免重建）。使用者要求比較 Herdr（原生桌面版＋herdr-core）與 BAT → 塔台以官方 repo docs 產出研究報告 Artifact「Herdr 對照 BAT」（https://claude.ai/artifact/Ybj66gYLkMHZE8xUyyDiEy，私人）；查證發現 `pty:write` 不看目標是否 blocked（未實測影響）。13:23 使用者「登記為主 PLAN，後續再拆子 PLAN 與拆單、開單」→ **D219** → 開 **PLAN-059**（PLANNED，medium）。PLAN-058 / PLAN-059 互相補〈相關〉：互不依賴，只共用「忙碌時訊息排隊」原則（`c64658ef`）。14:00 使用者問 PLAN-054 是否還需推進 → 查 CT v6 `workflow-engine.md` 仍延後 B6 欄位與契約 → **D220** → **PLAN-054 DONE**（B6 等 CT 契約另開新 PLAN）。14:04 使用者要求核對 PLAN-043 / 051 / 052 → 三張前提仍成立、無需求或觸發，**維持 IDEA**，各補〈2026-11-02 狀態核對〉（051 更正 codex daemon 前提；052 連結 PLAN-059 E）；`docs/plan-007-release-checklist.md` 第 63 行 mirrored 措辭記在 PLAN-043，下次 WSL 工單一併改。14:07 核對 PLAN-015 / 029 / 038 / 053 → 使用者「補，053 調 high 開 41.10.7 小單，029 開刪除單」→ **D221**：PLAN-053 high（lock 鎖 Electron 41.2.1；41 線最後 41.10.7、`latest` 45.2.1）開 **T0779**；PLAN-029 R3 開 **T0780**（刪 `src/components/git-poc/`、`vite.config.benchmark.ts`）；PLAN-015 / 038 維持 IDEA；派工順序 T0780 → T0779。14:10 派 **T0780**（yolo，`started:` exit 0）。**T0780 DONE**（`16a3a326` 刪 15 檔 1344 行、報告 `ea03227b`；無引用確認、`.gitignore` 37–38 行因本機產物仍在而保留；typecheck 0 / 0、vite build、verify-renderer-imports、unit 6705 / 382 files（首跑 `worktree-status-after-close` 負載逾時 1 次，重跑通過））→ **PLAN-029 DONE**；session 快照已寫；`--close-worker T0780`。14:15 派 **T0779**（yolo，`started:` exit 0）。**T0779 DONE**（`a09887fb` `package.json` `^41.10.7`、lock 只改 electron 與其相依（`@electron/get` 2.0.3 → 5.1.0 等）、CLAUDE.md「Electron Runtime」；報告 `11004251`；Chromium 146.0.7680.216 / Node 24.18.0 / ABI 145；verify-native-modules、typecheck 0 / 0、vite build、unit 6705 / 382 files、legacy 472 / 33、`build:dir`＋`verify-packaged-native` 綠、打包產物 Electron 41.10.7；e2e 冒煙 5 支綠（t0572 / t0776 / t0735 / t0762 / t0744）；macOS / Linux 未驗證；npm 12 重算 lock 的 100 項 `peer` 旗標漂移未寫入（與 electron 無關，列待決））；session 快照已寫；`--close-worker T0779`。14:28 使用者「PLAN-053 主升級現在開研究單，2、3 依塔台建議」→ **D222** → 開 **T0781**（研究）、**T0782**（lock `peer` 旗標），並行派工；T0782 後發 `0.7.3-pre.6`。

> 🛏 **第一百零四 session 已收工**（2026-11-02 11:17 (UTC+8)）。本 session 各次開工 / 重啟條目已移入下方〈本 Session 收工快照（第一百零四 session）〉時間線。

> 最後更新:2026-11-02 11:17 (UTC+8) — **第一百零四 session 收工**：`v0.7.3-pre.2`–`pre.5` 四次發佈；pre.4 / pre.5 自動化驗收（安裝版、GitHub Actions macOS runner）把 BUG 熱區清到只剩 BUG-159。前次：第一百零三 session 收工（2026-11-01 21:30）。
>
> **下次起手**:熱區無進行中工單、無 OPEN BUG；唯一待驗收 BUG-159（需使用者本機以一般權限＋codex）；t0757 偶發失敗再發生才開 BUG（D218）；mac 相關修正可跑 `macos-acceptance.yml` 回歸；版號線 `0.7.3-pre.N`（已到 pre.5，最多 pre.9）。

---

## 🛏 本 Session 收工快照 (第一百零四 session, 2026-11-01 21:36 - 2026-11-02 11:17, 含五個塔台 session)

### 主軸：pre.1 之後的修正與自動化驗收 → `v0.7.3-pre.2` / `pre.3` / `pre.4` / `pre.5` 四次發佈；pre.4 / pre.5 以安裝版＋macOS runner 自動化驗收，BUG 熱區只剩 BUG-159

#### 時間線（時間取自系統 / git / gh；五個塔台 session）

> 🟢 **第一百零四 session 開工**（2026-11-01 21:36 (UTC+8)，CT v6.0.0-beta.10，Fast Path；塔台 session `3f9b428a-2c04-4a70-8751-68733dd7b1cc`）：BUG-175 / 182 CLOSED → BUG-183–186、T0750–T0753 → **`v0.7.3-pre.2`** 發佈。

> 🟢 **第一百零四 session 塔台重啟**（2026-11-02 00:23 (UTC+8)，CT v6.0.0-beta.10，Fast Path；塔台 session `353a4768-d323-407c-8333-437e0582057f`）：D206–D208 → PLAN-057（T0754 / T0755）、BUG-187（T0756）、WSL 補裝 libatomic1。

> 🟢 **第一百零四 session 塔台重啟（二）**（2026-11-02 01:59 (UTC+8)，CT v6.0.0-beta.10，Fast Path；塔台 session `a6fdcb75-810b-4930-b066-d9e575fd97ff`）：補記 **`v0.7.3-pre.3`** 發佈；BUG-183 / 184 / 186 / 187 CLOSED、PLAN-057 DONE；D209–D214 → BUG-188–192、PLAN-058、T0757–T0769 → **`v0.7.3-pre.4`** 發佈（第一次 run 被 Test gate 擋下，修測試後重發）。

> 以上三則的原文（含逐張工單經過）已移到 [`_archive/state-snapshots/2026-Q4-b.md`](_archive/state-snapshots/2026-Q4-b.md)〈第一百零四 session 開工條目原文〉（2026-11-02 05:03 瘦身）。

> 🟢 **第一百零四 session 塔台重啟（三）**（2026-11-02 04:56 (UTC+8)，CT v6.0.0-beta.10，Fast Path；塔台 session `c46dd3a3-0b3d-4606-b959-5ea60d008605`；`--set-role tower --mode on` exit 0；安裝版 helper `v0.7.3-pre.4`；HEAD `5115cd25`、`main` = `origin/main`（0 / 0）、工作區乾淨；熱區 165 張工單全為 DONE；熱檔皆在 400 KB 預算內，`_tower-state.md` 73,857 bytes 超過本地規則 60 KB 強制提示門檻）。`*sync`（`202db4b7`）→ `*archive --state --rebuild-index`（`7b18cdfd`）→ 瘦身 74 → 38 KB（`47a5c622`）→ push。使用者選自動化驗收 → **D215** → 開 **T0770–T0773**（`08315288`）；05:14 四張派工（yolo，皆 `started:` exit 0）。**T0770 DONE**（`7ad66d1d`，安裝版：BUG-188、detached ⚠️、無焦點淡化全 PASS）→ **BUG-188 CLOSED**；觀察 2 / 1 → 使用者 **D216** → 開 **BUG-193**（low）/ **T0774**（修正，等 T0772 / T0773 後派）/ **T0775**（e2e 關 focus emulation，接 T0774）。**T0771 DONE**（`a173f74a`，安裝版＋真實模型 Haiku 5 回合 US$0.0256）→ **BUG-190 / 192 CLOSED**。**T0773 DONE**（`bb376b41`，安裝版＋真的 claude `--resume` 答出 42、真的 codex `resume`；3 回合 US$0.0197）→ **PLAN-055 DONE**；F1 → 開 **BUG-194**（自動開啟的對話框第一次 Esc 關不掉，low）。**T0772 DONE**（`366b96b0`，安裝版：真的 npm codex、真的 CT plugin）→ **BUG-189 / 191 CLOSED**。四張 session 快照已寫、`--close-worker` 皆已排程；真實模型全批 US$0.045（上限 US$1.00）。05:27 派 **T0774**（yolo，`started:` exit 0）。使用者 **D217** → 開 **T0776**（BUG-194，接 T0774）、T0775 改接 T0776；這批完成後發 `0.7.3-pre.5`。**T0774 DONE**（`bd59ab0f`，查證 CDP 與真實點擊順序相同；取回焦點暫緩判斷；單元 12＋突變、t0770 E 修正前失敗 / 後通過、t0735 / t0761 / t0762 綠、unit 6693 / 381 files）→ **BUG-193 FIXED**；塔台複跑新單元 12 / 12；session 快照已寫、`--close-worker`；05:38 派 **T0776**（yolo，`started:` exit 0）。**T0776 DONE**（`e717c786`，盤點 4 個自動開啟的 Dialog；`ModalOverlay` 開啟時聚焦、關閉時還原；單元 12＋突變、t0776 修正前失敗 / 後通過、t0563 / t0567 / t0766 / t0767 綠、unit 6705 / 382 files）→ **BUG-194 FIXED**；塔台複跑 33 / 33；session 快照已寫、`--close-worker`；派 **T0775**。**T0775 DONE**（`1068c5f8`，`e2e/helpers/real-focus.ts`；三支關 emulation 各連跑 2 次綠、反證走淡化分支；t0757 一次 flake（③ 清除原因為 `user-prompt-submit`，疑晚到的 `permission-request` hook，已加診斷）） → session 快照、`--close-worker`；06:11 開始聯合驗證。聯合驗證全綠 @ `213d03ef`（typecheck 0 / 0、vite build、unit 6705 / 382 files、legacy 472 / 33）。使用者裁示「照推」（`213d03ef` 歷史留存）；去識別化與金鑰掃描 0（`claude-mem` 2 筆為 origin 既有的誤報）；09:43 push `47a5c622..478fd178`，觸發 `pre-release.yml -f version=0.7.3-pre.5`（run 41373933464）。CI 全綠（含 typecheck / tests / 三平台 build / server-bundle），01:57Z 發佈 `v0.7.3-pre.5`（4 個安裝檔）＋ `server-bundle-v0.7.3-pre.5`；`gh release edit` 寫入更版重點並比對一致；三文件＋`package.json` → `79de9015` push；Pages build / deploy / link-check 綠、首頁顯示 `0.7.3-pre.5`。BUG-193 / 194 維持 FIXED（已發版、待驗收）。

> 🟢 **第一百零四 session 塔台重啟（四）**（2026-11-02 10:12 (UTC+8)，CT v6.0.0-beta.10，Fast Path；塔台 session `49d1e952-e247-4830-b12e-6c99de58e501`；`--set-role tower --mode on` exit 0；安裝版 helper `v0.7.3-pre.5`；HEAD `eb9a41f3`、`main` = `origin/main`、工作區乾淨；熱區 172 張工單全為 DONE；BUG 熱區 Fixed 5（128 / 130 / 159 / 193 / 194）/ Closed 53，與 `_bug-tracker.md` 一致，免重建；`_tower-state.md` 41 KB 超本地 30 KB 軟警告）。使用者三項指示：① 開 **T0777**（安裝版 pre.5 自動驗收 BUG-193 / 194，不回歸含 t0757）並派工；② 評估以 GitHub Actions macOS runner 驗 BUG-128 / 130；③ t0757 偶發失敗「先記住，又發生再開單」。10:44 派 **T0777**（yolo，`started:` exit 0）。使用者同意 → 開 **T0778**（macOS runner 探路，`workflow_dispatch` only、≤ 8 run，授權 push main），10:47 派工（yolo，`started:` exit 0）。**T0777 DONE**（`e1e7f2d1` / 回報 `954b0348`；安裝版 pre.5：t0770 A–E、t0776、新 t0777 user32 真實點擊 HWND 比對 PASS；不回歸 t0735 / t0761 / t0762 / t0563 / t0567 / t0757 綠，t0757 偶發失敗未重現；typecheck 0 / 0）→ **BUG-193 / 194 CLOSED**（R-G003）→ 熱區 Fixed 3 / Closed 55；session 快照已寫；`--close-worker T0777`。**T0778 DONE**（`051b053e` / `4ef73ab0` / `083a66ce` / 回報 `064f337d` `5516dec6`，已 push；`macos-acceptance.yml` run `41380866131` success，2 / 8 run；`macos-15` Aqua 可用、Finder Apple Events 與 System Events 送鍵未被 TCC 擋；BUG-128 ①–④、BUG-130 ⑤–⑦ 全 PASS（60 次按鍵 0 失敗）、⑧ 內嵌 claude `[Image #1]`、模型請求 0）→ **BUG-128 / 130 CLOSED**（R-G003）→ 熱區 Fixed 1 / Closed 57；session 快照已寫；`--close-worker T0778`。

- 11:17 使用者「收工」。收工前：`.private/` 去識別化樣式 4（claude-mem 殘留標籤）排除路徑改到 T0676 歸檔後位置並排除 `2026-Q4-b.md`（本機檔，重跑 0 筆）；push `5516dec6..eade725c`（掃描 0）；D218、L178。

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | 29 | T0750–T0778 皆 DONE；最多 4 張並行（T0770–T0773） |
| 決策 | 13 | D206–D218 |
| BUG | 開 12 / 結 16 | 開 BUG-183–194；本 session 結案 16 張（含 BUG-128 / 130 / 193 / 194）；熱區 Open 0 / Fixed 1（BUG-159）/ Closed 57 |
| PLAN | — | PLAN-057 / PLAN-055 DONE；開 PLAN-058（IDEA） |
| 發版 | 4 | `v0.7.3-pre.2` / `pre.3` / `pre.4` / `pre.5` |
| 真實模型花費 | 重啟（三）起約 US$0.045 | T0771 0.0256、T0773 0.0197；更早見歸檔 |
| macOS runner | 2 run | `macos-acceptance.yml`（T0778），公開 repo 標準 runner 免費 |

### 重點觀察

- 驗收預設走「安裝版 `BAT_E2E_EXECUTABLE` 隔離實例＋假模型」，真實模型只做小額 spec；mac 改用 GitHub Actions `macos-15` runner 對交付版 dmg 實測（Finder 真複製＋System Events 按鍵，TCC 未擋，L178 / D218）
- Playwright 預設做 focus emulation，`document.hasFocus()` 恆為 true；量焦點的 e2e 要經 `e2e/helpers/real-focus.ts`（T0775）
- 作業系統真實點擊（user32）可在本機驗，但點擊前必須以 HWND 確認是隔離實例的視窗（T0774 / T0777）
- 後續候選：BUG-194 的 `AppNotificationDialog` / `RecoveryPrompt` 只有單元測試；BUG-128 的 Claude / Codex 面板 Finder 貼上未在 mac 實測；mac 中文檔名情境

### 編號起始（下 session）

- **T0779** / **BUG-195** / **PLAN-059** / **D219** / **EXP-WFMINE-002** / **L179** / **CT-T023**

---

## 🛏 前 Session 收工快照 (第一百零三 session, 2026-11-01 17:11 - 21:30, ~4h20m)

### 主軸：pre.6–pre.8 待驗收的自動化驗收（T0736–T0748）→ BUG-180 / 181 / 182 → `v0.7.2-pre.9`、`v0.7.3-pre.1`（D204 換線）

#### 時間線（時間取自系統 / git / gh；塔台重啟兩次，三個塔台 session）

- 🟢 **第一百零三 session 開工**（2026-11-01 17:11，CT v6.0.0-beta.10，Fast Path；塔台 session `fed6cdeb-3c98-4969-ba4c-adec3afbe52f`；`--set-role tower --mode on` exit 0；安裝版 helper `v0.7.2-pre.8`；HEAD `1f58d877` = 上次收工 commit、工作區乾淨，`*sync` 沿用收工時索引）。使用者「安排 pre.8 的自動驗收」→ **T0736**（真的 claude CLI / codex 觸發工作區 ⚠️，本機假模型）17:14 派工，`started:` exit 0。使用者「順便安排 pre.7 的自動驗收」→ **T0737**（BUG-179 隔離實例輪替＋BUG-177 / 178 介面 e2e），`depends_on: T0736`（錯開 `vite build`），T0736 收單後派。使用者「也查看看 pre.6 等之前還沒驗收的」→ 依 R-G003 **BUG-167 / 168 / 170 CLOSED**（pre.8 CI `tests / unit-tests` success；T0695 / T0696 實機）→ 熱區 Fixed 26 / Closed 17；開 **T0738**（22 張 FIXED BUG 自動化盤點＋重跑既有 e2e，`depends_on: T0737`）。使用者「1. 派一張小單用真實模型跑 2. 不能直接以最新版現況驗測嗎」→ **T0739**（真實模型小額：Haiku 5.5、4.x 對照 1 回合、≤ 12 回合、≤ US$1，`depends_on: T0738`）；**T0740**（NSIS 重裝獨立腳本，Worker 只演練不安裝，使用者關 BAT 後實跑）17:36 派工 `started:`，與 T0736 並行（不 build、檔案不重疊）。派工順序：T0736 → T0737 → T0738 → T0739。**T0736 DONE**（17:37，`0232034f`；①–⑥ 全 PASS、模型對外 0；t0735 / t0609 / t0590 / t0621 綠；session 快照已寫；`--close-worker T0736` exit 0）→ 開 **BUG-180**（剛開分頁被切走 PTY 9x5）；附註：claude 2.1.316 auto mode 在 gateway 下不觸發 `PermissionRequest` hook（claude 行為）。17:40 派 **T0737**（`started:`）。使用者「BUG-180 現在開單修」→ **T0741**（17:46 派工 `started:`；build / e2e 等 T0737 結案後才跑），T0738 改 `depends_on: [T0737, T0741]`。**T0740 DONE**（17:46，`ba38d83d`；腳本 `e2e/manual/nsis-reinstall-acceptance.ps1`＋README；`-DryRun` PS 7 / 5.1 綠；偵測 AllUsers（HKLM）、`C:\Program Files\BetterAgentTerminal`、pre.8；執行中 11 程序 → 實跑會中止；安裝檔已下載並 SHA-256 PASS；release 無 `latest.yml`；實際模式未跑過）；session 快照已寫；`--close-worker T0740` exit 0。更正：本機 BAT 是提權執行（T0738 背景已改）。使用者確認安裝版 = pre.8。**T0737 DONE**（17:56，`cb22545b`；BUG-179 ①–⑤ PASS、BUG-177 / 178 介面情境 PASS、對外 0；pre6 ①–⑫ 綠）→ 使用者安裝版 17:10:40 已實機輪替（42.3 MiB，只看檔名大小）→ **BUG-177 / 178 / 179 CLOSED**（R-G003）→ 熱區 Open 1 / Fixed 23 / Closed 20；session 快照已寫；`--close-worker T0737` exit 0；T0741 可開始 build。**T0741 DONE**（18:03，`4500984d`；`canFitTerminalContainer`（`src/lib/terminal-fit-guard.ts`）＋ initial resize 到期再檢查 active；9x5 = `display:none` 時 FitAddon 讀到 `100%`；突變檢查：未修正 e2e 三輪 9x5 失敗；unit 6331 / 358 files、typecheck 0 / 0；t0572 / t0571 / v072-pre8 綠）→ **BUG-180 FIXED**（熱區 Open 0 / Fixed 24 / Closed 20）；session 快照已寫；`--close-worker T0741` exit 0；派 **T0738**。**T0738 DONE**（18:25，`384ab82d`；22 張：A 12 / B 4 / C 6；既有 e2e 14 支在 HEAD 全綠、新增 3 支（BUG-127 / 131 / 175）；本機 BAT 提權、Docker engine 未執行、WSL Ubuntu-24.04 Running）→ **A 類 12 張 CLOSED**（BUG-116 / 118 / 127 / 129 / 131 / 132 / 133 / 134 / 137 / 146 / 147 / 171，R-G003）→ 熱區 Open 0 / Fixed 12 / Closed 32；**去識別化**：BUG-134 回報者真名 → 「外部測試者B」（3 個追蹤檔，`.private/` 對照表與檢查樣式已補；歷史 commit 仍有）；BUG-097 漏列於 T0738（Docker，歸 C）；開 **T0742**（B 類補 e2e：135 / 156 / 108 / 107 / 159 子項，`depends_on: T0739`）；session 快照已寫；`--close-worker T0738` exit 0；派 **T0739**（18:27 `started:`）。使用者「Docker 用 wsl 內的 DOCKER 或 GXDOCKER remote」→ 唯讀探測：WSL Docker 29.1.3 執行中（已有 1 個使用者容器）、`~/.ssh/config` 有 `gxdocker`、Docker Desktop 未執行 → 開 **T0743**（BUG-097 / 105 / 111；WSL 優先、gxdocker 須先問塔台；不改環境、只動 `bat-e2e-t0743-` 資源；`depends_on: T0742`）。派工順序：T0739 → T0742 → T0743。**T0739 DONE**（18:42，`4f195570`；真實模型 10 回合 US$0.1514；①②⑥⑦ PASS、③ Grep 卡片、④ Haiku 5.5 / 4.5 都用 Task*（5.5 先 ToolSearch）、⑤ 背景 Agent 不在 active task bar；spec 預設 skip）→ 開 **BUG-181**（Cache History 累計值重複計算）；session 快照已寫；`--close-worker T0739` exit 0；派 **T0742**（18:45 `started:`）。使用者「BUG-181 現在開單修，殘留目錄幫我刪」→ 塔台刪除 `~/.claude/session-env/8e50ff27-…`、`tasks/8e50ff27-…`（先確認為 T0739 產物）；開 **T0744**（BUG-181 修正，build / e2e 等 T0742 結案），T0743 改 `depends_on: [T0742, T0744]`。**T0742 DONE**（19:05，`c3bab480`；①–⑤ PASS ×2、①③④⑤ 驗紅；在 `git archive` 匯出目錄驗，避開 T0744 未提交變更）→ **BUG-135 CLOSED**；BUG-156 / 107 / 108 本機部分驗過，Docker / 遠端部分併入 **T0743**（④⑤）；BUG-159 維持（注入驗過，daemon 行為需一般權限；附註 npm 安裝的 codex shim 不注入 `--no-daemon`、`t0584` 第 275 行斷言依賴 npx PATH，列候選）；熱區 Fixing 1 / Fixed 11 / Closed 33；session 快照已寫；`--close-worker T0742` exit 0。**T0744 DONE**（19:09，`0d42ebdc`；`turnModelUsage` / `applyStatusToCacheHistory` 依 model 差值、resume 第一回合標 `R*`（includes-prior）、合計 = 最後累計；Codex 不送 `modelUsage`、`turn.completed.usage` 為單回合（不改）；unit 6339 / 358 files、typecheck 0 / 0、e2e t0744 / pre6 / pre7 綠；範圍外改 `electron/__tests__/claude-cache-history-last-call.test.ts` harness 為實際累計格式（必要，斷言意圖保留）；Worker 同批更新 `_bug-tracker.md`）→ **BUG-181 FIXED**；session 快照已寫；`--close-worker T0744` exit 0；派 **T0743**。**T0743 DONE**（19:37，`60419cc2`；WSL Docker 29.1.3、未用 gxdocker；測試專用 `docker.exe` shim 只在隔離實例 PATH、擋非本單容器；①–⑤ PASS ×2；使用者資源前後清單相同、使用者容器 StartedAt 不變；自建資源全清（build cache 保留，`builder prune` 禁止））→ **BUG-097 / 105 / 107 / 108 / 111 / 156 CLOSED**（R-G003）→ 熱區 Fixed 6 / Closed 39；去識別化：T0743 frontmatter 的 gxdocker 帳號名已移除（塔台自己寫入；本 session 尚未 push，但 `08b2a30f` 等歷史 commit 仍含，push 後會公開；帳號名與 GitHub 帳號同名、風險低）；session 快照已寫；`--close-worker T0743` exit 0。使用者「發 0.7.2-pre.9，用新版跑 NSIS 驗收腳本」→ 聯合驗證 @ `329eeca8` 全綠（typecheck 0 / 0、vite build、unit 6339 / 358 files、legacy 472 / 0）→ 去識別化：T0738 回報的家目錄路徑改代稱（`5e33faec`；樣式 2 兩筆既知誤報）、金鑰 0 → push → **`v0.7.2-pre.9` 發佈**：run `41303235035` 12 job 全綠（target `5e33faec`，publishedAt 2026-11-01T11:57:09Z）；exe 292 / zip 458 / AppImage 328 / dmg 345 MiB；server-bundle 7 assets；更版重點已寫（無 codex 變更，省略「歡迎協助測試」）；package.json → pre.9；文件 `e8384f6f`（README 無需更新）；Pages `41304300492` 綠、link-check 1392 / 0、首頁 pre.9。0.7.2 線已用完。

- 🟢 **第一百零三 session 塔台重啟**（2026-11-01 20:04，CT v6.0.0-beta.10，Fast Path；塔台 session `dbf4ae74-4623-45e0-89e6-9b7c9361a5df`；BAT 重開（使用者跑 NSIS 驗收）；`--set-role tower --mode on` exit 0；安裝版 helper `v0.7.2-pre.9`；HEAD `bc2fd0d8`、工作區乾淨，`*sync` 沿用索引）。NSIS 驗收報告 `%TEMP%\bat-nsis-acceptance-20261101-200229\report.md`（real，20:02:29–20:03:18）：⓪ WARN（安裝版 pre.8 ≠ 目標 pre.9，預期）、① PASS（SHA-256 = GitHub digest）、② **FAIL**：exit 0、DisplayVersion / FileVersion / `resources/package.json` / 三個 helper `--version` = pre.9、內嵌 claude / codex、捷徑、沒有並存安裝、未自動啟動皆 PASS，**唯一失敗**是 userData 變更 1 檔 `Logs/bat-scripts.log`（塔台推論：腳本在快照之間自己以 node 跑三個 helper `--version`，helper 會寫這個檔 → 腳本誤判，未查證）；腳本在 ② 停止，③ 解除 / ④ 乾淨重裝未跑；userData 備份（含權杖檔）在同目錄 `userdata-backup`。使用者選「開 T0745 修腳本再重跑」→ **T0745**（查證 `bat-scripts.log` 變更來源、修腳本 ② / ④，只演練不安裝）20:06 派工，`started:` exit 0。**T0745 DONE**（20:09，`ae6b4f84`；查證：快照後 `bat-scripts.log` 純 append，新增的是腳本自己在 BAT 外跑的 `bat-terminal` / `bat-notify` `--version`（`bat-mcp` 不寫）；修正：helper 子程序設 `BAT_HELPER_LOG_DIR=<報告目錄>\helper-logs`、`$OutDir` 轉絕對路徑，userData 比對規則不變；`-DryRun` PS 7 綠、PS 5.1 語法 0 錯）；session 快照已寫；`--close-worker T0745` exit 0。待使用者關 BAT 重跑實際模式（`-Version 0.7.2-pre.9`，同版本覆蓋 ＋ ③ ④）。

- 🟢 **第一百零三 session 塔台重啟（二）**（2026-11-01 20:19，CT v6.0.0-beta.10，Fast Path；塔台 session `dad82733-7c69-4daa-ac50-d34ffbe6cf0e`；NSIS 驗收後 BAT 重開；`--set-role tower --mode on` exit 0；安裝版 helper `v0.7.2-pre.9`；HEAD `c272c36d`、工作區乾淨，`*sync` 沿用索引）。**NSIS 驗收 PASS**：報告 `%TEMP%at-nsis-acceptance-20261101-201803
eport.md`（real，20:18:03–20:18:31，PS 7.6.9 系統管理員）：⓪ PASS（AllUsers / HKLM、安裝版 pre.9、0 個執行中程序、userData 72 檔快照）、① PASS（SHA-256 = GitHub digest）、② 同版本覆蓋 PASS（11.2 s；版本 / helper `--version` / 內嵌 claude / codex / 捷徑 / 無並存 / 未自動啟動；userData 新增 0 / 刪除 0 / 變更 0，T0745 修正生效）、③ 靜默解除 PASS（1.9 s；鍵、目錄、捷徑移除，userData 保留未改）、④ 乾淨重裝 PASS（8.9 s）、⑤ 未選做。pre.6 起待驗的「Windows NSIS 覆蓋 / 乾淨重裝」以本次結案。userData 備份（含權杖）兩份待使用者確認刪除。使用者選「實機驗收」→ 自動化三項全派：開 **T0746**（BUG-181 真實模型複驗，先 `vite build`，≤ 12 回合 / US$0.5）、**T0747**（工作區 ⚠️ 真實模型 Haiku 5.5，含 auto mode 觀察，≤ 10 回合 / US$0.5）、**T0748**（WSL 遠端工作區 ⚠️，假模型、不動使用者 WSL bat-server）；T0747 / T0748 `depends_on: T0746`（共用 build）、兩者並行（`worker-tab-recycle.md` 重疊，T0748 等 T0747 commit 後再改）。20:23 派 T0746（`started:`）。**T0746 DONE**（20:29，`9e37c226`；`vite build` 綠；真實模型 8 回合 US$0.148；Cache History 兩次啟動逐列 = CLI 累計差值（依 model）、換模型子列從 0 起算、resume 首列 `R*`、real $ 合計 = `total_cost_usd`（差 < US$0.00005）；spec 加 DOM 比對、`BAT_E2E_RUN_TAG`、費用上限 0.5；觀察：4.5 換模型重寫 cache 是費用大宗、resume 時 CLI 以前一 model 發內部請求，皆非 BAT）→ **BUG-181 CLOSED**（R-G003）→ 熱區 Fixed 5 / Closed 40；session 快照已寫；`--close-worker T0746`；派 T0747 / T0748（20:32，皆 `started:`）。使用者回報安裝版 `v0.7.2-pre.9` 實機：BUG-180（連開 Claude CLI ＋以塔台開啟 Claude，切回不擠成 9 欄）與 pre.8 ⚠️ 視覺（藍底列可讀、淡化可辨、窄側欄排版）皆無問題 → **BUG-180 CLOSED**（R-G003）→ 熱區 Fixed 4 / Closed 41；「視窗沒有焦點時等待結束」已給使用者判斷步驟（`bat-hook.mjs` 計時模擬）。**T0747 DONE**（20:42，`37a745e4`；Haiku 5.5 5 回合約 US$0.021；① default 模式 Bash 權限 → 實心 ⚠️、tooltip 不含指令、看著時核准不留淡化 PASS；③ 塔台分頁 AskUserQuestion → ⚠️ PASS；④ 沒在看時回答 → 淡化、看分頁後清除 PASS；② auto mode：echo / 工作區外寫檔 / rm 皆被放行、無 hook、無 ⚠️（符合設計，classifier 詢問路徑未觸及）；第 1 次執行卡在 claude 信任畫面（0 token），修正後第 2 次通過；spec 加 `--strict-mcp-config`；殘留 `~/.claude.json` 一筆 projects key 未動）；session 快照已寫；`--close-worker T0747`。**T0748 DONE**（20:48，`b0358c8a`；WSL 測試專用 headless server（`/tmp/bat-e2e-t0748`、不經 systemd、使用者 bat-server 前後比對 6 次相同）＋隔離實例遠端 profile 視窗；① WSL 內真的 claude 2.1.300 ＋假 API → `permission` ⚠️ PASS；② OSC 7501 `input` ⚠️ PASS；③ 淡化 / 看過清除 PASS；④ 本機與遠端各自 `⚠️`、`⚠️ 2`、跳到等最久 PASS；對外模型請求 0；情境前提修正：遠端工作區只在該 profile 視窗列出，本機視窗本來就不列；⑤ server 重啟後 ⚠️ 不清除）→ 開 **BUG-182**（OPEN，low）；session 快照已寫；`--close-worker T0748`。使用者「BUG-182 現在開單修」→ **T0749**（重連時依 server 現況對帳 attention，e2e ⑤ 改斷言＋突變檢查）、BUG-182 → FIXING，20:51 派工（`started:`）。使用者「要刪兩份 userData 備份」→ 塔台刪除 `%TEMP%\bat-nsis-acceptance-20261101-200229\userdata-backup`、`…-201803\userdata-backup`（各 72 檔，含權杖；報告與安裝檔保留）。**T0749 DONE**（21:07，`01796a9e`；新增唯讀 proxied channel `terminal:attention-snapshot`（main 與 headless 都註冊），renderer `createReconnectAttentionReconciler` 在遠端「未連線 → 已連線」時對帳：PTY 不在 → 與 PTY 結束同一段處理（沒在看留淡化）、PTY 在 → 以 server 狀態取代、送出後才到的推送優先；舊 bat-server 無 handler → 保留原狀；unit 6359 / 359 files、typecheck 0 / 0、build；e2e ⑤ 改斷言、突變檢查失敗於 `waiting`、修正後 4 次綠；t0735 / real-agents / t0609 / t0694 / t0538 綠；使用者 WSL 前後相同）→ **BUG-182 FIXED**；session 快照已寫；`--close-worker T0749`。使用者「發 0.7.3-pre.1」→ **D204**（換 `0.7.3-pre.N` 線）→ 聯合驗證 @ `b6f48c07` 全綠（typecheck 0 / 0、vite build、unit 6359 / 359 files、legacy 472 / 0）、去識別化 0、金鑰 0 → push → `pre-release.yml -f version=0.7.3-pre.1` run `41310103490`。**`v0.7.3-pre.1` 發佈**：run `41310103490` 12 job 全綠（target `b6f48c07`，publishedAt 2026-11-01T13:25:58Z）；exe 292.9 / zip 458.9 / AppImage 328.8 / dmg 345.7 MiB；server-bundle 7 assets；更版重點已寫（無 codex 變更，省略「歡迎協助測試」；待驗收含 BUG-182、無焦點時結束、macOS、BUG-159）；package.json → 0.7.3-pre.1；文件 `de8b8a7a`（README 協作表 ⚠️ 列補 `>= 0.7.3-pre.1`）；Pages `41311358391` 綠、link-check 1398 / 0、首頁 0.7.3-pre.1。

- 21:09 **T0749 DONE**（`01796a9e`）→ BUG-182 FIXED；使用者「發 0.7.3-pre.1」→ D204 → 聯合驗證 @ `b6f48c07` 全綠 → push → **`v0.7.3-pre.1` 發佈**（run `41310103490`，publishedAt 13:25:58Z）；更版重點、package.json、文件 `de8b8a7a`、Pages `41311358391` 綠（link-check 1398 / 0、首頁 0.7.3-pre.1）。21:30 使用者「收工」。

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | 14 | T0736–T0749 皆 DONE、首派即過、無提問；最多 2 張並行 |
| 決策 | 1 | D204（`0.7.3-pre.N` 版號線） |
| BUG | 開 3 / 結 27 | 開 BUG-180 / 181 / 182；CLOSED：167 / 168 / 170、177 / 178 / 179、T0738 A 類 12 張、135、097 / 105 / 107 / 108 / 111 / 156、180、181；BUG-182 FIXED |
| 發版 | 2 | `v0.7.2-pre.9`（BUG-180 / 181）、`v0.7.3-pre.1`（BUG-182） |
| 真實模型花費 | 約 US$0.32 | T0739 0.151、T0746 0.148、T0747 0.021（全 Haiku） |

### 重點觀察

- 自動化驗收以「隔離實例 ＋ 假模型 ＋ 預設 skip 的真實模型 spec」為主，把多數 FIXED BUG 依 R-G003 結案；真正需要人的只剩視覺、無焦點時結束、macOS、一般權限
- 並行派工要錯開 `vite build`：先派一張 build 的單，其餘 `depends_on` 它並禁止重 build；共用 docs 檔的兩張單約定「對方 commit 後再改」（T0747 / T0748）
- WSL 遠端驗收可用測試專用 headless server（`/tmp/bat-e2e-*`、不經 systemd、使用者 bat-server 前後比對），不必動使用者環境（T0748 / T0749）
- 遠端工作區的 ⚠️ 只在該 profile 視窗；本機視窗不列遠端工作區（若要在本機提示需另開 PLAN）
- 後續候選：auto mode classifier 詢問路徑的 hook / ⚠️（T0747）；⚠️ 的 SSH / Docker 遠端、正式 bundle 安裝的 server、真正網路中斷（T0748）；`~/.claude.json` 殘留一筆 `bat-e2e-t0747` projects key（使用者可自刪）

### 編號起始（下 session）

- **T0750** / **BUG-183** / **PLAN-057** / **D215** / **EXP-WFMINE-002** / **L178** / **CT-T023**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-11-02 11:17 UTC+8（第一百零四 session 收工）

### 近期完成
- **pre.4 / pre.5 自動化驗收收尾**（第一百零四 session）：T0777 安裝版 pre.5 → BUG-193 / 194 CLOSED；T0778 GitHub Actions macOS runner（`macos-acceptance.yml`，run `41380866131`）→ BUG-128 / 130 CLOSED（D218）
- **`v0.7.3-pre.5` 發佈**（第一百零四 session，run `41373933464`，target `478fd178`）：BUG-193 取回焦點的點擊不清淡化 ⚠️（T0774）、BUG-194 自動開啟的對話框焦點（T0776）、e2e 真實焦點（T0775）
- **`v0.7.3-pre.4` 發佈**（第一百零四 session，run `41347727443`，target `26c7eb25`）：PLAN-055 中斷分頁恢復、detached / Claude 面板 ⚠️、BUG-188–192；T0770–T0773 安裝版驗收全 PASS
- **`v0.7.3-pre.3` 發佈**（第一百零四 session，run `41332527832`）：PLAN-057 遠端 bat-server 登入 shell PATH、BUG-187
- **`v0.7.3-pre.2` 發佈**（第一百零四 session，run `41318631410`）：BUG-183 / 184 / 186、匣選單同名標籤

### 待辦（依優先序）
1. 🟡 **BUG-159 驗收**：需使用者本機以一般權限（非系統管理員）開 BAT ＋ codex（GitHub Windows runner 為管理員，做不到）
2. 🟢 **觀察**：t0757 偶發失敗再發生才開 BUG（D218）
3. 🟢 **選擇性**：mac 相關修正跑 `macos-acceptance.yml` 回歸；BUG-194 其餘兩個 Dialog、BUG-128 面板貼上、mac 中文檔名

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 0 / Fixing 0 / Fixed 1 / Closed 57，2026-11-02 11:11；舊值 04:59 `*sync`）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D218）｜ Learnings → [_learnings.md](_learnings.md)（最大 L178）
- 網站 → https://gowerlin.github.io/better-agent-terminal/｜ 素材 spec → `e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1`，輸出 `e2e-media/`）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（119 entries）

### 編號起始
- **T0783** / **BUG-195** / **PLAN-060** / **D223** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L179** / **CT-T023**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.3-pre.5**（package.json + lock；D204 `0.7.3-pre.N` 線，最多到 pre.9） |
| **最新 release** | `v0.7.3-pre.5`（2026-11-02T01:57Z，run `41373933464`，target `478fd178`）；前一 tag `v0.7.3-pre.4`（2026-11-01T20:50:21Z，run `41347727443`，target `26c7eb25`）；更早見 `release-note.md` / `CHANGELOG.md` |
| **目前主軸** | 熱區無進行中工單、無 OPEN BUG；唯一待驗收 BUG-159（使用者本機） |
| **工單最大編號** | **T0780** DONE（刪除 `git-poc`，PLAN-029 R3）；**T0779** DONE（Electron 41.10.7，`a09887fb`） |
| **BUG 最大編號** | **BUG-194** CLOSED；熱區 Open 0 / Fixing 0 / Fixed 1 / Closed 57（2026-11-02 11:11） |
| **PLAN 最大編號** | **PLAN-059** PLANNED（Herdr 對照研究主 PLAN，待拆）；PLAN-058 IDEA；PLAN-054 / PLAN-055 / PLAN-057 DONE |
| **決策最大編號** | **D222**（PLAN-053 研究單 T0781、lock 旗標 T0782、之後發 `0.7.3-pre.6`，第一百零五 session） |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v6.0.0-beta.10**（第一百零三 session 起） |
| **unit test 基線** | **6705 passed / 382 files**；typecheck 0 / 0、vite build 成功（塔台聯合驗證 @ `213d03ef`，`0.7.3-pre.5` 批次，2026-11-02 第一百零四 session） |
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
