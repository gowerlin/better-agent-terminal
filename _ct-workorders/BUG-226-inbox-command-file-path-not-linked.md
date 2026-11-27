---
schema_version: 1
schema_kind: bug
id: BUG-226
title: "待辦分頁「🙋 待你執行」的指令欄寫的是檔案路徑時不能點開，只有「複製指令」，複製了也不知道貼哪裡"
status: FIXING
severity: low
reproducibility: "always（`user_actions[].command` 是檔案路徑時）"
created_at: "2026-11-27T11:11:38+08:00"
updated_at: "2026-11-27T11:11:38+08:00"
impact:
  - inbox
links:
  discovered_in: "使用者 2026-11-27 截圖（另一個專案的待辦分頁，BAT `0.8.0-pre.7`）"
  related: [T0930, T0935, T0908, PLAN-069, T0936]
---
# BUG-226 — 待辦分頁指令欄的檔案路徑不能點

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（檔案仍可從「檔案」頁籤手動找；不影響回答） |
| 可重現 | 必定：`user_actions` 的 `command` 是檔案路徑（例 `_ct-workorders/_reply-<日期>-<主題>.md`） |
| **狀態** | ⏳ FIXING（T0936） |
| 回報者 | 使用者 2026-11-27 |
| 影響版本 | 自 T0908（契約 v2 清單）起；T0930 / T0935 的參考檔案連結沒有涵蓋 `command` |

## 現象（預期 vs 實際）

- 預期：「🙋 待你執行」一筆的 `command` 欄寫的是工作區內存在的檔案（例：要使用者審閱的回覆稿 `_ct-workorders/_reply-….md`）時，可以點開在「檔案」頁籤檢視。
- 實際：`command` 以 `<code>` 原文顯示、沒有連結，旁邊只有「複製指令」。複製一個檔案路徑沒有用；貼到終端也不會開檔。

使用者原話：「檔案仍然沒有連結，複製指令對檔案連結無用，也不知貼哪裡，直接貼終端並不能開檔」。

## 根因（塔台讀碼，待 Worker 確認）

`UserActionItem`（`src/components/inbox/InboxLists.tsx` 約第 424–431 行）把 `item.command` 直接放進 `<code className="inbox-command-text">`，沒有經 `InboxRefText`；T0930 / T0935 的參考檔案連結只接在 `ref` 標籤與 `summary` / `title`。

## 補充：CT 端的用法

CT 契約（`memory-protocol.md` § 契約 v2 欄位）的 `command` 是「使用者要執行的指令」。截圖中的塔台把要審閱的檔案寫進 `command`，屬寬鬆用法；BAT 端仍應把它顯示成可點的檔案，因為塔台實際上就會這樣寫。

## 處置

T0936（D390）：`command` 經 T0930 同一套辨識與存在檢查；整個 `command` 就是一個存在的檔案時，以連結顯示、按鈕改成「開啟」（在「檔案」頁籤開啟），不再顯示「複製指令」；指令中含路徑時路徑可點、「複製指令」保留。

驗收：安裝含 T0936 的版本後，`user_actions` 一筆 `command` 寫存在的 `_ct-workorders/_reply-….md`，待辦分頁可點開、按鈕是「開啟」；另一筆 `command` 是真的指令（含路徑）時路徑可點、「複製指令」照舊。
