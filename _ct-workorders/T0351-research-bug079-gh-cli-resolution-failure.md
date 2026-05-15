---
schema_version: 1
schema_kind: workorder
id: T0351
title: Research BUG-079 Root Cause（BAT GitHub 功能找不到 gh CLI）
type: research
status: DONE
sizing: S
created_at: "2026-05-15T10:42:00+08:00"
started_at: "2026-05-15T10:54:35+08:00"
completed_at: "2026-05-15T10:57:21+08:00"
updated_at: "2026-05-15T10:57:21+08:00"
renew_count: 0
affects_files:
  - _ct-workorders/T0351-research-bug079-gh-cli-resolution-failure.md
  - _ct-workorders/BUG-079-bat-github-feature-cannot-find-gh-cli.md
---
# T0351 — Research BUG-079 Root Cause

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0351 |
| 類型 | research（root cause 偵察 + 修復方案提案） |
| 所屬 | BUG-079 — BAT GitHub 功能找不到 gh CLI |
| 狀態 | ✅ DONE |
| 開始時間 | 2026-05-15 10:54 (UTC+8) |
| 完成時間 | 2026-05-15 10:57 (UTC+8) |
| 建立時間 | 2026-05-15 10:42 (UTC+8) |
| Sizing | S（estimate 20-40 min wall；純讀取程式碼 + log 分析，不修改檔案） |
| 依賴 | BUG-079 單 / `electron/`、`src/` 程式碼 / BAT 啟動 log 檔（可選） |
| 後續 | 結論清晰 → 派 1 張 fix 工單（T####）；結論不足 → Renew 補方向 |
| 互動旗標 | `--mode ask --interactive`（Worker 可在環境細節需澄清時提問） |
| Renew 次數 | 0 |
| 工作目錄 | main repo（純讀取） |

## 背景

使用者在 BAT 內部終端嘗試使用 GitHub PR / Issue 功能時，BAT 回報「找不到 gh」。系統實際已安裝 GitHub CLI v2.92.0：

```
$ where gh
C:\Program Files\GitHub CLI\gh.exe

$ gh --version
gh version 2.92.0 (2026-04-28)
```

外部 shell 解析正常，BAT 內失敗 → 環境注入或解析邏輯問題的可能性高。

## 研究目標

回答以下 4 個核心問題：

1. **呼叫點**：BAT 哪個模組/函式呼叫 `gh`？（提供 file:line）
2. **解析機制**：如何尋找 gh binary？（`process.env.PATH` 繼承？硬編 binary 名？execFile + 'gh'？）
3. **失敗原因**：為何在 BAT spawn context 下找不到，但在外部 shell 找得到？（PATH 差異 / spawn options / cwd 影響？）
4. **修復方向**：給出 1-3 個候選修復方案 + 各自 trade-off（不需實作，給塔台 + 使用者拍板）

## 執行步驟

### Phase 1 — 呼叫點定位（5-10 min）

1. `grep -rn "gh.exe\|'gh'\|\"gh\"\| gh " electron/ src/ scripts/`
2. 排除 git 相關（`git push gh-pages` 之類誤判）
3. 確認 PR / Issue 功能在哪個 panel / IPC handler
4. 列出 1-N 個呼叫點，標註 file:line

**產出**：呼叫點清單（含 file:line 與一行說明）

### Phase 2 — spawn 環境分析（10-15 min）

對每個呼叫點：

1. 用什麼 child_process API？（`exec` / `execFile` / `spawn`）
2. 是否傳 `env` option？env 來自 `process.env`、自製 envWithUtf8、或其他？
3. shell:true 還是 shell:false？
4. cwd 是什麼？
5. binary 是寫死字串 `'gh'` 還是經過解析？

對比參考：`electron/pty-manager.ts` 的 `envWithUtf8`、`electron/claude-runtime-router.ts` 的 binary resolution、CLAUDE.md「Child Process Spawning」段落。

**產出**：每個呼叫點的 spawn 配置摘要（表格）

### Phase 3 — 根因假說與重現（5-15 min）

1. 列 2-3 個最可能假說（PATH 缺 / shell 差異 / binary 解析錯）
2. 若 BAT log 檔可讀，grep `gh` 找實際 spawn 錯誤訊息
3. 評估哪個假說最符合「外部 OK / BAT 內失敗」的對比現象

**產出**：根因假說優先序 + 證據

### Phase 4 — 修復方案候選（5-10 min）

提出 1-3 個候選方案，每個方案說明：

- 做什麼（changes summary）
- 影響範圍（哪些檔案）
- Trade-off（風險 / 邊界 case / 對既有行為衝擊）
- Sizing 預估（S/M/L）

候選方向參考（不限於此）：

