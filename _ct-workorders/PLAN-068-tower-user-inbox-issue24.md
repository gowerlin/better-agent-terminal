---
schema_version: 1
schema_kind: plan
id: PLAN-068
title: "塔台給使用者的總結與提問不被淹沒（GitHub #24）：每則訊息獨立、可回顧的清單（收件匣 / 訊息卡 / 分割檢視），含清單維護與保留策略；BAT 與 CT 協作"
status: IN_PROGRESS
priority: medium
created_at: "2026-11-25T03:05:55+08:00"
updated_at: "2026-11-25T04:44:02+08:00"
links:
  source: "GitHub issue #24（2026-11-21）；使用者 2026-11-25 第一百三十 session；D326"
  related: [T0901, T0788, T0607, T0701, T0735, "issue #23"]
---

# PLAN-068 — 塔台訊息不被淹沒：可回顧的「待你決定」清單

## 元資料

- **標題**：塔台給使用者的總結 / 提問獨立保存、可回顧（GitHub #24）
- **狀態**：IN_PROGRESS（研究中：BAT 端 T0901、CT 端 HANDOVER）
- **優先級**：🟡 Medium
- **類型**：功能（BAT UI ＋ BAT ↔ CT 契約）
- **建立時間**：2026-11-25 03:05 (UTC+8)

## 動機（issue #24 摘要）

CT yolo 多個 Worker 並行時，塔台每收到一份回報就寫總結，有時附需要使用者決定的問題，然後立刻處理下一份。

1. **被淹沒**：前一份的總結與提問很快被後面幾個回合蓋過，回頭不好找，有時根本沒看到。
2. **讀到一半被擠走**：正在看時下一份回報送進來，塔台開新回合輸出，內容被往上推。

現有機制擋不住：T0788 只在塔台停在權限 / AskUserQuestion / elicitation 時保留通知（文字提問時塔台已 `idle`）；Worker 提示音只提醒不保存內容；指揮塔總覽的 `todo` 不是給「待使用者決定」用的。

**限制**：不能靠讓塔台停下來等使用者（yolo 自動派工會失去意義）；只有需要使用者決定的那張工單（與依賴它的）該等。

## 使用者要求（2026-11-25）

- 研究 #24，**與 CT 塔台協作討論**有沒有更好的解法。
- 有沒有類似 **MultiView / SubView** 或其他顯示方式，讓**每則訊息獨立、不互相衝突**。
- 最好有**清單可以 review**；考慮**清單怎麼維護**，或**只保存最後幾筆**。

## 候選方向（待研究，不預設）

| 方向 | 誰改 | 說明 |
|---|---|---|
| A. 「待你決定」收件匣檔 | CT 寫、BAT 唯讀顯示 | issue 提案：CT 把待決事項寫檔（編號、工單、摘要、問題、選項、狀態），只暫停該工單；BAT 比照指揮塔總覽讀檔顯示未讀數與清單 |
| B. 閱讀保護 | BAT | 使用者在塔台分頁捲動 / 選取時延後送 Worker 通知（停手約 10 s、最長 60 s），可與 T0788 共用保留佇列 |
| C. 回合訊息卡 / 訊息歷程 | BAT（可能不需 CT） | BAT 以 claude hooks（例 `Stop` 的 transcript）擷取塔台每回合的最後訊息，做成獨立卡片清單（類 MultiView / SubView），可釘選、標已讀 |
| D. 分割 / 子檢視 | BAT | 把某則訊息釘到側欄或分割窗格，主終端繼續捲動不影響閱讀 |

## T0901 研究結論（2026-11-25 03:15）

