---
schema_version: 1
schema_kind: workorder
id: T0675
title: "NotebookLM 製作第二季 Podcast／影片／簡報：先評估 Google API 與瀏覽器自動化（Chrome live），可行就先導 S2-01 再批次，不可行就寫逐步指引"
type: feature
status: TODO
repo: better-agent-terminal
project: "第二季 Podcast 素材（第八十八 session；素材屬 BMad-Guide repo）"
priority: P3
sizing: M
created_at: "2026-10-21T17:08:06+0800"
depends_on: []
related:
  - "素材（只讀，已完成）：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\BMad-Control-Tower\\docs\\BMad_Control_Tower-S2 (Podcast, CT v5.11 + BAT 0.7 + BMad 6.12)\\`（S2-00 總覽、S2-01～S2-05 各一份「來源」與一份「提示」）"
  - "第一季成品命名參考：同層的 `BMad_Control_Tower-v3\\`、`BMad_Control_Tower-v1~v2\\`；NotebookLM 功能說明：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\BMad-Control-Tower\\docs\\NotebookLM Podcast 介紹.md`"
affects_files:
  - _ct-workorders/T0675-notebooklm-season2-production.md
  - "D:/ForgejoGit/@Gower_Labs/BMad-Guide/BMad-Control-Tower/docs/BMad_Control_Tower-S2 (Podcast, CT v5.11 + BAT 0.7 + BMad 6.12)/產出/**（新資料夾：下載的成品與製作紀錄）"
  - "D:/ForgejoGit/@Gower_Labs/BMad-Guide/BMad-Control-Tower/docs/BMad_Control_Tower-S2 (Podcast, CT v5.11 + BAT 0.7 + BMad 6.12)/S2-00 NotebookLM 製作步驟.md（新檔）"
  - "D:/ForgejoGit/@Gower_Labs/BMad-Guide/BMad-Control-Tower/docs/BMad_Control_Tower-S2 (Podcast, CT v5.11 + BAT 0.7 + BMad 6.12)/S2-0? 提示 - *.md（只限依實際介面修正選項名稱與字數上限，見 memory_overrides）"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: decision-requiring
memory_overrides:
  - "🔴 本 repo 公開在 GitHub：工單與回報**不得**寫 Google 帳號（email、名稱）、NotebookLM 筆記本網址或 ID、帳號畫面截圖、素材內文。這些只寫進本機的 `產出/製作紀錄.md`。"
  - "🔴 帳號安全：絕不輸入、讀取或保存密碼、兩步驟驗證碼、cookie、權杖；需要登入時請使用者自己在瀏覽器登入（決策點 D2）。不改 Google 帳號設定；不分享筆記本、不開公開連結；不刪除既有的筆記本或來源（只有本單建立的、且使用者在 D3 同意重做時才能刪）。"
  - "🔴 費用：不購買、不訂閱、不建立 Google Cloud 專案、不啟用付費 API、不設定帳單。API 路線只在使用者**已經擁有**可用的 NotebookLM Enterprise 且不需新費用時才走；否則只記錄結論。"
  - "🔴 上傳範圍：只上傳 S2 資料夾裡的「來源」檔（必要時加 S2-00 總覽）；「提示」檔只貼進自訂欄位，不加成來源；不上傳其他任何檔案。"
  - "🔴 「來源」檔內容不得修改。「提示」檔只允許依實際介面修正選項名稱、字數上限與操作位置，並在檔尾加一行「實測修正（日期，取自系統）：…」。"
  - "🔴 Git：BMad-Guide repo（素材所在）**不 add、不 commit**，成品維持未追蹤，由使用者或 BMad-Guide 塔台決定。本 repo 只用 `git commit --only` commit 本工單檔。不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。`Claude outputs/` 不是你的，不碰。"
  - "🔴 瀏覽器操作：不要觸發 alert / confirm / prompt 對話框；選檔用上傳工具或「貼上文字」來源，不開系統檔案對話框。同一個動作失敗 2～3 次、頁面無回應或出現非預期的複雜狀況，停下來問使用者，不要硬試。不使用 Workflow 工具。"
