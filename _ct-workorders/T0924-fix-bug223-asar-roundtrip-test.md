---
schema_version: 1
schema_kind: workorder
id: T0924
title: "BUG-223：`verify-packaged-native.test.mjs`〈reads an app.asar written by @electron/asar〉偶發讀到全 NUL —— 查根因並修，讓 CI Test gate 不再偶發失敗"
type: bugfix
status: FIXED
repo: better-agent-terminal
project: BUG-223
priority: P2
sizing: S
created_at: "2026-11-25T21:38:19+08:00"
started_at: "2026-11-25T21:39:31+08:00"
updated_at: "2026-11-25T21:51:22+08:00"
completed_at: "2026-11-25T21:51:22+08:00"
session_ids:
  - "8be0b064-f8a6-4f6b-921b-e3bb96cc4edc"
target_version: "0.8.0-pre.4"
depends_on: []
related:
  - "BUG-223；desktop-build run `45621864786` job `139231964283`（`tests` → `Unit tests (vitest)`）；T0546（測試來源）；BUG-218 / BUG-219（同類測試穩定度單的寫法）"
affects_files:
  - _ct-workorders/T0924-fix-bug223-asar-roundtrip-test.md
  - scripts/__tests__/verify-packaged-native.test.mjs
  - scripts/verify-packaged-native.js
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0924` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。與 T0923（`e2e/manual/`、`e2e/fixtures/`）平行，不得碰那兩處。"
  - "🔴 根因優先：先判斷是測試寫法（例：`createPackageWithOptions` 回傳時資料尚未寫完、暫存目錄被並行測試清掉 / 重用）還是 `scripts/verify-packaged-native.js` 的 `readAsar` / `readAsarFile`（第 385–440 行附近）讀取邏輯有錯（例：offset / 對齊 / 讀到未寫完的檔）。讀 `node_modules/@electron/asar`（lock `3.4.1`）的寫入流程佐證。若是產品檢查程式（`verify-packaged-native.js`）的錯，修正後打包產物檢查的判定不得放寬（🔴 不得以略過、重試吞掉錯誤、或改弱斷言當作修正）。若只能證明是測試競態，修測試本身（例：等寫入真正完成、每個測試用獨立暫存目錄），斷言內容不變。"
  - "🔴 重現：先試著在本機重現（同一測試連跑多次，例 `npx vitest run scripts/__tests__/verify-packaged-native.test.mjs -t 'reads an app.asar' --repeat` 或迴圈 100 次以上；可行時也在 WSL / Linux 跑）。重現不到時寫明嘗試次數與環境，依讀碼證據修，並說明為何修正能排除該路徑。"
  - "🔴 驗證：worktree `npm ci`；修正後該測試檔連跑 ≥ 100 次全過（附次數）；`npm run test:unit` 在 head 第一次完整執行全綠（附 passed / files 數）；`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0。改到 `verify-packaged-native.js` 時另跑 `node scripts/verify-packaged-native.js --help` 或其單元測試全檔確認行為不變。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0924 — BUG-223：asar 往返測試偶發讀到全 NUL

## 背景

PLAN-069 驗收版打包（desktop-build run `45621864786`，`main` `402c9648`）的 `tests` job 有一個失敗：`scripts/__tests__/verify-packaged-native.test.mjs` › `verifyPackagedWin (T0546)` › `reads an app.asar written by @electron/asar (packed and unpacked files)`，第 984 行 `readAsarFile(archive, 'node_modules/ws/package.json')` 讀到 `\u0000…`（第 983 行檔案清單正確）。其餘 9059 個測試通過。該測試檔與 `verify-packaged-native.js` 自 T0887 起沒改，`v0.8.0-pre.3` CI 通過。發版 workflow 的 Test gate（T0686）遇到會擋發版，使用者裁示在 `0.8.0-pre.4` 前修（U-8：A）。

## 驗收

- [ ] 根因（測試競態或讀取邏輯），附證據（讀碼位置、重現結果）
- [ ] 修正不放寬任何檢查、不改斷言內容
- [ ] 該測試檔連跑 ≥ 100 次全過；`npm run test:unit` head 第一次全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] BUG-223 的處置建議寫在回報區（塔台改 BUG 狀態）

---

## 回報區

### 完成狀態

