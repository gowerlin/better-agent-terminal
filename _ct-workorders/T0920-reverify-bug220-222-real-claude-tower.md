---
schema_version: 1
schema_kind: workorder
id: T0920
title: "補驗 BUG-220／221／222：用新測試版（`0.0.0-exp.21`，`v0.8.x` `6d7b4cd3`）與真 claude 塔台重跑 M-C1-2、M-C2-b、M-C5 排隊權限詢問"
type: verification
status: TODO
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T13:02:50+08:00"
updated_at: "2026-11-25T13:02:50+08:00"
target_version: "0.8.0-pre.3（與 CT 6.1.0 同日發佈）"
depends_on: [T0915, T0919]
related:
  - "PLAN-068；D337；BUG-220（T0916）／BUG-221（T0917）／BUG-222（T0918）；T0915 驅動（`e2e/manual/ct610-driver.ts` 等，已在 `v0.8.x`）與回報區；CT D878（CT 端判定已完成；本單不改 `--set-role` 輸出與契約欄位，CT 不必重判）"
affects_files:
  - _ct-workorders/T0920-reverify-bug220-222-real-claude-tower.md
  - e2e/manual/
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0920（塔台已預先從 `v0.8.x` `6d7b4cd3` 建立分支 `ct/T0920`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0920` 寫檔；開工確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `6d7b4cd3ec4b301424f1a5866321cf71251f456d`，不符就停下問塔台。不 merge / rebase / push、不動 `main` 與 `v0.8.x`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式；驅動腳本若要修，只改 `e2e/manual/`。"
  - "🔴 外部路徑（只在本機，不進 repo；repo 內與回報區一律寫 `<使用者資料夾>` 或 `%LOCALAPPDATA%`，D176）：驗收根目錄 `%LOCALAPPDATA%/ct610-accept`（ACCEPT，結構同 T0915：`checklist.md`、`claude-config/`（CFG，目前 CT 6.1.0-pre.1、使用者已登入）、`ct-test-project/`、`runs/`、`results/`）。新測試版：`%LOCALAPPDATA%/BAT-TestBuilds/0.0.0-exp.21-win/BetterAgentTerminal.exe`（塔台已下載解壓並核對 SHA-256）。"
  - "🔴 前置條件（任一不成立 → 不開任何 claude 回合，BLOCKED，通知塔台）：① 新測試版 exe 存在且 `resources/package.json` 版本 = `0.0.0-exp.21`；② `CFG/.credentials.json` 存在（🔴 只檢查存在，不讀、不複製、不記內容）；③ `ct-swap.py status --target CFG/skills` 顯示 6.1.0-pre.1。④ `CFG` 裡 T0915 在 M-C5 裝的 `bat-hooks` plugin 的 marketplace 指向已刪除的 T0915 worktree：若它讓 claude 啟動報錯或擋住測試，用同一個 `CLAUDE_CONFIG_DIR` 以 `claude plugin` 指令停用（不要手改設定檔），在回報區記錄；🔴 使用者層 `~/.claude` 不得有任何變更（前後雜湊比對）。"
  - "🔴 啟動與操作完全照 T0915：`launchIsolated`＋`BAT_E2E_EXECUTABLE`（獨立 `--runtime=e2e-*`）、env `CLAUDE_CONFIG_DIR=CFG`、`dropEnv` 去掉 `CLAUDECODE` / `CLAUDE_CODE_*`；塔台是 BAT 開的 claude-cli 分頁；鍵盤 / 滾輪 / 點擊走 Playwright。每個情境一份新副本 `ACCEPT/runs/R1`、`R2`、`R3`（從 `ct-test-project` 複製，保留不刪）。"
  - "🔴 補驗項目：R1＝M-C1-2（BUG-220）：沒有 `_ct-workorders/` 的副本 → 加工作區 → 開契約 2 塔台 `/control-tower` → **不按 ↻**，待辦分頁應在數秒內變「契約 v2 ✓」；再刪除 `_ct-workorders/` 讓塔台重建一次，確認也自動恢復。R2＝M-C2-b（BUG-221）：真 claude 全螢幕塔台滾輪往上捲、停 15 s 以上後讓 Worker 送通知 → 通知保留（debug log `[notify-hold] held … reason=reading`、`[tower-reading] … alt scrolled-up=true`），畫面不被拉回底部；之後按一個鍵 → 約 1–2 s 內送出。R3＝BUG-222：manual mode 塔台（工作區 claude-cli 參數設空字串＋Shift+Tab 切 manual，同 T0915 M-C5）讓 claude 同一回合平行送出 ≥ 2 個需要權限的工具呼叫（例：Bash＋2 個 Read），回答第一個後 → debug log 有 `kept: user input while <n> permission prompts are open`、縮圖 ⚠️ 仍在；「2 of n」期間送達的 Worker 通知 `[notify-hold] held`，Enter 沒有替使用者回答；全部回答完、批次結束後通知才送出。另：單一權限詢問回答後 ⚠️ 照舊立即消失（回歸檢查）。需要模型配合的狀態同一項最多試 3 次，仍沒出現判「未觸發」，🔴 不得硬判 PASS。"
  - "🔴 結果：更新 `ACCEPT/results/M-C1.md`、`M-C2.md`、`M-C5.md`：在檔尾新增〈補驗（T0920，BAT `0.0.0-exp.21`）〉段（執行時間系統取時、步驟、觀察、BAT 端判定、證據檔名、claude 回合數），截圖放 `results/M-Cn/reverify/`。🔴 不改 T0915 原有內容與「CT 端判定」欄。FAIL：不修產品，記重現與證據，回報區建議處置。"
  - "🔴 清理（D308）：結束前以 `closeIsolated` 關閉、確認 Terminal Server 已結束；比對 `ExecutablePath` 含 `BAT-TestBuilds` 或命令列含 `runtime-e2e-` / `ct610-accept` 的程序，只結束本單建立的；runtime userData 在日誌複製到 `results/` 後刪除。驅動狀態檔刪除。"
  - "🔴 驗證與 Git：若改了 `e2e/manual/`，`npx vite build` exit 0、兩個 typecheck = 0；worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；收單前 worktree `status --porcelain` 為空。yolo：不得問使用者，判讀問題問塔台。"
---

# T0920 — 補驗 BUG-220／221／222（真 claude 塔台）

| 情境 | 項目 | 對應修正 |
|---|---|---|
| R1 | M-C1-2 待辦分頁自動讀到新建的 `_ct-workorders/` | T0916 |
| R2 | M-C2-b 全螢幕塔台往上捲停住時保留通知 | T0917 |
| R3 | 排隊的權限詢問期間維持 `blocked`、通知保留 | T0918 |

## 驗收

- [ ] 前置條件 ①–④
- [ ] R1／R2／R3 各自 BAT 端判定（PASS／FAIL／未觸發，附證據）
- [ ] 結果檔補驗段、截圖
- [ ] 程序與 runtime 清理、使用者層 `~/.claude` 未變

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）
