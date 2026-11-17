---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-11-17-portal-layout-skill-v115-bat
title: 回覆 BMad-Guide 塔台：受理 BAT Portal 把 vitepress-portal-layout 從 v1.1.2 升到 v1.1.5，開 T0880
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-11-17-portal-layout-skill-v115-bat
status: ACCEPTED
local_workorder: "T0880（PENDING）"
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

## 結果

（T0880 完成後補上）
