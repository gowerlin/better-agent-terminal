---
schema_version: 1
schema_kind: workorder
id: T0979
title: "研究：PLAN-066 三項後續（`pty:create` 只送 env 差異、direct 模式 conin socket 殘留、F4 自然結束的 conhost 殘留）——量測現況、評估修法與風險，提出可派的實作工單"
type: research
status: DONE
repo: better-agent-terminal
priority: P3
sizing: M
created_at: "2026-11-28T18:01:29+08:00"
updated_at: "2026-11-28T19:01:59+08:00"
started_at: "2026-11-28T18:04:30+08:00"
completed_at: "2026-11-28T19:01:59+08:00"
session_ids:
  - "c9478b00-e96d-4c53-8ea6-ba3e031db080"
target_version: "—（研究，不改產品）"
depends_on: []
related:
  - "PLAN-066（DONE，D343 後續候選）；T0887（共用 conout Worker）；T0888（量測 F1–F6，`e2e/t0888-shared-conout-stress.spec.ts`、`experiments/node-pty-worker/acceptance/`）；T0889（BUG-214：conin 釋放 `releaseEndedPtyInput`，〈F4 的處置〉、〈遭遇問題〉3 / 4）；T0890（V8 新生代上限）；node-pty#887；D516（U-72：C）"
affects_files:
  - _ct-workorders/T0979-research-plan066-followups.md
  - experiments/node-pty-worker/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 研究型工單：**不改產品程式**（`electron/`、`src/`、`scripts/`、`build/`、`package.json` 都不動）。量測腳本或小型重現只放 `experiments/node-pty-worker/`（可 commit 在 `ct/T0979`）；結論寫在本工單回報區。分支：只在 `ct/T0979` 寫檔（base = 派工當下的 `main`），不 merge / rebase / push、不動 `main`；主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 三項（使用者裁示開單處理，U-72：C，D516；本單先研究，實作工單由塔台依結論開）：① **`pty:create` 只送 env 差異**：T0888 F1 / T0889 C2① —— 共用 Worker 存活時反覆開關分頁，Terminal Server Private Bytes 高水位 +8～+45 MB（強制 GC 診斷版 +0.3 MB，證明不是每連線累積）；候選修法是 `pty-manager.ts` 與 Terminal Server 協定只送與 server env 不同的部分。② **direct 模式 conin socket 殘留**：T0889〈遭遇問題〉3 —— `pty-manager.ts` direct 模式也有 node-pty 不 destroy conin socket 的殘留，T0889 只修了 Terminal Server（`releaseEndedPtyInput`）。③ **F4**：分頁自然 `exit` 後每個分頁的 conhost（與轉送、conin）留到 Terminal Server 結束（node-pty#887）；T0889〈遭遇問題〉4：要處理需先決定「shell 結束時是否結束仍附著主控台的程序」。"
  - "🔴 每項要回答（回報區各一節＋總表）：現況量測（以原始碼建置或既有 spec / 腳本，附數字與環境；量不到寫明原因）、使用者看得到的影響（例：多少分頁 / 多少小時後多佔多少 MB；holder 保留 24 h 的情境）、可行修法（至少一案，附要改的檔案 / 函式）、風險與不變式衝突（逐條對照 CLAUDE.md：T0540 程序樹結束順序先 `killProcessTree` 再 `pty.kill()`、⏻ 重啟 T0539、Terminal Server recovery T0704、Recovery create hold T0578、協定 v1 只做相加 T0857、holder 接回 T0861、共用 conout Worker 規則 T0887 / T0889、node-pty 釘版 `1.1.0`）、是否改到 holder key / `shared-conout-worker.cjs` / 協定（→ 發版前要跑 W6 `windows-upgrade-acceptance.yml`）、規模（XS/S/M/L）、建議（做 / 延後 / 不做）與理由。③ 另列需要使用者裁示的產品選擇（例：shell 結束時要不要結束仍附著主控台的背景程序），以選項＋推薦呈現，由塔台轉給使用者。"
  - "🔴 量測不得影響使用者環境：🔴 不碰使用者正在用的安裝版 BAT、不連它的 Terminal Server / PTY holder、不用預設 userData（用隔離 `BAT_USER_DATA` / runtime）；手動起的程序收尾前全部結束並在回報區列 PID 與殘留檢查。🔴 不得在開發機跑 W6 / 真的安裝程式（CLAUDE.md「Windows PTY holder」）。"
  - "🔴 驗證：研究單不要求 `test:unit` 全綠；若 commit 了 `experiments/` 下的腳本，確認 `npm run test:unit` 不會收到它們（`vite.config.ts` `test.include`）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台；產品選擇寫成建議＋選項留給塔台。工單狀態寫 `DONE`（L177）。"
