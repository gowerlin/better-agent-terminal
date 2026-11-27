---
schema_version: 1
schema_kind: workorder
id: T0939
title: "PLAN-070 雙方驗收：BAT `v0.8.0-pre.8`（與 pre.4）× CT 6.3.0-pre.1，跑 CT `checklist-630.md` M-1～M-17（S1→S3→S2→S4）"
type: verification
status: TODO
repo: better-agent-terminal
project: PLAN-070
priority: P1
sizing: L
created_at: "2026-11-27T13:04:27+08:00"
updated_at: "2026-11-27T13:04:27+08:00"
session_ids: []
target_version: "0.8.0-pre.8（已發佈）＋ CT 6.3.0"
depends_on: [T0938]
related:
  - "PLAN-070；D402；CT 塔台 D910（U-7：A，比照 6.2.0）/ D911（CT 準備單 T0574 收單）；前例 T0923 / T0928（驅動與做法，`e2e/manual/ct-accept-*.mjs`）"
affects_files:
  - _ct-workorders/T0939-ct630-pre1-joint-acceptance.md
  - e2e/manual/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0939` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式、不改 `e2e/fixtures/`；只可擴充 `e2e/manual/` 的驅動（例：原生多選選單「勾選＋其他」、待辦分頁勾選框），README 同步。"
  - "🔴 外部路徑（本機、不進 repo，D176）：ACC = `<使用者資料夾>/AppData/Local/ct620-accept`。清單 `ACC/checklist-630.md`（SHA-256 開頭 `a6b829374ffe29a3`，不符就停下問塔台）；照清單 § 0～§ 7 執行：結果寫 `ACC/results-630/M-n.md`（＋截圖），測試專案副本 `ACC/runs-630/<情境>/`；🔴 6.2.0 那一輪的 `results/`、`results-rerun/`、`runs/` 只讀不動。情境順序 S1 → S3 → S2 → S4（清單 § 2 定稿為準）。"
  - "🔴 BAT 測試版（只用 zip，不執行 .exe 安裝檔、不碰使用者安裝的 BAT）：從 GitHub Release 下載 `BetterAgentTerminal-0.8.0-pre.8-win.zip`（`v0.8.0-pre.8`，SHA-256 `b0cbfd13cb2f86d7f883f3aeb98ba1ec29486bc26d6a651743aaf780c3cc8362`）與 `BetterAgentTerminal-0.8.0-pre.4-win.zip`（`v0.8.0-pre.4`，SHA-256 `f424ad6a75afd23c9b2969327e8877c5789e01f7fcfceb01f196a211cde10a1d`）到各自的空下載目錄（`gh release download v0.8.0-pre.N -R gowerlin/better-agent-terminal -p '*-win.zip'`），雜湊相符才解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.0-pre.8-win/`、`…/0.8.0-pre.4-win/`。不符 → 停下問塔台。"
  - "🔴 換版：S1～S3 不換（隔離 skills 已是 6.3.0-pre.1，開工先 `status` 確認）；S4 照清單 § 1.4 逐字：直譯器 `<使用者資料夾>/.local/bin/python.exe`、工作目錄 ACC、`-X utf8 -I -B <ACC>/ct-swap-630.py install-620 --target <ACC>/claude-config/skills --work-dir <ACC>/_swap-630`，跑完同一行改 `install-630` 換回；🔴 一定帶 `--target`；exit `0` 且最後兩行為「結論：9 個 skill 都是 <版本>」「完成。請開新的 Claude Code session…」才算成功，其他 → 停止、回報原文、問塔台。結束時隔離 skills 必須是 6.3.0-pre.1。"
  - "🔴 前置條件（任一不成立 → 不開 claude 回合，BLOCKED，通知塔台）：① 清單雜湊相符；② `claude-config/.credentials.json` 存在（只檢查存在，不讀、不複製）；③ `ct-swap-630.py status --target <ACC>/claude-config/skills` 是 6.3.0-pre.1；④ 兩個 zip 雜湊相符、exe 存在。登入失效（claude 要求登入）→ 停下問塔台，由使用者照清單 § 1.2 重登，不自己處理憑證。"
  - "🔴 啟動與操作：同 T0923 / T0928（`launchIsolated`＋`BAT_E2E_EXECUTABLE`、獨立 `--runtime=e2e-*`、`CLAUDE_CONFIG_DIR=<ACC>/claude-config`、`dropEnv` 移除 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`；工作區層級 `--dangerously-skip-permissions` 只限測試工作區；Playwright 鍵盤輸入）。🔴 `CFG/settings.json` 的 `theme`、`skipDangerousModePermissionPrompt` 保留不動。🔴 `claude-config/` 裡登入產生的帳號檔（`.claude.json`、`backups/`、`cache/`、`plugins/`、`sessions/`）不得讀取、複製或摘錄。"
  - "🔴 模型配合與用量：同一項需要模型配合的狀態最多試 3 次（M-2 照清單附的補送提示詞），仍沒出現判「未觸發」，不得硬判 PASS。M-13 / M-14（塔台分頁原生多選選單同時勾選＋填「其他」）這版 claude 做不到 → 「未觸發（環境）」＋截圖。M-15c 沒有 Codex 環境 → 「未觸發」。🔴 碰到用量上限 / rate limit：立即停止開新回合，已完成的照常寫結果，回 PARTIAL 並列出未跑項目，不重試。S4 用量不夠時照清單 § 6 的精簡做法。"
  - "🔴 BAT 端重點（PLAN-070 子項 4 未驗項目，判定照清單；另在工單回報區列出 BAT 觀察）：待辦分頁多選題 `可複選`＋勾選框、推薦項（`A、C`、大小寫不同的 `x1`/`X1`）預設勾選並標推薦、改勾送出 `U-n：<依選項順序、、連接>`、「其他」與勾選互斥、M-9 手動 `multi: true` 的畫面、舊 BAT pre.4 / 舊 CT 6.2.0 的降級畫面（單選）。"
  - "🔴 結果檔：照清單格式寫 `ACC/results-630/M-n.md`：執行時間（系統取時）、情境與專案路徑、BAT / CT 版本、步驟、BAT 端觀察與判定（PASS / FAIL / 未觸發，附證據）、原始輸出（🔴 權杖值不出現）、回合數；🔴 CT 端判定欄留空。工單回報區附總表。BAT 端 FAIL 不修產品程式，記證據、建議開 BUG，繼續跑。清單看不懂或與 UI 不符 → 問塔台（轉 CT），不自己改清單。"
  - "🔴 驗證與 Git：改了 `e2e/manual/` 時 `node --check`；worktree `npm ci`、`npx vite build` exit 0、兩個 typecheck = 0。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。程序清理照 D308；使用者層 `~/.claude`、`~/.codex` 前後雜湊相同；使用者安裝的 BAT（`C:/Program Files/BetterAgentTerminal`）不得被碰。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。結果檔在 ACC（本機）可寫實際路徑。yolo：不得問使用者。工單狀態寫 `DONE` / `PARTIAL`（`FIXED` 是 BUG 用的，L177）。"
