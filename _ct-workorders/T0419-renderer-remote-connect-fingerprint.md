---
schema_version: 1
schema_kind: workorder
id: T0419
title: "BUG-096：App.tsx initProfile 的 remote.connect 帶 fingerprint，或 main 重用已 pin 驗證的 client，不再以未驗證連線取代"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-096
priority: P1
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: "2026-10-05T05:39:24+08:00"
updated_at: "2026-10-05T05:44:08+08:00"
completed_at: "2026-10-05T05:44:08+08:00"
target_version: next
depends_on: []
related:
  - "BUG-096；T0385 / T0386；CLAUDE.md「Remote 資安」節（TOFU fingerprint pinning）"
  - "D134（本 session 排程表第 3 列）"
affects_files:
  - src/App.tsx
  - electron/main.ts
  - src/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認現況**：以程式碼證據回答 (a) `loadProfileSnapshotDetailed` 建立的 client 與 renderer `remote:connect` 建立的 client 是否同一個 `remoteClient` 槽位、後者是否真的取代前者；(b) 無 fingerprint 的 legacy profile 在 main 端目前怎麼處理；(c) 首次 TOFU（profile 尚無 `remoteFingerprint`）的流程走哪條路。若結論是取代不會發生，回報區附證據、只補防回歸測試即可 DONE。"
  - "🔴 修法偏好：**main 端重用已驗證且仍連線中的同目標 client**（host / port / token 一致即不重建），renderer 端同時傳 profile 的 `remoteFingerprint` 作為第二道防線。不得破壞首次 TOFU 寫入 fingerprint 的流程；與 main 現行 legacy 拒絕規則保持一致，不要另訂新規則。"
  - "🔴 同工作樹有其他 Worker 平行（T0417 / T0418 / 研究單）。`electron/main.ts` 只改 `remote:connect` 相關區段。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0419 — renderer 遠端重連不帶 fingerprint（BUG-096）

## 背景

- `src/App.tsx` initProfile 呼叫 `window.electronAPI.remote.connect(host, port, token)`，未傳 profile 的 `remoteFingerprint`
- `electron/main.ts` `remote:connect` handler 支援第 5 參數 `fingerprint`（目前約 `:2505`）
- `loadProfileSnapshotDetailed`（`electron/main.ts`）已用 pin 過的 fingerprint 建立 client；renderer 再 connect 可能以未 pin 驗證的新 client 取代

## 範圍

1. 現況確認（memory_overrides 第 1 條）
2. 依偏好修法實作
3. 測試：同目標重連不重建 client；renderer 傳入 fingerprint；fingerprint 不符時拒絕；首次 TOFU 不受影響
4. 回報區附使用者實機步驟（開遠端 profile 視窗 → 關閉重開 → 連線正常、log 無重建 client）

## 驗收條件

- [ ] 回報區附現況結論（程式碼證據）
- [ ] `npm run test:unit` 全綠（基線 1867）；`npx tsc --noEmit` ≤ 40
- [ ] 回報區附實機步驟

