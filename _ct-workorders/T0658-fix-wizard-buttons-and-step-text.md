---
schema_version: 1
schema_kind: workorder
id: T0658
title: "BUG-163：設定精靈的選項按鈕 / 輸入框改用 App 既有樣式（不靠 Tailwind）；更正 WSL / SSH / Docker 步驟說明；修完重拍網站的 3 張精靈截圖"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-163
priority: P2
sizing: M
created_at: "2026-10-18T19:47:34+0800"
depends_on: [T0656]
related:
  - "BUG-163；T0656 回報區（`e2e/site-media.spec.ts` 手動執行方式、`e2e-media/` 輸出、stub 精靈資料）；T0652 / BUG-158（精靈 i18n key）；T0646 / T0653（精靈實際步驟與行為的程式碼出處）"
affects_files:
  - "src/components/setup-wizard/SetupWizardShell.tsx"
  - "src/components/setup-wizard/**（只在步驟說明 / 標籤的來源在 step 定義時）"
  - "src/styles/**（新增 / 沿用精靈用的 class；🔴 `src/styles/settings.css` 已有使用者未提交的變更，**不得改這個檔**，需要樣式請放別的檔）"
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json（步驟說明）"
  - "src/components/setup-wizard/__tests__/**、src/locales/__tests__/**（受影響的測試）"
  - "site/public/media/wizard-wsl.png、site/public/media/wizard-ssh.png、site/public/media/wizard-docker.png（重拍後替換）"
  - "e2e/site-media.spec.ts（只在重拍需要微調時）"
  - _ct-workorders/T0658-fix-wizard-buttons-and-step-text.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 樣式：先查 App 其他對話框 / 設定頁現有的按鈕與輸入框 class（例如 ModalOverlay 底下的對話框、Settings 的按鈕），沿用既有 class 或 CSS 變數；**不要引入 Tailwind 或任何新 npm 依賴**。`SetupWizardShell.tsx` 裡所有 Tailwind 寫法（不只按鈕）都要檢查，實際沒作用的一併換掉，列在回報區。深色 / 淺色主題（若 App 支援）都要看。"
  - "🔴 步驟說明：WSL / SSH / Docker 三個精靈的步驟標題與說明逐一對照實際行為（T0653 已更新的 `docs/*-deployment.md` 與程式碼），改成使用者看得懂的文字、不含內部用語（`BAT_AUTH_OK`、probe 等）；三語一致；`data-testid`、step id、日誌、比對字串不動。受影響的 e2e locator 只改檔、不跑（見下）。"
  - "🔴 重拍：修完後 `npx vite build`，再 `BAT_SITE_MEDIA=1 npx playwright test e2e/site-media.spec.ts`（PowerShell：`$env:BAT_SITE_MEDIA='1'; npx playwright test e2e/site-media.spec.ts`），從 `e2e-media/` 取 3 張精靈截圖替換 `site/public/media/wizard-*.png`；其他素材**不替換**（範圍外）。🔴 只准跑 `e2e/site-media.spec.ts` 這一支；跑之前確認沒有其他 Worker 正在跑 Playwright。隔離實例不得改 `USERPROFILE` / `HOME`（T0656：會讓 Electron 取不到 userData）。重拍的 3 張逐張過隱私清單（T0622 § 3-3），回報附檢查表與大小。"
  - "🔴 非隔離工單。T0657（`electron/**` blocked-state、`scripts/bat-hook.mjs`）與 W4 工單（`site/.vitepress/config.mts`、`site/public/og*`、`.github/workflows/pages.yml`）可能同時進行，不碰它們的檔；`npx vite build` 會帶入 T0657 未提交的 electron 變更，只影響截圖用的產物，回報註明拍攝時的 HEAD。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0658 — 精靈按鈕樣式與步驟說明

## 背景

T0656 拍網站截圖時發現：設定精靈的選項按鈕（WSL 發行版、SSH 主機、Docker 容器模式）寫的是 Tailwind class，但 App 沒有載入 Tailwind，實際顯示成白底原生按鈕；步驟說明也過時（SSH 第一步寫要選帳號、port、金鑰、安裝路徑，其實只問主機；第二步寫「執行 BAT_AUTH_OK probe」）。網站 `/remote/` 三頁的精靈截圖因此也拍到這個樣子。詳見 BUG-163。

## 要做的事

1. 盤點 `SetupWizardShell.tsx` 中沒作用的 Tailwind 寫法，改用 App 既有樣式。
2. 更正三個精靈的步驟說明（三語）。
3. 測試：受影響的 unit test 更新；新增至少一個斷言確認選項按鈕不再只有 Tailwind class（或使用了指定的既有 class）。
4. 重拍 3 張精靈截圖並替換網站素材。
5. 截圖（不入版控）：精靈第一步 WSL / SSH / Docker 各一張（修正後），放 `e2e-media/` 或 scratchpad。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數）
- `npx vite build` 成功
- `site/` `npm run build` 0 錯誤 0 死連結

## 驗收

- 精靈按鈕 / 輸入框與 App 一致；步驟說明正確、無內部用語
- 網站 3 張精靈截圖已換成修正後的畫面，隱私檢查通過
- 回報區附：Tailwind 寫法清單與替換、步驟說明前後對照（三語）、隱私檢查表、commit
- 只改 `affects_files`；未 push
