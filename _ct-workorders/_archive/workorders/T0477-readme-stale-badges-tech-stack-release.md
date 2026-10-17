---
schema_version: 1
schema_kind: workorder
id: T0477
title: "README 過期資訊修正：badge（version / electron / platform）、技術堆疊表、「發行」段改為本 fork 實際流程"
type: implementation
status: DONE
repo: better-agent-terminal
project: docs
priority: P3
sizing: S
created_at: "2026-10-13T20:03:17+08:00"
started_at: "2026-10-13T20:04:11+08:00"
updated_at: "2026-10-13T20:07:21+08:00"
completed_at: "2026-10-13T20:07:21+08:00"
target_version: v0.6.0-pre.4
depends_on:
  - T0476
related:
  - "T0476 回報區 B 段「另注意」（badge `version-2.1.3` / `electron-28.3.3`、發行段範例 `v2.1.4`）"
  - "CLAUDE.md「Release」節（預覽版走 `pre-release.yml` workflow_dispatch、版號必須顯式指定、gh 一律帶 -R）"
  - "D136（mac 只 arm64）"
affects_files:
  - README.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改 README.md；不 push、不觸發 workflow、不建 tag；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持檔案現況"
---

# T0477 — README 過期資訊修正

## 背景

README 多處停在上游 v2.1.x / Electron 28 時期，與本 fork（`v0.6.x`、Electron 41、Vite 7、mac 只 arm64）不符。

## 範圍

### A. Badge（`README.md:7-10`）

塔台決定（避免再次過期）：
- **Version**：改用動態 badge，取本 fork 最新 release（含 prerelease），例如 `https://img.shields.io/github/v/release/gowerlin/better-agent-terminal?include_prereleases&label=version`；連結到 `https://github.com/gowerlin/better-agent-terminal/releases`
- **Electron**：改用讀 `package.json` 的動態 badge（`https://img.shields.io/github/package-json/dependency-version/gowerlin/better-agent-terminal/dev/electron`；electron 在 `devDependencies`，請以實際欄位確認路徑），或靜態 `electron-41`。擇一並在回報區說明理由
- **Platform**：反映 D136——例如 `Windows | macOS (Apple Silicon) | Linux`
- License badge 不動
- shields.io URL 請以 `curl -sI` 或等效方式確認回 200 且為 SVG（唯讀網路請求可以）

### B. 技術堆疊表（`README.md:187-197`）

依 `package.json` 實際相依核對每一列：React / TypeScript、Electron 41、Vite 7 + electron-builder 26 等。特別核對：
- 「儲存 | better-sqlite3」：先以 grep 確認 app 是否真的使用 better-sqlite3（T0473 發現無任何 import）；若未使用，改寫為實際的設定 / 資料儲存方式或刪除該列，回報區附 grep 證據
- 「AI」列：如已整合 Codex（`@openai/codex-sdk` 等，以 `package.json` 為準）則一併列出
- 不要列沒有實際使用的技術

### C. 「發行」段（`README.md:202-221`）

改寫為本 fork 實際流程（以 CLAUDE.md「Release」節為準，簡述即可，不必全文照搬）：
- 版號範例改為 `v0.6.0` / `v0.6.0-pre.3`
- 預覽版：`gh workflow run pre-release.yml -R gowerlin/better-agent-terminal -f version=X.Y.Z-pre.N`（版號必須顯式指定、不帶 `v`）
- 正式版：push `vX.Y.Z` tag 觸發 `release.yml`
- 「VSCode Task『CI/CD: 觸發 Pre-Release』」：確認 `.vscode/tasks.json` 是否存在該 task 且帶 `-R` / 顯式版號；不存在或會留空版號則刪除該句，回報區說明

### D. 其他

- 全文 grep `2\.1\.[0-9]`、`28\.3`、`Electron 28`、`Vite 5`、`x64.*dmg` / Intel Mac 相關描述，列出並修正明確過期者；「致謝」段的上游署名保留
- 不改功能描述段落的內容（除非與上述版號 / 平台直接衝突）

## 驗收條件

- [ ] README 無 `version-2.1.3`、`electron-28`、`Electron 28`、`Vite 5`、`v2.1.4`
- [ ] badge URL 皆可取得（回報區附 HTTP 狀態）
- [ ] 技術堆疊表每列有 `package.json` 或 grep 依據
- [ ] 發行段指令與 CLAUDE.md「Release」一致
- [ ] 回報區附 `git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + README + `package.json` + CLAUDE.md「Release」節
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案與 README；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

DONE。README 的 badge、技術堆疊表、「發行」段已改為本 fork 現況；另修正 D 段 grep 掃出的 3 處與版號 / 平台直接衝突的描述（Node 前置需求、`snippet-db.ts` 註解、macOS 最低版本）。只改 `README.md`（+ 本工單），未 push、未觸發 workflow、未建 tag。

### Landing Zone Check

- C-0：PASS（frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：PASS（工單位於 REPO_ROOT 下）
- C-3：PASS（`README.md` 存在）
- C-2：工單無 `branch` 欄位，略過（實際 `main`）
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### A. Badge

| Badge | 新 URL | HTTP | 實際顯示（SVG `<title>`） |
|---|---|---|---|
| Version | `https://img.shields.io/github/v/release/gowerlin/better-agent-terminal?include_prereleases&filter=v*&label=version`，連結 `https://github.com/gowerlin/better-agent-terminal/releases`（200） | 200 `image/svg+xml` | `version: v0.6.0-pre.3` |
| Platform | `https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%28Apple%20Silicon%29%20%7C%20Linux-lightgrey.svg` | 200 `image/svg+xml` | `platform: Windows \| macOS (Apple Silicon) \| Linux` |
| Electron | `https://img.shields.io/github/package-json/dependency-version/gowerlin/better-agent-terminal/dev/electron?color=47848F` | 200 `image/svg+xml` | `electron: ^41.2.1` |
| License | 不動 | 200 `image/svg+xml` | `license: MIT` |

