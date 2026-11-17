---
schema_version: 1
schema_kind: workorder
id: T0881
title: "BAT 網站：960 寬導覽列超出視窗、390 寬 /releases 一行超出主內容欄（portal-layout v1.1.6 新檢查）"
type: implementation
status: DONE
created_at: "2026-11-17T16:22:37+0800"
started_at: "2026-11-17T16:23:41+0800"
updated_at: "2026-11-17T16:55:30+0800"
completed_at: "2026-11-17T16:55:30+0800"
session_ids:
  - "aa55acb4-323f-4836-8af5-65045d72fd9b"
repo: better-agent-terminal
project: PLAN-049
priority: P3
sizing: S
depends_on: [T0880]
related:
  - "D302；BMad-Guide 塔台 16:0x 告知 `vitepress-portal-layout` v1.1.6（commit `29b0944`，新增「導覽列超出視窗」「內文超出主內容欄」兩項失敗檢查）；T0880 回報區〈驗證〉5（960 導覽列實測）"
affects_files:
  - _ct-workorders/T0881-site-fix-nav-and-content-overflow.md
  - site/.vitepress/config.mts
  - site/.vitepress/theme/custom.css
  - site/.vitepress/theme/index.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 範圍只有 `site/.vitepress/config.mts`（導覽列 `nav` 的文字）、`site/.vitepress/theme/custom.css`、`site/.vitepress/theme/index.ts`（註解版號）與本工單回報區。`portal-layout/` 不改（skill 檔保持原樣）；`release-note.md`、`site/*.md` 內容不改（更版紀錄是歷史紀錄）；側欄 `sidebar` 的文字與頁面標題不改。非改不可就停下來問塔台。不改產品（`electron/**`、`src/**`、`scripts/**`）、不改 workflow。"
  - "🔴 不得隱藏導覽列項目或改連結；不得用全站 `overflow-x: hidden` 之類把超出藏起來。"
  - "🔴 skill 在 BMad-Guide repo，**唯讀**：只執行 `layout-check.mjs`，不寫入 `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\` 底下任何檔案。skill 缺陷記在回報區〈skill 回饋〉。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push（push 到 main 會觸發 Pages 部署）、不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
  - "ℹ️ 只需 `site/` 自己的 `node_modules`（缺就在 `site/` 內 `npm ci`）；不要在 repo 根目錄跑 `npm ci`。全站 layout-check 用背景執行。收尾刪除 `%TEMP%` 的 `pl-layout-check-*` 殘留。"
---

# T0881 — BAT 網站：960 寬導覽列超出視窗、390 寬 /releases 一行超出主內容欄

## 元資料
- **工單編號**：T0881｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-17 16:22 (UTC+8)
- **規模**：S｜**依賴**：T0880（DONE，已上線）｜**決策**：D302｜**來源**：portal-layout v1.1.6 新檢查（BMad-Guide 告知）

## 背景
`vitepress-portal-layout` v1.1.6 的站點檔與 v1.1.5 相同（塔台已以雜湊確認 BAT 站 6 檔一致，不必換檔），但 `layout-check.mjs` 新增兩項失敗檢查。BMad-Guide 唯讀量 BAT dist 預期會報：
1. **導覽列超出視窗**：960 寬時 15 頁導覽列「extra navigation」（`.VPNavBarExtra`，「…」）超出視窗 39px。T0880 實測（有垂直捲軸、版面寬 945）：「參考」選單右端約 9px 超出，「…」953.8～997.8 完全在視窗外；線上 v1.1.2 數字相同。
2. **內文超出主內容欄**：390 寬 `/releases` 的「「Claude Agent V1」改名「Claude Agent」」那行（`release-note.md` 第 915 行附近的粗體）超出主內容欄 5.2px，沒有造成水平捲動。

## 必讀（唯讀，`BG` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide`）
1. `BG\Portal-Layout-Skill\vitepress-portal-layout-v1.1.6\SKILL.md`〈v1.1.5 → v1.1.6〉、`references\apply-guide.md` § 16（兩項新檢查的判定方式與建議修法）
2. 驗證腳本 `BG\Portal-Layout-Skill\vitepress-portal-layout-v1.1.6\scripts\layout-check.mjs`
3. T0880 回報區（`_ct-workorders/T0880-site-upgrade-portal-layout-v115.md`）：layout-check 參數（`--base /better-agent-terminal/`、`--allow-origins https://fonts.googleapis.com,https://fonts.gstatic.com`）、三組寬度、960 導覽列實測數字

