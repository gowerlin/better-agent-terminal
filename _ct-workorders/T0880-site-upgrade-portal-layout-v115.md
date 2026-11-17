---
schema_version: 1
schema_kind: workorder
id: T0880
title: "BAT 網站 vitepress-portal-layout 從 v1.1.2 升到 v1.1.5（BMad-Guide HANDOVER）"
type: implementation
status: DONE
created_at: "2026-11-17T15:02:46+0800"
started_at: "2026-11-17T15:03:58+0800"
updated_at: "2026-11-17T15:37:27+0800"
completed_at: "2026-11-17T15:37:27+0800"
session_ids:
  - "25f910d1-a435-48ed-9b68-640714043cf0"
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: S
depends_on: [T0872]
related:
  - "D301；BMad-Guide HANDOVER `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_handover-2026-11-17-portal-layout-skill-v115-bat.md`（對方 D778–D782、T0516／T0518）；回覆 `_ct-workorders/_reply-2026-11-17-portal-layout-skill-v115-bat.md`；前一張 T0872（v1.1.2）"
affects_files:
  - _ct-workorders/T0880-site-upgrade-portal-layout-v115.md
  - site/.vitepress/theme/portal-layout/
  - site/.vitepress/theme/index.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改 `site/.vitepress/theme/portal-layout/`（整包覆蓋）與 `site/.vitepress/theme/index.ts` 的**註解**版號（與本工單回報區）。`custom.css`、`config.mts`、元件都不改；若覺得非改不可（例如網站名稱被截斷），停下來問塔台。不改產品（`electron/**`、`src/**`、`scripts/**`）、不改 workflow。"
  - "🔴 skill 本體在 BMad-Guide repo，**唯讀**：只複製檔案進 `site/.vitepress/theme/portal-layout/`，不得寫入 `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\` 底下任何檔案；複製進來的檔保持原樣。skill 缺陷記在回報區〈skill 回饋〉。Timeline 兩檔照舊不複製。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push（push 到 main 會觸發 Pages 部署 = 對外發佈）、不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
  - "ℹ️ 主 checkout 根目錄的 `node_modules` 不完整；本單只需 `site/` 自己的 `node_modules`（已存在，缺就在 `site/` 內 `npm ci`）。不要在 repo 根目錄跑 `npm ci`。"
  - "ℹ️ 全站 `layout-check --figure-test all` 很久：用背景執行（`run_in_background`）。"
---

# T0880 — BAT 網站 vitepress-portal-layout 從 v1.1.2 升到 v1.1.5

## 元資料
- **工單編號**：T0880｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-17 15:02 (UTC+8)
- **規模**：S｜**依賴**：T0872（DONE，已上線）｜**決策**：D301｜**來源**：BMad-Guide 塔台 HANDOVER（跨專案）

## 背景
T0872 把 BAT 網站升到 skill v1.1.2（`ff8841f1`，已上線）。v1.1.3、v1.1.4 只改驗證腳本與文件；v1.1.5 是使用者看 BAT Portal 時提出的建議（有側欄的頁，側欄上方的網站名稱水平置中）。塔台已核對：skill 目錄 commit `8698c16`、zip SHA-256 `C7808BBE…C6C1` 與 HANDOVER 相同；網站 `portal-layout/` 與 v1.1.5 `assets/theme/` 比對**只有 `layout.css`、`figure-zoom.ts` 不同**（`figure-zoom.css`、`layout-state.ts`、`components/` 相同）→ head script 與 CSP 雜湊不必重算。

v1.1.5 會變的地方（摘自 HANDOVER，以 skill 文件為準）：
- 網站名稱：有側欄的頁、視窗 ≥ 960，名稱在側欄上方那一格水平置中（展開與收合都是）；名稱比可用寬（預設 240px）寬時改靠左、省略號截斷。首頁、沒有側欄的頁、< 960 不變。BAT 站名 `Better Agent Terminal`。
- ≥ 1440 的舊問題（名稱連結方塊超出格右緣）修正。
- 圖片宿主（`bat-media` 11 個）的放大按鈕改對齊圖片右上角，約往左 1px。SVG／Mermaid／HTML 圖不變。
- 頁高、主內容寬、按鈕數、應有按鈕數、開啟倍率不變（baseline 預期差異 0）。

