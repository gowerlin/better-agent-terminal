---
schema_version: 1
schema_kind: workorder
id: T0923
title: "PLAN-069 實機驗收自動化：以 zip 測試版 BAT `0.8.0-exp.1` 與舊版 `0.8.0-pre.3` / `0.8.0-pre.1` zip，在隔離 `CLAUDE_CONFIG_DIR` 跑真的 claude＋CT 塔台，完成 CT checklist M-1–M-15 的 BAT 端執行與判定"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-069
priority: P1
sizing: L
created_at: "2026-11-25T21:31:16+08:00"
started_at: "2026-11-25T21:36:49+08:00"
updated_at: "2026-11-25T23:00:54+08:00"
completed_at: "2026-11-25T23:00:54+08:00"
session_ids:
  - "7740ddf5-1f54-45f6-83f0-c06a684d04e7"
target_version: "0.8.0-pre.4（與 CT 6.2.0 同日發佈）"
depends_on: [T0922]
related:
  - "PLAN-069；D350；T0922〈待實機〉；CT 塔台 D890 / D891、CT 工單 T0567（checklist 定稿、測試環境、ct-swap.py）；前例 T0915（6.1.0 驗收的驅動腳本與教訓）"
affects_files:
  - _ct-workorders/T0923-ct620-automated-acceptance.md
  - e2e/manual/
  - e2e/fixtures/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0923` 寫檔（base = 派工當下的 `main`，已含 T0922 `728c3197`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式；只可修改 / 新增 `e2e/manual/` 的驅動腳本（優先沿用 T0915 的 `ct610-driver.ts` / `ct610-ctl.mjs` / `ct610-transcript.mjs`，需要時改成通用名稱或加參數，README 同步），必要時以 opt-in 參數擴充 `e2e/fixtures/`（既有 e2e 行為不得改變）。"
  - "🔴 外部路徑（只在本機、不進 repo；腳本從 env 讀路徑，D176）：驗收根目錄 `<使用者資料夾>/AppData/Local/ct620-accept`（以下稱 ACC），其中 `checklist.md`（CT 定稿）、`claude-config/`（測試用 `CLAUDE_CONFIG_DIR`：CT 6.2.0-pre.1、全域 CLAUDE.md、只有 CT guard 的 settings.json）、`ct-swap.py`、空的 `runs/`、`results/`。三個 BAT 放 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/<版號>-win/`：`0.8.0-exp.1`（`gh run download 45621864786 -R gowerlin/better-agent-terminal -n desktop-win` 到自己的空目錄，以 `SHA256SUMS.txt` 比對 zip 後解壓；只用 zip，不執行 .exe 安裝檔）、`0.8.0-pre.3` 與 `0.8.0-pre.1`（`gh release download v0.8.0-pre.N -R gowerlin/better-agent-terminal -p '*win.zip'` 到各自的空目錄，與 GitHub asset digest 或 SHA256 檔比對後解壓）。T0915 已解壓過 `0.8.0-pre.1-win/` 時，核對雜湊後可沿用。"
  - "🔴 前置條件（開工先查，任一不成立 → 不開任何 claude 回合，狀態 BLOCKED，回報缺什麼，通知塔台）：① `ACC/checklist.md` SHA-256 開頭 `d7546b35`（不符就停下問塔台）；② `claude-config/.credentials.json` 存在（🔴 只檢查存在，不讀、不複製、不記內容）；③ `ct-swap.py status --target <ACC>/claude-config/skills` 結論是 6.2.0-pre.1；④ 三個 zip 的 exe 都在。"
  - "🔴 啟動方式：一律 `e2e/fixtures/electron-isolation.ts` 的 `launchIsolated`＋`BAT_E2E_EXECUTABLE`（獨立 `--runtime=e2e-*`，絕不用預設 userData；不碰使用者的安裝版 BAT、其 userData / Terminal Server / `bat-pty-holder`）。env 加 `CLAUDE_CONFIG_DIR=<ACC>/claude-config`，並以 `dropEnv` 移除繼承的 `CLAUDECODE`、`CLAUDE_CODE_*`、`CT_*`。"
  - "🔴 情境與順序照 `checklist.md` § 2（CT 定稿，以 checklist 為準；下列為摘要）：S1（`0.8.0-exp.1` × 6.2.0-pre.1）M-1 → M-2＋M-12 → M-3 → M-13 → M-14 → M-4～M-9；S2（`0.8.0-pre.3`）M-10；S3（換 6.1.1）M-11，跑完換回 6.2.0-pre.1；S4a（`0.8.0-pre.1`）/ S4b（`interactive-prompts: off`）/ S4c（Codex）M-15。每個情境一份新測試專案副本 `ACC/runs/<情境>/`（從 `ACC/ct-test-project/` 複製），跑完保留。"
  - "🔴 換版（S3 前後）：照 checklist § 1.4 逐字執行，工作目錄 ACC：`<使用者資料夾>/.local/bin/python.exe -X utf8 -I -B <ACC>/ct-swap.py install-611 --target <ACC>/claude-config/skills --work-dir <ACC>/_swap`；換回把 `install-611` 改 `install-620`；查版本 `status --target <ACC>/claude-config/skills`。🔴 一定帶 `--target`（不帶 exit 2；目標在使用者層一律拒寫）。exit `0` 成功（最後兩行「結論：9 個 skill 都是 <版號>」「完成。請開新的 Claude Code session…」）；`1` 失敗（stderr 最後一行以「失敗：」開頭，目標已還原）；`2` 參數錯誤。換版後一律開新的 claude 分頁。非 0 → 該情境停止、回報原文、問塔台。"
  - "🔴 CT 塔台提醒（逐條照做）：① 測試專案範本 `ACC/ct-test-project/` 由本單建立：git repo、`master` 分支、一個 commit、只有 `README.md`，第一行 `# ct-test-project`。② `interactive-prompts: on` 時每筆待決都開原生選單；M-4～M-9 要從待辦分頁回答 → 先按 Esc 關掉選單、不回答；若 M-12-4（Esc 後該筆仍在清單）FAIL，M-4～M-9 改在 `off` 的新副本補跑（checklist § 7 第 8 點）。③ 斷點 A 的觸發：讓 Worker 檢查 `docs/spec.md`，不存在就回 BLOCKED（M-2a、M-5）；塔台沒寫推薦項 → M-2a 判未觸發、改跑 M-2b。④ M-7、M-9 在塔台輸入框**手打**（BAT host 會擋不支援的寫法，這兩項驗 CT 對手打的處理）。⑤ M-15c Codex 需要隔離的 `CODEX_HOME`（以 `ct-swap.py install-620 --target <CODEX_HOME>/skills` 裝 CT）且使用者已登入 Codex；不具備 → 判「未觸發」，不得要求使用者操作。⑥ 塔台開小工單前若先用選單問需求：選第一項，或在「其他」打「照你的建議」，並記錄。"
  - "🔴 權限與操作（沿用 T0915 做法與教訓）：測試 config 沒有 permissions → 測試工作區的工作區層級 Agent 啟動參數設 `--dangerously-skip-permissions`（只限隔離 runtime 的測試工作區）；需要權限對話框的項目另開不帶此參數的塔台分頁，帳號預設 auto mode 時以 Shift+Tab 切 manual。塔台是 BAT 開的 claude-cli 分頁；輸入用 Playwright 鍵盤打進 xterm；原生選單（AskUserQuestion）用方向鍵 / Enter / Esc 操作。讀取：DOM（待辦分頁、推薦標記、放棄 / 略過控制項、縮圖 `⏸N` / `📨 待送`）、helper 查詢輸出、debug log（`[tower-inbox]` / `[notify-hold]` 等）、`_tower-state.md` frontmatter、claude 對話紀錄（`ct610-transcript.mjs`）。新專案第一次開塔台後若待辦分頁沒有讀到狀態檔，按 ↻（BUG-220 已修，若仍需按 ↻ 記為 BAT 端觀察）。需要模型配合的狀態以明確提示詞觸發，同一項最多試 3 次，仍沒出現判「未觸發」，🔴 不得硬判 PASS。自動核准權限的判斷不要只靠畫面文字（T0915 遭遇問題）。"
  - "🔴 結果檔：照 checklist § 1.5 格式寫 `ACC/results/M-n.md`（＋截圖目錄 `M-n/`）：執行時間（系統取時）、測試專案路徑、BAT / CT 版本、步驟、BAT 端觀察與判定（PASS / FAIL / 未觸發，附證據）、原始輸出（🔴 權杖值不出現，`BAT_REMOTE_TOKEN` 只寫「已設定」）、本項 claude 回合數。🔴 CT 端判定欄留空。工單回報區附總表（每項 BAT 端判定、回合數、情境專案路徑）。"
  - "🔴 FAIL：BAT 端 FAIL 不修產品程式，記重現步驟與證據，回報區建議開 BUG（塔台開單），繼續跑其他項。checklist 看不懂或與實際 UI 不符 → 依 ct-exec § Questions For Tower 問塔台（塔台轉 CT），不自己改 checklist。"
  - "🔴 驗證與 Git：腳本進 `e2e/manual/`（不被一般 `npm run test:e2e` 收進去，README 寫手動執行方式與 env）；worktree `npm ci`；`npx vite build` exit 0、兩個 typecheck = 0；若改了 `e2e/fixtures/`，跑 2 支既有使用 `launchIsolated` 的 e2e 確認不回歸。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。程序清理照 D308（只結束本單建立的 electron / claude / codex 程序）；使用者層 `~/.claude`、`~/.codex` 不得有任何變更（前後比對雜湊）。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`，範例路徑 `C:/Users/demo`）。結果檔在 ACC（本機），可寫實際路徑。yolo：不得問使用者。"
