---
schema_version: 1
schema_kind: workorder
id: T0674
title: "網站新頁「把腦力留給判斷」（/why）：以認知負荷說明 BAT + CT 的設計初衷；首頁接一段、故事 7 章加「你不用再記住」、常見問題兩題、演進史收尾、導覽列（D175）"
type: feature
status: DONE
repo: better-agent-terminal
project: "網站（PLAN-049 後續，D175）"
priority: P3
sizing: M
created_at: "2026-10-21T16:30:06+0800"
started_at: "2026-10-21T16:33:52+08:00"
updated_at: "2026-10-21T16:44:30+08:00"
completed_at: "2026-10-21T16:44:30+08:00"
depends_on: []
related:
  - "D175（使用者四題決定：完整版範圍、外殼一節不提試驗細節、起點用作者第一人稱、頁名「把腦力留給判斷」/why）"
  - "網站規則：D159 / D161 / D164 / D165 / D166 / D170 / D173；規格 `_ct-workorders/_spec-site-v2-bat-ct-story.md` § 3 / § 7 / § 8；設計語言 `docs/design/site-design-language.md`"
  - "寫法比照：`/control-tower-tour` 的「Control Tower 怎麼長出來的」（T0662）與 `/cases`；首頁故事元件 `StoryTimeline` / `StoryChapter`"
affects_files:
  - site/why.md
  - site/index.md
  - site/control-tower.md
  - site/control-tower-tour.md
  - site/.vitepress/config.mts
  - site/.vitepress/theme/components/StoryChapter.vue
  - "site/.vitepress/theme/**（只在需要新元件或樣式時；優先沿用既有元件 `FeatureGrid` / `CardTable` / `GrowthLadder` / `CompareMatrix` 等）"
  - "docs/design/site-design-language.md（只在新增元件或樣式規則時補一句）"
  - _ct-workorders/T0674-site-why-cognitive-load.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 `frontend-design` skill；清單裡沒有 → `BLOCKED` 回報。文案完成後用 `bmad-editorial-review-prose` 校稿，回報採納清單。"
  - "🔴 字樣規則（D165 / D166 / D173，D175 追加）：網站不得出現內部編號（`T0` 加三位數字、`D1` 加兩位數字、`BUG-`、`PLAN-`、`EXP-`）、`CLAUDE.md`、CT 版本號（任何 `v` 加數字加點）、CT 文件名（含原則文件、`SKILL`、`CHANGELOG`）、塔台狀態檔與學習檔檔名、`frontmatter`、命令名稱、skill 名稱、星號 / 斜線 / 錢字號開頭的指令、CT 資料存放路徑、取得管道。`_ct-workorders/` 目錄名可以用（D173）。網站自己的路由（`/control-tower`、`/control-tower-tour`、`/why` 等）除外。示意只用 `demo-shop` 與 `T1024` 以後的虛構編號。"
  - "🔴 隱私（D175）：不得出現任何真實人名、公司名、客戶名、真實專案名、硬體型號，不連 Facebook / YouTube / claude.ai artifact。認知負荷理論只用通稱（可寫「認知負荷理論（Cognitive Load Theory）」），不引用特定文章或作者。不寫 Workflow 試驗、試驗數字、token 數、agent 數，也不出現「Workflow」這個功能名稱。"
  - "🔴 人稱：全站沿用「你」。第一人稱「我」只限新頁「起點」一節與作者學習順序那一小段（D175 第 3 點）。"
  - "🔴 準確性：不得誇大，不得與 BAT / CT 實際行為衝突；每個行為描述要能對到既有頁面（首頁故事、`/control-tower`、`/control-tower-tour`、`/features`）。回報區附「新文案 → 依據頁面 / 章節」對照（只供內部核對，不上站）。「外殼」一節要與首頁「越用越懂你的專案」相容：經驗會累積成規則與教戰手冊幫 Worker 判斷，但不會變成不准例外的劇本。"
  - "🔴 網站驗證：`site/` 內 `npm run build` 0 錯誤 0 死連結；字樣 / 隱私 grep（見下方「驗證」）= 0；新頁 frontmatter 有 `title` / `description`（比照其他頁，分享卡片與 sitemap 會用到）；桌面 1440 / 手機 390 × 淺 / 深色截圖（不入版控，放 scratchpad）；手機無水平捲動；reduced-motion 無動畫。預覽伺服器用完結束（L164）。"
  - "🔴 **Worker 不 push、不改 GitHub 設定**（D161 預覽關卡：塔台給使用者預覽後另取 push 授權）。非隔離工單，目前沒有其他 Worker。`Claude outputs/` 未追蹤資料夾不是你的，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不要跑 Playwright e2e。"
  - "🔴 yolo Worker：不得問使用者；範圍內的文案與視覺判斷自己決定並在回報說明；真正需要決定的事依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。不得在任何地方寫出權杖值。"
