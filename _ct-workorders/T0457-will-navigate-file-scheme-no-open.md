---
schema_version: 1
schema_kind: workorder
id: T0457
title: "will-navigate / setWindowOpenHandler 對 file: 等本機 scheme 不 shell.openExternal（只 preventDefault）——避免導航到本機 .bat / .exe 時經 ShellExecute 執行"
type: fix
status: IN_PROGRESS
repo: better-agent-terminal
project: BUG-105
priority: P1
sizing: XS
created_at: "2026-10-05T07:28:38+08:00"
started_at: "2026-10-05T07:35:40+08:00"
updated_at: "2026-10-05T07:35:40+08:00"
completed_at: null
target_version: next
depends_on:
  - T0439
related:
  - "T0439（`ea35f19`）回報區「殘留風險」/ 遭遇問題 4：`electron/main.ts` 約 :1006-1012 `will-navigate` 對任何非 app URL 一律 `shell.openExternal(url)`，含 `file://`；Windows 正式版 `appUrl` 為反斜線形式，`file:///C:/…` 永不 startsWith"
  - "D134 追加（塔台 07:28 依授權直接決定）"
affects_files:
  - electron/main.ts
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先盤點**所有會 `shell.openExternal` 的導航 / 新視窗入口（`will-navigate`、`setWindowOpenHandler`、`will-redirect`、其他 `openExternal` 呼叫端），列出各自接受的 URL 來源。"
  - "🔴 規則：只有 `http:` / `https:`（以及專案既有明確需要的 `mailto:` 等，回報區列出依據）可 `openExternal`；`file:` / `javascript:` / `data:` / 未知 scheme 一律 `preventDefault` 且不開啟，log 一行（不含完整本機路徑以外的敏感資訊）。app 自身 URL 判斷改用 URL 解析後比較（處理 Windows 反斜線 / 大小寫），不要用字串 startsWith。判斷抽純函式並單測（含 `file:///C:/x.bat`、`FILE://`、`file:\\\\server\\share`、http / https 放行、app URL 放行）。"
  - "🔴 不得改變既有 http(s) 連結開外部瀏覽器的行為。"
  - "🔴 `main.ts` commit 前 `git diff electron/main.ts` 確認只含本單 hunk（必要時 `git apply --cached` 精準 stage）。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；不得以 `git show HEAD:… >` 覆寫取紅燈）；寫檔維持 LF；不 push。"
---

# T0457 — 導航不開本機檔

## 驗收條件

- [x] 回報區附 `openExternal` 入口盤點
- [x] 純函式測試（file / javascript / data / 大小寫 / UNC 拒絕；http(s) / app URL 放行）
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0439 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 盤點 → 先寫測試（紅）→ 實作（綠）；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — `will-navigate` / `setWindowOpenHandler` 只把 `http:` / `https:` 交給 `shell.openExternal`；`file:` / `javascript:` / `data:` / 未知 scheme 一律 `preventDefault`（window-open 一律 `deny`）且不開啟，log 一行只含 scheme。app 自身 URL 改以 URL 解析比較。

**Landing Zone**：PASS — C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 `electron/main.ts`、`electron/__tests__/` 皆存在；C-2 無 `branch` 欄位（目前 `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo` / `CT_INTERACTIVE=0`。

### 產出摘要

#### `openExternal` 入口盤點

| 入口 | 位置 | URL 來源 | 本單處置 |
|---|---|---|---|
| `setWindowOpenHandler` | `electron/main.ts` `createWindow`（主視窗） | renderer 的 `window.open` / `<a target="_blank">`（`remote-tools/ExternalLink.tsx` 等依賴此路由開瀏覽器） | **改**：`decideWindowOpen` → 僅 http(s) `openExternal`，其餘 block + warn；恆 `deny` |
| `will-navigate` | `electron/main.ts` `createWindow`（主視窗） | 頁面內導航（連結點擊、拖放檔案導航、`location=` 等） | **改**：`decideNavigation` → app URL `allow`、http(s) `open-external`、其餘 `block`（`preventDefault` + warn） |
| `will-redirect` / `will-frame-navigate` | — | 全專案無 handler | 無（redirect 只發生在已允許的載入之後；`will-navigate` 已擋非 http(s) 起點） |
| 選單 Help / About 項 | `electron/main.ts` 約 :895-947 | 硬編 `GITHUB_REPO_URL`（https） | 不動 |
| IPC `shell:open-external` | `electron/main.ts` 約 :2416 | renderer 主動呼叫：`AboutPanel` / `GitHubPanel` / `Sidebar` / `FileTreeMarkdown` / `chat-markdown` / `UpdateNotification` / `TerminalPanel`（:312 file URI、:343 web link）/ `PathLinker` / `SetupWizardShell` / `SettingsPanel` | **不動（範圍外，見遭遇問題 1）**：`file:///` 走 `shell.openPath`（使用者點擊本機路徑開檔是既有功能），其餘 `openExternal` |
| detached workspace 視窗 | `electron/main.ts` `workspace:detach`（約 :3235） | 無 `setWindowOpenHandler` / `will-navigate` | 不動（見遭遇問題 2）；無 handler ⇒ 不經 `openExternal`/ShellExecute |

