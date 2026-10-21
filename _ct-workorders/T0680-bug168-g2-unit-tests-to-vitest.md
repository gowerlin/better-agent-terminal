---
schema_version: 1
schema_kind: workorder
id: T0680
title: "BUG-168 G2：auth-result-metadata／claude-runtime-router／docker-flow／profile-card 四個舊測試跟上產品並收進 vitest（profile-card 改 RTL 實際渲染）"
type: fix
status: TODO
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: M
created_at: "2026-10-21T20:38:28+0800"
depends_on:
  - "T0679（DONE `6fb40e70`：逐項分類與證據）"
related:
  - "D177（G1～G4 全做、往 vitest 收斂）；BUG-168；T0679 回報區「調查結論」表（本單四個檔的失敗原因、產品位置、commit 與工單）"
  - "既有 vitest 版：`electron/__tests__/claude-runtime-router.test.ts`、`src/components/profiles/__tests__/SshDetails.test.tsx`、`electron/remote/__tests__/remote-client-*.test.ts`"
affects_files:
  - tests/auth-result-metadata.test.ts
  - tests/claude-runtime-router.test.ts
  - tests/docker-flow.test.ts
  - tests/profile-card.test.ts
  - electron/__tests__/claude-runtime-router.test.ts
  - "electron/remote/__tests__/remote-client-*.test.ts 或新檔 electron/remote/__tests__/auth-result-metadata.test.ts（只限這兩種名稱）"
  - "src/components/profiles/__tests__/**"
  - "src/components/setup-wizard/__tests__/docker-flow*.test.ts（新檔，若需要）"
  - _ct-workorders/T0680-bug168-g2-unit-tests-to-vitest.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改測試，不改產品程式。T0679 已判定這四個檔的失敗全部是測試過時（A），期望值以 T0679 表中的工單與決策為準，不要把舊的錯誤期望搬進 vitest。"
  - "🔴 收斂規則（D177）：每個 `tests/` 檔逐項比對 vitest 版；重複的不搬，獨有且仍有效的搬進 vitest（更新成現行正確的期望），最後刪掉 `tests/` 的舊檔。沒有 vitest 版的就新建在 `affects_files` 允許的位置。"
  - "🔴 個別要求：auth-result-metadata 的 fallback 覆蓋改用缺 `wslDistro` 的 profile（T0679 建議），不要刪掉 fallback 情境；claude-runtime-router 的 stub 補 `embeddedClaudeExists`；docker-flow 斷言 `serverPort` 為 `undefined`（T0649）；profile-card 改用 React Testing Library 實際渲染並初始化 i18n（比照既有 `src/components/profiles/__tests__/SshDetails.test.tsx` 與 repo 內其他 RTL 測試的做法），涵蓋 T0679 列的 4 個情境，並補上 ProfileCard、DockerDetails 目前沒有的 vitest 覆蓋。"
  - "🔴 不改 `package.json`、`vite.config.ts`、`tests/__mocks__/**`（G4 的範圍）。刪檔後若有 `package.json` script 指向它們，列在回報區，由後續 CI 工單清理。"
  - "🔴 同時有 T0681（SSH／WSL 舊測試）與 T0683（CI 第一步）的 Worker 在跑：只動 `affects_files`；commit 用 `git commit --only <檔案>`（刪檔用 `git rm` 後同樣只 commit 自己的路徑），不要 `git add -A`。"
  - "🔴 驗證：`npm run test:unit` 全過（記通過數與檔數，應比基線 5661 / 322 增加）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功；刪掉的四個 `tests/` 檔在 repo 內（`package.json` 以外）沒有其他引用。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，測試資料用 `demo`／`tester`／代稱。Git：不 push；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。不跑 Playwright e2e。yolo：不得問使用者，判讀問題問塔台；不得寫出權杖值。"
---

# T0680 — BUG-168 G2：四個舊測試收進 vitest

## 目標

`tests/` 底下 auth-result-metadata、claude-runtime-router、docker-flow、profile-card 四個檔共 11 項失敗，T0679 判定全部是測試過時。依 D177 往 vitest 收斂：獨有且仍有效的情境搬進 vitest（期望值改成現行正確行為），重複的不搬，刪掉舊檔；profile-card 改用 RTL 實際渲染，順便補上 ProfileCard、DockerDetails 的 vitest 覆蓋。

## 要做的事

1. 讀 T0679 回報區這四個檔的分類表。
2. 逐檔比對 vitest 版，搬移獨有情境、更新期望值；沒有 vitest 版的新建。
3. 刪掉四個 `tests/` 舊檔（`git rm`）。
4. 驗證、commit（不 push）。

## 驗收

- 四個舊檔已刪；獨有情境在 vitest 版都有對應（回報區列對照表：舊項目 → 新位置，或「重複，未搬」）。
- `test:unit` 全過且數量增加；typecheck 0／0；build 成功。
- 只改 `affects_files`；未 push。

---

## 回報區

### 完成狀態

### 對照表（舊項目 → vitest 位置／重複未搬）

### 驗證結果

### 因刪檔而失效的 package.json script

### Commit

### 遭遇問題

### 回報時間
