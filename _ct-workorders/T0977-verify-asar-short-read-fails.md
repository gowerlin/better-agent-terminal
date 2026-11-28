---
schema_version: 1
schema_kind: workorder
id: T0977
title: "`verify-packaged-native.js` 讀 app.asar 時檢查 `fs.readSync` 回傳的位元組數：讀不足判失敗，不再把缺的部分當成 NUL 內容"
type: bugfix
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-28T18:01:29+08:00"
started_at: "2026-11-28T18:04:05+08:00"
updated_at: "2026-11-28T18:08:29+08:00"
completed_at: "2026-11-28T18:08:29+08:00"
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

- [x] 截斷 asar 的測試修正前讀到 NUL、修正後失敗且訊息含期望 / 實際位元組數
- [x] 既有測試斷言未改、全部通過；〈相關通過案例〉判定
- [x] `npm run test:unit` head 第一次全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [x] docs 更新

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-28T18:08:29+08:00
- **session_id**：d425e529-442e-47de-be15-de60677580d3
- **branch**：`ct/T0977`
- **base_sha**：`80d96e25ee407768f204cd6d3efda7172106e5bc`
- **validated_sha**：`8c728d16de483c1485f75a7a9e499948cd7eb221`
- **head_sha**：`8c728d16de483c1485f75a7a9e499948cd7eb221`（與 validated_sha 相同；可 `--ff-only` 判斷交塔台）

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 之下 → PASS
- C-3：`scripts/verify-packaged-native.js`、`scripts/__tests__/verify-packaged-native.test.mjs`、`docs/agent-guide/packaging-release-checks.md` 皆存在 → PASS（C-0 已 PASS，僅記錄）
- C-2：工單無 `branch` 欄位，不適用；目前分支 `ct/T0977`
- `CT_HOME` = 主 checkout；`CT_WORKTREE_BRANCH` = `ct/T0977`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`BAT_REMOTE_TOKEN` 已設定；`CT_MODE` = `yolo`

### 結果摘要

- 新增 `readExactSync(fd, buf, length, position, what)`（只在 `scripts/verify-packaged-native.js` 使用）：迴圈讀到 `length` bytes，`fs.readSync` 回 0（EOF）時仍不足 → 拋出 `"<what>: short read at offset <pos>: expected <length> bytes, got <實際> (truncated app.asar?)"`。迴圈只在 `readSync` 還有回傳位元組時繼續（短讀但未到 EOF 的正確讀法），EOF 不重試、不吞錯。
- `readAsar`：8 bytes 大小欄位（`app.asar header size`）與 header（`app.asar header`）都改用 `readExactSync`。
- `readAsarFile`：packed 檔內容改用 `readExactSync`，`what` = `app.asar <asar 內路徑>`；unpacked 檔照舊 `readFileSync`、讀不到回 null（行為不變）。
- 呼叫端照既有方式判失敗：`verifyPackagedLayout` 原本 `readAsar` 失敗就推 `{ id: 'runtime-require', message: 'cannot read app.asar', details: ['<asarPath>: <err.message>'] }`；抽成 `asarReadProblem(err)`，另用於 ① `verifyRuntimePackages`（C4 掃描讀到截斷的 dist-electron / package.json）拋錯 → 該 problem、`runtime = null`；② `asarAppVersion`（app package.json 截斷）拋錯 → 該 problem，`helper-version` 改以「讀不到 app 版本」的既有規則只查檔案本身。修正前這兩處拋錯會讓整支 CLI 直接以未捕捉例外結束（其他檢查都不跑），現在其他檢查照常執行、結果 exit 1。
- 第 195 行 `readHeader`：已有 `const n = …` 並 `buf.subarray(0, n)`，用途是讀二進位檔頭（Mach-O / ELF / PE），檔案比 `HEADER_BYTES` 短是合法情況、由 `machOCpuTypes` 等以長度判斷；不是讀 asar，未改。
- 完整 asar 的判定結果不變（見下方真實產物對照）；沒有改任何既有斷言。

### 修正前後對照（同一個被截掉 7 bytes 的 asar：`a.txt`=`hello`、`b.js`=`require("ws")` 13 bytes）

