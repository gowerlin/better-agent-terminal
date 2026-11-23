---
schema_version: 1
schema_kind: workorder
id: T0886
title: "研究：Node 端能否省掉 node-pty 每個 PTY 的 Worker（Windows ConPTY 約 14 MB / 個），並量 macOS / Linux 的 Terminal Server 每分頁增量（PLAN-066 第 1 項）"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-23T16:20:43+0800"
started_at: ""
updated_at: "2026-11-23T16:20:43+0800"
completed_at: ""
session_ids: []
depends_on: [T0885]
related:
  - "PLAN-066；D304 / D305 / D306 / D307；T0885（研究結論與 PoC，分支 `ct/T0885` 的 `experiments/rust-eval/`）；PLAN-065（Windows PTY holder，`scripts/pty-holder.cjs`）；T0857（Terminal Server 協定 v1）；T0540（程序樹）；T0806（Linux PTY fd 防護）"
affects_files:
  - _ct-workorders/T0886-research-node-pty-per-pty-worker-cost.md
  - experiments/node-pty-worker/**
renew_count: 0
isolation: worktree
workdir: worktree ct/T0886
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 worktree 隔離（D305 / D307：實驗與產品改動都不直接進 main）：所有實驗在 BAT 建立的 worktree（分支 `ct/T0886`）進行，依 ct-exec § Worktree Isolation。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）；主 checkout 的其他檔一律不改，不切分支、不 merge / rebase、不 push。"
  - "🔴 研究工單：不改產品程式（`src/`、`electron/`、`scripts/`、`package.json` / lock、`node_modules` 內的檔案都不改，worktree 內也不改）。實驗用的修補（例：替 node-pty 換掉 conout Worker 的做法）一律做成 `experiments/node-pty-worker/` 內的獨立腳本或複本，以 node / electron-as-node 載入，不修改 repo 的 `node_modules`。"
  - "🔴 實驗與量測腳本放 worktree 的 `experiments/node-pty-worker/`，commit 到分支 `ct/T0886`；該目錄放自己的 `.gitignore` 擋 `node_modules/`、建置產物，不得 commit 建置產物或下載的 binary。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。本單不合併。"
  - "🔴 不碰本機 BAT 安裝版與使用者正在用的 BAT 與其 Terminal Server（只能列檔、讀大小與版本）。不觸發任何 GitHub workflow。Linux 量測可用本機 WSL `Ubuntu-24.04`（在 WSL 內另開暫存目錄，做完刪除）；macOS 不實測，以程式碼與 node-pty 原始碼推論並標示。實驗中自己起的 shell / 程序必須全部結束，回報區寫明清理結果（T0885 曾留下孤兒 pwsh）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台（研究型提問上限依 `research_max_questions`）。Git：主 checkout 只 commit 本工單檔；worktree 只 commit `experiments/node-pty-worker/` 下的檔（`git add <明確路徑>`，不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。外部資料只引用官方或可查證來源並附連結；實測、事實、推論分開標示。"
---

# T0886 — 研究：Node 端能否省掉 node-pty 每個 PTY 的 Worker（PLAN-066 第 1 項）

## 元資料

- **工單編號**：T0886
- **任務名稱**：研究：node-pty 每個 PTY 的 Worker 成本能否在 Node 端消除，並量 macOS / Linux 增量
- **狀態**：PENDING
- **類型**：research
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-23 16:20 (UTC+8)

## 研究目標

T0885 發現：Windows 上 `@lydell/node-pty` 1.1.0 為每個 PTY 開一個 `worker_threads.Worker`（`node_modules/@lydell/node-pty/windowsConoutConnection.js:72`、`conoutSocketWorker.js`），每個約 14 MB。BAT 的 Terminal Server 10 個分頁時 167 MB，同樣持有 10 個 PTY 的 Rust 程式只要 2.5 MB。

使用者決定照 T0885 的建議順序做（D307）：**先研究 Node 端能不能把這個成本省掉**。省得掉就做 Node 端修正；省不掉才走 Rust Terminal Server（PLAN-066 第 2–4 項）。本單的結論決定走哪條路。

## 已知資訊

- T0885 回報區（`_ct-workorders/T0885-research-rust-rewrite-evaluation.md`）〈調查結論〉第 3 題與〈PoC 量測〉；量測方法與腳本在分支 `ct/T0885` 的 `experiments/rust-eval/`（`rust-pty-probe/node-probe.cjs`、`measure/tree-usage.ps1`），可用 `git show ct/T0885:<路徑>` 讀取或複製到本單目錄再改。
- PTY 相關程式：Terminal Server `electron/terminal-server/`（Windows 從 PTY holder `scripts/pty-holder.cjs` 執行，見 `CLAUDE.md`「Windows PTY holder」）、`electron/pty-manager.ts`（direct 模式）、Linux fd 防護 `electron/pty-spawn-fd-guard.ts`。改 PTY 行為前必讀 `CLAUDE.md` 相關節（T0540 程序樹、T0572 初始尺寸、T0578 Recovery、T0704 recovery、T0806 / T0807 fd、T0857 協定 v1）。
- `@lydell/node-pty` 是 microsoft/node-pty 的發佈 fork；conout Worker 是上游為了避免 ConPTY 輸出管線阻塞主執行緒而加的。

## 調查範圍與要回答的問題

1. **Worker 為什麼存在**：讀 `@lydell/node-pty` 1.1.0 與上游 microsoft/node-pty 的原始碼與議題 / PR，說明 conout Worker 解決什麼問題（附連結）、拿掉會回到什麼問題（例：死結、輸出卡住、關閉時 hang）。
2. **每個 Worker 的成本拆解**：14 MB 是 V8 isolate 本身、Worker 的 heap、還是 socket 緩衝？用實驗量（例：`resourceLimits`、`--max-semi-space-size`、空 Worker 對照）。
3. **可行的 Node 端做法**（每個都要實測 1 / 5 / 10 PTY 的持有者 Private Bytes，與 T0885 的 node.exe 探針同一量法，並檢查輸出正確、關閉不 hang、沒有殘留程序）：
   - (a) 一個共用 Worker 處理所有 PTY 的 conout（修補後的複本）。
   - (b) 縮小每個 Worker 的成本（`resourceLimits` 等）。
   - (c) 不用 Worker、改在主執行緒非阻塞讀 conout（若上游原本的問題在 Terminal Server 這種專用程序裡不成立）。
   - (d) 上游已有或正在進行的解法（新版本、選項、PR）。
   - (e) 你找到的其他做法。
   每個做法列：省下多少、風險、要怎麼在 BAT 落地（`patch-package`、vendored fork、等上游、或 PTY holder 專用的載入方式），以及對 `CLAUDE.md` 既有不變式的影響。
4. **macOS / Linux 增量**：Linux 用本機 WSL 實測 Node 持有 1 / 5 / 10 個 PTY 的記憶體增量（bash 即可）；macOS 以 node-pty 原始碼推論（unix 路徑有沒有 Worker）。說明 PLAN-066 的記憶體問題是不是只存在 Windows。
5. **結論與分流**：明確回答「Node 端能不能省掉大部分成本（目標：10 個 PTY 的持有者 < 40 MB，對照 Rust 2.5 MB、現況約 170 MB）」：
   - 能 → 給 Node 端修正的實作設計（改哪些檔、落地方式、測試與驗收、風險），可直接拆實作單。
   - 不能 → 說明原因，並列出 Rust Terminal Server 設計單（PLAN-066 第 2 項）要先回答的問題。

## 研究指引

- 先讀 T0885 回報區與 `ct/T0885` 的 `experiments/rust-eval/README.md`，量法沿用以便對照。
- 量測在同一台機器、同一時段，每個情境 3 次取中位數。
- 結論要可決策；實測、事實、推論分開標示。

## 預期產出（寫在回報區）

- 〈調查結論〉逐題回答（附 `檔案:行` 或來源連結）。
- 〈建議方向〉：各做法比較表＋推薦。
- 〈量測〉：原始數字表、方法、限制、重現步驟（指向 `experiments/node-pty-worker/`）。
- 〈建議下一步〉：Node 端實作單或 Rust 設計單的範圍、規模、依賴、驗收方式；另列需要使用者裁決的問題。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 量測

### 建議下一步

### Renew 歷程

### 遭遇問題

### 方法論狀態回寫

### 回報時間
