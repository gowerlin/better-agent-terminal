---
schema_version: 1
schema_kind: workorder
id: T0352
title: Fix BUG-079 — 新增 gh-resolver + Settings Custom gh path + 改善錯誤 UX（方案 A+D+C 滿版）
type: fix
status: FIXED
sizing: M
created_at: "2026-05-15T10:58:00+08:00"
started_at: "2026-05-15T11:04:55+08:00"
updated_at: "2026-05-15T11:17:48+08:00"
completed_at: "2026-05-15T11:17:48+08:00"
commit: "519c567"
renew_count: 0
affects_files:
  - electron/gh-resolver.ts
  - electron/main.ts
  - electron/preload.ts
  - src/components/GitHubPanel.tsx
  - src/components/SettingsPanel.tsx
  - src/types/index.ts
  - src/store/index.ts
  - src/locales/zh-TW/index.ts
  - src/locales/en-US/index.ts
  - electron/__tests__/gh-resolver.test.ts
  - _ct-workorders/T0352-fix-bug079-gh-resolver-and-custom-path-and-error-ux.md
  - _ct-workorders/BUG-079-bat-github-feature-cannot-find-gh-cli.md
---
# T0352 — Fix BUG-079（gh-resolver + Custom gh path + Error UX，方案 A+D+C 滿版）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0352 |
| 類型 | fix |
| 所屬 | BUG-079 — BAT GitHub 功能找不到 gh CLI |
| 狀態 | ✅ FIXED |
| 建立時間 | 2026-05-15 10:58 (UTC+8) |
| 開始時間 | 2026-05-15 11:04 (UTC+8) |
| 完成時間 | 2026-05-15 11:17 (UTC+8) |
| Sizing | M（estimate 60-120 min wall；新 resolver + 7 handler + Settings 面板 + locale + tests） |
| 依賴 | T0351 research 結論（DONE 2026-05-15 10:57）/ `electron/claude-resolver.ts` 作為 resolver pattern 參考 / `electron/claude-runtime-router.ts` 的 customPath 模式 |
| 後續 | FIXED → 使用者驗收（VERIFY）或直接 CLOSED；可能衍生 unit test 加強工單 |
| 互動旗標 | `--mode on --no-interactive`（fix 工單預設不互動，遇大問題回塔台） |
| Renew 次數 | 0 |
| 工作目錄 | main repo |

## 背景

T0351 research 確認根因：所有 `github:*` IPC handler 直接 `execFileSync('gh', ...)`，沒有 resolver、沒有 common location fallback、`process.env.PATH` snapshot 在 Electron main process 啟動時可能缺 GitHub CLI 目錄。

使用者拍板採 **方案 A + D + C 滿版**：

- **A**：新增 `electron/gh-resolver.ts`，仿 `claude-resolver`
- **D**：改善 `check-cli` 錯誤 UX，renderer 顯示嘗試過的路徑 + 安裝建議
- **C**：Settings 面板新增「Custom gh path」欄位，類 Claude Runtime customPath

## 修復內容

### 1. `electron/gh-resolver.ts`（新增）

仿 `electron/claude-resolver.ts` 結構，但範圍縮小（只接受 native executable）：

```ts
export interface GhResolveResult {
  found: boolean;
  path?: string;            // absolute path to gh binary
  source?: 'custom' | 'path' | 'common-location' | 'where';
  attemptedPaths: string[]; // for UX debugging
  error?: string;
}

export async function resolveGhBinary(opts?: {
  customPath?: string;
}): Promise<GhResolveResult>
```

**解析順序**（與 T0351 推薦一致）：

1. `customPath`（使用者於 Settings 指定，存在且可執行）
2. `PATH` 掃描 `gh.exe`（Windows）/ `gh`（Unix）
3. Windows common locations：
   - `C:\Program Files\GitHub CLI\gh.exe`
   - `%LOCALAPPDATA%\Programs\GitHub CLI\gh.exe`
   - `%ProgramFiles(x86)%\GitHub CLI\gh.exe`（保險）
4. `where.exe gh`（Windows）/ `which gh`（Unix）— 動態解析作為最後 fallback

