---
schema_version: 1
schema_kind: workorder
id: T0384
title: "BUG-092 修復：BAT 對 WSL profile 持有長駐 `wsl.exe` 保活，避免發行版閒置關閉"
type: implementation
status: IN_PROGRESS
priority: P1
sizing: M
created_at: "2026-10-04T22:18:57+08:00"
updated_at: "2026-10-04T22:58:02+08:00"
started_at: "2026-10-04T22:58:02+08:00"
completed_at: null
target_version: next
depends_on: [T0383]
related:
  - "BUG-092（修復對象）"
  - "T0380 回報區 目標 3"
  - "D128"
  - "PLAN-035 Phase 1"
affects_files:
  - electron/wsl-keepalive.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/steps/wsl/write-systemd-unit.ts
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設；distro / port 等外部輸入先過既有白名單驗證（CLAUDE.md Child Process Spawning）。禁用 shell-spawning exec API。"
  - "🔴 不得改使用者 `%USERPROFILE%/.wslconfig`、不得 `wsl --shutdown` / `--install` / `--unregister`、不得刪除或重建 `Ubuntu-24.04`。本機 runtime 驗證只做唯讀查詢或暫存檔，驗完清乾淨。"
  - "🔴 Renderer 不得 import Node builtin（D090）；renderer 端 log 用 `window.electronAPI.debug.log`，main 端用 `logger`（CLAUDE.md Logging）。"
  - "⚠️ PLAN-035 Phase 1 四張單（T0381→T0382→T0383→T0384）**串行**，都會改 `electron/main.ts`；只改本單範圍，不預先做後面單的內容。不 push。"
---

# T0384 — WSL keep-alive holder

## 背景

T0380 證實：沒有 `wsl.exe` 連線時，WSL 約 15 秒（`instanceIdleTimeout` 預設）就關閉發行版，systemd user service + linger 也擋不住（WSL 2.6.1+，WSL#13416）。使用者裁決：**只需 BAT 執行時可用**。

## 決策（D128）

1. 新增 `electron/wsl-keepalive.ts`：對每個需要的 distro 持有一個 `spawn('wsl.exe', ['-d', distro, '--', 'sleep', 'infinity'], { windowsHide: true, stdio: 'ignore' })`（distro 先過既有白名單）；同一 distro 只持有一個
2. 生命週期：
   - app ready 後，若已有 WSL remote profile → 對其 distro 啟動 holder（或延到第一次連線前，Worker 擇一並寫理由；建議 app ready 啟動，避免第一次連線失敗）
   - 新增 / 刪除 WSL profile 時同步啟停
   - holder 意外結束 → backoff 重啟（上限與間隔由 Worker 決定，避免 WSL 不存在時無限重啟刷 log）
   - `before-quit` / `will-quit` 時 kill 全部 holder，不留孤兒 `wsl.exe`
3. 精靈：`write-systemd-unit` 成功後立即對該 distro 啟動 holder（經 IPC），避免第 6、7 步期間發行版被關閉
4. **不改** `.wslconfig` `instanceIdleTimeout`（全機設定，屬 Phase 2 的選用項目）
5. 本單**不做**設定開關 UI；holder 只在有 WSL profile 時啟動，沒有 WSL profile 的使用者零影響。回報區評估記憶體影響並建議 Phase 2 是否加開關
6. Windows 以外平台：no-op

## 驗收

- unit：spawn mock（啟動、同 distro 不重複、profile 刪除時停止、意外結束 backoff、quit 時全部 kill、非 Windows no-op、distro 白名單拒絕）
- `npm run test:unit` 全綠（基線 **888**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **本機 runtime**：對 `Ubuntu-24.04` 啟動 holder → 等 60 秒以上 `wsl -l -v` 仍 `Running` → 停止 holder → 約 15-20 秒後 `Stopped`；確認無殘留 `wsl.exe` holder 程序
- **runtime 驗收（交使用者）**：安裝版完成 WSL 精靈後閒置 2 分鐘仍可連線

## Sub-session 執行指示

1. 讀取本工單 + 對應 BUG + **T0380 回報區**（研究目標 3）
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

**DONE**。BAT 對每個 WSL profile 的 distro 持有一個長駐 `wsl.exe -d <distro> -- sleep infinity`（`electron/wsl-keepalive.ts`），跟 BAT 同生命週期；精靈在 `write-systemd-unit` 寫完 unit 後立即 pin holder、rollback 時釋放。實機 `Ubuntu-24.04` 持有 80 秒皆 `Running`，停止後 15 秒 `Stopped`，無殘留 `wsl.exe`。

### Landing Zone Check

