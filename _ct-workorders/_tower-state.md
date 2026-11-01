---
schema_kind: tower-state
summary_version: 1
updated_at: "2026-11-02T01:13:49+0800"
session: "2026-11-02 00:23 第一百零四 session 塔台重啟（CT v6.0.0-beta.10，Fast Path）"
next_ids:
  workorder: "T0757"
  decision: "D209"
  bug: "BUG-188"
  plan: "PLAN-058"
todo:
  - "T0756（BUG-187 Node.js recipe libatomic）完成後與 PLAN-057 一起發 `0.7.3-pre.3`（D208）；發版後精靈升級 WSL bat-server 實機確認"
  - "BUG-183 / 184 / 186 實機驗收（`v0.7.3-pre.2`；BUG-186 需遠端 server 以精靈升級）"
  - "工作區 ⚠️ 剩餘手動項（`v0.7.2-pre.8` 起）：視窗沒有焦點時等待結束、滑鼠回答後清除"
  - "外部 / 特定環境驗收：BUG-128 / 130（macOS）、BUG-159（一般權限 ＋ codex）"
  - "候選（T0747）：auto mode classifier 詢問路徑的 hook / ⚠️（需先定義安全動作與費用上限）"
  - "候選（T0748）：⚠️ 的 SSH / Docker 遠端、正式 bundle 安裝的 bat-server、真正網路中斷、遠端 Worker 分頁與 `?`"
  - "候選：D201 detached 視窗 ⚠️；Claude 面板等待權限 ⚠️；npm 安裝的 codex 不注入 `--no-daemon`（T0742）；背景 Agent 不在 active task bar（T0739）；`CLAUDE_CODE_PLUGIN_CACHE_DIR`（T0730）；PLAN-055"
  - "版號線：0.7.3 線已到 pre.2（D204；最多到 pre.9）"
---
# Tower State — better-agent-terminal

> 🟢 **第一百零四 session 開工**（2026-11-01 21:36 (UTC+8)，CT v6.0.0-beta.10，Fast Path；塔台 session `3f9b428a-2c04-4a70-8751-68733dd7b1cc`；`--set-role tower --mode on` exit 0；安裝版 helper `v0.7.3-pre.1`；HEAD `68532d71` = 上次收工 commit、工作區乾淨，`*sync` 沿用收工時索引；熱檔皆在 400 KB 預算內）。21:37 T0360 / T0649 / T0672 / T0691 `FIXED` → `DONE`（對應 BUG 皆已 CLOSED，R-G003，`6ed32a57`）。BUG-182 實機驗收步驟已給使用者（遠端 WSL bat-server 仍 `0.6.1-pre.5`，待精靈升級）。21:40 **BUG-175 CLOSED**（外部測試者A 回報 macOS 實機正常，使用者轉達）→ 熱區 Fixed 4 / Closed 42；21:42 使用者選 A → GitHub #22 留言說明並以 `completed` 關閉。21:45 使用者以精靈把 WSL bat-server 升到 `0.7.3-pre.1`（塔台唯讀確認）。22:04 **BUG-182 CLOSED**（使用者 WSL 實機：情境 A / B 通過，B 需先 ⏻ 重啟舊分頁）；驗收中發現 → 開 **BUG-183**（隱藏的 profile 視窗按「開啟」不顯示，medium）/ **BUG-184**（匣選單殘留已移出 profile 的視窗，low）→ 熱區 Open 2 / Fixed 3 / Closed 43。使用者「開單修，派 T0750」→ 開 **T0750**（BUG-183 / 184 → FIXING），22:07 派工（yolo，`started:` exit 0）。**T0750 DONE**（22:21，`8a432d40`；BUG-183 成因如初步定位，本機 profile 同樣受影響、second-instance 路徑一併修；BUG-184 成因不同：「配置」✕ 的 `profile:delete` 只刪 profile 不關視窗；新增 `src/lib/profile-window-front.ts`；unit 6376 / 360 files、typecheck 0 / 0、build；e2e t0750 突變檢查兩項皆失敗、修正後連跑 2 次綠；detached / plan039 / t0513 等 13 項綠；塔台複跑新 unit 17 / 17）→ **BUG-183 / 184 FIXED**；開 **BUG-185**（t0512 第 2 項缺 `wsl-systemd:snapshot-unit` stub，low）→ 熱區 Open 1 / Fixed 5 / Closed 43；session 快照已寫；`--close-worker T0750` exit 0。使用者「開單修 BUG-185。匣選單標籤用 (b)，都好了一起發版」→ **D205** → 開 **T0751**（BUG-185 → FIXING）/ **T0752**（匣選單同名標籤加序號），並行（T0752 等 T0751 commit 後才 build）；22:27 兩張派工（yolo，皆 `started:` exit 0）。**T0752 DONE**（22:32，`7775fa8f`；`src/lib/tray-window-labels.ts`；unit 6385 / 361 files、typecheck 0 / 0、build（T0751 commit 後）、t0750 e2e 綠）。**T0751 DONE**（22:32，`f9072e16`；補 `snapshot-unit` 與 4 個升級 / rollback stub；t0512 兩項連跑 2 次綠、突變檢查失敗如預期；Worker 寫 FIXED，塔台改 DONE）→ **BUG-185 FIXED**；兩張 session 快照已寫、`--close-worker` exit 0。使用者「nvm 與 uv 偵測錯誤也一起修」＋「也檢查 docker 或 ssh」→ 開 **BUG-186**（medium）/ **T0753**（BUG-186 → FIXING），完成後一起發 pre.2；22:34 T0753 派工（yolo，`started:` exit 0）。[提問] 22:39 T0753 Q-1 / Q-2（BAT 通道）→ 塔台代決皆 A：Q-1 node v26.13.0 缺 `libatomic.so.1` 本身無法執行，「無回應」正確，改為說明原因（白名單取程式庫檔名、不回 stderr 原文）；Q-2 不改 server PATH，只修判斷與文案（「伺服器程序：不可見（終端分頁可用）」、git / gh 判斷比照 headless resolver）；B（server 啟動取登入 shell PATH）另提使用者。`--answer` 皆 exit 0。**T0753 DONE**（22:52，`0f021e67`；node 無法執行時探測取 exit code 與缺少的程式庫檔名（白名單）、面板說明原因；「伺服器程序：不可見（終端分頁找得到）」；git / gh server 判斷比照 resolver；WSL / Docker 實測修正前後對照、SSH 程式碼＋ unit；unit 6408 / 361 files、typecheck 0 / 0、build、t0512 綠；塔台複跑相關測試 178 passed；Worker 寫 FIXED，塔台改 DONE）→ **BUG-186 FIXED**；session 快照已寫；`--close-worker T0753` exit 0。聯合驗證 @ `655b678b` 全綠（typecheck 0 / 0、vite build、unit 6408 / 361 files、legacy 472 / 0）、去識別化 0、金鑰 0 → push → **`v0.7.3-pre.2` 發佈**：run `41318631410` 11 job 全綠（target `655b678b`，publishedAt 2026-11-01T15:07:46Z）；exe 292 / zip 458 / AppImage 328 / dmg 345 MiB；server-bundle 7 assets；更版重點已寫（無 codex 變更，省略「歡迎協助測試」）；package.json → 0.7.3-pre.2；CHANGELOG / release-note 更新（README 無需更新）。文件 `1b79ea5a`；Pages `41319789237` 綠、link-check 1405 / 0、首頁 0.7.3-pre.2。**BUG-185 CLOSED**（交付版 pre.2，R-G003）→ 熱區 Open 0 / Fixed 6 / Closed 44。

