---
schema_version: 1
schema_kind: workorder
id: T0941
title: "PLAN-070 補跑驗收：BAT `v0.8.0-pre.8` × CT 6.3.0-pre.2，跑 CT `checklist-rerun-630.md`（S5，1 個塔台 session）"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-070
priority: P1
sizing: S
created_at: "2026-11-27T14:30:52+08:00"
updated_at: "2026-11-27T14:47:10+08:00"
started_at: "2026-11-27T14:31:46+08:00"
completed_at: "2026-11-27T14:47:10+08:00"
session_ids:
  - "ee97e331-c656-49a4-ac62-37ce329cf263"
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

- [x] 前置條件（雜湊、已登入、換到 6.3.0-pre.2、pre.8 exe）
- [x] S5 依補跑清單跑完（或依用量 PARTIAL）
- [x] 結果寫 `ACC/results-rerun-630/`，回報區總表；CT 端判定欄留空
- [x] 隔離環境留在 6.3.0-pre.2；使用者層無變更、安裝版 BAT 未被碰、程序清理

---

## 回報區

### 待塔台決策

#### Q-1：隔離 BAT 視窗疑似被人手動操作，S5 步驟 1～3 被打亂；要怎麼繼續？
- **提問時間**：2026-11-27T14:37:25+08:00
- **現況**：步驟 1 正常（塔台寫 U-1 補驗甲、U-2 補驗乙，`multi: true`、`recommended: "C"`、`options` C／A／B，開了多選選單；證據已存 `R-1/01-menu-*.png`、`02-inbox.png`、`state-during-menu-1.md`）。之後兩個回答**不是驅動送的**（`driver-s5.log` 同時段只有讀取類 op）：
  1. 14:35:35 原生選單的 U-2 被勾滿 C、A、B 並送出（對話紀錄 RESULT `…補驗乙…="C 格式（推薦）, A 拼字, B 連結"`），時間落在驅動點右側欄「待辦」按鈕前後；
  2. 14:36:30 待辦分頁送出 `U-1：C、A、B`（debug log `[tower-inbox] answer … id=U-1 len=9 → sent`，A、B 是驅動沒勾的），塔台已移除 U-1／U-2、決策 D001／D002。
  步驟 3（Esc 不回答）因此做不到。證據 `ACC/results-rerun-630/R-1/incident-1/`。
- **選項**：
  - A：同一個塔台 session 重做步驟 1（同一句提示詞，編號會是 U-3／U-4），之後照清單跑完；結果檔寫明第一次被打斷與證據。請使用者在補跑期間不要操作測試用 BAT 視窗（標題列是 BAT、工作區 S5）。
  - B：關掉這個實例，另建新副本（例：`runs-rerun-630/S5b/`，清單沒寫這個目錄名）重開塔台再跑。
  - 其他。
- **建議**：A。清單只看步驟 4 那一則回覆的時序與代號順序，前面多兩筆已結案的決策不影響判定；B 要偏離清單的目錄名、多一個塔台 session 的用量。
- **影響**：若確實有人在操作視窗，不先告知使用者，步驟 4 的選單也可能再被搶答。
- **阻擋後續步驟**：是（步驟 1 起都要等答覆）。
- （補註，收單時）上面提到的第一次附件 `R-1/01-menu-*.png`、`02-inbox.png`、`state-during-menu-1.md` 已移到 `R-1/incident-1/attempt1/`，原檔名改放第二次（重做）的證據。

### 完成狀態
- **狀態**：DONE（S5 依補跑清單跑完；第一次執行被非驅動的輸入打斷，依塔台 Q-1 答覆 A 在同一個塔台 session 重做步驟 1 後跑完步驟 1～7。BAT 端：R-1-1／R-1-2／R-1-6／R-1-7 PASS；R-1-3 觀察為 FAIL（選單上方沒有逐筆確認行，屬塔台回覆內容、BAT 顯示正常）；R-1-4／R-1-5 無 BAT 項。CT 端判定欄留空）
- **開始／完成**：2026-11-27T14:31:46+08:00 ～ 2026-11-27T14:47:10+08:00
- **session_id**：ee97e331-c656-49a4-ac62-37ce329cf263

### 落點檢查
- 結果：PASS
- C-0：PASS（frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`）
- C-1：PASS（工單在 `$CT_HOME/_ct-workorders/`）；C-3：PASS（唯一的 `affects_files` 是工單本身，不適用）；C-2：沒有 `branch` 欄位，略過
- 證據：`CT_HOME` 已設定、`CT_WORKTREE_BRANCH=ct/T0941`、`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄不比對）；`BAT_REMOTE_TOKEN` 已設定
- 工單開工時 `status` 是 `TODO`（不是 `PENDING`），照開工改為 `IN_PROGRESS`

