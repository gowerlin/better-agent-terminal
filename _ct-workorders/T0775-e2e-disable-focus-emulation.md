---
schema_version: 1
schema_kind: workorder
id: T0775
title: "e2e：t0735 / t0757 / t0761 關掉 Playwright focus emulation，讓「視窗有焦點」那一支量到真的焦點"
type: implementation
status: DONE
started_at: "2026-11-02T05:57:22+0800"
updated_at: "2026-11-02T06:10:48+0800"
completed_at: "2026-11-02T06:10:48+0800"
session_ids:
  - "7fdde289-4606-4847-a4ef-11e00cdc3785"
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

- [x] 三支各連跑 2 次綠，附焦點證據（t0757 第 2 次 flake 一次，見〈發現的問題〉；之後連 2 次綠）
- [x] 反證：失焦時斷言走正確分支
- [x] 兩個 typecheck = 0

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-02T06:10:48+0800
- **session_id**：7fdde289-4606-4847-a4ef-11e00cdc3785
- **產品 commit**：`1068c5f8`（`test(e2e): t0735 / t0757 / t0761 measure the real window focus (T0775)`）

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 底下 → PASS
- C-3：前 5 筆 `affects_files`（3 支 spec、`docs/agent-guide/worker-tab-recycle.md`）都存在 → PASS
- C-2：工單沒有 `branch` 欄位，不適用（目前 `main`）
- `CT_HOME` 未設定（不是 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a`（僅記錄）；`CT_MODE` = `yolo`

### build 前置確認（memory_overrides 第 1 條）

- 沒有跑 `npx vite build`，用 T0776 留下的 build：`dist/index.html` 與 `dist-electron/main.js` 的 mtime 都是 2026-11-02 05:52。
- `src` / `electron` / `scripts` 沒有任何檔案比 `dist/index.html` 新（`find -newer` 為空）；最後一個動到這三個目錄的 commit 是 `e717c786`（T0776 修正），它和 HEAD 之間在這三個目錄沒有差異（`git diff --stat e717c786 HEAD` 為空）。T0776 回報區記錄「修正後 build 一次」→ 判定 build 與 HEAD 原始碼相同，繼續執行。

### 改動摘要

| 檔案 | 改動 |
|---|---|
| `e2e/helpers/real-focus.ts`（新檔，三支共用） | `disableFocusEmulation`（CDP `Emulation.setFocusEmulationEnabled(false)`）、`focusEvidence`（renderer `document.hasFocus()` + Electron `BrowserWindow.getFocusedWindow()` → `main` / `detached` / `focus-sink` / `none`）、`focusWindow`（`show()` + `focus()`，只在該視窗還沒有焦點時呼叫，避免對已有焦點的視窗觸發 focus-out / in）、`openFocusSink` / `closeFocusSink`（比照 t0770 的 focus-sink 視窗）、`takeFocus`（給焦點並記 `[focus] …` 日誌；`BAT_E2E_FORCE_UNFOCUSED=1` 或 `opts.forceUnfocused` 時改開 focus-sink，供反證用） |
| `e2e/t0735-workspace-waiting-badge.spec.ts` | reload 後關 emulation；步驟 4 改用 `takeFocus` 取焦點、`done` 前後各記一次證據並斷言焦點沒變；有焦點 → `focusedWindow` = `main`、列 ⚠️ 消失且 1.5 s 後仍不出現淡化；沒焦點 → `focusedWindow` ≠ `main`、列淡化（`data-waiting=missed`、`.missed`）。拿掉 `skip-step` 註記 |
| `e2e/t0761-detached-workspace-waiting.spec.ts` | 主視窗與 detached 視窗都關 emulation；「等待前主視窗有焦點」改用 `focusWindow` 並記兩個視窗的證據；步驟 4 點列後記 detached 的證據；步驟 5 以 detached 視窗的真實焦點分兩支（有焦點 → 列消失且不回來；沒焦點 → 列留下淡化），拿掉 `skip-step` |
| `e2e/t0757-mouse-answer-clears-waiting.spec.ts` | SessionStart 後關 emulation；每次回答前 `focusFor(key)`；`expectCleared` 改以**清除後**的真實焦點分兩支（有焦點 → 縮圖 / 列不留淡化，1 s 後再確認；沒焦點 → `focusedWindow` ≠ `main`、縮圖 `.missed` + 列 `data-waiting=missed`）；結尾印出每一步的焦點判定；清除原因不符時多記一行診斷（該分頁的 `[blocked]` 行與 hooks）。反證只強制 K（鍵盤回答）失焦，原因見下 |
| `docs/agent-guide/worker-tab-recycle.md` | T0770 那一行末句改成「T0775 前…」；驗證清單新增一行「e2e 焦點注意事項（T0775）」 |

- 斷言語意沒有改：有焦點且看著該分頁時結束 → 不留淡化，沒焦點時結束 → 淡化（D203 ③、BUG-193 修正後的 `worker-tab-recycle.md`）。原本「沒焦點 → skip」的地方改成斷言淡化。
- 沒有改 `e2e/fixtures/electron-isolation.ts`、產品程式碼，沒有 build。
- t0757 為何以「清除後」的焦點判斷：Playwright 滑鼠點擊會先讓失焦的視窗取回焦點，再送 pointerdown（T0770 E / T0774 實測），所以點擊回答時「等待結束的那一刻」視窗已經有焦點；鍵盤回答（K，經 `pty.write`）不改變焦點，前後一致。
- t0757 的反證為何只強制 K：①–⑤ 是點擊回答，點擊本身會把焦點拿回來（強制失焦也會走有焦點那一支），而且 claude 2.1.316 會忽略帶 focus-in 的點擊（spec 原註解），強制失焦會讓後面的步驟因 claude 行為失敗、無關焦點斷言。

### 驗證

證據檔（`[focus]` 日誌全文）留在本機 scratchpad，回報區只摘要；以下 `hasFocus` = renderer `document.hasFocus()`（emulation 已關），`focusedWindow` = `BrowserWindow.getFocusedWindow()`。

| spec | 第 1 次 | 第 2 次 | 焦點證據（每次相同） |
|---|---|---|---|
| t0735 | 1 passed（5.6 s） | 1 passed（6.3 s） | 步驟 4 `done` 前後都是 `{"hasFocus":true,"focusedWindow":"main"}` → 不留淡化 |
| t0761 | 1 passed（14.3 s） | 1 passed（13.9 s） | 等待前 main `{true,"main"}`、detached `{"hasFocus":false,"focusedWindow":"main"}`；步驟 5 `done` 前後 detached `{"hasFocus":true,"focusedWindow":"detached"}` → 列消失 |
| t0757 | run1 passed（1.1 m）；run2 **failed**（③，見〈發現的問題〉）；run3 passed（1.1 m）；run4 passed（1.1 m） | — | ①–⑤、K 每一步回答前與清除後都是 `{"hasFocus":true,"focusedWindow":"main"}` → 不留淡化；⑥ codex 照舊 PASS（PROBE 測試照設計 skip） |

連跑 2 次綠：t0735（run1、run2）、t0761（run1、run2）、t0757（run3、run4；run2 失敗後重跑，run2 的焦點證據也是 `{true,"main"}`）。

**量到的是真的焦點**：t0761 等待前 detached 視窗回 `hasFocus: false`（主視窗有焦點時），在 emulation 下這個值一定是 true（T0770 實測）。

**反證（`BAT_E2E_FORCE_UNFOCUSED=1`，各跑 1 次，全部 1 passed）**：

| spec | 失焦方式與證據 | 走的分支 |
|---|---|---|
| t0735 | 步驟 4 前開 focus-sink：`done` 前後 `{"hasFocus":false,"focusedWindow":"focus-sink"}` | 淡化：A 列 `data-waiting=missed` + `.missed`（原本假設有焦點的「列消失」斷言在此狀態不可能成立） |
| t0761 | 步驟 5 前開 focus-sink：`done` 前後 detached `{"hasFocus":false,"focusedWindow":"focus-sink"}` | 淡化：列留下 `data-waiting=missed` + `.missed` |
| t0757 | K 前開 focus-sink：回答前與清除後 `{"hasFocus":false,"focusedWindow":"focus-sink"}`；①–⑤ 仍 `{true,"main"}` | K 淡化：縮圖 `.missed` + 列 `data-waiting=missed`；之後關 focus-sink、主視窗取回焦點，⑥ 照舊 PASS |

（t0757 反證是在加入「清除原因不符時的診斷日誌」那一行之前跑的；那一行只在原因不符時記日誌，不影響斷言。）

**typecheck**：`npm run typecheck` = 0、`npm run typecheck:electron` = 0。e2e 不在兩個 tsconfig 範圍內，另以 `tsc --noEmit --strict --lib ES2022,DOM,DOM.Iterable --types node`（`--moduleResolution bundler`）單獨檢查 helper 與三支 spec = 0。

### 發現的問題

1. **t0757 偶發失敗（flake，與焦點無關）**：run2 在 ③ 失敗：`expectCleared('③')` 找到的第一個清除行是 `→ cleared (hook user-prompt-submit)`，代表送出 ③ 的 prompt 時該分頁已經又是 blocked（② 以滑鼠「No」清除之後又被標成 blocked）。推測是 claude 在 ② 的 `permission-request` hook 較晚送達（① 的 hooks 紀錄顯示 claude 對同一個權限送了兩次 `permission-request`），落在滑鼠按下的清除之後。run2 的焦點證據一路都是 `{true,"main"}`，失敗發生在焦點分支之前的清除原因斷言，與 T0775 的改動無關；隔離實例的日誌在 teardown 被刪除，無法確認。已在 spec 加一行診斷（原因不符時記錄該分頁自 mark 以來的 `[blocked]` 行與 hooks），之後連跑 2 次沒有再發生。若再發生可依該日誌判斷是否是產品端「晚到的 hook 在滑鼠清除後重新 blocked」（T0757 / BUG-188 的邊界）—— 建議塔台視需要開單觀察，本單未改產品程式碼。
2. 無產品缺陷。

### 相關檔案

- `e2e/helpers/real-focus.ts`（新）
- `e2e/t0735-workspace-waiting-badge.spec.ts`
- `e2e/t0757-mouse-answer-clears-waiting.spec.ts`
- `e2e/t0761-detached-workspace-waiting.spec.ts`
- `docs/agent-guide/worker-tab-recycle.md`

### 互動紀錄

- 無（yolo，未向塔台提問）。

### Git

- 產品 commit `1068c5f8`（`git commit --only` 5 個檔）；工單 commit 另一筆（本檔）。未 push。
- 去識別化（D176）：commit 內容以 `gower|C:\Users|/Users/|@gmail` 掃描無命中；本機日誌含家目錄路徑，未進 repo。
