---
schema_version: 1
schema_kind: workorder
id: T0576
title: "PLAN-047 A2：本機範圍權杖跨 BAT 重開持久化（Terminal Server 存活 / T0108 replay）＋升級相容"
type: feature
status: IN_PROGRESS
started_at: "2026-10-17T19:36:29+0800"
updated_at: "2026-10-17T19:36:29+0800"
repo: better-agent-terminal
project: PLAN-047
priority: P1
sizing: M
created_at: "2026-10-17T19:04:59+0800"
target_version: "與 T0575（A1）同版發佈（D149）"
depends_on: [T0575]
related:
  - "T0575（A1，本單的前置；其回報區有「BAT 重開 + Terminal Server 存活」實測現象）"
  - "T0574 回報區 R3 缺口 2"
  - "T0108（Terminal Server replay）、T0537（已存 Worker 歸屬）、T0565（role / mode 不持久化的已知限制）"
affects_files:
  - electron/remote/helper-capability.ts
  - electron/main.ts
  - electron/pty-manager.ts
  - "electron/__tests__/**（新增權杖持久化 / replay 還原測試）"
  - "e2e/t0576-capability-persist-restart.spec.ts（新增）"
  - "CLAUDE.md（遠端 Tower 通知節的權杖生命週期、單一 userData 目錄清單）"
  - _ct-workorders/T0576-capability-token-persist-across-restart.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；實測一律用隔離實例（需先 `npx vite build`）。"
  - "🔴 **不得把 token 明文寫入任何檔案或日誌**；只能存 SHA-256 digest 與綁定欄位。遠端 headless 的生命週期（server 重啟全失效）不變。"
  - "🔴 開工前確認 T0575 已 DONE / FIXED 並已 commit；未完成 → 回報 BLOCKED，不要自己做 A1 的部分。"
---

# T0576 — PLAN-047 A2：範圍權杖跨 BAT 重開持久化

## 背景

T0575（A1）後，本機 PTY 的 `BAT_REMOTE_TOKEN` 是只存在記憶體的 `batcap.` 權杖。Windows 預設 Terminal Server 模式下，BAT 關閉但 Terminal Server 存活（quit 未勾停止）時，PTY 與其 env 保留；BAT 重開後 registry 是空的，這些分頁的 helper 全部 `Authentication failed`，CT auto-session 中斷（T0574 R3 缺口 2）。T0575 之前因 server token 有持久化而照常可用 → 這是 A1 引入的回歸，必須同版修正。

## 任務

1. **持久化**：`HelperCapabilityRegistry` 的簽發紀錄（digest、terminalId、role、towerId、issuedAt）寫入 userData 下的檔案（名稱自訂，例如 `helper-capabilities.json`；`app.getPath('userData')` 一律 lazy 取值，不得在 import 期呼叫，見 CLAUDE.md 單一 userData 目錄規則）。寫入原子化（tmp + rename），撤銷時同步移除。只存 digest，不存 token。
2. **還原**：BAT 啟動、Terminal Server replay（`pty:list`）完成後，只還原清單中仍存活的 terminalId 的紀錄，其餘丟棄並重寫檔案。replay 前收到的 helper 認證要能在還原後成功（或明確以可重試錯誤回應，helper 端行為在回報區說明）。
3. **direct 模式 / Terminal Server 未存活**：BAT 重開時 PTY 已全部結束 → 清空紀錄。
4. **順帶補齊**（T0565 已知限制）：replay PTY 若有還原的權杖紀錄，可得知 tower / worker 綁定；評估是否以此恢復 `isWorkerOf`（close-worker 歸屬）——與 T0537 已存分頁歸屬的優先序要寫清楚；`role` / `towerMode` 是否一併持久化交塔台決定（回報區建議即可，本單不做）。
5. **升級相容**：舊版 BAT 留下的存活分頁（env 為全權 server token）在新版照常可用（server token 仍被接受），CLAUDE.md 寫明。
6. **CLAUDE.md**：權杖生命週期（本機：跨 BAT 重開保留至 PTY 結束；headless：server 重啟全失效）、userData 檔案清單補上新檔。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. 單元測試：寫入 / 撤銷 / 原子寫、還原只留存活 id、檔案損毀時安全降級（清空 + `logger.warn`，不 crash）、不含明文 token（測試斷言檔案內容不含簽發的 token 字串）。
3. e2e `e2e/t0576-capability-persist-restart.spec.ts`（隔離實例）：派一個 Worker → 關 BAT（不停 Terminal Server）→ 重開 → 塔台分頁 `--set-role` / `--close-worker` 成功、Worker 分頁 `bat-notify` 成功；Worker 結束後其紀錄已移除。
4. 回報區附：T0575 回報的回歸現象在本單後已消失的實測對照。

