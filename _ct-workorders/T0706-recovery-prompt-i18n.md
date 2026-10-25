---
schema_version: 1
schema_kind: workorder
id: T0706
title: "BAT 重開時的 Recovery 提示（`RecoveryPrompt.tsx`）文字改走 i18n"
type: implementation
status: DONE
repo: better-agent-terminal
project: ""
priority: P3
sizing: S
created_at: "2026-10-25T21:32:11+0800"
started_at: "2026-10-25T21:33:21+0800"
updated_at: "2026-10-25T21:36:03+0800"
completed_at: "2026-10-25T21:36:03+0800"
depends_on: [T0705]
related:
  - "T0705 回報區「遭遇問題」：`src/components/RecoveryPrompt.tsx`（BAT 重開、Terminal Server 存活時的 Recovery 提示）文字寫死中文；T0705 已把 Terminal Server recovery toast 改走 i18n（`app.terminalServer*`，`src/locales/en.json` / `zh-TW.json` / `zh-CN.json`，`d7ffa080`）"
  - "使用者 2026-10-25 21:3x 指示「也排單」"
  - "CLAUDE.md「Dialog 不因點擊外部關閉、Esc 統一」：`RecoveryPrompt` 沒有 `onEscape`、擋下 Esc，列在 `dialog-escape.test.tsx` 的 `NO_ESCAPE_DIALOGS`；「Recovery 提示期間的 `pty:create`」（T0578）：「保留」/「重新開始」的放行流程"
affects_files:
  - src/components/RecoveryPrompt.tsx
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json（Recovery 提示的 key）"
  - "src/components/__tests__/（新測試或既有測試補項）"
  - _ct-workorders/T0706-recovery-prompt-i18n.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只換文字：標題、說明、按鈕（含「保留」/「重新開始」等）全部改 i18n key，沿用 T0705 與專案既有慣例（key 放在合適的區塊、camelCase）；zh-TW 與現在逐字相同，en / zh-CN 給對應翻譯；有插值（數量、名稱）就用 i18n 插值，不要字串拼接。"
  - "🔴 不改：提示的行為與時機、按鈕的回呼與放行流程（T0578）、`ModalOverlay` 用法、沒有 `onEscape` / 擋 Esc 的設定（`NO_ESCAPE_DIALOGS` 計數不得變）、CSS、`src/App.tsx` 的呼叫方式（除非 props 需要配合，先問塔台）。不改 `electron/**`、CLAUDE.md（T0704 正在改）。"
  - "🔴 驗證：RTL 測試涵蓋 zh-TW 字面與 T0706 前相同、en / zh-CN 每段文字有自己的譯文（不是 key、不是中文原文）、按鈕仍呼叫原本的回呼；`dialog-escape.test.tsx` 照舊通過。`npm run test:unit` 全綠、`npm run typecheck` = 0、`npx vite build` 成功。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。同時 T0704 在 repo 內工作（`electron/pty-manager.ts`、`electron/main.ts`、CLAUDE.md、docs）：只 commit 本單 `affects_files`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。工單完成狀態寫 `DONE`（不要寫 FIXED，那是 BUG 單狀態）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。yolo：不得問使用者，判讀問題問塔台（每輪最多 3 題）。"
---

# T0706 — Recovery 提示改走 i18n

## 背景

BAT 重開、Terminal Server 還活著且有分頁時，會跳出 Recovery 提示讓使用者選「保留」或「重新開始」（T0578）。提示文字寫死中文，英文與簡中介面下也是繁中。T0705 修 Terminal Server recovery toast 時發現，使用者指示一起排單。

## 實作

1. `src/components/RecoveryPrompt.tsx` 所有使用者看得到的文字改 i18n key。
2. 三個 locale 補 key。
3. RTL 測試。

## 驗收

- [x] 所有文字走 i18n，zh-TW 字面不變，en / zh-CN 有譯文
- [x] 行為、按鈕回呼、Esc 設定不變（`dialog-escape.test.tsx` 通過）
- [x] `npm run test:unit` 全綠；`npm run typecheck` = 0；`npx vite build` 成功

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策（僅 yolo Worker 有問題時）

