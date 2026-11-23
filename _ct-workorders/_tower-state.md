---
schema_kind: tower-state
summary_version: 1
updated_at: "2026-11-23T16:20:43+08:00"
session: "2026-11-23 15:07 第一百二十七 session（CT v6.0.0）"
next_ids:
  workorder: "T0887"
  decision: "D308"
  bug: "BUG-214"
  plan: "PLAN-067"
todo:
  - "🔄 PLAN-066 局部改進（D307）：使用者接受不做整體改寫；`ct/T0885` 保留。照建議順序在 **`v0.8.x` 分支**做（main 只有塔台紀錄；各工單 worktree 隔離、完成後合進 `v0.8.x`）：① **T0886** 研究 Node 端省 node-pty 每個 PTY 的 Worker＋WSL Linux 增量（research，yolo，worktree `ct/T0886`）→ 能省做 Node 端修正，否則 ② Rust Terminal Server 設計 → ③ 實作 → ④ 驗收。發版：先 `desktop-build.yml -f ref=v0.8.x` 只 build 給使用者試，驗過再發 `v0.8.0-pre.1`（屆時另取授權、先查 0.7.5 預覽版使用者的新版通知行為）。注意：BAT 的 worktree base 是主 checkout HEAD（main），依序的實作單要先決定怎麼以 `v0.8.x` 為 base"
  - "✅ PLAN-066 評估（D304，🔴 High）BAT 改用 Rust 改寫：✅ T0885 DONE（D306，15:59 收單；主線回報 `9365675a`，分支 `ct/T0885` `dc2d3ed2` 只有 `experiments/rust-eval/` 34 檔，worktree 保留（`--worktree keep`）、不合併不 push；報告頁 https://claude.ai/artifact/LYTj1aGEZKq2bu6SMm6ZqT）。結論：不建議 Tauri／全原生；只有 PTY 持有改 Rust 有明顯收益（10 分頁約 −160 MB），建議先研究 Node 端省掉每個 PTY 的 Worker。**待使用者裁決** Q1（分頁數、是否實際卡過）、Q5（接受整體改寫不做）、分支處置。歷程：三條路線＋最小 Tauri／Electron PoC；研究單 T0885（research，yolo）15:14 首派（非隔離）→ 使用者指示改 worktree（D305），`--close-worker` 因持續輸出被 BAT 取消、使用者手動關閉分頁 → 15:24 以 `--isolation worktree` 重派 exit 0、`started: 2026-11-23T07:24:17.861Z`（分頁 `87bf3530…`；worktree `.bat-worktrees/better-agent-terminal/T0885`、分支 `ct/T0885`、base `cbec5f7f`，PoC 在 `experiments/rust-eval/`、不合回主線）；產出工單回報＋私人長文報告 Artifact"
  - "✅ D303（2026-11-20）候選後續開單 3 張（✅ T0882 DONE，產品 commit `b9002712`，16:53 塔台收單：只動 `e2e/fixtures/electron-isolation.ts`＋protocol v1 測試；unit 8406 passed / 460 files、typecheck:electron 0、build OK、e2e t0776 / t0821 / t0823 / t0825 / t0861 / bug119 全過，塔台重跑 protocol v1 37 passed；預寫遇 legacy runtime 目錄不寫（避免擋 BUG-119 遷移）；Worker 分頁已排程關閉；16:53 派工 T0883 → ✅ T0883 DONE，產品 commit `ece924e5`，16:58 塔台收單：`ProfileEntry.wslKeepAlive` 型別（`WslDetails` 與其測試改用 `ProfileEntry`，行為不變）；docs `multi-remote-profiles.md` 補精靈步驟中止（依現況含 T0840 / T0850 後共 8 個接 `operationId` 的 handler）、`remote-security.md` 補 `ws-limits` / `FRAME_TOO_LARGE`；CLAUDE.md PLAN-039 節 +2 行（keep-alive 唯一實作、步驟結束後才 rollback）；typecheck 0 / 0（塔台重跑 typecheck 0）、unit 8406 passed、build OK；Worker 分頁已排程關閉；16:58 派工 T0884 → ✅ T0884 DONE，產品 commit `cf0b0809`，17:05 塔台收單：共用純函式 `planForkPendingSend`（`remote-image-budget.ts`），Claude / Codex `onHistory` 遠端超過預算 → 不送、toast、放回輸入與附圖，預算內 / 本機逐字不變；listener 以 ref 讀最新 `isRemoteWindow`；docs `remote-security.md` 已改現況；typecheck 0、unit 8414 passed / 461 files、build OK，塔台重跑兩個測試檔 15 passed、typecheck 0；BUG-211 單補一行指向 T0884；Worker 分頁已排程關閉。**D303 三張全部完成**；使用者指示 push `f81348d8..68121ee0`（去識別化＋金鑰掃描 0 筆）並跑 `tests.yml` `44708888774` success（Linux：vitest 462 files passed / 2 skipped、legacy 33 files / 472 tests passed）。觀察（未開單）：既有 `onHistory AUTO-SENDING` / `handleForkSession` debug log 記 prompt 全文。後續觀察（不開單）：`site-media` 的 `launchRecording` 不經 `launchIsolated`，只在 `BAT_SITE_MEDIA=1` 時跑），同一 checkout 依序派工，全部完成後問使用者是否 push：T0882 e2e `launchIsolated` 預寫 settings 關閉檢查新版＋protocol v1 測試 B 組改 `until()` → T0883 `ProfileEntry.wslKeepAlive` 型別＋keep-alive／精靈中止／`ws-limits` 文件 → T0884 遠端 fork 待送圖片預算檢查。需人工驗收的 C（SSH / Docker 長呼叫 operation id）、H（Docker fingerprint）、I（docker-acceptance 單元測試）、J（卡片等待時可送出）不開單"
  - "✅ T0873 DONE（D297，commit `d215ae93`／`e74cf969`／`69d872ad`／`103239ff`，**未 push**；10:00 塔台收單：`npm audit` 51 → 8（critical 0、high 0、moderate 6、low 2），塔台重跑確認；本機 linux 平台套件已清除、工作區乾淨）：electron-builder 26.8.1 → 26.18.0（NSIS 範本本機比對語意不變，內層 7z 改 BCJ）、vite 7.3.8、vitest 4.1.12、simple-git 4.1.0（Git Graph 的 git 子程序不再繼承 `GIT_*`／EDITOR／PAGER 等 env）、uuid 14.0.3（移除 `@types/uuid`）、sharp 0.35.5；每步關卡不比基準差。使用者指示 push（`102e8e6e..ca32474b`，去識別化＋金鑰掃描 0 筆）並跑驗收，全部 success：`tests.yml` `44000160722`、`desktop-build.yml` A `44000165503`／B `44000211651`（win／linux／mac 三平台皆打得出來）、`windows-upgrade-acceptance.yml` `44002198241`（情境 1–9 全過）"
  - "✅ T0873 後續 4 張（D298，同一個 checkout 依序派工，全部完成後一次 push＋視需要 `desktop-build.yml`）：✅ T0874 `allowScripts` 拿掉 `sharp`（DONE `f643f0ed`，10:35 收單；守門測試 `win-stdio-inherit.test.mjs` 期望值同步，塔台判定範圍內）→ ✅ T0875 `minimatch`（moderate ×6）**列為已接受的例外、不修**（DONE `83325f9b` docs only，10:45 收單；來源除 `@electron/universal` 外還有 `app-builder-lib` 直接依賴 `minimatch@10`，每個平台打包都用；漏洞路徑需 `optimizationLevel >= 2` 且外部提供 pattern，兩處都用預設 1、pattern 來自本專案設定；改 11 有語意變更；上游 26.18.1／27 alpha 都未修。可行 overrides 已記在回報區，要做須另開單＋三平台 asar 檔案清單比對）→ ✅ T0876 mermaid 12.3.0（DONE `fffae310`，10:57 收單；`layout: 'dagre'`＋`look: 'classic'` 維持 11 外觀，7 種圖渲染比對顏色相同；audit 8 → 6，只剩 T0875 例外）；新依賴 `elkjs`（`EPL-2.0 OR GPL-3.0-or-later`）lazy chunk 1.51 MB → 11:02 使用者選「不打包 ELK」（D299）→ ✅ T0877 `verify-packaged-native` 新增 `foreign-platform-package`（DONE `379f1dec`，11:09 收單；重現 T0873 污染 → exit 1、清除後 exit 0；`build.files` 不收緊；Linux／macOS 包待 `desktop-build.yml` 確認）→ ✅ T0878 elkjs 不打包（DONE `2ba7f45c`，11:22 收單；vite alias → `src/lib/elkjs-stub.ts`、守門測試 `no-elkjs-in-dist.test.mjs`、dist JS −1.48 MB、`app.asar` 無 elkjs、7 種圖與 T0876 相同、`layout: elk` 顯示 mermaid 錯誤圖；`overrides.langium` 已移除；塔台直接補 CLAUDE.md〈Build Toolchain〉一行，讀 CLAUDE.md 的 6 檔測試 106 passed）。使用者指示 push（`ca32474b..e5331349`，去識別化＋金鑰掃描 0 筆）並跑驗收：`tests.yml` `44011007986` success、`desktop-build.yml` `44011012545` 全 success，`verify-packaged-native` win x64／linux x64／mac arm64 皆通過（含 T0877 `foreign-platform-package`）。→ ✅ T0879（D300）ELK 排版改用 dagre＋說明（DONE `7291c38b`，12:08 收單；純函式 `applyMermaidElkFallback`＋28 測試、三語系字串、渲染驗證 ELK 圖與參考圖逐字相同、其他 9 張與 T0878 相同；front matter 頂層 `layout` mermaid 本就不理，依保守原則不改，塔台同意；塔台直接補 CLAUDE.md 半句）；使用者指示 push `e5331349..58720f86`（去識別化＋金鑰掃描 0 筆）"
  - "✅ T0880 DONE 並上線（D301，產品 commit `32231eb3`；15:37 塔台收單：只動 `layout.css`／`figure-zoom.ts`＋`index.ts` 註解、6 檔與 v1.1.5 雜湊一致；Worker 分頁已排程關閉）：BAT 網站 `vitepress-portal-layout` v1.1.2 → v1.1.5（有側欄頁的網站名稱置中、圖片按鈕對齊圖片）；三組 baseline（120／60／90）差異 0、全站通過、`hostIssues` 0；站名 203.7px 不截斷、中心差 0；960 導覽列「…」在視窗外（與 v1.1.2 相同，對方已知狀況）；`pl-layout-check-*` 殘留 76 個已刪。回覆 `_reply-2026-11-17-portal-layout-skill-v115-bat.md` 已改 DONE（回饋 3 項資訊）並通知 `BMad-Guide · Tower`。使用者看線上站名未置中（線上仍是 v1.1.2）→ 指示 push `dfdfddf6..dd907a5f`（去識別化＋金鑰掃描 0 筆）；Pages run `44045970987` build / deploy / link-check 全 success；chrome-live 確認線上 1707 寬站名中心 136 = 格中心（已上線）"
  - "ℹ️ BMad-Guide 告知 `vitepress-portal-layout` v1.1.7（commit `3f8be3e`）：收 T0881 回饋 2 項（行尾全形收尾標點超出 ≤ 0.5em 改列警告；MSYS 路徑說明＋磁碟代號參數 exit 2）；站點檔與 v1.1.5／v1.1.6 相同（塔台雜湊確認 6 檔一致、zip SHA-256 相同），BAT 不必換檔、不必部署。對方以 v1.1.7 量 BAT dist 全站 exit 0，`/releases` 390 只剩 1 則警告。下次網站驗證改用 v1.1.7 腳本"
  - "ℹ️ BMad-Guide 告知 `vitepress-portal-layout` v1.1.6（commit `29b0944`，16:0x）：收 T0880 回饋 3 項；站點檔與 v1.1.5 相同（塔台雜湊確認 6 檔一致、zip SHA-256 與通知相同），BAT 不必換檔、不必部署。v1.1.6 新增兩項失敗檢查，對方唯讀量 BAT dist 預期會報：① 960 寬 15 頁導覽列「…」（`.VPNavBarExtra`）超出視窗 39px（縮短一個選單名稱或減一項即可，例：「與 Control Tower 協作」）；② 390 寬 `/releases`「「Claude Agent V1」改名「Claude Agent」」那行超出主內容欄 5.2px（無水平捲動）。16:22 使用者指示開單 → ✅ T0881 DONE 並上線（D302，產品 commit `74a2bc4c`；16:55 塔台收單，只動 `config.mts` 一行＋`custom.css` 14 行＋`index.ts` 註解；Worker 分頁已排程關閉）：導覽列 `nav`「與 Control Tower 協作」→「Control Tower」＋`custom.css` 只在 960～979.98 把選單項目左右 padding 12 → 11px；960 有捲軸「…」右緣 937.6／無捲軸 940，都在視窗內，項目數與連結不變；三組 baseline（120／60／90）差異 0；`/releases` 390 依 Q-1=C 不改（Chrome 行尾標點擠壓的字框誤判，主要組只剩這 2 項）；skill 回饋 2 項已轉 BMad-Guide。使用者指示 push `dd907a5f..f7269bff`（去識別化＋金鑰掃描 0 筆）；Pages run `44051625599` build / deploy / link-check 全 success；chrome-live 線上 `/cases` 960（版面 945）「…」右緣 937.6、超出 0（已上線）"
  - "ℹ️ BMad-Guide 告知 `vitepress-portal-layout` v1.1.3（commit `348884f`）：站點檔與 v1.1.2 逐位元組相同，BAT 不必改、不必部署；只改 `layout-check.mjs` 與文件（收 T0872 回饋 3 項）。下次網站驗證改用 v1.1.3 的 `layout-check.mjs`；用 v1.1.2 存的 baseline 比對時，`<figure>` 包 `<img>` 的頁應有按鈕數會少 1 → 重存 baseline 或加 `--baseline-warn`"
  - "✅ T0872 DONE 並上線（D296，產品 commit `ff8841f1`；使用者指示 push `f045d057..102e8e6e`，push 前去識別化＋金鑰掃描 0 筆；Pages run `43993612220` build / deploy / link-check 全 success、lychee Errors 0；09:09 塔台收單：只動 `figure-zoom.ts`＋`index.ts` 註解、6 檔與 v1.1.2 雜湊一致；Worker 分頁已排程關閉）：baseline 比對展開／收合各 120 組差異 0、全站通過、`hostIssues` 0、`missing` 0；開啟倍率除了預期的 `QuestionFlow` 390（100% → 99.2%），另有 1920 寬 11 張截圖 65.7% → 65.3%（v1.1.2 文件化行為，塔台判定可接受）；回覆 `_reply-2026-11-17-portal-layout-skill-v112-bat.md` 已改 DONE（回饋 3 項資訊）並通知 `BMad-Guide · Tower`；對方 D768 已收單、同意 1920 截圖判定，回饋併入下次改版，屆時再通知"
  - "✅ T0871 DONE 並上線（D295，產品 commit `5a7e2478`；使用者指示 push `e668ac12..f045d057`，push 前去識別化＋金鑰掃描 0 筆；Pages run `43978301961` build / deploy / link-check 全 success、lychee Errors 0；網站 `/control-tower` 已含 `data-pl-zoom-reserve`；BMad-Guide D762 已收單，3 項回饋延到 skill v1.1.2，屆時對方再通知升級；07:18 塔台收單：9 檔皆在 `site/.vitepress/theme/`、6 檔與 skill v1.1.1 雜湊一致、Timeline 未複製；Worker 分頁已排程關閉）：BAT 網站 `vitepress-portal-layout` v1.0.0 → v1.1.1，全站 15 頁 layout-check 全通過、`hostIssues` 0、按鈕 14 → 15（`QuestionFlow`）、120 組版面量測與升級前相同；回覆 `_reply-2026-11-17-portal-layout-skill-v111-bat.md` 已改 DONE（skill 回饋 1＋2 項資訊）並通知 `BMad-Guide · Tower`。使用者看線上站名未置中（線上仍是 v1.1.2）→ 指示 push `dfdfddf6..dd907a5f`（去識別化＋金鑰掃描 0 筆）；Pages run `44045970987` build / deploy / link-check 全 success；chrome-live 確認線上 1707 寬站名中心 136 = 格中心（已上線）"
  - "✅ T0870 DONE 並上線（`338a8f78`；20:27 使用者指示 push `80d6b90f..e668ac12`，push 前去識別化＋金鑰掃描 0 筆；Pages run `43866827100` build / deploy / link-check 全 success、lychee Errors 0；網站 `/control-tower` 已含 `pl-layout`）：BAT 網站套用 `vitepress-portal-layout` v1.0.0 前三項；BMad-Guide D751：skill 已出 v1.1.0（對方 T0502，含 BAT 回饋 4＋1 項、HTML 圖放大），但套到 CT／MMP 時又發現 6 項缺陷（`data-pl-zoom` 在 `<ol>`／`<ul>` 上時按鈕插成最後一個子元素、站點宿主 `padding: 0` 蓋掉按鈕保留空間），對方 D756 改修成 **v1.1.1**（對方 T0505）→ **不升 v1.1.0**，BAT 目前的 v1.0.0 不受影響；收到 v1.1.1 升級通知後開單從 v1.0.0 直接升 v1.1.1：整包覆蓋 `site/.vitepress/theme/portal-layout/`、移除 `custom.css` 底部把首頁導覽列／頁尾還原成 1440px 的那段、重跑 layout-check（可用 `--figure-test all`、整頁截圖）"
  - "✅ `0.7.5-pre.1` 發佈後驗收全 PASS（第一百二十四 session）：NSIS 重裝（11:31 `bat-nsis-acceptance-20261105-113131`，備份已刪）、linux-acceptance `41962694457`（22.04 / 24.04 各 4 passed）、macos-acceptance `41962698832`、docker-acceptance `41962703643`（pre.9 → pre.1）、WSL smoke `wsl:Ubuntu-24.04` 14/14（server `0.7.5-pre.1`，含 T0832 S14）"
  - "🚀 `v0.7.5-pre.2` 已發佈（2026-11-17 13:13，使用者指示「push, 發版」；Pre-Release run `44020596683` 全 success、4 個安裝檔＋`server-bundle-v0.7.5-pre.2`；更版重點已寫；CHANGELOG / release-note / package.json 同步 `1e4b0c8d`，README 無需更新；Pages `44022793648` 全 success、lychee 0、首頁版號 pre.2）。發佈後驗收（13:2x–13:37）：✅ 使用者實機 `.exe` 從 pre.1 更新到 pre.2 **終端保留並接回**（PLAN-065 真實升級首驗 PASS）、✅ 新版通知（BUG-212）；✅ linux-acceptance `44023853174`（22.04 / 24.04）、macos-acceptance `44023858121`、docker-acceptance `44023862820`（pre.1 → pre.2）全 success；✅ WSL smoke `wsl:Ubuntu-24.04` 14/14（WSL server 仍是 `0.7.5-pre.1`）；✅ e2e `t0836`（真 SSH / Docker）3 passed。✅ NSIS 重裝驗收 PASS（2026-11-20 16:11–16:13 real，`bat-nsis-acceptance-20261120-161155`，AllUsers；⓪–④ 全 PASS、⑤ 未帶 `-LaunchCheck` 略過；③ debug log 新增 1／輪替 1 屬預期；④ 與 ③ 快照 0 差異；PTY holder 目錄裝上／解除時移除皆正確；含權杖 `userdata-backup` 已於 16:33 刪除）"
  - "PLAN-065 剩餘：per-machine 未提權互動升級（UAC）手動驗收（無法自動化）；降級到 `0.7.4-pre.9` 會結束所有終端且沒有說明（已寫在更版重點〈已知事項〉）"
  - "✅ BUG-211 / 212 / 213 CLOSED（2026-11-17 13:25，交付版 `v0.7.5-pre.2`）：BUG-212 使用者實機收到新版通知；BUG-213 W6 `44002198241` 情境 1 pipe 啟動 PASS；BUG-211 e2e `t0836` ①(d) PASS。`_bug-tracker.md` FIXED 0 / CLOSED 76，parser 測試 65 passed"
  - "PLAN-052（IN_PROGRESS）：待 Docker Desktop（Windows / macOS）實機走精靈；後續候選（未開單）：fetch-fingerprint Docker 分支比對憑證指紋、`scripts/docker-acceptance.mjs` 純函式單元測試"
  - "PLAN-058：T0819 安裝版 pre.5 假 API e2e PASS，待使用者手動確認（清單在 T0819 回報區）；可選後續：卡片等待時讓輸入框可送出（T0815〈遭遇問題〉1，未開單）"
  - "待實機驗收：T0827 Linux AppImage 缺字型提示（回報區〈待實機驗收〉4 項）；T0830 真 WSL 的 install-bundle 中止與 keep-alive 關閉後閒置關機；PLAN-038 實機 6 項（T0836 回報區〈待實機驗收〉）；T0840 精靈在真的 BAT 視窗對拋棄式發行版從頭跑一次；T0841「改用 Mirrored 並重試」實機"
  - "候選（未開單，D303 暫不安排）：T0830 後續 SSH / Docker 精靈長呼叫接 operation id；PLAN-052 fetch-fingerprint Docker 分支、docker-acceptance 純函式測試；PLAN-058 卡片等待時可送出（2026-11-20 使用者：先記著、不開單。只涉 Claude Agent 面板（SDK），不影響 Claude CLI 分頁；要做時的建議：輸入框預設收合＋「補充說明」按鈕展開、輸入框有焦點時停用卡片快捷鍵（權限卡在 window 監聽 1/2/3、y/n、Enter、方向鍵）、送出走 T0815 排隊路徑；需實機操作確認）"
  - "MSRC 回報 microsoft/node-pty（使用者自行處理，D255）"
  - "觀察：語音可用性檢查 macOS 未實機（`unknown(timeout)` 出現可把逾時提到 30 s，T0802）；t0757 偶發失敗再發生才開 BUG（D218）；PLAN-060（IDEA）macOS Developer ID 簽章"
  - "版號線：D285 起 `0.7.5-pre.N`，pre.2 已發佈（2026-11-17），下一版 `0.7.5-pre.3`（`-pre.N` 最多到 pre.9）"
