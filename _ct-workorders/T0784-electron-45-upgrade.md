---
schema_version: 1
schema_kind: workorder
id: T0784
title: "PLAN-053：Electron 41.10.7 → 45（worktree 隔離試做；main 行程 clipboard 改 W3C 寫法；Windows 驗收關卡）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: L
created_at: "2026-11-02T14:46:38+0800"
started_at: "2026-11-02T14:58:22+0800"
updated_at: "2026-11-02T15:27:11+0800"
completed_at: "2026-11-02T15:27:11+0800"
session_ids:
  - "a6666799-6143-40f6-bc75-452b17db2ba6"
depends_on: [T0783]
isolation: worktree
related:
  - "PLAN-053（high）；D223；T0781 回報區（候選比較、破壞性變更 × BAT 命中表、相依相容性、Graphite、EXP 關卡 1–8、工單草案 1）——**動工前必讀全文**；T0779（41.10.7 驗證清單與 e2e 冒煙）；T0783（只 build 的三平台 workflow，三平台驗收由塔台用它跑）"
  - "CLAUDE.md「Electron Runtime」「本機開發：npm 12 install scripts」「Packaging / Release 前置檢查」「Logging」（T0669 `decideSkiaGraphite`）節；`docs/agent-guide/npm12-install-scripts.md`、`build-toolchain.md`、`packaging-release-checks.md`；T0436 / BUG-108（圖片在 client 端讀）、T0522 / BUG-128（macOS Finder 檔案貼上）、T0524 / BUG-130（終端圖片貼上）"
affects_files:
  - package.json
  - package-lock.json
  - electron/main.ts
  - electron/clipboard-file-paths.ts
  - electron/image-attachments.ts
  - electron/claude-agent-manager.ts
  - electron/__tests__/clipboard-file-paths.test.ts
  - "electron/__tests__/*（clipboard / image 相關的既有或新增單元測試）"
  - e2e/t0524-terminal-image-paste.spec.ts
  - e2e/macos/t0778-macos-paste-acceptance.spec.ts
  - e2e/t0571-shift-right-click-copy.spec.ts
  - "e2e/fixtures/electron-isolation.ts（塔台答覆 Q-1 擴大範圍）"
  - README.md
  - CLAUDE.md
  - docs/agent-guide/build-toolchain.md
  - docs/agent-guide/npm12-install-scripts.md
  - docs/agent-guide/packaging-release-checks.md
  - .github/workflows/tests.yml
  - _ct-workorders/T0784-electron-45-upgrade.md
  - _ct-workorders/PLAN-053-electron-42-upgrade.md
