---
schema_version: 1
schema_kind: workorder
id: T0890
title: "評估：Windows Terminal Server 與 PTY holder 以較小的 V8 新生代（`--max-semi-space-size`）啟動，降低反覆開關分頁的記憶體高水位（BUG-214），在 `v0.8.x` 分支"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-24T00:55:03+08:00"
updated_at: "2026-11-24T00:55:03+08:00"
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
- **狀態**：PENDING
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
