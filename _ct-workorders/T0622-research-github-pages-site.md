---
schema_version: 1
schema_kind: workorder
id: T0622
title: "研究：PLAN-049 GitHub Pages 介紹 BAT + Control Tower（站台位置、技術選型、內容盤點、CT 公開範圍建議）"
type: research
status: PENDING
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T12:17:23+0800"
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

---

## 回報區

（Worker 填寫）