## 任務
1. **升級前 baseline**：目前建置複製到 scratchpad，用 v1.1.6 腳本存三組 baseline（同 T0880：主要 2560／1920／1366／390、收合 2560／1920、窄寬 1439／1280／960，深淺色）。記下失敗清單（預期只有上述兩類；其他項目先查原因）。
2. **導覽列**（塔台定修法，依序，前一步足夠就停）：
   - ① 把導覽列 `nav` 的「與 Control Tower 協作」改成「Control Tower」（`config.mts` 第 98 行；側欄第 136 行與下拉選單項目不改）。
   - ② ① 仍不夠（包含 960 寬有垂直捲軸的情況，視窗寬 945～960）：在 `custom.css` 以只作用於 `min-width: 960px` 且 `max-width` 剛好需要的範圍，縮小導覽列項目左右間距；寫明作用寬度與原因。
   - 驗收看「導覽列超出視窗」0，並在 960 寬、有捲軸與無捲軸各量一次「參考」與「…」的右緣（附數字）。
3. **/releases 超出**：先查原因（哪個元素、為何不能斷行，例如全形引號與英數字之間沒有斷行機會），再以 `custom.css` 最小範圍修正（限定在 `.vp-doc` 內、只影響本來會超出的情況，例：`overflow-wrap: anywhere` 只套在必要的選擇器）。不改 `release-note.md`。寫明選擇器影響範圍。
4. **升級後比對**：`cd site && npm run build`，三組同參數加 `--baseline`（主要組帶 `--layout-test --figure-test all`、窄寬組帶 `--layout-test`、收合組不帶 `--layout-test`）。baseline 差異只允許出現在任務 2、3 直接造成的地方（逐筆列出並說明）；其他差異 0。
5. `index.ts` 註解版號 `v1.1.5` → `v1.1.6`（站點檔不變，註明只升驗證腳本）。

## 驗收條件
- [ ] `cd site && npm run build` 成功，無新增警告
- [ ] 三組 v1.1.6 layout-check exit 0：「導覽列超出視窗」0、「內文超出主內容欄」0、`hostIssues` 0、`missing` 0、名稱置中問題 0
- [ ] baseline 差異只在任務 2、3 直接造成的地方，逐筆說明；其他 0
- [ ] 960 寬有捲軸（945）與無捲軸（960）導覽列最右項目都在視窗內（附數字）；導覽列項目數與連結不變
- [ ] `portal-layout/`、`release-note.md`、`site/*.md`、側欄文字未改
- [ ] commit 只含本單範圍，不 push

## 收尾
- 回報後塔台請使用者決定 push（會觸發 Pages 部署）；push 後以 chrome-live 在 960 寬確認導覽列。
- 若有〈skill 回饋〉，塔台轉給 BMad-Guide 塔台。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策

#### Q-1：/releases 390 寬的「超出」是 Chrome 行尾標點擠壓造成的量測值，墨跡在欄內；要用哪種修法？
- **提問時間**：2026-11-17T16:30:27+0800
- **查到的原因**（chrome-live，390 寬、無捲軸、欄右緣 366）：那個 `<strong>` 在**同一行**內，`text-spacing-trim` 是預設 `normal`（含 allow-end：行尾的全形收尾標點放不下時，以半寬算來決定換行）。Chrome 用半寬判定「」」放得下，但字框仍是全寬 16px（355～371.2），所以量到 371.2 − 366 = 5.2px。截圖確認「」」的墨跡在左半（≤ 363），**實際沒有壓到欄外**。斷行機會是有的（Agent 前的空白），`overflow-wrap: anywhere` 改不了結果（換行器認為放得下）。
- **選項**：
  - A. `custom.css` 加 `.vp-doc li > strong:first-child { text-spacing-trim: space-all; }`：這行「Agent」」改到第二行，檢查 0。代價：關掉這類粗體引言裡相鄰標點的擠壓，`/releases` 其他 5～6 個粗體引言字距變寬（每個寬度都有，例「Claude 面板排隊（所有平台）」）；960 寬有 1 個清單項目多 1 行（會出現在窄寬組 baseline 的 `/releases` 960 頁高差異）；其他 13 頁 390／960／1366／1920／2560 都不變。
  - B. 範圍更廣的 `.vp-doc li` 或 `.vp-doc` 設 `space-all`：390 `/releases` 頁高 +560／+2800px、其他頁也變，不建議。
  - C. 不改 CSS，記為 layout-check 誤判（量字框、沒扣掉行尾擠壓的半格），寫進〈skill 回饋〉：主要組 390 `/releases` 深淺各 1 項「內文超出主內容欄」，主要組 exit 1；驗收該項改為「已知、塔台接受」。
  - 其他。
