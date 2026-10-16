---
schema_version: 1
schema_kind: workorder
id: T0560
title: "e2e `t0550-wsl-acceptance.spec.ts` 判定修正：`T0554.profiles-untouched` 排除 autosave 造成的 `updatedAt` 變動、`A3.clean-install` 改用 canary 判定、`A3.leftovers` 舊說明（T0559 兩項誤判 FAIL）"
type: test
status: TODO
repo: better-agent-terminal
project: BUG-139
priority: P3
sizing: XS
created_at: "2026-10-16T14:20:40+0800"
updated_at: "2026-10-16T14:20:40+0800"
started_at: ""
completed_at: ""
commit: ""
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

- [ ] 三處修改完成，未設 opt-in 時全 skip（實測）
- [ ] WSL 實機：`T0554.profiles-untouched`（跨過 30 s）與 `A3.clean-install`（canary）PASS，其餘既有判定不退步
- [ ] 結束狀態：pre.5、active / enabled、9877、cert / token 不變；備份路徑寫入回報區
- [ ] commit 只含 spec 與本工單檔

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
