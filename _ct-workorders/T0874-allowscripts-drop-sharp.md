---
schema_version: 1
schema_kind: workorder
id: T0874
title: "allowScripts 拿掉已無作用的 sharp 項目，並核對其餘項目"
type: implementation
status: DONE
created_at: "2026-11-17T10:27:04+0800"
started_at: "2026-11-17T10:29:04+0800"
updated_at: "2026-11-17T10:34:09+0800"
completed_at: "2026-11-17T10:34:09+0800"
session_ids:
  - "5ba631f3-bf00-4dbb-b261-d836f541fc3a"
repo: better-agent-terminal
priority: P3
sizing: S
depends_on: [T0873]
related:
  - "D298（T0873〈建議後續〉2）；D297；CLAUDE.md〈本機開發：npm 12 install scripts〉"
affects_files:
  - _ct-workorders/T0874-allowscripts-drop-sharp.md
  - package.json
  - package-lock.json（只在 npm 自動改寫時）
  - CLAUDE.md（只限〈本機開發：npm 12 install scripts〉節）
  - docs/agent-guide/npm12-install-scripts.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 `allowScripts` 是政策：本單只依 D298 拿掉 `sharp`。其他項目（`esbuild`、`@anthropic-ai/claude-code`）只核對、不改；若發現它們也已沒有 install script，或有新套件需要放行，寫在回報區由塔台決定。不得用 `npm install-scripts approve --all` 或 `--dangerously-allow-all-scripts`。`electron-winstaller`、`fsevents` 照舊不列、不寫 `false`。"
  - "🔴 不改任何套件版本。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0874 — allowScripts 拿掉已無作用的 sharp 項目

## 元資料
- **工單編號**：T0874｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-17 10:27 (UTC+8)
- **規模**：S｜**依賴**：T0873｜**決策**：D298

## 背景
T0873 把 `sharp` 升到 0.35.5，新版沒有 install script（T0873 回報區〈三個 major 的判斷〉）。`package.json` 的 `allowScripts` 目前是 `{"esbuild":true,"sharp":true,"@anthropic-ai/claude-code":true}`。`sharp` 項目已沒有作用；留著的風險是日後 `sharp` 若又加 install script，會在沒有塔台決策的情況下被放行。

## 任務
1. 確認 lock 中的 `sharp`（0.35.5）與 `@img/*` 平台套件都沒有 `install`／`preinstall`／`postinstall`（讀 `package-lock.json` 的 `hasInstallScript` 與套件的 `package.json`）。
2. 從 `allowScripts` 拿掉 `sharp`。
3. 核對 `esbuild`、`@anthropic-ai/claude-code` 仍有 install script（記錄結果，不改）。
4. 更新 CLAUDE.md〈本機開發：npm 12 install scripts〉的放行清單文字，以及 `docs/agent-guide/npm12-install-scripts.md`（放行清單、手動補跑表中 `sharp` 的說明）。CLAUDE.md 只改該節必要的字。

## 驗收條件
- [x] `npm ci` exit 0；結尾 install-scripts 警告只有 `electron-winstaller`（與 T0873 最終相同）
- [x] `node scripts/generate-icons.js` 能執行（輸出到暫存位置或執行後確認 `git status` 沒有圖示變更；若腳本會寫回 repo，執行後比對位元組／像素與 T0873 相同，不 commit 圖示）
- [x] `npm run test:unit` 不比 T0873 最終差（若有讀 `allowScripts` 的守門測試，一併確認）
- [x] 回報區附 `esbuild`、`@anthropic-ai/claude-code` 的核對結果
- [x] commit 只含本單範圍，不 push

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **狀態**：DONE
- **完成時間**：2026-11-17T10:34:09+0800
- **session_id**：5ba631f3-bf00-4dbb-b261-d836f541fc3a
- **產品 commit**：`f643f0ed` chore(T0874): drop sharp from allowScripts (D298)（未 push）

