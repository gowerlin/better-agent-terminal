---
schema_version: 1
schema_kind: report
id: BUG-081-report
title: BUG-081 bat-notify submit/key boundary technical report
created_at: "2026-05-17T01:08:00+08:00"
updated_at: "2026-05-18T03:04:49+08:00"
related_bug: BUG-081
status: DRAFT
---

# BUG-081 Technical Report — `bat-notify --submit` key boundary

## Executive Summary

使用者回報 `bat-notify --submit` 仍然只造成換行，沒有送出塔台終端訊息。此問題不應用 `\n` 或 `\r` 再做 workaround；工程邊界應固定為：

- **文字資料**：`pty:write(target, message)`，payload 原樣送入 PTY。
- **送出動作**：`terminal:keypress` / future `terminal:submit`，獨立 action，代表 Enter。

目前 Codex draft patch 已讓 helper script、main/preload、renderer trace 串接起來，並把 renderer remote Enter 從 `terminal.input('\r')` 改為 DOM `KeyboardEvent('keydown', Enter)` path。但此 bug 的風險點在 agent runtime 行為，關閉前必須同時 smoke Codex 與 Claude。

2026-05-17 後續追蹤確認此問題對 Codex CLI 更敏感：Codex 0.130.0 TUI source 有 paste-burst 偵測，快速文字 payload 後緊接 Enter 時，Enter 可能被納入 multiline paste/newline suppression，而不是 submit。因此本輪 patch 在 `pty:write` 成功後、`terminal:keypress` 前加入 250ms delay。

## Problem Statement

### Observed Symptom

`bat-notify --submit "T#### 完成"` 在塔台終端中預填了文字，但 Enter 沒有提交；畫面呈現換行 / multiline input。

### Why This Matters

Control Tower YOLO / Worker closeout 依賴 `bat-notify --submit` 自動送出完成訊息。若 submit 不可靠：

- Worker closeout 會停在塔台輸入框，需人工補 Enter。
- YOLO 自動流程可能誤以為通知已完成。
- Codex 與 Claude agent 對 Enter/multiline 的語意可能不同，單一 agent 通過不能代表全體通過。

## Current Data Flow

```text
bat-notify.mjs
  -> RemoteServer invoke terminal:notify
  -> RemoteServer invoke pty:write(target, message)
  -> RemoteServer invoke terminal:keypress({ key: "Enter", traceId })
  -> electron/main.ts broadcasts terminal:keypress to renderer windows
  -> electron/preload.ts exposes pty.onTerminalKeypress()
  -> TerminalPanel handles remote Enter
  -> xterm emits onData()
  -> pty.write(terminalId, data)
```

## Suspected Root Cause

舊路徑曾把「Enter 動作」降階成 PTY 字元：

```ts
terminal.input('\r', true)
```

這雖然會讓 xterm 觸發 data event，但不是完整的 DOM keyboard event path。對 terminal-driven agents 而言，`CR` byte、`LF` byte、DOM Enter、以及應用層送出事件可能不是同一件事。

另外 `bat-notify.mjs` 舊邏輯曾用 message 是否以 newline 結尾來決定是否跳過 submit，這會讓 payload 內容影響 submit action，違反邊界。

### Codex-Specific Follow-up

Codex CLI 0.130.0 的 TUI 有 non-bracketed paste-burst path：在 Windows 等環境中，快速文字輸入會先被當成 paste-like burst；burst 狀態與短暫 Enter suppression window 期間，Enter 會被視為 paste 內容中的 newline。BAT `bat-notify --submit` 原本在 `pty:write` 後立即送 `terminal:keypress`，在實測 log 中兩者間隔只有數毫秒，足以落入 Codex 的 suppress window。

本輪選擇 250ms 作為折衷：對人類操作幾乎無感，但足以越過 Codex paste-burst 的短暫 idle/suppression window。

## Draft Fix Summary

目前工作區 draft patch 採用以下方向：

1. `scripts/bat-notify.mjs`
   - message 不再 `.trim()`，只用 `\S` 檢查是否有實質內容。
   - payload 中的 `\r` / `\n` 保留為文字。
   - `--submit` 永遠送 `terminal:keypress`，不因 payload 結尾 newline 被跳過。
   - 新增 `submit-boundary` / `submit-action` log，記錄 payload 是否含 line break、submit channel、trace id。
   - 2026-05-17 follow-up：`pty:write` 成功後等待 250ms，再送 `terminal:keypress`；新增 `submit-delay` log。

