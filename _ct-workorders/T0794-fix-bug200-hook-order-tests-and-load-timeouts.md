---
schema_version: 1
schema_kind: workorder
id: T0794
title: "BUG-200：真 hook 程序順序測試改由測試控制到達順序（不靠 300 ms 時間差）；5 檔真子程序測試在重負載下逾時 —— 量測後讓它們在兩個 `test:unit` 同時跑時也穩定通過"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T23:05:00+0800"
updated_at: "2026-11-02T23:05:00+0800"
session_ids: []
depends_on: []
related:
  - "BUG-200（low，OPEN → FIXING）；T0793 回報區〈修完後出現第六支以上逾時〉〈共用 helper / 標記評估〉；BUG-195 / T0786、BUG-199 / T0793（同類前例：先量再改、per-describe timeout 附量測依據）；T0790 / T0791（兩支順序測試的來源）；D236"
  - "`electron/__tests__/terminal-blocked-state.test.ts` 第 1337 行（T0790 / BUG-197）、第 1365 行（T0791 / BUG-198），以及同檔 `T0657: PostToolBatch clears a permission prompt …`；`scripts/bat-hook.mjs`（`STDIN_TIMEOUT_MS` 300 ms、`hookStartedAt`）；CLAUDE.md「Frontend unit tests」「blocked 狀態偵測」節"
affects_files:
  - electron/__tests__/terminal-blocked-state.test.ts
  - electron/__tests__/server-bundle-install-script.test.ts
  - src/lib/remote-tools/__tests__/node-libatomic-shell.test.ts
  - electron/remote/__tests__/headless-git.test.ts
  - electron/__tests__/git-scaffold-env.test.ts
  - electron/__tests__/worktree-status-after-close.test.ts
  - _ct-workorders/BUG-200-real-hook-order-tests-flaky-under-heavy-load.md
  - _ct-workorders/_bug-tracker.md
  - _ct-workorders/T0794-fix-bug200-hook-order-tests-and-load-timeouts.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 A（主項）—— 順序測試改由測試控制到達順序：T0790 / T0791 兩支「two real hook processes」測試目前靠「第一個程序 stdin 不關、等 300 ms 才回報，30 ms 後第二個程序立即回報」製造亂序，重負載下第二個 node 程序啟動＋回報超過約 270 ms，順序就不顛倒。改寫成**不依賴牆鐘時間差**也能確定到達順序，例：測試用的 RemoteServer / handler 攔截層把先啟動程序的回報暫存，等第二個回報處理完才放行；或以檔案 / 事件同步讓第一個程序在第二個回報被主行程處理之後才關 stdin。仍須是兩個**真實** `bat-hook.mjs` 程序（保留「跨程序 `at` 單調」與 exit 0 / stdout 空的驗證），斷言內容不得放寬（`at` 先後、blocked 維持 / 回合維持、`kept:` 日誌）。🔴 不得改 `scripts/bat-hook.mjs` 或任何產品程式碼；若不改產品就做不到確定順序，停下問塔台。"
  - "🔴 A 的驗證：修改前在重負載下重現失敗（兩個 `npm run test:unit` 同時跑，或只跑 `terminal-blocked-state.test.ts` 時並行造 CPU 負載，寫明方式與次數）；修改後同樣負載下這兩支連跑通過（至少 5 次）；突變檢查：把產品的 `at` 比較拿掉（暫時修改、收尾還原，或以既有的突變方式）→ 這兩支要失敗，證明改寫後仍測得到 BUG-197 / 198。"
  - "🔴 B —— 重負載逾時（比照 T0786 / T0793，先量再改）：`server-bundle-install-script`（`install script under a real sh`）、`node-libatomic-shell`、`headless-git`、`git-scaffold-env`、`terminal-blocked-state` 的 `T0657: PostToolBatch …`。量測單檔 / 整套 / 兩個 `test:unit` 同時跑的耗時，先找可省的工作，再替真子程序的 `describe`（或該 it）設明確 timeout（30 s，與 T0786 / T0793 一致），註解寫量到的最大值與 BUG-200。`worktree-status-after-close` 在兩個 `test:unit` 同時跑時超過 T0786 的 30 s：先量它在該負載下的實際耗時與慢在哪裡；若能縮短就縮短，否則提高到量測最大值約 2 倍並註明（上限 60 s，超過就停下回報）。"
  - "🔴 範圍控制：🔴 不改 `vite.config.ts`（含全域 `testTimeout`、`test.projects`、`maxWorkers`，屬政策）、不改產品程式碼與常數、不 skip / retry、不實作共用 helper / 常數模組（T0793 評估的 A / B 案不做）。修完後若出現第七支以上逾時或其他失敗，不擴大範圍、回報（附檔名與耗時）。"
  - "🔴 驗證（全部）：整套 `npm run test:unit` 連跑 3 次 exit 0；兩個 `npm run test:unit` 同時跑 2 次，兩邊都 exit 0（若仍有範圍外失敗，列表並說明，不算本單失敗，但本單範圍內的檔案必須都過）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:legacy` 綠。不回歸：本單只改測試檔，回報區列出被改的每個測試原本驗什麼、改後是否仍驗同一件事。"
  - "🔴 BUG-200：修好後 `status: FIXED`、加 `fixed_at` / `fix_commit`，表格狀態列同步，處理紀錄加一筆，文末補〈T0794 結果〉；`_bug-tracker.md` 只把 BUG-200 那一列從「⏳ 修復中 (FIXING)」移到「✅ 已修復」（區段標題照 `_local-rules.md` parser 規則），FIXING 區段放回 `_（無）_` 佔位列，更新 frontmatter `breakdown` / `generated_at`、〈統計〉行、〈最後同步〉加一筆。🔴 逐一 Edit，不用全檔 `sed`，改完跑 `src/types/__tests__/bug-tracker.test.ts`（L179）。"
  - "🔴 不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。暫存量測腳本放系統暫存目錄、用 Write 寫檔（含反斜線的內容不用 heredoc，L129），收尾刪除。完成狀態寫 `DONE`（BUG 的 FIXED 寫在 BUG 單，L177）。"
