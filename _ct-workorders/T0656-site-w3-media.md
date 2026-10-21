---
schema_version: 1
schema_kind: workorder
id: T0656
title: "PLAN-049 W3：網站與 README 的真實截圖 / 短片——`e2e/site-media.spec.ts`（手動執行、不進 CI）產生素材，隱私清單逐張檢查，填入 `TODO(W3)`，README 換新截圖"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T19:12:43+0800"
started_at: "2026-10-18T19:15:06+0800"
updated_at: "2026-10-18T19:45:55+0800"
completed_at: "2026-10-18T19:45:55+0800"
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

## 回報區

### 結果摘要

- **狀態**：DONE。10 個 `TODO(W3)` 全部換成真實截圖（`/features` 6 處、`/remote/` 4 頁各 1 處）；`/control-tower#lifecycle` 加一段派工短片（選做）；README「擷圖」節換成 3 張新圖，上游舊圖 4 張移除 / 替換。
- **素材產生**：新增 `e2e/site-media.spec.ts`（手動執行，未設 `BAT_SITE_MEDIA=1` 時 2 個 test 皆 skipped，`npm run test:e2e` / CI 不會跑）。隔離實例（`launchIsolated` + 自建 `recordVideo` 啟動，皆 `--runtime=e2e-site-media-*`、temp userData，結束後刪除），zh-TW，視窗 1280×800（本機 1.5 倍顯示縮放 → PNG 1922×1202）。
  - 示範內容全為虛構：`<磁碟>:\bat-demo\`（有 marker 檔才會建立 / 刪除，結束自動移除）下的 `demo-shop`（真 git repo，作者 Mei Chen / Leo Wang、`@demo-shop.example`，`GIT_CONFIG_GLOBAL` 指向示範設定、`GIT_CONFIG_NOSYSTEM=1`）、`demo-api`、`docs-site`；工單 T1024–T1026；shell 用 cmd、`PROMPT=$P$G`。
  - 塔台與 Worker 都是自訂 CLI「Demo Agent」（`demo-agent.cmd` → node 腳本），在**自己的分頁內**以自己的權杖執行 `bat-terminal.mjs`（`--set-role tower`、派工、`--answer`、`--close-worker`）、`bat-notify.mjs`（`--submit` 回報、`--ask` / `--wait-answer`）、`bat-hook.mjs permission-request`（⚠️）。T1024 的測試是真的 `node --test`。**沒有呼叫模型、沒有登入任何真實 Agent**。
  - 遠端精靈停在第一個問題：主行程 stub `wsl:list`（Ubuntu-24.04 / Debian）、`ssh:list-hosts`（dev-server / build-box）、`docker:status`、`docker:list-containers`、`remote:detect-tools`；不安裝伺服器、不出現使用者自己的 WSL 發行版或 SSH 別名。
  - 短片：Playwright `recordVideo`（WebM）→ ffmpeg 裁到情節區段並重新編碼 VP9（本機有 ffmpeg；沒有時 spec 只留原始 WebM）。
- **網站元件**：`MediaFigure.vue`（外框沿用終端底色、圖說 ≤ 40em、點圖開原尺寸、`loading="lazy"`、寬高屬性防版面跳動）、`DemoVideo.vue`（`muted loop playsinline controls`、poster、畫面進入視窗才播、捲出暫停、使用者按暫停後不再自動播、`prefers-reduced-motion: reduce` 不自動播放；文字等價說明放圖說）。樣式在 `custom.css`「真實截圖與短片」節。真實截圖**補充**既有示意元件，沒有取代任何一個。
  - 用 JS 控制播放、不寫 `autoplay` 屬性：`autoplay` 無法依 reduced-motion 關掉，且一頁只該有一個主要動態時刻（設計語言 § 6），所以只在畫面中播放。

### 素材清單

| 檔名 | 尺寸 | 大小 | 用在哪裡 |
|---|---|---|---|
| `site/public/media/overview.png` | 1922×1202 | 140 KB | `/features#workspaces` |
| `site/public/media/agents-menu.png` | 1922×1202 | 169 KB | `/features#agents` |
| `site/public/media/statusline-settings.png` | 1922×1202 | 175 KB | `/features#status-line`（設定清單；真實狀態列見手動拍清單） |
| `site/public/media/files.png` | 1922×1202 | 132 KB | `/features#files-git` |
| `site/public/media/git.png` | 1922×1202 | 150 KB | `/features#files-git` |
| `site/public/media/snippets.png` | 1922×1202 | 171 KB | `/features#snippets-voice` |
| `site/public/media/remote-add-menu.png` | 1922×1202 | 136 KB | `/features#remote-dev` |
| `site/public/media/remote-profiles.png` | 1922×1202 | 117 KB | `/remote/` |
| `site/public/media/wizard-wsl.png` | 1922×1202 | 187 KB | `/remote/wsl#wizard` |
| `site/public/media/wizard-ssh.png` | 1922×1202 | 188 KB | `/remote/ssh#wizard` |
| `site/public/media/wizard-docker.png` | 1922×1202 | 188 KB | `/remote/docker#wizard` |
| `site/public/media/clip-dispatch.webm` | 1280×800 VP9，16.2 s，無聲 | 211 KB | `/control-tower#lifecycle` |
| `site/public/media/clip-dispatch-poster.png` | 1922×1202 | 116 KB | 上列短片的 poster |
| `assets/screenshot-overview.png`（新） | 1922×1202 | 140 KB | README「擷圖」 |
| `assets/screenshot-question.png`（新） | 1922×1202 | 108 KB | README「擷圖」 |
| `assets/screenshot-git.png`（替換） | 1922×1202 | 150 KB | README「擷圖」 |

