---
schema_version: 1
schema_kind: workorder
id: T0870
title: "BAT 網站套用 vitepress-portal-layout v1.0.0：主內容加寬、左右功能表收合、向量圖放大（BMad-Guide HANDOVER）"
type: implementation
status: DONE
created_at: "2026-11-16T19:41:27+0800"
started_at: "2026-11-16T19:42:55+0800"
updated_at: "2026-11-16T20:24:29+0800"
completed_at: "2026-11-16T20:24:29+0800"
session_ids:
  - "7d19c765-c5b6-4ae5-b729-be4a6e261d3f"
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
depends_on: []
related:
  - "D294；BMad-Guide HANDOVER `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_handover-2026-11-16-portal-layout-skill-bat.md`（對方 commit `afb33f1`，D747／D748）；回覆 `_ct-workorders/_reply-2026-11-16-portal-layout-skill-bat.md`"
affects_files:
  - _ct-workorders/T0870-site-apply-portal-layout-skill.md
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
  - "🔴 skill 本體在 BMad-Guide repo，**唯讀**：只複製檔案進 `site/.vitepress/theme/`，不得寫入 `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\` 底下任何檔案。複製進來的檔案保持 skill 原樣（站點專屬調整寫在 BAT 自己的檔案，例 `custom.css`、`index.ts`、元件的 `data-no-zoom`）；若非改 skill 檔不可，停下來問塔台，由塔台回報 BMad-Guide。"
  - "🔴 不套用 Timeline（第 4 項）：不複製 `timeline.css`、`Timeline.vue`，不註冊元件。"
  - "🔴 首頁（`layout: home`）的外觀不得改變；960px 以下的手機 / 平板版面不得改變；既有 23 個元件的行為（動畫、點擊互動、影片播放）不得改壞。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push（push 到 main 會觸發 Pages 部署 = 對外發佈）、不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
  - "ℹ️ 主 checkout 根目錄的 `node_modules` 目前不完整（vite / vitest 不在）；本單只需 `site/` 自己的 `node_modules`（已存在，缺就在 `site/` 內 `npm ci`）。不要在 repo 根目錄跑 `npm ci`。"
---

# T0870 — BAT 網站套用 vitepress-portal-layout v1.0.0（加寬、左右收合、向量圖放大）

## 元資料
- **工單編號**：T0870｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-16 19:41 (UTC+8)
- **規模**：M｜**依賴**：無｜**決策**：D294｜**來源**：BMad-Guide 塔台 HANDOVER（跨專案）

## 背景
BMad-Guide 塔台把 VitePress 版型 skill `vitepress-portal-layout` v1.0.0 交給 BAT，請 BAT 網站（`site/`）套用前三項。塔台已確認：
- `site/package.json` 的 `vitepress` 是 `1.6.4`（skill 驗證的版本）
- `config.mts` 沒有 CSP（沒有 `Content-Security-Policy` meta），`cleanUrls: true`，`head` 是陣列，另有 `transformHead`（約 L68）會加 head
- `theme/index.ts` 只 `extends: DefaultTheme` ＋ `enhanceApp` 註冊 23 個元件，沒有自訂 `Layout`
- 含 inline SVG 的元件：`ContractFlow`、`RemoteBridge`、`ShellLoop`、`StoryIllo`、`TowerDemo`；另有 `MediaFigure`（圖 / 影片）、`DemoVideo`
- `custom.css` 約 1,300 行，有多個自訂 max-width 與 959px / 639px 斷點

