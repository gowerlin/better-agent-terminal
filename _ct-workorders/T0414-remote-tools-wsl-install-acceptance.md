---
schema_version: 1
schema_kind: workorder
id: T0414
title: "PLAN-037 G：WSL Ubuntu-24.04 實機安裝驗收（協定層自動化）——經 headless PTY 實際執行 claude / codex / uv / gh / rg 食譜，驗證完成標記、重新偵測與 T0407 剩餘風險"
type: test
status: PENDING
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: M
created_at: "2026-10-05T03:44:40+08:00"
target_version: next
depends_on:
  - T0408
  - T0409
  - T0411
  - T0412
related:
  - "T0407 回報區「剩餘風險」與建議清單 G 的 8 項驗收重點"
  - "T0409 回報區「剩餘風險」；T0412 回報區「T0414 實機步驟」（UI 部分由使用者另行操作）"
affects_files:
  - _ct-workorders/T0414-remote-tools-wsl-install-acceptance.md
  - scripts/remote-tools-install-check.mjs
  - scripts/__tests__/remote-tools-install-check.test.mjs
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "✅ **使用者已同意（2026-10-05 03:44）在 WSL `Ubuntu-24.04` 實際安裝**：claude、codex、uv（使用者空間 install.sh → `~/.local/bin`）、gh、rg（apt + sudo；此帳號 sudo 免密碼）。這是本 PLAN 第一次允許實際安裝。"
  - "🔴 只能在 **WSL `Ubuntu-24.04`** 安裝；不得動 Windows 主機上的任何工具、不得在其他 distro / 機器安裝。只安裝上列 5 個工具，不另裝其他套件（apt 依賴除外）。"
  - "🔴 安裝一律經 **headless bat-server 的 PTY**（`pty:create` → `pty:write`），指令一律取自 `buildInstallPlan()` / `buildUpdatePlan()` + `wrapWithSentinel()`，與 BAT 實際路徑相同；不得手打或改寫指令。"
  - "🔴 不得 restart / redeploy `bat-server.service`；不得修改 `~/.local/bat-server`；不得登入任何工具（不執行 `claude auth login` / `codex login` / `gh auth login`）；不讀任何 credential 內容。"
  - "🔴 自建 PTY 一律帶唯一前綴並在 `finally` kill；不碰其他 PTY。"
  - "🔴 不改產品程式碼（`electron/`、`src/`）。發現產品 bug 只回報。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0414 — WSL 實機安裝驗收（PLAN-037 G）

## 元資料
- **工單編號**：T0414
- **任務名稱**：remote-tools WSL 實機安裝驗收
- **狀態**：PENDING
- **建立時間**：2026-10-05 03:44 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

PLAN-037 A-F（T0408-T0413）已完成，WSL server 已部署 T0411（smoke 10/10，S10 偵測：git / curl / bash / python3 ok；claude / gh / codex / rg / uv / node missing）。本單用**協定層**（同 `scripts/smoke-remote-headless.mjs` 的 client：TLS pin + token）實際在 WSL 上跑安裝，驗證整條路徑在真實環境可行。精靈 / 設定頁 / 跨視窗的 UI 點擊由使用者另外以新 build 操作（T0412 回報區步驟），不在本單。

## 範圍

1. 建 `scripts/remote-tools-install-check.mjs`（可重用的開發工具；沿用 smoke 的連線與 `--target wsl:<distro>` 解析，可 import smoke 的 client 或抽共用）：
   - `remote-tools:detect` → 以 `normalizeRecipeEnv` + `buildInstallPlan` / `buildUpdatePlan` 產生 plan（`src/lib/remote-tools/*` 為 TS，`.mjs` 如何引用由 Worker 決定：esbuild 轉譯或 `tsx`，回報說明）
   - 開 PTY（cwd `$HOME`、shell `/bin/bash`、**不帶 agentPreset**）→ 寫入 `wrapWithSentinel(plan.command, nonce) + '\r'` → `createSentinelMatcher` 判定 exit code → 再 `remote-tools:detect` 比對
   - 預設 dry-run（只印 plan）；`--yes` 才實際執行；`--tool <id>` 指定工具；輸出每步證據
   - 若做成 commit 的工具，補單元測試（參數解析 / dry-run 不寫入）
2. 依序實際安裝：**claude → uv → codex → rg → gh**，每個記錄：指令、exit code、耗時、安裝前後偵測（status / path / version / serverVisible）
3. 驗收重點（T0407 G）：
   - ① 完成標記：每個安裝都正確回報 exit code
   - ② 重新偵測：安裝後 status 變 `ok`（或合理的 `not-on-path`，說明原因）
   - ③ 新 login shell 看得到 `~/.local/bin`：安裝後**新開** PTY 跑 `command -v claude codex uv`
   - ④ interop 遮蔽：login 視角下 codex 是否從 `interop-only` 變為 `~/.local/bin/codex`（記錄 PATH 順序）
   - ⑤ `DISABLE_AUTOUPDATER=1` 環境下 claude install.sh / `claude install` 是否成功；並確認安裝 PTY 的 env **沒有** `DISABLE_UPDATES`
   - ⑥ `codex login status` 未登入時的 exit code（印出 code，丟棄 stdout）
   - ⑦ sudo 需要密碼的情境：此帳號為 NOPASSWD，**無法覆蓋**，標 NOT COVERED
   - ⑧ Docker root 無 sudo：**無法覆蓋**，標 NOT COVERED
   - 另：claude `buildUpdatePlan`（`claude update`）跑一次；codex installer 對 shell profile 的修改內容（列出新增的區塊，不改它）
4. 安裝後跑一次 `npm run smoke:remote:headless -- --target wsl:Ubuntu-24.04`，確認仍 10/10，S10 反映新狀態

## 驗收條件

- [ ] 5 個工具的安裝結果表（含 ①②③④）與原始證據
- [ ] ⑤ ⑥ 的結論；⑦ ⑧ 標 NOT COVERED
- [ ] 安裝後 smoke 10/10
- [ ] 若有 commit 的腳本：`npm run test:unit` 全綠（基線 1614）；`npx tsc --noEmit` ≤ 40
- [ ] 回報區列出 WSL 上被修改的檔案 / 目錄清單（`~/.local/bin/*`、`~/.local/share/claude`、`~/.codex`、shell profile、apt 套件），供使用者知悉

## Sub-session 執行指示
1. 讀本工單 + T0407 回報區（§2、剩餘風險、建議清單 G）+ T0409 / T0412 回報區 + `scripts/smoke-remote-headless.mjs`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先 dry-run 全部工具並把 plan 寫進回報區 → 再 `--yes` 依序安裝
4. 填回報區；完成寫 **`DONE`**；某個工具安裝失敗但腳本正確 → 仍 `DONE`，失敗列入「遭遇問題」交塔台
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### dry-run plan

### 安裝結果

### 驗收重點 ①-⑧

### WSL 上被修改的項目

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
