---
schema_version: 1
schema_kind: workorder
id: T0840
title: "PLAN-043 W3：精靈「一次同意」清單＋ `plan-wsl-environment` / `apply-wsl-environment`（P-1 WSL2 轉換、P-2 systemd、P-3 預設使用者、P-4 linger）＋ `wsl-systemd-check` 改驗證"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: L
created_at: "2026-11-04T09:17:09+0800"
started_at: "2026-11-04T12:15:20+0800"
updated_at: "2026-11-04T12:15:20+0800"
completed_at: ""
session_ids: []
depends_on: [T0839, T0830, T0835]
related:
  - "PLAN-043 Phase 2；D272；T0831 回報區（〈調查結論〉2 全節、4、5，〈建議下一步〉W3）；T0830（step abort）；T0838 / T0839"
affects_files:
  - _ct-workorders/T0840-wsl-consent-and-apply.md
  - src/components/setup-wizard/
  - electron/wsl-env-apply.ts
  - electron/wsl-systemd.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - docs/wsl-deployment.md
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
tower_question: open
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 使用者裁決（D272）：精靈取消時**不還原**已套用的環境修正，保留備份並在 done / 取消畫面列出「已變更項目＋備份位置」；P-6 不做。環境都正常時（0 項）不顯示清單、精靈行為除多兩個瞬間完成的步驟外不變；新步驟 `appliesTo: ['wsl-linux']`，SSH / Docker 不受影響。"
  - "🔴 本機實測（使用者 D272 同意）：只可用**拋棄式發行版**（`wsl --import BAT-T-0840-<用途> <scratchpad 內目錄> <rootfs> --version 1` 之類），測完 `wsl --unregister` 該拋棄式發行版；🔴 不得改、停或重啟使用者既有的發行版（`Ubuntu-24.04`）；任何 `wsl --shutdown` 先停下問塔台（塔台轉問使用者時段）。rootfs 來源要是官方映像，下載放 scratchpad、收尾刪除。"
  - "🔴 內容寫入（`/etc/wsl.conf`、密碼等）一律走 stdin，不放 argv、不寫 log；寫入前備份；每項修正冪等、執行前重新偵測、執行後重新驗證（不信 exit code）。Dialog 照 CLAUDE.md（ModalOverlay＋`onEscape`，新 Dialog 進 `dialog-escape.test.tsx` 規則）；日誌走 logger / `debug.log`，順便改掉 `wsl-flow.ts` 的 `console.*`。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0840 — PLAN-043 W3：一次同意＋自動修正

## 元資料
- **工單編號**：T0840｜**類型**：implementation｜**狀態**：IN_PROGRESS｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0839、T0830（runner AbortSignal、Shell 中止 UI 同檔）、T0835（同改 locales）
- **規模**：L｜**降級**：先完成 runner `requestConsent`＋清單 UI＋P-2（systemd），P-1 / P-3 可回 PARTIAL 由塔台另開

## 任務指令
1. 讀 T0831 回報區（全文），依〈調查結論〉2 實作流程位置、`requestConsent`、checklist、`apply-wsl-environment`、錯誤碼、失敗處理與可逆性、中止（`--set-version` 標「無法中止」）。
2. P-2 `--terminate` 是否足以讓 systemd 生效：在拋棄式發行版實測；不足時依 T0831 設計另列「`wsl --shutdown`」單獨同意項（實測前先問塔台）。
3. i18n、`docs/wsl-deployment.md`、`CHANGELOG.md` `[Unreleased]`。
4. 測試：runner `requestConsent`（比照 `wizard-runner.transitions.test.ts`）、checklist RTL、apply 各項（mock）、0 項不回歸、SSH / Docker 精靈不回歸、`npm run test:legacy` 的 WSL 精靈測試。
5. **T0839 交接**（塔台 2026-11-04 11:58 併入，見 T0839 回報區〈產出摘要〉與〈遭遇問題〉）：
   - 計畫來源：IPC `wsl:detect-facts` → `buildWslEnvPlan(facts)`（`src/components/setup-wizard/wsl-env-plan.ts`）；item / notice 形狀照該檔，不另寫判斷。
   - `wizard.wsl.plan.*` 的 i18n 字串**尚未加**（en / zh-TW / zh-CN），本單補齊，並把這些 key 加進 `i18n-completeness.test.ts` 的檢查清單。
   - 探測會冷啟動 Stopped 的發行版（實測約 7 s）：plan 步驟要顯示進行中狀態、可被 T0830 的中止打斷。
   - systemd 判斷：facts 用 `/proc/1/comm`，既有 `wsl-systemd-check` 用 `systemctl --user is-system-running`。把 `wsl-systemd-check` 改成驗證時決定是否統一，寫進回報。
   - P-3（root）、P-7（WSL 太舊）、`AllowWSL=0`、WSL 未安裝只出提示（notice），不出可勾項目。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [ ] 拋棄式發行版實測紀錄（P-1 / P-2 / P-3 / 中止），測完已 unregister
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：legacy 精靈測試寫死「9 個步驟」，可否改 `tests/` 底下的 WSL 精靈測試與共用 mock？
- **提問時間**：2026-11-04T12:18:54+0800
- **背景**：本單在 WSL 流程加 `plan-wsl-environment` / `apply-wsl-environment` 兩步（9 → 11）。`npm run test:legacy` 的 `tests/wsl-wizard-e2e.test.ts:26`、`tests/wizard-runner.test.ts:72,89,116` 斷言 `snapshots.length === 9`；共用 mock `tests/__mocks__/electron-api.ts` 沒有 `wsl.detectFacts` 與新的 apply / systemd 驗證 IPC。`tests/` 不在 `affects_files`。
- **選項**：
  - A：放行改這 3 個檔（WSL 步驟數 9 → 11、測試名稱跟著改；mock 補 `detectFacts`（預設回健康環境 → 0 項）、`applyEnvItem`、`systemdRunning`）。Docker 的兩個 `length, 9` 不動。
  - B：不改 `tests/`，產品端在 IPC 不存在時退回舊行為（plan 當 0 項、systemd 驗證退回 `systemdEnabled`）；但步驟數斷言仍會失敗 → `test:legacy` 不會全過。
  - 其他
- **建議**：A。步驟數改變是本單規格的直接結果；mock 只補 IPC、不改既有斷言的意思。
- **影響**：選 B 則驗收條件「`npm run test:legacy` 全過」無法達成。
- **是否阻擋後續步驟**：不阻擋實作，只阻擋最後的 `test:legacy` 驗收與 commit。

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
