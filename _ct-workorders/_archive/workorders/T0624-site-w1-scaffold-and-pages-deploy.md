---
schema_version: 1
schema_kind: workorder
id: T0624
title: "PLAN-049 W1：VitePress 站台骨架（`site/`）與 GitHub Pages 部署 workflow（`pages.yml`）"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T12:29:42+0800"
started_at: "2026-10-18T12:37:30+0800"
updated_at: "2026-10-18T12:47:57+0800"
completed_at: "2026-10-18T12:47:57+0800"
depends_on: [T0622]
related:
  - "T0622 回報區（規格來源：Q1 專案站、Q2 VitePress 1.6.4、Q3-2 資訊架構、Q5-1 `pages.yml` 草案、Q5-2 下載連結與發版同步、Q6 W1 範圍與驗收）"
  - "D159（專案站、CT 只介紹概念與整合點）、D160（技術 / 部署決定與使用者決定：無自訂網域、繁中單語、不加分析；W1 push 與啟用 Pages 授權）"
  - "後續：W2 內容、W3 素材（含 README 換新截圖）、W4 維運（OG / sitemap / lychee / `_local-rules.md` 發版同步一句）另開工單"
affects_files:
  - "site/**（新）"
  - ".github/workflows/pages.yml（新）"
  - ".gitignore（只在 `site/` 建置產物 / node_modules 需要時）"
  - _ct-workorders/T0624-site-w1-scaffold-and-pages-deploy.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **Worker 不 push、不改 GitHub 設定、不觸發 workflow**。push 與啟用 Pages（Source = GitHub Actions）由塔台在本單 DONE 後依 D160 授權執行並驗證；Worker 只在本機建置與驗證。`gh` 只能唯讀且一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 不改 `pre-release.yml` / `release.yml` / `build-server-bundle.yml`、根目錄 `package.json` / lockfile、`docs/`。`site/` 用獨立 `package.json` / `package-lock.json`；`allowScripts` 只放行 `esbuild`（name-only，D160），不得用 `npm install-scripts approve --all` 或 `--dangerously-allow-all-scripts`。"
  - "🔴 內容規則（D159）：CT 只介紹概念與它跟 BAT 的整合點，不放 CT 的取得管道、內部 repo 位置或 skill 檔內容；`site/` 內不得出現 `T0\\d{3}`、`D1\\d{2}`、`_ct-workorders`、`CLAUDE.md` 等內部編號 / 路徑（include 的 README / `release-note.md` 原文除外）。不得放既有 `assets/screenshot-*.png`（上游舊 UI、含上游作者路徑）。"
  - "🔴 非隔離工單。`src/styles/settings.css` 的 M 不是你的變更，不碰；並行的 T0623 若仍在改 `src/lib/terminal-attention.ts` 等檔，不碰。commit 用 `git commit --only <檔案>` 或精確 stage。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。"
---

# T0624 — PLAN-049 W1：站台骨架與 Pages 部署

## 目標

依 T0622 推薦（D160）在本 repo 建立專案站 `https://gowerlin.github.io/better-agent-terminal/` 的骨架與部署 workflow。內容頁（功能、遠端開發、BAT × CT、FAQ、回報）由 W2 補，本單只要能建置、能部署、首頁與三頁可用。

## 要做的事

1. **`site/` 骨架**（VitePress **1.6.4**，鎖定確切版本）：
   - `site/package.json`（`private: true`、scripts `dev` / `build` / `preview`、`allowScripts` 只 `esbuild`）、`site/package-lock.json`。
   - `site/.vitepress/config.*`：`base: '/better-agent-terminal/'`、`lang: 'zh-TW'`、title / description、預設主題 zh-TW UI 字串（約 20 個 key：上一頁 / 下一頁、目錄、深淺色、搜尋等）、local search（含 zh-TW 翻譯）、nav / sidebar（先放本單的頁，W2 頁面以 TODO 註解保留位置，不放死連結）、`cleanUrls` 依需要。
   - `.gitignore`：`site/node_modules/`、`site/.vitepress/dist/`、`site/.vitepress/cache/`。
2. **頁面**（繁中）：
   - 首頁 `/`（`layout: home`）：hero（名稱、標語、「下載最新版」與「GitHub」按鈕）、三個亮點（多工作區 / 內建 Agent 面板 / 與 Control Tower 協作 —— CT 只寫概念）。暫不放截圖（W3）。
   - 安裝 `/install`：取 README「快速開始」與平台說明（macOS 只有 Apple Silicon）、從舊版升級、除錯日誌位置；改寫成使用者語氣，不帶內部編號。
   - 版本對照 `/compatibility`：**單一來源**——直接 include README 的版本對照段落（VitePress `<!--@include: ../README.md{start,end}-->` 或以 region 標記；不得複製一份）。若需在 README 加 region 註解標記，只加註解、不改內容，並在回報說明。
   - 更版紀錄 `/releases`：include `release-note.md`。
