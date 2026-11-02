---
schema_version: 1
schema_kind: bug
id: BUG-196
title: "Worker 通知（`bat-notify --submit`、`--ask --submit`）的 Enter 替使用者回答塔台的權限對話框 / AskUserQuestion"
status: FIXED
severity: high
reproducibility: always
created_at: "2026-11-02T18:20:48+0800"
updated_at: "2026-11-02T19:20:41+0800"
impact:
  - security
  - tower-worker
links:
  discovered_in: "T0787（PLAN-059 Q1 研究單，`40767172`）"
  related: [PLAN-059, T0787, T0769, T0716, T0566, T0535, T0590]
---
# BUG-196 — Worker 通知替使用者回答塔台的對話框

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（權限對話框被自動核准，需要核准的工具在使用者沒有同意的情況下執行；事後畫面分不出是不是使用者按的） |
| 可重現 | 必現：T0787 隔離實例＋假模型，30 / 30（3 輪 × 10 情境；塔台分頁在背景或前景都一樣） |
| **狀態** | ✅ FIXED（T0788，`94ad2b83` / `610f592b`；待驗收） |
| 回報者 | 塔台（T0787 研究單實測，PLAN-059 R1） |

## 現象

- 預期：塔台（claude-cli 分頁）停在權限對話框或 AskUserQuestion 時，Worker 送來的通知不得替使用者作答。
- 實際：
  - 權限對話框 + `bat-notify --submit "T#### 完成"` → 文字被對話框吞掉，Enter 選中預設「1. Yes」，指令執行（假模型收到 `tool_result` = 指令的結果）。
  - AskUserQuestion + `--submit` → Enter 選中第一個選項（假模型收到答案 = 第一個選項）。
  - CT 批次提問最後一題用的 `--ask --submit` → 同上，兩種對話框都會被作答。
  - 只預填（不帶 `--submit`）→ 不會作答，但通知文字被對話框吞掉、遺失。
  - `--ask --no-pty-write` → 不寫 PTY，正常（T0716）。
- 附帶發現：Worker 的 submit Enter 被主行程記成塔台的「使用者輸入」（`[blocked] → cleared (user input)`）：清掉 ⚠️、更新 `lastUserInputAt`。依程式路徑推論也會取消塔台的 `--close-worker` 待執行與用量限制等待（T0535 / T0566）；**未實測**，修正單必查。
- codex 塔台的審批提示：**未測**（推測相同），修正單驗收時補測。

## 最小重現步驟

1. BAT 開一個 Claude CLI 分頁當塔台（不要 bypass / auto 模式），讓它停在任何一個權限對話框（例如請它跑一個 Bash 指令）。
2. 從這個塔台派一個 Worker（或任何帶 `BAT_TOWER_TERMINAL_ID` 的分頁）。
3. 在 Worker 分頁執行 `"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --source T0001 --target "$BAT_TOWER_TERMINAL_ID" --submit "T0001 完成"`。
4. 結果：塔台的對話框選了「1. Yes」，指令執行；主行程日誌 `[blocked] → cleared (user input)`。

自動重現：`T0787_PROBE=1 npx playwright test e2e/t0787-notify-into-blocked-tower.spec.ts`（先 `npx vite build`；Windows）。

## 根因（T0787 查證）

- `pty:write`（`electron/handlers/pty.ts:104`）與 `terminal:keypress` 不看目標分頁是否 blocked。
- submit 的 Enter 由塔台分頁的 xterm 產生（`dispatchEnter` → xterm `onData` → renderer `pty.write`，不帶 `{ auto: true }`），主行程記成本機使用者輸入。

## 修正方向

T0787 回報區〈建議方向 ②〉的契約草案 v0：主行程在塔台 hook / osc `blocked` 時把「預填文字＋Enter」整組保留，離開 blocked 並安靜 1 s 後依序送出；不帶新參數時 helper exit code / stdout 不變；保留上限、逾時、提示待送與取消（沿用 T0769）；submit Enter 不算使用者輸入。標 🟥 的項目要 CT 塔台確認。

## 處理紀錄

- 2026-11-02 18:20 開單（OPEN，high），T0787 收單時登記。
- 2026-11-02 18:24 → FIXING：開修正單 T0788（D227）；契約第 5 / 9 / 10 點用 T0787 建議值，同時送 CT 塔台確認（`_handover-2026-11-02-bat-notify-hold-contract.md`）。
- 2026-11-02 19:02 → FIXED（T0788，commit `94ad2b83`）：主行程在塔台 hook / osc `blocked`（`permission` / `question` / `elicitation` / codex `input`）時保留 helper 的文字＋Enter，答完、安靜 1 s 後依序送出（`electron/notify-hold.ts`，本機與 headless 共用）；bat-notify exit code / stdout 不變；縮圖「📨 待送 N」可逐筆 / 全部取消；helper 的 submit Enter 改 `{ auto: true }`（不算使用者輸入）。驗證：`e2e/t0787-notify-into-blocked-tower.spec.ts` 改斷言版 2 passed（claude 10 情境 × 2 輪 20 / 20 對話框維持、模型沒收到答案、使用者答完後收到通知；「待送 N」與取消；codex 0.166.0 審批提示保留 → `y` 核准 → 模型收到通知），單元 `electron/__tests__/notify-hold.test.ts` 33 項＋突變檢查。
  - 附帶發現的更正：`--close-worker` 的取消條件是被關閉的 Worker 分頁自己的使用者輸入（`close-worker.ts` `fire`），塔台分頁的 submit Enter 本來就不影響它（原推論不成立）；實際受影響的是塔台分頁自己的 ⚠️ 與用量限制等待，已由 `{ auto: true }` 修正（單元測試＋e2e ③ 驗證不再出現 `cleared (user input)`）。
  - 已知限制：`blockedDetection: none` 的分頁照舊直接送出；遠端 profile 視窗看不到「待送 N」（保留照樣生效）。見 `docs/agent-guide/notify-hold.md`。
  - 2026-11-02 19:20 Renew #1（D228）`610f592b`：拿掉逾時（只在送出 / 取消 / PTY 結束 / recovery 離開佇列）；守門測試 `--ask --submit` 遇 `held-full` 先 `question:cancel` 再 exit 1（stderr `ask: NOTIFY_STEP pty-write`）；配對的 Enter 不佔名額。
  - 新發現（另案）：e2e 60 次裡 1 次，claude 的 hook 回報亂序（`permission-request` 先、`user-prompt-submit` 後）把 `blocked` 清掉而對話框仍在，那次通知不會被保留。屬 `TerminalBlockedTracker` 既有競態（本單不改判斷規則），建議塔台另開 BUG。
  - 待驗收：實機（使用者的 BAT）塔台停在權限對話框時收到 Worker 完成通知 → 對話框不被作答，答完後通知送進輸入框。