---

# T0979 — 研究：PLAN-066 三項後續

## 背景

PLAN-066 做完共用 conout Worker（T0887–T0890，`v0.8.0` 起），留下三個沒開單的後續：`pty:create` 只送 env 差異、direct 模式 conin socket 殘留、F4 自然結束的 conhost 殘留。使用者 2026-11-28 裁示開單處理（U-72：C，D516）。三項都碰 Terminal Server 協定或程序結束規則，部分會改 holder 而要跑 W6，所以先研究、量測，再由塔台依結論開實作工單。

## 範圍

- 三項各自：現況量測、影響、修法、風險（對照不變式）、W6 需求、規模、建議。
- F4 需要使用者裁示的產品選擇整理成選項。

## 不做

- 不改產品程式；不發版；不跑 W6 / 真的安裝程式；不碰使用者的安裝版 BAT。

## 驗收

- [x] 三項各一節＋總表（建議 / 規模 / 是否要 W6）
- [x] 量測數字附環境與重現方式（或寫明量不到的原因）
- [x] 不變式逐條對照
- [x] F4 產品選擇的選項＋推薦
- [x] 收尾殘留檢查（PID）

---

## 回報區

### 完成狀態

- **狀態**：DONE（研究：三項都有量測、修法、風險對照與建議；F4 的產品選擇列在〈F4 產品選擇〉）
- **完成時間**：2026-11-28 19:01 (UTC+8)
- **session_id**：c9478b00-e96d-4c53-8ea6-ba3e031db080

### 落點檢查