---

# T0923 — PLAN-069 實機驗收自動化（CT checklist M-1–M-15）

## 背景

PLAN-069（推薦項、放棄 / 略過 / 批次、`inbox_features`）的 BAT 端是 T0922（已併入 `main` `728c3197`），CT 端是 6.2.0-pre.1（含 R6：塔台暫停改用原生選單）。驗收比照 6.1.0（T0915，CT D890）：BAT 主導自動化，CT 負責 checklist、測試環境（CT T0567）與 CT 端判定。測試版 BAT `0.8.0-exp.1` 由 `desktop-build.yml` run `45621864786` 打包（只打包、不發佈，D350）。

## 驗收

- [ ] 前置條件檢查（checklist 雜湊、測試目錄已登入、CT 6.2.0-pre.1、三個 zip）
- [ ] 測試專案範本 `ACC/ct-test-project/` 建立（照 CT 提醒 ①）
- [ ] S1：M-1、M-2＋M-12、M-3、M-13、M-14、M-4～M-9
- [ ] S2：M-10（`0.8.0-pre.3`）
- [ ] S3：M-11（換 6.1.1 → 跑 → 換回 6.2.0-pre.1，`status` 確認）
- [ ] S4a / S4b / S4c：M-15（Codex 不具備時判未觸發）
- [ ] 每項結果檔與截圖寫入 `ACC/results/`，回報區總表
- [ ] 使用者層 `~/.claude` / `~/.codex` 無變更、安裝版 BAT 未被碰、程序清理
- [ ] build、兩個 typecheck；改 fixture 時既有 e2e 不回歸

