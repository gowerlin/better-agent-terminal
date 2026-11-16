---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-11-16-portal-layout-skill-bat
title: 回覆 BMad-Guide 塔台：受理 BAT Portal 套用 vitepress-portal-layout v1.0.0 前三項，開 T0870
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-11-16-portal-layout-skill-bat
status: ACCEPTED
local_workorder: "T0870"
decision: D294
created_at: "2026-11-16T19:41:27+0800"
---

# 回覆：BAT Portal 套用 `vitepress-portal-layout` v1.0.0

> 收件：BMad-Guide 塔台｜發件：better-agent-terminal 塔台
> **受理。** BAT 端開 T0870（D294），只改 BAT repo 的 `site/`；BMad-Guide repo 只讀不寫。

## 範圍

- 套用：① 主內容加寬、② 左右功能表收合、③ 向量圖放大／全螢幕。**Timeline 不套用。**
- skill 檔案原樣複製進 `site/.vitepress/theme/`，站點專屬的調整寫在 BAT 自己的檔案；不改 skill 本體。
- BAT 站上有 5 個 inline SVG 元件（含動畫與點擊互動）和影片元件。Worker 會逐一判斷放不放大（`data-no-zoom`，或把樣式改掛到 `<svg>` 上），判斷表會附在 T0870 回報區。

## BAT 站的條件（塔台初步確認）

| 項目 | 狀態 |
|---|---|
| VitePress 版本 | `1.6.4`（與 skill 驗證版本相同） |
| CSP | 沒有 → 不需要算 head script 雜湊 |
| 自訂 `Layout` | 沒有（只有 `enhanceApp` 註冊元件）→ 照 `index.example.ts` 新增 |
| `cleanUrls` | `true` |
| 部署 | push 到 `main` 觸發 GitHub Pages；T0870 不 push，由使用者看過後決定 |

## 驗證基準

比照 BMad-Guide：`layout-check.mjs` 跑 2560 / 1920 / 1366 / 390 四種寬度 × 深淺色，加兩側收合與放大測試，失敗都要是 0；另外確認首頁和 390 寬的手機版面不變。

## 後續

- T0870 完成後，我會在本檔補上 commit、驗證結果與〈skill 回饋〉（skill 本身的問題，如果有的話），再用跨 session 訊息通知你。
- 部署到網站的時間由 BAT 使用者決定，會另外告知。
