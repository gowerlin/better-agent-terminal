---
schema_version: 1
schema_kind: workorder
id: T0879
title: "Markdown 預覽：mermaid 圖指定 ELK 排版時改用預設排版並顯示說明"
type: implementation
status: DONE
created_at: "2026-11-17T11:52:57+0800"
started_at: "2026-11-17T11:53:41+0800"
updated_at: "2026-11-17T12:08:00+0800"
completed_at: "2026-11-17T12:08:00+0800"
session_ids:
  - "93f1673c-c6e8-4d20-a5f6-8c1c375adf81"
repo: better-agent-terminal
priority: P3
sizing: S
depends_on: [T0878]
related:
  - "D300；D299；T0878 回報區〈渲染驗證〉〈建議後續〉2"
affects_files:
  - _ct-workorders/T0879-mermaid-elk-layout-fallback.md
  - src/components/FileTreeMarkdown.tsx
  - src/lib/**（新增的純函式）
  - src/**/__tests__/**
  - src/styles/file-browser.css（只限說明文字的樣式）
  - src/locales/** 或專案實際的 i18n 字串檔（只限新增字串）
  - docs/agent-guide/build-toolchain.md（只限 T0878 那一段補一句）
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 行為（D300，不得自行改變）：渲染前偵測圖指定 ELK 排版（front matter `config.layout` 或 `layout`、`%%{init: …}%%` 指令中的 `layout`，值為 `elk` 或 `elk.*`），改成 `dagre` 後交給 mermaid 渲染；在該圖旁顯示一行說明（BAT 不內建 ELK 排版，已改用預設排版）。只改傳給 mermaid 的文字，**不改使用者的檔案**、不改編輯器內容。"
  - "🔴 不得影響其他圖：沒有指定 ELK 的圖，傳給 mermaid 的文字與渲染結果和 T0878 完全相同；`flowchart-elk` 不處理（BAT 的 dagre 設定下本來就正常，T0878 實測）。偵測要保守：只認 mermaid 文件定義的寫法，認不出就照原文渲染（等同 T0878 行為），不得把正常的圖改壞。"
  - "🔴 偵測與改寫寫成純函式（不 import DOM／mermaid），單元測試涵蓋各種寫法與不該改的情況。說明文字走專案既有的 i18n（所有語系都要有字串）；Markdown 預覽的 HTML 一律照既有的 DOMPurify 路徑，新增的 DOM 用 `textContent`，不得用 `innerHTML` 塞字串。"
  - "🔴 不改 `vite.config.ts` 的 elkjs alias 與 `src/lib/elkjs-stub.ts`（T0878）；不改 mermaid 版本與 `initialize` 設定。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0879 — mermaid 圖指定 ELK 排版時改用預設排版並顯示說明

## 元資料
- **工單編號**：T0879｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-17 11:52 (UTC+8)
- **規模**：S｜**依賴**：T0878｜**決策**：D300

## 背景
T0878 把 `elkjs` 換成空殼（D299）。Markdown 預覽（`src/components/FileTreeMarkdown.tsx`，`renderMermaidBlocks` 約 L78）中，圖若寫 `layout: elk`，現在會顯示 mermaid 通用的錯誤圖（炸彈＋「Syntax error in text」），使用者看不出是 BAT 沒有打包 ELK。D300 決定：改用 dagre 照常畫出來，並顯示一行說明。

## 任務
1. 讀 mermaid 12.3.0 文件／原始碼，列出指定 layout 的所有寫法（front matter `config: layout:`、front matter 頂層 `layout:`、`%%{init: {"layout": …}}%%`／`%%{initialize: …}%%`，以及 `elk.*` 變體名稱），附來源。
2. 新增純函式（例 `src/lib/mermaid-elk-fallback.ts`）：輸入圖的文字，回傳 `{ text, usedElk }`，只在認得的寫法中把 ELK 換成 `dagre`；其他內容逐字不變。
3. `renderMermaidBlocks` 在渲染前呼叫它；`usedElk` 為真時在該圖的容器旁加一行說明（i18n，`textContent`），樣式沿用預覽的次要文字樣式。
4. 單元測試：各種寫法都換成 dagre、說明旗標正確；沒指定 layout、`layout: dagre`、`flowchart-elk`、字串裡碰巧出現 `elk`（例如節點文字、註解）都不改；CRLF、縮排、引號變化。
5. 渲染驗證（沿用 T0878 的 scratch 方式）：T0878 的 10 張圖中，`layout: elk` 那張改成正常的 dagre 圖＋說明，其他 9 張與 T0878 結果相同；console 沒有新的 error。
6. `docs/agent-guide/build-toolchain.md` T0878 那段補一句：圖指定 ELK 時改用 dagre 並顯示說明（T0879）。

## 關卡
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit`、`npm run test:legacy`（與 T0878 後比較）
- `npx vite build`；`scripts/__tests__/no-elkjs-in-dist.test.mjs` 仍通過

## 驗收條件
- [x] layout 寫法清單（附來源）
- [x] 純函式＋單元測試（含不該改的情況）
- [x] 渲染驗證：ELK 圖正常顯示＋說明，其他圖與 T0878 相同
- [x] i18n 字串所有語系齊全
- [x] 關卡不比 T0878 後差
- [x] commit 只含本單範圍，不 push

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **狀態**：DONE
- **開始**：2026-11-17T11:53:41+0800｜**完成**：2026-11-17T12:06:04+0800
- **session_id**：93f1673c-c6e8-4d20-a5f6-8c1c375adf81
- 摘要：Markdown 預覽在渲染前以純函式 `applyMermaidElkFallback`（`src/lib/mermaid-elk-fallback.ts`）把 ELK 排版改成 `dagre`，並在該圖下方加一行說明。`layout: elk` 的圖從 mermaid 錯誤圖變成正常的 dagre 圖，SVG 與同一張圖不寫 layout 時逐字相同；其他圖與 T0878 相同。關卡都不比 T0878 後差。

### 落點檢查
- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，PASS
- C-1：工單在 REPO_ROOT 底下，PASS
- C-3：`src/components/FileTreeMarkdown.tsx`、`src/styles/file-browser.css`、`docs/agent-guide/build-toolchain.md` 都存在（`src/lib/**` 等萬用字元項目不檢查），PASS
- C-2：工單沒有 `branch` 欄位，不適用（目前在 `main`）
- `CT_HOME` 沒有設定（不是 worktree 派工）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄，不比對）

### layout 寫法清單（mermaid 12.3.0，來源為 `node_modules/mermaid/dist` 原始碼）
mermaid 文件站沒有隨套件散布，以下以已安裝的 12.3.0 程式碼為準（路徑相對於 `node_modules/mermaid/dist/`）。

| 寫法 | mermaid 會不會用 | 來源 | 本單 |
|---|---|---|---|
| front matter `config:` 底下的 `layout:` | 會 | `mermaid.core.mjs:983-1012` `extractFrontMatter`（YAML `JSON_SCHEMA`，只取 `displayMode`、`title`、`config`）→ `:1026` `processFrontmatter` → `:1052` `cleanAndMerge(frontMatter.config, directive)` | 改寫 |
| `%%{init: {...}}%%`、`%%{initialize: {...}}%%` 的頂層 `layout` | 會，而且蓋過 front matter；多個時後面的蓋過前面的 | `chunks/mermaid.core/chunk-6MUBBAK2.mjs:65-88` `detectInit`（type 比對 init／initialize）、`:89-122` `detectDirective`（整段文字的單引號換成雙引號後 `JSON.parse`；任一個解析失敗就整組不用）；樣式 `chunk-BG4553SI.mjs:11` `directiveRegex`；`mermaid.core.mjs:1037-1050` `processDirectives` 只看 front matter 之後的文字 | 改寫 |
| directive 裡的 `"config": {"layout": …}` | 不是頂層 layout（`detectInit` 把 `config` 搬到圖的類型底下，例 `flowchart.layout`） | `chunk-6MUBBAK2.mjs:78-85` | 不改 |
| front matter **頂層** `layout:` | **不會**：`extractFrontMatter` 只留 `displayMode`、`title`、`config`，其他鍵丟掉，圖本來就用 dagre | `mermaid.core.mjs:999-1008` | 不改（見〈與工單文字的差異〉） |
| `flowchart-elk` | detector 設 `config.layout = "elk"`，但在 BAT 的 `initialize` 設定下照常以 dagre 畫（T0878 實測） | `mermaid.core.mjs:420-428` | 不改（工單要求） |
| layout 的值 | 由 `getConfig().layout` 決定，`getRegisteredLayoutAlgorithm` 只認已註冊的名稱：`elk`（= `elk.layered`）、`elk.stress`、`elk.force`、`elk.mrtree`、`elk.sporeOverlap`、`elk.box`、`elk.rectpacking`；不認得的名稱以 dagre 退回並記警告 | `chunk-CFHHFPVC.mjs:49-57` `ELK_ALGORITHMS`、`:66-72` `elkLayoutLoaders`、`:116-129`；各圖的 renderer 例 `chunk-QB3YPZ4I.mjs:1213-1221` | 值為 `elk` 或 `elk.<名稱>` 時視為 ELK（D300） |
| front matter 的界線 | 第一行（`trim` 之後）是 `---`，之後第一個 `---` 行是結尾，結尾後要有換行；CRLF 先換成 `\n` | `chunk-BG4553SI.mjs:46-90` `matchFrontMatter`、`mermaid.core.mjs:1017-1022` `cleanupText` | 照這個規則找 |

- 12.3.0 沒有 `flowchart.defaultRenderer`（整個 dist 搜尋不到），不必處理。

### 純函式與接線
- `src/lib/mermaid-elk-fallback.ts`（不 import DOM／mermaid）：`applyMermaidElkFallback(text) → { text, usedElk }`、`isElkLayout(value)`。
  - 照 mermaid 的優先順序算出實際生效的 layout（directive > front matter，後面的 directive > 前面的）。生效值是 ELK 時，把每個 ELK 值（front matter 與各 directive）換成 `dagre`；生效值不是 ELK 就不改任何字（例如 front matter 寫 elk、directive 寫 dagre）。
  - front matter 只認 block mapping（`config:` 後面沒有值、子鍵縮排一致、用空白縮排）；flow 寫法（`config: {layout: elk}`）、tab 縮排、重複鍵、YAML tag／anchor、跳脫字元、縮排的 front matter → 照原文。directive 用與 mermaid 相同的 regex，只認 `init`／`initialize`，JSON 以 mermaid 的方式解析；解析不了、值的位置找不到 → 照原文。
  - 換完之後再分析一次，必須讀成 `dagre` 而且沒有 ELK，否則回傳原文（安全網）。只換值的字元，其他內容（引號、空白、註解、換行）逐字不變。
- `src/components/FileTreeMarkdown.tsx`：marked 的 `renderer.code` 在 `lang === 'mermaid'` 時呼叫它。`usedElk` 為真才輸出 `<div class="mermaid" data-mermaid-elk-fallback="true">`＋改寫後的文字；否則是原本那一行（輸出逐字相同）。`data-*` 屬性 DOMPurify 預設放行（`ALLOW_DATA_ATTR`），sanitize 設定沒改。`renderMermaidBlocks` 在 `mermaid.run` 之前，對有標記的 div 後面插入 `<p class="mermaid-elk-note">`（`document.createElement`＋`textContent`，沒有用 `innerHTML`）；切換語言時另一個 effect 只更新說明文字，不重跑 mermaid。
- i18n：`sidebar.mermaidElkFallback`（en／zh-TW／zh-CN 三個語系都有）。
- 樣式：`src/styles/file-browser.css` `.file-preview-markdown .mermaid-elk-note`（`var(--text-secondary)`、12px、置中）。
- 沒有改 `vite.config.ts` 的 alias、`src/lib/elkjs-stub.ts`、mermaid 版本與 `initialize` 設定。不改使用者的檔案與編輯器內容。

### 單元測試
- `src/lib/__tests__/mermaid-elk-fallback.test.ts`（25 項）：
  - 會改：front matter（純值、雙引號、單引號、尾端註解、4 空白縮排、其他鍵、`elk.*`、CRLF、單獨的 CR、前面有空行、fence 後有空白／tab、front matter 內的註解）、`init`、`initialize`、單引號 JSON、多行 directive＋CRLF、front matter 之後的 directive、優先順序（directive 蓋 front matter、後面的 directive 蓋前面的、沒有 layout 的 directive 不蓋）。
  - 不改：沒有 layout、`layout: dagre`、`ELK`／`elkish`、`config.flowchart.layout`、頂層 `layout:`、flow 寫法、重複鍵、tab、`!!str`、anchor、跳脫字元、縮排的 front matter、沒有結尾、結尾在最後一行、圖後面才出現的 `---`、directive 裡的巢狀 layout 與 `config` 鍵、其他 directive 類型（`wrap`、`config`、`Init`、`reinit`）、JSON 錯誤（含「一個錯整組不用」）、`flowchart-elk`、節點文字與 `%%` 註解裡的 `layout: elk`。
  - i18n：三個語系都有字串。
- `src/components/__tests__/file-tree-markdown-elk.test.tsx`（3 項，mermaid 以 mock 代替，marked → DOMPurify 是真的）：ELK 圖拿到 `layout: dagre` 的文字、div 有標記、說明在該圖之後且只有文字；沒有 ELK 的圖 HTML 與原本相同、沒有說明；切換語言後說明更新且不重複。

### 渲染驗證
- **方式**（scratch，沒有 commit）：沿用 T0878 的做法，以 vite build API（repo 的 vite＋`@vitejs/plugin-react`，加上與 `vite.config.ts` 相同的 elkjs alias）打包 scratch 入口，入口 import `MarkdownPreview`、`src/i18n.ts`、`src/styles/file-browser.css`，用 repo 的 Electron 45.2.1 開視窗渲染。兩個變體：**T0878** = `git show HEAD:src/components/FileTreeMarkdown.tsx`（本單之前），**T0879** = 本單。
- 13 張圖：T0878 的 10 張（flowchart 子圖＋迴圈、sequence 中文＋Note、class、state、gantt、中文 flowchart、語法錯誤、`layout: elk` front matter、`flowchart-elk`、之後的普通 flowchart），另加 3 張：`%%{init: {"layout": "elk.force"}}%%`、front matter 頂層 `layout: elk`、同一張 flowchart 不寫 layout（參考圖）。
- **結果**（比較 SVG markup 時把 mermaid 的 id `mermaid-<數字>` 換成固定字串）：

| 圖 | T0878 | T0879 |
|---|---|---|
| 9 張非 ELK 的圖（含語法錯誤、`flowchart-elk`、ELK 之後的普通圖） | 都有 svg | role、viewBox、節點數與 T0878 相同；SVG **逐字相同**，只有 class 圖的邊框控制點不同（遮掉小數後相同，T0878 已記錄這是每次渲染都隨機）。都沒有說明 |
| `layout: elk`（front matter） | 錯誤圖（「Syntax error in text」，viewBox `0 0 2412 512`） | `flowchart-v2`，viewBox `0 0 690.42… 190`，SVG 與參考圖**逐字相同**；下方說明「這張圖指定 ELK 排版，BAT 沒有內建 ELK，已改用預設排版顯示。」 |
| `%%{init: {"layout": "elk.force"}}%%` | 錯誤圖 | 同上，與參考圖逐字相同＋說明 |
| front matter 頂層 `layout: elk` | `flowchart-v2`，與參考圖逐字相同 | 相同，沒有說明（證明 mermaid 本來就不理它） |

- 說明元素沒有子元素（只有文字）、字級 12px。英文介面另跑一次：說明是英文字串，共 2 個。顏色在 scratch 頁是繼承的 `rgb(224, 224, 224)`，因為 scratch 頁沒有 BAT 的主題變數；BAT 內是 `var(--text-secondary)`。
- page `error`／`unhandledrejection` 兩個變體都是 0；console 兩邊都只有 i18next 的 info 訊息（另有 Electron 的 CSP 安全警告，scratch 頁沒有 CSP），**沒有新的 error**。
- 截圖（scratch）：T0878 的那張是炸彈錯誤圖；T0879 是 Start／Check／Done 的 dagre 圖，下方一行說明。

### i18n
| key | en | zh-TW | zh-CN |
|---|---|---|---|
| `sidebar.mermaidElkFallback` | This diagram asks for the ELK layout, which BAT does not include. It is shown with the default layout. | 這張圖指定 ELK 排版，BAT 沒有內建 ELK，已改用預設排版顯示。 | 这张图指定了 ELK 布局，BAT 没有内置 ELK，已改用默认布局显示。 |

### 關卡結果
| 關卡 | 結果 | 與 T0878 後比較 |
|---|---|---|
| `npm run typecheck` | exit 0 | 相同 |
| `npm run typecheck:electron` | exit 0 | 相同 |
| `npx vite build` | exit 0；`dist/assets` JS 75 檔 5,801,648 bytes | 5,796,971 → 5,801,648（+4,677，本單的純函式） |
| `scripts/__tests__/no-elkjs-in-dist.test.mjs`（build 後） | 4 passed | 相同 |
| `npm run test:unit`（`vitest run`，json reporter） | 8447 個：**8405 passed / 0 failed / 42 skipped**，一次跑完，沒有 flaky | T0878 後 8377 passed / 42 skipped；多的 28 個是本單的新測試 |
| `npm run test:legacy` | files 33 passed／tests 472 passed | 相同 |

- 測試時 `BAT_HELPER_LOG_DIR`／`BAT_USER_DATA` 指到暫存目錄。

### 與工單文字的差異（請塔台確認）
- 工單與 D300 列了「front matter 頂層 `layout`」。mermaid 12.3.0 的 `extractFrontMatter` 只讀 `displayMode`、`title`、`config`，頂層 `layout` 不會生效，這種圖本來就以 dagre 正常畫出（渲染驗證第 12 張：T0878 就與參考圖逐字相同）。依同一份 D300 的「偵測要保守：只認 mermaid 文件定義的寫法」「沒有指定 ELK 的圖，傳給 mermaid 的文字與渲染結果和 T0878 完全相同」，本單**不改**頂層 `layout`、也不顯示說明（改了只會多一行說明，圖不會變）。若塔台要對它也顯示說明，在 `readConfigLayout` 加一個頂層鍵的分支即可，測試裡 `does not touch a top-level layout key` 那一項要跟著改。沒有向塔台提問，是因為兩種做法圖都一樣，差別只有說明。

### 環境
- Node v26.13.1、npm 12.2.2、Windows x64、Electron 45.2.1（渲染驗證用 repo 的 `node_modules/electron`）、mermaid 12.3.0。

### 變更檔案
- `src/lib/mermaid-elk-fallback.ts`（新）
- `src/lib/__tests__/mermaid-elk-fallback.test.ts`（新）
- `src/components/FileTreeMarkdown.tsx`
- `src/components/__tests__/file-tree-markdown-elk.test.tsx`（新）
- `src/styles/file-browser.css`（只加說明的樣式；這個檔在 repo 裡本來就是 CRLF，git 的 CRLF 警告是既有的，commit 保留 CRLF，diff 只有新增的 8 行）
- `src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`（各加一個字串）
- `docs/agent-guide/build-toolchain.md`（T0878 那段補一條）
- `_ct-workorders/T0879-mermaid-elk-layout-fallback.md`：本回報

### Commit
- `7291c38b` feat(markdown): render mermaid ELK layout requests with dagre and show a note (T0879)
- 工單本身另外一個 commit。都**沒有 push**，沒有觸發任何 workflow。

### 遭遇問題
- scratch 的 vite build 腳本第一次以 Windows 絕對路徑 `import()` vite，Node 回 `ERR_UNSUPPORTED_ESM_URL_SCHEME`，改用 `pathToFileURL` 後正常。Electron 截圖第一次整頁擷取被螢幕高度限制，改成捲到該圖再擷取。都與結論無關。
- DOMPurify 設定不需要改（`data-*` 預設放行），維持原樣。

### 建議後續（給塔台）
1. 〈與工單文字的差異〉那一點請塔台確認（不需要就維持現狀）。
2. `CLAUDE.md`「Build Toolchain」節的 T0878 那行可補半句「圖指定 ELK 時改用 dagre 並顯示說明（T0879）」；不在本單的 `affects_files`，沒有改。

### 互動紀錄
- 無（yolo；沒有向塔台提問）。
