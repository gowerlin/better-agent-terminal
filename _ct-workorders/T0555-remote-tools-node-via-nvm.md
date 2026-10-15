---
schema_version: 1
schema_kind: workorder
id: T0555
title: "遠端工具「Node.js」改為可一鍵安裝：透過 nvm（`~/.nvm`，不需 sudo）安裝最新 LTS；偵測能看到 nvm 管理的 node（非互動 shell 也一樣），比照 uv 的使用體驗"
type: feature
status: TODO
repo: better-agent-terminal
project: "PLAN-037 延伸（使用者需求，第六十六 session）"
priority: P2
sizing: M
created_at: "2026-10-16T03:34:44+0800"
updated_at: "2026-10-16T03:34:44+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.5（與 T0551–T0554 同批）"
depends_on: []
related:
  - "T0407（PLAN-037 研究：node v1 不提供按鈕的理由，`_ct-workorders/T0407-research-remote-ai-toolchain.md` 第 139 / 161 行）；T0408–T0415（偵測、食譜、完成標記、host 白名單、安裝 runner）"
  - "`src/lib/remote-tools/recipes.ts`（`case 'node'` → `no-recipe`）、`electron/handlers/remote-tools.ts`（偵測）"
affects_files:
  - src/lib/remote-tools/recipes.ts
  - src/lib/remote-tools/install-request.ts
  - src/lib/remote-tools/install-runner.ts
  - src/lib/remote-tools/sentinel.ts
  - electron/handlers/remote-tools.ts
  - "src/components/remote-tools/**、src/components/profiles/RemoteToolsEntry.tsx（若顯示需調整）"
  - "src/locales/*.json（三語）"
  - "src/lib/remote-tools/__tests__/**（含 snapshot）、electron/**/__tests__/**"
  - "scripts/smoke-remote-headless.mjs（S10 判定若需補 node / nvm 欄位）"
  - "CLAUDE.md（若遠端工具段落需補）"
  - _ct-workorders/T0555-remote-tools-node-via-nvm.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 T0553 / T0554 在你之前進行（分頁標題、WSL / SSH 精靈 rollback）；不要動它們的檔案，以 HEAD 為準。"
  - "🔴 child_process 規則照 CLAUDE.md「Child Process Spawning」：`execFile` / `spawn` + array args，禁用 shell 模板字串；外部輸入白名單；timeout 必設。安裝指令沿用既有 install-runner（在遠端終端分頁打入指令）與 host 白名單，nvm 安裝來源加進白名單時寫明來源（`raw.githubusercontent.com/nvm-sh/nvm/<釘選 tag>/install.sh`），**釘選 nvm 版本 tag**，不用 `master`。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）。WSL 實機：可在 `Ubuntu-24.04` 實際安裝 nvm + Node LTS（使用者已同意）；不得改 `/mnt/c` 下任何東西，不動 Windows 端的 nvm4w / npm。server 結束時仍在 9877、active、指紋不變。"
  - "🔴 nvm 會改 `~/.bashrc`（追加載入片段）——這是 nvm 官方行為、可接受；不得刪改 `.bashrc` 其他內容。安裝前記錄 `.bashrc` sha256 與備份路徑，回報區列出差異。"
---

# T0555 — 遠端工具 Node.js：透過 nvm 一鍵安裝

## 背景

遠端工具清單（PLAN-037）中 Node.js 是「可選」且**沒有一鍵安裝**（顯示「此工具沒有一鍵安裝。安裝說明」）。T0407 的理由：claude / codex 的官方 installer 都不需要 node；bat-server 自帶的 node 不在 PATH；Ubuntu 24.04 apt 的 `nodejs` 只有 18.19。

使用者需求（2026-10-16）：Node 也要能一鍵安裝，並以 **nvm** 管理版本，比照 Python 透過 uv。

## 已知技術點

- nvm 是 sourced shell 函式（`$NVM_DIR/nvm.sh`），安裝腳本會在 `~/.bashrc`（或 `~/.profile` / `~/.zshrc`）追加載入片段。Ubuntu 預設 `.bashrc` 在非互動 shell 開頭就 return，所以 BAT 偵測（login / 非互動 shell 的 `command -v node`）很可能看不到 nvm 管理的 node。
- `nvm install --lts` 下載 nodejs.org 的 binary，並以 SHASUMS256 校驗。
- 偵測時要注意 T0407 記錄的 Windows interop 遮蔽：WSL 的 PATH 有大量 `/mnt/*`，`command -v npm` 可能解析到 `/mnt/c/nvm4w/nodejs/npm`。這種情況要沿用既有的 interop-only 警示，不能當成已安裝。

## 任務

1. **偵測**：node 偵測先嘗試載入 `${NVM_DIR:-$HOME/.nvm}/nvm.sh`（存在才載入），再取 `node --version` 與路徑；另回報 nvm 是否存在與其版本（顯示在卡片上，例如「nvm 0.40.x」）。interop-only 的 node 仍視為未安裝並保留警示。本機短連線與遠端視窗兩條偵測路徑行為一致。
2. **安裝食譜**：Linux（apt / dnf / apk 皆可，不需 sudo）：釘選 tag 的 nvm `install.sh` → 載入 nvm → `nvm install --lts` → `nvm alias default 'lts/*'` → 寫完成標記（沿用 sentinel 機制）。確認對話框顯示來源與完整性說明（nvm tag、Node SHASUMS，三語）。macOS（SSH 目標）：同樣用 nvm；若既有架構不支援 macOS 食譜，就維持說明連結並在回報區寫明。Alpine（musl）：nodejs.org 沒有官方 musl binary，nvm 會改成從原始碼編譯，太慢 → 此平台維持「沒有一鍵安裝」並附說明。
3. **已安裝 node 但非 nvm**（例如 apt 的 18.x）：顯示版本；是否提供「透過 nvm 安裝 LTS」由你決定並說明（不得移除系統 node）。
4. **更新**：nvm 管理的 node 若不是最新 LTS，比照 claude 的「更新」按鈕（`nvm install --lts --reinstall-packages-from=current` 或等價做法，取捨寫進回報區）；做不到就只做安裝。
5. **測試**：食譜 snapshot / 單元測試（指令內容、host 白名單、平台分支、Alpine 不提供）、偵測解析（nvm 存在 / 不存在 / interop-only / apt node）。
6. **WSL 實機**（`Ubuntu-24.04`，條件見 memory_overrides）：以隔離實例（本機 build）開啟工具面板 → 對 Node.js 按安裝 → 遠端分頁跑完 → 「重新檢查」顯示 node LTS 版本與 nvm；另以非互動方式（`wsl -d Ubuntu-24.04 --exec bash -lc 'command -v node'` 與 BAT 偵測）確認看得到。smoke `npm run smoke:remote:headless` 13/13。
7. 更新 T0407 / PLAN-037 相關描述不必改歷史，只在 CLAUDE.md（若有遠端工具段落）或 docs 補 node / nvm 行為。

## 驗收條件

- [ ] Node.js 卡片在 Linux（apt / dnf）有一鍵安裝；Alpine 維持說明連結
- [ ] 安裝後偵測顯示 node LTS 版本與 nvm 版本；非互動 shell 也看得到
- [ ] interop-only node 不被當成已安裝
- [ ] nvm 版本釘選、來源加入白名單、確認對話框有來源與完整性說明（三語）
- [ ] `npm run test:unit` 全綠（含新測試，基線以 HEAD 為準）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] WSL 實機安裝成功、smoke 13/13；`.bashrc` 只多出 nvm 的載入片段

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