## 塔台補充（2026-10-17 19:36，派工前，依 T0575 回報）

T0575 已 DONE（`2c59edee`），開工前條件成立。請先讀 T0575 回報區「BAT 重開 + Terminal Server 存活」一節，以下為必做：

1. **時序**：重開後 renderer 還原分頁的 `pty:create` 早於 T0108 replay 清單（實測 `[helper-cap] issued` 11:30:43.333Z 早於 `replay: 1 active PTY(s)` 11:30:43.601Z），Terminal Server 判定已存在、不重建，但主行程已替同一 id 簽新權杖；`issue()` 會先 `revokeTerminal`，會把還原的那把撤銷。修正方式自行判斷（例如持久化紀錄先載入、遇到 Terminal Server 回「已存在」時撤回新簽的並保留還原的，或 replay 完成前不簽），測試要涵蓋這個順序。
2. **歸屬**：`isOwnedBy` 目前是 `capabilityOrSavedTabOwnership`（本行程有工單記錄須 `isWorkerOf`，否則沿用 T0537 已存分頁歸屬）；還原權杖後，replay PTY 的 worker 綁定是否改由權杖紀錄提供，與 T0537 的優先序寫清楚，t0537 e2e 回歸必跑。
3. 驗收第 3 點的 e2e 可參考 T0575 量測時的流程（「確認退出、不停止 Terminal Server」→ 重開 → Recovery 保留 → 在存活分頁內執行 helper，`BAT_REMOTE_PORT` 換成新實例 port）；注意 T0575 第一次量測 `app.close()` 未返回而殘留隔離 Terminal Server，teardown 要確保結束並刪 runtime userData。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

本機範圍權杖跨 BAT 重開保留：`HelperCapabilityRegistry` 的簽發紀錄（SHA-256 digest、`terminalId`、`role`、`towerId`、`issuedAt`，**不含 token**）原子寫入 `<userData>/helper-capabilities.json`，簽發 / 撤銷即重寫。BAT 啟動時（早於 PtyManager 與 `startTerminalServer`）載入為 **pending**；T0108 replay 清單上的 id 保留、其餘撤銷；沒有存活的 Terminal Server（含 Recovery「重新開始」、direct 模式）或 Terminal Server 死亡（T0112 recovery）→ 全部撤銷。塔台補充的時序（`pty:create` 早於 replay）以「pending 紀錄不被 `issue()` 撤銷、settle 時二選一」處理。T0575 的回歸（`Authentication failed: Invalid token`）在 e2e 實測已消失，並以同 spec 的對照組重現修正前行為。全部驗收閘門通過。

### 落點檢查

- C-0 PASS：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS；C-3 PASS（affects_files 存在或祖先存在）；C-2 不適用（無 `branch` 欄位），HEAD = `main`
- 前置：T0575 DONE（`2c59edee`，塔台結案 19:36:07）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 變更檔案