- **方案 A**：spawn 時顯式繼承 `process.env.PATH` 並 prepend GitHub CLI 安裝目錄
- **方案 B**：改用 execFile + array args 解析 `where gh` 取絕對路徑後再 spawn
- **方案 C**：BAT 設定面板加「Custom gh path」欄位，類似 Claude Runtime 的 customPath 模式
- **方案 D**：若找不到 gh，前端顯示安裝提示（含官方下載連結），不靜默失敗

## 互動規則

- Worker 若需確認環境細節（OS 版本、npm-global / winget 安裝管道等），可結構化提問
- 每次提問上限 3 個（由 config `research_max_questions` 控制）
- Worker 不修改任何 production code，僅讀取

## 預期產出（回報區應包含）

1. **呼叫點清單**（file:line + 一行說明）
2. **spawn 配置摘要表**
3. **根因假說優先序**（含證據）
4. **修復方案候選**（1-3 個，含 trade-off 與 sizing）
5. **建議下一步**：派哪個方案？是否需要先補環境資訊？

## 不在本工單範圍

- 不實作任何修復（修復另派 T#### fix 工單）
- 不改 BUG-079 元資料（除非發現需補根因確認，僅 append 不覆寫）
- 不跑 build / test

## 回報區

### 完成狀態

DONE — research 已完成，可派後續 fix 工單。

### 呼叫點清單

| file:line | 呼叫點 | 說明 |
|-----------|--------|------|
| `electron/main.ts:2590` | `github:check-cli` | GitHub panel consent 後先檢查 `gh --version` 與 `gh auth token`。 |
| `electron/main.ts:2620` | `github:pr-list` | PR 列表，`execFileSync('gh', ['pr', 'list', ...])`。 |
| `electron/main.ts:2631` | `github:issue-list` | Issue 列表，`execFileSync('gh', ['issue', 'list', ...])`。 |
| `electron/main.ts:2642` | `github:pr-view` | PR 詳情，`execFileSync('gh', ['pr', 'view', ...])`。 |
| `electron/main.ts:2653` | `github:issue-view` | Issue 詳情，`execFileSync('gh', ['issue', 'view', ...])`。 |
| `electron/main.ts:2664` | `github:pr-comment` | PR 留言，`execFileSync('gh', ['pr', 'comment', ...])`。 |
| `electron/main.ts:2675` | `github:issue-comment` | Issue 留言，`execFileSync('gh', ['issue', 'comment', ...])`。 |
| `electron/preload.ts:381` | `window.electronAPI.github.*` | Renderer bridge，所有 GitHub panel 呼叫都進 main process IPC。 |
| `src/components/GitHubPanel.tsx:117` | `listPRs/listIssues` | GitHub panel 載入 PR / Issue 資料。 |
| `src/components/GitHubPanel.tsx:140` | `checkCli` | consent 後檢查 CLI installed/authenticated。 |

排除項：`electron/agent-runtime/agent-registry.ts:236` 的 `defaultCommand: 'gh'` 是 GitHub Copilot CLI terminal-driven agent，不是 PR / Issue panel 路徑。

### spawn 配置摘要

| handler | API | binary | shell | env option | cwd | 備註 |
|---------|-----|--------|-------|------------|-----|------|
| `github:check-cli` | `execSync` | command string `gh --version`, `gh auth token` | `shell: true` | 未傳，繼承 Electron main `process.env` | 未傳 | 只回 `{ installed: false }`，錯誤被吞掉，沒有 log。 |
| `github:pr-list` | `execFileSync` | `'gh'` | shell false（預設） | 未傳，繼承 Electron main `process.env` | workspace cwd | 失敗時回 `{ error: message }`。 |
| `github:issue-list` | `execFileSync` | `'gh'` | shell false（預設） | 未傳，繼承 Electron main `process.env` | workspace cwd | 同上。 |
| `github:pr-view` | `execFileSync` | `'gh'` | shell false（預設） | 未傳，繼承 Electron main `process.env` | workspace cwd | 同上。 |
| `github:issue-view` | `execFileSync` | `'gh'` | shell false（預設） | 未傳，繼承 Electron main `process.env` | workspace cwd | 同上。 |
| `github:pr-comment` | `execFileSync` | `'gh'` | shell false（預設） | 未傳，繼承 Electron main `process.env` | workspace cwd | 同上。 |
| `github:issue-comment` | `execFileSync` | `'gh'` | shell false（預設） | 未傳，繼承 Electron main `process.env` | workspace cwd | 同上。 |

對照：`electron/pty-manager.ts:408/458/538` 會把 `process.env` 合併到 PTY 環境，但 GitHub panel 不是從 PTY 裡 spawn；它走 main process IPC。`electron/claude-resolver.ts:112-172` 有 PATH scan + common locations 的 resolver pattern，GitHub CLI 目前沒有等價設計。

### 根因假說優先序