---

# T0674 — 網站新頁「把腦力留給判斷」：BAT + CT 的設計初衷

## 目標

網站現在講的是「做什麼、怎麼做」。首頁「7 個卡關時刻」與 `/control-tower-tour` 的演進史其實都在講同一件事：把原本要靠人記住、靠人手搬運的東西移出人的腦袋，只把判斷留給人。但全站沒有一處明說。本單把這條主線寫出來，並把既有內容串上去，讓讀者看得懂 BAT + CT 為什麼這樣設計。

**主旨句**（首頁新段落與新頁開頭都要出現，用字可微調但意思不變）：

> 記憶交給檔案，跑腿交給 BAT，判斷留給你。

## 規格層級自問（塔台）

- 目標層：執行（大綱與素材已定，Worker 寫成網站文案並實作）。
- 決策權：文案措辭、版面、是否新增元件、各節篇幅由 Worker 決定；頁名、網址、範圍、人稱、試驗細節不寫，已由使用者決定（D175），不得更改。
- 資訊完整度：本工單 + 既有網站頁面 + 設計語言文件即可完成。
- 回頭成本：A（文案與版面，可再改）。
- 記憶覆蓋：見 `memory_overrides`。

## 要做的事

### 1. 新頁 `site/why.md`：「把腦力留給判斷」

網址 `/why`，頁面標題與導覽文字都是「把腦力留給判斷」。建議 h2 與錨點如下（可微調順序與標題用字，不可漏節）：

1. **開頭導言**：主旨句，加一兩句說明這一頁要講什麼（BAT + CT 為什麼這樣設計）。
2. **起點** `{#origin}`（作者第一人稱）：我同時顧好幾個專案（可寫「三到七個」）。最常出事的不是 AI 不夠聰明，而是把 A 專案寫好的 prompt 貼進 B 專案：AI 用 A 的假設在 B 裡找檔案、燒了一堆 token 才回「找不到」；更糟的是沒發現貼錯，用 A 的邏輯改了 B 的程式。問題出在我的工作記憶裝不下「現在在哪個專案、脈絡是什麼、這段 prompt 該貼去哪」，而且每多一個專案就多一份要記的東西。所以做了 CT 與 BAT：能移出腦袋的都移出去。
3. **每個設計都先問：這份負擔去哪了？** `{#where}`：四個去處及評價——你的腦袋（最不該去）、repo 裡的檔案（好：放得下、留得住、能進版控）、塔台的對話脈絡（有成本，但負擔得起）、工具與規則（一次設計，之後每次受益）。
4. **三種負擔，三種處理** `{#three-loads}`：認知負荷理論把工作時的腦力消耗分成三種。
   - 跟工作無關卻佔住注意力的雜事（外在負擔）→ **拿掉**：BAT 派工時在正確的工作區開分頁、送指令，不用自己複製 prompt；分頁標題標明塔台與工單，縮圖標 ⚠️ 在等你、? 在等塔台答覆、✓ 已回報；派工後確認 Agent 真的啟動；Worker 做完通知直接回到塔台，分頁等輸出安靜後自動回收。連到首頁故事與 `/control-tower#visibility`。
   - 工作本身的難度（內在負擔）→ **切小**：工單寫清楚目標、範圍、驗收條件與不准碰的東西；Worker 只帶一張工單的脈絡上工；你一次只審一張的結果。連到 `/control-tower#lifecycle`。
   - 真正用來理解與判斷的部分（有益負擔）→ **留給你**：範圍內的技術小決定塔台代決並記下理由；範圍擴大、刪除或不可逆、對外發布、需要你的偏好、連續失敗，一定停下來問你（清單與首頁「自動，但不失控」一致）。連到 `/control-tower#autonomy`。
