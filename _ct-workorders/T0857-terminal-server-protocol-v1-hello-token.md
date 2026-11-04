---
schema_version: 1
schema_kind: workorder
id: T0857
title: "PLAN-065 W1：Terminal Server 協定 v1（hello / 版本協商、TCP 權杖、不認得的請求回 error、TCP 模式存活判斷、延長 idle 的請求）"
type: implementation
status: DONE
started_at: "2026-11-04T18:31:29+0800"
updated_at: "2026-11-04T18:53:53+0800"
completed_at: "2026-11-04T18:53:53+0800"
session_ids:
  - "5aaaf333-fa7f-4bee-aa5c-4090a2e21383"
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
- **工單編號**：T0857｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 18:28 (UTC+8)
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

### 完成狀態
- **狀態**：DONE
- **完成時間**：2026-11-04 18:52 (UTC+8)
- **session_id**：5aaaf333-fa7f-4bee-aa5c-4090a2e21383
- **產品 commit**：`db562330`（`feat(terminal-server): protocol v1 - hello, TCP token, error on unknown requests (T0857, PLAN-065 W1)`），11 個檔，全部在 `affects_files` 內
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 皆存在（資訊性）；C-2 無 `branch` 欄位。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（證據，不比對）。`BAT_REMOTE_TOKEN` 已設定。

### 互動紀錄
- [18:31] 開工；`CT_MODE=yolo`、`CT_INTERACTIVE=0`。全程沒有需要問塔台的問題（無 `### 待塔台決策`）。
- [18:35] 發現：T0856 Q3 說「TCP 模式 3 個遲到 tick 會判死」，但現行程式在 TCP 模式**根本沒有啟動 heartbeat**（`startHeartbeat` 只在 `setServerProcess` 呼叫），今天不會誤判、只靠 TCP close。範圍內自行決定：TCP 接回後也啟動 heartbeat，並補上 pid 檔＋`kill(pid, 0)` 的存活判斷，讓任務 6 與「TCP 模式 3 個遲到 tick 但程序仍在 → 不 recovery」有實際意義；規則與 IPC 模式相同。
- [18:41] 既有 `terminal-server-pty-env.test.ts` 的 env 清單斷言因新增 `BAT_TERMINAL_SERVER_BAT_VERSION` 失敗 → 更新斷言（T0705：server 專用 env 要加進清單）。
- [18:48] 全套 unit 第一次跑：`app-paths-bootstrap-order.test.ts` 失敗（`pid-manager.ts` 在 app-paths-bootstrap 的 import 鏈上，只能用 fs / path）。把 `generateServerToken` / `tokensMatch`（需要 crypto）移到 `server.ts`，`pid-manager.ts` 只留權杖檔讀寫刪；沒有放寬該 guard。
- 平行的 T0858 Worker 在 18:48:35 commit `aa59902e`（打包，與本單檔案無交集）；本單驗證（18:48:54 起）已包含它。

### 實作摘要

