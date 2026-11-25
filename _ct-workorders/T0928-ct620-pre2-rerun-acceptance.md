---
schema_version: 1
schema_kind: workorder
id: T0928
title: "PLAN-069 補跑驗收：以 zip 測試版 BAT `0.8.0-exp.2`（含 BUG-224 修正）＋ CT 6.2.0-pre.2，跑 CT `checklist-rerun.md` R-1～R-4（S5 / S6），並實機驗證 BUG-224"
type: verification
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-069
priority: P1
sizing: M
created_at: "2026-11-25T23:34:04+08:00"
started_at: "2026-11-25T23:41:20+08:00"
updated_at: "2026-11-25T23:41:20+08:00"
target_version: "0.8.0-pre.4（與 CT 6.2.0 同日發佈）"
depends_on: [T0923, T0926]
related:
  - "PLAN-069；BUG-224（T0926〈待實機〉）；D360；CT 塔台 D896 / D897、CT 工單 T0568（判定）/ T0569（6.2.0-pre.2、`checklist-rerun.md`）；前例 T0923（驅動與做法）"
affects_files:
  - _ct-workorders/T0928-ct620-pre2-rerun-acceptance.md
  - e2e/manual/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0928` 寫檔（base = 派工當下的 `main`，已含 T0922 / T0924 / T0925 / T0926）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式、不改 `e2e/fixtures/`；只可擴充 `e2e/manual/` 的驅動（例：`ct-accept-act.mjs` 加「選單選最後一項」「在『其他』輸入文字」），README 同步。"
  - "🔴 外部路徑（本機、不進 repo，D176）：ACC = `<使用者資料夾>/AppData/Local/ct620-accept`。補跑清單 `ACC/checklist-rerun.md`（SHA-256 開頭 `fdb9525a`，不符就停下問塔台）；結果一律寫 `ACC/results-rerun/`（🔴 不得寫進 `ACC/results/`）；情境 S5（預設設定）、S6（`pending_reminder: on-change`），各從 `ACC/ct-test-project/` 開新副本 `ACC/runs/S5`、`ACC/runs/S6`。測試版 BAT：`desktop-build` run `45644734317`（`main` `56ca6e66`，版號 `0.8.0-exp.2`）的 `desktop-win` artifact，`gh run download 45644734317 -R gowerlin/better-agent-terminal -n desktop-win` 到自己的空目錄、以 `SHA256SUMS.txt` 比對 zip 後解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.0-exp.2-win/`（只用 zip，不執行 .exe 安裝檔）。"
  - "🔴 換版（開工先做）：照 `checklist-rerun.md` 逐字執行，工作目錄 ACC：`<使用者資料夾>/.local/bin/python.exe -X utf8 -I -B <ACC>/ct-swap.py install-622 --target <ACC>/claude-config/skills --work-dir <ACC>/_swap`；成功時最後兩行「結論：9 個 skill 都是 6.2.0-pre.2」「完成。請開新的 Claude Code session…」。🔴 一定帶 `--target`。非 0 → 停止、回報原文、問塔台。結束時是否換回由 checklist 決定。"
  - "🔴 前置條件（任一不成立 → 不開 claude 回合，BLOCKED，通知塔台）：① `checklist-rerun.md` 雜湊相符；② `claude-config/.credentials.json` 存在（只檢查存在，不讀、不複製）；③ 換版後 `status --target <ACC>/claude-config/skills` 是 6.2.0-pre.2；④ `0.8.0-exp.2` zip 雜湊相符、exe 存在、`BUILD-INFO.txt` commit = `56ca6e66`。"
  - "🔴 啟動與操作：同 T0923（`launchIsolated`＋`BAT_E2E_EXECUTABLE`、獨立 `--runtime=e2e-*`、`CLAUDE_CONFIG_DIR=<ACC>/claude-config`、`dropEnv` 移除 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`；工作區層級 `--dangerously-skip-permissions` 只限測試工作區；Playwright 鍵盤輸入；原生選單以方向鍵 / Enter / Esc 操作，「其他」照 Claude Code 選單的輸入方式）。🔴 `claude-config/` 裡登入產生的帳號檔（`.claude.json`、`backups/`、`cache/`、`plugins/`、`sessions/`）不得讀取、複製或摘錄。同一項需要模型配合的狀態最多試 3 次，仍沒出現判「未觸發」，不得硬判 PASS。"
  - "🔴 BUG-224 實機驗證（本單附加，寫 `ACC/results-rerun/BUG-224.md`，不影響 CT 判定）：照 T0926〈待實機〉1–5：選單出現後 < 0.2 s 送 Esc（重複數次），debug log 不應在 `cleared (user input)` 之後再出現 `blocked reason=question (hook permission-request …)`，應見 `kept cleared: hook permission-request tool=AskUserQuestion …`；縮圖無 ⚠️、`terminal:get-state` 非 `blocked`；此時 Worker `--submit` 通知 / 待辦分頁回答立即送出；反例：之後新 AskUserQuestion 照常 `blocked`。可與 R-2（Esc）共用回合。"
  - "🔴 結果檔：照 `checklist-rerun.md` 的格式寫 `ACC/results-rerun/R-n.md`（＋截圖目錄）：執行時間（系統取時）、專案路徑、BAT / CT 版本、步驟、BAT 端觀察與判定（PASS / FAIL / 未觸發，附證據）、原始輸出（🔴 權杖值不出現）、回合數；🔴 CT 端判定欄留空。工單回報區附總表。BAT 端 FAIL 不修產品程式，記證據、建議開 BUG，繼續跑。清單看不懂或與 UI 不符 → 問塔台（轉 CT），不自己改清單。"
  - "🔴 驗證與 Git：改了 `e2e/manual/` 時 `node --check`；worktree `npm ci`、`npx vite build` exit 0、兩個 typecheck = 0。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。程序清理照 D308；使用者層 `~/.claude`、`~/.codex` 前後雜湊相同。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。結果檔在 ACC（本機）可寫實際路徑。yolo：不得問使用者。"
