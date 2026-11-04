---
schema_version: 1
schema_kind: workorder
id: T0857
title: "PLAN-065 W1：Terminal Server 協定 v1（hello / 版本協商、TCP 權杖、不認得的請求回 error、TCP 模式存活判斷、延長 idle 的請求）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: M
created_at: "2026-11-04T18:28:20+0800"
depends_on: []
related:
  - "PLAN-065；D285 / D286（D5 不相容時結束並說明、D7 安裝程式觸發時 idle 延長到 24 h、D8 TCP 權杖）；T0856 回報區〈調查結論〉Q3 與〈建議下一步〉W1；T0704（heartbeat / recovery）；T0578（Recovery create hold）；T0576（權杖跨重開）；T0823（`installer-quit-request.ts` 的 server-only shutdown）"
affects_files:
  - _ct-workorders/T0857-terminal-server-protocol-v1-hello-token.md
  - electron/terminal-server/protocol.ts
  - electron/terminal-server/server.ts
  - electron/terminal-server/pid-manager.ts
  - electron/terminal-server.ts
  - electron/pty-manager.ts
  - electron/main.ts
  - electron/installer-quit-request.ts
  - electron/__tests__/
  - electron/terminal-server/__tests__/
  - docs/agent-guide/terminal-server-recovery.md
  - CLAUDE.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 本單是跨平台修改：Windows / macOS / Linux 的「保留 Terminal Server → BAT 重開 → Recovery 保留 → 接回」行為不得回歸；不做 holder 打包或從 holder 啟動（W2 T0858 / W3 T0859），不改安裝程式（W4 T0860），不改升級後的 UI（W5 T0861）。"
  - "🔴 相容：新版主行程連到不回 hello 的舊 server（macOS / Linux 升級後保留的舊 server、開發模式）→ 當 protocol 0，照今天的訊息集合運作、不送權杖。新版 server 收到未認證的第一個請求 → 回 `error` 並關閉 socket（D8；降回舊版時舊主行程會收到 TCP close，走 T0704 立即 recovery）。協定只做相加，不改舊欄位的意義。"
  - "🔴 權杖：TCP 權杖存在 userData（例 `bat-pty-server.token`，POSIX 0600），只在 server 與主行程之間；🔴 不寫日誌、不進 PTY env（`buildServerPtyEnv` / `buildPtyEnv` 不得帶它）、不進命令列參數。日誌只記協定版本與結果。"
  - "🔴 heartbeat：T0704 的規則（單調時鐘、連續 3 個遲到 tick 且程序或 IPC 至少一個不在才 recovery）不變；只補 TCP 模式（`serverProcess` 為 null）的存活判斷：以 pid 檔＋`process.kill(pid, 0)` 判定程序在不在。recovery 的步驟順序（CLAUDE.md「Terminal Server 存活判定與 recovery」）不變。"
  - "🔴 child_process 規則照 CLAUDE.md「Child Process Spawning」。yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。不碰本機 BAT 安裝版與它的 Terminal Server；需要實際跑 server 時用隔離 runtime 或測試內的暫存 userData。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0857 — PLAN-065 W1：Terminal Server 協定 v1

## 元資料
- **工單編號**：T0857｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 18:28 (UTC+8)
- **規模**：M｜**決策**：D285 / D286｜**依賴**：無（可與 T0858 並行）

## 背景
PLAN-065 讓 Windows 升級時持有終端的程序（今天的 Terminal Server）撐過安裝程式，由新版主行程接回（D285）。T0856 研究發現：「保留 server → BAT 重開 → 接回」這條路今天就有，但協定**沒有版本、沒有握手、沒有認證**，不認得的訊息直接忽略不回應（T0856〈調查結論〉Q3）。升級後新版主行程會常態地連到舊版 server，所以先補協定。設計細節見 T0856 回報區 Q3 與〈建議下一步〉W1。

## 任務
1. `server:hello { protocolMin, protocolMax, token }` → `server:hello-ok { protocol, batVersion, runtime, holderDir?, pid }`，取雙方共同的最高版本；`probeServerPtyCount` / `connectToServer` / Recovery（`terminal-server:recover`）/ `sendShutdownToServer` 一律先 hello。沒有共同版本或 hello 失敗、逾時 → 回明確結果給呼叫端（W5 依此走 D5「結束並說明」；本單先照 Recovery「重新開始」的既有路徑處理）。
2. 對方不回 hello（舊 server）→ 在有限時間內判定為 protocol 0、照舊運作；寫明逾時值與理由。
3. TCP 權杖（D8）：產生、存放、讀取與輪替規則由你設計並寫進 docs；未認證的第一個請求回 `error` 並關閉 socket。
4. server 對不認得的請求改回 `error`（今天是不回應）。
5. 延長 idle timeout 的請求（給 W4 在安裝程式觸發 quit 時使用，D7：24 h）：只延長一次、有上限、client 重新連上後恢復設定值；本單只提供協定與 server 行為，不接到 quit 流程。
6. TCP 模式的存活判斷（T0856 Q3「heartbeat 在 TCP 模式的缺口」）。
7. `installer-quit-request.ts` 的 server-only shutdown（`runInstallerQuitWithoutApp`）帶權杖；T0823 行為不變。
8. 測試：協商（共同版本 / 無共同版本 / 舊 server 不回 hello）、未認證關閉、不認得的請求回 error、TCP 模式 3 個遲到 tick 但程序仍在 → 不 recovery、延長 idle 的上限與恢復、權杖不出現在 env / 日誌（source guard 或斷言）。
9. 文件：`docs/agent-guide/terminal-server-recovery.md` 補協定 v1 一節；`CLAUDE.md`「Terminal Server 存活判定與 recovery」節加一兩行必守規則（照 CLAUDE.md 撰寫規則，細節放 docs）。

### 驗收條件
- [ ] 上述測試通過；既有 Terminal Server / recovery / Recovery create hold / installer-quit 測試不回歸
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [ ] 回報區列出：協定訊息表、權杖檔的位置與權限、逾時值，以及「新主行程 × 舊 server」「舊主行程 × 新 server」兩種組合的預期行為
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