#### 協定訊息表（v1，只做相加）
| 方向 | 訊息 | 說明 |
|---|---|---|
| 主 → server | `server:hello { protocolMin, protocolMax, token }` | TCP 連線第一個請求必須是它；fork IPC 可選、不需權杖 |
| server → 主 | `server:hello-ok { protocol, batVersion, runtime: { name: 'electron'\|'node', version }, holderDir?, pid }` | `protocol` = 雙方共同最高版本；`batVersion` 來自 fork env `BAT_TERMINAL_SERVER_BAT_VERSION`（已加進 `TERMINAL_SERVER_OWN_ENV_KEYS`，PTY 看不到）；`holderDir` 留給 W3，目前不送 |
| server → 主 | `error { requestType, code: 'UNAUTHENTICATED' }` | 未認證的第一個請求（含權杖錯、格式錯 JSON）→ 回完即關閉 socket，同一次寫入後面的行不執行 |
| server → 主 | `error { requestType: 'server:hello', code: 'NO_COMMON_PROTOCOL', protocolMin, protocolMax }` | 權杖對、沒有共同版本；socket 保留但只接受 `server:shutdown` / `server:ping`，其他 → `NOT_ALLOWED` ＋關閉 |
| server → 主 | `error { requestType, code: 'UNKNOWN_REQUEST' \| 'BAD_REQUEST' }` | 不認得的請求（T0857 前不回應）/ 非 JSON 物件或欄位錯；連線保留 |
| 主 → server | `server:extendIdle { durationMs }` | D7；回 `server:idle-extended { idleTimeoutMs, configuredIdleTimeoutMs }` 或 `error ALREADY_EXTENDED` / `BAD_REQUEST`；本單沒有呼叫端（W4 接） |
| 既有 9 種請求 / 8 種回應 | 不變 | `error` 只多了可選的 `code`、`protocolMin` / `protocolMax` |

- 協定版本：protocol 0 = T0857 前（無 hello）；本版 server / client 都是 `1..1`（`TERMINAL_SERVER_PROTOCOL_MIN` / `MAX`）。
- 🔴 `server:hello` 與 `server:shutdown` 定為每版都有效：沒有共同版本時仍能帶權杖結束 server（D5 之後靠它）。
- 未認證的連線收不到廣播（`pty:data` / `pty:exit`），也不重設 idle 倒數（T0857 前任何連上 port 的程序都收得到所有分頁輸出）。

#### 權杖檔
- 位置：`<userData>/bat-pty-server.token`（Windows：`<使用者資料夾>\AppData\Roaming\BetterAgentTerminal[-runtime-<N>]\bat-pty-server.token`）。
- 產生：server 每次啟動 `crypto.randomBytes(32)` → base64url，**在 TCP listen 之前**寫檔（讀得到 port 檔就讀得到權杖）。
- 權限：POSIX 先以 `0600` 寫暫存檔再 rename（不會有一瞬間被其他人讀到）；Windows 靠 `%APPDATA%` 使用者資料夾 ACL（與 `server-token.json` 相同）。
- 輪替：權杖壽命 = server 壽命。server shutdown / SIGTERM 刪檔；主行程在孤兒清理、stale 清理、re-fork、Recovery「重新開始」與「保留失敗」時與 pid / port 檔一起刪；下一個 server 覆寫。
- 比對：`crypto.timingSafeEqual`。
- 不寫日誌（server stderr、主行程 logger）、不進 env（fork env、`buildServerPtyEnv`、`buildPtyEnv`）、不進命令列。runtime smoke 實測 PTY 內 `set` 的輸出沒有權杖。

#### 逾時值
| 值 | 用途與理由 |
|---|---|
| `HELLO_TIMEOUT_MS` = 3 s（client） | client 一次寫入送 `hello` + `ping`：v1 server 先回 hello-ok；舊 server 不認得 hello、只回 pong → **在 pong 時就判定 protocol 0，不必等逾時**。3 s 只涵蓋完全不回應的 server，等於 T0857 前 probe 與重連各自的逾時，不讓啟動變慢 |
| `SERVER_HELLO_TIMEOUT_MS` = 10 s（server） | 10 s 內沒完成 hello 的 TCP 連線關閉（client 第一次寫入就送 hello，只擋掉不會送的連線） |
| `UNAUTHENTICATED_MAX_BUFFER` = 64 KiB | 未認證連線在換行前最多能送的量 |
| `MAX_IDLE_EXTENSION_MS` = 24 h | `extendIdle` 上限（D7）；下限 = 設定值；設定 0 維持 0 |
| 結束不能用的 server：5 s | 沿用 `FRESH_START_SERVER_EXIT_TIMEOUT_MS`（T0578） |

