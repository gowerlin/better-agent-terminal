---
schema_version: 1
schema_kind: workorder
id: T0675
title: "NotebookLM 製作第二季 Podcast／影片／簡報：先評估 Google API 與瀏覽器自動化（Chrome live），可行就先導 S2-01 再批次，不可行就寫逐步指引"
type: feature
status: DONE
repo: better-agent-terminal
project: "第二季 Podcast 素材（第八十八 session；素材屬 BMad-Guide repo）"
priority: P3
sizing: M
created_at: "2026-10-21T17:08:06+0800"
started_at: "2026-10-21T17:09:35+08:00"
updated_at: "2026-10-22T01:35:57+0800"
completed_at: "2026-10-21T17:44:43+08:00"
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

**PARTIAL**：S2-01～S2-03 九項成品（語音／影片／簡報）都已生成；S2-04、S2-05 六項因 AI 用量上限改用「稍後生成」排程（排定於當天午夜 12:00／1:00 後），本單結束時尚未生成。依使用者決定，下載由使用者自己做（S2-01 已下載；S2-02、S2-03 待下載），未依工單命名規則搬到 `產出/`。

剩下的事（給塔台）：
1. S2-04、S2-05 排程項目生成後，使用者下載（或開 Renew／`/ct-done` 確認）。
2. S2-02～S2-05 成品下載到使用者的資料夾 `docs\BMad 第二季\S2-0X <標題>\`。

著陸檢查：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 除本工單外都是 repo 外的絕對路徑或含萬用字元，不適用（C-0 已 PASS）；C-2 工單無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_HOME` 未設定（非 worktree）。`CT_MODE=on`。

### Phase 0 結論（API／瀏覽器路線，附官方連結）

- **API 路線：不採用。** NotebookLM 已於 2026-07-16 改名 **Gemini Notebook**（網址 notebook.google.com）。企業版 API（Gemini Notebook Enterprise，`v1alpha`，Preview／Pre-GA）需要 Enterprise 授權與 Google Cloud 專案編號；提供筆記本建立／刪除／分享、來源管理、語音摘要建立／刪除（選項只有 `sourceIds`、`episodeFocus`、`languageCode`，沒有長度）。官方頁面**沒有**影片摘要與簡報 API。使用者是個人 PRO 方案，走 API 需要新費用，依 memory_overrides 只記結論。
  - https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks
  - https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-audio-overview
  - 方案與上限：https://support.google.com/notebooklm/answer/16213268 （頁面自稱可能變動）
- **瀏覽器路線：可行。** chrome-live 連到使用者自己的 Chrome，已登入、PRO 方案；不需要 D2。工作室有「語音摘要」「簡報」「影片摘要」等。

### 決策紀錄（D1～D4：時間、選項、使用者回覆）

| 時間 | 決策點 | 使用者回覆 |
|---|---|---|
| 17:11 | D1 路線 | 瀏覽器自動化；另建新筆記本（不動開工時已開著的空筆記本）；目標語言改為中文（繁體） |
| — | D2 登入 | 不需要（已登入） |
| 約 17:25 | 下載方式（Worker 追加提問，因 Chrome 設定「下載前詢問儲存位置」，按下載會跳系統另存對話框） | 「我已自行下載，之後製作完成通知我，讓我自行下載即可，請繼續下一集安排」；成品放使用者自己的資料夾 |
| 約 17:25 | D3 先導驗收 | 同上回覆「請繼續下一集」，視同 [A] 繼續批次 |
| 17:31 | D4 上限 | 試「稍後生成」：S2-04、S2-05 全部排程 |

### 成品清單（每集 × 每種成品：狀態、檔名）

| 集 | 語音摘要 | 影片摘要 | 簡報 |
|---|---|---|---|
| S2-01 | ✅ 已生成（16:07）、使用者已下載 .m4a | ✅ 已生成（6:22）、使用者已下載 .mp4 | ✅ 已生成、使用者已下載 .pdf / .pptx |
| S2-02 | ✅ 已生成（20:35）、待下載 | ✅ 已生成（7:00）、待下載 | ✅ 已生成、待下載 |
| S2-03 | ✅ 已生成（21:42）、待下載 | ✅ 已生成（7:28）、待下載 | ✅ 已生成、待下載 |
| S2-04 | 🕛 稍後生成（12AM 後） | 🕐 稍後生成（1AM 後） | 🕛 稍後生成（12AM 後） |
| S2-05 | 🕛 稍後生成（12AM 後） | 🕛 稍後生成（12AM 後） | 🕐 稍後生成（1AM 後） |