> 🟢 **第一百零四 session 塔台重啟**（2026-11-02 00:23 (UTC+8)，CT v6.0.0-beta.10，Fast Path；塔台 session `353a4768-d323-407c-8333-437e0582057f`；`--set-role tower --mode on` exit 0；安裝版 helper `v0.7.3-pre.2`（使用者已裝 pre.2，可開始 BUG-183 / 184 / 186 實機驗收）；HEAD `084bfc31` = 上次發佈記帳 commit、工作區乾淨，`*sync` 沿用索引；熱檔皆在 400 KB 預算內；熱區無進行中工單）。00:25 使用者對 T0753 Q-2 B 選「PLAN＋先量測」、開關「預設開、可關」→ **D206** → 開 **PLAN-057**（PLANNED）＋研究單 **T0754**（只查不改、不動使用者 bat-server）；00:26 派工（yolo，`started:` exit 0）。**T0754 DONE**（00:43，`6ddb08e1`；`-l -i -c` ＋標記、detached ＋ SIGKILL 程序群組、逾時 3000 ms、WSL 中位 123 ms；systemd 下 `/mnt` 0 項；套用點 `bat-server.mjs` `createHeadlessServer` 前；開關 `headlessLoginShellPath`；實作單草案已附；macOS 未實測；使用者 bat-server 前後相同、測試資源已清；附註使用者 WSL 的 nvm node v26.13.0 缺 `libatomic.so.1`、BuildKit 快取可能留有 `debian:12-slim` 層）；去識別化：回報區使用者容器名改代稱；session id 已補記、session 快照已寫；`--close-worker T0754` exit 0。00:46 使用者待決點 1–3 皆選建議（不加環境變數、不過濾 `/mnt`、接受分頁重複）並「現在開單派工」→ **D207** → 開 **T0755**（PLAN-057 實作）；00:47 派工（yolo，`started:` exit 0）。**T0755 DONE**（01:06，`681a8d64`，14 檔；`electron/remote/headless-login-path.ts`、`bat-server.mjs` 在 `createHeadlessServer` 前呼叫、Settings 進階頁開關（Linux / macOS 遠端視窗）、三語系、docs ＋ CLAUDE.md 一節；unit 6448 / 363 files、typecheck 0 / 0、build；6 項突變檢查皆抓到（1a 補 `trap '' TERM` 情境）；WSL 測試 server 開 `applied`（124 ms，+2 項）/ 關 `off` 與現況相同、分頁 PATH 只多一份 `~/.local/bin`；Docker `applied`；使用者 bat-server 前後相同；macOS 未實測；塔台複跑新測試 40 passed / 4 skipped、三檔 LF）→ PLAN-057 IN_PROGRESS（待發版實機）；session id 一致、session 快照已寫；`--close-worker T0755` exit 0。01:09 使用者「libatomic 一起處理」→ 塔台在 WSL `Ubuntu-24.04` 以 root `apt-get install -y libatomic1`（14.2.0-4ubuntu2~24.04.1）；nvm 預設 node v26.13.0 可執行（`node` v26.13.0、`npx` 11.20.0），T0754 待決點 4 解除。01:12 使用者問建立 profile 時會不會自動處理 → PATH 會（pre.3 起每次 server 啟動）、libatomic 不會；塔台查到 BAT 的 Node.js recipe（`nvm install --lts`）沒先確保 `libatomic1`（使用者 WSL 即此）、兩份文件仍寫「BAT 不改 server PATH」→ 使用者「開單派工，修好一起發 pre.3」→ **D208** → 開 **BUG-187**（medium，FIXING）/ **T0756**；01:13 派工（yolo，`started:` exit 0）。

