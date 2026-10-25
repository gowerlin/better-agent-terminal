---
schema_version: 1
schema_kind: workorder
id: T0655
title: "BUG-160：SSH 設定停用「重新釘選指紋」（不經通道會釘到本機其他伺服器、送錯權杖）；`handlePinFingerprint` 防禦性拒絕 SSH 設定"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-160
priority: P2
sizing: S
created_at: "2026-10-18T19:12:43+0800"
started_at: "2026-10-18T19:14:49+0800"
updated_at: "2026-10-18T19:19:47+0800"
completed_at: "2026-10-18T19:19:47+0800"
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

## 回報區

### 結果摘要

FIXED。根因確認屬實：SSH 設定在「編輯連線」按「重新釘選指紋」時，`handlePinFingerprint` 直接以 `remote.testConnection('localhost', <remotePort>, <SSH 設定權杖>, undefined)` 連線，不經 SSH 通道。已改為 SSH 設定停用按鈕並顯示說明，`handlePinFingerprint` 對 SSH 設定直接返回、不連線；WSL / Docker / 舊版遠端設定照舊。

### Landing check

PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（affects_files 皆存在）；C-2 無 branch 欄位。`CT_HOME` 未設（非隔離）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 根因確認

- SSH 設定由精靈寫入 `remoteHost: 'localhost'`、`remotePort` = 遠端主機上的伺服器埠、`useSshTunnel: true`（`src/components/setup-wizard/steps/wsl/write-profile.ts` SSH 分支）；實際連線一律經通道（`resolveSshTunnelUse`，`electron/remote/remote-client.ts`；`isProbeableRemoteProfile` 也因同一原因不探測 SSH 設定）。
- `handlePinFingerprint`（`src/components/ProfilePanel.tsx`）以 `profile.remoteHost` / `remotePort` / `remoteToken` 呼叫 `remote.testConnection`；main 的 `remote:test-connection`（`electron/main.ts`）以 `new RemoteClient(...).connect(host, port, token, undefined, fingerprint)` 直連，無通道。fingerprint 傳 `undefined` → TOFU，接受本機該埠上任何伺服器並送出權杖。
- 修正前重現（新測試「handlePinFingerprint refuses an SSH profile even when the button fires」對未修改的程式碼）：`testConnection` 被呼叫 1 次，參數 `["localhost", 9876, "tok-s", undefined]`。

### 修正說明

- `src/components/profiles/EditRemoteProfileModal.tsx`：新增 `cannotPinDirectly(profile)`（以 `targetOS` 為 `ssh-linux` / `ssh-darwin` 判斷，不看 host 字串）；SSH 設定的「重新釘選指紋」按鈕 `disabled`、title 改為說明，按鈕下方顯示說明文字。
- `src/components/ProfilePanel.tsx`：`handlePinFingerprint` 開頭 `if (cannotPinDirectly(profile)) return`（不呼叫 `testConnection`、不寫入、不改 pinning 狀態）。
- i18n 新增 `profiles.fingerprint.pinSshDisabled`（三語）：en「SSH profiles connect through an SSH tunnel. Re-run the Setup Wizard to update the fingerprint.」/ zh-TW「SSH 的設定經 SSH 通道連線，請重跑設定精靈更新指紋。」/ zh-CN「SSH 的配置通过 SSH 通道连接，请重新运行设置精灵更新指纹。」；既有字串未改。`i18n-completeness.test.ts` 不需修改（照過）。
- `docs/agent-guide/remote-security.md`：ProfilePanel UI 條目補 SSH 設定行為一句。
- 未改 `remote-client.ts` 連線順序；沒有任何流程自動接受新指紋。未做「改走通道」。

### 測試清單（`src/components/__tests__/profile-panel-pin-fingerprint.test.tsx`，新 describe「Edit connection: no pin for SSH profiles (BUG-160)」）

- `ssh-linux` / `ssh-darwin`：按鈕停用、說明顯示、點擊後 `testConnection` 與 `profile.update` 皆未呼叫、指紋欄位不變；儲存保留精靈的指紋。
- 繞過 disabled 直接觸發 onClick：`handlePinFingerprint` 仍不呼叫 `testConnection`（修正前此測試失敗，即上方重現）。
- `wsl-linux` / `docker-linux`：按鈕可用、無說明、釘選照舊（`testConnection('localhost', port, token, undefined)` + 寫入新指紋）。
- T0650 原有 6 個測試全部照過。本檔 11 passed。

### 驗證（validated_sha 基準 `2a422270`，驗證時變更尚未提交）

- `npm run typecheck`：exit 0（0 errors）PASS
- `npm run typecheck:electron`：exit 0（0 errors）PASS
- `npm run test:unit`：Test Files **314 passed (314)**、Tests **5451 passed | 3 skipped (5454)** PASS（輸出中的 `Error: AttachConsole failed` 是既有的 node-pty stderr 雜訊，非失敗）
- `npx vite build`：exit 0 PASS
- 未執行 Playwright e2e（依工單）。

### 變更檔案

- `src/components/ProfilePanel.tsx`
- `src/components/profiles/EditRemoteProfileModal.tsx`
- `src/components/__tests__/profile-panel-pin-fingerprint.test.tsx`
- `src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`
- `docs/agent-guide/remote-security.md`

### Commit

- `02f1c6f8` fix(profiles): disable fingerprint pin for SSH profiles (T0655, BUG-160)（`git commit --only`，未 push）
- 工單本身另一個 commit（本回報）。
- 未碰：`src/styles/settings.css`、`_ct-workorders/T0656-site-w3-media.md`、`e2e-media/`、`e2e/site-media.spec.ts`（他人變更）。

### 偏離 / 遭遇問題

- 無偏離。`cannotPinDirectly` 放在 `EditRemoteProfileModal.tsx` 並由 ProfilePanel 直接 import（未改 `profiles/index.ts` barrel，以留在 affects_files 內）。

### 後續建議（不在本單範圍）

- 「編輯連線」的「取得設定檔」（`handleFetchEditRemoteProfiles`）對 SSH 設定同樣以 `remoteHost:remotePort` 直連。指紋已釘選時 `remote-client.ts` 先比對指紋（`fingerprint-mismatch`）才送 `auth`，權杖不會外洩；但指紋欄位為空時會走 TOFU 並把觀察到的指紋填入對話框（按儲存才寫入）。SSH 設定由精靈寫入時一定帶指紋，風險低，塔台可評估是否另開單一併停用。

### 互動紀錄

無（yolo，未向塔台提問）。
