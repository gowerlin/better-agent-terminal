---
schema_version: 1
schema_kind: workorder
id: T0466
title: "PLAN-039 工單 5：e2e 兩個 isolated BAT 實例互為 server（P→A 自身、Q→B）：雙視窗 connected、pty:create 落在正確 server、關 P 寬限期後斷線且 Q 不受影響、第 9 個 profile 被拒；附 WSL + SSH 同開實機驗收步驟"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-039
priority: P2
sizing: M
created_at: "2026-10-05T11:29:43+08:00"
started_at: "2026-10-05T12:15:09+08:00"
updated_at: "2026-10-05T12:22:03+08:00"
completed_at: "2026-10-05T12:22:03+08:00"
target_version: next
depends_on:
  - T0464
related:
  - "T0459 研究回報區「測試策略」e2e 段與拆單第 5 列（兩實例優於兩 profile 同指一台 loopback server——後者走同 target 路徑，證明不了路由）"
  - "T0397 / T0399 e2e isolated runtime fixture"
  - "D135"
affects_files:
  - e2e/
  - docs/remote-dev-overview.md
  - CLAUDE.md
  - _ct-workorders/PLAN-039-multi-remote-profile-concurrent-clients.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只跑本單新 e2e spec**（`npx playwright test <spec>`），需 build 時只做 e2e 所需最小 `npx vite build` 並說明；不跑全套 `npm run test:e2e`（L141）。若兩實例互為 server 在 e2e fixture 下不可行，回報區說明並改用最接近的可行方案（例如一實例 + 兩個 in-process headless server），不得改用「兩 profile 指同一 loopback server」冒充。"
  - "🔴 回報區附實機步驟：WSL + SSH profile 同時開窗，兩邊終端 / Agent / `bat-notify --submit` 皆正常；關其中一個視窗 15 s 後該 profile 斷線、另一個不受影響。CLAUDE.md「遠端 Tower 通知」節的「全域只有一個 remoteClient」限制改寫。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔維持 LF；不 push；不部署 WSL。"
---

# T0466 — 多 profile e2e（PLAN-039 工單 5）

## 驗收條件

- [x] e2e spec 綠（雙視窗 connected、路由正確、寬限期斷線、上限拒絕）
- [x] 回報區附實機步驟；CLAUDE.md / docs 更新
- [x] PLAN-039 檔補完成註記

## Sub-session 執行指示
1. 讀本工單 + T0459 / T0462 / T0463 / T0464 回報區 + `e2e/` 既有 fixture
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單 + PLAN-039；不 push；依派發 mode 通知塔台

### 塔台補充（第五十六 session，派發前）