## 必讀（唯讀，`BG` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide`）
1. HANDOVER：`BG\_ct-workorders\_handover-2026-11-17-portal-layout-skill-v115-bat.md`（建議步驟、驗收、三項已知狀況）
2. `BG\Portal-Layout-Skill\vitepress-portal-layout-v1.1.5\SKILL.md`〈v1.1.4 → v1.1.5〉、`references\apply-guide.md` § 15、§ 9〈升級前後比對〉
3. 驗證腳本 `BG\Portal-Layout-Skill\vitepress-portal-layout-v1.1.5\scripts\layout-check.mjs`
4. T0872 回報區（`_ct-workorders/T0872-site-upgrade-portal-layout-v112.md`）：layout-check 參數（`--base /better-agent-terminal/`、`--allow-origins https://fonts.googleapis.com,https://fonts.gstatic.com`）、全站 15 頁、按鈕 15、`--collapse` 不能與 `--layout-test` 同用
5. 參考：`BG\_ct-workorders\T0518-impl-portal-layout-v115-reapply.md` 回報區 Step 1、AC-2、AC-3、AC-7（CT／MMP 的同一流程）

## 任務
1. **升級前 baseline**：把目前（v1.1.2）的建置複製到 scratchpad，用 v1.1.5 的 `layout-check.mjs` 在複本上 `--save-baseline`，三組照 HANDOVER：2560／1920／1366／390 × 深淺色；2560／1920 `--collapse all`；1439／1280／960。這三次預期 exit 1，失敗清單應該只有「網站名稱沒有…置中／超出…那一格」與位移 > 0.5px 的「放大按鈕…不在…圖片…的右上角」；出現其他項目先查原因並記在回報區。確認 stderr「baseline：已寫入」。
2. **覆蓋**：整包覆蓋 `portal-layout/`，覆蓋前後 `cmp`（預期覆蓋前只有 `layout.css`、`figure-zoom.ts` 不同，覆蓋後全部一致）。Timeline 不複製。`index.ts` 只改註解版號。
3. **升級後比對**：`cd site && npm run build`，三組同參數加 `--baseline`（主要那組與窄寬那組帶 `--layout-test`，主要那組再帶 `--figure-test all`；收合組不帶 `--layout-test`）；背景執行。`--full-page` 目視一輪。
4. **網站名稱**：記錄 BAT 站名的寬度、中心差、是否截斷（若被截斷：不要改 `config.mts`／`custom.css`，在回報區附數字，交塔台決定）。
5. **960 導覽列目視**（HANDOVER〈已知狀況〉1）：截一張 960 寬有側欄的頁，看導覽列項目與外觀切換是否在視窗內，結果寫進回報區。
6. **收尾**：檢查 `%TEMP%` 下 `pl-layout-check-*` 殘留目錄，有就刪除並記數量。

## 驗收條件
- [ ] `cd site && npm run build` 成功，無新增警告
- [ ] `portal-layout/` 與 skill v1.1.5 `assets/theme/` `cmp` 一致；Timeline 未複製；`custom.css`／`config.mts`／元件未改
- [ ] 三組 `--baseline` 比對 exit 0、差異 0（零星頁高差異：v1.1.3 起腳本會自動重量，仍有就附數字）
- [ ] 主要組 15 頁 × 4 寬 × 深淺色 `--layout-test --figure-test all` 失敗 0、`hostIssues` 0、`missing` 0；名稱中心差 ≤ 1px、圖片按鈕位置問題 0
- [ ] 升級前失敗清單只有名稱置中與圖片按鈕兩類（附數量）
- [ ] 網站名稱截斷與否、960 導覽列目視結果寫在回報區
- [ ] commit 只含本單範圍，不 push

