---
schema_version: 1
schema_kind: workorder
id: T0699
title: "DELEGATE（CT 塔台 HANDOVER）：BAT 站加 CT Portal 連結、檢查 CaseCard 375px 橫捲、查證 `--close-worker` 最低 BAT 版本（D182）"
type: delegate
status: DONE
repo: better-agent-terminal
project: "網站（PLAN-049 後續）＋跨專案 HANDOVER"
priority: P3
sizing: S
created_at: "2026-10-23T09:13:48+0800"
started_at: "2026-10-23T09:15:27+08:00"
updated_at: "2026-10-23T09:24:50+0800"
completed_at: "2026-10-23T09:24:50+0800"
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

### 結果摘要

- **狀態**：DONE（P1 / P2 / P3 的 Worker 步驟全數完成；未 push）
- **P1**：導覽列下拉選單與側欄各加一個「Control Tower 站」外部連結；`/control-tower`、`/control-tower-tour` 的說明框、FAQ 新問答、首頁分工段落各加一處。網址只寫在 `config.mts` 一處，字樣 grep = 0（只剩允許的路由 `/control-tower-tour`）
- **P2**：修改前 375px 沒有橫捲（`scrollWidth` = 375）。BAT 的 `.case-result` 也是 flex，目前三個結果欄都是純文字，所以沒出問題；在結果欄塞入行內 `<code>`＋連結的壓力測試會溢出（332 > 327）。已做預防性修正，修正後壓力測試 325 ≤ 327
- **P3**：BAT 寫的 `>= 0.6.1-pre.4` 是對的；CT 寫的 `>= 0.6.1-pre.3` 只在「指令存在」的意義上成立。BAT 不改，結論交塔台寫進回覆稿

### 落點檢查

- **PASS**。C-0：`repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` → PASS；C-1：工單在 `REPO_ROOT/_ct-workorders/` 底下 → PASS；C-3：`site/.vitepress/config.mts` 等檔案存在 → present（C-0 已 PASS，只記錄）；C-2：工單沒有 `branch` 欄位，不適用
- 非 worktree（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 已載入 `frontend-design` skill，並依 `docs/design/site-design-language.md` 做（連結沿用 `--bat-signal-text`，A1：紫色 = 連結）

### P1：連結位置與文案

網址常數：`site/.vitepress/config.mts` 的 `CT_PORTAL_URL = 'https://gowerlin.github.io/Control-Tower/'`，經 `themeConfig.ctPortalUrl` 給頁面使用。原始碼裡只出現這一次（`site/` 與 `README.md` 內 grep `gowerlin.github.io/Control-Tower` 只命中 `config.mts:14`）。

| # | 位置 | 文案 | 寫法 |
|---|---|---|---|
| 1 | 導覽列「與 Control Tower 協作」下拉選單最後一項（全站可見；手機在選單內） | `Control Tower 站` | `nav` 項目 `link: CT_PORTAL_URL`；VitePress 自動加 `target="_blank"`、`rel="noreferrer"`、外部連結圖示 |
| 2 | 側欄「與 Control Tower 協作」群組最後一項（所有文件頁） | `Control Tower 站` | `sidebar` 項目，同上 |
| 3 | `/control-tower` 開頭的說明框「Control Tower 目前未公開提供」 | 新增一段：「Control Tower 的設計理念與使用說明，見 Control Tower 站。」 | `<CtPortalLink />` |
| 4 | `/control-tower-tour` 開頭的同一個說明框 | 同上 | `<CtPortalLink />` |
| 5 | `/faq`「Control Tower」段新增問答 `### Control Tower 的設計理念與使用說明在哪裡？ {#ct-portal}` | 「在 Control Tower 站。這個網站只介紹 BAT，以及 BAT 和 Control Tower 怎麼一起用。」 | `<CtPortalLink />` |
| 6 | 首頁「BAT 提供跑道，Control Tower 提供調度」段，「看塔台、Worker 與 BAT 怎麼分工」下一行 | `Control Tower 的設計理念與使用說明` | `<p><CtPortalLink>…</CtPortalLink></p>`；`.home-more p + p` 間距 12px |

- `CtPortalLink`（`site/.vitepress/theme/components/CtPortalLink.vue`，新增）：`target="_blank"`、`rel="noreferrer"`，與站內既有外部連結相同；另帶 `vp-external-link-icon` class，讓沒有 `.vp-doc` 的首頁也顯示外部連結圖示（實測 `::after` 的 content 為 `""`、寬 11px）。
- 沒採用的建議位置與原因：
  - 頁尾：VitePress 預設主題只在沒有側欄的頁面（首頁）顯示頁尾；全站可見改由導覽列＋側欄達成。
  - 首頁「不用 Control Tower，BAT 也好用」：這段講不用 CT 的情況，放 CT 連結會打斷語意；改放在講分工的段落（#6）。
  - FAQ「Control Tower 去哪取得？」的答案：連結放在「取得」問題底下，等於把 Portal 當成取得管道，與 D182「BAT 站自己不寫取得方式」衝突，所以另開問答（#5）。`/control-tower`、`/control-tower-tour` 頁尾 FAQ 的同名問答也不動。
