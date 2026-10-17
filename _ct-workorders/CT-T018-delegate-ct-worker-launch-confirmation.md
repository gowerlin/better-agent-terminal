---
schema_version: 1
schema_kind: workorder
id: CT-T018
title: "【受派】CT 接 BAT Worker 啟動確認：派工加 `--wait-started`、exit `8`、`agentStarted` 狀態欄位（D154 / T0600）"
type: implementation
status: TODO
repo: BMad-Guide
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-18T03:41:41+0800"
depends_on:
  - "T0600（BAT Worker 啟動確認，`75a867b1`）"
  - "BAT 含 T0600 的版本（預計 `0.7.0-pre.6`，尚未發佈）"
related:
  - D154
  - BUG-151
  - BUG-152
  - CT-T017
interaction:
  mode_hint: ask
  interactive: true
  intervention_type: delegate
renew_count: 0
---

# CT-T018 — Worker 啟動確認

## 跨專案協調

- **協調類型**：DELEGATE
- **來源專案**：better-agent-terminal（D154 / T0600）
- **目標專案**：BMad-Control-Tower（由 **BMad-Guide 塔台**派發執行，本檔為需求規格）
- **BAT 介面權威**：BAT repo `CLAUDE.md`「Worker 啟動確認（T0600，D154）」節與 `docs/agent-guide/worker-launch-confirmation.md`。本檔與權威不一致時以權威為準，差異請在完成回覆列出。
- **BAT 最低版本**：含 T0600 的版本（預計 `0.7.0-pre.6`，發佈後告知確切版號）。

## 背景

helper 派工在 PTY 建立後就回 exit 0，啟動指令約 500 ms 後才寫入，塔台無從得知 Worker 是否真的起來（BUG-151：exit 0 但 claude 沒啟動）。T0600 讓 claude 的 `SessionStart` hook 回報「已啟動」，並提供 helper 的 opt-in 等待。

## BAT 介面（T0600 介面契約摘要）

### helper

派工命令照舊，加 `--wait-started <ms>`（必須同時帶 `--notify-id`）：

```
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" \
  --cwd "<project root>" --mode <m> --agent default --skill ct-exec --workorder T#### [--isolation worktree] --wait-started <ms>
```

- `<ms>`：非負整數，上限 `120000`（超過以 120000 計）；`0` = 只查一次。
- 建立成功後既有輸出照舊，stdout **最後一行**為 `started:` 行（解析：`/^\s*started: (\S+)\s*$/m`，取最後一個）：

  | stdout 最後一行 | exit | stderr | CT 判斷 |
  |---|---|---|---|
  | `  started: <ISO 8601 UTC>` | `0` | — | 已啟動 |
  | `  started: unknown` | `0` | `wait-started: NO_SIGNAL \| UNSUPPORTED \| NOT_OWNER \| NOT_FOUND \| TOO_MANY_WAITS \| FORBIDDEN \| ERROR \| TIMEOUT` | **無法判定**（codex、自訂 CLI、hooks 未注入或被 claude 設定關閉、BAT 無法回答）→ 照舊以 Worker 回報判斷，**不是失敗** |
  | `  started: unconfirmed` | **`8`** | `create: LAUNCH_UNCONFIRMED` | 分頁在、但期限內未確認啟動（或分頁先結束）→ 看分頁輸出（`bat_read_output`）或提醒使用者；**不要重派**（分頁不會關閉，重派會產生兩個 Worker） |

- `1`：既有規則（派工失敗 / 用法錯誤）。分頁建立後的任何查詢問題一律 `unknown` + exit 0，不會回 1。
- **相容**：不帶 `--wait-started` → 輸出與 exit code 完全不變。`8` 只在帶參數時出現；既有 `0` / `1` / `3` / `4` / `5` / `6` / `7` 語意不變。
- **版本判定**：舊 helper 不認得參數 → exit `1`、stderr `Error: Unknown option '--wait-started'`、**不建立分頁** → CT 去掉參數重派一次（= BAT 太舊）。`--help` 含 `--wait-started` = 支援。

### 狀態欄位（MCP 唯讀 tool）

- `bat_get_state` / `bat_wait` / `bat_list_terminals` 每列多 `agentStarted: true | false | null`；get-state / wait 在 `true` 時另回 `agentStartedAt`（ms epoch）。`null` = 無法判定（對應 `blockedDetection: none`），不得當成失敗。
- `bat_wait` 多 `until: 'agent-started'`：`agentStarted !== false` 或分頁 `exited` 時返回。
- 只記每個 PTY 第一次 `SessionStart`；PTY 結束 / restart / Terminal Server recovery 清除；使用者輸入不清除。`SessionStart` 不代表第一個 prompt 已開始處理。

## 修改清單（建議，最終由 BMad-Guide 塔台 / 使用者決定）

1. `auto-session.md` 派工命令表：BAT 支援時加 `--wait-started <ms>`（建議 `30000`）；寫明上表四種結果的處理，尤其 **exit `8` 不重派**、`unknown` 不是失敗。
2. 派工成功判讀規則（§ BAT 派發成功判讀規則）：維持「exit code 為主」，`started:` 行只在帶參數時解析；`bat-scripts.log` 判讀不變。
3. 舊 BAT 降級：exit 1 + `Unknown option '--wait-started'` → 去掉參數重派一次，該 session 記為不支援，之後不再帶。
4. 「Worker 啟動檢查」（目前以 `started_at` 等 ≥ 3 分鐘判斷）：`started: <時間>` 可作為「Worker 已起來」的早期信號；`started_at` 仍是 ct-exec 開工的依據，兩者不衝突。
5. 版本對照表：加 BAT 版號（發佈後告知）。

## 驗收

- 文件：參數、四種結果、版本判定、降級規則各在權威位置一份。
- 實機（BAT 含 T0600 的版本）：
  1. 派一張 claude Worker 小單帶 `--wait-started 30000` → exit 0、`started: <時間>`。
  2. 改派 codex Worker → exit 0、`started: unknown`、stderr `wait-started: NO_SIGNAL`。
  3. 舊 BAT（或模擬）→ 去掉參數重派成功。
  4. 不帶參數 → 行為與舊版相同。

---

## 轉交紀錄

- 2026-10-18T03:41:41+0800：BAT 塔台建立（第七十六 session），待轉交 BMad-Guide 塔台。
- 2026-10-18T03:42:22+0800：BAT 塔台以跨 session 訊息轉交 BMad-Guide 塔台（`bmad-guide-94`，msg `9ea91794`）；BAT 版號待 `0.7.0-pre.6` 發佈後告知。
