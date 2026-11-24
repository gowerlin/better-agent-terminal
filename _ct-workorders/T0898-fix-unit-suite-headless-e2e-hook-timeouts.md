---
schema_version: 1
schema_kind: workorder
id: T0898
title: "修正 BUG-218（在 `v0.8.x`）：完整 `test:unit` 第一次執行時 headless / RemoteServer e2e 測試檔 `beforeAll` 逾時 —— 查根因並讓整套一次就綠"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-25T01:08:06+08:00"
updated_at: "2026-11-25T01:08:06+08:00"
target_version: "0.8.0-pre.2"
depends_on: [T0896]
related:
  - "BUG-218；T0891 / T0894 / T0895 回報區；D322（使用者 2026-11-25：「也安排」）；T0686（CI Test gate）；T0508（fake timers 與 socket 測試的注意事項）"
  - "CLAUDE.md「Frontend unit tests」節；`vite.config.ts` `test` 區塊"
affects_files:
  - _ct-workorders/T0898-fix-unit-suite-headless-e2e-hook-timeouts.md
  - electron/remote/__tests__/headless-blocked-state-e2e.test.ts
  - electron/remote/__tests__/headless-close-worker-e2e.test.ts
  - electron/remote/__tests__/headless-helper-narrowing.test.ts
  - electron/remote/__tests__/headless-remote-tower-e2e.test.ts
  - electron/__tests__/local-helper-capability.test.ts
  - electron/__tests__/tower-questions.test.ts
  - electron/remote/__tests__/
  - electron/__tests__/
  - vite.config.ts
  - vitest.setup.ts
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0898（塔台在 T0896 合併進 `v0.8.x` 後從新的 `v0.8.x` 建立分支，派工時填入 base）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0898` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = 本工單〈派工補記〉寫的 `v0.8.x` SHA，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只改測試與測試設定（`affects_files`）；🔴 不改任何產品程式（`electron/**` 非 `__tests__`、`src/**`、`scripts/**`）。根因若在產品程式（例：server 啟動真的變慢、資源沒釋放）→ 停下問塔台，附證據。`vite.config.ts` 只能改 `test` 區塊；改 `vite.config.ts` 後必跑 `npx vite build` 確認產物不變（只動 test 設定）。CLAUDE.md 不改（建議文字寫在回報區）。"
  - "🔴 先查根因再修：① 在全新 `npm ci` 後的 worktree 重現（第一次完整執行）並記錄哪些檔、哪個 hook、耗時；② 量這些檔 `beforeAll` 的實際耗時（單獨跑 vs 全套平行），找出瓶頸（server / PTY 啟動、port、node-pty `AttachConsole failed`、Electron binary 首次下載、CPU 爭用）；③ 修法擇一或組合：針對這些檔的 `hookTimeout`、把它們放進較低平行度的群組（以 repo 實裝的 vitest 版本支援的方式為準，例：檔案層 `describe.sequential`、專案 / pool 分組）、把一次性準備移到 globalSetup、修測試自身的資源清理。🔴 不得用全域大幅拉長 timeout 掩蓋真的掛住；任何 timeout 調整附量測依據。若用 fake timers，遵守 CLAUDE.md T0508 規則（不要 `vi.waitFor` 等 socket / IPC 事件）。"
  - "🔴 驗證：修正後在**全新**狀態（另開一個新 worktree 或清掉 `node_modules` 重新 `npm ci`）連續完整跑 `npm run test:unit` 3 次，每次都要第一次就 exit 0（附 passed / files 數與耗時）；整套耗時不得明顯增加（附修正前後）；`npm run test:legacy` 全綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npx vite build` exit 0。不碰使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）與其 userData / Terminal Server / `bat-pty-holder`。`TMP` 用系統預設（T0716）。程序清理照 D308（只結束本單啟動且可追溯的、一次一個、不 `taskkill /T`）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "🔴 公開 repo（D176）：回報區路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0898 — 修正 BUG-218：完整單元測試第一次執行時 headless e2e 逾時

## 背景

見 `_ct-workorders/BUG-218-unit-suite-headless-e2e-hook-timeouts.md`。2026-11-25 T0891 / T0894 / T0895 三個 worktree 的第一次完整 `npm run test:unit` 都有 4–6 個 RemoteServer / headless e2e 測試檔在 `beforeAll` 10 s 逾時，單獨重跑或第二次完整執行通過。CI 的 Test gate（T0686）一次失敗就擋發版，所以要讓整套一次就綠。

本單等 T0896 合併進 `v0.8.x` 後從新的 `v0.8.x` 開分支，與 T0897 並行；兩張完成後由一張合併工單一起併進 `v0.8.x` 並做 `0.8.0-pre.2` 發版前的最後一次完整驗收（D322）。

## 驗收

- [ ] 根因說明（量測證據）
- [ ] 全新狀態連續 3 次完整 `test:unit` 第一次就綠；整套耗時沒有明顯增加
- [ ] 沒有改產品程式；`test:legacy` 全綠、兩個 typecheck = 0、`vite build` exit 0
- [ ] 隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **session_id**：

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0898`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