renew_count: 0
workdir: "worktree（BAT `--isolation worktree`，分支 `ct/T0784`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 派工時機：塔台等 T0783 收單、push main 之後才派（讓 `ct/T0784` 的 base 含 `desktop-build.yml`，塔台之後才能用它 build 本分支）。"
  - "🔴 隔離：在 BAT 建的 worktree（`CT_WORKTREE`）工作，照 ct-exec § Worktree Isolation（工單檔寫回主 checkout、commit 在 `ct/T0784`、回報 base / validated / head SHA）。BAT 不安裝依賴：Worker 在 worktree 內自己 `npm ci`。不切其他分支、不 merge、不 push（三平台驗收與合併由塔台處理）。"
  - "🔴 目標版本：`electron` `^45.2.x`（動工當下 45 線最新 patch，`npm view electron@45 version`）。一次只換 Electron：electron-builder 26.8.1、Playwright 1.59.1（T0781：1.64 有 Electron 44 回歸）、vite / vite-plugin-electron、`@lydell/node-pty`、`@kutalia/whisper-node-addon`、內嵌 claude / codex 都**不動**；不用 `npm rebuild`。lock 只允許 electron 與它自己的相依變動（比照 T0779；只有 `peer` 旗標翻轉可接受，見 `docs/agent-guide/npm12-install-scripts.md` T0782 那一點）。"
  - "🔴 `allowScripts.electron`（使用者決定，D223）：Electron 42 起不在 postinstall 下載 binary，此項已無作用 → 從 `package.json` `allowScripts` 移除；CLAUDE.md「本機開發：npm 12 install scripts」節與 `npm12-install-scripts.md` 同步改寫（放行清單、手動補跑表的 electron 列改成第一次 `require('electron')` / `npx install-electron` 觸發下載，以實測為準）。`tests.yml` 的 `npm ci --ignore-scripts` 後 `node node_modules/electron/install.js` 步驟：實測 45 仍可用就保留並更新註解；不可用就改成 `npx install-electron`（或等效），寫明依據。🔴 第一次下載時 `index.js` 會用 `console.log` 印 `Downloading Electron binary...`，任何以 stdout 取 electron 路徑的腳本 / workflow 都要確認不受影響（grep `require('electron')` 的 stdout 用法）。"
  - "🔴 clipboard 改寫（T0781 命中表 44 那列，規模 M）：`electron/main.ts` `clipboard:saveImage` / `clipboard:read-image-data-url` / `clipboard:writeImage`、`electron/clipboard-file-paths.ts`（介面與 macOS `NSFilenamesPboardType` / `public.file-url` 讀法）、`electron/image-attachments.ts` 改用 `clipboard.read()` / `clipboard.write()` ＋ `ClipboardItem` 與 Promise。🔴 不變：IPC channel 名稱與參數 / 回傳形狀、renderer 與 preload、T0436 / BUG-108「圖片在 client 端讀」、T0522 / T0524 的使用者行為、寫入時的圖片格式。macOS 的實際剪貼簿格式名稱只能在 Mac 驗：以官方 `ClipboardItem` 對照表實作，並保留記錄實際格式的 debug log，等塔台以 `macos-acceptance.yml` 驗。"
  - "🔴 其他命中項（T0781 表）：`claude-agent-manager.ts:456` `Notification` 接 `failed` 事件寫 logger；`main.ts` Linux `app.setBadgeCount` 分支保留或移除（擇一並說明）；`README.md` macOS 最低版本改 13 (Ventura)；`main.ts:3389` 只給檔名的 `defaultPath` 在 43+ 的起始目錄要確認（能在 Windows 驗就驗，不能就標未確認）。safeStorage async **不在本單**（T0785）。🔴 macOS `disable-skia-graphite`（`decideSkiaGraphite`，T0669）**保留不動**。"
  - "🔴 Windows 驗收關卡（依序，任一失敗先修，修不了就停下回報 PARTIAL）：① `npm ci`＋第一次觸發下載、記錄 `process.versions`；② `verify-native-modules.js`、Electron 內載入 node-pty spawn 與 whisper `require`；③ 改 clipboard 前先記 `typecheck:electron` 錯誤數當基線，改完 `npm run typecheck` = 0、`npm run typecheck:electron` = 0；④ `npm run test:unit`、`npm run test:legacy` 全綠（BUG-195 的 `worktree-status-after-close` 逾時照 BUG-195 處理，單檔重跑）；⑤ `npx vite build`、`npm run build:dir` ＋ `verify-packaged-native.js --platform win --out release --arch x64` 綠、打包產物 Electron = 45.x、`dist-electron/preload.js` 仍只 `require(\"electron\")`；⑥ e2e：t0572 / t0776 / t0735 / t0744 / t0762 ＋ t0524 / t0571 ＋ t0742 ＋ `pre5-acceptance`（隔離實例、假模型，不用真實模型）；⑦ 手動冒煙改用 e2e 或 Playwright 腳本能做到的部分（多分頁、Terminal Server recovery、面板 / PromptBox 貼圖、複製圖片），做不到的列出交塔台。只結束隔離實例自己的程序，不碰使用者 BAT。"
  - "🔴 三平台（macOS / Linux）：本單不跑，回報寫「待塔台以 desktop-build ＋ macos-acceptance 驗」，並列出塔台要跑的指令（`--ref ct/T0784` 等）與要看的項目（t0778 Finder / 圖片貼上、`[gpu]` 日誌 `skia_graphite` 仍停用、簽章版通知、AppImage 啟動、Ubuntu 22.04 相容）。"
  - "🔴 文件：CLAUDE.md「Electron Runtime」（版號、Chromium / Node / ABI、42+ 的 binary 下載方式、clipboard 新寫法的唯一實作位置一行）、`build-toolchain.md`、`packaging-release-checks.md`（若打包檢查有變）；PLAN-053 文末補〈T0784 結果〉，狀態不改（合併後由塔台改）。不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0784 — Electron 41.10.7 → 45

## 元資料

- **工單編號**：T0784
- **類型**：implementation（相依大版本升級，隔離試做）
- **優先級**：P1
- **建立時間**：2026-11-02T14:46:38+0800
- **預估規模**：L
- **隔離**：`isolation: worktree`（分支 `ct/T0784`）
- **派工順序**：T0783 收單並 push main 後

## 背景

Electron 41 已停止更新。T0781 研究建議一次升到 45（支援到 2027-04-27，暫定），BAT 主要要改的是 Electron 44 起改寫的 main 行程 `clipboard` 模組；原生模組都是 N-API，已實測可在 45.2.1 載入。使用者選擇用 BAT worktree 隔離試做、三平台用只 build 不發布的 workflow 驗、safeStorage async 另開單、`allowScripts.electron` 一併移除（D223）。