---

# T0675 — NotebookLM 製作第二季 Podcast／影片／簡報

## 目標

第二季素材（5 集，每集一份「來源」、一份「提示」）已經寫好。本單協助使用者在 NotebookLM 產出成品：每集一個筆記本、加入來源、依提示產生 Podcast（音訊摘要）、影片（影片摘要）與簡報，下載成品並命名。

做法依可行性往下降級：

1. **Google API**：只在使用者已經擁有可用的 NotebookLM Enterprise（Google Cloud）且不需新費用時採用。
2. **瀏覽器自動化**：優先用 `chrome-live`（Chrome DevTools MCP，使用者指定）；不行再用 `claude-in-chrome`（使用者自己的 Chrome 與登入狀態）。
3. **逐步指引**：兩者都做不到，就寫一份照著點就能完成的步驟文件，帶使用者手動做。

不論走哪條路，最後都要有一份「逐步指引」（自動化成功時寫精簡版，方便下一季手動重做）。

## 塔台已知與推論（Worker 須查證，不可直接當事實）

- 【推論】一般帳號的 NotebookLM（notebooklm.google.com）沒有公開 API。Google Cloud 有「NotebookLM Enterprise」API（建立筆記本、加入來源、產生音訊摘要），需要企業授權與 Cloud 專案；影片摘要與簡報是否有 API 不確定。請以官方文件查證目前狀態並附連結。
- 【推論】NotebookLM 的音訊／影片產生有每日次數上限，依帳號方案不同。5 集 × 3 種成品可能超過一天的上限。
- 本 session 的工具清單有 `mcp__chrome-live__*`（navigate_page、new_page、take_snapshot、click、fill、upload_file、wait_for…）與 `mcp__claude-in-chrome__*`（tabs_context_mcp、navigate、read_page、find、form_input、file_upload…），兩者都要先用 ToolSearch 載入。`chrome-live` 連到的瀏覽器是否已登入 Google、Google 是否允許在受控瀏覽器登入，都未知。
- 自訂提示的「精簡版」是為了欄位字數上限準備的；實際上限未實測。

## 決策點（停下來問使用者；在本分頁用選項式提問，每次最多 3 題）

- **D1 路線**：Phase 0 結束時，報告查證結果與建議路線，請使用者確認（例：[A] 瀏覽器自動化 [B] 只要逐步指引 [C] 其他）。只有在 API 路線可行且不需新費用時才列 API 選項。
- **D2 登入**：瀏覽器沒有登入 Google／NotebookLM 時，請使用者自己在那個瀏覽器視窗登入，完成後回覆。受控瀏覽器被 Google 擋下登入時，改提議 `claude-in-chrome`（需要使用者開啟擴充功能並允許 notebooklm.google.com）。
- **D3 先導驗收**：S2-01 做完後，請使用者聽／看成品，選 [A] 繼續批次 S2-02～S2-05 [B] 調整提示後重做 S2-01（說明要改什麼）[C] 停在這裡。
- **D4 上限**：遇到每日次數上限或其他配額訊息時停下，告知已完成與剩下的項目，請使用者選擇明天再接（以 `/ct-done` 或 Renew）或改手動。

## 執行步驟

### Phase 0：環境與可行性（只看，不建立任何東西）

1. 載入工具：ToolSearch 一次載入需要的 `chrome-live` 與 `claude-in-chrome` 工具（依各自的使用說明，`claude-in-chrome` 先呼叫 `tabs_context_mcp`、開新分頁）。
2. 查 API：用 WebSearch／WebFetch 查 Google 官方文件（NotebookLM Enterprise API：能做什麼、需要什麼授權與專案、有沒有影片／簡報 API），記下連結與結論。不得建立專案或啟用任何 API。
3. 查瀏覽器路線：用 `chrome-live` 開 `https://notebooklm.google.com/`，確認是否已登入、首頁長什麼樣。登入狀態未知或未登入 → D2。
4. 盤點介面（以實際畫面為準）：建立筆記本的方式；加入來源的方式（上傳 .md 檔、貼上文字）；輸出語言設定在哪裡；Studio 有哪些產出（音訊摘要、影片摘要、簡報或其他）與各自的格式、長度選項；自訂提示欄位的字數上限；下載方式；畫面上看得到的次數上限提示。
5. → **D1**。

