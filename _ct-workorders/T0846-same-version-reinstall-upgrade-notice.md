---
schema_version: 1
schema_kind: workorder
id: T0846
title: "同版重裝也提示：有安裝程式結束紀錄時，版本相同也顯示「安裝時結束了 N 個終端」並列出被中斷的 agent 分頁"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-063
priority: P2
sizing: S
created_at: "2026-11-04T14:16:11+0800"
started_at: "2026-11-04T14:18:00+0800"
updated_at: "2026-11-04T14:24:33+0800"
completed_at: "2026-11-04T14:24:33+0800"
session_ids:
  - "e57c7b18-4d82-44db-8406-d685298c9172"
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
- **工單編號**：T0846｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 14:16 (UTC+8)
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

#### Q-2：`installer-quit-request.test.ts:284`「同版（安裝在 BAT 結束後被取消）→ 不提示」怎麼處理？同版文字要不要寫成取消安裝也成立的說法？
- **提問時間**：2026-11-04 14:21 (UTC+8)
- **問題**：T0823 寫了一個案例：安裝程式請 BAT 結束後使用者取消安裝，BAT 重開仍是同版、但有安裝程式結束紀錄 → 原本「不提示」。這與「同版重裝」在紀錄上無法區分（紀錄只有結束時的版本與 PTY）。依 D278 新規則它會觸發，該斷言（第 289–291 行）必然失敗；Q-1 答覆說同檔其他斷言不動，所以需要裁示。另外，同版文字若寫「BAT 已重新安裝」，在取消安裝的情況下不正確。
- **選項**：
  - A：照 D278 觸發（終端確實被安裝程式結束了，列出 agent 分頁仍有用）；把第 284 行測試改成「同版＋紀錄 → 觸發（同版重裝或取消安裝）」，空紀錄那半段不動；同版文字改成兩種情況都成立的說法，例「安裝程式結束了 BAT（v{{version}}）與 {{count}} 個終端，包括其中執行中的指令與 agent；分頁已用新的 shell 重新開啟。」
  - B：照 A 觸發與改測試，但同版文字照工單範例「BAT 已重新安裝（v…）。安裝時結束了 N 個終端…」（取消安裝時文字不精確，接受）。
  - C：改成只在能確認真的有安裝時才觸發（需要安裝程式寫額外標記，超出本單範圍，另開單）；本單先維持該案例不觸發。
  - 其他。
- **建議**：A。理由：觸發符合 D278，且取消安裝時終端也確實被結束；中性文字避免在取消安裝時說錯。
- **影響**：該測試斷言與三語同版文字。
- **是否阻擋後續步驟**：只阻擋 commit 與驗收；目前已先用「BAT 已重新安裝」草稿文字。

### 互動紀錄
- [14:20] Q-1: installer-quit-request.test.ts:254 不在 affects_files，可以改嗎？ → A（塔台，BAT 通道）: 加入範圍，只改該斷言為 true、改測試標題，補「同版＋只有孤兒 → false」；同檔其他斷言不動；回報區〈範圍調整〉記一行 → Action: 照做（待 Q-2 一併處理同檔第 284 行）
- [14:22] Q-2: 同版＋安裝程式紀錄（含取消安裝）怎麼處理、同版文字 → A（塔台，BAT 通道）: 照 D278 觸發；第 284 行案例改成「同版＋紀錄 ≥ 1 → 觸發」、空紀錄半段不動；同版文字中性「安裝程式結束了 BAT（v{{version}}）與 {{count}} 個終端…」三語同義；docs 判斷表註明兩者無法區分、都提示 → Action: 照做

### 完成狀態
- **狀態**：DONE
- **session_id**：e57c7b18-4d82-44db-8406-d685298c9172
- **落點檢查**：PASS（C-0 `repo: better-agent-terminal` = `basename` `better-agent-terminal`；C-1 工單在 repo 內；C-3 affects_files 皆存在；C-2 無 `branch` 欄位；`CT_HOME` 未設、非 worktree；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`）
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_REMOTE_TOKEN` 已設定