5. **負擔去哪了** `{#table}`：對照表（三欄：要記住或處理的事 / 以前在哪裡 / 現在在哪裡），最後一列刻意保留並做視覺區隔：

   | 要記住或處理的事 | 以前 | 現在 |
   |---|---|---|
   | 現在在哪個專案、做到哪張工單 | 你的腦袋 | repo 裡塔台的進度檔，塔台啟動時先讀 |
   | prompt 要貼到哪個分頁 | 你的手和記憶 | BAT 依工作區開分頁、送指令 |
   | 誰在等誰 | 你輪流切分頁看 | 縮圖標記：在等你 / 在等塔台 / 已回報 |
   | Agent 有沒有真的啟動 | 你切過去確認 | 派工時自動確認 |
   | 做完要回報、關分頁 | 你 | 通知回到塔台、分頁自動回收 |
   | 決定了什麼、為什麼 | 你，或沒有人 | 決策紀錄（repo 裡的檔案） |
   | 學到了什麼 | 散在各次對話 | 經驗紀錄，跨專案與本專案分開放 |
   | **該由人判斷的事** | 你 | **還是你：這一格刻意保留** |

   （表中「進度檔」「經驗紀錄」用描述，不寫檔名。）
6. **只自動化外殼，不把內容寫成劇本** `{#shell}`：開單 → 派工 → 回報 → 收尾 → 記下學到的事，每次都一樣，交給工具。每張工單裡的內容每次不同：要做什麼判斷、會碰到哪些例外、規格缺了哪一塊（例：客戶給不出規格，只能先做再測、回頭補規格；高度客製化的案子）。所以 CT 不把專案工作寫成固定劇本：Worker 在工單範圍內自己判斷，超出範圍問塔台，該你決定的回到你。經驗會累積成規則與教戰手冊幫 Worker 判斷（連到首頁「越用越懂你的專案」或 `/control-tower#learning`），但不會變成不准例外的劇本。可做一個簡單示意（外圈固定步驟、內圈每次不同的內容），沿用既有視覺語彙。🔴 不提任何試驗、數字或「Workflow」。
7. **這不是什麼** `{#not}`（D175 使用者補充）：三點，各一兩句，語氣平實、不貶低其他做法：
   - **不規定開發方法**：SDD、TDD、BDD 或 BMad-Method 都由你和專案決定；CT 管的是工單、派工、狀態與紀錄。專案規則（例如每張工單都要跑測試、型別檢查要零錯誤）寫下來之後，塔台會把它帶進每張工單的驗收條件。可連到 `/control-tower-tour#faq`（「一定要用 BMad-Method 嗎？」）。
   - **不取代專業知識**：需求合不合理、架構怎麼切、驗收條件對不對、回報的證據夠不夠、Worker 有沒有走偏，都要懂這一行才判斷得了。BAT + CT 拿掉的是雜事，把腦力留給這些判斷；工具會放大判斷的結果，好的壞的都會。
   - **不是 Vibe Coding**：不是丟一句需求、看起來能跑就收。每張工單先寫目標、範圍、驗收條件與不准碰的東西；Worker 回報附證據（跑了什麼、結果如何、哪個 commit）；塔台逐項核對才收單；重要決定寫進檔案；該你決定的事一定停下來問你。用詞統一寫「Vibe Coding」。
