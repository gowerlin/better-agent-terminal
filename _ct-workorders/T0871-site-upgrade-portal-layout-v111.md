---
schema_version: 1
schema_kind: workorder
id: T0871
title: "BAT 網站 vitepress-portal-layout 從 v1.0.0 直接升到 v1.1.1（BMad-Guide HANDOVER）"
type: implementation
status: PENDING
created_at: "2026-11-17T06:50:02+0800"
started_at: ""
updated_at: "2026-11-17T06:50:02+0800"
completed_at: ""
session_ids: []
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
- **工單編號**：T0871｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-17 06:50 (UTC+8)
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
