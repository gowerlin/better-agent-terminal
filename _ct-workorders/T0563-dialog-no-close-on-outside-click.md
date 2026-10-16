---
schema_version: 1
schema_kind: workorder
id: T0563
title: "Dialog 不再因點擊外部（遮罩）而關閉：只能經 [X] / [確認] / [取消]（與 Esc）關閉；缺少明確關閉按鈕的 Dialog 補 [X]；選單 / popover 不變"
type: implementation
status: DONE
repo: better-agent-terminal
project: ""
priority: P2
sizing: S
created_at: "2026-10-16T14:47:24+0800"
updated_at: "2026-10-16T15:10:04+0800"
started_at: "2026-10-16T15:01:29+0800"
completed_at: "2026-10-16T15:10:04+0800"
commit: "132aa4b4"
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

DONE

### 產出摘要

**做法**：新增共用遮罩元件 `src/components/common/ModalOverlay.tsx`（只收 `className` / `style` / `children`，型別上沒有 `onClick`），所有 Dialog 的遮罩改成用它，「點遮罩關閉」整批移除。Dialog 內層原有的 `onClick={e => e.stopPropagation()}` 保留不動，避免點擊 Dialog 內容時事件冒泡到外層祖先（No Regressions）。app 通知抽出成 `src/components/AppNotificationDialog.tsx`（App.tsx 主視窗與 detached 兩處共用），並補上 [X]。

**盤點表**