---
# Tower State — better-agent-terminal

> 🟢 **第一百二十七 session 開工**（2026-11-23 15:07 (UTC+8)，CT v6.0.0，Fast Path（環境快照 7 天內）；塔台 session `f36f7d59-56b4-4906-9f06-8b1c6ef468a1`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；helper `v0.7.5-pre.2`；HEAD `1dcb6360`，fetch 後領先 `origin/main` 1（第一百二十六 session 收工 commit）/ 落後 0、工作區乾淨；熱區 280 張工單全 DONE；`bat_list_questions` pending 0；熱檔皆在 400 KB 預算內；上次收工後 BUG / PLAN 檔無變動，索引不需重建）。

> 🛏 **第一百二十六 session 收工**（2026-11-20 17:48 (UTC+8)）。

> 🟢 **第一百二十六 session 開工**（2026-11-20 16:32 (UTC+8)，CT v6.0.0，Fast Path（環境快照 4 天）；塔台 session `a0bddf3a-fc9c-4c02-a740-d4ff15d8f83f`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；helper `v0.7.5-pre.2`（安裝版已是 pre.2）；HEAD `bd42106e`，fetch 後領先 `origin/main` 3 個塔台紀錄 commit / 落後 0、工作區乾淨；熱區 277 張工單全 DONE；`bat_list_questions` pending 0；熱檔皆在 400 KB 預算內；上次收工後 BUG / PLAN 檔無變動，索引不需重建）。

