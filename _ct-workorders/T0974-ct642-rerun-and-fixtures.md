---
schema_version: 1
schema_kind: workorder
id: T0974
title: "CT 6.4.0-pre.2 補跑 HR-1（BAT `v0.8.1-pre.4` × CT 6.4.0-pre.2，`checklist-rerun-640.md`）＋ 補入 CT 的 6.4.0-pre.2 範例檔與重複鍵樣本做 BAT 解析測試"
type: verification
status: PENDING
repo: better-agent-terminal
priority: P2
sizing: M
created_at: "2026-11-28T15:55:39+0800"
updated_at: "2026-11-28T15:55:39+0800"
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

- [ ] 前置（清單與換版工具雜湊、`install-642` 成功、skills 是 6.4.0-pre.2、zip / exe、已登入）
- [ ] HR-1 跑完，`ACC/results-rerun-640/` 結果與 S5-writes 快照；每份快照 CT 自檢與 js-yaml 結果；CT 判定欄留空
- [ ] CT v642 範例與 5 份重複鍵樣本進 fixture（`cmp` 相同）＋測試
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 使用者層無變更、安裝版 BAT 未被碰、程序清理

---

## 回報區

（Worker 填寫）
