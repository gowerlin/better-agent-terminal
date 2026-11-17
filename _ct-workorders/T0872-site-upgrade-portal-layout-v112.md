---
schema_version: 1
schema_kind: workorder
id: T0872
title: "BAT 網站 vitepress-portal-layout 從 v1.1.1 升到 v1.1.2（BMad-Guide HANDOVER）"
type: implementation
status: DONE
created_at: "2026-11-17T08:44:58+0800"
started_at: "2026-11-17T08:46:05+0800"
updated_at: "2026-11-17T09:09:08+0800"
completed_at: "2026-11-17T09:09:08+0800"
session_ids:
  - "972e5658-3fe1-4059-a27c-063d4527d336"
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: S
depends_on: [T0871]
related:
  - "D296；BMad-Guide HANDOVER `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_handover-2026-11-17-portal-layout-skill-v112-bat.md`（對方 commit `593f13c`，D762／D763）；回覆 `_ct-workorders/_reply-2026-11-17-portal-layout-skill-v112-bat.md`；前一張 T0871（v1.1.1）"
affects_files:
  - _ct-workorders/T0872-site-upgrade-portal-layout-v112.md
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
  - "🔴 只改 `site/.vitepress/theme/portal-layout/`（整包覆蓋）與 `site/.vitepress/theme/index.ts` 的**註解**版號（與本工單回報區）。`custom.css`、`config.mts`、元件都不改；若覺得非改不可，停下來問塔台。不改產品（`electron/**`、`src/**`、`scripts/**`）、不改 workflow。"
  - "🔴 skill 本體在 BMad-Guide repo，**唯讀**：只複製檔案進 `site/.vitepress/theme/portal-layout/`，不得寫入 `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\` 底下任何檔案；複製進來的檔保持原樣。skill 缺陷記在回報區〈skill 回饋〉。Timeline 兩檔照舊不複製。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push（push 到 main 會觸發 Pages 部署 = 對外發佈）、不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
  - "ℹ️ 主 checkout 根目錄的 `node_modules` 不完整；本單只需 `site/` 自己的 `node_modules`（已存在，缺就在 `site/` 內 `npm ci`）。不要在 repo 根目錄跑 `npm ci`。"
  - "ℹ️ 全站 `layout-check --figure-test all` 很久：用背景執行（`run_in_background`）。v1.1.2 有 stderr 進度輸出。"
---

# T0872 — BAT 網站 vitepress-portal-layout 從 v1.1.1 升到 v1.1.2

## 元資料
- **工單編號**：T0872｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-17 08:44 (UTC+8)
- **規模**：S｜**依賴**：T0871（DONE，已上線）｜**決策**：D296｜**來源**：BMad-Guide 塔台 HANDOVER（跨專案）

## 背景
T0871 把 BAT 網站升到 skill v1.1.1（`5a7e2478`，已上線）。BMad-Guide 收了 T0871 的 3 項回饋出 v1.1.2。塔台已核對：skill 目錄 commit `eee355b`、zip SHA-256 與 HANDOVER 相同；網站 `portal-layout/` 6 檔與 v1.1.2 比對**只有 `figure-zoom.ts` 不同**。

v1.1.2 的變化（摘自 HANDOVER，以 skill 文件為準）：
- 開啟倍率：頁面倍率 > 符合畫面 × 1.02 才用頁面倍率，否則用符合畫面。BAT 預期只有 `QuestionFlow` 在 390 寬從 100% 變成約 99.2%（整張看得見），桌面寬度不變。
- `layout-check.mjs` 新增 `--save-baseline <file>`／`--baseline <file>`／`--baseline-warn`（頁高 ±1px、主內容寬、按鈕數、應有按鈕數）、stderr 進度（`--quiet` 關）、門檻附近標 `nearThreshold`。

## 必讀（唯讀，`BG` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide`）
1. HANDOVER：`BG\_ct-workorders\_handover-2026-11-17-portal-layout-skill-v112-bat.md`（含建議步驟與兩項已知狀況）
2. `BG\Portal-Layout-Skill\vitepress-portal-layout-v1.1.2\SKILL.md`〈v1.1.1 → v1.1.2〉、`references\apply-guide.md` § 9〈升級前後比對〉、§ 11
3. 驗證腳本 `BG\Portal-Layout-Skill\vitepress-portal-layout-v1.1.2\scripts\layout-check.mjs`
4. T0871 回報區（`_ct-workorders/T0871-site-upgrade-portal-layout-v111.md`）：layout-check 參數（`--base /better-agent-terminal/`、`--allow-origins https://fonts.googleapis.com,https://fonts.gstatic.com`）、全站 15 頁、按鈕 15

