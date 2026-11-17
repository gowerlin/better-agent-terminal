---
schema_version: 1
schema_kind: workorder
id: T0873
title: "npm audit 51 項：評估並升級不會破壞的相依套件"
type: implementation
status: PENDING
created_at: "2026-11-17T09:17:27+0800"
started_at: ""
updated_at: "2026-11-17T09:17:27+0800"
completed_at: ""
session_ids: []
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
- **工單編號**：T0873｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-17 09:17 (UTC+8)
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
- [ ] 回報區有升級前基準與每一步的關卡結果
- [ ] `npm audit` 前後數量（依嚴重度）與剩餘項目表
- [ ] direct 套件版本變化表；三個 major 各自的判斷（升／不升與理由、改了哪些程式）
- [ ] 所有關卡不比基準差；兩個 typecheck = 0
- [ ] `npm ci` 在最終 lock 上 exit 0，install-scripts 警告只有 `electron-winstaller`（或與升級前相同）
- [ ] `electron-builder` 版本有變時：NSIS 範本檢查結果，並註明發版前須跑 `windows-upgrade-acceptance.yml`
- [ ] 有改到的版本說明同步更新 CLAUDE.md／docs（例如 vite、electron-builder 版號）
- [ ] commit 只含本單範圍，不 push

## 收尾
- 塔台收單後與使用者決定 push 與是否需要 CI 驗收（`tests.yml`、`desktop-build.yml`、W6 等）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
