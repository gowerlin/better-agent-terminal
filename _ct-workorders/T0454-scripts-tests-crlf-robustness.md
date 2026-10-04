---
schema_version: 1
schema_kind: workorder
id: T0454
title: "scripts/__tests__ 在 CRLF checkout 下失敗（autocrlf=true + 無 .gitattributes）：3 檔載入 SyntaxError、server-bundle-helpers 原始碼 regex 不容 \\r\\n——查根因、改為換行無關；評估 .gitattributes（只建議不套用）"
type: fix
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T06:46:30+08:00"
started_at: null
updated_at: "2026-10-05T06:46:30+08:00"
completed_at: null
target_version: next
depends_on:
  - T0434
related:
  - "塔台 06:45 聯合複驗（乾淨 worktree HEAD `e52f738`）：`dev-deploy-headless` / `remote-tools-install-check` / `smoke-remote-headless` 三檔載入 `SyntaxError: Invalid or unexpected token`；`server-bundle-helpers.test.mjs` regex `\\n {2}await copyHelperScripts\\(\\)\\n\\}` 不命中 CRLF；主工作區（LF）全綠"
  - "根因線索：系統 gitconfig `core.autocrlf=true`（`C:/Program Files/Git/etc/gitconfig`）、repo 無 `.gitattributes` → 新 checkout 為 CRLF；PLAN-036「塔台驗證環境備註」記為 worktree 異常、未深追"
  - "D134 追加（塔台 06:46 依授權直接決定）"
affects_files:
  - scripts/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **重現方式**：在 scratchpad 建乾淨 worktree（`git -c core.longpaths=true worktree add --detach <scratchpad>/crlf-wt HEAD`，`node_modules` 以 junction 指向主工作區），確認檔案為 CRLF 後跑這 4 檔重現；修完在同一 worktree（以 `git -C <wt> checkout --detach <新 commit>` 更新）驗證綠，主工作區也綠。結束後 `git worktree remove` 該 worktree。"
  - "🔴 **查 SyntaxError 真因**（例如 CRLF 下某 `.mjs` 內多行 template / regex / shebang 處理、或測試以文字讀檔後 `eval` / `new Function` / `vm`），回報區附證據。修法以「測試與被測腳本對換行無關」為準（regex 用 `\\r?\\n`、讀檔後正規化換行等）；不得改變被測腳本的對外行為。"
  - "🔴 **塔台 07:07 線索（T0434 遭遇問題 5）**：T0434 以 Python 文字模式寫檔產生 CRLF，**shebang 行帶 `\\r` 時 vitest 轉譯報 `SyntaxError: Invalid or unexpected token`**——高度疑似即三檔載入失敗的真因（被測 `.mjs` 首行 `#!/usr/bin/env node\\r`）。請先驗證此假設；若成立，修法可在測試載入端處理，或評估 vitest / 轉譯設定，回報區說明。"
  - "🔴 `.gitattributes`：**只評估、不新增**（會牽動全 repo 正規化，屬塔台 / 使用者決定）。回報區給建議內容與影響（哪些檔會被 renormalize、CI / 打包是否受影響）。"
  - "🔴 依賴 T0434（同改 `scripts/__tests__/`）。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；worktree 的 `checkout --detach <commit>` 不在此限，因為只在 scratchpad worktree 內）；不 push。"
---

# T0454 — scripts 測試換行無關

## 驗收條件

- [ ] 回報區附 SyntaxError 真因證據
- [ ] CRLF worktree 與主工作區兩邊 `scripts/__tests__` 全綠
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] 回報區附 `.gitattributes` 建議

## Sub-session 執行指示
1. 讀本工單 + PLAN-036「塔台驗證環境備註」
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 重現 → 查因 → 修 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