| 檔案 | 內容 |
|---|---|
| `electron/remote/helper-capability.ts` | `CapabilityEntry` 加 `issuedAt` / `pending`；`onChange` 選項；`records()`、`restore()`（驗證 digest / id 白名單 / 角色與 `towerId` 一致，載入為 pending）、`settleRestored(isAlive)`、`hasPendingRestored()`、`hasWorkerCapability()`；`issue()` 不撤銷同 id 的 pending 紀錄；store：`HELPER_CAPABILITY_STORE_FILE`、`readHelperCapabilityStore`、`writeHelperCapabilityStore`（同目錄 temp + rename、`0o600`，失敗清 temp 後拋錯）、`restoreHelperCapabilitiesFromStore`（損毀 → warn + 寫回空檔、無效紀錄略過 + 重寫，不拋錯）。仍不 import electron |
| `electron/pty-manager.ts` | `PtyManagerDeps.onSurvivingPtys(ids)`：`handleReplayList` 以 replay 清單呼叫、`handleServerDeath` 以 `[]` 呼叫（重建前） |
| `electron/main.ts` | registry 帶 `onChange` → `persistLocalHelperCapabilities`；`loadLocalHelperCapabilities()`（whenReady、PtyManager 建立前；`app.getPath('userData')` lazy）；`settleRestoredHelperCapabilities()`；`createElectronPtyDeps` 接 `onSurvivingPtys`；`startTerminalServer` 在 fork 前 settle 為全部撤銷；close-worker `isOwnedBy` 第三參數 `hasWorkerCapability` |
| `electron/close-worker.ts` | `capabilityOrSavedTabOwnership` 加選填第三參數 `hasWorkerCapability`（優先序見任務 4） |
| `electron/__tests__/helper-capability-persist.test.ts`（新） | 36 項（見驗證） |
| `e2e/t0576-capability-persist-restart.spec.ts`（新） | 2 個 test：主流程 + 對照組 |
| `CLAUDE.md` | 單一 userData 清單補 `helper-capabilities.json`；「本機 PTY」：`--close-worker` 優先序改寫、升級相容註明 T0576 不改、原「已知限制（T0576 修正）」改寫為「跨 BAT 重開保留」（還原 / 時序 / 損毀 / 日誌 / 不持久化項目 / 驗證）；「生命週期」分 headless（記憶體、server 重啟全失效）與本機（保留至 PTY 結束）；T0537 段補 T0576 歸屬註記 |

### 驗證

| 閘門 | 結果 | 證據 |
|---|---|---|
| `npx vite build` | PASS | exit 0 |
| `npm run typecheck` | PASS（0） | exit 0 |
| `npm run typecheck:electron` | PASS（0） | exit 0 |
| `npm run test:unit` | PASS | 268 檔 / 4724 passed / 3 skipped（T0575 時 267 / 4688） |
| 新單元測試 `helper-capability-persist.test.ts` | PASS | 36 項：寫入 / 撤銷 / clear / restore / settle 的 `onChange`、`records()` 不含 token、restore 驗證（多種無效紀錄）、settle 保留存活 / 撤銷其餘、**pending 時序 5 項**（`issue` 不撤銷 pending、在清單 → 留還原撤新簽、不在清單 → 反之、其他 id 不受影響、kill 時兩者皆撤）、原子寫入（目錄只剩 store、無 temp）、寫入失敗保留原物且無 temp、讀檔 missing / 壞 JSON / 版本 / 非陣列 / `null`、損毀 → warn + 空檔不 crash、損毀且無法重寫仍不拋錯、無效紀錄略過並重寫、日誌與檔案不含 token；PtyManager 兩個「行程」共用 store（replay 前 `pty:create` 後清單保留原 token、BAT 關閉期間結束的 PTY 被移除、Worker exit 移除紀錄、空清單全撤、server 死亡全撤且重建重簽、損毀 store 後照常運作）；歸屬優先序 4 項；main.ts source guard 5 項 |
| 新 e2e `e2e/t0576-capability-persist-restart.spec.ts` | PASS | 2 passed（57.4 s），見下節 |
| 既有 helper 相關 e2e 回歸 | PASS | `t0523` / `t0535` / `t0537`（塔台指定必跑）/ `t0538` / `t0562` / `t0575`：6 passed（1.5 min） |
| 遠端 headless | 未改 | headless 的 registry 不帶 `onChange`、不讀寫 store；`headless-*` 單元測試全綠 |

