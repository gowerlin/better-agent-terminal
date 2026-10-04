---
schema_version: 1
schema_kind: workorder
id: T0454
title: "scripts/__tests__ 在 CRLF checkout 下失敗（autocrlf=true + 無 .gitattributes）：3 檔載入 SyntaxError、server-bundle-helpers 原始碼 regex 不容 \\r\\n——查根因、改為換行無關；評估 .gitattributes（只建議不套用）"
type: fix
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T06:46:30+08:00"
started_at: "2026-10-05T07:08:29+08:00"
updated_at: "2026-10-05T07:16:31+08:00"
completed_at: "2026-10-05T07:16:31+08:00"
target_version: next
depends_on:
  - T0434
related:
  - "塔台 06:45 聯合複驗（乾淨 worktree HEAD `e52f738`）：`dev-deploy-headless` / `remote-tools-install-check` / `smoke-remote-headless` 三檔載入 `SyntaxError: Invalid or unexpected token`；`server-bundle-helpers.test.mjs` regex `\\n {2}await copyHelperScripts\\(\\)\\n\\}` 不命中 CRLF；主工作區（LF）全綠"
  - "根因線索：系統 gitconfig `core.autocrlf=true`（`C:/Program Files/Git/etc/gitconfig`）、repo 無 `.gitattributes` → 新 checkout 為 CRLF；PLAN-036「塔台驗證環境備註」記為 worktree 異常、未深追"
  - "D134 追加（塔台 06:46 依授權直接決定）"
affects_files:
  - scripts/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **重現方式**：在 scratchpad 建乾淨 worktree（`git -c core.longpaths=true worktree add --detach <scratchpad>/crlf-wt HEAD`，`node_modules` 以 junction 指向主工作區），確認檔案為 CRLF 後跑這 4 檔重現；修完在同一 worktree（以 `git -C <wt> checkout --detach <新 commit>` 更新）驗證綠，主工作區也綠。結束後 `git worktree remove` 該 worktree。"
  - "🔴 **查 SyntaxError 真因**（例如 CRLF 下某 `.mjs` 內多行 template / regex / shebang 處理、或測試以文字讀檔後 `eval` / `new Function` / `vm`），回報區附證據。修法以「測試與被測腳本對換行無關」為準（regex 用 `\\r?\\n`、讀檔後正規化換行等）；不得改變被測腳本的對外行為。"
  - "🔴 **塔台 07:07 線索（T0434 遭遇問題 5）**：T0434 以 Python 文字模式寫檔產生 CRLF，**shebang 行帶 `\\r` 時 vitest 轉譯報 `SyntaxError: Invalid or unexpected token`**——高度疑似即三檔載入失敗的真因（被測 `.mjs` 首行 `#!/usr/bin/env node\\r`）。請先驗證此假設；若成立，修法可在測試載入端處理，或評估 vitest / 轉譯設定，回報區說明。"
  - "🔴 `.gitattributes`：**只評估、不新增**（會牽動全 repo 正規化，屬塔台 / 使用者決定）。回報區給建議內容與影響（哪些檔會被 renormalize、CI / 打包是否受影響）。"
  - "🔴 依賴 T0434（同改 `scripts/__tests__/`）。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；worktree 的 `checkout --detach <commit>` 不在此限，因為只在 scratchpad worktree 內）；不 push。"
---

# T0454 — scripts 測試換行無關

## 驗收條件

- [x] 回報區附 SyntaxError 真因證據
- [x] CRLF worktree 與主工作區兩邊 `scripts/__tests__` 全綠
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [x] 回報區附 `.gitattributes` 建議

## Sub-session 執行指示
1. 讀本工單 + PLAN-036「塔台驗證環境備註」
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 重現 → 查因 → 修 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**。程式 commit `4dab93f`（`fix(test): T0454 scripts tests load under CRLF checkout`）；本工單另 commit。未 push。

Landing check：**PASS**。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 `scripts/__tests__/` 存在；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。Mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 產出摘要

#### SyntaxError 真因（塔台 07:07 假設**成立**，並定位到 Vite 原始碼）

