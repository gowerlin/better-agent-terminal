---
schema_version: 1
schema_kind: workorder
id: T0341
title: Fix BUG-075 症狀 B：bat-terminal.mjs 注入 MSYS_NO_PATHCONV=1
type: fix
status: FIXED
sizing: S
created_at: "2026-04-27T14:08:00+08:00"
started_at: "2026-04-27T14:22:00+08:00"
completed_at: "2026-04-27T14:24:00+08:00"
workdir: main repo
---
# T0341 — Fix BUG-075 症狀 B：bat-terminal.mjs 注入 MSYS_NO_PATHCONV=1

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0341 |
| 類型 | bugfix（Fix-B1） |
| 所屬 | BUG-075（症狀 B：MSYS slash-command path rewrite） |
| 狀態 | ✅ FIXED |
| 建立時間 | 2026-04-27 14:08 (UTC+8) |
| 開始時間 | 2026-04-27 14:22 (UTC+08:00) |
| 完成時間 | 2026-04-27 14:24 (UTC+08:00) |
| Sizing | S（estimate 15-30 min wall） |
| 依賴 | T0329 研究結論（H6 信心 0.90） |
| 後續 | T0342 (regression test) |
| 互動旗標 | `--mode ask --no-interactive` |
| 工作目錄 | main repo |
| `affects_files` | `scripts/bat-terminal.mjs`（注入 customEnv.MSYS_NO_PATHCONV='1'） |
| Release target | v0.4.2.1 hotfix |

## 背景

T0329 Phase B/D 證實：Git Bash 中啟動 codex 時，MSYS 會把 `/ct-exec T0328` 改寫為 `C:/Program Files/Git/ct-exec T0328`。`bat-terminal.mjs` 已修外層 argv 污染（`parsed.promptLength=14`），但未對新 Worker PTY 注入防護。

## 任務範圍

**修改 `scripts/bat-terminal.mjs`**：在 `--prompt` 路徑（即 invokePayload 經 `terminal:create-agent-command`）的 `customEnv` 中注入 `MSYS_NO_PATHCONV='1'`。

**範圍精準**：僅 Tower BAT auto-session Worker PTY 受影響，不改一般手動 Git Bash terminal 行為。

## 驗收條件

- ✅ `scripts/bat-terminal.mjs` --prompt 路徑 invokePayload 包含 `customEnv.MSYS_NO_PATHCONV='1'`
- ✅ 既有 unit / integration test 全綠（不破其他功能）
- ✅ 手動驗證：在 Git Bash 中跑一次 `node scripts/bat-terminal.mjs ... --prompt "/ct-exec T0001"`，確認 invoke argv 不再被改寫（log 比對）
- ✅ Commit message 引用 BUG-075 / T0341 / T0329 H6

## OOS（不在範圍內）

- 不修 prefix mismatch（`/ct-exec` vs `$ct-exec`）→ T0343 處理
- 不修症狀 A（shell preference）→ T0344 處理
- 不寫 regression test → T0342 處理

## 參考資料

- T0329 Phase D Fix-B1 提案
- BUG-075 metadata
- 既有外層 argv repair：`scripts/bat-terminal.mjs` 行首 MSYS workaround

---

## 回報區（Worker 填）

### 完成摘要
修復已完成，等待驗收。

- 在 `scripts/bat-terminal.mjs` 的 `--prompt` / `terminal:create-agent-command` payload 中注入 `customEnv.MSYS_NO_PATHCONV='1'`。
- 調整 `notifyId` env 注入為 merge，避免覆蓋 prompt payload 已建立的 `MSYS_NO_PATHCONV`。
- raw command 路徑維持 `customEnv:null`，未擴散到一般 `terminal:create-with-command`。

### 修改清單
- `scripts/bat-terminal.mjs`
- `_ct-workorders/T0341-fix-bug075-msys-no-pathconv-inject.md`
- commit: `c317832`

### 驗證紀錄
- `node --check scripts/bat-terminal.mjs` → pass
- `npm run test:unit` → 10 files / 187 tests passed
- Git Bash 手動驗證：
  - command: `node scripts/bat-terminal.mjs --workspace "$BAT_WORKSPACE_ID" --mode ask --no-interactive --agent default --prompt "/ct-exec T0001"`
  - before/entry log: `argv["--prompt"]` showed MSYS rewrite sample `C:/Program Files/Git/ct-exec T0001`
  - parsed log: `promptLength:14`, confirming existing outer argv repair restored `/ct-exec T0001`
  - invoke log: `channel:"terminal:create-agent-command"`, `customEnv:{"MSYS_NO_PATHCONV":"1","CT_MODE":"ask","CT_INTERACTIVE":"0"}`
- Raw command guardrail:
  - command: `node scripts/bat-terminal.mjs --workspace $env:BAT_WORKSPACE_ID echo T0341-raw-env-check`
  - invoke log: `channel:"terminal:create-with-command"`, `customEnv:null`

### OOS but justified（如有）
無。

---

**狀態**：✅ FIXED