3. **下載連結**：build 時以 GitHub Releases API（`GH_TOKEN` 有就用、沒有就匿名）取最新 `v*` release（排除 `server-bundle-v*`），產生 Windows 安裝檔 / zip、macOS dmg、Linux AppImage 的資產連結與版號給首頁 / 安裝頁使用；API 失敗時退回指向 `https://github.com/gowerlin/better-agent-terminal/releases` 並在 build log 警告（不得讓 build 失敗）。
4. **`.github/workflows/pages.yml`**：照 T0622 Q5-1 草案；action 版本實作時再確認最新 major 並沿用既有 workflow 的 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` 慣例（若適用）；`permissions` 頂層 `contents: read`，deploy job 才給 `pages: write` / `id-token: write`；`concurrency: pages`、`cancel-in-progress: false`。
5. 回報區附：本機 `npm run build` 輸出摘要、`npm run preview` 實際開啟的頁面清單（或以 `curl` 檢查各頁 200）、取到的最新版號與資產連結、`site/` 內部編號 grep 結果、`pages.yml` 全文、給塔台的「push 與啟用 Pages」步驟清單（指令逐行列出）。

## 驗收

- `site/` 內 `npm ci` + `npm run build` 0 錯誤、0 死連結（VitePress 預設檢查）
- 本機 preview：首頁、`/install`、`/compatibility`、`/releases` 皆可開啟，`base` 路徑正確（資源載入不 404）
- 首頁版號 = 最新 `v*` release（目前應為 `v0.7.0-pre.8`），四個下載連結指向正確資產
- `site/` grep 內部編號 / 路徑 = 0（include 的 README / `release-note.md` 原文除外，並說明）
- 根目錄不受影響：`npx vite build` 成功、`npm run typecheck` = 0（`site/` 不在 `tsconfig.json` include 內）
- 未 push、未改 GitHub 設定

## 塔台 DONE 後（不屬 Worker）

依 D160 授權：push → `gh api -X POST repos/gowerlin/better-agent-terminal/pages -f build_type=workflow` → `gh workflow run pages.yml -R gowerlin/better-agent-terminal`（或等 push 觸發）→ 確認 run 綠燈、`https://gowerlin.github.io/better-agent-terminal/` 回 200、`pre-release.yml` / `release.yml` 未被觸發。

---

## 回報區

### 結果摘要

**DONE**。`site/`（VitePress 1.6.4，獨立 package）建好四頁：首頁（hero、三個亮點、下載區）、`/install`、`/compatibility`（include README region）、`/releases`（include `release-note.md`）。build 時以 Releases API 取最新 `v*` release 產生四個下載連結，API 失敗退回 releases 列表並在 build log 警告（實測 401 時 build 照常成功）。新增 `.github/workflows/pages.yml`。本機 `npm ci` + `npm run build` 0 錯誤、preview 四頁與 dist 全部 36 個檔案 HTTP 200、瀏覽器 console 0 錯誤、搜尋可用。根目錄 `npx vite build` 成功、`npm run typecheck` = 0。**未 push、未改 GitHub 設定、未觸發 workflow**。

### 落地檢查

- **PASS**。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1 PASS。C-3：`site/**` 含萬用字元不測；`.github/workflows/pages.yml` 祖先 `.github/workflows/` 存在、`.gitignore` 存在 → present。C-2 無 `branch` 欄位。
- `CT_HOME` 未設定（非 worktree）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 檔案變更（commit `e2006ab3`）

