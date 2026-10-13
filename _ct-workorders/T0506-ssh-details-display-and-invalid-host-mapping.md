---
schema_version: 1
schema_kind: workorder
id: T0506
title: "SSH profile 顯示：空 user（alias）不再顯示成 user@host:22 + `configure-host-invalid` 補 error-mapper entry（三語）"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-14T00:31:26+08:00"
started_at: "2026-10-14T00:32:07+08:00"
updated_at: "2026-10-14T00:36:26+08:00"
completed_at: "2026-10-14T00:36:26+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0505"
related:
  - "T0505 回報區「後續建議」：`src/components/profiles/details/SshDetails.tsx:17` 對空 user 顯示 `{sshUser || 'user'}@host:{port || 22}`，alias profile 看起來像缺資料；`configure-host-invalid` 沒有 error-mapper entry，走 fallback"
  - "`src/components/setup-wizard/error-mapper.ts:324`（`ssh-configure-host-empty` entry 為範本）；T0502 `configure-host-invalid` 的產生點"
affects_files:
  - "src/components/profiles/details/SshDetails.tsx"
  - "src/components/setup-wizard/error-mapper.ts"
  - "src/locales/"
  - "src/components/profiles/"
  - "src/components/setup-wizard/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 顯示規則：空 user → 只顯示 host（可加「由 ~/.ssh/config 決定使用者」提示，三語）；port 未設 → 不顯示 `:22`（或顯示為預設值的明確標示，擇一說明）；有值時顯示不變"
  - "🔴 error-mapper：`configure-host-invalid` entry 比照 `ssh-configure-host-empty`（標題 / 內文 / 建議動作；有 edit-config 跳回時指向 `configure-ssh-host`），三語；i18n completeness 測試通過"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md；`npm run typecheck` 維持 0"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0506 — SSH 顯示與錯誤對應

## 實作

1. `SshDetails.tsx`：依 memory_overrides 顯示規則修改；其他顯示 SSH target 的地方（profile 列表、標題等）一併 grep 檢查同類寫法
2. `error-mapper.ts`：新增 `configure-host-invalid` entry + 三語 locale key
3. 測試：顯示（空 user / 有 user / 無 port / 有 port）；mapper 命中與動作

## 驗收條件

- [x] 單元測試；`src/locales/__tests__/i18n-completeness.test.ts` 通過
- [x] `npm run test:unit`（1 失敗屬並行 T0504 未提交的 `electron/main.ts`，見回報區）、`npm run typecheck`、`npx vite build`
- [x] 回報區：其他顯示點清單與處置、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0505 / T0502 回報區 + 相關檔案
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

- **SshDetails 顯示**（`src/components/profiles/details/SshDetails.tsx`）：Host 列改為只顯示實際存的值——有 user 才加 `user@`、有 port 才加 `:port`；缺的部分附一段三語提示（`profiles.sshDetails.userFromConfig` / `portFromConfig` / `userAndPortFromConfig`），例：alias profile 顯示 `devbox (user and port from ~/.ssh/config)`。user 與 port 都有時顯示不變（`alice@devbox:22`，無提示）。
  - **port 未設的處置（擇一說明）**：選「不顯示 `:22`」，不選「標示為預設 22」。理由：port 未設時 main process 不帶 `-p`，實際 port 由 `~/.ssh/config`（alias 的 `Port`、或 `Host *`）決定，不一定是 22；顯示 22 反而可能是錯的。
  - host 缺值 fallback（`sshHost || remoteHost || 'host'`）維持原樣。
- **error-mapper**（`src/components/setup-wizard/error-mapper.ts`）：新增 `ssh-configure-host-invalid` entry，形狀比照 `ssh-configure-host-empty`：`platforms: ['ssh']`、`stepIds: ['configure-ssh-host']`、`errorCodes: ['configure-host-invalid']`、patterns 對應 T0502（`SSH host … is invalid`）與 T0505（`SSH alias … cannot be used`）兩處訊息、`detailMode: 'hidden-by-default'`、actions `edit-config`（`targetStepId: 'configure-ssh-host'`）+ `cancel`。
  - 與範本的差異：message 走 i18n key `wizard.ssh.error.hostInvalid.{title,body}`（T0378 的 `lookupMessage` i18next 路徑），actions 不寫死 label，由 Shell 用 `wizard.action.editConfig` / `wizard.action.cancel` 翻譯——範本的 `MESSAGE_DICT` 與 action label 是寫死的 zh-TW，不符合「三語」要求。範本本身未動。
- **locale**：en / zh-TW / zh-CN 各加 `profiles.sshDetails.*`（3 key）與 `wizard.ssh.error.hostInvalid.*`（2 key）；`i18n-completeness.test.ts` 新增 T0506 段落守住這 5 個 key 與兩個子樹的 key 集合一致。

### 其他顯示 SSH target 的地方（grep 結果與處置）