## 任務
1. **升級前 baseline**：把目前（v1.1.1）的建置複製到 scratchpad，用 v1.1.2 的 `layout-check.mjs` 在複本上 `--save-baseline`（2560／1920／1366／390 × 深淺色；`--collapse all` 也另存一份）。
2. **覆蓋**：整包覆蓋 `portal-layout/` 6 檔，覆蓋前後 `cmp`（預期覆蓋前只有 `figure-zoom.ts` 不同、覆蓋後全部一致）。Timeline 不複製。`index.ts` 只改註解版號。
3. **升級後比對**：`npm run build`，同寬度與外觀 `--layout-test --figure-test all --baseline <before.json> --json <after.json>`（背景執行）；`--collapse all` 也比對。`--full-page` 目視一輪。
4. 若 `--baseline` 只報零星頁高差異：先單頁重量；重量後一致就判為量測雜訊，回報區附數字（HANDOVER〈已知狀況〉第 1 點）。

## 驗收條件
- [ ] `cd site && npm run build` 成功，無新增警告
- [ ] 6 檔與 skill v1.1.2 `assets/theme/` `cmp` 一致；Timeline 未複製；`custom.css`／`config.mts`／元件未改
- [ ] `--baseline` 比對：寬度、頁高、按鈕數差異 0（零星頁高差異依任務 4 處理並附數字）；展開與 `--collapse all` 兩組
- [ ] layout-check 全站 15 頁 × 4 寬 × 深淺色 `--layout-test --figure-test all` **失敗 0**、`hostIssues` 0、`missing` 0
- [ ] `steps.open`（開啟倍率）只有 `QuestionFlow` 390 寬改變（附前後數值）；桌面寬度不變
- [ ] commit 只含本單範圍，不 push

## 收尾
- 回報後塔台請使用者決定 push（會觸發 Pages 部署）；push 後確認 Pages 綠燈與 `link-check`。
- 塔台更新 `_reply-2026-11-17-portal-layout-skill-v112-bat.md` 並通知 BMad-Guide 塔台（含〈skill 回饋〉；HANDOVER〈已知狀況〉兩項不必回報）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **DONE**：驗收條件全部達成；其中「`steps.open` 只有 `QuestionFlow` 390 寬改變」與實測不同：另有 **1920 寬的 11 張截圖**也改用符合畫面開啟（65.7% → 65.3%，見〈驗證〉5）。這是 v1.1.2 文件寫明的行為（SKILL.md「桌面寬度上和檢視區差不多大的截圖」），不是缺陷；HANDOVER 的預估只依 T0871 回報的 HTML 圖數字，沒有涵蓋截圖。請塔台確認可接受。
- 產品 commit：`ff8841f1`（只含 `site/.vitepress/theme/index.ts`、`site/.vitepress/theme/portal-layout/figure-zoom.ts`，+15／−5），未 push、未發版。
- **session_id**：972e5658-3fe1-4059-a27c-063d4527d336

### 落點檢查
- **PASS**。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，一致。C-1：工單在 `REPO_ROOT/_ct-workorders/` 下。C-3（資訊用）：`site/.vitepress/theme/portal-layout/`、`site/.vitepress/theme/index.ts` 都存在。C-2：沒有 `branch` 欄位，目前在 `main`。
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`BAT_REMOTE_TOKEN` 已設定。沒有 `CT_HOME`（非 worktree）。

### 變更內容
| 檔案 | 內容 |
|---|---|
| `site/.vitepress/theme/portal-layout/`（6 檔） | 覆蓋前 `cmp`：只有 `figure-zoom.ts` 不同，`layout.css`、`figure-zoom.css`、`layout-state.ts`、`FigureZoom.vue`、`LayoutToggles.vue` 相同（與 HANDOVER 一致）。從 skill v1.1.2 `assets/theme/` 整包覆蓋 6 檔，覆蓋後逐檔 `cmp` 全部一致。`timeline.css`、`Timeline.vue` 未複製。 |
| `site/.vitepress/theme/index.ts` | 只改註解：`v1.1.1` → `v1.1.2`、「T0871 升級」→「T0871／T0872 升級」。 |
| 未改 | `custom.css`、`config.mts`、站點元件、產品程式、workflow。head script 與 CSP 雜湊不必重算（`layout-state.ts` 沒變）。 |

