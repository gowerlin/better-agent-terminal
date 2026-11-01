---
schema_version: 1
schema_kind: workorder
id: T0776
title: "BUG-194：自動開啟的對話框要拿到焦點，第一次 Esc 就關閉、不送進背景分頁 —— 先盤點會自動開啟的對話框再修"
type: implementation
status: PENDING
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

- [ ] 盤點表（Dialog、觸發方式、開啟時焦點、第一次 Esc 結果，修正前 / 後）
- [ ] 修正與單元測試、突變檢查
- [ ] e2e 修正前失敗、修正後通過；不回歸綠
- [ ] typecheck 0 / 0、`test:unit` 全綠、`vite build`

---

## 回報區
