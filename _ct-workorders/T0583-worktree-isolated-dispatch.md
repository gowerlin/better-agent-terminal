---
schema_version: 1
schema_kind: workorder
id: T0583
title: "PLAN-047 W1-1：worktree 隔離派工（`--isolation worktree`、repo 外位置、`ct/T####` 分支、`CT_HOME`）+ `--close-worker --worktree keep|remove|archive`"
type: feature
status: TODO
started_at: ""
updated_at: "2026-10-17T21:52:34+0800"
completed_at: ""
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M
created_at: "2026-10-17T21:52:34+0800"
target_version: "0.7.0-pre.2（候選，與 T0582 / T0584 / T0585 同批再定）"
depends_on: []
related:
  - "PLAN-047（§一.6、§三之一、§三之二）、T0574 回報區 R5（實測數據、CT_HOME 方案 (a)+(c)、C-0 修正）與「CT 端需要配合的變更與介面契約要點」"
  - "D150 / D152；T0523（派工落點）、T0527（cwd 檢核）、T0535 / T0537 / T0545（`--close-worker` 與已存歸屬）、T0553（Worker 標題）、T0577（產品測試不再讀 `_ct-workorders/`）"
  - "並行工單 T0582（M1-1）：同樣會改 `electron/remote/helper-capability.ts` 與 `CLAUDE.md`"
affects_files:
  - "electron/ct-worktree.ts（新，名稱可自訂；git 操作一律 execFile + array args + timeout）"
  - electron/terminal-command-handlers.ts
  - electron/close-worker.ts
  - electron/main.ts
  - "electron/remote/headless-entry.ts（headless 對等或明確拒絕）"
  - "electron/remote/helper-capability.ts（只限 create-* 參數驗證若需放行 `isolation`；不動 `HELPER_CHANNEL_ROLES`）"
  - electron/pty-manager.ts
  - scripts/bat-terminal.mjs
  - "src/stores/workspace-store.ts、src/types/index.ts（分頁記錄 worktree 資訊，比照 T0537 欄位）"
  - "electron/__tests__/**、src/**/__tests__/**、e2e/t0583-*.spec.ts（新）"
  - "CLAUDE.md（新增獨立小節，不改其他小節）"
  - _ct-workorders/T0583-worktree-isolated-dispatch.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`；`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0582 同時在改 `electron/remote/helper-capability.ts`（它只動 `HELPER_CHANNEL_ROLES` 與範圍判定）與 `CLAUDE.md`（它新增查詢 channel 小節）。你不動角色表；CLAUDE.md 只新增你自己的小節。commit 前 `git diff -- <檔>` 確認只含你的 hunk；若檔案已有對方未 commit 的變更，用 `git add -p` 只 stage 自己的 hunk，不得夾帶。"
  - "🔴 實測一律用 temp 目錄的**臨時 git repo**，不得在本 repo 或其上層建立 worktree / 分支（T0574 L155：Worker 曾誤在主 repo 建 worktree）。e2e 用隔離實例（需先 `npx vite build`），不碰使用者的 BAT（9876）與其 Terminal Server。"
  - "🔴 BAT 不執行任何依賴安裝 / setup 指令（D152：由 Worker 依專案規則自己裝）。不做合併、不做 `worktree:terminal-status`（T0585）。現有 `WorktreeManager`（Agent 面板 / `claude-cli-worktree` preset，repo 內 `.bat-worktrees`）行為不得改變。"
---

# T0583 — worktree 隔離派工（W1-1）

## 背景

PLAN-047 軌道 W（D150 / D152）：工單可選擇在獨立 worktree 執行，main 在合併工單 `--ff-only` 前不動。本單讓 BAT 在派工時建立 worktree、在回收時清理；合併由 CT 合併工單負責（CT-T016），BAT 不新增合併能力。T0574 R5 已實測位置、長路徑、成本與 CT_HOME 方案。

## 介面契約（本單定稿，CT-T015 / CT-T016 依此撰寫；實作若需調整，回報區寫明差異與理由）

**派工**：`bat-terminal.mjs … --skill ct-exec|ct-done --workorder T#### --isolation worktree`