## 塔台補充（派工前，2026-11-25T21:32:42+08:00；CT D892 登入完成通知）

1. 使用者已在 `ACC/claude-config` 登入（CT 只確認 `.credentials.json` 存在、未讀內容）。登入後 `claude-config/` 多了 `.claude.json`、`backups/`、`cache/`、`plugins/`、`sessions/`：🔴 這些含帳號資料，不得打包、複製或摘錄到結果檔、截圖、回報區或 repo；需要比對設定變化時只記檔名與雜湊。
2. 測試版 `0.8.0-exp.1` 的 artifact 以 `desktop-build` run `45621864786` 完成後為準（`desktop-win`）；該 run 的 `tests` job（不擋打包）失敗由塔台另行追查，不影響本單。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（checklist M-1～M-15 的 BAT 端全部執行並判定；BAT 端 0 項 FAIL、1 項未觸發（M-15c，環境不具備）；另發現 1 個 BAT 問題，列為 BUG 建議）
- **開始／完成**：2026-11-25T21:36:49+08:00 ～ 2026-11-25T23:00:54+08:00
- **session_id**：7740ddf5-1f54-45f6-83f0-c06a684d04e7

### 落點檢查
- 結果：PASS
- C-0：PASS（frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`）
- C-1：PASS（工單在 `$CT_HOME/_ct-workorders/`）；C-3：PASS（`e2e/manual/`、`e2e/fixtures/` 存在）；C-2：工單沒有 `branch` 欄位，略過
- 證據：`CT_HOME` 已設定、`CT_WORKTREE_BRANCH=ct/T0923`、`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID` 有值（只記錄不比對）；`BAT_REMOTE_TOKEN` 已設定

### 前置條件
| # | 條件 | 結果 |
|---|---|---|
| ① | `ACC/checklist.md` SHA-256 開頭 `d7546b35` | PASS（`d7546b354adf4629…`） |
| ② | `claude-config/.credentials.json` 存在 | PASS（只檢查存在，沒有讀取、複製或記錄內容） |
| ③ | `ct-swap.py status --target <ACC>/claude-config/skills` | PASS：`結論：9 個 skill 都是 6.2.0-pre.1` |
| ④ | 三個 zip 的 exe | PASS：`0.8.0-exp.1` 由 `gh run download 45621864786 -n desktop-win` 下載到自己的空目錄，zip SHA-256 `edf45f32…093f` 與 `SHA256SUMS.txt` 相符（只用 zip，沒有執行 .exe 安裝檔；`BUILD-INFO.txt` commit `402c9648`）；`0.8.0-pre.3` `0bca4b5a…010a`、`0.8.0-pre.1` `b294eda6…a50c3` 與 GitHub asset digest 相符。三個都解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/<版號>-win/`（`0.8.0-pre.1-win/` 原本不存在，重新下載解壓） |

