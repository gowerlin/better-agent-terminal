---
schema_kind: tower-state
summary_version: 1
updated_at: "2026-11-02T17:53:37+08:00"
session: "2026-11-02 17:52 第一百零六 session 開工（CT v6.0.0-beta.10）"
next_ids:
  workorder: "T0787"
  decision: "D226"
  bug: "BUG-196"
  plan: "PLAN-061"
todo:
  - "讀 `v0.7.3-pre.7` NSIS 完整重裝驗收報告（使用者換版時跑；`%TEMP%\\bat-nsis-acceptance-<時間>\\report.md`）"
  - "待驗收：Linux AppImage（Ubuntu 22.04，Electron 45）；BUG-159（一般權限 ＋ codex，需使用者本機）；熱區無進行中工單、無 OPEN BUG"
  - "PLAN-059（Herdr 對照研究，主 PLAN）待拆子 PLAN 與開單；建議先開研究單實測 Q1"
  - "PLAN-060（IDEA）：macOS Developer ID 簽章（目前 macOS 不顯示系統通知）"
  - "觀察：t0757 偶發失敗再發生才開 BUG（D218）"
  - "版號線：0.7.3 線已到 pre.7（D204；最多到 pre.9）"
---
# Tower State — better-agent-terminal

> 🟢 **第一百零六 session 開工**（2026-11-02 17:52 (UTC+8)，CT v6.0.0-beta.10，Fast Path；塔台 session `7389073a-fb88-435e-86cb-9f7e3fcf5481`；`--set-role tower --mode on` exit 0；安裝版 BAT / helper `v0.7.3-pre.7`；HEAD `c2fd544b`、`main` = `origin/main`（0 / 0）、工作區乾淨；熱區 182 張工單全為 DONE；BUG 熱區 Fixed 1（BUG-159）/ Closed 58，與 `_bug-tracker.md` 一致，免重建；`bat_list_questions` pending 0；`%TEMP%` 下找不到 `bat-nsis-acceptance-*` 報告目錄）。

> 🛏 **第一百零五 session 已收工**（2026-11-02 17:47 (UTC+8)）。本 session 開工條目與經過已移入下方〈本 Session 收工快照（第一百零五 session）〉。

> 最後更新:2026-11-02 17:47 (UTC+8) — **第一百零五 session 收工**：Electron 41.2.1 → 41.10.7 → **45.2.1**（PLAN-053 DONE），`v0.7.3-pre.6` / `pre.7` 兩次發佈；Herdr 對照研究登記 PLAN-059；PLAN 全面核對（029 / 054 DONE、053 DONE、開 060）。前次：第一百零四 session 收工（2026-11-02 11:17）。
>
> **下次起手**:熱區無進行中工單、無 OPEN BUG。① 讀 pre.7 NSIS 完整重裝驗收報告（使用者「換版」時跑 `e2e\manual\nsis-reinstall-acceptance.ps1 -Version 0.7.3-pre.7`，報告 `%TEMP%\bat-nsis-acceptance-<時間>\report.md`）；② Linux AppImage（Ubuntu 22.04）待回報；③ BUG-159 待使用者本機；④ PLAN-059 待拆子 PLAN 與研究單（Q1：Worker 通知打進停在權限對話框的塔台）。版號線 `0.7.3-pre.N` 已到 pre.7（最多 pre.9）。

---

## 🛏 本 Session 收工快照 (第一百零五 session, 2026-11-02 13:01 - 2026-11-02 17:47, ~4h45m)

### 主軸：Herdr 對照研究（PLAN-059）→ PLAN 全面核對 → Electron 41.2.1 → 41.10.7 → 45.2.1（PLAN-053）→ `v0.7.3-pre.6` / `pre.7`

#### 時間線（時間取自系統 / git / gh）

