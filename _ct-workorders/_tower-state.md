# Tower State — better-agent-terminal

> 最後更新:2026-10-05 12:33 (UTC+8) — **第五十六 session 收工** — YOLO（session-only）派發並完成 **5 張**（T0462-T0466，PLAN-039 多 remote profile 同時連線）；聯合複驗 unit 2861 / e2e 12 passed；PLAN-039 → IN_PROGRESS（待實機）；BUG-115 新開；push `6286c11..0d03fc7`；本機重打包 @ `0d03fc7`（未安裝）。
>
> **下次起手**:Fast Path 載入;**第一件事：確認使用者是否已安裝新 build**——以雜湊比對安裝版 `app.asar` = `8D76B219…16AA6`（L127），再陪使用者做本批實機驗收（PLAN-039 WSL + SSH 同開 + Fixed 17 張 BUG）。
>
> **前次更新**:2026-10-05 11:34 (UTC+8) — 第五十五 session 收工。
>
> **第五十七 session**（2026-10-05 13:08）：已發佈 **`v0.6.0-pre.2`**（@ `9cb7cd4`）。
>
> **第五十八 session 起手**（2026-10-13 15:40）：快照 8 天 → Full Scan。**安裝版已換為 `v0.6.0-pre.2` release**（exe FileVersion `0.6.0-pre.2`，`app.asar` 2026-10-05 13:05，SHA-256 `639351C4…18A27`，含第五十五 / 五十六 session 全部改動）→ 可直接進實機驗收。15:43 外部使用者回報 mac 啟動崩潰 → 開 **BUG-116**（high），等 Gary 回報環境資料再派單。15:53 開 **T0467**（PLAN-039 實機驗收自動化：source build + WSL + WSL 內 Docker 當 SSH，無 Agent），per-dispatch `--mode yolo --no-interactive`；15:58 BLOCKED（WSL 無 Docker）→ 使用者授權 Worker 安裝 → Renew #1 重派。16:05 Gary 資料到齊、BUG-116 根因確認 → 派 **T0468**（與 T0467 並行；T0468 禁動 node_modules）。16:14 **T0467 DONE**（`8fab37a`，docs 步驟 1-6 全 PASS）→ **PLAN-039 DONE**；T0467 Worker 為跑 vite 已 `npm ci` 修復本機 node_modules（npm 12.2.0 擋 install scripts，已手補 electron / esbuild / sharp / better-sqlite3；claude-code `install.cjs` 未補）；WSL 新裝 `docker.io` 29.1.3（保留）。16:15 **T0468 DONE**（`78e3bc9`，自有 loader + fail-soft + verify 加深；自 `v0.2.5-pre.1` 起所有 mac 版必崩）→ BUG-116 FIXED（待 mac 實機）。塔台聯合複驗 @ `98ee7fc`：vite ✅、unit **170 files / 2888 passed** / 1 skipped ✅、verify-native-modules ✅、e2e plan039 4 passed / 5 skipped（opt-in）✅。16:18 使用者裁決：**先補 mac CI 檢查再發 pre.3**；開 T0469（opencc 延遲載入）∥ T0470（mac CI 兩 arch whisper.node 檢查）→ T0471（本機 npm 12 install scripts，CLAUDE.md 與 T0470 重疊故排後）。16:21 **T0469 DONE**（`01e6082`，opencc 延遲載入；unit 171 files / 2890 passed）。16:22 **T0470 DONE**（`a8c18f3`，`scripts/verify-packaged-native.js` + pre-release / release mac job 步驟；unit 172 files / 2900 passed；CI 實跑待 pre.3）→ 派 T0471。16:26 **T0471 DONE**（`a48aa95`，claude-code `install.cjs` 補跑 → 內嵌 claude `2.1.289`；`electron-winstaller` 不需要；根 `postinstall` 的 `npm rebuild better-sqlite3` 在 npm 12 下為 no-op；CLAUDE.md 新節）。塔台聯合複驗 @ `a48aa95`：vite ✅、unit **172 files / 2900 passed** ✅、verify-native-modules ✅、verify-helper-bundle ✅。16:39 使用者：T0471 三項建議一併處理後再發 pre.3 → 開 T0472（verify 加 claude stub / better-sqlite3 .node）→ T0473（allowScripts + postinstall ABI，可能 `npm ci`，故串行在後）。16:46 **T0472 DONE**（`verify-native-modules` 加 claude stub / better-sqlite3 `.node`；unit 173 files / 2920 passed）→ 派 T0473；T0472 提出 mac x64 dmg 可能內嵌 arm64 原生 binary → 開 **BUG-117** + 研究 **T0474**（下載 pre.2 x64 dmg 靜態檢查）。16:58 **T0473 DONE**（`eaa8cca`：`allowScripts` 放行 5 套件（name-only，electron-winstaller 不列入以保 npm 11 行為不變）；postinstall 改非 CI 時 `@electron/rebuild -f -w better-sqlite3`（原 `npm rebuild` 產 Node ABI 137，D051 已補更正）；npm 12 `npm ci` 零手動、npm 11.19.0 CI 模擬 node_modules 0 差異；lock 零差異）。16:59 **T0474 DONE**：pre.2 實物證實 **BUG-117 成立 → high**（x64 dmg 55/84 binary 為 arm64；whisper `mac-x64` 上游實為 arm64）；附帶發現開 **BUG-118**（high，非 Windows 打包版缺 `claude-code/bin/claude.exe`，electron-builder 排除 `.exe`）。17:02 使用者裁決 **D136**：BUG-118 放進 pre.3（A1）、BUG-117 採 B3 停發 x64 dmg → 派 **T0475**（合併兩者 + verify-packaged-native 擴充），BUG-117 / 118 → FIXING。17:20 **T0475 DONE**（`0d39b53`：A1 平台子套件 claude + `EmbeddedClaudeMissingError`；mac arm64-only；verify-packaged-native mac 全 Mach-O cputype + 內嵌 claude、Linux 內嵌 claude；pre.2 實物回放正向 PASS / 負向 FAIL）→ BUG-117 / 118 FIXED（待 CI 實跑 + 實機）。塔台聯合複驗 @ `730a2fc`：vite ✅、unit **173 files / 2964 passed** ✅、tsc 36 ✅、verify-native-modules ✅、verify-helper-bundle ✅、lock 自 session 起 0 差異。19:01 使用者確認 → push（`5679ac1..c634327`）+ 派發 pre-release run `38387358451`。19:03 使用者指示附帶發現一併修 → **D137** + 開 **T0476**（Homebrew / Chocolatey opt-in、README 移除上游套件安裝、`darwin-x64`），CI 完成後派發。19:15 **已發佈 `v0.6.0-pre.3`**（@ `c634327`，run 全綠：mac `verify-packaged-native` arm64 55 Mach-O 全 arm64 + 內嵌 claude `claude-code-darwin-arm64/claude` + whisper `mac-arm64` ✅；linux 內嵌 claude ELF x86-64 ✅；`npm ci` 僅 warn（mac `fsevents` / win `electron-winstaller` 未列 allowScripts，npm 11 照跑）；4 assets（arm64 dmg / exe / zip / AppImage，無 x64 dmg）+ `server-bundle-v0.6.0-pre.3` 7 assets）；release notes 補「不支援 Intel Mac」；`package.json` 同步 `0.6.0-pre.3`。待 Gary 裝 arm64 dmg 驗收 BUG-116 / 117 / 118。19:19 派 T0476；19:23 **T0476 DONE**（`3c0a66e`：Homebrew / Chocolatey opt-in（`vars.HOMEBREW_TAP_REPO` / `vars.CHOCOLATEY_PUBLISH`）、過期日期 gate 移除、README 拿掉上游 brew / choco、`DESKTOP_PACKAGE_HOSTS` 去 `darwin-x64`；unit 173 files / 2965 passed）；塔台抽驗 YAML 可解析、`tonyq` 0 次、verify 測試 21 passed、verify-native-modules ✅；`_local-rules.md` 補「下游發佈」段。20:03 使用者：README badge 過期也開單 → 派 **T0477**；20:07 **T0477 DONE**（`ec75faa`：Version badge 動態 `filter=v*`（排除 server-bundle release）、Electron 讀 package.json、Platform 標 Apple Silicon；技術堆疊依 package.json 重列、儲存列改 JSON（better-sqlite3 0 import）；發行段改 pre-release.yml 顯式版號流程、刪 VSCode Task 句；Node 20.19+、macOS 12+）。22:08 派 **T0478**；22:18 **T0478 DONE**（`ff24152`：README 設定 / 日誌路徑改為實況兩目錄、日誌預設開啟與 `BAT_DEBUG` 無關；CLAUDE.md Logging；`trigger-prerelease.ps1` 無 / 錯版號 exit 1 不呼叫 gh + `-DryRun`；tasks.json 刪無版號 task）；塔台抽驗 guard exit 1 / DryRun ✅。T0478 發現 userData 分裂 → 開 **BUG-119**（medium）；22:20 使用者裁決先研究再修 → 派研究 **T0479**；22:32 **T0479 DONE**（`9666f96`：推薦 bootstrap + ready 前 migration + 顯式 setPath；🔴 `Local State` 必須 ready 前複製否則 server-token 失效；runtime 實測 `better-agent-terminal-runtime-97`）→ **D138** 開 T0480（A 核心）∥ T0481（B helper env）→ T0482（C 文件），BUG-119 → FIXING。22:40 **T0481 DONE**（`33044c0`：本機 PTY 三條 env 路徑注入 `BAT_USER_DATA`；`_bat-cert` / `_bat-logger` 解析序 override → `BAT_USER_DATA` → `APP_NAME`+`BAT_RUNTIME`；headless 不變；Worker 全套 unit 173 files / 2973 passed（含 T0480 WIP）、verify:helpers ✅）；commit 只含本單 6 檔，T0480 仍 IN_PROGRESS，聯合複驗待 T0480。22:44 **T0480 DONE**（`95739d0`：`app-paths-bootstrap.ts` 為 main.ts 第一個 import + `userdata-migration.ts`（Local State 缺才複製、snippets 複製 / 合併、message-archives rename、runtime 目錄改名、marker、runtime id 白名單）+ snippetDb lazy + 自檢；產物 `setPath("userData"` 8451 < snippet 單例 272622；e2e bug119 2/2 + 回歸 7 passed；真實目錄未動）。塔台聯合複驗 @ `b1eefb3`：vite ✅、unit **176 files / 3009 passed** / 1 skipped ✅、tsc 36 ✅、verify-native-modules ✅、verify:helpers ✅、lock 僅版號同步差異 → 派 T0482。待實機：Windows server-token 不變 / 新 Logs、mac Keychain 殘餘風險。22:49 **T0482 DONE**（`14f06e3`：README / CLAUDE.md / docs/plan-027 改回單一 userData + 升版搬移 / 降版 / 勿同時執行新舊版說明）→ **BUG-119 FIXED**（待 pre.4 實機）。pre.4 release notes 待寫：userData 統一與搬移、runtime 實例 snippets 各自一份、不要同時執行新舊版。22:52 使用者指示發 **v0.6.0-pre.4** → run `38417070634`（@ `da787a7`）進行中，release notes 草稿已備。22:53 使用者：claude CLI 追版開單 → **T0483**（`^2.1.289` → `^2.1.296`，target pre.5）。23:02 **T0483 DONE**（`7b8ef0c`：CLI 2.1.296、新增 `claude-haiku-5-5` builtin + 分段計價（≤100K / >100K）、Sonnet 5.5 cache read 0.05x（官方價目）、effort / HEALTHY_MIN 不變、DISABLE_UPDATES 仍有效；lock 只動 claude-code 系列 10 條目）。塔台聯合複驗 @ `7b8ef0c`：vite ✅、unit **176 files / 3015 passed** ✅、tsc 36 ✅、verify-native-modules ✅、內嵌 `2.1.296 (Claude Code)` ✅。23:04 **已發佈 `v0.6.0-pre.4`**（@ `da787a7`，9 job 全綠；mac verify-packaged-native arm64 55 Mach-O + 內嵌 claude ✅、linux ELF x86-64 ✅；4 assets + `server-bundle-v0.6.0-pre.4` 7 assets）；release notes 寫入 userData 統一 / 搬移 / runtime snippets / 勿同時執行新舊版；`package.json` 同步 `0.6.0-pre.4`。待實機：Windows 升版後 server-token 不變 + 新 Logs（BUG-119）、Gary mac pre.4（BUG-116/117/118 + Keychain）。23:11 使用者：Haiku 成本低估也修、其他已知問題一次開單、不要逐一發版 → **D139** 開 T0484-T0493（分波並行，整批後才發 pre.5）；回饋存 memory `batch-fixes-before-release`。

