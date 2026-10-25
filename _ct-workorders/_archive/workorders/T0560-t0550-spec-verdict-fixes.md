---
schema_version: 1
schema_kind: workorder
id: T0560
title: "e2e `t0550-wsl-acceptance.spec.ts` 判定修正：`T0554.profiles-untouched` 排除 autosave 造成的 `updatedAt` 變動、`A3.clean-install` 改用 canary 判定、`A3.leftovers` 舊說明（T0559 兩項誤判 FAIL）"
type: test
status: DONE
repo: better-agent-terminal
project: BUG-139
priority: P3
sizing: XS
created_at: "2026-10-16T14:20:40+0800"
updated_at: "2026-10-16T14:26:09+0800"
started_at: "2026-10-16T14:22:01+0800"
completed_at: "2026-10-16T14:24:49+0800"
commit: "ace4f96a"
target_version: "測試檔，不影響產品"
depends_on: []
related:
  - "T0559 回報區「遭遇問題」1–3（誤判根因與建議）"
  - "T0552（`A2.upgrade-running` / `A3.clean-install`）、T0554（`T0554 cancel`）"
affects_files:
  - e2e/t0550-wsl-acceptance.spec.ts
  - _ct-workorders/T0560-t0550-spec-verdict-fixes.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改 `e2e/t0550-wsl-acceptance.spec.ts` 與本工單檔；不改產品程式碼（`src/**`、`electron/**`、`scripts/**`、`package.json`）。未設 opt-in 變數時全 skip 的行為不得改變（實測）。"
  - "🔴 WSL 實機條件：只動 `Ubuntu-24.04` 的 `~/.local/bat-server`、`~/.local/share/bat-server`、`~/.config/systemd/user/bat-server.service`。動之前先備份為 `*.bak-0.6.1-pre.5-t0560`（含資料目錄）；**不要刪** T0559 的 `*.bak*-t0559` 備份。結束狀態必須是 `version: 0.6.1-pre.5`、active / enabled、9877 由 MainPID LISTEN、cert `dd0bc13f…` / token `bfc48f5c…` sha256 不變；做不到就用本單備份還原再回報 FAILED。"
  - "🔴 使用者自己的 BAT（9876）與其 profile 一律不動；只用隔離實例。不按工具安裝按鈕、不啟動模型。"
  - "🔴 commit 用 `git add` 後 `git commit --only e2e/t0550-wsl-acceptance.spec.ts _ct-workorders/T0560-t0550-spec-verdict-fixes.md`（`src/styles/settings.css` 的 M 不是你的變更）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要呼叫 `bat-terminal.mjs --close-worker`；通知塔台之後不要再執行任何指令。"
---

# T0560 — `t0550-wsl-acceptance.spec.ts` 判定修正

## 背景

T0559（安裝版 pre.5、WSL pre.4 → pre.5）產品行為全部達成，但 spec 有兩項誤判 FAIL，另有一處說明過時。細節見 `T0559-wsl-e2e-pre5-upgrade-bug138-139-141.md` 回報區「遭遇問題」：

1. **`T0554.profiles-untouched`**：前後比對整份 profile JSON（只遮 token）。renderer 的 `workspace:save`（30 s autosave）會呼叫 `profileManager.save()`，更新 local profile 的 `updatedAt`。測試跨過 30 s 就 FAIL。
2. **`A3.clean-install`**：要求安裝目錄 `du` 變小，但前提是舊樹含有新 bundle 已移除的套件。pre.4 起 bundle 已瘦身，跨版升級大小可能不變（390 → 390 MiB），同版重裝也不會變小（T0554 同樣誤判）。
3. **`A3.leftovers`** 的說明文字仍是 T0552 前的舊敘述（「解壓覆蓋、舊 bundle 檔案留著」）。

## 任務

