---
schema_version: 1
schema_kind: bug
id: BUG-197
title: "claude 的 `user-prompt-submit` hook 回報晚到，清掉同一回合較早記下的 `permission` / `question` blocked（對話框其實還在）"
status: CLOSED
severity: medium
reproducibility: rare
created_at: "2026-11-02T19:22:54+0800"
updated_at: "2026-11-02T23:01:45+0800"
closed_at: "2026-11-02T23:01:45+0800"
closed_reason: verified
impact:
  - tower-worker
  - blocked-state
links:
  discovered_in: "T0788 回報區〈遭遇問題〉第 1 點（e2e 第 3 次執行 ④p 第 2 輪）"
  related: [BUG-196, T0788, T0590, T0757, T0600]
---
# BUG-196 的殘留缺口 — BUG-197：hook 回報亂序清掉 blocked

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（blocked 被錯誤清除 → BUG-196 的保留不觸發；若 Worker 送的是 `--submit`，Enter 仍會替使用者作答。也影響 ⚠️ 提示與 `bat_get_state`） |
| 可重現 | 偶發：T0788 e2e 60 次情境中 1 次（假模型回得極快時） |
| **狀態** | 🚫 CLOSED（T0790 `77ad79ea`；交付版 `v0.7.3-pre.9` 安裝版實測 T0792） |
| 回報者 | 塔台（T0788 Worker 首次記錄） |

## 現象

- 預期：塔台停在權限對話框時，`TerminalBlockedTracker` 維持 `blocked` / `permission`，直到使用者作答。
- 實際（T0788 e2e，④p 第 2 輪）：`[blocked]` 依序為 `→ blocked reason=permission (hook permission-request)` → `[turn] started (hook user-prompt-submit)` → `→ cleared (hook user-prompt-submit)`，但對話框其實還在。
- 原因推定：claude 的每個 hook 是各自獨立的 `bat-hook.mjs` 程序，回報到主行程的順序不保證等於事件發生的順序。假模型回得極快時，同一回合較早的 `user-prompt-submit` 比 `permission-request` 晚到，於是清掉 blocked。

## 影響

- BUG-196 的修正（T0788 `notify-hold`）以 hook reason 判斷要不要保留。blocked 被錯清時，Worker 通知照舊直接寫入，`--submit` 的 Enter 會選中預設選項。
- 真實模型通常不會在幾十毫秒內就產生權限請求，實際發生率應低於 e2e。**未量測**。

## 修正方向（T0788 建議，需另案設計）

- `user-prompt-submit` 不清除比它晚進入、同一回合的 `permission` / `question`。例如改用回合序號或 hook 事件本身的時間序判斷，而不是以到達順序判斷。
- 🔴 CLAUDE.md「blocked 狀態偵測」節的契約（state / blockedReason / 優先序）不變，只改清除條件；T0590 / T0757 / T0621 的驗收必跑。

## 處理紀錄

- 2026-11-02 19:22 開單（OPEN，medium），T0788 收單時登記。
- 2026-11-02 19:25 → FIXING：開修正單 T0790（D230），修完與 BUG-196 一起發 `0.7.3-pre.8`。
- 2026-11-02 19:49 → FIXED（T0790，commit `77ad79ea`）：`bat-hook.mjs` 每個回報帶 `at`（hook 程序啟動時間，`process.hrtime` ns，同一主機跨程序共用的單調時鐘）；`TerminalBlockedTracker` 遇到 `at` 早於目前 `blocked` 的清除事件（`post-tool-batch` 比同一 agent 的權限請求）不清除，回合信號照舊；沒有 / 不合法的 `at` 行為不變。查證：`stop`、`post-tool-batch`、`ask-user-question-done`、`elicitation-done` 同屬 async，一併適用。驗證：單元（亂序重現、突變對照）、兩個真實 hook 程序的反序回報、e2e t0787 拿掉 RACE 重跑 3 輪 30 情境 races 0、不回歸 e2e t0590 / t0600 / t0621 / t0757、`test:unit` / `test:legacy` 全過。殘留：`at` 是 node 啟動時間而非 claude 觸發時間，間隔小於 shell + node 啟動差異時仍可能判斷錯（見 `docs/agent-guide/blocked-state.md`「晚到的清除回報」）。待與 BUG-196 一起於 `0.7.3-pre.8` 驗收。
- 2026-11-02 23:01 → CLOSED（`closed_reason: verified`）：T0792 以安裝版 `v0.7.3-pre.9`（`BAT_E2E_EXECUTABLE`，隔離實例＋假模型）跑 e2e `t0787` 3 輪，30 個對話框情境＋UI＋codex ⑤ 全過、races 0；塔台 claude 的 hook 由安裝版 BAT 注入安裝版 `resources/scripts/bat-hook.mjs`（D234）。這 3 輪沒有自然發生亂序，晚到路徑由 T0790 的單元與真實程序測試涵蓋。
