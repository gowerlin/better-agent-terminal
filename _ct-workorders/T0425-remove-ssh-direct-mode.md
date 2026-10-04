---
schema_version: 1
schema_kind: workorder
id: T0425
title: "BUG-098：移除 SSH 精靈 direct 模式，只保留 tunnel；既有 direct 設定 / profile 的相容處理"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-098
priority: P2
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: "2026-10-05T05:54:37+08:00"
updated_at: "2026-10-05T06:00:36+08:00"
completed_at: "2026-10-05T06:00:36+08:00"
target_version: next
depends_on:
  - T0424
related:
  - "BUG-098；BUG-093 / T0387（direct 模式驗證打 `<sshHost>:<serverPort>`）；BUG-097（同類暴露面）"
  - "D134（使用者 05:33 裁決：移除 direct，不修通）"
affects_files:
  - src/components/setup-wizard/steps/ssh/
  - src/components/setup-wizard/steps/wsl/write-profile.ts
  - src/components/setup-wizard/__tests__/
  - electron/remote/ssh-start-server.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/types/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **決策已定（D134）：移除 direct，不修通**。不要為 direct 設計對外 bind。遠端 bat-server 維持 `BAT_REMOTE_BIND=localhost`。"
  - "🔴 **相容性**：盤點 direct 模式值存在哪裡（精靈狀態、`configure-host` 選項、profile 欄位、設定檔）。已存在的 direct 值（例如舊 profile / 中途存檔的精靈狀態）必須**有定義的行為**：優先視為 tunnel；若無法安全轉換，載入時清楚提示而非靜默失敗。型別中若 `'direct'` 為 union 成員，移除後確認所有讀取點編譯通過。"
  - "🔴 依賴 T0424（同改 i18n 三語檔）。開工前 `git log --oneline -3` 確認。"
  - "🔴 同工作樹有其他 Worker 平行。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0425 — 移除 SSH direct 模式（BUG-098）

## 背景

SSH 精靈 direct 模式整條路徑不通：遠端 bat-server 固定綁 localhost（`ssh-start-server.ts` systemd / launchd 段）、profile 固定寫 `remoteHost: 'localhost'`（`write-profile.ts` SSH 分支）、`~/.ssh/config` alias 不解析 HostName。使用者裁決移除 direct，只留 tunnel（預設、安全、已可用）。

## 範圍

1. grep `'direct'` / connection mode 相關欄位於 `src/components/setup-wizard/**`、`electron/remote/**`、型別、i18n
2. 移除 UI 選項、direct 專屬驗證分支（`verify-remote.ts` 等）、只為 direct 存在的 i18n key
3. 相容處理（memory_overrides 第 2 條）
4. 測試：精靈只產出 tunnel；舊 direct 值的相容行為；`ssh-verify-remote.test.ts` 等既有測試同步

## 驗收條件

- [ ] 回報區附 direct 值出現點盤點與相容處理說明
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] BUG-098 改 `FIXED`（處理方式：移除）並填 `links.fix_workorder: T0425`

## Sub-session 執行指示
1. 讀本工單 + BUG-098 + T0387 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + BUG-098；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**。SSH 精靈 direct 模式已移除，精靈只產出 tunnel；既有 direct 值（精靈狀態 `sshTunnelMode: 'direct'`、profile `useSshTunnel: false`）一律有定義行為：視為 tunnel，並記 warn／在 profile 詳情標示。

- 開工 `2026-10-05T05:54:37+08:00`（系統時間）；派發 `CT_MODE=yolo`、`CT_INTERACTIVE=0`；無使用者中途指示
- 依賴 T0424：`ef7beb8 feat(remote): T0424 show PTY-limit notice instead of a blank terminal` 已在 HEAD（`git log --oneline -5` 確認）

#### 落點檢查（Landing Zone）— **PASS**

