---
schema_version: 1
schema_kind: workorder
id: T0846
title: "同版重裝也提示：有安裝程式結束紀錄時，版本相同也顯示「安裝時結束了 N 個終端」並列出被中斷的 agent 分頁"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-063
priority: P2
sizing: S
created_at: "2026-11-04T14:16:11+0800"
started_at: "2026-11-04T14:18:00+0800"
updated_at: "2026-11-04T14:18:00+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "PLAN-063（子項 2 T0821、子項 3 T0823）；D278；D277；PLAN-063〈狀態〉2026-11-04 14:14 同版重裝"
affects_files:
  - _ct-workorders/T0846-same-version-reinstall-upgrade-notice.md
  - electron/upgrade-interruption.ts
  - electron/main.ts
  - electron/__tests__/upgrade-interruption.test.ts
  - src/components/ServerStatusToast.tsx
  - src/App.tsx
  - src/components/__tests__/upgrade-interruption.test.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - docs/agent-guide/upgrade-interruption.md
  - CLAUDE.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
tower_question: open
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改觸發條件與同版文字：孤兒清理的行為與順序（T0540 先殺樹）、Recovery（T0578）、server recovery（T0704）、`InstallerQuitController` / NSIS（T0823）、`takeInstallerQuitRecord` 讀一次即刪、IPC 只給第一個問的視窗，全部不變（`upgrade-interruption.test.ts` 既有 source guard 必須照舊通過）。"
  - "🔴 只有孤兒清理、沒有安裝程式紀錄（或紀錄的 PTY 數 = 0）時，維持「版本相同不觸發」（當機重開不得出現升級提示）；沒有上次版本照舊不觸發。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。日誌只記版本與數量。"
---

# T0846 — 同版重裝也提示升級結束的終端

## 元資料
- **工單編號**：T0846｜**類型**：implementation｜**狀態**：IN_PROGRESS｜**建立**：2026-11-04 14:16 (UTC+8)
- **規模**：S｜**決策**：D278

## 現象（2026-11-04 14:07 實機，安裝版 pre.7）
BAT 執行中重裝同版 pre.7：舊行程 `[installer-quit] request received: recorded 1 terminal(s), 1 claude session(s)` 並正常結束；新行程 `[installer-quit] record found: version=0.7.4-pre.7 source=running-app ptys=1 claude-sessions=1`，但**沒有** `[upgrade-interruption] detected`，沒有 toast、claude 分頁沒有列進「被中斷的 agent 分頁」。原因：`detectUpgradeInterruption`（`electron/upgrade-interruption.ts`）在 `previousVersion === currentVersion` 時一律回 false。

## 任務
1. 觸發條件改成：
   - 安裝程式結束紀錄的 PTY 數 ≥ 1 → 觸發（不論版本是否相同；`previousVersion === null` 仍不觸發）。
   - 否則維持原規則：版本不同 **且** 孤兒清理 PTY 數 ≥ 1。
   - N 照舊 = 兩者依 id 聯集；agent 分頁照舊經 `buildUpgradeInterruptedSources` → `cause: 'upgrade'`。
2. 同版時的說明文字：notice 帶得出「同版」（例 `previousVersion === currentVersion`，或加一個欄位，選最小改動），toast 改用同版文字（三語），例「BAT 已重新安裝（v0.7.4-pre.7）。安裝時結束了 N 個終端…」；版本不同時文字逐字不變。`[upgrade-interruption] detected:` 日誌可加 `same-version` 之類標記，仍只記版本與數量。
3. 測試：
   - 單元：同版＋安裝程式紀錄 ≥ 1 → 觸發；同版＋只有孤兒 → 不觸發；同版＋紀錄 0 → 不觸發；版本不同的既有案例全部不變。
   - renderer：同版 toast 文字、版本不同 toast 文字不變。
4. 文件：`docs/agent-guide/upgrade-interruption.md` 的觸發條件與判斷表；CLAUDE.md「升級結束終端的提示與說明（PLAN-063 / T0821）」節裡那句觸發條件同步改（只改那一句，保持 3–12 行原則）。

### 驗收條件
- [ ] 上述單元與 renderer 測試通過；既有 upgrade-interruption / installer-quit-request / second-instance-startup 測試不回歸
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：`electron/__tests__/installer-quit-request.test.ts:254` 不在 affects_files，可以改嗎？
- **提問時間**：2026-11-04 14:18 (UTC+8)
- **問題**：該檔第 249 行的測試 `detect: version changed and (orphans ≥ 1 or record ≥ 1); same version / no previous → never` 第 254 行斷言 `previousVersion: '2', currentVersion: '2', installerQuitPtyCount: 3 → false`，正是本單要改掉的舊規則；改完觸發條件後這個斷言必然失敗，但檔案不在 `affects_files`。
- **選項**：
  - A：把該檔加入範圍，只改第 254 行為 `toBe(true)` 並把測試標題改成「same version + record ≥ 1 → detected；same version + orphans only / no previous → never」（另補一行同版＋只有孤兒 → false）。
  - B：不動該檔，該測試失敗留給塔台另開單（驗收「不回歸」與 `test:unit` 全過將無法達成）。
  - 其他。
- **建議**：A。理由：斷言內容是被本單 D278 取代的舊規則，屬本單直接後果；其餘斷言不動。
- **影響**：決定 commit 是否含該檔與 `test:unit` 是否全過。
- **是否阻擋後續步驟**：只阻擋最後的 commit 與驗收；其餘修改先進行。