| # | 元件 / 浮層 | 檔案 | 分類 | 原本的關閉方式 | 改後的關閉方式 | 補 [X] | Esc |
|---|---|---|---|---|---|---|---|
| 1 | Settings | `SettingsPanel.tsx` | Dialog | 遮罩、[×] | [×] | — | 無（未新增） |
| 2 | 配置（Profiles） | `ProfilePanel.tsx` | Dialog | 遮罩、[×]、Esc | [×]、Esc | — | 有（保留） |
| 3 | Profiles 刪除確認 | `ProfilePanel.tsx` | Dialog（確認類） | 遮罩（**連帶**關掉 Profiles：巢狀遮罩冒泡到外層 `onClose`）、取消 / 刪除、Esc | 取消 / 刪除、Esc | — | 有（Profiles 的 Esc 先關它） |
| 4 | WSL / Docker / SSH setup wizard | `ProfilePanel.tsx`（`SetupWizardShell`） | Dialog | 遮罩（= `wizard.close` → 卸載 → runner cancel → rollback，且同樣冒泡關掉 Profiles）、[×] | [×] | — | 無獨立 Esc（見遭遇問題 2） |
| 5 | 遠端 profile 編輯 | `profiles/EditRemoteProfileModal.tsx` | Dialog | 遮罩（同樣冒泡關 Profiles）、[×]、取消 / 儲存 | [×]、取消 / 儲存 | — | Profiles 的 Esc 先關它（`editingRemoteId`） |
| 6 | 工作區設定 | `WorkspaceEnvDialog.tsx`（App.tsx 主視窗 + detached 唯讀） | Dialog | 遮罩、[×] | [×] | — | 無 |
| 7 | 關閉 Agent 確認 | `CloseConfirmDialog.tsx` | Dialog（確認類） | 遮罩 = 取消、取消 / 關閉 / 關閉並清 worktree | 按鈕 | — | 無 |
| 8 | 重啟終端確認 | `MainPanel.tsx` | Dialog（確認類） | 遮罩、取消 / 確認重啟 | 按鈕 | — | 無 |
| 9 | Worker 批次關閉確認 | `WorkspaceView.tsx` | Dialog（確認類） | 遮罩、取消 / 確認 | 按鈕 | — | 無 |
| 10 | 工具安裝確認 | `remote-tools/InstallConfirmDialog.tsx` | Dialog（確認類） | 遮罩 = 取消、取消 / 確認、Esc | 取消 / 確認、Esc | — | 有（保留） |
| 11 | About | `AboutPanel.tsx` | Dialog | 遮罩、[×] | [×] | — | 無 |
| 12 | Snippet 編輯 | `SnippetPanel.tsx` | Dialog | 遮罩、[×]、取消 / 儲存 | [×]、取消 / 儲存 | — | 無 |
| 13 | app 通知（`app:notification`） | `AppNotificationDialog.tsx`（原 App.tsx 內聯兩份） | Dialog（資訊） | 遮罩、OK | **[X]**、OK | **是**（`close-btn` 樣式、`aria-label` / `title` = `common.close` 三語） | 無 |
| 14 | Claude 面板：Plan / 內容 modal、Context Usage、Cache History、Cache entry、Task（sub-agent）、Prompt History（6 個） | `ClaudeAgentPanel.tsx` | Dialog | 遮罩、[×]（Cache History 另有 Clear） | [×] | — | 無（面板的 Esc 只處理 slash / star 選單與檔案選擇器） |
| 15 | Codex 面板：同上 6 個 | `CodexAgentPanel.tsx` | Dialog | 同上 | [×] | — | 無 |
| 16 | Terminal Server 恢復提示 | `RecoveryPrompt.tsx` | Dialog（必選決策） | 本來就不能點遮罩關；恢復 / 重新開始 | 不變（遮罩改用 `ModalOverlay`，行為相同） | **否**（見遭遇問題 1） | 無 |
| 17 | 更新通知 | `UpdateNotification.tsx` | Dialog | 本來就不能點遮罩關；[×] | 不變（改用 `ModalOverlay`） | — | 無 |
| 18 | Ctrl+P 檔案選擇器 | `ClaudeAgentPanel.tsx` / `CodexAgentPanel.tsx`（`.claude-file-picker`） | 選單類（快速開啟 / autocomplete） | 點外部、Esc | **不變** | — | 有 |
| 19 | 路徑預覽 | `PathLinker.tsx`（`.path-preview-overlay`） | 小型 popover（工單明列） | 點外部、[×] | **不變** | — | 只關搜尋列 |
| 20 | 語音預覽 | `voice/VoicePreviewPopover.tsx` | popover（工單明列） | 原樣 | **不變** | — | 有 |
| 21 | GitHub 面板右鍵選單 | `GitHubPanel.tsx`（`.context-menu-backdrop`） | 選單 | 點外部 | **不變** | — | — |
| 22 | 其他右鍵選單 / 下拉 | `App.tsx` sidebar tab、`WorkspaceView.tsx` tab、`TerminalThumbnail.tsx`、`TerminalPanel.tsx`、`CodexAgentPanel.tsx` session、`ThumbnailBar.tsx` 新增選單、`common/AddMenu.tsx`（含 `AddProfileMenu`）、`FileTree.tsx`、`Sidebar.tsx`、`PromptBox` slash / star 選單 | 選單 | 點外部（document `mousedown` / `click`） | **不變** | — | 部分有 |
| 23 | Settings 內「QR code」區塊 | `SettingsPanel.tsx` | 邊界：Settings 內的內嵌區塊，沒有遮罩，不是浮層 | 「關閉」按鈕 | 不變 | — | — |
| 24 | `server-status-toast` / `bat-notify` toast | `App.tsx` | 邊界：toast（點 toast 本身關閉，沒有遮罩） | 點 toast | 不變 | — | — |

detached 視窗與遠端視窗用的是同一批元件（App.tsx 的 detached 分支用同一個 `AppNotificationDialog` / `WorkspaceEnvDialog`），所以一起套用。

**修改檔案**
- 新增：`src/components/common/ModalOverlay.tsx`、`src/components/AppNotificationDialog.tsx`、`src/components/__tests__/dialog-no-outside-close.test.tsx`、`e2e/t0563-dialog-no-outside-close.spec.ts`
- 改遮罩：`src/App.tsx`、`src/components/{AboutPanel,ClaudeAgentPanel,CloseConfirmDialog,CodexAgentPanel,MainPanel,ProfilePanel,RecoveryPrompt,SettingsPanel,SnippetPanel,UpdateNotification,WorkspaceEnvDialog,WorkspaceView}.tsx`、`src/components/profiles/EditRemoteProfileModal.tsx`、`src/components/remote-tools/InstallConfirmDialog.tsx`
- 樣式：`src/styles/notifications.css`（`.app-notification` 加 `position: relative`、新增 `.app-notification-x`、訊息右側留白）
- 測試更新：`src/components/__tests__/remote-tools-panel.test.tsx`（原本斷言「點遮罩會關閉安裝確認」，改成斷言「不會關閉」，取消照樣關閉、`onInstall` 不被呼叫）
- `CLAUDE.md`：新增「Dialog 不因點擊外部關閉（T0563）」一節
- `src/styles/settings.css` 的 M **不是本單變更**，沒有動它，也沒有 commit。