## 收尾
- 回報後塔台請使用者決定 push（會觸發 Pages 部署）；push 後確認 Pages 綠燈與 `link-check`。
- 塔台更新 `_reply-2026-11-17-portal-layout-skill-v115-bat.md` 並通知 BMad-Guide 塔台（含〈skill 回饋〉；HANDOVER〈已知狀況〉三項不必回報，但 960 導覽列目視結果要附）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **DONE**：驗收條件全部達成。網站名稱沒有截斷（寬 203.7px ≤ 可用 240px），不需塔台決定。
- 產品 commit：`32231eb3`（只含 `site/.vitepress/theme/portal-layout/layout.css`、`figure-zoom.ts`、`site/.vitepress/theme/index.ts`，+57／−9），未 push、未發版。
- **session_id**：25f910d1-a435-48ed-9b68-640714043cf0

### 落點檢查
- **PASS**。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，一致。C-1：工單在 `REPO_ROOT/_ct-workorders/` 下。C-3（資訊用）：`site/.vitepress/theme/portal-layout/`、`site/.vitepress/theme/index.ts` 都存在。C-2：沒有 `branch` 欄位，目前在 `main`。
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`BAT_REMOTE_TOKEN` 已設定。沒有 `CT_HOME`（非 worktree）。

### 變更內容
| 檔案 | 內容 |
|---|---|
| `site/.vitepress/theme/portal-layout/`（6 檔） | 覆蓋前 `cmp`：只有 `layout.css`、`figure-zoom.ts` 不同，`figure-zoom.css`、`layout-state.ts`、`FigureZoom.vue`、`LayoutToggles.vue` 相同（與 HANDOVER 一致）。從 skill v1.1.5 `assets/theme/` 整包覆蓋 6 檔，覆蓋後逐檔 `cmp` 全部一致。`timeline.css`、`Timeline.vue`、`index.example.ts` 未複製。 |
| `site/.vitepress/theme/index.ts` | 只改註解：`v1.1.2` → `v1.1.5`、「T0871／T0872 升級」→「T0871／T0872／T0880 升級」。 |
| 未改 | `custom.css`、`config.mts`、站點元件、產品程式、workflow。head script 與 CSP 雜湊不必重算（`layout-state.ts` 沒變）。 |

來源核對：skill 目錄最後 commit `8698c16`；zip SHA-256 `C7808BBE2BA7307FDE96350984EAAC03CFFF78F50AF9256DAC4258293E48C6C1`，與 HANDOVER 相同。BMad-Guide repo 未寫入任何檔案。

### 驗證
共同參數：`--base /better-agent-terminal/`、`--allow-origins https://fonts.googleapis.com,https://fonts.gstatic.com`；腳本 = skill v1.1.5 `scripts/layout-check.mjs`；`--dist` 都是 scratchpad 複本（`dist-pre` = 升級前以目前 HEAD（v1.1.2）重新建置的複本、`dist-post` = 升級後建置的複本）；dist 15 頁（404 除外），其中有側欄的文件頁 14 頁；全部背景執行。

1. **build**：升級後 `cd site && npm run build` → `build complete in 3.06s`，輸出 `grep -ic warn` = 0。
2. **升級前 baseline（`dist-pre`，三組都 exit 1，stderr 都有「baseline：已寫入」）**：
   | 組 | 參數 | baseline | 失敗 |
   |---|---|---|---|
   | 主要 | `--widths 2560,1920,1366,390 --schemes dark,light` | `before.json` 120 組 | 84 項，全部是「網站名稱沒有在側欄上方那一格裡水平置中」（14 頁 × 2560／1920／1366 × 深淺）；390 沒有 |
   | 收合 | `--widths 2560,1920 --schemes dark,light --collapse all` | `before-collapse.json` 60 組 | 56 項，全部是名稱置中 |
   | 窄寬 | `--widths 1439,1280,960 --schemes dark,light` | `before-narrow.json` 90 組 | 85 項：名稱置中 84；另 1 項 `[960 light] /cases.html：console／載入錯誤 2（loadingFailed: net::ERR_NO_BUFFER_SPACE）` |
   - 名稱位置（舊）：≥ 1440 內容 x 64～267.7、中心差 +29.8px（伸到格右緣 272 前 4px）；960～1439 內容 x 32～235.7、中心差 −2.2px。
   - **「放大按鈕…不在…圖片…的右上角」0 項**：圖片按鈕每組查 11 顆，按鈕右緣距圖片右緣最遠 5px，都在 0～6.5px 容許內，所以沒有列入失敗；升級後是 6px（往左約 1px，與 HANDOVER 預估一致，見 3）。
   - `ERR_NO_BUFFER_SPACE` 原因：Windows 的 socket 緩衝暫時不足（腳本自己起的本機伺服器載入某個資源失敗），與版面無關。該頁的 baseline 列（頁高 4589、主內容 560、按鈕 1／應有 1）與同寬深色完全相同，量測未受影響；升級後同組 0 失敗。
