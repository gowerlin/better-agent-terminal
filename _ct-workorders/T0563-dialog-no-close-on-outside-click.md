---
schema_version: 1
schema_kind: workorder
id: T0563
title: "Dialog 不再因點擊外部（遮罩）而關閉：只能經 [X] / [確認] / [取消]（與 Esc）關閉；缺少明確關閉按鈕的 Dialog 補 [X]；選單 / popover 不變"
type: implementation
status: TODO
repo: better-agent-terminal
project: ""
priority: P2
sizing: S
created_at: "2026-10-16T14:47:24+0800"
updated_at: "2026-10-16T14:47:24+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.6"
depends_on:
  - "T0562（同改 `src/App.tsx` / `src/components/WorkspaceView.tsx`；T0562 收單後才派）"
related:
  - "使用者需求 2026-10-16：誤觸 Dialog 外部就消失"
affects_files:
  - src/**
  - e2e/**
  - CLAUDE.md
  - _ct-workorders/T0563-dialog-no-close-on-outside-click.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍只到 **Dialog / modal**（有標題列、表單或確認 / 取消按鈕、帶遮罩的對話框，含 Settings、配置（Profiles）、工作區設定、遠端 profile 編輯、工具安裝確認、關閉確認、About、Snippet 編輯、setup wizard、Worker 批次關閉確認等）。右鍵選單、下拉選單、autocomplete、小型 popover（例 `PathLinker`、`VoicePreviewPopover`）**維持**點外部就關閉。邊界不明的元件在回報區列出並說明歸類。"
  - "🔴 No Regressions（CLAUDE.md）：只移除「點遮罩關閉」，不改 Dialog 的其他行為（確認 / 取消的語意、表單送出、Esc、焦點、拖曳選取文字從 Dialog 內拖到外部時不得關閉）。setup wizard 的取消會觸發 rollback：確認點遮罩不再觸發任何取消 / rollback。"
  - "🔴 驗收前必跑：`npm run test:unit` 全綠（以派工時 HEAD 的基線為準，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功。e2e 只用隔離實例，不動使用者自己的 BAT（9876）。"
  - "🔴 commit：`git add` 本單實際改動的檔後 `git commit --only <那些檔>`（`src/styles/settings.css` 的 M 不是你的變更，除非本單確實需要改它；若需要，先 `git diff src/styles/settings.css` 確認既有狀態並在回報區說明）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要呼叫 `bat-terminal.mjs --close-worker`；通知塔台之後不要再執行任何指令。"
---

# T0563 — Dialog 不因點擊外部而關閉

## 背景

使用者回報：BAT 的 Dialog 面板在 Dialog 外部點一下就自動關閉，容易誤觸、輸入到一半的內容就消失。要求（2026-10-16 選定）：

1. Dialog 只能經 **[X]**、**[確認]** / **[取消]** 按鈕關閉；**Esc 保留**（刻意動作，等同取消 / [X]）。
2. **只改 Dialog**；右鍵選單、下拉選單、小型 popover 維持點外部就關閉。
3. 沒有 [X] 或取消按鈕的 Dialog（例如只顯示資訊的）**補上 [X]**，確保每個 Dialog 至少有一個明確的關閉按鈕。

塔台初步搜尋：約 15 個檔案有「點遮罩 / `e.target === e.currentTarget` 關閉」的寫法（`App.tsx`、`WorkspaceView.tsx`、`remote-tools/InstallConfirmDialog.tsx`、`WorkspaceEnvDialog.tsx`、`CodexAgentPanel.tsx`、`ClaudeAgentPanel.tsx`、`ProfilePanel.tsx`、`SettingsPanel.tsx`、`PathLinker.tsx`、`MainPanel.tsx`、`GitHubPanel.tsx`、`profiles/EditRemoteProfileModal.tsx`、`SnippetPanel.tsx`、`AboutPanel.tsx`、`CloseConfirmDialog.tsx`），其中部分是選單 / popover。以你的完整盤點為準（含 setup wizard、detached 視窗、遠端視窗共用的元件）。

## 任務

1. 盤點所有帶遮罩的浮層，分類為 Dialog（要改）與選單 / popover（不改），列表寫進回報區（元件、檔案、原本的關閉方式、改後的關閉方式、是否補 [X]、Esc 是否已有）。
2. 移除 Dialog 的「點遮罩關閉」。若適合，抽成共用做法（例如共用的 modal overlay 元件或 hook），避免每個 Dialog 各自判斷；不強制大重構，以最小改動、一致行為為原則。
3. 缺少明確關閉按鈕的 Dialog 補 [X]（樣式沿用既有 Dialog 的 [X]；`aria-label` 走 i18n，三語）。
4. Esc：已有 Esc 關閉的保留；沒有的 **不必新增**（回報區列出哪些 Dialog 沒有 Esc，塔台再決定）。
5. 測試：
   - 單元 / 元件測試：代表性的 Dialog（至少 Settings、配置、工作區設定、一個確認類、一個補 [X] 的）點遮罩不關閉、[X] / 取消 / Esc（若有）會關閉；選單類仍點外部關閉（至少一個）。
   - 若有共用元件：source guard 測試，防止日後新增 Dialog 又加回點遮罩關閉（比照既有 source guard 測試寫法）。
   - e2e（隔離實例）：開啟 Settings 與配置，點遮罩 → 仍開著；按 [X] → 關閉。
6. CLAUDE.md 新增一小節記下規則（Dialog 不因點遮罩關閉、選單 / popover 照舊、新增 Dialog 請用共用做法 / 必有 [X]）。
7. 填狀態、commit、通知塔台（yolo：`bat-notify.mjs --submit`，`--source "T0563"`），之後保持閒置。

## 驗收條件

- [ ] 盤點表（Dialog / 選單分類、補 [X]、Esc 現況）
- [ ] 所有 Dialog 點遮罩不關閉；[X] / 確認 / 取消正常；已有的 Esc 正常
- [ ] 選單 / popover 行為不變
- [ ] setup wizard 點遮罩不觸發取消 / rollback
- [ ] 測試與 e2e 如上；`npm run test:unit` / `npm run typecheck` / `npm run typecheck:electron` / `npx vite build` 全過
- [ ] CLAUDE.md 規則

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
