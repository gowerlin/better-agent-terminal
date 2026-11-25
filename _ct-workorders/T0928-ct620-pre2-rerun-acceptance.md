---
schema_version: 1
schema_kind: workorder
id: T0928
title: "PLAN-069 補跑驗收：以 zip 測試版 BAT `0.8.0-exp.2`（含 BUG-224 修正）＋ CT 6.2.0-pre.2，跑 CT `checklist-rerun.md` R-1～R-4（S5 / S6），並實機驗證 BUG-224"
type: verification
status: DONE
waiting_user: "U-13"
repo: better-agent-terminal
project: PLAN-069
priority: P1
sizing: M
created_at: "2026-11-25T23:34:04+08:00"
started_at: "2026-11-25T23:41:20+08:00"
updated_at: "2026-11-26T00:24:53+08:00"
completed_at: "2026-11-26T00:24:53+08:00"
session_ids:
  - "e4be1e08-dbe1-4307-a292-43575c80f349"
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
- **狀態**：DONE（R-1～R-4 的 BAT 端全部執行並判定：BAT 端 9 列 PASS、0 FAIL、0 未觸發，其餘是 CT 項；BUG-224 實機 7 回全 PASS）
- **開始／完成**：2026-11-25T23:41:20+08:00 ～ 2026-11-26T00:24:53+08:00
- **session_id**：e4be1e08-dbe1-4307-a292-43575c80f349

### 落點檢查
- 結果：PASS
- C-0：PASS（frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`）
- C-1：PASS（工單在 `$CT_HOME/_ct-workorders/`）；C-3：PASS（`e2e/manual/` 存在）；C-2：工單沒有 `branch` 欄位，略過
- 證據：`CT_HOME` 已設定、`CT_WORKTREE_BRANCH=ct/T0928`、`CT_MODE=yolo`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄不比對）；`BAT_REMOTE_TOKEN` 已設定

### 前置條件
| # | 條件 | 結果 |
|---|---|---|
| ① | `ACC/checklist-rerun.md` SHA-256 開頭 `fdb9525a` | PASS（`fdb9525adcf0d3ef…`） |
| ② | `claude-config/.credentials.json` 存在 | PASS（只檢查存在，沒有讀取、複製或記錄內容） |
| ③ | 換版後 `status --target <ACC>/claude-config/skills` | PASS：換前 `結論：9 個 skill 都是 6.2.0-pre.1`；`install-622` exit 0，最後兩行與清單原文相符；換後 9 列都是 `與 6.2.0-pre.2 來源逐檔相同`、`結論：9 個 skill 都是 6.2.0-pre.2`（`status-before.txt` / `swap-622.txt` / `status-after.txt`） |
| ④ | `0.8.0-exp.2` zip | PASS：`gh run download 45644734317 -R gowerlin/better-agent-terminal -n desktop-win` 到自己的空目錄；zip SHA-256 `fbdfba59…c956` 與 `SHA256SUMS.txt` 相符；`BUILD-INFO.txt` commit `56ca6e66…`、version `0.8.0-exp.2`；解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.0-exp.2-win/`，exe 存在（只用 zip，沒有執行 .exe 安裝檔） |

### 總表（BAT 端判定；CT 端判定欄留空給 CT）
回合數 = 塔台 claude 收到的使用者訊息數（含選單回答、Esc 中斷），不含開塔台與收尾。

| 項目 | BAT 端判定 | 塔台回合數 | 情境／專案 |
|---|---|---|---|
| R-1-1 選單開著時待辦分頁已有該筆 | PASS | 2 | S5 `ACC/runs/S5`（`0.8.0-exp.2`、6.2.0-pre.2、runtime `e2e-s5-1795621976378`） |
| R-1-2 選了放棄 → 該筆從待辦分頁消失 | PASS | | S5 |
| R-2-1 Esc 當下：待辦分頁仍顯示 `U-e`、縮圖狀態正常回復 | PASS | 5 | S5 |
| R-2-2 / R-2-3 | —（CT 項；R-2-3 BAT 觀察：選單照常開） | | S5 |
| R-3-2 待辦分頁該筆是自由回答欄、沒有推薦標記 | PASS | 4 | S5 |
| R-3-1 / R-3-3 | —（CT 項） | | S5 |
| R-4-1 待辦分頁照常顯示 `U-f` | PASS | 9 | S6 `ACC/runs/S6`（`pending_reminder: on-change`，runtime `e2e-s6-1795623311382`） |
| R-4-2 待辦分頁照常顯示 `U-f` | PASS | | S6 |
| R-4-3 待辦分頁多了 `A-g` | PASS | | S6 |
| R-4-0 / R-4-4 / R-4-5 | —（CT 項） | | S6 |

