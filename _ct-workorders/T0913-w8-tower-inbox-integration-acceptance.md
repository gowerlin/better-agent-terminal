---
schema_version: 1
schema_kind: workorder
id: T0913
title: "PLAN-068 W8（在 `v0.8.x`）：整合驗收 —— 隔離實例 e2e 走完整流程（假 TUI 塔台＋ Worker `bat-notify --submit`、契約 v2 版本組合、待辦分頁回答、回合訊息卡、`hooks:` 行、headless 遠端路徑），並產出給使用者 / CT 的待實機清單"
type: verification
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T06:40:09+08:00"
started_at: "2026-11-25T06:41:22+08:00"
updated_at: "2026-11-25T06:41:22+08:00"
target_version: "0.8.x（與 CT 6.1.0 同日發佈）"
depends_on: [T0911]
related:
  - "PLAN-068；T0902（§6′ 版本組合表、待實機 T-1–T-12）；T0903–T0911 回報區（各自的待實機項目）；T0904 的 `e2e/t0904-tower-notify-protection.spec.ts` 與 `e2e/fixtures/fake-line-editor.mjs` / `notify-job-runner.mjs`（可沿用）"
affects_files:
  - _ct-workorders/T0913-w8-tower-inbox-integration-acceptance.md
  - e2e/
  - electron/remote/__tests__/
  - electron/__tests__/
  - src/__tests__/
  - src/components/__tests__/
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0913（塔台已預先從 `v0.8.x` `17c84662` 建立分支 `ct/T0913`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0913` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `17c84662b6e7721c3201cc2964aacc7a920db5eb`，不符就停下問塔台。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只新增 / 修改測試與 e2e（`affects_files`），🔴 不改產品程式。驗收中發現產品缺陷：不要修，記錄重現步驟與證據，狀態 `PARTIAL` 並在回報區建議開 BUG（塔台開單）。與平行的 T0912（W7 文件）不重疊。"
  - "🔴 驗收範圍（隔離實例 `launchIsolated`，假 TUI，不登入 claude / codex）：① 版本組合（T0902 §6′ 表）：未宣告 / `--bat-contract 1` / `2` / `3` 的塔台分頁 × 狀態檔 `bat_contract` 缺 / 1 / 2 / 3：徽章 `CT↑` / `BAT↑`、P-1 / P-2 / P-3、待辦分頁停用 / 可用、保護（`draft` / `reading` / B0）只在相符時生效、T0788 既有保留對所有分頁照舊。② 完整流程（契約 2）：假 TUI 塔台寫 `_tower-state.md`（`bat_contract: 2`、`awaiting_user` / `user_actions` / `reminders`）→ 待辦分頁三區顯示 → 從分頁回答 → 塔台輸入框收到一行 `U-n：<代號>` / `A-n：完成`（經保留佇列；塔台輸入框有草稿時不送、草稿送出後才送）；Worker `bat-notify --submit` 的通知不混進草稿、不搶捲動；`⏸N` 縮圖。③ 回合訊息卡：以真 `bat-hook.mjs stop`（stdin 餵 `last_assistant_message`）在契約 2 塔台分頁產生卡片 → 待辦分頁「💬」顯示、展開已讀、釘選、加亮行、縮圖 `💬N`；非塔台分頁不收。④ `--set-role --bat-contract 2` 的 `bat-contract:` 與 `hooks:` 行（`none (not-launched-by-bat)` 等可在隔離實例產生的狀態）、`🪝✕` 徽章。⑤ headless 遠端路徑（`electron/remote/__tests__` 的真 headless＋node-pty 風格）：`tower-inbox:answer`、`terminal:notify-hold-*`、`tower-cards:*`、`terminal:hooks-status` 經 proxied 正常、helper 權杖被拒。⑥ 舊呼叫回歸：不帶 `--bat-contract` 的 `--set-role` 輸出逐字不變、`bat-notify` exit code 與 stdout 不變。"
  - "🔴 待實機清單：彙整 T0902 T-1–T-12 與 T0903–T0911 回報的待實機項目，去重後按「使用者（Windows 安裝版）/ CT 塔台（新 CT 6.1.0 ＋ BAT 測試版、新 CT ＋舊 BAT 降級、T-8）/ 遠端（WSL）」分組，每項寫成可照做的步驟與預期結果，放在回報區〈待實機清單〉（塔台會轉給使用者與 CT）。"
  - "🔴 驗證：worktree `npm ci`；新 e2e 連續 2 次通過；`npm run test:unit` 第一次完整執行全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0。不得以預設實例啟動；不碰使用者正在用的 BAT（安裝版）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn。`TMP` 用系統預設。程序清理照 D308。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "🔴 公開 repo（D176）：測試 fixture 與回報區不寫真名、客戶名、家目錄路徑（範例路徑 `C:\\Users\\demo`）。日誌不記內容、權杖、env。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0913 — PLAN-068 W8：整合驗收

## 背景

PLAN-068 的 W0–W6、W9 已合併進 `v0.8.x`（`17c84662`），各單都有單元 / 元件測試與部分 e2e，但還沒有一次把整條流程（契約版本判定 → 待辦清單 → 回答 → 保留佇列 → 回合訊息卡 → hooks 狀態）在隔離實例上走完。本單做整合驗收，並整理給使用者與 CT 的待實機清單，作為與 CT 6.1.0 同日發佈前的關卡。

## 驗收

- [ ] ① 版本組合表每一列
- [ ] ② 待辦清單 → 回答 → 保留佇列完整流程
- [ ] ③ 回合訊息卡
- [ ] ④ `--set-role` 的兩行與 `🪝✕`
- [ ] ⑤ headless 遠端路徑與權杖拒絕
- [ ] ⑥ 舊呼叫不回歸
- [ ] 新 e2e ×2、`test:unit` 第一次即綠、legacy、build、typecheck
- [ ] 〈待實機清單〉（使用者 / CT / 遠端分組）
- [ ] 隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **session_id**：

### 驗收結果

### 待實機清單

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0913`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
