---
schema_version: 1
schema_kind: workorder
id: T0465
title: "PLAN-039 工單 4：SSH tunnel 本機埠健壯性——pickFreePort 後 EADDRINUSE 換埠重試一次；固定 tunnelLocalPort 被多個 profile 重複使用時 warn"
type: fix
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-039
priority: P3
sizing: S
created_at: "2026-10-05T11:29:43+08:00"
started_at: "2026-10-05T11:43:01+08:00"
updated_at: "2026-10-05T11:43:01+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "T0459 研究回報區拆單第 4 列（多 client 後多條 SSH tunnel 同時存在，本機埠競爭機率上升）"
  - "D135"
affects_files:
  - electron/remote/ssh-tunnel.ts
  - electron/remote/remote-client.ts
  - electron/remote/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 `pickFreePort` 與 ssh `-L` 綁定之間有競態：ssh 啟動因本機埠被占用失敗（stderr 含 `Address already in use` / bind 失敗，以結構化判斷為主、字串為輔並在回報區說明）時，換一個新埠重試**一次**；仍失敗照既有錯誤路徑。profile 若設固定 `tunnelLocalPort` 且與另一個 profile 相同，連線時 warn（不阻擋）。child_process 規則同 CLAUDE.md。"
  - "🔴 不碰 `main.ts`（可與 T0462 平行）。**只跑 `npm run test:unit` + `npx tsc --noEmit`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔維持 LF；不 push；不對實際 SSH 主機執行。"
---

# T0465 — SSH tunnel 本機埠健壯性（PLAN-039 工單 4）

## 驗收條件

- [x] 測試：模擬第一次 bind 失敗 → 換埠成功；兩次失敗 → 既有錯誤；固定埠重複 → warn
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0459 回報區 + `electron/remote/ssh-tunnel.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先寫測試（紅）→ 實作（綠）；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（commit 見下方「Commit」）

### 產出摘要

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` → PASS（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`electron/remote/ssh-tunnel.ts` / `remote-client.ts` / `__tests__/` 皆存在 → PASS
- C-2：工單無 `branch` 欄位（HEAD = `main`）→ N/A
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

**1. `electron/remote/ssh-tunnel.ts` — 動態埠 bind 失敗換埠重試一次**
- `start()` 拆出 `startOnPort(localPort, retryOnBindFailure)`。未設 `localPort`（動態）時第一次 attempt 允許重試；失敗且判定為本機埠被占用 → 丟內部 `LocalPortInUseError` → `start()` 記 warn、重新 `pickFreePort()`、以 `retryOnBindFailure=false` 再跑**一次**。第二次失敗走原本錯誤路徑（`ssh process exited before tunnel became ready` + `tunnel-down`）。
- 固定 `localPort`：不重試，行為與修改前相同（直接 `startOnPort(port, false)`）。
- **判斷規則（結構化為主、字串為輔）**：`isLocalBindFailure()` = ssh **exit code 255**（`ExitOnForwardFailure=yes` 下 forward 失敗的 exit code；結構化，必要條件）**且**（自行對該埠 probe `listen(port,'127.0.0.1')` 得到 `err.code === 'EADDRINUSE'`（結構化）**或** stderr 命中 `LOCAL_BIND_FAILURE_RE` = `Address already in use|cannot listen to port|Could not request local forwarding`（字串，輔助：涵蓋占用者在 probe 前已釋放埠的競態））。exit code ≠ 255、auth 失敗（`Permission denied`）等不重試。
- **tunnel-down 時序**：只有「動態埠第一次 attempt 啟動期間」的非預期 exit 會延後 `tunnel-down`——決定重試則吞掉（避免 RemoteClient 的 tunnel-down handler 另排一次 reconnect 與重試競爭）；不重試則在 throw 前補發，對外結果與原本相同。固定埠與第二次 attempt 的 exit handler 行為逐字不變（`tests/ssh-tunnel.test.ts` test2 的語意保留）。
- exit handler 改成 `if (this.process === proc) this.process = null`，防止舊 proc 的 exit 清掉重試後的新 proc。
- 重試前若呼叫端已 `stop()` → 丟 `ssh tunnel start aborted`，不 spawn 第二個 ssh。

