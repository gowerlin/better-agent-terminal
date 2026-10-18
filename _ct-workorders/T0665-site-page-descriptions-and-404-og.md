---
schema_version: 1
schema_kind: workorder
id: T0665
title: "PLAN-049：網站 install / compatibility / releases 補頁面 description；404 頁分享說明改中文"
type: feature
status: TODO
repo: better-agent-terminal
project: PLAN-049
priority: P3
sizing: S
created_at: "2026-10-18T22:28:18+0800"
started_at: ""
updated_at: "2026-10-18T22:28:18+0800"
completed_at: ""
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

### 產出摘要

### 互動紀錄

### 遭遇問題

### 回報時間
