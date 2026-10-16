---
schema_version: 1
schema_kind: workorder
id: T0567
title: "Dialog Esc 統一：由共用 `ModalOverlay` 提供 Esc = [×] / 取消（只作用於最上層）；設定精靈開著時 Esc 不作用（不再連帶關閉配置面板並 rollback）；RecoveryPrompt 不套用"
type: implementation
status: TODO
repo: better-agent-terminal
project: PLAN-046
priority: P2
sizing: S
created_at: "2026-10-16T15:11:59+0800"
updated_at: "2026-10-16T15:11:59+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.6"
depends_on: []
related:
  - "T0563（`src/components/common/ModalOverlay.tsx`、盤點表、遭遇問題 2 / 4）"
  - "PLAN-046"
affects_files:
  - src/**
  - e2e/**
  - CLAUDE.md
  - _ct-workorders/T0567-dialog-esc-unified.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **不得修改 `electron/**` 與 `scripts/**`**：T0565 正在同一工作目錄改 `electron/`，`git commit --only` 會把對方未完成的修改帶進來。本單只改 renderer。"
  - "🔴 No Regressions：T0563 的規則不變（Dialog 不因點遮罩關閉、選單 / popover 照舊）；已有 Esc 的行為（Profiles、工具安裝確認、Claude / Codex 面板的 slash / star 選單與檔案選擇器）不變；source guard 保留並擴充。"
  - "🔴 驗收前必跑：`npm run test:unit` 全綠、`npm run typecheck` = 0、`npx vite build` 成功（`npm run typecheck:electron` 若因 T0565 進行中的變更失敗，記錄並說明不是本單造成）。e2e 只用隔離實例，不動使用者自己的 BAT（9876）。"
  - "🔴 commit：`git add` 本單實際改動的檔後 `git commit --only <那些檔>`（`src/styles/settings.css` 的 M 不是你的變更，不要納入）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要呼叫 `bat-terminal.mjs --close-worker`；通知塔台之後不要再執行任何指令。"
---

# T0567 — Dialog Esc 統一

## 背景

T0563 移除了 Dialog 的「點遮罩關閉」，並回報兩件事，使用者 2026-10-16 決定：

1. **設定精靈開著時 Esc 不作用**：目前 Profiles 的全域 Esc handler 會在精靈開著時關掉整個配置面板，精靈卸載 → runner cancel → rollback（已裝到一半的 server 會被還原）。改為：精靈開著時 Esc 完全不作用，只能用精靈自己的 [×] / 取消。
2. **統一補 Esc**：T0563 盤點表中 22 個沒有 Esc 的 Dialog（Settings、工作區設定、CloseConfirm、重啟確認、Worker 批次關閉確認、About、Snippet 編輯、app 通知、Claude / Codex 的 12 個 modal、更新通知）補上 Esc，語意 = 該 Dialog 的 [×] 或取消。

## 規格

- 由共用的 `ModalOverlay`（或其旁的 hook）提供 Esc：Dialog 宣告自己的關閉動作（例如 `onEscape`），Esc 時呼叫它。
- **只作用於最上層 Dialog**：巢狀時（例如 Profiles 上的刪除確認、遠端 profile 編輯）Esc 只關最上層；用一個 modal stack 或等效機制，不要靠事件冒泡順序碰運氣。
- **不搶既有的 Esc**：Dialog 內的選單 / autocomplete / 檔案選擇器（例如 Claude / Codex 面板的 slash 選單）已處理 Esc 時，該次 Esc 不關 Dialog；IME 組字中（`isComposing`）的 Esc 不關 Dialog。
- **不套用**：`RecoveryPrompt`（必選決策，T0563 塔台同意不補 [×]）；設定精靈開著時（含其上層的配置面板）整個 Esc 不作用。精靈關閉後配置面板的 Esc 恢復。
- 確認類 Dialog：Esc = 取消（不是確認）。
- 有 `onEscape` 的 Dialog 才有 Esc；沒有宣告的不自動關閉（例如 Recovery）。

## 驗收條件

- [ ] 補 Esc 的清單（元件 / 檔案 / Esc 對應的動作）寫進回報區，與 T0563 盤點表對照
- [ ] 單元測試：代表性 Dialog Esc 會關（Settings、工作區設定、確認類 = 取消、About、Claude 面板 modal 一個）；巢狀只關最上層；Dialog 內 slash 選單開著時 Esc 只關選單；IME 組字中不關；Recovery 不關；**精靈開著時 Esc 不關配置面板、精靈不卸載（不觸發 cancel / rollback）**，精靈關閉後 Esc 可關配置面板
- [ ] source guard 擴充：Dialog 的 Esc 必須經共用機制（不要各自在 Dialog 內加 document keydown 關閉）
- [ ] e2e（隔離實例）：Settings 按 Esc 關閉；配置面板開精靈後按 Esc → 精靈與面板仍在
- [ ] CLAUDE.md「Dialog 不因點擊外部關閉（T0563）」一節補上 Esc 規則
- [ ] `npm run test:unit` / `npm run typecheck` / `npx vite build` 全過

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