#### 呼叫端與失敗處理
- `probeServerPtyCount(port, token)` / `PtyManager.connectToServer(port, token)` 改回明確結果 `{ ok: true, protocol, … } | { ok: false, reason: 'unauthenticated' | 'incompatible' | 'timeout' | 'closed' }`（W5 依此走 D5）。
- `unauthenticated` / `incompatible` / `timeout` → 本單照 Recovery「重新開始」既有路徑：`sendShutdownToServer`（帶權杖）→ `waitForTerminalServerExit`（5 s）→ 刪 pid / port / token 檔 → fork 新 server（`startTerminalServer` 與 `terminal-server:recover` 都是；recover 仍在新 server 起來後 `releaseCreates('recovery failed…')`，T0578 不變）。`closed` → 照舊。
- `sendShutdownToServer(port, token)`：一次寫入 `hello` + `shutdown`，舊 server 忽略 hello 照舊 shutdown；quit Step B、Recovery「重新開始」、`runInstallerQuitWithoutApp`（main.ts 的 `sendShutdown` dep）都帶權杖，T0823 的流程與日誌不變。
- TCP 模式存活判斷：`connectToServer` 成功後啟動 heartbeat；`serverLiveness` 在 TCP 模式以 pid 檔（每次檢查時讀，沒有時用 hello-ok 的 pid）＋`process.kill(pid, 0)` 判斷程序、以 socket 判斷通道；判死規則與 recovery 步驟（T0704）不變，IPC 模式的日誌字串不變。

#### 兩種版本組合的預期行為
| 組合 | 預期 |
|---|---|
| **新主行程 × 舊 server**（T0857 前；macOS / Linux 升級後保留的 server、開發模式） | hello 被忽略、ping 回 pong → protocol 0，照今天的訊息集合運作（舊 server 不看權杖）。probe、Recovery 提示、保留 / 重新開始、quit 停 server 與 T0857 前相同；hello 期間舊 server 先廣播的 `pty:data` 依序交給分頁、不丟。TCP 接回後多了 heartbeat（舊 server 回 pong） |
| **舊主行程 × 新 server**（降版） | 舊主行程第一個請求 `pty:list` → `error` UNAUTHENTICATED ＋關閉 → probe 得 0 → 靜默重連（TCP connect 成功）→ `pty:list` 再被拒、TCP close → T0704 立即 recovery（結束新 server 與它的 PTY、自己 fork）。與 D8 預期相同：終端會被結束，不會「以為連上了卻建不出 shell」（🔸 單元測試涵蓋 server 端行為；實機降版在 W6 實測） |