3. **升級後比對（`dist-post`，三組都 exit 0）**：
   | 組 | 參數 | 結果 |
   |---|---|---|
   | 主要 | 同上＋`--layout-test --figure-test all --baseline before.json --full-page --shot-page /control-tower` | 全部通過 8 組 × 15 頁；baseline 比對 120 組、**差異 0**（`onlyInBaseline` 0、`onlyInThisRun` 0、`changedParams` 無、`unstableHeights` 無） |
   | 收合 | 同上＋`--collapse all --baseline before-collapse.json`（不帶 `--layout-test`） | 全部通過 4 組 × 15 頁；baseline 60 組、**差異 0** |
   | 窄寬 | 同上＋`--layout-test --baseline before-narrow.json` | 全部通過 6 組 × 15 頁；baseline 90 組、**差異 0** |
   - 每組：按鈕 15／應有 15、`missing` 0、`hostIssues` 0、`noZoomViolations` 0、對外請求 0、console 錯誤 0、失敗 0；圖片按鈕位置問題 0（查 11 顆，最遠 6px）；名稱置中問題 0（查 14 頁，中心差最大 0px，截斷 0 頁）；`figureTest` 每組 svg 3、html 1、img 11、`skipped` 0。主內容寬 2560 → 1904、1920 → 1264、1366 → 710、390 → 342（與 T0872 相同）。
   - `--full-page`：`/control-tower`（2560／1920／1366／390）與首頁 390 超過 16384px，v1.1.3 起自動分 2 段（警告 10 筆，非失敗）；目視 `layout-2560-dark-part2of2` 底部不再重複頁首（T0872〈skill 回饋〉2 已解決）。
