---
schema_version: 1
schema_kind: workorder
id: CT-T020
title: "【受派】CT 接 BAT codex 分頁的 OSC 7501 信號：斷點 D 接受 `blockedDetection: osc` / `blockedReason: input`；`--wait-started` 對 codex 生效（PLAN-047 M1b-2 / D158）"
type: implementation
status: TODO
repo: BMad-Guide
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-18T12:21:54+0800"
depends_on:
  - "T0621（`15559f8b`，契約 C-1–C-8 定稿）"
  - "BAT 含 T0621 的版本（下一個預覽版，尚未發佈；發佈後告知確切版號）"
related:
  - PLAN-047
  - D158
  - T0619
  - CT-T017
  - CT-T018
interaction:
  mode_hint: ask
  interactive: true
  intervention_type: delegate
renew_count: 0
---

# CT-T020 — codex 分頁的 `blocked` 與啟動信號

## 跨專案協調

- **協調類型**：DELEGATE
- **來源專案**：better-agent-terminal（PLAN-047 M1b-2，D158）
- **目標專案**：BMad-Control-Tower（由 **BMad-Guide 塔台**派發執行，本檔為需求規格）
- **BAT 介面權威**：BAT repo `_ct-workorders/T0621-codex-osc7501-blocked-and-start.md`「介面契約」C-1–C-8、`docs/agent-guide/blocked-state.md`（codex 節）、`docs/agent-guide/worker-launch-confirmation.md`（codex 節）、`CLAUDE.md`「blocked 狀態偵測」「Worker 啟動確認」兩節（@ `15559f8b`）。本檔與權威不一致時以權威為準，差異請在完成回覆列出。
- **BAT 最低版本**：含 T0621 的版本（下一個預覽版，發佈後告知確切版號）。舊 BAT 的 codex 分頁維持 `blockedDetection: none` / `agentStarted: null`，CT 現行行為就是正確的降級。

## 背景

codex `>= 0.163.0` 會在 PTY 送 `ESC ] 7501 ; state=idle|working|blocked`（結束 `clear`），BAT 據此（只讀、不改輸出）回報 codex 分頁的狀態與啟動（T0619 研究、T0621 實作）。CT 現行文件寫「codex Worker 一律 `blockedDetection: none`」「codex `--wait-started` 一律 `started: unknown`」，在新 BAT 上不再成立。

## BAT 新契約（摘要；完整見權威）

| 項目 | 新行為 |
|---|---|
| `blockedDetection` | 值域 `hook` / **`osc`** / `none`。`osc` = 該 PTY 出現過 OSC 7501（BAT 派工時若確認 codex `>= 0.163.0`，啟動即記 `osc`）。`hook` 分頁不會變 `osc` |
| `blockedReason` | 新增 **`input`**（`source: 'osc'`）：codex 等使用者（核准提示、Plan mode 提問等，7501 不分種類）。codex 自己送轉換時清除；**使用者輸入不清除**。優先序 `exited` > hook reason / `input` > `tower` > `working` / `idle` |
| `agentStarted` | `osc` 分頁：第一個 7501 → `true` + `agentStartedAt`；之前 `false`。`none` → `null`（不變） |
| helper `--wait-started` | 對 codex 生效：`started: <ISO>` exit 0 / `started: unconfirmed` exit **8**（實測：cwd 是未信任的 git repo，codex 卡在「Trust this folder?」畫面）/ `started: unknown` exit 0（codex 低於 0.163.0、版本確認不到、PATH 第一個是 npm shim 等）。輸出格式與 exit code 語意與 T0600 / CT-T018 相同 |
| 派工命令 | BAT 對派出的 codex Worker 另加 `-c check_for_update_on_startup=false`（避免更新提示擋住 Worker）；CT 派工指令不變 |

## 需要 CT 改的地方（建議，範圍由 BMad-Guide 決定）

1. **斷點 D**（`yolo-mode.md` § 斷點 D）：目前只認 `blockedDetection: hook` 與三種 hook reason。加上 `blockedDetection: osc` / `blockedReason: input`：codex Worker `blocked` / `input` = 在等使用者（核准或提問），比照 hook reason 只告知使用者（以分頁標題）、不代答、不送按鍵。`tower` 仍不是斷點 D。
2. **`--wait-started` / `agentStarted` 說明**（`auto-session.md` § Worker 啟動確認）：「codex 一律 `started: unknown`」改為「codex `>= 0.163.0` 時與 claude 相同；低於 0.163.0 或 BAT 確認不到版本時 `unknown`」。exit 8 的處理不變（不重派，看 `bat_read_output` 或請使用者看分頁）；可補一句 codex 最常見的 exit 8 原因是「Trust this folder?」或「Hooks need review」啟動畫面。
3. **其他引用 `blockedDetection` 值域的地方**（例如 `none` 的說明、MCP tool 欄位表）：把 `osc` 加進值域。

## 驗收建議

- CT 規則文件修改後，在含 T0621 的 BAT 預覽版上：派一張 codex Worker 工單帶 `--wait-started 30000` → `started: <ISO>`；（可選）手動 codex 分頁觸發核准提示 → 塔台 `bat_get_state` 看到 `blocked` / `input` / `osc`，依新斷點 D 告知使用者。
- BAT 端驗證已在 T0621 的 e2e 完成（真 codex 0.163.0 TUI、0 次模型呼叫）。

## 完成回覆

請以跨 session 訊息或 `_reply-*.md` 告知：修改的 CT 檔案與版本號、與 BAT 權威的差異（若有）、需要 BAT 補的東西（若有）。
