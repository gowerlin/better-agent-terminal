---
schema_version: 1
schema_kind: workorder
id: T0376
title: "本地打包腳本版號來源修正：預設取 package.json、保留 -pre 後綴、不留 dirty、補齊 build 前置檢查"
type: implementation
status: TODO
priority: P2
sizing: S
created_at: "2026-10-04T20:39:03+08:00"
updated_at: "2026-10-04T20:39:03+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "D125（本工單決策依據）"
  - "BUG-056（--dir / 本地打包非 production 等價的盲點）"
  - "_local-rules.md § Release 流程實況（package.json 發版後必同步）"
affects_files:
  - .vscode/scripts/release.ps1
  - scripts/build-version.js
  - choco/tools/chocolateyinstall.ps1
  - .vscode/tasks.json
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不要實際跑完整打包**（`release.ps1` 不帶 `-DryRun`、`npm run build*`、`electron-builder`）：會寫 `dist/` / `release/`，且與並行工單 T0377 的 vite build 互擾。驗證一律用 `-DryRun` 與可單測的純函式。"
  - "🔴 **CI 路徑行為不得改變**：`pre-release.yml` / `release.yml` 以 `VERSION` env 呼叫 `build-version.js`，env 優先序第一名必須維持、輸出值必須與現在相同。"
  - "🔴 不改 `.github/workflows/**`、不改 `package.json` 版號、不 push、不打 tag。"
---

# T0376 — 本地打包腳本版號來源修正

## 背景

使用者以 VS Code task「發行: 打包發行版」本地打包，產出版號 `1.26.1004195815`，而 GitHub pre-release 為 `0.5.9-pre.4`。塔台複核根因（2026-10-04）：

| # | 問題 | 位置 |
|---|------|------|
| P1 | 未帶 `-Version` 時，只認 `git describe --tags --exact-match`；HEAD 不在 tag 上（tag 後有塔台紀錄 commit 很常見）即退回時間戳 `1.yy.MMddHHmmss` | `.vscode/scripts/release.ps1:57-66` |
| P2 | 時間戳版號 `1.x` 大於所有真實版號（`0.5.x`）→ 之後裝官方版會被判為降級 | 同上 |
| P3 | 從 tag 取版時 `-replace '-.*$', ''` 砍掉 `-pre.N` → 預覽版被標成正式版號 | `release.ps1:60` |
| P4 | 版號寫回 `package.json`、nuspec 寫回 `choco/better-agent-terminal.nuspec`，打包後留下 dirty（使用者已手動還原） | `release.ps1:70-76, 129-132` |
| P5 | `build-version.js` 同型問題：tag 取版 `.split('-')[0]` 砍後綴；`git describe --tags`（非 exact）fallback 會取最近的 tag 加距離，再砍成錯的正式版號 | `scripts/build-version.js:26-40` |
| P6 | `release.ps1` 跑 `npm run compile`（只有 vite build）+ `npx electron-builder --win`，**繞過** `verify-native-modules` / `verify-helper-bundle` / `verify-renderer-imports` / `fetch:baseline`（`package.json` `build` / `prebuild` script 都有）——BUG-056 類盲點 | `release.ps1:83-92` |
| P7 | choco checksum 搜尋 `*.Setup.*.exe`，實際檔名 `BetterAgentTerminal Setup <ver>.exe`（空白不是點）→ 永遠找不到，`__CHECKSUM64__` 從未被替換；若替換成功又會把 tracked 的 `chocolateyinstall.ps1` 改髒 | `release.ps1:135-142` |

## 目標（D125）

1. **版號來源優先序**（`release.ps1` 與 `build-version.js` 一致）：
   1. 明確指定（`-Version` / `VERSION` env）
   2. `package.json` 的 `version`（依 `_local-rules` 發版後必同步，是 repo 的版號 SoT）
   3. 時間戳僅作最後手段，且**格式不得大於真實版號**——建議 `<package.json version>-local.<yyMMddHHmmss>` 或直接要求顯式 `-Snapshot` switch 才產生；請在回報說明選擇
   - 若 HEAD 剛好在 `v*` tag 上且與 `package.json` 不一致：印警告（不要靜默挑一個），以 `package.json` 為準或 abort，二選一並說明理由
   - git tag 取版若保留，**必須保留 `-pre.N` 等 prerelease 後綴**；移除非 exact 的 `git describe --tags` fallback（本 repo 有 `v0.x` / `v2.2.x` / `v4.0.x` 三條 tag 線，L123）
2. **不留 dirty**：版號與 `package.json` 相同時不寫檔；需要覆寫（`-Version` 不同於 package.json）時以 try/finally 在打包後還原 `package.json` 與 nuspec。`chocolateyinstall.ps1` 的 checksum 替換改為寫到暫存複本 / 打包後還原，不得留在 tracked 檔
3. **補齊前置檢查**：`release.ps1` 打包前跑與 `npm run build` 等價的檢查（`verify-native-modules` / `verify-helper-bundle` / `verify-renderer-imports`）及 `fetch:baseline`；最簡做法是改呼叫既有 npm script 而非自行拼 `compile` + `electron-builder`，請評估後選定（注意 `build:release` 也會經 `build-version.js`，版號需經 env 傳遞避免重複計算）
4. **choco checksum**：修正 Setup exe 搜尋 pattern，與 electron-builder 實際檔名一致
5. 更新 `release.ps1` 的 `.PARAMETER Version` 說明文字，反映新優先序

## 驗收

- `build-version.js` 的版號解析抽成可測純函式（例如 `resolveVersion({ env, pkgVersion, tag, now })`），新增 vitest 測試覆蓋：env 優先、package.json 次之、`-pre.N` 保留、tag 與 package.json 不一致、時間戳 fallback 格式（若保留）。測試檔位置須被 `vite.config.ts` `test.include` 涵蓋（先確認 glob）
- `pwsh -File .vscode/scripts/release.ps1 -DryRun -SkipGitCheck`：印出版號 = `0.5.9-pre.4`（目前 package.json 值），**執行後 `git status --porcelain` 為空**
- `pwsh -File .vscode/scripts/release.ps1 -DryRun -SkipGitCheck -Version 9.9.9-test.1`：印出 `9.9.9-test.1`，執行後 `git status --porcelain` 為空
- `VERSION=0.5.9-pre.4 node -e "<呼叫解析函式>"` 輸出與修改前相同（CI 不變的證據）
- `npm run test:unit` 全綠（基線 673）
- `.vscode/tasks.json` 若無需改動則不動

## 範圍外

- 實際完整打包與安裝（交使用者 runtime 驗收）
- `release/` 目錄舊產出清理（使用者自行處理）
- macOS / Linux 本地打包腳本

## Sub-session 執行指示

1. 讀取本工單全部內容
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）
5. commit 僅 `affects_files` 內實際改動的檔 + 新增測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