每項的步驟、每則回覆的最後一行、證據在 `ACC/results-rerun/R-n.md` 與 `R-n/`；各情境日誌 `S5-logs/`、`S6-logs/`（debug log、bat-scripts.log、PTY 全文、`ct610-transcript.mjs` 轉出的對話紀錄）、最終 `_ct-workorders/` 複本 `S5-final/`、`S6-final/`、驅動紀錄 `driver-s5.log` / `driver-s6.log`。CT 端判定欄與〈CT 端判定說明〉都留空。

**給 CT 的觀察（不是 BAT 判定）**：
- R-1：選單 4 項＋內建（`A 一（推薦）`、`B 二`、`C 三`、`放棄（停下等新方向）`）；R-2 / R-3 / R-4 的 2 選項選單都是 3 項＋內建，最後一項都是「放棄（停下等新方向）」。
- R-1 `state-after.md`：frontmatter 已無 `awaiting_user`，內文「待你決定」表格列仍是 `| 待你決定 | U-1 |`。
- R-2 步驟 3、R-4 步驟 2 第 1 則的回覆開頭都有「選單剛才被你關掉了…仍然待決」的提醒。
- R-4 步驟 2 第 2、3 則與步驟 4 最後一行沒有重列行；步驟 2 第 1 則、步驟 3、步驟 5 最後一行是重列行（步驟 3、5 兩半都有）。
- BUG-224 的放棄回覆用了「剛才關掉的是 U-n 的選單，你已經在終端回答，所以這筆結案了」這類措辭（`BUG-224/rounds.log`，不屬清單項目）。

### BUG-224 實機
- 結果檔 `ACC/results-rerun/BUG-224.md`：**PASS**（7 / 7 回沒有停在 `question`）。
- S5 專門跑 6 回＋ S6 R-4 步驟 1 共 7 回快速 Esc（`ct-accept-act.mjs fastesc`：選單畫出後 0 ms，或偵測到 question 後立刻 17～81 ms）。其中 6 回打中「`PermissionRequest` 晚於 Esc」的時序，debug log 都是 `kept cleared: hook permission-request tool=AskUserQuestion is of the question the user answered <6～96>ms ago (reported late)`；兩份 debug log 中 `blocked reason=question (hook permission-request …)` 出現 0 次。第 1 回 hook 在 Esc 前就到（`unchanged`），沒打到競態。
- 每回 Esc 後 0.5 s／5 s／回合結束：attention 都沒有 `blockedReason`、縮圖沒有 ⚠️；在這個狀態下從待辦分頁送出放棄，7 次都立即送出（`[notify-hold] sent … reason=none`，「📨 待送」為空）。Worker `bat-notify --submit` 沒有另外實測（本單不派 Worker），它和待辦分頁回答經同一個 `NotifyHoldController` 判斷。
- 反例：每回的下一題照常 `blocked reason=question`；R-2 步驟 2 以一般速度（選單出現約 7 s 後）Esc → 只有 `cleared (user input)`，行為同修正前。
- 建議：BUG-224 可依此實機結果結案（由塔台判斷）。

