---
schema_version: 1
schema_kind: workorder
id: T0943
title: "PLAN-070 補驗：BAT `v0.8.0-pre.8` × CT 6.3.0-pre.3，跑 `checklist-rerun-630.md` § 5〈pre.3 補驗〉R-2-1～R-2-7（S6，1 個塔台 session）"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-070
priority: P1
sizing: S
created_at: "2026-11-27T15:11:57+08:00"
updated_at: "2026-11-27T15:24:36+08:00"
completed_at: "2026-11-27T15:24:36+08:00"
started_at: "2026-11-27T15:12:58+08:00"
session_ids:
  - "6634695d-3e4f-47c1-84b4-e61c0e5f5ae9"
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

- [x] 前置條件（雜湊、已登入、換到 6.3.0-pre.3、pre.8 exe）
- [x] § 5 跑完（或依用量 PARTIAL）
- [x] 結果寫 `ACC/results-rerun2-630/`，回報區總表；CT 端判定欄留空
- [x] 隔離環境留在 6.3.0-pre.3；使用者層無變更、安裝版 BAT 未被碰、程序清理

---

## 回報區

### 完成狀態
- **狀態**：DONE（§ 5〈pre.3 補驗〉步驟 ①～⑥ 一次跑完，沒有干擾、沒有重試。BAT 端：R-2-2／R-2-5／R-2-6／R-2-7 PASS；R-2-1／R-2-3／R-2-4 清單沒有 BAT 項。CT 端判定欄留空）
- **開始／完成**：2026-11-27T15:12:58+08:00 ～ 2026-11-27T15:24:36+08:00
- **session_id**：6634695d-3e4f-47c1-84b4-e61c0e5f5ae9

### 落點檢查
- 結果：PASS
- C-0：PASS（frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`）
- C-1：PASS（工單在 `$CT_HOME/_ct-workorders/`）；C-3：唯一的 `affects_files` 是工單本身，不適用；C-2：沒有 `branch` 欄位，略過
- 證據：`CT_HOME` 已設定、`CT_WORKTREE_BRANCH=ct/T0943`、`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄不比對）；`BAT_REMOTE_TOKEN` 已設定
- 工單開工時 `status` 是 `TODO`（不是 `PENDING`），照開工改為 `IN_PROGRESS`

### 前置條件
| # | 條件 | 結果 |
|---|---|---|
| ① | `checklist-rerun-630.md` SHA-256 開頭 `07315f82143a212b`；`ct-swap-630.py` 開頭 `878ad2962ae74e93` | PASS（`07315f82143a212b…19bed1`，199 行；`878ad2962ae74e93…add7c`） |
| ② | `claude-config/.credentials.json` 存在 | PASS（只檢查存在）；塔台沒有出現登入提示（Claude Code v2.1.331、Opus 5.5） |
| ③ | 換版 | PASS：`status-before.txt` exit 0、`結論：9 個 skill 都是 6.3.0-pre.2`；`install-633` exit 0，最後兩行「結論：9 個 skill 都是 6.3.0-pre.3」「完成。請開新的 Claude Code session（已開的 session 不會重新載入 skill）。」（`swap-633.txt`，stderr 空）；`status-after.txt` exit 0、9 列都含 `與 6.3.0-pre.3 來源逐檔相同` |
| ④ | pre.8 exe | PASS：`<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.0-pre.8-win/BetterAgentTerminal.exe` 存在，`resources/package.json` 版號 `0.8.0-pre.8` |

### 總表（BAT 端判定；CT 端判定欄留空給 CT）
`<甲>` = U-1、`<乙>` = U-2、`<丙>` = U-3。回合數 4（`/control-tower`、①＋Esc、②＋Esc、④）。

| 項目 | BAT 端判定 | CT 端判定 | 主要證據 |
|---|---|---|---|
| R-2-1 ① 寫入與多選欄位不退步 | —（觀察：待辦分頁 U-1、U-2 複選框＋「可複選」、C 推薦並預設勾選） | | `state-during-menu-1.md`、`inbox-1.json` |
| R-2-2 ② 確認行寫進選單題目、逐筆 | PASS（選單題目開頭「剛才的回答：U-1 已收到：C、A → …；U-2 已收到，當成自由回答 → 讀成 C、A…」，再接 U-3 本題） | | `transcript-excerpt.txt`、`tower-output-menu-2.txt`、`03-menu-丙.png` |
| R-2-3 ② 代號依 `options` 順序 | — | | `transcript-excerpt.txt`、`decision-log.md` |
| R-2-4 ② 自由回答的確認行 | — | | `transcript-excerpt.txt`、`decision-log.md` |
| R-2-5 ② 先移除再寫新題、單選選單 | PASS（選單開著時待辦分頁只剩 U-3，radio） | | `04-inbox.png`、`inbox-during-menu-2.json`、`state-during-menu-2.md` |
| R-2-6 ③ Esc 後題目全文仍看得到 | PASS（`Declined…` 列出含「剛才的回答：」與兩筆確認的題目全文；**換行**成 2 行，沒有截斷） | | `tower-output-2-esc.txt`、`05-declined.png` |
| R-2-7 ④ 回答 `<丙>` | PASS（U-3 從待辦分頁消失） | | `inbox-3.json`、`state-3.md`、`tower-output-3.txt` |