### 驗證結果
| 關卡 | 結果 | 證據 |
|---|---|---|
| `npm run typecheck` | PASS（0） | exit 0 |
| `npm run typecheck:electron` | PASS（0） | 第一次 3 個錯（新測試的 `vi.fn()` 型別），修正後 0 |
| `npm run test:unit` | PASS | 444 files passed / 3 skipped；8105 tests passed / 40 skipped |
| `npm run test:legacy` | PASS | files 33 passed, 0 failed；tests 472 passed, 0 failed |
| `npx vite build` | PASS | exit 0，`dist-electron/terminal-server.js` 13.96 kB |
| 新測試 `electron/__tests__/terminal-server-protocol-v1.test.ts` | PASS（37 項） | 協商（共同 / 無共同 / 格式錯）、舊 server 不回 hello → protocol 0（逾時前判定）、不回應 → timeout、未認證關閉（含舊主行程的 `pty:list`、權杖錯、格式錯、10 s 未 hello）、未認證收不到廣播、無共同版本只接受 ping / shutdown、不認得的請求（TCP / IPC）回 error、權杖檔（內容、POSIX 0600、無暫存殘留）、extendIdle（24 h 上限、不低於設定值、只一次、BAD_REQUEST、設定 0、倒數用延長值、hello 後恢復、被拒的連線不恢復）、PtyManager TCP 模式（hello 帶權杖、日誌無權杖、被拒無通道、**3 個遲到 tick 且 pid 檔程序在 → 不 recovery**、程序不在 → `reason=heartbeat`、無 pid 檔用 hello pid、pong 歸零、TCP close 照舊立即 recovery）、權杖不在 env / PTY env / stderr ＋ source guard |
| 既有不回歸 | PASS | `pty-manager-heartbeat-recovery`、`recovery-create-hold`、`recovery-dispatch-hold`、`installer-quit-request`、`upgrade-interruption`、`helper-capability-persist`、`local-helper-capability`、`child-process-fd-guard`、`terminal-server-kill-tree` / `-stale-exit` / `-pty-env`、`app-paths-bootstrap-order`（皆在全套 unit 內） |
| runtime smoke（Windows，隔離暫存 userData，`node` 執行建置後的 `dist-electron/terminal-server.js`） | PASS（12 項） | port / token 檔寫入；未認證 `pty:list` → error ＋關閉；hello-ok（protocol 1、batVersion、pid）；pong；真的 `cmd.exe` PTY 建立與輸出；PTY 的 `set` 沒有權杖與 `BAT_TERMINAL_SERVER_BAT_VERSION`；未知請求 → error；extendIdle 48 h → 24 h；stderr 無權杖；帶權杖 shutdown 結束 server、token / port 檔刪除。腳本在 scratchpad，未進 repo；沒有碰本機 BAT 安裝版與它的 Terminal Server |

- 證據分道：source / docs ✅、build / tests ✅、runtime smoke（server bundle ＋真 PTY）✅；**沒有**跑 BAT 實機「保留 Terminal Server → 重開 → Recovery 保留 → 接回」（需要完整 Electron 隔離實例），macOS / Linux 也沒有實機跑（T0856 W1 驗收欄的 `linux-acceptance` / `macos-acceptance` 手動跑一次，建議塔台安排）。

### 遭遇問題
- 這個環境的 bash heredoc 會把 `'\\n'` 轉成實際換行，`protocol.ts` 有兩處字串被寫壞，typecheck 前已以 Edit 修正（之後改用 scratchpad 腳本檔編輯）。
- 無其他阻礙。

### 偏離與決策（範圍內，自行決定）
1. TCP 模式啟動 heartbeat（見互動紀錄 18:35）：T0856 的前提「TCP 模式會誤判」與現行程式不符；改為「啟動 heartbeat ＋正確的存活判斷」，規則與 IPC 相同。
2. hello 逾時：client 同時送 ping，舊 server 以 pong 判定，不用固定等待；`timeout` 只用於完全不回應。
3. `NO_COMMON_PROTOCOL` 時 socket 保留、只接受 shutdown / ping：讓「結束並說明」（D5）能正常 shutdown（T0540 程序樹）而不是強制殺。
4. 權杖由 server 產生並寫檔（不由主行程經 env 傳入）：滿足「不進 env、不進命令列」。
5. `generateServerToken` / `tokensMatch` 放 `server.ts`：`pid-manager.ts` 受 app-paths-bootstrap import 鏈 guard 限制。

### 後續建議（給塔台）
- W5（T0861）：`probeServerPtyCount` / `connectToServer` 的 `reason` 已可直接分流 D5；`hello-ok.batVersion` 可做「0 個 PTY 且版本不同 → 換新」。
- W4（T0860）：`server:extendIdle { durationMs: 24h }` 已可用；在 quit 前、主行程仍連著 server 時送（IPC 或 TCP 皆可）。
- W3（T0859）：`hello-ok.holderDir` 與 `runtime.name: 'node'` 已在型別裡，server 端從 `identity` 帶入即可。
- 實機：`linux-acceptance` / `macos-acceptance` 跑一次「保留 server → 重開 → 保留 → 接回」；W6 涵蓋降版（舊主行程 × 新 server）。

### 回報時間
- 2026-11-04 18:52 (UTC+8)
