---
schema_version: 1
schema_kind: workorder
id: T0915
title: "PLAN-068 實機驗收自動化：用 Playwright 驅動 zip 測試版 BAT（`0.0.0-exp.20`）與舊版 `0.8.0-pre.1` zip，在獨立 `CLAUDE_CONFIG_DIR` 跑真的 claude＋CT 塔台，完成 CT checklist M-C1–M-C7 的 BAT 端執行與判定"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: L
created_at: "2026-11-25T10:07:09+08:00"
started_at: "2026-11-25T10:29:48+08:00"
updated_at: "2026-11-25T12:17:44+08:00"
completed_at: "2026-11-25T12:17:44+08:00"
session_ids:
  - "a6f03733-2119-4c09-af92-33d2de104ccf"
target_version: "0.8.0-pre.3（與 CT 6.1.0 同日發佈）"
depends_on: [T0913]
related:
  - "PLAN-068；D336；T0913〈待實機清單〉M-C1–M-C7；CT 塔台工單 T0561（安裝步驟、ct-swap.py、checklist 定稿）；HANDOVER `_handover-2026-11-25-tower-user-inbox-issue24.md`〈核定紀錄〉"
affects_files:
  - _ct-workorders/T0915-ct610-automated-acceptance.md
  - e2e/manual/
  - e2e/fixtures/
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0915（塔台已預先從 `v0.8.x` `d637350b` 建立分支 `ct/T0915`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0915` 寫檔；開工確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `d637350bd3576e04e272852874d2890200075ef3`，不符就停下問塔台。不 merge / rebase / push、不動 `main` 與 `v0.8.x`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式；只新增 `e2e/manual/` 的驅動腳本，必要時以 opt-in 參數擴充 `e2e/fixtures/`（既有 e2e 行為不得改變）。"
  - "🔴 外部路徑（只在本機、不進 repo；腳本一律從 env 讀路徑，不把家目錄路徑寫進 repo，D176）：驗收根目錄 `<使用者資料夾>/AppData/Local/ct610-accept`（以下稱 ACCEPT），其中 `checklist.md`（CT 定稿，每項的步驟、CT 端預期）、`ct-test-project/`（測試專案原版）、`claude-config/`（測試用 `CLAUDE_CONFIG_DIR`，CT T0561 已裝 CT 6.0.2、全域 CLAUDE.md、CT guard）、`ct-swap.py`（換 CT 版本，指令照 checklist 抄）。測試版 BAT：`<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.0.0-exp.20-win/BetterAgentTerminal.exe`（v0.8.x `d637350b`）。舊 BAT（M-C6）：從 GitHub Release `v0.8.0-pre.1` 下載 `BetterAgentTerminal-0.8.0-pre.1-win.zip`（`gh release download v0.8.0-pre.1 -R gowerlin/better-agent-terminal`；有 SHA256 檔就比對），解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.0-pre.1-win/`（下載檔放自己的空目錄）。"
  - "🔴 前置條件（開工先查，任一不成立 → 不開任何 claude 回合，狀態 BLOCKED，回報缺什麼，通知塔台）：① ACCEPT 的 `checklist.md` 已是 CT 定稿版（每項有「CT 端預期」欄）；② `claude-config/.credentials.json` 存在（🔴 只檢查存在，不讀、不複製、不記內容；不存在 = 使用者還沒登入）；③ `claude-config/skills/` 是 CT 6.0.2（依 checklist 指定的檢查方式）；④ 兩個 exe 都在。"
  - "🔴 啟動方式：一律用 `e2e/fixtures/electron-isolation.ts` 的 `launchIsolated`＋`BAT_E2E_EXECUTABLE`（獨立 `--runtime=e2e-*`，絕不用預設 userData；不碰使用者的安裝版 BAT、其 userData / Terminal Server / `bat-pty-holder`）。env 加 `CLAUDE_CONFIG_DIR=<ACCEPT>/claude-config`；🔴 並且移除繼承的 `CLAUDECODE`、`CLAUDE_CODE_*`（本 Worker 自己的 claude session 變數，否則測試塔台的 claude 會被當成巢狀 session）——以 `launchIsolated` 的 opt-in 參數（例 `dropEnv`）實作，不改其他 e2e 的行為。BAT 的 PTY 繼承主行程 env，所以測試塔台與它派出的 Worker 都用這個 config 目錄。"
  - "🔴 情境與測試專案：每個情境一份新副本 `ACCEPT/runs/<情境>/`（從 `ct-test-project` 複製；情境 = `M-C7`、`M-C1-C5`、`M-C6`），跑完保留不刪。順序：① M-C7 前半（測試版＋CT 6.0.2）→ 依 checklist 呼叫 ct-swap.py 換 6.1.0-pre.1 → M-C7 後半 ② M-C1–M-C5（測試版＋6.1.0-pre.1；M-C5 用同一個 CLAUDE_CONFIG_DIR 從本 worktree 的 marketplace 安裝 `bat-hooks` plugin：`claude plugin marketplace add` / `install`，env 必帶該 CLAUDE_CONFIG_DIR，🔴 使用者層 `~/.claude` 不得有任何變更）③ M-C6（舊 BAT `0.8.0-pre.1` zip＋6.1.0-pre.1）④ 最後依 checklist 把 `claude-config` 還原成 CT 6.0.2（若 checklist 有寫）。"
  - "🔴 操作方式：塔台是 BAT 開的 claude-cli 分頁（以 UI 或 renderer IPC 開，不用 helper 假造）；輸入用 Playwright 鍵盤打進 xterm（真的使用者輸入路徑），半句＝打字不按 Enter；往上捲＝在 xterm 上 `mouse.wheel`。讀取：DOM（縮圖徽章 `CT↑` / `BAT↑` / `🪝✕` / `💬N` / `⏸N` / `📨 待送`、待辦分頁、卡片）、`bat_*` 對應的 helper 查詢輸出、`--set-role` 輸出、debug log（`[tower-cards]` / `[notify-hold]` 等）、bat-scripts.log。每步截圖。需要模型配合才會出現的狀態（權限對話框、> 16 KiB 回覆、awaiting_user 選項）以明確提示詞觸發，同一項最多試 3 次，仍沒出現就判「未觸發」，🔴 不得硬判 PASS。"
  - "🔴 結果檔（ACCEPT/results/，CT 讀）：每項一個 `M-Cn.md`＋截圖目錄 `M-Cn/`，內容：執行時間（系統取時）、測試專案路徑、BAT / CT 版本、步驟、BAT 端觀察與判定（PASS / FAIL / 未觸發，附證據）、helper 與塔台的原始輸出（🔴 權杖值不出現；`BAT_REMOTE_TOKEN` 只寫「已設定」）、本項 claude 回合數。🔴 「CT 端判定」欄留空給 CT 寫。工單回報區附總表（每項 BAT 端判定、回合數、各情境的測試專案路徑）。"
  - "🔴 FAIL 的處理：BAT 端 FAIL 不修產品程式，記重現步驟與證據，在回報區建議開 BUG（塔台開單）；繼續跑其他項。checklist 寫法看不懂或與實際 UI 不符 → 依 ct-exec § Questions For Tower 問塔台（塔台會轉 CT），不自己改 checklist。"
  - "🔴 驗證與 Git：腳本進 `e2e/manual/`（不被一般 `npm run test:e2e` 收進去，寫明手動執行方式與必要 env）；`npx vite build` exit 0、兩個 typecheck = 0；若改了 `e2e/fixtures/`，跑 2 支既有使用 `launchIsolated` 的 e2e 確認不回歸。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。程序清理照 D308（結束前比對自己啟動的 electron / claude 程序，只結束本單建立的）。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（範例路徑 `C:\\Users\\demo`）。結果檔在 ACCEPT（本機），可寫實際路徑。yolo：不得問使用者。"
