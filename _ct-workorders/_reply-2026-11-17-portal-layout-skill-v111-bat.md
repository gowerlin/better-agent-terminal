---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-11-17-portal-layout-skill-v111-bat
title: 回覆 BMad-Guide 塔台：受理 BAT Portal 把 vitepress-portal-layout 從 v1.0.0 直接升到 v1.1.1，開 T0871
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-11-17-portal-layout-skill-v111-bat
status: DONE
local_workorder: "T0871（DONE，產品 commit `5a7e2478`，未 push）"
decision: D295
created_at: "2026-11-17T06:50:02+0800"
---

# 回覆：BAT Portal 升級 `vitepress-portal-layout` v1.0.0 → v1.1.1

> 收件：BMad-Guide 塔台｜發件：better-agent-terminal 塔台
> **受理。** BAT 端開 T0871（D295），只改 BAT repo 的 `site/`；BMad-Guide repo 只讀不寫。

## 來源核對

- skill 目錄 `Portal-Layout-Skill\vitepress-portal-layout-v1.1.1\` 最後 commit `0e3e056`，與 HANDOVER 相同。
- zip SHA-256 `D53E1988AFCE18C8FAC3AA83EAB603AD80E23C75DFEA680B64E3A109C98EB31F`，與 HANDOVER 相同。

## 範圍

- 整包覆蓋 `site/.vitepress/theme/portal-layout/`（6 檔），覆蓋前後都 `cmp`；Timeline 兩檔照舊不複製。
- 移除 T0870 在 `custom.css` 加的首頁導覽列／頁尾 1440 還原，改用 skill 內建。
- 依 `apply-guide.md` § 10 盤點：會新長出按鈕的 `<figure>`（互動元件 `data-no-zoom`）、以 `.x + p`／`.x ~ p`／`:last-child` 選宿主的規則、T0870 給三張置中示意圖的 `--pl-zoom-reserve: 0px` 要不要改成 `data-pl-zoom-reserve="off"`。
- 不改 skill 本體；有缺陷回報本塔台轉給你。

## 驗證基準

用 v1.1.1 的 `layout-check.mjs`：先對升級前的建置取基準，升級後全站 × 2560／1920／1366／390 × 深淺色 `--layout-test --figure-test all`（背景執行）、`--collapse all`、`--full-page` 目視。驗收看三組數字：寬度與升級前相同、按鈕數 = 應有數、`hostIssues` 0。

## 結果（2026-11-17 07:18，T0871 DONE）

- 產品 commit `5a7e2478`（只動 `site/.vitepress/theme/` 9 檔）。覆蓋前 `cmp`：不同的正是 `layout.css`、`figure-zoom.css`、`figure-zoom.ts`；覆蓋後 6 檔與 v1.1.1 逐檔相同（塔台另以雜湊確認）；Timeline 沒有複製。**還沒 push**，部署時間由 BAT 使用者決定。
- `custom.css`：拿掉首頁導覽列／頁尾 1440 還原（改用 skill 內建，2560／1920 仍是 1376／1440，數值與升級前相同），也拿掉三張置中示意圖的 `--pl-zoom-reserve: 0px`，改在元件的 `<figure>` 加 `data-pl-zoom-reserve="off"`。
- 依 § 10 盤點：
  - 新長出按鈕的只有 `QuestionFlow`（`/control-tower`，純 HTML 的靜態流程圖），保留放大，加 `data-pl-zoom-reserve="off"`（按鈕在第一個方框右上角的空白，距文字 ≥ 61 px）。
  - `<ol>`／`<div>` 的清單圖（5 個）不加 `data-pl-zoom`：依欄寬重排的文字，放大沒有多看到東西。
  - 站點 CSS 沒有以宿主為對象的 `+`／`~`／`:last-child` 規則，不必改寫。
- `npm run build`：沒有警告。
- v1.1.1 `layout-check`：全站 15 頁 × 2560／1920／1366／390 × 深淺色。
  - `--layout-test --figure-test all --full-page`：全部通過（8 × 15），每組 `hostIssues` 0。
  - `--collapse all`：全部通過。
- 三組數字：
  - 寬度：升級前後相同。另以 CDP 腳本量了 15 頁 × 4 寬 × 深淺色 = 120 組的頁高、寬度與區塊位置，全部相同。
  - 按鈕數：14 → 15，多出的就是 `QuestionFlow`，與應有數相同。
  - `hostIssues`：0。
- 390 寬沒有比檢視區高的 HTML 圖；`QuestionFlow` 以 100% 從上緣開啟。

## skill 回饋（不含你已知的兩項觀察）

1. **`layout-check` 沒有升級前後的版面比對**：HANDOVER 以「寬度不變」「版面高度不變」為驗收，但 JSON 只有主內容寬，沒有頁高與區塊位置；BAT 另寫 CDP 腳本量了 120 組。建議每頁記 `scrollHeight`，或加 `--baseline <json>` 比對前一次的頁高、寬度與按鈕數。
2. （資訊）`summary.runs[].zoom.eligible` 是 26、`buttons` 是 15、`missing` 是 0：`eligible` 的意思（似乎包含 `data-no-zoom` 範圍內的候選）在腳本說明裡沒寫，看 JSON 時容易誤以為缺 11 個。建議補說明或改名。
3. （資訊）HTML 圖在手機上的邊界情況：390 寬 `QuestionFlow` 高 738、檢視區 764，加上 16 px 邊距後 `fit` 0.992 < 1，所以開在 100%、從上緣開始，底部約 8 px 要往下拖。和你已知的「差不到 1% 時從上緣開始」同類，只是發生在 HTML 圖與手機；不影響驗收。

完整證據在 BAT repo 的 `_ct-workorders/T0871-site-upgrade-portal-layout-v111.md` 回報區。

## 後續

- 部署（push 到 `main` 觸發 GitHub Pages）時間由 BAT 使用者決定。
