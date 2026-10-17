---
schema_version: 1
schema_kind: workorder
id: T0581
title: "0.7.0-pre.1 實機驗收探針：Worker 完工後停在分頁內，跨 BAT 重開（Recovery 保留）再以原權杖回報"
type: verify
status: DONE
started_at: "2026-10-17T21:42:34+08:00"
updated_at: "2026-10-17T21:42:51+08:00"
completed_at: "2026-10-17T21:42:51+08:00"
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: XS
created_at: "2026-10-17T21:41:41+0800"
target_version: "0.7.0-pre.1（實機）"
depends_on: []
related:
  - "PLAN-047 A2（T0576 權杖跨 BAT 重開保留）、T0580（RECOVERY_PENDING）"
affects_files:
  - _ct-workorders/T0581-recovery-keep-worker-probe.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改任何產品程式碼、不跑 build / test；只改本工單檔。不 push。commit 用 `git commit --only _ct-workorders/T0581-recovery-keep-worker-probe.md`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不得把 `BAT_REMOTE_TOKEN` 的值寫進任何地方（回報、日誌、剪貼簿）；只記「是否為 `batcap.` 前綴」。"
  - "🔴 完工後**不要**關閉自己的分頁、不要結束 claude；停在原地等使用者（塔台會刻意不回收本分頁）。"
---

# T0581 — Worker 跨重開探針

## 背景

`v0.7.0-pre.1` 起本機分頁使用範圍權杖（`batcap.`），且權杖紀錄跨 BAT 重開保留（Terminal Server 存活、Recovery 選「保留」時）。BMad-Guide T0150 已驗一般流程；**跨重開**尚未在實機驗過。本單的 Worker 分頁就是驗收樣本：完工後停在分頁內，使用者退出 BAT（不停止 Terminal Server）→ 重開 → 保留，之後由使用者叫醒本分頁做第二階段。

## 階段 1（派工後立即執行）

1. frontmatter `status: IN_PROGRESS`、`started_at`（系統時間）。
2. 在回報區記錄（只記是 / 否或 id，不記權杖值）：
   - `BAT_TERMINAL_ID`、`BAT_TOWER_TERMINAL_ID`
   - `BAT_REMOTE_TOKEN` 是否 `batcap.` 前綴
   - `bat-notify.mjs` 對**綁定塔台**回報能否送達（照 ct-exec 正常收尾流程即可）
3. `status: DONE`、`completed_at`，commit 本工單檔，照 ct-exec 流程通知塔台。
4. 停在原地，不關分頁。

## 階段 2（使用者在本分頁輸入「T0581 階段 2」時才執行）

1. 再記一次 `BAT_TERMINAL_ID` / `BAT_TOWER_TERMINAL_ID` / 權杖前綴（應與階段 1 相同）。
2. 以本分頁 env 執行（PowerShell 寫法，`$n` = `BAT_HELPER_NODE` 或 `node`）：
   `& $n "$env:BAT_HELPER_DIR\bat-notify.mjs" --target "$env:BAT_TOWER_TERMINAL_ID" --source "T0581" "T0581 階段 2：重開後原權杖回報"`（不帶 `--submit`；參數名以 `bat-notify.mjs --help` 為準）
3. 記錄 exit code 與 stderr（不含權杖）。預期 exit 0；若 `Authentication failed: Invalid token` = A2 失敗。
4. 在回報區追加「階段 2」段落，commit 本工單檔。不要再改 status（維持 DONE）。

## 驗收

- 階段 1：權杖 `batcap.`、回報送達。
- 階段 2：重開後同一權杖 `bat-notify` exit 0。

## 回報區

### 階段 1（2026-10-17T21:42:51+08:00）

**落點檢查**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單檔在 REPO_ROOT 底下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 底下的本工單檔 → not applicable
- C-2：無 `branch` 欄位；目前 `main`
- 觀察到的 `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 工單原 `status: TODO`（非 `PENDING`），照開工處理

**環境**（Git Bash 可見 `BAT_*`，無 shell env visibility mismatch）：

| 項目 | 值 |
|---|---|
| `BAT_TERMINAL_ID` | `577d12f1444d4eaeb848126531bfdf96` |
| `BAT_TOWER_TERMINAL_ID` | `66447ea9-66e1-431a-8303-0f4ced7ec6a7` |
| `BAT_REMOTE_TOKEN` 是否 `batcap.` 前綴 | **是**（值未記錄） |
| `BAT_REMOTE_PORT` | `9876` |
| `BAT_HELPER_DIR` | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| `BAT_HELPER_NODE` | 未設定（本機，用 `node`） |
| `CT_MODE` / `CT_INTERACTIVE` | `yolo` / `0` |

**bat-notify 對綁定塔台回報**：照 ct-exec 收尾流程，於本工單 commit 之後執行 `bat-notify.mjs --source "T0581" --target "$BAT_TOWER_TERMINAL_ID" --submit "T0581 完成"`；結果見下方「階段 1 通知結果」（通知後另一個 commit 補記）。

**變更檔案**：只有本工單檔。未改產品程式碼、未跑 build / test、未 push。

**驗收（階段 1）**：權杖 `batcap.` → PASS；回報送達 → 見通知結果。

### 階段 1 通知結果（2026-10-17T21:43:01+08:00）

- 指令：`node "$BAT_HELPER_DIR/bat-notify.mjs" --source "T0581" --target "$BAT_TOWER_TERMINAL_ID" --submit "T0581 完成"`
- exit code：`0`
- stdout：`✓ Notified 66447ea9…: T0581 完成`
- stderr：（空）
- ⇒ 以 `batcap.` worker 權杖對綁定塔台回報 → **送達，PASS**

**後續**：本分頁停在原地不關閉，等使用者輸入「T0581 階段 2」。
