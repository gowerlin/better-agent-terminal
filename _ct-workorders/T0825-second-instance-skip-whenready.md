---
schema_version: 1
schema_kind: workorder
id: T0825
title: "BUG-210：沒拿到 single-instance lock 的第二個 BAT 實例不跑 whenReady 的任何啟動步驟"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-04T03:04:55+0800"
depends_on: []
related:
  - "BUG-210；D268；T0823（`electron/main.ts` `installerQuitRequestProcess` / `installerQuitWithoutApp`、whenReady 開頭的 return；回報區〈實作中發現並修正的三件事〉1）；T0485（啟動期日誌、app-paths-bootstrap 規則）；PLAN-039（profile 視窗的 `second-instance --profile=`）"
affects_files:
  - _ct-workorders/T0825-second-instance-skip-whenready.md
  - electron/main.ts
  - electron/__tests__/
  - e2e/
  - docs/agent-guide/upgrade-interruption.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改沒拿到 lock 的實例：拿到 lock 的主實例啟動流程、`second-instance` handler（含 `--profile=` 開 profile 視窗、T0823 `--installer-quit-request`）的行為完全不變；T0823 的 `installerQuitWithoutApp`（請求行程拿到 lock、只停保留的 server）不變。"
  - "🔴 CLAUDE.md 既有規則照守：`app-paths-bootstrap` 必須維持 `main.ts` 的第一個 import（`app-paths-bootstrap-order.test.ts` 守住）；不在 main.ts handler 之前註冊 `uncaughtException` / `unhandledRejection`；任何模組不得在 import 期呼叫 `app.getPath('userData')`。若發現 ready 之前的模組層副作用對第二個實例有害、需要搬動，先問塔台，不要自行重排啟動順序。"
  - "🔴 不碰本機 BAT 安裝版與它的 Terminal Server；e2e 一律隔離 runtime（同 runtime 起兩個實例），結束只關自己啟動的程序。yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0825 — 第二個實例不跑 whenReady（BUG-210）

## 元資料

- **工單編號**：T0825
- **類型**：implementation
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-04T03:04:55+0800
- **預估規模**：S

## 背景

見 BUG-210。`electron/main.ts` 約 230 行 `!gotTheLock` 時 `app.quit()`，但 whenReady（約 1786 行）照樣執行；T0823 只替 `--installer-quit-request` 的請求行程在 whenReady 開頭 return。使用者決定併入 `0.7.4-pre.6` 這一批（D268）。

## 範圍

1. whenReady 開頭：沒拿到 lock 的實例一律 return（與 T0823 的 return 合併成一個判斷，保留 T0823 的語意與註解；寫明為什麼 `app.quit()` 擋不住）。
2. 盤點 `ready` 之前、模組層會對第二個實例產生副作用的程式（寫檔、開埠、fork、改設定），列在回報；無害的照舊，有害的先問塔台。
3. 記一行 debug log（例 `[startup] second instance: handed off to the running BAT, skipping startup`），不記 argv 內容。

## 驗證

- 單元 / source guard：whenReady 開頭對 `!gotTheLock` 的 return；T0823 既有測試照過。
- e2e（隔離 runtime）：同 runtime 起主實例（含一個 shell 分頁）→ 再起第二個實例（不帶參數）→ 第二個實例退出、日誌沒有 whenReady 之後的啟動行、沒有新的 Terminal Server / pid 檔變動、主實例不受影響；帶 `--profile=` 的情境若既有 e2e 已涵蓋就跑它（PLAN-039）；T0823 的 `t0823-installer-graceful-quit` e2e 照過。
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`。

## 驗收

- [ ] 第二個實例不跑啟動步驟（附日誌與程序證據）
- [ ] ready 前副作用盤點
- [ ] 主實例 / `second-instance` / T0823 不回歸
- [ ] typecheck 0 / 0、unit、legacy、vite build
- [ ] docs（`upgrade-interruption.md` 若有提到第二個實例的已知限制就更新）

---

## 回報區

（由 Worker 填寫）
