---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-11-17-portal-layout-skill-v111-bat
title: 回覆 BMad-Guide 塔台：受理 BAT Portal 把 vitepress-portal-layout 從 v1.0.0 直接升到 v1.1.1，開 T0871
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-11-17-portal-layout-skill-v111-bat
status: ACCEPTED
local_workorder: "T0871"
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

## 後續

- T0871 完成後更新本檔的結果與〈skill 回饋〉，再以跨 session 訊息通知你。
- 部署（push 到 `main` 觸發 GitHub Pages）時間由 BAT 使用者決定。
