---
schema_version: 1
schema_kind: workorder
id: T0871
title: "BAT 網站 vitepress-portal-layout 從 v1.0.0 直接升到 v1.1.1（BMad-Guide HANDOVER）"
type: implementation
status: DONE
created_at: "2026-11-17T06:50:02+0800"
started_at: "2026-11-17T06:51:29+0800"
updated_at: "2026-11-17T07:17:45+0800"
completed_at: "2026-11-17T07:17:45+0800"
session_ids:
  - "4c9c6651-32e2-4aaf-99fb-584b4cb6ff86"
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
depends_on: [T0870]
related:
  - "D295；BMad-Guide HANDOVER `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_handover-2026-11-17-portal-layout-skill-v111-bat.md`（對方 commit `e6c6a8a`，D756／D761）；回覆 `_ct-workorders/_reply-2026-11-17-portal-layout-skill-v111-bat.md`；前一張 T0870（v1.0.0）"
affects_files:
  - _ct-workorders/T0871-site-upgrade-portal-layout-v111.md
  - site/.vitepress/theme/
  - site/.vitepress/config.mts
  - site/*.md
  - site/remote/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改 `site/`（與本工單回報區）。不改產品（`electron/**`、`src/**`、`scripts/**`）、不改 workflow。"
  - "🔴 skill 本體在 BMad-Guide repo，**唯讀**：只複製檔案進 `site/.vitepress/theme/portal-layout/`，不得寫入 `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\` 底下任何檔案。複製進來的檔案保持 skill 原樣（站點專屬調整寫在 BAT 自己的檔案）；若非改 skill 檔不可，停下來問塔台。skill 缺陷記在回報區〈skill 回饋〉。"
  - "🔴 Timeline 照舊不套用：不複製 `timeline.css`、`Timeline.vue`，不註冊元件。"
  - "🔴 不得改變：首頁（`layout: home`）內文外觀、960px 以下的手機／平板版面、既有元件的行為（動畫、點擊互動、影片播放）、文件頁寬度（與升級前相同）。首頁導覽列與頁尾在 ≥ 1440 應維持與現在相同（現在由 `custom.css` 繞道做到，升級後改由 skill 內建）。"
  - "🔴 不要補「把按鈕保留空間加回來」的規則（那是 CT／MMP 在 v1.1.0 的繞道，v1.1.1 已內建）；T0870 在 `custom.css` 的 `--pl-zoom-reserve: 0px`（三張置中示意圖）要依 v1.1.1 的做法重新判斷（v1.1.1 改用 `data-pl-zoom-reserve=\"off\"` 屬性；兩者擇一，以 `hostIssues` 0 且版面高度不變為準）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push（push 到 main 會觸發 Pages 部署 = 對外發佈）、不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
  - "ℹ️ 主 checkout 根目錄的 `node_modules` 不完整（vite / vitest 不在）；本單只需 `site/` 自己的 `node_modules`（已存在，缺就在 `site/` 內 `npm ci`）。不要在 repo 根目錄跑 `npm ci`。"
  - "ℹ️ 全站 `layout-check --figure-test all` 很久（對方 39 頁超過 10 分鐘、執行中沒有進度輸出）：用背景執行（`run_in_background`），不要用前景長逾時等待。"
---

# T0871 — BAT 網站 vitepress-portal-layout 從 v1.0.0 直接升到 v1.1.1

## 元資料
- **工單編號**：T0871｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-17 06:50 (UTC+8)
- **規模**：M｜**依賴**：T0870（DONE，已上線）｜**決策**：D295｜**來源**：BMad-Guide 塔台 HANDOVER（跨專案）

## 背景
T0870 把 skill v1.0.0 套進 BAT 網站（`338a8f78`，已上線）。BMad-Guide 依 BAT 的回饋與 CT／MMP 兩站的經驗出了 v1.1.1，請 BAT 從 v1.0.0 直接升（v1.1.0 不必先套）。塔台已核對來源：skill 目錄最後 commit `0e3e056`、zip SHA-256 與 HANDOVER 相同。

v1.0.0 → v1.1.1 會變的地方（摘自 HANDOVER，以 skill 文件為準）：
- 有差異的檔只有 `layout.css`、`figure-zoom.css`、`figure-zoom.ts`；`layout-state.ts`、`FigureZoom.vue`、`LayoutToggles.vue` 不變 → head script 不必改（BAT 沒有 CSP）。
- 首頁導覽列與頁尾 ≥ 1440 回到 1440px 置中由 skill 內建（`--pl-home-layout-max-width`，預設 1440px）→ 拿掉 T0870 的繞道。
- **HTML 圖放大**：沒有 SVG／圖片的 `<figure>` 會自動長出按鈕；`<ol>`／`<div>` 畫的圖要自己加 `data-pl-zoom` 才放大。互動元件一律 `data-no-zoom`。
- **按鈕改接在宿主後面**（兄弟元素，絕對定位右上 6px）；宿主上方預設保留 44px，站點寫的 `padding: 0` 蓋不掉。站點 CSS 用 `.x + p`、`.x ~ p` 選宿主後面的元素，或用 `:last-child` 選宿主本身的，要改寫。
- 新屬性：`data-no-zoom`、`data-pl-zoom`（`="html"`）、`data-pl-zoom-reserve="off"`、`data-pl-narrow`。

T0870 的現況（回報區）：放大的有 `MediaFigure` 截圖與 3 張靜態 SVG 示意圖（`ContractFlow`、`RemoteBridge`、`ShellLoop`）；`StoryIllo`、`TowerDemo` 加了 `data-no-zoom`；`custom.css` 有三處站點調整（SVG 寬高移到外層選擇器、三張置中圖 `--pl-zoom-reserve: 0px`、首頁導覽列／頁尾 1440 還原）。

## 必讀（唯讀，`BG` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide`）
1. HANDOVER：`BG\_ct-workorders\_handover-2026-11-17-portal-layout-skill-v111-bat.md`（含對方兩站實機經驗 9 點）
2. `BG\Portal-Layout-Skill\vitepress-portal-layout-v1.1.1\SKILL.md`（〈v1.1.0 → v1.1.1〉）
3. 同目錄 `references\apply-guide.md` § 7、§ 9、**§ 10〈從 v1.0.0 直接升到 v1.1.1 的檢查清單〉**
4. 驗證腳本 `BG\Portal-Layout-Skill\vitepress-portal-layout-v1.1.1\scripts\layout-check.mjs`（v1.1.1 版；直接以 node 執行）
5. T0870 回報區（本 repo `_ct-workorders/T0870-site-apply-portal-layout-skill.md`）：放大對象判斷表、`custom.css` 調整、layout-check 用法（`--base /better-agent-terminal/`、`--allow-origins` Google Fonts）

## 任務
1. **升級前基準**：用 v1.1.1 的 `layout-check.mjs` 對**目前**（v1.0.0）的建置記錄基準：各頁內容寬度、放大按鈕數、首頁導覽列寬度（≥ 1440）；需要時加 `--full-page` 截圖存 scratch / temp。
2. **覆蓋**：先 `cmp` 站點 `portal-layout/` 6 檔與 skill `assets/theme/`，確認只有 3 檔不同；整包覆蓋 6 檔，覆蓋後逐檔 `cmp` 一致。Timeline 兩檔不複製。
3. **拿掉繞道**：移除 `custom.css` 底部首頁導覽列／頁尾 1440 還原；確認 skill 內建行為在首頁 1920／2560 的結果與升級前相同。
4. **依 § 10 盤點**：
   - 會新長出按鈕的元件（`<figure>` 包、沒有 SVG／圖片的 HTML 圖）：逐一判斷放大或 `data-no-zoom`（互動元件一律 `data-no-zoom`）；`<ol>`／`<div>` 畫的靜態圖是否值得加 `data-pl-zoom`。
   - `custom.css` 中以 `.x + p`、`.x ~ p`、`:last-child` 選宿主或宿主後面元素的規則：列出並改寫受影響的。
   - T0870 的 `--pl-zoom-reserve: 0px`：依 v1.1.1 判斷保留或改 `data-pl-zoom-reserve="off"`，以版面高度不變、`hostIssues` 0 為準。
   - 首頁若有圖：依 § 10 判斷是否需要 `targets`（不要求首頁新增放大）。
5. **skill 缺陷**：不改 skill 檔，記在回報區〈skill 回饋〉（HANDOVER〈給 BAT 塔台〉列的兩項已知觀察不必回報）。

## 驗收條件
- [ ] `cd site && npm run build` 成功，無新增警告
- [ ] 6 檔與 skill v1.1.1 `assets/theme/` `cmp` 一致；Timeline 未複製
- [ ] `custom.css` 的首頁導覽列／頁尾 1440 還原已移除；首頁導覽列在 1920／2560 寬度與升級前相同
- [ ] v1.1.1 `layout-check.mjs` 全站（`site/.vitepress/dist` 全部頁面）× 2560／1920／1366／390 × 深淺色 `--layout-test --figure-test all`（背景執行）**失敗 0**；另跑 `--collapse all` 一組失敗 0；`--full-page` 截圖一輪目視（回報區只寫路徑與結論，不 commit 截圖）
- [ ] 三組數字：各頁寬度與升級前相同、按鈕數 = 應有數（附升級前後對照與差異理由）、`hostIssues` 0；390 寬比檢視區高的 HTML 圖從 100%、上緣開啟（若有）
- [ ] 首頁內文外觀、390 寬文件頁版面與升級前相同；既有元件互動不受影響
- [ ] 放大對象判斷表（更新 T0870 那張：含新長出按鈕的元件）
- [ ] commit 只含本單範圍（`site/` ＋本工單），不 push

## 收尾
- 回報後塔台請使用者決定 push（會觸發 Pages 部署）；push 後確認 Pages 綠燈與 `link-check`。
- 塔台更新 `_reply-2026-11-17-portal-layout-skill-v111-bat.md` 並通知 BMad-Guide 塔台（含〈skill 回饋〉）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **DONE**：8 項驗收條件全部達成。
- 產品 commit：`5a7e2478`（只含 `site/.vitepress/theme/` 9 檔，+435／−96），未 push、未發版。
- **session_id**：4c9c6651-32e2-4aaf-99fb-584b4cb6ff86

### 落點檢查
- **PASS**。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，一致。C-1：工單在 `REPO_ROOT/_ct-workorders/` 下。C-3（資訊用）：`site/.vitepress/theme/`、`site/.vitepress/config.mts`、`site/remote/` 都存在。C-2：沒有 `branch` 欄位，目前在 `main`。
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`BAT_REMOTE_TOKEN` 已設定。沒有 `CT_HOME`（非 worktree）。

### 變更內容
| 檔案 | 內容 |
|---|---|
| `site/.vitepress/theme/portal-layout/`（6 檔） | 覆蓋前 `cmp`：`layout.css`、`figure-zoom.css`、`figure-zoom.ts` 不同，`layout-state.ts`、`FigureZoom.vue`、`LayoutToggles.vue` 相同（與 HANDOVER 一致）。從 skill v1.1.1 `assets/theme/` 整包覆蓋 6 檔，覆蓋後逐檔 `cmp` 一致。`timeline.css`、`Timeline.vue` 未複製、未註冊。`config.mts` 的 head script 不必改（`layout-state.ts` 沒變，BAT 沒有 CSP），未動。 |
| `site/.vitepress/theme/custom.css` | 刪掉 T0870 底部兩段：首頁導覽列／頁尾 ≥ 1440 還原（skill 內建 `--pl-home-layout-max-width`）、三張置中圖的 `--pl-zoom-reserve: 0px`（改用屬性，見下）。換成一段只有註解的說明（目前沒有 portal-layout 的站點 CSS 規則、各調整寫在哪）。T0870 第 1 點（SVG 寬高寫在 `.contract-flow > .cf-svg` 等外層選擇器）留著：v1.1.1 已不需要，但無害、不影響版面（T0870〈後續〉已註明）。 |
| `ContractFlow.vue`、`RemoteBridge.vue`、`ShellLoop.vue` | 根 `<figure>` 加 `data-pl-zoom-reserve="off"`（取代 CSS 變數；`<script>` 註解說明理由）。 |
| `QuestionFlow.vue` | 根 `<figure>` 加 `data-pl-zoom-reserve="off"`（v1.1.1 新長出的放大鈕，見判斷表）；理由寫在既有的模板註解裡，沒有新增根節點。 |
| `index.ts` | 只改註解：版號 v1.0.0 → v1.1.1、`<figure>` 會放大的說明。接法（slot、CSS 載入順序）不變。 |

`--pl-zoom-reserve: 0px` 與 `data-pl-zoom-reserve="off"` 的選擇：兩者在 v1.1.1 的結果相同（宿主 `padding-top` 0，`hostIssues` 0）；改用屬性，因為 apply-guide § 5 把「某個宿主不保留空間」定義為這個屬性（變數是「保留多高」），而且判斷寫在元件標記旁邊。

### 依 § 10 盤點
- **會新長出按鈕的元件**（沒有 SVG／圖片的 `<figure>`）：只有 `QuestionFlow`（`/control-tower`）。其他 `<figure>`：`MediaFigure`（圖片，照舊）、`DemoVideo`（`<video>`，skill 不加）、三張 SVG 圖（照舊）、`StoryIllo`／`TowerDemo`（已有 `data-no-zoom`）。`site/*.md`、`site/remote/*.md` 沒有手寫 `<figure>`。
- **`<ol>`／`<div>` 畫的靜態圖**（`CapabilityLevels`、`GrowthLadder`、`TicketLife`、`TourDay`、`TicketStates`）：**不加 `data-pl-zoom`**。理由：都是依內容欄寬重新排版的文字清單／步驟條（窄螢幕改直排），頁面上的字就是正常字級，放大檢視只是同一排版的等比放大，手機上開啟還是 100%，沒有多看到東西；加了要嘛多 44px（版面變動），要嘛按鈕疊在清單上。`StoryTimeline` 是捲動動畫元件，且在首頁（沒有 `.vp-doc`）。
- **站點 CSS 的 `.x + p`、`.x ~ p`、`:last-child`**：grep `custom.css` 所有 `+`／`~`／`:last-child`／`:last-of-type`／`:only-child`：全部是元件內部的子元素規則（`.qf-box + .qf-box`、`.gl-rung:last-child`、`.tl-step:last-child`、`.dy-step:last-child`、`li + li`、`p + p`、`.case-text > p:last-child` 等），沒有一條以宿主（`.bat-media`、`.contract-flow`、`.remote-bridge`、`.shell-loop`、`.question-flow`）為對象或選宿主後面的元素。**沒有要改寫的規則**。量測佐證：升級前後每頁 `.vp-doc` 頂層區塊（除了新的按鈕兄弟元素）的位置與大小完全相同（見〈驗證〉3）。
- **首頁的圖**：首頁 `markdownStyles: false`，沒有 `.vp-doc`，預設規則抓不到；`TowerDemo` 另有 `data-no-zoom`。不傳 `targets`（工單不要求首頁新增放大）。layout-check 首頁按鈕 0。

### 驗證
1. **build**：`cd site && npm run build` → `build complete in 3.23s`，`grep -ic warn` = 0（升級前同為 0）。
2. **layout-check v1.1.1**（skill `scripts/layout-check.mjs`；`--dist` = 最終建置的複本、`--base /better-agent-terminal/`、`--allow-origins https://fonts.googleapis.com,https://fonts.gstatic.com`（站點本來就載入 Google Fonts，同 T0870）；頁面 = dist 全部 15 頁（404 除外），背景執行）：
   - A：`--widths 2560,1920,1366,390 --schemes dark,light --layout-test --figure-test all --full-page --shot-page /control-tower` → **exit 0，「全部通過：8 組（寬度 × 外觀）× 15 頁」**。每組 `hostIssues` 0、`missing` 0、`noZoomViolations` 0、`iconOverflow` 0、按鈕 15、`minTextGap` 最小 29.9 px（1366）；`figureTest` 每組 svg 3、html 1、img 11、`skipped` 0。
   - B：同寬度與外觀 `--collapse all` → **exit 0，全部通過 8 × 15**；收合寬 2560 → 2432、1920 → 1792、1366 → 1238（與 T0870 相同）。
3. **升級前基準與前後對照**（升級前建置複本 `dist-before`；layout-check v1.1.1 對 v1.0.0 建置的基準 exit 1，失敗只有預期的兩類：`QuestionFlow` 缺按鈕、三張 SVG 的保留空間被 `--pl-zoom-reserve: 0px` 判為蓋掉）。另以 scratch CDP 腳本（`prefers-reduced-motion: reduce`）量升級前後 15 頁 × 4 寬 × 深淺色 = 120 組：頁高、`scrollWidth`、主內容寬、導覽列／頁尾寬、`.vp-doc` 頂層區塊的位置與大小。
   - **最終結果：120 組全部相同**（排除新的按鈕兄弟元素）。過程中 `QuestionFlow` 預設保留 44px 時 `/control-tower` 頁高 +44（各寬都是），改 `data-pl-zoom-reserve="off"` 後恢復。
   - 寬度（文件頁，展開）：2560 → 1904、1920 → 1264、1366 → 710、390 → 342，14 個文件頁升級前後相同。
   - 首頁導覽列／頁尾：2560、1920 都是 1376／1440（升級前由 `custom.css` 繞道、升級後由 skill 內建，數值相同）；1366 是 1302／1302、390 是 358／342。layout-check 的首頁寬度檢查通過。
   - **按鈕數 14 → 15**：`/features` 7、`/remote/` 2（RemoteBridge＋截圖）、`/remote/wsl`／`ssh`／`docker` 各 1、`/cases` 1、`/why` 1 不變；`/control-tower` 0 → 1（`QuestionFlow`，v1.1.0 起的 HTML 圖放大）。應有數 15 = 實際 15。
4. **390 寬 HTML 圖開啟**：站上唯一的 HTML 圖 `QuestionFlow` 在 390 寬頁面上 342 × 738，放大檢視區高 764：沒有比檢視區高的 HTML 圖；開啟倍率 100%（`fit` 0.992、頁面倍率 1，max = 1，符合 v1.1.1 規則），從上緣開始。桌面開啟倍率 2560 133%、1920 149%、1366 144%（= 符合畫面）。
5. **截圖目視**（`--full-page`）：首頁 2560 深色整頁：導覽列置中、沒有貼到視窗兩邊，內文與升級前相同；`zoom-html-1920-dark`、`zoom-html-390-light`：複製品顏色、字、版面和頁面相同。`QuestionFlow` 另拍 390／1366 × 深淺色裁切比較三種狀態（升級前、預設 44px、`reserve="off"`）：`off` 時按鈕疊在第一個方框右上角的空白（390 寬距文字 61 px；桌面在方框外的空白），版面與升級前相同。
6. **既有元件互動**：沒有改任何元件的腳本或互動 CSS；`StoryIllo`／`TowerDemo` 的 `data-no-zoom` 保留（`noZoomViolations` 0）；`MediaFigure` 點圖開新分頁的 `<a>` 未動；`DemoVideo` 沒有按鈕。收合鈕（`--layout-test`）：aria、Enter／空白鍵、`localStorage`、重新整理保留、首屏前套用、列印隱藏、390 不顯示都通過。
7. 截圖與量測檔在 `<使用者資料夾>\AppData\Local\Temp\claude\…\scratchpad\`：`shots-before\`、`shots-A\`、`shots-B\`、`qf-*.png`、`before.json`、`A.json`、`B.json`、`m-before.json`、`m-final.json`、`measure.mjs`；未 commit。

### 放大對象判斷表（T0870 版更新）
| 元件／選擇器 | 頁面 | 放大 | 理由 |
|---|---|---|---|
| `MediaFigure`（`figure.bat-media` 內 `<a><img>`） | `/features` ×7、`/remote/`、`/remote/wsl`、`ssh`、`docker` | ✅ 放大（不變） | 靜態截圖；按鈕疊在右上角，不留空間。 |
| `ContractFlow`（`figure.contract-flow`，SVG） | `/cases` | ✅ 放大（不變） | 靜態示意圖。不留空間：**改用 `data-pl-zoom-reserve="off"`**（原 `--pl-zoom-reserve: 0px`）。 |
| `RemoteBridge`（`figure.remote-bridge`，兩張 SVG） | `/remote/` | ✅ 放大（不變） | 同上。 |
| `ShellLoop`（`figure.shell-loop`，SVG） | `/why` | ✅ 放大（不變） | 同上。 |
| `QuestionFlow`（`figure.question-flow`，純 HTML） | `/control-tower` | ✅ **新增放大**（HTML 圖） | v1.1.0 起沒有 SVG／圖片的 `<figure>` 自動有按鈕。靜態（沒有點擊、hover、動畫、捲動），不需 `data-no-zoom`；桌面放大檢視 133–149%。`data-pl-zoom-reserve="off"`：按鈕疊在第一個方框右上角的空白，與文字 ≥ 61 px，頁高與升級前相同。 |
| `StoryIllo`（`figure.story-illo`） | `/control-tower` 等 | ❌ `data-no-zoom`（不變） | 同 T0870。 |
| `TowerDemo`（`figure.tower-demo`） | 首頁 | ❌ `data-no-zoom`（不變） | 互動＋動畫；首頁本來就沒有 `.vp-doc`。 |
| `DemoVideo`（`figure.bat-media` 內 `<video>`） | `/control-tower` | — 不會加（不變） | 含 `<video>`，skill 不加。 |
| `CapabilityLevels`、`TourDay`、`TicketStates`（`/control-tower-tour`）、`TicketLife`、`GrowthLadder`（`/control-tower`、`/control-tower-tour`、首頁） | — | — 不加 `data-pl-zoom` | 依欄寬重排的文字清單，頁面上已是正常字級，放大沒有多的資訊；加了會多 44px 或按鈕疊在清單上。 |
| `StoryTimeline` | 首頁 | — | 捲動動畫；首頁沒有 `.vp-doc`。 |
| Markdown `![]()` | — | （有就放大） | 目前站上沒有。 |

### skill 回饋
（不含 HANDOVER〈給 BAT 塔台〉的兩項已知觀察）
1. **layout-check 沒有「升級前後版面高度」的比對**：工單與 HANDOVER 第 3、9 點都以「版面高度不變」「寬度與升級前相同」為驗收，但 JSON 只有主內容寬，沒有頁高與區塊位置；本單另寫 CDP 腳本量 120 組頁高與 `.vp-doc` 頂層區塊。建議 JSON 每頁記 `scrollHeight`（或加 `--baseline <json>` 比對前一次的頁高、寬度、按鈕數），升級驗收就不必另寫腳本。
2. （資訊）`summary.runs[].zoom.eligible` 是 26、`buttons` 15、`missing` 0：`eligible` 的意思（似乎含 `data-no-zoom` 範圍內的候選）在腳本開頭的說明沒有寫，看 JSON 時容易誤會成缺 11 個。建議在說明補一句或改名。
3. （資訊）HTML 圖的「比檢視區高」邊界：390 寬 `QuestionFlow` 高 738、檢視區 764，`fit` 0.992 < 1（含 16 px 邊距後放不下）而開在 100%、從上緣開始，底部約 8 px 要往下拖。與 HANDOVER 已知觀察「差不到 1% 時從上緣開始」同類，只是發生在 HTML 圖／手機；不影響驗收。

### 遭遇問題
1. layout-check v1.1.1 對 v1.0.0 建置跑基準時 exit 1（預期：舊版沒有 HTML 圖按鈕、`--pl-zoom-reserve: 0px` 被判為保留空間被蓋掉）；只取量測數字當基準，不當成失敗。
2. 沒有改 skill 檔、沒有寫入 BMad-Guide repo。

### 互動紀錄
- [06:51] 開工；`CT_MODE=yolo`、`CT_INTERACTIVE=0`，全程未向使用者或塔台提問。

### 去識別化
- 回報區只寫 `<使用者資料夾>`，沒有真名、客戶名、家目錄完整路徑；截圖與量測檔不 commit。commit 訊息只有技術內容。

### 後續
- 塔台：請使用者決定 push（`338a8f78` T0870 與 `5a7e2478` 本單都還沒 push；push 會觸發 Pages 部署）；push 後確認 Pages 綠燈與 `link-check`。
- 塔台：更新 `_reply-2026-11-17-portal-layout-skill-v111-bat.md`（〈skill 回饋〉三項）並通知 BMad-Guide 塔台。
- （選擇性）`custom.css` 的 SVG 寬高外層選擇器（T0870 第 1 點）在 v1.1.1 已不需要，可在之後整理時改回 SVG 自己的 class；本單不動以免改版面。