## 範圍

1. 升 electron、移除 `allowScripts.electron`、確認 binary 下載與 CI 步驟。
2. clipboard 改寫與其他 T0781 命中項。
3. Windows 驗收關卡 ①–⑦。
4. 文件；列出塔台三平台驗收要跑的指令。

## 不做

- 不動其他相依、Graphite 設定、safeStorage（T0785）；不 merge、不 push、不發版。

## 驗收

- [x] `process.versions`（45.x / Chromium / Node / ABI）
- [x] lock 範圍、`allowScripts` 與下載方式處理
- [x] clipboard 改寫與單元測試；IPC 形狀不變
- [x] typecheck 前後錯誤數、0 / 0
- [x] `test:unit` / `test:legacy` / `vite build` / `build:dir` ＋ `verify-packaged-native` 綠，產物 Electron 45.x
- [x] e2e 清單與結果
- [x] 三平台待驗清單與塔台指令
- [x] 隔離分支證據（base / validated / head SHA）

---

## 回報區

> 以下由 sub-session 填寫

### 待塔台決策

#### Q-1：e2e 共用 fixture `e2e/fixtures/electron-isolation.ts` 不在 affects_files，能否擴大範圍改它，讓 Electron 45 下 7 支 e2e 通過？
- 提問時間：2026-11-02T15:20:55+0800
- 選項：[A] 擴大範圍：在 `launchIsolated` 的 `app.firstWindow()` 之後先等網址不是空白頁再 `waitForLoadState`（5 行＋註解），與產品變更同在 `ct/T0784` commit / [B] 不改 fixture：本單 e2e 關卡記 PARTIAL，另開單修 / [C] 其他：________
- Worker 建議：[A]。原因：同一份 `dist-electron`，Electron 41.10.7 的 `firstWindow()` 回傳時已在 `dist/index.html`，45.2.1 回傳時還在初始空白頁（`url=""`），`domcontentloaded` 對空白頁就成立，幾 ms 後 `loadFile` 才導覽、把 `win.evaluate` 的 context 毀掉（兩版各實測 2 次）。產品只載入一次，屬測試工具時序。t0572 / t0776 / t0735 / t0744 / t0762 / t0738 / t0704 第一次全部在啟動後第一個 `win.evaluate` 失敗；在 worktree 未 commit 試改 fixture 後 7/7 通過（2.6 分鐘）。`firstWindow()` 只有這個 fixture 與手動用的 `site-media.spec.ts` 呼叫，改一處涵蓋全部 e2e；不改的話升級合回 main 後所有 e2e 都會偶發失敗。
- 影響範圍：`e2e/fixtures/electron-isolation.ts`（新增）；關卡 ⑥ 的結果；`pre5-acceptance` 也走這個 fixture
- 阻塞：否（先做不受影響的步驟：packaged 版驗證、對話框起始目錄比對、回報草稿；收尾前等答覆）
- **通道**：BAT（`q-99100c39-d0c1fa44eaa5b4bf`，15:21 answered，choice 1 = [A]；答覆全文與執行見〈互動紀錄〉）

### 完成狀態

- **狀態**：DONE（Windows 關卡 ①–⑥ 通過；⑦ 以 e2e 做得到的部分已做，做不到的列在下方交塔台；macOS / Linux 依工單不在本單，見〈給塔台的三平台驗收指令〉）
- **一句話**：Electron 41.10.7 → **45.2.1**，main 行程 clipboard 改 W3C 寫法，IPC 形狀不變；Windows typecheck 0 / 0、unit / legacy、`build:dir` ＋ `verify-packaged-native`、指定 e2e 全過。另發現 Electron 45 下 Playwright `firstWindow()` 的時序變了，經 Q-1 擴大範圍修 e2e fixture。
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`；C-1 工單在 `$CT_HOME/_ct-workorders/` 下；C-3 `affects_files` 前 5 項都存在（PASS）；C-2 無 `branch` 欄位。`CT_HOME` = 主 checkout，`CT_WORKTREE_BRANCH` = `ct/T0784`。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **環境**：`CT_MODE=yolo`；`BAT_HELPER_DIR` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`（已設定）/ `BAT_TOWER_TERMINAL_ID` 等齊全。Node v26.13.0、npm 12.2.1、Windows 11 x64。依賴：worktree 內 `npm ci`（BAT 不裝依賴）。
- **方法論**：不適用（無 frontmatter `methodology`、無方法論 skill 呼叫、未見方法論注入）。
- **session_id**：a6666799-6143-40f6-bc75-452b17db2ba6

