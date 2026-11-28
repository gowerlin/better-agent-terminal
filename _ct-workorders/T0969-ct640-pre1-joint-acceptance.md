---
schema_version: 1
schema_kind: workorder
id: T0969
title: "CT PLAN-022 P2 雙方驗收：BAT `v0.8.1-pre.4`（與 pre.3）× CT 6.4.0-pre.1，跑 CT `checklist-640.md` H-1～H-14（S1→S3→S4→S2）"
type: verification
status: DONE
repo: better-agent-terminal
priority: P1
sizing: L
created_at: "2026-11-28T14:19:41+0800"
updated_at: "2026-11-28T15:04:35+0800"
started_at: "2026-11-28T14:20:53+0800"
completed_at: "2026-11-28T15:04:35+0800"
session_ids:
  - "ead7550d-5656-4665-bf5f-0f4fe5e5d4e5"
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

- [x] 前置條件（清單與換版工具雜湊、已登入、skills 是 6.4.0-pre.1、兩個 zip 雜湊）
- [x] S1 / S3 / S4 / S2 依清單跑完（或依用量 PARTIAL，列出未跑項目）
- [x] 結果寫 `ACC/results-640/`，回報區總表＋ BAT 端重點觀察（含 T0965 / T0968〈待實機〉對照）；CT 端判定欄留空
- [x] 結束時隔離 skills 是 6.4.0-pre.1；使用者層無變更、安裝版 BAT 未被碰、程序清理
- [x] 改了 `e2e/manual/` 時 build、兩個 typecheck、`node --check`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（S1 → S3 → S4 → S2 全部跑完；BAT 端 20 列 PASS、0 FAIL、2 未觸發（H-11-2 permission／elicitation、H-14c Codex，清單與工單事先指定）、1 不適用（H-10-1）；其餘是 CT 項，CT 端判定欄留空）
- **開始／完成**：2026-11-28T14:20:53+0800 ～ 2026-11-28T15:04:35+0800
- **session_id**：ead7550d-5656-4665-bf5f-0f4fe5e5d4e5

### 落點檢查
- 結果：PASS
- C-0：PASS（frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`）
- C-1：PASS（工單在 `$CT_HOME/_ct-workorders/`）；C-3：PASS（`e2e/manual/` 存在）；C-2：工單沒有 `branch` 欄位，略過
- 證據：`CT_HOME` 已設定、`CT_WORKTREE_BRANCH=ct/T0969`、`CT_MODE=yolo`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄不比對）；`BAT_REMOTE_TOKEN` 已設定

### 前置條件
| # | 條件 | 結果 |
|---|---|---|
| ① | `ACC/checklist-640.md`（50592 bytes）SHA-256 開頭 `9c7dd2792c5d5da5`；`ct-swap-640.py` 開頭 `d2d7798df1913117` | PASS（`9c7dd2792c5d5da5…`、`d2d7798df1913117…`） |
| ② | `claude-config/.credentials.json` 存在 | PASS（只檢查存在，沒有讀取、複製或記錄內容）；四個塔台都沒有出現登入提示 |
| ③ | `ct-swap-640.py status --target <ACC>/claude-config/skills` | PASS：exit 0、`結論：9 個 skill 都是 6.4.0-pre.1`（`results-640/status-start.txt`）；`cfg-640-manifest.sha256` 開頭 `bac3ef004129d025`、`sha256sum -c --quiet` exit 0 |
| ④ | 兩個 zip | PASS：`gh release download v0.8.1-pre.4 / v0.8.1-pre.3 -R gowerlin/better-agent-terminal -p '*-win.zip'` 到各自新建的空目錄；SHA-256 `a475808e…9f68`、`992e9c78…0aad` 與工單相符；解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.4-win/`、`…/0.8.1-pre.3-win/`（兩個都是新解壓），exe 存在，`resources/package.json` 版號 `0.8.1-pre.4` / `0.8.1-pre.3`（沒有執行 .exe 安裝檔） |

### 總表（BAT 端判定；CT 端判定欄留空給 CT）
回合數 = 塔台 claude 收到的使用者訊息數（含選單作答、使用者 Esc、BAT 送的回答、Worker 通知），不含開塔台與設 yolo（H-1 例外）。