### 落點檢查
- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`CT_HOME` 未設，非 worktree）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`package.json`、`CLAUDE.md`、`docs/agent-guide/npm12-install-scripts.md` 皆存在 → PASS（資訊性）
- C-2：工單無 `branch` 欄位，目前 `main`
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`、`BAT_REMOTE_TOKEN` 已設定

### 結果摘要
`allowScripts` 拿掉 `sharp`，現為 `{"esbuild":true,"@anthropic-ai/claude-code":true}`。CLAUDE.md〈本機開發：npm 12 install scripts〉第一點與 `docs/agent-guide/npm12-install-scripts.md`（放行清單、新增「`sharp` 已不在 `allowScripts`」一點、手動補跑表 `sharp` 列）同步更新。沒有改任何套件版本，`package-lock.json` 沒有變動。

### 1. sharp / @img 的 install script 核對
| 來源 | 結果 |
|---|---|
| `package-lock.json` `node_modules/sharp` 0.35.5 | 沒有 `hasInstallScript` |
| lock 中全部 `node_modules/@img/*`（`sharp-<平台>` 0.35.5 ×21、`sharp-libvips-<平台>` 1.3.4 ×10、`colour` 1.1.0） | 全部沒有 `hasInstallScript` |
| `node_modules/sharp/package.json` | `scripts` 沒有 `install` / `preinstall` / `postinstall` |
| 本機安裝的 `@img/sharp-win32-x64` 0.35.5、`@img/colour` 1.1.0 的 `package.json` | 沒有 install 類 script（`colour` 只有 `build*` / `test`） |

lock 中全部有 `hasInstallScript` 的套件：根專案、`@anthropic-ai/claude-code`、`electron-winstaller`、`esbuild`、`fsevents` ×3（`node_modules/fsevents`、`tsx/node_modules/fsevents`、`vite/node_modules/fsevents`）。與 T0873 最終相同，沒有新套件需要放行。

### 2. esbuild、@anthropic-ai/claude-code 核對（只記錄、不改）
| 套件 | lock `hasInstallScript` | `package.json` script | 本次 `npm ci` 後確認 |
|---|---|---|---|
| `esbuild` 0.28.2 | true | `postinstall: node install.js` | `@esbuild/win32-x64` 已安裝；`require('esbuild').transformSync` 正常轉譯 TS |
| `@anthropic-ai/claude-code` 2.1.316 | true | `postinstall: node install.cjs` | `bin/claude.exe --version` = `2.1.316 (Claude Code)`；`node scripts/verify-native-modules.js` exit 0 |

兩者仍有 install script，放行項仍有作用，維持不變。`@esbuild/*`、`@anthropic-ai/claude-code-<平台>` 平台套件都沒有 install script。

### 3. 驗收
| 條件 | 結果 |
|---|---|
| `npm ci` | exit 0（added 745 packages）。install-scripts 警告只有 `electron-winstaller@5.4.0 (install: node ./script/select-7z-arch.js)`，與 T0873 最終相同。另有使用者層 `.npmrc allow-scripts setting is being ignored` 一行（T0873 已記錄，與本單無關） |
| `node scripts/generate-icons.js` | 在 repo 外的副本（暫存目錄，`NODE_PATH` 指向 repo `node_modules`，sharp 0.35.5 / vips 8.18.7）執行：exit 0、`All icons generated successfully!`。repo `git status` 沒有圖示變更，未 commit 圖示。比對方式與 T0873 相同：另在暫存目錄裝 sharp 0.34.5（vips 8.17.3）產生一份，結果與 T0873 逐項一致：`icon-64/128/256/512.png`、`icon.png`、`icon.ico` 位元組相同；`icon-16/32/48.png` 位元組不同、解碼後像素差異 0。0.35.5 連跑兩次輸出逐位元相同 |
| `npm run test:unit`（先 `npx vite build` exit 0，`asar-runtime-deps` 有實跑） | 第一次：8239 passed / 1 failed / 156 skipped，11 個檔案標 failed，原因全是並行負載下的逾時（10 × `Hook timed out in 10000ms`、1 × `Test timed out in 5000ms`；`headless-*` 7 檔、`local-helper-capability`、`terminal-query-handlers`、`tower-questions`、`helper-connection-hygiene` #9），與 T0873 基準記錄的 flaky 同一組。這 11 檔加 `win-stdio-inherit`、`asar-runtime-deps` 單獨重跑：13 檔 268 passed / 1 skipped / 0 failed。第二次全量：**8354 passed / 42 skipped / 0 failed**，與 T0873 最終完全相同 |
| 讀 `allowScripts` 的守門測試 | `scripts/__tests__/win-stdio-inherit.test.mjs:95` 以 `toEqual` 斷言整個 `allowScripts`，期望值已改為 `{ esbuild: true, '@anthropic-ai/claude-code': true }`，通過。其他 `src` / `electron` / `scripts` / `tests` / `e2e` / `.github` 沒有讀 `allowScripts` 的程式（`verify-native-modules.js` 只在註解與錯誤訊息提到） |
| commit 只含本單範圍、不 push | 產品 commit `f643f0ed`（4 檔）＋工單 commit；未 push |

### 異動檔案
- `package.json`：`allowScripts` 刪 `sharp` 一行
- `scripts/__tests__/win-stdio-inherit.test.mjs`：守門斷言的期望值刪 `sharp`
- `CLAUDE.md`：〈本機開發：npm 12 install scripts〉第一點放行清單刪 `sharp`，補一句移除原因
- `docs/agent-guide/npm12-install-scripts.md`：放行清單、新增「`sharp` 已不在 `allowScripts`（T0874 / D298）」一點（含原本「`sharp` 只給 generate-icons」說明）、手動補跑表 `sharp` 列改為「T0874 已移除（D298）」

### 偏離與說明
- `scripts/__tests__/win-stdio-inherit.test.mjs` 不在 `affects_files`。它的斷言把 `allowScripts` 寫死成三項，不改就會讓 `test:unit` 失敗；驗收條件寫明「若有讀 `allowScripts` 的守門測試，一併確認」，所以只改了期望值這一行，沒有改其他斷言。

### 遭遇問題
- 第一次在 Git Bash 用 `NODE_PATH=/d/...`（POSIX 路徑）執行 generate-icons 副本，Windows 的 node 找不到 `sharp`；改用 `cygpath -w` 轉成 Windows 路徑後正常。與本單變更無關。

### 建議後續（交塔台決定）
- 無新的放行需求。`esbuild`、`@anthropic-ai/claude-code` 仍需放行；`electron-winstaller`、`fsevents` 照舊不列、不寫 `false`。

### 互動紀錄
- [10:29] 開工，yolo，無提問。