- 全部用「完整版」提示（欄位放得下）。檔名是 NotebookLM 自動取的標題，未依工單規則改名（使用者決定）；各檔標題與筆記本網址見本機 `產出/製作紀錄.md`。
- 每本筆記本只有該集「來源」一份，未加 S2-00 總覽；「提示」檔只貼進自訂欄位。

### 介面實測（字數上限、選項名稱、配額訊息）

- 輸出語言：⚙ 設定 → **目標語言**（帳號層級，選項有「中文（繁體）」「中文（简体）」，沒有「台灣」）；三個產生對話框也各有「選擇語言」。
- 點工作室按鈕會先開「自訂」對話框（不會直接生成），按「立即生成」或「稍後生成」才送出。
- 語音摘要：格式 **深入探索**／摘要／評論／辯論；長度只有 **短**／**預設**（沒有「較長」）；欄位「在本集中，AI 主持人應著重哪些部分？」上限 **5,000 字**（`maxlength`）。
- 影片摘要：格式 **精簡**（新推出）／**說明影片**；選說明影片後出現「選擇視覺風格」（自動選取、自訂、經典、白板、可愛、動漫風、水彩、復古印刷、古典、紙藝…）；沒有長度選項；欄位「影片要以什麼內容為重心？」上限 5,000 字；有「檢查作者備忘稿」開關。完成後列表上的格式標示為「詳細說明」。
- 簡報：介面**有**此功能。格式 **詳細簡報**／**簡報投影片**；長度 短／預設；欄位「說明要建立的簡報」上限 5,000 字；有「檢查投影片大綱」開關；下載可得 .pdf 與 .pptx。
- 用量：對話框左下有「AI 用量」條。PRO 方案短週期用量，一集三項約 30%；S2-03 三項送出後到上限，訊息「AI 用量已達上限，下午10:13 過後即可恢復使用所有功能。」，對話也停用。上限時對話框只剩「稍後生成」（「已達使用上限，請安排稍後生成，等待限制重設」），排程正常。另有每週上限。
- 生成時間：語音、簡報約 10 分鐘內；影片約 15 分鐘。

### 修改的檔案

- 本 repo：`_ct-workorders/T0675-notebooklm-season2-production.md`（本工單，唯一 commit 的檔案）
- BMad-Guide repo（未 add、未 commit，維持未追蹤）：
  - 新增 `BMad-Control-Tower/docs/BMad_Control_Tower-S2 (…)/產出/製作紀錄.md`
  - 新增 `BMad-Control-Tower/docs/BMad_Control_Tower-S2 (…)/S2-00 NotebookLM 製作步驟.md`
  - 修改 5 個 `S2-0X 提示 - *.md`：語言設定位置、「音訊摘要」→「語音摘要」、長度選項說明、影片格式「解說」→「說明影片」與視覺風格、簡報格式與貼法、精簡版標題註明實測上限 5,000 字；檔尾加「實測修正（2026-10-21，取自系統）」一行。「來源」檔未改。
- 未動：`docs\BMad 第二季\`（使用者自己的下載資料夾）、`Claude outputs/`。

### 互動紀錄

使用者互動見上方「決策紀錄」表（D1、下載方式／D3、D4，皆以選項式提問在本分頁進行）。

### 遭遇問題

1. chrome-live 的 `upload_file` 只接受工作目錄內的路徑（素材資料夾被拒：`not within any of the configured workspace roots`）。改把 5 份「來源」檔複製到 Claude 暫存資料夾再上傳，內容與檔名不變。
2. Chrome 設定「下載前詢問儲存位置」：Worker 在 S2-01 語音按了一次「下載」，可能跳出系統另存對話框（使用者表示已自行下載）。之後依使用者決定，Worker 不再按下載。
3. 對 0 來源的筆記本用程式點「語音摘要」時，觸發的是對話區的「生成 AI Podcast」（當時已到上限，回「已達上限」），沒有產生成品也沒有多耗用量。
4. 工單寫「六個提示檔」，實際只有 5 個（S2-01～S2-05）；S2-00 是總覽，不是提示檔，未修改。
5. 工單預期成品下載到 `產出/` 並改名；使用者改成自行下載到 `docs\BMad 第二季\`，保留 NotebookLM 預設檔名。逐步指引裡寫了建議的統一檔名，給使用者自行決定。

### 回報時間

2026-10-21T17:44:03+08:00

### Post-resolution note（塔台，2026-10-22T01:35:57+0800）

- PARTIAL → **DONE**：使用者回報 NotebookLM 輸出（含排程生成的 S2-04／05）已自行下載（第八十九 session）。原回報區保留不改；成品未搬到 `產出/` 依使用者先前決定。Worker 分頁 `--close-worker` exit 3（已不存在）。