### 前置條件
| # | 條件 | 結果 |
|---|---|---|
| ① | `checklist-rerun-630.md` SHA-256 開頭 `d8c79dd19dc73707`；`ct-swap-630.py` 開頭 `9da20489947e4c9e` | PASS（`d8c79dd19dc73707…25bc2`，102 行；`9da20489947e4c9e…29ae4`） |
| ② | `claude-config/.credentials.json` 存在 | PASS（只檢查存在）；塔台沒有出現登入提示 |
| ③ | 換版 | PASS：`status-before.txt` exit 0、`結論：9 個 skill 都是 6.3.0-pre.1`；`install-632` exit 0，最後兩行「結論：9 個 skill 都是 6.3.0-pre.2」「完成。請開新的 Claude Code session（已開的 session 不會重新載入 skill）。」（`swap-632.txt`）；`status-after.txt` exit 0、9 列都含 `與 6.3.0-pre.2 來源逐檔相同` |
| ④ | pre.8 exe | PASS：`<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.0-pre.8-win/BetterAgentTerminal.exe` 存在，`resources/package.json` 版號 `0.8.0-pre.8` |

### 總表（BAT 端判定；CT 端判定欄留空給 CT）
`<甲>` = U-3、`<乙>` = U-4、`<丙>` = U-5（重做那次）。回合數見下方說明。

| 項目 | BAT 端判定 | CT 端判定 | 主要證據 |
|---|---|---|---|
| R-1-1 寫入與多選選單 | PASS（待辦分頁 U-3、U-4 複選框＋「可複選」、C 標推薦並預設勾選） | | `02-inbox.png`、`state-during-menu-1.md`、`01-menu-*.png` |
| R-1-2 Esc 後照留 | PASS（Esc 後兩筆仍在） | | `state-1.md`、`inbox-1.json` |
| R-1-3 確認行在選單之前、逐筆一行 | FAIL（觀察：選單上方沒有兩行確認，見〈給 CT 的觀察〉1；BAT 顯示正常） | | `transcript-excerpt.txt`、`03-menu-丙.png`、`tower-output-menu-2.txt` |
| R-1-4 代號依 `options` 順序 | — | | `decision-log.md` |
| R-1-5 自由回答的確認行 | — | | `decision-log.md` |
| R-1-6 先移除再寫新題、單選選單 | PASS（選單開著時只剩 U-5，radio） | | `04-inbox.png`、`state-during-menu-2.md` |
| R-1-7 選 A | PASS（U-5 從待辦分頁消失） | | `inbox-3.json`、`state-3.md` |

- 回合數 5：`/control-tower`、步驟 1 第一次、被他人送出的 `U-1：C、A、B`、步驟 1 重做（Esc 結束）、步驟 4（含步驟 5 的選單回答）。不算被打斷的兩回合是 3＋開塔台，與清單預估的約 4 回合相符。
- 結果檔 `ACC/results-rerun-630/R-1.md`（步驟紀錄、判定、〈BAT 端觀察〉，〈CT 端判定說明〉留空）；附件 `R-1/`；第一次被打斷的證據 `R-1/incident-1/`；日誌 `S5-logs/`（PTY 全文、debug log、bat-scripts.log、對話紀錄全文轉檔）；最終狀態 `S5-final/`；驅動紀錄 `driver-s5.log`；`status-before.txt`／`swap-632.txt`／`status-after.txt`／`status-end.txt`／`user-layer-status.txt`。

### 給 CT 的觀察（不是 BAT 判定）
1. **步驟 4 那一則回覆在開 U-5 選單前沒有輸出任何助理文字**：jsonl 在使用者訊息（14:43:47）到 `AskUserQuestion`（14:44:23）之間只有 thinking 與 Bash／Edit 工具呼叫。畫面上選單上方唯一一行 `● U-3 和 U-4 已記錄為 D003、D004，U-4 我依文字讀成補驗格式與拼字。接著新增 U-5（補驗丙，單選），並開啟選單。 · summary` 是 thinking 區塊（Claude Code 以 `· summary` 顯示），不是回覆文字；`transcript-excerpt.txt` 以 `── THINKING` 標出。U-3、U-4 的逐筆確認行之後的回覆也沒有出現（步驟 5 的回覆只有 `U-5 已收到：A → …`）。
2. 決策日誌：D003（U-3）決定「多選 C、A（手打 A、C，依 `options` 順序記為 C、A）」；D004（U-4）決定「拆開後「和」對不到任何代號 → 依規則整段當自由回答（不是多選）；塔台依文字內容判讀為 C、A」；D005（U-5）選 A。
3. 第一次執行時塔台對 U-2 的原生選單回答與 U-1 的待辦分頁回答都正常處理（`incident-1/`），確認行 `U-1 已收到：C、A、B → …` 出現在那一回合的回覆；不列入判定。

