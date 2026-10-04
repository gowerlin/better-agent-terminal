---
schema_version: 1
schema_kind: workorder
id: T0364
title: "parser-parity 測試樣本改為可在 _archive/ 找到（修 7243ce2 *archive 造成的 4 failed）"
type: fix
status: PENDING
priority: P1
sizing: XS
created_at: "2026-10-04T11:24:33+08:00"
updated_at: "2026-10-04T11:24:33+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "T0363（DONE，回報區「遭遇問題 1」首先發現）"
  - "7243ce2（*archive 7 items，移走 T0335/T0336/T0337/BUG-081）"
  - "T0346（parser-parity 測試原始作者工單，PLAN-034 Sprint 5）"
affects_files:
  - src/types/__tests__/parser-parity.test.ts
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不要用「換樣本」解決**。測試檔頭註解寫的是「If a sample is renamed or archived, swap it」，但塔台 `*archive` 每隔幾個 session 就會跑一次，換樣本只是把下次失敗往後推。本工單**刻意改變該契約**：讓測試同時在 `_archive/` 找樣本，並同步改寫檔頭註解。"
  - "🔴 **不要把測試改成 skip / 找不到就 pass**。樣本在熱區與冷區都找不到時仍須 fail（那才是真的被刪/改名）。"
---

# T0364 — parser-parity 測試樣本改為可在 `_archive/` 找到

- **狀態**：PENDING
- **任務類型**：fix（測試）
- **工作量預估**：XS
- **Context Window 風險**：低（單檔）

## 背景

`src/types/__tests__/parser-parity.test.ts` 以 `_ct-workorders/` 下的**真實檔案**當樣本（:35-41 `SAMPLES`），`readSample()` 只查 `join(CT_DIR, filename)`。

塔台第四十八 session 的 `*archive`（commit `7243ce2`，已在 `origin/main`）以 `git mv` 把其中 4 個樣本移入冷區：

| 樣本 | 現在位置 |
|------|---------|
| `T0335-fix-bug074-ssh-input-step-awaiting-input.md` | `_ct-workorders/_archive/workorders/` |
| `T0336-fix-bug073-docker-detect-env-mapping-preflight.md` | `_ct-workorders/_archive/workorders/` |
| `T0337-fix-bug072-wsl-linger-systemd-mapping.md` | `_ct-workorders/_archive/workorders/` |
| `BUG-081-bat-notify-submit-enters-multiline-instead-of-submit.md` | `_ct-workorders/_archive/bugs/` |

結果：`npm run test:unit` → **546 passed / 4 failed**（塔台 2026-10-04 已單獨重現：`npx vitest run src/types/__tests__/parser-parity.test.ts` → 4 failed / 1 passed）。歸檔前（`89292e8`）四檔皆在熱區，550 全綠。

歸檔是 `git mv`（R100，內容未變），所以樣本本身仍然有效——只是測試找不到。

## 範圍

只改 `src/types/__tests__/parser-parity.test.ts`：

1. `readSample()` 依序搜尋：
   1. `_ct-workorders/<filename>`（熱區，優先）
   2. `_ct-workorders/_archive/<subdir>/<filename>`，`subdir` 依 `sample.kind` 對應：`workorder` → `workorders`、`bug` → `bugs`、`plan` → `plans`
   
   找到即回傳內容；兩處都沒有才回 `null`（現行 fail 邏輯不變）。函式簽章可改為接收 `Sample`（或 `filename` + `kind`），由你決定。
2. 找不到時的錯誤訊息改為同時列出兩個查找路徑，並把「Replace with another …」的提示保留（真的被刪/改名時仍適用）。
3. 改寫檔頭註解第 13-15 行：說明樣本可位於熱區或 `_archive/<kind>s/`，歸檔不需換樣本；只有改名或刪除才需替換。
4. `SAMPLES` 清單**不改**（5 個樣本維持原樣）。

## 明確排除（不要做）

- ❌ 不要換樣本、不要增刪 `SAMPLES` 項目
- ❌ 不要改 parser（`control-tower.ts` / `bug-tracker.ts` / `backlog.ts`）或其他測試
- ❌ 不要把找不到改成 skip / pass
- ❌ 不要搬動 `_ct-workorders/` 下任何檔案（不要把樣本 `git mv` 回熱區）
- ❌ 不要碰 `AGENTS.md`（既有 dirty）
- ❌ 不要 push（未授權）

## 驗收條件

- [ ] AC-1 `npx vitest run src/types/__tests__/parser-parity.test.ts` → **5 passed / 0 failed**
- [ ] AC-2 `npm run test:unit` → **550 passed / 0 failed**（基線恢復全綠）
- [ ] AC-3 負向驗證：暫時把 `SAMPLES` 中一個檔名改成不存在的名字，確認該 case **仍會 fail** 且訊息列出兩個路徑；驗證後還原（不得 commit 此暫時修改）。在回報區貼出失敗訊息
- [ ] AC-4 `npx vite build` 成功（CLAUDE.md「No Regressions Policy」）
- [ ] AC-5 `git diff --stat` 僅 `src/types/__tests__/parser-parity.test.ts` 一檔

## Sub-session 執行指示

1. 讀取本工單全部內容
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 讀 `src/types/__tests__/parser-parity.test.ts` 全檔
4. 實作範圍 1-3
5. 跑 AC-1 ~ AC-5
6. 填寫回報區、更新 `status` / `completed_at` / `updated_at`
7. commit（`git commit --only src/types/__tests__/parser-parity.test.ts`），訊息建議：`test(ct): let parser-parity find samples in _archive (T0364)`
8. 依 `auto-session: on` 協定通知塔台（`bat-notify.mjs`，**不加 `--submit`**）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 驗收條件逐項

### 遭遇問題

### 回報時間