---

## 🛏 本 Session 收工快照 (第五十六 session, 2026-10-05 11:40 - 12:33, ~53m wall)

### 主軸：PLAN-039 多 remote profile 同時連線——YOLO 自主派發 T0462-T0466 全 DONE → 聯合複驗 → push → 本機重打包待安裝

#### 起手狀態

Fast Path（快照 11:34，6 分鐘前）。git 領先 9（第五十五 session 收工 commits 未 push）；BAT 安裝版 `F81C9FF4…`（05:28，不含第五十五 session 改動）。使用者選「派 T0462 ∥ T0465 + YOLO（session-only）」、Worker 互動「不允許」（`--no-interactive`）。

#### 時間線（時間取自系統 / git）

1. **11:42** 派 T0462 ∥ T0465（D135 第 1 / 4 列；`affects_files` 僅 `electron/remote/__tests__/` 目錄重疊，新檔不同 → 可平行）
2. **11:49-11:50** T0465 DONE（`b677e71`，SSH tunnel 動態埠 bind 失敗換埠重試一次 + 固定埠重複 warn）、T0462 DONE（`470f81a`，`RemoteConnectionRegistry` 模組）→ 派 T0463 前補「塔台補充」（T0462 接線備註、T0465 port claim 必經 `client.disconnect()`）
3. **11:50-12:02** T0463 DONE（`8604daa`，`main.ts` 單一 `remoteClient` 槽位 → registry；`other-profile` 移除；two-servers 整合測試）→ 塔台補跑 vite build
4. **12:03-12:14** T0464 DONE（`48cba04`，quit await ≤ 2 s、`'limit'` reason + 三語對話框、同 target warn、lifecycle 測試；修正首窗保護被降級）→ 塔台補跑 vite build
5. **12:14-12:22** T0466 DONE（`6bd81f6`，e2e 兩個 isolated 實例互為 server，M1-M4 4/4；CLAUDE.md 新節 + docs 實機步驟）→ PLAN-039 → IN_PROGRESS（待實機）
6. **12:22-12:28** 塔台聯合複驗 @ `26db914`：vite ✅、unit 168 files / 2861 ✅、e2e 首輪 1 failed（偶發，未保留名）→ 再跑 3 輪 12 passed / 8 skipped / 0 failed
7. **12:28-12:30** 使用者選「push + 重打包」→ push `6286c11..0d03fc7`；`release.ps1 -Snapshot` 失敗 → **BUG-115**；改不帶 `-Snapshot` 重打包成功（新 `app.asar` `8D76B219…16AA6`），待使用者安裝
8. **12:33** 使用者「收工」

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **5**（T0462-T0466） | 全 DONE；皆一次啟動成功（BUG-114 未復現）；平行 1 組（T0462 ∥ T0465） |
| BUG | 新開 1（BUG-115 low） | Open：061 / 114 / 115；Fixed 17 待實機 |
| PLAN | PLAN-039 PLANNED → **IN_PROGRESS**（程式完成） | 待 WSL + SSH 同開實機驗收後 DONE |
| 決策 | 0（沿用 D135） | 斷點 C × 8 由塔台裁決，記於 YOLO 歷程 |
| Learnings | L146 | |
| unit test | 2646（@ `2f8237d`）→ **2861 passed / 168 files**（塔台聯合複驗 @ `26db914`） | 0 failed |
| tsc | **36**（不變） | ⚠️ 只涵蓋 `src/`（L146）；electron 型別由 Worker 以 scratchpad tsconfig 補檢 0 新錯 |
| e2e | 8 → **12 passed** / 8 skipped / 0 failed | +`e2e/plan039-multi-remote.spec.ts`（4）；首輪偶發 1 failed 未重現 |
| push | `6286c11..0d03fc7` | BUG-115 / 收工 commits 未 push |
| 本機打包 | `release\BetterAgentTerminal Setup 0.6.0-pre.1.exe` @ `0d03fc7` | **未安裝**；新 `app.asar` SHA-256 `8D76B219…16AA6` |
| 塔台直接改動 | T0463 / T0464 / T0466 工單「塔台補充」+ `affects_files` 補列；PLAN-039 狀態；`_backlog.md` / `_bug-tracker.md` 同步；BUG-115 開單 | |

