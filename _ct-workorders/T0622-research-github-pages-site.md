---
schema_version: 1
schema_kind: workorder
id: T0622
title: "研究：PLAN-049 GitHub Pages 介紹 BAT + Control Tower（站台位置、技術選型、內容盤點、CT 公開範圍建議）"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T12:17:23+0800"
started_at: "2026-10-18T12:18:10+08:00"
updated_at: "2026-10-18T12:23:35+08:00"
completed_at: "2026-10-18T12:23:35+08:00"
depends_on: []
related:
  - "PLAN-049（動機、已知約束、待研究 1–6）"
  - "`_ct-workorders/_local-rules.md`「發佈後同步 repo 文件」（README「與 BMad Control Tower 協作」章節、CT 未開源不放取得連結）、「更版重點」（D153 歡迎協助測試）"
  - "並行：T0621（主 checkout 改 electron / src / scripts / docs/agent-guide / CLAUDE.md）—— 本單不改任何產品檔，無重疊"
affects_files:
  - _ct-workorders/T0622-research-github-pages-site.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：**不改任何產品檔、不建立 Pages 設定、不新增 workflow、不建分支、不 push、不呼叫任何會改 GitHub 設定的 `gh` 指令**（唯讀查詢可以，且一律帶 `-R gowerlin/better-agent-terminal`，L122）。原型或草稿放系統暫存目錄 / scratchpad，不得寫進 repo。只 commit 本工單檔（`git commit --only`）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 CT 維持未開源（使用者 2026-10-17 指示）：研究中不得把 CT 的內部 repo 位置、skill 檔內容或取得管道寫進任何對外草稿；CT 怎麼呈現只提出選項，由使用者決定。"
  - "🔴 yolo Worker：不得問使用者；範圍內無法決定且猜錯會返工的選擇，依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。屬使用者偏好的選擇（品牌、網域、CT 公開範圍）不要問，列成選項＋建議交回。"
---

# T0622 — 研究：GitHub Pages 介紹 BAT + Control Tower

## 目標

為 PLAN-049 產出可直接拿來決策的研究結論：網站放哪裡、用什麼做、放什麼內容、怎麼部署與維護，以及 CT 在網站上怎麼呈現的選項。

## 要回答的問題

### Q1 — 站台位置

比較：使用者站 `gowerlin.github.io`（新 repo，BAT / CT 為其中一區）vs 專案站 `gowerlin.github.io/better-agent-terminal`（本 repo `/docs` 資料夾、`gh-pages` 分支、或 GitHub Actions 部署）。各自的設定步驟、URL、與本 repo 的耦合（會不會影響 release workflow、`docs/` 現有內部文件會不會被公開）、自訂網域的做法與成本。現況查證：`gowerlin.github.io` 是否已存在、本 repo 的 Pages 是否已啟用（唯讀查詢）。

### Q2 — 技術選型

至少比較 VitePress、Astro（Starlight）、純 HTML / 單頁。面向：與現有 Markdown（README、`docs/agent-guide/`、`release-note.md`）的相容、i18n（繁中為主，是否做英文）、建置與部署（GitHub Actions 官方 Pages action）、外觀與首頁行銷能力（hero、截圖、GIF）、搜尋、維護成本。標明版本與查證日期。給出推薦。

### Q3 — 內容盤點

1. 盤點 README、`CHANGELOG.md`、`release-note.md`、`docs/`（含 `docs/agent-guide/` 各檔）：哪些適合公開給使用者、哪些是內部開發文件（工單編號、內部決策、測試細節）不該上站。列表呈現。
2. 建議的網站資訊架構（首頁 / 功能 / 安裝 / BAT × CT 協作 / 版本對照 / FAQ / 回報與協助測試），每頁的內容來源。
3. 素材：需要哪些截圖 / GIF（例如塔台派工 → Worker → 回收、縮圖狀態 `?` / `✓`、BAT MCP），可行的產生方式（例如既有 playwright e2e 截圖、手動錄製），以及隱私注意（不得出現權杖、使用者路徑）。

### Q4 — CT 的呈現方式（只提選項）

CT 未開源。列出 2–4 種呈現方式（例如：只介紹概念與 BAT 整合點、不提取得方式／介紹並附「洽詢」管道／只寫 BAT，CT 一句帶過…），各自的推廣效果與風險，給建議但標明由使用者決定。

### Q5 — 部署、同步與維運

1. 部署 workflow 草案（Actions、觸發條件、權限 `pages: write` / `id-token: write`），確認與 `pre-release.yml` / `release.yml` 互不影響。
2. 發版時網站如何同步（下載連結、版本號、更版重點）：手動、併入現有「發佈後同步 repo 文件」步驟，或由 workflow 自動讀 GitHub Releases。
3. SEO / OG 卡片、連結檢查、分析（是否需要、隱私）。