> 🟢 **第一百零五 session 開工**（2026-11-02 13:01 (UTC+8)，CT v6.0.0-beta.10，Fast Path；塔台 session `c85c39b0-308c-4087-8f2f-2e18466a0cbd`；`--set-role tower --mode on` exit 0；安裝版 helper `v0.7.3-pre.5`；HEAD `e0c6d63d`、`main` = `origin/main`、工作區乾淨；熱區 174 張工單全為 DONE；BUG 熱區 Fixed 1（BUG-159）/ Closed 57，與 `_bug-tracker.md` 一致，免重建）。使用者要求比較 Herdr（原生桌面版＋herdr-core）與 BAT → 塔台以官方 repo docs 產出研究報告 Artifact「Herdr 對照 BAT」（https://claude.ai/artifact/Ybj66gYLkMHZE8xUyyDiEy，私人）；查證發現 `pty:write` 不看目標是否 blocked（未實測影響）。13:23 使用者「登記為主 PLAN，後續再拆子 PLAN 與拆單、開單」→ **D219** → 開 **PLAN-059**（PLANNED，medium）。PLAN-058 / PLAN-059 互相補〈相關〉：互不依賴，只共用「忙碌時訊息排隊」原則（`c64658ef`）。14:00 使用者問 PLAN-054 是否還需推進 → 查 CT v6 `workflow-engine.md` 仍延後 B6 欄位與契約 → **D220** → **PLAN-054 DONE**（B6 等 CT 契約另開新 PLAN）。14:04 使用者要求核對 PLAN-043 / 051 / 052 → 三張前提仍成立、無需求或觸發，**維持 IDEA**，各補〈2026-11-02 狀態核對〉（051 更正 codex daemon 前提；052 連結 PLAN-059 E）；`docs/plan-007-release-checklist.md` 第 63 行 mirrored 措辭記在 PLAN-043，下次 WSL 工單一併改。14:07 核對 PLAN-015 / 029 / 038 / 053 → 使用者「補，053 調 high 開 41.10.7 小單，029 開刪除單」→ **D221**：PLAN-053 high（lock 鎖 Electron 41.2.1；41 線最後 41.10.7、`latest` 45.2.1）開 **T0779**；PLAN-029 R3 開 **T0780**（刪 `src/components/git-poc/`、`vite.config.benchmark.ts`）；PLAN-015 / 038 維持 IDEA；派工順序 T0780 → T0779。14:10 派 **T0780**（yolo，`started:` exit 0）。**T0780 DONE**（`16a3a326` 刪 15 檔 1344 行、報告 `ea03227b`；無引用確認、`.gitignore` 37–38 行因本機產物仍在而保留；typecheck 0 / 0、vite build、verify-renderer-imports、unit 6705 / 382 files（首跑 `worktree-status-after-close` 負載逾時 1 次，重跑通過））→ **PLAN-029 DONE**；session 快照已寫；`--close-worker T0780`。14:15 派 **T0779**（yolo，`started:` exit 0）。**T0779 DONE**（`a09887fb` `package.json` `^41.10.7`、lock 只改 electron 與其相依（`@electron/get` 2.0.3 → 5.1.0 等）、CLAUDE.md「Electron Runtime」；報告 `11004251`；Chromium 146.0.7680.216 / Node 24.18.0 / ABI 145；verify-native-modules、typecheck 0 / 0、vite build、unit 6705 / 382 files、legacy 472 / 33、`build:dir`＋`verify-packaged-native` 綠、打包產物 Electron 41.10.7；e2e 冒煙 5 支綠（t0572 / t0776 / t0735 / t0762 / t0744）；macOS / Linux 未驗證；npm 12 重算 lock 的 100 項 `peer` 旗標漂移未寫入（與 electron 無關，列待決））；session 快照已寫；`--close-worker T0779`。14:28 使用者「PLAN-053 主升級現在開研究單，2、3 依塔台建議」→ **D222** → 開 **T0781**（研究）、**T0782**（lock `peer` 旗標），並行派工；T0782 後發 `0.7.3-pre.6`。14:29 兩張派工（皆 `started:` exit 0）。**T0782 DONE**（`7f9d4eeb` 只改 lock：996 套件不變、非 peer 欄位 0 變更、peer +78 / −22（加上的是 Agent SDK peer `@anthropic-ai/sdk`、`@modelcontextprotocol/sdk` 與 express / hono 閉包；去掉的是直接相依）；electron-builder 收集器與 `asar-runtime-deps.test.mjs` 都不讀 `peer`；asar 測試 31 綠、`build:dir`＋`verify-packaged-native` 綠；CI npm 11.19.1 / 11.19.0 `npm ci --dry-run` 接受、npm 11 重算逐位元相同；typecheck 0 / 0、unit 6705 / 382）；塔台依建議補 `docs/agent-guide/npm12-install-scripts.md` 一行；session 快照已寫；`--close-worker T0782`。14:37 聯合驗證 @ `7063f11e`：typecheck 0 / 0、vite build、legacy 472 / 33 綠；unit 1 失敗（`worktree-status-after-close` 5093 ms 逾時，第二次出現）→ 單檔 3/3、重跑全套 6705 / 382 綠 → 開 **BUG-195**（OPEN，low，不擋發版）。去識別化樣式 9 組 0 筆、未推 diff 金鑰 0。14:40 push `e0c6d63d..c04931ab`（17 commits），觸發 `pre-release.yml -f version=0.7.3-pre.6`（run `41401358379`）。**T0781 DONE**（`40c9fa57`；推薦一次升 **Electron 45**（45.2.1：Chromium 156 / Node 24.22.1 / ABI 150，暫定支援到 2027-04-27；42 已停止支援、43 剩約 2 個月）；BAT 命中：44 起 main 行程 `clipboard` 改 W3C 形式（`readImage` / `writeImage` 移除、`read` 回 Promise，影響貼圖、複製圖片、macOS Finder 貼上，規模 M）、42 起 electron 不在 postinstall 下載 binary、macOS 通知需簽章、44 起最低 macOS 13、Linux badge 失效、45 safeStorage 同步 API 棄用（46 移除）；原生模組都是 N-API，45.2.1 實測可載入；Graphite：156 已含 CHECK 修正，但 context-lost 重啟仍計入 5 分鐘 3 次上限、另有 `kAsyncShaderCompilesFailed` CHECK → 建議保留 macOS `disable-skia-graphite`；附 EXP 驗證計畫與兩張工單草案）；session 快照已寫；`--close-worker T0781`。使用者四題皆選建議 → **D223** → PLAN-053 IN_PROGRESS；開 **T0783**（只 build 的三平台 workflow）、**T0784**（Electron 45，`isolation: worktree`，depends T0783）、**T0785**（safeStorage async，depends T0784）。14:49 派 **T0783**（yolo，`started:` exit 0）。CI run `41401358379` 12 job 全綠（target `c04931ab`）→ **`v0.7.3-pre.6` 發佈**（publishedAt 06:52:55Z；exe 293 / zip 459 / AppImage 329 / dmg 343 MiB；server-bundle 7 assets）；`gh release edit` 更版重點已比對；CHANGELOG / release-note / package.json → `3c560a33`（README 無需更新）；push `c04931ab..3c560a33`；Pages `41402905578` 綠、link-check 1429 / 0、首頁 0.7.3-pre.6。使用者「跑 macos-acceptance 驗 pre.6」→ run `41403139756`。**T0783 DONE**（`5090001e`：`desktop-build.yml`（只 `workflow_dispatch`、`contents: read`、版號拒絕 `-pre.N`、三平台打包＋檢查、artifact 7 天、無 tag / release）；`macos-acceptance.yml` 加 `build_run_id`（舊輸入行為不變、加 `actions: read`）；actionlint 0；查證 pre-release 不簽章（ad-hoc）、repo 無 secret → mac 未簽章）；session 快照已寫；`--close-worker T0783`。push `3c560a33..a63f5ea0`；`desktop-build -f ref=main` 試跑 run `41403219280`。14:58 派 **T0784**（yolo，`--isolation worktree`，`started:` exit 0；worktree `...bat-worktreesbetter-agent-terminalT0784`、branch `ct/T0784`、base `a63f5ea0`）。`macos-acceptance -f version=0.7.3-pre.6` run `41403139756` **全 PASS**（app 0.7.3-pre.6 / Electron 41.10.7；P1–P5、BUG-128 ①–④、BUG-130 ⑤–⑦、⑧ 內嵌 claude 圖片佔位、模型請求 0）→ T0779 macOS 驗收通過。`desktop-build` 試跑 run `41403219280` 全綠（三平台 artifact、`0.0.0-exp.1`、`published: no`、`mac signed: false`，無新 tag / release）；`macos-acceptance -f build_run_id=41403219280` run `41404236126` 全 PASS（app 0.0.0-exp.1 / Electron 41.10.7）→ T0784 三平台驗收路徑可用。T0784 提問 Q-1（`e2e/fixtures/electron-isolation.ts` 不在 affects_files：Electron 45 的 `firstWindow()` 回傳時還在空白頁，7 支 e2e 第一個 `win.evaluate` 失敗）→ 塔台代決 **[A]** 擴大範圍改 fixture（有上限的等待、相容 41、不改產品載入流程），`--answer` exit 0（BAT 問答通道）。**T0784 DONE**（`ct/T0784`：`1bfa3b36` / `4ef1a915` / `08b26812`，base `a63f5ea0`，validated = head `08b26812`；Electron **45.2.1**（Chromium 156.0.8078.75 / Node 24.22.1 / ABI 150）；main 行程 clipboard 改 W3C（`readClipboardPng`、`readClipboardFilePaths` async，IPC 形狀不變）；`allowScripts.electron` 移除、mac postinstall 先 `require('electron')`；Linux badge 分支移除；Notification `failed` 記 log；README macOS 13+；typecheck 基線 0 / 4 → 0 / 0；unit 6713（BUG-195 逾時 2 次、單檔過）、legacy 472 / 33；`build:dir`＋`verify-packaged-native` 綠、產物 45.2.1；e2e 10 支綠（fixture 修正後 7/7、相容 41 實測）、pre5 A4 因使用者日誌輪替失敗（與版本無關）；對話框起始目錄 41 / 45 相同）；session 快照已寫（`--project` worktree）；`--close-worker T0784 --worktree keep`。塔台：分支 diff 掃描 0 → push `ct/T0784` → `desktop-build -f ref=ct/T0784 -f version=0.0.0-exp.784` run `41406521021`。BUG-195 補記 2 次並改 `frequent`；發現 14:39 開 BUG-195 時 sed 誤把它寫進 `_bug-tracker.md` VERIFY / WONTFIX 的佔位列（已推上 `c04931ab`），已修正、parser 測試 65 綠。`desktop-build -f ref=ct/T0784` run `41406521021` 全綠（三平台 electron=45.2.1）；`macos-acceptance --ref ct/T0784 -f build_run_id=41406521021` run `41407564434` 全 PASS（Electron 45.2.1；Finder 複製有 `text/uri-list`、BAT `source=uri-list`）。`bat_worktree_status` 五條判準成立 → 模式 ①：`ct-merge/T0784` merge `9f2ed99c` → 使用者斷點 E 確認 → `--ff-only` main `9f2ed99c`；整合 worktree detach；T0784 worktree 移除；主 checkout `npm ci` → electron 45.2.1。使用者選先接受 macOS 不顯示系統通知 → **D224**、開 **PLAN-060**（IDEA）。使用者「push，先派 T0785 與 BUG-195，一起發 pre.7」→ 掃描 0 → push `a63f5ea0..9063e167` → **D225** → 開 **T0786**（BUG-195）、BUG-195 → FIXING；T0785 補派工前說明（pre5 A4 與版本無關、BUG-195 並行）。16:58 兩張並行派工（皆 `started:` exit 0）。T0785 提問 Q-1（另 19 支 e2e spec 以同步 `safeStorage.decryptString` 讀 `server-token.json`，不在 affects_files）→ 塔台代決 **A** 一起改（只改那一處或共用 helper、實測 pre5＋2 支代表、其餘 tsc＋grep 確認無同步呼叫），`--answer` exit 0。T0786 提問 Q-1（本檔已修 `8de128de`，但整套 3 次都另有 `ct-worktree-status` / `ct-worktree` / `dev-deploy-headless` 真 git 測試逾時）→ 塔台代決 **A** 三檔一併處理（只動測試、per-describe timeout 附量測、BUG-195 擴大涵蓋；整套 3 次＋負載 1 次 exit 0；第五支以上再出現先回報），`--answer` exit 0。**T0785 DONE**（`ca0d1509`：`secrets.ts` 只用 async API，`remote-server.ts` / `headless-entry.ts` 呼叫端 await；新 `secrets.test.ts` 9 個含 source guard；20 支 e2e 改 `decryptStringAsync`；全 repo 同步 safeStorage 呼叫 0；typecheck 0 / 0、vite build；unit 9 個真 git 逾時（同 BUG-195 類，單檔過）；pre5 A1 / A3x / A5、t0575、t0735 綠，A4 照預期失敗；舊密文樣本與實際 app 啟動：舊 token 可解、棄用警告 0 行；Linux / macOS 未實測）；session 快照已寫；`--close-worker T0785`；**PLAN-053 DONE**。**T0786 DONE**（`8de128de` / `121df3e2`：量測確認整套下每個 git 呼叫均勻變慢 2–3 倍、無單一慢步驟、不是產品問題；snapshot git 程序 4 → 2；4 檔真 git / bash `describe` 設 30 s（量到最大 14.4 s）；修改前整套 3/3 exit 1 → 修改後 3/3 exit 0（6723 passed）、負載下 2 種都綠、無第五支；`typecheck:electron` 0）→ **BUG-195 FIXED**（tracker 只動該列，parser 65 綠）；session 快照已寫；`--close-worker T0786`。聯合驗證 @ `e73acb3b` 全綠（electron 45.2.1；verify-native-modules、typecheck 0 / 0、vite build、unit 6723 / 383 一次綠、legacy 472 / 33）→ 去識別化 9 組 0、金鑰 0 → push `9063e167..e73acb3b` → `pre-release.yml -f version=0.7.3-pre.7` run `41419978047` 12 job 全綠 → **`v0.7.3-pre.7` 發佈**（09:35:29Z；exe 305 / zip 474 / AppImage 337 / dmg 352 MiB；server-bundle 7 assets）；更版重點已寫入；CHANGELOG / release-note / package.json → `eb4bcc63`（README 已於 T0784 改 Electron 45 / macOS 13）；**BUG-195 CLOSED**；Pages `41422354153` 綠、link-check 1434 / 0、首頁 0.7.3-pre.7；`macos-acceptance -f version=0.7.3-pre.7` run `41422176485` **全 PASS**（交付版 0.7.3-pre.7 / Electron 45.2.1；P1–P5、BUG-128 ①–④、BUG-130 ⑤–⑦、⑧）。