- PASS。C-0：frontmatter `repo` = `better-agent-terminal`、`basename "$CT_HOME"` = `better-agent-terminal`。C-1：工單在 `$CT_HOME/_ct-workorders/` 下。C-3：可測項目 `experiments/node-pty-worker/` 存在（PASS）。C-2：工單沒有 `branch` 欄位。
- `CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0979`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`。
- 依賴：worktree 內 `npm ci`（lock 不變；結尾只有 `electron-winstaller` 的 install script 提示，屬預期）、`node node_modules/electron/install.js`、`npx vite build`（成功）。

### SHA

- `branch`：`ct/T0979`
- `base_sha`：`80d96e25ee407768f204cd6d3efda7172106e5bc`
- `validated_sha`：`80d96e25ee407768f204cd6d3efda7172106e5bc`（量測時的 HEAD；量的是這個產品內容建出來的 `dist-electron/terminal-server.js` 與 `node_modules/@lydell/node-pty` 1.1.0）
- `head_sha`：`e882e1204e543f4e64b587315564cd4e379f0c5d`
- 兩者不同的原因：`e882e120` 只新增 `experiments/node-pty-worker/t0979/`（3 支量測腳本＋執行器）與 `results/t0979-*`（結果檔），沒有產品程式，不需重新驗證。`experiments/` 不在 `vite.config.ts` `test.include`，`test:legacy` 只找 `tests/`，兩者都不會收到這些檔。

### 量測環境與重現方式

- 本機 Windows 11 Pro for Workstations 10.0.28000；pwsh（腳本一律 `-NoLogo -NoProfile`）；Electron 45.2.1 內建 Node 24.22.1（`ELECTRON_RUN_AS_NODE`）；另以系統 Node 26.13.1 代替 PTY holder 的官方 Node（holder 是 24.22.2，**不是同版**，只當參考）。
- 量測只驅動自己 fork 的 Terminal Server（fork IPC，與主行程相同）或自己載入的 node-pty；不設 `BAT_USER_DATA`（不寫 pid / port / token / registry 檔），server 的 env 拿掉 `BAT_*` / `CT_*`；沒有連使用者的 BAT、Terminal Server 或 PTY holder，沒有跑 W6 或安裝程式。
- 同機有使用者的安裝版 BAT 在跑；Private Bytes 是各程序自己的，不受影響，時間類數字沒有使用。
- 腳本（`experiments/node-pty-worker/t0979/`）：
  - `ts-env-churn.mjs`：T0888 C2①（10 個分頁常駐、另一個開關 300 次），比較 `pty:create` 帶的內容：`none`（不帶 env）、`full`（現行：完整 env＋每個 PTY 的鍵，形狀同 `PtyManager.buildPtyEnv`，值是假的）、`diff`（候選修法：只帶和 server env 不同的鍵）、`ignored`（完整 env 放在 server 不讀的欄位：只有傳送與解析）。`run-env-churn.sh` 依序跑 24 輪（每輪換模式順序）。
  - `pty-end-residue.cjs`：不經 Terminal Server，直接用 node-pty 1.1.0（= direct 模式的主行程）：`kill`（② 開→`pty.kill()`→`taskkill /F /T`，PtyManager.kill 的順序）、`exit`（③ shell 自己 `exit`）、`attached`（③ shell 用 `Start-Process -NoNewWindow` 起 `ping -n 40` 後 `exit`）；`--fix release` 是候選修法。
  - `ts-exit-residue.mjs`：建好的 Terminal Server（共用 conout Worker）裡 20 個分頁自然結束後的殘留，對照 20 個由 BAT 關閉的分頁。
- 結果檔：`experiments/node-pty-worker/results/t0979-env-churn.csv`、`t0979-pty-end-residue.jsonl`、`t0979-ts-exit-residue.jsonl`（只有數字、pid 與程序名稱，沒有 env 內容與權杖）。

### 總表

| 項目 | 使用者看得到的影響（量測） | 候選修法 | 規模 | 要跑 W6 | 建議 |
|---|---|---|---|---|---|
| ① `pty:create` 只送 env 差異 | 300 次開關的記憶體高水位：Electron node 完整 env +6.7 MB → 只送差異 +3.4 MB（不送 env +3.0），省約 3.3 MB；Node 26 +10.0 → +7.5，省約 2.5 MB。有上限、不是累積 | server 新增唯讀請求回傳它的 PTY 基底 env（協定 v1 相加），host 每條連線取一次、之後只送差異；舊 server 退回完整 env | M | **要**（改 `terminal-server.js` → holder key 變） | **不做（延後）**：省 3 MB 左右的高水位，換一次協定相加與 W6，不划算 |
| ② direct 模式 conin socket 殘留 | 每關一個分頁，主行程多 1 個 socket、約 2 個 handle；100 次記憶體差在誤差內（44.4 vs 43.9 MB）。使用者近 11 份日誌 direct 建立 0 次、Terminal Server 65 次 | `handleDirectExit` 在 BAT 自己 kill 的 PTY 結束後 `releaseEndedPtyInput`（沿用 T0889） | XS | 不要 | **併入 ③ 的實作單一起做**；③ 不做就延後 |
| ③ F4 自然結束的 conhost 殘留 | Terminal Server 模式：每個自然結束的分頁留 1 個 conhost（1.6 MB private、約 8 MB working set）＋ server 約 13 個 handle，留到 server 結束；之後關掉該分頁也不會釋放。direct 模式每個再多一個約 12 MB 的 conout Worker | 推薦 D：使用者關閉（✕）或 ⏻ 重啟／同 id 重建該分頁時，以 ClosePseudoConsole＋釋放 conin＋停轉送收掉（不呼叫 node-pty 的 `kill()`） | S–M | **要** | **做（選項 D）**，待使用者確認產品選擇 |

### ① `pty:create` 只送 env 差異

**現況量測**（`t0979-env-churn.csv`；Δ = 300 次開關後 Terminal Server Private Bytes 增加量）

| 執行環境 / 旗標 | none（不帶 env） | full（現行） | diff（候選） | ignored（只傳不用） | 次數 |
|---|---|---|---|---|---|
| Electron node，`--max-semi-space-size=1`（現行 Windows fork 參數，T0890） | +3.2 / +3.0 / +2.7（中位 **3.0**） | +6.7 / +7.3 / +6.6（中位 **6.7**） | +3.4 / +4.0 / +2.3（中位 **3.4**） | +6.6 / +6.3 / +6.7（中位 6.6） | 各 3 |
| Electron node，預設 | +2.0 | +5.8 | +3.2 | +7.2 | 各 1 |
| Node 26.13.1，`--max-semi-space-size=1`（holder 的代替） | +5.8 / +6.5 | +11.0 / +8.9 | +8.5 / +6.4 | +12.5 / +9.4 | 各 2 |

- 每次 `pty:create` 的 env：完整 12,098 bytes / 142 個鍵；差異 438 bytes / 7 個鍵（這個 shell 已有 `TERM` 等鍵；在 BAT 主行程約 17 個鍵、1 KB 以內）。
- **判讀**：`ignored` ≈ `full`，所以增加的部分來自每則訊息帶 12 KB env 的傳送與解析，不是 spawn 用的 env 物件（`none` 時 server 照樣用完整的自己 env spawn）。只送差異幾乎回到 `none`。
- 與 T0889 的 `env-only` +17.2 MB 數字不同：本單 pwsh 用 `-NoProfile`（每個分頁的輸出較少）、量的是含 T0889 批次轉送與 T0890 旗標的現行程式；只比同一份程式裡的模式差。

**使用者看得到的影響**：T0890 之後 app 內 C2① 是 N +9.5、H +14.9 MB（有上限、持平）。只送差異最多省掉其中 env 那一份，本單量到約 2.5–3.3 MB／300 次開關。holder 保留 24 h 的情境也一樣有上限（高水位，不隨時間累積）。

**可行修法**（一案）
1. `electron/terminal-server/protocol.ts`：新增請求 `server:pty-env` → 回應 `{ type: 'server:pty-env', env }`（server 的 `process.env` 去掉 `TERMINAL_SERVER_OWN_ENV_KEYS`，即 `buildServerPtyEnv` 裡的 `inherited`）。只做相加。
2. `electron/terminal-server/server.ts`：處理這個請求；`buildServerPtyEnv` 不改（`{...inherited, ...diff}` 與 `{...inherited, ...full}` 結果相同，因為 host 沒有的鍵現在本來就由 server 繼承）。
3. `electron/pty-manager.ts`：每次連上 server（`setServerProcess`、`connectToServer`、recovery re-fork 後）取一次基底 env，依 `serverGeneration` 快取；`pty:create` 的兩個送出點（首次建立、`handleServerDeath` 重建）與 restart 只送 `buildPtyEnv` 結果裡值不同的鍵；沒拿到基底（舊 server 回 `error`、逾時）→ 照舊送完整 env。
4. 測試：`buildServerPtyEnv(base, diff)` 與 `(base, full)` 逐鍵相同；舊 server 退回；recovery 後用新 server 的基底。

**風險與不變式對照**
- T0540 程序樹結束順序：不涉及。
- T0539 ⏻ 重啟：restart 路徑也要改用差異，否則只是沒省到；行為不變。
- T0704 recovery：重建時必須用新 server 的基底（快取要跟 `serverGeneration` 走），否則會漏鍵。
- T0578 Recovery create hold：不涉及（hold 只延後送出時間）。
- T0857 協定 v1 只做相加：新請求是相加；舊 server 回 `error` → 退回完整 env，相容。
- T0861 holder 接回：接回的 server 是上一版 BAT fork 的，env 可能和現在主行程不同 —— 一定要用 server 回報的基底算差異，不能用主行程自己的 env（否則新版改的 env 會套不到新分頁）。
- T0887 / T0889 共用 conout Worker：不涉及。node-pty 釘版 `1.1.0`：不涉及。
- 其他：Windows env 鍵不分大小寫，用完全相同的鍵比較（與現在完整 env 的行為相同，不會多出重複鍵）；基底 env 也只走 IPC / TCP，不寫日誌。
- **改到協定與 `terminal-server.js` → holder key 改變 → 發版前要跑 W6**。不改 `shared-conout-worker.cjs`。

**規模**：M（主行程快取與退回、兩個送出點、測試、文件）。
**建議**：**不做（延後）**。收益是 3 MB 左右、有上限的高水位，代價是一次協定相加與 W6；之後若 holder 的記憶體再被回報，或有其他工單本來就要改協定與 holder，再一起做。

### ② direct 模式 conin socket 殘留

**現況量測**（`t0979-pty-end-residue.jsonl`，Electron node，開→`pty.kill()`→`taskkill /F /T` 100 次，結束後等 8 s）

| | 開始 | 100 次後 | 每個分頁 |
|---|---|---|---|
| 現行：`PipeWrap`（socket） | 1 | 102 | +1.0 |
| 現行：handle 數 | 212 | 425 | +2.1 |
| 現行：Private Bytes | 20.0 MB | 44.4 MB | — |
| 釋放 conin 後：`PipeWrap` | 1 | 2 | 0 |
| 釋放 conin 後：handle 數 | 215 | 325 | +1.1 |
| 釋放 conin 後：Private Bytes | 22.6 MB | 43.9 MB | — |

- 釋放 conin 後 socket 不再累積，但每個分頁仍多約 1 個 handle（Terminal Server 模式關 20 個分頁也多約 1.35 個／分頁，見 ③ 表）。來源在 node-pty 的原生層，本單沒有查出是哪一種 handle（沒有 handle 類型工具）。
- 記憶體差在誤差內：兩組都 +21～24 MB，是 Worker 起停與 heap 的高水位，和 conin 無關。
- **direct 模式在 Windows 很少用到**：只在 Terminal Server 起不來時才走（`startTerminalServer` 失敗、腳本不在）；headless bat-server 只發 Linux / macOS（`build-server-bundle.mjs` `VALID_TARGETS`），沒有 Windows 的 conin 問題。唯讀統計使用者最近 11 份 BAT 日誌：`Created terminal using node-pty`（direct）0 次、`→ Terminal Server` 65 次。

**使用者看得到的影響**：Terminal Server 起不來時，每關一個分頁主行程多約 2 個 handle，開關幾百次才幾百個 handle、記憶體可忽略。

**可行修法**：`electron/pty-manager.ts` 的 `kill()` 在 direct 分支記下「BAT 自己結束」，`handleDirectExit` 在 win32 且是 BAT 自己結束的 PTY 時 `setImmediate(() => releaseEndedPtyInput(proc))`（`electron/terminal-server/shared-conout.ts`，純函式、不 import electron；形狀不符不碰）。自然結束的照 ③ 的決定處理。測試沿用 `shared-conout-release.test.ts` 的真 node-pty 寫法。

**風險與不變式對照**
- T0540：direct 模式的順序（`pty.kill()` 後 `taskkill`）不改；釋放在 exit 之後。
- T0539 ⏻ 重啟：`handleDirectExit` 已忽略被取代 PTY 的晚到 exit（BUG-101），釋放只碰那個舊 proc，不碰新的。
- T0704 / T0578 / T0857 / T0861：direct 模式不經 Terminal Server，不涉及。
- T0887 / T0889：共用 conout 只在 Terminal Server，不涉及；沿用 T0889 的釋放函式。node-pty `1.1.0`：同 T0889 的形狀檢查。
- **不改 `terminal-server.js` / `shared-conout-worker.cjs` / 協定 → 不需要 W6**（只改主行程 bundle）。

**規模**：XS。
**建議**：本身影響很小，**併入 ③ 的實作單一起做**（同一個釋放函式、同一組測試）；③ 若不做，② 也延後。

### ③ F4：自然結束的 conhost 殘留

**現況量測**

Terminal Server 模式（`t0979-ts-exit-residue.jsonl`，建好的 `terminal-server.js`、共用 conout Worker、`--max-semi-space-size=1`）：

| 時點 | server Private | server handle | conhost 數 | conhost private 合計 | conhost working set 合計 |
|---|---|---|---|---|---|
| 開始 | 21.8 MB | 199 | 0 | 0 | 0 |
| 20 個分頁開著 | 38.9 MB | 594 | 20 | 31.8 MB | 163 MB |
| 20 個 shell 自己 `exit` 後 10 s | 38.3 MB | 454 | **20** | 31.9 MB | 163.3 MB |
| 再對這 20 個 id 送 `pty:kill` | 38.3 MB | 454 | **20** | 31.9 MB | 163.3 MB |
| 另開 20 個、由 BAT 關閉後 12 s | 37.4 MB | 481 | 20（只剩自然結束的） | 30.6 MB | 162.6 MB |

- 每個自然結束的分頁：1 個 conhost（約 1.6 MB private、約 8 MB working set，working set 含共用頁所以偏高）、server 多約 13 個 handle（454 − 199 ≈ 255 / 20），加上該 PTY 的 conin socket 與共用 Worker 裡的轉送。由 BAT 關閉的分頁：conhost 全部結束，每個只多約 1.35 個 handle。
- 自然結束後再送 `pty:kill` 什麼都不會釋放（server 在 exit 時已刪掉 entry）；而且現行 host 根本不會送 —— `PtyManager.handlePtyExit` 收到 exit 就刪掉 instance，之後 `kill(id)` 回 `false`、不送任何訊息。

direct 模式（`pty-end-residue.jsonl`，`exit` 情境，20 個）：自然結束後 30 s，主行程 Private 258.8 MB（開始 20.0）、20 個 conhost、20 個 conin（`PipeWrap` 22）、20 個 conout Worker（`MessagePort` 20），**每個分頁約 12 MB**；候選修法（ClosePseudoConsole＋釋放 conin＋dispose conout）後回到 35.0 MB、conhost 0、`PipeWrap` 2、`MessagePort` 0。

附著在主控台上的背景程序（`attached` 情境，現行與候選修法各 1 次）：
- shell 用 `Start-Process -NoNewWindow ping -n 40` 後 `exit`：**shell 結束後 ping 仍在執行**（但它的輸出已經送不到分頁：node-pty 在 exit 後就關掉 conout socket）。
- 候選修法（ClosePseudoConsole）後 3 s，**ping 也跟著結束**、conhost 結束、主行程 37.1 → 28.8 MB。
- 用已結束的 shell pid 查主控台程序清單：`conpty_console_list_agent` 以 `AttachConsole failed` 結束（exit 1）；用還活著的 ping pid 查則回 `[查詢程序, ping]`。

**使用者看得到的影響**
- Terminal Server 模式：每有一個分頁的 shell 自己結束（使用者打 `exit`、shell 當掉），就留約 1.6 MB 已提交記憶體＋約 13 個 handle，直到 Terminal Server 結束。例：一個 BAT 執行期間 50 次自然結束 ≈ 80 MB、約 650 個 handle；server 在 BAT 重開時被保留（Recovery「保留」）或安裝程式保留 holder（閒置延到 24 h，T0860）時，會跨 BAT 重開繼續累積。BAT 正常結束時 server 結束，殘留一起清掉（T0888 收尾檢查沒有殘留）。
- direct 模式每個自然結束的分頁約 12 MB（但 direct 模式實際上沒有被用到，見 ②）。

**可行修法**（選項見下節，以推薦的 D 為準）
1. `electron/terminal-server/shared-conout.ts`：新增 `releaseExitedPty(proc, platform)`：win32、形狀相符（node-pty 1.1.0 `_agent._ptyNative.kill`、`_agent._pty`、`_agent.inSocket`、`_agent._conoutSocketWorker.dispose`）時依序 ClosePseudoConsole → destroy conin → dispose conout 轉送；形狀不符什麼都不做並記一行。🔴 **不得呼叫 node-pty 的 `pty.kill()`**：shell 已結束時它的主控台清單查詢一定失敗，5 s 後對已結束的 shell pid 呼叫 `process.kill`，pid 若已被重用會結束到別的程序（見〈其他發現〉）。
2. `electron/terminal-server/server.ts`：`handlePtyExit` 在 win32 把自然結束的 proc 記進 `exitedPtys`（id → proc）；`killPty` 找不到 live entry 但 `exitedPtys` 有 → `releaseExitedPty`；`createPty` 遇到同 id 的 exited proc → 先釋放再 spawn。
3. `electron/pty-manager.ts`：`kill(id)` 在 `useServer` 且 instance 已因 exit 被刪掉時，照樣送 `pty:kill`（舊 server 對不存在的 id 本來就不做事、不回應）；direct 模式在 `handleDirectExit` / `kill` 做同樣的記錄與釋放（同時解決 ②）。
4. 測試：擴充 `electron/__tests__/shared-conout-release.test.ts`（Windows 真 node-pty：自然結束後 conhost 在、關閉後不在；ping 附著時關閉後 ping 結束；同 id 重建前先釋放；形狀不符不碰），source guard 擋 `exitedPtys` 路徑呼叫 `.kill()`。

**風險與不變式對照**（選項 D）
- T0540 先 `killProcessTree` 再 `pty.kill()`：自然結束的 shell 已不在，`taskkill /T` 找不到樹根，無法沿用；ClosePseudoConsole 會結束仍附著主控台的程序（實測 ping），不附著主控台、由 shell 另外啟動的程序（`Start-Process` 開新視窗、detached）不受影響，與現在相同。live 分頁的 ✕ 順序不變。
- T0539 ⏻ 重啟：已結束的分頁按 ⏻ 是建立同 id 的新 PTY → server 在 spawn 前釋放舊的；新 PTY 的建立與 120x30 / 尺寸同步（T0572）不變。
- T0704 recovery：舊 server 連同程序樹被結束，它的 conhost 一起結束；`exitedPtys` 只在該 server 程序裡，不需處理。
- T0578 Recovery create hold：不涉及（釋放只在 kill / create 裡、create 本來就受 hold 管）。
- T0857 協定 v1 只做相加：**不新增訊息**，只是 `pty:kill` 對已結束的 id 多做釋放；新 host＋舊 server = 照舊殘留，舊 host＋新 server = 只有重建同 id 時釋放；兩方向都相容。
- T0861 holder 接回：已結束的 PTY 不在 `pty:list`，接回後恢復的分頁以同 id `pty:create` → 釋放舊的。
- T0887 / T0889 共用 conout Worker：dispose 只關掉該 PTY 的轉送（Worker 的 `close` 訊息，含 1 s 排空），不重建 Worker、不改 Worker 腳本；conin 釋放沿用 T0889 的方式。
- node-pty 釘版 `1.1.0`：多用到 `_agent._ptyNative.kill` / `_agent._pty` / `_conoutSocketWorker` 三個內部欄位，以形狀檢查＋真 node-pty 測試守住；升 node-pty 時必跑。
- **改 `terminal-server.js`（server.ts、shared-conout.ts 都打包進去）→ holder key 改變 → 發版前要跑 W6**。不改 `shared-conout-worker.cjs`。

**規模**：S–M（server 與主行程兩邊、真 node-pty 測試、文件 `terminal-server-recovery.md`「共用 conout Worker」F4 段與 CLAUDE.md 一行）。
**建議**：**做（選項 D）**，連同 ② 一張實作單；前提是使用者確認下一節的產品選擇。

### F4 產品選擇（請塔台轉給使用者）

問題：shell 自己結束後，這個分頁的主控台（conhost）要在什麼時候收掉？收掉時，仍掛在同一個主控台上的背景程序（例：`Start-Process -NoNewWindow`、`start /b` 啟動、shell 結束後還在跑的程序）會一起被結束（實測 ping）；這些程序的輸出本來就已經送不到分頁。

| 選項 | 行為 | 殘留 | 對背景程序 | 規模 |
|---|---|---|---|---|
| A. 維持現狀 | 留到 Terminal Server 結束 | 每次自然結束約 1.6 MB＋13 handle，持續累積 | 一直跑到自己結束 | 0（只補文件） |
| B. 沒有程序掛著才自動收 | shell 結束時查它的子孫還在不在；都不在就收，在就定期再查 | 幾乎沒有 | 不受影響，跑完才收 | M（要列已結束 shell 的子孫並防 pid 重用；`conpty_console_list_agent` 對已結束的 pid 查不到，要另找方法） |
| C. 一律立即收 | shell 結束就收 | 沒有 | **立刻被結束** | S |
| **D. 關閉或重啟分頁時收（推薦）** | 分頁還開著（顯示 `[Process exited …]`）時保留；使用者按 ✕ 關閉、⏻ 重啟、或 BAT 重開恢復該分頁時收掉 | 只剩「結束了但一直沒關的分頁」，數量不超過開著的分頁數 | 分頁開著時不受影響；關閉分頁時結束（和 live 分頁按 ✕ 會結束整個程序樹的規則一致） | S–M |

推薦 D：✕ 本來就代表「結束這個分頁裡的一切」（T0540），使用者不會意外失去還在跑的背景程序；不用偵測邏輯；涵蓋常見情況（結束後關掉或重啟分頁）。

### 其他發現（既有行為，建議塔台另行判斷）

- **node-pty `kill()` 在 shell 已結束時的 pid 重用風險**：`WindowsPtyAgent.kill()` 先 fork `conpty_console_list_agent` 以 shell pid 查主控台程序清單；shell 已結束時實測 `AttachConsole failed`（exit 1），node-pty 只等 `message`，所以要等 5 s 逾時，再對清單 `[shell pid]` 呼叫 `process.kill`（`windowsPtyAgent.js` 118–131）。Terminal Server 的 `endPty`（T0540：先 `taskkill /T` 再 `pty.kill()`）與 direct 模式（`pty.kill()` 後立刻 `taskkill`）都會走到這段：shell 被 taskkill 結束後 5 s，node-pty 對那個已結束的 pid 發一次 `process.kill`；這 5 s 內若 pid 被重用，會結束到無關的程序。本單沒有實測到重用（機率低），只依原始碼＋「已結束 pid 查詢失敗」的實測推論。若要處理，需另開工單（例：endPty 改成 taskkill 後直接 ClosePseudoConsole，不經 `pty.kill()`），同樣會改 holder key。
- 由 BAT 關閉的分頁，Terminal Server 與 direct 模式都還有約 1–1.4 個 handle／分頁的殘留（② 表、③ 表），來源在 node-pty 原生層，本單未查明。

### 手動結束的程序

- 我沒有用 taskkill 結束任何不是本單建立的程序。量測腳本只結束它自己 spawn 的 pwsh（`taskkill /F /T`，② 的 direct 順序）與 `attached` 情境自己起的 ping（各 1 個，`taskkill /F /PID`，無 `/T`）；Terminal Server 一律以 `server:shutdown` 結束（26 次都 `tsExited: true`）。
- `pty-end-residue.cjs` 每次結束時檢查自己 spawn 的 shell，全部回 `shellsStillAliveAtEnd: []`。

### 收尾殘留檢查（2026-11-28 18:59，唯讀）

- 18:04 之後建立、名稱是 pwsh / conhost / OpenConsole / cmd / node / electron / PING / BetterAgentTerminal / bat-pty-holder 的程序：只有本 session 的 MCP server（18:04:02–04 建立，父程序存活）與做這次檢查的 PowerShell（18:59:36）；沒有父程序已不在的程序。
- 執行檔在 worktree 內的程序：0 個。`%TEMP%\t0979-*`：已全部移除（腳本自己清；log 與暫存結果我手動刪除）。沒有建立 runtime userData、沒有碰 PTY holder 目錄。
- `git -C "$CT_WORKTREE" status --porcelain`：空。

### 相關通過案例判定

不適用（工單沒有〈相關通過案例〉）。

### 遭遇問題

1. holder 用的是官方 Node 24.22.2，本機沒有這一版，改用系統 Node 26.13.1 當參考；數字比 Electron node 大，但模式間的差（diff 比 full 少約 2.5 MB）方向一致。holder 實機數字要在實作單用 `build:dir`＋`BAT_T0888_HOLDER=1` 量。
2. 第一次 `attached` 情境的主控台清單查詢在 stderr 印了 node 的 `AttachConsole failed` 堆疊；那正是要觀察的結果（已記錄），不是腳本錯誤。
3. 以使用者的 BAT 日誌判斷 direct 模式使用率時，只讀了兩個字串的出現次數，沒有讀或記錄其他內容。

### 互動紀錄

無（yolo，沒有向塔台提問；工單沒有〈塔台補充〉）。

### 建議下一步

1. 塔台把〈F4 產品選擇〉轉給使用者；選 D（或 B / C）後開一張實作單：③ 的釋放＋② 的 direct 模式 conin 釋放，`affects_files` 至少 `electron/terminal-server/server.ts`、`electron/terminal-server/shared-conout.ts`、`electron/pty-manager.ts`、`electron/__tests__/shared-conout-release.test.ts`、`docs/agent-guide/terminal-server-recovery.md`、`CLAUDE.md`；驗收沿用 T0888 C3（自然結束後 conhost 數）＋本單 `attached` 情境＋ T0888 不回歸 e2e；合併後發版前跑 W6。
2. ① 列入延後（理由見 ① 節）；若之後要改協定或 holder，再一起做。
3. 〈其他發現〉的 pid 重用風險：塔台判斷是否開 BUG；若 ③ 的實作單要做，可順便評估 `endPty` 改成不經 `pty.kill()`（同一個 holder key 變動、同一次 W6）。
