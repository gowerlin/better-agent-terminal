---
schema_version: 1
schema_kind: bug
id: BUG-200
title: "`terminal-blocked-state.test.ts` 的 T0790 / T0791「兩個真實 hook 程序」測試靠 300 ms 時間差製造亂序，重負載下順序不顛倒而失敗；另有 5 檔真子程序測試在兩個 `test:unit` 同時跑時逾時"
status: FIXED
severity: low
reproducibility: rare
created_at: "2026-11-02T23:01:45+0800"
updated_at: "2026-11-02T23:58:42+0800"
fixed_at: "2026-11-02T23:58:42+0800"
fix_commit: 2b3f0b1b
impact:
  - test-infra
links:
  discovered_in: "T0793 回報區〈修完後出現第六支以上逾時〉（兩個 `test:unit` 同時跑）"
  related: [BUG-195, BUG-197, BUG-198, BUG-199, T0786, T0790, T0791, T0793]
---
# BUG-200 — 真 hook 程序順序測試與真子程序測試在重負載下失敗

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響測試；產品行為無關。CI Test gate 若撞到會擋發版） |
| 可重現 | 只在重負載：兩個 `npm run test:unit` 同時跑（24 核）時出現；正常整套 3 次、`test:unit` ＋ 8 個 CPU 忙迴圈都沒有出現（T0793） |
| **狀態** | ✅ FIXED（T0794 `2b3f0b1b`，待 CI Test gate 驗收） |
| 回報者 | 塔台（T0793 Worker 首次記錄） |

## 現象

### A. 順序斷言失敗（測試設計問題，拉長 timeout 解決不了）

- `electron/__tests__/terminal-blocked-state.test.ts` 第 1337 行（T0790 / BUG-197）與第 1365 行（T0791 / BUG-198）：先 spawn 一個 hook 程序並寫 stdin 不關閉（讓它等 `STDIN_TIMEOUT_MS` 300 ms 才回報），30 ms 後再跑第二個 hook，預期第二個先到。
- 重負載下第二個 node 程序啟動＋回報超過約 270 ms，兩者照啟動順序到達，斷言 `expected [ 'stop', 'user-prompt-submit' ] to deeply equal [ 'user-prompt-submit', 'stop' ]` 失敗（耗時 0.67–1.4 s，不是逾時）。T0793 三次重負載都出現。

### B. 重負載下的逾時（預設 5 s 或既有 30 s）

| 檔案 | 測試 | 耗時 |
|---|---|---|
| `electron/__tests__/server-bundle-install-script.test.ts` | `install script under a real sh (T0552 / BUG-139)` 多個 it | 5.04–6.93 s |
| `src/lib/remote-tools/__tests__/node-libatomic-shell.test.ts` | `the library is there: no package manager runs …` | 5.5 / 5.6 s |
| `electron/remote/__tests__/headless-git.test.ts` | `git-scaffold:healthCheck / getRepoInfo / listCommits …` 等 3 個 | 5.0–5.2 s |
| `electron/__tests__/git-scaffold-env.test.ts` | 1 個 | 5.0 / 5.4 s |
| `electron/__tests__/terminal-blocked-state.test.ts` | `T0657: PostToolBatch clears a permission prompt …` | 5.0 / 5.3 s |
| `electron/__tests__/worktree-status-after-close.test.ts` | `live → exited → git (registered) → …` | 30.0 s（T0786 已設的 30 s 也被超過） |

## 判斷

- A 是測試以牆鐘時間差製造亂序，負載一高就失去前提；應改由測試控制回報到達順序（例：測試用的 RemoteServer 收到先啟動程序的回報時先暫存，等第二個回報處理完再處理），而不是靠 300 ms 時間差。
- B 與 BUG-195 / BUG-199 同類；目前只在兩個 `test:unit` 同時跑才出現，CI（單一 `test:unit`）未見。T0793 評估過三個做法：A 共用常數、B vitest `test.projects` 分出真子程序專案並降低平行度（唯一處理根因，M，需改 `vite.config.ts` 屬政策）、C 逐檔處理。

## 修正方向

- A：改寫兩支測試的亂序製造方式（不改產品、不改 `bat-hook.mjs`）。
- B：先觀察；若 CI 或正常整套出現同類逾時，再以 T0793 評估的 B 案開 PLAN（塔台決策）。

## 處理紀錄

- 2026-11-02 23:01 開單（OPEN，low）。T0793 收單時登記；不擋任何發版，建議與下一版前的修正一起處理（D235）。
- 2026-11-02 23:05 → FIXING：使用者決定現在修（D236），開 T0794（P2，M）：A 改寫兩支順序測試由測試控制到達順序；B 5 檔＋`worktree-status-after-close` 先量再改；不改 `vite.config.ts` 與產品。
- 2026-11-02 23:58 → FIXED（T0794 `2b3f0b1b`，只改測試檔；待 CI Test gate 驗收）。

## T0794 結果

- **A（順序測試）**：T0790 / T0791 兩支改成由測試控制到達順序：handler 攔住先啟動程序的回報，等它到達 BAT 之後才 spawn 第二個程序，第二個回報處理完才放行。仍是兩個真實 `bat-hook.mjs` 程序，斷言不變。另發現第二種失敗：重負載下先 spawn 的程序反而較晚啟動（`at` 較晚），改寫後一併排除（第二個程序在第一個的回報到達後才 spawn）。
  - 修改前：單跑這兩支＋96 個 CPU 忙迴圈執行緒，10 次失敗 7 次（順序顛倒、`at` 顛倒、5 s 逾時）；48 執行緒 5 次失敗 1 次（`at` 顛倒）。兩套 `test:unit` 同時跑 3 次（6 套）都沒出現。
  - 修改後：96 執行緒下順序 / `at` 斷言不再失敗，但仍是預設 5 s 時 10 次中 8 次逾時；describe 設 30 s 後 10 次中 9 次通過、1 次是 `beforeAll`（RemoteServer 產生自簽憑證）超過預設 10 s；`beforeAll` 也設 30 s 後再跑 10 次，10 次全過（最慢 12.5 s）。
  - 突變檢查：暫時拿掉產品 `TerminalBlockedTracker` 的兩處 `at` 比較 → 兩支都失敗；已還原，產品檔無差異。
- **B（逾時）**：`server-bundle-install-script`、`node-libatomic-shell`、`headless-git`（2 個 describe）、`git-scaffold-env`、`terminal-blocked-state`（hook describe）設 30 s；`worktree-status-after-close` 40 s（兩套並行下 14.1–19.2 s，git trace2：時間花在每次建立程序，不是某一步），測試自己的 git 關掉自動 maintenance。註解寫量測值。
- 驗證：整套 3 次 exit 0；兩套並行 2 次範圍內 6 檔全過（第 1 次兩邊都只有範圍外的 `scripts/__tests__/dev-deploy-headless.test.mjs` 失敗：兩套同時寫 `dist-server/dev-deploy-headless`，EPERM／ENOENT，修改前也出現）；`typecheck` / `typecheck:electron` = 0；`test:legacy` 33 / 33。詳見 T0794 回報區。