2. `electron/main.ts` / `electron/preload.ts` / `src/types/electron.d.ts`
   - `terminal:keypress` payload 加 `traceId`。
   - main process log 與 `bat-scripts.log` mirror 記錄 `delivery: renderer-dom-keydown`。

3. `src/components/TerminalPanel.tsx`
   - remote Enter 不再直接 `terminal.input('\r', true)`。
   - 改成 focus xterm helper textarea，dispatch synthetic `KeyboardEvent('keydown', Enter)`。
   - 透過 `[terminal-submit]` debug log 記錄 Enter received / dispatched / xterm onData controls。

4. `src/utils/terminal-keyboard-event.ts`
   - 集中建立 Enter keydown event，補 legacy `keyCode` / `which` / `charCode`，便於測試與後續調整。

## Verification Completed So Far

Codex 靜態驗證已通過：

```powershell
npm run test:unit -- tests/bat-notify-submit.test.mjs src/utils/__tests__/terminal-keyboard-event.test.ts
npm run compile
git diff --check -- . ":(exclude)AGENTS.md"
```

新增/調整測試涵蓋：

- `bat-notify --submit` 正常 payload 會依序呼叫 `terminal:notify`, `pty:write`, `terminal:keypress`。
- payload 以 LF 結尾時，仍會保留 LF 並額外送 `terminal:keypress`。
- `pty:write` 與 `terminal:keypress` 之間至少有接近 250ms 的延遲，避免 Codex paste-burst suppression。
- synthetic Enter 是 cancelable DOM keydown event，帶 `key=Enter`, `code=Enter`, `keyCode=13`, `which=13`。

### Runtime smoke: T0358 Claude tower target

2026-05-18 03:01 (UTC+8) 以安裝版 BAT helper 實測：

```powershell
node "C:\Program Files\BetterAgentTerminal\resources\scripts\bat-notify.mjs" --source T0358 --target $env:BAT_TOWER_TERMINAL_ID --submit "T0358 測試完成"
```

結果：PASS。

- 目標 terminal `de780350-9ba3-4cfb-a47f-db3203083402` 的 process tree 為 `bash.exe -> bash.exe -> bash.exe -> claude.exe --dangerously-skip-permissions`。
- `bat-scripts.log` trace `2a068ad59f727726` 顯示 `terminal:notify`、`pty:write`、`submit-delay delayMs=250`、`terminal:keypress` 均成功。
- renderer debug log 同 trace 顯示 `remote Enter received`、`xterm onData ... controls=CR`、`remote Enter dispatched ... dataEvents=1 dataBytes=1 controls=CR`。

## Verification Still Required

此 BUG 不得只用 Codex unit/build 結果關閉。關閉前需要 runtime smoke matrix：

| Agent | Scenario | Expected |
|-------|----------|----------|
| Codex Worker | `bat-notify --submit "T#### 完成"` | 塔台收到並送出訊息，不停在 multiline |
| Claude Worker | `bat-notify --submit "T#### 完成"` | 塔台收到並送出訊息，不停在 multiline |
| Codex Worker | payload 尾端含 LF | LF 保留為 payload；submit action 仍獨立送出 |
| Claude Worker | payload 尾端含 LF | LF 保留為 payload；submit action 仍獨立送出 |

### Required Logs

從 `%APPDATA%\BetterAgentTerminal\Logs\bat-scripts.log` 找同一個 `traceId`：

1. `script=bat-notify event=submit-action`
2. `script=bat-notify event=submit-delay delayMs=250`
3. `script=remote-server event=ipc-invoke channel=terminal:keypress`
4. `script=remote-server event=ipc-result channel=terminal:keypress`

Renderer debug log 需有：

1. `[terminal-submit] remote Enter received ... trace=<traceId>`
2. `[terminal-submit] remote Enter dispatched ...`
3. `[terminal-submit] xterm onData ... controls=CR`

若缺少第 3 點或 controls 不是 `CR`，代表 renderer/xterm path 仍需再修。

## Close Criteria

- Codex runtime smoke PASS。
- Claude runtime smoke PASS。
- `bat-scripts.log` traceId 串接完整。
- `bat-notify submit-delay` 顯示 `delayMs=250`。
- Renderer debug log 證明 Enter 走 xterm keyboard path 並產生 submit data。
- 若有任何一項失敗，BUG-081 保持 OPEN/FIXING，不得 CLOSED。

## Notes

- BUG-080 是 shell command quoting hardening；BUG-081 是 terminal input semantics，不應合併關閉。
- 若 DOM keydown path 在 packaged Electron 中仍無法觸發 xterm data，下一步應評估專用 `terminal:submit` renderer handler，直接呼叫 agent input box submit handler，而不是 PTY 字元。
