---
schema_version: 1
schema_kind: workorder
id: T0943
title: "PLAN-070 補驗：BAT `v0.8.0-pre.8` × CT 6.3.0-pre.3，跑 `checklist-rerun-630.md` § 5〈pre.3 補驗〉R-2-1～R-2-7（S6，1 個塔台 session）"
type: verification
status: TODO
repo: better-agent-terminal
project: PLAN-070
priority: P1
sizing: S
created_at: "2026-11-27T15:11:57+08:00"
updated_at: "2026-11-27T15:11:57+08:00"
session_ids: []
target_version: "0.8.0-pre.8（已發佈）＋ CT 6.3.0"
depends_on: [T0941]
related:
  - "PLAN-070；D413；CT D916（判定 T0577：R-1-3 / R-1-5 FAIL）/ D917（做法 A）/ D918（T0578 收單，6.3.0-pre.3）；前例 T0941（同做法）"
affects_files:
  - _ct-workorders/T0943-ct633-pre3-rerun-acceptance.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0943` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改 repo 任何其他檔（含 `e2e/manual/`；T0942 同時在改產品檔）。真的需要改驅動先問塔台。"
  - "🔴 外部路徑（本機、不進 repo，D176）：ACC = `<使用者資料夾>/AppData/Local/ct620-accept`。清單 `ACC/checklist-rerun-630.md`（SHA-256 開頭 `07315f82143a212b`，不符就停下問塔台），只跑 § 5〈pre.3 補驗〉（約第 107 行起），判定項 R-2-1～R-2-7；🔴 不要用 `checklist-rerun-630-pre2.md`（上一輪的舊版）。結果寫 `ACC/results-rerun2-630/R-2.md`＋`R-2/`，測試副本 `ACC/runs-rerun2-630/S6/`（兩個目錄已建好）；🔴 `results-630/`、`results-rerun-630/`、`runs-*` 其他目錄只讀不動。BAT 用既有 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.0-pre.8-win/`（開工確認 exe 存在、`resources/package.json` 版號 `0.8.0-pre.8`），runtime `e2e-630-s6`（驅動若固定加時間後綴，照實記錄）。"
  - "🔴 換版（開工先做）：工作目錄 ACC、直譯器 `<使用者資料夾>/.local/bin/python.exe`。先確認 `ACC/ct-swap-630.py` SHA-256 開頭 `878ad2962ae74e93`（不符就停）；`-X utf8 -I -B <ACC>/ct-swap-630.py status --target <ACC>/claude-config/skills`（預期 6.3.0-pre.2，記錄）→ `-X utf8 -I -B <ACC>/ct-swap-630.py install-633 --target <ACC>/claude-config/skills --work-dir <ACC>/_swap-630`；🔴 一定帶 `--target`；exit `0` 且最後兩行為「結論：9 個 skill 都是 6.3.0-pre.3」「完成。請開新的 Claude Code session…」才算成功，其他 → 停止、回報原文、問塔台。🔴 跑完**不換回**（留在 6.3.0-pre.3）。"
  - "🔴 前置條件（任一不成立 → 不開 claude 回合，BLOCKED，通知塔台）：① 清單與換版腳本雜湊相符；② `claude-config/.credentials.json` 存在（只檢查存在）；③ 換版成功、`status` 為 6.3.0-pre.3；④ pre.8 exe 存在、版號相符。登入失效 → 停下問塔台，不自己處理憑證。"
  - "🔴 啟動與操作：同 T0941（`launchIsolated`＋`BAT_E2E_EXECUTABLE`、`CLAUDE_CONFIG_DIR=<ACC>/claude-config`、`dropEnv` 移除 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`；工作區層級 `--dangerously-skip-permissions` 只限測試工作區）。🔴 `CFG/settings.json` 不動；`claude-config/` 帳號檔不得讀取、複製或摘錄。照清單：步驟 ② 三行訊息以 bracketed paste（`ct610-ctl.mjs @檔案`，T0941 做法）；③ 在「補驗丙」選單按 Esc，輸出存 `tower-output-2-esc.txt`；④ 打字回答 `<丙>：A`。`transcript-excerpt.txt` 要含 `AskUserQuestion` tool_use 的輸入全文（CT 看題目開頭是否有「剛才的回答：」）；畫面上 `● … · summary` 是 thinking 顯示，不是回覆（清單 § 5.3）。若 ③ 題目被截斷或換行異常，截圖並記錄。"
  - "🔴 干擾：使用者已被提醒驗收期間不要操作測試視窗；若仍出現非驅動輸入，停下回報（不重試）。只開 1 個塔台 session、不開 Worker；同一項需要模型配合的狀態最多試 3 次；碰到用量上限立即停止，回 PARTIAL。"
  - "🔴 結果檔：照清單格式寫 `R-2.md`：執行時間（系統取時）、專案路徑、BAT / CT 版本、步驟、BAT 端觀察與判定（PASS / FAIL / 未觸發，附證據）、原始輸出（🔴 權杖值不出現）、回合數；🔴 CT 端判定欄留空。工單回報區附總表。"
  - "🔴 環境與 Git：程序清理照 D308；使用者層 `~/.claude`、`~/.codex` 前後雜湊相同；使用者安裝的 BAT 不得被碰。worktree 不寫產品檔，收單前 `status --porcelain` 為空；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
  - "🔴 公開 repo（D176）：回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。結果檔在 ACC（本機）可寫實際路徑。yolo：不得問使用者。工單狀態寫 `DONE` / `PARTIAL`（L177）。"
---

# T0943 — CT 6.3.0-pre.3 補驗（S6）

## 背景

CT 判定 T0577（CT D916）：補跑 R-1-3 / R-1-5 FAIL——處理回答後又開選單的回合，模型不在選單前輸出確認行。CT 使用者選做法 A（CT D917）：確認行寫進選單第一題題目開頭；> 4 筆或需說明時不開選單。CT T0578（CT D918）出 6.3.0-pre.3，補驗段 § 5（R-2-1～R-2-7）。BAT 不用改。

CT 條文（`BMad-Control-Tower/BMad-Control-Tower-v6.3.0-pre.3/skills/control-tower/`，CT commit `e4b58b8`）：`references/memory-protocol.md` 確認行寫進題目 `:347-350`、退路 `:351-352`、理由 `:353-354`；`SKILL.md:267-271`。本次只 2 筆回答，不觸發退路；題目被截斷時記錄（CT 會重新考慮 4 筆門檻）。

## 驗收

- [ ] 前置條件（雜湊、已登入、換到 6.3.0-pre.3、pre.8 exe）
- [ ] § 5 跑完（或依用量 PARTIAL）
- [ ] 結果寫 `ACC/results-rerun2-630/`，回報區總表；CT 端判定欄留空
- [ ] 隔離環境留在 6.3.0-pre.3；使用者層無變更、安裝版 BAT 未被碰、程序清理

---

## 回報區

（Worker 填寫）
