---
schema_version: 1
schema_kind: bug
id: BUG-208
title: "測試呼叫 helper `--version` / `--help` 時沒把 `BAT_USER_DATA` / `BAT_HELPER_LOG_DIR` 指到暫存目錄，寫進使用者真實的 `bat-scripts.log`"
status: CLOSED
severity: low
reproducibility: always（T0806 在 Windows `npm run test:unit` 與 WSL vitest 都實測到）
created_at: "2026-11-03T17:57:10+0800"
updated_at: "2026-11-03T20:27:17+0800"
closed_at: "2026-11-03T20:27:17+0800"
closed_reason: "verified: v0.7.4-pre.4 CI Test gate（run 41633956229）"
fixed_at: "2026-11-03T18:11:55+0800"
fixed_by: T0808
fix_commit: "e585c762"
impact:
  - tests
links:
  discovered_in: "T0806 回報區〈環境還原〉〈後續〉第 4 點"
  related: [T0806]
---
# BUG-208 — helper 測試寫進真實的 `bat-scripts.log`

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只多寫幾行 helper 名稱 / pid / argv，不含權杖；但違反 CLAUDE.md「helper 測試須設 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 到 temp」） |
| 可重現 | 每次跑完整 unit 測試 |
| **狀態** | 🚫 CLOSED（`v0.7.4-pre.4` CI Test gate 綠，run `41633956229`）。原：✅ FIXED（T0808 `e585c762`：共用 `helperLogEnv()`、4 處測試補暫存 log 目錄、source guard `scripts/__tests__/helper-test-log-dir.test.mjs`；修正後完整 unit 期間真實 log +0；待發版 CI Test gate 綠後 CLOSED） |
| 回報者 | 塔台（T0806 發現） |

## 現象

`scripts/__tests__/server-bundle-helpers.test.mjs` 等測試對 `bat-terminal.mjs` / `bat-notify.mjs` 執行 `--version` / `--help` 時，env 只去掉 `BAT_*`、`HOME` 是真的，helper 退回舊推測位置，寫進 Windows `%APPDATA%\BetterAgentTerminal\Logs\bat-scripts.log`（T0806 實測 10 行）與 Linux `~/.config/BetterAgentTerminal/Logs/bat-scripts.log`（10 行，T0806 已清掉自己寫的那幾行）。

## 修正方向

- 找出所有不帶暫存 `BAT_USER_DATA` / `BAT_HELPER_LOG_DIR` 呼叫 helper 的測試，補上；可加 source guard 或共用 helper env 函式。

## 狀態歷程

- 2026-11-03 17:57 開單（OPEN，T0806 發現）。
- 2026-11-03 17:59 → FIXING（T0808，D253）。
- 2026-11-03 18:12 → FIXED（T0808 `e585c762`）。
- 2026-11-03 20:27 → CLOSED（隨 `v0.7.4-pre.4` 發佈，CI Test gate 綠）。