- 2026-11-02 17:47 使用者「收工換版」。收工前：Session 103 快照歸檔（`2026-Q4-b.md`、INDEX 123）、L179（tracker 佔位列不得全檔 sed）、去識別化與金鑰掃描後 push。

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | 8 | T0779–T0786 皆 DONE；T0784 為 `isolation: worktree`（模式 ① 合回）；最多 2 張並行 |
| 塔台代答提問 | 3 | T0784 / T0785 / T0786 各 Q-1，皆經 BAT 問答通道 `--answer` |
| 決策 | 7 | D219–D225 |
| BUG | 開 1 / 結 1 | BUG-195（測試逾時，T0786 修 4 檔，pre.7 CI 綠 CLOSED）；熱區 Open 0 / Fixed 1（BUG-159）/ Closed 58 |
| PLAN | 開 2 / 結 3 | 開 PLAN-059（PLANNED）、PLAN-060（IDEA）；DONE PLAN-029 / 053 / 054；核對 015 / 038 / 043 / 051 / 052 維持 IDEA |
| 發版 | 2 | `v0.7.3-pre.6`（Electron 41.10.7）、`v0.7.3-pre.7`（Electron 45.2.1） |
| CI | desktop-build 2 / macos-acceptance 5 | 新 `desktop-build.yml`（只 build、不發布）；macOS 驗收 pre.6、exp.1、exp.784、pre.7 全 PASS |
| Artifact | 1 | 研究報告「Herdr 對照 BAT」（私人） |

