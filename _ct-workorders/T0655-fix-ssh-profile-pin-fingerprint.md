---
schema_version: 1
schema_kind: workorder
id: T0655
title: "BUG-160：SSH 設定停用「重新釘選指紋」（不經通道會釘到本機其他伺服器、送錯權杖）；`handlePinFingerprint` 防禦性拒絕 SSH 設定"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-160
priority: P2
sizing: S
created_at: "2026-10-18T19:12:43+0800"
depends_on: [T0652]
related:
  - "BUG-160（T0652 程式碼追蹤）；T0650 / BUG-157（`handlePinFingerprint`、`editPinning` / `editPinError`、`profile-panel-pin-fingerprint.test.tsx`）；T0652 / BUG-158（`profiles.fingerprint.*` i18n key）；CLAUDE.md「Remote 資安」節"
  - "網站 `site/remote/index.md` `#fingerprint` 已寫「SSH 的設定請重跑設定精靈」，本單不改 `site/**`"
affects_files:
  - src/components/ProfilePanel.tsx
  - src/components/profiles/EditRemoteProfileModal.tsx
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json（只新增停用說明的 key）"
  - "src/components/__tests__/profile-panel-pin-fingerprint.test.tsx（擴充）、src/locales/__tests__/i18n-completeness.test.ts（只在新增 key 需要時）"
  - "docs/agent-guide/remote-security.md（補一句 SSH 設定的行為）"
  - _ct-workorders/T0655-fix-ssh-profile-pin-fingerprint.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先確認根因：讀 `handlePinFingerprint` 與 SSH 設定的 `remoteHost` / `remotePort` / tunnel 欄位，確認釘選確實不經通道；用測試重現「SSH 設定按釘選 → 對 `localhost:<remotePort>` 呼叫 `remote.testConnection`」。確認不是 bug（例如已經走通道）→ 不改程式碼，回報 `FAILED` 附證據。"
  - "🔴 修正範圍：SSH 設定（以設定的類型 / transport 判斷，不靠 host 字串）在「編輯連線」對話框停用釘選按鈕，旁邊顯示說明（新增 i18n key，三語，例如 zh-TW「SSH 的設定請重跑設定精靈更新指紋」）；`handlePinFingerprint` 對 SSH 設定直接拒絕、不呼叫 `testConnection`。WSL / Docker / 舊版遠端設定的釘選行為不變（T0650 的測試全部照過）。不做「改走通道」。"
  - "🔴 安全不變式：不改 `remote-client.ts` 的連線順序；不讓任何連線流程自動接受新指紋。"
  - "🔴 i18n：新 key 三語齊全，`i18n-completeness` 測試通過；不改 T0652 已定的既有字串。"
  - "🔴 非隔離工單。T0654（改 `scripts/smoke-remote-headless.mjs` 等）與 W3 工單（`e2e/**`、`site/**`、`README.md`、`assets/**`）可能同時進行，不碰它們的檔。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。🔴 不要執行 Playwright e2e（`playwright.config.ts` 的 `outputDir` 是 `e2e-results`，每次執行會清空它，W3 工單的素材在那裡）。"
---

# T0655 — SSH 設定停用重新釘選指紋

## 背景

T0652 發現：「編輯連線」的「重新釘選指紋」（`handlePinFingerprint`）以設定的 `remoteHost:remotePort` 直接連線、不經 SSH 通道。SSH 設定的 `remoteHost` 是 `localhost`、`remotePort` 是遠端主機上的埠；若本機剛好有別的 BAT 伺服器聽在同一埠，會把那台的指紋釘進 SSH 設定，並把 SSH 設定的權杖送給它（釘選是 TOFU）。詳見 BUG-160。

## 要做的事

1. 確認根因並寫重現測試。
2. SSH 設定停用釘選按鈕並顯示說明；`handlePinFingerprint` 防禦性拒絕 SSH 設定。
3. 測試：SSH 設定按鈕停用、說明顯示、`testConnection` 不被呼叫；WSL / Docker 釘選照舊（T0650 測試照過）。
4. `docs/agent-guide/remote-security.md` 補一句。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數）
- `npx vite build` 成功

## 驗收

- SSH 設定無法經「重新釘選指紋」送出權杖；其他設定類型不變
- 三項驗證通過；回報區附根因確認、修正說明、測試清單、commit
- 只改 `affects_files`；未 push