## 必讀（唯讀，`BG` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide`）
1. `BG\Portal-Layout-Skill\vitepress-portal-layout-v1.0.0\SKILL.md`
2. 同目錄 `references\apply-guide.md`（複製哪些檔、`theme/index.ts` 怎麼接 `Layout` slot、`config.mts` 的 `head`、CSS 載入順序、`<figure>` 元件的 `data-no-zoom`）
3. 同目錄 `references\selectors.md`、`references\csp.md`、`references\accessibility.md`（需要時）
4. `BG\_ct-workorders\T0499-impl-vitepress-portal-layout-skill.md` 回報區〈AC-8 給 T0500／T0501 的套用要點〉（約 L276：自訂 `<figure>` 元件、`--allow-origins`、`cleanUrls`、`head` 陣列的實例）
5. 驗證腳本 `BG\Portal-Layout-Skill\vitepress-portal-layout-v1.0.0\scripts\layout-check.mjs`（直接以 node 執行，不用裝套件；用本機 Chrome / Edge headless）

## 任務
1. **複製與接線**：依 `apply-guide.md` 把第 1–3 項的檔案（`layout.css`、`layout-state.ts`、`LayoutToggles.vue`、`figure-zoom.css`、`figure-zoom.ts`、`FigureZoom.vue`）複製進 `site/.vitepress/theme/`；`index.ts` 加 `Layout`（`doc-top` 放 `LayoutToggles`、`layout-bottom` 放 `FigureZoom`），保留既有 `enhanceApp`；`config.mts` 的 `head` 加 `layoutHeadScript`；CSS 載入順序照 apply-guide。收合鈕文字用繁體中文（`labels` prop）。
2. **與 `custom.css` 的衝突**：檢查既有 max-width / 斷點規則會不會抵消加寬或讓 ≥ 1440 寬時元件跑版；站點這邊的調整寫在 `custom.css`。
3. **圖的放大對象逐一判斷**：列出站上每種圖（`.vp-doc img`、`MediaFigure`、5 個 inline SVG 元件、`DemoVideo` 等）是否該有放大鈕：
   - 靜態示意圖 → 保留放大，確認放大後仍是向量、樣式正確（SKILL.md「限制」：樣式靠外層選擇器的 SVG 複製後會套不到）
   - 動畫 / 可點擊互動 / 影片 / 放大後樣式壞掉且修起來不划算的 → 加 `data-no-zoom`
   - 樣式壞掉但值得保留放大的 → 把樣式改掛在 `<svg>` 自己的 class 或 SVG 自帶 `<style>`（只改 BAT 元件，不改 skill）
   回報區附一張表：元件 / 選擇器、放大或不放大、理由。
4. **skill 缺陷**：遇到 skill 本身的問題（不是 BAT 站的問題）不要改 skill 檔，記在回報區〈skill 回饋〉，由塔台轉給 BMad-Guide 塔台。

## 驗收條件
- [ ] `cd site && npm run build` 成功，無新增警告（附輸出摘要）
- [ ] `layout-check.mjs --dist site/.vitepress/dist` 跑 2560 / 1920 / 1366 / 390 四種寬度 × 深淺色，加上 `--collapse`、`--layout-test`、`--figure-test`；頁面至少包含首頁、`features`、`control-tower`、`control-tower-tour`、`remote/`、`install`、`cases`；**失敗 0**（console 錯誤 0、水平捲動 0、對外請求 0 —— 站上若有合理的對外請求（例 GitHub API 取最新版號、外部字型）以 `--allow-origins` 放行並在回報區列出理由）
- [ ] 首頁（`layout: home`）在四種寬度的截圖與套用前比較：版面不變（`--shots` 前後各一組，存在 scratch / temp，回報區只寫路徑與結論，不 commit 截圖）
- [ ] 390 寬（手機）文件頁版面與套用前相同
- [ ] 收合狀態重新整理後保留、首屏不閃動；收合鈕鍵盤可操作
- [ ] 放大對象判斷表（任務 3）；有放大的 SVG 放大後仍是向量、頁面 id 不重複
- [ ] 既有 `e2e/site-media.spec.ts` 不受影響（只需確認選擇器沒被新元素干擾，能跑就跑；跑不了寫原因）
- [ ] commit 只含本單範圍（`site/` ＋本工單），不 push

