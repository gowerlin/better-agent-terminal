---
schema_version: 1
schema_kind: workorder
id: T0707
title: "`v0.7.1-pre.8` Test gate 在 ubuntu 失敗的 2 項測試：`terminal-server-pty-env.test.ts`（T0705 新增，真 node-pty）與 `blocked-hooks-launch.test.ts`「argv reaches node intact」"
type: implementation
status: DONE
repo: better-agent-terminal
project: ""
priority: P1
sizing: S
created_at: "2026-10-25T21:45:59+0800"
started_at: "2026-10-25T21:46:51+0800"
updated_at: "2026-10-25T21:53:07+0800"
completed_at: "2026-10-25T21:53:07+0800"
target_version: "0.7.1-pre.8"
depends_on: [T0705, T0704]
related:
  - "pre-release run `40198701601`（`dbcefba3`，2026-10-25T13:40Z）：`tests / unit-tests` failure → build / release skipped，**沒有建立 tag**；Test Files 2 failed / 335 passed / 1 skipped，Tests 2 failed / 6012 passed / 6 skipped"
  - "失敗 1：`electron/__tests__/terminal-server-pty-env.test.ts > real node-pty through handleMessage > the shell sees the host env but not the server settings`（71 ms），`AssertionError: expected '%s' to be '' // Object.is equality`。T0705（`d7ffa080`）新增；T0705 回報說 Windows 用 `cmd.exe` 實測"
  - "失敗 2：`electron/__tests__/blocked-hooks-launch.test.ts > claude hooks injection > the command runs as written in bash and PowerShell (when installed): argv reaches node intact`（5308 ms）。既有測試，pre.7 run `40192111428` 通過；本機 Windows 塔台聯合驗證 @ `dbcefba3` 6017 / 6017 通過"
  - "CI 測試步驟只在 `.github/workflows/tests.yml`（CLAUDE.md「Packaging / Release 前置檢查」Test gate）；手動試跑 `gh workflow run tests.yml -R gowerlin/better-agent-terminal`"
  - "前例：T0683 / T0684 以 WSL 模擬 ubuntu 跑測試（Linux `TZ=UTC`）"
affects_files:
  - electron/__tests__/terminal-server-pty-env.test.ts
  - "electron/__tests__/blocked-hooks-launch.test.ts（只在確認是測試問題時）"
  - "產品檔（只在確認是產品在 Linux 上的真實缺陷時；先問塔台）"
  - _ct-workorders/T0707-fix-ci-linux-test-failures-pre8.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先判斷是測試問題還是產品問題，各附證據：取 CI 失敗日誌（`gh run view 40198701601 -R gowerlin/better-agent-terminal --log-failed`，🔴 `gh` 一律帶 `-R`），在 Linux（WSL ubuntu，或 `gh workflow run tests.yml` 試跑）重現。失敗 1 的【推論】：測試用的 shell 指令在 Linux 上讀不到 / 印出 `%s` 字面；若產品 `buildServerPtyEnv` 在 Linux 上沒排除鍵，就是產品缺陷 → 先問塔台。失敗 2：查是逾時（5 s）、ubuntu 上的 PowerShell 行為，還是這批（T0704 / T0705）改動影響；查 pre.7 run 該項的耗時做對照。"
  - "🔴 修法：只修讓測試在 Windows、Linux、macOS 都正確的寫法（例如依平台選 shell 與讀 env 的指令、用 `node -e` 印 env 取代 shell 語法）；不得用 `skip` / `skipIf` 讓失敗消失，除非該平台本來就無法測（寫明理由並問塔台）。逾時類只在確認是 CI 慢、不是卡住時才調 timeout，並寫出實測耗時。"
  - "🔴 驗證：兩個測試檔在 Windows 與 Linux（WSL ubuntu）都通過，附輸出摘要；`npm run test:unit` 在 Windows 全綠；`npm run typecheck:electron` = 0。可以用 `gh workflow run tests.yml -R gowerlin/better-agent-terminal --ref main` 試跑 CI，但要先 commit 且由塔台 push，所以 Worker 不 push：改成在回報區寫「建議塔台 push 後試跑 tests.yml」。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 `pre-release.yml`、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。工單完成狀態寫 `DONE`（不要寫 FIXED，L177）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。yolo：不得問使用者，判讀問題問塔台（每輪最多 3 題）。"
