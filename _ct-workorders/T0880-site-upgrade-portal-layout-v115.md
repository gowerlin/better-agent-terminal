---
schema_version: 1
schema_kind: workorder
id: T0880
title: "BAT 網站 vitepress-portal-layout 從 v1.1.2 升到 v1.1.5（BMad-Guide HANDOVER）"
type: implementation
status: PENDING
created_at: "2026-11-17T15:02:46+0800"
updated_at: "2026-11-17T15:02:46+0800"
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
- **工單編號**：T0880｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-17 15:02 (UTC+8)
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

### 落點檢查

### 變更內容

### 驗證

### 驗收條件

### skill 回饋

### 遭遇問題

### 互動紀錄

### 去識別化

### 後續
