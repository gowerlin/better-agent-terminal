---
schema_version: 1
schema_kind: workorder
id: T0776
title: "BUG-194：自動開啟的對話框要拿到焦點，第一次 Esc 就關閉、不送進背景分頁 —— 先盤點會自動開啟的對話框再修"
type: implementation
status: DONE
started_at: "2026-11-02T05:39:07+08:00"
updated_at: "2026-11-02T05:56:01+08:00"
completed_at: "2026-11-02T05:56:01+08:00"
session_ids:
  - "3f10bdc0-e4ea-4040-a16b-6a1d93b1c736"
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T05:28:58+0800"
depends_on: [T0774]
related:
  - "BUG-194；T0773 回報〈發現的問題〉F1 與 `e2e/t0773-real-agents-recovery-resume.spec.ts`（焦點證據的記錄方式）；T0563 / T0567（Dialog 關閉與 Esc 統一）；T0766（`InterruptedAgentsDialog`）；D217"
  - "CLAUDE.md「Dialog 不因點擊外部關閉（T0563）、Esc 統一（T0567）」節；`docs/agent-guide/dialog-close-and-escape.md`；`src/components/common/ModalOverlay.tsx`、`src/components/common/modal-stack.ts`、`src/components/__tests__/dialog-escape.test.tsx`（`NO_ESCAPE_DIALOGS` source guard）"
affects_files:
  - src/components/common/ModalOverlay.tsx
  - src/components/common/modal-stack.ts
  - src/components/InterruptedAgentsDialog.tsx
  - "src/components/**/__tests__/*（相關單元測試）"
  - "e2e/t0776-*.spec.ts（新增，檔名可調）"
  - docs/agent-guide/dialog-close-and-escape.md
  - CLAUDE.md
  - _ct-workorders/T0776-fix-bug194-auto-opened-dialog-focus.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 派工時機：塔台等 T0774 收單後才派（兩張都要 `npx vite build`，不並行）。"
  - "🔴 先盤點：列出所有「不經使用者點擊、自動開啟」的 Dialog（例：recovery 後的 `InterruptedAgentsDialog`、app 通知、更新 / 安裝提示、`RecoveryPrompt`、其他由 IPC 事件觸發的），逐一記錄開啟時焦點在哪裡、第一次 Esc 的結果（在終端分頁有焦點時開啟最容易重現）。沒有 `onEscape` 的 Dialog（`RecoveryPrompt`、setup wizard）照 CLAUDE.md 擋下 Esc，本單只確認 Esc 不會送進背景終端。"
  - "🔴 修正規格（D217）：Dialog 開啟時若焦點不在 Dialog 內（例：在 xterm 的 `xterm-helper-textarea`），把焦點移進 Dialog（例：容器 `tabIndex=-1` 聚焦）；Dialog 內已有 autoFocus 的元素時不得搶走它的焦點。Dialog 關閉後焦點回到開啟前的元素（仍在 DOM 中時），讓使用者可以繼續在終端打字。🔴 優先在 `ModalOverlay` 統一處理（唯一入口，所有 Dialog 一起受益），不在各 Dialog 另寫；🔴 不改 T0567 的 Esc 規則（`modal-stack` 只作用於最上層、對話框內的選單 / 自動完成先處理 Esc），不改成 capture 階段攔截，除非盤點證明統一聚焦解決不了並在回報說明。🔴 不改 xterm 的按鍵處理、不改「點遮罩不關閉」（T0563）。"
  - "🔴 驗證：單元測試涵蓋：焦點在外 → 開啟後焦點在 Dialog 內；Dialog 內 autoFocus 不被搶；關閉後焦點回到原元素；突變檢查（拿掉聚焦會失敗）。`dialog-escape.test.tsx` 等既有 source guard 綠。e2e（隔離實例、source build）：終端分頁有焦點時讓 `InterruptedAgentsDialog` 自動開啟（比照 T0773 / t0766 以只結束隔離實例自己的 Terminal Server 造 recovery，可用假 claude，不用真實模型）→ 第一次 Esc 就關閉、背景 PTY 沒收到 Esc（以 PTY 輸出或 shell 端記錄佐證）→ 關閉後焦點回到終端；修正前失敗、修正後通過。盤點中其他可在 e2e 觸發的自動開啟 Dialog 至少再驗一個。不回歸：`t0766-interrupted-agents-recovery`、`t0563` / `t0567` 相關 e2e（若有）、`dialog-escape.test.tsx`。`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠、`npx vite build` 成功。"
  - "🔴 只結束隔離實例自己的 Terminal Server：pid 只取自隔離 userData 的 `bat-pty-server.pid`，並比對命令列與父程序（T0773 作法）；絕不讀使用者 `%APPDATA%\\BetterAgentTerminal\\bat-pty-server.pid`、不結束不是 spec 自己啟動的程序。"
  - "🔴 文件：`dialog-close-and-escape.md` 補「自動開啟的 Dialog 與焦點」規則、盤點結果與驗證清單；CLAUDE.md「Dialog 不因點擊外部關閉…」節補 1 行（焦點規則與唯一實作位置）。不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0776 — BUG-194：自動開啟的對話框要拿到焦點