| 項目 | BAT 端判定 | 塔台回合數 | 情境／BAT／CT |
|---|---|---|---|
| H-1-1 待辦分頁照常、`menu_open` 不存在時不代按 Esc | PASS | 2 | S1／pre.4／6.4.0-pre.1 |
| H-1-2、H-1-3 | —（CT 項；`CF` 已代跑 exit 0） | | S1 |
| H-2-1 單題 `menu_open` → 提示行 | PASS | 2 | S1 |
| H-2-2 | —（CT 項） | | S1 |
| H-2-3 一次 Esc → 送 `U-1：B` | PASS | （同 H-2） | S1 |
| H-3-1 兩題都有提示行 | PASS | 2 | S1 |
| H-3-2 `U-2` 在 `ids` → 一次 Esc → 送 `U-2：A`，`U-3` 留在待辦分頁 | PASS | （同 H-3） | S1 |
| H-3-3 | —（CT 項） | | S1 |
| H-4-1 沒有選單紀錄 → 直接送、不送 Esc、沒有提示行 | PASS | 1 | S1 |
| H-5-1 新選單只有 `U-6` 有提示行、`U-5` 沒有 | PASS | 3 | S1 |
| H-5-2 | —（CT 項） | | S1 |
| H-5-3 塔台分頁選單作答 → BAT 不介入 | PASS | （同 H-5） | S1 |
| H-10-1 | 不適用 | 1 | S1 |
| H-9-1 使用者 Esc → 選單紀錄關閉、兩題留下、沒有提示行 | PASS | 3 | S1 |
| H-9-2、H-8a | —（CT 項） | | S1 |
| H-6-1 重問 → 新選單紀錄、`U-8` 有提示行 | PASS | 2 | S1 |
| H-6-2 | —（CT 項） | | S1 |
| H-14b-1 只有 `U-11` 有提示行 | PASS | 3 | S1 |
| H-11-1 選單開著時 Worker 通知保留（`question`）、不送 Esc、選單關後才送 | PASS | （同 H-14b） | S1 |
| H-11-2 permission／elicitation | 未觸發（環境：略過權限詢問、沒有 elicitation MCP） | — | S1 |
| H-8b-1 人為殘留：`CF` exit 0、不是 `question` 時沒有提示行 | PASS | 3 | S1 |
| H-7-1 需求對齊選單：保留、不送 Esc（理由 `stale`） | PASS | （同 H-8b） | S1 |
| H-8b-2 選單關閉後送 `U-5：A` | PASS | （同 H-8b） | S1 |
| H-12-1 舊 BAT：兩題照舊、不報錯、沒有提示行 | PASS | 3 | S3／pre.3／6.4.0-pre.1 |
| H-12-2 舊 BAT：保留到使用者 Esc 後送出 | PASS | （同 H-12） | S3 |
| H-13-1 CT 6.3.0：沒有 `menu` → 不讀、沒有提示行、沒有 `answer menu` | PASS | 3 | S4／pre.4／6.3.0 |
| H-13-2 照 T0965：一次 Esc → 送 `U-1：A` | PASS | （同 H-13） | S4 |
| H-13-3 | —（CT 項；`install-630` / `install-640` exit 0、`status` 6.3.0 → 6.4.0-pre.1） | | S4 |
| H-14a-1 `interactive-prompts: off`：沒有選單紀錄 → 直接送、沒有提示行 | PASS | 2 | S2／pre.4／6.4.0-pre.1 |
| H-14c-1 Codex 塔台 | 未觸發（環境：沒有隔離的 `CODEX_HOME`＋CT 6.4.0-pre.1＋登入；工單指定） | 0 | — |

每項的步驟紀錄、證據在 `ACC/results-640/H-1.md`～`H-14.md`（14 份；H-8 含 H-8a／H-8b，H-14 含 a／b／c）與 `H-n/`；各情境日誌 `S1-logs/`～`S4-logs/`（PTY 全文、debug log、bat-scripts.log、`ct610-transcript.mjs` 轉出的對話紀錄）、最終 `_ct-workorders/` 複本 `S1-final/`～`S4-final/`、`S1-final-state.md`；狀態檔每次寫入 `S1-writes/`（60 份）、`S2-writes/`～`S4-writes/`（共 41 份）；驅動紀錄 `driver-s1.log`～`driver-s4.log`；全部狀態檔快照的 `CF` 結果 `cf-all.txt`（138 份，4 份 exit 1，見〈給 CT 的觀察〉1）。CT 端判定欄與〈CT 端判定說明〉都留空。

