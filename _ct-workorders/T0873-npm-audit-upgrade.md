---
schema_version: 1
schema_kind: workorder
id: T0873
title: "npm audit 51 項：評估並升級不會破壞的相依套件"
type: implementation
status: DONE
created_at: "2026-11-17T09:17:27+0800"
started_at: "2026-11-17T09:18:32+0800"
updated_at: "2026-11-17T09:59:28+0800"
completed_at: "2026-11-17T09:59:28+0800"
session_ids:
  - "9d952488-dc19-473c-86e4-c03a9d55e941"
repo: better-agent-terminal
priority: P2
sizing: L
depends_on: []
related:
  - "D297；使用者指示「評估，升級套件若未破壞則升級」"
affects_files:
  - _ct-workorders/T0873-npm-audit-upgrade.md
  - package.json
  - package-lock.json
  - electron/**（只限大版本升級需要的 API 調整）
  - scripts/**（只限大版本升級需要的 API 調整）
  - src/**（只限大版本升級需要的 API 調整）
  - CLAUDE.md、docs/agent-guide/**（只限版本號與升級說明）
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 不得破壞既有功能（CLAUDE.md No Regressions Policy）。升級的原則是「關卡全過才留下」；任何關卡比升級前基準多出失敗，就退回該套件的升級，寫明原因。"
  - "🔴 不加 `npm audit fix --force`；跨 major 的升級只做本單列出的三個（`simple-git`、`sharp`、`uuid`），逐一評估、各自一個 commit。其他需要 major 的（若 `npm audit fix` 後才出現）只評估、不升，列在回報區。"
  - "🔴 `allowScripts` 是政策（CLAUDE.md〈本機開發：npm 12 install scripts〉）：升級後若出現**新的**帶 install script 的套件（`npm ci` 結尾的 install-scripts 警告多了 `electron-winstaller`、`fsevents` 以外的名字），停下來問塔台；不得用 `npm install-scripts approve --all` 或 `--dangerously-allow-all-scripts`。"
  - "🔴 `electron-builder`：版本若改變，照 `docs/agent-guide/packaging-release-checks.md`〈NSIS：安裝前請 BAT 正常結束〉與 holder 版相關段落檢查（`customCheckAppRunning` 插入的範本 `_CHECK_APP_RUNNING` 等）；只能在本機 `build:dir`／`verify-packaged-native` 驗證。🔴 不得在開發機執行 W6 真實升級驗收（`e2e/t0862-windows-upgrade-acceptance.spec.ts`）、不得觸發任何 workflow；回報區寫明「發版前須跑 `windows-upgrade-acceptance.yml`」由塔台安排。"
  - "🔴 Claude Agent SDK 的 peer（`@anthropic-ai/sdk`、`@modelcontextprotocol/sdk`、`zod`）照 CLAUDE.md〈Claude Agent SDK / CLI〉：不要為了 audit 把它們升到 SDK 不支援的範圍；`@anthropic-ai/claude-agent-sdk`、`@anthropic-ai/claude-code`、`electron`、`@openai/codex*` 的版本本單不動（各有自己的升版流程）。"
  - "🔴 新增或改變**執行期**相依（main 端 require 的套件）時，照 CLAUDE.md〈Packaging / Release 前置檢查〉的安裝檔瘦身白名單與 `asar-runtime-deps` 測試處理。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
  - "ℹ️ 根目錄 `node_modules` 已於 2026-11-17 09:15 由 `npm ci` 重建（844 套件，Node v26.13.1、npm 12.2.2）。`site/` 是另一個 npm 專案，本單不處理。"
---

# T0873 — npm audit 51 項：評估並升級不會破壞的相依套件

## 元資料
- **工單編號**：T0873｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-17 09:17 (UTC+8)
- **規模**：L｜**依賴**：無｜**決策**：D297｜**來源**：使用者指示

## 背景
`npm ci` 後 `npm audit` 回報 51 項：critical 4、high 27、moderate 17、low 3。塔台摘要（以 Worker 重新執行的結果為準）：

- **可在現有版本範圍內修**（`fixAvailable` 不是 major）：大部分，含 direct 的 `electron-builder`（`^26.8.1`）、`vite`（`^7.0.0`）、`vitest`／`@vitest/ui`（`^4.1.5`）、`ws`（`^8.19.0`）、`js-yaml`、`dompurify`、`mermaid`；間接的 `proxy-addr`、`shell-quote`（critical）、`hono`、`undici`、`tmp`、`form-data`、`@modelcontextprotocol/sdk`、`zod` 等。
- **需要大版本**：
  - `simple-git` `^3.36.0` → 4.x（critical：`simple-git`、`@simple-git/argv-parser`），dependencies
  - `sharp` `^0.34.5` → 0.35.x（high），devDependency，只供 `scripts/generate-icons.js`（不打包，T0503）
  - `uuid` `^9.0.0` → 14.x（moderate），dependencies

## 任務
1. **基準**（改任何東西前）：記錄下列關卡的結果（通過數、失敗名稱），之後以此判斷「沒有變差」。
2. **非 major 修正**：`npm audit fix`（不加 `--force`）。檢視 `package.json`／`package-lock.json` 差異：列出 direct 套件的版本變化。跑關卡；有變差就找出是哪個套件，退回它（在 `package.json` 釘住或用 `overrides` 前先問塔台）。一個 commit。
3. **三個 major 逐一評估**（各自一個 commit，或不升）：
   - 先 grep 用法（檔案:行），讀該套件的 changelog／migration（只看官方 repo 或 npm 頁），判斷要不要改程式。
   - 升級＋必要的程式調整 → 跑關卡 → 全過才 commit；不過就退回並寫原因。
   - `uuid` 新版若只有 ESM：確認 main（vite 打包）、headless server bundle、helper scripts（若有用到）都還能載入。
   - `simple-git`：確認 BAT 用到的 API（git 狀態、worktree 等）行為不變；不得改變 `ct-worktree.ts` 等處 git 一律 `execFile` 的規則。
4. **最後**：`npm audit` 剩餘項目表（套件、嚴重度、為什麼沒修：需要 major 且本單不升／上游沒修／升了會壞）。

## 關卡（每一步都跑）
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit`、`npm run test:legacy`（與基準比較）
- `npx vite build`
- `npm run verify:helpers`
- `scripts/__tests__/asar-runtime-deps.test.mjs`（`test:unit` 內含；需先 `vite build`）
- server bundle：`scripts/build-server-bundle.mjs` ＋ `scripts/verify-server-bundle.js`（指令以 `package.json` scripts 為準）
- Windows 打包：`npm run build:dir` ＋ `scripts/verify-packaged-native.js`（參數看 docs `packaging-release-checks.md`）；`electron-builder` 版本有變時必跑，沒變時至少在最後跑一次
- 有升到 `electron-builder` 時：NSIS 範本檢查（見 memory_overrides）

## 驗收條件
- [x] 回報區有升級前基準與每一步的關卡結果
- [x] `npm audit` 前後數量（依嚴重度）與剩餘項目表
- [x] direct 套件版本變化表；三個 major 各自的判斷（升／不升與理由、改了哪些程式）
- [x] 所有關卡不比基準差；兩個 typecheck = 0
- [x] `npm ci` 在最終 lock 上 exit 0，install-scripts 警告只有 `electron-winstaller`（或與升級前相同）
- [x] `electron-builder` 版本有變時：NSIS 範本檢查結果，並註明發版前須跑 `windows-upgrade-acceptance.yml`
- [x] 有改到的版本說明同步更新 CLAUDE.md／docs（例如 vite、electron-builder 版號）
- [x] commit 只含本單範圍，不 push

## 收尾
- 塔台收單後與使用者決定 push 與是否需要 CI 驗收（`tests.yml`、`desktop-build.yml`、W6 等）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **結果**：DONE。`npm audit` 51 → 8（critical 4 → 0、high 27 → 0）；三個 major 都升級；每一步的關卡都不比基準差，兩個 typecheck = 0。
- **session_id**：9d952488-dc19-473c-86e4-c03a9d55e941
- **開始／完成**：2026-11-17 09:18 → 09:59（UTC+8）

### 落點檢查
- **PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1：工單在 REPO_ROOT 下。C-3：`package.json`／`package-lock.json` 存在。C-2：工單沒有 `branch` 欄位，目前在 `main`。
- `CT_HOME` 未設（不在 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只作紀錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 環境與驗證方式
- Node v26.13.1、npm 12.2.2、Windows x64。
- **server bundle**：這台 Windows 主機上，`build-server-bundle.mjs` 只能打 `linux-x64`、`linux-arm64`、`darwin-arm64`，但 `@lydell/node-pty-linux-x64` 與 `@anthropic-ai/claude-code-linux-x64` 不會被安裝。做法：用 `npm pack` 下載 lock 釘選的版本（1.1.0、2.1.316），只在 server bundle 這一步解壓進 `node_modules`，跑完就刪掉。lock 沒有因此改變。
  - ⚠️ 中途發現，這兩個套件留在 `node_modules` 時，`build:dir` 會把 linux 版 `claude`（328 MB）也打進 Windows 的 `app.asar.unpacked`。`verify-packaged-native` 抓不到這件事。基準與 s2 第一次 `build:dir` 都有這個污染；之後的 gate 腳本在打包前會先刪掉這兩個套件，s2b、s3sg、s3sharp 的打包都是乾淨的。這是本機驗證方式造成的，不是產品問題。
- **單元測試的計數**：用 vitest `--reporter=json` 統計。

### 基準（改動前，HEAD `af141f7a`）
| 關卡 | 結果 |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run typecheck:electron` | exit 0 |
| `npx vite build` | exit 0 |
| `npm run verify:helpers` | exit 0 |
| `test:unit` | 8396 個測試：8294 passed / **1 failed** / 101 skipped，9 個檔案標 failed。原因是並行負載下的 `Hook timed out in 10000ms`：`headless-blocked-state-e2e`、`headless-close-worker-e2e`、`headless-helper-narrowing`、`headless-remote-tower-e2e`，以及 `local-helper-capability`、`terminal-query-handlers`、`tower-questions` 的 beforeAll，另有 `helper-connection-hygiene` 的 #9。這 8 個檔案單獨重跑：**176/176 passed**，判定為 flaky。 |
| `test:legacy` | 33 檔／472 tests 全過 |
| server bundle `linux-x64` ＋ `verify-server-bundle` | 皆 exit 0 |
| `build:dir` ＋ `verify-packaged-native --platform win --arch x64` | 皆 exit 0（✅ every windows package passed） |
| lock 中有 install script 的套件 | `@anthropic-ai/claude-code`、`electron-winstaller`、`esbuild`、`fsevents`×3、`sharp`、`tsx/node_modules/esbuild` |

### 每一步的關卡結果
| 步驟（commit） | typecheck／electron | vite | helpers | test:unit | test:legacy | server bundle | build:dir＋verify-packaged-native |
|---|---|---|---|---|---|---|---|
| ② audit fix＋vitest（第一次跑） | 0／0 | ✅ | ✅ | 2 failed：版本守門測試，見下 | 472 ✅ | 第一次失敗（`npm audit fix` 把手動放的 linux 套件 prune 掉），補回後 ✅ | ✅ |
| ② 修守門測試後重跑（s2b，`d215ae93`） | 0／0 | ✅ | ✅ | 8354 passed / **0 failed** / 42 skipped | 472 ✅ | ✅ | ✅ |
| ③-1 simple-git（`e74cf969`） | 0／0 | ✅ | ✅ | 8354 passed / 0 failed | 472 ✅ | ✅ | ✅ |
| ③-2 uuid（`69d872ad`） | 0／0 | ✅ | ✅ | 8354 passed / 0 failed | 472 ✅ | ✅ | 未跑（electron-builder 沒變，留到最後一步） |
| ③-3 sharp（`103239ff`，最後一步） | 0／0 | ✅ | ✅ | 8354 passed / 0 failed | 472 ✅ | ✅ | ✅ |

- `asar-runtime-deps.test.mjs` 包含在 `test:unit` 裡，每一步都在 `vite build` 之後執行，都通過。
- 最終 lock 的 `npm ci`：exit 0（added 745 packages）。install-scripts 警告只有 `electron-winstaller@5.4.0`。另有一行 `.npmrc allow-scripts setting is being ignored`，來源是使用者層的 `.npmrc`，跟本單無關。
- lock 中有 install script 的套件：少了 `sharp`（0.35 起沒有 install script）與 `tsx/node_modules/esbuild`（被 dedupe），**沒有新增任何套件**。

### npm audit 前後
| 嚴重度 | 前 | ②後 | ③-1 simple-git 後 | 最終 |
|---|---|---|---|---|
| critical | 4 | 2 | 0 | **0** |
| high | 27 | 1 | 1 | **0** |
| moderate | 17 | 7 | 7 | **6** |
| low | 3 | 2 | 2 | **2** |
| 合計 | 51 | 12 | 10 | **8** |

- ② 一欄是 `npm audit fix` 加上 vitest 升級後的數字；只跑 `npm audit fix` 時是 15。

### direct 套件版本變化
| 套件 | 前 | 後 | 步驟 |
|---|---|---|---|
| electron-builder（app-builder-lib） | 26.8.1 | 26.18.0 | ② |
| vite | 7.3.2 | 7.3.8 | ② |
| vitest／@vitest/ui | 4.1.5 | 4.1.12（`package.json` 範圍改 `^4.1.12`） | ②；`npm audit fix` 沒有升它，`@vitest/mocker` 要到 4.1.12 才修好，所以另外 `npm install -D` |
| ws | 8.20.0 | 8.23.0 | ② |
| js-yaml | 4.1.1 | 4.3.2 | ② |
| dompurify | 3.4.0 | 3.4.18 | ② |
| mermaid | 11.14.0 | 11.17.2 | ② |
| simple-git | 3.36.0 | **4.1.0** | ③-1 |
| uuid | 9.0.1 | **14.0.3** | ③-2 |
| @types/uuid | 9.x | **移除**（uuid 14 自帶型別） | ③-2 |
| sharp | 0.34.5 | **0.35.5** | ③-3 |

- 沒動的套件：`@anthropic-ai/claude-agent-sdk` 0.3.316、`@anthropic-ai/claude-code` 2.1.316、`electron` 45.2.1、`@openai/codex*` 0.166.0。
- SDK 的 peer 依賴：`@anthropic-ai/sdk` 維持 1.3.0；`@modelcontextprotocol/sdk` 1.29.0 → 1.32.2、`zod` 4.3.6 → 4.6.7，都在 SDK 的 peer 範圍內（`^1.29.0`、`^4.0.0`）。
- 間接套件的重點：`shell-quote` 1.8.3 → 1.12.0、`proxy-addr` 2.0.7 → 2.0.8、`undici` 7.25.0 → 7.30.2、`hono` 4.12.14 → 4.13.19。`@hono/node-server` 1.19.14 → 2.1.8：MCP SDK 宣告的範圍是 `^1.19.9 || ^2.0.5`，既有的 `overrides` `>=1.19.13` 也允許，而且它是 peer 樹的一部分，不會被打包（T0782）。
- 沒有新增執行期依賴：simple-git 4 已由 rollup 打包進 `dist-electron/main-*.js`，沒有外部 `require("simple-git")`；asar 白名單不用改。

### electron-builder 26.8.1 → 26.18.0：NSIS 範本檢查
- 比對方式：從 npm 取 `app-builder-lib@26.8.1`，與 26.18.0 的 `templates/nsis` 做 `diff -r`。只有 `include/allowOnlyOneInstallerInstance.nsh` 與 `multiUser.nsh` 不同。
  1. `!ifmacrondef customCheckAppRunning` → `!include "getProcessInfo.nsh"`／`Var pid`，以及 `!ifmacrodef customCheckAppRunning` → `!insertmacro customCheckAppRunning`：原文都沒變。
  2. 定義 `customCheckAppRunning` 時，範本仍然會跳過 `getProcessInfo.nsh` 與 `Var pid`。
  3. `IS_POWERSHELL_AVAILABLE`、`_CHECK_APP_RUNNING`、`FIND_PROCESS _FILE _RETURN` 的名稱與參數都沒變；`$(appRunning)`／`$(appClosing)` 仍在 `messages.yml`。範本的差異：
     - PowerShell 呼叫多了 `-NoProfile -NonInteractive`。
     - 沒有 PowerShell 時，`FIND_PROCESS` 從 `nsProcess::FindProcess` 改成 `tasklist … | findstr /B /I` 精確比對；回傳 `0` 仍然代表找到。`build/installer.nsh` 兩處 `FIND_PROCESS` 的語意不變。
     - 範本拿掉的 `$FindPath`，`installer.nsh` 本來就沒用到。
  4. 與 6. `installSection.nsh`、`uninstaller.nsh`、`include/installUtil.nsh`（`--updated`）沒有任何差異。`multiUser.nsh` 只改了 per-user `UserProgramFiles` 的取得方式。
  5. 本機 `npx vite build` 後執行 `npx electron-builder --win nsis --x64 --publish never`，exit 0；`builder-debug.yml` 有 `!include "…\build\installer.nsh"`。安裝檔 356,433,628 bytes（本機 0.7.4-pre.9 為 341,738,302）。內層 7z 從 `LZMA2:26 LZMA:20 BCJ2` 變成 `BCJ LZMA2:26`（solid、`Blocks = 2`），這是上游 #9983 新增的 `installTimeDecodable` → `-mf=BCJ`。**沒有在 Windows runner 實測**：本單不觸發 workflow。
- 🔴 **發版前須跑 `windows-upgrade-acceptance.yml`**（W6），由塔台安排。
- 守門測試配合新版本更新：
  - `electron/__tests__/installer-quit-request.test.ts`：版本 26.8.1 → 26.18.0，其他斷言不變，對新範本全部通過。
  - `scripts/__tests__/server-bundle-helpers.test.mjs` 的 T0726 測試：上游把格式判斷移到 `isZipPayload` getter、壓縮參數改由 `createAppPackageArchiveOptions` 產生。測試改成斷言新的形狀，並直接呼叫 getter 確認我們的設定得到 `false`；`-mx=9`、沒有 `-ms=off`、沒有 `-md=` 等斷言保留。
  - 文件與 docs 的規定是 runner 實測完才改版本號；本單在本機核對後就改了，原因寫在測試註解與 docs。

### 三個 major 的判斷
- **simple-git 3.36.0 → 4.1.0：升級**（修掉 critical GHSA-x6jw-m9v5-85vh、GHSA-v5rq-49vh-5v5c，以及 high GHSA-g4wm-2vf7-vfgr、GHSA-858h-whjf-mvg5）
  - 用到的地方：只有 `electron/git/git-ipc.ts`，也就是 Git Graph 面板的 `git-scaffold:*`。呼叫的是唯讀的 `checkIsRepo`、`revparse`、`branch`、`getRemotes`、`raw(['log', …])`，參數全是完整的長選項名稱。`ct-worktree.ts`、`worktree-manager.ts` 照舊一律用 `execFile`，沒有改。
  - 資料來源：官方 `docs/RELEASE-NOTES-V4.md` 與套件原始碼 `dist/index.cjs`、`@simple-git/argv-parser` 3.0.0。
    - 移除了 default export。
    - 擋縮寫選項。
    - 新增 environment guard：每次 spawn 都會把繼承來的 `GIT_*` 與 EDITOR／PAGER／VISUAL／PREFIX／SSH_ASKPASS 等 key 從子程序 env 移除；這些 key 如果經 `.env()` 傳入，會直接 throw。
    - `binary` 驗證與 v3 相同（`allowUnsafeCustomBinary`）。
  - 程式調整：
    - `git-ipc.ts` 改用具名 import `simpleGit`。
    - `SIMPLE_GIT_UNSAFE_ENV_KEYS` 補上 `visual`、`git_config_parameters`。
    - 新增 `isSimpleGitGuardedEnvKey`（`git_` 前綴＋上述 key），`stripSimpleGitUnsafeEnv` 改用它，否則 headless 傳入的 server env 只要帶 `GIT_DIR` 或 `GIT_CONFIG_KEY_0`，v4 就會 throw。
    - 兩個測試（`git-scaffold-env.test.ts`、`headless-git.test.ts`）的 mock 改成具名 export，期望值跟著改：`GIT_DIR` 等 `GIT_*` 現在也會被去掉；`HOME` 只有 `recommended` 等級，v4 預設不執行。
  - ⚠️ **行為差異**：Git Graph 面板的 git 子程序不再看到 BAT 啟動環境裡的 `GIT_*`／EDITOR／PAGER 等變數。Electron 端原本完整繼承，現在由 simple-git 4 自己移除，本單沒有用 `allowEnvironment` 放寬。一般環境下（沒設這類變數），repo 偵測、branch、remotes、log 的結果不變（真 git 測試全過）。如果使用者靠 `GIT_DIR`、`GIT_CONFIG_*` 之類的 env 讓 Git Graph 讀到不同的 repo 或設定，結果會不同。其他 git 路徑（`git:*`、`worktree:*`、ct-worktree）不受影響。
- **uuid 9.0.1 → 14.0.3：升級**（GHSA-w5hq-g745-h8pq）
  - 用到的地方：只有 `src/stores/workspace-store.ts:1`（`v4()`，renderer，由 vite 打包）。
  - uuid 14 只有 ESM，並自帶型別，所以移除 `@types/uuid`。
  - main、headless server bundle、helper scripts 都沒用到 uuid（grep 確認）。server bundle 與 `verify-server-bundle` 都通過。
  - `typecheck` = 0，`src/stores` 的 21 個測試檔全過。mermaid 本來就帶 uuid 14，現在 dedupe 成同一份。
- **sharp 0.34.5 → 0.35.5：升級**（libvips／libheif／librsvg 的 3 則 high）
  - 用到的地方：只有 `scripts/generate-icons.js`（devDependency，不打包，T0503），API 只用了 `resize`／`png`／`toFile`。
  - 在 repo 外的副本以 `NODE_PATH` 執行，0.34.5（vips 8.17.3）與 0.35.5（vips 8.18.7）都輸出 `All icons generated successfully!`。
    - `icon-64`、`icon-128`、`icon-256`、`icon-512`、`icon.png`、`icon.ico` 位元組相同。
    - `icon-16`、`icon-32`、`icon-48` 位元組不同，但解碼後的像素**完全相同**（差異 0），只有 PNG 編碼不同。
  - 0.35 沒有 install script 了。`allowScripts` 的 `sharp` 項目因此沒有作用，但那是政策，本單沒改，留給塔台決定（docs 已註記）。

### npm audit 剩餘項目
| 套件 | 嚴重度 | 為什麼沒修 |
|---|---|---|
| `minimatch`（`@electron/universal@2.0.3` → `minimatch@9.0.9`；GHSA-g3hv-75wg-m249，範圍 `>=7 <11.0.1`） | moderate | 上游 electron-builder 26.18.0 仍依賴它。npm 的 fixAvailable 是「降到 electron-builder 25.1.0（major）」，不可行。要修只能加 `overrides`，例如 `minimatch@9` → 11.x 跨 major，依本單規定須先問塔台，所以沒做。 |
| `@electron/universal`、`app-builder-lib`、`dmg-builder`、`electron-builder`、`electron-builder-squirrel-windows` | moderate | 都是上面那個 minimatch 傳遞上來的同一則（`@electron/universal` 只用在 mac universal 打包，本專案 mac 只打 arm64）。 |
| `katex`（GHSA-238p-pmpm-9mq7）→ `mermaid` | low | 需要 mermaid 12（major），不在本單三個 major 之內，只評估、不升。 |

### 變更檔案
- `package.json`、`package-lock.json`
- `electron/git/git-ipc.ts`
- `electron/__tests__/git-scaffold-env.test.ts`、`electron/remote/__tests__/headless-git.test.ts`
- `electron/__tests__/installer-quit-request.test.ts`、`scripts/__tests__/server-bundle-helpers.test.mjs`
- `CLAUDE.md`（「Electron Runtime」節的 electron-builder 那一行）
- `docs/agent-guide/packaging-release-checks.md`、`docs/agent-guide/upgrade-interruption.md`、`docs/agent-guide/build-toolchain.md`、`docs/agent-guide/npm12-install-scripts.md`
- 範圍說明：測試檔的修改都是 major 或 electron-builder 升級的必要調整，在 `electron/**`、`scripts/**` 的允許範圍內。

### Commit
- `d215ae93` chore(deps): npm audit fix within ranges, vitest 4.1.12 (T0873)
- `e74cf969` chore(deps): simple-git 4.1.0 (T0873)
- `69d872ad` chore(deps): uuid 14.0.3, drop @types/uuid (T0873)
- `103239ff` chore(deps): sharp 0.35.5 (T0873)
- 工單本身另外一個 commit。都**沒有 push**，也沒有觸發任何 workflow。

### 遭遇問題
- `npm audit fix` 會 prune 手動放進去的 linux 平台套件，server bundle 第一次因此失敗；補回後通過（見〈環境與驗證方式〉）。
- 基準的 `test:unit` 有並行負載造成的 timeout flaky（見基準表）；改動後的四次全量執行都是 0 failed。

### 建議後續（給塔台）
1. 🔴 發版前跑 `windows-upgrade-acceptance.yml`（electron-builder 26.18.0、NSIS 內層 7z 改用 BCJ），以及 `desktop-build.yml` 三平台打包，確認 mac／linux 用 26.18.0 也能打。
2. 決定 `allowScripts` 的 `sharp` 項目要不要拿掉（0.35 起沒有作用）。
3. 決定是否以 `overrides` 處理 `minimatch@9`（moderate，electron-builder 的打包工具鏈），以及 mermaid 12 升級（katex low）是否另開工單。
4. 可考慮另開 BUG／工單：本機在 Windows 打 linux server bundle 的驗證方式會污染 `build:dir`（`verify-packaged-native` 沒有擋「Windows 包內出現其他平台的 `claude-code-*` 平台套件」；目前的 `duplicate-claude` 只看 win32 的副本）。

### 互動紀錄
- 無（yolo；沒有向塔台提問）。
