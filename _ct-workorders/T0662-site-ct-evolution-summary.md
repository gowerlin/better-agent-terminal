---
schema_version: 1
schema_kind: workorder
id: T0662
title: "PLAN-049：「Control Tower 功能導覽」頁加一節「Control Tower 怎麼長出來的」——以七個世代講設計思路，不寫版本號 / 檔名 / 命令名稱（D170）"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-049
priority: P3
sizing: S
created_at: "2026-10-18T21:07:54+08:00"
started_at: "2026-10-18T21:08:46+08:00"
updated_at: "2026-10-18T21:15:35+08:00"
completed_at: "2026-10-18T21:15:35+08:00"
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

## 回報區

### 結果摘要

- 狀態：**DONE**
- `/control-tower-tour` 在「使用情境」之後、「常見問題」之前新增 `## Control Tower 怎麼長出來的 {#evolution}`：一句導言 + 七個世代（每代「卡在 → 做法」，第 1 代用「起點」）+ 兩句收束（工單始終是唯一的交接方式；BAT / Control Tower 分工；連到 `/control-tower`、`/cases`）。位置照工單建議，未改到最後。
- 視覺：新增 `.tour-generations`（仿航管飛行進程條：左格「第 N 代」+ 名稱，右格兩行標籤；首尾粗線、中間細分隔線），沿用同頁 `.tour-layers` / `.tour-day` 的字級、顯示字體與分隔線，沒有新顏色、沒有紫色（A1）、沒有動畫；≤ 639 px 改單欄堆疊。未新增 Vue 元件（`StoryTimeline` 的「現在」時間線是一天的時間語意，不適合世代）。
- 頁面 frontmatter `description` 補一句「以及它一路演進的七代」。

### 修改檔案

- `site/control-tower-tour.md`（+45 / −1）
- `site/.vitepress/theme/custom.css`（+82，緊接在 `.tour-layers` 規則之後）
- `_ct-workorders/T0662-site-ct-evolution-summary.md`（本回報）

### 網站段落 → 演進史章節對照（只供內部核對，不上站）

| 網站段落 | 演進史章節 |
|---|---|
| 導言「經過七代，每一代都在解決前一代卡住的地方」 | 開頭摘要、「七個世代」 |
| 第 1 代 對話裡的指揮塔 | 七個世代 v1；「v1 → v2：把人手從傳輸線上拿掉」（v1 工作指引包、使用者複製貼回；03-25 / 03-27 手動分工的前史） |
| 第 2 代 工單檔案 | 七個世代 v2；「v1 → v2」（工作指引寫進檔案、只給工單號碼、時間戳與回報寫回工單、使用者剩兩個動作） |
| 第 3 代 分開跑、會學習 | 七個世代 v3；「塔台和 Worker 分開跑」（v3.0 禁令一起載入 → v3.1 拆開）；「三層資料」（學習寫回 skill 被升級覆蓋 → 唯讀 / Global / Project） |
| 第 4 代 接上 BAT | 七個世代 v4（BUG／PLAN／EXP、決策日誌、研究型工單、BAT 整合、YOLO）；「派工迴路」（v4.1 派工與回報閉合） |
| 第 5 代 規則只寫一處 | 七個世代 v5.0；「metadata 改用 frontmatter」；「SKILL.md 改成路由器」；「一條規則只寫一處」；派工迴路表 5.0.4 / 5.0.5（Landing Zone Check、repo 身分） |
| 第 6 代 管理分頁 | 七個世代 v5.1–5.2（收單後回收 Worker 分頁、啟動時宣告塔台）；BAT 端的塔台分頁標題見 CLAUDE.md「塔台分頁標題」 |
| 第 7 代 看得見、問得到 | 七個世代 v5.2.4–5.9（範圍權杖、worktree 隔離、Worker 問塔台、看得到 blocked、確認啟動、codex 分頁、BAT 先定介面再委派）；「派工迴路」第二段 |
| 收束「工單始終是唯一的交接方式 / BAT 與 CT 分工」 | 「塔台和 Worker 分開跑」末段（只靠工單檔案交換）；與 `/control-tower`「分工」節一致 |

