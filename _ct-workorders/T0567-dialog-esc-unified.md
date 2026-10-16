---
schema_version: 1
schema_kind: workorder
id: T0567
title: "Dialog Esc 統一：由共用 `ModalOverlay` 提供 Esc = [×] / 取消（只作用於最上層）；設定精靈開著時 Esc 不作用（不再連帶關閉配置面板並 rollback）；RecoveryPrompt 不套用"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-046
priority: P2
sizing: S
created_at: "2026-10-16T15:11:59+0800"
updated_at: "2026-10-16T15:24:13+0800"
started_at: "2026-10-16T15:12:54+08:00"
completed_at: "2026-10-16T15:24:13+0800"
commit: "91bb9607"
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

DONE

### 產出摘要

**落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`、`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 皆為萬用字元 / `_ct-workorders/` 以外只剩 `CLAUDE.md`（存在）；C-2 無 `branch` 欄位（HEAD = `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

**做法**
- 新增 `src/components/common/modal-stack.ts`：所有掛載中的 `ModalOverlay` 登記在一個集合，`document` bubble 階段單一 keydown listener。Esc 時找最上層（遮罩在另一個遮罩內 → 內層在上；否則後登記者在上；`checkVisibility()` 為否者略過，jsdom 沒有此 API 時視為顯示）：有 `onEscape` → 呼叫；沒有 → 不作用（下層也不作用）。取用時 `preventDefault` + `stopPropagation`。`isComposing` / keyCode 229 與 `defaultPrevented` 一律放過（內層選單 / autocomplete 先處理；`stopPropagation` 的內層也到不了 document）。
- `ModalOverlay` 新增選用 `onEscape`，以 `useLayoutEffect` 登記一次，之後每次 render 只更新 action（不重新登記，避免順序變動）。仍不收 `onClick`（T0563 guard 不變）。
- Profiles 與工具安裝確認原本各自的 window keydown listener 移除，改經 `onEscape`。Profiles 的 `onEscape` 只保留「先取消行內名稱編輯 → 再關面板」；刪除確認、遠端 profile 編輯各自有 `onEscape`（Esc 只關最上層）；三個精靈的遮罩**不給** `onEscape` → 精靈開著時 Esc 被擋，配置面板不關、精靈不卸載（不 cancel / rollback）。

**補 Esc 清單（對照 T0563 盤點表）**

| T0563 # | 元件 | 檔案 | Esc 動作 |
|---|---|---|---|
| 1 | Settings | `SettingsPanel.tsx` | `onClose`（= [×]）**新增** |
| 2 | 配置（Profiles） | `ProfilePanel.tsx` | `handleEscape`：取消新增 / 改名輸入 → 否則 `onClose`（原 window listener 改經共用機制） |
| 3 | Profiles 刪除確認 | `ProfilePanel.tsx` | `setConfirmDelete(null)`（= 取消）（原由 Profiles listener 處理，改為自己的 `onEscape`） |
| 4 | WSL / Docker / SSH setup wizard | `ProfilePanel.tsx` | **不給**（擋下 Esc；只能用精靈 [×] / 取消） |
| 5 | 遠端 profile 編輯 | `profiles/EditRemoteProfileModal.tsx` | `onClose`（= [×]，`closeModal`）（原由 Profiles listener 只清 `editingRemoteId`，改為與 [×] 相同） |
| 6 | 工作區設定（主視窗 + detached 唯讀） | `WorkspaceEnvDialog.tsx` | `onClose`（= [×]）**新增** |
| 7 | 關閉 Agent 確認 | `CloseConfirmDialog.tsx` | `onCancel`（= 取消）**新增** |
| 8 | 重啟終端確認 | `MainPanel.tsx` | `setShowRestartConfirm(false)`（= 取消）**新增** |
| 9 | Worker 批次關閉確認 | `WorkspaceView.tsx` | `setBatchCloseWorkers(null)`（= 取消）**新增** |
| 10 | 工具安裝確認 | `remote-tools/InstallConfirmDialog.tsx` | `onCancel`（原 window listener 改經共用機制） |
| 11 | About | `AboutPanel.tsx` | `onClose`（= [×]）**新增** |
| 12 | Snippet 編輯 | `SnippetPanel.tsx` | `onClose`（= [×]，不存檔）**新增** |
| 13 | app 通知 | `AppNotificationDialog.tsx` | `onClose`（= [×] / OK）**新增** |
| 14 | Claude 面板 6 個 modal | `ClaudeAgentPanel.tsx` | 內容 `setContentModal(null)`、Context `setContextUsagePopup(null)`、Cache History `setShowCacheHistory(false)`（= [×]，不是 Clear）、Cache entry `setCacheEntryModal(null)`、Task `setTaskModal(null)`、Prompt History `setShowPromptHistory(false)` **新增**（前者有 3 個原本由面板 window 快捷鍵在 active 面板處理，見遭遇問題 2） |
| 15 | Codex 面板 6 個 modal | `CodexAgentPanel.tsx` | 同 14 |
| 16 | Recovery | `RecoveryPrompt.tsx` | **不給**（必選決策） |
| 17 | 更新通知 | `UpdateNotification.tsx` | `setDismissed(true)`（= [×]）**新增** |
| 18–24 | 選單 / popover / toast | 各檔 | 不變（不用 `ModalOverlay`；`VoicePreviewPopover` 的 capture listener、`PathLinker` 搜尋列、Ctrl+P 檔案選擇器輸入框的 Esc 都先於 document listener 處理） |

**修改檔案**
- 新增：`src/components/common/modal-stack.ts`、`src/components/__tests__/dialog-escape.test.tsx`、`e2e/t0567-dialog-esc.spec.ts`
- 改：`src/components/common/ModalOverlay.tsx`、`src/components/{AboutPanel,AppNotificationDialog,ClaudeAgentPanel,CloseConfirmDialog,CodexAgentPanel,MainPanel,ProfilePanel,SettingsPanel,SnippetPanel,UpdateNotification,WorkspaceEnvDialog,WorkspaceView}.tsx`、`src/components/profiles/EditRemoteProfileModal.tsx`、`src/components/remote-tools/InstallConfirmDialog.tsx`
- 測試調整：`src/components/__tests__/dialog-no-outside-close.test.tsx`、`src/components/__tests__/remote-tools-panel.test.tsx` 的 Esc 由 `fireEvent.keyDown(window, …)` 改為 `fireEvent.keyDown(document.body, …)`（真實按鍵的 target 是焦點元素、經 document 冒泡到 window；直接派送到 window 不經過 document）。斷言不變。另更新 dialog-no-outside-close 檔頭註解一行。
- `CLAUDE.md`：「Dialog 不因點擊外部關閉（T0563）」一節改名加「Esc 統一（T0567）」，補 Esc 規則、例外、source guard 與驗證檔。
- 未動 `electron/**`、`scripts/**`；`src/styles/settings.css` 的 M 不是本單變更，未納入 commit。

**驗證**
- 原始碼 / guard：突變測試 7 種皆被抓到（modal-stack：沒有 onEscape 不擋 → 2 fail；拿掉 `defaultPrevented` → 2 fail；拿掉 IME → 2 fail；只用登記順序不看巢狀 → 1 fail；拿掉 `stopPropagation` → 1 fail；Settings 拿掉 `onEscape` → 2 fail；AboutPanel 加 window keydown listener → guard 1 fail）。每次突變後以 scratchpad 備份還原，`cmp` / `git diff` 確認只剩本單變更。
- `npx vitest run src/components/__tests__/dialog-escape.test.tsx`：21/21 PASS（Settings / 工作區設定 / 確認類 = 取消 / About + app 通知 / Claude 面板 Prompt History（`isActive=false`，面板快捷鍵未註冊，只有共用機制能關）/ 取用後不傳到 window / 沒有 Dialog 時不攔；Profiles → 刪除確認巢狀只關最上層、同時掛載的巢狀、兄弟後開者在上、未顯示者略過；slash 選單 `preventDefault` / `stopPropagation` 兩種只關選單；IME 不關；Recovery 不關、Recovery 在 Settings 上時 Settings 也不關；精靈開著時 Esc 兩次 → 精靈仍在、`unmounted` = 0、`onClose` 未呼叫，精靈 [×] 後 Esc 關 Profiles；4 條 source guard）。
- `npm run test:unit`：PASS，261 files，4523 passed / 3 skipped（exit 0）。之後只改了新測試檔的一行（`delete` → `Reflect.deleteProperty`，修 typecheck）並重跑該檔 + dialog-no-outside-close：36/36 PASS。
- `npm run typecheck` = 0；`npm run typecheck:electron` = 0（T0565 已於 `4936f440` commit，工作目錄已無其 electron 變更）。
- `npx vite build`：exit 0（最後一次在全部變更之後）。
- e2e `npx playwright test e2e/t0567-dialog-esc.spec.ts`：**1 passed**（隔離實例 `e2e-t0567-dialog-esc-*`，remotePort 51251，未碰 9876）：Settings 按 Esc 關閉；配置面板開 SSH 精靈後按 Esc 兩次（一次焦點在精靈內、一次 blur 後）→ 精靈與面板仍在；精靈 [×] 後 Esc 關面板；結束後 Terminal Server 已退出、runtime userData 已刪除。截圖 `e2e-results/…/wizard-after-esc.png`。
- 沒有做的：沒有真人 runtime 驗收；Codex 面板 modal 與其餘 Claude modal 沒有個別元件測試（由 source guard 逐檔計數覆蓋）；沒有驗證 e2e 在舊行為下會失敗（舊行為由單元突變測試覆蓋）。

**Commit**：見 frontmatter `commit`（`git commit --only` 本單檔案，未 push）。

### 互動紀錄

無（`CT_MODE=yolo`、`CT_INTERACTIVE=0`）。

### Renew 歷程

無。

### 遭遇問題

1. **e2e 第一次失敗（測試本身）**：隔離實例跟隨 OS 語言（中文），`+ More ▾` 找不到；選單項目文字含圖示（`🔐Add SSH Profile`），錨定的 regex 也比不到。改用三語 locale 字串 + `.thumbnail-add-menu-item` 過濾後通過。
2. **Claude / Codex 面板的 window 快捷鍵 handler 原本就會在 active 面板以 Esc 關 Prompt History / Task / 內容 modal**（T0563 盤點表記為「無」，實際有這三個）。保留未刪：焦點在輸入框時輸入框的 Esc 先清空並 `preventDefault`，共用機制因此不動作，modal 由這個既有分支關閉（行為同 T0567 前）。其他情況共用機制先處理並 `stopPropagation`，該分支不會重複執行。附帶改變：modal 開著時 Esc 只關 modal，不再同時觸發面板的「Esc = 中斷串流 / 拒絕權限」（Context / Cache 類 modal 之前沒有被該 handler 處理，Esc 會穿過去中斷串流）。
3. **全域行為改變（刻意）**：任何 `ModalOverlay` 開著（且顯示中）時，Esc 都不再傳到 window 層 listener。例如 Recovery 或精靈開著時，背後 active Claude 面板的 Esc 中斷不會觸發。符合 modal 語意，列出供塔台知悉。
4. 工作期間 T0565 已 commit（`4936f440`），`git status` 不再有其 `electron/` 變更；本單沒有碰 `electron/**` / `scripts/**`。

### 回報時間

2026-10-16T15:24:13+0800
