---
schema_version: 1
schema_kind: workorder
id: T0939
title: "PLAN-070 雙方驗收：BAT `v0.8.0-pre.8`（與 pre.4）× CT 6.3.0-pre.1，跑 CT `checklist-630.md` M-1～M-17（S1→S3→S2→S4）"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-070
priority: P1
sizing: L
created_at: "2026-11-27T13:04:27+08:00"
updated_at: "2026-11-27T13:56:55+08:00"
started_at: "2026-11-27T13:05:29+08:00"
completed_at: "2026-11-27T13:56:55+08:00"
session_ids:
  - "624b461c-d0ad-48b0-81c6-508859fa2d76"
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

- [x] 前置條件（清單雜湊、已登入、skills 是 6.3.0-pre.1、兩個 zip 雜湊）
- [x] S1 / S3 / S2 / S4 依清單跑完（或依用量 PARTIAL，列出未跑項目）
- [x] 結果寫 `ACC/results-630/`，回報區總表＋ BAT 端重點觀察；CT 端判定欄留空
- [x] 結束時隔離 skills 是 6.3.0-pre.1；使用者層無變更、安裝版 BAT 未被碰、程序清理
- [x] 改了 `e2e/manual/` 時 build、兩個 typecheck、`node --check`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（S1 → S3 → S2 → S4 全部跑完；BAT 端 21 列 PASS、0 FAIL、1 未觸發（M-15c，沒有 Codex 環境，工單事先指定）；其餘是 CT 項，CT 端判定欄留空）
- **開始／完成**：2026-11-27T13:05:29+08:00 ～ 2026-11-27T13:56:55+08:00
- **session_id**：624b461c-d0ad-48b0-81c6-508859fa2d76

### 落點檢查
- 結果：PASS
- C-0：PASS（frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`）
- C-1：PASS（工單在 `$CT_HOME/_ct-workorders/`）；C-3：PASS（`e2e/manual/` 存在）；C-2：工單沒有 `branch` 欄位，略過
- 證據：`CT_HOME` 已設定、`CT_WORKTREE_BRANCH=ct/T0939`、`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄不比對）；`BAT_REMOTE_TOKEN` 已設定
- 工單開工時 `status` 是 `TODO`（不是 `PENDING`），照開工改為 `IN_PROGRESS`