- **Version 加 `filter=v*`（偏離工單範例 URL，理由）**：本 fork 每次發 desktop release 也會發 `server-bundle-v<版號>` release（D120），且 server-bundle release 建立時間晚於 desktop（`gh release list -R gowerlin/better-agent-terminal`：`server-bundle-v0.6.0-pre.3` 11:16:15Z、`v0.6.0-pre.3` 11:15:29Z）。shields 預設以日期取最新，可能顯示成 `server-bundle-v…`。實測 `filter=server-bundle-*` → `server-bundle-v0.6.0-pre.3`、`filter=v*` → `v0.6.0-pre.3`，確認 glob 以 tag 開頭比對、可排除 server-bundle。
- **Electron 選動態 badge（理由）**：electron 位於 `devDependencies`（`"electron": "^41.2.1"`），shields 路徑 `/dev/electron` 實測 200；讀 GitHub 預設分支 `main` 的 `package.json`，升版後自動同步，不會像靜態 `28.3.3` 再過期。代價是顯示 semver range（`^41.2.1`）而非實裝版本，且 local 未 push 的 bump 不會反映，可接受。
- **Platform**：括號以 `%28` / `%29` 編碼，避免 Markdown 連結目的地被 `)` 截斷。

### B. 技術堆疊表（每列依據）

| 列 | 內容 | 依據 |
|---|---|---|
| 前端 | React 18 + TypeScript 5 | `package.json` `react ^18.2.0`、`typescript ^5.3.0` |
| 終端機 | xterm.js 5 + node-pty | `@xterm/xterm ^5.5.0`（`src/components/TerminalPanel.tsx`）、`@lydell/node-pty ^1.1.0`（optionalDependencies；`electron/pty-manager.ts`） |
| 框架 | Electron 41 | `electron ^41.2.1` |
| AI | claude-agent-sdk（內嵌 claude-code CLI）+ codex-sdk | `@anthropic-ai/claude-agent-sdk ^0.2.111`（`electron/claude-agent-manager.ts`）、`@anthropic-ai/claude-code ^2.1.289`、`@openai/codex-sdk ^0.160.0`（`electron/codex-agent-manager.ts`） |
| 建置 | Vite 7 + electron-builder 26 | `vite ^7.0.0`、`electron-builder ^26.8.1` |
| 儲存 | JSON 檔 | 見下方 better-sqlite3 grep 證據；`electron/snippet-db.ts:46` `path.join(userDataPath, 'snippets.json')`，electron/ 內另有 `settings.json` / `workspaces.json` / `windows.json` / `custom-clis.json` 等 |
| 遠端 | ws + selfsigned + qrcode | `ws`（`electron/remote/remote-server.ts` / `remote-client.ts`）、`selfsigned`（`electron/remote/certificate.ts`）、`qrcode`（`src/components/SettingsPanel.tsx`） |
| Git（新增） | simple-git | `electron/git/git-ipc.ts`、`electron/handlers/git.ts` |
| Markdown 預覽（新增） | marked + mermaid | `src/components/FileTreeMarkdown.tsx` |
| 語法標示 | highlight.js | `src/components/FileTreeMarkdown.tsx`、`src/components/PathLinker.tsx` |
| 語音輸入（新增） | `@kutalia/whisper-node-addon` | `electron/voice-handler.ts`、`electron/whisper-addon-loader.ts` |
| 多語系（新增） | i18next + react-i18next | `electron/main.ts`、`src/App.tsx` |
| 測試（新增） | Vitest + Playwright | devDependencies `vitest ^4.1.5`、`@playwright/test ^1.59.1` |

**better-sqlite3 grep 證據**：`git grep -l -F better-sqlite3 -- electron src` → **0 筆**（`better_sqlite3` 亦無）。repo 內只出現在 `package.json`（`dependencies` + `@types/better-sqlite3`）與 `scripts/verify-native-modules.js` 及其測試（僅檢查 `.node` 檔存在）。⇒ app 未使用 SQLite，「儲存」列改為 JSON 檔。相依本身仍在 `package.json`（是否移除屬另案，見後續建議）。

### C. 「發行」段

