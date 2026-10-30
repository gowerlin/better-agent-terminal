---
schema_version: 1
schema_kind: workorder
id: T0713
title: "BUG-174：終端 `file:///` 連結依格子欄位算範圍（全形字）、支援跨行、OSC 8 超連結可點（GitHub #20）"
type: implementation
status: DONE
repo: better-agent-terminal
project: ""
priority: P2
sizing: M
created_at: "2026-10-30T15:06:18+0800"
started_at: "2026-10-30T15:07:35+0800"
updated_at: "2026-10-30T15:13:41+0800"
completed_at: "2026-10-30T15:13:41+0800"
depends_on: []
related:
  - "BUG-174（現象、根因、行號）"
  - "GitHub issue #20（`gh issue view 20 -R gowerlin/better-agent-terminal`，含回報者建議的字串索引 → 欄位對照寫法；🔴 只讀，不得在 issue 留言）"
  - "CLAUDE.md「Codex 分頁的滾輪回報（T0698）」節：以真 xterm 實例測試的前例（`src/lib/__tests__/terminal-wheel-reports.test.ts`）"
affects_files:
  - src/components/TerminalPanel.tsx
  - "src/lib/terminal-file-links.ts（新檔，名稱可調；範圍計算的純函式）"
  - "src/lib/__tests__/terminal-file-links.test.ts（新檔）"
  - "OSC 8 滑過顯示目標所需的樣式（只在需要時；例 src/styles/ 下既有終端樣式檔）"
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json（只在新增文字時）"
  - CLAUDE.md
  - "docs/agent-guide/terminal-links.md（新檔）、docs/agent-guide/README.md"
  - _ct-workorders/T0713-fix-bug174-terminal-file-links.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 1 全形字：範圍一律以**格子欄位**計算（走 `line.getCell(x)` 的 `getChars()` / `getWidth()` 建字串索引 → 欄位對照，寬度 0 的格子是寬字後半，跳過；或等效作法），起點與終點都要對；網址前面有全形字時起點也要正確。終點是含括的 1-based 欄位（寬字取該字的最後一格）。計算邏輯放純函式（建議 `src/lib/terminal-file-links.ts`），`TerminalPanel.tsx` 只接線。"
  - "🔴 2 跨行：被換行的長網址（後續列 `isWrapped === true`）要整段辨識成一個連結，range 可跨列（xterm `ILink.range` 的 start / end 可在不同 `y`）；從任一列查詢都要回同一個連結。往前往後串接的列數設上限（例 ≤ 20 列）避免極端長行拖慢。"
  - "🔴 3 OSC 8：在 `new Terminal({...})` 設 `linkHandler`（xterm 5.5 `ILinkHandler`，需要時 `allowNonHttpProtocols: true`），點擊只開 `http:` / `https:` / `file:`，經既有 `window.electronAPI.shell.openExternal`；其他 scheme（`javascript:`、`vbscript:`、自訂協定等）一律不開、記 debug log（`window.electronAPI.debug.log`，不記完整 URI，只記 scheme 與長度）。🔴 OSC 8 的顯示文字可以和實際目標不同：滑過時要讓使用者看得到實際目標（hover 提示，形式自定，文字超長可截斷），不得在沒有任何顯示的情況下開檔。不加確認對話框（若要加，必須用 `ModalOverlay`，見 CLAUDE.md Dialog 節；本單建議不加）。"
  - "🔴 行為不變：純文字 `file:///` 的比對規則（現行 regex 與結尾字元）、點擊即開（不需修飾鍵）、`WebLinksAddon` 的 http(s) 行為都不改。順手用測試確認 `WebLinksAddon` 的 http(s) 連結在全形字 / 跨行時是否正確，結果寫回報區；若有問題**只記錄、不修**（塔台另開單）。主行程 `shell:openExternal` handler 若已有 scheme 限制，沿用不放寬。"
  - "🔴 不改 xterm 版本、不加依賴、不碰 PTY 輸出與 `onData` 路徑（T0672 / T0698 的偵測不受影響）。遠端工作區的 `file://` 指向遠端路徑屬既有限制，不在本單範圍，docs 記一筆即可。"
  - "🔴 驗證：以真 xterm 實例（比照 `terminal-wheel-reports.test.ts`）寫入文字後測 link provider 的 range：issue 範例路徑（含 10 個全形字）、網址前有全形字、純 ASCII（與修正前結果相同）、同一行兩個連結、跨 2～3 列的長路徑（從每一列查都得到同一 range）、emoji / 組合字元不當機；OSC 8：http / https / file 會呼叫 openExternal、`javascript:` 等不會。`npm run test:unit` 全綠、`npm run typecheck` = 0、`npx vite build` 成功。"
  - "🔴 文件：CLAUDE.md 新增一節（3–12 行：用途、必守規則、唯一實作位置、連到 docs），細節寫 `docs/agent-guide/terminal-links.md` 並加進 docs 索引。README / CHANGELOG 不改（發版時塔台處理）。"
  - "🔴 Git：`git commit --only <檔案>`，只 commit 本單 `affects_files`；不 push、不觸發 workflow、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。工單完成狀態寫 `DONE`；BUG-174 與 `_bug-tracker.md` 由塔台更新。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，測試與文件路徑用 `/Users/demo`、`C:\\Users\\demo`。yolo：不得問使用者，判讀問題問塔台（每輪最多 3 題）。"