### 前置條件
| # | 條件 | 結果 |
|---|---|---|
| ① | `ACC/checklist-630.md` SHA-256 開頭 `a6b829374ffe29a3` | PASS（`a6b829374ffe29a3add9a8ae…`，370 行） |
| ② | `claude-config/.credentials.json` 存在 | PASS（只檢查存在，沒有讀取、複製或記錄內容）；四個塔台都沒有出現登入提示 |
| ③ | `ct-swap-630.py status --target <ACC>/claude-config/skills` | PASS：exit 0、`結論：9 個 skill 都是 6.3.0-pre.1`（`results-630/status-start.txt`） |
| ④ | 兩個 zip | PASS：`gh release download v0.8.0-pre.8 / v0.8.0-pre.4 -R gowerlin/better-agent-terminal -p '*-win.zip'` 到各自新建的空目錄；SHA-256 `b0cbfd13…8362`、`f424ad6a…0a1d` 都與工單相符；解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.0-pre.8-win/`、`…/0.8.0-pre.4-win/`，exe 存在，`resources/package.json` 版號 `0.8.0-pre.8` / `0.8.0-pre.4`（沒有執行 .exe 安裝檔） |

### 總表（BAT 端判定；CT 端判定欄留空給 CT）
回合數 = 塔台 claude 收到的使用者訊息數（含選單回答、Esc、Worker 通知），不含開塔台與設 yolo（M-1 例外，它就是這兩則）。

| 項目 | BAT 端判定 | 塔台回合數 | 情境／BAT／CT |
|---|---|---|---|
| M-1-1 待辦分頁解析 `inbox_features`（契約 2，整個分頁可用） | PASS | 2 | S1／pre.8／6.3.0-pre.1 |
| M-1-2、M-1-3 | —（CT 項；`CF` 已代跑 exit 0） | | S1 |
| M-2-1 `multi` → 複選框＋「可複選」 | PASS | 3 | S1 |
| M-8-1 A、C 都標推薦並預設勾選 | PASS | （同 M-2） | S1 |
| M-12-0 選單開著時待辦分頁已有該筆 | PASS | （同 M-2） | S1 |
| M-12-1 選單形式 | —（CT 項） | | S1 |
| M-4-1 「其他」與勾選互斥、取消後不恢復推薦 | PASS | （同 M-2） | S1 |
| M-4-2 送出 `U-1：C、B`（依 `options` 順序）、該筆消失 | PASS | （同 M-2） | S1 |
| M-12-2 三筆都是複選框 | PASS | 3 | S1 |
| M-13-1、M-14-1 | —（CT 項；**已觸發**，見觀察 1） | （同 M-12） | S1 |
| M-3-1 斷點單選（radio、其他、放棄…） | PASS | 4 | S1 |
| M-3-2、M-3-3 | —（CT 項） | | S1 |
| M-10-1 送出 `U-5：放棄 <原因>`、placeholder「原因（一行，選填）」 | PASS | （同 M-3） | S1 |
| M-10-2、M-10-3 | —（CT 項） | | S1 |
| M-5-0 五筆複選框、兩筆 radio | PASS | 6 | S1 |
| M-5-1、M-5-2、M-6-1、M-7-1 | —（CT 項） | （同 M-5） | S1 |
| M-11-1 單選題「其他（自由回答）」送出 | PASS | （同 M-5） | S1 |
| M-10-4 多選題放棄送出 `U-10：放棄` | PASS | （同 M-5） | S1 |
| M-9-1 `options` < 2 的 `multi: true` → 單選／自由回答欄、不報錯 | PASS | 2 | S1 |
| M-9-2 自由回答欄「略過 …」出現放棄提示、可送出 | PASS | （同 M-9） | S1 |
| M-16-1 舊 BAT 兩筆照單選顯示、不報錯 | PASS | 4 | S3／pre.4／6.3.0-pre.1 |
| M-16-2 選 A 送出 `U-1：A` | PASS | （同 M-16） | S3 |
| M-16-3 手打 `U-2：A、C` 照常送進塔台 | PASS | （同 M-16） | S3 |
| M-15a-1 `interactive-prompts: off` 時待辦分頁照常複選、A、C 推薦已勾 | PASS | 5 | S2／pre.8／6.3.0-pre.1 |
| M-15a-2、M-15b-1 | —（CT 項） | （同 M-15） | S2 |
| M-15c-1 Codex 塔台 | 未觸發（環境：沒有隔離的 `CODEX_HOME`＋CT 6.3.0-pre.1＋登入；工單指定） | 0 | — |
| M-17-1 沒有 `multi` 旗標 → 畫面同 6.2.x | PASS | 4 | S4／pre.8／6.2.0 |
| M-17-2 旗標缺少時 `multi: true` 仍照單選 | PASS | （同 M-17） | S4 |
| M-17-3 選 A 送出 `U-1：A` | PASS | （同 M-17） | S4 |
| M-17-4 | —（CT 項；換回 exit 0、`status` 6.3.0-pre.1） | | S4 |

每項的步驟紀錄、每則回覆的重點、證據在 `ACC/results-630/M-1.md`～`M-17.md`（17 份）與 `M-n/`；各情境日誌 `S1-logs/`～`S4-logs/`（PTY 全文、debug log、bat-scripts.log、`ct610-transcript.mjs` 轉出的對話紀錄）、最終 `_ct-workorders/` 複本 `S1-final/`～`S4-final/`、驅動紀錄 `driver-s1.log`～`driver-s4.log`、全部狀態檔快照的 `CF` 結果 `cf-all.txt`（35 份 exit 0，只有 M-9 注入那份有 2 個 `v2-multi-ignored` 警告）。CT 端判定欄與〈CT 端判定說明〉都留空。

### BAT 端重點觀察（PLAN-070 子項 4）
- 待辦分頁多選題：`role="group"`＋`data-inbox-multi`＋「可複選」一行、每個選項 checkbox（M-2、M-5、M-12、M-15）。推薦 `A、C` 兩個都標「推薦」並預設勾選（M-8）。「其他」與勾選互斥，取消「其他」後不恢復推薦預設（M-4-1）。送出依 `options` 順序、`、` 連接（M-4-2：`options` 是 A、C、B、D，送 `U-1：C、B`）。
- 大小寫不同的推薦代號（`x1`/`X1`）：這次塔台沒有寫出這種推薦值，實機未觸發；屬 T0938 單元測試範圍（`matchRecommendedCodes`）。
- M-9 手動 `multi: true`＋`options` < 2：1 項畫成 radio、空陣列畫成自由回答欄，都不報錯；自由回答欄輸入「略過 …」出現放棄提示且可送出。
- 降級：舊 BAT pre.4 × 6.3.0-pre.1（M-16）兩筆照單選 radio、推薦 A 預設選取、有「放棄…」、沒有「其他」（pre.4 早於 T0937）；新 BAT × CT 6.2.0（M-17）沒有 `multi` 旗標時畫面同 6.2.x（radio、推薦、其他、放棄），手動加 `multi: true` 仍是單選。

### 給 CT 的觀察（不是 BAT 判定）
1. **M-13 / M-14 實際觸發**：工單與清單預期「這版 claude 做不到勾選＋填其他」，實測 claude 2.1.331 的多選選單可以：「Type something」本身是有勾選框的一列，輸入文字即勾選、與其他勾選並存，確認頁列出 `A 拼字, B 連結, 放棄 先不做`、`B 連結, 另外加一段常見問題`（`M-12/01-menu-2-m13.png`、`01-menu-4-review.png`）。塔台回覆 `U-3 已放棄`（勾選不套用）、`U-4 已收到，當成自由回答`。
2. M-2 確認行寫成 `U-1 已收到：B、C`（BAT 送的是 `C、B`），決策日誌 D001 也記 B、C。
3. M-5：五行訊息的確認行沒有單獨出現在當回合畫面（塔台同一回合開了 U-10、U-12 的第二個選單），判讀結果在下一次回覆的表格與決策日誌 D006～D010。
4. M-16（S3）塔台有一句回覆是英文（「Two awaiting_user items are written…」）。
5. M-17（6.2.0 塔台）仍以 claude 多選選單（含「放棄」項）問兩筆，但狀態檔沒有 `multi`；回覆說明「CT 目前不認得複選」。
6. M-12 對齊追問：塔台對 U-4 用文字追問，照清單回「照你的建議」後塔台仍請使用者說明，沒有新增待決；本單沒有再回答（不影響判定）。

### 建議開 BUG
- 無（BAT 端 0 FAIL）。
- 記錄（不建議開 BUG，請塔台判斷）：M-3 步驟 5～7，用數字鍵 `0` 關掉 claude 的意見調查列後，BAT 輸入框草稿判斷（T0904 `draft`）把它當成有字，下一則待辦分頁回答以 `reason=draft` 排進「📨 待送」，直到在空輸入框按 Enter 才送出（`[notify-hold] held … reason=draft` → 13:23:46 送出）。回答沒有遺失、有「📨 待送」提示；已寫進 `e2e/manual/README.md`〈已知限制〉。

### 產品變更
- 沒有改產品程式、沒有改 `e2e/fixtures/`。
- `e2e/manual/ct-accept-act.mjs`：`inbox` 每筆待決多印清單種類（`radiogroup` / `group+multi` / `free`）、「可複選」、選項代號與輸入類型、所有推薦標記、勾選、「其他」開關、放棄提示；檔頭說明更新。
- `e2e/manual/README.md`：T0939 段（待辦分頁的 `click` / `fill` 操作範例、claude 多選選單的操作方式、多行訊息用 xterm `paste()`）與〈已知限制〉一條（`draft` 保留）。
- commit `0484e10286ead734a64857f44a21a3c22b39763b`（`ct/T0939`）。原生多選選單用既有 `key` / `ctl type` 操作即可，沒有另加指令。

### 驗證
| 關卡 | 結果 |
|---|---|
| 相依：worktree 沒有 `node_modules`，依專案慣例 `npm ci` | exit 0 |
| `node --check e2e/manual/ct-accept-act.mjs`（`0484e102`） | exit 0 |
| `npx vite build`（`0484e102`） | exit 0 |
| `npm run typecheck`（`0484e102`） | exit 0（0 錯誤） |
| `npm run typecheck:electron`（`0484e102`） | exit 0（0 錯誤） |
| 新的 `inbox` 摘要實際使用 | S1～S4 每一步都用它判讀（含 pre.4 的舊 DOM：沒有 `data-inbox-option-list`，種類顯示 `free`，`options` 欄仍正確顯示 radio，判定以 DOM 原文為準，見 `M-16.md`） |

### 環境與清理
- 啟動：四個情境都經 `launchIsolated`＋`BAT_E2E_EXECUTABLE`（runtime `e2e-630-s1-1795756146859`、`e2e-630-s3-1795757573792`、`e2e-630-s2-1795757938779`、`e2e-630-s4-1795758309726`；驅動固定加時間後綴，不是清單寫的 `e2e-630-s1`），主行程 env：`CLAUDE_CONFIG_DIR` = 測試目錄、沒有 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`。S2 另開新實例（沒有沿用 S1）。工作區層級 `claude-cli` 參數 `--dangerously-skip-permissions` 只在測試工作區；沒有權限詢問；AskUserQuestion 照常出現。
- `CFG/settings.json` 沒有動。`claude-config/` 的帳號檔沒有讀取、複製或摘錄；只轉出本單四個情境 `projects/<S1|S2|S3|S4>/*.jsonl` 的對話紀錄（同 T0923 / T0928）。
- 程序清理（D308）：四個驅動都以 `closeIsolated` 結束（Terminal Server `alive after teardown: false`、runtime userData 已刪）；之後查 `ExecutablePath` 含 `BAT-TestBuilds` 或命令列含 `runtime=e2e-630` / `ct620-accept` 的程序：0 個；`%APPDATA%` 下沒有 `BetterAgentTerminal-runtime-e2e-630*`。沒有碰使用者安裝的 BAT。
- 使用者層：`~/.claude`（skills、settings.json、CLAUDE.md、hooks、installed_plugins.json）與 `~/.codex`（skills、config.toml、AGENTS.md）共 1,193 檔，開工前後 SHA-256 完全相同；`ct-swap-630.py status --target <使用者資料夾>/.claude/skills` → `結論：9 個 skill 都是 6.2.0`（`results-630/user-layer-status.txt`）。
- 隔離 skills：S4 `install-620`（exit 0）→ `install-630`（exit 0），結束時 `結論：9 個 skill 都是 6.3.0-pre.1`（`M-17/status-after.txt`）。
- `ACC/runs-630/S1`～`S4` 保留；`S1`、`S2` 的 `_tower-config.yaml` 沒有 commit（S1 的 T0001 Worker commit `dc691bd` 只含工單檔）。6.2.0 那一輪的 `results/`、`results-rerun/`、`runs/` 沒有動。結果檔掃描沒有 `batcap.` 權杖值。

### 遭遇問題
- 驅動 `fill` 的參數是 `value`（第一次寫成 `text` 填入 `undefined`，當場重填後才送出，不影響判定）。
- M-3：意見調查列的 `0` 造成回答被 `draft` 保留（見〈建議開 BUG〉的記錄），在空輸入框按 Enter 後送出。
- 隔離帳號用量沒有碰到上限；所有情境都完整跑完，沒有用 S4 精簡做法。

### 互動紀錄
- 無（yolo；沒有向使用者或塔台提問）。

### 隔離分支證據
- branch：`ct/T0939`
- base_sha：`e78fa240c1ded4122a224b2f188f37416baa8629`
- validated_sha：`0484e10286ead734a64857f44a21a3c22b39763b`
- head_sha：`0484e10286ead734a64857f44a21a3c22b39763b`
- validated_sha ≠ head_sha 的說明：兩者相同（commit 後重跑四個關卡）

### 回報時間
- 2026-11-27T13:56:55+08:00