- 結果：**WARN**（僅 C-0 無資料，其餘 PASS）
- C-0：frontmatter `repo` = **absent** → WARN「repo identity unavailable」；觀察到 `basename(REPO_ROOT)` = `better-agent-terminal`，`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`
- C-1：工單路徑在 `REPO_ROOT` 之下 → PASS
- C-3：可測 5 筆中 4 筆存在（`electron/main.ts` / `electron/preload.ts` / `src/types/electron.d.ts` / `write-systemd-unit.ts`），`electron/wsl-keepalive.ts` 為本單新建（祖先 `electron/` 存在）→ PASS
- C-2：工單無 `branch` 欄位 → 不適用（實際 `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發 mode：`CT_MODE=on`、`CT_INTERACTIVE=0`

### 實作

| 檔案 | 改動 |
|------|------|
| `electron/wsl-keepalive.ts`（新） | `WslKeepAlive` 類別。想要的 distro = `sync()`（profile 來源）∪ `pin()`（精靈來源），`reconcile()` 讓實際 holder 對齊；同 distro 只有一個 holder；`spawn('wsl.exe', ['-d', distro, '--', 'sleep', 'infinity'], { windowsHide: true, stdio: 'ignore' })`；distro 一律過既有 `assertValidDistro`（`/^[A-Za-z0-9._-]+$/`）；`error` / `exit` 去重後走 backoff；`stopAll()` kill 全部、取消待重啟計時器、之後拒絕新 holder；非 `win32` 全部 no-op。spawn / platform / logger / backoff 可注入供測試 |
| `electron/main.ts` | 建立單例 `wslKeepAlive`；`syncWslKeepAlive(reason)` 從 `profileManager.list()` 取 `targetOS === 'wsl-linux'` 的 `wslDistro` 交給 `sync()`；app ready（`whenReady` 尾段）呼叫一次；`profile:create` / `delete` / `update` / `duplicate` 完成後各呼叫一次；新增 IPC `wsl:keep-alive`（pin，失敗回 `{ ok: false, error }`）、`wsl:release-keep-alive`（unpin）；`cleanupAllProcesses()` 第一行 `stopAll()`（涵蓋 before-quit 與 window-all-closed 兩條路），另掛 `app.on('will-quit')` 再保險一次 |
| `electron/preload.ts`、`src/types/electron.d.ts` | `electronAPI.wsl.keepAlive(distro)` / `releaseKeepAlive(distro)` |
| `src/components/setup-wizard/steps/wsl/write-systemd-unit.ts` | `writeUnit` 成功後 `holdDistro()`（在 enable-linger / start-service 之前）；pin 失敗只寫 `ctx.logger.warn`，**不讓步驟失敗**、不進 `ctx.warnings`；`rollback` 末尾 `releaseKeepAlive`。systemd 停用的 fallback 分支不 pin（使用者手動 `wsl -d ... bat-server` 本身就是一條連線） |

**設計決定（工單要求 Worker 擇一並寫理由）**

- **啟動時機：app ready 就啟動**（不延到第一次連線）。理由：發行版冷啟動 + systemd 依 linger 拉起 bat-server 需要數秒，延到連線前會讓第一次連線大概率失敗或要另加等待邏輯；app ready 啟動時使用者點連線前服務通常已就緒。`syncWslKeepAlive` 是 `void` 非同步呼叫，不阻塞啟動。代價：有 WSL profile 的使用者每次開 BAT 都會拉起該發行版（即使本次不用）——見下方記憶體評估與 Phase 2 建議。
- **Backoff：2s → 5s → 15s → 30s → 60s，5 次後放棄**。持續跑滿 60 秒（`stableMs`）才結束的 holder 視為健康，重設計數（例如使用者手動 `wsl --shutdown` 後會被重新拉起，這符合「BAT 執行時可用」）。放棄後只記一筆 error log，直到下次 profile 變更或精靈 pin 才重試 → WSL 不存在 / distro 被 unregister 時不會無限刷 log。
- **精靈 pin 與 profile 分開兩個集合**：`write-profile` 先 `profile:create` 再 `profile:update` 寫入 `targetOS`，中間的 sync 若只看 profile 會把精靈的 holder 殺掉再重開；用獨立 pin 集合避免這個抖動。精靈完成後 profile 已存在，pin 留著也無害（同 distro 仍只有一個 holder）。

### 驗收

| 項目 | 結果 | 證據 |
|------|------|------|
| unit（spawn mock） | ✅ PASS | `electron/__tests__/wsl-keepalive.test.ts` 13 例：啟動參數 / `windowsHide` / `stdio`、同 distro 不重複（重複 profile、重複 sync、pin 疊 profile）、profile 刪除時 kill 且不觸發重啟、pin 跨 sync 保留 / unpin 停止、unpin 時 profile 仍在則保留、意外結束 backoff（100/200/400）+ 上限放棄 + 下次 sync 重試、`error` 事件（ENOENT）不重複排程、跑滿 `stableMs` 重設計數、backoff 觸發時已不需要則不重啟、`stopAll` 全 kill + 取消計時器 + 拒絕新 holder + 冪等、非 Windows no-op、白名單拒絕（`Ubuntu; rm -rf /`、空字串、`bad name`、`$(whoami)`）、spawn throw 時 backoff。`src/components/setup-wizard/__tests__/write-systemd-unit-keepalive.test.ts` 4 例：順序 `writeUnit → keepAlive → enableLinger → startService`、pin 失敗 / IPC reject 不讓步驟失敗、unit 寫入失敗或 systemd 停用不 pin、rollback 釋放 |
| `npm run test:unit` | ✅ PASS | `Test Files 63 passed (63)` / `Tests 905 passed (905)`（基線 888 → 905，+17） |
| `npx vite build` | ✅ PASS | exit 0（在最後兩次「只改測試檔型別標註」之前跑；產品程式碼此後未變） |
| `npx tsc --noEmit` | ✅ PASS | **40**（= baseline 40；過程中新測試檔曾多 1 個 mock 型別錯誤，已修正） |
| 本機 runtime | ✅ PASS | 見下 |
| runtime 驗收（安裝版，閒置 2 分鐘仍可連線） | ⏳ 交使用者 | 需打包安裝版 + 跑完 WSL 精靈 |

**本機 runtime（2026-10-04 23:03–23:05，以 esbuild 把 `electron/wsl-keepalive.ts` 打包到 scratchpad，用真 `child_process.spawn` 跑）**

```
23:03:22 before: Stopped holders=(none)
23:03:22 LOG [wsl-keepalive] holding Ubuntu-24.04 (pid=12272)
23:03:32 +10s Running … 23:04:42 +80s Running   （每 10 秒一筆，全部 Running）
23:04:42 holder procs: 12272 ws=7.9MB  wsl.exe -d Ubuntu-24.04 -- sleep infinity
                       36440 ws=12.4MB wsl.exe -d Ubuntu-24.04 -- sleep infinity