- 全部 ≤ 2 MB（最大 192 KB），未另外壓縮。
- 刪除：`assets/screenshot-claude.png`、`screenshot-terminal.png`、`screenshot-files.png`（刪前 grep：只有 README 引用前兩張，`screenshot-files.png` 沒有任何引用；T0622 / 本單的工單文字提到檔名不算引用）。
- spec 另外產出、**未入版控**（留在 gitignored 的 `e2e-media/`，日後要放可直接用）：`worker-badges.png`（縮圖 ✓ / ? / ⚠️ + 右鍵「關閉已回報的 Worker 分頁（1）」特寫）、`worker-batch-close.png`（批次關閉確認）、`worker-question.png`（= README 的 question）、`remote-tools.png`（遠端 AI 工具）、`remote-edit.png`（編輯連線對話框，T0655 之後的畫面）、`git-graph.png`。本單範圍只允許換 `TODO(W3)` 與在首頁 / 協作頁加短片，所以沒有放進其他段落。

### 隱私檢查表

檢查項（T0622 § 3-3）：① 權杖　② 使用者路徑 / 帳號（含 git user / email、Claude 帳號、狀態列用量與費用）　③ 私人 repo / 工作區 / 內部工單內容　④ CT 只出現 skill 名稱，不出現安裝路徑 / skill 內容 / 取得管道　⑤ 不沿用上游舊圖

| 檔案 | ① | ② | ③ | ④ | ⑤ | 備註 |
|---|---|---|---|---|---|---|
| overview.png / assets/screenshot-overview.png | PASS | PASS | PASS | PASS | PASS | 終端畫面一開始就清除，看不到提示字元路徑；工作區皆虛構 |
| agents-menu.png | PASS | PASS | PASS | PASS | PASS | 選單項目「以塔台開啟 Claude」是產品 UI 字樣 |
| statusline-settings.png | PASS | PASS | PASS | PASS | PASS | 只有項目名稱，沒有用量 / 費用數值 |
| files.png | PASS | PASS | PASS | PASS | PASS | 檔案樹是 demo-shop，無路徑列 |
| git.png / assets/screenshot-git.png | PASS | PASS | PASS | PASS | PASS | 作者為虛構的 Mei Chen / Leo Wang，畫面不顯示 email |
| snippets.png | PASS | PASS | PASS | PASS | PASS | 右側面板分頁標籤有「Skills」「Agents」「塔台」三個字，未展開，看不到任何 skill 清單 |
| remote-add-menu.png | PASS | PASS | PASS | PASS | PASS | 遠端設定為 127.0.0.1 + 假埠 |
| remote-profiles.png | PASS | PASS | PASS | PASS | PASS | 同上；不顯示權杖 |
| wizard-wsl.png | PASS | PASS | PASS | PASS | PASS | 發行版清單是 stub，不是本機實際的發行版 |
| wizard-ssh.png | PASS | PASS | PASS | PASS | PASS | 別名是 stub（dev-server / build-box），沒有讀使用者的 `~/.ssh/config` |
| wizard-docker.png | PASS | PASS | PASS | PASS | PASS | — |
| clip-dispatch.webm / clip-dispatch-poster.png | PASS | PASS | PASS | PASS | PASS | 派工指令 `demo-agent "/ct-exec T1024"` 打進 Worker 分頁後，畫面立即清除，影片中看不到；只有通知 toast「T1024: T1024 完成」 |
| assets/screenshot-question.png | PASS | PASS | PASS | PASS | PASS | — |
| （未上站）remote-edit.png | PASS | PASS | PASS | PASS | PASS | 權杖欄位顯示假值 `demo`；若日後要用仍可 |