### Phase 1：先導 S2-01（依 D1 選定的路線）

1. 建立筆記本，名稱「BMad 第二季 S2-01 把腦力留給判斷」。
2. 加入來源：`S2-01 來源 - 把腦力留給判斷.md`（上傳；不支援時改「貼上文字」貼全文）。依提示檔，預設只放這一份。
3. 輸出語言設為中文（繁體／台灣）（有此設定時）。
4. 依 `S2-01 提示 - 把腦力留給判斷.md`：
   - A. 音訊摘要：格式、長度依提示檔；欄位放得下就貼「完整版」，放不下貼「精簡版」，記下實際上限。
   - B. 影片摘要：依提示檔。
   - C. 簡報：介面有這項功能才做，依提示檔；沒有就記下「介面無此功能」，投影片大綱留給使用者另外製作。
5. 等產生完成：用 `wait_for` 或間隔截圖確認，不要高頻輪詢；單一成品超過 20 分鐘還沒好，記下並繼續下一項。
6. 下載成品（介面有下載時）：只搬移本單下載的檔案，從瀏覽器下載資料夾移到 `產出/`，命名：
   - `S2-01 把腦力留給判斷 (Podcast).<副檔名>`
   - `S2-01 把腦力留給判斷 (影片).<副檔名>`
   - `S2-01 把腦力留給判斷 (簡報).<副檔名>`
7. → **D3**。

### Phase 2：批次 S2-02～S2-05（D3 選 [A] 才做）

每集重複 Phase 1 的 1～6 步，筆記本名稱「BMad 第二季 S2-0X <標題>」，提示用對應的提示檔。遇到配額訊息 → **D4**。

### Phase 3：紀錄與指引

1. `產出/製作紀錄.md`（本機，可含筆記本名稱與網址）：每集 × 每種成品的狀態（完成／失敗／配額／介面無此功能）、使用的提示版本（精簡／完整）、產生時間、檔名。
2. 依實際介面修正六個提示檔裡的選項名稱、字數上限、操作位置（只改這些，檔尾加「實測修正」一行）。
3. `S2-00 NotebookLM 製作步驟.md`：照著點就能完成的逐步指引，涵蓋建立筆記本、加入來源、設定語言、三種成品各自在哪裡點、貼哪一段提示、選哪些選項、怎麼下載與命名、次數上限的注意事項。自動化成功時寫精簡版；走「逐步指引」路線時這份就是主要產出，要寫到使用者不必再問。

## 驗收

- Phase 0 結論有官方文件連結；路線經 D1 確認。
- 依選定路線：S2-01 三種成品（簡報視介面而定）產生並下載到 `產出/`，命名正確；D3 選 [A] 時，S2-02～S2-05 也完成，或因配額依 D4 停下並列出剩下的項目。
- `產出/製作紀錄.md` 與 `S2-00 NotebookLM 製作步驟.md` 存在；提示檔的修正只限介面相關內容。
- 工單回報不含帳號、筆記本網址、素材內文；BMad-Guide repo 沒有新的 commit；本 repo 只 commit 本工單檔、未 push。
- 狀態判定：全部完成 → DONE；做了一部分（配額、使用者選停、部分功能沒有）→ PARTIAL，寫明剩下什麼；登入或權限卡住、使用者未回覆 → BLOCKED。

---

## 回報區

> 以下由 Worker 填寫。注意：本 repo 公開，不寫帳號、筆記本網址與素材內文。

### 完成狀態

### Phase 0 結論（API／瀏覽器路線，附官方連結）

### 決策紀錄（D1～D4：時間、選項、使用者回覆）

### 成品清單（每集 × 每種成品：狀態、檔名）

### 介面實測（字數上限、選項名稱、配額訊息）

### 修改的檔案

### 遭遇問題

### 回報時間
