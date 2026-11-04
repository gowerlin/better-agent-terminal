---
schema_version: 1
schema_kind: workorder
id: T0841
title: "PLAN-043 W4：connect-test 失敗且網路模式是 NAT 時，提供「改用 Mirrored 並重試」（P-5，含原則檢查與 Running 發行版列表）"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-04T09:17:09+0800"
started_at: "2026-11-04T12:48:05+0800"
updated_at: "2026-11-04T13:06:08+0800"
completed_at: ""
session_ids: []
tower_question: open
depends_on: [T0840]
related:
  - "PLAN-043 Phase 2；D272；T0831 回報區（P-5、〈調查結論〉4、〈建議下一步〉W4）；T0383 / T0653（NAT 一般可用）"
affects_files:
  - _ct-workorders/T0841-wsl-mirrored-retry.md
  - src/components/setup-wizard/
  - electron/wsl-env-apply.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - e2e/v071-pre2-acceptance.spec.ts
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
  - "🔴 只在 connect-test 失敗且實際網路模式 = nat 時出現；有 WSL 網路原則（`AllowNetworkingModeUserSetting=0` / `DefaultNetworkingMode`）或使用者已在 `.wslconfig` 宣告非 mirrored 的 `networkingMode` → 不提供，只提示。同意框列出目前 Running 的發行版（`wsl --shutdown` 會全部關閉）；寫入前備份 `.wslconfig`，用 T0838 編輯器。"
  - "🔴 🔴 本單任何會執行 `wsl --shutdown` 的實測，先停下問塔台（使用者 D272：`--shutdown` 先問）；單元測試一律 mock。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0841 — PLAN-043 W4：改用 Mirrored 並重試

## 元資料
- **工單編號**：T0841｜**類型**：implementation｜**狀態**：IN_PROGRESS｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0840｜**規模**：S

## 任務指令
1. 讀 T0831 回報區 P-5 與〈調查結論〉4。
2. connect-test 錯誤畫面加動作「改用 Mirrored 並重試」→ 小型同意框 → 備份並寫 `.wslconfig` `[wsl2] networkingMode=mirrored` → `wsl --shutdown` → 等 keep-alive 拉起 → 重跑 connect-test。
3. 測試（mock）：條件判斷（nat / 原則 / 使用者已宣告）、同意框內容、寫入與備份、shutdown 後重跑。i18n、docs、`CHANGELOG.md`。
4. 實機 `--shutdown` 實測：先問塔台；未獲同意就列〈待實機驗收〉。
5. **塔台補充（開工前併入，來自 T0840 回報〈遭遇問題〉）**：
   - `e2e/v071-pre2-acceptance.spec.ts`（約 848–877 行）V3 兩項仍斷言舊行為（`wsl1Only` 警告、`systemdDisabled` 警告）；依 T0840 後的新行為更新斷言（只有 WSL1 → 清單提議轉換；systemd 沒開 → 清單提議開啟、沒開成則第 5 步 `wsl-systemd-disabled`）。只改斷言，不必在本單執行整份驗收 spec；能跑就跑並附輸出。
   - 沿用 T0840 的模組：`.wslconfig` 寫入走 `electron/wsl-env-apply.ts`（`WslEnvApplier`）的同一套「先偵測 → 備份 → stdin / 檔案寫入 → 讀回驗證」，同意框沿用 `WizardConsentChecklist.tsx` 的樣式與範圍標籤，不另寫一套。
   - 塔台裁決（不改）：`wsl --set-version` 維持「無法中止」標示（T0840 實測 2.7.14 結束 client 會中斷轉換且發行版完好，但大型發行版中途打斷的安全性未驗證，維持保守）。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：要不要在使用者機器上做實機 `wsl --shutdown` 實測（工單第 4 步）？
- **提問時間**：2026-11-04T13:06:08+0800
- **背景**：產品已完成並 commit（`715c30de`），typecheck ×2 = 0、`test:unit` 全過、`test:legacy` 全過、`vite build` 成功、e2e V3 改後 4 項 PASS；單元測試全程 mock，沒有執行過 `--shutdown`。唯讀查到：本機 `%USERPROFILE%\.wslconfig` **已是** `networkingMode=Mirrored`、沒有 `HKLM\SOFTWARE\Policies\WSL`、唯一發行版 `Ubuntu-24.04`（Stopped）、build 28000。所以 P-5 在這台機器不會自然出現；實測必須先把使用者的 `.wslconfig` 暫改成 NAT。
- **選項**：
  - A：不做實機實測，列〈待實機驗收〉（附步驟），交使用者在同意的時段做。
  - B：做。流程：備份 `.wslconfig` → 暫改 `networkingMode=nat` → `wsl --shutdown`（#1）→ 以 `npx tsx` 直接呼叫 `WslEnvApplier.applyNetworkingMirrored('Ubuntu-24.04')`（寫回 mirrored＋備份、`wsl --shutdown`（#2）、等發行版 Running、`wslinfo` 驗證）→ 比對檔案與備份 → 把 `.wslconfig` 還原成原檔（逐位元比對）。共 **2 次 `--shutdown`**，會關閉所有發行版與 BAT 內的 WSL 分頁 / keep-alive；`Ubuntu-24.04` 會被啟動。不經精靈畫面（精靈需要完整的 WSL profile 流程）。
  - 其他
- **建議**：A。使用者機器已是 Mirrored，實測要先改壞再改回，且兩次 `--shutdown` 會打斷使用者其他 WSL 工作；邏輯已由 mock 單元測試＋e2e 涵蓋。
- **影響**：選 B 需約 2–3 分鐘、兩次全機 WSL 關閉；選 A 則實機驗收留給使用者。
- **是否阻擋後續步驟**：只阻擋第 4 步與收尾；其餘已完成。

### 完成狀態

### 產出摘要

### 互動紀錄

### 待實機驗收

### 遭遇問題

### 回報時間