| 檔案 | 內容 |
|---|---|
| `site/package.json` | `private: true`、`type: module`、scripts `dev` / `build` / `preview`、`devDependencies.vitepress` = `1.6.4`（確切版本）、`allowScripts` 只 `esbuild` |
| `site/package-lock.json` | lockfileVersion 3（npm 12.2.0 產生；含 `@esbuild/linux-x64`、`@rollup/rollup-linux-x64-gnu`，CI ubuntu 可用） |
| `site/.vitepress/config.mts` | async config：`base: '/better-agent-terminal/'`、`lang: 'zh-TW'`、title / description、`cleanUrls: true`、favicon、logo；nav / sidebar 只放本單三頁，W2 頁（features、remote、control-tower、faq、contribute）以 `TODO(W2)` 註解保留；zh-TW UI 字串 15 個 key（outline、docFooter、lastUpdated、notFound ×4、深淺色 ×3、sidebarMenuLabel、returnToTopLabel、langMenuLabel、skipToContentLabel 等）+ local search 翻譯 13 個 key；頁尾「以 MIT 授權釋出」（致謝留 `TODO(W2)`）；`themeConfig.latestRelease` 給元件用 |
| `site/.vitepress/latest-release.mts` | 取最新 release：`GH_TOKEN` → `GITHUB_TOKEN` → 匿名；`/repos/gowerlin/better-agent-terminal/releases?per_page=30`，取第一個非 draft 且 tag 符合 `^v\d` 的（自然排除 `server-bundle-v*`）；資產比對 `BetterAgentTerminal.Setup.*.exe`、`*-win.zip`、`*-arm64.dmg`、`*.AppImage`；HTTP 非 2xx / 網路錯誤 / 15 s 逾時 / 找不到 `v*` → 全部連結退回 releases 列表 + `[latest-release] WARNING` ；單一資產缺漏 → 該項指向該版 release 頁並警告。結果以 promise 快取，一次 build 只呼叫一次 API |
| `site/.vitepress/theme/index.ts`、`components/DownloadLinks.vue`、`custom.css` | 擴充預設主題，全域元件 `<DownloadLinks />`（版號 + 發佈日 + 四張下載卡片；取不到時顯示「請到 GitHub Releases 選擇最新的 `v*` 版本」） |
| `site/index.md` | `layout: home`；hero（名稱、標語、「下載最新版」→ `#download`、「GitHub」）；三亮點（多工作區 / 內建 Agent 面板 / 與 Control Tower 協作，CT 只寫概念）；`## 下載 {#download}` + `<DownloadLinks />`；截圖留 `TODO(W3)` 註解 |
| `site/install.md` | 下載安裝檔（`<DownloadLinks />` + 平台表）、macOS 首次執行、AppImage 執行權限、Agent CLI、從原始碼建置、資料存放位置、從舊版升級、除錯日誌、麥克風權限；使用者語氣，無內部編號 |
| `site/compatibility.md` | 一句說明 + `<!--@include: ../README.md#compatibility-->`（不複製表格） |
| `site/releases.md` | `<!--@include: ../release-note.md-->`（outline 只列 h2） |
| `site/public/logo.svg` | 複製自 `assets/icon.svg`（App 圖示，非截圖；nav logo / hero 圖 / favicon） |
| `README.md` | 只在「版本對照」的說明句與表格前後加 `<!-- #region compatibility -->` / `<!-- #endregion compatibility -->` 兩行註解（各帶一個空行），內容未改；GitHub 上不可見 |
| `.gitignore` | 加 `site/node_modules/`、`site/.vitepress/dist/`、`site/.vitepress/cache/`（前兩項其實已被根目錄的 `node_modules/`、`dist/` 涵蓋，照工單明列） |
| `.github/workflows/pages.yml` | 新增（全文見下） |

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `site/` `npm ci` | PASS | exit 0；無 install-script 警告（`allowScripts.esbuild` 生效，`@esbuild/win32-x64` 存在） |
| `site/` `npm run build` | PASS | `vitepress v1.6.4` … `build complete in 1.82s.`，0 錯誤；VitePress 預設死連結檢查未報任何死連結 |
| API 失敗退回 | PASS | `GH_TOKEN=invalid-token npx vitepress build --outDir <scratchpad>` → `[latest-release] WARNING: GitHub Releases API 回應 401 Unauthorized；下載連結改指向 https://github.com/gowerlin/better-agent-terminal/releases`，exit 0；首頁四個卡片皆指向 releases 列表 |
| preview（`npm run preview -- --port 4173`）頁面 | PASS | `curl`：`/` 200、`/install` 200、`/compatibility` 200、`/releases` 200、`/logo.svg` 200（`/nonexistent` 404 為預期） |
| `base` 路徑 / 資源 | PASS | 四頁引用的資源全部在 `/better-agent-terminal/` 之下；dist 內全部 36 個檔案逐一 `curl` → non200 = 0；瀏覽器（chrome-live 隔離 context）四頁 `performance` resource 皆 200、console 0 則 |
| 搜尋 | PASS | 瀏覽器開啟搜尋框 placeholder「搜尋」，查「除錯日誌」→ `/better-agent-terminal/install#除錯日誌`、`#資料存放位置`；鍵盤提示「切換 / 選擇 / esc 關閉」 |
| 首頁版號與下載連結 | PASS | 取到 **`v0.7.0-pre.8`**（匿名呼叫，2026-10-18 發佈），四個連結：<br>`https://github.com/gowerlin/better-agent-terminal/releases/download/v0.7.0-pre.8/BetterAgentTerminal.Setup.0.7.0-pre.8.exe`<br>`https://github.com/gowerlin/better-agent-terminal/releases/download/v0.7.0-pre.8/BetterAgentTerminal-0.7.0-pre.8-win.zip`<br>`https://github.com/gowerlin/better-agent-terminal/releases/download/v0.7.0-pre.8/BetterAgentTerminal-0.7.0-pre.8-arm64.dmg`<br>`https://github.com/gowerlin/better-agent-terminal/releases/download/v0.7.0-pre.8/BetterAgentTerminal-0.7.0-pre.8.AppImage`<br>（檔名與 T0622 實測的 pre.8 資產名稱一致） |
| `/compatibility` include | PASS | 產出含 `<table` 與「收單後自動回收 Worker 分頁」，不含 README 該節前一段（`docs/agent-guide`、`CLAUDE.md` 那句）；`region` 字樣 0 |
| `/releases` include | PASS | h1「Release Notes — Better Agent Terminal（gowerlin fork）」、43 個 h2（第一個 `v0.7.0-pre.8（2026-10-18）`、最後 `上游歷史（tony1223/better-agent-terminal v2.1.x）`） |
| 內部編號 grep（`site/` 原始碼，排除 node_modules / dist） | PASS = 0 | `grep -rnE 'T0[0-9]{3}\|D1[0-9]{2}\|_ct-workorders\|CLAUDE\.md\|BUG-[0-9]+\|PLAN-[0-9]+'` → 無結果 |
| 內部編號 grep（產出） | 說明 | `index.html` / `install.html` / `compatibility.html` = 0；`releases.html` 有 101 處 `T0\d{3}` / `D1\d{2}` / `_ct-workorders` / `CLAUDE.md`，與 `release-note.md` 原文的 101 處相同，全部來自 include 的原文（工單允許的例外）。`compatibility` 的 README 原文含「斷點 D」（非編號格式） |
| 不含舊截圖 | PASS | `site/` 未引用 `assets/screenshot-*.png` |
| 根目錄 `npx vite build` | PASS | exit 0（`dist-electron/terminal-server.js … built in 12ms`） |
| 根目錄 `npm run typecheck` | PASS = 0 | exit 0；`site/` 不在 `tsconfig.json` `include`、不在 vitest `include` |
| `pages.yml` YAML | PASS | `js-yaml` 解析成功，jobs `build` / `deploy`，deploy permissions `{"pages":"write","id-token":"write"}` |
| 未 push / 未改 GitHub 設定 | PASS | `gh` 只做唯讀查詢（`repos/actions/*/releases/latest`、action.yml） |