### 重點觀察 / Learnings

- **L146**：`npx tsc --noEmit` gate 只涵蓋 `src/`（`tsconfig.json` include），改 `electron/**` 的單需另檢 electron 型別
- 派發前把前序工單回報區的「接線備註 / 剩餘範圍」轉寫進下一張工單的「塔台補充」，T0463 / T0464 / T0466 皆零返工
- `release.ps1 -Snapshot` 不可用（BUG-115）；本機打包暫以 package.json 版號 + 雜湊驗換新

### 編號起始（下 session）

- **T0467** / **BUG-116** / **PLAN-040** / **D136** / **L147**

---

## 🛏 前 Session 收工快照 (第五十五 session, 2026-10-05 05:30 - 11:34, ~6h04m wall，含 07:46-11:19 使用者離開)

### 主軸：收工待辦第 3、4 項 → YOLO 自主派發（D134）→ 遠端安全 / 精靈 / 附件路徑 / K 遠端 Tower 通知 → 安全 review BLOCK 與修復 → 最終聯合複驗 → push → PLAN-039 研究與拆單

#### 起手狀態

Fast Path（快照 05:26）。git 0/1（收工快照未 push）；BAT 安裝版 = 本機 build `0.6.0-pre.1`（`app.asar` 05:28，與 `release\win-unpacked` 同雜湊）。使用者 `*config auto-session yolo`（未 `--save`）。

