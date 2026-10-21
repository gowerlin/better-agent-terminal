---
schema_version: 1
schema_kind: workorder
id: T0684
title: "CI 擋版前置：ubuntu 試跑失敗的 29 項（9 檔）改成跨平台／不依賴時區——寫死 Windows 行為 19 項、時區 10 項"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: M
created_at: "2026-10-21T21:15:12+0800"
started_at: "2026-10-21T21:16:32+0800"
updated_at: "2026-10-21T21:26:08+0800"
completed_at: "2026-10-21T21:26:08+0800"
depends_on:
  - "T0683（DONE `a35c4ce3`：`tests.yml`）；GitHub 試跑 run `39605811732`（2026-10-21，ubuntu-24.04，`2dd1dbdc`）：5719 passed、29 failed、6 skipped / 5754，9 檔失敗"
related:
  - "D177（CI 分兩步：試跑全過才設擋版）；BUG-168；T0683 回報區「遭遇問題」第 2 點（WSL 模擬的原因判讀）"
  - "失敗清單（run `39605811732`）：`electron/__tests__/bat-mcp-launch.test.ts` 4、`blocked-hooks-launch.test.ts` 4、`claude-session-name-launch.test.ts` 3（`--mcp-config=`／`--settings=`／`--name=` 的引號：Linux 暫存路徑沒有 `\\`，引號規則不加引號）；`gh-resolver.test.ts` 4（`gh.exe`、Windows 路徑）；`upgrade-rollback-main.test.ts` 1、`wsl-install-bundle.test.ts` 2（`Expected absolute Windows path`）；`scripts/__tests__/e2e-baseline-source.test.mjs` 1（Windows 安裝位置）；`src/lib/__tests__/usage-limit.test.ts` 9、`electron/__tests__/usage-limit-continue.test.ts` 1（句子「resets 4pm (Asia/Taipei)」，runner 時區是 UTC）"
  - "WSL 模擬才失敗、GitHub 通過的 `tls-fingerprint`、`server-bundle-download-retry` 不在本單範圍"
  - "用量限制規則：CLAUDE.md「用量限制自動繼續（PLAN-044 / T0566，D148）」節；辨識唯一實作 `src/lib/usage-limit.ts`"
affects_files:
  - electron/__tests__/bat-mcp-launch.test.ts
  - electron/__tests__/blocked-hooks-launch.test.ts
  - electron/__tests__/claude-session-name-launch.test.ts
  - electron/__tests__/gh-resolver.test.ts
  - electron/__tests__/upgrade-rollback-main.test.ts
  - electron/__tests__/wsl-install-bundle.test.ts
  - electron/__tests__/usage-limit-continue.test.ts
  - src/lib/__tests__/usage-limit.test.ts
  - scripts/__tests__/e2e-baseline-source.test.mjs
  - "產品檔：只在下方 memory_overrides 允許的條件下修改，修改前先問塔台"
  - _ct-workorders/T0684-tests-cross-platform-and-timezone.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 目標：這 29 項在 Windows 與 Linux（ubuntu、UTC 時區）都通過，而且**不降低覆蓋**：Windows 專屬的斷言在 Windows 上照樣要跑；能用注入 `platform`、`path.win32`、明確的 shell family 讓 Linux 也跑到同樣斷言的，優先這樣做。只有行為本身就只存在 Windows（例如 WSL 安裝、Windows 安裝位置）而且無法注入時，才用 `it.skipIf(process.platform !== 'win32')`，並在測試裡註明原因。"
  - "🔴 不要讓測試變成同義反覆：期望值不能直接用被測函式自己算出來；引號類測試要明確寫出各 shell family 的期望字串。"
  - "🔴 時區 10 項：先查清楚原因再改。是測試假設了執行環境的時區 → 在這兩個測試檔內固定時區（例如在檔案層級設定並在結束時還原），不改全域 vitest 設定。若發現 `src/lib/usage-limit.ts` 沒有照句子裡寫的時區（例如 `(Asia/Taipei)`）計算重置時間，系統時區不同的使用者會算錯 → 這是產品問題，**先以 `T0684 提問` 問塔台**（附證據與修法建議），不要自己改產品。"
  - "🔴 產品檔：預設不改。只有當測試失敗的根源是產品用了「跟執行主機平台有關」的判斷去檢查一個本來就是 Windows 的路徑（例如 WSL 安裝只在 Windows 主機發生，卻用 `path.isAbsolute` 而非 `path.win32.isAbsolute`），而且改成明確的 `path.win32` 在 Windows 上行為完全不變時，才可以改；改之前同樣先問塔台。"
  - "🔴 驗證：`npm run test:unit` 在 Windows 全過（記通過數）；再在 Linux 環境跑一次這 9 個檔（可用 WSL 的 Ubuntu，並設 `TZ=UTC`，比照 T0683 的模擬方式，從乾淨 clone 或至少乾淨的 node_modules 安裝），全過；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功。"
  - "🔴 不改 `package.json`、`vite.config.ts`、`.github/**`（T0685 正在改 `package.json` 與 `tests.yml`）。同時有 T0685 的 Worker 在跑：只動 `affects_files`；commit 用 `git commit --only <檔案>`，不要 `git add -A`。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，測試資料用 `demo`／`tester`／代稱。Git：不 push；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。不跑 Playwright e2e。yolo：不得問使用者，判讀問題問塔台；不得寫出權杖值。"