### 產出摘要

| 項目 | 內容 |
|---|---|
| 升版 | `package.json` `electron` `^41.10.7` → `^45.2.1`（`npm view electron@45 version` 最新 = 45.2.1）。lock 只改 `node_modules/electron`（version / resolved / integrity、`hasInstallScript` 拿掉、`bin` 多 `install-electron`）與 root devDependencies 那一行；沒有其他套件變動、沒有 `peer` 翻轉 |
| `allowScripts` | 移除 `electron`（D223）。乾淨 `npm ci` 結尾的封鎖清單只剩 `electron-winstaller`（預期） |
| 根 `postinstall` | mac 段先 `try{require('electron')}catch(e){}` 再 `plutil`：Electron 42+ 安裝時不下載 binary，不先觸發的話 `dist/Electron.app` 不存在、`plutil` 被 catch 吞掉，開發時 app 名稱變回 `Electron`（mac 未實測） |
| clipboard（`electron/main.ts`） | `clipboard:saveImage` / `clipboard:read-image-data-url` 改經 `readClipboardImage()`（`readClipboardPng` → `nativeImage.createFromBuffer`，沒有圖時 `createEmpty()`），`clipboard:writeImage` 改 `await clipboard.write([new ClipboardItem({ 'image/png': Blob })])`。四個 channel 名稱、參數、回傳形狀不變；`read-file-paths` 的那一行字串完全不變（既有 source guard） |
| `electron/image-attachments.ts` | 新增 `readClipboardPng(clipboard)`（第一個帶 `image/png` 的 item → Buffer；空 / 0 byte / `getType` reject → `null`），`[clipboard] read-image types=[…] png=<bytes|none>` debug log（只記 MIME 名稱）。`clipboardImageToDataUrl` 與大小上限不變 |
| `electron/clipboard-file-paths.ts` | 介面改 `ClipboardItemReader`（`read(): Promise<ClipboardItem[]>`），`readClipboardFilePaths` 改 async：`text/uri-list`（官方：macOS 對應 `NSFilenamesPboardType`）→ `electron application/osclipboard;format="NSFilenamesPboardType"`（plist）→ `…format="public.file-url"`；非 darwin 不碰剪貼簿。`[clipboard] read-file-paths types=[…] source=… count=N` debug log（不記路徑）。新增 `parseUriList`、格式常數 |
| 其他命中項 | `claude-agent-manager.ts` Notification 接 `failed` → `logger.warn('[notification] failed to show:', …)`；`main.ts` Linux `app.setBadgeCount` 分支**移除**（44 起只在 macOS 有作用，留著是 no-op）；`README.md` Electron 45、macOS 13 (Ventura)+；`main.ts:3389` 對話框見〈行為變化〉 |
| 測試 | `clipboard-file-paths.test.ts` 改成 async fake（`read()` → item / `getType` → Blob / reject），新增 uri-list / 原始 plist / file-url fallback / 空剪貼簿 / getType reject；`image-attachments.test.ts` 新增 `readClipboardPng` 3 案與 main 不再用 `readImage` / `writeImage` / `read('…')` 的 source guard |
| e2e | `t0524`（save / restore / putImage / putText / formats 改新 API）、`t0778`（`batView` 改記 `read()` types ＋ uri-list / 原始格式內容，`setImage('electron')` 改 `clipboard.write`）。`t0571` 不改（`readText` / `writeText` 回 Promise，`app.evaluate` 會等，實跑通過）。`e2e/fixtures/electron-isolation.ts`（Q-1）：`firstWindow()` 後 `expect.poll(() => win.url(), 30 s).not.toMatch(/^(about:blank)?$/)` 再 `waitForLoadState` |
| 文件 | CLAUDE.md「Electron Runtime」（版號 / Chromium / Node / ABI、42+ binary 下載、clipboard 唯一實作一行）與「本機開發：npm 12 install scripts」（放行清單）；`npm12-install-scripts.md`（electron 一點、根 postinstall、手動補跑表）；`build-toolchain.md`（electron-builder 26.8.1 打 45、ANGLE、preload）；`packaging-release-checks.md`（Test gate 的 install.js 說明）；`tests.yml` 註解與 step 名稱；PLAN-053〈T0784 結果〉 |

### 驗證

**① 安裝與 `process.versions`**（worktree 內乾淨 `npm ci`，使用最終 `package.json`）