4. **網站名稱（`Better Agent Terminal`）**：logo＋名稱寬 **203.7px**（可用 240px），**沒有截斷**；格 x 0～272，內容 x 34.2～237.9，**中心差 0px**；與收合鈕最小距離 38.2px（≥ 4）。目視 2560 深色、1366 淺色、1920 收合、960：名稱都在側欄上方那一格置中，沒有伸到搜尋框底下。
5. **960 導覽列目視**（HANDOVER〈已知狀況〉1）：960 寬、有側欄的 `/cases`（有捲軸時版面寬 945）：導覽列從 x 272 開始，搜尋框 272～435，選單「安裝／功能／遠端開發／與 Control Tower 協作／實戰案例」在視窗內；**「參考」選單 883.8～953.8 右端約 9px 超出、「…」（`.VPNavBarExtra`，外觀切換在它裡面）953.8～997.8 完全在視窗外**；外觀切換與 GitHub 圖示（`.VPNavBarAppearance`／`.VPNavBarSocialLinks`）在此寬度本來就 `display: none`。對照線上 v1.1.2（同 viewport、同頁）：所有位置**數字完全相同** → 不是升級造成，是〈已知狀況〉1。layout-check 的 960 截圖（無捲軸，寬 960）「參考」完整可見，「…」仍在視窗外。截圖：`nav-960-post.png`。
6. **收尾**：`%TEMP%` 下 `pl-layout-check-*` 殘留目錄 **76 個**，已全部刪除（刪除後 0）。這是本機歷次 layout-check（含先前工單）累積的，不只本單。
7. 量測檔與截圖在 `<使用者資料夾>\AppData\Local\Temp\claude\…\scratchpad\t0880\`：`before*.json`、`pre-*.json/.err`、`post-*.json/.err`、`shots-main\`、`shots-col\`、`shots-narrow\`、`nav-960-post.png`、`crop-*.png`；未 commit。

### 驗收條件
- [x] `cd site && npm run build` 成功，無新增警告（warn 0）
- [x] `portal-layout/` 與 skill v1.1.5 `assets/theme/` `cmp` 一致；Timeline 未複製；`custom.css`／`config.mts`／元件未改
- [x] 三組 `--baseline` 比對 exit 0、差異 0（120／60／90 組；頁高沒有任何差異或重量）
- [x] 主要組 15 頁 × 4 寬 × 深淺色 `--layout-test --figure-test all` 失敗 0、`hostIssues` 0、`missing` 0；名稱中心差 0px、圖片按鈕位置問題 0
- [x] 升級前失敗清單只有名稱置中一類（主要 84、收合 56、窄寬 84）＋窄寬 1 筆暫時性 `ERR_NO_BUFFER_SPACE`（已查原因，見〈驗證〉2）；圖片按鈕類 0 項（舊位置 5px 在容許內）
- [x] 網站名稱不截斷（203.7px）、960 導覽列目視結果已寫（「…」在視窗外，與 v1.1.2 相同）
- [x] commit 只含本單範圍（`32231eb3`），不 push

### skill 回饋
（不含 HANDOVER〈已知狀況〉三項；960 導覽列目視結果見〈驗證〉5）
1. **（資訊）HANDOVER 預估的「放大按鈕…不在…圖片…的右上角」在 BAT 舊建置上沒有出現**：舊位置按鈕右緣距圖片右緣 5px，在新檢查的容許範圍 0～6.5px 內，所以不算失敗；升級後 6px。HANDOVER／SKILL 寫「失敗清單＝會變的完整清單」，但位移小、仍在容許內的變化不會出現在清單裡。建議文件註明「圖片按鈕的小位移（容許內）不會列為失敗，看 stderr 每組摘要的『最遠 X px』前後比較」。
2. **（資訊）Windows 上長時間跑可能出現 `net::ERR_NO_BUFFER_SPACE` 載入錯誤**（窄寬組 90 頁次中 1 次），被算成 console／載入錯誤失敗。屬暫時性 OS 資源問題；若頻繁可考慮該頁自動重試一次，或在說明裡列為已知的雜訊。
3. **（資訊）`pl-layout-check-*` 殘留比預期多**：本機累積 76 個（〈已知狀況〉3 已知，補數量供參考）。

### 遭遇問題
1. 升級前窄寬組 1 筆 `ERR_NO_BUFFER_SPACE`（見〈驗證〉2），不影響 baseline，升級後未再出現。
2. 為 960 目視起了一次 `vitepress preview`（port 4188，量完即停止）並以獨立瀏覽器 context 開頁，量完關閉；線上站只讀取比對。
3. 沒有寫入 BMad-Guide repo，複製進來的檔保持原樣。

### 互動紀錄
- [15:03] 開工；`CT_MODE=yolo`、`CT_INTERACTIVE=0`，全程未向使用者或塔台提問。
- [未記時間（升級前 baseline 完成後）] 升級前窄寬組多 1 筆 `ERR_NO_BUFFER_SPACE`：查 baseline 列與同寬深色一致，判定為暫時性雜訊、不影響 baseline，繼續。
- [未記時間（960 目視時）] 960 導覽列「…」在視窗外：與線上 v1.1.2 數字相同，判定為〈已知狀況〉1，只記錄。

### 去識別化
- 回報區只寫 `<使用者資料夾>`，沒有真名、客戶名、家目錄完整路徑；量測檔與截圖不 commit。commit 訊息只有技術內容。

### 後續
- 塔台：請使用者決定 push（`32231eb3` 未 push；push 會觸發 Pages 部署），push 後確認 Pages 綠燈與 `link-check`。
- 塔台：更新 `_reply-2026-11-17-portal-layout-skill-v115-bat.md`（〈skill 回饋〉三項＋960 導覽列目視結果）並通知 BMad-Guide 塔台。
