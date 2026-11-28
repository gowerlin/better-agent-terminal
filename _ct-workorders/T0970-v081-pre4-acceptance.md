---
schema_version: 1
schema_kind: workorder
id: T0970
title: "交付版 `v0.8.1-pre.4` 自動化驗收（A-26）：BUG-235 回答不再卡在待送、草稿在送出時清除、相同回答去重、「Worker 等你」不算回答；以 pre.3 對照"
type: verification
status: DONE
repo: better-agent-terminal
priority: P1
sizing: M
created_at: "2026-11-28T15:14:41+0800"
updated_at: "2026-11-28T15:40:24+0800"
started_at: "2026-11-28T15:15:42+0800"
completed_at: "2026-11-28T15:40:24+0800"
session_ids:
  - "70d05c8f-80ff-42dd-896c-717861b308db"
target_version: "0.8.1-pre.4（已發佈）"
depends_on: []
related:
  - "A-26；BUG-235 / T0964（`user-prompt-submit` 清草稿、`draft set … cause=` 診斷日誌、去重）；T0966（Worker 等你不算回答、保留原因）；BUG-236 已由 T0969 交付版驗收 CLOSED（本單不重驗）；前例 T0955 / T0959（交付版隔離實例）、T0969（ACC 隔離 claude、`e2e/manual/ct-accept-*.mjs`）"
affects_files:
  - _ct-workorders/T0970-v081-pre4-acceptance.md
  - e2e/manual/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0970` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式、不改 `e2e/fixtures/`；只可新增 / 擴充 `e2e/manual/` 的驅動（例：`t0970-v081-pre4-acceptance.ts`），README 同步。"
  - "🔴 使用者已自己裝好 `v0.8.1-pre.4`（安裝版，`C:/Program Files/BetterAgentTerminal`）並在使用中：🔴 不得碰安裝版（不執行、不關閉、不改它的 userData），只用 zip 隔離實例。BAT 測試版：`<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.4-win/` 與 `…/0.8.1-pre.3-win/`（T0969 已解壓；開工核對 exe 存在與 `resources/package.json` 版號，不符或不存在就照 T0969 方式從 Release 下載：pre.4 zip SHA-256 `a475808e852bd1f08ad1203ada57fbefe2c1cab23efa5a5945d75a759b149f68`、pre.3 `992e9c78515c71cc841ee736e59498a5070264c5e6ce9b91fd1eacb1282b0aad`）。"
  - "🔴 claude：沿用 T0969 的 ACC 隔離設定（`CLAUDE_CONFIG_DIR=<使用者資料夾>/AppData/Local/ct620-accept/claude-config`，已登入；skills 是 CT 6.4.0-pre.1；開工只檢查 `.credentials.json` 存在、不讀不複製；帳號檔不得讀取、複製或摘錄）。BUG-235 的修正靠真 claude 的 `user-prompt-submit` hook，所以要真 claude；測試專案副本放 `ACC/runs-t0970/<情境>/`、結果與證據放 `ACC/results-t0970/`（ACC 先前輪次的目錄只讀不動）。啟動與環境：同 T0969（`launchIsolated`＋`BAT_E2E_EXECUTABLE`、獨立 `--runtime=e2e-t0970-*`、`dropEnv` 移除 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`、工作區層級 `--dangerously-skip-permissions` 只限測試工作區）。"
  - "🔴 情境（每項 pre.4 必跑；標「對照」的 pre.3 也跑，用來確認情境能分辨修正前後）：R1（BUG-235 基本）契約 2 塔台（「以塔台開啟 Claude」、`_tower-state.md` 有 `bat_contract: 2` 與 `awaiting_user` U-1）回合結束、閒置、沒有對話框 → 從待辦分頁回答 `U-1：A` → 預期立即送出（日誌 `answer … (sending)` / `sent … reason=none`，沒有 `held … reason=draft`），塔台收到 `U-1：A`。R2（BUG-235 修正路徑，對照）在 claude 啟動、`/control-tower` 啟動參數的回合送出**之前**按一個會被判成草稿的鍵（例 ↑ 或 Tab，以不改變 claude 輸入結果為準），等回合結束 → 待辦分頁回答 → pre.4 預期立即送出（日誌有 `draft set … cause=<類別>` 再被 `user-prompt-submit` 清掉），pre.3 預期 `held … reason=draft` 卡在待送（記錄、60 s 後按「立即送出」收尾）。若找不到能在 pre.3 重現的按鍵，寫明試過的鍵與日誌、判「對照未重現」，pre.4 的結果照實判定。R3（真草稿仍保留）在塔台輸入框打 `abc` 不送出 → 回答 → `held`（「已排入待送」＋保留原因「你在輸入」），再按一次同一個回答 → 待送仍 1 筆（日誌 `answer duplicate`）；清掉輸入（Ctrl+U 或刪除）後 Enter 不送出任何內容的做法依 claude 行為選，確認回答之後送達且只送一次。R4（T0966）R3 保留期間：「👷 Worker 等你」不列塔台分頁、待辦分頁標題數字不因這筆回答增加；縮圖「📨 待送 1」與「立即送出 / 取消」照舊。R5 日誌：`[notify-hold] draft set … cause=… bytes=…` 不含按鍵內容；整段日誌不含回答內容以外的使用者資料、不含權杖值。"
  - "🔴 模型配合與用量：同一項需要模型配合的狀態最多試 3 次，仍沒出現判「未觸發」，不得硬判 PASS。碰到用量上限：立即停止開新回合，已完成的照常寫結果，回 PARTIAL 並列出未跑項目。"
  - "🔴 結果：回報區總表（R1–R5 × pre.4 / pre.3：PASS / FAIL / 未觸發 / 對照未重現，附證據位置）、每項的日誌摘要與截圖、A-26 是否可判完成的建議（`A-26` 的定義：塔台閒置時從待辦分頁回答立即送出、不卡待送）。FAIL 不修產品程式，記證據、建議開 BUG。"
  - "🔴 驗證與 Git：改了 `e2e/manual/` 時 `node --check`（.mjs）；worktree `npm ci`、`npx vite build` exit 0、兩個 typecheck = 0。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。程序清理照 D308（隔離實例 `closeIsolated`、Terminal Server 不殘留）；使用者層 `~/.claude`、`~/.codex` 前後雜湊相同；安裝版 BAT 程序 pid 前後相同、未被碰。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。結果檔在 ACC（本機）可寫實際路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE` / `PARTIAL`（L177）。"
