---
schema_version: 1
schema_kind: workorder
id: T0706
title: "BAT 重開時的 Recovery 提示（`RecoveryPrompt.tsx`）文字改走 i18n"
type: implementation
status: PENDING
repo: better-agent-terminal
project: ""
priority: P3
sizing: S
created_at: "2026-10-25T21:32:11+0800"
started_at: ""
updated_at: "2026-10-25T21:32:11+0800"
completed_at: ""
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

- [ ] 所有文字走 i18n，zh-TW 字面不變，en / zh-CN 有譯文
- [ ] 行為、按鈕回呼、Esc 設定不變（`dialog-escape.test.tsx` 通過）
- [ ] `npm run test:unit` 全綠；`npm run typecheck` = 0；`npx vite build` 成功

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 實作摘要

### 驗證證據

### 遭遇問題

### Commit

### 回報時間