## 元資料

- **工單編號**：T0776
- **類型**：implementation（修正）
- **優先級**：P2
- **建立時間**：2026-11-02T05:28:58+0800
- **預估規模**：S

## 背景

T0773 在 `v0.7.3-pre.4` 安裝版發現：Terminal Server recovery 後「被中斷的分頁」對話框自動開啟，焦點仍在終端的 xterm；第一次按 Esc 被 xterm 送進背景分頁的 PTY，`modal-stack` 收不到，對話框沒關。違反 CLAUDE.md「Esc 統一」規則。使用者裁示開單修，與 T0774 同批、完成後發 `0.7.3-pre.5`（D217）。

## 範圍

1. 盤點自動開啟的 Dialog。
2. `ModalOverlay` 統一聚焦與還原焦點（規格見 frontmatter）。
3. 單元測試＋突變、e2e、不回歸。
4. docs / CLAUDE.md。

## 不做

- 不改 T0567 的 Esc 規則、T0563 的點遮罩規則、xterm 按鍵處理。

## 驗收

- [x] 盤點表（Dialog、觸發方式、開啟時焦點、第一次 Esc 結果，修正前 / 後）
- [x] 修正與單元測試、突變檢查
- [x] e2e 修正前失敗、修正後通過；不回歸綠
- [x] typecheck 0 / 0、`test:unit` 全綠、`vite build`

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-02T05:56:01+08:00
- **session_id**：3f10bdc0-e4ea-4040-a16b-6a1d93b1c736
- **產品 commit**：`e717c786`（`fix(dialog): a dialog that opens by itself takes the focus, so the first Esc closes it (T0776 / BUG-194)`）

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = 主 checkout）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 前 5 項（排除萬用字元與 `_ct-workorders/`）皆存在 → PASS
- C-2：工單無 `branch` 欄位，略過；目前 `main`
- `CT_HOME` 未設定（非 worktree）；`BAT_WORKSPACE_ID` 已設定（只記存在）；`CT_MODE` = `yolo`

### 結果摘要

修正 BUG-194：`ModalOverlay` 掛載時若焦點不在 Dialog 內，聚焦遮罩元素（`tabIndex={-1}`、`outline: none`）；`autoFocus` 的子元素已有焦點時不搶；關閉時焦點回到開啟前的元素。唯一實作 `takeDialogFocus` / `restoreDialogFocus`（`src/components/common/modal-stack.ts`），所有經 `ModalOverlay` 的 Dialog 一起受益。T0567 的 Esc 規則（`document` bubble 階段單一 listener、只作用於最上層、Dialog 內已處理的 Esc 不搶）、T0563 點遮罩不關閉、xterm 按鍵處理都沒改；沒有改成 capture 階段攔截（統一聚焦已足以解決，不需要）。