23:04:43 stopAll() called
23:04:46 +3s Running / +6s Running / +9s Running / +12s Running
23:04:58 +15s after stop: Stopped
23:04:58 stoppedAfter=15s residual holders=(none)
```

- 一個 holder 在 Windows 端是兩個行程：`C:\WINDOWS\system32\wsl.exe`（我們 spawn 的，ppid = node）→ 子行程 `C:\Program Files\WSL\wsl.exe`。另跑一次 8 秒的確認：`child.kill()` 只殺父行程，子行程 3 秒內自行結束，**無孤兒**。
- 驗完 `wsl -l -v` 回到 `Stopped`；scratchpad 暫存腳本與 bundle 已刪除。沒有改 `.wslconfig`、沒有 `--shutdown` / `--install` / `--unregister`。

### 記憶體影響評估（建議 Phase 2 加開關）

- Windows 端：每個 holder 約 **20 MB**（7.9 MB + 12.4 MB working set）。
- 真正的成本是**讓整個 WSL VM 與該發行版在 BAT 執行期間一直開著**（vmmem：Linux kernel + systemd + bat-server，加上 VM 的 page cache）；本次**未量測** vmmem，一般是數百 MB 起跳，依發行版內負載而定。holder 開著時 `vmIdleTimeout` 也不會回收 VM。
- 影響範圍：只有存在 WSL profile 的使用者；沒有 WSL profile 時 `sync([])` 不 spawn 任何東西（零影響），非 Windows 全 no-op。
- **建議 Phase 2 加開關**：per-profile「BAT 執行時保持 WSL 發行版運作」（預設開，因為關掉 profile 就幾乎連不上），或改成「第一次連線該 profile 時才啟動 holder」的 lazy 模式供在意記憶體的使用者選擇。

### 偏離 / 殘留風險

- 新增測試檔 `src/components/setup-wizard/__tests__/write-systemd-unit-keepalive.test.ts` 不在 `affects_files`（`affects_files` 只列 `electron/__tests__/`）；屬工單「新測試檔」範圍，未改既有測試檔。
- CLAUDE.md「timeout 必設」不適用於 holder（刻意長駐的行程）；以 backoff 上限 + quit 時 kill 取代。
- **BAT 被強制終止（crash / 工作管理員結束）時** `will-quit` 不會跑，父 `wsl.exe` 會留下，發行版持續運作直到使用者手動結束該行程或重開機。要根治需 Windows Job Object（`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`，Node 無內建 API），列為 Phase 2 候選。
- 已知缺口：精靈被直接關閉視窗（沒有走 rollback）時 pin 會留到 BAT 結束。
- 使用者手動 `wsl --shutdown` 時，holder 會在 backoff 後重新拉起發行版（符合「BAT 執行時可用」，但使用者可能意外）；連續快速失敗 5 次後停止重試。
- `npx tsc --noEmit -p tsconfig.node.json`（electron 端，非驗收 gate）原本就有大量 `TS2802`（未設 target 的 downlevelIteration）；新檔同類錯誤屬同一既有現象；排除 `TS2802` 後錯誤數與 HEAD 相同（149 = 149）。

### Commit

見下方 commit hash（`git commit --only`，只含本單改動檔 + 新測試檔 + 本工單檔；BUG-092 檔未動，由塔台更新）。不 push。