### BAT 端重點（T0965 / T0968〈待實機〉、A-26）
1. **選單開著時從待辦分頁回答**（H-2、H-3、H-5）：畫面「✓ 已排入待送：U-n：…」（`held`）→ BAT 送**一次** Esc → `menu esc answered … (the menu closed)` → `[blocked] … question menu closed (BAT Esc)` → 約 1 s 後送 `U-n：…`＋Enter；塔台收到的使用者訊息逐字就是 `U-1：B`／`U-2：A`／`U-4：A`（對話紀錄），**Esc 後 claude 輸入框是空的**，沒有前一則提示被放回輸入框。Esc 到送出約 1.0～1.1 s。
2. **選單開著時 PTY 是否持續輸出**：H-2、H-3 各出現一次 `menu esc waits … (output)`，約 0.9 s 後就送 Esc（`(question)`）；H-5 沒有 `waits`、立即送。選單本身沒有持續重畫，沒有「一直等輸出安靜」的情況。
3. **不在 `menu_open.ids` 的回答**：H-7 的需求對齊選單（不含 `U-n`）開著時，待辦分頁回答 U-5（人為殘留 `menu_open` 裡的題，`opened_at` 早 1 小時）→ `menu esc skipped … (stale; held until the menu closes)`、不送 Esc，選單作答關閉後才送出。`not-in-menu`、`no-menu-open` 這次沒有實機觸發（塔台開對齊選單前沒有寫檔，所以讀到的是 `stale`；清單 H-7-1 兩者都算 PASS）。`A-n` 不在本清單。
4. **提示行**「塔台正以選單詢問此題：在這裡回答會先關掉選單」：H-2、H-3（兩題）、H-5（只有新題 U-6）、H-6（重問的 U-8）、H-14b（只有選單題 U-11）都正確；使用者 Esc 後（H-9）、選單關閉後（H-3 之後）、塔台不是 `question` 時（H-8b-1）都消失。例外見〈建議開 BUG〉。
5. **降級**：舊 BAT pre.3 × CT 6.4.0-pre.1（H-12）兩題照舊、不報錯、沒有提示行；回答 `held`（`question`），沒有代按 Esc，使用者 Esc 後約 1 s 送出，**沒有**卡在「📨 待送」（BUG-235 沒出現，沒按「立即送出」）。新 BAT × CT 6.3.0（H-13）沒有 `menu` → 不讀 `menu_open`、沒有提示行、日誌沒有 `answer menu`，照 T0965 代按 Esc 後送出（`U-1：A`、之後的 `U-2：放棄` 都是）。
6. **日誌摘要**（權杖與回答內容以外的使用者資料沒有貼）：S1 依序 `answer menu … menu_open=U-1` → `menu esc answered` ×1；`menu_open=U-2,U-3` → ×1；`menu_open=none`（H-4，直接 `sent … reason=none`）；`menu_open=U-4,U-5` → ×1；`question menu closed (user Esc)`（H-9）；`menu_open=U-5` → `menu esc skipped … (stale…)`（H-7）；`menu_open=none`（收尾的「全部放棄」）。Worker 通知（H-11）：`held … source=sim-worker-T9999 reason=question` ×2（text／enter），整段沒有 `menu esc`，選單作答、輸出安靜後才 `sent`。
7. **Worker 通知的模擬方式**（H-11）：renderer `pty.create` 開一個帶 `BAT_TOWER_TERMINAL_ID` 的 PTY（主行程發 worker 權杖），在裡面執行測試版自己的 `bat-notify.mjs --submit`，路徑與真 Worker 相同；寫進 `e2e/manual/README.md`。

### 建議開 BUG
- BAT 端 0 FAIL。
- 建議（請塔台判斷）：**提示行不看 `opened_at`**。H-7 的需求對齊選單開著時，待辦分頁的 U-5 顯示「塔台正以選單詢問此題：在這裡回答會先關掉選單」（殘留 `menu_open.ids` 含 U-5＋分頁是 `question`），但這個選單不是 U-5 的，BAT 實際判 `stale`、不會關選單（`H-7.md` 備註 1、`03-inbox.png`）。這符合 docs `tower-inbox.md`「提示行」的寫法（renderer 不知道選單紀錄的開始時間），但文字與行為不一致。CT 6.4.0 正常流程下只有「使用者 Esc 後、塔台下一次寫入前就開了不含 `U-n` 的選單」或人為殘留才會遇到。可考慮讓提示行也比對選單紀錄的開始時間（主行程已有 `questionMenuOpenedAt`）。