### 修正前 / 修正後實測對照（驗收 4）

同一流程（隔離實例：派 Worker → 「確認退出、不停止 Terminal Server」→ 同 runtime 重開 → Recovery 保留 → 在存活分頁內以原 env 執行 helper，`BAT_REMOTE_PORT` 指向新實例 port）：

| 步驟 | T0575 回報（修正前） | 對照組（本單 build，重開前刪 store = T0575 行為） | 本單 |
|---|---|---|---|
| 塔台 `--set-role tower --agent claude --mode yolo` | exit 1，`Authentication failed: Invalid token` / `set-role: AUTH_FAILED` | exit 1，同訊息（e2e 斷言） | **exit 0**，`✓ Tower role set` + `mode: yolo`，標題 `Claude CLI · Tower` |
| Worker `bat-notify`（本單另加 `--submit`） | exit 1，`Invalid token` | exit 1，`Invalid token` | **exit 0**，`✓ Notified …: T0576 完成` |
| 塔台 `--close-worker T0576` | （未測） | — | **exit 0**，Worker 分頁關閉、離開 registry |
| 分頁 env 的 token | 上一行程簽發 | 同左 | 與重開前相同（e2e 斷言） |
| store | （無） | 刪除 | Worker 結束後只剩塔台紀錄（e2e 斷言） |

重開後日誌（本單 main 流程，節錄）：

```
11:49:35.996Z [helper-cap] restored 2 capability record(s) from helper-capabilities.json — pending the Terminal Server's PTY list
11:49:36.386Z [helper-cap] issued: terminal=e2e-t0576-tower role=tower
11:49:36.416Z Created terminal using node-pty
11:49:36.463Z [helper-cap] issued: terminal=73c26460… role=tower
11:49:36.487Z Created terminal using node-pty
11:49:36.527Z [terminal-server] user chose recovery — connected to port 57769
11:49:36.528Z [PtyManager] replay: 2 active PTY(s) found on reconnect
11:49:36.529Z [helper-cap] kept restored: terminal=e2e-t0576-tower (Terminal Server PTY list)
11:49:36.529Z [helper-cap] kept restored: terminal=73c26460… (Terminal Server PTY list)
```

### 塔台補充 1：時序的處理與一個更正

- **更正 T0575 回報的推測**：重開後早到的 `pty:create` **不是**「送 Terminal Server、server 判定已存在」。上面日誌顯示它發生在 Recovery 提示回答**之前**（尚未連上 Terminal Server），`PtyManager.create` 走 **direct node-pty**，同 id 另起一個本機 shell（`Created terminal using node-pty`），並替它簽了權杖（Worker 那個被簽成 `role=tower`，因為還原分頁的 `pty:create` 不帶 `customEnv`）。
- **修正方式**：還原紀錄標為 pending；`issue()` 只撤銷同 id 的非 pending 紀錄。replay 清單到達時 `settleRestored`：id 在清單 → 保留還原的（`useServer` 之後分頁輸入一律送 server PTY，也就是 env 帶還原權杖的那個）、撤銷期間新簽的；不在清單 → 撤銷還原的、保留新簽的。未採「replay 完成前不簽」：`create` 是同步並回傳 `created` 給 renderer（`requestPtySizeSync`、是否重送 agent 啟動命令），延後會牽動 renderer 與 `handlers/pty.ts`，超出範圍。
- **replay 前的 helper 認證**：還原紀錄在 BAT 啟動時就載入，replay 前認證即成功、不需重試。但 Recovery 提示回答前 PtyManager 還不認得這些 PTY：`--set-role` → `NOT_FOUND`（exit 3）、`--close-worker` → `NOT_FOUND`；這段期間使用者正看著 Recovery 對話框，窗口很短。