> 最後更新:2026-11-20 17:48 (UTC+8) — **第一百二十六 session 收工**：`0.7.5-pre.2` NSIS 重裝驗收 PASS；D303 候選後續開單 3 張全部 DONE 並 push（T0882 e2e 不連 GitHub 檢查新版＋protocol v1 測試、T0883 `wslKeepAlive` 型別＋遠端文件、T0884 遠端 fork 待送圖片預算檢查），`tests.yml` `44708888774` success；`origin/main` 在 `f4b7aa81`，本地另有本收工 commit 未 push。
>
> **下次起手**:熱區工單全 DONE、無派工中工單。① PLAN-065 per-machine UAC 互動升級手動驗收；② PLAN-052 Docker Desktop 實機精靈、PLAN-058 使用者手動確認；③ 本收工 commit 待下次 push；④ 暫不安排的候選見 frontmatter `todo`。

---

## 🛏 本 Session 收工快照 (第一百二十六 session, 2026-11-20 16:32 - 2026-11-20 17:48)

### 主軸：NSIS 驗收收尾、候選後續批次（D303）

#### 重點（時間取自系統 / git；詳見 frontmatter `todo` 與各工單）

1. **`0.7.5-pre.2` NSIS 重裝驗收 PASS**（使用者 16:11 已跑；塔台判讀 ⓪–④ PASS、⑤ 略過，含權杖備份 16:33 刪除）
2. **D303**：使用者限定「只開可自動化測試的」→ T0882（`launchIsolated` 預寫 settings 關閉檢查新版、legacy runtime 目錄不寫；protocol v1 B 組改事件等待）、T0883（`ProfileEntry.wslKeepAlive`、精靈步驟中止與 `ws-limits` 文件、CLAUDE.md PLAN-039 節 +2 行）、T0884（`planForkPendingSend`：遠端 fork 待送圖片超過預算 → 不送、提示、放回），三張依序派工全 DONE；push 後 `tests.yml` Linux 全綠
3. PLAN-058「卡片等待時可送出」說明後使用者決定先記著不開單（只涉 Claude Agent 面板）
4. 每次 push 前跑 `.private/` 檢查樣式＋金鑰樣式皆 0 筆（3 次）