### 重點觀察

- Electron 大版本升級一個 session 走完：研究單（T0781）→ 只 build 的三平台 workflow（T0783）→ worktree 隔離試做（T0784）→ `desktop-build` ＋ `macos-acceptance --ref` 驗三平台 → 模式 ① 合回 → 發版後再驗交付版
- Electron 42+ 的坑：postinstall 不下載 binary（`allowScripts.electron` 移除）、Playwright `firstWindow()` 回傳時還在空白頁（e2e fixture 要等網址）、main 行程 clipboard 改 W3C、未簽章 mac app 不顯示通知（本 fork 全為 ad-hoc，PLAN-060）
- 真 git / bash 的測試在整套平行下每個子程序均勻變慢 2–3 倍；修法是減呼叫＋per-describe timeout，不改全域（BUG-195）
- 塔台自己改索引時的全檔 `sed` 誤傷多個區段（L179）；索引改動一律帶區段定位並跑 parser 測試
- 後續候選：PLAN-059 A（通知送進 blocked 塔台，先實測 Q1）/ B（OSC 7501 不限 codex）；`desktop-build.yml` 的 unit-tests 步驟名稱說明過時、`src/lib/terminal-paste.ts:61` 註解過時（T0784 回報）；臨時 clipboard IPC e2e 可納入 repo

