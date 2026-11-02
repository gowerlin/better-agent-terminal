---
schema_version: 1
schema_kind: workorder
id: T0784
title: "PLAN-053：Electron 41.10.7 → 45（worktree 隔離試做；main 行程 clipboard 改 W3C 寫法；Windows 驗收關卡）"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: L
created_at: "2026-11-02T14:46:38+0800"
started_at: "2026-11-02T14:58:22+0800"
updated_at: "2026-11-02T15:20:55+0800"
tower_question: open
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

- [ ] `process.versions`（45.x / Chromium / Node / ABI）
- [ ] lock 範圍、`allowScripts` 與下載方式處理
- [ ] clipboard 改寫與單元測試；IPC 形狀不變
- [ ] typecheck 前後錯誤數、0 / 0
- [ ] `test:unit` / `test:legacy` / `vite build` / `build:dir` ＋ `verify-packaged-native` 綠，產物 Electron 45.x
- [ ] e2e 清單與結果
- [ ] 三平台待驗清單與塔台指令
- [ ] 隔離分支證據（base / validated / head SHA）

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

### 完成狀態

### 產出摘要

### 驗證

### 行為變化

### 遭遇問題

### 互動紀錄

### 給塔台的三平台驗收指令

### 隔離分支證據
- branch：`ct/T0784`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### commit 狀態

### 回報時間
