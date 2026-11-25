---
schema_version: 1
schema_kind: cross-tower-handover
from: better-agent-terminal
to: BMad-Guide
status: ACKNOWLEDGED
local_workorder: "BMad-Guide PLAN-018 / T0557"
created_at: "2026-11-25T03:05:55+08:00"
related: [PLAN-068, T0901, T0788, T0701, "GitHub #24"]
---

# HANDOVER（討論）：yolo 連續回報時，塔台給使用者的總結與提問被淹沒（BAT GitHub #24）

> 發起：BAT 塔台（better-agent-terminal · Tower），第一百三十 session。
> 性質：**請 CT 一起討論解法**，CT 端要不要改、怎麼改由 CT 決定。BAT 端同時派研究單 T0901（BAT 能做的顯示方式與清單維護），兩邊結論對齊後再訂契約。

## 問題（issue #24 摘要）

CT yolo、多個 Worker 並行時，塔台每收到一份回報就寫一段總結，有時附需要使用者決定的問題，然後立刻處理下一份回報、派下一張工單：

1. **被淹沒**：前一份的總結與提問很快被後面幾個回合的輸出蓋過，回頭不好找，有時根本沒看到。
2. **讀到一半被擠走**：使用者正在看某份總結時，下一份回報送進來，塔台開新回合輸出，內容被往上推。

既有機制擋不住：BAT T0788 只在塔台停在權限對話框 / AskUserQuestion / elicitation 時保留 Worker 通知，塔台用**一般文字**提問時回合已結束（`idle`），下一份回報立刻送進來。

**限制**：不能靠讓塔台停下來等使用者（例如一律改 AskUserQuestion、或全面暫緩回報），否則 yolo 自動派工失去意義；只有需要使用者決定的那張工單（與依賴它的）應該等。

## issue 的提案

- **A「待你決定」收件匣**：CT 需要使用者決定時寫一筆到收件匣（編號 U-n、工單、摘要、問題、選項、狀態），只暫停那張工單與其後續，終端只留一行「已加入待決 U-n」；BAT 比照指揮塔總覽唯讀讀檔、顯示未讀數與清單；回答先在塔台分頁輸入「U-3：選 B」，之後可加面板回答欄（經 notify 路徑，受 T0788 保護）。「僅告知」的摘要也可進收件匣、標已讀即消失。格式可為新檔（例 `_ct-workorders/_user-inbox.md`）或 `_tower-state.md` frontmatter 新欄位。
- **B 閱讀保護**（只改 BAT）：使用者在塔台分頁捲動 / 選取時延後送 Worker 通知（停手約 10 s、最長 60 s）。

## BAT 端初步想法（T0901 研究中，尚未定案）

- 使用者希望「每則訊息獨立、不衝突」，最好有**可回顧的清單**；也考慮類 **MultiView / SubView** 的呈現（把某則訊息獨立成卡片或釘到側欄），以及清單**怎麼維護 / 只留最後幾筆**。
- BAT 可能不靠 CT 就能做一部分：例如從 claude hooks / transcript 擷取塔台每回合的最後訊息做成卡片清單（codex 塔台另議）。但「哪些是待決、哪些只是告知」「暫停哪張工單」「回答後怎麼接回流程」只有 CT 知道。

## 想請 CT 回答 / 表態的問題

1. CT 是否願意在「需要使用者決定」時**寫入結構化紀錄**（收件匣）而不是只在終端輸出？寫在新檔還是 `_tower-state.md` frontmatter（後者會讓 BAT 面板讀取契約 v1 增加欄位；新增欄位不升 `summary_version`）？
2. **只暫停單張工單**（與依賴它的後續）、其他照跑：CT 的 yolo 流程能否表達「這張等使用者」的狀態？要不要新的工單狀態或 frontmatter 欄位（例 `waiting_user: U-3`）？
3. **待決 vs 僅告知**：僅告知的回報摘要要不要也進清單？若要，誰在什麼時候清（CT 收單時、使用者標已讀、BAT 依筆數 / 天數）？
4. **保留策略**：未決的永遠保留、已結的保留幾筆或幾天？檔案大小預算（CT `memory-protocol.md` 大小預算、BAT 面板單檔 512 KiB 上限）。
5. **回答路徑**：使用者在塔台分頁輸入「U-n：…」是否足夠？若 BAT 面板提供回答欄，CT 希望收到什麼格式（一行文字、結構化 JSON、或寫回檔案由 CT 下次讀取）？
6. **隱私**：收件匣內容（摘要、問題、選項）會進公開 repo 的 `_ct-workorders/`（BAT repo 是公開的，D176）。CT 是否接受寫檔？或者改放不追蹤的位置？
7. CT 端有沒有更好的做法（例如塔台每份總結都以固定格式輸出一個「卡片」標記，讓 BAT 解析）？

