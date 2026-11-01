---
schema_version: 1
schema_kind: workorder
id: T0756
title: "修正 BUG-187：Node.js 安裝 / 更新 recipe 先確保 `libatomic1`、裝完驗證可執行；順修 T0755 後過時的 server PATH 文件"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T01:12:29+0800"
depends_on: [T0755]
related:
  - "BUG-187；D208；BUG-186 / T0753（`parseVersionError` / `missingLibrary` 說明原因）；T0555 / T0556（nvm recipe、login profile loader）"
  - "`src/lib/remote-tools/recipes.ts`（node 的 install / update 命令、`apk` 的 `alpinePackages` prerequisite 前例、`rootPrefix` / `needsSudoFor`）、`install-runner.ts`、`src/lib/remote-tools/__tests__/recipes.test.ts`"
  - "過時文件：`docs/agent-guide/remote-security.md` 第 18 行「BAT 不改 server / systemd / launchd / Docker 的 PATH」、`docs/remote-dev-overview.md`「Where the server PATH comes from (none of these is changed by BAT)」——T0755 / PLAN-057 起 bat-server 預設取登入 shell PATH（`docs/agent-guide/headless-login-shell-path.md`）"
affects_files:
  - src/lib/remote-tools/recipes.ts
  - src/lib/remote-tools/install-runner.ts
  - src/lib/remote-tools/__tests__/
  - src/components/remote-tools/
  - src/components/__tests__/remote-tools-panel.test.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - docs/agent-guide/remote-security.md
  - docs/remote-dev-overview.md
  - _ct-workorders/T0756-fix-bug187-node-recipe-libatomic.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先查證再修：① 以 `recipes.ts` 實際組出的 node install / update 命令（各 pkgManager × privilege）列出現況；② 確認 nodejs.org 官方 Linux binary 哪些版本 / 架構需要 `libatomic.so.1`（以實際 `ldd` 或官方說明為準，不憑印象）；③ 各套件管理器提供該程式庫的套件名（apt `libatomic1`、dnf / yum、zypper、pacman 等，查證後再寫；查不到的不對應，改走④的說明）。`src/components/remote-tools/`（`RemoteToolsPanel.tsx` / `InstallConfirmDialog.tsx`）/ locales / `install-runner.ts` 只有確實需要時才改。"
  - "🔴 修正方向（D208）：A. 有對應套件的套件管理器：Linux 安裝 / 更新 Node.js 前，若系統沒有 `libatomic.so.1`（例：`ldconfig -p` 查不到，或沿用既有偵測）就先以 recipe 既有的提權方式（`rootPrefix`，比照 `apk` 的 prerequisite）補裝，並列進 `prerequisites` 讓使用者在確認畫面看得到；需要 root 但沒有 sudo（`needs-root-no-sudo`）時不中止 node 安裝，改在命令最後提示缺少的程式庫與手動指令。B. 安裝 / 更新後跑一次 `node --version` 驗證：失敗時以 T0753 的方式（exit code ＋缺少的程式庫檔名白名單，不回 stderr 原文）讓面板顯示原因與修法，不把壞掉的版本當成功。🔴 nvm 本身仍不需要 sudo（T0555）；有 `libatomic.so.1` 時命令與現況一致（不多跑套件管理器）；macOS / musl / Docker root 不受影響或照實說明。"
  - "🔴 文件：修正上列兩處過時描述，改為「預設由 bat-server 啟動時取登入 shell PATH（PLAN-057 / T0755，可在 Settings 關閉）」並連到 `docs/agent-guide/headless-login-shell-path.md`；remote-dev-overview 的 BUG-186 段落補一句 BAT 的 Node.js 安裝會先處理 libatomic（BUG-187）。CLAUDE.md 不必改（除非新增必守規則）。"
  - "🔴 驗證：recipes 單元測試（含 apt 有 / 無 sudo、root、apk 不變、macOS 不變、已有程式庫時不多跑）、驗證步驟的解析測試、突變檢查（拿掉 prerequisite / 驗證步驟各一次，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`。實機：WSL Docker 只用 `bat-e2e-t0756-` 容器（例：`ubuntu:24.04` 最小映像，確認沒有 `libatomic1`），在容器內實際跑組出的 install 命令，裝完 `node --version` 成功；另以「無 sudo、非 root」情境驗提示。結束清掉測試容器 / 映像（不得 `prune`、不碰使用者容器）。不動使用者的 WSL 發行版與 bat-server；不用 SSH 主機。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`（T0755 曾把 LF 改成 CRLF）。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
---

# T0756 — 修正 BUG-187：Node.js recipe 與 `libatomic1`

## 元資料

- **工單編號**：T0756
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-02T01:12:29+0800
- **預估規模**：M

## 背景

遠端工具的「安裝 / 更新 Node.js」以 nvm 裝 LTS（目前 v26），v26 的官方 Linux binary 需要 `libatomic.so.1`；最小安裝的 Ubuntu / Debian 沒有 `libatomic1`，裝完 node 跑不起來（BUG-186 的根源，使用者 WSL 已由塔台手動補裝）。使用者決定修好後與 PLAN-057 一起發 `0.7.3-pre.3`（D208）。同時 T0755 讓 bat-server 取登入 shell PATH 後，兩份文件仍寫「BAT 不改 server PATH」，一併修正。

## 範圍

1. 查證 recipe 現況、libatomic 需求與各套件管理器套件名。
2. 安裝 / 更新前補裝程式庫（可提權時）或提示（不可提權時）；裝完驗證 `node --version`，失敗顯示原因。
3. 修正兩份過時文件。

## 不做

- 不改 nvm 安裝方式（仍免 sudo）、不改偵測端（T0753）、不改 PLAN-057 實作；不動使用者環境；不發版。

## 驗收

- [ ] 查證①–③有證據
- [ ] 單元測試 ＋ 突變檢查；typecheck 0 / 0、`test:unit`、`vite build`
- [ ] Docker 最小映像實跑：沒有 `libatomic1` → 安裝後 `node --version` 成功；無 sudo 情境顯示提示；測試資源已清
- [ ] 兩份文件已更新

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