### Q6 — 建議與實作切分

推薦方案（站台位置 + 技術 + 內容範圍 + 部署方式），實作切分成幾張工單、每張的範圍與驗收、預估工作量；需要使用者決定的事項列成選項清單。

## 交付

- 回報區：Q1–Q6 逐題作答，結論標證據等級（`官方文件` / `實測` / `推論`），外部來源附連結與查證日期。
- 需要使用者決定的事項集中一節。
- 不改產品檔；完成後送 `T0622 完成`。

## 塔台補充（使用者已決定，2026-10-18T12:18:20+0800）

> 派工後使用者決定了兩項（D159），請據此調整，不必再比較：
> - **Q1 站台位置 = 專案站 `gowerlin.github.io/better-agent-terminal`**（本 repo 部署）。Q1 改為研究這個方案的具體做法：`/docs` 資料夾 vs `gh-pages` 分支 vs Actions 部署的選擇、與現有 `docs/` 內部文件如何隔離（例如網站原始碼放獨立目錄）、對 release workflow 的影響。
> - **Q4 CT 呈現方式 = 只介紹 CT 的概念與它跟 BAT 的整合點**（不提供取得管道）。Q4 改為：列出可公開的概念與整合點清單（參照 README「與 BMad Control Tower 協作」章節），以及寫法上要避開的內容。
> - （2026-10-18T12:20:17+0800 追加）**技術選型、截圖 / GIF、部署方式**：使用者授權由塔台依本單建議決定 → Q2、Q3-3、Q5-1 請給**單一明確推薦**與理由（比較表保留），塔台直接採用。
> - **內容來源與同步**：README / CHANGELOG / release-note 與使用者向的文件**可公開、可同步**；**發版時一起更新網站**（D159）→ Q5-2 請設計成併入現有「發佈後同步 repo 文件」步驟（或由 workflow 自動完成），並說明塔台每次發版要多做什麼。Q3-1 仍要列出不該上站的內部開發內容（工單編號、內部決策、測試細節）。

---

## 回報區

### 結果摘要

**推薦方案**：在本 repo 建**專案站** `https://gowerlin.github.io/better-agent-terminal/`，原始碼放新的頂層目錄 `site/`（**不用** `docs/`），以 **VitePress 1.6.4** 建置、**獨立的 GitHub Actions workflow `pages.yml`** 部署（Pages source = GitHub Actions）。繁中為主、先不做英文。內容以 README 與 `release-note.md` 為主，`docs/` 只取遠端部署指南改寫，`docs/agent-guide/` 不直接上站。CT 建議採「介紹概念與 BAT 整合點、不提取得方式」（選項 B，由使用者決定）。實作切 4 張工單（約 M + M + M + S）。

證據等級：`官方文件`（附連結，查證日 2026-10-18）/ `實測`（本機指令或唯讀 `gh` 查詢，2026-10-18）/ `推論`。

### 落地檢查

- **PASS**。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1 PASS。C-3 不適用（`affects_files` 只有本工單）。C-2 無 `branch` 欄位。
- `CT_HOME` 未設定（非 worktree 派工）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 現況查證（唯讀，全部帶 `-R` / 明確 repo 路徑）

| 項目 | 結果 | 證據 |
|---|---|---|
| 本 repo 可見性 | `PUBLIC`，`isFork: true`（parent = `scandnavik/better-agent-terminal`），`homepageUrl` 空 | 實測 `gh repo view gowerlin/better-agent-terminal` |
| 本 repo Pages | **未啟用**（`GET repos/gowerlin/better-agent-terminal/pages` → 404） | 實測 |
| 使用者站 repo `gowerlin/gowerlin.github.io` | **不存在**（GraphQL: Could not resolve），Pages 亦 404 | 實測 |
| `gowerlin` 帳號 | `type: User`，`blog` 空；`gh repo list gowerlin` 只有 `better-agent-terminal`、`openusage`（皆 public fork） | 實測 |
| 既有 workflow | `pre-release.yml`（`workflow_dispatch`）、`release.yml`（push `v*` tag）、`build-server-bundle.yml`（`workflow_dispatch` / push `feature/plan-007-remote-dev` / `server-bundle-v*` tag）；三者皆無 `concurrency`、權限只有 `contents: write`；**沒有任何 workflow 引用 `docs/`** | 實測 grep |
| Release 建立方式 | 兩條線都用 `softprops/action-gh-release@v3` + `GITHUB_TOKEN` | 實測 grep（`pre-release.yml:294`、`release.yml:285`） |
| 正式版 release | **0 個**（全部 `prerelease: true`）；`GET releases/latest` → 404；網頁 `…/releases/latest` 302 → `…/releases`（列表），且列表最上面是比 desktop 晚 ~30 s 發佈的 `server-bundle-v0.7.0-pre.8` | 實測 `gh api`、`curl -sI` |
| 安裝檔資產名稱（pre.8） | `BetterAgentTerminal.Setup.0.7.0-pre.8.exe`、`BetterAgentTerminal-0.7.0-pre.8-win.zip`、`BetterAgentTerminal-0.7.0-pre.8-arm64.dmg`、`BetterAgentTerminal-0.7.0-pre.8.AppImage` | 實測 `gh release view` |
| 既有截圖 `assets/screenshot-*.png` | 4 張 1200×765，2026-04 來自上游：視窗標題「Better Terminal」、模型 `claude-opus-4-6`、畫面含上游作者本機路徑 `/Users/tonyqwang/.ssh/…` 與上游 git remote | 實測（檢視 `assets/screenshot-claude.png`） |
| `_ct-workorders/` | 已在公開 repo 追蹤（`.gitignore` 註明 default-public engineering log） | 實測 |