8. **用工具，不用規定** `{#tools-not-rules}`：規定越多，反彈越大；工具若讓人不必多做行政工作，大家才會用。在 CT 裡，工單、決策紀錄、學到的經驗都由 AI 寫，文件是工作的副產品，人只負責看和決定。作者的學習順序（可第一人稱，四步、是真正的順序）：學理論與概念 → 動手練習、把流程組起來 → 整理出適合自己的工作流程 → 用 AI 把它自動化，降低自己的認知負荷（而不是把複雜流程直接變成 SOP 要大家照做）。
9. **放手的三個習慣** `{#let-go}`：① 有事跟塔台說，不要自己動 Worker 正在讀的檔；② 進度寫進檔案之後，放心清掉對話；③ 只在斷點回答。每一點一兩句，連到 `/control-tower` 常見問題的兩個新題目（見第 4 項）。
10. **還沒解決的事** `{#limits}`：負擔是換了位置——從記住所有狀態變成審報告、做決定，要信任系統、願意放手，本身就要花時間學；小事不值得開工單，改一個錯字塔台直接處理；塔台自己也有成本，規則與紀錄會越來越多，所以規則只寫一處、按需載入、定期歸檔（連到 `/control-tower-tour#evolution`）。
11. **接著看**：首頁故事（`/#story`）、`/control-tower`、`/control-tower-tour`、`/cases`。

篇幅：整頁大約是 `/control-tower` 的一半到三分之二；導言與起點要短，讓讀者很快讀到「三種負擔」與對照表。

### 2. 首頁 `site/index.md`

- **故事 7 章各加一行「你不用再記住：…」**：給 `StoryChapter` 加一個選填 prop（名稱自訂，例 `relief`），顯示在該章「BAT + CT」那欄之後或卡片底部，視覺要明顯但不搶過標題；沒給 prop 的章節不顯示。建議文字（可微調，保持「你不用再記住：」開頭一致）：
  - 09:00 一個對話，越聊越長 → 一開始說好的規則
  - 09:20 你成了人肉剪貼簿 → 哪段 prompt 要貼到哪個分頁
  - 10:05 五個終端，三個在等你 → 哪個分頁在等你
  - 10:40 Agent 停下來問你 → 每個 Agent 卡在哪個問題
  - 11:15 兩個 Agent 改了同一個檔案 → 每個 Agent 會動到哪些檔案
  - 12:00 「做完了！」——真的嗎？ → 哪些測試跑過、哪些還沒
  - 一個月後 → 當初為什麼這樣決定
- **故事結尾之後**（`story-ending` 段落之後、「BAT 提供跑道…」之前）新增一段：h2「把腦力留給判斷」，導言 = 主旨句；三張卡片：
  - 雜事 → BAT 拿掉（開分頁、送指令、確認啟動、標出誰在等誰、回報、回收分頁）
  - 難度 → 工單切小（範圍寫清楚，Worker 一次做一張，你一次審一張）
  - 判斷 → 留給你（範圍、不可逆、對外發布、偏好、連續失敗，一定停下來問你）

  卡片下方加一句（D175 使用者補充，可微調）：「不規定你用哪種開發方法，也不替你判斷：該你決定的事，要靠你的專業。」
  
  加「為什麼這樣設計」連到 `/why`（比照既有 `home-more` 寫法）。卡片優先沿用 `FeatureGrid` 或既有卡片樣式。
- 首頁主標「一個塔台，指揮整隊 AI Agent」與 hero 不動（D161）。

### 3. 導覽 `site/.vitepress/config.mts`

- nav「與 Control Tower 協作 ▾」下拉與 sidebar 同名群組，第一項加「把腦力留給判斷」→ `/why`。
- 確認新頁會進 sitemap、分享卡片取到頁面 `description`。

### 4. `site/control-tower.md` 常見問題加兩題

放在既有常見問題內（位置自訂，與 `/why#let-go` 互相連結）：

- **可以放心清掉對話嗎？**：可以。進度、決定和經驗都在 repo 的檔案裡，塔台重開會先讀回來；Worker 本來就只帶一張工單的脈絡。兩個時機：Worker 回報寫完、狀態改成完成之後；塔台在進度與決定寫進檔案之後（剛派完工、口頭決定還沒寫下來時先別清）。可連到 `/control-tower-tour#states` 的「回報先寫完，才改狀態」。
- **Worker 在跑的時候，我可以自己改檔案嗎？**：盡量不要。塔台派工前會比對每張工單會動到的檔案，但你手動改的檔案不在比對範圍，Worker 可能讀到改到一半的內容；而且這次修改沒有紀錄，之後說不清楚為什麼。跟塔台說要改什麼，塔台會挑不衝突的時機處理，整理時一併更新互相引用的連結並記下來。要知道哪些 Worker 正在跑，看分頁標題與縮圖標記。