> 最後更新:2026-11-01 21:30 (UTC+8) — **第一百零三 session 收工**（CT v6.0.0-beta.10）：T0736–T0749（D204）→ **`v0.7.2-pre.9`**（BUG-180 / 181）、**`v0.7.3-pre.1`**（BUG-182）；NSIS 重裝驗收 PASS；27 張 BUG 依 R-G003 結案。前次：第一百零二 session 收工（2026-11-01 17:08）。
>
> **下次起手**:BUG-183 / 184 / 186 實機驗收（`v0.7.3-pre.2`）；工作區 ⚠️ 無焦點時結束（使用者手動）、滑鼠回答；BUG-128 / 130（macOS）/ 159（一般權限）待驗收；熱區無進行中工單；版號線 `0.7.3-pre.N`（已到 pre.1）。

> 前次:2026-11-01 17:08 (UTC+8) — **第一百零二 session 收工**（CT v5.15.0）：T0727–T0735（D197–D203）→ **`v0.7.2-pre.7`**、**`v0.7.2-pre.8`**（工作區等待提示）。

---

## 🛏 本 Session 收工快照 (第一百零三 session, 2026-11-01 17:11 - 21:30, ~4h20m)

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

- **T0750** / **BUG-183** / **PLAN-057** / **D205** / **EXP-WFMINE-002** / **L178** / **CT-T023**

---

## 🛏 前 Session 收工快照 (第一百零二 session, 2026-11-01 10:54 - 17:08, ~6h15m)

### 主軸：pre.6 自動化驗收（T0727 / T0728）→ BUG-177 / 178 / 179 → `v0.7.2-pre.7`；工作區等待提示（T0735，D200–D203）→ `v0.7.2-pre.8`

#### 時間線（原起手式條目，第一百零三 session 收工時移入）