---

# T0970 — 交付版 `v0.8.1-pre.4` 自動化驗收（A-26）

## 背景

`v0.8.1-pre.4`（D494）含 BUG-235（T0964：待辦分頁的回答在塔台閒置時被判成草稿、卡在待送）、BUG-236（T0965 / T0968，已由 T0969 交付版雙方驗收 CLOSED）、T0966（「Worker 等你」不算回答）。使用者已裝好 pre.4，要求派單自動驗收 A-26，比照 T0955 / T0959 以交付版隔離實例驗收。BUG-235 的實際觸發來源未確定，修正是「契約 2 claude 塔台收到 `user-prompt-submit` 時清掉送出前的草稿」，所以 R2 以「送出前按鍵」重現並以 pre.3 對照。

## 範圍

- R1–R5（見 frontmatter）：pre.4 全跑，R2 以 pre.3 對照。
- 可新增 `e2e/manual/` 驅動。

## 不做

- 不改產品程式；不碰安裝版 BAT；不重驗 BUG-236；不發版。

## 驗收

- [x] 前置（兩個測試版 exe 版號、ACC 已登入）
- [x] R1–R5 結果總表與證據；R2 pre.3 對照
- [x] A-26 判定建議
- [x] 使用者層無變更、安裝版 BAT 未被碰、程序清理
- [x] 改了 `e2e/manual/` 時 build、兩個 typecheck、`node --check`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（R1–R5 全部跑完；pre.4：R1 / R3 / R4 / R5 PASS，**R2 FAIL**；pre.3 R2 對照重現。BUG-235 的修正沒有涵蓋「啟動參數回合送出前的草稿」，建議 BUG-235 退回 FIXING 或另開 BUG，見〈A-26 判定建議〉）
- **開始／完成**：2026-11-28T15:15:42+0800 ～ 2026-11-28T15:40:24+0800
- **session_id**：70d05c8f-80ff-42dd-896c-717861b308db