### Q1 — 站台位置

| 面向 | A. 使用者站 `gowerlin.github.io`（新 repo） | B. 專案站（本 repo，Actions 部署）⭐ | C. 專案站（本 repo，branch `/docs` 資料夾） | D. 專案站（`gh-pages` 分支） |
|---|---|---|---|---|
| URL | `https://gowerlin.github.io/` | `https://gowerlin.github.io/better-agent-terminal/` | 同 B | 同 B |
| 設定步驟 | 建 repo `gowerlin.github.io` → Pages source 設 Actions → 加 workflow | Settings → Pages → Source = GitHub Actions → 加 `pages.yml` | Source = Deploy from branch `main` `/docs` | 建孤兒分支、推建置產物 |
| 與本 repo 耦合 | 無；但下載連結、版本號、更版重點要跨 repo 取（Releases API 或複製） | 只多一個 workflow 與 `site/` 目錄；與 release workflow 互不相干（見 Q5） | 🔴 **`docs/` 全部會被 Jekyll 渲染公開成網頁**（含 `docs/agent-guide/` 內部契約、`plan-007-release-checklist.md`） | 分支要維護、產物進 git 歷史 |
| 內容同步 | 難（跨 repo） | 易（同 repo，可直接讀 `README.md` / `release-note.md`） | 易 | 中 |
| 個人品牌延伸 | ✅ 可放多個專案 | 之後再加使用者站即可：使用者站設自訂網域時，專案站自動沿用該網域（`<domain>/better-agent-terminal`） | 同 B | 同 B |
| 結論 | 適合「個人網站」需求；目前帳號只有本專案，先建反而多一個 repo 要維護 | **推薦** | ❌ 不建議 | ❌ 不建議（Actions 已取代） |

- 每個帳號只能有 1 個使用者站、每個 repo 1 個專案站；使用者站 repo 必須命名為 `<owner>.github.io`（`官方文件` [About GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)）。
- 限制：發佈站 ≤ 1 GB、部署 10 分鐘逾時、頻寬軟上限 100 GB / 月；「10 builds/hour」軟上限**不適用於自訂 Actions workflow**；不得作為商業交易 / SaaS 網站（介紹開源工具不受影響）（`官方文件` [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)）。
- Fork 能否開 Pages：本 repo 是 public fork，Actions 已在跑 release workflow；GitHub 對 public repo（含 fork）提供 Pages（`推論`，官方頁未特別排除 fork；實作工單第一步以啟用結果實測）。
- **自訂網域**（`官方文件` [About custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)）：建議用 `www` 子網域（CNAME），apex 用 A / ALIAS；使用者站設了自訂網域後「同帳號的所有專案站都會使用該網域」，可在個別 repo 覆寫；建議**先驗證網域**再設定，否則 Pages 停用後有 domain takeover 風險。成本：GitHub 端免費，只有網域註冊費（`推論`：一般 .com / .dev 年費約 US$10–20，依註冊商）。專案站也可單獨設子網域（例如 `bat.<domain>`），此時 VitePress `base` 改回 `/`。
- 影響評估：B 只發佈 `site/` 的**建置產物**；`docs/` 不會因此公開成網頁（它本來就在公開 repo 可被瀏覽，但不會被索引成站）（`推論`，依 upload-pages-artifact 只上傳指定 `path`）。

### Q2 — 技術選型

版本查證 2026-10-18（`實測` `npm view` / `gh api`）：

| 項目 | 版本 / 日期 |
|---|---|
| VitePress | `latest` = **1.6.4**（發佈於 2025-08-05）；`next` = 2.0.0-alpha.20（2026-09-04） |
| Astro | **7.4.0**（2026-10-15）；`engines.node >= 22.22.0` |
| Starlight `@astrojs/starlight` | **0.42.6**（2026-10-08），peer `astro ^7.2.10` |
| Pagefind | 1.5.2 |
| `actions/deploy-pages` / `upload-pages-artifact` / `configure-pages` | v5.0.1（2026-09-01）/ v5.0.0（2026-04-10）/ v6.0.0（2026-03-25） |
| `lycheeverse/lychee-action` | v2.9.0（2026-07-09） |