### 盤點表

| Dialog | 怎麼自動開啟 | 開啟時焦點（修正前） | 第一次 Esc（修正前） | 修正後 | 證據 |
|---|---|---|---|---|---|
| `InterruptedAgentsDialog` | Terminal Server recovery（`onAgentsInterrupted` reason=recovery） | shell 分頁 xterm 的 `xterm-helper-textarea` | 寫進 PTY（記錄器讀到 `1b`），Dialog 沒關 | 焦點在遮罩 `.dialog-overlay`；第一次 Esc 關閉；PTY 沒收到；焦點回 xterm、之後打 `q` 進 PTY | e2e ①、單元 |
| `SettingsPanel` | 主行程送 `app:open-settings`（T0530，detached 視窗的「開啟設定」） | xterm | 寫進 PTY（`1b`），沒關 | 焦點在 `.settings-overlay`；第一次 Esc 關閉；PTY 沒收到；焦點回 xterm | e2e ② |
| `AppNotificationDialog` | 非同步通知（遠端連線失敗 / 上限、profile 已開啟、WSL 磁碟提示、detached 開設定失敗） | 同一機制（開啟時不碰焦點） | 會被 xterm 吃掉（拿掉聚焦的突變下單元測試失敗） | 第一次 Esc 關閉、xterm 替身沒收到、焦點回原處 | 單元 |
| `RecoveryPrompt`（無 `onEscape`） | BAT 重開、Terminal Server 存活且有 PTY | 不碰焦點 | 焦點若在 xterm 會寫進 PTY | 焦點在 Recovery 內；Esc 不作用（照 CLAUDE.md 擋下）、也不送進背景終端 | 單元 |
| `UpdateNotification` | — | — | — | 元件存在但全專案沒有任何地方掛載，不適用 | `grep` |
| 使用者點開的（Settings 按鈕、Profiles、About、工作區設定、關閉 / 重啟確認、Snippet、Worker 批次關閉、工具安裝確認、setup wizard、Claude / Codex 面板 modal） | 點擊 | 被點的元素（不是 xterm） | 正常關閉 | 同一規則：開啟時聚焦遮罩（`autoFocus` 除外），關閉時焦點回到點開它的元素 | 既有 `dialog-escape` / `dialog-no-outside-close` 測試、t0563 / t0567 e2e 綠 |

### 變更檔案

- `src/components/common/ModalOverlay.tsx`：第一次 render 記下 `document.activeElement`；掛載 layout effect 呼叫 `takeDialogFocus`、cleanup 呼叫 `restoreDialogFocus`；根 div 加 `tabIndex={-1}` 與 `outline: 'none'`（呼叫端的 `style` 在後，可覆寫）
- `src/components/common/modal-stack.ts`：新增 `takeDialogFocus` / `restoreDialogFocus`（Esc listener 不變）
- `src/components/__tests__/dialog-auto-focus.test.tsx`（新增，12 項）
- `e2e/t0776-auto-dialog-focus.spec.ts`（新增）
- `docs/agent-guide/dialog-close-and-escape.md`：「自動開啟的 Dialog 與焦點」規則、盤點表、行為變化、驗證清單
- `CLAUDE.md`：「Dialog 不因點擊外部關閉…」節補 1 行

### 驗證