- `npm ci` 後 `node_modules/electron/` 沒有 `dist/`、`path.txt`（42+ 不在安裝時下載）。`node node_modules/electron/install.js` exit 0 → `path.txt` = `electron.exe`、`dist/version` = `45.2.1`（`tests.yml` / `desktop-build.yml` 的作法在 45 照常可用，保留）。
- 第一次 `node -e "process.stdout.write(require('electron'))"`：stdout 兩行（`Downloading Electron binary...` + 路徑），第二次只有路徑。repo 內 `scripts/` / `e2e/` / `tests/` / `.github/` 沒有以 stdout 取 electron 路徑的用法（grep）。
- Electron 內 `process.versions`：electron **45.2.1**、chrome **156.0.8078.75**、node **24.22.1**、v8 15.6.75.25-electron.0、modules（ABI）**150**、napi 10。

**② 原生模組**：`node scripts/verify-native-modules.js` ✅（2 個模組、whisper `dist\win32-x64\whisper.node`、embedded claude native）；Electron 45.2.1 main 行程內 `@lydell/node-pty` `spawn('cmd.exe', ['/c','echo','pty-ok'])` exit 0 且收到輸出、`@kutalia/whisper-node-addon` `require` 成功。

**③ typecheck**：基線（升 45 後、改 clipboard 前）`npm run typecheck` = 0、`npm run typecheck:electron` = **4**（`main.ts` 2997 / 3007 `readImage`、3009 `ClipboardFormatReader`、3013 `writeImage`）。改完 **0 / 0**（`1bfa3b36` 與 HEAD `08b26812` 各跑一次）。e2e 檔不在兩個 typecheck 內：另以 `npx tsc --noEmit --strict … t0524 / t0571 / t0778` 檢查 = 0 錯誤。

**④ 單元測試**

- `npm run test:unit`（`1bfa3b36`）：382 files，**6713 passed / 1 failed / 10 skipped**；唯一失敗 = BUG-195 `worktree-status-after-close.test.ts` › `live → exited → git …`（`Test timed out in 5000ms`，檔案 6511 ms）。照 BUG-195 單檔重跑 **3/3 過**（2.97 / 2.99 / 3.28 s）。第二次完整重跑（無其他負載）同一支又逾時（5926 ms），其餘全過。這支 `vi.mock('electron')`，跑在 Node、不載入 Electron，與升級無關（詳〈遭遇問題〉）。
- `npm run test:legacy`：files **33 passed / 0 failed**、tests **472 passed / 0 failed**。
- clipboard 相關三檔（`clipboard-file-paths` / `image-attachments` / `claude-agent-manager-deps`）在 HEAD 重跑 45 passed。

**⑤ build / 打包**：`npm run build:dir`（含 verify-native-modules / verify-helper-bundle / verify-renderer-imports / `vite build` / `electron-builder --dir`）exit 0，electron-builder 26.8.1 自行下載 `electron-v45.2.1-win32-x64.zip`；`node scripts/verify-packaged-native.js --platform win --out release --arch x64` ✅（embedded claude PE x64、8 runtime packages / 15 含相依、6 helper、helper version 0.7.3-pre.6）。打包產物 Electron：以 `BAT_E2E_EXECUTABLE=release\win-unpacked\BetterAgentTerminal.exe` 啟動的隔離實例回報 `process.versions.electron` = **45.2.1**（chrome 156.0.8078.75、modules 150）。`dist-electron/preload.js` 只有 1 個 `require("electron")`、沒有 `Buffer.` / `setImmediate`。`win-unpacked/` 已無 `libEGL.dll` / `libGLESv2.dll`（44 ANGLE 靜態連結，預期）。

