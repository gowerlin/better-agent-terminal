---
schema_version: 1
schema_kind: workorder
id: T0656
title: "PLAN-049 W3：網站與 README 的真實截圖 / 短片——`e2e/site-media.spec.ts`（手動執行、不進 CI）產生素材，隱私清單逐張檢查，填入 `TODO(W3)`，README 換新截圖"
type: feature
status: TODO
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T19:12:43+0800"
depends_on: [T0646, T0652]
related:
  - "D160 第 4 點（素材：手動執行、不進 CI 的 `e2e/site-media.spec.ts`、隔離實例、虛構示範專案、WebM 以 `<video autoplay muted loop>` 取代 GIF；既有 `assets/screenshot-*.png` 網站不沿用）；D160 使用者決定「W3 一併把 README 舊截圖換成新截圖」"
  - "T0622 回報區 § 3-3 素材表與**隱私檢查清單**（5 點，逐張套用）、W3 驗收（單檔 ≤ 2 MB 建議值）"
  - "主規格 `_ct-workorders/_spec-site-v2-bat-ct-story.md` § 7（插圖：HTML / CSS / SVG 示意為主，真實截圖與短片**補充、不取代**示意）、§ 8（文案與內容規則）；設計語言 `docs/design/site-design-language.md`"
  - "既有可參考的 e2e：`e2e/fixtures/electron-isolation.ts`（隔離實例）、`e2e/t0609-worker-attention-badge.spec.ts`、`e2e/t0611-tower-question.spec.ts`、`e2e/t0583-worktree-isolated-dispatch.spec.ts`、`e2e/pre6-wizard-acceptance.spec.ts`、`e2e/t0512-profile-panel-layout.spec.ts`"
affects_files:
  - "e2e/site-media.spec.ts（新，手動執行、不進 CI）"
  - "playwright.config.ts（只在需要把 site-media 排除在預設執行之外、或給它獨立 outputDir 時）"
  - ".gitignore（只新增素材暫存目錄）"
  - "site/public/media/**（新，上站素材）"
  - "site/features.md、site/remote/index.md、site/remote/wsl.md、site/remote/ssh.md、site/remote/docker.md（只把 `TODO(W3)` 換成素材）"
  - "site/index.md、site/control-tower.md（選做：首頁 / 協作頁加一段派工短片，不取代既有示意元件）"
  - "site/.vitepress/theme/**（只在需要新元件，例如 `MediaFigure` / `DemoVideo`）"
  - "README.md（「擷圖」節換新截圖）、assets/screenshot-*.png（替換或新增；不再被引用的舊檔刪除前先 grep 引用）"
  - _ct-workorders/T0656-site-w3-media.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 **`frontend-design`** skill（素材在頁面上的呈現：框線、圖說、深淺色、手機版）；清單裡沒有 → `BLOCKED` 回報。另用 `bmad-editorial-review-prose` 校圖說。"
  - "🔴 **`e2e-results/` 會被清空**（T0652 實例）：`playwright.config.ts` 的 `outputDir` 是 `e2e-results`，Playwright 每次執行都會清空它。素材的輸出與挑選目錄必須放在 `outputDir` 以外（例如新增 gitignored 的 `e2e-media/`），或替 site-media 設獨立 outputDir；`e2e-results/site-preview/serve.mjs` 若被清掉就重建。"
  - "🔴 **隱私清單逐張檢查**（T0622 § 3-3 的 5 點）：不得出現權杖（`batcap.…`、`server-token.json`、Settings → 遠端存取的 token / QR）、使用者路徑與帳號（`C:\\Users\\<name>`、git user / email、Claude 帳號）、私人 repo / 工作區名稱、內部工單內容；示範一律用虛構專案 `demo-shop`、temp 目錄、虛構工單編號 `T1024`–`T1026`；CT 只能出現畫面上的 skill 名稱，不得出現安裝路徑、skill 檔內容、取得管道；狀態列用量 / 費用若入鏡要在回報列出。回報區附逐張檢查表（檔名 × 5 點 × 結果）。"
  - "🔴 素材產生：隔離實例（`electron-isolation.ts`，temp userData、`--runtime=<id>`），語言 zh-TW（README 與網站皆繁中），固定視窗尺寸；狀態以 `bat-terminal.mjs` / `bat-notify.mjs` 驅動，**不呼叫模型、不登入真實 Agent**。需要真實 Agent 對話的畫面（例如 Claude Code 面板對話）做不出來就不硬做：在回報列出「需使用者手動拍」清單與拍攝步驟（ScreenToGif / OBS），README 該處改用做得出來的畫面或保留位置。先 `npx vite build` 再跑 spec。"
  - "🔴 格式與大小：PNG（必要時壓縮）；短片用 Playwright `recordVideo` 的 WebM，網站以 `<video autoplay muted loop playsinline>` 呈現，附 poster 圖與文字等價說明，`prefers-reduced-motion` 時不自動播放；單檔建議 ≤ 2 MB，超過要在回報說明。不新增 npm 依賴；ffmpeg 不在就只出 WebM。"
  - "🔴 網站規則：真實截圖**補充、不取代**既有 HTML / SVG 示意元件；CT 字樣 / 內部編號（`T0\\d{3}`、`D1\\d{2}`、`BUG-\\d+`、`PLAN-\\d+`、`_ct-workorders`、`CLAUDE.md`）/ 隱私 grep = 0；`npm run build` 0 錯誤 0 死連結；手機無整頁水平捲動。"
  - "🔴 **Worker 不 push、不改 GitHub 設定**。網站這批要等下一個預覽版發佈後才由塔台 push（遠端頁內容依賴本批產品修正）。"
  - "🔴 非隔離工單。T0654（`scripts/smoke-remote-headless.mjs` 等）、T0655（`ProfilePanel.tsx`、`EditRemoteProfileModal.tsx`、`src/locales/**`）可能同時進行，不碰它們的檔；T0655 若還沒 commit，編輯連線對話框的截圖可能是舊畫面——在回報註明拍攝時的 HEAD。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；二進位素材照常 commit。"