- 🔵 **第一百零二 session 收工**（2026-11-01 17:08；2026-11-01 10:54 起，CT v5.15.0，Fast Path；`--set-role tower --mode on` exit 0；安裝版 helper `v0.7.2-pre.6`）：使用者「pre.6 實機驗收開始，可自動化的先安排」→ T0727（Claude 面板假 Anthropic API e2e，10:59 派工 `started:`）→ T0728（BUG-174 連結＋codex 0.166 ↻ → ✓ e2e，等 T0727 完成再派，避免同時 `vite build`）。NSIS 覆蓋 / 解除 / 乾淨重裝：本機沒有 Windows Sandbox，在主機跑會覆蓋使用中的 BAT → 留手動。**BUG-169 CLOSED**（11:00，使用者「直接 CLOSED」；安裝版三個 helper `--version` = `v0.7.2-pre.6`）→ 熱區 BUG：Fixed 28 / Closed 12。**T0727 DONE**（11:15，`b534941c`；假 Anthropic API e2e ①–⑨ 全 PASS、0 個對外請求；V2 遷移實際走 resume 接上）→ 開 **BUG-177**（`getSupportedModels` 空 prompt 仍跑一個 turn，耗 token）/ **BUG-178**（歷史 / plugins 不理 `CLAUDE_CONFIG_DIR`）；`--close-worker T0727` exit 0；11:17 派 **T0728**（`started:`）。實機仍需：背景 `Agent`（CLI 2.1.316 預設背景）卡片行為、真實模型是否主動用 Task*。**T0728 DONE**（11:25，`947cc9bc`；BUG-174 ①–⑤ PASS、codex 0.166 `✓ → ↻ → ✓` PASS、t0694 / t0621 綠、無缺陷）→ `--close-worker T0728` exit 0；**BUG-174 CLOSED**（HEAD 與 `v0.7.2-pre.6` 的 src / electron / scripts 無差異）。pre.5 待驗的 codex 0.166 ↻ → ✓ 亦以 T0728 涵蓋。使用者「兩個都現在修」＋「留言並關閉 #20」→ 11:51 #20 留言並 CLOSED；T0729（BUG-177）/ T0730（BUG-178，同檔，排在 T0729 後）開單，兩 BUG → FIXING；11:52 派 T0729（`started:`）。BMad-Guide · Tower 來兩則跨 session 訊息：① ADVISORY Worker session 對應（Q-B1–B5）→ 使用者選先研究 → T0731（只查不改、不 build，與 T0729 並行）12:07 派工（`started:`）；② `.claude/settings.local.json` ECC 殘留 2 條 → 使用者授權後塔台備份並移除（allow 27 → 25，JSON 可解析，檔案不在版控）；已回覆 BMad-Guide 收件（對方已標 ACKNOWLEDGED、殘留清單標完成）。**T0729 DONE**（11:59，`ceb24910`；不 yield 的 AsyncIterable prompt，0 請求 / 0 session 檔，e2e ⑩；unit 6262 / 351 files）→ BUG-177 FIXED；**T0731 DONE**（12:10，`d519902c`，回覆稿 DRAFT）→ 開 **BUG-179**（`bat-scripts.log` 無上限，本機 41.6 MB）；`--close-worker` T0729 / T0731 exit 0；12:12 派 **T0730**（`started:`）。R-G003 整理：**BUG-176 CLOSED**（pre.5 / pre.6 CI 三平台打包驗證 success）。使用者裁示 → **D197**（ADVISORY 照 T0731 建議回覆，回覆稿 DELIVERED、已通知 BMad-Guide）、**D198**（BUG-179 規格：啟動時 > 10 MB 輪替、保留 3 份、`report-hook` 雙寫不動 → T0732，排在 T0730 後；turn 後多出的請求 → T0733 研究，12:2x 派工）。 BMad-Guide 回覆 RESOLVED（其 D517）。**T0730 DONE**（`6f7b3d53`；`electron/claude-config-dir.ts` 統一解析，e2e ⑪ / ⑫ PASS、負向對照會失敗；unit 6277 / 352 files）→ BUG-178 FIXED；**T0733 DONE**（`fd4f3f6c`；prompt suggestion，建議不改）；`--close-worker` T0730 / T0733 exit 0；12:36 派 **T0732**（`started:`）。 使用者裁示 **D199**（prompt suggestion 維持開啟、補 docs；`agentProgressSummaries` 研究）→ T0734。 **T0732 DONE**（`ce648034`；`electron/bat-scripts-log-rotation.ts`，本機 `whenReady` 開頭與 headless `start()`；unit 6298 / 354 files、legacy 472 / 0；Worker 寫成 FIXED，塔台改 DONE）→ BUG-179 FIXED；`--close-worker T0732` exit 0。 使用者「要發」→ 聯合驗證 @ `5e16d61d` 全綠（typecheck 0 / 0、build、unit 6298 / 354 files、legacy 472 / 0）、去識別化 0（樣式 4 兩筆既知誤報）、金鑰 0 → push → `pre-release.yml -f version=0.7.2-pre.7` run `41274458418`（12:47Z+8）。**T0734 DONE**（`72878412` docs「Claude 面板額外的模型請求」；`agentProgressSummaries` 使用者端無法關閉；原型在 `%TEMP%\claude\D--t0734-probe-tmp-work-*` 留 6 個目錄，Worker 刪除被安全檢查擋下，待使用者自行刪除）。使用者新需求 → **D200** 工作區列表 ⚠️ → T0735；`agentProgressSummaries` 維持。 **`v0.7.2-pre.7` 發佈**：run `41274458418` 12 job 全綠（target `5e16d61d`，publishedAt 2026-11-01T05:00:22Z）；exe 292.9 / zip 458.9 / AppImage 328.8 / dmg 345.7 MiB；更版重點已寫；package.json → pre.7；文件 `fb11e0b5`（README 無需更新）；Pages `41275367341` 綠、link-check 1379 / 0、首頁 pre.7。 T0735 Q-1（BAT 問答通道）→ 使用者選 [B] → **D201**（D200 ⑥ detached 視窗延後）；`--answer` exit 0。 使用者補充：剛才「Worker 問塔台 → 塔台等使用者」時人在其他工作區沒察覺，這也要提示 → 塔台查證塔台分頁 AskUserQuestion 由 hook 記 `blocked` / `question`，已在 D200 ②「所有 agent 分頁」範圍內；以跨 session 訊息請 T0735 Worker 補「塔台分頁 question → 工作區 ⚠️」驗收案例（Worker `?` 照舊不觸發）。 使用者截圖補充顯示位置 → **D202**（列內狀態點左側、側欄在「塔台」頁籤時「工作區」頁籤標題、側欄收合時展開按鈕）→ 跨 session 訊息交 T0735 Worker；提醒工作區真名不得進 repo。 使用者補充：提示不能隨等待結束就消失 → **D203**（結束後未看過改淡化 ⚠️，該分頁 active 且視窗有焦點才清除）→ 跨 session 訊息交 T0735 Worker。T0735 範圍已比原單大（D200–D203），收單時逐項核對、必要時拆後續單。 **T0735 DONE**（13:25，`b4daaf1f`；主行程不用改，`TerminalAttentionNotifier` 本來就推每個 PTY；D200 ①–⑤、D202 ①–③、D203 ①–⑥、塔台分頁案例全 PASS；unit 6326 / 357 files；e2e t0735 / t0609 / t0694 / t0538 4/4；已知限制：detached、Claude 面板、`blockedDetection: none`、封存工作區）；`--close-worker T0735` exit 0。使用者問 CT 是否需配合 → 不需要（只用既有 hook / OSC 狀態，helper / MCP 契約不變）。 使用者「要發」→ 聯合驗證 @ `cf71bf6f` 全綠（unit 6326 / 357 files、legacy 472 / 0）、去識別化 0、金鑰 0 → **`v0.7.2-pre.8` 發佈**：run `41277080514` 12 job 全綠（publishedAt 2026-11-01T05:40:11Z）；exe 292.9 / zip 458.9 / AppImage 328.8 / dmg 345.7 MiB；更版重點含「歡迎協助測試」（Codex 分頁 ⚠️，D153）；README 功能句＋協作表一列（BAT `>= 0.7.2-pre.8`、CT 不需要）；文件 `634c5134`；Pages `41277902256` 綠、link-check 1386 / 0、首頁 pre.8。0.7.2 線只剩 pre.9（D151）。 BMad-Guide · Tower 詢問 BAT 下一版（為 CT v6.0.0-beta.10 相容性頁）→ 已回覆：pre.7 / pre.8 已發佈、CT 相容性頁不需改、`claudeSessionId`（`>= 0.7.1-pre.1`）與「不放 `--settings`」不變。使用者「收工 push」。

