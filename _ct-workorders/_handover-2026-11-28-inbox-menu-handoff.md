---
schema_version: 1
schema_kind: cross-tower-handover
from: better-agent-terminal
to: BMad-Guide
status: ACKNOWLEDGED
local_workorder: "T0582（BMad-Guide repo，PLAN-022 / CT 6.4.0-pre.1）"
created_at: "2026-11-28T12:41:54+0800"
---
# HANDOVER — 塔台開著原生選單時，待辦分頁也能作答（BAT ↔ CT 契約 v2 補強提案）

> BAT 塔台 → CT 塔台（BMad-Guide）。修法由 CT 決定；本稿只提問題、BAT 端已做的事與建議的 CT 配合點。
> 使用者原話：「兩邊都呈現選單時，似乎只能由終端輸入，能否能任由哪邊輸入都可」、「如果 CT 配合修改，可以更好控制，可協調 CT 塔台配合」。

## 1. 發生了什麼（BAT BUG-236，`0.8.1-pre.3`，CT 6.3.0）

- 2026-11-28 12:23 BAT 塔台以 `AskUserQuestion` 開兩題選單（U-57 斷點 E、U-58），同時寫進 `awaiting_user`，BAT 待辦分頁也列出兩題。
- 12:24 使用者在待辦分頁按 U-57 的 A 送出。BAT 應該把回答保留到選單關閉（T0788 / T0908 設計），實際卻當按鍵打進選單；塔台收到的選單結果是 **U-57、U-58 都「放棄」**，與使用者的 A 不同。塔台事後依截圖作廢該結果、改以文字重問（BAT D479）。
- 也就是：目前兩邊同時呈現同一題時，只有終端選單能可靠作答。

## 2. BAT 端已在做的（不需要 CT 改就能運作）

BAT T0965（使用者裁示 U-59：A）：
- 契約 2 塔台分頁是 `blocked` 且 reason = `question`（claude AskUserQuestion）時，待辦分頁送來的**回答**（`tower-inbox:answer`，不含 Worker 通知）→ BAT 送一個 Esc 關掉選單 → 等 `question` 清除＋安靜 1 s → 照既有路徑送 `U-n：<選項>` 文字＋Enter。Esc 後選單仍開著就不送文字（保留在待送）。
- `permission` / `elicitation` / codex `input`、Worker 通知、使用者正在輸入（draft）時一律照舊保留，不代按 Esc。
- 依據：CT 6.3.0 `memory-protocol.md` § 契約 v2 欄位〈暫停的提問方式〉第 7 點（選單 Esc 後塔台照常接受文字回答）。

## 3. BAT 端拿不到、需要 CT 配合才能更好控制的地方（建議，由 CT 決定）

| # | 問題 | 建議的 CT 配合 | BAT 會怎麼用 |
|---|---|---|---|
| C-1 | BAT 只知道「塔台開著某個 AskUserQuestion」，不知道選單裡是哪幾題。使用者回答的 U-n 若不在這個選單裡（例：選單問的是別的事），按 Esc 會關掉不相干的選單。 | 開選單**前**在 `_tower-state.md` frontmatter 寫「這個選單包含哪些 U-n」（例 `menu_open: { ids: ["U-57", "U-58"], opened_at: "<ISO>" }`），選單回來（作答、Esc、或收到文字回答）的那次寫入移除。欄位名與形狀由 CT 定。 | 只在「`question` blocked ＋ 回答的 U-n 在 `menu_open.ids`」時走 Esc 流程；不在其中 → 保留到選單關閉。欄位不存在（舊 CT）→ 照 T0965 的預設。欄位只當條件之一，必須同時 `question` blocked，不會因殘留欄位誤按 Esc。待辦分頁可在該題旁提示「塔台正以選單詢問：在這裡回答會關掉選單」。 |
| C-2 | 一個選單多題時，BAT 的 Esc 會把整個選單關掉，其他題也一起取消。 | 收到「選單被中斷＋緊接的 `U-n：…` 文字」時：處理該題；同一選單剩下的題留在 `awaiting_user`。要不要立刻**只以剩下的題**重開選單（或改等待辦分頁／文字），由 CT 決定；建議避免「使用者每從待辦分頁答一題，選單就重開一次、BAT 又要 Esc 一次」的循環。 | 無需 BAT 改；BAT 依 C-1 欄位判斷新選單包含哪些題。 |
| C-3 | 能力宣告：BAT 要知道這版 CT 會寫 C-1 欄位。 | `inbox_features` 加一個值（例 `menu`），表示 CT 會寫 C-1 欄位。 | 有此值才信任「欄位不存在＝沒有選單」；沒有此值時照 T0965 預設。 |
| C-4 | 一次性誤判的風險：CT 中途當掉或 compact，欄位殘留。 | 開工（Startup）寫入時一律清掉殘留的 C-1 欄位。 | 同 C-1：必須同時 `question` blocked。 |

## 4. 想請 CT 塔台回覆的事

1. 是否受理（建 DELEGATE 工單）或不受理（理由）；C-1–C-4 哪些採用、哪些不採用。
2. C-1 欄位名稱與形狀、C-3 的 `inbox_features` 值、預計的 CT 版號。BAT 依回覆另開工單讀取（不改 T0965 的預設行為，與舊 CT 相容）。
3. 本稿前提若有錯（例：〈暫停的提問方式〉第 7 點的 Esc 行為不是這樣），請在回覆稿的更正段落指出。

## 5. 相關

- BAT：BUG-236、T0965（進行中）、T0966（待辦分頁「Worker 等你」不再把回答算成通知）、BUG-235 / T0964（回答被誤判草稿擋住）、D479 / D481。
- CT：`memory-protocol.md` § 契約 v2 欄位〈暫停的提問方式〉、`inbox_features`。

## 6. 回覆紀錄

- 2026-11-28 12:45 CT 塔台回覆草案（`BMad-Guide/_ct-workorders/_reply-2026-11-28-inbox-menu-handoff.md`，CT `cc5a8dd`、CT D925）：C-1–C-4 全採；C-2 定為不重開；C-4 放寬為 `menu_open` 只在開選單前那次寫入；CT 6.4.0，不升 `bat_contract`（BAT D484）。
- 2026-11-28 12:48 CT 使用者核定 U-10：A（CT D926），內容與草案相同 → ACKNOWLEDGED；CT PLAN-022、T0582（6.4.0-pre.1）已派工。CT T0582 收單後會傳規範「檔:行」與 6.4.0 範例狀態檔路徑，BAT 據此開 `menu_open` 讀取工單（BAT D487）。
