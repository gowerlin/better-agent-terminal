---
schema_version: 1
schema_kind: workorder
id: T0678
title: "BUG-167：profile-manager 遷移測試的 2 項斷言跟上新增的 profile 欄位；順帶盤點 tests/ 底下其他用 tsx 執行的測試"
type: fix
status: TODO
repo: better-agent-terminal
project: BUG-167
priority: P3
sizing: S
created_at: "2026-10-21T19:17:17+0800"
depends_on: []
related:
  - "BUG-167（T0677 Worker 發現：docker-linux、ssh-linux 兩個情境的 metadata 斷言失敗，HEAD 同樣 10 / 2）"
  - "多 remote profile 規則：CLAUDE.md「多 remote profile 同時連線（PLAN-039）」節、`docs/agent-guide/multi-remote-profiles.md`；profile index 讀改寫一律經 `withIndexLock()`（`electron/profile-manager.ts`）"
affects_files:
  - tests/profile-manager-migration.test.ts
  - _ct-workorders/BUG-167-profile-manager-migration-test-stale-assertions.md
  - _ct-workorders/T0678-fix-bug167-profile-migration-test-assertions.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先查清楚再改：用 `git log -S`／`git log -p` 找出多出來的欄位是哪個 commit／工單加的，確認遷移後的 profile 應不應該帶這些欄位。是預期行為 → 只改 `tests/profile-manager-migration.test.ts` 的斷言；看起來是遷移邏輯錯誤 → **不要改產品程式**，依 ct-exec § Questions For Tower 問塔台（附證據）。"
  - "🔴 斷言要寫成能抓到真錯誤的樣子：列出預期的欄位與值，不要為了通過改成只比對部分欄位或拿掉斷言。若新欄位的值會隨環境變動（時間戳、隨機 id），只對那幾個欄位放寬，並在測試裡註明原因。"
  - "🔴 驗證：`npx tsx tests/profile-manager-migration.test.ts` 全過（記通過數）。只改測試檔時不必跑全套；若因故改到 `tests/` 以外的檔案，必跑 `npm run test:unit`、`npm run typecheck`、`npm run typecheck:electron`、`npx vite build`。"
  - "🔴 順帶盤點（只跑、不修）：列出 `tests/` 底下不在 `npm run test:unit` 範圍的測試檔（查 `vite.config.ts` 的 test.include 與 `package.json` scripts），逐一用它的實際跑法執行一次，記下通過／失敗數。手動 probe（例如 `_` 開頭、需要本機特定路徑的）只記「略過與原因」。有失敗的列出檔名與失敗項目名稱，不在本單修。"
  - "🔴 本單完成時把 BUG-167 的 `status` 改成 FIXED、`updated_at` 取自系統、狀態欄寫上 commit；`_bug-tracker.md` 由塔台同步，不要改。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，測試資料與回報只用代稱與 `demo`／`tester` 這類範例值。"
  - "🔴 Git：`git commit --only <檔案>`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。含反斜線的內容用 Write／Edit 工具寫（L129）。不跑 Playwright e2e。yolo：不得問使用者，判讀問題問塔台；不得在任何地方寫出權杖值。"
---

# T0678 — BUG-167：遷移測試的斷言跟上新增的 profile 欄位

## 目標

`tests/profile-manager-migration.test.ts` 有 2 項斷言失敗（docker-linux、ssh-linux 的 metadata），實際值比期望多了後來新增的 profile 欄位。這個檔案不在 `test:unit`，CI 沒跑，所以一直沒被發現。本單查清楚欄位來源，確認是測試沒跟上之後更新斷言；並順帶盤點 `tests/` 底下其他同樣沒被跑到的測試。

## 要做的事

1. 跑一次測試，記下兩個失敗項目的實際值與期望值差在哪些欄位。
2. 用 git 歷史找出這些欄位是哪個 commit／工單加的，讀那張工單的說明，判斷遷移後應不應該帶這些欄位。
3. 是預期行為：更新斷言（見 memory_overrides 的寫法要求）。不是：停下來問塔台。
4. 盤點 `tests/` 底下其他不在 `test:unit` 的測試（只跑、不修）。
5. 更新 BUG-167 狀態，commit。

## 驗收

- `npx tsx tests/profile-manager-migration.test.ts` 全過。
- 回報區寫明：多出來的欄位是什麼（欄位名即可）、來自哪個 commit／工單、為什麼判定是預期行為；盤點結果表（檔名、跑法、通過／失敗、略過原因）。
- 只改 `affects_files`；未 push。

---

## 回報區

### 完成狀態

### 欄位來源與判斷

### 修改內容

### 驗證結果

### tests/ 盤點（只跑、不修）

### Commit

### 遭遇問題

### 回報時間