## 收尾
- 回報後塔台請使用者本機看過（`cd site && npm run dev` 或 preview）再決定 push（會觸發 Pages 部署）；push 後確認 Pages 綠燈與 `link-check`。
- 塔台更新 `_reply-2026-11-16-portal-layout-skill-bat.md` 並通知 BMad-Guide 塔台（含〈skill 回饋〉）。

## 塔台補充（執行中 #1）

**時間**：2026-11-16T20:04:25+0800
**補充內容**：
> BMad-Guide 塔台跨 session 訊息（本段寫入前收到）（MMP Portal 套用時發現，對方 T0501）：skill v1.0.0 已知缺陷——
> 1. **沒有側欄的文件頁不會加寬**：`layout.css` 只覆寫有側欄的版面，`.VPDoc:not(.has-sidebar)`（容器 992px、內容 752px）不受影響；`layout-check` 也沒檢查這種頁面，所以會判定通過。對方會在 skill **v1.0.1** 修正並加檢查。
> 2. `--shot-page` 對不到頁面時不會警告：路徑寫成 dist 裡的 `.html` 形式，或同時給 `--pages`。
> 3. 只有點陣圖的頁面不會產生 zoom 截圖（不是失敗）。

**新指示**：
> - 🔴 **不要**在 BAT 站自己補 CSS 讓無側欄頁加寬（v1.0.1 出來後整包覆蓋 portal-layout 檔案即可）。若已經補了，拿掉。
> - 回報區〈後續〉列出 BAT 站上屬於「無側欄文件頁」的頁面（沒有就寫沒有），標「待 skill v1.0.1」；這些頁 layout-check 通過不代表已加寬，回報時不要寫成已加寬。
> - 截圖用 `--shot-page` 時照第 2 點的寫法，並確認截圖檔真的產生。
> - 〈skill 回饋〉不用再報這三項（對方已知）。

**範圍與驗收**：無變更（`affects_files` 不變；驗收條件不變，「失敗 0」仍適用，無側欄頁的未加寬不算本單失敗）
**已完成部分**：不影響；只有「若已為無側欄頁補 CSS」那部分要拿掉

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **DONE**：8 項驗收條件全部達成（`e2e/site-media.spec.ts` 依條件「跑不了寫原因」處理，見〈驗證〉7）。
- 產品 commit：`338a8f78`（只含 `site/` 11 檔），未 push。
- **session_id**：7d19c765-c5b6-4ae5-b729-be4a6e261d3f

### 落點檢查
- **PASS**。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，一致。C-1：工單在 `REPO_ROOT/_ct-workorders/` 下。C-3（資訊用）：`site/.vitepress/theme/`、`site/.vitepress/config.mts`、`site/remote/` 都存在。C-2：工單沒有 `branch` 欄位，目前在 `main`。
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`BAT_REMOTE_TOKEN` 已設定。沒有 `CT_HOME`（非 worktree）。

### 變更內容
| 檔案 | 內容 |
|---|---|
| `site/.vitepress/theme/portal-layout/`（新增 6 檔） | 從 skill `assets/theme/` 原樣複製 `layout.css`、`layout-state.ts`、`figure-zoom.css`、`figure-zoom.ts`、`components/LayoutToggles.vue`、`components/FigureZoom.vue`（`cmp` 逐檔一致，未修改）。照 `apply-guide.md` §1 放在 `portal-layout/` 子目錄。**未**複製 `timeline.css`、`Timeline.vue`，未註冊 `PlTimeline`。 |
| `site/.vitepress/theme/index.ts` | 加 `Layout`：`doc-top` → `LayoutToggles`（`labels` 傳四個繁中字串）、`layout-bottom` → `FigureZoom`；import `layout.css`、`figure-zoom.css` 放在 `custom.css` 之前；既有 23 個 `enhanceApp` 註冊不動。 |
| `site/.vitepress/config.mts` | `head` 陣列最後加 `['script', {}, layoutHeadScript]`（`transformHead` 不動）。 |
| `site/.vitepress/theme/components/StoryIllo.vue`、`TowerDemo.vue` | 根 `<figure>` 加 `data-no-zoom`（理由見〈放大對象判斷表〉）；說明寫在 `<script>` 註解，沒有在 template 根加 HTML 註解（避免變成多根節點）。 |
| `site/.vitepress/theme/custom.css` | 三處站點調整（下列）。 |