### 編號起始（下 session）

- **T0787** / **BUG-196** / **PLAN-061** / **D226** / **EXP-WFMINE-002** / **L180** / **CT-T023**

---

## 🛏 前 Session 收工快照 (第一百零四 session, 2026-11-01 21:36 - 2026-11-02 11:17, 含五個塔台 session)

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

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-11-02 17:47 UTC+8（第一百零五 session 收工）

### 近期完成
- **`v0.7.3-pre.7` 發佈**（第一百零五 session，run `41419978047`，target `e73acb3b`）：Electron 45.2.1（T0784）、safeStorage async（T0785）、BUG-195（T0786）；macOS 交付版驗收 PASS（run `41422176485`）
- **PLAN-053 DONE**（第一百零五 session）：T0779 41.10.7 → T0781 研究 → T0783 `desktop-build.yml` → T0784 worktree 試做（模式 ① 合回 `9f2ed99c`）→ T0785
- **`v0.7.3-pre.6` 發佈**（第一百零五 session，run `41401358379`）：Electron 41.10.7、git-poc 清理（T0780）、lock `peer` 旗標（T0782）
- **Herdr 對照研究**（第一百零五 session）：PLAN-059 主 PLAN（PLANNED，待拆）；PLAN-058 互不依賴
- **PLAN 核對**（第一百零五 session）：PLAN-029 / 054 DONE；PLAN-015 / 038 / 043 / 051 / 052 維持 IDEA；開 PLAN-060（macOS 簽章）