#### 時間線（時間取自系統 / git）

1. **05:33-05:38** 使用者選第 3、4 項 + 批 1-3 範圍、BUG-106 移除、BUG-098 移除 direct → D134 → 第一波 5 張（T0417-T0421）
2. **05:41-06:01** T0417-T0419、T0422-T0425、T0428-T0431、T0435 完成；05:46 斷點 C 合併裁決（T0427-T0430）；**05:55 使用者授權「塔台給最佳建議, 直接決定」**；T0420 → K 採 A'（每 PTY 範圍權杖）→ T0431-T0434；T0421 → BUG-107 / 108 / 109、PLAN-038、T0435-T0441
3. **06:08-06:34** T0431、T0442、T0426、T0443、T0427 完成；開 BUG-110（遠端視窗 fail-open）/ BUG-111（精靈 rollback 刪使用者容器）/ PLAN-039；T0432 權杖 → **T0445 安全 review BLOCK**（1 critical + 2 high）→ T0447-T0451
4. **06:37-07:05** T0433、T0444、T0446、T0447（BLOCK 解除）、T0448、T0449、T0453、T0436（ct-done 補救）、T0441、T0450、T0451 完成；BUG-112（detached fail-open）/ BUG-113（detach 自 `512c118` 失效）；CRLF 根因定位（T0454）
5. **07:07-07:20** T0434 / T0455 / T0456 完成；**WSL dev deploy `t0456` + smoke 13/13**（使用者授權）；T0454 定位 Vite `hashbangRE` 不容 `\r`；T0452 派發未啟動 → 重派；使用者修正「30 秒太快」
6. **07:28-07:46** T0437-T0440、T0452、T0457（重派）、T0458（detached 視窗外部頁取得 `electronAPI`，e2e 證實）完成；D134 第 1-42 列完成 → 最終聯合複驗全綠 → `*sync`
7. **11:19-11:31** 使用者：push（86 commits）、開 PLAN-039 研究、可執行檔確認框 → T0459 / T0460 / T0461 完成；PLAN-039 拆單 D135（下 session）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **45**（T0417-T0461） | 全 DONE；研究 3（T0420 / T0421 / T0459）+ 安全 review 1（T0445）；Worker 未啟動重派 2（T0452 / T0457）、ct-done 補救 1（T0436） |
| 開單未派 | 5（T0462-T0466） | PLAN-039，D135 |
| BUG | 新開 8（107-114）；FIXED 13（096-100、106-113） | Open：061 / 114；Fixed 17 待實機；BUG-105 FIXED 延伸（T0437-T0440） |
| PLAN | 新開 2（PLAN-038 IDEA、PLAN-039 PLANNED） | PLAN-036 K 完成（P3 剩無） |
| 決策 | 2（D134 排程 1-45 列、D135） | |
| Learnings | L142-L145 | |
| unit test | 1867 → **2646**（塔台聯合複驗 @ `2f8237d`）→ Worker 2768（@ `0061e3d`） | 0 failed；CRLF worktree 亦全綠 |
| tsc | 40 → **36** | |
| e2e | 6 → **8 passed** / 8 skipped / 0 failed | +T0453 / T0458 spec |
| WSL | dev deploy 1 次（tag `t0456`）；smoke **13/13** | |
| push | `e11a2f6..6286c11`（86 commits） | 未發版 |
| 塔台直接改動 | `_local-rules.md` 遠端派單路由（agent 模式 + `BAT_HELPER_NODE`）、`_bug-tracker.md` / `_backlog.md` sync、記憶 2 則 | |

