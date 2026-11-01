---
schema_version: 1
schema_kind: workorder
id: T0723
title: "T0722 後續：CHANGELOG `[Unreleased]` 記錄「Claude Agent」改名；重拍網站上仍顯示「Claude Agent V1 / V2」的截圖"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-01T10:00:48+0800"
started_at: ""
updated_at: "2026-11-01T10:00:48+0800"
completed_at: ""
depends_on: [T0722]
related:
  - "T0722（DONE，`35b2bac3`：「Claude Agent V1」改名「Claude Agent」，舊預設標題自動遷移；回報區「遭遇問題」與「後續候選」）、D194"
  - "網站素材：`e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1` 才跑，輸出 `BAT_SITE_MEDIA_DIR`，預設 `e2e-media/`，gitignored；需先 `npx vite build`）、`site/public/media/`、T0656（部分素材手動拍）"
  - "`_local-rules.md`「發佈後同步 repo 文件」：發版時 `[Unreleased]` 已發佈的項目移入該版段落"
affects_files:
  - CHANGELOG.md
  - "site/public/media/（只換顯示舊名稱的截圖 / poster）"
  - "site/**/*.md（只在圖片內容改變而 alt / caption 需要跟著改時）"
  - "e2e/site-media.spec.ts（只在 spec 本身寫死舊名稱或需要配合改名時）"
  - _ct-workorders/T0723-claude-agent-rename-followups.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 第 1 項 CHANGELOG：只在 `## [Unreleased]` 下新增 `### Changed` 一條（繁體中文、寫給使用者看，附 T0722 / D194）：「Claude Agent V1」改名「Claude Agent」（worktree 版為「Claude Agent (Worktree)」），舊分頁的預設標題（`Claude Agent V1` / `Claude Agent V2`）開啟時自動更新，自己改過的標題不動。不改已發佈的版本段落、不改 `release-note.md` / README。"
  - "🔴 第 2 項截圖：先盤點 `site/public/media/` 每個圖片 / poster / 影片，畫面上是否出現「Claude Agent V1」「Claude Agent V2」或 V1 / V2 切換鈕（附判斷依據：看圖或對照 spec 的拍攝步驟）。由 `e2e/site-media.spec.ts` 產生的，以目前 `main`（含 T0722）重新產生後換掉；換圖前後尺寸與構圖應一致，其他畫面差異（非改名造成）在回報列出。手動拍的或影片（`clip-dispatch.*`）若含舊名稱：能用 spec 重產就重產，不能就列在回報的「需使用者手動處理」，不要自己合成或修圖。"
  - "🔴 截圖內容須符合公開 repo 去識別化（D176）：只用 spec 的示範資料（`demo-shop` 等），畫面不得出現真名、家目錄路徑、權杖、使用者自己的工作區。跑 spec 前確認 `BAT_SITE_MEDIA_ROOT` / 隔離 userData 不會碰到使用者正在用的 BAT 與已安裝的 BAT。"
  - "🔴 同時有 T0720 / T0721 研究 Worker 在本 repo 只讀，它們不跑 build；你可以跑 `npx vite build` 與 site-media spec。"
  - "🔴 驗收：`npm run docs:build`（或 site 的建置指令，以 `package.json` 為準）成功、圖片路徑不變（`MediaFigure` 引用都還在）；不需要跑 `test:unit`（只改文件與素材），若改了 `e2e/site-media.spec.ts` 則以實際跑過一次為證。"
  - "🔴 不發版、不 push。yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0723 — T0722 後續：CHANGELOG 與網站截圖

## 元資料

- **工單編號**：T0723
- **類型**：implementation
- **優先級**：P3
- **建立時間**：2026-11-01T10:00:48+0800
- **預估規模**：S

## 目標

T0722 把「Claude Agent V1」改名為「Claude Agent」後，留下兩件事（使用者指示「兩件待辦可排單」）：

1. **CHANGELOG**：先在 `[Unreleased]` 記一條，讓下次發版的更版重點與 CHANGELOG 不會漏掉。
2. **網站截圖**：`site/public/media/agents-menu.png` 等截圖畫面仍是舊的「Claude Agent V1 / V2」（alt 文字 T0722 已改），重拍成新名稱。

## 驗收

- [ ] CHANGELOG `[Unreleased]` 有改名一條，其他段落未變
- [ ] `site/public/media/` 盤點表（檔名 / 是否含舊名稱 / 處置）
- [ ] 含舊名稱且可由 spec 產生的截圖已換新；不能重產的列在「需使用者手動處理」
- [ ] 網站建置成功、圖片引用不變
- [ ] 截圖去識別化檢查結果

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 改動摘要

### 驗證結果

### 需使用者手動處理

### 遭遇問題

### 回報時間
