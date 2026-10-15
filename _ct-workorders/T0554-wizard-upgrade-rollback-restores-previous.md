---
schema_version: 1
schema_kind: workorder
id: T0554
title: "BUG-141：WSL / SSH 精靈升級既有 server 後若後段失敗並取消，rollback 恢復升級前的安裝（舊 bundle、原 unit、原 service 狀態），而不是刪光；首次安裝取消行為不變"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-141
priority: P1
sizing: S
created_at: "2026-10-16T03:32:02+0800"
updated_at: "2026-10-16T03:32:02+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.5（與 T0551–T0553 同批）"
depends_on: [T0552]
related:
  - "BUG-141；T0552（`electron/server-bundle-install-script.ts` 暫存目錄 + 換名、port 沿用時先停舊 service）；T0489（install rollback gate）"
affects_files:
  - electron/server-bundle-install-script.ts
  - electron/wsl-detect.ts
  - electron/wsl-systemd.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/ssh-bundle-uploader.ts
  - "src/components/setup-wizard/steps/wsl/**、src/components/setup-wizard/steps/ssh/**（install / systemd / enable 步驟的 rollback；列出實際檔案）"
  - "electron/__tests__/**、src/components/setup-wizard/__tests__/**、electron/remote/__tests__/**（新增 / 更新測試）"
  - "e2e/t0550-wsl-acceptance.spec.ts（僅加 env 開關情境，預設行為不變）"
  - "CLAUDE.md / docs/wsl-deployment.md（升級與取消行為描述）"
  - _ct-workorders/T0554-wizard-upgrade-rollback-restores-previous.md
  - _ct-workorders/BUG-141-wizard-rollback-removes-upgraded-install.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 T0553（Worker 分頁標題，`src/stores/workspace-store.ts`、`TerminalThumbnail.tsx` 等）在你之前或同時進行；不要動它的檔案；若 HEAD 上有它的變更，以 HEAD 為準。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 WSL 實機條件同 T0552：`Ubuntu-24.04` server 結束時必須仍在 **9877**、憑證指紋不變、service active、版本為驗證前的版本；動之前先備份（路徑寫進回報區），不要刪 T0550 / T0552 的既有備份。模擬「後段失敗」時用測試注入或隔離實例，不要改壞使用者的 profile。"
  - "🔴 刪除仍只限 T0552 的白名單（`<root>.bat-new`、`<root>.bat-old`、bundle 安裝的 root），路徑防呆不得放寬。"
---

# T0554 — BUG-141：升級後段失敗取消時恢復舊安裝

## 背景

T0552 讓「重跑精靈」成為正式的升級路徑：沿用 port / profile（必要時先停舊 service），安裝改成「解到 `<root>.bat-new` → 舊樹換名 `<root>.bat-old` → 新樹換入 → 刪 `.bat-old`」。T0552 回報的殘餘風險 1：install 成功之後，若後段步驟失敗、使用者取消，`install-server-bundle` 的 rollback（T0489）會 `uninstallBundle` 刪掉整個安裝目錄，這時舊版已經被刪，使用者原本能用的 server 就不見了（BUG-141）。

## 任務

1. 先確認實際行為（測試重現：升級 → install 成功 → 後段步驟失敗 → rollback 執行的動作）。WSL 與 SSH 兩條都確認。
2. 修正（做法由你決定並說明取捨），目標：
   - **升級情境**取消：恢復升級前的 bundle（例如保留 `.bat-old` 直到精靈完成，rollback 換回）、原 unit 內容，並把 T0552 停掉的舊 service 重新啟動，狀態與升級前一致。
   - 精靈**成功完成**時清掉保留的舊樹（不留 `.bat-old`）；中途 BAT 關閉等異常結束時，下次安裝要能安全處理殘留的 `.bat-old`（不得誤刪使用者資料）。
   - **首次安裝**取消：行為不變（照舊移除）。
   - SSH 精靈若同病，同樣處理。
3. 測試：單元（升級取消恢復、首次安裝取消移除、成功清除、殘留 `.bat-old` 處理、白名單與路徑防呆不放寬、SSH 對應）；真 `sh` + `tar` 實跑（沿用 T0552 `server-bundle-install-script.test.ts` 做法）。
4. WSL 實機（條件見 memory_overrides）：以測試注入或擴充 `e2e/t0550-wsl-acceptance.spec.ts` 開關，讓精靈在 install 之後的步驟失敗並取消 → 驗證 server 仍為升級前版本、9877、active、指紋不變；再跑一次正常升級確認無 `.bat-old` 殘留、smoke 13/13。
5. 更新 `docs/wsl-deployment.md` / `CLAUDE.md` 的升級與取消描述；BUG-141 → FIXED。

## 驗收條件

- [ ] 升級後段失敗取消：恢復舊 bundle、原 unit、舊 service active（WSL 實機 + 單元；SSH 至少單元）
- [ ] 首次安裝取消行為不變；成功完成不留 `.bat-old`
- [ ] `npm run test:unit` 全綠（基線 4211 passed / 247 files，加上新測試；若 T0553 先合入以 HEAD 為準）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] WSL 結束狀態：9877、指紋不變、active、smoke 13/13
- [ ] BUG-141 → FIXED

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
