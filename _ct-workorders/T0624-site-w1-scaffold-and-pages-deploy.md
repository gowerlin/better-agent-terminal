---
schema_version: 1
schema_kind: workorder
id: T0624
title: "PLAN-049 W1：VitePress 站台骨架（`site/`）與 GitHub Pages 部署 workflow（`pages.yml`）"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T12:29:42+0800"
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

（Worker 填寫）
