---
schema_version: 1
schema_kind: workorder
id: T0889
title: "修正：共用 conout Worker 反覆開關分頁的記憶體增加（BUG-214）與多分頁大量輸出的吞吐量（BUG-215），在 `v0.8.x` 分支"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: L
created_at: "2026-11-23T22:04:16+08:00"
updated_at: "2026-11-24T00:55:03+08:00"
completed_at: "2026-11-24T00:53:37+08:00"
session_ids:
  - "db49c006-7c6f-4b04-9e66-98d62991fec2"
started_at: "2026-11-23T22:06:05+08:00"
depends_on: [T0887, T0888]
related:
  - "PLAN-066；BUG-214 / BUG-215；D309 / D311 / D312；T0887（實作，回報區〈遭遇問題〉2 node-pty#887）；T0888（量測 spec `e2e/t0888-shared-conout-stress.spec.ts`、`experiments/node-pty-worker/acceptance/`、`results/t0888-*.csv`，〈發現〉F1–F4）；T0886（修正版程序清理規則）；T0859 / T0861（holder）"
affects_files:
  - _ct-workorders/T0889-fix-shared-conout-churn-and-throughput.md
  - electron/terminal-server/shared-conout.ts
  - electron/terminal-server/shared-conout-worker.cjs
  - electron/terminal-server/server.ts
  - electron/__tests__/shared-conout*.test.ts
  - e2e/t0888-shared-conout-stress.spec.ts
  - experiments/node-pty-worker/**
  - docs/agent-guide/terminal-server-recovery.md
  - docs/agent-guide/pty-holder.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
workdir: worktree ct/T0889（塔台已預先從 `v0.8.x` 建立分支 `ct/T0889`，`fd466fb3`）
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0889` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `fd466fb3b30cc1f1ce64ceda805f2d3460b50093`，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 會是與 main 的共同祖先 `06c3b884`，屬預期，不是錯誤）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只改 `affects_files` 列的檔案。需要改其他檔（例：新增 Worker 檔而要動 `vite.config.ts`、`scripts/pty-holder.cjs`、`scripts/verify-packaged-native.js`、`package.json`）→ 先問塔台。node-pty 版本固定 1.1.0，不升級、不 patch `node_modules`。非 win32 與 direct 模式的行為不得改變。"
  - "🔴 依賴：worktree 內 `npm ci`（不改 lock、不新增依賴、不改 `allowScripts`）。"
  - "🔴 不碰使用者正在用的 BAT（安裝版 `0.0.0-exp.18`）與其 Terminal Server / `bat-pty-holder`：`C:\\Program Files\\BetterAgentTerminal`、`%LOCALAPPDATA%\\BAT-PtyHolder`、`%ProgramFiles%\\BAT-PtyHolder` 只能列檔；不安裝、不解除安裝任何 BAT、不執行 NSIS 安裝檔。holder 情境一律把 `LOCALAPPDATA` 指到暫存（比照 T0888 的 `BAT_T0888_HOLDER=1`）。🔴 不跑 `t0859-pty-holder.spec.ts`（本機有 per-machine holder 時會從使用者的 holder 目錄啟動程序，T0888 F6）。不觸發任何 GitHub workflow、不在開發機跑 W6 spec。"
  - "🔴 程序清理（T0886 / T0887 / T0888 規則，D308 曾誤殺 8 個無關程序）：只結束本單啟動之後建立、且可追溯到本單啟動的程序；一次一個、不 `taskkill /T` 整棵樹；不得以程序名稱或父 PID 大範圍結束程序。回報區寫明手動結束的 PID（只記 PID 與映像名稱）。收尾確認沒有本單留下的程序。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。Git：worktree 用 `git add <明確路徑>`（不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。日誌與結果檔不記 PTY 內容、權杖、env。下載的 zip / 解壓目錄放在 repo 外的暫存目錄，不 commit 任何二進位檔。"
---

# T0889 — 修正：共用 conout Worker 的開關分頁記憶體增加（BUG-214）與大量輸出吞吐量（BUG-215）

## 元資料

- **工單編號**：T0889
- **任務名稱**：共用 conout Worker 的兩項量測未達條件，查原因並修正
- **狀態**：DONE（Worker 回報 PARTIAL，塔台收尾，見文末）
- **類型**：implementation
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-23 22:04 (UTC+8)

## 背景

T0887 讓 Windows Terminal Server 整個程序共用一個 node-pty 1.1.0 conout Worker（`electron/terminal-server/shared-conout.ts`、`shared-conout-worker.cjs`，`installSharedConout` 只在 `server.ts` 呼叫）。T0888 對 CI 產物（N＝`0.0.0-exp.18`）、`build:dir`＋holder（H）與 `v0.7.5-pre.2`（O）做回歸與量測：回歸全過、10 分頁 Terminal Server N 35.4 / H 42.4 / O 159.1 MB，但兩項沒達條件（D311）。使用者裁示「先修再發」`v0.8.0-pre.1`（D312）。

- **BUG-214**（T0888 F1）：保持 10 個分頁、另一個分頁反覆開關，N 300 次 +17.1 MB（第 225 次後持平約 56 MB）、H 100 次 +22.5 MB；O −10.3 MB。全部關閉、共用 Worker 結束後會降回來。
- **BUG-215**（T0888 F2）：10 分頁 × 20,000 行同時輸出，完成時間中位數 N 5814.5 ms、O 4674 ms（+24.4%，門檻 20%）；H +17.4%。輸出完整。
- 同類觀察 **F4**（既有，O 也有）：分頁自然 `exit` 後，每個分頁的 conhost 留到 Terminal Server 結束（node-pty#887：自然結束的 PTY 沒有被 dispose）。

數據與重現方式見 T0888 回報區〈驗收結果〉〈發現〉與 `experiments/node-pty-worker/results/t0888-c2.csv`、`t0888-c4.csv`。

## 範圍

### 1. BUG-214：先找原因，再決定修法

1. 重現（原始碼建置即可，`npx vite build` 後以 `BAT_T0888_*` 跑 C2①，或寫更小的重現在 `experiments/node-pty-worker/`）。
2. 分辨增加的是什麼：共用 Worker 或主執行緒裡每個連線沒釋放的狀態（socket / named pipe、MessagePort、Map 項目、listener、緩衝），還是 V8 / Node heap 的高水位（例如強制 GC 或 heap snapshot 比對後就不見）。寫明用什麼方法判斷、得到什麼數據。
3. 是 BAT 自己沒釋放的 → 修，讓分頁關閉時釋放該連線在 Worker 與主執行緒的全部狀態；只是 heap 高水位、沒有每個連線累積 → 不硬修，回報區寫證據，塔台另行裁示。
4. F4（自然結束的 conhost 殘留）：在同一段程式（PTY 結束 / 連線釋放）看能否安全地在 PTY 自然結束時讓 conhost 結束（例如在 exit 後釋放該 PTY 的 conout 與 agent）。🔴 只有確定不影響 T0540 的程序樹結束順序（先 `killProcessTree` 再 `pty.kill()`）、⏻ 重啟（T0539）、Terminal Server recovery（T0704）時才改；否則只記錄。

### 2. BUG-215：改善同時大量輸出的吞吐量

1. 先量出瓶頸在哪（Worker 讀取、跨執行緒傳遞、主執行緒寫出、TCP / IPC 轉送）。
2. 優先在轉送路徑上改善（批次、減少複製或傳遞次數等）。若必須改成少量 Worker（例如每 N 個 PTY 一個），條件是 C1 仍達標。
3. 🔴 不得改回每個 PTY 一個 Worker；不得造成輸出遺漏、亂序或延遲變大到使用者看得出來（單一分頁互動輸入的回顯延遲要量，與修改前比較）。

### 3. 量測與驗收（沿用 T0888 spec 與方法）

- 新建置（worktree `npx vite build` 的原始碼建置，以及 `npm run build:dir` ＋ `BAT_T0888_HOLDER=1` 的 H）跑 T0888 spec：C1、C2（① 300 次＋②）、C3、C4（與 O 交錯各跑 ≥ 6 次，兩輪順序對調）、C5、C7。C6 30 分鐘只跑 H 一次。O 用 `v0.7.5-pre.2` 的 win zip（`gh release download v0.7.5-pre.2 -R gowerlin/better-agent-terminal -p "BetterAgentTerminal-0.7.5-pre.2-win.zip"`，T0888 若已下載在 `%TEMP%\t0888\` 可沿用，先核對 SHA-256 `1de36a81…ea214`）。
- 可以修改 `e2e/t0888-shared-conout-stress.spec.ts`（例如加測量點、單一分頁回顯延遲），但不得放寬 T0888 的條件；結果寫 `experiments/node-pty-worker/results/t0889-*.csv`。
- 修改前後對照：同一台機器、同一份 spec，先量修改前（`fd466fb3`）再量修改後。

## 驗收

1. `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、`npm run test:unit` 全過；`electron/__tests__/shared-conout*.test.ts` 補上本單行為的測試（每個連線關閉後狀態歸零、轉送路徑的新行為）。
2. BUG-214：C2① N（原始碼建置）與 H 300 次增加 ≤ 5 MB；或依範圍 1-3 證明不是每個連線累積並附數據（此時回報 PARTIAL，由塔台裁示）。
3. BUG-215：C4 新建置相對 O 的完成時間中位數 ≤ +20%。
4. 不回歸：C1（10 分頁 < 45 MB、每多一個分頁 ≤ 0.5 MB）、C2②、C3、C5、C7 仍達標；T0888 B 段的 9 個指定 e2e（`t0539`、`t0572`、`t0578`、`t0704`、`t0741`、`t0742`、`t0532`、`detached-terminal-persistence`、`v072-pre6-terminal-links`）以新建置重跑全過，H 跑 `t0861-holder-reattach`、`t0860-installer-quit-holder`。
5. 文件：`docs/agent-guide/terminal-server-recovery.md`（共用 conout Worker 一節）更新行為、量測數據與已知限制；CLAUDE.md 只在不變式改變時改（遵守該檔「CLAUDE.md 撰寫規則」）。
6. 回報區列：原因判斷與證據、修法、修改前後對照表（C1–C5、C7，H 的 C6）、單一分頁回顯延遲、F4 的處置、`shared-conout-worker.cjs` 是否改變（改變 → holder key 改變，塔台發版前要跑 W6）、手動清理的 PID、收尾殘留檢查。
7. 停止條件：兩項之中任一項在合理嘗試後仍無法同時滿足「該項條件」與「不回歸」→ 保留已完成且達標的部分（各自獨立 commit），回報 PARTIAL，附數據與可選方案，不放寬條件。

## 不做

- 升級或 patch node-pty、改 node-pty 以外的套件。
- 改 holder 的打包 / 安裝 / 升級流程（`scripts/pty-holder.cjs`、`build/installer.nsh`、`electron/installer-quit-request.ts`）；需要時先問塔台。
- macOS / Linux 的任何改動。
- 跑 `t0859`、W6、任何 workflow；安裝 / 解除安裝 BAT；push、合併、發版。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：PARTIAL（BUG-215 達標並已修；BUG-214 依範圍 1-3 判定為 heap／runtime 高水位、不是每個連線累積，附數據與方案，待塔台裁示；其中真的每連線殘留（conin socket）已修）
- **完成時間**：2026-11-24 00:53 (UTC+8)
- **session_id**：db49c006-7c6f-4b04-9e66-98d62991fec2

### 落點檢查

- PASS。C-0：frontmatter `repo` = `better-agent-terminal`、`basename "$CT_HOME"` = `better-agent-terminal`。C-1：工單在 `$CT_HOME/_ct-workorders/` 下。C-3：前 5 個可測路徑都存在（PASS）。C-2：工單沒有 `branch` 欄位。
- `CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0889`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`。
- 開工確認 `git merge-base HEAD v0.8.x` = `fd466fb3b30cc1f1ce64ceda805f2d3460b50093`（符合）；`CT_WORKTREE_BASE` = `06c3b884…`（與 main 的共同祖先，預期）。
- 依賴：worktree 內 `npm ci`（不改 lock；結尾只有 `electron-winstaller` 的 install script 提示，屬預期）；Electron binary 以 `node node_modules/electron/install.js` 下載。

### SHA

- `branch`：`ct/T0889`
- `base_sha`：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`；本單實際起點 `fd466fb3`，見上）
- `validated_sha`：`0da884708aadf970fd5d423f6e0ffb3855246888`（產品程式最後一個 commit；typecheck、`test:unit`、`build:dir`、所有量測與 e2e 都在這個產品內容上跑）
- `head_sha`：`c552ff73f77bde86e0ab462ebd19bab54fbe36c4`
- `validated_sha` ≠ `head_sha` 的原因：之後兩個 commit 只有 `e2e/t0888-shared-conout-stress.spec.ts`（量測時就是這份內容，當時未 commit）、`experiments/`、結果 CSV 與文件（`docs/`、`CLAUDE.md`），沒有產品程式，不需重新驗證。

| commit | 內容 |
|---|---|
| `b1014226` | fix：共用 conout Worker 原始位元組批次轉送（BUG-215）＋ Worker 單元測試 |
| `0da88470` | fix：釋放 Terminal Server 結束的 PTY 的 conin socket（BUG-214 的每連線殘留）＋ `shared-conout-release.test.ts` |
| `4dd229c7` | test：T0888 spec 支援原始碼建置／結果前綴／C4 事件數／C8 回顯延遲；`experiments/node-pty-worker/churn-repro/`；`results/t0889-*.csv` |
| `c552ff73` | docs：`terminal-server-recovery.md`、`pty-holder.md`、`CLAUDE.md` |

### 原因判斷與證據

**BUG-215（吞吐量）：瓶頸在「每段輸出一則訊息」，不在 Worker 讀取速度。**
- 方法：在建置好的 `terminal-server.js` 暫時加診斷碼（不 commit，量完重建），每 500 ms 記錄主執行緒與共用 Worker 的 event-loop 使用率（ELU）；spec 在 renderer 端統計輸出事件數。
- 數據（修改前，C4 1 次 5734 ms）：Terminal Server 在約 2.5 s 內就讀完全部輸出（主執行緒 ELU 0.93–0.98、Worker 0.83–0.97），之後約 3 s 主執行緒 ELU 只有 0.095、renderer 仍在收。ConPTY 每段只有約 10 字元（不經 app 的重現：10 分頁 1.89 M 字元約 20 萬段），每段都變成一次 `onData`、一則 Terminal Server 訊息與一則 IPC。不經 app 時 original／shared／只拿掉解碼三者都約 2.15 s（`results/t0889-throughput-repro.csv`），所以差距出在下游的訊息數。

**BUG-214（開關分頁的記憶體增加）：heap／runtime 高水位，不是 BAT 的每連線累積；另找到一個真的每連線殘留並已修。**
- 每連線殘留：Terminal Server 主執行緒的 active `Socket` handle 從 20 增加到 480–500（C2 後），每關一個 PTY 多一個。重現程式判定是 node-pty 1.1.0 的 conin 寫入 socket（`-wPipe`，`WindowsPtyAgent.inSocket`），`kill()` 與 exit 路徑都不 destroy 它。original（每個 PTY 一個 Worker）也一樣，是既有問題。單個成本很小（Electron node＋pwsh 重現開關 300 次 −4.7 MB）。
- 高水位證據：
  - 每 10 s 在主執行緒強制 GC 的診斷版 C2①：修改前 +0.8 MB、修改後 +0.3 MB；不 GC 時 +16～18 MB。heap used 一直在 4.6–5 MB。
  - heap space：新生代提交量 2 → 13.5 MB（使用 0.5 MB）、老生代 +3～6 MB。執行期 `v8.setFlagsFromString('--max-semi-space-size=1')` 無效（新生代照樣 13.5 MB）。
  - 不經 app 直接驅動建置好的 Terminal Server（`churn-repro/ts-churn.mjs`）：都不帶 +3.3 MB；只有 userData +5.0 MB；每次 `pty:create` 帶完整 env（app 的做法）+17.2 MB；兩者都帶 +16.5 MB。O 的 Terminal Server 在「只帶 env」情境 +27.8 MB → 既有行為，不是共用 Worker 造成。T0888 在 app 中量到 O −10.3 MB，是每個 PTY 一個 Worker 的大幅波動蓋掉了它。
  - holder（官方 Node 24.22.2）：只帶 env +45.0 MB，每 10 s 強制 GC 仍 +38.1 MB（JS heap GC 後約 8 MB、rss 59 → 84 MB，增加在 V8／原生層保留的記憶體），`--max-semi-space-size=1` 啟動 +12.7 MB。
  - 修改後主執行緒 socket 數全程 20 個、Worker heap 與 handle 數固定。
- 依範圍 1-3：不硬修，改列方案（見〈可選方案〉）。

### 修法

1. **批次轉送（`shared-conout-worker.cjs`）**：Worker 轉送原始位元組（不再 `setEncoding('utf8')`；主執行緒 node-pty 的 socket 照舊以 UTF-8 解碼，跨段多位元組字元由它的 decoder 接起來）。每個轉送距上次送出 ≥ `RELAY_BATCH_MS`（4 ms）就立刻送（打字回顯不延遲），否則累積到 4 ms 或 `RELAY_BATCH_MAX_BYTES`（256 KiB）才送。保留原 `pipe()` 的行為：client 寫不進去時暫停讀 conout、`drain` 後恢復；第一個 client 連上前不讀 conout；conout 結束時先送完待送位元組再結束 client；`close` 清掉計時器與待送資料、關閉 conout 連線、client 與 server。仍是一個共用 Worker（沒有改回每個 PTY 一個、也沒有增加 Worker）。
2. **conin socket 釋放（`shared-conout.ts` `releaseEndedPtyInput`、`server.ts` `handlePtyExit`）**：BAT 自己結束的 PTY（kill／⏻ 重啟／shutdown：exit 時已不是該 id 的 entry）在 exit 回呼之後（`setImmediate`）destroy 它的 conin socket；非 win32 不呼叫，形狀不符不碰。自然結束的 PTY 不動（見〈F4 的處置〉）。T0540 的程序樹結束順序不變（釋放發生在 exit 之後）。

### 修改前後對照

同一台機器、同一份 spec。O = `v0.7.5-pre.2`（沿用 `%TEMP%\t0888\`，zip SHA-256 `1de36a81…ea214` 核對相符）；B0 = 修改前 `fd466fb3` 的 `build:dir`（無 holder）；src-before = 修改前原始碼建置；N = 修改後原始碼建置；H = 修改後 `build:dir`＋`BAT_T0888_HOLDER=1`。原始列在 `experiments/node-pty-worker/results/t0889-c1.csv` … `t0889-c8.csv`（診斷版另存 `t0889-diag-*.csv`）。

| 情境 | 條件 | O | 修改前 | N（修改後） | H（修改後） | 判定 |
|---|---|---|---|---|---|---|
| C1 10 分頁 | < 45 MB | — | B0 35.8 MB | 34.7 MB | 42.6 MB | ✅ |
| C1 10 → 30 分頁每分頁 | ≤ 0.5 MB | — | B0 +0.15 | +0.17 | +0.17 | ✅ |
| C2① 300 次 | ≤ 5 MB | — | src-before +17.8；B0 +10.0 | +7.8 / +16.4 / +10.1（強制 GC 診斷版 +0.3） | +45.1 | ❌（高水位，見上） |
| C2② 20 輪全關再開 | ≤ 5 MB | — | src-before −7.5；B0 +1.3 | +11.1 / +0.7 / +10.2（同程式另 4 次 +1.2～+2.1） | +11.1 | ⚠️ 波動，見〈遭遇問題〉2 |
| C3 20 分頁自然結束 | 不崩、可再開 | — | B0 40.7 → 35.8 → 37.6 | 40.3 → 35.5 → 37.3 | 41.9 → 42.5 → 43.7 | ✅（conhost 20 個留著 = F4） |
| C4 10 × 20,000 行完成中位數（6 次，兩輪對調；H 3 次） | 相對 O ≤ +20% | 4788 ms | B0 6850 ms（+43%） | **2390.5 ms（−50.1%）** | 2154 ms（−55.0%） | ✅ |
| C4 峰值 | — | 345–354 MB | B0 263–266 MB | 51–55 MB | 71–72 MB | — |
| C4 renderer 輸出事件數 | — | — | 3529 | 1235–1405 | — | — |
| C4 輸出完整（完成標記、最後 200 行序號） | 全部 | ✅ | ✅ | ✅ | ✅ | ✅ |
| C5 5 個大量輸出中的分頁關閉（最長） | 每個 < 5 s、server 存活 | — | B0 195 ms | 187 ms | 185 ms | ✅ |
| C5 其餘 5 分頁完成後／全關 | — | — | B0 116.9 / 108.3 MB | 39.4 / 32.4 MB | 97.1 / 81.8 MB | ✅ |
| C6 30 分鐘（H 1 次） | ≤ 5 MB | — | — | — | 40.9 → 43.6（+2.7） | ✅ |
| C7 recovery 10 分頁 | < 45 MB、舊 shell 0 | — | B0 42.5 → 39.4、0/10 | 38.5 → 42.3、0/10 | 40.8 → 41.0、0/10 | ✅ |

### 單一分頁回顯延遲（C8，新增）

一個分頁每次送 1 個字元，量 renderer 收到該分頁下一段輸出的時間，40 次；再讓另外 9 個分頁各印 200,000 行時量一次。各 3 次。

| | O | B0（修改前） | N | H |
|---|---|---|---|---|
| 閒置 中位數 | 31.0 / 31.1 / 31.3 ms | 31.0 / 31.1 / 31.1 ms | 31.4 / 31.4 / 30.9 ms | 31.2 / 31.0 / 31.1 ms |
| 閒置 p95 | 32.4–33.9 ms | 32.7–33.4 ms | 32.2–35.1 ms | 32.1–33.2 ms |
| 9 分頁大量輸出時 中位數 | 31.5–31.9 ms | 31.3–32.3 ms | 16.1 ms | 16.0 ms |
| 同上 p95／5 s 逾時次數 | 1.6–4.3 s／6 | 3.2–4.4 s／7 | 17.1–17.6 ms／0 | 16.7–17.2 ms／0 |

閒置回顯不變（批次規則：距上次送出 ≥ 4 ms 就立刻送）；大量輸出時明顯改善。O／B0 量測時大量輸出在中途就結束了（逾時拖長量測），N／H 量完時 9 個分頁都還在輸出。

### 驗收結果

1. ✅ `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功（`npm run build:dir` 也成功）、`npm run test:unit` 463 檔／8447 項全過（41 skipped）。新測試：`shared-conout.test.ts`〈T0889: the real Worker script batches raw bytes〉5 項（位元組完全相同且段數 < 1/10、含被切開的 UTF-8 字元；靜默後立即送；client 不讀時暫停且恢復後不漏；conout 結束在待送位元組之後；close 後 conout 連線與 client 關閉、`<pipe>-worker` 不再聽）；`shared-conout-release.test.ts` 8 項（含 Windows 真 node-pty：5 個 PTY 開關後 conin socket 回到基準、自然結束的保留 1 個）。
2. ⚠️ BUG-214：C2① N（原始碼建置）+7.8～+16.4 MB、H +45.1 MB，未達 ≤ 5 MB；依範圍 1-3 證明不是每連線累積（數據見〈原因判斷與證據〉），本項回報 PARTIAL。
3. ✅ BUG-215：C4 N 相對 O −50.1%（H −55.0%），條件 ≤ +20%。
4. ✅（C2② 例外見〈遭遇問題〉2）不回歸：C1、C3、C5、C7、C6（H）達標。9 個指定 e2e 以修改後原始碼建置重跑 10 passed（`t0539`、`t0572`、`t0578`、`t0704`、`t0741`、`t0742-terminal-drop-path`、`t0532`、`detached-terminal-persistence`、`v072-pre6-terminal-links`）；H 跑 `t0861-holder-reattach`、`t0860-installer-quit-holder` 2 passed（holder key `24.22.2-7a21c053bf76`，marker 已移除）。
5. ✅ 文件：`docs/agent-guide/terminal-server-recovery.md`（共用 conout Worker 一節：必守規則、唯一實作、生命週期、F4、T0889 量測、已知限制、驗證）、`docs/agent-guide/pty-holder.md`（holder key 改變 → W6）、`CLAUDE.md`（共用 conout 一點補兩條不變式：批次轉送、conin 釋放）。
6. 見本區各節。

### F4 的處置

只記錄，不改。評估：自然結束時要讓 conhost 結束只能 `ClosePseudoConsole`（node-pty 只經 `kill()`），或關掉 conin。兩者都會讓仍掛在該主控台上的程序（shell 結束前啟動、仍附著主控台的子程序）失去主控台；`kill()` 另外會 fork 一個 console list agent，失敗時 5 s 後對已結束的 shell pid 呼叫 `process.kill`（pid 重用風險）。這與 T0540／T0539／T0704 無關，但屬行為改變，依工單「否則只記錄」。conin 釋放因此也只套用在 BAT 自己結束的 PTY。

### `shared-conout-worker.cjs` 是否改變

**有改變**（`terminal-server.js` 也改了）→ holder key 由 `24.22.2-f2630bed1fc5` 變成 `24.22.2-7a21c053bf76`。合併後發版前要跑 W6 `windows-upgrade-acceptance.yml`（本單未觸發任何 workflow）。

### 可選方案（BUG-214，待塔台裁示）

- **A. Terminal Server 以 `--max-semi-space-size=1` 啟動**（Worker 建議先評估這個）：holder 只帶 env 情境 +45.0 → +12.7 MB；Electron node app-like +16.5 → +7.6 MB。需要改 `electron/main.ts` 的 fork 參數（`terminalServerForkOptions` 的 `execArgv`）與 holder 啟動參數（`holderSpawnSpec`），兩者不在本單範圍；holder 啟動參數改變另需檢查 T0861 的接回判斷與 W6。吞吐量影響（新生代較小 → scavenge 較頻繁）未量，要另量 C4／C8。單獨使用仍可能超過 5 MB。
- **B. 主執行緒在關閉分頁後節流觸發 GC**（例如閒置時最多每 30 s 一次）：Electron node 情境可降到 +0.3～+0.8 MB；但要在執行期 `v8.setFlagsFromString('--expose-gc')`（Node 文件不保證啟動後改旗標的行為），且對 holder（官方 Node）效果有限（強制 GC 仍 +38.1 MB）。Worker 不建議。
- **C. 接受為已知限制**：有上限並持平（T0888 第 225 次後持平），不是每連線累積；舊版（O）也有，而且 O 光 10 個閒置分頁就比 N 多約 120 MB。文件已寫入〈已知限制〉。
- 另：app 每次 `pty:create` 送完整 env 是觸發因素，若改成主行程只送差異也可減少，但牽涉 `pty-manager.ts` 與協定，範圍更大。

### 手動結束的程序

- spec 自己結束的 Terminal Server（C7，各一個、無 `/T`、執行檔先核對）：`30860 electron.exe`（N）、`40340 BetterAgentTerminal.exe`（B0）、`38476 bat-pty-holder.exe`（H）。
- 第一次 B0 C7 時 runner 傳的路徑混用 `/` 與 `\`，spec 判定 `40932` 不是本測試的 server 而**沒有**結束它（保護機制正確）；事後確認該程序已隨 app 結束、不存在。修正 runner 後重跑 B0 C7 通過。
- 我沒有用 taskkill 手動結束任何程序。重現程式只以 `taskkill /F /PID <shell>`（無 `/T`）結束它自己 spawn 的 cmd／pwsh；驅動程式以 `server:shutdown` 結束它 fork 的 Terminal Server（每次都 `tsExited: true`）。

### 收尾殘留檢查（2026-11-24 00:49，唯讀）

- 本單開始後建立、執行檔在 worktree、`%TEMP%\t0889`、`%TEMP%\t0888`、`%TEMP%\bat-t08*` 底下的程序：0 個。
- `bat-pty-holder.exe` 只有使用者自己的 27336（20:33 建立，早於本單，`%ProgramFiles%\BAT-PtyHolder\24.22.2-f2630bed1fc5`）。
- 本單開始後建立、父程序已不在的 pwsh／conhost／OpenConsole／cmd／node／electron／BetterAgentTerminal：0 個。
- runtime userData：只剩 `BetterAgentTerminal-runtime-e2e-t0609-1793616886860`（本單之前就有，未動）。`%TEMP%\bat-t0888-*`、`%TEMP%\t0889*`：已全部移除（含修改前建置的複本與診斷檔）。H 的 marker 已移除。
- `git -C "$CT_WORKTREE" status --porcelain`：空。

### 相關通過案例判定

不適用（工單沒有〈相關通過案例〉）。

### 遭遇問題

1. 量測期間同機有使用者的 BAT（安裝版）在跑；時間類數字（C4、C5、C8）僅供參考，Private Bytes 不受影響。H 的 C6 與 holder 驅動程式（`ts-churn.mjs --holder`）部分時間重疊（兩者都只量記憶體，量的是不同程序）。C4 的 O／B0／N 比較沒有和其他測試同時跑。
2. 修改後的 C2②（≤ 5 MB）在 7 次中有 3 次超過（+10.2、+11.1、+14.2）。判定為同一個 heap 高水位的取樣波動（修改前也有 −7.5～+1.3 的大幅波動；強制 GC 版 socket 與 heap 都沒累積，那次 +14.2 是取樣落在兩次 GC 之間），但這是條件未穩定通過的事實，請塔台一併裁示。
3. 第一次 B0 C7 因 runner 路徑格式失敗（見〈手動結束的程序〉），重跑通過。
4. 寫入 spec 與測試時有兩次控制字元／反斜線被殼層處理掉（`'\x03'` 變成實際字元、管線名稱少了反斜線）；單元測試抓到後已修正，commit 的內容正確。
5. 〈塔台補充〉檢查：〈驗證前〉與〈產品 commit 前〉兩個節點沒有跑標題 grep，〈填回報前〉才跑；工單沒有任何 `## 塔台補充（…）` 段落，不影響結果。
6. 依 T0888 F6 沒有跑 `t0859`；沒有跑任何 workflow、W6；沒有安裝／解除安裝 BAT。

### 子代理與 Workflow 使用

未使用。

### 互動紀錄

無（yolo，沒有向塔台提問；工單沒有〈塔台補充〉）。

### 建議下一步

1. 塔台裁示 BUG-214：Worker 建議開一張工單評估方案 A（`main.ts` fork 與 holder 啟動參數加 `--max-semi-space-size=1`，同時量 C2、C4、C8，並檢查 T0861 接回與 W6），或依方案 C 列為已知限制後發 `v0.8.0-pre.1`。
2. 合併 `ct/T0889` 後、發版前跑 W6（holder key 已變）。
3. direct 模式（`pty-manager.ts`）也有同一個 conin socket 殘留（node-pty 行為），本單依範圍沒改；若要一併處理需另開工單。
4. F4（自然結束的 conhost／轉送／conin 留到 server 結束）維持既有；若要處理，需先決定「shell 結束時是否結束仍附著主控台的程序」。

## 塔台收尾補記

- 2026-11-24 00:55 (UTC+8)：收單核對 PASS（4 個 commit `b1014226` / `0da88470` / `4dd229c7` / `c552ff73` 都在 `affects_files` 內、worktree 乾淨、去識別掃描無命中）。`ct/T0889` 以 fast-forward 合併進 `v0.8.x`（`fd466fb3..c552ff73`），worktree 保留。
- BUG-215 → FIXED（`b1014226`，待發版驗收）。BUG-214：每連線殘留（conin socket）已修（`0da88470`）；剩下的 heap／runtime 高水位，使用者裁示開評估單 **T0890**（〈可選方案〉A：Windows Terminal Server 與 holder 以 `--max-semi-space-size` 啟動），BUG-214 維持 FIXING（D313）。本單其餘不需再做 → 改 DONE。
- `shared-conout-worker.cjs` 已改（holder key `24.22.2-7a21c053bf76`）→ 發版前跑 W6；T0890 完成後一起跑。
- 〈建議下一步〉3（direct 模式 conin 殘留）、4（F4）：維持既有、本批不做。
