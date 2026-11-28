---
schema_version: 1
schema_kind: workorder
id: T0984
title: "交付版 `v0.8.1-pre.6` 自動化驗收（A-28）：未信任資料夾「以塔台開啟 Claude」，信任對話框 Enter 後立刻按鍵，開工回合結束後待辦分頁回答立即送出；以 pre.5 對照"
type: verification
status: DONE
repo: better-agent-terminal
priority: P1
sizing: M
created_at: "2026-11-28T20:39:48+08:00"
updated_at: "2026-11-28T21:01:24+08:00"
started_at: "2026-11-28T20:41:05+08:00"
completed_at: "2026-11-28T21:01:24+08:00"
session_ids:
  - "98bf3289-8f9c-4e3d-96b1-37a1e464b15f"
target_version: "0.8.1-pre.6（已發佈）"
depends_on: []
related:
  - "A-28；T0978（啟動參數回合不套 2 s Enter 窗，回報區〈待實機〉的重跑步驟與預期日誌）；T0972 Q-2；T0970（交付版驗收 R2 / B3 實錄、`e2e/manual/ct610-driver.ts`、`ct-accept-act.mjs`）；T0983（F4，選用 S5）；D526"
affects_files:
  - _ct-workorders/T0984-v081-pre6-acceptance.md
  - e2e/manual/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0984` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式、不改 `e2e/fixtures/`；只可新增 / 擴充 `e2e/manual/` 的驅動，README 同步。"
  - "🔴 使用者已自己裝好 `v0.8.1-pre.6`（安裝版，`C:/Program Files/BetterAgentTerminal`）並在使用中（塔台就跑在裡面）：🔴 不得碰安裝版（不執行、不關閉、不改它的 userData、不連它的 Terminal Server / PTY holder），只用 zip 隔離實例。測試版放 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.6-win/` 與 `…/0.8.1-pre.5-win/`（目前都還沒有；照 T0969 / T0970 的方式從 GitHub Release 下載 zip 到 `_dl-<版號>/`、核對 SHA-256 後解壓：pre.6 `BetterAgentTerminal-0.8.1-pre.6-win.zip` `4c60af904b5dc933d9d61046e205e9628427b5a0fdf8fb60a316a72a1724ab5b`、pre.5 `BetterAgentTerminal-0.8.1-pre.5-win.zip` `d8e491851627ab3dc24801fab53878bccebace2e2ba5cb2fb08d066eb03c6377`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`）。解壓後核對 exe 存在與 `resources/package.json` 版號。"
  - "🔴 claude：沿用 T0969 / T0970 的 ACC 隔離設定（`CLAUDE_CONFIG_DIR=<使用者資料夾>/AppData/Local/ct620-accept/claude-config`，已登入；開工只檢查 `.credentials.json` 存在、不讀不複製；帳號檔不得讀取、複製或摘錄）。🔴 S1 要「未信任」的資料夾：每一輪用一個**新路徑**的測試專案副本（`ACC/runs-t0984/<情境>-<輪次>/`，claude 沒見過這個路徑 → 會跳「信任這個資料夾」對話框）；開跑前確認 ACC 的 claude 設定裡沒有這個路徑的信任紀錄。S2 用事先信任過的資料夾（先在同一個 `CLAUDE_CONFIG_DIR` 對它信任一次）。結果與證據放 `ACC/results-t0984/`（ACC 先前輪次的目錄只讀不動）。啟動與環境：同 T0970（`launchIsolated`＋`BAT_E2E_EXECUTABLE`、獨立 `--runtime=e2e-t0984-*`、`dropEnv` 移除 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`、工作區層級 `--dangerously-skip-permissions` 只限測試工作區）。"
  - "🔴 情境（pre.6 必跑；標「對照」的 pre.5 也跑，用來確認情境能分辨修正前後）：**S1（A-28，對照）** 未信任資料夾「以塔台開啟 Claude」→ 信任對話框出現 → 送 Enter（必要時先 ↓ 選信任，依 T0970 B3 實錄）→ Enter 後約 150 ms（< 2 s，且距 `user-prompt-submit` hook ≥ 300 ms）送一個會被判成草稿的鍵（F12 `\\x1b[24~`，以 `ct-accept-act.mjs input`）→ 等 `/control-tower` 回合結束、塔台宣告契約 2、`_tower-state.md` 有 `awaiting_user` U-1 → 從待辦分頁回答 `U-1：A`。pre.6 預期：日誌依序有 `[agent-command] id=<分頁> launch command ends with the launch prompt (launch-prompt turn pending)`、`[notify-hold] draft set … cause=…`、`draft cleared terminal=<分頁> (user-prompt-submit; not a contract-2 Tower yet; launch-prompt turn, Enter <ms> ms before not guarded)`，回答 `answer … (sending)` / `sent … reason=none`，沒有 `held … reason=draft`，塔台收到 `U-1：A`。pre.5 預期：`draft kept … Enter <ms> ms before` → 回答 `held … reason=draft`（記錄後按「立即送出」收尾）。時序若沒落在條件內（Enter 距 hook ≥ 2 s、或按鍵距 hook < 300 ms），該輪作廢、記錄實際毫秒數重跑。**S2（T0972 不回歸）** 已信任資料夾，啟動參數回合送出前（沒有信任對話框）按 F12 → 回合結束後回答 → pre.6 立即送出（`draft cleared …`），不需 pre.5 對照。**S3（真草稿仍保留，T0964 / T0978 不回歸）** S1 或 S2 的塔台回合結束後，在輸入框打 `abc` 不送出 → 回答 → `held`（保留原因「你在輸入」）；清掉輸入後回答送達且只送一次。**S4 日誌**：新增的日誌行不含按鍵內容、回答內容以外的使用者資料、權杖值。**S5（選用，不影響 A-28 判定，F4 / T0983 交付版煙霧測試）** 隔離實例開一個一般 PowerShell 分頁 → 在分頁裡 `exit` → 隔離實例的 Terminal Server 底下仍有該分頁的 conhost → 按 ✕ 關閉分頁 → 數秒內 conhost 結束；只數隔離實例 Terminal Server 的子程序，不碰其他程序。做不到就寫明原因。"
  - "🔴 模型配合與用量：同一項需要模型配合的狀態最多試 3 次，仍沒出現判「未觸發」，不得硬判 PASS。碰到用量上限：立即停止開新回合，已完成的照常寫結果，回 PARTIAL 並列出未跑項目。"
  - "🔴 結果：回報區總表（S1–S5 × pre.6 / pre.5：PASS / FAIL / 未觸發 / 對照未重現，附證據位置與實際毫秒數）、每項日誌摘要與截圖、A-28 是否可判完成的建議（A-28 的定義：未信任資料夾「以塔台開啟 Claude」，信任對話框按 Enter 後立刻按鍵，開工回合結束後從待辦分頁回答 → 立即送出、不進待送）。FAIL 不修產品程式，記證據、建議開 BUG。"
  - "🔴 驗證與 Git：改了 `e2e/manual/` 時 `node --check`（.mjs）；worktree `npm ci`、`npx vite build` exit 0、兩個 typecheck = 0。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。程序清理照 D308（隔離實例 `closeIsolated`、Terminal Server / PTY holder 不殘留）；使用者層 `~/.claude`、`~/.codex` 前後雜湊相同；安裝版 BAT 程序 pid 前後相同、未被碰。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。結果檔在 ACC（本機）可寫實際路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE` / `PARTIAL`（L177）。"