### 編號起始（下 session）

- **T0736** / **BUG-180** / **PLAN-057** / **D204**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-11-01 21:30 UTC+8（第一百零三 session 收工）

### 近期完成
- **`v0.7.3-pre.2` 發佈**（第一百零四 session，run `41318631410`，target `655b678b`）：BUG-183 / 184 profile 視窗（T0750）、BUG-186 遠端工具偵測（T0753）、匣選單同名標籤（T0752）、BUG-185 測試 stub（T0751）
- **`v0.7.3-pre.1` 發佈**（第一百零三 session，run `41310103490`，target `b6f48c07`）：BUG-182 遠端 server 重啟後 ⚠️ 對帳（T0749 `01796a9e`）；D204 換線；文件 `de8b8a7a`；Pages `41311358391` 綠、link-check 1398 / 0
- **`v0.7.2-pre.9` 發佈**（第一百零三 session，run `41303235035`，target `5e33faec`）：BUG-180 分頁 9x5（T0741）、BUG-181 Cache History 累計（T0744）；之後 NSIS 重裝驗收 PASS（T0740 / T0745）、BUG-180 / 181 CLOSED
- **自動化驗收批次**（第一百零三 session，T0736–T0748）：工作區 ⚠️（假模型 / 真實模型 / WSL 遠端）、Docker 遠端、真實模型 Claude 面板；27 張 BUG CLOSED
- **`v0.7.2-pre.8` 發佈**（第一百零二 session，run `41277080514`）：工作區等待提示 ⚠️（T0735，D200–D203）
- **`v0.7.2-pre.7` 發佈**（第一百零二 session，run `41274458418`）：BUG-177 / 178 / 179（T0729 / T0730 / T0732）