### 建議開 BUG
- 無（BAT 端 0 FAIL）。
- 其他記錄（不建議開單）：待辦分頁「💬 塔台訊息」第一張卡（開塔台那一回合）摘要只顯示「```」（推測那則訊息以程式碼區塊開頭，未查證；S5 `00b-inbox-startup.png`、`R-1/02-after.png`）；屬顯示細節，請塔台決定是否另記。

### 產品變更
- 沒有改產品程式、沒有改 `e2e/fixtures/`。
- `e2e/manual/ct-accept-act.mjs`（commit `798760b8`）：新增 `menu`（讀出選單的編號選項與反白項）、`pick <label|last>`（方向鍵移到指定選項、重讀畫面確認後 Enter）、`other <text>`（移到內建「Type something.」列逐鍵輸入後 Enter）、`fastesc [sec] [delayMs]`（BUG-224 用：偵測 `question` 後在選單畫出時或立刻以分頁自己的鍵盤輸入送 Esc，印出時間差）；檔頭說明更新。
- `e2e/manual/README.md`：T0928 指令範例（範例路徑 `C:/Users/demo`）與說明；已知限制的 BUG-224 一條改為「`0.8.0-exp.2` 起已修」。

### 驗證
| 關卡 | 結果 |
|---|---|
| 相依：worktree 沒有 `node_modules`，依專案慣例 `npm ci` | exit 0 |
| `node --check e2e/manual/ct-accept-act.mjs`（`798760b8`） | exit 0 |
| `npx vite build`（`798760b8`） | exit 0 |
| `npm run typecheck`（`798760b8`） | exit 0（0 錯誤） |
| `npm run typecheck:electron`（`798760b8`） | exit 0（0 錯誤） |
| 新指令實際使用 | `pick last`（R-1）、`pick A`（R-2）、`other`（R-3）、`menu`、`fastesc` 兩種模式（BUG-224、R-4）都在本單實際執行並達到預期 |

### 環境與清理
- 啟動：兩個情境都經 `launchIsolated`＋`BAT_E2E_EXECUTABLE`（runtime `e2e-s5-…`、`e2e-s6-…`），主行程 env 檢查 `CLAUDE_CONFIG_DIR` = 測試目錄、沒有 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`（`driver-s*.log`）。沒有碰使用者的安裝版 BAT、其 userData、Terminal Server 或 `bat-pty-holder`。
- 工作區層級 `claude-cli` 參數 `--dangerously-skip-permissions`（只在隔離 runtime 的測試工作區）；沒有出現信任資料夾或權限詢問；AskUserQuestion 選單照常出現。
- 程序清理（D308）：兩個驅動都以 `closeIsolated` 結束（Terminal Server `alive after teardown: false`、runtime userData 已刪）；之後查 `ExecutablePath` 含 `BAT-TestBuilds` 或命令列含 `runtime=e2e-s`／`ct620-accept` 的程序：0 個。
- 使用者層：`~/.claude`（skills、settings.json、CLAUDE.md、hooks、installed_plugins.json）與 `~/.codex`（skills、config.toml、AGENTS.md）共 1,191 檔，開工前後 SHA-256 完全相同；`ct-swap.py status --target <使用者資料夾>/.claude/skills` → `結論：9 個 skill 都是 6.1.1`（`results-rerun/user-layer-status.txt`）。
- `CFG/skills` 停在 6.2.0-pre.2（清單沒有要求換回）。`claude-config/` 裡的帳號檔沒有讀取、複製或摘錄；對話紀錄只轉出本單兩個情境的 `projects/<S5|S6>/*.jsonl`（同 T0923 做法）。
- `ACC/runs/S5`、`S6` 保留；`S6/_ct-workorders/_tower-config.yaml` 沒有 commit。結果全部在 `ACC/results-rerun/`，沒有寫進 `ACC/results/`。結果檔掃描沒有 `batcap.` 權杖值。

### 遭遇問題
- `ct-accept-act.mjs menu` 第一次執行 `SyntaxError`（新加的畫面讀取片段結尾少分號），當場修正後重跑；不影響任何判定。
- BUG-224 第 1 回 `PermissionRequest` 在 Esc 之前就到，沒有打到競態；加了 `delayMs -1`（偵測到 question 立刻 Esc）後命中率 4 / 4，「等選單畫出」模式之後也命中 2 / 2。
- 隔離實例的 claude 顯示帳號週用量已 85%（S6 開工時）；本單沒有受影響，但後續若再排實機回合要留意。

### 互動紀錄
- 無（yolo；沒有向使用者或塔台提問）。

### 隔離分支證據
- branch：`ct/T0928`
- base_sha：`50b7cb5c0395694acdf82d76424594bb98c8c52a`
- validated_sha：`798760b86f255443e7558ac78883ad3bca939787`
- head_sha：`798760b86f255443e7558ac78883ad3bca939787`
- validated_sha ≠ head_sha 的說明：兩者相同（產品 commit 之後才跑驗證）

### 回報時間
- 2026-11-26T00:24:53+08:00