- 問題 2（讀到一半被擠走）有一部分是 **BAT 自己造成**：helper 通知的 submit Enter 走 xterm 使用者輸入路徑，`scrollOnUserInput` 會把往上捲的畫面拉回底部、清掉選取，並 `terminal.focus()`（待實機）。claude fullscreen 的 Auto-scroll（預設開）也會在空輸入框被打字時拉回底部。
- 推薦分階段：
  - **Phase 1（只改 BAT）**：B0 送通知不搶捲動 / 選取；B 閱讀保護＋ #23 草稿保護（`NotifyHoldController` 新 reason `reading` / `draft`）；C 回合訊息卡（claude `Stop` hook 的 `last_assistant_message`，只收已宣告塔台、只在記憶體、每塔台最近 30 張＋釘選 10 張；需改 T0590「hook 不送內容」規則；codex 塔台暫不支援）；文件提示（fullscreen、關 Auto-scroll、`/focus`）。
  - **Phase 2（需 CT 6.1.0）**：A 採 CT 草案 `awaiting_user`，BAT 沿用總覽管線顯示「待你決定」清單；面板回答欄走本機 IPC（不是 helper channel），進 `NotifyHoldController` 佇列。
- CT 草案逐點表態與 (a)(b)(c) 回答見 T0901〈BAT ↔ CT 契約草案〉；只有 1″ 選項代號格式要 CT 決定（BAT 傾向「`<代號> <說明>`」）。

## 使用者補充（2026-11-25 03:16）

- **顯示位置用既有的右側欄**：BAT 右側欄已有「程式碼片段 / Skills / Agents / »」分頁，可在這裡加一個「塔台訊息」（或「塔台」）分頁，放 C 的回合訊息卡與 A 的「待你決定」清單，不另開分割窗格（取代 T0901 示意圖裡的獨立側欄）。

## 使用者補充（2026-11-25 03:22）

- 右側欄分頁連同 **TODO List 與其他需長期追蹤、需要注意的清單**（CT `todo`、未結 BUG、進行中 PLAN、待實機驗收 / 待使用者執行、定期事項、Worker 狀態）一起設計考量，不只塔台訊息；已以〈塔台補充（執行中 #1）〉轉給 T0902。

## 拆單

| 項 | 工單 | 狀態 |
|---|---|---|
| BAT 端研究（現況、方向比較、UX、保留策略、契約草案） | T0901 | 派工中 |
| CT 端討論（寫入格式、只暫停單張工單、回答路徑、保留） | HANDOVER `_handover-2026-11-25-tower-user-inbox-issue24.md` | 已送 CT 塔台 |
| 整合設計（不分階段、強制版本對齊、右側欄「待辦」、含 #23 重新評估、hook 註冊；D327–D329） | T0902（第二版定案） | DONE |
| CT 確認契約 v2 | HANDOVER〈BAT 定案立場〉 | ACCEPTED（CT D868，D332） |
| W0 契約 v2 版本閘門 | T0903 | DONE（`v0.8.x` `d6b9ce86`） |
| W1＋W2 送通知保護（B0 / draft / reading / 原子送出） | T0904 | DONE（`ct/T0904` `45020cf1`） |
| W3 回合訊息卡資料層 | T0905 | DONE（`ct/T0905` `1a468665`） |
| 合併 T0904＋T0905 → `v0.8.x` | T0907 | DONE（`v0.8.x` `677860a4`） |
| W4 待辦分頁骨架與版本判定 | T0906 | DONE（`v0.8.x` `eaa8b238`） |
| W5 契約 v2 清單與回答（含遠端 📨 proxied） | T0908 | DONE（`ct/T0908` `ba4fe096`） |
| W6 回合訊息卡 UI | T0909 | DONE（`ct/T0909` `efd6b3da`） |
| W9 hook 註冊（`bat-hooks` plugin） | T0910 | DONE（`ct/T0910` `a8eb8236`） |
| 合併 T0908＋T0909＋T0910 → `v0.8.x` | T0911 | 派工中 |
| W7 文件 / W8 整合驗收（同一個 BAT 版本，與 CT 6.1.0 同日發佈） | W5 / W6 / W9 合併後開 | — |

## 契約細節補充（2026-11-25T05:17:35+08:00，CT T0557 詢問）

- `awaiting_user[].source` 全名（`breakpoint-A` … `tower-question`）：W5 顯示短標籤，未知值照原字串。
- `hooks:` 行文法：`ok (<injected|plugin>, set <n>[, plugin-outdated])` / `none (<代號>)` / `n/a (codex)`，只在帶 `--bat-contract` 時輸出；`plugin-outdated` 只在僅由 plugin 提供且事件清單過舊時出現（W9）。