### 5. `site/control-tower-tour.md` 演進史收尾

在「Control Tower 怎麼長出來的」結尾加一兩句，點出七代的共同線索：每一代「卡在」的地方，大多是又有一件事要靠你記住、靠你的手搬運，每一代都把其中一件交給檔案或 BAT。連到 `/why`。不改七個世代的內容。

### 6. 校稿、驗證、截圖、commit（不 push）

## 驗證

- `cd site && npm run build`：0 錯誤、0 死連結。
- 字樣 / 隱私 grep（對本單新增或修改的內容；網站路由除外），全部 = 0：
  - 內部編號：`T0[0-9]{3}`、`D1[0-9]{2}`、`BUG-`、`PLAN-`、`EXP-`
  - CT 字樣：`CLAUDE\.md`、`SKILL`、`CHANGELOG`、`frontmatter`、`doctrine`、`_tower-state`、`_learnings`、`v[0-9]+\.`、`ct-(exec|done|status|evolve|insights|fieldguide|help)`、星號指令（例 `\*[a-z]+`）
  - 隱私：依 `.private/` 的檢查樣式（真名不寫在公開檔）
- 新頁 `title` / `description` 存在；分享卡片 `og:description` 取到新頁說明（看 build 產物的 `why.html`）。
- 截圖（scratchpad，不入版控）：`/why` 全頁、首頁新段落、首頁任一故事章節的「你不用再記住」、`/control-tower` 兩個新問題、演進史收尾；各取桌面 1440 與手機 390 × 淺色 / 深色。
- 手機無水平捲動；reduced-motion 下無動畫；新增元素鍵盤可聚焦處有可見焦點。

## 驗收

- 新頁完成（11 節齊，含「這不是什麼」；主旨句出現在首頁與新頁）、首頁 7 章「你不用再記住」與新段落、導覽、兩題常見問題、演進史收尾都上了。
- build 0 錯誤 0 死連結；grep 全部 = 0；手機無水平捲動。
- 回報區附：新文案 → 依據頁面 / 章節對照、截圖清單、校稿採納清單、給使用者的預覽指令、commit SHA。
- 只改 `affects_files`；未 push。

---

## 回報區

> 以下由 Worker 填寫（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）。

### 結果摘要

**DONE**。新頁 `/why`「把腦力留給判斷」11 節齊全（導言、起點、負擔去哪、三種負擔、對照表、外殼、這不是什麼、用工具不用規定、放手的三個習慣、還沒解決的事、接著看），主旨句同時出現在新頁開頭與首頁新段落導言。首頁故事 7 章各加一行「你不用再記住：…」，故事結尾後新增「把腦力留給判斷」段落（三格 + 開發方法一句 + 連到 `/why`）；導覽列與側欄「與 Control Tower 協作」第一項是「把腦力留給判斷」；`/control-tower` 常見問題加兩題（與 `/why#let-go` 互連）；演進史結尾加一段共同線索並連到 `/why`。

- **著陸檢查**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單位於 REPO_ROOT 下；C-3 `site/why.md` 祖先 `site/` 存在（present）；C-2 無 `branch` 欄位。`CT_HOME` 未設定（非隔離）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **frontend-design skill**：開工時已載入。沿用既有設計語言，不另起視覺方向；唯一新視覺元素是外殼示意 `ShellLoop`（沿用雷達線條語彙）。色彩只用既有語意 token：「你 = 藍」`--bat-you` 用在「你不用再記住」、「判斷：留給你」那格與對照表最後一列；本單沒有任何非塔台元素用紫色（錨點 A1）。

### 修改檔案

