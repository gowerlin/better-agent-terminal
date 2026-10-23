---
schema_version: 1
schema_kind: workorder
id: T0699
title: "DELEGATE（CT 塔台 HANDOVER）：BAT 站加 CT Portal 連結、檢查 CaseCard 375px 橫捲、查證 `--close-worker` 最低 BAT 版本（D182）"
type: delegate
status: TODO
repo: better-agent-terminal
project: "網站（PLAN-049 後續）＋跨專案 HANDOVER"
priority: P3
sizing: S
created_at: "2026-10-23T09:13:48+0800"
depends_on: []
coordination:
  type: DELEGATE
  source:
    project: BMad-Guide
    prefix: ""
    workorder: _handover-2026-10-23-ct-portal-link
    task-ref: "P1 BAT 站加 CT Portal 連結；P2 CaseCard 375px 橫捲；P3 `--close-worker` 最低 BAT 版本"
related:
  - "來源 HANDOVER（只讀，不得修改）：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_handover-2026-10-23-ct-portal-link.md`"
  - "D182（本單決策，含 D159 改寫）；網站規則 D159 / D161 / D165 / D166 / D173；設計語言 `docs/design/site-design-language.md`"
  - "CT Portal：https://gowerlin.github.io/Control-Tower/ ；原始碼 https://github.com/gowerlin/Control-Tower （CaseCard 修法參考 commit `9e474ce`）"
affects_files:
  - site/.vitepress/config.mts
  - site/.vitepress/theme/components/CaseCard.vue
  - "site/.vitepress/theme/custom.css（或 CaseCard 樣式實際所在的檔案）"
  - site/index.md
  - site/control-tower.md
  - site/control-tower-tour.md
  - site/faq.md
  - "site/.vitepress/theme/**（只在需要共用網址設定或元件時）"
  - "README.md（只限相容表 `--close-worker` 相關列的版號，P3 查證結果需要修正時）"
  - "site/compatibility.md（同上，若該頁也列了同一項）"
  - _ct-workorders/T0699-delegate-ct-portal-link.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工先載入 `frontend-design` skill（清單沒有就照 `docs/design/site-design-language.md` 做，回報說明）。"
  - "🔴 P1 字樣規則（D182 / D165 / D166 / D173）：BAT 站只放「連到 CT Portal」的連結與一句說明，例如「Control Tower 的設計理念與使用說明」。**不得**寫「下載」「開源」「取得」「申請」，不得寫 CT 版本號、指令名稱、skill 名稱、CT 文件名、安裝步驟、CT 資料存放路徑；不得出現內部編號（`T0` 加三位數字、`D1` 加兩位數字、`BUG-`、`PLAN-`、`EXP-`）、`CLAUDE.md`。網站自己的路由與 `_ct-workorders/` 目錄名可以用。不得出現真實人名、公司名、客戶名。"
  - "🔴 P1 網址只寫一處：若 VitePress 設定或主題已有類似共用常數就沿用，沒有就在 `config.mts`（或主題的單一常數檔）定義一次，其他地方引用。外部連結比照站內既有外部連結的寫法（新分頁、`rel`、外部連結圖示）。"
  - "🔴 Worker 不 push、不改 GitHub 設定（D161 預覽關卡：塔台給使用者預覽後另取 push 授權）。非隔離工單，目前沒有其他 Worker。`Claude outputs/` 未追蹤資料夾不是你的，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不要跑 Playwright e2e。來源 HANDOVER 與 BMad-Guide repo 只讀，不得寫入。"
  - "🔴 yolo Worker：不得問使用者；範圍內的位置與文案自己決定並在回報說明；真正需要決定的事依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。不得在任何地方寫出權杖值。"
---

# T0699 — DELEGATE：BAT 站與 CT Portal 互連，並查證兩件事

## 目標

CT 塔台（BMad-Guide）交辦 HANDOVER：CT Portal 已上線，並已在導覽列、頁尾、延伸閱讀連到 BAT 站，但 BAT 站沒有反向連結。本單做三件事：

- **P1**：BAT 站加 CT Portal 連結。
- **P2**：檢查 BAT 站 CaseCard 在 375px 是否橫向捲動，有就修。
- **P3**：查證 `--close-worker` 最低 BAT 版本。