`mailto:` 等其他 scheme：全專案 `src/` / `electron/` 無 `mailto:` 使用 ⇒ **不放行**，白名單僅 `http:` / `https:`。

#### 改動

| 檔案 | 改動 |
|---|---|
| `electron/navigation-guard.ts`（**新檔**；affects_files 只列 `main.ts`，判斷依工單要求抽純函式故新增） | `isExternalBrowserUrl`（URL 解析後 `protocol ∈ {http:, https:}`）/ `isAppUrl`（file: 比 host + 解碼後 pathname，大小寫不敏感，忽略 query/hash；http(s) dev 比 origin + pathname 前綴）/ `decideNavigation` / `decideWindowOpen` / `urlSchemeForLog`（只回 scheme，不含路徑） |
| `electron/main.ts` | `import { pathToFileURL } from 'url'` + import guard；`appUrl` 改 `pathToFileURL(path.join(...)).href`（不再是 Windows 反斜線字串，`isAppUrl` 也能吃舊反斜線形式）；兩個 handler 改走純函式 |
| `electron/__tests__/navigation-guard.test.ts`（新檔） | 42 cases：`file:///C:/x.bat`、`FILE://`、`File:`、`file:\\server\share`、`file://server/share/x.exe`、`javascript:` / `JavaScript:`、`data:`、`mailto:`、`ms-msdt:`、`search-ms:`、`vbscript:`、裸路徑、空字串、不可解析 → 拒絕；http / https / `HTTPS://` 放行；app URL：Windows 反斜線形式 + 空白、大小寫與 hash、POSIX、`pathToFileURL` 形式、dev origin 放行；`index.html.bat`、UNC、他 port、他 scheme、`localhost:5173.evil.com` 不算 app |

既有 http(s) 行為不變：http(s) 連結仍 `openExternal`（window-open 與 will-navigate 皆同），app 自身導航仍放行。

#### 驗證

| Lane | 結果 | 證據 |
|---|---|---|
| TDD 紅燈 | 先寫測試，模組不存在 → `Test Files 1 failed` | `npx vitest run electron/__tests__/navigation-guard.test.ts` |
| 新測試 | PASS | `Tests 42 passed (42)` |
| `npm run test:unit` | PASS | `Test Files 162 passed (162)`、`Tests 2633 passed \| 1 skipped (2634)` |
| `npx tsc --noEmit` | PASS（36 ≤ 36） | 36 errors 全為既有（CodexAgentPanel 29 / terminal-keyboard-event.test 5 / agent-profiles 1 / integration.transitions.test 1），無本單檔案 |
| 補充：`npx tsc --noEmit -p tsconfig.node.json` | 本單檔案 / 改動行 0 error | 根 tsconfig 不含 `electron/`，另跑 node project；其 173 條為既有設定雜訊（TS6307 / TS2802 等），過濾 `navigation-guard` 與 `main.ts` 改動行無命中 |
| `npx vite build` / `npm run test:e2e` | 未跑（工單 L141 明令不跑） | — |
| 實機 runtime | 未做 | 無 runtime smoke；需實機時於打包版驗證拖放 `.bat` 到非終端區不執行 |

### 遭遇問題

1. **IPC `shell:open-external` 仍會對 `file:///` 執行 `shell.openPath`**（範圍外殘留，建議塔台評估）：這是 renderer 主動呼叫的「點擊本機路徑開檔」既有功能（PathLinker / TerminalPanel :312），`openPath` 對 `.bat` / `.exe` 同樣等同執行。觸發需使用者在 app 內點擊路徑連結，與本單「意外導航」性質不同，且改動會破壞既有功能（No Regressions）⇒ 未動。若要收斂，可另案對可執行副檔名加確認對話框
2. **detached workspace 視窗無 `setWindowOpenHandler` / `will-navigate`**：不經 `openExternal`，故無 ShellExecute 風險；但 `target="_blank"` 連結在 detached 視窗會開 Electron 新視窗而非外部瀏覽器、導航會在視窗內載入。屬既有行為差異，非本單範圍，建議另案讓 detached 視窗共用同一組 handler
3. **超出 affects_files**：新檔 `electron/navigation-guard.ts`（工單要求「判斷抽純函式並單測」，放 `main.ts` 內無法單測）
4. `main.ts` 工作樹為 LF（git 提示 checkout 時轉 CRLF，為既有 autocrlf 設定，未改動）；同工作樹平行改動（T0427 / T0436 工單、`_tower-state.md`）本單未碰

### Commit

- `git commit --only`：`electron/navigation-guard.ts`、`electron/__tests__/navigation-guard.test.ts`、`electron/main.ts`、本工單；不 push。hash 見 `git log`（本回報寫於 commit 前）

### 回報時間

2026-10-05T07:38:19+08:00
