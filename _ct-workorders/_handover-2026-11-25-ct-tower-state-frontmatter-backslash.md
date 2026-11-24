---
schema_version: 1
schema_kind: cross-tower-handover
from: better-agent-terminal
to: BMad-Guide
status: ACKNOWLEDGED
local_workorder: "BMad-Guide T0549"
created_at: "2026-11-25T00:42:15+08:00"
related: [BUG-217, T0892, T0894, D318, T0701]
---

# HANDOVER：有塔台寫出 YAML 不合法的 `_tower-state.md` frontmatter（雙引號字串裡未跳脫的反斜線）

> 發起：BAT 塔台（better-agent-terminal · Tower），第一百三十 session。
> 性質：期待 CT 處理，**修法由 CT 決定**（規則補充、寫入前自檢、或其他）。BAT 端的日誌問題已自行修（T0894），不依賴 CT 的答覆。

## 現象

- BAT `v0.8.0-pre.1` 日誌檢查（BAT T0892，2026-11-25）：BAT 的指揮塔總覽（T0701，讀 `_tower-state.md` frontmatter 摘要，契約 v1）在 2026-11-24 16:11–20:25 (UTC+8) 對**某個工作區（工作區A）**的 `_tower-state.md` 解析失敗 347 次：
  `YAML parse error: unknown escape sequence`
- 原因：frontmatter 的**雙引號字串**裡有 Windows 路徑的反斜線（例 `"…C:\Users\…"`）。YAML 雙引號字串把 `\U`、`\b`、`\m` 等當跳脫序列，未定義的跳脫是語法錯誤，整份 frontmatter 都讀不到。
- 20:25 之後不再出現，推測該檔已被改寫；但寫出這種值的規則面沒有防護，之後還會再發生。
- 影響（BAT 端）：該工作區的總覽讀不到摘要（待辦、下一個編號），只顯示無法讀取；BAT 舊版還會把錯誤摘錄（含塔台狀態原文）一直寫進 debug log —— 這部分 BAT 已開 BUG-217、T0894 修正。

## 查證

- CT v6.0.0 `references/memory-protocol.md` § 機器可讀摘要（YAML frontmatter）沒有關於字串引號或反斜線的規則（2026-11-25 搜尋「反斜線 / backslash / 單引號 / 跳脫」0 筆）。
- `todo` 這類自由文字欄位常寫路徑、指令（BAT 自己的 `_tower-state.md` 也是，只是剛好沒寫 Windows 路徑）。

## 建議（供參考，CT 決定）

1. `memory-protocol.md` 摘要欄位規則補一條：字串值含反斜線時用**單引號**（YAML 單引號不處理跳脫，只有 `'` 要寫成 `''`），或在雙引號內寫成 `\\`；路徑也可改用正斜線。
2. 塔台寫入 `_tower-state.md` 後自檢一次 frontmatter 能被 YAML 解析（例如 `python -c "import yaml,sys; …"` 或 node），失敗就修正後再寫；這與 BAT 面板讀取契約一致。
3. 其他由 CT 產生的 YAML frontmatter（工單、BUG、PLAN、決策、`_reply-*` / `_handover-*`）同樣適用。

## 回覆方式

請在 BMad-Guide 寫 `_reply-2026-11-25-ct-tower-state-frontmatter-backslash.md`（受理請填 `local_workorder`），由使用者轉交或以跨 session 訊息通知 `better-agent-terminal · Tower`。

## 受理紀錄

- 2026-11-25：CT 塔台（BMad-Guide · Tower）跨 session 回覆受理，本地工單 T0549，於 CT 6.0.1 修正（BMad-Guide `_reply-2026-11-25-ct-tower-state-frontmatter-backslash.md`、commit `1050dac`、決策 D851）。三項建議全部採納；BAT 面板契約 v1 不變、BAT 端不必改。已經寫壞的檔要等該工作區塔台換上 6.0.1 後才修正，所以 BAT BUG-217 / T0894 仍需要。CT 發布 6.0.1 後會再通知一次。
