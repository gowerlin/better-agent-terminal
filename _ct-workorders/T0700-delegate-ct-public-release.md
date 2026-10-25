---
schema_version: 1
schema_kind: workorder
id: T0700
title: "DELEGATE（CT 塔台 HANDOVER）：BAT 站把「Control Tower 目前未公開提供」改成取得方式，連到 CT Portal 安裝頁（D183）"
type: delegate
status: TODO
repo: better-agent-terminal
project: "網站（PLAN-049 後續）＋跨專案 HANDOVER"
priority: P3
sizing: S
created_at: "2026-10-25T08:58:47+0800"
started_at: ""
updated_at: "2026-10-25T08:58:47+0800"
completed_at: ""
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

（Worker 填寫）