- `site/why.md`（新）
- `site/.vitepress/theme/components/ShellLoop.vue`（新：外圈五步 / 內圈每次不同，靜態 SVG + 可見圖說 + sr-only 文字等價）
- `site/.vitepress/theme/components/StoryChapter.vue`：選填 prop `relief`，顯示在「BAT + CT」卡片底部（虛線分隔，「你不用再記住：」用 `--bat-you`）
- `site/.vitepress/theme/components/FeatureGrid.vue`：新 set `loads`（首頁三格），`Feature.tone: 'you'`
- `site/.vitepress/theme/components/CardTable.vue`：選填 prop `highlightTone`（`tower` 預設 / `you`），既有用法不變
- `site/.vitepress/theme/custom.css`：檔尾新增「把腦力留給判斷」一節樣式（只新增，未改既有規則）
- `site/.vitepress/theme/index.ts`：註冊 `ShellLoop`
- `site/.vitepress/config.mts`：nav 下拉與 sidebar 群組第一項加 `/why`
- `site/index.md`：7 章 `relief`、新段落
- `site/control-tower.md`：兩題常見問題（`#faq-clear-chat`、`#faq-edit-while-running`）
- `site/control-tower-tour.md`：演進史結尾一段
- `docs/design/site-design-language.md`：§ 4.1「用在」補一句新增的 `--bat-you` 用處，以及 ShellLoop 不用紫也不用藍

### 新文案 → 依據頁面 / 章節對照（只供內部核對，不上站）