---

# T0984 — 交付版 `v0.8.1-pre.6` 自動化驗收（A-28）

## 背景

`v0.8.1-pre.6`（D526）含 T0978：以 `/control-tower` 啟動參數開的分頁，第一個 `user-prompt-submit` 不套 2 s Enter 保護窗，修掉「未信任資料夾的信任對話框 Enter 後 2 s 內按的鍵，讓開工回合結束後第一筆待辦分頁回答進待送」（T0972 Q-2 刻意保留的情況，T0970 B3 實錄）。T0978 沒有在打包版上重跑，留下 A-28。使用者已裝好 pre.6，要求派單自動驗收 A-28，比照 T0970 以交付版 zip 隔離實例驗收，pre.5 對照。

## 範圍

- S1–S4（見 frontmatter）：pre.6 全跑，S1 以 pre.5 對照；S5 選用。
- 可新增 / 擴充 `e2e/manual/` 驅動。

## 不做

- 不改產品程式；不碰安裝版 BAT；不發版。

## 驗收

- [x] 前置（兩個測試版 SHA-256、exe 版號、ACC 已登入）
- [x] S1–S4 結果總表與證據（S1 附實際毫秒數）；S1 pre.5 對照
- [x] S5（或不做的原因）
- [x] A-28 判定建議
- [x] 使用者層無變更、安裝版 BAT 未被碰、程序清理
- [x] 改了 `e2e/manual/` 時 build、兩個 typecheck、`node --check`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（S1–S5 全部跑完、全部 PASS；S1 pre.5 對照重現。建議 A-28 判完成，見〈A-28 判定建議〉）
- **開始／完成**：2026-11-28T20:41:05+0800 ～ 2026-11-28T21:01:24+0800
- **session_id**：98bf3289-8f9c-4e3d-96b1-37a1e464b15f