---

# T0915 — PLAN-068 實機驗收自動化（CT checklist M-C1–M-C7）

## 背景

PLAN-068（契約 v2、待辦分頁、通知保護、回合訊息卡、bat-hooks）已在 `v0.8.x` `d637350b`，測試版 `0.0.0-exp.20` 已打包。T0913 整理出需要真 claude / 真 CT 的待實機項目。使用者要求 CT 塔台那一組（M-C1–M-C7）改成在隔離的免安裝測試版上自動測試；BAT 與 CT 協調後（D336）：BAT 主導執行，CT 負責 checklist、測試環境（CT T0561）與 CT 端判定。測試塔台用獨立 `CLAUDE_CONFIG_DIR`，使用者層的 CT 一直維持 6.0.2。

## 驗收

- [ ] 前置條件檢查（checklist 定稿、測試目錄已登入、CT 6.0.2、兩個 exe）
- [ ] 驅動腳本（`e2e/manual/`，路徑全由 env 提供）
- [ ] M-C7（6.0.2 → 換 6.1.0-pre.1）
- [ ] M-C1–M-C5（6.1.0-pre.1；M-C5 含 bat-hooks plugin 裝在測試 config 目錄）
- [ ] M-C6（舊 BAT `0.8.0-pre.1` zip）
- [ ] 每項結果檔與截圖寫入 `ACCEPT/results/`，回報區總表
- [ ] 使用者層 `~/.claude` 無變更、安裝版 BAT 未被碰、程序清理
- [ ] build、兩個 typecheck；改 fixture 時既有 e2e 不回歸