`custom.css` 的調整（任務 2 的衝突處理）：
1. **SVG 寬高改成只在頁面的 figure 裡設**：`.cf-svg`、`.rb-svg`、`.sl-svg` 原本寫 `width: 100%; height: auto`，CSS 會蓋過 skill 放大時改的 SVG `width`／`height` 屬性，放大被卡在視窗寬（`layout-check --figure-test` 在 `/remote/` 報「放大時 SVG 的 width 屬性沒有跟著變（屬性 2040、實際 1920）」）。把 `width`／`height` 移到 `.contract-flow > .cf-svg`、`.remote-bridge > .rb-svg`、`.shell-loop > .sl-svg`；其餘（`max-width`、置中、字型、顏色）不動，頁面上的結果相同。
2. **三張置中示意圖不留 44px 按鈕空間**：`.contract-flow, .remote-bridge, .shell-loop { --pl-zoom-reserve: 0px; }`。三張圖都置中、比內容欄窄（或右上角是空白），按鈕疊在角落不壓到圖；版面高度與套用前相同（手機版面不變的必要條件）。
3. **首頁導覽列與頁尾維持 1440px**：skill 在 ≥ 1440 把 `--vp-layout-max-width` 改成 `100vw`，**首頁的導覽列也跟著撐到視窗邊緣**（1920／2560 截圖比對抓到，見〈驗證〉3）。`@media (min-width: 1440px) { .VPNavBar:not(.has-sidebar), .VPFooter { --vp-layout-max-width: 1440px; } }`。BAT 的文件頁都有側欄，只影響首頁與 404 頁。
- 既有 max-width／斷點規則：grep `custom.css` 沒有改 `--vp-layout-max-width`、`.VPDoc .content-container`、`.vp-doc p` 寬度、`.VPSidebar` 寬度的規則；959px／639px 斷點都是 `max-width` 媒體查詢，與 skill 的 ≥ 960／1280／1440 覆寫不重疊。≥ 1440 時 10 頁、深淺色都沒有水平捲動、沒有「沒用滿寬度」或段落超過行長的失敗。
- 沒有為無側欄文件頁補 CSS（塔台補充 #1）。

### 驗證
1. **build**：`cd site && npm run build` → `build complete in 2.78s`，輸出無 warning（`grep -ic warn` = 0；套用前也是 0）。`latest-release` 在建置時取 GitHub API（既有行為，非瀏覽器端）。
2. **layout-check**（skill `scripts/layout-check.mjs`，本機 Chrome headless；最終建置、`--base /better-agent-terminal/`、`--allow-origins https://fonts.googleapis.com,https://fonts.gstatic.com`）：
   - 頁面 10 頁：`/`、`/features`、`/control-tower`、`/control-tower-tour`、`/remote/`、`/install`、`/cases`、`/why`、`/remote/wsl`、`/faq`（cleanUrls 寫法）。
   - A：`--widths 2560,1920,1366,390 --schemes dark,light --layout-test --figure-test` → **exit 0，「全部通過：8 組（寬度 × 外觀）× 10 頁」**。每組 console 錯誤 0、對外請求 0、水平捲動 0 頁。
   - B：同寬度與外觀 `--collapse all` → **exit 0，全部通過 8 × 10**。
   - `/control-tower` 主內容寬：展開 2560 → 1904、1920 → 1264、1366 → 710、390 → 342；兩側收合 2560 → 2432、1920 → 1792、1366 → 1238（390 不變）。
   - 另外對 `/cases`、`/why`、`/remote/` 各跑一次 `--figure-test`（1366、390 × 深淺色），讓三張 SVG 都被抽到：都 exit 0。
   - `--allow-origins` 理由：站點 `config.mts` 本來就從 Google Fonts 載入 Chiron Hei HK／Martian Mono／Noto Sans TC（`fonts.googleapis.com` 的 CSS、`fonts.gstatic.com` 的字型檔）；沒有其他對外請求。
   - `--shot-page /control-tower`（cleanUrls 寫法、與 `--pages` 的寫法一致）：JSON 的 `layoutShot` 每組都是 `/control-tower`，`layout-*`／`collapsed-*`／`zoom-*` 截圖檔都實際產生（A 16 張、B 8 張）。
