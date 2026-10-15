---
schema_version: 1
schema_kind: workorder
id: CT-T012
title: "【受派】CT 下一版：修正與 BAT 實作不一致的文件（`result=true`、notify 失敗時的工單狀態、Codex 派工範例）"
type: implementation
status: PENDING
repo: BMad-Guide
project: PLAN-042
priority: P3
sizing: S
created_at: "2026-10-15T16:13:05+0800"
updated_at: "2026-10-15T16:13:05+0800"
depends_on: []
related:
  - PLAN-042
  - T0534（研究回報 §8-1、§8-2、§8-3）
  - CT-T011（同一個 CT 版本一起發）
interaction:
  mode_hint: ask
  interactive: true
  intervention_type: delegate
renew_count: 0
---

# CT-T012 — CT 文件與 BAT 實作的落差

## 跨專案協調

- **協調類型**：DELEGATE
- **來源專案**：better-agent-terminal（PLAN-042）
- **目標專案**：BMad-Control-Tower（`D:\ForgejoGit\@Gower_Labs\BMad-Guide\BMad-Control-Tower\`，現行 v5.0.9；由 **BMad-Guide 塔台**派發執行，本檔為需求規格）
- **建議**：與 CT-T011 同一版發佈

## 修改清單（行號以 v5.0.9 為準，執行時先核對）

1. **`result=true` 漂移**：`control-tower/SKILL.md`（`Trust BAT dispatch success from process exit code 0 or bat-scripts.log terminal-created result=true`）與 `references/auto-session.md` §「成功判定」（約 :881–896，T0534 指出 :894 把 `null` stdout 描述為舊行為）寫的成功日誌是 `result=true`，BAT 實際寫的是 `"result":"ok"`（`scripts/bat-terminal.mjs` `terminal-created` 事件）。改為 `result: "ok"`，並保留「以 exit code 為準」的主規則；同步檢查 `:894` 的舊行為描述是否仍正確。
2. **notify 失敗時的工單狀態**：`references/yolo-mode.md` 約 :444–447 寫「notify 失敗時工單停在 `IN_PROGRESS`」，但 `ct-exec/SKILL.md` 的收尾流程是**先寫最終狀態、再 notify**。以 ct-exec 的實際順序為準修正 yolo-mode 的描述（notify 失敗時工單已是最終狀態，只是塔台沒收到通知；塔台的補救方式照現有手動 fallback）。
3. **Codex 派工範例**：`docs/BMad Control Tower 安裝(升級)與使用指南 v5.md` 中提供給 `~/.codex/AGENTS.md` 的派工範例（使用者本機 `C:/Users/Gower/.codex/AGENTS.md:23-32` 為其複本）：
   - 補 `--cwd "<專案根目錄>"` 與 `--interactive` / `--no-interactive`（與 `auto-session.md` 派工指令一致）
   - 優先用 `"$BAT_HELPER_DIR/bat-terminal.mjs"`，安裝路徑為 fallback
   - 「需 BAT 環境變數完備」清單移除 `BAT_TOWER_TERMINAL_ID`（塔台不需要、也不得被要求具備，見 `auto-session.md` :746；它是 Worker notify 專用）
   - 安裝新版時一併更新使用者本機 `~/.codex/AGENTS.md` 的同一段（先給使用者看差異再改）

## 驗收條件

- [ ] 三處修正後，與 BAT 現行實作（`bat-terminal.mjs` 日誌欄位、ct-exec 收尾順序、auto-session 派工指令）逐項一致
- [ ] Claude（`~/.claude/skills/`）與 Codex（`~/.codex/skills/`）兩端與新版目錄 IDENTICAL；`docs/CHANGELOG.md` 記錄
- [ ] 使用者本機 `~/.codex/AGENTS.md` 已更新（或使用者明確選擇不改）

## 回報區

（BMad-Guide 塔台 / Worker 填寫）