| 檢查 | 結果 | 說明 |
|------|------|------|
| C-0 repo identity | ✅ PASS | frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`） |
| C-1 工單路徑 | ✅ PASS | 工單位於 `REPO_ROOT/_ct-workorders/` |
| C-3 affects_files | ✅ PASS（informational） | `steps/ssh/`、`write-profile.ts`、`__tests__/`、`ssh-start-server.ts`、`en.json` 皆存在 |
| C-2 branch | ℹ️ N/A | 無 `branch` 欄位；實際 `main` |
| `BAT_WORKSPACE_ID` | 證據 | `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b` |

### 產出摘要

#### 1. direct 值出現點盤點

| # | 位置 | 形式 | 處理 |
|---|------|------|------|
| 1 | `steps/ssh/configure-host.ts` `TUNNEL_MODE_OPTIONS` | 選項 `{ value: 'direct', label: 'Direct (advanced)' }`（英文硬寫，**無 i18n key**），經 `sshConfigureHostTunnelModeOptions` 由 `steps/ssh/index.ts` 匯出 | 常數與匯出整個移除。全 repo 無任何 UI 消費者（精靈 UI 從未渲染此選項，只有預設值／預填狀態能帶入 `direct`） |
| 2 | `configure-host.ts` 狀態型別與正規化（原本接受 `'tunnel'` 或 `'direct'`） | 精靈 `ctx.state.sshTunnelMode`／`ctx.profileDraft.sshTunnelMode` | 型別改 `SshTunnelMode = 'tunnel'`；新增 `normalizeSshTunnelMode(ctx)`：任何非 `'tunnel'` 值一律寫成 `'tunnel'`，遇到 `'direct'` 記 `ctx.logger.warn('SSH direct mode is no longer supported; using an SSH tunnel instead.')` |
| 3 | `steps/ssh/verify-remote.ts` `ensureSshVerifyEndpoint` | `sshTunnelMode === 'direct'` 時 `verifyEndpoint = <sshHost>:<serverPort>`（T0387 的 direct 驗證分支） | 分支移除；殘留的 `'direct'` 也開 tunnel 驗證 |
| 4 | `steps/wsl/write-profile.ts` SSH 分支 | `useSshTunnel: sshTunnelMode !== 'direct'` | 改為恆 `useSshTunnel: true`；區域狀態型別移除 `'direct'` |
| 5 | **既有 profile**（profile 索引檔，`ProfileEntry.useSshTunnel?: boolean`）→ 讀取點 `electron/remote/remote-client.ts` `maybeCreateTunnel()` | 原 `if (!meta.useSshTunnel) return`：`false`（舊 direct）**與 `undefined`** 都不開 tunnel，直接連 `remoteHost`（SSH profile 恆為 `'localhost'`）⇒ 會打到**本機自己的 RemoteServer** | 新增純函式 `resolveSshTunnelUse(entry)`：ssh-* profile 一律 `useTunnel: true`；`useSshTunnel === false` 標 `legacyDirect` 並 `logger.warn`（含 profile id）後照樣走 tunnel；`undefined` 依 schema 註解「ssh-* default true at use-site」走 tunnel；非 ssh profile 不變 |
| 6 | `src/components/profiles/details/SshDetails.tsx` | `useSshTunnel` falsy 時顯示 `'direct'` | 一律顯示 `tunnel → localhost:<port>`；`useSshTunnel === false` 另加 ` (legacy direct setting ignored)` |
| 7 | `electron/remote/ssh-start-server.ts` systemd／launchd | `BAT_REMOTE_BIND=localhost` | **行為不變**（D134：不設計對外 bind），兩處加註解說明 loopback only 為刻意設計 |
| 8 | i18n `wizard.ssh.step.configureHost.description`（en／zh-TW／zh-CN） | 描述含「tunnel mode／通道模式」（暗示可選） | 改為「選擇主機、帳號、port、金鑰與安裝路徑；BAT 一律透過 SSH 通道連線。」（三語同步）。**沒有只為 direct 存在的 i18n key**，key 集合不變 |
| 9 | `steps/wsl/connect-test.ts` 註解 | 「(or the remote host in direct mode)」 | 註解更新 |
| — | 未涉及 | `electron/remote/tunnel-manager.ts` 的 `TunnelMode`（tailscale／lan）、`electron/node-resolver.ts` 的 `type: 'direct'` 為無關概念；`main.ts`／`preload.ts`／`electron.d.ts`／`profile-manager.ts` 的 `useSshTunnel?: boolean` 欄位**保留**（舊 profile 仍可能帶 `false`）；精靈狀態**沒有持久化**（無中途存檔機制），direct 值只可能來自預填或程式內設定 |

#### 2. 相容處理說明（memory_overrides 第 2 條）

- 採「**優先視為 tunnel**」：兩種舊值都能安全轉換——SSH profile 的 `remoteHost` 本來就固定是 `'localhost'`、遠端 bat-server 本來就只綁 loopback，舊 direct profile 從來無法連線；改走 tunnel 後使用的正是 profile 既有的 `sshHost`／`sshUser`／`sshPort`／`sshKeyPath`／`remotePort`，與 tunnel profile 完全相同的路徑
- 提示：連線時 main logger warn（寫入 debug.log）；profile 詳情面板顯示 `(legacy direct setting ignored)`；精靈內殘留值記 wizard logger warn
- **不改寫磁碟上的 profile**（沿用 profile-manager「passive migration、不自動持久化」原則）；使用者下次重建 profile 時自然寫成 `true`
- 附帶修正：`useSshTunnel` 為 `undefined` 的 ssh-* profile 原本也不開 tunnel（與 schema 註解相反），現在一併走 tunnel

#### 3. 改動檔案

- `src/components/setup-wizard/steps/ssh/configure-host.ts`
- `src/components/setup-wizard/steps/ssh/index.ts`
- `src/components/setup-wizard/steps/ssh/verify-remote.ts`
- `src/components/setup-wizard/steps/wsl/write-profile.ts`
- `src/components/setup-wizard/steps/wsl/connect-test.ts`（僅註解）
- `src/components/profiles/details/SshDetails.tsx`
- `electron/remote/remote-client.ts`
- `electron/remote/ssh-start-server.ts`（僅註解）
- `src/locales/en.json`／`zh-TW.json`／`zh-CN.json`
- `src/components/setup-wizard/__tests__/ssh-verify-remote.test.ts`（direct 案例改為「殘留 direct 仍走 tunnel」）
- `src/components/setup-wizard/__tests__/ssh-tunnel-only.test.ts`（新，9 案）
- `electron/remote/__tests__/remote-client-ssh-tunnel.test.ts`（新，12 案）

#### 4. 驗收（證據分道）

| 分道 | 結果 | 證據 |
|------|------|------|
| unit：精靈只產出 tunnel | ✅ PASS | `ssh-tunnel-only.test.ts`：`steps/ssh` 不再匯出 `sshConfigureHostTunnelModeOptions`；`createSshWizardContext` 預設 `tunnel`；configure-host 保持 tunnel 不 warn；write-profile 在 state `tunnel`／`direct` 下都寫 `useSshTunnel: true`、`remoteHost: 'localhost'`、`remotePort: 9876` |
| unit：舊精靈值相容 | ✅ PASS | configure-host 把 `direct` 改成 `tunnel` 並 warn；`undefined`／`''`／`'bogus'`／`42` 靜默轉 tunnel；`ssh-verify-remote.test.ts`：殘留 `direct` 時 fetch-fingerprint／connect-test 打 `127.0.0.1:<tunnel port>`、**不**打 `devbox.example:9876`，結束後 tunnel 全數關閉 |
| unit：舊 profile 相容 | ✅ PASS | `remote-client-ssh-tunnel.test.ts`：`resolveSshTunnelUse` 對 ssh-linux／ssh-darwin × `true`／`undefined`／`false` 皆 `useTunnel: true`（`false` → `legacyDirect: true`），非 ssh targetOS 皆無 tunnel；真實 `RemoteClient` 對 `useSshTunnel: false`／`true`／`undefined` 的 ssh profile 都建立 `SshTunnel`（只建構、不 `start()`，不 spawn ssh），WSL profile 不建立。修改前 `false`／`undefined` 兩案會是 `null` |
| `npm run test:unit` | ✅ PASS | **124 files／1961 passed、1 skipped**（含平行 Worker 的未提交測試；stderr 的 `error: No such remote 'origin'` 為既有測試雜訊，非失敗） |
| `npx tsc --noEmit` | ✅ PASS | **39** errors（≤ 40）；grep `ssh`／`remote-client`／`write-profile`／`SshDetails` 0 筆。過程中曾因新測試 mock 型別多出 2 筆（42），已修正 |
| `npx vite build`／`npm run test:e2e` | ⏭️ 未跑 | 依 memory_overrides（L141，同工作樹有平行 Worker）刻意不跑 |
| runtime（交使用者，選做） | ⏳ | 若手上有舊 direct SSH profile（`useSshTunnel: false`）：連線應走 tunnel 成功，debug.log 出現 `has useSshTunnel=false (removed SSH direct mode) — connecting through an SSH tunnel instead`，profile 詳情顯示 `(legacy direct setting ignored)` |

### 遭遇問題

- 無阻塞。新測試首次執行 3 案失敗屬測試本身問題（`RemoteClient` 的 tunnel 在 `connect()` 內建立而非 constructor；connect-test 會再呼叫一次 `openVerifyTunnel`），已修正測試，產品程式碼未因此調整
- **範圍說明（affects_files 以外）**：`electron/remote/remote-client.ts`、`src/components/profiles/details/SshDetails.tsx`、`src/components/setup-wizard/steps/wsl/connect-test.ts`（僅註解）。前兩者是既有 profile `useSshTunnel` 的實際讀取／顯示點，memory_overrides 第 2 條的相容要求必須在這裡落地
- `src/types/` 未修改：`useSshTunnel?: boolean` 需保留以讀舊 profile；`'direct'` union 只存在於精靈步驟的區域型別（已改）。`src/types/electron.d.ts` 目前的未提交變更屬平行 Worker，未納入本單 commit
- 交塔台：`_bug-tracker.md` 中 BUG-098 需由塔台移到 `## ✅ 已修復` section（本單只改 BUG-098 本檔）
- 既有、未改：`tests/ssh-flow-journeys.test.ts`／`tests/ssh-wizard-e2e.test.ts`（不在 vitest include，T0387 已記錄 HEAD 基線即失敗）

### 互動紀錄

無（`CT_INTERACTIVE=0`）。

### Commit

`git commit --only` 只含上列改動檔、本工單與 BUG-098；未 push。commit hash 見 `git log --oneline -1 -- _ct-workorders/T0425-remove-ssh-direct-mode.md`。

### 回報時間

`2026-10-05T05:58:42+08:00`