3. **首頁版面不變**：skill 的 `layout-*` 截圖不拍首頁（首頁 `info.layout` 為 null），改用 scratch 腳本（同樣 CDP、`prefers-reduced-motion: reduce`、整頁截圖、canvas 逐像素比對）拍套用前（`dist-before`）與套用後各一組 4 寬 × 深淺色。
   - 雜訊基準：套用前自己拍兩次，差異只在導覽列第 24–39 列（≤ 29 px）。
   - 第一次比對：1920／2560 的導覽列（第 12–51 列，約 2 萬 px）不同 → 加 `custom.css` 第 3 點後重拍。
   - 最終：8 張的頁高都相同，差異只在第 24–39 列 ≤ 28 px（與雜訊基準相同）。2560 深色有一次出現第 25–7956 列 1.4 萬 px 差異，重拍後只剩雜訊（同一份 dist 前後兩次也是同樣的差，屬截圖時機）。結論：**首頁外觀不變**。
   - 截圖在 `<使用者資料夾>\AppData\Local\Temp\claude\…\scratchpad\`：`before-full\`、`after-full\`、`after-full2\`（首頁）、`before-mob\`、`after-mob\`（手機文件頁）、`final-check\`、`final-collapse\`、`zoom-*\`；未 commit。
4. **390 寬文件頁版面不變**：`/features`、`/control-tower`、`/control-tower-tour`、`/remote/`、`/install`、`/cases` 套用前後整頁截圖比對：6 頁 × 深淺色的頁高都相同；`/control-tower`、`/control-tower-tour`、`/install` 只有導覽列雜訊；`/features`、`/remote/`、`/cases` 多出的差異是每張截圖／示意圖右上角約 36 × 35 px 的放大鈕（新功能本身；觸控裝置常駐顯示），文字與圖的位置不變（`/features` 前後裁切目視比對）。截圖本身的部分像素差是圖片縮放雜訊。
5. **收合**：`--layout-test`（≥ 1366 各組）：`aria-expanded` true → Enter 後 false、`<html>` 加 class、空白鍵切回、`localStorage` `{"sidebar":true}`／`{"aside":true}`、重新整理後保留（`contentAfterReload` = 收合寬）、`classBeforeBody: true`（首屏前已套用，不閃動）、`headScript: true`、列印 `display: none`；390 時兩個按鈕都不顯示（`shown: false`）。按鈕文字為繁中 labels。
6. **放大**：判斷表見下節。有放大的 3 張 SVG：放大後 `tag: svg`、`raster: 0`、`dupCount: 0`（id 不重複）、`brokenRefs: 0`（`ContractFlow` 的 2 個 marker id 加字尾、3 個 `url(#…)` 都改寫）；`+` 後 `svgWidthAttr` 與實際寬一致（修正後）；滾輪、拖曳、焦點鎖（Tab 不出檢視層）、Esc 關閉且焦點回原按鈕、`<html>` 鎖捲動都通過。zoom 截圖目視：字型、品牌紫、深淺色、箭頭都正確。
7. **`e2e/site-media.spec.ts`**：未執行。原因：它驅動 BAT 桌面程式（Playwright `_electron`）產生 `site/public/media/` 的素材，需要 `npx vite build` 的 App 與 `BAT_SITE_MEDIA=1`，主 checkout 根目錄 `node_modules` 不完整（工單說明，不在根目錄 `npm ci`）。選擇器檢查：spec 的選擇器全是 App 的 DOM（`.thumbnail`、`.context-menu`、`.worker-batch-close-dialog`、`.workspace-tab-btn`…），沒有任何網站 DOM，新增的 `.pl-*` 元素不會干擾。
8. **commit 範圍**：`338a8f78` 只含 `site/.vitepress/`（11 檔，+1144／−9）；工單 commit 另提。未 push、未發版。

### 放大對象判斷表
| 元件／選擇器 | 頁面 | 放大 | 理由 |
|---|---|---|---|
| `MediaFigure`（`figure.bat-media` 內 `<a><img>`） | `/features` ×7、`/remote/`、`/remote/wsl`、`ssh`、`docker` | ✅ 放大 | 靜態截圖（1922×1202），手機上小字看不清；放大檢視以原檔顯示，100% = 原檔像素。按鈕疊在右上角，不留空間；點圖開新分頁的原行為保留。 |
| `ContractFlow`（`figure.contract-flow`，inline SVG） | `/cases` | ✅ 放大 | 靜態示意圖。樣式是 `.cf-*` 掛在 SVG 元素自己的 class，複製後仍套得到；只有寬高規則要移到 figure 下（`custom.css` 第 1 點）。`--pl-zoom-reserve: 0`。 |
| `RemoteBridge`（`figure.remote-bridge`，兩張 SVG：寬版／直版擇一顯示） | `/remote/` | ✅ 放大 | 靜態示意圖，同上。放大時取第一張（寬版），手機上也放大寬版：寬版在檢視層裡比直版好讀（行內 `display: block` 蓋過頁面的 `display: none`）。 |
| `ShellLoop`（`figure.shell-loop`，inline SVG） | `/why` | ✅ 放大 | 靜態示意圖，同上；檢視層標題取 figcaption。 |
| `StoryIllo`（`figure.story-illo`，只有 `branches` 種類含 SVG） | `/control-tower`、`StoryChapter`／`TicketLife` 內 | ❌ `data-no-zoom` | 插圖是 HTML＋SVG 片段組成、`role="img"`，底色是終端深色；放大只會複製其中的分支圖 SVG，`<pre>` 狀態文字不會跟去，標籤顏色是為深底調的。其他種類沒有 SVG，不會有按鈕；整個元件一律標記。 |
| `TowerDemo`（`figure.tower-demo`，SVG 雷達） | 首頁 | ❌ `data-no-zoom` | 動畫（`requestAnimationFrame`）＋可點擊的分頁與暫停鈕；放大只能複製靜態 SVG。首頁 `markdownStyles: false` 沒有 `.vp-doc`，本來就不會選到，標記是保險。 |
| `DemoVideo`（`figure.bat-media` 內 `<video>`） | `/control-tower` | — 不會加 | 只有影片（poster 是屬性不是 `<img>`），skill 不加按鈕；未改。 |
| `QuestionFlow`（`figure.question-flow`，純 HTML） | `/control-tower` | — 不會加 | 沒有 SVG 也沒有圖片。 |
| Markdown `![]()`（`.vp-doc img`） | — | （有就放大） | 目前站上沒有 Markdown 圖片，圖都經 `MediaFigure`。 |
| 其他 15 個元件 | — | — | 沒有 `<figure>`、`<svg>`、`<img>`（grep 確認）。 |

### skill 回饋
（不含塔台補充 #1 的三項已知缺陷）
1. **首頁的導覽列也被加寬**：`layout.css` 在 ≥ 1440 把 `html:root { --vp-layout-max-width: 100vw }`，預設主題的 `.VPNavBar .container`（沒有側欄時）與 `.VPFooter .container` 也用這個變數，所以 `layout: home` 的導覽列內容貼到視窗兩緣、頁尾也一樣。SKILL.md 寫「首頁維持預設的 1152px 版面」只對內文成立。BAT 在 `custom.css` 以 `.VPNavBar:not(.has-sidebar), .VPFooter { --vp-layout-max-width: 1440px }` 還原。建議 skill 內建（或改成只在 `.Layout:has(.VPSidebar)` 這類範圍內改變數），並讓 `layout-check` 比對首頁導覽列寬度。
2. **SVG 自己 class 上的 `width`／`height` 會讓放大失效**：放大是改 SVG 的 `width`／`height` 屬性，但屬性的優先權最低，站點常見的 `.my-svg { width: 100%; height: auto }`（寫在 SVG 自己的 class，不是外層）就會把它蓋掉，放大被卡在檢視層寬度。SKILL.md〈限制〉只提到「靠外層選擇器的樣式」，反而建議把樣式掛在 SVG 自己的 class，照做會踩到這個。`layout-check --figure-test` 有抓到（好）。建議 `apply()` 同時寫行內 `style.width`／`style.height`（或在 `figure-zoom.css` 對 `.pl-zoom-content` 加 `width: auto !important` 之類的處理），並在〈限制〉補一句。
3. **`layout-check` 不拍首頁**：`layout-*` 截圖只拍有 `info.layout` 的文件頁，`--shot-page /` 也不會產生；截圖只有視窗高度。工單要的「首頁套用前後比較」只能另寫腳本。建議加整頁截圖選項，並允許首頁。
4. **`--figure-test` 每組只抽一張 SVG**：站上有多張 SVG 元件時，要逐頁各跑一次才能全部驗到（本單第一次就是只在抽到 `/remote/` 的那幾組才失敗）。建議加「全部可放大的圖都測」的選項，或至少每頁各抽一張。
5. （資訊）宿主裡有多張 SVG（響應式擇一顯示）時一律取第一張，不看哪一張可見；BAT 的 `RemoteBridge` 剛好可接受（寬版），但值得在 apply-guide §7 提一句。

### 遭遇問題
1. `custom.css` 實際約 3,860 行（工單背景寫約 1,300 行），不影響做法。
2. 上面〈skill 回饋〉1、2 兩項都是在 BAT 這邊以 `custom.css` 處理，沒有改 skill 檔。
3. 截圖比對的雜訊：導覽列第 24–39 列每次截圖都有少量差異（套用前自己比也有），比對時以此為基準。

### 互動紀錄
- [19:42] 開工；`CT_MODE=yolo`、`CT_INTERACTIVE=0`，全程未向使用者或塔台提問。
- [20:1x] 📥 塔台補充（執行中 #1）於〈收到塔台跨 session 訊息「請重讀工單」〉讀到 → 本單沒有為無側欄頁補 CSS（不需要拿掉）；確認站上只有首頁（`layout: home`）沒有側欄、沒有無側欄文件頁；`--shot-page` 改用與 `--pages` 相同的 cleanUrls 寫法並確認截圖檔產生；〈skill 回饋〉不列那三項。（時間：段落寫入 20:04:25 之後、20:22 之前收到，未取精確時間）

### 去識別化
- 回報區只寫 `<使用者資料夾>`，沒有真名、客戶名、家目錄完整路徑；截圖不 commit。commit 訊息只有技術內容。

### 後續
- **無側欄文件頁：沒有**（`dist` 內所有頁面中只有 `index.html` 沒有 `has-sidebar`，那是首頁 `layout: home`）。所以沒有「待 skill v1.0.1」的頁面；v1.0.1 出來後仍建議整包覆蓋 `portal-layout/` 並重跑本單的兩組 `layout-check`。
- skill 升版（v1.0.1 起）若修了〈skill 回饋〉1、2：可拿掉 `custom.css` 底部的導覽列／頁尾規則；SVG 寬高的 `> .x-svg` 寫法留著無害。
- 收尾照工單：使用者本機 `cd site && npm run dev`（或 build 後 `npm run preview`）看過再決定 push；push 後確認 Pages 綠燈與 `link-check`。
