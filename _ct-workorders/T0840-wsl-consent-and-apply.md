---
schema_version: 1
schema_kind: workorder
id: T0840
title: "PLAN-043 W3：精靈「一次同意」清單＋ `plan-wsl-environment` / `apply-wsl-environment`（P-1 WSL2 轉換、P-2 systemd、P-3 預設使用者、P-4 linger）＋ `wsl-systemd-check` 改驗證"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: L
created_at: "2026-11-04T09:17:09+0800"
started_at: ""
updated_at: "2026-11-04T09:17:09+0800"
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
- **工單編號**：T0840｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0839、T0830（runner AbortSignal、Shell 中止 UI 同檔）、T0835（同改 locales）
- **規模**：L｜**降級**：先完成 runner `requestConsent`＋清單 UI＋P-2（systemd），P-1 / P-3 可回 PARTIAL 由塔台另開

## 任務指令
1. 讀 T0831 回報區（全文），依〈調查結論〉2 實作流程位置、`requestConsent`、checklist、`apply-wsl-environment`、錯誤碼、失敗處理與可逆性、中止（`--set-version` 標「無法中止」）。
2. P-2 `--terminate` 是否足以讓 systemd 生效：在拋棄式發行版實測；不足時依 T0831 設計另列「`wsl --shutdown`」單獨同意項（實測前先問塔台）。
3. i18n、`docs/wsl-deployment.md`、`CHANGELOG.md` `[Unreleased]`。
4. 測試：runner `requestConsent`（比照 `wizard-runner.transitions.test.ts`）、checklist RTL、apply 各項（mock）、0 項不回歸、SSH / Docker 精靈不回歸、`npm run test:legacy` 的 WSL 精靈測試。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [ ] 拋棄式發行版實測紀錄（P-1 / P-2 / P-3 / 中止），測完已 unregister
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