### 待辦（依優先序）
1. 🔴 **BUG-183 / 184 / 186 實機驗收**（`v0.7.3-pre.2`；BUG-186 需遠端 server 以精靈升級後「重新檢查」）
2. 🔴 **工作區 ⚠️ 剩餘手動項**（`v0.7.2-pre.8` 起）：視窗沒有焦點時等待結束（`bat-hook.mjs` 計時模擬，三情境步驟見第一百零三 session 對話）、滑鼠回答後清除
3. 🟡 **外部 / 特定環境驗收**：BUG-128 / 130（macOS）、BUG-159（一般權限 ＋ codex）
4. 🟡 **T0756 → 發 `0.7.3-pre.3`**（D208：BUG-187 ＋ PLAN-057）；發版後精靈升級 WSL bat-server 確認 `applied`
5. 🟢 **後續候選**：auto mode classifier 詢問路徑的 hook / ⚠️（T0747）；⚠️ 的 SSH / Docker 遠端、正式 bundle 安裝的 server、真正網路中斷（T0748）；detached 視窗 ⚠️（D201）；Claude 面板等待權限 ⚠️；npm 安裝的 codex 不注入 `--no-daemon`（T0742）；背景 Agent 不在 active task bar（T0739）；`CLAUDE_CODE_PLUGIN_CACHE_DIR`（T0730）；PLAN-055

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 0 / Fixing 0 / Fixing 1 / Fixed 6 / Closed 44，2026-11-02 01:12）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D205）｜ Learnings → [_learnings.md](_learnings.md)（最大 L177）
- 網站 → https://gowerlin.github.io/better-agent-terminal/｜ 素材 spec → `e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1`，輸出 `e2e-media/`）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（119 entries）