### 給 CT 的觀察（不是 BAT 判定）
1. **`menu_open` 與 `awaiting_user` 不是同一次寫入**（H-9、H-14b）：塔台先寫 `menu_open`、再分幾次 Edit 補 `awaiting_user`，中間有兩份快照 `CF` exit 1（`v2-menu-open`：ids 要在 `awaiting_user`）：`S1-writes/032-143457.md`、`033-143458.md`（H-9）、`045-143913.md`、`046-143914.md`（H-14b）。選單打開時的最終狀態都 exit 0。對照 `MP:379-380`「開選單前同一次寫入」。H-2、H-3、H-5、H-6 沒有這個現象。
2. 設 yolo（H-1）那個回合沒有寫狀態檔：`state-yolo.md` 與 `state-startup.md` 相同（清單 H-1-2 寫「設 yolo 後那次寫入」）。
3. H-3、H-12 的確認行與提醒順序：S1（H-3）確認行在前、提醒在後；S3（H-12）提醒在第一行、確認行在第二行（清單 H-3-2 寫「回覆**開頭**提醒」）。
4. H-7 塔台在需求對齊選單的題目裡提到它看到外部寫入的 `menu_open`（U-5，13:41）。
5. H-13（CT 6.3.0）塔台處理 U-1 後重開了只有 U-2 的選單，題目開頭帶「剛才的回答」與 Esc 提醒（只記錄）。
6. H-14a 塔台回覆另外建議「要測原生選單先 `*config interactive-prompts on`」。S4 塔台有一句英文進度行（`Wrote U-1 and U-2 to awaiting_user; check passed…`）。

### 產品變更
- 沒有改產品程式、沒有改 `e2e/fixtures/`。
- `e2e/manual/ct-accept-watch.mjs`（新）：每 100 ms 讀狀態檔，內容變了且 40 ms 後再讀相同才存 `<seq>-<HHMMSS>.md`，有 `menu_open` 的寫入在輸出行標出；只讀原檔。
- `e2e/manual/ct-accept-act.mjs`：`inbox` 每筆待決多印 `menuHint`（T0968 提示行）與 `sent`（已送出標記狀態）。
- `e2e/manual/README.md`：T0969 段（監看腳本用法、選單開著時擷取狀態檔、模擬 Worker 通知的做法、收合右側欄的「待辦」按鈕 selector）。
- commit `6d171c6e0ad58d315911eb577dfa56c5cc220859`（`ct/T0969`）。

### 驗證
| 關卡 | 結果 |
|---|---|
| 相依：worktree 沒有 `node_modules`，依專案慣例 `npm ci` | exit 0 |
| `node --check e2e/manual/ct-accept-act.mjs`、`ct-accept-watch.mjs`（`6d171c6e`） | exit 0 |
| `npx vite build`（`6d171c6e`） | exit 0 |
| `npm run typecheck`（`6d171c6e`） | exit 0（0 錯誤） |
| `npm run typecheck:electron`（`6d171c6e`） | exit 0（0 錯誤） |
| 監看腳本實際使用 | S1～S4 全程執行，共 101 份寫入快照；`inbox` 的新欄位在 commit 前用 DOM 查詢等效驗證（`[data-inbox-menu-hint]`、`[data-inbox-sent-status]`），commit 後沒有再開實例實跑 |

