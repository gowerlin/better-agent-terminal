---
schema_version: 1
schema_kind: workorder
id: T0974
title: "CT 6.4.0-pre.2 補跑 HR-1（BAT `v0.8.1-pre.4` × CT 6.4.0-pre.2，`checklist-rerun-640.md`）＋ 補入 CT 的 6.4.0-pre.2 範例檔與重複鍵樣本做 BAT 解析測試"
type: verification
status: DONE
repo: better-agent-terminal
priority: P2
sizing: M
created_at: "2026-11-28T15:55:39+0800"
updated_at: "2026-11-28T16:11:21+0800"
started_at: "2026-11-28T15:57:13+0800"
completed_at: "2026-11-28T16:11:21+0800"
session_ids:
  - "025acf0b-55f0-4fd5-b718-3688aa87b859"
target_version: "0.8.1-pre.4（已發佈）＋ CT 6.4.0-pre.2；測試檔隨 `0.8.1-pre.5`"
depends_on: []
related:
  - "T0969（6.4.0-pre.1 雙方驗收）；T0971（B-1 / B-2，BAT 自製 fixture `ct-tower-state-v642/`）；D500（狀態檔重複鍵）；CT T0585（CT D934，CT BUG-006 FIXED `05b63a0`）；D505"
affects_files:
  - _ct-workorders/T0974-ct642-rerun-and-fixtures.md
  - e2e/manual/
  - src/types/__tests__/fixtures/
  - src/lib/__tests__/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0974` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式（`src/**` 只可新增測試與 fixture、`electron/**` 不動）、不改 `e2e/fixtures/`；只可擴充 `e2e/manual/` 驅動與 README。"
  - "🔴 A. 補跑 HR-1（外部路徑本機、不進 repo，D176；ACC = `<使用者資料夾>/AppData/Local/ct620-accept`）：清單 `ACC/checklist-rerun-640.md`（17754 bytes，SHA-256 開頭 `416662a40f33f349`）、換版工具 `ACC/ct-swap-640.py`（12840 bytes，SHA-256 開頭 `d4d92ead05d2b254`），不符就停下問塔台。先換版：`<使用者資料夾>/.local/bin/python.exe -X utf8 -I -B <ACC>/ct-swap-640.py install-642 --target <ACC>/claude-config/skills --work-dir <ACC>/_swap-640`（🔴 一定帶 `--target`；exit 0 且最後一行是「完成。請開新的 Claude Code session（已開的 session 不會重新載入 skill）。」才算成功，其他 → 停止、回報原文、問塔台；跑完留在 6.4.0-pre.2，`status --target …` 確認）。情境 S5：BAT `v0.8.1-pre.4`（`<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.4-win/`，核對 exe 與 `resources/package.json` 版號；不存在就照 T0969 從 Release 下載，SHA-256 `a475808e852bd1f08ad1203ada57fbefe2c1cab23efa5a5945d75a759b149f68`），runtime `e2e-642-s5`，一個塔台 session、新副本放 `ACC/runs-rerun-640/`；用 T0969 的 `e2e/manual/ct-accept-watch.mjs` 擷取每次寫入快照到 `ACC/results-rerun-640/S5-writes/`。HR-1 步驟照清單：送 H-2 提示詞 → 選單 Esc 一次 → 送 H-14b 提示詞 → 在選單答 U-f3（約 3 回合）。結果寫 `ACC/results-rerun-640/`。"
  - "🔴 HR-1-3 判法以 CT 塔台訊息為準（覆蓋清單原文）：每一份快照 `check-frontmatter.py`（6.4.0-pre.2 的版本，ACC skills 內）exit 0 → PASS；`menu_open` 沒有緊接在 `awaiting_user` 後面、但每份快照都合法 → 只記錄、不判 FAIL；中間出現不合法的快照才判 FAIL。另以 js-yaml CORE_SCHEMA 解析每份快照（BAT 的讀法），列出任何失敗。CT 端判定欄留空；BAT 端觀察照 T0969 格式（提示行、Esc、保留、日誌摘要）。"
  - "🔴 B. 補入 CT fixture（B-1 收尾）：把 CT commit `71b8406` 的 `D:/ForgejoGit/@Gower_Labs/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v6.4.0-pre.2/skills/control-tower/scripts/tests/fixtures/frontmatter/good/tower-state-v642.md` 逐位元組複製到 `src/types/__tests__/fixtures/ct-tower-state-v642/`（與 T0971 的 BAT 自製檔並存，README 註明來源與 commit；`cmp` 確認相同），以及同層 `../bad/dup-key-*.md` 5 份複製到 `src/types/__tests__/fixtures/ct-tower-state-dup-key/`（README 同）。新增測試：CT v642 範例 → `parseTowerStateInbox` / `parseMenuOpen` 解析成功（`menu_open.ids` = `[\"U-61\"]`、`user_actions` / `reminders` 照常）；5 份重複鍵樣本 → BAT 的解析一律當作沒有摘要（`parseTowerState` `no-summary`、`towerStateBatContract` null、`parseTowerStateInbox` null，不丟例外）。工單類的樣本若 BAT 沒有對應解析器，只記錄、不硬測。🔴 產品測試不得讀 repo 外的檔（只讀複製進來的 fixture）。"
  - "🔴 BAT 測試版只用 zip，不執行 .exe 安裝檔、不碰使用者安裝的 BAT（使用者正在用 `0.8.1-pre.4` 安裝版）。啟動與環境同 T0969（`launchIsolated`＋`BAT_E2E_EXECUTABLE`、`dropEnv`、`CLAUDE_CONFIG_DIR=<ACC>/claude-config`；帳號檔不得讀取、複製或摘錄；只檢查 `.credentials.json` 存在）。不要點塔台終端，Esc 只按一次；驗收期間不手動操作測試視窗。模型配合最多試 3 次；碰到用量上限 → PARTIAL。"
  - "🔴 驗證與 Git：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；兩個 typecheck = 0；改了 `e2e/manual/` 時 `node --check`。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。程序清理照 D308；使用者層 `~/.claude`、`~/.codex` 前後雜湊相同；安裝版 BAT pid 前後相同。"
  - "🔴 公開 repo（D176）：repo 內的腳本、fixture README 與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）；fixture 內容若含家目錄路徑或真名 → 停下問塔台。結果檔在 ACC 可寫實際路徑。yolo：不得問使用者。工單狀態寫 `DONE` / `PARTIAL`（L177）。"
---

# T0974 — CT 6.4.0-pre.2 補跑 HR-1 ＋ CT 範例 / 重複鍵 fixture

## 背景

CT T0585 收單（CT D934）：6.4.0-pre.2 定稿（R1 `menu_open` 移到 `awaiting_user` 正後方、R2 選單題與文字範本混用、R4 回覆不提 `menu_open`、R6 `check-frontmatter.py` 抓重複鍵，CT BUG-006 FIXED）。CT 請 BAT 用新 BAT `v0.8.1-pre.4` 跑補跑清單 HR-1，並提供 6.4.0-pre.2 正式範例檔與 5 份重複鍵樣本給 BAT 做 B-1 對照與「重複鍵 → 整份無效」測試。

CT 條文位置（`BMad-Control-Tower-v6.4.0-pre.2/skills/control-tower/`）：R1 `references/memory-protocol.md:319–325`、R2 `:412–420`、R4 `:335–337`、R6 `scripts/check-frontmatter.py:35–37`、`memory-protocol.md:788–790`。

## 範圍

- A：HR-1 補跑（S5）。
- B：CT fixture 與重複鍵樣本複製＋解析測試。

## 不做

- 不改產品程式；不碰安裝版 BAT；不發版。

## 驗收

- [x] 前置（清單與換版工具雜湊、`install-642` 成功、skills 是 6.4.0-pre.2、zip / exe、已登入）
- [x] HR-1 跑完，`ACC/results-rerun-640/` 結果與 S5-writes 快照；每份快照 CT 自檢與 js-yaml 結果；CT 判定欄留空
- [x] CT v642 範例與 5 份重複鍵樣本進 fixture（`cmp` 相同）＋測試
- [x] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [x] 使用者層無變更、安裝版 BAT 未被碰、程序清理

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（A：HR-1 跑完，BAT 端 HR-1-1／-2／-4 PASS、HR-1-3 依工單判法 22／22 份 `CF` exit 0、js-yaml 0 失敗；CT 端判定欄留空。B：CT 範例＋5 份重複鍵樣本進 fixture、9 個新測試；全部關卡綠）
- **開始／完成**：2026-11-28T15:57:13+0800 ～ 2026-11-28T16:10:36+0800
- **session_id**：025acf0b-55f0-4fd5-b718-3688aa87b859

### 落點檢查
- 結果：PASS
- C-0：PASS（frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`）
- C-1：PASS（工單在 `$CT_HOME/_ct-workorders/`）；C-3：PASS（`e2e/manual/`、`src/types/__tests__/fixtures/`、`src/lib/__tests__/` 存在）；C-2：沒有 `branch` 欄位，略過
- 證據：`CT_HOME` 已設定、`CT_WORKTREE_BRANCH=ct/T0974`、`CT_MODE=yolo`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄不比對）

### 前置條件
| 條件 | 結果 |
|---|---|
| `ACC/checklist-rerun-640.md` 17754 bytes、SHA-256 開頭 `416662a40f33f349`；`ct-swap-640.py` 12840 bytes、開頭 `d4d92ead05d2b254` | PASS（`416662a40f33f349…`、`d4d92ead05d2b254…`） |
| 換版 `install-642 --target <ACC>/claude-config/skills --work-dir <ACC>/_swap-640` | PASS：exit 0、最後一行「完成。請開新的 Claude Code session（已開的 session 不會重新載入 skill）。」；換前 `status` 6.4.0-pre.1、換後 `結論：9 個 skill 都是 6.4.0-pre.2`（9 列都「與 6.4.0-pre.2 來源逐檔相同」）；結束時仍是 6.4.0-pre.2（`status-end.txt`） |
| BAT zip／exe | PASS：沿用 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.4-win/`（T0969 解壓）；`_dl-0.8.1-pre.4/…-win.zip` SHA-256 `a475808e…9f68` 相符、exe 存在、`resources/package.json` 版號 `0.8.1-pre.4`；沒有執行 .exe 安裝檔 |
| 已登入 | PASS：`claude-config/.credentials.json` 存在（只檢查存在）；塔台沒有登入提示 |

### A. HR-1 補跑（S5：BAT `v0.8.1-pre.4` × CT 6.4.0-pre.2）
結果檔 `ACC/results-rerun-640/HR-1.md`（＋`HR-1/` 附件），每次寫入快照 `S5-writes/`（15 份），日誌 `S5-logs/`，`cf-all.txt`、`jsyaml-all.txt`。

| 項目 | BAT 端判定 | CT 端判定 |
|---|---|---|
| HR-1-1 ① 前提（選單 `U-1`；使用者 Esc 一次） | PASS：Esc 後 U-1 留在待辦分頁、沒有提示行；日誌 `question menu closed (user Esc)` | （留空） |
| HR-1-2 ② R2 文字範本的題寫進題目 | PASS：選單只有 `U-4`（U-f3），第一題 `question` 依序含 U-1 的提醒 → U-2（5 個選項、`回 U-2：<代號>`）→ U-3（`回 U-3：<文字>`）→ U-4 本題（`menu-input-2.txt` 取自對話紀錄的 `AskUserQuestion` 輸入全文、`01-menu.png`）；沒有走退路 | （留空） |
| HR-1-3 ② R1 `menu_open` 緊接 `awaiting_user` | 依工單判法（BAT 代算）：22 份（`S5-writes/` 15＋`state-*` 6＋副本最終檔）6.4.0-pre.2 `CF` **全部 exit 0** → PASS；js-yaml CORE_SCHEMA **0 失敗**；有 `menu_open` 的 7 份都是 `awaiting_user` 之後的下一個頂層鍵；開選單前那份 `S5-writes/004`：四筆 U-1～U-4 在 `awaiting_user`、`ids ["U-4"]`；塔台用**一個** Edit 同時寫三筆 `awaiting_user` 與 `menu_open`（第二個 Edit 只改本文表格） | （留空） |
| HR-1-4 ③ 回答 `U-4`（選單選 A） | PASS：U-4 從待辦分頁消失、U-1／U-2／U-3 仍在；確認行 `U-4 已收到：A → 要加變更紀錄（D001）`；之後的寫入沒有 `menu_open` | （留空） |

- 回合數：①、Esc、②、③（選單作答）＋收尾「全部放棄」1；模型配合 1 次就符合（沒有補送 `b-`）；沒有碰到用量上限。
- BAT 端觀察：提示行只在選單開著時出現在選單題（① U-1、② U-4），Esc／作答後消失；BAT 沒有代按 Esc（本次沒有選單開著時從待辦分頁回答）；收尾回答 `answer menu … menu_open=none` → 直接 `sent … reason=none`。日誌 12 行摘要在結果檔，沒有驅動以外的輸入。
- 給 CT 的觀察（不是 BAT 判定，詳見結果檔）：Esc 後塔台沒有寫檔，所以 `state-after-esc.md` 仍帶 `menu_open ids ["U-1"]`（與 `S5-writes/003` 相同，合法）；③ 的回覆有一句「_tower-state.md 已清掉開選單時寫的欄位」（沒有寫出鍵名，R4 參考）；③ 第一個寫入同時移除 U-4 與 `menu_open`。

### B. CT fixture 與解析測試
- `src/types/__tests__/fixtures/ct-tower-state-v642/tower-state-v642.md`：CT commit `71b8406` 的 `good/tower-state-v642.md`，以 `git show 71b8406:<path>` 取出；與 CT 工作樹檔、與本 repo commit 後的 blob 都 `cmp` 相同（SHA-256 `c6042e35…5648`）。與 T0971 的 BAT 自製檔並存，README 改寫成兩檔對照（來源、commit）。
- `src/types/__tests__/fixtures/ct-tower-state-dup-key/`：`bad/dup-key-{top,nested,item,menu-open-flow,workorder}.md` 5 份，同上取出、`cmp` 相同，README 列來源、commit、重複的鍵、SHA-256。
- 內容檢查：沒有家目錄路徑或真名（內容是 `原文標記QZX` 等假資料）；全部 LF（`git ls-files --eol` `i/lf w/lf`）。
- 新測試 `src/lib/__tests__/tower-state-ct642-fixtures-t0974.test.ts`（9 個，只讀複製進來的 fixture）：
  - CT v642 範例：`parseTowerState` summary、`towerStateBatContract` 2；`parseTowerStateInbox` → `menuOpen` `{ ids: ["U-61"], openedAt }`、`inboxMenuInfo` 相同、`awaiting` U-57／U-59／U-60／U-61、`user_actions` A-2、`reminders` `weekly-log-review`、`skipped` 全 0；`parseMenuOpen` 對原始值結果相同。
  - 4 份 tower-state 重複鍵樣本：不丟例外、`parseTowerState` `no-summary`（`summaryError` 以 `YAML parse error: duplicated mapping key` 開頭）、`towerStateBatContract` null、`parseTowerStateInbox` null。
  - `dup-key-workorder.md`：BAT 有對應解析器（`parseWorkOrder`），所以有測：不丟例外、`parseSource` `legacy_markdown`、`invalid_frontmatter` 警告（`duplicated mapping key`）、狀態不取自 frontmatter 的兩個 `status` 值；也確認它不被當成 tower-state 摘要。
- 產品程式（`src/**` 非測試、`electron/**`）、`e2e/fixtures/`、`e2e/manual/` 都沒有改。

### 驗證
| 關卡 | 結果 |
|---|---|
| 相依：worktree 沒有 `node_modules`，`npm ci` | exit 0 |
| `npm run test:unit`（`5410c597`，head 第一次完整執行） | exit 0：Test Files 533 passed、3 skipped（536）；Tests 9622 passed、47 skipped（9669） |
| `npx vite build`（`5410c597`） | exit 0 |
| `npm run typecheck`（`5410c597`） | exit 0（0 錯誤） |
| `npm run typecheck:electron`（`5410c597`） | exit 0（0 錯誤） |
| `node --check` | 不適用（沒有改 `e2e/manual/`） |

### 環境與清理
- 啟動：`launchIsolated`＋`BAT_E2E_EXECUTABLE`（`ct610-driver.ts`，runtime `e2e-642-s5-1795852707658`），主行程 env `CLAUDE_CONFIG_DIR` = 測試目錄、沒有 `CLAUDECODE`／`CLAUDE_CODE_*`／`CT_*`；工作區層級 `--dangerously-skip-permissions` 只在測試工作區；塔台以「以塔台開啟 Claude」開啟。
- 沒有點塔台終端（鍵盤輸入經 xterm `focus()`＋Playwright）；使用者 Esc 只按一次；驗收期間沒有手動操作測試視窗。
- 帳號檔沒有讀取、複製或摘錄；只轉出本副本 `projects/…runs-rerun-640-S5/` 的對話紀錄與 `AskUserQuestion` 輸入。結果檔掃描沒有 `batcap.` 權杖值。
- 程序清理（D308）：驅動 `quit` → `closeIsolated`（Terminal Server `alive after teardown: false`、runtime userData 已刪）；監看腳本已停；之後查 `ExecutablePath` 含 `BAT-TestBuilds` 或命令列含 `runtime=e2e-642` / `ct620-accept` / `ct-accept-watch` / `ct610-driver` 的程序：0 個；`%APPDATA%` 沒有 `BetterAgentTerminal-runtime-e2e-642*`。
- 安裝版 BAT pid 前後相同（5 個：1868、3264、3640、8044、36320）。
- 使用者層：`~/.claude`（skills、settings.json、CLAUDE.md、hooks、installed_plugins.json）與 `~/.codex`（skills、config.toml、AGENTS.md）共 1,199 檔，前後 SHA-256 完全相同；`ct-swap-640.py status --target <使用者資料夾>/.claude/skills` → `結論：9 個 skill 都是 6.3.0`（`user-layer-status.txt`）。
- ACC 隔離 skills 留在 6.4.0-pre.2（清單 § 1 指定不換回）。`ACC/runs-rerun-640/S5` 保留（沒有 commit）。先前輪次的 `results*/`、`runs*/`、`_swap*` 舊目錄沒有動。

### 遭遇問題
- 右側欄這次本來就展開在「待辦」，`.right-sidebar-collapsed-btn` 不可見、點擊逾時；`02-inbox.png` 改用同一時點的整窗截圖（同時看得到選單與待辦分頁），不影響判定。
- 驅動 `grepLog` 指令的 JSON 反斜線寫錯（`ct610-ctl.mjs` 解析失敗、沒有執行）；改為在已複製的 debug log 上 grep，輸出 `S5-logs/debug-menu-lines.txt`。
- 擷取 `AskUserQuestion` 輸入與 ②③ 回合摘錄的兩支小腳本放在 session scratchpad（沒有進 repo）。

### 互動紀錄
- 無（yolo；沒有向使用者或塔台提問）。

### 隔離分支證據
- branch：`ct/T0974`
- base_sha：`c56a595dd38515e9bb777fb97374b850249cc8fe`
- validated_sha：`5410c5979cd1696310a098e75f217cf8b7bed7f8`
- head_sha：`5410c5979cd1696310a098e75f217cf8b7bed7f8`
- validated_sha ≠ head_sha 的說明：兩者相同（commit 後跑關卡）

### 回報時間
- 2026-11-28T16:10:36+0800