### 編號起始
- **T0757** / **BUG-188** / **PLAN-058** / **D209** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L178** / **CT-T023**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.3-pre.2**（package.json + lock，2026-11-01；D204 `0.7.3-pre.N` 線，最多到 pre.9） |
| **最新 release** | `v0.7.3-pre.1`（2026-11-01 13:25:58Z，run `41310103490`，target `b6f48c07`：BUG-182）、`v0.7.2-pre.9`（2026-11-01 11:57Z，run `41303235035`，target `5e33faec`：BUG-180 / 181）、`v0.7.2-pre.8` / `pre.7` / `pre.6`（2026-11-01，見 release-note.md）；`v0.7.2-pre.5`（2026-11-01 01:36Z，run `41260924862`，target `826471bd`：內嵌 claude 2.1.316 / codex 0.166.0 / Agent SDK 0.3.316、V2 下架、BUG-176；exe 333 / zip 458 / AppImage 328 / dmg 345 MiB，超 D146）、`v0.7.2-pre.4`（2026-10-31 18:04Z，run `41226677868`，target `44d86f13`：`--ask --no-pty-write` 正式契約，T0715 / T0716，D190）、`v0.7.2-pre.3`（2026-10-30 09:13Z，run `41030478924`，target `ace28006`：BUG-175 縮圖預覽，T0714）、`v0.7.2-pre.2`（2026-10-30 07:26Z，run `41019051580`，target `58213249`：BUG-174）、`v0.7.2-pre.1`（06:26Z，run `41012819051`，target `27a5a164`：T0710–T0712）；各附 `server-bundle-v<版號>`（7 assets）；exe 309 / zip 428 / AppImage 305 / dmg 322 MiB。更早：`v0.7.1-pre.6`（2026-10-22 02:14，run `39649193569`，target `8fb92004`：BUG-165 codex 分頁滾輪、BUG-169 helper 版號、T0692 用量限制 resumed、T0694 `↻`、內嵌 codex 0.163；Test gate tests 18:06:48Z → build 18:06:50Z；更版重點已寫；文件 `8bd1f47a`；Pages `39651190345` 綠、link-check 1274 / 0；exe 309 / zip 428 / AppImage 305 / dmg 322 MiB）+ `server-bundle-v0.7.1-pre.6`（7 assets）。前一版 `v0.7.1-pre.5`（2026-10-21 22:43，run `39617678592`，target `d0ebd708`：SSH 啟動失敗字首、內嵌 claude CLI 2.1.306、安裝檔只收 6 個執行期 helper、Test gate、MCP 寫入型 tool 政策、網站 `/why`；**Test gate 首次生效**：`tests / unit-tests` 14:32:29–14:36:27Z，build 14:36:30Z 才開始；更版重點已寫；exe 306 / zip 423 / AppImage 306 / dmg 319 MiB）+ `server-bundle-v0.7.1-pre.5`（7 assets；darwin-arm64 job 在 API 停在 `in_progress`，但每個 step 含 Complete job 都 success、tarball 已發佈，屬 GitHub 顯示問題）。前一版 `v0.7.1-pre.4`（2026-10-19 18:03，run `39233550117`，target `8883cebd`：BUG-166 滑鼠追蹤殘留自動 / 手動重設；更版重點已寫；repo 文件 `4ae0e89d`；Pages `39234927266` 綠、link-check 1152 / 0 errors、首頁 pre.4；exe 298 / zip 412 / AppImage 297 / dmg 309 MiB）+ `server-bundle-v0.7.1-pre.4`（7 assets）。前一版 `v0.7.1-pre.3`（2026-10-19 13:00，run `39201696170`，target `bf4bfe4f`：BUG-136 縮圖預覽上限、BUG-164 macOS 停用 Graphite + GPU 崩潰後重建；更版重點已寫；repo 文件 `892df2ec`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.7.1-pre.3`（7 assets）。更早見 `release-note.md` / `CHANGELOG.md` |
| **前一 tag** | `v0.7.1-pre.5`（2026-10-21 22:43，`d0ebd708`） |
| **目前主軸** | `v0.7.1-pre.5` 已發佈（第八十八 session，D179 小批 T0687–T0690）；等 外部測試者A 驗收 BUG-166（pre.4 起）；BUG-165 有空再排；下一批候選 BUG-169；T0675 PARTIAL 等使用者下載 S2-04／05；熱區無進行中工單 |
| **工單最大編號** | **T0698** DONE `ec4b3c13`（第八十九 session：BUG-165 codex 分頁滾輪依累積行數送多個 SGR 回報，上限 8；Q-1 塔台代決只認 `agentPreset === 'codex-cli'`；`test:unit` 5891 passed）；T0697 DONE `3bdd34eb`（內嵌 codex 0.160 → 0.163，整合點皆無變動，e2e t0592 / t0621 綠）；T0696 DONE `4b25af6e`（第八十九 session：CT-T022 驗收情境 2，舊分頁已關 → `--close-worker` exit 3、照常派工）；T0695 DONE `76306429`（CT-T022 驗收情境 1，備援重派前回收 exit 0、收單 exit 0）；T0675 PARTIAL → DONE（使用者已下載 S2-04／05）；**T0694** DONE `cefb9db3`（第八十九 session：Worker 回報後又在執行顯示 `↻`、不列入批次關閉，D180；`test:unit` 5857 passed / 329 files；e2e t0694 / t0538 / t0609 / t0621 綠；Worker 已回收）；T0693 DONE `6f3f623c`（第八十九 session：研究 Renew 後 Worker 分頁 ✓ 是否該清除，只查不修；建議 a + d1 + d2，Worker 已回收）；T0692 FIXED `560409a3`（第八十九 session：`Usage limit reset · continuing automatically` 歸 `claude-cli-resumed`；`test:unit` 5812 passed；Worker 已回收）；T0691 FIXED `b0ff5673`（第八十九 session：BUG-169，electron-builder `afterPack` 寫只含 name / version 的 `resources/package.json`，`verify-packaged-native.js` 新增 `helper-version`；`test:unit` 5805 passed / 326 files；Worker 已回收）；T0690 DONE `09509698`（第八十八 session：內嵌 claude CLI 追版 2.1.300 → 2.1.306，核對全部無變動，D179 追加）；T0689 DONE `b9afa02e`（`v0.7.1-pre.5` 前小批：安裝檔只收 6 個執行期 helper，打包前後守門）；T0688 DONE `79412e61`（SSH `start-failed` 字首跟 `errorCode` 一致、`@` 測試）；T0687 DONE `873e6efb`（PLAN-054 B4 MCP 寫入型 tool 政策，只寫文件）；T0686 DONE `bb926fdc`（第八十八 session：Test gate：`tests.yml` 可重用、pre-release／release 加 `tests` job 並列進 `build.needs`；actionlint 0，含反向測試；未觸發發版）；T0685 DONE `063c4efb`（第八十八 session：CI 第二步：`test:legacy` 33 檔 472 項全過、tests.yml 加 legacy 步驟、刪 5 個失效 script、5 處註解、wsl-systemd describeError、start-failed 補 11 項測試、`tsx` 4.23.15 devDependency、CLAUDE.md 測試位置規則）；T0684 DONE `4d4bce72`（29 項改跨平台／不依賴時區：9 檔 Windows 與 Linux TZ=UTC 皆 202 / 202、無 skip；時區是測試假設、產品正確；D178 兩處 path.win32）；T0683 DONE `a35c4ce3`（第八十八 session：CI 第一步：helper-env 隔離 + 手動 `tests.yml`；WSL 模擬 ubuntu 9 檔 21 項寫死 Windows 的測試會失敗）；T0682 DONE `5bd04ef4`（G4：9 檔 37 / 37、缺 mock 直接失敗；塔台重跑 37 / 37，0.66 s）；T0681 DONE `eaf8c168`（G3：SSH／WSL 4 檔 47 項去重，新增 vitest 35 項、錯誤期望不搬；塔台重跑 122 / 122）；T0680 DONE `21ce7b79`（G2：4 檔收進 vitest，+55 項；塔台重跑 142 / 142）；T0679 DONE `6fb40e70`（第八十八 session：BUG-168 研究分類，全部 A、無回歸）；T0678 DONE `d90b3b50`（第八十八 session：BUG-167 遷移測試斷言 + tests/ 盤點）；T0677 DONE `e95b445e`（第八十八 session：去識別化第二批，D176 追加）；T0676 DONE `b8ea0f8b`（第八十八 session：公開 repo 去識別化，D176）；T0675 PARTIAL `c09fe063`（第八十八 session：NotebookLM 製作第二季 Podcast；S2-04／05 排程生成，使用者自行下載）；T0674 DONE `0f50a83d`（第八十八 session：網站新頁「把腦力留給判斷」`/why`，D175；已 push、Pages `39576224181` 綠）；T0673 DONE（第八十七 session：EXP-WFMINE-001 執行單，`84e21f2d`）；第八十六 session：T0670 / T0671 研究、T0672 修正；第八十五 session：T0666–T0669；更早見 `_archive/state-snapshots/` |
| **BUG 最大編號** | **BUG-170** FIXED（第八十九 session：CT v5.12.x 重派前回收，T0695 / T0696 驗收 PASS；原 OPEN low，第八十九 session：yolo 備援重派後舊 Worker 分頁讓 `--close-worker` AMBIGUOUS，T0693 推演，D180 先記錄）；BUG-169 FIXED low（第八十九 session T0691 `b0ff5673`；第八十八 session 開立：安裝版 helper 版號 v0.0.0，T0689 發現；熱區 Open 2（BUG-165 / 170）/ Fixed 25）；BUG-168 FIXED（第八十八 session：tests/ 未納入 test:unit 的測試失敗與逾時；T0680–T0685，ubuntu 試跑全過，擋版 T0686）；BUG-167 FIXED（第八十八 session：遷移測試斷言過時，T0678 `d90b3b50`）；BUG-166（第八十六 session 開立並 FIXED，待 外部測試者A）；BUG-165 OPEN（有空再排）；BUG-164 CLOSED（收工後 外部測試者A 確認）；BUG-136 第八十六 session CLOSED（外部測試者A 確認）；熱區 Open 1 / Fixing 0 / Fixed 22 / Closed 28；BUG-165 OPEN、BUG-166 FIXED（T0672 `64209d44`，未發版，第八十六 session） |
| **PLAN 最大編號** | **PLAN-054**（PLANNED：CT Workflow 智能的 BAT 側事項，B4 / B6，第八十七 session 2026-10-20）；PLAN-053 IDEA（Electron 42+ 升級，第八十五 session）；PLAN-052 / 051 IDEA；PLAN-049 / 047 DONE；PLAN-015 / 029 / 038 / 043 IDEA |
| **決策最大編號** | **D180**（Renew 後 Worker 分頁 ✓：T0693 方案 a + d1 + d2，旁支開 BUG-170，使用者決定，2026-10-22 第八十九 session）；D179（`v0.7.1-pre.5` 發版前先開小批 T0687–T0689，使用者決定，2026-10-21 第八十八 session）；D178（T0684 Q-1／Q-2 檢查 Windows 路徑用 path.win32，塔台代決，2026-10-21 第八十八 session）；D177（BUG-168 修正分組與 CI 兩步，2026-10-21 第八十八 session）；D176（公開 repo 去識別化，2026-10-21 第八十八 session）；D175（網站 `/why` 設計初衷，2026-10-21 第八十八 session）；D174（T0672 Q-1，2026-10-19 第八十六 session）；D173（網站示意可用 `_ct-workorders/`，放寬 D159 / D165 grep 規則一項，2026-10-19 第八十五 session）；D171 / D172 第八十四 session |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20 17:26；執行單 T0673 DONE `84e21f2d`，7.35M tokens／39 agents；BMad-Guide Workflow 智能提案 Phase 1 試點）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v5.14.4**（第九十九 session 載入）；前次 v5.14.3（第九十八 session）；前次 v5.14.0（第九十七 session）；前次 Control Tower **v5.12.6**（第九十二 session 載入；第九十一 session v5.12.5；第九十 session v5.12.2；CT v5.12.3 起 `--close-worker` 最低 BAT 改為 `>= 0.6.1-pre.4`）；前次 v5.12.1（第八十九 session 重啟後載入；CT-T022 重派前回收舊 Worker 分頁）；前次 v5.11.0（第八十八 session 啟動時載入；本檔未記錄 v5.10 / v5.11 升級過程）；前次記錄 v5.9.0（第八十二 session 載入；CT-T021，BMad-Guide T0174，兩端；實機驗收結案 D071） |
| **unit test 基線** | **6130 passed / 343 files / 3 skipped**；`test:legacy` 472 / 0（塔台聯合驗證 @ `ae4602ed`，`0.7.2-pre.1` 批次，2026-10-30 第九十七 session，Node 26；typecheck 0 / 0、vite build 成功）。前次 5972 passed / 334 files / 3 skipped；`test:legacy` 472 / 0（塔台聯合驗證 @ `bfe7f0d6`，發 `v0.7.1-pre.7` 前，2026-10-25 第九十三 session；typecheck 0 / 0、vite build 成功）。前次 5661 passed / 322 files（@ `72d77cf1`，發 `v0.7.1-pre.4` 前，2026-10-19 第八十六 session） |

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
