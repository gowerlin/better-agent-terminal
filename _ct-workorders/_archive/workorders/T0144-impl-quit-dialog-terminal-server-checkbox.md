# T0144 — PLAN-012 實作：Quit Dialog + Terminal Server CheckBox

## 元資料
- **工單編號**：T0144
- **類型**：implementation
- **狀態**：✅ DONE
- **優先級**：🔴 High
- **派發時間**：2026-04-17 14:00 (UTC+8)
- **完成時間**：2026-04-17 14:18 (UTC+8)
- **Commit**：`412d52c` — feat(quit): add confirmation dialog with Terminal Server checkbox (PLAN-012)
- **實際耗時**：12 分鐘（低於預估 30-60）
- **關聯 PLAN**：PLAN-012
- **前置工單**：T0143（研究 ✅ DONE）
- **後續工單**：T0145（手動驗收）
- **預估難度**：⭐⭐（單檔 ~60-80 行 + i18n，方向明確）
- **預估耗時**：30-60 分鐘

---

## 背景

T0143 研究結論：
- BAT 目前**沒有** Quit Confirmation Dialog，Cmd+Q → 直接 `before-quit` → cleanup → exit
- Terminal Server 是 fork + detached + unref，設計就是 outlive BAT main
- Graceful shutdown 機制**已存在**（`server:shutdown` IPC + SIGTERM handler + `TerminalServer.shutdown()`）
- 採 **Electron 原生 `dialog.showMessageBox`** 最小改動（不用 React、不用 IPC 擴充）

詳見 T0143 工單 Executive Summary 與 A1-A7 章節。

---

## 實作範圍

### 1. `electron/main.ts` `before-quit` hook 改造（~50 行）

**位置**：`main.ts:1245-1286` 區塊

**改造內容**：
```typescript
app.on('before-quit', async (e) => {
  if (_quitConfirmed) return;  // 避免遞迴

  e.preventDefault();

  // 新增：顯示確認 dialog
  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: [t('quit.dialog.cancel'), t('quit.dialog.ok')],
    defaultId: 1,
    cancelId: 0,
    title: 'Better Agent Terminal',
    message: t('quit.dialog.message'),
    checkboxLabel: t('quit.dialog.checkbox'),
    checkboxChecked: false,  // 預設不勾
  });

  if (result.response === 0) {
    // 使用者按 Cancel
    isAppQuitting = false;
    return;
  }

  const shouldStopServer = result.checkboxChecked;

  // 既有的 flush/save/cleanup 流程
  // ...（保留既有邏輯）

  if (shouldStopServer) {
    await stopTerminalServerGracefully();  // 新增 helper
  }

  _quitConfirmed = true;
  app.quit();
});
```

### 2. 新增 `stopTerminalServerGracefully()` helper

**實作**：
```typescript
async function stopTerminalServerGracefully(): Promise<void> {
  if (!_terminalServerProcess) return;

  return new Promise((resolve) => {
    const pid = _terminalServerProcess!.pid;
    let resolved = false;

    const finish = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    // Step 1: SIGTERM（graceful）
    _terminalServerProcess!.once('exit', finish);
    _terminalServerProcess!.kill('SIGTERM');

    // Step 2: 1500ms timeout → 強制 kill
    setTimeout(() => {
      if (!resolved && pid) {
        try {
          _terminalServerProcess!.kill('SIGKILL');
        } catch {}
        // Windows 額外保險
        if (process.platform === 'win32' && pid) {
          spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' });
        }
        finish();
      }
    }, 1500);
  });
}
```

### 3. i18n 文案

**`src/locales/en.json`** 新增：
```json
"quit": {
  "dialog": {
    "message": "Quit Better Agent Terminal?",
    "checkbox": "Also stop Terminal Server (recommended before version upgrade)",
    "ok": "Quit",
    "cancel": "Cancel"
  }
}
```

**`src/locales/zh-TW.json`** 新增：
```json
"quit": {
  "dialog": {
    "message": "離開 Better Agent Terminal？",
    "checkbox": "一併結束 Terminal Server（版本更新前建議勾選）",
    "ok": "離開",
    "cancel": "取消"
  }
}
```

---

## 實作注意事項

### 3.1 i18n 呼叫位置
`dialog.showMessageBox` 在 Electron main 執行，若 main 端沒有 i18n 機制，需：
- 從 main 端直接讀 locale file（同 code base 其他位置的作法）
- 或透過 IPC 向 renderer 索取翻譯後的字串
- 若現有 main 端無 i18n 框架，先用 hardcoded zh-TW 並留 TODO，不阻塞實作

### 3.2 `_quitConfirmed` flag
避免 Dialog 回答「OK」後 `app.quit()` 再次觸發 `before-quit` 造成遞迴。需新增此 module-level 變數。