`npm audit`（`site/`）：3 項（esbuild moderate GHSA-67mh-4wv8-2f99、vite high GHSA-4w7w-66w2-5vf9 / GHSA-fx2h-pf6j-xcff / launch-editor GHSA-v6wh-96g9-6wx3、vitepress moderate），全部屬於 dev / preview server，VitePress 1.6.4 無修正版（`No fix available`）。部署的是靜態產物，不影響網站；本機只在需要時短暫開 dev / preview。

### `pages.yml` 與 T0622 草案的差異

- action 版本（2026-10-18 唯讀 `gh api` 查證）：`actions/checkout@v7`（v7.0.1）、`actions/setup-node@v7`（v7.1.0）—— 草案寫 v6，改為與既有 `release.yml` / `pre-release.yml` 一致的 v7；`configure-pages@v6`（v6.0.0）、`upload-pages-artifact@v5`（v5.0.0）、`deploy-pages@v5`（v5.0.1）與草案相同。
- **未加 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`**：查 action.yml，`configure-pages` v6 / `deploy-pages` v5 皆 `using: 'node24'`，`upload-pages-artifact` v5 是 composite（內部 `actions/upload-artifact` v7.0.0），checkout / setup-node v7 也已是既有 workflow 不帶該變數使用的版本；該變數只在 `build-server-bundle.yml` 用於強制舊 node20 action，本 workflow 不適用。
- 加了註解與 step 名稱；其餘（觸發 paths、頂層 `contents: read`、`concurrency: pages` / `cancel-in-progress: false`、deploy job 才給 `pages: write` / `id-token: write`、`github-pages` 環境）照草案。

```yaml
name: Pages

