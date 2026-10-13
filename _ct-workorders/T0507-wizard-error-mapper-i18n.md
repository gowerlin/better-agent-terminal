---
schema_version: 1
schema_kind: workorder
id: T0507
title: "Setup wizard error-mapper 全面三語化：MESSAGE_DICT 與 action label 寫死 zh-TW → en / zh-CN 介面也顯示中文；改走 i18n key 並更新 T0341 visual contract"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-14T00:36:35+08:00"
started_at: "2026-10-14T00:37:19+08:00"
updated_at: "2026-10-14T00:46:26+08:00"
completed_at: "2026-10-14T00:46:26+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0506"
related:
  - "T0506 回報區「後續建議」2：`ssh-configure-host-empty` 等 entry 走寫死 zh-TW 的 `MESSAGE_DICT`（`src/components/setup-wizard/error-mapper.ts:111` 起）與 action label；T0341 visual contract 測試鎖住 `修改 SSH 設定` / `取消`"
  - "T0506 新增的 `ssh-configure-host-invalid` entry（i18n key `wizard.ssh.error.hostInvalid.*` + Shell 以 `wizard.action.*` 翻譯 action）為範本；T0378 `lookupMessage` i18next 路徑"
affects_files:
  - "src/components/setup-wizard/error-mapper.ts"
  - "src/components/setup-wizard/"
  - "src/locales/"
  - "src/components/setup-wizard/__tests__/"
  - "src/locales/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 zh-TW 文案逐字保留（搬進 zh-TW locale）；en / zh-CN 新譯，術語與既有 locale 一致；不得改變 entry 的匹配規則（platforms / stepIds / errorCodes / patterns）與 actions 的 kind / targetStepId"
  - "🔴 T0341 visual contract：以「i18n 後在 zh-TW 下輸出不變」為準更新測試，並新增 en / zh-CN 斷言；不得只刪斷言"
  - "🔴 若 `MESSAGE_DICT` 仍有非 wizard 的 consumer（grep），保持相容或一併遷移並說明"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；`npm run typecheck` 維持 0"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0507 — wizard error-mapper 三語化

## 實作

1. 盤點 `error-mapper.ts` 所有 entry 的 message 來源（`MESSAGE_DICT` / i18n key）與 action label 寫死處；以及 Shell 端如何顯示（`lookupMessage`、action label 翻譯）
2. 全部改走 i18n key（比照 T0506 `ssh-configure-host-invalid`）；action label 由 Shell 以 `wizard.action.*` 翻譯（缺 key 補三語）
3. `MESSAGE_DICT` 移除或改為 key 對照（說明選擇）
4. 測試：每個 entry 三語皆有 title / body（completeness 守門）；T0341 visual contract 在 zh-TW 下不變、en / zh-CN 顯示對應語言

## 驗收條件

- [x] entry 清單與遷移對照表（entry id → key）
- [x] `npx vitest run src/components/setup-wizard src/locales`；`npm run test:unit`、`npm run typecheck`、`npx vite build`
- [x] 回報區：`git diff --stat`、CLAUDE.md 建議文字（如需）

## Sub-session 執行指示

1. 讀本工單 + D139 + T0506 回報區 + `error-mapper.ts` + Shell 顯示 mapped error 的元件 + T0341 測試
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

`DEFAULT_WIZARD_ERROR_REGISTRY` 的 message 與 action label 全部改走 i18n key，en / zh-CN 介面不再顯示寫死的繁中。zh-TW 文案逐字搬進 `zh-TW.json`，T0341 / T0334 的 zh-TW inline snapshot **一字未改**仍通過。entry 的匹配規則（`id` / `platforms` / `stepIds` / `errorCodes` / `patterns`）與 actions 的 `kind` / `targetStepId` / `href` / 順序皆未變動（`git diff -U0` 過濾確認 0 行）。

### 盤點（實作 1）