### 落點檢查
- 結果：PASS
- C-0：PASS（frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`）
- C-1：PASS（工單在 `$CT_HOME/_ct-workorders/`）；C-3：PASS（`e2e/manual/` 存在）；C-2：工單沒有 `branch` 欄位，略過
- 證據：`CT_HOME` 已設定、`CT_WORKTREE_BRANCH=ct/T0970`、`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄不比對）；`BAT_REMOTE_TOKEN` 已設定

### 前置條件
| 條件 | 結果 |
|---|---|
| 測試版 exe | PASS：`<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.4-win/BetterAgentTerminal.exe`、`…/0.8.1-pre.3-win/…` 都存在，`resources/package.json` 版號 `0.8.1-pre.4` / `0.8.1-pre.3`（T0969 解壓的，沿用；沒有重新下載、沒有執行安裝檔） |
| ACC 已登入 | PASS：`claude-config/.credentials.json` 存在（只檢查存在，沒有讀取、複製）；5 個塔台都沒有登入提示 |
| skills | 隔離 skills 是 CT 6.4.0-pre.1（塔台面板與 `ct_version: "6.4.0-pre.1"`） |

### 做法
- 五個隔離實例，都經 `ct610-driver.ts`（`launchIsolated`＋`BAT_E2E_EXECUTABLE`、`--runtime=e2e-t0970-<情境>-<時間>`、`dropEnv`、`CLAUDE_CONFIG_DIR=<ACC>/claude-config`）；每個情境一份新副本 `ACC/runs-t0970/<A|B|B2|B3|C>/`（`ct-test-project` 複製，加 `_ct-workorders/_tower-config.yaml` 的 `interactive-prompts: off`，避免原生選單干擾回答）。
- 塔台以「以塔台開啟 Claude」開啟（`/control-tower` 在啟動參數），新資料夾先過 claude 的信任對話框（↓＋Enter）。
- `awaiting_user` U-1 / U-2（「A 收到 / B 也收到」，不需後續動作）在開工回合結束後由腳本寫進狀態檔 frontmatter（`check-frontmatter.py` PASS），待辦分頁照常讀到。回答都從待辦分頁點選項＋「送出」。
- R2 的按鍵用 F12（`ESC [24~`：BAT 判成草稿 `csi~:24`，claude 不收，輸入框維持空白），經 `ct-accept-act.mjs input` 以分頁自己的 `terminal.input(…, true)` 送出（與按鍵同一條 `onData` → `pty:write`）。信任 Enter 之後 claude 0.4～0.9 s 就送出啟動參數，所以 Enter 與 F12 在同一個 `eval` 內相隔 150 ms 送。

### 結果總表
| 項目 | pre.4 | pre.3 | 證據（`ACC/results-t0970/`） |
|---|---|---|---|
| R1 閒置時回答立即送出 | **PASS** | —（未要求） | `A/logs`：`answer … (sending)` → `sent … reason=none`（text / enter），沒有 `held`；對話紀錄 USER `U-1：A` 一次；`A/R1-00-before.png`、`R1-01-after.png` |
| R2 啟動參數回合送出前按鍵 → 回答 | **FAIL**（有效 2 次都 `held … reason=draft`；第 2 次作廢，見〈遭遇問題〉） | 重現（`held … reason=draft`；60 s 後「立即送出」收尾） | `B3/logs`、`B/logs`、`C/logs`；`B3/R2-attempt3-held.png`、`B/R2-01-answer.png`、`C/R2-01-answer.png` |
| R3 真草稿保留＋去重＋只送一次 | **PASS** | — | `A/logs`、`A/R3-01-held.png`、`R3-02-dup.png`、`A/transcript.txt` |
| R4 保留期間不列 Worker 區、標題數字不增 | **PASS** | 對照：Worker 區列出塔台、標題多 1 | `A/R4-01-hold-menu.png`；`C/R2-01-answer.png` |
| R5 日誌不含內容與權杖 | **PASS** | — | 5 份 debug log、bat-scripts.log |