### 任務 4 / 塔台補充 2：close-worker 歸屬優先序（已實作）

`capabilityOrSavedTabOwnership(isWorkerOf, hasRecordedWorkorder, hasWorkerCapability)`：

1. 候選持有任何 worker 權杖（含還原的）→ 只看 `isWorkerOf(候選, 塔台)`，不符即 `NOT_OWNER`；**權杖優先於已存分頁**（權杖綁定 = 該 PTY env 的 `BAT_TOWER_TERMINAL_ID`，是實際回報對象）。
2. 否則本行程記錄過工單 → 需 worker 權杖（T0575，結果 `NOT_OWNER`）。
3. 否則沿用 T0537 已存分頁歸屬（Terminal Server 未存活、分頁還原成空 shell — 拿到的是 tower 權杖；或 T0575 前的 PTY）。

工單號仍來自已存分頁（權杖不記工單）。正常情況兩者一致，只有衝突時行為不同（以權杖為準）。t0537 e2e（Terminal Server 不存活路徑）回歸通過；本單 e2e 的 `--close-worker` 走第 1 條（還原的 worker 權杖）。

**`role` / `towerMode` 是否持久化（建議，本單未做）**：建議**不併入**權杖 store。權杖紀錄只放認證所需的最小資料；`towerMode` 決定 yolo 自動送字（PLAN-044），持久化錯誤的代價較高；CT 每次塔台啟動都會 `--set-role --mode`，重開後再跑一次即恢復。若要做，建議另開小單，存在 PtyManager 側並沿用同一套 replay settle 決定去留，一併考慮 Worker 的 `CT_MODE`（replay PTY 目前也不知道 `customEnv`）。

### 偏離與說明

- `electron/close-worker.ts` 不在 affects_files，但任務 4 / 塔台補充 2 要求寫清優先序；改動只是加一個選填參數，兩參數呼叫的行為不變（單元測試守住）。
- 讀檔 / 還原邏輯放在 `helper-capability.ts`（可單元測試），main.ts 只接線；store 在 main 的 `onChange` 同步寫入（檔案很小，只在簽發 / 撤銷時寫）。寫入失敗只 `logger.warn`，下次變更再寫。
- 舊 PTY（T0575 前，env 為 server token）不受影響：server token 仍被 RemoteServer 接受，T0576 不輪替。
- e2e 另加對照組 test（重開前刪 store），作為驗收 4 的修正前重現，不在驗收要求內。
- 隔離實例在「不停 Terminal Server」時 `app.close()` 仍 20 s 未返回（與 T0575 第一次量測相同），spec 以 timeout + kill Electron 行程處理；teardown 一律以 pid 檔 + 命令列比對停掉隔離的 Terminal Server、刪 runtime userData（兩案日誌皆 `alive after teardown: false`、`userData removed: true`）。未碰使用者的 BAT（9876）與其 Terminal Server。
- `src/styles/settings.css` 的 M 不是本單變更，未納入 commit。

### 後續建議

1. **（新發現，既有問題）Recovery 提示期間 direct 另起 shell**：BAT 重開且 Terminal Server 存活時，renderer 還原分頁的 `pty:create` 在使用者回答 Recovery 前就送到，走 direct node-pty 另起同 id 的 shell；選「保留」後輸入送 server PTY，但 direct shell 程序仍在，其輸出也進同一 id。這是 T0108 / T0110 既有行為（非 T0575 / T0576 引入），建議開 BUG 單：Recovery 待決時延後 `pty:create`，或選「保留」後收掉 direct 實例。
2. `role` / `towerMode` 持久化：見任務 4 建議（另開小單或維持現狀）。
3. 實機驗收（與 T0575 同版）：Windows 安裝版「確認退出、不停止 Terminal Server」→ 重開 → 保留 → 塔台派工 / Worker 回報。

### Commit

（commit 後補）