## Sub-session 執行指示
1. 讀本工單 + BUG-096 + CLAUDE.md「Remote 資安」節
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 現況確認 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**；BUG-096 改 `FIXED` 並填 `links.fix_workorder: T0419`
5. `git commit --only` 實際改動檔 + 本工單 + BUG-096；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ **DONE** — main 端重用已 pin 驗證的同目標 client（主修），renderer 端同時傳 `remoteFingerprint`（第二道防線）；legacy 無 fingerprint profile 在 `remote:connect` 也拒絕，與 `loadProfileSnapshotDetailed` 一致；首次 TOFU 路徑不受影響。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` ✅（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 ✅；C-3：`src/App.tsx` / `electron/main.ts` 存在 ✅；C-2：工單無 `branch` 欄位，實際 `main`
- 派發 mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

#### 1. 現況結論（程式碼證據，修改前）

**(a) 同一槽位，且確實會取代 —— BUG 成立。**
- 兩條路徑寫同一個模組變數 `remoteClient` / `remoteClientProfileId`（`electron/main.ts:462,469`）。
- `loadProfileSnapshotDetailed` 以 `profileEntry.remoteFingerprint` 連線（修改前 `main.ts:1272-1287`），成功後 `remoteClient = client`，之後才建立該 profile 的視窗（`restoreFromSnapshot` / `applySnapshot` / `profile:open-window`）。
- 視窗 renderer 啟動 → `App.tsx` initProfile（修改前 `:541-545`）呼叫 `remote.connect(host, port, token)`，**無 fingerprint**。
- `remote:connect` handler（修改前 `main.ts:2505-2521`）**無條件** `new RemoteClient` → `client.connect(..., fingerprint=undefined)` → `expectedFingerprint = ''`（`remote-client.ts:212-214`）→ upgrade 時 `if (this.expectedFingerprint && fp && fp !== expected)` 整段跳過（`remote-client.ts:340`），即 **接受任意憑證（TOFU 語意）** → 成功後 `remoteClient?.disconnect()` 並以新 client 取代（`main.ts:2518-2520`）。⇒ 每開一個遠端 profile 視窗，已 pin 驗證的連線都被一條未 pin 驗證的連線取代。
- `App.tsx` 是 `remote:connect` 的**唯一**呼叫端（`grep "remote.connect(" src electron`）。

**(b) legacy profile（無 `remoteFingerprint`）**：`loadProfileSnapshotDetailed` 拒絕（`main.ts:1255-1265`，回 `reason: 'trust'`）；但 `remote:connect` **沒有**同樣檢查。若有視窗綁在 legacy remote profile 上（例：`--profile=` 啟動且 remote unreachable、`pickFallbackProfileId` 無可用 fallback 時，`main.ts:1480-1482` 仍以 `launchProfileId` 建空視窗），renderer 的 `remote.connect` 會以 TOFU 連上 —— legacy 拒絕規則在 renderer 路徑被繞過。

**(c) 首次 TOFU 不走 `remote:connect`**：
- ProfilePanel「Fetch profiles」→ `fetchRemoteProfileList`（`remote:list-profiles`，`main.ts` createClient）→ 觀察值填入欄位、`profile:create` 寫入（`ProfilePanel.tsx:201-241`）。
- 「Pin expected fingerprint」→ `remote:test-connection`（`ProfilePanel.tsx:320-336`）→ `profile:update`。
- Setup wizard 由 `write-profile.ts` 直接寫入 fingerprint。
⇒ 在 `remote:connect` 強制 pin 不影響任何首次 TOFU 寫入流程。

#### 2. 修法

- **新增 `electron/remote/remote-connect-plan.ts`**（純模組，無 electron import，比照 `remote-profile-error.ts`）：`planRemoteConnect({ request, boundProfileId, boundProfile, current })` → `reject` / `reuse` / `connect`。
  - 視窗綁定 **remote profile** 且請求目標 = profile 目標（host / port（預設 9876）/ token）：
    - profile 無 `remoteFingerprint` → `reject`（`fingerprint-missing`，錯誤文字同 `loadProfileSnapshotDetailed` 的 `Profile has no pinned server fingerprint (legacy setup)`）；renderer 自帶 fingerprint 也不能替代缺少的 pin。
    - renderer 傳的 fingerprint 與 pin 不符 → `reject`（`fingerprint-mismatch`）。
    - 現有 client 連線中、`remoteClientProfileId` 相同、目標 host/port/token 相同、觀察到的 fingerprint = pin → **`reuse`，不重建**。
    - 其餘 → `connect`，`expectedFingerprint = pin`（**絕不再以空 fingerprint 連線**）。
  - remote-bound 視窗請求**別的目標**：需自帶 fingerprint，否則 `reject`（同一條「無 pin 不連」規則套在請求上；目前無呼叫端走此分支）。
  - 視窗**未綁 remote profile**（無 entry / local profile）：維持原行為（renderer fingerprint 透傳，無則 TOFU），不另訂新規則。
  - fingerprint 比對前一律 `normalizeFingerprint`（大小寫 / 冒號無關）。
- **`electron/remote/remote-client.ts`**：`normalizeFingerprint` 加 `export`（僅此一字，供 planner 重用，避免複製一份正規化邏輯）。
- **`electron/main.ts`**（只動 remote client 槽位相關處）：
  - `:470-474` 新增 `remoteClientTargets: WeakMap<RemoteClient, RemoteConnectTarget>`，記錄每個 client 的**請求目標**（pre-tunnel host/port、token、觀察到的 fingerprint）。不用 `connectionInfo`：SSH tunnel 會把 host/port 改寫成 `127.0.0.1:<localPort>`（`remote-client.ts:279-280`）。
  - `:1293` `loadProfileSnapshotDetailed` 成功後登記 target（一行）。
  - `:2511-2547` `remote:connect`：先 `planRemoteConnect`；`reject` 回 `{ error, errorCode }` 且**不動現有槽位**（未發生網路動作，不拆掉已驗證連線）；`reuse` 回 `{ connected: true, fingerprint }` 並寫 log `[remote:connect] reusing verified client ...`；`connect` 以 `plan.expectedFingerprint` 連線，成功後登記 target。回傳形狀不變（preload / `electron.d.ts` 簽章不需改）。
- **`src/App.tsx:538-549`** initProfile：`remote.connect(host, port, token, undefined, active.remoteFingerprint)`。

#### 3. 測試

- `electron/__tests__/remote-connect-plan.test.ts`（15 例）：同目標重用（含 renderer 帶不同格式的同值 fingerprint）；未連線 / 他 profile / 他 token / 他 port / 觀察到不同 fingerprint / 無 target 記錄 → 以 pin 重連；預設 port 9876；renderer fingerprint 與 pin 不符 → reject；legacy 無 pin → reject（renderer 自帶也拒）；別的目標需自帶 fingerprint；未綁 remote profile 維持 TOFU 透傳、不重用。
- `src/__tests__/app-remote-connect-fingerprint.test.ts`（2 例）：App 無 render harness，以 source guard 確認所有 `window.electronAPI.remote.connect(` 呼叫帶 5 個參數且第 5 個為 `*.remoteFingerprint`。
- 首次 TOFU 不受影響：靠 (c) 的程式碼證據（TOFU 路徑不呼叫 `remote:connect`）+ 「未綁 remote profile 維持 TOFU」測試。

#### 4. 驗收

| Gate | 結果 | 證據 |
|------|------|------|
| `npm run test:unit` | ✅ PASS | `Test Files 115 passed (115)` / `Tests 1889 passed \| 1 skipped (1890)`（基線 1867；本單 +17，其餘差額來自平行 Worker 的未提交測試）。輸出含一段既有 Node stack trace 雜訊，不影響結果 |
| `npx tsc --noEmit` | ✅ PASS | `40` 個 `error TS`（≤ 40）；`grep` 本單改動檔（`remote-connect-plan` / `App.tsx` / `main.ts` / `remote-client` / 新測試）0 筆 |
| `npx vite build` / `npm run test:e2e` | ⏭ 未跑 | 依 memory_overrides（L141）刻意不跑 |
| runtime smoke | ⏭ 未跑 | 需使用者實機（見下） |

#### 5. 使用者實機驗證步驟

前置：有一個已 pin fingerprint 的 remote profile（例：WSL profile，Profile 面板可見 fingerprint 欄位有值）。

1. 啟動 BAT，從 Profile 面板開啟該 remote profile 視窗 → 終端 / Agent 正常可用。
2. 開本次啟動的 log（`<userData>/Logs/` 下最新一份，`electron/logger.ts` `ensureLogFilePath`；Windows 為 `%APPDATA%\BetterAgentTerminal\Logs\`），確認出現 `[remote:connect] reusing verified client for profile <id> (<host>:<port>)`，**且同一時間點沒有第二次** `[RemoteClient] Connected to ...`（以前每開一個視窗會多一次連線）。
3. 關閉該視窗，再從 Profile 面板重開 → 連線正常；log 同樣是 `reusing verified client`（或因前次連線已斷而以 pin 重連，此時應只見一次 `Connected to ...`，不得有 fingerprint 相關錯誤）。
4. （選測，負向）把該 profile 的 fingerprint 欄位改成錯值後重開 → 應被拒（對話框 trust 類錯誤），不得連上。
5. （選測，legacy）清空 fingerprint 欄位後重開 → 應被拒（`legacy setup` 訊息），與修改前 `loadProfileSnapshotDetailed` 行為一致；「Fetch profiles」/「Pin expected fingerprint」仍可重新 TOFU 寫回 fingerprint。

#### 6. 改動檔案

- `electron/remote/remote-connect-plan.ts`（新）
- `electron/remote/remote-client.ts`（`normalizeFingerprint` export）
- `electron/main.ts`
- `src/App.tsx`
- `electron/__tests__/remote-connect-plan.test.ts`（新）
- `src/__tests__/app-remote-connect-fingerprint.test.ts`（新）
- `_ct-workorders/T0419-renderer-remote-connect-fingerprint.md`、`_ct-workorders/BUG-096-app-remote-connect-without-fingerprint.md`

#### 7. Commit

本單改動與 BUG-096 以單一 commit 提交（`git commit --only` 僅列上方檔案，訊息含 `T0419`），不 push；commit hash 以 `git log --grep T0419` 查詢。

### 遭遇問題

- **範圍偏離（小）**：`affects_files` 未列 `electron/remote/`。為讓決策邏輯可單測（`main.ts` import electron，無法直接測），新增純模組 `electron/remote/remote-connect-plan.ts`，並將 `remote-client.ts` 既有的 `normalizeFingerprint` 加上 `export`（行為不變）。兩檔皆無其他 Worker 的未提交改動。
- `main.ts` 除 `remote:connect` handler 外，另動了兩處緊鄰槽位的程式：模組層 `remoteClientTargets` 宣告、`loadProfileSnapshotDetailed` 成功分支一行 `remoteClientTargets.set(...)` —— 重用判斷必須知道既有 client 的連線目標，屬「remote:connect 相關區段」的最小必要延伸。
- **未修、記錄供塔台參考**：`remote:connect` 實際連線失敗分支（既有程式）只把 `remoteClient = null`、**沒有 `disconnect()` 舊 client**，舊 client 可能仍在背景連線 / 自動重連而失去參照。本單改為重用後，正常路徑不再走到此分支，但「以 pin 重連失敗」時仍會發生。非 BUG-096 範圍，未動。
- 工作樹有平行 Worker（T0417 / T0418 / 研究單）的未提交改動（`electron/preload.ts`、`src/types/electron.d.ts`、`electron/handlers/git.ts` 等），本單未觸碰，commit 以 `--only` 隔離。

### 回報時間

2026-10-05T05:42:49+08:00（Worker 時間戳取自 `date`）