---

# T0684 — 29 項測試改成跨平台、不依賴時區

## 目標

`tests.yml` 第一次在 GitHub（ubuntu-24.04、UTC）試跑：5719 項通過、29 項失敗（9 檔）。19 項是測試寫死了 Windows 行為（引號規則、`gh.exe`、Windows 路徑、Windows 安裝位置），10 項和時區有關。這 29 項修好、試跑全過之後，才能把 `test:unit` 設成發版擋版（D177）。

## 要做的事

1. 在 Linux（WSL Ubuntu、`TZ=UTC`）重現這 29 項，逐項確認原因。
2. 寫死 Windows 行為的 19 項：優先注入平台／用 `path.win32`／明確 shell family，讓兩個平台都跑到相同斷言；不得不時才 `skipIf` 並註明。
3. 時區 10 項：判斷是測試假設時區還是產品沒照句子裡的時區計算；前者在測試檔內固定時區，後者先問塔台。
4. Windows 與 Linux 各驗證一次，commit（不 push）。

## 驗收

- 這 9 個檔在 Windows 與 Linux（`TZ=UTC`）都全過；回報區附兩個平台的結果。
- 回報區逐項列出處理方式（注入／`path.win32`／固定時區／`skipIf` 與理由），以及 Windows 上的斷言數沒有減少的證據。
- `test:unit` 全過、typecheck 0／0、build 成功；只改 `affects_files`；未 push。

---

## 回報區

### 待塔台決策

#### Q-1：`electron/wsl-detect.ts` 的 `validateWindowsAbsolutePath` 可否把 `path.isAbsolute` 改成 `path.win32.isAbsolute`？
- 提問時間：2026-10-21T21:21:36+0800
- 選項：[A] 改產品一行（`path.isAbsolute(filePath)` → `path.win32.isAbsolute(filePath)`），兩個測試檔不動 / [B] 不改產品，`wsl-install-bundle.test.ts` 2 項與 `upgrade-rollback-main.test.ts` 1 項改 `it.skipIf(process.platform !== 'win32')` 並註明 / [C] 其他：________
- Worker 建議：[A]。證據：這 3 項在 Linux 失敗的錯誤都是 `Expected absolute Windows path: C:\b\x.tar.gz`（`wsl-detect.ts:147-148`），檢查的是 WSL 安裝用的 Windows tarball 路徑，`installBundle` 只在 Windows 主機呼叫，`validateWindowsAbsolutePath` 只有 `wsl-detect.ts:352` 一個呼叫點。在 Windows 上 `require('path') === require('path').win32`（本機實測 `true`），所以改成 `path.win32` 在 Windows 行為完全不變，符合工單 memory_overrides 第 4 條的條件；改後 Linux 也跑同樣的 3 項斷言，不必 skip。
- 影響範圍：`electron/wsl-detect.ts`（1 行，在 `affects_files` 的「產品檔」條件內）；`electron/__tests__/wsl-install-bundle.test.ts`、`electron/__tests__/upgrade-rollback-main.test.ts`（選 A 不必改）
- 阻塞：是（這 3 項要等答覆；其他 25 項已在 Linux TZ=UTC 修好）

#### Q-2：`e2e/real-remote/baseline-source.mjs` 的 `defaultInstalledBaselineDirs` 可否在 `platform === 'win32'` 時用 `path.win32` 組路徑？
- 提問時間：2026-10-21T21:21:36+0800
- 選項：[A] 改 e2e helper（函式內 `const p = platform === 'win32' ? path.win32 : path`，`dirname` / `join` 改用 `p`），測試只把期望值改成字面字串 / [B] 不改 helper，`e2e-baseline-source.test.mjs` 該項拆成兩項：Windows 安裝位置那項 `it.skipIf(process.platform !== 'win32')` 並註明，`platform: 'linux'` → `[]` 那句在所有平台照跑 / [C] 其他：________
- Worker 建議：[A]。證據：函式已接受注入的 `platform`，但組路徑用主機的 `path`；Linux 上 `path.dirname('D:\\BAT\\BetterAgentTerminal.exe')` = `.`，得到 `resources/bat-server-baseline`（失敗訊息即此）。在 Windows 主機 `path === path.win32`，行為不變；改後 Linux 也跑同樣斷言。此檔不在 `affects_files` 的測試清單內，屬「產品檔」，所以先問。若塔台不希望動 e2e helper，[B] 是工單允許的 skip（「Windows 安裝位置」）。
- 影響範圍：`e2e/real-remote/baseline-source.mjs`（約 3 行）、`scripts/__tests__/e2e-baseline-source.test.mjs`
- 阻塞：是（這 1 項要等答覆）