- `--isolation` 只收 `worktree`（去空白、不分大小寫）；其他值 → 用法錯誤 exit 1。不帶 = 現行行為（不隔離，D152：預設關閉）。
- 必須搭配 `--workorder`（agent skill 模式）；raw command 模式或沒有 `--workorder` → 用法錯誤 exit 1。
- 主 checkout = 派工 cwd 的 `git rev-parse --show-toplevel`（cwd 檢核 T0527 照舊用原 cwd）。不是 git repo → 失敗。
- 位置：`<主 checkout 的上層>/.bat-worktrees/<主 checkout 目錄名>/<T####>`；分支 `ct/<T####>`；base = 派工當下主 checkout 的 `HEAD` SHA。
- 已存在且就是 `ct/<T####>` 的 worktree（Renew / 重派）→ 沿用、不重建，標 `reused`；分支在但 worktree 不在 → 在既有分支上建 worktree；路徑被其他東西佔用 → 失敗。
- Windows 長路徑：git 指令視需要帶 `-c core.longpaths=true`（T0574 實測 clone 需要；worktree add 是否需要請實測並寫明）。
- PTY cwd = worktree 內對應的相對位置（cwd 在 repo 子目錄時保留子路徑）。
- BAT 注入（由 BAT 主行程加，不經呼叫者 `customEnv`）：`CT_HOME` = 主 checkout 絕對路徑、`CT_WORKTREE` = worktree 路徑、`CT_WORKTREE_BRANCH` = `ct/<T####>`、`CT_WORKTREE_BASE` = base SHA。
- 成功 stdout 在既有 `✓ Terminal created` / `workspace:` / `agent:` 之後多印：`  worktree: <path>`、`  branch: ct/T####`、`  base: <sha>`（`reused` 時加註 `(reused)`）。
- 失敗：helper **exit 7**，stderr `create: WORKTREE_FAILED`（含原因一行，不含權杖）；**不建立分頁**。`bat-scripts.log` 事件記 `isolation` / `worktree` / `branch` / `base` / `reused`。

**回收**：`bat-terminal.mjs --close-worker T#### --notify-id … [--delay-ms n] [--worktree keep|remove|archive]`

- 不帶 = `keep`（只關分頁）。`--worktree` 只在 `--close-worker` 模式有效，其他模式帶它 → 用法錯誤。
- 清理在**分頁實際關閉時**執行（延遲 / 等安靜 / 使用者輸入取消的 T0545 / T0551 規則不變；取消則不清理）。
- `remove`：`git worktree remove`（不加 `--force`）；分支保留（合併工單需要）。worktree 有未提交變更 → 不刪、記 warn `[ct-worktree] … kept (uncommitted changes)`。
- `archive`：同 `remove`，另把分支改名 `ct-archive/<T####>`（已存在則加時間後綴）。
- 只處理本單建立的 worktree（位置規則 + 分支名 `ct/` 雙重確認）；Worker 分頁不是隔離派出的 → 忽略 `--worktree`，照常關分頁並在 stdout 註明。
- exit code 與既有 `--close-worker` 相同（清理結果只進日誌，因為清理晚於 helper 結束）。

**持久化**：worktree 資訊（path / branch / base / mainCheckout）記在 `PtyInstance` 與分頁（`TerminalInstance`，隨 `workspace:save` 存，比照 T0537 的 `towerTerminalId` / `workorder`），BAT 重開後 `--close-worker --worktree` 仍可用。

## 任務

1. `electron/ct-worktree.ts`：建立 / 沿用 / 移除 / 封存，全部 `execFile('git', [...])`、timeout（建立 30 s、查詢 5 s），工單號以 `--workorder` 既有正規化結果並再過白名單 `^[A-Za-z0-9._-]+$`。
2. `create-agent-command` / `createWithCommand`：解析 `isolation`，在 PTY 建立前建 worktree、改 cwd、注入 env；失敗回 `{ ok:false, code:'WORKTREE_FAILED', message }`；Recovery create hold（T0578 / T0580）順序不變。
3. 範圍權杖：確認 helper 權杖的 create 參數檢查放行 `isolation`（只放行這一個新欄位）；`CT_*` 由 BAT 注入，不放寬呼叫者 `customEnv` 白名單。
4. `close-worker`：`--worktree` 參數一路帶到 scheduler，關閉時執行清理；BAT 重開後以已存分頁資訊執行。
5. helper `bat-terminal.mjs`：新參數、互斥規則、`--help`、exit 7、stdout 行。
6. headless：同一份實作可用則對等支援；若遠端情境（server 上的 repo）有無法處理的差異，改回明確錯誤並寫進 CLAUDE.md 已知限制。
7. 測試：temp git repo 的單元測試（建立 / 沿用 / 分支已在 / 路徑被佔 / 非 git / 子目錄 cwd / remove 乾淨與髒 / archive / 名稱碰撞）、handler 與 helper exit code、持久化往返；e2e 隔離實例：temp repo 內派 `--isolation worktree` 的 Worker（自訂 CLI 跑 node 腳本記錄 `process.cwd()` 與 `CT_*` env，不耗 token）→ cwd 在 worktree、env 正確、分支存在 → `--close-worker --worktree remove` → 分頁關閉後 worktree 消失、分支仍在。
8. CLAUDE.md：新增「worktree 隔離派工（PLAN-047 W1 / T0583）」小節：契約、位置與命名、env、清理規則、持久化、已知限制、驗證檔案清單。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. 上述單元測試與 e2e 通過；不帶 `--isolation` 的派工行為與現在完全相同（既有派工 / close-worker 測試全綠）。
3. 回報區附：長路徑實測結果、實際 stdout 範例、與契約的差異（若有）、給 CT-T015（CT_HOME / C-0 / SHA 回報）的注意事項。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
