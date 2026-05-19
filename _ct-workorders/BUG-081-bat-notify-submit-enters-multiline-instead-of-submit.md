---
schema_version: 1
schema_kind: bug
id: BUG-081
title: bat-notify --submit 遠端 Enter 被目標 agent 視為換行而非送出
status: CLOSED
closed_at: "2026-05-18T03:08:00+08:00"
verified_at: "2026-05-19T14:38:00+08:00"
verified_by: "使用者驗收通過（session 45 確認 Claude Worker bat-notify --submit regression smoke 硬條件滿足）"
severity: medium
reproducibility: observed
created_at: "2026-05-17T01:08:00+08:00"
updated_at: "2026-05-18T03:04:49+08:00"
workaround: 塔台終端收到預填文字後，人工按 Enter 送出；或 Worker 改用非 --submit 預填路徑後由人工確認。
impact:
  - bat-notify
  - yolo-closeout
  - control-tower
  - codex-agent
  - claude-agent
links:
  technical_report: _report-bug081-bat-notify-submit-keypress-boundary.md
  related_bugs:
    - BUG-080
  related_files:
    - scripts/bat-notify.mjs
    - electron/main.ts
    - electron/preload.ts
    - src/components/TerminalPanel.tsx
    - src/types/electron.d.ts
    - tests/bat-notify-submit.test.mjs
tags:
  - bat-notify
  - submit
  - xterm
  - pty
  - regression
---

# BUG-081 — `bat-notify --submit` 遠端 Enter 被視為換行而非送出

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-081 |
| 標題 | `bat-notify --submit` 預填塔台終端後，遠端 Enter 仍呈現換行而不是送出 |
| 狀態 | ✅ CLOSED（2026-05-18 修復；2026-05-19 使用者驗收通過） |
| 嚴重度 | 🟡 Medium（YOLO / Worker closeout 自動送出不可靠；有人工 Enter workaround） |
| 可重現 | 已觀察到（使用者回報：「仍然還是呈現換行而不是送出」）；需用 packaged BAT runtime 重新收斂成 always/intermittent |
| Workaround | 塔台終端收到預填文字後人工按 Enter；或暫時不用 `--submit` 自動送出 |
| 建立時間 | 2026-05-17 01:08 (UTC+8) |
| 報告者 | 使用者 |
| 觸發情境 | Worker 透過 `bat-notify.mjs --submit "T#### 完成"` 回報塔台 |
| 相關報告 | [BUG-081 技術報告](_report-bug081-bat-notify-submit-keypress-boundary.md) |
| 相關 BUG | BUG-080（Claude CLI / PTY command path hardening，已 CLOSED；本 BUG 是 submit/key event path，不是 shell quoting） |

## Symptoms

### 觸發步驟

1. Worker 在 BAT 環境呼叫：
   ```bash
   node "C:\\Program Files\\BetterAgentTerminal\\resources\\scripts\\bat-notify.mjs" --source "T####" --target "$BAT_TOWER_TERMINAL_ID" --submit "T#### 完成"
   ```
2. 塔台終端收到 `T#### 完成` 預填文字。
3. 預期 `--submit` 送出 Enter，使塔台立即接收該訊息。
4. 實際觀察：終端變成換行 / multiline input，而不是提交訊息。

### 預期行為

`--submit` 必須維持兩個語意邊界：

- `pty:write(target, message)`：只負責文字 payload，不能把 `\r` / `\n` 當 submit。
- `terminal:keypress` / `terminal:submit`：獨立 action，負責送出 Enter。

### 實際行為

目前 packaged runtime 觀察到 submit action 沒有等價於使用者實體鍵盤 Enter；結果仍被目標 agent 視為換行。

## Root Cause Hypothesis

初步調查指出舊路徑有兩個風險點：