| 新文案 | 依據 |
|---|---|
| 起點（三到七個專案、貼錯 prompt） | 工單第 1 項第 2 點（D175 使用者提供）；「所以有了 Control Tower 和現在這個 BAT」見偏差 1 |
| 負擔四個去處：檔案「換人、換 Agent、隔天再開都讀得回來」 | 首頁故事「一個月後」；`/control-tower-tour#what`「因為一切都在檔案裡…」 |
| 塔台脈絡「只放全局…程式碼細節交給 Worker 去讀」 | `/control-tower#tower-principles`「塔台刻意不讀程式碼」 |
| 雜事：開分頁送指令 / 分頁標題 / 縮圖三狀態 / 啟動確認（Claude CLI 與新版 Codex CLI）/ 通知回塔台、等輸出安靜才回收 | 首頁故事 09:20、10:05；`/control-tower#visibility`、`#integration` 表、`#agents`「偵測能力」 |
| 難度切小三點 | 首頁故事 09:00；`/control-tower#lifecycle` |
| 判斷留給你：yolo 下塔台代決並記理由；五個斷點 | 首頁故事 10:40、首頁「自動，但不失控」斷點清單；`/control-tower#autonomy` |
| 對照表 8 列 | 進度檔：`/control-tower-tour#faq`「塔台的對話斷了」；派工：首頁 09:20；縮圖：10:05；啟動確認：09:20；回報與回收：10:05；決策紀錄：首頁「一個月後」、`/control-tower#what`；經驗分兩處：`/control-tower-tour#evolution` 第 3 代 |
| 外殼五步交給塔台和 BAT；Worker 範圍內判斷、超出問塔台、該你決定的回到你 | `/control-tower-tour#states`「守住範圍」；`/control-tower#questions` |
| 經驗長成規則與教戰手冊，但不是不准例外的劇本 | 首頁「越用越懂你的專案」、`/control-tower#learning`（教戰手冊「照著判斷」）；相容：只說它們是判斷的依據 |
| 不規定開發方法；專案規則帶進每張工單的驗收條件 | `/control-tower-tour#faq`「一定要用 BMad-Method 嗎？」；`/control-tower#learning`「說一次，之後每張工單都記得」 |
| 不是 Vibe Coding：先寫目標範圍驗收、回報附證據、逐項核對、決定寫進檔案 | 首頁故事 12:00、「一個月後」；`/control-tower-tour#states`「證據式驗收」 |
| 工單、決策紀錄、經驗都由 AI 寫 | `/control-tower#what`（塔台開工單、記決策）、`/control-tower-tour#learning`（塔台記觀察）、`#states`（Worker 寫回報） |
| 放手習慣 1、常見問題「自己改檔案」：派工前比對會動到的檔案 | 首頁故事 11:15；`/control-tower#parallel`「先比對會動到的檔案」 |
| 放手習慣 2、常見問題「清掉對話」：塔台重開先讀回、回報先寫完才改狀態 | `/control-tower-tour#faq`「塔台的對話斷了」、`#states`「回報先寫完，才改狀態」 |
| 放手習慣 3：只在斷點回答 | `/control-tower#autonomy` yolo 列 |
| 小事不開工單，哪些算小事由第一次問答決定 | `/control-tower#learning`「十分鐘問答」（「哪些小事不必開工單」） |
| 規則只寫一處、按需載入、結案單據歸檔 | `/control-tower-tour#evolution` 第 5 代；`#states`「不只工單」（歸檔區） |
| 演進史共同線索 | `/control-tower-tour#evolution` 七代的「卡在」：第 2、4、6、7 代是「要你貼 / 開 / 看」；用「大多是」措辭，不涵蓋第 3、5 代 |

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `cd site && npm run build` | PASS | `build complete`，0 錯誤；VitePress 預設死連結檢查開啟（未設 `ignoreDeadLinks`），0 死連結；最後一次 build 在校稿與樣式修正之後 |
| 錨點 | PASS | build 產物中 `index.html#story`、`control-tower.html#visibility/#lifecycle/#autonomy/#learning/#faq-clear-chat/#faq-edit-while-running`、`control-tower-tour.html#faq/#states/#evolution`、`why.html#let-go/#three-loads` 各有 1 個 id |
| 字樣 / 隱私 grep（本單 `site/` 新增行 + `why.md` + `ShellLoop.vue`，大小寫敏感） | PASS | 工單列的 27 個樣式全部 = 0。另以不分大小寫補查 `Workflow` / `facebook` / `youtube` / `<使用者>` = 0；不分大小寫時 `\*[a-z]+` 命中 1 處 markdown 粗體 `**Worker`、`CTI` 命中 `section` / `function`，皆為誤判 |
| 新頁 `title` / `description`；分享卡片 | PASS | `why.html`：`<title>把腦力留給判斷 \| Better Agent Terminal`、`og:description` = 頁面 description；`sitemap.xml` 含 `why` |
| 手機無水平捲動（390） | PASS | `/why`、首頁、`/control-tower`、`/control-tower-tour` 淺 / 深色 `scrollWidth` = `clientWidth` = 390；`/why` 沒有超出視窗的元素 |
| reduced-motion | PASS | 以 `prefers-reduced-motion: reduce` 截圖；`/why` `document.getAnimations().length` = 0；本單沒有新增動畫或 transition |
| 鍵盤焦點 | PASS（原始碼檢查） | 本單新增的可聚焦元素只有連結：首頁連結套 `.home :focus-visible` 外框，文件頁連結用 VitePress 預設焦點樣式；SVG `aria-hidden`、不可聚焦 |
| 截圖 | PASS | 見下方清單 |
| e2e | 未執行 | 依工單指示不跑 Playwright |

