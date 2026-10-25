---
schema_version: 1
schema_kind: workorder
id: T0700
title: "DELEGATE（CT 塔台 HANDOVER）：BAT 站把「Control Tower 目前未公開提供」改成取得方式，連到 CT Portal 安裝頁（D183）"
type: delegate
status: DONE
repo: better-agent-terminal
project: "網站（PLAN-049 後續）＋跨專案 HANDOVER"
priority: P3
sizing: S
created_at: "2026-10-25T08:58:47+0800"
started_at: "2026-10-25T08:59:52+0800"
updated_at: "2026-10-25T09:02:53+0800"
completed_at: "2026-10-25T09:02:53+0800"
depends_on: []
coordination:
  type: DELEGATE
  source:
    project: BMad-Guide
    prefix: ""
    workorder: _handover-2026-10-25-ct-public-release
    task-ref: "BAT 站 5 處「Control Tower 目前未公開提供」改成取得方式"
related:
  - "來源 HANDOVER（只讀，不得修改）：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_handover-2026-10-25-ct-public-release.md`"
  - "D183（本單決策，改寫 D182 / D159）；網站規則 D161 / D165 / D166 / D173；前一張同類工單 T0699（Portal 連結、`CT_PORTAL_URL`、`CtPortalLink`）"
  - "CT Portal 安裝頁：https://gowerlin.github.io/Control-Tower/install"
affects_files:
  - site/.vitepress/config.mts
  - site/.vitepress/theme/components/CtPortalLink.vue
  - "site/.vitepress/theme/**（只在需要共用網址設定或元件時）"
  - site/control-tower.md
  - site/control-tower-tour.md
  - site/faq.md
  - "site/index.md（只在首頁有「未公開」同義說法時）"
  - _ct-workorders/T0700-delegate-ct-public-release.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工先載入 `frontend-design` skill（清單沒有就照 `docs/design/site-design-language.md` 做，回報說明）。沿用 T0699 的 `CT_PORTAL_URL` / `themeConfig.ctPortalUrl` / `CtPortalLink`，不要另寫一份 Portal 網址。"
  - "🔴 字樣規則（D183，改寫 D182）：可以寫 Control Tower 已公開、MIT 授權，以及「取得」「下載」「公開」「開源」等字樣，「去哪取得」連到 CT Portal 安裝頁。**仍不得**寫 CT 版本號（例 `v5.`、`ct-v`）、skill 名稱、指令名稱、CT 文件名、安裝 / 升級步驟、CT 資料存放路徑、GitHub Release 直連網址（取得細節只留在 Portal）；不得出現內部編號（`T0` 加三位數字、`D1` 加兩位數字、`BUG-`、`PLAN-`、`EXP-`）、`CLAUDE.md`、真實人名 / 公司名 / 客戶名。網站路由與 `_ct-workorders/` 目錄名可以用。"
  - "🔴 Worker 不 push、不改 GitHub 設定（D161 預覽關卡：塔台給使用者預覽後另取 push 授權）。非隔離工單，目前沒有其他 Worker。`Claude outputs/` 未追蹤資料夾不是你的，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不要跑 Playwright e2e。來源 HANDOVER 與 BMad-Guide repo 只讀，不得寫入。回報區的截圖路徑寫 `<scratchpad>/…`，不得寫出家目錄（D176 / L175）。"
  - "🔴 yolo Worker：不得問使用者；範圍內的位置與文案自己決定並在回報說明；真正需要決定的事依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。不得在任何地方寫出權杖值。"
---

# T0700 — DELEGATE：BAT 站改寫「Control Tower 目前未公開提供」

## 目標

CT 塔台（BMad-Guide）交辦 HANDOVER：Control Tower 2026-10-25 起正式公開（MIT 授權），安裝說明在 CT Portal `/install`。BAT 站還有 5 處寫「Control Tower 目前未公開提供」，要改成實際的取得方式。D183 已改寫 D182：BAT 站可以寫取得方式並連到 Portal 安裝頁，細節只留在 Portal。

## 規格層級自問（塔台）

- 範圍小、只改網站文案與一個網址常數，沿用 T0699 的元件與設計語言，不需要另外寫 spec。

## 要做的事