### 本輪戰績
- 工單 3（T0882–T0884，全 DONE）；決策 D303；BUG 0；發版 0
- 結構化提問 0；`worker_auto_close` 3；`--wait-started` 3 次皆 `started:`
- 驗證基線（T0884 @ `cf0b0809`）：unit 8414 passed / 461 files、typecheck 0 / 0、vite build；CI `tests.yml` 462 files、legacy 472 / 33

### 編號起始（下 session）
- **T0885** / **BUG-214** / **PLAN-066** / **D304** / **L186** / **CT-T023**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-11-20 17:48 UTC+8（第一百二十六 session 收工）

### 近期完成
- **D303 候選後續 3 張**（第一百二十六 session）：T0882 e2e 不連 GitHub 檢查新版、T0883 `wslKeepAlive` 型別＋遠端文件、T0884 遠端 fork 待送圖片預算檢查；`0.7.5-pre.2` NSIS 重裝驗收 PASS
- **`v0.7.5-pre.2` 發佈＋驗收**（第一百二十五 session）：npm audit 修補、mermaid 12（elkjs 不打包）、打包檢查擋別平台套件；PLAN-065 真實升級首驗 PASS；BUG-211 / 212 / 213 CLOSED
- **BAT 網站 portal-layout v1.1.5**＋960 導覽列修正（T0870–T0872、T0880、T0881，已上線）