### 環境與清理
- 啟動：四個情境都經 `launchIsolated`＋`BAT_E2E_EXECUTABLE`（runtime `e2e-640-s1-1795847070134`、`e2e-640-s3-1795848315588`、`e2e-640-s4-1795848580903`、`e2e-640-s2-1795848838876`；驅動固定加時間後綴），主行程 env：`CLAUDE_CONFIG_DIR` = 測試目錄、沒有 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`。S2 另開新實例。工作區層級 `claude-cli` 參數 `--dangerously-skip-permissions` 只在測試工作區；沒有權限詢問；AskUserQuestion 照常出現。塔台分頁以「以塔台開啟 Claude」開啟（pre.3 / pre.4 都把 `/control-tower` 放在啟動參數）。
- 驗收期間沒有點塔台終端：鍵盤輸入都經 xterm `focus()`＋Playwright 鍵盤；Esc 各情境只按一次。
- `CFG/settings.json` 沒有動。`claude-config/` 的帳號檔沒有讀取、複製或摘錄；只轉出本單四個情境 `projects/<runs-640-S1|S2|S3|S4>/*.jsonl` 的對話紀錄與 AskUserQuestion 輸入。
- 程序清理（D308）：四個驅動都以 `closeIsolated` 結束（Terminal Server `alive after teardown: false`、runtime userData 已刪）；之後查 `ExecutablePath` 含 `BAT-TestBuilds` 或命令列含 `runtime=e2e-640` / `ct620-accept` / `ct-accept-watch` / `ct610-driver` 的程序：0 個；`%APPDATA%` 下沒有 `BetterAgentTerminal-runtime-e2e-640*`。使用者安裝的 BAT 程序 pid 前後相同（5 個），沒有碰。
- 使用者層：`~/.claude`（skills、settings.json、CLAUDE.md、hooks、installed_plugins.json）與 `~/.codex`（skills、config.toml、AGENTS.md）共 1,199 檔，開工前後 SHA-256 完全相同；`ct-swap-640.py status --target <使用者資料夾>/.claude/skills` → `結論：9 個 skill 都是 6.3.0`（`results-640/user-layer-status.txt`）。
- 隔離 skills：S4 `install-630`（exit 0）→ `install-640`（exit 0），結束時 `結論：9 個 skill 都是 6.4.0-pre.1`、manifest 相符。
- `ACC/runs-640/S1`～`S4` 保留（都沒有 commit；S2 的 `_tower-config.yaml` 沒有 commit）。先前輪次的 `results/`、`results-rerun/`、`results-630/`、`runs/`、`runs-630/` 沒有動。結果檔掃描沒有 `batcap.` 權杖值。

### 遭遇問題
- 右側欄預設收合，`.right-sidebar-tab` 不可見；改點 `.right-sidebar-collapsed-btn[title="待辦"]`（已寫進 README）。
- H-4 步驟 1 的截圖逾時（Playwright `page.screenshot` 30 s），改用同一時點的 DOM 查詢為證；之後的截圖都正常。
- H-7 對齊選單第一次用 `pick 1` 找不到選項（`pick` 是比對選項文字開頭），改按 Enter（第一個選項已反白），不影響判定。
- `swap-630.txt` 末尾曾被我附加一行 exit code，已移到 `swap-exit-codes.txt`，`swap-630.txt` 只留工具原輸出（最後兩行原文相符）。
- 隔離帳號用量沒有碰到上限；四個情境都完整跑完。

### 互動紀錄
- 無（yolo；沒有向使用者或塔台提問）。

### 隔離分支證據
- branch：`ct/T0969`
- base_sha：`4f7effa7c9273e27243d66da5626db93cd3613d3`
- validated_sha：`6d171c6e0ad58d315911eb577dfa56c5cc220859`
- head_sha：`6d171c6e0ad58d315911eb577dfa56c5cc220859`
- validated_sha ≠ head_sha 的說明：兩者相同（commit 後跑關卡）

### 回報時間
- 2026-11-28T15:04:35+0800

## 塔台收單補記

- 2026-11-28 15:05 (UTC+8) 收單：DONE 確認（BAT 端 20 PASS / 0 FAIL / 2 未觸發（指定）/ 1 不適用；`validated_sha` = `head` = `6d171c6e`）。`--close-worker --delay-ms 10000 --worktree keep` exit 0；五條全成立 → 模式 ①：`ct-merge/T0969` = `4867b219`（parent1 `68884995`、parent2 `6d171c6e`，只有 `e2e/manual/` 3 檔）。BUG-236 → CLOSED（交付版雙方驗收）；提示行不看 `opened_at` → BUG-237（low）；斷點 E → U-65、BUG-237 處理 → U-66；通知 CT 塔台開判定單（D496）。
- 2026-11-28 15:09 (UTC+8) U-65：A → 整合分支再合併 `main` 後 ff：`main` = `59e4fbeb`，產品樹 = `6d171c6e`；整合 worktree detach；worktree 移除；分支 `ct/T0969`、`ct-merge/T0969` 保留（D497）。