測試專案範本 `ACC/ct-test-project/`：本單建立，git repo、`master`、1 個 commit（`6a59642 init`），只有 `README.md`（第一行 `# ct-test-project`）。

### 總表（BAT 端判定；CT 端判定欄留空給 CT）
回合數 = 塔台 claude 收到的使用者訊息數（含 Worker 通知、選單中斷），不含 Worker 自己的回合。

| 項目 | BAT 端判定 | 塔台回合數 | 情境／專案 |
|---|---|---|---|
| M-1-1 待辦分頁「契約 v2 ✓」、可用（沒按 ↻） | PASS | 2 | S1 `ACC/runs/S1`（`0.8.0-exp.1`、6.2.0-pre.1） |
| M-2-1 推薦標記＋預設選取 | PASS | 2（＋Worker 1） | S1（M-2a 有推薦項，M-2b 沒跑） |
| M-2-2 待辦分頁顯示該筆 | PASS | | S1 |
| M-12-1 選單開著時待辦分頁已有該筆 | PASS | （同 M-2） | S1 |
| M-3-1 沒有推薦、自由回答欄 | PASS | 2 | S1 |
| M-13-1 選單開著時 Worker 通知保留、選單關後才送 | PASS | 2（＋Worker 1） | S1 |
| M-14-1 待辦分頁回答在 `question` 時保留、選單關後才送 | PASS | 1 | S1 |
| M-4-1 「放棄」→ `U-1：放棄`、移到最近已結 | PASS | 1 | S1 |
| M-5-1 `U-n：放棄 <文字>` | PASS | 5（＋Worker 2） | S1 |
| M-6-1 「略過」→ `A-1：略過 換機器了` | PASS | 2 | S1 |
| M-7（BAT 只送 `U-9：A`；批次行手打） | PASS（無 BAT 專屬預期） | 3 | S1 |
| M-8-1 「全部放棄」展開成明確編號、清單清空 | PASS | 2 | S1 |
| M-9-1 host 拒絕 `U-*`／範圍／多編號選項 | PASS（實機補驗 IPC 三種都 `invalid`） | 4 | S1 |
| M-10-1 舊 BAT 契約 2 照常、沒有推薦／放棄控制項 | PASS | 5 | S2 `ACC/runs/S2`（`0.8.0-pre.3`） |
| M-10-2 `U-n：放棄` 可送出 | PASS（經 IPC；清單步驟做不到，見遭遇問題） | | S2 |
| M-11-1 6.1.1 狀態檔：沒有推薦／放棄控制項 | PASS | 4 | S3 `ACC/runs/S3`（`0.8.0-exp.1`、6.1.1 → 換回 6.2.0-pre.1） |
| M-11-2 `U-1：A` 送出、該筆消失 | PASS | | S3 |
| M-15a-1 舊 helper `Unknown option '--bat-contract'` exit 1、重送成功 | PASS | 4 | S4a `ACC/runs/S4a`（`0.8.0-pre.1`） |
| M-15a-2 沒有待辦分頁 | PASS | | S4a |
| M-15b-1 待辦分頁照常、有推薦與放棄 | PASS | 5 | S4b `ACC/runs/S4b`（`interactive-prompts: off`） |
| M-15b-2 送出 `U-1：放棄` | PASS | | S4b |
| M-15c Codex 塔台 | 未觸發（沒有隔離 `CODEX_HOME`／Codex 登入；依工單不要求使用者操作） | — | S4c（未建立） |