**安全規則**（遵循 CLAUDE.md「Child Process Spawning」）：
- 用 `execFile` + array args，**禁用** `child_process.exec` 模板字串呼叫
- customPath 過 regex 白名單（允許 Windows 路徑字元 + drive letter）
- timeout 必設（建議 3s for `where`/`which`）
- 所有路徑檢查用 `fs.existsSync` + `fs.accessSync(path, X_OK)`

### 2. 改寫 `electron/main.ts` 所有 `github:*` handler

| handler | line | 改動 |
|---------|------|------|
| `github:check-cli` | 2590 | 回傳 `{ installed, authenticated, path?, attemptedPaths?, error? }`（取代現有的 `{ installed: false }` 吞錯模式）|
| `github:pr-list` | 2620 | `execFileSync(resolvedGh, ['pr', 'list', ...])` |
| `github:issue-list` | 2631 | 同上 |
| `github:pr-view` | 2642 | 同上 |
| `github:issue-view` | 2653 | 同上 |
| `github:pr-comment` | 2664 | 同上 |
| `github:issue-comment` | 2675 | 同上 |

**Resolver caching**：第一次 resolve 後記在 module-level 變數，handler 內快速取用；Settings 改 customPath 時 invalidate cache（透過 IPC 或事件）。

### 3. Settings 面板「Custom gh path」（C）

仿 Claude Runtime customPath 模式：

- `src/types/index.ts`：`Settings` 加 `githubCliPath?: string`（optional）
- `src/store/index.ts`：persist + getter/setter
- `src/components/SettingsPanel.tsx`：在 Advanced 或 GitHub 區段加：
  - Checkbox「Use custom gh path」
  - TextInput 絕對路徑
  - 「Test」按鈕 → 呼叫 `github:check-cli` 帶 customPath 暫測
- `src/locales/zh-TW/index.ts` + `en-US`：對應字串

### 4. Renderer 錯誤 UX（D）

`src/components/GitHubPanel.tsx`：

- consent 後 `checkCli` 失敗時，顯示：
  - 錯誤標題「找不到 GitHub CLI」
  - 嘗試過的路徑清單（從 `attemptedPaths` 陣列）
  - 安裝建議連結 `https://cli.github.com/`
  - 「重啟 BAT」按鈕（提示重啟可重新讀 PATH）
  - 「指定路徑」按鈕 → 開 Settings 面板對應段落

### 5. 測試

`electron/__tests__/gh-resolver.test.ts`：

- PATH hit（mock `process.env.PATH` 含 gh 目錄）
- customPath hit（合法絕對路徑）
- customPath invalid（不存在/非檔案/無執行權）
- Common location hit（mock `existsSync`）
- `where.exe` fallback（mock execFileSync）
- 完全找不到 → 回 `{ found: false, attemptedPaths: [...] }`
- 順序優先級驗證（customPath > PATH > common > where）

## Acceptance Criteria

- [ ] `electron/gh-resolver.ts` 新檔通過 typecheck + lint
- [ ] 7 個 `github:*` handler 改用 resolved absolute path，無 raw `'gh'` 呼叫殘留
- [ ] `github:check-cli` 回傳擴展 schema，preload bridge 對應更新
- [ ] Settings 面板有 Custom gh path 欄位 + Test 按鈕可運作
- [ ] GitHubPanel 在 `check-cli` 失敗時顯示新錯誤 UX（含 attemptedPaths + 安裝連結）
- [ ] zh-TW + en-US locale 字串齊全（無 fallback 到 key name）
- [ ] gh-resolver unit tests 全綠（覆蓋 6+ 案例）
- [ ] 現有測試無 regression
- [ ] `npm run build` 通過（含 verify-renderer-imports D090 guard）
- [ ] 手動 smoke：
  1. 正常 PATH 環境 → PR 列表載入成功，UI 顯示 `path: C:\...\gh.exe`
  2. 移除 PATH 中 GitHub CLI → 仍可從 common location 找到
  3. customPath 指向錯誤路徑 → 顯示清晰錯誤
  4. customPath 指向正確 gh.exe → 優先使用

## 風險與注意

- **PATH cache invalidation**：使用者改 customPath 後須立即生效，不要等 BAT 重啟
- **跨平台**：本工單聚焦 Windows（使用者環境）；macOS/Linux 的 common locations 至少加 `/usr/local/bin/gh`、`/opt/homebrew/bin/gh`、`~/.local/bin/gh`，但 Windows 路徑驗收先行
- **renderer D090 守則**：resolver 是 main-only，不要在 renderer 端 import `node:fs`/`node:path`
- **安全**：customPath 不可注入 shell；只走 execFile + array args