- 網站 grep（`site/`，排除 node_modules / dist / cache）：`T0\d{3}`、`D1\d{2}`、`BUG-\d+`、`PLAN-\d+`、`_ct-workorders`、`CLAUDE.md` = **0**。本單 diff 內 CT 字樣（`ct-exec` / `bat-terminal` / `CT_` / `.claude` / `skills/`）= **0**；圖說只寫「Demo Agent 是自訂 CLI、照指令稿輸出」。隱私 grep（`<使用者>`、`C:\Users`、`/Users/`、`tonyqwang`、`batcap.`、`server-token`、email）只命中既有的 `site/install.md:62`（列出 userData 檔名 `server-token.json`，不是權杖內容，非本單變更）。
- `site/.vitepress/dist/releases.html` 含 `BUG-020` 等編號：來自既有的發行說明頁（抓 GitHub Release），不是本單的變更。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `npx vite build`（拍攝用產物） | PASS | HEAD `62c23edc`（已含 T0655 `02f1c6f8`），工作目錄另有非本單的 `src/styles/settings.css` 未提交變更（建置時一併帶入）；T0657 的 electron 變更是建置之後才出現的 |
| `BAT_SITE_MEDIA=1 npx playwright test e2e/site-media.spec.ts` | PASS | 2 passed（1.0 m）；Terminal Server 結束、runtime userData 已刪、`D:\bat-demo` 已移除 |
| 未設環境變數時 | PASS | 2 skipped |
| spec 型別檢查 | PASS | `npx tsc --noEmit --skipLibCheck --strict … e2e/site-media.spec.ts` 0 錯誤（`e2e/` 不在 `npm run typecheck` 範圍） |
| `site/` `npm run build` | PASS | build complete，0 錯誤；VitePress 預設死連結即失敗，未失敗 |
| 預覽檢查（7 個頁面位置 × 桌面 1440 / 手機 390 × 淺 / 深） | PASS | 0 頁面水平溢出、0 console error / warning、0 請求失敗、畫面內圖片皆載入；截圖在 scratchpad（不入版控） |
| 短片行為 | PASS | 一般模式：捲入畫面 2.5 s 後 `paused=false`；捲出後 `paused=true`；`reducedMotion: reduce`：`paused=true`、`currentTime=0` |
| 圖說校稿 | PASS | `bmad-editorial-review-prose`：1 處修正（README 主詞錯置），其餘無問題 |
| 預覽伺服器 | PASS | 用完已停止，`4178` 無監聽（L164） |

### 手動執行 spec

```bash
npx vite build
BAT_SITE_MEDIA=1 npx playwright test e2e/site-media.spec.ts            # bash
$env:BAT_SITE_MEDIA='1'; npx playwright test e2e/site-media.spec.ts   # PowerShell
```

- 輸出到 `e2e-media/`（已加入 `.gitignore`；不放在 `outputDir` `e2e-results/`，因為 Playwright 每次執行都會清空它），人工挑選後複製到 `site/public/media/` / `assets/`。
- `BAT_SITE_MEDIA_ROOT` 可改示範目錄（預設 `<repo 所在磁碟>:\bat-demo`，路徑短，提示字元不露使用者路徑；目錄已存在且沒有 marker 檔時拒絕執行）；`BAT_SITE_MEDIA_DIR` 可改輸出目錄。
- 有 ffmpeg 時短片自動裁剪並轉 VP9；沒有時只留 `clip-dispatch-raw.webm`（含開頭的設定畫面）。

### 給使用者的預覽指令

```bash
cd site
npm run build
npx vitepress preview --port 4178
# 開 http://localhost:4178/better-agent-terminal/features ，看完按 Ctrl+C 結束
```

### 需使用者手動拍

這些畫面需要真實的 Agent 對話或登入，本單沒有做，README 與網站也沒有預留位置（README 改用做得出來的畫面）。