# 專案站 https://gowerlin.github.io/better-agent-terminal/（VitePress，原始碼在 site/）
# 頁面直接 include README.md 的版本對照與 release-note.md，所以這兩個檔案變更時也重建。
on:
  push:
    branches: [main]
    paths:
      - 'site/**'
      - 'README.md'
      - 'release-note.md'
      - '.github/workflows/pages.yml'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: '24'
          cache: npm
          cache-dependency-path: site/package-lock.json

      - name: Install site dependencies
        run: npm ci
        working-directory: site

      - name: Build site
        run: npm run build
        working-directory: site
        env:
          # build 時讀 Releases API 取最新 v* 版的下載連結；失敗時退回 releases 列表，不讓 build 失敗
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/configure-pages@v6

      - uses: actions/upload-pages-artifact@v5
        with:
          path: site/.vitepress/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

### 給塔台：push 與啟用 Pages（依 D160 授權，Worker 未執行）

```bash
# 0. 確認要 push 的 commit（本單產品 commit e2006ab3 + 工單 commit）
git log --oneline origin/main..main

# 1. 先啟用 Pages（Source = GitHub Actions）；先啟用可避免 push 觸發的第一次 run 在 deploy 失敗
gh api -X POST repos/gowerlin/better-agent-terminal/pages -f build_type=workflow
gh api repos/gowerlin/better-agent-terminal/pages --jq '{build_type, html_url, status}'

# 2. push（pages.yml 與 site/** 在 paths 內 → 自動觸發 Pages workflow）
git push origin main

# 3. 找到這次的 run 並等它結束
gh run list -R gowerlin/better-agent-terminal --workflow pages.yml --limit 3
gh run watch -R gowerlin/better-agent-terminal <run-id> --exit-status
#    若 push 未觸發（例如 paths 未命中），改手動：
#    gh workflow run pages.yml -R gowerlin/better-agent-terminal

# 4. 驗證站台與版號
curl -sI https://gowerlin.github.io/better-agent-terminal/ | head -1
for p in install compatibility releases; do curl -s -o /dev/null -w "%{http_code} $p\n" https://gowerlin.github.io/better-agent-terminal/$p; done
curl -s https://gowerlin.github.io/better-agent-terminal/ | grep -o 'v0.7.0-pre.8' | head -1

# 5. 確認 release 線未被觸發（這次 push 之後不應有新 run）
gh run list -R gowerlin/better-agent-terminal --workflow pre-release.yml --limit 2
gh run list -R gowerlin/better-agent-terminal --workflow release.yml --limit 2
```

- 若步驟 1 回 409 / 422（例如 fork 限制或已啟用），改到網頁 Settings → Pages → Source 選 GitHub Actions 後再繼續。
- 若 run 的 build log 出現 `[latest-release] WARNING`，網站仍會部署，但下載連結指向 releases 列表；檢查 `GH_TOKEN` 權限後 `gh workflow run pages.yml -R gowerlin/better-agent-terminal` 重跑。

### 偏離 / 備註

- 「下載最新版」按鈕連到首頁 `#download` 區（版號 + 四個平台卡片），不是直接連單一資產；讓使用者自己選平台。
- `/install` 未收錄 README「方式三：快速安裝腳本」：`install.sh` 呼叫 `https://api.github.com/repos/gowerlin/better-agent-terminal/releases/latest`，本 fork 沒有正式版，該 API 回 404（T0622 實測），腳本目前無法使用，不宜上站。
- 本機 `vitepress preview` 啟動時建檔案索引，重新 build 後須重啟 preview，否則新雜湊檔名 404（驗證時遇到，已重啟後重驗，非站台問題）。
- `src/styles/settings.css`、`_ct-workorders/T0626-…` 的 M 不是本單變更，未碰。

### 後續建議（範圍外，供塔台）

- `install.sh` 與 README「下載最新版本」都依賴 `/releases/latest`，在無正式版的本 fork 失效；可改用與 `latest-release.mts` 相同的「取最新 `v*`」邏輯（W4 或另開工單）。
- W4 加 lychee 時，可順便掃 `releases.html`（include 的 release-note 有大量外部連結）。

### 互動紀錄

- 無（未向塔台提問）。

### Commit

- 產品：`e2006ab3` feat(site): VitePress project site scaffold and Pages workflow (T0624)
- 工單：本檔以 `git commit --only` 提交（hash 見 git log）。未 push。