| 位置 | 寫法 | 處置 |
|---|---|---|
| `src/components/profiles/details/SshDetails.tsx:17`（原） | `{sshUser \|\| 'user'}@host:{sshPort \|\| 22}` | 本單修正 |
| `src/components/setup-wizard/steps/ssh/ssh-target.ts` `describeSshTarget` | `sshUser ? user@host : host`（T0505） | 已正確，不動（wizard log 用） |
| `electron/remote/ssh-args.ts:85` | 同上（ssh 目標字串） | 已正確，不動 |
| `steps/ssh/verify-auth.ts:71` | `describeSshTarget` + 有 port 才加 `:port` | 已正確，不動 |
| `steps/ssh/configure-host.ts` `formatManualSshHost` | 有值才加 `user@` / `:port` | 已正確，不動 |
| `configure-host.ts:104` placeholder `user@example.com:22` | 輸入框範例文字 | 非顯示資料，不動 |
| `ProfileCard.tsx` / `EditRemoteProfileModal.tsx` / profile 列表 / 視窗標題 | 無 `sshUser` / `sshPort` 拼接（grep `sshUser`、`sshHost`、`sshPort` 於 `src/**/*.tsx`） | 無同類寫法 |

### 改動檔案（`git diff --stat`）

```
 .../profiles/__tests__/SshDetails.test.tsx         |  71 ++++++++++   (新)
 src/components/profiles/details/SshDetails.tsx     |  20 ++-
 .../configure-host-invalid-mapping.test.ts         | 144 +++++++++++++++++++++ (新)
 src/components/setup-wizard/error-mapper.ts        |  16 +++
 src/locales/__tests__/i18n-completeness.test.ts    |  35 +++++
 src/locales/en.json                                |  13 +-
 src/locales/zh-CN.json                             |  13 +-
 src/locales/zh-TW.json                             |  13 +-
 8 files changed, 320 insertions(+), 5 deletions(-)
```

換行：所有檔案維持 LF（原狀）。

### 驗收

| 項目 | 結果 | 證據 |
|---|---|---|
| 新增單元測試 | ✅ PASS | `SshDetails.test.tsx`（空 user+無 port / 無 user+有 port / 有 user+無 port / 皆有 / remoteHost fallback / zh-TW、zh-CN 提示）、`configure-host-invalid-mapping.test.ts`（errorCode 命中 + 訊息 + `edit-config→configure-ssh-host` + `cancel`、alias / typed host 兩種 pattern fallback、不搶 `configure-host-empty`、非 ssh 平台不命中、zh-TW / zh-CN 標題、runner 實際跑 alias 被拒 → mappedError 命中 → retry 重問、typed host 被拒 → 命中） |
| `src/locales/__tests__/i18n-completeness.test.ts` | ✅ PASS | 三檔合跑 48/48 passed |
| `npm run test:unit` | ⚠️ 3385 passed / **1 failed** / 1 skipped（203 files） | 失敗：`electron/__tests__/detached-window-profile-binding.test.ts:190` `expect(src).toMatch(/detachedWindows\.clear\(\)\s+detachedWindowRecords\.clear\(\)/)`。該測試讀 `electron/main.ts` 原始碼；`main.ts` 為並行 T0504 的**未提交**改動（D139 批次）。驗證：同一 regex 對 `git show HEAD:electron/main.ts` 為 `true`、對工作區為 `false` ⇒ 與本單無關，本單未碰 `electron/`。已轉告 T0504 範圍（見後續建議） |
| `npm run typecheck` | ✅ PASS | `tsc --noEmit -p .` 0 錯誤 |
| `npx vite build` | ✅ PASS | renderer 2190 modules / main 335 modules，皆 `built` |

### Landing Zone Check

- 結果：**PASS**
- C-0：frontmatter `repo: better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`src/components/profiles/details/SshDetails.tsx`、`src/components/setup-wizard/error-mapper.ts`、`src/locales/`、`src/components/profiles/`、`src/components/setup-wizard/__tests__/` 皆存在 → PASS（informational）
- C-2：工單無 `branch` 欄位；目前 `main`
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 執行模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### Commit

- `git commit --only` 本單 9 個檔案（含工單本身）；不 push。hash 見下方「Commit hash」。
- 未動 CLAUDE.md；未使用 `git stash` / `reset` / `checkout --` / `restore`。

### 偏差

- 無範圍偏差。新增檔案 `src/components/profiles/__tests__/SshDetails.test.tsx` 在 affects_files `src/components/profiles/` 之下；`i18n-completeness.test.ts` 在 `src/locales/` 之下。

### 後續建議

- **T0504**：`detached-window-profile-binding.test.ts:190` 斷言 `detachedWindows.clear()` 後緊接 `detachedWindowRecords.clear()`，T0504 的 `main.ts` 改動目前破壞此順序；T0504 收尾前需調整程式或同步更新該測試。
- `ssh-configure-host-empty` 仍走寫死 zh-TW 的 `MESSAGE_DICT` 與 action label（T0341 visual contract 測試鎖住 `修改 SSH 設定` / `取消`），en / zh-CN 介面下會顯示中文。若要一致三語，可另開單改走 i18n key 並更新 T0341 snapshot（不在本單範圍）。

### Commit hash

本單單一 commit，訊息以 `fix: T0506` 開頭（`git log --grep T0506`）；hash 由塔台驗收時記錄。