| 畫面 | 建議放置 | 拍攝步驟 |
|---|---|---|
| Claude Code 面板的實際對話（工具呼叫、面板內回答權限確認） | `/features#agents`、README | 用 ScreenToGif（Windows）或 OBS 錄視窗；開示範專案（不要用私人 repo）、新的 Claude Code 面板，請它讀一個檔並改一行，錄權限確認那一刻；拍前把側欄工作區換成示範名稱，結束後檢查有沒有帳號 email |
| 真實狀態列（模型、Token、快取、費用、5h 用量） | `/features#status-line` | 同上，在對話幾輪之後擷取面板底部；用量 / 費用會入鏡，上站前要確認可以公開 |
| BAT MCP 查詢結果（`bat_whoami` / `bat_list_terminals`） | `/control-tower#visibility` | 在 BAT 開的 Claude CLI 分頁請它呼叫這兩個工具，擷取結果；或照 T0622 建議把 helper 輸出排成程式碼區塊，不用截圖 |
| Codex CLI 分頁實際執行 | `/features#agents` | 同 Claude；codex 需登入 |
| 語音輸入 | `/features#voice` | 需要麥克風與 Whisper 模型；錄 PromptBox 收音到出字 |

### 遭遇問題 / 偏離

- **`D:\demo` 殘留（請使用者手動刪除）**：第一次探索執行時，spec 的預設目錄還是 `D:\demo`，留下兩個空資料夾（`home`、`demo-shop`）和一個空的 `{}` 檔（0 位元組），都是本單建立的。Claude Code 內建的安全檢查擋下 `rm -rf D:/demo`（不能自動核准），所以沒有刪；之後把預設改成 `bat-demo`，並加上 marker 檔保護。`D:\demo` 請使用者確認後自行刪除。
- 精靈的 `USERPROFILE` 隔離不可行：把 `USERPROFILE` 改到示範目錄後，Electron 啟動時 `Failed to get 'userData' path`，所以改用 stub 擋住 SSH 別名 / WSL 發行版。
- Tower 每秒只能建立一個分頁（`HELPER_TOWER_CREATE_INTERVAL_MS`），派工步驟之間間隔 1.1 s。
- 拍攝時改成在 T0655 commit 之後重建、重拍；其餘截圖的 HEAD 見驗證表。

### 給塔台的後續建議（未處理，範圍外）

1. **精靈提問按鈕沒有樣式**：`SetupWizardShell.tsx` 的選項按鈕（發行版 / SSH 別名 / Docker 容器模式）用 Tailwind class（`rounded-md border border-sky-600 …`），但 App 沒有載入 Tailwind，實際顯示成白底的原生按鈕（見 `wizard-*.png`）。建議開 BUG。
2. **狀態列項目數不一致**：`/features#status-line` 寫「13 個項目」，`STATUSLINE_ITEMS`（`src/types/index.ts`）實際 19 個（截圖可見）；CLAUDE.md「Status Line」節的「13 configurable items」也一樣過時。
3. 縮圖右鍵選單的「Set as Supervisor」在 zh-TW 介面仍是英文（`worker-badges.png` 可見），可併入 i18n 清單。
4. WebM（VP9）在 Safari 舊版（iOS 17.4 以前）可能無法播放，這時只顯示 poster 和文字說明。需要時可用 ffmpeg 另出 H.264 MP4 當第二個 `<source>`。
5. `e2e-media/` 裡未上站的特寫（Worker 徽章、批次關閉、遠端 AI 工具、編輯連線、Git 圖譜）可在下一輪放進 `/control-tower#visibility` 等段落。

### Commit

- 產品：`c42ec5cb` feat(site): real screenshots and a dispatch clip from e2e/site-media.spec.ts (T0656)：32 個檔案，用 `git commit --only` 提交；未碰 `src/styles/settings.css` 與 T0657 的檔案。
- 工單：本檔另一個 commit。
- **未 push、未改 GitHub 設定。** 網站這批依工單規定，等下一個預覽版發佈後由塔台 push。

### 環境證據

- Landing check：C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` → PASS；C-1 PASS；C-3 PASS（`e2e/`、`site/`、`README.md` 皆存在）；C-2 無 branch 欄位。`CT_HOME` 未設（非隔離派工）。
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`。
- 開工時已載入 `frontend-design` skill；圖說以 `bmad-editorial-review-prose` 校過。

### 互動紀錄

- 無（yolo，沒有需要問塔台的事）。