- 字樣 grep（`git diff -U0 -- site` 的新增行＋新元件全文）：`T0\d{3}` 0、`D1\d{2}` 0、`BUG-` 0、`PLAN-` 0、`EXP-` 0、`CLAUDE.md` 0、`下載` 0、`開源` 0、`取得` 0、`申請` 0、`ct-exec` 0、`ct-done` 0、`v5\.` 0；`control-tower` 1（既有路由 `/control-tower-tour` 因為行尾加逗號而出現在 diff，允許）。FAQ 錨點原本取 `#control-tower-docs`，為了讓 grep 乾淨改成 `#ct-portal`。

### P2：CaseCard 375px

量測方式：`site/` 內 `npm run build` → `npx vitepress preview --port 4319`；Chrome DevTools MCP 模擬 375×812（DPR 2、mobile），以 `evaluate_script` 讀 `document.documentElement.scrollWidth`；其他頁面以 375px 寬的 iframe 載入後讀取。沒有跑 Playwright。

| 項目 | 修改前 | 修改後 |
|---|---|---|
| `/cases` `scrollWidth`（innerWidth 375） | 375 | 375 |
| `.case-result` 寬 / `scrollWidth`（3 個） | 327 / 325 | 327 / 325 |
| `.case-result` 的 flex 項目 | `<b>` ＋ 匿名文字 | `<b>` ＋ `.case-result-text` |
| 壓力測試：結果欄複本加入長行內 `<code>`＋連結 | `scrollWidth` 332 > 327（溢出）；`code`、`a` 各自成為 flex 項目 | `scrollWidth` 325 ≤ 327；只有 2 個 flex 項目 |
| 首頁 / `/control-tower` / `/control-tower-tour` / `/faq` / `/compatibility` | 375 / 375 / 375 / 375 / 375 | 375 / 375 / 375 / 375 / 375（`/cases` 也是 375） |

- **BAT 和 CT 的差異**：結構相同（`.case-result` 是 `display: flex`，`<b>結果</b>` 後面直接放 slot），一樣會出現 CT 說的問題；BAT 沒有橫捲，只是因為 `cases.md` 現有三個 `#result` 都是純文字，沒有行內 `<code>` 或連結。
- **修正**（預防性，參考 CT `9e474ce`）：`CaseCard.vue` 的 result slot 外包 `<span class="case-result-text">`；`custom.css` 加 `.vp-doc .case-result-text { min-width: 0; overflow-wrap: anywhere; }`。現有三個案例的寬度與 `scrollWidth` 不變。
- 量測插曲：第一次 rebuild 後沒有重啟 preview，preview 只認得啟動時的資產清單，新 hash 的 CSS 404、頁面沒有樣式，當時量到的「修改後」數字無效、已捨棄。重啟 preview 後重量，上表是有樣式時的數字。

### P3：`--close-worker` 最低 BAT 版本

| commit | 內容 | 最早 tag（`git tag --contains`） |
|---|---|---|
| `f26b7641` | T0535：`bat-terminal.mjs --close-worker` / `terminal:close-worker`；exit 0 / 3 NOT_FOUND / 4 NOT_OWNER / 5 AMBIGUOUS / 6 BUSY / 1 | `v0.6.1-pre.3` |
| `26f6996e` | T0536：遠端 headless 的 `--close-worker` | `v0.6.1-pre.3` |
| `e965f993` | T0537：BAT 重開後仍認得 Worker 歸屬 | `v0.6.1-pre.3` |
| `2321c719` | T0545（D145）：等輸出安靜再關，不再回 exit 6 BUSY，延遲期間的輸出不再取消 | `v0.6.1-pre.4` |
| `92655e00` | T0551（BUG-140）：終端自動回應（focus report 等）不算使用者輸入 | `v0.6.1-pre.5` |