### 待辦（依優先序；完整內容見 frontmatter `todo`）
1. PLAN-065 per-machine UAC 互動升級手動驗收
2. push 本收工 commit
3. PLAN-052：Docker Desktop 實機走精靈；PLAN-058：使用者手動確認（T0819 回報區）
4. 暫不安排的候選（D303）：SSH / Docker 精靈長呼叫接 operation id、Docker fingerprint、docker-acceptance 單元測試、卡片等待時可送出（先記著）、fork 相關 debug log 記 prompt 全文（觀察）
5. MSRC（使用者自行處理，D255）；觀察項（語音 macOS、t0757）；PLAN-060 IDEA

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式
- 改 `_bug-tracker.md` / `_backlog.md` 不用全檔 `sed`，改完跑 parser 測試（L179）
- 網站驗證用最新 portal-layout `layout-check.mjs`（目前 v1.1.7）；網站改動 push 才會上線，使用者看線上站時先確認是否已部署

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 0 / Fixing 0 / Fixed 0 / Closed 76 / WONTFIX 1）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D303）｜ Learnings → [_learnings.md](_learnings.md)（最大 L185）
- 研究報告 Artifact「Herdr 對照 BAT」→ https://claude.ai/artifact/Ybj66gYLkMHZE8xUyyDiEy（私人）
- 網站 → https://gowerlin.github.io/better-agent-terminal/｜ 素材 spec → `e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1`，輸出 `e2e-media/`）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（145 entries；最新 `2026-Q4-c.md`）