### 重點觀察 / Learnings

- **L142**：「只在某環境壞」不以環境異常結案——CRLF（autocrlf + 無 `.gitattributes`）+ Vite `/^#!.*\n/`
- **L143**：`bat-terminal` exit 0 ≠ Worker 已啟動；≥ 3 分鐘無 `started_at` 才疑似、重派前確認原 Worker 無活動（BUG-114）
- **L144**：同工作樹平行改熱點檔——`git apply --cached` 精準 stage；聯合複驗用乾淨 worktree
- **L145**：Worker 回報「範圍外 / 殘留風險」藏 high 級問題（6 個 high 中 5 個由此發現）
- 使用者偏好：scope 內斷點 C 由塔台直接裁決、事後回報（記憶 `tower-decide-breakpoint-c`）

### 編號起始（下 session）

- **T0467** / **BUG-115** / **PLAN-040** / **D136** / **L146**

---


## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-05 12:33 UTC+8（第五十六 session 收工）

### 本 session 已清空的項目
PLAN-039 T0462-T0466 全 DONE ✅ ｜ 聯合複驗 unit 2861 / e2e 12 passed ✅ ｜ push `0d03fc7` ✅ ｜ 本機重打包 ✅（待安裝）

### 待辦（依優先序）

1. 🟡 **安裝新 build + 本批實機驗收**（`release\BetterAgentTerminal Setup 0.6.0-pre.1.exe` @ `0d03fc7`，`app.asar` SHA-256 `8D76B219…16AA6`；安裝後先比對雜湊）：**PLAN-039** WSL + SSH 同開、關一窗 15 s 後只斷該 profile（`docs/remote-dev-overview.md`「Several remote profiles at once」，通過 → PLAN-039 DONE）；Fixed 17 張 BUG：遠端視窗 fail-closed（BUG-110 / 112）、拖放 / 附件 / 複製遠端路徑 / 終端拖放 / prompt 路徑提示（BUG-107 / 108、T0437-T0440）、detach（BUG-113）、可執行檔確認（T0460 / T0461）、SSH 精靈（BUG-098-100）、Docker（BUG-097 / 111，需 Docker daemon）、真 BAT 遠端視窗 Tower 派單（K，WSL `~/.claude/skills` 需裝 ct skill）。**發版綁定**：T0435 ↔ T0437、T0453 ↔ T0458
2. 🟢 BUG-115 → T0488、BUG-114 → T0490 研究、`.gitattributes` → T0493（D139）；Vite `hashbangRE` 上游回報
3. 🟢 backlog：**D139 批次 T0484-T0493**（pre.5，整批完成後才發版）、Haiku 5.5 CLI 版本門檻（待證據）、snippet「agent 提案 → 一鍵套用」、PLAN-038、BUG-084 Phase 2、PLAN-035 Phase 2
4. 🟢 L130 D094 門檻復議｜L128 Logging 節｜`*archive` 到齡候選（先 grep 程式碼引用，L133）

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open 5 / Fixed 18 / Closed 20）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D135）｜ Learnings → [_learnings.md](_learnings.md)（最大 L146）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（72 entries）