### 結果摘要
- `detectUpgradeInterruption`：沒有上次版本 → 不觸發；安裝程式結束紀錄 PTY ≥ 1 → 觸發（版本相同也算）；否則版本不同＋孤兒 ≥ 1 才觸發。同版只有孤兒（當機）、同版空紀錄仍不觸發。N、`buildUpgradeInterruptedSources`、`cause: 'upgrade'` 不變。
- notice 形狀不變；「同版」由 `previousVersion === currentVersion` 判斷（最小改動，不加欄位）。`[upgrade-interruption] detected:` 版本相同時結尾加 ` same-version`（仍只記版本與數量）。
- renderer：`upgradeNoticeToastKey(notice)`（`src/components/ServerStatusToast.tsx`）選 key；同版 `UPGRADE_REINSTALLED_TOAST_KEY` = `app.upgradeReinstalled`（`count` / `version`，三語中性文字，依 Q-2），版本不同 `app.upgradeInterrupted` 逐字不變；同版 toast 照樣顯示「N 個 agent 分頁已中斷」一行並可點開清單。
- `electron/main.ts` 不需改（`begin` / `noteInstallerQuit` / `finish` 的接線已涵蓋同版），未動。

### 範圍調整
- 依 Q-1（塔台答 A）／Q-2（塔台答 A）加入 `electron/__tests__/installer-quit-request.test.ts`：只改第 249 行測試的標題與第 254 行斷言（→ `true`），補一行「同版＋只有孤兒 → false」；第 284 行案例改成「同版＋紀錄 ≥ 1 → 觸發」（空紀錄半段不動）。同檔其他斷言未動。

### 修改檔案
- `electron/upgrade-interruption.ts`、`src/components/ServerStatusToast.tsx`、`src/App.tsx`、`src/locales/{en,zh-TW,zh-CN}.json`
- 測試：`electron/__tests__/upgrade-interruption.test.ts`、`electron/__tests__/installer-quit-request.test.ts`、`src/components/__tests__/upgrade-interruption.test.tsx`
- 文件：`docs/agent-guide/upgrade-interruption.md`（判斷表、兩種同版來源說明、同版文字、日誌表、驗證清單）、`CLAUDE.md`「升級結束終端的提示與說明（PLAN-063 / T0821）」節只改觸發條件那一句

### 驗證
- 單元（新增）：同版＋紀錄 ≥ 1 → 觸發（含＋孤兒）；同版＋只有孤兒 → 不觸發；同版＋紀錄 0 → 不觸發；無上次版本＋紀錄 → 不觸發；`UpgradeInterruptionCheck` 同版＋紀錄 → notice 兩版本相同、日誌 `source=installer+orphans same-version`、不含 session id；同版＋空紀錄＋孤兒 → 無 notice、無日誌。版本不同的既有案例全部未改且通過。
- renderer（新增）：`upgradeNoticeToastKey` 兩種結果；同版 toast 三語文字與 locale 逐字相同、不含 `→` / `{{`、有 agent 行；版本不同 toast 三語與 `upgradeInterrupted_other` 逐字相同；locale 檢查 `upgradeReinstalled_*` 含 `{{count}}` / `{{version}}`；App.tsx source guard 改為 `messageKey={upgradeNoticeToastKey(upgradeNotice)}`。
- `upgrade-interruption`（electron＋renderer）/ `installer-quit-request` / `second-instance-startup`：80 passed。
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`：435 files passed / 3 skipped、7740 tests passed / 40 skipped、`npx vite build` 成功（皆於 `2d11fe8c` 工作樹＋本單未提交變更上執行，提交內容與執行時相同）。
- 實機（同版重裝 → toast）未跑：需安裝版，屬塔台／使用者驗收。

### Commit
- 產品：`9e966f98` fix: T0846 same-version reinstall shows the upgrade-interruption notice（只含上列 11 檔）
- 工單：`8c8a1362`（開工＋Q-1）、`4b0ca92f`（Q-1 答覆＋Q-2）、本次收尾 commit
- 未 push、未發版

### 遭遇問題
- Q-2 的「提問時間」寫 14:21，實際系統時間取值為 14:20:52（先寫題目後取時間）；題目已送出，未改。

### 後續建議
- `InterruptedAgentsDialog` 的 `interruptedAgents.upgradeTitle` / `upgradeDesc`（「升級結束的 agent 分頁」「安裝新版時結束了…」「接續升級前的對話」）在同版重裝／取消安裝時字面上不精確；不在本單 affects_files，未動。是否改成中性說法由塔台決定。
