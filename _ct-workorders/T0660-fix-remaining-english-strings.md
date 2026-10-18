---
schema_version: 1
schema_kind: workorder
id: T0660
title: "BUG-161：精靈 step 原始錯誤訊息、復原警告、縮圖列 `suggested`、「Set as Supervisor」改走 i18n；modal 關閉鈕補 `aria-label`；評估顯示選項 description"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-161
priority: P2
sizing: M
created_at: "2026-10-18T20:24:09+08:00"
depends_on: [T0652, T0658]
related:
  - "BUG-161（T0652 回報區「範圍外英文字樣」1–6、T0656 補第 6 點）；T0652（遠端畫面 i18n 的作法、`i18n-completeness.test.ts` 的 T0652 區塊、error-mapper entry 形式）；T0658（`SetupWizardShell.tsx` 已改用 `.bat-wizard-*` / `profile-action-btn`）"
  - "使用者 2026-10-18 20:2x 決定：放進 `0.7.1-pre.2`，修完再發版"
affects_files:
  - "src/components/setup-wizard/**（step 錯誤訊息改成帶 code / key、error-mapper entry、`wizard-runner.ts` 復原警告、`SetupWizardShell.tsx` 顯示選項 description（若決定顯示））"
  - "src/components/ThumbnailBar.tsx（`suggested`、「Set as Supervisor」等縮圖列 / 右鍵選單字樣）"
  - "src/components/**（只限各 modal `&times;` 關閉鈕補 `aria-label`；用既有 `common.close` key）"
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json"
  - "src/**/__tests__/**、src/locales/__tests__/**、src/components/setup-wizard/__tests__/**（受影響的測試）"
  - "e2e/**（只改以文字定位、因本單失效的 locator；不改流程）"
  - _ct-workorders/T0660-fix-remaining-english-strings.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍以 BUG-161 第 1–6 點為準；開工先 grep 列出最終清單（位置 → 原文 → key / code → zh-TW / zh-CN / en）寫進回報區。第 7 點（`systemd (user)`、`launchd`、`tunnel → localhost:<port>`、`default` 等技術值）不譯。其他功能的英文字樣只列清單給塔台、不改。"
  - "🔴 **step 原始錯誤訊息**：這些字串同時用於日誌與部分測試比對。作法：step 丟出的錯誤帶穩定的 `code`（沿用既有 error-mapper 的 `errorCodes` 機制），error-mapper 依 code 選三語 title / body（必要時帶參數，例如容器名、發行版名）；**日誌與 `Error.message` 保持英文原文**（比對用、除錯用），只有使用者看到的畫面改走 i18n。`error-mapper.test.ts` 的三語齊全規則要過。不得改 step id、錯誤 code 的既有值、`data-testid`。"
  - "🔴 復原警告（`wizard-runner.ts`）：含 step title 的句子改用 i18n 參數；step title 取 i18n label（`labelKey`），沒有 key 時退回英文 title。"
  - "🔴 選項 description（BUG-161 第 5 點）：評估在 `SetupWizardShell` 顯示 `WizardChoiceOption.description`（樣式用 T0658 的 `.bat-wizard-*` 或既有 class，不引入 Tailwind / 新依賴）；若會讓版面變差或需要設計決定，就不顯示、在回報說明。"
  - "🔴 `aria-label`：各 modal 的 `&times;` 關閉鈕補 `aria-label={t('common.close')}`；只加屬性，不改行為。🔴 Dialog 規則（CLAUDE.md「Dialog 不因點擊外部關閉、Esc 統一」）不變。"
  - "🔴 測試：`i18n-completeness` 三語 key 一致；error-mapper 新 entry；以文字定位的 unit / e2e 測試同步更新（e2e 只改檔；改完跑 `npx vite build` 後只跑受影響的 e2e spec，並確認沒有其他 Worker 在跑 Playwright）。不耗 token。"
  - "🔴 非隔離工單（目前沒有其他 Worker 在跑）。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0660 — 剩下的英文字樣（BUG-161）

## 背景

T0652 把遠端設定畫面的英文字樣改走 i18n，範圍外還留著：精靈 step 直接丟出的英文錯誤訊息（沒有 error-mapper entry 時原樣顯示）、`wizard-runner.ts` 的復原警告、縮圖列「+」選單的 `suggested`、縮圖右鍵選單的「Set as Supervisor」、modal 關閉鈕缺 `aria-label`、精靈不顯示選項 description。使用者決定放進 `0.7.1-pre.2` 一起發。詳見 BUG-161。

## 要做的事

1. 盤點並列最終清單。
2. 依 memory_overrides 逐項改：step 錯誤訊息（code + error-mapper）、復原警告、縮圖列字樣、`aria-label`、選項 description（評估）。
3. 測試與受影響的 e2e。
4. 截圖（不入版控，放 scratchpad）：zh-TW 介面的縮圖列「+」選單、右鍵選單，與至少一個精靈錯誤畫面（可用 unit test 的 render 或隔離實例；隔離實例不得改 `USERPROFILE` / `HOME`）。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數；基線 315 / 5467）
- `npx vite build` 成功；受影響的 e2e spec 通過

## 驗收

- BUG-161 第 1–6 點處理完（或寫明不處理的理由）；日誌與 `Error.message` 仍是英文
- 驗證全過；回報區附字串清單、範圍外英文清單（給塔台）、截圖清單、commit
- 只改 `affects_files`；未 push