### 3.3 Cancel 後重置
使用者按 Cancel → 設 `isAppQuitting = false`（既有變數），避免 window close 邏輯誤認為正在退出。

### 3.4 多視窗場景
`before-quit` 只觸發一次，Dialog 不會彈多次。已 OK。

### 3.5 macOS Cmd+Q vs 視窗紅色關閉鈕
- Cmd+Q → `before-quit`（會彈 Dialog）
- 最後一個 window close → `window-all-closed` → 若 `minimizeToTray=false` → `app.quit()` → `before-quit`（也會彈）
- 這是合理行為，確認過 T0143 A2 章節，不需特殊處理

### 3.6 Renderer 端無改動
採原生 dialog → **不用改 React、不用加 IPC channel、不用擴充 preload**。

---

## 完成定義

- [ ] `before-quit` 內顯示 Dialog，有 Cancel / OK 按鈕 + CheckBox
- [ ] CheckBox 預設不勾
- [ ] Cancel 能正確取消 quit（視窗不關）
- [ ] OK 勾選 → `stopTerminalServerGracefully()` 被呼叫，server 正確關閉
- [ ] OK 不勾選 → server 留背景（既有行為）
- [ ] SIGKILL + taskkill timeout fallback 存在（可不實測但 code 要在）
- [ ] i18n 文案 en / zh-TW 已新增（或 TODO 註解明確）
- [ ] TypeScript 編譯通過（`npx tsc --noEmit`）
- [ ] `npm run build` 通過
- [ ] Commit 推出（含有意義的 commit message，如 `feat(quit): add confirmation dialog with terminal server checkbox (PLAN-012)`）

---

## 工單回報區

### 實作摘要

依 T0143 研究結論，以 Electron 原生 `dialog.showMessageBox` 在 `before-quit` hook 前端加入確認對話框：

1. **新增 `_quitConfirmed` flag**（module-level）避免遞迴；`before-quit` 第一輪攔截並顯示 dialog，第二輪（來自 `app.quit()` 內部）直接放行。
2. **新增 `getQuitDialogStrings(lang)` helper** — 依使用者語言（`zh-TW` / `zh-CN` / `en`）回傳 hardcoded 字串，避免把 i18next 帶進 main 進程。留 `TODO(i18n-main)` 註記供未來 refactor。
3. **新增 `stopTerminalServerGracefully()` helper** — SIGTERM → 1500ms timeout → SIGKILL（+ Windows `taskkill /F /T /PID`）三段式，吞掉所有錯誤不 throw。
4. **改造 `before-quit` hook** — 以 focused window 為 parent（若無則 modeless）顯示 dialog，按鈕 `[取消, 離開]`（`defaultId=1`、`cancelId=0`），CheckBox 「一併結束 Terminal Server」預設不勾。Cancel → 還原 `isAppQuitting=false` 並 return；OK → 維持既有 flush / save / cleanup 流程，若 checkbox 勾選則在 cleanup 前呼叫 `stopTerminalServerGracefully()`。
5. **擴展 `PersistedSettings` 型別** 加入 `language?: string`，讓 main 能讀取使用者語系。
6. **locale 檔補上 `quit.dialog.*`**（en / zh-TW / zh-CN 三個語言），與 main 端 hardcoded 字串對齊，為未來 main-side i18n refactor 預備。

Cancel 路徑、CheckBox 不勾選、CheckBox 勾選三條分支均覆蓋；dialog 失敗時 fallback 回「不停 server、正常退出」以維持向後相容。

### 修改檔案清單

| 檔案 | 範圍 | 說明 |
|------|------|------|
| `electron/main.ts` | +149 行 | `PersistedSettings` 加 language、`_quitConfirmed` flag、`getQuitDialogStrings()`、`stopTerminalServerGracefully()`、`before-quit` hook 改造 |
| `src/locales/en.json` | +8 行 | 新增 `quit.dialog.{message,checkbox,ok,cancel}` |
| `src/locales/zh-TW.json` | +8 行 | 同上 — 繁中 |
| `src/locales/zh-CN.json` | +8 行 | 同上 — 简中 |

主要改動位置：
- `electron/main.ts:423` — `PersistedSettings.language?: string`
- `electron/main.ts:1249` — `_quitConfirmed` flag 宣告
- `electron/main.ts:1251-1287` — `getQuitDialogStrings()` helper
- `electron/main.ts:1289-1339` — `stopTerminalServerGracefully()` helper
- `electron/main.ts:1341-1440` — `before-quit` hook 改造

### 關鍵實作決策

