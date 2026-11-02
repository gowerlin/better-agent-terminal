---
schema_version: 1
schema_kind: workorder
id: T0779
title: "PLAN-053 第一步：Electron 41.2.1 → 41.10.7（同一條 41 線的最後一版，大版本不變）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-02T14:07:33+0800"
started_at: "2026-11-02T14:16:03+0800"
updated_at: "2026-11-02T14:24:38+0800"
completed_at: "2026-11-02T14:24:38+0800"
session_ids:
  - "9ed62801-3d89-40fc-b07d-28a588b17392"
depends_on: [T0780]
related:
  - "PLAN-053（2026-11-02 調為 high）；D221；T0668（Electron 41 停止更新查證：41.10.7 是 41 線最後一版）；BUG-164 / T0669（macOS `disable-skia-graphite`）"
  - "CLAUDE.md「Electron Runtime」「本機開發：npm 12 install scripts」「Packaging / Release 前置檢查」節；`docs/agent-guide/packaging-release-checks.md`、`docs/agent-guide/npm12-install-scripts.md`"
affects_files:
  - package.json
  - package-lock.json
  - CLAUDE.md
  - "docs/agent-guide/*.md（只在描述目前 Electron 版本的地方）"
  - _ct-workorders/PLAN-053-electron-42-upgrade.md
  - _ct-workorders/T0779-electron-41-10-7-patch-bump.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 派工時機：塔台等 T0780 收單後才派（兩張都要 build，不並行）。"
  - "🔴 現況（塔台 2026-11-02 查證）：`package.json` `\"electron\": \"^41.2.1\"`，`package-lock.json` 鎖 41.2.1，`node_modules/electron` 41.2.1；npm 上 electron@41 最新 41.10.7、`latest` 45.2.1。本單**只**升到 41.10.7，不升大版本（42+ 屬 PLAN-053 主升級，另開單）。"
  - "🔴 升級做法：`npm install electron@41.10.7`（`package.json` 變成 `^41.10.7`）。之後檢查 `git diff package-lock.json`：只允許 `node_modules/electron` 這一項（version / resolved / integrity）以及它自己的相依（若有）改變。其他套件也被改動 → 不得 commit lock，停下回報 PARTIAL（列出 diff）。`node -p \"require('electron/package.json').version\"` 與 `npx electron --version` 都要是 41.10.7。npm 12 install scripts：electron 已在 `allowScripts`，postinstall 會下載 binary；若沒下載（`path.txt` 不存在）照 `docs/agent-guide/npm12-install-scripts.md` 手動補跑，不用 `--dangerously-allow-all-scripts`。"
  - "🔴 不改的東西：`@lydell/node-pty`、`@kutalia/whisper-node-addon` 等原生模組（ABI 在 41 線內不變，CLAUDE.md「Electron Runtime」）；electron-builder、vite 系列、內嵌 claude / codex 版本；macOS `disable-skia-graphite`（T0669）與任何 GPU / Graphite 設定。不用 `npm rebuild`。"
  - "🔴 驗證（全部要有輸出佐證）：`node scripts/verify-native-modules.js` 綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠；`npm run test:legacy` 全綠（或與基線相同、逐項說明）；`npx vite build`；`npm run build:dir` 成功後 `node scripts/verify-packaged-native.js --platform win --out release --arch x64` 綠（L136：VS Code Insiders 可能鎖 `release\\win-unpacked\\resources\\app.asar`，遇到鎖檔先回報，不強制刪）；打包產物的 Electron 版本確認為 41.10.7（例：`release/win-unpacked` 執行檔 FileVersion 或 `process.versions.electron`）。"
  - "🔴 e2e 冒煙（source build、隔離實例、假模型，不用真實模型）：至少跑 `e2e/t0572-new-pty-initial-size.spec.ts`（PTY / Terminal Server）、一支 Claude 面板相關、一支 Dialog / Esc 相關（例 t0776）、一支工作區 ⚠️ 相關（例 t0735），共 ≥ 4 支，記錄每支結果；若有 spec 在 41.2.1 上原本就失敗，要先在升級前的 HEAD 重現並註明，不算回歸。只結束隔離實例自己的程序，絕不碰使用者的 BAT（`%APPDATA%\\BetterAgentTerminal`）。"
  - "🔴 macOS / Linux：本機無法驗證，回報寫「未驗證，待 CI 三平台 build 與 `macos-acceptance.yml`」，不要寫成通過。"
  - "🔴 文件：CLAUDE.md「Electron Runtime」節第一點補上目前版號（41.10.7，T0779）與 41 線已停止更新、主升級見 PLAN-053；`docs/agent-guide/` 只改描述「目前版本」的句子，實測紀錄裡的「以 41.2.1 實測」是歷史，保留不改。PLAN-053 文末補〈T0779 結果〉（版本、驗證摘要、未驗證平台），狀態維持 IDEA、不改優先度。"
  - "🔴 不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0779 — Electron 41.2.1 → 41.10.7