- `MESSAGE_DICT`（寫死 zh-TW）：6 個 entry 的 message + `fallback` 標題。consumer 只有 `error-mapper.ts` 自身（`lookupMessage` / `buildFallback`），以及 `error-mapper.test.ts` 的一行註解；`electron/` / `e2e/` 無引用。
- 寫死 action label：9 種文字分佈在 6 個 entry（`下載 Docker Desktop`、`我已啟動 Docker，重試`、`我已執行命令，重試`、`略過此步驟`、`我已檢查 journal，重試`、`略過此步驟（手動啟動）`、`安裝 WSL2 指南`、`我已安裝 WSL2，重試`、`修改 SSH 設定` ×2），另有 6 個 `取消`、1 個 `重試`。
- Shell 端：`SetupWizardShell.tsx` `defaultActionLabel()` 原本「有 `label` 用 `label`，否則依 kind 走 `wizard.action.*`」。title / body 由 runner / Shell 呼叫 `resolveWizardError` 時解析（T0378 的 i18next 路徑）。
- 已走 i18n 的 entry（不動）：`ssh-configure-host-invalid`、`wsl-port-in-use`、`wsl-no-distro`、4 個 `fingerprint-*`。

### 遷移對照表（entry id → key）

| entry id | 舊 messageKey（MESSAGE_DICT） | 新 messageKey | action label（舊 → 新） |
|---|---|---|---|
| `docker-daemon-unavailable` | `docker.daemon.unavailable` | `wizard.docker.error.daemonUnavailable` | `下載 Docker Desktop` → `wizard.action.downloadDockerDesktop`；`我已啟動 Docker，重試` → `wizard.action.dockerStartedRetry`；`取消` → kind 預設 `wizard.action.cancel` |
| `wsl-linger-failure` | `wsl.linger.failure` | `wizard.wsl.error.lingerFailure` | `我已執行命令，重試` → `wizard.action.commandRunRetry`；`略過此步驟` → `wizard.action.skipStep`；`取消` → 預設 |
| `ssh-permission-denied` | `ssh.auth.permission-denied` | `wizard.ssh.error.permissionDenied` | `修改 SSH 設定` → `wizard.action.editSshSettings`；`重試` → kind 預設 `wizard.action.retry`；`取消` → 預設 |
| `ssh-configure-host-empty` | `ssh.configure-host.empty` | `wizard.ssh.error.hostEmpty` | `修改 SSH 設定` → `wizard.action.editSshSettings`；`取消` → 預設 |
| `wsl-service-start-timeout` | `wsl.service.start-timeout` | `wizard.wsl.error.serviceStartTimeout` | `我已檢查 journal，重試` → `wizard.action.journalCheckedRetry`；`略過此步驟（手動啟動）` → `wizard.action.skipStepManualStart`；`取消` → 預設 |
| `wsl-not-installed` | `wsl.not-installed` | `wizard.wsl.error.notInstalled` | `安裝 WSL2 指南` → `wizard.action.wslInstallGuide`；`我已安裝 WSL2，重試` → `wizard.action.wslInstalledRetry`；`取消` → 預設 |
| （fallback，`matchId: null`） | `fallback` | `wizard.shared.error.stepFailed`（只有 title，body 仍顯示 raw error） | 不變（retry / skip / cancel 走 kind 預設） |

`取消` / `重試` 改用 kind 預設 key 而不另開 key，原因是 zh-TW 的 `wizard.action.cancel` = `取消`、`wizard.action.retry` = `重試`，與原寫死文字相同。`編輯設定`（`wizard.action.editConfig`）≠ `修改 SSH 設定`、`跳過` ≠ `略過此步驟`，所以這兩類另開 entry 專屬 key，以維持 zh-TW 輸出不變。

en / zh-CN 譯文沿用既有 locale 的術語：zh-CN 用「运行 / 设置 / 跳过 / 重试 / 主机名」，en 的 action 用 "Retry" / "Cancel" / "Skip this step"。

### 設計說明

