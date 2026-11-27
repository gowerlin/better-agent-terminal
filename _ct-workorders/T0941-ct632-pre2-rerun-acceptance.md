---
schema_version: 1
schema_kind: workorder
id: T0941
title: "PLAN-070 補跑驗收：BAT `v0.8.0-pre.8` × CT 6.3.0-pre.2，跑 CT `checklist-rerun-630.md`（S5，1 個塔台 session）"
type: verification
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-070
priority: P1
sizing: S
created_at: "2026-11-27T14:30:52+08:00"
updated_at: "2026-11-27T14:31:46+08:00"
started_at: "2026-11-27T14:31:46+08:00"
session_ids: []
target_version: "0.8.0-pre.8（已發佈）＋ CT 6.3.0"
depends_on: [T0939]
related:
  - "PLAN-070；D407；CT D913（判定 T0575：M-5-1 FAIL）/ D914（修正單 T0576 收單，6.3.0-pre.2）；前例 T0928 / T0939（驅動與做法）"
affects_files:
  - _ct-workorders/T0941-ct632-pre2-rerun-acceptance.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0941` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改 repo 任何其他檔（含 `e2e/manual/`：T0940 同時在改其 README；本單用既有驅動即可，真的需要改驅動先問塔台）。"
  - "🔴 外部路徑（本機、不進 repo，D176）：ACC = `<使用者資料夾>/AppData/Local/ct620-accept`。補跑清單 `ACC/checklist-rerun-630.md`（SHA-256 開頭 `d8c79dd19dc73707`，不符就停下問塔台）；結果一律寫 `ACC/results-rerun-630/`，測試副本 `ACC/runs-rerun-630/S5/`（兩個目錄已建好）；🔴 `results-630/`、`runs-630/` 與 6.2.0 那一輪的結果只讀不動。BAT 用既有 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.0-pre.8-win/`（T0939 已以 Release digest 核對解壓；開工確認 exe 存在、`resources/package.json` 版號 `0.8.0-pre.8`）。"
  - "🔴 換版（開工先做）：工作目錄 ACC、直譯器 `<使用者資料夾>/.local/bin/python.exe`。先確認 `ACC/ct-swap-630.py` SHA-256 開頭 `9da20489947e4c9e`（不符就停）；`-X utf8 -I -B <ACC>/ct-swap-630.py status --target <ACC>/claude-config/skills`（記錄）→ `-X utf8 -I -B <ACC>/ct-swap-630.py install-632 --target <ACC>/claude-config/skills --work-dir <ACC>/_swap-630`；🔴 一定帶 `--target`；exit `0` 且最後兩行為「結論：9 個 skill 都是 6.3.0-pre.2」「完成。請開新的 Claude Code session…」才算成功，其他 → 停止、回報原文、問塔台。🔴 跑完**不換回**（隔離環境留在 6.3.0-pre.2）。"
  - "🔴 前置條件（任一不成立 → 不開 claude 回合，BLOCKED，通知塔台）：① 清單與換版腳本雜湊相符；② `claude-config/.credentials.json` 存在（只檢查存在）；③ 換版成功、`status` 為 6.3.0-pre.2；④ pre.8 exe 存在、版號相符。登入失效 → 停下問塔台，由使用者照清單重登，不自己處理憑證。"
  - "🔴 啟動與操作：同 T0939（`launchIsolated`＋`BAT_E2E_EXECUTABLE`、獨立 `--runtime=e2e-*`、`CLAUDE_CONFIG_DIR=<ACC>/claude-config`、`dropEnv` 移除 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`；工作區層級 `--dangerously-skip-permissions` 只限測試工作區）。🔴 `CFG/settings.json` 不動；`claude-config/` 的帳號檔（`.claude.json`、`backups/`、`cache/`、`plugins/`、`sessions/`）不得讀取、複製或摘錄。步驟 4 的三行訊息以 bracketed paste（xterm `paste()`，T0939 README 的做法）送進塔台輸入框；步驟 6 附對話紀錄摘錄，格式同 `ACC/results-630/M-5/transcript-excerpt.txt`（`ct610-transcript.mjs` 只轉本單 S5 的 jsonl）。"
  - "🔴 模型配合與用量：同一項需要模型配合的狀態最多試 3 次，仍沒出現判「未觸發」，不得硬判 PASS。只開 1 個塔台 session、不開 Worker；碰到用量上限立即停止，已完成的照常寫結果，回 PARTIAL。"
  - "🔴 結果檔：照清單格式寫 `ACC/results-rerun-630/`：執行時間（系統取時）、專案路徑、BAT / CT 版本、步驟、BAT 端觀察與判定（PASS / FAIL / 未觸發，附證據）、原始輸出（🔴 權杖值不出現）、回合數；🔴 CT 端判定欄留空。工單回報區附總表。BAT 端 FAIL 不修產品程式，記證據、建議開 BUG。清單看不懂或與 UI 不符 → 問塔台（轉 CT），不自己改清單。"
  - "🔴 環境與 Git：程序清理照 D308（`closeIsolated`，之後查無 `BAT-TestBuilds` / `runtime=e2e-*` 程序與 runtime userData）；使用者層 `~/.claude`、`~/.codex` 前後雜湊相同；使用者安裝的 BAT 不得被碰。worktree 不寫產品檔，收單前 `status --porcelain` 為空；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
  - "🔴 公開 repo（D176）：回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。結果檔在 ACC（本機）可寫實際路徑。yolo：不得問使用者。工單狀態寫 `DONE` / `PARTIAL`（L177）。"
---

# T0941 — CT 6.3.0-pre.2 補跑（S5）

## 背景

CT 判定 T0575（CT D913）：唯一 FAIL M-5-1——五行回答解析正確，但逐筆確認行延到下一則回覆（規格沒寫「確認行要在開選單之前輸出」）。CT 修正單 T0576（CT D914）出 6.3.0-pre.2：確認行同一則回覆逐筆一行、開選單前先輸出、多代號依 options 順序、多選選單回傳格式；資料格式、`inbox_features`、契約不變，BAT 不用改。補跑清單 `checklist-rerun-630.md`：BAT pre.8、1 個塔台 session、約 4 回合、不需要 Worker。

CT 條文（`BMad-Control-Tower/BMad-Control-Tower-v6.3.0-pre.2/skills/control-tower/`，CT commit `0e06004`）：`references/memory-protocol.md` 確認行 `:331-332`、先確認再開選單 `:357-360`、多代號依 options 順序 `:326-327`（範例 `:333-334`）、多選選單回傳格式 `:367-368`。

## 驗收

- [ ] 前置條件（雜湊、已登入、換到 6.3.0-pre.2、pre.8 exe）
- [ ] S5 依補跑清單跑完（或依用量 PARTIAL）
- [ ] 結果寫 `ACC/results-rerun-630/`，回報區總表；CT 端判定欄留空
- [ ] 隔離環境留在 6.3.0-pre.2；使用者層無變更、安裝版 BAT 未被碰、程序清理

---

## 回報區

（Worker 填寫）