## 塔台補充（派工前，2026-11-25T10:15:02+08:00；CT T0561 完成通知）

1. **checklist 定稿**：`ACCEPT/checklist.md`（SHA-256 開頭 `54119d74`，塔台已核對；開工時再比對一次，不符就停下問塔台）。分三個情境：**S1** = M-C7、**S2** = M-C1–M-C5、**S3** = M-C6（`0.8.0-pre.1` zip）；每項有 BAT 端預期、CT 端預期（附 V610 檔案與行號）與兩個判定欄。🔴 只填 BAT 端判定欄；CT 端判定欄留空。`checklist-manual.md` 是手動版，不用。情境資料夾用 `runs/S1` / `runs/S2` / `runs/S3`（取代前文的 `M-C7` / `M-C1-C5` / `M-C6` 名稱）。
2. **測試 config**：`ACCEPT/claude-config` 已有 CT 6.0.2 的 9 個 skill、全域 CLAUDE.md、CT guard（`hooks/bash-length-guard.py`，`settings.json` 只有這一個 hook）；沒有憑證、沒有權限設定。🔴 不得把使用者層的任何設定（含 permissions）複製進去。
3. **換版（S1 中途）**：照 checklist § 1.4 逐字執行，工作目錄 `ACCEPT`：
   `<使用者資料夾>/.local/bin/python.exe -X utf8 -I -B <使用者資料夾>/AppData/Local/ct610-accept/ct-swap.py install-610 --target <使用者資料夾>/AppData/Local/ct610-accept/claude-config/skills --work-dir <使用者資料夾>/AppData/Local/ct610-accept/_swap`
   exit `0` 成功（最後兩行「結論：9 個 skill 都是 6.1.0-pre.1」「完成。請開新的 Claude Code session…」）、`1` 失敗（目標自動回原狀）、`2` 參數錯誤。🔴 一定帶 `--target`（不帶 = 改使用者層，絕對禁止）。換版後一律開新的 claude 分頁（已開的 session 不會重新載入 skill）。非 0 → 該情境停止、回報原文、問塔台。
4. **權限**：測試 config 沒有 permissions，claude 會逐次詢問。用 BAT 自己的啟動參數處理：測試工作區的工作區層級 Agent 啟動參數（PLAN-040，`Workspace.agentCustomArgs`；同時套用到 BAT 開的 claude-cli 塔台分頁與該工作區的 helper 派工）設 `--dangerously-skip-permissions`（只限這個隔離 runtime 的測試工作區）。🔴 M-C5 需要塔台停在預設權限模式才會出現權限對話框：該項另開一個不帶此參數的塔台分頁（例如暫時把工作區的 claude-code 參數設成空字串＝覆蓋全域、不加參數），跑完再改回；在回報區寫明實際做法。
5. 每份新的 `runs/S*` 第一次開 claude 可能出現「信任此資料夾」提示：由腳本確認信任（只限 `runs/S*`）。
6. checklist 不依賴 `CLAUDECODE` / `CLAUDE_CODE_*`；session id 那一行、方法論顯示 `none` 都不列入判定。
7. **登入**：開工前提 ② 的 `.credentials.json` 在本段寫入時尚不存在；塔台會在 CT 通知使用者登入完成後才派工，開工仍照前提條件檢查。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（M-C1–M-C7 的 BAT 端全部執行並判定；有 3 項 BAT 端 FAIL、2 項未觸發，依工單規則不修產品程式、改列 BUG 建議）
- **開始／完成**：2026-11-25T10:29:48+08:00 ～ 2026-11-25T12:17:44+08:00
- **session_id**：a6f03733-2119-4c09-af92-33d2de104ccf
- **branch**：`ct/T0915`
- **base_sha**：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`merge-base HEAD v0.8.x` = `d637350bd3576e04e272852874d2890200075ef3`，開工時核對相符）
- **validated_sha**：`4f7484bceb4fac693f0d35fd0285b93bb4d8c146`
- **head_sha**：`4f7484bceb4fac693f0d35fd0285b93bb4d8c146`（產品 commit 之後才跑驗證，兩者相同）