---

# T0939 — CT 6.3.0-pre.1 × BAT pre.8 雙方驗收

## 背景

PLAN-070：BAT `v0.8.0-pre.8`（T0936 / T0937 / T0938）已發佈並由使用者實機驗收「其他」、放棄只當原因、指令欄檔案連結（D401）；多選勾選送出、推薦預設勾選尚未驗。CT 6.3.0-pre.1（CT PLAN-021 / T0573）規格定稿，CT 使用者 U-7 選 A：比照 6.2.0 做雙方驗收（CT D910）。CT 準備單 T0574 收單（CT D911）：沿用隔離目錄 ACC（已登入），skills 已換 6.3.0-pre.1，新增 `ct-swap-630.py`、`checklist-630.md`（M-1～M-17，370 行）、`runs-630/`、`results-630/`。BAT 跑、CT 依清單 § 7 判定。

CT 條文位置（以 `BMad-Control-Tower/BMad-Control-Tower-v6.3.0-pre.1/skills/control-tower/` 為準，CT commit `c109f10`）：`references/memory-protocol.md` `inbox_features` `:32` `:57` `:212`、推薦與 `multi` `:227`–`:229`、放棄只當原因 `:283`–`:288`、回答格式 `:298`–`:306`、多選解析 `:319`–`:326`、確認行 `:330`–`:331`、原生選單 `:347`–`:363`、文字範本 `:369`–`:370`、範例 `:402` 起。

## 情境（清單 § 2 定稿為準）

- S1：BAT pre.8 × CT 6.3.0-pre.1（副本 `_tower-config.yaml` `yolo_max_retries: 1`）：M-1；M-2＋M-8＋M-4；M-12～M-14；M-3＋M-10（斷點 B-2，1 個 Worker）；M-5～M-7、M-11、M-10-4；M-9。
- S3：BAT pre.4 × 6.3.0-pre.1：M-16。
- S2：BAT pre.8 × 6.3.0-pre.1，`interactive-prompts: off`：M-15a／b／c。
- S4：BAT pre.8 × CT 6.2.0（先 `install-620`，跑完 `install-630` 換回）：M-17。

## 驗收

- [ ] 前置條件（清單雜湊、已登入、skills 是 6.3.0-pre.1、兩個 zip 雜湊）
- [ ] S1 / S3 / S2 / S4 依清單跑完（或依用量 PARTIAL，列出未跑項目）
- [ ] 結果寫 `ACC/results-630/`，回報區總表＋ BAT 端重點觀察；CT 端判定欄留空
- [ ] 結束時隔離 skills 是 6.3.0-pre.1；使用者層無變更、安裝版 BAT 未被碰、程序清理
- [ ] 改了 `e2e/manual/` 時 build、兩個 typecheck、`node --check`

---

## 回報區

（Worker 填寫）
