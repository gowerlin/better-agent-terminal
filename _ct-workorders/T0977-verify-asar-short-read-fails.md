---
schema_version: 1
schema_kind: workorder
id: T0977
title: "`verify-packaged-native.js` 讀 app.asar 時檢查 `fs.readSync` 回傳的位元組數：讀不足判失敗，不再把缺的部分當成 NUL 內容"
type: bugfix
status: IN_PROGRESS
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-28T18:01:29+08:00"
started_at: "2026-11-28T18:04:05+08:00"
updated_at: "2026-11-28T18:04:05+08:00"
session_ids:
  - "d425e529-442e-47de-be15-de60677580d3"
target_version: "下一個預覽版（`0.8.1-pre.6`，發版前與使用者確認）"
depends_on: []
related:
  - "T0924（BUG-223 根因調查，回報區〈遭遇問題〉後續建議）；D516（U-72：A）"
affects_files:
  - _ct-workorders/T0977-verify-asar-short-read-fails.md
  - scripts/verify-packaged-native.js
  - scripts/__tests__/verify-packaged-native.test.mjs
  - docs/agent-guide/packaging-release-checks.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0977` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 已知事實（T0924 回報區）：`scripts/verify-packaged-native.js` 的 `readAsar`（約 385 行）讀 8 bytes 大小欄位與 header、`readAsarFile`（約 426 行）以 `fs.readSync(fd, buf, 0, node.size, asar.dataOffset + Number(node.offset))` 讀檔內容，三處都不看回傳值；檔案被截斷時 `Buffer.alloc` 的 NUL 被當成內容傳回（BUG-223 的 CI 失敗就是 13 個 `\\u0000`），錯誤訊息會誤導成 JSON 解析或內容不符。第 195 行附近另一個 `readSync` 已有 `const n = …`，請一併確認它有沒有用 n。"
  - "🔴 修法：每個 `readSync` 讀到的位元組數 < 要求的長度 → 拋出 / 回報明確錯誤（訊息含檔名或 asar 內路徑、期望與實際位元組數），由呼叫端照既有方式判該檢查失敗。只能讓檢查變嚴：🔴 不得以略過、重試、吞掉錯誤或改弱任何既有斷言處理；完整的 asar 判定結果不變。可視需要抽一個小 helper（例 `readExactSync`），只在本檔使用。"
  - "🔴 測試（`scripts/__tests__/verify-packaged-native.test.mjs`）：新增 ① 截斷的 app.asar（檔案內容區被切掉）→ `readAsarFile` 失敗且訊息含期望 / 實際位元組數；② header 被截斷 → `readAsar` 失敗；③ 既有「reads an app.asar written by @electron/asar」等案例照舊通過（不改斷言）。修正前 ① 應該讀到 NUL 而不報錯（在回報區附修正前後對照）。"
  - "🔴 不回歸：`verifyPackagedWin` / mac / linux 的各檢查項（`runtime-require`、`helper-version`、`helper-scripts`、`foreign-platform-package`、`whisper-runpath`、`appimage-launcher`、`win-stdio-inherit` 等）判定不變；`asar-runtime-deps.test.mjs`、`verify-packaged-foreign-platform.test.mjs` 照舊通過。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。可選：以既有打包產物（若 worktree 有）跑一次 `node scripts/verify-packaged-native.js` 確認仍 PASS；沒有就寫明未跑。"
  - "🔴 文件：`docs/agent-guide/packaging-release-checks.md` 打包產物檢查一節補一句「讀 asar 讀不足判失敗」；CLAUDE.md 不改（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0977 — 讀 app.asar 讀不足時判失敗

## 背景

T0924 調查 BUG-223 時發現：`verify-packaged-native.js` 讀 app.asar 不檢查 `fs.readSync` 回傳的位元組數，檔案被截斷時會把缺的部分讀成 NUL、不報錯。BUG-223 本身是測試競態（已修），但打包檢查遇到真的截斷的安裝包時，錯誤訊息會指向錯的地方。使用者 2026-11-28 裁示開單（U-72：A，D516）。

## 範圍

- `readAsar` / `readAsarFile`（及同檔其他讀 asar 的 `readSync`）讀不足判失敗。
- 單元測試（截斷的內容區、截斷的 header）、文件一句。

## 不做

- 不改任何檢查項的判定標準；不改 `@electron/asar` 或打包設定；不發版。

## 驗收

- [ ] 截斷 asar 的測試修正前讀到 NUL、修正後失敗且訊息含期望 / 實際位元組數
- [ ] 既有測試斷言未改、全部通過；〈相關通過案例〉判定
- [ ] `npm run test:unit` head 第一次全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] docs 更新

---

## 回報區

（Worker 填寫）