### 編號起始
- **T0885** / **BUG-214** / **PLAN-066** / **D304** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L186** / **CT-T023**

---


## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.5-pre.2**（package.json + lock）；下一版 **`0.7.5-pre.3`**（D285 `0.7.5-pre.N` 線） |
| **最新 release** | `v0.7.5-pre.2`（2026-11-17T05:13:40Z，run `44020596683`，target `8159cfbb`）；前一 tag `v0.7.5-pre.1`；更早見 `release-note.md` / `CHANGELOG.md` |
| **目前主軸** | `0.7.5-pre.2` 發佈後驗收全 PASS（含 NSIS 重裝）；PLAN-065 剩 per-machine UAC 手動驗收；無派工中工單 |
| **工單最大編號** | **T0884** DONE（第一百二十六 session）；熱區 280 張全 DONE |
| **BUG 最大編號** | **BUG-213** CLOSED；熱區 Open 0 / Fixing 0 / Fixed 0 / Closed 76 / WONTFIX 1 |
| **PLAN 最大編號** | **PLAN-065** IN_PROGRESS；IN_PROGRESS 6（038 / 043 / 052 / 058 / 064 / 065）；IDEA 3 |
| **決策最大編號** | **D303**（候選後續可自動化測試的 3 張開單，第一百二十六 session） |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v6.0.0**（第一百二十五 session 起） |
| **unit test 基線** | **8414 passed / 461 files**（T0884 Worker 回報 @ `cf0b0809`）；typecheck 0 / 0、legacy 472 |
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
> 最後掃描:2026-11-16 19:14 (UTC+8) 第一百二十五 session **Full Scan**（前次 2026-11-01 01:24 第九十九 session，已 15 天）

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`, terminal `508fced6…`；無 `BAT_TOWER_TERMINAL_ID` |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（PowerShell 只列名稱確認）；另有 `BAT_USER_DATA` |
| BAT 安裝版 | ✅ `0.7.5-pre.1` | exe FileVersion `0.7.5-pre.1`；`bat-terminal.mjs --version` → `v0.7.5-pre.1`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower` |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ | `%APPDATA%\BetterAgentTerminal\Logs\debug-20261116-182951.log`（最新） |
| 平台 | Windows 11 | PowerShell 主，Bash tool 並存；node `v26.13.1` / npm `12.2.2` |
| node_modules | ⚠️ 不完整 | 主 checkout 只剩 26 個套件（2026-11-06 變動）；vite / vitest / react 不在 → 本機測試 / build 前需 `npm ci` |
| gh CLI | ✅ | **必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `main` = `origin/main` @ `80d6b90f`（fetch 後 0 / 0）；另有 worktree `../.ct-integration/better-agent-terminal`（detached `83597e8e`，2026-11-04）；無 stash |
| 最新 CI / release | ✅ | Pre-Release 2026-11-05 02:42Z success → `v0.7.5-pre.1`；Pages 03:00Z success；linux / macos / docker acceptance 03:36Z success |
| GitHub open issues | 0 | |
| Control Tower skills | ✅ v6.0.0 | 正式版（前次 session 為 v6.0.0-rc.1） |
| 熱區單據 | **T:265 / BUG:77 / PLAN:30 / EXP:1** | BUG：FIXED 3 / CLOSED 73 / WONTFIX 1（與 `_bug-tracker.md` 一致）；PLAN：IN_PROGRESS 6 / IDEA 3 / DONE 19 / DROPPED 2 |
| 非終態工單 | 無 | |
| 最大編號 | **T0869 / BUG-213 / PLAN-065 / D293 / L185 / CT-T022** | 下張：T0870 / BUG-214 / PLAN-066 / D294 / L186 / CT-T023 |
| unit test / typecheck | 未重跑 | 最近：8355 passed / 456 files、typecheck 0 / 0（T0869 @ `6269139c`） |
| 檔案大小 | ✅ 皆 < 400 KB | `_tower-state.md` 24,932；`_decision-log.md` 357,676（接近 400 KB 預算）；`_learnings.md` 224,244；`_bug-tracker.md` 31,410；`_backlog.md` 10,920 |
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
