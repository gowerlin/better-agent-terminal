---
schema_version: 1
schema_kind: workorder
id: T0530
title: "detached 視窗「開啟設定」無反應（BUG-133）：讓 detached 視窗能開啟 Settings"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-133
priority: P3
sizing: S
created_at: "2026-10-14T18:09:18+0800"
started_at: "2026-10-14T18:10:12+0800"
updated_at: "2026-10-14T18:17:16+0800"
completed_at: "2026-10-14T18:17:16+0800"
target_version: "0.6.0-pre.10"
related:
  - BUG-133
  - "T0529（detached 分支的唯讀工作區設定、分頁列齒輪按鈕）"
affects_files:
  - src/App.tsx
  - src/components/SettingsPanel.tsx
  - src/components/WorkspaceView.tsx
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/__tests__/
  - src/components/__tests__/
  - electron/__tests__/
  - e2e/
  - _ct-workorders/T0530-detached-window-open-settings.md
  - _ct-workorders/BUG-133-detached-window-open-settings-noop.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）；e2e 一律隔離實例。不消耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 Detached 視窗持久化規則不得破壞（CLAUDE.md「Detached workspace 視窗的持久化」）。Settings 是全域設定（`settings.json`，非 workspace entry），要確認 detached 視窗改 Settings 後主視窗與其他視窗的同步行為正確（例如既有的 settings 廣播 / 重新讀取機制），不得造成兩邊互相覆寫。"
---

# T0530 — detached 視窗「開啟設定」（BUG-133）

## 背景

T0529 發現：detached 視窗中的 `onOpenSettings`（GitHub 面板等）只做 `setShowSettings(true)`，但 `src/App.tsx` 的 detached 分支沒有渲染 `SettingsPanel`，按了沒反應。詳見 **BUG-133**、T0529 回報區「偏差 / 備註」第 4 點。

## 任務

1. 盤點 detached 分支內所有會觸發 `onOpenSettings` / `setShowSettings` 的入口
2. 擇一修正（Worker 依架構判斷並說明取捨）：
   - [A] detached 分支也渲染 `SettingsPanel`：需確認 Settings 在多視窗同時開啟 / 修改時不互相覆寫（全域設定的寫入與廣播路徑）
   - [B] 在 detached 視窗按下時，改為把主視窗帶到前景並在主視窗開啟 Settings（經 main IPC）
   - 不建議：隱藏按鈕（功能退化）
3. 不改 T0529 的工作區設定唯讀行為

## 驗證

- 單元 / source guard：detached 分支的開啟設定入口有實際效果
- 可行的話，隔離實例 e2e：detach 一個工作區 → 觸發開啟設定 → Settings 出現（A）或主視窗出現 Settings（B）
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0（若改 electron）、`npx vite build` exit 0、`npm run test:unit` 全套無回歸；detached 相關既有 e2e（`detached-flush-on-close`、`detached-close-edges`）不回歸

## 驗收條件

- [ ] detached 視窗按「開啟設定」有效
- [ ] 全域設定不因多視窗而互相覆寫
- [ ] BUG-133：`status: FIXED`、`fixed_at`、body 狀態列同步

## Sub-session 執行指示

1. 讀本工單、BUG-133、T0529 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

**DONE — 採方案 [B]**：detached 視窗按「開啟設定」→ main 把父主視窗帶到前景（最小化則 restore、縮到 tray 則 show、focus）並在主視窗開 `SettingsPanel`。

- **入口盤點**：detached 分支內唯一會觸發開設定的是 `WorkspaceView` → `GitHubPanel` 的「設定自訂路徑」按鈕（`src/components/GitHubPanel.tsx:287`，gh 偵測不到時顯示）；`onOpenSettings` 只在 `WorkspaceView.tsx:1105` 往下傳。無 menu / 快捷鍵入口。T0529 的齒輪按鈕走 `onOpenWorkspaceSettings`（唯讀工作區設定），未動。
- **取捨（為何不選 A）**：`settings.json` 是全域檔，`settingsStore.save()` 寫入的是每個 renderer **整份記憶體副本**，且 main 沒有 settings 變更廣播 / 重新讀取機制（`settings:save` 只寫檔 + `logger.setConfig` + `buildMenu`）。A 在 detached 視窗多開一個完整編輯器，主視窗下一次任何 `save()`（例如字體縮放）就會用舊副本蓋掉 detached 的修改，反之亦然；要做對得另加廣播 + 各視窗 reload，範圍超出 S。B 不新增寫入者，Settings 仍只在主視窗編輯，與既有行為一致；remote profile 的 detached 也由同 profile 的主視窗開，`targetOS` / proxied `settings:*` 路由不變。
- **目標視窗**（`pickSettingsWindow`，`electron/detached-open-settings.ts`）：父視窗存活 → 父視窗；父視窗已關 → 同 profile（以 `resolveDetachedBinding` 解出的綁定）最近活動（`lastActiveAt`）的存活主視窗；綁定 unresolved 時只認父視窗，**不會**落到別的 profile 的視窗。都沒有 → 回 `{ ok:false, reason:'no-main-window' }`，detached 視窗顯示三語提示 `app.openSettingsNoMainWindow`（detached 分支新增 `appNotification` overlay）。非 detached sender 呼叫 → `{ ok:false, reason:'not-detached' }`，不做任何事。
- 主視窗經 `workspace.onOpenSettingsRequested`（`app:open-settings`）→ `setShowSettings(true)`；detached 視窗不註冊此 listener。
- Detached 持久化規則（`saveDetachedWorkspaceTerminals` / `DetachedTerminalOwners` / flush-before-close）完全未動；新 handler 不讀寫 registry、不改 `detachedWindows` / `detachedWindowRecords`（source guard 守住）。