## 不在本工單範圍

- 不重做 GitHubPanel 整體 UI（只加錯誤狀態 + Settings 連結）
- 不擴展 Settings 面板的其他 GitHub 設定（如 PAT 管理）
- 不處理非 PR/Issue 的 gh 子命令（release、workflow 等暫不需要）
- 不改 `agent-runtime/agent-registry.ts:236` 的 Copilot CLI default（不同路徑）

## 回報區

### 完成狀態

FIXED — 修復已完成，等待驗收。

### 產出摘要

- 新增 `electron/gh-resolver.ts`，依 customPath → PATH → common locations → where/which 順序解析 native `gh` executable，並回傳 `attemptedPaths` 供 UX 顯示。
- 改寫 7 個 `github:*` IPC handler 使用 resolved absolute path 呼叫 `gh`，移除 raw `gh` / `shell: true` GitHub CLI 呼叫；Settings 儲存 `githubCliPath` 時會 invalidate resolver cache。
- 擴充 preload / ElectronAPI / settings 型別與 `settings-store`，Advanced Settings 新增 Custom gh path checkbox、path input、Test 按鈕。
- 改善 `GitHubPanel` 找不到 CLI 的錯誤 UX：顯示錯誤標題、嘗試路徑、安裝連結、Restart BAT、指定路徑按鈕。
- 補齊 en / zh-TW / zh-CN locale 字串與 `electron/__tests__/gh-resolver.test.ts` 單元測試。
- 更新 `BUG-079` 狀態為 FIXED（等待驗收）。

### 修改檔案

- `electron/gh-resolver.ts`
- `electron/main.ts`
- `electron/preload.ts`
- `electron/__tests__/gh-resolver.test.ts`
- `src/App.tsx`
- `src/components/GitHubPanel.tsx`
- `src/components/SettingsPanel.tsx`
- `src/components/WorkspaceView.tsx`
- `src/stores/settings-store.ts`
- `src/styles/github-panel.css`
- `src/types/electron.d.ts`
- `src/types/index.ts`
- `src/locales/en.json`
- `src/locales/zh-TW.json`
- `src/locales/zh-CN.json`
- `_ct-workorders/BUG-079-bat-github-feature-cannot-find-gh-cli.md`
- `_ct-workorders/T0352-fix-bug079-gh-resolver-and-custom-path-and-error-ux.md`

### 驗證

- PASS — `npx vitest run electron/__tests__/gh-resolver.test.ts`
- PASS — `npm run test:unit`（33 files / 384 tests）
- PASS — `npx vitest run src/locales/__tests__/i18n-completeness.test.ts`
- PASS — `node scripts/verify-renderer-imports.js`
- PASS — `node scripts/verify-native-modules.js`
- PASS — `npm run compile`
- PASS — `rg "execFileSync\\('gh'|execFileSync\\(\\"gh\\"|execSync\\('gh |execSync\\(\\"gh " electron src` 無 raw `gh` handler 呼叫殘留
- PASS — 本機 smoke：`resolveGhBinary()` 找到 `C:\Program Files\GitHub CLI\gh.exe`（source: `path`）
- BLOCKED（外部 baseline asset）— `npm run build` 在 `prebuild -> fetch:baseline` 階段失敗：GitHub Release `server-bundle-v0.4.1/bat-server-linux-x64-v0.4.1.tar.gz` 回 404，未進入本次程式碼的 electron-builder 階段。
- BLOCKED（同上）— `node scripts/verify-helper-bundle.js` 因 `dist-baseline/` 缺少 baseline tarball 失敗。

### 遭遇問題

- `npm run build` 受既有 PLAN-031 baseline 發佈資產缺失阻擋：`https://github.com/anthropics/better-agent-terminal/releases/download/server-bundle-v0.4.1/bat-server-linux-x64-v0.4.1.tar.gz` 連續重試後仍為 HTTP 404。程式碼相關 compile、unit、i18n、renderer import guard 已通過。

### 互動紀錄

無。

### Renew 歷程

無。

### Commit

519c567

### 回報時間

2026-05-15 11:17 (UTC+8)

---

**派發指令**：在新 sub-session 輸入 `/ct-exec T0352`
