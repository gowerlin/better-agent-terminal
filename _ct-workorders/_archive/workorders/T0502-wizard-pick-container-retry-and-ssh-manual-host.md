---
schema_version: 1
schema_kind: workorder
id: T0502
title: "Setup wizard：pick-container 選「Use existing」但無容器時 retry 卡死（containerMode 驗證通過後才寫入）+ configure-ssh-host 無 alias 時無法手動輸入 host"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-13T23:41:46+08:00"
started_at: "2026-10-14T00:02:17+08:00"
updated_at: "2026-10-14T00:12:24+08:00"
completed_at: "2026-10-14T00:12:24+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0500"
  - "T0491"
related:
  - "T0500 回報區「觀察」1：第一次執行 `pick-container` 選「Use existing」但沒有容器 → 失敗後 retry 因 `containerMode` 已存成 `'existing'` 不再詢問，一直失敗，只能 cancel"
  - "T0500 回報區「觀察」2：`configure-ssh-host.ts:123` 錯誤訊息寫「or type host」，但 UI 沒有手動輸入 host 的管道，`~/.ssh/config` 無 alias 時無法完成"
  - "T0500 `resetForEdit` / `*EditRequested` 旗標設計；T0444 / T0489 擁有權與 rollback 規則"
affects_files:
  - "src/components/setup-wizard/steps/docker/pick-container.ts"
  - "src/components/setup-wizard/steps/ssh/configure-host.ts"
  - "src/components/setup-wizard/"
  - "src/locales/"
  - "src/components/setup-wizard/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改任何 rollback 語意（T0444 / T0489 / T0500）；`containerMode` 延後寫入不得讓 rollback 失去判斷本次建立容器所需的資訊（測試證明）"
  - "🔴 手動輸入 host：若 wizard context 沒有文字輸入能力，可新增（例如 `ctx.requestText`）並在 Shell 實作；需三語 i18n；輸入以 SSH host 合法字元白名單驗證（CLAUDE.md 外部輸入規則：`/^[a-zA-Z0-9._-]+$/`，user@host / port 是否支援依既有 profile 欄位決定並說明）"
  - "🔴 排在 T0491 之後：兩者都改 `src/locales/`，避免同檔並行"
  - "🔴 不改 `integration.transitions.test.ts`；新測試放新檔"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md；`npm run typecheck` 維持 0"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0502 — wizard 兩個卡死路徑

## A. pick-container retry 卡死

- `containerMode` 改為選擇通過驗證（例如「Use existing」時確實有容器）後才寫入 `ctx.state`；或失敗時讓 retry 重新詢問（擇一並說明）
- 測試：選 existing 無容器 → 失敗 → retry 重新詢問 → 改選 new 成功；rollback 擁有權不變

## B. configure-ssh-host 手動輸入

- 無 alias（或使用者選「手動輸入」）時提供文字輸入 host；驗證後寫入 `sshHost` / `profileDraft.sshHost`
- 錯誤訊息與 UI 一致（若仍無法手動輸入則改訊息，但本單目標是提供輸入）
- 測試：無 alias → 手動輸入成功；不合法輸入被拒；有 alias 時行為不變；T0500 跳回重問仍正常

## 驗收條件

- [ ] A / B 單元測試；`npx vitest run src/components/setup-wizard`
- [ ] `npm run test:unit`、`npm run typecheck`、`npx vite build`
- [ ] 回報區：設計選擇、i18n key、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0500 / T0489 回報區 + 相關 steps 與 Shell
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。兩個卡死路徑都已修正。

- **A**：`pick-container` 改成選擇通過驗證後才寫入 `containerMode` / `dockerContainer`。第一次選「Use existing」但沒有容器時，失敗後 retry 會重新詢問，可改選「Create new」完成。
- **B**：wizard context 新增 `ctx.requestText`，Shell 也實作了對應的文字輸入框。`configure-ssh-host` 在沒有 alias 時直接請使用者輸入 host；有 alias 時，選單最後多一個「手動輸入主機…」選項。可接受的格式為 `host`、`user@host`、`host:port`、`user@host:port`，驗證通過後寫入 `sshHost` / `sshUser` / `sshPort` 與 `profileDraft`。

### Landing zone

