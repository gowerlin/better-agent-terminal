---
schema_version: 1
schema_kind: workorder
id: T0903
title: "PLAN-068 W0（在 `v0.8.x`）：BAT ↔ CT 契約 v2 版本閘門 —— `--set-role --bat-contract`、`PtyInstance.towerContract`、查詢欄位、`role-changed`、renderer store、縮圖徽章 `CT↑` / `BAT↑` 與 P-1 / P-2 提示"
type: implementation
status: PARTIAL
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T04:53:03+08:00"
updated_at: "2026-11-25T05:09:02+08:00"
completed_at: "2026-11-25T05:09:02+08:00"
started_at: "2026-11-25T04:54:27+08:00"
target_version: "0.8.x（與 CT 6.1.0 同日發佈，版號定版時決定）"
depends_on: [T0902]
related:
  - "PLAN-068；T0902 回報區（第一版＋〈第二版（Renew #1，D328）〉，**本單規格的唯一來源**：§6′、§3.1′、R11、拆單 W0 列）；D329 / D330 / D332；BAT ↔ CT 契約 v2（CT 已 ACCEPTED：BMad-Guide `_reply-2026-11-25-tower-user-inbox-issue24-v2.md`、`90e640e`、CT D868）"
  - "T0562（`--set-role`，契約 CT-T013）、T0582 / T0643（查詢 channel、`scope: towers`）、T0584（BAT MCP shim）；CLAUDE.md「塔台分頁標題（T0562，D147）」「helper 唯讀查詢 channel」「BAT MCP shim」各節；`docs/agent-guide/tower-tab-title.md`"
affects_files:
  - _ct-workorders/T0903-w0-bat-ct-contract-v2-gate.md
  - scripts/bat-terminal.mjs
  - scripts/bat-mcp.mjs
  - scripts/__tests__/
  - electron/terminal-role.ts
  - electron/pty-manager.ts
  - electron/terminal-query-handlers.ts
  - electron/terminal-server/
  - electron/remote/headless-entry.ts
  - electron/preload.ts
  - electron/__tests__/
  - electron/remote/__tests__/
  - src/types/
  - src/stores/
  - src/lib/
  - src/lib/__tests__/
  - src/components/TerminalThumbnail.tsx
  - src/components/__tests__/
  - src/locales/
  - src/App.tsx
  - tests/bat-*.test.mjs
  - e2e/
  - CLAUDE.md
  - docs/agent-guide/
renew_count: 0
session_ids:
  - "4905ba02-67db-4631-bb50-0f2e7b97cb22"