---

# T0656 — 網站與 README 的真實截圖 / 短片（W3）

## 目標

PLAN-049 網站 v2 的 W3。目前網站的插圖都是 HTML / SVG 示意，`/features` 與 `/remote/` 留了 10 個 `TODO(W3)` 截圖位置；README 的「擷圖」節還是上游舊 UI（標題「Better Terminal」、含上游作者本機路徑）。本單用隔離實例產生真實素材，讓讀者看到 BAT 實際長什麼樣子。

## 素材清單（依 T0622 § 3-3，可依可行性調整並在回報說明）

1. **主畫面總覽**：多工作區 + 分頁 + 縮圖列 + 狀態列（`/features` 開頭、README）
2. **塔台派工 → Worker 執行 → 回報 → 分頁回收** 短片（15–30 s）：以 helper 驅動（塔台分頁 `--set-role tower`、`bat-terminal.mjs` 派一個執行 shell 命令的「Worker」、`bat-notify.mjs` 回報、`--close-worker` 回收），畫面上看到分頁標題 `· Tower` / `· Worker · T1024`、縮圖 `✓`、回收（選做放首頁或 `/control-tower`）
3. **Worker 縮圖 ⚠️ / `?` / `✓` 與「關閉已回報的 Worker 分頁（N）」**特寫
4. **Worker 問塔台**（通知 + 答覆）
5. **`/features` 各節**：檔案瀏覽器、Git 檢視、Snippet、設定 / 狀態列等（對應 `TODO(W3)` 的位置）
6. **`/remote/`**：配置面板、新增設定選單、WSL / SSH / Docker 精靈第一步、編輯連線對話框（zh-TW，這批 i18n 修正後的畫面）。會實際安裝伺服器或需要真實主機 / Docker 的步驟不拍
7. **README**：換掉 `assets/screenshot-claude.png`、`screenshot-terminal.png`（及 README 其他引用的舊圖）

## 驗證

- `site/` 內 `npm run build`：0 錯誤、0 死連結；console 0；手機無水平捲動；reduced-motion 下短片不自動播放
- CT 字樣 / 內部編號 / 隱私 grep = 0；每張素材的隱私檢查表
- 截圖（不入版控）：放素材的頁面桌面 1440 / 手機 390 × 淺 / 深色
- `e2e/site-media.spec.ts` 不在預設 `npm run test:e2e` 執行範圍（或 CI 不跑），回報寫明如何手動執行
- 預覽伺服器用完已結束（L164）

## 驗收

- `TODO(W3)` 全數處理（放入素材，或寫明為何不放並移除註解）；README「擷圖」節換新
- 每張素材通過隱私清單；單檔大小符合建議值（或說明）
- 回報區附：素材清單（檔名、尺寸、大小、用在哪頁）、隱私檢查表、「需使用者手動拍」清單、手動執行 spec 的指令、給使用者的預覽指令、commit
- 未 push、未改 GitHub 設定；本機沒有殘留的預覽伺服器