### 落點檢查
- C-0：PASS（frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`）
- C-1：PASS（工單在 `$CT_HOME/_ct-workorders/`）；C-3：PASS（`e2e/manual/`、`e2e/fixtures/` 存在）；C-2：工單沒有 `branch` 欄位，略過
- 證據：`CT_HOME`、`CT_WORKTREE_BRANCH=ct/T0915`、`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID` 有值（只記錄不比對）；`BAT_REMOTE_TOKEN` 已設定

### 前置條件
| # | 條件 | 結果 |
|---|---|---|
| ① | `ACCEPT/checklist.md` 是 CT 定稿 | PASS：SHA-256 `54119d74b4e2…`（與塔台補充第 1 點相符），每項有「CT 端預期」欄 |
| ② | `claude-config/.credentials.json` 存在 | PASS（只檢查存在，沒有讀取內容） |
| ③ | `claude-config/skills/` 是 CT 6.0.2 | PASS：`ct-swap.py status --target …/skills` → `結論：9 個 skill 都是 6.0.2` |
| ④ | 兩個 exe | 測試版 `0.0.0-exp.20-win/BetterAgentTerminal.exe` 存在；舊版依工單從 GitHub Release `v0.8.0-pre.1` 下載 `BetterAgentTerminal-0.8.0-pre.1-win.zip`（放在自己的空目錄 `BAT-TestBuilds/dl-0.8.0-pre.1/`），SHA-256 `b294eda6…a50c3` 與 GitHub asset digest 相符，解壓到 `BAT-TestBuilds/0.8.0-pre.1-win/` |

### 總表（BAT 端判定；CT 端判定欄留空給 CT）
| 項目 | BAT 端判定 | 塔台 claude 回合數 | 情境／測試專案 |
|---|---|---|---|
| M-C7 前半-1 `CT↑`、分頁標題 `!` | PASS | 前半 4 | S1 `ACCEPT/runs/S1`（測試版、CT 6.0.2 → 6.1.0-pre.1） |
| M-C7 前半-1 P-1 toast 每分頁一次 | 未觸發（toast 顯示時腳本沒有擷取到） | | S1 |
| M-C7 前半-2、前半-3、前半-4 | PASS | | S1 |
| M-C7 後半-1、後半-2、後半-3 | PASS | 後半 4 | S1 |
| M-C1-1 `bat-contract: 2`、`hooks: ok (injected, set 2)` | PASS | 2 | S2 `ACCEPT/runs/S2`（測試版、6.1.0-pre.1） |
| M-C1-2 縮圖沒有 `CT↑`／`BAT↑`／`🪝✕` | PASS | | S2 |
| M-C1-2 待辦分頁標頭「契約 2」 | **FAIL**（要手動 ↻） | | S2 |
| M-C2-a 半句不送出、📨「你在輸入」、清空／送出後才送 | PASS | 4（＋Worker 2） | S2 |
| M-C2-b 通知最多等 60 秒、畫面不被拉回底部 | **FAIL**（2 列） | | S2 |
| M-C3-1、M-C3-3 | PASS | 4 | S2 |
| M-C3-2 重列行加亮 | 未觸發（當時沒有待決）；M-C4 補驗 PASS | | S2 |
| M-C4-1～M-C4-6 | PASS | 7 | S2 |
| M-C5-1、M-C5-2、M-C5-4 | PASS | 8（＋Worker 2） | S2 |
| M-C5-3 權限對話框期間通知保留 | PASS（第 2 次觸發；第 1 次未觸發） | | S2 |
| M-C6-1～M-C6-4 | PASS | 4（＋Worker 1） | S3 `ACCEPT/runs/S3`（舊 BAT 0.8.0-pre.1、6.1.0-pre.1） |

每項的步驟、證據、原始輸出在 `ACCEPT/results/M-Cn.md` 與 `ACCEPT/results/M-Cn/`（截圖、`tower-output.txt`＝claude 對話紀錄轉純文字、`set-role.txt`、狀態檔複本、debug log／bat-scripts.log 複本）。結果檔的「CT 端判定」欄與〈CT 端判定說明〉都留空。

### 建議開 BUG（BAT 端 FAIL／發現，由塔台開單）
1. **待辦分頁不會自動讀到新建的 `_ct-workorders/`**（M-C1-2）：新專案第一次開塔台時，`_tower-state.md`（`bat_contract: 2`）寫入 1 分鐘以上，待辦分頁仍是 P-3「找不到 _ct-workorders/_tower-state.md」、標題 `!`，按 ↻ 才變「契約 v2 ✓」。S1 也一樣。讀碼推定原因：`fs:watch`（`electron/handlers/fs.ts`）對不存在的目錄 `fsSync.watch` 丟例外 → 回 `false`，`acquireDirWatch`（`src/stores/ct-dir-watch.ts`）不重試。重現：沒有 `_ct-workorders/` 的專案 → 加工作區 → 開契約 2 塔台 `/control-tower` → 不按 ↻。證據：`results/M-C1/04-inbox.png`、`05-inbox-after-refresh.png`。
2. **claude 全螢幕塔台「往上捲並停住」時閱讀保護只維持 10 秒**（M-C2-b）：claude 2.1.331 塔台在 alt screen（xterm 沒有 scrollback），閱讀信號只有滾輪＋10 s linger；停住超過 10 s 後到達的 Worker 通知直接送出，claude 收到後畫面回到底部。對應 `docs/agent-guide/tower-inbox.md:229` 待實機項目 T-3。證據：`results/M-C2.md` 步驟 b2–b4、`05-scrolled-up.png`、`06-after-send.png`。
3. **排隊的權限詢問期間 `blocked` 被提早清除**（M-C5 過程中發現）：claude 同一回合平行送出多個需要權限的工具呼叫時，3 個 `PermissionRequest` hook 同時到達；使用者回答第一個後 BAT 以「使用者輸入」清除 `blocked`，但 claude 接著顯示「2 of 3」「3 of 3」，hook 不再送 → 縮圖 ⚠️ 消失、通知保護（`permission`）不成立，Enter 可能替使用者回答排隊中的詢問（BUG-196 同類）。證據：`results/M-C5.md`〈BAT 端備註〉、debug log 11:42:51–11:42:55、`06-queued-prompt-2of3.png`、`07-after-2of3.png`。
- 其他記錄（不建議開單、供參考）：Backspace 刪光草稿仍保留通知是文件已知誤判（`tower-inbox.md:175`）；M-C3 有 1 張卡在腳本沒點擊時被標已讀（原因未查明，`results/M-C3.md`）。

### 產品變更（worktree `ct/T0915`，commit `4f7484bc`）
- `e2e/fixtures/electron-isolation.ts`：`launchIsolated` / `isolatedEnv` 加 opt-in `dropEnv`（字串比對名稱、RegExp 比對）；沒帶時 env 組法與原本完全相同。
- `e2e/manual/ct610-driver.ts`：互動式驅動（隔離 BAT＋`CLAUDE_CONFIG_DIR`＋去掉本機 claude session 變數；loopback HTTP＋隨機 secret；鍵盤、點擊、滾輪、DOM、截圖、PTY 擷取、日誌搜尋；輸出遮罩權杖）。
- `e2e/manual/ct610-ctl.mjs`：送一個指令給驅動。`e2e/manual/ct610-transcript.mjs`：claude 對話紀錄轉純文字（`--grep`）。
- `e2e/manual/README.md`：新增上述三支的用途、env、執行方式、指令表、已知限制（範例路徑用 `C:/Users/demo`）。
- 情境中逐步操作用的 shell 腳本（等待回合結束、自動核准權限、送提示）放在本 session scratchpad，沒有進 repo。

### 驗證
| 關卡 | 結果 |
|---|---|
| `npx vite build`（`4f7484bc`） | exit 0 |
| `npm run typecheck` | exit 0（0 錯誤） |
| `npm run typecheck:electron` | exit 0（0 錯誤） |
| 改了 fixture → 既有 e2e 不回歸：`npx playwright test e2e/t0644-open-claude-as-tower.spec.ts e2e/t0562-tower-tab-title.spec.ts`（source build，沒有 `BAT_E2E_EXECUTABLE`） | 2 passed（41.7 s） |
| 驅動本身：`tsc --noEmit --strict … e2e/manual/ct610-driver.ts`、`node --check` 兩支 mjs | exit 0；三個情境實際執行成功 |
| 相依：worktree 沒有 `node_modules`，依專案慣例 `npm ci` 後才跑 | exit 0 |

### 環境與清理
- 使用者層 `~/.claude`：M-C5 plugin 安裝前後檔案雜湊相同（`results/M-C5/user-claude-*.txt`）；驗收結束 `ct-swap.py status`（不帶 `--target`）→ `結論：9 個 skill 都是 6.0.2`（`results/user-layer-status.txt`）。
- 安裝版 BAT 沒有被碰：三個情境都是 `--runtime=e2e-*`（`e2e-mc7-…`、`e2e-mc1-5-…`、`e2e-mc6-…`），主行程 env 檢查 `CLAUDE_CONFIG_DIR` 正確、沒有 `CLAUDE_CODE_*`／`CT_*`。
- 程序清理（D308）：三個驅動都以 `closeIsolated`（回答結束確認＋停 Terminal Server）結束，Terminal Server 確認已結束；結束後查 `ExecutablePath` 含 `BAT-TestBuilds` 或命令列含 `runtime-e2e-mc`／`ct610-accept` 的程序：0 個。三個 runtime userData 在日誌複製到 `results/` 後刪除；驅動狀態檔已刪。
- `CFG/`：依清單換成 6.1.0-pre.1（S1 中途，`results/M-C7/swap.txt` exit 0）；清單 § 2 寫「結束時不必換回 6.0.2」，所以維持 6.1.0-pre.1。M-C5 安裝的 `bat-hooks` plugin 仍在 `CFG/`，其 marketplace 指向本 worktree 路徑（worktree 移除後失效；`CFG/` 是測試專用）。
- `ACCEPT/runs/S1`、`S2`、`S3` 保留未刪。

### 遭遇問題
- M-C5 第一次嘗試時驅動用的自動核准腳本沒偵測到權限詢問（先是以畫面文字判斷被 TUI 重繪洗掉，後是以縮圖 ⚠️ 判斷時遇到上面 BUG 建議 3 的情形），塔台停在權限詢問約 15 分鐘與 10 分鐘；使用者在 12:00 前後詢問「停在這很久對嗎?」，確認是腳本問題後改以 claude 對話紀錄中「沒有結果的工具呼叫」輔助判斷，之後正常。
- 這個 claude 帳號的預設權限模式是 auto mode：M-C5 除了把工作區 `claude-cli` 參數設成空字串（塔台補充第 4 點），還要在塔台按 Shift+Tab 切到 manual mode 才會跳權限詢問。改工作區參數要 reload 渲染程序，會跳 Recovery 提示（選恢復 session）。
- checklist § 1.1 說 `CFG/settings.json` 只有 CT guard；實際上 S1 第一次接受 bypass 警告時 claude 寫入了 `skipDangerousModePermissionPrompt: true`，M-C5 安裝 plugin 時寫入 `extraKnownMarketplaces`／`enabledPlugins`（前後兩份存在 `results/M-C5/`）。`CFG/plugins/` 在開工時已存在（claude 登入時建立）。
- 工單 memory_overrides 第 5 點的情境資料夾名稱已由塔台補充第 1 點改為 `runs/S1`／`S2`／`S3`，照補充執行。

### 互動紀錄
- [10:29] 開工；落點檢查 PASS、前置條件 ①②③ PASS、④ 依工單下載舊版。
- [11:52] 使用者：「停在這很久對嗎?」（附 S2 塔台停在 Read 權限詢問「2 of 3」的截圖）→ 回答：不對，是驅動的自動核准腳本沒偵測到排隊中的權限詢問 → Action：手動核准剩下的詢問、改寫腳本判斷方式，並把該現象列為 BUG 建議 3。

### 相關通過案例判定
- 工單沒有〈相關通過案例〉段落；本單不改產品程式（只新增 `e2e/manual/` 與 fixture 的 opt-in 參數），不適用。