**驗證**
- 原始碼檢查：source guard 做過突變測試。① 在 `MainPanel.tsx` 的 `ModalOverlay` 加回 `onClick` → 兩條 guard 失敗；② 把它改回 raw `<div className="dialog-overlay">` → 「必須經 ModalOverlay」與「涵蓋清單」兩條失敗。突變完已從備份還原（`git diff` 只剩本單的變更）。
- `npx vitest run src/components/__tests__/dialog-no-outside-close.test.tsx`：15/15 PASS（Settings / Profiles + Esc / 刪除確認 / setup wizard（stub 記錄卸載次數：點遮罩 0 次，[×] 1 次）/ 工作區設定 / 關閉確認 / About / app 通知 [X] + OK + 三語 key / 從 Dialog 內拖曳到遮罩放開；`AddMenu` 點外部仍關閉；5 條 source guard）
- `npm run test:unit`：**PASS**，259 個測試檔，4467 passed、3 skipped（exit 0；派工時 HEAD 沒有另外跑基線，這次全綠，包含新測試）
- `npm run typecheck` = 0；`npm run typecheck:electron` = 0（測試檔在 `tsconfig` include 內，`@ts-expect-error` 驗證 `ModalOverlay` 不收 `onClick`）
- `npx vite build`：exit 0
- e2e `npx playwright test e2e/t0563-dialog-no-outside-close.spec.ts`：**1 passed**（隔離實例 `e2e-t0563-dialogs-*`、remotePort 62532，沒有碰使用者的 9876）。Settings 點遮罩、從標題拖到遮罩放開後仍開著，[X] 關閉；Profiles 點遮罩後仍開著，[X] 關閉；結束後 Terminal Server 已退出、runtime userData 已刪除。截圖 `e2e-results/…/settings-after-backdrop-click.png` 確認面板仍在。
- 沒有做的：Recovery / 更新通知 / Claude 與 Codex modal 沒有單獨的元件測試（由 source guard 覆蓋）；沒有真人 runtime 驗收。

**Commit**：見 frontmatter `commit`（`git commit --only` 本單檔案，沒有 push）。

### 互動紀錄

無（`CT_MODE=yolo`、`CT_INTERACTIVE=0`）。

### Renew 歷程

無。

### 遭遇問題

1. **RecoveryPrompt 沒有補 [X]**（交塔台決定）：它沒有 [X] 也沒有取消，但「恢復 session」和「重新開始」都是明確的關閉按鈕，而且是必選決策。加 [X] 等於多出「兩者都不選」的第三種語意（Terminal Server 存活中的 PTY 要怎麼處理），屬於行為變更，超出「只移除點遮罩」的範圍，所以沒有加。它本來就不能點遮罩關閉。
2. **Profiles 的 Esc 與 wizard**（既有行為，沒有改）：wizard 開著時按 Esc，Profiles 的全域 Esc handler 會走 `onClose()`，把整個 Profiles 連同 wizard 一起卸載，wizard 的 runner 因此 cancel → rollback。Esc 是刻意動作，工單也要求保留既有的 Esc，所以沒有改；如果希望 wizard 開著時 Esc 不作用（或只關 wizard 並先確認），需要另開工單。
3. 修正前巢狀 Dialog 有一個副作用：點刪除確認、遠端編輯或 wizard 的遮罩時，事件會冒泡到外層 Profiles 遮罩，連 Profiles 一起關掉。移除點遮罩關閉後這個問題也一併消失。
4. 沒有 Esc 的 Dialog（交塔台決定要不要補）：Settings、工作區設定、CloseConfirm、重啟確認、Worker 批次關閉確認、About、Snippet 編輯、app 通知、Claude / Codex 的 12 個 modal、Recovery、更新通知。
5. 工作過程中的技術細節：轉換腳本在 Claude / Codex 的第一個 modal 配錯結尾標籤（多行自閉合 `<div … />` 裡有 `=>`），已手動修正，並用縮排配對檢查加 typecheck / build 確認。另外有 5 個檔案在 working tree 是 CRLF（blob 是 LF，`autocrlf=true`），已轉成 LF。

### 回報時間

2026-10-16T15:09:53+0800