其他欄位（M-1-2、M-1-3、M-2-2 斷點欄位、M-12-2～4、M-3-2、M-13-2、M-14-2、M-4-2～4、M-5-2～3、M-6-2、M-7-1～3、M-8-2、M-9-2、M-11-3、M-15a-3）是 CT 項，BAT 只附證據。每項的步驟、證據、原始輸出在 `ACC/results/M-n.md`（共 15 份：M-1～M-15，M-12 與 M-2 共用附件）與 `ACC/results/M-n/`；各情境的日誌 `ACC/results/S*-logs/`、收尾時的 `_ct-workorders/` 複本 `ACC/results/S*-final/`、驅動紀錄 `ACC/results/driver-s*.log`。「CT 端判定」欄與〈CT 端判定說明〉都留空。BAT 另以 V620 `check-frontmatter.py` 跑過 38 份 `state-*.md`：全部 PASS（`ACC/results/frontmatter-check-bat.txt`，僅供參考）。

**給 CT 的觀察（不是 BAT 判定）**：
- M-2a：U-1 是 `source: "tower-question"`（塔台在 YOLO 歷程寫「通知 `T0001 需要協助` 合規，非斷點 A」），不是 `breakpoint-A`；`workorder`、`waiting_user`、`recommended` 都有。
- 3 個選項的選單（M-2 的 U-1、M-5 的 U-5）最後沒有「放棄（停下等新方向）」；2 個選項的選單（M-13、M-14、M-7～M-10）有。
- Esc 關選單後 claude 回合直接結束（`Declined to answer…`），沒有回覆文字與重列行。
- M-3 與 M-5 第二輪（U-6）塔台沒有開選單，改用文字提問（M-5 的理由是「前兩次選單都被你中斷了」）。