- **`MESSAGE_DICT` 選擇移除**（不保留為 key 對照）。它唯一的 consumer 是 `lookupMessage`，文案已全數搬進 locale，保留對照表只會多一份要同步的清單。`lookupMessage` 現在：i18next 已初始化時依序試 `<key>.title`、`FALLBACK_MESSAGE_KEY`（新 export，`wizard.shared.error.stepFailed`）；i18next 未初始化（只會發生在沒 import `src/i18n` 的測試）時回英文常數 `Step failed`、body 空字串（body 空時照舊顯示 raw error）。
- **action label**：`WizardRecoveryAction` 每個 kind 都加上選填的 `labelKey`。`open-link` / `custom` 沒有 kind 預設文字，型別要求 `label` 或 `labelKey` 至少給一個（`WizardRequiredActionLabel`）。Shell `defaultActionLabel()` 的順序是 `labelKey`（`t(labelKey, label ?? kind)`）→ `label` → kind 預設 `wizard.action.*`。`label` 欄位保留，供 `custom` 與外部 registry 用；DEFAULT registry 已不含任何字面 `label`，由測試守住。
- 跟 T0378 / T0506 一樣，title / body 在 `resolveWizardError` 當下解析。錯誤顯示中途切換語言時，已顯示的 title / body 要等下次 resolve 才會換，action label 則由 Shell render 時翻譯，會立即跟著換。

### 變更檔案

| 檔案 | 變更 |
|---|---|
| `src/components/setup-wizard/error-mapper.ts` | 移除 `MESSAGE_DICT`；`lookupMessage` 全走 i18next + `FALLBACK_MESSAGE_KEY`；action 型別加 `labelKey`；6 個 entry 的 messageKey / label 改 key |
| `src/components/setup-wizard/SetupWizardShell.tsx` | `defaultActionLabel()` 先翻 `labelKey` |
| `src/locales/{en,zh-TW,zh-CN}.json` | 各 +9 個 `wizard.action.*`、+6 個 error title/body、+1 fallback title（三語 key 集合相同） |
| `src/components/setup-wizard/__tests__/error-mapper.test.ts` | 釘 zh-TW（原斷言不變）；新增 registry 三語 completeness（每個 entry title + body、每個 action labelKey、fallback title；禁止字面 label）＋ resolver 依語言輸出（3 語 × 全部 entry） |
| `src/components/setup-wizard/__tests__/SetupWizardShell.test.tsx` | T0334 / T0341 suite 釘 zh-TW：6 個 inline snapshot 與 title 字面值不變，只把 `Show details` 改成 zh-TW 實際顯示的 `顯示詳細`；新增 en / zh-CN × 6 entry 視覺契約（title、raw / 顯示詳細、action kind + label 字面值）；T0333 docker 測試（預設 en）改斷言 `Docker daemon not detected` |
| `src/components/setup-wizard/__tests__/integration.mapped-ux.test.tsx` | 釘 zh-TW（原字面斷言不變）；`Skipped by user` / `Show details` 改用 `i18n.t(...)` |
| `src/components/setup-wizard/__tests__/configure-host.test.ts` | AC-3 釘 zh-TW（`SSH 主機名稱為必填` 不變） |
| `src/components/setup-wizard/__tests__/configure-host-manual.test.ts` | 「body 提到手動輸入」改為三語 `it.each` |
| `src/components/setup-wizard/__tests__/write-systemd-unit.test.ts` | import `src/i18n`（原本未初始化 i18next，body 斷言 `/journalctl/` 依賴寫死字典） |

`src/locales/__tests__/` 未改：既有「三語 `wizard.action` key 集合相同」測試已涵蓋新增的 9 個 action key。

### 驗證

