---
schema_version: 1
schema_kind: workorder
id: T0478
title: "README「設定」段資料 / 日誌路徑與 CLAUDE.md Logging 路徑更正 + .vscode Pre-Release task / trigger-prerelease.ps1 未帶版號即拒絕執行"
type: implementation
status: TODO
repo: better-agent-terminal
project: docs
priority: P3
sizing: S
created_at: "2026-10-13T22:08:44+08:00"
started_at: null
updated_at: "2026-10-13T22:08:44+08:00"
completed_at: null
target_version: v0.6.0-pre.4
depends_on:
  - T0477
related:
  - "T0477 回報區「偏離 / 範圍外發現」1 / 3"
  - "CLAUDE.md「Release」：`-f version=` 不可留空（留空走自動遞增 → `4.0.4-pre.1` 類脫節版號）、`gh` 一律帶 `-R`"
affects_files:
  - README.md
  - CLAUDE.md
  - .vscode/tasks.json
  - .vscode/scripts/trigger-prerelease.ps1
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **不得實際觸發 workflow**：驗證 `trigger-prerelease.ps1` 只能測「未帶版號 / 格式錯誤 → 拒絕」路徑；任何會走到 `gh workflow run` 的測試一律禁止（可用 dry-run 參數或 mock，見 B 段）"
  - "🔴 不 push、不建 tag；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況（README 為 i/lf w/crlf）"
  - "🔴 不改 `electron/` 程式碼；路徑以程式碼現況為準來寫文件"
---

# T0478 — 設定 / 日誌路徑文件更正 + Pre-Release task 版號防呆

## A. README「設定」段與 CLAUDE.md「Logging」路徑

背景：README 寫 `%APPDATA%/better-agent-terminal/` 等，但 `electron/main.ts:158` `app.setName('BetterAgentTerminal')`，另有 `--runtime=N` / `BAT_RUNTIME` 讓 userData 變成 `<base>-runtime-<N>`（`main.ts:160-171`）。`electron/logger.ts:84` 有 legacy `debug.log` 搬移邏輯，日誌實際位置可能已不在 userData 根目錄。

1. 以程式碼確認三平台實際 userData 路徑（`app.setName` 對 `getPath('userData')` 的影響、dev 與打包版是否不同、`package.json` `productName` / `build.productName`），以及 `BAT_RUNTIME` 的目錄規則
2. 以 `electron/logger.ts` 確認日誌實際路徑、檔名、是否需要 `BAT_DEBUG=1` 才寫磁碟（README 現寫「設定環境變數 `BAT_DEBUG=1` 啟用磁碟日誌」，請核對）
3. 可用本機證據佐證 Windows（如 `%APPDATA%\BetterAgentTerminal` 是否存在、`BAT_USER_DATA` 環境變數），只讀不改
4. 更新 README「設定」表與「除錯日誌」段；補一行 `BAT_RUNTIME` 多實例資料目錄說明（若屬實）
5. 更新 CLAUDE.md「Logging」節的 log 檔位置（現寫 `~/Library/Application Support/better-agent-terminal/debug.log`），三平台都列或改寫為規則
6. 全 repo `docs/` 與 README 內 grep `better-agent-terminal/debug.log`、`Application Support/better-agent-terminal`、`%APPDATA%/better-agent-terminal`、`.config/better-agent-terminal`，回報區列出；明確過期者在 README / CLAUDE.md 範圍內修，`docs/` 內的只列出不改

## B. `.vscode` Pre-Release task 版號防呆

背景：`.vscode/tasks.json`「CI/CD: 觸發 Pre-Release (GitHub Actions)」不傳 `-Version`，`trigger-prerelease.ps1` 在 `$Version` 為空時不加 `-f version=` → workflow 自動遞增出脫節版號；「(指定版本)」task 的 promptString 可空白送出；input 描述仍為 `2.1.4-pre.1`。

1. `trigger-prerelease.ps1`：`$Version` 為空或不符 `^\d+\.\d+\.\d+-pre\.\d+$`（不帶 `v`）時印出原因與正確用法並 `exit 1`，**不呼叫 `gh`**。移除「留空則自動遞增」的說明 / 分支。確認 `gh` 呼叫帶 `--repo gowerlin/better-agent-terminal`（或 `-R`）
2. 可選：加 `-DryRun` switch 只印出將執行的 `gh` 指令不執行，供驗證用
3. `tasks.json`：刪除不帶版號的「CI/CD: 觸發 Pre-Release (GitHub Actions)」task，或改為同樣要求輸入版號（擇一，回報區說明）；`prereleaseVersion` 描述改為 `X.Y.Z-pre.N（不帶 v，例如 0.6.0-pre.4）`
4. tasks.json 中若有其他 task 引用已刪除的 label（如 `dependsOn`），一併處理；確保 JSON（含註解 JSONC）仍可被 VSCode 解析
5. 驗證（不得觸發 workflow）：
   - `pwsh -File .vscode/scripts/trigger-prerelease.ps1` → exit 1、未呼叫 gh
   - `-Version v0.6.0-pre.4`、`-Version 0.6.0` → exit 1
   - 若有 `-DryRun`：`-Version 0.6.0-pre.4 -DryRun` → exit 0 且印出含 `-R`/`--repo` 與 `-f version=0.6.0-pre.4` 的指令
   - 回報區附各指令輸出

## 驗收條件

- [ ] README「設定」/「除錯日誌」與 CLAUDE.md「Logging」路徑與程式碼一致，回報區附程式碼依據（檔案:行）
- [ ] `trigger-prerelease.ps1` 未帶 / 錯誤格式版號一律 exit 1 且不呼叫 gh
- [ ] tasks.json 無「不帶版號觸發」的 task；描述不含 `2.1.4`
- [ ] 回報區附 `git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + README「設定」段 + CLAUDE.md「Logging」+ `electron/main.ts:150-175` + `electron/logger.ts` + `.vscode/tasks.json` + `.vscode/scripts/trigger-prerelease.ps1`
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