結果總表與每項判讀另寫在 `ACC/results-t0970/summary.md`；各情境的日誌 `<情境>/logs/`、塔台輸出 `tower-output.txt(.raw)`、狀態檔 `state-startup.md` / `state-seeded.md` / `state-final.md`、對話紀錄 `transcript.txt`（A / B / C）、驅動紀錄 `driver-<情境>.log`。

### 各項日誌摘要（UTC，塔台分頁 id 省略）
- **R1**（A，pre.4）：開工 `user-prompt-submit` 07:20:18.733 → `set-role … contract=2` 07:21:23.232 → 閒置 → 07:22:08.290 `[notify-hold] answer … len=5 (sending)` / 08.291 `sent … reason=none part=text` / 08.549 `part=enter`；`[tower-inbox] … id=U-1 len=5 → sending`。畫面「✓ 已送出：U-1：A」。塔台回覆「U-1 已收到：A」。
- **R2 第 1 次**（B，pre.4）：07:25:31.430 `draft set … cause=csi:B`（信任對話框的 ↓）→ 07:25:32.864 一次寫入 `\r`＋F12（`\r` 清、F12 再設，狀態仍是草稿，所以沒有新的 `draft set` 行）→ 07:25:33.723 `user-prompt-submit`（沒有 `draft cleared` / `draft kept`）→ 07:26:28.302 `set-role … contract=2` → 07:26:57.002 `held … source=answer reason=draft part=text len=5 queued=1`（「保留原因：你在輸入」）。
- **R2 第 3 次**（B3，pre.4，乾淨證據）：信任 ↓ 07:37:17.127 `draft set … cause=csi:B` → Enter 07:37:18.545（清）→ F12 07:37:18.704 → 07:37:18.705 `draft set … cause=csi~:24 bytes=5` → 07:37:19.062 `user-prompt-submit`（F12 後 357 ms，超過 300 ms 輸入窗；沒有 `draft cleared` / `draft kept`）→ 07:38:23.011 `set-role … contract=2` → 07:38:47.549 `held … reason=draft`。之後以縮圖「✕ 全部取消」收尾（不開新回合）。
- **R2 對照**（C，pre.3）：信任 Enter 07:30:55.708、F12 07:30:55.865 → `user-prompt-submit` 07:30:56.330 → 07:32:27.814 `held … reason=draft queued=1`；07:33:37 「立即送出」→ `sent … reason=draft`，塔台收到 `U-1：A`。
- **R3**（A）：打 `abc` → 07:23:18.308 `draft set … cause=printable bytes=1` → 07:23:27 `held`（畫面「✓ 已排入待送：U-2：A」＋「保留原因：你在輸入：塔台輸入框有你還沒送出的文字…」）→ 07:23:29.821 再按一次 → `answer duplicate … holdId=h-2 len=5 (already held)`，待送仍 1 → Backspace ×3（輸入框空）＋Enter → 07:24:05.853 `sent … reason=draft part=text`、06.117 `part=enter`。空輸入框的 Enter claude 不送任何內容；對話紀錄的使用者訊息只有 `/control-tower`、`U-1：A`、`U-2：A` 各一次。
- **R4**（A）：保留期間 `[data-inbox-section=workers]` 是空、沒有 `[data-inbox-worker]` 項目；分頁標題 `待辦1` / `data-inbox-badge=1` 回答前後相同（那 1 是 U-2 本身）；縮圖 `📨 待送 1`（`data-notify-hold-reason=draft`），點開有保留原因、「取消」「➤ 立即送出」「✕ 全部取消」。pre.3 對照（C，同樣保留一筆回答）：Worker 區列「📨 Claude CLI · Tower：待送 1 則通知」、標題 `待辦3`（pre.4 同情境 `待辦2`）—— T0966 的修正有效。
- **R5**：5 份 debug log 共 8 行 `[notify-hold] draft set terminal=<id> cause=<csi:B｜printable｜csi~:24> bytes=<n>`，沒有按鍵內容；`[notify-hold]` / `[tower-inbox]` 只有 id、len、holdId、原因；`abc`、`U-1：A` / `U-2：A`、`batcap.` 在所有日誌都找不到（bat-scripts.log 的 env 只有名稱）。