## 元資料

- **工單編號**：T0779
- **類型**：implementation（相依套件修補版升級）
- **優先級**：P1
- **建立時間**：2026-11-02T14:07:33+0800
- **預估規模**：M（改動小，驗證多）
- **派工順序**：T0780 收單後

## 背景

Electron 41 這條線已停止更新（最後一版 41.10.7，T0668 查證）。塔台 2026-11-02 發現 BAT 不只停在停更的版本線上，連 41 線之後的 8 個修補小版本都沒裝：lock 鎖在 41.2.1。npm 上 `latest` 已是 45.2.1。修補版通常含 Chromium 安全修正（推論）。使用者決定 PLAN-053 調為 high，先開本單在 41 線內升到最後一版；大版本升級另開單（D221）。

## 範圍

1. `npm install electron@41.10.7`，確認 lock 只改 electron。
2. 驗證（typecheck、unit、legacy、vite build、`build:dir`＋打包產物檢查、e2e 冒煙 ≥ 4 支）。
3. CLAUDE.md「Electron Runtime」、docs 目前版本描述；PLAN-053 補結果。

## 不做

- 不升 42+；不改原生模組、electron-builder、vite、內嵌 CLI；不改 GPU / Graphite 設定；不發版。

## 驗收

- [ ] `package.json` `^41.10.7`、lock 只改 electron，`electron --version` = 41.10.7
- [ ] verify-native-modules、typecheck 0 / 0、`test:unit`、`test:legacy`、`vite build` 綠
- [ ] `build:dir` ＋ `verify-packaged-native.js` 綠，打包產物 Electron = 41.10.7
- [ ] e2e 冒煙 ≥ 4 支結果（含原本就失敗者的說明）
- [ ] macOS / Linux 標「未驗證」
- [ ] CLAUDE.md / docs / PLAN-053 更新

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