| Gate | 結果 | 證據 |
|---|---|---|
| `npx vitest run src/components/setup-wizard src/locales` | ✅ PASS | 34 files / 477 tests passed |
| `npm run test:unit` | ✅ PASS | 203 files，3433 passed / 1 skipped（含並行 T0504 未提交的測試，本次全綠） |
| `npm run typecheck` | ✅ PASS | `tsc --noEmit -p .` exit 0 |
| `npx vite build` | ✅ PASS | renderer 2190 modules / main 335 modules，皆 `built` |
| 匹配規則不變 | ✅ | `git diff -U0 error-mapper.ts` 中 `id:` / `platforms:` / `stepIds:` / `errorCodes:` / `patterns:` 0 行；actions 的 kind / targetStepId / href 前後一致 |
| zh-TW 輸出不變 | ✅ | T0334 / T0341 6 個 `toMatchInlineSnapshot` 與 title 字面值零 diff |

未做：實機 UI smoke（切語言後觸發 wizard 錯誤）。單元與元件測試已在 jsdom 中渲染 3 語 × 6 entry 的 Shell。

### `git diff --stat`（本單檔案）

```
 src/components/setup-wizard/SetupWizardShell.tsx   |   5 +-
 .../__tests__/SetupWizardShell.test.tsx            | 170 ++++++++++++++++++++-
 .../__tests__/configure-host-manual.test.ts        |  12 +-
 .../setup-wizard/__tests__/configure-host.test.ts  |   6 +-
 .../setup-wizard/__tests__/error-mapper.test.ts    | 116 +++++++++++++-
 .../__tests__/integration.mapped-ux.test.tsx       |  18 ++-
 .../__tests__/write-systemd-unit.test.ts           |   1 +
 src/components/setup-wizard/error-mapper.ts        | 148 +++++++++---------
 src/locales/en.json                                |  40 ++++-
 src/locales/zh-CN.json                             |  40 ++++-
 src/locales/zh-TW.json                             |  40 ++++-
 11 files changed, 497 insertions(+), 99 deletions(-)
```

（另含本工單檔案。換行維持各檔現況：locale / `error-mapper.ts` LF、`SetupWizardShell.test.tsx` CRLF。）

### Landing Zone Check

- 結果：**PASS**
- C-0：frontmatter `repo: better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`src/components/setup-wizard/error-mapper.ts`、`src/components/setup-wizard/`、`src/locales/`、`src/components/setup-wizard/__tests__/`、`src/locales/__tests__/` 皆存在 → PASS（informational）
- C-2：工單無 `branch` 欄位；目前 `main`
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 執行模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### Commit

- 以 `git commit --only` 提交本單 12 個檔案（含工單本身），不 push。工作區裡並行 T0504 的未提交改動（`electron/main.ts`、`workspace-store.ts`、`renderer-flush*`、e2e spec 等）與 `tmp/` 都沒有碰。
- 未動 CLAUDE.md；未使用 `git stash` / `reset` / `checkout --` / `restore`。

### 偏差

- 無範圍偏差。`src/locales/__tests__/` 沒有修改，理由見上方「變更檔案」。
- 執行過程中一次 Bash 呼叫因 `cat >` 沒有 heredoc 而卡在 stdin（背景逾時後已停止），沒有寫入任何檔案，之後改用 Write 工具寫 scratchpad 腳本。

### CLAUDE.md 建議文字

無需。CLAUDE.md 沒有 wizard error-mapper 的章節。如果 T0493 想補一行，可用：「Setup wizard error-mapper（`src/components/setup-wizard/error-mapper.ts`）的 message 與 action label 一律用 i18n key（`messageKey` → `<key>.title/.body`、action `labelKey`），不寫字面文字；`error-mapper.test.ts` 守三語 completeness（T0507）。」

### 後續建議

- 無阻擋項。可選：已顯示的 mapped error 在切換語言時，title / body 不會即時重譯（action label 會）。若要即時重譯，可讓 `WizardMappedError` 帶 `messageKey`，改由 Shell render 時翻譯；這會動到 runner snapshot 的形狀，不在本單範圍。

### Commit hash

本單單一 commit，訊息以 `fix: T0507` 開頭（`git log --grep T0507`）；hash 由塔台驗收時記錄。