1. **安裝頁網址只定義一處**：在 `site/.vitepress/config.mts` 由 `CT_PORTAL_URL` 組出安裝頁網址（例如 `CT_INSTALL_URL = CT_PORTAL_URL + 'install'`），經 `themeConfig` 給頁面用；內文的連結比照 `CtPortalLink`（擴充成可指定目標，或另加一個元件，自己決定）。外部連結寫法比照站內既有慣例（新分頁、`rel`、外部連結圖示）。
2. **改寫 5 處**（行號以 HANDOVER 為準，開工前再 grep `未公開` 確認）：
   - `site/control-tower.md:75`、`site/control-tower-tour.md:19` 的 `::: info Control Tower 目前未公開提供` 區塊：標題改成「怎麼取得 Control Tower」之類，內容說明 CT 已公開（MIT 授權），取得與安裝方式見 Portal 安裝頁；原本「BAT 的派工、回報、提問與查詢介面是公開的…」那句仍成立，可保留；T0699 加的「設計理念與使用說明，見 Control Tower 站」也保留或併寫。
   - `site/control-tower.md:307`、`site/control-tower-tour.md:290`、`site/faq.md:75` 的「Control Tower 去哪取得？」答案：改成取得方式並連到安裝頁；整合點那句視語意保留。
3. 再 grep `site/` 有沒有其他「未公開」「不開源」「私下申請」「不提供取得」等同義說法（含首頁、`/cases`、`/compatibility`），有就一起改，回報列出位置；沒有也寫在回報。
4. 不改 `README.md`（塔台已確認 README 沒有同義說法）。

## 驗證

- `site/` 內 `npm run build` 0 錯誤、0 死連結
- grep：`site/` 內 `未公開` = 0
- 字樣 grep（`site/` 內新增或修改的內容）：`T0\d{3}`、`D1\d{2}`、`BUG-`、`PLAN-`、`EXP-`、`CLAUDE.md`、`ct-exec`、`control-tower` skill 名稱、`v5\.`、`ct-v`、`releases/tag` 都是 0（網站路由 `/control-tower`、`/control-tower-tour` 除外）
- Portal 安裝頁網址只出現在 `config.mts` 一處（grep `Control-Tower/install`）
- 確認安裝頁網址可開（`curl -sI` 或等價方式看 HTTP 200），回報附結果
- 375px 下改過的頁面（`/control-tower`、`/control-tower-tour`、`/faq`）`document.documentElement.scrollWidth` ≤ 375
- 桌面 1440 與手機 375 × 淺色、深色截圖：不入版控，放 scratchpad，回報附 `<scratchpad>/…` 形式的路徑
- 預覽伺服器用完要結束（L164）

## 驗收

- 5 處都改好，`未公開` grep = 0；「去哪取得」連到 Portal 安裝頁
- 網址只寫一處；字樣規則 grep = 0
- build 0 錯誤、0 死連結；375px 不橫捲
- commit（不 push），回報區附 SHA

## 回報區

### 結果摘要

**DONE**。BAT 站 5 處「Control Tower 目前未公開提供」都改成取得方式，「去哪取得」連到 CT Portal 安裝頁；安裝頁網址只在 `config.mts` 組出一次。

### 落點檢查（Landing Zone）

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = main repo 根目錄；`CT_HOME` 未設定，非隔離工單）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`site/.vitepress/config.mts`、`CtPortalLink.vue`、`control-tower.md`、`control-tower-tour.md`、`faq.md` 都存在 → PASS（資訊性）
- C-2：工單無 `branch` 欄位；目前在 `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 開工時工單 `status` 是 `TODO`（不是 `PENDING`），視同未開工，改成 `IN_PROGRESS`

### 設計依據

- `frontend-design` skill 已載入。本單只改文案與連結，沿用站上既有的 `::: info` 區塊、`CtPortalLink` 的外部連結寫法（新分頁、`rel="noreferrer"`、`vp-external-link-icon` 圖示），沒有新增樣式。

### 改了什麼

1. **網址只寫一處**：`site/.vitepress/config.mts` 新增 `CT_INSTALL_URL = CT_PORTAL_URL + 'install'`，經 `themeConfig.ctInstallUrl` 給頁面用（`ThemeConfig` 介面同步加欄位）。
2. **元件擴充**：`CtPortalLink` 加選填 prop `to="install"`，給了就連安裝頁、預設文字「Control Tower 安裝頁」；不給時行為與文字和原本完全相同（首頁、`faq.md#ct-portal` 既有用法不受影響）。選擇擴充而不另寫元件，是為了讓外部連結的寫法只有一份。
3. **5 處文案**（行號為改寫前）：
   - `site/control-tower.md:75`、`site/control-tower-tour.md:19`：標題改成「怎麼取得 Control Tower」，第一段「Control Tower 已經公開，採 MIT 授權。取得與安裝方式見〈安裝頁〉，設計理念與使用說明見〈Control Tower 站〉。」（把原本的 Portal 那句併寫進來）；第二段保留原本的整合點說明（`control-tower.md` 的「都是公開的」改成「也是公開的」）。
   - `site/control-tower.md:307`、`site/control-tower-tour.md:290`、`site/faq.md:75`「Control Tower 去哪取得？」：「Control Tower 已經公開，採 MIT 授權。取得與安裝方式見〈安裝頁〉。想接上自己的流程，BAT 的派工、回報、提問與查詢介面也是公開的，見〈BAT 提供的整合點〉。」整合點那句保留、改成補充語氣。