- T0464（`48cba04`）已落地：第 9 個 profile 被拒時 main 端彈**原生** `dialog`（`showRemoteProfileFailureDialog`，`reason: 'limit'`）+ renderer `remoteProfileLimit.notice`；e2e 驗上限拒絕時請以 main 端 log / `openProfileWindows` 回傳 `error: 'remote-limit'` / 不建立第 9 條連線判定，必要時 stub `dialog`，不要讓原生對話框卡住測試。
- 寬限期 15 s（`IDLE_GRACE_MS`）、首窗保護 60 s 為 registry 常數；e2e 若需縮短等待，只能用既有可注入點（不要為測試改產品常數），找不到注入點就照實等 15 s 並在回報區說明。
- T0464 已把 `getWindowsForProfile` 邏輯抽為 `collectProfileWindows()`（縮到 tray 的 hidden 視窗算 live）。
- PLAN-039 實際檔名：`PLAN-039-multi-remote-profile-concurrent-clients.md`（已加入 `affects_files`）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ **DONE** — 新 e2e spec `e2e/plan039-multi-remote.spec.ts` 以**兩個 isolated BAT 實例互為 server**（P → A 自身、Q → B）實作，4/4 綠（連跑兩輪）；CLAUDE.md / docs 更新、PLAN-039 補完成註記。實機 WSL + SSH 同開驗收步驟已附（下方 4.），需使用者執行。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` ✅（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 ✅；C-3：`e2e/`、`docs/remote-dev-overview.md`、`CLAUDE.md` 皆存在（informational）；C-2：工單無 `branch` 欄位，實際 `main`
- 派發 mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

**驗收條件**
- [x] e2e spec 綠（雙視窗 connected、路由正確、寬限期斷線、上限拒絕）
- [x] 回報區附實機步驟；CLAUDE.md / docs 更新
- [x] PLAN-039 檔補完成註記

### 產出摘要

**1. `e2e/plan039-multi-remote.spec.ts`（新）**

拓撲：沿用 `e2e/fixtures/electron-isolation.ts`（T0399）`launchIsolated` 起 A、B 兩實例（各自 userData / Terminal Server / 自由埠 RemoteServer，B 的 token + fingerprint 由 B 視窗 `tunnel.getConnection()` 取得）。A 的 `dialog.showMessageBox` 於 `beforeAll` stub（記錄 title / message / detail、回 `response: 0`），原生對話框不會卡住測試。全部經真實路徑：`profile.create` → `app.openNewInstance`（`openProfileWindows` → `loadProfileSnapshotDetailed` → registry）→ 視窗 renderer `remote.connect`（reuse）。

| 測試 | 斷言 | 實測 |
|------|------|------|
| M1 | P / Q 視窗 `remote.clientStatus()` 皆 `connected: true`，`info.port` / `fingerprint` 分別等於 A / B；A、B server 各恰 1 個 client（renderer reuse，無第二次握手）；A 本機視窗不綁 remote | ✅ |
| M2 | P 視窗 `pty.create` → A 的本機視窗 `getCwd` 非 null、B 為 null；Q 視窗反之；P 的 PTY `set /a 1200+34` → P 視窗見 `1234`，Q 的 `4321` 只到 Q 視窗、**不進 P 視窗** | ✅ `{"pOnA":"C:\\Users\\Gower","pOnB":null,"qOnA":null,"qOnB":"C:\\Users\\Gower"}` |
| M3 | 再開 6 個 filler（A / B 交替）→ server clients A=4 / B=4；第 9 個 `openNewInstance` 回 `{ alreadyOpen:false, windowIds:[], error:'remote-limit' }`；stub 對話框恰 1 次且內含 `8`；2 s 後視窗數不變、兩 server client 數不變、8 個視窗全部仍 connected；log 有 `remote connect refused for profile <id>` | ✅ 對話框：`Remote profile limit reached` / `8 remote profiles are already connected, which is the maximum…` |
| M4 | 以 main 端 `BrowserWindow.close()` 關 P 唯一視窗（走真實 `close` handler → `deactivateProfile` → `closed` → `noteRemoteWindowClosed`）；log 出現 `releasing its connection in 15s`；**10 s 時** A / B client 數不變（寬限期內）；之後 A 減 1、經過 ≥ 14 s；log 有 `released the connection of profile <P> (idle: no window left)`；B client 數不變、Q 仍 connected 且新 PTY `7007` 往返成功；M3 被拒的 profile 此時可連上（名額回收），A 回到 4 | ✅ 兩輪分別 15 224 ms / 15 242 ms 才離開 server A |

寬限 15 s / 上限 8 為 registry 常數且無注入點 → M4 照實等待（工單補充指示），整支 spec 約 21 s。

**2. M2 的拓撲限制（第一輪失敗後修正斷言，非產品缺陷）**

第一輪 M2 原本也斷言「Q 視窗收不到 P 的 PTY 輸出」而失敗：P 是 loopback 到 A 自身，P 的 PTY 就是 A 的**本機** PTY，A 本機 PtyManager 的事件走 `createWindowBroadcastEmit(getAllWindows)`（`electron/main.ts` `createElectronPtyDeps`）送到 A 的**所有**視窗、由 renderer 以 terminal id 過濾——既有設計，T0459 §3 已記錄「本機來源事件送所有視窗」。Q 視窗是經這條本機廣播收到，不是經 Q 的 client。故保留有判別力的方向（B 上的 PTY 輸出只到 Q 視窗、不進 P 視窗，證明遠端事件 per-profile），反方向改為只記錄（log：`Q window got A's local broadcast of P's PTY: true`），spec 註解說明原因。此限制源自工單指定的「P → A 自身」拓撲；若要雙向都驗，需第三個實例（P → B、Q → C），本單未擴充。

**3. 文件**
- `CLAUDE.md`：「遠端 Tower 通知」限制清單中「全域只有一個 `remoteClient`、非當前綁定 profile 收不到事件」改寫為 per-profile 連線 + 同 target 雙 Enter 已知限制；新增「## 多 remote profile 同時連線（PLAN-039）」節（路由、生命週期常數、上限 8 / `remote-limit`、同 target、T0465、驗證方式與 e2e 拓撲限制、實機步驟指引）
- `docs/remote-dev-overview.md`：新增「## Several remote profiles at once (PLAN-039)」節（行為說明、自動測試、實機驗收步驟）；Remote Tower notification 的 Limits 末條改寫
- `_ct-workorders/PLAN-039-…md`：補「實作完成註記」（各工單 commit、e2e 結果、待實機驗收；**PLAN 狀態未改**，轉 DONE 交塔台於實機驗收後決定）

**4. 實機驗收步驟（WSL + SSH，需使用者執行）**
1. 準備一個 WSL profile、一個 SSH profile，各自單獨可連線。
2. 由本機視窗 ProfilePanel 兩個都開：兩窗皆連上，皆無「未連線」提示（PLAN-039 前後開者會擠掉先開者）。
3. 兩窗各開終端執行指令；各開 Claude Agent session 送 prompt。
4. 兩窗各跑一次 Tower → Worker（agent 模式派單：`"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --skill ct-exec --workorder T#### --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID"`），Worker 以 `bat-notify.mjs --submit` 回報：toast / badge / Enter 只落在派單的那一窗。
5. 關 SSH 視窗（其唯一視窗）：debug log 先出現 `profile <id> has no window left — releasing its connection in 15s unless a window returns`，約 15 s 後出現 `released the connection of profile <id> (idle: no window left)`；期間 WSL 視窗持續連線，終端 / Agent / `bat-notify --submit` 照常。
6. 角色對調重做（關 WSL、留 SSH）。

**驗證**
| lane | 結果 | 證據 |
|------|------|------|
| e2e（本單 spec only） | ✅ PASS | `npx playwright test e2e/plan039-multi-remote.spec.ts`：4 passed（21.2 s），連跑兩輪皆綠；teardown：兩實例 Terminal Server 皆結束、runtime userData 皆刪除 |
| 型別 | ✅ | `npx tsc --noEmit --strict … e2e/plan039-multi-remote.spec.ts`（單檔，`--types node`）0 錯；repo 無 `eslint.config.*`，eslint 不適用 |
| build | — 未重跑 | `dist-electron/` 建於 12:14:28，晚於最後一次 `electron/` / `src/` 變更 commit `48cba04`（12:14:05），且 bundle 內含 `remote-limit` 等 T0464 字串 → 沿用現有產物，未跑 `npx vite build`；未跑全套 `npm run test:e2e` / `npm run test:unit`（L141，本單只動 e2e 新檔與文件） |
| 實機（WSL + SSH） | ⏳ 待使用者 | 上方 4. |

**Commit**：`6bd81f6`（本單 spec + CLAUDE.md + docs + PLAN-039 + 本工單）；未 push。

### 遭遇問題

- M2 第一輪失敗：見產出 2.（拓撲產物，已修正斷言並記錄；非產品缺陷）。
- 未使用 stash / reset / checkout / restore；寫檔維持 LF（git 的 CRLF warning 為 autocrlf 提示）；開工時工作樹 clean；未部署 WSL、未 push。

### 回報時間

2026-10-05T12:21:17+08:00（Worker 時間戳取自 `date`）