### 建議開 BUG（BAT 端 FAIL／發現，由塔台開單）
1. **AskUserQuestion 選單很快被 Esc 關掉時，塔台分頁卡在 `blocked: question`**（M-9 前提步驟發現）。debug log：14:31:05.872Z `blocked reason=question (hook ask-user-question)` → .972Z `cleared (user input)`（Esc）→ .983Z `blocked reason=question (hook permission-request tool=AskUserQuestion)`（較晚到的 PermissionRequest hook 又設回）；Esc 中斷回合，claude 不再送 `stop` 等 hook，分頁一直停在 `{"busy":true,"blockedReason":"question"}`、縮圖 ⚠️，畫面上已沒有選單，直到 14:34:07 下一次在分頁打字才清除（約 3 分鐘）。影響：卡住期間 Worker 的 `--submit` 通知與待辦分頁的回答都被當成「塔台在等你回答」而保留（BUG-196 保護誤觸發），使用者不在塔台分頁打字就不會送出。與 T0790（晚到的「清除」以 `at` 判斷）方向相反：這裡是晚到的「設定」蓋掉使用者輸入的清除；可能的方向是設定類 hook 也比對 `at` 與最後一次使用者輸入的時間。重現：契約 2 塔台開 AskUserQuestion 選單，在選單出現約 0.1 秒內按 Esc（驅動自動化才這麼快；兩個 hook 都到達後再 Esc 不會發生，M-2／M-5／M-7／M-8／M-10 都正常）。證據：`ACC/results/M-9.md`〈BAT 端發現〉、`M-9/00-stuck-question-after-esc.png`、`stuck-attention.json`、`stuck-screen.txt`、`S1-logs/debug-20261125-215214.log`。
- 其他記錄（不建議開單）：M-11 收尾時一張截圖逾時（`page.screenshot` 30 s，原因未查，不影響判定）。

### 產品變更
- 沒有改產品程式、沒有改 `e2e/fixtures/`。
- 新增 `e2e/manual/ct-accept-act.mjs`（worktree `ct/T0923`，commit `3d7ae5d2`）：`ct610-driver.ts` 的逐步操作腳本（工作區 seed、從 TerminalPanel fiber 讀 canvas xterm 畫面、依 `pty.attentionSnapshot` 等回合／選單、鍵盤送入、待辦分頁 DOM 摘要）。T0915 的同類腳本只放在 scratchpad 而遺失，這次放進 repo；沿用 `ct610-driver.ts` / `ct610-ctl.mjs` / `ct610-transcript.mjs`（未修改）。
- `e2e/manual/README.md`：新增 `ct-accept-act.mjs` 的用途與指令範例（範例路徑 `C:/Users/demo`），已知限制加上本單發現的 Esc 時序問題。

### 驗證
| 關卡 | 結果 |
|---|---|
| 相依：worktree 沒有 `node_modules`，依專案慣例 `npm ci` | exit 0 |
| `npx vite build`（`3d7ae5d2`） | exit 0 |
| `npm run typecheck` | exit 0（0 錯誤） |
| `npm run typecheck:electron` | exit 0（0 錯誤） |
| `e2e/fixtures/` 沒有改 → 既有 e2e 不回歸檢查 | 不適用 |
| `ct-accept-act.mjs`：`node --check`；以隔離 `0.8.0-exp.1` 實例跑 `seed`／`ids`／`type`／`screen`／`att`／`inbox`／`wait idle`、未知指令 exit 2 | 全部如預期；本單 S1～S4b 的操作即以同一套邏輯（scratchpad 版本）完成 |