1. **最高信心：Electron main process PATH snapshot 缺 GitHub CLI 目錄，GitHub handler 又只用裸 `gh`。**
   - 證據：所有 PR / Issue handler 直接 `execFileSync('gh', ...)`，沒有 `env`、沒有 resolver、沒有 common Windows path fallback。
   - 使用者環境確認：`where gh` 指向 `C:\Program Files\GitHub CLI\gh.exe`，`gh --version` 為 2.92.0；目前 shell 的 `PATH` 包含 `C:\Program Files\GitHub CLI`。
   - 重現證據：把 GitHub CLI 目錄從 `PATH` 移除後，Node `execFileSync('gh', ['--version'])` 穩定回 `ENOENT spawnSync gh ENOENT`；同一環境用絕對路徑 `C:/Program Files/GitHub CLI/gh.exe` 可成功。
   - 最符合「外部 shell OK / BAT panel 失敗」：外部 shell 可有較新的 PATH；BAT main process 可能是長壽命 GUI process，拿到的是啟動時 snapshot。
2. **中信心：`check-cli` 與後續 PR/Issue handler 的解析策略不一致。**
   - `check-cli` 用 `execSync(..., shell:true)`；列表/詳情/留言用 `execFileSync('gh', args)`。一旦 PATH 或 PATHEXT 行為有差異，可能出現 check 與實際操作不一致。
3. **低信心：cwd 或 repo auto-detect 導致 gh 報錯。**
   - `getGithubRepoFromOrigin` 已用 `--repo owner/repo` 減少 cwd 依賴；若 cwd/repo 有問題，錯誤應偏向 repo/auth，而非「找不到 gh」。

BAT log 補充：`%APPDATA%\better-agent-terminal\Logs\debug-20260515-*.log` 未找到 `gh` / `github` / `ENOENT` 相關記錄；現有 handler 也沒有記錄 caught error，所以 log 缺證據是預期結果。

### 修復方案候選

| 方案 | changes summary | 影響範圍 | trade-off | sizing |
|------|-----------------|----------|-----------|--------|
| A（推薦） | 新增 `electron/gh-resolver.ts`：解析順序 `customPath?`（先不做 UI 可略）→ `PATH` 掃描 `gh.exe` → Windows common locations（`C:\Program Files\GitHub CLI\gh.exe`、`%LOCALAPPDATA%\Programs\GitHub CLI\gh.exe`）→ `where.exe gh`；所有 handler 改用 resolved absolute path + `execFileSync(resolvedGh, args)`。 | `electron/main.ts`、新增 resolver、unit tests。 | 最小 UI 變更；可直接修已知安裝路徑與 stale PATH；需注意跨平台 common locations。 | S-M |
| B | 在 GitHub handler 執行前建 `envWithGithubCliPath`，Windows 下若 common location 存在就 prepend 到 `PATH`，仍用裸 `gh`。 | `electron/main.ts` 小改。 | diff 最小，但仍依賴 PATH 解析；不如絕對路徑可觀測、可測。 | S |
| C | 設定面板新增「Custom gh path」，類似 Claude Runtime customPath；resolver 優先使用使用者指定路徑。 | settings type/store/UI/main handler。 | 對非標準安裝最完整，但 UI/設定面較大；建議作為 A 的延伸，不作為第一刀。 | M |
| D | 改善錯誤 UX：找不到 gh 時顯示 resolved attempts、目前 PATH 摘要、官方安裝連結；`check-cli` 不吞錯。 | `electron/main.ts`、`GitHubPanel`、locale。 | 不直接修 resolver，但大幅降低下次 debug 成本；應與 A 或 B 同做。 | S |

### 建議下一步

推薦派一張 fix 工單採 **方案 A + D 的最小版**：

- 新增 `gh-resolver`，仿 `claude-resolver` 但範圍更小，只接受 native executable。
- 所有 `github:*` handler 先 resolve once per call，再用絕對路徑呼叫 `execFileSync`。
- `github:check-cli` 回傳 `{ installed, authenticated, path?, error? }`，renderer 顯示「找不到 gh」時附帶嘗試過的路徑與重啟 BAT / 指定 PATH 建議。
- 測試：resolver unit tests 覆蓋 PATH hit、Windows common location hit、PATH miss；handler 可用 injected resolver 或小型 helper 測試。

是否需要先補環境資訊：不需要阻塞 fix。若要提高信心，可在 fix 工單額外加入臨時 debug log，記錄 `process.env.PATH` 是否含 `GitHub CLI`，但根本修法不依賴該資訊。

### 產出摘要

- 修改 `_ct-workorders/T0351-research-bug079-gh-cli-resolution-failure.md`：填寫 research 結論。
- Production code 未修改。
- `sprint-status.yaml`：不適用（檔案存在但為舊里程碑摘要，沒有 T0351 明細可同步）。

### 遭遇問題

無。

### 互動紀錄

無。

### Renew 歷程

無。

### 回報時間

2026-05-15 10:57 (UTC+8)

---

**派發指令**：在新 sub-session 輸入 `/ct-exec T0351`
