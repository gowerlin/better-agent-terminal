---
schema_version: 1
schema_kind: plan
id: PLAN-048
title: "Worker 問塔台 / 塔台答覆的結構化通道（CT-to-BAT 需求）"
status: PLANNED
priority: medium
created_at: "2026-10-18T02:43:24+0800"
links:
  source: "BMad-Guide 塔台跨 session 需求（2026-10-18，對方 D036，使用者已同意提出）"
  related: [PLAN-047, CT-T017, T0582, T0584]
---

# PLAN-048 — Worker 問塔台 / 塔台答覆通道

## 動機

BMad-Guide D036：`auto-session = yolo` 時，Worker 有問題向塔台提問，由塔台在工單範圍內代決，越界才問使用者。CT v5.5.0 先用工單檔往返（Worker 寫問題進工單 → notify 塔台 → 原地等；塔台寫回答覆；逾時以 BLOCKED 結束再 Renew）。需要一個有範圍限制的問答通道取代讀檔等待。

## 對方提出的需求（原文摘要，介面與排期由 BAT 決定）

- Worker 端 MCP tool 例如 `bat_ask_tower(question, options?)`：送到綁定的塔台，等答覆或逾時。
- 塔台端以 MCP 或 helper 讀取待答問題、回覆答案，限自己派出的 Worker。
- 約束：不經 `pty:write`、不模擬按鍵；問答內容遮罩權杖、不寫進日誌；codex Worker 也能用為佳；舊 BAT 不支援時要能判定（CT 降級到工單檔往返）。

## 現況與待決（BAT 塔台）

- 目前範圍權杖：Worker → 塔台可 notify / `pty:write` / keypress；塔台 → Worker 不可寫；BAT MCP 全為唯讀（T0582 / T0584）。新通道需新增一組 helper channel 與權限列，屬 `HELPER_CHANNEL_ROLES` 擴充。
- 待決：等待模型（MCP tool 阻塞等候上限，參照 `terminal:wait` 45 s）、持久化（BAT 重開後待答問題是否保留）、塔台通知方式（沿用 notify 預填 / 送出）、與 `blocked` 的關係（Worker 等塔台時是否算 `blocked`）。
- 排期：使用者決定。正式規格於排期時寫入本檔或另開研究工單。

## 排期（2026-10-18，D155）

- 使用者選定：先研究再實作、答覆走 helper CLI、待答問題只存記憶體、等待中 `blocked` / `tower`（D155）。
- 研究單 **T0606**：現況盤點、介面契約草案、實作切分；審過後開實作單並轉交 CT（CT-T019）。