---

# T0713 — BUG-174：終端 `file:///` 連結修正（GitHub #20）

## 背景

GitHub issue #20 回報三件事，塔台已對照原始碼確認（見 BUG-174）：

1. 路徑含全形字時，`file:///` 連結的底線與可點範圍變短（字串索引被當成格子欄位）。
2. 跨行的長路徑不再是連結（只讀單一列）。
3. Claude Code 輸出的 OSC 8 超連結點了沒反應（沒有設定 `linkHandler`）。

## 驗收

- [ ] 全形字路徑整段有底線、任一處可點；網址前有全形字時起點正確；純 ASCII 結果不變
- [ ] 跨行的長路徑整段是一個連結
- [ ] OSC 8：http / https / file 可點開，其他 scheme 不開；滑過看得到實際目標
- [ ] 範圍計算在純函式，以真 xterm 實例測試
- [ ] `WebLinksAddon` http(s) 在全形字 / 跨行的表現已記錄
- [ ] CLAUDE.md 一節 + `docs/agent-guide/terminal-links.md` + docs 索引
- [ ] `npm run test:unit` 全綠；`npm run typecheck` = 0；`npx vite build` 成功

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

**DONE**：驗收 7 項全部完成。

| 驗收項 | 結果 |
|---|---|
| 全形字路徑整段有底線、任一處可點；網址前有全形字時起點正確；純 ASCII 結果不變 | ✅ 真 xterm 測試：issue 範例（10 個全形字）range = 1 … `len + 10`（舊演算法停在 `len`）；網址前有全形字起點正確；ASCII 4 組案例與舊演算法逐一相同 |
| 跨行的長路徑整段是一個連結 | ✅ 跨 3 列從每一列查得到同一 range；寬字提早換行（最後一格空著）也串得起來 |
| OSC 8：http / https / file 可點開，其他 scheme 不開；滑過看得到實際目標 | ✅ `linkHandler`（`allowNonHttpProtocols: true`）只開三種 scheme；`javascript:` / `vbscript:` / `mailto:` / `data:` / 自訂協定 / 前置空白 / 解析失敗不開，log 只記 scheme 與長度；hover tooltip 顯示目標（> 200 字元保留頭尾） |
| 範圍計算在純函式，以真 xterm 實例測試 | ✅ `src/lib/terminal-file-links.ts`；`src/lib/__tests__/terminal-file-links.test.ts` 19 項 |
| `WebLinksAddon` http(s) 在全形字 / 跨行的表現已記錄 | ✅ 見下節，兩者皆正確，未修改 |
| CLAUDE.md 一節 + `docs/agent-guide/terminal-links.md` + docs 索引 | ✅ |
| `npm run test:unit` 全綠；`npm run typecheck` = 0；`npx vite build` 成功 | ✅ 344 檔 / 6149 passed、3 skipped；typecheck exit 0；vite build exit 0 |

### 產出摘要