- **PASS**。C-0：frontmatter `repo: better-agent-terminal` 與 `basename(REPO_ROOT)` `better-agent-terminal` 相符（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1 PASS。C-3：前 5 筆非萬用字元的路徑皆存在（僅供參考）。C-2：工單沒有 `branch` 欄位，HEAD 為 `main`。
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- frontmatter 原本是 `status: TODO`（不是 `PENDING`），視為尚未開工，直接改為 `IN_PROGRESS`。

### A. 設計選擇：驗證通過後才寫入（工單兩個選項中的第一個）

- `mode === 'existing'`：先檢查有沒有容器，再寫入 `containerMode` 與 `dockerContainer`。
- `mode === 'new'`：先跑 `resolveNewContainerName`（99 個候選名稱都被占用時會丟錯），成功後才寫入 `containerMode`、`dockerImage`、`dockerContainer`。
- 失敗時 `ctx.state` 維持原值。第一次執行時原值是 `'unknown'`，retry 因此沒有已存模式可沿用，會重新詢問。跳回後（T0500）失敗的情況，`pickContainerEditRequested` 旗標仍在，retry 一樣會詢問。
- **rollback 擁有權**：沒有改任何 rollback 程式碼。延後寫入反而保住了 rollback 需要的資訊。例如跳回後改選「existing」但沒有容器而失敗，這時 `containerMode` 仍是 `'new'`、`dockerContainer` 仍是本次建立的名稱，之後 cancel 時 `pick-container.rollback` 照樣會移除本次建立的容器。T0502 之前，這裡會先寫入 `'existing'`，rollback 因此會略過這個容器。
- 驗證新測試確實有效：把 `pick-container.ts` 暫時換回 HEAD 版本執行新測試，結果是 3 個失敗、2 個通過（失敗的是第一次 retry、名稱全被占用、跳回後 cancel 的 rollback）。換回新版後 5 個全部通過。換檔的方法是複製到 scratchpad 再複製回來，沒有使用 git stash、restore 或 checkout。

### B. 設計選擇：新增 `ctx.requestText`

- `wizard-runner.ts`：
  - 新增 `WizardTextRequest`，欄位有 `stepId`、`title`/`titleKey`、`description`/`descriptionKey`、`placeholder`、`initialValue`，以及 `validate(value)`。`validate` 驗證失敗時回傳 i18n 錯誤 key，通過時回傳 `null`。
  - `WizardContext` 新增選用的 `requestText`。
  - `WizardChoiceOption` 新增選用的 `labelKey`（i18n），讓選項文字可以翻譯。
  - `maybeWrapRequestChoice` 一般化為 `maybeWrapInputRequests` + `awaitInput`。`kind: 'input'` 的步驟呼叫 `requestText` 時，同樣會切換到 `awaiting-input` 再切回來，結束後還原原本的函式。`requestChoice` 的行為不變。
- `SetupWizardShell.tsx`：
  - 新增 `TextPrompt` 元件：`<form>`，內含 label 與 input，Enter 或「確定」送出，「取消」回傳 `null`。
  - 送出前先跑 `validate`。不合法時以 `role="alert"` 顯示翻譯後的錯誤，同時設定 `aria-invalid` 與 `aria-describedby`，並且不送出。送出的值會先 trim。
  - choice 按鈕有 `labelKey` 時顯示 `t(labelKey, label)`。
- `configure-host.ts` 的流程：

  | 情境 | 行為 |
  |---|---|
  | 有 alias + `requestChoice` + `requestText` | alias 選單，最後多一個「手動輸入主機…」（`labelKey`）；選它就開文字輸入框 |
  | 有 alias，但沒有 `requestText` | **不變**：選單只列 alias（T0500 的 options 斷言維持原樣） |
  | 沒有 alias + `requestText` | 直接開文字輸入框；取消後，若沒有已存 host 就丟 `configure-host-empty`（mapped error 不變），若有就沿用並記 log |
  | 沒有 alias，也沒有 `requestText` | **不變**（T0500 的「沿用舊 host」與 T0335 的 legacy 測試都維持原樣） |

- **驗證**：`parseManualSshHost()`（有 export）。
  - host 與 user 使用 CLAUDE.md 的外部輸入白名單 `/^[a-zA-Z0-9._-]+$/`，另外**禁止以 `-` 開頭**。這和 `electron/remote/ssh-args.ts` `validateSshIdentifier` 防的是同一個問題：開頭的 `-` 會被 ssh 當成 option 解析。
  - 長度上限：host 253、user 64，與 teardown 的 `TEARDOWN_HOST_RE` / `TEARDOWN_USER_RE` 一致，確保手動輸入的值之後 teardown 也能接受。
  - port 必須是 1–65535 的整數。
  - 不支援 IPv6 literal，因為 `:` 和 port 分隔符衝突；錯誤訊息裡有寫明。
  - Shell 會先擋下不合法輸入。如果不合法的值仍傳到步驟（非 Shell 的呼叫者），步驟會丟 `code = 'configure-host-invalid'` 並且什麼都不寫入，retry 時會重新詢問。
