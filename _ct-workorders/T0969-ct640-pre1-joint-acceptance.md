---
schema_version: 1
schema_kind: workorder
id: T0969
title: "CT PLAN-022 P2 雙方驗收：BAT `v0.8.1-pre.4`（與 pre.3）× CT 6.4.0-pre.1，跑 CT `checklist-640.md` H-1～H-14（S1→S3→S4→S2）"
type: verification
status: PENDING
repo: better-agent-terminal
priority: P1
sizing: L
created_at: "2026-11-28T14:19:41+0800"
updated_at: "2026-11-28T14:19:41+0800"
target_version: "0.8.1-pre.4（已發佈）＋ CT 6.4.0-pre.1"
depends_on: [T0968]
related:
  - "BUG-236 / T0965 / T0968；D494；CT 塔台 CT D929（U-11：A，比照 6.3.0）/ CT D930（CT 準備單 T0583 收單）；前例 T0939（6.3.0 雙方驗收）、T0923 / T0928（驅動與做法，`e2e/manual/ct-accept-*.mjs`）"
affects_files:
  - _ct-workorders/T0969-ct640-pre1-joint-acceptance.md
  - e2e/manual/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0969` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式、不改 `e2e/fixtures/`；只可擴充 `e2e/manual/` 的驅動（例：狀態檔寫入監看、原生選單開著時擷取 `_tower-state.md`、待辦分頁送出），README 同步。"
  - "🔴 外部路徑（本機、不進 repo，D176）：ACC = `<使用者資料夾>/AppData/Local/ct620-accept`。清單 `ACC/checklist-640.md`（50592 bytes，SHA-256 開頭 `9c7dd2792c5d5da5`，不符就停下問塔台）；照清單 § 0 起執行：結果寫 `ACC/results-640/H-n.md`（＋截圖），測試專案副本 `ACC/runs-640/<情境>/`；🔴 先前輪次的 `results/`、`results-rerun/`、`results-630/`、`runs/`、`runs-630/` 只讀不動。"
  - "🔴 情境（清單 § 2 定稿為準）：S1 BAT `v0.8.1-pre.4`（runtime `e2e-640-s1`）× 6.4.0-pre.1，同一個塔台 session 依序 H-1 → H-2 → H-3 → H-4 → H-5 → H-10 → H-9（加 H-8a）→ H-6 → H-14b 加 H-11 → H-8b 加 H-7；S2 BAT `v0.8.1-pre.4`（`e2e-640-s2`），副本 `interactive-prompts: off` 做 H-14a，H-14c（Codex）環境不具備判「未觸發」；S3 BAT `v0.8.1-pre.3`（`e2e-640-s3`）× 6.4.0-pre.1 做 H-12；S4 BAT `v0.8.1-pre.4`（`e2e-640-s4`）× CT 6.3.0 做 H-13。執行順序 S1 → S3 → S4 → S2（用量不夠時依此順序截斷）。"
  - "🔴 BAT 測試版（只用 zip，不執行 .exe 安裝檔、不碰使用者安裝的 BAT）：`gh release download v0.8.1-pre.N -R gowerlin/better-agent-terminal -p '*-win.zip'` 到各自的空下載目錄；`BetterAgentTerminal-0.8.1-pre.4-win.zip` SHA-256 `a475808e852bd1f08ad1203ada57fbefe2c1cab23efa5a5945d75a759b149f68`、`BetterAgentTerminal-0.8.1-pre.3-win.zip` SHA-256 `992e9c78515c71cc841ee736e59498a5070264c5e6ce9b91fd1eacb1282b0aad`；雜湊相符才解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.N-win/`（已存在且 exe 版本相符可沿用）。pre.3 取不到時退回 `0.8.0-pre.8`（SHA-256 `b0cbfd13cb2f86d7f883f3aeb98ba1ec29486bc26d6a651743aaf780c3cc8362`，清單 § 1.2）。不符 → 停下問塔台。"
  - "🔴 換版：S1 / S2 / S3 不換（隔離 skills 已是 6.4.0-pre.1，開工先 `status` 確認）；S4 照 CT 指令逐字：直譯器 `<使用者資料夾>/.local/bin/python.exe`、工作目錄 ACC、`-X utf8 -I -B <ACC>/ct-swap-640.py install-630 --target <ACC>/claude-config/skills --work-dir <ACC>/_swap-640`，跑完同一行改 `install-640` 換回（`status` 不帶 `--work-dir`）；`ct-swap-640.py` SHA-256 開頭 `d2d7798df1913117`；🔴 一定帶 `--target`；exit `0` 且最後一行是「完成。請開新的 Claude Code session…」才算成功；exit `1`（已還原）/ `2`（參數錯）或其他 → 停止、回報原文、問塔台。結束時隔離 skills 必須是 6.4.0-pre.1。"
  - "🔴 前置條件（任一不成立 → 不開 claude 回合，BLOCKED，通知塔台）：① 清單與 `ct-swap-640.py` 雜湊相符；② `claude-config/.credentials.json` 存在（只檢查存在，不讀、不複製）；③ `ct-swap-640.py status --target <ACC>/claude-config/skills` 是 6.4.0-pre.1（CFG manifest `cfg-640-manifest.sha256` SHA-256 開頭 `bac3ef004129d025`）；④ 兩個 zip 雜湊相符、exe 存在。登入失效 → 停下問塔台，由使用者重登，不自己處理憑證。"
  - "🔴 注意事項（清單 § 1.4、§ 1.6）：`_tower-state.md` 要在 wait menu 成立後、作答或 Esc 之前擷取（`menu_open` 只出現在那一次寫入）→ 另開檔案監看、每次寫入存一份；不要點塔台終端（`question` 會被清掉），Esc 只按一次；驗收期間不手動操作測試視窗；S3 的 pre.3 有 BUG-235（回答可能卡在待送）：卡超過 60 秒就按「立即送出」並記錄。"
  - "🔴 啟動與操作：同 T0939 / T0923 / T0928（`launchIsolated`＋`BAT_E2E_EXECUTABLE`、獨立 `--runtime=e2e-640-*`、`CLAUDE_CONFIG_DIR=<ACC>/claude-config`、`dropEnv` 移除 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`；工作區層級 `--dangerously-skip-permissions` 只限測試工作區；Playwright 鍵盤輸入）。`CFG/settings.json` 的 `theme`、`skipDangerousModePermissionPrompt` 保留不動。`claude-config/` 裡的帳號檔（`.claude.json`、`backups/`、`cache/`、`plugins/`、`sessions/`）不得讀取、複製或摘錄。"
  - "🔴 模型配合與用量：同一項需要模型配合的狀態最多試 3 次，仍沒出現判「未觸發」，不得硬判 PASS。碰到用量上限 / rate limit：立即停止開新回合，已完成的照常寫結果，回 PARTIAL 並列出未跑項目，不重試。"
  - "🔴 BAT 端重點（同時是 T0965 / T0968〈待實機〉與 A-26 的一部分，請在回報區另列）：① 選單開著時從待辦分頁回答 → 「已排入待送」→ BAT 代按 Esc → 塔台收到 `U-n：…`；Esc 後 claude 輸入框是否為空；② 選單開著時 PTY 有沒有持續輸出（`menu esc waits … (output)` 是否一直出現）；③ 不在 `menu_open.ids` 的 U-n / A-n → 不按 Esc、保留到選單關閉（`menu esc skipped … (not-in-menu)`）；④ 題目旁「在這裡回答會先關掉選單」提示；⑤ 舊 BAT pre.3 / 舊 CT 6.3.0 的降級行為；⑥ debug log 相關行（`[notify-hold] menu esc …`、`[tower-inbox] answer menu …`、`[blocked] … question menu closed`）摘要，🔴 不貼權杖、不貼回答內容以外的使用者資料。"
  - "🔴 結果檔：照清單格式寫 `ACC/results-640/H-n.md`：執行時間（系統取時）、情境與專案路徑、BAT / CT 版本、步驟、BAT 端觀察與判定（PASS / FAIL / 未觸發，附證據：狀態檔擷取、截圖、日誌摘要）、原始輸出（🔴 權杖值不出現）、回合數；🔴 CT 端判定欄留空。工單回報區附總表。BAT 端 FAIL 不修產品程式，記證據、建議開 BUG，繼續跑。清單看不懂或與 UI 不符 → 問塔台（轉 CT），不自己改清單。"
  - "🔴 驗證與 Git：改了 `e2e/manual/` 時 `node --check`；worktree `npm ci`、`npx vite build` exit 0、兩個 typecheck = 0。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。程序清理照 D308；使用者層 `~/.claude`、`~/.codex` 前後雜湊相同；使用者安裝的 BAT（`C:/Program Files/BetterAgentTerminal`）不得被碰。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。結果檔在 ACC（本機）可寫實際路徑。yolo：不得問使用者。工單狀態寫 `DONE` / `PARTIAL`（L177）。"
