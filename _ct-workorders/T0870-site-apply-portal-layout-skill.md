---
schema_version: 1
schema_kind: workorder
id: T0870
title: "BAT 網站套用 vitepress-portal-layout v1.0.0：主內容加寬、左右功能表收合、向量圖放大（BMad-Guide HANDOVER）"
type: implementation
status: PENDING
created_at: "2026-11-16T19:41:27+0800"
updated_at: "2026-11-16T19:41:27+0800"
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
- **工單編號**：T0870｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-16 19:41 (UTC+8)
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

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 落點檢查

### 變更內容

### 驗證

### 放大對象判斷表

### skill 回饋

### 遭遇問題

### 互動紀錄

### 去識別化

### 後續