1. 三檔都以 static import 載入帶 shebang 的被測腳本：`dev-deploy-headless.test.mjs:36` ← `../dev-deploy-headless.mjs`、`remote-tools-install-check.test.mjs:25` ← `../remote-tools-install-check.mjs`、`smoke-remote-headless.test.mjs:66` ← `../smoke-remote-headless.mjs`。CRLF checkout 下首行為 `#!/usr/bin/env node\r\n`（`od -c` 實證：`n o d e \r \n \r \n / * *`）。`bat-server-process-handlers.test.mjs` 不 import 任何 shebang 腳本（只 spawn）⇒ 不受影響，與現象一致。
2. Vite 7.3.2 `node_modules/vite/dist/node/chunks/config.js:15356` `const hashbangRE = /^#!.*\n/;`，`:15393` `const fileStartIndex = hashbangRE.exec(code)?.[0].length ?? 0;`——JS regex 的 `.` 不匹配 `\r`，故 CRLF 首行**不命中**，`fileStartIndex = 0`，SSR 轉譯把 hoist 出來的 `const __vite_ssr_import_0__ = await ...` / `__vite_ssr_exportName__(...)` 插在檔案位置 0，也就是 **`#!` 之前**。
3. 之後 `config.js:34000` `if (result.code[0] === "#") result.code = result.code.replace(/^#!.*/, ...)` 只在首字元為 `#` 時抹掉 shebang；此時首字元已是 hoist 碼 ⇒ 不處理 ⇒ `#!` 出現在程式中段 ⇒ module runner 包成 async function 時 `SyntaxError: Invalid or unexpected token`（無堆疊，因為是整個 importer 載入失敗）。
4. 最小重現（scratchpad `probe.mjs`，直接呼叫 `vite` 匯出的 `moduleRunnerTransform`）：
   - LF：輸出 `"#!/usr/bin/env node\n__vite_ssr_exportName__(\"x\", ...`，AsyncFunction parse OK
   - CRLF：輸出 `"__vite_ssr_exportName__(\"x\", ...\nconst __vite_ssr_import..."`（shebang 被擠到後面），parse → `SyntaxError Invalid or unexpected token`
   - `/^#!.*\n/.test('#!/usr/bin/env node\r\n')` → `false`
   - Node 本身沒問題（`server-bundle-helpers` 以 spawn 執行 CRLF 腳本皆通過）；純屬 vitest 經 Vite SSR transform 的路徑。

#### `server-bundle-helpers.test.mjs` 失敗
原始碼 regex `\n {2}await copyHelperScripts\(\)\n\}` 對 CRLF 原始碼不命中（`AssertionError: expected '#!/usr/bin/env node\r\n\r\nimport { r…' to match`）。

#### 修法（測試與被測腳本對換行無關；被測腳本零改動）
- `vite.config.ts`：新增 `crlfHashbang()` plugin（`enforce: 'pre'`），**只放在 `isTest` 分支**（`plugins: isTest ? [react(), crlfHashbang()] : [...]`），build / dev 的 plugin 清單完全不變。偵測 `/^#![^\n]*\r\n/` 時把開頭 `#!` 換成 `//`（長度不變、行數不變 ⇒ 所有 offset 不變，`map: null` 正確）；LF 檔不動，由 Vite 原本邏輯處理。選這裡而非測試載入端：測試檔無法改變自身 import 的轉譯結果；改 dynamic import / externalize 會繞過 `vi.mock` 且只修單點。這是工單所指「評估 vitest / 轉譯設定」路線，超出 `affects_files`（`scripts/__tests__/`）一個檔，YOLO 下依最佳建議直接決定並於此回報。
- `scripts/__tests__/server-bundle-helpers.test.mjs`：regex 改 `\r?\n`（兩處）。其餘 `readFileSync` 斷言（`dev-deploy-headless` 的 `build-server-bundle.mjs` 原始碼檢查、`smoke-remote-headless` 的 `readSource`）在 CRLF worktree 實跑皆綠，未改。
- 新增 `scripts/__tests__/crlf-hashbang.test.mjs`：執行期寫出 LF / CRLF 兩個「shebang + import + export」模組再 `import()`，讓 LF checkout 也能覆蓋 CRLF 情境。暫存目錄放在 `scripts/__tests__/.t0454-crlf-*`（`afterAll` 清除）：放 `os.tmpdir()` 實測 `Cannot find module '/@id/C:/…'`（repo 在 D:），放 `node_modules` 會被 externalize 而不經轉譯。
- **負向對照**：新測試放進未含 config 修正的 CRLF worktree（HEAD `889d479`）→ LF ✓、CRLF ✗ `SyntaxError: Invalid or unexpected token`（與原症狀相同）；含修正後兩者皆 ✓。