4. **同義說法再 grep**：`site/` 內 `未公開|不開源|私下|不提供|不公開|沒有公開|尚未公開|不對外|未開源|內部使用|申請|邀請`，除了上面 5 處，只剩 `site/remote/docker.md:11`、`:111`、`site/remote/index.md:10`、`site/remote/ssh.md:53`，講的是 BAT 自己的 Docker 映像 / 伺服器埠，與 Control Tower 無關，不改。首頁、`/cases`、`/compatibility` 沒有同義說法。
5. `README.md` 未改（照工單）。

### 驗證

| 項目 | 結果 |
|---|---|
| `site/` 內 `npm run build` | **PASS**：exit 0、`build complete in 3.50s`；站台設定沒有 `ignoreDeadLinks`，VitePress 遇死連結會直接失敗，所以 0 死連結 |
| `site/` 內 grep `未公開` | **0** |
| 字樣 grep（diff 新增行：`T0\d{3}`、`D1\d{2}`、`BUG-`、`PLAN-`、`EXP-`、`CLAUDE.md`、`ct-exec`、`control-tower`（排除路由）、`v5\.`、`ct-v`、`releases/tag`） | **0** |
| 安裝頁網址只寫一處 | 原始碼 grep 字面 `Control-Tower/install` = 0（網址由 `config.mts:17` `CT_PORTAL_URL + 'install'` 組出，是唯一定義處）；build 產物中 `control-tower.html` / `control-tower-tour.html` / `faq.html` 都有正確的 `https://gowerlin.github.io/Control-Tower/install` |
| 安裝頁可開 | `curl -sI -L https://gowerlin.github.io/Control-Tower/install` → `HTTP/1.1 200 OK` |
| 連結屬性 | 3 頁的安裝頁連結都是 `target="_blank"`、`rel="noreferrer"`，文字「Control Tower 安裝頁」（`/control-tower` 2 個、`/control-tower-tour` 2 個、`/faq` 1 個） |
| 375px 不橫捲 | `/control-tower`、`/control-tower-tour`、`/faq` 淺色 / 深色的 `document.documentElement.scrollWidth` 都 = **375**（1440 時 = 1440） |
| 截圖（不入版控） | `<scratchpad>/shots/`，共 20 張：`{control-tower,control-tower-tour}-info-{1440,375}-{light,dark}.png`（info 區塊）與 `{control-tower,control-tower-tour,faq}-get-{1440,375}-{light,dark}.png`（「去哪取得」段落）；抽看 `control-tower-info-375-dark.png`、`faq-get-1440-light.png`，排版正常 |
| 預覽伺服器 | `vitepress preview --port 4185` 用完已結束（背景工作停止後殘留的 node 子程序另以 PID 結束，確認 4185 無人監聽） |

- 量測與截圖用 repo 已有的 `playwright` 套件寫一支 scratchpad 腳本、以本機 Chrome（`channel: 'chrome'`）執行；不是 Playwright e2e，沒有跑 `npm run test:e2e`。Playwright 自帶的 chromium 沒下載，所以改用本機 Chrome。

### Commit

- 產品變更：`868326071c0869fa6c3c2b4d0a604c18c0bb5534`（`git commit --only` 5 個網站檔，未 push）
- 工單：另一個 commit（本回報與最終 metadata）

### 偏離與遭遇問題

- 無範圍偏離。`Claude outputs/` 與 BMad-Guide repo 沒碰。

### 後續建議

- 無。push 依 D161 預覽關卡由塔台另取授權。