### 編號起始
- **T0494** / **BUG-120** / **PLAN-040** / **D140** / **EXP-[TOPIC]-001** / **L147**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.6.0-pre.4**（package.json + lock，2026-10-13 23:05 同步） |
| **最新 release** | `v0.6.0-pre.4`（2026-10-13 23:04，run `38417070634`，target `da787a7`，含 BUG-119 userData 統一 / T0476-T0478；不含 T0483）+ `server-bundle-v0.6.0-pre.4`（7 assets）。前一版 `v0.6.0-pre.3`（2026-10-13 19:15，第五十八 session，run `38387358451`，target `c634327`；mac 只 arm64 dmg，D136）+ `server-bundle-v0.6.0-pre.3`（7 assets）。前一版 `v0.6.0-pre.2`（2026-10-05 13:07，第五十七 session，run `37265491592`，target `9cb7cd4`，含第五十五 / 五十六 session 全部改動）+ `server-bundle-v0.6.0-pre.2`（7 assets）；同時段另有一次派發 run `37265211762` 因 `version` 帶 `v` 前綴在 manifest 比對失敗，未建 tag |
| **前一 tag** | `v0.6.0-pre.1`（2026-10-05 05:24，`c92faf7`） |
| **目前主軸** | 安裝新 build → 本批實機驗收（PLAN-039 + Fixed 17）→ 下一預覽版 |
| **工單最大編號** | T0466（第五十六 session：T0462-T0466 全 DONE） |
| **BUG 最大編號** | **BUG-118**（OPEN high，非 Windows 打包缺內嵌 claude）；**BUG-117**（OPEN high，mac x64 dmg 內嵌 arm64，T0474 證實）；**BUG-116**（FIXED high，T0468 `78e3bc9`，待 mac 實機）；BUG-115（OPEN low，`release.ps1 -Snapshot`）；BUG-114 OPEN medium；BUG-061 OPEN；096-100 / 105-113 / 086 / 088 / 093 FIXED 待實機 |
| **PLAN 最大編號** | PLAN-039（**DONE** 2026-10-13，T0467 實機驗收自動化）；PLAN-038（IDEA）；PLAN-036 / 037 / 035 / 031 IN_PROGRESS |
| **決策最大編號** | D136 |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower v5.0.9 |
| **unit test 基線** | **2861**（塔台聯合複驗 @ `26db914`，168 files）；e2e 12 passed / 8 skipped / 0 failed；**tsc baseline 36（僅 `src/`，L146）** |

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
> 最後掃描:2026-10-13 15:40 (UTC+8) 第五十八 session 起手 Full Scan（前次 2026-10-04 11:09）

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b` |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（10-13 15:40 PowerShell 複核，terminal `66447ea9…`）；⚠️ BUG-114 仍 OPEN（L143） |
| BAT 安裝版 | ✅ `v0.6.0-pre.2` release | exe FileVersion `0.6.0-pre.2`；`app.asar` 2026-10-05 13:05:30 SHA-256 `639351C4…18A27`（非本機 `release\win-unpacked` 的 `8D76B219…16AA6`——後者為 `0.6.0-pre.1` 版號的本機 build @ `0d03fc7`，已無需安裝） |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ⚠️ 路徑與文件不符 | 實際在 `%APPDATA%\better-agent-terminal\Logs\debug-<stamp>.log`；`bat-scripts.log` 在 `%APPDATA%\BetterAgentTerminal\Logs\`。CLAUDE.md Logging 節待修（L128） |
| 平台 | Windows | PowerShell 主，Bash tool 並存；系統 gitconfig `core.autocrlf=true`、repo 無 `.gitattributes`（L142） |
| UAC | ⚠️ `EnableLUA=0` | BAT 與子 shell 皆提權（BUG-085 背景） |
| gh CLI | ✅ | 已登入 `gowerlin`；**必須帶 `-R gowerlin/better-agent-terminal`**（L122）；本 session 未用 gh |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `main` = `origin/main` = `b5a689d`（10-13 15:40 fetch 後），working tree 乾淨 |
| WSL server | dev-deploy | `~/.local/bat-server`：tag `t0456`（JS = HEAD `698a157` 等價 + 4 helper `scripts/`）；smoke 13/13；回復 `npm run deploy:headless:dev -- --target wsl:Ubuntu-24.04 --rollback --yes --tag t0456`；重跑 WSL 精靈會以 release bundle 覆蓋 |
| ct-exec / ct-done / ct-status / evolve / insights / fieldguide / help | ✅ | 全套可用（本 session 用 ct-done 補救 T0436） |
| 熱區工單 | **T:112 檔 / BUG:39 / PLAN:11** | T 含 4 個報告檔（L132）；`archive_days: 2` 下大量到齡候選，下 session 可 `*archive`（先 grep 程式碼引用，L133） |
| 最大編號 | **T0493 / BUG-119 / PLAN-039 / D139 / L146** | 下張：T0494 / BUG-120 / PLAN-040 / D140 / L147 |
| unit test | ✅ **2861 passed / 168 files**（塔台聯合複驗 @ `26db914`，主工作區） | |
| vite build | ✅ | 主工作區 exit 0（@ `26db914`）；`release.ps1` 完整打包 exit 0（@ `0d03fc7`） |
| e2e | ✅ **12 passed / 8 skipped / 0 failed** | 主工作區全套 ×3；首輪（緊接 unit 後）偶發 1 failed 未重現 |
| tsc --noEmit | ⚠️ 36 既有 error | 僅涵蓋 `src/`（L146）；electron 端以 scratchpad tsconfig 補檢約 76 既有 |
| 開放 PR | 0 | |
| 設定來源 | project | `_tower-config.yaml`（auto-session **on**；本 session 以 session-only `yolo` 覆寫，收工即失效） |
| 塔台版本 | v5.0.9 | control-tower skill |

> **Drift / 注意事項**:
> 1. ✅ 第五十六 session 收工：第五十四 session 快照與第五十六 YOLO 逐筆歸檔至 `2026-Q4.md`（INDEX 71-72）
> 2. ⚠️ 第五十六 session 的 Worker 分頁（`92dff1c9…` / `0eff417f…` / `cbab92e6…` / `9e30eeaf…` / `a282d11a…`）皆已完成，可關閉
> 3. 🔴 **D094 mac installer 280 MB cap 長期超標**（mac dmg ~920 MB）未復議（L130）
> 4. ⚠️ CLAUDE.md「Logging」節路徑錯誤（L128），待修
> 5. ⚠️ `_ct-workorders/T0293-review-report.md` 含 2 個 NUL 位元組（既有）
> 6. ⚠️ **L132**：`T0292/T0293/T0298/T0302-*-report.md` 命名越界，維持現狀（2026-09-02 裁決）
> 7. ⚠️ **L129**：含反斜線的內容一律走 Write 工具（本 session 收工 learnings / 快照片段皆以 Write 寫入 scratchpad 再組合）
> 8. ⚠️ **L136**：VS Code Insiders 可能鎖 `release\win-unpacked\resources\app.asar`
> 9. ⚠️ 舊 Worker 分頁 `69012c…`（T0452 首派）、`910bc8cf…`（T0457 首派）若仍開著請關閉（BUG-114）
> 10. ⚠️ **發版綁定**：T0435 ↔ T0437（拖放修好後遠端附件需路徑轉換擋板）、T0453 ↔ T0458（detach 修好後需導航守門）

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

- 2026-10-05 第五十六 session：session-only yolo（Worker 互動不允許）；D135 PLAN-039 T0462-T0466 全 DONE、皆一次啟動；斷點 C×8 由塔台裁決；逐筆見 2026-Q4.md「YOLO 歷程（第五十六 session）」
- 2026-10-05 第五十五 session：session-only yolo；D134（45 列）全 DONE；斷點 C 由塔台裁決；派工未啟動 2 次 + commit 前停住 1 次（BUG-114）；逐筆見 2026-Q4.md「YOLO 歷程（第五十五 session）」
- 2026-10-04 第四十九 session：session-only yolo；T0365-T0374，含 2 次外部動作閘（bump + push + pre-release 由使用者授權）；逐筆見 2026-Q4.md「YOLO 歷程（第四十九 session）」
- 2026-04-18 第三 session：CT-T003 DELEGATE PARTIAL → DONE；`*evolve` L057-L066；`*archive` 活躍引用豁免測試
- 2026-04-18 T0174 Phase 2-6 session：T0173 研究 DONE；首次斷點 C（事後確認，L064）；使用者中斷「停」驗證
- 2026-04-18 上半場（PLAN-020 開發）：7 張本專案 + 1 跨專案 DELEGATE，全 DONE，無斷點
- 2026-04-18 下半場第二 session：T0174 Phase 0-1 dogfood（無派發）
