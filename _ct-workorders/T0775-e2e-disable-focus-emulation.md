---
schema_version: 1
schema_kind: workorder
id: T0775
title: "e2e：t0735 / t0757 / t0761 關掉 Playwright focus emulation，讓「視窗有焦點」那一支量到真的焦點"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-02T05:24:41+0800"
depends_on: [T0774, T0776]
related:
  - "T0770 回報〈發現的問題〉觀察 1；`e2e/t0770-unfocused-wait-missed.spec.ts`（CDP `Emulation.setFocusEmulationEnabled(false)` 的作法）；BUG-193 / T0774；D216"
affects_files:
  - e2e/t0735-workspace-waiting-badge.spec.ts
  - e2e/t0757-mouse-answer-clears-waiting.spec.ts
  - e2e/t0761-detached-workspace-waiting.spec.ts
  - docs/agent-guide/worker-tab-recycle.md
  - _ct-workorders/T0775-e2e-disable-focus-emulation.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 派工時機：T0774 與 T0776 都收單後（D217；本單用 T0776 最後建出的 source build 驗，確認兩個修正後三支仍綠）。🔴 不得跑 `npx vite build`，用 T0776 留下的 `dist` / `dist-electron`；若 HEAD 的 `src` / `electron` / `scripts` 與那份 build 不同，回報後停下。"
  - "🔴 範圍：三支 spec 比照 t0770，在需要判斷「視窗有焦點」的步驟前以 CDP 關掉 focus emulation，並在那些步驟記錄作業系統層的焦點證據（Electron `BrowserWindow.getFocusedWindow()` 與 renderer `document.hasFocus()`）；原本會走到 skip 分支的地方，改成真的失焦或真的有焦點時各自斷言。🔴 不改斷言語意（規則以 D200–D203 與 BUG-193 修正後的 `worker-tab-recycle.md` 為準）；不改 `e2e/fixtures/electron-isolation.ts`（需要的 helper 寫在各 spec 內，或三支共用的程式碼抽到新的 `e2e/helpers/` 檔並列進回報）。"
  - "🔴 驗證：三支各連跑 2 次綠；故意讓視窗失焦（例：開 focus-sink 視窗）時，原本假設有焦點的斷言會失敗或走正確分支（證明這次真的量到焦點，回報附證據）。`npm run typecheck` = 0、`npm run typecheck:electron` = 0。`worker-tab-recycle.md` 驗證清單補一行（e2e 焦點注意事項）。不改產品程式碼；發現產品缺陷 → 〈發現的問題〉。不發版、不 push。公開 repo 去識別化（D176）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0775 — e2e：關掉 Playwright focus emulation

## 元資料

- **工單編號**：T0775
- **類型**：implementation（只改 e2e）
- **優先級**：P3
- **建立時間**：2026-11-02T05:24:41+0800
- **預估規模**：S

## 背景

T0770 發現 Playwright 預設對頁面做 focus emulation，`document.hasFocus()` 永遠回 true；t0735 / t0757 / t0761 的「看著分頁時不留淡化」等斷言因此沒有真的驗到作業系統層的焦點。使用者裁示開單，排在 BUG-193（T0774）之後一起驗（D216）。

## 範圍

1. 三支 spec 關 emulation、補焦點證據。
2. 連跑與反證。
3. docs 一行。

## 不做

- 不改產品程式碼、不 build、不改共用 fixture。

## 驗收

- [ ] 三支各連跑 2 次綠，附焦點證據
- [ ] 反證：失焦時斷言走正確分支
- [ ] 兩個 typecheck = 0

---

## 回報區