**⑥ e2e**（隔離實例、`fake-anthropic-api`，無真實模型；Windows；`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指 scratchpad）

| spec | fixture 修正前（`1bfa3b36`） | 修正後 |
|---|---|---|
| t0572 new-pty-initial-size | ✘ 啟動後第一個 `win.evaluate`：Execution context was destroyed | ✓ |
| t0776 auto-dialog-focus | ✘ 同上 | ✓ |
| t0735 workspace-waiting-badge | ✘ 同上 | ✓ |
| t0744 cache-history-cumulative | ✘ 同上 | ✓ |
| t0762 claude-panel-waiting | ✘ 同上 | ✓ |
| t0738 recovery-keeps-env（Terminal Server recovery） | ✘ 同上 | ✓ |
| t0704 heartbeat-recovery（時鐘跳動 / 暫停 / 真的死亡 recovery） | ✘ 同上 | ✓ |
| t0524 terminal-image-paste | ✓（image `["image/png"]` → `1b76`；.NET 2560x1440 bitmap → `1b76`；text → 原文） | — |
| t0571 shift-right-click-copy | ✓ | — |
| t0742 panel-image-attachments | ✓ | — |
| pre5-acceptance（`BAT_E2E_PRE5_ACCEPTANCE=1`） | A1 / A3x / A5 ✓（A5：≥ 20 次 raw-command 派工全 exit 0）；**A4 ✘**（見〈遭遇問題〉，與版本無關） | — |

- 修正後 7 支一次跑完 **7 passed（2.6 分鐘）**。fixture 對 41.10.7 的相容：以 `ELECTRON_OVERRIDE_DIST_PATH=<Electron 41.10.7 解壓目錄>` 讓同一份 dist、同一個 fixture 跑 t0572 → ✓（41 的 `firstWindow()` 回傳時已在 `dist/index.html`，`expect.poll` 第一次取值就成立）。

**⑦ 手動冒煙（以 e2e / Playwright 做得到的部分）**

- 多分頁：t0572（還原分頁 ＋ 4 個新分頁 ＋ ⏻ 重啟）✓。
- Terminal Server recovery：t0738、t0704 ✓。
- 貼圖 / 複製圖片（臨時 spec，跑完已刪、未 commit），經 renderer `window.electronAPI.clipboard.*`，source build 與 packaged build 各一次皆 ✓：main 寫入 PNG → `readImageDataUrl` = `data:image/png;base64,…` 解回 24x16；`saveImage` → `%TEMP%\bat-clipboard-<ts>.png` 24x16；.NET `Clipboard.SetImage`（只有 Bitmap）→ `readImageDataUrl` 解回 320x200；`writeImage(copy.png)` → `true`，.NET 看到 `PNG, Format17, System.Drawing.Bitmap, Bitmap, DeviceIndependentBitmap`、`ContainsImage` True、40x30；不存在的檔 → `false`；純文字剪貼簿 → `readImageDataUrl` `null`、`saveImage` `null`、`readFilePaths` `[]`；debug log 有 `[clipboard] read-image types=["image/png"] png=124`。終端 PromptBox 路徑由 t0524 覆蓋、面板附件由 t0742 覆蓋。
- 對話框起始目錄（T0781 ② 43 待確認，`main.ts:3389` `defaultPath` 只有檔名）：Windows 以探測腳本開 `showOpenDialog`、UI Automation 讀清單 —— **41.10.7 與 45.2.1 都從程序的 cwd 開始**（不變）；不給 `defaultPath` 時 45 改成 Downloads（41 是 cwd），BAT 每個呼叫都有給，不受影響。
- **做不到、交塔台**：語音輸入（需麥克風與真人）、通知實際顯示（Windows toast 與 macOS 簽章版）、Claude / Codex 面板「Ctrl+V 貼上剪貼簿圖片」的鍵盤路徑（e2e 只驗了 IPC 與拖放 / 對話框附件）、NSIS 完整重裝（release 前）、「匯入本機 tarball」整個流程（只驗了對話框起始目錄的 Electron 行為）。

### 行為變化

- 使用者可見：無預期變化（IPC 形狀、貼圖 / 複製圖片 / Finder 貼上的行為照舊；Windows 寫入格式實測與 `writeImage` 時相同含 DIB / Bitmap）。
- macOS 最低版本 12 → **13 (Ventura)**（Electron 44）。
- Linux：dock 數字徽章不再有作用（Electron 44 移除 Unity；BAT 移除 Linux 分支）。
- macOS 未簽章的本機 dev / `build:dir` 不顯示通知（Electron 42 UNNotification），現在會在 debug log 記 `[notification] failed to show:`。正式版有簽章，預期不受影響（待 mac 驗）。
- 開發者：`npm ci` 不再下載 Electron binary，第一次 `npm run dev` / `require('electron')` 才下載（stdout 多一行 `Downloading Electron binary...`）；Windows / Linux 安裝時間變短。
- 日誌：每次讀剪貼簿圖片 / macOS 檔案路徑多一行 `[clipboard] …` debug（只有 MIME 名稱與數字）。
- Electron 45 起 `safeStorage` 同步 API 會出棄用警告（功能照常；T0785 處理）。

### 遭遇問題

1. **e2e：Electron 45 的 `firstWindow()` 時序**（Q-1，根因與前後結果）：同一份 `dist-electron`，Electron 41.10.7 的 `app.firstWindow()` 回傳時 `win.url()` 已是 `…/dist/index.html?windowId=…`，45.2.1 回傳時是 `""`（初始空白頁），`waitForLoadState('domcontentloaded')` 對空白頁立即成立，約 3 ms 後 `loadFile` 的導覽 commit，啟動後第一個 `win.evaluate` 丟 `Execution context was destroyed`。兩版各以探測 spec 實測 2 次，結果一致；app 只導覽一次（`framenavigated` 只有 `dist/index.html` 一次），產品不受影響。修正前 7 支失敗、修正後 7/7 通過（〈驗證〉⑥ 表）。`firstWindow()` 的其他呼叫只有手動用的 `site-media.spec.ts`（不在 CI、本來就延後取第一格畫面），依塔台條件 3 不動。
2. **BUG-195**：本 session 兩次完整 `test:unit` 都是這支逾時（6511 ms / 5926 ms），單檔 3/3 過。第一次時我同時在跑對話框探測（有負載），第二次沒有其他工作但機器上仍有其他 session 的 node / claude 程序（約 25 個）。這支測試 `vi.mock('electron')`、在 Node 執行，不會載入 Electron，與本次升級無關；但頻率比 BUG-195 記載的「偶發」高，建議塔台在 BUG-195 補記這兩次。
3. **pre5-acceptance A4 失敗**：A4 唯讀檢查使用者真實的 `%APPDATA%\BetterAgentTerminal\Logs`，要找到含 `[userdata-migration] marker: written` 的日誌；日誌只保留最近 10 份（`MAX_LOG_FILES`），T0480 遷移那份早已輪替掉，`withReport` 為 `undefined`。A4 不啟動任何 Electron 實例、只讀檔，結果與 Electron 版本無關（環境相依）。
4. **剪貼簿是系統共用狀態**：t0524 / 臨時 spec 會暫時改寫使用者的剪貼簿，結束時還原文字與 PNG（還原成功的 log 都有）；早期探測腳本（`scratchpad/probe/`）也寫過剪貼簿，最後 `clear()`。若使用者原本剪貼簿有其他格式（HTML、檔案），可能沒還原。
5. 探測過程：第一版探測腳本用了無效的 base64 PNG（`createFromBuffer` 得到空圖），造成「寫入 `image/png` 無效」的假象，換成 `createFromBitmap` 後正常；也觀察到寫入空圖時 `clipboard.write` 不報錯、剪貼簿維持原內容（BAT 在 `writeImage` 先檢查 `isEmpty()`，不受影響）。
6. 範圍外、未修（候選）：
   - `.github/workflows/desktop-build.yml` 的 unit-tests job 也有一份 `node node_modules/electron/install.js`，step 名稱仍寫「electron's postinstall only」：功能照常，只是說明過時（不在 affects_files）。
   - `src/lib/terminal-paste.ts:61` 註解仍寫 main 判斷用 `readImage()`（現在是 `clipboard:read-image-data-url` → `readClipboardPng`），不在 affects_files。
   - 臨時的 clipboard IPC e2e（四個 channel、source / packaged 都可跑）有回歸價值，若要納入 repo 需另開單（本單未 commit）。
   - `docs/agent-guide/logging.md`、`packaging-release-checks.md` 有幾處「Electron 41 實測」的歷史紀錄，保留原樣（描述的是當時的實測）。

### 互動紀錄

- [15:20] Q-1（BAT 通道 `q-99100c39-d0c1fa44eaa5b4bf`）：e2e fixture 不在 affects_files，能否擴大範圍？→ A（塔台，15:21，choice 1）：採 [A]；條件 ① 只改等待時序、有上限、逾時照常丟錯 ② 對 41.10.7 也相容並說明怎麼確認 ③ 不改產品載入流程、site-media 視需要 ④ affects_files 補檔、〈遭遇問題〉記根因與前後結果 → Action：照條件改 `launchIsolated`（`expect.poll` 30 s 上限，逾時丟錯）、以 41.10.7 跑 t0572 確認、affects_files 補上、`08b26812` commit；`site-media.spec.ts` 不動（手動用、本來就延後取第一格畫面）。

- [15:23] 依塔台條件 4 在 frontmatter `affects_files` 補上 `e2e/fixtures/electron-isolation.ts`；刪除 `tower_question`（唯一一題已答）。

### 給塔台的三平台驗收指令

前提：`ct/T0784` 要先 push 到 `origin`（本單不 push；desktop-build 以 `ref` 取分支，macos-acceptance 以 workflow 的 `--ref` checkout spec）。

```bash
# 1. 三平台只 build、不發布（T0783）；checks=true 會在同一個 commit 再跑 typecheck / unit / legacy（Linux）
gh workflow run desktop-build.yml -R gowerlin/better-agent-terminal -f ref=ct/T0784 -f version=0.0.0-exp.784
gh run list -R gowerlin/better-agent-terminal --workflow desktop-build.yml --limit 1   # 取 <run id>

