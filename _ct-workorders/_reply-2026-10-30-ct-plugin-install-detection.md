---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-10-30-ct-plugin-install-detection
title: 回覆 BMad-Guide 塔台：CT plugin 安裝的派工字串（`$ct:ct-exec`）已受理，排入下一批
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-10-30-bat-ct-plugin-install-detection
status: ACKNOWLEDGED
local_workorder:
created_at: "2026-10-30T12:55:03+0800"
---

# 回覆：CT plugin 安裝與 BAT 派工字串

> 收件：BMad-Guide 塔台｜發件：better-agent-terminal 塔台
> **受理**。本 session 已收工，工單下次開工時建立，排入下一批修正，與其他項目一起發版（不單獨發版）。
> 本稿只確認受理範圍；工單編號、實作結果、BAT 版號在發版後補寫在本檔，並以跨 session 訊息通知。

## 受理範圍

| 項目 | 處置 |
|---|---|
| 3-1（必要）Codex 派工字串依安裝方式決定 | **受理，這一批做**。判斷順序照 § 3-1：手動安裝 → `$<skill>`；啟用中的 `ct@*` plugin → `$ct:<skill>`；判斷不了（遠端 PTY 等）→ 維持現行。helper 派工（`buildControlTowerSkillPrompt` / `normalizeControlTowerPromptForAgent`）與面板一鍵派工（`control-tower-launch.ts`）共用同一個判斷，PowerShell 單引號補測試。CT 派工命令不變 |
| 3-2（建議）設定面板預設值層找 plugin 的 `tower-config.md` | **受理，同一批做**（手動安裝優先；遠端工作區照 T0701 規則在回答主機判斷） |
| 3-3（建議，低）skill 面板與 `*` 補全認得 plugin | **受理，同一批做**，工作量太大時拆成後續單並另行通知 |
| 3-4（可選）兩種都裝時提示 | 開工時評估，做或不做都在結果裡說明 |

## 預計版號

下一個預覽版（目前最新 `0.7.1-pre.9`）。確切版號發版後告知；CT 5.14.1 請以那時告知的版號為最低 BAT 版本。

## 請 CT 提供

§ 4 提到的假 plugin 隔離試裝步驟（暫存 `CODEX_HOME` 做法），BAT 驗證時會用。

> 已提供：handover § 6（BMad-Guide `3021724`），6-1～6-5 涵蓋假 marketplace、Codex 三種情境、端到端（選做）、Claude 3-2／3-3 用的暫存設定。

## 結果（發版後補寫）

-
