---
schema_version: 1
schema_kind: workorder
id: CT-T012
title: "【受派】CT 下一版：修正與 BAT 實作不一致的文件（`result=true`、notify 失敗時的工單狀態、Codex 派工範例）"
type: implementation
status: DONE
repo: BMad-Guide
project: PLAN-042
priority: P3
sizing: S
created_at: "2026-10-15T16:13:05+0800"
updated_at: "2026-10-16T02:18:03+0800"
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
completed_at: "2026-10-16T02:18:03+0800"
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
3. **Codex 派工範例**：`docs/BMad Control Tower 安裝(升級)與使用指南 v5.md` 中提供給 `~/.codex/AGENTS.md` 的派工範例（使用者本機 `<使用者資料夾>/.codex/AGENTS.md:23-32` 為其複本）：
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

**BMad-Guide 塔台回報（2026-10-15 17:14 UTC+8）**

- **結果**：source／install ✅ **DONE**；runtime ⏳ **待 BAT 含 `--close-worker` 的版本**
- **CT 新版號**：**v5.1.0**（MINOR：新增設定選項；與 CT-T011／CT-T012 同版發佈）
- **commit**：BMad-Guide repo `cb2aa09`（branch `dev-main`，**未 push**）
- **執行工單**：BMad-Guide `T0134`（決策 D015）；runtime 驗收另開 `T0136`（BLOCKED）
- **安裝**：`~/.claude/skills/`、`~/.codex/skills/` 兩端 8 skill 與 `BMad-Control-Tower/BMad-Control-Tower-v5.1.0/skills/` 逐檔一致（16/16，BMad-Guide 塔台獨立複驗）；
  回退備份 `~/{.claude,.codex}/skill-backups/_backup-ct-v5.0.9-20261015-165743/`；下一個 session 生效
- **本 repo（better-agent-terminal）**：BMad-Guide 端只讀，未做任何 commit（僅填寫本回報區）

**三處修正**

1. **`result=true` 漂移** ✅：`control-tower/SKILL.md:115`、`auto-session.md` § BAT 派發成功判讀規則改為 `bat-scripts.log` 的 helper 端 `"result":"ok"`（依 `scripts/bat-terminal.mjs` `logEvent(... { result: 'ok', terminalId, ... })`，NDJSON），主規則仍為 exit code `0`。
   附帶發現：`result=true` 字面**確實存在**，在 BAT app 端 `electron/terminal-command-handlers.ts:514`（主行程 `debug-*.log`）與 `:515-519` 鏡像到 `bat-scripts.log` 的 `"script":"remote-server"` 布林值——CT 已加註說明，避免日後誤改回去。
   另更正：「`Terminal created: null` 自 BAT v0.3.x 起已修」不正確，修正 commit `abdd1cf1`（BUG-020／T0110）最早包含於 **`v0.5.1`**（`merge-base --is-ancestor` 驗證），已改。
2. **notify 失敗時的工單狀態** ✅：`yolo-mode.md` § 失敗硬鉤子語意對齊改為「notify 失敗時工單已是最終狀態、回報區完整，只是塔台沒收到通知」，與 `ct-exec`（Phase 4 最後寫最終狀態，§ BAT Notify 在其後）、`ct-done`（第 7 步 metadata、第 8 步 notify）一致。原文引用的 `ct-exec` Step 8.5／`ct-done` Step 6.5 已不存在（v5.0.3 起），一併移除。
3. **Codex 派工範例** ✅（**前提更正**）：規格所指「安裝指南提供給 `~/.codex/AGENTS.md` 的派工範例」在 BMad-Guide repo（含所有舊版、`docs/`、`spec/`）**不存在**；使用者本機那段無 CT 出處。
   因此改為在安裝指南 § 4.2 **新增**「Codex 端 `~/.codex/AGENTS.md` 塔台派工段落（範例）」：含 `--cwd`、`--interactive`／`--no-interactive` 二選一、`$BAT_HELPER_DIR` 優先＋安裝路徑 fallback、必要環境變數 5 個（移除 `BAT_TOWER_TERMINAL_ID`），與 `auto-session.md` Bash 白名單逐字一致，並註明權威在 `auto-session.md`。
   **使用者本機 `~/.codex/AGENTS.md` 已更新**（先給使用者看差異、經同意後套用；備份 `~/.codex/AGENTS.md.bak-20261015-171244`）。

**驗收條件對照**

| 驗收條件 | 結果 |
|---|---|
| 三處修正後與 BAT 現行實作逐項一致 | ✅（`skills/` 內 `result=true` 0 筆；BMad-Guide 塔台以實際 `bat-scripts.log` 複驗 `"result":"ok"`） |
| Claude／Codex 兩端與新版目錄 IDENTICAL；`docs/CHANGELOG.md` 記錄 | ✅ 16/16；`[5.1.0]` 段 |
| 使用者本機 `~/.codex/AGENTS.md` 已更新 | ✅ |

順帶修正：`ct-exec/SKILL.md` § BAT Notify And Fallback 補明 `CT_MODE=ask`／`off` 不加 `--submit`、顯示手動回報訊息（原只寫 `on`／`yolo`）。

---

## 塔台收單（better-agent-terminal 第六十六 session，2026-10-16T02:18:03+0800）

- 狀態 PENDING → **DONE**：三項文件修正皆已隨 CT v5.1.0 安裝（上方回報）。本機抽驗：已安裝 `control-tower/SKILL.md` 寫的是 `"result":"ok"` 與「exit code 為主規則」，與 BAT `scripts/bat-terminal.mjs` 一致。
- 本單只改文件，無 runtime 項目；「待 BAT 含 `--close-worker` 的版本」屬 CT-T011 的範圍，已於 pre.4 驗過（T0549）。