# 2. macOS 驗收：🔴 一定要 --ref ct/T0784，讓 runner checkout 的 e2e/macos/t0778 是新 clipboard API 版本
#    （main 上的 t0778 還在呼叫 readImage / availableFormats / read(format)，對 45 的 dmg 會直接 TypeError）
gh workflow run macos-acceptance.yml -R gowerlin/better-agent-terminal --ref ct/T0784 -f build_run_id=<run id>
```

要看的項目：

| 平台 | 項目 | 怎麼看 |
|---|---|---|
| 全部 | 三個 desktop job 綠、`verify-packaged-native` 綠、產物 Electron = 45.2.1 | desktop-build log（electron-builder `downloaded url=…v45.2.1…`） |
| Linux | `checks` 的 typecheck / unit / legacy（ubuntu，`install.js` 步驟在 45 可用） | desktop-build 的 checks job |
| macOS | t0778 Finder 檔案貼上 / 圖片貼上（Cmd+V、Ctrl+V） | `macos-report.md`；🔴 `batView` 的 `types` 是 **macOS 實際格式名的證據**：Finder 複製時要有 `text/uri-list`（或原始 `…format="NSFilenamesPboardType"`），`readFilePaths` 要列出路徑；BAT debug log 的 `[clipboard] read-file-paths … source=…` 記錄實際命中哪一種 |
| macOS | `[gpu]` 日誌 `skia_graphite` 仍停用（`decideSkiaGraphite` 未改；`--disable-skia-graphite` 在 Chromium 156 是否仍有效 T0781 未確認） | 隔離實例的 debug log `[gpu]` 行 |
| macOS | 簽章版通知會顯示（`mac_sign=auto` 有 secret 時簽章）；未簽章時 debug log 應出現 `[notification] failed to show:` | 手動或 log |
| macOS | dev 環境 `npm ci` 後 `Electron.app` 名稱仍是 BetterAgentTerminal（根 `postinstall` 改先 `require('electron')`） | 本機 mac `npm ci` 後看 `node_modules/electron/dist/Electron.app/Contents/Info.plist` 的 `CFBundleName`（CI 不涵蓋） |
| Linux | AppImage 啟動冒煙、Ubuntu 22.04 相容（Electron 45 的 glibc 需求 T0781 未確認） | AppImage 在 22.04 / 24.04 啟動 |
| Windows | release 前 NSIS 完整重裝驗收（CLAUDE.md「Packaging / Release 前置檢查」） | 照既有流程 |

### 隔離分支證據
- branch：`ct/T0784`
- base_sha：`a63f5ea0ca173a2dcf1c165f747385f4bec604a7`
- validated_sha：`08b268125be70b4c32f2991c4fc3074dac1b3854`
- head_sha：`08b268125be70b4c32f2991c4fc3074dac1b3854`
- validated_sha ≠ head_sha 的說明：相等。各關卡跑在哪個 commit：typecheck、clipboard 單元測試在 HEAD 重跑（0 / 0、45 passed）；`test:unit` / `test:legacy` / `build:dir` ＋ `verify-packaged-native` 跑在 `1bfa3b36`（`build:dir` 在 commit 前執行，工作樹與 `1bfa3b36` 相同）；之後的兩個 commit 只改 `docs/agent-guide/build-toolchain.md`（`4ef1a915`）與 `e2e/fixtures/electron-isolation.ts`（`08b26812`，不在 vitest / build 範圍），e2e 修正後的 7 支、pre5、packaged 執行時工作樹內容與 `08b26812` 相同（fixture 先未 commit 試跑、內容未再改即 commit）。

### commit 狀態

- `ct/T0784`（worktree，未 push、未 merge）：
  - `1bfa3b36` feat: upgrade Electron 41.10.7 -> 45.2.1, W3C main-process clipboard (T0784)
  - `4ef1a915` docs: build-toolchain Electron 45 packaging note (T0784)
  - `08b26812` test(e2e): wait for the app URL after firstWindow() on Electron 45 (T0784)
- 主 checkout `main`（只 commit 工單 / PLAN 檔，`git commit --only`）：`97cdd1df`（IN_PROGRESS）、`256643c6`（Q-1）、本次收尾 commit（工單＋PLAN-053）。
- `git -C "$CT_WORKTREE" status --porcelain` = 空（臨時 e2e spec 已刪；`release/`、`dist-electron/`、`e2e-results/` 為 gitignore）。

### 回報時間

- 2026-11-02T15:25:28+0800