- 結果檔 `ACC/results-rerun2-630/R-2.md`（步驟紀錄、判定、〈BAT 端觀察〉，〈CT 端判定說明〉留空）；附件 `R-2/`；日誌 `S6-logs/`（PTY 全文、debug log、bat-scripts.log、對話紀錄全文轉檔）；最終狀態 `S6-final/`；驅動紀錄 `driver-s6.log`；`status-before.txt`／`swap-633.txt`／`swap-633.exit.txt`／`status-after.txt`／`status-end.txt`／`user-layer-status.txt`。

### 給 CT 的觀察（不是 BAT 判定）
1. 開 U-3 選單的 `AskUserQuestion` 第一題 `question` 全文：`剛才的回答：U-1 已收到：C、A → 補驗甲補驗格式、拼字；U-2 已收到，當成自由回答 → 讀成 C、A（補驗格式、拼字）。U-3（工單：—）補驗丙要選哪一項？（單選）`；選項 `A 一`／`B 二`／`放棄（停下等新方向）`，`multiSelect: false`。
2. 決策日誌 D001 寫 `C、A`（「依 `options` 順序」）；D002 記原文 `U-2：A 和 C`，決定「整段當自由回答……讀成 C、A」；D003 選 A。沒有任何一處寫成 `A、C`。
3. 題目 86 字，在 BAT 塔台分頁 106 欄的選單與 `Declined…` 都換成 2 行完整顯示（給 4 筆門檻參考）。
4. 步驟 ② 那一則回覆選單前沒有助理文字（清單：不列入判定）；步驟 ④ 的回覆第一行即 `U-3 已收到：A → …`，再補述前兩題選單被 Esc 關掉與 U-1、U-2 的讀法。

### 建議開 BUG
- 無（BAT 端沒有發現 BAT 缺陷；本次沒有非驅動的輸入）。

### 產品變更
- 無。沒有改 repo 任何檔（含 `e2e/manual/`）；worktree 只跑 `npm ci` 以取得驅動要的 `tsx` / Playwright（`node_modules` 不進版控），`status --porcelain` 為空。

### 驗證
| 關卡 | 結果 |
|---|---|
| 前置條件 ①～④ | PASS（見上表） |
| § 5 依清單跑完 | 是（步驟 ①～⑥ 一次跑完；用量沒有碰到上限；需要模型配合的狀態都在第一次出現，沒有重試） |
| 狀態檔自檢（6.3.0-pre.3 `check-frontmatter.py`） | `R-2/state-*.md` 5 份、`S6-final/_tower-state.md`、`runs-rerun2-630/S6/_ct-workorders/_tower-state.md` 皆 exit 0 |
| 結果檔權杖掃描 | 沒有 `batcap.`；本分頁 `BAT_REMOTE_TOKEN` 的值也不在 `results-rerun2-630/` 任何檔內 |

### 環境與清理
- 啟動：`launchIsolated`＋`BAT_E2E_EXECUTABLE`，runtime `e2e-630-s6-1795763645720`（驅動固定加時間後綴）；主行程 env：`CLAUDE_CONFIG_DIR` = 測試目錄、沒有 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`。工作區層級 `claude-cli` 參數 `--dangerously-skip-permissions` 只在測試工作區；沒有權限詢問，`AskUserQuestion` 照常出現。新目錄第一次開 claude 有信任資料夾提示，照 `checklist-630.md` § 1.3 選信任。
- `CFG/settings.json` 沒有動；`claude-config/` 的帳號檔沒有讀取、複製或摘錄；只轉出本單 S6 的 `projects/<S6>/577469b4-….jsonl`。
- 程序清理（D308）：`quit` → `closeIsolated`（`Terminal Server pid … alive after teardown: false`、`runtime userData removed: true`、`driver exit 0`）；之後查 `ExecutablePath` 含 `BAT-TestBuilds` 或命令列含 `runtime=e2e-630` / `ct620-accept` 的程序：0 個；`%APPDATA%` 下沒有 `BetterAgentTerminal-runtime-e2e-630*`。沒有碰使用者安裝的 BAT。
- 使用者層：`~/.claude`（skills、hooks、settings.json、CLAUDE.md、installed_plugins.json）與 `~/.codex`（skills、config.toml、AGENTS.md）共 1,193 檔，開工前後 SHA-256 完全相同；`ct-swap-630.py status --target <使用者資料夾>/.claude/skills` → `結論：9 個 skill 都是 6.2.0`（`user-layer-status.txt`）。
- 隔離 skills 留在 6.3.0-pre.3（`status-end.txt`），沒有換回。`results-630/`、`results-rerun-630/`、其他 `runs-*` 沒有動。

### 遭遇問題
- 無阻擋。信任資料夾提示不是編號選單，`pick` 找不到選項，改用 `key ArrowDown`＋`key Enter`（不影響判定）。

### 互動紀錄
- 無（沒有向塔台提問，也沒有使用者輸入）。

### 隔離分支證據
- branch：`ct/T0943`
- base_sha：`b44f790125e489c3e12ed224d69ff0ee418cabaa`
- validated_sha：`b44f790125e489c3e12ed224d69ff0ee418cabaa`
- head_sha：`b44f790125e489c3e12ed224d69ff0ee418cabaa`
- 說明：本單不改產品檔，`ct/T0943` 沒有新 commit（head = base），不需要合併。

### 回報時間
- 2026-11-27T15:24:36+08:00
