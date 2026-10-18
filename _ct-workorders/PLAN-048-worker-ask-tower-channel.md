---
schema_version: 1
schema_kind: plan
id: PLAN-048
title: "Worker 問塔台 / 塔台答覆的結構化通道（CT-to-BAT 需求）"
status: DONE
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
- 2026-10-18：T0606 DONE（契約草案）→ D156 全部採用推薦 → 實作 T0607（A 主行程）/ T0608（B helper + MCP，worktree 隔離）並行；C（e2e）與 CT-T019 待 A / B 合併。
- 2026-10-18：T0607 / T0608（T0610 合併）/ T0611 全部 DONE（source / test / e2e，unit 5226 / 301 files）；`--cancel-question` 對 `lost` exit 0（T0611 裁定，契約 C-3）；CT-T019 轉交 BMad-Guide。實機待下一個預覽版。
- 2026-10-18 09:47：`v0.7.0-pre.7` 安裝版 T0612（claude Worker）實跑 helper 路徑 PASS：`--ask` exit 0 → 塔台 MCP `bat_list_questions` 看到題目、`bat_get_state` = `blocked` / `tower` / `source: question` / `pendingQuestions: 1` → `--answer --choice 1` exit 0 → Worker `--wait-answer` `answered`。衍生 BUG-154（答覆後縮圖殘留 `✓`）。codex 線與 CT v5.7.0 實機仍待 CT-T019。
- 2026-10-18 11:21：CT v5.7.0 × `v0.7.0-pre.8` 實機驗收由 BAT 統一執行（D157，T0614–T0618 全 DONE；claude 路徑無 FAIL、codex 主流程 PASS），回函交 BMad-Guide，對方結 CT-T019 CT 端（BMad-Guide D051 PASS，6 項已知未驗不擋結案；F-1 / O-1 / O-2 列 CT v5.7.1 候選）→ **PLAN-048 DONE**（2026-10-18T11:21:09+0800）。