- **建議**：C（站點實際沒有超出；A 會改到 6 個本來正常的粗體引言與 960 頁高，不符合「只影響本來會超出的情況」）。若塔台要 layout-check 全綠，選 A。
- **影響**：只影響任務 3 與主要組 layout-check 的結果；導覽列（任務 2）照常進行。
- **是否阻擋後續**：阻擋任務 3 與最後的 baseline 比對；任務 1、2、5 先做。
- **通道**：BAT（`q-6cc9b1d8-…`），16:31 答覆 choice 3（C），全文記在〈互動紀錄〉。

### 完成狀態
- **DONE**（2026-11-17 16:55 +0800）：導覽列修好（960 有捲軸／無捲軸都不超出）；/releases 依 Q-1=C 不改 CSS，記為 layout-check 誤判（〈skill 回饋〉）。三組 baseline 差異 0。
- 產品 commit：`74a2bc4c`（`fix(site): keep 960 navbar items inside the viewport (T0881)`）；工單 commit 另計。未 push。
- **session_id**：aa55acb4-323f-4836-8af5-65045d72fd9b

### 落點檢查
- **PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。C-1：工單在 REPO_ROOT 下 → PASS。C-3：`site/.vitepress/config.mts` 等 3 檔都存在 → PASS。C-2：無 `branch` 欄位，目前 `main`。
- 未設 `CT_HOME`（非 worktree）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_REMOTE_TOKEN` 已設定；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 變更內容
| 檔案 | 變更 |
|---|---|
| `site/.vitepress/config.mts` | 導覽列 `nav` 第 98 行「與 Control Tower 協作」→「Control Tower」。側欄（第 136 行）、下拉選單項目、連結都沒改 |
| `site/.vitepress/theme/custom.css` | 新增一段（「首頁共用」之前）：`@media (min-width: 960px) and (max-width: 979.98px)` 內 `.VPNavBar .VPNavBarMenu .VPNavBarMenuLink`、`.VPNavBar .VPNavBarMenu .VPFlyout .button` 左右 padding 12 → 11px。註解寫明原因、作用寬度與數字。「…」按鈕、搜尋框、外觀切換不動 |
| `site/.vitepress/theme/index.ts` | 註解版號 v1.1.5 → v1.1.6，註明站點檔與 v1.1.5 相同、只升驗證腳本 |

- 導覽列修法：① 改名後 960 有捲軸（版面 945）「…」右緣 949.5，仍超出 4.5px → 做 ②。② 六個選單項目各省 2px（共 12px）。作用寬度 960～979.98：選單右緣固定在 x 949.5（960～1279 選單從側欄 272px 之後才排），視窗寬 − 捲軸寬 < 949.5 才會超出；15px 捲軸時是視窗 ≤ 964，上限取 979.98 留到 30px 捲軸。980 以上（有捲軸版面 965）不作用，維持預設 12px（chrome-live 實測 980：padding 12px、「…」905.6～949.6，在 965 內）。
- `portal-layout/`、`release-note.md`、`site/*.md`、側欄文字：`git status` 無變更。

### 驗證
共同參數：`--base /better-agent-terminal/`、`--allow-origins https://fonts.googleapis.com,https://fonts.gstatic.com`；腳本 = skill v1.1.6 `scripts/layout-check.mjs`（唯讀執行）；`--dist` 為 scratchpad 複本（`dist-pre` = 改前以 HEAD `629dcdad` 的站點建置、`dist-post` = 改後建置）；全部背景執行。Git Bash 執行時設 `MSYS_NO_PATHCONV=1`（否則 `--base /better-agent-terminal/` 會被改寫成 Windows 路徑）。

1. **建置**：改前、改後 `cd site && npm run build` 都 exit 0，log 無 warn。
2. **改前 baseline（v1.1.6 腳本，`dist-pre`）**：
   | 組 | 參數 | baseline | 失敗 |
   |---|---|---|---|
   | 主要 | `--widths 2560,1920,1366,390 --schemes dark,light` | `before.json` 120 組 | 2 項：390 深／淺 `/releases.html` 內文超出主內容欄 5.2px（Q-1） |
   | 收合 | `--widths 2560,1920 --schemes dark,light --collapse all` | `before-collapse.json` 60 組 | 0 |
   | 窄寬 | `--widths 1439,1280,960 --schemes dark,light` | `before-narrow.json` 90 組 | 30 項：960 深／淺 15 頁全部「導覽列超出視窗」，「extra navigation」文件頁 x 955.2～999.2、首頁 `/` x 918.9～962.9 |
   - 失敗只有工單預期的兩類；名稱置中、hostIssues、missing、載入錯誤都是 0。
3. **改後比對（`dist-post`）**：
   | 組 | 參數 | 結果 |
   |---|---|---|
   | 主要 | 同上＋`--layout-test --figure-test all --baseline before.json` | exit 1，只有 Q-1=C 的 2 項（390 深／淺 `/releases.html`，與改前同一元素、同 5.2px）；其他 6 組全過；導覽列超出 0、hostIssues 0、缺按鈕 0、名稱置中 0；**baseline 120 組差異 0**（`onlyInBaseline` 0、`onlyInThisRun` 0、`changedParams` 無、`unstableHeights` 無） |
   | 收合 | 同上＋`--collapse all --baseline before-collapse.json` | exit 0，全部通過 4 組 × 15 頁；**baseline 60 組差異 0** |
   | 窄寬 | 同上＋`--layout-test --baseline before-narrow.json` | exit 0，全部通過 6 組 × 15 頁；960 每頁 `navOverflow.items` 空；**baseline 90 組差異 0** |
   - baseline 差異 0：導覽列是 `position: fixed`、不影響頁高與主內容寬；/releases 沒改，所以「任務 2、3 直接造成的差異」也是 0。
4. **960 導覽列實測（chrome-live，本機 `vitepress preview`，`/cases`，viewport 960×900；無捲軸用 `html { overflow-y: hidden }` 暫時拿掉捲軸）**：
   | 狀態 | 版面寬 | 「參考」 | 「…」（extra navigation） | 超出 |
   |---|---|---|---|---|
   | 改前，有捲軸 | 945 | 883.8～953.8 | 953.8～997.8 | 2 項 |
   | 改前，無捲軸 | 960 | 883.8～953.8 | 953.8～997.8 | 1 項 |
   | 只做 ①，有捲軸 | 945 | 835.5～905.5 | 905.5～949.5 | 1 項 |
   | 只做 ①，無捲軸 | 960 | 835.5～905.5 | 905.5～949.5 | 0 |
   | **改後（①＋②），有捲軸** | 945 | 825.6～893.6 | **893.6～937.6** | **0** |
   | **改後（①＋②），無捲軸** | 960 | 828～896 | **896～940** | **0** |
   - 導覽列項目數不變（安裝／功能／遠端開發／Control Tower／實戰案例／參考＋「…」）；選單 12 個連結 href 與改前相同（chrome-live 列出）。
   - 首頁 `/` 的 960 無捲軸由 layout-check 驗證 0 超出；首頁選單比文件頁靠左約 36px（改前右緣 962.9 vs 999.2），有捲軸時同樣放得下（推算，未另量）。
   - 截圖：`nav-960-post.png`（有捲軸，「…」在視窗內）。
5. **/releases 390（Q-1 的量測）**：chrome-live 390 無捲軸，欄右緣 366；`<strong>`「「Claude Agent V1」改名「Claude Agent」」在同一行 x 44～371.2；`text-spacing-trim: normal`、`overflow-wrap: break-word`、`white-space: normal`。逐字量：最後的「」」字框 355～371.2（16px 全寬），下一段「（T0722）」換到下一行。改成 `space-all` 時「Agent」」換到第二行（44～305.9）、`trim-start` 時 363.2 → 判定是 allow-end（行尾全形收尾標點放不下時以半寬判定）造成：換行器以半寬判定放得下，但字框仍是全寬。截圖 `releases-390-pre.png`（紅框為該 li）：「」」墨跡在框內。各修法影響（14 頁 × 390／960／1366／1920／2560 量 `.vp-doc` 高）：`.vp-doc` 全面 `space-all` 390 `/releases` +2800px、其他頁也變；`.vp-doc li` +560px；`.vp-doc li > strong:first-child` 頁高不變但 `/releases` 另 5～6 個粗體引言字距變、960 一項多 1 行 → 依塔台 Q-1=C 不改。
6. **收尾**：`%TEMP%` 下 `pl-layout-check-*` 執行後 0 個（v1.1.6 自己清乾淨；先前累積的已在 T0880 刪除）。本機 preview（port 4191、4192）已停止；chrome-live 隔離分頁已改為 `about:blank`。
7. 量測檔與截圖在 `<使用者資料夾>\AppData\Local\Temp\claude\…\scratchpad\t0881\`：`before*.json`、`pre-*.json/.err`、`post-*.json/.err`、`nav-measure.js`、`nav-960-post.png`、`releases-390-pre.png`、`build-*.log`；未 commit。

### 驗收條件
- [x] `cd site && npm run build` 成功，無新增警告
- [x] 三組 v1.1.6 layout-check：「導覽列超出視窗」0、`hostIssues` 0、`missing` 0、名稱置中問題 0；「內文超出主內容欄」只剩 390 `/releases` 深淺各 1 項（已知誤判，塔台接受 Q-1=C）；主要組 exit 1 只有這 2 項，收合組、窄寬組 exit 0
- [x] baseline 差異 0（120／60／90 組）；任務 2 不影響頁高與主內容寬，任務 3 未改 CSS
- [x] 960 有捲軸（945）「…」右緣 937.6、無捲軸（960）右緣 940，都在視窗內；項目數與連結不變
- [x] `portal-layout/`、`release-note.md`、`site/*.md`、側欄文字未改
- [x] commit 只含本單範圍（`74a2bc4c` 3 檔＋工單），不 push

### skill 回饋
1. **「內文超出主內容欄」對行尾全形收尾標點誤判**（給 BMad-Guide，`layout-check.mjs` v1.1.6）：
   - 現象：BAT `/releases` 390 寬，`<strong>`「「Claude Agent V1」改名「Claude Agent」」報超出 5.2px，但墨跡在欄內、沒有水平捲動。
   - 原因：Chrome 的 `text-spacing-trim: normal`（預設）含 allow-end：行尾的全形收尾標點（」』）））放不下時，換行器以半寬判定放得下，但元素的字框（`getBoundingClientRect`／`getClientRects`）仍以全寬（1em）計算，右緣多出約半格（16px 字為 8px）。中文站行尾剛好落在收尾標點時很常見，與站點寫法無關。
   - 建議：判定前扣掉這種情況，例如元素（或其最後一個 text node 的最後一個字）是全形收尾標點、且它是該行最後一個字時，容許半格（0.5em）；或以 Range 取最後一字的範圍，若超出量 ≤ 0.5em 且該字是收尾標點就不算。必要時把這類列為警告而不是失敗。
   - 重現：390 寬、`lang="zh-TW"`、Noto Sans TC 16px，li 寬 322px，一行內容寬 327.2px 且最後一字是「」」。
2. **（資訊）** Git Bash 執行 `--base /better-agent-terminal/` 會被 MSYS 改寫成 Windows 路徑；apply-guide 的 bash 範例可補一句「Git Bash 設 `MSYS_NO_PATHCONV=1` 或用 PowerShell」。

### 遭遇問題
1. /releases 超出的原因與工單預設（不能斷行）不同 → 以 Q-1 問塔台，塔台選 C（見〈待塔台決策〉）。
2. 改後重新建置時 preview 伺服器（port 4191）還在提供舊的資產清單，頁面樣式沒載入；重開 preview（port 4192）後正常。不影響 layout-check（它用自己的伺服器與 scratchpad 複本）。
3. 一次建置 log 誤寫到 repo 上一層目錄，已立即移到 scratchpad（該目錄無其他變動）。

### 互動紀錄
- [16:30] Q-1：/releases 390 寬超出是 `text-spacing-trim` allow-end 造成的量測值，要用哪種修法？ → A（塔台，16:31，BAT 通道）：選 C：不改 CSS。墨跡在欄內、沒有水平捲動，這是 layout-check 以字框量測、沒扣行尾標點擠壓的誤判。① 回報區附 chrome-live 量測數字與截圖路徑；② 〈skill 回饋〉寫明原因與建議；③ 驗收「內文超出主內容欄 0」改為「只剩 390 /releases 深淺各 1 項（已知誤判，塔台接受 Q-1=C）」，主要組 exit 1 只能是這 2 項，其他項目仍須 0；④ baseline 比對照常，/releases 不應有差異。任務 3 到此結束，繼續任務 4。 → Action：任務 3 不改 CSS；〈驗證〉5、〈skill 回饋〉1、〈驗收條件〉照答覆寫。

### 去識別化
- 回報區只寫 `<使用者資料夾>`，沒有真名、客戶名或家目錄完整路徑。

### 後續
- 塔台：請使用者決定 push（會觸發 Pages 部署）；push 後以 chrome-live 在 960 寬確認導覽列。
- 塔台：〈skill 回饋〉1、2 轉 BMad-Guide 塔台。