- **DONE**（Windows x64 全部驗收項通過；macOS / Linux 未驗證，見下）
- **session_id**：9ed62801-3d89-40fc-b07d-28a588b17392
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3 `package.json` 存在 PASS；無 `branch` 欄位（C-2 不適用）。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` 有設定（僅存在性記錄）、`BAT_REMOTE_TOKEN` 已設定。
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；node v26.13.0、npm 12.2.1。

### 產出摘要

- `package.json`：`"electron": "^41.2.1"` → `"^41.10.7"`。
- `package-lock.json`：只改 electron 與它自己的相依（electron@41.10.7 的 `dependencies` = `@types/node ^24.9.0`、`@electron/get ^5.0.0`、`@electron-internal/extract-zip ^1.0.1`）：
  - 版本變更 2 項：`node_modules/electron` 41.2.1 → 41.10.7、`node_modules/@electron/get` 2.0.3 → 5.1.0
  - 新增 3 項：`@electron-internal/extract-zip@1.0.8`、`@electron/get/node_modules/env-paths@3.0.0`、`@electron/get/node_modules/semver@7.8.5`
  - 移除 7 項（只給 electron 41.2.1 的 `extract-zip` 與 `@electron/get` 2.0.3 用）：`extract-zip@2.0.1`、`yauzl@2.10.0`、`fd-slicer@1.1.0`、`pend@1.2.0`、`buffer-crc32@0.2.13`、`@types/yauzl@2.10.3`、`fs-extra@8.1.0`
  - 根項目 `devDependencies.electron` 規格字串同 `package.json`
  - `electron-builder` 自己的 `@electron/get@3.1.0` 不變（`npm ls @electron/get`）
- `CLAUDE.md`「Electron Runtime」第一點：補目前版號 41.10.7（T0779）、Node 24.18.0 / Chromium 146.0.7680.216 / ABI 145、41 線已停止更新、主升級見 PLAN-053。
- `docs/agent-guide/`：**未改**。逐檔搜尋 Electron 版號，只有實測紀錄（`packaging-release-checks.md` T0691「以 electron 41.2.1 …查證」、`worker-tab-recycle.md` T0774「在 Electron 41.2.1 … 實測」）與「Electron 41」線層級的描述（`logging.md`、`packaging-release-checks.md`），沒有描述「目前版本」的句子；歷史紀錄依工單保留。
- `PLAN-053`：文末補〈T0779 結果〉（版本、lock 範圍、驗證摘要、未驗證平台）；`status: IDEA`、`priority: high` 未改。
- 原生模組、electron-builder、vite 系列、內嵌 claude / codex、GPU / Graphite 設定：未動；沒有執行 `npm rebuild`。

### 驗證

| 項目 | 結果 | 佐證 |
|---|---|---|
| electron 版本 | PASS | `node -p "require('electron/package.json').version"` → `41.10.7`；`npx electron --version` → `v41.10.7`；`node_modules/electron/path.txt` = `electron.exe`（postinstall 正常下載 binary，不需手動補跑） |
| 執行期版本 | PASS | `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe -p …` → `41.10.7 chrome=146.0.7680.216 node=24.18.0 modules=145` |
| `node scripts/verify-native-modules.js` | PASS | `✅ All 2 required native modules present, whisper binary: …\win32-x64\whisper.node, embedded claude: native`，exit 0 |
| `npm run typecheck` | 0 | `tsc --noEmit -p .` exit 0、無輸出 |
| `npm run typecheck:electron` | 0 | exit 0、無輸出 |
| `npx vite build` | PASS | exit 0 |
| `npm run test:unit` | PASS | `Test Files 382 passed (382)`、`Tests 6705 passed \| 10 skipped (6715)`，exit 0 |
| `npm run test:legacy` | PASS | `legacy tests: files 33 passed, 0 failed / 33 total; tests 472 passed, 0 failed`，exit 0（not run 11 項為腳本 `EXCLUDED` 的固定清單） |
| `npm run build:dir` | PASS | exit 0；electron-builder log `packaging platform=win32 arch=x64 electron=41.10.7 appOutDir=release\win-unpacked`；未遇到 `app.asar` 鎖檔 |
| `node scripts/verify-packaged-native.js --platform win --out release --arch x64` | PASS | `✅ win x64: embedded claude …claude.exe (PE machine 0x8664), no server bundle baseline, 8 runtime package(s) / 15 with dependencies, 6 runtime helper(s) in resources/scripts, helper version 0.7.3-pre.5` / `✅ every windows package passed (x64)`，exit 0 |
| 打包產物 Electron 版本 | 41.10.7 | `release/win-unpacked/BetterAgentTerminal.exe` 內嵌字串 `Electron/41.10.7`（`grep -aoE`，與 `node_modules/electron/dist/electron.exe` 相同）；electron-builder log `electron=41.10.7`。FileVersion 是 app 版號 `0.7.3-pre.5`，不是 Electron 版號；打包版的 RunAsNode fuse 關閉，`-p` 無輸出，所以改用內嵌字串 |
| lock 只改 electron | PASS | 逐項比對（`git show HEAD:package-lock.json` vs 新 lock，見〈遭遇問題〉）；`npm ci --dry-run --ignore-scripts` 在 scratch 副本接受此 lock |

**e2e 冒煙**（source build `dist-electron`、`fixtures/electron-isolation.ts` 隔離實例、假模型 / stub，沒有真實模型；`npx playwright test`，Electron 取 `node_modules/electron` = 41.10.7）：

| spec | 範圍 | 結果 |
|---|---|---|
| `e2e/t0572-new-pty-initial-size.spec.ts` | PTY / Terminal Server | ok（28.4 s） |
| `e2e/t0776-auto-dialog-focus.spec.ts` | Dialog / Esc / 焦點、Terminal Server recovery | ok（12.4 s） |
| `e2e/t0735-workspace-waiting-badge.spec.ts` | 工作區 ⚠️ | ok（5.4 s） |
| `e2e/t0762-claude-panel-waiting.spec.ts` | Claude 面板（fake Anthropic API） | ok（6.7 s） |
| `e2e/t0744-cache-history-cumulative.spec.ts` | Claude 面板 + 內嵌 CLI（fake Anthropic API，額外加跑） | ok（5.9 s） |

5 支全過，沒有原本就失敗、需要在升級前 HEAD 重現的 spec。隔離實例由 fixture 自行結束，沒有碰使用者的 BAT（`%APPDATA%\BetterAgentTerminal`）。

**macOS / Linux**：未驗證，待 CI 三平台 build 與 `macos-acceptance.yml`。

### 行為變化

- 使用者可見：無預期變化（同一條 41 線的修補版，Chromium 146.0.7680.216；修補版通常含 Chromium 安全修正，屬推論、未逐項比對 release notes）。
- 開發端：`@electron/get` 5.x 要求 Node `>=22.12.0`（lock 的 `engines`），只影響安裝 electron binary 的那一步；本機 node v26.13.0；CI 各 workflow 一律 `actions/setup-node` `node-version: '24'`（`pre-release.yml` / `release.yml` / `macos-acceptance.yml` / `build-server-bundle.yml` / `pages.yml`），滿足此需求。

### 遭遇問題

- **lock 的 `peer` 旗標漂移（已處理，未擴大範圍）**：`npm install electron@41.10.7` 產生的 lock 除了 electron 相關項，另有 **100 項只有 `peer` 旗標翻轉**（例 `@anthropic-ai/sdk` / `@modelcontextprotocol/sdk` 加上 `peer: true`、`react` / `vite` 去掉 `peer: true`），版本 / resolved / integrity 都沒變。查證：在 scratch 以 **HEAD 的 `package.json` + HEAD 的 lock、不做任何變更**執行 `npm install --package-lock-only --ignore-scripts`，npm 12.2.1 產生**完全相同的 100 項**旗標翻轉、0 項版本變更 ⇒ 與 electron 無關，是 npm 版本重算 lock 中繼資料造成的既有漂移。
  - 處理：以 npm 產生的 lock 為準，旗標以外內容不變的項目沿用 HEAD 的原文（腳本只換回這些項目，不改任何版本 / resolved / integrity），得到只含 electron 相關變更的 lock。
  - 驗證：scratch 副本 `npm ci --dry-run --ignore-scripts` 接受；再對這份 lock 跑 `npm install --package-lock-only`，結果與 npm 直接產生的 lock **逐位元相同**（`cmp`），即兩者差異只有那 100 項既有漂移。之後的 unit / legacy / build:dir / 打包檢查都是在這份 lock 上跑的。
  - 未把漂移寫進 lock：工單規定 lock 只改 electron；`peer` 標記是否影響讀 lock production 閉包的檢查（`asar-runtime-deps.test.mjs`，CLAUDE.md T0719 / BUG-176）未查證，判斷屬範圍外。
- `npm install` 結尾警告 `electron-winstaller@5.4.0` install script 被擋：CLAUDE.md「本機開發：npm 12 install scripts」記載為預期，未處理。

### 互動紀錄

- 無（yolo，未向塔台提問；lock 漂移以查證 + 不擴大範圍的方式處理，詳見〈遭遇問題〉）。

### 後續建議

- lock 的 npm 12 `peer` 旗標漂移（100 項）：日後任何人用 npm 12 重算 lock 都會帶出來。建議塔台決定是否另開小單，在確認 `asar-runtime-deps.test.mjs` 與 CI（`npm ci`，npm 版本）不受影響後一次接受這批旗標，避免每張相依工單都要處理。
- 下一次預覽版的 CI 三平台 build 與 `macos-acceptance.yml` 即為本單 macOS / Linux 的驗收。
- PLAN-053 主升級：依 PLAN-053 待決第 1 點重新查目標版本（現 `latest` 45.2.1）。

### commit 狀態

- 產品 commit：`a09887fb` `chore(deps): T0779 bump electron 41.2.1 -> 41.10.7 (last 41.x)`（`package.json`、`package-lock.json`、`CLAUDE.md`，`git commit --only`）
- 工單 commit：本檔與 `PLAN-053`（`(ct)`，見 git log）
- 未 push、未發版、未改 CHANGELOG。

### 回報時間

- 2026-11-02T14:24:38+0800