- **user@host / port 支援**：既有 profile 已有 `sshUser` / `sshPort` 欄位，而且後續步驟（`verify-auth`、`install-server-bundle`、`start-server`、tunnel）和 `buildBaseSshArgs` 都以 `-p port` 與 `user@host` 分欄使用。因此手動輸入時把三者拆開寫入：沒寫 user 時存成 `''`（與既有 alias 路徑的寫法相同）；沒寫 port 時為 `undefined`，即預設 22。
- **手動輸入與 alias 切換**：手動輸入會清掉 `sshAlias`，並設定 `sshHostManual: true`。之後如果（例如跳回後）改選 alias，會清掉先前手動輸入的 `sshUser` / `sshPort`，避免把手動輸入的 port 帶到 alias 上。不是手動輸入的情況完全不受影響。
- **跳回（T0500）**：`resetForEdit` 沒有改。跳回後若有 alias，會重新開選單（含「手動輸入」選項）。若沒有 alias，文字輸入框會以已存的 `user@host:port` 作為初始值供修改。
- **錯誤訊息與 UI 一致**：`configure-host-empty` 的原文「pick an alias from ~/.ssh/config or type host」與 mapped body「請選擇 ~/.ssh/config 中的 alias 或手動輸入主機名稱」原本就提到手動輸入，現在 UI 確實提供了，因此訊息沒有改。

### i18n key（en / zh-TW / zh-CN 三語）

| key | en | zh-TW |
|---|---|---|
| `wizard.action.submitText` | OK | 確定 |
| `wizard.action.cancelText` | Cancel | 取消 |
| `wizard.ssh.manualHost.option` | Enter host manually… | 手動輸入主機… |
| `wizard.ssh.manualHost.title` | Enter SSH host | 輸入 SSH 主機 |
| `wizard.ssh.manualHost.description` | Host name or IP address. Add the user and port as user@host or user@host:2222 (port defaults to 22). | 主機名稱或 IP 位址。可一併指定使用者與連接埠：… |
| `wizard.ssh.manualHost.invalid` | Invalid host. Use host, user@host or user@host:port …; IPv6 addresses are not supported. | 主機格式不正確。…不支援 IPv6 位址。 |

zh-CN 為對應的簡體譯文。`src/locales/__tests__/i18n-completeness.test.ts` 通過，新測試也逐一確認三語都有這 6 個 key。

### 改動檔案（`git diff --stat`）

```
 src/components/setup-wizard/SetupWizardShell.tsx   |  99 +++++-
 .../SetupWizardShell.text-prompt.test.tsx          | 126 +++++++   (新檔)
 .../__tests__/configure-host-manual.test.ts        | 361 +++++++++++++++ (新檔)
 .../__tests__/pick-container-retry.test.ts         | 192 +++++++++++  (新檔)
 .../setup-wizard/steps/docker/pick-container.ts    |  13 +-
 .../setup-wizard/steps/ssh/configure-host.ts       | 120 ++++++-
 src/components/setup-wizard/wizard-runner.ts       |  88 +++--
 src/locales/en.json                                |  10 +-
 src/locales/zh-CN.json                             |  10 +-
 src/locales/zh-TW.json                             |  10 +-
 10 files changed, 986 insertions(+), 43 deletions(-)
```

未改：`integration.transitions.test.ts`、任何既有測試、任何 rollback、`error-mapper.ts`、`CLAUDE.md`。換行維持各檔現況（以上檔案皆為 LF）。工作樹中其他 Worker 未提交的檔案（`package.json`、`scripts/*`、`electron/claude-agent-manager.ts`、T0496 / T0503 工單等）沒有碰。

### 驗收