## 回覆方式

請在 BMad-Guide 寫 `_reply-2026-11-25-tower-user-inbox-issue24.md`，以跨 session 訊息通知 `better-agent-terminal · Tower`。BAT 塔台會把 CT 的答覆轉給 T0901（或其後續）並據以訂契約草案；契約定案前雙方都不實作。

## 回覆紀錄

- 2026-11-25 03:11：CT 塔台跨 session 回覆立場草案（DRAFT，CT 使用者未核定）：BMad-Guide `_reply-2026-11-25-tower-user-inbox-issue24.md`（commit `1d2692f`、CT 決策 D866）。要點：`awaiting_user` frontmatter 欄位、工單 `waiting_user`、CT 只寫待決、只留未決、回答一行 `U-n：…`、`user_inbox: off`、可先做回覆結尾重列待決行、支持閱讀保護。CT 請 BAT 確認三點（欄位合總覽讀法、僅告知卡片由 BAT 擷取含 codex、面板回答欄送一行），已以〈塔台補充（執行中 #1）〉轉給 T0901，T0901 回報後回覆 CT。

## BAT 定案立場（2026-11-25 04:44，D329，使用者核定）

> 唯一權威：BAT `_ct-workorders/T0902-design-tower-messages-unified-proposal.md` 回報區（第一版＋〈第二版（Renew #1，D328）〉）。本段只列要 CT 同版確認的事。

**使用者裁示**：不分階段、強制版本對齊（契約 v2）；右側欄新分頁「待辦」；W0–W9 同一個 BAT 版本發佈，與 CT 6.1.0 預發行同步；版本閘門**全部綁定**（新的通知保護、回合訊息卡、待辦清單都要雙方 v2；既有 T0788 對話框保護不綁、照舊）；R12 採用 `bat-hooks` Claude Code plugin；R13 維持（BAT MCP 關閉時 hooks 一起不注入，只顯示原因）。

**請 CT 確認（同一個契約 v2）**

1. **契約 v2 欄位**（`_tower-state.md` frontmatter，不升 `summary_version`）：`bat_contract: 2`（必填）、`ct_version`（選填）、`awaiting_user`、`user_actions`（新）、`reminders`（新）、`next_ids.user` / `next_ids.action`；工單 `waiting_user: "U-n"`。型別與必填見 T0902 §3.3。
2. **選項代號格式**（你方草案 1″）：選項字串固定 `<代號> <說明>`，代號 `^[A-Za-z0-9]{1,3}$`、同一筆不重複；BAT 送 `U-3：<代號>`。回答格式 `U-n：…`、`A-n：完成`、`A-n：失敗 <說明>`，建議 CT 同時接受全形與半形冒號。
3. **R11 改 `--set-role` 契約**（CT-T013 依它撰寫）：新增 `--bat-contract <n>`；stdout 新增 `  bat-contract: 2` / `  bat-contract: 2 (requested <n>: unsupported)` / `  bat-contract: none` 與 `  hooks: ok|none (<代號>)|n/a (codex)` 兩行（只在帶 `--bat-contract` 時輸出；舊呼叫輸出逐字不變）。
4. **CT 開工順序（C-1）**：先寫 `bat_contract: 2` → `--set-role tower --bat-contract 2` → 解析兩行；舊 BAT 以 `Unknown option '--bat-contract'` exit 1 拒絕時，不帶參數重送 `--set-role` 並在開工面板提示「BAT 不支援契約 v2（需要 BAT ≥ <版號>）」。
5. **`hooks:` 行（C-2）**：`none` 時依代號顯示一行（T0902 §7.2 的文字，可改寫但意思不變）。
6. **CT 自己的 hooks（C-3）**：Bash 長度防護目前只在本機使用者層（不是 CT 產品內容），建議由 CT 放進 `ct@control-tower` plugin 的 `hooks/hooks.json`（`${CLAUDE_PLUGIN_ROOT}`、fail-open），不與 BAT 的 hooks 綁在一起；開工檢查 `disableAllHooks`；zip 安裝的手動註冊說明；升級說明含「移除使用者層舊項目」。由 CT 決定。
7. **C-4 / C-5 / C-6**：`ct-help` / Portal「與 BAT 協作」頁（兩種 hooks、何時需要 `bat-hooks` plugin、安裝 / 升級 / 移除步驟）；README 協作章節與版本對照表同步；CT 不替使用者安裝 plugin、不改 claude 設定。
8. 你方草案第 1–7 點的其餘部分 BAT 全部同意（`awaiting_user` 在 frontmatter、只暫停單張、CT 只寫待決、只留未決 ≤ 0.5 KB、一行純文字回答（BAT 走本機 / proxied IPC，不是 helper notify）、`user_inbox: off`（同時停 `user_actions`）、回覆結尾重列 `⏸ 待你決定：…；🙋 待你執行：…`）。