| | 修正前（`HEAD~1`） | 修正後 |
|---|---|---|
| `readAsarFile(b.js)` | 回傳 `"requir\u0000\u0000\u0000\u0000\u0000\u0000\u0000"`，不報錯 | 拋 `app.asar b.js: short read at offset 97: expected 13 bytes, got 6 (truncated app.asar?)` |
| header 截到 12 bytes 後 `readAsar` | `Unexpected end of JSON input`（誤導成 JSON 解析） | 拋 `app.asar header: short read at offset 8: expected 84 bytes, got 4 (truncated app.asar?)` |

（對照腳本放在 scratchpad，以 `git show HEAD~1:scripts/verify-packaged-native.js` 的暫存複本執行，跑完即刪，worktree 未留檔。）

### 變更檔案

- `scripts/verify-packaged-native.js`：`readExactSync`、`readAsar` / `readAsarFile` 改用它、`verifyPackagedLayout` 捕捉 C4 / app 版本讀取錯誤（`asarReadProblem`）
- `scripts/__tests__/verify-packaged-native.test.mjs`：新增 `describe('truncated app.asar (T0977)')` 5 個案例（packed 內容被截 → 訊息含檔名與 expected 13 / got 6；檔案整段在 EOF 之後 → got 0；header 截斷與大小欄位截斷 → `readAsar` 失敗；runtime 套件 package.json 被截 → `runtime-require`「cannot read app.asar」且 CLI exit 1；app package.json 被截 → `runtime-require`、`helper-version` 不連帶失敗）；import 多 `truncateSync`
- `docs/agent-guide/packaging-release-checks.md`：「三平台共同的瘦身檢查」補一句讀不足判 `runtime-require` 失敗（`readExactSync`）
- CLAUDE.md 未改（T0595）

### 驗證

- `npm ci`（worktree）：exit 0
- `npx vite build`：exit 0
- `npm run typecheck`：exit 0（0 錯誤）；`npm run typecheck:electron`：exit 0（0 錯誤）
- `npm run test:unit`（head `8c728d16` 第一次完整執行，vite build 之後，含 `asar-runtime-deps.test.mjs`、`verify-packaged-foreign-platform.test.mjs`）：Test Files 533 passed | 3 skipped（536）；Tests 9638 passed | 42 skipped（9680）；exit 0
- `npm run test:legacy`：files 33 passed, 0 failed / 33；tests 472 passed, 0 failed；exit 0
- 單檔 `verify-packaged-native.test.mjs`：103 passed（含新增 5 案例）
- 既有「reads an app.asar written by @electron/asar」案例照舊通過，斷言未改
- 可選的真實產物執行：worktree 沒有 `release/`；以主 checkout 既有的 `release/win-unpacked`（0.7.5-pre.1，app.asar 16,058,883 bytes，唯讀）對修正前 / 後各跑一次 `--platform win --arch x64 --skip-load-check`：兩者 exit 1、輸出逐字相同（`diff` 無差異）。exit 1 是該舊包缺 T0887 之後才有的 `dist-electron/shared-conout-worker.cjs` 與 holder manifest 不符，與本單無關；重點是 16 MB 的真實 @electron/asar 檔案以 `readExactSync` 完整讀取、沒有誤報短讀。未加 `--skip-load-check` 的載入檢查（會執行打包的 exe）未跑。

### 相關通過案例判定

- 工單無〈相關通過案例〉一節；本單只改打包後檢查腳本（CI / 本機打包流程），不影響 app 執行期功能，不涉及客戶驗收案例。各檢查項（`runtime-require`、`helper-version`、`helper-scripts`、`foreign-platform-package`、`whisper-runpath`、`appimage-launcher`、`win-stdio-inherit`、`pty-holder` 等）對完整 asar 的判定不變：既有 98 個案例全數通過、真實產物前後輸出相同。

### 遭遇問題

- 無。第一次 `check-frontmatter.py` 路徑未轉 `cygpath -m`（R-G005 第 2 點）exit 2，改正後 PASS，與產品無關。

### Commit

- 產品（worktree `ct/T0977`）：`8c728d16` fix(T0977): verify-packaged-native fails on a short app.asar read instead of reading NULs
- 工單（主 checkout）：`6750391b` chore: T0977 start (ct)；收單 commit 見本檔後續提交
- 未 push、未觸發 workflow、未建 tag

### 後續建議

- 無必要後續。

### 互動紀錄

- [18:04] 開工，`CT_MODE=yolo`；無提問、無塔台補充段落。