| 面向 | VitePress 1.6.4 ⭐ | Astro 7 + Starlight 0.42 | 純 HTML / 單頁 |
|---|---|---|---|
| Markdown 相容 | 標準 Markdown + GFM 表格、程式碼區塊、`::: tip` 容器；README / release-note 可直接 include 或複製 | 同等（MDX 亦可）；frontmatter 需要 `title` | 需自己轉換或手寫 |
| i18n | `locales`（root = 繁中，`lang: 'zh-TW'`）；**主題 UI 字串需手動翻譯**（`官方文件` [VitePress i18n](https://vitepress.dev/guide/i18n)） | `locales` root；**內建 zh-TW UI 字串**、未翻譯頁自動顯示預設語言並加提示（`官方文件` [Starlight i18n](https://starlight.astro.build/guides/i18n/)） | 自己做 |
| 搜尋 | 內建 local search（MiniSearch），中文以 `Intl.Segmenter` 斷詞，可設 locale 翻譯（`官方文件` [VitePress search](https://vitepress.dev/reference/default-theme-search)） | 內建 Pagefind；中文斷詞需 Pagefind extended 版（`npx pagefind` 預設即 extended）（`官方文件` [Pagefind multilingual](https://pagefind.app/docs/multilingual)；Starlight 經 npm 呼叫是否為 extended：`推論`，需 PoC） | 無 |
| 首頁行銷（hero、截圖、影片） | 預設主題 `layout: home` 有 hero / features；可嵌 Vue 元件 | splash 模板 + Astro 元件，版面彈性最高 | 完全自由，但全手工 |
| 部署 | 官方 GitHub Pages workflow 範例（`官方文件` [VitePress deploy](https://vitepress.dev/guide/deploy)）；專案站須設 `base: '/better-agent-terminal/'` | 官方 Pages 指南 + `withastro/action`；`site` / `base` 設定 | 直接上傳 |
| 維護成本 | 低；與本 repo 同為 Vite 生態（本 repo 用 Vite 7）；本機有 `vitepress-book` skill | 中；Astro 7 / Starlight 0.x 迭代快（Starlight 仍 0.x，升版常有破壞性變更：`推論`） | 長期最高（每次發版手改 HTML） |
| 風險 | 1.x 最後一版已一年多，2.0 仍 alpha（`實測` 發佈日）；屬穩定維護期，對文件站影響小（`推論`） | node ≥ 22.22 要求（CI 用 node 24 無礙） | — |

**推薦 VitePress 1.6.4**：繁中單語起步時 UI 字串只需翻一次（約 20 個 key），local search 中文斷詞開箱即用，Vite 生態與 `vitepress-book` skill 降低維護成本。若日後確定要做英文雙語且重視「未翻譯頁自動回退」，Starlight 是次選。

### Q3 — 內容盤點

#### 3-1 公開 / 內部分類

| 檔案 | 讀者 | 上站方式 | 理由 |
|---|---|---|---|
| `README.md` | 使用者 | ✅ 主要來源（首頁、功能、安裝、BAT × CT、版本對照、授權 / 致謝） | 已是對外文件；「架構 / 技術堆疊 / 發行」三節偏 contributor，改放「開發者」頁或只連回 GitHub |
| `release-note.md` | 使用者 | ✅ 「更版紀錄」頁（直接 include） | 依 `_local-rules.md`「更版重點」為寫給使用者的繁中內容；含 BUG / PLAN 編號屬可接受（可追 issue） |
| `CHANGELOG.md` | 開發者 | ⚠️ 只連回 GitHub 原檔 | 含大量 T / D 編號與實作細節 |
| `docs/remote-dev-overview.md` | 使用者（英文） | ⚠️ 改寫後上「遠端開發」頁 | 內容對使用者有用，但 T / BUG / D 引用 32 處需清除 |
| `docs/wsl-deployment.md` / `ssh-deployment.md` / `docker-deployment.md` | 使用者（英文） | ⚠️ 改寫（翻繁中、清 9 / 1 / 7 處內部編號）後上站 | 部署指南 |
| `docs/server-bundle-distribution.md` | contributor | ❌；只摘「離線匯入 tarball」成 FAQ | 41 處內部編號，講發佈管線 |
| `docs/plan-007-release-checklist.md`、`docs/plan-027-cross-platform-verification.md` | 內部 | ❌ | 發版檢查清單 / 驗證 playbook |
| `docs/design/bat-stepper-design-language.md`、`wizard-error-ux.md` | 內部 | ❌（可當網站配色 / 語氣參考） | 設計規範 |
| `docs/agent-guide/README.md` 與其他 25 篇 | 開發者 / Agent | ❌ 不直接上站 | 皆為 CLAUDE.md 搬出的契約原文，每篇內部編號 8–94 處、含實作檔名、驗證清單、歷史原因 |
| ↳ 其中 CT 整合 10 篇（`worker-tab-recycle`、`tower-tab-title`、`remote-tower-notify`、`worktree-isolated-dispatch`、`worktree-status`、`helper-query-channels`、`bat-mcp-shim`、`blocked-state`、`worker-launch-confirmation`、`tower-questions`） | — | ⚠️ 素材：改寫成一頁「BAT × CT 整合參考」（指令、參數、exit code、使用者看得到的行為），不搬工單 / 決策編號與實作位置 | 契約本身已在 README 公開層級 |
| ↳ `usage-limit-continue`、`terminal-context-menu`、`logging`（日誌位置）、`claude-agent-sdk-cli`（CLI 太舊錯誤）、`remote-security`（TOFU、bind interface） | — | ⚠️ 素材：改寫成功能頁段落或 FAQ | 使用者會遇到的行為 |
| ↳ 其餘（`build-toolchain`、`npm12-install-scripts`、`packaging-release-checks`、`release`、`detached-workspace`、`dialog-close-and-escape`、`pty-process-tree`、`recovery-create-hold`、`multi-remote-profiles`、`workspace-agent-launch`） | 開發者 | ❌（`multi-remote-profiles`、`workspace-agent-launch` 可摘一兩句進功能頁） | 純實作規則 |
| `AGENTS.md`、`CLAUDE.md`、`PLAN.md`、`project-context.md`、`_ct-workorders/` | Agent / 內部 | ❌ | — |

統計來源：`實測`（`grep -oE 'T0[0-9]{3}|BUG-[0-9]+|D1[0-9]{2}'` 逐檔計數）。

#### 3-2 資訊架構

| 頁面 | 路徑 | 內容來源 |
|---|---|---|
| 首頁 | `/` | README 標頭（價值主張、支援的 Agent）、新截圖 / 短片、三個亮點（多工作區 / 內建 Agent 面板 / 與 CT 協作）、**下載按鈕（build 時取最新 `v*` release，見 Q5-2）** |
| 功能 | `/features` | README「功能特色」各小節 + 近期 release-note 新功能（Worker 縮圖、用量限制自動繼續等） |
| 安裝 | `/install` | README「快速開始」三種方式、平台說明（macOS 僅 Apple Silicon，D136）、「從舊版升級」、語音輸入權限、除錯日誌位置 |
| 遠端開發 | `/remote/`（overview、wsl、ssh、docker） | `docs/remote-dev-overview.md` + 三份部署指南（改寫繁中、清內部編號） |
| BAT × Control Tower | `/control-tower` | README「與 BMad Control Tower 協作」（協作流程圖、整合點表）改寫成使用者流程；呈現程度依 Q4 |
| 整合參考（選用） | `/control-tower/reference` | agent-guide CT 10 篇的公開契約層（指令、exit code、狀態欄位） |
| 版本對照 | `/compatibility` | README「版本對照」表（單一來源：直接 include README 段落或抽成共用 Markdown） |
| 更版紀錄 | `/releases` | `release-note.md`（include），每版連到 GitHub Release |
| FAQ | `/faq` | 日誌在哪、`claude_code_version_too_old` 錯誤、Shift + 右鍵、macOS Intel 不支援、離線匯入 server bundle、Recovery 提示 |
| 回報與協助測試 | `/contribute` | GitHub Issues 連結、`_local-rules.md` D153「歡迎協助測試」步驟（Codex 使用者）、回報需附資訊 |
| 頁尾 | — | MIT 授權、致謝上游（tony1223、scandnavik 與原始貢獻者，來自 README「致謝」） |

#### 3-3 素材

| 素材 | 形式 | 產生方式 |
|---|---|---|
| 主畫面總覽（多工作區 + 分頁 + Agent 面板 + 狀態列） | PNG | Playwright（見下） |
| 塔台派工 → Worker 執行 → 回報 → 分頁回收 | 短片 MP4 / WebM（15–30 s） | Playwright `recordVideo` 或手動錄製 |
| Worker 縮圖 ⚠️ / `?` / `✓` 與「關閉已回報的 Worker 分頁（N）」 | PNG 特寫 | Playwright（`e2e/t0609-worker-attention-badge.spec.ts` 已有同場景截圖：`question-badge.png`、`blocked-and-question-badges.png`、`batch-close-confirm.png`） |
| Worker 問塔台（通知 + 答覆） | PNG / 短片 | 參考 `e2e/t0611-tower-question.spec.ts` |
| BAT MCP（`bat_whoami` / `bat_list_terminals` 結果） | PNG | 手動（需真實 claude 分頁）或以 helper 輸出排版成程式碼區塊（不需截圖） |
| worktree 隔離派工 | PNG | 參考 `e2e/t0583-worktree-isolated-dispatch.spec.ts` |
| 遠端 profile / 設定精靈 | PNG | 參考 `e2e/pre6-wizard-acceptance.spec.ts`、`t0512-profile-panel-layout.spec.ts` |
| OG 卡片 | 1200×630 PNG | 由 `assets/icon.svg` + 標語手工製作一次 |

- **產生方式**：既有 e2e 以 `e2e/fixtures/electron-isolation.ts` 啟動隔離實例（temp userData、`--runtime=<id>`），多支 spec 已呼叫 `win.screenshot()`（`實測` grep：t0538、t0609 等 20 支）。建議新增**手動執行、不進 CI** 的 `e2e/site-media.spec.ts`：固定視窗尺寸、建立示範工作區（temp 目錄、虛構專案名）、以 `bat-terminal.mjs` / `bat-notify.mjs` 驅動狀態（不需真實 Agent 登入），輸出到 `e2e-results/`（已在 `.gitignore`）再人工挑選。Playwright `electron.launch()` 支援 `recordVideo`（`實測`：本機 `playwright-core` 1.59.1 型別定義 `Electron.launch` options 含 `recordVideo`），輸出 WebM，可用 ffmpeg 轉 MP4；**建議用 `<video autoplay muted loop>` 取代 GIF**（體積小一個數量級：`推論`）。真實 Agent 對話畫面（Claude 面板）需手動錄製（ScreenToGif / OBS）。
- **隱私檢查清單**（每張素材上站前逐項看）：
  1. 不得出現權杖：`BAT_REMOTE_TOKEN`（`batcap.…`）、`server-token.json` 內容、Settings → Remote 的 token / QR code、`env` / `Get-ChildItem Env:` 輸出。
  2. 不得出現使用者路徑與帳號：`C:\Users\<name>`、`/Users/<name>`、`/home/<name>`、git user / email、Claude 帳號 email、狀態列的用量 / 費用（可留但需確認）。
  3. 不得出現私人 repo 名稱、工作區名稱、內部工單內容；示範一律用虛構專案（例如 `demo-shop`）與 temp 目錄。
  4. CT：畫面中的 skill 名稱可出現（README 已公開），但不得出現 CT 安裝路徑、skill 檔內容或取得管道（Q4）。
  5. 既有 `assets/screenshot-*.png` **不要沿用**：為上游舊 UI（標題「Better Terminal」），且含上游作者路徑 `/Users/tonyqwang/.ssh/…`（`實測`）。README 是否同步換圖列為選項（見待決事項）。

### Q4 — CT 的呈現方式（只提選項，由使用者決定）

| 選項 | 內容 | 推廣效果 | 風險 / 成本 |
|---|---|---|---|
| A. 只寫 BAT，CT 一句帶過 | 「BAT 可與檔案驅動的多 Agent 流程整合（例如 BMad Control Tower）」 | 最弱：BAT 最有差異化的塔台 / Worker 功能看不出用途 | 最低 |
| **B. 介紹概念與 BAT 整合點，不提取得方式**（建議） | 與現行 README 同級：塔台 / Worker 概念、流程圖、BAT 整合點、版本對照；FAQ 固定一句「Control Tower 目前未公開」 | 中高：讀者看得懂 BAT 的協作功能為何存在，也能理解 helper 指令可接自己的流程 | 低：不新增比 README 更多的曝光；會有人問「去哪拿」，以 FAQ 統一回答 |
| C. B + 洽詢 / 試用管道 | 加「想試用 CT？」→ GitHub Discussions / issue 範本 / email | 最強：可收集有興趣的使用者、找測試者 | 等同半公開散佈，需先定散佈與授權政策；回覆負擔；Pages 本身不能收表單（需第三方或 GitHub issue） |
| D. 把 BAT 整合介面當「通用協作介面」公開，CT 只是參考實作 | 整合參考頁寫成通用契約（派工、回報、回收、問答、狀態查詢），CT 作為範例 | 吸引想自建流程的進階使用者 | 契約文件要長期維護成對外 API 承諾；CT 細節更容易被反推 |

- 共同前提：本 repo 已公開追蹤 `_ct-workorders/`、README 已列 CT skill 名稱與 helper 指令（`實測`）；網站不會增加「取得管道」層面的暴露，但會**放大曝光度**（搜尋引擎可找到）。
- 建議 **B**：與既有 README 規則一致（CT 未開源、不放取得連結），維護成本最低；日後若決定開放，再升級為 C 只需加一個區塊。**由使用者決定。**

### Q5 — 部署、同步與維運

#### 5-1 部署 workflow 草案（`.github/workflows/pages.yml`，實作工單再建立）

```yaml
name: Pages

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
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: site/package-lock.json
      - run: npm ci
        working-directory: site
      - run: npm run build
        working-directory: site
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}   # build 時讀 Releases API 取最新 v* 版
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

- 依據：deploy job 至少需 `pages: write`、`id-token: write`，環境 `github-pages`，deploy 以 `needs` 接 build（`官方文件` [Using custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)）；`concurrency: pages` + `cancel-in-progress: false` 來自 VitePress 官方範例（`官方文件` [VitePress deploy](https://vitepress.dev/guide/deploy)）。官方範例寫的 action 版本較舊（configure-pages@v4/v5、upload@v3/v4、deploy@v4），草案用 2026-10-18 查到的最新 major（`實測`），實作時再確認並比照現有 workflow 的 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`。
- **與 release workflow 互不影響**（`實測` + `推論`）：觸發條件不重疊（`pages.yml` 只看 main 的特定路徑；`release.yml` 看 `v*` tag、`pre-release.yml` 只有 dispatch、`build-server-bundle.yml` 看另一分支與 `server-bundle-v*` tag）；`concurrency` 群組 `pages` 是新名稱（既有三者都沒有 concurrency）；權限只在 deploy job 給 `pages` / `id-token`，不碰 `contents: write`。
- **與 BAT 建置互不影響**：`site/` 用**獨立 `package.json` / lockfile**，不進根目錄依賴；`electron-builder` `build.files` 只收 `dist/**`、`dist-electron/**`、白名單 node_modules 與 3 個 icon，`site/` 不會被打包（`實測` 讀 `package.json`）；`typecheck` 只涵蓋 `src/`、vitest include 不含 `site/`（CLAUDE.md「Type check」）。注意：本機 npm 12 會擋 `site/` 依賴（esbuild）的 install script，`site/package.json` 需要自己的 `allowScripts`，依「本機開發：npm 12 install scripts」節屬塔台決策（`推論`）。
- 啟用 Pages（Source = GitHub Actions）是**改 GitHub 設定**的動作：可在網頁 Settings → Pages 操作，或 `gh api -X POST repos/gowerlin/better-agent-terminal/pages -f build_type=workflow`（實作工單須明列並取得使用者授權；本研究未執行）。

#### 5-2 發版時的網站同步

| 方式 | 作法 | 評估 |
|---|---|---|
| a. 手動 | 每次發版改網站版號 / 連結 | ❌ 會漏（與 L150 漏寫更版重點同型風險） |
| b. **併入「發佈後同步 repo 文件」**（建議） | 網站直接 include `release-note.md` / README 版本對照；發佈流程既有的三文件 commit（`docs: release notes for v<版號> (ct)`）push 到 main 後，`paths` 命中 → 網站自動重建 | ✅ 不新增步驟；版本對照表單一來源（README） |
| c. workflow 監聽 `release` 事件 | `on: release: [published]` | ❌ **不會觸發**：release 由 workflow 以 `GITHUB_TOKEN` 建立，而 `GITHUB_TOKEN` 觸發的事件不會建立新 workflow run（例外只有 `workflow_dispatch` / `repository_dispatch`）（`官方文件` [GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token)） |

- **下載按鈕**：本 fork 沒有正式版，`/releases/latest` 不可用（API 404、網頁轉到列表，列表最上面常是 server-bundle）（`實測`）。建議 build 時以 `gh api repos/gowerlin/better-agent-terminal/releases` 取最新 `v*`（排除 `server-bundle-v*`）的 tag，直接產生四個安裝檔資產連結；或在 `release-note.md` 最新段標題取版號。b 的 push 會觸發重建，所以版號跟著發版更新。
- 規則落點：在 `_local-rules.md`「發佈後同步 repo 文件」加一句「push 後確認 Pages workflow 綠燈、首頁版號 = 本版」（塔台維護，不屬本單）。

#### 5-3 SEO / OG、連結檢查、分析

- **SEO / OG**：VitePress `head` 設 `og:title` / `og:description` / `og:image`（OG 卡片 1200×630）、`twitter:card`；`sitemap.hostname` 產生 sitemap；`lang: 'zh-TW'`。需要，成本低。
- **連結檢查**：`lycheeverse/lychee-action` v2.9.0 在 build 後掃 `site/.vitepress/dist`（另一 job，失敗只警告或擋部署由實作工單決定）；VitePress 本身 build 時會擋站內死連結（`ignoreDeadLinks` 預設 false，`推論` 依 VitePress 行為）。
- **分析**：建議**先不加**。Pages 不提供流量統計（`推論`）；GitHub repo 的 Insights → Traffic 已能看 repo 瀏覽 / clone 與來源；若要網站分析，選無 cookie 的方案（例如 GoatCounter / Plausible）並在頁尾說明，屬使用者決策。

### Q6 — 建議與實作切分

**推薦組合**：專案站（本 repo）+ VitePress 1.6.4（`site/`、獨立 package）+ Actions `pages.yml` + 繁中單語 + CT 選項 B + 發版同步併入既有三文件 commit。

| 工單 | 範圍 | 驗收 | 工作量 |
|---|---|---|---|
| W1 站台骨架與部署 | `site/`（VitePress、`base: '/better-agent-terminal/'`、zh-TW UI 字串、local search）、首頁骨架 + 安裝 + 版本對照 + 更版紀錄（include README / `release-note.md`）、build 時取最新 `v*` 版產生下載連結、`.github/workflows/pages.yml`；**經使用者授權**後把 Pages source 設為 GitHub Actions | `site` 內 `npm run build` 0 錯誤；push 後 Pages workflow 綠燈、`https://gowerlin.github.io/better-agent-terminal/` 回 200、首頁版號 = 最新 `v*`；`pre-release.yml` / `release.yml` 未被觸發；根目錄 `npx vite build`、`npm run typecheck` 不受影響 | M |
| W2 內容 | 功能、遠端開發（4 頁，改寫繁中）、BAT × CT（依 Q4 決定）、FAQ、回報與協助測試、頁尾致謝 | `site/` 內 grep 不得有 `T0\d{3}`、`D1\d{2}`、`_ct-workorders`、`CLAUDE.md`、CT 取得管道；VitePress 死連結 0 | M（做「整合參考」頁再 +S） |
| W3 素材 | `e2e/site-media.spec.ts`（手動執行、不進 CI）產生截圖 / WebM；OG 卡片；隱私清單逐張檢查並記錄 | 素材通過 Q3-3 隱私清單；單檔 ≤ 2 MB（建議值）；（選用）README 換新截圖 | M |
| W4 維運 | OG / sitemap、lychee 連結檢查 job、`_local-rules.md` 發版同步加一句（塔台）、（選用）分析 | lychee 0 broken；分享連結預覽顯示 OG 卡片 | S |
| （選用）W5 英文版 | `en/` locale、主要 5 頁英文 | 切換語系正常、搜尋分語系 | M |

W1 → W2 / W3 可並行（W2 只動 `site/` 內容頁，W3 只動 `e2e/` 與素材），W4 最後。

### 需要使用者決定的事項

1. **站台位置**：(a) 專案站 `gowerlin.github.io/better-agent-terminal`（建議）／(b) 先建使用者站 `gowerlin.github.io` 當個人網站入口，BAT 為其中一區／(c) 兩者都做（使用者站只放簡介與連結）。
2. **自訂網域**：(a) 先不用（建議，日後加不影響 URL 以外的設定）／(b) 用既有網域的子網域（例如 `bat.<domain>`）／(c) 買新網域。
3. **CT 呈現**：Q4 的 A / **B（建議）** / C / D。
4. **語言**：(a) 繁中單語（建議）／(b) 繁中 + 英文（加 W5）。
5. **README 舊截圖**：(a) W3 一併換成新截圖（建議，舊圖含上游作者路徑）／(b) 只換網站、README 不動。
6. **網站分析**：(a) 不加（建議）／(b) 加無 cookie 分析並在頁尾說明。
7. **授權動作**：W1 需要啟用 Pages（改 GitHub repo 設定）與 push 新 workflow，需使用者明確授權。

### 檔案變更

- 只改本工單 `_ct-workorders/T0622-research-github-pages-site.md`（metadata + 回報區）。未改產品檔、未建 Pages 設定、未新增 workflow、未建分支、未 push；`gh` 只做唯讀查詢。`src/styles/settings.css` 的 M 非本單變更，未動。
- 未產生原型檔（研究不需要；workflow 草案直接寫在本回報）。

### 驗證

- source / docs 檢查：PASS（盤點與 grep 計數見上）。
- 外部查證：PASS（官方文件 10 處，查證日 2026-10-18）。
- build / tests、runtime、部署：不適用（研究單）。

### 互動紀錄

- 無（未向塔台提問；品牌、網域、CT 公開範圍等屬使用者偏好，依工單指示列為選項）。

### 後續建議

- 開 W1–W4 實作工單前，先請使用者回答上節 1–7。
- 另發現（範圍外，供塔台參考）：README 的「下載最新版本」連結 `…/releases/latest` 在本 fork 因無正式版而轉到 releases 列表，列表最上面常是 `server-bundle-v*`，新使用者可能點錯；可在下次 README 更新時改指向最新 `v*` tag 或 releases 列表並加說明。

### Commit

- 本工單檔以 `git commit --only` 提交（hash 見 git log；研究單無產品 commit）。
