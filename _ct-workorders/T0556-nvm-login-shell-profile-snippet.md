---
schema_version: 1
schema_kind: workorder
id: T0556
title: "T0555 後續：nvm 安裝 / 更新時，在 bash login 實際會讀的 profile 檔追加「nvm 尚未載入才載入」的片段（冪等、可辨識），讓非互動 login shell（`bash -lc`）也找得到 nvm 管理的 node"
type: feature
status: TODO
repo: better-agent-terminal
project: "T0555 後續（使用者決定，第六十六 session）"
priority: P2
sizing: S
created_at: "2026-10-16T04:52:56+0800"
updated_at: "2026-10-16T04:52:56+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.5（與 T0551–T0555 同批）"
depends_on: [T0555]
related:
  - "T0555（`e9cae8d8`；PARTIAL：`bash -lc` 看不到 nvm 的 node，回報區「遭遇問題 1」選項 b）"
  - "`src/lib/remote-tools/recipes.ts`（node install / update 指令、notes）、`docs/remote-dev-overview.md`「Remote tools: Node.js via nvm (T0555)」"
affects_files:
  - src/lib/remote-tools/recipes.ts
  - "src/lib/remote-tools/__tests__/**（含 snapshot）"
  - "src/components/remote-tools/**（若 notes / 對話框文字需調整）"
  - "src/locales/*.json（三語）"
  - "e2e/t0555-node-nvm-wsl.spec.ts（僅在需要時補斷言，opt-in 行為不變）"
  - docs/remote-dev-overview.md
  - _ct-workorders/T0556-nvm-login-shell-profile-snippet.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`；工單檔一併 commit（`src/styles/settings.css` 的 M 不是你的變更；`_ct-workorders/T0555-*.md` 的回報區由塔台處理，不要改）。"
  - "🔴 使用者已核准：在 WSL `Ubuntu-24.04` 的使用者 profile 檔**只追加**一段 nvm 載入片段。動之前備份該檔（路徑寫進回報區）；不得刪改檔案其他內容；不動 `.bashrc`（T0555 的 nvm 片段已在）。不碰 `/mnt/c`、nvm4w、使用者 BAT（9876）；WSL server 結束時 9877、active、指紋不變（若需部署測試版 server JS，結束時 rollback，同 T0555）。"
  - "🔴 不改 nvm 本身的安裝方式（釘選 tag `v0.40.8`、`METHOD=script`、`NVM_DIR` 先設定皆維持 T0555）。"
---

# T0556 — nvm：讓 `bash -lc` 也找得到 node

## 背景

T0555 讓遠端工具的 Node.js 可以透過 nvm 一鍵安裝。BAT 偵測與 BAT 終端都看得到 node，但非互動 login shell（`bash -lc 'command -v node'`）看不到：nvm 官方只在 `~/.bashrc` 結尾追加載入片段，而 Ubuntu 預設 `.bashrc` 對非互動 shell 在開頭就 `return`。遠端的 AI agent / 工具（例如 `npx` 啟動的 MCP server、agent 執行的指令）常以非互動 login shell 執行，所以這個缺口有實際影響。使用者 2026-10-16 選擇 T0555 回報的選項 b，並要求加上防重複。

## 任務

1. **目標檔案**：bash 的 login shell 只讀 `~/.bash_profile`、`~/.bash_login`、`~/.profile` 中**第一個存在的**。片段要寫進那個檔案；三個都不存在時建立 `~/.profile`。（若存在的是 `~/.bash_profile` 卻不讀 `.profile`，寫進 `.profile` 就無效。）macOS（SSH 目標）同一規則；zsh 的 `~/.zprofile` 不在本單範圍，回報區說明。
2. **片段**：以標記註解包住，可辨識、冪等（已存在就不再追加），內容為「`NVM_DIR` 設定 + nvm 尚未載入才載入 `nvm.sh`」（例如 `command -v nvm >/dev/null 2>&1 || [ ! -s "$NVM_DIR/nvm.sh" ] || . "$NVM_DIR/nvm.sh"`，實際寫法由你決定）。要求：
   - POSIX `sh` 相容（`.profile` 也會被 `sh` / dash 讀）
   - 互動 login shell（`.profile` 再 source `.bashrc`）不會載入兩次
   - nvm 不存在或 `nvm.sh` 損毀時不讓 login 失敗、不印錯誤
3. **套用時機**：install 指令在 `nvm alias default` 之後追加；update 指令也確保片段存在。這樣 T0555 已裝過的環境（例如使用者的 WSL）按一次「更新」就能補上。追加動作要冪等，重複按不會累積。
4. **說明文字**：確認對話框的 notes（三語）改為「會在 `.bashrc` 與 login profile 檔加入 nvm 載入片段」，移除 T0555 的「`bash -lc` 看不到」限制說明；更新 `docs/remote-dev-overview.md`。
5. **測試**：
   - 食譜 snapshot / 單元：install / update 都含片段、標記、冪等判斷、目標檔案選擇。
   - 真 shell 實跑（比照 T0552 / T0554 的 Git Bash `sh` 測試；Windows 無 dash 時另在 WSL 手動跑並記錄）：三種 profile 檔組合、重複執行不重複追加、`sh -lc` / `bash -lc` / `bash -lic` 都找得到 node、nvm 不存在時 login 正常且無輸出。
6. **WSL 實機**（`Ubuntu-24.04`，已由 T0555 裝好 nvm + Node 24.22.0）：以隔離實例（本機 build）對 Node.js 按「更新」→ 片段寫入 → `wsl -d Ubuntu-24.04 --exec bash -lc 'command -v node'` 找得到；再按一次「更新」→ 片段不重複；列出 profile 檔前後 diff 與 sha256；smoke 13/13。

## 驗收條件

- [ ] `bash -lc` / `sh -lc` 找得到 nvm 管理的 node；`bash -lic` 不載入兩次
- [ ] 片段冪等、有標記、只追加；寫進 bash login 實際會讀的檔案
- [ ] install 與 update 都會套用；三語說明已更新
- [ ] `npm run test:unit` 全綠（基線 4345 passed / 252 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] WSL 實機通過、smoke 13/13；profile 檔備份路徑與 diff 寫進回報區

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