- **狀態**：FIXED（測試競態已修，等 CI Test gate 實際跑過確認）
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`；C-1 工單在 `$CT_HOME/_ct-workorders/` 下；C-3 兩個產品檔都存在；C-2 無 `branch` 欄位。`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0924`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **session_id**：8be0b064-f8a6-4f6b-921b-e3bb96cc4edc

### 根因

**根因在測試，不在產品檢查程式。** `@electron/asar` 3.4.1 的 `createPackageWithOptions` 回傳時，資料還沒寫完。

- 讀碼證據（`node_modules/@electron/asar/lib/disk.js`）：
  - `createFilesystemWriteStream`（第 193–207 行）用 write callback **等** header 寫完。所以檔案清單永遠正確，對應 CI 第 983 行通過。
  - `streamTransformedFile`（第 60–66 行）在**來源**讀取串流 `end` 時就 resolve。這時資料只是交給了 `out.write()`，`fs.write` 可能還在 threadpool 裡沒做完。
  - `writeFileListToStream` 最後是 `return out.end()`（第 85 行），沒有等 `finish` / `close`。`Writable.end()` 回傳串流本身，所以 `createPackageWithOptions` resolve 的值就是那個**尚未寫完**的 `WriteStream`。
- 為什麼偏偏是 `node_modules/ws/package.json`：檔案依序處理為 `dist-electron/main.js` → `native/addon.node`（unpack，`copyFile` 有 await）→ `node_modules/ws/package.json`。ws 是最後一個打包進 asar 的檔，它的 `fs.write` 要和來源的 EOF 讀取在 threadpool 裡競速。CI runner 負載高時寫入較慢，測試立刻以 `readAsarFile` 讀到檔尾還沒寫入的區段。`readSync` 讀到 0 bytes，`Buffer.alloc` 的初值就是 13 個 `\u0000`，與 CI 失敗內容一致（長度 13 = `{"name":"ws"}`）。
- `scripts/verify-packaged-native.js` 的 `readAsar` / `readAsarFile`（第 385–444 行）offset 計算正確：等寫完後讀取，所有內容都對（見驗證）。它不檢查 `readSync` 回傳的位元組數，所以資料沒寫完時會讀成 NUL，而不是報錯。不過這不是本 BUG 的原因（見〈遭遇問題〉的後續建議）。
- 重現：
  - 本機 Windows（node v26.13.1）以獨立腳本跑 300 次，加上讓 libuv threadpool 忙碌再跑 100 次，都**沒有**重現。代表本機負載低時寫入很快就做完。
  - 把 `fs.write` / `fs.writev` 延遲 20 ms（模擬 runner 寫入慢）之後：獨立腳本在 resolve 當下 **20/20** 次讀到 13 個 `\u0000`，等串流 `finished` 後 **0/20**。
  - vitest 裡也做了對照（以 `NODE_OPTIONS=--require` 預載同一個延遲）：base 版測試檔失敗，錯誤是 `expected '\u0000\u0000…' to be '{"name":"ws"}'`，和 CI 第 984 行同一個斷言；修正版通過。
  - 沒有在 WSL / Linux 上跑。延遲寫入的對照已經直接證明了這個機制，所以沒再加跑。

### 產出摘要

- `scripts/__tests__/verify-packaged-native.test.mjs`（commit `1eb8f5ee`）：
  - 新增 `import { finished } from 'node:stream/promises'`。
  - `reads an app.asar written by @electron/asar` 改為接住 `createPackageWithOptions` 的回傳值。回傳值是串流時，先 `await finished(out)`，再讀檔。
  - 註解寫明原因（BUG-223 / T0924）。
  - **斷言內容一行都沒改。**
  - 以後的 `@electron/asar` 版本若改成自己等寫完、回傳 `undefined`，這個判斷就會略過等待，行為仍然正確。
- `scripts/verify-packaged-native.js`：**沒有改**。打包產物檢查的判定完全不變。
- 其他地方：repo 內 `@electron/asar` 的 `createPackage*` 只有這一處使用。electron-builder（`app-builder-lib/out/asar/asarUtil.js:70` `createPackageFromStreams` → `streamFilesystem`）也是 `return out.end()`、不等寫完。不過 `verify-packaged-native.js` 在 electron-builder 程序結束後才另一個 CI step 執行；Node 程序會等串流裡還沒寫完的資料寫完才結束，所以產品檢查不受影響。

### 驗證

| 閘門 | 結果 |
|---|---|
| `npm ci`（worktree） | exit 0（749 packages；`electron-winstaller` install script 被擋，屬預期） |
| 該測試檔整檔連跑 | **120/120** 通過（每次 98 tests） |
| 慢寫入（`fs.write` 延遲 20 ms）下只跑該測試 | **30/30** 通過；base 版在同條件下失敗（負向對照） |
| `npm run test:unit`（head `1eb8f5ee` 第一次完整執行） | exit 0：Test Files 497 passed / 3 skipped（500）、Tests **9037 passed** / 42 skipped（9079） |
| `npm run test:legacy` | exit 0：files 33 passed、0 failed；tests 472 passed、0 failed |
| `npx vite build` | exit 0 |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |

- 連跑 120 次、vite build、兩個 typecheck 是在 commit 前跑的，當時工作樹內容和 `1eb8f5ee` 完全相同（只差這一個檔案的修改，commit 時原樣提交）。`test:unit` / `test:legacy` 在 commit 之後、在 head 上跑。
- `verify-packaged-native.js` 沒有改動，所以不需要另跑 `--help`；它的單元測試整檔就包含在上面的 120 次連跑裡。

**BUG-223 處置建議**：改 `FIXED`（修正 `1eb8f5ee`，在 `ct/T0924`）。合併回 `main` 後，下一次 desktop-build / pre-release 的 `tests` job 綠燈就可以 `CLOSED`。這是偶發問題，單次綠燈只算佐證，主要依據是上面的負向對照。

### 互動紀錄

- [21:39] 開工。yolo、`CT_INTERACTIVE=0`，沒有向使用者或塔台提問。
- [21:51] 塔台補充檢查（驗證前、產品 commit 前、填報告前）：工單沒有 `## 塔台補充（…）` 段落。

### 遭遇問題

- 本機在正常負載下重現不到（300＋100 次），只能用延遲寫入的方式重現。理由見〈根因〉。
- 後續建議（不在本單範圍，沒有改）：`readAsarFile` 沒有檢查 `fs.readSync` 回傳的位元組數。遇到被截斷的 app.asar 時，它會把缺的部分當成 NUL 內容傳回，而不是報錯。可以考慮另開單，讓讀到的位元組數不足時判定失敗；這會讓檢查變嚴，不是放寬。

### 隔離分支證據
- branch：`ct/T0924`
- base_sha：`beb448429a2a012b83c2769b8b78af69007fa833`
- validated_sha：`1eb8f5ee89813edde4d689b007f0da74388460c4`
- head_sha：`1eb8f5ee89813edde4d689b007f0da74388460c4`
- validated_sha ≠ head_sha 的說明：相同，不適用。

### 回報時間
- 2026-11-25T21:51:22+08:00