- 祖先關係：`git merge-base --is-ancestor f26b7641 v0.6.1-pre.2` → 否；`2321c719` 不在 `v0.6.1-pre.3` 內。tag 指向的 commit：pre.2 `9dde59f3`（2026-10-15 13:28）、pre.3 `95d1f8e5`（10-15 17:47）、pre.4 `e3e86496`（10-16 01:59）、pre.5 `6ad3c089`（10-16 05:13），皆 +0800。
- 公開 release（`gh release view -R gowerlin/better-agent-terminal`）：`v0.6.1-pre.3` 發布於 2026-10-15T10:06:08Z、`v0.6.1-pre.4` 發布於 2026-10-15T18:07:16Z，都是 prerelease、非 draft。`gh release list --limit 200` 裡沒有非 prerelease 版本，所以第一個公開帶有這個指令的 release 是 `v0.6.1-pre.3`，收單後回收真正能用的是 `v0.6.1-pre.4`。
- **pre.3 和 pre.4 的差異只在一項行為：等安靜**。pre.3：分頁 5 秒內有輸出 → 拒絕（exit 6 BUSY）；延遲期間有新輸出 → 取消排程。Worker 剛回報時 agent 幾乎一定還在輸出，所以 pre.3 的收單後回收多半回 BUSY 或被取消。pre.4 起改成到期後等連續安靜 5 秒（最多再等 60 秒）。exit code 與 AMBIGUOUS 的語意從 pre.3 起沒變：`git log -S AMBIGUOUS -- electron/close-worker.ts scripts/bat-terminal.mjs` 只命中 `f26b7641` 與 `77c93c64`（T0585，`--worktree-status` 的 AMBIGUOUS，與回收無關）。
- 補充（不影響最低版本）：pre.5 之前，延遲期間在 BAT 內切換分頁 / 工作區產生的 focus report 會被當成使用者輸入而取消回收（BUG-140，pre.4 實機觀察到一次），分頁保留、塔台只看到 exit 0。
- **README 相容表比對**（`site/compatibility.md` 以 `<!--@include: ../README.md#compatibility-->` 引用同一份，沒有另外列）：
  - 「收單後自動回收 Worker 分頁」`>= 0.6.1-pre.4` → 正確（需要等安靜）。
  - 「重派同一張工單前回收舊 Worker 分頁（避免回收時 `AMBIGUOUS`）」`>= 0.6.1-pre.4（沿用 --close-worker）` → 維持。pre.3 已能回收「沒有在輸出」的舊分頁，但舊分頁還在輸出時會回 BUSY，不會等待，與依等待行為寫的流程不同。
- **結論**：BAT 不改 README / `site/compatibility.md`。CT 側建議改寫成 `>= 0.6.1-pre.4`；若要保留 pre.3，請註明「pre.3 有這個指令，但分頁剛有輸出會回 exit 6 BUSY，延遲期間有輸出就取消」。由塔台寫進回覆稿。

### 驗證

| 關卡 | 結果 | 證據 |
|---|---|---|
| `site/` 內 `npm run build` | PASS | 最後一次 `build complete in 3.25s`；`npm run build 2>&1 \| grep -i "warn\|dead\|error"` 無輸出（VitePress 遇到死連結會讓 build 失敗） |
| 網址只寫一處 | PASS | 原始碼只有 `config.mts:14`；dist 有 16 個 HTML 含這個網址（導覽列 / 側欄 / 內文） |
| 字樣 grep | PASS | 見 P1 |
| 375px 量測 | PASS | 見 P2 表；P1 新增連結的頁面（首頁、`/control-tower`、`/control-tower-tour`、`/faq`）都是 375 |
| 1440 / 375 × 淺色 / 深色截圖 | PASS | 見下方清單（不入版控） |
| 預覽伺服器結束 | PASS | TaskStop 結束背景工作後，以 PowerShell 比對 CommandLine 結束殘留的 `vitepress preview --port 4319` node 程序；最後 `Get-NetTCPConnection -LocalPort 4319 -State Listen` 為 0 筆 |
| README | 未改 | P3 結論不需要改 |

截圖（Chrome DevTools MCP，獨立 browser context 的新分頁，拍完已關閉該分頁）：

- `<scratchpad>\t0699\1440-dark-control-tower-nav.png`（導覽列下拉選單展開、側欄、說明框）
- `<scratchpad>\t0699\1440-light-control-tower-nav.png`
- `<scratchpad>\t0699\1440-dark-home.png`
- `<scratchpad>\t0699\1440-light-home.png`
- `<scratchpad>\t0699\375-dark-control-tower.png`
- `<scratchpad>\t0699\375-light-control-tower.png`
- `<scratchpad>\t0699\375-dark-home.png`
- `<scratchpad>\t0699\375-light-home.png`
- `<scratchpad>\t0699\375-dark-faq.png`
- `<scratchpad>\t0699\375-light-faq.png`

### 修改的檔案（commit `e9ad5b523f703230bbc2f0e112e3f9bd6dbc7fc0`，未 push）

- `site/.vitepress/config.mts`：`CT_PORTAL_URL`、`ThemeConfig.ctPortalUrl`、nav / sidebar 項目
- `site/.vitepress/theme/components/CtPortalLink.vue`（新增）、`site/.vitepress/theme/index.ts`（註冊元件）
- `site/.vitepress/theme/components/CaseCard.vue`、`site/.vitepress/theme/custom.css`（`.case-result-text`、`.home-more p + p`）
- `site/control-tower.md`、`site/control-tower-tour.md`、`site/faq.md`、`site/index.md`

全部 LF；commit 用 `git commit --only <檔案>`；`Claude outputs/` 與 BMad-Guide repo 沒有碰。

### 偏離與注意事項

- P2 沒有橫捲，仍做了預防性修正（在 `affects_files` 內、現有版面不變）。塔台若不要，可以只還原 `CaseCard.vue` 與 `custom.css` 的 `.case-result-text` 段落。
- 工單 `status` 原為 `TODO`（不是 `PENDING`），照常改成 `IN_PROGRESS` → `DONE`。

### 後續建議

- 預覽與 push 依 D161，由塔台向使用者取得授權。
- P3 結論由塔台寫進 `_reply-2026-10-23-ct-portal-link.md`。

### 互動紀錄

- 無提問（範圍內的位置與文案依工單自行決定，理由見 P1）。