### R2 判讀：修正為什麼沒有涵蓋
- `NotifyHoldController.onPromptSubmitted`（`electron/notify-hold.ts:552`）第一個條件是 `!state?.draft || state.inPaste || !this.isContractTower(id)` 就 return，而且不記日誌。
- 啟動參數 `/control-tower` 那個回合的 `user-prompt-submit`，一定比塔台在同一回合裡 `--set-role tower --bat-contract 2` 早（A：約 65 s；B3：約 64 s；T0964 引用的 BUG-235 原始日誌：03:59:16.9 vs 03:59:37）。所以這時分頁還不是契約 2 塔台，草稿不會被清掉；回合結束後第一筆回答照舊 `held … reason=draft`，與 pre.3 完全相同。五次執行都沒有出現過 `draft cleared`。
- BUG-235 原始情境（03:59:15 重開塔台 → 03:59:16.9 啟動參數送出 → 04:00:17 回答 `held … reason=draft`）落在同一段：重開後到 `set-role` 之前、或開工回合中按的鍵都清不掉。
- 卡住之後會自己恢復的方式：「立即送出」或在塔台送出任何訊息。回答的 submit Enter（`pty:write` 的 `{ submit: true }`）算使用者輸入，送出時 `\r` 本身就清掉草稿（T0904 起的行為）；B / C 送出 U-1 後，U-2 都立即送出（`reason=none`），pre.3 也一樣，所以那一步不能當成修正生效的證據。
- 回合中才按的鍵（B2）照 T0964 的取捨本來就保留。

### A-26 判定建議
- **A-26 不建議判完成**。A-26 = 「塔台閒置時從待辦分頁回答立即送出、不卡待送」：一般情況（R1）可以；但開塔台到開工回合結束前按過鍵（含 BUG-235 原始情境的時段）時，回合結束後的第一筆回答仍卡待送，pre.4 與 pre.3 相同。
- 建議 BUG-235 依 `_local-rules.md`〈驗收失敗處理〉「原問題未解」退回 FIXING，另派修正工單（本單不修產品程式）。可考慮的方向（請塔台裁示）：
  1. `user-prompt-submit` 時不論契約，記下「這次送出前有草稿、之後 300 ms 沒有輸入、2 s 內沒有 Enter」；分頁之後 `--set-role --bat-contract 2` 成為 `match` 時，若這段之後沒有新的使用者輸入，就清掉草稿。
  2. 或對 `launchRole: 'tower'`（「以塔台開啟 Claude」）的分頁，第一個 `user-prompt-submit`（啟動參數）不看契約就套用同一段清除規則。
  - 兩者都應補「啟動參數回合送出前的草稿」的回歸測試（本單 B3 的時序可直接當測試案例：草稿 → 357 ms → submit → set-role → 回答）。
- R3 / R4 / R5 與 T0966 的修正確認有效，可分開結案。

### 產品變更
- 沒有改產品程式、沒有改 `e2e/fixtures/`。
- `e2e/manual/ct-accept-act.mjs`：新增 `input <name> <id> <json string>`，以分頁自己的 `terminal.input(data, true)` 送原始按鍵序列（例 F12）。
- `e2e/manual/README.md`：T0970 段（`input` 用法、在啟動參數回合送出前按鍵的時序做法、回答的 submit Enter 會清草稿、測試視窗外部輸入要作廢重跑）。
- commit `30e3c240ce39d7c4362c4a26ceb59f1cfe91ea30`（`ct/T0970`）。

