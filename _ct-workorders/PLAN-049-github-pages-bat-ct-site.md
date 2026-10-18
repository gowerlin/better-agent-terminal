---
schema_version: 1
schema_kind: plan
id: PLAN-049
title: "GitHub Pages 個人網站：介紹 BAT + Control Tower、推廣使用"
status: IN_PROGRESS
priority: medium
created_at: "2026-10-18T12:16:31+0800"
links:
  source: "使用者 2026-10-18 第七十九 session `*plan`：研究如何在 GitHub Pages 架設個人網站，用來介紹 BAT + CT，推廣使用"
  related: [PLAN-047, PLAN-048]
---

# PLAN-049 — GitHub Pages 介紹 BAT + Control Tower

## 動機

BAT（better-agent-terminal，本 fork `gowerlin/better-agent-terminal`）與 BMad Control Tower 的協作（塔台 / Worker、BAT MCP、worktree 隔離派工、Worker 問塔台、啟動確認等）目前只寫在 README 與 `docs/agent-guide/`，對新使用者門檻高。
想以 GitHub Pages 架一個介紹網站：說明能做什麼、怎麼安裝、怎麼和 CT 一起用，推廣使用並吸引協助測試（例如 codex 使用者，見 `_local-rules.md`「歡迎協助測試」D153）。

## 已知約束（塔台整理）

- 🔴 **CT 維持未開源**（使用者 2026-10-17 指示）：README 不放 CT 的取得連結或內部 repo 位置；網站同樣適用，除非使用者另有決定。網站怎麼介紹 CT（只介紹概念與 BAT 整合點？提供取得管道？）需使用者決定。
- `gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）；本 repo 有 3 個 remote，Pages 設定與部署 workflow 不得打到 upstream。
- 既有 release workflow（`pre-release.yml` / `release.yml`）不得受影響；Pages 部署若用 Actions，獨立一個 workflow。
- 安裝檔下載連結指向本 fork 的 GitHub Releases（預覽版 `v0.7.0-pre.N` 線）；macOS 只有 arm64（D136）。

## 待研究 / 待決

1. **站台位置**：使用者站 `gowerlin.github.io`（個人網站，BAT / CT 為其中一區）vs 專案站 `gowerlin.github.io/better-agent-terminal`（從本 repo 的 `/docs` 或 `gh-pages` 分支 / Actions 部署）；是否用自訂網域。
2. **技術選型**：VitePress（本機已有 vitepress-book skill、與 `docs/` Markdown 相容）/ Astro / 純 HTML；i18n（繁中為主、英文？）。
3. **內容來源與同步**：README、`release-note.md` / `CHANGELOG.md`、`docs/agent-guide/` 哪些可公開、哪些是內部開發文件；發版時如何同步（併入「發佈後同步 repo 文件」流程？）。
4. **內容架構**：首頁（價值主張、截圖 / GIF）、功能介紹、安裝、BAT × CT 協作流程、版本對照、FAQ、回報管道（GitHub issue）。
5. **素材**：截圖、示範 GIF（塔台派工 → Worker → 回收）的產生方式；品牌（icon、配色）。
6. **維運成本**：部署 workflow、連結檢查、SEO / OG 卡片、分析（是否需要）。

## 已決定（D159，2026-10-18 12:18）

- 站台位置：**專案站 `gowerlin.github.io/better-agent-terminal`**（本 repo 部署）。
- CT 呈現：**只介紹概念與它跟 BAT 的整合點**，不提供取得管道。
- （12:20 追加）技術選型、截圖 / 示範 GIF、部署方式：**由塔台依 T0622 建議決定並設計**。
- 內容來源與同步：使用者向內容**可公開、可同步**；**發版時一起更新網站**（併入發佈後同步流程）。
- （12:24，D160，塔台依授權決定）T0622 研究 DONE → VitePress 1.6.4 於 `site/`、Actions `pages.yml`、Playwright 手動素材 spec + WebM、發版同步併入三文件 commit；實作切 W1 骨架與部署 / W2 內容 / W3 素材 / W4 維運（W1 → W2、W3 並行 → W4）。待使用者：自訂網域、語言、README 換圖、分析、W1 授權。

## 進度

- **W1 DONE**（T0624 `e2006ab3`，2026-10-18）：塔台依 D160 授權 push（`24c4da3a`）並啟用 Pages；run `39098377237` 綠燈，`https://gowerlin.github.io/better-agent-terminal/` 四頁 200、首頁版號 `v0.7.0-pre.8`；README 加網站連結（`ebeb8016`，使用者指示）。
- **網站 v2 方向（D161，2026-10-18 13:03）**：使用者預覽 W1 後認為介紹過於簡單、看不出 BAT × CT 整合優勢 → 規格 `_ct-workorders/_spec-site-v2-bat-ct-story.md`（故事主軸「AI 協作開發的 7 個卡關時刻 vs BAT + CT 解法」、三欄對照、`/control-tower` 深入頁）。W2 改切 W2a（T0630：設計語言 + 元件 + 首頁）→ W2b（`/control-tower`、功能、FAQ、回報頁）→ W2c（遠端開發）；每次 push 前使用者預覽確認。
- **加入設計 skill（D162，2026-10-18 13:08）**：使用者停止 T0630 並要求加入 `frontend-design` / `theme-factory` / Design 畫布定方向 → T0631 安裝 `frontend-design`（工單授權）→ T0632 設計語言 + BAT Design System + Design 畫布 3 個方向 → 使用者選方向 → T0630 改為實作工單。
- **視覺方向（D164，13:33）**：A「進場雷達」為主 + C「一個早上」的故事時間軸；T0631 / T0632 DONE，T0630 重新派工（13:33）。
- **CT 進階能力與案例（D165，13:46）**：T0633 研究 DONE → 首頁加「越用越懂你的專案」、`/control-tower` 加三節與 FAQ（併入 W2b）、新頁 `/cases`（W2d）。
- **W2a DONE 並上線**（T0630 `7d22cb8b`，2026-10-18 13:59）：故事化首頁（A 雷達 Hero + C 時間軸故事 + 三欄對照 + 自動但不失控 + 實績 + 不用 CT 也好用 + 下載）；Lighthouse 桌面 a11y / BP 100。使用者本機預覽後授權 push（14:01，`ebeb8016..08046367`，Pages run `39102565113`）。預覽時列出的 4 個改進點（插圖形式單一、Hero 銜接與下半頁層次、計數器動畫 vs 設計語言 § 6、手機版故事長度）使用者未勾選，維持現狀，可在 W2b 再議。
- **W2b-1 DONE 並上線**（T0634 `47b24606`，14:20）：`/control-tower` 14 節深入頁（含 D165 三節與 FAQ）、首頁「越用越懂你的專案」、nav。使用者預覽後授權 push（`08046367..13f207f3`，Pages run `39104035036`，`/control-tower` 200）。預覽建議的步驟器 / 二選一標示未選，維持現狀；手機 checklist 對齊 bug 由塔台判定併入 T0635。
- **W2b-2 = T0635**（14:27 建立）：`/features`、`/faq`、`/contribute`、頁尾致謝、nav，修 checklist 對齊、設計語言補「你 = 藍」。

## 排期

使用者決定。排期時先開研究工單（選型、站台位置、內容盤點與 CT 公開範圍建議），結論審過後再開實作工單。