來源核對：skill 目錄最後 commit `eee355b`；zip SHA-256 `8644F0359AF20FB8F127CA28A371D7E8D42B35DC7BE91FD8A6BD7DF58CF8AE8B`，與 HANDOVER 相同。

### 驗證
參數同 T0871：`--base /better-agent-terminal/`、`--allow-origins https://fonts.googleapis.com,https://fonts.gstatic.com`、dist 全部 15 頁（404 除外）、`--widths 2560,1920,1366,390 --schemes dark,light`；腳本 = skill v1.1.2 `scripts/layout-check.mjs`；`--dist` 都是建置的 scratchpad 複本（`dist-pre` = v1.1.1 建置、`dist-post` = 本單建置）；全部背景執行。

1. **build**：`cd site && npm run build` → `build complete in 2.85s`，輸出 `grep -ic warn` = 0。
2. **升級前 baseline**（`dist-pre`）：展開 `--save-baseline before.json`、`--collapse all --save-baseline before-collapse.json` → 兩次都 exit 0、「全部通過：8 組 × 15 頁」，各寫入 120 組。
3. **升級後比對（展開）**：`--layout-test --figure-test all --baseline before.json --json after.json --full-page --shot-page /control-tower` → **exit 0，「全部通過：8 組 × 15 頁」，baseline 比對 120 組、差異 0 項**（`onlyInBaseline` 0、`onlyInThisRun` 0、`changedParams` 無）。每組：按鈕 15、應有按鈕 26、`missing` 0、`hostIssues` 0、`noZoomViolations` 0、對外請求 0、console 錯誤 0、失敗 0；`figureTest` 每組 svg 3、html 1、img 11、`skipped` 0；主內容寬 2560 → 1904、1920 → 1264、1366 → 710、390 → 342（與 T0871 相同）；`minTextGap` 最小 29.9 px（1366）。
4. **升級後比對（收合）**：`--collapse all --baseline before-collapse.json` → **exit 0，全部通過 8 × 15，baseline 120 組差異 0 項**；收合寬 2560 → 2432、1920 → 1792、1366 → 1238、390 → 342。（`--collapse` 與 `--layout-test` 不能同時用，第一次誤加被腳本以 exit 2 擋下，去掉 `--layout-test` 重跑；收合鈕已在 3 測過。）
   - 頁高：兩組都沒有任何差異，不需任務 4 的單頁重量。
5. **開啟倍率前後**（`steps.open`；升級前 = v1.1.2 腳本對 `dist-pre` 跑 `--figure-test all`，該次 exit 1，失敗只有下列 24 案例「開啟倍率不是符合畫面」，即舊行為；升級後同案例全部通過）：120 案例中 96 個不變、24 個改變，`nearThreshold` 0：
   | 寬 | 案例 | 升級前 | 升級後 | 符合畫面／頁面倍率（比值） |
   |---|---|---|---|---|
   | 390（深、淺） | `QuestionFlow`（`/control-tower` HTML 圖） | 100%（1） | 99.2%（0.9919） | 0.992／1（1.0080） |
   | 1920（深、淺） | 截圖 11 張：`/features` #1–#7、`/remote/` #2、`/remote/docker`、`/remote/ssh`、`/remote/wsl` | 65.7%（0.6566） | 65.3%（0.6531） | 0.653／0.6566（1.0055） |
   - 2560、1366 的所有案例與 1920／390 的其他案例（SVG 3、HTML 圖在 1920）開啟倍率不變；頁面上的寬度與版面不變（3、4）。
   - 1920 截圖的變化是 v1.1.2 的預期行為（頁面倍率只比符合畫面大 0.55%，改用符合畫面整張看得見，開啟時只小 0.5%）。