### 落點檢查
- 結果：PASS
- C-0：PASS（frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`）
- C-1：PASS（工單在 `$CT_HOME/_ct-workorders/`）；C-3：PASS（`e2e/manual/` 存在）；C-2：工單沒有 `branch` 欄位，略過
- 證據：`CT_HOME` 已設定、`CT_WORKTREE_BRANCH=ct/T0984`、`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄不比對）；`BAT_REMOTE_TOKEN` 已設定

### 前置條件
| 條件 | 結果 |
|---|---|
| 測試版 zip | PASS：從 Release `v0.8.1-pre.6` / `v0.8.1-pre.5` 下載到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/_dl-<版號>/`；SHA-256 `4c60af904b5dc933d9d61046e205e9628427b5a0fdf8fb60a316a72a1724ab5b` / `d8e491851627ab3dc24801fab53878bccebace2e2ba5cb2fb08d066eb03c6377`，與工單相同 |
| exe 版號 | PASS：解壓到 `…/0.8.1-pre.6-win/`、`…/0.8.1-pre.5-win/`，`BetterAgentTerminal.exe` 存在，`resources/package.json` 版號 `0.8.1-pre.6` / `0.8.1-pre.5` |
| ACC 已登入 | PASS：`claude-config/.credentials.json` 存在（只檢查存在）；3 個塔台都沒有登入提示 |
| 未信任 | PASS：開跑前以 `grep -c` 查 ACC `.claude.json` 有沒有 `runs-t0984`（只取筆數、不讀內容）= 0；S1 兩輪都跳出信任對話框 |
| skills | 隔離 skills `control-tower-version: 6.4.0-pre.2`（T0970 時是 6.4.0-pre.1） |

### 做法
- 三個隔離實例，都經 `ct610-driver.ts`（`launchIsolated`＋`BAT_E2E_EXECUTABLE`、`--runtime=e2e-t0984-<情境>-<時間>`、`dropEnv`、`CLAUDE_CONFIG_DIR=<ACC>/claude-config`）；每輪一份新路徑副本 `ACC/runs-t0984/<S1-p6-1|S1-p5-1|S2-p6-1>/`（`ct-test-project` 複製，加 `_tower-config.yaml` 的 `interactive-prompts: off`）。
- S1：「以塔台開啟 Claude」→ 新增的 `ct-accept-act.mjs trustkey`：畫面出現 `Yes, I trust this folder` 後以 ↓ 移到它（畫面確認反白），再在同一次 `eval` 裡 `terminal.input('\r')`、150 ms、`terminal.input('\x1b[24~')`（F12，BAT 判成草稿 `csi~:24`、claude 不收）。
- S2：同一實例先開一般「Claude CLI」分頁、在信任對話框 ↓＋Enter（不送訊息，沒有產生對話紀錄、沒有 `user-prompt-submit`），再「以塔台開啟 Claude」→ 新增的 `launchkey`：畫面出現啟動命令（`control-tower`）就送 F12。
- `awaiting_user` U-1（S1-p6 另加 U-2 給 S3）在開工回合結束、`set-role … contract=2` 之後由腳本寫進狀態檔 frontmatter（`check-frontmatter.py` PASS）；回答都從待辦分頁點 A＋「送出」。

### 結果總表
| 項目 | pre.6 | pre.5 | 實際毫秒數（UTC 時間） | 證據（`ACC/results-t0984/`） |
|---|---|---|---|---|
| S1 A-28 未信任＋信任 Enter 後按鍵 | **PASS** | **對照重現**（`held … reason=draft`，「立即送出」收尾） | pre.6：Enter→F12 154、Enter→hook **742**、F12→hook **588**；pre.5：151 / **492** / **341**（兩輪都落在條件內，沒有作廢） | `S1-p6/logs`、`S1-00-before.png`、`S1-01-after.png`、`transcript.txt`；`S1-p5/logs`、`S1-01-held.png`、`S1-02-hold-menu.png` |
| S2 已信任、啟動參數回合前按鍵 | **PASS** | — | 啟動命令出現→F12 7、F12→hook **646**（2 s 內沒有 Enter） | `S2-p6/logs`、`S2-01-after.png`、`transcript-709589f4.txt` |
| S3 真草稿仍保留 | **PASS** | — | — | `S1-p6/logs`、`S3-01-held.png`、`S3-02-sent.png`、`transcript.txt` |
| S4 日誌 | **PASS** | （同掃，PASS） | — | 3 份 debug log＋3 份 bat-scripts.log |
| S5（選用）F4 煙霧 | **PASS** | — | ✕ → conhost 已結束 ≤ 4.3 s | `S2-p6/S5-tree.txt`、`S5-00-exited.png`、`S2-p6/logs` |

總表與時序另寫在 `ACC/results-t0984/summary.md`；各情境另有 `state-startup.md` / `state-seeded.md` / `state-final.md`、`tower-output.txt(.raw)`、`tower-screen.txt`、驅動紀錄 `driver-<情境>.log`。

### 各項日誌摘要（UTC，分頁 id 省略）
- **S1 pre.6**：12:46:30.801 `[agent-command] id=<分頁> launch command ends with the launch prompt (launch-prompt turn pending)` → 12:46:37.396 `draft set … cause=csi:B bytes=3`（信任對話框的 ↓）→ Enter 38.117 → F12 38.271 / 38.272 `draft set … cause=csi~:24 bytes=5` → 38.859 `[turn] … started (hook user-prompt-submit)` → 38.860 `[notify-hold] draft cleared terminal=<分頁> (user-prompt-submit; not a contract-2 Tower yet; launch-prompt turn, Enter 742 ms before not guarded)` → 12:47:40.792 `set-role … contract=2` → 12:48:22.811 `answer … source=answer len=5 (sending)` / `sent … reason=none part=text` / 23.075 `part=enter`；沒有 `held … reason=draft`。畫面「✓ 已送出：U-1：A」，對話紀錄 USER `U-1：A` 12:48:23.126（一次），塔台回覆「U-1 已收到：A（收到）」。
- **S1 pre.5（對照）**：沒有 `[agent-command] … launch-prompt turn pending`（pre.5 沒有 T0978）→ 12:50:36.626 `draft set … cause=csi:B` → Enter 37.347 → F12 37.497 / 37.498 `draft set … cause=csi~:24` → 37.839 `draft kept terminal=<分頁> (user-prompt-submit; input 341 ms / Enter 492 ms before)` → 12:51:43.356 `set-role … contract=2` → 12:52:14.928 `held … source=answer reason=draft part=text len=5 queued=1`（「✓ 已排入待送」、縮圖 `📨 待送 1`）→ 12:52:30.957「➤ 立即送出」`send-now requested … released=1` → `sent … reason=draft`；對話紀錄 USER `U-1：A` 一次。
- **S2 pre.6**：12:54:20.457 `launch-prompt turn pending` → 20.530 畫面出現啟動命令 → 20.537 F12 / 20.538 `draft set … cause=csi~:24` → 12:54:21.184 `draft cleared terminal=<分頁> (user-prompt-submit; not a contract-2 Tower yet)`（2 s 內沒有 Enter，所以沒有 `Enter … not guarded` 註記，與 `electron/notify-hold.ts` 的 `enterNote` 條件一致）→ 12:55:30.207 `set-role … contract=2` → 12:56:04.845 `(sending)` / `sent … reason=none`。信任用的 Claude CLI 分頁只有它自己的 `draft set … cause=csi:B`（不是塔台、不影響），沒有 `user-prompt-submit`、沒有產生對話紀錄。
- **S3**（S1-p6，U-1 回合結束後）：逐鍵 `a` `b` `c`（12:49:10.468～11.252，畫面輸入列 `❯ abc`）→ 10.469 `draft set … cause=printable bytes=1` → U-2 回答 12:49:14.885 `held … reason=draft part=text len=5 queued=1`，畫面「✓ 已排入待送：U-2：A」＋「保留原因：你在輸入：塔台輸入框有你還沒送出的文字，通知先保留；你送出（Enter）或清除（Ctrl+C）後 1 秒自動送出。」→ Backspace×3（輸入列空）＋Enter 12:49:27.792 → 28.803 `sent … reason=draft part=text` / 29.068 `part=enter`；對話紀錄使用者訊息依序 `/control-tower`、`U-1：A`、`U-2：A` 各一次（空輸入列的 Enter claude 不送內容）。
- **S4**：所有日誌（S1-p6 / S1-p5 / S2-p6 各一份 debug log 與 bat-scripts.log）中 `abc`（排除分頁 id `…-abcf0e7fcb41` 的子字串後）、`U-1：A`、`U-2：A`、選項文字 `A 收到`、題目文字、`batcap.`、F12 序列、`BAT_REMOTE_TOKEN=` 都是 0 筆。T0978 新增的兩種行只有 id、類別、毫秒：`launch command ends with the launch prompt (launch-prompt turn pending)`（2 行）、`draft cleared … launch-prompt turn, Enter 742 ms before not guarded`（1 行）；`draft set` 7 行都只有 `cause=` / `bytes=`。
- **S5**（S2-p6，選用）：種子 PowerShell 分頁 `exit`（12:57:34，畫面 `[Process exited with code 0]`）→ 隔離 Terminal Server（pid 42332，父程序 = 隔離實例）底下 pwsh 24084 結束、conhost 43216 仍在 → 切到該分頁按 ✕（12:59:33.14，日誌 `[PtyManager] pty:kill id=<分頁> (exited by itself) → Terminal Server releases its console`）→ 12:59:37.5 再查 conhost 43216 已不在；塔台與 Claude CLI 分頁的 conhost 36224 / 37936 與 pwsh 都還在。只查隔離 Terminal Server 的子程序樹（以父 pid 篩選），沒有碰其他程序。

### A-28 判定建議
- **A-28 建議判完成**。A-28 = 「未信任資料夾『以塔台開啟 Claude』，信任對話框按 Enter 後立刻按鍵，開工回合結束後從待辦分頁回答 → 立即送出、不進待送」：pre.6 時序落在 T0978 的條件內（Enter→hook 742 ms < 2 s、F12→hook 588 ms ≥ 300 ms），日誌依序出現工單預期的三行，回答 `sent … reason=none`、塔台收到 `U-1：A` 一次；pre.5 同樣時序（492 / 341 ms）重現 `draft kept` → `held … reason=draft`，情境可分辨修正前後。
- 不回歸：已信任資料夾（S2，T0972 路徑）照舊清除並立即送出；真的草稿（S3，T0964 / T0978）照舊保留、清除後只送一次；日誌不含內容（S4）。
- S1 每個版本只跑一輪（兩輪都有效、結果與預期一致，沒有作廢）；T0970 的 B3 實錄（Enter→hook 517 ms）也在 pre.6 這輪的時序範圍內。
- S5（F4 / T0983）交付版煙霧測試也通過，可作為 BUG-238 交付版驗證的參考（本單選用項目，不影響 A-28）。

### 產品變更
- 沒有改產品程式、沒有改 `e2e/fixtures/`。
- `e2e/manual/ct-accept-act.mjs`：新增 `trustkey`（信任對話框 Enter 與按鍵在同一次 `eval`、回報兩個時間與間隔）、`launchkey`（畫面出現啟動命令後立刻按鍵）。
- `e2e/manual/README.md`：T0984 段（兩個指令的用法與判讀條件、怎麼準備「已信任」的資料夾）。
- commit `5e955fa3788f6d03d86031ce371ebbb7483a9641`（`ct/T0984`）。

### 驗證
| 關卡 | 結果 |
|---|---|
| 相依：worktree 沒有 `node_modules`，依專案慣例 `npm ci` | exit 0 |
| `node --check e2e/manual/ct-accept-act.mjs`（`5e955fa3`） | exit 0 |
| `npx vite build`（`5e955fa3`） | exit 0 |
| `npm run typecheck`（`5e955fa3`） | exit 0（0 個錯誤） |
| `npm run typecheck:electron`（`5e955fa3`） | exit 0（0 個錯誤） |
| `trustkey` / `launchkey` 實際使用 | S1-p6、S1-p5 用 `trustkey`，S2-p6 用 `launchkey`（commit 前的同一份程式；commit 後沒有改動） |
| 換行 | 兩個檔都是 LF（`\r` 0 個） |

### 環境與清理
- 三個驅動都以 `closeIsolated` 結束：Terminal Server `alive after teardown: false`、runtime userData 已刪（`driver-<情境>.log`）；之後查 `ExecutablePath` 含 `BAT-TestBuilds` 或命令列含 `e2e-t0984` / `ct610-driver` 的程序：0 個；`%APPDATA%` 下沒有 `BetterAgentTerminal-runtime-e2e-t0984*`。
- 使用者安裝的 BAT：程序 pid 前後相同（`BetterAgentTerminal.exe` 5 個＋`bat-pty-holder.exe` 1 個，`installed-bat-pids-before.txt` / `-after.txt`），沒有執行、關閉、連線或碰它的 userData / holder。
- 使用者層：`~/.claude`（skills、settings.json、CLAUDE.md、hooks、installed_plugins.json）與 `~/.codex`（skills、config.toml、AGENTS.md）共 1,202 檔，開工前後 SHA-256 完全相同（`userlayer-before.json` / `-after.json`）。
- `claude-config/` 的帳號檔沒有讀取、複製或摘錄（`.credentials.json` 只查存在；`.claude.json` 只以 `grep -c` 取路徑筆數）；只轉出本單三個副本 `projects/<runs-t0984-*>/*.jsonl` 的對話紀錄。ACC 先前輪次的目錄沒有動；`ACC/runs-t0984/*` 保留（都沒有 commit）。
- 輔助腳本（使用者層雜湊、`awaiting_user` 注入、S5 程序樹）只放在本 session 的 scratchpad，沒有進 repo。

### 遭遇問題
- 一次截圖（S5 切分頁時）Playwright `page.screenshot` 逾時 30 s，重試成功；不影響判定。
- S4 掃描時 `abc` 在 S2-p6 的日誌有 172 筆，查證全是塔台分頁 id `41e1709b-…-abcf0e7fcb41` 的子字串，排除後 0 筆。
- 隔離帳號用量沒有碰到上限；每個需要模型的狀態都一次就出現（沒有重試）。

### 互動紀錄
- 無（yolo；沒有向使用者或塔台提問）。

### 隔離分支證據
- branch：`ct/T0984`
- base_sha：`507b99eba272e4a7af7d3c54804cc1d083ecc9f4`
- validated_sha：`5e955fa3788f6d03d86031ce371ebbb7483a9641`
- head_sha：`5e955fa3788f6d03d86031ce371ebbb7483a9641`
- validated_sha ≠ head_sha 的說明：兩者相同（commit 後跑關卡）
- 未 push、未觸發 workflow、未建 tag。

### 回報時間
- 2026-11-28T21:01:24+0800