- **單元測試**：`dialog-auto-focus.test.tsx` 12/12（焦點在外 → 開啟後在 Dialog 內、第一次 Esc 關閉、xterm 替身（自己處理 Esc 的 textarea）沒收到、關閉後焦點回替身；`autoFocus` 不被搶且關閉後仍回替身；Dialog 自己聚焦內部元素不被覆寫；Dialog 自己把焦點移走時不還原；原元素已移除不出錯；兩個 Dialog 疊開：Esc 先關上層、焦點回下層、再 Esc 關下層、回 xterm；下層先關不拉走上層焦點；`InterruptedAgentsDialog` / `AppNotificationDialog` / `RecoveryPrompt` 實元件；source guard）
- **突變檢查**：拿掉 `el.focus(...)` → 7 項失敗；拿掉 `restoreTo.focus(...)` → 5 項失敗；改成連 `autoFocus` 也搶 → 1 項失敗；改回後 12/12（以檔案備份還原，未用 git 還原指令）
- **既有 source guard / 相關測試**：`dialog-escape.test.tsx`、`dialog-no-outside-close.test.tsx`、`interrupted-agents-dialog.test.tsx` 與新檔合計 4 檔 60 項綠
- **`npm run test:unit`**：382 檔通過；6705 passed、10 skipped
- **`npm run typecheck`** = 0；**`npm run typecheck:electron`** = 0
- **`npx vite build`**：成功（修正前與修正後各 build 一次）
- **e2e `t0776-auto-dialog-focus`**（隔離實例、source build、stub claude，Windows）：
  - 方法自檢（recovery 前、沒有 Dialog）：打 `k` + Esc 進 shell xterm → 記錄器讀到 `6b`、`1b`（證明記錄器看得到鍵盤送進 PTY 的位元組）
  - 修正前（build 自 HEAD `0dd3b8f2`）：① 開啟時焦點 `xterm-helper-textarea`、第一次 Esc 沒關、PTY 讀到 `["1b"]`；② Settings 同（`["1b"]`、沒關）→ **失敗**
  - 修正後：① 焦點 `.dialog-overlay`、第一次 Esc 關閉、PTY 讀到 `[]`、焦點回 shell xterm、之後打 `q` 進 PTY；② 焦點 `.settings-overlay`、第一次 Esc 關閉、PTY `[]`、焦點回 xterm → **通過**
  - 只結束隔離實例自己的 Terminal Server：pid 取自隔離 userData 的 `bat-pty-server.pid`，命令列含 build 的 `terminal-server.js`、父程序 = 隔離主行程才 `taskkill /F`（不帶 `/T`）；teardown 只清 spec 自己記下的 pid（且命令列吻合）
- **不回歸 e2e**：`t0563-dialog-no-outside-close`、`t0567-dialog-esc`、`t0766-interrupted-agents-recovery`、`t0767-interrupted-codex-resume`（BAT MCP on / off）與 `t0776` 共 6 項全過

### 行為變化

- 所有經 `ModalOverlay` 的 Dialog 關閉後，焦點回到開啟前的元素（例如點開它的按鈕、終端）；T0776 前落在 `<body>`。
- 焦點離開 / 回到 xterm 時，開了 focus tracking 的程式（claude 等）照常收到 focus out / in 回報，與使用者點到別處相同（T0551 起不算使用者輸入）。
- 點遮罩空白處時焦點落在遮罩元素（原本落在 `<body>`）；Esc 照樣經 `modal-stack`。

### 遭遇問題

- 第一版 e2e 的按鍵進不了記錄器：種子資料的 `activeTerminalId` 不決定主分頁（`WorkspaceView` 的 `mainTerminal = focusedTerminal || agentTerminal || terminals[0]`，沒有聚焦分頁時優先 agent 分頁），`.terminal-wrapper.active` 其實是 claude stub 分頁。改成先點 shell 分頁縮圖，並加 recovery 前的方法自檢。產品行為無誤，只是測試寫法。
- 以 `python -` heredoc 改 spec 時 `'\n'` 被轉成真換行（與學習記錄同類問題），已用備份還原、改用 Edit 工具。

### 互動紀錄

- 無（yolo；沒有需要問塔台的判讀問題）

### 後續建議

- 無必要後續。`RecoveryPrompt` 只有單元測試覆蓋（e2e 需要 BAT 重開且 Terminal Server 存活，t0580 已有類似架構）；若要實機補驗可另開單。

### commit 狀態

- 產品：`e717c786`（只 commit 本單 6 個檔，`git commit --only`）
- 工單：本次收尾 commit（只含本工單檔）
- 未 push、未發版、未改 CHANGELOG
