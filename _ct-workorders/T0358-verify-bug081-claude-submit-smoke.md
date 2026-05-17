---
schema_version: 1
schema_kind: workorder
id: T0358
title: "BUG-081 regression smoke: bat-notify --submit → Claude tower keypress"
status: DONE
type: BUG_VERIFY
severity: high
priority: P1
created_at: 2026-05-18T00:00:00+08:00
started_at: "2026-05-18T03:00:08+08:00"
completed_at: "2026-05-18T03:04:49+08:00"
updated_at: "2026-05-18T03:04:49+08:00"
commit: pending
verified_by: "installed BAT runtime smoke; Claude tower trace 2a068ad59f727726 produced xterm controls=CR"
workdir: main repo
plan_id: null
depends_on: []
affects_files:
  - scripts/bat-notify.mjs
  - tests/bat-notify-submit.test.mjs
  - electron/remote/server.ts
memory_overrides: {}
memory:
  gotcha: bat-notify --submit Enter keypress is ignored by Claude CLI when target is a Claude worker
  gotcha_resolution: Use terminal:keypress keypress path instead of raw \\r; add delay before keypress
---

## 背景

BUG-081: `bat-notify --submit` 的 Enter keypress 在目標為 Claude CLI worker 時被視為換行而非送出。

**根因（_report-bug081）**：Claude CLI 的 xterm layer 收到 PTY 換行時，會插入 multiline input 而非執行 command。需要透過 renderer/xterm 的 `terminal:keypress` keypress API 來合成 Enter 鍵。

**現有修復**：
1. `scripts/bat-notify.mjs` 新增 `terminal:keypress` channel（Step 3）
2. `tests/bat-notify-submit.test.mjs` 三個 test 涵蓋 submit 流程
3. `SUBMIT_KEYPRESS_DELAY_MS` 預設 250ms（等待 paste burst 沉降）

## 任務

在**本 session 內**驗證 bat-notify.mjs 能否正確通知 Claude 塔台（`--submit` 模式）。

### 步驟

1. **啟動塔台**：在一個 BAT terminal 中啟動 Control Tower（若已有則跳過）
2. **啟動 Worker**：在另一個 BAT terminal 中啟動 Claude worker（可用 `claude` 或任意 agent）
3. **執行 bat-notify**：在 Worker terminal 中執行：
   ```bash
   node scripts/bat-notify.mjs --submit "T0358 測試完成"
   ```
   並確認塔台收到 toast 預填文字 + Enter keypress 觸發
4. **觀察結果**：
   - [x] 塔台 toast 顯示 "T0358 測試完成"
   - [x] 塔台 PTY 預填 "T0358 測試完成"（無 \r 插入）
   - [x] Enter keypress 觸發成功（塔台執行 command 或顯示 prompt）

### 回報格式

完成后回報 "T0358 完成" 或 "T0358 部分完成"（附失敗原因）。

## 塔台驗收

（由塔台填寫）

---

（以下為 Worker 回報區）

## Worker 回報

### 完成狀態

DONE

### 產出摘要

- 以已安裝版 `C:\Program Files\BetterAgentTerminal\resources\scripts\bat-notify.mjs` 執行本工單指定的 `--submit` runtime smoke。
- 實測目標 tower terminal：`de780350-9ba3-4cfb-a47f-db3203083402`。
- 目標 terminal process tree：`bash.exe -> bash.exe -> bash.exe -> claude.exe --dangerously-skip-permissions`，確認本次 keypress 目標為 Claude CLI tower。
- 實測命令：
  ```powershell
  node "C:\Program Files\BetterAgentTerminal\resources\scripts\bat-notify.mjs" --source T0358 --target $env:BAT_TOWER_TERMINAL_ID --submit "T0358 測試完成"
  ```
- helper 回傳：`✓ Notified de780350…: T0358 測試完成`；`pty:write` result `ok` / reason `queued`。

### 驗證結果

- PASS：toast/notify path 送達 renderer。
  - `2026-05-17T19:01:27.943Z` debug log：`terminal:notify target=de780350... source=T0358`
  - `2026-05-17T19:01:27.944Z` renderer log：`Notified target=de780350 source=T0358 msg="T0358 測試完成"`
- PASS：PTY 預填 payload 未混入 `\r` / `\n`。
  - `bat-scripts.log`：`payloadHasLineBreak=false`, `payloadEndsWithLineBreak=false`, `textChannel="pty:write"`, `submitChannel="terminal:keypress"`
- PASS：250ms submit delay 生效。
  - `bat-scripts.log`：`submit-delay delayMs=250`
- PASS：Enter 走 `terminal:keypress` → renderer DOM keydown → xterm `onData`。
  - `traceId=2a068ad59f727726`
  - `2026-05-17T19:01:28.214Z` debug log：`terminal:keypress key=Enter trace=2a068ad59f727726`
  - `2026-05-17T19:01:28.217Z` renderer log：`remote Enter received ... path=dom-keydown`
  - `2026-05-17T19:01:28.217Z` renderer log：`xterm onData ... bytes=1 controls=CR`
  - `2026-05-17T19:01:28.218Z` renderer log：`remote Enter dispatched ... dataEvents=1 dataBytes=1 controls=CR`

### 驗證命令

- `node "C:\Program Files\BetterAgentTerminal\resources\scripts\bat-notify.mjs" --source T0358 --target $env:BAT_TOWER_TERMINAL_ID --submit "T0358 測試完成"`：PASS
- `Select-String` against `C:\Users\Gower\AppData\Roaming\BetterAgentTerminal\Logs\bat-scripts.log` for `T0358 測試完成` / `2a068ad59f727726`：PASS
- `Select-String` against `C:\Users\Gower\AppData\Roaming\better-agent-terminal\Logs\debug-20260518-003326.log` for `terminal-submit` / `2a068ad59f727726`：PASS

### 遭遇問題

- 初始環境探針使用 `Get-ChildItem Env:...` 未完整列出多個 env key，曾誤判 `CT_MODE` 缺失；後續以 `[Environment]::GetEnvironmentVariable()` 重新確認 `CT_MODE=yolo`、remote port/token/tower id/terminal id/workspace id 皆存在。
- `bat-scripts.log` 位於大小寫 `BetterAgentTerminal` userData；renderer debug log 位於 `better-agent-terminal` userData。完整 renderer `terminal-submit` evidence 在後者。

### 互動紀錄

無。

### Renew 歷程

無。

### sprint-status.yaml

不適用。根目錄檔案存在，但內容為舊里程碑摘要，未涵蓋 T0358 / BUG-081，未修改。

### 回報時間

2026-05-18T03:04:49+08:00

### commit

pending

---

**塔台規則**：此工單為 BUG-081 關閉前硬條件之一。驗證通過後才可考慮關閉 BUG-081。