1. `bat-notify.mjs` 曾在 `--submit` 且 message 以 `\r` / `\n` 結尾時跳過 `terminal:keypress`，讓文字 payload 和 submit action 混在一起。
2. Renderer `TerminalPanel` 收到 `terminal:keypress` 後直接呼叫 `terminal.input('\r', true)`，這會繞過 xterm 的 DOM `KeyboardEvent -> custom key handler -> evaluateKeyboardEvent -> onData` 正常鍵盤路徑。
3. 2026-05-17 後續追蹤指出此問題在 Codex CLI 0.130.0 更容易重現：Codex TUI 有 paste-burst 偵測，快速文字輸入後緊接 Enter 時，Enter 可能被視為 paste/multiline 的換行，而不是 submit。Claude 的 `string + \n` 行為不代表 Codex 會相同。

因此修正方向應是：

- 文字 payload 原樣保留，不 trim，不以 newline 暗示 submit。
- `--submit` 永遠額外送獨立 keypress action。
- Renderer 收到 remote Enter 後，盡量觸發與真實鍵盤 Enter 相同的 xterm DOM keydown 路徑。

## Current Patch Status

Codex 已在工作區做出後續 patch（尚未提交），目前靜態驗證通過：

- `npm run test:unit -- tests/bat-notify-submit.test.mjs src/utils/__tests__/terminal-keyboard-event.test.ts`
- `npm run compile`
- `git diff --check -- scripts/bat-notify.mjs tests/bat-notify-submit.test.mjs`

2026-05-17 15:49 (UTC+8) 後續 patch：

- `scripts/bat-notify.mjs` 在 `pty:write` 成功後、`terminal:keypress` 前固定等待 250ms。
- 新增 `submit-delay` log，記錄 `delayMs=250`。
- 新增測試確認 `pty:write` 與 `terminal:keypress` 之間至少有接近 250ms 的間隔。

此結果**不可直接作為 CLOSED 依據**，因為 bug 發生在 packaged BAT runtime + agent input semantics。必須補 runtime smoke。

## Runtime Smoke Evidence

### 2026-05-18 T0358 Claude tower keypress smoke

- 結論：PASS。
- 目標 terminal：`de780350-9ba3-4cfb-a47f-db3203083402`。
- 目標 process tree：`bash.exe -> bash.exe -> bash.exe -> claude.exe --dangerously-skip-permissions`，確認 keypress 目標為 Claude CLI tower。
- 實測命令：`node "C:\Program Files\BetterAgentTerminal\resources\scripts\bat-notify.mjs" --source T0358 --target $env:BAT_TOWER_TERMINAL_ID --submit "T0358 測試完成"`。
- `bat-scripts.log`：`terminal:notify` / `pty:write` / `submit-delay delayMs=250` / `terminal:keypress` 全部 result `ok`，trace `2a068ad59f727726`。
- renderer debug log：同 trace 出現 `remote Enter received`, `xterm onData ... controls=CR`, `remote Enter dispatched ... dataEvents=1 dataBytes=1 controls=CR`。

此 smoke 補上 Claude CLI 目標端的 runtime keypress 證據。BUG-081 是否 CLOSED 仍交由塔台依完整矩陣與發版狀態判定。

## Required Verification Before Close

- [ ] Packaged / installed BAT 更新後，Codex Worker 使用 `bat-notify --submit "T#### 完成"` 能自動送出，不停在 multiline。
- [ ] Packaged / installed BAT 更新後，Claude Worker 使用同一條 `bat-notify --submit "T#### 完成"` 能自動送出，不停在 multiline。
- [ ] 若 Codex PASS 但 Claude FAIL，BUG-081 不得 CLOSED；需拆出 Claude-specific follow-up 或退回 FIXING。
- [ ] `bat-scripts.log` 可用同一 `traceId` 串起 `bat-notify submit-action -> remote-server terminal:keypress -> renderer terminal-submit`。
- [ ] `bat-scripts.log` 可看到 `bat-notify submit-delay` 且 `delayMs=250`。
- [ ] `terminal-submit` renderer log 顯示 remote Enter 有產生 xterm data event，且控制字元為 `CR`，不是只產生 `LF` 或無 data event。

## Report

詳見 [_report-bug081-bat-notify-submit-keypress-boundary.md](_report-bug081-bat-notify-submit-keypress-boundary.md)。
