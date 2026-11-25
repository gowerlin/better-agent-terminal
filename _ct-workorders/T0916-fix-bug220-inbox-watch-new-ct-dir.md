---
schema_version: 1
schema_kind: workorder
id: T0916
title: "修 BUG-220：待辦分頁在 `_ct-workorders/` 之後才建立時自動讀到（不必按 ↻）"
type: bugfix
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T12:19:45+08:00"
started_at: "2026-11-25T12:22:28+08:00"
updated_at: "2026-11-25T12:22:28+08:00"
target_version: "0.8.0-pre.3（與 CT 6.1.0 同日發佈）"
depends_on: [T0915]
related:
  - "BUG-220；D337；PLAN-068 W4（待辦分頁）；T0915 回報區〈建議開 BUG〉第 1 點"
affects_files:
  - _ct-workorders/T0916-fix-bug220-inbox-watch-new-ct-dir.md
  - electron/handlers/fs.ts
  - src/stores/ct-dir-watch.ts
  - src/stores/__tests__/
  - electron/__tests__/
  - src/components/
  - docs/agent-guide/tower-inbox.md
  - CLAUDE.md
renew_count: 0
tower_question: open
isolation: worktree
workdir: "worktree ct/T0916（塔台已預先從 `v0.8.x` `4f7484bc` 建立分支 `ct/T0916`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 分支：只在 `ct/T0916` 寫檔；開工確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `4f7484bceb4fac693f0d35fd0285b93bb4d8c146`，不符就停下問塔台。不 merge / rebase / push、不動 `main` 與 `v0.8.x`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 先查證再修：確認根因（T0915 推定：`fs:watch` 對不存在的目錄回 `false`、`acquireDirWatch` 不重試），找出 `acquireDirWatch` 的所有 consumer（待辦分頁、指揮塔總覽、工單列表等）。修法由你依證據選，條件：目錄之後被建立時，所有 consumer 都能在數秒內自動重讀；目錄本來就存在時行為、事件次數與目前完全相同；目錄被刪除再建立也要能恢復；不得改成輪詢整個專案樹或高頻輪詢（若必須輪詢，間隔 ≥ 2 s、只 stat 該目錄、目錄出現後停止）；遠端（proxied `fs:watch`、headless）行為同樣成立或與修正前一致（說明）。"
  - "🔴 不回歸（R-G003 第 3 點）：回報區列〈相關通過案例〉：T0915 M-C1–M-C4 的 PASS 項、指揮塔總覽（T0701）的自動更新、T0905/T0906 的待辦分頁測試，逐案說明改動後仍成立。"
  - "🔴 驗證：新增單元測試（目錄不存在 → 建立 → consumer 收到變更；目錄存在的既有路徑不變）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報）。e2e 可選：若既有 `e2e/t0913-tower-inbox-integration.spec.ts` 容易加一段「沒有 `_ct-workorders/` 的工作區 → 之後建立」，就加並跑 1 次（隔離實例，需先 `npx vite build`）。不開會耗 token 的 claude 回合。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md` 相關節補一行行為說明；CLAUDE.md 只在有新不變式時加一句。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；commit 訊息 `fix(T0916): …`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；收單前 worktree `status --porcelain` 為空。公開 repo（D176）：不寫真名、家目錄路徑。yolo：不得問使用者，判讀問題問塔台。"
---

# T0916 — 修 BUG-220：待辦分頁自動讀到新建的 `_ct-workorders/`

見 [BUG-220](BUG-220-inbox-tab-misses-new-ct-workorders-dir.md)。

## 驗收

- [ ] 根因查證（附 `檔案:行`）
- [ ] 目錄之後才建立 → 待辦分頁與其他 consumer 自動更新；目錄本來存在 → 行為不變
- [ ] 單元測試、vite build、兩個 typecheck、`test:unit` 第一次即綠
- [ ] 〈相關通過案例〉逐案判定
- [ ] 文件同步

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：修法需要動 `electron/preload.ts` 與 `src/types/electron.d.ts`（不在 affects_files），可以嗎？
- **提問時間**：2026-11-25T12:26:08+0800
- **背景**：根因已確認：`fs:watch`（`electron/handlers/fs.ts`）對不存在的目錄 `fsSync.watch` 丟例外 → 回 `false`、不留任何 watcher；`acquireDirWatch` 不重試。另實測（Windows、Node）：被遞迴監看的目錄被刪除時 watcher 不發 `error`，而是無限噴 `rename`（debounce 永遠不結束 → 不會送 `fs:changed`），重建後舊 watcher 也看不到新檔。
- **我的修法**：`fs:watch` 加選用第二參數 `{ recreate: true }`：目錄不存在 → 改監看最近的已存在祖先（非遞迴、事件驅動、不輪詢），目錄出現就換成原本的遞迴 watcher 並送一次 `fs:changed`；目錄被刪除 / 被換掉（dev+ino 改變）→ 送一次 `fs:changed` 後回到等待。只有 `acquireDirWatch`（待辦分頁、指揮塔）帶這個選項；其他 `fs.watch` 呼叫者（檔案樹、Markdown 預覽、`.git`、`_bmad-output`）逐字不變。舊 bat-server 忽略第二參數 → 與修正前一致。
- **選項**：
  - A：允許改 `electron/preload.ts`（`fs.watch` 多一個選用參數，只在有給時才送）與 `src/types/electron.d.ts`（型別），共約 6 行。
  - B：不動 preload，改成 `fs:watch` 對所有呼叫者預設 recreate（影響檔案樹、`.git`、`_bmad-output` 等不存在目錄時的回傳值與 watcher 數）。
  - 其他
- **建議**：A。理由：改動只是讓選項穿過 IPC 橋，不改任何既有呼叫的送出內容；B 會改變其他 consumer 的行為，回歸面較大。
- **影響**：選 B 需改寫已完成的 fs.ts 選項判斷並重估其他 consumer。
- **是否阻擋後續**：是（決定 IPC 介面後才寫測試與文件）。
