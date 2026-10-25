---
schema_version: 1
schema_kind: workorder
id: T0707
title: "`v0.7.1-pre.8` Test gate 在 ubuntu 失敗的 2 項測試：`terminal-server-pty-env.test.ts`（T0705 新增，真 node-pty）與 `blocked-hooks-launch.test.ts`「argv reaches node intact」"
type: implementation
status: PENDING
repo: better-agent-terminal
project: ""
priority: P1
sizing: S
created_at: "2026-10-25T21:45:59+0800"
started_at: ""
updated_at: "2026-10-25T21:45:59+0800"
completed_at: ""
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

- [ ] 兩項的原因有證據（日誌、重現輸出）
- [ ] 兩個測試檔在 Windows 與 Linux 都通過；沒有用 skip 規避
- [ ] `npm run test:unit`（Windows）全綠；`npm run typecheck:electron` = 0

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 原因分析

### 實作摘要

### 驗證證據

### 遭遇問題

### Commit

### 回報時間
