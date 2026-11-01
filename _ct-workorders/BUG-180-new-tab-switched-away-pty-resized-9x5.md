---
schema_version: 1
schema_kind: bug
id: BUG-180
title: "剛開的終端分頁在約 100 ms 內被切走時，PTY 被 resize 成 9x5，直到切回該分頁才恢復"
status: CLOSED
severity: low
reproducibility: always
created_at: "2026-11-01T17:40:18+0800"
updated_at: "2026-11-01T20:38:00+0800"
closed_reason: "verified: 使用者以安裝版 v0.7.2-pre.9 實機驗收（連開 Claude CLI ＋以塔台開啟 Claude，切回前分頁不以 9 欄繪製）"
fixed_in: "T0741 4500984d"
impact:
  - terminal-resize
links:
  discovered_in: "T0736 回報區〈發現的問題〉1（2026-11-01，pre.8 自動驗收 e2e）"
  related: [T0736, T0572, BUG-145]
---

# BUG-180 — 剛開的分頁被切走時 PTY 變成 9x5

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只在分頁剛開就被切走時；切回後恢復。agent TUI 在這段期間以 9 欄繪製） |
| 可重現 | 一定（T0736 e2e 每次都記到） |
| **狀態** | 🚫 CLOSED（2026-11-01 使用者以安裝版 `v0.7.2-pre.9` 實機驗收通過，塔台依 R-G003 結案）；原 🔧 FIXED（T0741 `4500984d`，待部署驗證） |
| 回報者 | T0736 Worker |

## 現象

- 預期：背景（未 active）分頁不 fit，PTY 維持 spawn 尺寸或最後一次的正常尺寸（CLAUDE.md「新 PTY 的初始尺寸（T0572 / BUG-145）」）。
- 實際：從「+」選單連續開分頁（例：Claude CLI → 以塔台開啟 Claude），前一個分頁的 PTY 變成 `cols=9 rows=5`，直到使用者切到它才回到正常尺寸；claude TUI 在這期間以 9 欄繪製（畫面每行約 10 字元的碎片）。
- debug log 順序（T0736 第 3 次執行）：`[resize] pty.resize cols=137 rows=35` → `TerminalPanel render … active=false` → `ResizeObserver #2 … active=false 0x0` → `[resize] initial doResize terminal=<id>` → `[resize] pty.resize cols=9 rows=5`；最終版 spec 每次都記到「Claude CLI: 9x5 before selecting it, 137x35 after」。

## 重現

1. 隔離實例（`e2e/fixtures/electron-isolation.ts`），任一工作區。
2. 連點「+」→ Claude CLI、「+」→ 以塔台開啟 Claude（兩次間隔 < 100 ms 的效果；e2e 操作即可）。
3. 看 debug log 第一個分頁的 `[resize]` 行，或以 `bat_get_state` / 分頁內程式讀 `process.stdout.columns`。

## 推測原因（T0736 Worker，未改）

`src/components/TerminalPanel.tsx:1029-1035`：掛載時若 active 就排 100 ms 後的 initial `doResize()`，計時到時沒有再檢查 `isActiveRef.current`；這 100 ms 內分頁已被隱藏，於是對 0x0 容器 fit，得到 xterm 的最小尺寸。

## 修正方向（待修正單評估）

- initial `doResize()` 到期時再檢查 active / 容器尺寸；容器 0x0 時不送 `pty.resize`（任何 resize 路徑都不應把 0x0 容器 fit 的結果送給 PTY）。
- 守住 T0572 的 `requestPtySizeSync` 行為與 `e2e/t0572-new-pty-initial-size.spec.ts`。

## 修正（T0741，2026-11-01，commit `4500984d`）

- **查證**：推測的兩段都成立，且找到 9x5 的確切來源。① initial `doResize()` 到期沒有再檢查 active；② 隱藏分頁在 `.terminal-wrapper.hidden`（`display: none`），FitAddon 以 `getComputedStyle` 取容器尺寸，沒有被繪製的元素回傳宣告值 `100%`，`parseInt` 得 100 px，扣掉 padding 與捲軸 ≈ 9x5。`fit()` 先把 xterm 自己縮成 9x5，再送給 PTY。
- **修正**：`canFitTerminalContainer`（`src/lib/terminal-fit-guard.ts`）—— 容器的 `getBoundingClientRect()` 寬或高 ≤ 0 時不 fit、不送 `pty:resize`、不動去重；由 TerminalPanel `doResize` 開頭與手動重繪呼叫。initial resize 計時器到期時再檢查 `isActiveRef`，unmount 時清除。
- **驗證**：單元 `src/lib/__tests__/terminal-fit-guard.test.ts`、`src/__tests__/terminal-pty-size-sync.test.tsx`（T0741 區塊 3 案，拿掉修正時失敗）；e2e `e2e/t0741-hidden-new-tab-pty-size.spec.ts`（未修正 build 三輪 `["137x35","9x5"]` 失敗、修正後通過）；`e2e/t0572-new-pty-initial-size.spec.ts`、`e2e/t0571-shift-right-click-copy.spec.ts`、`e2e/v072-pre8-workspace-waiting-real-agents.spec.ts` 綠（pre8 記到「137x35 before selecting it」）。
- **待驗收**：預覽版實機——連開 Claude CLI 與以塔台開啟 Claude，前一個分頁切回前 agent TUI 不以 9 欄繪製；驗收後改 CLOSED。
- 細節：[docs/agent-guide/new-pty-initial-size.md](../docs/agent-guide/new-pty-initial-size.md)