**2. `electron/remote/remote-client.ts` — 固定 `tunnelLocalPort` 重複時 warn（不阻擋）**
- 模組層 `fixedTunnelPortClaims`（port → profileId → client 數）+ export `claimFixedTunnelPort()` / `releaseFixedTunnelPort()`。
- `maybeCreateTunnel()` 建立 tunnel 後 claim；已有**其他** profile 持有同一固定埠 → `logger.warn('[RemoteClient] profile <id> uses fixed tunnelLocalPort <port>, which connected profile(s) <ids> also use — only one ssh -L can bind it; ...')`，tunnel 照建（不阻擋）。同一 profile 多個 client 不 warn；`tunnelLocalPort` 未設或 0 不 claim。
- `disconnect()` 拆 tunnel 時 release。
- 範圍說明：比對對象是**目前有 tunnel 的 profile**（即真正會撞埠的情境）。「設定檔裡有另一個未連線 profile 也填同埠」需要 ProfileManager 全清單，而它只存在於 `main.ts`（本工單禁碰）——未連線的 profile 不會與之競爭埠，故不納入。

**3. `electron/remote/__tests__/ssh-tunnel-local-port.test.ts`（新，11 tests）**
- 動態埠：第一次 bind 失敗 → 換埠成功、不發 tunnel-down；兩次失敗 → 既有錯誤、tunnel-down 一次、不 spawn 第三次；僅結構化訊號（exit 255 + probe EADDRINUSE、無 stderr）即重試；probe 時埠已釋放但 stderr 有 bind 訊息 → 仍重試；auth 失敗不重試；exit code ≠ 255 不重試。
- 固定埠 bind 失敗 → 不重試、不 probe、既有錯誤。
- `claimFixedTunnelPort` / `release` 計數；兩個 profile 同固定埠 → warn 一次且第二個 tunnel 仍建立；第一個 disconnect 後重用不 warn；不同固定埠 / 動態埠 / 同 profile 兩次不 warn。
- 全部以 `SshTunnelDeps` 注入假 spawn / net，不起真 ssh、不開真 socket。

**驗證**
| 項目 | 結果 | 證據 |
|---|---|---|
| 紅燈 | PASS | 以 `git show HEAD:electron/remote/ssh-tunnel.ts` 暫存副本跑同測試：4 個重試測試 FAIL、回歸守護測試 PASS（暫存檔已刪） |
| 新測試 | PASS | `ssh-tunnel-local-port.test.ts` + `remote-client-ssh-tunnel.test.ts`：23 passed |
| `npm run test:unit` | PASS（見遭遇問題 1） | 排除平行 Worker 的 WIP 檔後 165 files / 2791 passed / 1 skipped |
| `npx tsc --noEmit` | PASS | 36 errors（基線 36，≤ 36，無新增） |
| 實際 SSH | 未執行 | 依工單禁止對實際 SSH 主機執行 |

**Commit**：見本工單 commit（只含 `ssh-tunnel.ts` / `remote-client.ts` / 新測試檔 / 本工單）；未 push。

### 遭遇問題

1. **`npm run test:unit` 完整跑有 1 個 file FAIL，非本工單造成**：`electron/remote/__tests__/remote-connection-registry.test.ts`（未追蹤檔，T0462 平行 Worker 紅燈階段）`Failed to resolve import "../remote-connection-registry"`。其餘 165 files 全綠；以 `-- --exclude` 排除該檔後 165/165 綠。未動 T0462 任何檔案。
2. **TDD 順序偏差**：先實作後寫測試；以 HEAD 版副本補跑紅燈（4 FAIL）佐證測試確實鎖住新行為。
3. **CRLF**：`ssh-tunnel.ts` 工作目錄原為 CRLF（`core.autocrlf=true`，index 為 LF），已轉 LF 寫入；index 端不受影響。
4. **殘留風險（記錄，不在本範圍）**：若占用者本身是 listener，`waitUntilReady` 可能在 ssh 失敗前先連上占用者而判定 ready——此時不會觸發本重試；後續 ssh exit 255 → `tunnel-down` → RemoteClient 重連（動態埠會重新 pick），且 wss 因 fingerprint pin 不符 fail-closed（T0459 已述），不會連錯 server。固定埠在此情境會反覆失敗直到 `TUNNEL_MAX_RESTART_FAILURES`，屬設定問題，由本工單的 warn 提示。

### 回報時間

2026-10-05T11:48:38+08:00