1. **不把 i18next 帶進 main 進程** — 避免額外 bundle / init 成本，改用 hardcoded switch-by-lang。代價是 main / renderer 兩邊需手動同步，已留 `TODO(i18n-main)` 註記在 helper 上方 JSDoc。
2. **Dialog parent window 動態選擇** — 優先 `BrowserWindow.getFocusedWindow()`，其次第一個 window，都沒有才 modeless。避免多視窗場景 dialog 無主；同時不影響 Cmd+Q 與視窗全關兩條路徑。
3. **Cancel 行為必須復原 `isAppQuitting`** — 按 Cancel 後還原為 `false`，否則後續視窗 close handler 會誤判為 quit-in-progress 造成 UX 怪異（整個 app 看起來像卡住）。
4. **`stopTerminalServerGracefully` 在 profile/renderer flush 之後才呼叫** — 讓 PTY 狀態有機會先持久化再結束 server，避免資料遺失。
5. **Windows 額外 `taskkill /F /T`** — `child_process.kill('SIGKILL')` 在 Windows 只 kill 單一 process，子樹（PTY conhost / node）可能遺留；`taskkill /T` 保險清除整顆進程樹。
6. **Dialog 失敗 fallback 維持既有行為** — `try/catch` 包起 dialog 呼叫，即便 dialog 本身拋錯（罕見但可能，如 headless / 顯示器離線）仍能正常退出，不阻塞程式關閉；此時預設「不停 server」與 T0144 前行為一致。
7. **重入防護用 `_quitConfirmed` 而非重設 `isAppQuitting`** — `app.quit()` 內部會再次觸發 `before-quit`，若沿用 `isAppQuitting` 作為 guard 會在第二輪誤判並重跑 flush 邏輯。使用獨立 `_quitConfirmed` 旗標更乾淨。

### 已知未處理項 / TODO

- **TODO(i18n-main)**：字串 hardcoded 在 `getQuitDialogStrings()`。未來若導入 main-side i18n helper（或讀取 locale JSON），應移除此函式並改讀 i18n instance。
- **未實測 `taskkill` fallback** — timeout path 在正常開發環境不易重現（server 通常會在 SIGTERM 1500ms 內退出）；code path 存在但未 E2E 驗證，依工單完成定義「code 要在」即可，留給 T0145 驗收者視狀況補測。
- **多視窗場景 UX** — 多視窗下 dialog 只顯示一次（`before-quit` 只觸發一次），符合 T0143 A2 結論；若使用者期待每個視窗都詢問，另案處理。
- **Renderer 端 i18n 同步** — 本次 locale 檔新增的 `quit.dialog.*` 目前 renderer 沒人用，僅為未來同步留位，非錯誤。

### 編譯 / Build 結果
- `npx tsc --noEmit`：⚠️ **既有錯誤保留**（ThumbnailBar / WorkspaceView / UpdateNotification / settings-store / types 等 20+ 個 legacy errors），**但本次改動未新增任何 TS 錯誤**（grep `electron/main\.ts` → 0 error）
- `npm run build` / `npx vite build`：✅ 通過（main.js 152.15 kB、preload 16.11 kB、terminal-server 6.68 kB、renderer bundle ok）

### Commit hash
`412d52c` — feat(quit): add confirmation dialog with Terminal Server checkbox (PLAN-012)

### 執行時間
- 開始：2026-04-17 14:06 (UTC+8)
- 結束：2026-04-17 14:18 (UTC+8)
- 實際耗時：約 12 分鐘（預估 30-60 分鐘，低於預估）

### 移交給 T0145 的驗收要點

手動驗收時請特別測以下六條路徑（三條主線 + 三條邊界）：

**主線**
1. **Cancel 取消退出** — Cmd+Q / File→Quit → 出現 dialog → 按「取消」→ dialog 關閉、視窗不關、app 正常可用
2. **OK 不勾 checkbox** — Cmd+Q → dialog → 不勾「一併結束 Terminal Server」→ 按「離開」→ BAT 結束、背景 Terminal Server 仍存活（可用 `tasklist | findstr node` 或 `ps` 驗證）
3. **OK 勾 checkbox** — Cmd+Q → dialog → 勾選 checkbox → 按「離開」→ BAT 結束 + Terminal Server 一併結束（tasklist 應查不到 server PID）

**邊界**
4. **多視窗場景** — 開 2+ 個 BAT 視窗 → Cmd+Q → dialog 只彈一次、選擇影響所有 server 狀態
5. **語系切換** — 在 Settings 切到 zh-TW → Cmd+Q → dialog 文字為繁中；切到 zh-CN → 簡中；切到 en → 英文
6. **視窗全關觸發（macOS 以外）** — 關閉最後一個視窗（不啟用 minimize to tray）→ 會走 `window-all-closed` → `app.quit()` → `before-quit` → 同樣彈 dialog（符合 T0143 A2 設計）

**非測試項（code 在即可）**
- `taskkill` fallback：在正常環境不易觸發，讀 code 確認 Windows path 存在即可，不強制 E2E
- Dialog 失敗 fallback：罕見，讀 code 確認 `try/catch` 存在即可
