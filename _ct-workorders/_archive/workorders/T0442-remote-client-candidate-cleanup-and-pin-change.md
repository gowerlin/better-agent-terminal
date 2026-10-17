---
schema_version: 1
schema_kind: workorder
id: T0442
title: "T0430 後續：loadProfileSnapshotDetailed 連線失敗時 disconnect 失敗的 candidate（SSH tunnel 殘留）；profile:update 變更 remoteFingerprint 時 fail-closed 拆既有 client"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-096
priority: P2
sizing: S
created_at: "2026-10-05T05:56:30+08:00"
started_at: "2026-10-05T06:09:06+08:00"
updated_at: "2026-10-05T06:12:04+08:00"
completed_at: "2026-10-05T06:12:04+08:00"
target_version: next
depends_on:
  - T0431
related:
  - "T0430 回報區「殘留風險（情境 3）」與「同類未修」；commit `a878b83`（`settleRemoteConnect`）"
  - "T0419（`038c98e`，`remote-connect-plan.ts`）"
  - "D134 追加（塔台 05:56 斷點 C 直接決定，使用者授權）"
affects_files:
  - electron/main.ts
  - electron/remote/remote-connect-plan.ts
  - electron/__tests__/remote-connect-plan.test.ts
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 (1) `loadProfileSnapshotDetailed` 連線失敗分支：沿用 T0430 的 `settleRemoteConnect`（或同等純函式）—— 失敗的新 client 必須 `disconnect()`（SSH tunnel 子行程一併清掉），槽位維持不變。"
  - "🔴 (2) `profile:update` 若變更了 `remoteFingerprint`（正規化後比對，大小寫 / 冒號無關），且目前槽位 client 綁同一 profile → disconnect 並清空槽位（fail-closed；下次 renderer `remote:connect` 會以新 pin 重連）。未變更 fingerprint 的 update 不得動槽位。回報區說明使用者可見影響（該 profile 視窗短暫斷線重連）。"
  - "🔴 依賴 T0431（同改 `electron/main.ts`）。開工前 `git log --oneline -8` 確認；`main.ts` commit 前 `git diff electron/main.ts` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0442 — remote client candidate 清理 + pin 變更 fail-closed

## 範圍

1. `loadProfileSnapshotDetailed` 失敗 candidate disconnect
2. `profile:update` fingerprint 變更 fail-closed
3. 測試：兩情境各自的正 / 負向（未變更 fingerprint 不動槽位；他 profile 的 update 不動槽位）

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] 回報區附實機步驟（SSH tunnel profile 連線失敗後無殘留 ssh 子行程；改 fingerprint 後視窗以新 pin 重連）

