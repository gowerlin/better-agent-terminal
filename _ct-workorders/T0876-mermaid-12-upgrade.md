---
schema_version: 1
schema_kind: workorder
id: T0876
title: "mermaid 11 → 12 評估升級（修 katex low ×2），不破壞才升"
type: implementation
status: DONE
created_at: "2026-11-17T10:27:04+0800"
started_at: "2026-11-17T10:46:17+08:00"
updated_at: "2026-11-17T10:57:11+08:00"
completed_at: "2026-11-17T10:57:11+08:00"
session_ids:
  - "cd4b1cd8-fd30-441e-b6aa-0f0683e93ed4"
repo: better-agent-terminal
priority: P3
sizing: M
depends_on: [T0875]
related:
  - "D298（T0873〈建議後續〉3）；D297；T0873〈npm audit 剩餘項目〉"
affects_files:
  - _ct-workorders/T0876-mermaid-12-upgrade.md
  - package.json
  - package-lock.json
  - src/components/FileTreeMarkdown.tsx（只限 mermaid 12 需要的 API 調整）
  - src/**/__tests__/**（只限相關測試）
  - e2e/**（只限新增 mermaid 渲染驗證時）
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 不破壞才升：任何關卡比 T0873 最終差、或 mermaid 圖在 BAT 內的渲染結果變差（圖不出來、錯誤、主題顏色不對、深淺色切換失效），就退回並寫明原因。"
  - "🔴 只升 `mermaid`（與它自己帶的依賴）；不動其他套件版本。既有 `overrides`（`lodash-es`、`langium` 等是為 mermaid 依賴加的）升級後逐一確認是否仍需要、是否與 mermaid 12 衝突；要改 `overrides` 先寫在回報區說明理由。"
  - "🔴 renderer 的 bundle 大小：記錄升級前後 `dist` 中 mermaid 相關 chunk 的大小；明顯變大（> 20%）寫在回報區由塔台判斷。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0876 — mermaid 11 → 12 評估升級

## 元資料
- **工單編號**：T0876｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-17 10:27 (UTC+8)
- **規模**：M｜**依賴**：T0875（同一個 checkout，依序執行）｜**決策**：D298

## 背景
T0873 後 `npm audit` 剩的 2 項 low 是 `katex`（GHSA-238p-pmpm-9mq7）經 `mermaid`，要升 mermaid 12（major）才修。目前 `mermaid` `^11.14.0`（T0873 後裝 11.17.2），npm 最新 12.3.0。BAT 只在 `src/components/FileTreeMarkdown.tsx` 動態 `import('mermaid')`（約 L55–59，檔案樹的 Markdown 預覽）。

## 任務
1. 讀 mermaid 12 的 release notes／migration（官方 repo），列出與 BAT 用法相關的破壞性變更（`initialize` 選項、`render` 回傳、主題、安全等級、ESM 匯出、瀏覽器支援）。
2. 升級並做必要調整。
3. 渲染驗證：用 BAT 實際的預覽路徑（或與它相同的設定）渲染幾種常見圖（flowchart、sequence、class、state、gantt、含中文字的圖、有語法錯誤的圖）於深淺色，比較升級前後；方式不限（既有測試、e2e、或 scratch 腳本＋截圖），回報區寫方式與結論，截圖不 commit。
4. `npm audit`：確認 katex 那 2 項消失、沒有新增項目。

## 關卡
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit`、`npm run test:legacy`（與 T0873 最終比較）
- `npx vite build`（記錄 mermaid chunk 大小）
- `npm ci` 在最終 lock 上 exit 0，install-scripts 警告與前一張相同

## 驗收條件
- [ ] 破壞性變更清單與對 BAT 的影響判斷
- [ ] 結論：升（版本、改了什麼、渲染比較結果）或不升（理由）
- [ ] 關卡不比 T0873 最終差；`npm audit` 前後
- [ ] commit 只含本單範圍，不 push

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **結果**：DONE。結論是**升級**：`mermaid` `^11.14.0`（安裝 11.17.2）→ `^12.3.0`（安裝 12.3.0）。`initialize` 加 `layout: 'dagre'`、`look: 'classic'`，維持 11 的外觀。`npm audit` 從 8 項降到 6 項，katex low ×2 已消失，沒有新增項目。關卡結果與 T0873 最終相同。
- 🔴 **兩件事交給塔台判斷**（見〈bundle 大小〉與〈elkjs 授權〉）：
  1. mermaid 專屬 chunk 變大 **+53.5%**。主因是新增的 ELK chunk（1.51 MB），而它是 lazy chunk，BAT 的設定下不會被載入。
  2. 新增依賴 `elkjs` 的授權是 `EPL-2.0 OR GPL-3.0-or-later`，會打包進 renderer。
- **session_id**：cd4b1cd8-fd30-441e-b6aa-0f0683e93ed4
- **開始／完成**：2026-11-17 10:46 → 10:57（UTC+8）

### 落點檢查
- **PASS**。
  - C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。
  - C-1：工單在 REPO_ROOT 下。
  - C-3：`package.json`、`package-lock.json`、`src/components/FileTreeMarkdown.tsx` 都存在。
  - C-2：工單沒有 `branch` 欄位，目前在 `main`。
- `CT_HOME` 未設，不在 worktree。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只作紀錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### mermaid 12 破壞性變更與對 BAT 的影響
資料來源：官方 GitHub release `mermaid@12.0.0`、`12.1.0`、`12.2.0`、`12.3.0`（`gh api repos/mermaid-js/mermaid/releases/tags/…`），以及 12.3.0 的 `package.json`。

BAT 的用法只有一處：`src/components/FileTreeMarkdown.tsx` `getMermaid()`。它動態 `import('mermaid')`，以 `.default.initialize({ startOnLoad: false, theme: 'dark', themeVariables: {…} })` 初始化，再以 `mermaid.run({ nodes })` 渲染；失敗時，沒有 svg 的 div 加上 `.mermaid-error`。

| 變更 | 對 BAT 的影響 | 處置 |
|---|---|---|
| 預設 layout 從 dagre 改成 **ELK**（ELK 改為內建、自動註冊、以獨立 chunk lazy 載入） | flowchart／class／state／ER 等圖會重新排版（直角連線、位置不同；實測截圖見下） | `initialize` 加 `layout: 'dagre'` |
| 預設 look／theme 改成 `neo`／`redux-color`（flowchart、class、state、ER、sequence 等） | BAT 本來就明確設 `theme: 'dark'`，實測顏色值沒變（`initialize()` 的優先序高於圖種預設）。`look` 沒設，所以會變成 `neo`：節點有陰影、邊框改漸層（`stroke: url(#…-gradient)`） | `initialize` 加 `look: 'classic'` |
| 移除 flowchart／class／state 的 `defaultRenderer` | BAT 沒用到 | 無 |
| 移除 layout 內部 export（`createCommonLayoutRenderer` 等） | BAT 沒用到 | 無 |
| 改成 ES2024、Safari 17.4+、Node 22.12+ | Electron 45（Chromium 156）沒問題。打包用的 Node 是本機 v26、CI 是 Node 24 | 無 |
| `mermaid.run`／`render`／`initialize` 的 API、`securityLevel` | release notes 沒有提到變更。實測 `run({ nodes })` 行為相同；語法錯誤時一樣產生 error svg（`aria-roledescription="error"`），所以不會套上 `.mermaid-error`（11 也是如此） | 無 |
| ESM 匯出 | `exports["."]` 仍指向 `dist/mermaid.core.mjs`，default export 不變。release notes 說 `dist/mermaid.esm.min.mjs` 會被 Vite 拒絕，但 BAT 匯入的是套件名稱（core build），不受影響。vite build exit 0 | 無 |
| 12.1.0：錯誤圖顯示實際的解析錯誤訊息 | 語法錯誤的圖除了「Syntax error in text」，還會多列出解析錯誤內容。圖變高了，但資訊更多 | 接受（屬改善） |
| 12.3.0：移除 `uuid` 依賴 | BAT 自己的 `uuid` 14.0.3 不受影響（lock 版本不變） | 無 |

- 🔴 **深淺色**：BAT 沒有淺色模式。`initialize` 寫死 `theme: 'dark'`，`src` 也找不到 `data-theme`／`prefers-color-scheme` 的切換。所以「深淺色切換失效」這項不適用。另外加做一組淺色實測（只是資訊：把 theme 換成 `default`、白底），用來確認 mermaid 12 的主題處理沒有變。

### 渲染比較
- **方式**（scratch，沒有 commit）：
  - 用 esbuild 打包一個入口，直接 import BAT 的 `src/components/FileTreeMarkdown.tsx`（`MarkdownPreview`，也就是實際的 marked → DOMPurify → `mermaid.run` 路徑）與 `src/styles/file-browser.css`。`mermaid` 依變體導到不同版本。
  - 以 repo 的 Electron 45 開視窗渲染一份 Markdown，內含 7 張圖：flowchart（含 subgraph、迴圈）、sequence（含中文訊息、Note）、class、state、gantt、全中文的 flowchart、語法錯誤的圖。
  - 每張圖都擷取：是否有 svg、`.mermaid-error`、`aria-roledescription`、viewBox，以及節點 fill／stroke、連線 stroke、文字顏色的 computed style；同時存逐圖與整頁截圖。
- **變體**：
  - A：11.17.2＋原設定（基準）
  - B：12.3.0＋原設定（不改程式）
  - C：12.3.0＋新設定（最終）
  - A′：11.17.2＋新設定（確認新設定在 11 上不改變任何結果）
  - C 與 A′ 另外各跑一次淺色。

| 圖 | A 11（基準） | B 12＋原設定 | C 12＋新設定（最終） |
|---|---|---|---|
| flowchart | svg 366×507 | svg 408×614，ELK 直角線、`neo`（陰影、漸層邊框） | svg 481×580，dagre 曲線、classic；顏色與 A 相同 |
| sequence | svg 450×324 | 450×378，`neo` 陰影 | 450×324，與 A 相同 |
| class | svg 380×324 | 319×414，ELK 排版改變 | 380×324，與 A 相同 |
| state | svg 202×364 | 328×324，ELK | 338×364，排版與 A 相同，只是節點變寬 |
| gantt | svg 868×172 | 相同 | 相同 |
| 中文 flowchart | svg 688×150 | 878×190 | 912×190，排版與 A 相同，節點變寬；中文字正常 |
| 語法錯誤 | error svg（炸彈＋「Syntax error in text」＋版本） | error svg，多了解析錯誤內容 | 同 B |

- **顏色**：A、A′、C 的節點 fill／stroke、連線 stroke、文字顏色，**深色 7 張完全相同**。例如 flowchart 為 fill `rgb(31,32,32)`、stroke `rgb(204,204,204)`、連線 `rgb(102,102,102)`。淺色的 A′ 與 C 也完全相同（`default` theme，fill `rgb(236,236,255)`、stroke `rgb(147,112,219)`）。B 的節點 stroke 變成漸層。
- **尺寸差異**：C 的 flowchart、state、中文 flowchart 比 A 寬，原因是 mermaid 12 的節點尺寸計算有變，例如菱形不再依 `wrappingWidth` 換行、circle 改依標籤計算尺寸。排版方向、連線方式（dagre 曲線）、樣式都與 A 相同，圖沒有變差。顯示時 CSS `.mermaid svg { max-width: 100% }` 會縮放，不會超出預覽寬度。
- 7 張圖在三個變體都有 svg，渲染期間 console 都沒有 error。
- **結論**：沒有圖不出來、沒有錯誤、主題顏色沒有改變，只有 classic 下節點略寬。B（不改程式）的外觀變化較大，所以採用 C。

### bundle 大小（`npx vite build`，`dist/assets`）
- **計算方式**：scratch 腳本解析 chunk 之間的 `import`。「mermaid 專屬」= 從 `mermaid.core-*.js` 可達、但 app 入口 `index-*.js` 不經 mermaid.core 就到不了的 chunk。

| 項目 | 升級前（11.17.2） | 升級後（12.3.0） | 變化 |
|---|---|---|---|
| `mermaid.core-*.js` | 653,662 | 660,824 | +1.1% |
| mermaid 專屬 chunk（個數／bytes） | 60／3,387,710 | 61／5,199,072 | **+53.5%** |
| 　其中 `elk-*.js`（新） | — | 1,513,070 | 新增 |
| 　扣掉 elk 之後 | 3,387,710 | 3,686,002 | +8.8% |
| `katex-*.js` | 261,313 | 261,719 | ≈ |
| `dist/assets` 全部 JS | 5,462,536 | 7,274,042 | +1,811,506 |

- 🔴 **超過 20%，交塔台判斷**。
- 主因是 ELK。`mermaid.core` 只透過 `registerLayoutLoaders` 的 loader 以 `import("./elk-….js")` 動態載入它；BAT 設了 `layout: 'dagre'`，只有作者在圖裡寫 `layout: elk`（front matter）或 `flowchart-elk` 時才會載入。所以**執行時的載入量不變**，增加的只是 `dist`（打進 `app.asar`）與安裝檔的大小（未壓縮約 +1.8 MB）。
- 附帶的變化：使用者的圖現在可以用 `layout: elk`，11 做不到。
- 如果塔台不要這 1.5 MB，可行方向（**需另開工單，本單沒做**）：
  - 在 `vite.config.ts` 以 alias 或 plugin 把 ELK loader 換成 stub。這會讓 `layout: elk` 退回 dagre（mermaid 對無法使用的 layout 會 fallback 並 warn）。
  - 改用 `@mermaid-js/tiny`，但它還會少 mindmap 的 cose-bilkent 等，範圍較大。

### elkjs 授權（交塔台判斷）
- 新增依賴 `elkjs` 0.12.1，`license` = `EPL-2.0 OR GPL-3.0-or-later`（12.3.0 release notes：從 0.9.3 升到 0.12.0，就是為了讓 GPL-3.0 專案可以使用）。它會被 vite 打包成 `dist/assets/elk-*.js`，隨安裝檔散布。
- BAT 是 MIT。EPL-2.0 屬檔案層級的弱 copyleft，散布時通常要保留授權聲明，並能提供 EPL 部分的原始碼（上游公開）。本單不做法律判斷，請塔台決定是否需要在第三方授權聲明中補上 elkjs，或改用上面的 stub 方案不打包它。
- 對照：mermaid 11.17.2 沒有 elkjs 依賴。

### overrides 檢查（沒有修改）
- `lodash-es` `>=4.18.1`：**仍然需要**。mermaid 12.3.0 → `dagre-d3-es@7.0.14` → `lodash-es` `^4.17.21`，lock 為 4.18.1。override 確保不會落到有漏洞的版本，與 mermaid 12 不衝突。
- `langium` `>=4.2.2`：目前 lock 裡**沒有任何套件依賴 langium**。升級前也沒有：`@mermaid-js/parser` 1.2.1 只依賴 `@chevrotain/types`；2.0.1 依賴 `@chevrotain/types` `~13.2.0`。這個 override 目前沒有作用，也不衝突。本單**沒有刪除**，要不要清掉由塔台決定。
- `minimatch@3`、`minimatch@5`、`hono`、`@hono/node-server`：與 mermaid 無關，沒有動。

### lock 變化（只有 mermaid 的依賴樹）
- `mermaid` 11.17.2 → 12.3.0
- `@mermaid-js/parser` 1.2.1 → 2.0.1
- `@chevrotain/types` 11.1.2 → 13.2.0
- 新增：`chevrotain`、`@chevrotain/cst-dts-gen`、`@chevrotain/gast`、`@chevrotain/regexp-to-ast`、`@chevrotain/utils`（13.2.0），以及 `elkjs` 0.12.1
- `katex` 0.16.47 → 0.18.10。`katex/node_modules/commander` 8.3.0 → 15.1.0（只給 katex CLI 用，不會打包）
- 移除：`fastdom` 1.0.12、`strictdom` 1.0.1
- 其他套件版本都沒變（以 lock 前後比對 `packages` 的每個 version 確認）

### npm audit 前後
| 嚴重度 | 前（T0875 後） | 後 |
|---|---|---|
| critical | 0 | 0 |
| high | 0 | 0 |
| moderate | 6 | 6 |
| low | 2 | **0** |
| 合計 | 8 | **6** |

- 消失的是 `katex`（GHSA-238p-pmpm-9mq7，修正版 0.18.2；現在裝的是 0.18.10）與 `mermaid`。
- 剩下的 6 項就是 T0875 列為已接受例外的 minimatch／electron-builder 工具鏈，**沒有新增**。

### 關卡結果
| 關卡 | 結果 | 與 T0873 最終比較 |
|---|---|---|
| `npm ci`（最終 lock） | exit 0，added 749 packages。install-scripts 警告只有 `electron-winstaller@5.4.0 (install: node ./script/select-7z-arch.js)`；另有一行使用者層 `.npmrc` 的 `allow-scripts setting is being ignored`（與 T0873／T0875 相同） | 警告相同；套件數 745 → 749 = lock 的 +6／−2 |
| `npx vite build` | exit 0 | 相同 |
| `npm run typecheck` | exit 0 | 相同 |
| `npm run typecheck:electron` | exit 0 | 相同 |
| `test:unit`（vitest json reporter） | 第一次：8396 個，8300 passed / 1 failed / 95 skipped，10 個 suite 標 failed。全部是並行負載下的逾時：`headless-*` 4 檔的 `Hook timed out in 10000ms`、`local-helper-capability`、`tower-questions`，以及 `helper-connection-hygiene` 的「a channel with a newline…」。這和 T0873 基準、T0875 第一次記錄的 flaky 是同一組。這些檔案加上 `terminal-query-handlers` 共 8 檔單獨重跑：176/176 passed。第二次全量：**8354 passed / 0 failed / 42 skipped** | 與 T0873 最終完全相同 |
| `npm run test:legacy` | 33 檔／472 tests 全過 | 相同 |

- `asar-runtime-deps.test.mjs` 包含在 `test:unit` 裡，在 vite build 之後執行，通過。mermaid 是由 vite 打包進 `dist/` 的 renderer 函式庫，不會進 asar 的 node_modules 白名單，所以白名單不用改。
- 沒有跑 `build:dir`／`verify-packaged-native`：本單只改 renderer 依賴，工單關卡沒有要求。
- 測試時 `BAT_HELPER_LOG_DIR`／`BAT_USER_DATA` 指到暫存目錄。

### 環境
- Node v26.13.1、npm 12.2.2、Windows x64、Electron 45.2.1（渲染比較用 repo 的 `node_modules/electron`）。
- mermaid 11.17.2 與 12.3.0 用 `npm install --ignore-scripts` 裝在 scratch 目錄，給渲染比較用。截圖與比對腳本都在 scratch，**沒有 commit**。

### 變更檔案
- `package.json`：`mermaid` `^11.14.0` → `^12.3.0`
- `package-lock.json`
- `src/components/FileTreeMarkdown.tsx`：`initialize` 加 `layout: 'dagre'`、`look: 'classic'`（含一行註解）
- `_ct-workorders/T0876-mermaid-12-upgrade.md`：本回報
- 沒有新增測試：既有測試沒有涵蓋 mermaid 渲染，本單以 scratch 渲染比較驗證。

### Commit
- `fffae310` chore(deps): mermaid 12.3.0, keep dagre layout and classic look (T0876)
- 工單本身另外一個 commit。都**沒有 push**，沒有觸發任何 workflow。

### 遭遇問題
- Bash 的 `node -e` 會把字串裡的反斜線吃掉（與 T0875 相同），統計腳本改成寫檔執行。寫回報時，Bash heredoc 也解析失敗（沒有寫入任何內容），改用 Edit。兩者都與結論無關。

### 建議後續（給塔台）
1. 決定是否接受 mermaid 專屬 chunk +53.5%（主要是 lazy 的 ELK chunk 1.51 MB，執行時不載入）。不接受的話，另開工單在 vite 把 ELK loader 換成 stub，並確認安裝檔大小。
2. 決定 `elkjs`（`EPL-2.0 OR GPL-3.0-or-later`）是否需要補第三方授權聲明，或與 1 一起以不打包 ELK 的方式處理。
3. 可順手清掉 `overrides.langium`（lock 已經沒有 langium，這個 override 沒有作用）。

### 互動紀錄
- 無（yolo；沒有向塔台提問）。