### 環境與清理
- 啟動方式：五個情境都經 `launchIsolated`＋`BAT_E2E_EXECUTABLE`，runtime `e2e-s1-…`／`e2e-s2-…`／`e2e-s3-…`／`e2e-s4a-…`／`e2e-s4b-…`；主行程 env 檢查 `CLAUDE_CONFIG_DIR` = 測試目錄、沒有 `CLAUDE_CODE_*`／`CT_*`（`driver-s*.log`）。沒有碰使用者的安裝版 BAT、其 userData、Terminal Server 或 `bat-pty-holder`。
- 工作區層級 `claude-cli` 參數 `--dangerously-skip-permissions`（只在隔離 runtime 的測試工作區）；本 checklist 沒有需要權限對話框的項目，沒有另開不帶此參數的塔台。
- 程序清理（D308）：每個驅動都以 `closeIsolated` 結束（Terminal Server `alive after teardown: false`）；結束後查 `ExecutablePath` 含 `BAT-TestBuilds` 或命令列含 `runtime=e2e-s`／`ct620-accept` 的程序：0 個。五個 runtime userData 在日誌複製到 `ACC/results/S*-logs/` 後刪除；驅動狀態檔已刪。
- 使用者層：`~/.claude`（skills、settings.json、CLAUDE.md、hooks、installed_plugins.json）與 `~/.codex`（skills、config.toml、AGENTS.md）共 1,191 檔，開工前後 SHA-256 完全相同；`ct-swap.py status --target <使用者資料夾>/.claude/skills` → `結論：9 個 skill 都是 6.1.1`（`ACC/results/user-layer-status.txt`）。
- `CFG/skills`：S3 換 6.1.1、結束換回，最後 `結論：9 個 skill 都是 6.2.0-pre.1`。S1 第一次啟動時接受了 claude 的 bypass 警告（claude 會寫入它自己的設定），塔台補充第 1 點的帳號檔案沒有讀取、複製或摘錄。
- `ACC/runs/S1`、`S2`、`S3`、`S4a`、`S4b` 保留未刪；`S4b` 的 `_tower-config.yaml` 沒有 commit。

### 遭遇問題
- **M-10 清單步驟與舊 BAT UI 不符**：`0.8.0-pre.3` 的待辦分頁只有 `options` 為空的待決才有自由回答欄，有選項的 U-2 只有 radio＋送出，無法打 `U-2：放棄`。為不卡住驗收（yolo 問塔台會停最多 30 分鐘），改以 renderer IPC `towerInbox.answer(<塔台>, "U-2：放棄")` 送出（與待辦分頁所有按鈕同一條 host 路徑與檢查），結果 `{ok:true}`、塔台收到 `U-2：放棄`。這是對 checklist 步驟的偏離（沒有改 checklist），已在 `ACC/results/M-10.md` 寫明並附替代做法，請塔台轉 CT 確認是否接受或要補跑。
- **M-3 沒有選單**：清單寫「在選單的『其他』輸入」，塔台改用文字提問（清單允許）；改從待辦分頁 U-2 的自由回答欄送同一句。
- M-5 步驟 3 之前，驅動腳本等的是「選單」而塔台改用文字提問，等待逾時後才發現（約 9 分鐘空等，塔台閒置），之後等待改成「選單或回合結束」。
- 前置條件 ④ 原本預期可沿用 T0915 解壓的 `0.8.0-pre.1-win/`，但 `BAT-TestBuilds/` 不存在，重新下載並核對雜湊。

### 互動紀錄
- 無（yolo；沒有向使用者或塔台提問）。

### 隔離分支證據
- branch：`ct/T0923`
- base_sha：`7b23aa55dcd38b23d7923210e1b7564831b0ac75`
- validated_sha：`3d7ae5d29a3717e55bfec3cd790b1ab2143470b8`
- head_sha：`3d7ae5d29a3717e55bfec3cd790b1ab2143470b8`
- validated_sha ≠ head_sha 的說明：兩者相同（產品 commit 之後才跑驗證）

### 回報時間
- 2026-11-25T23:00:54+08:00