---

# T0969 — CT 6.4.0-pre.1 × BAT pre.4 雙方驗收

## 背景

CT PLAN-022（CT 6.4.0）：CT 開選單前寫 `menu_open`（選單包含的 U-n）、`inbox_features` 加 `menu`、被 Esc 關掉的選單不重開（BAT HANDOVER `_handover-2026-11-28-inbox-menu-handoff.md`，ACKNOWLEDGED）。BAT `v0.8.1-pre.4` 已發佈（D494）：T0965 選單開著時從待辦分頁作答（代按 Esc 再送文字）、T0968 讀 `menu_open`（只對選單內的題代按 Esc）。CT 使用者核定 P2 比照 6.3.0 做雙方驗收（CT U-11：A，CT D929）；CT 準備單 T0583 收單（CT D930）：ACC 的 skills 已換 6.4.0-pre.1、已登入，新增 `ct-swap-640.py`、`checklist-640.md`（H-1～H-14）、`runs-640/`、`results-640/`。BAT 跑、CT 依清單判定。

CT 條文位置（`BMad-Control-Tower/BMad-Control-Tower-v6.4.0-pre.1/skills/control-tower/`，CT commit `7fee085`）：`references/memory-protocol.md` `menu_open` `:33` `:222` `:227`–`:237` `:314`–`:325`、每次寫入不保留 `:98`–`:100` `:104`–`:105`、開選單前同一次寫入 `:379`–`:380`、`inbox_features` `menu` `:32` `:59` `:220`、第 7 點 `:405`–`:418`、〈競態〉`:435`–`:441`、範例 `:464` 起。