---

# T0707 — pre.8 Test gate ubuntu 失敗

## 背景

塔台觸發 `pre-release.yml -f version=0.7.1-pre.8`（run `40198701601`，`dbcefba3`），Test gate 在 ubuntu 有 2 項失敗，build 與 release 被跳過、沒有建立 tag。同一個 commit 在本機 Windows 全部通過（6017 / 6017）。修好後塔台以同一版號重跑。

## 實作

1. 重現兩項失敗並判斷原因（測試 / 產品）。
2. 修正測試（或在問過塔台後修產品）。
3. Windows + Linux 驗證。

## 驗收

- [x] 兩項的原因有證據（日誌、重現輸出）
- [x] 兩個測試檔在 Windows 與 Linux 都通過；沒有用 skip 規避
- [x] `npm run test:unit`（Windows）全綠；`npm run typecheck:electron` = 0

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策（僅 yolo Worker 有問題時）

（無）

### 完成狀態

**DONE**。兩項都是測試問題，產品沒有缺陷；只改了兩個測試檔，沒有用 skip。

### 落點檢查

PASS：C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 兩個測試檔存在；未設 `CT_HOME`（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只是證據）。

### 原因分析

**失敗 1：`terminal-server-pty-env.test.ts`「the shell sees the host env but not the server settings」，是測試問題。**
- 【事實】Linux 分支送進 PTY 的指令是 `printf 'T0705:[%s]:[%s]:[%s]\n' "$BAT_IDLE_TIMEOUT_MS" …`，shell 回顯的指令文字本身就含 `T0705:[%s]:[%s]:[%s]`，符合輸出 regex `/T0705:\[([^\]\r\n]*)\]:…/`。`vi.waitFor` 第一次比對到的是回顯，抓到字面 `%s`，所以 `expected '%s' to be ''`。註解寫「printf `%s` 不會比對到」是錯的，Windows 分支用 `^:` 才真的避開了回顯。
- 【事實】WSL Ubuntu 24.04 在 `dbcefba3` 重現，錯誤訊息與 CI 相同（`expected '%s' to be ''`，terminal-server-pty-env.test.ts:143）。
- 【事實】產品 `buildServerPtyEnv` 在 Linux 上正確：修正後的測試在 WSL 通過（idle / scroll = `''`，host = `host-val`）。反向驗證：只在 WSL 副本把 `server.ts:48` 的 `delete inherited[key]` 註解掉，測試以 `expected '1800000' to be ''` 失敗；之後已還原，正式 repo 沒動。
- T0705 在 Windows 只用 `cmd.exe` 實測，所以沒跑到這個分支。

**失敗 2：`blocked-hooks-launch.test.ts`「argv reaches node intact」，是 CI 慢、不是卡住，也與 T0704 / T0705 無關。**
- 【事實】CI 錯誤是 `Test timed out in 5000ms`，耗時 5308 ms。vitest 4.1.5 的 `withTimeout`（`@vitest/runner` chunk-artifact.js）處理 sync 測試時，只在函式**成功返回之後**發現已超過 timeout 才報這個錯；assertion 若失敗，會先拋出 AssertionError。所以這次所有 assertion 都通過了，只是超時。
- 【事實】這個測試同步依序跑 bash 與 pwsh 兩個真 shell（每個 `spawnSync` timeout 20 s），卻用 vitest 預設的 5 s。如果真的卡住，耗時會是 ≥ 20 s，不是 5.3 s。
- 【事實】耗時對照（ubuntu-24.04 runner）：pre.7 run `40192111428`（job `121165114735`）**2992 ms** 通過；pre.8 run `40198701601` **5308 ms**。本機 Windows：bash 約 55 ms、pwsh 約 250–300 ms。
- 【推論】ubuntu runner 的 pwsh 冷啟動（.NET）加上整個 suite 平行執行的負載，讓耗時在 3–5 s 間浮動，pre.8 剛好超過 5 s。【事實】pre.7（`0905e0c0`）到 `dbcefba3` 之間，`electron/bat-mcp-launch.ts`、`scripts/bat-hook.mjs`、`blocked-hooks-launch.test.ts` 都沒有改動（`git diff --stat` 為空），所以與 T0704 / T0705 無關。

