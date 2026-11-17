---
schema_version: 1
schema_kind: workorder
id: T0878
title: "mermaid 12：建置時把 elkjs 換成空殼、不打包；移除已無作用的 overrides.langium"
type: implementation
status: DONE
created_at: "2026-11-17T11:02:17+0800"
started_at: "2026-11-17T11:09:58+0800"
updated_at: "2026-11-17T11:20:52+0800"
completed_at: "2026-11-17T11:20:52+0800"
session_ids:
  - "e060e7f2-eb35-4352-8588-cc3639d50dd6"
repo: better-agent-terminal
priority: P2
sizing: S
depends_on: [T0877]
related:
  - "D299；T0876 回報區〈bundle 大小〉〈elkjs 授權〉〈建議後續〉"
affects_files:
  - _ct-workorders/T0878-mermaid-stub-elk.md
  - vite.config.ts
  - src/lib/**（只限新增的空殼模組，或放在 vite.config.ts 旁的建置用檔案）
  - src/components/FileTreeMarkdown.tsx（只限必要時）
  - scripts/__tests__/** 或 src/**/__tests__/**（守門測試）
  - package.json（只限移除 `overrides.langium`）
  - package-lock.json（只在 npm 自動改寫時）
  - docs/agent-guide/build-toolchain.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 目標：renderer 的建置產物（`dist/`，以及 `app.asar`）不含 elkjs 的程式碼，安裝檔不散布 EPL／GPL 程式碼。做法以 vite 設定（`resolve.alias` 或小 plugin）把 mermaid 對 elkjs 的匯入換成 BAT 自己的空殼模組；不得修改 `node_modules`、不得 patch mermaid、不得用 `patch-package`。"
  - "🔴 行為：除了 ELK 之外，mermaid 預覽的行為與 T0876 最終完全相同（7 種圖的渲染結果、顏色）。圖裡寫 `layout: elk` 或 `flowchart-elk` 時，可以退回 dagre 或由 mermaid 顯示錯誤圖，但預覽不得整個壞掉、不得有未處理的例外讓其他圖不顯示。"
  - "🔴 不改 mermaid 或任何套件版本（只移除 `overrides.langium`）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0878 — mermaid 12：不打包 elkjs

## 元資料
- **工單編號**：T0878｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-17 11:02 (UTC+8)
- **規模**：S｜**依賴**：T0877（同一個 checkout，依序執行）｜**決策**：D299

## 背景
T0876 升 mermaid 12.3.0 後，mermaid 內建的 ELK layout 帶進 `elkjs` 0.12.1（`EPL-2.0 OR GPL-3.0-or-later`），vite 把它打成 lazy chunk `dist/assets/elk-*.js`（1,513,070 bytes）。BAT 設 `layout: 'dagre'`，執行時不會載入，但會隨安裝檔散布。使用者決定不打包（D299）。T0876 也確認 `overrides.langium` 已無作用（lock 中沒有任何套件依賴 langium）。

## 任務
1. 找出 mermaid 12.3.0 的 dist 中載入 elkjs 的確切匯入（模組 specifier 與載入方式，例如 `registerLayoutLoaders` 的動態 import），決定替換點。替換點要用套件路徑（例如 `elkjs/lib/elk.bundled.js`），不要依賴 mermaid 內部 chunk 的雜湊檔名。
2. 在 `vite.config.ts` 加替換，空殼模組的行為讓 mermaid 退回或報錯而不影響其他圖；加註解說明原因（D299、授權）。
3. 守門測試（vitest 收得到的位置）：`vite build` 後 `dist/` 不含 elkjs 的特徵字串（例如 elkjs 的授權標頭或獨有識別字），以及沒有 `elk-*.js` chunk（或 chunk 只剩空殼）。比照 `asar-runtime-deps.test.mjs` 沒有 build 時跳過的寫法。
4. 渲染驗證：沿用 T0876 的 scratch 方式，7 種圖結果與 T0876 最終（C 變體）相同；另測一張 `layout: elk` 的圖與一張 `flowchart-elk`，記錄結果（退回 dagre 或錯誤圖），確認同頁其他圖照常顯示、console 沒有未處理例外。
5. 移除 `package.json` 的 `overrides.langium`；`npm install` 後確認 lock 只有預期變化（或沒有變化）。
6. `docs/agent-guide/build-toolchain.md` 記一段：為什麼替換 elkjs、替換點、升 mermaid 時要檢查什麼（匯入 specifier 改了，守門測試會失敗）。

## 關卡
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit`、`npm run test:legacy`（與 T0877 後比較）
- `npx vite build`（記錄升級前後 `dist/assets` JS 總大小，應回到約 T0876 前 +0.3 MB 的水準）
- `npm run build:dir` ＋ `verify-packaged-native --platform win --arch x64`，並確認 `app.asar` 內沒有 elkjs
- `npm ci` 在最終 lock 上 exit 0；`npm audit` 與 T0876 後相同（6 項，T0875 例外）

## 驗收條件
- [x] 替換點與空殼模組說明（含 mermaid 的 specifier 來源 檔案:行）
- [x] 守門測試：有 build 時驗證、沒有 build 時跳過；故意拿掉替換時會失敗（附輸出）
- [x] 7 種圖與 T0876 最終相同；`layout: elk`／`flowchart-elk` 的行為記錄
- [x] `dist/assets` JS 大小前後、`app.asar` 不含 elkjs
- [x] `overrides.langium` 已移除，lock 變化說明
- [x] commit 只含本單範圍，不 push

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **狀態**：DONE
- **開始**：2026-11-17T11:09:58+0800｜**完成**：2026-11-17T11:20:52+0800
- **session_id**：e060e7f2-eb35-4352-8588-cc3639d50dd6
- 摘要：vite `resolve.alias` 把所有 `elkjs` 匯入換成 `src/lib/elkjs-stub.ts`。`dist/` 與 `app.asar` 都不再含 elkjs，`dist/assets` 的 JS 減少 1,477,071 bytes。7 種圖的渲染與 T0876 最終版相同；`layout: elk` 那張圖改顯示 mermaid 的錯誤圖，其他圖照常。`overrides.langium` 已移除，lock 沒有變化。

### 落點檢查
- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，PASS
- C-1：工單在 REPO_ROOT 底下，PASS
- C-3：可檢查的項目（`vite.config.ts`、`package.json`、`docs/agent-guide/build-toolchain.md` 等）都存在，PASS
- C-2：工單沒有 `branch` 欄位，不適用（目前在 `main`）
- `CT_HOME` 沒有設定（不是 worktree 派工）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄，不比對）

### 替換點與空殼模組
- **mermaid 的匯入**（mermaid 12.3.0，`package.json` `module` = `./dist/mermaid.core.mjs`）：
  - `node_modules/mermaid/dist/chunks/mermaid.core/elk-XV6XMXQE.mjs:32` `import ELK from "elkjs/lib/elk.bundled.js";`。`:895` `new ELK()`，`:1329` `await elk.layout(elkGraph)`，在 `runElkLayout` 的 try/catch 裡，失敗時 `log.error` 後重新 throw。
  - 載入方式：`chunk-CFHHFPVC.mjs:67` `elkLayoutLoaders` 的 loader 以 `import("./elk-XV6XMXQE.mjs")` lazy 載入，再由 `registerDefaultLayoutLoaders` 註冊成 `elk` 與 `elk.*` 等 layout。
  - mermaid.core 的 chunk 中，只有這一個 elkjs specifier（守門測試會掃描確認）。
- **替換**（`vite.config.ts`，`resolve.alias` 改成陣列形式；`@` 的 alias 意思不變）：`{ find: /^elkjs(?:\/.*)?$/, replacement: path.resolve(__dirname, './src/lib/elkjs-stub.ts') }`，旁邊有註解說明 D299 與授權。以套件路徑比對，不依賴 mermaid chunk 的雜湊檔名。比對範圍是整個 `elkjs` 套件，所以 mermaid 改用其他 elkjs 進入點時，也不會把 elkjs 打包進來。
- **空殼** `src/lib/elkjs-stub.ts`：default export `ELK` 類別，`layout()`、`knownLayoutAlgorithms()`、`knownLayoutOptions()`、`knownLayoutCategories()` 都回傳 rejected Promise（`ELK_NOT_BUNDLED_MESSAGE`）；`terminateWorker()` 不做事。這樣做是選「由 mermaid 顯示錯誤圖」：要退回 dagre，就得替換 mermaid 自己的 loader chunk（雜湊檔名）或 patch mermaid，工單禁止這兩種做法。
- 沒有改 `node_modules`、mermaid、`patch-package`，也沒有改 `FileTreeMarkdown.tsx`。

### 守門測試
- `scripts/__tests__/no-elkjs-in-dist.test.mjs`（`// @vitest-environment node`，由 vitest 的 `scripts/__tests__/**/*.test.mjs` 收進來），4 項：
  1. `vite.config.ts` 有 alias 那一行（比對去掉縮排後的整行，所以註解掉會失敗）
  2. 空殼的 `layout()`、`knownLayoutAlgorithms()` 會 reject，`terminateWorker()` 不會 throw
  3. 已安裝 mermaid 的 `dist/chunks/mermaid.core/*.mjs` 只匯入 `MERMAID_ELKJS_SPECIFIERS` = `['elkjs/lib/elk.bundled.js']`
  4. `it.skipIf(!distBuilt)`（看 `dist/assets` 存不存在，比照 `asar-runtime-deps.test.mjs`）：有 `mermaid.core-*.js`；沒有任何 JS 含 `org.eclipse.elk`、`Eclipse Public License`（elkjs bundle 分別出現 362 次與 2 次，mermaid 自己的 elk chunk 一次都沒有）；每個 `elk-*.js` 小於 200,000 bytes 且含空殼訊息
- 有 build：4 passed。
- 沒有 build（暫時把 `dist` 改名）：`Tests  3 passed | 1 skipped (4)`。
- **故意拿掉替換**（暫時把 alias 那行註解掉，重新 `npx vite build`，跑完以 scratch 備份還原 `vite.config.ts`）：dist 回到 7,274,042 bytes，`elk-XV6XMXQE-BQwAZa_J.js` 1,513,070 bytes。測試失敗：
  ```
  × dist/assets has no elkjs code and the elk chunk is only the stub (needs `npx vite build`)
  FAIL  scripts/__tests__/no-elkjs-in-dist.test.mjs > elkjs is not bundled (T0878 / D299) > dist/assets has no elkjs code and the elk chunk is only the stub (needs `npx vite build`)
  AssertionError: expected [ 'elk-XV6XMXQE-BQwAZa_J.js' ] to deeply equal []
   Test Files  1 failed (1)
        Tests  1 failed | 3 passed (4)
  ```
  那一次第 1 項還是通過，因為註解掉的行仍包含 alias 字串。之後把第 1 項改成比對整行。

### 渲染驗證
- **方式**（scratch，沒有 commit）：用 vite 的 build API（repo 的 vite 7.3.8 ＋ `@vitejs/plugin-react`）打包一個 scratch 入口。入口直接 import BAT 的 `MarkdownPreview`（`src/components/FileTreeMarkdown.tsx`，也就是實際的 marked → DOMPurify → `mermaid.run` 路徑）與 `src/styles/file-browser.css`，再用 repo 的 Electron 45.2.1 開視窗渲染。
  - 兩個變體：**nostub** = 沒有 elkjs alias（就是 T0876 最終的 C：12.3.0＋`dagre`／`classic`），**stub** = 加上與 `vite.config.ts` 相同的 alias。
  - 同一頁 10 張圖：flowchart（subgraph、迴圈）、sequence（中文、Note）、class、state、gantt、中文 flowchart、語法錯誤（以上 7 種同 T0876），再加上 `layout: elk` front matter 的 flowchart、`flowchart-elk`，最後一張普通 flowchart（確認 ELK 之後的圖照常渲染）。
  - 擷取：每張圖有沒有 svg、`.mermaid-error`、`aria-roledescription`、viewBox、節點、連線、文字的 computed color、完整 SVG markup（mermaid id 正規化）、page `error`／`unhandledrejection`、console 的 error／warning，以及整頁截圖。
- **結果**：

| 圖 | nostub（T0876 最終） | stub（本單） |
|---|---|---|
| 7 種圖（flowchart／sequence／class／state／gantt／中文 flowchart／語法錯誤） | 都有 svg | 屬性與顏色**完全相同**（例：flowchart viewBox `0 0 553.5 576`、fill `rgb(31, 32, 32)`、stroke `rgb(204, 204, 204)`、連線 `rgb(102, 102, 102)`）。SVG markup 除了 class 圖都逐字相同。class 圖的差異是邊框路徑的隨機控制點：nostub 自己連跑兩次也不同，把小數遮掉後兩邊相同 |
| `layout: elk` | ELK 排版，`flowchart-v2`，viewBox `4 4 416 188` | **mermaid 錯誤圖**（炸彈＋「Syntax error in text」＋「mermaid version 12.3.0」，viewBox `0 0 2412 512`），div 有 svg，所以 BAT 不加 `.mermaid-error` |
| `flowchart-elk` | `flowchart-elk`，viewBox `0 0 196 174` | **相同**。在 BAT 的 `layout: 'dagre'` 設定下，這張圖原本就不走 ELK |
| ELK 之後的普通圖 | 正常 | 正常（相同） |

- 兩個變體的 page `error`／`unhandledrejection` 都是 0；console 都只有 Electron 的 CSP 安全警告（scratch 頁沒有 CSP，與本單無關），沒有 error。`mermaid.run` 丟出的錯誤由 BAT 既有的 try/catch 接住。
- 截圖（scratch）：`layout: elk` 的位置是錯誤圖，前後各圖都正常顯示。錯誤圖上方有一個很小的殘留方框，是 mermaid 錯誤渲染的副作用，不影響其他圖。
- 沒有跑淺色：BAT 的 mermaid 設定固定 `theme: 'dark'`，本單也沒有改主題設定。

### bundle 與 app.asar
| 項目 | 本單前（T0877 後，HEAD `103abef6`） | 本單後 |
|---|---|---|
| `dist/assets` 全部 JS（75 檔） | 7,274,042 | **5,796,971**（−1,477,071） |
| `elk-*.js` | 1,513,070（含 elkjs） | 36,121（mermaid 的 ELK renderer＋空殼） |
| 含 elkjs 特徵字串的 JS | 1 | 0 |

- 與 T0876 前（mermaid 11，5,462,536）相比是 +334,435 bytes，約 +0.33 MB，符合預期的「約 +0.3 MB」。
- `app.asar`（`npm run build:dir` 產出的 `release/win-unpacked/resources/app.asar`）：用 `@electron/asar` `extractAll` 解到 scratch 後掃描，729 個檔、349 個 JS。沒有任何路徑含 `elkjs`，沒有檔案含 elkjs 特徵字串。唯一的 `dist/assets/elk-XV6XMXQE-BzuxtarN.js`（36,121 bytes）含空殼訊息，作為掃描確實有讀到內容的正向對照。`app.asar.unpacked` 也沒有 elk。

### overrides.langium 與 lock
- `package.json` `overrides` 拿掉 `"langium": ">=4.2.2"`；其他 override 不動。
- `npm install` exit 0，`package-lock.json` **沒有變化**（`git diff` 為空）。lock 裡本來就沒有任何 langium。

### 關卡結果
| 關卡 | 結果 | 與 T0877 後比較 |
|---|---|---|
| `npm run typecheck` | exit 0 | 相同 |
| `npm run typecheck:electron` | exit 0 | 相同 |
| `npx vite build` | exit 0 | dist JS 7,274,042 → 5,796,971 |
| `npm run test:unit`（vitest json reporter） | 第一次：8419 個，8287 passed / 1 failed / 131 skipped，9 檔 failed，都是並行負載下的逾時（`headless-*` 5 檔 `Hook timed out in 10000ms`、`local-helper-capability`、`terminal-query-handlers`、`tower-questions`、`helper-connection-hygiene` 的「a channel with a newline…」），與 T0876 記錄的 flaky 是同一組。這 9 檔單獨重跑：206/206 passed。第二次全量：**8377 passed / 0 failed / 42 skipped** | T0877 後 8373 passed / 42 skipped（8415 個）；本單多 4 個新測試 |
| `npm run test:legacy` | files 33 passed／tests 472 passed | 相同 |
| `npm run build:dir` | exit 0 | — |
| `verify-packaged-native --platform win --arch x64` | exit 0，`✅ every windows package passed (x64)` | — |
| `npm ci`（最終 lock） | exit 0，added 749 packages。install-scripts 警告只有 `electron-winstaller@5.4.0`，另有使用者層 `.npmrc` 的 `allow-scripts setting is being ignored` | 與 T0876 相同 |
| `npm audit` | moderate 6（`@electron/universal`、`app-builder-lib`、`dmg-builder`、`electron-builder`、`electron-builder-squirrel-windows`、`minimatch`），其他 0 | 與 T0876 後相同（T0875 例外） |

- 測試時 `BAT_HELPER_LOG_DIR`／`BAT_USER_DATA` 指到暫存目錄。

### 環境
- Node v26.13.1、npm 12.2.2、Windows x64、Electron 45.2.1（渲染驗證用 repo 的 `node_modules/electron`）。

### 變更檔案
- `vite.config.ts`：`resolve.alias` 改成陣列，加 elkjs → 空殼（含註解）
- `src/lib/elkjs-stub.ts`（新）
- `scripts/__tests__/no-elkjs-in-dist.test.mjs`（新）
- `package.json`：移除 `overrides.langium`
- `docs/agent-guide/build-toolchain.md`：新增「mermaid：不打包 elkjs（T0878 / D299）」
- `package-lock.json`、`src/components/FileTreeMarkdown.tsx`：沒有變化
- `_ct-workorders/T0878-mermaid-stub-elk.md`：本回報

### Commit
- `2ba7f45c` build(renderer): stub out elkjs so mermaid's ELK layout is not shipped (T0878)
- 工單本身另外一個 commit。都**沒有 push**，沒有觸發任何 workflow。

### 遭遇問題
- Bash heredoc 寫入的 scratch 腳本，反斜線會被吃掉（與 T0876 相同），第一版 asar 掃描腳本因此失效。改成以 Write 寫檔，並在掃描中加正向對照（空殼訊息）確認有讀到內容。另外 `@electron/asar` 的 `extractFile` 對多數檔案失敗，改用 `extractAll`。兩者都與結論無關。
- 負向測試時暫時改 `vite.config.ts`，是用 scratch 備份以 `cp` 還原，沒有用 `git checkout`／`restore`。還原後的 diff 只剩本單的變更。

### 建議後續（給塔台）
1. `CLAUDE.md`「Build Toolchain」節不在本單的 `affects_files`，沒有改。依 T0595 的規則，可以補一行：「mermaid 的 elkjs 由 `vite.config.ts` alias 到 `src/lib/elkjs-stub.ts`，不打包（D299）；升 mermaid 必跑 `scripts/__tests__/no-elkjs-in-dist.test.mjs`」，並連到 docs。
2. 使用者如果在圖裡寫 `layout: elk`，現在看到的是 mermaid 通用的「Syntax error in text」錯誤圖，不會說明原因。要顯示較清楚的提示（例如在 `renderMermaidBlocks` 偵測 `layout: elk` 並顯示說明），可另開工單，本單沒做。

### 互動紀錄
- 無（yolo；沒有向塔台提問）。
