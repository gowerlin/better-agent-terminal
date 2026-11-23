---
schema_version: 1
schema_kind: workorder
id: T0890
title: "評估：Windows Terminal Server 與 PTY holder 以較小的 V8 新生代（`--max-semi-space-size`）啟動，降低反覆開關分頁的記憶體高水位（BUG-214），在 `v0.8.x` 分支"
type: implementation
status: PARTIAL
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-24T00:55:03+08:00"
started_at: "2026-11-24T00:57:12+08:00"
updated_at: "2026-11-24T02:38:35+08:00"
completed_at: "2026-11-24T02:38:35+08:00"
session_ids:
  - "647575bc-a643-42bd-b851-ce46a90d9364"
depends_on: [T0889]
related:
  - "PLAN-066；BUG-214；D312 / D313；T0889（回報區〈原因判斷與證據〉〈可選方案〉A、`experiments/node-pty-worker/churn-repro/ts-churn.mjs`、`results/t0889-*.csv`）；T0888（量測 spec `e2e/t0888-shared-conout-stress.spec.ts`）；T0886（程序清理規則）；T0859 / T0861（holder 啟動與升級後接回）"
affects_files:
  - _ct-workorders/T0890-eval-terminal-server-semi-space-flag.md
  - electron/pty-holder.ts
  - electron/main.ts
  - electron/__tests__/pty-holder*.test.ts
  - electron/__tests__/holder-reattach.test.ts
  - e2e/t0888-shared-conout-stress.spec.ts
  - experiments/node-pty-worker/**
  - docs/agent-guide/terminal-server-recovery.md
  - docs/agent-guide/pty-holder.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
workdir: worktree ct/T0890（塔台已預先從 `v0.8.x` 建立分支 `ct/T0890`，`c552ff73`）
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0890` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `c552ff73f77bde86e0ab462ebd19bab54fbe36c4`，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 會是與 main 的共同祖先 `06c3b884`，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只改 `affects_files` 列的檔案。需要改其他檔（例：`scripts/pty-holder.cjs`、`build/installer.nsh`、`electron/installer-quit-request.ts`、`electron/upgrade-interruption.ts`、`electron/terminal-server/**`、`package.json`）→ 先問塔台。node-pty 1.1.0 不動。🔴 V8 旗標只能放在啟動參數（fork 的 `execArgv`、holder spawn 的參數），不得放進 `NODE_OPTIONS` 或任何 env（server 的 env 會疊進每個 PTY，見 CLAUDE.md「Terminal Server 端的 PTY env」）。🔴 macOS / Linux、direct 模式的 fork 參數與行為不得改變（只量了 Windows）。"
  - "🔴 依賴：worktree 內 `npm ci`（不改 lock、不新增依賴、不改 `allowScripts`）。"
  - "🔴 不碰使用者正在用的 BAT（安裝版）與其 Terminal Server / `bat-pty-holder`：`C:\\Program Files\\BetterAgentTerminal`、`%LOCALAPPDATA%\\BAT-PtyHolder`、`%ProgramFiles%\\BAT-PtyHolder` 只能列檔；不安裝、不解除安裝任何 BAT、不執行 NSIS 安裝檔。holder 情境一律把 `LOCALAPPDATA` 指到暫存（`BAT_T0888_HOLDER=1`）。🔴 不跑 `t0859-pty-holder.spec.ts`（T0888 F6）。不觸發任何 GitHub workflow、不在開發機跑 W6 spec。"
  - "🔴 程序清理（T0886 / T0887 / T0888 / T0889 規則，D308 曾誤殺 8 個無關程序）：只結束本單啟動之後建立、且可追溯到本單啟動的程序；一次一個、不 `taskkill /T` 整棵樹；不得以程序名稱或父 PID 大範圍結束程序。回報區寫明手動結束的 PID（只記 PID 與映像名稱）。收尾確認沒有本單留下的程序。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。Git：worktree 用 `git add <明確路徑>`（不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。日誌與結果檔不記 PTY 內容、權杖、env。下載的 zip / 解壓目錄放在 repo 外的暫存目錄，不 commit 任何二進位檔。"
---

# T0890 — 評估：Terminal Server 與 PTY holder 以較小的 V8 新生代啟動（BUG-214）

## 元資料

- **工單編號**：T0890
- **任務名稱**：評估並（條件成立時）採用 `--max-semi-space-size`，降低反覆開關分頁的記憶體高水位
- **狀態**：PARTIAL
- **類型**：implementation
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-24 00:55 (UTC+8)

## 背景

T0889 修好 BUG-215（C4 比 `0.7.5-pre.2` 快約 50%）與 conin socket 每連線殘留，`ct/T0889` 已合併進 `v0.8.x`（`c552ff73`）。BUG-214 仍未達條件：保持 10 個分頁、另一個分頁反覆開關 300 次（C2①），原始碼建置 N +7.8～+16.4 MB、`build:dir`＋holder H +45.1 MB（條件 ≤ 5 MB）。T0889 查證是 V8 / runtime 的記憶體高水位，不是每連線累積：

- 每 10 s 強制 GC 的診斷版 N 只 +0.3 MB；新生代提交量 2 → 13.5 MB（使用 0.5 MB）。
- 執行期 `v8.setFlagsFromString('--max-semi-space-size=1')` 無效；以啟動參數帶上時，不經 app 直接驅動 Terminal Server（`experiments/node-pty-worker/churn-repro/ts-churn.mjs`）：holder（官方 Node 24.22.2）「只帶 env」+45.0 → +12.7 MB；Electron node app-like +16.5 → +7.6 MB。
- 觸發因素之一是 app 每次 `pty:create` 送完整 env（本單不改）。

使用者裁示：再開一張評估單（D313，T0889〈可選方案〉A），做完再跑 W6、發 `v0.8.0-pre.1`。

啟動位置：沒有 holder 的 fork 參數在 `terminalServerForkOptions`、holder 的 spawn 參數在 `holderSpawnSpec`（皆 `electron/pty-holder.ts`，由 `electron/main.ts` `forkTerminalServer` 呼叫）。

## 範圍

1. **加旗標（只限 Windows）**：Windows 上 Terminal Server 的兩條啟動路徑（holder `spawn` 與沒有 holder 的 `fork`）帶 `--max-semi-space-size=<n>`。macOS / Linux 的參數逐字不變。值先試 `1`，可以再比較 `2`（或其他值）後擇一，寫明理由。旗標集中在一個常數（唯一實作），兩條路徑共用。
2. **確認 holder 相容**：
   - holder 程序（`bat-pty-holder.exe`，官方 Node）接受該旗標並正常啟動；確認 holder key 的計算是否因此改變（看 `resolvePtyHolder` / key 的來源，寫明結論）。
   - 升級後接回（T0861 `decideHolderReattach`）不因舊 holder（沒有旗標）與新版（有旗標）不同而失敗；新版接回舊 holder 時不需重啟它。若接回判斷涉及啟動參數，停下問塔台。
3. **量測**（沿用 T0888 / T0889 spec 與方法，同一台機器；「修改前」= `c552ff73` 的建置）：
   - C2① 300 次：N（原始碼建置）與 H 各修改前、修改後；每組 ≥ 3 次（波動大）。
   - C2② 20 輪：N、H 各 ≥ 3 次。
   - C4（與 O＝`v0.7.5-pre.2` 交錯，N ≥ 6 次、兩輪順序對調；H ≥ 3 次）與 C8 回顯延遲（N、H 各 3 次）：確認新生代變小（scavenge 較頻繁）沒有拖慢吞吐量與互動。
   - C1、C3、C5、C7：N、H 各一次；C6 30 分鐘 H 一次。
   - 可在 spec 加測量點，不得放寬 T0888 條件；結果寫 `experiments/node-pty-worker/results/t0890-*.csv`。O 用 `%TEMP%\t0888\` 的 zip（先核對 SHA-256 `1de36a81…ea214`），沒有就 `gh release download v0.7.5-pre.2 -R gowerlin/better-agent-terminal -p "BetterAgentTerminal-0.7.5-pre.2-win.zip"`。
4. **採用判斷**：
   - 採用條件：C2① 增加量明顯下降（N 與 H 中位數都下降），且 C4 相對 O ≤ +20%、C8 閒置中位數與 p95 不比修改前差（差距 ≤ 2 ms）、C1 / C3 / C5 / C7 / C6 達標。
   - 達到 C2① ≤ 5 MB → 回報 DONE；明顯下降但仍 > 5 MB → 保留修改，回報 PARTIAL 並附數據（塔台裁示是否以已知限制發版）。
   - 不符採用條件（吞吐量或回顯變差、holder 不相容、沒有明顯下降）→ 不 commit 產品修改（或另 commit 還原），只留量測與結果檔，回報 PARTIAL 並附數據。

## 驗收

1. `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、`npm run build:dir` 成功、`npm run test:unit` 全過；單元測試守住：Windows 兩條路徑都帶旗標、macOS / Linux 的 `terminalServerForkOptions` 與修改前相同、旗標不出現在 env。
2. 範圍 3 的量測全部完成，回報區有修改前後對照表（C1–C8，H 的 C6）。
3. 範圍 2 的結論（holder key 是否改變、T0861 接回是否受影響）；H 跑 `t0861-holder-reattach`、`t0860-installer-quit-holder` 通過。
4. 不回歸：T0888 B 段 9 個指定 e2e（`t0539`、`t0572`、`t0578`、`t0704`、`t0741`、`t0742`、`t0532`、`detached-terminal-persistence`、`v072-pre6-terminal-links`）以修改後原始碼建置重跑全過。
5. 文件：`docs/agent-guide/terminal-server-recovery.md`（共用 conout Worker 一節的已知限制與量測）、`docs/agent-guide/pty-holder.md`（啟動參數）；CLAUDE.md 只在不變式改變時改（遵守該檔「CLAUDE.md 撰寫規則」）。
6. 回報區列：採用與否與理由、選定的值、對照表、holder key 與接回結論、手動清理的 PID、收尾殘留檢查。

## 不做

- 改 `pty:create` 的 env 傳送方式（T0889〈可選方案〉另一項）、執行期強制 GC（方案 B）。
- 改 `electron/terminal-server/**`（T0889 已合併的共用 conout Worker）、holder 的打包 / 安裝 / 升級流程。
- direct 模式的 conin socket 殘留（T0889〈建議下一步〉3）、F4。
- 跑 `t0859`、W6、任何 workflow；安裝 / 解除安裝 BAT；push、合併、發版。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：PARTIAL（依範圍 4「明顯下降但仍 > 5 MB → 保留修改，回報 PARTIAL」：採用 `--max-semi-space-size=1`，C2① 中位數 N +17.2 → +9.5 MB、H +45.6 → +14.9 MB，仍未達 ≤ 5 MB；其餘採用條件全部成立。請塔台裁示是否以已知限制發版）
- **完成時間**：2026-11-24 02:37 (UTC+8)
- **session_id**：647575bc-a643-42bd-b851-ce46a90d9364

### 落點檢查

- PASS。C-0：frontmatter `repo` = `better-agent-terminal`、`basename "$CT_HOME"` = `better-agent-terminal`。C-1：工單在 `$CT_HOME/_ct-workorders/` 下。C-3：前 5 個可測路徑都存在。C-2：工單沒有 `branch` 欄位。
- `CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0890`、`BAT_WORKSPACE_ID` 已設定（僅記錄）。`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`。
- 開工確認 `git merge-base HEAD v0.8.x` = `c552ff73f77bde86e0ab462ebd19bab54fbe36c4`（符合）。
- 依賴：worktree 內 `npm ci`（不改 lock；結尾只有 `electron-winstaller` 的 install script 提示，屬預期），Electron binary 以 `node node_modules/electron/install.js` 下載。

### SHA

- `branch`：`ct/T0890`
- `base_sha`：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`；本單實際起點 `c552ff73`，見上）
- `validated_sha`：`eba19e83154fa11f34df78701bdb8f824bd0d768`（產品程式唯一的 commit；typecheck、`test:unit`、`build:dir`、所有量測與 e2e 都在這份產品內容上跑，當時尚未 commit，commit 前後內容相同）
- `head_sha`：`d14fac4c45117f4ff433ce2ed38ddd9d62d701a8`
- `validated_sha` ≠ `head_sha` 的原因：之後兩個 commit 只有 `e2e/t0888-shared-conout-stress.spec.ts` 的一行診斷日誌（量測時就是這份內容）、結果 CSV 與文件（`docs/`、`CLAUDE.md`），沒有產品程式，不需重新驗證。

| commit | 內容 |
|---|---|
| `eba19e83` | fix：`electron/pty-holder.ts` `TERMINAL_SERVER_WIN32_MAX_SEMI_SPACE_MB` / `terminalServerV8Flags`；`terminalServerForkOptions` 在 win32 加 `execArgv`、`holderSpawnSpec` 在腳本前加旗標；`pty-holder.test.ts` |
| `46b4d085` | test：T0888 spec `describeServer` 記錄 Terminal Server 命令列上的旗標（只記旗標、不記路徑）；`results/t0890-c1.csv` … `t0890-c8.csv`、`t0890-ts-churn.csv` |
| `d14fac4c` | docs：`terminal-server-recovery.md`（新節〈Terminal Server 的 V8 新生代上限〉、從 PTY holder 啟動的規則、已知限制）、`pty-holder.md`（啟動參數、已知限制）、`CLAUDE.md`（不變式改變：Windows fork 不再「逐字照舊」） |

### 採用與否

- **採用**，值 = `1`（MB）。
- 修法：Windows 上兩條啟動路徑共用一個常數。沒有 holder 的 `fork`：`execArgv` = `process.execArgv`（fork 原本的預設）＋ `--max-semi-space-size=1`；holder：`bat-pty-holder.exe --max-semi-space-size=1 <holder>\terminal-server.js`。macOS / Linux 的 `terminalServerForkOptions` 回傳與修改前相同的物件（沒有 `execArgv` 鍵）。旗標不在任何 env／`NODE_OPTIONS`。`main.ts` 的呼叫字串不變（其他檔的 source guard 不動）。
- 實機證據：每次量測的 spec 日誌都記錄了 server 命令列的旗標：N0／H0／O 都是 `no semi-space flag`，N1（fork、`electron.exe`）與 H1（`bat-pty-holder.exe`）都是 `--max-semi-space-size=1`；C7 recovery 重新 fork 的 server 也帶。Electron 45.2.1（`ELECTRON_RUN_AS_NODE`）實測接受：new space 16 MB → 2 MB（`=2` 時 4 MB）。
- 值的比較（不經 app 直接驅動 holder 的 Terminal Server，`ts-churn.mjs --holder --env-only`，300 次，各 2 次；`results/t0890-ts-churn.csv`）：預設 +44.4／+44.3 MB、`1` **+12.8／+12.5 MB**、`2` +14.8／+14.5 MB。`1` 增加最少，C4／C8 在 `1` 已確認沒有變慢，所以不選較大的值。
- 採用條件逐項：C2① N 與 H 中位數都下降 ✅；C4 相對 O −53.4%（N1）／−53.3%（H1）≤ +20% ✅；C8 閒置中位數相同、p95 差距最多 +1.2 ms（≤ 2 ms）✅；C1／C3／C5／C7／C6 達標 ✅。C2① ≤ 5 MB ❌ → PARTIAL。

### 修改前後對照

同一台機器、同一份 spec。O = `v0.7.5-pre.2`（`%TEMP%\t0888\`，zip SHA-256 `1de36a81…ea214` 核對相符）；N0／H0 = 修改前 `c552ff73` 的原始碼建置／`build:dir`＋`BAT_T0888_HOLDER=1`（在 repo 外的暫存目錄以 `git archive` 匯出、`npm ci` 後建置，已刪除）；N1／H1 = 修改後。C2／C4／C8 交錯執行（C2 三輪：N0 N1 H0 H1 → N1 N0 H1 H0 → N0 N1 H0 H1；C4：O N0 N1 → N1 N0 O → H0 H1）。原始列在 `experiments/node-pty-worker/results/t0890-*.csv`。C1／C3／C5／C7／C6 的「修改前」是 T0889 的 N／H（產品內容就是 `c552ff73`）。

| 情境 | 條件 | O | 修改前（N0／H0） | N1 | H1 | 判定 |
|---|---|---|---|---|---|---|
| C1 10 分頁 | < 45 MB | — | T0889 N 34.7／H 42.6 | 34.9 MB | 41.1 MB | ✅ |
| C1 10 → 30 分頁每分頁 | ≤ 0.5 MB | — | T0889 +0.17／+0.17 | +0.16 | +0.08 | ✅ |
| C2① 300 次（3 次中位數；範圍） | ≤ 5 MB | — | N0 +17.2（9.0–17.6）；H0 +45.6（44.7–46.0） | **+9.5**（8.3–10.4） | **+14.9**（14.7–15.5） | ❌ 明顯下降但 > 5 |
| C2② 20 輪全關再開（3 次中位數；範圍） | ≤ 5 MB | — | N0 +11.5（9.6–11.8）；H0 +12.5（12.2–13.7） | +1.8（1.2–2.3） | +2.8（2.5–3.2） | ✅（修改前 ❌） |
| C3 20 分頁自然結束 | 不崩、可再開 | — | T0889 N 40.3 → 35.5 → 37.3；H 41.9 → 42.5 → 43.7 | 43 → 37.9 → 39.9 | 41 → 41.5 → 42.6 | ✅ |
| C4 10 × 20,000 行完成中位數（N 6 次兩輪對調；H 3 次） | 相對 O ≤ +20% | 4560 ms（4534–4777） | N0 2124 ms；H0 2201 ms | 2123.5 ms（−53.4%） | 2131 ms（−53.3%） | ✅ |
| C4 峰值 Private Bytes | — | 342–350 MB | N0 50–54；H0 71–72 MB | 47–51 MB | 52–53 MB | — |
| C4 輸出完整（完成標記、最後 200 行序號） | 全部 | ✅ | ✅ | ✅ | ✅ | ✅ |
| C5 5 個大量輸出中的分頁關閉（最長） | 每個 < 5 s、server 存活 | — | T0889 N 187／H 185 ms | 186 ms | 199 ms | ✅ |
| C5 其餘 5 分頁完成後／全關 | — | — | T0889 N 39.4／32.4；H 97.1／81.8 MB | 39.7／32.4 MB | 64.7／40.5 MB | ✅ |
| C6 30 分鐘（H 1 次） | ≤ 5 MB | — | T0889 H +2.7 | — | 41.5 → 43.4（+1.9） | ✅ |
| C7 recovery 10 分頁 | < 45 MB、舊 shell 0 | — | T0889 N 38.5 → 42.3；H 40.8 → 41.0 | 38.8 → 38.5、0/10 | 39.6 → 39.4、0/10 | ✅ |

C8 單一分頁回顯延遲（40 次；再讓另 9 個分頁各印 200,000 行時量一次；各 3 次；全部 0 次逾時、量完時 9 分頁仍在輸出）：

| | N0 | N1 | H0 | H1 |
|---|---|---|---|---|
| 閒置 中位數 | 30.8 / 31.2 / 31.0 ms | 30.8 / 31.1 / 31.0 ms | 31.2 / 31.2 / 30.8 ms | 31.2 / 30.9 / 31.3 ms |
| 閒置 p95 | 32.2–33.6 ms | 32.2–33.8 ms | 32.1–32.5 ms | 32.3–33.7 ms |
| 9 分頁大量輸出時 中位數／p95 | 16 ms／16.6–17.1 ms | 16 ms／16.9–17.1 ms | 16 ms／16.3–17.4 ms | 16–16.1 ms／16.9–17.3 ms |

### holder key 與接回（範圍 2）

- **holder key 不變**：key = `<Node 版本>-<holder 檔案的雜湊>`（`holderKey`／`scripts/pty-holder.cjs`），旗標是 `holderSpawnSpec` 的參數、不在任何 holder 檔案裡。實測修改前後 `build:dir` 的 `resources\pty-holder\holder-manifest.json` 逐位元組相同，key 都是 `24.22.2-7a21c053bf76`（= T0889 的 key）。
- **holder 接受旗標**：H1 的每次量測 holder（官方 Node 24.22.2）都以 `--max-semi-space-size=1` 正常啟動並完成情境。
- **接回不受影響**：`decideHolderReattach` 只看紀錄的 holder pid、pid 檔、hello 的 pid 與 PTY 數，`isKeptHolderHello` 只看 hello；兩者都不涉及啟動參數（因此不需問塔台）。一次性跨版本實測（暫時 spec，跑完已刪除、未 commit）：H0 從 holder 啟動（命令列沒有旗標）、開 cmd 分頁、送 `--installer-quit-request`（holder 與 shell 保留、紀錄 schema 2）→ H1 以同一個 runtime 重開 → 日誌 `reconnecting without the Recovery prompt`、`PTY holder reattach — connected to port`、沒有 Recovery 對話框、同一個 holder pid 與 shell pid、輸入送到舊 shell（寫出檔案）；被接回的 holder 命令列仍沒有旗標（不重啟），H1 正常關閉後 holder 與 shell 都結束。第一階段因為刻意保留 holder，Playwright 結束時報 `Worker teardown timeout`（測試本身 passed）。
- H1 跑 `t0861-holder-reattach`、`t0860-installer-quit-holder`：2 passed（marker 由 spec 建立並移除）。

### 驗收結果

1. ✅ `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功（在 `npm run build:dir` 內，也成功）、`npm run test:unit` 463 檔／8449 項全過（41 skipped；比 T0889 多本單 2 項）。`pty-holder.test.ts` 守住：win32 fork 帶 `execArgv`（含原本的 `process.execArgv`）、holder 參數在腳本前帶旗標、macOS / Linux 與修改前 `toStrictEqual`（沒有 `execArgv` 鍵）、env 是同一個物件且不含旗標、旗標只拼寫一次、沒有 `NODE_OPTIONS` 指派。其他檔的 source guard（`child-process-fd-guard`、`local-helper-capability`、`win-stdio-inherit`）不改也通過。
2. ✅ 範圍 3 的量測全部完成（見對照表）。
3. ✅ 範圍 2 結論見上；H 的 `t0861`、`t0860` 通過。
4. ✅ 不回歸：9 個指定 e2e 以修改後原始碼建置重跑 10 passed（`t0539`、`t0572`、`t0578`、`t0704`、`t0741`、`t0742-terminal-drop-path`、`t0532`、`detached-terminal-persistence`、`v072-pre6-terminal-links`）。
5. ✅ 文件：`terminal-server-recovery.md`、`pty-holder.md`；`CLAUDE.md` 因不變式改變（Windows 的 fork 不再「逐字照舊」）改一行並加一點。
6. 見本區各節。

### 手動結束的程序

- 我沒有用 taskkill 手動結束任何程序。
- spec 自己結束的 Terminal Server（C7，各一個、無 `/T`、執行檔先核對）：`38096 electron.exe`（N1）、`4652 bat-pty-holder.exe`（H1）。
- `ts-churn.mjs` 以 `server:shutdown` 結束它 fork 的 6 個 holder server（每次 `tsExited: true`），並以 `taskkill /F /PID <shell>`（無 `/T`）結束它自己 spawn 的 pwsh。

### 收尾殘留檢查（2026-11-24 02:37，唯讀）

- 本單開始後建立、執行檔在 worktree、`%TEMP%\t0890`、`%TEMP%\t0888`、`%TEMP%\bat-t08*` 底下的程序：0 個。
- `bat-pty-holder.exe` 只有使用者自己的 27336（20:33 建立，早於本單，`%ProgramFiles%\BAT-PtyHolder\…`）。
- 本單開始後建立、父程序已不在的 pwsh／conhost／OpenConsole／cmd／node／electron／BetterAgentTerminal：0 個。
- runtime userData：只剩 `BetterAgentTerminal-runtime-e2e-t0609-1793616886860`（本單之前就有，未動）。`%TEMP%\t0890`（修改前建置、log）、`%TEMP%\bat-t0890-cross-*` 已移除；H1 建置的 marker 已移除。
- `git -C "$CT_WORKTREE" status --porcelain`：空。

### 相關通過案例判定

不適用（工單沒有〈相關通過案例〉）。

### 遭遇問題

1. 第一次建置修改前的 `build:dir` 時，暫存匯出目錄以 junction 指向 worktree 的 `node_modules`，electron-builder 收集不到 node-pty（afterPack `PTY holder (T0858) … missing`）。改成在暫存目錄 `npm ci`（同一份 lock）後重建成功；只移除了 junction 本身，worktree 的 `node_modules` 未受影響。
2. 量測期間同機有使用者的 BAT（安裝版）在跑；時間類數字（C4、C5、C8）僅供參考，Private Bytes 不受影響。C6（H1）與 N1／H1 的 C1／C3／C5／C7、9 個不回歸 e2e、`ts-churn` 值比較部分時間重疊（C6 只量記憶體；為避免兩個 H1 互刪 marker，那段期間先放好 marker、結束後移除）。C2、C4、C8 沒有和其他測試同時跑。
3. 原始碼建置的 C2① 波動仍大（N0 同一份程式 +9.0～+17.6 MB），所以 N 的下降要看中位數；holder 的數字穩定（H0 44.7–46.0、H1 14.7–15.5）。
4. 〈塔台補充〉檢查：〈驗證前〉節點沒有在跑 typecheck／unit 之前執行，〈產品 commit 前〉與〈填回報前〉有執行；工單沒有任何 `## 塔台補充（…）` 段落，不影響結果。
5. 依工單沒有跑 `t0859`、W6、任何 workflow；沒有安裝／解除安裝 BAT。

### 互動紀錄

無（yolo，沒有向塔台提問；工單沒有〈塔台補充〉）。

### 建議下一步

1. 塔台裁示 C2① 仍 > 5 MB：Worker 建議以已知限制發版（holder 300 次開關 +45 → +15 MB、20 輪全關再開已 ≤ 5 MB，C4／C8 不變）。剩下的增加在老生代與 V8／原生層，要再降需處理觸發因素（app 每次 `pty:create` 送完整 env，T0889〈可選方案〉另一項，牽涉 `pty-manager.ts` 與協定）。
2. 合併 `ct/T0890` 後、發版前跑 W6（holder key 未變，但 holder 的啟動參數變了；升級後接回已在本機跨版本實測）。
3. 已裝 T0890 前版本的使用者：升級時被接回的舊 holder 沒有旗標，要等它結束後才生效（已寫進 `pty-holder.md`〈已知限制〉）。