isolation: worktree
workdir: "worktree ct/T0903（塔台已預先從 `v0.8.x` `fda8a4b4` 建立分支 `ct/T0903`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0903` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `fda8a4b49f2de8194799d124a8dc5f290c47eee9`，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 規格來源：T0902 回報區（第一版＋〈第二版〉）是唯一規格；本單只做 **W0**：§3.1′ 的 `--bat-contract` 參數、`bat-contract:` 輸出行、`towerContract` 查詢欄位、`terminal:role-changed` 帶 `towerContract`、renderer store、縮圖徽章 `CT↑` / `BAT↑`、P-1 / P-2 toast（每個分頁一次）與 tooltip。🔴 **不做** `hooks:` 行與 `hooksStatus`（W9）、保護（W1 / W2）、卡片（W3）、待辦分頁與 P-3 / 狀態檔判定（W4）。`towerContract` 的 getter（例 `ptyManager.getTowerContract(id)`）要提供給後續 W1 / W2 / W3 使用。"
  - "🔴 契約（R11，CT 已依此撰寫 6.1.0，不得單方更改）：`bat-terminal.mjs --set-role tower --bat-contract <n> [--mode …] [--terminal-id …] [--agent …]`；`<n>` 整數 ≥ 1，不是整數 → 用法錯誤 exit 1；沒有 `--set-role` 卻帶 `--bat-contract` → 用法錯誤 exit 1。BAT 支援的最大值 = 2：`n == 2` → stdout `  bat-contract: 2`；`n > 2` → `  bat-contract: 2 (requested <n>: unsupported)`，該分頁 `towerContract` 記為請求值（判定為「BAT 太舊」）；`n == 1` → 記 1（判定為 CT 太舊）；**不帶參數**的 `--set-role` → 把 `towerContract` 清成未宣告，**不輸出** `bat-contract:` 行。🔴 舊呼叫（不帶 `--bat-contract`）的 stdout、stderr 與 exit code 逐字不變（R11「只增加；舊 CT 不帶參數時輸出逐字不變」）。塔台裁定：T0902 §3.1′ 表格寫的「不帶參數時 `  bat-contract: none`」與 R11 衝突，以 R11 為準，`none` 只出現在查詢欄位（`towerContract: null`），不出現在 `--set-role` 輸出。exit code 不變（`0` / `3` / `1`）。生命週期同 `role` / `towerMode`（T0562）：⏻ 重啟、Terminal Server recovery 保留，PTY 關閉消失；每次 `--set-role` 覆寫；不持久化。本機與 headless 共用同一份實作。"
  - "🔴 查詢與 MCP：`terminal:whoami` / `get-state` / `list`（含 `scope: 'towers'`）多 `towerContract: number | null`；BAT MCP（`scripts/bat-mcp.mjs`）對應 tool 的輸出照樣帶出（維持全唯讀，不新增寫入 tool）。`scope: 'towers'` 只回 metadata 的規則不變（T0643）。"
  - "🔴 renderer：`terminal:role-changed` 帶 `towerContract`；store 依此判定每個塔台分頁的狀態（相符 / CT 太舊 / BAT 太舊 / 不是塔台），規則照 T0902 §6′ 判定表的「分頁宣告」欄。縮圖徽章與 P-1 / P-2 文字照 §6′ 草案（三語系都要；文字可微調但意思不變）；toast 每個分頁只出一次。既有 T0788 對話框保護與所有現有行為不受影響（🔴 不回歸）。標題規則（T0562 `setAutoTitle` / 使用者命名優先）不變。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 第一次完整執行全綠（附 passed / files 數）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run verify:helpers` exit 0。新增測試：`--bat-contract` 各值（缺、1、2、3、非整數、沒有 `--set-role`）的 stdout / exit / `towerContract`；舊呼叫輸出不變（快照）；⏻ / recovery 保留、PTY 關閉清除；查詢欄位；renderer 判定與徽章。e2e 只用隔離實例（`launchIsolated`），不得以預設實例啟動；不碰使用者正在用的 BAT（安裝版）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn。`TMP` 用系統預設（T0716）。程序清理照 D308。"
  - "🔴 文件：CLAUDE.md「塔台分頁標題（T0562，D147）」節加一兩句（契約 v2 的 `--bat-contract`、`towerContract` 唯一實作位置、🔴 舊呼叫輸出不變），細節寫進 `docs/agent-guide/tower-tab-title.md`（或新的 `docs/agent-guide/tower-inbox.md`，並更新 `docs/agent-guide/README.md` 索引）；CLAUDE.md < 100k 字元、小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0903 — PLAN-068 W0：BAT ↔ CT 契約 v2 版本閘門

## 背景

GitHub #24 / #23 的整合設計（PLAN-068，T0902）已由 BAT 與 CT 雙方使用者核定（BAT D329 / D330、CT D868）。使用者裁示**強制版本對齊**：新的通知保護、回合訊息卡、待辦清單都要 BAT ↔ CT 契約 v2 雙方相符才啟用，判定單位是塔台分頁（T0902 §6′）。W0 是其他各單（W1–W9）共同依賴的版本閘門，必須最先完成。

CT 6.1.0 開工順序（契約 C-1）：先在 `_tower-state.md` 寫 `bat_contract: 2` → `--set-role tower --bat-contract 2` → 解析 `bat-contract:` 行；舊 BAT 以 `Unknown option '--bat-contract'` exit 1 拒絕時，CT 不帶參數重送一次。

## 實作

1. 確認 merge-base；worktree `npm ci`。
2. 讀 T0902 回報區 §6′、§3.1′、R11、第二版拆單 W0 列。
3. helper → main / headless → `PtyInstance` → 查詢 / MCP → `role-changed` → renderer store → 縮圖徽章與 P-1 / P-2 提示。
4. 測試、文件、驗證。

## 驗收

