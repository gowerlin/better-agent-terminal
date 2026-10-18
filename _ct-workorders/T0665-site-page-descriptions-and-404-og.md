---
schema_version: 1
schema_kind: workorder
id: T0665
title: "PLAN-049：網站 install / compatibility / releases 補頁面 description；404 頁分享說明改中文"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-049
priority: P3
sizing: S
created_at: "2026-10-18T22:28:18+0800"
started_at: "2026-10-18T22:29:04+0800"
updated_at: "2026-10-18T22:32:00+0800"
completed_at: "2026-10-18T22:32:00+0800"
target_version: "網站（不發 BAT 版）"
related:
  - "T0659 回報區「給塔台的後續建議」第 1、2 點"
  - "PLAN-049"
affects_files:
  - site/install.md
  - site/compatibility.md
  - site/releases.md
  - site/.vitepress/config.mts
  - _ct-workorders/T0665-site-page-descriptions-and-404-og.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 只改 `affects_files` 列的檔案；頁面正文不改，只加 / 改 frontmatter `description`。產品程式碼（`electron/**`、`src/**`、`scripts/**`）不動。"
  - "🔴 不 push（網站上線由塔台經使用者確認後 push）；commit 用 `git commit --only <本單檔案>`。工作樹裡 `src/styles/settings.css` 顯示 M（內容無差異），不要動、不要提交。"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
---

# T0665 — 網站頁面 description 與 404 分享說明

## 背景

T0659（W4 分享卡片）回報兩個零星缺口：

1. `site/install.md`、`site/compatibility.md`、`site/releases.md` 沒有 frontmatter `description`，`<meta name="description">` 與 `og:description` / `twitter:description` 退回站點說明，分享出去看不出是哪一頁。
2. 404 頁的 `og:description` 是 VitePress 預設的英文 `Not Found`。

`site/index.md` 也沒有 `description`，但首頁用站點說明是預期行為，不必補（確認 build 後首頁的說明 = 站點說明即可）。

## 任務

1. 三頁各補一句 `description`：繁體中文、寫給使用者看、說明這頁能找到什麼；長度與寫法比照既有頁面（例 `site/faq.md`）。內容要對得上頁面實際正文，先讀完頁面再寫，不要寫頁面沒有的東西。
2. 404 頁：在 `site/.vitepress/config.mts` 的 `transformHead`（或等價做法）讓 404 頁的 description / `og:description` / `twitter:description` 為中文（例：「找不到這個頁面…」，可附回首頁的提示）；`<title>` 若也是英文一併改中文。不影響其他頁面的 head。

## 驗證

- `site/` 內 `npm run build` 成功。
- 檢查 build 產物（`site/.vitepress/dist/`）：`install.html` / `compatibility.html` / `releases.html` 的 `meta[name=description]`、`og:description`、`twitter:description` 是各自新寫的那句；`404.html` 三者為中文；`index.html` 與任一其他既有頁面（例 `faq.html`）的 head 與修改前相同（diff 證明）。
- 回報區列出三句 description 與 404 的新文字，給使用者預覽。

## 驗收條件

- [ ] 三頁有各自的 description，內容對得上頁面
- [ ] 404 分享說明為中文，其他頁面 head 不變
- [ ] build 成功；只改 `affects_files`；未 push

## Sub-session 執行指示

1. 讀本工單、T0659 回報區、三個頁面與 `site/.vitepress/config.mts`
2. 填 `started_at`、`status: IN_PROGRESS`（時間用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取，R-G001）
3. 實作 → 驗證 → 填回報區
4. `git commit --only` 本單產出；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

**DONE** — 三頁補上各自的 description；404 頁的 description / `og:description` / `twitter:description` 改中文；其他頁面 head 不變；build 成功；未 push。

### 落點檢查

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`site/install.md` 等皆存在 → PASS（資訊性）
- C-2：工單無 `branch` 欄位，略過；目前分支 `main`
- `CT_HOME` 未設定（非隔離工單）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

**三句 description（給使用者預覽）**

| 頁面 | description |
|---|---|
| `site/install.md`（安裝） | 下載 Better Agent Terminal 的 Windows、macOS（Apple Silicon）、Linux 安裝檔，或從原始碼建置；資料目錄的位置、從舊版升級、除錯日誌，以及語音輸入的麥克風權限。 |
| `site/compatibility.md`（版本對照） | Better Agent Terminal 與 BMad Control Tower 一起用時，每項協作功能需要的 BAT 與 Control Tower 最低版本；任一邊較舊時，該功能不啟用，其餘流程照舊。 |
| `site/releases.md`（更版紀錄） | Better Agent Terminal 各版的更版重點，最新版在最上面：每一版修正了什麼、新增或更新了什麼、有哪些已知事項；上游專案 v2.1.x 的紀錄附在最後。 |

