---
schema_version: 1
schema_kind: workorder
id: T0867
title: "修 `terminal-server-protocol-v1.test.ts` E 組在 Linux runner（`tests.yml`，ubuntu-24.04）必定失敗的計時競爭——`0.7.5-pre.1` 的 Test gate 前置"
type: implementation
status: IN_PROGRESS
started_at: "2026-11-05T10:26:24+0800"
updated_at: "2026-11-05T10:33:04+0800"
tower_question: open
repo: better-agent-terminal
project: PLAN-065
priority: P1
sizing: S
created_at: "2026-11-05T10:25:21+0800"
depends_on: [T0866]
related:
  - "T0866 回報區〈驗證〉⚠️、〈後續建議〉1；desktop-build `41952687778` / `41952701482` 的 `tests` job；T0857（加入該測試）；CLAUDE.md「Frontend unit tests」fake timers 規則（T0508：fake timers 下不要用 `vi.waitFor` 等 socket 事件，改事件驅動的 `until()`）；「Packaging / Release 前置檢查」Test gate"
affects_files:
  - _ct-workorders/T0867-protocol-v1-test-linux-timing.md
  - electron/__tests__/terminal-server-protocol-v1.test.ts
  - electron/__tests__/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改測試：讓 E 組（`3 late ticks with the server process (pid file) alive …`、`a pong ends the late run …`）在 Linux runner 上穩定，斷言的意義不變（不得降低期望值、拉長到失去意義、或 skip）。若查證發現是產品程式在 Linux 上真的錯（不是測試等待不足）→ 停下回報 PARTIAL，不改產品。"
  - "🔴 驗證要在 Linux 上：可 push `origin main`（push 前掃金鑰樣式、家目錄路徑、`.private/` 去識別化樣式，結果寫回報區；不 force-push），可手動觸發 `tests.yml`（`gh workflow run tests.yml -R gowerlin/better-agent-terminal --ref main`），上限 5 次；要求最後一次 `tests.yml` 整個 job 綠（`test:unit` 與 `test:legacy`）。可用 WSL 先在本機 Linux 跑該檔（有的話），不是必要。不跑 `pre-release.yml` / `release.yml` / `desktop-build.yml`，不建 tag / Release。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑。"
---

# T0867 — protocol v1 測試 E 組的 Linux 計時競爭

## 元資料
- **工單編號**：T0867｜**類型**：implementation｜**狀態**：IN_PROGRESS｜**建立**：2026-11-05 10:25 (UTC+8)
- **規模**：S｜**依賴**：T0866

## 背景
T0866 的兩次 desktop-build（`41952687778`、`41952701482`）`tests` job 都失敗在 `electron/__tests__/terminal-server-protocol-v1.test.ts` E 組兩項（收到的 ping 2 < 12 等）；本機 Windows 通過。這是 T0857 加的真 socket＋fake timer 測試，之前的 desktop-build 用 `checks=false`，CI 沒跑到。`pre-release.yml` / `release.yml` 的 Test gate 用同一個 `tests.yml`（ubuntu-24.04），不修就擋 `0.7.5-pre.1`。

## 任務
1. 查證失敗原因（看 run 的 log；可能是 `advance` 後只 `flush(20)`，真實 socket 的資料在 Linux 上來不及到）。
2. 改測試的等待方式（照 CLAUDE.md T0508 規則：事件驅動等待、`setInterval` 逐拍推進），斷言不變。
3. 本機 `npm run test:unit` 全過；push 後觸發 `tests.yml`，最後一次整個 job 綠。

## 驗收條件
- [ ] 失敗原因（一兩句）
- [ ] `tests.yml` 綠（附 run id）；本機 `npm run test:unit` 全過、`npm run typecheck:electron` = 0
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策

#### Q-1：push 範圍內塔台的未推 commit `2a16acde` 命中去識別化樣式，要怎麼處理才能 push？
- **提問時間**：2026-11-05 10:33 (UTC+8)
- **狀況**：本單要 push `origin/main`（`origin/main..HEAD` = `2a16acde`、`e7c802c0`、`74251312`、`c0dfaa27`）才能在 Linux 跑 `tests.yml`。push 前掃描（`.private/` 對照表樣式＋金鑰樣式，對象是這 4 個 commit 的新增行與 commit 訊息）命中 1 行：`2a16acde`（T0866 回報區「push 前掃描」那一行）把兩個去識別化檢查詞原文寫出來（`.private/` 對照表第六節的工作區代號＝專案D、與帳號小寫單字）；同一行另外兩個樣式（客戶名的一個樣式、外掛殘留標籤）也是原文寫出，金鑰前綴則是樣式本身。origin 上目前沒有這兩個詞。其他樣式（客戶名、家目錄路徑、真的權杖）0 筆。Worker 的 commit `c0dfaa27`（只改測試檔）沒有命中。
- **選項**：
  - A. 塔台自己改寫未 push 的 `2a16acde`（把那一行改成「依 `.private/` 的檢查樣式」），完成後在本單答覆，Worker 再掃一次並 push。
  - B. 授權 Worker 改寫 `origin/main..HEAD` 的歷史：把 T0866 那一行改成「依 `.private/` 的檢查樣式」，以 fixup commit＋非互動 `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash origin/main` 併進 `2a16acde`（4 個未推 commit 的 hash 都會變；不 force-push，因為都還沒推）。
  - C. 判定可接受（只是樣式名稱、沒寫出對應對象），照原樣 push。
  - 其他。
- **建議**：B（或 A）。公開 repo 一旦 push 就無法收回（D176：「有命中先處理再 push」）；這 4 個 commit 都還沒推，現在改寫歷史沒有成本。B 由 Worker 一次做完，比 A 少一次往返；但這動到 T0866 工單檔與塔台的 commit，超出本單 `affects_files` 與 L138（禁止 `git reset` 等），所以需要塔台明確授權。
- **影響**：不 push 就無法完成驗收（`tests.yml` 綠）。
- **是否阻擋後續步驟**：是（push 與 `tests.yml` 都卡在這裡；本機修正與 `npm run test:unit` 已完成）。
