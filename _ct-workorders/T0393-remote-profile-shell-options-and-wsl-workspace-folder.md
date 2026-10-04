---
schema_version: 1
schema_kind: workorder
id: T0393
title: "PLAN-036 P0-E：遠端視窗 shell 清單依遠端 OS 過濾 + 工作區資料夾挑選預設 WSL 內部目錄（`/mnt/c` 提示）"
type: implementation
status: TODO
priority: P1
sizing: S
created_at: "2026-10-05T00:02:55+08:00"
updated_at: "2026-10-05T00:02:55+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: [T0390]
related:
  - "PLAN-036 / D129（使用者 2026-10-05 00:02 裁決納入 P0）"
  - "使用者實機回報：WSL profile 視窗的終端設定只有 Windows shell；新增工作區開的是 Windows 目錄"
affects_files:
  - src/components/SettingsPanel.tsx
  - src/types/index.ts
  - src/App.tsx
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/locales/
  - src/components/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。"
  - "🔴 不得碰使用者 WSL 內的 `bat-server.service` / `~/.local/bat-server`（部署交使用者以 T0391 工具執行）。"
  - "🔴 Renderer 不得 import Node builtin（D090）；renderer log 用 `window.electronAPI.debug.log`。child_process 一律 `execFile` / `spawn` + array args，timeout 必設，distro 過白名單。"
  - "⚠️ 本機 profile 行為不得改變（shell 清單、資料夾對話框）。使用者可見文案走 i18n。不 push。"
---

# T0393 — 遠端視窗 shell 選項與 WSL 工作區目錄

## 背景（使用者實機回報，塔台 2026-10-05 00:02 複核）

1. **shell 清單**：`src/components/SettingsPanel.tsx:109` `SHELL_OPTIONS.filter(opt => opt.platforms.includes(platform))` 以**本機平台**過濾 ⇒ WSL profile 視窗只看到 pwsh / powershell / cmd，沒有 bash / zsh / sh。遠端視窗的設定是遠端的（`settings:load/save` 代理到 headless，T0385），shell 會在遠端 Linux 執行
2. **工作區目錄**：新增工作區走 `src/App.tsx:683` `dialog.selectFolder()` → `electron/main.ts:3107` 本機 `dialog.showOpenDialog`（不代理），預設停在 Windows 目錄。路徑轉換已存在（`electron/remote/path-translator.ts`：`C:\…` ↔ `/mnt/c/…`、`\\wsl$` / `\\wsl.localhost\<distro>\…` ↔ `/…`），所以技術上能選 WSL 內部目錄，但沒有任何引導；選 `/mnt/c` 下的目錄在 WSL 內 I/O 慢、git / npm 易遇權限與換行問題

## 範圍

1. **shell 清單依遠端 OS**：遠端 profile 視窗以 profile `targetOS`（`wsl-linux` / `ssh-linux` / docker 等 → `linux`；mac 目標 → `darwin`）決定過濾平台，本機視窗維持 `process.platform`。決定方式（renderer 如何得知自己是遠端視窗及其 OS）由 Worker 選，沿用既有 API 優先
2. **WSL 工作區資料夾挑選**：WSL profile 視窗新增工作區時，對話框 `defaultPath` 設為 `\\wsl.localhost\<distro>\home\<user>`（`<user>` 取得方式由 Worker 決定，例如 profile 已存資訊或 `wsl.exe -d <distro> -- whoami`，distro 過白名單、timeout 必設）；取不到時退回原行為
3. **`/mnt/c` 提示**：WSL profile 視窗選到 Windows 磁碟路徑（轉換後落在 `/mnt/<drive>/`）時，提示效能與相容性風險並建議放在 WSL 內部目錄；**不阻擋**（使用者可繼續）
4. SSH / Docker：本單只做第 1 項（shell 清單）；資料夾挑選維持原行為，回報區記錄 SSH 需要遠端資料夾瀏覽器（屬 P2 fs）

## 驗收

- unit：遠端 `wsl-linux` / `ssh-linux` 視窗 shell 清單含 bash / zsh、不含 pwsh / cmd；本機 win32 視窗不變；`defaultPath` 組裝與 distro 白名單；`/mnt/c` 判定
- `npm run test:unit` 全綠；`npx vite build` exit 0；`npx tsc --noEmit` ≤ baseline（以派發時 HEAD 為準，回報數字）
- **P0 實機驗收（交使用者，與 T0390 合併）**：WSL profile 視窗設定可選 bash → 新增工作區對話框開在 WSL home → 選 `/home/<user>/<dir>` 開終端 `pwd` 正確；另選一個 `C:\…` 目錄出現提示、終端 `pwd` 為 `/mnt/c/…`

## Sub-session 執行指示

1. 讀取本工單 + PLAN-036 + T0390 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
