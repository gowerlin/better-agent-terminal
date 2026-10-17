---
schema_version: 1
schema_kind: workorder
id: CT-T014
title: "【受派】CT 文件與提示對齊 BAT 0.7.0-pre.1：每分頁範圍權杖（batcap.）、分頁角色決定 helper 權限、遠端可用 raw command"
type: implementation
status: IN_PROGRESS
repo: BMad-Guide
project: PLAN-047
priority: P3
sizing: XS
created_at: "2026-10-17T20:26:41+0800"
depends_on:
  - "T0575（本機 PTY 範圍權杖，`2c59edee`）"
  - "T0576（權杖跨 BAT 重開保留，`7e3c1d7d`）"
  - "T0579（headless tower 可用 raw command，`514710a9`）"
related:
  - D149
  - D151
  - PLAN-047
  - CT-T011 / CT-T013（同類「CT 呼叫 BAT helper、非 0 exit 不重試」範本）
interaction:
  mode_hint: ask
  interactive: true
  intervention_type: delegate
renew_count: 0
---

# CT-T014 — 對齊 BAT 0.7.0-pre.1 的範圍權杖

## 跨專案協調

- **協調類型**：DELEGATE
- **來源專案**：better-agent-terminal（PLAN-047 A1 / A2，D149；版號 D151）
- **目標專案**：BMad-Control-Tower（`D:\ForgejoGit\@Gower_Labs\BMad-Guide\BMad-Control-Tower\`，現行 v5.2.3；由 **BMad-Guide 塔台**派發執行，本檔為需求規格）
- **時機**：BAT `v0.7.0-pre.1` 預計 2026-10-17 發佈（T0580 收單後）。本單的 CT 變更只是文件與失敗提示，在舊 BAT 上行為不變，可先發

## BAT 端變更（已實作，source / test 驗證完成；runtime 待 0.7.0-pre.1 實機）

1. **本機分頁的 `BAT_REMOTE_TOKEN` 不再是全權 server token**，改為該分頁專屬的 `batcap.` 範圍權杖（遠端 headless 自 PLAN-036 K 起已是如此）。變數名不變，helper 讀法不變。
2. **權限依分頁角色**（本機與遠端同一張表）：
   | 分頁 | 判定 | 可用的 helper |
   |---|---|---|
   | tower | 沒有 `BAT_TOWER_TERMINAL_ID` 的分頁（使用者自己開的分頁、塔台分頁） | `bat-terminal.mjs` 派工（agent 模式 `--skill/--prompt` 與 raw command 模式）、`--close-worker`（只能關自己派出的 Worker）、`--set-role`（只能設自己） |
   | worker | 帶 `BAT_TOWER_TERMINAL_ID` 的分頁（被塔台派出的分頁） | `bat-notify.mjs`：只能通知 / 預填 / `--submit` 給**綁定的那個塔台**；預填只收可列印文字 |
   其他一律 `Forbidden`（stderr `Error: Forbidden: role-not-allowed` / `channel-not-allowed` / `target-not-bound`），helper exit `1`。
3. **行為改變（舊 BAT 可以、0.7.0 起不行）**：
   - 在 Worker 分頁裡派工、`--close-worker`、`--set-role` → exit 1（`set-role: FORBIDDEN`）
   - 在非 Worker 分頁手動執行 `bat-notify --target <任意分頁>` → exit 1
   - `--set-role --terminal-id <別的分頁>` → exit 1
4. **跨 BAT 重開保留**：退出 BAT 時不停止 Terminal Server、重開後選「保留」，存活分頁的權杖照常有效（T0576）。Recovery 提示回答前的派工會等到回答後才建立分頁（T0578 / T0580）。
5. **遠端 Tower 也能用 raw command 派工**（`bat-terminal.mjs claude "/ct-exec T####"`，T0579）；差異：遠端 raw command 用遠端使用者 `PATH` 上的 `claude`（不是 bundle 內嵌），不經 `AGENT_UNAVAILABLE` 檢查，且不記錄工單號（`--close-worker` 找不到）。**CT 仍應首選 agent 模式**（`--skill` + `--workorder`）。
6. 升級當下仍存活的舊分頁（env 是舊的全權 token）維持可用直到重開。

BAT 塔台已核對現行 CT v5.2.3 skill（唯讀）：ct-exec / ct-done 只以 `bat-notify --target "$BAT_TOWER_TERMINAL_ID"` 回報自己的塔台，Tower 只在自己分頁派工 / 回收 / set-role → **正常流程不受影響**，不需要改行為。

## 修改清單（文件與提示）

1. **`references/auto-session.md` § BAT 內部終端路由**：補一小節（或在既有偵測條件後）說明：
   - `BAT_REMOTE_TOKEN` 在 BAT ≥ 0.7.0-pre.1（本機）與遠端皆為**分頁專屬**權杖：不得在分頁間複製、不得寫入日誌 / 工單 / 剪貼簿、不得假設它是 server token
   - 分頁角色決定 helper 權限（上表摘要）
   - **塔台必須在非 Worker 分頁啟動**：在 Worker 分頁（有 `BAT_TOWER_TERMINAL_ID`）執行 `/control-tower`，派工 / `--close-worker` / `--set-role` 會 exit 1
2. **失敗提示**：派工或 `--set-role` / `--close-worker` exit 1 且 stderr 含 `Forbidden` 時，降級訊息多一句可辨識原因，例如「此分頁是 Worker 分頁（BAT 範圍權杖），請在一般分頁啟動塔台」。仍遵守既有規則：非 0 不重試、照既有降級鏈。stderr 文字只作提示用，判斷仍以 exit code 為準（不新增依字串判版）。
3. **Startup Protocol（選做）**：Tower 啟動時若偵測到 `BAT_TOWER_TERMINAL_ID` 存在，狀態面板 BAT 行加註「Worker 分頁：無法派工」。
4. **遠端說明**：若 CT 文件有「遠端只能 agent 模式」之類描述，改為「兩種模式皆可，首選 agent 模式」並附第 5 點差異；沒有則不需改。
5. 版本說明 / CHANGELOG 註明對應 BAT `>= 0.7.0-pre.1`；舊 BAT 不受影響。

## 驗收

- 文件：auto-session.md 有上述權杖 / 角色 / 塔台分頁規則，且為唯一權威位置（SKILL.md 只放摘要）
- 舊 BAT（現行 0.6.1-pre.9）：Tower 啟動、派工、回收、Worker 回報行為與 v5.2.3 完全相同
- 新 BAT 0.7.0-pre.1 實機（發版後另開單）：一般分頁啟動 Tower → 派工 / 回收 / set-role 正常；在 Worker 分頁啟動 Tower → 派工 exit 1 且降級訊息有原因提示

---

## 轉交紀錄

- 2026-10-17T20:27:36+0800：使用者授權「規格確認即可發給 BMad-Guide 塔台」；BAT 塔台以跨 session 訊息轉交（session `bmad-guide-f4`，msg `bdc8b44b`，`notify_when_idle`），附規格檔路徑與重點，請其受理與完成各回覆一次。
- 2026-10-17T20:31:08+0800：BMad-Guide 塔台回覆**已受理** → 該方工單 **T0149**（`BMad-Guide/_ct-workorders/T0149-ct-v524-bat-scoped-token-docs.md`，對方決策 D028），預計 CT **v5.2.4**（PATCH，新建目錄），20:30 派 Worker（yolo、`--no-interactive`）。修改清單 1–5 全做（含選做的面板加註）。與規格寫法的三點差異，BAT 塔台**接受**：(a) 判斷只看 exit code，stderr 的 Forbidden 只用來挑提示文字，文件中「不解析 stdout / stderr」處統一改為此說法；(b) Forbidden 為降級鏈「靜默降級」的例外，顯示一行原因；(c) 遠端「只能 agent 模式」描述由對方 Worker 確認後回報。不做 runtime 實測，且禁止在 Worker 分頁實跑 `--set-role` / 派工（舊 BAT 不擋，會把 Worker 分頁改成塔台角色）；0.7.0-pre.1 實機驗收發版後另開單。兩端（Claude + Codex）安裝已獲使用者授權。對方不寫本 repo。
- 2026-10-17T20:33:57+0800：補充 T0580 新增的 `RECOVERY_PENDING`（BAT 重開、Recovery 提示未回答時派工 → helper exit 1，stderr `Failed to create terminal (RECOVERY_PENDING): …`，確定未建立分頁），請對方納入失敗提示文字（判斷仍只看 exit code，不要求自動重派）。
