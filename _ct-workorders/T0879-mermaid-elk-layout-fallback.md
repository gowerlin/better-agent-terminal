---
schema_version: 1
schema_kind: workorder
id: T0879
title: "Markdown 預覽：mermaid 圖指定 ELK 排版時改用預設排版並顯示說明"
type: implementation
status: PENDING
created_at: "2026-11-17T11:52:57+0800"
started_at: ""
updated_at: "2026-11-17T11:52:57+0800"
completed_at: ""
session_ids: []
repo: better-agent-terminal
priority: P3
sizing: S
depends_on: [T0878]
related:
  - "D300；D299；T0878 回報區〈渲染驗證〉〈建議後續〉2"
affects_files:
  - _ct-workorders/T0879-mermaid-elk-layout-fallback.md
  - src/components/FileTreeMarkdown.tsx
  - src/lib/**（新增的純函式）
  - src/**/__tests__/**
  - src/styles/file-browser.css（只限說明文字的樣式）
  - src/locales/** 或專案實際的 i18n 字串檔（只限新增字串）
  - docs/agent-guide/build-toolchain.md（只限 T0878 那一段補一句）
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 行為（D300，不得自行改變）：渲染前偵測圖指定 ELK 排版（front matter `config.layout` 或 `layout`、`%%{init: …}%%` 指令中的 `layout`，值為 `elk` 或 `elk.*`），改成 `dagre` 後交給 mermaid 渲染；在該圖旁顯示一行說明（BAT 不內建 ELK 排版，已改用預設排版）。只改傳給 mermaid 的文字，**不改使用者的檔案**、不改編輯器內容。"
  - "🔴 不得影響其他圖：沒有指定 ELK 的圖，傳給 mermaid 的文字與渲染結果和 T0878 完全相同；`flowchart-elk` 不處理（BAT 的 dagre 設定下本來就正常，T0878 實測）。偵測要保守：只認 mermaid 文件定義的寫法，認不出就照原文渲染（等同 T0878 行為），不得把正常的圖改壞。"
  - "🔴 偵測與改寫寫成純函式（不 import DOM／mermaid），單元測試涵蓋各種寫法與不該改的情況。說明文字走專案既有的 i18n（所有語系都要有字串）；Markdown 預覽的 HTML 一律照既有的 DOMPurify 路徑，新增的 DOM 用 `textContent`，不得用 `innerHTML` 塞字串。"
  - "🔴 不改 `vite.config.ts` 的 elkjs alias 與 `src/lib/elkjs-stub.ts`（T0878）；不改 mermaid 版本與 `initialize` 設定。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0879 — mermaid 圖指定 ELK 排版時改用預設排版並顯示說明

## 元資料
- **工單編號**：T0879｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-17 11:52 (UTC+8)
- **規模**：S｜**依賴**：T0878｜**決策**：D300

## 背景
T0878 把 `elkjs` 換成空殼（D299）。Markdown 預覽（`src/components/FileTreeMarkdown.tsx`，`renderMermaidBlocks` 約 L78）中，圖若寫 `layout: elk`，現在會顯示 mermaid 通用的錯誤圖（炸彈＋「Syntax error in text」），使用者看不出是 BAT 沒有打包 ELK。D300 決定：改用 dagre 照常畫出來，並顯示一行說明。

## 任務
1. 讀 mermaid 12.3.0 文件／原始碼，列出指定 layout 的所有寫法（front matter `config: layout:`、front matter 頂層 `layout:`、`%%{init: {"layout": …}}%%`／`%%{initialize: …}%%`，以及 `elk.*` 變體名稱），附來源。
2. 新增純函式（例 `src/lib/mermaid-elk-fallback.ts`）：輸入圖的文字，回傳 `{ text, usedElk }`，只在認得的寫法中把 ELK 換成 `dagre`；其他內容逐字不變。
3. `renderMermaidBlocks` 在渲染前呼叫它；`usedElk` 為真時在該圖的容器旁加一行說明（i18n，`textContent`），樣式沿用預覽的次要文字樣式。
4. 單元測試：各種寫法都換成 dagre、說明旗標正確；沒指定 layout、`layout: dagre`、`flowchart-elk`、字串裡碰巧出現 `elk`（例如節點文字、註解）都不改；CRLF、縮排、引號變化。
5. 渲染驗證（沿用 T0878 的 scratch 方式）：T0878 的 10 張圖中，`layout: elk` 那張改成正常的 dagre 圖＋說明，其他 9 張與 T0878 結果相同；console 沒有新的 error。
6. `docs/agent-guide/build-toolchain.md` T0878 那段補一句：圖指定 ELK 時改用 dagre 並顯示說明（T0879）。

## 關卡
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit`、`npm run test:legacy`（與 T0878 後比較）
- `npx vite build`；`scripts/__tests__/no-elkjs-in-dist.test.mjs` 仍通過

## 驗收條件
- [ ] layout 寫法清單（附來源）
- [ ] 純函式＋單元測試（含不該改的情況）
- [ ] 渲染驗證：ELK 圖正常顯示＋說明，其他圖與 T0878 相同
- [ ] i18n 字串所有語系齊全
- [ ] 關卡不比 T0878 後差
- [ ] commit 只含本單範圍，不 push

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