### 建議開 BUG
- 無（BAT 端沒有發現 BAT 缺陷）。
- 記錄：第一次執行被非驅動的輸入打斷（U-2 原生選單在驅動點右側欄「待辦」按鈕的同時被勾滿送出、待辦分頁送出 `U-1：C、A、B`）。驅動同時段沒有對應的按鍵或點擊，研判是有人操作了測試視窗（塔台已請使用者不要操作）；若使用者確認沒有操作，第 1 點（點側欄按鈕時原生選單被送出）才值得另查。

### 產品變更
- 無。沒有改 repo 任何檔（含 `e2e/manual/`）；worktree 只跑 `npm ci` 以取得驅動要的 `tsx` / Playwright（`node_modules` 不進版控），`status --porcelain` 為空。

### 驗證
| 關卡 | 結果 |
|---|---|
| 前置條件 ①～④ | PASS（見上表） |
| S5 依清單跑完 | 是（第一次被打斷，依 Q-1 答覆重做後步驟 1～7 跑完；用量沒有碰到上限） |
| 狀態檔自檢（6.3.0-pre.2 `check-frontmatter.py`） | `R-1/state-*.md` 5 份與 `runs-rerun-630/S5/_ct-workorders/_tower-state.md` 皆 exit 0 |
| 結果檔權杖掃描 | 沒有 `batcap.`；本分頁 `BAT_REMOTE_TOKEN` 的值也不在 `results-rerun-630/` 任何檔內 |

### 環境與清理
- 啟動：`launchIsolated`＋`BAT_E2E_EXECUTABLE`，runtime `e2e-630-s5-1795761183538`；主行程 env：`CLAUDE_CONFIG_DIR` = 測試目錄、沒有 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`。工作區層級 `claude-cli` 參數 `--dangerously-skip-permissions` 只在測試工作區；沒有權限詢問，`AskUserQuestion` 照常出現。
- `CFG/settings.json` 沒有動；`claude-config/` 的帳號檔沒有讀取、複製或摘錄；只轉出本單 S5 的 `projects/<S5>/7d49f3d5-….jsonl`。
- 程序清理（D308）：`quit` → `closeIsolated`（`Terminal Server … alive after teardown: false`、`runtime userData removed: true`、`driver exit 0`）；之後查 `ExecutablePath` 含 `BAT-TestBuilds` 或命令列含 `runtime=e2e-630` / `ct620-accept` 的程序：0 個；`%APPDATA%` 下沒有 `BetterAgentTerminal-runtime-e2e-630*`。沒有碰使用者安裝的 BAT。
- 使用者層：`~/.claude`（skills、hooks、settings.json、CLAUDE.md、installed_plugins.json）與 `~/.codex`（skills、config.toml、AGENTS.md）共 1,193 檔，開工前後 SHA-256 完全相同；`ct-swap-630.py status --target <使用者資料夾>/.claude/skills` → `結論：9 個 skill 都是 6.2.0`（`user-layer-status.txt`）。
- 隔離 skills 留在 6.3.0-pre.2（`status-end.txt`），沒有換回。`results-630/`、`runs-630/` 與 6.2.0 那一輪的結果沒有動。

### 遭遇問題
- 第一次執行被非驅動的輸入打斷（見上），以 Q-1 向塔台提問，依答覆 A 重做。
- `ct-accept-act.mjs ctl` 不接受 `@檔案`，bracketed paste 的 op 改用 `ct610-ctl.mjs @檔案` 送出（不影響判定）。

### 互動紀錄
- [14:37] Q-1: 隔離視窗疑似被手動操作、步驟 1～3 被打亂，要同 session 重做或另開副本 → A（塔台，BAT 問答通道 `q-80274f08-b975ef914c5a4bd0`，14:41 答覆）: 同一個塔台 session 重做步驟 1，前兩筆不算判定；塔台已請使用者不要操作視窗；重做前確認沒有殘留待決；步驟 4 的選單若再被搶答就停下回報 → Action: 確認待辦分頁與狀態檔都沒有待決後重做，第二次沒有再發生非驅動輸入。

### 隔離分支證據
- branch：`ct/T0941`
- base_sha：`3fa1bd854896022caa63eac42d52a96f95ca76de`
- validated_sha：`3fa1bd854896022caa63eac42d52a96f95ca76de`
- head_sha：`3fa1bd854896022caa63eac42d52a96f95ca76de`
- 說明：本單不改產品檔，`ct/T0941` 沒有新 commit（head = base），不需要合併。

### 回報時間
- 2026-11-27T14:47:10+08:00