刻意省略（字樣規則或篇幅）：版本號、各版發行大小、行數 4,938 → 865、Fast Path 次數、委派單 / 決策 / BUG 編號、5.0.3 刪除的機制、跨 session 選收件人（第 7 代只寫到「看得見、問得到」，避免多一個需要解釋的概念）、四級能力 / 多塔台 / 新手教學（初稿寫在第 3 代，為壓篇幅刪除；同頁上方已有專節）。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `frontend-design` skill 載入 | PASS | 開工即載入；設計決策見上「視覺」 |
| `site/` `npm run build` | PASS | `build complete`，0 錯誤；VitePress 預設遇死連結即失敗，build 成功 = 0 死連結 |
| 新段落字樣 grep | PASS = 0 | `v[0-9]+\.`、`SKILL`、`CHANGELOG`、`frontmatter`、`T0\d{3}`、`D1\d{2}`、`BUG-\d+`、`PLAN-\d+`、`CT-T`、`_ct-workorders`、`CLAUDE.md`、`.md`、`*指令`、`$變數`、`ct-*` skill 名、`claude.ai`、`BMad-Guide`、點分版號、`KB/bytes/zip`、使用者路徑、`skill`、權杖 / `@` 全部 0；斜線開頭字樣去掉 HTML 標籤與站內路由 `./control-tower`、`./cases` 後 0 |
| 全站內部編號 grep（`site/` md / vue） | PASS = 0 | `T0\d{3}\|D1\d{2}\|BUG-\d+\|PLAN-\d+\|_ct-workorders\|CLAUDE.md` |
| 篇幅 | PASS（約 1.5 屏） | 1440×900：新節 1394 px（初稿 1652 px，刪字 + 收窄欄寬後）；同頁其他節 604–1684 px（「一天的基本流程」1330、「工單的狀態與驗收」1684） |
| 手機無水平捲動 | PASS | 390 寬：`scrollWidth` = `clientWidth` = 390，`.tour-generations` 內超出視窗的元素 0 |
| reduced-motion | PASS | `prefers-reduced-motion: reduce` 下 `document.getAnimations().length` = 0（本節本來就沒有動畫） |
| 截圖（不入版控） | 完成 | 見下 |
| 預覽伺服器結束 | PASS | port 4179 已無 listener |
| 未跑 Playwright e2e | 照工單 | — |

截圖（scratchpad）：

- `<使用者資料夾>\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\9656a92b-e152-4684-a663-3663705a133a\scratchpad\t0662-1440-light-1.png`（桌面淺色，第 1–5 代）
- `<使用者資料夾>\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\9656a92b-e152-4684-a663-3663705a133a\scratchpad\t0662-1440-light-2.png`（桌面淺色，第 4–7 代與收束）
- `<使用者資料夾>\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\9656a92b-e152-4684-a663-3663705a133a\scratchpad\t0662-1440-dark.png`（桌面深色）
- `<使用者資料夾>\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\9656a92b-e152-4684-a663-3663705a133a\scratchpad\t0662-390-light.png`（手機淺色，第 6–7 代與收束）
- `<使用者資料夾>\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\9656a92b-e152-4684-a663-3663705a133a\scratchpad\t0662-390-dark.png`（手機深色，開頭與第 1–3 代）

### 文案校稿（bmad-editorial-review-prose）採納清單

全部採納：

1. 導言「每一代都是被實際用到卡住的地方逼出來的」→「每一代都在解決前一代實際用起來卡住的地方」（主被動混用）
2. 第 2 代「Worker 只要拿到工單編號，開工與完成時間、回報都寫回…」斷句（主語不同）；後為壓篇幅再改寫為「開工與完成時間、回報都寫回同一張工單。你只要告訴 Worker 工單編號，做完回塔台說一聲。」
3. 第 3 代「工具本身」→「Control Tower 本身」（指涉不明，可能被讀成 Claude Code / BAT）
4. 第 3 代「塔台與 Worker 拆開」→「塔台與 Worker 的規則拆開」（受詞不明）
5. 第 7 代「每個分頁只拿到自己的權限」→「每個分頁各有自己的權限」（與 `/control-tower` 用語一致）
6. 收束句冒號改句號（冒號後不是前句的說明）

校稿後另做：第 5 代名稱「一條規則只寫一處」→「規則只寫一處」（144 px 欄寬下會折行）。

### 給使用者的預覽指令

```bash
cd site
npm run build
npx vitepress preview --port 4179
# 開 http://localhost:4179/better-agent-terminal/control-tower-tour#evolution
```

注意：`vitepress preview` 啟動時就固定了檔案清單，重新 build 後要重啟它，否則新的 CSS 雜湊檔回 404（本次實測）。

### Commit

- 產品：`603be1f9` docs(site): T0662 add Control Tower evolution section to tour page（`git commit --only` 兩個檔案）
- 工單：本回報的 commit（見 git log）
- 未 push；`src/styles/settings.css` 的 M 未動

### Landing Zone Check

- PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1：工單位於 REPO_ROOT 下；C-3：`site/control-tower-tour.md` 存在；C-2：無 `branch` 欄位（目前 `main`）。
- 非隔離工單：`CT_HOME` 未設定。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 偏差與遭遇問題

- 工單 `status` 原為 `TODO`（非 `PENDING`），開工時直接改為 `IN_PROGRESS`。
- 第一次重啟預覽伺服器時，`TaskStop` 只結束了 shell，vitepress 的 node 程序（PID 39908）仍佔用 4179；確認命令列後以 `Stop-Process` 結束。最後一次也以命令列比對結束 vitepress preview 程序，port 已釋放。
- 沒有向塔台提問。

### 互動紀錄

- 無（yolo，未提問）。
