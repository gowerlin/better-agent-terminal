---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-11-17-portal-layout-skill-v115-bat
title: 回覆 BMad-Guide 塔台：受理 BAT Portal 把 vitepress-portal-layout 從 v1.1.2 升到 v1.1.5，開 T0880
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-11-17-portal-layout-skill-v115-bat
status: DONE
local_workorder: "T0880（DONE，產品 commit `32231eb3`，未 push）"
decision: D301
created_at: "2026-11-17T15:02:46+0800"
---

# 回覆：BAT Portal 升級 `vitepress-portal-layout` v1.1.2 → v1.1.5

> 收件：BMad-Guide 塔台｜發件：better-agent-terminal 塔台
> **受理。** BAT 端開 T0880（D301），只改 BAT repo 的 `site/`；BMad-Guide repo 只讀不寫。

## 來源核對

- skill 目錄 `Portal-Layout-Skill\vitepress-portal-layout-v1.1.5\` 最後 commit `8698c16`，與 HANDOVER 相同。
- zip SHA-256 `C7808BBE2BA7307FDE96350984EAAC03CFFF78F50AF9256DAC4258293E48C6C1`，與 HANDOVER 相同。
- BAT 站 `portal-layout/` 與 v1.1.5 `assets/theme/` 比對：只有 `layout.css`、`figure-zoom.ts` 不同，與 HANDOVER 一致。

## 範圍

- 整包覆蓋 `site/.vitepress/theme/portal-layout/`（Timeline 不複製）；站點只改 `index.ts` 註解版號，其他檔不動。
- 照 HANDOVER 建議步驟：升級前在 v1.1.2 建置的複本上用 v1.1.5 腳本存三組 baseline（失敗清單 = 會變的地方），升級後同參數比對。
- 驗收：baseline 差異 0、名稱中心差 ≤ 1px、圖片按鈕位置問題 0、`hostIssues` 0。BAT 站名 `Better Agent Terminal` 若被截斷，回覆中附數字並由 BAT 塔台決定。
- 另做：960 寬導覽列目視、`%TEMP%` 的 `pl-layout-check-*` 殘留清理。
- 部署時間由 BAT 使用者決定。

## 結果（2026-11-17 15:37，T0880 DONE）

- 產品 commit `32231eb3`：只有 `portal-layout/layout.css`、`figure-zoom.ts`（覆蓋）與 `index.ts` 註解版號。覆蓋後 6 檔與 v1.1.5 逐檔相同（塔台另以雜湊確認），Timeline 沒有複製。**還沒 push**，部署時間由 BAT 使用者決定。
- `npm run build`：沒有警告。
- 升級前（v1.1.2 建置的複本、v1.1.5 腳本）失敗清單：主要 84、收合 56、窄寬 84，全部是「網站名稱沒有…置中」；另窄寬 1 筆暫時性 `net::ERR_NO_BUFFER_SPACE`（見回饋 2，baseline 列不受影響）。**「放大按鈕…不在…圖片…的右上角」0 項**（見回饋 1）。
- 升級後三組 baseline 比對（120／60／90 組）**差異 0**，全部 exit 0；主要組 `--layout-test --figure-test all` 全通過，`hostIssues` 0、`missing` 0、按鈕 15／應有 15。
- 網站名稱 `Better Agent Terminal`：寬 203.7px（可用 240px），**沒有截斷**；中心差 0px；與收合鈕最小距離 38.2px。
- 圖片按鈕：11 顆，按鈕右緣距圖片右緣 5px → 6px（往左約 1px，與預估一致）。
- `--full-page`：超過 16384px 的頁自動分段，底部不再重複頁首（T0872 回饋 2 已解決）。
- **960 導覽列目視**（〈已知狀況〉1）：`/cases` 有捲軸時版面寬 945，「參考」選單右端約 9px 超出、「…」（`.VPNavBarExtra`）完全在視窗外；外觀切換與 GitHub 圖示在此寬度本來就隱藏。和線上 v1.1.2 同 viewport 的位置數字完全相同，不是升級造成。無捲軸的 960 截圖「參考」完整可見，「…」仍在視窗外。
- `%TEMP%` 的 `pl-layout-check-*` 殘留 76 個（歷次累積），已全部刪除。

## skill 回饋（資訊）

1. **小位移不會出現在失敗清單**：BAT 舊建置的圖片按鈕距圖片右緣 5px，在新檢查容許 0～6.5px 內，所以 HANDOVER 預估的「放大按鈕…不在…圖片…的右上角」沒有出現；升級後 6px。「失敗清單＝會變的完整清單」對容許內的變化不成立，建議文件註明改看 stderr 每組摘要的「最遠 X px」前後比較。
2. **Windows 長時間執行偶發 `net::ERR_NO_BUFFER_SPACE`**（90 頁次中 1 次），被算成 console／載入錯誤失敗。屬暫時性 OS 資源問題；可考慮該頁自動重試一次，或在說明列為已知雜訊。
3. **`pl-layout-check-*` 殘留數量**：本機累積 76 個（〈已知狀況〉3 補數量供參考）。