### 驗證
| 關卡 | 結果 |
|---|---|
| 相依：worktree 沒有 `node_modules`，依專案慣例 `npm ci` | exit 0 |
| `node --check e2e/manual/ct-accept-act.mjs`（`30e3c240`） | exit 0 |
| `npx vite build`（`30e3c240`） | exit 0 |
| `npm run typecheck`（`30e3c240`） | exit 0 |
| `npm run typecheck:electron`（`30e3c240`） | exit 0 |
| `input` 指令實際使用 | B、B2、B3、C 都用到（commit 前的同一份程式；commit 後沒有改動） |

### 環境與清理
- 五個驅動都以 `closeIsolated` 結束：Terminal Server `alive after teardown: false`、runtime userData 已刪（`driver-<情境>.log`）；之後查 `ExecutablePath` 含 `BAT-TestBuilds` 或命令列含 `runtime=e2e-t0970` / `ct610-driver` 的程序：0 個；`%APPDATA%` 下沒有 `BetterAgentTerminal-runtime-e2e-t0970*`。
- 使用者安裝的 BAT：程序 pid 前後相同（`BetterAgentTerminal.exe` 5 個＋`bat-pty-holder.exe` 1 個，`installed-bat-pids-before.txt` / `-after.txt`），沒有執行、關閉或碰它的 userData。
- 使用者層：`~/.claude`（skills、settings.json、CLAUDE.md、hooks、installed_plugins.json）與 `~/.codex`（skills、config.toml、AGENTS.md）共 1,199 檔，開工前後 SHA-256 完全相同（`userlayer-before.json` / `-after.json`）。
- `claude-config/` 的帳號檔沒有讀取、複製或摘錄；只轉出本單 A / B / C 三個副本 `projects/<runs-t0970-*>/*.jsonl` 的對話紀錄。ACC 先前輪次的目錄沒有動；`ACC/runs-t0970/*` 保留（都沒有 commit）。

### 遭遇問題
- **R2 第 2 次（B2）作廢**：07:35:12.954 有一筆 `draft set … cause=csi:B`，早於 claude 進入全螢幕（07:35:14.280），當時驅動沒有送任何鍵，而且信任對話框在驅動操作前就被通過（claude 07:35:14.628 已送出啟動參數）。判定為有人在桌面上的測試視窗按了鍵；驅動之後送的 ↓ / Enter / F12 都落在開工回合中。這次改記為「回合中按鍵」的補充證據（07:35:20.581 `draft set … cause=csi~:24` → 回合結束後回答 `held … reason=draft`，以「✕ 全部取消」收尾），另開 B3 重跑。R2 共試 3 次（上限內）。
- 第 1 次（B）把信任 Enter 與 F12 放在同一次寫入：草稿狀態正確，但日誌的 `draft set` 只有前面 ↓ 那一行；B3 改成分開寫入，取得 F12 自己的 `csi~:24` 行。
- 縮圖的待送選單會蓋住 `.notify-hold-badge`，再點一次徽章關不掉；改點待辦分頁的數量列關閉。
- 隔離帳號用量沒有碰到上限。

### 互動紀錄
- 無（yolo；沒有向使用者或塔台提問）。

### 隔離分支證據
- branch：`ct/T0970`
- base_sha：`e09b3da81786044881cdca174ad122ab47ff31d2`
- validated_sha：`30e3c240ce39d7c4362c4a26ceb59f1cfe91ea30`
- head_sha：`30e3c240ce39d7c4362c4a26ceb59f1cfe91ea30`
- validated_sha ≠ head_sha 的說明：兩者相同（commit 後跑關卡）
- 未 push、未觸發 workflow、未建 tag。

### 回報時間
- 2026-11-28T15:40:24+0800