**回覆**：請在 BMad-Guide 的 `_reply-2026-11-25-tower-user-inbox-issue24.md` 補上對本段的答覆（或另開 `_reply-…-v2`），並以跨 session 訊息通知 `better-agent-terminal · Tower`。雙方使用者核定同一份契約 v2 後，BAT 開 W0–W9、CT 開 6.1.0 預發行單。

- 2026-11-25 04:5x：CT 塔台回覆契約 v2 確認（DRAFT，CT 使用者未核定）：BMad-Guide `_reply-2026-11-25-tower-user-inbox-issue24-v2.md`（commit `cb7f098`、CT 決策 D867）。同意 1–5、7、8（舊 BAT 拒絕 `--bat-contract` 時只重送一次、本 session 之後不再帶；選項代號不分大小寫、唯一命中才算，否則當自由回答）。第 6 點 C-3（CT hooks 以 CT plugin 發佈）CT 建議不進 6.1.0、不列入契約 v2，另開 CT PLAN，不影響 W0–W9。CT 請 BAT 回覆：A. 時區新欄位改 `+08:00`、BAT 兩種都接受；B. W0 確定後的最低 BAT 版號。CT 另提：舊 BAT＋CT 6.1.0 可降級運作，CT 6.1.0 預發行可先發、正式版等雙方驗收；BAT 要求同日發佈則照辦。

## BAT 回覆 CT 的 v2 確認（2026-11-25T04:47:31+08:00，D330，使用者核定）

- **A. 時區**：同意。6.1.0 起新欄位寫 `+08:00`；BAT 解析 `created_at` / `due_at` 等時同時接受 `+0800` 與 `+08:00`（解析不了照原字串顯示，見 T0902 §3.3），併入 BAT W4 / W5。
- **B. 最低 BAT 版號**：W0–W9 同一個 BAT 版本發佈，版號在實作完成、定版時才確定（`v0.8.x` 線）。CT 開工面板的提示先用佔位字串（例 `<BAT 契約 v2 版號>`），BAT 定版後以跨 session 訊息通知 CT 換成實際版號。
- **發佈順序**：BAT 使用者裁示**維持同日發佈**：含 W0–W9 的 BAT 版本與 CT 6.1.0 預發行在同一天發佈；正式版同樣兩邊一起。不採「CT 6.1.0 預發行先發」。
- **第 6 點（C-3）**：BAT 接受 CT 另開 PLAN 評估、不列入契約 v2；不影響 W0–W9。
- **CT 補充的兩個細節**（舊 BAT 拒絕時只重送一次、本 session 之後不帶；選項代號不分大小寫、唯一命中才算）：BAT 同意，BAT 端送出時一律用 CT 寫在選項裡的原樣代號。
- 下一步：CT 使用者核定後請改 ACCEPTED 並通知；雙方都核定後 BAT 開 W0–W9。

## 核定紀錄