- [ ] `--bat-contract` 參數與 `bat-contract:` 輸出行符合 R11；舊呼叫不變
- [ ] `towerContract` 生命週期（覆寫 / 清除 / ⏻ / recovery / PTY 關閉）
- [ ] 查詢欄位（含 `towers` scope）與 BAT MCP 輸出
- [ ] renderer 判定、徽章 `CT↑` / `BAT↑`、P-1 / P-2（三語系，每分頁一次）
- [ ] 既有行為不回歸（T0788、標題規則、舊 helper 拒絕未知參數）
- [ ] `test:unit`（第一次即綠）、`test:legacy`、`vite build`、兩個 typecheck、`verify:helpers`
- [ ] CLAUDE.md 與 docs 更新
- [ ] 隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：`PARTIAL` —— 程式、測試、文件全部完成，W0 範圍沒有剩下要做的事；未達成的只有驗收「`test:unit` 第一次即綠」這一條（第一次完整執行 7 個失敗，原因與處置見〈遭遇問題〉第 1 點，第二次完整執行全綠）。若塔台接受這個偏差，可直接改 `DONE`。
- **session_id**：4905ba02-67db-4631-bb50-0f2e7b97cb22

### 產出摘要

**落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`；C-1 工單在 `$CT_HOME/_ct-workorders/` 下；C-3 `affects_files` 祖先都在；C-2 沒有 `branch` 欄位。`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0903`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`git merge-base HEAD v0.8.x` = `fda8a4b49f2de8194799d124a8dc5f290c47eee9`，與工單相符。

**契約（R11）—— `scripts/bat-terminal.mjs`**
- `--set-role tower --bat-contract <n>`：`<n>` 只收數字（可有前後空白，`02` = 2），整數 ≥ 1 且是安全整數；否則 exit 1 `set-role: USAGE`，不連線。缺值、或沒有 `--set-role` 卻帶 `--bat-contract`（含與 `--close-worker` / 命令並用）→ exit 1 `set-role: USAGE`。可寫在 `--set-role` 前後。
- 成功時 stdout：`✓ Tower role set: <id>`、（有模式時）`  mode: <m>`，最後一行 `  bat-contract: 2`。請求值大於 2 → `  bat-contract: 2 (requested <n>: unsupported)`；請求值 1 → `  bat-contract: 2`，分頁記 1、判定為 CT 太舊。
- 🔴 不帶 `--bat-contract` 的呼叫：送出的請求、stdout、stderr、exit code 逐字不變。即使主行程回應帶了契約欄位，也不印 `bat-contract:` 行（有逐字快照測試）。依塔台裁定，不印 `bat-contract: none`。
- 主行程沒有記錄契約時（回應沒有 `batContract`，例如更新前的主行程），不印這一行、照常 exit 0，CT 會判定為「BAT 不支援 v2」。
- exit code 不變（`0` / `3` / `1`）。`--help` 多一段 `--bat-contract`；`--set-role` 那行用法字串維持原樣（既有測試守住）。`bat-scripts.log` 只在帶參數時多記 `batContract` / `recordedContract`。

**主行程與 headless —— `electron/terminal-role.ts`、`electron/pty-manager.ts`**
- `setTerminalRole` 多收 `batContract`；不合法 → `INVALID_ARGS`（不記錄、不清除、不送事件）。
- `PtyManager.setTerminalRole(id, 'tower', mode?, towerContract?)`：每次 `--set-role` 都覆寫，不帶 `batContract` 就清除；`mode` 照舊（不帶就保留）。
- 新 getter `PtyManager.getTowerContract(id)` 只對塔台回值，給 W1 / W2 / W3 用。`restart` 會沿用這個值；Terminal Server 冪等重建與 recovery（`{ ...inst }`）也保留；PTY kill / exit 後清除；不持久化。
- 回應只在請求帶 `batContract` 時多 `towerContract` 與 `batContract: 2`，不帶時回應形狀不變。`terminal:role-changed` 一律帶 `towerContract: number | null`。本機與 headless 共用同一個 handler。

**判定 —— `src/lib/tower-contract.ts`（新檔，唯一實作，不 import electron / DOM）**
- `BAT_CONTRACT_VERSION = 2`、`parseBatContract`、`towerContractStatus`、`towerContractMismatch`。
- 判定照 §6′「分頁宣告」欄：宣告 2 → `match`；未宣告或 1 → `ct-outdated`（P-1）；大於 2 → `bat-outdated`（P-2）；不是塔台 → `not-tower`。

**查詢與 MCP**
- `terminal:whoami` / `get-state` / `list`（`mine` / `workspace` / `towers` 每一列）多 `towerContract: number | null`（`terminal-query-handlers.ts` `towerContractOf`）。`towers` scope 仍只回 metadata。
- `scripts/bat-mcp.mjs`：三個 tool 的說明加上 `towerContract`；`structuredContent` 原樣帶出；`bat_whoami` 與 `towers` 的摘要在有值時多 `bat-contract=<n>`。沒有新增 tool，仍全唯讀。

**renderer**
- `src/stores/tower-contract-store.ts`（新檔，只在記憶體）：每個視窗都套用 `role-changed`，`pty.onExit` 時清除。
- `TerminalThumbnail.tsx`：不符時顯示徽章 `CT↑` / `BAT↑`（`.tower-contract-badge`、`data-tower-contract`），tooltip 是 P-1 / P-2 全文。
- `App.tsx`：持有分頁的視窗（`ownsTerminalForCloseRequest`）在第一次不符時跳 toast（`<分頁標題>: <P-1／P-2>`，警告、20 s），每個分頁只出一次（`claimTowerContractHint`）。
- 字串 `towerContract.ctOutdated` / `batOutdated`：en / zh-TW / zh-CN 三語系，用 `{{supported}}` / `{{requested}}`。P-1 / P-2 照 §6′ 草案，只把 `v2` / `v<N>` 改成參數。
- `TerminalRoleChangeInfo` 多 `mode?` / `towerContract?`。標題規則（`applyTerminalRole`、使用者命名優先）沒有改。

**不回歸**
- T0788（`notify-hold`）、`--set-role` 舊路徑、標題規則都沒有改到程式，既有測試全綠。
- 舊 helper 拒絕未知參數的行為不變：`Unknown option` 的路徑沒動。

**文件**
- CLAUDE.md「塔台分頁標題（T0562，D147）」節加一點，標題沒有改；檔案 88,213 字元，低於 100k。
- `docs/agent-guide/tower-tab-title.md` 新增〈BAT ↔ CT 契約 v2 版本閘門〉一節：契約、主行程、生命週期、唯一實作、判定、查詢、renderer、已知限制、驗證清單。
- `docs/agent-guide/README.md` 的索引列同步更新。

**變更檔案**（2 個 commit）
- 程式：`scripts/bat-terminal.mjs`、`scripts/bat-mcp.mjs`、`electron/terminal-role.ts`、`electron/pty-manager.ts`、`electron/terminal-query-handlers.ts`、`src/lib/tower-contract.ts`（新）、`src/lib/tower-terminal-title.ts`、`src/stores/tower-contract-store.ts`（新）、`src/App.tsx`、`src/components/TerminalThumbnail.tsx`、`src/locales/{en,zh-TW,zh-CN}.json`
- 新測試：`electron/__tests__/terminal-role-contract.test.ts`、`src/components/__tests__/tower-contract-badge.test.tsx`
- 補測試：`electron/__tests__/bat-terminal-set-role.test.ts`、`terminal-list-towers.test.ts`、`electron/remote/__tests__/headless-set-role-e2e.test.ts`、`scripts/__tests__/bat-mcp.test.mjs`
- 更新形狀斷言：`terminal-role.test.ts`、`terminal-role-mode.test.ts`、`terminal-query-handlers.test.ts`、`terminal-blocked-state.test.ts`、`codex-osc-state.test.ts`、`tower-questions.test.ts`、`electron/remote/__tests__/headless-terminal-query-e2e.test.ts`
- 文件：`CLAUDE.md`、`docs/agent-guide/tower-tab-title.md`、`docs/agent-guide/README.md`

**驗證**（除註明者外，皆在 `4866e607` 執行）
- `npm ci`：exit 0
- `npm run test:unit`
  - 第一次完整執行（`4eb3d988`）：**FAILED**，5 files / 7 tests 失敗，8,569 passed
  - 第二次完整執行（`4866e607`）：**PASS**，466 files passed、3 skipped；8,576 tests passed、47 skipped
- `npm run test:legacy`：PASS，33 / 33 files、472 tests、0 failed
- `npx vite build`：exit 0
- `npm run typecheck`：0；`npm run typecheck:electron`：0
- `npm run verify:helpers`：exit 0
- 真 headless 端（真 helper、真 PTY）：`headless-set-role-e2e.test.ts` 9 / 9。`--bat-contract 2` / `3` 的輸出行與記錄、不帶參數時清除，都在這裡驗證。
- Playwright e2e 沒有跑，也沒有新增：工單沒有要求新的 e2e；這次也沒有啟動任何 BAT 實例、沒有碰安裝版。

**各驗收項目**
- `--bat-contract` 與 R11、舊呼叫不變：PASS
- `towerContract` 生命週期：PASS（node-pty 與 Terminal Server 的 ⏻、冪等、recovery、kill、exit 都有測試）
- 查詢欄位與 MCP：PASS
- renderer 判定、徽章、P-1 / P-2、三語系、每分頁一次：PASS（單元測試＋`App.tsx` source guard；沒有實機看畫面）
- 不回歸：PASS
- 驗證關卡：只有「第一次即綠」**未達成**，其餘 PASS
- 文件：PASS
- 隔離分支證據：見下

### 互動紀錄
- [04:54] 開工：落點檢查 PASS、merge-base 相符、背景 `npm ci`。
- 讀 T0902 回報區 §6、§6′、§3.1、§3.1′、R 表第二版、第二版拆單、待實機。
- 依 memory_overrides 的塔台裁定，以 R11 為準：不帶 `--bat-contract` 時不印 `bat-contract: none`。
- 把 `electron/remote/path-aware-channels.ts` 的 `terminal:role-changed` 說明字串改成含 `towerContract` 後發現它不在 `affects_files`，從 HEAD 還原，列為後續事項。
- 第一次完整 `test:unit` 出現 7 個失敗（見〈遭遇問題〉第 1 點），更新斷言、另開 commit，再完整執行一次。
- 沒有向塔台提問（yolo；沒有需要塔台裁示的範圍內選擇）。〈塔台補充〉檢查在驗證前、提交前、填回報前各做一次，都沒有新段落。

### Renew 歷程
無

### 遭遇問題
1. **`test:unit` 第一次完整執行沒有全綠**（驗收「第一次即綠」未達成）
   - 第一次在 `4eb3d988` 執行：5 files / 7 tests 失敗，分別是 `terminal-query-handlers.test.ts` 3 個，以及 `codex-osc-state.test.ts`、`terminal-blocked-state.test.ts`、`tower-questions.test.ts`、`headless-terminal-query-e2e.test.ts` 各 1 個。
   - 原因：這些既有測試以 `toEqual` 比對 whoami / get-state / list 的完整回應，本單依規格加上的 `towerContract: null` 讓形狀多一個欄位。diff 只有這個欄位，不是行為回歸。
   - 我在 commit 前只跑了直接相關的測試檔，沒有先全量掃一次，所以漏掉這些斷言。
   - 處置：在 `4866e607` 補上這個欄位的預期（只改斷言，產品程式沒動），再完整執行一次全綠。
2. **範圍外的後續事項**：`electron/remote/path-aware-channels.ts` 的 `terminal:role-changed` 說明字串沒有列出 `mode` / `towerContract`（`mode` 從 T0565 起就沒列）。該檔不在 `affects_files`，所以沒改；字串只是說明，沒有測試依賴。建議併入後續工單（例如 W1）一起更新。
3. **已知限制**（已寫進 docs）
   - BAT 重開但 Terminal Server 存活時（T0108 replay），在 CT 再次 `--set-role` 前，host 沒有 `towerContract`，畫面上也沒有徽章，與 `role` / `towerMode` 相同。
   - P-1 / P-2 文字提到的通知保護、卡片、待辦清單由 W1–W4 實作，依 R10′ 與 CT 6.1.0 同一版發佈。
4. **未實機驗證**：徽章與 toast 的實際畫面沒有實機看過，只有單元測試與 source guard。T-8（舊 CT 搭新 BAT）屬第二版待實機清單。

### 隔離分支證據
- branch：`ct/T0903`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`，與 main 的共同祖先，屬預期）。分支起點是 `v0.8.x` `fda8a4b49f2de8194799d124a8dc5f290c47eee9`，`git merge-base HEAD v0.8.x` 相符。
- validated_sha：`4866e6070ec6c463a9c7195f12a88e77f6c4d381`
- head_sha：`4866e6070ec6c463a9c7195f12a88e77f6c4d381`
- validated_sha ≠ head_sha 的說明：兩者相同。
- 產品 commit：`4eb3d988`（feat）、`4866e607`（test）。收單時 `git -C "$CT_WORKTREE" status --porcelain` 為空。

### 回報時間
2026-11-25T05:07:54+08:00
