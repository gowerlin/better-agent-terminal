---
schema_version: 1
schema_kind: workorder
id: T0844
title: "發 0.7.4-pre.7 前的整批驗證：HEAD 上的四個關卡＋legacy＋verify-native、重跑 T0836 e2e 與 T0841 的 V3 e2e"
type: verification
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-04T13:17:17+0800"
started_at: ""
updated_at: "2026-11-04T13:17:17+0800"
completed_at: ""
session_ids: []
depends_on: [T0843]
related:
  - "D271–D274；本批 T0826–T0843；T0836（e2e 當時 build 含 T0840 未提交改動，需在乾淨 HEAD 重跑）；T0841（V3 e2e 以暫存副本跑過）"
affects_files:
  - _ct-workorders/T0844-pre7-batch-verification.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只驗證、不修：不改任何產品檔、測試檔或 e2e spec；發現失敗寫進回報區〈發現的問題〉（含指令、輸出摘錄、判斷是否本批引入），由塔台開單。暫存副本（例如 T0841 的版本常數副本）放 scratchpad 或用完即刪，不 commit。"
  - "🔴 e2e 一律隔離 runtime；不碰本機 BAT 安裝版與它的 Terminal Server、不改使用者的 `.wslconfig` / WSL 發行版設定、不執行 `wsl --shutdown`。T0836 e2e 需要 `Ubuntu-24.04` 執行中：比照 T0836 的做法以帶標記的 `sleep` 維持執行、跑完結束它；跑前後比對 T0836 的環境清單。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本工單檔。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0844 — pre.7 整批驗證

## 元資料
- **工單編號**：T0844｜**類型**：verification｜**狀態**：PENDING｜**建立**：2026-11-04 13:17 (UTC+8)
- **規模**：S｜開工時記錄 `git rev-parse HEAD`（預期為 `a62a062c` 之後只有塔台記帳 commit）

## 任務指令

在目前 `main` HEAD（工作樹乾淨；若有非 `_ct-workorders/` 的未提交變更，停下問塔台）依序執行並記錄 exit code、摘要數字：

1. `npm run typecheck`、`npm run typecheck:electron`（期望 0 / 0）
2. `npm run test:unit`（記錄檔數 / 測試數 / skipped）
3. `npm run test:legacy`
4. `npx vite build`
5. `node scripts/verify-native-modules.js`、`npm run verify:helpers`
6. **T0836 e2e**（乾淨 build）：`$env:BAT_E2E_T0836='1'; npx playwright test e2e/t0836-remote-upload-acceptance.spec.ts`（含 T0843 新增的 ①a soft 斷言）
7. **T0841 V3 e2e**：照 T0841 回報區〈驗證證據分道〉的做法（`npm run build:dir` → `BAT_E2E_V071PRE2=1`、`BAT_E2E_EXECUTABLE=<win-unpacked exe>`、`-g "WSL wizard"`；版本常數用暫存副本，跑完刪除）
8. `CHANGELOG.md` `[Unreleased]`：列出本批條目（不改檔），對照 T0826–T0843 是否都有使用者可見的條目（純內部的 T0838 / T0839 / T0832 / T0833 可以沒有），缺的寫進回報

### 驗收條件
- [ ] 1–7 全部 PASS，或失敗都附原因與是否本批引入
- [ ] 環境前後比對相同；暫存檔已清

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 驗證結果

### 發現的問題

### 互動紀錄

### 回報時間