### 待辦（依優先序）
1. 🟡 **pre.7 NSIS 完整重裝驗收**：讀使用者換版時跑的報告（`%TEMP%\bat-nsis-acceptance-<時間>\report.md`）
2. 🟡 **PLAN-059 拆單**：先開研究單實測 Q1（Worker 通知打進停在權限對話框的塔台）
3. 🟡 **BUG-159 驗收**：需使用者本機以一般權限（非系統管理員）開 BAT ＋ codex
4. 🟢 **Linux AppImage**（Ubuntu 22.04，Electron 45）待回報；t0757 偶發失敗再發生才開 BUG（D218）

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式
- 改 `_bug-tracker.md` / `_backlog.md` 不用全檔 `sed`，改完跑 parser 測試（L179）

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 0 / Fixing 0 / Fixed 1 / Closed 58，2026-11-02 17:37）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D225）｜ Learnings → [_learnings.md](_learnings.md)（最大 L179）
- 研究報告 Artifact「Herdr 對照 BAT」→ https://claude.ai/artifact/Ybj66gYLkMHZE8xUyyDiEy（私人）
- 網站 → https://gowerlin.github.io/better-agent-terminal/｜ 素材 spec → `e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1`，輸出 `e2e-media/`）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（123 entries）

### 編號起始
- **T0787** / **BUG-196** / **PLAN-061** / **D226** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L180** / **CT-T023**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.3-pre.7**（package.json + lock；D204 `0.7.3-pre.N` 線，最多到 pre.9） |
| **最新 release** | `v0.7.3-pre.7`（2026-11-02T09:35:29Z，run `41419978047`，target `e73acb3b`：Electron 45.2.1、safeStorage async、BUG-195）；前一 tag `v0.7.3-pre.6`（06:52:55Z，run `41401358379`）；更早見 `release-note.md` / `CHANGELOG.md` |
| **目前主軸** | 熱區無進行中工單、無 OPEN BUG；待讀 pre.7 NSIS 報告；PLAN-059 待拆；BUG-159 待使用者本機 |
| **工單最大編號** | **T0786** DONE（BUG-195）；T0779–T0786 皆 DONE（第一百零五 session） |
| **BUG 最大編號** | **BUG-195** CLOSED；熱區 Open 0 / Fixing 0 / Fixed 1 / Closed 58（2026-11-02 17:37） |
| **PLAN 最大編號** | **PLAN-060** IDEA（macOS 簽章）；PLAN-059 PLANNED；PLAN-029 / 053 / 054 / 055 / 057 DONE |
| **決策最大編號** | **D225**（派 T0785 / T0786，之後發 `0.7.3-pre.7`，第一百零五 session） |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v6.0.0-beta.10**（第一百零三 session 起） |
| **unit test 基線** | **6723 passed / 383 files**；typecheck 0 / 0、vite build、legacy 472 / 33（塔台聯合驗證 @ `e73acb3b`，`0.7.3-pre.7` 批次，Electron 45.2.1，2026-11-02 第一百零五 session） |
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
