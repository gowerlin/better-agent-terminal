---
schema_version: 1
schema_kind: workorder
id: T0881
title: "BAT 網站：960 寬導覽列超出視窗、390 寬 /releases 一行超出主內容欄（portal-layout v1.1.6 新檢查）"
type: implementation
status: PENDING
created_at: "2026-11-17T16:22:37+0800"
updated_at: "2026-11-17T16:22:37+0800"
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
- **工單編號**：T0881｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-17 16:22 (UTC+8)
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