#### 驗證（evidence lanes）
| Lane | 結果 | 證據 |
|---|---|---|
| 重現（修前，CRLF worktree @ `889d479`） | 重現 | `scripts/__tests__`：4 failed / 1 passed 檔；3 檔 `SyntaxError: Invalid or unexpected token` (0 test)、server-bundle-helpers 1 failed |
| CRLF worktree @ `4dab93f`（`file` 確認 `vite.config.ts` / `scripts/*.mjs` 為 CRLF） | PASS | `scripts/__tests__` 6/6 檔、168/168；`npm run test:unit` 156/156 檔、2473 passed / 1 skipped；`npx tsc --noEmit` 36 |
| LF worktree @ `4dab93f`（`-c core.autocrlf=false` 建立） | PASS | `scripts/__tests__` 6/6、168/168；`npm run test:unit` 156/156、2473 passed / 1 skipped |
| 主工作區（LF，含其他 Worker 未提交改動） | PASS | `scripts/__tests__` 6/6、168/168；`npm run test:unit` 158/158 檔、2521 passed / 1 skipped；`npx tsc --noEmit` 36（≤ 39） |
| `npx vite build` / `npm run test:e2e` | 未跑 | 工單規定不跑（L141）；build 路徑 plugin 清單未變 |

worktree 皆以 `git worktree remove` 移除（先拆 `node_modules` junction，確認主工作區 `node_modules/vitest` 仍在）；`crlf-wt` 因 vitest 以 LF 重寫 2 個 `.snap`（內容 diff 為空、純 EOL）需 `--force`。

#### `.gitattributes` 評估（**只建議，未新增**）

現況：`git ls-files --eol` → index 內 **2197 個 `i/lf`、16 個 `i/-text`、0 個 `i/crlf`、0 個 `i/mixed`**。`-text` 為 14 個 png/ico 圖檔 + `_ct-workorders/T0293-review-report.md`（Git 判定為二進位）。

建議內容：
```gitattributes
# 一律以 LF 存庫並以 LF checkout（不受 core.autocrlf 影響）
* text=auto eol=lf
*.png binary
*.ico binary
```
（`.ps1`：PowerShell 讀 LF 無礙，不需另設 `eol=crlf`；repo 無 `.bat` / `.cmd`。）

影響：
- **renormalize：0 檔**。index 已全為 LF，`git add --renormalize .` 預期不產生內容變更；`T0293-review-report.md` 在 `text=auto` 下仍依內容判定為二進位、不被轉換。
- **工作樹**：新 clone / 新 worktree 在 Windows 也是 LF（本單症狀根除、`LF will be replaced by CRLF` 警告消失）。既有 Windows 工作樹不會自動轉換，要重新 checkout 才生效（重新 clone 最安全；`git rm --cached` + `reset --hard` 屬破壞性操作，由使用者決定）。
- **CI / 打包**：`actions/checkout@v4` 的 Windows runner 預設 `autocrlf=true`，目前 Windows 安裝檔內 `resources/scripts/*.mjs` 為 CRLF；加檔後改為 LF，與 Linux / mac 產物一致。Node 對兩者皆可執行，功能無差。server bundle 在 Linux job 建置，不受影響。
- **附帶好處**：`install.sh`、`docker/Dockerfile` 等若從 Windows checkout 拿去 Linux 使用，不會再有 `$'\r'` 問題。
- **本單修正與 `.gitattributes` 互不依賴**：即使不加，`crlfHashbang()` + `\r?\n` 已讓測試換行無關；加了是縱深防禦。

### 遭遇問題

1. 第一版回歸測試用 `pathToFileURL(...)` / `os.tmpdir()` 絕對路徑 import 均 `Cannot find module`（file URL 與跨磁碟 `/@id/C:/…`），改為 repo 內暫存目錄後通過。另一次以 `sed` 改寫 regex 時跳脫被吃掉（`/\/g`），已以 Edit 修正，未進 commit。
2. 第一次跑主工作區 `test:unit` 有 2 個失敗（`headless-helper-env.test.ts`、`smoke-remote-headless.test.mjs` S13 的 `BAT_HELPER_NODE` / `PATH` 鍵差異），來源為**其他 Worker 未提交的** `electron/remote/headless-entry.ts`（T0456 範圍），非本單；於乾淨 worktree 對 `4dab93f` 全綠，稍後主工作區重跑亦 158/158 全綠。
3. 觀察（未處理，供塔台參考）：CRLF checkout 下跑 vitest 會把 `src/components/__tests__/__snapshots__/BugWorkflowIndicator.test.tsx.snap`、`src/lib/remote-tools/__tests__/__snapshots__/recipes.test.ts.snap` 以 LF 重寫，在該工作樹造成「M」狀態（內容無差）。加 `.gitattributes`（`eol=lf`）即消失。
4. 範圍偏離：修正需動 `vite.config.ts`（不在 `affects_files`），理由見「修法」；僅 `isTest` 分支、build 不受影響。

### 回報時間

2026-10-05T07:15:44+08:00