內容對照正文：install 依頁面各 `##` 節（下載安裝檔 / 從原始碼建置 / 資料存放位置 / 從舊版升級 / 除錯日誌 / 語音輸入的麥克風權限）；compatibility 依 README `#region compatibility` 的說明句與表格；releases 依 `release-note.md`（最新在上，`###` 節以 修正 40 / 已知事項 24 / 更新 18 / 新增 15 為主，最後一節「上游歷史（tony1223/better-agent-terminal v2.1.x）」）。`releases.md` 原有 frontmatter（`outline`），description 加在其中；install / compatibility 新增 frontmatter。正文未改。

**404 新文字**（`site/.vitepress/config.mts` 常數 `NOT_FOUND_DESCRIPTION`）：

> 找不到這個頁面，網址可能已經移除或改名。請回 Better Agent Terminal 首頁，或從上方選單找你要的內容。

做法：`transformHead` 對 `pageData.isNotFound` 改用此文字產生 `og:description` / `twitter:description`，並在 head 加 `meta[name=description]`（VitePress `renderPage` 以 `isDescriptionOverridden(head)` 判斷，head 已有時不再輸出內建的 `Not Found`）。其他頁面的 head 標籤與順序與修改前相同（`og:title`、`og:description`、`twitter:title`、`twitter:description`、`og:url`）。

`<title>`：維持 `404 | Better Agent Terminal`（「404」是數字不是英文；VitePress 的 `<title>` 由內建 `notFoundPageData.title` 產生，transformHead 無法替換，加第二個 `<title>` 不妥，要改需新增自訂 `404.md`，不在 `affects_files`）。`og:title` / `twitter:title` 也維持與 `<title>` 一致。

**commit**：`c31c2db0` docs(site): T0665 page descriptions for install / compatibility / releases; Chinese 404 description（`git commit --only` 4 個 `site/` 檔）；工單 commit 另提。未 push。

### 驗證

- `site/` `npm run build`：修改前（基準）與修改後皆 exit 0（`build complete in 2.71s`），無 error / warning / dead link。
- 產物 `site/.vitepress/dist/`：
  - `install.html` / `compatibility.html` / `releases.html`：`meta[name=description]`、`og:description`、`twitter:description` 三者皆為上表各自那句；`og:url` 照舊。
  - `404.html`：三者皆為上方中文句；檔內 `Not Found` 出現 0 次；無 `og:url`（同修改前）。
  - 每個 `.html` 的 `meta[name=description]` 恰好 1 個（全站逐檔檢查）。
  - `index.html` / `faq.html` / `features.html` 的 `<head>`：與修改前基準 diff，唯一差異是 `app.*.js` / `chunks/theme.*.js` 的雜湊檔名（config 變更造成）；把雜湊正規化後三頁 **IDENTICAL**。`index.html` 的 description = 站點說明（預期行為）。
- 換行：`git ls-files --eol` 四檔皆 `i/lf w/lf`。
- 只改 `affects_files`；`src/styles/settings.css` 未動、未提交。

### 互動紀錄

無（yolo，無需向塔台提問）。

### 遭遇問題

- 第一次基準 build 的日誌誤寫到 repo 上兩層的 `D:/ForgejoGit/@Gower_Labs/BMad-Guide/t0665-base-build.log`，已立即移到 scratchpad；該目錄 `git status` 無殘留（只有原本就有的子目錄標記）。
- 已知限制：VitePress 客端 hydration（`useUpdateHead`）會把瀏覽器 DOM 裡 404 的 `meta[name=description]` 改回內建的 `Not Found`（只在已執行 JS 的瀏覽器內；分享卡片爬蟲讀靜態 HTML，不受影響）。要連客端一起改需動 theme 或新增自訂 `404.md`，不在本單範圍。

### 給塔台的後續建議

1. `releases.html` 的 `<title>` / `og:title` 是 `Release Notes — Better Agent Terminal（gowerlin fork） | Better Agent Terminal`（取自 `release-note.md` 的 H1，英文且重複站名），分享卡片標題不理想；可在 `site/releases.md` frontmatter 加 `title: 更版紀錄`（修改前就如此，本單未動）。
2. 若要 404 的 `<title>` 與客端 description 也中文化，可另開單新增 `site/404.md`（VitePress 自訂 404 頁）。

### 回報時間

2026-10-18T22:31:25+0800