### 修改檔案

- `electron/detached-open-settings.ts`（新增）：channel 常數、`pickSettingsWindow`、`openSettingsInWindow`
- `electron/main.ts`：import + `ipcMain.handle('workspace:open-settings-in-parent', …)`（置於 `workspace:reattach` 之後）
- `electron/preload.ts`：`workspace.openSettingsInParent()` / `workspace.onOpenSettingsRequested(cb)`
- `src/types/electron.d.ts`：上述兩個 API 型別
- `src/App.tsx`：`handleDetachedOpenSettings`（detached 分支的 `onOpenSettings`）、主視窗 listener effect、detached 分支渲染 `appNotification`
- `src/locales/{en,zh-TW,zh-CN}.json`：`app.openSettingsNoMainWindow`
- `electron/__tests__/detached-open-settings.test.ts`（新增）：目標視窗挑選 / focus 順序單元測試 + main / preload source guard
- `src/__tests__/detached-open-settings.test.ts`（新增）：App.tsx source guard（detached 分支不再 `setShowSettings(true)`、不渲染 `SettingsPanel`、失敗回饋、主視窗 listener）+ 三語 key
- `e2e/t0530-detached-open-settings.spec.ts`（新增）：隔離實例
- `_ct-workorders/BUG-133-detached-window-open-settings-noop.md`：`status: FIXED`、`fixed_at`、body 狀態列、修復說明

### 驗證

| 閘門 | 結果 | 證據 |
|---|---|---|
| `npm run typecheck` | PASS | exit 0（0 errors） |
| `npm run typecheck:electron` | PASS | exit 0（0 errors） |
| `npx vite build` | PASS | exit 0 |
| `npm run test:unit` 全套 | PASS | 223 files / 3713 passed / 1 skipped / 0 failed（首輪 `proxied-channels-binding.test.ts` BUG-095 守門擋下：`ipcMain.handle` 需字面 channel；改為字面字串後全綠） |
| 新增單元 / source guard | PASS | `electron/__tests__/detached-open-settings.test.ts`、`src/__tests__/detached-open-settings.test.ts` |
| e2e（隔離實例） | PASS | `t0530-detached-open-settings`：主視窗呼叫回 `not-detached` 且不開；detach → 父視窗最小化 → detached 呼叫回 `{"ok":true,"viaParent":true}` → 主視窗 `.settings-panel` 可見、已還原，detached 無 Settings / 無錯誤提示 |
| detached 既有 e2e 不回歸 | PASS | `detached-flush-on-close`、`detached-close-edges`（2 tests）、另加跑 `detached-workspace`、`detached-terminal-persistence`：全過 |

未測：真實 UI 點擊路徑（GitHub 面板按鈕只在「GitHub remote + gh 偵測不到」時出現，e2e 以 renderer 直接呼叫同一個 `openSettingsInParent()` 代替，App.tsx 接線由 source guard 守）；父視窗已關、改由同 profile 其他主視窗開啟的情境只有單元測試覆蓋。未碰使用者正在用的 BAT（e2e 全為 `BetterAgentTerminal-runtime-e2e-*` 隔離實例，結束後 userData 已移除），未耗 token。

### 偏差 / 備註

1. **affects_files 外的檔案**：新增 `electron/detached-open-settings.ts`（把挑窗 / focus 邏輯抽成可單元測試的純函式，比照 `renderer-flush.ts`）、`src/locales/*.json` 三語各 1 key（失敗回饋需 i18n）。皆為本修正所需的最小延伸。
2. `src/styles/settings.css` 的既有 M 狀態非本工單變更，未 commit。
3. 建議（未做，非本範圍）：CLAUDE.md「Detached workspace 視窗的持久化」節可補一行「detached 不渲染 SettingsPanel，開設定導回父主視窗（T0530）」，避免日後有人改成方案 A。
4. 既有、非本工單引入的限制：多個**主視窗**之間本來就各持一份 settings 副本、無廣播，同樣可能互相覆寫；本修正沒有讓它變差，也沒有處理它。
5. Landing check：**PASS**。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 present；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### Commit

見下方 commit（`git commit --only`，不含 `src/styles/settings.css`；未 push）。