- 版號範例改為 `v0.6.0` / `v0.6.0-pre.3`
- 預覽版：`gh workflow run pre-release.yml -R gowerlin/better-agent-terminal -f version=X.Y.Z-pre.N`，註明 workflow_dispatch only、版號必須顯式指定且不帶 `v`、留空會遞增出脫節版號、`gh` 一律帶 `-R`（與 CLAUDE.md「Release」及 `_local-rules.md`「Release 流程實況」一致）
- 正式版：push `vX.Y.Z` tag 觸發 `release.yml`
- 補一句兩條線都會發 `server-bundle-v<版號>`（D120）
- **刪除 VSCode Task 句（理由）**：`.vscode/tasks.json` 確有「CI/CD: 觸發 Pre-Release (GitHub Actions)」，其 `.vscode/scripts/trigger-prerelease.ps1` 有帶 `--repo gowerlin/better-agent-terminal`，但**不傳 `-Version`**，腳本 `$Version` 留空時不加 `-f version=`（註解即「留空則自動遞增」）⇒ 會產出 `4.0.4-pre.1` 類脫節版號，依工單刪除。另有「(指定版本)」task 會傳 `-Version ${input:prereleaseVersion}`，但 promptString 可空白送出，同樣可能走自動遞增，故不改推薦它。

### D. 其他 grep 結果

`grep -nE "2\.1\.[0-9]|28\.3|Electron 28|Vite 5|x64|Intel|dmg|arm64|universal|Apple Silicon|SQLite|sqlite|Node"`（修正前）：

| 行 | 內容 | 處置 |
|---|---|---|
| 7 / 9 | badge `2.1.3` / `28.3.3` | A 段修正 |
| 111 | `.dmg`（Apple Silicon / arm64；自 v0.6.0-pre.3 起不支援 Intel Mac，D136） | 已正確，不動 |
| 119 | Node.js `18+` | **修正**為 `20.19+（Vite 7 的最低需求；CI 使用 Node 24）`——Vite 7 已不支援 Node 18 |
| 174 | `snippet-db.ts  # SQLite Snippet 儲存` | **修正**為 `Snippet 儲存（snippets.json）`，與 B 段儲存列一致 |
| 193 / 195 / 196 | Electron 28 / Vite 5 / better-sqlite3 | B 段修正 |
| 206 / 208 / 215 / 216 | `v2.1.3` / `v2.1.4-pre.1` / `v2.1.4` | C 段修正 |
| 242 | `要求 macOS 10.14 (Mojave) 以上` | **修正**為 `macOS 12 (Monterey) 以上（Electron 41 的最低需求）與 Apple Silicon`——與 Electron 41 / D136 直接衝突 |
| 277 | 致謝段 `macOS .dmg spawn ENOENT 修正` | 上游署名，保留 |

### 驗收

| 條件 | 結果 | 證據 |
|---|---|---|
| README 無 `version-2.1.3`、`electron-28`、`Electron 28`、`Vite 5`、`v2.1.4` | PASS | `grep -nE "version-2\.1\.3\|electron-28\|Electron 28\|Vite 5\|v2\.1\.4\|2\.1\.[0-9]\|28\.3" README.md` → 無結果 |
| badge URL 皆可取得 | PASS | 4 個皆 `200 image/svg+xml;charset=utf-8`（見 A 段表） |
| 技術堆疊表每列有依據 | PASS | 見 B 段表 |
| 發行段指令與 CLAUDE.md「Release」一致 | PASS | 見 C 段 |
| `git diff --stat` | — | `README.md \| 55 +++++++++++++++++++++++++++++++++++--------------------`、`1 file changed, 35 insertions(+), 20 deletions(-)` |

- 換行：README 維持 `i/lf w/crlf`（`git ls-files --eol`）。過程中 Git Bash `sed -i` 曾把 README 轉成 LF，已立即以 Python 轉回 CRLF 並確認；diff 無換行雜訊。
- 不涉及程式碼，未跑 `npx vite build` / 單元測試（純文件變更）。

### 偏離 / 範圍外發現（後續建議，未處理）

1. **「設定」段資料路徑過期**（`README.md` 設定段）：寫 `%APPDATA%/better-agent-terminal/` 等，但 `electron/main.ts:158` `app.setName('BetterAgentTerminal')`（本機 `BAT_USER_DATA=C:\Users\Gower\AppData\Roaming\BetterAgentTerminal`），且 `electron/main.ts:168` 另有 `app.setPath('userData', runtimePath)`。非版號 / 平台衝突，依「不改功能描述段落」未動；CLAUDE.md「Logging」節的 log 路徑可能同樣過期。建議另開小單核對。
2. **`better-sqlite3` 是死相依**：app 無任何 import，卻仍在 `dependencies`、`asarUnpack` 路徑、`postinstall` electron-rebuild、`verify-native-modules.js` 檢查中。移除可省 native rebuild 與打包體積，但牽涉 CI / 打包腳本，需塔台決策。
3. **`.vscode/tasks.json` / `trigger-prerelease.ps1`**：預設 task 留空版號會走自動遞增（脫節版號），input 描述仍是 `2.1.4-pre.1`。建議讓腳本在 `$Version` 為空時拒絕執行。

### Commit

見下方 commit（本單檔案 + `README.md`），未 push。