---

# T0928 — PLAN-069 補跑驗收（CT 6.2.0-pre.2 × BAT `0.8.0-exp.2`）

## 背景

T0923 的 CT 端判定（CT T0568 / D896）：44 判定 PASS 41 / FAIL 1（M-12-3，3 選項選單沒加「放棄」）/ 未觸發 2。CT 出 6.2.0-pre.2 修規範（CT T0569 / D897：選項 1～3 個一定加「放棄」、`options` 為空改文字、Esc = 使用者中斷且下一則回覆重列、斷點 A 措辭；新設定 `pending_reminder`），並寫補跑清單 `checklist-rerun.md`（R-1～R-4）。BAT 端 BUG-224 已修（T0926，經 T0927 併入 `main`），測試版 `0.8.0-exp.2` 由 run `45644734317` 打包（D360）。

CT 條文位置（以 `BMad-Control-Tower/BMad-Control-Tower-v6.2.0-pre.2/skills/control-tower/` 為準，CT commit `18d847d`）：R1 放棄項 `references/memory-protocol.md:319-322`；R2 options 為空 `:324-325`；R3 Esc `:327-330`；`pending_reminder` `SKILL.md:247-256`、`references/tower-config.md:60`。`pending_reminder` 的「完整列出」觸發是「使用者問待決（任何說法）或下 `*sync`」（不是 `*status`）。BAT 待辦分頁讀的欄位（`bat_contract`、`inbox_features`、`awaiting_user` / `user_actions`）沒有變。

## 驗收

- [ ] 前置條件（清單雜湊、已登入、換到 6.2.0-pre.2、`0.8.0-exp.2` zip）
- [ ] S5：R-1～R-3（依清單）＋ BUG-224 實機
- [ ] S6：R-4（`pending_reminder: on-change`）
- [ ] 結果寫 `ACC/results-rerun/`，回報區總表；CT 端判定欄留空
- [ ] 使用者層無變更、安裝版 BAT 未被碰、程序清理
- [ ] 改了 `e2e/manual/` 時 build、兩個 typecheck、`node --check`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 前置條件

### 總表（BAT 端判定；CT 端判定欄留空給 CT）

### BUG-224 實機

### 建議開 BUG

### 產品變更

### 驗證

### 環境與清理

### 遭遇問題

### 互動紀錄

### 隔離分支證據
- branch：`ct/T0928`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