（無）

### 互動紀錄

（無；yolo、未向塔台提問）

### 完成狀態

**DONE**

### 實作摘要

- `src/components/RecoveryPrompt.tsx`：標題、終端數量那一行、提問、兩顆按鈕全部改 `t()`；數量那一行用 `Trans`（`components={{ strong: <strong /> }}`、`count={ptyCount}`），數字仍在 `<strong>` 內，DOM 結構與 T0706 前相同。`🔄` 圖示留在 JSX（不分語言）。
- 新 key 放在 `app` 區塊，緊接 T0705 的 `terminalServer*`：`app.recoveryPromptTitle` / `recoveryPromptAlive` / `recoveryPromptQuestion` / `recoveryPromptRecover` / `recoveryPromptFreshStart`。插值用 i18next `{{count}}`，不做字串拼接。
- zh-TW 與 T0706 前逐字相同；zh-CN 為簡體對應；en 的數量行用 i18next 複數 `recoveryPromptAlive_one` / `_other`（中文兩個 locale 只有基底 key，i18next 對 zh 的 `_other` 找不到會回基底 key，測試已涵蓋）。
- 未改：提示的行為與時機、`onRecover` / `onFreshStart` 回呼與 T0578 放行流程、`ModalOverlay` 用法（仍無 `onEscape`，`NO_ESCAPE_DIALOGS` 計數不變）、CSS class、`src/App.tsx`、`electron/**`、CLAUDE.md。
- 新測試 `src/components/__tests__/recovery-prompt-i18n.test.tsx`（10 項）：zh-TW 每段字面與 T0706 前相同（含 `<strong>3</strong>`）；en / zh-CN 每個 key 有譯文、不是 key、不含 zh-TW 原文、不漏出 `<strong>` 字面；en 單數 / 複數；顯示中切換語言會更新；三語系下兩顆按鈕各自呼叫原回呼；source guard（元件不再含寫死的中文）。

### 驗證證據

- 落點檢查：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `src/components/RecoveryPrompt.tsx` 存在；C-2 無 `branch` 欄位（main）。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- 聚焦測試：`npx vitest run src/components/__tests__/recovery-prompt-i18n.test.tsx src/components/__tests__/dialog-escape.test.tsx` → 2 files / 31 tests passed（`dialog-escape.test.tsx` 照舊通過，含 `NO_ESCAPE_DIALOGS` source guard 與 RecoveryPrompt 擋 Esc 兩項）。
- `npm run test:unit` → Test Files 338 passed (338)；Tests 6017 passed / 3 skipped (6020)。輸出中的 stack trace 與 `HTMLCanvasElement's getContext()` 是既有測試的 stderr 雜訊，非失敗。
- `npm run typecheck` → exit 0（0 錯誤）。
- `npx vite build` → exit 0。
- 驗證時的 HEAD：`68ab2a42`（加上本單未提交變更）；之後 commit 為 `5006d129`，內容即驗證時的工作樹變更，未再修改。
- 所有變更檔為 LF（`` 計數 0）。

### 遭遇問題

- 執行期間塔台 / T0704 在 main 上陸續 commit（HEAD 由 `40d798a9` → `68ab2a42` → `277e7a2e`），本單只以 `git commit --only` 提交自己的檔案，未碰其他變更。
- 無 runtime smoke（實際 BAT 重開觸發 Recovery 提示）：本單驗收未要求，未做；如需實機目視三語系，可另排。

### Commit

- 產品：`5006d129` fix(recovery-prompt): T0706 Recovery prompt text via i18n（`src/components/RecoveryPrompt.tsx`、`src/locales/en.json`、`zh-CN.json`、`zh-TW.json`、`src/components/__tests__/recovery-prompt-i18n.test.tsx`）
- 工單：本檔另一個 commit（`chore: T0706 report, DONE (ct)`）
- 未 push、未觸發 workflow、未建 tag。

### 回報時間

2026-10-25T21:36:03+0800