## Sub-session 執行指示
1. 讀本工單 + T0430 / T0419 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ **DONE** — (1) `loadProfileSnapshotDetailed` 改走 `settleRemoteConnect`：連線失敗（`ok:false` 或 throw）時 `await disconnect()` 失敗的 candidate（含 SSH tunnel 子行程），槽位不變；(2) `profile:update` 變更 `remoteFingerprint`（正規化比對）且槽位 client 綁同一 profile → disconnect 並清空槽位（fail-closed）。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` ✅（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 ✅；C-3：`affects_files` 皆存在（informational）✅；C-2：工單無 `branch` 欄位，實際 `main`
- 依賴 T0431：`git log --oneline -8` 含 `9fa2cc3 feat(headless): ... (T0431)` ✅
- 派發 mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

#### 1. `loadProfileSnapshotDetailed` 失敗 candidate disconnect（`electron/main.ts`）

- 修改前：`client.connect()` 回 `ok:false` 或 throw 時直接 return，新 client 沒 `disconnect()` ⇒ SSH tunnel profile 留下 ssh 子行程，`tunnel-down` 可觸發無人持有參照的背景重連（T0430 回報「同類未修」）。
- 修改後：task 內 `candidate` + `settleSlot(ok)`，與 T0430 `remote:connect` 同規則（沿用純函式 `settleRemoteConnect`）：
  - 失敗（`ok:false` / outer catch）：槽位原樣，`await` candidate 的 `disconnect()`（在 `remoteOpMutex` 內等 ssh 子行程退出，同 BUG-067 思路）
  - 成功：candidate 入槽、舊 client fire-and-forget `disconnect()`（與原行為相同，改用 `.catch`）
  - 成功後 snapshot invoke 失敗：client 已在槽位，維持原行為（不 dispose）
- 回傳形狀 `SnapshotLoadResult` 不變。`remote:connect` handler 未動。

#### 2. `profile:update` pin 變更 fail-closed（`electron/main.ts` + `electron/remote/remote-connect-plan.ts`）

- 新純函式：
  - `isRemoteFingerprintChange(previous, next)`：`next === undefined`（欄位未帶）→ 非變更；否則 `normalizeFingerprint` 後比對（大小寫 / 冒號無關）。清空 pin 或首次設定 pin 也算變更。
  - `shouldDropClientOnProfileUpdate({ profileId, applied, previousFingerprint, nextFingerprint, slotProfileId })`：僅在 update 實際套用、槽位綁**同一** profile、且 pin 變更時回 `true`。
- handler：`profileManager.update` 前先讀舊 `remoteFingerprint`；pin 有變更時於 `remoteOpMutex` 排一個 task，task 內以**當下**槽位再判一次 `shouldDropClientOnProfileUpdate`，成立才 `remoteClient = null; remoteClientProfileId = null` 並 `await disconnect()`，加 `logger.warn('[profile:update] remoteFingerprint changed ...')`。排進 mutex 的理由：若有以舊 pin 進行中的 connect，會先 settle 進槽位，再被本 task 拆掉，不會漏網。未變更 fingerprint（含未帶此欄位，如 `handleSetTargetOS` / wizard 只改 targetOS）的 update 不進 mutex、不動槽位；回傳值不變（`boolean`）。

**使用者可見影響**：在 ProfilePanel 編輯 remote profile 改了 fingerprint 並儲存（`handleSaveRemote`），或按「Pin expected fingerprint」得到與現存 pin 不同的值（`handlePinFingerprint`），若該 profile 的視窗正連著遠端 → 該連線立即中斷（ws 關閉、SSH tunnel 收掉、pending invoke 以 `Disconnected` reject）。renderer 不會自動重連：`remote:connect` 只在視窗 `initProfile`（`src/App.tsx:542`）呼叫，因此需**重新開啟該 profile 視窗**（或重新載入 profile），這時 `loadProfileSnapshotDetailed` / `remote:connect` 會以新 pin 連線；若伺服器實際憑證不符新 pin → `fingerprint-mismatch`，視窗依既有流程顯示失敗。斷線期間該視窗的 invoke 依既有路由（`senderProfileId === remoteClientProfileId && remoteClient?.isConnected` 不成立）落到本機 `invokeHandler`——此為 T0430 已記錄的既有行為，非本單引入（見「遭遇問題」）。

#### 3. 測試（`electron/__tests__/remote-connect-plan.test.ts`，21 → 31 例）

- `loadProfileSnapshotDetailed` source guard（2 例）：必經 `settleRemoteConnect(`、不再直接 `remoteClient = client`；`!result.ok` 分支與 `connect threw` catch 在 return 前 `await settleSlot(false)`。（`main.ts` import electron 無法直接執行，比照 T0419 / T0430 手法；情境 1 的槽位行為由既有 `settleRemoteConnect` 5 例覆蓋：失敗保留槽位並 dispose candidate、成功換手。）
- `isRemoteFingerprintChange`（3 例）：未帶欄位非變更；大小寫 / 冒號無關；不同值 / 清空 / 首次設定為變更。
- `shouldDropClientOnProfileUpdate`（4 例）：正向——同 profile pin 變更 → drop；負向——pin 未變（他種格式同值 / 未帶欄位）、**他 profile 的 update**、空槽位、update 未套用皆不動槽位。
- `profile:update` source guard（1 例）：舊 pin 在 `profileManager.update(` 之前讀取；清槽位在 `shouldDropClientOnProfileUpdate(` 之後；經 `remoteOpMutex.then(`。

#### 4. 驗收

| Gate | 結果 | 證據 |
|------|------|------|
| `npm run test:unit` | ✅ PASS | `Test Files 133 passed (133)` / `Tests 2087 passed \| 1 skipped (2088)`（含工作樹中平行 Worker 未提交的測試；輸出中 `error: No such remote 'origin'` 為既有測試的 stderr 雜訊，不影響結果） |
| `npx tsc --noEmit` | ✅ PASS | `39` 個 `error TS`（≤ 40）；`main.ts` / `remote-connect-plan` 0 筆 |
| `npx vite build` / `npm run test:e2e` | ⏭ 未跑 | 依 memory_overrides（L141）刻意不跑 |
| runtime smoke | ⏭ 未跑（需實機） | 見下方實機步驟 |

**實機步驟（待人工驗收）**

A. SSH tunnel profile 連線失敗後無殘留 ssh 子行程
1. 建一個 SSH tunnel remote profile（wizard 產出），讓遠端 bat-server 不可達但 SSH 可連（例如遠端 `systemctl --user stop bat-server` 或停掉容器內 server），或把 profile 的 `remotePort` 改成沒人監聽的埠。
2. 開工作管理員 / `Get-Process ssh` 記下 ssh 子行程數。
3. 在 BAT 開啟該 profile → 出現「remote unreachable」對話框。
4. 預期：debug.log 有 `[profile] remote connect failed for profile ...` 與 `[RemoteClient] Disconnected`（candidate 被收掉）；`Get-Process ssh` 數量回到步驟 2；等 1～2 分鐘不再出現該 profile 的 `tunnel-down` / reconnect log。

B. 改 fingerprint 後視窗以新 pin 重連
1. 開一個已配對的 remote profile 視窗，確認連線正常（狀態列 remote connected）。
2. 主視窗 ProfilePanel → 編輯該 profile，把 fingerprint 改成另一個值（或伺服器憑證已重生後按「Pin expected fingerprint」）→ 儲存。
3. 預期：debug.log 出現 `[profile:update] remoteFingerprint changed for profile <id>; disconnecting its remote client` 與 `[RemoteClient] Disconnected`；該視窗遠端連線中斷。
4. 關閉並重新開啟該 profile 視窗 → 以新 pin 連線：新 pin 正確則連上；故意填錯則得 `fingerprint-mismatch` 失敗（證明舊連線未沿用）。
5. 負向：只改 targetOS（「Set target OS」）或編輯儲存時 fingerprint 未變 → 連線不中斷、log 無上述 warn；另一個 profile 改 fingerprint → 本視窗連線不中斷。

#### 5. 改動檔案

- `electron/remote/remote-connect-plan.ts`（新增 `isRemoteFingerprintChange` / `shouldDropClientOnProfileUpdate`）
- `electron/main.ts`（import 一行 + `loadProfileSnapshotDetailed` + `profile:update`）
- `electron/__tests__/remote-connect-plan.test.ts`
- `_ct-workorders/T0442-remote-client-candidate-cleanup-and-pin-change.md`

#### 6. Commit

`electron/main.ts` 工作樹含平行 T0436 未提交 hunk（`image-attachments` import、`dialog:select-attachments`、`clipboard:read-image-data-url`，共 +17 行），故 `git commit --only electron/main.ts` 會把它一併帶入。改以 `git diff` 擷取本單 5 個 hunk、`git apply --cached` 只送進 index（`git diff --cached --stat`：`main.ts +45/−4`；T0436 的 17 行留在工作樹未動），其餘 3 檔 `git add`，確認 `git diff --cached --name-only` 恰為本單 4 檔後 `git commit`（不帶 pathspec）。訊息含 `T0442`；不 push；未使用 stash / reset / checkout / restore。hash 以 `git log --grep T0442` 查詢。

### 遭遇問題

- **既有行為（範圍外，同 T0430 記錄）**：槽位為空或屬他 profile 時，remote profile 視窗的 invoke 會落到本機 `invokeHandler`（`main.ts` `senderProfileId === remoteClientProfileId && remoteClient?.isConnected` 路由）。本單 pin 變更後清空槽位會讓該 profile 視窗進入此狀態直到重開；若塔台要求斷線期間 fail-closed（invoke 回錯而非跑本機），建議另開單處理路由。
- **renderer 無斷線通知 / 自動重連**：main 拆掉 client 後沒有事件推給 renderer（`isRemoteConnected` 只在 init / system resume 時刷新），狀態列可能仍顯示已連線直到重開或 resume。如需「改 pin 後視窗自動以新 pin 重連」，需另開單加 IPC 事件 + renderer 重連（本單依 memory_overrides 只做 fail-closed）。
- 工作樹有平行 Worker 的未提交改動（T0426 / T0433 / T0436 相關檔），本單未觸碰，commit 以 index 精準隔離。

### 回報時間

2026-10-05T06:11:17+08:00（Worker 時間戳取自 `date`）