6. **截圖目視**：`zoom-html-390-light`：`QuestionFlow` 開在 99%，整張（含最後一個虛線框底邊）都在檢視區內，不必再拖。`zoom-img-1920-dark`：截圖開在 65%，整張看得見。`layout-1920-dark`（`/control-tower` 整頁）：版面正常。整頁截圖最底部又出現一次頁首，以同參數拍升級前建置也一樣（兩張都是 1920 × 16721），是整頁截圖超過約 16384 px 的接縫，不是升級造成（見〈skill 回饋〉2）。
7. 量測檔與截圖在 `<使用者資料夾>\AppData\Local\Temp\claude\…\scratchpad\t0872\`：`before.json`、`before-collapse.json`、`after.json`、`after-collapse.json`、`pre-fig.json`、`*.out`／`*.err`、`shots-post\`、`shots-col\`、`shots-cmp-pre\`、`shots-cmp-post\`、`cmp-open.mjs`；未 commit。

### 驗收條件
- [x] `cd site && npm run build` 成功，無新增警告（warn 0）
- [x] 6 檔與 skill v1.1.2 `assets/theme/` `cmp` 一致；Timeline 未複製；`custom.css`／`config.mts`／元件未改
- [x] `--baseline` 比對：寬度、頁高、按鈕數差異 0；展開與 `--collapse all` 兩組（各 120 組）
- [x] layout-check 全站 15 頁 × 4 寬 × 深淺色 `--layout-test --figure-test all` 失敗 0、`hostIssues` 0、`missing` 0
- [~] `steps.open`：`QuestionFlow` 390 寬 100% → 99.2% 如預期；**另有 1920 寬 11 張截圖 65.7% → 65.3%**（v1.1.2 文件化行為，見〈驗證〉5）；桌面寬度（版面）不變
- [x] commit 只含本單範圍（`ff8841f1`），不 push

### skill 回饋
（不含 HANDOVER〈已知狀況〉兩項）
1. **（資訊）HANDOVER 的「預期會變的案例」漏了截圖**：BAT 站 1920 寬的 11 張截圖頁面倍率 65.66%、符合畫面 65.31%（比值 1.0055），v1.1.2 改用符合畫面開啟。行為本身正是 SKILL.md 寫的「桌面寬度上和檢視區差不多大的截圖」，只是 HANDOVER 只依 HTML 圖推估。建議之後的 HANDOVER 預估「會變的案例」時，請站點先用新版腳本對舊建置跑一次 `--figure-test all`：失敗清單（「開啟時倍率 X 不是 Y：採用…」）就是會變的完整清單，本單即以此取得前後數值。
2. **（資訊）`--full-page` 截超過約 16384 px 高的頁面時，底部重複頁首**：`/control-tower` 1920 寬整頁 16721 px，最底部約 340 px 又出現頁首與頁面開頭（升級前後相同，Chrome 截圖的高度上限）。建議腳本說明註明，或超過時分段截圖／印警告，避免被誤判為版面問題。
3. **（資訊）`--collapse` 與 `--layout-test` 互斥**只在執行時以 exit 2 提示；§ 9〈升級前後比對〉寫「可以同時跑 `--layout-test`、`--figure-test all`」，`--collapse` 那句沒提到不能加 `--layout-test`。建議在說明補一句（收合組只能帶 `--figure-test`）。

### 遭遇問題
1. 收合組第一次誤加 `--layout-test`，腳本 exit 2（參數錯誤，沒有量測）；去掉後重跑通過。
2. 沒有寫入 BMad-Guide repo，複製進來的檔保持原樣。

### 互動紀錄
- [08:46] 開工；`CT_MODE=yolo`、`CT_INTERACTIVE=0`，全程未向使用者或塔台提問。
- [09:06] 開啟倍率改變的案例多於工單預期（1920 截圖 11 張）；判斷為 v1.1.2 文件化行為、非範圍問題，不阻擋，於回報區列出請塔台確認。

### 去識別化
- 回報區只寫 `<使用者資料夾>`，沒有真名、客戶名、家目錄完整路徑；量測檔與截圖不 commit。commit 訊息只有技術內容。

### 後續
- 塔台：確認 1920 截圖開啟倍率變化可接受；請使用者決定 push（`ff8841f1` 未 push；push 會觸發 Pages 部署），push 後確認 Pages 綠燈與 `link-check`。
- 塔台：更新 `_reply-2026-11-17-portal-layout-skill-v112-bat.md`（〈skill 回饋〉三項）並通知 BMad-Guide 塔台。