## 規格層級自問（塔台）

- 範圍小、無產品程式碼，網站沿用既有元件與設計語言，不需要另外寫 spec。
- D159 已依 D182 改寫：CT 的設計理念與使用說明公開，BAT 站可以連過去；CT skill 仍不開源，BAT 站自己不寫取得方式。

## 要做的事

### P1：CT Portal 連結

網址：`https://gowerlin.github.io/Control-Tower/`

1. 先看 BAT 站現有的導覽列、頁尾、外部連結慣例，選合適的位置。建議（擇合適者，不必全做）：
   - 導覽列或頁尾放一個「Control Tower 站」外部連結
   - `/control-tower`、`/control-tower-tour` 與 FAQ 的 Control Tower 段落加延伸閱讀
   - 首頁「不用 CT 也好用」附近加一句導引
2. 網址只定義一處（見 memory_overrides）。
3. 回報列出每個連結的位置與文案。

### P2：CaseCard 375px

1. 本機 `site/` 跑 build＋preview，在 375px 寬度量 `/cases` 等用到 CaseCard 的頁面：`document.documentElement.scrollWidth` 是否大於 375。量測工具自選，不得跑 Playwright e2e 測試套件。
2. 若 `.case-result`（或 BAT 對應的結果列）是 flex，且 slot 內有行內 `<code>` 或連結，就會出現 CT 說的問題。CT 的修法供參考，不必照抄：slot 外包一層 `<span class="case-result-text">`，加 `.vp-doc .case-result-text { min-width: 0; overflow-wrap: anywhere; }`。
3. 沒有橫捲也要寫回報：附量測數字，說明 BAT 的結構跟 CT 哪裡不同。有的話修完再量一次。
4. 修完後，375px 也順便檢查首頁、`/control-tower`、`/faq`（P1 新增連結的頁面），確認沒有橫捲。

### P3：`--close-worker` 最低 BAT 版本

1. 找出 `terminal:close-worker` / `bat-terminal.mjs --close-worker` 最早出現在哪個 tag：PLAN-041 / T0535，以及 T0545 等安靜、T0551。用 `git tag --contains <commit>`，找出最早的 `v0.6.1-pre.*` 和第一個公開的 release，附 commit 與 tag 證據。
2. 把 README 相容表裡和 `--close-worker` 有關的列（含「重派同一張工單前回收舊 Worker 分頁」那列），以及 `site/compatibility.md` 對應的列，跟查證結果比對。CT 側的說法是 BAT `>= 0.6.1-pre.3`。若 pre.3 和 pre.4 的差異只在某一項行為（例如等安靜、AMBIGUOUS 的語意），就把它寫出來。
3. 若 BAT 寫錯，就修 README 或 `site/compatibility.md` 的版號；若是 CT 寫錯，BAT 不改，結論寫在回報區，由塔台寫進回覆稿。

## 驗證

- `site/` 內 `npm run build` 0 錯誤、0 死連結
- 字樣 grep（`site/` 內新增或修改的內容）：`T0\d{3}`、`D1\d{2}`、`BUG-`、`PLAN-`、`EXP-`、`CLAUDE.md`、`下載 Control Tower`／`開源`、`ct-exec`、`control-tower` skill 名稱、`v5\.` 都是 0（網站路由 `/control-tower`、`/control-tower-tour` 除外）
- 375px 量測：修改前後的 `scrollWidth` 數字（P2）；P1 新增連結的頁面在 375px 不橫捲
- 桌面 1440 與手機 375 × 淺色、深色截圖：不入版控，放 scratchpad，回報附路徑
- 預覽伺服器用完要結束（L164）
- 若改了 README：只動相容表的版號

## 驗收

- P1：至少一個全站可見的 Portal 連結（導覽列或頁尾），加上 `/control-tower` 系列的延伸閱讀。網址只寫一處，字樣規則 grep = 0
- P2：有量測數字；有橫捲就已修好，375px 的 `scrollWidth` ≤ 375
- P3：附 tag／commit 證據的結論，指明 pre.3 還是 pre.4 正確，以及要改的是哪一邊
- commit（不 push），回報區附 SHA

## 回報區

（Worker 填寫）
