---
schema_version: 1
schema_kind: workorder
id: T0723
title: "T0722 後續：CHANGELOG `[Unreleased]` 記錄「Claude Agent」改名；重拍網站上仍顯示「Claude Agent V1 / V2」的截圖"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-01T10:00:48+0800"
started_at: "2026-11-01T10:01:51+0800"
updated_at: "2026-11-01T10:04:32+08:00"
completed_at: "2026-11-01T10:04:32+08:00"
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

- [x] CHANGELOG `[Unreleased]` 有改名一條，其他段落未變
- [x] `site/public/media/` 盤點表（檔名 / 是否含舊名稱 / 處置）
- [x] 含舊名稱且可由 spec 產生的截圖已換新；不能重產的列在「需使用者手動處理」
- [x] 網站建置成功、圖片引用不變
- [x] 截圖去識別化檢查結果

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**

### 落點檢查

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`CHANGELOG.md`、`site/public/media/` 皆存在 → present（資訊性）
- C-2：工單無 `branch` 欄位，不適用（目前 `main`）
- `CT_HOME` 未設（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 改動摘要

產品 commit：`9db0c8e2`（`git commit --only CHANGELOG.md site/public/media/agents-menu.png`）

1. `CHANGELOG.md`：`## [Unreleased]` 下新增 `### Changed` 一條（改名、worktree 版名稱、舊預設標題自動更新、自己改過的不動，附 T0722 / D194）。舊預設標題除工單列的 `Claude Agent V1` / `Claude Agent V2` 外，另列 `Claude Agent V1 (Worktree)`：`src/lib/retired-agent-presets.ts:42` 同樣會遷移它，寫上較完整。其他段落未動（diff 只有 +3 行）。
2. `site/public/media/agents-menu.png`：以 `e2e/site-media.spec.ts` 的 `screens` 測試（目前 `main`，含 T0722）重產後換掉，其他檔案不動。

未改 `release-note.md` / README / `site/**/*.md`（features.md 的 alt / caption T0722 已改，與新圖項目一致：終端、Claude Agent、Claude CLI、以塔台開啟 Claude、Codex Agent、Codex CLI、Gemini CLI、GitHub Copilot CLI、Demo Agent）/ `e2e/site-media.spec.ts`（spec 沒有寫死舊名稱，`grep "V1\|V2\|Claude Agent"` 無命中）。

#### `site/public/media/` 盤點表

判斷依據：逐張看圖（Read 圖片），影片對照 spec 拍攝步驟。

| 檔名 | 含舊名稱？ | 依據 | 處置 |
|---|---|---|---|
| `agents-menu.png` | **是**（「+」選單有 Claude Agent V1、Claude Agent V2） | 看圖 | spec 重產並替換 |
| `overview.png` | 否 | 看圖：只有 Demo Agent 分頁 | 不動 |
| `files.png` | 否 | 看圖 | 不動 |
| `git.png` | 否 | 看圖 | 不動 |
| `snippets.png` | 否 | 看圖 | 不動 |
| `statusline-settings.png` | 否 | 看圖 | 不動 |
| `remote-profiles.png` | 否 | 看圖 | 不動 |
| `remote-add-menu.png` | 否 | 看圖：選單只有新增 WSL / Docker / SSH 設定檔 | 不動 |
| `wizard-wsl.png` / `wizard-ssh.png` / `wizard-docker.png` | 否 | 看圖：精靈第一步 | 不動 |
| `clip-dispatch-poster.png` | 否 | 看圖：Demo Agent Tower / Worker | 不動 |
| `clip-dispatch.webm` / `clip-dispatch.mp4` | 否 | spec `clip` 測試步驟：派工 → Worker 跑測試回報 → 回收，全程不開「+」選單、不建立 Claude Agent 分頁；poster 同場景 | 不動 |
| `.sonar/`（目錄） | — | 非素材（SonarQube 暫存，未被網站引用） | 不動，見遭遇問題 |

#### 新舊 `agents-menu.png` 差異

- 尺寸一致：1922 × 1202（1280×800 視窗 × 1.5 縮放），構圖一致（同場景、同位置的「+」選單）。
- 改名造成：「Claude Agent V1」→「Claude Agent」，「Claude Agent V2」一列消失 → 選單少一列、上緣下移約 50 px。
- 非改名造成：
  - 選單的建議徽章由英文 `suggested` 變成 `建議`（10/18 拍攝之後 T0652 `15a792d4` 的 i18n 修正）；徽章文字變短，選單寬度略窄。
  - T1024 Worker 縮圖多顯示一行 `pass 3`、`duration_ms` 數值不同（測試實際執行時間不同，屬每次拍攝都會有的差異）。

### 驗證結果

| 項目 | 結果 | 證據 |
|---|---|---|
| `npx vite build` | PASS | HEAD `9e6c8c79`（T0722 後），建置完成 |
| site-media spec（`screens`） | PASS | `BAT_SITE_MEDIA=1 BAT_SITE_MEDIA_DIR=<scratchpad> npx playwright test e2e/site-media.spec.ts -g "screens"` → `1 passed (39.0s)`；輸出放 session scratchpad，未寫入 repo 的 `e2e-media/` |
| 隔離 | PASS | fixture 丟掉所有繼承的 `BAT_*` / `CT_*` / `ELECTRON_RUN_AS_NODE`、獨立 `--runtime`、`runtime userData removed: true`、`Terminal Server ... alive after teardown: false`；`BAT_SITE_MEDIA_ROOT` 預設 `D:at-demo` 執行前不存在、執行後已移除 |
| 網站建置（`site/` 的 `npm run build` = `vitepress build`；根 `package.json` 無 `docs:build`） | PASS | `build complete in 2.75s`；`site/.vitepress/dist/media/agents-menu.png` 為新檔（170290 bytes），`features.html` 引用 1 處 |
| 圖片引用不變 | PASS | `site/**/*.md` 內 14 個 `/media/...` 路徑逐一檢查，全部存在於 `site/public/media/` |
| 去識別化（D176） | PASS | 新圖畫面只有 spec 示範資料：工作區 demo-shop / demo-api / docs-site、Demo Agent 分頁、T1024–T1026 示範工單；無真名、家目錄路徑、權杖、使用者工作區（`Default:1` 為隔離實例的預設設定檔名） |
| `test:unit` | 未跑 | 工單指定不需要（只改文件與素材，未改 spec） |

### 需使用者手動處理

無。唯一含舊名稱的 `agents-menu.png` 已由 spec 重產；影片與其他手動拍攝的素材都不含舊名稱。

### 遭遇問題

- `site/public/media/.sonar/` 是本機的**空目錄**（10/18 建立，推測 SonarQube 掃描留下），git 不追蹤（`git ls-files` 無），本機建置會複製成空的 `dist/media/.sonar/`，CI / 部署從 clone 建置不受影響；不在本單範圍，未處理。
- 本機另有 `assets/screenshot-*.png`（README 用）不在本單 `affects_files`，未檢查也未改動；README 截圖為 overview / git / question，依檔名推測不含「+」選單。
- Playwright `screens` 測試順帶產出其他截圖（overview、files 等的新版），只替換了 `agents-menu.png`，其餘不換（非改名造成的差異，避免無謂變動）。

### 互動紀錄

無（未向塔台提問、未與使用者互動）。

### 回報時間

2026-11-01T10:04:32+08:00