### 實作摘要

- `electron/__tests__/terminal-server-pty-env.test.ts`：Linux 指令改成 `printf 'T07%s:[%s]:[%s]:[%s]\n' 05 …`，回顯變成 `T07%s:[…`，不再符合 regex；實際輸出仍是 `T0705:[…]`。也修正了註解。Windows 分支不變。
- `electron/__tests__/blocked-hooks-launch.test.ts`：這個測試加上 timeout `45_000`（涵蓋兩個 20 s 的 spawn timeout），並寫註解附實測耗時。沒有改任何 assertion。
- 產品檔沒有修改。

### 驗證證據

| 項目 | 環境 | 結果 |
|---|---|---|
| 修正前重現 | WSL Ubuntu 24.04、node v24.22.0、`dbcefba3` 的 `git archive` 副本 + `npm ci` | 失敗 1 重現（`expected '%s' to be ''`）。失敗 2 在 WSL 通過，因為 WSL 沒有 pwsh，只跑 bash |
| 兩個測試檔 | WSL，修正後 | 連跑 3 次都是 `Test Files 2 passed (2)`、`Tests 22 passed (22)` |
| 反向驗證 | WSL 副本，產品不排除鍵 | 失敗 1 的測試以 `expected '1800000' to be ''` 失敗，之後已還原 |
| 兩個測試檔 | Windows | `Test Files 2 passed (2)`、`Tests 22 passed (22)` |
| `npm run test:unit` | Windows | exit 0，`Test Files 338 passed (338)`、`Tests 6017 passed \| 3 skipped (6020)`，58.13 s |
| `npm run typecheck:electron` | Windows | exit 0 |
| `npm run test:unit`（補充） | WSL | 2 項失敗都與本單無關，見「遭遇問題」；其餘 6012 項通過 |
| CI | — | Worker 沒有 push、沒有試跑。**建議塔台 push 後試跑** `gh workflow run tests.yml -R gowerlin/better-agent-terminal --ref main`，再以 `-f version=0.7.1-pre.8` 重跑 pre-release |

限制：WSL 沒有安裝 pwsh，所以失敗 2「bash + pwsh 都跑」的情境在 Linux 只有 CI 能驗證。

### 互動紀錄

（無；yolo，沒有向塔台提問）

### 遭遇問題

- WSL 跑完整 `test:unit` 時另有 2 項失敗：`tls-fingerprint.test.ts`「maps a refused connection to fingerprint-unreachable」與 `server-bundle-download-retry.test.ts`「real fetch to a closed local port is classified as ECONNREFUSED」（`expected 'ECONNRESET' to be 'ECONNREFUSED'`）。原因是本機 `.wslconfig` 設了 `networkingMode=Mirrored`，連到已關閉的 localhost port 會回 `ECONNRESET`。這兩項在 CI ubuntu 的 pre.7 與 pre.8 run 都通過（pre.8 只有本單的 2 項失敗），屬於本機環境問題，不在本單範圍，沒有修改。日後用 WSL 模擬 CI 時要注意這點（可供 T0683 / T0684 的做法參考）。

### Commit

- `3b3f034c` test: T0707 fix two tests that fail on the ubuntu CI runner（`git commit --only` 兩個測試檔，LF）
- 工單回報另外 commit（`chore: T0707 report, DONE (ct)`）
- 沒有 push、沒有觸發 workflow、沒有建 tag

### 回報時間

2026-10-25T21:53:07+0800