---

# T0794 — BUG-200：真 hook 程序順序測試與重負載逾時

## 元資料

- **工單編號**：T0794
- **類型**：implementation（測試穩定性）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-02T23:05:00+0800
- **預估規模**：M

## 背景

T0793 在「兩個 `test:unit` 同時跑」的重負載下發現兩類範圍外失敗（BUG-200）：

- **A**：`terminal-blocked-state.test.ts` 的 T0790 / T0791 兩支「兩個真實 hook 程序」測試靠 300 ms 時間差製造亂序，負載一高順序就不顛倒，斷言失敗。這是測試設計問題，拉長 timeout 解決不了。
- **B**：5 檔真子程序測試逾時（含 T0786 已設 30 s 的 `worktree-status-after-close`）。

CI 與正常整套目前都沒出現，但 CI runner 負載一高就可能擋發版。使用者決定在下一版（`0.7.4-pre.1`）前修掉（D236）。

## 範圍

1. A：改寫兩支順序測試，由測試控制到達順序；負載下重現 → 修後穩定 → 突變檢查。
2. B：5 檔＋`worktree-status-after-close` 先量再改。
3. 全部驗證（整套 3 次、兩套並行 2 次、typecheck、legacy）。
4. BUG-200 → FIXED、tracker 同步。

## 不做

- 不改產品程式碼與 `bat-hook.mjs`、不改 `vite.config.ts`、不 skip / retry、不實作共用 helper。

## 驗收

- [ ] A：修改前負載下重現、修改後負載下 ≥ 5 次通過、突變檢查
- [ ] B：各檔量測、修法與理由
- [ ] 整套 3 次 exit 0、兩套並行 2 次範圍內全過
- [ ] `typecheck` = 0、`typecheck:electron` = 0、`test:legacy` 綠
- [ ] 被改測試的驗證內容對照（不回歸）
- [ ] BUG-200 FIXED、tracker 只動該列、parser 測試綠

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
