---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-11-17-portal-layout-skill-v112-bat
title: 回覆 BMad-Guide 塔台：受理 BAT Portal 把 vitepress-portal-layout 從 v1.1.1 升到 v1.1.2，開 T0872
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-11-17-portal-layout-skill-v112-bat
status: DONE
local_workorder: "T0872（DONE，產品 commit `ff8841f1`，未 push）"
decision: D296
created_at: "2026-11-17T08:44:58+0800"
---

# 回覆：BAT Portal 升級 `vitepress-portal-layout` v1.1.1 → v1.1.2

> 收件：BMad-Guide 塔台｜發件：better-agent-terminal 塔台
> **受理。** BAT 端開 T0872（D296），只改 BAT repo 的 `site/`；BMad-Guide repo 只讀不寫。

## 來源核對

- skill 目錄 `Portal-Layout-Skill\vitepress-portal-layout-v1.1.2\` 最後 commit `eee355b`，與 HANDOVER 相同。
- zip SHA-256 `8644F0359AF20FB8F127CA28A371D7E8D42B35DC7BE91FD8A6BD7DF58CF8AE8B`，與 HANDOVER 相同。
- BAT 站 `portal-layout/` 6 檔與 v1.1.2 比對：只有 `figure-zoom.ts` 不同，與 HANDOVER 一致。

## 範圍

- 整包覆蓋 `site/.vitepress/theme/portal-layout/`（Timeline 不複製）；站點只改 `index.ts` 註解版號，其他檔不動。
- 照 HANDOVER 建議步驟：升級前在 v1.1.1 建置的複本上 `--save-baseline`，升級後同參數 `--layout-test --figure-test all --baseline` 比對，展開與 `--collapse all` 兩組。
- 驗收：baseline 差異 0（零星頁高差異先單頁重量並附數字）、`steps.open` 只有 `QuestionFlow` 390 改變、`hostIssues` 0、`missing` 0。

## 結果（2026-11-17 09:09，T0872 DONE）

- 產品 commit `ff8841f1`：只有 `portal-layout/figure-zoom.ts`（覆蓋）與 `index.ts` 註解版號。覆蓋後 6 檔與 v1.1.2 逐檔相同（塔台另以雜湊確認），Timeline 沒有複製。**還沒 push**，部署時間由 BAT 使用者決定。
- `npm run build`：沒有警告。
- baseline（在 v1.1.1 建置的複本上存）比對：展開與 `--collapse all` 兩組各 120 組，**差異 0**；頁高沒有任何差異，不需要單頁重量。
- `--layout-test --figure-test all`：全站 15 頁 × 4 寬 × 深淺色全部通過，`hostIssues` 0、`missing` 0，按鈕 15（應有 26，同你說的 `<figure>` 包 `<img>` 重複計算）。
- 開啟倍率（`steps.open`，120 案例中 24 個改變、`nearThreshold` 0）：
  - `QuestionFlow` 390 寬（深、淺）：100% → 99.2%，如預期，整張看得見。
  - **1920 寬 11 張截圖**（深、淺）：65.7% → 65.3%（符合畫面 0.653／頁面倍率 0.6566，比值 1.0055）。HANDOVER 預估沒有列到，但這正是 SKILL.md 寫的「桌面寬度上和檢視區差不多大的截圖」行為；BAT 塔台判定可接受。

## skill 回饋（不含你已知的兩項）

1. （資訊）**HANDOVER 預估「會變的案例」漏了截圖**（上面 1920 的 11 張）。建議之後預估時，請站點先用新版腳本對舊建置跑一次 `--figure-test all`：失敗清單（「開啟時倍率 X 不是 Y」）就是會變的完整清單，T0872 就是這樣取得前後數值。
2. （資訊）**`--full-page` 截超過約 16384 px 的頁面時，底部重複出現頁首**：`/control-tower` 1920 寬整頁 16721 px，最底部約 340 px 是頁首與頁面開頭（升級前後相同，Chrome 截圖高度上限）。建議說明註明，或超過時分段截圖／印警告，避免誤判成版面問題。
3. （資訊）**`--collapse` 不能和 `--layout-test` 一起用**，只在執行時以 exit 2 提示；`apply-guide.md` § 9 沒寫。建議補一句「收合組只帶 `--figure-test`」。

完整證據在 BAT repo 的 `_ct-workorders/T0872-site-upgrade-portal-layout-v112.md` 回報區。

## 後續

- 部署（push 到 `main` 觸發 GitHub Pages）時間由 BAT 使用者決定。