| 項目 | 結果 | 證據 |
|---|---|---|
| A：選 existing 但無容器 → 失敗 → retry 重新詢問 → 改選 new 成功 | PASS | `requestChoice` 2 次；`containerMode` 在失敗時仍為 `'unknown'`，最後為 `'new'` / `bat-server-dev-box` |
| A：new 的候選名稱全被占用 → 失敗不寫入 → retry 改選 existing | PASS | `containerMode` / `dockerContainer` / `dockerImage` 失敗時未寫入 |
| A：rollback 擁有權不變 | PASS | 跳回 → 選 existing 失敗 → cancel → `removeContainer('bat-server-dev-box')`，旗標已清除；舊版程式碼這項測試失敗 |
| A：已存且有效的模式不詢問（無回歸） | PASS | `requestChoice` 未被呼叫 |
| B：無 alias → 手動輸入成功 | PASS | `deploy@build.example.com:2222` → `sshHost` / `sshUser` / `sshPort` 與 `profileDraft` 正確；經過 `awaiting-input`；結束後還原 `requestText` |
| B：不合法輸入被拒 | PASS | `parseManualSshHost` 拒絕 21 種輸入（`-oProxyCommand=…`、`user@-x`、`host;rm`、`host$(id)`、空白、IPv6、port 0 / 65536、超長等）；Shell 顯示錯誤且不送出；步驟丟 `configure-host-invalid` 不寫入，retry 重新詢問 |
| B：有 alias 時行為不變 | PASS | 選 alias 後 `sshAlias` / `sshHost` / `sshUser:''` 不變；沒有 `requestText` 時 options 只有 alias；既有 `configure-host.test.ts` 與 T0500 SSH 測試未改且通過 |
| B：T0500 跳回重問仍正常 | PASS | 手動輸入 → 跳回 → 改選 alias（user/port 清除）；無 alias 時跳回以舊值作初始值並更新；取消則沿用舊 host；後續步驟 retry 不重問 |
| Shell 文字輸入 UI | PASS | 初始值、placeholder、翻譯後的 title / description、驗證錯誤、Enter 送出（trim）、取消回傳 `null`、zh-TW 字串、`labelKey` 選項顯示 zh-CN |
| `npx vitest run src/components/setup-wizard` | PASS | 31 files / 376 tests passed |
| `npm run test:unit` | PASS | exit 0；193 files，3270 passed、1 skipped |
| `npm run typecheck` | PASS | exit 0（維持 0） |
| `npx vite build` | PASS | exit 0（工作樹含其他 Worker 未提交的 WIP，一併建置成功） |
| lint | N/A | repo 沒有 `eslint.config.*`，ESLint 10 無法執行，不是本單造成 |
| runtime smoke（實機 Docker / SSH wizard） | 未執行 | 本單未要求；依規定不以預設實例啟動 source build |

### 觀察（未處理，供塔台參考）

- 🔴 **SSH wizard 選 alias 的路徑無法通過 `verify-ssh-auth`（既有問題）**：
  - `configure-ssh-host` 從來不收集 `sshUser`，選 alias 後存的是 `sshUser: ''`。
  - `verify-auth.ts:65` 要求 `state.sshUser` 非空，會丟出「SSH host and user must be configured before verifying authentication.」。electron 端的 `buildBaseSshArgs` / `validateSshIdentifier` 也要求 user 非空。
  - 因此目前只有手動輸入 `user@host` 才能通過這一步。只輸入 host 時同樣會停在 `verify-ssh-auth`，使用者可以按 Shell 補上的「Edit settings」跳回 `configure-ssh-host` 補上 user。
  - 建議另開工單，擇一處理：
    - (a) alias 路徑也詢問 user（可沿用 `requestText`）；
    - (b) 允許 user 為空時改傳 `ssh <alias>`，讓 `~/.ssh/config` 的 `User` 生效。這需要改 electron 端的 `ssh-args`，牽動 4 個呼叫點與 teardown 白名單。
- `configure-host-invalid` 沒有 error-mapper entry，失敗時走 fallback：顯示原始訊息，動作為 retry / skip / cancel。實務上 Shell 會先擋下不合法輸入，只有非 Shell 呼叫者會走到這裡，所以沒有新增 entry。

### CLAUDE.md 建議文字

無需更新。`CLAUDE.md` 沒有描述 setup wizard 的輸入通道；`requestText` 的說明已寫在 `WizardTextRequest` 與 `WizardContext.requestText` 的註解中。

### Commit

- 以 `git commit --only` 提交本單 11 個檔案（7 個產品檔 + 3 個新測試 + 本工單）；不 push。commit hash 請見 `git log`（本回報寫於 commit 前）。

### 互動紀錄

- 無（`CT_INTERACTIVE=0`，fire-and-forget）。