1. `T0554.profiles-untouched`：比對時排除 `updatedAt`（或只比 profile 數量、id、type 與 remote / wsl 相關欄位）。目的不變：取消後不得新增、刪除或改動任何 remote profile。
2. `A3.clean-install`：改成在精靈執行前於舊安裝樹植入 canary（例如 `<root>/.t0560-canary` 與 `<root>/node_modules/t0560-stale-canary/`），升級後兩者都必須不存在；保留既有的 `.bat-new` / `.bat-old` 無殘留、資料目錄 cert / token 仍在、STALE_PACKAGES 不存在等條件；`du` 改為 INFO 證據，不再作為判定條件。canary 只在 `UPGRADE_RUNNING` 模式植入（與現有判定的啟用條件一致）；植入失敗時本項 FAIL 並寫出原因。
3. `A3.leftovers`：說明改成目前行為（乾淨覆蓋：先解到 `.bat-new` 再換入，舊樹移除）。
4. 驗證：
   - 未設任何 opt-in 變數：`npx playwright test e2e/t0550-wsl-acceptance.spec.ts` 全 skip。
   - WSL 實機（安裝版 pre.5 exe，server 目前也是 pre.5，同版重裝）：
     ```powershell
     $env:BAT_E2E_T0550='1'
     $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
     $env:BAT_E2E_T0550_VERSION='0.6.1-pre.5'
     $env:BAT_E2E_T0554_CANCEL_AFTER_INSTALL='1'
     npx playwright test e2e/t0550-wsl-acceptance.spec.ts -g "T0554"
     Remove-Item Env:BAT_E2E_T0554_CANCEL_AFTER_INSTALL
     $env:BAT_E2E_T0550_UPGRADE_RUNNING='1'
     npx playwright test e2e/t0550-wsl-acceptance.spec.ts -g "A1-A3"
     ```
     期望 `T0554.profiles-untouched` 與 `A3.clean-install` 皆 PASS（T0554 測試請刻意讓 before / after 跨過 30 s 以上，例如在 before 之後等待，以證明 `updatedAt` 已被排除）。
   - `npx tsc --noEmit` 不涵蓋 e2e，至少確認 `npx playwright test --list e2e/t0550-wsl-acceptance.spec.ts` 可解析。
5. 結束狀態檢查（memory_overrides 第 2 條），回報區列出 results.json 相關項目；填狀態、commit、通知塔台（yolo：`bat-notify.mjs --submit`，`--source "T0560"`），之後保持閒置。

## 驗收條件

- [x] 三處修改完成，未設 opt-in 時全 skip（實測）
- [x] WSL 實機：`T0554.profiles-untouched`（跨過 30 s）與 `A3.clean-install`（canary）PASS，其餘既有判定不退步
- [x] 結束狀態：pre.5、active / enabled、9877、cert / token 不變；備份路徑寫入回報區
- [x] commit 只含 spec 與本工單檔

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

**DONE**。三處 spec 修改完成；未設 opt-in 全 skip（實測）；WSL 實機 `T0554.profiles-untouched`（跨 35 s，`updatedAt` 確實被 autosave 改動且已排除）與 `A3.clean-install`（canary）皆 PASS，其餘既有判定未退步；結束狀態符合 memory_overrides 第 2 條。

### 產出摘要

