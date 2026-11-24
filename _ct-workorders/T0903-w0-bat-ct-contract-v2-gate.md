---
schema_version: 1
schema_kind: workorder
id: T0903
title: "PLAN-068 W0（在 `v0.8.x`）：BAT ↔ CT 契約 v2 版本閘門 —— `--set-role --bat-contract`、`PtyInstance.towerContract`、查詢欄位、`role-changed`、renderer store、縮圖徽章 `CT↑` / `BAT↑` 與 P-1 / P-2 提示"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T04:53:03+08:00"
updated_at: "2026-11-25T04:53:03+08:00"
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
- **session_id**：

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0903`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