- **commit**：`ff772d40987b0379fde2c10e25da197121b53c58`（7 檔，+587 / −23；`git commit --only`，未 push）
- `src/lib/terminal-file-links.ts`（新）：
  - `findFileLinks(buffer, bufferLineNumber)`：逐格 `getCell(x)` 的 `getChars()` / `getWidth()` 建「code unit → (列, 格, 寬度)」對照，寬度 0 跳過、空格子當空白、寬字提早換行的空最後一格跳過；上下各串 `isWrapped` ≤ `MAX_WRAPPED_ROWS` = 20 列；只回傳碰到被查詢列的連結（xterm `_removeIntersectingLinks` 以被查詢列算佔用格，回傳別列的連結會誤刪）。regex 沿用舊的（`FILE_URL_REGEX`）。
  - `createOsc8LinkHandler` / `isAllowedOsc8Uri`（原始字串也須以 scheme 開頭，同主行程 `isAllowedExternalUrl`）/ `truncateLinkTarget` / `createLinkHoverTooltip`（`terminal.element` 內的 `xterm-hover terminal-link-hover`，`textContent` 寫入，超出終端時往上 / 往左移）。
- `src/components/TerminalPanel.tsx`：`new Terminal({ ..., linkHandler })`；`registerLinkProvider` 改為 `findFileLinks(...)` 加 `activate`（仍經 `window.electronAPI.shell.openExternal`、點擊即開）；卸載時 `linkHover.dispose()`。未碰 PTY 輸出、`onData`、WebLinksAddon。
- `src/styles/panels.css`：`.terminal-panel .terminal-link-hover` 樣式（沿用既有 CSS 變數）。
- 主行程 `shell:open-external` 未改（已有 scheme 限制：file → `openPath`，其他只放 http / https / mailto），renderer 的 OSC 8 檢查更嚴（不放 mailto）。
- 文件：CLAUDE.md 新增「終端連結：`file:///` 範圍與 OSC 8（T0713 / BUG-174）」節（6 行，放在「新 PTY 的初始尺寸」節前）；`docs/agent-guide/terminal-links.md`（原因、規則、唯一實作、WebLinksAddon 檢查、已知限制含遠端 `file://`、驗證清單）；`docs/agent-guide/README.md` 加一列。README / CHANGELOG 未改。
- 沒有新增 i18n 文字（tooltip 只顯示 URI 本身），locales 未改。
- 公開 repo：測試與文件路徑只用 `/Users/demo`、`C:/Users/demo`。

### WebLinksAddon http(s) 檢查

`@xterm/addon-web-links` 0.11.0 的 `LinkComputer` 本來就串接 `isWrapped` 續行（上限 2048 字元、遇到含空白的列停）並以 `_mapStrIdx` 逐格換算欄位（含寬字提早換行修正）。以真 xterm 實例 + Unicode 11 測試：

- 網址前（`請看 `）與網址內（`文件/說明`）有全形字：range `start.x = 6`、`end.x = 5 + len + 4`，正確。
- 跨 3 列的網址（含 15 個全形字）：從第 1 / 2 / 3 列查詢都得到同一個 range。

**結論：沒有問題，不需另開單。**測試留在 `terminal-file-links.test.ts` 的 `WebLinksAddon http(s)` 區塊當回歸。

### 互動紀錄

無（yolo，未向塔台提問）。

### Renew 歷程

無。

### 遭遇問題

- 無阻礙。設計取捨（已寫進 docs「已知限制」）：
  - 20 列上限下，從距離網址開頭超過 20 列的位置查詢時，那幾列不是連結（串到的文字沒有 `file:///`）；從前 20 列查詢時終點最多到「被查詢列 + 20」。
  - OSC 8 跨行：xterm 5.5 的 `OscLinkProvider` 逐列產生連結，每列可點、底線只畫滑鼠所在列（xterm 內部 TODO），本單不改 xterm。
- 未做實機（BAT 視窗）點擊驗證：本單驗證關卡為 unit / typecheck / build，實機步驟寫在 docs 驗證清單，供塔台或發版驗收時跑。

### 落點檢查

- **PASS**。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3 PASS（`src/components/TerminalPanel.tsx` 存在）；C-2 無 `branch` 欄位（目前 `main`）。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 回報時間

2026-10-30T15:13:15+0800