截圖（scratchpad，不入版控）：`<使用者資料夾>\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\9d26db3a-5c98-446c-b849-78262f361afd\scratchpad\t0674\`

- `/why` 全頁：`why-1440-light.png`、`why-1440-dark.png`、`why-390-light.png`、`why-390-dark.png`；另有 `why-390-dark-shell.png`（外殼示意）、`why-390-light-table.png`（對照表手機卡片）
- 首頁新段落：`home-why-{1440,390}-{light,dark}.png`
- 首頁故事「你不用再記住」（09:20 章）：`home-relief-{1440,390}-{light,dark}.png`
- `/control-tower` 兩個新問題：`ct-faq-{1440,390}-{light,dark}.png`
- 演進史收尾：`tour-evolution-{1440,390}-{light,dark}.png`

預覽伺服器已結束（L164）：`netstat` 沒有 4319 LISTENING；截圖用的瀏覽器分頁已關閉。

### 文案校稿（bmad-editorial-review-prose）採納清單

| # | 原文 | 改為 | 採納 |
|---|---|---|---|
| 1 | `/why#where` 導言「每個功能都先問同一個問題：這份負擔最後放在哪裡？」（與 h2 重複） | 「能放的地方有四個，好壞差很多。」 | 採納 |
| 2 | 三種負擔「叫外在 / 內在 / 有益負擔」 | 「認知負荷理論稱為…」（補上術語來源） | 採納 |
| 3 | 「塔台可以…代你決定，並記下理由。」 | 補「（yolo 模式）」（只有 yolo 由塔台代答，與首頁 10:40 一致） | 採納 |
| 4 | 「記下學到的事」 | 「記下經驗」（與示意圖標籤一致） | 採納 |
| 5 | `#not` 導言「三件 BAT 與 Control Tower 不做的事」 | 「三件常被誤會的事」（「不是 Vibe Coding」不算一件「不做的事」） | 採納 |
| 6 | 「所以我做了 Control Tower 和 BAT」 | 「所以有了 Control Tower 和現在這個 BAT」 | 採納（查詢項，見偏差 1） |
| 7 | 演進史「這條共同的線索，見[…]」 | 「…，在[把腦力留給判斷](./why)有完整說明。」 | 採納 |

截圖自審另改三處（不是校稿項目）：主旨句原本和 h1 黏成四行標題，改成較小字級加左側粗線；外殼示意的圖說原本和下一段第一句重複，改成「外圈：每張工單都走的五步。內圈：每張工單不同的內容。」；對照表「還是你」那列原本沿用淡紫底，容易被讀成塔台的東西，改成藍色淡底。

### 給使用者的預覽指令

```bash
cd site
npm run build
npx vitepress preview --port 4173
# 瀏覽 http://localhost:4173/better-agent-terminal/why
#      http://localhost:4173/better-agent-terminal/#story（故事每章底部的「你不用再記住」與故事後的新段落）
#      http://localhost:4173/better-agent-terminal/control-tower#faq-clear-chat
#      http://localhost:4173/better-agent-terminal/control-tower-tour#evolution
```

注意：`vitepress preview` 只認啟動當下的檔案。預覽中重新 build 之後要重啟預覽伺服器，否則新的 CSS 會回 404（本單實測）。

### Commit

- 產品：`0f50a83d7e5c69b931df1683cdb90c9072a4d4e6`（`git commit --only` 12 個檔案；`Claude outputs/` 未碰）
- 工單：本回報另外 commit（`git commit --only` 本檔）
- 未 push。

### 偏差與遭遇問題

1. **起點措辭**：工單大綱寫「所以做了 CT 與 BAT」。BAT 是從上游專案 fork 而來（頁尾有致謝），寫「我做了 BAT」可能被讀成從零開發，與「不得誇大」衝突，所以改成「所以有了 Control Tower 和現在這個 BAT」。若使用者要原句，只需改 `site/why.md`「起點」第三段一處。
2. **「小事不值得開工單」**：工單寫「改一個錯字塔台直接處理」。全站另有「塔台不寫程式」與「塔台被慣壞」的說法，所以補了半句「哪些算小事，第一次用時的問答裡由你決定」，並連到 `/control-tower#learning`（十分鐘問答原本就有「哪些小事不必開工單」），避免互相矛盾。
3. **放手習慣用項目符號、不用 ①②③**：三個習慣沒有先後順序；作者的學習順序才是真正的順序，那裡用編號清單。
4. **自訂錨點**：兩個新常見問題用自訂錨點 `#faq-clear-chat`、`#faq-edit-while-running`（中文標題自動產生的錨點不穩定），`/why#let-go` 直接連到它們。
5. **預覽伺服器**：第一次 `TaskStop` 只停掉 npx 外殼，node 程序（PID 41032，確認是 `vitepress.js preview --port 4319`）仍佔著埠，改用 `Stop-Process` 結束；之後直接以 node 啟動，結束時確認沒有 LISTENING。
6. 第一次字樣 grep 的暫存檔誤寫到系統 `%TEMP%`（不是 scratchpad），已立即刪除；之後的暫存都放在 scratchpad。

### 互動紀錄

無（yolo，沒有向塔台提問）。
