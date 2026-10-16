---
schema_version: 1
schema_kind: workorder
id: T0559
title: "WSL 實機 e2e（安裝版 pre.5）：精靈 pre.4 → pre.5 升級沿用 port / profile、乾淨覆蓋（BUG-138 / 139）、升級後取消還原（BUG-141），並回歸 PLAN-036 / 037"
type: verification
status: TODO
repo: better-agent-terminal
project: BUG-138
priority: P2
sizing: S
created_at: "2026-10-16T14:12:46+0800"
updated_at: "2026-10-16T14:12:46+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.5（已安裝；不改產品程式碼）"
depends_on: []
related:
  - "T0550（WSL 實機驗收 spec `e2e/t0550-wsl-acceptance.spec.ts`、以安裝版 exe 起隔離實例）"
  - "T0552（BUG-138 / 139，`BAT_E2E_T0550_UPGRADE_RUNNING=1`）"
  - "T0554（BUG-141，`BAT_E2E_T0554_CANCEL_AFTER_INSTALL=1`；當時 A3.clean-install 因同版重裝記 FAIL，跨版才適用）"
affects_files:
  - _ct-workorders/T0559-wsl-e2e-pre5-upgrade-bug138-139-141.md
  - e2e/t0550-wsl-acceptance.spec.ts
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改任何產品程式碼（`src/**`、`electron/**`、`scripts/**`、`package.json`）。只有 spec 本身阻擋本單（例如判定寫死 pre.4、安裝版 exe 無法注入失敗）時，才可以最小幅度修改 `e2e/t0550-wsl-acceptance.spec.ts`，並在回報區逐項說明；預設行為（未設 opt-in 變數時全 skip）不得改變。"
  - "🔴 WSL：只動 `Ubuntu-24.04` 的 `~/.local/bat-server`、`~/.local/share/bat-server` 與 `~/.config/systemd/user/bat-server.service`。動之前先備份：`cp -a ~/.local/bat-server ~/.local/bat-server.bak-0.6.1-pre.4-t0559`、unit 檔 `.bak-0.6.1-pre.4-t0559`、資料目錄 `~/.local/share/bat-server.bak-t0559`；備份**保留不刪**，路徑寫進回報區（由使用者決定何時刪）。"
  - "🔴 結束狀態必須是：`version: 0.6.1-pre.5`、service active / enabled、unit `BAT_SERVER_PORT=9877`（或命令列 `--port 9877`）且由 MainPID 在 `127.0.0.1:9877` LISTEN、憑證指紋與開始時相同（開始時先記錄 `server-cert.json` / `server-token.json` 的 sha256 與指紋）。無法達成時用備份還原到開始狀態（pre.4、9877、同指紋）再回報 FAILED。"
  - "🔴 使用者自己的 BAT（9876）與其 profile 一律不動；只用隔離實例（`--runtime=e2e-…`）。不按工具安裝按鈕、不啟動任何模型（spec 的遠端派工用不存在的 `gemini-cli`）。"
  - "🔴 commit 用 `git add` 後 `git commit --only <本單檔> [e2e/t0550-wsl-acceptance.spec.ts]`（`src/styles/settings.css` 的 M 狀態不是你的變更）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要呼叫 `bat-terminal.mjs --close-worker`；通知塔台之後不要再執行任何指令。"
---

# T0559 — WSL 實機 e2e（安裝版 pre.5）：BUG-138 / 139 / 141 + 回歸

## 背景

`0.6.1-pre.5` 已安裝於本機（`C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`）。WSL `Ubuntu-24.04` 的 bat-server 目前是 **0.6.1-pre.4**，systemd user service 在 9877 執行中（塔台 14:12 確認，無舊備份）。使用者自己的 BAT 有一個 WSL profile 依賴 9877 與該憑證。

BUG-138 / 139 / 141 的修正（T0552 / T0554）已隨 pre.5 發佈，但當時的實機驗證都用本機 source build，而且是同版重裝。本單用**安裝版 pre.5 exe** 做一次真正的跨版升級（pre.4 → pre.5），把可自動化的部分跑完。

## 任務

1. 照 ct-exec 開工。記錄開始狀態：bundle 版號、service 狀態、unit 內容中的 port、`127.0.0.1:9877` 的 LISTEN 與 MainPID、`server-cert.json` / `server-token.json` sha256、憑證指紋、`~/.local/bat-server` 頂層目錄與 `node_modules` 頂層套件清單；完成備份（見 memory_overrides）。
2. **BUG-141（取消還原）**，先跑：
   ```powershell
   $env:BAT_E2E_T0550='1'
   $env:BAT_E2E_T0554_CANCEL_AFTER_INSTALL='1'
   $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
   $env:BAT_E2E_T0550_VERSION='0.6.1-pre.5'
   npx playwright test e2e/t0550-wsl-acceptance.spec.ts -g "T0554"
   ```
   期望：精靈換入 pre.5 → 注入 fetch-fingerprint 失敗 → 取消 → install tree、unit、執行中的 service 都回到 **pre.4**、9877、同指紋，`.bat-new` / `.bat-old` 無殘留。
   若安裝版 exe 無法注入失敗（spec 依賴 source build 的機制），改用本機 source build（HEAD 與 pre.5 的產品程式碼相同，`git diff 6ad3c089 HEAD -- src electron scripts` 應為空；先 `npx vite build`，不設 `BAT_E2E_EXECUTABLE`），並在回報區寫明是哪一種。
3. **BUG-138 / 139（升級，舊 server 執行中）+ 回歸**，接著跑完整 spec（清掉 `BAT_E2E_T0554_CANCEL_AFTER_INSTALL`）：
   ```powershell
   Remove-Item Env:BAT_E2E_T0554_CANCEL_AFTER_INSTALL
   $env:BAT_E2E_T0550_UPGRADE_RUNNING='1'
   npx playwright test e2e/t0550-wsl-acceptance.spec.ts
   ```
   期望：A1–A3（含 `A2.upgrade-running`：同 port、既有 profile 被更新而不是新建；`A3.clean-install`：舊 bundle 已不提供的套件不再殘留，跨版升級本項應 PASS）、B4 smoke S1–S13、B5 遠端視窗、C6 工具偵測、A4 離線匯入。
4. 檢查結束狀態（memory_overrides 第 3 條），並把 `<evidence>/results.json` 的每一項 verdict 列進回報區（PASS / FAIL / NEEDS-HUMAN / INFO 與一行證據）。
5. 填 `DONE`（全部可自動化項目 PASS）/ `PARTIAL`（有 FAIL，寫明哪一項與證據）/ `FAILED`；commit；通知塔台（yolo：`bat-notify.mjs --submit`，`--source "T0559"`）。通知後保持閒置。

## 驗收條件

- [ ] 開始狀態與備份路徑已記錄
- [ ] T0554 cancel 結果（含使用哪種 build）與還原後狀態
- [ ] 完整 spec 結果逐項列出；`A2.upgrade-running`、`A3.clean-install` 明確寫 PASS / FAIL
- [ ] 結束狀態符合：pre.5、active / enabled、9877、指紋不變
- [ ] 若有修改 spec：逐項說明原因，且未設 opt-in 變數時仍全 skip（實測）
- [ ] commit 只含本單檔（與必要時的 spec）

## 注意

- 使用者 BAT 若開著 WSL 遠端視窗，升級期間 service 重啟會讓它暫時斷線，之後應自動重連；這不是失敗。
- 時間戳一律以指令取得（R-G001）。

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