## 情境（清單 § 2 定稿為準）

- S1：BAT pre.4 × CT 6.4.0-pre.1：H-1 → H-2 → H-3 → H-4 → H-5 → H-10 → H-9（＋H-8a）→ H-6 → H-14b＋H-11 → H-8b＋H-7。
- S3：BAT pre.3 × 6.4.0-pre.1：H-12。
- S4：BAT pre.4 × CT 6.3.0（先 `install-630`，跑完 `install-640` 換回）：H-13。
- S2：BAT pre.4，`interactive-prompts: off`：H-14a；H-14c（Codex）環境不具備判「未觸發」。

## 驗收

- [ ] 前置條件（清單與換版工具雜湊、已登入、skills 是 6.4.0-pre.1、兩個 zip 雜湊）
- [ ] S1 / S3 / S4 / S2 依清單跑完（或依用量 PARTIAL，列出未跑項目）
- [ ] 結果寫 `ACC/results-640/`，回報區總表＋ BAT 端重點觀察（含 T0965 / T0968〈待實機〉對照）；CT 端判定欄留空
- [ ] 結束時隔離 skills 是 6.4.0-pre.1；使用者層無變更、安裝版 BAT 未被碰、程序清理
- [ ] 改了 `e2e/manual/` 時 build、兩個 typecheck、`node --check`

---

## 回報區

（Worker 填寫）