### 完成狀態

DONE。29 項在 WSL Ubuntu 24.04（`TZ=UTC`）全數重現後修好：9 檔在 Linux（`TZ=UTC`）與 Windows 都是 202/202 通過；沒有用 `skipIf`，Windows 上的測試數不變。依 D178（Q-1／Q-2 答 [A]）改了兩個非測試檔：`electron/wsl-detect.ts` 1 行、`e2e/real-remote/baseline-source.mjs` 約 3 行，兩處在 Windows 上 `path === path.win32`，行為不變。

### 逐項處理（檔案、項目、原因、處理方式）

| 檔案 | 項數 | 原因 | 處理方式 |
|---|---|---|---|
| `electron/__tests__/bat-mcp-launch.test.ts` | 4 | 暫存 dataDir 在 Windows 有 `\`、`:`，引號規則一定加引號；Linux `/tmp/…` 全是安全字元，走不加引號的快速路徑，期望字串 `'--mcp-config=…'` 不符 | 改測試資料：`dataDir = <tmp>/App Data/userData`（加一個空格），兩平台都得加引號。期望字串仍逐一寫出（pwsh／posix 單引號、cmd 雙引號），不由被測函式算出 |
| `electron/__tests__/blocked-hooks-launch.test.ts` | 4 | 同上（`--mcp-config=`／`--settings=`） | 同上 |
| `electron/__tests__/claude-session-name-launch.test.ts` | 3 | 同上（含 `--name=` 那串的前段） | 同上 |
| `electron/__tests__/gh-resolver.test.ts` | 4 | 測試把 `process.platform` 設成 `win32`，但產品的 `path.join`／`path.delimiter` 用主機的 posix 規則：`PATH='C:\\Tools'` 在 `:` 被切開，路徑用 `/` 連接 | 注入：`vi.mock('path')` 讓 `join`／`normalize`／`isAbsolute`／`delimiter`／`sep` 照當下 `process.platform` 選 `path.win32` 或 `path.posix`（真實主機上兩者本來一致），Windows 案例的期望值改成字面字串（`'C:\\Tools\\GitHub CLI\\gh.exe'` 等）。另修 `prefers git on PATH` 原本沒跳脫的 `'C:\Git\cmd'`（實際是 `'C:Gitcmd'`）。linux 案例照舊（mock 後兩平台都用 posix） |
| `electron/__tests__/upgrade-rollback-main.test.ts` | 1 | `validateWindowsAbsolutePath` 用主機的 `path.isAbsolute` 檢查 Windows tarball 路徑 → Linux 回 `Expected absolute Windows path` | 產品改 `path.win32.isAbsolute`（D178／Q-1），測試檔不動 |
| `electron/__tests__/wsl-install-bundle.test.ts` | 2 | 同上 | 同上 |
| `scripts/__tests__/e2e-baseline-source.test.mjs` | 1 | `defaultInstalledBaselineDirs` 接受注入的 `platform`，但用主機的 `path` 組路徑；Linux 上 `dirname('D:\\BAT\\…exe')` = `.` | helper 依注入的 `platform` 選 `path.win32`／`path`（D178／Q-2）；測試期望值改成字面 Windows 路徑 |
| `src/lib/__tests__/usage-limit.test.ts` | 9 | 測試假設主機時區：`NOW` 是本機 15:00，句子 `4pm (Asia/Taipei)` 被期望成 NOW 後 1 小時（只在主機為 Asia/Taipei 時成立） | 檔案層級固定 `process.env.TZ = 'Asia/Taipei'`，`afterAll` 還原；未改全域 vitest 設定 |
| `electron/__tests__/usage-limit-continue.test.ts` | 1 | 同上（`START` 本機 15:00） | 同上 |

Windows 斷言數沒有減少的證據：本單 diff 沒有新增、刪除或改成 skip 任何 `it`／`it.each`／`describe`（`git diff -U0` 過濾這幾個關鍵字是空的）；9 檔 Windows 改前改後都是 202 項（改前的數字是 Linux 重現時的 173 passed + 29 failed = 202）；全套 5751 passed | 3 skipped（5754），skip 數與 T0683 的基線（5751 | 3 skipped）相同。

### 時區判斷

是**測試假設時區**，產品沒有問題，所以沒有提問：`parseClaudeResetTime` 用句子裡的 IANA 時區（`tzOffsetMs` / `epochOf`，`Intl.DateTimeFormat` 的 `timeZone`）計算；本來就有的 `reset times` 測試以 UTC epoch 斷言 `3pm (Asia/Taipei)`、`(America/New_York)`、`(UTC)`，改前在 `TZ=UTC` 下也是通過的。codex 的句子不帶時區，產品照設計用本機時區（`parseCodexResetTime`），測試用 `local()` 期望，固定 TZ 後兩邊一致。另在 Windows 以 `TZ=UTC` 跑這 2 檔：69/69 通過。

### 驗證結果（Windows／Linux）

| 項目 | 結果 | 證據 |
|---|---|---|
| Linux 重現（WSL Ubuntu 24.04、Node 24.22.0、npm 11.19.1；從 HEAD `602207fd` clone 到 `~/t0684`、`npm ci --ignore-scripts` + electron `install.js`、清掉 `BAT_*`／`CT_*`、`CI=true`、`TZ=UTC`） | 改前 FAILED（預期中） | 9 檔：29 failed、173 passed（202），失敗清單與 run `39605811732` 相同 |
| Linux 9 檔（同上環境，覆蓋本單 9 檔） | PASS | Test Files 9 passed (9)，Tests 202 passed (202)；`TZ=UTC date` → `Wed Oct 21 13:23:24 UTC 2026` |
| Windows 9 檔 | PASS | Test Files 9 passed (9)，Tests 202 passed (202) |
| Windows `TZ=UTC` 時區 2 檔 | PASS | 69 passed (69) |
| `npm run test:unit`（Windows） | PASS | Test Files 326 passed (326)，Tests 5751 passed \| 3 skipped (5754)，58.70 s |
| `npm run typecheck` | PASS | exit 0 |
| `npm run typecheck:electron` | PASS | exit 0 |
| `npx vite build` | PASS | exit 0 |
| Playwright e2e | 未實跑 | 工單不跑 e2e；`baseline-source.mjs` 也被 e2e 使用，Windows 上行為不變（塔台 Q-2 答覆要求註明） |

### Commit

- `4d4bce72`（`4d4bce720a3c70faccb273164c30a6852c3da6fe`）test: T0684 …（9 檔：7 個測試檔 + `electron/wsl-detect.ts` + `e2e/real-remote/baseline-source.mjs`），用 `git commit --only`。
- `925ed822` 工單提問；本次收尾另有一個工單 commit。
- 未 push。

### 遭遇問題

1. 有兩處要改非測試檔（`electron/wsl-detect.ts`、`e2e/real-remote/baseline-source.mjs`），照工單規定先以 BAT 通道問塔台（Q-1／Q-2），塔台答 [A]（D178）後才改。
2. 與 T0685 共用工作目錄：它改了 `package.json`／`package-lock.json`、加了 `scripts/run-legacy-tests.mjs` 與 `tests/zz-t0685-*`，也改了自己的工單；本單都沒碰，commit 只含本單 9 檔。全套測試是在這些未 commit 的變更存在時跑的（`tests/zz-t0685-*` 不在 `test:unit` 的 include 內）。
3. WSL 的 clone `~/t0684` 留在 WSL 家目錄（repo 外），之後可以刪。

### 互動紀錄

- [21:22] Q-1: `validateWindowsAbsolutePath` 可否改 `path.win32.isAbsolute`？ → A（塔台，BAT 通道，choice 1）: [A] 同意，加註解，兩個測試檔不 skip，收尾跑 test:unit／typecheck 0/0／build，記 D178 → Action: 改 `electron/wsl-detect.ts:146-150`（含註解），3 項在 Linux 通過
- [21:22] Q-2: `defaultInstalledBaselineDirs` 可否依 `platform` 用 `path.win32`？ → A（塔台，BAT 通道，choice 1）: [A] 同意，期望值寫字面字串，視同本單 affects_files，回報註明未實跑 e2e，記 D178 → Action: 改 helper 與測試期望值，1 項在 Linux 通過

### Landing check

PASS。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1：工單在 REPO_ROOT 下。C-3：`affects_files` 都存在（informational）。C-2：沒有 `branch` 欄位。`CT_HOME` 未設（不是 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

### 回報時間

2026-10-21T21:25:24+0800
