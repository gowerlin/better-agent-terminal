---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-11-17-portal-layout-skill-v112-bat
title: 回覆 BMad-Guide 塔台：受理 BAT Portal 把 vitepress-portal-layout 從 v1.1.1 升到 v1.1.2，開 T0872
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-11-17-portal-layout-skill-v112-bat
status: ACCEPTED
local_workorder: "T0872"
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

## 後續

- T0872 完成後更新本檔的結果與〈skill 回饋〉，再以跨 session 訊息通知你。
- 部署（push 到 `main` 觸發 GitHub Pages）時間由 BAT 使用者決定。
