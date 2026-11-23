---
schema_version: 1
schema_kind: workorder
id: T0887
title: "實作：Windows Terminal Server 改用整個程序共用一個 node-pty conout Worker（PLAN-066，T0886 做法 (a')），在 `v0.8.x` 分支"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-23T17:39:35+08:00"
started_at: "2026-11-23T17:41:24+08:00"
updated_at: "2026-11-23T18:10:07+08:00"
completed_at: "2026-11-23T18:10:07+08:00"
session_ids:
  - "3fdd9059-4ebe-42d4-9b79-7da481ecd6ba"
depends_on: [T0886]
related:
  - "PLAN-066；D307 / D308；T0886（研究與原型，分支 `ct/T0886` 的 `experiments/node-pty-worker/`，尤其 `override/shared-conout.cjs`、`check.cjs`、`measure/`）；T0885（`bat-baseline/bat-baseline.spec.ts`，分支 `ct/T0885`）；PLAN-065（Windows PTY holder，`scripts/pty-holder.cjs`，W6）；T0540 / T0572 / T0578 / T0704 / T0857 / T0861 / T0866"
affects_files:
  - _ct-workorders/T0887-impl-shared-conout-worker.md
  - electron/terminal-server/shared-conout.ts
  - electron/terminal-server/shared-conout-worker.cjs
  - electron/terminal-server/server.ts
  - electron/__tests__/shared-conout*.test.ts
  - vite.config.ts
  - package.json
  - package-lock.json
  - scripts/pty-holder.cjs
  - scripts/verify-packaged-native.js
  - scripts/__tests__/**
  - CLAUDE.md
  - docs/agent-guide/pty-holder.md
  - docs/agent-guide/terminal-server-recovery.md
  - experiments/node-pty-worker/**
renew_count: 0
isolation: worktree
workdir: worktree ct/T0887（塔台已預先從 `v0.8.x` 建立分支 `ct/T0887`，base `06c3b884`）
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree（D307 / D308）：產品改動只進 worktree 分支 `ct/T0887`。塔台已從 `v0.8.x` 預先建立這個分支，BAT 在既有分支上建 worktree，所以 `CT_WORKTREE_BASE` 應為 `06c3b884…`（= `v0.8.x`）；開工時先確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`，不符就停下問塔台。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`（合進 `v0.8.x` 由塔台做）。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 依賴：BAT 不替 worktree 裝依賴，請在 worktree 內 `npm ci`（不得改 lock 以外的方式裝套件；`@lydell/node-pty` 改精確版號後 lock 要同步，lock 的變動只能是這一項）。不新增任何 npm 依賴、不改 `allowScripts`。"
  - "🔴 不碰本機 BAT 安裝版、使用者正在用的 BAT 與其 Terminal Server / PTY holder（`C:\\Program Files\\BetterAgentTerminal`、`%LOCALAPPDATA%\\BAT-PtyHolder`、`%ProgramFiles%\\BAT-PtyHolder` 只能列檔）。量測與 e2e 一律用 repo 建置＋隔離 userData（`launchIsolated` 等 fixture）。🔴 不觸發任何 GitHub workflow（含 W6 `windows-upgrade-acceptance.yml`、`desktop-build.yml`；由塔台在合併後取得授權再跑）；🔴 不在開發機跑 W6 spec。"
  - "🔴 程序清理（T0886〈遭遇問題〉1：舊量測腳本以 `ParentProcessId` 找子程序，PID 重用時誤殺了 8 個無關程序）：量測與清理一律用 `ct/T0886` 修正後的腳本規則（子程序建立時間必須晚於父程序；只結束探針啟動之後建立的程序、一次一個、不 `taskkill /T` 整棵樹）。不得以程序名稱或父 PID 大範圍結束程序；回報區寫明每次清理結束了哪些 PID（只記 PID 與映像名稱）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。Git：主 checkout 只 commit 本工單檔；worktree 用 `git add <明確路徑>`（不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。日誌不記 PTY 內容、權杖、env。"
---

# T0887 — 實作：Windows Terminal Server 共用一個 conout Worker（PLAN-066）

## 元資料

- **工單編號**：T0887
- **任務名稱**：Windows Terminal Server 改用整個程序共用一個 node-pty conout Worker
- **狀態**：DONE
- **類型**：implementation
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-23 17:39 (UTC+8)

## 背景

T0886 實測：`@lydell/node-pty` 1.1.0 在 Windows 每個 PTY 開一個 conout `worker_threads.Worker`（約 14 MB／個），Terminal Server 持有 10 個 PTY 約 170 MB。改成「整個程序共用一個 Worker」後降到 39 MB（node.exe）／37 MB（electron 當 node），輸出、kill、自然結束、resize、殘留程序與吞吐都和現況相同；防死結設計（ConPTY 關閉時由 Worker 排空輸出管線）不變。使用者 D307 決定「能省就做 Node 端修正」，塔台 D308 採用 T0886 推薦的做法 (a')：**Terminal Server 載入 node-pty 後、第一次 spawn 前，替換模組匯出的 `ConoutConnection`**，不 patch `node_modules`、不 fork。

原型：分支 `ct/T0886` 的 `experiments/node-pty-worker/override/shared-conout.cjs`（可 `git show ct/T0886:<路徑>` 讀或複製）。T0886 回報區〈建議下一步〉第 1 項是本單的設計依據，先讀。

## 範圍

1. **新增**
   - `electron/terminal-server/shared-conout.ts`：`installSharedConout(nodePty 模組或目錄)` → `'installed' | 'skipped:<原因>'`。只在 win32 執行；版本必須是 `1.1.0`、`ConoutConnection` 匯出與類別形狀符合原型的檢查，否則**不替換、照舊運作**（記原因）。不 import electron、不在 import 期做事。
   - Worker 腳本（例：`electron/terminal-server/shared-conout-worker.cjs`）：一個 Worker 處理所有 PTY 的 conout 轉送；第一個 PTY 建立時啟動、最後一個 PTY 關閉後結束；每個轉送的錯誤只影響自己那個 PTY；`getWorkerPipeName` 直接寫成 `name + '-worker'`，不依賴套件內部路徑。Worker `error` / 非預期 `exit` 記一行日誌（不含 PTY 內容）。是否自動重建 Worker：本單先**不做自動重建**，只記錄並讓受影響 PTY 照現況的錯誤路徑結束（理由與替代做法寫進回報）。
2. **接線**
   - `electron/terminal-server/server.ts`：載入 node-pty 後、第一次 spawn 前呼叫一次安裝函式；結果記一行既有格式的日誌（例 `[shared-conout] installed` / `skipped:<原因>`）。🔴 只在 Terminal Server 安裝；direct 模式（`electron/pty-manager.ts`，Electron 主行程）**本單不套用**（D308 Q-B）。
   - 建置：Worker 腳本要進 `dist-electron/` 並被 `build.asarUnpack` 涵蓋（Terminal Server 從 asar 外執行）；依 `vite.config.ts` 現有 terminal-server 的建置方式決定最小改法。
   - `package.json`：`"@lydell/node-pty": "^1.1.0"` → 精確 `"1.1.0"`；lock 同步。
   - `scripts/pty-holder.cjs`：`holderSourceFiles` 與 holder manifest 加入 Worker 腳本（holder 從安裝目錄外執行，少了這個檔 holder 版就不會套用或出錯）；`scripts/verify-packaged-native.js` 若有 holder / asarUnpack 的檢查，同步加入。
3. **文件**：CLAUDE.md 依「CLAUDE.md 撰寫規則」在「Windows PTY holder」或「Terminal Server 存活判定與 recovery」節加 2–4 行（用途、唯一實作、版本守門、升 node-pty 時必跑的測試），細節寫進 `docs/agent-guide/pty-holder.md` 或 `terminal-server-recovery.md`（含 T0886 的量測數字與死結背景連結）。

## 不變式（不得改變）

- T0540：`endPty` 先 `killProcessTree` 再 `pty.kill()`；`shutdown()` 順序。
- ConPTY 關閉時仍由 Worker 排空輸出（不得改成主執行緒讀 conout；T0886 的做法 (c) 不在本單範圍）。
- T0572 初始尺寸、T0578 Recovery hold、T0704 heartbeat / recovery、T0857 協定 v1、T0861 接回、T0866 stdio guard、T0806 / T0807（只 Linux）都不變。
- macOS / Linux：完全不載入、不執行新程式碼（`installSharedConout` 在非 win32 直接回 `skipped:not-win32`，且不 require Worker 腳本）。
- 版本或形狀不符 → 行為與現況逐字相同。

## 驗收

1. `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、`npm run test:unit` 全過（與 base 相比不得新增失敗）。
2. 新單元測試（vitest，Windows 才跑真 PTY 的部分以 `it.skipIf` 控制）：安裝結果 `installed`；3 個 PTY 輸出完整且依序；整個程序只有 1 個 conout Worker；大量輸出中 kill 不 hang、exit code 正確；最後一個 PTY 關閉後 Worker 結束、事件迴圈能自己結束；版本不是 `1.1.0` 或形狀不符 → `skipped`、不替換；非 win32 → `skipped:not-win32`。source guard：只有 `server.ts` 呼叫安裝函式。
3. 既有 e2e（Windows，需先 `npx vite build`）：T0540、T0572、T0578、T0704、T0861 相關 spec 全過；列出實際跑的 spec 與結果。
4. **記憶體**：沿用 `ct/T0885` 的 `experiments/rust-eval/bat-baseline/bat-baseline.spec.ts`（複製到 `experiments/node-pty-worker/` 或同層，不改原分支），以本分支建置量 BAT 1 / 5 / 10 分頁的 Terminal Server Private Bytes，每個 3 次取中位數，並與 base（`v0.8.x`，可用同一 worktree 先量再改，或另一份建置）對照。目標：10 分頁 Terminal Server **< 45 MB**。量測與清理遵守 memory_overrides 的程序清理規則。
5. holder：`scripts/pty-holder.cjs` 相關既有單元測試全過；回報寫明 holder 內容改變、合併後需跑 W6（`windows-upgrade-acceptance.yml`，由塔台觸發）。
6. 回報區列〈相關通過案例〉：本單改動對既有驗收案例（T0540 / T0572 / T0578 / T0704 / T0861 / W6 情境）的影響判定。

## 不做

- direct 模式套用、主執行緒讀 conout（(c)）、`resourceLimits`、Rust Terminal Server、升 node-pty、自動重建 Worker。
- 合併到 `v0.8.x`、push、觸發 workflow、發版。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：DONE（Worker 範圍的驗收 1–6 全過；W6 依工單由塔台在合併後觸發）
- **branch**：`ct/T0887`
- **base_sha**：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（= `v0.8.x`；開工時 `git merge-base HEAD v0.8.x` 相符）
- **validated_sha**：`a05a9c79fc44b7190f02084de4401a968a4d3459`
- **head_sha**：`a05a9c79fc44b7190f02084de4401a968a4d3459`
  - 驗證是在提交前的工作樹上跑的，內容與 `a05a9c79` 相同：全套單元測試、打包檢查、holder e2e 與打包版量測在所有編輯完成之後才跑；T0572 / T0578 / T0704 e2e 跑完後只改了文件、`scripts/verify-packaged-native.js` 的 `DIST_ELECTRON_ENTRIES` 與其測試 fixture（之後再跑過單元測試與打包檢查），產品執行期程式碼沒有再改。
- **產品 commit**：`a05a9c79` feat(T0887): Windows Terminal Server shares one node-pty conout Worker (PLAN-066)
- **session_id**：3fdd9059-4ebe-42d4-9b79-7da481ecd6ba

### 互動紀錄

- [17:41] 開工。落點檢查：C-0 PASS（`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`）；C-1 PASS（工單在 `$CT_HOME/_ct-workorders/`）；C-3 部分存在（`server.ts`、`vite.config.ts`、`package.json` 等存在，新檔案的上層目錄存在），C-0 已 PASS → 只記錄；C-2 不適用（工單沒有 `branch` 欄）。`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0887`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`。`BAT_REMOTE_TOKEN`：已設定。
- [17:41] `git merge-base HEAD v0.8.x` = `06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`，符合 memory_overrides。
- 沒有向塔台提問；三個節點的塔台補充檢查都沒有新段落。

### 實作摘要

**新增**

- `electron/terminal-server/shared-conout.ts`：`installSharedConout(nodePtyDir | () => nodePtyDir, options)` → `'installed' | 'skipped:<原因>'`。
  - 非 win32 第一行就回 `skipped:not-win32`（不呼叫取目錄的函式、不讀檔、不 require Worker）。
  - 守門：`package.json` 版本必須是 `1.1.0`；`windowsPtyAgent.js` 仍含 `new windowsConoutConnection_1.ConoutConnection(`（替換 export 才有效）；`ConoutConnection` 有 `onReady` getter、`dispose`、`connectSocket`；Worker 腳本存在。不符 → `skipped:version-<v>` / `agent-shape` / `shape` / `worker-missing` / `load-failed`，export 不動。重複安裝回 `installed`、不再替換。
  - `SharedConoutConnection`：介面同原類別（`onReady` 回傳 `{ dispose }`、`connectSocket` 連 `<pipe>-worker`、`dispose` 等 1 s 排空才送 `close`）。第一個 PTY 啟動 Worker，最後一個轉送 `closed` 後 `terminate()`，下一個 PTY 再起新的。`EventEmitter2` 以 12 行的 `ReadyEmitter` 取代，不依賴套件內部檔。
  - Worker `error` / 非預期 `exit` 各記一行（只有 code 與受影響 PTY 數，沒有管線名稱與輸出）。不 import electron、import 期只有宣告。
  - `unpackedScriptPath`：打包版 Worker 路徑 `app.asar` → `app.asar.unpacked`（存在時）。
- `electron/terminal-server/shared-conout-worker.cjs`：一個 Worker 處理所有 PTY 的轉送（`open` / `close` 訊息），每個轉送的錯誤只關閉自己；`getWorkerPipeName` 寫成 `name + '-worker'`。與原型的差異：`listen` 的 callback 之後才回 `ready`（原型在呼叫 `listen` 後立即回）、忽略重複的 `open`。
- `electron/__tests__/shared-conout.test.ts`（18 個測試，見〈驗收結果〉2）。
- `experiments/node-pty-worker/bat-memory/`：T0885 `bat-baseline.spec.ts` 的閒置部分（不動原分支）＋ `ct/T0886` 修正版 `tree-usage.ps1`；結果 `experiments/node-pty-worker/results/bat-memory.csv`。

**改動**

- `electron/terminal-server/server.ts`：`ensureSharedConout()` 在 `createPty` 的 `pty.spawn(` 之前呼叫，每個程序只安裝一次；以 `require.resolve('@lydell/node-pty/package.json')` 取套件目錄（只在 win32 才執行）。結果寫一行到 server 的 stderr（`[shared-conout] <結果>`，與其他 `[terminal-server]` 行同一管道；非 win32 不寫）。direct 模式（`pty-manager.ts`）沒改。
- `vite.config.ts`：terminal-server 項加 `sharedConoutWorkerAsset()` plugin，把 Worker 原樣輸出成 `dist-electron/shared-conout-worker.cjs`（`emitFile` asset ＋ `addWatchFile`）。
- `package.json`：`"@lydell/node-pty": "1.1.0"`（精確版號）；`build.asarUnpack` 加 `dist-electron/shared-conout-worker.cjs`。`package-lock.json` 只變一行（根套件的 `optionalDependencies` 規格）；`npm ls` / `npm ls --package-lock-only` 都是 `@lydell/node-pty@1.1.0`、沒有 invalid。
- `scripts/pty-holder.cjs`：`PTY_HOLDER_SHARED_CONOUT_WORKER`；`holderSourceFiles` 把 Worker 從 `app.asar.unpacked/dist-electron/` 複製到 holder 根目錄（缺檔 → 建置失敗）；`ptyHolderProblems` 要求 manifest 列出它。**holder 內容因此改變（key 會變，實測新 key `24.22.2-f2630bed1fc5`）→ 合併後需跑 W6 `windows-upgrade-acceptance.yml`（由塔台觸發）。**
- `scripts/verify-packaged-native.js`：`DIST_ELECTRON_ENTRIES` 加 Worker（所有平台的 app.asar 少了它 → `runtime-require` 失敗）；Windows 另由 `pty-holder` 檢查。
- 測試：`scripts/__tests__/pty-holder.test.mjs`（檔案清單、12 個檔、新測試：holder 帶 Worker 且與打包同一份、manifest 沒列 → 問題、app 缺 Worker → 建置失敗）、`_pty-holder-fixture.cjs`（假 app 多寫 Worker）、`verify-packaged-native.test.mjs`（健康 fixture 多 Worker）、`asar-runtime-deps.test.mjs`（`DYNAMIC_REQUIRE_SITES` 登記 `shared-conout.ts`，套件清單空：它只以絕對路徑 require `@lydell/node-pty` 內的檔案，該套件本來就是靜態 external）。
- 文件：CLAUDE.md「Terminal Server 存活判定與 recovery」節加一條（用途、只在 server.ts、版本守門、不自動重建、升 node-pty 必跑的測試）；`docs/agent-guide/terminal-server-recovery.md` 新節「Windows：共用 conout Worker」（用途、防死結背景、必守規則、唯一實作、生命週期、日誌、量測、已知限制、驗證）；`docs/agent-guide/pty-holder.md` 架構表的 holder 套件列。

**不自動重建 Worker 的理由與替代做法**（工單要求寫進回報）

- 理由：Worker 死時，每個 PTY 的 conout 管線轉送一起斷了；ConPTY 的輸出管線無法讓新 Worker 接回同一個 PTY，那段輸出也已遺失，所以重建只能服務之後的新 PTY。程式已做到「下一個新 PTY 自動啟動新 Worker」，不需要另寫重建；對已斷的 PTY，重建只會掩蓋問題。Worker 只做 socket 轉送，每個轉送的錯誤只關閉自己，T0886 的吞吐 / kill 實測與本單測試都沒有當掉過。
- 受影響的 PTY：與 node-pty 自己的 Worker 當掉時相同（主執行緒的 `_outSocket` 斷線，走 node-pty 原本的錯誤路徑）。
- 替代做法（另案時可考慮）：(1) 在 `pty:created` 或 hello-ok 加欄位，讓主行程記錄安裝結果與 Worker 異常（目前 server 的 stderr 是 `ignore`，主行程看不到這幾行；`protocol.ts` / `pty-manager.ts` 不在本單 `affects_files`）；(2) Worker 異常時由 server 主動對受影響 PTY 送 `pty:exit` 或在 UI 標示，讓使用者知道要重開分頁。

### 驗收結果

1. **typecheck / build / 單元測試**：PASS
   - `npm run typecheck` = 0、`npm run typecheck:electron` = 0。
   - `npx vite build` 成功；`dist-electron/shared-conout-worker.cjs` 與原始檔逐位元相同；`terminal-server.js` 保留 `require.resolve("@lydell/node-pty/package.json")` 與動態 require。
   - `npm run test:unit`：Test Files 462 passed / 3 skipped（465），Tests 8434 passed / 41 skipped，沒有失敗。
2. **新單元測試** `electron/__tests__/shared-conout.test.ts`：18 個全過（Windows 開發機，含真 PTY）。
   - 不替換：非 win32 → `skipped:not-win32` 且取目錄函式沒被呼叫；版本 `1.2.0-beta.18` / 沒有 `onReady` getter / agent 不從 exports 取類別 → `skipped` 且 export 不變；套件讀不到 → `load-failed`；Worker 缺 → `worker-missing`。另檢查 repo 的 node-pty 就是 `1.1.0`、形狀符合、`package.json` 精確釘版、`asarUnpack` 有 Worker。
   - 假 Worker：重複安裝；3 個 PTY 1 個 Worker、`ready` 依 id、`<pipe>-worker`；1 s 排空、`dispose` 兩次只送一次 `close`；最後一個 `closed` 才 `terminate`、自己結束不記日誌、下一個 PTY 新 Worker；建立中的 PTY 讓 Worker 留著；錯誤 / 非預期結束各一行且不含管線名稱。
   - 真 Worker 腳本轉送管線（所有平台：Windows 具名管線、其他 unix socket），連不到的管線只關自己那個 id。
   - Windows 子程序（`node --import tsx`，真 node-pty 1.1.0，vitest 程序本身不被替換）：`installed`；3 個 PTY 各 3000 行完整依序、exit 0；全程只有 1 個 Worker；`exit 7` → 7；大量輸出中 kill 後 onExit（< 5 s，手動探針 116–120 ms）；最後一個 PTY 後 Worker 結束、事件迴圈自己結束（< 15 s，手動探針 4.8 s，stock 同樣 4.8 s）。
   - source guard：electron/ 只有 `server.ts` 呼叫 `installSharedConout`（一次）、在 `createPty` 的 `pty.spawn(` 之前；`shared-conout.ts` 不 import electron、沒有頂層呼叫；vite 輸出 Worker。
3. **既有 e2e**（Windows）：
   - 原始碼建置（`npx vite build`）：`t0572-new-pty-initial-size` 1 passed、`t0578-recovery-no-direct-shell` 2 passed、`t0704-heartbeat-recovery` 1 passed（4 passed，3.2 m）。
   - 打包版（`npm run build:dir`，`BAT_E2E_EXECUTABLE=release\win-unpacked\BetterAgentTerminal.exe`，隔離 runtime、`LOCALAPPDATA` 指到暫存）：`t0859-pty-holder` 1 passed（server 從 holder `bat-pty-holder.exe` 啟動、分頁執行命令、改 holder 檔 → fallback fork）、`t0861-holder-reattach` 1 passed（升級 quit 保留 holder → 重開自動接回同一個 shell）。第一次跑 T0859 失敗：我給的 `BAT_E2E_EXECUTABLE` 用了正斜線，spec 以字串比對 `ExecutablePath`（反斜線）；改用 Windows 路徑後通過，不是產品問題。
   - T0540：沒有名為 T0540 的 e2e spec；T0540 的順序由單元測試 `terminal-server-kill-tree.test.ts`（在全套單元測試內，通過）與 T0578 / T0704 spec 的 taskkill 路徑涵蓋。
   - `node scripts/verify-packaged-native.js --platform win --out release`：✅（含 `PTY holder matches its manifest`、stdio addon loads）；packaged holder manifest 列出 `shared-conout-worker.cjs`，`app.asar.unpacked/dist-electron/` 有該檔。
4. **記憶體**（`experiments/node-pty-worker/bat-memory/`，BAT 原始碼建置、隔離 runtime，N 個閒置 pwsh 分頁全部出提示後等 10 s，Terminal Server 自己的 Private Bytes，3 次中位數；base = `06c3b884` 以 `git archive` 解到 scratchpad、共用本 worktree 的 node_modules 建置）：

   | 分頁 | base Terminal Server | 本分支 | base 執行緒 | 本分支執行緒 | base 框架合計 | 本分支框架合計 |
   |---|---|---|---|---|---|---|
   | 1 | 37.3 MB | 37.1 MB | 18 | 18 | 372.2 MB | 376.3 MB |
   | 5 | 96.1 MB | 38.1 MB | 26 | 22 | 510.7 MB | 462.1 MB |
   | 10 | 164.6 MB | **38.8 MB** | 37 | 27 | 655.5 MB | 528.3 MB |

   - 目標 10 分頁 < 45 MB：**PASS**（38.8 MB）。打包版（app.asar 路徑、fork，沒有 holder）10 分頁 3 次：41.2 / 39.9 / 43.8 MB，中位數 41.2 MB、執行緒 27，確認打包後也有替換。
   - 所有分頁出提示的時間沒有差別（中位數 base 1052 / 1038 / 1232 ms、本分支 986 / 1134 / 1147 ms）。
   - 量測期間使用者的 BAT 也在跑（同 T0885 / T0886 條件）。
5. **holder**：`scripts/__tests__/pty-holder.test.mjs` 與 `electron/__tests__/pty-holder.test.ts` 共 59 個全過（含新測試）。holder 內容改變（多 `shared-conout-worker.cjs`，key 改變）→ **合併後需跑 W6 `windows-upgrade-acceptance.yml`，由塔台取得授權後觸發**；本單沒有觸發任何 workflow、沒有在開發機跑 W6 spec。
6. **相關通過案例**：見下節。

### 相關通過案例

| 案例 | 判定 | 依據 |
|---|---|---|
| T0540 關閉分頁的程序樹（`endPty` 先 `killProcessTree` 再 `pty.kill()`、`shutdown()` 順序） | 不變 | `server.ts` 的 `endPty` / `shutdown` 沒改；`pty.kill()` 內部的 `dispose` 改由共用 Worker 排空 1 s，時間與原本相同；`terminal-server-kill-tree.test.ts` 通過 |
| T0572 新 PTY 初始尺寸 | 不變 | spawn 參數沒改；e2e 通過 |
| T0578 Recovery hold | 不變 | 主行程沒改；e2e 2 項通過 |
| T0704 heartbeat / recovery | 不變 | e2e 通過；recovery 的 re-fork 是新程序，第一次 spawn 前重新安裝 |
| T0857 協定 v1 | 不變 | 協定訊息與欄位沒改（安裝結果只寫 stderr） |
| T0861 holder 接回 | 不變 | e2e 通過（同一個 shell 接回） |
| T0866 stdio guard | 不變 | Worker 是執行緒不是子程序；打包檢查 stdio addon loads |
| T0806 / T0807（Linux fd） | 不變 | 非 win32 不執行新程式碼 |
| W6 真實升級情境 | **待驗**：holder 內容改變 | 合併後由塔台觸發 `windows-upgrade-acceptance.yml` |
| 版本或形狀不符時 | 與現況逐字相同 | 單元測試確認 export 不變 |

`T0578` 的 teardown 兩次記錄 `app.close() did not finish within 20 s — killing the Electron process`：在 base（`06c3b884`）建置跑同一個 spec 也一樣兩次，屬既有現象（開發建置沒有 stdio addon，BUG-213 fail open），不是本單造成。

### 遭遇問題

1. **第一次手動探針卡住（17:47–17:49）**：scratchpad 探針 `child.cjs` 用真 node-pty 跑 5 個 PTY，`| tail` 緩衝讓我看不到進度，超過 120 s 被移到背景。查程序樹（只看探針之後建立、父程序是探針的程序）：5 個 PTY 的程式都已結束，只剩探針 node 與 5 個 conhost。原因：探針在 PTY 自然結束後沒呼叫 `kill()`，node-pty 不 `dispose`（node-pty#887）；stock 對照一樣不會自己結束（剩 4 個 Worker）。之後探針比照 T0886 `check.cjs` 與 BAT 的 `endPty` 在 exit 後呼叫 `kill()`，兩者都在 4.8 s 內自己結束。
   - 清理：以 TaskStop 停掉該背景工作，結束的是探針與其子孫：node.exe 45136、conhost.exe 34056 / 37128 / 35700 / 37100 / 46648 / 35036、bash.exe 44192 / 28304 / 17392（都是 17:47:51 之後由該背景工作建立）。事後確認這些 PID 都已不存在。沒有以名稱或父 PID 大範圍結束程序。
   - 之後所有測試 / 量測 / e2e 的程序都自己結束或由 e2e fixture `closeIsolated` 結束（fixture 只在 Terminal Server 的命令列符合本 repo 時才結束它；各 spec 日誌都是 `alive after teardown: false`）。收尾時查無 `T0887` 路徑、`bat-t0887`、探針相關的殘留程序。
2. **node-pty#887（不在本單範圍，記錄）**：PTY 自然結束而沒呼叫 `kill()` 時 node-pty 不 `dispose`。Terminal Server 的 `handlePtyExit` 刪除項目但不 `kill()`，之後的 `pty:kill` 也找不到項目 → 現況每個自然結束的分頁留下一個約 14 MB 的 Worker 直到 server 結束；共用版只留下一個轉送（幾個 socket）。建議另案：`handlePtyExit` 後呼叫 `kill()`（或只呼叫 agent 的 `dispose`），需評估對 T0540 順序與 exit code 的影響。
3. Python heredoc 寫 `\\n` 在兩處變成真的換行（`server.ts` 一處、holder fixture 一處），已以 Edit 修正並經測試確認。
4. 開發機有其他程式（含使用者的 BAT）同時執行，時間類數字僅供參考；Private Bytes 不受影響。

### 子代理與 Workflow 使用

（無：沒有使用子代理或 Workflow）

### Renew 歷程

（無）

### 方法論狀態回寫

（不適用：本單沒有 `methodology`）

### 建議下一步

- 塔台合併 `ct/T0887` 到 `v0.8.x` 後，取得授權跑 W6 `windows-upgrade-acceptance.yml`（holder 內容改變）。
- （選用，另案）Terminal Server 自然結束的 PTY 也 `dispose`（遭遇問題 2）。
- （選用，另案）把 `[shared-conout]` 結果經協定欄位讓主行程記錄（目前只在 server stderr，主行程看不到）。

### 回報時間

2026-11-23T18:08:48+08:00