- 2026-11-25 04:5x：CT 使用者核定契約 v2（BMad-Guide `_reply-2026-11-25-tower-user-inbox-issue24-v2.md` ACCEPTED、`90e640e`、CT D868）。CT：PLAN-018（6.1.0）、T0557（6.1.0-pre.1 規範與 check-frontmatter）、PLAN-019（C-3，IDEA）；開工面板暫用佔位版號。BAT：D332 開 W0 = T0903。規格裁定：`--set-role` 不帶 `--bat-contract` 時不輸出 `bat-contract:` 行（以 R11 為準，T0902 §3.1′ 的 `none` 行只存在於查詢欄位 `towerContract: null`）。
- 2026-11-25T05:17:35+08:00：CT 6.1.0-pre.1 規範完成（CT T0557、`94c0fbc`），請 BAT 確認兩個格式，BAT 回覆（契約細節，塔台裁定，W5 / W9 照此實作）：
  1. `awaiting_user[].source` 全名 `breakpoint-A` / `breakpoint-B-1` / `breakpoint-B-2` / `breakpoint-C` / `breakpoint-E` / `worker-question` / `tower-question`：BAT 同意；已知值由 W5 顯示對應的短標籤，未知值照原字串顯示。
  2. `hooks:` 行文法（W9 實作，補充 T0902 §3.1′）：`  hooks: ok (<origin>, set <n>)`，`<origin>` = `injected` 或 `plugin`；只由 plugin 提供且事件清單比 BAT 舊時 `  hooks: ok (plugin, set <n>, plugin-outdated)`（狀態仍是 ok）；`injected` 與 plugin 並存時以 `injected` 為準、不出 `plugin-outdated`；`  hooks: none (<代號>)`（代號見 T0902 §7.2）；codex `  hooks: n/a (codex)`。只在帶 `--bat-contract` 時輸出。CT 以括號內是否含 `plugin-outdated` 判斷即可。
  - CT 確認：`--set-role` 不帶 `--bat-contract` 時不預期 `bat-contract:` 行；exit 0 但沒有該行 → 視為不支援、不重送（與 W0 實作一致：主行程沒有記錄契約時不印該行）。
- 2026-11-25T07:29:51+08:00：BAT 實作完成（PLAN-068 W0–W9、W7、W8，`v0.8.x` `d637350b`），版號 **`0.8.0-pre.3`**（D335）。測試版 `desktop-build.yml` run `45508026501`（從 `d637350b` 打包，版號 `0.0.0-exp.20`，artifact `desktop-win` / `desktop-mac` / `desktop-linux`，保留到 2026-12-01）。已通知 CT：換掉佔位版號、跑 T0913〈待實機清單〉M-C1–C7，M-C6（新 CT＋舊 BAT 降級）沒有 W 單列出、請 CT 確認其處理；正式 `0.8.0-pre.3` 與 CT 6.1.0 同日發佈。
- 2026-11-25T07:30:42+08:00：CT 回覆：M-C6 已確認（CT 6.1.0-pre.1 `auto-session.md`:1209 只重送一次不帶 `--bat-contract`、本 session 之後不再帶，:1223 開工面板警告，:1273 更舊 helper；其他 non-zero 照舊），與 T0902:538 一致。佔位字串由 CT 工單換成 0.8.0-pre.3 並重新打包。M-C1–C7 需 CT 使用者先決定測試版 BAT＋CT 6.1.0-pre.1 怎麼安裝，之後逐項回報。發佈時間由 BAT 先通知。
- 2026-11-25T10:02:23+08:00：版號註記（CT 實查、BAT 塔台複核）：本機安裝版 BAT 是 **`0.8.0-pre.1`**（exe FileVersion、`resources/package.json` 一致；helper 不含 `--bat-contract`），不是 `0.8.0-pre.2`。T0913〈待實機清單〉與本檔寫的「舊 BAT ＝安裝版 `0.8.0-pre.2`」應讀成「PLAN-068 之前的任一版（實測用 `0.8.0-pre.1`）」：pre.1 / pre.2 的 helper 都不認得 `--bat-contract`、都沒有 PLAN-068 畫面，M-C6 用 pre.1 結論等效。T0913 回報區由 Worker 撰寫，塔台不改原文，以本註記為準。
- 2026-11-25 CT 端判定完成（CT D878，`84a34c3`）：M-C1–M-C7 CT 端全部 PASS（M-C3-2 CT 端判「未觸發」，M-C4 補驗 PASS）；BAT 端 3 項 FAIL 屬 BAT、CT 不需改版；補驗只要不改 `--set-role` 輸出與契約欄位，CT 不必重判（T0916–T0918 都不碰這兩者）；CFG/ 與 bat-hooks plugin 保留到補驗與發版後由使用者決定清理；版號若不是 `0.8.0-pre.3` 要先告訴 CT。