**Landing check**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `e2e/t0550-wsl-acceptance.spec.ts` 存在；C-2 無 `branch` 欄位（`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

**Spec 修改**（`e2e/t0550-wsl-acceptance.spec.ts`，只此一檔）：

1. `T0554.profiles-untouched`：`ProfileRow` 加 `updatedAt?`；新增 `comparable()` = `redact()` 後把 `updatedAt` 設為 `undefined`（`JSON.stringify` 略過），比對其餘全部欄位（數量、id、name、type、targetOS、wslDistro、remote*、createdAt…）。記下取 before 的時間，取 after 前不足 35 s 就補等到 35 s（保證跨過一次 30 s autosave）。evidence 列出間隔秒數、比對內容與「被忽略的 `updatedAt` 變動」。
2. `A3.clean-install`：新增 `CANARIES = ['.t0560-canary', 'node_modules/t0560-stale-canary']`。只在 `UPGRADE_RUNNING` 時於精靈執行前植入（`.t0560-canary` 檔 + `node_modules/t0560-stale-canary/package.json`），並逐一 `test -e` 回報 `planted` / `missing`。判定 = 兩個都 planted **且** 升級後都不存在 **且** STALE_PACKAGES 不存在 **且** 無 `.bat-new` / `.bat-old` **且** data dir 有 `server-cert.json` / `server-token.json`；植入失敗 → FAIL 並寫出植入輸出。`du` 改為最後一行 INFO 證據（`(info only)`），不參與判定。精靈未完成而 throw 前、以及 canary 仍殘留（FAIL）時會移除 canary，不留在使用者的安裝樹。
3. `A3.leftovers` 說明改為：`wsl:install-bundle replaces the install root cleanly (T0552): extracts to <root>.bat-new, swaps it in, removes the old tree`。
4. 檔頭 UPGRADE_RUNNING 註解補一句 canary 判定與 `du` 只作證據的原因。

**驗證**：

| 項目 | 結果 | 證據 |
|---|---|---|
| `npx playwright test --list e2e/t0550-wsl-acceptance.spec.ts` | PASS | 解析成功，6 tests |
| 未設任何 `BAT_E2E*`：`npx playwright test e2e/t0550-wsl-acceptance.spec.ts` | PASS | `6 skipped` |
| WSL 實機 `-g "T0554"`（安裝版 pre.5 exe，server pre.5，同版重裝） | PASS（1 passed，38.9 s） | log `%TEMP%\bat-t0560\run-t0554.log` |
| WSL 實機 `-g "A1-A3"`（`BAT_E2E_T0550_UPGRADE_RUNNING=1`） | PASS（1 passed，21.4 s） | log `%TEMP%\bat-t0560\run-a1a3.log` |

證據目錄 `BAT_E2E_T0550_EVIDENCE_DIR=%TEMP%\bat-t0560\evidence`（與 T0559 的 `bat-t0559` 分開）。`results.json`：

| key | verdict | 證據摘要 |
|---|---|---|
| T0554.failed-after-install | PASS | fetch-fingerprint 注入失敗；新 bundle MainPID 18355 執行中；marker absent；`.bat-old` 保留 |
| T0554.restored | PASS | marker present；inode 11896 → 11896；unit sha256 `937940b4…` 不變；port 9877、指紋 `22:3A:E4:C7…` 不變；無 `.bat-*` |
| T0554.service-running | PASS | MainPID 10123 → 18355（新）→ 19045（還原），9877 LISTEN |
| **T0554.profiles-untouched** | **PASS** | profiles 1 → 1，**35 s apart**；`updatedAt changed (ignored): Default 1792131818753 → 1792131848990`（證明 autosave 確實改了 `updatedAt`，舊判定會 FAIL） |
| T0554.rollback-log | INFO | Keeping port 9877 / Restored unit / Restored bundle / Started previous service |
| A0.port-while-running | INFO | 無 existing 時 picker → 9878 |
| A1 | INFO（upgrade-running 不判） | 由 `server-bundle-v0.6.1-pre.5` release 下載 166,362,972 bytes |
| A2.server | PASS | `0.6.1-pre.5` active MainPID 20790，9877 由 MainPID LISTEN，profile `remotePort` 9877 |
| A2.identity-kept | PASS | port 9877 → 9877；指紋不變，精靈 pin 同一指紋 |
| A2.upgrade-running | PASS | seed profile `t0552-seed-ubuntu-24-04` 被更新（token 已換）、未新建 |
| A2.profile-opens | PASS | remote shell → `T0550-<使用者>@GXDEVPC02-25` |
| A3 | PASS | helpers / `bin/node` v24.22.0 / `bin/bat-server` 皆在 |
| A3.leftovers | INFO | 新說明文字；`node_modules: @anthropic-ai @lydell` |
| **A3.clean-install** | **PASS** | canaries planted（`.t0560-canary`、`node_modules/t0560-stale-canary`）→ 升級後 left: none；stale none；`.bat-*` none；data dir 有 cert / token；`390 MiB → 390 MiB (info only)` |

**結束狀態**（2026-10-16T14:24:49+0800）：

| 項目 | 值 |
|---|---|
| bundle | `0.6.1-pre.5`（`package.json`） |
| service | `active` / `enabled`，MainPID 20790 |
| unit | `BAT_SERVER_PORT=9877`，sha256 `937940b4…`（與開始時相同） |
| LISTEN | `127.0.0.1:9877` pid=20790（= MainPID） |
| cert / token sha256 | `dd0bc13f…` / `bfc48f5c…`（不變） |
| `.bat-new` / `.bat-old`、canary | 皆無 |
| 本單備份 | `~/.local/bat-server.bak-0.6.1-pre.5-t0560`、`~/.config/systemd/user/bat-server.service.bak-0.6.1-pre.5-t0560`、`~/.local/share/bat-server.bak-0.6.1-pre.5-t0560` |
| T0559 備份 | 3 份仍在（未動） |
| 使用者 BAT | 9876 仍由原行程 pid 29492 LISTEN，未操作；隔離實例 userData（`BetterAgentTerminal-runtime-e2e-*`）已全部移除 |

**Commit**：`git commit --only e2e/t0550-wsl-acceptance.spec.ts _ct-workorders/T0560-t0550-spec-verdict-fixes.md`（`src/styles/settings.css` 未納入）。hash 依慣例留給塔台填 `commit` 欄。

### 互動紀錄

無（`CT_MODE=yolo`、`CT_INTERACTIVE=0`）。

### Renew 歷程

無。

### 遭遇問題

無。觀察：A1-A3 的精靈這次只花 14 s，比 T0554 的取消流程短；`profiles-untouched` 的 35 s 補等只在 T0554 測試內，不影響 A1-A3。

### 回報時間

2026-10-16T14:24:49+0800

---

## 塔台收單（第六十七 session，2026-10-16T14:26:09+0800）

- ✅ **T0560 已確認 DONE**：commit `ace4f96a`（spec + 本單）。塔台審閱 diff：`comparable()` 只排除 `updatedAt`、T0554 比對至少跨 35 s；`A3.clean-install` 以植入的 canary 判定（植入失敗即 FAIL），`du` 降為證據；`A3.leftovers` 說明更新；canary 在失敗路徑會清除。
- 塔台複驗：未設 `BAT_E2E*` → `6 skipped`；WSL `0.6.1-pre.5` active、9877 LISTEN、cert / token sha256 不變、`.bat-*` / canary 無殘留。
- WSL 備份（T0559 pre.4 ×3 + T0560 pre.5 ×3，合計 781 MiB）待使用者決定刪除。
