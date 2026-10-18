---
schema_version: 1
schema_kind: workorder
id: T0662
title: "PLAN-049：「Control Tower 功能導覽」頁加一節「Control Tower 怎麼長出來的」——以七個世代講設計思路，不寫版本號 / 檔名 / 命令名稱（D170）"
type: feature
status: TODO
repo: better-agent-terminal
project: PLAN-049
priority: P3
sizing: S
created_at: "2026-10-18T21:07:54+08:00"
depends_on: []
related:
  - "D170（使用者選 B：網站版摘要，D166 不放寬）；D159 / D165 / D166（CT 字樣規則）；BMad-Guide T0175（D074，`eddf74c`）已把演進史補到七個世代"
  - "來源（只讀）：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\BMad-Control-Tower\\docs\\Control Tower 演進史.html`（章節：七個世代、v1 → v2 把人手從傳輸線上拿掉、塔台和 Worker 分開跑、派工迴路、三層資料、metadata 改用 frontmatter、SKILL.md 改成路由器、一條規則只寫一處、52 個版本、資料來源）"
  - "網站規則：`_ct-workorders/_spec-site-v2-bat-ct-story.md` § 7 / § 8；設計語言 `docs/design/site-design-language.md`；寫法比照 `/cases`（T0638）與既有 `/control-tower-tour`（T0636）"
affects_files:
  - site/control-tower-tour.md
  - "site/.vitepress/theme/**（只在需要新元件，例如世代時間軸；優先沿用既有元件 `StoryTimeline` / `GrowthLadder` / `CardTable` 等）"
  - _ct-workorders/T0662-site-ct-evolution-summary.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 **`frontend-design`** skill；清單裡沒有 → `BLOCKED` 回報。另用 `bmad-editorial-review-prose` 校稿。"
  - "🔴 **D166 / D170 字樣規則**：不得出現 CT 版本號（v1、v2、v5.x 等任何版本字樣）、檔名（`SKILL.md`、CHANGELOG、frontmatter 欄位名等）、命令名稱、skill 名稱、星號 / 斜線 / 錢字號開頭的指令、CT 資料路徑、取得管道、委派單編號、決策編號、zip 大小等內部數據。改用概念描述（例：「從人工轉貼到自動派工」「規則從一份大文件拆成按需載入的章節」）。不放演進史原文、不連到 claude.ai artifact 或 BMad-Guide repo。網站自己的路由（`/control-tower`、`/control-tower-tour`）除外。"
  - "🔴 內容：一節（h2，建議 `Control Tower 怎麼長出來的 {#evolution}`），放在「使用情境」之後、「常見問題」之前（若判斷放最後更好，回報說明）；以七個世代各一小段，講每一代要解決的問題與做法，最後一兩句收束（例如與 BAT 的分工、為何越用越懂你的專案），可連到 `/cases`、`/control-tower`。世代名稱與劃分以演進史為準，但用語改為使用者看得懂的說法。篇幅適中（大約 1–1.5 個螢幕），不要比其他節長很多。"
  - "🔴 不得誇大、不得與 CT 實際行為衝突；回報區附「網站段落 → 演進史章節」對照（只供內部核對，不上站）。"
  - "🔴 網站驗證：`site/` `npm run build` 0 錯誤 0 死連結；CT 字樣 / 版本號 / 內部編號 / 隱私 grep = 0（另加 grep `v[0-9]+\\.`、`SKILL`、`CHANGELOG`、`frontmatter` 在本次新增段落 = 0）；桌面 1440 / 手機 390 × 淺 / 深色截圖（不入版控，放 scratchpad）；手機無水平捲動；reduced-motion 無動畫。預覽伺服器用完結束（L164）。"
  - "🔴 **Worker 不 push、不改 GitHub 設定**。非隔離工單，目前沒有其他 Worker。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不要跑 Playwright e2e。"
---

# T0662 — 功能導覽加「Control Tower 怎麼長出來的」

## 目標

使用者決定（D170）在網站「Control Tower 功能導覽」下方加一節，介紹 Control Tower 一路怎麼演進成現在的樣子。內部的《Control Tower 演進史》已由 CT 塔台補到七個世代（BMad-Guide T0175），但它以版本表、檔名與內部數據為骨幹，不能直接上站。本單把它改寫成網站版摘要：讀者看得到每一代想解決什麼問題、做了什麼取捨，不需要知道版本號或內部檔案。

## 要做的事

1. 讀演進史，抽出七個世代各自的「問題 → 做法」。
2. 在 `/control-tower-tour` 寫一節（見 memory_overrides 的位置、篇幅、字樣規則）；視覺沿用既有元件與設計語言。
3. 校稿、驗證、截圖。

## 驗收

- 新節完成，字樣規則 grep = 0，build 0 錯誤 0 死連結，手機無水平捲動
- 回報區附：段落 → 演進史章節對照、截圖清單、文案校稿採納清單、給使用者的預覽指令、commit
- 只改 `affects_files`；未 push
